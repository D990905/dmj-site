/* ============================================================
 * selftest-polar-career.js — 통합 폴라(§A1) · 커리어 누적 패널(§A2)
 *
 * Danny 검토 2026-05-23 두 항목을 부산 송정 실측 GPX 로 검증한다.
 *  · A1 — RDCharts.renderTargetPolar 가 한 폴라에 3곡선(세션 포트·
 *         스타보드 실선 + 개인 베스트 타깃 점선)을 오류 없이 그리고,
 *         호버 인터랙션이 예외 없이 동작하는지.
 *  · A2 — RDStorage.careerStats / personalBests 가 누적 합계·최고
 *         기록·평균을 정확히 산출하고, 최고 기록이 그 세션 id 를
 *         함께 담는지(타일 클릭 → 세션 이동의 근거).
 * 의존성 0 — Node 내장 모듈만 사용.
 *
 *   실행:  node selftest-polar-career.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var DIR = __dirname;

/* ---------- 캔버스·DOM 스텁 (charts.js 커스텀 폴라 구동용) ---------- */
function makeCtx(counts) {
  var ctx = { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
              textAlign: '', textBaseline: '' };
  ['setTransform', 'clearRect', 'beginPath', 'arc', 'moveTo', 'lineTo',
   'closePath', 'fill', 'stroke', 'fillText', 'setLineDash', 'arcTo', 'rect',
   'fillRect', 'strokeRect', 'save', 'restore'].forEach(function (m) {
    ctx[m] = function () { counts[m] = (counts[m] || 0) + 1; };
  });
  ctx.measureText = function (s) { return { width: String(s).length * 6 }; };
  return ctx;
}
function makeCanvas() {
  var counts = {}, listeners = {};
  return {
    _counts: counts, _listeners: listeners,
    width: 0, height: 0, style: {}, clientWidth: 340,
    getContext: function () { return makeCtx(counts); },
    getBoundingClientRect: function () {
      return { left: 0, top: 0, width: 340, height: 340 };
    },
    addEventListener: function (t, fn) {
      (listeners[t] = listeners[t] || []).push(fn);
    },
    fire: function (t, ev) {
      (listeners[t] || []).forEach(function (fn) { fn(ev || {}); });
    }
  };
}
var canvasEl = makeCanvas();
global.document = {
  getElementById: function (id) { return id === 'tp' ? canvasEl : null; }
};
global.devicePixelRatio = 2;

/* ---------- localStorage 스텁 ---------- */
global.localStorage = (function () {
  var d = {};
  return {
    getItem: function (k) { return (k in d) ? d[k] : null; },
    setItem: function (k, v) { d[k] = String(v); },
    removeItem: function (k) { delete d[k]; },
    get length() { return Object.keys(d).length; },
    key: function (i) { return Object.keys(d)[i]; }
  };
})();

/* ---------- 모듈 로드 ---------- */
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));
require(path.join(DIR, 'js', 'charts.js'));
var Charts = global.RDCharts;
var Storage = require(path.join(DIR, 'js', 'storage.js'));

/* ---------- 경량 GPX 파서 (selftest-wind.js 와 동일) ---------- */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var sM = inner.match(/<speed>([^<]+)<\/speed>/);
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]), ele: 0,
      time: tM ? Date.parse(tM[1]) : null,
      speed: sM ? parseFloat(sM[1]) : null
    });
  }
  var wt = pts.filter(function (p) { return p.time != null; }).length;
  var ws = pts.filter(function (p) { return p.speed != null; }).length;
  return {
    tracks: [{ name: 'selftest', segments: [pts] }], pointCount: pts.length,
    trackName: 'selftest', hasTime: wt >= pts.length * 0.5,
    speedSource: ws >= pts.length * 0.5 ? 'device' : 'derived'
  };
}

/* ---------- 미니 러너 ---------- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('=== 통합 폴라(§A1) · 커리어 패널(§A2) self-test ===\n');

/* ============================================================
 * A1) 통합 폴라 — 3곡선 + 호버
 * ============================================================ */
