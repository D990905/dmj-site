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
     완만한 사선으로 남아 그 시간에 타고 있었던 것처럼 보인다(§459).
     §486 (옥대표) — 거기서 한 걸음 더: 끊은 자리를 **비워 두지 않고
     양쪽을 붙인다.** 구간을 지웠는데 그 자리가 빈 채로 남으면 화면의
     상당 부분이 아무 정보도 없는 여백이 되고, "지운 만큼 시간이 흘렀다"
     는 잘못된 인상도 준다. x축은 벽시계가 아니라 **물 위에 있던 시간**이
     된다(축 라벨도 그렇게 읽어야 한다).
     이음매는 눈에 보이게 남긴다 — null 한 점으로 선을 끊어서, 붙였다는
     사실 자체는 숨기지 않는다. */
  function buildSeries(session, opts) {
    opts = opts || {};
    var S = (session && session.samples) || [];
    if (!S.length) return null;
    var maxPts = opts.maxPoints || 1800;
    var step = Math.max(1, Math.floor(S.length / maxPts));
    var t0 = S[0].t;
    var compress = opts.compress !== false;
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

    /* segs[k] = { realFrom, realTo, compFrom } — 압축 좌표와 실제 경과초를
       서로 되돌리기 위한 지도. 구간 제외는 실제 시각으로 해야 하므로
       (원본 세션에 적용된다) 이 지도가 없으면 드래그가 엉뚱한 데를 지운다. */
    var xs = [], ys = panels.map(function () { return []; });
    var segs = [];
    var prevT = null, prevIdx = null, shift = 0, segStart = null;
    for (var i = 0; i < S.length; i += step) {
      var tt = S[i].t - t0;
      var broke = false;
      if (prevT != null) {
        if ((tt - prevT) > Math.max(gapSec, step * 2)) broke = true;
        else for (var j = prevIdx; j < i; j++) if (legEnd[j]) { broke = true; break; }
      }
      if (broke) {
        /* 이음매 — 선을 끊는 null 을 앞 구간 끝에 두고, 압축 모드면 사이
           시간을 접는다. x 는 반드시 단조 증가해야 하므로(uPlot 요구)
           접는 양에서 EPS 만큼 덜 접어 다음 점이 null 바로 뒤에 오게 한다. */
        var EPS = 0.001;
        xs.push(prevT - shift);
        ys.forEach(function (a) { a.push(null); });
        segs.push({ realFrom: segStart, realTo: prevT, compFrom: segStart - shift });
        if (compress) shift += (tt - prevT) - EPS;
        segStart = tt;
      }
      if (segStart == null) segStart = tt;
      xs.push(tt - shift);
      panels.forEach(function (p, k) {
        var v = p.get(S[i]);
        ys[k].push(v != null && isFinite(v) ? v : null);
      });
      prevT = tt; prevIdx = i;
    }
    if (segStart != null) {
      segs.push({ realFrom: segStart, realTo: prevT, compFrom: segStart - shift });
    }

    return {
      panels: panels, x: xs, y: ys, t0: t0, step: step,
      compressed: compress, segments: segs,
      removedSec: compress ? shift : 0,
      wallDurationSec: prevT,
      durationSec: xs[xs.length - 1]
    };
  }

  /* 실제 경과초 → 화면 x. 접힌 구간 안이면 그 구간의 시작으로 붙인다. */
  function realToComp(series, tSec) {
    if (!series || !series.segments || !series.segments.length) return tSec;
    var segs = series.segments;
    for (var i = 0; i < segs.length; i++) {
      if (tSec <= segs[i].realTo) {
        return segs[i].compFrom + Math.max(0, tSec - segs[i].realFrom);
      }
    }
    var last = segs[segs.length - 1];
    return last.compFrom + (last.realTo - last.realFrom);
  }
  /* 화면 x → 실제 경과초. 드래그한 구간을 원본에서 지우려면 이게 필요하다. */
  function compToReal(series, x) {
    if (!series || !series.segments || !series.segments.length) return x;
    var segs = series.segments;
    for (var i = 0; i < segs.length; i++) {
      var span = segs[i].realTo - segs[i].realFrom;
      if (x <= segs[i].compFrom + span) {
        return segs[i].realFrom + Math.max(0, x - segs[i].compFrom);
      }
    }
    var last = segs[segs.length - 1];
    return last.realTo;
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
  /* fromSec/toSec 는 **화면(압축) 좌표**다. 기동은 실제 시각을 갖고 있으므로
     같은 좌표계로 옮겨서 센다 — 안 그러면 접힌 만큼 어긋난다. */
  function rangeManeuvers(maneuvers, fromSec, toSec, series) {
    var lo = Math.min(fromSec, toSec), hi = Math.max(fromSec, toSec);
    var t = 0, g = 0;
    (maneuvers || []).forEach(function (m) {
      if (m.tSec == null) return;
      var x = series ? realToComp(series, m.tSec) : m.tSec;
      if (x < lo || x > hi) return;
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
        /* §486 — 기동 시각도 압축 좌표로 옮겨야 선과 어긋나지 않는다 */
        var x = u.valToPos(realToComp(series, m.tSec), 'x', true);
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
      st.realFromSec = compToReal(series, st.fromSec);
      st.realToSec = compToReal(series, st.toSec);
      st.maneuvers = rangeManeuvers(mans, a, b, series);
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

    /* §536 (옥대표 "버그일까?") — **버그가 맞았다.**
       render 는 생성 시 host.clientWidth 를 한 번 읽고 끝이었다. 창을 넓히면
       카드는 늘어나는데 캔버스는 그대로라 **오른쪽이 빈 채로 남는다**
       (실측: 컨테이너 1244px / 캔버스 1024px → 220px 공백).
       uPlot 은 setSize 로 다시 잴 수 있으므로 컨테이너를 관찰해 따라가게 한다.
       ⚠ setSize 를 매 픽셀마다 부르면 스크롤이 버벅인다 → rAF 로 묶는다. */
    var ro = null, roPending = false;
    function resizeTo(w) {
      if (!(w > 0)) return;
      plots.forEach(function (u) {
        try { u.setSize({ width: w, height: u.height }); } catch (e) {}
      });
    }
    if (global.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (roPending) return;
        roPending = true;
        (global.requestAnimationFrame || setTimeout)(function () {
          roPending = false;
          var w = host.clientWidth;
          if (w > 0 && plots.length && Math.abs(plots[0].width - w) > 1) resizeTo(w);
        });
      });
      ro.observe(host);
    }

    return {
      plots: plots, series: series,
      destroy: function () {
        if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
        plots.forEach(function (u) { try { u.destroy(); } catch (e) {} });
      },
      resize: function () { resizeTo(host.clientWidth); },
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
      /* 제외는 **원본 세션**에 적용되므로 실제 경과초로 되돌려 넘긴다 */
      ex.addEventListener('click', function () {
        opts.onExclude(st.realFromSec != null ? st.realFromSec : st.fromSec,
                       st.realToSec != null ? st.realToSec : st.toSec);
      });
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
              realToComp: realToComp, compToReal: compToReal,
              rangeManeuvers: rangeManeuvers, PANELS: PANELS, fmtClock: fmtClock };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDChartStack = API;
})(typeof window !== 'undefined' ? window : globalThis);
