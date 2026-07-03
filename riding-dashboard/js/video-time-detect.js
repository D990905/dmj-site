/* ============================================================
 * video-time-detect.js — 영상 녹화 시각 자동 감지 (§429)
 *
 *  라이딩 리플레이에서 영상과 GPX 트랙의 시간을 자동으로 맞추기
 *  위해, 영상의 "실제 녹화 시각"을 2단계 우선순위로 알아낸다.
 *
 *   1순위) 파일 메타데이터 — MP4/MOV 컨테이너의 녹화 시각
 *          (moov▸mvhd creation_time · QuickTime creationdate 등).
 *          → replay.js 가 업로드 시 이미 chunk 단위로 파싱하므로,
 *            여기서는 그 결과를 그대로 신뢰한다(중복 파싱 회피).
 *
 *   2순위) 화면 안 시각 OCR — 액션캠·GoPro 오버레이 시계
 *          (HH:MM:SS 또는 YYYY-MM-DD HH:MM:SS)를 Tesseract.js 로
 *          브라우저 안에서 읽는다. 메타데이터가 없거나 손상됐을 때만.
 *
 * ── 설계 결정 (옥대표님 §429 요구, Alex 2026-07-03) ──────────────
 *
 *  · MP4 파싱: MP4Box.js 대신 replay.js 의 기존 chunked 파서 재사용.
 *      이유 (a) replay.readVideoMeta 는 moov 와 head/tail 청크만 읽어
 *      500MB+ 영상도 통째로 메모리에 올리지 않는다(freeze 없음).
 *      MP4Box.js 는 전체/스트리밍 셋업이 필요하고 이 로직을 중복시킨다.
 *      (b) 무거운 CDN 의존 + 번들 증가 회피. → readMP4Metadata 는
 *      RDReplay 가 노출한 순수 parseMp4Meta 로 위임한다.
 *
 *  · OCR 라이브러리: Tesseract.js v5 (CDN, lazy-load). 사용자가 실제로
 *      OCR 를 호출할 때만 로드 → 첫 화면 번들 비용 0.
 *
 *  · 프레임 offset·재시도: 기본 [0.5, 1, 2, 4, 8]초. 첫 프레임(0.5s)은
 *      영상 맨 앞 검은 화면/페이드를 피하려 살짝 뒤. 오버레이 시계가
 *      한 프레임이라도 잡히면 즉시 반환. 각 프레임은 (전체 → 하단 밴드)
 *      순으로 최대 2회 OCR — 대부분 액션캠 시계가 하단/모서리라 하단
 *      크롭이 명중률을 크게 올린다. 최대 OCR 호출은 maxOcrCalls(기본 8)로
 *      상한 → 최악에도 UI 가 오래 멈추지 않는다.
 *
 *  · confidence 정의:
 *      high   = 파일 메타데이터(정확·타임존 포함 가능). replay 가 부여.
 *      medium = OCR 로 날짜+시각(YYYY-MM-DD HH:MM:SS) 전체를 읽음.
 *      low    = OCR 로 시각(HH:MM:SS)만 읽음 → 날짜는 트랙 세션 날짜로 보완.
 *      none   = 아무것도 못 읽음 → 사용자 수동 입력.
 *
 *  · 자동 감지 결과는 절대 무조건 적용하지 않는다 — replay 가 결과를
 *      싱크 패널에 표시하고, 사용자가 확인·미세조정할 수 있게 남긴다.
 *
 *  · 영상은 서버로 전송하지 않는다(옥대표님 lock). 모든 OCR 는
 *      브라우저 안에서만 수행되고, 파일은 read-only 로만 접근한다.
 *
 *  브라우저:  VideoTimeDetect.detectRecordingTime(file, opts)
 *             VideoTimeDetect.ocrFrameTime(urlOrFile, opts)
 *  Node 테스트: require('./video-time-detect.js')._test 의 순수 함수.
 * ============================================================ */
