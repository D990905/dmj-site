/* ============================================================
 * selftest-420-ps-label.js — §420 Bug 1 P/S 라벨 swap fix 검증
 *
 * 옥대표님 verbatim 2026-06-12 (Vantage 비교):
 *   Vantage = Port upwind VMG 14.0 / Starboard 12.1 (Port 빠름)
 *   우리 (이전) = Port 9.8 / Starboard 13.3 (정반대 라벨)
 *   → swap fix
 *
 * 표준 sailing convention (Larsson 2022 ch.7 + ISAF Racing Rules):
 *   · Port tack = wind 가 보트 좌현(port side)에서 들어옴
 *     = heading 이 풍축 기준 시계방향 (angleDiff > 0)
 *   · Starboard tack = wind 가 보트 우현(starboard side)에서 들어옴
 *     = heading 이 풍축 기준 반시계방향 (angleDiff < 0)
 *
 *   실행:  node selftest-420-ps-label.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

/* analysis.js source — Timo swap 확인 */
var anSrc = fs.readFileSync(path.join(__dirname, 'js', 'analysis.js'), 'utf8');
var appSrc = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

/* §420 Bug 1 — 3 file 위치 swap 검증 */
check('analysis.js maneuverSide() angleDiff >= 0 → P',
  /angleDiff\(windDir,\s*m\.headingBefore\)\s*>=\s*0\s*\?\s*'P'\s*:\s*'S'/.test(anSrc),
  'Port = heading 시계방향 (Larsson 2022 ch.7)');

check('app.js sideShort() angleDiff >= 0 → P',
  /angleDiff\(state\.windDir,\s*heading\)\s*>=\s*0\s*\?\s*'P'\s*:\s*'S'/.test(appSrc),
  '동일 swap');

check('app.js sideLabel() angleDiff >= 0 → 포트(P)',
  /angleDiff\(state\.windDir,\s*heading\)\s*>=\s*0\s*\?\s*'포트\(P\)'\s*:\s*'스타보드\(S\)'/.test(appSrc),
  '한글 라벨 정정');

/* §420 DO_NOT_REVERT 주석 검증 */
check('analysis.js §420 DO_NOT_REVERT 주석 명시',
  /§420[\s\S]{0,600}DO_NOT_REVERT\s*§420/.test(anSrc),
  '회귀 방지');  /* §421: maneuverSide 주석이 435자 → window 400→600 (마커는 실재; HEAD부터 깨져 있던 검사) */

check('app.js §420 DO_NOT_REVERT 주석 명시',
  /§420[\s\S]{0,400}DO_NOT_REVERT\s*§420/.test(appSrc),
  '회귀 방지');

/* §420 logic 검증 — 옥대표님 세션 windDir=218° 시뮬 */
/* Port tack: 라이더 heading 248° (윙 좌현으로 풍 받음 = port)
 *   angleDiff(218, 248) = +30  → Port ✓
 * Starboard tack: heading 188° (윙 우현으로 풍)
 *   angleDiff(218, 188) = -30  → Starboard ✓
 */
function angleDiff(ref, target) {
  var d = (target - ref) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
function side(windDir, heading) {
  return angleDiff(windDir, heading) >= 0 ? 'P' : 'S';
}

check('Port tack: windDir 218, heading 248 (+30°) → P',
  side(218, 248) === 'P', 'angleDiff=+' + angleDiff(218, 248));
check('Starboard tack: windDir 218, heading 188 (-30°) → S',
  side(218, 188) === 'S', 'angleDiff=' + angleDiff(218, 188));

/* 풍하 시나리오 — heading 38° (downwind axis)
 * angleDiff(218, 38) = -180 → boundary case. ISAF: head-to-wind 또는
 * dead-downwind 는 tack 정의 외 (no tack). 본 fix 는 그대로 호환. */
check('Edge case (head-to-wind): windDir 218, heading 218 (0°) → P (>=0)',
  side(218, 218) === 'P', '경계 case = positive side');

/* 결과 */
console.log('\n' + '-'.repeat(40));
console.log('PASS:', pass, ' FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);
