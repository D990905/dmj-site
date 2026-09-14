/* §595 옥대표 "두 배를 비교하고 있는데 하나는 그냥 점으로 나오네. 같은 배모양으로 만들되
   색깔만 바꿔서 나오게 해줘." — 고스트 재생 헤드가 7px circleMarker 였다. */
var fs=require('fs'),path=require('path');var pass=0,fail=0;
function ok(n,c,e){if(c){pass++;console.log('  ok   '+n);}else{fail++;console.log('  FAIL '+n+(e?'  '+e:''));}}
var src=fs.readFileSync(path.join(__dirname,'js/replay.js'),'utf8');
var m=src.match(/  function boardIconHtml\(c\) \{[\s\S]*?\n  \}/);
ok('★ boardIconHtml 이 있다', !!m);
var f=new Function(m[0]+'; return boardIconHtml;')();
var me=f({board:'#0A2540',deck:'#22425E',sail:'#FFB000'}), gh=f({board:'#B86BFF',deck:'rgba(255,255,255,0.28)',sail:'#FFFFFF'});
ok('★★ 문자열을 돌려준다 (return 줄바꿈 ASI 함정 방지)', typeof me==='string' && me.length>500, typeof me);
function shape(h){return h.replace(/fill="[^"]*"|stroke="#[0-9A-Fa-f]{6}"/g,'');}
ok('★★ 고스트와 내 보드는 모양이 같다 (색만 다름)', shape(me)===shape(gh));
ok('★★ 색은 다르다', me!==gh && gh.indexOf('#B86BFF')>0);
ok('★ 내 보드는 예전 색 그대로', me.indexOf('#0A2540')>0 && me.indexOf('#FFB000')>0 && me.indexOf('#22425E')>0);
ok('★★ 고스트 헤드는 더 이상 circleMarker 가 아니다', !/mapGhostPlayhead = L\.circleMarker/.test(src) && /mapGhostPlayhead = L\.marker\(/.test(src));
ok('★★ 고스트도 헤딩으로 회전', /function updateGhostPlayhead[\s\S]{0,900}rot\.style\.transform = \(st\.heading != null\)/.test(src));
ok('★★ 고스트 세일 방향은 따로 기억 (내 세일과 섞이지 않게)', /updateSailIcon\(st, R\.ghostSail/.test(src) && /holder\.sailSide = target/.test(src) && !/R\.sailSide \+=/.test(src));
ok('★ twa 없는 고스트 표본은 헤딩으로 낸다', /var twaRaw = st\.twa != null \? st\.twa : angDiff\(R\.windDir, st\.heading\)/.test(src));
ok('★ 캐시버스트 두 대시보드', [ 'v2.html','index.html' ].every(function(f){var m=fs.readFileSync(path.join(__dirname,f),'utf8').match(/replay\.js\?v=v(\d+)/);return m&&+m[1]>=595;}));
console.log('\n'+(fail?'FAIL':'PASS')+'  '+pass+'/'+(pass+fail));process.exit(fail?1:0);
