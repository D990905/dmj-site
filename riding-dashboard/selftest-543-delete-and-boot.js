/* §543 세션 삭제 + 부팅 진입 세션.
   옥대표: "세션을 삭제하는 기능추가해줘" ·
          "왜 늘 시작하면 저장된 세션중에 슬라럼 세션으로만 진입이 되니?" ·
          "타 세션에서 트랙을 수정하는데 자꾸 슬라럼 세션의 트랙이 자동으로
           올라와버림"

   뒤의 둘은 같은 뿌리다: 부팅 시 데모 GPX 를 무조건 fetch 하고, 응답이
   도착하면 화면에 무엇이 있든 덮어썼다. */
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

console.log('[1] 삭제하면 레코드와 트랙이 함께 사라진다');
var e=env();
var r1=e.S.saveSession({name:'슬라럼', dateEpoch:Date.parse('2026-05-19'), sig:'SLA'},A);
var r2=e.S.saveSession({name:'Ananas', dateEpoch:Date.parse('2026-06-09'), sig:'ANA'},A);
var TK=null;                                   /* 실제 접두어를 코드에서 얻는다 */
e.S.saveEditState('__probe__',{excludeRanges:[{fromSec:0,toSec:1}]});
Object.keys(e.store).forEach(function(k){ if(/edits/.test(k)) TK=k.replace(/edits.*$/,''); });
e.S.saveEditState('__probe__',null);
e.store[TK+'track_v1_'+r1.record.id]='<gpx/>';  /* 트랙 직접 심기 */
ok('두 줄 저장됨', e.S.listSessions().length===2);
e.S.deleteSession(r1.record.id);
var left=e.S.listSessions();
ok('★ 한 줄만 남는다', left.length===1, String(left.length));
ok('남은 게 지우지 않은 쪽', left[0].name==='Ananas');
ok('★ 트랙 키도 사라진다', e.store[TK+'track_v1_'+r1.record.id]===undefined,
   TK+' -> '+String(e.store[TK+'track_v1_'+r1.record.id]));

console.log('\n[2] ★ 훈련부하 원장에서도 빠진다 (남으면 체력 추세가 틀어진다)');
var e2=env();
var s1=e2.S.saveSession({name:'A', dateEpoch:1000, sig:'S1'},A);
e2.S.recordRideLoad({sig:'S1', dateEpoch:1000, AU:120});
e2.S.recordRideLoad({sig:'S2', dateEpoch:2000, AU:90});
ok('원장에 둘', e2.S.listRideLoads().length===2, String(e2.S.listRideLoads().length));
e2.S.deleteSession(s1.record.id);
var rl=e2.S.listRideLoads();
ok('★ 지운 세션의 부하가 빠진다', rl.length===1 && rl[0].sig==='S2',
   JSON.stringify(rl.map(function(x){return x.sig;})));

console.log('\n[3] ★ 제목·편집·문답도 함께 정리된다');
var e3=env();
var t1=e3.S.saveSession({name:'Waterspeed 2026-09-03', dateEpoch:1, sig:'T1'},A);
e3.S.saveSessionTitle('T1','4.0 under powered');
e3.S.saveEditState('T1',{excludeRanges:[{fromSec:10,toSec:20}]});
e3.S.saveSessionAnswer('T1','q1',{key:'q1',effect:'exclude',fromSec:0,toSec:5});
ok('제목이 붙어 있다', e3.S.loadSessionTitle('T1')==='4.0 under powered');
e3.S.deleteSession(t1.record.id);
ok('★ 제목이 사라진다', !e3.S.loadSessionTitle('T1'), String(e3.S.loadSessionTitle('T1')));
var ed=e3.S.loadEditState('T1');
ok('★ 편집 상태가 사라진다', !ed || !(ed.excludeRanges||[]).length, JSON.stringify(ed));

console.log('\n[4] ★ 같은 sig 가 남아 있으면 곁가지는 건드리지 않는다');
console.log('    (중복 저장본 하나 지웠다고 나머지의 제목이 날아가면 안 된다)');
var e4=env();
var d1=e4.S.saveSession({name:'dup', dateEpoch:1, sig:'DUP'},A);
/* 같은 sig 로 다시 저장하면 §537 upsert 라 한 줄이 된다 —
   진짜 중복 두 줄을 만들려면 id 가 다른 레코드를 직접 넣는다. */
var raw=JSON.parse(e4.store[Object.keys(e4.store).filter(function(k){
  return k.indexOf('sessions')>=0; })[0]]);
raw.push({ id:'dup2', name:'dup 사본', dateEpoch:2, sig:'DUP', savedAt:2 });
e4.store[Object.keys(e4.store).filter(function(k){
  return k.indexOf('sessions')>=0; })[0]]=JSON.stringify(raw);
