/* ============================================================
 * selftest-480-plateau-tie.js — 강풍 평탄구간에서 정점 고르기
 *
 * upwindCurve 는 강풍에서 V_b 가 모델 상한(UPWIND_VB_CAP_KT=35kt)에
 * 걸려 여러 면적이 **완전히 같은** VMG 를 낸다. 예전 코드는 엄격한 >
 * 로 첫 점만 남겨, 그 평탄구간의 가장 작은 윙을 정점으로 보고했다 —
 * 22kt 에서 2.5㎡ 를 추천하는 셈이었다.
 *
 * §480: 동점이면 큰 윙. 평탄구간은 "모델이 그 위를 분해하지 못한다" 는
 * 뜻이지 작은 윙이 낫다는 뜻이 아니고, 같은 VMG 라면 큰 윙이 저속
 * 여유·펌핑 부담·돌풍 대응에서 낫다.
 *
 * 이 검증이 지키는 것:
 *   · 평탄구간에서는 상단(큰 윙)이 잡힌다
 *   · 평탄하지 않은 구간(약·중풍)은 예전과 완전히 동일하다  ← 중요
 *   · 옥대표 실사용 22kt 4.5㎡ 와 일치한다
 *   · assets/ 와 calculator-pwa/ 두 사본이 같은 답을 낸다
 *
 *   실행:  node selftest-480-plateau-tie.js
 * ============================================================ */
'use strict';
var path = require('path');
var DIR = __dirname;
var SITE = path.join(DIR, '..');
var A = require(path.join(SITE, 'assets', 'js', 'lift-calculator.js'));
var P = require(path.join(SITE, 'calculator-pwa', 'js', 'lift-calculator.js'));
var Lift = A.DMJLift || A;
var LiftPwa = P.DMJLift || P;

var pass = 0, fail = 0;
function ok(n, c, e) {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); }
}

function curve(L, p, lo, hi, step) {
  return L.upwindCurve(p, { area_min_m2: lo, area_max_m2: hi, step_m2: step || 0.5 });
}
/* 예전 규칙(엄격한 >) 을 그대로 재현 — 무엇이 달라졌는지 대조용 */
function oldPeak(c) {
  var f = c.points.filter(function (x) { return x.feasible && x.V_vmg_kt > 0; });
  if (!f.length) return null;
  var mx = f[0];
  f.forEach(function (x) { if (x.V_vmg_kt > mx.V_vmg_kt) mx = x; });
  return mx;
}

console.log('§480 plateau tie-break');

/* ---------- 1) 강풍 — 평탄구간이 실제로 생긴다 ---------- */
var strong = { v_wind_kt: 22, m_rider_kg: 72, skill: '상급', foil_ar: 6.5, wing_ar: 4.5 };
var cS = curve(Lift, strong, 2.5, 7.4);
var vmgs = cS.points.filter(function (p) { return p.feasible; })
                    .map(function (p) { return p.V_vmg_kt; });
var top = Math.max.apply(null, vmgs);
var tied = cS.points.filter(function (p) {
  return p.feasible && Math.abs(p.V_vmg_kt - top) <= 0.05;
});
ok('22kt 에서 동점 면적이 둘 이상 (평탄구간 존재)', tied.length >= 2,
   tied.map(function (p) { return p.area_m2; }).join(','));
ok('정점 = 평탄구간의 가장 큰 윙',
   cS.optimum.area_m2 === Math.max.apply(null, tied.map(function (p) { return p.area_m2; })),
   'optimum=' + cS.optimum.area_m2);
ok('예전 규칙이었다면 가장 작은 윙이 잡혔다 (회귀 대조)',
   oldPeak(cS).area_m2 < cS.optimum.area_m2,
   '옛 ' + oldPeak(cS).area_m2 + ' → 새 ' + cS.optimum.area_m2);
ok('정점 VMG 는 그대로 최댓값 (정점 값을 바꾼 게 아니다)',
   Math.abs(cS.optimum.V_vmg_kt - top) <= 1e-9);

/* ---------- 2) 옥대표 실사용과 대조 ---------- */
/* 72kg·상급·foil AR 6.5 · 옥대표 실사용: 10→6.5 12→6.0 14→5.5 18→5.0 22→4.5.
   10kt 은 퀴버 상한(6.5 위가 없음)이라 모델이 더 크게 나오는 게 정상 —
   본인이 "약풍에선 더 큰 것도 되지만 무겁고 불편해 피한다" 고 했다. */
var REAL = [[12, 6.0], [14, 5.5], [22, 4.5]];
REAL.forEach(function (r) {
  var c = curve(Lift, { v_wind_kt: r[0], m_rider_kg: 72, skill: '상급',
                        foil_ar: 6.5, wing_ar: 4.5 }, 3.0, 8.0);
  ok('실사용 대조 ' + r[0] + 'kt → ' + r[1] + '㎡ (±0.5)',
     Math.abs(c.optimum.area_m2 - r[1]) <= 0.5,
     '모델 ' + c.optimum.area_m2);
});

