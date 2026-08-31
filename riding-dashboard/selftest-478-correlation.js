/* §478 상관 보기 — 창 만들기·r·기울기·교란 경고 */
var RD = __dirname;
global.window = global;
global.RDGeo = require(RD + '/js/geo.js');
var An = require(RD + '/js/analysis.js');
var CO = require(RD + '/js/correlation.js');
var fs = require('fs');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); } }

console.log('§478 correlation');

/* --- 피어슨 --- */
var xs = [1, 2, 3, 4, 5];
ok('완전 양의 상관 r=1',
   Math.abs(CO.pearson(xs, [2, 4, 6, 8, 10]).r - 1) < 1e-9);
ok('완전 음의 상관 r=-1',
   Math.abs(CO.pearson(xs, [10, 8, 6, 4, 2]).r + 1) < 1e-9);
ok('기울기 = 2', Math.abs(CO.pearson(xs, [2, 4, 6, 8, 10]).slope - 2) < 1e-9);
ok('절편', Math.abs(CO.pearson(xs, [3, 5, 7, 9, 11]).intercept - 1) < 1e-9);
ok('상수열은 null (분산 0)', CO.pearson(xs, [5, 5, 5, 5, 5]) === null);
ok('표본 3 미만은 null', CO.pearson([1, 2], [1, 2]) === null);
ok('null 은 짝째 빠진다',
   CO.pearson([1, 2, 3, null], [2, 4, 6, 99]).n === 3);

/* --- 창 만들기 --- */
function synth(n, opts) {
  opts = opts || {};
  var S = [];
  for (var i = 0; i < n; i++) {
    S.push({ t: i, lat: 35, lng: 129,
             speed: (opts.kt || 12) / 1.94384,
             heading: 200, twa: opts.twa || 45,
             vmg: ((opts.kt || 12) / 1.94384) * 0.7,
             hr: opts.hr || 150 });
  }
  return { samples: S, legs: [{ start: 0, end: n - 1 }], cfg: { gapThresholdSec: 8 } };
}
var W = CO.windows(synth(200), { windowSec: 20 });
ok('200초 → 창 10개 안팎', W.length >= 9 && W.length <= 11, String(W.length));
ok('창에 시각이 실린다', W[0].tSec != null && W[W.length - 1].tSec > W[0].tSec);
ok('창 존 = 풍상', W.every(function (w) { return w.zone === 'up'; }));
ok('창 평균 속도 = 12kt', Math.abs(W[0].speed - 12) < 0.01, String(W[0].speed));

var slow = CO.windows(synth(200, { kt: 3 }), { minSpeedKt: 8 });
ok('느린 구간은 창이 안 생긴다', slow.length === 0, String(slow.length));

/* 존이 바뀌면 창이 끊긴다 */
var mixed = synth(200);
for (var i = 100; i < 200; i++) { mixed.samples[i].twa = 135; }
var mw = CO.windows(mixed, { windowSec: 20 });
ok('존이 섞이지 않는다',
   mw.some(function (w) { return w.zone === 'up'; }) &&
   mw.some(function (w) { return w.zone === 'down'; }) &&
   mw.every(function (w) { return w.zone === 'up' || w.zone === 'down'; }));

/* 기록 공백에서 창이 끊긴다 */
var gap = synth(200);
for (var g = 100; g < 200; g++) gap.samples[g].t += 600;
gap.legs = [{ start: 0, end: 99 }, { start: 100, end: 199 }];
var gw = CO.windows(gap, { windowSec: 20 });
ok('공백을 넘는 창은 만들지 않는다',
   gw.every(function (w) { return w.seconds <= 21; }),
   JSON.stringify(gw.map(function (w) { return Math.round(w.seconds); })));

