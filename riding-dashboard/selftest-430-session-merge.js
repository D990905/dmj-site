/* ============================================================
 * selftest-430-session-merge.js — §430 다중 파일 자동 융합 검증
 *
 * 옥대표님 2026-07-05 실 세션 파일로 융합 파이프라인을 검증한다:
 *   outputs/racebox-sessions/racebox_2026-07-05_1451.gpx  (25Hz 항적)
 *   outputs/racebox-sessions/racebox_2026-07-05_1451.csv  (IMU)
 *   outputs/racebox-sessions/waterspeed_2026-07-05_1441.gpx (HR)
 *
 * DOMParser 의존을 피하려고 GPX 는 정규식 미니파서로 표준 스키마를
 * 만든 뒤 merger.wrapParsed → merge 를 직접 호출한다(브라우저는
 * parseOne 이 DOMParser 로 같은 스키마를 만든다). RaceBox CSV 는
 * 실제 파서(RDRaceboxCSV)를 그대로 쓴다.
 *
 * 실행: node selftest-430-session-merge.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var DIR = __dirname;
var ROOT = path.join(DIR, '..');

var RaceboxCSV = require(path.join(DIR, 'js', 'parsers', 'racebox-csv.js'));
var Imu = require(path.join(DIR, 'js', 'analysis-imu.js'));
var Hr = require(path.join(DIR, 'js', 'analysis-hr.js'));
var Merger = require(path.join(DIR, 'js', 'session-merger.js'));
var An = require(path.join(DIR, 'js', 'analysis.js'));
Merger.setDeps({ RaceboxCSV: RaceboxCSV, Imu: Imu, Csv: null, Gpx: null });

var pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

/* --- 정규식 GPX 미니파서 → 표준 parsed 스키마 --- */
function parseGpxRegex(xml) {
  var creatorM = xml.slice(0, 1500).match(/creator\s*=\s*"([^"]*)"/i);
  var creator = creatorM ? creatorM[1] : '';
  var pts = [];
  var re = /<trkpt\b[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"[^>]*?>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]), inner = m[3];
    if (!isFinite(lat) || !isFinite(lng)) continue;
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var time = tM ? Date.parse(tM[1]) : null;
    var eM = inner.match(/<ele>([-\d.]+)<\/ele>/);
    var ele = eM ? parseFloat(eM[1]) : null;
    var hM = inner.match(/<(?:[\w]+:)?hr>([\d.]+)<\/(?:[\w]+:)?hr>/);
    var hr = null;
    if (hM) { var hv = parseFloat(hM[1]); if (isFinite(hv) && hv >= 20 && hv <= 240) hr = Math.round(hv); }
    pts.push({ lat: lat, lng: lng, ele: isFinite(ele) ? ele : null,
               time: isFinite(time) ? time : null, speed: null, hr: hr });
  }
  var withTime = 0, withHR = 0;
  pts.forEach(function (p) { if (p.time != null) withTime++; if (p.hr != null) withHR++; });
  return {
    creator: creator,
    tracks: [{ name: 'gpx', segments: [pts] }],
    pointCount: pts.length, trackName: 'gpx',
    hasTime: withTime >= pts.length * 0.5,
    speedSource: 'derived',
    hasHR: withHR >= pts.length * 0.5, hrPointCount: withHR
  };
}

var SDIR = path.join(ROOT, 'outputs', 'racebox-sessions');
var rbGpxXml = fs.readFileSync(path.join(SDIR, 'racebox_2026-07-05_1451.gpx'), 'utf8');
var rbCsvTxt = fs.readFileSync(path.join(SDIR, 'racebox_2026-07-05_1451.csv'), 'utf8');
var wsGpxXml = fs.readFileSync(path.join(SDIR, 'waterspeed_2026-07-05_1441.gpx'), 'utf8');

console.log('\n=== §430 세션 융합 셀프테스트 ===\n');

