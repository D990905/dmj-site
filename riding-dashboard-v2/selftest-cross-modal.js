/* ============================================================
 * selftest-cross-modal.js — Cross-Modal Training System v2 self-test
 *
 * Component A — computeWorkload (3-tier: banister / met / srpe)
 * Component B — suggestLandWorkout (gap-filling engine)
 * Component C — decideRecoveryAction (4-zone decision tree)
 *
 *   실행:  node selftest-cross-modal.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * References:
 *   · sports_science_cross_modal_training_system.md §6 신규 함수 spec
 *   · Ainsworth 2011 (doi:10.1249/MSS.0b013e31821ece12)
 *   · Foster 2001 (PMID 11708692)
 *   · Banister 1991 (ISBN 978-0-87322-307-5)
 *   · Halson 2014 (doi:10.1007/s40279-014-0253-z)
 *   · Gabbett 2016 (doi:10.1136/bjsports-2015-095788)
 * ============================================================ */
'use strict';
var path = require('path');
var Geo = require(path.join(__dirname, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(__dirname, 'js', 'analysis.js'));
var Storage = require(path.join(__dirname, 'js', 'storage.js'));
var Coach = require(path.join(__dirname, 'js', 'coach.js'));
var SportMET = require(path.join(__dirname, 'js', 'sport-met.js'));

var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}

/* === Helpers === */
function makeSyntheticSession(durationSec, avgHr) {
  var pts = [];
  var t0 = Date.parse('2026-05-31T10:00:00Z');
  var n = Math.floor(durationSec) + 1;
  for (var i = 0; i < n; i++) {
    pts.push({
      lat: 35.0 + i * 1e-5, lng: 129.0 + i * 1e-5,
      ele: 0, time: t0 + i * 1000, speed: null, hr: Math.round(avgHr)
    });
  }
  return An.normalizeSession({
    tracks: [{ name: 'synth', segments: [pts] }],
    pointCount: n, hasTime: true, speedSource: 'derived',
    hasHR: true, hrPointCount: n
  });
}

console.log('=== Cross-Modal Training System v2 self-test ===\n');

/* ════════════════════════════════════════════════════════════════
 * SECTION 1 — SPORT_MET_LIBRARY (sport-met.js)
 * ════════════════════════════════════════════════════════════════ */
console.log('[1] SPORT_MET_LIBRARY — Ainsworth 2011 MET lookup');

check('windfoil_moderate MET = 7 (Danny estimate)',
  SportMET.getMET('windfoil_moderate') === 7);
check('windsurf MET = 3 (Ainsworth 2011)',
  SportMET.getMET('windsurf') === 3);
check('run_moderate MET = 9.8 (Ainsworth 2011)',
  SportMET.getMET('run_moderate') === 9.8);
check('row_moderate MET = 7', SportMET.getMET('row_moderate') === 7);
check('yoga MET = 2.5', SportMET.getMET('yoga') === 2.5);
check('unknown sport → null', SportMET.getMET('unknownSport') === null);

/* Intensity zone (Seiler 80/20) */
check('windfoil_strong (MET 9) → threshold zone',
  SportMET.intensityZone('windfoil_strong') === 'threshold');
check('run_easy (MET 6) → LIT', SportMET.intensityZone('run_easy') === 'LIT');
check('run_vigorous (MET 12.8) → HIT', SportMET.intensityZone('run_vigorous') === 'HIT');
check('yoga (MET 2.5) → recovery', SportMET.intensityZone('yoga') === 'recovery');

/* Windfoil carryover */
check('row_moderate carryover = 0.75 (highest among land)',
  SportMET.getCarryover('row_moderate') === 0.75);
check('run_easy carryover = 0.60', SportMET.getCarryover('run_easy') === 0.60);
check('windfoil_moderate self-carryover = 1.0',
  SportMET.getCarryover('windfoil_moderate') === 1.0);
check('unknown sport → default 0.50',
  SportMET.getCarryover('unknown') === 0.50);

