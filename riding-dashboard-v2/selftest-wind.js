/* ============================================================
 * selftest-wind.js — 풍향 다중 소스 추정 self-test
 *
 * 회전 기하 풍향 추정기(estimateWindFromManeuvers)와 다중 소스
 * 결합(buildWindSources)을 번들 샘플 GPX 로 검증한다.
 * 의존성 0 — Node 내장 모듈만 사용한다.
 *
 *   실행:  node selftest-wind.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * GPX 파싱은 lat/lon/time/ele 만 뽑는 경량 정규식 파서를 쓴다
 * (풍향 추정에 필요한 필드 전부 — DOMParser 의존성 회피).
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));

/* --- 경량 GPX 파서 (trkpt lat/lon/time/ele/speed) --- */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var eM = inner.match(/<ele>([^<]+)<\/ele>/);
    var sM = inner.match(/<speed>([^<]+)<\/speed>/);
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]),
      ele: eM ? parseFloat(eM[1]) : null,
      time: tM ? Date.parse(tM[1]) : null,
      speed: sM ? parseFloat(sM[1]) : null
    });
  }
  var withTime = pts.filter(function (p) { return p.time != null; }).length;
  var withSpeed = pts.filter(function (p) { return p.speed != null; }).length;
  return {
    tracks: [{ name: 'selftest', segments: [pts] }],
    pointCount: pts.length, trackName: 'selftest',
    hasTime: withTime >= pts.length * 0.5,
    speedSource: withSpeed >= pts.length * 0.5 ? 'device' : 'derived'
  };
}
function loadSession(file) {
  var xml = fs.readFileSync(path.join(DIR, 'sample', file), 'utf8');
  return An.normalizeSession(parseGPX(xml));
}

/* --- 미니 테스트 러너 --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}
function angDiff(a, b) { return Math.abs(Geo.angleDiff(a, b)); }

console.log('=== 풍향 다중 소스 추정 self-test ===\n');

/* ---------- 1) 송정(부산) — 리칭 위주 세션 ---------- */
console.log('[1] 송정(부산) — 리칭 위주, 풍향 추정이 어려운 세션');
var sj = loadSession('sample-songjeong-busan.gpx');
var sjNogo = An.estimateWindFromTrack(sj);
var sjRot = An.estimateWindFromManeuvers(sj);
check('no-go zone 추정이 산출된다', !!sjNogo, 'null 반환');
check('회전 기하 추정이 산출된다', !!sjRot, 'null 반환');
if (sjNogo && sjRot) {
  console.log('      no-go=' + sjNogo.windDir + '° (' + sjNogo.confidence +
    ') · 회전기하=' + sjRot.windDir + '° (' + sjRot.confidence + ')');
  check('회전 기하 풍향이 정수다',
    Number.isInteger(sjRot.windDir), '값=' + sjRot.windDir);
  check('회전 기하 추정이 no-go(193°)와 ±25° 내',
    angDiff(sjRot.windDir, 193) <= 25, 'Δ=' + angDiff(sjRot.windDir, 193).toFixed(1) + '°');
  check('리칭 세션 — 회전 기하 신뢰도를 정직하게 "낮음"으로 표기',
    sjRot.confidence === '낮음', '신뢰도=' + sjRot.confidence);
  check('리칭 세션 — reachy 플래그 true',
    sjRot.reachy === true, 'reachy=' + sjRot.reachy);
}

/* ---------- 2) 강릉 — 회전이 많은 세션, 두 추정 수렴 ---------- */
console.log('\n[2] 강릉 — 택·자이브가 또렷한 세션, 두 추정 수렴 확인');
var gn = loadSession('sample-ride-gangneung.gpx');
var gnNogo = An.estimateWindFromTrack(gn);
var gnRot = An.estimateWindFromManeuvers(gn);
check('no-go zone 추정이 산출된다', !!gnNogo, 'null 반환');
check('회전 기하 추정이 산출된다', !!gnRot, 'null 반환');
if (gnNogo && gnRot) {
  console.log('      no-go=' + gnNogo.windDir + '° (' + gnNogo.confidence +
    ') · 회전기하=' + gnRot.windDir + '° (' + gnRot.confidence + ')');
  check('두 독립 추정이 ±20° 내로 수렴한다',
    angDiff(gnNogo.windDir, gnRot.windDir) <= 20,
    'Δ=' + angDiff(gnNogo.windDir, gnRot.windDir).toFixed(1) + '°');
  check('깨끗한 세션 — 회전 기하 신뢰도가 "낮음"이 아니다',
    gnRot.confidence !== '낮음', '신뢰도=' + gnRot.confidence);
  check('깨끗한 세션 — reachy 플래그 false',
    gnRot.reachy === false, 'reachy=' + gnRot.reachy);
}

