/* §473 세로 스택 차트 자가검증 — 시리즈 준비·구간 통계·공백 끊기 */
global.window = global;
global.RDGeo = require('./js/geo.js');
var An = require('./js/analysis.js');
var CS = require('./js/chart-stack.js');
var fs = require('fs');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); } }

console.log('§473 chart-stack');

/* --- 값이 없는 판은 만들지 않는다 --- */
function synth(n, withHr) {
  var S = [];
  for (var i = 0; i < n; i++) {
    S.push({ t: i, lat: 35 + i * 1e-5, lng: 129, speed: 8, heading: 200,
             twa: 45, vmg: 5, hr: withHr ? 140 : null });
  }
  return { samples: S, legs: [{ start: 0, end: n - 1 }], cfg: { gapThresholdSec: 8 } };
}
var noHr = CS.buildSeries(synth(600, false), {});
ok('HR 없으면 HR 판 없음',
   noHr.panels.every(function (p) { return p.key !== 'hr'; }),
   noHr.panels.map(function (p) { return p.key; }).join(','));
var withHr = CS.buildSeries(synth(600, true), {});
ok('HR 있으면 HR 판 생김', withHr.panels.some(function (p) { return p.key === 'hr'; }));
ok('판 순서 = 속도 → VMG → CWA → HR',
   withHr.panels.map(function (p) { return p.key; }).join(',') === 'speed,vmg,twa,hr');

/* --- 모든 판이 같은 x 를 쓴다 --- */
ok('모든 y 길이 = x 길이',
   withHr.y.every(function (a) { return a.length === withHr.x.length; }));

/* --- 공백에서 선이 끊긴다 --- */
var gap = synth(200, false);
for (var i = 100; i < 200; i++) gap.samples[i].t += 600;       /* 10분 공백 */
gap.legs = [{ start: 0, end: 99 }, { start: 100, end: 199 }];
var gs = CS.buildSeries(gap, {});
var hasNull = gs.y[0].some(function (v) { return v === null; });
ok('기록 공백에 null 이 끼어 선이 끊긴다', hasNull);
ok('공백 null 은 정확히 한 곳',
   gs.y[0].filter(function (v) { return v === null; }).length === 1,
   String(gs.y[0].filter(function (v) { return v === null; }).length));

/* --- 다운샘플 --- */
var big = CS.buildSeries(synth(20000, false), { maxPoints: 1000 });
ok('과밀 다운샘플 (<= 1100점)', big.x.length <= 1100, String(big.x.length));

/* --- 구간 통계 --- */
var ser = CS.buildSeries(synth(600, true), {});
var st = CS.rangeStats(ser, 100, 200);
ok('구간 길이 정확', st.durationSec === 100, String(st.durationSec));
ok('구간 평균 속도 = 8 m/s = 15.6kt',
   Math.abs(st.panels[0].avg - 8 * 1.94384) < 0.01, String(st.panels[0].avg));
ok('구간 커버리지 100%', st.panels[0].coverage === 1);
var rev = CS.rangeStats(ser, 200, 100);
ok('드래그 방향이 반대여도 같은 구간', rev.fromSec === 100 && rev.toSec === 200);

/* --- 커버리지: 절반이 빈 구간 --- */
var half = synth(200, true);
for (var k = 0; k < 100; k++) half.samples[k].hr = null;
var hs = CS.rangeStats(CS.buildSeries(half, {}), 0, 199);
var hrP = hs.panels.filter(function (p) { return p.key === 'hr'; })[0];
ok('빈 값이 절반이면 커버리지 ~50%',
   hrP && hrP.coverage > 0.45 && hrP.coverage < 0.55,
   hrP ? hrP.coverage.toFixed(2) : 'no hr panel');

/* --- 기동 집계 --- */
var mans = [{ tSec: 50, type: 'tack' }, { tSec: 150, type: 'gybe' },
            { tSec: 250, type: 'gybe' }, { tSec: 400, type: 'tack' }];
var rm = CS.rangeManeuvers(mans, 100, 300);
ok('구간 안 기동만 센다', rm.tacks === 0 && rm.gybes === 2, JSON.stringify(rm));
ok('빈 목록도 안전', CS.rangeManeuvers(null, 0, 100).total === 0);

/* --- 시계 표기 --- */
ok('시계 표기', CS.fmtClock(0) === '0:00' && CS.fmtClock(125) === '2:05',
   CS.fmtClock(125));

/* --- 실데이터 --- */
var GPX = '/Users/dannyok/Desktop/Waterspeed 2026-08-31T05.53.54.000Z.gpx';
if (fs.existsSync(GPX)) {
  var src = fs.readFileSync('../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
  eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));
  var sess = An.normalizeSession(parseGpxNode(fs.readFileSync(GPX, 'utf8')));
  var a = An.analyzeSession(sess, 218, {});
  var rs = CS.buildSeries(sess, {});
  ok('실세션: 네 판 모두', rs.panels.length === 4,
     rs.panels.map(function (p) { return p.key; }).join(','));
  ok('실세션: 다운샘플 적용', rs.x.length < sess.samples.length);
  var whole = CS.rangeStats(rs, 0, rs.durationSec);
  var avgKt = whole.panels[0].avg;
  ok('실세션: 전구간 평균속도가 요약과 같은 범위(±2kt)',
     Math.abs(avgKt - a.summary.avgSpeedMovingMs * 1.94384) < 2.5,
     avgKt.toFixed(1) + ' vs ' + (a.summary.avgSpeedMovingMs * 1.94384).toFixed(1));
  var rm2 = CS.rangeManeuvers(a.maneuvers, 0, rs.durationSec);
  ok('실세션: 전구간 기동 수 = 분석 기동 수',
     rm2.total === a.maneuvers.length, rm2.total + ' vs ' + a.maneuvers.length);
} else { console.log('  SKIP  실데이터 없음'); }

console.log('\n§473  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
