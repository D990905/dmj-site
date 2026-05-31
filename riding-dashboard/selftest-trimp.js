/* ============================================================
 * selftest-trimp.js — TRIMP (Training Impulse) self-test
 *
 * Banister 1991 TRIMP 공식의 정합성 검증.
 *   TRIMP = duration_min × HRR × weighting
 *   weighting_male   = 0.64 × exp(1.92 × HRR)
 *   weighting_female = 0.86 × exp(1.67 × HRR)
 *   HRR = (avg_HR − rest_HR) / (max_HR − rest_HR)
 *
 *   실행:  node selftest-trimp.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * References:
 *   · Banister, E.W. 1991. "Modeling Elite Athletic Performance". In
 *     *Physiological Testing of the High-Performance Athlete* 2e (pp. 403-424).
 *     Human Kinetics. ISBN 978-0-87322-307-5.
 *   · Morton, R.H., Fitz-Clarke, J.R., Banister, E.W. 1990.
 *     J Appl Physiol 69(3):1171-1177. doi:10.1152/jappl.1990.69.3.1171
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));

/* --- 미니 테스트 러너 --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}

/* --- TRIMP 공식 직접 계산 — 비교 truth source --- */
function trimpFormula(durationMin, avgHr, restHr, maxHr, sex) {
  var hrr = (avgHr - restHr) / (maxHr - restHr);
  if (hrr < 0) hrr = 0;
  if (hrr > 1) hrr = 1;
  var y = (sex === 'female')
    ? 0.86 * Math.exp(1.67 * hrr)
    : 0.64 * Math.exp(1.92 * hrr);
  return durationMin * hrr * y;
}

/* --- 합성 세션 builder — 정확한 duration·avg HR 가진 세션 생성 --- */
function makeSyntheticSession(durationSec, avgHr) {
  /* 1Hz 샘플 N개, lat/lng 점진적 이동, hr = avgHr 일정.
     normalizeSession 이 leg start~end 사이 시간 = totalSec 으로 계산 */
  var pts = [];
  var t0 = Date.parse('2026-05-28T10:00:00Z');
  var n = Math.floor(durationSec) + 1;
  for (var i = 0; i < n; i++) {
    pts.push({
      lat: 35.0 + i * 1e-5, lng: 129.0 + i * 1e-5,
      ele: 0, time: t0 + i * 1000, speed: null, hr: Math.round(avgHr)
    });
  }
  var parsed = {
    tracks: [{ name: 'synth', segments: [pts] }],
    pointCount: n, trackName: 'synth',
    hasTime: true, speedSource: 'derived', hasHR: true, hrPointCount: n
  };
  return An.normalizeSession(parsed);
}

console.log('=== TRIMP (Training Impulse) self-test ===\n');

/* ---------- 1) 표준 케이스: 1시간 · HRR 0.5 · 남성 ---------- */
console.log('[1] 표준 케이스 (Banister 1991): 1시간 · HRR=0.5 · 남성');
/* HRR 0.5 = avg 130 (rest 60, max 200 - 60 = 140 reserve) */
var sess1 = makeSyntheticSession(3600, 130);
var t1 = An.computeTRIMP(sess1, { restHr: 60, maxHr: 200, sex: 'male' });
var expected1 = trimpFormula(60, 130, 60, 200, 'male');
console.log('      TRIMP=' + t1.trimp + '  expected=' + expected1.toFixed(2) +
  '  HRR=' + t1.avgHrr + '  weighting=' + t1.weighting);
check('hasTRIMP true', t1.hasTRIMP === true);
check('avgHrr ≈ 0.5 (±0.005)', Math.abs(t1.avgHrr - 0.5) < 0.005,
  'avgHrr=' + t1.avgHrr);
check('weighting ≈ 0.64·e^0.96 ≈ 1.67 (±0.02)',
  Math.abs(t1.weighting - 1.67) < 0.02, 'weighting=' + t1.weighting);
