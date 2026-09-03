/* ============================================================
 * parsers/waterspeed-csv.js — Waterspeed 앱 CSV 파서 (§448)
 *
 * Waterspeed(iOS/watchOS) 앱이 내보내는 세션 CSV 를 GPX·RaceBox CSV 와
 * 동일한 내부 구조(트랙→세그먼트→포인트)로 변환한다.
 *
 * ── 포맷 ────────────────────────────────────────────────────
 *   메타데이터 행 없이 첫 줄이 곧 헤더다:
 *     Timestamp (from 1970),Date,Time,Lat,Long,Speed (m/s),Heading,
 *     HR,Distance (m),Calories (SUM)
 *   데이터 약 1Hz.
 *
 * ── 단위 (헤더에 명시돼 있음) ───────────────────────────────
 *   · Speed = **m/s**.  RaceBox CSV 의 Speed 는 km/h 라 ÷3.6 하지만
 *     (메모리 racebox-csv-speed-kmh) Waterspeed 는 헤더가 단위를
 *     직접 밝히므로 변환하지 않는다. 헤더에 "(m/s)" 가 없으면
 *     단위를 단정할 수 없으므로 속도를 버리고 좌표에서 유도한다.
 *   · Timestamp = Unix epoch 초(소수 포함).  Date/Time 열은 현지시각
 *     문자열이라 시간대 정보가 없다 — epoch 를 신뢰한다.
 *   · HR = bpm. 미측정 구간은 0 으로 채워 나오므로 0 은 결측 취급한다.
 *   · Distance/Calories 는 앱 누적값. Distance 가 0 으로만 채워진
 *     내보내기도 있어(실측 확인) 거리는 우리가 좌표에서 다시 계산한다.
 *
 * 이 포맷의 값어치는 **1Hz 심박**이다. 훈련부하(Banister TRIMP) 산출과
 * 융합 세션의 HR 도너로 쓴다.
 *
 * 브라우저:  RDWaterspeedCSV.parse(text) · .looksLike(text)
 * Node:      require('./parsers/waterspeed-csv').parse(text)
 * ============================================================ */
