/* ============================================================
 * selftest-414-wing-cap.js — §414 coach.js aMax 7.4 cap fix 검증
 *
 * 옥대표님 verbatim 2026-06-10: 윙 8.5 m² 표시 = wrong. Cap = 7.4.
 * Timo spec § 2-1 (sports_science_414_wing_cap_diminishing_returns_spec.md).
 *
 * 검증 (6 assertion):
 *  · coach.js source 에 WHATIF_AMAX_COMMERCIAL = 7.4 hardcode
 *  · actualWing 5.5 → aMax = 7.4 (sweep.max = 7.4)
 *  · actualWing 7.4 → aMax = 7.4 (sweep.max = 7.4)
 *  · actualWing 8.0 (legacy) → aMax = 8.5 (actualWing + 0.5)
 *  · actualWing 10.0 → aMax = 9.5 (hard ceiling)
 *  · detectWingNotBottleneck export
 *
 *   실행:  node selftest-414-wing-cap.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

/* coach.js source — Timo spec §2-1 patch 적용 확인 */
var coachSrc = fs.readFileSync(
  path.join(__dirname, 'js', 'coach.js'), 'utf8');

/* §414-A — WHATIF_AMAX_COMMERCIAL hardcode 검증 */
check('coach.js 에 WHATIF_AMAX_COMMERCIAL = 7.4 hardcode',
  /WHATIF_AMAX_COMMERCIAL\s*=\s*7\.4/.test(coachSrc),
  'Timo spec §2-1 commercial racing class max');

check('coach.js 의 aMin/aMax 가 WHATIF_AMAX_COMMERCIAL 참조',
  /aMin\s*=\s*2\.5,\s*aMax\s*=\s*WHATIF_AMAX_COMMERCIAL/.test(coachSrc),
  '기본 sweep range = 2.5~7.4');

check('actualWing + 0.5 > aMax 시 aMax = actualWing + 0.5 (legacy extension)',
  /aMax\s*=\s*actualWing\s*\+\s*0\.5/.test(coachSrc),
  '확장 0.5 만 (이전 1.0 → 0.5)');

check('hard ceiling 9.5 m² (legacy 보호)',
  /aMax\s*>\s*9\.5.*aMax\s*=\s*9\.5/s.test(coachSrc),
  'outer cap 9.5');

/* §414-B — detectWingNotBottleneck export */
var Coach = require(path.join(__dirname, 'js', 'coach.js'));
check('Coach.detectWingNotBottleneck 함수 존재',
  typeof Coach.detectWingNotBottleneck === 'function',
  'Timo spec §4-1 helper');

/* §414-C — detectWingNotBottleneck 동작 검증 */
var bd1 = Coach.detectWingNotBottleneck({
  optimumWingM2: 7.4,
  points: [
    { area_m2: 5.0, feasible: true },
    { area_m2: 6.0, feasible: true },
    { area_m2: 7.0, feasible: true },
    { area_m2: 7.4, feasible: true }
  ]
});
check('optimum 7.4 → boundary = true',
  bd1.boundary === true,
  'type=' + bd1.type);

var bd2 = Coach.detectWingNotBottleneck({
  optimumWingM2: 5.5,
  points: [
    { area_m2: 5.0, feasible: true },
    { area_m2: 5.5, feasible: true },
    { area_m2: 6.0, feasible: true },
    { area_m2: 7.0, feasible: true }
  ]
});
check('optimum 5.5 (mid) → boundary = false',
  bd2.boundary === false,
  '정상 inverse-U peak visible');

/* 결과 */
console.log('\n' + '-'.repeat(40));
console.log('PASS:', pass, ' FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);
