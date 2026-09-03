/* ============================================================
 * map-tactical.js — 전술 지도: 트랙 위에 바람을 그린다 (§472)
 *
 * Sailnjord Tactical map 대응. 그쪽은 계기로 잰 값을 쓴다 —
 *   트랙 굵기 = TWS,  트랙 색 = 세션 평균 TWD 대비 편차(리프트/헤더)
 *
 * 우리는 풍향계가 없다. 트랙에서 낼 수 있는 것으로 바꾼다:
 *
 *   색  = **시프트** — 그 순간 CWA 가 그 택의 평소 각도보다 좁혀졌나
 *         (리프트) 벌어졌나(헤더). 택마다 기준이 다르므로 **택별
 *         중앙값**을 기준선으로 쓴다. 조타 잡음을 빼려고 ±20초 창으로
 *         평활한다 — 한 번의 조타가 아니라 지속된 시프트를 본다.
 *   굵기 = **압력** — 그 순간 속도가 그 택의 평소 속도보다 빠른가.
 *         정상 트림에서 보트 속도는 바람 압력을 따라간다.
 *
 * ⚠ 이건 바람을 잰 게 아니라 **배의 반응에서 거꾸로 읽은 것**이다.
 *    트림이 흐트러졌거나 파도에 걸린 구간도 같은 신호로 보인다.
 *    계기가 붙으면 그 값으로 대체해야 한다.
 *
 * 브라우저: RDMapTactical  ·  Node: require('./map-tactical')
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  /* §525 W14 — 지도 배경 선택 (Waterspeed: Standard/Hybrid/Satellite).
     위성이 필요한 이유가 있다: 해안선·부표·양식장·이안류 자리가 보여야
     "저기서 왜 느렸나" 를 읽는다. 도로 지도는 물 위가 전부 파란색이라
     아무 단서가 없다.
     Esri World Imagery 는 키 없이 쓸 수 있다(출처 표기 필요). */
  var TILES = {
    map: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
           opts: { maxZoom: 19, attribution: '\u00a9 OpenStreetMap' } },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/'
         + 'World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, attribution: 'Imagery \u00a9 Esri, Maxar, Earthstar Geographics' } }
  };
  function tileKey() {
    try {
      var v = global.localStorage && global.localStorage.getItem('rd_map_tiles');
      return (v === 'satellite') ? 'satellite' : 'map';
    } catch (e) { return 'map'; }
  }
  function setTileKey(k) {
    try { global.localStorage.setItem('rd_map_tiles', k === 'satellite' ? 'satellite' : 'map'); }
    catch (e) {}
  }
  function addTiles(map) {
    var t = TILES[tileKey()] || TILES.map;
    return global.L.tileLayer(t.url, t.opts).addTo(map);
  }

  function geo() {
    return global.RDGeo || (typeof require === 'function' ? require('./geo.js') : null);
  }

  /* 발산형 팔레트 — 리프트(좁혀짐)=청록, 헤더(벌어짐)=주황, 중립=회색.
     발산형은 중간이 반드시 중립이어야 한다(무지개 금지). 청록/주황은
     적녹색맹에서도 갈린다 — 색만으로 정보를 싣지 않도록 범례도 붙인다. */
  function shiftColor(deltaDeg, span) {
    var t = Math.max(-1, Math.min(1, deltaDeg / (span || 10)));
    var a = Math.abs(t);
    var mid = [148, 158, 168];                 /* 중립 회색 */
    var end = t < 0 ? [13, 148, 136]           /* teal-600 — 리프트 */
                    : [217, 119, 6];           /* amber-600 — 헤더  */
    return 'rgb(' + mid.map(function (m, i) {
      return Math.round(m + (end[i] - m) * a);
    }).join(',') + ')';
  }

  /* 택 색 — 포트/스타보드 구분 모드. 세일링 관습(포트=적, 스타보드=녹). */
  function tackColor(side) { return side === 'P' ? '#c0392b' : '#1e8449'; }

  function signedTwa(headingDeg, windDir) {
    var G = geo();
    if (!G || headingDeg == null || windDir == null) return null;
    return G.angleDiff(windDir, headingDeg);    /* -180..180, >=0 = Port (§421) */
  }

  function bucketOf(signed) {
    if (signed == null) return null;
    return (Math.abs(signed) < 90 ? 'up' : 'down') + (signed >= 0 ? 'P' : 'S');
  }

  /* 택별 기준선. 기준이 없으면 시프트를 잴 수 없다 — 같은 40°라도
     포트에선 리프트, 스타보드에선 헤더일 수 있기 때문이다. */
  function tackBaselines(samples, windDir, minKt) {
    minKt = minKt || 8;
    var b = {};
    samples.forEach(function (p) {
      if (!p || p.speed == null || p.heading == null) return;
      if (p.speed * KT < minKt) return;
      var s = signedTwa(p.heading, windDir);
      var k = bucketOf(s);
      if (!k) return;
      (b[k] = b[k] || { twa: [], sp: [] });
      b[k].twa.push(Math.abs(s));
      b[k].sp.push(p.speed * KT);
    });
    function med(a) {
      if (!a.length) return null;
      var v = a.slice().sort(function (x, y) { return x - y; });
      return v[v.length >> 1];
    }
    var out = {};
    Object.keys(b).forEach(function (k) {
      out[k] = { twa: med(b[k].twa), speed: med(b[k].sp), n: b[k].twa.length };
    });
    return out;
  }

  /* 한 점을 분류한다 — 원시(비평활) 값. */
  function classify(p, base, windDir, minKt) {
    if (!p || p.speed == null || p.heading == null) return null;
    if (p.speed * KT < (minKt || 8)) return null;
    var s = signedTwa(p.heading, windDir);
    var k = bucketOf(s);
    if (!k) return null;
    var bl = base[k];
    if (!bl || bl.twa == null || bl.n < 30) return null;
    var twa = Math.abs(s);
    /* 풍상은 각이 작아질수록 리프트. 풍하는 목표가 반대이므로(더 깊이
       내려갈수록 이득) 부호를 뒤집는다. 음수 = 리프트. */
    var delta = (k.slice(0, 2) === 'up') ? (twa - bl.twa) : (bl.twa - twa);
    return {
      bucket: k, side: k.slice(-1), zone: k.slice(0, -1),
      deltaDeg: delta,
      pressure: bl.speed > 0 ? (p.speed * KT) / bl.speed : 1
    };
  }

  /* 세션 전체를 분류하고, 같은 택이 이어지는 구간 안에서만 ±windowSec
     이동평균을 건다. 택이 바뀌면 창을 끊는다 — 택을 넘어 평균내면
     시프트가 아니라 택 전환을 그리게 된다. */
  function classifySeries(samples, windDir, opts) {
    opts = opts || {};
    var minKt = opts.minKt || 8, win = opts.windowSec == null ? 20 : opts.windowSec;
    var base = opts.baselines || tackBaselines(samples, windDir, minKt);
    var raw = samples.map(function (p) { return classify(p, base, windDir, minKt); });
    if (win > 0) {
      for (var i = 0; i < raw.length; i++) {
        var c = raw[i];
        if (!c) continue;
        var sum = c.deltaDeg, ps = c.pressure, n = 1, t0 = samples[i].t;
        for (var d = -1; d <= 1; d += 2) {
          for (var j = i + d; j >= 0 && j < raw.length; j += d) {
            var q = raw[j];
            if (!q || q.bucket !== c.bucket) break;
            if (Math.abs(samples[j].t - t0) > win) break;
            sum += q.deltaDeg; ps += q.pressure; n++;
          }
        }
        c.deltaSmooth = n ? sum / n : c.deltaDeg;
        c.pressureSmooth = n ? ps / n : c.pressure;
      }
    } else {
      raw.forEach(function (c) {
        if (c) { c.deltaSmooth = c.deltaDeg; c.pressureSmooth = c.pressure; }
      });
    }
    /* 평활 후 재중심 — 색의 중립이 "그 택의 평소"를 뜻하도록, 평활된
       편차의 택별 중앙값을 다시 뺀다. 이걸 빼먹으면 분포가 한쪽으로
       쏠려 세션 전체가 리프트로 칠해진다(원시 중앙값 ≠ 평활 중앙값). */
    var byB = {};
    raw.forEach(function (c) { if (c) (byB[c.bucket] = byB[c.bucket] || []).push(c.deltaSmooth); });
    var off = {};
    Object.keys(byB).forEach(function (k) {
      var v = byB[k].sort(function (x, y) { return x - y; });
      off[k] = v[v.length >> 1];
    });
    raw.forEach(function (c) { if (c) c.deltaSmooth -= (off[c.bucket] || 0); });

    return { baselines: base, series: raw };
  }

  /* 압력 → 선 굵기(px). 평소 속도 = 3px, ±30% 에서 1.5~6px 로 벌어진다. */
  function widthFor(pressure) {
    return Math.max(1.5, Math.min(6.5, 3 + (pressure - 1) * 10));
  }

  function summarize(series) {
    var lift = 0, head = 0, neut = 0, gust = 0, lull = 0, n = 0;
    series.forEach(function (c) {
      if (!c) return;
      n++;
      if (c.deltaSmooth < -3) lift++; else if (c.deltaSmooth > 3) head++; else neut++;
      if (c.pressureSmooth > 1.08) gust++; else if (c.pressureSmooth < 0.92) lull++;
    });
    return { n: n, lift: lift, header: head, neutral: neut, gust: gust, lull: lull };
  }

  /* ---------- 기동 손실 지도 (§476) ----------
   * 표로 보는 손실은 "얼마나" 는 알려주지만 "어디서" 를 못 알려준다.
   * 같은 자이브라도 코스 한쪽 끝에서만 무너진다면 그건 기술이 아니라
   * 그 자리의 바람·파도일 수 있다. 그래서 손실을 물 위에 찍는다.
   *
   * 원 크기 = 잃은 거리(m), 색 = 택/자이브. 손실을 못 낸 회전(기준
   * 구간 없음·주행 아님)은 작은 빈 원으로 남긴다 — 지우면 "거기선
   * 안 돌았다" 로 읽힌다. */
  function lossRadius(lossM, maxLossM) {
    if (lossM == null || !(lossM > 0)) return 4;
    var f = Math.sqrt(lossM / Math.max(1, maxLossM));   /* 넓이 ∝ 손실 */
    return 5 + f * 15;
  }

  function renderLoss(host, session, analysis, opts) {
    opts = opts || {};
    if (!host || !global.L) return null;
    var S = (session && session.samples) || [];
    var pts = S.filter(function (p) { return p && isFinite(p.lat) && isFinite(p.lng); });
    if (pts.length < 2) { host.textContent = 'No GPS points'; return null; }
    var mans = (analysis && analysis.maneuvers) || [];
    var losses = opts.losses || [];
    var byIdx = {};
    losses.forEach(function (L) { if (L && L.index != null) byIdx[L.index] = L; });

    while (host.firstChild) host.removeChild(host.firstChild);
    host.style.height = (opts.height || 460) + 'px';
    var map = global.L.map(host, { zoomControl: true });
    addTiles(map);

    /* 트랙은 배경으로 죽인다 — 주인공은 원이다. */
    var step = Math.max(1, Math.floor(pts.length / 3000));
    var line = [];
    for (var i = 0; i < pts.length; i += step) line.push([pts[i].lat, pts[i].lng]);
    global.L.polyline(line, { color: '#8b98a5', weight: 1.5, opacity: 0.45 }).addTo(map);

    var maxLoss = 0, scored = 0, unscored = 0;
    mans.forEach(function (m, k) {
      var L = byIdx[k];
      if (L && L.vmgLossM != null && L.vmgLossM > maxLoss) maxLoss = L.vmgLossM;
    });

    var drawn = 0, totalLoss = 0;
    mans.forEach(function (m, k) {
      var idx = m.apexIdx != null ? m.apexIdx : m.startIdx;
      var p = S[idx];
      if (!p || !isFinite(p.lat) || !isFinite(p.lng)) return;
      var L = byIdx[k];
      var lossM = (L && L.vmgLossM != null) ? L.vmgLossM : null;
      if (lossM != null) { scored++; totalLoss += lossM; } else { unscored++; }
      var col = m.type === 'gybe' ? '#f76707' : '#4dabf7';
      var mk = global.L.circleMarker([p.lat, p.lng], {
        radius: lossRadius(lossM, maxLoss),
        color: col, weight: lossM == null ? 1 : 1.5,
        opacity: lossM == null ? 0.5 : 0.9,
        fillColor: col, fillOpacity: lossM == null ? 0 : 0.35
      }).addTo(map);
      var lbl = (m.type === 'gybe' ? 'Gybe' : 'Tack') + ' ' + (k + 1)
        + ' · ' + Math.floor(m.tSec / 60) + ':' + ('0' + Math.round(m.tSec % 60)).slice(-2);
      if (lossM != null) lbl += ' · lost ' + lossM.toFixed(0) + ' m';
      else lbl += ' · loss not measurable' + (L && L.reason ? ' (' + L.reason + ')' : '');
      mk.bindTooltip(lbl, { direction: 'top' });
      /* §496 (옥대표) — "트랙상의 메뉴버 점들도 클릭하면 데이터 요약
         화면으로 이동되게" — 점을 누르면 그 회전을 상세로 연다.
         핸들러는 호출부가 넣는다(탭 전환·선택은 앱의 일이다). */
      if (typeof opts.onPick === 'function') {
        mk.on('click', function () { opts.onPick(k, m); });
        if (mk.getElement) {
          try { mk.getElement().style.cursor = 'pointer'; } catch (e) {}
        }
      }
      drawn++;
    });

    var la = pts.map(function (p) { return p.lat; }), ln = pts.map(function (p) { return p.lng; });
    var bounds = [[Math.min.apply(null, la), Math.min.apply(null, ln)],
                  [Math.max.apply(null, la), Math.max.apply(null, ln)]];
    map.fitBounds(bounds, { padding: [24, 24] });
    /* 숨은 탭 안에서 만들어진 지도는 크기가 0 이라 타일이 안 붙고,
       그 0 크기로 맞춘 fitBounds 가 엉뚱한 배율로 남는다. 크기를 다시
       재고 **경계도 다시 맞춘다** — invalidateSize 만으로는 배율이
       고쳐지지 않는다(라이브에서 확인). */
    setTimeout(function () {
      try { map.invalidateSize(); map.fitBounds(bounds, { padding: [24, 24] }); }
      catch (e) {}
    }, 60);

    return { map: map, mode: 'loss', markers: drawn, maxLossM: maxLoss,
             stats: { scored: scored, unscored: unscored, totalLossM: totalLoss } };
  }

  function render(host, session, analysis, opts) {
    opts = opts || {};
    if (!host || !global.L) return null;
    var wd = analysis && analysis.windDir;
    if (wd == null) { host.textContent = 'Tactical view needs a wind direction.'; return null; }
    var all = (session && session.samples) || [];
    var pts = all.filter(function (p) { return p && isFinite(p.lat) && isFinite(p.lng); });
    if (pts.length < 2) { host.textContent = 'No GPS points'; return null; }

    var mode = opts.mode || 'shift';           /* 'shift' | 'tack' */
    var res = classifySeries(pts, wd, opts);
    if (!Object.keys(res.baselines).length) {
      host.textContent = 'Not enough sustained sailing to read shifts.';
      return null;
    }

    while (host.firstChild) host.removeChild(host.firstChild);
    host.style.height = (opts.height || 460) + 'px';
    var map = global.L.map(host, { zoomControl: true });
    addTiles(map);

    /* 색·굵기가 바뀔 때만 선을 끊는다 — 점마다 그리면 레이어가 수천 개다. */
    var step = Math.max(1, Math.floor(pts.length / 3000));
    var seg = [], curC = null, curW = null, drawn = 0;
    function flush() {
      if (seg.length > 1 && curC) {
        global.L.polyline(seg, { color: curC, weight: curW, opacity: 0.85 }).addTo(map);
        drawn++;
      }
      seg = [];
    }
    for (var i = 0; i < pts.length; i += step) {
      var c = res.series[i];
      if (!c) { flush(); curC = null; continue; }
      var col = mode === 'tack' ? tackColor(c.side)
                                : shiftColor(c.deltaSmooth, opts.shiftSpanDeg || 10);
      var w = Math.round(widthFor(c.pressureSmooth) * 2) / 2;
      if (col !== curC || w !== curW) {
        if (seg.length) { seg.push([pts[i].lat, pts[i].lng]); flush(); }
        curC = col; curW = w;
      }
      seg.push([pts[i].lat, pts[i].lng]);
    }
    flush();

    var la = pts.map(function (p) { return p.lat; }), ln = pts.map(function (p) { return p.lng; });
    var bounds = [[Math.min.apply(null, la), Math.min.apply(null, ln)],
                  [Math.max.apply(null, la), Math.max.apply(null, ln)]];
    map.fitBounds(bounds, { padding: [24, 24] });
    /* 숨은 탭 안에서 만들어진 지도는 크기가 0 이라 타일이 안 붙고,
       그 0 크기로 맞춘 fitBounds 가 엉뚱한 배율로 남는다. 크기를 다시
       재고 **경계도 다시 맞춘다** — invalidateSize 만으로는 배율이
       고쳐지지 않는다(라이브에서 확인). */
    setTimeout(function () {
      try { map.invalidateSize(); map.fitBounds(bounds, { padding: [24, 24] }); }
      catch (e) {}
    }, 60);

    return { map: map, segments: drawn, mode: mode,
             baselines: res.baselines, stats: summarize(res.series) };
  }

  var API = { render: render, renderLoss: renderLoss, lossRadius: lossRadius,
              shiftColor: shiftColor, tackColor: tackColor,
              widthFor: widthFor, tackBaselines: tackBaselines, classify: classify,
              classifySeries: classifySeries, summarize: summarize,
              signedTwa: signedTwa, bucketOf: bucketOf,
              tileKey: tileKey, setTileKey: setTileKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDMapTactical = API;
})(typeof window !== 'undefined' ? window : globalThis);
