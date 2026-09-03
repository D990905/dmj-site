/* §527 네임스페이스 합치기 — **사용자 데이터를 옮기는 코드**라 제일 조심스럽다.
   지켜야 할 것 셋:
     ① 대상에 이미 있으면 덮지 않는다
     ② 복사가 검증된 뒤에만 원본을 지운다
     ③ 실패하면 flag 를 안 남겨 다음에 다시 시도한다 */
var fs = require('fs'), path = require('path'), vm = require('vm');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

function mkEnv(uid) {
  var store = {};
  var g = {
    localStorage: {
      getItem: function (k) { return store[k] === undefined ? null : store[k]; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: function (i) { return Object.keys(store)[i]; }
    },
    console: console, Date: Date, Math: Math, JSON: JSON, isFinite: isFinite,
    Number: Number, String: String, Array: Array, Object: Object,
    parseInt: parseInt, parseFloat: parseFloat
  };
  if (uid !== undefined) {
    g.DMJAuth = { currentUserId: function () { return uid; } };
  }
  g.window = g; g.self = g;
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8'), g);
  return { S: g.RDStorage, store: store };
}

console.log('[1] 비로그인 — bare 사일로를 anon 으로 합친다');
var e1 = mkEnv(null);          /* DMJAuth 있음, 로그인 안 됨 */
e1.store['rd_sessions_v1'] = '[{"id":"a"}]';
e1.store['rd_rider_v1'] = '{"weightKg":75}';
e1.store['rd_track_v1_a'] = 'RDTRK1|x';
var r1 = e1.S.mergeBareIntoAnon();
ok('옮겨졌다', r1.migrated === true, JSON.stringify(r1));
ok('세션이 anon 으로', e1.store['rd_anon_sessions_v1'] === '[{"id":"a"}]');
ok('라이더도', e1.store['rd_anon_rider_v1'] === '{"weightKg":75}');
ok('트랙도', e1.store['rd_anon_track_v1_a'] === 'RDTRK1|x');
ok('원본은 지워졌다', e1.store['rd_sessions_v1'] === undefined);

console.log('\n[2] ★ 대상에 이미 있으면 덮지 않는다');
var e2 = mkEnv(null);
e2.store['rd_sessions_v1'] = '[{"id":"bare"}]';
e2.store['rd_anon_sessions_v1'] = '[{"id":"anon"}]';   /* 구 대시보드에서 쓰던 것 */
e2.S.mergeBareIntoAnon();
ok('기존 anon 데이터가 살아 있다', e2.store['rd_anon_sessions_v1'] === '[{"id":"anon"}]',
   e2.store['rd_anon_sessions_v1']);

console.log('\n[3] 로그인 상태에서는 anon 합치기를 하지 않는다');
var e3 = mkEnv('u1');
e3.store['rd_sessions_v1'] = '[{"id":"x"}]';
ok('reason 이 logged-in', e3.S.mergeBareIntoAnon().reason === 'logged-in');

console.log('\n[4] DMJAuth 자체가 없으면(node·구버전) 아무것도 안 한다');
var e4 = mkEnv(undefined);
e4.store['rd_sessions_v1'] = '[{"id":"x"}]';
ok('reason 이 no-auth-layer', e4.S.mergeBareIntoAnon().reason === 'no-auth-layer');
ok('데이터는 그대로', e4.store['rd_sessions_v1'] === '[{"id":"x"}]');

console.log('\n[5] 로그인 — bare 와 anon 을 **둘 다** 사용자 namespace 로');
var e5 = mkEnv('u9');
e5.store['rd_sessions_v1'] = '[{"id":"bare"}]';
e5.store['rd_anon_rider_v1'] = '{"weightKg":80}';
e5.store['rd_anon_track_v1_z'] = 'RDTRK1|z';
var r5 = e5.S.migrateLegacyIfNeeded();
ok('옮겨졌다', r5.migrated === true, JSON.stringify(r5));
ok('bare 세션 → uid', e5.store['rd_u9_sessions_v1'] === '[{"id":"bare"}]');
ok('anon 라이더 → uid', e5.store['rd_u9_rider_v1'] === '{"weightKg":80}');
ok('anon 트랙 → uid', e5.store['rd_u9_track_v1_z'] === 'RDTRK1|z');
ok('anon 원본 제거', e5.store['rd_anon_rider_v1'] === undefined);

console.log('\n[6] bare 가 없어도 anon 은 합친다');
var e6 = mkEnv('u7');
e6.store['rd_anon_sessions_v1'] = '[{"id":"onlyanon"}]';
var r6 = e6.S.migrateLegacyIfNeeded();
ok('합쳐진다', r6.migrated === true, JSON.stringify(r6));
ok('uid 로 옮겨졌다', e6.store['rd_u7_sessions_v1'] === '[{"id":"onlyanon"}]');
ok('reason 이 anon-merged', r6.reason === 'anon-merged');

console.log('\n[7] 로그인 후에도 기존 uid 데이터를 덮지 않는다');
var e7 = mkEnv('u3');
e7.store['rd_u3_sessions_v1'] = '[{"id":"mine"}]';
e7.store['rd_anon_sessions_v1'] = '[{"id":"anon"}]';
e7.S.migrateLegacyIfNeeded();
ok('내 데이터가 이긴다', e7.store['rd_u3_sessions_v1'] === '[{"id":"mine"}]');

console.log('\n[8] 두 번 불러도 안전 (flag)');
var e8 = mkEnv(null);
e8.store['rd_sessions_v1'] = '[{"id":"a"}]';
e8.S.mergeBareIntoAnon();
e8.store['rd_sessions_v1'] = '[{"id":"later"}]';   /* 이후 bare 에 다시 생긴 값 */
var again = e8.S.mergeBareIntoAnon();
ok('두 번째는 건너뛴다', again.reason === 'checked');
ok('anon 은 첫 값 유지', e8.store['rd_anon_sessions_v1'] === '[{"id":"a"}]');

console.log('\n[9] 옮길 게 없으면 조용히 끝낸다');
var e9 = mkEnv(null);
ok('no-source', e9.S.mergeBareIntoAnon().reason === 'no-source');

console.log('\n[10] 읽기 경로가 실제로 합치기를 부른다');
var e10 = mkEnv(null);
e10.store['rd_sessions_v1'] = '[{"id":"q","dateEpoch":1788000000000}]';
var list = e10.S.listSessions();
ok('읽으면 합쳐지고 보인다', list.length === 1 && list[0].id === 'q',
   JSON.stringify(list));
ok('anon 으로 이동했다', e10.store['rd_anon_sessions_v1'] !== undefined);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
