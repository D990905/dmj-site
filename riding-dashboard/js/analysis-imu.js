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
      /* ⚠ RaceBox Bike Mode 의 LeanAngle 은 '보드 힐' 이 아니다.
         오토바이용 코너링 기울기라 직진 중에는 0 에 가깝다.
         실측 검증(2026-08-30): |LeanAngle| vs |yaw rate| 상관 r=0.378,
         선회 중 중앙 3.5°/직진 중 2.3°. 같은 장비의 일반 모드 세션은
         힐이 ±30~44° 로 나온다. 그러므로 힐로 쓰지 않는다.
         힐은 GForceY 가 있어야 나온다 → Bike Mode 를 끄고 내보내야 한다. */
      if (p.gforceZ == null) continue;
      var a = gforceToAngles(p.gforceX, p.gforceY, p.gforceZ);
      if (p.heel == null && a.heel != null) { p.heel = a.heel; n++; }
      if (p.pitch == null && a.pitch != null) p.pitch = a.pitch;
    }
    return n;
  }

  /* ---------- 장착 자세 보정 (§444) ----------
     센서를 붙이는 면·각도가 세션마다 달라지면 atan2 로 얻은 각도는
     '기기 장착 자세 + 보드 자세' 다. 절대값이 세션 간 비교 불가가 된다.

     0점 기준 = 보드가 물 위에 평평히 떠 있는 순간. 라이더가 떨어져
     보드만 떠 있을 때가 그렇다. 그 구간을 저속 지속구간으로 찾는다.
     파도로 흔들리므로 자이로가 조용할 필요는 없다 — 중앙값이 흔들림을
     걸러낸다.

     구간이 여럿이면 서로 비교한다. 값이 크게 갈리면 기기가 세션 도중
     움직인 것이다(실측 2026-08-30 13:15: 한 구간 힐 +8.1°, 다른 구간
     +73.9° — 센서가 보드에서 떨어져 가슴에 있었다). 그때는 보정하지
     않고 자세를 통째로 버린다. 그럴듯한 거짓값이 없는 값보다 나쁘다. */
  var REST_MAX_KT = 3;          /* 이 속도 미만을 '떠 있음' 후보로 */
  var REST_MIN_SEC = 8;         /* 이만큼 지속돼야 구간으로 인정 */
  var MAX_WINDOW_SPREAD_DEG = 25;  /* 구간 간 편차가 이보다 크면 기기가 움직인 것 */
  var KT = 1.94384;

  function median(arr) {
    if (!arr || !arr.length) return null;
    var v = arr.slice().sort(function (a, b) { return a - b; });
    return v[v.length >> 1];
  }
  function spread(arr) {
    if (!arr || arr.length < 2) return 0;
    return Math.max.apply(null, arr) - Math.min.apply(null, arr);
  }

  /* 추락 후 '보드만 떠 있는' 구간 — 가장 신뢰할 수 있는 0점.
     옥대표 설명 + 실측(2026-08-30 12:32, 03:59:34)으로 확인한 신호:
       고속 주행 → 물에 빠짐 → 보드가 뒤집히며 요동 → 평평하게 안정
       → 라이더가 올라타며 다시 기울어짐 → 재가속
     추락 직후 몇 초는 보드가 뒤집혀 있어(힐 −60°) 그대로 쓰면 0점이
     완전히 틀린다. SETTLE_SEC 만큼 건너뛴 뒤 SAMPLE_SEC 만 본다.
     실측: 0~5초 힐 −60~−17°, 6초부터 +3°/+1°/+2° 로 안정. */
  var FALL_FROM_KT = 10;    /* 이 속도 이상에서 */
  var FALL_TO_KT = 4;       /* 이 아래로 떨어지면 추락 */
  var FALL_WITHIN_SEC = 5;  /* 이 시간 안에 */
  var SETTLE_SEC = 6;       /* 보드가 평평해질 때까지 버리는 시간 */
  var SAMPLE_SEC = 8;       /* 그 뒤 이만큼을 0점 표본으로 */

  function fallWindows(points, hz) {
    var out = [];
    var lim = Math.round(hz * FALL_WITHIN_SEC);
    var skip = Math.round(hz * SETTLE_SEC);
    var take = Math.round(hz * SAMPLE_SEC);
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!p || p.speed == null || p.speed * KT < FALL_FROM_KT) continue;
      var j = i, end = Math.min(points.length, i + lim);
      while (j < end && points[j].speed * KT >= FALL_TO_KT) j++;
      if (j >= end) continue;                    /* 충분히 안 떨어짐 */
      var a = j + skip, b = Math.min(points.length, a + take);
      if (b - a < Math.round(hz * 3)) { i = j; continue; }
      var seg = [];
      for (var k = a; k < b; k++) {
        var q = points[k];
        /* 표본 도중 다시 빨라지면(올라타서 출발) 거기서 끊는다 */
        if (!q || q.speed == null || q.speed * KT > FALL_TO_KT + 2) break;
        if (q.heel != null) seg.push(q);
      }
      if (seg.length >= Math.round(hz * 3)) out.push(seg);
      i = b;
    }
    return out;
  }

  /* 저속 지속구간(=보드가 떠 있는 구간) 목록 */
  function restWindows(points) {
    if (!points || points.length < 2) return [];
    var span = (points[points.length - 1].time - points[0].time) / 1000;
    var hz = span > 0 ? points.length / span : 1;
    var minLen = Math.max(10, Math.round(hz * REST_MIN_SEC));
    var out = [], cur = [];
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var slow = p && p.speed != null && p.speed * KT < REST_MAX_KT && p.heel != null;
      if (slow) cur.push(p);
      else { if (cur.length >= minLen) out.push(cur); cur = []; }
    }
    if (cur.length >= minLen) out.push(cur);
    return out;
  }

  /* 반환: { ok, heelOffset, pitchOffset, windows, used, dropped, reason } */
  /* 구간이 서로 안 맞는다고 세션을 통째로 버리면 안 된다. 보드는 실제로
     뒤집힌 채 뜨기도 한다(실측 2026-07-05: 구간3 힐 +95.4° 피치 -163.0°
     = 완전히 전복). 그런 구간만 버리고 나머지로 0점을 잡는다.
     중앙값에서 OUTLIER_DEG 넘게 떨어진 구간을 이상치로 본다. */
  var OUTLIER_DEG = 30;

  function calibration(points) {
    var span = points && points.length > 1
      ? (points[points.length - 1].time - points[0].time) / 1000 : 0;
    var hz = span > 0 ? points.length / span : 1;
    /* 추락 구간이 있으면 그것만 쓴다 — 보드만 떠 있는 상태가 보장된다.
       없으면 일반 저속 구간으로 물러선다(해변 대기 등이 섞일 수 있다). */
    var wins = fallWindows(points, hz);
    var basis = 'fall';
    if (!wins.length) { wins = restWindows(points); basis = 'low-speed'; }
    if (!wins.length) {
      return { ok: false, reason: 'no-rest-window', windows: 0, used: 0,
               heelOffset: 0, pitchOffset: 0 };
    }
    var cands = [];
    wins.forEach(function (w) {
      var h = median(w.map(function (x) { return x.heel; })
                      .filter(function (x) { return x != null && isFinite(x); }));
      var pt = median(w.map(function (x) { return x.pitch; })
                       .filter(function (x) { return x != null && isFinite(x); }));
      if (h != null && pt != null) cands.push({ heel: h, pitch: pt });
    });
    if (!cands.length) {
      return { ok: false, reason: 'no-rest-window', windows: wins.length, used: 0,
               heelOffset: 0, pitchOffset: 0 };
    }
    /* 피치 중앙값을 기준으로 이상치 구간을 걸러낸다 — 피치가 힐보다
       안정적이다(실측: 정상 세션 구간 간 편차 피치 3.7~6.5°, 힐 8.6~15.1°). */
    var pMed0 = median(cands.map(function (c) { return c.pitch; }));
    var kept = cands.filter(function (c) { return Math.abs(c.pitch - pMed0) <= OUTLIER_DEG; });
    if (!kept.length) kept = cands;
    return {
      ok: true, reason: 'ok', basis: basis,
      windows: wins.length, used: kept.length, dropped: cands.length - kept.length,
      heelOffset: median(kept.map(function (c) { return c.heel; })) || 0,
      pitchOffset: median(kept.map(function (c) { return c.pitch; })) || 0,
      heelSpread: spread(kept.map(function (c) { return c.heel; })),
      pitchSpread: spread(kept.map(function (c) { return c.pitch; }))
    };
  }

  /* 보정 결과가 물리적으로 말이 되는지 확인한다. 0점 구간이 하나뿐이면
     구간 간 비교를 못 하므로(실측 13:15) 결과 쪽에서 한 번 더 거른다.
     주행 중 피치 중앙값이 이 범위를 넘으면 보드가 하늘이나 물속을 보고
     있다는 뜻이라 측정이 잘못된 것이다. */
  var MAX_RIDING_PITCH_DEG = 20;
  var MIN_RIDING_KT = 10;

  function sanityCheck(points) {
    var v = [];
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p && p.pitch != null && isFinite(p.pitch) &&
          p.speed != null && p.speed * KT > MIN_RIDING_KT) v.push(p.pitch);
    }
    if (v.length < 50) return { ok: true, ridingPitchMedian: null };
    var m = median(v);
    return { ok: Math.abs(m) <= MAX_RIDING_PITCH_DEG, ridingPitchMedian: m };
  }

  /* 0점을 빼서 '보드가 평평할 때 = 0°' 로 만든다. 원본은 *Raw 로 남긴다. */
  function calibrateAttitude(points) {
    var cal = calibration(points);
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!p) continue;
      if (!cal.ok) {
        if (p.heel != null) { p.heelRaw = p.heel; p.heel = null; }
        if (p.pitch != null) { p.pitchRaw = p.pitch; p.pitch = null; }
        continue;
      }
      if (p.heel != null && isFinite(p.heel)) {
        if (p.heelRaw == null) p.heelRaw = p.heel;
        p.heel = p.heel - cal.heelOffset;
      }
      if (p.pitch != null && isFinite(p.pitch)) {
        if (p.pitchRaw == null) p.pitchRaw = p.pitch;
        p.pitch = p.pitch - cal.pitchOffset;
      }
    }
    if (cal.ok) {
      var sane = sanityCheck(points);
      cal.ridingPitchMedian = sane.ridingPitchMedian;
      if (!sane.ok) {
        cal.ok = false;
        cal.reason = 'implausible-after-calibration';
        for (var m2 = 0; m2 < points.length; m2++) {
          var r = points[m2];
          if (!r) continue;
          if (r.heel != null) { if (r.heelRaw == null) r.heelRaw = r.heel; r.heel = null; }
          if (r.pitch != null) { if (r.pitchRaw == null) r.pitchRaw = r.pitch; r.pitch = null; }
        }
      }
    }
    return cal;
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
    FILTER: FILTER,
    gforceToAngles: gforceToAngles,
    complementaryAttitude: complementaryAttitude,
    computeAttitude: computeAttitude,
    annotate: annotate,
    medianSmooth: medianSmooth,
    restWindows: restWindows,
    fallWindows: fallWindows,
    sanityCheck: sanityCheck,
    calibration: calibration,
    calibrateAttitude: calibrateAttitude,
    heelHistogram: heelHistogram,
    stats: stats
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Imu;
  else global.RDImu = Imu;
})(typeof window !== 'undefined' ? window : globalThis);
