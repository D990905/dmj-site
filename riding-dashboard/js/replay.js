/* ============================================================
 * replay.js — 라이딩 리플레이 뷰어 (Video Viewer · 전면 재설계)
 *
 *  하나의 동기 타임라인을 다크 테마 몰입형 화면으로 본다.
 *  영상을 올리면 화면 배경을 영상으로 꽉 채워 흐리게(blur) 깔고,
 *  그 위에 모든 정보·기능을 오버레이한다(스크린샷 'Video Viewer').
 *
 *  화면 구성
 *   · 좌상단  — 라이더 카드: 이름 + 실시간 지표(SOG·VMG·TWA·Heel·
 *               Pitch·HR). 재생에 맞춰 갱신.
 *   · 상단중앙— 지표 토글 칩(SOG·VMG·TWA·Heel·Pitch·HR).
 *   · 우측    — 선택 지표 미니그래프. 전체 세션이 아니라 현재 ±5초
 *               창만 필름처럼 흐른다(재생 헤드 중앙 고정·데이터 스크롤).
 *   · 무대    — 영상(선명·중앙) / 지도 / 둘 나란히. 좌우 위치 교환.
 *   · 지도    — 라이더(보드) 중앙. 선택 프레임 범위만 표시. 자유 줌·팬.
 *   · 스크러버— 지도 바로 아래(좌우 여백). 재생/정지·속도·시간.
 *   · 하단    — 가로 메인 트랙 스트립. 줌 인/아웃. 표시 데이터는 상단
 *               지표 선택과 연동. 트랙 줌 ↔ 지도 시간범위 연동(토글).
 *   · 나가기  — 좌상단 ‹ 버튼 · 우상단 ✕ 버튼 · Esc.
 *
 *  영상 ↔ 데이터 동기화
 *   · 자동 정렬 — 영상 파일(MP4)의 녹화 시각 메타데이터(moov▸mvhd
 *     creation_time)를 읽어 데이터 타임스탬프에 맞춘다. 파일명 시각·
 *     파일 수정시각도 후보로 써 겹침이 가장 큰 정렬을 고른다.
 *   · 카메라 메타데이터 정확도가 들쭉날쭉하므로 자동을 기본값으로
 *     하되, 어긋날 때 쓰는 수동 미세조정(±초)을 항상 남겨 둔다.
 *
 *  재생 엔진 — requestAnimationFrame 마스터 클럭. 영상은 슬레이브로,
 *  드리프트가 클 때만 currentTime 을 보정한다. 배경 블러는 영상
 *  프레임을 캔버스에 1회 디코드로 샘플해 항상 동기된다.
 *  데이터 무결성 — 모든 GPS·텔레메트리 포인트를 전량 사용(다운샘플 없음).
 *  계측 텍스트는 한국어 경어체, 모든 수치에 단위를 표기한다.
 *  영상 뷰어 화면은 의도적으로 다크 테마이다(대시보드 라이트 테마와 별개).
 *
 *  브라우저: RDReplay.open(opts) / RDReplay.close()
 *  Node 테스트: require('./js/replay.js')._test 의 순수 함수들.
 * ============================================================ */
