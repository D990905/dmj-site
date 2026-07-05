/* ============================================================
 * csv-parser.js — SailTech 통합 CSV 파서 (라이딩 통계 대시보드)
 * SailTechHUB 가 생성하는 통합 세션 CSV(25Hz IMU + HR) 를
 * GPX·VKX 파서와 동일한 내부 구조(트랙→세그먼트→포인트)로 변환.
 *
 * CSV 포맷:
 *   - '#' 으로 시작하는 행은 메타데이터(무시)
 *   - 첫 비메타 행은 헤더(열 이름)
 *   - 이후 데이터 행: Time, Latitude, Longitude, Altitude_m,
 *     Speed_kt, Speed_kmh, GForceX~Z, GyroX~Z_dps,
 *     Pitch_accel_deg, Heel_accel_deg, Pitch_comp_deg,
 *     Heel_comp_deg, YawRate_dps, HR_bpm
 *
 * 속도는 내부적으로 m/s 로 변환 (GPX·VKX 와 동일).
 * 25Hz 전량 사용 — 다운샘플·캡 없음.
 *
 * 브라우저: parseCSV(csvString)
 * Node 테스트: parseCSV(csvString)
 * ============================================================ */
(function (global) {
  'use strict';

  var KT_TO_MS = 1 / 1.94384;   // 1 kt = 0.514444 m/s

  /* 메타데이터(# 행)에서 키-값 추출 */
  function parseMeta(lines) {
    var meta = {};
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.charAt(0) !== '#') break;
      var m = l.match(/^#\s*(.+?):\s*(.+)$/);
      if (m) meta[m[1].trim()] = m[2].trim();
    }
    return meta;
  }

  /* CSV 행을 필드 배열로 분리 — 쉼표 구분, 따옴표 미사용(숫자 전용) */
  function splitRow(line) {
    return line.split(',');
  }

  /* ISO 8601 문자열 → epoch ms.
     '2026-07-04T07:51:00.000Z' 같은 형식. */
  function parseTime(s) {
    if (!s) return null;
    var ms = Date.parse(s);
    return isFinite(ms) ? ms : null;
  }

  /* 안전한 parseFloat — 빈 문자열·undefined → null */
  function num(s) {
    if (s == null || s === '') return null;
    var v = parseFloat(s);
    return isFinite(v) ? v : null;
  }

  /* ============================================================
   * 메인 파서
   * ============================================================ */
  function parseCSV(csvString) {
    if (typeof csvString !== 'string' || !csvString.trim()) {
      throw new Error('빈 파일이거나 내용을 읽을 수 없습니다.');
    }

    var rawLines = csvString.split(/\r?\n/);

    /* 메타데이터 추출 */
    var meta = parseMeta(rawLines);

    /* 헤더 행 찾기 — '#' 이 아닌 첫 비어있지 않은 행 */
    var headerIdx = -1;
    for (var i = 0; i < rawLines.length; i++) {
      var l = rawLines[i].trim();
      if (!l) continue;
      if (l.charAt(0) === '#') continue;
      headerIdx = i;
      break;
    }
    if (headerIdx < 0) {
      throw new Error('CSV 헤더를 찾을 수 없습니다. 빈 파일이거나 형식이 잘못되었습니다.');
    }

    var headers = splitRow(rawLines[headerIdx]);
    /* 열 이름 → 인덱스 매핑 (공백 제거) */
    var col = {};
    for (var h = 0; h < headers.length; h++) {
      col[headers[h].trim()] = h;
    }

    /* 필수 열 확인 */
    var required = ['Time', 'Latitude', 'Longitude'];
    for (var r = 0; r < required.length; r++) {
      if (col[required[r]] === undefined) {
        throw new Error('CSV 에 필수 열 "' + required[r] + '" 이(가) 없습니다.');
      }
    }

    /* 속도 열 — Speed_kt 우선, 없으면 Speed_kmh */
    var hasSpeedKt  = col['Speed_kt']  !== undefined;
    var hasSpeedKmh = col['Speed_kmh'] !== undefined;
    /* 자세(attitude) 열 — Complementary Filter 보정값 우선 */
    var hasPitchComp = col['Pitch_comp_deg'] !== undefined;
    var hasHeelComp  = col['Heel_comp_deg']  !== undefined;
    var hasPitchAccel = col['Pitch_accel_deg'] !== undefined;
    var hasHeelAccel  = col['Heel_accel_deg']  !== undefined;
    /* HR */
    var hasHRCol = col['HR_bpm'] !== undefined;

    /* 데이터 행 파싱 */
    var points = [];
    var skippedBadCoord = 0, skippedNoTime = 0;
    var withSpeed = 0, withAtt = 0, withHR = 0;

    for (var d = headerIdx + 1; d < rawLines.length; d++) {
      var line = rawLines[d].trim();
      if (!line || line.charAt(0) === '#') continue;

      var f = splitRow(line);

      var time = parseTime(f[col['Time']]);
      if (!time) { skippedNoTime++; continue; }

      var lat = num(f[col['Latitude']]);
      var lng = num(f[col['Longitude']]);
      if (lat == null || lng == null) { skippedBadCoord++; continue; }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { skippedBadCoord++; continue; }
      if (lat === 0 && lng === 0) { skippedBadCoord++; continue; }

      var ele = (col['Altitude_m'] !== undefined) ? num(f[col['Altitude_m']]) : null;

      /* 속도 → m/s */
      var speed = null;
      if (hasSpeedKt) {
        var sKt = num(f[col['Speed_kt']]);
        if (sKt != null && sKt >= 0 && sKt < 200) speed = sKt * KT_TO_MS;
      } else if (hasSpeedKmh) {
        var sKmh = num(f[col['Speed_kmh']]);
        if (sKmh != null && sKmh >= 0 && sKmh < 400) speed = sKmh / 3.6;
      }

      var pt = {
        lat: lat,
        lng: lng,
        ele: ele,
        time: time,
        speed: speed
      };

      /* 자세 — Complementary Filter 보정값 우선, 없으면 가속도계 값 */
      var pitch = null, heel = null;
      if (hasPitchComp) pitch = num(f[col['Pitch_comp_deg']]);
      if (pitch == null && hasPitchAccel) pitch = num(f[col['Pitch_accel_deg']]);
      if (hasHeelComp) heel = num(f[col['Heel_comp_deg']]);
      if (heel == null && hasHeelAccel) heel = num(f[col['Heel_accel_deg']]);

      if (pitch != null) { pt.pitch = pitch; withAtt++; }
      if (heel  != null) pt.heel  = heel;

      /* 심박수 */
      if (hasHRCol) {
        var hr = num(f[col['HR_bpm']]);
        if (hr != null && hr >= 20 && hr <= 240) {
          pt.hr = Math.round(hr);
          withHR++;
        }
      }

      if (speed != null) withSpeed++;
      points.push(pt);
    }

    if (points.length < 2) {
      throw new Error('CSV 파일에서 유효한 포인트를 찾지 못했습니다 (' +
        points.length + '개). 빈 파일이거나 형식이 맞지 않습니다.');
    }

    /* 세션 이름 — 메타데이터의 Date 또는 기본값 */
    var sessionDate = meta['Date'] || '';
    var trackName = 'SailTech 세션' + (sessionDate ? ' ' + sessionDate : '');

    return {
      tracks: [{ name: trackName, segments: [points] }],
      pointCount: points.length,
      trackName: trackName,
      hasTime: true,
      speedSource: withSpeed >= points.length * 0.5 ? 'device' : 'derived',
      hasAttitude: withAtt >= points.length * 0.5,
      hasHR: withHR >= points.length * 0.5,
      hrPointCount: withHR,
      /* CSV 메타데이터 — 참고용 */
      csvMeta: meta,
      skipped: { badCoord: skippedBadCoord, noTime: skippedNoTime }
    };
  }

  /* 매직 바이트/텍스트로 CSV 여부 판정 — 업로드 분기 보조용.
     '#' 메타 행으로 시작하거나 'Time,Lat' 패턴이면 CSV 로 본다. */
  function looksLikeCSV(text) {
    if (typeof text !== 'string') return false;
    var first = text.trim().slice(0, 200);
    /* SailTech 통합 CSV 는 '# SailTech' 으로 시작 */
    if (/^#\s*SailTech/i.test(first)) return true;
    /* 일반 CSV — 'Time' + 'Lat' 열이 있으면 가능성 높음 */
    if (/\bTime\b/.test(first) && /\bLat/i.test(first)) return true;
    return false;
  }

  var Csv = {
    parseCSV: parseCSV,
    looksLikeCSV: looksLikeCSV
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Csv;
  else global.RDCsv = Csv;
})(typeof window !== 'undefined' ? window : globalThis);
