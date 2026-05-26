/* ============================================================
 * selftest-replay.js — 라이딩 리플레이 뷰어 self-test (재설계판)
 *
 * 리플레이 엔진의 순수 로직을 검증한다.
 *  · 시간 보간 · 지표 검출(HR 포함) · 미니그래프 시계열 추출.
 *  · 영상↔데이터 오프셋 변환 왕복 일관성.
 *  · MP4 녹화시각 메타데이터(moov▸mvhd) 파싱 · 파일명 시각 파싱 ·
 *    겹침 최대 오프셋 자동 선택(pickVideoOffset).
 *  · 송정(부산) 실측 GPX(HR 포함) 로 동기 정합성.
 *  · 합성 .vkx(자세 포함)로 Heel·Pitch 경로 + 편집 후 보존.
 * 의존성 0 — Node 내장 모듈만 사용.
 *
 *   실행:  node selftest-replay.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));
var Vkx = require(path.join(DIR, 'js', 'vkx-parser.js'));
var Replay = require(path.join(DIR, 'js', 'replay.js'));
var T = Replay._test;

var MP4_EPOCH_1904 = 2082844800;

/* --- 경량 GPX 파서 (trkpt lat/lon/time/ele/speed/hr) ---
   HR 은 네임스페이스 접두사와 무관하게 <…:hr> 를 잡는다. */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var eM = inner.match(/<ele>([^<]+)<\/ele>/);
    var sM = inner.match(/<speed>([^<]+)<\/speed>/);
    var hM = inner.match(/<(?:\w+:)?hr>\s*([\d.]+)\s*<\/(?:\w+:)?hr>/);
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]),
      ele: eM ? parseFloat(eM[1]) : null,
      time: tM ? Date.parse(tM[1]) : null,
      speed: sM ? parseFloat(sM[1]) : null,
      hr: hM ? Math.round(parseFloat(hM[1])) : null
    });
  }
  var withTime = pts.filter(function (p) { return p.time != null; }).length;
  var withSpeed = pts.filter(function (p) { return p.speed != null; }).length;
  var withHR = pts.filter(function (p) { return p.hr != null; }).length;
  return {
    tracks: [{ name: 'selftest', segments: [pts] }],
    pointCount: pts.length, trackName: 'selftest',
    hasTime: withTime >= pts.length * 0.5,
    speedSource: withSpeed >= pts.length * 0.5 ? 'device' : 'derived',
    hasHR: withHR >= pts.length * 0.5, hrPointCount: withHR
  };
}
function loadGpxSession(file) {
  var xml = fs.readFileSync(path.join(DIR, 'sample', file), 'utf8');
  return An.normalizeSession(parseGPX(xml));
}

/* --- 합성 .vkx 생성 (자세 데이터 포함) --- */
function buildSyntheticVkx(nPts) {
  var rows = [];
  var header = Buffer.alloc(8);
  header[0] = 0xFF; header[1] = 0x05;
  rows.push(header);
  var baseEpoch = Date.UTC(2026, 4, 20, 1, 0, 0);
  for (var i = 0; i < nPts; i++) {
    var row = Buffer.alloc(45);
    row[0] = 0x02;
    var time = baseEpoch + i * 1000;
    row.writeUInt32LE(time % 4294967296, 1);
    row.writeUInt32LE(Math.floor(time / 4294967296), 5);
    row.writeInt32LE(Math.round((35.18 + i * 0.00018) * 1e7), 9);
    row.writeInt32LE(Math.round((129.205 + i * 0.00020) * 1e7), 13);
    row.writeFloatLE(6 + 3 * Math.sin(i / 3), 17);
    row.writeFloatLE(0, 21);
    row.writeFloatLE(0, 25);
    var th = (10 + 14 * Math.sin(i / 4)) * Math.PI / 180;
    row.writeFloatLE(Math.cos(th / 2), 29);
    row.writeFloatLE(Math.sin(th / 2), 33);
    row.writeFloatLE(0, 37);
    row.writeFloatLE(0, 41);
    rows.push(row);
  }
  return Buffer.concat(rows);
}

