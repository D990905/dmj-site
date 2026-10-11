/* ============================================================
 * map-v2.js — §441 GPS 트랙 지도 (Leaflet)
 *
 * 속도로 색을 입힌 폴리라인 + 택/자이브 마커.
 * 색은 절대 속도 기준 고정 스케일 — 세션마다 스케일이 바뀌면
 * 두 세션을 나란히 놓고 비교할 수 없다.
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.9438444924406;

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

  function legendHtml() {
    var lo=0;
    return '<span>SOG · kt (노트)</span><span style="display:flex;flex-wrap:wrap;gap:3px 7px;max-width:240px">'+TIERS.map(function(t,i){
      var label=i===TIERS.length-1?'24+':lo+'–'+t.max;lo=t.max;
      return '<span style="display:inline-flex;align-items:center;gap:3px"><i style="width:10px;height:6px;background:'+t.c+'"></i>'+label+'</span>';
    }).join('')+'<span style="display:inline-flex;align-items:center;gap:3px"><i style="width:10px;height:6px;background:#8996a2"></i>미측정</span></span>';
  }
  function addSpeedLegend(map, position) {
    if (!global.L.control || !global.document) return null;
    var legend=global.L.control({position:position||'bottomleft'});
    legend.onAdd=function(){var box=global.document.createElement('div');box.className='rd-map-speed';box.style.display='block';box.setAttribute('aria-label','고정 SOG 속도 · kt (노트)');box.innerHTML=legendHtml();return box;};
    legend.addTo(map);return legend;
  }
  function addSpeedTrack(map, session) {
    var S=session.samples||[], starts=new Set((session.legs||[]).map(function(l){return l.start;}));
    var gap=(session.cfg&&session.cfg.gapThresholdSec)||8,seg=[],segColor=null,drawn=0;
    function valid(p){return p&&!p.gpsOutlier&&!p._excluded&&Number.isFinite(p.lat)&&Number.isFinite(p.lng);}
    function flush(){if(seg.length>1){global.L.polyline(seg,{color:segColor,weight:2.5,opacity:.95}).addTo(map);drawn++;}seg=[];}
    // Group equal-color edges without bridging exclusions, segment boundaries or GPS gaps.
    // The SOG at an edge's ending sample supplies its fixed absolute color.
    for(var i=1;i<S.length;i++){
      var a=S[i-1],b=S[i];
      if(!valid(a)||!valid(b)||starts.has(i)||!(b.t>a.t)||b.t-a.t>gap||(a.legId!=null&&b.legId!=null&&a.legId!==b.legId)){flush();continue;}
      var c=typeof b.speed==='number'&&Number.isFinite(b.speed)?colorFor(b.speed*KT):'#8996a2';
      if(c!==segColor){flush();segColor=c;}
      if(!seg.length)seg.push([a.lat,a.lng]);
      seg.push([b.lat,b.lng]);
    }
    flush();return drawn;
  }

  function render(host, session, analysis, opts) {
    opts = opts || {};
    if (!host || !global.L) return null;
    var S = (session && session.samples) || [];
    var pts = S.filter(function (p) {
      return p && !p.gpsOutlier && isFinite(p.lat) && isFinite(p.lng);
    });
    if (pts.length < 2) { host.textContent = 'No GPS points'; return null; }

    while (host.firstChild) host.removeChild(host.firstChild);
    host.style.height = (opts.height || 460) + 'px';

    var map = global.L.map(host, { zoomControl: true, attributionControl: true, zoomAnimation: false });
    /* §525 W14 — 배경 선택은 map-tactical 이 들고 있다. 여기서 타일을
       또 박으면 speed 모드만 위성이 안 먹는다(실측: 버튼은 켜지는데
       타일이 그대로였다). 한 곳에서만 정한다. */
    if (global.RD_MAP_TILES_APPROVED === true) {
    if (global.RDMapTactical && global.RDMapTactical.tileKey
        && global.RDMapTactical.tileKey() === 'satellite') {
      global.L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/'
        + 'World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18,
          /* §581 (옥대표 "Map data not yet available") — maxNativeZoom 이 없어서
                     Esri 에 없는 줌까지 타일을 요청했고, Esri 는 회색 안내판을 돌려준다.
                     커버리지는 **장소마다 다르다** — 실측:
                       새만금 앞바다  z15~18 영상 있음 · z19 안내판(회색 100%)
                       부산 송정      z16~19 전부 영상 있음
                     maxNativeZoom 18 을 두면 z19 에서는 z18 타일을 2배 확대해 쓴다.
                     약간 흐려지지만 회색 격자보다 낫다 — 지도가 아예 사라지는 것보다
                     흐린 지도가 낫다. */
          attribution: 'Imagery \u00a9 Esri, Maxar, Earthstar Geographics' }
      ).addTo(map);
    } else {
      global.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '\u00a9 OpenStreetMap'
      }).addTo(map);
    }

    }

    var drawn=addSpeedTrack(map,session);

    /* 회전 마커 */
    var mans = (analysis && analysis.maneuvers) || [];
    var markers = 0;
    mans.forEach(function (m, idx) {
      var s = S[m.apexIdx != null ? m.apexIdx : m.startIdx];
      if (!s || s.gpsOutlier || !isFinite(s.lat)) return;
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

    var inspectionMarker = null;
    function setInspection(p) {
      if (inspectionMarker) { map.removeLayer(inspectionMarker); inspectionMarker = null; }
      if (p && !p.gpsOutlier && p.lat != null && p.lng != null) inspectionMarker = global.L.circleMarker([p.lat,p.lng],{radius:7,color:'#ffd43b',fillOpacity:1}).addTo(map);
    }
    if (opts.onInspection) map.on('click',function(ev){var best=null,d=Infinity;S.forEach(function(p){if(p.gpsOutlier||p._excluded)return;var x=Math.pow(p.lat-ev.latlng.lat,2)+Math.pow(p.lng-ev.latlng.lng,2);if(x<d){d=x;best=p}});if(best)opts.onInspection(best)});
    var bounds = global.L.latLngBounds(pts.map(function (p) { return [p.lat, p.lng]; }));
    map.fitBounds(bounds, { padding: [24, 24], animate: false });
    /* §491 — 숨은 탭에서 만들어진 지도는 크기가 0 이라, 그 크기로 맞춘
       fitBounds 배율이 그대로 남아 엉뚱하게 확대돼 있다. invalidateSize
       만으로는 배율이 안 고쳐진다 — **경계도 다시 맞춰야** 한다.
       (map-tactical 에는 §486 에서 이미 넣었고, 여기만 빠져 있었다) */
    setTimeout(function () {
      try { map.invalidateSize(); map.fitBounds(bounds, { padding: [24, 24], animate: false }); }
      catch (e) {}
    }, 60);

    return { map: map, setInspection: setInspection, resize: function(){map.invalidateSize();map.fitBounds(bounds,{padding:[24,24],animate:false});}, segments: drawn, markers: markers, tiers: TIERS };
  }

  var API = { render: render, addSpeedTrack:addSpeedTrack, addSpeedLegend:addSpeedLegend, speedScale: {colorFor:colorFor, tiers:TIERS,legendHtml:legendHtml}, _test: { colorFor: colorFor, TIERS: TIERS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDMapV2 = API;
})(typeof window !== 'undefined' ? window : globalThis);
