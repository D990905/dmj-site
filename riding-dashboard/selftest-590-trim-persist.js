/* §590 트랙 제거가 저장되지 않던 것 — §589 비교 검증 중 옥대표 데이터에서 발견

   실측 (옥대표 브라우저, 2026-09-11):
     제3경기  분석 139점 · 저장 트랙 150점 · 목록 1.29 km · 트랙 1.38 km
     제4경기  139 · 156 · 1.34 · 1.46
     제5경기  116 · 129 · 1.12 · 1.24
   저장할 때 숫자(거리·시간·점수)는 **제거한 편집본**에서, 트랙은 **원본 전체**
   에서 뽑았고(samples = CUR.fullSession), 제거 구간은 어디에도 저장하지
   않았다(edited:false 고정). 그래서 다시 열면 제거가 조용히 사라졌다.

   고침: 트랙은 원본 그대로 두고 제거 구간을 레코드에 담는다 → 다시 열 때
   되살린다. 원본이 남아 있으니 'Restore full track' 은 저장 뒤에도 된다.
   이 테스트는 §551 교훈대로 **저장 → 목록 왕복**으로 본다. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }
function env() {
  var store = {};
  var g = { localStorage: { getItem: function (k) { return store[k] === undefined ? null : store[k]; },
      setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; },
      get length() { return Object.keys(store).length; }, key: function (i) { return Object.keys(store)[i]; } },
    console: console, Date: Date, Math: Math, JSON: JSON, isFinite: isFinite, Number: Number,
    String: String, Array: Array, Object: Object, parseInt: parseInt, parseFloat: parseFloat, Promise: Promise };
  g.window = g; g.self = g; vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8'), g);
  return g.RDStorage;
}
var A = { summary: {}, maneuverStats: {} };

console.log('[1] ★★ 저장 → 목록 왕복');
var S = env();
var R = [{ from: 0, to: 11 }, { from: 140.5, to: 149 }];
var first = S.saveSession({ name: '제5경기', dateEpoch: 1789128036638, sig: '116_1120_1', edited: true, excludeRanges: R }, A);
var got = S.listSessions()[0];
ok('★★ 제거 구간이 레코드에 남는다', JSON.stringify(got.excludeRanges) === JSON.stringify(R), JSON.stringify(got.excludeRanges));
ok('★ edited 가 참', got.edited === true);

console.log('\n[2] 다시 저장');
S.saveSession({ name: '제5경기', dateEpoch: 1789128036638, sig: '129_1240_1', edited: false, excludeRanges: null,
                replaceId: first.record.id }, A);
var got2 = S.listSessions();
ok('★★ Restore 후 저장하면 구간이 지워진다 (옛 값이 남지 않는다)', got2.length === 1 && got2[0].excludeRanges === null,
   JSON.stringify(got2[0].excludeRanges));
ok('★ 같은 줄을 잇는다 (사본 없음)', got2[0].id === first.record.id);

console.log('\n[3] 이상한 값은 걸러 낸다 (다시 열 때 엉뚱한 데를 지우지 않게)');
var S3 = env();
S3.saveSession({ name: 'x', dateEpoch: 1, sig: 'a', excludeRanges: [
  { from: 5, to: 2 }, { from: 'a', to: 3 }, null, { from: 1, to: 4 }, { from: '10', to: '12' }] }, A);
var r3 = S3.listSessions()[0].excludeRanges;
ok('★★ 뒤집힌·숫자 아닌·빈 항목 제거, 문자열 숫자는 숫자로', JSON.stringify(r3) === JSON.stringify([{ from: 1, to: 4 }, { from: 10, to: 12 }]),
   JSON.stringify(r3));
var S4 = env();
S4.saveSession({ name: 'y', dateEpoch: 1, sig: 'b', excludeRanges: [] }, A);
ok('★ 빈 목록은 null', S4.listSessions()[0].excludeRanges === null);
var S5 = env();
S5.saveSession({ name: 'z', dateEpoch: 1, sig: 'c' }, A);
ok('★ 예전 호출(필드 없음)도 그대로 — null', S5.listSessions()[0].excludeRanges === null);

console.log('\n[4] v2 배선');
var app = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'v2.html'), 'utf8');
var code = app.replace(/\/\*[\s\S]*?\*\//g, '');
ok('★★ edited:false 고정이 사라졌다', !/edited: false,/.test(code));
ok('★★ 저장할 때 CUR.edit 의 구간을 넘긴다', /excludeRanges: \(CUR\.edit && CUR\.edit\.excludeRanges\)/.test(code));
ok('★★ 다시 열 때 되살린다 — 압축 트랙 경로',
   /show\(sess, an2, rec\.name \|\| 'Session', est2\);\s*restoreSavedExclusions\(rec\);/.test(code));
ok('★★ 다시 열 때 되살린다 — GPX 경로', (code.match(/restoreSavedExclusions\(rec\);/g) || []).length === 2);
ok('★ 원본 위에 다시 적용 (Restore 가 저장 뒤에도 됨)', /if \(!R \|\| !R\.length \|\| !CUR\.fullSession\) return;/.test(code)
   && /reapplyEdits\(\);/.test(code));
ok('★★ 비교도 그 세션의 제거 구간을 빼고 잰다', /gs = An\.applyEdits\(gs, \{ excludeRanges: rec\.excludeRanges \}\)/.test(code));
ok('★ 실패는 삼키지 않는다', /\[v2 §590\] restore exclusions/.test(app) && /\[v2 §590\] compare edits/.test(app));
ok('★ storage·v2-app 캐시버스트', /storage\.js\?v=v590/.test(html) && /v2-app\.js\?v=v59\d/.test(html));

console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
