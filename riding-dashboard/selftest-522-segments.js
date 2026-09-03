/* §522 W3 구간 모델 — 다섯 종류를 같은 모양으로. */
var Sg = require('./js/segments.js');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }
function near(a, b, t) { return a != null && Math.abs(a - b) <= t; }

/* 합성 세션: 0-99 풍상(heading 40, 8m/s), 100-109 회전, 110-199 풍하(heading 200, 12m/s) */
function mkS() {
  var S = [], cum = 0;
  for (var i = 0; i < 200; i++) {
    var hd, sp;
    if (i < 100) { hd = 40; sp = 8; }
    else if (i < 110) { hd = 40 + (i - 100) * 16; sp = 4; }
    else { hd = 200; sp = 12; }
    cum += sp;
    S.push({ t: i, heading: hd % 360, speed: sp, cumDist: cum, hr: 150 });
  }
  return S;
}
var S = mkS();

console.log('[1] Legs — 회전과 회전 사이');
var mans = [{ type: 'tack', side: 'P', startIdx: 100, endIdx: 110, apexIdx: 105 }];
var legs = Sg.legsFrom(mans, S.length);
ok('회전 하나면 레그 둘', legs.length === 2, String(legs.length));
ok('첫 레그는 0~100', legs[0].startIdx === 0 && legs[0].endIdx === 100);
ok('둘째 레그는 110~199', legs[1].startIdx === 110 && legs[1].endIdx === 199);
ok('번호가 1부터', legs[0].no === 1 && legs[1].no === 2);
ok('회전이 없으면 레그 하나', Sg.legsFrom([], S.length).length === 1);
ok('표본이 없으면 빈 배열', Sg.legsFrom(mans, 0).length === 0);

/* ★ 회전이 바짝 붙으면 그 사이는 레그가 아니다 — 표본 서너 개짜리 빈틈이
   레그로 잡히면 개수가 부풀고(라이브에서 52개) 통계가 노이즈가 된다 */
var tight = [
  { startIdx: 10, endIdx: 20 }, { startIdx: 23, endIdx: 33 },  /* 사이 3표본 */
  { startIdx: 100, endIdx: 110 }
];
ok('3표본짜리 빈틈은 레그로 안 센다',
   Sg.legsFrom(tight, 200, 10).length === 3, String(Sg.legsFrom(tight, 200, 10).length));
ok('최소값을 낮추면 다시 잡힌다',
   Sg.legsFrom(tight, 200, 2).length === 4);
ok('번호는 남은 것끼리 1부터 이어진다',
   Sg.legsFrom(tight, 200, 10).map(function (l) { return l.no; }).join(',') === '1,2,3');

console.log('\n[2] Foiling — 임계 이상 연속 구간');
/* 8·12 m/s 는 임계(10) 기준으로 앞은 미달, 뒤는 초과 */
var fs = Sg.foilSections(S, 10, 2);
ok('한 구간', fs.length === 1, String(fs.length));
ok('풍하 구간만 잡힌다', fs[0].startIdx === 110 && fs[0].endIdx === 199);
ok('임계가 0 이면 빈 배열', Sg.foilSections(S, 0, 2).length === 0);

console.log('\n[3] ★ 짧은 딥으로 구간이 쪼개지지 않는다');
/* 파도 하나 넘다 1초 떨어진 경우 — 끊으면 "13번 끊겼다" 가 과장된다 */
var S2 = mkS();
S2[150].speed = 5;                       /* 1초짜리 딥 */
ok('1초 딥은 이어 붙인다', Sg.foilSections(S2, 10, 2).length === 1);
var S3 = mkS();
for (var i = 150; i < 160; i++) S3[i].speed = 5;   /* 10초 떨어짐 */
ok('10초 떨어지면 끊는다', Sg.foilSections(S3, 10, 2).length === 2);

console.log('\n[4] 구간 통계 — 풍상/풍하와 VMG');
var up = Sg.segStats(S, { startIdx: 0, endIdx: 99 }, 220);
/* 풍향 220, 침로 40 → TWA 180 (정풍하)… 이면 안 되므로 풍향 0 으로 본다 */
var up2 = Sg.segStats(S, { startIdx: 0, endIdx: 99 }, 0);
ok('풍향 0·침로 40 → TWA 40', near(up2.avgTwaDeg, 40, 0.5), String(up2.avgTwaDeg));
ok('풍상으로 판정', up2.direction === 'upwind');
ok('VMG = 8·cos40 = 6.13 m/s', near(up2.avgVmgMs, 8 * Math.cos(40 * Math.PI / 180), 0.01),
   String(up2.avgVmgMs));
var dn2 = Sg.segStats(S, { startIdx: 110, endIdx: 199 }, 0);
ok('침로 200 → TWA 160', near(dn2.avgTwaDeg, 160, 0.5), String(dn2.avgTwaDeg));
ok('풍하로 판정', dn2.direction === 'downwind');
ok('풍하 VMG 는 음수', dn2.avgVmgMs < 0, String(dn2.avgVmgMs));
ok('평균 속도 12 m/s', near(dn2.avgSpeedMs, 12, 0.01));
ok('최고 속도 12 m/s', near(dn2.maxSpeedMs, 12, 0.01));
ok('거리 = 89 × 12', near(dn2.distanceM, 89 * 12, 1), String(dn2.distanceM));
ok('평균 심박', near(dn2.avgHr, 150, 0.1));

