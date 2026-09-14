/* §592 옥대표: "피치앵글이 없네. 추가해줘. 다른곳 힐링이 들어가는곳엔 모두 피치도 넣어줘."
   "힐을 202퍼센트 차이라고 표현하는건 잘못됨. 음수양수는 단순히 택을 의미하기때문에
    힐이나 피치에서는 무시해."  라이브: Port −51.5 / Starboard 52.9 → Diff +202.7% */
var fs=require('fs'),path=require('path');var pass=0,fail=0;
function ok(n,c,e){if(c){pass++;console.log('  ok   '+n);}else{fail++;console.log('  FAIL '+n+(e?'  '+e:''));}}
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var cs=fs.readFileSync(path.join(__dirname,'js/chart-stack.js'),'utf8');
var html=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
function grab(n){var m=app.match(new RegExp('function '+n+'\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'));return m?m[0]:null;}
console.log('[1] Tack bias 에 Pitch');
ok('★★ 버튼 목록에 Pitch', /\{ id: 'pitch', label: 'Pitch' \}/.test(app));
ok('★ 순서: Heel 다음', app.indexOf("{ id: 'heel', label: 'Heel' }") < app.indexOf("{ id: 'pitch', label: 'Pitch' }"));
console.log('\n[2] ★★ 202.7% 재현 → 사라짐');
var TB_PCT_FLOOR={kt:1,bpm:40,deg:5,'':0.5};
var tbDiff=eval('('+grab('tbDiff')+')'), tbIsAttitude=function (m) { return m === 'heel' || m === 'pitch'; }; ok('★ tbIsAttitude 정의', /function tbIsAttitude\(metricId\) \{ return metricId === 'heel' \|\| metricId === 'pitch'; \}/.test(app));
var KT=1.943844, TACKBIAS={tier:'avg'};
var tbFmt=eval('('+grab('tbFmt')+')');
var p=tbFmt({metric:'heel',avg:-51.5,unit:'deg'}), s=tbFmt({metric:'heel',avg:52.9,unit:'deg'});
ok('★ (근거) 옛 식이면 +202.7%', Math.abs(tbDiff(-51.5,52.9,'°')-202.7)<0.1, String(tbDiff(-51.5,52.9,'°')));
ok('★★ 포트 힐은 크기로 51.5', p.v===51.5);
ok('★★ 크기끼리면 차이 1.4°', Math.abs((s.v-p.v)-1.4)<1e-9);
ok('★★ 힐·피치는 % 를 내지 않는다', /if \(attitude\) d = null;/.test(app));
ok('★ 피치도 크기로', tbFmt({metric:'pitch',avg:-61.3,unit:'deg'}).v===61.3);
ok('★ 속도는 그대로(부호 안 뗌 — VMG 음수 보존)', tbFmt({metric:'vmg',avg:-1,unit:'speed'}).v<0);
ok('★ "starboard 1.4° more heel" 식 문장', /\\u00b0 more '/.test(app));
console.log('\n[3] 다른 곳도 부호 무시');
ok('★★ 분포(바이올린) 피치도 크기', /if \(M === 'twa' \|\| M === 'heel' \|\| M === 'pitch'\) return Math\.abs\(v\);/.test(app));
ok('★★ 통계표 힐·피치 크기', /if \(row\.metric === 'heel' \|\| row\.metric === 'pitch'\) v = Math\.abs\(v\);/.test(app));
ok('★★ 타임라인 힐·피치 크기', /Math\.abs\(p\.heel\)/.test(cs) && /Math\.abs\(p\.pitch\)/.test(cs));
ok('★ 자세 탭 분위수 크기', /statRow\('Heel', absOf\(heels\)/.test(app) && /statRow\('Pitch', absOf\(pitches\)/.test(app));
console.log('\n[4] 힐이 있는 곳마다 피치');
ok('통계표 라벨', /heel: 'Heel \(°\)',\s*\n\s*pitch:'Pitch \(°\)'/.test(app));
ok('분포 선택지', /metricOpts\.push\(\['heel', 'Heel'\], \['pitch', 'Pitch'\]\)/.test(app));
ok('타임라인', /key: 'pitch', label: 'Pitch'/.test(cs));
ok('자세 탭', /statRow\('Pitch'/.test(app));
ok('캐시버스트', /v2-app\.js\?v=v592/.test(html) && /chart-stack\.js\?v=v592/.test(html));
console.log('\n'+(fail?'FAIL':'PASS')+'  '+pass+'/'+(pass+fail));process.exit(fail?1:0);
