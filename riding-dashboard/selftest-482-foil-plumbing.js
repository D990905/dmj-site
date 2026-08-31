/* ============================================================
 * selftest-482-foil-plumbing.js — 고른 포일이 실제로 계산에 들어가는가
 *
 * 옥대표: "바람이랑 윙사이즈만 보면 안되고 포일의 면적이나 종횡비를
 * 같이 봐야해."
 *
 * 장비 선택기는 R6 V1/V2/V3 의 종횡비(13.7·12.9·14.3)와 면적(479·430·
 * 530cm²)을 처음부터 알고 있었는데, 성능 모델은 프로필 기본값 6.5 로
 * 계산하고 있었다 — **포일을 바꿔도 예측이 한 톨도 안 변했다.**
 *
 * 여기서 지키는 것:
 *   · 포일 데이터가 온전한가 (면적·스팬·AR·무게)
 *   · 종횡비가 예측 풍상 VMG 를 실제로 바꾸는가
 *   · 면적이 이륙 속도를 바꾸는가 (큰 포일 = 낮은 이륙)
 *   · 수면 상태가 가능 힐을 바꾸는가 (플랫 > 초피 > 웨이비)
 *   · rig-limits 안에서 무게 기준이 하나로 통일됐는가 (§471/§482)
 *
 *   실행:  node selftest-482-foil-plumbing.js
 * ============================================================ */
'use strict';
var path = require('path');
var DIR = __dirname;
var SITE = path.join(DIR, '..');
global.window = global;
var Gear = require(path.join(DIR, 'js', 'gear-levitaz.js'));
var RL = require(path.join(DIR, 'js', 'rig-limits.js'));
require(path.join(SITE, 'assets', 'js', 'lift-calculator.js'));
var Lift = global.DMJLift;

var pass = 0, fail = 0;
function ok(n, c, e) {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); }
}

console.log('§482 foil plumbing');

/* ---------- 1) 장비 데이터가 온전한가 ---------- */
ok('앞 포일 3종', Gear.FRONT_WINGS.length === 3);
Gear.FRONT_WINGS.forEach(function (f) {
  ok(f.label + ' 필드 완비',
     f.areaCm2 > 0 && f.spanCm > 0 && f.ar > 0 && f.weightG > 0,
     JSON.stringify({ a: f.areaCm2, s: f.spanCm, ar: f.ar }));
});
/* 종횡비는 스팬²/면적 과 대략 맞아야 한다 — 오타를 잡는 검산 */
Gear.FRONT_WINGS.forEach(function (f) {
  var derived = (f.spanCm * f.spanCm) / f.areaCm2;
  ok(f.label + ' AR 이 스팬²/면적 과 일치 (±0.6)',
     Math.abs(derived - f.ar) < 0.6,
     '표기 ' + f.ar + ' vs 계산 ' + derived.toFixed(2));
});
/* 쿼버가 면적 순이 아니다 — V2(430) < V1(479) < V3(530) */
ok('V2 < V1 < V3 면적 순서 (쿼버가 이름 순이 아님)',
   Gear.byId(Gear.FRONT_WINGS, 'r6v2').areaCm2 <
   Gear.byId(Gear.FRONT_WINGS, 'r6v1').areaCm2 &&
   Gear.byId(Gear.FRONT_WINGS, 'r6v1').areaCm2 <
   Gear.byId(Gear.FRONT_WINGS, 'r6v3').areaCm2);

/* ---------- 2) 종횡비가 예측을 바꾼다 ---------- */
function vmgAt(kt, ar) {
  var d = Lift.upwindSpeed({ v_wind_kt: kt, m_rider_kg: 72, skill: '상급',
                             foil_ar: ar, wing_ar: 4.5, wing_area_m2: 5.5 });
  return (d && d.feasible) ? d.V_vmg_kt : null;
}
var base = vmgAt(12, 6.5), real = vmgAt(12, 13.7);
ok('AR 6.5 와 13.7 의 예측이 다르다 (예전엔 늘 6.5 로 계산)',
   base != null && real != null && Math.abs(real - base) > 0.5,
   base + ' → ' + real);
ok('높은 종횡비가 더 빠른 풍상 VMG 를 낸다', real > base,
   base + ' vs ' + real);
/* 약풍에서 차이가 가장 크다 — 유도항력이 지배하는 구간 */
var gapLight = vmgAt(10, 13.7) - vmgAt(10, 6.5);
var gapStrong = vmgAt(22, 13.7) - vmgAt(22, 6.5);
ok('약풍에서 종횡비 효과가 더 크다 (유도항력 지배)',
   gapLight > gapStrong,
   '10kt +' + gapLight.toFixed(1) + ' vs 22kt +' + gapStrong.toFixed(1));
/* 세 포일이 서로 다른 값을 낸다 */
var three = Gear.FRONT_WINGS.map(function (f) { return vmgAt(12, f.ar); });
ok('세 포일이 서로 다른 예측', new Set(three.map(function (v) {
  return v.toFixed(2); })).size >= 2, three.join(' / '));

