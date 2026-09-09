/* §558 Trend analysis — Vakaros Vantage 벤치마크 (옥대표 스샷 13장)
   ────────────────────────────────────────────────────────────────
   Vantage 가 가진 것 중 우리에게 없던 것:
     · 풍속대(wind band)로 걸러 **비교 가능한 조건끼리만** 보기
     · 주/월 단위로 묶어 보기 (세션 단위가 아니라)
     · 성능 점수를 축별(종합·풍상·풍하·택·자이브) 추세로 보기

   그대로 베끼지 않고 두 가지를 고쳤다 —
     ① Vantage 는 칩을 눌러보기 전엔 그 조건에 세션이 몇 개인지 모른다.
        칩에 개수를 적는다. 표본이 얇으면 추세선을 긋지 않고 그렇다고 쓴다.
     ② Vantage 의 주간 차트는 대부분 0 인 평평한 선이다(스샷 1612·1616).
        데이터가 있는 구간만 그리고, **합계는 0 막대**로, **점수는 빈칸**으로
        구분한다 — 세션이 없던 달의 점수는 0점이 아니라 '없음'이다.

   ⚠ 풍속대 경계는 **우리 기준**이다. Vantage 의 경계는 공개돼 있지 않아
      추측하지 않았다. 화면에 경계를 적어 둔다.
*/
(function (global) {
  'use strict';

  var KT = 1.94384;

  var BANDS = [
    { key: 'vl', label: 'Very light', lo: 0,  hi: 8,   color: '#2AA5A0' },
    { key: 'l',  label: 'Light',      lo: 8,  hi: 12,  color: '#3B7DD8' },
    { key: 'm',  label: 'Medium',     lo: 12, hi: 18,  color: '#37955F' },
    { key: 's',  label: 'Strong',     lo: 18, hi: 25,  color: '#C4841B' },
    { key: 'vs', label: 'Very strong',lo: 25, hi: 999, color: '#B3453A' }
  ];
  function bandOf(kt) {
    if (kt == null || !isFinite(kt)) return null;
    for (var i = 0; i < BANDS.length; i++) {
      if (kt >= BANDS[i].lo && kt < BANDS[i].hi) return BANDS[i].key;
    }
    return null;
  }
  function bandDef(key) {
    for (var i = 0; i < BANDS.length; i++) if (BANDS[i].key === key) return BANDS[i];
    return null;
  }

  /* 합계 지표 — 기간별로 **더한다**. 세션이 없는 기간은 진짜 0 이다. */
  var TOTALS = [
    { key: 'sessions', label: 'Sessions', unit: '',    dp: 0, get: function () { return 1; } },
    { key: 'turns',    label: 'Maneuvers', unit: '',   dp: 0,
      get: function (r) { return r.maneuverTotal; } },
    { key: 'tacks',    label: 'Tacks',    unit: '',    dp: 0, get: function (r) { return r.tackCount; } },
    { key: 'gybes',    label: 'Gybes',    unit: '',    dp: 0, get: function (r) { return r.gybeCount; } },
    { key: 'dist',     label: 'Distance', unit: 'km',  dp: 1,
      get: function (r) { return r.distanceM != null ? r.distanceM / 1000 : null; } },
    { key: 'hours',    label: 'Hours',    unit: 'h',   dp: 1,
      get: function (r) { return r.movingTimeSec != null ? r.movingTimeSec / 3600 : null; } }
  ];

  /* 점수 축 — 기간별로 **평균낸다**. 세션이 없는 기간은 0 점이 아니라 없음. */
  var SCORES = [
    { key: 'overall',  label: 'Overall',  get: function (r) { return r.vpsOverall; } },
    { key: 'upwind',   label: 'Upwind',   get: function (r) { return r.vpsUpwind; } },
    { key: 'downwind', label: 'Downwind', get: function (r) { return r.vpsDownwind; } },
    { key: 'tacking',  label: 'Tacking',  get: function (r) { return r.vpsTack; } },
    { key: 'gybing',   label: 'Gybing',   get: function (r) { return r.vpsGybe; } }
  ];

  /* ---------- 기간 버킷 ---------- */
  /* §582 (옥대표 "일간 그래프도 선택가능하게 해줘") — 하루 단위.
     ⚠ 그대로 넣으면 4개월 × 하루 = 빈 막대 110개가 되어, §558 에서 지적한
        Vantage 의 실패(대부분 0인 평평한 차트)를 그대로 재현한다.
        그래서 일간만은 **탄 날만** 세운다. 주/월은 지금처럼 빈 기간도
        만든다 — 그 자리의 0 은 "그 주에 안 탔다" 는 뜻이 있지만, 하루
        단위에서 안 탄 날의 0 은 뜻이 아니라 잡음이다. */
  function dayKey(ep) {
    var d = new Date(ep);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  function weekKey(ep) {
    var d = new Date(ep);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   /* 월요일 시작 */
    return d.getTime();
  }
  function monthKey(ep) {
    var d = new Date(ep);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  function nextPeriod(ep, mode) {
    var d = new Date(ep);
    if (mode === 'day') { d.setDate(d.getDate() + 1); return d.getTime(); }
    if (mode === 'week') { d.setDate(d.getDate() + 7); return d.getTime(); }
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }
  function periodLabel(ep, mode) {
    var d = new Date(ep);
    if (mode === 'day' || mode === 'week') return (d.getMonth() + 1) + '/' + d.getDate();
    return (d.getMonth() + 1) + '월';
  }

  /* 데이터가 있는 첫 기간부터 마지막 기간까지만 만든다 —
     Vantage 처럼 앞뒤로 빈 구간을 길게 그리면 차트가 평평한 선이 된다. */
  function buildBuckets(rows, mode) {
    if (!rows.length) return [];
    /* §582 — 일간은 탄 날만. 빈 날을 채우면 잡음이 데이터를 덮는다. */
    if (mode === 'day') {
      var seen = {}, order = [];
      rows.forEach(function (r) {
        var k = dayKey(r.dateEpoch);
        if (!seen[k]) { seen[k] = { key: k, label: periodLabel(k, 'day'), rows: [] }; order.push(k); }
        seen[k].rows.push(r);
      });
      order.sort(function (a, b) { return a - b; });
      return order.map(function (k) { return seen[k]; });
    }
    var kf = mode === 'week' ? weekKey : monthKey;
    var first = kf(rows[0].dateEpoch), last = kf(rows[rows.length - 1].dateEpoch);
    var out = [], guard = 0;
    for (var k = first; k <= last && guard < 400; k = nextPeriod(k, mode), guard++) {
      out.push({ key: k, label: periodLabel(k, mode), rows: [] });
    }
    var idx = {};
    out.forEach(function (b, i) { idx[b.key] = i; });
    rows.forEach(function (r) {
      var i = idx[kf(r.dateEpoch)];
      if (i != null) out[i].rows.push(r);
    });
    return out;
  }

  /* ---------- 그리기 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(v, dp) {
    if (v == null || !isFinite(v)) return '—';
    return dp ? v.toFixed(dp) : String(Math.round(v));
  }

  /* 막대 차트. mode 'sum' 이면 빈 기간을 0 으로, 'avg' 면 빈칸으로 둔다. */
  function chartSvg(buckets, values, opts) {
    opts = opts || {};
    var W = 900, H = 210, padL = 40, padR = 14, padT = 26, padB = 34;
    var vals = values.filter(function (v) { return v != null && isFinite(v); });
    if (!vals.length) return '';
    var max = Math.max.apply(null, vals);
    var min = opts.zeroBased === false ? Math.min.apply(null, vals) : 0;
    if (opts.zeroBased === false) {
      var pad = (max - min) * 0.25 || 5;
      min = Math.max(0, min - pad); max = max + pad;
    }
    if (max === min) max = min + 1;
    var n = buckets.length;
    var bw = (W - padL - padR) / Math.max(1, n);
    var body = '', labels = '', ticks = '';
    for (var i = 0; i < n; i++) {
      var v = values[i];
      var cx = padL + i * bw + bw / 2;
      if (v != null && isFinite(v)) {
        var y = padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
        var bh = (H - padB) - y;
        body += '<rect x="' + (cx - bw * 0.3).toFixed(1) + '" y="' + y.toFixed(1)
          + '" width="' + (bw * 0.6).toFixed(1) + '" height="' + Math.max(1, bh).toFixed(1)
          + '" fill="' + (opts.color || '#4dabf7') + '" fill-opacity="0.85" rx="2"/>';
        if (n <= 14) {
          labels += '<text x="' + cx.toFixed(1) + '" y="' + (y - 6).toFixed(1)
            + '" text-anchor="middle" class="tr-val">' + esc(fmt(v, opts.dp)) + '</text>';
        }
      } else {
        /* 세션이 없던 기간 — 0 이 아니라 '없음' 이다 */
        body += '<line x1="' + (cx - 4).toFixed(1) + '" y1="' + (H - padB) + '" x2="'
          + (cx + 4).toFixed(1) + '" y2="' + (H - padB)
          + '" stroke="var(--tblr-border-color)" stroke-width="2"/>';
      }
      if (n <= 18 || i % 2 === 0) {
        ticks += '<text x="' + cx.toFixed(1) + '" y="' + (H - 12)
          + '" text-anchor="middle" class="tr-tick">' + esc(buckets[i].label) + '</text>';
      }
    }
    var base = '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR)
      + '" y2="' + (H - padB) + '" stroke="var(--tblr-border-color)" stroke-width="1"/>';
    var yl = '<text x="' + (padL - 6) + '" y="' + (padT + 4) + '" text-anchor="end" class="tr-tick">'
      + esc(fmt(max, opts.dp)) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tr-svg" role="img" aria-label="'
      + esc(opts.aria || 'trend') + '">' + base + yl + body + labels + ticks + '</svg>';
  }

  /* ---------- 본체 ---------- */
  function render(host, sessions, theme) {
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    /* 같은 세션이 여러 번 저장돼 있으면 하나로 친다 (§490 과 같은 규칙) */
    var byKey = {};
    (sessions || []).forEach(function (r) {
      if (!r || !r.dateEpoch) return;
      var k = r.sig || (r.dateEpoch + '|' + (r.name || ''));
      var prev = byKey[k];
      if (!prev || (r.savedAt || 0) > (prev.savedAt || 0)) byKey[k] = r;
    });
    var all = Object.keys(byKey).map(function (k) { return byKey[k]; })
      .sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
    if (all.length < 2) return;

    /* 상태 */
    var st = {
      bands: {},                 /* 비어 있으면 전체 */
      totalPeriod: 'month', totalMetric: 'sessions',
      scorePeriod: 'month', scoreMetric: 'overall'
    };

    var counts = {}, noWind = 0;
    all.forEach(function (r) {
      var b = bandOf(r.windSpeedKt);
      if (!b) { noWind++; return; }
      counts[b] = (counts[b] || 0) + 1;
    });

    function selected() {
      var keys = Object.keys(st.bands).filter(function (k) { return st.bands[k]; });
      if (!keys.length) return all;
      return all.filter(function (r) {
        var b = bandOf(r.windSpeedKt);
        return b && st.bands[b];
      });
    }

    var card = document.createElement('div');
    card.className = 'card mt-3';
    host.appendChild(card);

    var head = document.createElement('div');
    head.className = 'card-header';
    var h3 = document.createElement('h3');
    h3.className = 'card-title';
    h3.textContent = 'Trend analysis';
    head.appendChild(h3);
    card.appendChild(head);

    var body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);

    /* ── 풍속대 칩 ── */
    var bandNote = document.createElement('div');
    bandNote.className = 'lab';
    bandNote.style.cssText = 'font-size:.75rem;opacity:.85;margin-bottom:.4rem';
    bandNote.textContent = 'Compare like with like — a score in 25 kt is not the same '
      + 'achievement as the same score in 10 kt. Bands are ours, not Vakaros’: '
      + '<8 / 8–12 / 12–18 / 18–25 / 25+ kt.';
    body.appendChild(bandNote);

    var chips = document.createElement('div');
    chips.className = 'd-flex flex-wrap gap-2 mb-3';
    body.appendChild(chips);

    var sampleWarn = document.createElement('div');
    sampleWarn.className = 'lab';
    sampleWarn.style.cssText = 'font-size:.8125rem;margin-bottom:.75rem';
    body.appendChild(sampleWarn);

    var panels = document.createElement('div');
    body.appendChild(panels);

    function chipBtn(def) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm';
      var c = counts[def.key] || 0;
      b.disabled = c === 0;
      b.style.cssText = 'border:1px solid ' + def.color + ';'
        + 'padding:.25rem .6rem;line-height:1.2;text-align:left';
      b.innerHTML = '<span style="display:block;font-size:.75rem">' + esc(def.label) + '</span>'
        + '<span class="num" style="display:block;font-size:.6875rem;opacity:.75">'
        + c + ' session' + (c === 1 ? '' : 's') + '</span>';
      function paint() {
        var on = !!st.bands[def.key];
        b.style.background = on ? def.color : 'transparent';
        b.style.color = on ? '#fff' : '';
        b.style.opacity = c === 0 ? '.35' : '1';
      }
      paint();
      b.addEventListener('click', function () {
        st.bands[def.key] = !st.bands[def.key];
        paint(); draw();
      });
      return b;
    }
    BANDS.forEach(function (d) { chips.appendChild(chipBtn(d)); });
    if (noWind) {
      var nw = document.createElement('span');
      nw.className = 'lab align-self-center';
      nw.style.cssText = 'font-size:.75rem;opacity:.7';
      nw.textContent = noWind + ' session' + (noWind === 1 ? '' : 's')
        + ' without a recorded wind speed — shown only when no band is selected.';
      chips.appendChild(nw);
    }

    function panel(title, opts) {
      var wrap = document.createElement('div');
      wrap.className = 'mb-4';
      var top = document.createElement('div');
      top.className = 'd-flex flex-wrap align-items-center gap-2 mb-2';
      var t = document.createElement('div');
      t.style.cssText = 'font-weight:600';
      t.textContent = title;
      top.appendChild(t);

      var per = document.createElement('div');
      per.className = 'btn-group btn-group-sm ms-auto';
      ['day', 'week', 'month'].forEach(function (p) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm';
        b.textContent = p === 'day' ? 'Daily' : (p === 'week' ? 'Weekly' : 'Monthly');
        b.addEventListener('click', function () { opts.setPeriod(p); draw(); });
        b.dataset.period = p;
        per.appendChild(b);
      });
      top.appendChild(per);

      var badge = document.createElement('span');
      badge.className = 'lab num';
      badge.style.cssText = 'font-size:.8125rem';
      top.appendChild(badge);
      wrap.appendChild(top);

      var metrics = document.createElement('div');
      metrics.className = 'd-flex flex-wrap gap-1 mb-2';
      wrap.appendChild(metrics);

      var plot = document.createElement('div');
      wrap.appendChild(plot);

      var cap = document.createElement('div');
      cap.className = 'lab';
      cap.style.cssText = 'font-size:.75rem;opacity:.8;margin-top:.25rem';
      wrap.appendChild(cap);

      return { root: wrap, per: per, badge: badge, metrics: metrics, plot: plot, cap: cap };
    }

    var pTotals = panel('Totals', { setPeriod: function (p) { st.totalPeriod = p; } });
    var pScore = panel('Performance score', { setPeriod: function (p) { st.scorePeriod = p; } });
    panels.appendChild(pTotals.root);
    panels.appendChild(pScore.root);

    function metricChips(hostEl, defs, current, onPick) {
      while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
      defs.forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm' + (d.key === current ? ' btn-primary' : '');
        b.style.cssText = 'padding:.15rem .55rem;font-size:.8125rem';
        b.textContent = d.label;
        b.addEventListener('click', function () { onPick(d.key); draw(); });
        hostEl.appendChild(b);
      });
    }

    function paintPeriod(group, cur) {
      [].forEach.call(group.querySelectorAll('button'), function (b) {
        b.className = 'btn btn-sm' + (b.dataset.period === cur ? ' btn-primary' : '');
      });
    }

    function draw() {
      var rows = selected();
      var chosen = Object.keys(st.bands).filter(function (k) { return st.bands[k]; });

      if (chosen.length) {
        var names = chosen.map(function (k) { return bandDef(k).label; }).join(' + ');
        sampleWarn.textContent = names + ': ' + rows.length + ' session'
          + (rows.length === 1 ? '' : 's') + '.';
        sampleWarn.className = 'lab' + (rows.length < 3 ? ' text-warning' : '');
        if (rows.length < 3) {
          sampleWarn.textContent += ' Too few to read as a trend — the bars are '
            + 'individual sessions, not a direction.';
        }
      } else {
        sampleWarn.textContent = 'All ' + all.length + ' sessions. '
          + 'Pick a wind band above to compare only comparable days.';
        sampleWarn.className = 'lab';
      }

      /* ── Totals ── */
      paintPeriod(pTotals.per, st.totalPeriod);
      metricChips(pTotals.metrics, TOTALS, st.totalMetric,
        function (k) { st.totalMetric = k; });
      var tdef = null;
      TOTALS.forEach(function (d) { if (d.key === st.totalMetric) tdef = d; });
      var tb = buildBuckets(rows, st.totalPeriod);
      var tvals = tb.map(function (b) {
        var s = 0, any = false;
        b.rows.forEach(function (r) {
          var v = tdef.get(r);
          if (v != null && isFinite(v)) { s += v; any = true; }
        });
        /* 합계는 세션이 없어도 0 이 맞다 — 그 기간에 아무것도 안 했다는 뜻 */
        return b.rows.length === 0 ? 0 : (any ? s : null);
      });
      var grand = tvals.reduce(function (a, v) { return a + (v || 0); }, 0);
      pTotals.badge.textContent = 'Total: ' + fmt(grand, tdef.dp) + (tdef.unit ? ' ' + tdef.unit : '');
      pTotals.plot.innerHTML = chartSvg(tb, tvals,
        { dp: tdef.dp, color: '#4dabf7', aria: tdef.label + ' by ' + st.totalPeriod });
      pTotals.cap.textContent = st.totalPeriod === 'day'
        ? 'Summed per day, and only days you actually rode — a chart of empty days '
          + 'would be mostly zeros with the riding squeezed into a few bars.'
        : 'Summed per ' + st.totalPeriod + '. A period with no sessions is a real zero.';

      /* ── Performance score ── */
      paintPeriod(pScore.per, st.scorePeriod);
      metricChips(pScore.metrics, SCORES, st.scoreMetric,
        function (k) { st.scoreMetric = k; });
      var sdef = null;
      SCORES.forEach(function (d) { if (d.key === st.scoreMetric) sdef = d; });
      var sb = buildBuckets(rows, st.scorePeriod);
      var svals = sb.map(function (b) {
        var s = 0, n = 0;
        b.rows.forEach(function (r) {
          var v = sdef.get(r);
          if (v != null && isFinite(v)) { s += v; n++; }
        });
        /* 세션이 없던 기간은 0 점이 아니라 **없음** 이다 */
        return n ? s / n : null;
      });
      var have = svals.filter(function (v) { return v != null; });
      var avg = have.length ? have.reduce(function (a, v) { return a + v; }, 0) / have.length : null;
      pScore.badge.textContent = 'Avg: ' + fmt(avg, 1);
      pScore.plot.innerHTML = have.length
        ? chartSvg(sb, svals, { dp: 1, color: '#74b816', zeroBased: false,
            aria: sdef.label + ' score by ' + st.scorePeriod })
        : '';
      /* §582 — 일간은 탄 날만 세우므로 '빈 기간' 이라는 말이 성립하지 않는다 */
      pScore.cap.textContent = have.length
        ? (st.scorePeriod === 'day'
            ? 'Averaged per day, and only days you actually rode.'
            : 'Averaged per ' + st.scorePeriod + '. A period with no sessions is left blank '
              + '— it is not a zero score.')
        : 'No ' + sdef.label.toLowerCase() + ' score recorded on these sessions yet.';
    }

    draw();
  }

  global.RDTrend = {
    render: render,
    BANDS: BANDS, bandOf: bandOf,
    TOTALS: TOTALS, SCORES: SCORES,
    _buckets: buildBuckets, _weekKey: weekKey, _monthKey: monthKey
  };
})(typeof window !== 'undefined' ? window : this);
