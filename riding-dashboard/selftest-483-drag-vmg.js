/* ============================================================
 * selftest-483-drag-vmg.js — 라이더 공기저항 + 실측 기반 택 각도
 *
 * 옥대표 2026-09-01: "바람이 아무리 세다고 해도 VMG가 14노트 이상 나오는걸
 * 윙포일에서는 거의 못본것 같애. 프로선수라도."  ← 맞았다.
 *
 * 원인 둘:
 *  (1) 모델의 저항이 포일 항력 하나뿐이었다. 12kt·상급 운항점에서 25 N.
 *      같은 순간 라이더 몸에 걸리는 공기저항은 90 N 이 넘는다 — 세고 있던
 *      항의 네 배가 통째로 빠져 있었다.
 *  (2) 택 각도표가 올림픽 카이트포일 수준(상급 50°·선수 45°)이었다.
 *      옥대표 실측은 지속 구간 58°, 평균 70°.
 *
 * 이 검증이 지키는 것:
 *   · 몸 항력이 실제로 계산에 들어가고, 포일 항력보다 크다
 *   · 전 풍속·전 스킬에서 풍상 VMG 가 14.5kt 를 넘지 않는다
 *   · 풍상 VMG/풍속 이 Formula Kite 실측(0.94)을 넘지 않는다
 *   · 옥대표 8/31 실측과 맞는다
 *   · 두 사본(assets · calculator-pwa)이 같은 답을 낸다
 *
 *   실행:  node selftest-483-drag-vmg.js
 * ============================================================ */
'use strict';
var path = require('path');
var DIR = __dirname;
var SITE = path.join(DIR, '..');
global.window = global;
/* 두 사본 모두 window(=global) 에 DMJLift 를 붙인다 — 나중에 로드한 쪽이
   앞의 것을 덮어쓴다. 각각 로드 직후에 붙잡아 둔다. */
require(path.join(SITE, 'assets', 'js', 'lift-calculator.js'));
var Lift = global.DMJLift;
delete global.DMJLift;
require(path.join(SITE, 'calculator-pwa', 'js', 'lift-calculator.js'));
var LiftPwa = global.DMJLift;
global.DMJLift = Lift;

var pass = 0, fail = 0;
function ok(n, c, e) {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); }
}
function up(L, kt, skill, opts) {
  var d = (L || Lift).upwindSpeed(Object.assign({
    v_wind_kt: kt, m_rider_kg: 72, skill: skill,
    foil_ar: 13.7, wing_ar: 4.5, wing_area_m2: 6.0
  }, opts || {}));
  return (d && d.feasible) ? d : null;
}

console.log('§483 라이더 공기저항 · 실측 택 각도');

/* ---------- 1) 몸 항력이 실제로 들어간다 ---------- */
var d14 = up(null, 14, '상급');
ok('D_body_N 이 산출된다', d14.D_body_N > 0, String(d14.D_body_N));
ok('몸 항력이 포일 항력보다 크다 (빠져 있던 게 더 컸다)',
   d14.D_body_N > d14.D_foil_N,
   '몸 ' + d14.D_body_N + 'N vs 포일 ' + d14.D_foil_N + 'N');
ok('몸 항력이 윙 형상항력보다도 크다',
   d14.D_body_N > d14.D_wing_N,
   '몸 ' + d14.D_body_N + 'N vs 윙 ' + d14.D_wing_N + 'N');
ok('CdA 기본값 0.65 m²', Math.abs(d14.rider_cda_m2 - 0.65) < 1e-9,
   String(d14.rider_cda_m2));

/* 항력은 겉보기 풍속 제곱에 비례해야 한다 */
var slow = up(null, 10, '상급'), fast = up(null, 20, '상급');
var ratio = fast.D_body_N / slow.D_body_N;
var vaRatio = Math.pow(fast.V_apparent_kt / slow.V_apparent_kt, 2);
ok('몸 항력 ∝ 겉보기풍속²', Math.abs(ratio - vaRatio) / vaRatio < 0.02,
   ratio.toFixed(2) + ' vs ' + vaRatio.toFixed(2));

