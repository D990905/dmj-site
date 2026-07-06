/* ============================================================
 * analysis-imu.js — IMU(가속도계) → heel·pitch 각도 (§430)
 *
 * RaceBox CSV 의 GForceX/Y/Z(g) 를 힐(좌우 기울기)·피치(앞뒤 기울기)
 * 각도로 변환한다. session-merger 가 IMU 소스를 primary 트랙 타임라인에
 * 정합한 뒤 각 포인트에 대해 이 모듈을 호출해 p.heel / p.pitch 를 채운다.
 *
 * ── 축 매핑 가정 (v1 — 옥대표님 검증 필요) ──────────────────
 *   RaceBox 부착 방향에 따라 X/Y/Z 물리축이 달라진다. v1 기본 가정:
 *     · GForceX = 진행 방향(앞뒤)
 *     · GForceY = 좌·우(횡)
 *     · GForceZ = 위(중력 방향) — 정지 시 GForceZ ≈ +1.0 g 로 실측 확인
 *   이 가정에서:
 *     heel(deg)  = atan2(GForceY, GForceZ) * 180/π   (좌우 롤)
 *     pitch(deg) = atan2(GForceX, GForceZ) * 180/π   (앞뒤 피치)
 *
 *   ⚠ 부호(좌현+/우현−)와 축 방향은 옥대표님이 실제 라이딩 감각과
 *   대조해 검증해야 한다. 검증 후 필요하면 AXIS 상수만 뒤집으면 된다
 *   (데이터·다운스트림 변경 없이). Kalman/상보 필터(자이로 융합)는 v1
 *   에서 생략하고 가속도계만 사용 — 순간 가속(코너·충격)에 민감하나
 *   저역통과(중앙값) 평활로 완화한다.
 *
 * 도메인 산식을 지어내지 않는다 — 위 변환은 표준 3축 가속도계 틸트
 * 공식이며 가정(축·부호)은 위에 명시. 검증 전까지 '가정값' 이다.
 *
 * 브라우저: RDImu.*  ·  Node: require('./analysis-imu')
 * ============================================================ */
(function (global) {
  'use strict';

  var RAD2DEG = 180 / Math.PI;

  /* 축 매핑/부호 — 옥대표님 검증 후 여기만 조정.
     sign 을 -1 로 바꾸면 해당 각도 부호가 반전된다. */
  var AXIS = {
    heelSign: 1,    // atan2(gy, gz) 의 부호 (좌현/우현 방향)
    pitchSign: 1    // atan2(gx, gz) 의 부호 (앞/뒤 방향)
  };

  /* GForce(g) → { heel, pitch } (deg). 입력 결측이면 null 필드. */
  function gforceToAngles(gx, gy, gz) {
    var heel = null, pitch = null;
    if (gy != null && gz != null && isFinite(gy) && isFinite(gz)) {
      heel = AXIS.heelSign * Math.atan2(gy, gz) * RAD2DEG;
    }
    if (gx != null && gz != null && isFinite(gx) && isFinite(gz)) {
      pitch = AXIS.pitchSign * Math.atan2(gx, gz) * RAD2DEG;
    }
    return { heel: heel, pitch: pitch };
  }

  /* 포인트 배열의 각 원소(gforceX/Y/Z 보유)에 heel/pitch 를 채운다.
     이미 heel/pitch 가 있으면(다른 소스) 덮지 않는다. 반환: 채운 개수. */
  function annotate(points) {
    if (!points || !points.length) return 0;
    var n = 0;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!p) continue;
      if (p.heel != null && p.pitch != null) continue;
      if (p.gforceZ == null) continue;
      var a = gforceToAngles(p.gforceX, p.gforceY, p.gforceZ);
      if (p.heel == null && a.heel != null) { p.heel = a.heel; n++; }
      if (p.pitch == null && a.pitch != null) p.pitch = a.pitch;
    }
    return n;
  }

  /* 중앙값(median) 저역통과 — 순간 가속 노이즈 완화용.
     window 홀수(기본 5). heel/pitch 등 각도 시계열에 그대로 적용 가능. */
  function medianSmooth(values, window) {
    var w = window || 5;
    if (w < 3 || !values || values.length < w) return values ? values.slice() : [];
    var half = w >> 1, out = new Array(values.length);
    for (var i = 0; i < values.length; i++) {
      if (values[i] == null) { out[i] = null; continue; }
      var buf = [];
      for (var j = i - half; j <= i + half; j++) {
        if (j >= 0 && j < values.length && values[j] != null) buf.push(values[j]);
      }
      if (!buf.length) { out[i] = values[i]; continue; }
      buf.sort(function (a, b) { return a - b; });
      out[i] = buf[buf.length >> 1];
    }
    return out;
  }

  /* heel 히스토그램 — deg 단위 bin 카운트. sideFn(i) 가 'P'/'S'/null 을
     돌려주면 좌현/우현으로 분리 집계. binDeg 기본 5°. */
  function heelHistogram(samples, opts) {
    opts = opts || {};
    var binDeg = opts.binDeg || 5;
    var sideFn = typeof opts.sideFn === 'function' ? opts.sideFn : null;
    var bins = {}, port = {}, star = {}, total = 0;
    function add(map, deg) {
      var b = Math.round(deg / binDeg) * binDeg;
      map[b] = (map[b] || 0) + 1;
    }
    for (var i = 0; i < samples.length; i++) {
      var h = samples[i] && samples[i].heel;
      if (h == null || !isFinite(h)) continue;
      add(bins, h); total++;
      if (sideFn) {
        var s = sideFn(i);
        if (s === 'P') add(port, h);
        else if (s === 'S') add(star, h);
      }
    }
    return { bins: bins, port: port, starboard: star, count: total, binDeg: binDeg };
  }

  /* 간단 통계 (평균·표준편차·최소·최대·중앙값·|abs| 평균) — 각도용 */
  function stats(samples, key) {
    var vals = [];
    for (var i = 0; i < samples.length; i++) {
      var v = samples[i] && samples[i][key];
      if (v != null && isFinite(v)) vals.push(v);
    }
    if (!vals.length) return null;
    var sum = 0, absSum = 0, min = Infinity, max = -Infinity;
    for (var k = 0; k < vals.length; k++) {
      sum += vals[k]; absSum += Math.abs(vals[k]);
      if (vals[k] < min) min = vals[k];
      if (vals[k] > max) max = vals[k];
    }
    var mean = sum / vals.length;
    var vsum = 0;
    for (var m = 0; m < vals.length; m++) vsum += (vals[m] - mean) * (vals[m] - mean);
    vals.sort(function (a, b) { return a - b; });
    return {
      count: vals.length, mean: mean, absMean: absSum / vals.length,
      sd: Math.sqrt(vsum / vals.length), min: min, max: max,
      median: vals[vals.length >> 1]
    };
  }

  var Imu = {
    AXIS: AXIS,
    gforceToAngles: gforceToAngles,
    annotate: annotate,
    medianSmooth: medianSmooth,
    heelHistogram: heelHistogram,
    stats: stats
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Imu;
  else global.RDImu = Imu;
})(typeof window !== 'undefined' ? window : globalThis);
