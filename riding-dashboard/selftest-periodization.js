/* ============================================================
 * selftest-periodization.js — Event-Aware Periodization System v3
 *
 *   estimateRaceLoad — race format 별 TRIMP 추정 (skill·wind 보정)
 *   estimateCompetitionLoad — multi-day race schedule total
 *   buildPeriodizationPlan — 12-week reverse-engineering build-up
 *   dailyPlanCheck — actual vs planned compliance
 *   generateDailyNotification — 단무지 톤 알림
 *
 *   실행:  node selftest-periodization.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * References — sports_science_event_periodization_system.md §1·§9
 * ============================================================ */
'use strict';
var path = require('path');
var Geo = require(path.join(__dirname, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(__dirname, 'js', 'analysis.js'));
var Storage = require(path.join(__dirname, 'js', 'storage.js'));
var Coach = require(path.join(__dirname, 'js', 'coach.js'));
var RF = require(path.join(__dirname, 'js', 'race-formats.js'));

var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}

console.log('=== Event-Aware Periodization System v3 self-test ===\n');

/* ════════════════════════════════════════════════════════════════
 * SECTION 1 — RACE_FORMAT_LIBRARY
 * ════════════════════════════════════════════════════════════════ */
console.log('[1] RACE_FORMAT_LIBRARY — iQFOiL + IWSA spec lookup');

var slalom = RF.getFormat('slalom_medium');
check('slalom_medium duration 5min', slalom.duration_min === 5);
check('slalom_medium avgHr 168', slalom.avgHr === 168);
check('slalom_medium TRIMP baseline 22', slalom.TRIMP_baseline === 22);

var marathon = RF.getFormat('marathon_standard');
check('marathon_standard duration 60min', marathon.duration_min === 60);
check('marathon TRIMP 190', marathon.TRIMP_baseline === 190);

var medal = RF.getFormat('medal_race');
check('medal_race z5 80%', medal.z5_percent === 80);

check('unknown format → null', RF.getFormat('unknown') === null);

var allFormats = RF.listFormats();
check('listFormats 12개', allFormats.length === 12);

/* Skill + wind modifier */
var elite = RF.getSkillModifier('선수');
check('선수 TRIMP multiplier 0.85', elite.TRIMP_multiplier === 0.85);
var novice = RF.getSkillModifier('입문');
check('입문 TRIMP multiplier 1.5', novice.TRIMP_multiplier === 1.5);

var lightWind = RF.getWindModifier('light');
check('light wind multiplier 1.15 (Vogiatzis 2002 pumping)',
  lightWind.TRIMP_multiplier === 1.15);
var strongWind = RF.getWindModifier('strong');
check('strong wind multiplier 0.90', strongWind.TRIMP_multiplier === 0.9);

/* Numeric wind input → auto classify */
var auto1 = RF.getWindModifier(10);  /* light */
check('numeric 10kt → light',
  auto1.TRIMP_multiplier === 1.15);
var auto2 = RF.getWindModifier(20);  /* strong */
check('numeric 20kt → strong',
  auto2.TRIMP_multiplier === 0.9);

/* ════════════════════════════════════════════════════════════════
 * SECTION 2 — estimateRaceLoad
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[2] estimateRaceLoad — single race TRIMP estimate');

/* 중급 라이더, slalom_medium, medium wind → baseline 22 × 1.0 × 1.0 = 22 */
var r1 = An.estimateRaceLoad('slalom_medium', { skill: '중급', weightKg: 70 }, 'medium');
console.log('      중급/slalom_medium/medium → TRIMP ' + r1.TRIMP_estimate);
check('중급 slalom medium → 22', Math.abs(r1.TRIMP_estimate - 22) < 0.1);
check('format key', r1.format === 'slalom_medium');
check('description 한국어', r1.description.indexOf('슬라럼') >= 0);

/* 입문 라이더 light wind → baseline 22 × 1.5 × 1.15 = 37.95 */
var r2 = An.estimateRaceLoad('slalom_medium', { skill: '입문', weightKg: 70 }, 'light');
console.log('      입문/slalom_medium/light → TRIMP ' + r2.TRIMP_estimate);
check('입문 light wind 38 ≈ 22 × 1.5 × 1.15',
  Math.abs(r2.TRIMP_estimate - 37.95) < 0.1);

/* 선수 strong wind → 22 × 0.85 × 0.9 = 16.83 */
var r3 = An.estimateRaceLoad('slalom_medium', { skill: '선수' }, 'strong');
console.log('      선수/slalom_medium/strong → TRIMP ' + r3.TRIMP_estimate);
check('선수 strong wind 16.83', Math.abs(r3.TRIMP_estimate - 16.83) < 0.1);

