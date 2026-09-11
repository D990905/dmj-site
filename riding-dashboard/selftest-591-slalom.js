/* §591 슬라럼·레이스 분석 (옥대표 "슬라럼 경기에서는 폴라그램이 별로 의미가 없어
   보이고 ... 따로 분석할만한 꺼리를 찾아서 추가", "고")

   고정 자료: 2026-09-11 제2~6경기 회전 정점의 **상대 배치**(m)와 속도.
   실제 좌표는 공개 저장소에 올리지 않는다 — 임의 원점(10°N, 20°E)으로 옮겼다.
   라이브에서 옥대표 브라우저로 돌린 결과와 같은 답이 나와야 한다:
     부표 A(3경기) B(5) C(5) D(3) · C 탈출 편차 4.8 kt · B→C→D 이론상 46 s,
     실제 최고 제4경기 48 s → 2 s. */
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }
var SL = require('./js/slalom.js');

var O = { lat: 10, lng: 20 };
function P(dy, dx) { return { lat: O.lat + dy / 111000, lng: O.lng + dx / (111000 * Math.cos(O.lat * Math.PI / 180)) }; }
/* [dy, dx, t(s), 진입, 최저, 탈출] */
var RAW = {
  r2: [[55.5, 9.0, 60, 17.7, 16.1, 18.3], [-55.5, 108.2, 80, 18.8, 14.1, 15.1], [-288.6, -36.1, 113, 18.4, 14.7, 14.9]],
  r3: [[199.8, 72.2, 20, 17.2, 14.8, 20.8], [-22.2, -9.0, 45, 20.0, 16.3, 20.0], [-77.7, 99.2, 60, 20.0, 14.5, 16.1]],
  r4: [[-11.1, -27.1, 40, 21.3, 15.6, 20.2], [-88.8, 99.2, 57, 20.5, 15.7, 19.5], [-310.8, -27.1, 88, 19.2, 14.8, 13.4]],
  r5: [[190, 80, 30, 18.4, 15.1, 20.3], [11.1, 0, 53, 20.4, 16.4, 18.6], [-66.6, 99.2, 68, 19.1, 15.0, 18.9]],
  r6: [[222, 135, 15, 19.3, 19.7, 18.7], [66.6, 36.1, 37, 18.4, 16.0, 18.8], [-22.2, 135.3, 53, 18.7, 14.9, 14.7], [-300, -30, 92, 19.0, 13.9, 13.9]]
};
function races() {
  return Object.keys(RAW).map(function (k) {
    return { key: k, apexes: RAW[k].map(function (a) {
      var p = P(a[0], a[1]);
      return { lat: p.lat, lng: p.lng, t: a[2], cumM: a[2] * 9.3, entryKt: a[3], minKt: a[4], exitKt: a[5] };
    }) };
  });
}
function run(ref) {
  var rs = races();
  var all = SL.clusterMarks(rs);
  var marks = SL.labelMarks(all, rs, ref || 'r6');
  var rnd = SL.roundings(rs, marks);
  var per = SL.markToMark(rs, marks);
  return { rs: rs, marks: marks, rnd: rnd, per: per, best: SL.bestLine(per, rs, ref || 'r6') };
}

console.log('[1] ★★ 부표 찾기 — 옥대표 9/11 배치');
var R = run('r6');
var sig = R.marks.map(function (m) { return m.label + m.raceCount; }).join(' ');
ok('★★ A3 B5 C5 D3 (라이브 결과와 같다)', sig === 'A3 B5 C5 D3', sig);
ok('★★ 120 m 떨어진 B 와 C 는 합치지 않는다 (같은 경기가 둘 다 돈다)',
   SL._hav(R.marks[1], R.marks[2]) > 100 && R.marks[1].raceCount === 5 && R.marks[2].raceCount === 5);
/* 둘째 단계가 왜 필요한가 — B 의 두 무리는 반경보다 멀다 */
var bA = [RAW.r2[0], RAW.r6[1]].map(function (a) { return P(a[0], a[1]); });
var bB = [RAW.r3[1], RAW.r4[0], RAW.r5[1]].map(function (a) { return P(a[0], a[1]); });
function mean(ps) { return { lat: ps.reduce(function (s, p) { return s + p.lat; }, 0) / ps.length,
                            lng: ps.reduce(function (s, p) { return s + p.lng; }, 0) / ps.length }; }
ok('★ (근거) B 의 두 무리 중심은 반경 75 m 보다 멀다 — 둘째 단계 없이는 갈린다',
   SL._hav(mean(bA), mean(bB)) > SL.MARK_RADIUS_M, SL._hav(mean(bA), mean(bB)).toFixed(0) + ' m');
ok('★ 이름은 기준 경기가 처음 도는 순서', R.marks.map(function (m) { return m.label; }).join('') === 'ABCD');

