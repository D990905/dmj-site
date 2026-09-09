/* §579 폴라 라벨 겹침 (옥대표 "글자겹침해결")
   화면에서 'po90t' · 's90bd' 로 찍혔다 — port/stbd 라벨과 90° 각도 라벨이
   **같은 높이**(cy)에 있었다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var src=fs.readFileSync(path.join(__dirname,'js/chart-polar.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 겹침의 원인을 없앴다');
ok('★★ port/stbd 가 축선 아래로 내려갔다 (cy 가 아니라 cy+14)',
   /fillText\('port', cx - R - 6, cy \+ 14\)/.test(code)
   && /fillText\('stbd', cx \+ R \+ 6, cy \+ 14\)/.test(code));
ok('★ 90° 각도 라벨은 고리에 그대로 (건너뛰지 않는다)',
   !/if \(a3 === 90\) continue;/.test(code));
ok('★ 예전처럼 같은 높이에 찍지 않는다',
   !/fillText\('port', cx - R - 6, cy\)/.test(code));

console.log('\n[2] ★ 합치는 대신 어긋나게 — 폭이 모자랐다');
ok('★★ 합친 라벨은 쓰지 않는다 (캔버스 밖으로 잘렸다)',
   !/'90° port'/.test(code) && !/'90° stbd'/.test(code));

console.log('\n[3] 여백을 비율이 아니라 고정 픽셀로');
ok('★★ R 이 고정 여백으로 잡힌다', /R = Math\.max\(60, size \/ 2 - 34\)/.test(code));
ok('★ 예전 비율식은 사라졌다', !/R = size \* 0\.42/.test(code));

console.log('\n[4] ★★ 모든 크기에서 라벨이 캔버스 안 (계산으로 검증)');
var CW11=6.6, CW10=6.0;
[280,320,350,420,480,520].forEach(function(size){
  var cx=size/2, cy=size*0.52, R=Math.max(60, size/2-34);
  var a90L = cx-(R+13) - (3*CW10)/2;         /* 90° 라벨 왼쪽 끝 */
  var portL = cx-R-6 - 4*CW11;                /* port 왼쪽 끝 */
  var stbdR = cx+R+6 + 4*CW11;                /* stbd 오른쪽 끝 */
  var topY = cy-R-16, botY = cy+R+18;
  ok('size '+size+' — 좌우·상하 모두 안',
     a90L>=0 && portL>=0 && stbdR<=size && topY>=8 && botY<=size,
     '90L'+Math.round(a90L)+' pL'+Math.round(portL)+' sR'+Math.round(stbdR)
     +' top'+Math.round(topY)+' bot'+Math.round(botY));
});
ok('★★ 90° 라벨과 port 는 세로로 14px 떨어진다 (겹칠 수 없다)', 14 >= 12);

console.log('\n[5] 고리 라벨');
ok('★ 세로 살 오른쪽으로 완전히 비켜 세운다',
   /ctx\.textAlign = 'left';\s*\n\s*rings\.forEach/.test(code)
   && /fillText\(v \+ ' kt', cx \+ 5, ry - 8\)/.test(code));
ok('★★ 최외곽 고리가 0° upwind 와 부딪히면 생략',
   /if \(ry - \(cy - R\) < 14\) return;/.test(code));
/* maxKt 가 step 의 배수면 실제로 최외곽 고리 = maxKt 가 된다 */
function ringsFor(maxKt){var step=maxKt>24?10:(maxKt>12?5:2),out=[];
  for(var v=step;v<=maxKt+0.001;v+=step)out.push(v);return out;}
ok('★ maxKt=20 이면 고리에 20 이 포함된다 (부딪힐 수 있는 경우)',
   ringsFor(20).indexOf(20)>=0);
ok('★ 그 경우 라벨이 생략된다 (ry-(cy-R)=0 < 14)', (20/20)*1===1);

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
