/* §514 웰니스 CSV 가져오기 — 기기별 열 이름 자동 인식 */
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/js/v2-app.js', 'utf8');
function grab(name) {
  var i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('못 찾음: ' + name);
  return src.slice(i, src.indexOf('\n  }\n', i) + 4);
}
/* '\n  };' 는 5글자다 — +4 로 자르면 세미콜론이 잘려 구문 오류가 난다 */
var cols = src.slice(src.indexOf('  var WELL_COLS = {'),
                     src.indexOf('\n  };', src.indexOf('  var WELL_COLS = {')) + 5);
var F = new Function(cols + grab('wellMatchCols') + grab('wellNormDate')
  + grab('wellNormSleep') + grab('parseWellnessCsv')
  + '\nreturn { match: wellMatchCols, date: wellNormDate, sleep: wellNormSleep, parse: parseWellnessCsv };')();

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }

console.log('\n[1] 날짜 정규화 — 기기마다 형식이 다르다');
ok('ISO', F.date('2026-09-02') === '2026-09-02');
ok('슬래시', F.date('2026/9/2') === '2026-09-02');
ok('점', F.date('2026.09.02') === '2026-09-02');
ok('ISO 시각 포함', F.date('2026-09-02T07:15:00+09:00') === '2026-09-02');
ok('빈 값 null', F.date('') === null);
ok('쓰레기 null', F.date('not a date') === null);

console.log('\n[2] ★ 수면 단위 — 초·분·시간이 섞여 들어온다');
ok('28800초 → 8.0h', F.sleep(28800) === 8);
ok('450분 → 7.5h', F.sleep(450) === 7.5);
ok('7.5시간 그대로', F.sleep(7.5) === 7.5);
ok('0 은 null', F.sleep(0) === null);

console.log('\n[3] Oura 형식');
var oura = F.parse(
  'date,Average HRV,Lowest Resting Heart Rate,Total Sleep Duration\n' +
  '2026-08-01,52,44,27000\n2026-08-02,61,42,28800\n');
ok('읽힌다', oura.ok === true, oura.error || '');
ok('2일', oura.rows.length === 2);
ok('HRV 52', oura.rows[0].hrvMs === 52);
ok('안정시심박 44', oura.rows[0].rhrBpm === 44);
ok('수면 7.5h (초→시간)', oura.rows[0].sleepH === 7.5);

console.log('\n[4] Garmin 형식');
var gar = F.parse('Date,Resting HR,HRV (ms)\n2026-08-01,45,58\n2026-08-02,47,51\n');
ok('읽힌다', gar.ok === true);
ok('안정시심박', gar.rows[1].rhrBpm === 47);
ok('HRV', gar.rows[1].hrvMs === 51);

console.log('\n[5] Apple Health 내보내기 형식');
var ah = F.parse('startDate,HeartRateVariabilitySDNN,RestingHeartRate\n'
  + '2026-08-01 07:00:00,48.2,50\n');
ok('읽힌다', ah.ok === true, ah.error || JSON.stringify(ah.header));
ok('소수 HRV', ah.ok && Math.abs(ah.rows[0].hrvMs - 48.2) < 1e-6);

console.log('\n[6] 한글 열 이름');
var kr = F.parse('날짜,안정시심박수,수면시간\n2026-08-01,44,7.5\n');
ok('읽힌다', kr.ok === true, kr.error || JSON.stringify(kr.header));
ok('안정시심박', kr.ok && kr.rows[0].rhrBpm === 44);

console.log('\n[7] 이상값은 버린다 — 오염된 CSV 를 그대로 먹지 않는다');
var bad = F.parse('date,HRV,Resting HR\n'
  + '2026-08-01,9999,44\n'      /* HRV 범위 밖 */
  + '2026-08-02,55,5\n'         /* 심박 범위 밖 */
  + '2026-08-03,55,44\n');
ok('3행 중 유효한 것만', bad.ok && bad.rows.length === 3);
ok('HRV 9999 는 버려진다', bad.ok && bad.rows[0].hrvMs === undefined);
ok('그 행의 심박은 살린다', bad.ok && bad.rows[0].rhrBpm === 44);
ok('심박 5 는 버려진다', bad.ok && bad.rows[1].rhrBpm === undefined);

console.log('\n[8] 거부 — 근거 없이 먹지 않는다');
ok('날짜 열 없으면 거부', F.parse('a,b\n1,2\n').ok === false);
ok('웰니스 열 없으면 거부', F.parse('date,steps\n2026-08-01,9000\n').ok === false);
ok('그때 본 열 이름을 알려 준다',
   Array.isArray(F.parse('date,steps\n2026-08-01,9000\n').header));
ok('한 줄짜리 거부', F.parse('date,HRV\n').ok === false);

console.log('\n[9] 따옴표·쉼표 포함 값');
var q = F.parse('date,"HRV, avg",Resting HR\n"2026-08-01",55,44\n');
ok('따옴표 헤더도 인식', q.ok === true, q.error || JSON.stringify(q.header));

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
