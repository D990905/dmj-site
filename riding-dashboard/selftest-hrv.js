/* ============================================================
 * selftest-hrv.js — HRV (RMSSD/SDNN/pNN50) self-test
 *
 * Task Force 1996 표준 정합성 검증.
 *   RMSSD = √(mean of (RR_{i+1} − RR_i)²)
 *   SDNN  = √(variance of all RR intervals)
 *   pNN50 = % of consecutive RR diffs > 50ms
 *
 *   실행:  node selftest-hrv.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * References:
 *   · Task Force ESC/NASPE 1996. Eur Heart J 17(3):354-381.
 *     doi:10.1161/01.CIR.93.5.1043. PMID 8598068.
 *   · Plews, D.J. et al. 2013. "Training adaptation and HRV in elite endurance
 *     athletes". Sports Med 43(9):773-781. doi:10.1007/s40279-013-0071-8.
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

console.log('=== HRV (RMSSD/SDNN/pNN50) self-test ===\n');

/* ---------- 1) 표준 케이스 — 알려진 RMSSD ----------
   고정 RR diff 40ms (alternating +40/-40 around mean 800)
   → RMSSD = √(mean of 40²) = 40 ms */
console.log('[1] 정확 RMSSD 검증 — RR alternating ±40ms around 800');
var alt = [];
for (var i = 0; i < 60; i++) alt.push(800 + (i % 2 === 0 ? 20 : -20));
var h1 = An.computeHRV(alt);
console.log('      RMSSD=' + h1.rmssd + '  SDNN=' + h1.sdnn +
  '  pNN50=' + h1.pnn50 + '  meanRR=' + h1.meanRR + '  meanHR=' + h1.meanHR);
check('hasHRV true', h1.hasHRV === true);
check('RMSSD = 40 ms (alternating ±20ms diff = 40ms apart) (±0.5)',
  Math.abs(h1.rmssd - 40) < 0.5, 'RMSSD=' + h1.rmssd);
check('mean RR = 800 ms', Math.abs(h1.meanRR - 800) < 0.5);
check('mean HR = 75 bpm (60000/800)', Math.abs(h1.meanHR - 75) < 0.5);
check('pNN50 = 0 (diff = 40ms, < 50ms threshold)',
  h1.pnn50 === 0, 'pnn50=' + h1.pnn50);

/* ---------- 2) 정확 SDNN — 상수 RR ----------
   모든 RR 동일 → SDNN = 0, RMSSD = 0 */
console.log('\n[2] Constant RR — SDNN = 0, RMSSD = 0');
var constant = [];
for (var i = 0; i < 60; i++) constant.push(900);
var h2 = An.computeHRV(constant);
check('hasHRV true (충분 표본)', h2.hasHRV === true);
check('RMSSD = 0', h2.rmssd === 0);
check('SDNN = 0', h2.sdnn === 0);
check('pNN50 = 0', h2.pnn50 === 0);

/* ---------- 3) 정확 SDNN — known variance ----------
   uniform distribution: RR ∈ {800, 850} 균등.
   SDNN = std of {800, 850 alternating} = 25 ms */
console.log('\n[3] SDNN — alternating 800/850 → SDNN ≈ 25 ms');
var uniform = [];
for (var i = 0; i < 60; i++) uniform.push(i % 2 === 0 ? 800 : 850);
var h3 = An.computeHRV(uniform);
console.log('      SDNN=' + h3.sdnn + '  RMSSD=' + h3.rmssd);
check('SDNN ≈ 25 ms (population std)', Math.abs(h3.sdnn - 25) < 0.5);
check('RMSSD = 50 ms (alternating diff 50ms)',
  Math.abs(h3.rmssd - 50) < 0.5, 'RMSSD=' + h3.rmssd);
check('pNN50 = 0 (diff exactly 50, threshold > 50)',
  h3.pnn50 === 0, 'pnn50=' + h3.pnn50);

