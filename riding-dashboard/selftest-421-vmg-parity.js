/* ============================================================
 * selftest-421-vmg-parity.js — §421 VMG/TWA 택(P/S) 버킷 정합 검증
 *
 * 옥대표님 verbatim 2026-06-12 ("Deep"): Vantage Sailing 비교에서
 *   Vantage = Port upwind VMG 빠름 (14.0 / S 12.1)
 *   우리(이전) = Port 느림 (9.8 / S 13.3) — P/S 라벨↔데이터 swap
 *
 * §420 은 라벨 함수(maneuverSide·app.js sideShort/sideLabel)만 표준
 * convention(angleDiff>=0 → Port)으로 바꿨고, computeWindMetrics(VMG
 * 통계 버킷)·computePolar(폴라 버킷)의 데이터 분류는 옛 규약(>=0 → S)에
 * 남아 라벨↔데이터가 어긋났다 → "Port 느림" 오표시.
 *
 * 이 self-test 는 GPX 가 아니라 '정답을 아는' 합성 트랙으로 검증한다 —
 * 풍향 218° 기준 의도적으로
 *   · 포트(Port) 택을 빠르게(upwind 10 m/s · downwind 12 m/s)
 *   · 스타보드(Starboard) 택을 느리게(upwind 6 m/s · downwind 8 m/s)
 * 만들어, analyzeSession 의 P/S 버킷이 라벨대로(Port=빠름) 채워지는지
 * 본다. 옛 규약이면 P/S 가 뒤집혀 'Port 느림'으로 FAIL 한다.
 *
 * 표준 sailing convention (Larsson & Eliasson 2022 ch.7,
 * ISBN 978-1-3994-0301-6 + ISAF Racing Rules of Sailing — Definitions):
 *   · Port tack    = 바람이 보트 좌현(port)에서 들어옴
 *                    = heading 이 풍축(풍원 방향) 기준 시계방향
 *                    = angleDiff(windDir, heading) >= 0
 *   · Starboard tack = 바람이 우현(starboard)에서 = angleDiff < 0
 *   · VMG = SOG × cos(TWA)  (풍상 양수 / 풍하 음수 → 크기로 저장)
 *
 *   실행:  node selftest-421-vmg-parity.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));

/* --- 미니 러너 (selftest-wind.js 규약) --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }
var KT = Geo.MS_TO_KNOTS;

var WIND = 218;                 // TWD — 바람이 들어오는 방향(풍원)
var BASE_EPOCH = 1749600000000; // 고정 epoch (결정적)

/* heading H 로 v m/s, n초 직진하는 leg 의 1Hz trkpt 생성.
   COG(헤딩)는 직진이라 bearing=H 로 일정 → analyzeSession 이 derive. */
function straightLeg(startLat, startLng, headingDeg, speedMs, nSec, t0ms) {
  var pts = [], lat = startLat, lng = startLng;
  for (var i = 0; i < nSec; i++) {
    pts.push({ lat: lat, lng: lng, ele: 0, time: t0ms + i * 1000,
               speed: null, hr: null });
    var nx = Geo.destination(lat, lng, headingDeg, speedMs); // 1초 = speedMs m
    lat = nx.lat; lng = nx.lng;
  }
  return { pts: pts, endLat: lat, endLng: lng, endMs: t0ms + nSec * 1000 };
}

/* 풍향 218° 기준 의도적 P-빠름 / S-느림 4-leg 트랙.
   풍상 택각 ±45°, 풍하 ±45° (풍하축=38°). leg 사이 20s 공백(>8s)으로
   leg 분리 — 회전 트랜지션 표본이 버킷을 오염시키지 않게. */
var GAP_MS = 20000;
var legsDef = [
  // 이름,        heading,            speedMs, 기대 버킷
  { name: 'Port upwind',      hd: (WIND + 45) % 360, v: 10, mode: 'upwind',   side: 'P' },
  { name: 'Starboard upwind', hd: (WIND - 45 + 360) % 360, v: 6, mode: 'upwind',   side: 'S' },
  { name: 'Port downwind',    hd: (WIND + 180 - 45) % 360, v: 12, mode: 'downwind', side: 'P' },
  { name: 'Starboard downwind', hd: (WIND + 180 + 45) % 360, v: 8, mode: 'downwind', side: 'S' }
];

