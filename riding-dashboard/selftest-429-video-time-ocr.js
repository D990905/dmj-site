/* ============================================================
 * selftest-429-video-time-ocr.js — §429 영상 녹화 시각 자동 감지 검증
 *
 * 실제 배포 코드(js/video-time-detect.js)를 그대로 require 해 순수 함수를
 * 검증한다. Tesseract·DOM·프레임 캡처는 브라우저 전용이라 preview 에서
 * 별도 end-to-end 검증(캔버스 시계 → OCR)한다. 여기서는 OCR 텍스트 →
 * 시각 추출(extractDateTime)과 시각 → 트랙 배치(resolveStartElapsed)의
 * 순수 로직만 검증한다.
 *
 *   실행:  cd riding-dashboard && node selftest-429-video-time-ocr.js
 * ============================================================ */
'use strict';

var VTD = require('./js/video-time-detect.js');
var extractDateTime = VTD._test.extractDateTime;
var resolveStartElapsed = VTD._test.resolveStartElapsed;

var pass = 0, fail = 0, lines = [];
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  lines.push((ok ? '  PASS ' : '  FAIL ') + name + (info ? '  · ' + info : ''));
}
function eq(name, got, want) {
  check(name, got === want, got === want ? '' : ('got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)));
}
function near(name, got, want, tol) {
  var ok = (got != null) && Math.abs(got - want) <= (tol == null ? 0.05 : tol);
  check(name, ok, ok ? '' : ('got ' + got + ' want ~' + want));
}

/* ---------- 1) extractDateTime — 날짜+시각 (medium) ---------- */
(function () {
  [
    ['ISO dash',   '2026-07-03 14:30:22'],
    ['slash',      '2026/07/03 14:30:22'],
    ['dot',        '2026.07.03 14:30:22'],
    ['T-sep',      '2026-07-03T14:30:22'],
    ['noisy OCR',  'SOG 24.1kt\n2026-07-03 14:30:22\nHR 148']
  ].forEach(function (c) {
    var h = extractDateTime(c[1]);
    check('datetime ' + c[0], !!h && h.kind === 'datetime' &&
      h.y === 2026 && h.mo === 7 && h.d === 3 && h.h === 14 && h.mi === 30 && h.s === 22,
      h ? JSON.stringify({ kind: h.kind, y: h.y, mo: h.mo, d: h.d, h: h.h, mi: h.mi, s: h.s }) : 'null');
  });
  /* 초 생략 datetime — hasSeconds=false 로 표시(rollover 정밀화 트리거) */
  var hns = extractDateTime('2026-07-03 14:30');
  check('datetime no-seconds', !!hns && hns.kind === 'datetime' && hns.s === 0 && hns.mi === 30, JSON.stringify(hns));
  check('datetime no-seconds hasSeconds=false', hns && hns.hasSeconds === false, JSON.stringify(hns && hns.hasSeconds));
  var hws = extractDateTime('2026-07-03 14:30:22');
  check('datetime with-seconds hasSeconds=true', hws && hws.hasSeconds === true, JSON.stringify(hws && hws.hasSeconds));
  /* 실제 Insta360 오버레이 포맷(공백 구분, 초 없음) */
  var hi = extractDateTime('2026/05/19 15:52');
  check('Insta360 fmt (minute only)', !!hi && hi.kind === 'datetime' && hi.mo === 5 && hi.d === 19 && hi.h === 15 && hi.mi === 52 && hi.hasSeconds === false, JSON.stringify(hi));
})();

/* ---------- 2) extractDateTime — 시각만 (low) ---------- */
(function () {
  var h1 = extractDateTime('14:30:22');
  check('clock HH:MM:SS', !!h1 && h1.kind === 'clock' && h1.h === 14 && h1.mi === 30 && h1.s === 22, JSON.stringify(h1));
  var h2 = extractDateTime('GoPro HERO\n12:05 speed 24kt');
  check('clock HH:MM (no sec)', !!h2 && h2.kind === 'clock' && h2.h === 12 && h2.mi === 5 && h2.s === 0, JSON.stringify(h2));
  /* 하단 오버레이 잡음 속 시각 */
  var h3 = extractDateTime('....  09:07:41  ....');
  check('clock in noise', !!h3 && h3.kind === 'clock' && h3.h === 9 && h3.mi === 7 && h3.s === 41, JSON.stringify(h3));
})();

/* ---------- 3) extractDateTime — 실패/방어 (none) ---------- */
(function () {
  eq('null input', extractDateTime(null), null);
  eq('empty', extractDateTime(''), null);
  eq('no time', extractDateTime('SOG 24.1 kt  HR 148 bpm'), null);
  eq('invalid clock only', extractDateTime('99:99:99'), null);
  /* 날짜는 무효(월13)여도 시각(14:30:22)이 유효하면 clock 으로 폴백 */
  var hb = extractDateTime('2026-13-40 14:30:22');
  check('bad-date falls to clock', !!hb && hb.kind === 'clock' && hb.h === 14, JSON.stringify(hb));
})();

/* ---------- 4) resolveStartElapsed — datetime → 절대 offset ---------- */
(function () {
  var sessionStart = new Date(2026, 6, 3, 14, 0, 0).getTime();      // 14:00:00
  var frameEpoch = new Date(2026, 6, 3, 14, 30, 22).getTime();     // 14:30:22
  var hit = { kind: 'datetime', epochMs: frameEpoch };
  var frameSec = 0.5;
  var res = resolveStartElapsed(hit, frameSec, sessionStart, null, 0);
  /* videoStart = frameEpoch - 0.5s; startElapsed = (videoStart - sessionStart)/1000 */
  var expected = (frameEpoch - 500 - sessionStart) / 1000;         // 1821.5
  check('datetime confidence', !!res && res.confidence === 'medium', res && res.confidence);
  near('datetime startElapsed', res && res.startElapsed, Math.round(expected * 10) / 10);
})();

/* ---------- 5) resolveStartElapsed — clock → parseClockToElapsed ---------- */
(function () {
  var sessionStart = new Date(2026, 6, 3, 14, 0, 0).getTime();
  /* fake clockToElapsed: "14:30:22" 시각 instant 은 세션 시작 +1822초로 가정 */
  function fakeClockToElapsed(str, se, cur) {
    return (str === '14:30:22') ? 1822 : null;
  }
  var hit = { kind: 'clock', h: 14, mi: 30, s: 22 };
  var res = resolveStartElapsed(hit, 2, sessionStart, fakeClockToElapsed, 0);
  /* startElapsed = elapsedOfFrame(1822) - frameSec(2) = 1820, confidence low */
  check('clock confidence', !!res && res.confidence === 'low', res && res.confidence);
  near('clock startElapsed', res && res.startElapsed, 1820);
  /* clockToElapsed 실패 시 null */
  var res2 = resolveStartElapsed(hit, 2, sessionStart, function () { return null; }, 0);
  eq('clock unresolvable → null', res2, null);
})();

/* ---------- 6) resolveStartElapsed — 방어 ---------- */
(function () {
  var hit = { kind: 'datetime', epochMs: Date.UTC(2026, 6, 3) };
  eq('no sessionStart → null', resolveStartElapsed(hit, 0, null, null, 0), null);
  eq('null hit → null', resolveStartElapsed(null, 0, 12345, null, 0), null);
})();

/* ---------- 결과 ---------- */
lines.forEach(function (l) { console.log(l); });
console.log('\n§429 video-time OCR:  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
