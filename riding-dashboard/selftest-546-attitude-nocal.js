/* §546 기기 자체 자세값(.vkx)에서 자세 패널이 터지던 것.
   옥대표 .vkx 복구 중 발각 — 헤더에 'Could not read that VKX' 가 떴는데
   데이터는 정상이었다(59.96km · 14,987점 · 저장 성공).

   renderAttitude 는 자세값이 오직 융합 경로(IMU 보정)로만 온다고 가정하고
   cal.samples 를 바로 읽었다. .vkx 는 쿼터니언으로 heel/pitch 를 자체
   제공하므로 S 는 채워지고 cal 은 null 이라 터졌고, try/catch 가 삼켰다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var i=src.indexOf('function renderAttitude(');
var body=src.slice(i, src.indexOf('\n  function ', i+10));
/* 주석 안의 코드 인용을 코드로 세면 안 된다 — 블록 주석을 걷어낸다 */
var code=body.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('[1] cal 을 무방비로 읽지 않는다');
ok('★ cal 이 null 일 수 있음을 분기한다', /if \(cal\) \{/.test(code));
var guarded=code.indexOf('if (cal) {');
var uses=[];
var ure=/cal\.(samples|heelOffset|pitchOffset|heelIqr)/g, um;
while((um=ure.exec(code))) uses.push(um.index);
ok('★ 코드상의 cal.* 접근이 모두 if (cal) 뒤에 있다',
   guarded >= 0 && uses.length > 0 && uses.every(function(x){ return x > guarded; }),
   'guard@'+guarded+' uses@'+uses.join(','));

console.log('\n[2] 보정이 없을 때 그 사실을 숨기지 않는다');
ok('★ 기기값 그대로임을 말한다', /straight from the device/.test(body));
ok('★ 마운트 편향 경고가 있다 (절대각을 못 믿는다)',
   /mounting offset removed/.test(body) && /constant tilt/.test(body));
ok('경고 톤으로 표시 (info 아님)', /alert-warning'/.test(code.slice(guarded)));

console.log('\n[3] 보정이 있을 때의 기존 안내는 그대로');
ok('Zeroed against ... 문구 유지', /Zeroed against/.test(body));
ok('heel/pitch 오프셋 수치 유지', /heelOffset\.toFixed\(1\)/.test(body));

console.log('\n[4] 삼켜진 예외에 스택을 남긴다');
ok('★ VKX catch 가 console.error 한다', /\[v2 §546\] VKX pipeline threw/.test(src));
ok('★ 세션이 이미 있으면 "못 읽었다"고 하지 않는다',
   /if \(CUR\.session && CUR\.analysis\) \{[\s\S]{0,200}?The file loaded, but one panel failed to draw/.test(src));

console.log('\n[5] 자세 표본 게이트는 그대로 (10kt 이상 · heel·pitch 존재)');
ok('게이트 유지', /p\.heel != null && p\.pitch != null && p\.speed != null && p\.speed \* KT > 10/.test(body));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
