/* §549 라이더 프로필을 v2 폼에 싣기.
   §548 검증 중 발각 — 프로필에는 69kg·상급이 저장돼 있는데 v2 폼은
   index.html 의 기본값 75·중급을 쓰고 프로필을 한 번도 읽지 않았다.
   같은 화면에서 코치 패널은 "69 kg you", 성능 점수는 75kg 로 계산했다.

   우선순위: 그 세션에 저장된 값 > 라이더 프로필 > HTML 기본값. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 프로필을 읽는다');
ok('★ seedFromProfile 이 있다', /function seedFromProfile\(got\)/.test(code));
ok('RDStorage.loadRider 를 부른다', /RDStorage\.loadRider\(\)/.test(code));
ok('몸무게', /\$\('in-weight'\)\.value = rp\.weightKg/.test(code));
ok('스킬', /\$\('in-skill'\)\.value = rp\.skill/.test(code));
ok('윙', /\$\('in-wing'\)\.value = rp\.wingM2/.test(code));

console.log('\n[2] ★ 우선순위: 세션 > 프로필 (프로필이 세션 값을 덮지 않는다)');
ok('몸무게는 세션 값이 없을 때만', /if \(!got\.weight && rp\.weightKg > 0/.test(code));
ok('스킬도', /if \(!got\.skill && rp\.skill/.test(code));
ok('윙도', /if \(!got\.wing && rp\.wingM2 > 0/.test(code));
var iSession = code.indexOf("$('in-weight').value = rd.weightKg");
var iSeed = code.indexOf('seedFromProfile(got);\n    CUR.restoredInputs');
ok('★ 세션 복원이 프로필 채움보다 먼저', iSession>=0 && iSeed>iSession,
   'session@'+iSession+' seed@'+iSeed);

console.log('\n[3] ★ 부팅 시에도 (데모·새 파일도 옥대표 몸무게로 채점)');
ok('initTabs 직후 프로필을 싣는다', /initTabs\(\);[\s\S]{0,220}restoreRiderInputs\(null\)/.test(code));
ok('rec 가 없어도 프로필은 읽는다',
   /if \(!rec\) \{ CUR\.restoredInputs = seedFromProfile\(got\); return CUR\.restoredInputs; \}/.test(code));

console.log('\n[4] ★ 프로필에서 온 값은 "이전 세션에서 넘어온 값"이 아니다');
ok('★ 출처를 기록한다', /got\.weightFrom = 'profile'/.test(code)
   && /got\.skillFrom = 'profile'/.test(code) && /got\.wingFrom = 'profile'/.test(code));
ok('★ 몸무게가 프로필이면 경고에서 뺀다',
   /if \(!ri\.weight && ri\.weightFrom !== 'profile'\) missing\.push\('weight'\)/.test(code));
ok('★ 스킬도', /if \(!ri\.skill && ri\.skillFrom !== 'profile'\) missing\.push\('skill'\)/.test(code));
ok('★ 윙은 프로필이어도 경고한다 (세션마다 다르다)',
   /if \(!ri\.wing\) missing\.push\('wing'\)/.test(code));
ok('★ 풍속도 항상 경고 (프로필에 없다)',
   /if \(!ri\.wind\) missing\.push\('wind speed'\)/.test(code));

console.log('\n[5] 프로필이 없거나 값이 비면 조용히 넘어간다 (기본값 유지)');
ok('프로필 없음 방어', /if \(!rp\) return got/.test(code));
ok('0·음수 몸무게는 안 쓴다 (> 0 검사)', /rp\.weightKg > 0/.test(code));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
