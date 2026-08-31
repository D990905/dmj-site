/* selftest-456 — Gain/Loss
 *
 * 이 테스트가 지키는 것 (전부 실측에서 틀렸다가 고친 것):
 *   1) ladder rung 은 바람 축 진행만 센다 — 옆으로 간 거리는 0
 *   2) 풍하 기동의 부호 — VMG 는 풍하에서 음수다. 뒤집지 않으면 손실이
 *      회전당 146m 로 부풀었다
 *   3) 기동의 방향은 엔진의 회전 종류를 따른다 — 관측 TWA 평균으로 따로
 *      판정했더니 풍축 근처 회전에서 어긋나 손실이 230m 가 됐다
 *   4) 기준 VMG 는 전후 중 좋은 쪽 — 앞만 쓰면 이미 느려진 회전에서
 *      기준이 0.8kt 가 되어 손실이 무의미해진다
 *   5) 주행이라 볼 수 없는 구간(기준 <1.5kt)은 손실을 매기지 않는다
 *   6) 못 센 회전 수와 사유를 반드시 보고한다
 */
'use strict';
global.window = global;
global.RDGeo = require('./js/geo.js');
var GL = require('./js/analysis-gainloss.js');
var An = require('./js/analysis.js');

var P = 0, F = 0;
function ok(c, m, x) { if (c) { P++; console.log('  PASS  ' + m); }
  else { F++; console.log('  FAIL  ' + m + (x != null ? ' · ' + x : '')); } }

var KT = 1.94384;
/* 합성 세션 — 정북(0°)에서 바람이 불고, 보트가 정확히 북으로 간다면
   rung 진행 = 이동 거리. 동으로만 가면 rung 진행 = 0. */
function mkSession(pts) {
  return { samples: pts, hasTime: true, cfg: null };
}
function line(bearingDeg, speedMs, sec, hz) {
  hz = hz || 1;
  var pts = [], lat = 35, lng = 129;
  var r = bearingDeg * Math.PI / 180;
  for (var i = 0; i <= sec * hz; i++) {
    pts.push({ t: i / hz, lat: lat, lng: lng, speed: speedMs, heading: bearingDeg });
    var d = speedMs / hz;
    lat += (d * Math.cos(r)) / 111132;
    lng += (d * Math.sin(r)) / (111320 * Math.cos(35 * Math.PI / 180));
  }
  return pts;
}

console.log('\n[1] ladder rung — 바람 축 진행만 센다');
var north = GL.ladderRung(mkSession(line(0, 5, 60)), 0);
ok(north != null && Math.abs(north[north.length - 1] - 300) < 6,
   '정풍상으로 5m/s×60s → 약 300m', north && north[north.length - 1].toFixed(1));
var east = GL.ladderRung(mkSession(line(90, 5, 60)), 0);
ok(east != null && Math.abs(east[east.length - 1]) < 6,
   '옆으로만 가면 rung 진행 0', east && east[east.length - 1].toFixed(1));
var away = GL.ladderRung(mkSession(line(180, 5, 60)), 0);
ok(away != null && away[away.length - 1] < -280,
   '풍하로 가면 rung 이 줄어든다', away && away[away.length - 1].toFixed(1));

console.log('\n[2] 풍하 기동 부호 — 목표 방향으로 통일');
/* 풍하 레그: TWD 0, 헤딩 180 → vmg 음수. legGains 는 +로 돌려줘야 한다. */
var dwPts = line(180, 8, 60);
dwPts.forEach(function (p) { p.twa = 180; p.vmg = -8; });
var dwLegs = GL.legGains(mkSession(dwPts), 0, { minSec: 20, minKt: 5 });
ok(dwLegs.length === 1, '풍하 레그 1개 검출', dwLegs.length);
ok(dwLegs.length && dwLegs[0].gainM > 0,
   '풍하 이득은 양수로 보고된다(목표 방향 기준)',
   dwLegs.length && dwLegs[0].gainM.toFixed(0));
ok(dwLegs.length && dwLegs[0].zone === 'downwind', 'zone=downwind');

console.log('\n[3] 리칭은 레그로 세지 않는다');
var rePts = line(90, 8, 60);
rePts.forEach(function (p) { p.twa = 90; p.vmg = 0; });
ok(GL.legGains(mkSession(rePts), 0, { minSec: 20, minKt: 5 }).length === 0,
   '|TWA| 70~110 구간은 레그 아님');

console.log('\n[4] 기준 VMG — 주행이 아니면 손실을 매기지 않는다');
/* 거의 멈춘 채로 도는 "회전" — 기준이 1.5kt 미만이라 산출 거부 */
var slow = line(0, 0.3, 120);
slow.forEach(function (p) { p.twa = 45; p.vmg = 0.2; });
var slowRes = GL.maneuverLoss(mkSession(slow),
  [{ type: 'tack', side: 'P', tSec: 60, startIdx: 60, apexIdx: 62, endIdx: 64,
     headingBefore: 45, headingAfter: 315, entrySpeedMs: 0.3, exitSpeedMs: 0.3 }], 0);
ok(slowRes.length === 1 && !slowRes[0].ok, '표류 구간 회전은 ok=false');
ok(slowRes[0].reason === 'not-sailing', "사유 'not-sailing'", slowRes[0].reason);

console.log('\n[5] 회전 종류가 방향을 정한다');
/* 실제 항적은 풍하(180°)로 달리는데 기록된 TWA 는 80° — 종류(자이브)와
   관측이 어긋나는 경우. 기준 VMG 는 항적에서 나오므로 정상 산출되고,
   zoneConflict 만 참이어야 한다. */