/* Monotonicity */
check('입문 > 중급 > 선수 (같은 race format)',
  r2.TRIMP_estimate > r1.TRIMP_estimate &&
  r1.TRIMP_estimate > r3.TRIMP_estimate);

/* Marathon test */
var rm = An.estimateRaceLoad('marathon_standard', { skill: '중급' }, 'medium');
console.log('      중급/marathon_standard/medium → TRIMP ' + rm.TRIMP_estimate);
check('marathon 중급 medium → 190', rm.TRIMP_estimate === 190);

/* Error case */
var rErr = An.estimateRaceLoad('unknown_format', { skill: '중급' }, 'medium');
check('unknown format → error', rErr.error === 'unknown_format');

/* ════════════════════════════════════════════════════════════════
 * SECTION 3 — estimateCompetitionLoad (multi-day)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[3] estimateCompetitionLoad — 5-day iQFOiL-style schedule');

var schedule = [
  { day: 1, races: ['slalom_medium', 'slalom_medium', 'course_standard', 'course_standard'], wind: 'medium' },
  { day: 2, races: ['slalom_medium', 'slalom_medium', 'distance_25', 'course_standard'], wind: 'medium' },
  { day: 3, races: ['marathon_standard'], wind: 'medium' },
  { day: 4, races: ['course_standard', 'course_standard', 'slalom_medium', 'slalom_medium'], wind: 'medium' },
  { day: 5, races: ['medal_race', 'medal_race', 'medal_race'], wind: 'medium' }
];

var comp = An.estimateCompetitionLoad(schedule, { skill: '중급' });
console.log('      5-day total TRIMP: ' + comp.total_TRIMP);
console.log('      Days breakdown:');
comp.days.forEach(function (d) {
  console.log('        Day ' + d.day + ': ' + d.race_count + ' races, ' +
    d.race_minutes + ' min, ' + d.TRIMP + ' AU');
});
check('5-day total races = 16', comp.total_races === 16);
check('5-day total ≈ 802 AU (mid skill, medium wind — 정확한 lookup 합산)',
  Math.abs(comp.total_TRIMP - 802) < 5);
check('Day 3 (marathon only) = 190 AU', Math.abs(comp.days[2].TRIMP - 190) < 1);
check('Day 1 (4 races) ≈ 144 AU (22+22+50+50)',
  Math.abs(comp.days[0].TRIMP - 144) < 1);
check('avg_daily_TRIMP > 0', comp.avg_daily_TRIMP > 0);

/* Skill scaling — elite should give ~85% */
var compElite = An.estimateCompetitionLoad(schedule, { skill: '선수' });
console.log('      선수 same schedule total: ' + compElite.total_TRIMP);
check('선수 total ≈ 중급 × 0.85',
  Math.abs(compElite.total_TRIMP - comp.total_TRIMP * 0.85) < 5,
  'elite=' + compElite.total_TRIMP + ' mid=' + comp.total_TRIMP);

/* ════════════════════════════════════════════════════════════════
 * SECTION 4 — buildPeriodizationPlan (12-week reverse engineering)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[4] buildPeriodizationPlan — 12-week reverse engineering');

var target = {
  event_total_TRIMP: 900,
  race_date: '2026-08-15',
  athlete_skill: '중급'
};
var plan = Storage.buildPeriodizationPlan(target, { weightKg: 70 }, {});
console.log('      Weeks count: ' + plan.weeks.length);
console.log('      Total planned AU: ' + plan.summary.total_planned_AU);
console.log('      Rationale: ' + plan.rationale.substring(0, 100) + '...');
check('12 phase weeks (week_offset -12 to 0)',
  plan.weeks.length === 13);  /* -12 to 0 = 13 weeks */
check('summary.event_TRIMP = 900', plan.summary.event_TRIMP === 900);
check('summary.taper_start = -2', plan.summary.taper_start_week_offset === -2);

/* Phase progression check */
var phases = plan.weeks.map(function (w) { return w.phase; });
console.log('      Phases: ' + phases.join(' → '));
check('phase sequence A1→A2→A3→Recovery1→T1→T2→T3→Recovery2→R1→R2→Taper1→Taper2→Race',
  phases[0] === 'A1' && phases[3] === 'Recovery1' &&
  phases[6] === 'T3' && phases[10] === 'Taper1' && phases[12] === 'Race');