/* --- analyze --- */
/* 각이 커질수록 속도가 떨어지는 인공 세션 */
var ramp = { samples: [], legs: null, cfg: { gapThresholdSec: 8 } };
for (var j = 0; j < 600; j++) {
  var twa = 40 + Math.floor(j / 60) * 5;         /* 40 → 85 */
  var kt = 20 - (twa - 40) * 0.1;               /* 각이 커지면 느려짐 */
  ramp.samples.push({ t: j, lat: 35, lng: 129, speed: kt / 1.94384,
                      heading: 200, twa: twa, vmg: kt / 1.94384 * 0.7, hr: 150 });
}
ramp.legs = [{ start: 0, end: 599 }];
var r1 = CO.analyze(ramp, { xKey: 'twa', yKey: 'speed', zone: 'up' });
ok('음의 상관을 잡는다', r1.fit.r < -0.9, r1.fit.r.toFixed(3));
ok('기울기 ≈ -0.1 kt/°', Math.abs(r1.fit.slope + 0.1) < 0.01, r1.fit.slope.toFixed(4));
ok('설명문에 r 과 창 수가 들어간다',
   /r = -[01]\.\d\d/.test(CO.describe(r1)) && /windows/.test(CO.describe(r1)),
   CO.describe(r1));

/* 창이 적으면 적합하지 않는다 */
var few = CO.analyze(synth(40), { xKey: 'twa', yKey: 'speed' });
ok('창 5개 미만이면 fit 없음', few.fit === null && few.reason === 'too-few-windows');

/* 시간 교란 — x·y 가 둘 다 시간을 따라 움직이는 경우 */
var drift = { samples: [], cfg: { gapThresholdSec: 8 } };
for (var d = 0; d < 600; d++) {
  var f = d / 600;
  drift.samples.push({ t: d, lat: 35, lng: 129,
                       speed: (20 - f * 8) / 1.94384, heading: 200, twa: 45,
                       vmg: 5, hr: 170 - f * 40 });
}
drift.legs = [{ start: 0, end: 599 }];
var rd = CO.analyze(drift, { xKey: 'hr', yKey: 'speed', zone: 'all' });
ok('시간 교란을 경고한다', rd.timeConfounded === true,
   'x~t ' + rd.xVsTime.r.toFixed(2) + '  y~t ' + rd.yVsTime.r.toFixed(2));

/* 정의상 묶인 짝 */
ok('CWA↔VMG 는 항등 짝으로 표시', CO.isIdentityPair('twa', 'vmg'));
ok('속도↔VMG 도 항등 짝', CO.isIdentityPair('speed', 'vmg'));
ok('심박↔속도는 항등 짝 아님', !CO.isIdentityPair('hr', 'speed'));
var ri = CO.analyze(ramp, { xKey: 'twa', yKey: 'vmg', zone: 'up' });
ok('analyze 가 identity 를 실어 준다', ri.identity === true);

/* --- 실데이터 --- */
var GPX = '/Users/dannyok/Desktop/Waterspeed 2026-08-31T05.53.54.000Z.gpx';
if (fs.existsSync(GPX)) {
  var src = fs.readFileSync(RD + '/../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
  eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));
  var real = An.normalizeSession(parseGpxNode(fs.readFileSync(GPX, 'utf8')));
  An.analyzeSession(real, 218, {});
  var RW = CO.windows(real, {});
  ok('실세션: 창 100개 이상', RW.length > 100, String(RW.length));
  ok('실세션: 창마다 20초 안팎',
     RW.every(function (w) { return w.seconds >= 16 && w.seconds <= 21; }));
  var rr = CO.analyze(real, { xKey: 'hr', yKey: 'speed', zone: 'all', windows: RW });
  ok('실세션: 심박↔속도 적합이 나온다', rr.fit != null);
  ok('실세션: n = 창 수', rr.n === RW.length, rr.n + ' vs ' + RW.length);
  var rv = CO.analyze(real, { xKey: 'twa', yKey: 'vmg', zone: 'up', windows: RW });
  ok('실세션: 풍상 CWA↔VMG 는 강한 음의 상관 (정의상)',
     rv.fit.r < -0.8 && rv.identity === true, rv.fit.r.toFixed(2));
  var up = RW.filter(function (w) { return w.zone === 'up'; });
  var dn = RW.filter(function (w) { return w.zone === 'down'; });
  ok('실세션: 풍상·풍하 창이 둘 다 있다', up.length > 20 && dn.length > 20,
     up.length + '/' + dn.length);
} else { console.log('  SKIP  실데이터 없음'); }

console.log('');
console.log('§478  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
