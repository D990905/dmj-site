/* §558 Trend analysis — Vakaros Vantage 벤치마크 (옥대표 "벤티지 추가야", 스샷 13장)

   Vantage 가 가진 것 중 없던 것: 풍속대 필터 · 주/월 묶기 · 점수 축별 추세.
   그대로 베끼지 않고 두 약점을 고쳤다:
     ① 칩을 눌러보기 전엔 그 조건에 세션이 몇 개인지 모른다 → 칩에 개수를 적는다
     ② 주간 차트가 대부분 0 인 평평한 선이다(스샷 1612·1616)
        → 데이터 구간만 그리고, 합계는 0, 점수는 빈칸으로 구분한다 */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }

var g={ console:console, Date:Date, Math:Math, JSON:JSON, isFinite:isFinite, Number:Number,
        String:String, Array:Array, Object:Object, parseInt:parseInt, parseFloat:parseFloat };
g.window=g; g.self=g; vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(__dirname,'js/trend-analysis.js'),'utf8'), g);
var T=g.RDTrend;

console.log('[1] 풍속대');
ok('다섯 구간', T.BANDS.length===5);
ok('★ 경계가 이어진다 (틈·겹침 없음)', (function(){
  for(var i=1;i<T.BANDS.length;i++) if(T.BANDS[i].lo!==T.BANDS[i-1].hi) return false;
  return true; })());
ok('11kt → Light', T.bandOf(11)==='l', String(T.bandOf(11)));
ok('12kt → Medium (경계는 위쪽에 붙는다)', T.bandOf(12)==='m', String(T.bandOf(12)));
ok('18kt → Strong', T.bandOf(18)==='s');
ok('24kt → Strong', T.bandOf(24)==='s');
ok('25kt → Very strong', T.bandOf(25)==='vs');
ok('★ 풍속이 없으면 null (0 으로 치면 Very light 로 둔갑한다)',
   T.bandOf(null)===null && T.bandOf(undefined)===null);

console.log('\n[2] 기간 버킷 — 데이터가 있는 구간만');
var may=Date.parse('2026-05-19T06:00:00Z'), jun=Date.parse('2026-06-11T04:00:00Z');
var rows=[{dateEpoch:may},{dateEpoch:jun}];
var mb=T._buckets(rows,'month');
ok('★ 5월~6월 두 칸 (앞뒤로 빈 구간을 만들지 않는다)', mb.length===2, String(mb.length));
ok('첫 칸에 5월 세션', mb[0].rows.length===1);
ok('둘째 칸에 6월 세션', mb[1].rows.length===1);
var sep=Date.parse('2026-09-07T04:00:00Z');
var mb2=T._buckets([{dateEpoch:may},{dateEpoch:sep}],'month');
ok('★ 사이의 빈 달도 칸은 만든다 (5~9월 = 5칸)', mb2.length===5, String(mb2.length));
ok('빈 달은 rows 가 비어 있다', mb2[1].rows.length===0 && mb2[2].rows.length===0);
var wb=T._buckets([{dateEpoch:may},{dateEpoch:may+7*86400000}],'week');
ok('주 단위도 동작', wb.length===2, String(wb.length));
ok('★ 주는 월요일에 시작한다', new Date(T._weekKey(Date.parse('2026-05-20T09:00:00Z'))).getDay()===1);

console.log('\n[3] 지표 정의');
ok('합계 지표 6종', T.TOTALS.length===6);
ok('★ Sessions 는 세션당 1 (개수를 센다)', T.TOTALS[0].get({})===1);
ok('거리는 km 로 변환', Math.abs(T.TOTALS.filter(function(d){return d.key==='dist';})[0]
   .get({distanceM:55044}) - 55.044) < 1e-6);
ok('시간은 h 로 변환', Math.abs(T.TOTALS.filter(function(d){return d.key==='hours';})[0]
   .get({movingTimeSec:3600}) - 1) < 1e-9);
ok('★ 점수 축 5종 (종합·풍상·풍하·택·자이브)', T.SCORES.length===5);
ok('축이 레코드의 vps 필드를 읽는다',
   T.SCORES[0].get({vpsOverall:61})===61 && T.SCORES[1].get({vpsUpwind:64})===64
   && T.SCORES[2].get({vpsDownwind:51})===51 && T.SCORES[3].get({vpsTack:17})===17
   && T.SCORES[4].get({vpsGybe:67})===67);