console.log('\n[2] ★★ 부표별 회전');
var C = R.rnd[2];
ok('★★ C 탈출 편차 4.8 kt', Math.abs(C.exitSpreadKt - 4.8) < 1e-9, String(C.exitSpreadKt));
ok('★★ C 최고 탈출 = 제4경기 19.5', C.bestExit.key === 'r4' && C.bestExit.v === 19.5);
ok('★★ C 최저 탈출 = 제6경기 14.7', C.worstExit.key === 'r6' && C.worstExit.v === 14.7);
var widest = R.rnd.reduce(function (a, b) { return (b.exitSpreadKt || 0) > (a.exitSpreadKt || 0) ? b : a; });
ok('★★ 가장 들쭉날쭉한 부표는 C', widest.mark === 'C');
ok('★ 안 돈 부표는 비어 있다 (제3경기는 D 없음)', R.rnd[3].cells.r3 === null);

console.log('\n[3] ★★ 부표 사이 · 이론상 최고');
var legs6 = R.per.r6.map(function (s) { return s.key + ' ' + s.sec; }).join(', ');
ok('★ 제6경기 구간: A→B 22, B→C 16, C→D 39', legs6 === 'A→B 22, B→C 16, C→D 39', legs6);
/* 기준 = 보고 있는 경기(제6경기)가 돈 순서 전체 — A→B→C→D */
ok('★★ 기준 순서는 보고 있는 경기 전체: A→B, B→C, C→D', R.best.sequence.join(' ') === 'A→B B→C C→D', R.best.sequence.join(' '));
ok('★★ 이론상 68 s = A→B 제6경기 22 + B→C 제3경기 15 + C→D 제4경기 31', R.best.possibleSec === 68
   && R.best.bestSegments.map(function (b) { return b.race; }).join(',') === 'r6,r3,r4', JSON.stringify(R.best.bestSegments));
ok('★★ 제6경기 77 s → 그 선보다 9 s', R.best.ref && R.best.ref.sec === 77 && R.best.refGainSec === 9,
   JSON.stringify(R.best.ref));
ok('★ 다른 경기는 넷 다 돈 적 없다 — 조각으로 만든 선이라고 밝힐 수 있다', R.best.othersCompleted === 0);
/* 제4경기를 기준으로 보면 — B→C→D */
var R4 = run('r4');
/* 이름은 기준 경기가 도는 순서로 다시 붙는다 — 제4경기 기준이면 옛 B·C·D 가 A·B·C */
ok('★★ 제4경기 기준: 두 구간, 이론상 46 s, 제4경기 48 s (2 s)', R4.best.sequence.length === 2
   && R4.best.possibleSec === 46 && R4.best.ref.sec === 48 && R4.best.refGainSec === 2,
   R4.best.sequence.join(' ') + ' ' + R4.best.possibleSec + ' ' + JSON.stringify(R4.best.ref));
ok('★ 제4경기 기준 글자: A→B, B→C', R4.best.sequence.join(' ') === 'A→B B→C');
ok('★ 제4경기 기준 다른 완주: 제2·6경기', R4.best.othersCompleted === 2);
/* 기준 경기에 구간이 없으면 가장 긴 공통 순서로 */
var rsX = races(); var mkX = SL.labelMarks(SL.clusterMarks(rsX), rsX, 'r6'); var perX = SL.markToMark(rsX, mkX);
perX.none = [];
ok('★ 기준 경기에 구간이 없으면 두 경기 이상이 다 돈 가장 긴 순서로', (function () {
  var bl = SL.bestLine(perX, rsX, 'none'); return bl && bl.sequence.length === 2 && !bl.ref; })());
/* 탈출 → 다음 구간 */
var c6 = C.cells.r6, c4 = C.cells.r4;
var cd6 = R.per.r6.filter(function (s) { return s.key === 'C→D'; })[0].sec;
var cd4 = R.per.r4.filter(function (s) { return s.key === 'C→D'; })[0].sec;
ok('★★ C 를 빨리 나온 경기가 D 에 먼저 닿는다 (19.5 kt → 31 s, 14.7 kt → 39 s)',
   c4.exitKt > c6.exitKt && cd4 < cd6, c4.exitKt + '/' + cd4 + ' vs ' + c6.exitKt + '/' + cd6);

/* 다른 코스 경기 */
var rsO = races(); rsO.push({ key: 'r1', name: '제1경기', apexes: [P(900, 900), P(1400, 300)].map(function (p, i) {
  return { lat: p.lat, lng: p.lng, t: i * 60, cumM: i * 600, entryKt: 18, minKt: 12, exitKt: 12 }; }) });
var fakeAn = function (r) { return r; };
var mkO = SL.labelMarks(SL.clusterMarks(rsO), rsO, 'r6');
ok('★★ 다른 코스(제1경기)는 공유 부표가 없다', !mkO.some(function (m) { return m.visits.some(function (v) { return v.race === 'r1'; }); }));
var srcA = fs.readFileSync(path.join(__dirname, 'js/slalom.js'), 'utf8');
ok('★★ analyze 는 그런 경기를 표에서 빼고 이름을 돌려준다', /offCourse: offCourse/.test(srcA) && /races: kept/.test(srcA));