(function (global) {
  'use strict';

  var TESS_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  /* 시계·날짜 오버레이는 숫자와 구분자뿐 — whitelist 로 인식 정밀도↑ */
  var CHAR_WHITELIST = '0123456789:-/. T';
  /* Page-seg mode 11 = SPARSE_TEXT: 프레임 어디에 흩어져 있든 텍스트를
     최대한 찾는다. 액션캠 프레임은 속도·심박 등 HUD 요소 사이에 시계가
     박혀 있어 sparse 가 가장 안정적이다(preview 검증 2026-07-03: 잡다한
     HUD 프레임은 3·11 모두 인식, 고립된 짧은 시계는 하단 밴드 크롭이
     구제). 단독으로 큰 빈 프레임 한가운데 놓인 짧은 시계만 놓칠 수 있어,
     ocrFrameTime 이 '하단 밴드'를 먼저 시도해 그 경우를 덮는다. */
  var DEFAULT_PSM = '11';

  /* ============================================================
   * 1) 순수 함수 — OCR 텍스트에서 날짜/시각 추출 (Node self-test)
   * ============================================================ */

  /* 두 자리 정수 범위 검증 */
  function inRange(v, lo, hi) { return v >= lo && v <= hi; }

  /* OCR 로 읽은 임의 텍스트에서 촬영 시각을 추출한다.
     우선 "날짜+시각"(연도 20xx 로 시작) 을 찾고, 없으면 "시각"만 찾는다.
     반환:
       { kind:'datetime', y,mo,d,h,mi,s, epochMs, raw }  (medium)
       { kind:'clock',    h,mi,s, raw }                   (low)
       null (아무 것도 못 읽음)
     epochMs 는 날짜+시각일 때만 계산(로컬 시각으로 해석). 시각만인 경우
     날짜가 없어 epoch 를 만들 수 없으므로 caller(replay) 가 트랙 세션
     날짜로 보완한다. */
  function extractDateTime(text) {
    if (text == null) return null;
    var s = String(text);

    /* --- 1) 날짜 + 시각 --- 연·월·일 구분자는 - / . 공백 모두 허용,
       날짜와 시각 사이는 'T'·공백·쉼표 등 비숫자 1~3자 허용. OCR 노이즈로
       한 줄에 붙거나 개행될 수 있어 [\s,T]* 로 느슨하게 잇는다. */
    var reDT = /(20\d{2})[-/. ](\d{1,2})[-/. ](\d{1,2})[\sT,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
    var m;
    while ((m = reDT.exec(s)) !== null) {
      var y = +m[1], mo = +m[2], d = +m[3];
      var h = +m[4], mi = +m[5], se = (m[6] != null) ? +m[6] : 0;
      if (inRange(mo, 1, 12) && inRange(d, 1, 31) &&
          inRange(h, 0, 23) && inRange(mi, 0, 59) && inRange(se, 0, 59)) {
        var epochMs = new Date(y, mo - 1, d, h, mi, se).getTime();
        if (isFinite(epochMs)) {
          return { kind: 'datetime', y: y, mo: mo, d: d, h: h, mi: mi, s: se,
            epochMs: epochMs, hasSeconds: (m[6] != null), raw: m[0] };
        }
      }
    }

    /* --- 2) 시각만 --- 그럴듯한 첫 HH:MM(:SS) 를 고른다. 24시간제 우선,
       초는 선택. 분·초가 유효 범위여야 하고 시는 0~29 까지 허용(오전 시각의
       OCR 노이즈 여유) 후 0~23 로 재검증. */
    var reClk = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
    while ((m = reClk.exec(s)) !== null) {
      var ch = +m[1], cmi = +m[2], cse = (m[3] != null) ? +m[3] : 0;
      if (inRange(ch, 0, 23) && inRange(cmi, 0, 59) && inRange(cse, 0, 59)) {
        return { kind: 'clock', h: ch, mi: cmi, s: cse, hasSeconds: (m[3] != null), raw: m[0] };
      }
    }
    return null;
  }

  /* OCR hit 을 트랙 배치 startElapsed(데이터 경과초)로 변환.
       hit          — extractDateTime 결과
       frameSec     — 그 프레임의 영상 시각(초)
       sessionStart — 데이터 세션 시작 epoch(ms), 절대시각 없으면 null
       curElapsed   — 현재 클립 배치값(자정 넘는 시각 해석 시 가까운 날 선택)
     반환 { startElapsed, confidence } 또는 null.
     · datetime: frameEpoch = hit.epochMs → 영상 t=0 의 epoch = frameEpoch
       - frameSec*1000. startElapsed = (그 epoch - sessionStart)/1000.
     · clock: caller 가 clockToElapsed(=parseClockToElapsed) 로 시각 instant 의
       데이터 경과초(elapsedOfFrame)를 구해 넘겨주면 startElapsed =
       elapsedOfFrame - frameSec. */
  function resolveStartElapsed(hit, frameSec, sessionStart, clockToElapsed, curElapsed) {
    if (!hit || sessionStart == null || !isFinite(sessionStart)) return null;
    frameSec = frameSec || 0;
    if (hit.kind === 'datetime') {
      var videoStartEpoch = hit.epochMs - frameSec * 1000;
      var se = (videoStartEpoch - sessionStart) / 1000;
      return { startElapsed: Math.round(se * 10) / 10, confidence: hit.confidence || 'medium' };
    }
    if (hit.kind === 'clock' && typeof clockToElapsed === 'function') {
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var clockStr = pad(hit.h) + ':' + pad(hit.mi) + ':' + pad(hit.s);
      var elapsedOfFrame = clockToElapsed(clockStr, sessionStart, curElapsed);
      if (elapsedOfFrame == null || !isFinite(elapsedOfFrame)) return null;
      var st = elapsedOfFrame - frameSec;
      return { startElapsed: Math.round(st * 10) / 10, confidence: hit.confidence || 'low' };
    }
    return null;
  }

  /* ============================================================
   * 2) Tesseract lazy-load
   * ============================================================ */
  var _tessPromise = null;
  function loadTesseract() {
    if (typeof global.Tesseract !== 'undefined') return Promise.resolve(global.Tesseract);
    if (_tessPromise) return _tessPromise;
    _tessPromise = new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') { reject(new Error('no DOM')); return; }
      var sc = document.createElement('script');
      sc.src = TESS_CDN;
      sc.async = true;
      sc.onload = function () {
        if (typeof global.Tesseract !== 'undefined') resolve(global.Tesseract);
        else reject(new Error('Tesseract failed to initialise'));
      };
      sc.onerror = function () {
        _tessPromise = null;
        reject(new Error('Failed to load Tesseract.js from CDN'));
      };
      document.head.appendChild(sc);
    });
    return _tessPromise;
  }

  /* ============================================================
   * 3) 캔버스/이미지 OCR
   * ============================================================ */
  /* 한 캔버스(또는 이미지)를 OCR 해 인식 텍스트를 돌려준다. digit·구분자
     whitelist 로 정밀도를 높인다. 실패 시 빈 문자열. */
  function ocrImage(source, opts) {
    opts = opts || {};
    return loadTesseract().then(function (Tesseract) {
      return Tesseract.recognize(source, opts.lang || 'eng', {
        tessedit_char_whitelist: opts.whitelist || CHAR_WHITELIST,
        tessedit_pageseg_mode: opts.psm || DEFAULT_PSM
      });
    }).then(function (res) {
      return (res && res.data && res.data.text) ? res.data.text : '';
    });
  }

  /* ============================================================
   * 4) 영상 프레임 캡처 + OCR (Priority 2)
   * ============================================================ */
  function nextFrameDelay() {
    return new Promise(function (r) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { r(); });
      else setTimeout(r, 32);
    });
  }
  /* video 를 원하는 시각으로 seek 하고 'seeked' 를 기다린다(타임아웃 보호). */
  function seekTo(video, t) {
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (done) return; done = true; cleanup(); resolve(); }
      function cleanup() {
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timer);
      }
      function onSeeked() { nextFrameDelay().then(fin); }   // 디코드 후 1프레임 여유
      video.addEventListener('seeked', onSeeked);
      var timer = setTimeout(fin, 4000);
      try { video.currentTime = t; } catch (e) { fin(); }
    });
  }
  /* video 현재 프레임을 캔버스에 그린다. 작은 오버레이 글자 인식을 위해
     너무 작으면 확대, 너무 크면 축소해 가로 targetW 근처로 맞춘다.
     region: 'full' | 'bottom' | 'top' — 시계가 보통 하단/상단 밴드라
     밴드만 크롭하면 노이즈가 줄고 글자가 커져 명중률↑. */
  function drawFrame(video, region, targetW) {
    var vw = video.videoWidth || 0, vh = video.videoHeight || 0;
    if (!vw || !vh) return null;
    var sx = 0, sy = 0, sw = vw, sh = vh;
    if (region === 'bottom') { sy = Math.floor(vh * 0.66); sh = vh - sy; }
    else if (region === 'top') { sh = Math.ceil(vh * 0.34); }
    targetW = targetW || 1280;
    var scale = targetW / sw;
    if (scale > 2.5) scale = 2.5;          // 과확대 방지
    if (scale > 1 && sw >= 960) scale = 1; // 이미 충분히 크면 그대로
    var cw = Math.max(1, Math.round(sw * scale));
    var ch = Math.max(1, Math.round(sh * scale));
    var canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
    return canvas;
  }

  /* urlOrFile 로부터 오프스크린 <video> 를 만들어 여러 프레임을 캡처·OCR
     하고, 화면 안 시각을 처음 읽어낸 결과를 반환한다.
       opts.frames       — 시도할 영상 시각(초) 배열. 기본 [0.5,1,2,4,8]
       opts.regions      — 프레임당 OCR 영역 순서. 기본 ['bottom','full']
         (하단 밴드를 먼저 — 고립된 시계도 밴드 크롭이면 잡히고 더 빠름)
       opts.maxOcrCalls  — 총 OCR 호출 상한. 기본 8
       opts.onProgress   — (msg, frac) 진행 콜백
     반환 (Promise):
       { kind, ..., frameSec, rawText }  또는  null (감지 실패). */
  function ocrFrameTime(urlOrFile, opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return Promise.resolve(null);
    var frames = opts.frames || [0.5, 1, 2, 4, 8];
    var regions = opts.regions || ['bottom', 'full'];
    var maxCalls = opts.maxOcrCalls || 8;
    var onProgress = opts.onProgress || function () {};

    var ownUrl = (typeof urlOrFile !== 'string');
    var url = ownUrl ? URL.createObjectURL(urlOrFile) : urlOrFile;
    var video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = url;

    function cleanup() {
      try { video.removeAttribute('src'); video.load(); } catch (e) {}
      if (ownUrl) { try { URL.revokeObjectURL(url); } catch (e) {} }
    }

    return new Promise(function (resolve) {
      var settled = false;
      function finish(val) { if (settled) return; settled = true; cleanup(); resolve(val); }

      var metaTimer = setTimeout(function () { finish(null); }, 15000);
      function onReady() {
        clearTimeout(metaTimer);
        run().then(finish, function () { finish(null); });
      }
      if (video.readyState >= 1) onReady();
      else {
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('error', function () { clearTimeout(metaTimer); finish(null); }, { once: true });
      }

      function run() {
        var dur = video.duration;
        var fs = frames.filter(function (t) { return !isFinite(dur) || dur <= 0 || t < dur; });
        if (!fs.length) fs = [0];
        var calls = 0;
        var idx = 0;
        function nextFrame() {
          if (idx >= fs.length) return Promise.resolve(null);
          var t = fs[idx++];
          onProgress('Reading frame at ' + t.toFixed(1) + 's…',
            Math.min(0.95, calls / maxCalls));
          return seekTo(video, t).then(function () {
            return tryRegions(t, 0);
          }).then(function (hit) {
            if (hit) return hit;
            return nextFrame();
          });
        }
        function tryRegions(t, ri) {
          if (ri >= regions.length || calls >= maxCalls) return Promise.resolve(null);
          var canvas = drawFrame(video, regions[ri], opts.targetW);
          if (!canvas) return tryRegions(t, ri + 1);
          calls++;
          return ocrImage(canvas, opts).then(function (text) {
            var hit = extractDateTime(text);
            if (hit) { hit.frameSec = t; hit.rawText = text; return hit; }
            return tryRegions(t, ri + 1);
          }, function () { return tryRegions(t, ri + 1); });
        }
        return nextFrame();
      }
    });
  }

  /* ============================================================
   * 4b) 분 전환(rollover) 정밀화 — 초 없는 오버레이도 초 단위 정합 (§429b)
   * ============================================================
     오버레이가 "분"까지만 표시해도(예: Insta360 "2026/05/19 15:52", 초 없음)
     화면의 분이 바뀌는 순간은 정확히 그 분의 :00초다. 그 전환이 일어나는
     영상 시각 t* 를 이분탐색으로 찾으면, t* 의 실제 벽시계 = 새 분:00 →
     영상 t=0 의 절대시각을 초 단위로 역산한다. 트랙 데이터는 초 단위라
     이렇게 하면 자동 정합 오차가 ±1초 수준으로 줄어든다(옥대표 2026-07-03:
     "트랙은 초단위, 영상도 분 바뀌는 시점이 있으니 가능하게").
     실측 검증: 이 방식이 한 클립의 서로 다른 두 전환에서 동일한 영상 시작
     시각(±0.1s)을 역산 → 내부 일관성으로 정확도 확인. */

  /* 오프스크린 <video> 를 연다(File/blob 또는 URL 문자열 공통).
     resolve { video, cleanup }. blob 이면 object URL 을 만들고 cleanup 이 해제. */
  function openVideo(source) {
    var ownUrl = (typeof source !== 'string');
    var url = ownUrl ? URL.createObjectURL(source) : source;
    var video = document.createElement('video');
    video.muted = true; video.preload = 'auto';
    video.playsInline = true; video.crossOrigin = 'anonymous';
    video.src = url;
    function cleanup() {
      try { video.removeAttribute('src'); video.load(); } catch (e) {}
      if (ownUrl) { try { URL.revokeObjectURL(url); } catch (e) {} }
    }
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () { cleanup(); reject(new Error('video meta timeout')); }, 15000);
      function ready() { clearTimeout(to); resolve({ video: video, cleanup: cleanup }); }
      if (video.readyState >= 1) ready();
      else {
        video.addEventListener('loadeddata', ready, { once: true });
        video.addEventListener('error', function () {
          clearTimeout(to); cleanup(); reject(new Error('video load error'));
        }, { once: true });
      }
    });
  }

  /* 영상시각 t 의 화면 시각을 읽는다(하단밴드→전체 순). hit(frameSec 포함) 또는 null */
  function readClockAt(video, t, opts) {
    var regions = (opts && opts.regions) || ['bottom', 'full'];
    return seekTo(video, t).then(function () {
      return (function tryR(ri) {
        if (ri >= regions.length) return Promise.resolve(null);
        var canvas = drawFrame(video, regions[ri], opts && opts.targetW);
        if (!canvas) return tryR(ri + 1);
        return ocrImage(canvas, opts || {}).then(function (text) {
          var hit = extractDateTime(text);
          if (hit) { hit.frameSec = t; hit.rawText = text; return hit; }
          return tryR(ri + 1);
        }, function () { return tryR(ri + 1); });
      })(0);
    });
  }

  /* datetime hit → 표시된 '분'의 절대 인덱스(60초 단위 정수). 그 외 null.
     (rollover 정밀화는 절대 날짜가 있는 datetime 오버레이에서만 안전) */
  function minuteIndexOf(hit) {
    if (!hit || hit.kind !== 'datetime') return null;
    var ms = new Date(hit.y, hit.mo - 1, hit.d, hit.h, hit.mi, 0).getTime();
    return isFinite(ms) ? Math.floor(ms / 60000) : null;
  }

  /* 순수: 브래킷 (loT[분=hiKey-1], hiT[분=hiKey]) 사이 전환 시각을 이분탐색.
     readKey(t) → Promise<int|null> (그 시각 프레임의 분 인덱스, 못 읽으면 null).
     반환: 전환 순간의 추정 영상시각 t* (loT<t*≤hiT, 오차 ≤ tol/2).
     못 읽는 프레임(모션블러·물보라)은 약간 옆으로 재시도, 그래도 안 되면
     안전하게 현재 구간 중앙을 반환한다. */
  function refineTransition(readKey, loT, hiT, hiKey, tol, maxIter) {
    tol = tol || 0.2; maxIter = maxIter || 14;
    var iter = 0;
    function step() {
      if (hiT - loT <= tol || iter >= maxIter) {
        return Promise.resolve((loT + hiT) / 2);
      }
      iter++;
      var mid = (loT + hiT) / 2;
      return readKey(mid).then(function (k) {
        if (k == null) {
          return readKey(Math.min(hiT - 1e-3, mid + tol / 2)).then(function (k2) {
            if (k2 == null) { return (loT + hiT) / 2; }   // 못 읽음 — 중앙값으로 종료
            if (k2 >= hiKey) hiT = mid; else loT = mid;
            return step();
          });
        }
        if (k >= hiKey) hiT = mid; else loT = mid;
        return step();
      });
    }
    return step();
  }

  /* 열린 video 에서 anchor(분단위 datetime hit)로부터 분 경계를 찾아 이분탐색
     으로 전환시각을 구하고, 초 단위 정밀 hit 를 반환한다. 경계를 못 찾으면
     (클립이 한 분 안에서 끝남) null. */
  function rolloverRefine(video, anchor, opts) {
    opts = opts || {};
    var onP = opts.onProgress || function () {};
    var dur = (video && video.duration) || opts.duration || 0;
    var loKey = minuteIndexOf(anchor);
    if (loKey == null) return Promise.resolve(null);
    var step = opts.rolloverStep || 4;
    /* 프레임 시각 읽기 — 기본은 실제 <video> OCR. opts.readAt 로 주입하면
       (Node self-test 등) 실제 seek/OCR 없이 오케스트레이션만 검증 가능. */
    var readAt = opts.readAt || function (t) { return readClockAt(video, t, opts); };

    /* 정방향으로 첫 분 경계 탐색: loT(=마지막 loKey 프레임), hiT(첫 loKey+ 프레임) */
    function scanFwd() {
      var loT = anchor.frameSec, t = anchor.frameSec, guard = 0;
      function nx() {
        if (t >= dur - 0.05 || guard++ > 60) return Promise.resolve(null);
        t = Math.min(dur - 0.05, t + step);
        onP('Finding minute change… ' + t.toFixed(0) + 's');
        return readAt(t).then(function (h) {
          var k = minuteIndexOf(h);
          if (k == null) return nx();
          if (k === loKey) { loT = t; return nx(); }
          if (k > loKey) return { loT: loT, hiT: t, hiKey: k };
          return nx();                       // k<loKey (뒤로 감) — 무시
        });
      }
      return nx();
    }
    /* 역방향(클립이 anchor 분에서 끝나 정방향 경계가 없을 때) */
    function scanBack() {
      var hiT = anchor.frameSec, t = anchor.frameSec, guard = 0;
      function pv() {
        if (t <= 0.05 || guard++ > 60) return Promise.resolve(null);
        t = Math.max(0.05, t - step);
        onP('Finding minute change… ' + t.toFixed(0) + 's');
        return readAt(t).then(function (h) {
          var k = minuteIndexOf(h);
          if (k == null) return pv();
          if (k === loKey) { hiT = t; return pv(); }
          if (k < loKey) return { loT: t, hiT: hiT, hiKey: loKey };
          return pv();
        });
      }
      return pv();
    }

    return scanFwd().then(function (br) {
      if (br) return br;
      return scanBack();
    }).then(function (br) {
      if (!br) return null;                  // 경계 없음 → 정밀화 불가
      var readKey = function (tt) { return readAt(tt).then(minuteIndexOf); };
      onP('Pinning the exact flip…');
      return refineTransition(readKey, br.loT, br.hiT, br.hiKey,
        opts.rolloverTol || 0.2, opts.rolloverMaxIter || 14).then(function (tStar) {
        var wallMs = br.hiKey * 60000;       // 전환 순간의 벽시계 = 새 분:00
        return {
          kind: 'datetime', epochMs: wallMs, frameSec: tStar, s: 0,
          hasSeconds: true, precise: true, confidence: 'high', method: 'ocr-rollover',
          rollover: { loT: br.loT, hiT: br.hiT, tStar: tStar, newMinuteEpoch: wallMs }
        };
      });
    });
  }

  /* 영상 시작 시각 감지 오케스트레이터 — anchor 탐색 → (초 있으면 그대로 /
     초 없는 datetime 이면 rollover 정밀화 / 그 외 분단위 fallback). 열린 video
     하나로 처리하고 정리한다. 반환 Promise<hit|null> (hit 은 resolveStartElapsed
     이 소비, confidence·method 포함). */
  function detectVideoStart(source, opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return Promise.resolve(null);
    var frames = opts.frames || [0.5, 1, 2, 4, 8];
    var o = {};
    for (var k in opts) o[k] = opts[k];
    o.regions = opts.regions || ['bottom', 'full'];
    return openVideo(source).then(function (ctx) {
      var video = ctx.video;
      function findAnchor(i) {
        if (i >= frames.length) return Promise.resolve(null);
        var t = frames[i];
        if (video.duration && t >= video.duration) return findAnchor(i + 1);
        if (o.onProgress) o.onProgress('Reading frame ' + t.toFixed(1) + 's…');
        return readClockAt(video, t, o).then(function (h) { return h || findAnchor(i + 1); });
      }
      return findAnchor(0).then(function (anchor) {
        if (!anchor) return null;
        if (anchor.hasSeconds) {
          anchor.confidence = (anchor.kind === 'datetime') ? 'medium' : 'low';
          anchor.method = 'ocr';
          return anchor;
        }
        if (anchor.kind === 'datetime') {
          return rolloverRefine(video, anchor, o).then(function (ref) {
            if (ref) return ref;
            anchor.confidence = 'medium'; anchor.method = 'ocr-minute';  // 분 정밀도만
            return anchor;
          });
        }
        anchor.confidence = 'low'; anchor.method = 'ocr-minute-clock';
        return anchor;
      }).then(function (res) { ctx.cleanup(); return res; },
        function (e) { ctx.cleanup(); throw e; });
    }, function () { return null; });
  }

  /* ============================================================
   * 5) 오케스트레이터 — 메타데이터 → OCR → 수동 (spec §B 형태)
   * ============================================================ */
  /* 파일 메타데이터의 녹화 시각(ms) 을 얻는다. replay.js 가 노출한 순수
     parseMp4Meta 로 위임 — moov 를 담은 청크만 읽어 큰 파일도 안전.
     반환 Promise<number|null> (epoch ms). */
  function readMP4Metadata(file) {
    if (!file || typeof file.slice !== 'function') return Promise.resolve(null);
    var RD = global.RDReplay;
    var parse = RD && RD._test && RD._test.parseMp4Meta;
    if (!parse) return Promise.resolve(null);
    /* 최상위 박스를 따라가 moov 를 찾아 그 바이트만 읽는다. */
    var size = file.size || 0;
    if (!size) return Promise.resolve(null);
    var pos = 0;
    function readU32(u8, o) {
      return (u8[o] * 16777216) + (u8[o + 1] << 16) + (u8[o + 2] << 8) + u8[o + 3];
    }
    function walk() {
      if (pos + 8 > size) return Promise.resolve(null);
      return file.slice(pos, Math.min(pos + 16, size)).arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf);
        if (u8.length < 8) return null;
        var bsz = readU32(u8, 0);
        var type = String.fromCharCode(u8[4], u8[5], u8[6], u8[7]);
        var hdr = 8;
        if (bsz === 1) { bsz = readU32(u8, 8) * 4294967296 + readU32(u8, 12); hdr = 16; }
        else if (bsz === 0) { bsz = size - pos; }
        if (bsz < hdr) return null;
        if (type === 'moov') {
          var readLen = Math.min(bsz, 48 * 1024 * 1024);
          return file.slice(pos, pos + readLen).arrayBuffer().then(function (mbuf) {
            var meta = parse(new Uint8Array(mbuf));
            if (!meta) return null;
            if (meta.creationDateMs != null) return meta.creationDateMs;
            if (meta.creationMs != null) return meta.creationMs;
            return null;
          });
        }
        pos += bsz;
        return walk();
      })['catch'](function () { return null; });
    }
    return walk()['catch'](function () { return null; });
  }

  /* 스펙 §B 오케스트레이터. 메타데이터 → OCR → 수동 순으로 시도.
     반환 Promise<{ source, time, confidence, ... }>. */
  function detectRecordingTime(videoFile, opts) {
    opts = opts || {};
    return readMP4Metadata(videoFile).then(function (metaMs) {
      if (metaMs != null && isFinite(metaMs)) {
        return { source: 'metadata', time: metaMs, confidence: 'high' };
      }
      return ocrFrameTime(videoFile, opts).then(function (hit) {
        if (hit) {
          return { source: 'ocr', time: (hit.kind === 'datetime' ? hit.epochMs : null),
            confidence: (hit.kind === 'datetime' ? 'medium' : 'low'), hit: hit };
        }
        return { source: 'manual', time: null, confidence: 'none' };
      });
    });
  }

  var VideoTimeDetect = {
    detectRecordingTime: detectRecordingTime,
    detectVideoStart: detectVideoStart,
    readMP4Metadata: readMP4Metadata,
    ocrFrameTime: ocrFrameTime,
    rolloverRefine: rolloverRefine,
    ocrImage: ocrImage,
    loadTesseract: loadTesseract,
    extractDateTime: extractDateTime,
    resolveStartElapsed: resolveStartElapsed,
    _test: {
      extractDateTime: extractDateTime,
      resolveStartElapsed: resolveStartElapsed,
      refineTransition: refineTransition,
      minuteIndexOf: minuteIndexOf,
      inRange: inRange
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = VideoTimeDetect;
  else global.VideoTimeDetect = VideoTimeDetect;
})(typeof window !== 'undefined' ? window : this);
