/* §559 장비별 사용 통계 — Vakaros Vantage 'Equipment' 벤치마크
   (옥대표 2차 스샷 15장: IMG_1617~1621)
   ────────────────────────────────────────────────────────────────
   Vantage 는 장비마다 Total Hours · Activities · Distance · Last used 를
   보여주고, 은퇴(RETIRED)한 것은 흐리게 둔다.

   우리는 §520 부터 세션마다 장비 스냅샷을 박아 왔으므로 같은 것을 만들 수
   있고, **한 걸음 더 간다**: Vantage 는 얼마나 썼는지만 말하고 그 장비로
   얼마나 잘 탔는지는 말하지 않는다. 우리는 평균 성능 점수와 평균 속도를
   같이 낸다 — §520 을 만든 이유가 "6.0 이랑 5.0 중 뭐가 나았나" 였다.

   ⚠ 정직성: 장비가 기록된 세션만 셀 수 있다. 몇 개 중 몇 개인지 밝힌다.
      기록이 없는 세션의 거리·시간은 어떤 장비에도 넣지 않는다.
*/
(function (global) {
  'use strict';

  var KT = 1.94384;

  /* 스냅샷의 어느 필드가 어느 부품인지. id 와 표시이름이 짝으로 들어 있다. */
  var SLOTS = [
    { key: 'handWing',  name: 'handWingName',  label: 'Wing',       area: 'wingM2' },
    { key: 'frontWing', name: 'frontWingName', label: 'Front foil' },
    { key: 'rearWing',  name: null,            label: 'Rear foil' },
    { key: 'mast',      name: null,            label: 'Mast' },
    { key: 'board',     name: 'boardName',     label: 'Board' }
  ];

  function dedupe(sessions) {
    var byKey = {};
    (sessions || []).forEach(function (r) {
      if (!r || !r.dateEpoch) return;
      var k = r.sig || (r.dateEpoch + '|' + (r.name || ''));
      var prev = byKey[k];
      if (!prev || (r.savedAt || 0) > (prev.savedAt || 0)) byKey[k] = r;
    });
    return Object.keys(byKey).map(function (k) { return byKey[k]; })
      .sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
  }

  /* 세션들을 슬롯별·항목별로 굴린다. */
  function rollup(sessions) {
    var rows = dedupe(sessions);
    var withGear = 0;
    var out = SLOTS.map(function (s) { return { slot: s, items: {} }; });

    rows.forEach(function (r) {
      var g = r.gear;
      if (!g) return;
      var any = false;
      out.forEach(function (bucket) {
        var s = bucket.slot;
        var id = g[s.key];
        if (id == null || id === '') return;
        any = true;
        var label = (s.name && g[s.name]) ? g[s.name] : String(id);
        var it = bucket.items[id];
        if (!it) {
          it = bucket.items[id] = {
            id: id, label: label, sessions: 0, sec: 0, m: 0,
            lastEpoch: 0, spsSum: 0, spsN: 0, ktSum: 0, ktN: 0,
            backfilled: 0, areaM2: (s.area && g[s.area] != null) ? g[s.area] : null
          };
        }
        it.sessions++;
        if (r.movingTimeSec) it.sec += r.movingTimeSec;
        if (r.distanceM) it.m += r.distanceM;
        if (r.dateEpoch > it.lastEpoch) it.lastEpoch = r.dateEpoch;
        if (r.vpsOverall != null && isFinite(r.vpsOverall)) { it.spsSum += r.vpsOverall; it.spsN++; }
        if (r.maxSpeedMs != null) { it.ktSum += r.maxSpeedMs * KT; it.ktN++; }
        if (g.backfilled) it.backfilled++;
      });
      if (any) withGear++;
    });

    out.forEach(function (b) {
      b.list = Object.keys(b.items).map(function (k) { return b.items[k]; })
        .sort(function (a, c) { return c.sec - a.sec || c.sessions - a.sessions; });
      b.list.forEach(function (it) {
        it.hours = it.sec / 3600;
        it.km = it.m / 1000;
        it.avgSps = it.spsN ? it.spsSum / it.spsN : null;
        it.avgTopKt = it.ktN ? it.ktSum / it.ktN : null;
      });
    });
    return { buckets: out.filter(function (b) { return b.list.length; }),
             total: rows.length, withGear: withGear };
  }

  function fmtDate(ep) {
    if (!ep) return '—';
    var d = new Date(ep);
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2)
      + '.' + ('0' + d.getDate()).slice(-2);
  }
  function n1(v) { return (v == null || !isFinite(v)) ? '—' : v.toFixed(1); }
  function n0(v) { return (v == null || !isFinite(v)) ? '—' : String(Math.round(v)); }

  function render(host, sessions) {
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    var R = rollup(sessions);
    if (!R.buckets.length) return;

    var card = document.createElement('div');
    card.className = 'card mt-3';
    host.appendChild(card);

    var head = document.createElement('div');
    head.className = 'card-header';
    var h3 = document.createElement('h3');
    h3.className = 'card-title';
    h3.textContent = 'Equipment';
    head.appendChild(h3);
    var act = document.createElement('span');
    act.className = 'lab';
    act.style.cssText = 'margin-left:auto;font-size:.8125rem';
    /* ⚠ 장비가 기록된 세션만 셀 수 있다 — 몇 개 중 몇 개인지 밝힌다 */
    act.textContent = R.withGear + ' of ' + R.total + ' sessions have gear recorded';
    head.appendChild(act);
    card.appendChild(head);

    var body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);

    if (R.withGear < R.total) {
      var note = document.createElement('div');
      note.className = 'lab mb-3';
      note.style.cssText = 'font-size:.8125rem;opacity:.85';
      note.textContent = 'Sessions without a gear record are left out entirely — their '
        + 'hours and distance are not credited to any item. Use “add gear” in the '
        + 'session list to fill them in.';
      body.appendChild(note);
    }

    R.buckets.forEach(function (b) {
      var sec = document.createElement('div');
      sec.className = 'mb-3';

      var t = document.createElement('div');
      t.className = 'lab mb-1';
      t.style.cssText = 'font-weight:600;letter-spacing:.02em';
      t.textContent = b.slot.label;
      sec.appendChild(t);

      var wrap = document.createElement('div');
      wrap.className = 'table-responsive';
      var tbl = document.createElement('table');
      tbl.className = 'table table-sm table-vcenter card-table';

      var thead = document.createElement('thead');
      var htr = document.createElement('tr');
      ['', 'Sessions', 'Hours', 'Distance', 'Avg score', 'Avg top', 'Last used']
        .forEach(function (x, i) {
          var th = document.createElement('th');
          th.textContent = x;
          if (i > 0 && i < 6) th.className = 'text-end';
          htr.appendChild(th);
        });
      thead.appendChild(htr); tbl.appendChild(thead);

      var tb = document.createElement('tbody');
      b.list.forEach(function (it) {
        var tr = document.createElement('tr');
        var tdN = document.createElement('td');
        tdN.textContent = it.label;
        if (it.backfilled) {
          /* 저장 시점 스냅샷과 나중에 기억으로 적은 것은 신뢰도가 다르다(§520) */
          var bf = document.createElement('span');
          bf.className = 'lab ms-2';
          bf.style.cssText = 'font-size:.6875rem;opacity:.7';
          bf.textContent = it.backfilled + ' added later';
          tdN.appendChild(bf);
        }
        tr.appendChild(tdN);
        [[String(it.sessions), ''], [n1(it.hours), ' h'], [n1(it.km), ' km'],
         [n0(it.avgSps), ''], [n1(it.avgTopKt), ' kt']]
          .forEach(function (p) {
            var td = document.createElement('td');
            td.className = 'text-end num';
            td.textContent = p[0] + (p[0] === '—' ? '' : p[1]);
            tr.appendChild(td);
          });
        var tdL = document.createElement('td');
        tdL.className = 'num';
        tdL.textContent = fmtDate(it.lastEpoch);
        tr.appendChild(tdL);
        tb.appendChild(tr);
      });
      tbl.appendChild(tb); wrap.appendChild(tbl); sec.appendChild(wrap);
      body.appendChild(sec);
    });

    /* Vantage 에 없는 것 — 같은 부품군에서 어느 쪽이 나았는지 한 줄로 */
    var verdicts = [];
    R.buckets.forEach(function (b) {
      var cand = b.list.filter(function (it) { return it.spsN >= 2; });
      if (cand.length < 2) return;
      var best = cand[0], worst = cand[0];
      cand.forEach(function (it) {
        if (it.avgSps > best.avgSps) best = it;
        if (it.avgSps < worst.avgSps) worst = it;
      });
      if (best === worst) return;
      var gap = best.avgSps - worst.avgSps;
      if (gap < 3) return;
      verdicts.push(b.slot.label + ': ' + best.label + ' averages ' + n0(best.avgSps)
        + ' against ' + worst.label + '’s ' + n0(worst.avgSps)
        + ' (' + best.spsN + ' vs ' + worst.spsN + ' scored sessions).');
    });
    if (verdicts.length) {
      var v = document.createElement('div');
      v.className = 'alert alert-info';
      var vt = document.createElement('div');
      vt.className = 'fw-bold mb-1';
      vt.textContent = 'What the numbers say';
      v.appendChild(vt);
      verdicts.forEach(function (line) {
        var p = document.createElement('div');
        p.textContent = line;
        v.appendChild(p);
      });
      var caveat = document.createElement('div');
      caveat.className = 'lab mt-2';
      caveat.style.cssText = 'font-size:.75rem;opacity:.85';
      caveat.textContent = 'Read this as a hint, not a verdict — you probably chose each '
        + 'item to suit the day, so the wind is mixed in with the gear. Filter the trend '
        + 'above by wind band to separate them.';
      v.appendChild(caveat);
      body.appendChild(v);
    }
  }

  global.RDGearUsage = { render: render, rollup: rollup, SLOTS: SLOTS };
})(typeof window !== 'undefined' ? window : this);
