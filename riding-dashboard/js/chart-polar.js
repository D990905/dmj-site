/* ============================================================
 * chart-polar.js — §440 풍각-속도 폴라 다이어그램
 *
 * 왜 폴라인가: 각도가 실제 풍각(TWA)에, 반경이 속도에 그대로 대응한다.
 *   어느 포인트 오브 세일에서 빠르고 느린지가 좌표 그 자체로 읽힌다.
 *   막대나 표로는 "45도에서 느리다" 를 볼 수 없다.
 *
 * 관례대로 좌현(port)은 왼쪽, 우현(starboard)은 오른쪽에 미러링한다.
 * 위쪽이 풍상(TWA 0°), 아래쪽이 풍하(180°).
 *
 * uPlot 은 직교 좌표 전용이라 이 차트만 캔버스로 직접 그린다.
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  function ringsFor(maxKt) {
    var step = maxKt > 24 ? 10 : (maxKt > 12 ? 5 : 2);
    var out = [];
    for (var v = step; v <= maxKt + 0.001; v += step) out.push(v);
    return out;
  }

  /* bins: [{twaCenter, count, p95Ms, avgMs}] — count 0 은 건너뛴다 */
  function toPoints(bins, side, metric) {
    if (!bins) return [];
    var out = [];
    bins.forEach(function (b) {
      if (!b || !b.count) return;
      var ms = metric === 'avg' ? b.avgMs : b.p95Ms;
      if (!(ms > 0)) return;
      out.push({ twa: b.twaCenter, kt: ms * KT, side: side, count: b.count });
    });
    return out.sort(function (a, b) { return a.twa - b.twa; });
  }

  function maxKtOf(sets) {
    var m = 0;
    sets.forEach(function (s) { s.forEach(function (p) { if (p.kt > m) m = p.kt; }); });
    return Math.max(m, 1);
  }

  function render(host, polar, opts) {
    opts = opts || {};
    if (!host) return null;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!polar) { host.textContent = 'Wind direction required'; return null; }

    var metric = opts.metric === 'avg' ? 'avg' : 'p95';
    var port = toPoints(polar.port, 'P', metric);
    var stbd = toPoints(polar.starboard, 'S', metric);
    if (!port.length && !stbd.length) { host.textContent = 'Not enough sailing data'; return null; }

    var maxKt = Math.ceil(maxKtOf([port, stbd]) * 1.08);
    var rings = ringsFor(maxKt);

    var size = Math.max(280, Math.min(opts.size || host.clientWidth || 420, 520));
    var dpr = global.devicePixelRatio || 1;
    var cv = document.createElement('canvas');
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    var cx = size / 2, cy = size * 0.52, R = size * 0.42;
    var GRID = opts.grid || '#2b3648', DIM = opts.dim || '#8a97a8';
    var PORT = opts.port || '#e03131', STBD = opts.starboard || '#2f9e44';

    /* TWA(도) + 좌우 → 화면 좌표. 위쪽이 풍상. */
    function pos(twa, kt, side) {
      var r = (kt / maxKt) * R;
      var rad = (twa * Math.PI) / 180;
      var dx = Math.sin(rad) * r * (side === 'P' ? -1 : 1);
      var dy = -Math.cos(rad) * r;
      return [cx + dx, cy + dy];
    }

    /* 반경 눈금 */
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    rings.forEach(function (v) {
      ctx.beginPath(); ctx.arc(cx, cy, (v / maxKt) * R, 0, Math.PI * 2); ctx.stroke();
    });
    /* 각도 눈금 30° 간격 */
    ctx.beginPath();
    for (var a = 0; a <= 180; a += 30) {
      [ -1, 1 ].forEach(function (sgn) {
        var rad = (a * Math.PI) / 180;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(rad) * R * sgn, cy - Math.cos(rad) * R);
      });
    }
    ctx.stroke();

    /* 라벨 */
    ctx.fillStyle = DIM;
    ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    rings.forEach(function (v) {
      ctx.fillText(v + ' kt', cx + 2, cy - (v / maxKt) * R - 8);
    });
    ctx.fillText('0° upwind', cx, cy - R - 16);
    ctx.fillText('180° downwind', cx, cy + R + 18);
    ctx.textAlign = 'right'; ctx.fillText('port', cx - R - 6, cy);
    ctx.textAlign = 'left';  ctx.fillText('stbd', cx + R + 6, cy);

    /* 곡선 */
    function drawSide(pts, color) {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var xy = pos(p.twa, p.kt, p.side);
        if (i === 0) ctx.moveTo(xy[0], xy[1]); else ctx.lineTo(xy[0], xy[1]);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fillStyle = color;
      pts.forEach(function (p) {
        var xy = pos(p.twa, p.kt, p.side);
        ctx.beginPath(); ctx.arc(xy[0], xy[1], 2.6, 0, Math.PI * 2); ctx.fill();
      });
    }
    drawSide(port, PORT);
    drawSide(stbd, STBD);

    return { canvas: cv, maxKt: maxKt, port: port, starboard: stbd, metric: metric };
  }

  var API = { render: render, _test: { toPoints: toPoints, ringsFor: ringsFor, maxKtOf: maxKtOf } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDPolar = API;
})(typeof window !== 'undefined' ? window : globalThis);
