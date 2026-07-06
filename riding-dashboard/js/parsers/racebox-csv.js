/* ============================================================
 * parsers/racebox-csv.js — RaceBox CSV 파서 (§430)
 *
 * RaceBox 트래커(예: RaceBox Mini/Micro)가 내보내는 세션 CSV 를
 * GPX·VKX·SailTech CSV 파서와 동일한 내부 구조(트랙→세그먼트→포인트)로
 * 변환한다. 이 파일은 SailTech 통합 CSV(js/csv-parser.js) 와는 완전히
 * 다른 포맷이므로 별도 파서로 둔다.
 *
 * ── RaceBox CSV 포맷 ────────────────────────────────────────
 *   상단: 메타데이터 (쉼표로 분리된 Key,Value 쌍)
 *     Format,RaceBox CSV
 *     Data Source,RaceBox 3242709024
 *     Date UTC,2026-07-05T05:51:36+00:00
 *     ...
 *   빈 줄
 *   헤더 행:
 *     Record,Time,Latitude,Longitude,Altitude,Speed,GForceX,GForceY,
 *     GForceZ,Lap,GyroX,GyroY,GyroZ
 *   데이터 행 (약 25Hz).
 *
 * ── 단위 결정 (검증됨) ──────────────────────────────────────
 *   · Speed = km/h.  RaceBox 트래커 CSV 의 Speed 열은 m/s 가 아니라
 *     km/h 다 (25k 샘플에서 GPX 대비 비율 3.605 로 실측 검증;
 *     메모리 racebox-csv-speed-kmh). 내부 표준(m/s)으로 ÷3.6 변환.
 *   · GForceX/Y/Z = g (중력가속도 단위). 정지 시 GForceZ ≈ 1.0 (Z=위).
 *   · GyroX/Y/Z = dps (deg/s).
 *   · Altitude = m. RaceBox 고도는 노이즈가 커 포일 높이 감지에는
 *     쓰지 않는다(메모리). ele 로만 보존.
 *
 * heel·pitch(각도) 변환은 여기서 하지 않는다 — GForce 원본만 포인트에
 * 실어 두고, 축 매핑 가정이 명시된 analysis-imu.js 가 계산한다
 * (session-merger 가 호출). 파서는 파싱만 책임진다.
 *
 * 브라우저:  RDRaceboxCSV.parse(csvString)  ·  RDRaceboxCSV.looksLike(text)
 * Node:      require('./parsers/racebox-csv').parse(csvString)
 * ============================================================ */