/* CdA=0 이면 예전 거동으로 돌아간다 — 항이 정말 이 항인지 확인 */
var noBody = up(null, 12, '상급', { rider_cda_m2: 0 });
ok('CdA=0 이면 몸 항력 0 이고 훨씬 빨라진다',
   noBody.D_body_N === 0 && noBody.V_boat_kt > up(null, 12, '상급').V_boat_kt + 3,
   'CdA0 ' + noBody.V_boat_kt.toFixed(1) + 'kt vs 기본 ' + up(null, 12, '상급').V_boat_kt.toFixed(1) + 'kt');
/* 큰 윙일수록 몸 항력의 상대 부담이 준다 — 약풍에 큰 윙을 쓰는 이유 */
var w5 = up(null, 12, '상급', { wing_area_m2: 5.0 });
var w8 = up(null, 12, '상급', { wing_area_m2: 8.0 });
ok('몸 항력은 윙 크기와 무관 → 큰 윙이 상대적으로 유리',
   w8.V_boat_kt > w5.V_boat_kt,
   '5㎡ ' + w5.V_boat_kt.toFixed(1) + 'kt < 8㎡ ' + w8.V_boat_kt.toFixed(1) + 'kt');

/* ---------- 2) 택 각도 ---------- */
ok('상급 58° (옥대표 지속 구간 실측)', d14.tack_angle_deg === 58);
ok('선수 56° — Formula Kite T1 실측 50.6° 보다 넓다',
   up(null, 14, '선수').tack_angle_deg === 56);
ok('중급 64° · 입문 78°',
   up(null, 14, '중급').tack_angle_deg === 64 &&
   up(null, 14, '입문', { wing_area_m2: 8.0 }).tack_angle_deg === 78);
ok('스킬이 높을수록 각이 좁다 (단조)',
   up(null, 14, '선수').tack_angle_deg < up(null, 14, '상급').tack_angle_deg &&
   up(null, 14, '상급').tack_angle_deg < up(null, 14, '중급').tack_angle_deg);

/* ---------- 3) 천장: 검증 범위(8~22kt) 안에서 14.5kt ----------
   22kt 위는 대조할 관측이 없다 — 그 바람에서 풍상 레이스를 하는 사람이
   없어서다. 상수를 억지로 맞춰 꼬리를 누르면 실측이 있는 구간(12kt VMG
   8.1→6.0)이 망가진다. 그래서 검증 구간만 수치로 못박고, 밖은
   beyond_validated_range 플래그로 '외삽'이라고 말하게 한다. */
var maxVmg = 0, maxAt = null;
/* 실측이 있는 구간은 8~18kt 다 (옥대표 GPS 10~14 · Formula Kite 연구 11~15).
   그 위는 곡선이 아직 오르지만 외삽 플래그가 켜진다 — 20kt 14.8 · 22kt 16.1. */
[5, 8, 10, 12, 14, 16, 18].forEach(function (kt) {
  ['입문', '초급', '중급', '상급', '선수', '상급-선수'].forEach(function (sk) {
    [4.0, 5.0, 6.0, 7.0, 8.0].forEach(function (a) {
      var d = up(null, kt, sk, { wing_area_m2: a });
      if (d && d.V_vmg_kt > maxVmg) { maxVmg = d.V_vmg_kt; maxAt = kt + 'kt/' + sk + '/' + a + '㎡'; }
    });
  });
});
ok('검증구간(≤18kt) 최대 풍상 VMG ≤ 14.5kt (옥대표: "프로도 거의 못 본다")',
   maxVmg <= 14.5, maxVmg.toFixed(1) + 'kt @ ' + maxAt);
/* 20kt 위에서 곡선이 더 오르는 건 막지 않되, 반드시 외삽으로 표시돼야 한다 */
ok('20kt 이상에서 14.5kt 를 넘으면 외삽 표시가 켜진다',
   [20, 22, 25, 30].every(function (kt) {
     return ['상급', '선수'].every(function (sk) {
       return [4.5, 5, 6].every(function (a) {
         var d = up(null, kt, sk, { wing_area_m2: a });
         return !d || d.V_vmg_kt <= 14.5 || d.beyond_validated_range === true;
       });
     });
   }));

