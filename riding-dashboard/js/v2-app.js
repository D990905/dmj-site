/* ============================================================
 * v2-app.js — §439 Tabler 템플릿 위의 새 대시보드 컨트롤러
 *
 * 기존 index.html / app.js 는 건드리지 않는다. 이 페이지는 별도다.
 * 재사용하는 것: geo.js · gpx-parser.js · analysis.js (전부 데이터 전용).
 * 차트: uPlot. 셸·카드·탭·표: Tabler (MIT).
 * ============================================================ */
(function () {
  'use strict';
  var KT = 1.94384;
  var $ = function (id) { return document.getElementById(id); };
  /* 전역 이름은 RD* 다 (app.js 가 쓰는 별칭과 동일하게 맞춘다) */
  var Gpx = window.RDGpx, An = window.RDAnalysis;
  /* ⚠ window.Storage 는 브라우저 내장 객체다 — 우리 모듈은 RDStorage */
  var Store = window.RDStorage;

  function riderFromForm() {
    var w = parseFloat(($('in-weight') || {}).value);
    var wing = parseFloat(($('in-wing') || {}).value);
    var sk = ($('in-skill') || {}).value;
    return { weightKg: isFinite(w) ? w : null, wingM2: isFinite(wing) ? wing : null,
             skill: sk || null };
  }
  function windSpeedFromForm() {
    var v = parseFloat(($('in-windspeed') || {}).value);
    return isFinite(v) ? v : null;
  }
  var THEME = { accent: '#4dabf7', warn: '#f59f00', grid: '#2b3648',
                dim: '#8a97a8', bg: '#1a2234' };

  /* 숨겨진 탭 안에서 만들어진 차트는 clientWidth 가 0 이라 너비가 틀린다.
     인스턴스를 들고 있다가 탭이 보이는 순간·창 크기 변경 시 다시 맞춘다. */
  var plots = [];
  function track(u, host) { if (u && host) plots.push({ u: u, host: host }); return u; }
  function resizePlots(scope) {
    plots.forEach(function (p) {
      if (scope && !scope.contains(p.host)) return;
      var w = p.host.clientWidth;
      if (w > 0 && Math.abs(w - p.u.width) > 1) {
        try { p.u.setSize({ width: w, height: p.u.height }); } catch (e) {}
      }
    });
  }

  /* Tabler 의 탭은 Bootstrap JS 가 있어야 동작한다. 그 하나 때문에
     번들을 통째로 끌어오는 대신 직접 처리한다. */
  function initTabs() {
    var links = [].slice.call(document.querySelectorAll('.nav-tabs .nav-link'));
    links.forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var sel = a.getAttribute('href');
        if (!sel) return;
        var pane = document.querySelector(sel);
        if (!pane) return;
        links.forEach(function (x) { x.classList.remove('active'); });
        a.classList.add('active');
        [].slice.call(document.querySelectorAll('.tab-pane')).forEach(function (p) {
          p.classList.remove('active', 'show');
        });
        pane.classList.add('active', 'show');
        resizePlots(pane);
        if (sel === '#tab-track' && mapInst && mapInst.map) {
          setTimeout(function () { mapInst.map.invalidateSize(); }, 60);
        }
      });
    });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { resizePlots(null); }, 150);
    });
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var ss = (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ---------- KPI ---------- */
  function kpiCard(label, value, unit, sub) {
    var col = el('div', 'col-6 col-md-4 col-xl-2');
    var card = el('div', 'card');
    var body = el('div', 'card-body');
    body.appendChild(el('div', 'lab', label));
    var row = el('div', 'd-flex align-items-baseline gap-1 mt-1');
    row.appendChild(el('span', 'kpi__val num', value));
    if (unit) row.appendChild(el('span', 'kpi__unit', unit));
    body.appendChild(row);
    if (sub) body.appendChild(el('div', 'kpi__sub mt-1', sub));
    card.appendChild(body); col.appendChild(card);
    return col;
  }

  /* SPS 카드 — 산출 불가 사유를 숨기지 않는다. "—" 만 띄우면
     무엇을 더 넣어야 하는지 알 수 없다. */
  function spsCard(vps) {
    var col = el('div', 'col-6 col-md-4 col-xl-2');
    var card = el('div', 'card'), b = el('div', 'card-body');
    b.appendChild(el('div', 'lab', 'Performance score'));
    var ok = vps && vps.ok !== false && vps.overall && vps.overall.score != null;
    var row = el('div', 'd-flex align-items-baseline gap-2 mt-1');
    row.appendChild(el('span', 'kpi__val num', ok ? String(Math.round(vps.overall.score)) : '—'));
    if (ok && window.RDCoach && RDCoach.vpsBand) {
      var band = RDCoach.vpsBand(vps.overall.score);
      var chip = el('span', 'badge', band.label);
      chip.style.background = band.color; chip.style.color = '#0b1220';
      row.appendChild(chip);
    }
    b.appendChild(row);
    if (ok) {
      var bar = el('div', 'progress mt-2'); bar.style.height = '4px';
      var fill = el('div', 'progress-bar');
      fill.style.width = Math.max(0, Math.min(100, vps.overall.score)) + '%';
      bar.appendChild(fill); b.appendChild(bar);
      b.appendChild(el('div', 'kpi__sub mt-1', 'speed 70% + turns 30%'));
    } else {
      var why = (vps && vps.missing && vps.missing.length)
        ? 'needs ' + vps.missing.join(', ') : 'not available';
      b.appendChild(el('div', 'kpi__sub mt-1', why));
    }
    card.appendChild(b); col.appendChild(card); return col;
  }

  function renderKpis(a, vps) {
    var s = a.summary || {};
    var host = $('kpi-row');
    while (host.firstChild) host.removeChild(host.firstChild);
    var turns = (a.maneuvers || []).length;
    var dPct = s.activeDistRatio != null ? Math.round(s.activeDistRatio * 100) : null;
    var tPct = s.activeRatio != null ? Math.round(s.activeRatio * 100) : null;
    host.appendChild(spsCard(vps));
    host.appendChild(kpiCard('Top speed',
      s.maxSpeedMs != null ? (s.maxSpeedMs * KT).toFixed(1) : '—', 'kt', '2-second peak'));
    host.appendChild(kpiCard('Avg speed',
      s.avgSpeedMovingMs != null ? (s.avgSpeedMovingMs * KT).toFixed(1) : '—', 'kt', 'while moving'));
    host.appendChild(kpiCard('Distance',
      s.totalDistanceM != null ? (s.totalDistanceM / 1000).toFixed(2) : '—', 'km',
      dPct == null ? '' : dPct + '% on foil'));
    host.appendChild(kpiCard('Foiling time', fmtClock(s.activeTimeSec), '',
      tPct == null ? '' : tPct + '% of total'));
    host.appendChild(kpiCard('Moving time', fmtClock(s.movingTimeSec), '',
      'of ' + fmtClock(s.totalDurationSec)));

  }

  /* ---------- 속도 히스토그램 ---------- */
  /* 실제 bin 형태 = { fromKt, toKt, seconds } */
  function renderHistogram(a) {
    var host = $('chart-hist');
    var h = a.histogram || [];
    if (!h.length || !window.uPlot) { host.textContent = 'No data'; return; }
    var xs = h.map(function (b) { return (b.fromKt + b.toKt) / 2; });
    var ys = h.map(function (b) { return (b.seconds || 0) / 60; });
    var binW = h.length > 1 ? (h[0].toKt - h[0].fromKt) : 2;
    while (host.firstChild) host.removeChild(host.firstChild);
    track(new uPlot({
      width: host.clientWidth || 420, height: 268, padding: [12, 12, 4, 6],
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: false, range: [h[0].fromKt - binW * 0.6,
                                          h[h.length - 1].toKt + binW * 0.6] } },
      axes: [
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return v + ' kt'; }); } },
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 44,
          values: function (u, t) { return t.map(function (v) { return v.toFixed(0) + 'm'; }); } }
      ],
      series: [
        { label: 'Speed', value: function (u, v) { return v == null ? '—' : v.toFixed(0) + ' kt'; } },
        { label: 'Time', stroke: THEME.accent, fill: 'rgba(77,171,247,0.32)', width: 1,
          paths: uPlot.paths.bars({ size: [0.86, Infinity] }),
          value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' min'; } }
      ]
    }, [xs, ys], host));
  }

  /* ---------- 세션 시계열 ---------- */
  function renderTimeline(session) {
    var host = $('chart-timeline');
    var S = session.samples || [];
    if (!S.length || !window.uPlot) { host.textContent = 'No data'; return; }
    var t0 = S[0].t;
    var step = Math.max(1, Math.floor(S.length / 1800));   /* 과밀 방지 다운샘플 */
    var xs = [], ys = [];
    for (var i = 0; i < S.length; i += step) {
      xs.push(S[i].t - t0);
      ys.push(S[i].speed != null && isFinite(S[i].speed) ? S[i].speed * KT : null);
    }
    while (host.firstChild) host.removeChild(host.firstChild);
    track(new uPlot({
      width: host.clientWidth || 900, height: 268, padding: [12, 14, 4, 6],
      cursor: { drag: { x: true, y: false } },
      scales: { x: { time: false } },
      axes: [
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return fmtClock(v); }); } },
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 40,
          values: function (u, t) { return t.map(function (v) { return v.toFixed(0); }); } }
      ],
      series: [
        { label: 'Elapsed', value: function (u, v) { return v == null ? '—' : fmtClock(v); } },
        { label: 'Speed', stroke: THEME.accent, width: 1.4,
          fill: 'rgba(77,171,247,0.14)',
          value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } }
      ]
    }, [xs, ys], host), host);
  }

  /* ---------- 회전 표 ---------- */
  /* 실제 필드 = efficiency · lossDisplayPct · recoverySec, 요약은 maneuverStats */
  function renderTurns(a) {
    var tb = document.querySelector('#turn-table tbody');
    while (tb.firstChild) tb.removeChild(tb.firstChild);
    var mans = a.maneuvers || [], st = a.maneuverStats || {};
    if (!mans.length) {
      var tr0 = el('tr'), td0 = el('td', 'text-secondary', 'No turns detected');
      td0.colSpan = 6; tr0.appendChild(td0); tb.appendChild(tr0); return;
    }
    function avg(arr, key) {
      var v = arr.map(function (m) { return m[key]; })
                 .filter(function (x) { return x != null && isFinite(x); });
      return v.length ? v.reduce(function (s2, x) { return s2 + x; }, 0) / v.length : null;
    }
    function num(v, dp, suf) { return v == null ? '—' : v.toFixed(dp) + (suf || ''); }
    function row(name, arr, rate, strong) {
      if (!arr.length) return;
      var tr = el('tr');
      var c0 = el('td', null, name); if (strong) c0.className = 'fw-bold';
      tr.appendChild(c0);
      tr.appendChild(el('td', 'text-end num', String(arr.length)));
      tr.appendChild(el('td', 'text-end num', num(avg(arr, 'lossDisplayPct') != null
        ? avg(arr, 'lossDisplayPct') : avg(arr, 'lossPct'), 0, '%')));
      tr.appendChild(el('td', 'text-end num', num(avg(arr, 'recoverySec'), 1, ' s')));
      tr.appendChild(el('td', 'text-end num', num(avg(arr, 'efficiency'), 0)));
      /* tackSuccessRate/gybeSuccessRate 는 이미 0~100 퍼센트값이다.
         successRateWhole 은 boolean 이라 비율이 아니므로 쓰지 않는다. */
      tr.appendChild(el('td', 'text-end num',
        (rate == null || typeof rate !== 'number') ? '—' : Math.round(rate) + '%'));
      tb.appendChild(tr);
    }
    var tacks = mans.filter(function (m) { return m.type === 'tack'; });
    var gybes = mans.filter(function (m) { return m.type === 'gybe'; });
    var other = mans.filter(function (m) { return m.type !== 'tack' && m.type !== 'gybe'; });
    row('Tack', tacks, st.tackSuccessRate);
    row('Gybe', gybes, st.gybeSuccessRate);
    if (other.length) row('Other turns', other, null);
    /* 전체 성공률은 택·자이브 성공 건수 합으로 직접 계산 */
    var okAll = (st.tackSuccess || 0) + (st.gybeSuccess || 0);
    var totAll = (st.tackSuccessTotal || 0) + (st.gybeSuccessTotal || 0);
    row('All turns', mans, totAll ? (okAll / totAll) * 100 : null, true);
  }

  /* ---------- 생리 (심박) ---------- */
  function renderPhysiology(a) {
    var host = $('phys-body');
    while (host.firstChild) host.removeChild(host.firstChild);
    var hr = a.hr;
    if (!hr || !hr.hasHR) {
      host.appendChild(el('div', 'text-secondary', 'This file contains no heart-rate data.'));
      return;
    }
    var grid = el('div', 'row row-cards');
    function stat(label, val, sub) {
      var col = el('div', 'col-6 col-md-3');
      var card = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', label));
      b.appendChild(el('div', 'kpi__val num mt-1', val));
      if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
      card.appendChild(b); col.appendChild(card); return col;
    }
    grid.appendChild(stat('Average HR', hr.avgBpm != null ? Math.round(hr.avgBpm) : '—', 'bpm'));
    grid.appendChild(stat('Max HR', hr.maxBpm != null ? String(hr.maxBpm) : '—', 'bpm'));
    grid.appendChild(stat('Min HR', hr.minBpm != null ? String(hr.minBpm) : '—', 'bpm'));
    grid.appendChild(stat('Coverage', hr.coveragePct != null ? Math.round(hr.coveragePct) + '%' : '—',
      (hr.count || 0).toLocaleString() + ' readings'));
    host.appendChild(grid);

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Heart rate over the session'));
    var act = el('div', 'card-actions lab', 'bpm'); head.appendChild(act);
    card.appendChild(head);
    var body = el('div', 'card-body');
    var plot = el('div', 'chart-host'); plot.id = 'chart-hr';
    body.appendChild(plot); card.appendChild(body); host.appendChild(card);

    var ser = hr.series || [];
    if (!ser.length || !window.uPlot) { plot.textContent = 'No series'; return; }
    var t0 = ser[0].t;
    var step = Math.max(1, Math.floor(ser.length / 1500));
    var xs = [], ys = [];
    for (var i = 0; i < ser.length; i += step) { xs.push(ser[i].t - t0); ys.push(ser[i].hr); }
    track(new uPlot({
      width: plot.clientWidth || 900, height: 240, padding: [12, 14, 4, 6],
      cursor: { drag: { x: true, y: false } },
      scales: { x: { time: false } },
      axes: [
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return fmtClock(v); }); } },
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 40 }
      ],
      series: [
        { label: 'Elapsed', value: function (u, v) { return v == null ? '—' : fmtClock(v); } },
        { label: 'HR', stroke: '#f76707', width: 1.4, fill: 'rgba(247,103,7,0.12)',
          value: function (u, v) { return v == null ? '—' : v + ' bpm'; } }
      ]
    }, [xs, ys], plot), plot);
    renderHrTiers(host, hr.tiers, hr.maxBpm);
    renderHrEfficiency(host, hr.efficiency);
  }

  /* 추정 신뢰도 라벨 — 엔진은 한글을 돌려주는데 이 페이지는 영어다 */
  function confLabel(c) {
    return ({ '높음': 'high', '보통': 'medium', '낮음': 'low' })[c] || String(c);
  }

  /* ---------- 환경 (풍향 · VMG · 폴라) ---------- */
  function renderEnvironment(a, est) {
    var host = $('env-body');
    while (host.firstChild) host.removeChild(host.firstChild);

    /* 풍향 컨트롤 — 자동추정이 낮은 신뢰도일 때 사람이 고칠 수 있어야 한다.
       풍향이 틀리면 택/자이브 분류·VMG·폴라가 전부 틀어진다. */
    var ctl = el('div', 'card mb-3');
    var cb = el('div', 'card-body');
    var row = el('div', 'row g-2 align-items-end');

    var c1 = el('div', 'col-auto');
    c1.appendChild(el('label', 'form-label lab', 'Wind direction (°)'));
    var inp = el('input', 'form-control num'); inp.type = 'number';
    inp.min = '0'; inp.max = '359'; inp.step = '1'; inp.style.width = '120px';
    inp.value = a.windDir != null ? String(Math.round(a.windDir)) : '';
    c1.appendChild(inp); row.appendChild(c1);

    var c2 = el('div', 'col-auto');
    var btn = el('button', 'btn btn-primary', 'Apply'); btn.type = 'button';
    c2.appendChild(btn); row.appendChild(c2);

    var c3 = el('div', 'col-auto');
    var reBtn = el('button', 'btn', 'Re-estimate from track'); reBtn.type = 'button';
    c3.appendChild(reBtn); row.appendChild(c3);

    var c4 = el('div', 'col');
    var src = el('div', 'text-secondary', '');
    src.style.fontSize = '.8125rem';
    src.textContent = est
      ? 'Currently ' + Math.round(a.windDir) + '° from track estimate · confidence '
        + confLabel(est.confidence) + (est.note ? ' · ' + est.note : '')
      : 'Currently ' + Math.round(a.windDir) + '° (manual)';
    c4.appendChild(src); row.appendChild(c4);

    cb.appendChild(row); ctl.appendChild(cb); host.appendChild(ctl);

    btn.addEventListener('click', function () {
      var v = parseFloat(inp.value);
      if (!isFinite(v)) return;
      applyWind(((v % 360) + 360) % 360, null);
    });
    reBtn.addEventListener('click', function () { applyWind(null, 're-estimate'); });

    var w = a.wind;
    if (!w) { host.appendChild(el('div', 'text-secondary', 'Wind not resolved.')); return; }

    /* VMG 표 + 폴라를 나란히 */
    var grid = el('div', 'row row-cards');

    var colT = el('div', 'col-lg-7');
    var cardT = el('div', 'card');
    var hT = el('div', 'card-header'); hT.appendChild(el('h3', 'card-title', 'VMG'));
    hT.appendChild(el('div', 'card-actions lab', 'velocity made good'));
    cardT.appendChild(hT);
    var bodyT = el('div', 'card-body p-0');
    var tbl = el('table', 'table table-vcenter card-table');
    var thead = el('thead'), htr = el('tr');
    ['', 'Average', 'Top 50%', 'Top 20%', 'Time'].forEach(function (h, i) {
      htr.appendChild(el('th', i ? 'text-end' : null, h));
    });
    thead.appendChild(htr); tbl.appendChild(thead);
    var tbody = el('tbody');
    function vmgRow(name, avgMs, t50, t20, sec) {
      var tr = el('tr');
      tr.appendChild(el('td', null, name));
      [avgMs, t50, t20].forEach(function (v) {
        tr.appendChild(el('td', 'text-end num', v == null ? '—' : (v * KT).toFixed(1) + ' kt'));
      });
      tr.appendChild(el('td', 'text-end num', fmtClock(sec)));
      tbody.appendChild(tr);
    }
    vmgRow('Upwind', w.vmgUpwindAvgMs, w.vmgUpwindTop50Ms, w.vmgUpwindTop20Ms, w.upwindTimeSec);
    vmgRow('Downwind', w.vmgDownwindAvgMs, w.vmgDownwindTop50Ms, w.vmgDownwindTop20Ms, w.downwindTimeSec);
    tbl.appendChild(tbody); bodyT.appendChild(tbl); cardT.appendChild(bodyT);
    colT.appendChild(cardT); grid.appendChild(colT);

    var colP = el('div', 'col-lg-5');
    var cardP = el('div', 'card');
    var hP = el('div', 'card-header'); hP.appendChild(el('h3', 'card-title', 'Polar'));
    hP.appendChild(el('div', 'card-actions lab', 'top 5% speed per angle'));
    cardP.appendChild(hP);
    var bodyP = el('div', 'card-body d-flex justify-content-center');
    var polarHost = el('div'); polarHost.id = 'chart-polar';
    bodyP.appendChild(polarHost); cardP.appendChild(bodyP);
    var footP = el('div', 'card-footer text-secondary');
    footP.style.fontSize = '.8125rem';
    footP.textContent = 'Red = port tack, green = starboard — the international convention. '
      + 'Up is upwind. A dent on one side means that tack is losing speed.';
    cardP.appendChild(footP);
    colP.appendChild(cardP); grid.appendChild(colP);
    host.appendChild(grid);

    if (window.RDPolar) {
      RDPolar.render(polarHost, a.polar,
        { grid: THEME.grid, dim: THEME.dim, port: '#e03131', starboard: '#2f9e44',
          size: Math.min(400, polarHost.clientWidth || 380) });
    }
  }

  /* ---------- 고속 구간 (Run) · 퍼포먼스 통계 ---------- */
  function renderPerfExtra(a) {
    var host = $('perf-extra');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    /* Runs — 어느 구간이 진짜 주행이었는지. 세션 전체 평균이 숨기는 것. */
    var rw = a.runs || {}, runs = rw.runs || [];
    var card = el('div', 'card');
    var h = el('div', 'card-header');
    h.appendChild(el('h3', 'card-title', 'Fast runs'));
    h.appendChild(el('div', 'card-actions lab',
      runs.length + ' runs · threshold ' + (rw.thresholdMs ? (rw.thresholdMs * KT).toFixed(1) : '—') + ' kt'));
    card.appendChild(h);
    if (!runs.length) {
      var b0 = el('div', 'card-body text-secondary', 'No sustained runs above the threshold.');
      card.appendChild(b0);
    } else {
      var wrap = el('div', 'table-responsive');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['#', 'Duration', 'Distance', 'Avg', 'Max', 'Heading', 'Avg HR'].forEach(function (x, i) {
        htr.appendChild(el('th', i ? 'text-end' : null, x));
      });
      th.appendChild(htr); t.appendChild(th);
      var tb = el('tbody');
      runs.forEach(function (r, i) {
        var tr = el('tr');
        tr.appendChild(el('td', 'num', String(i + 1)));
        tr.appendChild(el('td', 'text-end num', fmtClock(r.durationSec)));
        tr.appendChild(el('td', 'text-end num', (r.distanceM / 1000).toFixed(2) + ' km'));
        tr.appendChild(el('td', 'text-end num', (r.avgSpeedMs * KT).toFixed(1) + ' kt'));
        tr.appendChild(el('td', 'text-end num', (r.maxSpeedMs * KT).toFixed(1) + ' kt'));
        tr.appendChild(el('td', 'text-end num',
          r.heading == null ? '—' : Math.round(r.heading) + '°'));
        tr.appendChild(el('td', 'text-end num',
          r.avgHr == null ? '—' : Math.round(r.avgHr) + ' bpm'));
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
    }
    host.appendChild(card);

    /* 퍼포먼스 통계 — SOG·VMG·CWA 를 상풍/하풍 · 포트/스타보드로 쪼갠 표 */
    if (!An.computeStatsPanel) return;
    var sp = null;
    try { sp = An.computeStatsPanel(a); } catch (e) { sp = null; }
    if (!sp || !sp.rows || !sp.rows.length) return;
    var c2 = el('div', 'card mt-3');
    var h2 = el('div', 'card-header');
    h2.appendChild(el('h3', 'card-title', 'Performance statistics'));
    h2.appendChild(el('div', 'card-actions lab',
      'upwind ' + fmtClock(sp.upwindTimeSec) + ' · downwind ' + fmtClock(sp.downwindTimeSec)));
    c2.appendChild(h2);
    var wrap2 = el('div', 'table-responsive');
    var t2 = el('table', 'table table-vcenter card-table table-sm');
    var keys = Object.keys(sp.rows[0]);
    var th2 = el('thead'), htr2 = el('tr');
    keys.forEach(function (k, i) {
      htr2.appendChild(el('th', i ? 'text-end' : null, k));
    });
    th2.appendChild(htr2); t2.appendChild(th2);
    var tb2 = el('tbody');
    sp.rows.forEach(function (r) {
      var tr = el('tr');
      keys.forEach(function (k, i) {
        var v = r[k];
        tr.appendChild(el('td', i ? 'text-end num' : null,
          v == null ? '—' : (typeof v === 'number' ? (Math.abs(v) < 10 ? v.toFixed(1) : v.toFixed(0)) : String(v))));
      });
      tb2.appendChild(tr);
    });
    t2.appendChild(tb2); wrap2.appendChild(t2); c2.appendChild(wrap2);
    host.appendChild(c2);
  }

  /* ---------- 저장된 세션 · 시즌 흐름 ---------- */
  function listSessions() {
    try { return (Store && Store.listSessions) ? (Store.listSessions() || []) : []; }
    catch (e) { return []; }
  }
  function renderSessions() {
    var host = $('sessions-body');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    var list = listSessions();
    if (!list.length) {
      host.appendChild(el('div', 'alert alert-info',
        'No saved sessions yet. Use "Save session" in the header to start building a season trend.'));
      return;
    }
    var card = el('div', 'card');
    var h = el('div', 'card-header');
    h.appendChild(el('h3', 'card-title', 'Saved sessions'));
    h.appendChild(el('div', 'card-actions lab', list.length + ' stored'));
    card.appendChild(h);
    var wrap = el('div', 'table-responsive');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Date', 'Name', 'Distance', 'Top', 'Avg', 'Turns', 'SPS'].forEach(function (x, i) {
      htr.appendChild(el('th', i > 1 ? 'text-end' : null, x));
    });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    var sorted = list.slice().sort(function (a2, b2) {
      return (a2.dateEpoch || 0) - (b2.dateEpoch || 0);
    });
    sorted.forEach(function (r) {
      var tr = el('tr');
      var d = r.dateEpoch ? new Date(r.dateEpoch) : null;
      tr.appendChild(el('td', 'num', d ? d.toISOString().slice(0, 10) : '—'));
      tr.appendChild(el('td', null, r.name || 'Session'));
      /* 저장 레코드는 SI 단위(m·m/s)로 들어간다 — 표시할 때 변환한다 */
      tr.appendChild(el('td', 'text-end num',
        r.distanceM != null ? (r.distanceM / 1000).toFixed(2) + ' km' : '—'));
      tr.appendChild(el('td', 'text-end num',
        r.maxSpeedMs != null ? (r.maxSpeedMs * KT).toFixed(1) : '—'));
      tr.appendChild(el('td', 'text-end num',
        r.avgSpeedMovingMs != null ? (r.avgSpeedMovingMs * KT).toFixed(1) : '—'));
      tr.appendChild(el('td', 'text-end num',
        r.maneuverTotal != null ? String(r.maneuverTotal) : '—'));
      tr.appendChild(el('td', 'text-end num',
        r.vpsOverall != null ? String(Math.round(r.vpsOverall)) : '—'));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
    host.appendChild(card);

    /* 시즌 흐름 — 저장 세션이 2개 이상일 때만 의미가 있다 */
    var pts = sorted.filter(function (r) { return r.dateEpoch && r.maxSpeedMs != null; });
    if (pts.length < 2 || !window.uPlot) return;
    var c2 = el('div', 'card mt-3');
    var h2 = el('div', 'card-header');
    h2.appendChild(el('h3', 'card-title', 'Season trend'));
    h2.appendChild(el('div', 'card-actions lab', 'top speed per session'));
    c2.appendChild(h2);
    var b2 = el('div', 'card-body');
    var plot = el('div', 'chart-host'); plot.id = 'chart-season';
    b2.appendChild(plot); c2.appendChild(b2); host.appendChild(c2);
    var xs = pts.map(function (r) { return r.dateEpoch / 1000; });
    var ys = pts.map(function (r) { return r.maxSpeedMs * KT; });
    track(new uPlot({
      width: plot.clientWidth || 800, height: 260, padding: [12, 14, 4, 6],
      cursor: { drag: { x: true, y: false } },
      axes: [
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace' },
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 42 }
      ],
      series: [
        {},
        { label: 'Top speed', stroke: THEME.accent, width: 2,
          fill: 'rgba(77,171,247,0.14)', points: { show: true, size: 7 },
          value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } }
      ]
    }, [xs, ys], plot), plot);
  }

  /* ---------- 심박 티어 막대 ---------- */
  /* 도넛이 아니라 가로 막대 — 길이 비교가 각도 비교보다 정확하고,
     티어에는 순서가 있는데 도넛은 그 순서를 없앤다. */
  function renderHrTiers(host, tiers, maxBpm) {
    if (!tiers) return;
    var rows = [
      ['Top 20%', tiers.top20, '#e03131'],
      ['Top 50%', tiers.top50, '#f76707'],
      ['Average', tiers.avg,   '#f59f00'],
      ['Bottom 50%', tiers.bot50, '#40c057'],
      ['Bottom 20%', tiers.bot20, '#4dabf7']
    ].filter(function (r) { return r[1] != null && isFinite(r[1]); });
    if (!rows.length) return;
    var top = Math.max(maxBpm || 0, rows[0][1]) * 1.05;
    var card = el('div', 'card mt-3');
    var h = el('div', 'card-header');
    h.appendChild(el('h3', 'card-title', 'Heart rate distribution'));
    h.appendChild(el('div', 'card-actions lab', 'bpm'));
    card.appendChild(h);
    var b = el('div', 'card-body d-flex flex-column gap-2');
    rows.forEach(function (r) {
      var line = el('div', 'd-flex align-items-center gap-2');
      var lbl = el('div', 'lab'); lbl.style.width = '92px'; lbl.textContent = r[0];
      line.appendChild(lbl);
      var barWrap = el('div', 'flex-grow-1');
      barWrap.style.cssText = 'background:var(--tblr-border-color);height:12px;border-radius:3px;overflow:hidden';
      var fill = el('div');
      fill.style.cssText = 'height:100%;background:' + r[2] + ';width:'
        + Math.max(2, Math.min(100, (r[1] / top) * 100)) + '%';
      barWrap.appendChild(fill); line.appendChild(barWrap);
      var v = el('div', 'num'); v.style.width = '56px'; v.style.textAlign = 'right';
      v.textContent = Math.round(r[1]);
      line.appendChild(v);
      b.appendChild(line);
    });
    card.appendChild(b); host.appendChild(card);
  }

  /* ---------- 외부 성능 vs 내부 반응 산점도 ---------- */
  /* 같은 속도에서 심박이 낮아지면 적응, 높아지면 이상 세션이다.
     두 변수의 결합은 산점도로만 보인다. */
  function renderHrEfficiency(host, eff) {
    if (!eff || !eff.available || !eff.scatter || !eff.scatter.length || !window.uPlot) return;
    var card = el('div', 'card mt-3');
    var h = el('div', 'card-header');
    h.appendChild(el('h3', 'card-title', 'Speed vs heart rate'));
    h.appendChild(el('div', 'card-actions lab', 'each dot = one sample window'));
    card.appendChild(h);
    var b = el('div', 'card-body');
    var plot = el('div', 'chart-host'); plot.id = 'chart-hreff';
    b.appendChild(plot); card.appendChild(b);
    var f = el('div', 'card-footer text-secondary'); f.style.fontSize = '.8125rem';
    f.textContent = 'Dots drifting right at the same height mean more speed for the same effort.';
    card.appendChild(f);
    host.appendChild(card);

    var pairs = eff.scatter
      .filter(function (d) { return d && d.speedMs > 0 && d.hr > 0; })
      .map(function (d) { return [d.speedMs * KT, d.hr]; })
      .sort(function (a2, b2) { return a2[0] - b2[0]; });
    if (pairs.length < 3) { plot.textContent = 'Not enough samples'; return; }
    track(new uPlot({
      width: plot.clientWidth || 800, height: 280, padding: [12, 14, 4, 6],
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: false } },
      axes: [
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return v.toFixed(0) + ' kt'; }); } },
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 44,
          values: function (u, t) { return t.map(function (v) { return v.toFixed(0); }); } }
      ],
      series: [
        { label: 'Speed', value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } },
        { label: 'HR', stroke: 'rgba(247,103,7,0.85)', width: 0,
          points: { show: true, size: 4, stroke: 'rgba(247,103,7,0.7)',
                    fill: 'rgba(247,103,7,0.35)' },
          value: function (u, v) { return v == null ? '—' : v + ' bpm'; } }
      ]
    }, [pairs.map(function (x) { return x[0]; }), pairs.map(function (x) { return x[1]; })], plot), plot);
  }

  /* ---------- 회전 좌우 분포 · 개별 목록 ---------- */
  function renderTurnExtras(a) {
    var host = $('turn-extra');
    while (host.firstChild) host.removeChild(host.firstChild);
    var mans = a.maneuvers || [];
    if (!mans.length) return;

    /* 포트·스타보드 분포 — 한쪽이 몰리면 그 택이 약하다는 신호 */
    var counts = { tackP: 0, tackS: 0, gybeP: 0, gybeS: 0 };
    mans.forEach(function (m) {
      var k = (m.type === 'tack' ? 'tack' : m.type === 'gybe' ? 'gybe' : null);
      if (!k || !m.side) return;
      counts[k + m.side]++;
    });
    var row = el('div', 'row row-cards');
    function distCard(title, p, sName, sVal) {
      var col = el('div', 'col-md-6');
      var card = el('div', 'card');
      var h = el('div', 'card-header'); h.appendChild(el('h3', 'card-title', title));
      card.appendChild(h);
      var b = el('div', 'card-body');
      var tot = p + sVal;
      if (!tot) { b.appendChild(el('div', 'text-secondary', 'none')); card.appendChild(b);
                  col.appendChild(card); return col; }
      var bar = el('div', 'd-flex'); bar.style.cssText = 'height:14px;border-radius:3px;overflow:hidden';
      var lp = el('div'); lp.style.cssText = 'background:#e03131;width:' + (p / tot * 100) + '%';
      var ls = el('div'); ls.style.cssText = 'background:#2f9e44;width:' + (sVal / tot * 100) + '%';
      bar.appendChild(lp); bar.appendChild(ls); b.appendChild(bar);
      var lg = el('div', 'd-flex justify-content-between mt-2');
      lg.appendChild(el('span', 'num', 'Port ' + p));
      lg.appendChild(el('span', 'num', sName + ' ' + sVal));
      b.appendChild(lg);
      card.appendChild(b); col.appendChild(card); return col;
    }
    row.appendChild(distCard('Tacks by side', counts.tackP, 'Starboard', counts.tackS));
    row.appendChild(distCard('Gybes by side', counts.gybeP, 'Starboard', counts.gybeS));
    host.appendChild(row);

    /* 개별 회전 목록 — 요약만으로는 어느 회전이 나빴는지 못 찾는다 */
    var lh = $('turn-list');
    while (lh.firstChild) lh.removeChild(lh.firstChild);
    var card2 = el('div', 'card');
    var h2 = el('div', 'card-header');
    h2.appendChild(el('h3', 'card-title', 'Every turn'));
    h2.appendChild(el('div', 'card-actions lab', mans.length + ' detected'));
    card2.appendChild(h2);
    var wrap = el('div', 'table-responsive');
    wrap.style.maxHeight = '420px'; wrap.style.overflowY = 'auto';
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['#', 'Type', 'Side', 'Time', 'Loss', 'Recovery', 'Eff', 'Turn rate'].forEach(function (x, i) {
      htr.appendChild(el('th', i > 2 ? 'text-end' : null, x));
    });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    mans.forEach(function (m, i) {
      var tr = el('tr');
      tr.appendChild(el('td', 'num', String(i + 1)));
      var badge = el('span', 'badge',
        m.type === 'tack' ? 'Tack' : m.type === 'gybe' ? 'Gybe' : 'Turn');
      badge.style.background = m.type === 'tack' ? '#4dabf7' : m.type === 'gybe' ? '#f76707' : '#868e96';
      badge.style.color = '#0b1220';
      var tdT = el('td'); tdT.appendChild(badge); tr.appendChild(tdT);
      tr.appendChild(el('td', null, m.side === 'P' ? 'Port' : m.side === 'S' ? 'Stbd' : '—'));
      tr.appendChild(el('td', 'text-end num', fmtClock(m.tSec)));
      var loss = m.lossDisplayPct != null ? m.lossDisplayPct : m.lossPct;
      tr.appendChild(el('td', 'text-end num', loss == null ? '—' : Math.round(loss) + '%'));
      tr.appendChild(el('td', 'text-end num',
        m.recoverySec == null ? '—' : m.recoverySec.toFixed(1) + ' s'));
      tr.appendChild(el('td', 'text-end num',
        m.efficiency == null ? '—' : String(Math.round(m.efficiency))));
      tr.appendChild(el('td', 'text-end num',
        m.avgTurnRateDegSec == null ? '—' : m.avgTurnRateDegSec.toFixed(1) + '°/s'));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); card2.appendChild(wrap);
    lh.appendChild(card2);
  }

  /* ---------- 코칭 (SPS 분해 · 윙 what-if) ---------- */
  function segCard(title, seg, tone) {
    var col = el('div', 'col-md-4');
    var card = el('div', 'card h-100');
    var h = el('div', 'card-header'); h.appendChild(el('h3', 'card-title', title));
    card.appendChild(h);
    var b = el('div', 'card-body');
    if (!seg || seg.score == null) {
      b.appendChild(el('div', 'kpi__val num', '—'));
      b.appendChild(el('div', 'text-secondary mt-1',
        (seg && seg.note) ? seg.note : 'not enough data'));
    } else {
      var row = el('div', 'd-flex align-items-baseline gap-2');
      row.appendChild(el('span', 'kpi__val num', String(Math.round(seg.score))));
      if (window.RDCoach && RDCoach.vpsBand) {
        var band = RDCoach.vpsBand(seg.score);
        var chip = el('span', 'badge', band.label);
        chip.style.background = band.color; chip.style.color = '#0b1220';
        row.appendChild(chip);
      }
      b.appendChild(row);
      var bar = el('div', 'progress mt-2'); bar.style.height = '4px';
      var fill = el('div', 'progress-bar');
      if (tone) fill.classList.add('bg-' + tone);
      fill.style.width = Math.max(0, Math.min(100, seg.score)) + '%';
      bar.appendChild(fill); b.appendChild(bar);
      var dl = el('div', 'datagrid mt-3');
      function item(k, v) {
        var d = el('div', 'datagrid-item');
        d.appendChild(el('div', 'datagrid-title lab', k));
        d.appendChild(el('div', 'datagrid-content num', v == null ? '—' : String(Math.round(v))));
        dl.appendChild(d);
      }
      item('Speed 70%', seg.speedScore);
      item('Turns 30%', seg.turnScore);
      if (seg.tackScore != null) item('Tack', seg.tackScore);
      if (seg.gybeScore != null) item('Gybe', seg.gybeScore);
      b.appendChild(dl);
      if (seg.partial) b.appendChild(el('div', 'text-secondary mt-2', 'partial — turn data missing'));
    }
    card.appendChild(b); col.appendChild(card); return col;
  }

  function renderCoach(a, vps, whatIf) {
    var host = $('coach-body');
    while (host.firstChild) host.removeChild(host.firstChild);

    /* 1) SPS 분해 — 총점만 보여주면 무엇을 고쳐야 할지 알 수 없다 */
    host.appendChild(el('h3', 'mb-2', 'Sailing Performance Score'));
    host.appendChild(el('div', 'text-secondary mb-3',
      'Speed is scored against what the lift calculator predicts is achievable '
      + 'for your weight, wing and skill in these conditions.'));
    if (!vps || vps.ok === false) {
      var warn = el('div', 'alert alert-warning');
      warn.textContent = 'Score unavailable'
        + (vps && vps.missing ? ' — needs ' + vps.missing.join(', ') : '');
      host.appendChild(warn);
    } else {
      var row = el('div', 'row row-cards');
      row.appendChild(segCard('Overall', vps.overall));
      row.appendChild(segCard('Upwind', vps.upwind));
      row.appendChild(segCard('Downwind', vps.downwind));
      host.appendChild(row);
    }

    /* 2) 윙 what-if */
    host.appendChild(el('h3', 'mt-4 mb-2', 'Wing size — what if'));
    if (!whatIf || whatIf.ok === false) {
      host.appendChild(el('div', 'text-secondary', 'Enter weight, wing size and wind speed above.'));
      return;
    }
    var summary = el('div', whatIf.recommendChange ? 'alert alert-info' : 'alert alert-success');
    var msg = 'You rode ' + whatIf.actualWingM2 + ' m². ';
    if (whatIf.recommendChange && whatIf.recommendedWingM2 != null) {
      msg += 'For these conditions ' + whatIf.recommendedWingM2 + ' m² is predicted to be faster upwind — '
           + '+' + whatIf.deltaVmgKt.toFixed(1) + ' kt VMG '
           + '(' + whatIf.actualVmgKt.toFixed(1) + ' → ' + whatIf.optimumVmgKt.toFixed(1) + ' kt).';
    } else {
      msg += 'That is already close to the predicted optimum for these conditions.';
    }
    summary.textContent = msg;
    host.appendChild(summary);
    host.appendChild(el('div', 'text-secondary mb-2',
      'Anchored to your measured upwind VMG of ' + whatIf.measuredVmgKt.toFixed(1)
      + ' kt, so the curve is scaled to what you actually achieved — not raw theory.'));

    var card = el('div', 'card');
    var ch = el('div', 'card-header');
    ch.appendChild(el('h3', 'card-title', 'Predicted upwind VMG by wing size'));
    ch.appendChild(el('div', 'card-actions lab', 'knots'));
    card.appendChild(ch);
    var cb = el('div', 'card-body');
    var plotHost = el('div', 'chart-host'); plotHost.id = 'chart-whatif';
    cb.appendChild(plotHost); card.appendChild(cb); host.appendChild(card);

    var pts = (whatIf.points || []).filter(function (p) { return p.feasible && p.vmgKt > 0; });
    if (pts.length < 2 || !window.uPlot) { plotHost.textContent = 'Not enough points'; return; }
    var xs = pts.map(function (p) { return p.area_m2; });
    var ys = pts.map(function (p) { return p.vmgKt; });
    track(new uPlot({
      width: plotHost.clientWidth || 800, height: 260, padding: [12, 14, 4, 6],
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: false } },
      axes: [
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return v + ' m²'; }); } },
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 42 }
      ],
      series: [
        { label: 'Wing', value: function (u, v) { return v == null ? '—' : v + ' m²'; } },
        { label: 'Upwind VMG', stroke: THEME.accent, width: 2.2,
          fill: 'rgba(77,171,247,0.14)',
          points: { show: true, size: 7 },
          value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } }
      ],
      hooks: { draw: [function (u) {
        var ctx = u.ctx;
        pts.forEach(function (p) {
          if (!p.isActual && !p.isOptimum) return;
          var cx = u.valToPos(p.area_m2, 'x', true), cy = u.valToPos(p.vmgKt, 'y', true);
          ctx.save();
          ctx.fillStyle = p.isOptimum ? '#2f9e44' : '#f59f00';
          ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e6edf5';
          ctx.font = '11px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(p.isOptimum ? 'optimum' : 'you rode', cx, cy - 12);
          ctx.restore();
        });
      }] }
    }, [xs, ys], plotHost), plotHost);
  }

  /* ---------- 트랙 지도 ---------- */
  var mapInst = null;
  function renderTrack(session, analysis) {
    var host = $('map-host');
    if (!host || !window.RDMapV2) return;
    if (mapInst && mapInst.map) { try { mapInst.map.remove(); } catch (e) {} }
    mapInst = RDMapV2.render(host, session, analysis, { height: 460 });
    var lg = $('map-legend');
    while (lg.firstChild) lg.removeChild(lg.firstChild);
    if (!mapInst) return;
    var prev = 0;
    mapInst.tiers.forEach(function (t) {
      var item = el('span', 'd-inline-flex align-items-center gap-1');
      var sw = el('span'); sw.style.cssText =
        'width:14px;height:6px;border-radius:2px;background:' + t.c;
      item.appendChild(sw);
      item.appendChild(el('span', null, t.max > 1000 ? prev + '+ kt' : prev + '–' + t.max + ' kt'));
      lg.appendChild(item); prev = t.max;
    });
    var m = el('span', 'd-inline-flex align-items-center gap-1 ms-2');
    var d1 = el('span'); d1.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#4dabf7';
    m.appendChild(d1); m.appendChild(el('span', null, 'tack'));
    lg.appendChild(m);
    var g = el('span', 'd-inline-flex align-items-center gap-1');
    var d2 = el('span'); d2.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#f76707';
    g.appendChild(d2); g.appendChild(el('span', null, 'gybe'));
    lg.appendChild(g);
  }

  /* ---------- 전체 ---------- */
  var CUR = { session: null, name: null, est: null };

  /* 풍향을 바꾸면 분석 전체를 다시 돌린다 — 택/자이브·VMG·폴라가 전부
     풍향에 매달려 있어서 부분 갱신은 틀린 화면을 만든다. */
  function applyWind(dir, mode) {
    if (!CUR.session) return;
    var est = CUR.est;
    if (mode === 'keep') {
      /* 풍향은 그대로 두고 라이더 입력만 반영해 다시 계산한다 */
      var keep = CUR.windDir != null ? CUR.windDir : null;
      var a0 = An.analyzeSession(CUR.session, keep, {});
      show(CUR.session, a0, CUR.name, CUR.est);
      return;
    }
    if (mode === 're-estimate') {
      try { est = An.estimateWindFromTrack(CUR.session); } catch (e) { est = null; }
      dir = est && est.windDir != null ? est.windDir : null;
    } else { est = null; }
    var a = An.analyzeSession(CUR.session, dir,
      est ? { windConfidence: est.confidence } : {});
    CUR.est = est;
    show(CUR.session, a, CUR.name, est);
  }

  function show(session, analysis, name, est) {
    CUR.session = session; CUR.name = name; CUR.est = est;
    CUR.windDir = analysis.windDir;
    CUR.analysis = analysis;
    CUR.vps = vps;
    plots.length = 0;
    $('hdr-title').textContent = name || 'Session';
    var d = session.startEpoch ? new Date(session.startEpoch) : null;
    $('hdr-date').textContent = d ? d.toISOString().slice(0, 10).replace(/-/g, '.') : '';
    $('nav-meta').textContent = (session.samples || []).length.toLocaleString() + ' points'
      + (analysis.windDir != null ? ' · wind ' + Math.round(analysis.windDir) + '°' : '');
    var vps = null;
    if (window.RDCoach && RDCoach.computeVPS) {
      try {
        vps = RDCoach.computeVPS(analysis, riderFromForm(), analysis.windDir, windSpeedFromForm());
      } catch (e) { vps = null; }
    }
    renderKpis(analysis, vps);
    var note = $('rider-note');
    if (note) note.textContent = (vps && vps.ok === false && vps.missing)
      ? 'Score needs: ' + vps.missing.join(', ')
      : 'Used by the performance score';
    if (window.RDMeanMax) {
      var mm = RDMeanMax.render($('chart-meanmax'), analysis, THEME);
      if (mm && mm.plot) track(mm.plot, $('chart-meanmax'));
    }
    renderHistogram(analysis);
    renderTimeline(session);
    renderTurns(analysis);
    renderTurnExtras(analysis);
    renderPerfExtra(analysis);
    renderSessions();
    renderPhysiology(analysis);
    renderEnvironment(analysis, est);
    renderTrack(session, analysis);
    var whatIf = null;
    if (window.RDCoach && RDCoach.computeWhatIf) {
      try { whatIf = RDCoach.computeWhatIf(analysis, riderFromForm(), windSpeedFromForm()); }
      catch (e) { whatIf = null; }
    }
    renderCoach(analysis, vps, whatIf);
  }

  /* ---------- 다중 파일 융합 (§430 재사용) ---------- */
  /* RaceBox 25Hz 로 트랙을, Waterspeed 로 심박을 — 같은 세션을 서로 다른
     기기가 따로 기록했을 때 하나로 합친다. primary 는 샘플레이트가 높은
     쪽이 자동 선택된다 (pickPrimary). */
  function readAllAsText(files, done) {
    var out = new Array(files.length), remaining = files.length, failed = false;
    if (!remaining) return done([], null);
    files.forEach(function (f, i) {
      var r = new FileReader();
      r.onerror = function () { if (!failed) { failed = true; done(null, f.name); } };
      r.onload = function () {
        out[i] = { name: f.name, text: String(r.result) };
        if (--remaining === 0 && !failed) done(out, null);
      };
      r.readAsText(f);
    });
  }

  function renderFusionBanner(fusion, warnings, fileNames) {
    var host = $('fusion-banner');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!fusion) return;
    var box = el('div', 'card mb-3');
    var b = el('div', 'card-body py-2');
    var head = el('div', 'd-flex align-items-center gap-2 flex-wrap');
    var tag = el('span', 'badge bg-blue', 'Merged');
    head.appendChild(tag);
    var p = fusion.primary || {};
    head.appendChild(el('span', null,
      'Track from ' + (p.fileName || 'primary')
      + (p.sampleRateHz ? ' · ' + p.sampleRateHz.toFixed(1) + ' Hz' : '')
      + (p.pointCount ? ' · ' + p.pointCount.toLocaleString() + ' points' : '')));
    b.appendChild(head);

    var lines = el('div', 'mt-1 text-secondary');
    lines.style.fontSize = '.8125rem';
    var parts = [];
    if (fusion.hr && fusion.hr.merged) {
      parts.push('heart rate from ' + (fusion.hr.fileName || fusion.hr.source)
        + (fusion.hrCoverage != null ? ' (' + Math.round(fusion.hrCoverage * 100) + '% coverage)' : ''));
    }
    if (fusion.imu && fusion.imu.merged) {
      parts.push('board attitude from ' + (fusion.imu.fileName || fusion.imu.source));
    }
    lines.textContent = parts.length
      ? 'Merged in: ' + parts.join(' · ')
      : 'No extra channels merged — single source only.';
    b.appendChild(lines);

    if (fileNames && fileNames.length > 1) {
      var fl = el('div', 'mt-1 text-secondary');
      fl.style.fontSize = '.75rem';
      fl.textContent = fileNames.length + ' files: ' + fileNames.join(', ');
      b.appendChild(fl);
    }
    if (warnings && warnings.length) {
      var w = el('div', 'mt-1');
      w.style.fontSize = '.8125rem';
      w.style.color = 'var(--tblr-warning)';
      w.textContent = 'Skipped: ' + warnings.map(function (x) {
        return x.file + ' (' + x.error + ')'; }).join(' · ');
      b.appendChild(w);
    }
    box.appendChild(b); host.appendChild(box);
  }

  function loadFiles(fileList) {
    var files = [].slice.call(fileList || []);
    if (!files.length) return;
    var textLike = files.filter(function (f) { return /\.(gpx|csv|tcx)$/i.test(f.name); });
    if (!textLike.length) {
      $('hdr-title').textContent = 'Unsupported file type';
      $('hdr-date').textContent = 'Upload .gpx, .csv or .tcx';
      return;
    }
    readAllAsText(textLike, function (loaded, err) {
      if (err) { $('hdr-title').textContent = 'Could not read ' + err; return; }
      /* 파일이 하나여도 융합 경로를 태운다 — 포맷 감지가 여기 있다
         (RaceBox CSV 는 GPX 파서로는 못 읽는다). */
      if (!window.RDSessionMerger) {
        if (loaded.length === 1) return loadGpxText(loaded[0].text,
          loaded[0].name.replace(/\.[^.]+$/, ''));
        $('hdr-title').textContent = 'Merger unavailable';
        return;
      }
      try {
        var res = RDSessionMerger.mergeFiles(loaded);
        var session = An.normalizeSession(res.parsed);
        var est = null;
        try { est = An.estimateWindFromTrack(session); } catch (e2) { est = null; }
        var wd = est && est.windDir != null ? est.windDir : null;
        var analysis = An.analyzeSession(session, wd,
          est ? { windConfidence: est.confidence } : {});
        var primary = res.fusion && res.fusion.primary;
        var name = (primary && primary.fileName)
          ? primary.fileName.replace(/\.[^.]+$/, '')
          : loaded[0].name.replace(/\.[^.]+$/, '');
        CUR.gpxText = null;
        loaded.forEach(function (l) {
          if (primary && l.name === primary.fileName && /\.gpx$/i.test(l.name)) CUR.gpxText = l.text;
        });
        show(session, analysis, name, est);
        renderFusionBanner(res.fusion, res.warnings,
          loaded.map(function (l) { return l.name; }));
      } catch (e) {
        $('hdr-title').textContent = 'Merge failed';
        $('hdr-date').textContent = (e && e.message) ? e.message : String(e);
        if (window.console) console.error('[v2] merge', e);
      }
    });
  }

  function loadGpxText(text, name) {
    CUR.gpxText = text;
    renderFusionBanner(null);
    var parsed = Gpx.parseGPX(text);
    var session = An.normalizeSession(parsed);
    /* 풍향이 없으면 택/자이브 분류·VMG·폴라가 전부 잠긴다.
       트랙에서 자동 추정해 기본값으로 쓰고, 추정임을 화면에 밝힌다. */
    var est = null;
    try { est = An.estimateWindFromTrack ? An.estimateWindFromTrack(session) : null; }
    catch (e) { est = null; }
    var wd = est && est.windDir != null ? est.windDir : null;
    var analysis = An.analyzeSession(session, wd, est ? { windConfidence: est.confidence } : {});
    show(session, analysis, name, est);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    var rp = $('btn-replay');
    if (rp) rp.addEventListener('click', function () {
      if (!CUR.session || !window.RDReplay) return;
      if (!CUR.session.hasTime) { rp.textContent = 'No time data';
        setTimeout(function () { rp.textContent = '▶ Replay'; }, 1800); return; }
      try {
        RDReplay.open({
          session: CUR.session, analysis: CUR.analysis,
          windDir: CUR.windDir, unit: 'kt',
          title: CUR.name || 'Session',
          onClose: function () {}
        });
      } catch (e) {
        rp.textContent = 'Replay failed';
        if (window.console) console.error('[v2] replay', e);
        setTimeout(function () { rp.textContent = '▶ Replay'; }, 2000);
      }
    });

    var sb = $('btn-save');
    if (sb) sb.addEventListener('click', function () {
      if (!CUR.session || !Store || !Store.saveSession) return;
      /* 실제 시그니처 = saveSession(meta, analysis) → { ok, error } */
      try {
        var res = Store.saveSession({
          name: CUR.name || 'Session',
          edited: false,
          dateEpoch: (CUR.session && CUR.session.startEpoch) || Date.now(),
          sport: 'wingfoil',
          windDir: CUR.windDir,
          windSpeedKt: windSpeedFromForm(),
          vps: CUR.vps && CUR.vps.ok !== false ? {
            overall: CUR.vps.overall && CUR.vps.overall.score,
            upwind: CUR.vps.upwind && CUR.vps.upwind.score,
            downwind: CUR.vps.downwind && CUR.vps.downwind.score,
            tack: CUR.vps.overall && CUR.vps.overall.tackScore,
            gybe: CUR.vps.overall && CUR.vps.overall.gybeScore
          } : null,
          gpxText: CUR.gpxText
        }, CUR.analysis);
        if (res && res.ok) {
          renderSessions();
          sb.textContent = 'Saved';
        } else {
          sb.textContent = 'Save failed';
          if (window.console) console.warn('[v2] save failed', res);
        }
      } catch (e) {
        sb.textContent = 'Save failed';
        if (window.console) console.error('[v2] save threw', e);
      }
      setTimeout(function () { sb.textContent = 'Save session'; }, 2000);
    });
    var rb = $('btn-rider');
    if (rb) rb.addEventListener('click', function () {
      if (!CUR.session) return;
      applyWind(CUR.est ? null : undefined, CUR.est ? 're-estimate' : 'keep');
    });
    $('v2-file').addEventListener('change', function (e) {
      loadFiles(e.target.files);
    });
    /* 드래그앤드롭도 받는다 — 파일 여러 개를 한 번에 던지는 게 자연스럽다 */
    ['dragover', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        e.preventDefault();
        if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files) {
          loadFiles(e.dataTransfer.files);
        }
      });
    });
    fetch('sample/sample-songjeong-busan.gpx')
      .then(function (r) { return r.text(); })
      .then(function (t) { loadGpxText(t, 'Songjeong, Busan'); })
      .catch(function (err) {
        $('hdr-title').textContent = 'Could not load the sample session';
        $('hdr-date').textContent = String(err && err.message ? err.message : err);
        if (window.console) console.error('[v2] sample load failed', err);
      });
  });
})();