check('TRIMP 공식 직접 계산과 일치 (±0.5)',
  Math.abs(t1.trimp - expected1) < 0.5,
  'got=' + t1.trimp + ' expected=' + expected1.toFixed(2));
check('TRIMP 범위 합리 (45-55, ≈50)',
  t1.trimp >= 45 && t1.trimp <= 55, 'trimp=' + t1.trimp);
check('sex=male', t1.sex === 'male');
check('durationMin = 60', t1.durationMin === 60);

/* ---------- 2) 여성 — 같은 케이스, 다른 weighting ---------- */
console.log('\n[2] 같은 케이스, 여성 (Banister female weighting)');
var t2 = An.computeTRIMP(sess1, { restHr: 60, maxHr: 200, sex: 'female' });
console.log('      TRIMP=' + t2.trimp + '  weighting=' + t2.weighting);
check('sex=female', t2.sex === 'female');
check('weighting ≈ 0.86·e^0.835 ≈ 1.98 (±0.02)',
  Math.abs(t2.weighting - 1.98) < 0.02, 'weighting=' + t2.weighting);
check('female TRIMP > male TRIMP (HRR=0.5 영역에서 — Banister 곡선 비교)',
  t2.trimp > t1.trimp, 'female=' + t2.trimp + ' male=' + t1.trimp);

/* ---------- 3) 고강도 — HRR 0.8 → 지수 증폭 확인 ---------- */
console.log('\n[3] 고강도 케이스: HRR=0.8 → 지수 증폭');
/* avg 172 (rest 60, max 200) → HRR = 112/140 = 0.8 */
var sess3 = makeSyntheticSession(3600, 172);
var t3 = An.computeTRIMP(sess3, { restHr: 60, maxHr: 200, sex: 'male' });
console.log('      TRIMP=' + t3.trimp + '  HRR=' + t3.avgHrr +
  '  weighting=' + t3.weighting);
check('avgHrr ≈ 0.8 (±0.005)', Math.abs(t3.avgHrr - 0.8) < 0.005,
  'avgHrr=' + t3.avgHrr);
check('weighting ≈ 0.64·e^1.536 ≈ 2.98 (±0.05)',
  Math.abs(t3.weighting - 2.98) < 0.05, 'weighting=' + t3.weighting);
check('TRIMP 증폭 — HRR 0.5 → 0.8 (1.6×) 에서 TRIMP > 2× (지수 증폭)',
  t3.trimp > t1.trimp * 2, 'hrr 0.8=' + t3.trimp + ' hrr 0.5=' + t1.trimp);

/* ---------- 4) Edge cases ---------- */
console.log('\n[4] Edge cases');
/* HR 없는 세션 (HR 없는 점만 — hasHR false) */
var sessNoHr = (function () {
  var pts = [];
  var t0 = Date.parse('2026-05-28T10:00:00Z');
  for (var i = 0; i < 60; i++) {
    pts.push({
      lat: 35.0 + i * 1e-5, lng: 129.0 + i * 1e-5,
      ele: 0, time: t0 + i * 1000, speed: null, hr: null
    });
  }
  return An.normalizeSession({
    tracks: [{ name: 't', segments: [pts] }],
    pointCount: 60, trackName: 't',
    hasTime: true, speedSource: 'derived', hasHR: false, hrPointCount: 0
  });
})();
var tNoHr = An.computeTRIMP(sessNoHr, { restHr: 60, maxHr: 200 });
check('HR 없음 → hasTRIMP false + reason=no_hr',
  tNoHr.hasTRIMP === false && tNoHr.reason === 'no_hr',
  'reason=' + tNoHr.reason);

/* restHr 없음 */
var tNoRest = An.computeTRIMP(sess1, { maxHr: 200 });
check('restHr 없음 → hasTRIMP false + reason=no_rest_hr',
  tNoRest.hasTRIMP === false && tNoRest.reason === 'no_rest_hr',
  'reason=' + tNoRest.reason);