e4.S.saveSessionTitle('DUP','내가 붙인 제목');
e4.S.recordRideLoad({sig:'DUP', dateEpoch:1, AU:100});
ok('같은 sig 두 줄', e4.S.listSessions().length===2, String(e4.S.listSessions().length));
e4.S.deleteSession(d1.record.id);
ok('한 줄만 지워진다', e4.S.listSessions().length===1);
ok('★ 제목은 살아남는다', e4.S.loadSessionTitle('DUP')==='내가 붙인 제목',
   String(e4.S.loadSessionTitle('DUP')));
ok('★ 훈련부하도 살아남는다', e4.S.listRideLoads().length===1);
/* 이제 마지막 하나까지 지우면 그때 정리된다 */
e4.S.deleteSession('dup2');
ok('★ 마지막 하나가 지워지면 제목도 정리', !e4.S.loadSessionTitle('DUP'));
ok('★ 훈련부하도 그때 정리', e4.S.listRideLoads().length===0);

console.log('\n[5] 없는 id 를 지워도 조용히 지나간다');
var e5=env();
e5.S.saveSession({name:'A', dateEpoch:1, sig:'X'},A);
var before=e5.S.listSessions().length;
e5.S.deleteSession('없는-id');
ok('줄 수가 그대로', e5.S.listSessions().length===before);

console.log('\n[6] ★ 부팅 진입 = 가장 최근의 다시 열 수 있는 세션');
console.log('    (hasTrack 이 아닌 요약본은 열 수 없으니 건너뛴다)');
/* v2-app 의 latestOpenable 과 같은 규칙 — 여기서 규칙 자체를 고정한다 */
function latestOpenable(list) {
  var best=null;
  list.forEach(function(r){
    if(!r||!r.hasTrack) return;
    if(!best || (r.dateEpoch||0)>(best.dateEpoch||0)
       || ((r.dateEpoch||0)===(best.dateEpoch||0) && (r.savedAt||0)>(best.savedAt||0))) best=r;
  });
  return best;
}
var L=[
  {id:'a', name:'슬라럼',  dateEpoch:Date.parse('2026-05-19'), hasTrack:true,  savedAt:1},
  {id:'b', name:'Ananas',  dateEpoch:Date.parse('2026-06-09'), hasTrack:false, savedAt:2},
  {id:'c', name:'4.0 under powered', dateEpoch:Date.parse('2026-09-07'), hasTrack:true, savedAt:3}
];
ok('★ 가장 최근 = 슬라럼이 아니다', latestOpenable(L).id==='c', latestOpenable(L).id);
ok('요약본(hasTrack:false)은 고르지 않는다', latestOpenable(L).name!=='Ananas');
var L2=[{id:'a',name:'슬라럼',dateEpoch:1,hasTrack:false}];
ok('열 수 있는 게 없으면 null (그때만 데모)', latestOpenable(L2)===null);
var L3=[
  {id:'x', dateEpoch:5000, hasTrack:true, savedAt:1},
  {id:'y', dateEpoch:5000, hasTrack:true, savedAt:9}
];
ok('같은 날짜면 나중에 저장한 쪽', latestOpenable(L3).id==='y');
ok('빈 목록도 안전', latestOpenable([])===null);

console.log('\n[7] ★ 늦게 온 데모 응답은 이미 올라온 세션을 덮지 않는다');
console.log('    (이게 없어서 편집 중에 슬라럼이 끼어들었다)');
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var boot=src.slice(src.indexOf('function bootOpen()'), src.indexOf('function bootOpen()')+2200);
ok('★ .then 안에 CUR.session 가드가 있다',
   /\.then\(function \(t\) \{[\s\S]{0,400}?if \(CUR\.session\) return;/.test(boot));
ok('★ .catch 에도 가드가 있다',
   /\.catch\(function \(err\) \{\s*if \(CUR\.session\) return;/.test(boot));
ok('데모보다 저장 세션을 먼저 시도한다',
   boot.indexOf('latestOpenable()') < boot.indexOf("fetch('sample/"));
ok('데모는 훈련부하에 안 실린다 (§463 유지)', /CUR\.isDemo = true;/.test(boot));
ok('저장 세션으로 열면 isDemo=false', /CUR\.isDemo = false;/.test(boot));

console.log('\n[8] 삭제 버튼이 행 클릭(열기)과 섞이지 않는다');
var i543=src.indexOf("del.title = 'Delete this session';");
var delFn=src.slice(i543, i543+320);
ok('★ stopPropagation 이 있다', delFn.indexOf('stopPropagation')>=0, delFn);
ok('확인 없이 지우지 않는다', /if \(!window\.confirm\(msg\)\) return;/.test(src));
ok('cloud 에서도 지운다 (§415 — 안 그러면 다른 기기에서 되살아난다)',
   /RDCloud\.deleteSession\(rec\.id\)/.test(src));
ok('지운 뒤 훈련부하 화면을 다시 그린다', /renderSessions\(\);\s*\n\s*try \{ renderTraining/.test(src));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
