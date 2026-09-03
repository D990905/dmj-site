/* §516 — dateEpoch 이 숫자가 아니면 시즌 흐름 그래프가 통째로 죽는다.
   증상이 조용해서(표·정렬·y축은 다 정상) 원인을 화면에서 못 읽었다.
   원천(파서)·병목(analysis)·저장(storage) 세 겹을 다 검사한다. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

console.log('[1] 파서 세 개가 time 을 **같은 타입**으로 낸다 (epoch ms 숫자)');
var ws = fs.readFileSync(path.join(__dirname, 'js/parsers/waterspeed-csv.js'), 'utf8');
var rb = fs.readFileSync(path.join(__dirname, 'js/parsers/racebox-csv.js'), 'utf8');
var gx = fs.readFileSync(path.join(__dirname, 'js/gpx-parser.js'), 'utf8');
ok('waterspeed 가 Date 객체를 안 만든다', !/var time = new Date\(/.test(ws),
   'new Date( 가 남아 있다');
ok('waterspeed 가 ms 숫자를 쓴다', /var time = ms;/.test(ws));
ok('racebox 는 Date.parse 숫자', /Date\.parse/.test(rb));
ok('gpx 는 Date.parse 숫자', /Date\.parse/.test(gx));
/* time 을 숫자로 바꾸면 그걸 Date 로 쓰던 소비자가 깨진다 —
   실제로 waterspeed 파서 안에서 startDate 를 만들던 줄이 깨졌다.
   같은 파일 안의 소비자부터 검사한다. */
ok('waterspeed 가 time 을 Date 로 오해하지 않는다',
   !/points\[0\]\.time\.toISOString/.test(ws));
ok('startDate 는 new Date(...) 로 감싼다',
   /new Date\(points\[0\]\.time\)\.toISOString/.test(ws));

console.log('\n[2] analysis 가 startEpoch 을 숫자로 고정한다');
var an = fs.readFileSync(path.join(__dirname, 'js/analysis.js'), 'utf8');
ok('Number() 로 감싼다', /session\.startEpoch = \(t0 == null\) \? null : Number\(t0\);/.test(an));

console.log('\n[3] storage — 쓸 때 숫자로, 읽을 때 되돌린다');
var store = {};
var g = {
  localStorage: {
    getItem: function (k) { return store[k] === undefined ? null : store[k]; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  console: console, Date: Date, Math: Math, JSON: JSON, isFinite: isFinite,
  Number: Number, String: String, Array: Array, Object: Object, parseInt: parseInt,
  parseFloat: parseFloat
};
g.window = g; g.self = g;
vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8'), g);
var S = g.RDStorage;

var ISO = '2026-08-31T05:53:54.000Z', MS = Date.parse(ISO);

/* 이미 저장된 나쁜 레코드 — 옥대표 브라우저에 실제로 이런 게 6개 있었다 */
store['rd_sessions_v1'] = JSON.stringify([
  { id: 'a', dateEpoch: ISO,             name: 'Waterspeed', distanceM: 47250 },
  { id: 'b', dateEpoch: new Date(MS - 86400000).toISOString(), name: 'W2', distanceM: 26000 }
]);
var list = S.listSessions();
ok('읽으면 숫자로 복구된다', typeof list[0].dateEpoch === 'number',
   typeof list[0].dateEpoch);
ok('값이 보존된다', list.filter(function (r) { return r.id === 'a'; })[0].dateEpoch === MS);
ok('산술이 된다 (그래프 x 축)',
   isFinite(list[0].dateEpoch / 1000) && isFinite(list[1].dateEpoch / 1000));
ok('정렬이 실제로 된다', list[0].dateEpoch < list[1].dateEpoch);

/* 쓸 때 — Date 객체가 들어와도 숫자로 저장 */
store['rd_sessions_v1'] = JSON.stringify([]);
var r1 = S.saveSession({ name: 'Date 객체', dateEpoch: new Date(MS) },
                       { summary: {}, maneuverStats: {} });
ok('Date 객체를 넘겨도 저장은 숫자', typeof r1.record.dateEpoch === 'number',
   typeof r1.record.dateEpoch);
ok('그 값이 맞다', r1.record.dateEpoch === MS);
var r2 = S.saveSession({ name: 'ISO 문자열', dateEpoch: ISO },
                       { summary: {}, maneuverStats: {} });
ok('ISO 문자열을 넘겨도 숫자', typeof r2.record.dateEpoch === 'number');
ok('그 값도 맞다', r2.record.dateEpoch === MS);
var r3 = S.saveSession({ name: '쓰레기', dateEpoch: 'not a date' },
                       { summary: {}, maneuverStats: {} });
ok('파싱 불가면 now 로 떨어진다', typeof r3.record.dateEpoch === 'number'
   && isFinite(r3.record.dateEpoch));

/* 직렬화 왕복 — 이게 원래 터진 지점이다 */
var round = JSON.parse(JSON.stringify(r1.record));
ok('JSON 왕복 후에도 숫자', typeof round.dateEpoch === 'number',
   'Date 객체였다면 여기서 문자열이 됐다');

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