/* ---------- 0. 형식 감지 ---------- */
console.log('[0] 형식 자동 감지');
ok(Merger.detectFormat('racebox_x.csv', rbCsvTxt).source === 'racebox-csv', 'RaceBox CSV 감지');
ok(Merger.detectFormat('racebox_x.gpx', rbGpxXml).source === 'racebox-gpx', 'RaceBox GPX 감지 (creator=RaceBox)');
ok(Merger.detectFormat('ws.gpx', wsGpxXml).source === 'waterspeed-gpx', 'Waterspeed GPX 감지');

/* ---------- 1. RaceBox CSV 파서 ---------- */
console.log('\n[1] RaceBox CSV 파서');
var rbCsv = RaceboxCSV.parse(rbCsvTxt);
ok(rbCsv.pointCount > 60000, 'CSV 포인트 파싱 (' + rbCsv.pointCount + 'pt)');
ok(rbCsv.hasImu, 'IMU(GForce) 보유');
var sp0 = rbCsv.tracks[0].segments[0].find(function (p) { return p.speed != null; });
ok(sp0 && sp0.speed >= 0 && sp0.speed < 30, 'Speed km/h→m/s 변환 정상 (' + (sp0 ? sp0.speed.toFixed(2) : '?') + ' m/s)');
var gpt = rbCsv.tracks[0].segments[0].find(function (p) { return p.gforceZ != null; });
ok(gpt && approx(gpt.gforceZ, 1.0, 0.5), 'GForceZ ≈ 1g (Z=위 축 확인, ' + (gpt ? gpt.gforceZ : '?') + ')');

/* ---------- 2. IMU heel/pitch 변환 ---------- */
console.log('\n[2] analysis-imu heel/pitch');
var lvl = Imu.gforceToAngles(0, 0, 1);
ok(approx(lvl.heel, 0, 0.01) && approx(lvl.pitch, 0, 0.01), '정지·수평 → heel=0, pitch=0');
var rollR = Imu.gforceToAngles(0, 0.5, 0.866);   // 30° roll
ok(approx(rollR.heel, 30, 1), 'GForceY=0.5,Z=0.866 → heel≈30°');

/* ---------- 3. 소스 래핑 + primary 선택 ---------- */
console.log('\n[3] Primary trajectory 자동 선택');
var srcRbGpx = Merger.wrapParsed(parseGpxRegex(rbGpxXml), { source: 'racebox-gpx', creator: 'RaceBox' }, 'racebox.gpx');
var srcRbCsv = Merger.wrapParsed(rbCsv, { source: 'racebox-csv', creator: 'RaceBox' }, 'racebox.csv');
var srcWs = Merger.wrapParsed(parseGpxRegex(wsGpxXml), { source: 'waterspeed-gpx', creator: 'Waterspeed' }, 'ws.gpx');
console.log('    RaceBox GPX: ' + srcRbGpx.sampleRateHz.toFixed(1) + 'Hz ' + srcRbGpx.pointCount + 'pt');
console.log('    RaceBox CSV: ' + srcRbCsv.sampleRateHz.toFixed(1) + 'Hz ' + srcRbCsv.pointCount + 'pt (IMU=' + srcRbCsv.hasImu + ')');
console.log('    Waterspeed : ' + srcWs.sampleRateHz.toFixed(1) + 'Hz ' + srcWs.pointCount + 'pt (HR=' + srcWs.hasHR + ')');
var primary = Merger.pickPrimary([srcWs, srcRbCsv, srcRbGpx]);
ok(primary.source === 'racebox-gpx', 'Primary = RaceBox GPX (25Hz·GPX 계열 우선), 실제=' + primary.source);
ok(srcRbGpx.sampleRateHz > 10, 'RaceBox 샘플레이트 > 10Hz');
ok(srcWs.hasHR, 'Waterspeed HR 보유 감지');

