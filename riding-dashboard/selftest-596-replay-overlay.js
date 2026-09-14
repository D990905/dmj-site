/* §596 옥대표 "라이딩리플레이의 우측 실시간 그래프에도 두명의 데이터를 오버레이 ...
   하나를 조금 희미하게 ... 선택해서 진하게 보이는걸 선택할 수 있는 모드랑 vmg가 높을떄
   높은선수를 진하게 ... 자동 리더기능, 또는 앞선배를 찐하게" */
var fs=require('fs'),path=require('path');var pass=0,fail=0;
function ok(n,c,e){if(c){pass++;console.log('  ok   '+n);}else{fail++;console.log('  FAIL '+n+(e?'  '+e:''));}}
var src=fs.readFileSync(path.join(__dirname,'js/replay.js'),'utf8');
var a=src.indexOf('  var LEAD_WIN = 3'), b=src.indexOf('  function buildLeadControls(box)');
ok('★ 리더 로직 블록이 있다', a>0&&b>a);
var KT=1.9438444924406; function angDiff(x,y){return ((y-x+540)%360)-180;}
var mk=new Function('KT','angDiff','R0', 'var R=R0;'+src.slice(a,b)+'\nreturn {R:function(){return R;}, currentLead:currentLead, prep:prepGhostSeries};');
function samples(n,fn){var o=[];for(var i=0;i<n;i++)o.push(fn(i));return o;}
/* 주: 0.001°/s 북진 (≈111 m/s? 너무 큼) → 위도 1e-5/초 ≈ 1.1 m/s */
function build(meVmg, ghVmg, meStep, ghStep){
  var me=samples(60,function(i){return {t:i,lat:10+i*meStep,lng:20,speed:5,heading:0,vmg:meVmg(i)};});
  var gh=samples(60,function(i){return {t:1000+i,lat:10+i*ghStep,lng:20.001,speed:5,heading:0,vmg:ghVmg(i)};});
  var R={samples:me,t0:0,windDir:0,title:'Me',ghost:{session:{samples:gh},align:{offsetSec:0},label:'G',color:'#B86BFF'},leadMode:'vmg',lead:'me'};
  return mk(KT,angDiff,R);
}
console.log('[1] 자동: VMG');
var E=build(function(){return 5;},function(i){return i<30?4:6;},1e-5,1e-5);
ok('★★ 초반은 내가 VMG 높다 → me', E.currentLead(10)==='me');
ok('★★ 고스트가 올라가면 ghost', E.currentLead(40)==='ghost');
var E2=build(function(){return 5;},function(){return 5.1;},1e-5,1e-5);
ok('★★ 여유(0.15) 안의 차이로는 안 바뀐다 (깜빡임 방지)', E2.currentLead(20)==='me');
console.log('\n[2] 자동: 앞선 배');
var E3=build(function(){return 1;},function(){return 1;},1e-5,2e-5); E3.R().leadMode='ahead';
ok('★★ 더 멀리 간 고스트가 앞 → ghost', E3.currentLead(30)==='ghost', E3.R().leadWhy);
ok('★ 이유 문장에 m', /\d+ m (ahead|behind)/.test(E3.R().leadWhy));
var E4=build(function(){return 1;},function(){return 1;},2e-5,1e-5); E4.R().leadMode='ahead';
ok('★★ 내가 더 멀리 → me', E4.currentLead(30)==='me');
console.log('\n[3] 고정 모드');
E4.R().leadMode='ghost'; ok('★★ ghost 고정', E4.currentLead(30)==='ghost');
E4.R().leadMode='me'; ok('★★ me 고정', E4.currentLead(30)==='me');
console.log('\n[4] 고스트 twa·vmg 채우기');
var E5=build(function(){return 1;},function(){return null;},1e-5,1e-5);
E5.R().ghost.session.samples.forEach(function(s){s.heading=60; s.twa=null;});
E5.prep(); var g0=E5.R().ghost.session.samples[5];
ok('★★ 풍향 0°·헤딩 60° → twa 60, vmg = 5·cos60 = 2.5', Math.abs(g0.twa-60)<1e-9 && Math.abs(g0.vmg-2.5)<1e-9, g0.twa+' '+g0.vmg);
console.log('\n[5] 그리기 배선');
ok('★★ 흐린 쪽 먼저, 진한 쪽 나중 (진한 선이 위)', /if \(R\.ghost && lead === 'me'\) drawGhostLine\(DIM, 1\.6\);/.test(src) && /if \(R\.ghost && lead === 'ghost'\) drawGhostLine\(1, 2\.2\);/.test(src));
ok('★★ 같은 Y축 (창 범위에 고스트 포함)', /두 선수가 같은 축을 써야/.test(src));
ok('★ 값 두 개 — 순서는 늘 나 · 상대', /g\.valEl\.innerHTML = a1 \+ ' \\u00b7 ' \+ b1;/.test(src));
ok('★ 모드 버튼 넷', /\['vmg', 'Auto: VMG'\], \['ahead', 'Auto: ahead'\]/.test(src));
ok('★ 리더 판정은 프레임당 한 번', /R\.leadNow = currentLead\(playT\);/.test(src));
ok('캐시버스트 (v596 이상)', (function(){var m=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8').match(/replay\.js\?v=v(\d+)/);return m&&+m[1]>=596;})());
console.log('\n'+(fail?'FAIL':'PASS')+'  '+pass+'/'+(pass+fail));process.exit(fail?1:0);
