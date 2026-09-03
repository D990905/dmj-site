/* §521 폴라 업그레이드 — Waterspeed 벤치마킹(옥대표 "폴라그램 너무 잘만들었는데?").
   구조는 그쪽이 맞고 통계는 우리가 맞다. 그 '통계가 맞다' 를 검사한다. */
var P = require('./js/chart-polar.js');
var T = P._test;
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

function bins(spec) {           /* spec: [[twaCenter, count, avgKt, p95Kt], ...] */
  return spec.map(function (s) {
    return { twaCenter: s[0], count: s[1], avgMs: s[2] / 1.94384, p95Ms: s[3] / 1.94384 };
  });
}

console.log('[1] 표본이 얇은 각도는 그리지 않는다');
var b = bins([[3.75, 2, 10, 12], [11.25, 30, 14, 18], [18.75, 40, 15, 19]]);
ok('minN=5 면 n=2 인 빈은 빠진다', T.toPoints(b, 'S', 'avg', 5).length === 2);
ok('minN=1 이면 다 들어온다', T.toPoints(b, 'S', 'avg', 1).length === 3);
ok('count 0 은 언제나 빠진다',
   T.toPoints(bins([[3.75, 0, 10, 12]]), 'S', 'avg', 1).length === 0);

console.log('\n[2] 표본 없는 각도에서 선을 **끊는다** (0 으로 잇지 않는다)');
/* 이게 Waterspeed 가 중심까지 곤두박질치는 그 버그다 */
var pts = T.toPoints(bins([
  [3.75, 20, 12, 15], [11.25, 20, 13, 16],
  /* 18.75 · 26.25 는 표본 없음 → 구멍 */
  [33.75, 20, 15, 18], [41.25, 20, 16, 19]
]), 'S', 'avg', 5);
var segs = T.segments(pts, 7.5);
ok('두 도막으로 끊긴다', segs.length === 2, '도막 ' + segs.length);
ok('앞 도막 2점', segs[0].length === 2);
ok('뒤 도막 2점', segs[1].length === 2);
var cont = T.segments(T.toPoints(bins([
  [3.75, 20, 12, 15], [11.25, 20, 13, 16], [18.75, 20, 14, 17]
]), 'S', 'avg', 5), 7.5);
ok('연속이면 한 도막', cont.length === 1);

console.log('\n[3] 최적 각도 — 풍상은 VMG 최대');
/* 40° 에서 VMG 가 최대가 되도록 만든다 */
var up = bins([
  [26.25, 20, 12, 14], [33.75, 20, 15, 17], [41.25, 20, 16.5, 18],
  [48.75, 20, 16.8, 18], [56.25, 20, 16.9, 18], [63.75, 20, 17, 18]
]);
var o = T.optimalAngle(up, 'upwind', 5);
ok('산출된다', o.ok === true, JSON.stringify(o));
ok('VMG 가 최대인 각을 고른다 (30~90° 안에서)',
   Math.abs(o.vmgKt - Math.max.apply(null, up
     .filter(function (x) { return x.twaCenter > 30 && x.twaCenter <= 90; })
     .map(function (x) {
       return x.avgMs * 1.94384 * Math.abs(Math.cos(x.twaCenter * Math.PI / 180));
     }))) < 1e-6);
ok('풍상 범위(<=90°) 안', o.twaDeg <= 90);

console.log('\n[4] ★ 검산 — Waterspeed 의 "풍하 최적각 173°" 를 막는다');
/* 깊은 각에 노이즈로 큰 값이 하나 들어간 경우. 그 빈을 **후보에서 빼고**
   나머지 중 최선을 준다 — 거절해 버리면 멀쩡한 답까지 잃는다. */
var dn = bins([
  [123.75, 20, 16, 19], [131.25, 20, 15.5, 18], [138.75, 20, 15, 18],
  [146.25, 20, 14, 17], [153.75, 20, 13, 16], [161.25, 20, 12, 15],
  [168.75, 30, 25, 30]      /* ← 노이즈. 원래라면 여기가 argmax */
]);
var od = T.optimalAngle(dn, 'downwind', 5);
ok('그래도 답을 준다', od.ok === true, JSON.stringify(od));
ok('데드다운윈드 근처를 고르지 않는다', od.twaDeg < 165, String(od.twaDeg));
ok('**풍하는 속도 기준**이라 제일 빠른 각을 고른다', od.twaDeg === 123.75,
   String(od.twaDeg));
ok('뺀 사실을 넘긴다', !!od.excluded && od.excluded.bins === 1);
ok('뺀 표본 수도', od.excluded.samples === 30);
ok('제일 극단이던 각도 남긴다', od.excluded.extremeTwa === 168.75);
var odClean = T.optimalAngle(dn.slice(0, 6), 'downwind', 5);
ok('노이즈가 없으면 excluded 없음', odClean.ok === true && !odClean.excluded);