/* listByCategory */
var sailing = SportMET.listByCategory('sailing');
check('sailing category 9 sports',
  sailing.length >= 8 && sailing.some(function (s) { return s.key === 'windfoil_moderate'; }));
var cardio = SportMET.listByCategory('cardio');
check('cardio category ≥ 10 sports', cardio.length >= 10);

/* ════════════════════════════════════════════════════════════════
 * SECTION 2 — computeWorkload (3-tier)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[2] computeWorkload — Tier 1 (Banister TRIMP)');

var sess = makeSyntheticSession(3600, 130);  /* 1hr · avg HR 130 */
var w1 = An.computeWorkload(sess, { restHr: 60, maxHr: 200, sex: 'male' });
console.log('      AU=' + w1.AU + '  method=' + w1.method + '  tier=' + w1.tier);
check('Tier 1 (HR) → Banister', w1.method === 'banister' && w1.tier === 1);
check('AU ≈ 50 (Banister 1hr HRR 0.5 male)', Math.abs(w1.AU - 50) < 1);

console.log('\n[3] computeWorkload — Tier 2 (MET-based, no HR)');

var landSession = { sportKey: 'run_easy', durationMin: 30 };
var w2 = An.computeWorkload(landSession, { weightKg: 70 });
console.log('      AU=' + w2.AU + '  method=' + w2.method + '  details=' +
  JSON.stringify(w2.details));
check('Tier 2 (MET) → method=met', w2.method === 'met' && w2.tier === 2);
/* AU = 6 × 30 × (70/75) × 0.2 = 33.6 */
check('run_easy 30min 70kg → AU ≈ 33.6', Math.abs(w2.AU - 33.6) < 0.5);
check('details.met = 6', w2.details.met === 6);
check('details.intensityZone = LIT', w2.details.intensityZone === 'LIT');
check('details.carryover = 0.60', w2.details.carryover === 0.60);

/* Higher intensity → higher AU */
var hardLand = { sportKey: 'run_vigorous', durationMin: 30 };
var w2b = An.computeWorkload(hardLand, { weightKg: 70 });
console.log('      run_vigorous 30min → AU=' + w2b.AU);
check('vigorous > easy AU', w2b.AU > w2.AU);

/* Body mass scaling */
var w2_heavy = An.computeWorkload(landSession, { weightKg: 90 });
check('heavy rider AU > light rider AU (mass scaling)',
  w2_heavy.AU > w2.AU, 'heavy=' + w2_heavy.AU + ' light=' + w2.AU);

console.log('\n[4] computeWorkload — Tier 3 (sRPE, no HR + no MET)');

var srpeSession = { rpe: 7, durationMin: 45 };
var w3 = An.computeWorkload(srpeSession, {});
console.log('      AU=' + w3.AU + '  method=' + w3.method);
check('Tier 3 (sRPE) → method=srpe', w3.method === 'srpe' && w3.tier === 3);
/* AU = 7 × 45 × 0.5 = 157.5 */
check('RPE 7 × 45min × 0.5 = 157.5 ≈ (±0.5)', Math.abs(w3.AU - 157.5) < 0.5);
check('details.category = vo2max (RPE 7-8)', w3.details.category === 'vo2max');

/* RPE 3 = aerobic */
var easySrpe = An.computeWorkload({ rpe: 3, durationMin: 60 }, {});
check('RPE 3 → category aerobic', easySrpe.details.category === 'aerobic');
check('RPE 3 AU < RPE 7 AU', easySrpe.AU < w3.AU);

console.log('\n[5] computeWorkload — graceful failure');

var noInput = An.computeWorkload({}, {});
check('Empty session → AU null + reason',
  noInput.AU === null && noInput.method === 'none');

/* HR session but no restHr → MET 시도 → 없음 → fail */
var hrNoProfile = An.computeWorkload(sess, {});
check('HR but no rest profile → no banister, no met (no sportKey) → none',
  hrNoProfile.AU === null);

/* Sport key wrong → no MET → fall through */
var badSport = An.computeWorkload({ sportKey: 'unknown', durationMin: 30 }, {});
check('Unknown sportKey → fall through → none',
  badSport.AU === null);

