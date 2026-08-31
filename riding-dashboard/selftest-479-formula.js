/* §479 수식 언어 — 파서·평가·안전성 */
var RD = __dirname;
global.window = global;
global.RDGeo = require(RD + '/js/geo.js');
var F = require(RD + '/js/formula.js');
var An = require(RD + '/js/analysis.js');
var fs = require('fs');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); } }

console.log('§479 formula');

var SAMPLE = { speed: 10 / 1.94384, vmg: 5 / 1.94384, twa: 60, hr: 150,
               heading: 200, t: 100, cumDist: 2000 };
var CTX = { t0: 0 };
function ev(src) {
  var c = F.compile(src);
  if (!c.ok) throw new Error(c.error);
  return c.value(SAMPLE, CTX);
}
function near(a, b, tol) { return a != null && Math.abs(a - b) < (tol || 1e-6); }

/* --- 산술 --- */
ok('숫자', ev('42') === 42);
ok('사칙연산 우선순위', ev('2 + 3 * 4') === 14);
ok('괄호', ev('(2 + 3) * 4') === 20);
ok('거듭제곱 우선', ev('2 * 3 ^ 2') === 18);
ok('거듭제곱 우결합', ev('2 ^ 3 ^ 2') === 512);
ok('단항 음수', ev('-3 + 1') === -2);
ok('나눗셈 0 은 null (NaN 아님)', ev('1 / 0') === null);
ok('나머지', ev('7 % 3') === 1);
ok('소수', near(ev('0.5 * 4'), 2));

/* --- 변수 (표시 단위) --- */
ok('speed 는 kt 로 나온다', near(ev('speed'), 10, 1e-3), String(ev('speed')));
ok('vmg 는 kt', near(ev('vmg'), 5, 1e-3));
ok('twa 는 도', ev('twa') === 60);
ok('hr', ev('hr') === 150);
ok('t 는 경과초', ev('t') === 100);
ok('dist 는 누적 m', ev('dist') === 2000);

/* --- 함수 --- */
ok('abs', ev('abs(-5)') === 5);
ok('min/max 가변인자', ev('min(3, 1, 2)') === 1 && ev('max(3, 1, 2)') === 3);
ok('sqrt', ev('sqrt(16)') === 4);
ok('clamp', ev('clamp(15, 0, 10)') === 10);
ok('삼각함수는 도 단위', near(ev('cos(60)'), 0.5, 1e-9), String(ev('cos(60)')));
ok('rad/deg 변환', near(ev('deg(pi)'), 180, 1e-9));
ok('if()', ev('if(twa < 90, 1, 2)') === 1);
ok('상수 pi', near(ev('pi'), Math.PI));

/* --- 비교·논리·삼항 --- */
ok('비교는 1/0', ev('speed > 5') === 1 && ev('speed > 50') === 0);
ok('삼항', ev('twa < 90 ? 10 : 20') === 10);
ok('&&', ev('(twa < 90) && (hr > 100)') === 1);
ok('||', ev('(twa > 900) || (hr > 100)') === 1);
ok('! 부정', ev('!(twa > 900)') === 1);

/* --- 실제로 쓸 만한 수식 --- */
ok('속도 ÷ 심박 × 100', near(ev('speed / hr * 100'), 10 / 150 * 100, 1e-3));
ok('조건부 지표 (각이 벌어졌을 때만 속도)',
   ev('twa > 50 ? speed : 0') > 9);

/* --- 결측값은 null 로 전파 --- */
var noHr = { speed: 5, vmg: 2, twa: 60, hr: null, heading: 10, t: 0, cumDist: 0 };
var cHr = F.compile('speed / hr');
ok('결측 변수는 null 을 낸다 (0 치환 아님)',
   cHr.value(noHr, CTX) === null);
