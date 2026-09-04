/* §537 같은 세션을 다시 올리면 **줄이 늘지 않고 되살아난다**.
   옥대표: "왜 지난세션 데이터들을 볼 수 없다고 하지?"
   → §509 압축 전에 저장돼 트랙이 밀려난 세션들. 지금은 다시 올리면
     들어가는데, 그대로 두면 중복 행이 생긴다. */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }

function env() {
  var store={};
  var g={ localStorage:{
      getItem:function(k){return store[k]===undefined?null:store[k];},
      setItem:function(k,v){store[k]=String(v);},
      removeItem:function(k){delete store[k];},
      get length(){return Object.keys(store).length;},
      key:function(i){return Object.keys(store)[i];}
    }, console:console, Date:Date, Math:Math, JSON:JSON, isFinite:isFinite,
    Number:Number, String:String, Array:Array, Object:Object,
    parseInt:parseInt, parseFloat:parseFloat };
  g.window=g; g.self=g; vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'js/storage.js'),'utf8'), g);
  return { S:g.RDStorage, store:store };
}
var A={summary:{},maneuverStats:{}};

console.log('[1] 같은 sig 를 다시 저장하면 줄이 안 늘어난다');
var e=env();
var r1=e.S.saveSession({name:'Ananas', dateEpoch:Date.parse('2026-06-09'), sig:'AAA'},A);
ok('첫 저장', r1.ok===true && e.S.listSessions().length===1);
var r2=e.S.saveSession({name:'Ananas 다시', dateEpoch:Date.parse('2026-06-09'), sig:'AAA'},A);
ok('두 번째도 성공', r2.ok===true);
ok('★ 줄은 여전히 하나', e.S.listSessions().length===1, String(e.S.listSessions().length));
ok('내용은 새 것으로', e.S.listSessions()[0].name==='Ananas 다시');
ok('id 는 유지된다 (트랙·문답이 id 에 묶인다)', r2.record.id===r1.record.id);

console.log('\n[2] ★ 예전 줄에 붙여 둔 장비가 살아남는다');
var e2=env();
var a1=e2.S.saveSession({name:'X', dateEpoch:1, sig:'BBB'},A);
e2.S.setSessionGear(a1.record.id, {handWing:'sonic_50', handWingName:'PPC Sonic 5.0'});
var a2=e2.S.saveSession({name:'X 다시', dateEpoch:1, sig:'BBB'},A);   /* gear 없이 재저장 */
var got=e2.S.listSessions()[0];
ok('장비가 보존된다', got.gear && got.gear.handWingName==='PPC Sonic 5.0',
   JSON.stringify(got.gear));
ok('backfilled 표시도 유지', got.gear.backfilled===true);

console.log('\n[3] 새로 넘긴 장비가 있으면 그쪽이 이긴다');
var e3=env();
var b1=e3.S.saveSession({name:'Y', dateEpoch:1, sig:'CCC'},A);
e3.S.setSessionGear(b1.record.id, {handWingName:'옛 윙'});
e3.S.saveSession({name:'Y2', dateEpoch:1, sig:'CCC', gear:{handWingName:'새 윙'}},A);
ok('새 장비로 갱신', e3.S.listSessions()[0].gear.handWingName==='새 윙');

console.log('\n[4] sig 가 없거나 다르면 **따로** 쌓인다');
var e4=env();
e4.S.saveSession({name:'A', dateEpoch:1, sig:'S1'},A);
e4.S.saveSession({name:'B', dateEpoch:2, sig:'S2'},A);
ok('다른 sig 는 두 줄', e4.S.listSessions().length===2);
e4.S.saveSession({name:'C', dateEpoch:3},A);
e4.S.saveSession({name:'D', dateEpoch:4},A);
ok('sig 없으면 합치지 않는다 (근거 없이 묶으면 안 된다)',
   e4.S.listSessions().length===4, String(e4.S.listSessions().length));

console.log('\n[5] 되살린 줄에 트랙이 다시 붙는다');
var e5=env();
var c1=e5.S.saveSession({name:'Z', dateEpoch:1, sig:'DDD'},A);   /* 트랙 없이 */
ok('처음엔 트랙 없음', e5.S.listSessions()[0].hasTrack===false);
var samples=[];
for (var i=0;i<50;i++) samples.push({t:i,lat:35.1+i*1e-5,lng:129.2+i*1e-5,speed:8});
var c2=e5.S.saveSession({name:'Z', dateEpoch:1, sig:'DDD', samples:samples},A);
ok('★ 다시 올리면 트랙이 붙는다', e5.S.listSessions()[0].hasTrack===true);
ok('줄은 그대로 하나', e5.S.listSessions().length===1);
ok('id 도 그대로', c2.record.id===c1.record.id);

console.log('\n' + pass + '/' + (pass+fail) + ' 통과');
process.exit(fail?1:0);