/* ---------- 4. 융합 실행 ---------- */
console.log('\n[4] 3-파일 융합');
var res = Merger.merge([srcWs, srcRbCsv, srcRbGpx]);
var f = res.fusion;
console.log('    primary=' + f.primary.source + ' ' + f.primary.sampleRateHz + 'Hz');
console.log('    IMU merged: ' + (f.imu && f.imu.merged) + ' from ' + (f.imu && f.imu.source) + ' (' + (f.imu && f.imu.pointCount) + 'pt)');
console.log('    HR merged : ' + (f.hr && f.hr.merged) + ' from ' + (f.hr && f.hr.source) + ' (' + (f.hr && f.hr.pointCount) + 'pt)');
console.log('    speed src : ' + f.speed.source + ' (' + f.speed.pointCount + 'pt)');
console.log('    spikes removed: ' + f.spikes.removed + ' (' + (f.spikes.rate * 100).toFixed(2) + '%)');
console.log('    heel cov=' + (f.heelCoverage * 100).toFixed(1) + '% · hr cov=' + (f.hrCoverage * 100).toFixed(1) + '%');
ok(f.primary.source === 'racebox-gpx', 'fusion.primary = RaceBox GPX');
ok(f.imu && f.imu.merged && f.imu.source === 'racebox-csv', 'IMU 병합 = RaceBox CSV');
ok(f.hr && f.hr.merged && f.hr.source === 'waterspeed-gpx', 'HR 병합 = Waterspeed');
ok(f.heelCoverage > 0.5, 'heel 커버리지 > 50%');
ok(f.hrCoverage > 0.3, 'HR 커버리지 > 30% (Waterspeed 워밍업 gap 감안)');
ok(res.parsed.speedSource === 'device', 'speedSource=device (CSV Speed 병합)');
ok(f.spikes.removed >= 0, 'GPS 스파이크 리포트 존재 (' + f.spikes.removed + ')');

/* heel/pitch 값 상식 범위(±60°) 확인 */
var pts = res.points, heelBad = 0, heelN = 0, pitchBad = 0, pitchN = 0;
for (var i = 0; i < pts.length; i++) {
  if (pts[i].heel != null) { heelN++; if (Math.abs(pts[i].heel) > 60) heelBad++; }
  if (pts[i].pitch != null) { pitchN++; if (Math.abs(pts[i].pitch) > 60) pitchBad++; }
}
ok(heelN > 0 && heelBad / heelN < 0.05, 'heel 값 95%+ 가 ±60° 이내 (' + heelBad + '/' + heelN + ' 초과)');
ok(pitchN > 0 && pitchBad / pitchN < 0.05, 'pitch 값 95%+ 가 ±60° 이내 (' + pitchBad + '/' + pitchN + ' 초과)');

/* ---------- 5. 분석 파이프라인 통합 (normalizeSession) ---------- */
console.log('\n[5] normalizeSession 통합 (대시보드 파이프라인)');
var session = An.normalizeSession(res.parsed);
ok(session.hasHR, 'session.hasHR = true (HR 병합이 분석에 전달)');
var heelSamp = session.samples.filter(function (s) { return s.heel != null; }).length;
ok(heelSamp > 0, '리샘플 후에도 heel 샘플 존재 (' + heelSamp + '/' + session.samples.length + ')');
ok(session.samples.length > 100, '세션 샘플 생성 (' + session.samples.length + ')');

/* HR 존/상관 */
var zones = Hr.effortZones(session.samples, session.rider && session.rider.maxHr);
ok(zones.hasHR && zones.zones.length === 5, 'HR effort zone 5개 산출');
var corr = Hr.speedCorrelation(session.samples);
ok(corr.hasHR && corr.n > 10, 'HR-속도 상관 산출 (r=' + (corr.r != null ? corr.r.toFixed(2) : 'n/a') + ', n=' + corr.n + ')');

