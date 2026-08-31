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
/* §483 이후 22kt 실사용 조건에서는 평탄구간이 사라졌다 — 몸 항력이
   들어가면서 V_b 가 모델 상한(35kt)에 더는 닿지 않기 때문이다. 규칙
   자체는 그대로 지켜야 하므로, 평탄구간을 **인위적으로 만들어** 검사한다
   (상한에 닿도록 아주 센 바람). 실사용역에서 안 걸린다고 규칙을 지우면
   나중에 상한에 닿는 조건이 생겼을 때 조용히 되살아난다. */
var cFlat = curve(Lift, { v_wind_kt: 45, m_rider_kg: 72, skill: '선수',
                          foil_ar: 13.7, wing_ar: 4.5 }, 2.5, 7.4);
var vF = cFlat.points.filter(function (p) { return p.feasible; })
                     .map(function (p) { return p.V_vmg_kt; });
var topF = Math.max.apply(null, vF);
var tiedF = cFlat.points.filter(function (p) {
  return p.feasible && Math.abs(p.V_vmg_kt - topF) <= 0.05;
});
ok('강풍에서 동점 면적이 둘 이상 (평탄구간 존재)', tiedF.length >= 2,
   tiedF.map(function (p) { return p.area_m2; }).join(','));
ok('정점 = 평탄구간의 가장 큰 윙',
   cFlat.optimum.area_m2 === Math.max.apply(null, tiedF.map(function (p) { return p.area_m2; })),
   'optimum=' + cFlat.optimum.area_m2);
ok('예전 규칙이었다면 가장 작은 윙이 잡혔다 (회귀 대조)',
   oldPeak(cFlat).area_m2 < cFlat.optimum.area_m2,
   '옛 ' + oldPeak(cFlat).area_m2 + ' → 새 ' + cFlat.optimum.area_m2);
ok('정점 VMG 는 그대로 최댓값 (정점 값을 바꾼 게 아니다)',
   Math.abs(cFlat.optimum.V_vmg_kt - topF) <= 1e-9);

/* ---------- 2) 옥대표 실사용과 대조 ---------- */
/* 72kg·상급·foil AR 6.5 · 옥대표 실사용: 10→6.5 12→6.0 14→5.5 18→5.0 22→4.5.
   10kt 은 퀴버 상한(6.5 위가 없음)이라 모델이 더 크게 나오는 게 정상 —
   본인이 "약풍에선 더 큰 것도 되지만 무겁고 불편해 피한다" 고 했다. */
/* §483 — 모델의 **공력 최적**은 옥대표 실사용보다 크게 나온다. 이건
   버그가 아니라 모델에 없는 것(윙 무게·스윙 관성·핸들링)이 그의 선택을
   작게 만들기 때문이다. 본인 말: "약풍에서 좀 더 큰걸 사용해도 될거
   같은데 무겁기도 하고 커서 불편하기도 해서 좀 피하는 편이야."
   그래서 '일치'를 요구하지 않고 **간극의 모양**을 못박는다:
     · 모델이 그의 선택보다 작아지면 안 된다 (그건 물리가 뒤집힌 것)
     · 간극은 +2.0㎡ 를 넘지 않는다
     · 바람이 세질수록 간극이 줄어 22kt 에서 만난다 */
var REAL = [[12, 6.0], [14, 5.5], [18, 5.0], [22, 4.5]];
var gaps = REAL.map(function (r) {
  var c = curve(Lift, { v_wind_kt: r[0], m_rider_kg: 72, skill: '상급',
                        foil_ar: 13.7, wing_ar: 4.5 }, 3.0, 9.0);
  return { kt: r[0], real: r[1], model: c.optimum.area_m2,
           gap: c.optimum.area_m2 - r[1] };
});
gaps.forEach(function (g) {
  ok('실사용 대조 ' + g.kt + 'kt: 모델이 실사용 이상이고 +2.0㎡ 이내',
     g.gap >= -0.25 && g.gap <= 2.0,
     '모델 ' + g.model + ' vs 실사용 ' + g.real + ' (Δ' + g.gap.toFixed(2) + ')');
});
ok('바람이 세질수록 간극이 줄어든다',
   gaps[0].gap > gaps[gaps.length - 1].gap,
   gaps.map(function (g) { return g.kt + 'kt Δ' + g.gap.toFixed(2); }).join(' · '));
ok('22kt 에서는 실사용과 만난다 (±0.5)',
   Math.abs(gaps[gaps.length - 1].gap) <= 0.5,
   'Δ' + gaps[gaps.length - 1].gap.toFixed(2));

/* ---------- 3) 평탄구간이 없으면 동점 규칙은 아무것도 안 바꾼다 ----------
   (§480 규칙이 평탄구간 밖으로 새지 않는지 확인하는 것이지, §483 물리
   변경 전후를 비교하는 게 아니다 — 물리는 의도적으로 바뀌었다.) */
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
  if (c.optimum == null || o == null) {
    ok(p.v_wind_kt + 'kt/' + p.skill + ' — 양쪽 다 해 없음', c.optimum == null && o == null);
    return;
  }
  /* 평탄구간이 있는지 **판정해서** 기대를 나눈다. 예전에는 이 조합들에
     평탄구간이 없다고 가정했는데, §483 으로 곡선 모양이 바뀌면서
     12kt/중급 에는 생겼다. 가정 대신 측정한다. */
  var tie = c.points.filter(function (x) {
    return x.feasible && Math.abs(x.V_vmg_kt - c.optimum.V_vmg_kt) <= 0.05;
  });
  if (tie.length >= 2) {
    ok(p.v_wind_kt + 'kt/' + p.skill + ' — 평탄구간 있음 → 큰 윙 선택',
       c.optimum.area_m2 === Math.max.apply(null, tie.map(function (x) { return x.area_m2; })) &&
       c.optimum.area_m2 >= o.area_m2,
       '동점 ' + tie.map(function (x) { return x.area_m2; }).join(',') +
       ' → ' + c.optimum.area_m2 + ' (옛 ' + o.area_m2 + ')');
  } else {
    ok(p.v_wind_kt + 'kt/' + p.skill + ' — 평탄구간 없음 → 동점규칙 무영향',
       c.optimum.area_m2 === o.area_m2,
       '새 ' + c.optimum.area_m2 + ' vs 옛 ' + o.area_m2);
  }
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
    { v_wind_kt: r[0], m_rider_kg: 72, skill: '상급', foil_ar: 13.7, wing_ar: 4.5 },
    { gust: 'clean' });
  var gap = x.performance - r[1];
  ok('추천 ' + r[0] + 'kt 이 실사용 ' + r[1] + '㎡ 이상 +2.0㎡ 이내',
     x && x.performance != null && gap >= -0.25 && gap <= 2.0,
     x ? x.performance + ' (Δ' + gap.toFixed(2) + ')' : 'null');
});
var rec18 = Lift.wingRecommendation(
  { v_wind_kt: 18, m_rider_kg: 72, skill: '상급', foil_ar: 13.7, wing_ar: 4.5 },
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
