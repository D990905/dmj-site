/* §560 차트 포인트 오버레이 + §561 축 단위·설명 정합성
   옥대표: "그래프 상의 동그라미 포인트에 커서가 도달했을때 오버레이로 해당
           포인트의 정보를 간략히 요약해서 노출시켜줘."
          "좌측그래프에 세로축 단위추가. 그래프에 대한 설명이 저게 적합한건지
           의문. 설명을 할거면 두그래프들 다 하고 안할거면 둘다 하지말고." */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }

var tipSrc=fs.readFileSync(path.join(__dirname,'js/chart-tip.js'),'utf8');
var tipCode=tipSrc.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 오버레이 모듈');
var g={ console:console, document:{ getElementById:function(){return null;},
  createElement:function(){return {style:{},setAttribute:function(){},appendChild:function(){}};},
  head:{appendChild:function(){}} } };
g.window=g; g.self=g; vm.createContext(g);
vm.runInContext(tipSrc, g);
ok('RDTip 이 있다', !!g.RDTip && typeof g.RDTip.attach==='function');
ok('hookInto 도 있다', typeof g.RDTip.hookInto==='function');

console.log('\n[2] ★ 내용은 값이 아니라 정체부터');
var h=g.RDTip._html({ title:'2026-06-11  오륙도', rows:[['Wind','16 kt']], note:'PPC Sonic 5.0' });
ok('제목이 먼저 나온다', h.indexOf('rdtip__h') < h.indexOf('rdtip__r'));
ok('행이 키/값으로 나뉜다', /rdtip__k/.test(h) && /rdtip__v/.test(h));
ok('주석이 마지막', h.lastIndexOf('rdtip__n') > h.indexOf('rdtip__r'));
ok('★ HTML 이스케이프 (세션 이름이 사용자 입력이다)',
   g.RDTip._html({title:'<img src=x onerror=1>'}).indexOf('<img')<0);

console.log('\n[3] 위치');
ok('★ 커서가 아니라 점의 좌표에 붙인다', /u\.valToPos\(xVal, 'x'\)/.test(tipCode));
ok('★ 차트 밖으로 나가면 좌우를 뒤집는다', /if \(left \+ w > u\.over\.clientWidth\) left = x - w - 14/.test(tipCode));
ok('위로 넘치면 아래로', /if \(top < 0\) top = y \+ 14/.test(tipCode));
ok('마우스가 벗어나면 숨긴다', /addEventListener\('mouseleave', hide\)/.test(tipCode));
ok('★ 같은 점에서 다시 그리지 않는다', /if \(idx === prev\) return;/.test(tipCode));
ok('★ build 가 터져도 차트를 죽이지 않는다', /\[RDTip\] build failed/.test(tipCode));
ok('★ 기존 setCursor 훅을 덮지 않는다', /if \(u\.hooks\.setCursor\) u\.hooks\.setCursor\.push/.test(tipCode));
ok('reduced-motion 존중', /prefers-reduced-motion/.test(tipCode));
ok('포인터 이벤트를 가로채지 않는다', /pointer-events:none/.test(tipCode));

