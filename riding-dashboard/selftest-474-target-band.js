/* §474 타깃 퍼센타일 밴드 — 창 추출·퍼센타일 복원·선택≠표시 */
global.window = global;
global.RDGeo = require('./js/geo.js');
var An = require('./js/analysis.js');
var fs = require('fs');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  ' + e : '')); } }

console.log('§474 target band');

/* 합성 세션: 풍향 0°, 풍상 45° 를 속도 여러 단계로 달린다. */
function mk(speedsMs, twa, windDir) {
  var S = [], t = 0, lat = 35, lng = 129;
  speedsMs.forEach(function (sp) {
    for (var i = 0; i < 25; i++) {          /* 25초씩 */
      S.push({ t: t++, lat: lat += 1e-5, lng: lng += 1e-5,
               speed: sp, heading: ((windDir + twa) % 360 + 360) % 360 });
    }
  });
  return { hasTime: true, samples: S, legs: [{ start: 0, end: S.length - 1 }],
           cfg: An.DEFAULTS };
}

var sess = mk([5, 6, 7, 8, 9, 10, 11, 12], 45, 0);
var tw = An.sessionTargetWindows(sess, 0, { windowSec: 20, keepFraction: 0.5, minSpeedKt: 8 });
ok('창이 만들어진다', tw && tw.upwind.total > 0, JSON.stringify(tw && tw.upwind.total));
ok('풍상 존으로 분류', tw.upwind.total > 0 && tw.downwind.total === 0);
ok('상위 절반만 저장',
   Math.abs(tw.upwind.kept.length - Math.round(tw.upwind.total * 0.5)) <= 1,
   tw.upwind.kept.length + '/' + tw.upwind.total);
ok('저장분은 VMG 내림차순',
   tw.upwind.kept.every(function (x, i, A) { return i === 0 || A[i - 1].v >= x.v; }));
ok('느린 표본(8kt 미만)은 제외됨',
   tw.upwind.kept.every(function (x) { return x.s >= 8; }),
   JSON.stringify(tw.upwind.kept.map(function (x) { return x.s; })));

/* VMG = 속도 · cos(45°) */
var top = tw.upwind.kept[0];
ok('VMG = 속도 × cos(CWA)',
   Math.abs(top.v - top.s * Math.cos(Math.PI / 4)) < 0.05,
   top.v + ' vs ' + (top.s * Math.cos(Math.PI / 4)).toFixed(2));

/* 풍하 */
var down = An.sessionTargetWindows(mk([9, 10, 11, 12], 135, 0), 0,
                                   { windowSec: 20, keepFraction: 0.5, minSpeedKt: 8 });
ok('풍하 존으로 분류', down.downwind.total > 0 && down.upwind.total === 0);
ok('풍하 VMG 도 양수', down.downwind.kept.every(function (x) { return x.v > 0; }));

/* 존을 넘나드는 창은 인정하지 않는다 */
var mixed = mk([10, 10], 45, 0);
for (var i = 25; i < 50; i++) mixed.samples[i].heading = 135;
var mx = An.sessionTargetWindows(mixed, 0, { windowSec: 20, keepFraction: 1, minSpeedKt: 8 });
ok('존 전환에서 창이 끊긴다', mx.upwind.total >= 1 && mx.downwind.total >= 1,
   mx.upwind.total + '/' + mx.downwind.total);

/* --- 밴드: 퍼센타일 복원 --- */
/* 전체 100창 중 상위 30 저장. p75 는 상위 25번째 → 저장 범위 안. */
function fakeSet(total, keptVals) {
  return { windowSec: 20, keepFraction: keptVals.length / total,
           upwind: { total: total, kept: keptVals.map(function (v, i) {
             return { v: v, s: 20 - i * 0.05, a: 40 + i * 0.1 }; }) },
           downwind: { total: 0, kept: [] } };
}
var vals = [];
for (var k = 0; k < 30; k++) vals.push(10 - k * 0.1);      /* 10.0 → 7.1 내림차순 */
var band = An.buildTargetBand([fakeSet(100, vals)], {});
ok('전체 창 수 복원', band.upwind.totalWindows === 100);
ok('p95 > p90 > p75 (VMG)',
   band.upwind.levels[95].vmgKt > band.upwind.levels[90].vmgKt &&
   band.upwind.levels[90].vmgKt > band.upwind.levels[75].vmgKt,
   [95, 90, 75].map(function (p) { return band.upwind.levels[p].vmgKt.toFixed(2); }).join(' '));