/* ---------- 3) 약·중풍은 하나도 안 바뀐다 ---------- */
/* 평탄구간이 없으면 새 규칙은 예전 규칙과 완전히 같은 답을 내야 한다. */
var UNCHANGED = [
  { v_wind_kt: 8,  m_rider_kg: 70, skill: '중급', foil_ar: 6.5, wing_ar: 4.5 },
  { v_wind_kt: 10, m_rider_kg: 70, skill: '상급', foil_ar: 6.5, wing_ar: 4.5 },
  { v_wind_kt: 12, m_rider_kg: 70, skill: '중급', foil_ar: 6.5, wing_ar: 4.5 },
  { v_wind_kt: 14, m_rider_kg: 70, skill: '상급', foil_ar: 6.5, wing_ar: 4.5 },
  { v_wind_kt: 16, m_rider_kg: 80, skill: '상급', foil_ar: 6.5, wing_ar: 4.5 }
];
UNCHANGED.forEach(function (p) {
  /* 약풍은 2.5~7.4 안에 feasible 이 없을 수 있어 범위를 넓게 잡는다 —
     범위 밖이라 비는 것과 규칙이 바뀐 것은 다른 문제다. */
  var c = curve(Lift, p, 2.5, 9.5);
  var o = oldPeak(c);
  ok('평탄구간 없는 ' + p.v_wind_kt + 'kt/' + p.skill + ' 는 예전과 동일',
     (c.optimum == null && o == null) ||
     (c.optimum && o && c.optimum.area_m2 === o.area_m2),
     '새 ' + (c.optimum ? c.optimum.area_m2 : 'none') +
     ' vs 옛 ' + (o ? o.area_m2 : 'none'));
});

/* ---------- 4) 모델 자체 회귀 ---------- */
var rt = Lift.runSelfTest();
ok('lift-calculator runSelfTest 62/62', rt.passed === rt.tests && rt.tests >= 62,
   rt.passed + '/' + rt.tests + ' failed=' + JSON.stringify(rt.failed));

/* ---------- 5) 두 사본이 같은 답 ---------- */
var PROBES = [[22, 72, '상급', 6.5], [20, 70, '선수', 13.7], [12, 70, '중급', 6.5]];
PROBES.forEach(function (q) {
  var p = { v_wind_kt: q[0], m_rider_kg: q[1], skill: q[2], foil_ar: q[3], wing_ar: 4.5 };
  var a = curve(Lift, p, 2.5, 7.4).optimum.area_m2;
  var b = curve(LiftPwa, p, 2.5, 7.4).optimum.area_m2;
  ok('assets vs calculator-pwa 일치 (' + q[0] + 'kt/' + q[2] + ')', a === b,
     a + ' vs ' + b);
});
var rtp = LiftPwa.runSelfTest();
ok('pwa runSelfTest 62/62', rtp.passed === rtp.tests && rtp.tests >= 62,
   rtp.passed + '/' + rtp.tests);

/* ---------- 6) wingRecommendation 도 같은 정점을 쓴다 ---------- */
if (Lift.wingRecommendation) {
  var rec = Lift.wingRecommendation(strong, { gust: 'clean' });
  ok('wingRecommendation 이 새 정점을 물려받는다',
     rec && rec.performance != null &&
     Math.abs(rec.performance - cS.optimum.area_m2) <= 0.5,
     JSON.stringify({ perf: rec && rec.performance, peak: cS.optimum.area_m2 }));
}

/* ---------- 7) §481 — 밖에서 씌우던 옆힘 필터가 사라졌다 ---------- */
/* §464 는 '체중 × 0.60' 으로 한 번 더 잘라 72kg 상급 기준 18kt 에 2.0㎡ 를
   추천했다. 옥대표 실사용은 5.0㎡ 다. 옆힘 한계는 upwindSpeed 안의
   H_max = mTotal·g·tanθ 가 이미 담당하므로 밖에서 자르면 이중 계산이다. */
var REC = [[12, 6.0], [14, 5.5], [18, 5.0], [22, 4.5]];
REC.forEach(function (r) {
  var x = Lift.wingRecommendation(
    { v_wind_kt: r[0], m_rider_kg: 72, skill: '상급', foil_ar: 6.5, wing_ar: 4.5 },
    { gust: 'clean' });
  ok('추천 ' + r[0] + 'kt 이 실사용 ' + r[1] + '㎡ 의 ±1.0 안',
     x && x.performance != null && Math.abs(x.performance - r[1]) <= 1.0,
     x ? String(x.performance) : 'null');
});
var rec18 = Lift.wingRecommendation(
  { v_wind_kt: 18, m_rider_kg: 72, skill: '상급', foil_ar: 6.5, wing_ar: 4.5 },
  { gust: 'clean' });
ok('18kt 추천이 3.0㎡ 보다 크다 (§464 회귀 감시 — 예전엔 2.0)',
   rec18.performance > 3.0, String(rec18.performance));
ok('force_limited 는 더 이상 켜지지 않는다', rec18.force_limited === false);
ok('보고된 옆힘 ≤ 모델 내부 한계 (이중 계산 없음)',
   rec18.side_force_N != null && rec18.side_force_cap_N != null &&
   rec18.side_force_N <= rec18.side_force_cap_N + 1,
   rec18.side_force_N + '/' + rec18.side_force_cap_N);

/* 곡선 위 모든 점에서 옆힘이 내부 한계 안에 있다 — 밖에서 자를 필요가
   없다는 근거 자체를 검증한다. */
var allWithin = true;
[10, 14, 18, 22].forEach(function (kt) {
  [3, 4, 5, 6, 7].forEach(function (a) {
    var d = Lift.upwindSpeed({ v_wind_kt: kt, m_rider_kg: 72, skill: '상급',
                               foil_ar: 6.5, wing_ar: 4.5, wing_area_m2: a });
    if (d && d.feasible && d.side_force_N > d.side_force_max_N + 1e-6) allWithin = false;
  });
});
ok('upwindSpeed 가 이미 옆힘을 한계 안으로 자른다', allWithin);

console.log('');
console.log('§480  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
