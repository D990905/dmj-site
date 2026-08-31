/* §475 풍속대 × 풍각 폴라 격자 */
global.window = global;
global.RDGeo = require('./js/geo.js');
var An = require('./js/analysis.js');
var fs = require('fs');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); } }

console.log('§475 polar grid');

/* --- 버킷 경계 --- */
ok('9kt → <10', An.twsBucketFor(9).key === 'lt10');
ok('10kt → 10–14 (하한 포함)', An.twsBucketFor(10).key === '10_14');
ok('13.9kt → 10–14', An.twsBucketFor(13.9).key === '10_14');
ok('14kt → 14–18', An.twsBucketFor(14).key === '14_18');
ok('25kt → 18+', An.twsBucketFor(25).key === 'gte18');
ok('풍속 없으면 null', An.twsBucketFor(null) === null && An.twsBucketFor(NaN) === null);

/* --- 격자 --- */
function prof(binDeg, spec) {   /* spec: {binIndex: [count, p90Ms]} */
  var n = Math.ceil(180 / binDeg), bins = [];
  for (var i = 0; i < n; i++) {
    bins.push(spec[i] ? { count: spec[i][0], p90Ms: spec[i][1], p95Ms: spec[i][1] * 1.05 }
                      : { count: 0, p90Ms: 0, p95Ms: 0 });
  }
  return { binDeg: binDeg, bins: bins };
}
var g = An.buildPolarGrid([
  { windSpeedKt: 12, profile: prof(10, { 4: [100, 8], 12: [100, 9] }) },
  { windSpeedKt: 13, profile: prof(10, { 4: [100, 10], 12: [100, 11] }) },
  { windSpeedKt: 20, profile: prof(10, { 4: [100, 12] }) }
]);
ok('격자 생성', g != null && g.buckets.length === 4);
var b1014 = g.buckets.filter(function (b) { return b.key === '10_14'; })[0];
ok('10–14 버킷에 두 세션', b1014.sessionCount === 2, String(b1014.sessionCount));
ok('셀 값 = 표본 가중평균 (8·100 + 10·100)/200 = 9',
   Math.abs(b1014.cells[4].speedMs - 9) < 1e-6, String(b1014.cells[4].speedMs));
var b18 = g.buckets.filter(function (b) { return b.key === 'gte18'; })[0];
ok('18+ 버킷은 따로 집계', Math.abs(b18.cells[4].speedMs - 12) < 1e-6);
ok('다른 버킷의 셀은 안 섞인다', b18.cells[12].speedMs === null);

/* --- 얇은 셀은 비운다 --- */
var thin = An.buildPolarGrid([
  { windSpeedKt: 12, profile: prof(10, { 4: [10, 8] }) }
], { minCellSamples: 30 });
ok('표본 30 미만 셀은 비운다', thin.buckets[1].cells[4].speedMs === null);
ok('비웠어도 표본 수는 남긴다 (숨기지 않음)',
   thin.buckets[1].cells[4].sampleCount === 10 && thin.buckets[1].cells[4].thin === true);

/* --- 옛 기록(p90 없음)은 p95 로 대체하고 표시 --- */
var legacyProf = { binDeg: 10, bins: [] };
for (var i = 0; i < 18; i++) legacyProf.bins.push({ count: i === 4 ? 100 : 0, p95Ms: 9 });
var lg = An.buildPolarGrid([{ windSpeedKt: 12, profile: legacyProf }]);
ok('p90 없는 옛 기록도 p95 로 채운다',
   Math.abs(lg.buckets[1].cells[4].speedMs - 9) < 1e-6);
ok('옛 기록은 legacy 로 표시', lg.buckets[1].cells[4].legacy === true);

/* --- 풍속 없는 세션 --- */
var ub = An.buildPolarGrid([
  { windSpeedKt: null, profile: prof(10, { 4: [100, 8] }) },
  { windSpeedKt: 12, profile: prof(10, { 4: [100, 8] }) }
]);
ok('풍속 없는 세션은 격자에서 빼고 수를 센다', ub.unbucketed === 1);

/* --- 엣지 --- */
ok('빈 입력은 null', An.buildPolarGrid([]) === null && An.buildPolarGrid(null) === null);

/* --- p90 이 프로파일에 실린다 --- */
var GPX = '/Users/dannyok/Desktop/Waterspeed 2026-08-31T05.53.54.000Z.gpx';
if (fs.existsSync(GPX)) {
  var src = fs.readFileSync('../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
  eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));
  var sess = An.normalizeSession(parseGpxNode(fs.readFileSync(GPX, 'utf8')));
  An.analyzeSession(sess, 218, {});
  var pr = An.sessionPolarProfile(sess, 218);
  ok('실세션: 프로파일에 p90 이 있다',
     pr.bins.some(function (b) { return b.p90Ms > 0; }));
  ok('실세션: p90 <= p95 (모든 빈)',
     pr.bins.every(function (b) { return !(b.count) || b.p90Ms <= b.p95Ms + 1e-9; }));
  var rg = An.buildPolarGrid([{ windSpeedKt: 12, profile: pr }]);
  var filled = rg.buckets.filter(function (b) { return b.filled > 0; });
  ok('실세션: 한 버킷만 채워진다', filled.length === 1 && filled[0].key === '10_14',
     filled.map(function (b) { return b.key; }).join(','));
  ok('실세션: 채워진 각도 빈이 여럿', filled[0].filled >= 4, String(filled[0].filled));
} else { console.log('  SKIP  실데이터 없음'); }

console.log('\n§475  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
