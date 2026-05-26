/* ============================================================
 * selftest-skill-hr.js — 스킬-심박수 분석 self-test
 *
 * computeSkillHr — 회전(택킹·자이빙) 전후 심박을 '진입 전 → 기술 중
 * → 완료 후 회복' 세 국면으로 추적하는 분석을 번들 샘플 GPX 로
 * 검증한다. 의존성 0 — Node 내장 모듈만 사용한다.
 *
 *   실행:  node selftest-skill-hr.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * GPX 파싱은 selftest-hr.js 와 같은 경량 정규식 파서를 쓴다
 * (DOMParser 의존성 회피).
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
    var hM = inner.match(/<[A-Za-z0-9]*:?hr>([^<]+)<\/[A-Za-z0-9]*:?hr>/);
    var hv = hM ? parseFloat(hM[1]) : null;
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]),
      ele: eM ? parseFloat(eM[1]) : null,
      time: tM ? Date.parse(tM[1]) : null, speed: null,
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
    hasHR: withHR >= pts.length * 0.5, hrPointCount: withHR
  };
}
function loadSession(file) {
  var xml = fs.readFileSync(path.join(DIR, 'sample', file), 'utf8');
  return An.normalizeSession(parseGPX(xml));
}
/* 세션 풍향 자동 추정 — app.js 와 같은 경로(no-go + 회전 기하). */
function estimateWind(session) {
  var nogo = null, rot = null;
  try { nogo = An.estimateWindFromTrack(session); } catch (e) {}
  try { rot = An.estimateWindFromManeuvers(session); } catch (e) {}
  var ws = An.buildWindSources({ nogo: nogo, rotation: rot });
  if (ws && ws.recommended && ws.recommended.windDir != null) {
    return ws.recommended.windDir;
  }
  if (rot && rot.windDir != null) return rot.windDir;
  if (nogo && nogo.windDir != null) return nogo.windDir;
  return null;
}

/* --- 미니 테스트 러너 --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}

console.log('=== 스킬-심박수 분석 self-test ===\n');

/* ---------- 1) 송정(부산) — HR 포함, 풍향 확정 ---------- */
console.log('[1] 송정(부산) — 회전 전후 심박 3국면 추적');
var sj = loadSession('sample-songjeong-busan.gpx');
var windDir = estimateWind(sj);
check('풍향이 추정된다', windDir != null, 'windDir=' + windDir);
var a = An.analyzeSession(sj, windDir, {});
check('회전이 검출된다 (택킹·자이빙)',
  a.maneuverStats.tack + a.maneuverStats.gybe > 10,
  'tack=' + a.maneuverStats.tack + ' gybe=' + a.maneuverStats.gybe);

var sk = An.computeSkillHr(sj, a.maneuvers);
console.log('      cruiseHr=' + sk.cruiseHr + ' analyzed=' + sk.analyzedCount +
  ' recoveryIndex=' + sk.recoveryIndex + ' recovery.n=' + sk.recovery.n);
check('computeSkillHr 가 hasHR:true 를 반환한다', sk.hasHR === true);
check('순항 기준 심박이 생리적으로 합리적이다 (90~200 bpm)',
  sk.cruiseHr >= 90 && sk.cruiseHr <= 200, 'cruiseHr=' + sk.cruiseHr);
check('분석한 회전 수가 합리적이다 (검출 회전의 80% 이상)',
  sk.analyzedCount >= (a.maneuverStats.tack + a.maneuverStats.gybe) * 0.8,
  'analyzed=' + sk.analyzedCount);
check('perTurn 배열 길이 = analyzedCount',
  sk.perTurn.length === sk.analyzedCount);

/* ---------- 2) 회전별 3국면 무결성 ---------- */
console.log('\n[2] 회전별 — 진입 전·기술 중·완료 후 값 무결성');
var badEntry = 0, badPeak = 0, badRise = 0, badRecRate = 0;
sk.perTurn.forEach(function (p) {
  if (!(p.entryHr >= 60 && p.entryHr <= 230)) badEntry++;
  if (!(p.peakHr >= 60 && p.peakHr <= 230)) badPeak++;
  /* riseBpm = peakHr − cruiseHr 가 정의대로인지 */
  if (p.riseBpm !== p.peakHr - sk.cruiseHr) badRise++;
  /* 회복 집계 대상이면 회복 속도(bpm/분)가 반드시 있어야 한다 */
  if (p.recoveryAdequate && p.recoveryRateBpmMin == null) badRecRate++;
});
check('모든 회전 진입 전 심박이 생리적 범위 (60~230 bpm)', badEntry === 0,
  badEntry + '개 이탈');
check('모든 회전 기술 중 최고 심박이 생리적 범위 (60~230 bpm)', badPeak === 0,
  badPeak + '개 이탈');
check('순항 대비 상승(riseBpm) = 최고 − 순항 기준 (정의 일관)', badRise === 0,
  badRise + '개 불일치');
