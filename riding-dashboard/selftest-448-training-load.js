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

console.log('\n=== 결과: ' + P + ' PASS / ' + F + ' FAIL ===');
process.exit(F ? 1 : 0);