/* --- 합성 MP4 생성 (ftyp + moov▸mvhd) --- */
function mp4Box(type, payload) {
  var head = Buffer.alloc(8);
  head.writeUInt32BE(8 + payload.length, 0);
  head.write(type, 4, 'ascii');
  return Buffer.concat([head, payload]);
}
/* version 0 mvhd — creation/modification 32비트 */
function buildMp4(creationSec, durationUnits, timescale) {
  var mvhd = Buffer.alloc(100);
  mvhd[0] = 0;                                  // version 0
  mvhd.writeUInt32BE(creationSec >>> 0, 4);     // creation_time
  mvhd.writeUInt32BE(creationSec >>> 0, 8);     // modification_time
  mvhd.writeUInt32BE(timescale >>> 0, 12);      // timescale
  mvhd.writeUInt32BE(durationUnits >>> 0, 16);  // duration
  var moov = mp4Box('moov', mp4Box('mvhd', mvhd));
  var ftyp = mp4Box('ftyp', Buffer.from('isomiso2avc1mp41', 'ascii'));
  return new Uint8Array(Buffer.concat([ftyp, moov]));
}
/* version 1 mvhd — creation/modification 64비트 */
function buildMp4V1(creationSec, durationUnits, timescale) {
  var mvhd = Buffer.alloc(120);
  mvhd[0] = 1;                                  // version 1
  mvhd.writeUInt32BE(0, 4);                     // creation hi
  mvhd.writeUInt32BE(creationSec >>> 0, 8);     // creation lo
  mvhd.writeUInt32BE(0, 12);                    // mod hi
  mvhd.writeUInt32BE(creationSec >>> 0, 16);    // mod lo
  mvhd.writeUInt32BE(timescale >>> 0, 20);      // timescale
  mvhd.writeUInt32BE(0, 24);                    // duration hi
  mvhd.writeUInt32BE(durationUnits >>> 0, 28);  // duration lo
  var moov = mp4Box('moov', mp4Box('mvhd', mvhd));
  var ftyp = mp4Box('ftyp', Buffer.from('isomiso2avc1mp41', 'ascii'));
  return new Uint8Array(Buffer.concat([ftyp, moov]));
}

/* --- 미니 테스트 러너 --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('=== 라이딩 리플레이 뷰어 self-test (재설계판) ===\n');

/* ---------- 1) 순수 함수 단위 검증 ---------- */
console.log('[1] 순수 함수 — clamp · 이진탐색 · 각도/숫자 보간 · 시계 포맷');
check('clamp 범위 클램프', T.clamp(15, 0, 10) === 10 && T.clamp(-3, 0, 10) === 0 &&
  T.clamp(5, 0, 10) === 5);
var tiny = [{ t: 0 }, { t: 1 }, { t: 2 }, { t: 5 }, { t: 9 }];
check('sampleIndexAtTime 정확한 시각', T.sampleIndexAtTime(tiny, 2) === 2);
check('sampleIndexAtTime 사이 시각은 이하 인덱스', T.sampleIndexAtTime(tiny, 3.4) === 2);
check('sampleIndexAtTime 범위 밖 하단', T.sampleIndexAtTime(tiny, -10) === 0);
check('sampleIndexAtTime 범위 밖 상단', T.sampleIndexAtTime(tiny, 999) === 4);
check('lerpAngle 0↔90 중간 = 45', near(T.lerpAngle(0, 90, 0.5), 45, 1e-6));
check('lerpAngle 350↔10 최단경로 중간 = 0',
  near(((T.lerpAngle(350, 10, 0.5)) % 360 + 360) % 360, 0, 1e-6) ||
  near(T.lerpAngle(350, 10, 0.5), 360, 1e-6));
