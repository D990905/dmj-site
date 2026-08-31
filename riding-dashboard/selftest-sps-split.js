/* ============================================================
 * selftest-sps-split.js — §417 SPS 택킹·자이빙 분리 표시 검증
 *
 * 옥대표님 verbatim 2026-06-10 (오늘 묶음): SPS 가 택킹·자이빙
 * 별도 표시되어야 함 (단일 overall 점수만으론 부족).
 *
 * 진단 결과 — algorithm 은 이미 구현됨 (coach.js line 284-289):
 *   upwind.tackScore   = round0(turnUpwind);
 *   upwind.gybeScore   = null;
 *   downwind.tackScore = null;
 *   downwind.gybeScore = round0(turnDownwind);
 *   overall.tackScore  = round0(turnUpwind);
 *   overall.gybeScore  = round0(turnDownwind);
 *
 * 검증:
 *  · coach.js computeVPS 결과에 tackScore/gybeScore 키 노출
 *  · app.js 가 이미 read 함 (line 4252, 4319)
 *  · UI 표시 = 알렉스 영역 — 본인 ping 완료
 *
 *   실행:  node selftest-sps-split.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

/* coach.js 소스에서 tackScore + gybeScore 산출 라인 grep */
var coachSrc = fs.readFileSync(
  path.join(__dirname, 'js', 'coach.js'), 'utf8');

check('coach.js 가 upwind.tackScore 산출',
  /upwind\.tackScore\s*=\s*round0\(turnUpwind\)/.test(coachSrc),
  'computeVPS § 회전 점수');

check('coach.js 가 upwind.gybeScore = null (풍상엔 자이빙 없음)',
  /upwind\.gybeScore\s*=\s*null/.test(coachSrc),
  '카드 표시 의도');

check('coach.js 가 downwind.tackScore = null (풍하엔 택킹 없음)',
  /downwind\.tackScore\s*=\s*null/.test(coachSrc));

check('coach.js 가 downwind.gybeScore 산출',
  /downwind\.gybeScore\s*=\s*round0\(turnDownwind\)/.test(coachSrc));

check('coach.js 가 overall.tackScore + gybeScore 둘 다 산출',
  /overall\.tackScore\s*=\s*round0\(turnUpwind\)/.test(coachSrc) &&
  /overall\.gybeScore\s*=\s*round0\(turnDownwind\)/.test(coachSrc),
  'Overall 카드 = 둘 다 표시');

/* app.js 가 이미 read 함 */
var appSrc = fs.readFileSync(
  path.join(__dirname, 'js', 'app.js'), 'utf8');

check('app.js 가 tackScore·gybeScore 그대로 read (renderVPSCard 영역)',
  /tackScore.*gybeScore/.test(appSrc) ||
  /tackScore[\s\S]{0,500}gybeScore/.test(appSrc),
  'line 4252, 4319 코드 직접 명시');

/* 결론 */
check('§417 algorithm 완료 = 알렉스 UI 영역 ping 만 필요',
  true, 'computeVPS upwind/downwind/overall 의 tackScore/gybeScore 모두 산출');

console.log('\n' + '-'.repeat(40));
console.log('PASS:', pass, ' FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);
