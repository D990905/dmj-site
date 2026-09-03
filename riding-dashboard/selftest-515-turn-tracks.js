/* §515 V11 — 회전 궤적 겹치기.
   순수 기하부(turnPathOn·pathShape)만 떼어 검사한다. 그림은 눈으로 보되,
   "진입침로가 위를 향한다"·"등축"·"반전은 x 만" 은 계산이라 검사할 수 있다. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');

function grab(name) {
  var i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  var depth = 0, started = false;
  for (var j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unterminated: ' + name);
}

var ctx = { KT: 1.943844, Math: Math, console: console };
vm.createContext(ctx);
vm.runInContext('var MPD = 111320;\n' + grab('turnPathOn') + '\n' + grab('pathShape'), ctx);

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
function near(a, b, tol) { return a != null && Math.abs(a - b) <= tol; }

/* 합성 트랙: 부산 위도. 진입침로 hb 로 직진해 오다가 apex 에서 꺾는다. */
var LAT0 = 35.1, LNG0 = 129.2, MPD = 111320;
var COSL = Math.cos(LAT0 * Math.PI / 180);
function move(lat, lng, brgDeg, m) {
  var th = brgDeg * Math.PI / 180;
  return { lat: lat + (m * Math.cos(th)) / MPD,
           lng: lng + (m * Math.sin(th)) / (MPD * COSL) };
}
/* hb 로 들어와 apex 에서 turnDeg 만큼 꺾어 나가는 직선 두 도막 */
function synth(hb, turnDeg, speedMs) {
  var S = [], apexIdx = 20;
  var p = { lat: LAT0, lng: LNG0 };
  /* apex 앞: hb 의 반대 방향으로 20 step 물러난 지점부터 */
  var back = move(LAT0, LNG0, hb + 180, speedMs * apexIdx);
  p = { lat: back.lat, lng: back.lng };
  for (var i = 0; i <= apexIdx; i++) {
    var q = move(back.lat, back.lng, hb, speedMs * i);
    S.push({ t: i, lat: q.lat, lng: q.lng, speed: speedMs });
  }
  var ha = (hb + turnDeg + 360) % 360;
  for (var j = 1; j <= 20; j++) {
    var q2 = move(LAT0, LNG0, ha, speedMs * j);
    S.push({ t: apexIdx + j, lat: q2.lat, lng: q2.lng, speed: speedMs });
  }
  /* §515 정정 — 원점은 **회전 시작점**이다(apex 아님). 합성 트랙에서는
     꺾이는 모서리가 곧 시작점이고, apex 는 그 직후로 둔다. */
  return { S: S, m: { apexIdx: apexIdx + 1, headingBefore: hb, headingAfter: ha,
                      startIdx: apexIdx, endIdx: S.length - 1, side: 'P' } };
}

console.log('[1] 진입침로가 어느 쪽이든 위(+y)를 향한다');
[0, 45, 90, 180, 270, 337].forEach(function (hb) {
  var g = synth(hb, 90, 5);
  var p = ctx.turnPathOn(g.S, g.m, 30);
  /* apex 직전 점(t=-1)은 진입선 위, x≈0 이고 y<0 (아직 apex 에 못 옴) */
  var pre = p.filter(function (q) { return near(q.t, -5, 0.01); })[0];
  ok('hb=' + hb + '° 진입이 x≈0', pre && Math.abs(pre.x) < 0.05,
     pre ? 'x=' + pre.x.toFixed(3) : 'no pt');
  ok('hb=' + hb + '° 진입이 y<0 (아래에서 위로 온다)', pre && pre.y < -1,
     pre ? 'y=' + pre.y.toFixed(2) : '');
});

console.log('\n[2] 회전 시작점이 원점, apex 는 그 위에 찍힌다');
var g1 = synth(30, 90, 5);
var p1 = ctx.turnPathOn(g1.S, g1.m, 30);
var st = p1.filter(function (q) { return q.t === 0; })[0];
ok('시작점 x=0', near(st.x, 0, 1e-6));
ok('시작점 y=0', near(st.y, 0, 1e-6));
ok('apex 가 한 점에만 표시된다',
   p1.filter(function (q) { return q.apex; }).length === 1);
