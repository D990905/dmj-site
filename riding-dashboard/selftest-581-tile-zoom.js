/* §581 위성 타일이 회색 안내판으로 뜨던 것 (옥대표 "왜 이럴까" — Map data not yet available)

   maxNativeZoom 이 없어서 Esri 에 없는 줌까지 타일을 요청했다. Esri 는 그때
   'Map data not yet available' 회색 타일을 200 OK 로 돌려준다 — 그래서 오류로도
   안 잡힌다.

   라이브 실측(캔버스 픽셀 판정, grey 비율 + 평균 밝기):
     새만금 앞바다(35.7019,126.5295)  z15 imagery · z16 imagery · z17 imagery
                                      · z18 imagery · z19 PLACEHOLDER(grey 1.00, mean 205)
     부산 송정(35.1587,129.1604)      z16~z19 전부 imagery
   → 커버리지는 장소마다 다르다. z18 을 native 상한으로 두고 z19 는 확대해 쓴다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var v2=fs.readFileSync(path.join(__dirname,'js/map-v2.js'),'utf8');
var tac=fs.readFileSync(path.join(__dirname,'js/map-tactical.js'),'utf8');

console.log('[1] 두 지도 모듈 모두 native 상한을 둔다');
ok('★★ map-v2 위성에 maxNativeZoom 18', /maxZoom: 19, maxNativeZoom: 18/.test(v2));
ok('★★ map-tactical 위성에 maxNativeZoom 18', /maxZoom: 19, maxNativeZoom: 18/.test(tac));
ok('★ 확대 자체는 막지 않는다 (maxZoom 은 19 그대로)',
   /maxZoom: 19/.test(v2) && /maxZoom: 19/.test(tac));

console.log('\n[2] OSM 은 건드리지 않는다 (z19 전역 커버리지)');
var osmV2=v2.slice(v2.indexOf('openstreetmap'), v2.indexOf('openstreetmap')+200);
ok('★ OSM 에는 maxNativeZoom 을 걸지 않았다', osmV2.indexOf('maxNativeZoom')<0);

console.log('\n[3] 근거가 코드에 남아 있다');
ok('★★ 실측 좌표·줌이 주석에 있다', /새만금 앞바다/.test(v2) && /z19 안내판/.test(v2));
ok('★★ 장소마다 다르다는 사실을 적었다', /커버리지는 \*\*장소마다 다르다\*\*/.test(v2)
   || /커버리지가 장소마다 다르다/.test(tac));
ok('★ 흐려지는 대가를 밝혔다', /흐린 지도가 낫다/.test(v2));

console.log('\n[4] ★ Esri 안내판은 200 OK 라 오류로 안 잡힌다 — 판정 기준을 기록');
/* 회색 비율 > 0.9 이고 평균 밝기 > 190 이면 안내판. 실측값으로 고정한다. */
function isPlaceholder(grey, mean){ return grey > 0.9 && mean > 190; }
ok('★★ 새만금 z19 (grey 1.00, mean 205) → 안내판', isPlaceholder(1.00, 205));
ok('★ 새만금 z18 (grey 0.00, mean 73) → 영상', !isPlaceholder(0.00, 73));
ok('★ 부산 z19 (grey 0.06, mean 190) → 영상', !isPlaceholder(0.06, 190));
ok('★ 부산 z18 (grey 0.04, mean 200) → 영상 (밝지만 회색이 아니다)',
   !isPlaceholder(0.04, 200));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
