/* §505 풍향 확인 — P/S 대칭으로 최적 풍향 찾기 */
var W = require('./js/wind-confirm.js');
var KT = 1.94384;

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }
function near(a, b, t) { return a != null && Math.abs(a - b) <= (t == null ? 1e-6 : t); }

/* 합성 트랙 — 진짜 풍향 trueWd, 좌우를 각각 angP·angS 로 벌려 탄다 */
function track(trueWd, angP, angS, n, kt) {
  var S = [];
  for (var i = 0; i < (n || 600); i++) {
    var port = (i % 2 === 0);
    var h = trueWd + (port ? -(angP) : (angS));
    S.push({ t: i, heading: ((h % 360) + 360) % 360, speed: (kt || 15) / KT });
  }
  return S;
}

console.log('\n[1] cwaOf / tackOf — 기본');
ok('정풍상은 0°', near(W.cwaOf(200, 200), 0));
ok('정풍하는 180°', near(W.cwaOf(20, 200), 180));
ok('360 경계를 넘어도 맞다', near(W.cwaOf(10, 350), 20));
ok('바람 왼쪽 = 포트', W.tackOf(150, 200) === 'P');
ok('바람 오른쪽 = 스타보드', W.tackOf(250, 200) === 'S');
ok('경계 넘어서도 택 판정', W.tackOf(340, 20) === 'P');

console.log('\n[2] ★ 핵심 — P/S 차이는 풍향 오차의 정확히 2배');
var S = track(200, 50, 50);
[[195, 10], [198, 4], [200, 0], [202, -4], [205, -10]].forEach(function (c) {
  var r = W.asymmetryAt(S, c[0]);
  ok('풍향 ' + c[0] + '° → 차이 ' + c[1] + '°', r && near(r.diff, c[1], 0.01),
     r ? '(실제 ' + r.diff.toFixed(2) + ')' : '(null)');
});

console.log('\n[3] sweep — 어긋난 데서 시작해도 진짜 풍향을 찾는다');
[190, 200, 210, 215].forEach(function (start) {
  var sw = W.sweep(track(200, 50, 50), start, { range: 25, step: 1 });
  ok('시작 ' + start + '° → 200° 를 찾는다', sw.best && sw.best.windDir === 200,
     sw.best ? '(찾은 값 ' + sw.best.windDir + ')' : '(없음)');
});

console.log('\n[4] ⚠ 한계 — 라이더가 비대칭이면 그걸 풍향으로 흡수한다');
/* 진짜 풍향 200° 인데 스타보드를 10° 못 타는 사람.
   이 방법은 205° 를 "최적" 이라고 말한다 — 실제로는 사람 문제다.
   화면이 이 한계를 반드시 말해야 하는 이유. */
var lop = W.sweep(track(200, 45, 55), 200, { range: 20, step: 1 });
ok('비대칭 라이더는 최적이 어긋난다', lop.best && lop.best.windDir === 205,
   lop.best ? '(찾은 값 ' + lop.best.windDir + '° — 진짜는 200°)' : '');
ok('그래도 그 지점의 차이는 0 이다', lop.best && near(lop.best.absDiff, 0, 0.01));

console.log('\n[5] 게이트 — 근거가 모자라면 조용히 빠진다');
ok('한쪽 택만 있으면 null',
   W.asymmetryAt(track(200, 50, 50, 40).filter(function (p, i) { return i % 2 === 0; }), 200) === null);
ok('저속만 있으면 null', W.asymmetryAt(track(200, 50, 50, 600, 4), 200) === null);
ok('풍상이 없으면 null (전부 풍하)', W.asymmetryAt(track(200, 150, 150), 200) === null);
ok('빈 배열은 null', W.asymmetryAt([], 200) === null);

console.log('\n[6] verdict — 입력과 얼마나 떨어졌나');
var sw2 = W.sweep(track(200, 50, 50), 210, { range: 25, step: 1 });
var v = W.verdict(sw2, 210);
ok('최적 200°', v && v.bestDir === 200);
ok('오프셋 −10°', v && near(v.offsetDeg, -10, 0.5), v ? '(' + v.offsetDeg + ')' : '');
ok('5° 넘으면 notable', v && v.notable === true);
var v2 = W.verdict(W.sweep(track(200, 50, 50), 202, { range: 25, step: 1 }), 202);
ok('2° 차이는 notable 아님', v2 && v2.notable === false);

console.log('\n[7] 360° 경계에서 깨지지 않는다');
var wrap = W.sweep(track(5, 50, 50), 355, { range: 20, step: 1 });
ok('풍향 5° 를 355° 에서 찾는다', wrap.best && wrap.best.windDir === 5,
   wrap.best ? '(찾은 값 ' + wrap.best.windDir + ')' : '(없음)');
var vw = W.verdict(wrap, 355);
ok('경계에서 오프셋이 +10 (−350 아님)', vw && near(vw.offsetDeg, 10, 0.5),
   vw ? '(' + vw.offsetDeg + ')' : '');

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