console.log('[A1] 통합 폴라 — 한 폴라에 세션 P/S 실선 + 타깃 점선');
var xml = fs.readFileSync(
  path.join(DIR, 'sample', 'sample-songjeong-busan.gpx'), 'utf8');
var session = An.normalizeSession(parseGPX(xml));
var analysis = An.analyzeSession(session, 200, {});
check('송정 GPX 분석 — 풍각 폴라 산출(port·starboard·combined)',
  analysis.polar && analysis.polar.port && analysis.polar.starboard &&
  analysis.polar.combined);

var profile = An.sessionPolarProfile(session, 200);
var target = An.buildTargetPolar([profile], { basis: 'single-session' });
check('타깃 폴라 곡선 구축', target && target.bins && target.bins.length > 0);

/* 세션 곡선과 타깃 곡선이 같은 반경 지표인지 — 둘 다 풍각별 속도(m/s).
   호환 전제(Danny §A1) 확인: 두 곡선의 속도 스케일이 같은 자릿수. */
var sesMax = 0;
analysis.polar.combined.forEach(function (b) {
  if (b.count >= 2 && b.p95Ms > sesMax) sesMax = b.p95Ms;
});
var tgtMax = 0;
target.bins.forEach(function (b) {
  if (b.speedMs != null && b.speedMs > tgtMax) tgtMax = b.speedMs;
});
check('세션·타깃 곡선이 같은 반경 지표(풍각별 속도 m/s)로 호환',
  sesMax > 0 && tgtMax > 0 && tgtMax / sesMax > 0.3 && tgtMax / sesMax < 3,
  'session=' + sesMax.toFixed(2) + ' target=' + tgtMax.toFixed(2));

/* 렌더 — 예외 없이 3곡선이 그려지는지(stroke·fillText 호출 발생) */
var threw = false;
try {
  Charts.renderTargetPolar('tp',
    { polar: analysis.polar, target: target, comparison: null },
    { unit: 'kt' });
} catch (e) { threw = true; console.log('      예외: ' + e.message); }
check('renderTargetPolar 예외 없이 실행', !threw);
check('폴라 곡선이 그려졌다(stroke 호출 발생)',
  (canvasEl._counts.stroke || 0) > 5, 'stroke=' + canvasEl._counts.stroke);
check('축·라벨이 그려졌다(fillText 호출 발생)',
  (canvasEl._counts.fillText || 0) > 5);
check('점선 곡선이 쓰인다(setLineDash 호출 — 타깃 점선)',
  (canvasEl._counts.setLineDash || 0) > 0);

/* 호버 — mousemove 가 예외 없이 곡선 강조 재렌더를 일으키는지 */
var strokeBefore = canvasEl._counts.stroke;
var hoverThrew = false;
try {
  canvasEl.fire('mousemove', { clientX: 170, clientY: 90 });
  canvasEl.fire('mousemove', { clientX: 90, clientY: 170 });
} catch (e) { hoverThrew = true; console.log('      예외: ' + e.message); }
check('호버(mousemove) 예외 없이 처리', !hoverThrew);
check('호버 시 폴라가 다시 그려진다(강조 재렌더)',
  canvasEl._counts.stroke > strokeBefore);
var leaveThrew = false;
try { canvasEl.fire('mouseleave', {}); }
catch (e) { leaveThrew = true; }
check('mouseleave 예외 없이 처리', !leaveThrew);

/* 풍향 없는 데이터로 호출해도 안전(폴라 null) */
var safeNoPolar = true;
try {
  Charts.renderTargetPolar('tp', { polar: null, target: target }, { unit: 'kt' });
} catch (e) { safeNoPolar = false; }
check('polar 없이 호출해도 예외 없음(타깃만 그림)', safeNoPolar);

/* ============================================================
 * A2) 커리어 누적 패널 — careerStats · personalBests
 * ============================================================ */
console.log('\n[A2] 커리어 누적 — 누적 합계 · 최고 기록 · 평균');

/* 빈 상태 */
check('저장 세션 0 — careerStats null', Storage.careerStats() === null);
check('저장 세션 0 — personalBests null', Storage.personalBests() === null);