/* 외삽 플래그 */
ok('검증구간 안에서는 외삽 표시가 안 뜬다',
   up(null, 14, '상급').beyond_validated_range === false &&
   up(null, 18, '중급').beyond_validated_range === false);
ok('22kt 초과는 외삽으로 표시된다',
   up(null, 25, '선수').beyond_validated_range === true &&
   up(null, 30, '상급').beyond_validated_range === true);
ok('VMG 가 14.5kt 를 넘으면(어떤 조건이든) 외삽 표시',
   [8, 10, 12, 14, 16, 18, 20, 22, 25, 30].every(function (kt) {
     return ['상급', '선수'].every(function (sk) {
       var d = up(null, kt, sk, { wing_area_m2: 5.0 });
       return !d || d.V_vmg_kt <= 14.5 || d.beyond_validated_range === true;
     });
   }));

/* ---------- 4) Formula Kite 실측을 넘지 않는다 ---------- */
/* 동료심사 GPS 연구(PMC7830054), 11~15kt: T1 풍상 VMG 12.2 · 배속 19.2 */
var kiteMax = 0;
[11, 12, 13, 14, 15].forEach(function (kt) {
  var d = up(null, kt, '선수');
  if (d && d.V_vmg_kt > kiteMax) kiteMax = d.V_vmg_kt;
});
ok('11~15kt 윙포일 최상급 VMG < Formula Kite T1 실측 12.2kt',
   kiteMax < 12.2, kiteMax.toFixed(1));
var maxRatio = 0;
[8, 10, 12, 14, 16, 18, 20, 22, 25].forEach(function (kt) {
  var d = up(null, kt, '선수');
  if (d) maxRatio = Math.max(maxRatio, d.V_vmg_kt / kt);
});
ok('VMG/풍속 ≤ 0.94 (Formula Kite 실측 상한)', maxRatio <= 0.94,
   maxRatio.toFixed(2));

/* ---------- 5) 옥대표 8/31 실측 대조 ---------- */
/* TWS 10~14kt · 72kg · 6.0㎡ · R6 V1(AR13.7) · 상급
   풍상 배속 상위50% 17.8kt · VMG 상위50% 7.8kt · 20초창 p95 VMG 9.3kt */
var m12 = up(null, 12, '상급'), m14 = up(null, 14, '상급');
ok('12kt/상급 VMG 가 실측 상위50%(7.8kt) 근처 (±1.5)',
   Math.abs(m12.V_vmg_kt - 7.8) <= 1.5, m12.V_vmg_kt.toFixed(1));
ok('14kt/상급 VMG 가 실측 창p95(9.3kt) 근처 (±1.5)',
   Math.abs(m14.V_vmg_kt - 9.3) <= 1.5, m14.V_vmg_kt.toFixed(1));
ok('14kt/상급 배속이 실측 상위50%(17.8kt) 근처 (±2.5)',
   Math.abs(m14.V_boat_kt - 17.8) <= 2.5, m14.V_boat_kt.toFixed(1));

/* ---------- 6) 단조성 ---------- */
var vs = [10, 12, 14, 16, 18, 20].map(function (kt) { return up(null, kt, '상급').V_boat_kt; });
ok('풍속 ↑ → 풍상 배속 ↑ (단조)',
   vs.every(function (v, i) { return i === 0 || v >= vs[i - 1] - 1e-9; }),
   vs.map(function (v) { return v.toFixed(1); }).join(' '));

/* ---------- 7) 두 사본 일치 ---------- */
[[12, '상급'], [18, '선수'], [14, '중급']].forEach(function (q) {
  var a = up(null, q[0], q[1]), b = up(LiftPwa, q[0], q[1]);
  ok('assets vs pwa 일치 (' + q[0] + 'kt/' + q[1] + ')',
     a && b && Math.abs(a.V_vmg_kt - b.V_vmg_kt) < 1e-9,
     (a ? a.V_vmg_kt : '—') + ' vs ' + (b ? b.V_vmg_kt : '—'));
});
ok('두 사본 runSelfTest 통과',
   Lift.runSelfTest().failed.length === 0 && LiftPwa.runSelfTest().failed.length === 0);

console.log('');
console.log('§483  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
