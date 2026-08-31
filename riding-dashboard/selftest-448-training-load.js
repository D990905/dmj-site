/* selftest-448 — 훈련부하 배선 + Waterspeed CSV 파서
 *
 * 이 테스트가 지키는 것:
 *   1) Waterspeed CSV 가 파싱되고 1Hz 심박이 실린다
 *   2) 안정시 심박이 없으면 라이딩 세션 부하가 null 이다 (조용히 0 이
 *      되면 CTL/ATL/TSB 가 통째로 죽는데 아무도 모른다)
 *   3) 안정시 심박이 있으면 Tier 1(Banister)로 산출된다
 *   4) 육상 운동도 같은 함수로 AU 가 나온다 (대체 처방의 전제)
 *   5) computeFitnessTrend 가 그 부하를 실제로 집어간다
 */
'use strict';
var path = require('path'), fs = require('fs');
global.window = global;
global.RDGeo = require('./js/geo.js');
global.RDWaterspeedCSV = require('./js/parsers/waterspeed-csv.js');
global.RDRaceboxCSV = require('./js/parsers/racebox-csv.js');
global.RDImu = require('./js/analysis-imu.js');
global.RDSportMET = require('./js/sport-met.js');
var WS = global.RDWaterspeedCSV;
var An = require('./js/analysis.js');
var St = require('./js/storage.js');

var P = 0, F = 0;
function ok(c, m, x) { if (c) { P++; console.log('  PASS  ' + m); }
  else { F++; console.log('  FAIL  ' + m + (x ? ' · ' + x : '')); } }

/* ---------- 합성 Waterspeed CSV ---------- */
var rows = ['Timestamp (from 1970),Date,Time,Lat,Long,Speed (m/s),Heading,HR,Distance (m),Calories (SUM)'];
var T0 = 1788062450;
for (var i = 0; i < 1200; i++) {
  rows.push([T0 + i, '8/30/26', '1:00:51 PM',
    (35.16 + i * 2e-5).toFixed(9), (129.21 + i * 1e-5).toFixed(9),
    '8.5', '90.0', String(150 + (i % 7)), '0.0', (i * 0.4).toFixed(2)].join(','));
}
var csv = rows.join('\n');

console.log('\n[1] Waterspeed CSV 파서');
ok(WS.looksLike(csv), 'looksLike 인식');
ok(!WS.looksLike('Record,Time,Latitude,Longitude,Altitude,Speed,GForceX'),
   'RaceBox CSV 를 오인하지 않는다');
var parsed = WS.parse(csv);
ok(parsed.pointCount === 1200, '포인트 1200개', parsed.pointCount);
ok(parsed.hasHR === true && parsed.hrPointCount === 1200, '심박 전량 인식');
ok(parsed.speedSource === 'device', '속도는 기기값(m/s, 변환 없음)');
var p0 = parsed.tracks[0].segments[0][0];
ok(Math.abs(p0.speed - 8.5) < 1e-6, '속도를 km/h 로 오해해 ÷3.6 하지 않는다', p0.speed);

console.log('\n[2] HR 0 은 결측으로 본다');
var z = WS.parse(rows.slice(0, 1).concat(rows.slice(1, 51).map(function (r) {
  var f = r.split(','); f[7] = '0.0'; return f.join(',');
})).join('\n'));
ok(z.hrPointCount === 0, 'HR 0 은 세지 않는다', z.hrPointCount);
ok(z.hasHR === false, 'hasHR=false');

console.log('\n[3] 훈련부하 — 안정시 심박 유무');
var sess = An.normalizeSession(parsed);
ok(sess.hasHR === true, '세션에 심박이 실렸다');
var noRest = An.computeWorkload(sess, { maxHr: 185, sex: 'male', weightKg: 75 });
ok(noRest.AU === null, '안정시 심박 없으면 AU = null (조용히 0 이 되지 않는다)', noRest.AU);
var withRest = An.computeWorkload(sess, { maxHr: 185, restHr: 42, sex: 'male', weightKg: 75 });
ok(withRest.AU > 0, '안정시 심박 있으면 AU 산출', withRest.AU);
ok(withRest.method === 'banister' && withRest.tier === 1, 'Tier 1 (Banister) 로 분기');

console.log('\n[4] 육상 운동도 같은 함수로 (대체 처방의 전제)');
var run = An.computeWorkload({ sportKey: 'run_easy', durationMin: 50 },
                             { restHr: 42, sex: 'male', weightKg: 75 });
ok(run.AU > 0 && run.method === 'met', '조깅 50분 → MET tier AU', run.AU);
var gym = An.computeWorkload({ rpe: 7, durationMin: 45 }, { restHr: 42 });
ok(gym.AU > 0 && gym.method === 'srpe', '웨이트 RPE7 45분 → sRPE tier AU', gym.AU);