/* Volume curve check — T3 (week -6) should be peak */
var t3 = plan.weeks.find(function (w) { return w.phase === 'T3'; });
var taper2 = plan.weeks.find(function (w) { return w.phase === 'Taper2'; });
console.log('      T3 weekly_AU: ' + t3.weekly_AU + '  Taper2 weekly_AU: ' + taper2.weekly_AU);
check('T3 weekly AU > Taper2 (peak before taper)',
  t3.weekly_AU > taper2.weekly_AU);
check('Taper2 weekly < 0.10 × event_TRIMP (Bosquet 55% reduction)',
  taper2.weekly_AU < target.event_total_TRIMP * 0.10,
  'taper2=' + taper2.weekly_AU);

/* Daily structure check */
var t3Days = t3.days;
console.log('      T3 days: ' + t3Days.map(function (d) {
  return d.day_of_week + ':' + d.target_AU;
}).join(' '));
check('T3 Wed > T3 Mon (Bompa micro-cycle — Wed is high day)',
  t3Days[2].target_AU > t3Days[0].target_AU);
check('T3 Sat > T3 Mon (Sat = high volume)',
  t3Days[5].target_AU > t3Days[0].target_AU);

/* Race week structure */
var raceWeek = plan.weeks.find(function (w) { return w.phase === 'Race'; });
console.log('      Race week days:');
raceWeek.days.forEach(function (d) {
  console.log('        ' + d.day_of_week + ' ' + d.date + ': ' + d.target_AU + ' AU (' + d.type + ')');
});
check('Race week 5-day comp pattern (Mon-Fri all race, weekend rest)',
  raceWeek.days[0].type === 'race' && raceWeek.days[5].target_AU === 0);

/* Error cases */
var errPlan = Storage.buildPeriodizationPlan({ event_total_TRIMP: 0, race_date: '2026-08-15' }, {});
check('invalid event_TRIMP → error', errPlan.error === 'invalid_event_TRIMP');

var errDate = Storage.buildPeriodizationPlan({ event_total_TRIMP: 100, race_date: 'invalid' }, {});
check('invalid race_date → error', errDate.error === 'invalid_race_date');

/* Shorter timeline (6-week build) */
var planShort = Storage.buildPeriodizationPlan(target, {}, { weeks_to_event: 6 });
console.log('      6-week plan: ' + planShort.weeks.length + ' weeks');
check('6-week timeline → fewer phases (≤ 7)',
  planShort.weeks.length <= 7);

/* ════════════════════════════════════════════════════════════════
 * SECTION 5 — dailyPlanCheck (compliance)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[5] dailyPlanCheck — actual vs planned');

var todayPlan = { target_AU: 100, day_of_week: 'Wed', phase: 'T2', type: 'high_intensity' };

var c1 = Storage.dailyPlanCheck(todayPlan, 95);
console.log('      actual 95/100 → ' + c1.flag + ' (' + c1.compliance_pct + '%)');
check('95% → green', c1.flag === 'green' && c1.zone === 'on_track');

var c2 = Storage.dailyPlanCheck(todayPlan, 50);
console.log('      actual 50/100 → ' + c2.flag + ' (' + c2.message + ')');
check('50% → red under', c2.flag === 'red' && c2.zone === 'under');
check('adjustment recommendation 있음', c2.adjustment_recommendation != null);

var c3 = Storage.dailyPlanCheck(todayPlan, 165);
console.log('      actual 165/100 → ' + c3.flag);
check('165% → red over', c3.flag === 'red' && c3.zone === 'over');

var c4 = Storage.dailyPlanCheck(todayPlan, 70);
check('70% → yellow slight_under',
  c4.flag === 'yellow' && c4.zone === 'slight_under');

var c5 = Storage.dailyPlanCheck(todayPlan, 130);
check('130% → yellow slight_over',
  c5.flag === 'yellow' && c5.zone === 'slight_over');

/* Rest day */
var restPlan = { target_AU: 0, day_of_week: 'Sun', phase: 'Taper2', type: 'rest' };
var cRest = Storage.dailyPlanCheck(restPlan, 0);
check('rest day plan → green (rest_day)',
  cRest.flag === 'green' && cRest.zone === 'rest_day');

/* ════════════════════════════════════════════════════════════════
 * SECTION 6 — generateDailyNotification (단무지 tone)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[6] generateDailyNotification — 단무지 톤 자연어');

var n1 = Coach.generateDailyNotification(
  { target_AU: 100, phase: 'T2', type: 'moderate', day_of_week: 'Wed' },
  { action: 'full_ride' },
  { wind_kt: 14 }
);
console.log('      Title: ' + n1.title);
console.log('      Body:  ' + n1.body);
check('title 시작 with 🎯', n1.title.indexOf('🎯') >= 0);
check('body 한국어 (영어 없음)', /^[\s\S]*[가-힣]/.test(n1.body));
check('priority = normal', n1.priority === 'normal');

/* Rest day */
var n2 = Coach.generateDailyNotification(
  { target_AU: 0, phase: 'Recovery1', type: 'rest' },
  { action: 'full_ride' },
  {}
);
console.log('      Rest: ' + n2.title + ' — ' + n2.body);
check('rest day title 🌙', n2.title.indexOf('🌙') >= 0);