console.log('\n[5] 풍향이 없으면 VMG 를 만들지 않는다 (0 으로 채우지 않는다)');
var nw = Sg.segStats(S, { startIdx: 0, endIdx: 99 }, null);
ok('avgVmg null', nw.avgVmgMs === null);
ok('avgTwa null', nw.avgTwaDeg === null);
ok('direction null', nw.direction === null);
ok('속도는 그대로 낸다', near(nw.avgSpeedMs, 8, 0.01));

console.log('\n[6] 거부');
ok('빈 구간은 null', Sg.segStats(S, { startIdx: 5, endIdx: 5 }, 0) === null);
ok('뒤집힌 구간도 null', Sg.segStats(S, { startIdx: 50, endIdx: 10 }, 0) === null);
ok('표본 없으면 null', Sg.segStats([], { startIdx: 0, endIdx: 9 }, 0) === null);

console.log('\n[7] W11 각도 변화 — 헤더/리프트');
var Sd = mkS();
/* 뒤로 갈수록 10° 밀리는 구간 */
for (var k = 0; k < 100; k++) Sd[k].heading = 40 + k * 0.1;
var ac = Sg.angleChange(Sd, { startIdx: 0, endIdx: 99 }, 0);
ok('산출된다', ac != null);
ok('밀린 만큼 양수', ac.deltaDeg > 5, String(ac.deltaDeg));
ok('짧으면 산출 안 함', Sg.angleChange(Sd, { startIdx: 0, endIdx: 5 }, 0) === null);
ok('풍향 없으면 산출 안 함', Sg.angleChange(Sd, { startIdx: 0, endIdx: 99 }, null) === null);

console.log('\n[8] W6 포일링 요약');
var sum = Sg.foilSummary(S, Sg.foilSections(S, 10, 2));
ok('구간 수 1', sum.count === 1);
ok('가장 긴 시간 89초', near(sum.longestSec, 89, 0.5), String(sum.longestSec));
ok('가장 긴 거리 1068 m', near(sum.longestM, 89 * 12, 1), String(sum.longestM));
ok('구간 없으면 0', Sg.foilSummary(S, []).count === 0);

console.log('\n[8b] ★ 그 각도를 얼마나 붙잡았나 (옥대표: "순간적인거였겠지?")');
/* 각도 값은 가능·불가능을 못 가른다 — 파도가 판을 바꾼다.
   가르는 것은 지속 시간이다. */
var Sw = mkS();
/* 풍향 0 기준: 침로 40 → TWA 40. 중간에 3초만 침로 5(TWA 5)로 튄다 */
for (var w = 50; w < 53; w++) Sw[w].heading = 5;
var burst = Sg.longestStretchAtTwa(Sw, 0, 3.75, 7.5, 1.5);
ok('순간 구간이 잡힌다', burst.stretches === 1, JSON.stringify(burst));
ok('길이가 2초쯤', near(burst.longestSec, 2, 0.5), String(burst.longestSec));

/* 여러 번 스쳤으면 횟수와 합계가 나온다 */
var Sm = mkS();
[10, 11, 30, 31, 60, 61].forEach(function (i) { Sm[i].heading = 5; });
var many = Sg.longestStretchAtTwa(Sm, 0, 3.75, 7.5, 1.5);
ok('여러 번이면 여러 구간', many.stretches === 3, String(many.stretches));
ok('가장 긴 것은 여전히 짧다', many.longestSec <= 2);
ok('합계는 그보다 크다', many.totalSec > many.longestSec);

/* 오래 붙잡은 각도는 길게 나온다 — 이건 진짜 라인이다 */
var Sl = mkS();
for (var q = 0; q < 60; q++) Sl[q].heading = 5;
var held = Sg.longestStretchAtTwa(Sl, 0, 3.75, 7.5, 1.5);
ok('오래 붙잡으면 길게 나온다', held.longestSec >= 55, String(held.longestSec));

/* 1초 튀어나갔다 돌아온 것은 한 구간으로 센다 */
var Sg2 = mkS();
for (var z = 0; z < 20; z++) Sg2[z].heading = 5;
Sg2[10].heading = 40;                      /* 1초 이탈 */
ok('1초 이탈은 이어 붙인다',
   Sg.longestStretchAtTwa(Sg2, 0, 3.75, 7.5, 1.5).stretches === 1);

ok('없는 각도는 0', Sg.longestStretchAtTwa(Sw, 0, 176.25, 7.5, 1.5).stretches === 0);
ok('풍향 없으면 null', Sg.longestStretchAtTwa(Sw, null, 3.75, 7.5, 1.5) === null);

console.log('\n[9] build — 다섯 종류가 같은 모양으로 나온다');
var a = { maneuvers: [
  { type: 'tack', side: 'P', startIdx: 100, endIdx: 110, apexIdx: 105 },
  { type: 'gybe', side: 'S', startIdx: 140, endIdx: 148, apexIdx: 144 }
], runs: { runs: [{ startIdx: 110, endIdx: 199 }] } };
var opts = { analysis: a, samples: S, foilThresholdMs: 10, dipSec: 2 };
['leg', 'run', 'tack', 'gybe', 'foiling'].forEach(function (k) {
  var segs = Sg.build(k, opts);
  ok(k + ' 가 나온다', segs.length > 0, String(segs.length));
  ok(k + ' 모양이 같다', segs.every(function (x) {
    return x.kind === k && x.no > 0 && x.startIdx != null && x.endIdx != null;
  }));
});
ok('tack 은 tack 만', Sg.build('tack', opts).length === 1);
ok('gybe 는 gybe 만', Sg.build('gybe', opts).length === 1);
ok('모르는 종류는 빈 배열', Sg.build('nope', opts).length === 0);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
