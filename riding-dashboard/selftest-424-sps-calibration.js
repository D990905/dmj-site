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
/* chart-theme.js 는 module.exports 가 아니라 global.RDChartTheme 에 붙는다. */
require(path.join(DIR, 'js', 'chart-theme.js'));
var ChartTheme = global.RDChartTheme || globalThis.RDChartTheme;
/* charts.js 도 global.RDCharts 에 붙는다(chart-theme 와 동일 패턴). */
require(path.join(DIR, 'js', 'charts.js'));
var Charts = global.RDCharts || globalThis.RDCharts;

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

/* 3b) §433 v4 — 5 티어 색. ⚠ 옥대표 "이 색깔로 그대로"(2026-07-08) 지시로
   Elite=Advanced 동일 hex(#50AE33). 따라서 "5색 전부 유니크"는 더는 요구하지
   않고 (i) Elite=Advanced 동일(의도) (ii) 나머지는 초록과 구분되는 4색군
   (iii) §431 원 버그(Foundational=Elite 골드 충돌) 재발 없음 을 가드한다.
   두 초록(Elite/Advanced) 시각 구분은 §433 도넛 shape(rim·drop-shadow)가 담당. */
var tierColors = [90, 70, 50, 30, 10].map(function (s) { return Coach.vpsBand(s).color; });
check('§433 v4 Elite=Advanced 동일 hex (옥대표 "그대로")',
  tierColors[0] === tierColors[1] && tierColors[0].toUpperCase() === '#50AE33',
  'elite=' + tierColors[0] + ' adv=' + tierColors[1]);
var uniqColors = tierColors.filter(function (c, i) { return tierColors.indexOf(c) === i; });
check('§433 v4 구분 색군 4개 (Elite=Adv 의도 중복 제외 전부 유니크)',
  uniqColors.length === 4, tierColors.join(' '));