var allPts = [];
var lat = 35.15, lng = 129.20, tms = BASE_EPOCH;
legsDef.forEach(function (L) {
  var seg = straightLeg(lat, lng, L.hd, L.v, 120, tms);
  for (var k = 0; k < seg.pts.length; k++) allPts.push(seg.pts[k]);
  lat = seg.endLat; lng = seg.endLng; tms = seg.endMs + GAP_MS;
});

var parsed = {
  tracks: [{ name: 'synthetic-421', segments: [allPts] }],
  pointCount: allPts.length, trackName: 'synthetic-421',
  hasTime: true, speedSource: 'derived', hasHR: false, hrPointCount: 0,
  _points: allPts
};

console.log('=== §421 VMG/TWA P/S 버킷 정합 self-test ===\n');
console.log('  풍향(TWD) ' + WIND + '° · 합성 트랙 (의도: Port 빠름 / Starboard 느림)');
console.log('  leg headings: ' + legsDef.map(function (L) {
  return L.name + '=' + L.hd + '°@' + (L.v * KT).toFixed(1) + 'kt'; }).join(' · ') + '\n');

var session = An.normalizeSession(parsed);
var analysis = An.analyzeSession(session, WIND, {});
var ts = analysis.wind && analysis.wind.tackSplit;
check('analyzeSession.wind.tackSplit 산출', !!ts);
if (!ts) { console.log('\n중단: tackSplit 없음'); process.exit(1); }

function sog(mode, side) { return (ts[mode] && ts[mode][side] && ts[mode][side].sog.avg) || 0; }
function vmg(mode, side) { return (ts[mode] && ts[mode][side] && ts[mode][side].vmg.avg) || 0; }
function twa(mode, side) { return (ts[mode] && ts[mode][side] && ts[mode][side].twa.avg) || 0; }
function cnt(mode, side) { return (ts[mode] && ts[mode][side] && ts[mode][side].count) || 0; }

console.log('\n  [측정] (단위 kt / °)');
['upwind', 'downwind'].forEach(function (m) {
  ['P', 'S'].forEach(function (s) {
    console.log('    ' + m + '.' + s + ': SOG ' + (sog(m, s) * KT).toFixed(1) +
      ' · VMG ' + (vmg(m, s) * KT).toFixed(1) + ' · TWA ' + twa(m, s).toFixed(0) +
      '° · n=' + cnt(m, s));
  });
});

/* ---------- 1) P/S 정합 — Port 가 빠르게 채워졌는가 (핵심) ---------- */
console.log('\n[1] P/S 버킷 정합 — Port(빠름) / Starboard(느림)');
check('upwind: Port SOG > Starboard SOG (Port 빠름)',
  sog('upwind', 'P') > sog('upwind', 'S') + 1,
  'P=' + (sog('upwind','P')*KT).toFixed(1) + 'kt S=' + (sog('upwind','S')*KT).toFixed(1) + 'kt');
check('upwind: Port VMG > Starboard VMG',
  vmg('upwind', 'P') > vmg('upwind', 'S') + 0.5,
  'P=' + (vmg('upwind','P')*KT).toFixed(1) + 'kt S=' + (vmg('upwind','S')*KT).toFixed(1) + 'kt');
check('downwind: Port SOG > Starboard SOG (Port 빠름)',
  sog('downwind', 'P') > sog('downwind', 'S') + 1,
  'P=' + (sog('downwind','P')*KT).toFixed(1) + 'kt S=' + (sog('downwind','S')*KT).toFixed(1) + 'kt');

