/* ============================================================
 * analysis-imu.js — IMU → heel·pitch 자세 추정 + 윙포일 보정 (§430)
 *
 * RaceBox CSV 의 GForceX/Y/Z(g) + GyroX/Y/Z(dps) 를 힐(좌우 롤)·피치
 * (앞뒤) 각도로 변환·보정한다. session-merger 가 IMU 소스에 대해
 * computeAttitude() 를 부른 뒤 heel/pitch 를 primary 트랙에 정합한다.
 *
 * ── 왜 가속도계만으로는 안 되나 (옥대표님 지적) ────────────
 *   가속도계는 '중력 + 선형가속'을 함께 잰다. 윙포일 라이딩 중 펌핑·
 *   파도 충격·코너 원심력이 중력에 섞여, atan2(Gy,Gz) 같은 정적 공식은
 *   실 세션에서 heel 변화율 p99 ≈ 172°/s 로 비현실적으로 튄다(실측).
 *   또 gmag(가속도 크기)가 >1.3g 2.1%, <0.7g 1.4% 로 순수 중력에서
 *   벗어난다. → 자이로를 융합하지 않으면 힐·피치가 '분리·보정' 안 된
 *   raw 노이즈로 남는다.
 *
 * ── 상보 필터(Complementary Filter) + 선형가속 게이팅 ──────
 *   heel[i]  = (1-β)·(heel[i-1]  + rollRate·dt)  + β·accelHeel
 *   pitch[i] = (1-β)·(pitch[i-1] + pitchRate·dt) + β·accelPitch
 *     · 자이로 각속도로 단기 예측(부드러움) + 가속도계로 장기 보정
 *       (드리프트 제거).  α = τ/(τ+dt) 가 자이로 가중, β=(1-α)·trust.
 *     · trust = 선형가속 게이팅: gmag 가 1g 에서 멀수록 accel 신뢰↓
 *       (펌핑·충격 구간에서 자이로 예측에 더 의존) → 튐 억제.
 *
 * ── 축·부호 (실 세션 데이터로 검증) ────────────────────────
 *   물리축: GForceX=전후, Y=좌우, Z=상하(정지 Gz≈+1 실측).
 *   저역통과(중력) 후 상관분석 결과:
 *     · heel(roll) 각속도 ↔ +GyroX  (r=0.31, 양)
 *     · pitch 각속도      ↔ −GyroY  (r=0.18, 음)
 *   부호가 실제 라이딩 감각과 어긋나면 AXIS 상수만 뒤집으면 된다
 *   (데이터·다운스트림 무변경). [[feedback_sailing_domain_verify_mandatory]]
 *
 * 도메인 산식을 지어내지 않는다 — 상보 필터는 표준 IMU 자세추정 기법,
 * 축·부호는 위처럼 실 데이터로 확정. 스케일·시정수는 아래 FILTER.
 *
 * 브라우저: RDImu.*  ·  Node: require('./analysis-imu')
 * ============================================================ */
