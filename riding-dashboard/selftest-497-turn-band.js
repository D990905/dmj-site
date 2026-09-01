/* §497 회전 비교 밴드 — 사분위 계산과 격자 정렬 자체 검사.
   v2-app.js 는 IIFE 라 export 가 없다. **실제로 배포되는 소스를 잘라내
   그대로 실행**한다 — 테스트용으로 다시 구현하면 배포본이 아니라 사본을
   검사하게 되고, 그건 검사가 아니다. */
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/js/v2-app.js', 'utf8');

function grab(name) {
  var i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('함수를 못 찾음: ' + name);
  var j = src.indexOf('\n  }\n', i);
  if (j < 0) throw new Error('함수 끝을 못 찾음: ' + name);
  return src.slice(i, j + 4);
}

var KT = 1.94384, TURN_PAD_SEC = 12, TURN_STEP = 0.5;
var ctx = { KT: KT, TURN_PAD_SEC: TURN_PAD_SEC, TURN_STEP: TURN_STEP };
var code = grab('quantile') + grab('turnBand') + grab('turnCurveOn')
  + '\nreturn { quantile: quantile, turnBand: turnBand, turnCurveOn: turnCurveOn };';
var F = new Function('KT', 'TURN_PAD_SEC', 'TURN_STEP', code)(KT, TURN_PAD_SEC, TURN_STEP);

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
function near(a, b, tol) { return a != null && Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }

console.log('\n[1] quantile — 선형보간');
ok('p50 홀수개 = 가운데', near(F.quantile([1, 2, 3], 0.5), 2));
ok('p50 짝수개 = 두 값 평균', near(F.quantile([1, 2, 3, 4], 0.5), 2.5));
ok('p25 of 1..5 = 2', near(F.quantile([1, 2, 3, 4, 5], 0.25), 2));
ok('p75 of 1..5 = 4', near(F.quantile([1, 2, 3, 4, 5], 0.75), 4));
ok('p0 = 최소', near(F.quantile([3, 7, 9], 0), 3));
ok('p100 = 최대', near(F.quantile([3, 7, 9], 1), 9));
ok('빈 배열 = null', F.quantile([], 0.5) === null);
ok('한 개면 그 값', near(F.quantile([5], 0.25), 5));

console.log('\n[2] turnBand — x 마다 사분위');
var xs = [0, 1, 2];
var curves = [
  [10, 20, 30],
  [12, 22, 32],
  [14, 24, 34],
  [16, 26, 36],
  [18, 28, 38]
];
var b = F.turnBand(curves, xs);
ok('lo/mid/hi 길이 = xs 길이', b.lo.length === 3 && b.mid.length === 3 && b.hi.length === 3);
ok('x0 중앙값 14', near(b.mid[0], 14));
ok('x0 p25 = 12', near(b.lo[0], 12));
ok('x0 p75 = 16', near(b.hi[0], 16));
ok('lo <= mid <= hi (전 구간)',
  xs.every(function (_, k) { return b.lo[k] <= b.mid[k] && b.mid[k] <= b.hi[k]; }));

console.log('\n[3] 표본이 적으면 밴드를 그리지 않는다');
/* 두 곡선으로 그린 "사분위" 는 사분위가 아니라 그냥 두 점이다.
   이걸 밴드로 그리면 없는 확신을 보여 주게 된다. */
var b2 = F.turnBand([[10, 20, 30], [14, 24, 34]], xs);
ok('n=2 면 lo 전부 null', b2.lo.every(function (v) { return v === null; }));
ok('n=2 면 mid 전부 null', b2.mid.every(function (v) { return v === null; }));
ok('n 카운트는 그대로 2', b2.n.every(function (v) { return v === 2; }));
var b3 = F.turnBand([[10, 20, 30], [14, 24, 34], [12, 22, 32]], xs);
ok('n=3 이면 밴드가 나온다', b3.mid.every(function (v) { return v != null; }));

console.log('\n[4] 부분 결측 — x 마다 따로 센다');
var b4 = F.turnBand([
  [10, 20, null],
  [12, 22, null],
  [14, 24, 34]
], xs);
ok('x0 은 3개라 밴드 있음', b4.mid[0] != null);
ok('x2 는 1개라 밴드 없음', b4.mid[2] === null);
ok('x2 의 n 은 1', b4.n[2] === 1);

console.log('\n[5] turnCurveOn — apex 정렬');
/* 1Hz 로 60초, apex 는 30초. 속도는 apex 에서 골이 지는 V 자. */
var S = [];
for (var i = 0; i < 60; i++) {
  S.push({ t: 1000 + i, speed: (10 + Math.abs(i - 30) * 0.2) / KT });
}
var gx = [];
for (var x = -TURN_PAD_SEC; x <= TURN_PAD_SEC; x += TURN_STEP) gx.push(x);
var ys = F.turnCurveOn(S, { apexIdx: 30 }, gx);
ok('격자 길이와 같다', ys && ys.length === gx.length);
var zero = gx.indexOf(0);
ok('apex(0초) 값이 최소', ys[zero] === Math.min.apply(null, ys.filter(function (v) { return v != null; })));
ok('apex 속도 = 10kt', near(ys[zero], 10, 0.01));
ok('+10초는 12kt', near(ys[gx.indexOf(10)], 12, 0.01));
ok('-10초도 12kt (대칭)', near(ys[gx.indexOf(-10)], 12, 0.01));

console.log('\n[6] 창 밖은 잘라낸다');
/* PAD 12초 밖 샘플이 격자로 새어 들어오면 apex 정렬이 무의미해진다 */
var far = F.turnCurveOn(S, { apexIdx: 5 }, gx);
ok('apex 가 시작 근처면 앞쪽은 null',
  far[0] === null || far[1] === null);
ok('그래도 배열 길이는 유지', far && far.length === gx.length);

console.log('\n[7] 샘플이 모자라면 null 을 돌려준다');
ok('2개짜리 트랙 = null',
  F.turnCurveOn([{ t: 0, speed: 5 }, { t: 1, speed: 5 }], { apexIdx: 0 }, gx) === null);
ok('apexIdx 가 범위 밖 = null',
  F.turnCurveOn(S, { apexIdx: 999 }, gx) === null);

console.log('\n[8] 회귀 — 사분위는 항상 실측 범위 안에 있다');
/* 평균±SD 대신 사분위를 쓴 이유가 이것이다. 한쪽으로 쏠린 분포에서
   평균-SD 는 실제로 관측된 적 없는 값 아래로 내려간다. */
var skew = [[10, 10, 10], [10.2, 10.2, 10.2], [10.4, 10.4, 10.4],
            [10.6, 10.6, 10.6], [30, 30, 30]];  /* 하나가 크게 튄다 */
var bs = F.turnBand(skew, xs);
var vals = skew.map(function (c) { return c[0]; });
var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
ok('p25 가 실측 최소 이상', bs.lo[0] >= lo);
ok('p75 가 실측 최대 이하', bs.hi[0] <= hi);
var mean = vals.reduce(function (a, c) { return a + c; }, 0) / vals.length;
var sd = Math.sqrt(vals.reduce(function (a, c) { return a + (c - mean) * (c - mean); }, 0) / vals.length);
ok('같은 자료에서 평균-SD 는 실측 최소 아래로 내려간다(그래서 안 쓴다)',
  (mean - sd) < lo, '(mean-SD=' + (mean - sd).toFixed(2) + ' < min=' + lo + ')');

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