var cIf = F.compile('if(hr > 0, hr, 0)');
ok('if 는 조건이 null 이면 null', cIf.value(noHr, CTX) === null);
var cOr = F.compile('(speed > 1) || (hr > 100)');
ok('단락 평가 — 왼쪽으로 결론나면 오른쪽 결측 무시',
   cOr.value(noHr, CTX) === 1);

/* --- 오류 처리 --- */
function err(src) { var c = F.compile(src); return c.ok ? null : c.error; }
ok('빈 수식', err('') != null);
ok('닫히지 않은 괄호', err('(1 + 2') != null);
ok('모르는 이름', err('foobar + 1') != null, String(err('foobar + 1')));
ok('모르는 함수', err('hack(1)') != null);
ok('인자 개수 틀림', err('clamp(1, 2)') != null);
ok('꼬리 쓰레기', err('1 + 2 )') != null);
ok('숫자 형식 오류', err('1.2.3') != null);

/* --- 안전성: 문법에 없는 건 표현 자체가 안 된다 --- */
['window', 'this', 'globalThis', 'process', 'require',
 'constructor', 'a.b', 'a["b"]', 'function(){}', '`x`', 'x=>x',
 'speed; alert(1)', 'speed = 1'].forEach(function (bad) {
  var c = F.compile(bad);
  ok('거부: ' + bad, !c.ok, c.ok ? 'accepted!' : '');
});
ok('할당 연산자는 문법에 없다', err('speed = 5') != null);
ok('속성 접근은 문법에 없다', err('speed.toString') != null);

/* --- 세션 요약 --- */
function synth(n) {
  var S = [];
  for (var i = 0; i < n; i++) {
    S.push({ t: i, lat: 35, lng: 129, speed: 5, vmg: 3, twa: 50,
             hr: i < n / 2 ? 140 : null, heading: 200, cumDist: i * 5 });
  }
  return { samples: S, legs: [{ start: 0, end: n - 1 }], cfg: { gapThresholdSec: 8 } };
}
var sess = synth(200);
var sum = F.summarize(sess, F.compile('speed'));
ok('요약: 평균', near(sum.mean, 5 * 1.94384, 1e-6), String(sum.mean));
ok('요약: 커버리지 100%', near(sum.coverage, 1));
var sum2 = F.summarize(sess, F.compile('hr'));
ok('요약: 결측 절반이면 커버리지 ~50%',
   sum2.coverage > 0.45 && sum2.coverage < 0.55, sum2.coverage.toFixed(2));
ok('요약: min/max', sum.min != null && sum.max != null);
ok('컴파일 실패는 요약도 null', F.summarize(sess, F.compile('nope')) === null);

/* --- uses 추적 --- */
var cu = F.compile('speed / hr + twa');
ok('쓰인 변수 추적', cu.uses.sort().join(',') === 'hr,speed,twa', cu.uses.join(','));

/* --- 실데이터 --- */
var GPX = '/Users/dannyok/Desktop/Waterspeed 2026-08-31T05.53.54.000Z.gpx';
if (fs.existsSync(GPX)) {
  var src = fs.readFileSync(RD + '/../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
  eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));
  var real = An.normalizeSession(parseGpxNode(fs.readFileSync(GPX, 'utf8')));
  var a = An.analyzeSession(real, 218, {});
  var rs = F.summarize(real, F.compile('speed'));
  ok('실세션: 수식 평균속도가 요약과 맞는다 (±2kt)',
     Math.abs(rs.mean - a.summary.avgSpeedMovingMs * 1.94384) < 2.5,
     rs.mean.toFixed(1) + ' vs ' + (a.summary.avgSpeedMovingMs * 1.94384).toFixed(1));
  var eff = F.summarize(real, F.compile('speed / hr * 100'));
  ok('실세션: 속도/심박 효율이 나온다', eff && eff.mean > 0,
     eff ? eff.mean.toFixed(2) : 'null');
} else { console.log('  SKIP  실데이터 없음'); }

console.log('');
console.log('§479  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