/* ---------- 6. 하위 호환: 단일 GPX ---------- */
console.log('\n[6] 하위 호환 — 단일 파일 융합');
var soloWs = Merger.merge([srcWs]);
ok(soloWs.parsed.pointCount === srcWs.pointCount, '단일 Waterspeed: 포인트 수 보존 (' + soloWs.parsed.pointCount + ')');
ok(soloWs.parsed.hasHR, '단일 Waterspeed: HR 유지 (외부 도너 없음, no-op)');
ok(soloWs.fusion.imu === null || !soloWs.fusion.imu.merged, '단일 Waterspeed: IMU 병합 없음 (에러 X)');
var soloRbCsv = Merger.merge([srcRbCsv]);
ok(soloRbCsv.fusion.heelCoverage > 0.5, '단일 RaceBox CSV: 자체 IMU→heel 산출');
ok(!soloRbCsv.parsed.hasHR, '단일 RaceBox CSV: HR 없음 (Waterspeed 미포함, no-op)');

/* ---------- 7. 윙포일 보정 — 상보필터 vs accel-only ---------- */
console.log('\n[7] 윙포일 IMU 보정 (상보필터 + 게이팅)');
/* 원본 CSV 포인트에 자이로가 실렸는지 */
var rawPts = rbCsv.tracks[0].segments[0];
var gyroN = rawPts.filter(function (p) { return p.gyroX != null && p.gyroY != null; }).length;
ok(gyroN > rawPts.length * 0.9, 'RaceBox CSV 자이로 3축 저장 (' + gyroN + '/' + rawPts.length + ')');

function heelRateP(pts) {
  var rr = [];
  for (var i = 1; i < pts.length; i++) {
    if (pts[i].heel == null || pts[i - 1].heel == null) continue;
    var dt = (pts[i].time - pts[i - 1].time) / 1000;
    if (dt > 0 && dt < 0.2) rr.push(Math.abs(pts[i].heel - pts[i - 1].heel) / dt);
  }
  rr.sort(function (a, b) { return a - b; });
  return rr.length ? rr[Math.floor(0.99 * (rr.length - 1))] : null;
}
/* accel-only 기준선 */
var accelPts = rawPts.map(function (p) {
  return { time: p.time, gforceX: p.gforceX, gforceY: p.gforceY, gforceZ: p.gforceZ };
});
Imu.annotate(accelPts);
var accelP99 = heelRateP(accelPts);
/* 상보필터 */
var compPts = rawPts.map(function (p) {
  return { time: p.time, gforceX: p.gforceX, gforceY: p.gforceY, gforceZ: p.gforceZ,
           gyroX: p.gyroX, gyroY: p.gyroY, gyroZ: p.gyroZ };
});
Imu.computeAttitude(compPts);
var compP99 = heelRateP(compPts);
console.log('    heel 변화율 p99: accel-only=' + accelP99.toFixed(0) + '°/s → 상보필터=' + compP99.toFixed(0) + '°/s');
ok(compP99 < accelP99 * 0.6, '상보필터가 heel 튐 40%+ 감소 (부드러움)');
ok(compP99 < 90, '보정 후 heel 변화율 p99 < 90°/s (현실적)');

/* 보정 후 range 여전히 상식 범위 */
var cbad = 0, cn = 0;
for (var ci = 0; ci < compPts.length; ci++) {
  if (compPts[ci].heel != null) { cn++; if (Math.abs(compPts[ci].heel) > 60) cbad++; }
}
ok(cn > 0 && cbad / cn < 0.02, '보정 후 heel 98%+ 가 ±60° 이내 (' + cbad + '/' + cn + ')');

/* 융합 결과(res)의 heel 도 보정본인지 — merge 경로 확인 */
var fusedP99 = heelRateP(res.points);
console.log('    융합 세션 heel 변화율 p99=' + (fusedP99 != null ? fusedP99.toFixed(0) : 'n/a') + '°/s');
ok(fusedP99 != null && fusedP99 < 90, '융합 경로에도 보정 적용됨 (p99 < 90)');

/* ---------- 8. 부분 커버리지 heel 통계 (NaN 회귀 방지) ---------- */
console.log('\n[8] 통계 패널 heel 버킷 — 부분 커버리지 NaN 방지');
/* RaceBox CSV 는 GPX 보다 늦게 시작 → 앞부분 ~14 표본에 heel 없음.
   과거엔 그 null 이 computeTierMeans 평균을 NaN 으로 오염시켜 스타보드
   힐 통계가 '—' 로 사라졌다. 풍향 추정 후 4 버킷 평균이 전부 유한한지. */
