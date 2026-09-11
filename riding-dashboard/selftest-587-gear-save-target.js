/* §587 (옥대표 "오늘경기 모두 v3로 뛰고 다 업데이트 했는데 안바뀌는게 있어. 버그니?")

   스샷: 2026-09-11 제1·2·6경기 = V3 (added later), 제3·4·5경기 = V1 그대로.

   원인: 'Save to this session' 이 저장 레코드를 시그니처(점개수_거리_시작)로
   찾았다. 저장 트랙은 §509 압축이라 손실이 있어, 목록에서 다시 연 세션은
   거리가 달라져 자기 레코드와 시그니처가 안 맞는다 → "Not saved yet",
   아무것도 안 씀.

   라이브 재현 (테스트 브라우저, 옥대표 데이터 아님):
     데모 저장(sig 2950_18445_…) → 새로고침(저장본으로 다시 열림) → 포일 V2
     → 버튼 = "Not saved yet", 레코드 gear = null 그대로. 점 개수는 2950 동일
     → 달라진 건 거리.

   이 테스트는 saveInputsToSession 을 소스에서 떼어 가짜 저장소에 돌린다. */
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }
var app = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'v2.html'), 'utf8');

var m = app.match(/function saveInputsToSession\(btn\) \{[\s\S]*?\n  \}\n/);
ok('★ saveInputsToSession 을 소스에서 떼어 낼 수 있다', !!m);

function run(o) {
  var writes = { gear: [], inputs: [] }, alerts = [];
  var recs = o.recs;
  var env = {
    CUR: { session: { samples: [] }, openedRecId: o.opened || null, windDir: 200 },
    Store: {
      setSessionGear: function (id, g) { writes.gear.push(id); return { ok: true }; },
      setSessionInputs: function (id, p) { writes.inputs.push(id); return { ok: true }; }
    },
    listSessions: function () { return recs; },
    sessionSig: function () { return o.curSig; },
    gearSnapshot: function () { return { frontWing: 'levitaz-r6-v3' }; },
    riderFromFormSynced: function () { return { weightKg: 69, wingM2: 6.5, skill: '중급' }; },
    windSpeedFromForm: function () { return 14; },
    alertLine: function (t) { alerts.push(t); },
    renderInputSources: function () {}, renderSessions: function () {},
    $: function () { return null; }
  };
  var btn = { textContent: 'Save to this session', className: '' };
  var f = new Function('env', 'btn',
    'var CUR = env.CUR, Store = env.Store, listSessions = env.listSessions, sessionSig = env.sessionSig,' +
    ' gearSnapshot = env.gearSnapshot, riderFromFormSynced = env.riderFromFormSynced,' +
    ' windSpeedFromForm = env.windSpeedFromForm, alertLine = env.alertLine,' +
    ' renderInputSources = env.renderInputSources, renderSessions = env.renderSessions, $ = env.$;' +
    ' var setTimeout = function () {}; var window = { console: { error: function () {} } };' +
    m[0] + '\nsaveInputsToSession(btn);');
  f(env, btn);
  return { writes: writes, alerts: alerts, flash: btn.textContent };
}

/* 옥대표 화면을 흉내 낸 레코드 — 제3·4·5·6경기 */
var R = [
  { id: 'r3', name: '제3경기', sig: '410_1290_1789100000000' },
  { id: 'r4', name: '제4경기', sig: '420_1340_1789101000000' },
  { id: 'r5', name: '제5경기', sig: '400_1120_1789102000000' },
  { id: 'r6', name: '제6경기', sig: '430_1290_1789103000000' }
];

if (m) {
  console.log('[1] ★★ 옥대표 상황 — 목록에서 다시 열어 시그니처가 어긋남');
  var a = run({ recs: R, opened: 'r3', curSig: '410_1297_1789100000000' });   /* 거리만 7m 달라짐 */
  ok('★★ 제3경기에 장비가 써진다', a.writes.gear.length === 1 && a.writes.gear[0] === 'r3', JSON.stringify(a.writes));
  ok('★★ 입력(체중·윙·풍속)도 같은 레코드에', a.writes.inputs[0] === 'r3');
  ok('★ "Saved" 로 알린다', a.flash === 'Saved', a.flash);
  ok('★ "not saved yet" 거짓 안내가 안 뜬다', a.alerts.length === 0, a.alerts.join('|'));

  console.log('\n[2] ★★ 시그니처가 **다른 레코드**와 우연히 맞아도 열린 레코드에');
  var b = run({ recs: R, opened: 'r4', curSig: R[3].sig });                   /* r6 의 sig */
  ok('★★ 제4경기에 써진다 (제6경기가 아니라)', b.writes.gear[0] === 'r4', JSON.stringify(b.writes));
  ok('★★ 제6경기는 건드리지 않는다', b.writes.gear.indexOf('r6') < 0 && b.writes.inputs.indexOf('r6') < 0);

  console.log('\n[3] 방금 올린 파일 (한 번도 열거나 저장 안 함) — 시그니처로');
  var c = run({ recs: R, opened: null, curSig: R[2].sig });
  ok('★ 같은 파일을 다시 올린 것이면 그 레코드에', c.writes.gear[0] === 'r5', JSON.stringify(c.writes));
  var d = run({ recs: R, opened: null, curSig: '999_1_1' });
  ok('★★ 저장 안 된 세션이면 아무것도 안 쓴다', d.writes.gear.length === 0 && d.writes.inputs.length === 0);
  ok('★ 그리고 먼저 저장하라고 말한다', /not saved yet/.test(d.alerts.join(' ')) && d.flash === 'Not saved yet');

  console.log('\n[4] 열려 있던 레코드가 지워졌으면');
  var e = run({ recs: R, opened: 'r-gone', curSig: R[0].sig });
  ok('★★ 시그니처로 **다른 레코드를 대신 고르지 않는다**', e.writes.gear.length === 0 && e.writes.inputs.length === 0,
     JSON.stringify(e.writes));
  ok('★ 지워졌다고 사실대로 말한다', /no longer in your saved list/.test(e.alerts.join(' ')));
}

console.log('\n[5] 다른 곳에 시그니처로 레코드를 찾는 코드가 남아 있지 않다');
var code = app.replace(/\/\*[\s\S]*?\*\//g, '');
var sigLookups = (code.match(/r\.sig === sig/g) || []).length;
ok('★★ r.sig === sig 는 한 곳뿐 (saveInputsToSession 의 fallback)', sigLookups === 1, String(sigLookups));
ok('★★ 그 한 곳은 openedRecId 가 없을 때만 돈다', (function () {
  var i = code.indexOf('function saveInputsToSession');
  var seg = code.slice(i, i + 1600);
  return seg.indexOf('if (CUR.openedRecId)') >= 0 && seg.indexOf('} else {') > seg.indexOf('if (CUR.openedRecId)')
      && seg.indexOf('r.sig === sig') > seg.indexOf('} else {'); })());

console.log('\n[6] 배포');
ok('★ v2-app 캐시버스트가 v587 이상', (function () {
  var mm = html.match(/js\/v2-app\.js\?v=v(\d+)/); return !!mm && +mm[1] >= 587; })());

console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
