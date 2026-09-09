/* §563 mean-max 곡선과 speed splits 표를 나란히
   옥대표: "이 두가지가 혹시 같은 내용이면 두개를 아래위로 나열하거나
           좌우로 나열하는게 좋을듯해 좌우가 더 좋겟지?"

   맞다 — 둘은 같은 데이터다. 표(splitRows)와 곡선(toDurationSeries+alphaPoint)이
   똑같이 peaks + distanceBests + alpha 에서 나온다. 코드 주석(§450)에도 "곡선이
   모양을 보여주고 이 표가 그 앵커 값을 준다"고 적혀 있었는데, 배치만 멀리
   떨어져 있어 같은 것인 줄 알 수 없었다. */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');
var mm=fs.readFileSync(path.join(__dirname,'js/chart-meanmax.js'),'utf8');
var mmc=mm.replace(/\/\*[\s\S]*?\*\//g,'');
var htmlRaw=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
var html=htmlRaw.replace(/<!--[\s\S]*?-->/g,'');

console.log('[1] ★★ 정말 같은 데이터인가 (배치를 바꾸기 전에 확인할 것)');
ok('★ 표가 peaks 를 쓴다', /a\.peaks/.test(code) || /peaks/.test(code));
ok('★ 표가 distanceBests 를 쓴다', /\(a\.distanceBests \|\| \[\]\)\.forEach/.test(code));
ok('★ 표가 alpha 를 쓴다', /a\.alpha && a\.alpha\.speedMs > 0/.test(code));
ok('★ 곡선도 peaks 를 쓴다', /analysis && analysis\.peaks/.test(mmc));
ok('★ 곡선도 distanceBests 를 쓴다', /analysis && analysis\.distanceBests/.test(mmc));
ok('★ 곡선도 alpha 를 쓴다', /analysis && analysis\.alpha/.test(mmc));
ok('★★ 1NM 라벨 규칙이 양쪽 동일 (같은 데이터라는 증거)',
   /d\.distanceM === 1852 \? '1 NM'/.test(code) && /d\.distanceM === 1852 \? '1 NM'/.test(mmc));

console.log('\n[2] 배치 — 좌우로 나란히');
ok('★ 표 전용 호스트가 있다', /id="splits-host"/.test(html));
var iMM=html.indexOf('id="chart-meanmax"'), iSP=html.indexOf('id="splits-host"');
ok('★ 곡선이 왼쪽, 표가 오른쪽', iMM>=0 && iSP>iMM, 'mm@'+iMM+' sp@'+iSP);
ok('★ 같은 행이다 (사이에 col-12 이 없다)',
   html.slice(iMM, iSP).indexOf('col-12') < 0);
ok('곡선 col-lg-7 · 표 col-lg-5',
   /col-lg-7[\s\S]{0,1200}id="chart-meanmax"/.test(html)
   && /col-lg-5"><div id="splits-host"/.test(html));

console.log('\n[3] Time at speed 는 자기 줄로 내려갔다');
var iH=html.indexOf('id="chart-hist"');
ok('★ 표보다 아래', iH>iSP);
ok('★ 전체 폭(col-12)', /col-12">\s*<div class="card">\s*<div class="card-header">\s*<h3 class="card-title">Time at speed/.test(html));
ok('설명은 그대로 붙어 있다 (§561 — 둘 다 아니면 둘 다 없이)',
   html.slice(iH, iH+1200).indexOf('card-footer')>=0);
/* §567 — 곡선 쪽 설명은 카드 밖 전체 폭으로 옮겼다(옥대표). 없어진 게
   아니라 자리가 바뀐 것이므로, 카드 안이 아니라 **행 안에** 있는지 본다. */
ok('곡선 쪽 설명도 남아 있다 (카드 밖 전체 폭으로 이동)',
   html.slice(iMM, iH).indexOf('Both panels show the same seven numbers')>=0);

console.log('\n[4] 렌더 배선');
ok('★ 표를 전용 호스트에 넣는다', /splitsHost\.appendChild\(sc\)/.test(code));
ok('★ 다시 그릴 때 쌓이지 않게 비운다',
   /while \(splitsHost\.firstChild\) splitsHost\.removeChild\(splitsHost\.firstChild\)/.test(code));
ok('★ 호스트가 없으면 예전 자리로 (옛 레이아웃 보호)',
   /\} else \{\s*host\.appendChild\(sc\);\s*\}/.test(code));

console.log('\n[5] PDF 경로에 영향 없음');
ok('PDF 는 perf-extra 를 직접 쓰지 않는다', !/'perf-extra': /.test(app));

console.log('\n[6] §567 — 곡선에도 오버레이 · 설명은 전체 폭');
console.log('    옥대표: "마우스오버레이 데이터 노출이 사라짐"');
console.log('           "하단 설명이 좌측 블록에 치우쳐있는데 전체너비를 사용하도록"');
ok('★★ mean-max 곡선에 오버레이를 붙인다 (§560 은 여기만 빠져 있었다)',
   /RDTip\.attach\(mm\.plot, function \(i\)/.test(code));
ok('★ render() 가 돌려주는 points 로 **어느 구간인지**를 말한다',
   /var pt = mm\.points && mm\.points\[i\]/.test(code) && /title: pt\.label/.test(code));
ok('★ 시간 창과 거리 기록을 구분해 적는다',
   /Best average over a ' \+ pt\.label \+ ' window'/.test(code)
   && /Best average over ' \+ pt\.label \+ ' of track'/.test(code));
ok('★ km/h 도 준다 (표와 같은 값이어야 한다)', /\(pt\.kt \/ KT \* 3\.6\)\.toFixed\(1\)/.test(code));
/* 실제 변환이 표와 맞는지 */
var KT=1.94384;
ok('★★ 26.26 kt → 48.6 km/h (표와 일치)', (26.26/KT*3.6).toFixed(1)==='48.6');
ok('★★ 16.66 kt → 30.9 km/h (표와 일치)', (16.66/KT*3.6).toFixed(1)==='30.9');
ok('RDTip 이 없어도 안 터진다', /if \(window\.RDTip\) \{/.test(code));

ok('★★ 설명이 곡선 카드 밖 전체 폭에 있다', (function(){
  var iSp=html.indexOf('id="splits-host"');
  var seg=html.slice(iSp, iSp+900);
  return /col-12"[\s\S]{0,120}text-secondary/.test(seg); })());
ok('★ 곡선 카드에는 더 이상 footer 가 없다', (function(){
  var i=html.indexOf('id="chart-meanmax"');
  var seg=html.slice(i, html.indexOf('id="splits-host"'));
  return seg.indexOf('card-footer') < 0; })());
ok('★ 설명이 두 패널 다 가리킨다', /Both panels show the same seven numbers/.test(html));
ok('★ Alpha 가 왜 곡선 밖인지 구체적으로', /500 m out\s+and back inside a 50 m gate/.test(html.replace(/\s+/g,' ')) || /inside a 50 m gate/.test(html));
ok('Time at speed 설명은 자기 카드에 그대로', (function(){
  var i=html.indexOf('id="chart-hist"');
  return html.slice(i, i+1200).indexOf('card-footer')>=0; })());

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
