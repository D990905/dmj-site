/* §525 W13 내보내기 — 문자열을 만드는 부분만 검사한다(내려받기는 부수효과). */
var E = require('./js/export.js');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

var t0 = Date.parse('2026-09-03T04:00:00.000Z');
var session = {
  startEpoch: t0, hasTime: true,
  samples: [
    { t: 0, lat: 35.178, lng: 129.205, ele: 1.2, speed: 8, heading: 40, hr: 150 },
    { t: 1, lat: 35.1781, lng: 129.2051, ele: 1.3, speed: 9, heading: 45, hr: 152 },
    { t: 2, lat: 35.1782, lng: 129.2052, ele: null, speed: null, heading: null, hr: null }
  ]
};
var analysis = { windDir: 0 };

console.log('[1] CSV — 단위를 열 이름에 박는다');
var csv = E.toCsv(session, analysis);
var lines = csv.trim().split('\n');
ok('헤더 + 3행', lines.length === 4, String(lines.length));
ok('속도 단위가 열 이름에', /speed_kt/.test(lines[0]));
ok('심박 단위도', /hr_bpm/.test(lines[0]));
ok('풍향이 있으면 TWA·VMG 열이 붙는다', /twa_deg,vmg_kt/.test(lines[0]));
ok('풍향이 없으면 안 붙는다', !/twa_deg/.test(E.toCsv(session, {}).split('\n')[0]));
ok('속도가 kt 로 변환된다', /,15\.55,/.test(lines[1]), lines[1]);
ok('TWA = |40-0| = 40', /,40\.0,/.test(lines[1]), lines[1]);
ok('빈 값은 빈 칸으로', lines[3].indexOf(',,') >= 0, lines[3]);
ok('ISO 시각이 들어간다', /2026-09-03T04:00:00/.test(lines[1]));

console.log('\n[2] CSV 이스케이프 — 쉼표·따옴표가 표를 깨지 않는다');
var T = E._test;
ok('쉼표는 감싼다', T.csvCell('a,b') === '"a,b"');
ok('따옴표는 두 번', T.csvCell('a"b') === '"a""b"');
ok('줄바꿈도 감싼다', T.csvCell('a\nb') === '"a\nb"');
ok('평범한 값은 그대로', T.csvCell('abc') === 'abc');
ok('null 은 빈 칸', T.csvCell(null) === '');

console.log('\n[3] GPX');
var gpx = E.toGpx(session, 'Songjeong');
ok('gpx 루트', /<gpx version="1.1"/.test(gpx));
ok('이름이 들어간다', /<name>Songjeong<\/name>/.test(gpx));
ok('좌표 있는 점만', (gpx.match(/<trkpt /g) || []).length === 3);
ok('고도', /<ele>1.2<\/ele>/.test(gpx));
ok('시각', /<time>2026-09-03T04:00:00.000Z<\/time>/.test(gpx));
ok('심박 확장', /<gpxtpx:hr>150<\/gpxtpx:hr>/.test(gpx));
ok('심박 없는 점엔 확장 없음',
   (gpx.match(/gpxtpx:TrackPointExtension>/g) || []).length === 4);

console.log('\n[4] ★ 시각이 없으면 가짜 시각을 만들지 않는다');
/* 넣으면 받는 쪽이 속도를 계산해 버려서, 없는 데이터가 퍼진다 */
var noTime = E.toGpx({ hasTime: false, startEpoch: null, samples: session.samples }, 'x');
ok('<time> 이 아예 없다', noTime.indexOf('<time>') < 0);
ok('그래도 좌표는 나온다', (noTime.match(/<trkpt /g) || []).length === 3);

console.log('\n[5] XML 이스케이프');
ok('& 이스케이프', T.xmlEsc('a&b') === 'a&amp;b');
ok('< > 이스케이프', T.xmlEsc('<x>') === '&lt;x&gt;');
ok('세션 이름에 태그가 있어도 깨지지 않는다',
   /<name>&lt;script&gt;<\/name>/.test(E.toGpx(session, '<script>')));

console.log('\n[6] 파일 이름 — 경로 구분자가 섞이면 안 된다');
ok('슬래시 제거', E.safeName('a/b', 'csv') === 'a-b.csv');
ok('공백은 밑줄', E.safeName('My Session', 'gpx') === 'My_Session.gpx');
ok('따옴표·별표 제거', E.safeName('a"b*c', 'csv') === 'a-b-c.csv');
ok('빈 이름은 기본값', E.safeName('', 'csv') === 'session.csv');
ok('null 도 기본값', E.safeName(null, 'gpx') === 'session.gpx');
ok('앞뒤 점은 깎는다', E.safeName('..hi..', 'csv') === 'hi.csv');
ok('아주 길면 자른다', E.safeName(new Array(300).join('a'), 'csv').length <= 84);

console.log('\n[7] 빈 세션');
ok('표본 없으면 헤더만', E.toCsv({ samples: [] }, {}).trim().split('\n').length === 1);
ok('GPX 도 껍데기는 유효', /<\/gpx>/.test(E.toGpx({ samples: [] }, 'x')));

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
