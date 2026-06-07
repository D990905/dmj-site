/* ============================================================
 * vkx-parser.js — Vakaros VKX 1.x 바이너리 파서 (라이딩 통계 대시보드)
 * Vakaros Atlas 2 세일링 계측기의 .vkx 로그를 GPX 파서와 동일한
 * 내부 구조(트랙 → 세그먼트 → 포인트)로 변환한다.
 * 10Hz 원본 전량 사용 — 다운샘플·포인트 cap·보간 없음.
 * GPX 에는 없는 heel(힐)·pitch(피치) 를 자세 쿼터니언에서 계산해 보존.
 *
 * 포맷 사양: VKX 1.4 (github.com/vakaros/vkx). 모든 수치 little-endian.
 * 행 구조: [1바이트 key][key 별 고정 길이 payload]. 핵심 행은 0x02
 *   (Position, Velocity, Orientation — payload 44바이트).
 *
 * 브라우저: parseVKX(arrayBuffer)        // FileReader.readAsArrayBuffer 결과
 * Node 테스트: parseVKX(buffer)          // Buffer / Uint8Array / ArrayBuffer 허용
 * ============================================================ */
(function (global) {
  'use strict';

  /* VKX 행별 payload 크기 (key -> 바이트 수). 사양 1.0~1.4 의 모든 key.
     0x02 만 텔레메트리에 쓰지만, 나머지 행을 정확히 건너뛰려면 전부 필요. */
  var ROW_SIZE = {
    0xFF: 7,   // Page Header (약 2kB 마다, payload[0] = 포맷 버전)
    0xFE: 2,   // Page Terminator
    0x01: 32,  // 내부 메시지
    0x02: 44,  // Position, Velocity, Orientation  ← 핵심 텔레메트리
    0x03: 20,  // Declination
    0x04: 13,  // Race Timer Event
    0x05: 17,  // Line Position
    0x06: 18,  // Shift Angle
    0x07: 12,  // 내부 메시지
    0x08: 13,  // Device Configuration
    0x0A: 16,  // Wind (Calypso 풍향계)
    0x0B: 16,  // Speed Through Water
    0x0C: 12,  // Depth
    0x0E: 16,  // 내부 메시지
    0x0F: 16,  // Load (Cyclops 로드셀)
    0x10: 12,  // Temperature
    0x20: 13,  // 내부 메시지
    0x21: 52   // 내부 메시지
  };

  var KEY_PAGE_HEADER = 0xFF;
  var KEY_POSITION    = 0x02;
  var RAD2DEG = 180 / Math.PI;
  var ALT_SENTINEL_LIMIT = 100000; // |고도| 가 이 값을 넘으면 'GPS 고도 없음' 센티넬로 간주

  /* 입력(ArrayBuffer / TypedArray / Node Buffer)을 DataView + Uint8Array 로 정규화 */
  function toBytes(input) {
    if (input == null) throw new Error('빈 파일이거나 내용을 읽을 수 없습니다.');
    var u8;
    if (input instanceof ArrayBuffer) {
      u8 = new Uint8Array(input);
    } else if (ArrayBuffer.isView(input)) {
      // Uint8Array, Node Buffer 등 — 원본 버퍼의 해당 구간만 참조
      u8 = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
      throw new Error('VKX 파일은 바이너리로 읽어야 합니다 (ArrayBuffer 가 필요합니다).');
    }
    return {
      u8: u8,
      view: new DataView(u8.buffer, u8.byteOffset, u8.byteLength),
      length: u8.byteLength
    };
  }

  /* U8(부호 없는 64비트) 를 BigInt 없이 읽는다. 밀리초 타임스탬프는
     2^53 보다 한참 작아 Number 로 정확히 표현된다. */
  function readU64(dv, o) {
    var lo = dv.getUint32(o, true);
    var hi = dv.getUint32(o + 4, true);
    return hi * 4294967296 + lo;
  }

  /* 단위 쿼터니언(w,x,y,z — NED 프레임 기준 자세) -> {heel, pitch} (도).
     heel  = roll  : 전후축(앞뒤) 회전 = 좌우 기울기(힐).
     pitch = trim  : 좌우축 회전 = 앞뒤 기울기(트림). bow up(뱃머리 들림) = 양수.
     yaw(헤딩)는 분석 모듈이 트랙에서 따로 산출하므로 반환하지 않는다.

     References — Quaternion → Euler (ZYX intrinsic) 표준:
       · Diebel, J. 2006. "Representing Attitude: Euler Angles, Unit Quaternions,
         and Rotation Vectors". Stanford University.
         astro.rug.nl/software/kapteyn-beta/_downloads/attitude.pdf
       · Vakaros VKX 1.4 file format spec — github.com/vakaros/vkx
       · asin 정의역 보호 (sinp clamp ±1) — gimbal lock 회피 표준. */
  function quatToHeelPitch(w, x, y, z) {
    var mag = Math.sqrt(w * w + x * x + y * y + z * z);
    if (!(mag > 1e-6)) return { heel: null, pitch: null };   // 자세 fix 없음
    w /= mag; x /= mag; y /= mag; z /= mag;
    var heel = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * RAD2DEG;
    var sinp = 2 * (w * y - z * x);
    if (sinp > 1) sinp = 1; else if (sinp < -1) sinp = -1;   // asin 정의역 보호
    var pitch = Math.asin(sinp) * RAD2DEG;
    return { heel: heel, pitch: pitch };
  }

  /* VKX 바이너리 파싱 진입점.
     반환 구조는 GPX 파서(parseGPX)와 동일 — 기존 분석 파이프라인이
     그대로 동작한다. 각 포인트는 {lat,lng,ele,time,speed} 에 더해
     heel·pitch 를 (값이 있을 때만) 가진다. */
  function parseVKX(input) {
    var b = toBytes(input);
    if (b.length < 8) {
      throw new Error('VKX 파일이 비어 있거나 너무 짧습니다.');
    }
    if (b.u8[0] !== KEY_PAGE_HEADER) {
      throw new Error('VKX 파일이 아닙니다 (페이지 헤더 0xFF 로 시작하지 않습니다).');
    }

    var dv = b.view;
    var points = [];
    var skippedBadCoord = 0, skippedNoTime = 0;
    var formatVersion = null;
    var i = 0;

    while (i < b.length) {
      var key = b.u8[i];
      var size = ROW_SIZE[key];
      if (size === undefined) {
        throw new Error('VKX 행을 해석할 수 없습니다 (알 수 없는 key 0x' +
          key.toString(16) + ', 위치 ' + i + '바이트). 지원하지 않는 VKX 버전일 수 있습니다.');
      }
      var p = i + 1;                       // payload 시작
      if (p + size > b.length) {
        break;                             // 마지막 행이 잘렸으면 무시하고 종료
      }
      if (key === KEY_PAGE_HEADER && formatVersion === null) {
        formatVersion = b.u8[p];           // U1 — 포맷 버전 (0x05 = VKX 1.4)
      }
      if (key === KEY_POSITION) {
        var time = readU64(dv, p);                       // U8  ms UTC
        var lat  = dv.getInt32(p + 8,  true) * 1e-7;     // I4  1e-7 도
        var lng  = dv.getInt32(p + 12, true) * 1e-7;
        var sog  = dv.getFloat32(p + 16, true);          // F4  m/s (SOG)
        /* p+20: COG(라디안) — 분석이 트랙에서 헤딩을 산출하므로 사용 안 함 */
        var alt  = dv.getFloat32(p + 24, true);          // F4  m
        var qw   = dv.getFloat32(p + 28, true);          // 자세 쿼터니언
        var qx   = dv.getFloat32(p + 32, true);
        var qy   = dv.getFloat32(p + 36, true);
        var qz   = dv.getFloat32(p + 40, true);

        if (time <= 0) {
          skippedNoTime++;
        } else if (!isFinite(lat) || !isFinite(lng) ||
                   lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
                   (lat === 0 && lng === 0)) {
          skippedBadCoord++;               // GPS fix 없음 — 좌표가 의미 없는 행
        } else {
          var ele = (isFinite(alt) && Math.abs(alt) < ALT_SENTINEL_LIMIT) ? alt : null;
          var att = quatToHeelPitch(qw, qx, qy, qz);
          var pt = {
            lat: lat, lng: lng, ele: ele, time: time,
            speed: (isFinite(sog) && sog >= 0 && sog < 100) ? sog : null
          };
          /* heel·pitch 는 값이 있을 때만 부여 — GPX 포인트와 동일하게
             '키 없음' = '자세 데이터 없음' 을 뜻하도록 한다. */
          if (att.heel  != null) pt.heel  = att.heel;
          if (att.pitch != null) pt.pitch = att.pitch;
          points.push(pt);
        }
      }
      i += 1 + size;
    }

    if (points.length < 2) {
      throw new Error('VKX 파일에서 유효한 트랙 포인트(0x02 메시지)를 찾지 못했습니다 (' +
        points.length + '개). 빈 로그이거나 손상된 파일일 수 있습니다.');
    }

    var withSpeed = 0, withAtt = 0;
    for (var k = 0; k < points.length; k++) {
      if (points[k].speed != null) withSpeed++;
      if (points[k].heel  != null) withAtt++;
    }

    return {
      tracks: [{ name: 'Vakaros Atlas 2', segments: [points] }],
      pointCount: points.length,
      trackName: 'Vakaros Atlas 2 세션',
      hasTime: true,                                     // 0x02 는 항상 ms 타임스탬프 포함
      speedSource: withSpeed >= points.length * 0.5 ? 'device' : 'derived',
      hasAttitude: withAtt >= points.length * 0.5,       // heel·pitch 보유 여부
      formatVersion: formatVersion,                      // 참고용 (0x05 = VKX 1.4)
      skipped: { badCoord: skippedBadCoord, noTime: skippedNoTime }
    };
  }

  /* 매직 바이트로 VKX 여부 판정 — 업로드 분기 보조용.
     VKX 는 항상 0xFF 페이지 헤더로 시작한다. */
  function looksLikeVKX(input) {
    try {
      var b = toBytes(input);
      return b.length >= 8 && b.u8[0] === KEY_PAGE_HEADER;
    } catch (e) {
      return false;
    }
  }

  var Vkx = {
    parseVKX: parseVKX,
    looksLikeVKX: looksLikeVKX,
    quatToHeelPitch: quatToHeelPitch
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Vkx;
  else global.RDVkx = Vkx;
})(typeof window !== 'undefined' ? window : globalThis);