(function (global) {
  'use strict';

  var RAD2DEG = 180 / Math.PI;

  /* 축 매핑/부호 — 실 세션 검증값. 라이딩 감각과 어긋나면 여기만 조정. */
  var AXIS = {
    heelSign: 1,        // accel heel = heelSign·atan2(gy, gz)
    pitchSign: 1,       // accel pitch = pitchSign·atan2(gx, gz)
    rollGyroAxis: 'gyroX',  pitchGyroAxis: 'gyroY',
    rollGyroSign: 1,    // heel(roll) 각속도 = +GyroX
    pitchGyroSign: -1   // pitch 각속도 = −GyroY
  };

  /* 상보 필터 파라미터 */
  var FILTER = {
    tauSec: 1.5,     // 자이로 신뢰 시정수 τ. 클수록 부드럽지만 지연↑
    gGateSpan: 0.5,  // |gmag−1| 이 이 값 이상이면 accel 신뢰=0 (게이팅)
    maxDtSec: 0.3    // dt 가 이보다 크면(leg 경계) 상태 리셋
  };

  /* GForce(g) → { heel, pitch } (deg) — 정적(가속도계 전용) 변환.
     자이로가 없는 소스(.vkx 이미 각도 보유, 정지 측정 등)용 fallback. */
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

  /* 상보 필터 자세 추정 — 등간격 시계열(원본 IMU 소스)에서 순차 계산해
     각 포인트에 heel/pitch 를 채운다. 자이로가 없으면 accel-only 로
     자동 폴백. 반환: 채운 heel 개수. */
  function complementaryAttitude(points, opts) {
    if (!points || !points.length) return 0;
    var cfg = opts || {};
    var tau = cfg.tauSec != null ? cfg.tauSec : FILTER.tauSec;
    var gate = cfg.gGateSpan != null ? cfg.gGateSpan : FILTER.gGateSpan;
    var maxDt = cfg.maxDtSec != null ? cfg.maxDtSec : FILTER.maxDtSec;

    var heel = null, pitch = null, prevT = null, n = 0;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!p || p.gforceZ == null) { prevT = null; continue; }
      if (p.heel != null && p.pitch != null) {   // 이미 채워진 소스는 존중
        heel = p.heel; pitch = p.pitch;
        prevT = (p.time != null ? p.time / 1000 : null);
        continue;
      }
      var a = gforceToAngles(p.gforceX, p.gforceY, p.gforceZ);
      if (a.heel == null) { prevT = null; continue; }

      var t = (p.time != null) ? p.time / 1000 : null;
      var dt = (prevT != null && t != null) ? (t - prevT) : null;

      var haveGyro = p[AXIS.rollGyroAxis] != null && p[AXIS.pitchGyroAxis] != null;

      if (heel == null || dt == null || !(dt > 0) || dt > maxDt || !haveGyro) {
        /* 초기화 / gap / 자이로 없음 → accel 값으로 리셋(폴백) */
        heel = a.heel; pitch = (a.pitch != null ? a.pitch : pitch);
      } else {
        var rollRate = AXIS.rollGyroSign * p[AXIS.rollGyroAxis];    // deg/s
        var pitchRate = AXIS.pitchGyroSign * p[AXIS.pitchGyroAxis];
        var heelPred = heel + rollRate * dt;
        var pitchPred = pitch + pitchRate * dt;
        /* 선형가속 게이팅 — gmag 가 1g 에서 멀수록 accel 신뢰↓ */
        var gmag = Math.sqrt(p.gforceX * p.gforceX + p.gforceY * p.gforceY +
                             p.gforceZ * p.gforceZ);
        var trust = 1 - Math.abs(gmag - 1) / gate;
        if (trust < 0) trust = 0; else if (trust > 1) trust = 1;
        var alpha = tau / (tau + dt);          // 자이로 가중
        var beta = (1 - alpha) * trust;        // accel 보정 가중(게이팅)
        heel = (1 - beta) * heelPred + beta * a.heel;
        pitch = (a.pitch != null) ? (1 - beta) * pitchPred + beta * a.pitch : pitchPred;
      }
      p.heel = heel; p.pitch = pitch; n++;
      prevT = t;
    }
    return n;
  }

  /* 진입점 — 소스 포인트에 자세(heel/pitch)를 채운다. 자이로가 있으면
     상보 필터, 없으면 정적 accel 변환. session-merger 가 IMU 도너에 대해
     호출한다. 반환: 채운 개수. */
  function computeAttitude(points, opts) {
    if (!points || !points.length) return 0;
    var hasGyro = false;
    for (var i = 0; i < points.length; i++) {
      if (points[i] && points[i][AXIS.rollGyroAxis] != null) { hasGyro = true; break; }
    }
    return hasGyro ? complementaryAttitude(points, opts) : annotate(points);
  }

  /* 정적 accel 전용 채우기 (자이로 없는 소스). 반환: 채운 개수. */
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
