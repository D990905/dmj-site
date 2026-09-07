/* §554  세션 열기에 실패했을 때 정체성을 바꾸지 않는다
   §554b 모르는 장비를 기록으로 남기지 않는다

   옥대표: "최근 9월달꺼 외에는 장비선택이 비어있어야 할거 같은데
           뭔가 또 오버라이드 된거같네"

   §554  openSavedSession 에는 일찍 빠져나가는 길이 셋 있다(요약만 남은 줄 ·
         압축 해제 실패 · 융합 세션). §553 이 정체성을 함수 첫 줄에서 잡는
         바람에, 그 길로 빠지면 화면은 이전 세션인데 정체성만 새 줄이 되고
         Save 가 **엉뚱한 줄에 남의 트랙을 덮어썼다.**
         실측: 5/25 고래불 줄이 '고래불 · 오늘 · 29.09km(4.0 트랙)' 이 되고
         진짜 고래불이 사라졌다.

   §554b Save session 이 늘 지금 고른 장비를 박아, 옛 세션을 열어 저장하면
         오늘 장비가 그날 기록으로 둔갑했다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] ★ 열기에 실패하면 아무것도 안 바뀐다');
var iOpen=code.indexOf('function openSavedSession(rec)');
var body=code.slice(iOpen, code.indexOf('\n  function ', iOpen+10));
/* 일찍 빠져나가는 길 셋이 정체성 확정보다 앞에 있어야 한다 */
var iId=body.indexOf('CUR.openedRecId = rec.id');
ok('★★ 함수 머리에서 정체성을 안 잡는다', iId > 200, 'first set @'+iId);
var iSummary=body.indexOf('summary only');
var iFused=body.indexOf('RDFUSED1');
var iDecodeFail=body.indexOf('track could not be read');
ok('★ 요약만 남은 줄 검사가 먼저', iSummary>=0 && iSummary<body.lastIndexOf('CUR.openedRecId = rec.id'),
   'summary@'+iSummary);
ok('★ 융합 세션 검사가 먼저', iFused>=0 && iFused<body.lastIndexOf('CUR.openedRecId = rec.id'));
ok('★ 압축 해제 실패 검사가 정체성보다 먼저', iDecodeFail>=0 && iDecodeFail<iId,
   'decodeFail@'+iDecodeFail+' id@'+iId);

console.log('\n[2] 정체성은 성공 지점 두 곳에서만');
var n=(code.match(/CUR\.openedRecId = rec\.id/g)||[]).length;
ok('★ 두 곳 (압축·GPX)', n===2, String(n)+'곳');
ok('압축 분기는 show() 직전', /CUR\.openedRecId = rec\.id;[\s\S]{0,80}?show\(sess, an2/.test(code));
ok('GPX 분기는 loadGpxText 직전', /CUR\.openedRecId = rec\.id;[\s\S]{0,80}?loadGpxText\(gpx/.test(code));

console.log('\n[3] ★ 모르는 장비는 기록하지 않는다');
ok('★ gearForSave 를 쓴다 (gearSnapshot 직접 아님)',
   /gear: gearForSave\(\)/.test(code) && !/gear: gearSnapshot\(\),/.test(code));
var iG=code.indexOf('function gearForSave()');
var gb=code.slice(iG, code.indexOf('\n  function ', iG+10));
ok('★ 오늘 탄 세션을 새로 올린 경우에만 지금 장비를 기록한다',
   /if \(!CUR\.openedRecId && isToday\) return gearSnapshot\(\)/.test(gb));
ok('★★ 판단 기준은 세션 날짜다 (옛 파일을 복구로 다시 올려도 안 붙는다)',
   /isToday = a\.getFullYear\(\) === b\.getFullYear\(\)/.test(gb));
ok('★ 그 줄에 기록돼 있었으면 그것을 쓴다',
   /if \(CUR\.sessionGear\) return gearSnapshot\(\)/.test(gb));
ok('★ 사용자가 직접 골랐으면 기록하되 backfilled 로 표시',
   /if \(CUR\.gearDirty\)/.test(gb) && /g\.backfilled = true/.test(gb));
ok('★★ 그 외에는 null — 모르는 건 모르는 채로', /return null;/.test(gb));
var iNull=gb.indexOf('return null;');
var iDirty=gb.indexOf('if (CUR.gearDirty)');
ok('null 이 마지막 (앞 조건들이 먼저 걸린다)', iNull>iDirty);

console.log('\n[4] 빈 gear 를 넘겨도 기존 장비는 안 지워진다 (§537 규칙)');
var st=fs.readFileSync(path.join(__dirname,'js/storage.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
ok('★ prev.gear 보존 규칙 유지', /if \(prev\.gear && !rec\.gear\) rec\.gear = prev\.gear/.test(st));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
