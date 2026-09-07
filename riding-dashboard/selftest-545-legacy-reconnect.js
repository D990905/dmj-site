/* §545 sig 없는 옛 줄에 다시 이어붙이기.
   옥대표: "6월 9일까지의 데이터를 볼 수가 없어. 데이터들 찾아서 업데이트 부탁해"

   §537 의 재연결은 한 번도 작동한 적이 없었다 — 되살려야 할 줄들은 전부
   sig 도입 전 기록이라 sig 가 없고, 매칭은 sig 로만 했다. */
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
    parseInt:parseInt, parseFloat:parseFloat, Promise:Promise };
  g.window=g; g.self=g; vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'js/storage.js'),'utf8'), g);
  return { S:g.RDStorage, store:store };
}
var A={summary:{},maneuverStats:{}};
var D19=Date.parse('2026-05-19T06:15:00Z');
/* 옛 줄을 직접 심는다 — sig 없음 · hasTrack false (실제 상태 그대로) */
function seedLegacy(e, rows) {
  var key=null;
  e.S.saveSession({name:'__probe__', dateEpoch:1, sig:'__p__'}, A);
  Object.keys(e.store).forEach(function(k){ if(/sessions/.test(k)) key=k; });
  e.store[key]=JSON.stringify(rows);
  return key;
}

console.log('[1] ★ sig 없는 요약 행에 다시 붙는다 (줄이 안 늘어난다)');
var e=env();
seedLegacy(e,[{id:'old1', name:'슬라럼', dateEpoch:D19, hasTrack:false, distanceM:15480, savedAt:100}]);
ok('옛 줄 하나', e.S.listSessions().length===1);
var A1={summary:{totalDistanceM:18445}, maneuverStats:{}};
var SAMP=[{lat:35,lng:129,t:1},{lat:35.001,lng:129.001,t:2},{lat:35.002,lng:129.002,t:3}];
var r=e.S.saveSession({name:'슬라럼', dateEpoch:D19, sig:'2950_18445_x', samples:SAMP}, A1);
var L=e.S.listSessions();
ok('★ 여전히 한 줄 (중복이 안 생긴다)', L.length===1, String(L.length));
ok('★ 옛 줄의 id 를 이어받는다', r.record.id==='old1', r.record.id);
ok('이제 열 수 있다', L[0].hasTrack===true);
ok('sig 가 붙는다 (다음부터는 sig 로 맞는다)', L[0].sig==='2950_18445_x');
ok('★ 거리가 새 값으로 (옛 요약이 아니라 새 분석)', L[0].distanceM===18445,
   String(L[0].distanceM));

console.log('\n[2] ★ 열 수 있는 줄은 절대 덮지 않는다 (안전장치)');
var e2=env();
seedLegacy(e2,[{id:'live', name:'슬라럼', dateEpoch:D19, hasTrack:true, savedAt:100}]);
e2.S.saveSession({name:'슬라럼', dateEpoch:D19, sig:'NEW'}, A);
ok('★ 두 줄이 된다 (덮지 않았다)', e2.S.listSessions().length===2,
   String(e2.S.listSessions().length));

console.log('\n[3] ★ sig 가 있는 줄도 덮지 않는다 (§537 경로만 담당)');
var e3=env();
seedLegacy(e3,[{id:'sigged', name:'슬라럼', dateEpoch:D19, hasTrack:false, sig:'OTHER', savedAt:100}]);
e3.S.saveSession({name:'슬라럼', dateEpoch:D19, sig:'NEW'}, A);
ok('★ 두 줄', e3.S.listSessions().length===2);

console.log('\n[4] 날짜가 다르면 안 붙는다');
var e4=env();
seedLegacy(e4,[{id:'old', name:'슬라럼', dateEpoch:D19, hasTrack:false, savedAt:100}]);
e4.S.saveSession({name:'슬라럼', dateEpoch:D19+86400000*3, sig:'NEW'}, A);
ok('★ 두 줄 (다른 날은 다른 세션)', e4.S.listSessions().length===2);

