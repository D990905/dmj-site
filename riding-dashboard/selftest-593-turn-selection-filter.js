/* §593 옥대표 "데이터 선택된것 외에 너무 많은것들이 섞여서 노출되고 있어. 버그같아."
   화면: 필터 Gybes·Port '16 of 60' · 'Select all 16' 인데 상세는 "20 turns selected",
   곡선 캡션 "20 gybes on port", 위에서 본 궤적에 초록(스타보드) 선이 섞임.
   원인: TURNSEL 은 필터를 바꿔도 남고(§488) 상세는 TURNSEL 전부를 그렸다. */
var fs=require('fs'),path=require('path');var pass=0,fail=0;
function ok(n,c,e){if(c){pass++;console.log('  ok   '+n);}else{fail++;console.log('  FAIL '+n+(e?'  '+e:''));}}
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var html=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
function grab(n){var m=app.match(new RegExp('\\n  function '+n+'\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'));return m?m[0]:'';}
var env=new Function(grab('turnPassesFilter')+grab('revealTurn')+
  '\nvar TURNFILT={type:"all",side:"all",clean:true};function turnQuality(m){return {ok:!m.bad};}'+
  '\nreturn {F:TURNFILT,pass:turnPassesFilter,reveal:revealTurn};')();
/* 60 회전: 짝수 gybe, 홀수 tack; i%3==0 포트 */
var mans=[];for(var i=0;i<60;i++)mans.push({type:i%2?'tack':'gybe',side:i%3===0?'P':'S',bad:i===54});
console.log('[1] 재현 — 스타보드 자이브 4개 고른 뒤 Port 로 바꿔 전부 선택');
var TURNSEL=[2,4,8,10];                         /* 스타보드 자이브 */
env.F.type='gybe'; env.F.side='P';
var view=mans.map(function(m,i){return i;}).filter(function(i){return env.pass(mans[i]);});
view.forEach(function(i){if(TURNSEL.indexOf(i)<0)TURNSEL.push(i);});
ok('★ (근거) 선택 자체는 필터 밖 4개를 포함한다', TURNSEL.length===view.length+4, TURNSEL.length+' vs '+view.length);
var shown=TURNSEL.filter(function(i){return env.pass(mans[i]);});
ok('★★ 상세가 그리는 개수 = 목록 개수', shown.length===view.length, shown.length+' vs '+view.length);
ok('★★ 상세에 스타보드가 없다', shown.every(function(i){return mans[i].side==='P';}));
ok('★★ 가려진 수를 밝힌다 (4)', TURNSEL.length-shown.length===4);
ok('★ 흔들린(깨끗하지 않은) 회전은 Real maneuvers 에서 빠진다', !env.pass(mans[54]));
console.log('\n[2] 배선');
var det=grab('renderTurnDetail');
ok('★★ renderTurnDetail 은 필터 통과분만', /var sel = allSel\.filter\(function \(i\) \{ return turnPassesFilter\(mans\[i\]\); \}\)/.test(det));
ok('★★ 선택이 모두 필터 밖이면 안내만', /if \(hiddenN\) host\.appendChild\(turnHiddenNote\(hiddenN, a, true\)\);/.test(det));
ok('★ 곡선·궤적·지도는 걸러진 picked/sel 을 받는다', /drawTurnCurves\(plotHost, picked, sel, a\)/.test(det) && /renderTurnTracks\(body, picked, sel, a\)/.test(det) && /renderTurnMiniMap\(miniHost, a, sel\)/.test(det));
ok('★ Show them / Deselect them', /'Show them'/.test(app) && /'Deselect them'/.test(app));
console.log('\n[3] 지도에서 필터 밖 회전을 고르면 보이게');
env.F.type='gybe'; env.F.side='P'; env.F.clean=true;
env.reveal(mans[1]);            /* tack, S */
ok('★★ 종류·방향 필터가 풀린다', env.F.type==='all' && env.F.side==='all');
ok('★ 깨끗한 회전이면 Real maneuvers 는 유지', env.F.clean===true);
env.reveal(mans[54]); ok('★ 흔들린 회전이면 그것도 푼다', env.F.clean===false);
ok('★★ 미니지도·Track 지도 클릭 둘 다 revealTurn', (app.match(/revealTurn\(/g)||[]).length>=3);
ok('캐시버스트 (v593 이상)', (function(){var m=html.match(/v2-app\.js\?v=v(\d+)/);return m&&+m[1]>=593;})());
console.log('\n'+(fail?'FAIL':'PASS')+'  '+pass+'/'+(pass+fail));process.exit(fail?1:0);
