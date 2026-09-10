/* §586i 트랙 지도가 최대 배율(z19)로 열리던 것 — 데스크톱·폰 모두

   라이브 실측 (2026-09-10): 1280px, 모바일 셸 꺼진 상태에서 Track 탭을
   누르면 타일 URL 이 /19/… — 최대 배율. 1~2 km 세션이 351px 에 들어가려면
   z14~15 여야 한다.

   원인 사슬:
     지도는 숨은 탭에서 만들어진다(첫 탭 Wind, §578) → 크기 0
     → fitBounds 가 최대 배율을 고름
     → 모듈의 60ms 재맞춤(§491)도 탭이 여전히 숨어 있어 0 에서 헛돎
     → 탭을 열 때 invalidateSize 만 부름 — 크기만 고치고 배율은 그대로

   이 테스트는 ensureTrackFit 를 소스에서 떼어 내 가짜 지도에 돌린다. */
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }
var app = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'v2.html'), 'utf8');
var code = app.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('[1] 탭을 열 때');
ok('★★ invalidateSize 만 부르던 옛 코드가 없다',
   !/if \(sel === '#tab-track' && mapInst && mapInst\.map\) \{\s*setTimeout\(function \(\) \{ mapInst\.map\.invalidateSize\(\); \}, 60\);/.test(code));
ok('★★ 트랙 탭이 보이면 ensureTrackFit', /if \(sel === '#tab-track'\) setTimeout\(ensureTrackFit, 60\);/.test(code));
ok('★ 지도가 보이는 채로 태어났는지 기억한다',
   /TRACK_BORN_VISIBLE = host\.offsetWidth > 0;/.test(code));

/* 소스에서 떼어 내 실제로 돌린다 */
function grab(name) {
  var m = app.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'));
  return m ? m[0] : null;
}
var srcB = grab('trackLatLngBounds'), srcE = grab('ensureTrackFit');
ok('★ 두 함수를 소스에서 떼어 낼 수 있다', !!(srcB && srcE));

function harness(opts) {
  var calls = { fit: [], inval: 0 };
  var fakeMap = {
    invalidateSize: function () { calls.inval++; },
    getSize: function () { return { x: opts.w, y: opts.h }; },
    fitBounds: function (b, o) { calls.fit.push(b); }
  };
  var env = { mapInst: opts.noMap ? null : { map: fakeMap }, TRACK_BORN_VISIBLE: !!opts.born,
              CUR: { session: { samples: opts.samples } } };
  if (opts.preFit !== undefined && env.mapInst) env.mapInst._fitDone = opts.preFit;
  /* 클로저 변수를 흉내 낸다 */
  var run = new Function('env',
    'var mapInst = env.mapInst, TRACK_BORN_VISIBLE = env.TRACK_BORN_VISIBLE, CUR = env.CUR;' +
    'var window = { console: { error: function () { env.err = arguments; } } };' +
    srcB + '\n' + srcE + '\n' +
    'ensureTrackFit(); var second = null; ' +
    'return { mi: mapInst, again: function () { ensureTrackFit(); } };');
  var r = run(env);
  return { calls: calls, inst: r.mi, again: r.again, env: env };
}
var SAMPLES = [
  { lat: 35.178, lng: 129.199 }, { lat: 35.182, lng: 129.205 },
  { lat: null, lng: null }, { lat: 35.175, lng: 129.210 }
];

if (srcB && srcE) {
  console.log('\n[2] 가짜 지도로 돌려 본다');
  var h1 = harness({ w: 351, h: 460, born: false, samples: SAMPLES });
  ok('★★ 숨은 채 태어난 지도는 보이는 순간 전체 트랙에 맞춘다', h1.calls.fit.length === 1,
     'fit=' + h1.calls.fit.length);
  ok('★★ 경계는 실제 좌표의 최소·최대 (빈 좌표는 건너뜀)',
     h1.calls.fit.length && JSON.stringify(h1.calls.fit[0]) === JSON.stringify([[35.175, 129.199], [35.182, 129.21]]),
     JSON.stringify(h1.calls.fit[0]));
  ok('★ 크기부터 고친다', h1.calls.inval === 1);
  h1.again();
  ok('★★ 두 번째로 열 때는 다시 맞추지 않는다 (사용자가 옮긴 화면 보존)', h1.calls.fit.length === 1,
     'fit=' + h1.calls.fit.length);
  ok('★ 그래도 크기는 매번 고친다', h1.calls.inval === 2);

  var h2 = harness({ w: 351, h: 460, born: true, samples: SAMPLES });
  ok('★★ 보이는 채로 태어난 지도는 건드리지 않는다 (모듈이 이미 맞춤)', h2.calls.fit.length === 0);

  var h3 = harness({ w: 0, h: 0, born: false, samples: SAMPLES });
  ok('★★ 아직 숨어 있으면 맞추지 않는다 (0 에서 맞추면 또 z19)', h3.calls.fit.length === 0);
  ok('★★ …그리고 다음 기회를 남긴다 (맞췄다고 표시하지 않음)', h3.inst._fitDone === false);

  var h4 = harness({ w: 351, h: 460, born: false, samples: SAMPLES, preFit: true });
  ok('★★ §584 구간 보기가 먼저 표시했으면 전체로 덮지 않는다', h4.calls.fit.length === 0);

  var h5 = harness({ w: 351, h: 460, born: false, samples: [{ lat: 35.1, lng: 129.1 }] });
  ok('★ 점이 하나뿐이면 맞추지 않는다 (경계가 없다)', h5.calls.fit.length === 0);

  var h6 = harness({ noMap: true, w: 351, h: 460, samples: SAMPLES });
  ok('★ 지도가 없어도 터지지 않는다', !h6.env.err);
}

console.log('\n[3] §584 구간 보기와 겹치지 않게');
ok('★★ 구간 보기는 탭을 누르기 전에 표시한다 (60ms 전체 → 140ms 구간 튐 방지)', (function () {
  var i = code.indexOf('function showRangeOnTrack');
  var seg = code.slice(i, i + 900);
  var a = seg.indexOf('mapInst._fitDone = true'), b = seg.indexOf('link.click()');
  return a > 0 && b > 0 && a < b; })());

console.log('\n[4] 배포');
ok('★★ v2-app 캐시버스트가 올라갔다 (v586i 이상)', (function () {
  var m = html.match(/js\/v2-app\.js\?v=v(\d+)([a-z]?)/);
  return !!m && (+m[1] > 586 || (+m[1] === 586 && m[2] >= 'i')); })());
ok('★ 실패는 삼키지 않고 스택을 남긴다', /console\.error\('\[v2 §586i\] track fit', e\)/.test(app));

console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