check('lerpNum 한쪽 null 이면 다른 값', T.lerpNum(null, 8, 0.5) === 8 &&
  T.lerpNum(4, null, 0.5) === 4 && T.lerpNum(null, null, 0.5) === null);
check('lerpNum 중간 보간', T.lerpNum(10, 20, 0.5) === 15);
check('fmtClock 0:05', T.fmtClock(5) === '0:05');
check('fmtClock 12:34', T.fmtClock(754) === '12:34');
check('fmtClock 1:02:03', T.fmtClock(3723) === '1:02:03');

/* ---------- 2) sampleState — HR 포함 6종 보존 ---------- */
console.log('\n[2] sampleState — 심박(HR) 포함 6종 지표 보존');
var ss = T.sampleState({ t: 3, lat: 35, lng: 129, speed: 7, heading: 90,
  twa: 45, vmg: 5, heel: 12, pitch: 3, hr: 150 });
check('sampleState 가 hr 을 보존', ss.hr === 150);
check('sampleState 가 6종 지표를 모두 담는다',
  ss.speed === 7 && ss.vmg === 5 && ss.twa === 45 && ss.heel === 12 &&
  ss.pitch === 3 && ss.hr === 150);
var ssN = T.sampleState({ t: 1, lat: 0, lng: 0 });
check('없는 지표는 null (hr 미기록)', ssN.hr === null && ssN.heel === null);

/* ---------- 3) 영상 ↔ 데이터 오프셋 변환 ---------- */
console.log('\n[3] 영상 ↔ 데이터 오프셋 — 변환 왕복 일관성');
check('videoTimeForElapsed(120, +12) = 132', T.videoTimeForElapsed(120, 12) === 132);
check('elapsedForVideoTime(132, +12) = 120', T.elapsedForVideoTime(132, 12) === 120);
var rt = T.elapsedForVideoTime(T.videoTimeForElapsed(73.5, -8.3), -8.3);
check('오프셋 변환 왕복 일관(영상이 늦게 시작, -8.3초)', near(rt, 73.5, 1e-9));
check('오프셋 0 — 동시 시작', T.videoTimeForElapsed(50, 0) === 50);

/* ---------- 4) buildSeries · computeRange ---------- */
console.log('\n[4] buildSeries · computeRange — 전량 추출 · 축 범위');
var ser = T.buildSeries([{ t: 0, x: 2 }, { t: 1, x: 4 }, { t: 2 }, { t: 3, x: 8 }], 'x');
check('시계열 길이가 샘플 수와 같다(다운샘플 없음)', ser.t.length === 4);
check('결측 샘플은 NaN 으로 보존', isNaN(ser.v[2]));
check('유한값만으로 min/max 산출', ser.min === 2 && ser.max === 8);
var rSog = T.computeRange({ key: 'sog', unit: 'spd' }, { min: 0, max: 10 });
check('computeRange SOG → [0, max*1.08]', rSog[0] === 0 && near(rSog[1], 10.8, 1e-9));
var rHeel = T.computeRange({ key: 'heel', signed: true }, { min: -5, max: 20 });
check('computeRange 부호지표 → 0 대칭', near(rHeel[0], -21.6, 1e-9) && near(rHeel[1], 21.6, 1e-9));
var rTwa = T.computeRange({ key: 'twa', fixed: [0, 180] }, { min: 30, max: 120 });
check('computeRange TWA → 고정 [0,180]', rTwa[0] === 0 && rTwa[1] === 180);
var rHr = T.computeRange({ key: 'hr', unit: 'bpm' }, { min: 120, max: 170 });
check('computeRange HR → 실측 ±여유 안에 데이터 포함',
  rHr[0] <= 120 && rHr[1] >= 170 && rHr[0] >= 0, JSON.stringify(rHr));

