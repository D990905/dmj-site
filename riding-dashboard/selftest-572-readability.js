/* §572~§577 읽기 쉽게 (옥대표 5건)
   "이 두가지는 눈으로 보기가 대게 힘들다… 읽는데 시간이 너무걸려"      → §572·§573
   "이건 지도 아래에 바로 놔둬야 아래위로 보면서 참조를 하지"           → §574
   "p7 90 95에서 p는 뭐를 의미해?"                                    → §575
   "환경에 넣어둘게 아니라 퍼포먼스에 넣어야 하는거 아니니?"            → §576
   "폴라그래프랑 상관관계 그래프 모두 퍼포먼스 탭으로 이동시켜"          → §577 */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');
var htmlRaw=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
var html=htmlRaw.replace(/<!--[\s\S]*?-->/g,'');

console.log('[1] §572 폴라 — 표가 아니라 극좌표로');
ok('★ 폴라 SVG 빌더가 있다', /function polarSvg\(buckets, cols, grid, colors\)/.test(code));
ok('★ 차트를 먼저 그린다', /body\.appendChild\(polarSvg\(live, cols, grid, BUCKET_COLORS\)\)/.test(code));
/* ⚠ 문자열이 파일 어딘가 있는지만 보면 안 된다. 실제로 §572 블록이
   drawBinGrid 안에 들어갔고, Bin table 이 접혀 있어 실행조차 안 돼
   화면에 아무 티도 안 났다. 이 테스트는 그걸 못 잡았다(§558b 와 같은 실수).
   **어느 함수 안인지** 를 고정한다. */
function enclosingOf(needle){
  var i=code.indexOf(needle); if(i<0) return null;
  var re=/\n  function (\w+)\(/g,m,last=null,head=code.slice(0,i);
  while((m=re.exec(head))) last=m[1]; return last;
}
ok('★★ 폴라 차트 호출이 renderPolarGrid 안이다 (drawBinGrid 아님)',
   enclosingOf('polarSvg(live, cols, grid, BUCKET_COLORS)')==='renderPolarGrid',
   String(enclosingOf('polarSvg(live, cols, grid, BUCKET_COLORS)')));
ok('★★ 숫자 접기 토글도 renderPolarGrid 안이다',
   enclosingOf("'Show the numbers'")==='renderPolarGrid',
   String(enclosingOf("'Show the numbers'")));
ok('★ 바람대마다 색 범례', /BUCKET_COLORS\[bi % BUCKET_COLORS\.length\]/.test(code));
ok('★★ 표는 지우지 않고 접어 둔다', /wrap\.style\.display = 'none'/.test(code)
   && /'Show the numbers'/.test(code));
ok('★★ 빈 각도에서 선을 끊는다 (없는 데이터를 잇지 않는다)',
   /\} else if \(run\.length\) \{ segs\.push\(run\); run = \[\]; \}/.test(code));
ok('★ 점 하나뿐인 구간은 선 대신 점', /if \(seg\.length === 1\)/.test(code));

console.log('\n[2] §572 기하 — 실제 좌표로 검증');
var R=250, cx=112, cy=R+46, W=cx+R+112, H=2*R+92;
function P(d,kt,top){var t=d*Math.PI/180,r=(kt/top)*R;return [cx+Math.sin(t)*r, cy-Math.cos(t)*r];}
ok('★ 코드의 기하가 이 값과 같다',
   /var R = 250, cx = 112, cy = R \+ 46, W = cx \+ R \+ 112, H = 2 \* R \+ 92;/.test(code));
[[0,'위'],[90,'오른쪽'],[180,'아래']].forEach(function(p){
  var q=P(p[0],25,25);
  ok('★ '+p[0]+'° 가 '+p[1]+'이고 viewBox 안', q[0]>=0&&q[0]<=W&&q[1]>=0&&q[1]<=H,
     Math.round(q[0])+','+Math.round(q[1]));
});
ok('★★ 0° 가 위 (y 가 가장 작다)', P(0,25,25)[1] < P(180,25,25)[1]);
ok('★ 각도 라벨도 안에 든다', (function(){
  return [0,90,180].every(function(d){
    var lx=cx+Math.sin(d*Math.PI/180)*(R+22), ly=cy-Math.cos(d*Math.PI/180)*(R+22);
    return lx>=0&&lx<=W&&ly>=0&&ly<=H; }); })());