console.log('\n[4b] ★ 반대쪽도 막는다 — 풍상 4° 는 어떤 포일도 못 간다');
/* 라이브에서 실제로 나왔던 값(4°, 13표본). 풍하만 막고 풍상은 안 막았던 결함. */
var upNoise = bins([
  [3.75, 13, 14, 16],       /* VMG 13.97 — 원래라면 argmax */
  [41.25, 20, 16, 18], [48.75, 20, 16.2, 18]
]);
var ou = T.optimalAngle(upNoise, 'upwind', 5);
ok('그래도 답을 준다', ou.ok === true, JSON.stringify(ou));
ok('30° 이하를 고르지 않는다', ou.twaDeg > 30, String(ou.twaDeg));
ok('**풍상은 VMG 기준**', ou.twaDeg === 41.25, String(ou.twaDeg));
ok('뺀 사실을 넘긴다', !!ou.excluded && ou.excluded.samples === 13);
ok('경계 상수 30°', T.UPWIND_SANITY_DEG === 30);

/* 말이 되는 각이 하나도 없으면 그때는 숫자를 안 낸다 */
var allBad = T.optimalAngle(bins([[3.75, 20, 12, 14], [11.25, 20, 11, 13]]), 'upwind', 5);
ok('전부 말이 안 되면 산출 거부', allBad.ok === false);
ok('그 이유를 구분해 말한다', allBad.reason === 'only_implausible_high', allBad.reason);

console.log('\n[5] 표본 부족·경계 처리');
ok('전부 얇으면 산출 안 함',
   T.optimalAngle(bins([[41.25, 2, 16, 18]]), 'upwind', 5).ok === false);
ok('그때 이유는 need_more_samples',
   T.optimalAngle(bins([[41.25, 2, 16, 18]]), 'upwind', 5).reason === 'need_more_samples');
ok('빈 입력은 no_data', T.optimalAngle([], 'upwind', 5).reason === 'no_data');
/* 최적이 관측 범위 끝이면 '못 가 본 곳' 이라고 표시 */
var edge = T.optimalAngle(bins([
  [41.25, 20, 17, 19], [48.75, 20, 15, 17], [56.25, 20, 13, 15]
]), 'upwind', 5);
ok('경계면 atEdge 로 표시', edge.ok === true && edge.atEdge === true);
var mid = T.optimalAngle(bins([
  [33.75, 20, 12, 14], [41.25, 20, 17, 19], [48.75, 20, 12, 14]
]), 'upwind', 5);
ok('가운데면 atEdge 아님', mid.ok === true && mid.atEdge === false);

console.log('\n[6] 풍상/풍하 분리');
var mixed = bins([[41.25, 20, 16, 18], [138.75, 20, 15, 18]]);
ok('upwind 는 풍상 빈만 본다', T.optimalAngle(mixed, 'upwind', 5).twaDeg < 90);
ok('downwind 는 풍하 빈만 본다', T.optimalAngle(mixed, 'downwind', 5).twaDeg > 90);

console.log('\n[6b] ★ 지표가 방향에 따라 다르다 (Waterspeed 도 그렇게 한다)');
/* 같은 빈 집합을 풍상/풍하로 다르게 채점하면 답이 달라져야 한다.
   풍하에서 VMG 기준이면 깊은 각이, 속도 기준이면 빠른 각이 이긴다. */
var dnCmp = bins([
  [101.25, 20, 18, 20],     /* 제일 빠름. VMG = 18·|cos101| = 3.5 */
  [146.25, 20, 14, 16]      /* 느리지만 깊음. VMG = 14·|cos146| = 11.6 */
]);
var dcmp = T.optimalAngle(dnCmp, 'downwind', 5);
ok('풍하는 **속도** 가 큰 각을 고른다 (VMG 가 아니라)',
   dcmp.twaDeg === 101.25, String(dcmp.twaDeg));
var upCmp = T.optimalAngle(bins([
  [41.25, 20, 14, 16],      /* VMG 10.5 */
  [78.75, 20, 18, 20]       /* 빠르지만 VMG 3.5 */
]), 'upwind', 5);
ok('풍상은 **VMG** 가 큰 각을 고른다 (속도가 아니라)',
   upCmp.twaDeg === 41.25, String(upCmp.twaDeg));

console.log('\n[7] hexA — 캔버스 채우기용 알파');
ok('#e03131 → rgba', T.hexA('#e03131', 0.2) === 'rgba(224,49,49,0.2)', T.hexA('#e03131', 0.2));
ok('# 없어도 된다', T.hexA('2f9e44', 0.5) === 'rgba(47,158,68,0.5)');
ok('이상한 값은 회색으로 떨어진다', /rgba\(128,128,128/.test(T.hexA('nope', 0.3)));

console.log('\n[8] 상수가 문서와 일치');
ok('MIN_N = 5', T.MIN_N === 5);
ok('풍하 검산 경계 165°', T.DOWNWIND_SANITY_DEG === 165);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
