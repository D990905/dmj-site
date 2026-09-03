/* §524 %폭발 감사 — Waterspeed 의 `Exit VMG +421.4%` 를 보고 우리 코드를
   뒤졌더니 §502 tbDiff 에 같은 결함이 있었다. 그 가드를 고정한다. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

function grab(name) {
  var i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  var d = 0, st = false;
  for (var j = i; j < src.length; j++) {
    if (src[j] === '{') { d++; st = true; }
    else if (src[j] === '}') { d--; if (st && d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unterminated: ' + name);
}
var i0 = src.indexOf('  var TB_PCT_FLOOR = {');
var floors = src.slice(i0, src.indexOf('\n  };', i0) + 5);
var ctx = { Math: Math, isFinite: isFinite, console: console };
vm.createContext(ctx);
vm.runInContext(floors + '\n' + grab('tbDiff'), ctx);

console.log('[1] 정상 범위에서는 그대로 낸다');
ok('15 → 12 kt = -20%', Math.abs(ctx.tbDiff(15, 12, 'kt') + 20) < 1e-9,
   String(ctx.tbDiff(15, 12, 'kt')));
ok('10 → 11 kt = +10%', Math.abs(ctx.tbDiff(10, 11, 'kt') - 10) < 1e-9);
ok('심박 150 → 160', Math.abs(ctx.tbDiff(150, 160, 'bpm') - 6.6667) < 0.001);
ok('각도 60 → 66 deg', Math.abs(ctx.tbDiff(60, 66, 'deg') - 10) < 1e-9);

console.log('\n[2] ★ 분모가 바닥 미만이면 백분율을 만들지 않는다');
/* Waterspeed 가 +421.4% 를 낸 자리 */
ok('0.3 → 2.0 kt 는 null (예전엔 +567%)', ctx.tbDiff(0.3, 2.0, 'kt') === null,
   String(ctx.tbDiff(0.3, 2.0, 'kt')));
ok('0.6 → 3.1 kt 도 null', ctx.tbDiff(0.6, 3.1, 'kt') === null);
ok('1.0 kt 는 경계 위라 나온다', ctx.tbDiff(1.0, 2.0, 'kt') === 100);
ok('0.99 kt 는 경계 아래라 null', ctx.tbDiff(0.99, 2.0, 'kt') === null);
ok('음수 분모도 크기로 판정', ctx.tbDiff(-0.4, 1.0, 'kt') === null);
ok('음수라도 충분히 크면 낸다', ctx.tbDiff(-2.0, -1.0, 'kt') === 50);

console.log('\n[3] 단위마다 바닥이 다르다');
ok('심박 30 은 측정오류라 null', ctx.tbDiff(30, 60, 'bpm') === null);
ok('각도 3° 기준은 null', ctx.tbDiff(3, 9, 'deg') === null);
ok('각도 6° 는 낸다', ctx.tbDiff(6, 9, 'deg') === 50);
ok('모르는 단위는 기본 바닥 0.5', ctx.tbDiff(0.4, 1, '') === null);
ok('그 위면 낸다', ctx.tbDiff(0.6, 1.2, '') === 100);

console.log('\n[4] 입력 방어');
ok('null 이면 null', ctx.tbDiff(null, 5, 'kt') === null);
ok('상대도 null 이면 null', ctx.tbDiff(5, null, 'kt') === null);
ok('NaN 이면 null', ctx.tbDiff(NaN, 5, 'kt') === null);
ok('Infinity 면 null', ctx.tbDiff(5, Infinity, 'kt') === null);

console.log('\n[5] 화면이 %대신 절대 차이를 보여 준다');
ok('절대 차이 분기가 있다', /too small a base for %/.test(src));
ok('absDelta 를 쓴다', /var absDelta = \(pf\.v != null/.test(src));

console.log('\n[6] 다른 %산출부도 분모 가드가 있다');
var an = fs.readFileSync(path.join(__dirname, 'js/analysis.js'), 'utf8');
ok('lossPct 는 refSpeed>0 + clamp', /refSpeed > 0[\s\S]{0,120}Geo\.clamp/.test(an));
ok('vmgGain 은 MIN_VMG 게이트 + clamp',
   /entryVmgMs >= MANEUVER_MIN_VMG_MS[\s\S]{0,200}Geo\.clamp\(exitVmgMs \/ entryVmgMs, 0, 1\)/.test(an));
ok('pctOfTarget 은 speedMs>0 가드', /if \(tb && tb\.speedMs > 0\)/.test(an));

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
