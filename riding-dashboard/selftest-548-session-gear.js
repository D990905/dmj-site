/* §548 세션별 장비 + "이 세션에 저장" 버튼.
   옥대표: "고래볼 세션화면인데 오늘 탔던걸로 나와 4.0. 이것도 버그"
          "여기도 입력하고 나면 그 세션에 해당 정보를 저장하는 저장 버튼이
           필요해. 안그러면 여기저기 세션을 열때마다 그 세션과 상관없는
           데이터가 나와."

   장비는 라이더 프로필에 한 벌이라 어떤 세션을 열든 오늘 장비가 따라왔다.
   코치 패널이 5/25 고래불에 대고 "You rode 6 m²" 라고 말한 것이 그것이다. */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 세션을 열면 그 세션 장비가 우선');
ok('★ gearSelection 이 CUR.sessionGear 를 본다', /CUR\.sessionGear && typeof CUR\.sessionGear === 'object'/.test(code));
ok('★ 프로필 위에 덮어쓴다 (일부만 기록돼도 나머지는 프로필)',
   /merge\(rp\.gear \|\| \{\}, CUR\.sessionGear\)/.test(code));
ok('세션 장비가 없으면 예전대로 프로필', /: \(rp\.gear \|\| \{\}\)/.test(code));
ok('★ 복원 시 장비를 담는다', /if \(any\) CUR\.sessionGear = G/.test(code));
ok('장비 7종 전부', /\['frontWing','rearWing','mast','handWing','board','surface','harness'\]/.test(code));

console.log('\n[2] ★ 옛 세션 장비를 고쳐도 오늘 기본 장비가 안 바뀐다');
ok('★ 세션이 열려 있으면 프로필에 안 쓴다',
   /if \(CUR\.sessionGear\) \{\s*CUR\.sessionGear\[key\] = s\.value;/.test(code));
ok('세션이 없을 때만 saveGear', /\} else \{\s*var p = \{\}; p\[key\] = s\.value; saveGear\(p\);/.test(code));

console.log('\n[3] 저장 버튼');
ok('★ 버튼이 있다', /'Save to this session'/.test(code));
ok('핸들러 연결', /saveInputsToSession\(gsave\)/.test(code));
ok('★ 제목이 상황에 따라 바뀐다 (오늘 vs 이 세션)',
   /CUR\.sessionGear \? 'Gear for this session' : 'Your gear today'/.test(code));

console.log('\n[4] ★ 저장은 열려 있는 그 세션에만 (id 로 못박는다)');
ok('시그니처로 레코드를 찾는다', /if \(r\.sig === sig\) rec = r/.test(code));
ok('★ 저장된 적 없으면 조용히 넘어가지 않고 말한다',
   /This session is not saved yet/.test(code));
ok('장비 저장', /Store\.setSessionGear\(rec\.id, snap\)/.test(code));
ok('라이더 입력 저장', /Store\.setSessionInputs\(rec\.id, \{/.test(code));
ok('풍속·풍향도 함께', /windSpeedKt: windSpeedFromForm\(\)/.test(code)
   && /windDir: CUR\.windDir/.test(code));

console.log('\n[5] ★ 실패를 성공처럼 보이게 하지 않는다');
ok('실패 시 스택 로그', /\[v2 §548\] save to session failed/.test(code));
ok('★ 실패하면 Saved 라고 안 쓴다', /flash\('Save failed', false\);\s*return;/.test(code));
ok('성공 표시', /flash\('Saved', true\)/.test(code));
ok('★ 저장 후 안내문이 "이 세션에 저장됨"으로 바뀐다',
   /saved with this session/.test(code));

console.log('\n[6] 새 파일을 올리면 세션 장비를 비운다');
ok('★ 초기화', /CUR\.restoredInputs = null; CUR\.sessionGear = null;/.test(code));

console.log('\n[7] storage — 입력만 덧쓰는 경로');
var st=fs.readFileSync(path.join(__dirname,'js/storage.js'),'utf8');
var stc=st.replace(/\/\*[\s\S]*?\*\//g,'');
ok('★ setSessionInputs 가 있다', /function setSessionInputs\(id, patch\)/.test(stc));
ok('내보낸다', /setSessionInputs: setSessionInputs/.test(stc));
ok('★ 없는 id 는 not found (조용히 성공하지 않는다)',
   /if \(!found\) return \{ ok: false, error: 'not found' \}/.test(stc));

/* 실동작 — storage 만 노드에서 돌린다 */
console.log('\n[8] setSessionInputs 실동작');
var store={};
var g={ localStorage:{ getItem:function(k){return store[k]===undefined?null:store[k];},
  setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];},
  get length(){return Object.keys(store).length;}, key:function(i){return Object.keys(store)[i];} },
  console:console, Date:Date, Math:Math, JSON:JSON, isFinite:isFinite, Number:Number,
  String:String, Array:Array, Object:Object, parseInt:parseInt, parseFloat:parseFloat, Promise:Promise };
g.window=g; g.self=g; vm.createContext(g);
vm.runInContext(st, g);
var S=g.RDStorage;
var rr=S.saveSession({name:'고래불', dateEpoch:Date.parse('2026-05-25'), sig:'K'},{summary:{},maneuverStats:{}});
var pr=S.setSessionInputs(rr.record.id, { rider:{weightKg:69,wingM2:4,skill:'상급'}, windSpeedKt:12 });
ok('저장 성공', pr && pr.ok===true, JSON.stringify(pr));
var got=S.listSessions()[0];
ok('★ 풍속이 12 로 (오늘의 25 가 아니라)', got.windSpeedKt===12, String(got.windSpeedKt));
ok('★ 윙이 4 로', got.rider && got.rider.wingM2===4, JSON.stringify(got.rider));
ok('몸무게·스킬도', got.rider.weightKg===69 && got.rider.skill==='상급');
ok('★ 다른 필드는 안 건드린다', got.name==='고래불' && got.sig==='K');
ok('없는 id 는 실패로 돌려준다', S.setSessionInputs('없음',{windSpeedKt:1}).ok===false);

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