console.log('\n[4] 배선 — 시즌 흐름은 "어느 세션인지"를 말한다');
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');
ok('★ 시즌 흐름에 붙었다', /RDTip\.attach\(seasonU/.test(code));
ok('★ 제목이 날짜 + 세션 이름', /\(r\.name \|\| 'Session'\)/.test(code));
ok('★ 풍속·거리·점수를 같이 준다', /rows\.push\(\['Wind'/.test(code)
   && /rows\.push\(\['Distance'/.test(code) && /rows\.push\(\['Score'/.test(code));
ok('★ 고른 지표가 점수면 점수를 두 번 적지 않는다', /md\.key !== 'sps'/.test(code));
ok('장비가 없으면 없다고 적는다', /'No gear recorded'/.test(code));
ok('★ plots 는 {u,host} 라 .u 를 꺼낸다', /plots\[plots\.length - 1\]\.u/.test(code));

console.log('\n[5] 배선 — 속도 분포는 "비중"을 말한다');
ok('★ 히스토그램에 붙었다', /RDTip\.attach\(histU/.test(code));
ok('★ 시간과 비중을 함께', /\['Share', share\.toFixed\(1\) \+ '%'\]/.test(code));
ok('★ 포일링 임계 아래인지 밝힌다', /Below the foiling threshold/.test(code));
ok('★ §541 에서 지운 thrKt 를 다시 쓰지 않는다 (foilKt 로 새로 낸다)',
   !/thrKt/.test(code) && /var foilKt = foilThresholdMs\(\) \* KT;/.test(code));

console.log('\n[6] §561 축 단위와 설명');
var mm=fs.readFileSync(path.join(__dirname,'js/chart-meanmax.js'),'utf8');
ok('★ 세로축에 단위가 붙는다', /v\.toFixed\(0\) \+ ' kt'/.test(mm));
ok('단위가 붙은 만큼 축 폭을 키웠다', /size: 54/.test(mm));
ok('null 눈금을 그대로 흘리지 않는다', /\(v == null \|\| !isFinite\(v\)\) \? null/.test(mm));

var htmlRaw=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
/* ⚠ 주석 안에 옛 문구를 인용해 두었다. 주석을 코드로 세면 안 된다. */
var html=htmlRaw.replace(/<!--[\s\S]*?-->/g,'');
console.log('\n[7] ★★ 설명이 실제로 그리는 것과 맞는가');
ok('★★ 곡선이 시간 피크 + 거리 기록임을 밝힌다',
   /The 2 s and 10 s points\s+come from time windows/.test(html.replace(/\s+/g,' ').replace(/ /g,' ')) ||
   /2 s and 10 s points/.test(html));
ok('★★ 로그축이 **지속시간**임을 밝힌다 (노트가 아니라)',
   /duration on a log scale/.test(html) && !/knots · log scale/.test(html));
ok('Alpha 가 곡선 밖인 이유가 남아 있다', /gated course/.test(html));
ok('★ 두 그래프 모두 설명이 있다 (옥대표: 둘 다 아니면 둘 다 없이)', (function(){
  var i=html.indexOf('id="chart-meanmax"'), j=html.indexOf('id="chart-hist"');
  var a=html.slice(i, i+1400), b=html.slice(j, j+1400);
  return /card-footer/.test(a) && /card-footer/.test(b); })());
ok('★ 오른쪽 설명이 낮은 속도 막대의 뜻을 말한다',
   /below foiling speed/.test(html) && /not yet spent riding/.test(html));

console.log('\n[8] 로드 순서');
ok('chart-tip 이 v2-app 보다 먼저', html.indexOf('chart-tip.js') < html.indexOf('js/v2-app.js'));
ok('meanmax 캐시버스트가 갱신됐다', /chart-meanmax\.js\?v=v561/.test(html));

console.log('\n[9] ★★ §562 — 포일 끊김 설명이 숫자와 맞는가');
console.log('    옥대표: "내가 매 턴마다 빠졌다고 말하는거야?" (12 stretch / 49 turn = 0.24)');
var appc=app.replace(/\/\*[\s\S]*?\*\//g,'');
ok('★★ 1보다 훨씬 낮은 구간을 따로 다룬다', /if \(ratio < 0\.7\) \{/.test(appc));
ok('★★ 몇 턴에 한 번인지로 말한다 (1/ratio)', /var perBreak = ratio > 0 \? \(1 \/ ratio\) : 0;/.test(appc));
ok('★ "about one break every N turns" 문구', /about one break every/.test(appc));
ok('세 구간 (낮음 · 1근처 · 높음)',
   /if \(ratio < 0\.7\)/.test(appc) && /else if \(ratio <= 1\.15\)/.test(appc)
   && /times per turn, so/.test(appc));
/* 실제 값으로 어느 가지가 잡히는지 확인 */
var ratio=12/49;
ok('★★ 옥대표 세션(0.245)은 "낮음" 가지다', ratio < 0.7, String(ratio.toFixed(3)));
ok('★ 그 가지는 "매 턴마다" 라고 말하지 않는다', (function(){
  var i=appc.indexOf('if (ratio < 0.7)');
  var seg=appc.slice(i, appc.indexOf('else if (ratio <= 1.15)', i));
  return seg.indexOf('about once per turn') < 0; })());
ok('0으로 나누지 않는다', /ratio > 0 \? \(1 \/ ratio\) : 0/.test(appc));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