/* 세 세션 시드 — 누적 집계가 정확한지 검증 */
var seed = [
  { id: 'rd_a', name: '강릉 1회차', dateEpoch: 1000,
    distanceM: 12000, movingTimeSec: 3600, durationSec: 4200,
    maxSpeedMs: 14, peak2sMs: 14, peak10sMs: 13, best500mMs: 12, best1nmMs: 11,
    alphaMs: 9, avgSpeedMovingMs: 7.5, hasTrack: true },
  { id: 'rd_b', name: '송정 2회차', dateEpoch: 2000,
    distanceM: 20000, movingTimeSec: 5400, durationSec: 6000,
    maxSpeedMs: 19, peak2sMs: 19, peak10sMs: 18, best500mMs: 17, best1nmMs: 15,
    alphaMs: 12, avgSpeedMovingMs: 9, hasTrack: false },
  { id: 'rd_c', name: '송정 3회차', dateEpoch: 3000,
    distanceM: 8000, movingTimeSec: 1800, durationSec: 2200,
    maxSpeedMs: 16, peak2sMs: 16, peak10sMs: 15, best500mMs: 14, best1nmMs: 13,
    alphaMs: 13, avgSpeedMovingMs: 8, hasTrack: true }
];
global.localStorage.setItem('rd_sessions_v1', JSON.stringify(seed));

var career = Storage.careerStats();
check('누적 횟수 = 3', career && career.sessionCount === 3);
check('누적 거리 = 40,000 m (12k+20k+8k)',
  career && career.totalDistanceM === 40000, career && career.totalDistanceM);
check('누적 시간 = 10,800 초 (3600+5400+1800)',
  career && career.totalMovingSec === 10800, career && career.totalMovingSec);
check('평균 속도 = 누적거리 ÷ 누적시간 (40000/10800)',
  career && near(career.avgSpeedMs, 40000 / 10800, 1e-6),
  career && career.avgSpeedMs);
check('평균 거리 = 누적거리 ÷ 세션수 (40000/3)',
  career && near(career.avgDistanceM, 40000 / 3, 1e-6));

var pb = Storage.personalBests();
check('최고 속도 = 19 m/s (송정 2회차)',
  pb && pb.maxSpeedMs && pb.maxSpeedMs.value === 19);
check('최고 기록이 세운 세션 id 를 담는다(타일 클릭 이동 근거)',
  pb && pb.maxSpeedMs && pb.maxSpeedMs.sessionId === 'rd_b');
check('최고 기록이 hasTrack 을 담는다(이동 가능 여부)',
  pb && pb.maxSpeedMs && pb.maxSpeedMs.hasTrack === false &&
  pb.alphaMs && pb.alphaMs.hasTrack === true);
check('10초 Peak 최고 = 18 (송정 2회차)',
  pb && pb.peak10sMs && pb.peak10sMs.value === 18 &&
  pb.peak10sMs.sessionId === 'rd_b');
check('최장 거리 = 20,000 m (송정 2회차)',
  pb && pb.distanceM && pb.distanceM.value === 20000);

/* ============================================================
 * A2-회귀) 최고 기록 구간 — analysis 가 구간 인덱스를 제공하는지
 * (app.js bestRecordSegment 가 의존하는 필드 존재 확인)
 * ============================================================ */
console.log('\n[A2-2] 최고 기록 구간 — 지도 강조에 쓸 인덱스 존재');
check('summary.maxSpeedIdx 존재(최고 속도 구간)',
  analysis.summary && analysis.summary.maxSpeedIdx != null);
var p10 = (analysis.peaks || []).filter(function (x) {
  return x.windowSec === 10;
})[0];
check('peaks 10초 항목에 startIdx 존재', p10 && p10.startIdx != null);
var d500 = (analysis.distanceBests || []).filter(function (x) {
  return x.distanceM === 500;
})[0];
check('distanceBests 500m 항목에 startIdx·endIdx 존재',
  d500 && d500.startIdx != null && d500.endIdx != null);

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail === 0 ? 0 : 1);
