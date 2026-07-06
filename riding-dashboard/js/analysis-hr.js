/* ============================================================
 * analysis-hr.js — HR(심박)–effort 분석 (§430)
 *
 * 융합 세션에서 심박과 속도의 관계를 본다. 대시보드의 존/추이
 * 계산(analysis.js analyzeHr)과 별개로, §430 이 요구한 두 가지를
 * 순수 함수로 제공한다:
 *   1) HR–속도 상관 (Pearson r, 선택적 지연 lag)
 *   2) HR effort zone 시간 (Z1~Z5, %maxHr 경계)
 *
 * 어느 소스든 p.hr(bpm) 과 s.speed(m/s) 를 가진 샘플 배열이면 동작한다.
 * HR 이 없으면 { hasHR:false } 로 no-op — 에러를 던지지 않는다
 * (Waterspeed 에 HR 이 없거나 GPX-only 세션 대비).
 *
 * 브라우저: RDHr.*  ·  Node: require('./analysis-hr')
 * ============================================================ */
(function (global) {
  'use strict';

  /* Zone 경계 — %maxHr (표준 5-zone: Z1<60, Z2 60–70, Z3 70–80,
     Z4 80–90, Z5 ≥90). analysis.js 의 존과 정합. */
  var ZONE_PCT = [0.60, 0.70, 0.80, 0.90];

  /* Pearson 상관계수 — 결측 skip. n<3 이면 null. */
  function pearson(xs, ys) {
    var n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (var i = 0; i < xs.length; i++) {
      var x = xs[i], y = ys[i];
      if (x == null || y == null || !isFinite(x) || !isFinite(y)) continue;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
    if (n < 3) return null;
    var cov = sxy - sx * sy / n;
    var vx = sxx - sx * sx / n, vy = syy - sy * sy / n;
    if (vx <= 0 || vy <= 0) return null;
    return cov / Math.sqrt(vx * vy);
  }

  /* HR–속도 상관.  옵션 lagSec: HR 이 노력(속도)에 지연 반응하는 점을
     보정하려면 양수. 샘플이 대략 등간격(1Hz)이라는 전제로 인덱스 시프트.
     반환: { hasHR, r, n, lagSec } */
  function speedCorrelation(samples, opts) {
    opts = opts || {};
    var lag = opts.lagSec || 0;
    var hrs = [], sps = [];
    for (var i = 0; i < samples.length; i++) {
      if (samples[i] && samples[i].hr != null) { hrs.push(samples[i]); }
    }
    if (hrs.length < 3) return { hasHR: false };

    var xs = [], ys = [];
    for (var k = 0; k < samples.length; k++) {
      var s = samples[k];
      if (!s || s.hr == null || s.speed == null) continue;
      var j = lag ? Math.round(k - lag) : k;   // 속도를 lag 초 앞선 것과 매칭
      if (j < 0 || j >= samples.length) continue;
      var sp = samples[j].speed;
      if (sp == null) continue;
      xs.push(s.hr); ys.push(sp);
    }
    var r = pearson(xs, ys);
    return { hasHR: true, r: r, n: xs.length, lagSec: lag };
  }

  /* HR effort zone 시간(초).  maxHr 없으면 samples 관측 최대 HR 로 추정.
     hasTime 세션은 dt 합산, 아니면 샘플수를 초로 근사(1Hz 리샘플 전제).
     반환: { hasHR, maxHrUsed, zones:[{z,label,loPct,hiPct,sec,pct}], totalSec } */
  function effortZones(samples, maxHr) {
    var haveHr = false, obsMax = 0;
    for (var i = 0; i < samples.length; i++) {
      if (samples[i] && samples[i].hr != null) {
        haveHr = true;
        if (samples[i].hr > obsMax) obsMax = samples[i].hr;
      }
    }
    if (!haveHr) return { hasHR: false };
    var mx = (maxHr && maxHr > 60) ? maxHr : Math.max(obsMax, 100);

    /* 경계 bpm */
    var bounds = ZONE_PCT.map(function (p) { return p * mx; });
    var labels = ['Z1 (회복)', 'Z2 (지구력)', 'Z3 (템포)', 'Z4 (역치)', 'Z5 (최대)'];
    var sec = [0, 0, 0, 0, 0];

    function dtAt(idx) {
      /* 인접 샘플 시간차(초). t 필드(초) 있으면 사용, 없으면 1. */
      if (idx <= 0) return 1;
      var a = samples[idx - 1], b = samples[idx];
      if (a && b && a.t != null && b.t != null) {
        var d = b.t - a.t;
        if (d > 0 && d < 30) return d;   // leg 경계 큰 gap 은 1로
        return 1;
      }
      return 1;
    }

    var total = 0;
    for (var k = 0; k < samples.length; k++) {
      var s = samples[k];
      if (!s || s.hr == null) continue;
      var dt = dtAt(k);
      var z = 0;
      var hr = s.hr;
      if (hr < bounds[0]) z = 0;
      else if (hr < bounds[1]) z = 1;
      else if (hr < bounds[2]) z = 2;
      else if (hr < bounds[3]) z = 3;
      else z = 4;
      sec[z] += dt; total += dt;
    }

    var zones = [];
    for (var zi = 0; zi < 5; zi++) {
      zones.push({
        z: zi + 1, label: labels[zi],
        loPct: zi === 0 ? 0 : ZONE_PCT[zi - 1],
        hiPct: zi < 4 ? ZONE_PCT[zi] : 1,
        sec: sec[zi], pct: total > 0 ? sec[zi] / total : 0
      });
    }
    return { hasHR: true, maxHrUsed: mx, zones: zones, totalSec: total };
  }

  var Hr = {
    ZONE_PCT: ZONE_PCT,
    pearson: pearson,
    speedCorrelation: speedCorrelation,
    effortZones: effortZones
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Hr;
  else global.RDHr = Hr;
})(typeof window !== 'undefined' ? window : globalThis);