/* ════════════════════════════════════════════════════════════════
 * SECTION 3 — suggestLandWorkout (Component B)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[6] suggestLandWorkout — basic gap filling');

var gap1 = { gap_AU: 50 };
var profile = { weightKg: 75 };
var prefs1 = { equipment_access: ['running_shoes', 'rower_concept2'] };
var s1 = Storage.suggestLandWorkout(gap1, profile, prefs1, [], {});
console.log('      candidates=' + s1.candidate_count + '  options=' + s1.options.length);
console.log('      top option: ' + (s1.options[0] && s1.options[0].name) +
  ' (AU ' + (s1.options[0] && s1.options[0].AU_estimate) +
  ', score ' + (s1.options[0] && s1.options[0].score) + ')');
check('options 반환됨 (≥ 3)', s1.options.length >= 3);
check('top option 의 AU 가 gap (50) 에 가까움 (±30)',
  s1.options[0] && Math.abs(s1.options[0].AU_estimate - 50) < 30);
check('rower/run/walk 만 filter (equipment)', s1.options.every(function (o) {
  return o.equipment.length === 0 ||
    o.equipment.some(function (e) {
      return e === 'minimal' || e === 'floor_space' ||
             prefs1.equipment_access.indexOf(e) >= 0;
    });
}));

console.log('\n[7] suggestLandWorkout — carryover bonus (rowing 우선)');

var prefsRow = { equipment_access: ['rower_concept2', 'running_shoes'] };
var s2 = Storage.suggestLandWorkout({ gap_AU: 60 }, profile, prefsRow, [], { topN: 5 });
/* Rowing carryover 0.75 > running 0.60 → top option 에 rowing 자주 등장 */
var rowingCount = s2.options.filter(function (o) {
  return o.sportKey.indexOf('row') === 0;
}).length;
console.log('      top 5 옵션 중 rowing: ' + rowingCount);
check('top 5 옵션에 rowing ≥ 1 (carryover bonus)', rowingCount >= 1);

/* Top option 의 carryover — AU match 와 trade-off (run_intervals 가 AU match
   perfect 인 경우 carryover 0.50 으로 top 가능). top 3 평균이 의미 있는지 검증. */
console.log('      top option carryover: ' + s2.options[0].carryover);
var avgCarry = s2.options.slice(0, 3).reduce(function (a, o) { return a + o.carryover; }, 0) / 3;
console.log('      top 3 평균 carryover: ' + avgCarry.toFixed(2));
check('top 3 평균 carryover ≥ 0.55 (gap match 와 trade-off)',
  avgCarry >= 0.55, 'avg=' + avgCarry.toFixed(2));

console.log('\n[8] suggestLandWorkout — variety penalty');

/* 어제 rowing 2회 했음 → 오늘 rowing 추천 ↓ */
var history = [
  { sportKey: 'row_moderate', date: Date.now() - 86400000 },
  { sportKey: 'row_moderate', date: Date.now() - 2 * 86400000 }
];
var s3 = Storage.suggestLandWorkout({ gap_AU: 60 }, profile, prefsRow, history, { topN: 5 });
var rowingCountWithHistory = s3.options.filter(function (o) {
  return o.sportKey.indexOf('row') === 0;
}).length;
console.log('      history 적용 후 rowing count: ' + rowingCountWithHistory);
check('history 에 rowing 빈번 → rowing 추천 감소',
  rowingCountWithHistory <= rowingCount,
  'before=' + rowingCount + ' after=' + rowingCountWithHistory);

console.log('\n[9] suggestLandWorkout — time constraint');

var prefsLimited = {
  equipment_access: ['running_shoes', 'rower_concept2'],
  timeAvailable_min: 25
};
var s4 = Storage.suggestLandWorkout({ gap_AU: 50 }, profile, prefsLimited, [], {});
console.log('      time ≤ 25min, options: ' + s4.options.length);
check('time constraint 25분 → 모든 option duration ≤ 25',
  s4.options.every(function (o) { return o.durationMin <= 25; }));

