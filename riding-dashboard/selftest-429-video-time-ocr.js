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

/* minuteIndexOf 는 오버레이 벽시계를 로컬 시각으로 해석한다. 실 영상이
   KST 촬영이므로 로컬을 KST 로 고정해 절대 epoch 계산을 결정적으로 만든다. */
process.env.TZ = 'Asia/Seoul';

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

/* ---------- 6) resolveStartElapsed — 방어 + confidence 전달 ---------- */
(function () {
  var hit = { kind: 'datetime', epochMs: Date.UTC(2026, 6, 3) };
  eq('no sessionStart → null', resolveStartElapsed(hit, 0, null, null, 0), null);
  eq('null hit → null', resolveStartElapsed(null, 0, 12345, null, 0), null);
  /* precise(rollover) hit → confidence 'high' 가 그대로 전달 */
  var ph = { kind: 'datetime', epochMs: 1000000, confidence: 'high' };
  var pr = resolveStartElapsed(ph, 0, 0, null, 0);
  eq('precise hit confidence passthrough', pr && pr.confidence, 'high');
})();

/* ---------- 7) refineTransition — 분 전환 이분탐색 (실측 ground truth) ----------
   실 영상(Insta360, 439MB) 검증값: 영상 t=0 의 실제 벽시계 = 15:52:44.9 KST.
   → 15:52→15:53 전환 t≈15.1s, 15:53→15:54 전환 t≈75.1s (실측, ffmpeg+OCR).
   시뮬레이터 readKey(t) = 그 시각 프레임의 분 인덱스(절대). 전환이 정확히
   그 시각에 일어나도록 모델링해, 이분탐색이 t* 를 ±0.2s 로 수렴하는지,
   그리고 서로 다른 두 전환이 같은 영상 시작 시각을 역산하는지 확인한다. */