var wEst = An.estimateWindFromTrack(session);
var wdUsed = (wEst && wEst.windDir != null) ? wEst.windDir : 210;
var ana = An.analyzeSession(session, wdUsed);
var tsplit = ana.wind && ana.wind.tackSplit;
ok(!!tsplit, '풍향 추정 후 tackSplit 산출 (wind=' + wdUsed + '°)');
var buckets = [['upwind', 'P'], ['upwind', 'S'], ['downwind', 'P'], ['downwind', 'S']];
var allFinite = true, report = [];
buckets.forEach(function (b) {
  var grp = tsplit && tsplit[b[0]] && tsplit[b[0]][b[1]];
  if (grp && grp.count && grp.heel) {
    var finite = isFinite(grp.heel.avg) && isFinite(grp.heel.top50) && isFinite(grp.heel.top20);
    if (!finite) allFinite = false;
    report.push(b[0] + '.' + b[1] + '=' + (isFinite(grp.heel.avg) ? grp.heel.avg.toFixed(1) : 'NaN'));
  }
});
console.log('    heel 버킷 평균: ' + report.join(' · '));
ok(allFinite, '4 버킷 heel 평균·상위50·상위20 모두 유한 (NaN 없음)');
/* 좌우 부호 일관성 — 포트 양수, 스타보드 음수(또는 반대), 한 택 안에서 일관 */
var upP = tsplit.upwind.P.heel, upS = tsplit.upwind.S.heel;
ok(upP && upS && Math.sign(upP.avg) !== Math.sign(upS.avg),
   '포트·스타보드 heel 부호 반대 (택별 물리 일관): P=' + upP.avg.toFixed(1) + ' S=' + upS.avg.toFixed(1));

/* ---------- 9. AWA(겉보기 풍각) ---------- */
console.log('\n[9] AWA 겉보기 풍각 (풍속 입력 시)');
var TWS = 15;   // kt 가정
var anaNoWind = An.analyzeSession(session, wdUsed);           // 풍속 없음
var anaAwa = An.analyzeSession(session, wdUsed, { windSpeedKt: TWS });
var tsNo = anaNoWind.wind.tackSplit, tsAwa = anaAwa.wind.tackSplit;
ok(!tsNo.upwind.P.awa, '풍속 없으면 AWA 미산출 (행 안 생김)');
ok(!!(tsAwa.upwind.P.awa && tsAwa.downwind.P.awa), '풍속 있으면 AWA 산출');
/* 물리: 포일링 고속에선 겉보기 바람이 앞으로 당겨져 AWA < CWA */
var upAwa = tsAwa.upwind.P.awa.avg, upCwa = tsAwa.upwind.P.twa.avg;
var dnAwa = tsAwa.downwind.P.awa.avg, dnCwa = tsAwa.downwind.P.twa.avg;
console.log('    풍상 CWA=' + upCwa.toFixed(1) + '° → AWA=' + upAwa.toFixed(1) + '° · 풍하 CWA=' + dnCwa.toFixed(1) + '° → AWA=' + dnAwa.toFixed(1) + '°');
ok(upAwa < upCwa && dnAwa < dnCwa, 'AWA < CWA (겉보기 바람이 앞으로 당겨짐)');
ok(upAwa > 0 && upAwa < 90 && dnAwa > 0 && dnAwa < 120, 'AWA 값 물리 범위 내');
/* CWA(twa) 는 풍속과 무관하게 동일해야 (AWA 추가가 CWA 훼손 안 함) */
ok(Math.abs(tsNo.upwind.P.twa.avg - upCwa) < 0.01, 'CWA 는 풍속과 무관 (기존 지표 불변)');

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' 통과 / ' + fail + ' 실패 ===\n');
process.exit(fail ? 1 : 0);