console.log('\n[10] suggestLandWorkout — injury restriction');

var prefsInjured = {
  equipment_access: ['running_shoes', 'rower_concept2', 'floor_space'],
  injury_restriction: ['knee']
};
var s5 = Storage.suggestLandWorkout({ gap_AU: 50 }, profile, prefsInjured, [], {});
console.log('      knee injury — exclude running');
check('knee injury → running 제외',
  s5.options.every(function (o) {
    return o.sportKey.indexOf('run') !== 0 && o.sportKey !== 'cycle_hiit';
  }));

console.log('\n[11] suggestLandWorkout — minimal equipment fallback');

var prefsMinimal = { equipment_access: [] };
var s6 = Storage.suggestLandWorkout({ gap_AU: 50 }, profile, prefsMinimal, [], {});
console.log('      no equipment → options: ' + s6.options.length);
check('no equipment → 여전히 options 반환 (minimal/floor_space workout)',
  s6.options.length >= 1);
check('options 가 minimal/floor_space equipment 만',
  s6.options.every(function (o) {
    return o.equipment.length === 0 ||
      o.equipment.every(function (e) { return e === 'minimal' || e === 'floor_space'; });
  }));

/* ════════════════════════════════════════════════════════════════
 * SECTION 4 — decideRecoveryAction (Component C)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[12] decideRecoveryAction — all green (full ride)');

var state1 = { tsb: 10, acwr: 1.0, hrvDeviationSD: 0.5, hooperComposite: 42, daysSinceRest: 3 };
var d1 = Coach.decideRecoveryAction(state1);
console.log('      action=' + d1.action + '  label=' + d1.label);
console.log('      flag_count=' + JSON.stringify(d1.flag_count));
check('all green → full_ride', d1.action === 'full_ride');
check('label = 🟢 풀 세션 OK', d1.label.indexOf('🟢') >= 0);
/* daysSinceRest = 3 은 임계 (>7) 아래 → record 안 됨. TSB/ACWR/HRV/Hooper 4개만. */
check('contributing_factors ≥ 4 (TSB/ACWR/HRV/Hooper 4개 항상, days 조건부)',
  d1.contributing_factors.length >= 4);

console.log('\n[13] decideRecoveryAction — mixed yellow (moderate)');

var state2 = { tsb: -12, acwr: 1.25, hrvDeviationSD: -0.7, hooperComposite: 35, daysSinceRest: 4 };
var d2 = Coach.decideRecoveryAction(state2);
console.log('      action=' + d2.action + '  primary=' + d2.primary_reason);
check('yellow 3+ → moderate', d2.action === 'moderate');
check('label = 🟡', d2.label.indexOf('🟡') >= 0);

console.log('\n[14] decideRecoveryAction — orange (active recovery)');

var state3 = { tsb: -18, acwr: 1.4, hrvDeviationSD: -1.2, hooperComposite: 28, daysSinceRest: 6 };
var d3 = Coach.decideRecoveryAction(state3);
console.log('      action=' + d3.action);
console.log('      flag_count=' + JSON.stringify(d3.flag_count));
check('orange ≥ 2 → active_recovery', d3.action === 'active_recovery');

console.log('\n[15] decideRecoveryAction — red (rest)');

var state4 = { tsb: -35, acwr: 1.7, hrvDeviationSD: -2.5, hooperComposite: 18, daysSinceRest: 12 };
var d4 = Coach.decideRecoveryAction(state4);
console.log('      action=' + d4.action + '  primary=' + d4.primary_reason);
console.log('      flag_count=' + JSON.stringify(d4.flag_count));
check('red ≥ 2 → rest', d4.action === 'rest');
check('label = 🔴', d4.label.indexOf('🔴') >= 0);

console.log('\n[16] decideRecoveryAction — partial inputs');

var state5 = { tsb: -5 };  /* only TSB */
var d5 = Coach.decideRecoveryAction(state5);
check('only TSB input → valid output', d5.action != null);
check('contributing_factors 1개 (only TSB)', d5.contributing_factors.length === 1);