/* ---------- 5) MP4 메타 파싱 — 녹화 시각 ---------- */
console.log('\n[5] parseMp4Meta — moov▸mvhd 녹화시각 · 길이');
var knownEpochSec = Math.floor(Date.UTC(2026, 4, 19, 6, 15, 47) / 1000);
var mp4 = buildMp4(knownEpochSec + MP4_EPOCH_1904, 14000, 1000);
var meta = T.parseMp4Meta(mp4);
check('합성 MP4 파싱 성공', !!meta);
check('creation_time → epoch(ms) 정확 변환',
  meta && meta.creationMs === knownEpochSec * 1000,
  meta && (meta.creationMs + ' vs ' + knownEpochSec * 1000));
check('duration/timescale → 길이(초) 14초', meta && near(meta.durationSec, 14, 1e-6));
var metaV1 = T.parseMp4Meta(buildMp4V1(knownEpochSec + MP4_EPOCH_1904, 30000, 1000));
check('version 1 mvhd(64비트) 도 파싱', metaV1 && metaV1.creationMs === knownEpochSec * 1000);
var metaZero = T.parseMp4Meta(buildMp4(0, 14000, 1000));
check('creation_time 0(미설정) → creationMs null', metaZero && metaZero.creationMs === null);
check('MP4 가 아닌 버퍼 → null', T.parseMp4Meta(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15, 16])) === null);
/* 실제 샘플 mp4 — creation_time 이 0 이므로 자동정렬 불가(폴백 경로 확인) */
var sampleMp4 = fs.readFileSync(path.join(DIR, 'sample', 'replay-sync-test.mp4'));
var sampleMeta = T.parseMp4Meta(sampleMp4);
check('샘플 mp4 파싱은 되나 녹화시각 없음(creationMs null)',
  sampleMeta !== null && sampleMeta.creationMs === null,
  sampleMeta && JSON.stringify({ c: sampleMeta.creationMs, d: sampleMeta.durationSec }));

/* ---------- 6) 파일명 시각 파싱 ---------- */
console.log('\n[6] parseFilenameDate — 파일명에서 촬영 일시');
function fnLocal(name) { return T.parseFilenameDate(name); }
var fnExpect = new Date(2026, 4, 19, 15, 30, 45).getTime();
check('VID_20260519_153045.mp4 파싱', fnLocal('VID_20260519_153045.mp4') === fnExpect);
check('Insta360 형식 VID_20260519_153045_00_001.mp4 파싱',
  fnLocal('VID_20260519_153045_00_001.mp4') === fnExpect);
check('2026-05-19 15.30.45.mov 파싱', fnLocal('2026-05-19 15.30.45.mov') === fnExpect);
check('날짜 없는 파일명 → null', fnLocal('replay-sync-test.mp4') === null);
check('비현실 월(13월) → null', fnLocal('VID_20261319_153045.mp4') === null);

/* ---------- 7) pickVideoOffset — 겹침 최대 정렬 선택 ---------- */
console.log('\n[7] pickVideoOffset — 데이터와 가장 겹치는 정렬 자동 선택');
var dStart = Date.UTC(2026, 4, 19, 6, 15, 47);
var dDurMs = 2400 * 1000;            // 데이터 40분
var vDurMs = 600 * 1000;             // 영상 10분
/* 영상이 데이터보다 12초 먼저 시작 → 올바른 후보 */
var good = { epoch: dStart - 12000, source: '메타데이터' };
/* 9시간 어긋난 잘못된 후보(타임존 오해) */
var bad = { epoch: dStart - 12000 - 9 * 3600 * 1000, source: '타임존 오해' };
var picked = T.pickVideoOffset([bad, good], dStart, dDurMs, vDurMs);
check('겹치는 후보를 고른다', picked && picked.source === '메타데이터');
check('offsetSec = +12 (영상이 12초 먼저 시작)',
  picked && near(picked.offsetSec, 12, 1e-6), picked && picked.offsetSec);
check('겹침이 0 보다 크다', picked && picked.overlapMs > 0);
var noneOverlap = T.pickVideoOffset(
  [{ epoch: dStart + 99 * 3600 * 1000, source: 'x' }], dStart, dDurMs, vDurMs);
