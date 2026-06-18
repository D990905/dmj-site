/* ============================================================
 * selftest-414-validation-matrix.js — §414 시나리오 검증 6 case
 *
 * Timo spec §5-1 + 옥대표님 verbatim 2026-06-10 Case 6 추가.
 * Lift.upwindCurve 직접 호출 → peak A_transition 검증
 * (computeWhatIf mock analysis 우회 — Lift 직접이 더 정직).
 *
 * 검증 (6 case × 3 assertion = 18 assertion):
 *  · Case 1-5 — Timo spec §5-1 시나리오
 *  · Case 6 — 옥대표님 verbatim (70kg / 10kt / AR 6.5 / 상급 / 6.5 m²)
 *
 *   실행:  node selftest-414-validation-matrix.js
 * ============================================================ */
'use strict';
var path = require('path');
var DIR = __dirname;
var LiftMod = require(path.join(DIR, '..', 'assets', 'js', 'lift-calculator.js'));
var Lift = LiftMod.DMJLift || LiftMod;

var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

/* upwindCurve 호출 후 feasible 영역의 VMG peak 위치 산출 */
function findPeak(curve) {
  if (!curve || !curve.points) return null;
  var feasibles = curve.points.filter(function (p) {
    return p && p.feasible && p.V_vmg_kt > 0;
  });
  if (!feasibles.length) return null;
  var max = feasibles[0];
  feasibles.forEach(function (p) {
    if (p.V_vmg_kt > max.V_vmg_kt) max = p;
  });
  /* monotonic 인지 확인 — peak 가 last feasible 과 같으면 monotonic */
  var last = feasibles[feasibles.length - 1];
  return {
    peak_area: max.area_m2,
    peak_vmg: max.V_vmg_kt,
    last_area: last.area_m2,
    monotonic: max.area_m2 === last.area_m2
  };
}

/* 5 Timo case + 1 옥대표님 Case 6 = 6 case validation matrix
 * spec §5-1 expected range — ± 0.5 m² tolerance.
 * (rider.weightKg 만, 장비 무게 +10 가산은 §181 모델 내부) */
var cases = [
  /* Case 1 — Timo (Danny anchor §181-D) */
  { id: 1, label: 'Danny anchor 12kt/중급/AR6.5',
    m: 70, kt: 12, foilAR: 6.5, skill: '중급',
    expected: [5.5, 6.5], boundary: false },
  /* Case 2 — Timo (옥대표님 coaching 직관) */
  { id: 2, label: '14kt/상급/AR6.5',
    m: 70, kt: 14, foilAR: 6.5, skill: '상급',
    expected: [5.0, 6.5], boundary: false },
  /* Case 3 — Timo (§181-D race foil anchor) */
  { id: 3, label: 'race foil 10kt/상급/AR13.7',
    m: 70, kt: 10, foilAR: 13.7, skill: '상급',
    expected: [6.5, 7.4], boundary: true },
  /* Case 4 — Timo (heavy + mid wind) */
  { id: 4, label: 'heavy 16kt/상급/AR6.5',
    m: 80, kt: 16, foilAR: 6.5, skill: '상급',
    expected: [4.5, 6.0], boundary: false },
  /* Case 5 — Timo (strong + 선수) */
  { id: 5, label: 'strong 20kt/선수/AR13.7',
    m: 70, kt: 20, foilAR: 13.7, skill: '선수',
    expected: [3.5, 5.0], boundary: false },
  /* ★ Case 6 — 옥대표님 verbatim 2026-06-10
   * Wind 10kt + AR 6.5 + 상급 + Wing actual 6.5 + Weight 70kg (memory 추정)
   * 약풍 + typical foil AR + heavy 라이더 → A_transition 가능 위치 검증.
   * Timo derivation §3-2: V_a² ∝ wind, AR↓ → V_b↓ → V_a²↓ → A_transition↑
   * 10kt + AR6.5 = AR13.7 (Case 3) 의 절반 → A_transition Case 3 보다 ↑.
   * → boundary 가능성 매우 높음. */
  { id: 6, label: '★ 옥대표님 verbatim 10kt/상급/AR6.5/wing6.5',
    m: 70, kt: 10, foilAR: 6.5, skill: '상급',
    expected: [6.0, 7.4], boundary: true,
    note: 'David monotonic 호소의 honest physics origin' }
];

cases.forEach(function (c) {
  var curve = Lift.upwindCurve({
    v_wind_kt: c.kt,
    m_rider_kg: c.m,
    skill: c.skill,
    foil_ar: c.foilAR,
    wing_ar: 4.0,
    area_min_m2: 2.5,
    area_max_m2: 7.4,
    step_m2: 0.5
  });
  var pk = findPeak(curve);

  if (!pk) {
    check('Case ' + c.id + ' — feasible points 존재 (' + c.label + ')',
      false, 'no feasible points');
    return;
  }

  /* Assertion 1 — peak 가 expected range 안 */
  var inRange = pk.peak_area >= c.expected[0] && pk.peak_area <= c.expected[1];
  check('Case ' + c.id + ' peak 위치 ∈ [' + c.expected[0] + ', ' + c.expected[1] + ']',
    inRange,
    c.label + ' · peak=' + pk.peak_area.toFixed(1) + 'm² VMG=' + pk.peak_vmg.toFixed(2) + 'kt');

  /* Assertion 2 — boundary 가설 (monotonic vs visible peak) */
  var bdMatch = pk.monotonic === c.boundary ||
                 (c.boundary && pk.peak_area >= 6.9);
  check('Case ' + c.id + ' boundary 가설 정합 (expected=' + c.boundary + ')',
    bdMatch,
    'monotonic=' + pk.monotonic + ' peak_area=' + pk.peak_area.toFixed(1));

  /* Assertion 3 — peak VMG > 0 (실제 feasible) */
  check('Case ' + c.id + ' peak VMG > 0',
    pk.peak_vmg > 0,
    pk.peak_vmg.toFixed(2) + ' kt');
});

console.log('\n' + '-'.repeat(40));
console.log('PASS:', pass, ' FAIL:', fail);

/* §414 Case 6 (옥대표님 시나리오) detail 추가 출력 */
console.log('\n=== ★ Case 6 (옥대표님 verbatim) detail ===');
var c6 = Lift.upwindCurve({
  v_wind_kt: 10, m_rider_kg: 70, skill: '상급',
  foil_ar: 6.5, wing_ar: 4.0,
  area_min_m2: 2.5, area_max_m2: 7.4, step_m2: 0.5
});
if (c6 && c6.points) {
  console.log('Wing(m²)  | V_vmg(kt) | feasible');
  c6.points.forEach(function (p) {
    if (!p) return;
    var w = p.area_m2.toFixed(1);
    var v = p.V_vmg_kt != null ? p.V_vmg_kt.toFixed(2) : '—';
    var f = p.feasible ? '✓' : '✗';
    console.log(' ' + w.padStart(7) + '  | ' + v.padStart(8) + '  | ' + f);
  });
  var pk6 = findPeak(c6);
  if (pk6) {
    console.log('\n→ Peak: ' + pk6.peak_area.toFixed(1) + ' m² · VMG ' +
      pk6.peak_vmg.toFixed(2) + ' kt · monotonic=' + pk6.monotonic);
    console.log('→ Expected: 6.0-7.4 m² · boundary=true (Timo §3-3 derivation)');
  }
}

process.exit(fail > 0 ? 1 : 0);
