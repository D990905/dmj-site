/* ============================================================
 * selftest-424-sps-calibration.js — §424 SPS magnitude 재보정 검증
 *
 * 배경: 동일 GPX 가 Vantage Sailing SPS ~78 인데 우리 dashboard ~22
 * (3.5x 차이). 진단(.repro-424/): 지배 인자 = RATIO_FLOOR 가 elite 의
 * 0.78 ratio 를 56 점으로 압축. fix = floor 0.5/0.6 → 0 (ratio≈score,
 * 백분위형). lift 물리(§181)는 잠겨 있어 미변경 — 잔존 over-amplification
 * 은 Timo 트랙.
 *
 * 검증:
 *  1) 3 등급 mock(elite/intermediate/beginner) → computeVPS overall 이
 *     각 목표 range(60–80 / 30–55 / 5–25) 안 (풍속 12–18kt 전역).
 *  2) elite 가 Vantage 78 ±18 안 (= 60–80 정합).
 *  3) vpsBand 임계 canonical (80/60/40/20) 정합.
 *  4) floor=0 회귀 가드 (재보정 revert 방지).
 *
 *   실행:  node selftest-424-sps-calibration.js
 * ============================================================ */
'use strict';
var path = require('path');
var DIR = __dirname;
var ROOT = path.join(DIR, '..');
var Lift = require(path.join(ROOT, 'assets', 'js', 'lift-calculator.js'));
global.DMJLift = Lift.DMJLift || Lift;
var Coach = require(path.join(DIR, 'js', 'coach.js'));

var MS = 1.9438444924406;
var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

/* computeVPS 가 읽는 필드만 가진 최소 analysis mock 을 구성한다.
 * (full GPX 파이프라인은 selftest-sps-exclude / .repro-424/diag.js 가 커버) */
function mockAnalysis(upVmgKt, dnSogKt, tackEff, gybeEff) {
  var avg = (tackEff + gybeEff) / 2;
  return {
    wind: {
      vmgUpwindTop50Ms: upVmgKt / MS,
      upwindTimeSec: 3000, downwindTimeSec: 3000,
      tackSplit: { downwind: { all: { sog: { top50: dnSogKt / MS } } } }
    },
    maneuverStats: {
      avgEfficiency: avg,
      groups: { tack: { all: { effAvg: tackEff } },
                gybe: { all: { effAvg: gybeEff } } }
    }
  };
}

/* 등급별 mock — ~15kt 풍 wingfoil 세션 대표값.
 * elite 행 = 옥대표 실 GPX 측정치(upVMG 11.5 / dnSOG 20.7). turn 은
 * elite 가정 75 로 둠(실 세션의 낮은 택 효율은 별개 코칭 신호).
 * FLAG: int/beg 대표값은 도메인 추정 — 옥대표 직관 sign-off 필요. */
var RIDER = { weightKg: 72, skill: '상급-선수', wingM2: 6.0, foilAR: 6.5 };
var TIERS = [
  { name: 'elite',        a: mockAnalysis(11.5, 20.7, 72, 78), lo: 60, hi: 80 },
  { name: 'intermediate', a: mockAnalysis(6.5, 12.0, 48, 52),  lo: 30, hi: 55 },
  { name: 'beginner',     a: mockAnalysis(3.0, 6.0, 22, 28),   lo: 5,  hi: 25 }
];
var WINDS = [12, 14, 15, 16, 18];

/* 1) 등급 × 풍속 → overall range */
TIERS.forEach(function (t) {
  var allIn = true, cells = [];
  WINDS.forEach(function (wk) {
    var vps = Coach.computeVPS(t.a, RIDER, 210, wk);
    var ov = (vps.ok && vps.overall) ? vps.overall.score : null;
    cells.push(wk + 'kt:' + (ov == null ? '—' : ov));
    /* ±2 허용(라운딩·풍속 경계) */
    if (ov == null || ov < t.lo - 2 || ov > t.hi + 2) allIn = false;
  });
  check(t.name + ' overall ∈ [' + t.lo + '–' + t.hi + '] (풍속 12–18kt)',
    allIn, cells.join(' '));
});

/* 2) elite 가 Vantage 78 정합 (15kt 대표) */
var eliteVps = Coach.computeVPS(TIERS[0].a, RIDER, 210, 15);
var eliteOv = eliteVps.overall.score;
check('elite overall @15kt = Vantage 78 ±18', Math.abs(eliteOv - 78) <= 18,
  'overall=' + eliteOv + ' (speed=' + eliteVps.overall.speedScore + ')');

/* 등급 분리 — elite > intermediate > beginner */
var i15 = Coach.computeVPS(TIERS[1].a, RIDER, 210, 15).overall.score;
var b15 = Coach.computeVPS(TIERS[2].a, RIDER, 210, 15).overall.score;
check('등급 단조 분리 elite > int > beg @15kt', eliteOv > i15 && i15 > b15,
  eliteOv + ' > ' + i15 + ' > ' + b15);

/* 3) vpsBand canonical 임계 */
var bandCases = [
  [88, 'elite'], [80, 'elite'], [79, 'advanced'], [60, 'advanced'],
  [59, 'intermediate'], [40, 'intermediate'], [39, 'foundational'],
  [20, 'foundational'], [19, 'learning'], [0, 'learning'], [null, 'na']
];
bandCases.forEach(function (c) {
  var b = Coach.vpsBand(c[0]);
  check('vpsBand(' + c[0] + ') = ' + c[1], b.tier === c[1], 'color ' + b.color);
});

/* 4) floor=0 회귀 가드 */
check('VPS.UPWIND_RATIO_FLOOR = 0 (§424 백분위형 lock)',
  Coach.VPS.UPWIND_RATIO_FLOOR === 0, 'floor=' + Coach.VPS.UPWIND_RATIO_FLOOR);
check('VPS.DOWNWIND_RATIO_FLOOR = 0 (§424 백분위형 lock)',
  Coach.VPS.DOWNWIND_RATIO_FLOOR === 0, 'floor=' + Coach.VPS.DOWNWIND_RATIO_FLOOR);

/* 5) ratio≈score 직접 확인 (floor=0 효과) — upwindSpeedScore(0.78)≈78 */
check('upwindSpeedScore(0.78) ≈ 78 (백분위형)',
  Math.abs(Coach.upwindSpeedScore(0.78) - 78) < 1,
  '= ' + Coach.upwindSpeedScore(0.78).toFixed(1));

console.log('\n' + '-'.repeat(48));
console.log('PASS:', pass, ' FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);
