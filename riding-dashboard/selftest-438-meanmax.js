/* ============================================================
 * selftest-438-meanmax.js — Mean-max 곡선 순수 로직 검사
 *   실행: node selftest-438-meanmax.js   통과: exit 0
 * ============================================================ */
'use strict';
var MM = require('./js/chart-meanmax.js');
var T = MM._test;
var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}
var KT = 1.94384;
function kt2ms(k) { return k / KT; }

/* 실제 송정 세션 값 */
var analysis = {
  peaks: [ { windowSec: 2, speedMs: kt2ms(26.9) }, { windowSec: 10, speedMs: kt2ms(22.7) } ],
  distanceBests: [
    { distanceM: 100,  speedMs: kt2ms(22.8) },
    { distanceM: 250,  speedMs: kt2ms(21.8) },
    { distanceM: 500,  speedMs: kt2ms(20.4) },
    { distanceM: 1852, speedMs: kt2ms(18.1) }
  ],
  alpha: { distanceM: 500, speedMs: kt2ms(18.5) }
};

console.log('\n[1] 거리 → 지속시간 환산');
var pts = T.toDurationSeries(analysis);
ok('점 6개 (시간 2 + 거리 4)', pts.length === 6, String(pts.length));
ok('지속시간 오름차순', pts.every(function (p, i) { return i === 0 || p.sec >= pts[i-1].sec; }));
var byLabel = {}; pts.forEach(function (p) { byLabel[p.label] = p; });
ok('100 m ≈ 8.5 s', Math.abs(byLabel['100 m'].sec - 8.53) < 0.2, byLabel['100 m'].sec.toFixed(2));
ok('250 m ≈ 22.3 s', Math.abs(byLabel['250 m'].sec - 22.3) < 0.5, byLabel['250 m'].sec.toFixed(2));
ok('500 m ≈ 47.7 s', Math.abs(byLabel['500 m'].sec - 47.7) < 1.0, byLabel['500 m'].sec.toFixed(2));
ok('1 NM ≈ 199 s', Math.abs(byLabel['1 NM'].sec - 198.9) < 3, byLabel['1 NM'].sec.toFixed(1));

console.log('\n[2] 곡선은 단조 하강이어야 한다 (mean-max 의 정의)');
var mono = pts.every(function (p, i) { return i === 0 || p.kt <= pts[i-1].kt + 0.35; });
ok('지속시간이 길수록 속도가 낮거나 같다', mono,
   pts.map(function (p) { return p.kt.toFixed(1); }).join(' → '));

console.log('\n[3] Alpha 는 곡선에서 분리');
var a = T.alphaPoint(analysis);
ok('alpha 점이 따로 나온다', a && Math.abs(a.kt - 18.5) < 0.05);
ok('alpha 가 계열에 섞이지 않았다',
   !pts.some(function (p) { return Math.abs(p.kt - 18.5) < 0.01; }));

console.log('\n[4] y 축은 데이터 범위에 맞춘다 (0 부터 그리지 않는다)');
var yr = T.yRange(pts, a);
ok('하한이 0 이 아니다 — 0 이면 하강이 평평해진다', yr[0] > 5, JSON.stringify(yr));
ok('최저값(18.1)을 포함', yr[0] <= 18.1, JSON.stringify(yr));
ok('최고값(26.9)을 포함', yr[1] >= 26.9, JSON.stringify(yr));
ok('범위가 과하게 넓지 않다 (≤ 20kt)', (yr[1] - yr[0]) <= 20, String(yr[1] - yr[0]));

console.log('\n[5] 빈 입력 안전');
ok('analysis 없음 → 빈 배열', T.toDurationSeries(null).length === 0);
ok('alpha 없음 → null', T.alphaPoint({}) === null);
ok('speedMs 0 인 점은 버린다',
   T.toDurationSeries({ peaks: [{ windowSec: 2, speedMs: 0 }], distanceBests: [] }).length === 0);

console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===\n');
process.exit(fail ? 1 : 0);
