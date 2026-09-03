/* §511 윙 추천 — 경계 판정과 편안함 크기가 실제로 나오는가 */
global.window = global;
global.RDGeo = require('./js/geo.js');
require('../assets/js/lift-calculator.js');
var An = require('./js/analysis.js');
var Coach = require('./js/coach.js');
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }

var sess = An.normalizeSession(parseGpxNode(
  fs.readFileSync(__dirname + '/sample/sample-ride-gangneung.gpx', 'utf8')));
var wd = An.estimateWindFromTrack(sess).windDir;
var RIDER = { weightKg: 70, skill: '상급-선수', wingM2: 5.0, foilAR: 13.7 };
function wi(wind) {
  var a = An.analyzeSession(sess, wd, { windSpeedKt: wind });
  return Coach.computeWhatIf(a, RIDER, wind);
}

console.log('\n[1] 엔진이 살아 있나');
ok('DMJLift 로드', !!(global.DMJLift && global.DMJLift.upwindSpeed));
var r14 = wi(14);
ok('what-if 산출됨', r14 && r14.ok === true, r14 && r14.missing ? r14.missing.join(',') : '');

console.log('\n[2] ★ 경계 판정 — 스윕 상한에 붙으면 알려야 한다');
/* 약풍에서 모델은 7.4㎡(상한)를 원한다. 그건 답이 아니라
   "우리가 볼 수 있는 범위 밖" 이라는 뜻이다. */
var r10 = wi(10);
ok('10kt 정점이 상한 7.4㎡', r10.recommendedWingM2 === 7.4, String(r10.recommendedWingM2));
ok('10kt 은 경계로 표시된다', r10.optimumAtBoundary === true);
ok('14kt 은 경계가 아니다', r14.optimumAtBoundary !== true,
   '(정점 ' + r14.recommendedWingM2 + '㎡)');
ok('스윕 범위를 같이 준다', r10.sweep && r10.sweep.max === 7.4);

console.log('\n[3] 편안함 크기 — 정점보다 한 사이즈 아래');
[10, 12, 14, 18, 22].forEach(function (w) {
  var r = wi(w);
  if (r.comfortWingM2 == null || r.optimumWingM2 == null) return;
  ok(w + 'kt 편안함 ≤ 정점', r.comfortWingM2 <= r.optimumWingM2,
     r.comfortWingM2 + ' vs ' + r.optimumWingM2);
});

console.log('\n[4] ★ 회귀 — 옥대표 실제 선택이 정점과 편안함 사이에 든다');
/* 코드 주석에 기록된 실제 표: 10→6.5 · 12→6.0 · 14→5.5 · 18→5.0 · 22→4.5.
   두 숫자가 그 값을 감싸면 화면이 정직한 범위를 보여 준다는 뜻이다. */
var REAL = { 10: 6.5, 12: 6.0, 14: 5.5, 18: 5.0, 22: 4.5 };
Object.keys(REAL).forEach(function (w) {
  var r = wi(+w);
  var lo = Math.min(r.comfortWingM2, r.optimumWingM2);
  var hi = Math.max(r.comfortWingM2, r.optimumWingM2);
  var actual = REAL[w];
  /* 0.5㎡ 여유 — 격자가 0.5 단위다 */
  var inside = actual >= lo - 0.5 && actual <= hi + 0.5;
  ok(w + 'kt: 실제 ' + actual + '㎡ 가 [' + lo + ', ' + hi + '] 안', inside);
});

console.log('\n[5] 강풍은 정점이 실제와 맞는다 (모델이 잘 하는 구간)');
ok('18kt 정점 = 실제 5.0㎡', wi(18).recommendedWingM2 === 5.0);
ok('22kt 정점 = 실제 4.5㎡', wi(22).recommendedWingM2 === 4.5);

console.log('\n[6] 게이트 — 입력이 모자라면 조용히 빠진다');
var a14 = An.analyzeSession(sess, wd, { windSpeedKt: 14 });
ok('풍속 없으면 ok:false', Coach.computeWhatIf(a14, RIDER, null).ok === false);
ok('체중 없으면 ok:false',
   Coach.computeWhatIf(a14, { skill: '상급', wingM2: 5, foilAR: 13.7 }, 14).ok === false);
ok('윙 크기 없으면 ok:false',
   Coach.computeWhatIf(a14, { weightKg: 70, skill: '상급', foilAR: 13.7 }, 14).ok === false);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
