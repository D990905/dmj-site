/* §598 옥대표 "말이안됨" — 풍상 최적각 4° · VMG 13.4 kt.
   택을 돌면 보드가 0° 부근을 통과한다. 25 Hz RaceBox 는 그 0.4 s 가 56표본이 되어
   폴라 빈을 채웠고, 표본 '개수' 기준(15)도 0.6 s 면 넘었다.
   실측(9/14 RaceBox 4세션, 전후): 풍상 최적 4°·4°·34°·34° → 49°·41°·49°·41°. */
var fs=require('fs'),path=require('path');var pass=0,fail=0;
function ok(n,c,e){if(c){pass++;console.log('  ok   '+n);}else{fail++;console.log('  FAIL '+n+(e?'  '+e:''));}}
global.window=global;
var Pol=require('./js/chart-polar.js')||global.RDPolar;if(!Pol||!Pol.optimalAngle)Pol=global.RDPolar;
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var m=app.match(/  var TURN_PAD_SEC = 2;[\s\S]*?\n  function heldPolar\(a\) \{[\s\S]*?\n  \}\n/);
ok('★ heldPolar 를 떼어 낼 수 있다', !!m);
/* 합성: 25 Hz, 풍향 0°. 45° 로 60 s (15 kt) · 회전 8번 — 매번 0.4 s 동안 4° 를 13.4 kt 로 통과 */
var S=[],t=0,KT=1.943844,mans=[];
function push(hd,kt){S.push({t:t,heading:hd,speed:kt/KT});t+=0.04;}
for(var r=0;r<8;r++){
  for(var i=0;i<25*60;i++)push(r%2?315:45,15);
  var st=S.length;for(var j=0;j<25*3;j++)push((r%2?315:45)+(r%2?1:-1)*(j/75)*90,14);
  for(var j2=0;j2<10;j2++)push(4,13.4);      /* 0° 부근 통과 */
  var en=S.length-1;mans.push({startIdx:st,endIdx:en});
}
var nB=24,bd=7.5;function bins(filter){var b=[];for(var k=0;k<nB;k++)b.push([]);S.forEach(function(p,i){if(filter&&!filter(i))return;var tw=Math.abs(((p.heading-0+540)%360)-180);b[Math.min(nB-1,Math.floor(tw/bd))].push(p.speed);});
  return b.map(function(l,k){var s=0;l.forEach(function(v){s+=v;});return {twaCenter:(k+.5)*bd,count:l.length,avgMs:l.length?s/l.length:0,p95Ms:0,p90Ms:0};});}
var a={windDir:0,polar:{binDeg:bd,combined:bins(),port:bins(),starboard:bins()},maneuvers:mans,summary:{}};
var before=Pol.optimalAngle(a.polar.combined,'upwind');
ok('★ (재현) 거르지 않으면 30° 안쪽 통과각이 최적으로 뽑힌다', before.twaDeg<30, before.twaDeg);
var heldPolar=new Function('CUR',m[0]+'; return heldPolar;')({session:{samples:S}});
var hp=heldPolar(a);
var hz=25,needN=Math.max(15,Math.round(15*hz));
var after=Pol.optimalAngle(hp.combined,'upwind',needN);
ok('★★ 회전 표본을 빼면 45° 부근이 최적', after.ok && Math.abs(after.twaDeg-45)<8, after.twaDeg);
ok('★★ 0~30° 빈은 비어 그려지지 않는다', hp.combined.filter(function(b){return b.twaCenter<30&&b.count>0;}).length===0);
ok('★ 뺀 표본 수를 넘긴다', hp.turnSamplesRemoved>0);
console.log('\n[배선]');
ok('★★ 폴라 그림도 걸러진 폴라', /RDPolar\.render\(polarHost, heldPolar\(a\),/.test(app));
ok('★★ 최적각도 걸러진 폴라', /var hp = heldPolar\(a\);\s*\/\*[^*]*\*\/\s*var bins = hp\.combined/.test(app));
ok('★★ 최소 근거는 초 단위 (기록 간격 무관)', /var needN = Math\.max\(15, Math\.round\(OPT_MIN_SEC \* hz\)\);/.test(app) && /RDPolar\.optimalAngle\(bins, 'upwind', needN\)/.test(app));
ok('★ 표본 수 대신 초로 표시', /' s at this angle'/.test(app));
console.log('\n'+(fail?'FAIL':'PASS')+'  '+pass+'/'+(pass+fail));process.exit(fail?1:0);