/* ---------- 3) 다중 소스 결합 구조 ---------- */
console.log('\n[3] buildWindSources — 다중 소스 구조 + 교차검증');
var ws = An.buildWindSources({ manualDir: null, nogo: gnNogo, rotation: gnRot });
check('소스 4종(수동·no-go·회전기하·외부날씨)을 모두 담는다',
  ws.sources.length === 4, '개수=' + ws.sources.length);
var ids = ws.sources.map(function (s) { return s.id; }).join(',');
check('소스 id 순서가 manual,nogo,rotation,weather 다',
  ids === 'manual,nogo,rotation,weather', 'ids=' + ids);
var weather = ws.sources.filter(function (s) { return s.id === 'weather'; })[0];
check('외부 날씨 슬롯이 미리 자리잡혀 있다 (available=false)',
  weather && weather.available === false, 'available=' + (weather && weather.available));
check('외부 날씨 슬롯이 placeholder 로 표시된다',
  weather && weather.placeholder === true, 'placeholder=' + (weather && weather.placeholder));
check('강릉 — 교차검증 결과 두 추정이 일치(agree=true)',
  ws.agreement && ws.agreement.agree === true,
  'agreement=' + JSON.stringify(ws.agreement));
check('강릉 — 두 추정 일치로 권장 신뢰도가 "높음"으로 상향',
  ws.recommended && ws.recommended.confidence === '높음',
  '권장 신뢰도=' + (ws.recommended && ws.recommended.confidence));

/* ---------- 4) 과신 방지 — 둘 다 낮음이면 일치해도 올리지 않음 ---------- */
console.log('\n[4] 과신 방지 — 송정처럼 둘 다 "낮음"이면 일치해도 상향 금지');
var wsSj = An.buildWindSources({ manualDir: null, nogo: sjNogo, rotation: sjRot });
check('송정 — 두 추정이 ±20° 내로 일치한다',
  wsSj.agreement && wsSj.agreement.agree === true,
  'agreement=' + JSON.stringify(wsSj.agreement));
check('송정 — 둘 다 "낮음"이라 권장 신뢰도를 올리지 않는다',
  wsSj.recommended && wsSj.recommended.confidence === '낮음',
  '권장 신뢰도=' + (wsSj.recommended && wsSj.recommended.confidence));

/* ---------- 5) 수동 입력 우선 ---------- */
console.log('\n[5] 수동 입력 — 확정값이 있으면 권장 소스로 우선한다');
var wsManual = An.buildWindSources({ manualDir: 210, nogo: gnNogo, rotation: gnRot });
check('수동 확정값이 권장 소스가 된다',
  wsManual.recommended && wsManual.recommended.sourceId === 'manual',
  'sourceId=' + (wsManual.recommended && wsManual.recommended.sourceId));
check('수동 소스가 확정값(210°)을 담는다',
  wsManual.sources[0].id === 'manual' && wsManual.sources[0].windDir === 210,
  'windDir=' + wsManual.sources[0].windDir);
check('수동이 있어도 no-go·회전기하 소스는 비교용으로 유지된다',
  wsManual.sources[1].windDir != null && wsManual.sources[2].windDir != null,
  'nogo=' + wsManual.sources[1].windDir + ' rotation=' + wsManual.sources[2].windDir);

/* ---------- 6) 회귀 — 기존 분석 파이프라인 무손상 ---------- */
console.log('\n[6] 회귀 — analyzeSession 이 풍향 유무와 무관하게 동작');
var okNoWind = true, okWind = true;
try { An.analyzeSession(gn, null, {}); } catch (e) { okNoWind = false; }
try {
  An.analyzeSession(gn, gnRot ? gnRot.windDir : 270,
    { windConfidence: gnRot ? gnRot.confidence : null });
} catch (e) { okWind = false; }
check('풍향 미설정 상태로 analyzeSession 통과', okNoWind);
check('회전 기하 추정 풍향으로 analyzeSession 통과', okWind);

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail === 0 ? 0 : 1);
