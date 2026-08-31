/* ============================================================
 * chart-meanmax.js — §438 Mean-max 속도 지속시간 곡선 (uPlot)
 *
 * 왜: 대시보드는 이미 2s·10s·100m·250m·500m·1NM 최고속을 전부 계산해
 *   두고, 그걸 숫자 7개가 한 줄로 늘어선 형태로 보여준다. 거리를 속도로
 *   나누면 지속시간이 되고, 로그 축에 얹으면 하나의 하강 곡선이 된다 —
 *   스포츠 과학이 수십 년 써온 mean-max 곡선이다. 같은 숫자, 다른 형태.
 *   스프린터형인지 속도를 오래 유지하는 형인지가 그제서야 보인다.
 *
 * Alpha 는 곡선에 넣지 않는다. 게이트가 있는 코스라 자유 주행이 아니다.
 *
 * 차트 엔진 = uPlot 1.6.32 (MIT, 의존성 0, vendor/ 에 동봉).
 * 우리 캔버스 렌더러를 대체하지 않는다 — 이 차트에만 쓴다.
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  /* 거리 베스트를 지속시간으로 환산해 시간 피크와 하나의 계열로 합친다.
     반환은 지속시간 오름차순. speedMs 가 없거나 0 이면 버린다. */
  function toDurationSeries(analysis) {
    var pts = [];
    var peaks = (analysis && analysis.peaks) || [];
    peaks.forEach(function (p) {
      if (p && p.speedMs > 0 && p.windowSec > 0) {
        pts.push({ sec: p.windowSec, kt: p.speedMs * KT,
                   label: p.windowSec + ' s', kind: 'time' });
      }
    });
    var dbs = (analysis && analysis.distanceBests) || [];
    dbs.forEach(function (d) {
      if (d && d.speedMs > 0 && d.distanceM > 0) {
        var sec = d.distanceM / d.speedMs;
        if (!isFinite(sec) || sec <= 0) return;
        pts.push({ sec: sec, kt: d.speedMs * KT, kind: 'dist',
                   label: d.distanceM === 1852 ? '1 NM' : d.distanceM + ' m' });
      }
    });
    pts.sort(function (a, b) { return a.sec - b.sec; });
    return pts;
  }

  /* 게이트 코스라 곡선과 성격이 다르다 — 별도 마커로 돌려준다. */
  function alphaPoint(analysis) {
    var a = analysis && analysis.alpha;
    if (!a || !(a.speedMs > 0) || !(a.distanceM > 0)) return null;
    var sec = a.distanceM / a.speedMs;
    if (!isFinite(sec) || sec <= 0) return null;
    return { sec: sec, kt: a.speedMs * KT, label: 'Alpha ' + a.distanceM };
  }

  /* y 축은 데이터 범위에 맞춘다. 0 부터 그리면 하강이 평평해져
     곡선의 모양 — 이 차트의 존재 이유 — 이 사라진다. */
  function yRange(pts, alpha) {
    var vals = pts.map(function (p) { return p.kt; });
    if (alpha) vals.push(alpha.kt);
    if (!vals.length) return [0, 1];
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = Math.max((hi - lo) * 0.18, 0.5);
    return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];
  }

  function render(hostEl, analysis, opts) {
    opts = opts || {};
    if (!hostEl || !global.uPlot) return null;
    var pts = toDurationSeries(analysis);
    if (pts.length < 2) { hostEl.textContent = ''; return null; }
    var alpha = alphaPoint(analysis);
    var yr = yRange(pts, alpha);

    var xs = pts.map(function (p) { return p.sec; });
    var ys = pts.map(function (p) { return p.kt; });

    while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
    var w = hostEl.clientWidth || 640;

    var u = new global.uPlot({
      width: w, height: opts.height || 260,
      padding: [12, 14, 4, 6],
      cursor: { drag: { x: false, y: false }, points: { size: 9 } },
      scales: {
        /* distr 3 = log10. 범위를 명시하지 않으면 uPlot 이 1 미만까지
           패딩해 눈금이 0.1·0.2… 로 생기고 전부 "0s" 로 찍힌다. */
        x: { distr: 3, time: false,
             range: function () { return [xs[0] * 0.8, xs[xs.length - 1] * 1.25]; } },
        y: { range: function () { return yr; } }
      },
      axes: [
        { stroke: opts.dim || '#5F778A', grid: { stroke: opts.grid || '#16283A', width: 1 },
          ticks: { stroke: opts.grid || '#16283A' },
          font: '11px "IBM Plex Mono", monospace',
          /* 눈금을 uPlot 자동 생성에 맡기지 않고 사람이 읽는 값으로 고정한다.
             로그축 자동 눈금은 5.7s·13.2s 같은 값을 만들어 읽히지 않는다. */
          splits: function () {
            var lo = xs[0] * 0.8, hi = xs[xs.length - 1] * 1.25;
            return [2, 5, 10, 30, 60, 120, 300, 600, 1800]
              .filter(function (t) { return t >= lo && t <= hi; });
          },
          /* 로그 축의 uPlot 기본 filter 는 10의 거듭제곱이 아닌 눈금을
             null 로 지워버린다. 우리는 splits 를 사람이 읽는 값으로
             직접 정했으므로 그 필터를 무력화한다 — 그러지 않으면
             지워진 자리에 'null s' 가 찍힌다. */
          filter: function (self, splits) { return splits; },
          values: function (self, ticks) {
            return ticks.map(function (t) {
              if (t == null || !isFinite(t)) return null;
              if (t < 60) return t + ' s';
              if (t < 3600) return (t / 60) + ' min';
              return (t / 3600) + ' h';
            });
          } },
        { stroke: opts.dim || '#5F778A', grid: { stroke: opts.grid || '#16283A', width: 1 },
          ticks: { stroke: opts.grid || '#16283A' },
          font: '11px "IBM Plex Mono", monospace',
          size: 42,
          values: function (self, ticks) { return ticks.map(function (v) { return v.toFixed(0); }); } }
      ],
      series: [
        { label: 'Duration',
          value: function (self, v) {
            if (v == null) return '—';
            return v < 60 ? v.toFixed(1) + ' s' : (v / 60).toFixed(1) + ' min';
          } },
        { label: 'Best speed', stroke: opts.accent || '#1F8FFF', width: 2.4,
          fill: opts.fill || 'rgba(31,143,255,0.16)',
          points: { show: true, size: 8, stroke: opts.accent || '#1F8FFF',
                    fill: opts.bg || '#08131E', width: 2 },
          value: function (self, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } }
      ],
      hooks: {
        draw: [function (self) {
          if (!alpha) return;
          var cx = self.valToPos(alpha.sec, 'x', true);
          var cy = self.valToPos(alpha.kt, 'y', true);
          var ctx = self.ctx;
          ctx.save();
          ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = opts.warn || '#FFB800';
          ctx.fillRect(-5, -5, 10, 10);
          ctx.restore();
        }]
      }
    }, [xs, ys], hostEl);

    return { plot: u, points: pts, alpha: alpha, yRange: yr };
  }

  var API = { render: render,
    _test: { toDurationSeries: toDurationSeries, alphaPoint: alphaPoint, yRange: yRange } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDMeanMax = API;
})(typeof window !== 'undefined' ? window : globalThis);
