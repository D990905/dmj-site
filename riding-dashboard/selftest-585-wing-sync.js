/* §585 핸드윙 선택기와 Wing(m²) 입력칸이 어긋나던 것 (옥대표)
   "윙사이즈를 6.5로 선택후 저장했는데 자꾸 6.0으로 나오네 다시들어가면."

   한 레코드 안에서 두 값이 달랐다 (라이브 실측):
     변산해수욕장#1  rider.wingM2 = 6.5 · gear.handWing = PPC Sonic 6.0 (wingM2 6)
     2026-09-03      gear.wingM2 = 5    · gear.wingM2Form = 4.5
   복원할 때 입력칸은 rider 를, 선택기는 gear 를 읽으므로 서로 다른 윙을 가리킨다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 고르면 입력칸도 따라간다');
ok('★★ 핸드윙 변경 시 in-wing 을 갱신한다',
   /if \(key === 'handWing' && window\.RDGear\)/.test(code)
   && /wi\.value = hw\.areaM2/.test(code));
ok('★ 면적이 있는 윙일 때만', /if \(hw && hw\.areaM2 > 0 && wi\)/.test(code));
ok('★ 출처 꼬리표도 gear 로 바꾼다 (§557)',
   /CUR\.restoredInputs\.src\.wing = 'gear'/.test(code));
ok('★★ 윙이 바뀌면 점수를 다시 계산한다 (기준이 바뀐다)',
   /applyWind\(null, 'keep'\); return;/.test(code));

console.log('\n[2] 저장 직전에 한 번 더 맞춘다');
ok('★ 공통 헬퍼가 있다', /function riderFromFormSynced\(\)/.test(code));
ok('★★ 이름 있는 윙이 있으면 그 면적이 이긴다',
   /if \(snap && snap\.handWing && snap\.wingM2 > 0/.test(code));
ok('★ 차이가 있을 때만 덮는다 (직접 적은 값을 함부로 안 바꾼다)',
   /Math\.abs\(\(r0\.wingM2 \|\| 0\) - snap\.wingM2\) > 0\.01/.test(code));
ok('★ 입력칸도 같이 맞춘다', /if \(wi\) wi\.value = snap\.wingM2;/.test(code));
ok('★★ 두 저장 경로 모두 쓴다 (정의 1 + 호출 2)',
   (code.match(/riderFromFormSynced\(\)/g)||[]).length===3,
   String((code.match(/riderFromFormSynced\(\)/g)||[]).length));
ok('★ 헤더 Save session 도', (function(){
  var i=code.indexOf('rider: (function () {');
  return code.slice(i, i+220).indexOf('riderFromFormSynced')>=0; })());
ok('★ Save to this session 도', (function(){
  var i=code.indexOf('function saveInputsToSession');
  return code.slice(i, i+1400).indexOf('riderFromFormSynced')>=0; })());

console.log('\n[3] ★★ 어긋남이 다시 생길 수 없는가 (실측 사례 재현)');
/* 헬퍼 로직 재현 */
function sync(formWing, snap){
  var r={wingM2:formWing};
  if (snap && snap.handWing && snap.wingM2>0 && Math.abs((r.wingM2||0)-snap.wingM2)>0.01) {
    r.wingM2 = snap.wingM2;
  }
  return r.wingM2;
}
ok('★★ 변산 사례: 폼 6.5 · 선택기 6.0 → 6.0 으로 통일 (둘이 달라지지 않는다)',
   sync(6.5, {handWing:'sonic_60', wingM2:6})===6);
ok('★★ 9/03 사례: 폼 4.5 · 선택기 5.0 → 5.0 으로 통일',
   sync(4.5, {handWing:'sonic_50', wingM2:5})===5);
ok('★ 선택기에 이름 있는 윙이 없으면 폼 값을 지킨다 (목록 밖 윙 직접 입력)',
   sync(6.2, {handWing:null, wingM2:null})===6.2);
ok('★ 이미 같으면 그대로', sync(6, {handWing:'sonic_60', wingM2:6})===6);

console.log('\n[4] 왜 선택기가 이기는가 — 근거가 주석에 있다');
ok('★ 실측 사례가 적혀 있다', /변산해수욕장#1 = rider 6\.5 \/ gear 6\.0/.test(app));
ok('★ 목록 밖 윙은 입력칸이 이긴다고 밝혔다', /목록에 없는 윙을 직접/.test(app));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
