/* §520 V2 — 세션별 장비 (옥대표 1순위).
   핵심 규칙:
     ① 저장 레코드에 장비가 **스냅샷**으로 박힌다 (참조가 아니다)
     ② 지난 세션에 나중에 채워 넣을 수 있고, 그건 backfilled 로 구분된다
     ③ 프로필 장비를 바꿔도 지난 세션의 라벨은 안 흔들린다 */
var fs = require('fs'), path = require('path'), vm = require('vm');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

var store = {};
var g = {
  localStorage: {
    getItem: function (k) { return store[k] === undefined ? null : store[k]; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  console: console, Date: Date, Math: Math, JSON: JSON, isFinite: isFinite,
  Number: Number, String: String, Array: Array, Object: Object,
  parseInt: parseInt, parseFloat: parseFloat
};
g.window = g; g.self = g;
vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8'), g);
var S = g.RDStorage;
var A = { summary: {}, maneuverStats: {} };

console.log('[1] 저장할 때 장비가 레코드에 박힌다');
var gear = { handWing: 'sonic_50', handWingName: 'PPC Sonic 5.0', wingM2: 5.0,
             frontWing: 'r6v2', frontWingName: 'Levitaz R6 V2', foilAR: 12.9 };
var r1 = S.saveSession({ name: 'A', dateEpoch: Date.parse('2026-08-01'), gear: gear }, A);
ok('저장된다', r1.ok === true);
ok('gear 가 담긴다', r1.record.gear && r1.record.gear.handWingName === 'PPC Sonic 5.0');
ok('면적도 담긴다', r1.record.gear.wingM2 === 5.0);
ok('포일 종횡비도 담긴다', r1.record.gear.foilAR === 12.9);
ok('저장 시점 스냅샷은 backfilled 가 아니다', !r1.record.gear.backfilled);

console.log('\n[2] 스냅샷이다 — 원본을 바꿔도 안 따라 변한다');
gear.handWingName = 'CHANGED';
gear.wingM2 = 99;
var back = S.listSessions().filter(function (r) { return r.id === r1.record.id; })[0];
ok('이름이 안 따라 바뀐다', back.gear.handWingName === 'PPC Sonic 5.0',
   back.gear.handWingName);
ok('면적도 안 따라 바뀐다', back.gear.wingM2 === 5.0, String(back.gear.wingM2));

console.log('\n[3] 장비 없이 저장한 세션 = null');
var r2 = S.saveSession({ name: 'B', dateEpoch: Date.parse('2026-08-02') }, A);
ok('gear 가 null', r2.record.gear === null);
var r3 = S.saveSession({ name: 'C', dateEpoch: Date.parse('2026-08-03'), gear: 'oops' }, A);
ok('객체가 아니면 거절하고 null', r3.record.gear === null);

console.log('\n[4] 지난 세션에 나중에 채워 넣기');
var res = S.setSessionGear(r2.record.id,
  { handWing: 'sonic_60', handWingName: 'PPC Sonic 6.0', wingM2: 6.0 });
ok('채워진다', res.ok === true, JSON.stringify(res));
var b2 = S.listSessions().filter(function (r) { return r.id === r2.record.id; })[0];
ok('값이 들어갔다', b2.gear.handWingName === 'PPC Sonic 6.0');
ok('**backfilled 로 구분된다**', b2.gear.backfilled === true);
ok('언제 채웠는지 남는다', typeof b2.gear.backfilledAt === 'number');

var b1 = S.listSessions().filter(function (r) { return r.id === r1.record.id; })[0];
ok('저장 시점 것은 여전히 backfilled 아님', !b1.gear.backfilled);

console.log('\n[5] 거부 — 근거 없이 쓰지 않는다');
ok('id 없으면 거부', S.setSessionGear(null, { handWing: 'x' }).ok === false);
ok('없는 id 면 거부', S.setSessionGear('nope', { handWing: 'x' }).ok === false);
var cleared = S.setSessionGear(r2.record.id, null);
ok('null 을 주면 지운다', cleared.ok === true
   && S.listSessions().filter(function (r) { return r.id === r2.record.id; })[0].gear === null);

console.log('\n[6] JSON 왕복 후에도 살아남는다 (실제 저장 경로)');
var raw = JSON.parse(store['rd_sessions_v1']);
var kept = raw.filter(function (r) { return r.id === r1.record.id; })[0];
ok('디스크에도 있다', kept.gear && kept.gear.handWingName === 'PPC Sonic 5.0');

console.log('\n[7] 화면 코드에 규칙이 박혀 있다');
var src = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
ok('저장할 때 스냅샷을 넘긴다', /gear: gearSnapshot\(\)/.test(src));
ok('스냅샷 함수가 이름까지 뜬다', /handWingName: nameOf\(RDGear\.HAND_WINGS/.test(src));
ok('목록에 Gear 열이 있다', /'Date', 'Name', 'Gear', 'Distance'/.test(src));
ok('비면 채워넣기 버튼', /openGearBackfill\(r\)/.test(src));
ok('나중에 채운 것은 화면에도 표시', /added later/.test(src));
ok('시즌 흐름에 장비 필터', /TREND\.gear = gsel\.value \|\| null/.test(src));
ok('장비 2종 미만이면 필터를 안 띄운다', /gearList\.length >= 2/.test(src));
ok('라벨 없는 세션 수를 말한다', /no gear recorded/.test(src));

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