check('전혀 안 겹치면 overlapMs = 0', noneOverlap && noneOverlap.overlapMs === 0);

/* ---------- 8) niceTicks — 시간 눈금 ---------- */
console.log('\n[8] niceTicks — 트랙 시간 눈금');
var ticks = T.niceTicks(0, 600, 6);
check('눈금이 범위 안에 든다', ticks.every(function (t) { return t >= 0 && t <= 600; }));
check('눈금이 오름차순', ticks.every(function (t, i) { return i === 0 || t > ticks[i - 1]; }));
check('눈금이 1개 이상', ticks.length >= 1, 'n=' + ticks.length);

/* ---------- 9) 송정 GPX(HR 포함) — 동기 정합성 ---------- */
console.log('\n[9] 송정(부산) 실측 GPX(HR 포함) — 리플레이 동기 정합성');
var sj = loadGpxSession('sample-songjeong-busan.gpx');
An.analyzeSession(sj, 200, {});                // 풍향 확정 → twa·vmg 채워짐
var S = sj.samples;
console.log('      샘플 ' + S.length.toLocaleString() + '개 · ' +
  '구간 t=' + S[0].t.toFixed(0) + '~' + S[S.length - 1].t.toFixed(0) + '초');
check('샘플이 충분히 많다(전량 사용)', S.length > 500, 'n=' + S.length);
check('세션이 절대 시각(startEpoch)을 가진다 — 자동정렬 기준',
  sj.startEpoch != null && isFinite(sj.startEpoch));

var midIdx = S.length >> 1;
var atSample = T.interpAtTime(S, S[midIdx].t, 4);
check('정확한 샘플 시각 → 그 샘플 좌표 반환',
  atSample && near(atSample.lat, S[midIdx].lat, 1e-9) &&
  near(atSample.lng, S[midIdx].lng, 1e-9));
check('범위 시작 이전은 첫 샘플로 클램프',
  near(T.interpAtTime(S, S[0].t - 999, 4).lat, S[0].lat, 1e-9));
check('범위 끝 이후는 마지막 샘플로 클램프',
  near(T.interpAtTime(S, S[S.length - 1].t + 999, 4).lat, S[S.length - 1].lat, 1e-9));

var t0 = S[0].t, t1 = S[S.length - 1].t, holes = 0;
for (var k = 0; k <= 200; k++) {
  var st = T.interpAtTime(S, t0 + (t1 - t0) * k / 200, 4);
  if (!st || !isFinite(st.lat) || !isFinite(st.lng)) holes++;
}
check('전 구간 200개 시점 모두 유효 좌표 산출', holes === 0, '결측=' + holes);

var avail = T.detectMetrics(S);
check('SOG 미니그래프 데이터 검출', avail.sog === true);
check('풍향 확정 → VMG 검출', avail.vmg === true);
check('풍향 확정 → TWA 검출', avail.twa === true);
check('Waterspeed GPX → HR 미니그래프 데이터 검출', avail.hr === true);
check('GPX 세션 → Heel·Pitch 데이터 없음', avail.heel === false && avail.pitch === false);

/* HR 보간 — 재생 중 심박이 끊기지 않고 산출되는지 */
var hrHoles = 0, hrSeen = 0;
for (var h = 0; h <= 300; h++) {
  var hst = T.interpAtTime(S, t0 + (t1 - t0) * h / 300, 4);
  if (hst && hst.hr != null && isFinite(hst.hr)) hrSeen++;
  else hrHoles++;
}
check('재생 중 HR 값이 대부분 산출된다', hrSeen > 250, 'HR산출 ' + hrSeen + '/301');