check('§431 Foundational(30) ≠ Elite(90) 색 (원 골드충돌 회귀 가드)',
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
/* §433 v4 — 옥대표 "이 색깔로 그대로"(2026-07-08). Apple 이모지(🟢🟡🟠🔴)
   픽셀 샘플색. Elite=#50AE33(emoji green) / Advanced=#50AE33(Elite 와 동일) /
   Intermediate=#F9DA4A(warm yellow) / Foundational=#D78A32(burnt orange) /
   Learning=#C23328(brick red). §432 rainbow(순색 형광) override. */
var EXPECT_432 = {
  elite: '#50AE33', advanced: '#50AE33', intermediate: '#F9DA4A',
  foundational: '#D78A32', learning: '#C23328'
};
[[90, 'elite'], [70, 'advanced'], [50, 'intermediate'],
 [30, 'foundational'], [10, 'learning']].forEach(function (c) {
  var b = Coach.vpsBand(c[0]);
  check('§432 ' + c[1] + ' hex = ' + EXPECT_432[c[1]],
    b.color.toUpperCase() === EXPECT_432[c[1]].toUpperCase(), 'got ' + b.color);
});
/* §432 v3.2 — 트래픽 라이트 자연 rainbow. hue 가 초록(120°)→chartreuse(90°)→
   노랑(48°)→오렌지(39°)→빨강(0°) 로 단조 감소. 인접 tier 구분은 luminance
   또는 hue 로 확보된다(rainbow 는 hue 가 1차 신호): Elite↔Advanced 는 둘 다
   밝아 ΔL 은 작지만(0.045) hue 30° 로 뚜렷, Int↔Found 는 hue 는 가깝지만(9°)
   luminance 로 뚜렷(0.163). 색맹 회귀 가드 = 인접쌍이 ΔL≥0.05 OR Δhue≥20° 로
   구분 가능 + hue 단조(rainbow 순서) + 5색 유니크. */
function hueOf(hex) {
  var m = hex.replace('#', '');
  var r = parseInt(m.substr(0, 2), 16) / 255, g = parseInt(m.substr(2, 2), 16) / 255,
      b = parseInt(m.substr(4, 2), 16) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  var H = mx === r ? 60 * (((g - b) / d) % 6)
        : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return (H + 360) % 360;
}
var order432 = ['elite', 'advanced', 'intermediate', 'foundational', 'learning'];
var MIN_DL = 0.05, MIN_DH = 20;
for (var li = 0; li < order432.length - 1; li++) {
  var t1 = order432[li], t2 = order432[li + 1];
  if (t1 === 'elite' && t2 === 'advanced') {
    /* v4: Elite=Advanced 동일 hex(옥대표 "그대로") — 색 구분 대신 도넛
       shape(rim·drop-shadow)로 구분. 동일함을 명시 encode. */
    check('§433 v4 elite=advanced 동일(옥대표 지시, 색 구분은 shape 담당)',
      EXPECT_432.elite === EXPECT_432.advanced, EXPECT_432.elite);
    continue;
  }
  var dL = Math.abs(relLum(EXPECT_432[t1]) - relLum(EXPECT_432[t2]));
  var dH = Math.abs(hueOf(EXPECT_432[t1]) - hueOf(EXPECT_432[t2]));
  check('§433 v4 인접 구분 ' + t1 + '↔' + t2 + ' (ΔL≥' + MIN_DL + ' 또는 Δhue≥' + MIN_DH + '°)',
    dL >= MIN_DL || dH >= MIN_DH, 'ΔL=' + dL.toFixed(3) + ' Δhue=' + dH.toFixed(0) + '°');
}
/* hue 비증가 = 신호등 순서(초록→빨강) 회귀 가드. v4 는 elite=advanced 로 hue
   동일 구간이 있어 strict > 대신 >= 사용. */
var hues432 = order432.map(function (t) { return hueOf(EXPECT_432[t]); });
var huesMono = hues432.every(function (h, i) { return i === 0 || hues432[i - 1] >= h; });
check('§433 v4 hue 비증가 (초록→빨강 신호등 순서)', huesMono, hues432.map(function (h) { return h.toFixed(0) + '°'; }).join(' ≥ '));
/* 색군 유니크: v4 는 Elite=Advanced 로 4개 (동일색 붕괴 아닌 의도된 중복). */
var v3uniq = order432.map(function (t) { return EXPECT_432[t]; });
check('§433 v4 색군 4개 (Elite=Adv 의도 중복 제외 유니크)',
  new Set(v3uniq).size === 4, v3uniq.join(' '));

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

/* 3e) §432 — 심박 존색(chart-theme HR_ZONE)이 SPS 5-tier 와 hex 완전 일치.
   옥대표 "심박 높으면 레드 낮으면 그린": Z1 recovery=SPS Elite(그린) …
   Z5 anaerobic=SPS Learning(레드). 두 팔레트 drift 회귀 가드. */
var HRZ = ChartTheme && ChartTheme.hrZone ? ChartTheme.hrZone : null;
check('§432 chart-theme HR_ZONE 로드', !!HRZ, HRZ ? 'ok' : 'RDChartTheme.hrZone 없음');
if (HRZ) {
  var zoneToTier = [['z1', 90], ['z2', 70], ['z3', 50], ['z4', 30], ['z5', 10]];
  zoneToTier.forEach(function (zt) {
    var hrHex = String(HRZ[zt[0]]).toUpperCase();
    var spsHex = Coach.vpsBand(zt[1]).color.toUpperCase();
    check('§432 HR ' + zt[0].toUpperCase() + ' = SPS ' + Coach.vpsBand(zt[1]).tier + ' 색 일치',
      hrHex === spsHex, 'HR=' + hrHex + ' SPS=' + spsHex);
  });
  /* 방향 확인 — Z1(낮은 심박)=그린(Elite), Z5(높은 심박)=레드(Learning) */
  check('§432 HR Z1(recovery)=그린(SPS Elite)',
    String(HRZ.z1).toUpperCase() === EXPECT_432.elite.toUpperCase(), 'z1=' + HRZ.z1);
  check('§432 HR Z5(anaerobic)=레드(SPS Learning)',
    String(HRZ.z5).toUpperCase() === EXPECT_432.learning.toUpperCase(), 'z5=' + HRZ.z5);
  /* 심박 곡선(line)은 존 신호 아님 — 붉은색 유지(옥대표 지시), 존색과 분리 */
  check('§432 HR line(심박곡선) = 존색 아닌 정체 적색 유지',
    String(HRZ.line).toUpperCase() !== EXPECT_432.learning.toUpperCase(), 'line=' + HRZ.line);
}

/* 3f) §432 v2 — 속도 분포 파이색(charts.speedTierColor)이 절대 속도 → 5-tier
   신호등(형광) 이산 매핑. 옥대표 "속도분포도 교체". 팔레트는 chart-theme
   signal5 단일 소스(= SPS·HR 와 일치). 히스토그램 bin=2kt, 경계 2/8/14/18. */
var SIG = ChartTheme && ChartTheme.signal5 ? ChartTheme.signal5 : null;
check('§432 chart-theme signal5(5-tier 팔레트) 로드', !!SIG && SIG.length === 5,
  SIG ? SIG.join(' ') : '없음');
if (SIG) {
  /* signal5 순서(레드→에메랄드)가 SPS tier 색과 정합 */
  var sigToTier = [[0, 'learning'], [1, 'foundational'], [2, 'intermediate'],
                   [3, 'advanced'], [4, 'elite']];
  sigToTier.forEach(function (st) {
    check('§432 signal5[' + st[0] + '] = SPS ' + st[1] + ' 색',
      SIG[st[0]].toUpperCase() === EXPECT_432[st[1]].toUpperCase(),
      'sig=' + SIG[st[0]] + ' sps=' + EXPECT_432[st[1]]);
  });
}
if (Charts && typeof Charts.speedTierColor === 'function') {
  /* 절대 속도 → 형광 tier (빠를수록 초록): 옥대표 지정 구간 대표 속도로 검증 */
  var speedCases = [
    [1, 'learning'],      // 0–2 정지·바운스 = 레드
    [5, 'foundational'],  // 2–8 정체·워터스타트 = 오렌지
    [11, 'intermediate'], // 8–14 저속 라이딩 = 옐로
    [15, 'advanced'],     // 14–18 포일링 안정 = 라임
    [20, 'elite']         // 18+ 포일링 고속 = 에메랄드
  ];
  speedCases.forEach(function (sc) {
    check('§432 속도 ' + sc[0] + 'kt → ' + sc[1] + ' (' + EXPECT_432[sc[1]] + ')',
      Charts.speedTierColor(sc[0]).toUpperCase() === EXPECT_432[sc[1]].toUpperCase(),
      'got ' + Charts.speedTierColor(sc[0]));
  });
  /* 경계값(2·8·14·18) — 하한 포함(≥) 규칙: 정확히 경계면 위 tier 로 */
  check('§432 속도 경계 2kt = foundational(오렌지, 하한 포함)',
    Charts.speedTierColor(2).toUpperCase() === EXPECT_432.foundational.toUpperCase(),
    'got ' + Charts.speedTierColor(2));
  check('§432 속도 경계 18kt = elite(에메랄드, 하한 포함)',
    Charts.speedTierColor(18).toUpperCase() === EXPECT_432.elite.toUpperCase(),
    'got ' + Charts.speedTierColor(18));
  /* 순서: 느림=레드 → 빠름=에메랄드 (역전 없음) */
  check('§432 속도색 순서 레드(느림)→에메랄드(빠름)',
    Charts.speedTierColor(1).toUpperCase() === EXPECT_432.learning.toUpperCase() &&
    Charts.speedTierColor(25).toUpperCase() === EXPECT_432.elite.toUpperCase(),
    'slow=' + Charts.speedTierColor(1) + ' fast=' + Charts.speedTierColor(25));
} else {
  check('§432 charts.speedTierColor export', false, '함수 미노출');
}

/* 4) floor=0 회귀 가드 */
check('VPS.UPWIND_RATIO_FLOOR = 0 (§424 백분위형 lock)',
  Coach.VPS.UPWIND_RATIO_FLOOR === 0, 'floor=' + Coach.VPS.UPWIND_RATIO_FLOOR);
check('VPS.DOWNWIND_RATIO_FLOOR = 0 (§424 백분위형 lock)',
  Coach.VPS.DOWNWIND_RATIO_FLOOR === 0, 'floor=' + Coach.VPS.DOWNWIND_RATIO_FLOOR);

/* 5) §424 의 핵심 lock 은 **floor=0** 이다 — 그게 elite 의 0.78 을 56점으로
   압축하던 원인이었다(Vantage 78 대비 3.5배 괴리). floor 은 위에서 이미
   0 으로 못박았고, 여기서는 압축이 없다는 성질 자체를 확인한다:
   ratio 가 0 이면 0점, 선형이며, floor 구간이 없다.
   ⚠ TOP 은 §484 에서 1.00 → 1.20 으로 옮겼다(예측기가 약·중풍에서
   보수적이 되어 실측이 예측을 넘는 구간이 생겼다). 그래서 "ratio≈score"
   는 더 이상 성립하지 않는다 — 대신 **선형·무압축**만 지킨다. */
check('upwindSpeedScore 는 선형이고 압축 구간이 없다',
  Math.abs(Coach.upwindSpeedScore(0) - 0) < 1e-9 &&
  Math.abs(Coach.upwindSpeedScore(0.6) - Coach.upwindSpeedScore(0.3) * 2) < 1e-6,
  '0→' + Coach.upwindSpeedScore(0).toFixed(1) +
  ' 0.3→' + Coach.upwindSpeedScore(0.3).toFixed(1) +
  ' 0.6→' + Coach.upwindSpeedScore(0.6).toFixed(1));
check('예측치 도달(ratio=1.0)이 83점 이상 — 압축 시절(56점)로 회귀 방지',
  Coach.upwindSpeedScore(1.0) >= 83,
  '= ' + Coach.upwindSpeedScore(1.0).toFixed(1));

console.log('\n' + '-'.repeat(48));
console.log('PASS:', pass, ' FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);