var refineTransition = VTD._test.refineTransition;
async function rolloverTests() {
  var VIDEO_START_WALL_SEC = 15 * 3600 + 52 * 60 + 44.9;   // 57164.9 (15:52:44.9)
  /* 절대 분 인덱스: floor((videoStartWall + t)/60). null 모델(물보라 프레임) 옵션 */
  function makeReader(nullAt) {
    return function (t) {
      if (nullAt && Math.abs(t - nullAt) < 0.05) return Promise.resolve(null);
      return Promise.resolve(Math.floor((VIDEO_START_WALL_SEC + t) / 60));
    };
  }
  var minA = Math.floor((VIDEO_START_WALL_SEC + 15.1) / 60);   // 953 (15:53)
  var minB = Math.floor((VIDEO_START_WALL_SEC + 75.1) / 60);   // 954 (15:54)

  /* 전환 A: 15:52→15:53, 코스 브래킷 [12,18] */
  var tA = await refineTransition(makeReader(), 12, 18, minA, 0.2, 14);
  near('rollover A t* ≈ 15.1s', tA, 15.1, 0.2);
  var startA = minA * 60 - tA;                    // 역산한 영상 시작 벽시계(초)
  near('rollover A → video start 15:52:44.9', startA, VIDEO_START_WALL_SEC, 0.2);

  /* 전환 B: 15:53→15:54, 코스 브래킷 [72,78] */
  var tB = await refineTransition(makeReader(), 72, 78, minB, 0.2, 14);
  near('rollover B t* ≈ 75.1s', tB, 75.1, 0.2);
  var startB = minB * 60 - tB;
  near('rollover B → video start 15:52:44.9', startB, VIDEO_START_WALL_SEC, 0.2);

  /* 내부 일관성: 두 전환이 같은 영상 시작(±0.2s) → 초 단위 정합 증명 */
  near('two flips agree on video start', startA, startB, 0.2);

  /* 못 읽는 프레임(물보라)이 탐색 구간에 있어도 수렴 */
  var tN = await refineTransition(makeReader(15.0625), 12, 18, minA, 0.2, 14);
  near('rollover tolerates unreadable frame', tN, 15.1, 0.35);

  /* minuteIndexOf: datetime 만 인덱스, clock 은 null */
  var mi = VTD._test.minuteIndexOf;
  check('minuteIndexOf datetime', mi(extractDateTime('2026/05/19 15:53')) === Math.floor(new Date(2026,4,19,15,53,0).getTime()/60000), '');
  eq('minuteIndexOf clock → null', mi(extractDateTime('15:53:00')), null);

  /* 실측 end-to-end 배치(TZ 무관 UTC 절대 epoch): 세션 시작 06:15:47Z(=15:15:47
     KST), 전환 순간의 벽시계 15:54:00 KST = 06:54:00Z, frameSec=tB(≈75.1).
     → video start = 06:54:00Z - 75.1s = 06:52:44.9Z
     → clip startElapsed = (06:52:44.9 - 06:15:47) = 2217.9s, confidence high */
  var sessionStart = Date.UTC(2026, 4, 19, 6, 15, 47);
  var newMinuteEpoch = Date.UTC(2026, 4, 19, 6, 54, 0);            // 15:54:00 KST
  var preciseHit = { kind: 'datetime', epochMs: newMinuteEpoch, frameSec: tB, confidence: 'high' };
  var placed = resolveStartElapsed(preciseHit, preciseHit.frameSec, sessionStart, null, 0);
  near('end-to-end precise startElapsed ≈ 2217.9s', placed && placed.startElapsed, 2217.9, 0.3);
  eq('end-to-end confidence high', placed && placed.confidence, 'high');

  /* ---------- 8) rolloverRefine — 전체 오케스트레이션(scan+bracket+binary) ----------
     실 <video>/OCR 대신 readAt 를 주입해 실 영상 타이밍(15:52:44.9 시작,
     15:52→15:53 @15.1s, 15:53→15:54 @75.1s)을 재현. rolloverRefine 이 실제로
     경계를 찾아 초 단위로 정밀화하는지 product 함수 그대로 검증. 물보라
     프레임(null)도 섞어 견고성 확인. */
  function realFrameReader(nullTimes) {
    return function (t) {
      if (nullTimes && nullTimes.some(function (n) { return Math.abs(t - n) < 0.2; })) {
        return Promise.resolve(null);          // 못 읽는 프레임(모션·물보라)
      }
      var wall = VIDEO_START_WALL_SEC + t;     // 초-of-day
      var hh = Math.floor(wall / 3600) % 24, mm = Math.floor(wall / 60) % 60;
      return Promise.resolve({ kind: 'datetime', y: 2026, mo: 5, d: 19, h: hh, mi: mm, s: 0, hasSeconds: false });
    };
  }
  var anchor = { kind: 'datetime', y: 2026, mo: 5, d: 19, h: 15, mi: 52, s: 0, hasSeconds: false, frameSec: 0.5 };
  var fakeVideo = { duration: 132.2 };

  var ref = await VTD.rolloverRefine(fakeVideo, anchor,
    { duration: 132.2, readAt: realFrameReader([17, 108]), rolloverStep: 4, rolloverTol: 0.2 });
  check('rolloverRefine returns precise hit', !!ref && ref.method === 'ocr-rollover' && ref.precise === true, JSON.stringify(ref && { method: ref.method, frameSec: ref.frameSec }));
  near('rolloverRefine t* (first flip) ≈ 15.1s', ref && ref.frameSec, 15.1, 0.25);
  /* 그 hit → 세션 배치: 영상 시작 15:52:44.9 → startElapsed 2217.9s */
  var sessK = Date.UTC(2026, 4, 19, 6, 15, 47);
  var rp = resolveStartElapsed(ref, ref.frameSec, sessK, null, 0);
  near('rolloverRefine → startElapsed 2217.9s', rp && rp.startElapsed, 2217.9, 0.3);
  eq('rolloverRefine confidence high', rp && rp.confidence, 'high');

  /* 짧은 클립(경계 없음, 한 분 내에서 끝남) → 정밀화 불가 → null */
  var shortRef = await VTD.rolloverRefine({ duration: 8 }, anchor,
    { duration: 8, readAt: realFrameReader(), rolloverStep: 4 });
  eq('rolloverRefine no-boundary → null', shortRef, null);
}

/* ---------- 결과 ---------- */
rolloverTests().then(function () {
  lines.forEach(function (l) { console.log(l); });
  console.log('\n§429 video-time OCR:  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}, function (e) {
  console.log('rollover tests threw:', e && e.stack || e);
  process.exit(1);
});
