/* ============================================================
 * selftest-446-stability.js — 안정성 지표 · 코칭 트리거 검사
 *   실행: node selftest-446-stability.js
 * ============================================================ */
'use strict';
var St = require('./js/analysis-stability.js');
var T = St._test;
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (e ? '  → ' + e : '')); } }

var KT = 1.94384;
/* 합성 세션: 앞 절반은 피치가 안정(±0.5°)하고 빠름, 뒤 절반은 흔들리고 느림 */
function build(opts) {
  var s = [], t = 0, hz = 20;
  for (var seg = 0; seg < opts.segs; seg++) {
    var rough = seg >= opts.segs / 2;
    for (var i = 0; i < hz * 10; i++) {
      t += 1 / hz;
      var wob = rough ? 4 : 0.5;
      s.push({
        t: t,
        speed: (rough ? 14 : 20) / KT,
        heading: 90,
        heel: 30 + (rough ? 5 : 1) * Math.sin(i / 3),
        pitch: opts.flatPitch ? 0 : wob * Math.sin(i / 2),
        twa: 60,
        vmg: (rough ? 6 : 9) / KT
      });
    }
  }
  return { samples: s };
}

console.log('\n[1] 구간 분할');
var sess = build({ segs: 24 });   /* MIN_SEGMENTS(12) 를 넘겨야 통계가 돈다 */
var segs = St.segments(sess);
ok('10초 구간이 나온다', segs.length >= 20, String(segs.length));
ok('순항 12kt 미만은 제외', St.segments({ samples: sess.samples.map(function (p) {
  return Object.assign({}, p, { speed: 5 / KT }); }) }).length === 0);

console.log('\n[2] 선회 구간 제외');
var turning = { samples: sess.samples.map(function (p, i) {
  return Object.assign({}, p, { heading: (i * 0.5) % 360 }); }) };
ok('방위가 크게 도는 구간은 버린다', St.segments(turning).length < segs.length,
   St.segments(turning).length + ' vs ' + segs.length);

console.log('\n[3] 방위 산포는 순환값으로 계산');
ok('359°와 1° 는 가깝다', T.headingSd([359, 0, 1]) < 5, T.headingSd([359, 0, 1]).toFixed(1));
ok('0°와 180° 는 멀다', T.headingSd([0, 180]) > 60, T.headingSd([0, 180]).toFixed(1));

console.log('\n[4] 안정 구간이 더 빠르면 이득으로 나온다');
var st = St.analyze(sess);
ok('분석 성공', st.ok === true, st.reason);
ok('피치–속도 이득이 양수', st.pitchVsSpeed && st.pitchVsSpeed.gain > 3,
   st.pitchVsSpeed ? st.pitchVsSpeed.gain.toFixed(1) : 'null');

console.log('\n[5] 코칭 트리거');
var tips = St.coach(sess, st, null);
ok('피치 항목이 나온다', tips.some(function (x) { return x.id === 'pitch-stability'; }));
ok('근거 수치가 붙는다', tips[0] && /kt/.test(tips[0].detail));

console.log('\n[6] 차이가 없으면 조언하지 않는다');
var flat = build({ segs: 24, flatPitch: true });
var stFlat = St.analyze(flat);
var tipsFlat = St.coach(flat, stFlat, null);
ok('피치가 늘 평평하면 피치 항목 없음',
   !tipsFlat.some(function (x) { return x.id === 'pitch-stability'; }));

console.log('\n[7] 좌우 불균형 임계 = 3° (옥대표 실무값)');
ok('2° 차이는 조언 없음',
   !St.coach(sess, st, { port: 30, starboard: -28 })
     .some(function (x) { return x.id === 'heel-imbalance'; }));
ok('6° 차이는 조언 있음',
   St.coach(sess, st, { port: 30, starboard: -24 })
     .some(function (x) { return x.id === 'heel-imbalance'; }));
ok('12° 차이는 0점 의심으로 안내',
   St.coach(sess, st, { port: 30, starboard: -18 })
     .filter(function (x) { return x.id === 'heel-imbalance'; })[0].why.indexOf('zero point') >= 0);

console.log('\n[8] 표본 부족 시 통계로 쓰지 않는다');
var tiny = St.analyze(build({ segs: 4 }));
ok('구간이 적으면 ok=false', tiny.ok === false, tiny.reason);

console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===\n');
process.exit(fail ? 1 : 0);
