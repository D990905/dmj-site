/* ============================================================
 * selftest-fitness-trend.js — CTL/ATL/TSB (Coggan PMC) self-test
 *
 * Coggan 2010 PMC (Performance Management Chart) 의 EWMA 정합성 검증.
 *   ATL = ATL_yesterday × exp(-1/7)  + Load_today × (1 − exp(-1/7))
 *   CTL = CTL_yesterday × exp(-1/42) + Load_today × (1 − exp(-1/42))
 *   TSB = CTL − ATL
 *
 *   실행:  node selftest-fitness-trend.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * localStorage / 브라우저 API 의존 없이 computeFitnessTrend 함수만 호출.
 *
 * References:
 *   · Coggan, A.R. & Allen, H. 2010. "Training and Racing with a Power Meter" 2e.
 *     VeloPress. ISBN 978-1-934030-55-2.
 *   · Banister, E.W. 1991. "Modeling Elite Athletic Performance".
 *     Human Kinetics. ISBN 978-0-87322-307-5.
 * ============================================================ */
'use strict';
var path = require('path');

/* storage.js 가 localStorage 를 참조하지만, computeFitnessTrend·interpretTSB
   는 순수 함수이므로 require 만 하면 동작한다. global.localStorage 부재
   는 다른 함수 (saveSession 등) 만 영향. */
var Storage = require(path.join(__dirname, 'js', 'storage.js'));

/* --- 미니 테스트 러너 --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}

/* --- helper: 가상 세션 생성 ---
   day 0 = 2026-05-01 UTC. day n = day 0 + n × ONE_DAY. */
var DAY_ZERO = Date.UTC(2026, 4, 1);  // 2026-05-01 UTC
var ONE_DAY = 86400000;
function session(dayN, trimp) {
  return {
    id: 'sess-' + dayN,
    dateEpoch: DAY_ZERO + dayN * ONE_DAY,
    trimp: trimp
  };
}

console.log('=== Fitness Trend (CTL/ATL/TSB) self-test ===\n');

/* ---------- 1) 정상상태 (steady state) — load 50 매일 ----------
   EWMA 정상상태: load 가 상수면 ATL → load (수렴), CTL → load.
   실제로 30일 정도면 ATL ≈ load × (1 - e^(-30/7)) ≈ load × 0.987 */
console.log('[1] 정상상태 — load 50 매일 × 60일');
var steady = [];
for (var i = 0; i < 60; i++) steady.push(session(i, 50));
var ft1 = Storage.computeFitnessTrend(steady);
var last1 = ft1.current;
console.log('      day=' + last1.date +
  '  ATL=' + last1.ATL + '  CTL=' + last1.CTL + '  TSB=' + last1.TSB);
check('60일 후 ATL → 50 수렴 (±0.5, 60일 = 8.57·atlK)',
  Math.abs(last1.ATL - 50) < 0.5, 'ATL=' + last1.ATL);
check('60일 후 CTL ≈ 38 (60일 = 1.43·ctlK, 1-e^(-1.43) ≈ 0.76)',
  Math.abs(last1.CTL - 38) < 1.5, 'CTL=' + last1.CTL);
check('TSB = CTL − ATL (음수 — 아직 적응 중)',
  last1.TSB < 0 && Math.abs(last1.TSB - (last1.CTL - last1.ATL)) < 0.01,
  'TSB=' + last1.TSB);

/* ---------- 2) 휴식 decay — 정상상태 후 0 부하 ---------- */
console.log('\n[2] Decay — load 50 × 60일, 그 후 휴식 30일');
var withRest = steady.slice();
/* 휴식 30일은 trimp:0 으로 추가 안 함 — opts.endDate 로 시계열만 연장 */
var ft2 = Storage.computeFitnessTrend(withRest, {
  endDate: DAY_ZERO + 89 * ONE_DAY  // day 89 = 60+29 (rest 30days)
});
var last2 = ft2.current;
console.log('      day=' + last2.date +
  '  ATL=' + last2.ATL + '  CTL=' + last2.CTL + '  TSB=' + last2.TSB);
check('휴식 30일 후 ATL ≈ 50·e^(-30/7) ≈ 0.7 (±0.3)',
  Math.abs(last2.ATL - 0.7) < 0.3, 'ATL=' + last2.ATL);
check('CTL 도 감소하지만 ATL 보다 느림 — CTL > ATL → TSB > 0 (회복)',
  last2.TSB > 0 && last2.CTL > last2.ATL,
  'CTL=' + last2.CTL + ' ATL=' + last2.ATL + ' TSB=' + last2.TSB);

/* ---------- 3) Taper 모델 검증 — 하드 트레이닝 후 회복 동역학 ----------
   하드 트레이닝 14일 (load 100) → 휴식 14일. TSB 가 (1) 훈련 중 매우 음수,
   (2) 휴식 시작 후 단조 증가, (3) 충분 시간 후 양수 도달 — 3 단계 검증. */
console.log('\n[3] Hard training + taper — PMC recovery dynamics');
var taper = [];
for (var i = 0; i < 14; i++) taper.push(session(i, 100));
var ft3 = Storage.computeFitnessTrend(taper, {
  endDate: DAY_ZERO + 27 * ONE_DAY  /* 14 hard + 14 rest */
});
var day13 = ft3.days[13];   /* 마지막 하드 훈련일 */
var day20 = ft3.days[20];   /* 7-day taper */
var day27 = ft3.days[27];   /* 14-day taper */
console.log('      day 13 (hard end): TSB=' + day13.TSB +
  '  ATL=' + day13.ATL + '  CTL=' + day13.CTL);
