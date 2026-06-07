/* ============================================================
 * selftest-hr.js — 심박수(HR) 분석 self-test
 *
 * GPX trkpt extensions 의 심박수 파싱 → normalizeSession → HR 분석
 * (analyzeHr · computeHrZones · computeHrEfficiency) 파이프라인을
 * 번들 샘플 GPX 로 검증한다. 의존성 0 — Node 내장 모듈만 사용한다.
 *
 *   실행:  node selftest-hr.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * GPX 파싱은 lat/lon/time/ele/hr 만 뽑는 경량 정규식 파서를 쓴다
 * (DOMParser 의존성 회피 — selftest-wind.js 와 같은 방식). 실제
 * js/gpx-parser.js 의 HR 추출과 같은 규칙(네임스페이스 무관 <…hr>,
 * 20~240 bpm 범위만 수용)을 그대로 흉내 낸다.
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));

/* --- 경량 GPX 파서 (trkpt lat/lon/time/ele/hr) --- */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var eM = inner.match(/<ele>([^<]+)<\/ele>/);
    /* 네임스페이스 접두사 무관 <…hr> — Waterspeed <ns3:hr>,
       Garmin <gpxtpx:hr>, 접두사 없는 <hr> 모두 잡는다. */
    var hM = inner.match(/<[A-Za-z0-9]*:?hr>([^<]+)<\/[A-Za-z0-9]*:?hr>/);
    var hv = hM ? parseFloat(hM[1]) : null;
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]),
      ele: eM ? parseFloat(eM[1]) : null,
      time: tM ? Date.parse(tM[1]) : null,
      speed: null,
      hr: (hv != null && isFinite(hv) && hv >= 20 && hv <= 240)
        ? Math.round(hv) : null
    });
  }
  var withTime = pts.filter(function (p) { return p.time != null; }).length;
  var withHR = pts.filter(function (p) { return p.hr != null; }).length;
  return {
    tracks: [{ name: 'selftest', segments: [pts] }],
    pointCount: pts.length, trackName: 'selftest',
    hasTime: withTime >= pts.length * 0.5,
    speedSource: 'derived',
    hasHR: withHR >= pts.length * 0.5,
    hrPointCount: withHR
  };
}
function loadSession(file) {
  var xml = fs.readFileSync(path.join(DIR, 'sample', file), 'utf8');
  return An.normalizeSession(parseGPX(xml));
}

/* --- 미니 테스트 러너 --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}

console.log('=== 심박수(HR) 분석 self-test ===\n');

/* ---------- 1) 송정(부산) — Waterspeed GPX, HR 포함 ---------- */
console.log('[1] 송정(부산) — Waterspeed GPX, 포인트별 심박수 포함');
var sj = loadSession('sample-songjeong-busan.gpx');
check('세션이 HR 을 보유한다 (hasHR)', sj.hasHR === true, 'hasHR=' + sj.hasHR);
check('HR 포인트 수가 합리적이다 (>2900개)',
  sj.hrPointCount > 2900, 'hrPointCount=' + sj.hrPointCount);

var hr = An.analyzeHr(sj);
console.log('      avg=' + hr.avgBpm.toFixed(1) + ' min=' + hr.minBpm +
  ' max=' + hr.maxBpm + ' coverage=' + hr.coveragePct.toFixed(1) + '%');
check('analyzeHr 가 hasHR:true 를 반환한다', hr.hasHR === true);
check('최저 심박이 생리적으로 합리적이다 (40~120 bpm)',
  hr.minBpm >= 40 && hr.minBpm <= 120, 'min=' + hr.minBpm);
check('최고 심박이 생리적으로 합리적이다 (120~220 bpm)',
  hr.maxBpm >= 120 && hr.maxBpm <= 220, 'max=' + hr.maxBpm);
check('평균 심박이 최저~최고 사이에 든다',
  hr.avgBpm >= hr.minBpm && hr.avgBpm <= hr.maxBpm,
  'avg=' + hr.avgBpm.toFixed(1));
check('추이 시계열(series)이 전량 담긴다 (다운샘플 없음)',
  hr.series.length === hr.count && hr.count > 2900,
  'series=' + hr.series.length + ' count=' + hr.count);
check('기록률(coverage)이 90% 이상이다',
  hr.coveragePct >= 90, 'coverage=' + hr.coveragePct.toFixed(1) + '%');
