/* ============================================================
 * map-v2.js — §441 GPS 트랙 지도 (Leaflet)
 *
 * 속도로 색을 입힌 폴리라인 + 택/자이브 마커.
 * 색은 절대 속도 기준 고정 스케일 — 세션마다 스케일이 바뀌면
 * 두 세션을 나란히 놓고 비교할 수 없다.
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  /* 절대 속도 → 색. 세션 간 비교 가능하도록 고정한다. */
  var TIERS = [
    { max: 4,   c: '#c92a2a' },
    { max: 8,   c: '#e8590c' },
    { max: 12,  c: '#f59f00' },
    { max: 16,  c: '#94d82d' },
    { max: 20,  c: '#40c057' },
    { max: 24,  c: '#20c997' },
    { max: 1e9, c: '#22b8cf' }
  ];
  function colorFor(kt) {
    for (var i = 0; i < TIERS.length; i++) if (kt <= TIERS[i].max) return TIERS[i].c;
    return TIERS[TIERS.length - 1].c;
  }

  function render(host, session, analysis, opts) {
    opts = opts || {};
    if (!host || !global.L) return null;
    var S = (session && session.samples) || [];
    var pts = S.filter(function (p) {
      return p && isFinite(p.lat) && isFinite(p.lng);
    });
    if (pts.length < 2) { host.textContent = 'No GPS points'; return null; }

    while (host.firstChild) host.removeChild(host.firstChild);
    host.style.height = (opts.height || 460) + 'px';

    var map = global.L.map(host, { zoomControl: true, attributionControl: true });
    global.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    /* 속도 구간별로 폴리라인을 쪼개 색을 입힌다.
       한 줄로 그리면 색을 못 넣고, 점마다 그리면 수천 개 레이어가 된다. */
    var seg = [], segColor = null, drawn = 0;
    function flush() {
      if (seg.length > 1 && segColor) {
        global.L.polyline(seg, { color: segColor, weight: 3, opacity: 0.9 }).addTo(map);
        drawn++;
      }
      seg = [];
    }
    var step = Math.max(1, Math.floor(pts.length / 4000));
    for (var i = 0; i < pts.length; i += step) {
      var p = pts[i];
      var kt = (p.speed != null && isFinite(p.speed)) ? p.speed * KT : 0;
      var c = colorFor(kt);
      if (c !== segColor) {
        if (seg.length) { seg.push([p.lat, p.lng]); flush(); }
        segColor = c;
      }
      seg.push([p.lat, p.lng]);
    }
    flush();

    /* 회전 마커 */
    var mans = (analysis && analysis.maneuvers) || [];
    var markers = 0;
    mans.forEach(function (m, idx) {
      var s = S[m.apexIdx != null ? m.apexIdx : m.startIdx];
      if (!s || !isFinite(s.lat)) return;
      var isTack = m.type === 'tack';
      global.L.circleMarker([s.lat, s.lng], {
        radius: 4, weight: 1.5,
        color: isTack ? '#4dabf7' : '#f76707',
        fillColor: isTack ? '#4dabf7' : '#f76707', fillOpacity: 0.85
      }).bindTooltip((isTack ? 'Tack' : 'Gybe') + ' #' + (idx + 1)
        + (m.lossDisplayPct != null ? ' · ' + Math.round(m.lossDisplayPct) + '% loss' : ''),
        { direction: 'top' }).addTo(map);
      markers++;
    });

    var bounds = global.L.latLngBounds(pts.map(function (p) { return [p.lat, p.lng]; }));
    map.fitBounds(bounds, { padding: [24, 24] });
    setTimeout(function () { map.invalidateSize(); }, 60);

    return { map: map, segments: drawn, markers: markers, tiers: TIERS };
  }

  var API = { render: render, _test: { colorFor: colorFor, TIERS: TIERS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDMapV2 = API;
})(typeof window !== 'undefined' ? window : globalThis);