(function (global) {
  'use strict';

  function num(v) {
    if (v == null) return null;
    var s = String(v).trim();
    if (!s) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  /* 헤더에 Waterspeed 고유 조합(Lat+Long+Speed+HR, 그리고 epoch 열)이
     있는지로 판정한다. RaceBox 는 Latitude/Longitude 라 겹치지 않는다. */
  function looksLike(text) {
    if (!text) return false;
    var head = String(text).slice(0, 400);
    if (!/Timestamp\s*\(from\s*1970\)/i.test(head)) return false;
    return /(^|,)\s*Lat\s*(,|$)/i.test(head) && /(^|,)\s*Long\s*(,|$)/i.test(head);
  }

  function parse(text) {
    if (!text) throw new Error('빈 CSV 입니다.');
    var lines = String(text).split(/\r\n|\n|\r/);

    var headerIdx = -1;
    for (var i = 0; i < Math.min(lines.length, 20); i++) {
      if (/Timestamp\s*\(from\s*1970\)/i.test(lines[i])) { headerIdx = i; break; }
    }
    if (headerIdx < 0) {
      throw new Error('Waterspeed CSV 헤더(Timestamp (from 1970),…)를 찾을 수 없습니다.');
    }

    var headers = lines[headerIdx].split(',');
    var col = {};
    for (var h = 0; h < headers.length; h++) col[headers[h].trim()] = h;

    /* 열 이름을 느슨하게 찾는다 — 앱 버전에 따라 표기가 조금씩 다르다. */
    function find(re) {
      for (var k in col) if (Object.prototype.hasOwnProperty.call(col, k)) {
        if (re.test(k)) return col[k];
      }
      return undefined;
    }
    var cTs    = find(/^Timestamp/i);
    var cLat   = find(/^Lat/i);
    var cLng   = find(/^(Long|Lon)/i);
    var cSpeed = find(/^Speed/i);
    var cHead  = find(/^Heading/i);
    var cHr    = find(/^HR|Heart/i);
    var cCal   = find(/^Calories/i);

    if (cTs === undefined || cLat === undefined || cLng === undefined) {
      throw new Error('Waterspeed CSV 에 필수 열(Timestamp/Lat/Long)이 없습니다.');
    }

    /* 속도 단위는 헤더가 밝힐 때만 신뢰한다. 밝히지 않으면 좌표에서
       유도하도록 버린다 — 단위를 잘못 가정하면 가짜 스파이크가 난다. */
    var speedIsMs = false;
    if (cSpeed !== undefined) {
      speedIsMs = /m\s*\/\s*s/i.test(headers[cSpeed] || '');
    }

    var points = [];
    var skippedBadCoord = 0, skippedNoTime = 0;
    var withSpeed = 0, withHr = 0;

    for (var d = headerIdx + 1; d < lines.length; d++) {
      var raw = lines[d];
      if (raw == null || !raw.trim()) continue;
      var f = raw.split(',');

      var ts = num(f[cTs]);
      if (ts == null || ts <= 0) { skippedNoTime++; continue; }
      /* epoch 초 → Date. 밀리초로 내보내는 변형 대비 자릿수로 구분. */
      var ms = (ts > 1e11) ? ts : ts * 1000;
      if (!isFinite(ms)) { skippedNoTime++; continue; }
      /* ⚠ time 은 **epoch 밀리초 숫자**다. 예전엔 여기서 Date 객체를
         만들었는데, GPX·RaceBox·병합기는 전부 숫자를 낸다. 이 파서만
         달랐다. Date 객체는 뺄셈·정렬이 다 되니 분석은 멀쩡히 돌아가고,
         **JSON.stringify 될 때만** ISO 문자열로 바뀐다 — 그래서
         session.startEpoch → dateEpoch 로 실려 저장된 뒤에야 터졌다.
         (시즌 흐름 그래프가 x 축 통째로 NaN 이라 조용히 빈 그래프였다.) */
      var time = ms;

      var lat = num(f[cLat]);
      var lng = num(f[cLng]);
      if (lat == null || lng == null) { skippedBadCoord++; continue; }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { skippedBadCoord++; continue; }
      if (lat === 0 && lng === 0) { skippedBadCoord++; continue; }

      var pt = { lat: lat, lng: lng, ele: null, time: time, speed: null };

      if (speedIsMs) {
        var sp = num(f[cSpeed]);
        /* 40 m/s(=78kt)를 넘으면 GPS 스파이크로 보고 버린다 — 윙포일
           최고속은 30kt 내외다(메모리 working-speed-tool). */
        if (sp != null && sp >= 0 && sp < 40) { pt.speed = sp; withSpeed++; }
      }

      if (cHead !== undefined) {
        var hd = num(f[cHead]);
        if (hd != null && hd >= 0 && hd <= 360) pt.heading = hd;
      }

      /* HR 0 = 미측정(센서 미착용·연결 끊김). 결측으로 둔다. */
      if (cHr !== undefined) {
        var hr = num(f[cHr]);
        if (hr != null && hr >= 30 && hr <= 240) { pt.hr = hr; withHr++; }
      }

      if (cCal !== undefined) {
        var cal = num(f[cCal]);
        if (cal != null && cal >= 0) pt.calories = cal;
      }

      points.push(pt);
    }

    if (points.length < 2) {
      throw new Error('Waterspeed CSV 에서 유효한 포인트를 찾지 못했습니다 (' +
        points.length + '개).');
    }

    /* time 이 숫자가 됐으므로 여기서 Date 를 만든다 (예전엔 Date 객체였다) */
    var startDate = new Date(points[0].time).toISOString().slice(0, 10);
    var trackName = 'Waterspeed 세션 ' + startDate;

    return {
      source: 'waterspeed-csv',
      tracks: [{ name: trackName, segments: [points] }],
      pointCount: points.length,
      trackName: trackName,
      hasTime: true,
      speedSource: (withSpeed >= points.length * 0.5) ? 'device' : 'derived',
      hasImu: false,
      imuPointCount: 0,
      hasHR: withHr >= points.length * 0.5,
      hrPointCount: withHr,
      /* 앱 누적 칼로리 — 참고용. 훈련부하는 심박에서 따로 낸다. */
      caloriesTotal: points.length ? (points[points.length - 1].calories || null) : null,
      creator: 'Waterspeed',
      skipped: { badCoord: skippedBadCoord, noTime: skippedNoTime }
    };
  }

  var WS = { parse: parse, looksLike: looksLike };
  if (typeof module !== 'undefined' && module.exports) module.exports = WS;
  else global.RDWaterspeedCSV = WS;
})(typeof window !== 'undefined' ? window : globalThis);
