/* §477 2차원 지표 격자 — 시간가중·공백 제외·얇은 칸 */
var RD = __dirname;
global.window = global;
global.RDGeo = require(RD + '/js/geo.js');
var An = require(RD + '/js/analysis.js');
var BT = require(RD + '/js/bin-table.js');
var F = require(RD + '/js/formula.js');
var fs = require('fs');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); } }
function cell(t, r, c) { return t.grid[r][c]; }

console.log('§477 bin table');

/* 합성: 풍향 0°. 앞 100초 풍상 45°(P) 10kt, 뒤 100초 풍하 135°(P) 20kt */
function synth() {
  var S = [], t = 0;
  function push(n, twa, kt, hr) {
    for (var i = 0; i < n; i++) {
      S.push({ t: t++, lat: 35, lng: 129, speed: kt / 1.94384,
               heading: twa, twa: Math.abs(twa) > 180 ? 360 - Math.abs(twa) : Math.abs(twa),
               vmg: (kt / 1.94384) * Math.cos(Math.abs(twa) * Math.PI / 180),
               hr: hr, cumDist: 0 });
    }
  }
  push(100, 45, 10, 140);
  push(100, 135, 20, 170);
  return { samples: S, legs: [{ start: 0, end: S.length - 1 }], cfg: { gapThresholdSec: 8 } };
}
var s = synth();

var t1 = BT.build(s, { rowDim: 'zone', colDim: 'tack', metric: 'speed', windDir: 0 });
ok('격자 생성', t1 != null);
ok('행 = 풍상·풍하', t1.rows.map(function (r) { return r.key; }).join(',') === 'up,down',
   t1.rows.map(function (r) { return r.key; }).join(','));
ok('열 = 포트 한쪽뿐 (모두 P)', t1.cols.length === 1 && t1.cols[0].key === 'P',
   t1.cols.map(function (c) { return c.key; }).join(','));
ok('풍상 셀 = 10kt', Math.abs(cell(t1, 0, 0).value - 10) < 0.01, String(cell(t1, 0, 0).value));
ok('풍하 셀 = 20kt', Math.abs(cell(t1, 1, 0).value - 20) < 0.01, String(cell(t1, 1, 0).value));
ok('열 주변합 = 시간가중 평균 15kt',
   Math.abs(t1.colTotals[0].value - 15) < 0.05, String(t1.colTotals[0].value));

/* 시간 가중: 풍하 구간을 3배 길게 → 주변합이 20 쪽으로 끌린다 */
var s2 = synth();
for (var k = 0; k < 200; k++) s2.samples.push({
  t: 200 + k, lat: 35, lng: 129, speed: 20 / 1.94384, heading: 135, twa: 135,
  vmg: (20 / 1.94384) * Math.cos(135 * Math.PI / 180), hr: 170, cumDist: 0 });
s2.legs = [{ start: 0, end: s2.samples.length - 1 }];
var t2 = BT.build(s2, { rowDim: 'zone', colDim: 'tack', metric: 'speed', windDir: 0 });
ok('시간 가중 — 긴 구간이 주변합을 끈다',
   t2.colTotals[0].value > 16, t2.colTotals[0].value.toFixed(2));

/* 기록 공백은 시간으로 세지 않는다 */
var s3 = synth();
for (var i = 100; i < 200; i++) s3.samples[i].t += 600;   /* 10분 공백 */
s3.legs = [{ start: 0, end: 99 }, { start: 100, end: 199 }];
var t3 = BT.build(s3, { rowDim: 'zone', colDim: 'tack', metric: 'time', windDir: 0 });
var totalMin = t3.rowTotals.reduce(function (a, x) { return a + (x.value || 0); }, 0);
ok('공백 10분이 시간에 안 들어간다', totalMin < 5, totalMin.toFixed(2) + ' min');

/* 얇은 칸 */
var thin = BT.build(s, { rowDim: 'zone', colDim: 'tack', metric: 'speed',
                         windDir: 0, minSeconds: 500 });
ok('최소 시간에 못 미치면 값을 내지 않는다', cell(thin, 0, 0).value === null);
ok('얇아도 초는 남긴다', cell(thin, 0, 0).seconds > 0 && cell(thin, 0, 0).thin === true);