console.log('\n[5] ★ 같은 날 옛 요약이 여럿이면 (고래불 3줄) 이름이 같은 것 중 최신');
var D25=Date.parse('2026-05-25T05:11:00Z');
var e5=env();
seedLegacy(e5,[
  {id:'g1', name:'20260526_고래불_12kt', dateEpoch:D25, hasTrack:false, distanceM:45230, savedAt:100},
  {id:'g2', name:'20260526_고래불_12kt', dateEpoch:D25, hasTrack:false, distanceM:44770, savedAt:300},
  {id:'g3', name:'20260526_고래불_12kt', dateEpoch:D25, hasTrack:false, distanceM:43130, savedAt:200}
]);
var rg=e5.S.saveSession({name:'20260526_고래불_12kt', dateEpoch:D25, sig:'G',
  samples:[{lat:36,lng:129,t:1},{lat:36.001,lng:129.001,t:2},{lat:36.002,lng:129.002,t:3}]}, A);
ok('★ 세 줄이 두 줄로 줄지 않는다 (하나만 이어붙는다)',
   e5.S.listSessions().length===3, String(e5.S.listSessions().length));
ok('★ 가장 최근 저장본(g2)을 잇는다', rg.record.id==='g2', rg.record.id);
var openable=e5.S.listSessions().filter(function(x){return x.hasTrack;});
ok('★ 하나가 열리게 된다', openable.length===1);
ok('나머지 둘은 그대로 (사용자가 §543 으로 지운다)',
   e5.S.listSessions().filter(function(x){return !x.hasTrack;}).length===2);

console.log('\n[6] ★ 이름이 다르면 같은 날 아무거나에 붙는다 (요약행은 잃을 게 없다)');
console.log('    — .vkx 처럼 파일이 주는 이름이 옛 이름과 다를 수 있다');
var D9=Date.parse('2026-06-09T06:19:00Z');
var e6=env();
seedLegacy(e6,[{id:'ana', name:'Ananas 2026-6-9', dateEpoch:D9, hasTrack:false, savedAt:100}]);
var r6=e6.S.saveSession({name:'2026-06-09_Ananas', dateEpoch:D9, sig:'V'}, A);
ok('★ 한 줄로 이어진다', e6.S.listSessions().length===1, String(e6.S.listSessions().length));
ok('★ 알아보던 옛 이름을 지킨다', e6.S.listSessions()[0].name==='Ananas 2026-6-9',
   e6.S.listSessions()[0].name);

console.log('\n[7] ★ 옛 줄에 붙여 둔 장비가 살아남는다');
var e7=env();
seedLegacy(e7,[{id:'g', name:'슬라럼', dateEpoch:D19, hasTrack:false, savedAt:1,
                gear:{handWingName:'PPC Sonic 5.0', backfilled:true}}]);
e7.S.saveSession({name:'슬라럼', dateEpoch:D19, sig:'N'}, A);
ok('장비 보존', e7.S.listSessions()[0].gear
   && e7.S.listSessions()[0].gear.handWingName==='PPC Sonic 5.0');

console.log('\n[8] 두 번째 업로드는 이제 sig 로 맞는다 (무한히 안 늘어난다)');
var e8=env();
seedLegacy(e8,[{id:'o', name:'슬라럼', dateEpoch:D19, hasTrack:false, savedAt:1}]);
e8.S.saveSession({name:'슬라럼', dateEpoch:D19, sig:'S'}, A);
e8.S.saveSession({name:'슬라럼', dateEpoch:D19, sig:'S'}, A);
e8.S.saveSession({name:'슬라럼', dateEpoch:D19, sig:'S'}, A);
ok('★ 세 번 올려도 한 줄', e8.S.listSessions().length===1,
   String(e8.S.listSessions().length));

console.log('\n[9] 옛 줄이 없으면 평소대로 새 줄');
var e9=env();
var n9=e9.S.saveSession({name:'새 세션', dateEpoch:D19, sig:'X'}, A);
ok('새 줄 생성', e9.S.listSessions().length===1 && n9.record.id!=='old1');

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
