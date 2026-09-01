/* §504 P/S 분포 — 박스플롯 사분위와 방향 인지 모집단 필터 */
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/js/v2-app.js', 'utf8');

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }

/* drawTackBox 안의 사분위 함수를 그대로 꺼내 쓴다 */
var i = src.indexOf('  function drawTackBox(');
var body = src.slice(i, src.indexOf('\n  }\n', i));
var qSrc = body.slice(body.indexOf('function q('), body.indexOf('var span'));
var q = new Function(qSrc + '\nreturn q;')();

console.log('\n[1] 사분위 — 표준 선형보간');
var v = [1, 2, 3, 4, 5];
ok('p25 = 2', Math.abs(q(v, 0.25) - 2) < 1e-9);
ok('p50 = 3', Math.abs(q(v, 0.5) - 3) < 1e-9);
ok('p75 = 4', Math.abs(q(v, 0.75) - 4) < 1e-9);
ok('짝수개 p50 은 두 값 평균', Math.abs(q([1, 2, 3, 4], 0.5) - 2.5) < 1e-9);
ok('빈 배열 = null', q([], 0.5) === null);

console.log('\n[2] Tukey 수염 — 1.5×IQR 안의 실제 값까지');
/* 이상치가 있어도 수염은 데이터 안에서 멈춰야 한다 */
var w = [10, 11, 12, 13, 14, 15, 16, 40];
var s2 = w.slice().sort(function (a, b) { return a - b; });
var q1 = q(s2, 0.25), q3 = q(s2, 0.75), iqr = q3 - q1;
var hiW = q3 + 1.5 * iqr, wHi = null;
for (var k = s2.length - 1; k >= 0; k--) { if (s2[k] <= hiW) { wHi = s2[k]; break; } }
ok('40 은 수염 밖(이상치)', wHi < 40, '(수염 상단 ' + wHi + ')');
ok('수염이 실제 데이터 값이다', s2.indexOf(wHi) >= 0);

console.log('\n[3] ★ 방향 인지 모집단 필터 — 지표마다 좋은 쪽이 다르다');
/* 소스에서 필터 로직을 그대로 꺼낸다 */
var fi = src.indexOf("if (TDIST.tier !== 'all') {");
var fsrc = src.slice(fi, src.indexOf('var all = pv.concat(sv);', fi));
/* 배포되는 필터 소스를 그대로 실행한다 — 재구현하면 사본을 검사하게 된다 */
var runFilter = (function () {
  var f = new Function('TDIST', 'M', 'pv', 'sv', fsrc + '\nreturn pv;');
  return function (arr, tier, metric, mode) {
    return f({ tier: tier, mode: mode }, metric, arr.slice(), []);
  };
})();
var speeds = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
var top = runFilter(speeds, 't20', 'sog', 'upwind');
ok('속도 Best20% 는 큰 값을 남긴다', Math.min.apply(null, top) >= 17,
   '(' + top.join(',') + ')');
var angles = [42, 44, 46, 48, 50, 52, 54, 56, 58, 60];
var best = runFilter(angles, 't20', 'twa', 'upwind');
ok('풍상 CWA Best20% 는 **작은** 값을 남긴다', Math.max.apply(null, best) <= 46,
   '(' + best.join(',') + ')');
var dwAng = runFilter(angles, 't20', 'twa', 'downwind');
ok('풍하 CWA 는 큰 쪽 (최적각이 비단조라 low 아님)',
   Math.min.apply(null, dwAng) >= 56, '(' + dwAng.join(',') + ')');

console.log('\n[4] 표본이 적으면 자르지 않는다');
var few = [10, 12, 14];
ok('5개 미만은 그대로', runFilter(few, 't20', 'sog', 'upwind').length === 3);
ok('최소 3개는 남긴다',
   runFilter([1,2,3,4,5,6,7,8,9,10], 't20', 'sog', 'upwind').length >= 3);

console.log('\n[5] 회귀 — Best 50% 가 Best 20% 보다 표본이 많다');
var t50 = runFilter(speeds, 't50', 'sog', 'upwind');
var t20 = runFilter(speeds, 't20', 'sog', 'upwind');
ok('t50 > t20 표본수', t50.length > t20.length,
   '(' + t50.length + ' vs ' + t20.length + ')');
ok('t20 중앙값 >= t50 중앙값 (속도)',
   t20[t20.length >> 1] >= t50[t50.length >> 1]);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