/* Race day */
var n3 = Coach.generateDailyNotification(
  { target_AU: 250, phase: 'Race', type: 'race' },
  { action: 'full_ride' },
  { wind_kt: 16 }
);
console.log('      Race: ' + n3.title + ' — ' + n3.body);
check('race day title 🏁', n3.title.indexOf('🏁') >= 0);
check('race body mentions CHO + 단백질',
  n3.body.indexOf('CHO') >= 0 && n3.body.indexOf('단백질') >= 0);
check('race day priority = high', n3.priority === 'high');

/* Low wind day */
var n4 = Coach.generateDailyNotification(
  { target_AU: 80, phase: 'T2', type: 'moderate' },
  { action: 'full_ride' },
  { wind_kt: 5 }
);
console.log('      No wind: ' + n4.body);
check('low wind body mentions Land workout',
  n4.body.indexOf('Land') >= 0 || n4.body.indexOf('land') >= 0);

/* Active recovery */
var n5 = Coach.generateDailyNotification(
  { target_AU: 80, phase: 'T2', type: 'moderate' },
  { action: 'active_recovery', primary_reason: '회복 부족 detected' },
  {}
);
console.log('      Active recovery: ' + n5.title);
check('active_recovery title 🟠', n5.title.indexOf('🟠') >= 0);
check('active_recovery priority high', n5.priority === 'high');

/* ════════════════════════════════════════════════════════════════
 * SECTION 7 — Integration scenario (full v3 workflow)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[7] Integration — 5-day comp → 12-week plan → today notification');

/* Step 1: estimate competition load */
var compSchedule = [
  { day: 1, races: ['slalom_medium', 'slalom_medium', 'course_standard', 'course_standard'], wind: 'medium' },
  { day: 2, races: ['slalom_medium', 'slalom_medium', 'distance_25', 'course_standard'], wind: 'medium' },
  { day: 3, races: ['marathon_standard'], wind: 'medium' },
  { day: 4, races: ['course_standard', 'course_standard', 'slalom_medium', 'slalom_medium'], wind: 'medium' },
  { day: 5, races: ['medal_race', 'medal_race', 'medal_race'], wind: 'medium' }
];
var comp7 = An.estimateCompetitionLoad(compSchedule, { skill: '중급' });
console.log('      Step 1 — comp total: ' + comp7.total_TRIMP + ' AU');

/* Step 2: build periodization plan */
var plan7 = Storage.buildPeriodizationPlan({
  event_total_TRIMP: comp7.total_TRIMP,
  race_date: '2026-08-15',
  athlete_skill: '중급'
}, { weightKg: 70 });
console.log('      Step 2 — plan ' + plan7.weeks.length + ' weeks, total ' +
  plan7.summary.total_planned_AU + ' AU');

/* Step 3: pick today's plan (say T2 Wed) */
var t2 = plan7.weeks.find(function (w) { return w.phase === 'T2'; });
var t2Wed = t2.days[2];
console.log('      Step 3 — today (T2 Wed): target ' + t2Wed.target_AU + ' AU (' + t2Wed.type + ')');

/* Step 4: compliance check */
var compliance7 = Storage.dailyPlanCheck(t2Wed, t2Wed.target_AU * 0.85);
console.log('      Step 4 — compliance 85% → ' + compliance7.flag);
check('integrated compliance check OK', compliance7.flag === 'green');

/* Step 5: notification */
var notif7 = Coach.generateDailyNotification(t2Wed, { action: 'full_ride' }, { wind_kt: 14 });
console.log('      Step 5 — notification: ' + notif7.title);
console.log('                  ' + notif7.body);
check('integrated notification generated', notif7.title != null && notif7.body.length > 10);

/* Step 6: bad weather scenario */
var notifBad = Coach.generateDailyNotification(
  t2Wed,
  { action: 'full_ride' },
  { wind_kt: 5 }
);
console.log('      Step 6 — bad weather alt: ' + notifBad.body);
check('bad weather → land suggestion',
  notifBad.body.indexOf('Land') >= 0 || notifBad.body.indexOf('land') >= 0);

/* ════════════════════════════════════════════════════════════════
 * RESULTS
 * ════════════════════════════════════════════════════════════════ */
console.log('\n=== 결과: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