/* ---------- 10) 합성 .vkx — Heel·Pitch 경로 + 편집 후 보존 ---------- */
console.log('\n[10] 합성 .vkx(자세 포함) — Heel·Pitch · 편집 보존');
var vkxParsed = Vkx.parseVKX(buildSyntheticVkx(40));
check('합성 .vkx 파싱 성공', vkxParsed && vkxParsed.pointCount === 40);
check('.vkx 자세 데이터 인식(hasAttitude)', vkxParsed.hasAttitude === true);
var vkxSession = An.normalizeSession(vkxParsed);
An.analyzeSession(vkxSession, 210, {});
var vAvail = T.detectMetrics(vkxSession.samples);
check('.vkx → Heel·Pitch 검출', vAvail.heel === true && vAvail.pitch === true);
check('.vkx → HR 없음(자세계측기는 심박 미기록)', vAvail.hr === false);
var trimmed = An.applyEdits(vkxSession, { trimStart: 6 });
check('편집(앞 6초 트림) 후에도 Heel·Pitch 보존',
  trimmed.samples.some(function (s) { return s.heel != null; }) &&
  trimmed.samples.some(function (s) { return s.pitch != null; }));
check('편집 후 샘플 수가 줄었다',
  trimmed.samples.length < vkxSession.samples.length);

/* ---------- 11) buildMetricSlots — HR 슬롯 포함 ---------- */
console.log('\n[11] buildMetricSlots — 풍향·세션 종류별 슬롯(HR 포함)');
function slotMap(slots) {
  var m = {};
  slots.forEach(function (s) { m[s.def.key] = s.state; });
  return m;
}
var slGpxWind = T.buildMetricSlots(T.detectMetrics(sj.samples), 200);
var mGpxWind = slotMap(slGpxWind);
check('GPX+풍향 — SOG·VMG·TWA·HR 4종 (Heel·Pitch 없음)',
  slGpxWind.length === 4 && mGpxWind.sog === 'data' && mGpxWind.vmg === 'data' &&
  mGpxWind.twa === 'data' && mGpxWind.hr === 'data' &&
  mGpxWind.heel === undefined && mGpxWind.pitch === undefined,
  JSON.stringify(mGpxWind));
var sjNoWind = An.normalizeSession(parseGPX(
  fs.readFileSync(path.join(DIR, 'sample', 'sample-songjeong-busan.gpx'), 'utf8')));
An.analyzeSession(sjNoWind, null, {});
var mGpxNo = slotMap(T.buildMetricSlots(T.detectMetrics(sjNoWind.samples), null));
check('GPX+풍향없음 — VMG·TWA 는 needwind, HR 은 data',
  mGpxNo.sog === 'data' && mGpxNo.vmg === 'needwind' && mGpxNo.twa === 'needwind' &&
  mGpxNo.hr === 'data', JSON.stringify(mGpxNo));
var mVkxWind = slotMap(T.buildMetricSlots(T.detectMetrics(vkxSession.samples), 210));
check('.vkx+풍향 — SOG·VMG·TWA·Heel·Pitch 5종, HR 없음',
  mVkxWind.sog === 'data' && mVkxWind.vmg === 'data' && mVkxWind.twa === 'data' &&
  mVkxWind.heel === 'data' && mVkxWind.pitch === 'data' && mVkxWind.hr === undefined,
  JSON.stringify(mVkxWind));

/* ---------- 12) METRICS 정의 — HR 포함 6종 ---------- */
console.log('\n[12] METRICS — 6종 지표 정의');
var keys = T.METRICS.map(function (d) { return d.key; });
check('METRICS 가 SOG·VMG·TWA·Heel·Pitch·HR 6종',
  keys.join(',') === 'sog,vmg,twa,heel,pitch,hr', keys.join(','));
var hrDef = T.METRICS.filter(function (d) { return d.key === 'hr'; })[0];
check('HR 정의 — 단위 bpm', hrDef && hrDef.unit === 'bpm');

