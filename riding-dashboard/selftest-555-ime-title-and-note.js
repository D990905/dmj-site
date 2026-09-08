/* §555  한글 조합 입력 중 제목 커밋
   §555b 저장 직후에도 안내문이 "저장 안 됨"이라 말하던 것

   옥대표가 6/11 세션 제목을 한글로 바꿨는데 '도2026-06-11_오륙도' 로 저장됐다
   — 앞머리에 조합 중이던 '도' 가 박혔다. 한글은 조합 입력이라, 조합이 끝나기
   전에 blur/Enter 로 commit 하면 조합 중이던 글자가 엉뚱한 자리에 확정된다.
   영문에서는 안 나므로 눈에 늦게 띈다.

   같은 세션에서 풍향 213°·풍속 16kt 를 넣고 저장했는데도 안내문은 계속
   "wind speed ... not saved with this session" 이라고 말하고 있었다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');
var i=code.indexOf('function setEditableTitle(fallback)');
var body=code.slice(i, code.indexOf('\n  function ', i+10));

console.log('[1] ★ 조합 중에는 커밋하지 않는다');
ok('★ compositionstart 를 듣는다', /addEventListener\('compositionstart'/.test(body));
ok('★ compositionend 를 듣는다', /addEventListener\('compositionend'/.test(body));
ok('★ blur 가 조합 중이면 미룬다', /if \(composing\) \{ pendingCommit = true; return; \}/.test(body));
ok('★ 조합이 끝나면 미뤄 둔 커밋을 실행한다',
   /if \(pendingCommit\) \{ pendingCommit = false; commit\(\); \}/.test(body));
ok('blur 가 commit 을 직접 참조하지 않는다 (가드를 우회할 수 없다)',
   !/addEventListener\('blur', commit\)/.test(body));

console.log('\n[2] ★ Enter·Escape 도 조합 중에는 IME 에게 양보한다');
console.log('    (그 Enter 는 후보 확정이지 입력 완료가 아니다)');
ok('★ isComposing 검사', /ev\.isComposing/.test(body));
ok('★ keyCode 229 도 본다 (구형 IME)', /ev\.keyCode === 229/.test(body));
ok('★ 조합 중이면 바로 빠져나간다',
   /if \(composing \|\| ev\.isComposing \|\| ev\.keyCode === 229\) return;/.test(body));
var iGuard=body.indexOf('ev.keyCode === 229');
var iEnter=body.indexOf("ev.key === 'Enter'");
ok('★ 가드가 Enter 처리보다 앞', iGuard>=0 && iEnter>iGuard, 'guard@'+iGuard+' enter@'+iEnter);

console.log('\n[3] 보이지 않는 문자를 걷어낸다');
ok('★ zero-width·BOM 제거', /\\u200B-\\u200D\\uFEFF/.test(body));
ok('공백 정리·trim 은 유지', /replace\(\/\\s\+\/g, ' '\)\.trim\(\)/.test(body));

console.log('\n[4] ★ 저장 직후 안내문이 사실을 말한다');
ok('★ 안내문이 함수로 분리됐다', /function renderRiderNote\(vps\)/.test(code));
ok('show 에서 부른다', /renderRiderNote\(vps\);/.test(code));
ok('★ 저장 성공 후에도 다시 그린다', /try \{ renderRiderNote\(\); \} catch \(e\) \{\}/.test(code));
ok('★ 저장했으면 네 항목 모두 이 세션 것으로 표시',
   /wind: true, wing: true, weight: true, skill: true/.test(code));
ok('★ 프로필 출처 구분(§549)은 유지한다',
   /weightFrom: ri0\.weightFrom, skillFrom: ri0\.skillFrom/.test(code));
ok('★ 저장한 줄이 정체성이 된다 (다음 저장이 또 새 줄을 만들지 않게)',
   /if \(res\.record && res\.record\.id\) CUR\.openedRecId = res\.record\.id/.test(code));

console.log('\n[5] 안내문 규칙 자체는 안 바뀐다 (§547·§549 유지)');
var ri=code.indexOf('function renderRiderNote(vps)');
var rb=code.slice(ri, code.indexOf('\n  function ', ri+10));
ok('풍속·윙은 세션 값이 없으면 경고', /missing\.push\('wind speed'\)/.test(rb)
   && /missing\.push\('wing'\)/.test(rb));
ok('프로필 몸무게·스킬은 경고에서 뺀다',
   /ri\.weightFrom !== 'profile'/.test(rb) && /ri\.skillFrom !== 'profile'/.test(rb));
ok('출처를 뭉뚱그리지 않는다', /from your rider profile/.test(rb));
ok('SPS 가 못 나오면 그 이유를 먼저 말한다', /Score needs: /.test(rb));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
