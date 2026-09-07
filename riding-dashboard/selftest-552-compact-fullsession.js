/* §552 압축 트랙으로 세션을 열 때 CUR.fullSession 이 직전 세션에 남던 것.

   show() 는 `CUR.fullSession = fullSession || CUR.fullSession || session` 이다.
   openSavedSession 의 압축 분기는 fullSession 인자를 안 넘기고 CUR.fullSession
   도 안 비워서, **직전 세션의 트랙이 그대로 남았다.** reapplyEdits 가 한 번만
   돌면 show(CUR.fullSession, …, CUR.name) 이 되어 이름은 새 세션인데 트랙·
   날짜·시그니처는 이전 세션인 상태가 된다.

   실측(옥대표 브라우저 2026-09-07): 고래불을 열고 Save session 을 눌렀더니
     name  20260526_고래불_12kt
     date  2026-09-07 (오늘)
     km    29.09  ← 직전에 보던 '4.0 under powered'
     sig   3827_29091_1788754551000  ← 역시 4.0 의 것
   인 행이 생겼다. 저장 시 samples 도 CUR.fullSession 에서 뽑으므로
   **남의 트랙이 저장된다.** */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');

/* 압축 분기 = isCompactTrack 부터 그 분기의 return 까지 */
var i=code.indexOf('isCompactTrack(gpx)');
var branch=code.slice(i, code.indexOf('if (!gpx) {', i));

console.log('[1] 압축 분기가 이전 세션 상태를 비운다');
ok('★ CUR.fullSession 을 비운다', /CUR\.fullSession = null/.test(branch));
ok('★ 편집 구간도 비운다 (이전 세션의 제외구간이 따라오면 안 된다)',
   /CUR\.edit = null/.test(branch));
ok('★ 융합 상태도 비운다', /CUR\.fusion = null/.test(branch));
ok('융합 배너도 지운다', /renderFusionBanner\(null\)/.test(branch));
ok('gpxText 는 계속 null', /CUR\.gpxText = null/.test(branch));

console.log('\n[2] ★ 비우는 순서 — show() 보다 먼저여야 한다');
var iClear=branch.indexOf('CUR.fullSession = null');
var iShow=branch.indexOf('show(sess, an2');
ok('★ 초기화가 show() 앞', iClear>=0 && iShow>iClear, 'clear@'+iClear+' show@'+iShow);

console.log('\n[3] 다른 진입 경로도 같은 초기화를 한다 (비교)');
ok('loadGpxText', /CUR\.edit = null; CUR\.fullSession = null; CUR\.fusion = null;/.test(code));
ok('loadVkxFile', /CUR\.edit = null; CUR\.fullSession = null; CUR\.gpxText = null; CUR\.fusion = null;/.test(code));

console.log('\n[4] ★ 저장은 CUR.fullSession 에서 샘플을 뽑는다 (그래서 이 버그가 위험하다)');
ok('samples 출처 확인', /var S0 = \(CUR\.fullSession \|\| CUR\.session\)/.test(code));
ok('날짜는 CUR.session.startEpoch', /dateEpoch: \(CUR\.session && CUR\.session\.startEpoch\)/.test(code));
ok('시그니처는 CUR.session', /sig: sessionSig\(CUR\.session\)/.test(code));

console.log('\n[5] show() 의 fullSession 승계 규칙은 그대로 (다른 호출자가 의존한다)');
ok('reapplyEdits 는 base 를 명시적으로 넘긴다', /show\(sess, a, CUR\.name, est, base\)/.test(code));
ok('show 의 승계식 유지', /CUR\.fullSession = fullSession \|\| CUR\.fullSession \|\| session/.test(code));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