var mixed = line(180, 8, 160);
mixed.forEach(function (p) { p.twa = 80; p.vmg = 1.4; });
var zres = GL.maneuverLoss(mkSession(mixed),
  [{ type: 'gybe', side: 'P', tSec: 80, startIdx: 80, apexIdx: 82, endIdx: 84,
     headingBefore: 170, headingAfter: 190, entrySpeedMs: 8, exitSpeedMs: 8 }], 0);
ok(zres[0].zone === 'downwind', '자이브 → downwind 로 본다', zres[0].zone);
ok(zres[0].zoneConflict === true,
   '관측 TWA 가 어긋나면 zoneConflict=true 로 표시', zres[0].zoneConflict);

console.log('\n[6] 요약이 못 센 회전을 밝힌다');
var sum = GL.summarize(slowRes.concat(zres), dwLegs);
ok(sum.notComputed && sum.notComputed['not-sailing'] >= 1,
   '미산출 사유별 개수 보고', JSON.stringify(sum.notComputed));
ok(sum.skippedAmbiguous === 1, '애매(zoneConflict) 회전 제외 수 보고', sum.skippedAmbiguous);
ok(typeof sum.countedTurns === 'number', '실제로 센 회전 수 보고', sum.countedTurns);
ok(sum.tackLossPct === null || sum.tackLossPct >= 0,
   '택 손실 %는 풍상 진행 대비로만 낸다(합산 아님)');

console.log('\n[6b] §460 백분율의 분모는 주행 전 구간이다');
/* legGains 는 25초 이상 지속 레그만 센다. 회전이 잦으면 그 조건을
   통과하는 시간이 세션의 10% 밖에 안 되는데(실측 8/31: 95회전, 지속레그
   11분 / 분석 112분), 손실은 모든 회전을 세므로 분자·분모가 다른 세션을
   재게 된다. 실제로 24% 인 값이 80% 로 나왔다. */
var longRun = line(0, 8, 400);
longRun.forEach(function (p) { p.twa = 45; p.vmg = 5.6; });
/* 20초짜리 조각으로만 이루어진 트랙 — 지속 레그 조건(25초)을 못 넘는다 */
var choppy = line(0, 8, 400);
choppy.forEach(function (p, i) {
  var phase = Math.floor(i / 20) % 2;
  p.twa = phase ? 45 : 95;              /* 20초마다 풍상↔리칭 */
  p.vmg = phase ? 5.6 : 0;
});
var chopSess = mkSession(choppy);
var chopLegs = GL.legGains(chopSess, 0, { minSec: 25, minKt: 5 });
var chopProg = GL.zoneProgress(chopSess, 0, { minKt: 5 });
ok(chopLegs.length === 0,
   '20초 조각뿐이면 지속 레그는 0개', chopLegs.length);
ok(chopProg.upwindM > 100,
   '그래도 풍상 진행은 실제로 있었다 — zoneProgress 가 그걸 잡는다',
   Math.round(chopProg.upwindM) + 'm');
var sumNoProg = GL.summarize([], chopLegs);
var sumProg = GL.summarize([], chopLegs, chopProg);
ok(sumNoProg.basis === 'sustained-legs' && sumProg.basis === 'all-planing',
   'basis 로 어느 분모를 썼는지 밝힌다',
   sumNoProg.basis + ' / ' + sumProg.basis);
ok(sumProg.upwindGainM > sumNoProg.upwindGainM,
   '전 구간 분모가 지속 레그 분모보다 크다',
   Math.round(sumProg.upwindGainM) + ' vs ' + Math.round(sumNoProg.upwindGainM));
ok(sumProg.sustainedUpwindM === sumNoProg.upwindGainM,
   '지속 레그 값도 따로 보존한다');

console.log('\n[7] 순손실(B) 은 부족분(A) 을 넘을 수 없다');
/* B = Σ(vref−v)dt, A = Σmax(0,vref−v)dt — 같은 표본이면 정의상 B ≤ A.
   다른 출처(엔진 VMG vs 위치)를 섞거나 B 를 vref×경과시간 으로 따로
   내면 이 관계가 깨진다. 실측에서 각각 10건·1건 깨졌던 자리다. */
var wob = line(0, 8, 200, 2);
wob.forEach(function (p, i) {
  var t = i / 2;
  var slow = (t > 60 && t < 80);           /* 회전 구간에서 느려짐 */
  p.speed = slow ? 2 : 8;
  p.twa = 45; p.vmg = p.speed * 0.7;
});
/* 위치를 속도에 맞춰 다시 깐다 */
(function () {
  var lat = 35, lng = 129;
  wob.forEach(function (p, i) {
    p.lat = lat; p.lng = lng;
    lat += (p.speed * 0.5) / 111132;
  });
})();
var wres = GL.maneuverLoss(mkSession(wob),
  [{ type: 'tack', side: 'P', tSec: 60, startIdx: 120, apexIdx: 130, endIdx: 160,
     headingBefore: 45, headingAfter: 315, entrySpeedMs: 8, exitSpeedMs: 8 }], 0);
ok(wres[0].ok, '합성 회전에서 손실이 산출된다', wres[0].reason);
if (wres[0].ok) {
  ok(wres[0].pathLossM <= wres[0].vmgLossM + 1e-6,
     'B ≤ A',
     'A=' + wres[0].vmgLossM.toFixed(1) + ' B=' + wres[0].pathLossM.toFixed(1));
  ok(wres[0].vmgLossM > 0, '느려진 구간이 손실로 잡힌다',
     wres[0].vmgLossM.toFixed(1));
}

console.log('\n=== 결과: ' + P + ' PASS / ' + F + ' FAIL ===');
process.exit(F ? 1 : 0);