/* ---------- 4) pNN50 > 0 — diff > 50ms ---------- */
console.log('\n[4] pNN50 — diff 60ms (모두 > 50ms)');
var pnnTest = [];
for (var i = 0; i < 60; i++) pnnTest.push(i % 2 === 0 ? 800 : 860);
var h4 = An.computeHRV(pnnTest);
console.log('      pNN50=' + h4.pnn50 + '  ectopics=' + h4.ectopicsRejected);
/* mean RR = 830, threshold = 0.20 × 830 = 166 ms. diff=60 OK (안 잘림). */
check('pNN50 100% (모든 diff 60 > 50)',
  h4.pnn50 === 100, 'pnn50=' + h4.pnn50);

/* ---------- 5) Artifact rejection ---------- */
console.log('\n[5] Artifact rejection — RR < 300 or > 2000');
var withArtifacts = [];
for (var i = 0; i < 50; i++) withArtifacts.push(800);
withArtifacts.push(100);   /* HR 600 — artifact */
withArtifacts.push(3000);  /* HR 20 — artifact */
withArtifacts.push(800);
for (var i = 0; i < 10; i++) withArtifacts.push(800);
var h5 = An.computeHRV(withArtifacts);
check('hasHRV true (clean ≥ 30)', h5.hasHRV === true);
check('artifacts rejected = 2', h5.artifactsRejected === 2,
  'rejected=' + h5.artifactsRejected);
check('count = 61 (63 입력 − 2 artifact)', h5.count === 61, 'count=' + h5.count);

/* ---------- 6) Ectopic beat rejection ---------- */
console.log('\n[6] Ectopic beat — diff > 20% mean RR');
var withEctopic = [];
for (var i = 0; i < 40; i++) withEctopic.push(800);  /* mean 800 */
withEctopic.push(1100);  /* +300ms = 37.5% — ectopic */
withEctopic.push(800);
for (var i = 0; i < 20; i++) withEctopic.push(800);
var h6 = An.computeHRV(withEctopic);
console.log('      ectopicsRejected=' + h6.ectopicsRejected +
  '  cleanDiffCount=' + h6.cleanDiffCount);
check('ectopic beats rejected (>= 2 diff)',
  h6.ectopicsRejected >= 2, 'rejected=' + h6.ectopicsRejected);

/* ---------- 7) Insufficient samples ---------- */
console.log('\n[7] Edge cases');
var h7 = An.computeHRV([800, 820]);
check('< 30 samples → insufficient_samples',
  h7.hasHRV === false && h7.reason === 'insufficient_samples');

var h7b = An.computeHRV(null);
check('null input → insufficient_samples', h7b.hasHRV === false);

/* 60 samples 모두 artifact */
var allBad = [];
for (var i = 0; i < 60; i++) allBad.push(100);
var h7c = An.computeHRV(allBad);
check('all artifacts → too_many_artifacts',
  h7c.hasHRV === false && h7c.reason === 'too_many_artifacts',
  'reason=' + h7c.reason);

/* ---------- 8) 학술 표준 범위 — athlete HRV (Plews 2013) ----------
   엘리트 endurance 선수: RMSSD 80-120 ms range. 일반인 30-60 ms.
   합성 athlete-like 시퀀스 — RR mean 1000ms (HR 60), random walk ±50ms.
   변동성이 큰 시퀀스로 RMSSD 가 50-150 범위에 들어와야. */
console.log('\n[8] 학술 표준 범위 — athlete-like HRV');
var rng = function () { /* deterministic seedable PRNG (Mulberry32) */
  var s = 12345;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}();
var athlete = [1000];
for (var i = 1; i < 100; i++) {
  athlete.push(athlete[i - 1] + (rng() - 0.5) * 100);  /* ±50ms walk */
}
var h8 = An.computeHRV(athlete);
console.log('      RMSSD=' + h8.rmssd + '  SDNN=' + h8.sdnn);
check('RMSSD 정상 athlete range (30-200ms)',
  h8.rmssd >= 30 && h8.rmssd <= 200, 'RMSSD=' + h8.rmssd);

console.log('\n=== 결과: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
