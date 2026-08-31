/* §472 전술 지도 자가검증 — 색·굵기·기준선·시프트 부호 */
global.window = global;
global.RDGeo = require('./js/geo.js');
var MT = require('./js/map-tactical.js');
var An = require('./js/analysis.js');
var fs = require('fs');
var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  ' + extra : '')); }
}

console.log('§472 map-tactical');

/* --- 색: 발산형이고 중앙이 중립인가 --- */
var mid = MT.shiftColor(0), lift = MT.shiftColor(-10), head = MT.shiftColor(10);
ok('중립은 회색(R=G=B 근처)', /rgb\((\d+),(\d+),(\d+)\)/.test(mid) &&
   (function () { var m = mid.match(/\d+/g).map(Number);
     return Math.max.apply(null, m) - Math.min.apply(null, m) < 30; })(), mid);
ok('리프트/헤더가 서로 다른 색', lift !== head, lift + ' vs ' + head);
ok('리프트는 청록(B>R)', (function () { var m = lift.match(/\d+/g).map(Number); return m[2] > m[0]; })(), lift);
ok('헤더는 주황(R>B)', (function () { var m = head.match(/\d+/g).map(Number); return m[0] > m[2]; })(), head);
ok('스팬 밖은 포화(클램프)', MT.shiftColor(60) === MT.shiftColor(10));

/* --- 굵기 --- */
ok('평소 압력=3px', MT.widthFor(1) === 3);
ok('압력↑ → 굵어짐', MT.widthFor(1.2) > MT.widthFor(1) && MT.widthFor(0.8) < MT.widthFor(1));
ok('굵기 클램프 1.5~6.5', MT.widthFor(0.01) === 1.5 && MT.widthFor(9) === 6.5);

/* --- 택 판정 (§421 규약: angleDiff(wind,heading) >= 0 = Port) --- */
ok('포트 풍상 버킷', MT.bucketOf(MT.signedTwa(180 + 45, 180)) === 'upP');
ok('스타보드 풍상 버킷', MT.bucketOf(MT.signedTwa(180 - 45, 180)) === 'upS');
ok('포트 풍하 버킷', MT.bucketOf(MT.signedTwa(180 + 135, 180)) === 'downP');

/* --- 시프트 부호: 합성 트랙 --- */
/* 풍상 포트 택을 60초 CWA=50°로 달리다가 40°로 좁혀지면(리프트) 음수여야 한다. */
function synth(cwaSeq, windDir, speedMs) {
  var S = [], t = 0, lat = 35, lng = 129;
  cwaSeq.forEach(function (cwa) {
    for (var i = 0; i < 60; i++) {
      S.push({ t: t++, lat: lat += 1e-5, lng: lng += 1e-5,
               speed: speedMs, heading: (windDir + cwa + 360) % 360 });
    }
  });
  return S;
}
var S1 = synth([50, 50, 50, 40], 180, 8);   /* 8 m/s = 15.6 kt > minKt */
var r1 = MT.classifySeries(S1, 180, { minKt: 8, windowSec: 0 });
ok('기준선 = 중앙 CWA 50°', Math.abs(r1.baselines.upP.twa - 50) < 1.5,
   JSON.stringify(r1.baselines.upP));
var lastDelta = r1.series[r1.series.length - 1].deltaSmooth;
ok('풍상 각이 좁혀지면 리프트(음수)', lastDelta < -5, 'delta=' + lastDelta.toFixed(1));
var S2 = synth([50, 50, 50, 62], 180, 8);
var r2 = MT.classifySeries(S2, 180, { minKt: 8, windowSec: 0 });
ok('풍상 각이 벌어지면 헤더(양수)',
   r2.series[r2.series.length - 1].deltaSmooth > 5,
   'delta=' + r2.series[r2.series.length - 1].deltaSmooth.toFixed(1));
/* 풍하는 부호가 뒤집힌다 — 더 깊이 내려가면(각 ↑) 리프트 */
var S3 = synth([130, 130, 130, 145], 180, 8);
var r3 = MT.classifySeries(S3, 180, { minKt: 8, windowSec: 0 });
ok('풍하는 각이 커지면 리프트(음수)',
   r3.series[r3.series.length - 1].deltaSmooth < -5,
   'delta=' + r3.series[r3.series.length - 1].deltaSmooth.toFixed(1));

/* --- 압력 --- */
var S4 = synth([50, 50, 50, 50], 180, 8);
for (var i = 180; i < S4.length; i++) S4[i].speed = 10;   /* 마지막 구간 +25% */
var r4 = MT.classifySeries(S4, 180, { minKt: 8, windowSec: 0 });
ok('속도가 평소보다 빠르면 압력 > 1',
   r4.series[r4.series.length - 1].pressureSmooth > 1.2,
   r4.series[r4.series.length - 1].pressureSmooth.toFixed(2));

/* --- 게이트 --- */
var slow = synth([50, 50], 180, 2);       /* 3.9 kt < minKt */
var rs = MT.classifySeries(slow, 180, { minKt: 8 });
ok('저속 표본은 분류 제외', rs.series.every(function (c) { return c === null; }));
var tiny = synth([50], 180, 8);           /* 60 표본 — 버킷 n=60 >= 30 */
ok('표본 30 미만 버킷은 기준선 무효',
   MT.classify(tiny[0], { upP: { twa: 50, speed: 15, n: 10 } }, 180, 8) === null);

/* --- 평활은 택을 넘지 않는다 --- */
var S5 = [].concat(synth([50, 50], 180, 8), synth([-50, -50], 180, 8));
for (var k = 0; k < S5.length; k++) S5[k].t = k;
var r5 = MT.classifySeries(S5, 180, { minKt: 8, windowSec: 60 });
var buckets = {};
r5.series.forEach(function (c) { if (c) buckets[c.bucket] = 1; });
ok('포트·스타보드가 각각 분류됨', buckets.upP && buckets.upS, Object.keys(buckets).join(','));

/* --- 실데이터 --- */
var GPX = '/Users/dannyok/Desktop/Waterspeed 2026-08-31T05.53.54.000Z.gpx';
if (fs.existsSync(GPX)) {
  var src = fs.readFileSync('../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
  eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));
  var sess = An.normalizeSession(parseGpxNode(fs.readFileSync(GPX, 'utf8')));
  An.analyzeSession(sess, 218, {});
  var rr = MT.classifySeries(sess.samples, 218, { minKt: 8, windowSec: 20 });
  var st = MT.summarize(rr.series);
  ok('실세션: 네 버킷 모두 채워짐', Object.keys(rr.baselines).length === 4,
     Object.keys(rr.baselines).join(','));
  ok('실세션: 분류 표본 > 3000', st.n > 3000, String(st.n));
  ok('실세션: 리프트/헤더 균형(재중심 검증, 40~60%)',
     st.lift / st.n > 0.3 && st.lift / st.n < 0.6 && st.header / st.n > 0.3,
     'lift ' + (st.lift / st.n * 100).toFixed(0) + '% header ' + (st.header / st.n * 100).toFixed(0) + '%');
  ok('실세션: 풍상 기준 CWA 60~85°',
     rr.baselines.upP.twa > 60 && rr.baselines.upP.twa < 85, String(rr.baselines.upP.twa));
} else {
  console.log('  SKIP  실데이터 GPX 없음');
}

console.log('\n§472  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
