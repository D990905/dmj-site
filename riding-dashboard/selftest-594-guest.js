/* §594 옥대표 "이 데터는 중국선수껀데 내꺼에 더해지지않도록 독립적으로 게스트 모드로
   별도 저장되게 할 수 있을까? 전체통계 데이터에서 뺴야하거덩." — 저장 왕복으로 본다 */
var fs=require('fs'),path=require('path'),vm=require('vm');var pass=0,fail=0;
function ok(n,c,e){if(c){pass++;console.log('  ok   '+n);}else{fail++;console.log('  FAIL '+n+(e?'  '+e:''));}}
var store={};var g={localStorage:{getItem:function(k){return store[k]===undefined?null:store[k];},setItem:function(k,v){store[k]=String(v);},removeItem:function(k){delete store[k];},get length(){return Object.keys(store).length;},key:function(i){return Object.keys(store)[i];}},console:console,Date:Date,Math:Math,JSON:JSON,isFinite:isFinite,Number:Number,String:String,Array:Array,Object:Object,parseInt:parseInt,parseFloat:parseFloat,Promise:Promise};
g.window=g;g.self=g;vm.createContext(g);vm.runInContext(fs.readFileSync(path.join(__dirname,'js/storage.js'),'utf8'),g);
var S=g.RDStorage;
function A(km,top){return {summary:{totalDistanceM:km*1000,maxSpeedMs:top/1.943844,movingTimeSec:3600},maneuverStats:{}};}
var mine=S.saveSession({name:'슬라럼',dateEpoch:1000,sig:'a',workload:{trimp:100}},A(18,27)).record;
var ch=S.saveSession({name:'Ananas',dateEpoch:2000,sig:'b',workload:{trimp:300}},A(66,31)).record;
console.log('[1] 옮기기 전');
ok('기본 목록 2', S.listSessions().length===2);
ok('커리어 2세션', S.careerStats().sessionCount===2);
var ledgerBefore=S.loadLedger().filter(function(e){return e.kind==='ride';}).length;
S.setSessionGuest(ch.id,'중국 선수');
console.log('\n[2] ★★ 게스트로 옮긴 뒤');
ok('★★ 기본 목록에서 빠진다', S.listSessions().length===1 && S.listSessions()[0].id===mine.id);
ok('★★ 커리어 합계에서 빠진다 (1세션 · 18 km)', S.careerStats().sessionCount===1);
var pb=S.personalBests();
ok('★★ 개인 최고에서 빠진다 (최고속·최장 = 슬라럼)', pb.distanceM.sessionId===mine.id && (!pb.maxSpeedMs || pb.maxSpeedMs.sessionId===mine.id), JSON.stringify(pb.distanceM));
ok('★★ 훈련부하 원장에서 빠진다', S.loadLedger().filter(function(e){return e.kind==='ride';}).length===ledgerBefore-1);
ok('★ guests:only', S.listSessions({guests:'only'}).length===1 && S.listSessions({guests:'only'})[0].guest.name==='중국 선수');
ok('★ guests:all', S.listSessions({guests:'all'}).length===2);
console.log('\n[3] 다시 저장해도 게스트로 남는다');
S.saveSession({name:'Ananas',dateEpoch:2000,sig:'b2',replaceId:ch.id,workload:{trimp:300}},A(66,31));
ok('★★ 재저장 후에도 게스트', S.listSessions({guests:'only'}).length===1 && S.listSessions().length===1);
console.log('\n[4] 되돌리기');
S.setSessionGuest(ch.id,null);
ok('★★ 내 세션으로 돌아온다', S.listSessions().length===2 && S.careerStats().sessionCount===2);
ok('★ 없는 id', S.setSessionGuest('nope','x').ok===false);
console.log('\n[5] v2 배선');
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
ok('★★ 게스트 표', /function renderGuestSessions\(host\)/.test(app) && /try \{ renderGuestSessions\(host\); \}/.test(app));
ok('★★ 행마다 guest 버튼', /setGuest\(r\); \}\);/.test(app));
ok('★★ 연 세션이 게스트면 배너', /id="guest-host"/.test(html) && /try \{ renderGuestBanner\(\); \}/.test(app));
ok('★ 게스트 세션도 열고 저장 입력을 붙일 수 있다 (id 조회는 all)', (app.match(/listSessions\(\{ guests: 'all' \}\)/g)||[]).length>=5);
ok('★ 비교 선택기에 게스트 표시', /'  \(guest: '/.test(app));
ok('★ 같은 날 레이스에 게스트 포함, 풍향 일괄은 내 것만', /sameDaySaved\(true\)/.test(app) && /var list = sameDaySaved\(\);/.test(app));
ok('캐시버스트', /storage\.js\?v=v594/.test(html)&&/v2-app\.js\?v=v59[4-9]/.test(html));
console.log('\n'+(fail?'FAIL':'PASS')+'  '+pass+'/'+(pass+fail));process.exit(fail?1:0);