/* 남긴 범위 밖 퍼센타일은 null */
var band2 = An.buildTargetBand([fakeSet(1000, vals)], {});   /* 30/1000 = 상위 3% */
ok('저장 범위 밖 퍼센타일은 null (모르는 건 모른다)',
   band2.upwind.levels[75] === null && band2.upwind.levels[95] === null,
   JSON.stringify([band2.upwind.levels[75], band2.upwind.levels[95]]));
ok('범위 안 퍼센타일은 값이 있다', band2.upwind.levels[99] === undefined ||
   An.buildTargetBand([fakeSet(1000, vals)], { levels: [98] }).upwind.levels[98] != null);

/* --- 선택 ≠ 표시: 실데이터 --- */
var GPX = '/Users/dannyok/Desktop/Waterspeed 2026-08-31T05.53.54.000Z.gpx';
if (fs.existsSync(GPX)) {
  var src = fs.readFileSync('../.claude/skills/riding-analysis/scripts/analyze.js', 'utf8');
  eval(src.slice(src.indexOf('function parseGpxNode'), src.indexOf('function loadOne')));
  var real = An.normalizeSession(parseGpxNode(fs.readFileSync(GPX, 'utf8')));
  var a = An.analyzeSession(real, 218, {});
  ok('analyzeSession 이 targetWindows 를 붙인다', a.targetWindows != null);
  var rb = An.buildTargetBand([a.targetWindows], { basis: 'single-session' });
  var up = rb.upwind;
  ok('실세션: 풍상 p75/p90/p95 모두 산출',
     up.levels[75] && up.levels[90] && up.levels[95]);
  /* 선택은 VMG 로 했으니 VMG 는 반드시 단조. 속도·각도는 따라온 값이라
     단조일 이유가 없다 — 그게 이 방법의 핵심이다. */
  ok('실세션: VMG 는 퍼센타일 따라 단조 증가',
     up.levels[95].vmgKt > up.levels[90].vmgKt &&
     up.levels[90].vmgKt > up.levels[75].vmgKt);
  ok('실세션: 높은 VMG 는 더 좁은 각도와 함께 온다',
     up.levels[95].twaDeg < up.levels[75].twaDeg,
     up.levels[95].twaDeg.toFixed(0) + '° vs ' + up.levels[75].twaDeg.toFixed(0) + '°');
  var cmp = An.compareToTargetBand(a.targetWindows, rb, { level: 90 });
  ok('자기 자신과 비교하면 ~100%',
     cmp.upwind && Math.abs(cmp.upwind.pct - 100) < 25,
     cmp.upwind ? cmp.upwind.pct.toFixed(0) + '%' : 'null');
  ok('저장 크기 5KB 미만', JSON.stringify(a.targetWindows).length < 5000,
     JSON.stringify(a.targetWindows).length + ' bytes');
  /* 풍향이 없으면 낼 수 없다 */
  var noWind = An.analyzeSession(real, null, {});
  ok('풍향 없으면 targetWindows 는 null', noWind.targetWindows === null);
} else { console.log('  SKIP  실데이터 없음'); }

/* --- 엣지 --- */
ok('빈 입력은 null', An.buildTargetBand([]) === null &&
   An.buildTargetBand(null) === null);
ok('풍향 없으면 창도 null', An.sessionTargetWindows(sess, null) === null);
ok('비교 입력이 없으면 null', An.compareToTargetBand(null, band) === null);

console.log('\n§474  ' + pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