check('기본 최대 심박수 = 세션 관측 최대값',
  hr.defaultMaxHr === hr.maxBpm,
  'defaultMaxHr=' + hr.defaultMaxHr + ' maxBpm=' + hr.maxBpm);

/* ---------- 2) 심박 존 분포 — 시간 보존·경계 일관 ---------- */
console.log('\n[2] computeHrZones — 존 분포 시간 보존·경계 일관성');
var z = An.computeHrZones(sj, null);
console.log('      maxHr=' + z.maxHrUsed + ' (' + z.maxHrSource + ') · total=' +
  (z.totalSec / 60).toFixed(1) + 'min · peak=' + z.peakKey);
check('미입력 시 maxHrSource 가 "observed" 다', z.maxHrSource === 'observed',
  'source=' + z.maxHrSource);
check('미입력 maxHr 가 관측 최대값과 같다', z.maxHrUsed === hr.maxBpm,
  'maxHrUsed=' + z.maxHrUsed);
check('존이 5개(Z1~Z5) 다', z.zones.length === 5, '개수=' + z.zones.length);
var zoneSum = z.belowSec;
z.zones.forEach(function (zz) { zoneSum += zz.seconds; });
check('존 시간 합 + 휴식 = 전체 시간 (시간 보존)',
  Math.abs(zoneSum - z.totalSec) < 1,
  'sum=' + zoneSum.toFixed(1) + ' total=' + z.totalSec.toFixed(1));
var boundaryOk = true, prevHi = null;
z.zones.forEach(function (zz) {
  if (zz.loBpm >= zz.hiBpm) boundaryOk = false;
  if (prevHi != null && zz.loBpm !== prevHi) boundaryOk = false;
  prevHi = zz.hiBpm;
});
check('존 경계 bpm 이 끊김 없이 단조 증가한다', boundaryOk,
  z.zones.map(function (zz) { return zz.loBpm + '-' + zz.hiBpm; }).join(' '));
check('Z1 회복 / Z2 유산소 / Z4 역치 / Z5 무산소 이름이 명시된다',
  z.zones[0].name === '회복' && z.zones[1].name === '유산소' &&
  z.zones[3].name === '역치' && z.zones[4].name === '무산소',
  z.zones.map(function (zz) { return zz.name; }).join(','));
check('각 존이 정의(desc) 텍스트를 담는다',
  z.zones.every(function (zz) { return zz.desc && zz.desc.length > 4; }));
check('모든 존 시간이 음수가 아니다',
  z.zones.every(function (zz) { return zz.seconds >= 0; }) && z.belowSec >= 0);

/* 사용자 입력 최대 심박수 */
var zUser = An.computeHrZones(sj, 190);
check('사용자 입력 maxHr=190 이 그대로 반영된다',
  zUser.maxHrUsed === 190 && zUser.maxHrSource === 'user',
  'maxHrUsed=' + zUser.maxHrUsed + ' source=' + zUser.maxHrSource);
check('maxHr=190 → Z5 무산소 하한 = 171 bpm (90%)',
  zUser.zones[4].loBpm === 171, 'z5.loBpm=' + zUser.zones[4].loBpm);
check('maxHr 가 커지면 같은 심박이 더 낮은 존으로 이동(무산소 시간 감소)',
  zUser.zones[4].seconds <= z.zones[4].seconds + 1,
  'z5@190=' + (zUser.zones[4].seconds / 60).toFixed(1) + 'min vs z5@observed=' +
  (z.zones[4].seconds / 60).toFixed(1) + 'min');
var zClamp = An.computeHrZones(sj, 50);   // 범위 밖 → 관측 최대로 폴백
check('범위 밖 maxHr(50)은 무시되고 관측 최대로 폴백한다',
  zClamp.maxHrSource === 'observed', 'source=' + zClamp.maxHrSource);

/* ---------- 3) 퍼포먼스 대비 심박 효율 ---------- */
console.log('\n[3] computeHrEfficiency — 속도-심박 효율');
var eff = hr.efficiency;
check('효율 분석이 산출된다 (available)', eff.available === true);
check('산점도 표본이 전량 담긴다 (다운샘플 없음, >1000점)',
  eff.scatter.length > 1000, 'scatter=' + eff.scatter.length);
