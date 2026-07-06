/* ============================================================
 * charts.js — 시각화 레이어 (Leaflet 지도 · Chart.js · 폴라 canvas)
 * 외부 라이브러리(L, Chart)는 index.html 에서 cdnjs 로 로드.
 * ============================================================ */
(function (global) {
  'use strict';

  var KT = 1.9438444924406;

  /* i18n 변환 헬퍼 — RDI18n.T 가 있으면 현재 언어로, 없으면 원문. 차트
     config 문자열·캔버스 fillText 등 캔버스에 baked-in 되는 텍스트는
     호출 시점 언어로 평가돼야 하므로 함수 호출 패턴으로 감싼다. */
  function i18nT(k, v) {
    return (global.RDI18n && global.RDI18n.T) ? global.RDI18n.T(k, v) : k;
  }

  /* 차트 디자인 토큰 — js/chart-theme.js (window.RDChartTheme) 가 단일
     소스다. 색·폰트는 모두 여기서 읽고 하드코딩하지 않는다.
     사양: CHART-DESIGN-SYSTEM.md */
  var T = global.RDChartTheme;
  /* THEME — 토큰의 호환 뷰. 기존 호출부를 그대로 두고 색만 중앙화한다.
     T 가 없을 때(스크립트 누락)만 쓰는 폴백을 함께 둔다. */
  var THEME = (T && T.legacy) || {
    text:'#5C6F7E', textHi:'#0A2540', grid:'rgba(10,37,64,0.07)',
    line:'#0A2540', fill:'rgba(31,143,255,0.10)', sea:'#1F8FFF', sun:'#EF7D00',
    good:'#1FA055', bad:'#D6453A', cursor:'#FFB800',
    panel:'rgba(10,37,64,0.92)', faintLine:'rgba(10,37,64,0.20)'
  };
  /* 좌우색(포트/스타보드) — 좌우 비교 차트(바이올린·폴라)의 시리즈 색 */
  var SIDE = (T && T.side) ||
    { port:'#E12B2B', starboard:'#00A651', portInk:'#C42121', starboardInk:'#0B7C44' };
  /* 범주색 — 좋·나쁨 의미 없는 단순 구분 (세션 비교 차트 등) */
  var CAT = (T && T.category) ||
    ['#0A2540', '#1F8FFF', '#1FB6B6', '#6B7A8D', '#7A5FA8', '#C58A2E'];

  /* Chart.js 전역 기본값 — 폰트·색·격자·범례(하단 중앙·사각 스왓치)를
     한 번에 통일한다 (디자인 시스템 §레전드·§축·격자·타이포). */
  if (typeof Chart !== 'undefined') {
    if (T) T.applyChartDefaults(Chart);
    else { Chart.defaults.color = THEME.text; Chart.defaults.borderColor = THEME.grid; }
  }

  /* Layer 2.0 — 커스텀 canvas (폴라·바이올린·트림 핸들 등) 의 ctx.font
     하드코딩을 한 군데로 모은 헬퍼 (Danny 2026-05-26). chart-theme.js
     T.font.css() 가 단일 폰트-패밀리 + 사이즈 토큰을 만든다. 폴백은
     단순 system-ui. 모든 캔버스가 동일 폰트 패밀리를 쓰게 한다. */
  function cvFont(weight, size) {
    if (T && T.font && T.font.css) return T.font.css(weight, size);
    return (weight ? weight + ' ' : '') + size + 'px ' +
      '-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo",' +
      '"Malgun Gothic",system-ui,sans-serif';
  }

  /* 속도 분포 파이 색 — chart-theme.js statusAt() 5단계 ramp 직접 위임
     (옥대표님 2026-06-05 — 다른 그래프와 색감 통일 + 6 slice 구분 명확).
     이전 (2026-05-26 Layer 2.0): sea blue 단일 hue ramp (#BDD9FF → #1670CC).
     상태색과 의미 혼동 회피 의도였으나, 사용자 인지에서 "빠를수록 좋음"
     직관 매핑이 자연 → status 5단계 sequential 인코딩이 정합. 다른 차트
     (VPS donut · 효율 셀 등) 와 색감 통일 = 인지 효율 ↑.
     statusAt 5 앵커 (#D6453A → #EC8A2E → #F2C20E → #7FC241 → #1FA055):
       속도 낮음 = 빨강(veryBad) → 높음 = 초록(veryGood). 빠를수록 좋음.
     디자인 시스템 §1 상태색 "성과 잘함/못함 전용" 원칙은 속도 분포에도
     valid — 속도 자체가 "빠름=좋음" sequential 인코딩이므로.
     본인 (샘 정 #2) audit 자기 정정 — expert_dataviz_reference.md §2-8
     "sea blue 정확히 옳다" 평가 철회. 신규 hex 0건, 토큰 100% 재사용.
     minKt 인자 — bin 범위로 정규화해 6 slice 전체 5 앵커 ramp 사용
     (생략 시 0 default = 절대 정규화). renderHistogram 은 minKt 전달. */
  function speedColor(kt, maxKt, minKt) {
    var lo = (minKt != null) ? minKt : 0;
    var span = (maxKt - lo);
    var f = (span > 0) ? Math.max(0, Math.min(1, (kt - lo) / span)) : 0;
    /* RDChartTheme.statusAt(0..1) 위임 — null 또는 누락 시 sea blue fallback */
    if (T && typeof T.statusAt === 'function') return T.statusAt(f);
    return 'rgb(31,143,255)';                                 /* fallback */
  }
  /* §432 v2 — 속도 분포 파이 색: 절대 속도(kt) → 5-tier 신호등(형광) 이산 매핑.
     이전 speedColor 는 세션 min/max 로 정규화한 statusAt 연속 램프였다. 옥대표
     지시 = 절대 속도 기준 포일링 인지 구간(빠를수록 초록):
       <2 정지·바운스 = 레드(Learning) / 2–8 정체·워터스타트 = 오렌지(Foundational)
       / 8–14 저속 라이딩 = 옐로(Intermediate) / 14–18 포일링 안정 = 라임(Advanced)
       / 18+ 포일링 고속 = 에메랄드(Elite). 히스토그램 bin=2kt 라 경계(2·8·14·18)
       가 bin 에지와 정합. 팔레트는 chart-theme signal5 단일 소스. */
  var SPEED_TIER = (T && T.signal5) ||
    ['#FF0000', '#FFA500', '#FFCC00', '#00FF00', '#00CC5C'];
  function speedTierColor(kt) {
    var i = kt < 2 ? 0 : kt < 8 ? 1 : kt < 14 ? 2 : kt < 18 ? 3 : 4;
    return SPEED_TIER[i];
  }

  /* 지도 트랙 선·범례 — 느림=빨강·중간=주황·빠름=초록. 밝은 OSM 타일
     위에서 또렷하고 산뜻하게 보이도록 채도 높은 밝은 톤을 쓴다. 리플레이
     뷰어 지도(replay.js speedRamp)와 동일 ramp 로 두 지도의 항적선 색을
     맞춘다 (Danny 2026-05-24: 항적선이 어둡다 → 밝게). 속도 히스토그램
     버킷색(speedColor)과는 별개의 ramp 다. */
  function mapSpeedColor(kt, maxKt) {
    var f = maxKt > 0 ? Math.max(0, Math.min(1, kt / maxKt)) : 0;
    var stops = [[0, [231, 76, 60]], [0.5, [243, 156, 18]], [1, [46, 204, 113]]];
    for (var i = 1; i < stops.length; i++) {
      if (f <= stops[i][0]) {
        var lo = stops[i - 1], hi = stops[i];
        var k = (f - lo[0]) / (hi[0] - lo[0] || 1);
        return 'rgb(' +
          Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * k) + ',' +
          Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * k) + ',' +
          Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * k) + ')';
      }
    }
    return 'rgb(46,204,113)';
  }

  /* 회전 종류색 — 택/자이브/회전 (범주 성격, 좋·나쁨 의미 없음) */
  var TYPE_COLOR = (T && T.maneuver) ||
    { tack: THEME.sea, gybe: THEME.sun, turn: '#8295A8' };
  var TYPE_LABEL = { tack: '택킹', gybe: '자이빙', turn: '회전' };

  /* 심박 존 색 — 디자인 시스템 §4 (chart-theme.js hrZone). 존 분포 막대·
     심박 추이 배경 띠·범례가 모두 이 색을 공유한다(색=존 일관). */
  var HR_ZONE_COLOR = (T && T.hrZone)
    ? { z1: T.hrZone.z1, z2: T.hrZone.z2, z3: T.hrZone.z3,
        z4: T.hrZone.z4, z5: T.hrZone.z5 }
    /* §432 v2 폴백 — 신호등(낮음=그린 Z1 … 높음=레드 Z5), SPS 팔레트 일치. */
    : { z1: '#00CC5C', z2: '#00FF00', z3: '#FFCC00', z4: '#FFA500', z5: '#FF0000' };
  var HR_ZONE_REST = (T && T.hrZone) ? T.hrZone.rest : '#8295A8';   /* 휴식 (Z1 미만) */
  var HR_LINE = (T && T.hrZone) ? T.hrZone.line : '#C0392B';        /* 심박 곡선 */

  /* 모듈 내 인스턴스 보관 (재렌더 시 정리) */
  var inst = { map: null, mvMarkers: [], runHl: null, speed: null, hist: null,
               prog: null,
               detail: null, detailP: null, detailS: null,
               hr: null, hrZone: null, hrEff: null };

  /* 부호 있는 최소 각도차 (target - ref) */
  function angDiff(ref, target) {
    var d = (target - ref) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  }

  /* ---------- Leaflet 지도 ---------- */
  function renderMap(elId, session, analysis, opts) {
    opts = opts || {};
    if (inst.map) { try { inst.map.remove(); } catch (e) {} inst.map = null; }
    inst.mvMarkers = [];
    inst.runHl = null;          // 고속 구간 강조 레이어 — 지도 재생성 시 초기화
    inst.cursorMarker = null;
    inst.session = session;

    var el = document.getElementById(elId);
    if (!el || typeof L === 'undefined') return null;
    var S = session.samples;
    var b = session.bounds;

    // preferCanvas: 수천 개 폴리라인 세그먼트를 빠르게 렌더 (다운샘플링 없이 전량)
    var map = L.map(el, { zoomControl: true, attributionControl: true, preferCanvas: true });
    inst.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);
    map.fitBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]], { padding: [28, 28] });

    // 속도 그라데이션 폴리라인 — 모든 GPS 포인트 사용 (다운샘플링 없음)
    var maxKt = (analysis.summary && analysis.summary.maxSpeedMs || 1) * KT;
    var legs = session.legs && session.legs.length
      ? session.legs : [{ start: 0, end: S.length - 1 }];
    legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        var p0 = S[i - 1], p1 = S[i];
        var kt = (p1.speed || 0) * KT;
        L.polyline([[p0.lat, p0.lng], [p1.lat, p1.lng]], {
          /* 가는 선 — 마커를 가리지 않게 (Danny 2026-05-24: 항적선이
             굵다 → 가늘게). 리플레이 뷰어 지도와 동일 두께. */
          color: mapSpeedColor(kt, maxKt), weight: 2.5, opacity: 0.95
        }).addTo(map);
      }
    });

    // 시작·끝 마커
    L.circleMarker([S[0].lat, S[0].lng], {
      radius: 8, color: '#fff', weight: 2, fillColor: THEME.good, fillOpacity: 1
    }).addTo(map).bindTooltip(i18nT('시작'), { direction: 'top' });
    var e = S[S.length - 1];
    L.circleMarker([e.lat, e.lng], {
      radius: 8, color: '#fff', weight: 2, fillColor: THEME.bad, fillOpacity: 1
    }).addTo(map).bindTooltip(i18nT('종료'), { direction: 'top' });

    // 택/자이브 마커
    (analysis.maneuvers || []).forEach(function (m, idx) {
      var p = S[m.apexIdx];
      var mk = L.circleMarker([p.lat, p.lng], {
        radius: 7, color: '#fff', weight: 2,
        fillColor: TYPE_COLOR[m.type] || '#8295A8', fillOpacity: 0.95
      }).addTo(map);
      mk.bindTooltip(String(idx + 1),
        { permanent: true, direction: 'center', className: 'mv-num-label' });
      mk.on('click', function () { if (opts.onManeuverClick) opts.onManeuverClick(idx); });
      inst.mvMarkers.push(mk);
    });

    // 커서 마커 (차트·타임라인 hover sync) — 처음엔 숨김
    inst.cursorMarker = L.circleMarker([S[0].lat, S[0].lng], {
      radius: 8, color: '#fff', weight: 3, fillColor: '#0A2540',
      fillOpacity: 0, opacity: 0, interactive: false
    }).addTo(map);
    inst.cursorMarker.bindTooltip('', { direction: 'top', className: 'rd-cursor-tip' });

    // 지도 hover → 가장 가까운 샘플의 전체세션 시각(fullT) 보고
    if (opts.onHover) {
      map.on('mousemove', function (ev) {
        var idx = nearestSampleByLatLng(ev.latlng);
        opts.onHover(idx >= 0 ? sampleFullT(idx) : null, 'map');
      });
      map.on('mouseout', function () { opts.onHover(null, 'map'); });
    }

    setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 60);
    return map;
  }

  /* 위경도에서 가장 가까운 (렌더된 세션의) 샘플 인덱스 */
  function nearestSampleByLatLng(latlng) {
    var S = inst.session && inst.session.samples;
    if (!S || !S.length) return -1;
    var cosLat = Math.cos(latlng.lat * Math.PI / 180);
    var best = -1, bd = Infinity;
    for (var i = 0; i < S.length; i++) {
      var dLat = S[i].lat - latlng.lat;
      var dLng = (S[i].lng - latlng.lng) * cosLat;
      var d = dLat * dLat + dLng * dLng;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /* 경과시간에서 가장 가까운 샘플 인덱스 (t 오름차순 → 이진탐색) */
  function nearestSampleByTime(t) {
    var S = inst.session && inst.session.samples;
    if (!S || !S.length) return -1;
    var lo = 0, hi = S.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (S[mid].t < t) lo = mid + 1; else hi = mid;
    }
    if (lo > 0 && Math.abs(S[lo - 1].t - t) < Math.abs(S[lo].t - t)) return lo - 1;
    return lo;
  }
  /* 렌더된(편집된) 세션 샘플의 전체세션 기준 시각 */
  function sampleFullT(idx) {
    var S = inst.session && inst.session.samples;
    if (!S || !S[idx]) return 0;
    var off = (inst.session.editApplied && inst.session.editApplied.trimStart) || 0;
    return S[idx].t + off;
  }

  /* 회전 마커 강조 — 인덱스 1개 또는 배열 모두 허용 (다중 선택) */
  function highlightMapManeuver(indices) {
    var arr = Array.isArray(indices)
      ? indices : (indices != null && indices >= 0 ? [indices] : []);
    var set = {};
    arr.forEach(function (x) { set[x] = 1; });
    inst.mvMarkers.forEach(function (mk, i) {
      var on = !!set[i];
      mk.setStyle({ radius: on ? 11 : 7, weight: on ? 3 : 2 });
      if (on) mk.bringToFront();
    });
    // 1개만 선택했을 때만 지도를 이동 — 다중 선택 중엔 화면이 튀지 않게
    if (arr.length === 1 && inst.map && inst.mvMarkers[arr[0]]) {
      inst.map.panTo(inst.mvMarkers[arr[0]].getLatLng());
      inst.mvMarkers[arr[0]].openTooltip();
    }
  }

  /* ---------- 고속 구간(run) 트랙 강조 ----------
   * run.startIdx~endIdx 구간을 지도에 굵은 강조선으로 덮어 그린다.
   * 흰 외곽선 + 진한 본선 2겹이라 속도색 트랙 위에서도 또렷하다.
   * run 이 null·undefined 면 강조를 지우기만 한다. 인덱스는 현재
   * 렌더된 세션(inst.session) 샘플 기준 — 편집본도 그대로 동작한다. */
  function highlightMapRun(run) {
    if (inst.runHl && inst.map) {
      inst.runHl.forEach(function (ly) {
        try { inst.map.removeLayer(ly); } catch (e) {}
      });
    }
    inst.runHl = null;
    if (!run || !inst.map || !inst.session || typeof L === 'undefined') return;
    var S = inst.session.samples;
    var lo = run.startIdx, hi = run.endIdx;
    if (lo == null || hi == null || lo < 0 || hi >= S.length || hi <= lo) return;
    var pts = [];
    for (var i = lo; i <= hi; i++) pts.push([S[i].lat, S[i].lng]);
    var halo = L.polyline(pts, { color: '#FFFFFF', weight: 11, opacity: 0.95 })
      .addTo(inst.map);
    var line = L.polyline(pts, { color: THEME.textHi, weight: 5, opacity: 1 })
      .addTo(inst.map);
    var sm = L.circleMarker(pts[0], { radius: 6, color: '#fff', weight: 2,
      fillColor: THEME.good, fillOpacity: 1 }).addTo(inst.map);
    var em = L.circleMarker(pts[pts.length - 1], { radius: 6, color: '#fff',
      weight: 2, fillColor: THEME.bad, fillOpacity: 1 }).addTo(inst.map);
    halo.bringToFront(); line.bringToFront();
    sm.bringToFront(); em.bringToFront();
    inst.runHl = [halo, line, sm, em];
    try {
      inst.map.fitBounds(L.latLngBounds(pts), { padding: [44, 44], maxZoom: 17 });
    } catch (e) {}
  }

  /* ---------- 속도 시계열 차트 (택/자이브 구간 하이라이트 + 커서 sync) ---------- */
  function renderSpeedChart(elId, session, analysis, opts) {
    opts = opts || {};
    if (inst.speed) { inst.speed.destroy(); inst.speed = null; }
    var el = document.getElementById(elId);
    if (!el || typeof Chart === 'undefined') return null;

    var S = session.samples;
    var toSpd = opts.toSpeed || function (ms) { return ms * KT; };
    var unit = opts.unitLabel || 'kt';
    inst.session = session;
    inst.toSpeed = toSpd;
    inst.unitLabel = unit;
    inst.fmtX = opts.fmtX || null;

    /* 트랙 편집(통합 위젯) — 양끝 트림 핸들. trim 좌표는 원본 세션 기준 초.
       opts.trim = { start, end, fullDur } · opts.fullSamples = 원본 세션 샘플
       (트림 드래그 중 원본 전체 미리보기용) · opts.onTrim(start,end) 콜백. */
    inst.trim = opts.trim || null;
    inst.fullSamples = opts.fullSamples || null;
    inst.excludesFull = opts.excludeRangesFull || [];
    inst.onTrim = opts.onTrim || null;
    inst.trimMode = false;        // true = 트림 핸들 드래그 중(원본 전체 표시)
    inst.trimDrag = null;
    inst.fullMaxSp = 0.1;
    if (inst.fullSamples) {
      for (var fmi = 0; fmi < inst.fullSamples.length; fmi++) {
        if (inst.fullSamples[fmi].speed > inst.fullMaxSp) {
          inst.fullMaxSp = inst.fullSamples[fmi].speed;
        }
      }
    }

    // leg 단위 데이터 — 모든 GPS 포인트 사용 (다운샘플링 없음).
    // 제외 구간(leg 사이)은 NaN 으로 끊어 선이 이어지지 않게.
    var data = [];
    var legs = session.legs && session.legs.length
      ? session.legs : [{ start: 0, end: S.length - 1 }];
    legs.forEach(function (leg, li) {
      if (li > 0) data.push({ x: (S[leg.start].t + S[legs[li - 1].end].t) / 2, y: NaN });
      for (var i = leg.start; i <= leg.end; i++) {
        data.push({ x: S[i].t, y: +toSpd(S[i].speed).toFixed(2) });
      }
    });

    var maneuvers = analysis.maneuvers || [];
    var selSet = {};   // 선택된 회전 인덱스 (다중 선택)
    (opts.selectedManeuvers || []).forEach(function (x) { selSet[x] = 1; });
    var excludes = opts.excludeRanges || [];

    // 시각(차트 기준)이 어느 제외 구간 안인지 — 클릭 여유 5px
    function excludeIndexAtTime(t) {
      var sx = inst.speed && inst.speed.scales && inst.speed.scales.x;
      if (!sx) return -1;
      var tol = Math.abs(sx.getValueForPixel(5) - sx.getValueForPixel(0));
      for (var e = 0; e < excludes.length; e++) {
        if (t >= excludes[e].from - tol && t <= excludes[e].to + tol) return e;
      }
      return -1;
    }

    // 음영 플러그인 — 제외 구간(회색) + 택/자이브 구간
    var bandPlugin = {
      id: 'mvBands',
      beforeDatasetsDraw: function (c) {
        var xs = c.scales.x, ys = c.scales.y, ctx = c.ctx;
        ctx.save();
        // 트림 편집 중에는 원본 전체 미리보기가 덮으므로 일반 음영은 생략
        if (inst.trimMode) { ctx.restore(); return; }
        excludes.forEach(function (ex) {
          var x1 = xs.getPixelForValue(ex.from), x2 = xs.getPixelForValue(ex.to);
          var ew = Math.max(2, x2 - x1);
          ctx.fillStyle = 'rgba(92,111,126,0.20)';
          ctx.fillRect(x1, ys.top, ew, ys.bottom - ys.top);
          ctx.strokeStyle = 'rgba(92,111,126,0.6)'; ctx.lineWidth = 1;
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(x1, ys.top, ew, ys.bottom - ys.top);
          ctx.setLineDash([]);
          if (ew > 64) {
            ctx.fillStyle = THEME.text;
            ctx.font = cvFont(600, 10);
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(i18nT('제외 ✕ 클릭 해제'), x1 + ew / 2, ys.top + 4);
          }
        });
        maneuvers.forEach(function (m, idx) {
          var x1 = xs.getPixelForValue(S[m.startIdx].t);
          var x2 = xs.getPixelForValue(S[m.endIdx].t);
          var base = TYPE_COLOR[m.type] || '#8A99A8';
          var on = !!selSet[idx];
          ctx.fillStyle = hexA(base, on ? 0.32 : 0.13);
          ctx.fillRect(x1, ys.top, Math.max(2, x2 - x1), ys.bottom - ys.top);
          if (on) {
            ctx.strokeStyle = base; ctx.lineWidth = 1.5;
            ctx.strokeRect(x1, ys.top, Math.max(2, x2 - x1), ys.bottom - ys.top);
          }
        });
        // 드래그-선택 미리보기 (구간 제외)
        if (inst.dragSel) {
          var dx1 = xs.getPixelForValue(Math.min(inst.dragSel.t0, inst.dragSel.t1));
          var dx2 = xs.getPixelForValue(Math.max(inst.dragSel.t0, inst.dragSel.t1));
          ctx.fillStyle = 'rgba(222,70,57,0.22)';
          ctx.fillRect(dx1, ys.top, Math.max(2, dx2 - dx1), ys.bottom - ys.top);
          ctx.strokeStyle = '#DE4639'; ctx.lineWidth = 1.2;
          ctx.strokeRect(dx1, ys.top, Math.max(2, dx2 - dx1), ys.bottom - ys.top);
        }
        ctx.restore();
      },
      // 트림 핸들 + (드래그 중) 원본 전체 미리보기 — 데이터·음영 위에 그린다
      afterDraw: function (c) {
        var ctx = c.ctx;
        ctx.save();
        if (inst.trimMode && inst.trim && inst.fullSamples) drawTrimPreview(c);
        drawTrimHandles(c);
        ctx.restore();
      }
    };

    /* Layer 1.5 — 속도 시계열 fill 을 그라데이션으로 강화 (Danny 2026-05-26).
       chart context 로부터 canvas 의 chartArea 에 맞는 세로 그라데이션을
       만든다. 색의 *의미* 는 그대로 (속도 라인 = navy, 영역 = sea blue 톤). */
    function speedFillGradient(ctx) {
      var chart = ctx.chart;
      var area = chart && chart.chartArea;
      if (!area) return THEME.fill;            /* 초기 렌더 폴백 */
      var g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0,   'rgba(31,143,255,0.35)');
      g.addColorStop(0.5, 'rgba(31,143,255,0.15)');
      g.addColorStop(1,   'rgba(31,143,255,0.00)');
      return g;
    }
    inst.speed = new Chart(el.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [{
          label: i18nT('속도 ({u})', {u: unit}), data: data, spanGaps: false,
          borderColor: THEME.line, borderWidth: 1.8,
          fill: true, backgroundColor: speedFillGradient,
          pointRadius: 0, tension: 0.3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        parsing: false, normalized: true, animation: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            /* bounds:'data' — X축 범위를 데이터 실제 구간에 정확히 맞춘다.
               Chart.js 기본값 'ticks' 는 축 끝을 눈금의 '깔끔한 수'까지
               올림해서, 트림으로 남은 트랙이 짧아져도 축 최대가 같은
               올림값에 머물 수 있다(예: 원본 160분·트림 후 135분이 모두
               눈금 간격 때문에 0~167분으로 표시) → 잘린 구간이 빈 여백으로
               남는다. 'data' 로 두면 트림을 놓는 즉시 차트가 편집된
               세션을 그대로 그려 남은 구간이 가로 폭을 정확히 꽉 채운다. */
            bounds: 'data',
            title: { display: true, text: opts.xTitle || i18nT('경과 시간') },
            ticks: {
              callback: function (v) { return inst.fmtX ? inst.fmtX(v) : mmss(v); },
              maxTicksLimit: 8
            },
            grid: { color: THEME.grid }
          },
          y: {
            title: { display: true, text: i18nT('속도 ({u})', {u: unit}) },
            beginAtZero: true, grid: { color: THEME.grid }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        onResize: function () { sizeCrosshair(); },
        onHover: function (ev) {
          if (ev.x == null) return;
          // 트림 핸들 위 / 트림 편집 중 — 좌우 리사이즈 커서
          if (inst.trimMode || trimHandleAt(ev.x)) {
            el.style.cursor = 'ew-resize'; return;
          }
          var t = inst.speed.scales.x.getValueForPixel(ev.x);
          // 제외 구간 위에서는 커서를 손가락 모양으로 (클릭=해제 힌트)
          el.style.cursor = (excludeIndexAtTime(t) >= 0) ? 'pointer' : 'crosshair';
          if (!opts.onHover) return;
          var off = (session.editApplied && session.editApplied.trimStart) || 0;
          opts.onHover(t + off, 'chart');
        },
        onClick: function (ev) {
          // 트림 편집 중 / 트림·드래그 직후의 click 은 무시
          if (inst.trimMode) return;
          if (el._rdDragJustHappened) { el._rdDragJustHappened = false; return; }
          var t = inst.speed.scales.x.getValueForPixel(ev.x);
          // 제외 구간을 클릭하면 그 구간을 해제
          var exi = excludeIndexAtTime(t);
          if (exi >= 0) {
            if (opts.onExcludeRemove) opts.onExcludeRemove(exi);
            return;
          }
          for (var k = 0; k < maneuvers.length; k++) {
            if (t >= S[maneuvers[k].startIdx].t && t <= S[maneuvers[k].endIdx].t) {
              if (opts.onManeuverClick) opts.onManeuverClick(k);
              break;
            }
          }
        }
      },
      plugins: [bandPlugin]
    });

    inst.onExclude = opts.onExclude || null;
    bindSpeedDrag(el);
    ensureCrosshairOverlay(el);
    if (opts.onHover) {
      el.addEventListener('mouseleave', function () { opts.onHover(null, 'chart'); });
    }
    return inst.speed;
  }

  /* ---------- 트림 핸들 — 좌표 변환 · 그리기 (통합 위젯) ----------
     트림 좌표(inst.trim)는 원본 세션 기준 초. 트림 편집 중에는 차트가
     원본 전체를 [0, fullDur] 로 펼쳐 핸들을 양방향으로 옮길 수 있다. */
  var MIN_EXCLUDE_SEC = 5;       // 최소 제외 길이(초)
  var DRAG_THRESHOLD_PX = 7;     // 이만큼 움직이면 클릭이 아닌 드래그로 판정
  var TRIM_HANDLE_HIT = 14;      // 트림 핸들 터치 허용 반경(px)
  var TRIM_MIN_KEEP = 10;        // 트림 후 최소 남는 길이(초)

  function trimPlot() {
    var c = inst.speed;
    if (!c || !c.chartArea) return null;
    var a = c.chartArea;
    return { L: a.left, R: a.right, T: a.top, B: a.bottom,
             W: a.right - a.left, H: a.bottom - a.top };
  }
  /* 원본 세션 시각 → 픽셀 (트림 편집 중 [0,fullDur] 펼침 기준) */
  function trimTtoX(t) {
    var m = trimPlot();
    if (!m || !inst.trim || !inst.trim.fullDur) return 0;
    return m.L + (t / inst.trim.fullDur) * m.W;
  }
  function trimXtoT(px) {
    var m = trimPlot();
    if (!m || !inst.trim || !inst.trim.fullDur) return 0;
    var t = ((px - m.L) / m.W) * inst.trim.fullDur;
    return Math.max(0, Math.min(inst.trim.fullDur, t));
  }
  /* 포인터 x(px)가 트림 핸들 위인지 — 'start' | 'end' | null */
  function trimHandleAt(px) {
    if (!inst.trim || !inst.onTrim) return null;
    var m = trimPlot();
    if (!m) return null;
    var sPx = inst.trimMode ? trimTtoX(inst.trim.start) : m.L;
    var ePx = inst.trimMode ? trimTtoX(inst.trim.end) : m.R;
    var ds = Math.abs(px - sPx), de = Math.abs(px - ePx);
    if (ds <= TRIM_HANDLE_HIT && ds <= de) return 'start';
    if (de <= TRIM_HANDLE_HIT) return 'end';
    return null;
  }
  /* 트림 드래그 중 — 원본 세션 전체 속도 프로파일 + 잘릴 구간 음영 */
  function drawTrimPreview(c) {
    var ctx = c.ctx, m = trimPlot();
    if (!m) return;
    var fs = inst.fullSamples, trim = inst.trim;
    if (!fs || !fs.length) return;
    // 마스크 — 편집된 곡선을 가리고 원본 전체로 교체
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(m.L, m.T, m.W, m.H);
    var maxSp = inst.fullMaxSp || 0.1;
    function fy(sp) { return m.B - (sp / maxSp) * m.H; }
    // 원본 속도 프로파일 area + line
    ctx.beginPath();
    ctx.moveTo(trimTtoX(fs[0].t), m.B);
    for (var i = 0; i < fs.length; i++) ctx.lineTo(trimTtoX(fs[i].t), fy(fs[i].speed));
    ctx.lineTo(trimTtoX(fs[fs.length - 1].t), m.B);
    ctx.closePath();
    ctx.fillStyle = 'rgba(31,143,255,0.12)'; ctx.fill();
    ctx.beginPath();
    for (var j = 0; j < fs.length; j++) {
      var px = trimTtoX(fs[j].t), py = fy(fs[j].speed);
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = THEME.line; ctx.lineWidth = 1.2; ctx.stroke();
    // 잘려나갈 구간(트림 바깥) 어둡게
    var xs = trimTtoX(trim.start), xe = trimTtoX(trim.end);
    ctx.fillStyle = 'rgba(92,111,126,0.34)';
    if (xs > m.L) ctx.fillRect(m.L, m.T, xs - m.L, m.H);
    if (xe < m.R) ctx.fillRect(xe, m.T, m.R - xe, m.H);
    // 제외 구간(원본 좌표) — 빨간 박스
    (inst.excludesFull || []).forEach(function (r) {
      var rx = trimTtoX(r.from), rw = Math.max(2, trimTtoX(r.to) - trimTtoX(r.from));
      ctx.fillStyle = 'rgba(192,57,43,0.16)';
      ctx.fillRect(rx, m.T, rw, m.H);
      ctx.strokeStyle = 'rgba(192,57,43,0.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(rx, m.T, rw, m.H);
    });
  }
  /* 양끝 트림 핸들 — 일반 모드는 플롯 양 끝, 편집 중은 trim 위치 */
  function drawTrimHandles(c) {
    if (!inst.trim || !inst.onTrim) return;
    var ctx = c.ctx, m = trimPlot();
    if (!m) return;
    var sPx = inst.trimMode ? trimTtoX(inst.trim.start) : m.L;
    var ePx = inst.trimMode ? trimTtoX(inst.trim.end) : m.R;
    drawOneHandle(ctx, m, sPx, 'start');
    drawOneHandle(ctx, m, ePx, 'end');
  }
  function drawOneHandle(ctx, m, x, side) {
    x = Math.max(m.L, Math.min(m.R, x));
    // 세로 막대
    ctx.strokeStyle = '#E0A100'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, m.T); ctx.lineTo(x, m.B); ctx.stroke();
    // 그립 — 플롯 안쪽으로 (start=오른쪽, end=왼쪽)
    var gw = 11, gh = 26, gy = m.T + m.H / 2 - gh / 2;
    var gx = side === 'start' ? x : x - gw;
    roundRect(ctx, gx, gy, gw, gh, 3);
    ctx.fillStyle = '#FFB800'; ctx.fill();
    ctx.strokeStyle = '#E0A100'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#8A6300'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + gw / 2 - 2, gy + 7); ctx.lineTo(gx + gw / 2 - 2, gy + gh - 7);
    ctx.moveTo(gx + gw / 2 + 2, gy + 7); ctx.lineTo(gx + gw / 2 + 2, gy + gh - 7);
    ctx.stroke();
    // 트림 편집 중 — 잘릴 위치 시각(경과 mm:ss) 라벨
    if (inst.trimMode) {
      var t = side === 'start' ? inst.trim.start : inst.trim.end;
      ctx.fillStyle = '#0A2540';
      ctx.font = cvFont(600, 10);
      ctx.textBaseline = 'top';
      ctx.textAlign = side === 'start' ? 'left' : 'right';
      var lx = side === 'start'
        ? Math.min(m.R - 4, x + 8) : Math.max(m.L + 4, x - 8);
      ctx.fillText(mmss(t), lx, m.T + 2);
    }
  }

  /* ---------- 속도 시계열 포인터 — 트림 핸들 드래그 + 구간 제외 드래그 ---------- */
  function bindSpeedDrag(el) {
    if (el._rdSpeedDragBound) return;
    el._rdSpeedDragBound = true;
    el.style.cursor = 'crosshair';
    el.style.touchAction = 'pan-y';
    var down = null, rafId = null;
    function isMine() { return inst.speed && inst.speed.canvas === el; }
    function elX(ev) { return ev.clientX - el.getBoundingClientRect().left; }
    function pxToT(ev) { return inst.speed.scales.x.getValueForPixel(elX(ev)); }
    function renderSoon() {
      if (rafId) return;
      rafId = global.requestAnimationFrame(function () {
        rafId = null;
        if (isMine()) inst.speed.render();
      });
    }
    el.addEventListener('pointerdown', function (ev) {
      if (!isMine()) return;
      el._rdDragJustHappened = false;
      var px = elX(ev);
      // 1) 양끝 트림 핸들 — 잡으면 원본 전체를 펼쳐 양방향 조정
      var hit = trimHandleAt(px);
      if (hit && inst.trim) {
        drawCrosshair(-1);                // 트림 편집 진입 — 커서 제거
        inst.trimMode = true;
        inst.trimDrag = { side: hit, start0: inst.trim.start, end0: inst.trim.end };
        try { el.setPointerCapture(ev.pointerId); } catch (e) {}
        if (isMine()) inst.speed.render();
        return;
      }
      // 2) 본문 가로 드래그 → 구간 제외
      down = { px: px, t: pxToT(ev), dragging: false };
      try { el.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    el.addEventListener('pointermove', function (ev) {
      if (!isMine()) return;
      // 트림 핸들 드래그
      if (inst.trimDrag) {
        var t = trimXtoT(elX(ev));
        if (inst.trimDrag.side === 'start') {
          inst.trim.start = Math.max(0, Math.min(t, inst.trim.end - TRIM_MIN_KEEP));
        } else {
          inst.trim.end = Math.min(inst.trim.fullDur,
                                   Math.max(t, inst.trim.start + TRIM_MIN_KEEP));
        }
        renderSoon();
        return;
      }
      if (!down) return;
      var px = elX(ev);
      if (!down.dragging && Math.abs(px - down.px) > DRAG_THRESHOLD_PX) {
        down.dragging = true;
      }
      if (down.dragging) {
        inst.dragSel = { t0: down.t, t1: pxToT(ev) };
        renderSoon();
      }
    });
    function finish(ev) {
      try { el.releasePointerCapture(ev.pointerId); } catch (e) {}
      // 트림 핸들 드래그 종료 — 바뀌었으면 commit, 아니면 일반 모드 복귀
      if (inst.trimDrag) {
        var d = inst.trimDrag; inst.trimDrag = null;
        var changed = Math.abs(inst.trim.start - d.start0) > 0.5 ||
                      Math.abs(inst.trim.end - d.end0) > 0.5;
        if (changed && inst.onTrim) {
          el._rdDragJustHappened = true;
          inst.onTrim(inst.trim.start, inst.trim.end);   // 앱이 대시보드 재렌더
        } else {
          inst.trimMode = false;
          if (isMine()) inst.speed.render();
        }
        return;
      }
      if (!down) return;
      var wasDrag = down.dragging, sel = inst.dragSel;
      down = null; inst.dragSel = null;
      if (wasDrag) {
        el._rdDragJustHappened = true;   // 뒤따르는 click(회전 선택) 무시
        var a = sel ? Math.min(sel.t0, sel.t1) : 0;
        var b = sel ? Math.max(sel.t0, sel.t1) : 0;
        if (inst.onExclude && (b - a) >= MIN_EXCLUDE_SEC) {
          inst.onExclude(a, b);          // 대시보드 재렌더는 콜백 쪽에서
          return;
        }
      }
      if (isMine()) inst.speed.render();  // 미리보기 사각형 지우기
    }
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }

  /* ---------- 차트 ↔ 지도 커서 sync ----------
     속도 차트와 심박 차트가 같은 시간축을 공유하므로, 두 차트의
     crosshair 오버레이를 같은 샘플 인덱스로 함께 갱신한다. */
  function makeCrosshairOverlay(chartCanvas) {
    var box = chartCanvas.parentNode;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var ov = box.querySelector('.rd-crosshair');
    if (!ov) {
      ov = document.createElement('canvas');
      ov.className = 'rd-crosshair';
      ov.style.position = 'absolute';
      ov.style.left = '0'; ov.style.top = '0';
      ov.style.pointerEvents = 'none';
      box.appendChild(ov);
    }
    return ov;
  }
  function sizeOverlay(ov, chart) {
    if (!ov || !chart) return;
    var cv = chart.canvas;
    var w = cv.clientWidth, h = cv.clientHeight;
    var dpr = global.devicePixelRatio || 1;
    ov.width = w * dpr; ov.height = h * dpr;
    ov.style.width = w + 'px'; ov.style.height = h + 'px';
  }
  function ensureCrosshairOverlay(chartCanvas) {
    inst.crosshair = makeCrosshairOverlay(chartCanvas);
    sizeCrosshair();
  }
  function sizeCrosshair() {
    sizeOverlay(inst.crosshair, inst.speed);
    sizeOverlay(inst.hrCrosshair, inst.hr);
  }

  /* 차트 crosshair 를 (편집된 세션 기준) 시각으로 갱신 — 속도·심박
     두 차트에 동시 적용. */
  function setChartCursorByTime(editedT) {
    var idx = (editedT == null) ? -1 : nearestSampleByTime(editedT);
    drawCrosshair(idx);
    drawHrCrosshair(idx);
  }

  /* 한 차트의 오버레이에 세로선 + 데이터 점 + 시각 라벨을 그린다.
     valueOf(sample) → y축 값(그 차트 단위), fmtLabel(sample,xlab) → 라벨. */
  function drawCrosshairGeneric(ch, ov, idx, valueOf, fmtLabel, dotColor) {
    if (!ov || !ch) return;
    var dpr = global.devicePixelRatio || 1;
    var ctx = ov.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ov.width, ov.height);
    var S = inst.session && inst.session.samples;
    if (!S || idx < 0 || !S[idx] || !ch.scales || !ch.scales.x) return;
    var s = S[idx];
    var px = ch.scales.x.getPixelForValue(s.t);
    var yTop = ch.scales.y.top, yBot = ch.scales.y.bottom;
    if (px < ch.chartArea.left - 1 || px > ch.chartArea.right + 1) return;
    ctx.strokeStyle = 'rgba(10,37,64,0.38)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px, yTop); ctx.lineTo(px, yBot); ctx.stroke();
    ctx.setLineDash([]);
    var val = valueOf(s);
    if (val != null && isFinite(val)) {
      var py = ch.scales.y.getPixelForValue(val);
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor; ctx.fill();
      ctx.strokeStyle = '#0A2540'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    var xlab = inst.fmtX ? inst.fmtX(s.t) : mmss(s.t);
    var label = fmtLabel(s, xlab);
    ctx.font = cvFont(600, 11);
    var tw = ctx.measureText(label).width + 12;
    var lx = Math.min(Math.max(px - tw / 2, ch.chartArea.left),
                      ch.chartArea.right - tw);
    ctx.fillStyle = THEME.panel;
    roundRect(ctx, lx, yTop + 2, tw, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx + 6, yTop + 12);
  }
  function drawCrosshair(idx) {
    // 트림 편집 중에는 커서를 그리지 않는다 (편집 진입 시 한 번 비워짐)
    if (inst.trimMode && idx >= 0) return;
    drawCrosshairGeneric(inst.speed, inst.crosshair, idx,
      function (s) { return inst.toSpeed ? inst.toSpeed(s.speed) : s.speed * KT; },
      function (s, xlab) {
        var kt = inst.toSpeed ? inst.toSpeed(s.speed) : s.speed * KT;
        return xlab + ' · ' + kt.toFixed(1) + ' ' + (inst.unitLabel || 'kt');
      }, THEME.cursor);
  }
  function drawHrCrosshair(idx) {
    if (!inst.hr) return;
    drawCrosshairGeneric(inst.hr, inst.hrCrosshair, idx,
      function (s) { return (s.hr != null) ? s.hr : null; },
      function (s, xlab) {
        return xlab + ' · ' + (s.hr != null ? s.hr + ' bpm' : i18nT('심박 기록 없음'));
      }, HR_LINE);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /* 지도 커서를 임의 위경도에 직접 배치 (편집 타임라인용) */
  function setMapCursorLatLng(lat, lng, label) {
    if (!inst.cursorMarker) return;
    if (lat == null) {
      inst.cursorMarker.setStyle({ opacity: 0, fillOpacity: 0 });
      inst.cursorMarker.closeTooltip();
      return;
    }
    inst.cursorMarker.setLatLng([lat, lng]);
    inst.cursorMarker.setStyle({ opacity: 1, fillOpacity: 1 });
    inst.cursorMarker.setTooltipContent(label || '');
    inst.cursorMarker.openTooltip();
  }
  /* 지도를 해당 위경도로 부드럽게 팬 (차트 클릭 → 지도 점프용 — Danny 2026-05-27 §173).
     panTo 의 기본 애니메이션을 이용해 자연스럽게 이동한다. */
  function panMapToLatLng(lat, lng) {
    if (!inst.map || lat == null) return;
    try { inst.map.panTo([lat, lng], { animate: true, duration: 0.4 }); } catch (e) {}
  }
  function hideCursor() {
    drawCrosshair(-1);
    drawHrCrosshair(-1);
    if (inst.cursorMarker) {
      inst.cursorMarker.setStyle({ opacity: 0, fillOpacity: 0 });
      inst.cursorMarker.closeTooltip();
    }
  }

  /* 회전 상세 차트 인스턴스 정리 (단일·분할 타일 모두) */
  function destroyDetail() {
    ['detail', 'detailP', 'detailS'].forEach(function (k) {
      if (inst[k]) { try { inst[k].destroy(); } catch (e) {} inst[k] = null; }
    });
  }

  /* ---------- 회전 ±10초 상세 곡선 (Vantage 스타일) ----------
     ms = 회전 객체 배열.
       · 1개          → 단일 상세 (SOG·VMG·회전율, 툴팁 ON)
       · 2개+ 같은 택  → 겹쳐 그리기 + 평균 + ±1σ 밴드
       · 2개+ 포트·스타보드 혼재 + opts.split → 좌(포트)·우(스타보드)
         2 타일, 두 타일 Y축 스케일을 동일하게 맞춰 공정 비교.
     opts.split / opts.splitTargets={p,s} 로 분할 모드를 제어한다. */
  function renderManeuverDetail(elId, session, ms, opts) {
    opts = opts || {};
    destroyDetail();
    if (typeof Chart === 'undefined' || !ms || !ms.length) return null;

    var S = session.samples;
    var toSpd = opts.toSpeed || function (v) { return v * KT; };
    var unit = opts.unitLabel || 'kt';
    var wind = (opts.windDir != null) ? opts.windDir : null;
    var multi = ms.length > 1;

    /* 한 회전의 정점 ±10초 곡선 (SOG·VMG·회전율) */
    function buildCurve(m) {
      var apex = m.apexIdx, apexT = S[apex].t;
      var lo = apex, hi = apex;
      while (lo > 0 && apexT - S[lo - 1].t <= 10) lo--;
      while (hi < S.length - 1 && S[hi + 1].t - apexT <= 10) hi++;
      var vmgSign = (m.type === 'gybe') ? -1 : 1;
      var sog = [], rate = [], vmg = [];
      for (var i = lo; i <= hi; i++) {
        var x = S[i].t - apexT;
        sog.push({ x: x, y: +toSpd(S[i].speed).toFixed(2) });
        var dtr = (i > lo) ? (S[i].t - S[i - 1].t) : 0;
        var tr = (dtr > 0 && S[i].heading != null && S[i - 1].heading != null)
          ? angDiff(S[i - 1].heading, S[i].heading) / dtr : 0;
        rate.push({ x: x, y: tr });
        if (wind != null && S[i].heading != null) {
          var twa = Math.abs(angDiff(wind, S[i].heading));
          var v = S[i].speed * Math.cos(twa * Math.PI / 180);
          vmg.push({ x: x, y: +toSpd(vmgSign * v).toFixed(2) });
        }
      }
      return { m: m, sog: sog, rate: rate, vmg: vmg };
    }
    /* x 증가 정렬된 곡선에서 gx 시각의 값을 선형 보간 (범위 밖이면 null) */
    function interpAt(pts, gx) {
      if (!pts.length || gx < pts[0].x || gx > pts[pts.length - 1].x) return null;
      for (var i = 1; i < pts.length; i++) {
        if (pts[i].x >= gx) {
          var a = pts[i - 1], b = pts[i];
          var f = (b.x - a.x) > 1e-9 ? (gx - a.x) / (b.x - a.x) : 0;
          return a.y + (b.y - a.y) * f;
        }
      }
      return pts[pts.length - 1].y;
    }
    /* 여러 곡선을 -10~+10초 0.5초 격자에 리샘플 → 격자별 평균·표준편차.
       useAbs: 회전율처럼 부호를 무시하고 크기로 평균낼 때 true. */
    function meanStdCurves(list, useAbs) {
      var out = [];
      for (var gx = -10; gx <= 10.001; gx += 0.5) {
        var vals = [];
        for (var k = 0; k < list.length; k++) {
          var y = interpAt(list[k], gx);
          if (y != null) vals.push(useAbs ? Math.abs(y) : y);
        }
        if (vals.length) {
          var m = 0, j;
          for (j = 0; j < vals.length; j++) m += vals[j];
          m /= vals.length;
          var sd = 0;
          for (j = 0; j < vals.length; j++) sd += (vals[j] - m) * (vals[j] - m);
          sd = Math.sqrt(sd / vals.length);
          out.push({ x: +gx.toFixed(1), mean: m, std: sd });
        }
      }
      return out;
    }
    function meanLine(arr) {
      return arr.map(function (p) { return { x: p.x, y: +p.mean.toFixed(2) }; });
    }
    function bandUpper(arr) {
      return arr.map(function (p) { return { x: p.x, y: +(p.mean + p.std).toFixed(2) }; });
    }
    function bandLower(arr) {
      return arr.map(function (p) {
        return { x: p.x, y: +Math.max(0, p.mean - p.std).toFixed(2) };
      });
    }

    /* apex(회전 정점) 표시선 — 모든 상세 차트 공용 */
    var apexLine = {
      id: 'apexLine',
      afterDatasetsDraw: function (c) {
        var xs = c.scales.x, ctx = c.ctx, px = xs.getPixelForValue(0);
        ctx.save();
        ctx.strokeStyle = 'rgba(222,70,57,0.85)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(px, c.scales.y.top); ctx.lineTo(px, c.scales.y.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(222,70,57,0.95)';
        ctx.font = cvFont(600, 10); ctx.textAlign = 'center';
        ctx.fillText(i18nT('회전 정점'), px, c.scales.y.top + 11);
        ctx.restore();
      }
    };

    /* 옅은 세로 그라데이션 — ±1σ 밴드 채움색 */
    function bandFill(hex) {
      return function (cx) {
        var ch = cx.chart, area = ch.chartArea;
        if (!area) return hexA(hex, 0.14);
        var g = ch.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, hexA(hex, 0.05));
        g.addColorStop(0.5, hexA(hex, 0.24));
        g.addColorStop(1, hexA(hex, 0.05));
        return g;
      };
    }

    /* 단일 회전 데이터셋 — SOG 굵게 + VMG 점선 + 회전율 */
    function singleDatasets(c) {
      var out = [{
        label: 'SOG (' + unit + ')', data: c.sog, borderColor: THEME.line,
        borderWidth: 2.6, pointRadius: 2.2, tension: 0.3, yAxisID: 'y', fill: false
      }];
      if (c.vmg.length) out.push({
        label: i18nT('VMG ({dir}, {u})', {dir: i18nT(c.m.type === 'gybe' ? '풍하' : '풍상'), u: unit}),
        data: c.vmg, borderColor: THEME.sea, borderWidth: 1.8, pointRadius: 0,
        tension: 0.3, yAxisID: 'y', borderDash: [5, 3], fill: false
      });
      out.push({
        label: i18nT('회전율 (°/s)'),
        data: c.rate.map(function (p) { return { x: p.x, y: +p.y.toFixed(1) }; }),
        borderColor: THEME.sun, borderWidth: 1.6, pointRadius: 0, tension: 0.3,
        yAxisID: 'y1', fill: false
      });
      return out;
    }

    /* 다중 회전 데이터셋 — 개별 곡선(연한 선) + ±1σ 밴드 + 평균(굵은 선).
       밴드는 평균 SOG·평균 회전율 곡선 각각의 표준편차 폭을 옅은
       그라데이션으로 채운다 — 좁으면 일관된 회전, 넓으면 들쭉날쭉. */
    function multiDatasets(curves) {
      var sogMS = meanStdCurves(curves.map(function (c) { return c.sog; }), false);
      var rateMS = meanStdCurves(curves.map(function (c) { return c.rate; }), true);
      var ds = [];
      // ±1σ 밴드 (맨 아래 — 개별·평균 곡선이 위에 보이도록 먼저 push)
      ds.push({ label: '', data: bandUpper(sogMS), yAxisID: 'y',
        borderColor: 'transparent', pointRadius: 0, fill: false, tension: 0.3 });
      ds.push({ label: i18nT('SOG ±1σ 밴드'), data: bandLower(sogMS), yAxisID: 'y',
        borderColor: 'transparent', pointRadius: 0, fill: '-1',
        backgroundColor: bandFill(THEME.sea), tension: 0.3 });
      ds.push({ label: '', data: bandUpper(rateMS), yAxisID: 'y1',
        borderColor: 'transparent', pointRadius: 0, fill: false, tension: 0.3 });
      ds.push({ label: i18nT('회전율 ±1σ 밴드'), data: bandLower(rateMS), yAxisID: 'y1',
        borderColor: 'transparent', pointRadius: 0, fill: '-1',
        backgroundColor: bandFill(THEME.sun), tension: 0.3 });
      // 개별 곡선 (연한 선)
      curves.forEach(function (c) {
        ds.push({ label: '', data: c.sog, borderColor: THEME.faintLine,
          borderWidth: 1, pointRadius: 0, tension: 0.3, yAxisID: 'y', fill: false });
      });
      curves.forEach(function (c) {
        ds.push({ label: '',
          data: c.rate.map(function (p) { return { x: p.x, y: +Math.abs(p.y).toFixed(1) }; }),
          borderColor: 'rgba(239,125,0,0.30)',
          borderWidth: 1, pointRadius: 0, tension: 0.3, yAxisID: 'y1', fill: false });
      });
      // 평균 곡선 (맨 위 — 개별 곡선보다 또렷하되 과하게 굵지 않게)
      ds.push({ label: i18nT('평균 SOG ({u})', {u: unit}), data: meanLine(sogMS),
        borderColor: THEME.line, borderWidth: 2.6, pointRadius: 0, tension: 0.3,
        yAxisID: 'y', fill: false });
      ds.push({ label: i18nT('평균 회전율 (°/s)'), data: meanLine(rateMS),
        borderColor: THEME.sun, borderWidth: 2.4, pointRadius: 0, tension: 0.3,
        yAxisID: 'y1', fill: false });
      return ds;
    }

    /* 곡선 묶음의 SOG·회전율 최대치 → 분할 타일 공통 Y축 범위 */
    function rangeOf(allCurves) {
      var yMax = 0, y1Max = 0;
      allCurves.forEach(function (c) {
        c.sog.forEach(function (p) { if (p.y > yMax) yMax = p.y; });
        c.rate.forEach(function (p) {
          var a = Math.abs(p.y); if (a > y1Max) y1Max = a;
        });
      });
      return { yMax: (yMax * 1.12) || 1, y1Max: (y1Max * 1.15) || 1 };
    }

    /* 상세 차트 1개 생성. fixed={yMax,y1Max} 면 Y축 고정(분할 비교용).
       showLegend=false 면 Chart.js 범례를 끈다 — 분할 타일·다중 겹쳐보기는
       그래프 아래 공용 레전드(app.js)를 쓰므로 타일마다 중복하지 않는다. */
    function makeChart(canvasId, ds, fixed, tooltipOn, showLegend) {
      var cv = document.getElementById(canvasId);
      if (!cv) return null;
      return new Chart(cv.getContext('2d'), {
        type: 'line',
        data: { datasets: ds },
        options: {
          responsive: true, maintainAspectRatio: false,
          parsing: false, normalized: true, animation: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              type: 'linear', min: -10, max: 10,
              title: { display: true, text: i18nT('회전 정점 기준 경과 시간 (sec)') },
              ticks: { stepSize: 5, callback: function (v) { return (v > 0 ? '+' : '') + v; } },
              grid: { color: THEME.grid }
            },
            y: {
              position: 'left', beginAtZero: true,
              max: (fixed && fixed.yMax != null) ? fixed.yMax : undefined,
              title: { display: true, text: i18nT('속도 ({u})', {u: unit}) },
              grid: { color: THEME.grid }
            },
            y1: {
              position: 'right', beginAtZero: multi,
              max: (fixed && fixed.y1Max != null) ? fixed.y1Max : undefined,
              title: { display: true, text: i18nT(multi ? '회전율 크기 (°/s)' : '회전율 (°/s)') },
              grid: { display: false }
            }
          },
          plugins: {
            legend: {
              display: showLegend !== false,
              position: 'bottom',
              labels: { filter: function (it) { return !!it.text; } }
            },
            tooltip: {
              enabled: !!tooltipOn,
              callbacks: {
                title: function (it) {
                  var x = it[0].parsed.x;
                  return (x > 0 ? '+' : '') + x + ' sec';
                }
              }
            }
          }
        },
        plugins: [apexLine]
      });
    }

    // --- 분할 모드: 포트·스타보드 양쪽 택이 섞여 있으면 좌우 2 타일 ---
    if (opts.split && multi && opts.splitTargets) {
      var pMs = ms.filter(function (m) { return m.side === 'P'; });
      var sMs = ms.filter(function (m) { return m.side === 'S'; });
      if (pMs.length && sMs.length) {
        var pCurves = pMs.map(buildCurve);
        var sCurves = sMs.map(buildCurve);
        var fixed = rangeOf(pCurves.concat(sCurves));   // 두 타일 동일 스케일
        inst.detailP = makeChart(opts.splitTargets.p, multiDatasets(pCurves), fixed, false, false);
        inst.detailS = makeChart(opts.splitTargets.s, multiDatasets(sCurves), fixed, false, false);
        return { p: inst.detailP, s: inst.detailS };
      }
      // 한쪽 택만 선택됐으면 단일 차트로 폴백
    }

    // --- 단일 차트: 회전 1개 또는 한쪽 택만 (분할 아님) ---
    var curves = ms.map(buildCurve);
    var ds = multi ? multiDatasets(curves) : singleDatasets(curves[0]);
    // 다중 겹쳐보기는 공용 레전드(app.js)를 쓰므로 Chart.js 범례를 끈다.
    inst.detail = makeChart(elId, ds, null, !multi, !multi);
    return inst.detail;
  }

  /* ---------- 포트/스타보드 택 분포 — 좌우 대칭 바이올린 (custom canvas) ----------
     vdata = {
       port:      { values:[], weights:[], avg, top50, top20, count },
       starboard: { values:[], weights:[], avg, top50, top20, count },
       axisMin, axisMax,     // 값 축(표시 단위) 범위
       unit                  // 'kt' | 'km/h' | '°'
     }
     가운데 세로축 기준 — 왼쪽 = 포트(P), 오른쪽 = 스타보드(S).
     각 쪽에 시간가중 KDE 밀도(바이올린) + 내 평균선(실선) + 상위 50%선
     (회색 파선) + 상위 20%선(곤색 점선)을 겹쳐, 좌·우 택을 한눈에 본다. */
  function renderViolin(elId, vdata, opts) {
    opts = opts || {};
    var el = document.getElementById(elId);
    if (!el || !vdata) return;
    var P = vdata.port || { values: [], weights: [] };
    var Sb = vdata.starboard || { values: [], weights: [] };
    var lo = vdata.axisMin, hi = vdata.axisMax;
    if (!(hi > lo)) hi = lo + 1;
    var span = hi - lo;
    var unit = vdata.unit || '';
    var us = (unit === '°') ? '°' : (unit ? ' ' + unit : '');
    function fmtV(v) { return (Math.round(v * 10) / 10) + us; }

    var dpr = global.devicePixelRatio || 1;
    var W = Math.max(280, Math.min(el.clientWidth || 640, 880));
    var H = Math.max(320, Math.min(Math.round(W * 0.56), 460));
    el.width = W * dpr; el.height = H * dpr;
    el.style.height = H + 'px';
    var ctx = el.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var padL = 56, padR = 16, padT = 36, padB = 30;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var cx = padL + plotW / 2;
    var halfMax = plotW / 2 - 10;
    function vy(v) { return padT + (hi - v) / span * plotH; }

    /* --- 시간가중 통계 + 가우시안 KDE --- */
    function wStats(vals, wts) {
      var sw = 0, swx = 0, sw2 = 0, i;
      for (i = 0; i < vals.length; i++) {
        sw += wts[i]; swx += wts[i] * vals[i]; sw2 += wts[i] * wts[i];
      }
      var mean = sw > 0 ? swx / sw : 0, swxx = 0;
      for (i = 0; i < vals.length; i++) swxx += wts[i] * (vals[i] - mean) * (vals[i] - mean);
      return {
        sumW: sw, std: Math.sqrt(sw > 0 ? swxx / sw : 0),
        neff: sw2 > 0 ? (sw * sw) / sw2 : vals.length
      };
    }
    var NGRID = 96;
    function kde(side) {
      var vals = side.values || [], wts = side.weights || [];
      if (vals.length < 1) return null;
      var st = wStats(vals, wts);
      var bw = 1.06 * st.std * Math.pow(Math.max(2, st.neff), -0.2);
      if (!(bw > 0)) bw = span / 40;
      bw = Math.max(bw, span / 60);          // 너무 뾰족해지지 않게 하한
      var sw = st.sumW > 0 ? st.sumW : vals.length;
      var dens = [], g, i;
      for (g = 0; g < NGRID; g++) {
        var x = lo + span * g / (NGRID - 1), d = 0;
        for (i = 0; i < vals.length; i++) {
          var u = (x - vals[i]) / bw;
          d += wts[i] * Math.exp(-0.5 * u * u);
        }
        dens.push(d / (sw * bw * Math.sqrt(2 * Math.PI)));
      }
      return dens;
    }
    var densP = kde(P), densS = kde(Sb), maxD = 1e-9;
    [densP, densS].forEach(function (d) {
      if (d) d.forEach(function (v) { if (v > maxD) maxD = v; });
    });

    /* --- 배경 격자 + Y 라벨 --- */
    var step = span > 120 ? 30 : (span > 60 ? 20 : (span > 24 ? 5 : (span > 10 ? 2 : 1)));
    ctx.font = cvFont(null, 10);
    ctx.textBaseline = 'middle';
    for (var gv = Math.ceil(lo / step) * step; gv <= hi + 1e-6; gv += step) {
      var gy = vy(gv);
      ctx.strokeStyle = THEME.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
      ctx.fillStyle = THEME.text; ctx.textAlign = 'right';
      ctx.fillText(gv + us, padL - 7, gy);
    }
    ctx.strokeStyle = 'rgba(10,37,64,0.28)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + plotH); ctx.stroke();

    /* --- 한 쪽 바이올린 + 평균선/상위선 --- */
    function drawSide(side, dens, sign, color) {
      var n = side.count || (side.values && side.values.length) || 0;
      if (dens && n >= 3) {
        var pts = [], g;
        for (g = 0; g < NGRID; g++) {
          var x = lo + span * g / (NGRID - 1);
          pts.push([cx + sign * (dens[g] / maxD * halfMax), vy(x)]);
        }
        ctx.beginPath();
        ctx.moveTo(cx, pts[0][1]);
        pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
        ctx.lineTo(cx, pts[pts.length - 1][1]);
        ctx.closePath();
        ctx.fillStyle = hexA(color, 0.20); ctx.fill();
        ctx.beginPath();
        pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      } else {
        ctx.fillStyle = THEME.text;
        ctx.font = cvFont(null, 11); ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n ? i18nT('표본 부족 ({n})', {n: n}) : i18nT('데이터 없음'),
          cx + sign * halfMax / 2, padT + plotH / 2);
      }
      function hline(val, dash, lw, c) {
        if (val == null || isNaN(val) || val < lo || val > hi) return;
        var y = vy(val);
        ctx.save();
        ctx.setLineDash(dash);
        ctx.strokeStyle = c; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + sign * halfMax, y);
        ctx.stroke();
        ctx.restore();
      }
      /* 세 기준선 — VMG 패널의 전체평균/상위50/상위20 과 같은 정의.
         실선(내 평균) · 회색 파선(상위 50%) · 곤색 점선(상위 20%) 으로 구분. */
      hline(side.top20, [2, 3], 1.8, THEME.textHi);   // 상위 20% — 곤색 점선
      hline(side.top50, [7, 4], 1.8, THEME.text);     // 상위 50% — 회색 파선
      hline(side.avg, [], 2.6, color);                // 내 평균 — 실선
      function valLabel(val, c, dy, frac) {
        if (val == null || isNaN(val) || val < lo || val > hi) return;
        var y = vy(val) + dy;
        var txt = fmtV(val);
        ctx.font = cvFont(700, 11);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var tw = ctx.measureText(txt).width + 10;
        var lx = cx + sign * halfMax * frac;
        lx = Math.max(padL + tw / 2, Math.min(lx, W - padR - tw / 2));
        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        roundRect(ctx, lx - tw / 2, y - 8, tw, 16, 4); ctx.fill();
        ctx.fillStyle = c;
        ctx.fillText(txt, lx, y);
      }
      valLabel(side.top20, THEME.textHi, -10, 0.5);   // 상위 20%
      valLabel(side.top50, THEME.text, -10, 0.8);     // 상위 50% (가로 엇갈림)
      valLabel(side.avg, color, 11, 0.5);             // 내 평균
    }
    /* 좌우 비교 차트 — 색 = 좌우 (디자인 시스템 §2). 포트=홍·스타보드=녹 */
    drawSide(P, densP, -1, SIDE.port);
    drawSide(Sb, densS, 1, SIDE.starboard);

    /* --- 상단 P/S 라벨 · 하단 밀도 힌트 --- */
    ctx.textBaseline = 'alphabetic';
    ctx.font = cvFont(700, 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = SIDE.port;
    ctx.fillText(i18nT('◀ 포트 (P)'), cx - plotW / 4, padT - 16);
    ctx.fillStyle = SIDE.starboard;
    ctx.fillText(i18nT('스타보드 (S) ▶'), cx + plotW / 4, padT - 16);
    ctx.font = cvFont(null, 10);
    ctx.fillStyle = 'rgba(92,111,126,0.75)';
    ctx.textAlign = 'left';
    ctx.fillText(i18nT('← 밀도'), padL, H - 9);
    ctx.textAlign = 'right';
    ctx.fillText(i18nT('밀도 →'), W - padR, H - 9);
  }

  /* ---------- 속도 분포 파이차트 ----------
   * 세션 시간이 각 속도 구간에 얼마씩 분포하는지를 '전체 대비 비율(%)'
   * 로 보여 준다. 체류 시간 0인 빈은 제외하고, 체류 비율이 작은 자잘한
   * 구간(OTHER_PCT_THRESHOLD 미만)은 단일 '기타' 조각으로 합쳐 범례가
   * 0~1% 슬라이스로 줄줄이 어지러워지지 않게 한다. 슬라이스 색은
   * 속도색 그라데이션과 일치. */
  function renderHistogram(elId, histogram, opts) {
    opts = opts || {};
    if (inst.hist) { inst.hist.destroy(); inst.hist = null; }
    var el = document.getElementById(elId);
    if (!el || typeof Chart === 'undefined' || !histogram) return null;

    var kmh = opts.unit === 'kmh';
    var conv = kmh ? (1 / KT * 3.6) : 1;
    var unit = kmh ? 'km/h' : 'kt';
    var maxKt = 0;
    histogram.forEach(function (b) { if (b.toKt > maxKt) maxKt = b.toKt; });

    /* 작은 구간 '기타' 병합 (Danny 2026-05-25) — 체류 시간 비율이
       OTHER_PCT_THRESHOLD 미만인 자잘한 구간을 단일 '기타' 조각 하나로
       합친다. 0% 로 표기되는 구간이 범례에 줄줄이 늘어서지 않게 하고,
       임계 이상(주요 구간 — 두 자릿수 % 포함)은 늘 개별 조각으로
       남긴다. '기타' 색은 합쳐진 구간들의 체류시간 가중 평균 속도로
       속도 램프에서 고른다(디자인 시스템 일관). */
    var OTHER_PCT_THRESHOLD = 3;   // % — 이 미만이면 '기타'로 흡수

    // 체류 시간이 있는 빈만 — 0초 빈은 파이에 보이지 않는다
    var liveBins = histogram.filter(function (b) { return b.seconds > 0; });
    if (!liveBins.length) return null;
    var totalSec = liveBins.reduce(
      function (s, b) { return s + b.seconds; }, 0) || 1;

    /* 체류 비율로 주요 구간 / 자잘한 구간 분리 */
    var mainBins = [], smallBins = [];
    liveBins.forEach(function (b) {
      if (b.seconds / totalSec * 100 < OTHER_PCT_THRESHOLD) smallBins.push(b);
      else mainBins.push(b);
    });
    /* 합칠지 결정 — 자잘한 구간이 2개 이상이면 묶는다. 1개뿐이라도
       그게 0%로 반올림되면 반드시 흡수한다(0% 구간 개별 노출 금지).
       1개뿐이고 0%가 아니면(예: 2%대 단일 구간) 묶을 군더더기가 없어
       그대로 개별로 둔다. */
    var smallHasZero = smallBins.some(function (b) {
      return Math.round(b.seconds / totalSec * 100) === 0;
    });
    var bins, otherDetail = null;
    if (smallBins.length >= 2 || (smallBins.length === 1 && smallHasZero)) {
      var otherSec = smallBins.reduce(
        function (s, b) { return s + b.seconds; }, 0);
      /* 체류시간 가중 평균 속도 → 속도 램프 색 (디자인 시스템 일관) */
      var otherSpeed = smallBins.reduce(function (s, b) {
        return s + (b.fromKt + b.toKt) / 2 * b.seconds;
      }, 0) / otherSec;
      /* 툴팁용 — 합쳐진 구간 목록(속도 오름차순) + 각 구간 비율 */
      otherDetail = smallBins.slice().sort(function (a, b) {
        return a.fromKt - b.fromKt;
      }).map(function (b) {
        return (b.fromKt * conv).toFixed(0) + '–' +
          (b.toKt * conv).toFixed(0) + ' ' + unit + '  ' +
          (b.seconds / totalSec * 100).toFixed(1) + '%';
      });
      bins = mainBins.concat([
        { isOther: true, seconds: otherSec, otherSpeed: otherSpeed }
      ]);
    } else {
      bins = liveBins;          // 묶을 자잘한 구간이 없으면 전부 개별
    }

    var labels = bins.map(function (b) {
      if (b.isOther) return i18nT('기타');
      return (b.fromKt * conv).toFixed(0) + '–' + (b.toKt * conv).toFixed(0) +
             ' ' + unit;
    });
    var mins = bins.map(function (b) { return b.seconds / 60; });
    /* §432 v2 — 슬라이스 색 = 절대 속도 → 5-tier 신호등(형광) 이산 매핑.
       (이전엔 세션 min/max 정규화 연속 램프. 이제 절대 속도 기준이라 저속
       세션은 초록 조각이 안 나오는 게 정상 = "빠를수록 초록" 정직 표현.) */
    var colors = bins.map(function (b) {
      var mid = b.isOther ? b.otherSpeed : (b.fromKt + b.toKt) / 2;
      return speedTierColor(mid);
    });
    var pcts = bins.map(function (b) { return b.seconds / totalSec * 100; });

    /* §432 v2 — 파이 slice 에 은은한 음영(SPS 도넛·chip 정합). arc 그리기 직전
       soft drop-shadow 를 켜고, 라벨 그리기 전에 반드시 끈다(순서: pieShadow 가
       sliceLabels 보다 앞 → afterDatasetsDraw 에서 먼저 restore 되어 % 글자엔
       그림자 안 붙음). 흰 1.5px 슬라이스 경계는 유지해 이웃 슬라이스 seam 방지. */
    var pieShadow = {
      id: 'pieShadow',
      beforeDatasetsDraw: function (c) {
        var x = c.ctx;
        x.save();
        x.shadowColor = 'rgba(10,37,64,0.16)';
        x.shadowBlur = 6;
        x.shadowOffsetY = 2;
      },
      afterDatasetsDraw: function (c) { c.ctx.restore(); }
    };

    /* 슬라이스 위에 비율(%) 직접 표기 — datalabels 플러그인 없이
       afterDatasetsDraw 에서 호(arc) 중심에 그린다. 너무 작은
       슬라이스(<7%)는 글자가 겹치므로 생략(범례·툴팁으로 확인). */
    var sliceLabels = {
      id: 'pieSliceLabels',
      afterDatasetsDraw: function (c) {
        var meta = c.getDatasetMeta(0);
        if (!meta || !meta.data) return;
        var ctx = c.ctx;
        ctx.save();
        ctx.font = cvFont(700, 11);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        meta.data.forEach(function (arc, i) {
          if (pcts[i] < 7 || !arc.getCenterPoint) return;
          var p = arc.getCenterPoint();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(Math.round(pcts[i]) + '%', p.x, p.y);
        });
        ctx.restore();
      }
    };

    inst.hist = new Chart(el.getContext('2d'), {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: i18nT('체류 시간'),
          data: mins.map(function (v) { return +v.toFixed(3); }),
          backgroundColor: colors,
          borderColor: '#FFFFFF',
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        layout: { padding: 4 },
        plugins: {
          legend: {
            /* 위치(하단 중앙)·스왓치(사각형)·폰트는 디자인 시스템 기본값
               (applyChartDefaults)을 그대로 따른다 — 전 차트 레전드 통일. */
            labels: {
              /* 범례에 '구간 + 비율(%)' 을 함께 — 한눈에 분포가 읽힌다 */
              generateLabels: function (chart) {
                return chart.data.labels.map(function (lab, i) {
                  return {
                    text: lab + '  ' + Math.round(pcts[i]) + '%',
                    fillStyle: colors[i], strokeStyle: '#FFFFFF', lineWidth: 1,
                    index: i
                  };
                });
              }
            }
          },
          tooltip: {
            callbacks: {
              /* '기타' 조각은 합쳐진 구간 목록을 여러 줄로 펼쳐 보여 준다 */
              label: function (it) {
                var i = it.dataIndex;
                var head = ' ' + mins[i].toFixed(1) + ' min · ' +
                  pcts[i].toFixed(1) + '%';
                if (bins[i] && bins[i].isOther && otherDetail) {
                  return [head, i18nT(' ─ 합쳐진 구간 ─')].concat(
                    otherDetail.map(function (d) { return '  ' + d; }));
                }
                return head;
              }
            }
          }
        }
      },
      plugins: [pieShadow, sliceLabels]
    });
    return inst.hist;
  }

  /* ---------- 심박 추이 시계열 (HR 존 배경 띠 + 커서 sync) ----------
     속도 차트와 같은 시간축. opts.zones 가 있으면 심박 존 색을
     수평 배경 띠로 깔아, 곡선이 어느 존을 지나는지 한눈에 보이게 한다.
     모든 HR 포인트를 사용한다 — 다운샘플 없음. */
  function renderHrChart(elId, session, opts) {
    opts = opts || {};
    if (inst.hr) { inst.hr.destroy(); inst.hr = null; }
    var el = document.getElementById(elId);
    if (!el || typeof Chart === 'undefined') return null;
    var S = session.samples;
    inst.session = session;
    inst.fmtX = opts.fmtX || inst.fmtX || null;

    // leg 단위 데이터 — leg 사이는 NaN 으로 끊고, leg 안의 결측 HR
    // 포인트는 건너뛰어 선을 잇는다(짧은 센서 드롭아웃 자연 보간).
    var data = [];
    var legs = session.legs && session.legs.length
      ? session.legs : [{ start: 0, end: S.length - 1 }];
    legs.forEach(function (leg, li) {
      if (li > 0) data.push({ x: (S[leg.start].t + S[legs[li - 1].end].t) / 2, y: NaN });
      for (var i = leg.start; i <= leg.end; i++) {
        if (S[i].hr == null) continue;
        data.push({ x: S[i].t, y: S[i].hr });
      }
    });

    /* 속도 overlay (Danny 2026-05-27 §173) — HR 차트에 우측 y축으로 속도
       곡선을 겹쳐 그린다. opts.speedData 가 있을 때만 그리고, 우측 축은
       속도 단위(kt/km/h)로 라벨링한다. 클릭 시 onSeek(t) 콜백으로 지도
       해당 시점으로 점프시킨다. HR 곡선이 시각적으로 dominant 하도록
       속도 곡선은 borderWidth/투명도를 낮춰 배경 역할로 둔다. */
    var speedData = null;
    if (opts.includeSpeed !== false) {
      speedData = [];
      var spdConv = opts.toSpeed || function (ms) { return ms; };
      legs.forEach(function (leg, li) {
        if (li > 0) speedData.push({ x: (S[leg.start].t + S[legs[li - 1].end].t) / 2, y: NaN });
        for (var i2 = leg.start; i2 <= leg.end; i2++) {
          speedData.push({ x: S[i2].t, y: +spdConv(S[i2].speed).toFixed(2) });
        }
      });
    }
    var speedUnit = opts.speedUnitLabel || 'kt';

    var zoneData = opts.zones || null;
    /* HR 존 배경 띠 — 곡선 뒤에 수평 색 띠. */
    var zonePlugin = {
      id: 'hrZoneBands',
      beforeDatasetsDraw: function (c) {
        if (!zoneData || !zoneData.zones || !zoneData.zones.length) return;
        var ys = c.scales.y, ctx = c.ctx;
        var x1 = c.chartArea.left, x2 = c.chartArea.right;
        ctx.save();
        function band(loBpm, hiBpm, color) {
          var yLo = ys.getPixelForValue(loBpm), yHi = ys.getPixelForValue(hiBpm);
          var top = Math.max(Math.min(yLo, yHi), ys.top);
          var bot = Math.min(Math.max(yLo, yHi), ys.bottom);
          if (bot <= top) return;
          /* §432 v2 — 존 배경 띠 alpha 0.10→0.16 (형광 톤 존 신호 가시성↑). */
          ctx.fillStyle = hexA(color, 0.16);
          ctx.fillRect(x1, top, x2 - x1, bot - top);
        }
        band(0, zoneData.zones[0].loBpm, HR_ZONE_REST);
        zoneData.zones.forEach(function (z) {
          band(z.loBpm, z.hiBpm, HR_ZONE_COLOR[z.key] || HR_ZONE_REST);
        });
        // 존 이름 라벨 (우측 가장자리)
        ctx.font = cvFont(600, 10);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        zoneData.zones.forEach(function (z) {
          var ym = ys.getPixelForValue((z.loBpm + z.hiBpm) / 2);
          if (ym < ys.top + 7 || ym > ys.bottom - 7) return;
          ctx.fillStyle = hexA(HR_ZONE_COLOR[z.key] || HR_ZONE_REST, 0.92);
          ctx.fillText(z.name, x2 - 5, ym);
        });
        ctx.restore();
      }
    };

    /* 기록 공백 음영 (Danny 2026-05-23 §D) — leg 사이의 시간 공백을
       옅은 띠로 표시한다. leg 는 GPS 장치가 8초 넘게 기록을 멈췄거나
       (raw GPX 시간 공백) 트랙 편집에서 제외한 구간에서 갈린다. 추이
       그래프 중간의 빈 곳이 렌더 버그가 아니라 '그 시간엔 데이터가
       없음' 임을 분명히 한다. '심박 기록률' 은 기록된 포인트 중 심박
       포함 비율이라, 이런 시간 공백이 있어도 100% 일 수 있다 — 둘은
       서로 다른 것을 재므로 모순이 아니다. */
    var gapPlugin = {
      id: 'hrGaps',
      beforeDatasetsDraw: function (c) {
        if (legs.length < 2) return;
        var xs = c.scales.x, ctx = c.ctx;
        var top = c.chartArea.top, bot = c.chartArea.bottom;
        ctx.save();
        for (var gi = 1; gi < legs.length; gi++) {
          var x1 = xs.getPixelForValue(S[legs[gi - 1].end].t);
          var x2 = xs.getPixelForValue(S[legs[gi].start].t);
          if (!(x2 > x1)) continue;
          ctx.fillStyle = 'rgba(92,111,126,0.13)';
          ctx.fillRect(x1, top, x2 - x1, bot - top);
          var xm = (x1 + x2) / 2;
          /* 폭이 보일 만한 공백엔 가운데 점선 — 작은 공백은 띠만 */
          if (x2 - x1 >= 3) {
            ctx.strokeStyle = 'rgba(92,111,126,0.5)';
            ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
            ctx.beginPath(); ctx.moveTo(xm, top); ctx.lineTo(xm, bot); ctx.stroke();
            ctx.setLineDash([]);
          }
          /* 라벨이 들어갈 만큼 넓은 공백에만 '기록 공백' 표기 */
          if (x2 - x1 >= 46) {
            ctx.fillStyle = 'rgba(92,111,126,0.92)';
            ctx.font = cvFont(600, 10);
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(i18nT('기록 공백'), xm, top + 4);
          }
        }
        ctx.restore();
      }
    };

    /* 데이터셋 구성 — HR(좌축 y) + (옵션) 속도(우축 y1).
       HR 가 분석 주체이므로 stroke 가 강조되고, 속도는 배경 컨텍스트로
       더 얇고 옅게 그린다. */
    /* Layer 1.5 — HR 트렌드 fill 그라데이션 (Danny 2026-05-26).
       HR 라인은 strong stroke 유지, area 만 fill 그라데이션. */
    function hrFillGradient(ctx) {
      var chart = ctx.chart, area = chart && chart.chartArea;
      if (!area) return 'rgba(192,57,43,0.10)';
      var g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0,   'rgba(192,57,43,0.28)');
      g.addColorStop(0.5, 'rgba(192,57,43,0.12)');
      g.addColorStop(1,   'rgba(192,57,43,0.00)');
      return g;
    }
    function speedFillGradient2(ctx) {
      var chart = ctx.chart, area = chart && chart.chartArea;
      if (!area) return hexA(THEME.line, 0.08);
      var g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0,   'rgba(31,143,255,0.22)');
      g.addColorStop(1,   'rgba(31,143,255,0.00)');
      return g;
    }
    var datasets = [{
      label: i18nT('심박수 (bpm)'), data: data, spanGaps: false,
      borderColor: HR_LINE, borderWidth: 2.0,
      fill: true, backgroundColor: hrFillGradient,
      pointRadius: 0, tension: 0.3,
      yAxisID: 'y', order: 1
    }];
    if (speedData) {
      datasets.push({
        label: i18nT('속도 ({u})', {u: speedUnit}),
        data: speedData, spanGaps: false,
        borderColor: hexA(THEME.line, 0.85),
        backgroundColor: speedFillGradient2,
        borderWidth: 1.3, fill: true,
        pointRadius: 0, tension: 0.3,
        yAxisID: 'y1', order: 2
      });
    }

    inst.hr = new Chart(el.getContext('2d'), {
      type: 'line',
      data: { datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        parsing: false, normalized: true, animation: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            /* bounds:'data' — 속도 시계열과 같은 시간축. 트림 후 두 차트가
               같은 [0, 남은구간] 범위를 정확히 공유해 crosshair 가 어긋나지
               않도록(속도 차트 X축 주석 참고). */
            bounds: 'data',
            title: { display: true, text: opts.xTitle || i18nT('경과 시간') },
            ticks: {
              callback: function (v) { return inst.fmtX ? inst.fmtX(v) : mmss(v); },
              maxTicksLimit: 8
            },
            grid: { color: THEME.grid }
          },
          y: {
            position: 'left',
            title: { display: true, text: i18nT('심박수 (bpm)') },
            suggestedMin: opts.yMin, suggestedMax: opts.yMax,
            grid: { color: THEME.grid }
          },
          y1: speedData ? {
            position: 'right',
            title: { display: true, text: i18nT('속도 ({u})', {u: speedUnit}) },
            beginAtZero: true,
            /* 좌·우축 grid 가 겹쳐 보이지 않도록 우축 grid 는 끈다 */
            grid: { drawOnChartArea: false }
          } : undefined
        },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        onResize: function () { sizeCrosshair(); },
        onHover: function (ev) {
          /* 속도 overlay 가 있고 onSeek 콜백이 있으면 클릭 가능 — 포인터 변경 */
          if (opts.onSeek) el.style.cursor = 'pointer';
          if (ev.x == null || !opts.onHover) return;
          var t = inst.hr.scales.x.getValueForPixel(ev.x);
          var off = (session.editApplied && session.editApplied.trimStart) || 0;
          opts.onHover(t + off, 'hrchart');
        },
        /* 클릭 → 지도가 그 시점으로 이동 (Danny 2026-05-27 §173). */
        onClick: function (ev) {
          if (!opts.onSeek || ev.x == null) return;
          var t = inst.hr.scales.x.getValueForPixel(ev.x);
          var off = (session.editApplied && session.editApplied.trimStart) || 0;
          opts.onSeek(t + off);
        }
      },
      plugins: [zonePlugin, gapPlugin]
    });

    inst.hrCrosshair = makeCrosshairOverlay(el);
    sizeOverlay(inst.hrCrosshair, inst.hr);
    if (opts.onHover) {
      el.addEventListener('mouseleave', function () { opts.onHover(null, 'hrchart'); });
    }
    return inst.hr;
  }

  /* ---------- 심박 존 분포 (가로 막대) ----------
     휴식(Z1 미만) + Z1~Z5 의 머문 시간(분). 막대 색 = 존 색. */
  function renderHrZoneBars(elId, zoneData, opts) {
    opts = opts || {};
    if (inst.hrZone) { inst.hrZone.destroy(); inst.hrZone = null; }
    var el = document.getElementById(elId);
    if (!el || typeof Chart === 'undefined' ||
        !zoneData || !zoneData.zones || !zoneData.zones.length) return null;

    var rows = [{
      label: i18nT('휴식 (Z1 미만)'), sec: zoneData.belowSec, color: HR_ZONE_REST,
      range: '< ' + zoneData.zones[0].loBpm + ' bpm'
    }];
    zoneData.zones.forEach(function (z) {
      rows.push({
        label: z.name + ' (' + z.key.toUpperCase() + ')',
        sec: z.seconds, color: HR_ZONE_COLOR[z.key] || HR_ZONE_REST,
        range: z.loBpm + '–' + z.hiBpm + ' bpm'
      });
    });
    var tot = zoneData.totalSec || 1;
    inst.hrZone = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: i18nT('머문 시간 (min)'),
          data: rows.map(function (r) { return +(r.sec / 60).toFixed(2); }),
          /* §432 v2 옵션 A — 막대별 세로 형광 그라데이션(상단 밝음). 단일
             scriptable 함수로 (배열-of-함수는 Chart.js 가 호출 안 함). */
          backgroundColor: function (context) {
            var base = (rows[context.dataIndex] || {}).color || HR_ZONE_REST;
            return barVGrad(base)(context);
          },
          borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.82
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: {
            title: { display: true, text: i18nT('머문 시간 (min)') },
            beginAtZero: true, grid: { color: THEME.grid }
          },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (it) {
                var r = rows[it.dataIndex];
                return r.range + ' · ' + i18nT('{n}분 (', {n: it.parsed.x.toFixed(1)}) +
                  Math.round(r.sec / tot * 100) + '%)';
              }
            }
          }
        }
      }
    });
    return inst.hrZone;
  }

  /* ---------- 퍼포먼스 대비 심박 효율 (속도-심박 산점 + 추세) ----------
     산점 = 주행 중 (속도·심박) 순간 기록 전량.
     선 = 속도 구간별 심박 중앙값 추세. 아래로 갈수록(같은 속도에서
     낮은 심박) 유산소 효율이 좋다. */
  function renderHrEff(elId, eff, opts) {
    opts = opts || {};
    if (inst.hrEff) { inst.hrEff.destroy(); inst.hrEff = null; }
    var el = document.getElementById(elId);
    if (!el || typeof Chart === 'undefined' || !eff || !eff.available) return null;
    var toSpd = opts.toSpeed || function (ms) { return ms * KT; };
    var unit = opts.unitLabel || 'kt';

    var scatterPts = eff.scatter.map(function (p) {
      return { x: +toSpd(p.speedMs).toFixed(2), y: p.hr };
    });
    var trendPts = eff.trend.map(function (b) {
      return { x: +toSpd(b.midMs).toFixed(2), y: +b.medianHr.toFixed(1) };
    });

    inst.hrEff = new Chart(el.getContext('2d'), {
      data: {
        datasets: [
          {
            type: 'scatter', label: i18nT('순간 기록 (속도 · 심박)'),
            data: scatterPts, parsing: false,
            backgroundColor: hexA(THEME.sea, 0.22),
            borderColor: 'transparent', pointRadius: 2, pointHoverRadius: 4
          },
          {
            type: 'line', label: i18nT('속도 구간별 심박 중앙값'),
            data: trendPts, parsing: false,
            borderColor: HR_LINE, borderWidth: 2.6,
            pointRadius: 3, pointBackgroundColor: HR_LINE,
            fill: false, tension: 0.2
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: {
            type: 'linear', beginAtZero: true,
            title: { display: true, text: i18nT('속도 ({u})', {u: unit}) },
            grid: { color: THEME.grid }
          },
          y: {
            title: { display: true, text: i18nT('심박수 ({u})', {u: 'bpm'}) },
            grid: { color: THEME.grid }
          }
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (it) {
                return it.parsed.x.toFixed(1) + ' ' + unit + ' · ' +
                  it.parsed.y.toFixed(0) + ' bpm';
              }
            }
          }
        }
      }
    });
    return inst.hrEff;
  }

  /* 심박 차트 인스턴스 정리 — HR 없는 세션으로 교체될 때 호출. */
  function clearHr() {
    ['hr', 'hrZone', 'hrEff'].forEach(function (k) {
      if (inst[k]) { try { inst[k].destroy(); } catch (e) {} inst[k] = null; }
    });
  }

  /* ---------- 통합 폴라 다이어그램 · % of target (custom canvas) ----------
   * 풍각 폴라 + 타깃 폴라를 하나로 합친 단일 폴라 (Danny 검토 2026-05-23
   * §A1). 한 차트에 정확히 3곡선:
   *   · 이번 세션 포트(P) — 파랑 실선 (좌측, '실제 라이딩')
   *   · 이번 세션 스타보드(S) — 주황 실선 (우측, '실제 라이딩')
   *   · 개인 베스트 타깃 — 옅은 회색 점선 1줄 (좌우 대칭, '기준선')
   * 실선 = 실제 / 점선 = 기준 으로 위계를 준다. 4곡선은 금지(엉킴).
   * 세 곡선 모두 같은 반경 지표(풍각별 속도)라 한 좌표계에서 호환된다 —
   * 세션 곡선은 풍각 빈별 95퍼센타일 속도(computePolar), 타깃 곡선은
   * 누적 세션의 풍각별 개인 베스트(buildTargetPolar) 로, 단위가 같다.
   * 호버: 곡선/점에 커서를 올리면 그 곡선만 밝게 강조 + 툴팁(이름·값).
   *
   * data = { polar, target, comparison }
   *   polar  : An.computePolar() 반환 — { port, starboard, combined }
   *   target : An.buildTargetPolar() 반환 — { bins:[{twaCenter,speedMs,…}] }
   * ============================================================ */
  function renderTargetPolar(elId, data, opts) {
    opts = opts || {};
    var el = document.getElementById(elId);
    if (!el || !data) return;
    var polar = data.polar || null;
    var target = data.target || null;
    var kmh = opts.unit === 'kmh';
    var conv = kmh ? 3.6 : KT;
    var unit = kmh ? 'km/h' : 'kt';

    var dpr = global.devicePixelRatio || 1;
    var size = Math.min(el.clientWidth || 340, 380);
    el.width = size * dpr; el.height = size * dpr;
    el.style.height = size + 'px';
    var ctx = el.getContext('2d');

    var cx = size / 2, cy = size / 2 + 6;
    var R = size / 2 - 40;

    /* 최대 속도(표시단위) — 세 곡선 전체에서 */
    var maxV = 1;
    if (target && target.bins) {
      target.bins.forEach(function (bn) {
        if (bn.speedMs != null && bn.speedMs * conv > maxV) maxV = bn.speedMs * conv;
      });
    }
    if (polar) {
      polar.port.concat(polar.starboard).forEach(function (bn) {
        if (bn.count >= 2 && bn.p95Ms * conv > maxV) maxV = bn.p95Ms * conv;
      });
    }
    var ringStep = maxV > 30 ? 10 : (maxV > 14 ? 5 : 2);
    var ringMax = Math.ceil(maxV / ringStep) * ringStep;

    function pt(twa, vMs, sign) {
      var rr = R * Math.min(1, vMs * conv / ringMax);
      var ang = -Math.PI / 2 + sign * twa * Math.PI / 180;
      return { x: cx + rr * Math.cos(ang), y: cy + rr * Math.sin(ang) };
    }

    /* --- 3곡선 데이터 구성 (그리기 + 히트테스트 공용) --- */
    function sideLine(bins, sign, valOf, okOf) {
      var pts = [];
      bins.forEach(function (bn) {
        if (!okOf(bn)) return;
        var v = valOf(bn);
        if (v == null) return;
        var p = pt(bn.twaCenter, v, sign);
        pts.push({ x: p.x, y: p.y, twa: bn.twaCenter, vMs: v });
      });
      return pts;
    }
    var curves = [];
    /* 타깃 — 좌우 대칭 한 곡선(점선·기준선). 맨 뒤에 그린다. */
    if (target && target.bins) {
      var tRight = sideLine(target.bins, 1, function (b) { return b.speedMs; },
        function (b) { return b.speedMs != null; });
      var tLeft = sideLine(target.bins, -1, function (b) { return b.speedMs; },
        function (b) { return b.speedMs != null; });
      if (tRight.length >= 2 || tLeft.length >= 2) {
        curves.push({ key: 'target', label: i18nT('개인 베스트 타깃'),
          color: THEME.text, dashed: true, fill: false,
          lines: [tLeft, tRight], hitPts: tLeft.concat(tRight) });
      }
    }
    /* 이번 세션 — 포트(좌·파랑 실선) · 스타보드(우·주황 실선) */
    if (polar) {
      var pLine = sideLine(polar.port, -1, function (b) { return b.p95Ms; },
        function (b) { return b.count >= 2; });
      var sLine = sideLine(polar.starboard, 1, function (b) { return b.p95Ms; },
        function (b) { return b.count >= 2; });
      /* 좌우 비교 차트 — 색 = 좌우 (디자인 시스템 §2). 포트=홍·스타보드=녹 */
      if (pLine.length >= 2) {
        curves.push({ key: 'port', label: i18nT('이번 세션 · 포트(P)'),
          color: SIDE.port, dashed: false, fill: true,
          lines: [pLine], hitPts: pLine });
      }
      if (sLine.length >= 2) {
        curves.push({ key: 'starboard', label: i18nT('이번 세션 · 스타보드(S)'),
          color: SIDE.starboard, dashed: false, fill: true,
          lines: [sLine], hitPts: sLine });
      }
    }

    /* --- 한 곡선 그리기 (emphasis: 'hi' | 'dim' | 'normal') --- */
    function strokeCurve(c, emphasis) {
      var a = emphasis === 'dim' ? 0.18 : 1;
      var lw = emphasis === 'hi' ? 3.2 : (c.dashed ? 1.6 : 2.2);
      // 채움 — 실제 라이딩(세션) 곡선만, 옅게
      if (c.fill && emphasis !== 'dim') {
        c.lines.forEach(function (line) {
          if (line.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          line.forEach(function (p) { ctx.lineTo(p.x, p.y); });
          ctx.closePath();
          ctx.fillStyle = hexA(c.color, emphasis === 'hi' ? 0.16 : 0.10);
          ctx.fill();
        });
      }
      c.lines.forEach(function (line) {
        if (line.length < 2) return;
        ctx.beginPath();
        line.forEach(function (p, i) {
          if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        });
        ctx.strokeStyle = hexA(c.color, a);
        ctx.lineWidth = lw;
        ctx.setLineDash(c.dashed ? [4, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      c.lines.forEach(function (line) {
        line.forEach(function (p) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, emphasis === 'hi' ? 3.1 : 2.4, 0, Math.PI * 2);
          ctx.fillStyle = hexA(c.color, a);
          ctx.fill();
        });
      });
    }

    /* --- 전체 그리기 — hoverKey 면 그 곡선만 강조, 나머지는 흐리게 --- */
    function draw(hoverKey, hoverPt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // 배경 링 + 라벨
      ctx.font = cvFont(null, 10);
      ctx.textBaseline = 'alphabetic';
      for (var v = ringStep; v <= ringMax; v += ringStep) {
        var rr = R * v / ringMax;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(10,37,64,0.10)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(92,111,126,0.75)';
        ctx.textAlign = 'left';
        ctx.fillText(v + '', cx + 3, cy - rr + 11);
      }
      // 방사선 + 둘레 TWA 라벨
      [30, 60, 90, 120, 150].forEach(function (twa) {
        [-1, 1].forEach(function (sgn) {
          var ang = -Math.PI / 2 + sgn * twa * Math.PI / 180;
          ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
          ctx.strokeStyle = 'rgba(10,37,64,0.07)'; ctx.lineWidth = 1; ctx.stroke();
        });
      });
      ctx.fillStyle = 'rgba(92,111,126,0.9)';
      ctx.font = cvFont(600, 10);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [30, 60, 90, 120, 150].forEach(function (twa) {
        [-1, 1].forEach(function (sgn) {
          var ang = -Math.PI / 2 + sgn * twa * Math.PI / 180;
          ctx.fillText(twa + '°',
            cx + (R + 13) * Math.cos(ang), cy + (R + 13) * Math.sin(ang));
        });
      });
      ctx.textBaseline = 'alphabetic';

      // 곡선 — 호버 아님: 타깃(뒤)→포트→스타보드. 호버 시: 나머지 흐리게
      // 먼저, 호버 곡선은 맨 위에 또렷하게.
      var hi = null;
      curves.forEach(function (c) {
        if (hoverKey && c.key === hoverKey) { hi = c; return; }
        strokeCurve(c, hoverKey ? 'dim' : 'normal');
      });
      if (hi) strokeCurve(hi, 'hi');

      // 풍상/풍하 라벨
      ctx.fillStyle = THEME.textHi;
      ctx.font = cvFont(600, 11);
      ctx.textAlign = 'center';
      ctx.fillText(i18nT('▲ 풍상 0°'), cx, cy - R - 12);
      ctx.fillText(i18nT('▼ 풍하 180°'), cx, cy + R + 18);
      // 범례
      ctx.font = cvFont(600, 10);
      ctx.textAlign = 'left';
      ctx.fillStyle = SIDE.port; ctx.fillText(i18nT('━ 포트(P) 실측'), 8, 15);
      ctx.textAlign = 'right';
      ctx.fillStyle = SIDE.starboard; ctx.fillText(i18nT('스타보드(S) 실측 ━'), size - 8, 15);
      ctx.textAlign = 'left';
      ctx.fillStyle = THEME.text;
      ctx.fillText(i18nT('┈ 개인 베스트 타깃(기준)'), 8, size - 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(92,111,126,0.7)';
      ctx.font = cvFont(null, 10);
      ctx.fillText(i18nT('반지름 = 속도 ({u})', {u: unit}), size - 8, size - 8);

      // 호버 툴팁
      if (hoverPt && hi) drawPolarTip(hi, hoverPt);
    }

    /* --- 호버 툴팁 — 곡선 이름 · 풍각 · 속도 --- */
    function drawPolarTip(c, hp) {
      var txt = c.label + '  ·  CWA ' + Math.round(hp.twa) + '°  ·  ' +
        (hp.vMs * conv).toFixed(1) + ' ' + unit;
      ctx.font = cvFont(600, 11);
      var tw = ctx.measureText(txt).width + 14;
      var th = 20;
      var lx = Math.min(Math.max(hp.x - tw / 2, 4), size - tw - 4);
      var ly = hp.y - th - 8;
      if (ly < 2) ly = hp.y + 10;
      // 강조 점
      ctx.beginPath(); ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.strokeStyle = c.color; ctx.lineWidth = 2.2; ctx.stroke();
      // 박스
      ctx.fillStyle = THEME.panel;
      roundRect(ctx, lx, ly, tw, th, 5); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, lx + 7, ly + th / 2);
      ctx.textBaseline = 'alphabetic';
    }

    draw(null, null);

    /* --- 호버 인터랙션 — 가장 가까운 곡선 점을 찾아 강조 + 툴팁 ---
       renderTargetPolar 는 대시보드 재렌더마다 호출되므로, 최신 곡선·
       draw 클로저를 inst.tpState 에 갱신해 두고 리스너는 한 번만 건다. */
    inst.tpState = { el: el, curves: curves, draw: draw };
    if (!el._rdPolarHoverBound) {
      el._rdPolarHoverBound = true;
      el.addEventListener('mousemove', function (ev) {
        var st = inst.tpState;
        if (!st || st.el !== el) return;
        var rect = el.getBoundingClientRect();
        var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
        var best = null, bestD = 16 * 16, bestKey = null;
        st.curves.forEach(function (c) {
          c.hitPts.forEach(function (p) {
            var dx = p.x - mx, dy = p.y - my, d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = p; bestKey = c.key; }
          });
        });
        el.style.cursor = best ? 'pointer' : 'default';
        st.draw(bestKey, best);
      });
      el.addEventListener('mouseleave', function () {
        var st = inst.tpState;
        if (st && st.el === el) st.draw(null, null);
      });
    }
  }

  /* ---------- 시즌 progression(세션 비교) 차트 ----------
   * 3분리 그래프를 한 그래프로 통합한다 (Danny 2026-05-23 §C —
   * 직전 배치의 3분리를 되돌리는 수정):
   *   · opts.metrics    — 표시할 지표 배열(중복 선택 가능):
   *                       avgSpeed · maxSpeed · distance · time
   *   · opts.chartType  — 'line'(선) 또는 'bar'(막대)
   * 단위가 다른 지표는 각자 Y축(속도=좌, 거리·시간=우)에 매핑한다.
   * 단일 캔버스라 Chart 인스턴스는 inst.prog 하나만 쓴다. */
  function renderProgression(elId, sessions, opts) {
    opts = opts || {};
    if (inst.prog) { inst.prog.destroy(); inst.prog = null; }
    var el = document.getElementById(elId);
    if (!el || typeof Chart === 'undefined' || !sessions.length) return null;
    var metrics = (opts.metrics && opts.metrics.length) ? opts.metrics : [];
    if (!metrics.length) return null;          // 선택 지표 0 — 호출부가 안내
    var chartType = (opts.chartType === 'bar') ? 'bar' : 'line';

    var kmh = opts.unit === 'kmh';
    var spdConv = kmh ? 3.6 : KT;
    var spdUnit = kmh ? 'km/h' : 'kt';
    var labels = sessions.map(function (s) { return shortDate(s.dateEpoch); });

    /* 지표 정의 — 축 그룹·색·라벨·세션값 추출기. 축: speed(좌)·
       dist(우)·time(우). 같은 축의 지표는 눈금을 공유한다. */
    var AXIS = {
      speed: { unit: spdUnit, title: i18nT('속도 ({u})', {u: spdUnit}) },
      dist:  { unit: 'km',    title: i18nT('거리 (km)') },
      time:  { unit: 'min',   title: i18nT('라이딩 시간 (min)') },
      hr:    { unit: 'bpm/min', title: i18nT('심박 회복 지수 (bpm/min)') }
    };
    /* 4지표(+심박 회복)는 좋·나쁨 의미가 없는 단순 구분이므로 중립
       범주색만 쓴다 — 빨강·초록을 쓰면 사용자가 막대를 '나쁘다/좋다'로
       오독한다 (디자인 시스템 §3 범주색 · §(d) 필수 수정). */
    var METRIC = {
      avgSpeed: { axis: 'speed', color: CAT[0],  label: i18nT('평균 속도'),
        val: function (s) { return +((s.avgSpeedMovingMs || 0) * spdConv).toFixed(1); } },
      maxSpeed: { axis: 'speed', color: CAT[1],  label: i18nT('최고 속도'),
        val: function (s) { return +((s.maxSpeedMs || 0) * spdConv).toFixed(1); } },
      distance: { axis: 'dist',  color: CAT[2], label: i18nT('거리'),
        val: function (s) { return +(((s.distanceM || 0) / 1000)).toFixed(2); } },
      time:     { axis: 'time',  color: CAT[3],  label: i18nT('라이딩 시간'),
        val: function (s) { return +(((s.movingTimeSec || 0) / 60)).toFixed(1); } },
      /* 스킬-심박수 회복 지수 — 회전 후 심박 회복 속도(bpm/분). HR 미기록·
         회복 표본 부족 세션은 null 이라 선 그래프에서 공백으로 처리된다. */
      hrRecovery: { axis: 'hr', color: CAT[4], label: i18nT('심박 회복 지수'),
        val: function (s) {
          return (s.hrRecoveryIndex != null) ? +(+s.hrRecoveryIndex).toFixed(1) : null;
        } }
    };

    var usedAxes = {};
    var datasets = metrics.filter(function (m) { return METRIC[m]; })
      .map(function (m) {
        var def = METRIC[m];
        usedAxes[def.axis] = true;
        return {
          type: chartType,
          label: def.label + ' (' + AXIS[def.axis].unit + ')',
          data: sessions.map(def.val),
          yAxisID: def.axis,
          borderColor: def.color,
          backgroundColor: (chartType === 'bar')
            ? hexA(def.color, 0.55) : hexA(def.color, 0.12),
          borderWidth: 2, tension: 0.3, fill: false,
          pointRadius: (chartType === 'bar') ? 0 : 3,
          pointBackgroundColor: def.color
        };
      });
    if (!datasets.length) return null;

    /* 쓰는 축만 생성 — speed 는 좌측, dist·time·hr 은 우측. 격자선은
       첫 축 하나만 그려 우측 다축이 겹쳐 보이지 않게 한다. */
    var scales = { x: { grid: { color: THEME.grid } } };
    ['speed', 'dist', 'time', 'hr'].filter(function (ax) { return usedAxes[ax]; })
      .forEach(function (ax, i) {
        scales[ax] = {
          type: 'linear', position: (ax === 'speed') ? 'left' : 'right',
          beginAtZero: true,
          title: { display: true, text: AXIS[ax].title },
          grid: { drawOnChartArea: (i === 0), color: THEME.grid }
        };
      });

    inst.prog = new Chart(el.getContext('2d'), {
      type: chartType,
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: scales,
        plugins: { legend: { position: 'bottom' } }
      }
    });
    return inst.prog;
  }

  /* ---------- 헬퍼 ---------- */
  function hexA(hex, a) {
    if (hex[0] === '#') {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    return hex;
  }
  /* §432 v2 — hex 를 흰색 쪽으로 pct(0~1) 밝게 (막대 형광 그라데이션 상단 스톱). */
  function lightenHex(hex, pct) {
    if (hex[0] !== '#' || hex.length !== 7) return hex;
    var n = parseInt(hex.slice(1), 16);
    function ch(x) { return Math.round(x + (255 - x) * pct); }
    var r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  /* §432 v2 옵션 A — 가로 막대에 세로(상단 밝고 하단 base) 그라데이션을 입혀
     형광 3D 음영을 준다. Chart.js scriptable backgroundColor 로, 각 막대 자신의
     픽셀 y-범위에 그라데이션을 건다. 레이아웃 전(geometry 미정)엔 solid 폴백. */
  function barVGrad(baseColor) {
    return function (context) {
      var ch = context.chart, area = ch.chartArea;
      if (!area) return baseColor;
      var meta = ch.getDatasetMeta(context.datasetIndex);
      var el = meta && meta.data && meta.data[context.dataIndex];
      if (!el) return baseColor;
      var h = el.height || (el.width) || 0;      /* 가로막대 두께 */
      var top = el.y - h / 2, bot = el.y + h / 2;
      if (!(bot > top)) return baseColor;
      var g = ch.ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, lightenHex(baseColor, 0.34));
      g.addColorStop(1, baseColor);
      return g;
    };
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function shortDate(ep) {
    var d = new Date(ep);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function destroyAll() {
    if (inst.map) { try { inst.map.remove(); } catch (e) {} inst.map = null; }
    ['speed', 'hist', 'prog',
     'detail', 'detailP', 'detailS',
     'hr', 'hrZone', 'hrEff'].forEach(function (k) {
      if (inst[k]) { try { inst[k].destroy(); } catch (e) {} inst[k] = null; }
    });
    inst.mvMarkers = [];
    inst.runHl = null;          // 지도 제거 시 강조 레이어 참조도 해제
  }

  global.RDCharts = {
    renderMap: renderMap,
    highlightMapManeuver: highlightMapManeuver,
    highlightMapRun: highlightMapRun,
    renderSpeedChart: renderSpeedChart,
    renderManeuverDetail: renderManeuverDetail,
    renderViolin: renderViolin,
    renderTargetPolar: renderTargetPolar,
    renderHistogram: renderHistogram,
    renderHrChart: renderHrChart,
    renderHrZoneBars: renderHrZoneBars,
    renderHrEff: renderHrEff,
    clearHr: clearHr,
    renderProgression: renderProgression,
    setChartCursorByTime: setChartCursorByTime,
    setMapCursorLatLng: setMapCursorLatLng,
    panMapToLatLng: panMapToLatLng,
    hideCursor: hideCursor,
    sizeCrosshair: sizeCrosshair,
    speedColor: speedColor,
    speedTierColor: speedTierColor,   /* §432 v2 — 절대속도→5-tier 신호등 */
    mapSpeedColor: mapSpeedColor,
    destroyAll: destroyAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