console.log('\n[4] 풍향이 틀려도 — 분류가 아니라 정점으로');
var src = fs.readFileSync(path.join(__dirname, 'js/slalom.js'), 'utf8');
ok('★★ 부표 검출이 택/자이브 분류를 걸러 쓰지 않는다',
   !/m\.type === 'gybe'|type !== 'gybe'|filter\([^)]*gybe/.test(src));

console.log('\n[5] 레이스가 아닐 때');
var free = [
  { key: 'f1', apexes: [P(0, 0), P(500, 500)].map(function (p, i) { return { lat: p.lat, lng: p.lng, t: i * 60, cumM: i * 500 }; }) },
  { key: 'f2', apexes: [P(1500, -800), P(-900, 1200)].map(function (p, i) { return { lat: p.lat, lng: p.lng, t: i * 60, cumM: i * 500 }; }) }
];
ok('★★ 흩어진 회전 = 공유 부표 없음 → 카드 안 뜬다', SL.labelMarks(SL.clusterMarks(free), free, 'f1').length === 0);

console.log('\n[6] 배선');
var app = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'v2.html'), 'utf8');
var st = fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8');
ok('★★ v2.html 이 slalom.js 를 v2-app 앞에 싣는다',
   html.indexOf('js/slalom.js') > 0 && html.indexOf('js/slalom.js') < html.indexOf('js/v2-app.js'));
ok('★★ Performance 맨 위에 자리', html.indexOf('id="race-host"') > html.indexOf('id="tab-perf"')
   && html.indexOf('id="race-host"') < html.indexOf('id="chart-meanmax"'));
ok('★★ show() 가 그린다', /try \{ renderRace\(\); \}/.test(app));
ok('★★ 자기 자신·이미 저장된 같은 파일은 비교에서 뺀다',
   /r\.id === CUR\.openedRecId\) return false;/.test(app) && /Math\.abs\(r\.dateEpoch - st0\) < 5000/.test(app));
ok('★ 형제 세션 재분석은 담아 둔다 (풍향·제거구간이 바뀌면 다시)',
   /var key = rec\.id \+ '\|' \+ \(rec\.savedAt \|\| ''\) \+ '\|' \+ \(rec\.windDir != null/.test(app)
   && /JSON\.stringify\(rec\.excludeRanges \|\| null\)/.test(app));
ok('★ 출발·결승선을 모른다고 밝힌다', /Start and finish lines are not known/.test(app));

console.log('\n[7] ★★ 그날 전부에 같은 풍향');
ok('★★ 버튼은 다른 저장 세션이 있을 때만', /if \(others\.length\) \{/.test(app));
ok('★★ 무엇이 바뀌는지 먼저 보여 준다 (confirm)', /window\.confirm\('Save wind direction '/.test(app));
ok('★★ 점수가 옛 풍향 기준이라고 표시한다', /setSessionInputs\(r\.id, \{ windDir: dir, scoreStale: true \}\)/.test(app));
ok('★★ storage 가 scoreStale 을 쓴다', /if \(patch\.scoreStale != null\) arr\[i\]\.scoreStale = !!patch\.scoreStale;/.test(st));
ok('★ 목록에 ↻ 표시', /if \(r\.scoreStale\) \{/.test(app));
ok('★ 비교 카드도 알린다', /if \(rec\.scoreStale\) notes\.push/.test(app));

/* 저장 왕복 — 새로 저장하면 표시가 지워진다 (§551 교훈: 왕복으로 본다) */
var vm = require('vm');
var store = {};
var g = { localStorage: { getItem: function (k) { return store[k] === undefined ? null : store[k]; },
    setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; },
    get length() { return Object.keys(store).length; }, key: function (i) { return Object.keys(store)[i]; } },
  console: console, Date: Date, Math: Math, JSON: JSON, isFinite: isFinite, Number: Number, String: String,
  Array: Array, Object: Object, parseInt: parseInt, parseFloat: parseFloat, Promise: Promise };
g.window = g; g.self = g; vm.createContext(g); vm.runInContext(st, g);
var S = g.RDStorage, A = { summary: {}, maneuverStats: {} };
var rec = S.saveSession({ name: '제2경기', dateEpoch: 1, sig: 's', windDir: 55 }, A).record;
S.setSessionInputs(rec.id, { windDir: 348, scoreStale: true });
var r1 = S.listSessions()[0];
ok('★★ 왕복: 풍향 348 · 표시 켜짐', r1.windDir === 348 && r1.scoreStale === true);
S.saveSession({ name: '제2경기', dateEpoch: 1, sig: 's2', windDir: 348, replaceId: rec.id }, A);
ok('★★ 왕복: 다시 저장하면 표시가 지워진다', !S.listSessions()[0].scoreStale && S.listSessions().length === 1);

console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