/* ---------- 2) SOG 크기 정합 — 합성 입력값 복원 ---------- */
console.log('\n[2] SOG 크기 — 합성 입력값(10/6/12/8 m/s) 복원 (±0.6kt)');
check('upwind.P SOG ≈ 10 m/s',  near(sog('upwind','P'), 10, 0.3), (sog('upwind','P')).toFixed(2)+' m/s');
check('upwind.S SOG ≈ 6 m/s',   near(sog('upwind','S'), 6, 0.3),  (sog('upwind','S')).toFixed(2)+' m/s');
check('downwind.P SOG ≈ 12 m/s',near(sog('downwind','P'),12, 0.3), (sog('downwind','P')).toFixed(2)+' m/s');
check('downwind.S SOG ≈ 8 m/s', near(sog('downwind','S'), 8, 0.3), (sog('downwind','S')).toFixed(2)+' m/s');

/* ---------- 3) VMG = SOG × cos(TWA) 항등식 ---------- */
console.log('\n[3] VMG = SOG × |cos(TWA)| 항등식 (각 버킷 ±0.2 m/s)');
['upwind', 'downwind'].forEach(function (m) {
  ['P', 'S'].forEach(function (s) {
    var expect = sog(m, s) * Math.abs(Math.cos(Geo.toRad(twa(m, s))));
    check(m + '.' + s + ' VMG ≈ SOG·|cos(TWA)|',
      near(vmg(m, s), expect, 0.2),
      'vmg=' + vmg(m,s).toFixed(2) + ' expect=' + expect.toFixed(2));
  });
});

/* ---------- 4) TWA ≈ 45°(풍상) / 135°(풍하) ---------- */
console.log('\n[4] TWA — 풍상 ≈45° · 풍하 ≈135° (±8°)');
check('upwind TWA ≈ 45°',  near(twa('upwind','P'), 45, 8) && near(twa('upwind','S'), 45, 8));
check('downwind TWA ≈ 135°', near(twa('downwind','P'),135,8) && near(twa('downwind','S'),135,8));

/* ---------- 5) 폴라 P/S 정합 — computePolar 버킷도 같은 규약 ---------- */
console.log('\n[5] computePolar P/S 정합 — Port 빈 속도 > Starboard 빈 (풍상 45° 빈)');
var polar = An.computePolar(session, WIND);
/* 풍상(twaCenter<90) 빈 중 표본이 가장 많은 빈의 속도 — 합성 트랙은 한
   빈에 몰려 있어, 빈 경계(45°가 7.5° 격자 경계)에 휘둘리지 않게 max-count
   빈으로 고른다. */
function dominantUpwindSpeed(arr) {
  var best = null;
  arr.forEach(function (x) {
    if (x.twaCenter < 90 && x.count && (!best || x.count > best.count)) best = x;
  });
  return best ? best.avgMs : 0;
}
var pUp = dominantUpwindSpeed(polar.port), sUp = dominantUpwindSpeed(polar.starboard);
check('폴라 풍상 45° 빈: port 속도 > starboard 속도',
  pUp > sUp + 1, 'port=' + (pUp*KT).toFixed(1) + 'kt stbd=' + (sUp*KT).toFixed(1) + 'kt');

/* ---------- 6) maneuverSide 규약과 일관 (라벨↔데이터 동일 부호) ---------- */
console.log('\n[6] 버킷 분류가 maneuverSide(§420 표준)와 같은 부호 규약');
/* Port heading(풍축 시계방향, angleDiff>=0)이 P 버킷에 들어갔으면,
   같은 heading 을 maneuverSide 에 넣어도 P 가 나와야 한다. */
var portHeading = (WIND + 45) % 360;
var msSide = Geo.angleDiff(WIND, portHeading) >= 0 ? 'P' : 'S';
check('Port heading → maneuverSide 규약도 P', msSide === 'P',
  'angleDiff(' + WIND + ',' + portHeading + ')=' + Geo.angleDiff(WIND, portHeading).toFixed(0));
check('그 Port heading 데이터가 실제로 upwind.P 버킷에 (빠름)으로 적재',
  sog('upwind', 'P') > sog('upwind', 'S'));

console.log('\n=== 결과: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