/* ---------- 13) 회귀 — analyzeSession 무손상 ---------- */
console.log('\n[13] 회귀 — 풍향 유무와 무관하게 analyzeSession 통과');
var okA = true, okB = true;
try { An.analyzeSession(loadGpxSession('sample-ride-gangneung.gpx'), null, {}); }
catch (e) { okA = false; }
try { An.analyzeSession(loadGpxSession('sample-ride-gangneung.gpx'), 270, {}); }
catch (e) { okB = false; }
check('강릉 GPX — 풍향 미설정 analyzeSession 통과', okA);
check('강릉 GPX — 풍향 설정 analyzeSession 통과', okB);

/* ---------- 14) parseIso8601 — 타임존 포함 촬영 시각 파싱 (§B3) ---------- */
console.log('\n[14] parseIso8601 — com.apple.quicktime.creationdate 해석');
var isoColon = T.parseIso8601('2026-05-19T15:30:45+09:00');
var isoNoColon = T.parseIso8601('2026-05-19T15:30:45+0900');
var isoZ = T.parseIso8601('2026-05-19T06:30:45Z');
var expectUtc = Date.UTC(2026, 4, 19, 6, 30, 45);
check('+09:00 오프셋 파싱 정확', isoColon === expectUtc,
  isoColon + ' vs ' + expectUtc);
check('+0900(콜론 없는 오프셋)도 동일하게 파싱', isoNoColon === expectUtc);
check('Z(UTC) 표기 파싱 — 같은 순간', isoZ === expectUtc);
check('타임존 없는 시각은 로컬 시각으로 해석',
  T.parseIso8601('2026-05-19T15:30:45') ===
    new Date(2026, 4, 19, 15, 30, 45).getTime());
check('소수 초 포함 파싱', T.parseIso8601('2026-05-19T06:30:45.500Z') ===
  expectUtc + 500);
check('형식 안 맞으면 null', T.parseIso8601('녹화 시각 없음') === null &&
  T.parseIso8601('') === null && T.parseIso8601(null) === null);

/* ---------- 15) extractCreationDate · parseMp4Meta — 클립 녹화 시각 ---------- */
console.log('\n[15] extractCreationDate — moov 안 QuickTime 촬영 시각');
/* moov 안에 ISO8601 날짜시각 문자열을 담은 합성 MP4 — 바이트 스캔 검증 */
function buildMp4WithDate(isoStr) {
  var mvhd = Buffer.alloc(100);
  mvhd[0] = 0;
  mvhd.writeUInt32BE(0, 4);                     // creation 0 (mvhd 미설정)
  mvhd.writeUInt32BE(0, 8);
  mvhd.writeUInt32BE(1000, 12);                 // timescale
  mvhd.writeUInt32BE(30000, 16);                // duration → 30초
  var dataBox = mp4Box('data', Buffer.concat(
    [Buffer.alloc(8), Buffer.from(isoStr, 'utf8')]));
  var udta = mp4Box('udta', dataBox);
  var moov = mp4Box('moov', Buffer.concat([mp4Box('mvhd', mvhd), udta]));
  var ftyp = mp4Box('ftyp', Buffer.from('isomiso2avc1mp41', 'ascii'));
  return new Uint8Array(Buffer.concat([ftyp, moov]));
}
var iso = '2026-05-19T15:30:45+09:00';
var cdMp4 = buildMp4WithDate(iso);
var cd = T.extractCreationDate(cdMp4, 0, cdMp4.length);
check('moov 바이트 스캔으로 ISO 날짜시각 추출', cd && cd.ms === T.parseIso8601(iso),
  cd && JSON.stringify(cd));
var cdMeta = T.parseMp4Meta(cdMp4);
check('parseMp4Meta — creationDateMs 채워짐 (타임존 포함)',
  cdMeta && cdMeta.creationDateMs === T.parseIso8601(iso));
check('parseMp4Meta — mvhd 미설정이면 creationMs 는 null',
  cdMeta && cdMeta.creationMs === null);
var plainMeta = T.parseMp4Meta(buildMp4(knownEpochSec + MP4_EPOCH_1904, 14000, 1000));
check('creationdate 없는 MP4 → creationDateMs null',
  plainMeta && plainMeta.creationDateMs === null);

