/* ============================================================
 * correlation.js — 두 지표의 관계 보기 (§478)
 *
 * "각을 좁히면 속도가 얼마나 죽나", "심박이 오르면 실제로 빨라지나" —
 * 이런 질문은 표로는 안 나오고 산점도로 나온다.
 *
 * 다만 상관은 사람을 잘 속인다. 그래서 이 모듈은 세 가지를 강제한다:
 *
 *  1) **점 = 표본이 아니라 창(window)이다.** 1Hz 표본을 그대로 쓰면
 *     n=7000 이 되고 r 의 신뢰구간이 터무니없이 좁아진다. 이웃한
 *     표본은 서로 독립이 아니다(자기상관). 20초 창으로 묶어 그 창의
 *     평균을 한 점으로 쓴다.
 *  2) **r 과 함께 n 과 기울기를 낸다.** r 만 크게 써 놓으면 세기와
 *     크기를 혼동한다. 기울기(y단위/x단위)가 실제로 얼마나 움직이는지다.
 *  3) **시간 교란을 표시한다.** 세션 후반에 바람이 죽으면 속도와 심박이
 *     함께 떨어져 강한 상관이 생기지만 인과는 없다. 그래서 창의 시각을
 *     함께 실어, 시간과의 상관(rWithTime)을 같이 보고한다 — 둘 다 높으면
 *     그 상관은 시간이 만든 것일 수 있다.
 *
 * 브라우저: RDCorrelation  ·  Node: require('./correlation')
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  var FIELDS = [
    { key: 'speed', label: 'Speed', unit: 'kt',
      of: function (p) { return p.speed == null ? null : p.speed * KT; } },
    { key: 'vmg', label: 'VMG', unit: 'kt',
      of: function (p) { return p.vmg == null ? null : Math.abs(p.vmg) * KT; } },
    { key: 'twa', label: 'CWA', unit: '°',
      of: function (p) { return p.twa == null ? null : p.twa; } },
    { key: 'hr', label: 'Heart rate', unit: 'bpm',
      of: function (p) { return (p.hr == null || p.hr <= 0) ? null : p.hr; } }
  ];

  function fieldByKey(k) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === k) return FIELDS[i];
    return null;
  }

  /* 세션을 창으로 자른다. 창 하나 = 점 하나.
     한 존(풍상/풍하)에 머문 창만 남긴다 — 존을 넘나든 창의 평균 CWA 는
     아무 각도도 아니다. */
  function windows(session, opts) {
    opts = opts || {};
    var winSec = opts.windowSec || 20;
    var minKt = opts.minSpeedKt != null ? opts.minSpeedKt : 8;
    var S = (session && session.samples) || [];
    if (S.length < 2) return [];
    var gapSec = (session.cfg && session.cfg.gapThresholdSec) || 8;
    var t0 = S[0].t;
    var legs = (session.legs && session.legs.length)
      ? session.legs : [{ start: 0, end: S.length - 1 }];
    var out = [];

    legs.forEach(function (leg) {
      var cur = null;
      function close() {
        if (cur && cur.dt >= winSec * 0.8 && cur.n >= 5) {
          var w = { tSec: cur.tSum / cur.dt - t0, seconds: cur.dt, zone: cur.zone };
          FIELDS.forEach(function (f) {
            w[f.key] = cur.n_[f.key] > 0 ? cur.sum[f.key] / cur.n_[f.key] : null;
          });
          out.push(w);
        }
        cur = null;
      }
      for (var i = leg.start + 1; i <= leg.end; i++) {
        var p = S[i], dt = p.t - S[i - 1].t;
        if (!(dt > 0) || dt > gapSec) { close(); continue; }
        if (minKt && (p.speed == null || p.speed * KT < minKt)) { close(); continue; }
        var zone = p.twa == null ? 'any' : (p.twa < 90 ? 'up' : 'down');
        if (cur && (cur.zone !== zone || cur.dt >= winSec)) close();
        if (!cur) {
          cur = { zone: zone, dt: 0, n: 0, tSum: 0, sum: {}, n_: {} };
          FIELDS.forEach(function (f) { cur.sum[f.key] = 0; cur.n_[f.key] = 0; });
        }
        cur.dt += dt; cur.n++; cur.tSum += p.t * dt;
        FIELDS.forEach(function (f) {
          var v = f.of(p);
          if (v != null && isFinite(v)) { cur.sum[f.key] += v * dt; cur.n_[f.key] += dt; }
        });
      }
      close();
    });
    return out;
  }

  /* 피어슨 r + 최소제곱 기울기. 둘 다 없으면 null. */
  function pearson(xs, ys) {
    var n = 0, sx = 0, sy = 0;
    for (var i = 0; i < xs.length; i++) {
      if (xs[i] == null || ys[i] == null) continue;
      n++; sx += xs[i]; sy += ys[i];
    }
    if (n < 3) return null;
    var mx = sx / n, my = sy / n, sxy = 0, sxx = 0, syy = 0;
    for (var j = 0; j < xs.length; j++) {
      if (xs[j] == null || ys[j] == null) continue;
      var dx = xs[j] - mx, dy = ys[j] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx <= 0 || syy <= 0) return null;
    return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx,
             intercept: my - (sxy / sxx) * mx, n: n, meanX: mx, meanY: my };
  }

  /* 대수적으로 이미 묶여 있는 짝 — VMG = 속도 × cos(CWA) 다. 이 셋
     사이의 상관은 물 위에서 배운 게 아니라 정의에서 나온다. 그래도
     보여주는 이유는 기울기(각 1도가 VMG 몇 kt인가)가 쓸모 있기 때문이고,
     r 을 발견처럼 읽지 않도록 표시만 붙인다. */
  var IDENTITY_PAIRS = { 'twa vmg': 1, 'vmg twa': 1, 'speed vmg': 1, 'vmg speed': 1 };
  function isIdentityPair(a, b) { return !!IDENTITY_PAIRS[a + ' ' + b]; }

  /* opts: { xKey, yKey, zone: 'all'|'up'|'down', windowSec, minSpeedKt } */
  function analyze(session, opts) {
    opts = opts || {};
    var fx = fieldByKey(opts.xKey || 'twa'), fy = fieldByKey(opts.yKey || 'speed');
    if (!fx || !fy) return null;
    var all = opts.windows || windows(session, opts);
    var zone = opts.zone || 'all';
    var W = all.filter(function (w) {
      if (zone !== 'all' && w.zone !== zone) return false;
      return w[fx.key] != null && w[fy.key] != null;
    });
    if (W.length < 5) {
      return { x: fx, y: fy, zone: zone, points: W, n: W.length, fit: null,
               reason: 'too-few-windows' };
    }
    var xs = W.map(function (w) { return w[fx.key]; });
    var ys = W.map(function (w) { return w[fy.key]; });
    var ts = W.map(function (w) { return w.tSec; });
    var fit = pearson(xs, ys);
    var xt = pearson(ts, xs), yt = pearson(ts, ys);
    /* 시간 교란 경고 — x 와 y 가 둘 다 시간과 강하게 움직이면, 둘 사이의
       상관은 시간이 만든 것일 수 있다. 판정이 아니라 경고다. */
    var timeConfounded = !!(fit && xt && yt &&
      Math.abs(xt.r) > 0.4 && Math.abs(yt.r) > 0.4 &&
      Math.abs(fit.r) > 0.3);
    return {
      x: fx, y: fy, zone: zone, points: W, n: W.length,
      fit: fit, xVsTime: xt, yVsTime: yt, timeConfounded: timeConfounded,
      identity: isIdentityPair(fx.key, fy.key),
      windowSec: opts.windowSec || 20
    };
  }

  /* r 을 말로. 숫자만 두면 0.31 을 "관계 있음" 으로 읽는다. */
  function describe(res) {
    if (!res || !res.fit) return 'Not enough windows to say anything.';
    var a = Math.abs(res.fit.r), s;
    if (a < 0.2) s = 'essentially no relationship';
    else if (a < 0.4) s = 'a weak relationship';
    else if (a < 0.6) s = 'a moderate relationship';
    else if (a < 0.8) s = 'a strong relationship';
    else s = 'a very strong relationship';
    var dir = res.fit.r >= 0 ? 'rises' : 'falls';
    return 'r = ' + res.fit.r.toFixed(2) + ' over ' + res.n + ' windows — ' + s
      + '. ' + res.y.label + ' ' + dir + ' about '
      + Math.abs(res.fit.slope).toFixed(2) + ' ' + res.y.unit
      + ' per ' + res.x.unit + ' of ' + res.x.label + '.';
  }

  var API = { FIELDS: FIELDS, fieldByKey: fieldByKey, windows: windows,
              pearson: pearson, analyze: analyze, describe: describe,
              isIdentityPair: isIdentityPair };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDCorrelation = API;
})(typeof window !== 'undefined' ? window : globalThis);
