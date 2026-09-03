/* §518 — "모두 한번에 선택" (옥대표). 핵심 규칙 두 가지를 고정한다.
     ① 고르는 대상은 **지금 필터에 보이는 것**뿐이다
     ② 해제할 때 **필터 밖에서 고른 것은 건드리지 않는다**
   그리고 §519 — 제외 배너가 무엇이 바뀌고 무엇이 안 바뀌는지 둘 다 말한다. */
var fs = require('fs'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

console.log('[1] 선택 로직 — 순수 부분을 떼어 실제로 돌린다');
/* 화면 코드와 같은 규칙을 그대로 옮겨 검사한다 */
function selectAll(TURNSEL, viewIdx) {
  var allPicked = viewIdx.length > 0 && viewIdx.every(function (i) {
    return TURNSEL.indexOf(i) >= 0;
  });
  if (allPicked) {
    var keep = TURNSEL.filter(function (i) { return viewIdx.indexOf(i) < 0; });
    TURNSEL.length = 0;
    keep.forEach(function (i) { TURNSEL.push(i); });
  } else {
    viewIdx.forEach(function (i) { if (TURNSEL.indexOf(i) < 0) TURNSEL.push(i); });
  }
  return allPicked;
}

var sel = [];
selectAll(sel, [3, 5, 7]);
ok('빈 상태에서 보이는 것 전부 선택', sel.join(',') === '3,5,7', sel.join(','));

var wasAll = selectAll(sel, [3, 5, 7]);
ok('다 골라져 있으면 해제로 동작', wasAll === true);
ok('해제되면 비어 있다', sel.length === 0);

/* 필터 밖 선택 보호 — 이게 이 기능의 진짜 함정이다 */
sel = [1, 2, 99];
selectAll(sel, [3, 5]);
ok('필터 밖(1,2,99)은 유지한 채 추가', sel.join(',') === '1,2,99,3,5', sel.join(','));
selectAll(sel, [3, 5]);
ok('해제해도 필터 밖은 그대로', sel.join(',') === '1,2,99', sel.join(','));

/* 일부만 골라져 있으면 '전체 선택' 이어야 한다 (해제가 아니라) */
sel = [3];
var w2 = selectAll(sel, [3, 5, 7]);
ok('일부만 골라져 있으면 선택으로 동작', w2 === false);
ok('중복 없이 채운다', sel.join(',') === '3,5,7', sel.join(','));

sel = [];
ok('보이는 게 없으면 아무 일도 없다',
   selectAll(sel, []) === false && sel.length === 0);

console.log('\n[2] 배열을 재할당하지 않는다 (다른 곳이 같은 참조를 쓴다)');
sel = [1, 2, 3];
var ref = sel;
selectAll(sel, [1, 2, 3]);
ok('같은 배열 객체가 유지된다', ref === sel && ref.length === 0);

console.log('\n[3] 화면 코드에 규칙이 실제로 박혀 있다');
ok('보이는 것만 대상으로 한다(viewIdx)', /var viewIdx = view\.map/.test(src));
ok('제자리 비우기(재할당 금지)', /TURNSEL\.length = 0;\s*\n\s*keep\.forEach/.test(src));
ok('버튼 하나가 선택↔해제를 겸한다',
   /allPicked \? 'Clear ' \+ viewIdx\.length : 'Select all ' \+ viewIdx\.length/.test(src));

console.log('\n[4] §519 제외 배너가 양쪽을 다 말한다');
ok('바뀌는 것을 나열한다',
   /distance, average speed, \s*\n?\s*.?foiling share, turns, the map and the timeline/.test(src)
   || /foiling share, turns, the map and the timeline/.test(src));
ok('점수가 안 움직인다는 것도 말한다',
   /performance score barely moves/.test(src));
ok('왜 그런지까지 적는다 (상위 20% 앵커)',
   /best 20% upwind VMG/.test(src));
ok('예전의 과장된 문구는 없다',
   !/distance, speed and turn analysis are recomputed without them/.test(src));

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