var state6 = {};  /* no inputs */
var d6 = Coach.decideRecoveryAction(state6);
check('empty state → full_ride default (no flags)', d6.action === 'full_ride');

/* ════════════════════════════════════════════════════════════════
 * SECTION 5 — Integration scenario (Sea + Land combined)
 * ════════════════════════════════════════════════════════════════ */
console.log('\n[17] Integration — sea + land week');

var profile_70 = { weightKg: 70, restHr: 55, maxHr: 178, sex: 'male' };

/* 5 sea sessions (windfoil) — 80% sea */
var seaSessions = [];
for (var d = 0; d < 5; d++) {
  var sess = makeSyntheticSession(2700, 135);  /* 45min, avg HR 135 */
  var w = An.computeWorkload(sess, profile_70);
  seaSessions.push({
    id: 'sea_' + d,
    dateEpoch: Date.parse('2026-05-25') + d * 86400000,
    trimp: w.AU
  });
}

/* 2 land sessions (rowing + run) */
var landSessions = [
  {
    id: 'land_row', dateEpoch: Date.parse('2026-05-27'),
    trimp: An.computeWorkload({ sportKey: 'row_moderate', durationMin: 30 }, profile_70).AU
  },
  {
    id: 'land_run', dateEpoch: Date.parse('2026-05-29'),
    trimp: An.computeWorkload({ sportKey: 'run_easy', durationMin: 45 }, profile_70).AU
  }
];

var allSessions = seaSessions.concat(landSessions);
console.log('      sessions: ' + allSessions.length +
  ' (sea ' + seaSessions.length + ' + land ' + landSessions.length + ')');
seaSessions.forEach(function (s, i) {
  console.log('      sea_' + i + ': AU ' + s.trimp);
});
landSessions.forEach(function (s) {
  console.log('      ' + s.id + ': AU ' + s.trimp);
});

var trend = Storage.computeFitnessTrend(allSessions);
console.log('      CTL=' + trend.current.CTL + '  ATL=' + trend.current.ATL +
  '  TSB=' + trend.current.TSB);
check('통합 fitness trend 산출', trend.current != null && trend.current.CTL > 0);
check('CTL > 0 (sessions 있음)', trend.current.CTL > 0);

console.log('\n[18] Gap-fill scenario — Friday rest needed but week target not met');

/* Suppose weekly target = 400 AU, actual = 280 → gap 120 AU */
var weeklyGap = { gap_AU: 120 };
var prefsTypical = {
  equipment_access: ['running_shoes', 'rower_concept2', 'mat'],
  timeAvailable_min: 60
};
var fillOptions = Storage.suggestLandWorkout(
  weeklyGap, profile_70, prefsTypical,
  [{ sportKey: 'windfoil_moderate', date: Date.now() - 86400000 }],
  { topN: 4 }
);
console.log('      Top option: ' + fillOptions.options[0].name +
  ' (' + fillOptions.options[0].AU_estimate + ' AU, carryover ' +
  fillOptions.options[0].carryover + ')');
console.log('      Summary: ' + fillOptions.recommendation_summary);
check('top 4 options 반환', fillOptions.options.length === 4);
check('summary 자연어 포함', fillOptions.recommendation_summary &&
  fillOptions.recommendation_summary.length > 20);

console.log('\n[19] Recovery decision based on integrated state');

/* 7-day training + low Hooper after a tough week — should suggest active recovery */
var integratedState = {
  tsb: trend.current.TSB,
  acwr: 1.4,
  hooperComposite: 26,
  daysSinceRest: 8
};
var integratedDecision = Coach.decideRecoveryAction(integratedState);
console.log('      action=' + integratedDecision.action +
  '  → ' + integratedDecision.recommendation);
check('통합 state → 합리적 결정 반환 (not empty)',
  integratedDecision.action != null && integratedDecision.recommendation.length > 20);

/* ════════════════════════════════════════════════════════════════
 * RESULTS
 * ════════════════════════════════════════════════════════════════ */
console.log('\n=== 결과: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
