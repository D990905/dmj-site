/* §580 각도 지표는 방향이 반대다 (옥대표)
   "풍상은 각이 낮을수록 좋은거고 풍하는 각이 클수록 좋은거잖아.
    풍상은 숫자가 작은쪽으로 우세하다고 표현해야함."

   Diff 는 '스타보드 − 포트' 라는 산수일 뿐이라 어느 쪽이 나은지 모른다.
   실측: 풍상 CWA port 36.2° / stbd 36.9° 가 '+1.8% starboard' 로 떠서
   스타보드가 앞선 것처럼 읽혔다. 실제로 앞선 쪽은 각이 작은 포트다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 판정 함수');
ok('★ tbBetterSide 가 있다', /function tbBetterSide\(metricId, mode, pVal, sVal\)/.test(code));
ok('★ 속도·VMG 는 클수록', /if \(metricId === 'sog' \|\| metricId === 'vmg'\) higherWins = true;/.test(code));
ok('★★ 각도는 풍상이면 작을수록', /higherWins = \(mode !== 'upwind'\)/.test(code));
ok('★ 힐·심박은 판정하지 않는다', /else return null;\s*\n\s*var diff = sVal - pVal;/.test(code));

console.log('\n[2] ★★ 실제 값으로 — 옥대표 두 화면');
function better(m,mode,p,s){
  var hw; if(m==='sog'||m==='vmg')hw=true; else if(m==='twa'||m==='awa')hw=(mode!=='upwind'); else return null;
  var d=s-p; if(d===0) return {side:null};
  var sAhead = hw ? d>0 : d<0;
  return {side:sAhead?'S':'P', name:sAhead?'starboard':'port', higherWins:hw,
    verb: m==='sog'?'is faster':m==='vmg'?'makes more VMG':(mode==='upwind'?'points closer':'sails deeper')};
}
var a=better('twa','upwind',36.2,36.9);
ok('★★ 풍상 CWA 36.2 vs 36.9 → port 가 앞선다 (부호는 +stbd 인데도)',
   a.side==='P' && a.verb==='points closer', a.name+' '+a.verb);
var b=better('twa','downwind',146.7,153.1);
ok('★★ 풍하 CWA 146.7 vs 153.1 → starboard 가 깊다',
   b.side==='S' && b.verb==='sails deeper', b.name+' '+b.verb);
ok('★ 풍상 AWA 도 작을수록', better('awa','upwind',27,31).side==='P');
ok('★ 풍하 AWA 는 클수록', better('awa','downwind',58,57).side==='P');
ok('★ 속도는 양쪽 모두 클수록', better('sog','upwind',17.3,15.9).side==='P'
   && better('sog','downwind',17.3,17.7).side==='S');
ok('★ 같으면 level', better('sog','upwind',17,17).side===null);
ok('★ 힐은 null', better('heel','upwind',1,2)===null);

console.log('\n[3] 화면 표기');
ok('★ 앞선 쪽을 말로 적는다', /bl\.textContent = better\.name \+ ' ' \+ better\.verb/.test(code));
ok('★ 그 쪽 색으로', /bl\.style\.color = sideColor\(better\.side\)/.test(code));
ok('★ 같으면 level', /bl\.textContent = 'level'/.test(code));
ok('★ Diff 숫자 자체는 그대로 (산수는 건드리지 않는다)',
   /'starboard vs port'/.test(code));

console.log('\n[4] ★ 막대도 앞선 쪽으로 기운다');
ok('★★ 풍상 각도면 부호를 뒤집는다',
   /if \(better && better\.higherWins === false\) signed = -d;/.test(code));
ok('★ 판정 안 하는 지표는 예전대로 큰 쪽', /var signed = d;/.test(code));
ok('★ 막대 양 끝에 이름표 (어느 쪽인지 추측하지 않게)',
   /ahead \\u2192|\\u2190 starboard/.test(app));
ok('★ higher/lower 를 밝힌다', /better\.higherWins \? 'higher' : 'lower'/.test(code));

console.log('\n[5] ★★ 풍하를 과하게 단정하지 않는다');
ok('★★ "깊을수록 무조건 좋다" 고 말하지 않는다',
   !/which costs downwind VMG the same way/.test(app));
ok('★★ 최적점을 넘으면 손해라고 밝힌다',
   /costs more speed than it gains/.test(app));
ok('★ 풍상은 분명히 나쁘다고 말한다', /upwind that is the wrong way/.test(app));
ok('★ 주석에 근거가 남아 있다', /폴라 최적점을 지나/.test(app));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
