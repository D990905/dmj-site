/* ============================================================
 * selftest-wind-combine.js — 4-channel Bayesian wind combine self-test
 *
 * SailTechCo Moat W3 — combineWindSources 함수의 정합성 검증.
 *
 *   실행:  node selftest-wind-combine.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * References:
 *   · Mardia, K.V. & Jupp, P.E. 2000. "Directional Statistics". Wiley.
 *     ISBN 978-0-471-95333-3. doi:10.1002/9780470316979
 *   · sailtechco_moat_proposal.md §2.W3.3 (4-channel Bayesian spec)
 * ============================================================ */
'use strict';
var path = require('path');
var Geo = require(path.join(__dirname, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(__dirname, 'js', 'analysis.js'));

var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}

/* Helper — build a source */
function src(id, dir, conf, available) {
  return {
    id: id, windDir: dir, confidence: conf,
    available: available !== false  /* default true */
  };
}

console.log('=== 4-channel Bayesian wind combine self-test ===\n');

/* ---------- 1) 모든 채널 완전 일치 — 신뢰도 높음 ---------- */
console.log('[1] 모든 4 채널 풍향 235° 완전 일치 — 신뢰도 높음');
var ch1 = [
  src('nogo', 235, '높음'),
  src('rotation', 235, '높음'),
  src('lineup', 235, '보통'),
  src('weather', 235, '보통')
];
var r1 = An.combineWindSources(ch1);
console.log('      windDir=' + r1.windDir + '  confidence=' + r1.confidence +
  '  R=' + r1.R + '  spread=' + r1.spreadDeg + '°');
check('통합 풍향 = 235° (정확)', Math.abs(r1.windDir - 235) < 0.01,
  'windDir=' + r1.windDir);
check('신뢰도 = 높음', r1.confidence === '높음');
check('R̄ ≈ 1.0 (완전 일치)', Math.abs(r1.R - 1.0) < 0.001, 'R=' + r1.R);
check('spread ≈ 0°', r1.spreadDeg < 1, 'spread=' + r1.spreadDeg);
check('contributing 4 channels', r1.contributing.length === 4);

/* ---------- 2) 약간의 disagreement (±5°) — 신뢰도 높음 유지 ---------- */
console.log('\n[2] 채널 ±5° 분산 — 여전히 높음');
var ch2 = [
  src('nogo', 232, '높음'),
  src('rotation', 238, '높음'),
  src('lineup', 235, '보통')
];
var r2 = An.combineWindSources(ch2);
console.log('      windDir=' + r2.windDir + '  R=' + r2.R +
  '  spread=' + r2.spreadDeg + '°  conf=' + r2.confidence);
check('통합 풍향 ≈ 235° (가중 평균, ±1°)',
  Math.abs(r2.windDir - 235) < 1, 'windDir=' + r2.windDir);
/* 분산 작아도 채널이 2개 이상 + R 매우 높음 → 높음 */
check('신뢰도 ≥ 보통 (5° 분산은 양호)',
  r2.confidence === '높음' || r2.confidence === '보통',
  'conf=' + r2.confidence);

/* ---------- 3) 큰 disagreement (±30°) — 신뢰도 낮춤 ---------- */
console.log('\n[3] 채널 큰 disagreement (200° vs 270°) — 신뢰도 낮춤');
var ch3 = [
  src('nogo', 200, '보통'),
  src('rotation', 270, '보통')
];
var r3 = An.combineWindSources(ch3);
console.log('      windDir=' + r3.windDir + '  R=' + r3.R +
  '  spread=' + r3.spreadDeg + '°  conf=' + r3.confidence);
check('통합 풍향 ≈ 235° (중간점, 가중 평균)',
  Math.abs(r3.windDir - 235) < 5, 'windDir=' + r3.windDir);
check('spread > 20° (큰 disagreement 반영)',
  r3.spreadDeg > 20, 'spread=' + r3.spreadDeg);
check('신뢰도 낮음 (R̄ < 0.80)',
  r3.confidence === '낮음', 'conf=' + r3.confidence);

/* ---------- 4) 수동 확정 — 다른 채널 무시 ---------- */
console.log('\n[4] 수동 확정 (270°) — 다른 채널 무시 강제');
var ch4 = [
  src('manual', 270, '확정'),
  src('nogo', 235, '높음'),
  src('rotation', 240, '높음')
];
var r4 = An.combineWindSources(ch4);
console.log('      windDir=' + r4.windDir + '  conf=' + r4.confidence +
  '  contributing=' + r4.contributing.join(','));
