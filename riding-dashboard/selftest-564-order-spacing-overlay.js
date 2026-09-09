/* §564 지표 순서 · §565 판 사이 여백 · §566 타임라인 통합 오버레이 (옥대표 3건)
     "sog vmg cwa aws awa 순서로"
     "세로축 숫자들이 살짝 아래위로 겹치는 현상이 발생하지 않도록 상하그래프 사이에 공간을"
     "위 그래프 위에 커서가 움직일때 세 그래프의 지점 데이터가 오버래이로 노출되게" */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var appc=app.replace(/\/\*[\s\S]*?\*\//g,'');
var cs=fs.readFileSync(path.join(__dirname,'js/chart-stack.js'),'utf8');
var csc=cs.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] §564 지표 순서 — SOG · VMG · CWA · AWS · AWA');
ok('★ 순서를 명시한다', /var METRIC_ORDER = \['sog', 'vmg', 'twa', 'aws', 'awa'\]/.test(appc));
ok('★ 정렬한다 (엔진 순서를 그대로 쓰지 않는다)', /order\.sort\(function \(a1, b1\)/.test(appc));
ok('★ 목록 밖 지표는 뒤로', /if \(ia < 0\) return 1;/.test(appc) && /if \(ib < 0\) return -1;/.test(appc));
ok('★ 둘 다 목록 밖이면 원래 순서 유지', /if \(ia < 0 && ib < 0\) return 0;/.test(appc));
/* 실제 정렬 결과를 돌려 본다 */
var METRIC_ORDER=['sog','vmg','twa','aws','awa'];
function sortLike(arr){ return arr.slice().sort(function(a,b){
  var ia=METRIC_ORDER.indexOf(a), ib=METRIC_ORDER.indexOf(b);
  if(ia<0&&ib<0) return 0; if(ia<0) return 1; if(ib<0) return -1; return ia-ib; }); }
ok('★★ 엔진 순서(sog,twa,awa,aws,vmg) → sog,vmg,twa,aws,awa',
   sortLike(['sog','twa','awa','aws','vmg']).join(',')==='sog,vmg,twa,aws,awa',
   sortLike(['sog','twa','awa','aws','vmg']).join(','));
ok('★ heel·hr 는 뒤에 붙는다',
   sortLike(['heel','sog','hr','vmg']).join(',')==='sog,vmg,heel,hr',
   sortLike(['heel','sog','hr','vmg']).join(','));
ok('CWA 는 내부적으로 twa 키다 (§C.2.2 — 화면 라벨만 바뀌었다)',
   /twa:  'Course wind angle/.test(app));

console.log('\n[2] §565 판 사이 여백');
ok('★★ 아래 여백이 0 이 아니다 (겹침의 원인이었다)',
   /padding: \[14, 14, last \? 4 : 10, 6\]/.test(csc) && !/last \? 4 : 0/.test(csc));
ok('★ 위 여백도 늘렸다 (8 → 14)', /padding: \[14, 14/.test(csc));
ok('★ 판 높이도 키워 그림이 눌리지 않게 (150→168 · 110→128)',
   /height: 168/.test(csc) && (csc.match(/height: 128/g)||[]).length>=3);
ok('마지막 판은 x축 자리라 아래 여백이 작다', /last \? 4 : 10/.test(csc));

console.log('\n[3] §566 통합 오버레이 — 세 판을 한 상자에');
ok('★ 오버레이 요소가 있다', /tip\.className = 'rd-stack-tip'/.test(csc));
ok('★★ 판마다 따로 띄우지 않고 하나만 만든다',
   (csc.match(/document\.createElement\('div'\)[\s\S]{0,60}rd-stack-tip/g)||[]).length<=1);
ok('★ 모든 판의 값을 읽는다', /series\.panels\.forEach\(function \(pp, pi\)/.test(csc)
   && /series\.y\[pi\] \? series\.y\[pi\]\[idx\] : null/.test(csc));
ok('★ 시각은 압축 좌표가 아니라 실제 경과초로 (§486)',
   /var realSec = compToReal\(series, xComp\)/.test(csc));
ok('★ 판 색 점으로 어느 줄인지 알린다', /background:' \+ pp\.color/.test(csc));
ok('★ 값이 없으면 —', /\\u2014/.test(cs));
ok('★ host 가 static 이면 relative 로 (안 그러면 좌표가 페이지 기준)',
   /if \(getComputedStyle\(host\)\.position === 'static'\) host\.style\.position = 'relative'/.test(csc));
ok('★ 드래그 선택을 막지 않는다 (pointer-events:none)', /pointer-events:none/.test(csc));
ok('★ 차트 밖으로 나가면 좌우를 뒤집는다',
   /if \(left \+ w > host\.clientWidth\)/.test(csc));
ok('★ 아래로 넘치지 않게 가둔다', /host\.clientHeight - h - 2/.test(csc));
ok('★ 판을 벗어나면 숨긴다', /wrap\.addEventListener\('mouseleave', hideTip\)/.test(csc));
ok('★ 커서가 없으면 숨긴다', /if \(uu\.cursor\.left == null \|\| uu\.cursor\.left < 0\) \{ hideTip\(\); return; \}/.test(csc));
ok('★ 기존 setSelect 훅을 덮지 않는다',
   /setCursor: \[function \(uu\)[\s\S]{0,220}setSelect: \[function \(uu\)/.test(csc));
ok('숫자 정렬 (tabular-nums)', /tabular-nums/.test(csc));

console.log('\n[4] 판 커서는 이미 동기화돼 있다 (같은 idx 가 모든 판에 통한다)');
ok('cursor.sync 유지', /sync: \{ key: syncKey\.key \}/.test(csc));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