check('속도 구간별 심박 중앙값 추세가 산출된다 (>=4구간)',
  eff.trend.length >= 4, 'trend=' + eff.trend.length);
check('추세 각 구간의 중앙값이 생리적으로 합리적이다 (50~210 bpm)',
  eff.trend.every(function (b) { return b.medianHr >= 50 && b.medianHr <= 210; }));
check('주행 평균 심박이 합리적이다 (90~200 bpm)',
  eff.avgHr >= 90 && eff.avgHr <= 200, 'avgHr=' + eff.avgHr.toFixed(1));
check('효율 지수가 양수다', eff.index > 0, 'index=' + eff.index.toFixed(2));
console.log('      avgHr=' + eff.avgHr.toFixed(1) + ' avgSpd=' +
  (eff.avgSpeedMs * Geo.MS_TO_KNOTS).toFixed(2) + 'kt index=' +
  eff.index.toFixed(2) + ' drift=' +
  (eff.drift.available ? eff.drift.driftPct.toFixed(1) + '%' : 'n/a'));
if (eff.drift.available) {
  check('심박 드리프트가 물리적으로 합리적이다 (-30%~+40%)',
    eff.drift.driftPct > -30 && eff.drift.driftPct < 40,
    'driftPct=' + eff.drift.driftPct.toFixed(1) + '%');
  check('드리프트 전·후반 심박이 생리적 범위다 (90~210 bpm)',
    eff.drift.firstHr >= 90 && eff.drift.firstHr <= 210 &&
    eff.drift.secondHr >= 90 && eff.drift.secondHr <= 210,
    'first=' + eff.drift.firstHr.toFixed(1) + ' second=' + eff.drift.secondHr.toFixed(1));
}

/* ---------- 4) 강릉 — HR 없는 GPX ---------- */
console.log('\n[4] 강릉 — HR 미기록 GPX, 심박수 섹션이 비활성이어야 함');
var gn = loadSession('sample-ride-gangneung.gpx');
check('세션이 HR 을 보유하지 않는다 (hasHR=false)', gn.hasHR === false,
  'hasHR=' + gn.hasHR);
var gnHr = An.analyzeHr(gn);
check('analyzeHr 가 hasHR:false 만 반환한다', gnHr.hasHR === false);
var gnZ = An.computeHrZones(gn, null);
check('computeHrZones 가 빈 존 결과를 반환한다',
  gnZ.zones.length === 0 && gnZ.hasHR === false);

/* ---------- 5) 편집(trim/제외) 후 HR 보존 ---------- */
console.log('\n[5] 편집(trim·제외) 후에도 심박 데이터가 보존되는지');
var ed = An.applyEdits(sj, { trimStart: 180, trimEnd: 900 });
check('편집된 세션이 HR 을 그대로 보유한다 (hasHR)', ed.hasHR === true,
  'hasHR=' + ed.hasHR);
var edHr = An.analyzeHr(ed);
check('편집 세션 analyzeHr 가 동작하고 표본이 줄어든다',
  edHr.hasHR === true && edHr.count > 0 && edHr.count < hr.count,
  'edited count=' + edHr.count + ' / full=' + hr.count);
var crop = An.cropSession(sj, 180, 900);
check('cropSession 후에도 HR 이 보존된다',
  crop.hasHR === true && crop.hrPointCount > 0,
  'hasHR=' + crop.hasHR + ' hrPointCount=' + crop.hrPointCount);

/* ---------- 6) 회귀 — analyzeSession 통합 ---------- */
console.log('\n[6] 회귀 — analyzeSession 이 hr 묶음을 담고 기존 분석 무손상');
var aSj = An.analyzeSession(sj, null, {});
check('analyzeSession 결과에 hr 객체가 있다', !!aSj.hr, 'hr=' + (aSj.hr && typeof aSj.hr));
check('analyzeSession.hr.hasHR 가 true 다 (송정)', aSj.hr.hasHR === true);
check('기존 속도 분석(summary)이 그대로 동작한다',
  aSj.summary && aSj.summary.maxSpeedMs > 0,
  'maxSpeedMs=' + (aSj.summary && aSj.summary.maxSpeedMs));
var aGn = An.analyzeSession(gn, null, {});
check('HR 없는 세션도 analyzeSession 이 정상 동작한다',
  !!aGn.hr && aGn.hr.hasHR === false && aGn.summary != null);

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail === 0 ? 0 : 1);
