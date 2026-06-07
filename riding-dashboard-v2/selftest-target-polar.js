/* ============================================================
 * selftest-target-polar.js — 타깃 폴라 · % of target self-test
 *
 * Njord 벤치마크 후속 ③-2: 라이더 본인의 누적 데이터로 타깃 폴라를
 * 구축하고(개인 베스트), 현재 세션이 그 타깃의 몇 %인지 산출하는
 * 엔진(analysis.js)을 번들 샘플 GPX 로 검증한다.
 * 의존성 0 — Node 내장 모듈만 사용한다.
 *
 *   실행:  node selftest-target-polar.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));

/* --- 경량 GPX 파서 (trkpt lat/lon/time) — selftest-wind.js 와 동일 --- */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]), ele: 0,
      time: tM ? Date.parse(tM[1]) : null, speed: null
    });
  }
  var withTime = pts.filter(function (p) { return p.time != null; }).length;
  return {
    tracks: [{ name: 'selftest', segments: [pts] }],
    pointCount: pts.length, trackName: 'selftest',
    hasTime: withTime >= pts.length * 0.5, speedSource: 'derived'
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

console.log('=== 타깃 폴라 · % of target self-test ===\n');

/* 풍향 — 회전 기하/노고존 추정값을 그대로 쓴다(자동 추정 일관) */
var sj = loadSession('sample-songjeong-busan.gpx');
var gn = loadSession('sample-ride-gangneung.gpx');
var sjW = An.estimateWindFromTrack(sj).windDir;
var gnW = An.estimateWindFromManeuvers(gn).windDir;
console.log('풍향: 송정=' + sjW + '° · 강릉=' + gnW + '°\n');

/* ---------- 1) computePolar — combined(택 합산) 빈 ---------- */
console.log('[1] computePolar — 택 합산 combined 빈 추가');
var polGn = An.computePolar(gn, gnW);
check('combined 배열이 존재한다', !!(polGn && polGn.combined), 'combined 없음');
check('combined 빈 수 = port·starboard 와 동일',
  polGn.combined.length === polGn.port.length &&
  polGn.combined.length === polGn.starboard.length,
  'combined=' + polGn.combined.length);
check('combined.count = port.count + starboard.count (빈별 합산)',
  polGn.combined.every(function (bn, i) {
    return bn.count === polGn.port[i].count + polGn.starboard[i].count;
  }), '빈별 합산 불일치');
/* 평균은 선형 풀링이 성립한다 — combined.avg = 두 택 합/총개수.
   (p95 는 비선형이라 두 택 p95 사이로 갇히지 않는다 — 평균으로 검증.) */
check('combined.avgMs = 택별 (avg×count) 합 ÷ 총 count (풀링 정확)',
  polGn.combined.every(function (bn, i) {
    if (bn.count < 1) return bn.avgMs === 0;
    var pooled = (polGn.port[i].avgMs * polGn.port[i].count +
                  polGn.starboard[i].avgMs * polGn.starboard[i].count) / bn.count;
    return Math.abs(bn.avgMs - pooled) < 1e-9;
  }), 'avg 풀링 불일치');
check('combined.p95Ms 는 항상 0 이상 (산출 안정)',
  polGn.combined.every(function (bn) { return bn.p95Ms >= 0; }));

/* ---------- 2) sessionPolarProfile — 컴팩트 프로파일 ---------- */
console.log('\n[2] sessionPolarProfile — 저장·누적용 컴팩트 프로파일');
var profGn = An.sessionPolarProfile(gn, gnW);
var profSj = An.sessionPolarProfile(sj, sjW);
check('프로파일이 산출된다', !!(profGn && profSj), 'null 반환');
check('프로파일 binDeg 가 7.5° 다', profGn.binDeg === 7.5,
  'binDeg=' + profGn.binDeg);
check('프로파일 빈마다 count·p95Ms 를 담는다',
  profGn.bins.every(function (b) {
    return typeof b.count === 'number' && typeof b.p95Ms === 'number';
  }), '빈 구조 이상');
check('풍향 미설정이면 프로파일이 null',
  An.sessionPolarProfile(gn, null) === null);

/* ---------- 3) buildTargetPolar — 단일 세션 ---------- */
console.log('\n[3] buildTargetPolar — 단일 세션(v1 폴백)');
var tgt1 = An.buildTargetPolar([profSj], { basis: 'single-session' });
check('타깃 폴라가 산출된다', !!tgt1, 'null 반환');
check('basis 가 single-session', tgt1.basis === 'single-session',
  'basis=' + tgt1.basis);
check('타깃 빈 수 24 (180°/7.5°)', tgt1.bins.length === 24,
  'nBins=' + tgt1.bins.length);
check('무항주(no-go) 구역 빈은 정직하게 비어 있다 (TWA 0~30° 중 일부 null)',
  tgt1.bins.slice(0, 4).some(function (b) { return b.speedMs == null; }),
  '0~30° 빈이 전부 채워짐');
check('채워진 빈의 speedMs 는 양수',
  tgt1.bins.every(function (b) { return b.speedMs == null || b.speedMs > 0; }));
check('채워진 빈 + 보간 빈 + 빈 빈 = 24 (집계 일관)',
  tgt1.filledBins + tgt1.interpolatedBins + tgt1.emptyBins === 24,
  tgt1.filledBins + '+' + tgt1.interpolatedBins + '+' + tgt1.emptyBins);
check('vmgMs = speedMs × |cos(TWA)| (파생 일관)',
  tgt1.bins.every(function (b) {
    if (b.speedMs == null) return b.vmgMs == null;
    var exp = b.speedMs * Math.abs(Math.cos(b.twaCenter * Math.PI / 180));
    return Math.abs(b.vmgMs - exp) < 1e-6;
  }), 'vmg 파생 불일치');

/* ---------- 4) buildTargetPolar — 누적(2세션) + 보간/표본 ---------- */
console.log('\n[4] buildTargetPolar — 누적 2세션 + 보간·표본부족 표기');
var tgt2 = An.buildTargetPolar([profSj, profGn], { basis: 'cumulative' });
check('basis 가 cumulative', tgt2.basis === 'cumulative');
check('sourceSessionCount = 2', tgt2.sourceSessionCount === 2,
  '값=' + tgt2.sourceSessionCount);
check('누적 타깃 speedMs ≥ 각 세션 단독 타깃 (베스트는 단조 증가)',
  tgt2.bins.every(function (b, i) {
    var s = tgt1.bins[i].speedMs;
    if (s == null || b.speedMs == null) return true;
    return b.speedMs >= s - 1e-6;
  }), '누적이 단일보다 낮은 빈 존재');
check('보간 빈은 interpolated=true 로 표시된다 (보간이 있으면)',
  tgt2.interpolatedBins === 0 ||
  tgt2.bins.some(function (b) { return b.interpolated === true; }));
check('보간 빈은 양옆이 실측 — 한쪽 끝 공백은 보간하지 않는다',
  (function () {
    for (var i = 0; i < 24; i++) {
      if (!tgt2.bins[i].interpolated) continue;
      var lo = i - 1, hi = i + 1;
      while (lo >= 0 && tgt2.bins[lo].speedMs == null) lo--;
      while (hi < 24 && tgt2.bins[hi].speedMs == null) hi++;
      if (lo < 0 || hi >= 24) return false;
    }
    return true;
  })(), '끝단 외삽 발생');
check('표본 적은 빈(sparse)은 채워진 빈 안에서만 표시된다',
  tgt2.bins.every(function (b) {
    return !b.sparse || (b.speedMs != null && !b.interpolated);
  }));
check('sparse 빈의 누적 표본 < 60 · 비-sparse 빈은 ≥ 60',
  tgt2.bins.every(function (b) {
    if (b.speedMs == null || b.interpolated) return true;
    return b.sparse ? b.sampleCount < 60 : b.sampleCount >= 60;
  }), 'sparse 임계 불일치');
console.log('      누적 타깃: 실측 ' + tgt2.filledBins + ' · 보간 ' +
  tgt2.interpolatedBins + ' · 공백 ' + tgt2.emptyBins + ' · 표본부족 ' +
  tgt2.sparseBins);

/* ---------- 5) buildTargetPolar — 엣지 케이스 ---------- */
console.log('\n[5] buildTargetPolar — 엣지 케이스');
check('빈 배열이면 null', An.buildTargetPolar([]) === null);
check('null·빈 프로파일을 걸러낸다',
  An.buildTargetPolar([null, { bins: [] }]) === null);
var tgtMin = An.buildTargetPolar([profGn], { minBinSamples: 100000 });
check('minBinSamples 가 과도하면 실측 빈 0 (표본 임계 동작)',
  tgtMin && tgtMin.filledBins === 0,
  'filled=' + (tgtMin && tgtMin.filledBins));

/* ---------- 6) computeTargetComparison — % of target ---------- */
console.log('\n[6] computeTargetComparison — % of target (풍상·풍하)');
var cmp = An.computeTargetComparison(gn, gnW, tgt2);
check('비교 결과가 산출된다', !!cmp, 'null 반환');
check('풍상·풍하 두 묶음을 따로 돌려준다',
  !!(cmp.upwind && cmp.downwind));
check('풍향 미설정이면 null',
  An.computeTargetComparison(gn, null, tgt2) === null);
check('타깃 미제공이면 null',
  An.computeTargetComparison(gn, gnW, null) === null);
function pctOk(side, lbl) {
  if (side.pctOfTarget == null) {
    check(lbl + ' — 비교 구간이 없으면 pct=null·coverage=0',
      side.coverage === 0, 'coverage=' + side.coverage);
    return;
  }
  check(lbl + ' % of target 가 합리적 범위 (10~140%)',
    side.pctOfTarget >= 10 && side.pctOfTarget <= 140,
    '값=' + side.pctOfTarget.toFixed(1) + '%');
  check(lbl + ' coverage 가 0~1 범위',
    side.coverage >= 0 && side.coverage <= 1 + 1e-9,
    'coverage=' + side.coverage.toFixed(3));
  check(lbl + ' 비교 시간 ≤ 전체 시간 (보간 빈 제외 일관)',
    side.comparedTimeSec <= side.timeSec + 1e-6,
    'cmp=' + side.comparedTimeSec.toFixed(0) + ' all=' + side.timeSec.toFixed(0));
}
pctOk(cmp.upwind, '풍상');
pctOk(cmp.downwind, '풍하');
console.log('      강릉 vs 누적타깃: 풍상 ' +
  (cmp.upwind.pctOfTarget != null ? cmp.upwind.pctOfTarget.toFixed(1) + '%' : '–') +
  ' (cov ' + (cmp.upwind.coverage * 100).toFixed(0) + '%) · 풍하 ' +
  (cmp.downwind.pctOfTarget != null ? cmp.downwind.pctOfTarget.toFixed(1) + '%' : '–') +
  ' (cov ' + (cmp.downwind.coverage * 100).toFixed(0) + '%)');

/* ---------- 7) 자기 자신이 타깃이면 ~100% 안쪽 ---------- */
console.log('\n[7] 자기 세션을 타깃으로 — % of target 는 100% 이하여야 정상');
var selfTgt = An.buildTargetPolar([profGn], { basis: 'single-session' });
var selfCmp = An.computeTargetComparison(gn, gnW, selfTgt);
['upwind', 'downwind'].forEach(function (k) {
  var s = selfCmp[k];
  if (s.pctOfTarget == null) { console.log('      ' + k + ' 비교 구간 없음'); return; }
  check(k + ' — 자기 p95 대비 평균속도이므로 ≤ 101%',
    s.pctOfTarget <= 101, '값=' + s.pctOfTarget.toFixed(1) + '%');
  check(k + ' — 평균이므로 충분히 큼 (≥ 50%)',
    s.pctOfTarget >= 50, '값=' + s.pctOfTarget.toFixed(1) + '%');
});

/* ---------- 8) 회귀 — 기존 폴라·분석 파이프라인 무손상 ---------- */
console.log('\n[8] 회귀 — 기존 풍각 폴라·analyzeSession 무손상');
var aGn = An.analyzeSession(gn, gnW, {});
check('analyzeSession.polar 가 그대로 산출된다', !!aGn.polar);
check('analyzeSession.polar 에 port·starboard 가 유지된다',
  !!(aGn.polar.port && aGn.polar.starboard));
check('analyzeSession.polar 에 combined 가 추가됐다', !!aGn.polar.combined);
var aNoWind = An.analyzeSession(gn, null, {});
check('풍향 미설정 analyzeSession 통과 (polar=null)',
  aNoWind && aNoWind.polar == null);

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail === 0 ? 0 : 1);
