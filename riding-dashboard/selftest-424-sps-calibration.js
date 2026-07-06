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

/* 3b) §431 — 5 티어 도넛 색이 서로 모두 구분돼야 함 (Foundational=Elite 골드
   충돌 회귀 가드). 5개 밴드 대표 점수의 색을 뽑아 전부 유니크한지 검사. */
var tierColors = [90, 70, 50, 30, 10].map(function (s) { return Coach.vpsBand(s).color; });
var uniqColors = tierColors.filter(function (c, i) { return tierColors.indexOf(c) === i; });
check('§431 5 티어 도넛 색 전부 구분 (중복 없음)',
  uniqColors.length === 5, tierColors.join(' '));
check('§431 Foundational(30) ≠ Elite(90) 색',
  Coach.vpsBand(30).color !== Coach.vpsBand(90).color,
  'found=' + Coach.vpsBand(30).color + ' elite=' + Coach.vpsBand(90).color);

/* 3c) §432 — 트래픽 라이트 그라디언트 재배치. 긍정=그린, 부정=레드.
   (a) canonical hex 고정 (신호등 램프 회귀 가드)
   (b) 인접 밴드 luminance 차 확보 — 색맹(deutan/protan) 사용자도 구분 가능.
       특히 Advanced(연초록)↔Intermediate(노랑) 이 가장 가까운 쌍이라 명시 검사. */
function relLum(hex) {                       /* WCAG 상대 휘도 (0~1) */
  var m = hex.replace('#', '');
  var rgb = [0, 2, 4].map(function (i) {
    var c = parseInt(m.substr(i, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
/* §432 v2 — 형광(네온) 팔레트. 방향(신호등)은 동일, 톤만 밝게. */
var EXPECT_432 = {
  elite: '#00D97E', advanced: '#4ADE80', intermediate: '#FACC15',
  foundational: '#FB923C', learning: '#F87171'
};
[[90, 'elite'], [70, 'advanced'], [50, 'intermediate'],
 [30, 'foundational'], [10, 'learning']].forEach(function (c) {
  var b = Coach.vpsBand(c[0]);
  check('§432 ' + c[1] + ' hex = ' + EXPECT_432[c[1]],
    b.color.toUpperCase() === EXPECT_432[c[1]].toUpperCase(), 'got ' + b.color);
});
/* Elite→…→Learning 순으로 인접 luminance 차 (yellow 가 최고 휘도라 전역 단조는
   아니지만, 인접쌍은 모두 유의미하게 벌어져야 색맹 판별 가능). */
var lumOrder = ['elite', 'advanced', 'intermediate', 'foundational', 'learning']
  .map(function (t) { return { t: t, L: relLum(EXPECT_432[t]) }; });
var MIN_DL = 0.05;
for (var li = 0; li < lumOrder.length - 1; li++) {
  var a = lumOrder[li], nb = lumOrder[li + 1];
  var dL = Math.abs(a.L - nb.L);
  check('§432 인접 luminance 차 ' + a.t + '↔' + nb.t + ' ≥ ' + MIN_DL,
    dL >= MIN_DL, 'ΔL=' + dL.toFixed(3));
}
check('§432 Advanced↔Intermediate luminance 구분 (연초록≠노랑)',
  Math.abs(relLum(EXPECT_432.advanced) - relLum(EXPECT_432.intermediate)) >= MIN_DL,
  'ΔL=' + Math.abs(relLum(EXPECT_432.advanced) - relLum(EXPECT_432.intermediate)).toFixed(3));

/* 3d) §432 — 회전효율 score chip(app.js effChipHtml)은 SPS 도넛과 같은 vpsBand
   신호등 팔레트를 쓴다. 이전 자체 3단(≥70/≥45)이라 59·49 도 골드로 보이던
   버그를 회귀 가드. 칩은 score→vpsBand(score).color 를 그대로 쓰므로 이 밴드
   계약이 곧 칩 색이다. 옥대표 관측 케이스로 검증. */
[[68, 'advanced'], [59, 'intermediate'], [49, 'intermediate'],
 [43, 'intermediate'], [38, 'foundational'], [29, 'foundational'],
 [0, 'learning']].forEach(function (c) {
  var b = Coach.vpsBand(c[0]);
  check('§432 회전효율 chip ' + c[0] + ' → ' + c[1] + ' (' + EXPECT_432[c[1]] + ')',
    b.tier === c[1] && b.color.toUpperCase() === EXPECT_432[c[1]].toUpperCase(),
    'got ' + b.tier + ' ' + b.color);
});
/* 60 미만은 절대 elite/advanced-초록 골드가 아니어야 함 (옥대표 지적 핵심) */
check('§432 회전효율 59 = 골드(Elite색) 아님',
  Coach.vpsBand(59).color.toUpperCase() !== EXPECT_432.elite.toUpperCase() &&
  Coach.vpsBand(59).tier === 'intermediate', 'got ' + Coach.vpsBand(59).color);

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
