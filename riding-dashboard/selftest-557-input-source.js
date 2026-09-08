/* §557 입력칸마다 출처 꼬리표.
   옥대표: "세션을 변경해도 체중과 윙사이즈는 안변하네. 기본정보를 가져오는것
           같은데 세션정보를 가져오게해줘. 다른 사람의 데이터일 수도 있으니까."

   §547~555 로 값은 세션을 따라오게 됐지만, 기록이 없는 항목은 여전히
   프로필에서 온다. 남의 세션이면 내 몸무게는 그냥 틀린 값이고, 안내문 한
   줄로는 **어느 칸이** 그런지 알 수 없다. 칸마다 출처를 적는다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 항목마다 출처를 기록한다');
ok('★ src 객체를 만든다', /got\.src = \{ wind: 'carried', weight: 'carried', wing: 'carried', skill: 'carried' \}/.test(code));
ok('★ 세션 기록에서 오면 session', /got\.src\.wind = 'session'/.test(code)
   && /got\.src\.weight = 'session'/.test(code) && /got\.src\.wing = 'session'/.test(code)
   && /got\.src\.skill = 'session'/.test(code));
ok('★ 장비 기록에서 오면 gear', /got\.src\.wing = 'gear'/.test(code));
ok('★ 프로필에서 오면 profile', /got\.src\.weight = 'profile'/.test(code)
   && /got\.src\.skill = 'profile'/.test(code) && /got\.src\.wing = 'profile'/.test(code));
ok('아무 데서도 못 얻으면 carried 로 남는다 (초기값)',
   /wind: 'carried', weight: 'carried', wing: 'carried', skill: 'carried'/.test(code));

console.log('\n[2] ★ 우선순위 — 세션 > 장비 > 프로필');
/* ⚠ 소스상의 위치는 실행 순서가 아니다(seedFromProfile 이 파일 앞쪽에 있다).
   우선순위를 보장하는 건 ① !got.* 가드와 ② seedFromProfile 을 마지막에
   부르는 호출 순서다. 그 둘을 검사한다. */
var iR=code.indexOf('function restoreRiderInputs(rec)');
var rb=code.slice(iR, code.indexOf('\n  function ', iR+10));
var iSess=rb.indexOf("got.src.wing = 'session'");
var iGear=rb.indexOf("got.src.wing = 'gear'");
/* 첫 등장은 rec 가 없을 때의 조기 반환이다 — 마지막 등장을 본다 */
var iSeed=rb.lastIndexOf('seedFromProfile(got)');
ok('★ 윙: 세션 → 장비 → (마지막에) 프로필', iSess>=0 && iGear>iSess && iSeed>iGear,
   'sess@'+iSess+' gear@'+iGear+' seed@'+iSeed);
ok('★ 프로필 채움이 restoreRiderInputs 의 마지막 단계다',
   /seedFromProfile\(got\);\s*\n\s*CUR\.restoredInputs = got;/.test(rb));
ok('장비는 세션 값이 없을 때만', /if \(!got\.wing && rec\.gear/.test(code));
ok('프로필은 그 둘이 없을 때만', /if \(!got\.wing && rp\.wingM2 > 0/.test(code));

console.log('\n[3] 화면에 꼬리표를 붙인다');
ok('★ 렌더 함수가 있다', /function renderInputSources\(\)/.test(code));
ok('네 칸 모두 대상', /'in-weight': 'weight', 'in-wing': 'wing', 'in-skill': 'skill'/.test(code)
   && /'in-windspeed': 'wind'/.test(code));
ok('★ 라벨이 사람 말이다', /this session/.test(code) && /your profile/.test(code)
   && /carried over/.test(code) && /gear log/.test(code));
ok('★ 색으로도 구분한다 (프로필=흐리게, 넘어온 값=경고)',
   /tblr-warning/.test(code) && /tblr-success/.test(code));
ok('★ 꼬리표를 다시 만들지 않고 재사용한다 (재렌더마다 쌓이면 안 된다)',
   /var tag = host\.querySelector\('\.src-tag'\)/.test(code));

console.log('\n[4] 언제 다시 그리는가');
var n=(code.match(/renderInputSources\(\); \} catch \(e\) \{\}/g)||[]).length;
ok('★ show · 저장 · 세션저장 세 곳에서 부른다', n>=3, String(n)+'곳');
ok('★ 저장하면 네 항목 모두 session 으로 바뀐다',
   /src: \{ wind: 'session', wing: 'session', weight: 'session', skill: 'session' \}/.test(code));
var m=(code.match(/src: \{ wind: 'session', wing: 'session', weight: 'session', skill: 'session' \}/g)||[]).length;
ok('저장 경로 두 곳 모두 (Save session · Save to this session)', m===2, String(m)+'곳');

console.log('\n[5] §549 의 안내문 규칙은 그대로 (중복 아니라 보완)');
ok('안내문도 계속 출처를 말한다', /from your rider profile/.test(code));
ok('프로필 몸무게·스킬은 경고에서 뺀다', /ri\.weightFrom !== 'profile'/.test(code));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