ok('apex 는 시작점보다 나중', p1.filter(function (q) { return q.apex; })[0].t > 0);

console.log('\n[3] 등축 — 침로가 달라도 같은 거리는 같은 길이');
var d0 = null;
[0, 45, 90, 200].forEach(function (hb) {
  var g = synth(hb, 90, 5);
  var p = ctx.turnPathOn(g.S, g.m, 30);
  var a5 = p.filter(function (q) { return near(q.t, -5, 0.01); })[0];
  var dist = Math.sqrt(a5.x * a5.x + a5.y * a5.y);
  if (d0 == null) d0 = dist;
  ok('hb=' + hb + '° 5초 전 거리 = 25 m', near(dist, 25, 0.5), dist.toFixed(2));
});

console.log('\n[4] 꺾는 방향이 x 부호로 나온다');
var right = ctx.turnPathOn(synth(0, 90, 5).S, synth(0, 90, 5).m, 30);
var left  = ctx.turnPathOn(synth(0, -90, 5).S, synth(0, -90, 5).m, 30);
var rEnd = right[right.length - 1], lEnd = left[left.length - 1];
ok('우선회는 x>0', rEnd.x > 10, rEnd.x.toFixed(1));
ok('좌선회는 x<0', lEnd.x < -10, lEnd.x.toFixed(1));
ok('두 방향이 좌우 대칭', near(rEnd.x, -lEnd.x, 0.5) && near(rEnd.y, lEnd.y, 0.5));

console.log('\n[5] pathShape — 폭과 경로길이');
var sh = ctx.pathShape(right);
ok('폭 = 최대 |x|', near(sh.widthM, Math.abs(rEnd.x), 0.01), sh.widthM.toFixed(2));
/* 합성 트랙은 apex 앞 20초 + 뒤 20초 = 40초, 5 m/s → 200 m */
ok('경로길이 ≈ 200 m (40초 × 5 m/s)', near(sh.travelM, 200, 6), sh.travelM.toFixed(1));
var straight = ctx.turnPathOn(synth(0, 0, 5).S, synth(0, 0, 5).m, 30);
ok('직진은 폭 0', near(ctx.pathShape(straight).widthM, 0, 0.05));

console.log('\n[6] 거부 — 근거 없으면 안 그린다');
ok('headingBefore 없으면 null',
   ctx.turnPathOn(g1.S, { startIdx: 20, apexIdx: 21, headingBefore: null }, 30) === null);
ok('startIdx 없으면 null', ctx.turnPathOn(g1.S, { headingBefore: 0 }, 30) === null);
ok('좌표 없으면 null',
   ctx.turnPathOn([{ t: 0, lat: null, lng: null }], { startIdx: 0, headingBefore: 0 }, 30) === null);
ok('점이 4개 미만이면 null',
   ctx.turnPathOn(g1.S, g1.m, 1) === null || ctx.turnPathOn(g1.S, g1.m, 1).length >= 4);

console.log('\n[7] pad 가 창을 실제로 자른다');
var wide = ctx.turnPathOn(g1.S, g1.m, 30), narrow = ctx.turnPathOn(g1.S, g1.m, 6);
ok('±6s 가 ±30s 보다 짧다', narrow.length < wide.length,
   narrow.length + ' vs ' + wide.length);
/* 창은 대칭이 아니다 — 시작 pad 초 전부터 **끝** pad 초 후까지.
   회전 길이가 회전마다 다르므로 뒤쪽은 duration + pad 까지 간다. */
var dur = g1.S[g1.m.endIdx].t - g1.S[g1.m.startIdx].t;
ok('앞쪽은 -pad 에서 시작', narrow.every(function (q) { return q.t >= -6 - 1e-9; }));
ok('뒤쪽은 duration+pad 까지', narrow.every(function (q) { return q.t <= dur + 6 + 1e-9; }));
ok('실제로 뒤가 더 길다', Math.max.apply(null, narrow.map(function (q) { return q.t; })) > 6);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
