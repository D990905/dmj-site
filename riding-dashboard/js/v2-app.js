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
      ],
      hooks: {
        /* 드래그로 구간 선택 → 제외. uPlot 의 select 는 확대에 쓰이지만
           여기서는 편집 도구로 쓴다 (확대는 필요 없고 잘라내기가 필요하다). */
        setSelect: [function (u) {
          if (!u.select || u.select.width < 4) return;
          var a0 = u.posToVal(u.select.left, 'x');
          var a1 = u.posToVal(u.select.left + u.select.width, 'x');
          u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
          addExclusion(Math.min(a0, a1), Math.max(a0, a1));
        }]
      }
    }, [xs, ys], host), host);
    renderEditBar();
  }

  /* ---------- 트랙 편집 (구간 제외 · 되돌리기) ---------- */
  /* 편집은 항상 원본(fullSession)에 적용한다 — 편집본에 또 편집하면
     구간 좌표가 어긋난다. */
  function addExclusion(fromElapsed, toElapsed) {
    if (!CUR.fullSession) return;
    var t0 = CUR.fullSession.samples[0].t;
    CUR.edit = CUR.edit || { excludeRanges: [] };
    CUR.edit.excludeRanges.push({ from: t0 + fromElapsed, to: t0 + toElapsed });
    reapplyEdits();
  }
  function removeExclusion(i) {
    if (!CUR.edit || !CUR.edit.excludeRanges) return;
    CUR.edit.excludeRanges.splice(i, 1);
    reapplyEdits();
  }
  function resetEdits() { CUR.edit = null; reapplyEdits(); }

  function reapplyEdits() {
    if (!CUR.fullSession) return;
    var base = CUR.fullSession, sess = base;
    var hasEdit = CUR.edit && CUR.edit.excludeRanges && CUR.edit.excludeRanges.length;
    if (hasEdit) {
      try { sess = An.applyEdits(base, CUR.edit); }
      catch (e) { CUR.edit = null; sess = base; }
    }
    var est = CUR.est;
    var wd = CUR.windDir != null ? CUR.windDir : (est && est.windDir);
    var a = An.analyzeSession(sess, wd, est ? { windConfidence: est.confidence } : {});
    show(sess, a, CUR.name, est, base);
  }

  function renderEditBar() {
    var host = $('edit-bar');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    var ranges = (CUR.edit && CUR.edit.excludeRanges) || [];
    var hint = el('div', 'text-secondary');
    hint.style.fontSize = '.8125rem';
    hint.textContent = ranges.length
      ? ranges.length + ' segment' + (ranges.length > 1 ? 's' : '') + ' excluded — '
        + 'distance, speed and turn analysis are recomputed without them.'
      : 'Drag across the chart to exclude a segment (rest, drift, drive home).';
    host.appendChild(hint);
    if (!ranges.length) return;
    var t0 = CUR.fullSession ? CUR.fullSession.samples[0].t : 0;
    var list = el('div', 'd-flex flex-wrap gap-2 mt-2 align-items-center');
    ranges.forEach(function (r, i) {
      var chip = el('span', 'badge bg-orange-lt d-inline-flex align-items-center gap-2');
      chip.appendChild(el('span', 'num',
        fmtClock(r.from - t0) + ' – ' + fmtClock(r.to - t0)));
      var x = el('button', 'btn btn-sm btn-ghost-secondary p-0 px-1', '✕');
      x.type = 'button';
      x.addEventListener('click', function () { removeExclusion(i); });
      chip.appendChild(x);
      list.appendChild(chip);
    });
    var reset = el('button', 'btn btn-sm', 'Restore full track');
    reset.type = 'button';
    reset.addEventListener('click', resetEdits);
    list.appendChild(reset);
    host.appendChild(list);
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
    renderHrZones(host);
    renderHrEfficiency(host, hr.efficiency);
    renderSkillHr(host, a);
  }

  /* §450 심박 존 — 세션을 강도별로 나눈 시간 분포. 평균 심박 하나로는
     "고르게 중강도" 와 "쉬었다 몰아쳤다" 가 구분되지 않는다.
     경계는 %HRmax 기준이고, 사용자가 최대심박을 넣지 않으면 그 세션의
     관측 최대를 쓴다 — 그러면 존이 위로 눌리므로 근거를 함께 적는다. */
  function renderHrZones(host) {
    if (!An.computeHrZones || !CUR.session) return;
    /* 최대심박은 저장된 라이더 프로필에서 가져온다 — 기존 대시보드에서
       한 번 입력하면 여기서도 그대로 쓰인다. 없으면 엔진이 관측 최대로
       대체하고 그 사실을 maxHrSource 로 알려준다. */
    var maxHr = null;
    try {
      var rp = (window.RDStorage && RDStorage.loadRider) ? RDStorage.loadRider() : null;
      if (rp && rp.maxHr) maxHr = rp.maxHr;
    } catch (e) {}
    var z;
    try { z = An.computeHrZones(CUR.session, maxHr); } catch (e) { return; }
    if (!z || !z.hasHR || !z.zones || !z.zones.length) return;
    var total = z.totalSec || z.zones.reduce(function (t, x) { return t + x.seconds; }, 0);
    if (!(total > 0)) return;

    var ZL = { z1: 'Z1 Recovery', z2: 'Z2 Aerobic', z3: 'Z3 Tempo',
               z4: 'Z4 Threshold', z5: 'Z5 Anaerobic' };
    var ZC = { z1: '#4299e1', z2: '#38a169', z3: '#d69e2e',
               z4: '#dd6b20', z5: '#e53e3e' };

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Time in heart-rate zones'));
    head.appendChild(el('div', 'card-actions lab',
      'max HR ' + z.maxHrUsed + ' bpm · ' +
      (z.maxHrSource === 'user' ? 'entered' : 'observed in this session')));
    card.appendChild(head);
    var body = el('div', 'card-body');

    /* 가로 누적 막대 — 존별 비중을 한 줄로 */
    var bar = el('div', 'zone-bar');
    z.zones.forEach(function (x) {
      if (!(x.seconds > 0)) return;
      var seg = el('div', 'zone-bar__seg');
      seg.style.width = (100 * x.seconds / total) + '%';
      seg.style.background = ZC[x.key];
      seg.title = ZL[x.key] + ' — ' + fmtClock(x.seconds);
      bar.appendChild(seg);
    });
    body.appendChild(bar);

    var wrap = el('div', 'table-responsive mt-3');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Zone', 'Range', 'Time', 'Share'].forEach(function (x, i) {
      htr.appendChild(el('th', i ? 'text-end' : null, x));
    });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    z.zones.forEach(function (x) {
      var tr = el('tr');
      var nameTd = el('td');
      var sw = el('span', 'zone-sw');
      sw.style.background = ZC[x.key];
      nameTd.appendChild(sw);
      nameTd.appendChild(document.createTextNode(ZL[x.key]));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', 'text-end num text-secondary',
        x.loBpm + '–' + x.hiBpm + ' bpm'));
      tr.appendChild(el('td', 'text-end num', fmtClock(x.seconds)));
      tr.appendChild(el('td', 'text-end num',
        (100 * x.seconds / total).toFixed(1) + '%'));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    card.appendChild(body);
    host.appendChild(card);
  }

  /* 엔진의 회전 그룹 라벨은 한글이다(택킹 · 스타보드). 이 페이지는
     영어이므로 type/side 코드에서 직접 만든다. */
  function turnLabel(g) {
    var t = g.type === 'gybe' ? 'Gybe' : 'Tack';
    var side = g.side === 'P' ? 'port' : (g.side === 'S' ? 'starboard' : null);
    return side ? (t + ' · ' + side) : t;
  }

  /* §450 회전–심박 — 회전이 심박을 얼마나 올리고 얼마나 빨리 내려오는가.
     회복 지수(bpm/분)가 높을수록 심혈관 회복이 빠르다. 세션이 쌓이면
     장기 추세로 본다. 회전이 심박을 올리지 않은 경우(워밍업 등)는
     엔진이 회복 집계에서 뺀다. */
  function renderSkillHr(host, a) {
    if (!An.computeSkillHr || !CUR.session) return;
    var sk;
    try { sk = An.computeSkillHr(CUR.session, a.maneuvers || []); } catch (e) { return; }
    if (!sk || !sk.hasHR) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Turn effort & recovery'));
    head.appendChild(el('div', 'card-actions lab',
      (sk.analyzedCount || 0) + ' turns analysed'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    var row = el('div', 'row row-cards');
    function mini(label, val, sub) {
      var col = el('div', 'col-6 col-md-4');
      var c = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', label));
      b.appendChild(el('div', 'kpi__val num mt-1', val));
      if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
      c.appendChild(b); col.appendChild(c); return col;
    }
    row.appendChild(mini('Cruise HR',
      sk.cruiseHr != null ? String(Math.round(sk.cruiseHr)) : '—', 'bpm between turns'));
    var rec = sk.recovery || {};
    row.appendChild(mini('Recovery rate',
      rec.avgRateBpmMin != null ? rec.avgRateBpmMin.toFixed(1) : '—',
      'bpm/min · ' + (rec.n || 0) + ' turns counted'));
    var bg = sk.biggest;
    row.appendChild(mini('Hardest turn type',
      bg ? turnLabel(bg) : '—',
      bg && bg.riseBpm != null ? '+' + bg.riseBpm + ' bpm rise' : ''));
    body.appendChild(row);

    /* 종류·택별 묶음 — 어느 쪽 회전이 더 힘든지. 엔진 라벨은 한글이라
       (이 페이지는 영어) type·side 코드에서 직접 만든다. recoveryN 이
       0 이면 회복을 잴 만한 회전이 없었다는 뜻이라 값을 비운다. */
    var groups = sk.groups || [];
    if (groups.length) {
      var wrap = el('div', 'table-responsive mt-3');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['Turn', 'Count', 'Entry HR', 'Peak HR', 'Rise', 'Recovery'].forEach(function (x, i) {
        htr.appendChild(el('th', i ? 'text-end' : null, x));
      });
      th.appendChild(htr); t.appendChild(th);
      var tb = el('tbody');
      groups.forEach(function (g) {
        var tr = el('tr');
        tr.appendChild(el('td', null, turnLabel(g)));
        tr.appendChild(el('td', 'text-end num', String(g.n)));
        tr.appendChild(el('td', 'text-end num',
          g.entryHr != null ? g.entryHr + ' bpm' : '—'));
        tr.appendChild(el('td', 'text-end num',
          g.peakHr != null ? g.peakHr + ' bpm' : '—'));
        tr.appendChild(el('td', 'text-end num',
          g.riseBpm != null ? (g.riseBpm > 0 ? '+' : '') + g.riseBpm : '—'));
        tr.appendChild(el('td', 'text-end num',
          (g.recoveryN > 0 && g.recoveryRateBpmMin != null && g.recoveryRateBpmMin > 0)
            ? g.recoveryRateBpmMin.toFixed(1) + ' bpm/min'
            : '—'));
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    }
    card.appendChild(body);
    host.appendChild(card);
  }

  /* 추정 신뢰도 라벨 — 엔진은 한글을 돌려주는데 이 페이지는 영어다 */
  function confLabel(c) {
    return ({ '높음': 'high', '보통': 'medium', '낮음': 'low' })[c] || String(c);
  }
  /* 엔진 문구를 사전에 태워 영어로 바꾼다. 사전에 없으면 원문 그대로 —
     그때는 한글이 보이므로 사전에 항목을 추가해야 한다는 신호다. */
  function tr(txt) {
    if (!txt) return '';
    try { return (window.RDI18n && RDI18n.T) ? RDI18n.T(txt) : txt; }
    catch (e) { return txt; }
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
    /* 엔진 note 는 값을 끼워 만든 한글 문장이라 사전 번역이 안 된다
       (§452). 배너에는 구조화된 필드로 만든 영문만 쓰고, 자세한 근거는
       아래 'Wind direction sources' 표가 담당한다. */
    if (!est) {
      src.textContent = 'Currently ' + Math.round(a.windDir) + '° (manual)';
    } else {
      var line = 'Currently ' + Math.round(a.windDir) + '° from track estimate '
        + '· confidence ' + confLabel(est.confidence);
      if (est.agreement) {
        line += ' · two methods ' + (est.agreement.agree ? 'agree within ' : 'differ by ')
              + est.agreement.deltaDeg + '°';
      }
      src.textContent = line;
    }
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

    renderTargetComparison(host, a);
    renderWindSources(host, a);
  }

  /* §452 % of target — 오늘 속도를 "내가 낼 수 있다고 확인된 속도" 와
     비교한다. 기준선은 저장된 세션들의 각도별 상위 5% 를 누적한 개인
     베스트 곡선이고, 저장분이 없으면 이 세션 자신이 기준이 된다
     (그 경우 100% 근처가 나오는 게 당연하므로 근거를 함께 적는다). */
  function renderTargetComparison(host, a) {
    if (!An.sessionPolarProfile || !An.buildTargetPolar || !CUR.session) return;
    if (a.windDir == null) return;
    var cur;
    try { cur = An.sessionPolarProfile(CUR.session, a.windDir); } catch (e) { return; }
    if (!cur) return;

    /* 저장된 다른 세션의 폴라 프로파일 누적 — 같은 시작 시각은 같은
       세션이므로 뺀다(자기 자신과 비교하면 항상 100%). */
    var saved = [], curEpoch = CUR.session.startEpoch || 0;
    try {
      (window.RDStorage ? RDStorage.listSessions() : []).forEach(function (rec) {
        if (!rec.polarProfile || !rec.polarProfile.bins) return;
        if (curEpoch && rec.dateEpoch === curEpoch) return;
        saved.push(rec.polarProfile);
      });
    } catch (e) {}
    var basis = saved.length ? 'cumulative' : 'single-session';
    var target;
    try {
      target = An.buildTargetPolar(saved.length ? saved : [cur], { basis: basis });
    } catch (e) { return; }
    if (!target || (target.filledBins + target.interpolatedBins) < 2) return;

    var cmp;
    try { cmp = An.computeTargetComparison(CUR.session, a.windDir, target); } catch (e) { return; }
    if (!cmp) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Percent of target'));
    head.appendChild(el('div', 'card-actions lab',
      basis === 'cumulative'
        ? ('target from ' + saved.length + ' saved session' + (saved.length > 1 ? 's' : ''))
        : 'target from this session only'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    /* 기준선이 이 세션 자신이면 "내 오늘 최고 대비 오늘 평균" 이라
       세션 내부 일관성을 보는 것이고, 저장분이 쌓이면 "개인 최고 대비"
       가 된다. 둘은 읽는 의미가 다르므로 반드시 밝힌다. */
    if (basis === 'single-session') {
      body.appendChild(el('div', 'alert alert-info',
        'No other saved sessions yet, so the target is this session\u2019s own best '
        + '5% at each wind angle. That reads as consistency within today \u2014 how '
        + 'close your average was to your best. Save sessions and it becomes a '
        + 'personal-best comparison across days.'));
    }

    var row = el('div', 'row row-cards');
    [['Upwind', cmp.upwind], ['Downwind', cmp.downwind]].forEach(function (pair) {
      var col = el('div', 'col-md-6');
      var c = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', pair[0] + ' % of target'));
      var side = pair[1];
      if (!side || side.pctOfTarget == null) {
        b.appendChild(el('div', 'kpi__val num mt-1', '\u2014'));
        b.appendChild(el('div', 'kpi__sub mt-1', 'no comparable segments'));
      } else {
        b.appendChild(el('div', 'kpi__val num mt-1',
          Math.round(side.pctOfTarget) + '%'));
        var sub = (side.comparedTimeSec >= 60
          ? Math.round(side.comparedTimeSec / 60) + ' min'
          : Math.round(side.comparedTimeSec) + ' s') + ' compared';
        if (side.coverage < 0.995) {
          sub += ' \u00b7 target exists for ' + Math.round(side.coverage * 100) + '% of it';
        }
        b.appendChild(el('div', 'kpi__sub mt-1', sub));
      }
      c.appendChild(b); col.appendChild(c); row.appendChild(col);
    });
    body.appendChild(row);
    card.appendChild(body);
    host.appendChild(card);
  }

  /* §452 풍향 추정 — 두 독립 추정(노고존 · 회전 기하)을 돌려 융합한다.
     하나만 쓰면 그 방식의 약점이 곧 결과가 된다: 노고존만 쓰던 때
     8/30 세션이 '신뢰도 낮음' 이었는데 회전 기하는 '높음' 이었고 두 값이
     5° 안에서 일치했다(§449). 개별 추정치는 CUR 에 남겨 소스 비교표가
     쓴다. */
  function estimateWind(session) {
    var nogo = null, rot = null;
    try { nogo = An.estimateWindFromTrack ? An.estimateWindFromTrack(session) : null; }
    catch (e) { nogo = null; }
    try { rot = An.estimateWindFromManeuvers ? An.estimateWindFromManeuvers(session) : null; }
    catch (e) { rot = null; }
    CUR.windNogo = nogo; CUR.windRotation = rot;
    if (!An.buildWindSources) return nogo || rot;
    var ws = null;
    try { ws = An.buildWindSources({ nogo: nogo, rotation: rot }); } catch (e) { ws = null; }
    var rec = ws && ws.recommended;
    if (!rec || rec.windDir == null) return nogo || rot;
    return {
      windDir: rec.windDir, confidence: rec.confidence, note: rec.note,
      sourceId: rec.sourceId, agreement: ws.agreement
    };
  }

  /* §452 풍향 소스 비교 — 추정은 방식마다 약점이 다르다. 두 독립 추정을
     나란히 두고 얼마나 어긋나는지 보여주면, 하나만 믿는 것보다 낫다.
     (§449: 노고존만 쓰던 때 8/30 세션이 '낮음' 이었는데 회전 기하는
     '높음' 이었고 두 값은 5° 안에서 일치했다.) */
  function renderWindSources(host, a) {
    if (!An.buildWindSources) return;
    var nogo = CUR.windNogo || null, rot = CUR.windRotation || null;
    if (!nogo && !rot) return;
    var ws;
    try {
      ws = An.buildWindSources({
        manualDir: CUR.manualWindDir != null ? CUR.manualWindDir : null,
        nogo: nogo, rotation: rot
      });
    } catch (e) { return; }
    if (!ws) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Wind direction sources'));
    if (ws.agreement) {
      head.appendChild(el('div', 'card-actions lab',
        'two estimates differ by ' + ws.agreement.deltaDeg + '\u00b0'));
    }
    card.appendChild(head);

    var wrap = el('div', 'table-responsive');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Source', 'Direction', 'Confidence', 'How it works'].forEach(function (x, i) {
      htr.appendChild(el('th', i === 1 || i === 2 ? 'text-end' : null, x));
    });
    th.appendChild(htr); t.appendChild(th);
    var LABEL = {
      manual: 'Entered by you', nogo: 'No-go zone', rotation: 'Turn geometry',
      weather: 'Weather service', lineup: 'Line-up capture', imu: 'Watch IMU'
    };
    var HOW = {
      manual: 'What you typed in — treated as confirmed.',
      nogo: 'The empty wedge in the heading histogram: you cannot sail straight into wind.',
      rotation: 'Bisector of entry and exit headings across every detected tack and gybe.',
      weather: 'Not connected yet.',
      lineup: 'Not captured for this session.',
      imu: 'Not available.'
    };
    var tb = el('tbody');
    ws.sources.forEach(function (src) {
      if (src.windDir == null && src.available === false && src.id !== 'weather') return;
      var tr = el('tr');
      var isRec = ws.recommended && ws.recommended.sourceId === src.id;
      if (isRec) tr.className = 'table-active';
      var nameTd = el('td', null, LABEL[src.id] || src.id);
      if (isRec) nameTd.appendChild(el('span', 'badge bg-blue-lt ms-2', 'used'));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', 'text-end num',
        src.windDir == null ? '\u2014' : Math.round(src.windDir) + '\u00b0'));
      /* 엔진 신뢰도는 한글('높음')이다 — 이 페이지는 영어라 변환한다. */
      tr.appendChild(el('td', 'text-end',
        src.confidence ? confLabel(src.confidence) : '\u2014'));
      tr.appendChild(el('td', 'text-secondary', HOW[src.id] || ''));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);

    /* 엔진 note 는 값을 끼워 만든 한글 문장이라 사전으로 번역되지 않는다.
       구조화된 필드(agreement·confidence)에서 영문을 직접 만든다. */
    var msg = null;
    if (ws.agreement) {
      msg = ws.agreement.agree
        ? ('The two independent estimates agree within '
           + ws.agreement.deltaDeg + '\u00b0.')
        : ('The two independent estimates disagree by '
           + ws.agreement.deltaDeg + '\u00b0 \u2014 check the track and set the '
           + 'direction yourself if you know it.');
      if (ws.recommended && ws.recommended.confidence === '\ub0ae\uc74c') {
        msg += ' Both methods are weak on this session, so treat VMG, wind angle '
             + 'and the polar as indicative only.';
      }
    } else if (ws.recommended) {
      msg = 'Only one estimate could be made for this session.';
    }
    if (msg) {
      var f = el('div', 'card-footer text-secondary');
      f.style.fontSize = '.8125rem';
      f.textContent = msg;
      card.appendChild(f);
    }
    host.appendChild(card);
  }

  /* ---------- 고속 구간 (Run) · 퍼포먼스 통계 ---------- */
  function renderPerfExtra(a) {
    var host = $('perf-extra');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    renderTackDistribution(host, a);

    /* §450 Speed splits — mean-max 곡선이 모양을 보여주고, 이 표가 그
       곡선의 앵커 값을 숫자로 준다. Waterspeed 의 'Best Speed Splits'
       에 대응. alpha 는 500m 를 50m 게이트 안에서 돌아온 왕복 베스트로,
       속도만이 아니라 '돌아올 수 있는' 속도라 성격이 다르다. */
    var splitRows = [];
    (a.peaks || []).forEach(function (p) {
      splitRows.push({ label: p.windowSec + ' s', kind: 'time', ms: p.speedMs });
    });
    (a.distanceBests || []).forEach(function (d) {
      splitRows.push({
        label: d.distanceM === 1852 ? '1 NM' : d.distanceM + ' m',
        kind: 'distance', ms: d.speedMs
      });
    });
    if (a.alpha && a.alpha.speedMs > 0) {
      splitRows.push({
        label: 'Alpha ' + a.alpha.distanceM + ' m',
        kind: 'alpha', ms: a.alpha.speedMs,
        note: 'within ' + a.alpha.gateM + ' m gate'
      });
    }
    if (splitRows.length) {
      var sc = el('div', 'card');
      var sh = el('div', 'card-header');
      sh.appendChild(el('h3', 'card-title', 'Best speed splits'));
      sh.appendChild(el('div', 'card-actions lab', 'best sustained average'));
      sc.appendChild(sh);
      var sw = el('div', 'table-responsive');
      var st = el('table', 'table table-vcenter card-table table-sm');
      var sth = el('thead'), sthr = el('tr');
      ['Split', 'Type', 'Speed', 'km/h'].forEach(function (x, i) {
        sthr.appendChild(el('th', i ? 'text-end' : null, x));
      });
      sth.appendChild(sthr); st.appendChild(sth);
      var stb = el('tbody');
      var KIND = { time: 'duration', distance: 'distance', alpha: 'out & back' };
      splitRows.forEach(function (r) {
        var tr = el('tr');
        tr.appendChild(el('td', null, r.label));
        tr.appendChild(el('td', 'text-end text-secondary',
          KIND[r.kind] + (r.note ? ' · ' + r.note : '')));
        tr.appendChild(el('td', 'text-end num', (r.ms * KT).toFixed(2) + ' kt'));
        tr.appendChild(el('td', 'text-end num text-secondary',
          (r.ms * 3.6).toFixed(1)));
        stb.appendChild(tr);
      });
      st.appendChild(stb); sw.appendChild(st); sc.appendChild(sw);
      host.appendChild(sc);
    }

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

    /* 퍼포먼스 통계 — 지표 × 방향(풍상/풍하) 행, 포트/스타보드 열.
       ⚠ 엔진 행은 내부 구조체다 (key·tier50basis·direction 등). 그대로
       뿌리면 표가 아니라 덤프가 된다. 라벨도 엔진은 한글로 준다 —
       이 페이지는 영어이므로 metric 코드에서 자체 라벨을 만든다.
       그리고 speed 계열 값은 m/s 다. 반드시 노트로 변환한다. */
    if (!An.computeStatsPanel) return;
    var sp = null;
    try { sp = An.computeStatsPanel(a); } catch (e) { sp = null; }
    if (!sp || !sp.rows || !sp.rows.length) return;

    var METRIC_LABEL = {
      sog:  ['Speed (SOG)', 'kt'],
      vmg:  ['VMG', 'kt'],
      twa:  ['Course wind angle', '°'],
      awa:  ['Apparent wind angle', '°'],
      heel: ['Heel', '°'],
      pitch:['Pitch', '°'],
      hr:   ['Heart rate', 'bpm']
    };
    function fmtVal(row, v) {
      if (v == null || !isFinite(v)) return '—';
      if (row.unit === 'speed') return (v * KT).toFixed(1);
      if (row.unit === 'bpm') return String(Math.round(v));
      return v.toFixed(0);
    }

    /* metric → mode → side 로 접는다 */
    var byMetric = {}, order = [];
    sp.rows.forEach(function (r) {
      if (!byMetric[r.metric]) { byMetric[r.metric] = {}; order.push(r.metric); }
      var m = byMetric[r.metric];
      var mode = r.mode || 'all';
      if (!m[mode]) m[mode] = {};
      m[mode][r.side || '-'] = r;
    });

    var c2 = el('div', 'card mt-3');
    var h2 = el('div', 'card-header');
    h2.appendChild(el('h3', 'card-title', 'Performance statistics'));
    h2.appendChild(el('div', 'card-actions lab',
      'upwind ' + fmtClock(sp.upwindTimeSec) + ' · downwind ' + fmtClock(sp.downwindTimeSec)));
    c2.appendChild(h2);
    var wrap2 = el('div', 'table-responsive');
    var t2 = el('table', 'table table-vcenter card-table table-sm');

    var th2 = el('thead');
    var r1 = el('tr');
    var thM = el('th', null, 'Metric'); thM.rowSpan = 2; r1.appendChild(thM);
    var thD = el('th', null, 'Direction'); thD.rowSpan = 2; r1.appendChild(thD);
    var thP = el('th', 'text-center', 'Port'); thP.colSpan = 3; r1.appendChild(thP);
    var thS = el('th', 'text-center', 'Starboard'); thS.colSpan = 3; r1.appendChild(thS);
    th2.appendChild(r1);
    var r2 = el('tr');
    ['Avg', 'Best 50%', 'Best 20%', 'Avg', 'Best 50%', 'Best 20%'].forEach(function (x) {
      r2.appendChild(el('th', 'text-end lab', x));
    });
    th2.appendChild(r2); t2.appendChild(th2);

    var tb2 = el('tbody');
    order.forEach(function (metric) {
      var modes = byMetric[metric];
      var label = METRIC_LABEL[metric] || [metric, ''];
      var modeKeys = Object.keys(modes);
      modeKeys.forEach(function (mode, mi) {
        var tr = el('tr');
        if (mi === 0) {
          var tdM = el('td');
          tdM.rowSpan = modeKeys.length;
          tdM.appendChild(el('div', null, label[0]));
          tdM.appendChild(el('div', 'lab', label[1]));
          tr.appendChild(tdM);
        }
        tr.appendChild(el('td', null,
          mode === 'upwind' ? 'Upwind' : mode === 'downwind' ? 'Downwind' : 'All'));
        ['P', 'S'].forEach(function (side) {
          var row = modes[mode][side] || modes[mode]['-'];
          /* hr 처럼 좌우 구분이 없는 지표는 한 값을 양쪽에 두지 않고
             포트 칸에만 넣고 스타보드는 비운다 */
          var isShared = !modes[mode][side] && modes[mode]['-'];
          if (isShared && side === 'S') {
            tr.appendChild(el('td', 'text-end text-secondary', '—'));
            tr.appendChild(el('td', 'text-end text-secondary', '—'));
            tr.appendChild(el('td', 'text-end text-secondary', '—'));
            return;
          }
          if (!row) {
            tr.appendChild(el('td', 'text-end text-secondary', '—'));
            tr.appendChild(el('td', 'text-end text-secondary', '—'));
            tr.appendChild(el('td', 'text-end text-secondary', '—'));
            return;
          }
          tr.appendChild(el('td', 'text-end num', fmtVal(row, row.avg)));
          tr.appendChild(el('td', 'text-end num', fmtVal(row, row.tier50)));
          tr.appendChild(el('td', 'text-end num', fmtVal(row, row.tier20)));
        });
        tb2.appendChild(tr);
      });
    });
    t2.appendChild(tb2); wrap2.appendChild(t2); c2.appendChild(wrap2);
    var f2 = el('div', 'card-footer text-secondary');
    f2.style.fontSize = '.8125rem';
    f2.textContent = 'Averages are time-weighted. "Best" tiers reject noise — for wind angles '
      + 'that means the lowest angles upwind, the highest downwind.';
    c2.appendChild(f2);
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
    renderCareer(host);
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

    renderTurnGroups(host, a);
    renderTurnCoaching(host, a);
  }

  /* §453 회전 그룹 통계 — 개수만으로는 어느 쪽이 약한지 알 수 없다.
     효율·손실·회복을 택별로 갈라 본다. 효율은 회전 후 속도를 얼마나
     되찾았는가(%), 손실은 회전 동안 잃은 속도의 비율, 회복은 순항
     속도로 돌아오기까지 걸린 시간이다. 표본이 2~3 개인 그룹은 평균이
     흔들리므로 개수를 함께 적는다. */
  function renderTurnGroups(host, a) {
    var g = a.maneuverStats && a.maneuverStats.groups;
    if (!g) return;
    var rows = [];
    [['tack', 'Tack'], ['gybe', 'Gybe']].forEach(function (t) {
      var grp = g[t[0]];
      if (!grp) return;
      [['all', 'both'], ['P', 'port'], ['S', 'starboard']].forEach(function (sd) {
        var v = grp[sd[0]];
        if (!v || !v.count) return;
        rows.push({ label: t[1] + ' \u00b7 ' + sd[1], isAll: sd[0] === 'all', v: v });
      });
    });
    if (!rows.length) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Turn quality by group'));
    head.appendChild(el('div', 'card-actions lab',
      'efficiency = speed recovered after the turn'));
    card.appendChild(head);
    var wrap = el('div', 'table-responsive');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Group', 'Count', 'Efficiency', 'Top 50%', 'Top 20%', 'Speed loss', 'Recovery']
      .forEach(function (x, i) {
        htr.appendChild(el('th', i ? 'text-end' : null, x));
      });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      if (r.isAll) tr.className = 'table-active';
      tr.appendChild(el('td', null, r.label));
      tr.appendChild(el('td', 'text-end num', String(r.v.count)));
      function pct(x) { return x == null ? '\u2014' : Math.round(x) + '%'; }
      tr.appendChild(el('td', 'text-end num', pct(r.v.effAvg)));
      tr.appendChild(el('td', 'text-end num', pct(r.v.effTop50)));
      tr.appendChild(el('td', 'text-end num', pct(r.v.effTop20)));
      tr.appendChild(el('td', 'text-end num', pct(r.v.lossAvg)));
      tr.appendChild(el('td', 'text-end num',
        r.v.recAvg == null ? '\u2014' : r.v.recAvg.toFixed(1) + ' s'));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
    var f = el('div', 'card-footer text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = 'Groups with only two or three turns move a lot on one bad turn — '
      + 'read the count before the average.';
    card.appendChild(f);
    host.appendChild(card);
  }

  /* §452 커리어 — 저장된 세션을 통틀어 누적과 개인 최고. 한 세션만
     보면 오늘이 좋았는지 알 수 없다. 개인 최고는 그 기록이 나온 날짜를
     함께 적어야 의미가 있다(언제부터 안 깨졌는지). */
  function renderCareer(host) {
    if (!window.RDStorage || !RDStorage.careerStats) return;
    var career, pb;
    try {
      career = RDStorage.careerStats();
      pb = RDStorage.personalBests ? RDStorage.personalBests() : null;
    } catch (e) { return; }
    if (!career || !career.sessionCount) return;

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Career totals'));
    head.appendChild(el('div', 'card-actions lab',
      career.sessionCount + ' saved session' + (career.sessionCount > 1 ? 's' : '')));
    card.appendChild(head);
    var body = el('div', 'card-body');

    var row = el('div', 'row row-cards');
    function tile(label, val, sub) {
      var col = el('div', 'col-6 col-md-3');
      var c = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', label));
      b.appendChild(el('div', 'kpi__val num mt-1', val));
      if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
      c.appendChild(b); col.appendChild(c); return col;
    }
    row.appendChild(tile('Total distance',
      (career.totalDistanceM / 1000).toFixed(1) + ' km', 'across all sessions'));
    row.appendChild(tile('Total time',
      fmtClock(career.totalMovingSec || 0), 'moving time'));
    row.appendChild(tile('Sessions', String(career.sessionCount), 'saved'));
    row.appendChild(tile('Average speed',
      career.avgSpeedMs != null ? (career.avgSpeedMs * KT).toFixed(1) + ' kt' : '\u2014',
      'total distance \u00f7 total time'));
    body.appendChild(row);

    /* 개인 최고 — 값과 함께 언제 나왔는지 */
    var defs = [
      ['maxSpeedMs', 'Top speed', 'speed'],
      ['peak10sMs', 'Best 10 s', 'speed'],
      ['best500mMs', 'Best 500 m', 'speed'],
      ['distanceM', 'Longest ride', 'dist']
    ];
    var rows = defs.map(function (d) {
      var rec = pb && pb[d[0]];
      return (rec && rec.value) ? { def: d, rec: rec } : null;
    }).filter(Boolean);

    if (rows.length) {
      var wrap = el('div', 'table-responsive mt-3');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['Personal best', 'Value', 'Set on', 'Session'].forEach(function (x, i) {
        htr.appendChild(el('th', i === 1 ? 'text-end' : null, x));
      });
      th.appendChild(htr); t.appendChild(th);
      var tb = el('tbody');
      rows.forEach(function (r) {
        var tr = el('tr');
        tr.appendChild(el('td', null, r.def[1]));
        tr.appendChild(el('td', 'text-end num',
          r.def[2] === 'speed'
            ? (r.rec.value * KT).toFixed(1) + ' kt'
            : (r.rec.value / 1000).toFixed(2) + ' km'));
        var d = r.rec.dateEpoch ? new Date(r.rec.dateEpoch) : null;
        tr.appendChild(el('td', 'num text-secondary',
          d ? d.toISOString().slice(0, 10) : '\u2014'));
        tr.appendChild(el('td', 'text-secondary', r.rec.sessionName || '\u2014'));
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    }
    card.appendChild(body);
    host.appendChild(card);
  }

  /* §452 택별 분포 — 통계표는 평균·상위 50/20% 라는 '점' 을 주고,
     이 그림은 '퍼짐' 을 준다. 같은 평균이라도 고르게 낸 속도와 몰아친
     속도는 다른 문제다. 포트·스타보드를 위아래로 맞대어 좌우 비대칭을
     한눈에 본다(§421 이후 계속 문제였던 부분). */
  var TDIST = { metric: 'sog', mode: 'upwind' };

  function renderTackDistribution(host, a) {
    var ts = a.wind && a.wind.tackSplit;
    if (!ts) return;

    var card = el('div', 'card');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Distribution by tack'));
    var act = el('div', 'card-actions d-flex gap-2');

    function pick(list, key, cur, onPick) {
      var sel = el('select', 'form-select form-select-sm');
      sel.style.width = 'auto';
      list.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0]; op.textContent = o[1];
        if (o[0] === cur) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function () { onPick(sel.value); });
      return sel;
    }
    act.appendChild(pick([['sog', 'Speed'], ['vmg', 'VMG'], ['twa', 'Wind angle']],
      'metric', TDIST.metric, function (v) {
        TDIST.metric = v; renderPerfExtra(a);
      }));
    act.appendChild(pick([['upwind', 'Upwind'], ['downwind', 'Downwind']],
      'mode', TDIST.mode, function (v) {
        TDIST.mode = v; renderPerfExtra(a);
      }));
    head.appendChild(act);
    card.appendChild(head);

    var body = el('div', 'card-body');
    var side = ts[TDIST.mode];
    var P = (side && side.P && side.P.samples) || [];
    var S = (side && side.S && side.S.samples) || [];
    if (!P.length && !S.length) {
      body.appendChild(el('div', 'text-secondary',
        'No sustained ' + TDIST.mode + ' sailing in this session.'));
      card.appendChild(body); host.appendChild(card); return;
    }

    var M = TDIST.metric;
    /* 값 변환 — 속도·VMG 는 m/s 라 kt 로, 풍각은 절대값(부호는 택 구분). */
    function val(x) {
      var v = x[M];
      if (v == null || !isFinite(v)) return null;
      if (M === 'twa') return Math.abs(v);
      return Math.abs(v) * KT;
    }
    var pv = P.map(val).filter(function (v) { return v != null; });
    var sv = S.map(val).filter(function (v) { return v != null; });
    var all = pv.concat(sv);
    if (!all.length) {
      body.appendChild(el('div', 'text-secondary', 'No samples for this metric.'));
      card.appendChild(body); host.appendChild(card); return;
    }

    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (!(hi > lo)) { hi = lo + 1; }
    var NB = 26, w = (hi - lo) / NB;
    function hist(arr) {
      var h = new Array(NB).fill(0);
      arr.forEach(function (v) {
        var i = Math.min(NB - 1, Math.floor((v - lo) / w));
        h[i]++;
      });
      var mx = Math.max.apply(null, h) || 1;
      return h.map(function (c) { return c / mx; });
    }
    var hp = hist(pv), hs = hist(sv);

    /* 두 히스토그램을 같은 축에 위아래로 — 포트는 위, 스타보드는 아래 */
    var W = 640, H = 150, MID = H / 2, PAD = 26;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (H + PAD));
    svg.setAttribute('width', '100%');
    svg.style.maxWidth = W + 'px';
    function bars(h, up, color) {
      var bw = W / NB;
      h.forEach(function (f, i) {
        if (!(f > 0)) return;
        var bh = f * (MID - 6);
        var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', (i * bw + 0.8).toFixed(1));
        r.setAttribute('width', (bw - 1.6).toFixed(1));
        r.setAttribute('y', (up ? MID - bh : MID).toFixed(1));
        r.setAttribute('height', bh.toFixed(1));
        r.setAttribute('fill', color);
        r.setAttribute('opacity', '0.85');
        svg.appendChild(r);
      });
    }
    bars(hp, true, '#e03131');     /* 포트 = 적색 (국제 관례) */
    bars(hs, false, '#2f9e44');    /* 스타보드 = 녹색 */
    var axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', 0); axis.setAttribute('x2', W);
    axis.setAttribute('y1', MID); axis.setAttribute('y2', MID);
    axis.setAttribute('stroke', THEME.grid);
    svg.appendChild(axis);
    [0, 0.5, 1].forEach(function (f) {
      var tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', (f * W).toFixed(0));
      tx.setAttribute('y', H + 16);
      tx.setAttribute('fill', THEME.dim);
      tx.setAttribute('font-size', '11');
      tx.setAttribute('font-family', '"IBM Plex Mono", monospace');
      tx.setAttribute('text-anchor', f === 0 ? 'start' : (f === 1 ? 'end' : 'middle'));
      tx.textContent = (lo + f * (hi - lo)).toFixed(M === 'twa' ? 0 : 1)
        + (M === 'twa' ? '\u00b0' : ' kt');
      svg.appendChild(tx);
    });
    body.appendChild(svg);

    var leg = el('div', 'd-flex gap-4 mt-2');
    function chip(color, label, arr) {
      var d = el('div', 'd-flex align-items-center gap-2');
      var sw = el('span', 'zone-sw'); sw.style.background = color;
      d.appendChild(sw);
      var med = null;
      if (arr.length) {
        var v = arr.slice().sort(function (x, y) { return x - y; });
        med = v[v.length >> 1];
      }
      d.appendChild(el('span', 'text-secondary',
        label + ' \u00b7 ' + arr.length + ' samples'
        + (med != null ? ' \u00b7 median ' + med.toFixed(1) : '')));
      return d;
    }
    leg.appendChild(chip('#e03131', 'Port (above)', pv));
    leg.appendChild(chip('#2f9e44', 'Starboard (below)', sv));
    body.appendChild(leg);
    card.appendChild(body);
    host.appendChild(card);
  }

  /* §452 회전 코칭 — 규칙 엔진(RDCoach.computeTurnCoaching)이 이 세션의
     모든 회전을 보고 진단·조언을 낸다. 기존 대시보드는 회전을 클릭해야
     떴지만, 여기서는 세션 전체를 한 번에 넘겨 "오늘 회전에서 가장 큰
     문제" 를 바로 보여준다. 문구는 i18n 사전을 타므로 영어로 나온다. */
  function renderTurnCoaching(host, a) {
    if (!window.RDCoach || !RDCoach.computeTurnCoaching) return;
    var mans = a.maneuvers || [];
    if (!mans.length) return;
    var res;
    try {
      res = RDCoach.computeTurnCoaching(mans, a.windDir, a, riderFromForm(),
        { toSpeed: function (ms) { return ms * KT; }, speedUnit: 'kt' });
    } catch (e) { return; }
    if (!res || !res.ok) return;
    var comments = res.comments || [];
    if (!comments.length && !res.guard) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Turn coaching'));
    head.appendChild(el('div', 'card-actions lab', mans.length + ' turns reviewed'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    if (res.headline) {
      body.appendChild(el('div', 'fw-bold mb-3', tr(res.headline)));
    }
    /* guard = 표본 부족 등으로 진단을 보류한 사유. 조언보다 먼저 보여야
       사용자가 "왜 항목이 적은지" 를 안다. */
    if (res.guard) {
      body.appendChild(el('div', 'alert alert-info', tr(res.guard)));
    }
    var TONE = { warn: 'alert alert-warning', bad: 'alert alert-danger',
                 good: 'alert alert-success' };
    comments.forEach(function (c) {
      var box = el('div', (TONE[c.status] || 'alert alert-info') + ' mb-2');
      box.appendChild(el('div', 'fw-bold', tr(c.title)));
      if (c.numbers) box.appendChild(el('div', 'num mt-1', tr(c.numbers)));
      box.appendChild(el('div', 'mt-1', tr(c.diagnosis)));
      if (c.advice) box.appendChild(el('div', 'mt-1 text-secondary', tr(c.advice)));
      body.appendChild(box);
    });
    card.appendChild(body);
    host.appendChild(card);
  }

  /* ---------- 자세 (힐 · 피치) ---------- */
  var ATT_REASON = {
    'sensor-moved-during-session':
      'The sensor moved during the session — rest periods disagree by more than 25°. '
      + 'This happens when it comes off the board (for example carried on the body).',
    'implausible-after-calibration':
      'Calibrated pitch is outside a physically possible range, so the sensor was not '
      + 'lying flat on the board.',
    'no-rest-window':
      'No moment was found where the board floated still, so there is nothing to zero against. '
      + 'Look for a fall where the board stops and floats before you climb back on.',
    /* §451 — Bike Mode 는 정지 구간을 찾아도 소용이 없다. 가로 G 축을
       LeanAngle 로 대체해 내보내므로 힐의 원천 자체가 파일에 없다.
       그래서 다른 사유와 달리 "다음 촬영에서 바꿀 것" 을 지시한다. */
    'bike-mode':
      'This RaceBox file was exported in Bike Mode, which replaces the lateral G axis '
      + 'with a motorcycle lean angle. That lean angle is turn banking, not board heel '
      + '(measured correlation with yaw rate r=0.38), so heel cannot be recovered from '
      + 'this file. Turn Bike Mode off in the RaceBox app and re-export to get heel.',
    'no-board-reference': 'No board reference found.'
  };

  function renderAttitude(session, analysis, fusion) {
    var host = $('attitude-body');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    var cal = fusion && fusion.attitude;
    var S = (session.samples || []).filter(function (p) {
      return p.heel != null && p.pitch != null && p.speed != null && p.speed * KT > 10;
    });

    if (!S.length) {
      var box = el('div', 'alert alert-warning');
      box.appendChild(el('div', 'fw-bold', 'Board attitude is not available for this session'));
      /* 사유는 보정기 reason 보다 융합이 덮어쓴 값을 우선한다 —
         Bike Mode 는 보정기가 'no-rest-window' 로 보고하지만 실제
         원인은 그게 아니다(§451). */
      var reasonKey = (fusion && fusion.attitudeRejected)
        || (cal && cal.reason) || 'no-board-reference';
      var why = ATT_REASON[reasonKey] || ATT_REASON['no-board-reference'];
      box.appendChild(el('div', 'mt-1', why));
      box.appendChild(el('div', 'mt-2',
        'Speed, distance, turns and VMG are unaffected — only heel and pitch are missing.'));
      host.appendChild(box);
      return;
    }

    /* 보정 근거 */
    var note = el('div', 'alert alert-info');
    note.textContent = 'Zeroed against ' + (cal.samples || 0).toLocaleString()
      + ' of the quietest low-speed samples'
      + ' — heel ' + cal.heelOffset.toFixed(1) + '°, pitch ' + cal.pitchOffset.toFixed(1)
      + '° removed as mounting offset'
      + (cal.heelIqr != null ? ' (heel spread in those moments: ' + cal.heelIqr.toFixed(1) + '°)' : '')
      + '.';
    host.appendChild(note);

    function pct(arr, f) {
      var v = arr.slice().sort(function (a, b) { return a - b; });
      return v[Math.floor(v.length * f)];
    }
    function statRow(label, vals, unit) {
      var col = el('div', 'col-md-6');
      var card = el('div', 'card h-100');
      var h = el('div', 'card-header');
      h.appendChild(el('h3', 'card-title', label));
      h.appendChild(el('div', 'card-actions lab', 'while riding · 10 kt+'));
      card.appendChild(h);
      var b = el('div', 'card-body');
      var dl = el('div', 'datagrid');
      [['p5', 0.05], ['p25', 0.25], ['median', 0.5], ['p75', 0.75], ['p95', 0.95]].forEach(function (q) {
        var d = el('div', 'datagrid-item');
        d.appendChild(el('div', 'datagrid-title lab', q[0]));
        d.appendChild(el('div', 'datagrid-content num', pct(vals, q[1]).toFixed(1) + unit));
        dl.appendChild(d);
      });
      b.appendChild(dl);
      card.appendChild(b); col.appendChild(card); return col;
    }
    var heels = S.map(function (p) { return p.heel; });
    var pitches = S.map(function (p) { return p.pitch; });
    var row = el('div', 'row row-cards');
    row.appendChild(statRow('Heel', heels, '°'));
    row.appendChild(statRow('Pitch', pitches, '°'));
    host.appendChild(row);

    /* 좌우 비대칭 — 한쪽 택으로 더 깊게 눕는지 */
    var left = heels.filter(function (v) { return v < 0; });
    var right = heels.filter(function (v) { return v > 0; });
    if (left.length > 50 && right.length > 50) {
      var lDeep = Math.abs(pct(left, 0.05)), rDeep = pct(right, 0.95);
      var card2 = el('div', 'card mt-3');
      var h2 = el('div', 'card-header');
      h2.appendChild(el('h3', 'card-title', 'Left / right balance'));
      card2.appendChild(h2);
      var b2 = el('div', 'card-body');
      var bar = el('div', 'd-flex align-items-center gap-2');
      var lp = Math.round(left.length / heels.length * 100);
      var seg1 = el('div'); seg1.style.cssText =
        'height:14px;border-radius:3px 0 0 3px;background:#e03131;width:' + lp + '%';
      var seg2 = el('div'); seg2.style.cssText =
        'height:14px;border-radius:0 3px 3px 0;background:#2f9e44;width:' + (100 - lp) + '%';
      var wrap = el('div', 'flex-grow-1 d-flex');
      wrap.appendChild(seg1); wrap.appendChild(seg2);
      bar.appendChild(wrap);
      b2.appendChild(bar);
      var dl2 = el('div', 'datagrid mt-3');
      function it(k, v) {
        var d = el('div', 'datagrid-item');
        d.appendChild(el('div', 'datagrid-title lab', k));
        d.appendChild(el('div', 'datagrid-content num', v));
        dl2.appendChild(d);
      }
      it('Time heeled left', lp + '%');
      it('Time heeled right', (100 - lp) + '%');
      it('Deepest left', lDeep.toFixed(1) + '°');
      it('Deepest right', rDeep.toFixed(1) + '°');
      it('Difference', Math.abs(lDeep - rDeep).toFixed(1) + '°');
      b2.appendChild(dl2);
      card2.appendChild(b2);
      /* 옥대표(윙포일 실무): 좌우 힐 차이는 실제로 커봐야 3° 전후다.
         그보다 크게 나오면 스타일·해상 상태이거나 0점이 어긋난 것이다.
         대칭을 강제로 맞추지는 않는다 — 실제로 비대칭일 수 있다. */
      var diff = Math.abs(lDeep - rDeep);
      var f2 = el('div', 'card-footer text-secondary');
      f2.style.fontSize = '.8125rem';
      if (diff <= 3) {
        f2.textContent = 'Within 3° — balanced, and a sign the zero point is sound.';
      } else if (diff <= 8) {
        f2.textContent = 'Sides differ by ' + diff.toFixed(1) + '°. Real left/right difference is '
          + 'usually about 3° at most, so this is worth a look — it can be style or sea state, '
          + 'or the zero point may be slightly off.';
        f2.style.color = 'var(--tblr-warning)';
      } else {
        f2.textContent = 'Sides differ by ' + diff.toFixed(1) + '°, well beyond the ~3° that is '
          + 'normal. The zero point is probably wrong — the board may never have floated flat '
          + 'in this session. Treat the absolute heel numbers with caution.';
        f2.style.color = 'var(--tblr-danger)';
      }
      card2.appendChild(f2);
      host.appendChild(card2);
    }
    renderStability(host, session);
  }

  /* §451 안정성 — "보드가 얼마나 덜 흔들렸나" 와 "그게 속도·VMG 로
     이어졌나". 상·하위 25% 를 갈라 차이를 보여준다(상관계수보다 읽기
     쉽고, 두 집단에서 지표가 실제로 갈리지 않으면 엔진이 이득을 0 으로
     막는다 — §447 가짜 이득 방지). 힐·피치가 있어야 하므로 자세가 있는
     세션에서만 의미 있는 값이 나온다. */
  function renderStability(host, session) {
    if (!window.RDStability || !session) return;
    var st;
    try { st = RDStability.analyze(session); } catch (e) { return; }
    if (!st) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Board stability'));
    head.appendChild(el('div', 'card-actions lab',
      st.ok ? (st.segments + ' cruising windows') : 'not enough steady cruising'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    if (!st.ok) {
      body.appendChild(el('div', 'text-secondary',
        'Stability needs at least 12 windows of steady cruising above 12 kt with heel '
        + 'and pitch present. This session had ' + (st.segments || 0) + '.'));
      card.appendChild(body); host.appendChild(card); return;
    }

    var row = el('div', 'row row-cards');
    function mini(label, val, sub) {
      var col = el('div', 'col-6 col-md-3');
      var c = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', label));
      b.appendChild(el('div', 'kpi__val num mt-1', val));
      if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
      c.appendChild(b); col.appendChild(c); return col;
    }
    row.appendChild(mini('Pitch steadiness',
      st.pitchSd != null ? st.pitchSd.toFixed(2) + '\u00b0' : '\u2014', 'lower is steadier'));
    row.appendChild(mini('Heel steadiness',
      st.heelSd != null ? st.heelSd.toFixed(2) + '\u00b0' : '\u2014', 'lower is steadier'));
    row.appendChild(mini('Speed variation',
      st.speedCv != null ? (st.speedCv * 100).toFixed(1) + '%' : '\u2014', 'within a window'));
    row.appendChild(mini('Pitch rate',
      st.pitchRate != null ? st.pitchRate.toFixed(2) + '\u00b0/s' : '\u2014', 'porpoising proxy'));
    body.appendChild(row);

    var gaps = [
      { k: 'pitchVsSpeed', label: 'Steady pitch \u2192 speed', unit: '\u00b0', target: 'kt' },
      { k: 'heelVsVmg', label: 'Steady heel \u2192 VMG', unit: '\u00b0', target: 'kt VMG' },
      { k: 'heelVsSpeed', label: 'Steady heel \u2192 speed', unit: '\u00b0', target: 'kt' }
    ].filter(function (g) { return st[g.k] && st[g.k].stableTarget != null; });

    if (gaps.length) {
      var wrap = el('div', 'table-responsive mt-3');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['Relationship', 'Steadiest 25%', 'Roughest 25%', 'Difference'].forEach(function (x, i) {
        htr.appendChild(el('th', i ? 'text-end' : null, x));
      });
      th.appendChild(htr); t.appendChild(th);
      var tb = el('tbody');
      gaps.forEach(function (g) {
        var q = st[g.k], tr = el('tr');
        tr.appendChild(el('td', null, g.label));
        tr.appendChild(el('td', 'text-end num',
          q.stableMetric.toFixed(2) + g.unit + ' \u2192 ' + q.stableTarget.toFixed(1)));
        tr.appendChild(el('td', 'text-end num',
          q.roughMetric.toFixed(2) + g.unit + ' \u2192 ' + q.roughTarget.toFixed(1)));
        var d = el('td', 'text-end num');
        /* gain 0 = 두 집단에서 지표가 갈리지 않았다는 뜻. '0.0 kt' 로
           쓰면 측정된 0 처럼 읽히므로 문구로 구분한다. */
        d.textContent = (q.gain > 0)
          ? '+' + q.gain.toFixed(1) + ' ' + g.target
          : 'no separation';
        tr.appendChild(d);
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    }
    card.appendChild(body);
    host.appendChild(card);

    var tips = [];
    try { tips = RDStability.coach(session, st, tackHeelFromSession(session)) || []; } catch (e) {}
    tips.forEach(function (tip) {
      var box = el('div',
        tip.severity === 'high' ? 'alert alert-warning mt-3' : 'alert alert-info mt-3');
      box.appendChild(el('div', 'fw-bold', tip.title));
      box.appendChild(el('div', 'mt-1', tip.detail));
      if (tip.why) box.appendChild(el('div', 'mt-1 text-secondary', tip.why));
      host.appendChild(box);
    });
  }

  /* 택별 중앙 힐 — 좌우 불균형 코칭 트리거 입력. 순항(12kt+)만 본다. */
  function tackHeelFromSession(session) {
    var pv = [], sv = [];
    (session.samples || []).forEach(function (p) {
      if (p.heel == null || p.speed == null || p.twa == null) return;
      if (p.speed * KT < 12) return;
      (p.twa < 0 ? pv : sv).push(p.heel);
    });
    function md(a) {
      if (!a.length) return null;
      var v = a.slice().sort(function (x, y) { return x - y; });
      return v[v.length >> 1];
    }
    return { port: md(pv), starboard: md(sv) };
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
      est = estimateWind(CUR.session);
      dir = est && est.windDir != null ? est.windDir : null;
    } else { est = null; }
    var a = An.analyzeSession(CUR.session, dir,
      est ? { windConfidence: est.confidence } : {});
    CUR.est = est;
    show(CUR.session, a, CUR.name, est);
  }

  function show(session, analysis, name, est, fullSession) {
    CUR.fullSession = fullSession || CUR.fullSession || session;
    CUR.session = session; CUR.name = name; CUR.est = est;
    CUR.windDir = analysis.windDir;
    CUR.analysis = analysis;
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
    /* §452 — CUR.vps 는 여기서 담는다. 예전에는 이 계산보다 위에서
       담았는데, var 호이스팅 때문에 항상 undefined 가 들어가 세션을
       저장해도 SPS 가 null 로 기록됐다(시즌 흐름·저장 목록에서 SPS 가
       늘 비어 있던 원인). */
    CUR.vps = vps;
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
    populateReplayGhost();
    renderPhysiology(analysis);
    renderEnvironment(analysis, est);
    renderTrack(session, analysis);
    renderAttitude(session, analysis, CUR.fusion);
    var whatIf = null;
    if (window.RDCoach && RDCoach.computeWhatIf) {
      try { whatIf = RDCoach.computeWhatIf(analysis, riderFromForm(), windSpeedFromForm()); }
      catch (e) { whatIf = null; }
    }
    renderCoach(analysis, vps, whatIf);
  }

  /* 세션 시그니처 — 영상 blob·싱크 오프셋을 이 키로 저장한다.
     예전 페이지(app.js sessionSignature)와 동일한 식이어야 같은 영상이
     두 페이지에서 함께 보인다. */
  function sessionSig(sess) {
    if (!sess) return '';
    var sum = CUR.analysis && CUR.analysis.summary;
    var pts = sess.samples ? sess.samples.length : 0;
    var dist = sum ? sum.totalDistanceM : 0;
    return pts + '_' + Math.round(dist || 0) + '_' + (sess.startEpoch || 0);
  }

  /* §436 비교 세션(고스트) — 저장된 세션 중 고른 것을 함께 재생 */
  function buildGhost() {
    var sel = $('replay-ghost');
    if (!sel || sel.hidden || !sel.value || !Store || !Store.loadTrack) return null;
    var gpx = null;
    try { gpx = Store.loadTrack(sel.value); } catch (e) { gpx = null; }
    if (!gpx) return null;
    try {
      var gs = An.normalizeSession(Gpx.parseGPX(gpx));
      if (!gs || !gs.samples || !gs.samples.length || !gs.hasTime) return null;
      var opt = sel.options[sel.selectedIndex];
      return { session: gs, label: (opt && opt.textContent) || 'Comparison',
               color: '#B86BFF', mode: 'start' };
    } catch (e) { return null; }
  }

  function populateReplayGhost() {
    var sel = $('replay-ghost');
    if (!sel) return;
    var keep = sel.value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var none = document.createElement('option');
    none.value = ''; none.textContent = 'No comparison';
    sel.appendChild(none);
    var n = 0;
    listSessions().forEach(function (r) {
      if (!r || !r.hasTrack) return;
      var o = document.createElement('option');
      o.value = r.id; o.textContent = r.name || 'Session';
      sel.appendChild(o); n++;
    });
    sel.hidden = (n === 0);
    if (keep) sel.value = keep;
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
        var est = estimateWind(session);
        var wd = est && est.windDir != null ? est.windDir : null;
        var analysis = An.analyzeSession(session, wd,
          est ? { windConfidence: est.confidence } : {});
        var primary = res.fusion && res.fusion.primary;
        var name = (primary && primary.fileName)
          ? primary.fileName.replace(/\.[^.]+$/, '')
          : loaded[0].name.replace(/\.[^.]+$/, '');
        CUR.edit = null; CUR.fullSession = null;
        CUR.gpxText = null;
        loaded.forEach(function (l) {
          if (primary && l.name === primary.fileName && /\.gpx$/i.test(l.name)) CUR.gpxText = l.text;
        });
        CUR.fusion = res.fusion;
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
    CUR.edit = null; CUR.fullSession = null; CUR.fusion = null;
    renderFusionBanner(null);
    var parsed = Gpx.parseGPX(text);
    var session = An.normalizeSession(parsed);
    /* 풍향이 없으면 택/자이브 분류·VMG·폴라가 전부 잠긴다.
       트랙에서 자동 추정해 기본값으로 쓰고, 추정임을 화면에 밝힌다. */
    var est = estimateWind(session);
    var wd = est && est.windDir != null ? est.windDir : null;
    var analysis = An.analyzeSession(session, wd, est ? { windConfidence: est.confidence } : {});
    show(session, analysis, name, est);
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* 이 페이지는 영어다. 엔진이 돌려주는 안내문(풍향 추정 노트 등)은
       i18n 사전을 타므로 언어를 먼저 영어로 고정해야 한글이 새지 않는다. */
    try { localStorage.setItem('dmj_rd_lang', 'en'); } catch (e) {}
    if (window.RDI18n && RDI18n.T) {
      /* 이미 로드된 사전의 현재 언어도 맞춘다 */
      try { document.documentElement.lang = 'en'; } catch (e) {}
    }
    initTabs();
    var rp = $('btn-replay');
    if (rp) rp.addEventListener('click', function () {
      if (!CUR.session || !window.RDReplay) return;
      if (!CUR.session.hasTime) { rp.textContent = 'No time data';
        setTimeout(function () { rp.textContent = '▶ Replay'; }, 1800); return; }
      try {
        /* 예전 페이지가 넘기던 옵션을 전부 맞춘다. sessionSig 가 없으면
           영상 업로드·싱크 상태가 저장되지 않고, hasVideoFlag 가 없으면
           '이 기기에 영상 없음' 안내(§423)가 뜨지 않는다. */
        RDReplay.open({
          session: CUR.session,
          analysis: CUR.analysis,
          ghost: buildGhost(),
          windDir: CUR.windDir,
          unit: 'kt',
          sessionSig: sessionSig(CUR.session),
          title: CUR.name || 'Session',
          hasVideoFlag: CUR.hasVideoFlag || false,
          videoUploadedAt: CUR.videoUploadedAt || null,
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
  /* 편집을 코드에서도 걸 수 있게 최소 API 를 연다 — 자동 검증과
     추후 딥링크(공유 URL 에 제외 구간 담기)에 쓴다. */
  window.RDV2 = {
    addExclusion: addExclusion,
    removeExclusion: removeExclusion,
    resetEdits: resetEdits,
    getEdit: function () { return CUR.edit; },
    getSummary: function () {
      var s2 = CUR.analysis && CUR.analysis.summary;
      return s2 ? { distanceM: s2.totalDistanceM, movingSec: s2.movingTimeSec,
                    maxMs: s2.maxSpeedMs, points: CUR.session.samples.length } : null;
    }
  };
})();
