/* §547 세션별 라이더 입력 저장·복원.
   옥대표: "어떤 세션을 선택해도 신체정보랑 기본 정보입력은 늘 같거나
           최종 사용했던게 반복적으로 나타남"

   몸무게·윙·스킬은 **어디에도 저장되지 않고 있었다.** 폼의 마지막 값이 모든
   과거 세션에 그대로 쓰였고, 점수는 그 값으로 계산된다 — 5/25 고래불
   (파일명이 12kt)이 25kt 로 채점되고 있었다. */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');   /* 주석 인용을 코드로 세지 않는다 */

console.log('[1] 저장할 때 라이더 입력이 레코드에 들어간다');
ok('★ rider 필드를 넘긴다', /rider: \(function \(\) \{/.test(code));
ok('몸무게', /weightKg: r0\.weightKg/.test(code));
ok('윙 면적', /wingM2: r0\.wingM2/.test(code));
ok('스킬', /skill: r0\.skill/.test(code));
ok('풍속은 기존대로 유지', /windSpeedKt: windSpeedFromForm\(\)/.test(code));

console.log('\n[2] 열 때 되돌린다 — 두 경로 모두');
ok('★ 복원 헬퍼가 있다', /function restoreRiderInputs\(rec\)/.test(code));
var calls=(code.match(/restoreRiderInputs\(rec\)/g)||[]).length;
ok('★ 압축·GPX 두 경로 모두에서 부른다 (정의 1 + 호출 2)', calls===3, '호출 '+calls+'회');
ok('풍속 복원', /\$\('in-windspeed'\)\.value = rec\.windSpeedKt/.test(code));
ok('몸무게 복원', /\$\('in-weight'\)\.value = rd\.weightKg/.test(code));
ok('윙 복원', /\$\('in-wing'\)\.value = rd\.wingM2/.test(code));
ok('스킬 복원', /\$\('in-skill'\)\.value = rd\.skill/.test(code));

console.log('\n[3] ★ 윙은 장비 스냅샷을 대체로 쓴다 (저장 당시 실제로 고른 윙)');
ok('gear.wingM2 fallback', /rec\.gear\.wingM2 > 0/.test(code));
ok('폼 값이 있으면 그쪽이 우선 (!got.wing 조건)', /if \(!got\.wing && rec\.gear/.test(code));

console.log('\n[4] ★ 복원 못 한 값은 "오늘 값"이라고 밝힌다');
console.log('    (이걸 안 적으면 옛 세션이 오늘 풍속으로 조용히 채점된다)');
ok('★ 복원 여부를 기록한다', /CUR\.restoredInputs = got/.test(code));
ok('★ 못 복원한 항목을 모은다', /missing\.push\('wind speed'\)/.test(code)
   && /missing\.push\('wing'\)/.test(code) && /missing\.push\('weight'\)/.test(code)
   && /missing\.push\('skill'\)/.test(code));
ok('★ 경고 문구가 "이전 세션에서 넘어왔다"고 말한다',
   /carried over from the last session you looked at/.test(code));
ok('★ 무엇을 하라고 알려준다 (Recalculate → Save)',
   /press Recalculate, then Save session to keep it/.test(code));
ok('★ 경고 색으로 표시한다', /note\.className = 'lab text-warning'/.test(code));
ok('전부 복원되면 그렇게 말한다', /restored from this session/.test(code));

console.log('\n[5] ★ 새 파일을 올리면 "복원했다" 표시가 남지 않는다');
ok('loadGpxText 가 표시를 지운다',
   /if \(!CUR\.restoringSaved\) \{ CUR\.restoredInputs = null;/.test(code));
ok('저장 세션 복원 중에는 안 지운다 (플래그)', /CUR\.restoringSaved = true/.test(code));
var resets=(code.match(/CUR\.restoringSaved = false/g)||[]).length;
ok('★ 성공·실패 양쪽에서 플래그를 내린다', resets>=2, String(resets)+'회');

console.log('\n[5b] ★ 초기화는 loadFiles 에도 있어야 한다');
console.log('    (파일 하나도 융합 경로를 타서 loadGpxText 를 안 거친다)');
ok('★ loadFiles 가 표시를 지운다',
   /function loadFiles\(fileList\) \{[\s\S]{0,900}?CUR\.restoredInputs = null;\s*\n\s*CUR\.sessionGear = null;/.test(code));
ok('★ 지운 뒤 프로필은 다시 싣는다 (몸무게·스킬은 유효)',
   /CUR\.sessionGear = null;\s*\n\s*try \{ restoreRiderInputs\(null\); \} catch \(e\) \{\}/.test(code));

console.log('\n[6] 점수는 복원된 폼 값으로 계산된다 (복원이 분석보다 먼저)');
var iRestore=code.indexOf('restoreRiderInputs(rec); } catch (e) {}');
var iLoad=code.indexOf('loadGpxText(gpx,');
ok('★ 복원이 loadGpxText 보다 앞선다', iRestore>=0 && iLoad>iRestore,
   'restore@'+iRestore+' load@'+iLoad);
ok('VPS 는 폼에서 읽는다 (복원 값이 그대로 반영)',
   /computeVPS\(analysis, riderFromForm\(\), analysis\.windDir, windSpeedFromForm\(\)\)/.test(code));

/* ★ 소스 문자열 검사만으로는 '넘겼는지'까지밖에 못 본다. §551 은 v2 가
   rider 를 넘기는데 buildRecord 가 복사하지 않아 한 번도 저장되지 않은
   경우였다. 저장은 반드시 saveSession→listSessions 왕복으로 검증한다. */
console.log('\n[7] ★★ rider 가 실제로 레코드에 남는가 (왕복 검증)');
var vm=require('vm');
var store={};
var g={ localStorage:{ getItem:function(k){return store[k]===undefined?null:store[k];},
  setItem:function(k,v){store[k]=String(v);}, removeItem:function(k){delete store[k];},
  get length(){return Object.keys(store).length;}, key:function(i){return Object.keys(store)[i];} },
  console:console, Date:Date, Math:Math, JSON:JSON, isFinite:isFinite, Number:Number,
  String:String, Array:Array, Object:Object, parseInt:parseInt, parseFloat:parseFloat, Promise:Promise };
g.window=g; g.self=g; vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(__dirname,'js/storage.js'),'utf8'), g);
var S=g.RDStorage;
S.saveSession({ name:'고래불', dateEpoch:Date.parse('2026-05-25'), sig:'K',
                windSpeedKt:12, rider:{weightKg:69, wingM2:6, skill:'상급'} },
              {summary:{},maneuverStats:{}});
var rec=S.listSessions()[0];
ok('★★ rider 가 저장된다 (넘기기만 하고 안 담기던 버그)', !!rec.rider,
   JSON.stringify(rec.rider));
ok('몸무게', rec.rider && rec.rider.weightKg===69);
ok('윙', rec.rider && rec.rider.wingM2===6);
ok('스킬', rec.rider && rec.rider.skill==='상급');
ok('풍속도 함께', rec.windSpeedKt===12);
S.saveSession({name:'무명', dateEpoch:1, sig:'N'},{summary:{},maneuverStats:{}});
var bare=S.listSessions().filter(function(r){return r.sig==='N';})[0];
ok('rider 가 없으면 null (undefined 로 새지 않는다)', bare.rider===null,
   String(bare.rider));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