/* HRR clamp — avg < rest 보호 */
var tBelow = An.computeTRIMP(sess1, { restHr: 200, maxHr: 250, sex: 'male' });
check('avg < rest (avgHr=130 < restHr=200) → HRR clamp 0 → TRIMP = 0',
  tBelow.hasTRIMP === true && tBelow.trimp === 0 && tBelow.avgHrr === 0,
  'trimp=' + tBelow.trimp + ' avgHrr=' + tBelow.avgHrr);

/* HRR clamp — avg > max 보호 */
var tAbove = An.computeTRIMP(sess1, { restHr: 60, maxHr: 100, sex: 'male' });
check('avg > max (avgHr=130 > maxHr=100) → HRR clamp 1',
  tAbove.hasTRIMP === true && tAbove.avgHrr === 1,
  'avgHrr=' + tAbove.avgHrr);

/* maxHr 없음 → observed maxBpm fallback */
var tNoMax = An.computeTRIMP(sess1, { restHr: 60 });
check('maxHr 없음 → observed maxBpm fallback (maxHrSource=observed)',
  tNoMax.hasTRIMP === true && tNoMax.maxHrSource === 'observed',
  'maxHrSource=' + tNoMax.maxHrSource);

/* ---------- 5) 송정(부산) sample — 실측 GPX 통합 ---------- */
console.log('\n[5] 송정(부산) sample GPX — 실제 라이딩 데이터');
/* selftest-hr.js 와 같은 경량 GPX parser */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var eM = inner.match(/<ele>([^<]+)<\/ele>/);
    var hM = inner.match(/<[A-Za-z0-9]*:?hr>([^<]+)<\/[A-Za-z0-9]*:?hr>/);
    var hv = hM ? parseFloat(hM[1]) : null;
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]),
      ele: eM ? parseFloat(eM[1]) : null,
      time: tM ? Date.parse(tM[1]) : null,
      speed: null,
      hr: (hv != null && isFinite(hv) && hv >= 20 && hv <= 240)
        ? Math.round(hv) : null
    });
  }
  var withTime = pts.filter(function (p) { return p.time != null; }).length;
  var withHR = pts.filter(function (p) { return p.hr != null; }).length;
  return {
    tracks: [{ name: 'selftest', segments: [pts] }],
    pointCount: pts.length, trackName: 'selftest',
    hasTime: withTime >= pts.length * 0.5,
    speedSource: 'derived',
    hasHR: withHR >= pts.length * 0.5,
    hrPointCount: withHR
  };
}
var xml = fs.readFileSync(path.join(DIR, 'sample',
  'sample-songjeong-busan.gpx'), 'utf8');
var sjSession = An.normalizeSession(parseGPX(xml));

/* 합리적인 라이더 profile — 40대 남성 표준 */
var sjProfile = { restHr: 55, maxHr: 178, sex: 'male' };  /* Tanaka 208-0.7×40 ≈ 180 */
var sjTrimp = An.computeTRIMP(sjSession, sjProfile);
console.log('      TRIMP=' + sjTrimp.trimp +
  '  durationMin=' + sjTrimp.durationMin +
  '  avgBpm=' + sjTrimp.avgBpm +
  '  avgHrr=' + sjTrimp.avgHrr);
check('hasTRIMP true (실측 세션)', sjTrimp.hasTRIMP === true);
check('durationMin > 0', sjTrimp.durationMin > 0);
check('avgHrr 범위 합리 (0.3-0.9 — 윙포일 라이딩 일반)',
  sjTrimp.avgHrr >= 0.3 && sjTrimp.avgHrr <= 0.9,
  'avgHrr=' + sjTrimp.avgHrr);
check('TRIMP > 0', sjTrimp.trimp > 0);
check('TRIMP 범위 합리 (10-300 for 단일 윙포일 세션)',
  sjTrimp.trimp >= 10 && sjTrimp.trimp <= 300,
  'trimp=' + sjTrimp.trimp);

/* ---------- 결과 출력 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
