/* §597 옥대표 "비교하는 창에서 다시 나가려고 해도 계속 비교창으로 유지되는것 같아. 버그같네." */
var fs=require('fs'),path=require('path');var pass=0,fail=0;
function ok(n,c,e){if(c){pass++;console.log('  ok   '+n);}else{fail++;console.log('  FAIL '+n+(e?'  '+e:''));}}
var rp=fs.readFileSync(path.join(__dirname,'js/replay.js'),'utf8'),app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
ok('★★ 리플레이 안에 Stop comparing', /Stop comparing<\/button>/.test(rp) && /if \(b\.getAttribute\('data-stop'\)\) \{ stopComparing\(\); return; \}/.test(rp));
var sc=rp.match(/function stopComparing\(\) \{[\s\S]*?\n  \}/)[0];
ok('★★ 고스트 보드·궤적을 지도에서 뗀다', /removeLayer\(R\.mapGhostPlayhead\)/.test(sc) && /R\.mapGhostTrack \|\| \[\]\)\.forEach/.test(sc));
ok('★★ 그래프·트랙·지도를 다시 그리고 같은 시각에 머문다', /buildGraphs\(\);\s*sizeGraphs\(\);\s*rebuildTrack\(\);\s*updateMapWindow\(\);\s*seek\(R\.playT\);/.test(sc));
ok('★ 두 선수 라벨 제거', /replay-track-labels/.test(sc));
ok('★★ 대시보드 선택도 비운다', /onStopCompare: function \(\) \{\s*var gs = \$\('replay-ghost'\);\s*if \(gs\) gs\.value = '';/.test(app));
ok('★★ 다른 세션을 열면 비교가 풀린다', /if \(CUR\.cmpIdent !== undefined && CUR\.cmpIdent !== cmpIdent\) \{\s*var gsel = \$\('replay-ghost'\);\s*if \(gsel\) gsel\.value = '';/.test(app));
ok('★★ 저장 직후는 같은 세션 (시작 시각 우선)', /var cmpIdent = \(session && session\.startEpoch\) \|\| CUR\.openedRecId \|\| null;/.test(app));
ok('★ 선택지 이름 No comparison', /none\.textContent = 'No comparison'/.test(app));
ok('캐시버스트', /replay\.js\?v=v597/.test(html) && /v2-app\.js\?v=v597/.test(html));
console.log('\n'+(fail?'FAIL':'PASS')+'  '+pass+'/'+(pass+fail));process.exit(fail?1:0);