(function (global) {
  'use strict';

  var KMH_TO_MS = 1 / 3.6;   // RaceBox Speed(km/h) → m/s

  function num(s) {
    if (s == null || s === '') return null;
    var v = parseFloat(s);
    return isFinite(v) ? v : null;
  }

  function parseTime(s) {
    if (!s) return null;
    var ms = Date.parse(s.trim());
    return isFinite(ms) ? ms : null;
  }

  /* 상단 Key,Value 메타 행 → { key: value }.
     헤더 행(Record,Time,…)을 만나면 멈춘다. */
  function parseMeta(lines) {
    var meta = {}, i;
    for (i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l == null) continue;
      var trimmed = l.trim();
      if (!trimmed) continue;                 // 빈 줄은 건너뜀
      /* 데이터 헤더 도달 → 메타 종료 */
      if (/^Record\s*,/.test(trimmed)) break;
      var idx = l.indexOf(',');
      if (idx < 0) continue;
      var key = l.slice(0, idx).trim();
      var val = l.slice(idx + 1).trim();
      if (key) meta[key] = val;
    }
    return meta;
  }

  /* RaceBox CSV 여부 판정 — 업로드/융합 분기 보조.
     첫 줄이 'Format,RaceBox CSV' 이거나 Record/GForce 헤더가 보이면 참. */
  function looksLike(text) {
    if (typeof text !== 'string') return false;
    var head = text.slice(0, 600);
    if (/^\s*Format\s*,\s*RaceBox\s+CSV/i.test(head)) return true;
    if (/Record\s*,\s*Time\s*,\s*Latitude/i.test(head) && /GForce/i.test(head)) return true;
    return false;
  }

  function parse(csvString) {
    if (typeof csvString !== 'string' || !csvString.trim()) {
      throw new Error('빈 파일이거나 내용을 읽을 수 없습니다.');
    }

    var lines = csvString.split(/\r?\n/);
    var meta = parseMeta(lines);

    /* 헤더 행 찾기 — 'Record,Time,…' */
    var headerIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (/^Record\s*,/.test(lines[i].trim())) { headerIdx = i; break; }
    }
    if (headerIdx < 0) {
      throw new Error('RaceBox CSV 데이터 헤더(Record,Time,…)를 찾을 수 없습니다.');
    }

    var headers = lines[headerIdx].split(',');
    var col = {};
    for (var h = 0; h < headers.length; h++) col[headers[h].trim()] = h;

    var required = ['Time', 'Latitude', 'Longitude'];
    for (var r = 0; r < required.length; r++) {
      if (col[required[r]] === undefined) {
        throw new Error('RaceBox CSV 에 필수 열 "' + required[r] + '" 이(가) 없습니다.');
      }
    }

    var hasSpeed = col['Speed'] !== undefined;
    var hasGf = col['GForceX'] !== undefined && col['GForceY'] !== undefined &&
                col['GForceZ'] !== undefined;
    var hasGyro = col['GyroZ'] !== undefined;

    var points = [];
    var skippedBadCoord = 0, skippedNoTime = 0;
    var withSpeed = 0, withImu = 0;

    for (var d = headerIdx + 1; d < lines.length; d++) {
      var line = lines[d];
      if (line == null) continue;
      var t = line.trim();
      if (!t) continue;

      var f = line.split(',');

      var time = parseTime(f[col['Time']]);
      if (!time) { skippedNoTime++; continue; }

      var lat = num(f[col['Latitude']]);
      var lng = num(f[col['Longitude']]);
      if (lat == null || lng == null) { skippedBadCoord++; continue; }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { skippedBadCoord++; continue; }
      if (lat === 0 && lng === 0) { skippedBadCoord++; continue; }

      var ele = (col['Altitude'] !== undefined) ? num(f[col['Altitude']]) : null;

      var pt = { lat: lat, lng: lng, ele: ele, time: time, speed: null };

      /* 속도 km/h → m/s */
      if (hasSpeed) {
        var sKmh = num(f[col['Speed']]);
        if (sKmh != null && sKmh >= 0 && sKmh < 400) {   // km/h 상한(정신차림)
          pt.speed = sKmh * KMH_TO_MS;
          withSpeed++;
        }
      }

      /* IMU 원본 — heel/pitch 변환은 analysis-imu 가 담당 */
      if (hasGf) {
        var gx = num(f[col['GForceX']]);
        var gy = num(f[col['GForceY']]);
        var gz = num(f[col['GForceZ']]);
        if (gx != null && gy != null && gz != null) {
          pt.gforceX = gx; pt.gforceY = gy; pt.gforceZ = gz;
          withImu++;
        }
      }
      if (hasGyro) {
        var gzr = num(f[col['GyroZ']]);
        if (gzr != null) pt.gyroZ = gzr;
      }

      points.push(pt);
    }

    if (points.length < 2) {
      throw new Error('RaceBox CSV 에서 유효한 포인트를 찾지 못했습니다 (' +
        points.length + '개).');
    }

    var sessionDate = meta['Date'] || meta['Date UTC'] || '';
    var trackName = 'RaceBox 세션' + (sessionDate ? ' ' + sessionDate : '');

    return {
      source: 'racebox-csv',
      tracks: [{ name: trackName, segments: [points] }],
      pointCount: points.length,
      trackName: trackName,
      hasTime: true,
      speedSource: withSpeed >= points.length * 0.5 ? 'device' : 'derived',
      hasImu: withImu >= points.length * 0.5,
      imuPointCount: withImu,
      hasHR: false,
      hrPointCount: 0,
      csvMeta: meta,
      creator: meta['Data Source'] || 'RaceBox',
      skipped: { badCoord: skippedBadCoord, noTime: skippedNoTime }
    };
  }

  var RB = { parse: parse, looksLike: looksLike, KMH_TO_MS: KMH_TO_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = RB;
  else global.RDRaceboxCSV = RB;
})(typeof window !== 'undefined' ? window : globalThis);
