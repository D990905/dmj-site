/* §498 트림 요구량 (B1) — 배포되는 소스를 잘라내 그대로 검사한다. */
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/js/v2-app.js', 'utf8');
function grab(name) {
  var i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('못 찾음: ' + name);
  var j = src.indexOf('\n  }\n', i);
  return src.slice(i, j + 4);
}
var bands = src.slice(src.indexOf('  var TRIM_BANDS = ['),
                      src.indexOf('];', src.indexOf('  var TRIM_BANDS = [')) + 2);
var F = new Function(grab('awaAt') + grab('pctOf') + bands +
  '\nreturn { awaAt: awaAt, pctOf: pctOf, TRIM_BANDS: TRIM_BANDS };')();

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }
function near(a, b, t) { return a != null && Math.abs(a - b) <= (t == null ? 1e-6 : t); }

console.log('\n[1] awaAt — 기준점');
/* 정지(V=0)면 겉보기=진짜 */
ok('V=0 이면 AWA = CWA (풍상)', near(F.awaAt(50, 0, 14), 50, 1e-6));
ok('V=0 이면 AWA = CWA (풍하)', near(F.awaAt(135, 0, 14), 135, 1e-6));
ok('정풍상(0°)은 항상 0°', near(F.awaAt(0, 15, 14), 0, 1e-9));
/* 정풍하에서 바람보다 느리면 뒤에서(180°), 빠르면 앞에서(0°) */
ok('정풍하 V<TWS → 180° (뒤에서)', near(Math.abs(F.awaAt(180, 8, 14)), 180, 1e-6));
ok('정풍하 V>TWS → 0° (앞에서 분다)', near(F.awaAt(180, 20, 14), 0, 1e-6));

console.log('\n[2] 빨라지면 겉보기 바람은 앞으로 당겨진다 (단조)');
[50, 90, 135].forEach(function (twa) {
  var prev = Infinity, mono = true;
  for (var v = 6; v <= 28; v += 0.5) {
    var a = F.awaAt(twa, v, 14);
    if (a > prev + 1e-9) mono = false;
    prev = a;
  }
  ok('CWA ' + twa + '° 에서 속도↑ → AWA 단조 감소', mono);
});

console.log('\n[3] ★ 핵심 — 풍하가 풍상보다 훨씬 많이 움직인다');
/* 이 패널의 존재 이유. 같은 속도 변화가 요구하는 붐 이동량 */
[10, 14, 18].forEach(function (tws) {
  var up = Math.abs(F.awaAt(50, 8, tws) - F.awaAt(50, 20, tws));
  var dn = Math.abs(F.awaAt(135, 8, tws) - F.awaAt(135, 20, tws));
  ok('TWS ' + tws + 'kt: 풍하 요구량이 풍상의 3배 이상', dn > up * 3,
     '(풍상 ' + up.toFixed(1) + '° vs 풍하 ' + dn.toFixed(1) + '°)');
});

console.log('\n[4] 풍상 요구량은 풍속에 거의 둔감하다 (기억할 만한 규칙)');
var ups = [8, 10, 12, 14, 16, 18, 20].map(function (tws) {
  return Math.abs(F.awaAt(50, 8, tws) - F.awaAt(50, 20, tws));
});
var mn = Math.min.apply(null, ups), mx = Math.max.apply(null, ups);
ok('TWS 8~20kt 에서 풍상 요구량 편차 3° 이내', (mx - mn) < 3.0,
   '(' + mn.toFixed(1) + '°~' + mx.toFixed(1) + '°)');

console.log('\n[5] ★ 회귀 — 폐기한 순환 지표를 되살리지 않았는지');
/* CWA 를 고정하면 AWA 는 속도의 일대일 함수다. 즉 "AWA 별 속도" 는
   동어반복. 이 성질을 테스트로 박아 둔다 — 나중에 누가 그 차트를
   다시 만들려 하면 여기서 이유를 보게 된다. */
var vs = [], as = [];
for (var v = 7; v <= 25; v += 0.25) { vs.push(v); as.push(F.awaAt(50, v, 14)); }
var uniq = {}, dup = 0;
as.forEach(function (a) { var k = a.toFixed(6); if (uniq[k]) dup++; uniq[k] = 1; });
ok('CWA 고정 시 AWA↔속도는 일대일 (중복 없음 = 동어반복)', dup === 0);
function corr(A, B) {
  var n = A.length, ma = 0, mb = 0;
  A.forEach(function (x) { ma += x; }); B.forEach(function (x) { mb += x; });
  ma /= n; mb /= n;
  var sa = 0, sb = 0, sab = 0;
  for (var i = 0; i < n; i++) { var da = A[i] - ma, db = B[i] - mb; sa += da * da; sb += db * db; sab += da * db; }
  return sab / Math.sqrt(sa * sb);
}
ok('그 상관은 |r| > 0.95 (실측 8/31 세션도 −0.96~−0.99)',
   Math.abs(corr(vs, as)) > 0.95, '(r=' + corr(vs, as).toFixed(3) + ')');

console.log('\n[6] pctOf — 분위');
ok('p50 = 가운데', near(F.pctOf([1, 2, 3], 0.5), 2));
ok('p10/p90 보간', near(F.pctOf([0, 10], 0.1), 1) && near(F.pctOf([0, 10], 0.9), 9));
ok('빈 배열 = null', F.pctOf([], 0.5) === null);

console.log('\n[7] 코스 밴드가 겹치지 않고 이어진다');
var B = F.TRIM_BANDS, gapOk = true;
for (var i = 1; i < B.length; i++) if (B[i].lo !== B[i - 1].hi) gapOk = false;
ok('밴드 경계가 맞물린다', gapOk);
ok('대표각이 각 밴드 안에 있다',
   B.every(function (b) { return b.rep >= b.lo && b.rep < b.hi; }));

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
