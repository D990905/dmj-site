/* §583 회전 코칭 칸 정렬 (옥대표 "좌우 아래위 칸을 맞추는게 어떠니")
   Tabler 의 .alert 는 display:flex 라 칸 폭이 **내용 길이대로** 잡힌다.
   라이브 실측: 첫 칸 폭이 행마다 65 / 35 / 83px 로 제각각이었다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var htmlRaw=fs.readFileSync(path.join(__dirname,'v2.html'),'utf8');
var html=htmlRaw.replace(/<!--[\s\S]*?-->/g,'');
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 격자로 바꿨다');
ok('★ .tc-row 가 grid', /\.tc-row \{ display: grid;/.test(html));
ok('★★ 네 열이 모두 정해져 있다 (auto 가 아니라)', (function(){
  var m=html.match(/grid-template-columns:\s*minmax\([^;]+;/);
  if(!m) return false;
  var t=m[0];
  return (t.match(/minmax\(/g)||[]).length===4 && t.indexOf('auto')<0; })());
ok('★ 행에 클래스를 붙인다', /'alert alert-info'\) \+ ' mb-2 tc-row'/.test(code)
   || /\+ ' mb-2 tc-row'/.test(code));
ok('★ 세로 정렬 기준을 위로', /align-items: start/.test(html));

console.log('\n[2] ★★ 빈 칸도 자리를 지킨다 (안 그러면 그 행만 열이 밀린다)');
ok('★★ numbers 를 조건부로 빼지 않는다',
   /box\.appendChild\(el\('div', 'num', c\.numbers \? tr\(c\.numbers\) : ''\)\)/.test(code));
ok('★★ advice 도 조건부로 빼지 않는다',
   /box\.appendChild\(el\('div', 'text-secondary', c\.advice \? tr\(c\.advice\) : ''\)\)/.test(code));
ok('★ 예전 조건부 append 는 사라졌다',
   !/if \(c\.numbers\) box\.appendChild/.test(code) && !/if \(c\.advice\) box\.appendChild/.test(code));
ok('★ 항상 네 칸을 넣는다', (function(){
  var i=code.indexOf('comments.forEach');
  var seg=code.slice(i, i+700);
  return (seg.match(/box\.appendChild/g)||[]).length===4; })());

console.log('\n[3] 줄 간격이 칸마다 어긋나지 않게');
ok('★★ mt-1 로 생기던 세로 어긋남을 없앴다', /\.tc-row > \* \{ margin-top: 0 !important; \}/.test(html));
ok('★ JS 에서도 mt-1 을 빼 뒀다', (function(){
  var i=code.indexOf('comments.forEach');
  var seg=code.slice(i, i+700);
  return seg.indexOf("'num mt-1'")<0 && seg.indexOf("'mt-1 text-secondary'")<0; })());

console.log('\n[4] 좁은 화면에서는 쌓는다');
ok('★ 900px 이하에서 한 열', /@media \(max-width: 900px\)[\s\S]{0,120}grid-template-columns: 1fr/.test(html));

console.log('\n[5] 행마다 색은 유지된다 (경고·위험·양호)');
ok('★★ alert 톤 클래스가 그대로 붙는다', /TONE\[c\.status\] \|\| 'alert alert-info'/.test(code));
ok('★ display:contents 로 배경을 날리지 않았다', !/display: contents/.test(html));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