console.log('\n[4] ★ 합계와 평균은 빈 기간을 다르게 다룬다');
console.log('    (세션이 없던 달의 점수는 0점이 아니라 없음이다)');
var src=fs.readFileSync(path.join(__dirname,'js/trend-analysis.js'),'utf8');
var code=src.replace(/\/\*[\s\S]*?\*\//g,'');
ok('★ 합계: 세션 0 이면 0', /return b\.rows\.length === 0 \? 0 :/.test(code));
ok('★ 평균: 세션 0 이면 null', /return n \? s \/ n : null;/.test(code));
ok('★ 차트가 null 을 0 막대로 그리지 않는다 (빈 표시)',
   /stroke="var\(--tblr-border-color\)" stroke-width="2"/.test(code));
ok('점수 캡션이 그 차이를 설명한다', /it is not a zero score/.test(code));

console.log('\n[5] ★ 표본이 얇으면 추세라고 하지 않는다');
ok('★ 3개 미만이면 경고', /rows\.length < 3/.test(code));
ok('★ 문구가 정직하다', /Too few to read as a trend/.test(code));
ok('★ 칩에 세션 개수를 적는다 (눌러보기 전에 안다)',
   /' session' \+ \(c === 1 \? '' : 's'\)/.test(code));
ok('세션이 없는 밴드는 누를 수 없다', /b\.disabled = c === 0/.test(code));

console.log('\n[6] 정직성');
ok('★ 풍속대 경계가 우리 기준임을 밝힌다', /Bands are ours, not Vakaros/.test(code));
ok('★ 경계 수치를 화면에 적는다', /<8 \/ 8–12 \/ 12–18 \/ 18–25 \/ 25\+ kt/.test(code));
ok('★ 풍속 기록이 없는 세션을 따로 알린다', /without a recorded wind speed/.test(code));
ok('중복 저장본은 하나로 친다 (§490 과 같은 규칙)',
   /var k = r\.sig \|\| \(r\.dateEpoch \+ '\|' \+ \(r\.name \|\| ''\)\)/.test(code));

console.log('\n[7] 배선');
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
ok('★ v2 가 RDTrend 를 부른다', /RDTrend\.render\(trendHost, list, THEME\)/.test(app));
/* ⚠ 앵커 세 줄(t.appendChild… host.appendChild(card))이 renderLedgerTable 에도
   똑같이 있다. 처음에 파일 전체 치환으로 훈련부하 원장에 붙었고, 거기엔 list 가
   없어 조용히 아무것도 안 그려졌다. 어느 함수 안인지 고정한다. */
ok('★★ 호출이 renderSessions 안에 있다 (renderLedgerTable 아님)', (function(){
  var i=app.indexOf('RDTrend.render(trendHost');
  if(i<0) return false;
  var re=/\n  function (\w+)\(/g, m, last=null;
  var head=app.slice(0,i);
  while((m=re.exec(head))) last=m[1];
  return last==='renderSessions'; })(),
  (function(){ var i=app.indexOf('RDTrend.render(trendHost');
    var re=/\n  function (\w+)\(/g,m,last=null,head=app.slice(0,i);
    while((m=re.exec(head))) last=m[1]; return 'found in '+last; })());
ok('호출은 한 곳뿐', (app.match(/RDTrend\.render\(trendHost/g)||[]).length===1);
ok('모듈이 없어도 안 터진다', /if \(window\.RDTrend\) \{/.test(app));
ok('★ 실패해도 스택을 남긴다 (삼켜진 예외 금지)',
   /\[v2 §558\] trend render/.test(app));
var html=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
ok('★ 스크립트가 v2-app 보다 먼저 로드된다',
   html.indexOf('trend-analysis.js') < html.indexOf('js/v2-app.js'));
ok('차트 글자 스타일이 테마 토큰을 쓴다',
   /\.tr-tick \{[^}]*fill: var\(--tblr-secondary\)/.test(html));

console.log('\n[8] §582 일간 (옥대표 "일간 그래프도 선택가능하게 해줘")');
var d=function(x){return Date.parse(x+'T06:00:00Z');};
var rows6=[{dateEpoch:d('2026-05-19')},{dateEpoch:d('2026-05-25')},{dateEpoch:d('2026-06-09')},
           {dateEpoch:d('2026-06-11')},{dateEpoch:d('2026-09-07')},{dateEpoch:d('2026-09-09')}];
var day=T._buckets(rows6,'day');
ok('★★ 일간은 **탄 날만** 세운다 (4개월치 빈 막대 110개를 만들지 않는다)',
   day.length===6, String(day.length));
ok('★ 빈 칸이 하나도 없다', day.every(function(b){return b.rows.length>0;}));
ok('★ 날짜순 정렬', (function(){for(var i=1;i<day.length;i++) if(day[i].key<=day[i-1].key) return false; return true;})());
ok('★ 라벨이 M/D', /^\d+\/\d+$/.test(day[0].label), day[0].label);
ok('★★ 주/월은 예전대로 빈 기간도 만든다 (그 0 은 뜻이 있다)',
   T._buckets(rows6,'month').length===5 && T._buckets(rows6,'week').length>6);
var srcT=fs.readFileSync(path.join(__dirname,'js/trend-analysis.js'),'utf8');
var codeT=srcT.replace(/\/\*[\s\S]*?\*\//g,'');
ok('★ 버튼이 셋 (Daily·Weekly·Monthly)', /\['day', 'week', 'month'\]/.test(codeT));
ok('★ 라벨도 셋', /p === 'day' \? 'Daily'/.test(codeT));
ok('★ 하루 뒤로 넘어간다', /if \(mode === 'day'\) \{ d\.setDate\(d\.getDate\(\) \+ 1\); return d\.getTime\(\); \}/.test(codeT));
ok('★★ 왜 탄 날만인지 화면에 밝힌다',
   /only days you actually rode/.test(codeT) && /would be mostly zeros/.test(codeT));
ok('★ 점수 캡션도 일간을 따로 말한다', /Averaged per day, and only days you actually rode/.test(codeT));
ok('★ 근거가 주석에 남아 있다 (§558 에서 지적한 그 실패)', /Vantage 의 실패/.test(srcT));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