/* ---------- 3) 면적이 이륙 속도를 바꾼다 ---------- */
var TOTAL = 72 + Gear.rigMassKg(Gear.DEFAULT);
var tos = Gear.FRONT_WINGS.map(function (f) {
  return { label: f.label, area: f.areaCm2, kt: RL.minFlyingSpeedKt(TOTAL, f.areaCm2) };
});
tos.forEach(function (t) {
  ok(t.label + ' 이륙 속도 산출 (' + t.kt.toFixed(1) + 'kt)',
     t.kt > 5 && t.kt < 25);
});
var big = tos.filter(function (t) { return t.area === 530; })[0];
var small = tos.filter(function (t) { return t.area === 430; })[0];
ok('큰 포일이 더 낮은 속도에서 뜬다', big.kt < small.kt,
   big.kt.toFixed(1) + ' vs ' + small.kt.toFixed(1));
/* V = sqrt(2mg/(ρ·A·CL)) → 면적 비의 제곱근에 반비례 */
ok('이륙 속도가 면적 제곱근에 반비례',
   Math.abs(small.kt / big.kt - Math.sqrt(530 / 430)) < 0.02,
   (small.kt / big.kt).toFixed(3) + ' vs ' + Math.sqrt(530 / 430).toFixed(3));

/* ---------- 4) 수면 상태가 가능 힐을 바꾼다 ---------- */
var mast = Gear.byId(Gear.MASTS, 'mast_v1');
var front = Gear.byId(Gear.FRONT_WINGS, 'r6v1');
var heels = {};
['flat', 'chop', 'wavy'].forEach(function (id) {
  var s = Gear.byId(Gear.SURFACE, id);
  heels[id] = RL.maxHeelFoil(mast.lengthCm, front.spanCm, 50, s.foilMarginCm);
});
ok('플랫 > 초피 > 웨이비 순으로 힐 여유가 준다',
   heels.flat > heels.chop && heels.chop > heels.wavy,
   ['flat', 'chop', 'wavy'].map(function (k) {
     return k + ' ' + heels[k].toFixed(0) + '°'; }).join(' · '));
ok('웨이비에서도 힐이 남는다 (음수/NaN 아님)',
   heels.wavy > 0 && isFinite(heels.wavy), String(heels.wavy));

/* 스팬이 길수록 먼저 물 밖으로 나온다 */
var narrow = RL.maxHeelFoil(mast.lengthCm, 74, 50, 25);
var wide = RL.maxHeelFoil(mast.lengthCm, 87, 50, 25);
ok('스팬이 길수록 힐 한계가 낮다 (팁이 먼저 수면으로)', wide < narrow,
   '74cm ' + narrow.toFixed(0) + '° vs 87cm ' + wide.toFixed(0) + '°');
/* 높이 탈수록 마스트가 덜 잠겨 팁이 먼저 나온다 — 강풍에 낮게 타는 이유가
   여기 있다. 여유 = (마스트 − 라이드높이)·cosθ − (스팬/2)·sinθ ≥ 여유값. */
ok('낮게 탈수록 힐 여유가 는다 (마스트가 더 잠긴다)',
   RL.maxHeelFoil(mast.lengthCm, front.spanCm, 30, 25) >
   RL.maxHeelFoil(mast.lengthCm, front.spanCm, 50, 25) &&
   RL.maxHeelFoil(mast.lengthCm, front.spanCm, 50, 25) >
   RL.maxHeelFoil(mast.lengthCm, front.spanCm, 60, 25),
   [30, 50, 60].map(function (h) {
     return h + 'cm ' + RL.maxHeelFoil(mast.lengthCm, front.spanCm, h, 25).toFixed(0) + '°';
   }).join(' · '));

/* ---------- 5) 무게 기준 통일 (§471/§482) ---------- */
var cap = RL.sideForceCapacityN(TOTAL, 40);
ok('옆힘 용량 = 전체무게·g·tanθ',
   Math.abs(cap - TOTAL * 9.81 * Math.tan(40 * Math.PI / 180)) < 1e-6);
ok('필요 힐은 용량의 역함수 (왕복 일치)',
   Math.abs(RL.requiredLeanDeg(cap, TOTAL) - 40) < 1e-9);
/* recommendWing 도 전체무게를 받으면 그걸 쓴다 */
function recWith(massOpts) {
  return RL.recommendWing(Object.assign({
    wings: Gear.HAND_WINGS,
    sideForceAt: function () { return 600; },
    rideHeightCm: 50, boardThicknessCm: 12, handHeightCm: 112,
    wingMarginCm: 30, mastCm: 113, foilSpanCm: 80, foilMarginCm: 25
  }, massOpts));
}
var byRider = recWith({ riderMassKg: 72 });
var byTotal = recWith({ riderMassKg: 72, totalMassKg: TOTAL });
ok('전체무게를 주면 필요 힐이 더 작다 (더 잘 버틴다)',
   byTotal.rows[0].requiredHeelDeg < byRider.rows[0].requiredHeelDeg,
   byRider.rows[0].requiredHeelDeg.toFixed(1) + '° → ' +
   byTotal.rows[0].requiredHeelDeg.toFixed(1) + '°');
ok('totalMassKg 없으면 예전처럼 riderMassKg (호출부 호환)',
   Math.abs(byRider.rows[0].requiredHeelDeg -
            Math.atan(600 / (72 * 9.81)) * 180 / Math.PI) < 1e-9);

console.log('');
console.log('§482  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
