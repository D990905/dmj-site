/* §526 T4 심박회복 · T5 목표 강도 밴드 (Athlytic 벤치마킹 마지막 둘) */
var F = require('./js/fitness.js');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

console.log('[1] T5 목표 밴드 — Karvonen (심박예비량)');
var b = F.targetBand('moderate', 185, 42);
ok('산출된다', b.ok === true, JSON.stringify(b));
ok('Karvonen 을 쓴다', b.method === 'karvonen');
/* 60% = 42 + 143*0.60 = 127.8 → 128 */
ok('하한 128', b.loBpm === 128, String(b.loBpm));
/* 75% = 42 + 143*0.75 = 149.25 → 149 */
ok('상한 149', b.hiBpm === 149, String(b.hiBpm));
ok('강도 라벨', b.label === 'steady');

console.log('\n[2] 안정시심박이 없으면 %최대로 떨어지되 **그렇다고 말한다**');
var b2 = F.targetBand('moderate', 185, null);
ok('산출은 된다', b2.ok === true);
ok('방식이 pct_max', b2.method === 'pct_max');
ok('60% of 185 = 111', b2.loBpm === 111, String(b2.loBpm));
ok('같은 %라도 Karvonen 과 다르다', b2.loBpm !== b.loBpm);

console.log('\n[3] 행동에 따라 밴드가 달라진다');
ok('active_recovery 가 더 낮다',
   F.targetBand('active_recovery', 185, 42).hiBpm < b.loBpm + 10);
ok('full_ride 가 더 높다', F.targetBand('full_ride', 185, 42).hiBpm > b.hiBpm);

console.log('\n[4] ★ 쉬는 날엔 밴드를 주지 않는다');
/* 목표 심박을 주면 그건 타라는 말이 된다 */
var rest = F.targetBand('rest', 185, 42);
ok('ok=false', rest.ok === false);
ok('이유가 rest_day', rest.reason === 'rest_day');
ok('최대심박 없으면 need_max_hr',
   F.targetBand('moderate', null, 42).reason === 'need_max_hr');
ok('모르는 행동은 unknown_action',
   F.targetBand('nope', 185, 42).reason === 'unknown_action');

console.log('\n[5] 밴드 준수 — 처방과 실행을 잇는다');
var S = [];
for (var i = 0; i < 100; i++) {
  S.push({ t: i, hr: i < 30 ? 100 : (i < 70 ? 135 : 170) });
}
var c = F.bandCompliance(S, b);   /* 128~149 */
ok('밴드 안 시간', Math.abs(c.inSec - 40) <= 1, String(c.inSec));
ok('아래 시간', Math.abs(c.belowSec - 30) <= 1, String(c.belowSec));
ok('위 시간', Math.abs(c.aboveSec - 30) <= 1, String(c.aboveSec));
ok('비율', Math.abs(c.inPct - 40) < 2, String(c.inPct));
ok('밴드가 없으면 null', F.bandCompliance(S, rest) === null);
ok('심박 없으면 null', F.bandCompliance([{ t: 0 }, { t: 1 }], b) === null);

console.log('\n[6] T4 심박회복 — 힘든 뒤 60초에 몇 bpm 떨어지나');
var R = [];
for (var j = 0; j < 60; j++) R.push({ t: j, hr: 170 });        /* 힘든 구간 */
for (var k = 0; k < 90; k++) R.push({ t: 60 + k, hr: 170 - k }); /* 회복 */
var h = F.hrRecovery(R, { peakMinBpm: 130, windowSec: 60 });
ok('산출된다', h.ok === true, JSON.stringify(h).slice(0, 160));
ok('60초에 약 60bpm 떨어짐', Math.abs(h.bestDropBpm - 60) <= 2, String(h.bestDropBpm));
ok('정점을 잡는다', h.bestPeakBpm === 170);
ok('창 길이를 남긴다', h.windowSec === 60);

console.log('\n[7] ★ 못 재는 경우를 갈라서 말한다 (값을 지어내지 않는다)');
var flat = [];
for (var m = 0; m < 200; m++) flat.push({ t: m, hr: 110 });
var hf = F.hrRecovery(flat, { peakMinBpm: 130 });
ok('힘든 적이 없으면 그렇다고', hf.ok === false && hf.reason === 'never_hard_enough',
   JSON.stringify(hf));
ok('본 최고 심박을 알려 준다', hf.maxHrSeen === 110);

/* 힘든 구간 직후에 기록이 끊긴 경우 — 아주 흔하다 */
var cut = [];
for (var n = 0; n < 80; n++) cut.push({ t: n, hr: 170 });
var hc = F.hrRecovery(cut, { peakMinBpm: 130 });
ok('직후에 끊기면 산출 안 함', hc.ok === false && hc.reason === 'no_clean_recovery',
   JSON.stringify(hc));

ok('심박이 아예 없으면 no_hr',
   F.hrRecovery([{ t: 0 }, { t: 1 }, { t: 2 }, { t: 3 }, { t: 4 },
                 { t: 5 }, { t: 6 }, { t: 7 }, { t: 8 }, { t: 9 },
                 { t: 10 }, { t: 11 }], {}).reason === 'no_hr');
ok('표본이 없으면 no_data', F.hrRecovery([], {}).reason === 'no_data');

console.log('\n[8] 회복이 여러 번이면 여러 번 잡고 평균도 낸다');
var multi = [];
for (var r = 0; r < 3; r++) {
  for (var a = 0; a < 40; a++) multi.push({ t: r * 200 + a, hr: 165 });
  for (var d = 0; d < 100; d++) multi.push({ t: r * 200 + 40 + d, hr: 165 - Math.min(d, 45) });
}
var hm = F.hrRecovery(multi, { peakMinBpm: 130 });
ok('여러 구간을 잡는다', hm.ok === true && hm.count >= 2, String(hm.count));
ok('평균도 낸다', hm.avgDropBpm > 0);
ok('창이 겹치지 않는다', hm.windows.every(function (w, ix) {
  return ix === 0 || Math.abs(w.atSec - hm.windows[ix - 1].atSec) >= 60;
}) || hm.count === 1);

console.log('\n[9] 해석 밴드 — 진단이 아니라 추세');
ok('35bpm 은 strong', F.hrrBand(35).key === 'strong');
ok('22bpm 은 good', F.hrrBand(22).key === 'good');
ok('15bpm 은 fair', F.hrrBand(15).key === 'fair');
ok('8bpm 은 slow', F.hrrBand(8).key === 'slow');
ok('null 은 null', F.hrrBand(null) === null);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