check('회복 집계 대상 회전은 회복 속도(bpm/분)를 모두 가진다', badRecRate === 0,
  badRecRate + '개 누락');
var allAdeqRose = sk.perTurn.every(function (p) {
  return !p.recoveryAdequate || p.riseVsEntry >= 2;
});
check('회복 집계 대상은 진입 직전보다 심박이 올랐던 회전만 (워밍업 배제)',
  allAdeqRose);

/* ---------- 3) 그룹 집계 ---------- */
console.log('\n[3] 유형×택 그룹 집계');
check('그룹이 1개 이상 만들어진다', sk.groups.length >= 1,
  '그룹 ' + sk.groups.length + '개');
var groupNSum = 0;
sk.groups.forEach(function (g) { groupNSum += g.n; });
check('그룹별 회전 수 합 = 분석한 회전 수', groupNSum === sk.analyzedCount,
  'groupNSum=' + groupNSum + ' analyzed=' + sk.analyzedCount);
check('풍향 확정 세션은 그룹이 택(포트/스타보드)으로 갈린다',
  sk.groups.some(function (g) { return g.side === 'P' || g.side === 'S'; }));
var typesOk = sk.groups.every(function (g) {
  return ['tack', 'gybe', 'turn'].indexOf(g.type) >= 0;
});
check('모든 그룹 type 이 tack/gybe/turn 중 하나다', typesOk);
console.log('      그룹: ' + sk.groups.map(function (g) {
  return g.label + '(n' + g.n + ')';
}).join(' · '));

/* ---------- 4) 최대 생리 반응 · 회복 지수 ---------- */
console.log('\n[4] 최대 생리 반응 · 세션 회복 지수');
check('biggest 가 그룹 중 순항 대비 상승 최대값과 일치한다',
  sk.biggest && sk.groups.every(function (g) {
    return g.riseBpm <= sk.biggest.riseBpm;
  }), sk.biggest ? (sk.biggest.label + ' +' + sk.biggest.riseBpm) : 'null');
check('회복 표본 수가 분석 회전 수를 넘지 않는다',
  sk.recovery.n >= 0 && sk.recovery.n <= sk.analyzedCount,
  'recovery.n=' + sk.recovery.n);
if (sk.recovery.n > 0) {
  check('세션 회복 지수(bpm/분)가 산출된다', sk.recoveryIndex != null);
  check('세션 회복 지수가 합리적 범위다 (-30~60 bpm/분)',
    sk.recoveryIndex > -30 && sk.recoveryIndex < 60,
    'recoveryIndex=' + sk.recoveryIndex);
  check('회복 평균 관찰 창이 최소 기준(20초) 이상이다',
    sk.recovery.avgWindowSec >= 20,
    'avgWindowSec=' + sk.recovery.avgWindowSec.toFixed(0));
} else {
  check('회복 표본이 없으면 회복 지수는 null', sk.recoveryIndex == null);
}

/* ---------- 5) 강릉 — HR 없는 GPX ---------- */
console.log('\n[5] 강릉 — HR 미기록 GPX, 스킬-심박수 분석 비활성');
var gn = loadSession('sample-ride-gangneung.gpx');
var gnA = An.analyzeSession(gn, estimateWind(gn), {});
var gnSk = An.computeSkillHr(gn, gnA.maneuvers);
check('HR 없는 세션은 computeSkillHr 가 hasHR:false 만 반환한다',
  gnSk.hasHR === false, 'hasHR=' + gnSk.hasHR);

/* ---------- 6) 풍향 미설정 — 회전이 단일 그룹(회전)으로 ---------- */
console.log('\n[6] 풍향 미설정 — 분류 불가 시 단일 회전 그룹');
var aNoWind = An.analyzeSession(sj, null, {});
var skNoWind = An.computeSkillHr(sj, aNoWind.maneuvers);
if (skNoWind.hasHR) {
  check('풍향 미설정 세션도 분석된다 (hasHR)', skNoWind.hasHR === true);
  check('풍향 미설정 시 그룹 type 이 turn 이고 택 분할이 없다',
    skNoWind.groups.every(function (g) {
      return g.type === 'turn' && g.side == null;
    }));
} else {
  check('풍향 미설정 시에도 함수가 안전하게 동작한다', true);
}

/* ---------- 7) 편집(trim) 후에도 동작 ---------- */
console.log('\n[7] 편집(trim) 세션 — 스킬-심박수 분석 동작');
var ed = An.applyEdits(sj, { trimStart: 1000, trimEnd: 3600 });
var edA = An.analyzeSession(ed, windDir, { fullSession: sj });
var edSk = An.computeSkillHr(ed, edA.maneuvers);
check('편집(trim) 세션에서도 computeSkillHr 가 동작한다',
  edSk.hasHR === true && edSk.analyzedCount > 0,
  'analyzed=' + edSk.analyzedCount);
check('편집 세션 회복 지수가 산출되거나(null 허용) 안전하다',
  edSk.recoveryIndex == null || isFinite(edSk.recoveryIndex));

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
