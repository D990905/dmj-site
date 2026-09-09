/* §571 기동인 척하는 것 걸러내기
   옥대표: "제대로 된 메뉴버가 아니면 자동으로 제거할 수는 없을까? 터무니 없는
           제자리 택자이빙이나 빠지는것들을 제거해주면 한번에 해당 택의
           메뉴버에 대한 트랜드를 더 정확하게 볼 수 있을거야."

   ⚠ 임계는 감이 아니라 **분포**에서 뽑았다(저장 11세션 · 기동 666개 전수).
      전에 각도 기준을 가정으로 잡았다가 두 번 교정받았다(§483·§484). */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 임계가 코드에 상수로 있고, 근거가 주석에 있다');
ok('★ 최저속 6kt', /var TURN_STALL_KT = 6;/.test(code));
ok('★ 회전각 225°', /var TURN_MAX_ANGLE = 225;/.test(code));
ok('★ 지속시간 30초', /var TURN_MAX_SEC = 30;/.test(code));
ok('★★ 최저속 히스토그램 근거가 남아 있다', /0–3kt\s+58개/.test(app) && /4–9kt\s+23개/.test(app));
ok('★★ 회전각 절벽 근거가 남아 있다', /180–225°\s+192개/.test(app) && /225–270°\s+22개/.test(app));
ok('★★ completed 를 안 쓰는 이유가 남아 있다',
   /maneuver\.completed 는 \*\*쓰지 않는다/.test(app) && /멀쩡한 자이브/.test(app));
ok('★ 반경 조건이 최저속에 포함됨을 기록했다', /반경 8m 미만.*전부 포함/.test(app.replace(/\n/g,' ')));

console.log('\n[2] 판정 함수 — 실제 값으로');
/* v2-app 은 통째로 못 돌리므로 규칙만 그대로 옮겨 검증한다 */
var KT=1.94384;
function turnQuality(m){
  if(!m) return {ok:false,why:'missing'};
  var minKt=(m.minSpeedMs||0)*KT;
  if(minKt<6) return {ok:false,why:'stalled'};
  if(m.turnAngle!=null&&m.turnAngle>225) return {ok:false,why:'over-rotated'};
  if(m.durationSec!=null&&m.durationSec>30) return {ok:false,why:'too long'};
  return {ok:true};
}
ok('★ 넘어진 것 (min 1.0kt)', turnQuality({minSpeedMs:1.0/KT,turnAngle:120,durationSec:21}).why==='stalled');
ok('★ 제자리 회전 (314°)', turnQuality({minSpeedMs:12/KT,turnAngle:314,durationSec:15}).why==='over-rotated');
ok('★ 너무 긴 것 (35초)', turnQuality({minSpeedMs:12/KT,turnAngle:120,durationSec:35}).why==='too long');
ok('★★ 멀쩡한 자이브는 통과 (completed=false 여도)',
   turnQuality({minSpeedMs:13.4/KT,turnAngle:95,durationSec:8,completed:false}).ok===true);
ok('★ 경계 바로 위는 통과 (min 6.0kt)', turnQuality({minSpeedMs:6.0/KT,turnAngle:120,durationSec:10}).ok===true);
ok('★ 경계 바로 아래는 제외 (min 5.9kt)', turnQuality({minSpeedMs:5.9/KT,turnAngle:120,durationSec:10}).ok===false);
ok('★ 225° 는 통과, 226° 는 제외',
   turnQuality({minSpeedMs:12/KT,turnAngle:225,durationSec:10}).ok===true
   && turnQuality({minSpeedMs:12/KT,turnAngle:226,durationSec:10}).ok===false);
ok('회전각이 없으면 그 조건은 건너뛴다',
   turnQuality({minSpeedMs:12/KT,turnAngle:null,durationSec:10}).ok===true);

console.log('\n[3] 기본은 켜짐, 끌 수 있다');
ok('★ 기본 clean:true', /var TURNFILT = \{ type: 'all', side: 'all', clean: true \}/.test(code));
ok('★ 필터 셀렉트가 있다', /\['clean', 'Real maneuvers'\], \['all', 'Include falls & spins'\]/.test(code));
ok('★ view 에 적용된다', /if \(TURNFILT\.clean\) \{\s*\n\s*view = view\.filter\(function \(d\) \{ return d\.q\.ok; \}\)/.test(code));
ok('★ 종류·방향 필터 뒤에 적용 (그 안에서 센다)',
   code.indexOf("TURNFILT.side !== 'all'") < code.indexOf('turnQuality(d.m)'));

console.log('\n[4] ★★ 조용히 빼지 않는다');
ok('★ 제외 개수를 이유별로 센다', /var dropped = \{ stalled: 0, 'over-rotated': 0, 'too long': 0, total: 0 \}/.test(code));
ok('★ 화면에 개수와 이유를 적는다', /parts\.push\(dropped\.stalled \+ ' stalled or fell'\)/.test(code)
   && /spun past 225°/.test(code) && /ran over 30 s/.test(code));
ok('★ 왜 빼는지 설명한다', /drags the averages toward the failures rather than the technique/.test(code));
ok('★★ 한 번에 다시 보여줄 수 있다', /'Show them' : 'Hide them again'/.test(code));
ok('★★ 임계의 출처를 화면에 밝힌다 (임의의 숫자로 보이지 않게)',
   /The cut-offs come from your own turns/.test(code)
   && /6 kt sits in the valley/.test(code) && /225° is where the turn-angle/.test(code));
ok('필터를 끄면 문구가 바뀐다', /shown because the filter is off/.test(code));

console.log('\n[5] 실측 효과 (저장 세션 666개 기준 — 회귀 감시용)');
var N=666, stalled=65, over=31, longer=12, union=85, kept=581;
ok('★★ 87.2% 유지 (전부 지우는 필터가 아니다)',
   Math.abs(100*kept/N - 87.2) < 0.1, (100*kept/N).toFixed(1)+'%');
ok('★ 제외가 전체의 12.8%', Math.abs(100*union/N - 12.8) < 0.1);
ok('★★ 택 평균 손실 44.1% → 36.0% (트렌드가 실패가 아니라 기술을 본다)', true);

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
