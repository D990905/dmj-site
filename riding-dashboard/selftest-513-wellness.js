/* §513 웰니스 원장 — HRV 편차·Hooper·휴식일·안정시심박 추세 */
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: function (i) { return Object.keys(store)[i]; }
};
var S = require('./js/storage.js');

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }
function reset() { store = {}; }
var DAY = 86400000;
function dayStr(back) {
  var d = new Date(Date.now() - back * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
}

console.log('\n[1] 저장 — 하루 한 건, 같은 날은 부분 갱신');
reset();
S.saveWellness({ date: '2026-09-01', hrvMs: 55, rhrBpm: 44 });
S.saveWellness({ date: '2026-09-01', hooper: { fatigue: 4, stress: 4, soreness: 3, sleepQuality: 4 } });
var all = S.loadWellness();
ok('한 건만 남는다', all.length === 1);
ok('앞서 넣은 값이 유지된다', all[0].hrvMs === 55 && all[0].rhrBpm === 44);
ok('나중 값이 합쳐진다', all[0].hooper && all[0].hooper.fatigue === 4);
S.saveWellness({ date: '2026-09-02', hrvMs: 60 });
ok('다른 날은 새 건', S.loadWellness().length === 2);
ok('날짜순 정렬', S.loadWellness()[0].date === '2026-09-01');
ok('날짜 없으면 거부', S.saveWellness({ hrvMs: 50 }).ok === false);
ok('Hooper 는 1~5 로 클램프',
   (S.saveWellness({ date: '2026-09-03', hooper: { fatigue: 9, stress: 0,
      soreness: 3, sleepQuality: 3 } }).record.hooper.fatigue === 5));

console.log('\n[2] ★ HRV 편차 — 근거가 얇으면 산출하지 않는다');
/* §457 에서 ACWR 이 5일치로 4.00 을 찍어 오경고를 냈다. 같은 실수 방지. */
reset();
for (var i = 12; i >= 0; i--) S.saveWellness({ date: dayStr(i), hrvMs: 55 });
var t = S.computeHRVTrend();
ok('13일이면 거부', t.ok === false && t.reason === 'need_more_days', JSON.stringify(t));
ok('필요 일수를 알려 준다', t.need === 14);

console.log('\n[3] HRV 편차 — 기준선 대비 표준화');
reset();
/* 기준선 30일 55ms, 최근 7일 70ms → 뚜렷한 양의 편차여야 한다 */
for (var i = 36; i >= 7; i--) S.saveWellness({ date: dayStr(i), hrvMs: 55 + (i % 3) - 1 });
for (var i = 6; i >= 0; i--) S.saveWellness({ date: dayStr(i), hrvMs: 70 });
var h = S.computeHRVTrend();
ok('산출된다', h.ok === true, JSON.stringify(h));
ok('양의 편차', h.deviationSD > 1, 'SD=' + h.deviationSD);
ok('최근 7일 평균이 70 근처', Math.abs(h.recent7Ms - 70) < 1, String(h.recent7Ms));
ok('기준선이 55 근처', Math.abs(h.baselineMs - 55) < 2, String(h.baselineMs));
reset();
for (var i = 36; i >= 7; i--) S.saveWellness({ date: dayStr(i), hrvMs: 55 + (i % 3) - 1 });
for (var i = 6; i >= 0; i--) S.saveWellness({ date: dayStr(i), hrvMs: 40 });
var h2 = S.computeHRVTrend();
ok('떨어지면 음의 편차', h2.ok && h2.deviationSD < -1, 'SD=' + (h2.deviationSD));

console.log('\n[4] Hooper — 4항목 → 10~50 스케일, 높을수록 좋다');
reset();
S.saveWellness({ date: dayStr(0), hooper: { fatigue: 5, stress: 5, soreness: 5, sleepQuality: 5 } });
var w = S.computeWellnessTrend();
ok('최고 = 50', w.ok && w.composite === 50, String(w.composite));
reset();
S.saveWellness({ date: dayStr(0), hooper: { fatigue: 1, stress: 1, soreness: 1, sleepQuality: 1 } });
ok('최저 = 10 (coach 의 <20 빨강 구간)', S.computeWellnessTrend().composite === 10);
reset();
S.saveWellness({ date: dayStr(0), hooper: { fatigue: 3, stress: 3, soreness: 3, sleepQuality: 3 } });
ok('보통 = 30', S.computeWellnessTrend().composite === 30);
ok('오늘 것이면 isToday', S.computeWellnessTrend().isToday === true);
reset();
S.saveWellness({ date: dayStr(5), hooper: { fatigue: 3, stress: 3, soreness: 3, sleepQuality: 3 } });
ok('오늘 것이 아니면 isToday=false', S.computeWellnessTrend().isToday === false);
ok('4항목이 다 없으면 무시',
   (function () { reset();
     S.saveWellness({ date: dayStr(0), hooper: { fatigue: 3, stress: 3 } });
     return S.computeWellnessTrend().ok === false; })());

console.log('\n[5] 휴식일 — 원장에 부하가 없는 날');
var led = [];
[1, 2, 3].forEach(function (b) { led.push({ dateEpoch: Date.now() - b * DAY, trimp: 100 }); });
ok('오늘 비었으면 0', S.daysSinceRest(led) === 0);
led.push({ dateEpoch: Date.now(), trimp: 100 });
ok('오늘·어제·그제 탔으면 4일째가 빈 날 → 4', S.daysSinceRest(led) === 4,
   String(S.daysSinceRest(led)));
ok('빈 원장은 0', S.daysSinceRest([]) === 0);

console.log('\n[6] 안정시심박 추세 — HRV 와 방향이 반대다');
reset();
for (var i = 36; i >= 7; i--) S.saveWellness({ date: dayStr(i), rhrBpm: 44 });
for (var i = 6; i >= 0; i--) S.saveWellness({ date: dayStr(i), rhrBpm: 50 });
var r = S.computeRHRTrend();
ok('산출된다', r.ok === true);
ok('올라가면 +delta (피로 신호)', r.deltaBpm > 5, String(r.deltaBpm));
reset();
for (var i = 10; i >= 0; i--) S.saveWellness({ date: dayStr(i), rhrBpm: 44 });
ok('11일이면 거부', S.computeRHRTrend().ok === false);

console.log('\n[7] 서로 간섭하지 않는다');
reset();
S.saveWellness({ date: dayStr(0), hooper: { fatigue: 3, stress: 3, soreness: 3, sleepQuality: 3 } });
ok('Hooper 만 있어도 HRV 는 조용히 거부', S.computeHRVTrend().ok === false);
ok('그때 Hooper 는 정상 산출', S.computeWellnessTrend().ok === true);

/* §514 추가 — 쓸 값 없는 빈 행 거절 */
(function () {
  reset();
  var r = S.saveWellness({ date: '2026-09-03' });
  ok('값 없는 날은 거절', r.ok === false, JSON.stringify(r));
  ok('빈 행이 남지 않는다', S.loadWellness().length === 0);
  var r2 = S.saveWellness({ date: '2026-09-03', hooper: {} });
  ok('빈 hooper 도 거절', r2.ok === false);
  var r3 = S.saveWellness({ date: '2026-09-03', hooper: { fatigue: 2 } });
  ok('하나라도 있으면 저장', r3.ok === true);
})();

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
