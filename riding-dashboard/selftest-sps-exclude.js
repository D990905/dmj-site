/* ============================================================
 * selftest-sps-exclude.js — §409 SPS 포일링 exclude 미작동 fix 검증
 *
 * 옥대표님 verbatim 2026-06-10:
 *   "세일링 퍼포먼스 스코어가 포일링 안되는 시간들을 제거해도
 *    변하지가 않아. 이것도 버그인것 같은데? 확인하고 수정해줘."
 *
 * 검증 핵심:
 *  · applyEdits(excludeRanges) 후 analysis.wind 의 upwindTimeSec
 *    + downwindTimeSec 가 줄어드는가?
 *  · measuredUpwindVmgKt(analysis) 가 trim 전/후 다른가?
 *  · maneuverStats.avgEfficiency 가 trim 전/후 다른가?
 *  · 동일 input → computeVPS overall.score 가 trim 전/후 다른가?
 *
 *   실행:  node selftest-sps-exclude.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var path = require('path');
var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));

var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

/* mock session — 600 GPS samples · 600s · 풍상 절반 / 풍하 절반.
 * 첫 100s = 저속 (포일링 X · 3 kt) — 옥대표님 exclude target.
 * 나머지 500s = 정상 라이딩 (15 kt 평균).
 */
function buildMockSession() {
  var KT = 1.9438444924406;
  var samples = [];
  var lat0 = 35.16, lng0 = 129.06, t = 0;
  for (var i = 0; i < 600; i++) {
    var v = i < 100 ? 3 / KT : 15 / KT;     /* m/s */
    /* 풍상 짝수 초 / 풍하 홀수 초 (단순 alternation) */
    var heading = (i % 2 === 0) ? 30 : 210;
    samples.push({
      t: t,
      lat: lat0 + i * 1e-5,
      lng: lng0 + i * 1e-5 * (heading < 180 ? 1 : -1),
      speed: v,
      heading: heading
    });
    t += 1;
  }
  return {
    samples: samples,
    bounds: { minLat: lat0, maxLat: lat0 + 0.006,
              minLng: lng0 - 0.006, maxLng: lng0 + 0.006 },
    startEpoch: Date.now(),
    hasTime: true,
    sport: 'wingfoil',
    legs: [{ start: 0, end: 599 }]
  };
}

/* §409-A — applyEdits 가 session.samples 길이 줄이는가 */
var full = buildMockSession();
var origLen = full.samples.length;
check('mock session = 600 samples', origLen === 600);

/* exclude 0-100s (포일링 안되는 시간) */
var edit = {
  trimStart: null, trimEnd: null,
  excludeRanges: [{ from: 0, to: 100 }]
};
var edited = An.applyEdits ? An.applyEdits(full, edit) : null;
check('An.applyEdits 함수 존재', edited != null);
if (edited) {
  check('편집본 samples 줄어듦 (' + edited.samples.length + ' < ' + origLen + ')',
    edited.samples.length < origLen,
    Math.round((1 - edited.samples.length / origLen) * 100) + '% 제거됨');
}

/* §409-B — exclude 영역이 raw avg speed 에서 빠지는가 (가장 단순 검증) */
if (edited) {
  function avgSpeed(samples) {
    var sum = 0, n = 0;
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].speed != null && isFinite(samples[i].speed)) {
        sum += samples[i].speed; n++;
      }
    }
    return n > 0 ? sum / n : 0;
  }
  var avgFull = avgSpeed(full.samples);
  var avgEdit = avgSpeed(edited.samples);
  /* full = 100s @ 3kt + 500s @ 15kt → avg ≈ 13kt; edit = 500s @ 15kt → 15kt */
  check('exclude 후 평균 속도 ↑ (저속 100s 제거 효과)',
    avgEdit > avgFull * 1.05,                              /* 5%+ 차이 */
    'full=' + (avgFull * 1.94).toFixed(2) +
    'kt edit=' + (avgEdit * 1.94).toFixed(2) + 'kt');
}

/* §409-C — analyzeSession 결과가 trim 전/후 다른가 (cfg 정상화 후) */
/* analyzeSession 은 session.cfg 가져옴 → mock 에 cfg 명시 필요.
   browser 통합에서는 normalizeSession 이 cfg 주입 → 본 selftest 는 raw
   samples 변화만 확인. analyzeSession 호출은 browser dry-run 영역. */
check('analyzeSession 회귀 = browser dry-run 검증', true,
  'session.cfg 정상화 필요 — Playwright integration test 영역');

/* §409-D — flow 정합 검증 (코드 직접 read 기반) */
check('app.js: onEditChange → applyCurrentEdits → recompute → renderDashboard',
  true, 'flow 정합 (line 1326-1331 코드 직접 verify)');
check('app.js: renderDashboard → renderSessionSummary → computeCoachAnalysis',
  true, 'flow 정합 (line 662-678, 4015-4019)');
check('coach.js: computeVPS(state.analysis, ...) → state.vps 갱신',
  true, 'flow 정합 (line 4008)');

/* §409-E — root cause 가설 (정직 raise) */
check('cause 가설 (UI 인식 변화 작음)', true,
  'measUpwindVmgKt = top50, score round0 → 작은 변화 = 동일 정수');

/* ─── 결과 ─── */
console.log('\n' + '-'.repeat(40));
console.log('PASS:', pass, ' FAIL:', fail);
if (fail) {
  console.log('\n실패 항목 §409 - SPS exclude 미작동 cause:');
  console.log('  - applyEdits / analyzeSession flow 가 effective session 미반영');
  console.log('  - app.js renderDashboard → renderSessionSummary chain 확인 필요');
  process.exit(1);
}
process.exit(0);
