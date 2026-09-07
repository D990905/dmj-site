/* §553 저장된 세션을 다시 열어 저장하면 행이 하나씩 늘어나던 것.

   §509 압축 트랙은 손실 인코딩이라(좌표를 델타·반올림으로 담는다) 다시 열면
   거리가 미세하게 달라진다. 시그니처가 거리에서 나오므로 sig 가 바뀌고
   §537 의 upsert 가 안 걸려 **사본이 생긴다.**

   실측(옥대표 브라우저 2026-09-07):
     슬라럼   저장 18.44km → 다시 열면 18.45km → 저장 시 새 줄
     Ananas   저장 59.96km → 다시 열면 59.83km → 저장 시 새 줄
   목록의 Waterspeed 3줄·'4.0 under powered' 2줄도 같은 원인으로 보인다. */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
function env() {
  var store={};
  var g={ localStorage:{ getItem:function(k){return store[k]===undefined?null:store[k];},
      setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];},
      get length(){return Object.keys(store).length;}, key:function(i){return Object.keys(store)[i];} },
    console:console, Date:Date, Math:Math, JSON:JSON, isFinite:isFinite, Number:Number,
    String:String, Array:Array, Object:Object, parseInt:parseInt, parseFloat:parseFloat, Promise:Promise };
  g.window=g; g.self=g; vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'js/storage.js'),'utf8'), g);
  return { S:g.RDStorage, store:store };
}
var A={summary:{},maneuverStats:{}};

console.log('[1] ★ sig 가 살짝 달라져도 사본이 안 생긴다 (핵심)');
var e=env();
var first=e.S.saveSession({name:'슬라럼', dateEpoch:1779171347000,
  sig:'2950_18445_1779171347000'}, A);
ok('한 줄', e.S.listSessions().length===1);
/* 다시 열면 거리가 1m 달라진다 → sig 도 달라진다 */
var again=e.S.saveSession({name:'슬라럼', dateEpoch:1779171347000,
  sig:'2950_18452_1779171347000', replaceId:first.record.id}, A);
ok('★ 여전히 한 줄 (사본 없음)', e.S.listSessions().length===1,
   String(e.S.listSessions().length));
ok('★ 같은 id 를 유지한다 (트랙·문답이 id 에 묶인다)',
   again.record.id===first.record.id, again.record.id+' vs '+first.record.id);
ok('새 sig 로 갱신된다 (다음부터는 sig 로도 맞는다)',
   e.S.listSessions()[0].sig==='2950_18452_1779171347000');

console.log('\n[2] replaceId 가 없으면 예전 동작 그대로');
var e2=env();
var f2=e2.S.saveSession({name:'A', dateEpoch:1, sig:'S1'}, A);
e2.S.saveSession({name:'A 다시', dateEpoch:1, sig:'S2'}, A);   /* replaceId 없음 */
ok('★ sig 가 다르면 새 줄 (근거 없이 안 묶는다)', e2.S.listSessions().length===2,
   String(e2.S.listSessions().length));
e2.S.saveSession({name:'A 또', dateEpoch:1, sig:'S1'}, A);     /* §537 sig 일치 */
ok('sig 가 같으면 §537 이 잡는다', e2.S.listSessions().length===2);

console.log('\n[3] ★ replaceId 가 sig 매칭보다 우선한다');
var e3=env();
var x=e3.S.saveSession({name:'X', dateEpoch:1, sig:'SX'}, A);
var y=e3.S.saveSession({name:'Y', dateEpoch:2, sig:'SY'}, A);
/* sig 는 Y 와 같지만 replaceId 는 X — 사용자가 연 것은 X 다 */
var z=e3.S.saveSession({name:'Z', dateEpoch:1, sig:'SY', replaceId:x.record.id}, A);
ok('★ X 를 잇는다', z.record.id===x.record.id, z.record.id);
ok('두 줄 유지', e3.S.listSessions().length===2);
ok('Y 는 안 건드린다', e3.S.listSessions().some(function(r){return r.id===y.record.id;}));

console.log('\n[4] 없는 replaceId 는 무시하고 평소대로');
var e4=env();
var n4=e4.S.saveSession({name:'N', dateEpoch:1, sig:'SN', replaceId:'없는-id'}, A);
ok('새 줄이 생긴다', e4.S.listSessions().length===1);
ok('id 는 새로 발급', n4.record.id!=='없는-id');

console.log('\n[5] 이어붙일 때 장비는 보존된다 (§537 규칙 유지)');
var e5=env();
var g5=e5.S.saveSession({name:'G', dateEpoch:1, sig:'SG'}, A);
e5.S.setSessionGear(g5.record.id, {handWingName:'PPC Sonic 5.0'});
e5.S.saveSession({name:'G', dateEpoch:1, sig:'SG2', replaceId:g5.record.id}, A);
ok('장비 유지', e5.S.listSessions()[0].gear
   && e5.S.listSessions()[0].gear.handWingName==='PPC Sonic 5.0');

console.log('\n[6] v2 배선');
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');
ok('★ 세션을 열면 레코드 id 를 기억한다', /CUR\.openedRecId = rec\.id/.test(code));
ok('★ 저장할 때 넘긴다', /replaceId: CUR\.openedRecId \|\| null/.test(code));
ok('★ 새 파일을 올리면 잊는다 (새 세션은 새 줄)',
   /CUR\.openedRecId = null;/.test(code));
var iForget=code.indexOf('CUR.openedRecId = null;');
var iLoadFiles=code.indexOf('function loadFiles(fileList)');
ok('★ 잊는 자리가 loadFiles 안 (업로드 진입점)',
   iForget>iLoadFiles && iForget-iLoadFiles < 900, 'loadFiles@'+iLoadFiles+' forget@'+iForget);

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