(function (global) {
  'use strict';

  var KT = 1.9438444924406;          // m/s → 노트
  var KMH = 3.6;                     // m/s → km/h
  var MP4_EPOCH_1904 = 2082844800;   // 1904-01-01 ~ 1970-01-01 사이 초

  /* ============================================================
   * 1) 순수 함수 (DOM 무관 — Node self-test 가 검증)
   * ============================================================ */

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  /* t 이하인 마지막 샘플 인덱스 (samples[i].t 오름차순 가정 → 이진탐색).
     비어 있으면 -1, 범위 밖이면 양 끝으로 클램프. */
  function sampleIndexAtTime(samples, t) {
    if (!samples || !samples.length) return -1;
    if (t <= samples[0].t) return 0;
    var last = samples.length - 1;
    if (t >= samples[last].t) return last;
    var lo = 0, hi = last;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (samples[mid].t <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  /* 두 각도(도) 사이 최단경로 보간 — 헤딩(침로)용 */
  function lerpAngle(a, b, f) {
    var d = ((b - a) % 360 + 540) % 360 - 180;   // -180..180
    return ((a + d * f) % 360 + 360) % 360;
  }

  /* a→b 부호 있는 최소 각도차(도), 범위 (-180,180]. 양수 = b 가 a 의
     시계방향. 보드 아이콘 택 판정(풍향 대비 헤딩이 어느 쪽인지)에 쓴다. */
  function angDiff(a, b) {
    return ((b - a + 540) % 360) - 180;
  }

  /* 한 숫자 지표를 두 샘플 사이에서 선형 보간 (한쪽이 null 이면 그대로) */
  function lerpNum(av, bv, f) {
    if (av == null && bv == null) return null;
    if (av == null) return bv;
    if (bv == null) return av;
    return av + (bv - av) * f;
  }

  /* 샘플 1개를 리플레이 상태 객체로 — 없는 지표는 null.
     심박(hr)을 포함해 6종 지표를 모두 보존한다. */
  function sampleState(s) {
    if (!s) return null;
    function num(v) { return (v != null && isFinite(v)) ? v : null; }
    return {
      t: s.t,
      lat: s.lat, lng: s.lng,
      speed: num(s.speed),
      heading: num(s.heading),
      twa: num(s.twa),
      vmg: num(s.vmg),
      heel: num(s.heel),
      pitch: num(s.pitch),
      hr: num(s.hr)
    };
  }

  /* 시각 t 에서의 보간 상태. 두 샘플 간격이 gapSec 보다 크면
     (leg 공백·제외 구간) 보간하지 않고 가까운 샘플로 스냅한다. */
  function interpAtTime(samples, t, gapSec) {
    gapSec = (gapSec == null) ? 4 : gapSec;
    var i = sampleIndexAtTime(samples, t);
    if (i < 0) return null;
    var a = samples[i];
    if (i >= samples.length - 1) return sampleState(a);
    var b = samples[i + 1];
    var dt = b.t - a.t;
    if (!(dt > 0) || dt > gapSec || t <= a.t) return sampleState(a);
    if (t >= b.t) return sampleState(b);
    var f = (t - a.t) / dt;
    var st = sampleState(a), sb = sampleState(b);
    return {
      t: t,
      lat: lerpNum(st.lat, sb.lat, f),
      lng: lerpNum(st.lng, sb.lng, f),
      speed: lerpNum(st.speed, sb.speed, f),
      heading: (st.heading != null && sb.heading != null)
        ? lerpAngle(st.heading, sb.heading, f)
        : (st.heading != null ? st.heading : sb.heading),
      twa: lerpNum(st.twa, sb.twa, f),
      vmg: lerpNum(st.vmg, sb.vmg, f),
      heel: lerpNum(st.heel, sb.heel, f),
      pitch: lerpNum(st.pitch, sb.pitch, f),
      hr: lerpNum(st.hr, sb.hr, f)
    };
  }

  /* 어떤 미니그래프 지표가 실제 데이터를 가졌는지 검출.
     vmg·twa 는 풍향 확정 시에만 채워지고(analysis computeWindMetrics),
     heel·pitch 는 .vkx 자세 데이터, hr 은 GPX HR 확장에 있을 때만 존재. */
  function detectMetrics(samples) {
    var has = { sog: false, vmg: false, twa: false,
                heel: false, pitch: false, hr: false };
    if (!samples) return has;
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      if (!has.sog && s.speed != null && isFinite(s.speed)) has.sog = true;
      if (!has.vmg && s.vmg != null && isFinite(s.vmg)) has.vmg = true;
      if (!has.twa && s.twa != null && isFinite(s.twa)) has.twa = true;
      if (!has.heel && s.heel != null && isFinite(s.heel)) has.heel = true;
      if (!has.pitch && s.pitch != null && isFinite(s.pitch)) has.pitch = true;
      if (!has.hr && s.hr != null && isFinite(s.hr)) has.hr = true;
    }
    return has;
  }

  /* 어떤 지표 슬롯을 어떤 상태로 보일지 결정한다.
     · SOG          — 항상 'data' (GPS 만으로 산출).
     · VMG·TWA      — 풍향이 있어야 산출. 데이터가 있거나 풍향이 설정돼
                      있으면 'data', 아니면 'needwind'(슬롯은 유지하되
                      '풍향 설정 필요' 안내).
     · Heel·Pitch·HR— 센서 데이터가 있을 때만 슬롯을 만든다(없으면
                      사용자가 취할 조치가 없으므로 슬롯 자체를 생략).
     반환: [{ def, state:'data'|'needwind' }] (METRICS 순서). */
  function buildMetricSlots(hasData, windDir) {
    var slots = [];
    METRICS.forEach(function (def) {
      if (def.key === 'sog') {
        slots.push({ def: def, state: 'data' });
      } else if (def.key === 'vmg' || def.key === 'twa') {
        var on = hasData[def.key] || (windDir != null);
        slots.push({ def: def, state: on ? 'data' : 'needwind' });
      } else {                                  // heel · pitch · hr
        if (hasData[def.key]) slots.push({ def: def, state: 'data' });
      }
    });
    return slots;
  }

  /* 영상 ↔ 데이터 시간 변환.
     offsetSec = 데이터 경과시간 0(세션 시작)에 대응하는 영상 시각(초).
       offsetSec > 0 → 영상이 데이터보다 먼저 시작(영상이 빠름).
       offsetSec < 0 → 영상이 데이터보다 늦게 시작(영상이 늦음). */
  function videoTimeForElapsed(elapsedSec, offsetSec) {
    return elapsedSec + offsetSec;
  }
  function elapsedForVideoTime(videoSec, offsetSec) {
    return videoSec - offsetSec;
  }

  /* 한 지표의 시계열을 추출 — 전량 사용(다운샘플 없음).
     v[i] 는 값 또는 NaN(결측 → 그래프에서 선이 끊김). min/max 는
     유한값만으로 산출. */
  function buildSeries(samples, key) {
    var tArr = [], vArr = [], min = Infinity, max = -Infinity, count = 0;
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var raw = s[key];
      tArr.push(s.t);
      if (raw != null && isFinite(raw)) {
        vArr.push(raw);
        if (raw < min) min = raw;
        if (raw > max) max = raw;
        count++;
      } else {
        vArr.push(NaN);
      }
    }
    if (count === 0) { min = 0; max = 1; }
    else if (min === max) { min -= 1; max += 1; }
    return { t: tArr, v: vArr, min: min, max: max, count: count };
  }

  /* 지표별 Y축 범위(원본 단위) — 미니그래프·트랙 공용.
     fixed 면 그대로, signed 면 0 대칭, hr 은 실측 ±여유, 그 외 0~max. */
  function computeRange(def, series) {
    if (def.fixed) return def.fixed.slice();
    if (def.signed) {
      var m = Math.max(Math.abs(series.min), Math.abs(series.max), 1);
      return [-m * 1.08, m * 1.08];
    }
    if (def.key === 'hr') {
      var pad = Math.max((series.max - series.min) * 0.12, 4);
      return [Math.max(0, series.min - pad), series.max + pad];
    }
    return [0, Math.max(series.max * 1.08, 1)];
  }

  /* 초 → "M:SS" / "H:MM:SS" */
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var ss = (s < 10 ? '0' : '') + s;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
    return m + ':' + ss;
  }

  /* epoch(ms) → 실제 시각 "H:MM:SS" (로컬 시각). 하단 트랙 시간축이
     영상 녹화 시각과 눈으로 대조되도록 실제 시각으로 라벨링한다
     (Danny 검토 2026-05-23 §B6 — 경과 시간으론 영상 시계와 대조 불가). */
  function fmtRealClock(epochMs) {
    var d = new Date(epochMs);
    var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  /* epoch(ms) → "YYYY-MM-DD H:MM:SS" (로컬) — 동기화 패널의 시각 표기 */
  function fmtRealDateTime(epochMs) {
    var d = new Date(epochMs);
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
      ' ' + d.getHours() + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }

  /* §198-B (Danny 2026-06-04) — playback clock element 갱신 (mode 분기).
     R.timeMode === 'clock' 이고 R.session.startEpoch 가 유효하면 wall-clock
     표기 (H:MM 시·분, 초 X — 정확도 over-information 회피). 그 외 = elapsed
     기존 동작. 옥대표님 요청에 맞춘 hybrid 표기. seek() · 토글 handler 둘 다
     이 helper 만 호출하도록 단일화. */
  function fmtRealClockShort(epochMs) {
    /* fmtRealClock(line 241) 와 다르게 초는 표시하지 않는다 — 재생 컨트롤
       옆 공간이 좁고, 사용자가 "오후 3시 43분 경" mental model 로 충분. */
    var d = new Date(epochMs);
    return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }
  function updateClockEl(playT) {
    if (!R || !R.clockEl) return;
    var startEpoch = R.session && R.session.startEpoch;
    if (R.timeMode === 'clock' && startEpoch != null && isFinite(startEpoch)) {
      var curEpoch = startEpoch + Math.max(0, (playT - R.t0)) * 1000;
      var endEpoch = startEpoch + R.dur * 1000;
      R.clockEl.textContent = fmtRealClockShort(curEpoch) + ' / ' + fmtRealClockShort(endEpoch);
    } else {
      R.clockEl.textContent = fmtClock(playT - R.t0) + ' / ' + fmtClock(R.dur);
    }
  }

  /* 시계 시각 문자열("HH:MM:SS"·"H:MM"·"HH:MM:SS") → 데이터 기준
     경과초(startElapsed). 데이터 세션 시작 epoch 를 기준으로 같은 날의
     그 시각을 잡되, 자정을 넘는 경우를 위해 ±1일 후보 중 현재 배치값
     (curElapsed)에 가장 가까운 해석을 고른다 (Danny 검토 2026-05-23
     §C1 — 클립 배치 시각을 시계 시각으로 직접 입력). 못 읽으면 null. */
  function parseClockToElapsed(clockStr, startEpoch, curElapsed) {
    if (clockStr == null || startEpoch == null || !isFinite(startEpoch)) {
      return null;
    }
    var m = String(clockStr).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    var h = +m[1], mi = +m[2], s = (m[3] != null) ? +m[3] : 0;
    if (h > 23 || mi > 59 || s > 59) return null;
    var base = new Date(startEpoch);
    var cur = (curElapsed != null && isFinite(curElapsed)) ? curElapsed : 0;
    var best = null;
    for (var dd = -1; dd <= 1; dd++) {
      var cand = new Date(base.getFullYear(), base.getMonth(),
        base.getDate() + dd, h, mi, s).getTime();
      if (!isFinite(cand)) continue;
      var elapsed = (cand - startEpoch) / 1000;
      if (best == null || Math.abs(elapsed - cur) < Math.abs(best - cur)) {
        best = elapsed;
      }
    }
    return (best == null) ? null : Math.round(best * 10) / 10;
  }

  /* ---------- MP4 컨테이너 파싱 (영상 녹화 시각 자동 정렬용) ----------
     MP4 박스: [4바이트 size][4바이트 type][payload]. size 는 헤더 포함.
     size==1 → 64비트 size 가 뒤따름. size==0 → 파일 끝까지.
     녹화 시각은 moov▸mvhd 의 creation_time (1904-01-01 UTC 기준 초). */
  function bytesOf(input) {
    if (input == null) return null;
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    return null;
  }
  function readU32BE(u8, o) {
    return (u8[o] * 16777216) + (u8[o + 1] << 16) + (u8[o + 2] << 8) + u8[o + 3];
  }
  function readU64BE(u8, o) {
    return readU32BE(u8, o) * 4294967296 + readU32BE(u8, o + 4);
  }
  function boxType(u8, o) {
    return String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  }
  /* u8 의 [start,end) 구간 최상위 박스들에서 type 박스를 찾는다.
     반환 { dataStart, dataEnd } (payload 범위) 또는 null. */
  function findBox(u8, start, end, type) {
    var o = start;
    while (o + 8 <= end) {
      var size = readU32BE(u8, o);
      var t = boxType(u8, o + 4);
      var hdr = 8;
      if (size === 1) {
        if (o + 16 > end) break;
        size = readU64BE(u8, o + 8);
        hdr = 16;
      } else if (size === 0) {
        size = end - o;
      }
      if (size < hdr) break;
      if (t === type) return { dataStart: o + hdr, dataEnd: Math.min(o + size, end) };
      o += size;
    }
    return null;
  }
  /* mvhd payload 를 읽어 { creationMs, durationSec } 산출 */
  function parseMvhd(u8, dataStart, dataEnd) {
    if (dataStart + 4 > dataEnd) return null;
    var version = u8[dataStart];
    var p = dataStart + 4;                       // version(1) + flags(3)
    var creation, timescale, duration;
    if (version === 1) {
      if (p + 28 > dataEnd) return null;
      creation = readU64BE(u8, p);
      timescale = readU32BE(u8, p + 16);
      duration = readU64BE(u8, p + 20);
    } else {
      if (p + 16 > dataEnd) return null;
      creation = readU32BE(u8, p);
      timescale = readU32BE(u8, p + 8);
      duration = readU32BE(u8, p + 12);
    }
    var creationMs = (creation > MP4_EPOCH_1904)
      ? (creation - MP4_EPOCH_1904) * 1000 : null;
    var durationSec = (timescale > 0 && duration > 0) ? duration / timescale : null;
    return { creationMs: creationMs, durationSec: durationSec, rawCreation: creation };
  }
  /* ISO8601/EXIF 날짜시각 문자열 → epoch(ms). 타임존(±HH:MM·±HHMM·Z)이
     있으면 그대로 적용, 없으면 로컬 시각으로 해석. 못 읽으면 null.
     날짜 구분자는 '-'(ISO) 와 ':'(EXIF·일부 카메라) 를 모두 받는다 —
     com.apple.quicktime.creationdate "2026-05-19T15:30:45+0900" 와
     EXIF 류 "2026:05:19 15:30:45" 를 같이 해석한다. Date.parse 가
     ±HHMM(콜론 없는 오프셋)을 엔진마다 다르게 처리하므로 직접 파싱한다. */
  function parseIso8601(str) {
    if (str == null) return null;
    var m = String(str).match(
      /(\d{4})[-:](\d{2})[-:](\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|z|[+-]\d{2}:?\d{2})?/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], se = +m[6];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 61) {
      return null;
    }
    var ms = m[7] ? Math.round(+('0.' + m[7]) * 1000) : 0;
    var tz = m[8];
    if (!tz) {                       // 타임존 없음 — 로컬 시각으로 해석
      var loc = new Date(y, mo - 1, d, h, mi, se, ms).getTime();
      return isFinite(loc) ? loc : null;
    }
    var utc = Date.UTC(y, mo - 1, d, h, mi, se, ms);
    if (!isFinite(utc)) return null;
    if (tz === 'Z' || tz === 'z') return utc;
    var tm = tz.match(/([+-])(\d{2}):?(\d{2})/);
    var offMin = (tm[1] === '-' ? -1 : 1) * (+tm[2] * 60 + +tm[3]);
    return utc - offMin * 60000;
  }

  /* MP4/MOV 바이트 범위에서 녹화 시각 문자열을 찾는다. QuickTime
     com.apple.quicktime.creationdate, 표준 'creation_time' format tag,
     QuickTime ©day, GoPro·Insta360 류의 EXIF 날짜시각까지 — 메타
     키/값 박스 구조는 카메라마다 제각각이라(키·값 분리·박스 헤더
     모호성), ASCII 날짜시각 패턴을 바이트 단위로 직접 스캔한다.
     날짜 구분자는 '-'(ISO) 와 ':'(EXIF) 둘 다 받는다.
     반환 { ms, iso } 또는 null (Danny 검토 2026-05-23 §B3 확장 — 숫자
     파일명 액션캠 MP4 에서도 최대한 자동으로 잡히게). */
  function extractCreationDate(u8, start, end) {
    if (!u8) return null;
    start = Math.max(0, start | 0);
    end = Math.min(u8.length, (end == null) ? u8.length : (end | 0));
    function digit(o) { return u8[o] >= 48 && u8[o] <= 57; }
    function dsep(o) { return u8[o] === 45 || u8[o] === 58; }   // '-' 또는 ':'
    for (var i = start; i + 19 <= end; i++) {
      if (!digit(i) || !digit(i + 1) || !digit(i + 2) || !digit(i + 3)) continue;
      if (!dsep(i + 4) || !dsep(i + 7)) continue;              // 날짜 구분자
      var sep = u8[i + 10];
      if (sep !== 84 && sep !== 116 && sep !== 32) continue;    // 'T' 't' ' '
      if (u8[i + 13] !== 58 || u8[i + 16] !== 58) continue;     // 시:분:초 ':'
      var j = i + 19;                          // 소수·타임존까지 끝을 찾는다
      if (u8[j] === 46) { j++; while (j < end && digit(j)) j++; }   // '.'
      if (j < end && (u8[j] === 90 || u8[j] === 122)) {             // Z z
        j++;
      } else if (j < end && (u8[j] === 43 || u8[j] === 45)) {       // + -
        var te = j + 1;
        while (te < end && te < j + 7 && (digit(te) || u8[te] === 58)) te++;
        j = te;
      }
      var str = '';
      for (var k = i; k < j; k++) str += String.fromCharCode(u8[k]);
      var ms = parseIso8601(str);
      /* 비현실 연도(파일 안 무관 숫자열의 우연 일치) 거르기 */
      if (ms != null) {
        var yr = +str.slice(0, 4);
        if (yr >= 2000 && yr <= 2099) return { ms: ms, iso: str };
      }
    }
    return null;
  }

  /* 완전한 MP4 버퍼(또는 moov 를 담은 머리부분)에서 녹화 메타 추출.
     mvhd 의 creation_time(UTC) 과, 있으면 QuickTime 정밀 촬영 시각
     (com.apple.quicktime.creationdate, 타임존 포함)을 함께 반환한다.
     반환 { creationMs, durationSec, creationDateMs, creationDateIso } | null. */
  function parseMp4Meta(input) {
    var u8 = bytesOf(input);
    if (!u8 || u8.length < 16) return null;
    var moov = findBox(u8, 0, u8.length, 'moov');
    if (!moov) return null;
    var mvhd = findBox(u8, moov.dataStart, moov.dataEnd, 'mvhd');
    var meta = mvhd
      ? parseMvhd(u8, mvhd.dataStart, mvhd.dataEnd)
      : { creationMs: null, durationSec: null, rawCreation: 0 };
    if (!meta) meta = { creationMs: null, durationSec: null, rawCreation: 0 };
    var cd = extractCreationDate(u8, moov.dataStart, moov.dataEnd);
    meta.creationDateMs = cd ? cd.ms : null;
    meta.creationDateIso = cd ? cd.iso : null;
    return meta;
  }

  /* 파일명에서 촬영 일시 추출 — 구분자 무관 포맷 인식 (데이빗 2026-06-03).
     YYYY MM DD HH MM SS 사이에 어떤 구분자(- _ . : / 공백 · 등)가 오든, 또는
     아예 없든(20260519153045) 인식한다. 각 자리 사이 \D?(비숫자 0~1개)로 허용해
     "시·분·초 포맷이 달라도" 자동 인식. 흔한 예: VID_20260519_153045 /
     2026-05-19 15.30.45 / 2026.05.19_15:30:45 / 20260519T153045.
     로컬 시각으로 해석해 epoch(ms) 반환, 없으면 null. */
  function parseFilenameDate(name) {
    if (!name) return null;
    var m = String(name).match(
      /(20\d{2})\D?(\d{2})\D?(\d{2})\D?(\d{2})\D?(\d{2})\D?(\d{2})/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], se = +m[6];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;
    var ms = new Date(y, mo - 1, d, h, mi, se).getTime();
    return isFinite(ms) ? ms : null;
  }

  /* 영상 시작 epoch 후보들 중 데이터 구간과 가장 많이 겹치는 정렬을 고른다.
     cands = [{ epoch, source }], 데이터 [dStartEpoch, +dDurMs],
     영상 길이 vDurMs. 반환 { offsetSec, overlapMs, source } 또는 null.
     offsetSec = (데이터 시작 - 영상 시작)/1000. */
  function pickVideoOffset(cands, dStartEpoch, dDurMs, vDurMs) {
    var best = null;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!c || c.epoch == null || !isFinite(c.epoch)) continue;
      var vEnd = c.epoch + (vDurMs || 0);
      var dEnd = dStartEpoch + dDurMs;
      var overlap = Math.max(0, Math.min(vEnd, dEnd) - Math.max(c.epoch, dStartEpoch));
      var offsetSec = (dStartEpoch - c.epoch) / 1000;
      if (!best || overlap > best.overlapMs) {
        best = { offsetSec: offsetSec, overlapMs: overlap, source: c.source };
      }
    }
    return best;
  }

  /* ============================================================
   * 2) 지표 정의 · 상수
   * ============================================================ */

  /* key = 식별자(칩·토글), field = 보간상태 속성명(SOG 는 speed),
     unit = 'spd' 속도단위변환 / 'deg' 도 / 'bpm' 심박,
     signed = 0 대칭 축, fixed = 고정 축 범위. */
  var METRICS = [
    { key: 'sog',   field: 'speed', label: 'SOG',   unit: 'spd', color: '#33A1FF' },
    { key: 'vmg',   field: 'vmg',   label: 'VMG',   unit: 'spd', color: '#3FD9B6', signed: true },
    { key: 'twa',   field: 'twa',   label: 'CWA',   unit: 'deg', color: '#FFB02E', fixed: [0, 180] },
    { key: 'heel',  field: 'heel',  label: 'Heel',  unit: 'deg', color: '#7FD0FF', signed: true },
    { key: 'pitch', field: 'pitch', label: 'Pitch', unit: 'deg', color: '#C9A4FF', signed: true },
    { key: 'hr',    field: 'hr',    label: 'HR',    unit: 'bpm', color: '#FF6B7A' }
  ];
  var SPEED_STEPS = [0.5, 1, 2, 4, 8];
  var GAP_SEC = 4;                 // 이보다 큰 샘플 간격은 보간하지 않음
  var DRIFT_TOL = 0.34;            // 영상 드리프트 보정 임계(초)
  var MINI_WIN = 15;               // 미니그래프 ±초 창 (30초 분량 표시 · §D2)
  var MINI_LINE = '#FFFFFF';       // 미니그래프 선·점 색 — 흰색 통일 (§D1)
  var CURSOR = '#FF5A1F';          // 재생 헤드(주황)
  var TRACK_MIN_SPAN = 20;         // 하단 트랙 최소 줌 범위(초)

  /* 동적 보드 아이콘 — 세일 거동 매핑 상수 (보기 좋은 기본값, Danny
     튜닝용). 세일각 = TWA 기반 기본 받음각 + SOG 기반 개폐.
     · TWA 작음(풍상) → 기본각 작음(닫힘) / TWA 큼(풍하) → 큼(열림)
     · SOG 빠름 → 닫힘(−) / 느림 → 열림(+) */
  var SAIL = {
    twaMin: 45,        // 이 TWA(도) 이하 = 완전 풍상 → 기본각 angMin
    twaMax: 165,       // 이 TWA(도) 이상 = 완전 풍하 → 기본각 angMax
    angMin: 15,        // 풍상 기본 세일각(도 · 보드 중심선 기준)
    angMax: 80,        // 풍하 기본 세일각(도)
    sogMid: 13,        // 이 속도(kt)에서 개폐 보정 0
    sogGain: 1.5,      // kt 당 개폐 보정(도) — 느릴수록 +(열림)
    sogClamp: 20,      // 개폐 보정 한계(±도)
    hardMin: 7,        // 최종 세일각 하한(도)
    hardMax: 90,       // 최종 세일각 상한(도)
    flipLerp: 0.16,    // 택/자이브 좌우 전환 부드러움(0~1 · 프레임당)
    pivotY: -9         // 세일 회전 피벗 — SVG 보드 길이의 앞 1/3 지점
  };

  var R = null;                    // 활성 리플레이 상태 (없으면 닫힌 상태)

  function noop() {}
  function el(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  /* 모서리 둥근 사각형 path */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /* 속도색 램프 — 느림=빨강 → 빠름=초록 (대시보드 색 규칙과 동일) */
  function speedRamp(f) {
    f = clamp(f, 0, 1);
    /* 속도색 ramp — 느림(빨강)→중간(주황)→빠름(초록). 밝은 OSM 타일
       위에서 또렷하고 산뜻하게 보이도록 채도 높은 밝은 톤을 쓴다
       (Danny 2026-05-24: 항적선이 어둡다 → 밝게). */
    var stops = [[0, [231, 76, 60]], [0.5, [243, 156, 18]], [1, [46, 204, 113]]];
    for (var i = 1; i < stops.length; i++) {
      if (f <= stops[i][0]) {
        var lo = stops[i - 1], hi = stops[i];
        var k = (f - lo[0]) / (hi[0] - lo[0] || 1);
        return 'rgb(' +
          Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * k) + ',' +
          Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * k) + ',' +
          Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * k) + ')';
      }
    }
    return 'rgb(39,174,96)';
  }

  /* ---------- 값 포맷 ---------- */
  function toSpeed(ms) { return R.unit === 'kmh' ? ms * KMH : ms * KT; }
  function unitLabel() { return R.unit === 'kmh' ? 'km/h' : 'kt'; }

  /* 짧은 값(단위 포함) — 미니그래프 헤더·커서 라벨 */
  function fmtMetric(def, v) {
    if (v == null || !isFinite(v)) return '—';
    if (def.unit === 'spd') {
      var sp = toSpeed(v);
      return (def.signed && sp > 0 ? '+' : '') + sp.toFixed(1) + ' ' + unitLabel();
    }
    if (def.unit === 'bpm') return Math.round(v) + ' bpm';
    return (def.signed && v > 0 ? '+' : '') + v.toFixed(1) + '°';
  }
  /* 큰 숫자 — 숫자와 단위를 분리해 반환 (라이더 카드) */
  function bigValue(def, v) {
    if (v == null || !isFinite(v)) return { num: '—', unit: '' };
    if (def.unit === 'spd') {
      var sp = toSpeed(v);
      return { num: (def.signed && sp > 0 ? '+' : '') + sp.toFixed(1), unit: unitLabel() };
    }
    if (def.unit === 'bpm') return { num: String(Math.round(v)), unit: 'bpm' };
    return { num: (def.signed && v > 0 ? '+' : '') + v.toFixed(1), unit: '°' };
  }
  /* 축 눈금 라벨 */
  function tickLabel(def, val) {
    if (def.unit === 'spd') return (R.unit === 'kmh' ? val * KMH : val * KT).toFixed(0);
    if (def.unit === 'bpm') return String(Math.round(val));
    return Math.round(val) + '°';
  }

  /* ============================================================
   * 3) 오버레이 DOM 생성
   * ============================================================ */
  function buildOverlay() {
    var old = el('replay-view');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var v = document.createElement('div');
    v.id = 'replay-view';
    v.className = 'replay';
    v.hidden = true;
    v.innerHTML =
      /* 배경 — 영상 블러 캔버스 + 어둡게 덮는 스크림 */
      '<canvas id="replay-blur" class="replay__blur"></canvas>' +
      '<div class="replay__scrim"></div>' +

      /* 상단 바 */
      '<div class="replay__bar">' +
        '<button type="button" class="replay__exit" id="replay-exit">' +
          '<span aria-hidden="true">‹</span> Riding Replay</button>' +
        '<div class="replay__chips" id="replay-chips" role="group" ' +
          'aria-label="Select metrics"></div>' +
        '<div class="replay__tools" id="replay-tools">' +
          '<label class="replay__upload" id="replay-upload-wrap">' +
            '<span aria-hidden="true">📹</span> Upload Video' +
            '<input type="file" id="replay-video-input" accept="video/*" ' +
              'multiple hidden>' +
          '</label>' +
          '<div class="replay__layout" id="replay-layout" role="group" ' +
            'aria-label="Layout">' +
            '<button type="button" class="replay__lay" data-lay="video">Video</button>' +
            '<button type="button" class="replay__lay" data-lay="both">Side by Side</button>' +
            '<button type="button" class="replay__lay" data-lay="map">Map</button>' +
          '</div>' +
          '<button type="button" class="replay__tool" id="replay-swap" ' +
            'title="Swap video / map sides" aria-label="Swap sides">⇄</button>' +
          '<button type="button" class="replay__tool" id="replay-sync-btn" ' +
            'title="Sync video" aria-label="Sync video">Sync</button>' +
          '<button type="button" class="replay__close-x" id="replay-close-x" ' +
            'title="Close (Esc)" aria-label="Close replay">✕</button>' +
        '</div>' +
      '</div>' +

      /* 동기화 패널 (싱크 버튼으로 토글) */
      '<div class="replay__sync" id="replay-sync" hidden></div>' +

      /* 무대 — 좌측 컬럼 · 중앙 스테이지 · 미니그래프 레일.
         공통 멘탈모델: 좌측 컬럼 맨 위엔 항상 컴팩트 데이터 패널, 그
         아래 타일엔 '중앙 스테이지에 없는 것'을 둔다. 영상 뷰=아래
         타일에 지도, 지도 뷰=아래 타일에 영상, 나란히 뷰=좌측 컬럼은
         데이터 패널만(컴팩트) + 중앙에 영상·지도 반반. 영상/지도 패널은
         setLayout 이 좌측 컬럼 ↔ 중앙 스테이지로 옮긴다. 모바일
         (≤768px)은 세로 스택으로 reflow 한다 (css/dashboard.css 참조). */
      '<div class="replay__stage" id="replay-stage">' +
        '<div class="replay__lcol" id="replay-lcol">' +
          '<div class="replay__rider" id="replay-rider" hidden></div>' +
          '<div class="replay__mpanel" id="replay-mpanel">' +
            '<div id="replay-map" class="replay__map"></div>' +
            /* 풍향 정렬 모눈 격자 — 지도 타일 위·컨트롤 아래의 장식
               레이어. 풍향 확정 시에만 그린다 (C · Danny 2026-05-24). */
            '<canvas id="replay-wind-grid" class="replay__windgrid" ' +
              'aria-hidden="true"></canvas>' +
            /* ladder rung — 보드 추적 모드에서 보드를 지나는 풍상
               레드라인. 격자보다 위 레이어(z 6 · C · Danny 2026-05-24). */
            '<canvas id="replay-ladder" class="replay__ladder" ' +
              'aria-hidden="true"></canvas>' +
            '<div class="replay__mapctl">' +
              '<button type="button" class="replay__mapbtn replay__mapbtn--ico" ' +
                'id="replay-map-zoomout" aria-label="Zoom out map">－</button>' +
              '<button type="button" class="replay__mapbtn replay__mapbtn--ico" ' +
                'id="replay-map-zoomin" aria-label="Zoom in map">＋</button>' +
              '<button type="button" class="replay__mapbtn" id="replay-recenter" ' +
                'title="Center on board">⊕ Center</button>' +
              /* 보드 추적 토글 — 켜면 재생 중 지도가 보드를 따라 팬한다
                 (F · Danny 2026-05-24). 끄면 지도 고정. */
              '<button type="button" class="replay__mapbtn" id="replay-mapmode" ' +
                'aria-pressed="false" title="Keep the board centered and ' +
                'pan the map to follow it">🎯 Track Board</button>' +
              /* 보드 바우 끝 앵커 선 토글 2개 — 검정(풍향 축)·빨강(ladder
                 rung). 기본 둘 다 켜짐 (Danny 2026-05-25). */
              '<button type="button" class="replay__mapbtn is-on" ' +
                'id="replay-axis-toggle" aria-pressed="true" ' +
                'title="Wind axis line through the board (along the wind)">' +
                '<span style="color:#11161f">●</span> Wind Axis</button>' +
              '<button type="button" class="replay__mapbtn is-on" ' +
                'id="replay-ladder-toggle" aria-pressed="true" ' +
                'title="Ladder rung line through the board (across the wind)">' +
                '<span style="color:#d6162a">●</span> Ladder</button>' +
            '</div>' +
          '</div>' +
          /* 세션 통계 요약 타일 — 나란히 뷰에서만 좌측 컬럼 하단에 노출
             (setLayout 이 hidden 토글). 영상·지도 뷰는 하단 타일이 지도/
             영상이라 통계 타일은 숨긴다. */
          '<div class="replay__stats" id="replay-stats" hidden></div>' +
        '</div>' +
        '<div class="replay__cstage" id="replay-cstage">' +
          '<div class="replay__vpanel" id="replay-vpanel">' +
            '<video id="replay-video" class="replay__video" playsinline ' +
              'preload="auto"></video>' +
            '<div class="replay__nohint" id="replay-nohint">' +
              '<b>Upload a video</b> to fill the screen and play it ' +
              'alongside your data.<br><small>The file opens only in ' +
              'your browser and is never uploaded anywhere.</small></div>' +
            /* §423 — 다른 기기에서 cloud 로 불러온 세션인데 영상이 이 기기에
               없을 때 안내. 내용은 showVideoMissing() 가 RDI18n.T 로 채운다. */
            '<div class="replay__vmissing" id="replay-vmissing" hidden></div>' +
          '</div>' +
        '</div>' +
        '<aside class="replay__graphs" id="replay-graphs" ' +
          'aria-label="Metric mini-graphs"></aside>' +
      '</div>' +

      /* 스크러버 — 지도 바로 아래 (좌우 여백) */
      '<div class="replay__scrubrow">' +
        '<button type="button" class="replay__btn replay__btn--play" ' +
          'id="replay-play" aria-label="Play">▶</button>' +
        '<button type="button" class="replay__btn" id="replay-stop" ' +
          'aria-label="Stop (to start)" title="Stop — back to start">⏹</button>' +
        '<span class="replay__clock" id="replay-clock" aria-live="off">0:00 / 0:00</span>' +
        /* §198-B (Danny 2026-06-04) — playback clock time-mode toggle.
           옥대표님 요청: "당일 실제 시간도 선택해서 볼 수 있게". chart axis
           의 .time-toggle 컴포넌트 재사용 (dashboard.css:142-153) — 일관성.
           localStorage 'dmj_rd_replay_time_mode' 로 mode 영구. */
        '<div class="time-toggle replay__timetoggle" id="replay-time-toggle" ' +
          'role="group" aria-label="재생 시간 표기 — 경과 또는 실제">' +
          '<button type="button" data-rmode="elapsed" class="is-active" ' +
            'aria-pressed="true">경과</button>' +
          '<button type="button" data-rmode="clock" aria-pressed="false">실제</button>' +
        '</div>' +
        '<input type="range" id="replay-scrub" class="replay__scrub" ' +
          'min="0" max="1000" value="0" step="1" aria-label="Time scrubber">' +
        '<div class="replay__speed" id="replay-speed" role="group" ' +
          'aria-label="Playback speed"></div>' +
      '</div>' +

      /* 하단 — 가로 메인 트랙 스트립 */
      '<div class="replay__trackrow">' +
        '<div class="replay__trackwrap">' +
          '<canvas id="replay-track" class="replay__track"></canvas>' +
        '</div>' +
        '<div class="replay__trackctl">' +
          '<button type="button" class="replay__tbtn" id="replay-zoomout" ' +
            'title="Zoom out track" aria-label="Zoom out track">－</button>' +
          '<button type="button" class="replay__tbtn" id="replay-zoomin" ' +
            'title="Zoom in track" aria-label="Zoom in track">＋</button>' +
          '<span class="replay__tspan" id="replay-tspan">Full</span>' +
          '<button type="button" class="replay__tlink is-on" id="replay-link" ' +
            'aria-pressed="true" title="Link track zoom to map range">' +
            '🔗 Link Map</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(v);
    return v;
  }

  /* ============================================================
   * 4) 상단 — 지표 토글 칩
   * ============================================================ */
  function buildChips() {
    var box = el('replay-chips');
    box.innerHTML = '';
    R.metricSlots.forEach(function (slot) {
      var def = slot.def;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'replay__chip' + (R.shown[def.key] ? ' is-on' : '') +
        (slot.state === 'needwind' ? ' replay__chip--nowind' : '');
      b.setAttribute('data-metric', def.key);
      b.setAttribute('aria-pressed', R.shown[def.key] ? 'true' : 'false');
      if (slot.state === 'needwind') b.title = 'Shown once wind direction is set';
      b.textContent = def.label;
      box.appendChild(b);
    });
    box.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var key = b.getAttribute('data-metric');
      R.shown[key] = !R.shown[key];
      b.classList.toggle('is-on', R.shown[key]);
      b.setAttribute('aria-pressed', R.shown[key] ? 'true' : 'false');
      applyShown();
    };
  }

  /* 칩 상태를 미니그래프·트랙·라이더 카드에 반영 */
  function applyShown() {
    R.graphs.forEach(function (g) {
      if (g.card) g.card.hidden = !R.shown[g.def.key];
    });
    rebuildTrack();
    seek(R.playT, !R.playing);
  }

  /* ============================================================
   * 5) 좌상단 — 라이더 카드 (실시간 지표)
   * ============================================================ */
  function buildRider() {
    var card = el('replay-rider');
    card.hidden = false;
    var rows = '';
    R.metricSlots.forEach(function (slot) {
      if (slot.state !== 'data') return;          // 풍향 필요 슬롯은 카드 생략
      var def = slot.def;
      /* 라벨 색은 항목마다 다르게 두지 않는다 — 패널 헤더(라이더 이름)와
         같은 단색으로 통일한다(.replay-rider__lbl · CSS). 미니그래프
         곡선 색(def.color)은 그래프에만 쓰고 여기엔 쓰지 않는다. */
      rows +=
        '<div class="replay-rider__m" data-metric="' + def.key + '">' +
          '<span class="replay-rider__lbl">' + def.label + '</span>' +
          '<span class="replay-rider__num" id="rider-num-' + def.key + '">—</span>' +
          '<span class="replay-rider__u" id="rider-u-' + def.key + '"></span>' +
        '</div>';
    });
    card.innerHTML =
      '<div class="replay-rider__name">' + escapeHtml(R.riderName) + '</div>' +
      '<div class="replay-rider__clock" id="replay-rider-clock">0:00 elapsed</div>' +
      '<div class="replay-rider__metrics">' + rows + '</div>';
  }

  function updateRider(playT, st) {
    var clk = el('replay-rider-clock');
    if (clk) clk.textContent = fmtClock(playT - R.t0) + ' elapsed';
    R.metricSlots.forEach(function (slot) {
      if (slot.state !== 'data') return;
      var def = slot.def;
      var numEl = el('rider-num-' + def.key);
      var uEl = el('rider-u-' + def.key);
      if (!numEl) return;
      var bv = bigValue(def, st ? st[def.field] : null);
      numEl.textContent = bv.num;
      if (uEl) uEl.textContent = bv.unit;
    });
  }

  /* ============================================================
   * 5b) 좌측 컬럼 — 세션 통계 요약 타일 (나란히 뷰)
   *
   * 나란히 뷰에서 좌측 컬럼 하단에 그날 라이딩 통계를 컴팩트하게
   * 보여 준다. 대시보드가 이미 산출한 R.analysis(maneuverStats·summary)
   * 와 세션 거리를 재배치할 뿐 — 여기서 새로 계산하지 않는다. 세션
   * 단위 값이라 재생 중 갱신 없이 open 시 한 번만 렌더한다.
   * 단위는 영어/기호 통일 (회→times·점→score) (Danny 2026-05-24). */
  function renderReplayStats() {
    var box = el('replay-stats');
    if (!box) return;
    var a = R.analysis || {};
    var ms = a.maneuverStats || {};
    var sm = a.summary || {};
    var sess = R.session || {};

    function num(v) { return (v != null && isFinite(v)) ? v : null; }
    function pct(v) { v = num(v); return v == null ? '—' : Math.round(v) + '%'; }
    function spd(v) {
      v = num(v);
      return (v == null || v <= 0) ? '—' : toSpeed(v).toFixed(1);
    }
    var tackN = num(ms.tack), gybeN = num(ms.gybe), qual = num(ms.avgEfficiency);
    var distKm = (sess.totalDistanceM > 0)
      ? (sess.totalDistanceM / 1000).toFixed(1) : '—';
    var rideSec = num(sm.movingTimeSec) || num(sm.totalDurationSec) || 0;
    var maxTxt = spd(sm.maxSpeedMs), avgTxt = spd(sm.avgSpeedMovingMs);

    function row(k, v, unit, extra) {
      return '<div class="replay-stats__row">' +
        '<span class="replay-stats__k">' + k + '</span>' +
        '<span class="replay-stats__v">' + v +
          (unit ? ' <small>' + unit + '</small>' : '') + '</span>' +
        (extra ? '<span class="replay-stats__x">' + extra + '</span>' : '') +
        '</div>';
    }
    /* 순서 — 세션 일반 요약(거리·시간·속도)을 위, 택킹·자이빙 세부를
       아래에 둔다 (Danny 검토 2026-05-24 A 보정). */
    box.innerHTML =
      '<div class="replay-stats__hd">Session Summary</div>' +
      '<div class="replay-stats__sec">Session</div>' +
      row('Distance', distKm, distKm === '—' ? '' : 'km', '') +
      row('Ride Time', rideSec > 0 ? fmtClock(rideSec) : '—', '', '') +
      row('Top Speed', maxTxt, maxTxt === '—' ? '' : unitLabel(), '') +
      row('Avg Speed', avgTxt, avgTxt === '—' ? '' : unitLabel(), '') +
      '<div class="replay-stats__sec">Tacking · Gybing</div>' +
      row('Tacking', tackN == null ? '—' : tackN,
          tackN == null ? '' : 'times', 'Success rate ' + pct(ms.tackSuccessRate)) +
      row('Gybing', gybeN == null ? '—' : gybeN,
          gybeN == null ? '' : 'times', 'Success rate ' + pct(ms.gybeSuccessRate)) +
      row('Turn Efficiency', qual == null ? '—' : Math.round(qual),
          qual == null ? '' : 'score', '');
  }

  /* ============================================================
   * 6) 우측 — 미니그래프 (30초 창 · 흰색 선 · 윈도우 자동 스케일)
   * ============================================================ */
  function buildGraphs() {
    var box = el('replay-graphs');
    box.innerHTML = '';
    R.graphs = [];
    R.metricSlots.forEach(function (slot) {
      var def = slot.def;
      var card = document.createElement('div');
      card.className = 'replay-graph';
      card.hidden = !R.shown[def.key];

      if (slot.state === 'needwind') {
        card.className += ' replay-graph--nowind';
        card.innerHTML =
          '<div class="replay-graph__head">' +
            '<span class="replay-graph__label">' + def.label + '</span>' +
            '<span class="replay-graph__val replay-graph__val--muted">Wind needed</span>' +
          '</div>' +
          '<div class="replay-graph__note">' + def.label + ' needs a set ' +
            'wind direction. Set the wind direction in the dashboard\'s ' +
            '<b>Wind Settings</b>, then reopen the replay.</div>';
        box.appendChild(card);
        R.graphs.push({ def: def, state: 'needwind', card: card });
        return;
      }

      var series = buildSeries(R.samples, def.field);
      var range = computeRange(def, series);
      card.innerHTML =
        '<div class="replay-graph__head">' +
          '<span class="replay-graph__label">' + def.label + '</span>' +
          '<span class="replay-graph__val" id="rg-val-' + def.key + '">—</span>' +
        '</div>' +
        '<canvas class="replay-graph__cv" id="rg-cv-' + def.key + '"></canvas>';
      box.appendChild(card);
      R.graphs.push({
        def: def, state: 'data', series: series,
        vmin: range[0], vmax: range[1], card: card,
        canvas: card.querySelector('canvas'),
        valEl: card.querySelector('.replay-graph__val'),
        w: 0, h: 0, dpr: 1
      });
    });
    if (!R.graphs.length) {
      box.innerHTML = '<p class="replay-graph__empty">No metrics to ' +
        'show.</p>';
    }
  }

  /* 미니그래프 캔버스 크기 설정 (레이아웃·리사이즈 시) */
  function sizeGraphs() {
    var dpr = global.devicePixelRatio || 1;
    R.graphs.forEach(function (g) {
      if (g.state !== 'data' || !g.canvas) return;
      var w = g.canvas.clientWidth || 270;
      var h = g.canvas.clientHeight || 86;
      g.w = w; g.h = h; g.dpr = dpr;
      g.canvas.width = Math.round(w * dpr);
      g.canvas.height = Math.round(h * dpr);
    });
  }

  /* 미니그래프 Y축 "깔끔한" 눈금값 — vmin~vmax 사이 3~4개.
     격자선·왼쪽 축 숫자가 같은 값을 공유해 스케일이 읽힌다. */
  function miniYTicks(vmin, vmax) {
    var span = vmax - vmin;
    if (!(span > 0)) return [vmin];
    var raw = span / 3;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    var out = [];
    for (var v = Math.ceil(vmin / step - 1e-9) * step;
         v <= vmax + 1e-9 && out.length < 8; v += step) {
      out.push(v);
    }
    return out;
  }

  /* 현재 창([winLo,winHi]) 안 데이터의 값 범위 — Y축을 이 범위에 맞춰
     자동 스케일한다(Danny 검토 2026-05-23 §D3 — 전체 세션 범위로
     고정하면 창 안 변화가 납작한 일자선으로 보이던 결함 수정). 창에
     데이터가 없으면 전체 세션 범위로 폴백. 반환 [lo, hi]. */
  function miniWindowRange(g, winLo, winHi) {
    var s = g.series, lo = Infinity, hi = -Infinity, n = 0;
    for (var i = 0; i < s.t.length; i++) {
      if (s.t[i] < winLo) continue;
      if (s.t[i] > winHi) break;
      var v = s.v[i];
      if (v == null || !isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      n++;
    }
    if (n === 0) return [g.vmin, g.vmax];
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }       // 평탄한 창 — 최소 폭
    var pad = (hi - lo) * 0.14;
    return [lo - pad, hi + pad];
  }

  /* 미니그래프 1개 — 현재 30초 창을 필름처럼 그린다.
     재생 헤드는 항상 가로 중앙, 데이터가 그 밑을 스크롤한다.
     격자선 + 왼쪽 Y축 숫자(스케일)를 깔아 값이 읽히게 하고(§B2),
     Y축은 창 안 데이터 범위로 자동 스케일해 변화가 또렷이 보이게
     한다(§D3). 선은 흰색으로 통일(§D1). */
  function drawMiniGraph(g, playT, st) {
    if (g.state !== 'data' || !g.canvas || !g.w) return;
    var ctx = g.canvas.getContext('2d');
    var dpr = g.dpr, w = g.w, h = g.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    /* padL 을 키워 왼쪽 Y축 숫자 자리를 확보한다 */
    var padL = 32, padR = 6, padT = 8, padB = 6;
    var plotW = Math.max(w - padL - padR, 10);
    var plotH = Math.max(h - padT - padB, 10);
    var winLo = playT - MINI_WIN, winHi = playT + MINI_WIN;
    var def = g.def, s = g.series;

    /* Y축 — 창 안 데이터 범위로 자동 스케일 (§D3) */
    var wr = miniWindowRange(g, winLo, winHi);
    var vlo = wr[0], vhi = wr[1];

    function xFor(t) { return padL + (t - winLo) / (2 * MINI_WIN) * plotW; }
    function yFor(val) {
      var rng = vhi - vlo || 1;
      return padT + plotH - (clamp(val, vlo, vhi) - vlo) / rng * plotH;
    }

    /* --- 격자 + 왼쪽 Y축 숫자 --- */
    var yTicks = miniYTicks(vlo, vhi);
    ctx.font = '9px system-ui,sans-serif';
    ctx.textBaseline = 'middle';
    yTicks.forEach(function (tv) {
      var gy = yFor(tv);
      if (gy < padT - 0.5 || gy > padT + plotH + 0.5) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + plotW, gy);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,232,244,0.62)';
      ctx.textAlign = 'right';
      ctx.fillText(tickLabel(def, tv), padL - 4, gy);
    });
    /* 세로 격자 — ±2.5초 보조선 (시간 스케일 감각) */
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    [winLo + MINI_WIN * 0.5, winHi - MINI_WIN * 0.5].forEach(function (vt) {
      var vx = xFor(vt);
      ctx.beginPath(); ctx.moveTo(vx, padT); ctx.lineTo(vx, padT + plotH); ctx.stroke();
    });
    /* 플롯 영역 외곽 */
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL + 0.5, padT + 0.5, plotW - 1, plotH - 1);

    // 0 기준선 (signed 지표 · 창 범위가 0 을 가로지를 때) — 격자보다 진하게
    if (def.signed && vlo < 0 && vhi > 0) {
      var zy = yFor(0);
      ctx.strokeStyle = 'rgba(255,255,255,0.26)';
      ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(padL, zy); ctx.lineTo(padL + plotW, zy);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // 창 안 데이터 곡선 (양옆 1샘플 여유 — 선이 가장자리까지 이어지게).
    // 선은 흰색으로 통일한다 (§D1).
    var i0 = sampleIndexAtTime(R.samples, winLo);
    if (i0 > 0) i0--;
    ctx.strokeStyle = MINI_LINE;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    var pen = false;
    for (var i = i0; i < R.samples.length; i++) {
      var sv = R.samples[i];
      if (sv.t > winHi + 0.001) {
        var rawEnd = sv[def.field];
        if (rawEnd != null && isFinite(rawEnd)) {
          var xe = xFor(sv.t), ye = yFor(rawEnd);
          if (pen) ctx.lineTo(xe, ye);
        }
        break;
      }
      var raw = sv[def.field];
      if (raw == null || !isFinite(raw)) { pen = false; continue; }
      var x = xFor(sv.t), y = yFor(raw);
      if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 재생 헤드 — 가로 중앙 세로선
    var cx = padL + plotW / 2;
    ctx.strokeStyle = CURSOR;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + plotH); ctx.stroke();

    // 현재값 점
    var cv = st ? st[def.field] : null;
    if (cv != null && isFinite(cv)) {
      var cy = yFor(cv);
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = MINI_LINE; ctx.fill();
      ctx.strokeStyle = '#0B1018'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    if (g.valEl) g.valEl.textContent = fmtMetric(def, cv);
  }

  function drawMiniGraphs(playT, st) {
    for (var i = 0; i < R.graphs.length; i++) {
      var g = R.graphs[i];
      if (g.state !== 'data' || !R.shown[g.def.key]) continue;
      drawMiniGraph(g, playT, st);
    }
  }

  /* ============================================================
   * 7) 하단 — 메인 트랙 스트립 (줌 가능 · 지표 연동)
   * ============================================================ */
  /* 트랙 줌 범위를 재생 헤드 중심으로 다시 잡는다.
     span >= dur 이면 전체 세션. 좁으면 playT 를 중심에 둔다. */
  function setTrackWindow() {
    var span = clamp(R.trackSpan, Math.min(R.dur, TRACK_MIN_SPAN), R.dur);
    R.trackSpan = span;
    if (R.dur - span < 0.001) {
      R.winStart = R.t0; R.winEnd = R.t1;
    } else {
      var s = clamp(R.playT - span / 2, R.t0, R.t1 - span);
      R.winStart = s; R.winEnd = s + span;
    }
    var spanEl = el('replay-tspan');
    if (spanEl) {
      spanEl.textContent = (R.dur - span < 0.001)
        ? 'Full' : ('±' + fmtClock(span / 2));
    }
    rebuildTrack();
    if (R.mapLinked) updateMapWindow();
  }
  function zoomTrack(factor) {
    setTrackSpanValue(R.trackSpan * factor);
  }
  function setTrackSpanValue(span) {
    R.trackSpan = clamp(span, Math.min(R.dur, TRACK_MIN_SPAN), R.dur);
    setTrackWindow();
    drawTrackCursor();
  }

  function sizeTrack() {
    var cv = el('replay-track');
    if (!cv) return;
    var dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || 900, h = cv.clientHeight || 84;
    R.trackW = w; R.trackH = h; R.trackDpr = dpr;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    if (!R.trackOff) R.trackOff = document.createElement('canvas');
    R.trackOff.width = cv.width;
    R.trackOff.height = cv.height;
  }

  /* 트랙 스트립을 오프스크린에 1회 프리렌더 — 선택 지표를 각자
     자기 범위로 정규화해 겹쳐 그리고, 시간 눈금을 깐다. */
  function rebuildTrack() {
    if (!R.trackOff || !R.trackW) return;
    var off = R.trackOff, dpr = R.trackDpr, w = R.trackW, h = R.trackH;
    var ctx = off.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var padL = 8, padR = 8, padT = 16, padB = 16;
    var plotW = Math.max(w - padL - padR, 10);
    var plotH = Math.max(h - padT - padB, 10);
    R.trackPlot = { x: padL, y: padT, w: plotW, h: plotH };
    var winLo = R.winStart, winHi = R.winEnd, span = winHi - winLo || 1;
    function xFor(t) { return padL + (t - winLo) / span * plotW; }

    // 배경
    ctx.fillStyle = 'rgba(10,16,26,0.55)';
    roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 8);
    ctx.fill();

    // 시간 눈금 — 실제 시각(real clock) 기준. 영상 녹화 시각과 눈으로
    // 대조하도록 (Danny 검토 2026-05-23 §B6).
    var ticks = trackTimeTicks(winLo, winHi);
    ctx.font = '10px system-ui,sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ticks.forEach(function (tk) {
      var x = xFor(tk.t);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = 'rgba(220,232,244,0.55)';
      ctx.fillText(tk.label, x, h - 4);
    });

    // leg 공백(제외 구간) 음영
    if (R.session && R.session.legs && R.session.legs.length > 1) {
      for (var li = 1; li < R.session.legs.length; li++) {
        var gapA = R.samples[R.session.legs[li - 1].end].t;
        var gapB = R.samples[R.session.legs[li].start].t;
        if (gapB <= winLo || gapA >= winHi) continue;
        var gx1 = xFor(Math.max(gapA, winLo)), gx2 = xFor(Math.min(gapB, winHi));
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(gx1, padT, Math.max(1, gx2 - gx1), plotH);
      }
    }

    // 선택 지표 — 각자 범위로 정규화해 겹쳐 그린다
    var i0 = sampleIndexAtTime(R.samples, winLo);
    if (i0 > 0) i0--;
    var i1 = sampleIndexAtTime(R.samples, winHi);
    if (i1 < R.samples.length - 1) i1++;
    R.graphs.forEach(function (g) {
      if (g.state !== 'data' || !R.shown[g.def.key]) return;
      var rng = g.vmax - g.vmin || 1;
      function yFor(val) {
        return padT + plotH - (clamp(val, g.vmin, g.vmax) - g.vmin) / rng * plotH;
      }
      // SOG 는 면 채움으로 강조
      if (g.def.key === 'sog') {
        ctx.beginPath();
        var started = false;
        for (var k = i0; k <= i1; k++) {
          var sp = R.samples[k][g.def.field];
          if (sp == null || !isFinite(sp)) continue;
          var xx = xFor(R.samples[k].t);
          if (!started) { ctx.moveTo(xx, padT + plotH); started = true; }
          ctx.lineTo(xx, yFor(sp));
        }
        if (started) {
          ctx.lineTo(xFor(R.samples[i1].t), padT + plotH);
          ctx.closePath();
          ctx.fillStyle = 'rgba(51,161,255,0.16)';
          ctx.fill();
        }
      }
      ctx.strokeStyle = g.def.color;
      ctx.lineWidth = (g.def.key === 'sog') ? 1.8 : 1.4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      var pen = false;
      for (var j = i0; j <= i1; j++) {
        var raw = R.samples[j][g.def.field];
        if (raw == null || !isFinite(raw)) { pen = false; continue; }
        var x = xFor(R.samples[j].t), y = yFor(raw);
        if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // 회전(택/자이브) 마커 — 창 안의 것만
    var mans = (R.analysis && R.analysis.maneuvers) || [];
    mans.forEach(function (m) {
      var ap = R.samples[m.apexIdx];
      if (!ap || ap.t < winLo || ap.t > winHi) return;
      var mx = xFor(ap.t);
      ctx.fillStyle = m.type === 'gybe' ? '#EF7D00'
        : (m.type === 'tack' ? '#33A1FF' : '#8295A8');
      ctx.beginPath(); ctx.arc(mx, padT + 4, 3, 0, Math.PI * 2); ctx.fill();
    });

    // 영상 클립 구간 (Danny 검토 2026-05-23 §B7·§C2) — 트랙 상단 레인에
    // 클립별 띠를 깔아 어디에 영상이 있는지 보이게 하고, 마우스 드래그로
    // 옮길 수 있게 한다. 히트테스트용 화면좌표를 R.clipBars 에 저장한다.
    R.clipBars = [];
    var laneY = 2, laneH = 13;
    (R.clips || []).forEach(function (clip) {
      var cdur = clip.duration || (clip.meta && clip.meta.durationSec) || 0;
      if (cdur <= 0) return;
      var ct0 = R.t0 + clip.startElapsed, ct1 = ct0 + cdur;
      if (ct1 < winLo || ct0 > winHi) return;
      var cx1 = xFor(Math.max(ct0, winLo));
      var cx2 = xFor(Math.min(ct1, winHi));
      var cw2 = Math.max(3, cx2 - cx1);
      var on = (clip.id === R.activeClipId);
      var dragging = (R.clipDrag && R.clipDrag.id === clip.id);
      ctx.fillStyle = (on || dragging)
        ? 'rgba(51,161,255,0.92)' : 'rgba(51,161,255,0.50)';
      roundRect(ctx, cx1, laneY, cw2, laneH, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,205,255,0.95)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (cw2 > 46) {
        var nm = '🎬 ' + clip.name;
        var maxCh = Math.floor((cw2 - 10) / 5.4);
        if (nm.length > maxCh) nm = nm.slice(0, Math.max(1, maxCh - 1)) + '…';
        ctx.fillStyle = '#06121F';
        ctx.font = '700 9px system-ui,sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(nm, cx1 + 5, laneY + laneH / 2 + 0.5);
      }
      R.clipBars.push({ id: clip.id, x1: cx1, x2: cx1 + cw2,
        y0: laneY - 2, y1: laneY + laneH + 2 });
    });
  }

  /* 트랙 — 오프스크린 blit + 재생 헤드 */
  function drawTrackCursor() {
    var cv = el('replay-track');
    if (!cv || !R.trackOff || !R.trackPlot) return;
    var ctx = cv.getContext('2d');
    var dpr = R.trackDpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(R.trackOff, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var p = R.trackPlot;
    var span = R.winEnd - R.winStart || 1;
    var x = p.x + (R.playT - R.winStart) / span * p.w;
    x = clamp(x, p.x, p.x + p.w);
    ctx.strokeStyle = CURSOR;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, p.y - 6); ctx.lineTo(x, p.y + p.h + 6); ctx.stroke();
    ctx.fillStyle = CURSOR;
    ctx.beginPath();
    ctx.moveTo(x - 4, p.y - 6); ctx.lineTo(x + 4, p.y - 6); ctx.lineTo(x, p.y - 1);
    ctx.closePath(); ctx.fill();
  }

  /* "깔끔한" 시간 눈금 값 배열 */
  function niceTicks(lo, hi, want) {
    var span = hi - lo;
    if (span <= 0) return [lo];
    var raw = span / want;
    var steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
    var step = steps[steps.length - 1];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] >= raw) { step = steps[i]; break; }
    }
    var out = [], t = Math.ceil(lo / step) * step;
    for (; t <= hi + 1e-6 && out.length < 40; t += step) out.push(t);
    return out;
  }

  /* 하단 트랙 시간 눈금 — 세션이 절대 시각(startEpoch)을 가지면 실제
     시각(real clock)으로, 없으면 경과 시간으로 라벨링한다. 실제 시각일
     때는 눈금을 시계 경계(정각 초/분)에 맞춰 영상 시계와 대조하기 쉽게
     한다 (Danny 검토 2026-05-23 §B6). 반환: [{ t, label }] —
     t 는 세션 경과초 도메인(기존 xFor 가 그대로 소비). */
  function trackTimeTicks(winLo, winHi) {
    var startEpoch = R && R.session && R.session.startEpoch;
    if (startEpoch == null || !isFinite(startEpoch)) {
      return niceTicks(winLo, winHi, 6).map(function (t) {
        return { t: t, label: fmtClock(t - R.t0) };
      });
    }
    var span = winHi - winLo;
    if (!(span > 0)) return [{ t: winLo, label: fmtRealClock(startEpoch) }];
    var raw = span / 6;
    var steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
    var step = steps[steps.length - 1];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] >= raw) { step = steps[i]; break; }
    }
    /* 경과초 t ↔ 실제 epoch(초) — startEpoch 는 t=R.t0 시점에 대응 */
    var baseSec = startEpoch / 1000;
    function epochSecAt(t) { return baseSec + (t - R.t0); }
    var loSec = epochSecAt(winLo), hiSec = epochSecAt(winHi);
    var out = [];
    for (var es = Math.ceil(loSec / step) * step;
         es <= hiSec + 1e-6 && out.length < 40; es += step) {
      out.push({ t: R.t0 + (es - baseSec), label: fmtRealClock(es * 1000) });
    }
    return out;
  }

  /* 트랙 클릭/드래그 → 시킹 · 상단 클립 바 드래그 → 클립 이동 */
  function bindTrack() {
    var cv = el('replay-track');
    if (!cv) return;
    function rectOf() {
      return cv.getBoundingClientRect
        ? cv.getBoundingClientRect()
        : { left: 0, top: 0, width: R.trackW || 900 };
    }
    function tAt(ev) {
      var rect = rectOf();
      var px = (ev.clientX || 0) - rect.left;
      var p = R.trackPlot || { x: 8, w: (R.trackW || 900) - 16 };
      var f = clamp((px - p.x) / (p.w || 1), 0, 1);
      return R.winStart + f * (R.winEnd - R.winStart);
    }
    /* 포인터가 어느 클립 바 위인지 — rebuildTrack 이 저장한 화면좌표로 */
    function clipAt(ev) {
      var rect = rectOf();
      var px = (ev.clientX || 0) - rect.left;
      var py = (ev.clientY || 0) - rect.top;
      var bars = R.clipBars || [];
      for (var i = bars.length - 1; i >= 0; i--) {
        var b = bars[i];
        if (px >= b.x1 - 3 && px <= b.x2 + 3 && py >= b.y0 && py <= b.y1) {
          return clipById(b.id);
        }
      }
      return null;
    }
    cv.addEventListener('pointerdown', function (ev) {
      /* 상단 레인의 클립 바를 잡으면 — 클립 드래그(시작 시각 이동, §C2) */
      var clip = clipAt(ev);
      if (clip) {
        R.clipDrag = { id: clip.id,
          grabDT: tAt(ev) - (R.t0 + clip.startElapsed) };
        try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
        cv.style.cursor = 'grabbing';
        return;
      }
      R.trackDrag = true;
      R.scrubbing = true; R.scrubWasPlaying = R.playing;
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      seek(tAt(ev), true);
    });
    cv.addEventListener('pointermove', function (ev) {
      if (R.clipDrag) {
        var clip = clipById(R.clipDrag.id);
        if (clip) {
          var newStartT = tAt(ev) - R.clipDrag.grabDT;
          clip.startElapsed = Math.round((newStartT - R.t0) * 10) / 10;
          clip.place = 'manual';
          clip.placeSource = 'Manual placement';
          rebuildTrack();          // 클립 바 + R.clipBars 갱신
          drawTrackCursor();
        }
        return;
      }
      if (R.trackDrag) { seek(tAt(ev), true); return; }
      /* 호버 커서 — 클립 바 위면 grab(잡을 수 있음) 표시 */
      cv.style.cursor = clipAt(ev) ? 'grab' : 'pointer';
    });
    function endDrag(ev) {
      try { cv.releasePointerCapture(ev.pointerId); } catch (e) {}
      if (R.clipDrag) {
        var clip = clipById(R.clipDrag.id);
        R.clipDrag = null;
        cv.style.cursor = 'pointer';
        if (clip) setClipStart(clip, clip.startElapsed);  // 패널 갱신 + 저장
        return;
      }
      if (!R.trackDrag) return;
      R.trackDrag = false;
      R.scrubbing = false;
      if (R.scrubWasPlaying && !R.playing) { R.lastTs = null; setPlaying(true); }
    }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);

    /* 트랙패드 제스처 줌 (Danny 검토 2026-05-23 §B5) — 두 손가락
       세로 스크롤·핀치(ctrlKey wheel) 모두 트랙 시간창을 줌한다.
       위로(벌리기) = 확대, 아래로(오므리기) = 축소. deltaY 에 비례한
       부드러운 줌이며, 한 이벤트의 배율은 0.5~2 로 제한해 큰 점프를
       막는다. preventDefault 로 페이지가 스크롤되지 않게 한다. */
    cv.addEventListener('wheel', function (ev) {
      if (ev.preventDefault) ev.preventDefault();
      var delta = ev.deltaY || 0;
      if (!delta) return;
      var factor = clamp(Math.pow(1.0022, delta), 0.5, 2);
      setTrackSpanValue(R.trackSpan * factor);
    }, { passive: false });
  }

  /* ============================================================
   * 8) 무대 — 지도 (Leaflet · 보드 중앙 · 윈도우 트랙)
   * ============================================================ */
  function ensureMap() {
    if (R.map || typeof global.L === 'undefined') return;
    var L = global.L;
    var mapEl = el('replay-map');
    if (!mapEl) return;
    try {
      /* Leaflet 기본 줌 컨트롤은 라이트 테마라 다크 뷰어와 어긋나고
         좌상단 라이더 카드와 겹친다 — 끄고 다크 톤 버튼을 따로 둔다. */
      R.map = L.map(mapEl, {
        zoomControl: false, attributionControl: true, preferCanvas: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
      }).addTo(R.map);
    } catch (e) { R.map = null; return; }

    // 사용자가 직접 팬/줌하면 보드 자동추적을 끈다 (프로그램 이동은 제외)
    R.map.on('dragstart', function () {
      if (!R._mapProg) R.mapUserMoved = true;
    });
    R.map.on('zoomstart', function () {
      if (!R._mapProg) R.mapUserMoved = true;
    });
    /* 지도 이동·줌이 끝나면 풍상 레드라인을 보드 위치에 다시 맞춘다
       (정지 중 줌·재배치 시에도 ladder rung 이 보드에 붙어 있게). */
    R.map.on('moveend', function () { R._mapProg = false; drawBoardLines(); });
    R.map.on('zoomend', function () { drawBoardLines(); });

    /* 재생 위치 마커 — 동적 보드 아이콘. 보드 아웃라인(Levitaz Free
       Series 탑뷰 실루엣)은 진행 방향(헤딩)으로 회전(.rd-ph__rot),
       세일은 보드 앞 1/3 피벗(0,SAIL.pivotY)을 축으로 회전한다
       (.rd-ph__sail · updateSailIcon). 보드는 노즈가 위(−y)를 향한
       로컬 좌표로 그린다. (Danny 2026-05-24) */
    var html =
      '<div class="rd-ph"><div class="rd-ph__rot">' +
        '<svg viewBox="-44 -44 88 88" width="56" height="56">' +
          /* 보드 아웃라인 — 둥근 노즈·앞쪽 최대폭·둥근 테일 */
          '<path class="rd-ph__board" d="M0,-26 C4.2,-25.4 8.4,-18 9.2,-7 ' +
            'C9.7,1 8.2,15 4.6,23.5 C3,27.2 -3,27.2 -4.6,23.5 ' +
            'C-8.2,15 -9.7,1 -9.2,-7 C-8.4,-18 -4.2,-25.4 0,-26 Z" ' +
            'fill="#0A2540" stroke="#FFFFFF" stroke-width="1.8" ' +
            'stroke-linejoin="round"/>' +
          /* 데크 패드 — 방향감을 주는 옅은 안쪽 면 */
          '<path d="M0,-3 C3,-3 5.4,0.5 5.4,6.5 C5.4,14 3.4,19 0,19 ' +
            'C-3.4,19 -5.4,14 -5.4,6.5 C-5.4,0.5 -3,-3 0,-3 Z" ' +
            'fill="#22425E"/>' +
          /* 세일(윙) — 앞쪽 1/3 피벗에서 회전. 좌우 대칭 블레이드라
             택 전환 시 회전 부호만으로 양쪽을 표현한다. */
          '<g class="rd-ph__sail">' +
            '<path d="M0,-13 C4.8,-11 5.8,3 3.3,17 C2.1,21.5 0.7,23 0,23 ' +
              'C-0.7,23 -2.1,21.5 -3.3,17 C-5.8,3 -4.8,-11 0,-13 Z" ' +
              'fill="#FFB000" stroke="#0A2540" stroke-width="1.4" ' +
              'stroke-linejoin="round"/>' +
          '</g>' +
        '</svg></div></div>';
    var icon = L.divIcon({
      className: 'rd-ph-icon', html: html, iconSize: [56, 56], iconAnchor: [28, 28]
    });
    R.mapPlayhead = L.marker([R.samples[0].lat, R.samples[0].lng], {
      icon: icon, interactive: false, keyboard: false, zIndexOffset: 1000
    }).addTo(R.map);

    R.mapTrack = [];
    R.mapMans = [];
    updateMapWindow();
  }

  /* 지도에 표시할 트랙 시간범위를 갱신 — 연동 켜짐이면 트랙 줌 창,
     꺼짐이면 전체 세션. 속도색 폴리라인으로 다시 그린다. */
  function updateMapWindow() {
    if (!R.map || typeof global.L === 'undefined') return;
    var L = global.L;
    var lo = R.mapLinked ? R.winStart : R.t0;
    var hi = R.mapLinked ? R.winEnd : R.t1;

    (R.mapTrack || []).forEach(function (ly) {
      try { R.map.removeLayer(ly); } catch (e) {}
    });
    (R.mapMans || []).forEach(function (ly) {
      try { R.map.removeLayer(ly); } catch (e) {}
    });
    R.mapTrack = []; R.mapMans = [];

    var i0 = sampleIndexAtTime(R.samples, lo);
    var i1 = sampleIndexAtTime(R.samples, hi);
    if (i1 < R.samples.length - 1) i1++;
    var maxKt = R.maxKt;
    var pts = [];
    for (var i = i0; i < i1; i++) {
      var p0 = R.samples[i], p1 = R.samples[i + 1];
      var kt = ((p1.speed || 0)) * KT;
      var seg = L.polyline([[p0.lat, p0.lng], [p1.lat, p1.lng]], {
        /* 가는 선 — 트랙이 마커·바람 격자를 가리지 않게 (Danny
           2026-05-24: 항적선이 굵다 → 가늘게). */
        color: speedRamp(maxKt > 0 ? kt / maxKt : 0), weight: 2.5, opacity: 0.95
      });
      seg.addTo(R.map);
      R.mapTrack.push(seg);
      pts.push([p0.lat, p0.lng]);
    }
    if (R.samples[i1]) pts.push([R.samples[i1].lat, R.samples[i1].lng]);

    // 회전 마커 — 범위 안의 것만
    var mans = (R.analysis && R.analysis.maneuvers) || [];
    mans.forEach(function (m) {
      var ap = R.samples[m.apexIdx];
      if (!ap || ap.t < lo || ap.t > hi) return;
      var col = m.type === 'gybe' ? '#EF7D00'
        : (m.type === 'tack' ? '#33A1FF' : '#8295A8');
      var mk = L.circleMarker([ap.lat, ap.lng], {
        radius: 6, color: '#fff', weight: 2, fillColor: col, fillOpacity: 0.95
      });
      mk.addTo(R.map); R.mapMans.push(mk);
    });

    // 선택 프레임 범위가 지도에 꽉 차게
    if (pts.length > 1 && !R.mapUserMoved) {
      try {
        R._mapProg = true;
        R.map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 18 });
      } catch (e) { R._mapProg = false; }
    }
  }

  /* 동적 보드 아이콘 — 세일 신호각 산출 (Danny 2026-05-24).
     반환 = 보드 중심선 기준 부호 있는 세일각(도) · 풍향/헤딩/TWA 가
     없어 산출 불가하면 null. 새 계산 없이 이미 보간된 st(헤딩·TWA·
     속도)를 그대로 받아 매핑만 한다.
       · 크기 = TWA 기반 기본각 + SOG 기반 개폐 (SAIL 상수)
       · 부호 = 택 (풍향 대비 헤딩이 어느 쪽인지) · 택/자이브 시
         R.sailSide 를 보간해 세일이 반대쪽으로 부드럽게 넘어간다 */
  function updateSailIcon(st) {
    if (!st || st.heading == null || R.windDir == null || st.twa == null) {
      return null;
    }
    var twa = Math.abs(st.twa);
    var sogKt = (st.speed || 0) * KT;
    /* 기본 받음각 — TWA 를 [twaMin,twaMax] → [angMin,angMax] 로 매핑 */
    var f = (twa - SAIL.twaMin) / (SAIL.twaMax - SAIL.twaMin);
    f = f < 0 ? 0 : (f > 1 ? 1 : f);
    var mag = SAIL.angMin + f * (SAIL.angMax - SAIL.angMin);
    /* 속도 개폐 — 빠르면 닫힘(−), 느리면 열림(+) */
    var adj = (SAIL.sogMid - sogKt) * SAIL.sogGain;
    if (adj > SAIL.sogClamp) adj = SAIL.sogClamp;
    if (adj < -SAIL.sogClamp) adj = -SAIL.sogClamp;
    mag += adj;
    if (mag < SAIL.hardMin) mag = SAIL.hardMin;
    if (mag > SAIL.hardMax) mag = SAIL.hardMax;
    /* 세일은 풍하측(리워드 사이드)에 놓인다 — 바람이 부는 쪽 반대.
       awa = angDiff(풍향, 헤딩)  (풍향 = 바람이 불어오는 쪽 = 풍상).
       awa > 0 → 바람이 보드 좌현(포트)에서 와 세일은 우현(스타보드)으로,
       awa < 0 → 바람이 우현에서 와 세일은 좌현(포트)으로 간다. SVG 에서
       rotate(+) 는 세일을 좌현(−x)으로, rotate(−) 는 우현(+x)으로 돌리
       므로 부호는 −sign(awa) 가 된다 (Danny 2026-05-24: 세일이 풍향
       정반대로 렌더되던 버그 — 부호 정정). 재생 중엔 보간(부드러운
       전환), 정지·스크럽 중엔 즉시 스냅(부분 전환 잔상 방지). */
    var awa = angDiff(R.windDir, st.heading);
    var target = (awa >= 0) ? -1 : 1;
    if (R.sailSide == null || !R.playing) {
      R.sailSide = target;
    } else {
      R.sailSide += (target - R.sailSide) * SAIL.flipLerp;
    }
    return R.sailSide * mag;
  }

  /* 재생 헤드 — 마커 이동·헤딩 회전·세일 거동. 보드 추적 시 화면
     가장자리에 닿으면 부드럽게 보드를 다시 중앙으로 가져온다. */
  function updateMapPlayhead(st) {
    if (!R.map || !R.mapPlayhead || !st) return;
    R.mapPlayhead.setLatLng([st.lat, st.lng]);
    var rootEl = R.mapPlayhead.getElement();
    if (rootEl) {
      var arrow = rootEl.querySelector('.rd-ph__rot');
      if (arrow) {
        arrow.style.transform =
          (st.heading != null) ? 'rotate(' + st.heading + 'deg)' : 'rotate(0deg)';
        arrow.style.opacity = (st.heading != null) ? '1' : '0.35';
      }
      /* 세일 — 앞 1/3 피벗(0,SAIL.pivotY) 중심 회전. 산출 불가 시 숨김. */
      var sail = rootEl.querySelector('.rd-ph__sail');
      if (sail) {
        var sa = updateSailIcon(st);
        if (sa == null) {
          sail.style.display = 'none';
        } else {
          sail.style.display = '';
          sail.setAttribute('transform',
            'rotate(' + sa.toFixed(1) + ' 0 ' + SAIL.pivotY + ')');
        }
      }
    }
    if (R.mapTrackMode) {
      /* 보드 추적 모드 — 매 프레임 지도를 보드 위치로 recenter 한다.
         사용자가 추적 모드를 직접 켰으므로 mapUserMoved 는 무시한다. */
      try {
        R._mapProg = true;
        R.map.setView(R.mapPlayhead.getLatLng(), R.map.getZoom(), { animate: false });
      } catch (e) {}
    } else if (R.mapFollow && !R.mapUserMoved) {
      /* 고정 지도 모드 — 보드가 화면 가장자리에 닿을 때만 재배치한다. */
      try {
        var b = R.map.getBounds();
        if (!b.pad(-0.28).contains(R.mapPlayhead.getLatLng())) {
          R._mapProg = true;
          R.map.setView(R.mapPlayhead.getLatLng(), R.map.getZoom(), { animate: false });
        }
      } catch (e) {}
    }
    /* 보드 바우 끝 선 — 보드가 움직였으니 풍향 축·ladder rung 을 새
       위치로 다시 그린다(토글 꺼진 선은 drawBoardLines 가 건너뛴다). */
    drawBoardLines();
  }

  function recenterMap() {
    R.mapUserMoved = false;
    R.mapFollow = true;
    if (R.map && R.mapPlayhead) {
      try {
        R._mapProg = true;
        R.map.setView(R.mapPlayhead.getLatLng(), R.map.getZoom(), { animate: true });
      } catch (e) {}
    }
  }

  /* ============================================================
   * 9) 무대 — 영상 클립 + 배경 블러
   *
   * 다중 클립 모델 (Danny 검토 2026-05-23 §B7) — 하루에 찍은 여러
   * 클립을 한꺼번에·따로 올릴 수 있고, 각 클립은 자기 녹화 시각
   * 메타데이터(§B3)로 타임라인에 자동 배치된다. 단일 <video> 엘리먼트를
   * 재사용해, 재생 헤드가 든 구간의 클립 src 를 그때그때 싣는다 —
   * 한 시점에 재생되는 클립은 하나뿐이라 이 방식으로 충분하다.
   * 영상 없는 구간은 지도·데이터만 보인다.
   * ============================================================ */
  /* 배경 블러 — 활성 클립의 현재 프레임을 작은 캔버스에 cover 로 그린다.
     CSS blur 가 늘려 깔므로 캔버스는 저해상도로 충분하다(디코드 1회). */
  function drawBlur() {
    if (!R) return;                          // 닫힌 뒤 들어온 영상 이벤트 무시
    var cv = el('replay-blur');
    if (!cv || !R.video) return;
    var v = R.video;
    if (!cv.width) { cv.width = 480; cv.height = 270; }
    var ctx = cv.getContext('2d');
    if (R.activeClipId == null || !v.videoWidth || !v.videoHeight) {
      ctx.clearRect(0, 0, cv.width, cv.height);   // 영상 없는 구간 — 비운다
      return;
    }
    var cw = cv.width, ch = cv.height;
    var scale = Math.max(cw / v.videoWidth, ch / v.videoHeight);
    var dw = v.videoWidth * scale, dh = v.videoHeight * scale;
    try {
      ctx.drawImage(v, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    } catch (e) {}
  }

  /* ============================================================
   * 8b) 지도 풍향 모눈 격자 (C · Danny 2026-05-24)
   *
   * 지도 위에 풍향 기준 graph-paper 격자를 깐다. 정사각 격자를 풍향
   * (R.windDir)으로 회전해 한 축이 풍상-풍하, 직각 축이 크로스윈드가
   * 되게 한다 — 라이더가 트랙을 바람 기준으로 읽도록. 대시보드 풍향
   * 그리드(app.js drawWindGrid)와 같은 방식이되 택 정렬(+45°)이 아니라
   * 바람 축 정렬(+0°)이다. 뷰포트 고정 장식 레이어(지도 타일 위·맵
   * 컨트롤 아래). 풍향 미설정 시엔 그리지 않는다.
   * ============================================================ */
  var WGRID_GAP = 84;                  // 격자 간격(px) — Danny 2026-05-25:
                                       // 42→84 (선 밀도 절반, 너무 조밀했음)

  function sizeWindGrid() {
    var cv = el('replay-wind-grid');
    if (!cv) return;
    var dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || 0, h = cv.clientHeight || 0;
    /* clientWidth 가 0 이면(패널 미배치·숨김) 백업 스토어를 건드리지
       않는다 — 0 으로 줄였다가 다시 키우면 깜빡임이 생긴다. CSS 의
       width/height:100% 가 캔버스를 패널 크기로 고정하므로 여기서
       읽는 clientWidth 는 안정적이다(고유 크기 되먹임 X). */
    if (w <= 0 || h <= 0) return;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }

  function drawWindGrid() {
    var cv = el('replay-wind-grid');
    if (!cv || !cv.getContext) return;
    var w = cv.width, h = cv.height;
    var ctx = cv.getContext('2d');
    /* 캔버스 컨텍스트가 회전 변환을 지원하지 않으면(테스트 스텁 등)
       격자를 건너뛴다 — 실제 브라우저에선 항상 지원한다. */
    if (!ctx || typeof ctx.translate !== 'function' ||
        typeof ctx.rotate !== 'function') return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    /* 풍향이 없으면 바람 축을 정의할 수 없어 격자를 생략한다. */
    if (R.windDir == null || w <= 0 || h <= 0) return;
    var dpr = global.devicePixelRatio || 1;
    var gap = WGRID_GAP * dpr;
    var diag = Math.sqrt(w * w + h * h);
    var half = Math.ceil(diag / 2 / gap) * gap + gap;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(R.windDir * Math.PI / 180);   // 한 축 = 풍상-풍하
    ctx.lineCap = 'round';
    var i;
    /* 모눈 — 밝은 OSM 타일(육지 베이지·바다 하늘색) 위에서 graph-paper
       처럼 또렷이 읽히도록 짙은 네이비를 충분한 불투명도로 깐다. 트랙
       (밝은 초록·주황)·마커보다는 옅어 본 콘텐츠를 가리지 않는다. */
    ctx.strokeStyle = 'rgba(13,40,68,0.34)';
    ctx.lineWidth = dpr;
    for (i = -half; i <= half; i += gap) {
      ctx.beginPath(); ctx.moveTo(i, -half); ctx.lineTo(i, half); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-half, i); ctx.lineTo(half, i); ctx.stroke();
    }
    /* 풍상-풍하 중심축(굵은 검정 선)은 더 이상 격자에 그리지 않는다 —
       보드 바우 끝에 앵커된 별도 토글 선(drawBoardLines)으로 옮겼다
       (Danny 2026-05-25). 격자는 순수 모눈만 둔다. */
    ctx.restore();
  }

  /* ============================================================
   * 8c) ladder rung — 풍상 레드라인 (Danny 2026-05-24)
   *
   * 보드 추적 모드에서 보드 현재 위치를 지나는 가로선을 그린다. 풍향
   * (R.windDir)에 수직 = 풍상-풍하 축에 직각 = 크로스윈드 방향. 세일링
   * 레이싱의 ladder rung(풍상 진행도가 같은 등치선) 개념 — 이 선 기준
   * 어느 보드가 더 풍상에 있는지(앞서 있는지) 읽는다. 솔로 주행에서도
   * 풍상 진행 시각 기준으로 쓰인다. 바람 격자(8b) 위 별도 캔버스
   * (z 6)에 빨강 한 줄로 그리고, 재생 중 보드를 따라 갱신한다.
   * ============================================================ */
  function sizeLadder() {
    var cv = el('replay-ladder');
    if (!cv) return;
    var dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || 0, h = cv.clientHeight || 0;
    if (w <= 0 || h <= 0) return;        // sizeWindGrid 와 동일 가드
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }

  /* 보드 바우 끝 앵커 선 — 풍향 축(검정)·ladder rung(빨강).
     둘 다 보드의 가장 앞쪽 점(바우 끝)을 지나는 선이며, 보드 몸통을
     가로지르지 않도록 보드 아웃라인 영역을 destination-out 으로 지워
     선이 보드 밖에서만 보이게 한다. 각 선은 R.showWindAxis /
     R.showLadder 토글로 켜고 끈다 (Danny 2026-05-25 #2·#3). */
  function drawBoardLines() {
    var cv = el('replay-ladder');
    if (!cv || !cv.getContext) return;
    var w = cv.width, h = cv.height;
    var ctx = cv.getContext('2d');
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!R || R.windDir == null || w <= 0 || h <= 0) return;
    if (!R.showWindAxis && !R.showLadder) return;     // 둘 다 꺼짐
    var map = R.map;
    if (!map || typeof map.latLngToContainerPoint !== 'function') return;
    /* 보드 위치(중심) — 재생 헤드 마커(없으면 보간 상태)의 위경도. */
    var ll = null;
    try {
      if (R.mapPlayhead && typeof R.mapPlayhead.getLatLng === 'function') {
        ll = R.mapPlayhead.getLatLng();
      } else if (R.curState) {
        ll = { lat: R.curState.lat, lng: R.curState.lng };
      }
    } catch (e) { return; }
    if (!ll || ll.lat == null || ll.lng == null) return;
    var cp;
    try { cp = map.latLngToContainerPoint([ll.lat, ll.lng]); }
    catch (e) { return; }
    if (!cp) return;
    var dpr = global.devicePixelRatio || 1;
    var bx = cp.x * dpr, by = cp.y * dpr;          // 보드 중심(백업 스토어 px)
    /* 헤딩 — 보드 아이콘이 향하는 방위. 바우 끝은 중심에서 헤딩 방향
       으로 보드 반길이만큼 앞. 헤딩 없으면(정지) 보드는 북향. */
    var hd = (R.curState && R.curState.heading != null) ? R.curState.heading : 0;
    var hr = hd * Math.PI / 180;
    var hsx = Math.sin(hr), hsy = -Math.cos(hr);   // 헤딩 화면 단위벡터
    /* 보드 아이콘 — viewBox 88 을 56px 로 렌더(축척 56/88). 아웃라인은
       노즈 y=−26·최대폭 x=±9.2 (SVG 단위). */
    var SC = (56 / 88) * dpr;
    var tx = bx + 26 * SC * hsx;                   // 바우 끝(노즈) 픽셀
    var ty = by + 26 * SC * hsy;
    var L = Math.sqrt(w * w + h * h);              // 화면을 항상 가로지름
    var wr = R.windDir * Math.PI / 180;
    ctx.lineCap = 'round';
    /* 한 줄 — 흰 후광 + 본선. (tx,ty) 바우 끝을 지나 방향 (ux,uy). */
    function drawLine(ux, uy, color) {
      var x0 = tx - ux * L, y0 = ty - uy * L;
      var x1 = tx + ux * L, y1 = ty + uy * L;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 5 * dpr;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6 * dpr;
      ctx.stroke();
    }
    /* 풍향 축(검정) = 바람 방향 (sin wd,−cos wd) — 풍상-풍하 축.
       ladder rung(빨강) = 그 직각 (cos wd, sin wd) — 크로스윈드. */
    if (R.showWindAxis) {
      drawLine(Math.sin(wr), -Math.cos(wr), 'rgba(17,22,31,0.92)');
    }
    if (R.showLadder) {
      drawLine(Math.cos(wr), Math.sin(wr), 'rgba(214,22,42,0.95)');
    }
    /* 보드 아웃라인 영역을 지운다 — 선이 보드 몸통을 가로지르지 않고
       바우 끝 바깥에서만 보이게 한다 (Danny 2026-05-25 #3). 보드 모양을
       근사한 타원(반길이 27·반폭 11 SVG + 여유)을 헤딩으로 회전해 지움.
       회전·타원 미지원 스텁에선 지우기만 건너뛴다. */
    if (typeof ctx.rotate === 'function' &&
        typeof ctx.ellipse === 'function' && ctx.save && ctx.restore) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.translate(bx, by);
      ctx.rotate(hr);
      ctx.beginPath();
      ctx.ellipse(0, 0, 27 * SC, 11 * SC, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* 풍향 갱신 — 대시보드에서 풍향이 재확정되면 호출된다(app.js
     confirmWind). 리플레이는 open() 시점의 풍향을 캐시하므로, 재확정
     값을 반영하려면 R.windDir 을 바꾸고 풍향에 의존하는 레이어를 모두
     다시 그려야 한다 — 풍향 격자·ladder rung·세일 (Danny 2026-05-25:
     격자·rung 이 확정 풍향을 안 따라가던 문제). */
  function setWindDir(wd) {
    if (!R) return;
    R.windDir = (wd != null && isFinite(wd)) ? wd : null;
    R.sailSide = null;          // 세일 좌우 보간 상태 리셋(새 풍향 기준)
    drawWindGrid();             // 격자 다시 — 새 풍향 축으로 회전
    seek(R.playT, !R.playing);  // 재생 헤드 갱신 → ladder rung·세일 재계산
  }

  /* 클립 헬퍼 ------------------------------------------------------ */
  function clipById(id) {
    for (var i = 0; i < R.clips.length; i++) {
      if (R.clips[i].id === id) return R.clips[i];
    }
    return null;
  }
  function clipsByStart() {
    return R.clips.slice().sort(function (a, b) {
      return a.startElapsed - b.startElapsed;
    });
  }
  /* 경과시각(elapsed)을 품은 클립 — 겹치면 더 늦게 시작한 클립을 쓴다 */
  function clipAtElapsed(elapsed) {
    var best = null;
    for (var i = 0; i < R.clips.length; i++) {
      var c = R.clips[i];
      var dur = c.duration || (c.meta && c.meta.durationSec) || 0;
      if (dur <= 0) continue;
      if (elapsed >= c.startElapsed - 0.05 &&
          elapsed <= c.startElapsed + dur + 0.05) {
        if (!best || c.startElapsed > best.startElapsed) best = c;
      }
    }
    return best;
  }
  /* 자동 배치 불가 클립을 직전 클립들 뒤에 순서대로 놓는다(겹침 회피) */
  function nextSequentialStart(clip) {
    var s = 0;
    R.clips.forEach(function (c) {
      if (c === clip) return;
      var end = c.startElapsed + (c.duration || (c.meta && c.meta.durationSec) || 0);
      if (end > s) s = end;
    });
    return s;
  }

  /* 영상 파일들을 클립으로 추가 — 여러 개를 한꺼번에/따로 받는다 */
  function loadVideoFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var firstEver = R.clips.length === 0;
    for (var i = 0; i < fileList.length; i++) {
      if (fileList[i]) addClip(fileList[i]);
    }
    R.videoReady = R.clips.length > 0;
    if (firstEver && R.clips.length) {
      var hint = el('replay-nohint');
      if (hint) hint.hidden = true;
      /* §423 — '영상 없음' 배너가 떠 있었다면(cross-device 재업로드) 동기화
         완료 토스트로 교체. 그 외(원래 영상 있던 세션)는 조용히 숨긴다. */
      var vm = el('replay-vmissing');
      if (vm && !vm.hidden && R.hasVideoFlag) videoSyncedToast();
      else hideVideoMissing();
      setLayout('video');
    }
    buildSyncPanel();
    rebuildTrack();
    relayout();
    seek(R.playT, !R.playing);
  }

  /* 클립 1개 추가 — object URL 생성, 메타데이터 비동기 읽기, 첫 클립이면
     <video> 에 즉시 싣는다. */
  function addClip(file) {
    var clip = {
      id: 'clip' + (++R.clipSeq),
      name: file.name || 'Video',
      file: file,
      url: URL.createObjectURL(file),
      meta: null, hasMeta: false,
      duration: 0, startElapsed: 0,
      place: 'pending', placeSource: ''
    };
    R.clips.push(clip);
    R.videoReady = true;
    readVideoMeta(file, clip);                 // 녹화 시각 → 자동 배치
    if (R.activeClipId == null) activateClip(clip);
    /* §189 (샘 2026-06-04) — 영상 파일 자체를 IndexedDB 에 백그라운드
       보존. 배치값(rd_videosync_v1)만 저장하던 기존 방식은 재방문 시
       영상을 다시 올려야 했다 — blob 까지 저장해 "저장한 내용이 모두
       그대로" 남게 한다. 저장 실패(quota 등)는 console.warn 만 —
       리플레이 본 기능은 그대로 동작한다. IndexedDB 에서 복원된
       파일(_rdRestored)은 다시 쓰지 않는다(동일 blob 재기록 회피).
       같은 이름 파일을 다시 올리면 put 으로 덮어쓴다. */
    persistClipBlob(clip);
  }

  /* §189 (샘 2026-06-04) — 클립 blob 영구 저장 (실패해도 본 기능 무손상) */
  function persistClipBlob(clip) {
    try {
      if (!global.RDStorage || !global.RDStorage.saveVideoBlob) return;
      if (!R || !R.sessionSig || !clip || !clip.file) return;
      if (clip.file._rdRestored) return;       // 복원분 — 이미 저장돼 있음
      var file = clip.file, name = clip.name, sig = R.sessionSig;
      function doSave() {
        global.RDStorage.saveVideoBlob(sig, name, file)['catch'](function (e) {
          console.warn('§189 video blob save failed (' + name + '):', e);
        });
      }
      /* 용량 안전 — 추정 가능하면 남은 quota 가 파일보다 작을 때 skip */
      if (global.navigator && global.navigator.storage &&
          typeof global.navigator.storage.estimate === 'function') {
        global.navigator.storage.estimate().then(function (est) {
          var free = (est && est.quota != null && est.usage != null)
            ? (est.quota - est.usage) : null;
          if (free != null && file.size != null && free < file.size) {
            console.warn('§189 video blob save skipped (quota 부족): ' + name +
              ' (' + file.size + 'B > free ' + free + 'B)');
            return;
          }
          doSave();
        })['catch'](doSave);                   // estimate 실패 — 그냥 시도
      } else {
        doSave();
      }
    } catch (e) {
      console.warn('§189 persistClipBlob error:', e);
    }
  }

  /* §189 (샘 2026-06-04) — open() 시 저장된 영상 blob 복원. 저장된 각
     항목을 File 로 되살려 기존 loadVideoFiles 경로로 추가한다 —
     autoPlaceClip 의 'Saved manual placement' 복원과 자동 연결돼
     수동 동기화 위치까지 그대로 살아난다. 같은 이름 클립이 이미
     있으면 skip (중복 복원 방지). 실패는 console.warn 만. */
  function restorePersistedClips() {
    try {
      if (!global.RDStorage || !global.RDStorage.loadVideoBlobs) {
        maybeShowVideoMissing(0); return;      // §423 — 복원 수단 없음 = 영상 0
      }
      if (!R || !R.sessionSig) { maybeShowVideoMissing(0); return; }
      var ref = R;                             // 복원 완료 시점 세션 동일성 가드
      var sig = R.sessionSig;
      global.RDStorage.loadVideoBlobs(sig).then(function (items) {
        if (!R || R !== ref) return;
        if (!items || !items.length) { maybeShowVideoMissing(0); return; }
        var files = [];
        items.forEach(function (it) {
          if (!it || !it.blob || !it.name) return;
          var dup = R.clips.some(function (c) { return c.name === it.name; });
          if (dup) return;                     // 이미 올라온 같은 이름 클립 — skip
          try {
            var f = new File([it.blob], it.name, {
              type: it.type || it.blob.type || '',
              lastModified: it.lastModified || Date.now()
            });
            f._rdRestored = true;              // persistClipBlob 재기록 방지 표식
            files.push(f);
          } catch (e) {
            console.warn('§189 video blob restore failed (' + it.name + '):', e);
          }
        });
        if (files.length && R && R === ref) loadVideoFiles(files);
        else maybeShowVideoMissing(R ? R.clips.length : 0);
      })['catch'](function (e) {
        console.warn('§189 video blob restore failed:', e);
        maybeShowVideoMissing(R ? R.clips.length : 0);   // §423 — 복원 실패도 없음 취급
      });
    } catch (e) {
      console.warn('§189 restorePersistedClips error:', e);
      maybeShowVideoMissing(0);
    }
  }

  /* ============================================================
   * §423 — 영상 없음 안내 (cross-device). 다른 기기에서 cloud 로 불러온
   *   세션은 트랙·분석은 동기화되지만 영상은 local(IndexedDB)에만 있어
   *   이 기기엔 없다. 그 사실(R.hasVideoFlag)을 알고 있고 이 기기에 복원된
   *   클립이 0개일 때만 배너를 띄운다 — 영상이 원래 없던 세션엔 안 띄운다.
   * ============================================================ */
  function videoMissingOnDevice(hasVideoFlag, clipCount) {
    return !!hasVideoFlag && !(clipCount > 0);
  }
  /* 리플레이는 영어 전용 몰입 모드지만, 안내 메시지는 사용자 언어로 보여
     주는 편이 친절하다. 토글이 리플레이 중 숨겨져 walker 가 안 닿으므로
     RDI18n.T 를 명시 호출(현재 lang 기준 1회 확정). 미로드 시 한글 fallback. */
  function tt(ko, vars) {
    try {
      if (global.RDI18n && typeof global.RDI18n.T === 'function') {
        return global.RDI18n.T(ko, vars || undefined);
      }
    } catch (e) {}
    var s = ko;
    if (vars) Object.keys(vars).forEach(function (k) {
      s = s.split('{' + k + '}').join(String(vars[k]));
    });
    return s;
  }
  function fmtUploadedAt(epoch) {
    if (!epoch || !isFinite(epoch)) return '';
    try {
      var d = new Date(epoch);
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    } catch (e) { return ''; }
  }
  function maybeShowVideoMissing(clipCount) {
    if (!R) return;
    if (videoMissingOnDevice(R.hasVideoFlag, clipCount)) showVideoMissing();
    else hideVideoMissing();
  }
  function showVideoMissing() {
    var box = el('replay-vmissing');
    if (!box) return;
    var hint = el('replay-nohint');
    if (hint) hint.hidden = true;              // 일반 안내 대신 구체 안내
    var dateStr = fmtUploadedAt(R && R.videoUploadedAt);
    box.innerHTML =
      '<div class="replay__vmissing-icon" aria-hidden="true">📹</div>' +
      '<b class="replay__vmissing-title">' + escapeHtml(tt('이 기기에 영상이 없습니다')) + '</b>' +
      '<p class="replay__vmissing-body">' +
        escapeHtml(tt('다른 기기에서 업로드한 영상은 클라우드에 저장되지 않아 이 기기에 없습니다. 영상을 보시려면 같은 영상 파일을 다시 업로드해 주세요.')) +
      '</p>' +
      (dateStr
        ? '<p class="replay__vmissing-at">' +
            escapeHtml(tt('다른 기기에서 {date}에 저장한 세션입니다.', { date: dateStr })) + '</p>'
        : '') +
      '<div class="replay__vmissing-acts">' +
        '<button type="button" class="replay__upload replay__vmissing-up" ' +
          'id="replay-vmissing-up">' + escapeHtml(tt('📤 영상 업로드')) + '</button>' +
        '<button type="button" class="replay__vmissing-skip" ' +
          'id="replay-vmissing-skip">' + escapeHtml(tt('영상 없이 분석만 보기')) + '</button>' +
      '</div>';
    box.hidden = false;
    var up = el('replay-vmissing-up');
    if (up) up.addEventListener('click', function () {
      var input = el('replay-video-input');    // 기존 업로드 경로 재사용
      if (input) input.click();
    });
    var skip = el('replay-vmissing-skip');
    if (skip) skip.addEventListener('click', function () {
      hideVideoMissing();
      var h = el('replay-nohint');             // 닫으면 일반 안내로 복귀
      if (h) h.hidden = R && R.videoReady;
    });
  }
  function hideVideoMissing() {
    var box = el('replay-vmissing');
    if (box) box.hidden = true;
  }
  /* 영상 업로드 → blob 저장(persistClipBlob) 후 같은 sig 로 복원되므로,
     배너를 닫고 동기화 완료 토스트를 잠깐 띄운다. */
  function videoSyncedToast() {
    var box = el('replay-vmissing');
    if (!box) return;
    box.innerHTML = '<b class="replay__vmissing-title">' +
      escapeHtml(tt('✓ 영상이 동기화되었습니다')) + '</b>';
    box.hidden = false;
    setTimeout(function () { hideVideoMissing(); }, 2600);
  }

  /* 활성 클립 — 단일 <video> 에 그 클립의 src 를 싣는다 */
  function activateClip(clip) {
    if (!R || !clip || R.activeClipId === clip.id) return;
    R.activeClipId = clip.id;
    var v = R.video;
    if (!v) return;
    try { v.pause(); } catch (e) {}
    v.src = clip.url;
    try { v.load(); } catch (e) {}
    R.pendingSeek = null;          // src 로드 완료 후 syncVideo 가 위치를 잡는다
  }

  /* 활성 클립의 <video> 메타데이터 로드 완료 */
  function onVideoMeta() {
    if (!R) return;
    var clip = clipById(R.activeClipId);
    if (clip && R.video.duration && isFinite(R.video.duration)) {
      clip.duration = R.video.duration;        // mvhd 추정보다 정확한 실측 길이
      if (clip.place === 'auto' || clip.place === 'pending') autoPlaceClip(clip);
    }
    try { R.video.playbackRate = R.speed; } catch (e) {}
    if (R.pendingSeek != null) {
      try {
        R.video.currentTime = clamp(R.pendingSeek, 0, R.video.duration || 0);
      } catch (e) {}
      R.pendingSeek = null;
    }
    buildSyncPanel();
    rebuildTrack();
    seek(R.playT, !R.playing);
  }

  /* 클립 1개 제거 */
  function removeClip(id) {
    if (!R) return;
    var idx = -1;
    for (var i = 0; i < R.clips.length; i++) {
      if (R.clips[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return;
    var clip = R.clips[idx];
    try { URL.revokeObjectURL(clip.url); } catch (e) {}
    /* §189 (샘 2026-06-04) — 클립 제거 시 보존된 blob 도 삭제.
       (close() 는 removeClip 을 부르지 않으므로 닫기만으로는 안 지워진다 —
       의도된 동작: 닫았다 다시 열면 영상이 그대로 복원된다.) */
    try {
      if (global.RDStorage && global.RDStorage.removeVideoBlob && R.sessionSig) {
        global.RDStorage.removeVideoBlob(R.sessionSig, clip.name)['catch'](function (e) {
          console.warn('§189 video blob remove failed (' + clip.name + '):', e);
        });
      }
    } catch (e) { console.warn('§189 video blob remove error:', e); }
    R.clips.splice(idx, 1);
    if (R.activeClipId === id) {
      R.activeClipId = null;
      var v = R.video;
      try { v.pause(); } catch (e) {}
      v.removeAttribute('src');
      try { v.load(); } catch (e) {}
    }
    R.videoReady = R.clips.length > 0;
    if (!R.clips.length) {
      var hint = el('replay-nohint');
      if (hint) hint.hidden = false;
      var blur = el('replay-blur');
      if (blur) {
        var bc = blur.getContext('2d');
        bc.clearRect(0, 0, blur.width, blur.height);
      }
      setLayout('map');
    }
    buildSyncPanel();
    rebuildTrack();
    relayout();
    seek(R.playT, !R.playing);
  }
  /* 전체 영상 제거 */
  function removeAllClips() {
    if (!R) return;
    var sig = R.sessionSig;
    R.clips.slice().forEach(function (c) { removeClip(c.id); });
    /* §189 (샘 2026-06-04) — 세션의 보존 blob 일괄 정리 (removeClip 의
       개별 삭제에 더해, 혹시 남은 orphan 항목까지 비운다). */
    try {
      if (global.RDStorage && global.RDStorage.clearVideoBlobs && sig) {
        global.RDStorage.clearVideoBlobs(sig)['catch'](function (e) {
          console.warn('§189 video blob clear failed:', e);
        });
      }
    } catch (e) { console.warn('§189 video blob clear error:', e); }
  }

  /* 영상 ↔ 데이터 동기 (영상은 슬레이브) — 재생 헤드가 든 구간의
     클립을 활성화하고 그 클립 안 시각으로 위치시킨다. 클립이 없는
     구간이면 영상을 멈춰 지도·데이터만 보이게 한다. */
  function syncVideo(elapsedSec, scrubbing) {
    var v = R.video;
    if (!v) return;
    var vpanel = el('replay-vpanel');
    var clip = clipAtElapsed(elapsedSec);
    if (!clip) {
      if (!v.paused) { try { v.pause(); } catch (e) {} }
      if (vpanel) vpanel.classList.add('replay__vpanel--vout');
      return;
    }
    if (vpanel) vpanel.classList.remove('replay__vpanel--vout');
    if (R.activeClipId !== clip.id) activateClip(clip);

    var dur = v.duration || clip.duration || 0;
    var want = clamp(elapsedSec - clip.startElapsed, 0, dur);
    // src 를 막 교체했으면 <video> 가 아직 안 떴다 — 로드 후 적용
    if (!v.duration || isNaN(v.duration)) { R.pendingSeek = want; return; }

    if (R.playing && !scrubbing) {
      if (v.paused) { try { v.play().catch(noop); } catch (e) {} }
      if (Math.abs(v.currentTime - want) > DRIFT_TOL) v.currentTime = want;
    } else {
      if (!v.paused) { try { v.pause(); } catch (e) {} }
      v.currentTime = want;
    }
  }

  /* ============================================================
   * 10) 클립 녹화 시각 메타데이터 → 자동 배치
   * ============================================================ */
  /* MP4/MOV 컨테이너에서 녹화 시각 메타데이터를 비동기로 읽어 clip.meta
     에 채운다. 큰 파일을 통째로 읽지 않고 최상위 박스를 따라가 moov 를
     찾은 뒤 moov 전체를 읽는다 — com.apple.quicktime.creationdate 는
     trak 샘플 테이블 뒤(meta/udta)에 있어, 예전처럼 moov 머리 16KB 만
     읽으면 놓친다(Danny 검토 2026-05-23 §B3 자동싱크 실패의 핵심 원인).
     moov 에서 못 찾으면 파일 head·tail 청크를 직접 스캔한다 — Insta360·
     GoPro 류 액션캠은 녹화 시각을 최상위 meta/udta·파일 끝 트레일러 등
     비표준 위치에 두기도 하기 때문이다(§C3 확장). */
  function readVideoMeta(file, clip) {
    function emptyMeta() {
      return { creationMs: null, durationSec: null, creationDateMs: null };
    }
    function finish(meta) {
      if (!R || R.clips.indexOf(clip) < 0) return;
      clip.meta = meta || emptyMeta();
      clip.hasMeta = true;
      if (clip.place === 'manual') return;     // 수동 배치는 건드리지 않음
      autoPlaceClip(clip);
      buildSyncPanel();
      rebuildTrack();
      seek(R.playT, !R.playing);
    }
    if (!file || typeof file.slice !== 'function') {
      finish(emptyMeta());
      return;
    }
    var size = file.size || 0;

    /* moov 에서 녹화 시각을 못 찾았을 때 — 파일 head·tail 을 바이트
       스캔해 어디에 박혀 있든 ASCII 날짜시각을 찾는다(비표준 위치 폴백). */
    function fallbackScan(meta) {
      if (meta.creationDateMs != null || !(size > 0)) { finish(meta); return; }
      var CH = 3 * 1024 * 1024;
      var headP = file.slice(0, Math.min(size, CH)).arrayBuffer();
      var tailP = (size > CH)
        ? file.slice(Math.max(0, size - CH), size).arrayBuffer()
        : Promise.resolve(null);
      Promise.all([headP, tailP]).then(function (bufs) {
        var hit = null;
        bufs.forEach(function (b) {
          if (hit || !b) return;
          var u8 = new Uint8Array(b);
          var cd = extractCreationDate(u8, 0, u8.length);
          if (cd) hit = cd;
        });
        if (hit) { meta.creationDateMs = hit.ms; meta.creationDateIso = hit.iso; }
        finish(meta);
      })['catch'](function () { finish(meta); });
    }

    var pos = 0;
    function fail() { fallbackScan(emptyMeta()); }
    function walk() {
      if (pos + 8 > size || pos < 0) { fail(); return; }
      file.slice(pos, Math.min(pos + 16, size)).arrayBuffer()
        .then(function (buf) {
          var u8 = new Uint8Array(buf);
          if (u8.length < 8) { fail(); return; }
          var bsz = readU32BE(u8, 0);
          var type = boxType(u8, 4);
          var hdr = 8;
          if (bsz === 1) {
            if (u8.length < 16) { fail(); return; }
            bsz = readU64BE(u8, 8); hdr = 16;
          } else if (bsz === 0) {
            bsz = size - pos;
          }
          if (bsz < hdr) { fail(); return; }
          if (type === 'moov') {
            /* moov 전체를 읽는다(과거 16KB 만 읽어 creationdate 누락) */
            var readLen = Math.min(bsz - hdr, 48 * 1024 * 1024);
            file.slice(pos + hdr, pos + hdr + readLen).arrayBuffer()
              .then(function (mbuf) {
                var mb = new Uint8Array(mbuf);
                var mvhd = findBox(mb, 0, mb.length, 'mvhd');
                var meta = mvhd
                  ? parseMvhd(mb, mvhd.dataStart, mvhd.dataEnd)
                  : { creationMs: null, durationSec: null, rawCreation: 0 };
                if (!meta) {
                  meta = { creationMs: null, durationSec: null, rawCreation: 0 };
                }
                var cd = extractCreationDate(mb, 0, mb.length);
                meta.creationDateMs = cd ? cd.ms : null;
                meta.creationDateIso = cd ? cd.iso : null;
                fallbackScan(meta);    // moov 에 없으면 head·tail 추가 스캔
              })['catch'](fail);
            return;
          }
          pos += bsz;
          walk();
        })['catch'](fail);
    }
    walk();
  }

  /* 한 클립을 녹화 시각으로 타임라인에 배치한다. com.apple.quicktime.
     creationdate(타임존 포함)가 있으면 가장 신뢰해 바로 쓰고, 없으면
     mvhd UTC·파일명·수정시각 후보 중 데이터 구간과 가장 겹치는 정렬을
     고른다. 시각 정보가 전혀 없으면 직전 클립 뒤에 순서대로 둔다. */
  function autoPlaceClip(clip) {
    if (!R || clip.place === 'manual') return;
    var saved = clipSavedStart(clip.name);
    if (saved != null) {
      clip.startElapsed = saved;
      clip.place = 'manual';
      clip.placeSource = 'Saved manual placement';
      return;
    }
    var meta = clip.meta || {};
    if (!(clip.duration > 0) && meta.durationSec > 0) {
      clip.duration = meta.durationSec;
    }
    var startEpoch = R.session && R.session.startEpoch;
    /* 1순위 — QuickTime 정밀 촬영 시각(타임존 포함, 모호함 없음) */
    if (startEpoch != null && isFinite(startEpoch) && meta.creationDateMs != null) {
      clip.startElapsed =
        Math.round((meta.creationDateMs - startEpoch) / 100) / 10;
      clip.place = 'auto';
      clip.placeSource = 'Recording time (QuickTime · with timezone)';
      return;
    }
    /* 2순위 — mvhd UTC·파일명·수정시각 후보 중 데이터와 최대 겹침 */
    if (startEpoch != null && isFinite(startEpoch)) {
      var tzMs = new Date().getTimezoneOffset() * 60000;
      var clipDurMs = (clip.duration || meta.durationSec || 0) * 1000;
      var cands = [];
      if (meta.creationMs != null) {
        cands.push({ epoch: meta.creationMs, source: 'mvhd recording time (UTC)' });
        cands.push({ epoch: meta.creationMs + tzMs,
          source: 'mvhd recording time (local-adjusted)' });
      }
      var fn = parseFilenameDate(clip.name);
      if (fn != null) cands.push({ epoch: fn, source: 'Filename timestamp' });
      if (clip.file && clip.file.lastModified && clipDurMs > 0) {
        cands.push({ epoch: clip.file.lastModified - clipDurMs,
          source: 'File modified time' });
      }
      if (cands.length) {
        var best = pickVideoOffset(cands, startEpoch, R.dur * 1000, clipDurMs);
        if (best && best.overlapMs > 1000) {
          /* offsetSec = videoTime0 에 대응하는 데이터 경과시각의 음수 */
          clip.startElapsed = Math.round(-best.offsetSec * 10) / 10;
          clip.place = 'auto';
          clip.placeSource = best.source;
          return;
        }
      }
    }
    /* 시각 정보 없음 — 직전 클립 뒤에 순서대로(겹치지 않게) */
    clip.startElapsed = Math.round(nextSequentialStart(clip) * 10) / 10;
    clip.place = 'none';
    clip.placeSource = (startEpoch == null)
      ? 'No absolute time in data session' : 'No recording time info';
  }

  /* §429 — 화면 시각 OCR fallback. 파일 메타데이터로 녹화 시각을 못 얻은
     클립에 대해, 영상 화면 안 오버레이 시계를 Tesseract 로 읽어 트랙에
     배치한다. VideoTimeDetect(신규 모듈)가 프레임 캡처·OCR·시각 추출을
     담당하고, 여기서는 읽어낸 시각을 데이터 경과초로 변환해 배치한다.
     · datetime(날짜+시각) → 절대 epoch 로 바로 변환.
     · clock(시각만)     → parseClockToElapsed 로 세션 날짜에 맞춰 변환.
     결과는 자동 신뢰가 아니므로 사용자가 확인·미세조정할 수 있게 그대로
     남긴다(수동 미세조정 UI 유지). 감지값은 수동 배치처럼 저장돼 재방문
     시 복원된다. */
  function ocrPlaceClip(clip, btn) {
    if (!clip || !R) return;
    var VTD = global.VideoTimeDetect;
    var startEpoch = R.session && R.session.startEpoch;
    if (!VTD || startEpoch == null || !isFinite(startEpoch)) return;
    if (btn && btn.disabled) return;                 // 중복 실행 방지

    var box = el('replay-sync');
    function statusNode() {
      return box ? box.querySelector('[data-clip-ocrstatus="' + clip.id + '"]') : null;
    }
    function setStatus(msg) { var s = statusNode(); if (s) s.textContent = msg; }
    var origLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Reading…'; }
    setStatus('Loading OCR engine…');

    function reenable() {
      var b = box ? box.querySelector('.replay-sync__ocr[data-clip-ocr="' + clip.id + '"]') : btn;
      if (b) { b.disabled = false; b.textContent = origLabel || '🕑 Detect time from screen (OCR)'; }
    }

    VTD.ocrFrameTime(clip.url, {
      onProgress: function (msg) { setStatus(msg); }
    }).then(function (hit) {
      if (!hit) {
        setStatus('Couldn’t read a clock on screen. Enter the start time above manually.');
        reenable();
        return;
      }
      var res = VTD.resolveStartElapsed(
        hit, hit.frameSec, startEpoch, parseClockToElapsed, clip.startElapsed);
      if (!res || !isFinite(res.startElapsed)) {
        setStatus('Read “' + (hit.raw || '') + '” but couldn’t place it. Enter manually.');
        reenable();
        return;
      }
      /* 배치 적용 — 수동 배치처럼 저장·복원되게 하고, 출처만 OCR 로 표기 */
      setClipStart(clip, res.startElapsed);
      clip.placeSource = 'On-screen clock (OCR · ' + res.confidence + ')';
      buildSyncPanel();
      rebuildTrack();
      seek(R.playT, !R.playing);
    })['catch'](function () {
      setStatus('OCR failed to run. Enter the start time above manually.');
      reenable();
    });
  }

  /* 모든 클립을 자동 배치 다시 — '자동 정렬 다시' 버튼 */
  function autoPlaceAll() {
    R.clips.forEach(function (c) {
      if (c.place !== 'manual') { c.place = 'pending'; }
    });
    R.clips.forEach(function (c) { autoPlaceClip(c); });
  }

  /* 클립의 수동 배치를 클립 파일명별로 저장/복원 — 같은 세션에 같은
     영상을 다시 올리면 맞춰 둔 위치가 복원된다("같은 작업 반복" 회피). */
  function saveClipStarts() {
    if (!global.RDStorage || !R || !R.sessionSig) return;
    var map = {};
    R.clips.forEach(function (c) {
      if (c.place === 'manual') map[c.name] = c.startElapsed;
    });
    global.RDStorage.saveVideoSync(R.sessionSig, { clips: map });
  }
  function clipSavedStart(name) {
    if (!global.RDStorage || !R || !R.sessionSig) return null;
    var d = global.RDStorage.loadVideoSync(R.sessionSig);
    if (d && d.clips && d.clips[name] != null && isFinite(d.clips[name])) {
      return d.clips[name];
    }
    return null;
  }

  /* 클립 시작/끝을 실제 시각(또는 경과시각) 문자열로 */
  function clipRangeText(clip) {
    var startEpoch = R.session && R.session.startEpoch;
    var dur = clip.duration || (clip.meta && clip.meta.durationSec) || 0;
    function fc(elapsed) {
      if (startEpoch != null && isFinite(startEpoch)) {
        return fmtRealClock(startEpoch + elapsed * 1000);
      }
      return (elapsed < 0 ? '-' : '') + fmtClock(Math.abs(elapsed));
    }
    return fc(clip.startElapsed) + ' – ' + fc(clip.startElapsed + dur);
  }
  /* 클립 녹화 시각 문자열 — 정보 없으면 정직하게 표기 */
  function clipRecText(clip) {
    var m = clip.meta;
    if (m && m.creationDateMs != null) return fmtRealDateTime(m.creationDateMs);
    if (m && m.creationMs != null) {
      return fmtRealDateTime(m.creationMs) + ' (mvhd · UTC estimate)';
    }
    if (!clip.hasMeta) return 'Checking…';
    return 'No recording time info';
  }

  /* 동기화 패널 — 클립 목록 · 각 클립의 녹화 시각 · 데이터 시작 시각 ·
     트랙 배치 구간 · 수동 미세조정 (Danny 검토 2026-05-23 §B3·§B7) */
  function buildSyncPanel() {
    var box = el('replay-sync');
    if (!box) return;
    if (!R.clips.length) { box.hidden = true; box.innerHTML = ''; return; }

    var startEpoch = R.session && R.session.startEpoch;
    var dataStartTxt = (startEpoch != null && isFinite(startEpoch))
      ? fmtRealDateTime(startEpoch)
      : 'No absolute time in data session';

    var html =
      '<div class="replay-sync__row replay-sync__row--top">' +
        '<span class="replay-sync__name">🎬 Video clips: ' + R.clips.length +
          '</span>' +
        '<span class="replay-sync__src">Data start · <b>' +
          escapeHtml(dataStartTxt) + '</b></span>' +
        '<button type="button" class="replay-sync__close" id="replay-sync-close" ' +
          'aria-label="Close sync panel">✕</button>' +
      '</div>';

    clipsByStart().forEach(function (clip) {
      var badge = (clip.place === 'auto')
        ? '<span class="replay-sync__badge replay-sync__badge--ok">Auto-placed</span>'
        : (clip.place === 'manual'
          ? '<span class="replay-sync__badge replay-sync__badge--manual">Manual</span>'
          : '<span class="replay-sync__badge replay-sync__badge--manual">Needs manual alignment</span>');
      var active = (clip.id === R.activeClipId)
        ? ' <span class="replay-sync__live">● Playing</span>' : '';
      /* 시작 시각 — 시계 시각(HH:MM:SS)으로 직접 입력해 배치 (§C1).
         데이터 세션에 절대 시각이 있을 때만 의미가 있다. */
      var clockRow = '';
      if (startEpoch != null && isFinite(startEpoch)) {
        clockRow =
          '<div class="replay-sync__row">' +
            '<span class="replay-sync__lbl">Start time</span>' +
            '<input type="text" class="replay-sync__ctime" data-clip="' + clip.id +
              '" value="' +
              escapeHtml(fmtRealClock(startEpoch + clip.startElapsed * 1000)) +
              '" placeholder="HH:MM:SS" aria-label="Clip start time">' +
            '<span class="replay-sync__chmss">Enter a clock time ' +
              '(HH:MM:SS) to place the clip</span>' +
          '</div>';
      }
      /* §429 — 화면 시각 OCR fallback. 데이터에 절대 시각이 있을 때(그래야
         감지한 시각을 배치로 변환 가능)만, 그리고 파일 메타데이터로 자동
         배치되지 못한 클립('none' 또는 수동)에 제안한다. 자동배치('auto',
         메타데이터 high 신뢰)엔 굳이 권하지 않되 되돌릴 여지로 항상 남긴다. */
      var ocrRow = '';
      if (startEpoch != null && isFinite(startEpoch) &&
          typeof global.VideoTimeDetect !== 'undefined') {
        var ocrHint = (clip.place === 'none')
          ? 'No recording time in the file — read the clock shown in the video'
          : 'Or read the clock shown in the video';
        ocrRow =
          '<div class="replay-sync__row replay-sync__ocrrow">' +
            '<button type="button" class="replay-sync__act replay-sync__ocr" ' +
              'data-clip-ocr="' + clip.id + '">🕑 Detect time from screen (OCR)</button>' +
            '<span class="replay-sync__ocrstatus" data-clip-ocrstatus="' + clip.id +
              '">' + escapeHtml(ocrHint) + '</span>' +
          '</div>';
      }
      html +=
        '<div class="replay-sync__clip">' +
          '<div class="replay-sync__row replay-sync__row--clip">' +
            '<span class="replay-sync__name" title="' + escapeHtml(clip.name) +
              '">🎬 ' + escapeHtml(clip.name) + '</span>' + badge + active +
            '<button type="button" class="replay-sync__act replay-sync__rm" ' +
              'data-clip-remove="' + clip.id + '">Remove</button>' +
          '</div>' +
          '<div class="replay-sync__row replay-sync__times">' +
            '<span class="replay-sync__time"><b>Recorded at </b>' +
              escapeHtml(clipRecText(clip)) + '</span>' +
            '<span class="replay-sync__time"><b>Track span </b>' +
              escapeHtml(clipRangeText(clip)) +
              (clip.placeSource ? ' · ' + escapeHtml(clip.placeSource) : '') +
            '</span>' +
          '</div>' +
          clockRow +
          ocrRow +
          '<div class="replay-sync__row">' +
            '<span class="replay-sync__lbl">Fine-tune</span>' +
            '<button type="button" class="replay__nudge" data-clip="' + clip.id +
              '" data-d="-1">−1s</button>' +
            '<button type="button" class="replay__nudge" data-clip="' + clip.id +
              '" data-d="-0.1">−0.1</button>' +
            '<label class="replay-sync__num">Start (sec from data) ' +
              '<input type="number" class="replay-sync__cnum" step="0.1" ' +
              'data-clip="' + clip.id + '" value="' +
              clip.startElapsed.toFixed(1) + '"></label>' +
            '<button type="button" class="replay__nudge" data-clip="' + clip.id +
              '" data-d="0.1">+0.1</button>' +
            '<button type="button" class="replay__nudge" data-clip="' + clip.id +
              '" data-d="1">+1s</button>' +
          '</div>' +
        '</div>';
    });

    html +=
      '<div class="replay-sync__row">' +
        '<span class="replay-sync__hint">Each clip is auto-placed by ' +
          'its recording time. No recording time in the file? Use ' +
          '“Detect time from screen (OCR)” to read the clock shown in the ' +
          'video. If it\'s still off, adjust it above — comparing the clock ' +
          'in the video with the track timeline (real time) makes it easy.</span>' +
        '<button type="button" class="replay-sync__act" id="replay-sync-redo">' +
          'Re-run auto-align</button>' +
        '<button type="button" class="replay-sync__act" id="replay-video-remove">' +
          'Remove all videos</button>' +
      '</div>';
    box.innerHTML = html;

    el('replay-sync-close').addEventListener('click', function () {
      box.hidden = true;
    });
    el('replay-video-remove').addEventListener('click', removeAllClips);
    el('replay-sync-redo').addEventListener('click', function () {
      autoPlaceAll(); buildSyncPanel(); rebuildTrack();
      seek(R.playT, !R.playing);
    });
    /* 클립 제거·미세조정은 위임으로 — 패널은 자주 재구성되므로 위임
       리스너는 box 에 한 번만 건다(재구성마다 누적되지 않게). */
    if (!box._rdSyncDeleg) {
      box._rdSyncDeleg = true;
      box.addEventListener('click', function (e) {
        if (!R) return;
        var rm = e.target.closest && e.target.closest('.replay-sync__rm');
        if (rm) { removeClip(rm.getAttribute('data-clip-remove')); return; }
        var oc = e.target.closest && e.target.closest('.replay-sync__ocr');
        if (oc && oc.getAttribute('data-clip-ocr')) {
          ocrPlaceClip(clipById(oc.getAttribute('data-clip-ocr')), oc);
          return;
        }
        var nb = e.target.closest && e.target.closest('.replay__nudge');
        if (nb && nb.getAttribute('data-clip')) {
          var c = clipById(nb.getAttribute('data-clip'));
          if (c) setClipStart(c, c.startElapsed + parseFloat(nb.getAttribute('data-d')));
        }
      });
    }
    var nums = box.querySelectorAll('.replay-sync__cnum');
    Array.prototype.forEach.call(nums, function (inp) {
      inp.addEventListener('change', function () {
        var c = clipById(inp.getAttribute('data-clip'));
        var x = parseFloat(inp.value);
        if (c && isFinite(x)) setClipStart(c, x);
      });
    });
    /* 시작 시각(HH:MM:SS) 직접 입력 — 시계 시각을 경과초로 변환해 배치 */
    var ctimes = box.querySelectorAll('.replay-sync__ctime');
    Array.prototype.forEach.call(ctimes, function (inp) {
      inp.addEventListener('change', function () {
        var c = clipById(inp.getAttribute('data-clip'));
        if (!c) return;
        var se = parseClockToElapsed(inp.value, startEpoch, c.startElapsed);
        if (se != null) setClipStart(c, se);
        else buildSyncPanel();      // 형식 오류 — 원래 값으로 되돌림
      });
    });
  }

  var clipSaveTimer = null;
  /* 클립을 수동으로 배치 — 트랙·동기화 패널 갱신 + 디바운스 저장 */
  function setClipStart(clip, startElapsed) {
    if (!clip || !isFinite(startElapsed)) return;
    startElapsed = clamp(startElapsed, -7200, 7200);
    clip.startElapsed = Math.round(startElapsed * 10) / 10;
    clip.place = 'manual';
    clip.placeSource = 'Manual placement';
    buildSyncPanel();
    rebuildTrack();
    seek(R.playT, !R.playing);
    if (clipSaveTimer) clearTimeout(clipSaveTimer);
    clipSaveTimer = setTimeout(saveClipStarts, 400);
  }

  /* ============================================================
   * 11) 레이아웃 토글 (영상 / 지도 / 나란히 · 좌우 교환)
   * ============================================================ */
  function setLayout(mode) {
    if (mode !== 'video' && mode !== 'map' && mode !== 'both') mode = 'map';
    // 영상이 없으면 영상·나란히 모드는 지도 모드로 폴백한다.
    if ((mode === 'video' || mode === 'both') && !R.videoReady) mode = 'map';
    R.layout = mode;
    var view = el('replay-view');
    view.classList.toggle('replay--video', mode === 'video');
    view.classList.toggle('replay--map', mode === 'map');
    view.classList.toggle('replay--both', mode === 'both');
    view.classList.toggle('replay--swap', !!R.swap);

    /* 패널 재배치 — 좌측 컬럼 맨 위엔 항상 데이터 패널(라이더 카드),
       그 아래 타일엔 '중앙 스테이지에 없는 것'을 둔다.
        · 영상 뷰  — 중앙=영상, 좌측 하단 타일=지도
        · 지도 뷰  — 중앙=지도, 좌측 하단 타일=영상
        · 나란히   — 중앙=영상|지도 반반, 좌측 컬럼=데이터 패널만 */
    var lcol = el('replay-lcol');
    var cstage = el('replay-cstage');
    var rider = el('replay-rider');
    var vpanel = el('replay-vpanel');
    var mpanel = el('replay-mpanel');
    var statsPanel = el('replay-stats');
    lcol.appendChild(rider);                 // 데이터 패널 — 항상 좌측 컬럼 맨 위
    if (mode === 'video') {
      cstage.appendChild(vpanel);
      lcol.appendChild(mpanel);
    } else if (mode === 'map') {
      cstage.appendChild(mpanel);
      lcol.appendChild(vpanel);
    } else {                                 // both — 중앙에 영상·지도 반반
      cstage.appendChild(vpanel);
      cstage.appendChild(mpanel);
    }
    /* 세션 통계 타일 — 나란히 뷰에서만 좌측 컬럼 하단 타일로 노출한다.
       영상·지도 뷰는 하단 타일이 지도/영상이라 숨긴다([hidden] →
       display:none 이라 50/50 타일 레이아웃에 영향 0). 항상 좌측 컬럼
       맨 끝에 둔다 (Danny 2026-05-24). */
    if (statsPanel) {
      lcol.appendChild(statsPanel);
      statsPanel.hidden = (mode !== 'both');
    }

    Array.prototype.forEach.call(el('replay-layout').children, function (b) {
      var on = b.getAttribute('data-lay') === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      // 영상 없으면 영상/나란히 비활성
      var needsVideo = b.getAttribute('data-lay') !== 'map';
      b.disabled = needsVideo && !R.videoReady;
    });

    /* 지도는 어느 모드든 노출되므로 항상 준비한다. */
    ensureMap();
    relayout();
  }

  /* 모든 캔버스·지도 크기를 현재 레이아웃에 맞춘다 */
  function relayout() {
    if (!R) return;
    var blur = el('replay-blur');
    if (blur) {
      blur.width = Math.max(160, Math.round((global.innerWidth || 960) / 4));
      blur.height = Math.max(90, Math.round((global.innerHeight || 540) / 4));
      drawBlur();
    }
    sizeGraphs();
    sizeTrack();
    rebuildTrack();
    if (R.map) {
      setTimeout(function () {
        if (R && R.map) { try { R.map.invalidateSize(); } catch (e) {} }
      }, 60);
    }
    /* 풍향 격자 — 지도 패널 크기가 잡힌 다음 프레임에 그린다(레이아웃
       모드 전환 직후엔 캔버스 clientWidth 가 0 일 수 있다). */
    sizeWindGrid();
    drawWindGrid();
    sizeLadder();
    drawBoardLines();
    setTimeout(function () {
      if (R) {
        sizeWindGrid(); drawWindGrid();
        sizeLadder(); drawBoardLines();
      }
    }, 70);
    seek(R.playT, !R.playing);
  }

  /* ============================================================
   * 12) 재생 헤드 갱신
   * ============================================================ */
  function seek(playT, scrubbing) {
    if (!R) return;
    playT = clamp(playT, R.t0, R.t1);
    R.playT = playT;
    var st = interpAtTime(R.samples, playT, GAP_SEC);
    R.curState = st;

    updateRider(playT, st);
    drawMiniGraphs(playT, st);
    updateMapPlayhead(st);

    // 트랙 줌 창이 좁을 때 — 재생 헤드가 가장자리에 닿으면 페이지 이동
    if (R.dur - R.trackSpan > 0.001) {
      var margin = R.trackSpan * 0.12;
      if (playT < R.winStart + margin - 1e-6 || playT > R.winEnd - margin + 1e-6) {
        setTrackWindow();
      }
    }
    drawTrackCursor();

    if (!scrubbing) {
      var frac = R.dur > 0 ? (playT - R.t0) / R.dur : 0;
      R.scrub.value = String(Math.round(frac * 1000));
    }
    paintScrub();
    /* §198-B (Danny 2026-06-04) — clock 표기는 updateClockEl 로 단일화.
       toggle 'elapsed'/'clock' mode 분기 + 빈 startEpoch 자동 fallback. */
    updateClockEl(playT);

    syncVideo(playT - R.t0, scrubbing);
    drawBlur();
  }

  function paintScrub() {
    var pct = (parseInt(R.scrub.value, 10) / 1000) * 100;
    R.scrub.style.background =
      'linear-gradient(to right,#33A1FF 0%,#33A1FF ' + pct + '%,' +
      'rgba(255,255,255,0.16) ' + pct + '%,rgba(255,255,255,0.16) 100%)';
  }

  /* ============================================================
   * 13) 재생 엔진 — requestAnimationFrame 마스터 클럭
   * ============================================================ */
  function tick(ts) {
    if (!R || !R.playing) return;
    if (R.lastTs == null) R.lastTs = ts;
    var dt = (ts - R.lastTs) / 1000;
    R.lastTs = ts;
    if (dt > 0.5) dt = 0.5;                 // 탭 비활성 등 큰 점프 방지
    if (!R.scrubbing) {
      var next = R.playT + dt * R.speed;
      if (next >= R.t1) {
        seek(R.t1, false);
        setPlaying(false);
        return;
      }
      seek(next, false);
    }
    R.raf = global.requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    if (!R) return;
    R.playing = on;
    var btn = el('replay-play');
    if (btn) {
      btn.textContent = on ? '⏸' : '▶';
      btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      btn.classList.toggle('is-playing', on);
    }
    if (on) {
      if (R.playT >= R.t1 - 1e-3) R.playT = R.t0;
      R.lastTs = null;
      R.raf = global.requestAnimationFrame(tick);
      /* 영상 재생 시작은 재생 버튼 클릭 콜스택 안에서 — 브라우저
         자동재생 정책이 사용자 제스처를 요구하기 때문. 현재 재생
         헤드가 든 구간에 활성 클립이 있을 때만 재생한다. */
      if (R.video && R.clips.length) {
        var pc = clipAtElapsed(R.playT - R.t0);
        if (pc && R.activeClipId === pc.id) {
          try { R.video.play().catch(noop); } catch (e) {}
        }
      }
    } else {
      if (R.raf) { global.cancelAnimationFrame(R.raf); R.raf = null; }
      if (R.video && !R.video.paused) { try { R.video.pause(); } catch (e) {} }
    }
  }

  function stop() {
    setPlaying(false);
    seek(R.t0, true);
  }

  function setSpeed(mult) {
    R.speed = mult;
    Array.prototype.forEach.call(el('replay-speed').children, function (b) {
      b.classList.toggle('is-active', parseFloat(b.getAttribute('data-s')) === mult);
    });
    if (R.video && R.videoReady) {
      try { R.video.playbackRate = mult; } catch (e) {}
    }
  }

  /* ============================================================
   * 14) 이벤트 배선
   * ============================================================ */
  function bindEvents() {
    el('replay-exit').onclick = close;
    el('replay-close-x').onclick = close;
    el('replay-play').onclick = function () { setPlaying(!R.playing); };
    el('replay-stop').onclick = stop;

    el('replay-speed').onclick = function (e) {
      var b = e.target.closest('button');
      if (b) setSpeed(parseFloat(b.getAttribute('data-s')));
    };

    // 영상 업로드 — 여러 파일을 한꺼번에/따로 받는다 (다중 클립)
    var input = el('replay-video-input');
    if (input) {
      input.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) loadVideoFiles(e.target.files);
        try { e.target.value = ''; } catch (er) {}   // 같은 파일 재선택·이어붙이기 허용
      });
    }

    // 레이아웃 토글 · 좌우 교환
    el('replay-layout').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && !b.disabled) setLayout(b.getAttribute('data-lay'));
    });
    el('replay-swap').addEventListener('click', function () {
      R.swap = !R.swap;
      el('replay-view').classList.toggle('replay--swap', R.swap);
      relayout();
    });

    // 동기화 패널 토글
    el('replay-sync-btn').addEventListener('click', function () {
      var box = el('replay-sync');
      if (!R.videoReady) {
        if (global.alert) global.alert('Please upload a riding video first.');
        return;
      }
      box.hidden = !box.hidden;
      if (!box.hidden) buildSyncPanel();
    });

    // 지도 보드중앙 · 줌 · 트랙 줌 · 지도연동 토글
    var rec = el('replay-recenter');
    if (rec) rec.addEventListener('click', recenterMap);
    /* 보드 추적 토글 (F) — 켜면 매 프레임 지도가 보드를 따라간다. */
    var mm = el('replay-mapmode');
    if (mm) mm.addEventListener('click', function () {
      R.mapTrackMode = !R.mapTrackMode;
      this.classList.toggle('is-on', R.mapTrackMode);
      this.setAttribute('aria-pressed', R.mapTrackMode ? 'true' : 'false');
      if (R.mapTrackMode) {
        R.mapUserMoved = false;          // 추적 시작 — 사용자 팬 상태 해제
        if (R.map && R.mapPlayhead) {
          try {
            R._mapProg = true;
            R.map.setView(R.mapPlayhead.getLatLng(), R.map.getZoom(),
              { animate: true });
          } catch (e) {}
        }
      }
      drawBoardLines();
    });
    /* 보드 바우 끝 선 토글 2개 — 풍향 축(검정)·ladder rung(빨강).
       각자 R.showWindAxis / R.showLadder 를 켜고 끄며 즉시 다시 그린다
       (Danny 2026-05-25 #2). */
    var axBtn = el('replay-axis-toggle');
    if (axBtn) axBtn.addEventListener('click', function () {
      R.showWindAxis = !R.showWindAxis;
      this.classList.toggle('is-on', R.showWindAxis);
      this.setAttribute('aria-pressed', R.showWindAxis ? 'true' : 'false');
      drawBoardLines();
    });
    var ldBtn = el('replay-ladder-toggle');
    if (ldBtn) ldBtn.addEventListener('click', function () {
      R.showLadder = !R.showLadder;
      this.classList.toggle('is-on', R.showLadder);
      this.setAttribute('aria-pressed', R.showLadder ? 'true' : 'false');
      drawBoardLines();
    });
    var mzi = el('replay-map-zoomin');
    if (mzi) mzi.addEventListener('click', function () {
      if (R.map) { try { R.map.zoomIn(); } catch (e) {} }
    });
    var mzo = el('replay-map-zoomout');
    if (mzo) mzo.addEventListener('click', function () {
      if (R.map) { try { R.map.zoomOut(); } catch (e) {} }
    });
    el('replay-zoomin').addEventListener('click', function () { zoomTrack(1 / 1.7); });
    el('replay-zoomout').addEventListener('click', function () { zoomTrack(1.7); });
    el('replay-link').addEventListener('click', function () {
      R.mapLinked = !R.mapLinked;
      this.classList.toggle('is-on', R.mapLinked);
      this.setAttribute('aria-pressed', R.mapLinked ? 'true' : 'false');
      updateMapWindow();
    });

    // 스크러버
    var scrub = R.scrub;
    scrub.addEventListener('pointerdown', function () {
      R.scrubbing = true; R.scrubWasPlaying = R.playing;
    });
    function endScrub() {
      if (!R.scrubbing) return;
      R.scrubbing = false;
      if (R.scrubWasPlaying && !R.playing) { R.lastTs = null; setPlaying(true); }
      else if (R.playing) { R.lastTs = null; }
    }
    scrub.addEventListener('pointerup', endScrub);
    scrub.addEventListener('pointercancel', endScrub);
    scrub.addEventListener('input', function () {
      var frac = parseInt(scrub.value, 10) / 1000;
      seek(R.t0 + frac * R.dur, true);
    });
    scrub.addEventListener('change', endScrub);

    bindTrack();

    // 영상 메타데이터·오류 (활성 클립 기준)
    R.video.onloadedmetadata = onVideoMeta;
    R.video.onerror = function () {
      if (R && R.activeClipId != null) {
        if (global.alert) global.alert('Couldn\'t open the video. ' +
          'Try a different file format (MP4, MOV, WebM, etc.).');
        removeClip(R.activeClipId);
      }
    };
    /* 영상 프레임이 새로 준비될 때마다 배경 블러를 다시 그린다 —
       일시정지·스크럽 중에도(재생 중에는 rAF 틱이 매 프레임 갱신). */
    ['loadeddata', 'seeked', 'playing', 'timeupdate'].forEach(function (ev) {
      R.video.addEventListener(ev, function () { drawBlur(); });
    });

    // 키보드 — Space 재생/정지, ←→ 이동(Shift=10초), ESC 닫기
    R.keyHandler = function (e) {
      if (!R) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); setPlaying(!R.playing);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); seek(R.playT - (e.shiftKey ? 10 : 1), !R.playing);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); seek(R.playT + (e.shiftKey ? 10 : 1), !R.playing);
      } else if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', R.keyHandler);

    // 창 크기 변경 → 캔버스·지도 재배치
    R.resizeHandler = debounce(function () {
      if (!R) return;
      relayout();
    }, 180);
    global.addEventListener('resize', R.resizeHandler);
    /* 페이지 이탈·탭 닫기·백그라운드 전환 시 대기 중인 동기화 저장 flush
       (데이빗 2026-06-03 — close() 가 안 불리는 경로의 저장 유실 방지). */
    R.pagehideHandler = function () {
      if (!clipSaveTimer) return;     // 대기 중인 저장이 있을 때만 flush (빈 map 삭제 회피)
      clearTimeout(clipSaveTimer); clipSaveTimer = null;
      try { saveClipStarts(); } catch (e) {}
    };
    global.addEventListener('pagehide', R.pagehideHandler);
    global.addEventListener('visibilitychange', R.pagehideHandler);
  }

  /* ============================================================
   * 15) 열기 / 닫기
   * ============================================================ */
  function open(opts) {
    opts = opts || {};
    var session = opts.session;
    if (!session || !session.samples || !session.samples.length || !session.hasTime) {
      if (global.alert) global.alert('Replay is only available for sessions with time data.');
      return false;
    }
    if (R) close();

    var samples = session.samples;
    var t0 = samples[0].t;
    var t1 = samples[samples.length - 1].t;
    var dur = Math.max(t1 - t0, 0.001);
    var windDir = (opts.windDir != null) ? opts.windDir : null;
    var hasData = detectMetrics(samples);
    var metricSlots = buildMetricSlots(hasData, windDir);
    var shown = {};
    metricSlots.forEach(function (s) { shown[s.def.key] = true; });

    var maxKt = 0;
    if (opts.analysis && opts.analysis.summary && opts.analysis.summary.maxSpeedMs) {
      maxKt = opts.analysis.summary.maxSpeedMs * KT;
    } else {
      for (var i = 0; i < samples.length; i++) {
        if (samples[i].speed > maxKt) maxKt = samples[i].speed;
      }
      maxKt *= KT;
    }
    if (!(maxKt > 0)) maxKt = 1;

    R = {
      session: session, analysis: opts.analysis || {}, samples: samples,
      windDir: windDir,
      unit: opts.unit === 'kmh' ? 'kmh' : 'kt',
      sessionSig: opts.sessionSig || '',
      /* §423 — cloud 기록상 영상이 있던(_hasVideo) 세션인지 + 저장 시각.
         이 기기에 영상 blob 이 없으면(restorePersistedClips 0건) 안내 배너. */
      hasVideoFlag: !!opts.hasVideoFlag,
      videoUploadedAt: opts.videoUploadedAt || null,
      title: opts.title || session.trackName || 'Riding Session',
      riderName: opts.riderName || opts.title || session.trackName || 'Rider',
      onClose: typeof opts.onClose === 'function' ? opts.onClose : noop,
      t0: t0, t1: t1, dur: dur, playT: t0, maxKt: maxKt,
      playing: false, scrubbing: false, scrubWasPlaying: false, trackDrag: false,
      speed: 1, raf: null, lastTs: null,
      hasData: hasData, metricSlots: metricSlots, shown: shown,
      graphs: [],
      map: null, mapPlayhead: null, mapTrack: [], mapMans: [],
      mapFollow: true, mapUserMoved: false, mapLinked: true, _mapProg: false,
      mapTrackMode: false,    // F — 보드 추적(매 프레임 recenter) on/off
      showWindAxis: true,     // 보드 바우 끝 풍향 축 선(검정) 표시
      showLadder: true,       // 보드 바우 끝 ladder rung(빨강) 표시
      sailSide: null,         // 동적 보드 아이콘 — 보간된 세일 좌우 부호
      layout: 'map', swap: false,
      /* 다중 영상 클립 (Danny 검토 2026-05-23 §B7·§C2) */
      video: null,            // 단일 <video> — 활성 클립 src 를 싣는다
      clips: [],              // 영상 클립 배열
      activeClipId: null,     // 현재 <video> 에 로드된 클립 id
      clipSeq: 0,             // 클립 id 시퀀스
      pendingSeek: null,      // 클립 src 교체 직후 적용할 video time
      videoReady: false,      // 클립이 1개 이상 있는지
      clipBars: [],           // 트랙 클립 바 화면좌표 (드래그 히트테스트)
      clipDrag: null,         // 진행 중인 클립 바 드래그
      trackSpan: dur, winStart: t0, winEnd: t1,
      trackOff: null, trackW: 0, trackH: 0, trackDpr: 1, trackPlot: null,
      curState: null
    };

    var view = buildOverlay();
    view.hidden = false;
    document.body.style.overflow = 'hidden';
    /* 리플레이는 영어 전용 몰입 모드 — 전역 KO/EN 토글이 ✕ 닫기 버튼과 겹쳐
       숨긴다 (데이빗 2026-06-03). close() 에서 클래스 제거. */
    document.body.classList.add('rd-replay-active');

    R.scrub = el('replay-scrub');
    R.clockEl = el('replay-clock');
    R.video = el('replay-video');

    /* §198-B (Danny 2026-06-04) — playback clock time-mode.
       'elapsed' = 경과시간 (0:00 / 55:38), 'clock' = 실제시각 (15:43 / 16:38).
       옥대표님 요청. 마지막 mode 는 localStorage 에 영구 (next session 복원). */
    R.timeMode = 'elapsed';
    try {
      var savedMode = localStorage.getItem('dmj_rd_replay_time_mode');
      if (savedMode === 'clock' || savedMode === 'elapsed') R.timeMode = savedMode;
    } catch (_) {}
    R.timeToggleEl = el('replay-time-toggle');
    if (R.timeToggleEl) {
      /* DOM 초기 reflect — localStorage 에 'clock' 이었으면 toggle 버튼도 동기 */
      R.timeToggleEl.querySelectorAll('button[data-rmode]').forEach(function (b) {
        var active = b.getAttribute('data-rmode') === R.timeMode;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      R.timeToggleEl.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-rmode]');
        if (!btn) return;
        var mode = btn.getAttribute('data-rmode');
        if (mode !== 'elapsed' && mode !== 'clock') return;
        R.timeMode = mode;
        try { localStorage.setItem('dmj_rd_replay_time_mode', mode); } catch (_) {}
        R.timeToggleEl.querySelectorAll('button[data-rmode]').forEach(function (b) {
          var active = b.getAttribute('data-rmode') === mode;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        /* toggle 직후 즉시 clock 표기 갱신 */
        updateClockEl(R.playT);
      });
    }

    // 재생 속도 버튼
    el('replay-speed').innerHTML = SPEED_STEPS.map(function (m) {
      return '<button type="button" class="replay__spd' +
        (m === 1 ? ' is-active' : '') + '" data-s="' + m + '">' + m + 'x</button>';
    }).join('');

    buildChips();
    buildRider();
    renderReplayStats();
    buildGraphs();
    buildSyncPanel();
    bindEvents();

    setLayout('map');     // 영상 전 — 지도 모드로 시작

    // 캔버스 크기·프리렌더는 레이아웃이 잡힌 다음 프레임에
    setTimeout(function () {
      if (!R) return;
      relayout();
      seek(R.t0, true);
    }, 80);

    seek(R.t0, true);
    /* §189 (샘 2026-06-04) — 이전에 올렸던 영상 blob 을 IndexedDB 에서
       복원. 기존 loadVideoFiles 경로로 추가돼 autoPlaceClip 의
       'Saved manual placement' (rd_videosync_v1) 와 자동 연결 —
       수동 동기화 위치까지 그대로 살아난다. 비동기·실패 무해. */
    restorePersistedClips();
    return true;
  }

  function close() {
    if (!R) return;
    if (R.raf) { try { global.cancelAnimationFrame(R.raf); } catch (e) {} }
    /* 동기화 저장 flush (데이빗 2026-06-03) — 디바운스(400ms) 저장이 대기 중인데
       리플레이를 닫으면 옛 코드는 타이머만 취소해 저장이 통째로 유실됐다.
       그래서 "한 번 맞춘 영상도 다시 넣으면 또 맞춰야" 하던 회귀. 닫기 전 즉시 저장. */
    if (clipSaveTimer) {
      clearTimeout(clipSaveTimer); clipSaveTimer = null;
      try { saveClipStarts(); } catch (e) {}
    }
    if (R.keyHandler) document.removeEventListener('keydown', R.keyHandler);
    if (R.resizeHandler) global.removeEventListener('resize', R.resizeHandler);
    if (R.pagehideHandler) {
      global.removeEventListener('pagehide', R.pagehideHandler);
      global.removeEventListener('visibilitychange', R.pagehideHandler);
    }
    if (R.map) { try { R.map.remove(); } catch (e) {} R.map = null; }
    if (R.video) {
      try { R.video.pause(); } catch (e) {}
      R.video.onloadedmetadata = null;
      R.video.onerror = null;
      R.video.removeAttribute('src');
      try { R.video.load(); } catch (e) {}
    }
    // 모든 클립의 object URL 해제
    (R.clips || []).forEach(function (c) {
      try { URL.revokeObjectURL(c.url); } catch (e) {}
    });
    var onClose = R.onClose;
    var view = el('replay-view');
    if (view) view.hidden = true;
    document.body.style.overflow = '';
    document.body.classList.remove('rd-replay-active');   // 전역 KO/EN 토글 복원
    R = null;
    try { onClose(); } catch (e) {}
  }

  /* ============================================================
   * 16) 공개 API
   * ============================================================ */
  var RDReplay = {
    open: open,
    close: close,
    isOpen: function () { return !!R; },
    setWindDir: setWindDir,
    /* Node self-test 용 순수 함수 묶음 */
    _test: {
      clamp: clamp,
      sampleIndexAtTime: sampleIndexAtTime,
      lerpAngle: lerpAngle,
      lerpNum: lerpNum,
      sampleState: sampleState,
      interpAtTime: interpAtTime,
      detectMetrics: detectMetrics,
      buildMetricSlots: buildMetricSlots,
      videoTimeForElapsed: videoTimeForElapsed,
      elapsedForVideoTime: elapsedForVideoTime,
      buildSeries: buildSeries,
      computeRange: computeRange,
      miniYTicks: miniYTicks,
      fmtClock: fmtClock,
      fmtRealClock: fmtRealClock,
      fmtRealDateTime: fmtRealDateTime,
      parseClockToElapsed: parseClockToElapsed,
      parseMp4Meta: parseMp4Meta,
      videoMissingOnDevice: videoMissingOnDevice,   /* §423 */
      parseFilenameDate: parseFilenameDate,
      parseIso8601: parseIso8601,
      extractCreationDate: extractCreationDate,
      pickVideoOffset: pickVideoOffset,
      niceTicks: niceTicks,
      METRICS: METRICS
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RDReplay;
  else global.RDReplay = RDReplay;
})(typeof window !== 'undefined' ? window : globalThis);
