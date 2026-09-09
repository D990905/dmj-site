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
ok('곡선 쪽 설명도 그대로', html.slice(iMM, iMM+1400).indexOf('card-footer')>=0);

console.log('\n[4] 렌더 배선');
ok('★ 표를 전용 호스트에 넣는다', /splitsHost\.appendChild\(sc\)/.test(code));
ok('★ 다시 그릴 때 쌓이지 않게 비운다',
   /while \(splitsHost\.firstChild\) splitsHost\.removeChild\(splitsHost\.firstChild\)/.test(code));
ok('★ 호스트가 없으면 예전 자리로 (옛 레이아웃 보호)',
   /\} else \{\s*host\.appendChild\(sc\);\s*\}/.test(code));

console.log('\n[5] PDF 경로에 영향 없음');
ok('PDF 는 perf-extra 를 직접 쓰지 않는다', !/'perf-extra': /.test(app));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