/* 비중은 합이 100 */
var sh = BT.build(s, { rowDim: 'zone', colDim: 'tack', metric: 'share', windDir: 0 });
var sum = sh.rowTotals.reduce(function (a, x) { return a + (x.value || 0); }, 0);
ok('비중 합 = 100%', Math.abs(sum - 100) < 0.01, sum.toFixed(3));

/* 축 조건 */
var noWind = BT.build(s, { rowDim: 'zone', colDim: 'tack', metric: 'speed', windDir: null });
ok('풍향 없으면 택 축은 못 만든다', noWind === null || !noWind.cols.length);
var noHr = BT.build(s, { rowDim: 'hrzone', colDim: 'zone', metric: 'speed',
                         windDir: 0, maxHr: null });
ok('최대심박 없으면 HR존 축은 못 만든다', noHr === null || !noHr.rows.length);
var hrOk = BT.build(s, { rowDim: 'hrzone', colDim: 'zone', metric: 'speed',
                         windDir: 0, maxHr: 190 });
ok('최대심박 있으면 HR존 축이 선다', hrOk && hrOk.rows.length >= 1,
   hrOk ? hrOk.rows.map(function (r) { return r.label; }).join(',') : 'null');

/* 최소 속도 게이트 */
var slow = synth();
slow.samples.forEach(function (p) { p.speed = 2 / 1.94384; });
ok('전부 느리면 격자가 없다',
   BT.build(slow, { rowDim: 'zone', colDim: 'tack', metric: 'speed',
                    windDir: 0, minSpeedKt: 8 }) === null);

/* 수식 지표 */
var der = BT.build(s, { rowDim: 'zone', colDim: 'tack', metric: '__derived',
                        windDir: 0,
                        derived: { label: 'speed/hr*100', unit: '', dp: 2,
                                   value: F.compile('speed / hr * 100').value } });
ok('수식 지표가 격자에 들어간다', der != null && cell(der, 0, 0).value != null);
ok('수식 값 검산 (10kt / 140bpm × 100)',
   Math.abs(cell(der, 0, 0).value - (10 / 140 * 100)) < 0.05,
   String(cell(der, 0, 0).value));

/* 엣지 */
ok('없는 축 이름은 null', BT.build(s, { rowDim: 'nope', colDim: 'tack' }) === null);
ok('표본 부족은 null', BT.build({ samples: [] }, {}) === null);

/* 실데이터 */
var GPX = '/Users/dannyok/Desktop/Waterspeed 2026-08-31T05.53.54.000Z.gpx';
if (fs.existsSync(GPX)) {
  var src = fs.readFileSync(RD + '/../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
  eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));
  var real = An.normalizeSession(parseGpxNode(fs.readFileSync(GPX, 'utf8')));
  var a = An.analyzeSession(real, 218, {});
  var rt = BT.build(real, { rowDim: 'zone', colDim: 'tack', metric: 'vmg',
                            windDir: 218, minSpeedKt: 8 });
  ok('실세션: 2×2 격자', rt.rows.length === 2 && rt.cols.length === 2);
  ok('실세션: 네 칸 모두 값이 있다',
     rt.grid.every(function (r) { return r.every(function (c) { return c.value != null; }); }));
  var q = BT.build(real, { rowDim: 'quarter', colDim: 'zone', metric: 'speed',
                           windDir: 218, minSpeedKt: 8 });
  ok('실세션: 4분위 축', q.rows.length === 4);
  ok('실세션: Q4 가 Q1 보다 느리다 (바람이 죽은 세션)',
     q.rowTotals[3].value < q.rowTotals[0].value,
     q.rowTotals[0].value.toFixed(1) + ' -> ' + q.rowTotals[3].value.toFixed(1));
  var tot = BT.build(real, { rowDim: 'zone', colDim: 'tack', metric: 'share',
                             windDir: 218, minSpeedKt: 8 });
  var s100 = 0;
  tot.grid.forEach(function (r) { r.forEach(function (c) { s100 += (c.raw || 0); }); });
  ok('실세션: 비중 총합 100%', Math.abs(s100 - 100) < 0.5, s100.toFixed(2));
} else { console.log('  SKIP  실데이터 없음'); }

console.log('');
console.log('§477  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