console.log('\n[5] 장기 추세가 그 부하를 집어간다');
var DAY = 86400000, now = Date.UTC(2026, 7, 31);
var hist = [];
for (var d = 27; d >= 0; d--) {
  hist.push({ dateEpoch: now - d * DAY, trimp: (d % 2 === 0) ? 120 : 0 });
}
var tr = St.computeFitnessTrend(hist, { endDate: now });
ok(tr.days.length >= 28, '일별 시계열 생성', tr.days.length);
ok(tr.current && tr.current.CTL > 0, 'CTL 이 0 이 아니다', tr.current && tr.current.CTL);
var zeroTr = St.computeFitnessTrend(hist.map(function (h) {
  return { dateEpoch: h.dateEpoch, trimp: null };
}), { endDate: now });
ok(zeroTr.current.CTL === 0,
   '부하가 전부 null 이면 CTL = 0 — 지금까지의 상태를 재현', zeroTr.current.CTL);

console.log('\n[6] §457 육상 운동 원장');
/* localStorage 스텁 — Node 에는 없다 */
global.localStorage = {
  _d: {}, getItem: function (k) { return this._d[k] || null; },
  setItem: function (k, v) { this._d[k] = v; },
  removeItem: function (k) { delete this._d[k]; },
  key: function (i) { return Object.keys(this._d)[i]; },
  get length() { return Object.keys(this._d).length; }
};
var DAY = 86400000, now = Date.now();
ok(St.saveWorkout({ sportKey: 'run_easy', durationMin: 50, AU: 60,
                    method: 'met', dateEpoch: now - DAY }).ok,
   '육상 운동 저장');
ok(!St.saveWorkout({ sportKey: 'run_easy' }).ok, '시간 없는 기록은 거부');
ok(St.listWorkouts().length === 1, '목록 1건', St.listWorkouts().length);

var led = St.loadLedger();
ok(led.length === 1 && led[0].kind === 'land',
   '원장에 육상 운동이 들어간다', JSON.stringify(led[0] && led[0].kind));
ok(led[0].trimp === 60, '육상 AU 가 부하로 실린다', led[0] && led[0].trimp);

/* 만성 부하가 실제로 쌓였을 때만 비율이 뜻이 있다 */
var a1 = St.computeACWR(led);
ok(a1.ratio != null, '비율 산출 자체는 된다', a1.ratio);
ok(a1.ratio > 2,
   '기록이 며칠뿐이면 비율이 크게 튄다 — 그래서 화면은 21일 미만이면 감춘다',
   a1.ratio && a1.ratio.toFixed(2));

/* 35일에 걸쳐 고르게 쌓으면 1 근처로 수렴 */
for (var d = 35; d >= 2; d--) {
  St.saveWorkout({ sportKey: 'run_easy', durationMin: 45, AU: 50,
                   method: 'met', dateEpoch: now - d * DAY });
}
var a2 = St.computeACWR(St.loadLedger());
ok(a2.ratio > 0.7 && a2.ratio < 1.4,
   '고르게 쌓이면 비율이 1 근처', a2.ratio && a2.ratio.toFixed(2));

ok(St.deleteWorkout(St.listWorkouts()[0].id).ok, '삭제');

console.log('\n[7] §463 라이딩 부하 자동 기록');
/* "세션 저장" 을 눌러야만 원장에 들어가면 훈련부하 추세가 빈다.
   파일을 열기만 해도 남기되, 같은 라이딩을 두 번 세지 않아야 한다. */
var SIG = '5926_47250_1788000000000';
ok(St.recordRideLoad({ sig: SIG, dateEpoch: now - 2 * DAY,
                       name: 'Ride A', AU: 180, method: 'banister' }).ok,
   '자동 기록 저장');
ok(St.listRideLoads().length === 1, '1건', St.listRideLoads().length);
var again = St.recordRideLoad({ sig: SIG, dateEpoch: now - 2 * DAY,
                                name: 'Ride A', AU: 126, method: 'banister' });
ok(again.ok && again.replaced === true,
   '같은 시그니처는 덮어쓴다 — 최대심박을 고치면 부하가 다시 계산된다');
ok(St.listRideLoads().length === 1, '중복 생기지 않음', St.listRideLoads().length);
ok(St.listRideLoads()[0].AU === 126, '최신 값이 남는다', St.listRideLoads()[0].AU);

var led2 = St.loadLedger();
var autoRows = led2.filter(function (x) { return x.kind === 'ride' && x.saved === false; });
ok(autoRows.length === 1, '원장에 자동 기록이 들어간다', autoRows.length);
ok(autoRows[0].trimp === 126, '부하 값이 실린다', autoRows[0].trimp);

ok(!St.recordRideLoad({ sig: SIG }).ok, 'AU 없으면 거부');
ok(St.deleteRideLoad(SIG).ok && St.listRideLoads().length === 0, '삭제');

console.log('\n=== 결과: ' + P + ' PASS / ' + F + ' FAIL ===');
process.exit(F ? 1 : 0);