check('통합 풍향 = 270° (수동 확정)', r4.windDir === 270);
check('confidence = 확정', r4.confidence === '확정');
check('contributing = [manual] 만', r4.contributing.length === 1 &&
  r4.contributing[0] === 'manual');

/* ---------- 5) 신뢰도 가중 — 높음 채널이 낮음 채널보다 강하게 ---------- */
console.log('\n[5] 신뢰도 가중 — 높음 (250°) vs 낮음 (220°)');
var ch5 = [
  src('rotation', 250, '높음'),   /* weight 3.0 */
  src('nogo', 220, '낮음')        /* weight 0.5 */
];
var r5 = An.combineWindSources(ch5);
console.log('      windDir=' + r5.windDir + '  channels=' +
  JSON.stringify(r5.channels));
/* 가중 평균: (3.0×250 + 0.5×220) / 3.5 = (750 + 110)/3.5 = 245.7° */
check('통합 풍향 ≈ 245.7° (높음 채널에 가중)',
  Math.abs(r5.windDir - 245.7) < 1, 'windDir=' + r5.windDir);

/* ---------- 6) Edge — circular wrap (350° vs 10°) ---------- */
console.log('\n[6] Circular wrap — 350° vs 10° (실제 평균은 0°)');
var ch6 = [
  src('nogo', 350, '높음'),
  src('rotation', 10, '높음')
];
var r6 = An.combineWindSources(ch6);
console.log('      windDir=' + r6.windDir + '  R=' + r6.R);
check('통합 풍향 ≈ 0° 또는 360° (원형 평균)',
  r6.windDir < 1 || r6.windDir > 359,
  'windDir=' + r6.windDir);

/* ---------- 7) Edge cases ---------- */
console.log('\n[7] Edge cases');
check('null input → null', An.combineWindSources(null) === null);
check('empty array → null', An.combineWindSources([]) === null);

var allUnavail = [
  { id: 'nogo', windDir: null, confidence: null, available: false },
  { id: 'rot', windDir: 235, confidence: null, available: false }
];
check('모두 unavailable → null', An.combineWindSources(allUnavail) === null);

/* ---------- 8) 모든 입력 '낮음' → 통합도 '낮음' clamp (과신 방지) ---------- */
console.log('\n[8] 모든 입력 낮음 → 통합 낮음 clamp (과신 방지)');
var allLow = [
  src('nogo', 230, '낮음'),
  src('rotation', 232, '낮음')
];
var r8 = An.combineWindSources(allLow);
console.log('      conf=' + r8.confidence + '  R=' + r8.R);
check('R 매우 높아도 (모든 낮음) → 낮음 clamp',
  r8.confidence === '낮음', 'conf=' + r8.confidence);

/* ---------- 9) buildWindSources 통합 ---------- */
console.log('\n[9] buildWindSources + combineWindSources 통합');
var bundle = An.buildWindSources({
  nogo: { windDir: 235, confidence: '높음', note: 'test', method: 'no-go' },
  rotation: { windDir: 232, confidence: '보통', note: 'test',
    method: 'maneuver geometry' },
  lineup: { windDir: 237, confidence: '높음', note: 'test', method: 'lineup' }
});
console.log('      sources=' + bundle.sources.length);
check('buildWindSources 가 6 슬롯 반환 (manual+lineup+nogo+rotation+imu+weather)',
  bundle.sources.length === 6, 'sources=' + bundle.sources.length);

var r9 = An.combineWindSources(bundle.sources);
console.log('      combined windDir=' + r9.windDir + '  conf=' + r9.confidence);
check('통합 결과 일관 (3 채널 가중 평균)',
  r9 != null && Math.abs(r9.windDir - 235) < 2 && r9.contributing.length === 3,
  'windDir=' + r9.windDir + ' contrib=' + r9.contributing.length);

/* ---------- 10) Weight override (Phase 2 — IMU dynamic SNR) ---------- */
console.log('\n[10] weightOverride — Phase 2 dynamic IMU SNR');
var withOverride = [
  src('nogo', 235, '높음'),
  Object.assign(src('imu', 280, '높음'), { weightOverride: 0.1 })
    /* IMU SNR 매우 낮음 → 사실상 무시 */
];
var r10 = An.combineWindSources(withOverride);
console.log('      windDir=' + r10.windDir + '  channels=' +
  JSON.stringify(r10.channels));
/* nogo weight 3.0 vs imu weight 0.1 — nogo 가 압도 → 235° 근처 */
check('IMU weightOverride 0.1 → nogo 235° 가 압도',
  Math.abs(r10.windDir - 235) < 5, 'windDir=' + r10.windDir);

console.log('\n=== 결과: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
