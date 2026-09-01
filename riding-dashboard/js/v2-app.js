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
    var r = { weightKg: isFinite(w) ? w : null, wingM2: isFinite(wing) ? wing : null,
              skill: sk || null };
    /* §482 — 고른 앞 포일의 실제 종횡비를 성능 모델에 넘긴다.
       옥대표: "바람이랑 윙사이즈만 보면 안되고 포일의 면적이나 종횡비를
       같이 봐야해." 장비 선택기는 R6 V1/V2/V3 의 AR(13.7·12.9·14.3)과
       면적을 이미 알고 있었는데, 코치는 그걸 못 받아 프로필 기본값
       6.5(일반 프리라이드 포일)로 계산하고 있었다 — 포일을 바꿔도
       예측이 한 톨도 안 변했다는 뜻이다.
       ⚠ 예측 풍상 VMG 가 올라가므로(약풍 +2kt, 중강풍 +0.7kt) 같은
       주행이라도 SPS 는 내려간다. 점수가 짜진 게 아니라 기준이 제
       장비로 맞춰진 것이고, 코치 패널이 어느 포일로 쟀는지 표기한다. */
    try {
      if (window.RDGear) {
        var f = RDGear.byId(RDGear.FRONT_WINGS, gearSelection().frontWing);
        if (f && f.ar > 0) { r.foilAR = f.ar; r.foilAreaCm2 = f.areaCm2; r.foilLabel = f.label; }
      }
    } catch (e) {}
    return r;
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
      tPct == null ? '' : tPct + '% of time analysed'));
    /* §459 — 분모는 '분석 대상 시간'이다. 기록 공백과 제외 구간을 뺀
       값으로, 이게 있어야 구간을 지운 효과가 정직하게 보인다.
       벽시계와 다르면 얼마가 빠졌는지 함께 적는다. */
    var analyzed = (s.analyzedDurationSec != null)
      ? s.analyzedDurationSec : s.totalDurationSec;
    var dropped = s.excludedSec || 0;
    host.appendChild(kpiCard('Moving time', fmtClock(s.movingTimeSec), '',
      'of ' + fmtClock(analyzed)
      + (dropped > 30 ? '  \u00b7 ' + fmtClock(dropped) + ' removed' : '')));

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
  var stackInst = null;
  function renderTimeline(session, analysis) {
    var host = $('chart-timeline');
    var S = session.samples || [];
    if (!host) return;
    if (stackInst) { try { stackInst.destroy(); } catch (e) {} stackInst = null; }
    if (!S.length || !window.uPlot || !window.RDChartStack) {
      host.textContent = 'No data'; return;
    }
    /* §473 — 지표마다 판을 나누되 x축(시간)은 하나로 공유한다. 두 축을
       한 판에 겹치면 교차점이 뜻을 갖는 것처럼 보이지만 아무 뜻도 없다. */
    stackInst = RDChartStack.render(host, session, analysis, {
      theme: THEME,
      readoutHost: $('timeline-readout'),
      onExclude: function (a, b) { addExclusion(a, b); }
    });
    /* §486 — 축이 벽시계가 아니라 '물 위에 있던 시간' 이라는 걸 밝힌다.
       접힌 시간이 있을 때만 적는다 — 없는데 적으면 군더더기다. */
    var act = document.querySelector('#chart-timeline')
      && document.querySelector('#chart-timeline').closest('.card');
    act = act && act.querySelector('.card-actions');
    if (act && stackInst && stackInst.series) {
      var rm = stackInst.series.removedSec || 0;
      act.textContent = rm > 30
        ? ('drag to select \u00b7 gaps closed \u2014 ' + RDChartStack.fmtClock(rm)
           + ' of stops and removed time folded out')
        : 'drag to select a range \u00b7 one shared time axis';
    }
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

  /* §487 — 문답 답변이 만든 제외구간을 수동 제외와 합친다. "옆에서
     봐주느라 천천히 다녔다" 는 답 하나가 그 구간을 성능 통계에서
     빼야 의미가 있다 — 답만 받고 숫자를 그대로 두면 물어본 보람이 없다. */
  function qaExclusions() {
    if (!window.RDStorage || !CUR.fullSession) return [];
    var sig = null;
    try { sig = sessionSig(CUR.fullSession); } catch (e) { return []; }
    if (!sig) return [];
    var answers = {};
    try { answers = RDStorage.loadSessionAnswers(sig) || {}; } catch (e) { return []; }
    var t0 = CUR.fullSession.samples[0].t;
    var out = [];
    Object.keys(answers).forEach(function (qid) {
      var a = answers[qid];
      if (!a || a.effect !== 'exclude') return;
      if (!(a.toSec > a.fromSec)) return;
      out.push({ from: t0 + a.fromSec, to: t0 + a.toSec, reason: qid });
    });
    return out;
  }

  function reapplyEdits() {
    if (!CUR.fullSession) return;
    var base = CUR.fullSession, sess = base;
    var manual = (CUR.edit && CUR.edit.excludeRanges) || [];
    var fromQa = qaExclusions();
    var allRanges = manual.concat(fromQa);
    var hasEdit = allRanges.length > 0;
    if (hasEdit) {
      try { sess = An.applyEdits(base, { excludeRanges: allRanges }); }
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
      : 'Drag across any panel to select a range \u2014 the averages for that '
        + 'stretch appear under the chart, with the option to exclude it.';
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

    renderPolarGrid(host, a);
    renderBinTable(host, a);
    renderCorrelation(host, a);
    renderGainLoss(host, a);
    renderWindVariation(host, a);
    renderTargetComparison(host, a);
    renderWindSources(host, a);
  }

  /* §463 — 파일을 열기만 해도 라이딩 부하를 원장에 남긴다.
     "세션 저장" 을 눌러야만 들어가면 훈련부하 추세가 비게 된다 — 부하는
     기록을 남기려고 타는 게 아니라 탔으니까 생기는 것이다.
     같은 파일을 여러 번 열어도 세션 시그니처로 한 번만 센다. 라이더
     프로필이 바뀌어 부하가 다시 계산되면 최신 값으로 덮어쓴다. */
  function autoRecordRideLoad() {
    if (!window.RDStorage || !RDStorage.recordRideLoad || !CUR.session) return;
    if (CUR.isDemo) return;              /* 데모 세션은 원장에 넣지 않는다 */
    var w = v2SessionWorkload();
    if (w.trimp == null) return;          /* 안정시 심박 등 입력 부족 */
    var sig = sessionSig(CUR.session);
    if (!sig) return;
    try {
      RDStorage.recordRideLoad({
        sig: sig,
        dateEpoch: CUR.session.startEpoch || Date.now(),
        name: CUR.name || 'Ride',
        AU: w.trimp, method: w.method
      });
    } catch (e) {}
  }

  /* §458 — 이 세션의 훈련부하. v2 에서 저장할 때도 기존 대시보드와
     같은 값이 기록돼야 한다(예전에는 v2 저장분만 부하가 null 이었다).
     안정시 심박·성별이 없으면 null 이 되고, 그 사실은 훈련부하 탭이
     안내한다. */
  function v2SessionWorkload() {
    if (!An || typeof An.computeWorkload !== 'function' || !CUR.session) {
      return { trimp: null, method: null };
    }
    var rp = {};
    try { rp = (window.RDStorage && RDStorage.loadRider) ? (RDStorage.loadRider() || {}) : {}; }
    catch (e) { rp = {}; }
    var w = null;
    try { w = An.computeWorkload(CUR.session, rp); } catch (e) { w = null; }
    if (!w || w.AU == null) return { trimp: null, method: null };
    return { trimp: w.AU, method: w.method };
  }

  /* ===================== §457 훈련부하 =====================
     라이딩과 육상 운동을 하나의 원장에 합쳐 체력(CTL)·피로(ATL)·
     컨디션(TSB) 추세를 내고, 오늘 무엇을 할지 제안한다.

     ⚠ 급성:만성 비율(ACWR)의 "0.8~1.3 안전구간" 은 학계 논란 중이라
     여기서는 규칙이 아니라 **모니터링 신호**로만 쓴다. 화면에도 그렇게
     적는다 — 숫자 하나로 훈련을 금지하지 않는다. */

  /* MET 라이브러리의 description 은 한글이다(엔진은 한국어 페이지가
     주 사용처). 이 페이지는 영어이므로 sportKey 에서 라벨을 만든다 —
     키가 이미 영어라 사전을 따로 둘 필요가 없다. */
  var SPORT_WORD = {
    hiit: 'HIIT', crossfit: 'CrossFit', sup: 'SUP',
    run: 'Run', cycle: 'Cycle', row: 'Row', swim: 'Swim', hike: 'Hike',
    walk: 'Walk', elliptical: 'Elliptical', strength: 'Strength',
    yoga: 'Yoga', pilates: 'Pilates', mobility: 'Mobility',
    stretching: 'Stretching'
  };
  function sportLabel(key) {
    if (!key) return '\u2014';
    var parts = String(key).split('_');
    var head = SPORT_WORD[parts[0]] ||
      (parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
    if (parts.length === 1) return head;
    var tail = parts.slice(1).join(' ').replace(/-/g, '\u2013');
    return head + ' \u00b7 ' + tail;
  }

  function riderProfile() {
    var rp = {};
    try {
      rp = (window.RDStorage && RDStorage.loadRider) ? (RDStorage.loadRider() || {}) : {};
    } catch (e) { rp = {}; }
    var w = parseFloat(($('in-weight') || {}).value);
    if (isFinite(w)) rp.weightKg = w;
    return rp;
  }

  /* 급성:만성 비율은 만성(28일) 쪽이 실제로 28일에 걸쳐 쌓였을 때만
     뜻이 있다. 기록이 5일뿐이면 분모가 거의 0 이라 비율이 4.0 처럼
     튀고, 그걸 그대로 넘기면 "부상 위험" 경고가 오작동한다(실측).
     충분히 쌓이기 전에는 아예 null 로 두어 판정에서 뺀다. */
  var ACWR_MIN_DAYS = 21;
  function acwrIfMeaningful(ledger) {
    if (!ledger || !ledger.length) return null;
    var spanDays = (Date.now() - ledger[0].dateEpoch) / 86400000;
    if (spanDays < ACWR_MIN_DAYS) {
      return { ratio: null, tooShort: true, spanDays: spanDays };
    }
    try { return RDStorage.computeACWR(ledger); } catch (e) { return null; }
  }

  function renderTraining() {
    var host = $('training-body');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!window.RDStorage || !RDStorage.loadLedger) {
      host.appendChild(el('div', 'text-secondary', 'Storage module unavailable.'));
      return;
    }
    var ledger = RDStorage.loadLedger();
    var rp = riderProfile();

    renderPhysioInputs(host, rp);
    renderLoadInputsNotice(host, rp, ledger);
    renderTrainingState(host, ledger);
    renderWorkoutForm(host, rp);
    renderTodaySuggestion(host, ledger, rp);
    renderLedgerTable(host, ledger);
  }

  /* §458 생리 입력 — 최대심박·안정시심박·성별·체중.
     이 네 개가 심박 존과 훈련부하의 전제다. 예전에는 기존 대시보드의
     심박 카드에만 있어서, v2 만 쓰는 사람은 넣을 방법이 없었다.
     저장소를 공유하므로 어느 쪽에서 넣든 양쪽에 적용된다.

     ⚠ 최대심박은 **실측값**을 넣어야 한다. 비워 두면 그 세션의 관측
     최대를 쓰는데, 그러면 범위가 눌려 존이 통째로 위로 밀린다
     (실측: 관측 174 로 보면 Z5 54.5%, 실측 194 로 보면 Z5 0%). */
  /* 최대심박이 바뀌면 심박 존도 다시 그려야 한다 — 존 경계가 %HRmax
     기준이라 이 값 하나로 전부 이동한다. 훈련부하 탭만 갱신하면 두
     화면이 서로 다른 최대심박으로 그려진 채 남는다. */
  function afterPhysioChange() {
    renderTraining();
    if (CUR.analysis) {
      try { renderPhysiology(CUR.analysis); } catch (e) {}
    }
  }

  function renderPhysioInputs(host, rp) {
    var card = el('div', 'card');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Your numbers'));
    head.appendChild(el('div', 'card-actions lab',
      'shared with the old dashboard'));
    card.appendChild(head);
    var body = el('div', 'card-body');
    var row = el('div', 'row g-2 align-items-end');

    function num(label, key, min, max, hint) {
      var col = el('div', 'col-6 col-md-3');
      col.appendChild(el('label', 'form-label lab', label));
      var i = el('input', 'form-control');
      i.type = 'number'; i.min = String(min); i.max = String(max);
      i.value = (rp[key] != null) ? rp[key] : '';
      i.addEventListener('change', function () {
        var v = parseFloat(i.value);
        var cur = {};
        try { cur = RDStorage.loadRider() || {}; } catch (e) {}
        cur[key] = (isFinite(v) && v >= min && v <= max) ? v : null;
        try { RDStorage.saveRider(cur); } catch (e) {}
        afterPhysioChange();
      });
      col.appendChild(i);
      if (hint) col.appendChild(el('div', 'form-hint', hint));
      return col;
    }
    row.appendChild(num('Max heart rate', 'maxHr', 100, 240,
      'measured, not 220 minus age'));
    row.appendChild(num('Resting heart rate', 'restHr', 30, 120,
      'on waking, lying still'));

    var sexCol = el('div', 'col-6 col-md-3');
    sexCol.appendChild(el('label', 'form-label lab', 'Sex'));
    var sexSel = el('select', 'form-select');
    [['', 'Not set'], ['male', 'Male'], ['female', 'Female']].forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      if ((rp.sex || '') === o[0]) op.selected = true;
      sexSel.appendChild(op);
    });
    sexSel.addEventListener('change', function () {
      var cur = {};
      try { cur = RDStorage.loadRider() || {}; } catch (e) {}
      cur.sex = sexSel.value || null;
      try { RDStorage.saveRider(cur); } catch (e) {}
      afterPhysioChange();
    });
    sexCol.appendChild(sexSel);
    sexCol.appendChild(el('div', 'form-hint', 'used by the load coefficient only'));
    row.appendChild(sexCol);

    row.appendChild(num('Weight (kg)', 'weightKg', 30, 200,
      'for activity-based load'));
    body.appendChild(row);

    if (!(rp.maxHr > 0)) {
      body.appendChild(el('div', 'alert alert-warning mt-3',
        'Without a measured max heart rate every session falls back to its own '
        + 'highest reading, which compresses the range and pushes the zones '
        + 'upward \u2014 a hard session can read as if most of it was anaerobic '
        + 'when it was not.'));
    }
    card.appendChild(body);
    host.appendChild(card);
  }

  /* 부하가 왜 비어 있는지 — 라이딩 세션은 안정시 심박·성별이 있어야
     심박 기반 부하가 나온다. 그게 없으면 원장에 라이딩이 안 들어온다. */
  function renderLoadInputsNotice(host, rp, ledger) {
    var miss = [];
    if (!(rp.restHr > 0)) miss.push('resting heart rate');
    if (!rp.sex) miss.push('sex');
    if (!(rp.maxHr > 0)) miss.push('measured max heart rate');
    var rides = ledger.filter(function (x) { return x.kind === 'ride'; }).length;
    if (!miss.length && rides) return;
    var box = el('div', 'alert alert-info');
    if (miss.length) {
      box.appendChild(el('div', 'fw-bold', 'Rides need a few numbers before they carry a load'));
      box.appendChild(el('div', 'mt-1',
        'Missing: ' + miss.join(', ') + '. Enter them once in the old dashboard\u2019s '
        + 'heart-rate card and every saved ride from then on gets a training load. '
        + 'Without them a ride is stored with no load at all, so the trend below '
        + 'stays flat.'));
    } else {
      box.appendChild(el('div', 'fw-bold', 'No rides carry a load yet'));
      box.appendChild(el('div', 'mt-1',
        'Save a session after entering resting heart rate and sex, and it will appear here.'));
    }
    host.appendChild(box);
  }

  /* 체력·피로·컨디션 + 급성:만성 */
  function renderTrainingState(host, ledger) {
    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Fitness, fatigue and form'));
    head.appendChild(el('div', 'card-actions lab',
      ledger.length + ' logged item' + (ledger.length === 1 ? '' : 's')));
    card.appendChild(head);
    var body = el('div', 'card-body');

    if (!ledger.length) {
      body.appendChild(el('div', 'text-secondary',
        'Nothing logged yet. Save a ride, or add a land workout below.'));
      card.appendChild(body); host.appendChild(card); return;
    }

    var trend = null;
    try {
      trend = RDStorage.computeFitnessTrend(ledger, { endDate: Date.now() });
    } catch (e) {}
    var cur = trend && trend.current;
    var acwr = acwrIfMeaningful(ledger);

    var row = el('div', 'row row-cards');
    function tile(label, val, sub) {
      var col = el('div', 'col-6 col-md-3');
      var c = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', label));
      b.appendChild(el('div', 'kpi__val num mt-1', val));
      if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
      c.appendChild(b); col.appendChild(c); return col;
    }
    row.appendChild(tile('Fitness (CTL)',
      cur ? cur.CTL.toFixed(0) : '\u2014', '42-day average load'));
    row.appendChild(tile('Fatigue (ATL)',
      cur ? cur.ATL.toFixed(0) : '\u2014', '7-day average load'));
    row.appendChild(tile('Form (TSB)',
      cur ? (cur.TSB > 0 ? '+' : '') + cur.TSB.toFixed(0) : '\u2014',
      'fitness minus fatigue'));
    row.appendChild(tile('Acute : chronic',
      (acwr && acwr.ratio != null) ? acwr.ratio.toFixed(2) : '\u2014',
      (acwr && acwr.tooShort)
        ? 'needs ' + ACWR_MIN_DAYS + '+ days of history'
        : 'a signal, not a rule'));
    body.appendChild(row);

    /* 한 달이 안 되면 CTL 이 아직 오르는 중이라 값을 단정하면 안 된다. */
    var span = ledger.length
      ? (Date.now() - ledger[0].dateEpoch) / 86400000 : 0;
    if (span < 28) {
      body.appendChild(el('div', 'alert alert-warning mt-3',
        'Only ' + Math.max(1, Math.round(span)) + ' days of history. Fitness is a '
        + '42-day average, so it is still climbing from zero and will read low '
        + 'until about four weeks have accumulated. Treat these numbers as a '
        + 'starting baseline, not a verdict.'));
    }
    card.appendChild(body);
    host.appendChild(card);
  }

  /* 육상 운동 기록 — 부하 계산은 엔진(computeWorkload)에 맡긴다. */
  function renderWorkoutForm(host, rp) {
    if (!window.RDSportMET) return;
    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Log a land workout'));
    head.appendChild(el('div', 'card-actions lab', 'anything that is not sailing'));
    card.appendChild(head);
    var body = el('div', 'card-body');
    var row = el('div', 'row g-2 align-items-end');

    function field(label, node, cls) {
      var col = el('div', cls || 'col-6 col-md-3');
      col.appendChild(el('label', 'form-label lab', label));
      col.appendChild(node);
      return col;
    }
    var dateIn = el('input', 'form-control');
    dateIn.type = 'date';
    dateIn.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);

    var sportSel = el('select', 'form-select');
    var LIB = RDSportMET.LIBRARY || {};
    var byCat = {};
    Object.keys(LIB).forEach(function (k) {
      var c = LIB[k].category;
      if (c === 'sailing') return;        /* 세일링은 세션 업로드로 들어온다 */
      (byCat[c] = byCat[c] || []).push(k);
    });
    Object.keys(byCat).forEach(function (c) {
      var g = document.createElement('optgroup');
      g.label = c;
      byCat[c].forEach(function (k) {
        var o = document.createElement('option');
        o.value = k;
        o.textContent = sportLabel(k) + '  (MET ' + LIB[k].met + ')';
        g.appendChild(o);
      });
      sportSel.appendChild(g);
    });

    var durIn = el('input', 'form-control');
    durIn.type = 'number'; durIn.min = '5'; durIn.max = '600'; durIn.value = '45';

    var rpeIn = el('input', 'form-control');
    rpeIn.type = 'number'; rpeIn.min = '1'; rpeIn.max = '10'; rpeIn.placeholder = 'optional';

    row.appendChild(field('Date', dateIn));
    row.appendChild(field('Activity', sportSel, 'col-12 col-md-4'));
    row.appendChild(field('Minutes', durIn, 'col-6 col-md-2'));
    row.appendChild(field('Effort 1\u201310', rpeIn, 'col-6 col-md-2'));

    var btnCol = el('div', 'col-12 mt-2');
    var btn = el('button', 'btn btn-primary', 'Add workout');
    btn.type = 'button';
    var msg = el('span', 'ms-3 text-secondary');
    btnCol.appendChild(btn); btnCol.appendChild(msg);
    row.appendChild(btnCol);
    body.appendChild(row);

    body.appendChild(el('div', 'text-secondary mt-3',
      'Effort is optional. With it the load is scored from how hard it felt, which '
      + 'is the only way strength work counts properly \u2014 heart rate barely moves '
      + 'under a barbell. Without it the load comes from the activity\u2019s standard '
      + 'metabolic cost and your body weight.'));

    btn.addEventListener('click', function () {
      var mins = parseFloat(durIn.value);
      if (!(mins > 0)) { msg.textContent = 'Enter the duration.'; return; }
      var rpe = parseFloat(rpeIn.value);
      var pseudo = { sportKey: sportSel.value, durationMin: mins };
      if (isFinite(rpe) && rpe >= 1 && rpe <= 10) pseudo.rpe = rpe;
      /* 체감강도를 적었으면 그것을 우선한다. computeWorkload 는 MET
         단계를 먼저 시도하는데, 웨이트처럼 심박·MET 이 실제 부하를
         못 잡는 운동에서는 체감강도가 유일하게 정직한 입력이다. */
      var w = null;
      try {
        w = pseudo.rpe
          ? An.computeWorkload(pseudo, rp, { forceTier: 'srpe' })
          : An.computeWorkload(pseudo, rp);
      } catch (e) { w = null; }
      if (!w || w.AU == null) {
        msg.textContent = 'Could not score that workout.';
        return;
      }
      var d = dateIn.value ? new Date(dateIn.value + 'T12:00:00') : new Date();
      var res = RDStorage.saveWorkout({
        dateEpoch: d.getTime(), sportKey: pseudo.sportKey,
        durationMin: mins, rpe: pseudo.rpe || null,
        AU: w.AU, method: w.method
      });
      if (!res.ok) { msg.textContent = res.error || 'Save failed.'; return; }
      renderTraining();
    });

    card.appendChild(body);
    host.appendChild(card);
  }

  /* 오늘의 제안 — 회복 상태 판정 + 부족분을 채울 육상 운동 */
  function renderTodaySuggestion(host, ledger, rp) {
    if (!window.RDCoach || !RDCoach.decideRecoveryAction) return;
    var trend = null;
    try { trend = RDStorage.computeFitnessTrend(ledger, { endDate: Date.now() }); } catch (e) {}
    var acwr = acwrIfMeaningful(ledger);
    var cur = trend && trend.current;
    if (!cur) return;

    var decision = null;
    try {
      decision = RDCoach.decideRecoveryAction({
        tsb: cur.TSB,
        acwr: (acwr && acwr.ratio != null) ? acwr.ratio : null
      });
    } catch (e) {}
    if (!decision) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'What to do today'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    /* 엔진의 label·recommendation·note 는 한글이다. 이 페이지는 영어라
       action 코드에서 영문을 만든다 — 값을 끼워 만든 문장이라 사전
       번역이 되지 않는다(§452 와 같은 이유). */
    var ACT = {
      full_ride: { tone: 'alert-success', head: 'Full session is fine',
        body: 'Ride at full intensity. Good conditions are worth pushing into '
            + 'z3\u2013z4; go after turn quality and a distance best.' },
      moderate: { tone: 'alert-info', head: 'Ride, but keep it moderate',
        body: 'Stay mostly in z2\u2013z3 and keep the session shorter than usual. '
            + 'Technique work over top-end speed.' },
      active_recovery: { tone: 'alert-warning', head: 'Active recovery',
        body: 'Either skip the water or keep it to a light z1 cruise of about 30 '
            + 'minutes. Mobility or yoga for half an hour is the better use of '
            + 'today. Reassess tomorrow.' },
      rest: { tone: 'alert-danger', head: 'Rest',
        body: 'No training load today. Sleep, food and easy movement only.' }
    };
    var act = ACT[decision.action] || ACT.moderate;
    var box = el('div', 'alert ' + act.tone);
    box.appendChild(el('div', 'fw-bold', act.head));
    box.appendChild(el('div', 'mt-1', act.body));
    body.appendChild(box);

    /* 판정 근거 — 어떤 지표가 어떤 색이었는지 */
    var facs = decision.contributing_factors || [];
    if (facs.length) {
      var wrap = el('div', 'table-responsive mt-2');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['Signal', 'Value', 'Reading'].forEach(function (x, i) {
        htr.appendChild(el('th', i === 1 ? 'text-end' : null, x));
      });
      th.appendChild(htr); t.appendChild(th);
      var tb = el('tbody');
      /* 판정 문구도 영문으로 — 코드가 아니라 값 구간으로 다시 만든다. */
      function reading(f) {
        var v = Number(f.value);
        if (f.factor === 'TSB') {
          if (v < -30) return 'deeply fatigued \u2014 recovery needed';
          if (v < -15) return 'fatigue building \u2014 ease off';
          if (v < 0) return 'training load is about right';
          if (v < 25) return 'well recovered';
          return 'peaked \u2014 very fresh';
        }
        if (f.factor === 'ACWR') {
          if (v > 1.5) return 'load climbing fast \u2014 worth watching';
          if (v < 0.6) return 'load has dropped off sharply';
          if (v > 1.3 || v < 0.8) return 'outside the commonly cited band';
          return 'steady';
        }
        return f.flag || '';
      }
      facs.forEach(function (f) {
        var trr = el('tr');
        trr.appendChild(el('td', null, f.factor));
        trr.appendChild(el('td', 'text-end num',
          f.value == null ? '\u2014' : Number(f.value).toFixed(2)));
        trr.appendChild(el('td', 'text-secondary', reading(f)));
        tb.appendChild(trr);
      });
      t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    }

    /* 못 타는 날의 대체 — 부족한 부하만큼 육상으로 */
    if (RDStorage.suggestLandWorkout) {
      var weekLoad = 0, DAY = 86400000, now = Date.now();
      ledger.forEach(function (x) {
        if (x.dateEpoch > now - 7 * DAY) weekLoad += x.trimp || 0;
      });
      /* 목표 주간 부하 = 만성 부하(일평균)×7. 아직 쌓이는 중이면 현재
         주간 부하를 그대로 목표로 둔다(무리한 증량 제안 방지). */
      var target = (acwr && acwr.chronic > 0) ? acwr.chronic * 7 : weekLoad;
      var gapAU = Math.max(0, target - weekLoad);
      var opts = null;
      try {
        opts = RDStorage.suggestLandWorkout(
          { gap_AU: gapAU > 0 ? gapAU : 100 }, rp,
          { timeAvailable_min: 60 },
          RDStorage.listWorkouts().map(function (w) {
            return { sportKey: w.sportKey, dateEpoch: w.dateEpoch };
          }), { topN: 4 });
      } catch (e) {}
      if (opts && opts.options && opts.options.length) {
        body.appendChild(el('h4', 'mt-4 mb-2', 'If you cannot get on the water'));
        body.appendChild(el('div', 'text-secondary mb-2',
          gapAU > 0
            ? ('You are about ' + Math.round(gapAU) + ' load units below your own '
               + 'recent weekly average. These would close that gap:')
            : 'You are already at your recent weekly average. These keep it there:'));
        var wrap2 = el('div', 'table-responsive');
        var t2 = el('table', 'table table-vcenter card-table table-sm');
        var th2 = el('thead'), h2 = el('tr');
        ['Activity', 'Minutes', 'Load', 'Why'].forEach(function (x, i) {
          h2.appendChild(el('th', (i === 1 || i === 2) ? 'text-end' : null, x));
        });
        th2.appendChild(h2); t2.appendChild(th2);
        var tb2 = el('tbody');
        opts.options.forEach(function (o) {
          var trr = el('tr');
          trr.appendChild(el('td', null, sportLabel(o.sportKey)));
          trr.appendChild(el('td', 'text-end num',
            o.durationMin != null ? Math.round(o.durationMin) : '\u2014'));
          trr.appendChild(el('td', 'text-end num',
            o.AU_estimate != null ? Math.round(o.AU_estimate) : '\u2014'));
          /* notes·step_by_step 은 한글이다. 영문 페이지이므로 대신
             구조화된 필드(강도·장비·전이효과)로 설명을 만든다. */
          var why = [];
          /* 강도 코드(LIT/HIT/threshold)를 사람 말로. 유산소 종목이고
             최대심박을 알면 목표 심박까지 적는다 — "최대심박 70% 로
             50분" 처럼 바로 실행 가능한 형태가 되어야 한다. */
          var ZONE = {
            LIT: { label: 'easy aerobic', lo: 0.60, hi: 0.70 },
            threshold: { label: 'tempo', lo: 0.70, hi: 0.82 },
            HIT: { label: 'hard intervals', lo: 0.85, hi: 0.95 },
            recovery: { label: 'very light', lo: 0.50, hi: 0.60 }
          };
          var z = ZONE[o.intensity];
          if (z) {
            var lib2 = (RDSportMET.LIBRARY || {})[o.sportKey] || {};
            var cardio = (lib2.category === 'cardio' || lib2.category === 'hiit');
            if (cardio && rp.maxHr > 0) {
              why.push(z.label + ' \u00b7 ' + Math.round(rp.maxHr * z.lo) + '\u2013'
                + Math.round(rp.maxHr * z.hi) + ' bpm ('
                + Math.round(z.lo * 100) + '\u2013' + Math.round(z.hi * 100)
                + '% of max)');
            } else {
              why.push(z.label);
            }
          }
          if (o.carryover != null) {
            why.push('carries over to foiling ' + Math.round(o.carryover * 100) + '%');
          }
          if (o.equipment && o.equipment.length) {
            var needsKit = o.equipment.filter(function (e2) {
              return e2 !== 'minimal' && e2 !== 'floor_space';
            });
            why.push(needsKit.length
              ? ('needs ' + needsKit.join(', ').replace(/_/g, ' '))
              : 'no kit needed');
          }
          trr.appendChild(el('td', 'text-secondary', why.join(' \u00b7 ')));
          tb2.appendChild(trr);
        });
        t2.appendChild(tb2); wrap2.appendChild(t2); body.appendChild(wrap2);
      }
    }

    var f = el('div', 'card-footer text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = 'This is training guidance from your own logged load, not medical '
      + 'advice. The acute:chronic ratio is shown because it tracks how fast your '
      + 'load is climbing \u2014 its widely quoted "safe zone" is disputed in the '
      + 'literature, so it is a signal here, never a rule. Never train through pain, '
      + 'illness or injury on the strength of a number.';
    card.appendChild(body);
    card.appendChild(f);
    host.appendChild(card);
  }

  /* 원장 — 무엇이 얼마의 부하로 들어갔는지 */
  function renderLedgerTable(host, ledger) {
    if (!ledger.length) return;
    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Load ledger'));
    head.appendChild(el('div', 'card-actions lab', 'newest first'));
    card.appendChild(head);
    var wrap = el('div', 'table-responsive');
    wrap.style.maxHeight = '420px'; wrap.style.overflowY = 'auto';
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Date', 'What', 'Type', 'Load', 'Scored from', ''].forEach(function (x, i) {
      htr.appendChild(el('th', i === 3 ? 'text-end' : null, x));
    });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    var METHOD = { banister: 'heart rate', met: 'activity + body weight',
                   srpe: 'how hard it felt' };
    ledger.slice().reverse().forEach(function (x) {
      var trr = el('tr');
      var d = new Date(x.dateEpoch);
      trr.appendChild(el('td', 'num', d.toISOString().slice(0, 10)));
      trr.appendChild(el('td', null,
        x.kind === 'land' ? sportLabel(x.name) : (x.name || '\u2014')));
      var badge = el('span', 'badge', x.kind === 'ride' ? 'Ride' : 'Land');
      badge.style.background = x.kind === 'ride' ? '#4dabf7' : '#82c91e';
      badge.style.color = '#0b1220';
      var td = el('td'); td.appendChild(badge);
      /* 저장하지 않고 열기만 한 라이딩도 부하는 센다 — 그 사실을 밝혀서
         "저장 안 했는데 왜 있지" 가 되지 않게 한다. */
      if (x.kind === 'ride' && x.saved === false) {
        var auto = el('span', 'badge bg-secondary-lt ms-1', 'auto');
        auto.title = 'Recorded when you opened the file, without saving the session';
        td.appendChild(auto);
      }
      trr.appendChild(td);
      trr.appendChild(el('td', 'text-end num', Math.round(x.trimp)));
      trr.appendChild(el('td', 'text-secondary', METHOD[x.method] || '\u2014'));
      var act = el('td');
      if (x.kind === 'land' && x.id) {
        var del = el('button', 'btn btn-sm btn-ghost-danger', 'Remove');
        del.type = 'button';
        del.addEventListener('click', function () {
          RDStorage.deleteWorkout(x.id); renderTraining();
        });
        act.appendChild(del);
      } else if (x.kind === 'ride' && x.saved === false && x.sig) {
        var delR = el('button', 'btn btn-sm btn-ghost-danger', 'Remove');
        delR.type = 'button';
        delR.addEventListener('click', function () {
          RDStorage.deleteRideLoad(x.sig); renderTraining();
        });
        act.appendChild(delR);
      }
      trr.appendChild(act);
      tb.appendChild(trr);
    });
    t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
    host.appendChild(card);
  }

  /* §462 바람이 자리 문제였나 시간 문제였나 — 다음 세션의 전략이 갈린다.
     "바람 있는 데를 찾아다녔다" 는 노력이 값을 했는지 확인해 준다. */
  function renderWindVariation(host, a) {
    if (!window.RDGainLoss || !RDGainLoss.windVariation || !CUR.session) return;
    var w;
    try { w = RDGainLoss.windVariation(CUR.session); } catch (e) { return; }
    if (!w || !w.ok) return;
    if (w.placeSpreadKt == null && w.timeSpreadKt == null) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Was the wind about where, or about when?'));
    head.appendChild(el('div', 'card-actions lab', w.cellM + ' m squares'));
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
    row.appendChild(tile('Across the water',
      w.placeSpreadKt != null ? w.placeSpreadKt.toFixed(1) + ' kt' : '—',
      'fastest minus slowest area, at the same time'));
    row.appendChild(tile('Across the session',
      w.timeSpreadKt != null ? w.timeSpreadKt.toFixed(1) + ' kt' : '—',
      'best quarter minus worst'));
    row.appendChild(tile('Areas you passed through',
      w.briefCellMedKt != null ? w.briefCellMedKt.toFixed(1) + ' kt' : '—',
      w.briefCells + ' squares, under 90 s each'));
    row.appendChild(tile('Areas you stayed in',
      w.stayedCellMedKt != null ? w.stayedCellMedKt.toFixed(1) + ' kt' : '—',
      w.stayedCells + ' squares, 3 min or more'));
    body.appendChild(row);

    /* 구간별 속도 — 시간 축의 변화 */
    if (w.byTime && w.byTime.length >= 2) {
      var wrap = el('div', 'table-responsive mt-3');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['Quarter', 'Median planing speed', 'Areas compared', 'Spread across areas']
        .forEach(function (x, i) {
          htr.appendChild(el('th', i ? 'text-end' : null, x));
        });
      th.appendChild(htr); t.appendChild(th);
      var tb = el('tbody');
      w.byTime.forEach(function (r) {
        var sp = (w.perQuarter || []).filter(function (x) {
          return x.quarter === r.quarter;
        })[0];
        var tr = el('tr');
        tr.appendChild(el('td', null, r.quarter + ' of 4'));
        tr.appendChild(el('td', 'text-end num', r.med.toFixed(1) + ' kt'));
        tr.appendChild(el('td', 'text-end num', sp ? String(sp.cells) : '—'));
        tr.appendChild(el('td', 'text-end num',
          sp ? sp.spreadKt.toFixed(1) + ' kt' : 'too few'));
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    }

    /* 판정 */
    var verdict = null;
    if (w.dominant === 'time') {
      verdict = { tone: 'alert-info', head: 'It was about when, not where.',
        body: 'At any one point in the session the areas you sailed differed by only '
          + w.placeSpreadKt.toFixed(1) + ' kt, while the whole area changed by '
          + w.timeSpreadKt.toFixed(1) + ' kt from the best quarter to the worst. '
          + 'Hunting for a windier patch had little to find — the wind was even '
          + 'across the water and simply faded. On a day like this the payoff is in '
          + 'timing: get the volume done while it is blowing rather than moving '
          + 'around looking for more.' };
    } else if (w.dominant === 'place') {
      verdict = { tone: 'alert-success', head: 'It was about where.',
        body: 'Areas differed by ' + w.placeSpreadKt.toFixed(1) + ' kt at the same '
          + 'moment, more than the session drifted over time. Finding the better '
          + 'patch and working it was worth the effort here.' };
    } else if (w.placeSpreadKt != null && w.timeSpreadKt != null) {
      verdict = { tone: 'alert-info', head: 'Neither dominated.',
        body: 'Place and time moved the speed by about the same amount, so nothing '
          + 'here argues strongly for either strategy.' };
    }
    if (verdict) {
      var v = el('div', 'alert ' + verdict.tone + ' mt-3');
      v.appendChild(el('div', 'fw-bold', verdict.head));
      v.appendChild(el('div', 'mt-1', verdict.body));
      body.appendChild(v);
    }

    /* 선택 편향 — "차이가 없다" 는 결론이 회피가 잘 통해서일 수도 있다 */
    if (w.avoidanceEvident === true) {
      body.appendChild(el('div', 'alert alert-warning mt-2',
        'The squares you only passed through were slower than the ones you stayed '
        + 'in, so you were reading the water and avoiding the dead patches. The '
        + '"no difference" reading above is partly a result of that choice.'));
    } else if (w.avoidanceEvident === false && w.dominant === 'time') {
      body.appendChild(el('div', 'text-secondary mt-2',
        'The squares you passed through briefly were no slower than the ones you '
        + 'stayed in, so this is not a case of successfully dodging dead patches '
        + '— there were not many to dodge.'));
    }

    var f = el('div', 'card-footer text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = 'Areas are ' + w.cellM + ' m squares and only those with at '
      + 'least three minutes of planing are compared, with the time window held '
      + 'fixed so a fading breeze cannot masquerade as a bad patch. Gusts smaller '
      + 'or shorter than that will not show up here.';
    card.appendChild(body);
    card.appendChild(f);
    host.appendChild(card);
  }

  /* §456 Gain/Loss — "얼마나 빨랐나" 가 아니라 "바람 쪽으로 얼마나
     나아갔나". 풍상 레그에서 옆으로 아무리 멀리 갔어도 바람 축 진행이
     같으면 이득은 0 이다. 회전 손실은 그 진행을 몇 미터 까먹었는지로
     잰다 — 워터스피드 Ultra 의 Gain/Loss 에 대응. */
  function renderGainLoss(host, a) {
    if (!window.RDGainLoss || !CUR.session || a.windDir == null) return;
    var L, legs, sum, shape = null;
    try {
      L = RDGainLoss.maneuverLoss(CUR.session, a.maneuvers || [], a.windDir);
      legs = RDGainLoss.legGains(CUR.session, a.windDir);
      /* 백분율 분모는 주행 전 구간의 방향별 진행량이다. 지속 레그만
         쓰면 회전이 잦은 세션에서 분모가 세션의 10% 밖에 안 덮어
         손실이 80% 처럼 부풀어 보인다(§460). */
      var prog = RDGainLoss.zoneProgress
        ? RDGainLoss.zoneProgress(CUR.session, a.windDir) : null;
      sum = RDGainLoss.summarize(L, legs, prog);
      shape = RDGainLoss.sessionShape
        ? RDGainLoss.sessionShape(CUR.session, a.windDir, legs) : null;
    } catch (e) { return; }
    if (!sum) return;

    /* §461 — 계속 도는 연습 세션에서는 회전이 목적이지 실수가 아니다.
       그런 세션에 "손실" 이라고 쓰면 연습의 비용을 실책으로 읽게 만든다.
       판정은 지속 레그가 주행 시간의 얼마를 덮는지로 한다. */
    var drill = !!(shape && shape.isDrillLike);

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title',
      drill ? 'What the turns cost' : 'Gain and loss'));
    head.appendChild(el('div', 'card-actions lab',
      'distance along the wind axis'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    if (drill) {
      body.appendChild(el('div', 'alert alert-info',
        'Only ' + Math.round(shape.sustainedShare * 100) + '% of your planing time '
        + 'was spent on a straight run of 25 seconds or more, so this reads as a '
        + 'turning session rather than sailing a course. The numbers below are '
        + 'still the cost of each turn, but in a drill that cost is the price of '
        + 'the repetition, not a mistake \u2014 the useful figure is the cost per '
        + 'turn and whether it falls as the session goes on, not the total.'));
    }

    var row = el('div', 'row row-cards');
    function tile(label, val, sub, tone) {
      var col = el('div', 'col-6 col-md-3');
      var c = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', label));
      var v = el('div', 'kpi__val num mt-1', val);
      if (tone) v.style.color = tone;
      b.appendChild(v);
      if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
      c.appendChild(b); col.appendChild(c); return col;
    }
    function m(x) { return x == null ? '\u2014' : Math.round(x).toLocaleString() + ' m'; }
    row.appendChild(tile('Ground made upwind', m(sum.upwindGainM),
      'measured along the wind axis'));
    row.appendChild(tile('Ground made downwind', m(sum.downwindGainM),
      'measured along the wind axis'));
    /* 라벨을 분명히 — 이 값은 거리이지 속도 감소율이 아니다. 예전에는
       "% of upwind gain" 이라고만 적어 "출구 속도가 그만큼 느려졌다" 로
       읽혔다(옥대표 지적). */
    /* 연습 세션이면 총합보다 회전당 비용이 읽을 값이다. */
    function grp(type) {
      var g = (sum.groups || []).filter(function (x) { return x.type === type; });
      var n = g.reduce(function (t2, x) { return t2 + x.count; }, 0);
      var tot = g.reduce(function (t2, x) { return t2 + x.totalVmgLossM; }, 0);
      return { n: n, avg: n ? tot / n : null, total: tot };
    }
    var gt = grp('tack'), gg = grp('gybe');
    if (drill) {
      row.appendChild(tile('Cost per tack', m(gt.avg),
        gt.n ? gt.n + ' tacks measured' : 'none measured', '#e8590c'));
      row.appendChild(tile('Cost per gybe', m(gg.avg),
        gg.n ? gg.n + ' gybes measured' : 'none measured', '#e8590c'));
    } else {
      row.appendChild(tile('Ground lost in tacks', m(sum.tackLossM),
        sum.tackLossPct != null
          ? 'equals ' + sum.tackLossPct.toFixed(0) + '% of the ground made upwind'
          : '', '#e8590c'));
      row.appendChild(tile('Ground lost in gybes', m(sum.gybeLossM),
        sum.gybeLossPct != null
          ? 'equals ' + sum.gybeLossPct.toFixed(0) + '% of the ground made downwind'
          : '', '#e8590c'));
    }
    body.appendChild(row);

    /* 그룹별 — 어느 회전이 제일 비싼가 */
    if (sum.groups && sum.groups.length) {
      var wrap = el('div', 'table-responsive mt-3');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['Turn', 'Count', 'Avg cost', 'Total cost', 'Net of gains']
        .forEach(function (x, i) {
          htr.appendChild(el('th', i ? 'text-end' : null, x));
        });
      th.appendChild(htr); t.appendChild(th);
      var tb = el('tbody');
      sum.groups.forEach(function (g) {
        var tr = el('tr');
        tr.appendChild(el('td', null,
          (g.type === 'gybe' ? 'Gybe' : 'Tack') +
          (g.side === 'P' ? ' \u00b7 port' : g.side === 'S' ? ' \u00b7 starboard' : '')));
        tr.appendChild(el('td', 'text-end num', String(g.count)));
        tr.appendChild(el('td', 'text-end num', m(g.avgVmgLossM)));
        tr.appendChild(el('td', 'text-end num', m(g.totalVmgLossM)));
        tr.appendChild(el('td', 'text-end num text-secondary', m(g.avgPathLossM)));
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    }

    /* 목표 반대로 간 회전 — 같은 손실이라도 "느렸다" 와 "거꾸로 갔다" 는
       고칠 것이 다르다. */
    var wrong = (L || []).filter(function (x) {
      return x.ok && !x.zoneConflict && x.wrongWaySec > 3;
    });
    if (wrong.length) {
      body.appendChild(el('div', 'alert alert-warning mt-3',
        wrong.length + ' turn' + (wrong.length > 1 ? 's' : '')
        + ' went backwards relative to the objective for more than 3 seconds '
        + '(rounding up out of a gybe, or stalling head-to-wind in a tack). '
        + 'That is a different fault from simply being slow \u2014 it is the exit '
        + 'angle, not the speed.'));
    }

    /* 못 센 회전 — 합계가 전부인 것처럼 읽히지 않게 밝힌다 */
    var missing = [];
    Object.keys(sum.notComputed || {}).forEach(function (k) {
      var LABEL = {
        'not-sailing': 'the boat was barely moving before and after',
        'no-reference-window': 'they sit at the very start or end of the session',
        'no-boundaries': 'the engine could not bound the turn'
      };
      missing.push(sum.notComputed[k] + ' because ' + (LABEL[k] || k));
    });
    if (sum.skippedAmbiguous) {
      missing.push(sum.skippedAmbiguous + ' because the measured wind angle '
        + 'disagreed with the turn type');
    }
    var f = el('div', 'card-footer text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = 'Counted ' + sum.countedTurns + ' of '
      + ((a.maneuvers || []).length) + ' turns'
      + (missing.length ? ' \u2014 skipped ' + missing.join('; ') + '.' : '.')
      + ' These are distances, not speed drops: a turn costing 40 m means you '
      + 'ended up 40 m further from where you were heading than if you had held '
      + 'your pace through it. Cost is the ground you fell behind your own best '
      + 'pace \u2014 measured '
      + 'from position, from the moment the turn starts until you get that pace '
      + 'back (the better of your before or after pace). "Net of gains" subtracts '
      + 'any moments inside that window where you beat the pace, so it is always '
      + 'the smaller number; a wide gap between the two means you clawed a lot '
      + 'back on the exit.';
    card.appendChild(body);
    card.appendChild(f);
    host.appendChild(card);
  }

  /* 라이더 프로필의 최대심박 — 없으면 null(HR 축이 비활성). */
  function riderMaxHr() {
    try {
      var rp = (window.RDStorage && RDStorage.loadRider) ? RDStorage.loadRider() : null;
      return (rp && rp.maxHr > 0) ? rp.maxHr : null;
    } catch (e) { return null; }
  }

  /* §477 2차원 지표 격자 — 1차원 요약으로는 안 갈리는 질문이 있다.
     *스타보드 풍상에서만* 느린가, *후반에만* 각이 벌어지는가. 축 둘을
     고르고 지표 하나를 채우면 그게 한 화면에 놓인다. */
  var binState = { rowDim: 'zone', colDim: 'tack', metric: 'vmg',
                   formula: 'speed / hr * 100' };
  function renderBinTable(host, a) {
    if (!window.RDBinTable || !CUR.session) return;
    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Bin table'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    var maxHr = riderMaxHr();
    var ctlOpts = { windDir: a.windDir, maxHr: maxHr, minSpeedKt: 8 };

    /* 쓸 수 없는 축은 목록에서 빼는 게 아니라 비활성으로 남긴다 —
       빠져 있으면 "그런 축은 없다" 로 읽히고, 왜 못 쓰는지 못 알려준다. */
    function dimDisabled(d) {
      if (d.key === 'tack' && a.windDir == null) return 'needs a wind direction';
      if ((d.key === 'twa' || d.key === 'zone') && a.windDir == null) return 'needs a wind direction';
      if (d.key === 'hrzone' && !maxHr) return 'needs your max heart rate';
      return null;
    }
    function metDisabled(m) {
      if ((m.key === 'vmg' || m.key === 'twa') && a.windDir == null) return 'needs a wind direction';
      if (m.key === 'hr' && !(a.hr && a.hr.hasHR)) return 'no heart-rate data';
      return null;
    }

    var bar = el('div', 'd-flex flex-wrap align-items-end gap-2 mb-3');
    function mkSelect(label, list, cur, disabledFn, onChange) {
      var wrap = el('div');
      wrap.appendChild(el('div', 'lab mb-1', label));
      var sel = el('select', 'form-select form-select-sm');
      sel.style.width = 'auto';
      list.forEach(function (d) {
        var o = document.createElement('option');
        o.value = d.key;
        var why = disabledFn(d);
        o.textContent = d.label + (why ? ' — ' + why : '');
        o.disabled = !!why;
        if (d.key === cur) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { onChange(sel.value); });
      wrap.appendChild(sel);
      return wrap;
    }
    function redraw() {
      var h = $('bin-table-host');
      if (h) drawBinGrid(h, a, ctlOpts);
    }
    bar.appendChild(mkSelect('Rows', RDBinTable.DIMENSIONS, binState.rowDim,
      dimDisabled, function (v) { binState.rowDim = v; redraw(); }));
    bar.appendChild(mkSelect('Columns', RDBinTable.DIMENSIONS, binState.colDim,
      dimDisabled, function (v) { binState.colDim = v; redraw(); }));
    /* §479 — 미리 정해 둔 지표만 보여주면 라이더가 궁금한 것의 절반은
       영원히 못 본다. 마지막 항목은 직접 적는 수식이다. */
    var metricList = RDBinTable.METRICS.slice();
    if (window.RDFormula) metricList.push({ key: '__derived', label: 'Custom formula…' });
    bar.appendChild(mkSelect('Metric', metricList, binState.metric,
      metDisabled, function (v) {
        binState.metric = v;
        var fb = $('bin-formula');
        if (fb) fb.style.display = (v === '__derived') ? '' : 'none';
        redraw();
      }));
    body.appendChild(bar);

    if (window.RDFormula) body.appendChild(buildFormulaBar(redraw));

    var tblHost = el('div'); tblHost.id = 'bin-table-host';
    body.appendChild(tblHost);
    card.appendChild(body);
    host.appendChild(card);
    drawBinGrid(tblHost, a, ctlOpts);
  }

  /* 수식 입력줄. 오류는 입력 옆에 바로 붙인다 — 표가 조용히 비어 있는
     것보다 "17번째 글자에서 막혔다" 가 훨씬 낫다. */
  function buildFormulaBar(redraw) {
    var wrap = el('div', 'mb-3');
    wrap.id = 'bin-formula';
    wrap.style.display = (binState.metric === '__derived') ? '' : 'none';
    var row = el('div', 'd-flex flex-wrap align-items-center gap-2');
    var inp = el('input', 'form-control form-control-sm');
    inp.type = 'text';
    inp.style.maxWidth = '360px';
    inp.value = binState.formula;
    inp.spellcheck = false;
    var msg = el('span', 'lab');
    function apply() {
      binState.formula = inp.value;
      var c = RDFormula.compile(inp.value);
      msg.textContent = c.ok ? '' : c.error;
      msg.style.color = c.ok ? '' : '#e03131';
      redraw();
    }
    inp.addEventListener('change', apply);
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') apply(); });
    var btn = el('button', 'btn btn-sm', 'Apply');
    btn.type = 'button';
    btn.addEventListener('click', apply);
    row.appendChild(inp); row.appendChild(btn); row.appendChild(msg);
    wrap.appendChild(row);
    var help = el('div', 'text-secondary mt-1');
    help.style.fontSize = '.8125rem';
    help.textContent = 'Variables: ' + RDFormula.VARIABLES.map(function (v) { return v.key; }).join(', ')
      + '.  Functions: ' + RDFormula.FUNCTION_NAMES.join(', ')
      + '.  Speeds are knots, angles degrees. Samples where a variable is missing '
      + 'are left out rather than counted as zero.';
    wrap.appendChild(help);
    return wrap;
  }

  /* 현재 수식을 bin-table 이 쓸 수 있는 지표로 감싼다. */
  function derivedMetric() {
    if (!window.RDFormula || !CUR.session) return null;
    var c = RDFormula.compile(binState.formula);
    if (!c.ok) return null;
    var S = CUR.session.samples || [];
    var ctx = { t0: S.length ? S[0].t : 0 };
    return { label: binState.formula, unit: '', dp: 2,
             value: function (p) { return c.value(p, ctx); } };
  }

  function drawBinGrid(hostEl, a, ctlOpts) {
    while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
    var t;
    try {
      t = RDBinTable.build(CUR.session, {
        rowDim: binState.rowDim, colDim: binState.colDim, metric: binState.metric,
        derived: binState.metric === '__derived' ? derivedMetric() : null,
        windDir: ctlOpts.windDir, maxHr: ctlOpts.maxHr, minSpeedKt: ctlOpts.minSpeedKt
      });
    } catch (e) { t = null; }
    if (!t || !t.rows.length || !t.cols.length) {
      hostEl.appendChild(el('div', 'text-secondary',
        binState.metric === '__derived'
          ? 'That formula produced no values — check it above.'
          : 'Nothing to show for those two axes — no sustained riding falls in both.'));
      return;
    }

    /* 색은 표 전체에서의 상대값. 시간·비중 지표는 큰 값이 곧 좋은 게
       아니지만, 어디가 몰려 있는지는 색으로 읽는 게 빠르다. */
    var vals = [];
    t.grid.forEach(function (r) { r.forEach(function (c) { if (c.value != null) vals.push(c.value); }); });
    var lo = vals.length ? Math.min.apply(null, vals) : 0;
    var hi = vals.length ? Math.max.apply(null, vals) : 1;

    var wrap = el('div', 'table-responsive');
    var tbl = el('table', 'table table-sm table-vcenter mb-1');
    var thead = el('thead'), hr = el('tr');
    hr.appendChild(el('th', null, t.rowDim.label));
    t.cols.forEach(function (c) { hr.appendChild(el('th', 'text-end', c.label)); });
    hr.appendChild(el('th', 'text-end', 'all'));
    thead.appendChild(hr); tbl.appendChild(thead);

    var tb = el('tbody');
    t.grid.forEach(function (row, i) {
      var tr = el('tr');
      tr.appendChild(el('td', null, t.rows[i].label));
      row.forEach(function (c) {
        var td = el('td', 'text-end num');
        if (c.value == null) {
          td.className += ' text-secondary';
          td.textContent = c.empty ? '' : (Math.round(c.seconds) + 's');
          if (!c.empty) td.title = 'only ' + Math.round(c.seconds)
            + 's here — under the ' + t.minSeconds + 's minimum, so no average is shown';
        } else {
          td.textContent = c.value.toFixed(t.metric.dp);
          var f = hi > lo ? (c.value - lo) / (hi - lo) : 1;
          td.style.background = 'rgba(77,171,247,' + (0.05 + f * 0.28).toFixed(3) + ')';
          td.title = fmtClock(c.seconds) + ' in this cell';
        }
        tr.appendChild(td);
      });
      var rt = t.rowTotals[i];
      tr.appendChild(el('td', 'text-end num text-secondary',
        rt.value == null ? '' : rt.value.toFixed(t.metric.dp)));
      tb.appendChild(tr);
    });
    var trT = el('tr');
    trT.style.borderTop = '2px solid rgba(139,152,165,0.3)';
    trT.appendChild(el('td', 'text-secondary', 'all'));
    t.colTotals.forEach(function (x) {
      trT.appendChild(el('td', 'text-end num text-secondary',
        x.value == null ? '' : x.value.toFixed(t.metric.dp)));
    });
    trT.appendChild(el('td'));
    tb.appendChild(trT);
    tbl.appendChild(tb); wrap.appendChild(tbl);
    hostEl.appendChild(wrap);

    var f = el('div', 'text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = t.metric.label + (t.metric.unit ? ' in ' + t.metric.unit : '')
      + ', time-weighted, riding above 8 kt only. Cells with less than '
      + t.minSeconds + 's show the seconds instead of an average. '
      + 'The "all" row and column are the margins — a cell only means something '
      + 'if it differs from them.';
    hostEl.appendChild(f);
  }

  /* §475 풍속대 × 풍각 격자 — 폴라 하나에 모든 날을 섞으면 그건 폴라가
     아니라 평균이다. 8노트의 각도와 20노트의 각도는 다른 배의 것처럼
     다르다. 순간 풍속은 못 재므로 세션에 적어 둔 풍속으로 세션째 묶는다
     — 한 세션 안의 돌풍·소강은 이 격자가 구분하지 못하고, 그건 밝힌다. */
  function renderPolarGrid(host, a) {
    if (!An.buildPolarGrid || !window.RDStorage) return;
    var entries = [];
    var curEpoch = CUR.session && CUR.session.startEpoch;
    try {
      RDStorage.listSessions().forEach(function (rec) {
        if (!rec.polarProfile || !rec.polarProfile.bins) return;
        if (rec.windSpeedKt == null) return;
        entries.push({ windSpeedKt: rec.windSpeedKt, profile: rec.polarProfile,
                       dateEpoch: rec.dateEpoch });
      });
    } catch (e) {}
    /* 지금 열려 있는 세션도 넣는다 — 저장 전이라도 오늘이 격자에 보여야
       "오늘은 어느 칸인가" 를 읽을 수 있다. */
    var wsNow = windSpeedFromForm ? windSpeedFromForm() : null;
    var profNow = null;
    if (wsNow != null && a.polar && An.sessionPolarProfile && CUR.session &&
        a.windDir != null) {
      try { profNow = An.sessionPolarProfile(CUR.session, a.windDir); } catch (e) {}
      if (profNow) {
        entries = entries.filter(function (x) { return x.dateEpoch !== curEpoch; });
        entries.push({ windSpeedKt: wsNow, profile: profNow, dateEpoch: curEpoch });
      }
    }
    if (entries.length < 1) return;
    var grid;
    try { grid = An.buildPolarGrid(entries); } catch (e) { return; }
    if (!grid) return;
    var live = grid.buckets.filter(function (b) { return b.filled > 0; });
    if (!live.length) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Polar by wind strength'));
    head.appendChild(el('div', 'card-actions lab',
      '90th-percentile speed · ' + grid.sourceSessionCount + ' session'
      + (grid.sourceSessionCount > 1 ? 's' : '')));
    card.appendChild(head);
    var body = el('div', 'card-body');

    /* 어느 각도까지 보여줄지 — 실제로 채워진 빈만. 빈 칸을 줄줄이
       늘어놓으면 표가 데이터보다 커진다. */
    var used = {};
    grid.buckets.forEach(function (b) {
      b.cells.forEach(function (c, i) { if (c.speedMs != null) used[i] = true; });
    });
    var cols = Object.keys(used).map(Number).sort(function (x, y) { return x - y; });
    if (!cols.length) return;

    var wrap = el('div', 'table-responsive');
    var tbl = el('table', 'table table-sm table-vcenter mb-1');
    var thead = el('thead'), hr = el('tr');
    hr.appendChild(el('th', null, 'Wind'));
    cols.forEach(function (i) {
      hr.appendChild(el('th', 'text-end',
        Math.round(grid.buckets[0].cells[i].twaCenter) + '°'));
    });
    hr.appendChild(el('th', 'text-end', 'sessions'));
    thead.appendChild(hr); tbl.appendChild(thead);

    /* 셀 색은 같은 행 안에서의 상대 속도 — 행끼리 비교하는 표가 아니라
       "이 바람에서 어느 각도가 빠른가" 를 읽는 표다. */
    var tb = el('tbody');
    live.forEach(function (b) {
      var vals = b.cells.filter(function (c) { return c.speedMs != null; })
                        .map(function (c) { return c.speedMs; });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var tr = el('tr');
      tr.appendChild(el('td', null, b.label));
      cols.forEach(function (i) {
        var c = b.cells[i];
        var td = el('td', 'text-end num');
        if (c.speedMs == null) {
          td.textContent = c.sampleCount ? '·' : '';
          td.className += ' text-secondary';
          if (c.sampleCount) td.title = c.sampleCount + ' samples — too few to trust';
        } else {
          td.textContent = (c.speedMs * KT).toFixed(1);
          var f = hi > lo ? (c.speedMs - lo) / (hi - lo) : 1;
          td.style.background = 'rgba(77,171,247,' + (0.06 + f * 0.26).toFixed(3) + ')';
          td.title = c.sampleCount + ' samples · ' + c.sessionCount + ' session'
            + (c.sessionCount > 1 ? 's' : '') + (c.legacy ? ' · older record, p95' : '');
        }
        tr.appendChild(td);
      });
      tr.appendChild(el('td', 'text-end num', String(b.sessionCount)));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); body.appendChild(wrap);

    var f = el('div', 'text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = 'Speeds in knots. Sessions are bucketed by the wind strength you '
      + 'entered, so gusts and lulls inside one session all land in the same bucket — '
      + 'this grid separates days, not moments. A dot means samples exist but too few '
      + 'to report.'
      + (grid.unbucketed ? '  ' + grid.unbucketed + ' saved session'
          + (grid.unbucketed > 1 ? 's have' : ' has') + ' no wind speed recorded.' : '');
    body.appendChild(f);
    card.appendChild(body);
    host.appendChild(card);
  }

  /* §478 상관 보기 — 표로는 안 나오고 산점도로 나오는 질문들.
     점은 표본이 아니라 20초 창이다(이웃 표본은 서로 독립이 아니다).
     r 옆에 항상 n·기울기·시간 교란을 붙인다 — r 하나만 크게 써 두면
     세기와 크기를, 상관과 인과를 섞어 읽게 된다. */
  var corrState = { xKey: 'twa', yKey: 'speed', zone: 'up' };
  function renderCorrelation(host, a) {
    if (!window.RDCorrelation || !CUR.session) return;
    var W;
    try { W = RDCorrelation.windows(CUR.session, {}); } catch (e) { return; }
    if (!W || W.length < 5) return;

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Relationships'));
    head.appendChild(el('div', 'card-actions lab',
      W.length + ' windows of 20s'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    function fieldDisabled(f) {
      if ((f.key === 'vmg' || f.key === 'twa') && a.windDir == null) return 'needs a wind direction';
      if (f.key === 'hr' && !(a.hr && a.hr.hasHR)) return 'no heart-rate data';
      return null;
    }
    var bar = el('div', 'd-flex flex-wrap align-items-end gap-2 mb-3');
    function sel(label, list, cur, disFn, onChange) {
      var wrap = el('div');
      wrap.appendChild(el('div', 'lab mb-1', label));
      var s2 = el('select', 'form-select form-select-sm');
      s2.style.width = 'auto';
      list.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f.key;
        var why = disFn ? disFn(f) : null;
        o.textContent = f.label + (why ? ' — ' + why : '');
        o.disabled = !!why;
        if (f.key === cur) o.selected = true;
        s2.appendChild(o);
      });
      s2.addEventListener('change', function () { onChange(s2.value); });
      wrap.appendChild(s2);
      return wrap;
    }
    bar.appendChild(sel('X', RDCorrelation.FIELDS, corrState.xKey, fieldDisabled,
      function (v) { corrState.xKey = v; drawCorr(a, W); }));
    bar.appendChild(sel('Y', RDCorrelation.FIELDS, corrState.yKey, fieldDisabled,
      function (v) { corrState.yKey = v; drawCorr(a, W); }));
    bar.appendChild(sel('Where', [{ key: 'all', label: 'Whole session' },
                                  { key: 'up', label: 'Upwind only' },
                                  { key: 'down', label: 'Downwind only' }],
      corrState.zone, null, function (v) { corrState.zone = v; drawCorr(a, W); }));
    body.appendChild(bar);

    var plotHost = el('div'); plotHost.id = 'corr-plot';
    plotHost.style.minHeight = '260px';
    body.appendChild(plotHost);
    var noteHost = el('div'); noteHost.id = 'corr-note'; noteHost.className = 'mt-2';
    body.appendChild(noteHost);
    card.appendChild(body);
    host.appendChild(card);
    drawCorr(a, W);
  }

  var corrPlot = null;
  function drawCorr(a, W) {
    var plotHost = $('corr-plot'), noteHost = $('corr-note');
    if (!plotHost || !noteHost) return;
    while (noteHost.firstChild) noteHost.removeChild(noteHost.firstChild);
    var res;
    try {
      res = RDCorrelation.analyze(CUR.session, {
        xKey: corrState.xKey, yKey: corrState.yKey, zone: corrState.zone, windows: W
      });
    } catch (e) { res = null; }
    if (corrPlot) { try { corrPlot.destroy(); } catch (e) {} corrPlot = null; }
    while (plotHost.firstChild) plotHost.removeChild(plotHost.firstChild);
    if (!res || !res.fit) {
      plotHost.appendChild(el('div', 'text-secondary',
        'Fewer than five windows match — nothing worth fitting a line through.'));
      return;
    }

    var xs = res.points.map(function (w) { return w[res.x.key]; });
    var ys = res.points.map(function (w) { return w[res.y.key]; });
    /* 산점도는 x 정렬이 필요하다(uPlot 은 x 가 오름차순이어야 한다). */
    var order = xs.map(function (_, i) { return i; })
                  .sort(function (i, j) { return xs[i] - xs[j]; });
    var sx = order.map(function (i) { return xs[i]; });
    var sy = order.map(function (i) { return ys[i]; });
    var fitY = sx.map(function (v) { return res.fit.intercept + res.fit.slope * v; });

    if (window.uPlot) {
      corrPlot = new uPlot({
        width: plotHost.clientWidth || 640, height: 260, padding: [12, 14, 4, 6],
        cursor: { drag: { x: false, y: false } },
        legend: { show: false },
        scales: { x: { time: false } },
        axes: [
          { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
            font: '11px "IBM Plex Mono", monospace',
            values: function (u, t) {
              return t.map(function (v) { return v.toFixed(0) + res.x.unit; });
            } },
          { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
            font: '11px "IBM Plex Mono", monospace', size: 46,
            values: function (u, t) { return t.map(function (v) { return v.toFixed(1); }); } }
        ],
        series: [
          { label: res.x.label },
          { label: res.y.label, stroke: 'rgba(77,171,247,0.9)', width: 0,
            points: { show: true, size: 6, stroke: 'rgba(77,171,247,0.9)',
                      fill: 'rgba(77,171,247,0.35)' } },
          { label: 'fit', stroke: '#f76707', width: 1.6, points: { show: false } }
        ]
      }, [sx, sy, fitY], plotHost);
      track(corrPlot, plotHost);
    }

    noteHost.appendChild(el('div', null, RDCorrelation.describe(res)));
    /* 경고는 결과와 같은 자리에 둔다 — 각주로 내리면 아무도 안 읽는다. */
    if (res.identity) {
      noteHost.appendChild(el('div', 'alert alert-warning mt-2',
        'These two are linked by definition — VMG is speed times the cosine of CWA. '
        + 'The correlation here comes from the arithmetic, not from your sailing. '
        + 'The slope is still worth reading: it says what a degree of angle is '
        + 'actually worth in VMG.'));
    } else if (res.timeConfounded) {
      noteHost.appendChild(el('div', 'alert alert-warning mt-2',
        'Both of these also drift with time in this session (r = '
        + res.xVsTime.r.toFixed(2) + ' and ' + res.yVsTime.r.toFixed(2)
        + ' against elapsed time). If the wind built or died, that alone would '
        + 'produce this relationship. Compare windows from the same part of the '
        + 'session before concluding anything.'));
    }
    var f = el('div', 'text-secondary mt-2');
    f.style.fontSize = '.8125rem';
    f.textContent = 'Each dot is a 20-second window of riding above 8 kt, not a single '
      + 'GPS sample — neighbouring samples are not independent, and using them raw '
      + 'would make any relationship look far more certain than it is.';
    noteHost.appendChild(f);
  }

  /* §474 타깃 밴드 — "내가 낼 수 있다고 확인된 성능" 과 오늘을 비교한다.
     예전 카드는 풍각 빈마다 역대 최고를 긁어모은 포락선과 겨뤘다.
     그 곡선은 어느 하루도 달린 적이 없고, 최고 속도와 최고 각도를
     동시에 요구한다. 여기서는 20초 창을 VMG 로 고르고 속도·각도는
     그때 값을 그대로 보여준다 — 실제로 함께 나온 조합이다. 그리고
     한 점이 아니라 75~95 퍼센타일 밴드로 낸다. */
  function renderTargetComparison(host, a) {
    if (!An.sessionTargetWindows || !An.buildTargetBand || !CUR.session) return;
    if (a.windDir == null) return;
    var today = a.targetWindows;
    if (!today) return;

    /* 저장된 다른 세션의 창을 모은다 — 같은 시작 시각은 같은 세션이므로 뺀다
       (자기 자신과 비교하면 항상 100%). 예전 기록에는 targetWindows 가
       없다 — 그건 그냥 재료가 없는 것이고, 그 사실을 카드에 밝힌다. */
    var sets = [], curEpoch = CUR.session.startEpoch || 0, older = 0;
    try {
      (window.RDStorage ? RDStorage.listSessions() : []).forEach(function (rec) {
        if (curEpoch && rec.dateEpoch === curEpoch) return;
        if (rec.targetWindows) sets.push(rec.targetWindows); else older++;
      });
    } catch (e) {}
    var basis = sets.length ? 'cumulative' : 'single-session';
    var band;
    try { band = An.buildTargetBand(sets.length ? sets : [today], { basis: basis }); }
    catch (e) { return; }
    if (!band) return;
    var cmp = An.compareToTargetBand(today, band, { level: 90 });

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Target band'));
    head.appendChild(el('div', 'card-actions lab',
      basis === 'cumulative'
        ? ('from ' + sets.length + ' saved session' + (sets.length > 1 ? 's' : ''))
        : 'from this session only'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    if (basis === 'single-session') {
      body.appendChild(el('div', 'alert alert-info',
        'No other saved sessions carry target windows yet, so the band is built from '
        + 'today alone — it reads as consistency within today, not a personal best. '
        + (older ? older + ' older session' + (older > 1 ? 's were' : ' was')
                   + ' saved before this was recorded, so they cannot contribute. ' : '')
        + 'Save a few more and it becomes a cross-day comparison.'));
    }

    ['upwind', 'downwind'].forEach(function (zk) {
      var b = band[zk];
      if (!b) return;
      var sec = el('div', 'mb-3');
      var t = el('div', 'lab mb-1');
      t.textContent = (zk === 'upwind' ? 'Upwind' : 'Downwind')
        + ' · ' + b.totalWindows + ' windows of ' + band.windowSec + 's';
      sec.appendChild(t);

      var tbl = el('table', 'table table-sm table-vcenter mb-1');
      var thead = el('thead');
      var hr = el('tr');
      ['Percentile', 'VMG', 'Speed', 'CWA'].forEach(function (h, i) {
        var th = el('th', i ? 'text-end' : null, h);
        hr.appendChild(th);
      });
      thead.appendChild(hr); tbl.appendChild(thead);
      var tb = el('tbody');
      [75, 90, 95].forEach(function (p) {
        var L = b.levels[p];
        var tr = el('tr');
        tr.appendChild(el('td', null, 'p' + p));
        if (!L) {
          var td = el('td', 'text-end text-secondary', 'not enough history');
          td.colSpan = 3; tr.appendChild(td);
        } else {
          tr.appendChild(el('td', 'text-end num', L.vmgKt.toFixed(1) + ' kt'));
          tr.appendChild(el('td', 'text-end num', L.speedKt.toFixed(1) + ' kt'));
          tr.appendChild(el('td', 'text-end num', Math.round(L.twaDeg) + '°'));
        }
        tb.appendChild(tr);
      });
      var c = cmp && cmp[zk];
      if (c) {
        var tr2 = el('tr');
        tr2.style.borderTop = '2px solid rgba(139,152,165,0.3)';
        tr2.appendChild(el('td', null, 'today (best 30%)'));
        tr2.appendChild(el('td', 'text-end num', c.todayVmgKt.toFixed(1) + ' kt'));
        tr2.appendChild(el('td', 'text-end num', c.todaySpeedKt.toFixed(1) + ' kt'));
        tr2.appendChild(el('td', 'text-end num', Math.round(c.todayTwaDeg) + '°'));
        tb.appendChild(tr2);
      }
      tbl.appendChild(tb);
      sec.appendChild(tbl);
      if (c && c.pct != null) {
        sec.appendChild(el('div', 'lab',
          'Today is ' + Math.round(c.pct) + '% of your p90 VMG target.'));
      }
      body.appendChild(sec);
    });

    var f = el('div', 'text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = 'Windows are picked by VMG; the speed and angle shown are whatever '
      + 'came with them, so each row is a combination you actually rode. Picking the '
      + 'fastest speed and the tightest angle separately would give a target no one has '
      + 'ever sailed.';
    body.appendChild(f);
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

    /* §485 (옥대표) — 단위를 아래 줄이 아니라 이름 괄호 안에.
       두 줄이면 행 높이가 늘고 눈이 두 번 움직인다. 한 줄에 붙이면
       "무엇을 어떤 단위로" 가 한 번에 읽힌다. */
    var METRIC_LABEL = {
      sog:  'Speed / SOG (kt)',
      vmg:  'VMG (kt)',
      twa:  'Course wind angle (°)',
      awa:  'Apparent wind angle (°)',
      heel: 'Heel (°)',
      pitch:'Pitch (°)',
      hr:   'Heart rate (bpm)'
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
      var label = METRIC_LABEL[metric] || metric;
      var modeKeys = Object.keys(modes);
      modeKeys.forEach(function (mode, mi) {
        var tr = el('tr');
        if (mi === 0) {
          var tdM = el('td');
          tdM.rowSpan = modeKeys.length;
          tdM.appendChild(el('div', null, label));
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
    /* §488 (옥대표) — 그룹 필터. 95개를 한 줄로 늘어놓으면 "자이빙 스타보드만"
       같은 질문에 답할 수가 없다. 종류(택/자이브)와 택 방향(포트/스타보드)을
       따로 걸러 본다. 선택(TURNSEL)은 **원본 인덱스**로 잡아 두므로 필터를
       바꿔도 고른 회전이 풀리지 않는다. */
    var view = mans.map(function (m, i) { return { m: m, i: i }; })
      .filter(function (d) {
        if (TURNFILT.type !== 'all' && d.m.type !== TURNFILT.type) return false;
        if (TURNFILT.side !== 'all' && d.m.side !== TURNFILT.side) return false;
        return true;
      });
    var act2 = el('div', 'card-actions d-flex align-items-center gap-2');
    function filtSel(list, cur, onPick) {
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
    act2.appendChild(filtSel([['all', 'All turns'], ['gybe', 'Gybes'], ['tack', 'Tacks']],
      TURNFILT.type, function (v) { TURNFILT.type = v; renderTurnExtras(a); }));
    act2.appendChild(filtSel([['all', 'Both tacks'], ['P', 'Port'], ['S', 'Starboard']],
      TURNFILT.side, function (v) { TURNFILT.side = v; renderTurnExtras(a); }));
    act2.appendChild(el('span', 'lab',
      view.length === mans.length
        ? (mans.length + ' detected')
        : (view.length + ' of ' + mans.length)));
    h2.appendChild(act2);
    card2.appendChild(h2);
    var wrap = el('div', 'table-responsive');
    wrap.style.maxHeight = '420px'; wrap.style.overflowY = 'auto';
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['#', 'Type', 'Side', 'Time', 'Loss', 'Recovery', 'Eff', 'Basis', 'Turn rate']
      .forEach(function (x, i) {
        htr.appendChild(el('th', i > 2 ? 'text-end' : null, x));
      });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    view.forEach(function (d) {
      var m = d.m, i = d.i;
      var tr = el('tr');
      /* §454 — 행을 눌러 회전을 고른다(다중 선택 토글). 고른 회전은
         위쪽 상세 카드에 지표와 속도 곡선으로 펼쳐진다. */
      tr.style.cursor = 'pointer';
      if (TURNSEL.indexOf(i) >= 0) tr.className = 'table-active';
      tr.addEventListener('click', function () {
        var pos = TURNSEL.indexOf(i);
        if (pos < 0) TURNSEL.push(i); else TURNSEL.splice(pos, 1);
        renderTurnExtras(a);
      });
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
      /* §454 — 자이브는 VMG 기준, 택은 SOG 기준으로 손실·효율을 낸다.
         기준을 안 적으면 SOG 진입/최저/탈출 옆의 VMG 손실이 모순처럼
         읽힌다(최저 속도가 진입보다 빠른데 손실 100% 같은 경우). */
      tr.appendChild(el('td', 'text-end text-secondary',
        m.effBasis === 'vmg' ? 'VMG' : 'SOG'));
      tr.appendChild(el('td', 'text-end num',
        m.avgTurnRateDegSec == null ? '—' : m.avgTurnRateDegSec.toFixed(1) + '°/s'));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); card2.appendChild(wrap);
    var fn = el('div', 'card-footer text-secondary');
    fn.style.fontSize = '.8125rem';
    fn.textContent = 'Click a row to open it below; click again to deselect. '
      + 'Loss and efficiency use VMG when the wind angle is reliable (usually gybes) '
      + 'and plain speed otherwise \u2014 the Basis column says which, so a VMG loss '
      + 'next to rising speed is not a contradiction.';
    card2.appendChild(fn);
    lh.appendChild(card2);

    renderSessionQA(host, a);
    renderTurnProgression(host, a);
    renderTurnGroups(host, a);
    renderTurnCoaching(host, a);
    renderTurnDetail(host, a);
  }

  /* §454 선택한 회전 — 표에서 고른 회전들의 상세.
     하나면 지표 전부, 여럿이면 나란히 비교. 속도 곡선은 회전 정점(apex)
     을 0 초로 맞춰 겹친다 — 시각이 다른 회전을 같은 자로 보려면 정점을
     맞춰야 한다. */
  var TURNSEL = [];
  /* §488 — 회전 목록 그룹 필터 (종류 × 택 방향) */
  var TURNFILT = { type: 'all', side: 'all' };

  function renderTurnDetail(host, a) {
    var mans = a.maneuvers || [];
    var sel = TURNSEL.filter(function (i) { return mans[i]; })
                     .sort(function (x, y) { return x - y; });
    if (!sel.length) return;
    var picked = sel.map(function (i) { return mans[i]; });

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title',
      picked.length === 1 ? 'Turn #' + (sel[0] + 1) : sel.length + ' turns selected'));
    var act = el('div', 'card-actions');
    var clr = el('button', 'btn btn-sm btn-ghost-secondary', 'Clear selection');
    clr.type = 'button';
    clr.addEventListener('click', function () { TURNSEL.length = 0; renderTurnExtras(a); });
    act.appendChild(clr);
    head.appendChild(act);
    card.appendChild(head);
    var body = el('div', 'card-body');

    if (picked.length === 1) {
      var m = picked[0];
      var grid = el('div', 'row row-cards');
      function cell(label, val, sub) {
        var col = el('div', 'col-6 col-md-3');
        var c = el('div', 'card'), b = el('div', 'card-body');
        b.appendChild(el('div', 'lab', label));
        b.appendChild(el('div', 'kpi__val num mt-1', val));
        if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
        c.appendChild(b); col.appendChild(c); return col;
      }
      function kt(v) { return v == null ? '\u2014' : (v * KT).toFixed(1) + ' kt'; }
      grid.appendChild(cell('Entry speed', kt(m.entrySpeedMs)));
      grid.appendChild(cell('Lowest', kt(m.minSpeedMs)));
      grid.appendChild(cell('Exit speed', kt(m.exitSpeedMs)));
      grid.appendChild(cell(
        m.effBasis === 'vmg' ? 'VMG loss' : 'Speed loss',
        m.lossDisplayPct == null ? '\u2014' : Math.round(m.lossDisplayPct) + '%',
        m.effBasis === 'vmg'
          ? 'measured on VMG, not raw speed'
          : 'against ' + kt(m.refSpeedMs)));
      grid.appendChild(cell('Turn angle',
        m.turnAngle == null ? '\u2014' : Math.round(m.turnAngle) + '\u00b0'));
      grid.appendChild(cell('Turn rate',
        m.avgTurnRateDegSec == null ? '\u2014' : m.avgTurnRateDegSec.toFixed(1) + '\u00b0/s',
        m.maxTurnRateDegSec != null ? 'peak ' + m.maxTurnRateDegSec.toFixed(1) : ''));
      grid.appendChild(cell('Duration',
        m.durationSec == null ? '\u2014' : m.durationSec.toFixed(0) + ' s'));
      grid.appendChild(cell('Recovery',
        m.recoverySec == null ? 'not regained' : m.recoverySec.toFixed(1) + ' s',
        'back to cruising speed'));
      body.appendChild(grid);

      /* §454 — 속도와 VMG 는 갈릴 수 있다. 자이브는 VMG 기준으로 채점하는데
         SOG 는 올라가면서 VMG 는 무너지는 회전이 실제로 나온다(넓게 돌아
         풍하로 너무 흘렀거나 나쁜 각도로 나온 경우). 그때 "잘한 회전" 이라고
         쓰면 거짓이 되므로, 두 지표가 갈리면 갈렸다고 말한다. */
      var spedUp = (m.minSpeedMs != null && m.entrySpeedMs != null
                    && m.minSpeedMs >= m.entrySpeedMs);
      var scoredBad = (m.lossDisplayPct != null && m.lossDisplayPct >= 30);
      var scoredGood = (m.lossDisplayPct != null && m.lossDisplayPct < 8);
      if (spedUp && scoredBad && m.effBasis === 'vmg') {
        body.appendChild(el('div', 'alert alert-warning mt-3',
          'Raw speed held up through this turn \u2014 the lowest speed was above the '
          + 'entry speed \u2014 but VMG collapsed. That is the signature of turning too '
          + 'wide or exiting on a poor angle: fast through the water, little progress '
          + 'in the direction that counts.'));
      } else if (spedUp) {
        body.appendChild(el('div', 'alert alert-success mt-3',
          'The lowest speed through this turn was higher than the entry speed \u2014 '
          + 'you accelerated through it rather than losing speed.'));
      } else if (scoredGood) {
        body.appendChild(el('div', 'alert alert-success mt-3',
          (m.effBasis === 'vmg' ? 'Almost no VMG lost' : 'Almost no speed lost')
          + ' \u2014 a clean turn.'));
      }
    } else {
      var wrap = el('div', 'table-responsive');
      var t = el('table', 'table table-vcenter card-table table-sm');
      var th = el('thead'), htr = el('tr');
      ['#', 'Type', 'Side', 'Entry', 'Lowest', 'Exit', 'Loss', 'Recovery', 'Eff', 'Basis']
        .forEach(function (x, i) {
          htr.appendChild(el('th', i > 2 ? 'text-end' : null, x));
        });
      th.appendChild(htr); t.appendChild(th);
      var tb2 = el('tbody');
      picked.forEach(function (m, k) {
        var tr = el('tr');
        tr.appendChild(el('td', 'num', String(sel[k] + 1)));
        tr.appendChild(el('td', null, m.type === 'tack' ? 'Tack' : 'Gybe'));
        tr.appendChild(el('td', null,
          m.side === 'P' ? 'Port' : m.side === 'S' ? 'Stbd' : '\u2014'));
        [m.entrySpeedMs, m.minSpeedMs, m.exitSpeedMs].forEach(function (v) {
          tr.appendChild(el('td', 'text-end num',
            v == null ? '\u2014' : (v * KT).toFixed(1)));
        });
        tr.appendChild(el('td', 'text-end num',
          m.lossDisplayPct == null ? '\u2014' : Math.round(m.lossDisplayPct) + '%'));
        tr.appendChild(el('td', 'text-end num',
          m.recoverySec == null ? '\u2014' : m.recoverySec.toFixed(1) + ' s'));
        tr.appendChild(el('td', 'text-end num',
          m.efficiency == null ? '\u2014' : String(Math.round(m.efficiency))));
        tr.appendChild(el('td', 'text-end text-secondary',
          m.effBasis === 'vmg' ? 'VMG' : 'SOG'));
        tb2.appendChild(tr);
      });
      t.appendChild(tb2); wrap.appendChild(t); body.appendChild(wrap);
    }

    /* 속도 곡선 — apex 를 0 으로 맞춰 겹친다 */
    var plotHost = el('div', 'chart-host mt-3');
    plotHost.style.height = '220px';
    body.appendChild(plotHost);
    card.appendChild(body);
    host.appendChild(card);
    drawTurnCurves(plotHost, picked, sel);
  }

  /* apex 정렬 속도 곡선. 회전 전후 여유를 두고 잘라 "들어가서 나오기까지"
     한 장면으로 본다. */
  function drawTurnCurves(hostEl, picked, sel) {
    if (!window.uPlot || !CUR.session) return;
    var S = CUR.session.samples || [];
    if (!S.length) return;
    var PAD_SEC = 12;
    var series = [], tMin = 0, tMax = 0;
    picked.forEach(function (m) {
      var apexT = S[m.apexIdx] ? S[m.apexIdx].t : null;
      if (apexT == null) return;
      var pts = [];
      for (var i = 0; i < S.length; i++) {
        var dt = S[i].t - apexT;
        if (dt < -PAD_SEC) continue;
        if (dt > PAD_SEC) break;
        if (S[i].speed == null) continue;
        pts.push([dt, S[i].speed * KT]);
      }
      if (pts.length < 3) return;
      tMin = Math.min(tMin, pts[0][0]);
      tMax = Math.max(tMax, pts[pts.length - 1][0]);
      series.push({ m: m, pts: pts });
    });
    if (!series.length) { hostEl.textContent = 'No speed samples around these turns.'; return; }

    /* 공통 x 격자 위로 각 곡선을 옮긴다 — uPlot 은 단일 x 배열을 쓴다. */
    var STEP = 0.5, xs = [];
    for (var x = Math.floor(tMin); x <= Math.ceil(tMax); x += STEP) xs.push(x);
    var data = [xs];
    var opts = [];
    series.forEach(function (sr, k) {
      var ys = xs.map(function (xv) {
        var best = null, bd = Infinity;
        for (var j = 0; j < sr.pts.length; j++) {
          var d = Math.abs(sr.pts[j][0] - xv);
          if (d < bd) { bd = d; best = sr.pts[j][1]; }
        }
        return bd <= STEP ? best : null;
      });
      data.push(ys);
      opts.push({
        label: '#' + (sel[k] + 1) + ' ' + (sr.m.type === 'tack' ? 'tack' : 'gybe')
             + (sr.m.side === 'P' ? ' P' : sr.m.side === 'S' ? ' S' : ''),
        stroke: sr.m.side === 'P' ? '#e03131' : '#2f9e44',
        width: 1.6,
        value: function (u, v) { return v == null ? '\u2014' : v.toFixed(1) + ' kt'; }
      });
    });

    track(new uPlot({
      width: hostEl.clientWidth || 860, height: 200, padding: [12, 14, 4, 6],
      cursor: { drag: { x: true, y: false } },
      scales: { x: { time: false } },
      axes: [
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, ticks) {
            return ticks.map(function (v) {
              return (v > 0 ? '+' : '') + v.toFixed(0) + ' s';
            });
          } },
        { stroke: THEME.dim, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 44,
          values: function (u, ticks) {
            return ticks.map(function (v) { return v.toFixed(0) + ' kt'; });
          } }
      ],
      series: [{ label: 'From apex',
                 value: function (u, v) {
                   return v == null ? '\u2014' : (v > 0 ? '+' : '') + v.toFixed(1) + ' s';
                 } }].concat(opts)
    }, data, hostEl), hostEl);
  }

  /* §461 회전 연습 추이 — 세션을 4등분해 회전 품질이 어떻게 변했나.
     연습 세션에서는 "얼마나 멀리 갔나" 가 아니라 "회전이 늘었나" 가
     유일하게 의미 있는 질문이다.

     품질이 떨어진 구간이 나오면 **조건이 바뀐 건지 사람이 지친 건지**를
     같이 본다 — 활주 시간과 심박이 함께 떨어졌으면 바람이 죽은 것이고,
     심박이 유지된 채 품질만 떨어졌으면 피로다. 이 구분을 안 하면 바람이
     죽은 걸 기량 저하로 오독한다(8/31 실측: 4구간 심박 150→123). */
  /* §487 — 문답 탐지가 쓰는 4분위 요약. 회전 추이 카드가 만들던 것과
     같은 계산이라 여기 한 번만 두고 둘이 같이 쓴다. */
  function turnQuarters(a) {
    var mans = (a.maneuvers || []).filter(function (m) {
      return m.type === 'tack' || m.type === 'gybe';
    });
    var S = (CUR.session && CUR.session.samples) || [];
    if (mans.length < 12 || !S.length) return null;
    var t0 = S[0].t, span = S[S.length - 1].t - t0;
    if (!(span > 0)) return null;
    var Q = 4, bk = [];
    for (var q = 0; q < Q; q++) bk.push({ turns: [], hrSum: 0, hrN: 0 });
    mans.forEach(function (m) {
      var qi = Math.min(Q - 1, Math.floor(m.tSec / span * Q));
      if (qi >= 0) bk[qi].turns.push(m);
    });
    for (var i = 1; i < S.length; i++) {
      var dt = S[i].t - S[i - 1].t;
      if (!(dt > 0) || dt > 5 || S[i].hr == null) continue;
      var qj = Math.min(Q - 1, Math.floor((S[i].t - t0) / span * Q));
      bk[qj].hrSum += S[i].hr; bk[qj].hrN++;
    }
    return bk.map(function (b, q) {
      return { q: q, n: b.turns.length,
               foil: b.turns.filter(function (m) { return m.foilKept; }).length,
               hr: b.hrN ? b.hrSum / b.hrN : null };
    });
  }

  /* §487 세션 문답 — 트랙만 봐서는 갈리지 않는 것을 라이더에게 묻는다.
     "왜 느렸는지" 는 탄 사람만 안다. 답 하나가 서술을 바꾸고, 필요하면
     그 구간을 성능 통계에서 뺀다(이유가 붙은 제외로). */
  function renderSessionQA(host, a) {
    if (!window.RDSessionQA || !CUR.session) return;
    var quarters = null;
    try { quarters = turnQuarters(a); } catch (e) { quarters = null; }
    var qs;
    try { qs = RDSessionQA.detect(CUR.session, a, { quarters: quarters }); }
    catch (e) { qs = []; }
    qs = qs || [];

    var sig = null;
    try { sig = sessionSig(CUR.fullSession || CUR.session); } catch (e) {}
    var answers = {};
    try { if (sig && window.RDStorage) answers = RDStorage.loadSessionAnswers(sig) || {}; }
    catch (e) {}

    /* 이미 답한 질문은 **탐지에서 사라져도 남긴다.** "옆에서 봐줬다" 고
       답하면 그 구간이 통계에서 빠지고, 그러면 이상징후 자체가 사라져
       질문이 없어진다 — 답을 되돌릴 방법도 같이 사라진다는 뜻이다.
       저장된 답의 구간으로 질문을 되살려 항상 보이게 한다. */
    var seen = {};
    qs.forEach(function (q) { seen[q.id] = true; });
    Object.keys(answers).forEach(function (qid) {
      if (seen[qid]) return;
      var def = RDSessionQA.QUESTIONS[qid];
      if (!def) return;
      var rec = answers[qid];
      qs.push({
        id: qid, title: def.title, options: def.options,
        evidence: 'Answered — this stretch ('
          + RDSessionQA.fmtClock(rec.fromSec) + '–' + RDSessionQA.fmtClock(rec.toSec)
          + ') is being treated as you described.',
        fromSec: rec.fromSec, toSec: rec.toSec
      });
    });
    if (!qs.length) return;

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'A few things the track cannot tell'));
    var pending = qs.filter(function (q) { return !answers[q.id]; }).length;
    head.appendChild(el('div', 'card-actions lab',
      pending ? (pending + ' unanswered') : 'all answered'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    qs.forEach(function (q) {
      var sec = el('div', 'mb-3');
      sec.appendChild(el('div', 'fw-bold', q.title));
      sec.appendChild(el('div', 'text-secondary mt-1', q.evidence));
      var row = el('div', 'd-flex flex-wrap gap-2 mt-2');
      q.options.forEach(function (o) {
        var picked = answers[q.id] && answers[q.id].key === o.key;
        var b = el('button', 'btn btn-sm' + (picked ? ' active' : ''));
        b.type = 'button';
        b.textContent = o.label;
        if (picked) {
          b.style.borderColor = THEME.accent;
          b.style.color = THEME.accent;
        }
        b.addEventListener('click', function () {
          /* 답에는 **그때의 구간**을 함께 저장한다. 제외를 적용하려고
             매번 다시 탐지하면, 이미 제외된 세션에서 탐지하게 되어
             질문이 사라지고 답도 무효가 되는 순환에 빠진다. */
          var cur = answers[q.id] && answers[q.id].key;
          var next = (cur === o.key) ? null
            : { key: o.key, effect: o.effect, fromSec: q.fromSec, toSec: q.toSec };
          try { if (sig) RDStorage.saveSessionAnswer(sig, q.id, next); } catch (e) {}
          reapplyEdits();          /* 답이 제외구간을 만들 수 있으므로 전체 재계산 */
        });
        row.appendChild(b);
      });
      sec.appendChild(row);
      if (answers[q.id]) {
        var ansKey = answers[q.id].key;
        var opt = q.options.filter(function (o) { return o.key === ansKey; })[0];
        if (opt && opt.effect === 'exclude') {
          sec.appendChild(el('div', 'lab mt-2',
            'That stretch is out of the performance numbers. Press again to undo.'));
        } else if (opt && opt.effect === 'fatigue') {
          sec.appendChild(el('div', 'lab mt-2',
            'Kept in the numbers, flagged as a training-load signal.'));
        } else if (opt) {
          sec.appendChild(el('div', 'lab mt-2', 'Kept in the numbers.'));
        }
      }
      body.appendChild(sec);
    });

    var f = el('div', 'text-secondary');
    f.style.fontSize = '.8125rem';
    f.textContent = 'Speed falling can mean the wind dropped, or that you were riding '
      + 'slowly with someone, or winding down — they look identical on a track. '
      + 'Rather than guess, the dashboard asks. Answers are remembered for this session.';
    body.appendChild(f);
    card.appendChild(body);
    host.appendChild(card);
  }

  function renderTurnProgression(host, a) {
    var mans = (a.maneuvers || []).filter(function (m) {
      return m.type === 'tack' || m.type === 'gybe';
    });
    if (mans.length < 12) return;
    var S = (CUR.session && CUR.session.samples) || [];
    if (!S.length) return;
    var t0 = S[0].t, tN = S[S.length - 1].t, span = tN - t0;
    if (!(span > 0)) return;

    var Q = 4, buckets = [];
    for (var q = 0; q < Q; q++) {
      buckets.push({ turns: [], planingSec: 0, hrSum: 0, hrN: 0 });
    }
    mans.forEach(function (m) {
      var qi = Math.min(Q - 1, Math.floor(m.tSec / span * Q));
      if (qi >= 0) buckets[qi].turns.push(m);
    });
    for (var i = 1; i < S.length; i++) {
      var dt = S[i].t - S[i - 1].t;
      if (!(dt > 0) || dt > 5) continue;
      var qj = Math.min(Q - 1, Math.floor((S[i].t - t0) / span * Q));
      var bk = buckets[qj];
      if (S[i].speed != null && S[i].speed * KT >= 12) bk.planingSec += dt;
      if (S[i].hr != null) { bk.hrSum += S[i].hr; bk.hrN++; }
    }

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'How the turns went over the session'));
    head.appendChild(el('div', 'card-actions lab',
      mans.length + ' turns, split into quarters'));
    card.appendChild(head);
    var body = el('div', 'card-body');
    var wrap = el('div', 'table-responsive');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Quarter', 'Turns', 'Efficiency', 'Entry', 'Lowest', 'Exit',
     'Stayed on foil', 'Planing', 'Avg HR'].forEach(function (x, i) {
      htr.appendChild(el('th', i ? 'text-end' : null, x));
    });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    function mean(arr, f) {
      var v = arr.map(f).filter(function (x) { return x != null && isFinite(x); });
      return v.length ? v.reduce(function (p2, c) { return p2 + c; }, 0) / v.length : null;
    }
    var rows = [];
    buckets.forEach(function (bk, q) {
      var n = bk.turns.length;
      var r = {
        q: q, n: n,
        eff: mean(bk.turns, function (m) { return m.efficiency; }),
        foil: bk.turns.filter(function (m) { return m.foilKept; }).length,
        entry: mean(bk.turns, function (m) { return m.entrySpeedMs; }),
        low: mean(bk.turns, function (m) { return m.minSpeedMs; }),
        exit: mean(bk.turns, function (m) { return m.exitSpeedMs; }),
        planingSec: bk.planingSec,
        hr: bk.hrN ? bk.hrSum / bk.hrN : null
      };
      rows.push(r);
      var tr = el('tr');
      tr.appendChild(el('td', null, (q + 1) + ' of 4'));
      tr.appendChild(el('td', 'text-end num', String(n)));
      tr.appendChild(el('td', 'text-end num',
        r.eff == null ? '—' : Math.round(r.eff)));
      [r.entry, r.low, r.exit].forEach(function (v) {
        tr.appendChild(el('td', 'text-end num',
          v == null ? '—' : (v * KT).toFixed(1)));
      });
      tr.appendChild(el('td', 'text-end num', n ? (r.foil + '/' + n) : '—'));
      tr.appendChild(el('td', 'text-end num', fmtClock(r.planingSec)));
      tr.appendChild(el('td', 'text-end num',
        r.hr == null ? '—' : Math.round(r.hr)));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);

    var first = rows[0], last = rows[rows.length - 1];
    var withEff = rows.filter(function (r) { return r.eff != null; });
    var best = withEff.slice().sort(function (x, y) { return y.eff - x.eff; })[0];
    var msgs = [];
    /* §487 — 마지막 구간을 답변으로 빼 버렸으면 아래 degraded 분기가 아예
       안 걸린다(이상징후가 사라졌으니). 그래도 왜 뺐는지는 말해 줘야 한다. */
    try {
      if (window.RDSessionQA && window.RDStorage && CUR.fullSession) {
        var sigN = sessionSig(CUR.fullSession);
        var recN = sigN ? (RDStorage.loadSessionAnswers(sigN) || {}).lateDrop : null;
        if (recN && recN.key) {
          var told = RDSessionQA.narrate('lateDrop', recN.key);
          if (told) msgs.push(told);
        }
      }
    } catch (e) {}
    if (first.eff != null && best && best.q !== 0 && best.eff - first.eff >= 8) {
      msgs.push('Turn efficiency rose from ' + Math.round(first.eff)
        + ' in the first quarter to ' + Math.round(best.eff) + ' by quarter '
        + (best.q + 1) + '. The warm-up is real — count the opening turns of a '
        + 'session as warm-up, not as your level.');
    }
    /* 마지막 구간이 나빠졌는지는 효율만으로 판단하면 안 된다. 효율은
       상대 지표라 조건이 나빠져도 잘 안 움직인다 — 실제로 8/31 4구간은
       효율이 3점밖에 안 떨어졌지만 포일 유지가 22/24 → 7/12 로 무너졌다.
       포일 유지율·진입 속도까지 함께 본다. */
    function foilRate(r) { return r.n ? r.foil / r.n : null; }
    var bestFoil = null;
    withEff.forEach(function (r) {
      var fr = foilRate(r);
      if (fr != null && (bestFoil == null || fr > bestFoil.rate)) {
        bestFoil = { rate: fr, r: r };
      }
    });
    var lastFoil = foilRate(last);
    var effDrop = (last.eff != null && best) ? best.eff - last.eff : 0;
    var foilDrop = (bestFoil && lastFoil != null) ? bestFoil.rate - lastFoil : 0;
    var entryDrop = (best && best.entry != null && last.entry != null)
      ? (best.entry - last.entry) * KT : 0;
    var degraded = (effDrop >= 8) || (foilDrop >= 0.25) || (entryDrop >= 2);

    if (degraded) {
      var planingDrop = best.planingSec > 0
        ? 1 - (last.planingSec / best.planingSec) : 0;
      var hrDrop = (best.hr != null && last.hr != null) ? (best.hr - last.hr) : null;
      var what = [];
      if (foilDrop >= 0.15 && lastFoil != null) {
        what.push('turns holding the foil fell to ' + last.foil + ' of ' + last.n);
      }
      if (entryDrop >= 1.5) {
        what.push('entry speed dropped ' + entryDrop.toFixed(1) + ' kt');
      }
      if (effDrop >= 8) what.push('efficiency fell ' + Math.round(effDrop) + ' points');
      var lead = 'By the last quarter ' + (what.length ? what.join(' and ') : 'turn quality fell')
        + '. ';
      if (planingDrop > 0.35 && hrDrop != null && hrDrop > 12) {
        /* §487 (옥대표) — 여기서 예전에는 "바람이 죽은 것" 이라고 **단정**했다.
           8/31 의 실제 답은 셋째였다: "여친이 타는거 옆에서 봐주느라 천천히
           주위를 맴돌면서 다녔다." 속도와 심박이 같이 떨어지는 건 바람이
           죽어도, 누굴 옆에서 봐줘도, 마무리로 슬슬 타도 똑같이 보인다.
           트랙만으로는 못 가린다 → 라이더 답이 있으면 그 답을 말하고,
           없으면 후보를 늘어놓되 고르지 않는다. */
        var qaAns = null;
        try {
          if (window.RDSessionQA && window.RDStorage && CUR.session) {
            var sigQ = sessionSig(CUR.session);
            var recQ = sigQ ? (RDStorage.loadSessionAnswers(sigQ) || {}).lateDrop : null;
            qaAns = recQ && recQ.key;
          }
        } catch (e) {}
        /* 위에서 이미 답변 서술을 넣었으면 여기서는 증거만 적는다 */
        msgs.push(lead + 'Planing time also fell ' + Math.round(planingDrop * 100)
          + '% and average heart rate dropped ' + Math.round(hrDrop) + ' bpm. '
          + (qaAns ? '' : RDSessionQA.undecided('lateDrop')));
      } else if (hrDrop != null && hrDrop < 5) {
        msgs.push(lead + 'Heart rate held up through it, which reads as fatigue '
          + 'rather than conditions \u2014 the useful part of a session can end '
          + 'before the time does.');
      } else {
        msgs.push(lead + 'Planing time went from ' + fmtClock(best.planingSec)
          + ' to ' + fmtClock(last.planingSec) + ' and average heart rate from '
          + (best.hr != null ? Math.round(best.hr) : '\u2014') + ' to '
          + (last.hr != null ? Math.round(last.hr) : '\u2014')
          + ' \u2014 read those together before blaming technique.');
      }
    }

    /* 진입 대비 탈출 — "속도가 죽어서 살려내기 힘들다" 는 체감이 여기 남는다. */
    var loss = withEff.map(function (r) {
      return (r.entry != null && r.exit != null) ? (r.entry - r.exit) * KT : null;
    }).filter(function (v) { return v != null; });
    if (loss.length) {
      var avgLoss = loss.reduce(function (x, y) { return x + y; }, 0) / loss.length;
      if (avgLoss >= 2) {
        msgs.push('Across the session a turn ended about '
          + avgLoss.toFixed(1) + ' kt slower than it started. In light wind that is '
          + 'the hard part \u2014 there is little power to rebuild speed with, so '
          + 'the exit angle matters more than usual: bear away further before '
          + 'sheeting in, and accept a wider turn to keep the foil flying.');
      }
    }
    msgs.forEach(function (mm) {
      body.appendChild(el('div', 'alert alert-info mt-3', mm));
    });
    card.appendChild(body);
    host.appendChild(card);
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
    f.textContent = 'Groups with only two or three turns move a lot on one bad turn \u2014 '
      + 'read the count before the average. Efficiency and loss are measured on VMG '
      + 'where the wind angle is reliable (usually gybes) and on plain speed otherwise, '
      + 'so the two turn types are not on an identical scale.';
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
    /* 힐·피치는 자세 데이터가 있는 세션에서만 고를 수 있다. 없는데
       메뉴에 두면 골랐을 때 빈 화면이 나온다. */
    var hasAtt = ['upwind', 'downwind'].some(function (mk) {
      var g = ts[mk];
      return ['P', 'S'].some(function (sd) {
        var arr = g && g[sd] && g[sd].samples;
        return arr && arr.length && arr[0].heel != null;
      });
    });
    var metricOpts = [['sog', 'Speed'], ['vmg', 'VMG'], ['twa', 'Wind angle']];
    if (hasAtt) metricOpts.push(['heel', 'Heel'], ['pitch', 'Pitch']);
    if (!hasAtt && (TDIST.metric === 'heel' || TDIST.metric === 'pitch')) {
      TDIST.metric = 'sog';
    }
    act.appendChild(pick(metricOpts,
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
    /* 값 변환 — 속도·VMG 는 m/s 라 kt 로, 각도는 도 그대로.
       힐은 부호가 곧 좌우 기울기라 절대값으로 크기만 본다(포트/스타보드
       구분은 이미 위/아래 분리가 담당한다). 피치는 부호가 노즈업/다운을
       뜻하므로 부호를 살린다 — 절대값을 씌우면 두 상태가 겹쳐버린다. */
    function val(x) {
      var v = x[M];
      if (v == null || !isFinite(v)) return null;
      if (M === 'pitch') return v;
      if (M === 'twa' || M === 'heel') return Math.abs(v);
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
    var W = 640, H = 150, MID = H / 2;   /* W 는 viewBox 단위 — 화면 폭은 CSS 100% */
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    /* §486 (옥대표 "우측 하단이 비어보이는게 거슬린다") — 이 SVG 는
       maxWidth 640px 로 잠겨 있어서, 카드가 1800px 여도 왼쪽 640px 만
       쓰고 오른쪽 절반이 통째로 비었다. 잠금을 풀고 카드 폭을 채운다.
       preserveAspectRatio="none" + 고정 높이 → 가로만 늘어나고 막대
       높이(=세로 스케일)는 그대로다. 히스토그램이라 가로로 늘어나도
       뜻이 안 변한다.
       축 라벨만은 늘어나면 안 되므로 SVG 밖 HTML 로 뺐다(아래). */
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = '100%';
    svg.style.height = H + 'px';
    svg.style.display = 'block';
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
    body.appendChild(svg);
    /* 축 라벨 — SVG 가로 확대에 딸려 늘어나지 않도록 HTML 로 */
    var isDeg = (M === 'twa' || M === 'heel' || M === 'pitch');
    var axisRow = el('div', 'd-flex justify-content-between lab mt-1');
    [0, 0.5, 1].forEach(function (f) {
      axisRow.appendChild(el('span', null,
        (lo + f * (hi - lo)).toFixed(isDeg ? 0 : 1) + (isDeg ? '\u00b0' : ' kt')));
    });
    body.appendChild(axisRow);

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
      var unit = (M === 'twa' || M === 'heel' || M === 'pitch') ? '\u00b0' : ' kt';
      d.appendChild(el('span', 'text-secondary',
        label + ' \u00b7 ' + arr.length + ' samples'
        + (med != null ? ' \u00b7 median ' + med.toFixed(1) + unit : '')));
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

  /* §465 장비 선택 — 바람만으로는 윙 크기를 답할 수 없다.
     포일 면적이 이륙 속도를, 포일 스팬과 마스트가 벤틸레이션 한계를,
     핸드윙 스팬이 팁 접촉 한계를, 수면 상태가 그 두 여유를 정한다.
     선택은 라이더 프로필에 저장돼 다음 세션에 그대로 쓰인다. */
  function gearSelection() {
    var rp = {};
    try { rp = (window.RDStorage && RDStorage.loadRider) ? (RDStorage.loadRider() || {}) : {}; }
    catch (e) {}
    var g = rp.gear || {};
    var D = RDGear.DEFAULT;
    return {
      frontWing: g.frontWing || D.frontWing,
      rearWing: g.rearWing || D.rearWing,
      mast: g.mast || D.mast,
      handWing: g.handWing || D.handWing,
      board: g.board || D.board,
      surface: g.surface || D.surface,
      harness: g.harness || D.harness
    };
  }

  function saveGear(patch) {
    var rp = {};
    try { rp = (window.RDStorage && RDStorage.loadRider) ? (RDStorage.loadRider() || {}) : {}; }
    catch (e) {}
    rp.gear = Object.assign({}, gearSelection(), patch);
    try { RDStorage.saveRider(rp); } catch (e) {}
  }

  function renderGearPicker(host) {
    if (!window.RDGear || !window.RDRigLimits) return;
    var sel = gearSelection();

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Your gear today'));
    head.appendChild(el('div', 'card-actions lab',
      'foil area sets take-off, spans set how far you can heel'));
    card.appendChild(head);
    var body = el('div', 'card-body');
    var row = el('div', 'row g-2');

    function pick(label, key, list, fmt, cls) {
      var col = el('div', cls || 'col-6 col-md-4');
      col.appendChild(el('label', 'form-label lab', label));
      var s = el('select', 'form-select');
      list.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.id; op.textContent = fmt(o);
        if (o.id === sel[key]) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener('change', function () {
        var p = {}; p[key] = s.value; saveGear(p);
        renderCoach(CUR.analysis, CUR.vps, CUR.whatIf);
      });
      col.appendChild(s);
      return col;
    }
    row.appendChild(pick('Front wing', 'frontWing', RDGear.FRONT_WINGS,
      function (o) { return o.label + '  ' + o.areaCm2 + 'cm² / ' + o.spanCm + 'cm'; }));
    row.appendChild(pick('Mast', 'mast', RDGear.MASTS,
      function (o) { return o.label + '  ' + o.lengthCm + 'cm'; }));
    row.appendChild(pick('Hand wing', 'handWing', RDGear.HAND_WINGS,
      function (o) {
        /* 스팬이 추정값이면 그렇다고 적는다 — 이 값이 힐 한계를 정하므로
           확정치와 섞이면 안 된다. */
        return o.label + '  span ' + (o.spanCm / 100).toFixed(2) + 'm'
          + (o.estimated ? ' (est.)' : '');
      }));
    row.appendChild(pick('Rear wing', 'rearWing', RDGear.REAR_WINGS,
      function (o) { return o.label + '  ' + o.spanCm + 'cm'; }));
    row.appendChild(pick('Harness', 'harness', RDGear.HARNESS,
      function (o) { return o.label; }));
    row.appendChild(pick('Water state', 'surface', RDGear.SURFACE,
      function (o) { return o.label; }));
    body.appendChild(row);

    /* 이 조합이 만드는 한계 */
    var rider = null;
    try {
      var r = RDStorage.loadRider() || {};
      rider = r.weightKg || null;
    } catch (e) {}
    if (!rider) {
      body.appendChild(el('div', 'text-secondary mt-3',
        'Enter your weight (with wetsuit) in the Training load tab to see what '
        + 'this setup can hold.'));
      card.appendChild(body); host.appendChild(card); return;
    }
    var rig = RDGear.rigMassKg(sel);
    /* 하네스를 어디에 두느냐가 윙 높이를 바꾸고, 그게 팁 여유를 바꾼다.
       옥대표: 오버면 가슴으로 올려 끌려가듯, 풀파워면 엉덩이로 내려
       윙 힘을 아래로 실어 보드를 누른다 — 후자는 팁 여유를 잃는다. */
    var riderH = 175;
    try { riderH = (RDStorage.loadRider() || {}).heightCm || 175; } catch (e) {}
    var handH = RDGear.harnessHeightCm(riderH, sel.harness);
    var lim = RDRigLimits.analyze({
      mast: RDGear.byId(RDGear.MASTS, sel.mast),
      frontWing: RDGear.byId(RDGear.FRONT_WINGS, sel.frontWing),
      handWing: RDGear.byId(RDGear.HAND_WINGS, sel.handWing),
      board: RDGear.byId(RDGear.BOARDS, sel.board) || RDGear.BOARDS[0],
      surface: RDGear.byId(RDGear.SURFACE, sel.surface)
    }, { riderMassKg: rider, totalMassKg: rider + rig, handHeightCm: handH });

    var grid = el('div', 'row row-cards mt-3');
    function tile(label, val, sub) {
      var col = el('div', 'col-6 col-md-3');
      var c = el('div', 'card'), b = el('div', 'card-body');
      b.appendChild(el('div', 'lab', label));
      b.appendChild(el('div', 'kpi__val num mt-1', val));
      if (sub) b.appendChild(el('div', 'kpi__sub mt-1', sub));
      c.appendChild(b); col.appendChild(c); return col;
    }
    grid.appendChild(tile('Take-off speed',
      lim.minFlyingSpeedKt != null ? lim.minFlyingSpeedKt.toFixed(1) + ' kt' : '—',
      'set by foil area'));
    grid.appendChild(tile('Heel available',
      Math.round(lim.maxHeelDeg) + '°',
      'before the ' + (lim.bindingConstraint === 'foil' ? 'foil tip surfaces'
                                                        : 'wing tip catches')));
    /* §471 옥대표 교정 — 일직선이면 라이더+장비 전체 무게가 버틴다.
       (예전 라벨은 "rider mass only" 였는데 계산은 이미 전체 무게였다) */
    grid.appendChild(tile('Side force you can hold',
      lim.sideForceCapacityN != null ? Math.round(lim.sideForceCapacityN) + ' N' : '—',
      'you and the rig, leaning in line'));
    grid.appendChild(tile('All-up weight',
      (rider + rig).toFixed(0) + ' kg',
      rider + ' kg you + ' + rig.toFixed(1) + ' kg gear'));
    body.appendChild(grid);

    /* §469 — 이 바람에서 뭘 쓸지. 기준은 옥대표 본인의 선택표이고,
       물리는 "그 조합이 한계에 얼마나 붙어 있는지" 를 경고로 얹는다.
       다섯 점으로 물리 규칙을 맞추려다 실패했고(저풍=최소·강풍=최대),
       외운 곡선을 물리인 척 내놓지 않기 위해 이렇게 나눈다. */
    var windKt = windSpeedFromForm();
    if (windKt > 0 && RDGear.wingForWind) {
      var suggested = RDGear.wingForWind(windKt);
      var chosen = RDGear.byId(RDGear.HAND_WINGS, sel.handWing);
      var box = el('div', 'alert ' +
        (chosen && Math.abs(chosen.areaM2 - suggested) < 0.01 ? 'alert-success' : 'alert-info')
        + ' mt-3');
      box.appendChild(el('div', 'fw-bold',
        'At ' + windKt + ' kt you normally ride ' + suggested.toFixed(1) + ' m²'));
      if (chosen && Math.abs(chosen.areaM2 - suggested) >= 0.01) {
        box.appendChild(el('div', 'mt-1',
          'You have ' + chosen.areaM2.toFixed(1) + ' m² selected above.'));
      }
      /* 고른 윙이 기하 한계에 얼마나 붙었나 */
      if (chosen) {
        var hw = RDRigLimits.maxHeelWing(chosen.spanCm, lim.rideHeightCm,
          (RDGear.byId(RDGear.BOARDS, sel.board) || RDGear.BOARDS[0]).thicknessCm,
          handH, RDGear.byId(RDGear.SURFACE, sel.surface).wingMarginCm);
        var hf = RDRigLimits.maxHeelFoil(RDGear.byId(RDGear.MASTS, sel.mast).lengthCm,
          RDGear.byId(RDGear.FRONT_WINGS, sel.frontWing).spanCm,
          lim.rideHeightCm, RDGear.byId(RDGear.SURFACE, sel.surface).foilMarginCm);
        var avail = Math.min(hw, hf);
        box.appendChild(el('div', 'mt-1 text-secondary',
          'Geometry allows ' + Math.round(avail) + '° of heel with this setup on '
          + lim.surface.toLowerCase() + ' water, limited by the '
          + (hw <= hf ? 'wing tip' : 'foil tip') + '.'));
      }
      body.appendChild(box);
    }

    var note = el('div', 'text-secondary mt-3');
    note.style.fontSize = '.8125rem';
    note.textContent = 'Heeling the board tilts the foil from vertical toward '
      + 'horizontal, which is how it resists the wing’s side pull — so more '
      + 'heel means more wing you can hold. Two things stop you: the foil tip '
      + 'breaking the surface (ventilation) and the wing tip catching the water. '
      + 'Rough water eats the margin on both, which is why the same wing that is '
      + 'fine on flat water is unusable in chop. On this setup the '
      + (lim.bindingConstraint === 'foil' ? 'foil' : 'wing')
      + ' runs out first at ' + lim.surface.toLowerCase() + '.';
    body.appendChild(note);

    card.appendChild(body);
    host.appendChild(card);
  }

  function renderCoach(a, vps, whatIf) {
    var host = $('coach-body');
    while (host.firstChild) host.removeChild(host.firstChild);

    renderGearPicker(host);

    /* 1) SPS 분해 — 총점만 보여주면 무엇을 고쳐야 할지 알 수 없다 */
    host.appendChild(el('h3', 'mb-2', 'Sailing Performance Score'));
    /* §482 — 어떤 포일로 예측했는지 밝힌다. 포일 종횡비가 예측 VMG 를
       크게 바꾸는데(AR 6.5 → 13.7 은 약풍에서 +2kt) 그걸 안 적으면
       점수가 왜 움직였는지 알 길이 없다. */
    var basisR = riderFromForm();
    host.appendChild(el('div', 'text-secondary mb-3',
      'Speed is scored against what the lift calculator predicts is achievable '
      + 'for your weight, wing and skill in these conditions'
      + (basisR.foilLabel
          ? ', on your ' + basisR.foilLabel + ' (aspect ratio ' + basisR.foilAR + ')'
          : '')
      + '.'));
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
  var mapInst = null, mapMode = 'speed', mapCtx = null;

  function mapSwatch(color, w, h, round) {
    var sw = el('span');
    sw.style.cssText = 'width:' + w + 'px;height:' + h + 'px;background:' + color +
      ';border-radius:' + (round ? '50%' : '2px');
    return sw;
  }
  function legendItem(sw, text) {
    var it = el('span', 'd-inline-flex align-items-center gap-1');
    it.appendChild(sw); it.appendChild(el('span', null, text));
    return it;
  }

  function renderTrack(session, analysis) {
    mapCtx = { session: session, analysis: analysis };
    var host = $('map-host');
    if (!host) return;
    if (mapInst && mapInst.map) { try { mapInst.map.remove(); } catch (e) {} }
    mapInst = null;
    var lg = $('map-legend'), note = $('map-mode-note'), cav = $('map-caveat');
    if (lg) while (lg.firstChild) lg.removeChild(lg.firstChild);
    if (note) note.textContent = '';
    if (cav) cav.textContent = '';

    /* 모드 버튼 상태 — 풍향이 없으면 전술 모드는 쓸 수 없다. */
    var haveWind = analysis && analysis.windDir != null;
    var group = $('map-mode');
    if (group) {
      Array.prototype.forEach.call(group.querySelectorAll('button'), function (b) {
        var m = b.getAttribute('data-mode');
        var off = (m !== 'speed') && !haveWind;
        b.disabled = off;
        b.title = off ? 'Needs a wind direction' : '';
        b.classList.toggle('active', m === mapMode);
      });
    }
    if (!haveWind && mapMode !== 'speed') mapMode = 'speed';

    if (mapMode === 'speed') {
      if (!window.RDMapV2) return;
      mapInst = RDMapV2.render(host, session, analysis, { height: 460 });
      if (!mapInst || !lg) return;
      if (note) note.textContent = 'colour = boat speed';
      var prev = 0;
      mapInst.tiers.forEach(function (t) {
        lg.appendChild(legendItem(mapSwatch(t.c, 14, 6),
          t.max > 1000 ? prev + '+ kt' : prev + '\u2013' + t.max + ' kt'));
        prev = t.max;
      });
      lg.appendChild(legendItem(mapSwatch('#4dabf7', 8, 8, true), 'tack'));
      lg.appendChild(legendItem(mapSwatch('#f76707', 8, 8, true), 'gybe'));
      return;
    }

    if (!window.RDMapTactical) return;

    /* §476 회전 손실 — 표는 "얼마나" 를 알려주지만 "어디서" 를 못 알려준다.
       같은 자이브라도 코스 한쪽 끝에서만 무너진다면 그건 기술이 아니라
       그 자리의 바람·파도일 수 있다. */
    if (mapMode === 'loss') {
      var losses = [];
      if (window.RDGainLoss && analysis.windDir != null) {
        try { losses = RDGainLoss.maneuverLoss(session, analysis.maneuvers || [],
                                               analysis.windDir) || []; }
        catch (e) { losses = []; }
      }
      mapInst = RDMapTactical.renderLoss(host, session, analysis,
        { height: 460, losses: losses });
      if (!mapInst) return;
      if (note) note.textContent = 'circle area = distance lost in the turn';
      lg.appendChild(legendItem(mapSwatch('#4dabf7', 10, 10, true), 'tack'));
      lg.appendChild(legendItem(mapSwatch('#f76707', 10, 10, true), 'gybe'));
      var ls = mapInst.stats;
      if (cav) {
        cav.textContent = ls.scored + ' of ' + (ls.scored + ls.unscored)
          + ' turns had a measurable loss, ' + Math.round(ls.totalLossM)
          + ' m in total (biggest ' + Math.round(mapInst.maxLossM) + ' m). '
          + 'Hollow circles are turns where there was no steady run either side to '
          + 'measure against \u2014 they are drawn, not hidden, so the map does not '
          + 'read as if you never turned there.';
      }
      return;
    }

    mapInst = RDMapTactical.render(host, session, analysis,
      { height: 460, mode: mapMode === 'tack' ? 'tack' : 'shift' });
    if (!mapInst) return;

    if (mapMode === 'tack') {
      if (note) note.textContent = 'colour = which tack \u00b7 width = wind pressure';
      lg.appendChild(legendItem(mapSwatch(RDMapTactical.tackColor('P'), 14, 6), 'port'));
      lg.appendChild(legendItem(mapSwatch(RDMapTactical.tackColor('S'), 14, 6), 'starboard'));
    } else {
      if (note) note.textContent = 'colour = wind shift \u00b7 width = wind pressure';
      lg.appendChild(legendItem(mapSwatch(RDMapTactical.shiftColor(-10), 14, 6), 'lifted'));
      lg.appendChild(legendItem(mapSwatch(RDMapTactical.shiftColor(0), 14, 6), 'as usual'));
      lg.appendChild(legendItem(mapSwatch(RDMapTactical.shiftColor(10), 14, 6), 'headed'));
    }
    lg.appendChild(legendItem(mapSwatch('#8b98a5', 14, 2), 'lull'));
    lg.appendChild(legendItem(mapSwatch('#8b98a5', 14, 6), 'gust'));

    var st = mapInst.stats;
    if (st && st.n && cav) {
      var pct = function (v) { return Math.round(v / st.n * 100) + '%'; };
      cav.textContent = 'Shifts: ' + pct(st.lift) + ' lifted, ' + pct(st.header) +
        ' headed. Pressure: ' + pct(st.gust) + ' above / ' + pct(st.lull) + ' below your usual. ' +
        'Inferred from the track \u2014 no wind instrument, so lost trim or a wave reads the same way.';
    }
  }

  function bindMapMode() {
    var g = document.getElementById('map-mode');
    if (!g) { document.addEventListener('DOMContentLoaded', bindMapMode, { once: true }); return; }
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-mode]');
      if (!b || b.disabled) return;
      mapMode = b.getAttribute('data-mode');
      if (mapCtx) renderTrack(mapCtx.session, mapCtx.analysis);
    });
  }
  bindMapMode();

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

  var qaApplying = false;
  function show(session, analysis, name, est, fullSession) {
    CUR.fullSession = fullSession || CUR.fullSession || session;
    /* §487 — 저장된 문답 답변이 만든 제외구간을 **첫 표시에서도** 적용한다.
       예전에는 답을 누른 그 순간에만 반영되고, 다음에 파일을 다시 열면
       답은 남아 있는데 숫자는 제외 전으로 돌아갔다. 답이 통계를 바꾸는
       기능이라면 새로 열 때도 같은 숫자가 나와야 한다.
       qaApplying 으로 한 번만 — reapplyEdits 가 다시 show 를 부르므로. */
    if (!qaApplying && session === CUR.fullSession) {
      var qx = [];
      try { qx = qaExclusions(); } catch (e) { qx = []; }
      if (qx.length) {
        qaApplying = true;
        try { reapplyEdits(); } finally { qaApplying = false; }
        return;
      }
    }
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
    autoRecordRideLoad();
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
    renderTimeline(session, analysis);
    renderTurns(analysis);
    renderTurnExtras(analysis);
    renderPerfExtra(analysis);
    renderSessions();
    renderTraining();
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
    /* §465 — 장비 선택이 바뀌면 코치 탭만 다시 그린다. 그때 쓰려고
       whatIf 를 남겨 둔다(예전에는 CUR 에 없어 undefined 가 넘어갔다). */
    CUR.whatIf = whatIf;
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
    /* 훈련부하는 현재 세션과 무관하게 원장을 본다 — 파일을 올리지 않아도
       탭을 열면 보여야 한다. */
    try { renderTraining(); } catch (e) {}
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
          workload: v2SessionWorkload(),   // §458 훈련부하 AU + 산출 방식
          sig: sessionSig(CUR.session),    // §463 자동 기록분과 중복 방지
          gpxText: CUR.gpxText
        }, CUR.analysis);
        if (res && res.ok) {
          renderSessions();
          /* 저장하면 부하 원장에 들어가므로 훈련부하 탭도 갱신한다. */
          renderTraining();
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
      CUR.isDemo = false;
      loadFiles(e.target.files);
    });
    /* 드래그앤드롭도 받는다 — 파일 여러 개를 한 번에 던지는 게 자연스럽다 */
    ['dragover', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        e.preventDefault();
        if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files) {
          CUR.isDemo = false;
          loadFiles(e.dataTransfer.files);
        }
      });
    });
    fetch('sample/sample-songjeong-busan.gpx')
      .then(function (r) { return r.text(); })
      .then(function (t) {
        /* §463 — 데모 세션은 훈련부하 원장에 넣지 않는다. 페이지를 열
           때마다 자동으로 실려 남의 라이딩이 내 체력 추세가 되어버린다. */
        CUR.isDemo = true;
        loadGpxText(t, 'Songjeong, Busan');
      })
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