ok('폴라 눈금 글자가 테마 토큰을 쓴다', /\.pol-tick \{[^}]*fill: var\(--tblr-secondary\)/.test(html));

console.log('\n[3] §573 Bin table — 접어 둔다');
ok('★ 기본 닫힘', /var BINTABLE_OPEN = false;/.test(code));
ok('★ 여닫는 버튼', /BINTABLE_OPEN \? 'Hide' : 'Open'/.test(code));
ok('★★ 왜 접었는지 설명한다 (Tack bias 가 더 읽기 쉽다)',
   /answered more legibly by Tack bias above/.test(code));
ok('★ 지우지 않았다 (열면 그대로)', /function renderBinTable\(host, a\)/.test(code));
/* §588 — Bin table 은 퍼포먼스 탭(#wind-analysis-host)으로 옮겼다. 접기를
   누르면 그 호스트만 다시 그린다. 컨디션 탭 전체(웰니스·트랙 차트)를
   다시 그리면 입력 중이던 화면이 통째로 바뀐다. */
ok('★★ 재렌더는 그 호스트만 — renderWindAnalysis(a), 스스로 비운다',
   (code.match(/BINTABLE_OPEN = (true|false); renderWindAnalysis\(a\);/g) || []).length === 2
   && /function renderWindAnalysis\(a\) \{\s*\n\s*var h = \$\('wind-analysis-host'\);\s*\n\s*if \(h\) \{ while \(h\.firstChild\) h\.removeChild\(h\.firstChild\); \}/.test(code)
   && !/renderEnvironment\(host, a\)/.test(code));

console.log('\n[4] §574 풍향 출처를 지도 아래로');
ok('★ 지도 아래 호스트가 있다', /id="wind-sources-host"/.test(html));
var iMap=html.indexOf('id="map-host"'), iWs=html.indexOf('id="wind-sources-host"'),
    iSeg=html.indexOf('id="segment-stepper"');
ok('★ 지도 다음, 구간 스테퍼 앞', iMap<iWs && iWs<iSeg, 'map@'+iMap+' ws@'+iWs+' seg@'+iSeg);
ok('★ 그 호스트에 그린다', /renderWindSources\(wsHost, a\)/.test(code));
ok('★ 다시 그릴 때 쌓이지 않게 비운다',
   /while \(wsHost\.firstChild\) wsHost\.removeChild\(wsHost\.firstChild\)/.test(code));
ok('★ 호스트가 없으면 예전 자리 (옛 레이아웃 보호)', /renderWindSources\(host, a\);/.test(code));

console.log('\n[5] §575 백분위를 사람 말로');
ok('★★ p75/p90/p95 라벨이 사라졌다', !/'p' \+ p/.test(code));
ok('★ 상위 N% 로 적는다', /var topPct = 100 - p;/.test(code) && /'Top ' \+ topPct \+ '%'/.test(code));
ok('★ 헤더도 바꿨다', /\['Your best', 'VMG', 'Speed', 'CWA'\]/.test(code));
ok('★★ 한 표 안의 어법을 통일했다', /'Today, best 30%'/.test(code));
ok('★ 요약 문장도', /% of your top-10% VMG target\./.test(code));
ok('★ 원래 정의는 툴팁에 남긴다', /'th percentile of your ' \+ band\.windowSec/.test(code));
/* 산술 확인 — p90 은 상위 10% 가 맞다 */
ok('★★ p90 → Top 10%', (100-90)===10);
ok('★★ p75 → Top 25%', (100-75)===25);

console.log('\n[6] §576·§577 카드를 퍼포먼스로');
function enclosing(name){
  var i=code.indexOf(name); if(i<0) return null;
  var re=/\n  function (\w+)\(/g,m,last=null,head=code.slice(0,i);
  while((m=re.exec(head))) last=m[1]; return last;
}
ok('★★ Target band 가 퍼포먼스에 있다', enclosing('renderTargetComparison(host, a); } catch')==='renderPerfExtra');
ok('★★ 폴라가 퍼포먼스에 있다', enclosing('renderPolarGrid(host, a); } catch')==='renderPerfExtra');
ok('★★ 상관 산점도가 퍼포먼스에 있다', enclosing('renderCorrelation(host, a); } catch')==='renderPerfExtra');
ok('★ 환경 탭에서는 빠졌다',
   !/    renderPolarGrid\(host, a\);\n    renderBinTable/.test(code)
   && !/    renderCorrelation\(host, a\);\n    renderGainLoss/.test(code));
/* §588 (옥대표 "컨디션 ... 다른곳에서는 해당 항목을 제거") — 컨디션 탭에는
   조건(바람·트랙·장비·바다·몸)만. Bin table·회전 손실은 결과라 퍼포먼스로. */
ok('★ Bin table · 회전 손실은 퍼포먼스 호스트로',
   /try \{ renderBinTable\(h, a\); \}/.test(code) && /try \{ renderGainLoss\(h, a\); \}/.test(code)
   && /id="wind-analysis-host"/.test(html)
   && html.indexOf('id="wind-analysis-host"') > html.indexOf('id="tab-perf"')
   && html.indexOf('id="wind-analysis-host"') < html.indexOf('id="tab-track"'));
ok('★ 풍향 변화(그날 바람)는 컨디션에 남는다', /try \{ renderWindVariation\(host, a\); \}/.test(code));
ok('★ 옮긴 셋 모두 실패해도 스택을 남긴다',
   /\[v2 §576\] target band/.test(code) && /\[v2 §577\] polar grid/.test(code)
   && /\[v2 §577\] correlation/.test(code));

console.log('\n[7] §578 바람 확인을 첫 탭으로 · 폴라/VMG 도 퍼포먼스로');
console.log('    옥대표: "바람 각도 확인하는것도 파일 업로드하면 처음에 바로 떠야하잖아"');
var navOrder=(html.match(/href="#(tab-[a-z]+)"/g)||[]).map(function(x){return x.slice(7,-1);});
ok('★★ 첫 탭이 바람(tab-env)', navOrder[0]==='tab-env', navOrder.slice(0,3).join(','));
ok('★ 그다음이 퍼포먼스', navOrder[1]==='tab-perf');
ok('★ 첫 탭이 active', /href="#tab-env" class="nav-link active"/.test(html));
ok('★ 퍼포먼스는 active 아님', /href="#tab-perf" class="nav-link"/.test(html)
   && !/href="#tab-perf" class="nav-link active"/.test(html));
var paneOrder=(html.match(/id="(tab-[a-z]+)" class="tab-pane/g)||[]).map(function(x){return x.slice(4).split('"')[0];});
ok('★★ 패널 순서도 바람이 먼저', paneOrder[0]==='tab-env', paneOrder.slice(0,3).join(','));
ok('★ 바람 패널이 active show', /id="tab-env" class="tab-pane active show"/.test(html));
/* §588 — Wind → Condition (옥대표 "윈드라고 하지말고 컨디션이라고") */
ok('★ 첫 탭 이름이 Condition', /href="#tab-env" class="nav-link active"[^>]*>Condition</.test(html));

ok('★ 폴라·VMG 호스트가 퍼포먼스 탭에 있다', /id="polar-vmg-host"/.test(html));
var iPv=html.indexOf('id="polar-vmg-host"'), iPerfPane=html.indexOf('id="tab-perf"'),
    iTrackPane=html.indexOf('id="tab-track"');
ok('★★ 그 호스트가 퍼포먼스 패널 안이다', iPerfPane<iPv && iPv<iTrackPane);
ok('★ 그 호스트에 그린다', /pvHost\.appendChild\(grid\)/.test(code));
ok('★ 다시 그릴 때 쌓이지 않게 비운다',
   /while \(pvHost\.firstChild\) pvHost\.removeChild\(pvHost\.firstChild\)/.test(code));
ok('★ 호스트가 없으면 예전 자리 (옛 레이아웃 보호)', /host\.appendChild\(grid\);/.test(code));
ok('★★ 렌더 순서가 안전하다 (퍼포먼스 먼저, 환경 나중)',
   code.indexOf('renderPerfExtra(analysis)') < code.indexOf('renderEnvironment(analysis, est)'));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