/* ---------- 16) miniYTicks · fmtRealClock — 미니그래프 축·실제시각 ---------- */
console.log('\n[16] miniYTicks · fmtRealClock — §B2 축 눈금 · §B6 실제 시각');
var yt = T.miniYTicks(0, 10);
check('miniYTicks 범위 안 눈금', yt.every(function (v) { return v >= 0 && v <= 10; }));
check('miniYTicks 오름차순·2개 이상',
  yt.length >= 2 && yt.every(function (v, i) { return i === 0 || v > yt[i - 1]; }),
  'n=' + yt.length);
check('fmtRealClock 로컬 시각 H:MM:SS',
  T.fmtRealClock(new Date(2026, 4, 19, 9, 5, 3).getTime()) === '9:05:03',
  T.fmtRealClock(new Date(2026, 4, 19, 9, 5, 3).getTime()));

/* ---------- 17) parseClockToElapsed — 시계 시각 직접 입력 (§C1) ---------- */
console.log('\n[17] parseClockToElapsed — 클립 시작 시각 HH:MM:SS 직접 입력');
var sEpoch = new Date(2026, 4, 19, 15, 33, 0).getTime();   // 세션 15:33:00 시작
check('"15:36:06" → 186초 (3분 6초 뒤)',
  T.parseClockToElapsed('15:36:06', sEpoch, 0) === 186);
check('"15:33:30" → 30초', T.parseClockToElapsed('15:33:30', sEpoch, 0) === 30);
check('"15:33" (초 생략) → 0초', T.parseClockToElapsed('15:33', sEpoch, 0) === 0);
check('데이터 시작 이전 시각은 음수 경과초',
  T.parseClockToElapsed('15:32:00', sEpoch, 0) === -60);
/* 자정 넘는 세션 — 현재 배치값에 가까운 날짜 해석을 고른다 */
var lateEpoch = new Date(2026, 4, 19, 23, 59, 0).getTime();
check('자정 넘김 — "00:02:00" 은 다음날로 해석(현재값 근처)',
  T.parseClockToElapsed('00:02:00', lateEpoch, 200) === 180,
  T.parseClockToElapsed('00:02:00', lateEpoch, 200));
check('형식 오류 → null',
  T.parseClockToElapsed('이상한값', sEpoch, 0) === null &&
  T.parseClockToElapsed('25:00:00', sEpoch, 0) === null &&
  T.parseClockToElapsed('15:36:06', null, 0) === null);

/* ---------- 18) 메타데이터 탐지 확장 — EXIF 날짜형식 (§C3) ---------- */
console.log('\n[18] 메타 탐지 확장 — EXIF 날짜형식 · 비표준 위치');
check('parseIso8601 — EXIF "2026:05:19 15:30:45" (콜론 날짜) 파싱',
  T.parseIso8601('2026:05:19 15:30:45') ===
    new Date(2026, 4, 19, 15, 30, 45).getTime());
check('parseIso8601 — EXIF + 타임존 "2026:05:19T06:30:45Z"',
  T.parseIso8601('2026:05:19T06:30:45Z') === Date.UTC(2026, 4, 19, 6, 30, 45));
/* moov 가 아닌 임의 박스에 EXIF 날짜를 넣어도 바이트 스캔으로 잡는다 */
var exifMp4 = buildMp4WithDate('2026:05:19 15:30:45');
var exifCd = T.extractCreationDate(exifMp4, 0, exifMp4.length);
check('extractCreationDate — EXIF 날짜형식도 탐지',
  exifCd && exifCd.ms === T.parseIso8601('2026:05:19 15:30:45'),
  exifCd && JSON.stringify(exifCd));
check('extractCreationDate — 비현실 연도(우연 일치) 거른다',
  T.extractCreationDate(
    new Uint8Array(Buffer.from('1899-05-19T15:30:45', 'ascii')), 0, 19) === null);

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail === 0 ? 0 : 1);
