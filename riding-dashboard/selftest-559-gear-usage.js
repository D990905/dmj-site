/* §559 장비별 사용 통계 — Vantage 'Equipment' 벤치마크 (옥대표 2차 스샷 15장)

   Vantage: 장비마다 Total Hours · Activities · Distance · Last used.
   우리: 거기에 **그 장비로 얼마나 잘 탔는지**(평균 점수·평균 최고속)를 더한다.
   §520 을 만든 이유가 "6.0 이랑 5.0 중 뭐가 나았나" 였다. */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var g={ console:console, Date:Date, Math:Math, JSON:JSON, isFinite:isFinite, Number:Number,
        String:String, Array:Array, Object:Object, parseInt:parseInt, parseFloat:parseFloat };
g.window=g; g.self=g; vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(__dirname,'js/gear-usage.js'),'utf8'), g);
var G=g.RDGearUsage;

function S(o){ return Object.assign({ dateEpoch:1, movingTimeSec:3600, distanceM:20000,
  maxSpeedMs:10, vpsOverall:50, sig:'s'+Math.random() }, o); }

console.log('[1] 슬롯 정의');
ok('다섯 부품군', G.SLOTS.length===5);
ok('★ 윙·앞포일·뒷포일·마스트·보드',
   G.SLOTS.map(function(s){return s.label;}).join(',')==='Wing,Front foil,Rear foil,Mast,Board');

console.log('\n[2] 굴리기');
var R=G.rollup([
  S({ dateEpoch:Date.parse('2026-05-19'), gear:{handWing:'w50', handWingName:'PPC Sonic 5.0'},
      movingTimeSec:3600, distanceM:20000, vpsOverall:40 }),
  S({ dateEpoch:Date.parse('2026-06-09'), gear:{handWing:'w50', handWingName:'PPC Sonic 5.0'},
      movingTimeSec:1800, distanceM:10000, vpsOverall:60 }),
  S({ dateEpoch:Date.parse('2026-06-11'), gear:{handWing:'w40', handWingName:'PPC Sonic 4.0'},
      movingTimeSec:7200, distanceM:50000, vpsOverall:70 })
]);
var wing=R.buckets.filter(function(b){return b.slot.label==='Wing';})[0];
ok('윙 두 항목', wing.list.length===2);
var w50=wing.list.filter(function(i){return i.id==='w50';})[0];
var w40=wing.list.filter(function(i){return i.id==='w40';})[0];
ok('★ 세션 수', w50.sessions===2 && w40.sessions===1);
ok('★ 시간 합계 (1h + 0.5h = 1.5h)', Math.abs(w50.hours-1.5)<1e-9, String(w50.hours));
ok('★ 거리 합계 (20+10=30km)', Math.abs(w50.km-30)<1e-9, String(w50.km));
ok('★ 마지막 사용일 = 가장 늦은 날', w50.lastEpoch===Date.parse('2026-06-09'));
ok('★ 평균 점수 (40,60 → 50)', Math.abs(w50.avgSps-50)<1e-9, String(w50.avgSps));
ok('이름을 스냅샷에서 가져온다', w50.label==='PPC Sonic 5.0');
ok('★ 많이 쓴 순으로 정렬 (4.0 이 2h 로 1위)', wing.list[0].id==='w40', wing.list[0].id);

console.log('\n[3] ★ 장비 기록이 없는 세션은 어디에도 안 넣는다');
var R2=G.rollup([
  S({ gear:{handWing:'w50', handWingName:'5.0'}, distanceM:20000 }),
  S({ gear:null, distanceM:99999 }),          /* 기록 없음 */
  S({ distanceM:88888 })                       /* gear 필드 자체 없음 */
]);
var w=R2.buckets[0].list[0];
ok('★ 거리가 20km 뿐 (99999·88888 이 안 섞인다)', Math.abs(w.km-20)<1e-9, String(w.km));
ok('★ 전체/기록 세션 수를 따로 센다', R2.total===3 && R2.withGear===1,
   R2.total+'/'+R2.withGear);

console.log('\n[4] 여러 부품군을 한 번에');
var R3=G.rollup([ S({ gear:{ handWing:'w', handWingName:'Wing A', frontWing:'f',
  frontWingName:'Foil A', mast:'m', board:'b', boardName:'Board A', rearWing:'r' } }) ]);
ok('다섯 군 모두 잡힌다', R3.buckets.length===5, String(R3.buckets.length));
ok('이름이 없는 군은 id 를 쓴다',
   R3.buckets.filter(function(b){return b.slot.label==='Mast';})[0].list[0].label==='m');

console.log('\n[5] 중복 저장본은 하나로');
var R4=G.rollup([
  { dateEpoch:1, sig:'X', savedAt:1, movingTimeSec:3600, distanceM:10000, gear:{handWing:'w'} },
  { dateEpoch:1, sig:'X', savedAt:9, movingTimeSec:3600, distanceM:10000, gear:{handWing:'w'} }
]);
ok('★ 한 번만 센다', R4.buckets[0].list[0].sessions===1, String(R4.buckets[0].list[0].sessions));

console.log('\n[6] 나중에 채운 장비를 구분한다 (§520 backfilled)');
var R5=G.rollup([ S({ gear:{handWing:'w', handWingName:'W', backfilled:true} }),
                  S({ gear:{handWing:'w', handWingName:'W'} }) ]);
ok('★ backfilled 개수를 센다', R5.buckets[0].list[0].backfilled===1);

console.log('\n[7] 화면 — Vantage 에 없는 것과 정직성');
var src=fs.readFileSync(path.join(__dirname,'js/gear-usage.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');
ok('★ Vantage 의 네 지표를 모두 낸다',
   /'Sessions', 'Hours', 'Distance'/.test(code) && /'Last used'/.test(code));
ok('★ 우리 추가 — 평균 점수·평균 최고속', /'Avg score', 'Avg top'/.test(code));
ok('★ 기록된 세션 수를 밝힌다', /sessions have gear recorded/.test(code));
ok('★ 기록 없는 세션은 제외됨을 밝힌다', /not credited to any item/.test(code));
ok('★ 나중에 채운 장비를 표시한다', /added later/.test(code));
ok('★★ 장비 비교를 단정하지 않는다 (풍속이 섞여 있다)',
   /Read this as a hint, not a verdict/.test(code));
ok('★ 표본 2개 미만이면 비교하지 않는다', /it\.spsN >= 2/.test(code));
ok('★ 차이가 3점 미만이면 비교하지 않는다', /if \(gap < 3\) return;/.test(code));

console.log('\n[8] 배선');
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
ok('v2 가 부른다', /RDGearUsage\.render\(gearHost, list\)/.test(app));
ok('★★ renderSessions 안이다 (renderLedgerTable 아님 — §558b 의 실수)', (function(){
  var i=app.indexOf('RDGearUsage.render(gearHost');
  var re=/\n  function (\w+)\(/g,m,last=null,head=app.slice(0,i);
  while((m=re.exec(head))) last=m[1];
  return last==='renderSessions'; })());
ok('실패해도 스택을 남긴다', /\[v2 §559\] gear usage render/.test(app));
var html=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
ok('스크립트가 v2-app 보다 먼저', html.indexOf('gear-usage.js') < html.indexOf('js/v2-app.js'));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
