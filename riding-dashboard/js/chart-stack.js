/* ============================================================
 * chart-stack.js — 한 시간축을 공유하는 세로 스택 차트 (§473)
 *
 * Sailnjord 의 line chart 는 지표마다 판을 나누되 x축(시간)을 공유하고,
 * 커서가 모든 판을 함께 지나가며, 드래그로 구간을 잡으면 그 구간의
 * 평균이 즉시 나온다. 그리고 기동(택·자이브)이 세로선으로 찍힌다.
 * 판을 겹치지 않고 쌓는 이유는 명확하다 — **축이 하나여야 읽을 수 있다**.
 * 속도와 심박을 한 판에 두 축으로 겹치면 교차점이 의미를 갖는 것처럼
 * 보이지만 아무 뜻도 없다.
 *
 * 이 모듈은 데이터 준비(순수 함수)와 렌더를 분리한다 — 준비 쪽은
 * Node 에서 그대로 검증할 수 있다.
 *
 * 브라우저: RDChartStack  ·  Node: require('./chart-stack')
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  /* 어떤 판을 그릴지. 표본에 값이 없으면 그 판은 아예 만들지 않는다. */
  var PANELS = [
    { key: 'speed', label: 'Speed', unit: 'kt', color: '#4dabf7',
      fill: 'rgba(77,171,247,0.14)', height: 150,
      get: function (p) { return p.speed == null ? null : p.speed * KT; } },
    { key: 'vmg', label: 'VMG', unit: 'kt', color: '#20c997', zero: true, height: 110,
      get: function (p) { return p.vmg == null ? null : p.vmg * KT; } },
    { key: 'twa', label: 'CWA', unit: '°', color: '#d97706', height: 110,
      get: function (p) { return p.twa == null ? null : p.twa; } },
    { key: 'hr', label: 'Heart rate', unit: 'bpm', color: '#e03131', height: 110,
      get: function (p) { return p.hr == null || p.hr <= 0 ? null : p.hr; } }
  ];

  /* 기록 공백·제외 구간에서 선을 끊는다. 이걸 안 하면 지워버린 10분이
     완만한 사선으로 남아 그 시간에 타고 있었던 것처럼 보인다(§459). */
  function buildSeries(session, opts) {
    opts = opts || {};
    var S = (session && session.samples) || [];
    if (!S.length) return null;
    var maxPts = opts.maxPoints || 1800;
    var step = Math.max(1, Math.floor(S.length / maxPts));
    var t0 = S[0].t;
    var gapSec = (session.cfg && session.cfg.gapThresholdSec) || 8;
    var legEnd = {};
    (session.legs || []).forEach(function (lg) { legEnd[lg.end] = true; });

    var panels = PANELS.filter(function (p) {
      for (var i = 0; i < S.length; i += step) {
        var v = p.get(S[i]);
        if (v != null && isFinite(v)) return true;
      }
      return false;
    });
    if (!panels.length) return null;

    var xs = [], ys = panels.map(function () { return []; });
    var prevT = null, prevIdx = null;
    for (var i = 0; i < S.length; i += step) {
      var tt = S[i].t - t0;
      var broke = false;
      if (prevT != null) {
        if ((tt - prevT) > Math.max(gapSec, step * 2)) broke = true;
        else for (var j = prevIdx; j < i; j++) if (legEnd[j]) { broke = true; break; }
      }
      if (broke) { xs.push(prevT + 0.001); ys.forEach(function (a) { a.push(null); }); }
      xs.push(tt);
      panels.forEach(function (p, k) {
        var v = p.get(S[i]);
        ys[k].push(v != null && isFinite(v) ? v : null);
      });
      prevT = tt; prevIdx = i;
    }
    return { panels: panels, x: xs, y: ys, t0: t0, step: step, durationSec: xs[xs.length - 1] };
  }

  /* 드래그 구간의 즉시 평균. null 은 빼고 세되, **몇 %가 유효했는지**를
     함께 돌려준다 — 절반이 빈 구간의 평균은 평균이라 부르기 어렵다. */
  function rangeStats(series, fromSec, toSec) {
    if (!series) return null;
    var lo = Math.min(fromSec, toSec), hi = Math.max(fromSec, toSec);
    var out = { fromSec: lo, toSec: hi, durationSec: hi - lo, panels: [] };
    var idx = [];
    for (var i = 0; i < series.x.length; i++) {
      if (series.x[i] >= lo && series.x[i] <= hi) idx.push(i);
    }
    out.samples = idx.length;
    series.panels.forEach(function (p, k) {
      var arr = series.y[k], sum = 0, n = 0, mx = null, mn = null;
      idx.forEach(function (i) {
        var v = arr[i];
        if (v == null || !isFinite(v)) return;
        sum += v; n++;
        if (mx == null || v > mx) mx = v;
        if (mn == null || v < mn) mn = v;
      });
      out.panels.push({
        key: p.key, label: p.label, unit: p.unit, color: p.color,
        avg: n ? sum / n : null, max: mx, min: mn,
        n: n, coverage: idx.length ? n / idx.length : 0
      });
    });
    return out;
  }

  /* 구간 안의 기동. 시각화 자체보다 이 수가 중요하다 —
     "이 구간 평균 12kt" 는 그 안에 자이브가 8번 있었는지에 따라 뜻이 다르다. */
  function rangeManeuvers(maneuvers, fromSec, toSec) {
    var lo = Math.min(fromSec, toSec), hi = Math.max(fromSec, toSec);
    var t = 0, g = 0;
    (maneuvers || []).forEach(function (m) {
      if (m.tSec == null || m.tSec < lo || m.tSec > hi) return;
      if (m.type === 'gybe') g++; else t++;
    });
    return { tacks: t, gybes: g, total: t + g };
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- 렌더 (브라우저 전용) ---------- */

  function render(host, session, analysis, opts) {
    opts = opts || {};
    var uPlot = global.uPlot;
    if (!host || !uPlot) return null;
    var series = buildSeries(session, opts);
    if (!series) { host.textContent = 'No data'; return null; }

    var theme = opts.theme || { dim: '#8b98a5', grid: 'rgba(139,152,165,0.14)' };
    var mans = (analysis && analysis.maneuvers) || [];
    var syncKey = uPlot.sync('rd-stack-' + (opts.syncId || 'main'));
    while (host.firstChild) host.removeChild(host.firstChild);

    var readout = null;
    if (opts.readoutHost) {
      readout = opts.readoutHost;
      while (readout.firstChild) readout.removeChild(readout.firstChild);
    }

    /* 기동 마커 — 판마다 같은 x 에 세로 눈금. 색은 택/자이브로 나눈다. */
    function drawManeuvers(u) {
      if (!mans.length) return;
      var ctx = u.ctx;
      ctx.save();
      ctx.lineWidth = 1;
      var top = u.bbox.top, h = u.bbox.height;
      mans.forEach(function (m) {
        if (m.tSec == null) return;
        var x = u.valToPos(m.tSec, 'x', true);
        if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return;
        ctx.strokeStyle = m.type === 'gybe' ? 'rgba(247,103,7,0.45)' : 'rgba(77,171,247,0.45)';
        ctx.beginPath();
        ctx.moveTo(x, top); ctx.lineTo(x, top + h * 0.10);
        ctx.moveTo(x, top + h * 0.90); ctx.lineTo(x, top + h);
        ctx.stroke();
      });
      ctx.restore();
    }

    var plots = [];
    var width = host.clientWidth || opts.width || 900;

    series.panels.forEach(function (p, k) {
      var wrap = document.createElement('div');
      wrap.className = 'rd-stack-panel';
      host.appendChild(wrap);
      var last = k === series.panels.length - 1;
      var scaleOpts = {};
      if (p.zero) scaleOpts.range = function (u, min, max) {
        var m = Math.max(Math.abs(min), Math.abs(max), 1);
        return [-m, m];
      };
      var u = new uPlot({
        width: width, height: p.height, padding: [8, 14, last ? 4 : 0, 6],
        /* setScale:false — 드래그는 **선택**이지 확대가 아니다. 기본값
           그대로 두면 구간을 잡는 순간 축이 그 구간으로 줌인돼, 방금
           고른 게 전체 중 어디였는지 보이지 않게 된다. */
        cursor: { drag: { x: true, y: false, setScale: false },
                  sync: { key: syncKey.key } },
        legend: { show: false },
        scales: { x: { time: false }, y: scaleOpts },
        axes: [
          { stroke: theme.dim, grid: { stroke: theme.grid }, ticks: { stroke: theme.grid },
            font: '11px "IBM Plex Mono", monospace',
            show: last, size: last ? 30 : 0,
            values: function (uu, t) { return t.map(function (v) { return fmtClock(v); }); } },
          { stroke: theme.dim, grid: { stroke: theme.grid }, ticks: { stroke: theme.grid },
            font: '11px "IBM Plex Mono", monospace', size: 46,
            values: function (uu, t) {
              return t.map(function (v) { return v.toFixed(v % 1 ? 1 : 0); });
            } }
        ],
        series: [
          { label: 'Elapsed' },
          { label: p.label, stroke: p.color, width: 1.4, spanGaps: false,
            fill: p.fill || null }
        ],
        hooks: {
          draw: [drawManeuvers],
          setSelect: [function (uu) {
            if (!uu.select || uu.select.width < 4) return;
            var a = uu.posToVal(uu.select.left, 'x');
            var b = uu.posToVal(uu.select.left + uu.select.width, 'x');
            showSelection(a, b);
          }]
        }
      }, [series.x, series.y[k]], wrap);
      /* 판 이름표 — 축 라벨을 판마다 반복하지 않고 왼쪽 위에 한 줄. */
      var tag = document.createElement('div');
      tag.className = 'rd-stack-tag';
      tag.style.cssText = 'position:absolute;top:4px;left:52px;font:11px "IBM Plex Mono",monospace;' +
        'color:' + p.color + ';pointer-events:none;letter-spacing:.04em';
      tag.textContent = p.label + ' (' + p.unit + ')';
      wrap.style.position = 'relative';
      wrap.appendChild(tag);
      plots.push(u);
      syncKey.sub(u);
    });

    var selection = null;
    function clearSelection() {
      selection = null;
      plots.forEach(function (u) {
        u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
      });
      if (readout) while (readout.firstChild) readout.removeChild(readout.firstChild);
      if (opts.onSelect) opts.onSelect(null);
    }

    function showSelection(a, b) {
      var st = rangeStats(series, a, b);
      st.maneuvers = rangeManeuvers(mans, a, b);
      selection = st;
      /* 모든 판에 같은 구간을 칠한다 — 한 판만 칠하면 어디를 보고 있는지
         잃어버린다. */
      plots.forEach(function (u) {
        var l = u.valToPos(st.fromSec, 'x', false);
        var r = u.valToPos(st.toSec, 'x', false);
        u.setSelect({ left: l, width: r - l, top: 0, height: u.bbox.height / devicePixelRatio },
                    false);
      });
      if (readout) renderReadout(readout, st, clearSelection, opts);
      if (opts.onSelect) opts.onSelect(st);
    }

    return {
      plots: plots, series: series,
      destroy: function () { plots.forEach(function (u) { try { u.destroy(); } catch (e) {} }); },
      clearSelection: clearSelection,
      getSelection: function () { return selection; }
    };
  }

  function renderReadout(hostEl, st, onClear, opts) {
    while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
    var bar = document.createElement('div');
    bar.className = 'd-flex flex-wrap align-items-center gap-3';

    var head = document.createElement('span');
    head.className = 'lab';
    head.textContent = fmtClock(st.fromSec) + ' – ' + fmtClock(st.toSec) +
      '  (' + fmtClock(st.durationSec) + ')';
    bar.appendChild(head);

    st.panels.forEach(function (p) {
      if (p.avg == null) return;
      var s = document.createElement('span');
      s.className = 'd-inline-flex align-items-center gap-1';
      var dot = document.createElement('span');
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + p.color;
      s.appendChild(dot);
      var txt = document.createElement('span');
      var dp = p.unit === 'bpm' || p.unit === '°' ? 0 : 1;
      txt.textContent = p.label + ' ' + p.avg.toFixed(dp) + ' ' + p.unit;
      /* 유효 표본이 적으면 평균이라 부르지 않는다 — 숫자를 그대로 두고
         커버리지를 붙여 읽는 사람이 판단하게 한다. */
      if (p.coverage < 0.6) txt.textContent += ' (' + Math.round(p.coverage * 100) + '% covered)';
      s.appendChild(txt);
      bar.appendChild(s);
    });

    if (st.maneuvers && st.maneuvers.total) {
      var m = document.createElement('span');
      m.className = 'lab';
      m.textContent = st.maneuvers.tacks + ' tacks · ' + st.maneuvers.gybes + ' gybes';
      bar.appendChild(m);
    }

    if (opts && opts.onExclude) {
      var ex = document.createElement('button');
      ex.type = 'button';
      ex.className = 'btn btn-sm btn-outline-danger';
      ex.textContent = 'Exclude this range';
      ex.addEventListener('click', function () { opts.onExclude(st.fromSec, st.toSec); });
      bar.appendChild(ex);
    }
    var cl = document.createElement('button');
    cl.type = 'button';
    cl.className = 'btn btn-sm';
    cl.textContent = 'Clear';
    cl.addEventListener('click', onClear);
    bar.appendChild(cl);

    hostEl.appendChild(bar);
  }

  var API = { render: render, buildSeries: buildSeries, rangeStats: rangeStats,
              rangeManeuvers: rangeManeuvers, PANELS: PANELS, fmtClock: fmtClock };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDChartStack = API;
})(typeof window !== 'undefined' ? window : globalThis);