console.log('      day 20 (7-day taper): TSB=' + day20.TSB);
console.log('      day 27 (14-day taper): TSB=' + day27.TSB);
check('훈련 중 (day 13) TSB 매우 음수 (< -30)',
  day13.TSB < -30, 'TSB=' + day13.TSB);
check('7-day taper 후 TSB 회복 시작 (day 13 보다 ↑)',
  day20.TSB > day13.TSB, 'day13=' + day13.TSB + ' day20=' + day20.TSB);
check('14-day taper 후 TSB 양수 도달 (peak 영역)',
  day27.TSB > 0, 'TSB=' + day27.TSB);
/* peak 시점 = days 의 max TSB */
var maxTsb = -Infinity, maxDay = null;
ft3.days.forEach(function (d) {
  if (d.TSB > maxTsb) { maxTsb = d.TSB; maxDay = d; }
});
console.log('      peak TSB=' + Math.round(maxTsb * 10) / 10 +
  ' at ' + (maxDay ? maxDay.date : 'n/a'));
check('Peak TSB 가 taper 끝 부근 (day 25-27)',
  maxDay && maxDay.epoch >= DAY_ZERO + 25 * ONE_DAY,
  'peak at ' + (maxDay ? maxDay.date : 'n/a'));

/* ---------- 4) Empty / null trimp ---------- */
console.log('\n[4] Edge cases');
var ftEmpty = Storage.computeFitnessTrend([]);
check('빈 sessions → empty days + current null',
  ftEmpty.days.length === 0 && ftEmpty.current === null);

/* trimp: null 만 있는 sessions — days 는 만들어지되 ATL/CTL = 0 */
var noTrimp = [session(0, null), session(5, null), session(10, null)];
var ftNoTrimp = Storage.computeFitnessTrend(noTrimp);
check('trimp:null sessions → days 존재 + ATL/CTL = 0',
  ftNoTrimp.days.length === 11 &&
  ftNoTrimp.current.ATL === 0 && ftNoTrimp.current.CTL === 0,
  'days=' + ftNoTrimp.days.length);
check('sessionsWithTrimp = 0', ftNoTrimp.sessionsWithTrimp === 0);

/* ---------- 5) 같은 날 2 세션 — 합산 ---------- */
console.log('\n[5] 같은 날 2 세션 — TRIMP 합산');
var twoSame = [
  session(0, 50),
  { id: 's2', dateEpoch: DAY_ZERO + 12 * 3600000, trimp: 30 }  /* day 0 12pm */
];
var ftTwo = Storage.computeFitnessTrend(twoSame);
console.log('      day0 load=' + ftTwo.days[0].load +
  '  ATL=' + ftTwo.days[0].ATL + '  CTL=' + ftTwo.days[0].CTL);
check('같은 날 50 + 30 = 80 합산',
  Math.abs(ftTwo.days[0].load - 80) < 0.1, 'load=' + ftTwo.days[0].load);

/* ---------- 6) interpretTSB labels ---------- */
console.log('\n[6] TSB zone interpretation');
check('TSB > 25 → peaked', Storage.interpretTSB(30).zone === 'peaked');
check('TSB +10 → fresh', Storage.interpretTSB(10).zone === 'fresh');
check('TSB -5 → balanced', Storage.interpretTSB(-5).zone === 'balanced');
check('TSB -20 → productive', Storage.interpretTSB(-20).zone === 'productive');
check('TSB -35 → overreach', Storage.interpretTSB(-35).zone === 'overreach');
check('TSB null → unknown', Storage.interpretTSB(null).zone === 'unknown');

/* ---------- 7) EWMA 수학 직접 검증 ---------- */
console.log('\n[7] EWMA 수학 직접 검증 — load 100 day 1 only');
var single = [session(0, 100)];
var ftSingle = Storage.computeFitnessTrend(single, {
  endDate: DAY_ZERO + 6 * ONE_DAY  // 7 days total
});
/* day 0: ATL = 100 × (1 - e^(-1/7)) ≈ 13.35, CTL = 100 × (1 - e^(-1/42)) ≈ 2.35 */
var d0 = ftSingle.days[0];
var expATL0 = 100 * (1 - Math.exp(-1 / 7));
var expCTL0 = 100 * (1 - Math.exp(-1 / 42));
console.log('      day 0: ATL=' + d0.ATL + ' (expected ' + expATL0.toFixed(2) +
  ')  CTL=' + d0.CTL + ' (expected ' + expCTL0.toFixed(2) + ')');
check('day 0 ATL = 100·(1-e^(-1/7)) ≈ 13.35 (±0.01)',
  Math.abs(d0.ATL - expATL0) < 0.01, 'ATL=' + d0.ATL);
check('day 0 CTL = 100·(1-e^(-1/42)) ≈ 2.35 (±0.01)',
  Math.abs(d0.CTL - expCTL0) < 0.01, 'CTL=' + d0.CTL);
/* day 6 (7th day): ATL = day0 × e^(-6/7) (load = 0) */
var d6 = ftSingle.days[6];
var expATL6 = expATL0 * Math.pow(Math.exp(-1 / 7), 6);
console.log('      day 6: ATL=' + d6.ATL + ' (expected ' + expATL6.toFixed(2) + ')');
check('day 6 ATL = ATL_0 × e^(-6/7) (±0.05)',
  Math.abs(d6.ATL - expATL6) < 0.05, 'ATL=' + d6.ATL);

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
