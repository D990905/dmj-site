/* §569 타임라인 채널 선택(힐·피치·심박) · §570 타일 높이
   옥대표: "해당 그래프에 데이터가 있을경우 힐 피치 심박수를 모두 선택해서 노출가능하게"
          "평균 풍향 타일만 왜 사이즈가 작을까? 동일하게 수정" */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var cs=fs.readFileSync(path.join(__dirname,'js/chart-stack.js'),'utf8');
var csc=cs.replace(/\/\*[\s\S]*?\*\//g,'');
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var appc=app.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] §569 판 추가');
ok('★ 힐 판이 있다', /key: 'heel', label: 'Heel'/.test(csc));
ok('★ 피치 판이 있다', /key: 'pitch', label: 'Pitch'/.test(csc));
ok('심박 판은 원래 있었다', /key: 'hr', label: 'Heart rate'/.test(csc));
ok('★ 힐·피치는 0 기준선을 갖는다 (좌우·앞뒤 부호가 뜻을 갖는다)',
   /key: 'heel'[\s\S]{0,120}zero: true/.test(csc) && /key: 'pitch'[\s\S]{0,120}zero: true/.test(csc));
ok('★ 샘플에서 직접 읽는다', /p\.heel == null \? null : p\.heel/.test(csc)
   && /p\.pitch == null \? null : p\.pitch/.test(csc));

console.log('\n[2] ★ 값이 있는 채널과 그릴 채널을 나눈다');
ok('★ available 을 따로 만든다', /var available = PANELS\.filter/.test(csc));
ok('★ 그릴 판은 선택으로 거른다', /var panels = available\.filter/.test(csc));
ok('★ 기본은 defaultOff 가 아닌 것 (지금까지 동작 유지)',
   /if \(pick\) return pick\.indexOf\(p\.key\) >= 0;\s*return !p\.defaultOff;/.test(csc));
ok('★ 힐·피치만 기본 꺼짐 (여섯 판이 한꺼번에 쌓이지 않게)',
   (csc.match(/defaultOff: true/g)||[]).length===2);
ok('★★ 전부 꺼도 하나는 남긴다 (빈 차트를 만들지 않는다)',
   /if \(!panels\.length\) panels = available\.slice\(0, 1\)/.test(csc));
ok('available 을 밖으로 넘긴다', /panels: panels, available: available/.test(csc));

console.log('\n[3] 칩');
ok('★ 칩 바를 만든다', /pickBar\.className = 'd-flex flex-wrap align-items-center gap-1 mb-2'/.test(csc));
ok('★★ 값이 있는 채널만 칩으로 올린다 (없는 걸 눌러 빈 판을 보여주면 고장으로 읽힌다)',
   /series\.available\.forEach\(function \(p\)/.test(csc));
ok('★ 켜진 칩은 그 판 색으로 칠한다', /background:' \+ p\.color \+ ';color:#fff'/.test(csc));
ok('★ 마지막 하나는 끌 수 없다', /if \(i >= 0\) \{ if \(next\.length > 1\) next\.splice\(i, 1\); \}/.test(csc));
ok('★ 채널이 하나뿐이면 칩을 안 띄운다', /series\.available\.length > 1/.test(csc));
ok('콜백이 없으면 칩도 없다 (모듈 단독 사용 보호)', /if \(opts\.onChannels &&/.test(csc));

console.log('\n[4] v2 배선');
ok('★ 선택 상태를 들고 있다', /var TL_CHANNELS = null;/.test(appc));
ok('★ 렌더에 넘긴다', /channels: TL_CHANNELS/.test(appc));
ok('★ 누르면 다시 그린다', /TL_CHANNELS = next;\s*\n\s*renderTimeline\(CUR\.session, CUR\.analysis\)/.test(appc));
ok('기존 드래그 제외는 그대로', /onExclude: function \(a, b\) \{ addExclusion\(a, b\); \}/.test(appc));

console.log('\n[5] §570 타일 높이');
/* 같은 결함이 box() 세 곳에 있었다 — 옥대표가 본 건 하나였지만 나머지
   둘도 sub 가 비는 조건에서 똑같이 짧아진다. */
ok('★★ 타일 세 곳 모두 행 높이를 채운다 (h-100)',
   (appc.match(/p-2 rounded h-100/g)||[]).length===3,
   String((appc.match(/p-2 rounded h-100/g)||[]).length));
ok('★★ sub 가 비어도 아랫줄 자리를 만든다 (예전엔 아예 안 만들어 짧아졌다)',
   /var subEl = el\('div', 'lab', sub \|\| ''\);/.test(appc));
ok('★ 빈 자리는 읽히지 않게 숨긴다 (빈 줄을 넣는 게 아니다)',
   /subEl\.style\.visibility = 'hidden'/.test(appc));
ok('★★ 예전 조건부 append 가 전부 사라졌다 (세 곳 모두)',
   !/if \(sub\) w\.appendChild\(el\('div', 'lab', sub\)\)/.test(appc));
ok('★ 세 곳 모두 자리를 지키는 subEl 을 쓴다',
   (appc.match(/style\.visibility = 'hidden'/g)||[]).length>=3,
   String((appc.match(/style\.visibility = 'hidden'/g)||[]).length));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
