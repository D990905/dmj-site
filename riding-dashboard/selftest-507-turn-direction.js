/* §507 회전 방향별 집계 — 배포 소스를 잘라내 검사 */
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/js/v2-app.js', 'utf8');
var W = require('./js/wind-confirm.js');
function grab(name) {
  var i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('못 찾음: ' + name);
  return src.slice(i, src.indexOf('\n  }\n', i) + 4);
}
var KT = 1.94384;
/* 브라우저에서는 RDWindConfirm 이 전역이다 — 여기선 인자로 넣어 준다 */
var F = new Function('KT', 'window', 'RDWindConfirm', 'TURNDIR_MIN_N',
  grab('turnDirGroups') + grab('turnDirFinding') +
  '\nreturn { groups: turnDirGroups, finding: turnDirFinding };')(
  KT, { RDWindConfirm: W }, W, 3);

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }

/* 풍향 200° 기준. 포트택 heading≈150, 스타보드택 heading≈250 */
var WD = 200, H_P = 150, H_S = 250;
function man(type, from, to, loss, rec, minKt, rate) {
  return { type: type,
           headingBefore: from === 'P' ? H_P : H_S,
           headingAfter:  to   === 'P' ? H_P : H_S,
           lossDisplayPct: loss, recoverySec: rec,
           minSpeedMs: minKt / KT, avgTurnRateDegSec: rate,
           efficiency: 100 - (loss || 0) };
}

console.log('\n[1] 방향 판정 — side 가 아니라 heading 으로');
var g1 = F.groups({ maneuvers: [
  man('tack', 'P', 'S', 40, 5, 7, 11),
  man('tack', 'S', 'P', 8, 6, 6, 10)
], windDir: WD }, WD);
ok('두 그룹으로 갈린다', g1.length === 2);
ok('P→S 를 찾는다', g1.some(function (g) { return g.from === 'P' && g.to === 'S'; }));
ok('S→P 를 찾는다', g1.some(function (g) { return g.from === 'S' && g.to === 'P'; }));

console.log('\n[2] 택이 안 바뀌면 회전이 아니다 (버린다)');
var g2 = F.groups({ maneuvers: [
  man('tack', 'P', 'P', 10, 5, 7, 11),   /* 같은 택 → 제외 */
  man('tack', 'P', 'S', 40, 5, 7, 11)
], windDir: WD }, WD);
ok('같은 택 항목은 빠진다', g2.length === 1 && g2[0].n === 1);

console.log('\n[3] 평균 계산');
var g3 = F.groups({ maneuvers: [
  man('gybe', 'S', 'P', 50, 20, 13, 12),
  man('gybe', 'S', 'P', 54, 22, 13, 12)
], windDir: WD }, WD);
ok('n=2', g3[0].n === 2);
ok('평균 손실 52%', Math.abs(g3[0].avgLoss - 52) < 1e-9);
ok('평균 회복 21s', Math.abs(g3[0].avgRec - 21) < 1e-9);

console.log('\n[4] ★ 발견 — 격차를 말한다');
function pair(type, lossA, lossB, n) {
  var m = [];
  for (var i = 0; i < (n || 4); i++) {
    m.push(man(type, 'P', 'S', lossA, 5, 12, 9));
    m.push(man(type, 'S', 'P', lossB, 20, 13, 12));
  }
  return F.finding(F.groups({ maneuvers: m, windDir: WD }, WD));
}
var f1 = pair('gybe', 0, 52);
ok('큰 격차는 말한다', f1.length === 1);
ok('나쁜 쪽 방향을 지목', f1.length && /starboard to port/.test(f1[0].text), f1[0] && f1[0].text.slice(0, 60));
ok('택 속도 문제가 아니라고 구분', f1.length && /turning-direction problem/.test(f1[0].text));

console.log('\n[5] 작은 격차는 굳이 말하지 않는다');
ok('5%p 차이는 침묵', pair('gybe', 20, 25).length === 0);
ok('8%p 이상은 말한다', pair('gybe', 20, 30).length === 1);

console.log('\n[6] 표본이 적으면 비교하지 않는다');
var few = pair('gybe', 0, 52, 1);   /* 그룹당 1개 */
ok('n<3 이면 발견 없음', few.length === 0);
var three = pair('gybe', 0, 52, 3);
ok('n=3 이면 발견 있음', three.length === 1);
ok('그때 n 을 같이 돌려준다', three[0].n === 3);

console.log('\n[7] 게이트');
ok('풍향 없으면 null', F.groups({ maneuvers: [man('tack','P','S',10,5,7,11)] }, null) === null);
ok('heading 없는 항목은 건너뛴다',
   F.groups({ maneuvers: [{ type: 'tack', lossDisplayPct: 10 }], windDir: WD }, WD).length === 0);
ok('빈 매뉴버는 빈 배열', F.groups({ maneuvers: [], windDir: WD }, WD).length === 0);

console.log('\n[8] 회귀 — 강릉 샘플에서 실제로 나온 값');
/* 자이브 P→S 손실 0% vs S→P 52% · 회복 4.3s vs 21.6s.
   같은 자이브인데 방향에 따라 딴판이라는 것이 이 패널의 존재 이유다. */
var real = F.groups({ maneuvers: [
  man('gybe', 'P', 'S', 0, 4.3, 12.6, 8.6), man('gybe', 'P', 'S', 0, 4.3, 12.6, 8.6),
  man('gybe', 'P', 'S', 0, 4.3, 12.6, 8.6), man('gybe', 'P', 'S', 0, 4.3, 12.6, 8.6),
  man('gybe', 'S', 'P', 52, 21.6, 13.1, 11.8), man('gybe', 'S', 'P', 52, 21.6, 13.1, 11.8),
  man('gybe', 'S', 'P', 52, 21.6, 13.1, 11.8), man('gybe', 'S', 'P', 52, 21.6, 13.1, 11.8)
], windDir: WD }, WD);
var fr = F.finding(real);
ok('격차를 잡아낸다', fr.length === 1);
ok('회복 시간도 같이 말한다', fr.length && /21\.6 s/.test(fr[0].text) && /4\.3 s/.test(fr[0].text));

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
