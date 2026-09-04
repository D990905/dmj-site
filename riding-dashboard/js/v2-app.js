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
  /* §498 — analyzeSession 에 넘길 공통 옵션.
     ⚠ 이걸 만든 이유: v2 는 그동안 analyzeSession 에 **풍속을 한 번도
     넘기지 않았다.** 네 군데 호출부가 전부 windConfidence 만 넘겼다.
     그 결과 §494 로 넣은 AWS 와 AWA 가 계산 자체가 안 돼서(analysis.js
     의 hasTws 가 항상 false) 통계표에 한 줄도 뜬 적이 없다.
     §482(포일을 바꿔도 예측이 안 변하던 것)와 같은 종류의 결함이다 —
     기능은 다 만들어져 있었고 입력만 끊겨 있었다.
     새 호출부를 만들 때도 이 헬퍼를 쓸 것. */
  function analysisOpts(est, extra) {
    var o = extra ? JSON.parse(JSON.stringify(extra)) : {};
    if (est && est.confidence != null) o.windConfidence = est.confidence;
    var ws = windSpeedFromForm();
    if (ws != null) o.windSpeedKt = ws;
    return o;
  }
  /* §491 (옥대표 "노안이라서 잘 안보임") — 라이트 테마.
     ────────────────────────────────────────────────────────────
     차트 색은 CSS 가 아니라 JS 가 캔버스에 직접 칠하므로, 테마를 바꾸면
     THEME 도 같이 바뀌어야 한다. 다크의 흐린 회색(dim #8a97a8)을 흰
     배경에 그대로 쓰면 거의 안 보인다 — 라이트에서는 축·격자·라벨을
     전부 진하게 간다. 대비를 올리는 게 이 작업의 목적이다.
     의미색(포트 적 · 스타보드 녹)은 국제 관례라 유지하되, 흰 배경에서
     대비가 모자란 톤은 한 단계 어둡게 쓴다. */
  /* §500 (옥대표 "흐린 배경에 글자가 너무 어두운것 같아 / 색은 바꾸지말고
     밝게") — 다크에서 흐린 글자만 대비가 절반이었다: .lab·축라벨이
     5.78:1 / 4.94:1 인데 본문은 11.86:1. 노안에 이게 그대로 걸린다.
     **색상(hue)과 채도는 소수점까지 그대로 두고 명도만 올렸다** —
     dim #8a97a8 = HSL(214°, 14.7%, 60%) → axisText HSL(214°, 14.7%, 78%)
     = #bfc6cf, 대비 8.51:1 (WCAG AAA). 본문 11.86:1 보다는 낮게 남겨
     '보조 정보' 라는 위계는 유지한다.

     dim 과 axisText 를 **나눈 이유**: dim 은 글자만 쓰는 게 아니라
     지도의 흐린 배경 트랙·안 고른 회전 점에도 쓰인다. 글자를 밝히자고
     그 표식까지 밝히면 '고른 것 vs 안 고른 것' 대비가 무너진다.
     → 글자·축라벨은 axisText, 표식은 dim 그대로. */
  var THEME_DARK = { accent: '#4dabf7', warn: '#f59f00', grid: '#2b3648',
                     dim: '#8a97a8', axisText: '#bfc6cf', bg: '#1a2234',
                     port: '#e03131', stbd: '#2f9e44', gybe: '#f76707',
                     ink: '#e6edf5' };
  var THEME_LIGHT = { accent: '#0d6efd', warn: '#b45309', grid: '#d3d9e2',
                      dim: '#465063', axisText: '#465063', bg: '#ffffff',
                      port: '#c92a2a', stbd: '#1e7e34', gybe: '#c2410c',
                      ink: '#111827' };
  function currentThemeName() {
    try {
      var t = localStorage.getItem('rd_theme');
      if (t === 'light' || t === 'dark') return t;
    } catch (e) {}
    return document.documentElement.getAttribute('data-bs-theme') === 'light'
      ? 'light' : 'dark';
  }
  var THEME = currentThemeName() === 'light'
    ? Object.assign({}, THEME_LIGHT) : Object.assign({}, THEME_DARK);

  function applyTheme(name) {
    document.documentElement.setAttribute('data-bs-theme', name);
    try { localStorage.setItem('rd_theme', name); } catch (e) {}
    var src = (name === 'light') ? THEME_LIGHT : THEME_DARK;
    /* THEME 은 여러 곳이 참조를 들고 있으므로 **객체를 갈아끼우지 않고**
       속성만 덮어쓴다 — 새 객체를 만들면 옛 참조가 옛 색을 계속 쓴다. */
    Object.keys(src).forEach(function (k) { THEME[k] = src[k]; });
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = (name === 'light') ? 'Dark' : 'Light';
    /* 차트는 만들 때 색을 캔버스에 구워 넣는다 — 전부 다시 그린다 */
    if (CUR && CUR.fullSession) { try { reapplyEdits(); } catch (e) {} }
  }

  (function bindTheme() {
    function wire() {
      var btn = document.getElementById('theme-toggle');
      if (!btn) return;
      btn.textContent = (currentThemeName() === 'light') ? 'Dark' : 'Light';
      btn.addEventListener('click', function () {
        applyTheme(currentThemeName() === 'light' ? 'dark' : 'light');
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wire, { once: true });
    } else { wire(); }
  })();

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
  /* §519 (옥대표 "구간을 지웠는데 적용이 안 되는 것 같다") — 실제로는
     적용된다. 실측(데모 세션, 정지 16구간 1:11:03 제외):
       점 2950→2291 · 거리 18.44→16.99km · 평균 11.6→12.5kt ·
       포일링 비중 33%→61% · 주행시간 51:36→44:03  ← 전부 움직인다
       Performance score 50→51                      ← 이것만 안 움직인다
     버그가 아니라 **구조**다. 두 항목 다 느린 시간에 둔감하게 설계돼 있다:
       · 회전 점수 = 각 회전의 품질 → 정지 구간을 빼도 같은 회전들이다
       · 속도 점수 = 풍상 VMG **상위 20%** 기준 → 느린 시간을 빼도
         상위 20% 는 거의 그대로다 (백로그 §409 가 이 얘기다)
     문제는 침묵이다. 71분을 지웠는데 큰 숫자가 그대로면 고장으로 읽는다.
     그래서 편집이 걸려 있을 때는 이 점수가 왜 안 움직이는지 적는다. */
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
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return v + ' kt'; }); } },
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
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
  /* §493 (옥대표 "해당구간을 제거하니까 저렇게 나오는데 버그일까?") — 버그였다.
     ────────────────────────────────────────────────────────────
     시간 원점이 두 개 섞여 있었다. 타임라인은 **현재 보고 있는 세션**
     (이미 제외가 적용된 편집본)에서 그려지므로 축의 0:00 은 편집본의
     첫 표본이다. 그런데 여기서는 **원본**의 첫 표본을 기준으로 절대시각을
     만들고 있었다. 이미 앞부분을 잘라낸 상태라면 그 차이만큼(옥대표
     경우 앞에서 17:53 을 잘라 둔 상태) 엉뚱한 구간이 지워진다 —
     드래그한 곳은 그대로 남고 다른 데가 사라진다.

     원본이 아니라 **차트가 그려진 세션의 t0** 를 써야 한다. 제외 목록은
     절대시각으로 보관되고 항상 원본에 적용되므로, 여기만 맞으면
     여러 번 잘라도 계속 맞는다.
     (§486 시간축 압축 이전에도 있던 결함인데, 압축으로 눈에 띄었다) */
  /* 화면 경과초 → **원본 세션의 시각**. 편집본은 시각이 0 부터 다시
     매겨져 있으므로(§493) 표본에 달아 둔 origT 로 되돌린다. */
  function toOriginalTime(sess, elapsed) {
    var S = (sess && sess.samples) || [];
    if (!S.length) return elapsed;
    var target = S[0].t + elapsed;
    var lo = 0, hi = S.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (S[mid].t < target) lo = mid + 1; else hi = mid;
    }
    var p = S[lo];
    /* 표본이 없는 자리는 가장 가까운 표본의 원본 시각 + 남은 차이 */
    var base = (p.origT != null) ? p.origT : p.t;
    return base + (target - p.t);
  }

  function addExclusion(fromElapsed, toElapsed) {
    var base = CUR.session || CUR.fullSession;
    if (!base || !base.samples || !base.samples.length) return;
    CUR.edit = CUR.edit || { excludeRanges: [] };
    CUR.edit.excludeRanges.push({
      from: toOriginalTime(base, fromElapsed),
      to: toOriginalTime(base, toElapsed)
    });
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
    var a = An.analyzeSession(sess, wd, analysisOpts(est));
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
        + 'everything below is recomputed without them: distance, average speed, '
        + 'foiling share, turns, the map and the timeline.'
      : 'Drag across any panel to select a range \u2014 the averages for that '
        + 'stretch appear under the chart, with the option to exclude it.';
    host.appendChild(hint);
    /* §519 — 그런데 **Performance score 는 거의 안 움직인다.** 그걸 말하지
       않으면, 정지 구간을 한참 지운 뒤 큰 숫자가 그대로인 걸 보고
       "적용이 안 됐다" 로 읽는다(옥대표가 실제로 그렇게 읽었다).
       버그가 아니라 구조다 — 두 항목 다 느린 시간에 둔감하게 설계됐다.
       실측: 정지 16구간 1:11:03 을 빼도 50 → 51. */
    if (ranges.length) {
      var caveat = el('div', 'text-secondary mt-1');
      caveat.style.cssText = 'font-size:.8125rem;opacity:.9';
      caveat.textContent = 'The performance score barely moves, and that is '
        + 'expected \u2014 its turn half scores each turn (the same turns either '
        + 'way) and its speed half is anchored on your best 20% upwind VMG, '
        + 'which the slow time was never part of.';
      host.appendChild(caveat);
    }
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
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return fmtClock(v); }); } },
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
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

  /* §505 풍향 확인 — 지도 + 화살표 + 슬라이더 + **최적 풍향 계산**.
     지금까지는 숫자 입력칸 하나뿐이라 218 을 넣든 211 을 넣든 화면에서
     뭐가 달라지는지 안 보였다(§428). 밴티지는 지도에 화살표를 깔아
     눈으로 대조하게 하는데, 우리는 거기에 **계산**을 더한다 —
     포트/스타보드 풍상 각도가 같아지는 풍향을 찾아 제안한다. */
  var windMap = null, windMapRO = null;
  function renderWindConfirm(host, a, est) {
    if (!window.L || !window.RDWindConfirm || !CUR.session) return;
    var S = (CUR.session.samples || []).filter(function (p) {
      return p && isFinite(p.lat) && isFinite(p.lng);
    });
    if (S.length < 50) return;
    var curDir = a.windDir;
    if (curDir == null) return;

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Confirm the wind direction'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    body.appendChild(el('div', 'text-secondary mb-2',
      'Arrows point the way the wind blows. Drag the slider until they line up '
      + 'with how the session felt — upwind legs should sit either side of the arrows.'));

    var mapHost = el('div');
    mapHost.style.cssText = 'height:340px;border-radius:4px;overflow:hidden';
    body.appendChild(mapHost);

    /* 슬라이더 + 현재 값 */
    var ctl = el('div', 'd-flex align-items-center gap-3 mt-3');
    var slider = el('input', 'form-range');
    slider.type = 'range'; slider.min = '0'; slider.max = '359'; slider.step = '1';
    slider.value = String(Math.round(curDir));
    slider.style.flex = '1';
    var readout = el('div', 'kpi__val num');
    readout.style.minWidth = '86px';
    readout.textContent = Math.round(curDir) + '°';
    ctl.appendChild(slider); ctl.appendChild(readout);
    var applyBtn = el('button', 'btn btn-primary', 'Use this direction');
    applyBtn.type = 'button';
    ctl.appendChild(applyBtn);
    body.appendChild(ctl);

    /* 실시간 대칭 판정 */
    var live = el('div', 'mt-2');
    body.appendChild(live);

    /* 최적 풍향 제안 */
    var sw = null;
    try { sw = RDWindConfirm.sweep(S, curDir, { range: 25, step: 1 }); } catch (e) {}
    var vd = sw ? RDWindConfirm.verdict(sw, curDir) : null;

    card.appendChild(body);
    host.appendChild(card);

    /* ---- 지도 ---- */
    if (windMapRO) { try { windMapRO.disconnect(); } catch (e) {} windMapRO = null; }
    if (windMap) { try { windMap.remove(); } catch (e) {} windMap = null; }
    var map = L.map(mapHost, { zoomControl: false, attributionControl: false });
    windMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var step = Math.max(1, Math.floor(S.length / 1200));
    var line = [];
    for (var i = 0; i < S.length; i += step) line.push([S[i].lat, S[i].lng]);
    L.polyline(line, { color: THEME.accent, weight: 2, opacity: 0.9 }).addTo(map);

    var la = S.map(function (p) { return p.lat; });
    var ln = S.map(function (p) { return p.lng; });
    var bounds = [[Math.min.apply(null, la), Math.min.apply(null, ln)],
                  [Math.max.apply(null, la), Math.max.apply(null, ln)]];
    function fit() {
      try { map.fitBounds(bounds, { padding: [30, 30] }); } catch (e) {}
    }
    fit();
    /* ⚠ 이 카드는 환경 탭 안에 있고, 탭은 처음에 **숨어 있다.**
       숨은 상태에서 Leaflet 을 만들면 컨테이너 크기가 0 이라 fitBounds 가
       세계지도로 끝난다. 예전에 쓰던 setTimeout(60ms) 한 방은 그때도
       여전히 숨어 있어서 소용이 없다(§486 에서 겪은 것과 같은 함정인데,
       그때는 탭이 곧 열리는 경우였다).
       → **ResizeObserver 로 실제 크기가 생기는 순간**을 잡는다.
       탭 전환·창 크기 변경·테마 전환 어느 경로든 같은 곳으로 들어온다. */
    var lastW = 0, lastH = 0;
    function refit() {
      var w2 = mapHost.clientWidth, h2 = mapHost.clientHeight;
      if (!w2 || !h2) return;                 /* 아직 숨어 있다 */
      if (w2 === lastW && h2 === lastH) return;
      lastW = w2; lastH = h2;
      try { map.invalidateSize(false); fit(); } catch (e) {}
      buildArrows();                          /* 화살표도 새 경계로 다시 */
    }
    /* 바람 화살표 격자 — 지도 위에 5×5. 풍향이 바뀌면 회전만 시킨다. */
    var arrows = [];
    function buildArrows() {
      arrows.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
      arrows = [];
      var b = map.getBounds();
      var latSpan = b.getNorth() - b.getSouth(), lngSpan = b.getEast() - b.getWest();
      for (var r = 0; r < 5; r++) {
        for (var c = 0; c < 5; c++) {
          var lat = b.getSouth() + latSpan * (r + 0.5) / 5;
          var lng = b.getWest() + lngSpan * (c + 0.5) / 5;
          var icon = L.divIcon({
            className: '', iconSize: [26, 26], iconAnchor: [13, 13],
            html: '<div class="wc-arrow" style="transform:rotate(0deg)">↓</div>'
          });
          arrows.push(L.marker([lat, lng], { icon: icon, interactive: false }).addTo(map));
        }
      }
      spinArrows(parseFloat(slider.value));
    }
    /* 화살표는 '바람이 가는 방향' 을 가리킨다. 풍향(from)이 200° 면
       바람은 20° 쪽으로 분다 → 아래 화살표(↓, 기본 남쪽)를 그만큼 돌린다. */
    function spinArrows(wd) {
      var toward = (wd + 180) % 360;
      arrows.forEach(function (m) {
        var e = m.getElement && m.getElement();
        var d = e && e.querySelector('.wc-arrow');
        if (d) d.style.transform = 'rotate(' + (toward + 180) + 'deg)';
      });
    }
    map.on('moveend zoomend', function () { setTimeout(buildArrows, 30); });

    /* ⚠ 옵저버는 arrows·buildArrows 가 **정의된 뒤에** 붙인다.
       ResizeObserver 콜백이 observe() 직후에 한 번 도는데, 위쪽에 두면
       그때 arrows 가 아직 undefined 라 터진다. */
    if (window.ResizeObserver) {
      windMapRO = new ResizeObserver(function () { refit(); });
      windMapRO.observe(mapHost);
    }
    setTimeout(refit, 60);
    setTimeout(refit, 400);

    /* ---- 실시간 판정 ---- */
    function updateLive(wd) {
      while (live.firstChild) live.removeChild(live.firstChild);
      var r = null;
      try { r = RDWindConfirm.asymmetryAt(S, wd); } catch (e) {}
      if (!r) {
        live.appendChild(el('div', 'text-secondary',
          'Not enough upwind sailing on both tacks at this direction to judge.'));
        return;
      }
      var box = el('div', 'alert ' + (r.absDiff <= 3 ? 'alert-success' : 'alert-info'));
      box.appendChild(el('div', 'fw-bold',
        'Upwind angle  —  port ' + r.port.toFixed(1) + '° · starboard '
        + r.stbd.toFixed(1) + '°  ·  gap ' + r.absDiff.toFixed(1) + '°'));
      box.appendChild(el('div', 'mt-1',
        r.absDiff <= 3
          ? 'The two tacks sit almost evenly either side of this direction.'
          : 'Getting the direction wrong by δ lifts one tack by δ and drops the '
            + 'other by δ, so a ' + r.absDiff.toFixed(1) + '° gap is what a '
            + (r.absDiff / 2).toFixed(1) + '° error would produce.'));
      live.appendChild(box);
    }
    updateLive(curDir);

    /* ---- 최적 제안 ---- */
    if (vd) {
      var sug = el('div', 'alert ' + (vd.notable ? 'alert-warning' : 'alert-secondary') + ' mt-2');
      sug.appendChild(el('div', 'fw-bold',
        'Most symmetric direction: ' + Math.round(vd.bestDir) + '°'
        + (Math.abs(vd.offsetDeg) < 0.5 ? ' — that is what you have'
            : '  (' + (vd.offsetDeg > 0 ? '+' : '') + vd.offsetDeg.toFixed(0)
              + '° from the ' + Math.round(curDir) + '° in use)')));
      sug.appendChild(el('div', 'mt-1',
        'This is the direction that makes your port and starboard upwind angles match. '
        + '⚠ It assumes you sail both tacks equally well — if one tack is '
        + 'genuinely weaker, this will quietly absorb that into the wind. '
        + 'Treat it as a second opinion, not an answer.'));
      if (vd.notable) {
        var useBest = el('button', 'btn btn-sm mt-2',
          'Try ' + Math.round(vd.bestDir) + '°');
        useBest.type = 'button';
        useBest.addEventListener('click', function () {
          slider.value = String(Math.round(vd.bestDir));
          readout.textContent = Math.round(vd.bestDir) + '°';
          spinArrows(vd.bestDir);
          updateLive(vd.bestDir);
        });
        sug.appendChild(useBest);
      }
      body.appendChild(sug);
    }

    /* ---- 슬라이더 ---- */
    var liveTimer = null;
    slider.addEventListener('input', function () {
      var wd = parseFloat(slider.value);
      readout.textContent = Math.round(wd) + '°';
      spinArrows(wd);
      /* 판정은 표본 전체를 훑으므로 살짝 미룬다 — 드래그가 끊기면 안 된다 */
      if (liveTimer) clearTimeout(liveTimer);
      liveTimer = setTimeout(function () { updateLive(wd); }, 90);
    });
    applyBtn.addEventListener('click', function () {
      applyWind(((parseFloat(slider.value) % 360) + 360) % 360, null);
    });
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

    /* §505 — 숫자 입력 바로 아래에 지도. 여기서 눈과 계산이 만난다. */
    try { renderWindConfirm(host, a, est); } catch (e) {}

    btn.addEventListener('click', function () {
      var v = parseFloat(inp.value);
      if (!isFinite(v)) return;
      applyWind(((v % 360) + 360) % 360, null);
    });
    reBtn.addEventListener('click', function () { applyWind(null, 're-estimate'); });

    var w = a.wind;
    if (!w) { host.appendChild(el('div', 'text-secondary', 'Wind not resolved.')); return; }

    /* §535 (옥대표 "좌측을 이렇게 비워둘 필요가 있을가?") — 그럴 필요 없었다.
       예전 배치: 왼쪽 col-7 에 VMG 표(두 줄, ~150px) · 오른쪽 col-5 에
       폴라 + 최적각 + 긴 설명(~1000px). 높이가 6배 넘게 차이 나서 왼쪽이
       통째로 비었다.

       바꾼 배치: **폴라를 넓은 왼쪽으로**(차트가 이 카드의 주인공이고
       넓을수록 각도를 읽기 쉽다), 오른쪽에 VMG 표와 최적각을 **쌓는다**.
       그러면 두 칼럼 높이가 얼추 맞고 빈 공간이 사라진다. */
    var grid = el('div', 'row row-cards');

    var colT = el('div', 'col-lg-5');
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
    colT.appendChild(cardT);   /* grid 추가는 폴라 뒤에 — 순서를 바꾼다 */

    var colP = el('div', 'col-lg-7');
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
      + 'Up is upwind. The solid line is your best 5% at that angle, the shaded '
      + 'band down to your usual speed \u2014 a wide band means an inconsistent '
      + 'angle. Angles with fewer than 5 samples are left blank rather than drawn '
      + 'at zero. A dent on one side means that tack is losing speed.';
    cardP.appendChild(footP);
    colP.appendChild(cardP);
    /* 폴라를 먼저(왼쪽), VMG·최적각을 나중에(오른쪽) */
    grid.appendChild(colP);
    grid.appendChild(colT);
    host.appendChild(grid);

    if (window.RDPolar) {
      /* 칼럼이 넓어졌으니 차트도 키운다 — 각도 눈금이 촘촘해서
         작으면 읽으려고 만든 눈금이 도리어 뭉갠다 */
      RDPolar.render(polarHost, a.polar,
        { grid: THEME.grid, dim: THEME.dim, port: THEME.port, starboard: THEME.stbd,
          size: Math.min(520, polarHost.clientWidth || 460),
          band: true, minN: 5 });
      /* 최적각은 **오른쪽 칼럼**에 별도 카드로 — 폴라 카드에 붙이면
         왼쪽이 더 길어져 원래 문제가 반대로 재현된다 */
      var cardO = el('div', 'card mt-3');
      renderOptimalAngles(cardO, a);
      if (cardO.firstChild) colT.appendChild(cardO);
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
    /* §514 — 오늘의 제안 **앞에** 둔다. 제안이 이 입력을 쓰기 때문이다. */
    try { renderWellness(host); } catch (e) {}
    /* §538 — 제안은 웰니스 값에 딸려 있으므로 전용 호스트에 담아
       그 안만 다시 그릴 수 있게 한다(탭 전체 재렌더 = 스크롤 튐). */
    var sugHost = el('div'); sugHost.id = 'today-suggestion';
    host.appendChild(sugHost);
    renderTodaySuggestion(sugHost, ledger, rp);
    try { renderHrRecovery(host); } catch (e) {}
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

  /* ============================================================
   * §514 웰니스 입력 + 웨어러블 가져오기
   *
   * 옥대표: "애플워치나 가민 삼성갤럭시 오라링의 데이터를 자동으로
   *          댕겨올 수 있게 ... 안되면 일단 수동부터"
   *
   * 자동 연동의 현실:
   *   · **Apple Watch** — HealthKit 은 **iOS 앱에서만** 읽는다. 웹에서
   *     접근하는 공개 API 가 없다. 우리 대시보드는 정적 웹이라 불가.
   *   · **Garmin** — Connect API 는 OAuth + 개발자 승인 + **서버**가
   *     필요하다(토큰 교환을 브라우저에서 하면 비밀키가 노출된다).
   *   · **Samsung Health** — 안드로이드 앱 또는 파트너 API. 웹 불가.
   *   · **Oura** — REST API v2 가 공개돼 있어 넷 중 유일하게 가능성이
   *     있으나 CORS 와 토큰 보관 문제가 남는다.
   *   → **넷 다 서버가 있어야 한다.** 지금은 없다.
   *
   * 그래서 지금 되는 두 길을 만든다:
   *   ① **수동 입력** — Hooper 4항목·안정시심박·HRV·수면. 시계가 아침에
   *      보여 주는 숫자를 옮겨 적으면 그날부터 판정이 좋아진다.
   *   ② **파일 가져오기** — 네 기기 **전부 CSV 를 내보낸다.** 열 이름을
   *      자동으로 알아보고 한 번에 수십~수백 일을 채운다. 인증이 필요
   *      없고 오늘 바로 된다.
   * API 연동은 서버가 생기면 ②의 파서를 그대로 재사용한다.
   * ============================================================ */

  var WELL_FIELDS = [
    { k: 'fatigue',      label: 'Fatigue',       lo: 'wrecked',  hi: 'fresh' },
    { k: 'stress',       label: 'Stress',        lo: 'very high', hi: 'none' },
    { k: 'soreness',     label: 'Muscle soreness', lo: 'severe', hi: 'none' },
    { k: 'sleepQuality', label: 'Sleep quality', lo: 'awful',    hi: 'great' }
  ];

  function todayYmd() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* §538 — 값을 저장했다는 표시.
     옥대표 "이걸 입력하고 저장하는 버튼이 없고" — 버튼을 만드는 대신
     **자동 저장이라는 걸 보이게** 한다. 버튼을 두면 누르지 않고 떠난
     입력이 사라지는데, 그게 더 나쁘다. */
  var _wellSaveTimer = null;
  function wellSaved() {
    var host = $('wellness-saved');
    if (!host) return;
    host.textContent = '저장됨 \u00b7 saved';
    host.style.opacity = '1';
    if (_wellSaveTimer) clearTimeout(_wellSaveTimer);
    _wellSaveTimer = setTimeout(function () { host.style.opacity = '0'; }, 1800);
  }

  /* 웰니스 값에 딸린 것들만 다시 그린다 — 탭 전체가 아니라. */
  function refreshWellnessDependents() {
    try { renderWellnessTrend(); } catch (e) {}
    try { renderWellnessChart(); } catch (e) {}
    /* 오늘의 제안은 이 값들로 판정하므로 같이 갱신한다 */
    try {
      var sh = $('today-suggestion');
      if (sh && window.RDStorage) {
        while (sh.firstChild) sh.removeChild(sh.firstChild);
        renderTodaySuggestion(sh, RDStorage.loadLedger(), riderProfile());
      }
    } catch (e) {}
  }

  function renderWellnessTrend() {
    var tr = $('wellness-trend');
    if (!tr) return;
    while (tr.firstChild) tr.removeChild(tr.firstChild);
    var hrv = RDStorage.computeHRVTrend ? RDStorage.computeHRVTrend() : null;
    var rhr = RDStorage.computeRHRTrend ? RDStorage.computeRHRTrend() : null;
    var line = [];
    if (hrv && hrv.ok) {
      line.push('HRV ' + hrv.recent7Ms + ' ms over the last 7 days against a '
        + hrv.baselineDays + '-day baseline of ' + hrv.baselineMs + ' ms ('
        + (hrv.deviationSD > 0 ? '+' : '') + hrv.deviationSD + ' SD)');
    } else if (hrv && hrv.have != null) {
      line.push('HRV trend needs ' + hrv.need + ' days, has ' + hrv.have);
    }
    if (rhr && rhr.ok) {
      line.push('resting HR ' + rhr.recent7Bpm + ' bpm vs baseline '
        + rhr.baselineBpm + ' (' + (rhr.deltaBpm > 0 ? '+' : '') + rhr.deltaBpm + ')');
    }
    if (line.length) {
      tr.className = 'lab mt-3';
      tr.textContent = line.join('  \u00b7  ') + '.';
    }
  }

  /* §538 (옥대표 "입력후 데이터들은 어디서 시각화 되고 있는건지?")
     — 정당한 질문이었다. 넣기만 하고 **글 한 줄**로만 돌려주고 있었다.
     기록이 쌓이는 게 보여야 계속 넣을 이유가 생긴다.
     HRV·안정시심박·Hooper 를 한 판에 겹치지 않고 세 줄로 나눠 그린다
     (§473 과 같은 규칙 — 단위가 다른 걸 한 축에 겹치면 교차점이 뜻을
     갖는 것처럼 보인다). */
  function renderWellnessChart() {
    var host = $('wellness-chart');
    if (!host || !window.RDStorage || !RDStorage.loadWellness) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    var rows = (RDStorage.loadWellness() || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    });
    if (rows.length < 2) {
      var hint = el('div', 'lab mt-3');
      hint.textContent = rows.length
        ? 'One day recorded. From two days on, the trend is drawn here.'
        : 'Nothing recorded yet \u2014 answer the four questions above and it '
          + 'starts building a trend here.';
      host.appendChild(hint);
      return;
    }

    var SERIES = [
      { k: 'hrvMs',  label: 'HRV',            unit: 'ms',  color: THEME.accent,
        get: function (r) { return r.hrvMs; } },
      { k: 'rhrBpm', label: 'Resting HR',     unit: 'bpm', color: THEME.port,
        get: function (r) { return r.rhrBpm; } },
      { k: 'hooper', label: 'How you felt',   unit: '/20', color: THEME.stbd,
        get: function (r) {
          if (!r.hooper) return null;
          var ks = ['fatigue', 'stress', 'soreness', 'sleepQuality'], n = 0, sum = 0;
          ks.forEach(function (x) { if (r.hooper[x] != null) { sum += r.hooper[x]; n++; } });
          return n === 4 ? sum : null;      /* 넷 다 있을 때만 — 부분합은 비교가 안 된다 */
        } }
    ];

    var wrap = el('div', 'mt-3');
    var drew = 0;
    SERIES.forEach(function (sd) {
      var pts = [];
      rows.forEach(function (r) {
        var v = sd.get(r);
        if (v != null && isFinite(v)) pts.push({ date: r.date, v: v });
      });
      if (pts.length < 2) return;
      drew++;
      var row = el('div', 'mt-2');
      var head = el('div', 'd-flex align-items-baseline justify-content-between');
      head.appendChild(el('div', 'lab', sd.label));
      var last = pts[pts.length - 1];
      head.appendChild(el('div', 'lab',
        last.v + ' ' + sd.unit + '  \u00b7  ' + pts.length + ' days'));
      row.appendChild(head);
      row.appendChild(sparkline(pts, sd.color));
      wrap.appendChild(row);
    });
    if (!drew) {
      var none = el('div', 'lab mt-3');
      none.textContent = 'Not enough of any one measure yet \u2014 two days of the '
        + 'same field are needed before a line means anything.';
      host.appendChild(none);
      return;
    }
    host.appendChild(wrap);
    var note = el('div', 'lab mt-2');
    note.textContent = 'Each line is its own scale \u2014 they are different units, '
      + 'so putting them on one axis would invent a relationship that is not there.';
    host.appendChild(note);
  }

  /* 작은 추세선. uPlot 을 쓰기엔 과하고, 여기서 필요한 건 방향뿐이다. */
  function sparkline(pts, color) {
    var W = 100, H = 26;                       /* viewBox 단위 — 폭은 CSS 로 늘린다 */
    var vs = pts.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    if (hi - lo < 1e-9) { hi = lo + 1; }
    var d = pts.map(function (p, i) {
      var x = (i / (pts.length - 1)) * W;
      var y = H - ((p.v - lo) / (hi - lo)) * (H - 4) - 2;
      return (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }).join(' ');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'width:100%;height:34px;display:block';
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    /* 마지막 점 — 지금이 어디인지 */
    var cx = W, cy = H - ((pts[pts.length - 1].v - lo) / (hi - lo)) * (H - 4) - 2;
    var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(cx - 1)); dot.setAttribute('cy', String(cy));
    dot.setAttribute('r', '1.6'); dot.setAttribute('fill', color);
    dot.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(dot);
    return svg;
  }

  function renderWellness(host) {
    if (!RDStorage || !RDStorage.saveWellness) return;
    var today = todayYmd();
    var existing = (RDStorage.loadWellness() || []).filter(function (r) {
      return r.date === today;
    })[0] || {};

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'How you feel today'));
    var hact = el('div', 'card-actions d-flex align-items-center gap-3');
    /* §538 — 자동 저장이라는 걸 보이게. 저장 버튼을 두면 누르지 않고
       떠난 입력이 사라지는데 그게 더 나쁘다. */
    var savedTag = el('span', 'lab');
    savedTag.id = 'wellness-saved';
    savedTag.style.cssText = 'color:' + THEME.stbd + ';opacity:0;transition:opacity .25s';
    hact.appendChild(savedTag);
    hact.appendChild(el('span', 'lab', today));
    head.appendChild(hact);
    card.appendChild(head);
    var body = el('div', 'card-body');
    body.appendChild(el('div', 'lab mb-2',
      '\uc785\ub825\ud558\ub294 \uc989\uc2dc \uc800\uc7a5\ub429\ub2c8\ub2e4 \u2014 '
      + 'saved as you type, no button needed.'));
    body.appendChild(el('div', 'text-secondary mb-2',
      'Four questions, five seconds. This is the Hooper index — the standard '
      + 'subjective wellness measure in sports science, and the single cheapest '
      + 'thing you can add to a recovery decision. Without it the call below is '
      + 'made on training load alone.'));

    var vals = Object.assign({}, existing.hooper || {});
    var grid = el('div', 'row g-3');
    WELL_FIELDS.forEach(function (f) {
      var col = el('div', 'col-12 col-md-6');
      col.appendChild(el('div', 'lab', f.label));
      var wrap = el('div', 'btn-group btn-group-sm mt-1 w-100');
      for (var n = 1; n <= 5; n++) {
        (function (n) {
          var b = el('button', 'btn' + (vals[f.k] === n ? ' active' : ''), String(n));
          b.type = 'button';
          b.addEventListener('click', function () {
            /* §538 (옥대표 "점수 클릭 할대마다 제일 위로 화면이 이동하네")
               — renderTraining() 이 탭 전체를 다시 그려서 DOM 이 통째로
               바뀌고 스크롤이 맨 위로 튀었다. 바뀌는 건 이 버튼 하나와
               그에 딸린 요약·판정뿐이므로 **그것만** 다시 그린다. */
            vals[f.k] = n;
            RDStorage.saveWellness({ date: today, hooper: vals });
            Array.prototype.forEach.call(wrap.children, function (o, i) {
              if (i + 1 === n) o.classList.add('active');
              else o.classList.remove('active');
            });
            wellSaved();
            refreshWellnessDependents();
          });
          wrap.appendChild(b);
        })(n);
      }
      col.appendChild(wrap);
      var scale = el('div', 'lab mt-1');
      scale.textContent = '1 = ' + f.lo + '   ·   5 = ' + f.hi;
      col.appendChild(scale);
      grid.appendChild(col);
    });
    body.appendChild(grid);

    /* 시계가 주는 숫자 — 있으면 넣고 없으면 비워 둔다 */
    var num = el('div', 'row g-3 mt-1');
    [['rhrBpm', 'Resting heart rate', 'bpm', 30, 100],
     ['hrvMs', 'HRV (rMSSD or SDNN)', 'ms', 5, 300],
     ['sleepH', 'Sleep', 'h', 0, 14]].forEach(function (f) {
      var col = el('div', 'col-12 col-md-4');
      col.appendChild(el('div', 'lab', f[1] + ' (' + f[2] + ')'));
      var inp = el('input', 'form-control num mt-1');
      inp.type = 'number'; inp.min = String(f[3]); inp.max = String(f[4]);
      inp.step = (f[0] === 'sleepH') ? '0.1' : '1';
      if (existing[f[0]] != null) inp.value = String(existing[f[0]]);
      inp.addEventListener('change', function () {
        var v = parseFloat(inp.value);
        var rec = { date: today };
        rec[f[0]] = isFinite(v) ? v : null;
        if (isFinite(v)) {
          RDStorage.saveWellness(rec);
          wellSaved();
          refreshWellnessDependents();
        }
      });
      col.appendChild(inp);
      num.appendChild(col);
    });
    body.appendChild(num);

    /* §538 — 추세 요약과 그래프는 전용 호스트에 담는다.
       그래야 값을 바꿀 때 **이 안만** 다시 그리고 스크롤이 안 튄다. */
    var trHost = el('div'); trHost.id = 'wellness-trend';
    body.appendChild(trHost);
    var chartHost = el('div'); chartHost.id = 'wellness-chart';
    body.appendChild(chartHost);
    refreshWellnessDependents();

    /* 가져오기 */
    body.appendChild(renderWellnessImport());
    card.appendChild(body);
    host.appendChild(card);
  }

  /* ---- CSV 가져오기 — 네 기기 전부 CSV 를 내보낸다 ---- */
  var WELL_COLS = {
    /* Apple Health 는 startDate, Garmin 은 Date, Oura 는 date 를 쓴다 */
    date: [/^date$/i, /^day$/i, /^summary.?date$/i, /^start.?(date|time)/i,
           /^creation.?date$/i, /^timestamp$/i, /날짜/],
    hrvMs: [/hrv/i, /rmssd/i, /sdnn/i, /heart.?rate.?variability/i],
    rhrBpm: [/resting.?heart/i, /^rhr$/i, /lowest.?resting/i, /resting.?hr/i, /안정시/],
    sleepH: [/total.?sleep.?duration/i, /^sleep.?hours?$/i, /^sleep$/i, /asleep.?time/i, /수면/]
  };

  function wellMatchCols(header) {
    var map = {};
    Object.keys(WELL_COLS).forEach(function (field) {
      for (var i = 0; i < header.length; i++) {
        var h = String(header[i]).trim();
        if (!h) continue;
        for (var p = 0; p < WELL_COLS[field].length; p++) {
          if (WELL_COLS[field][p].test(h)) {
            if (map[field] == null) map[field] = i;
            break;
          }
        }
        if (map[field] != null) break;
      }
    });
    return map;
  }

  /* 'YYYY-MM-DD' 로 정규화 — ISO·미국식·엑셀식 모두 받는다 */
  function wellNormDate(s) {
    if (s == null) return null;
    var t = String(s).trim().replace(/^"|"$/g, '');
    if (!t) return null;
    var m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      return m[1] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0');
    }
    var d = new Date(t);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
           + '-' + String(d.getDate()).padStart(2, '0');
    }
    return null;
  }

  /* 수면은 기기마다 단위가 다르다 — 초·분·시간을 값 크기로 가른다 */
  function wellNormSleep(v) {
    var n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return null;
    if (n > 1000) return Math.round(n / 3600 * 10) / 10;   /* 초 */
    if (n > 24) return Math.round(n / 60 * 10) / 10;       /* 분 */
    return Math.round(n * 10) / 10;                        /* 시간 */
  }

  function parseWellnessCsv(text) {
    var lines = String(text).split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return { ok: false, error: 'not enough rows' };
    function split(l) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < l.length; i++) {
        var c = l[i];
        if (c === '"') { q = !q; continue; }
        if (c === ',' && !q) { out.push(cur); cur = ''; continue; }
        cur += c;
      }
      out.push(cur);
      return out;
    }
    var header = split(lines[0]);
    var map = wellMatchCols(header);
    if (map.date == null) {
      return { ok: false, error: 'no date column',
               header: header.slice(0, 12) };
    }
    var found = Object.keys(map).filter(function (k) { return k !== 'date'; });
    if (!found.length) {
      return { ok: false, error: 'no wellness column recognised',
               header: header.slice(0, 12) };
    }
    var rows = [], skipped = 0;
    for (var i = 1; i < lines.length; i++) {
      var c = split(lines[i]);
      var date = wellNormDate(c[map.date]);
      if (!date) { skipped++; continue; }
      var rec = { date: date };
      var any = false;
      if (map.hrvMs != null) {
        var hv = parseFloat(c[map.hrvMs]);
        if (isFinite(hv) && hv > 0 && hv < 400) { rec.hrvMs = hv; any = true; }
      }
      if (map.rhrBpm != null) {
        var rv = parseFloat(c[map.rhrBpm]);
        if (isFinite(rv) && rv > 25 && rv < 120) { rec.rhrBpm = rv; any = true; }
      }
      if (map.sleepH != null) {
        var sv = wellNormSleep(c[map.sleepH]);
        if (sv != null && sv <= 20) { rec.sleepH = sv; any = true; }
      }
      if (any) rows.push(rec); else skipped++;
    }
    return { ok: rows.length > 0, rows: rows, skipped: skipped,
             matched: found, header: header.slice(0, 12),
             error: rows.length ? null : 'no usable rows' };
  }

  /* 가져오기 결과는 renderTraining() 재렌더를 살아남아야 한다.
     성공 메시지를 out 에 붙인 직후 재렌더가 training-body 를 통째로
     비워서, 15일치가 실제로 저장됐는데도 화면엔 아무 말도 안 떴다(실측).
     그래서 메시지를 밖에 들고 있다가 다시 그릴 때 붙인다. */
  var wellFlash = null;

  function renderWellnessImport() {
    var box = el('div', 'mt-3');
    var head = el('div', 'fw-bold', 'Import from your watch or ring');
    box.appendChild(head);
    box.appendChild(el('div', 'text-secondary mt-1',
      'Apple Health, Garmin Connect, Samsung Health and Oura all export CSV. '
      + 'Drop one here and the columns are matched automatically — no account, '
      + 'no keys, works today. (A direct API connection needs a server we do not '
      + 'have yet; when it exists this same parser is reused.)'));
    var inp = el('input', 'form-control mt-2');
    inp.type = 'file'; inp.accept = '.csv,text/csv';
    var out = el('div', 'mt-2');
    if (wellFlash) {
      var flash = el('div', 'alert alert-' + (wellFlash.kind === 'ok' ? 'success' : 'warning'));
      flash.appendChild(el('div', 'fw-bold', wellFlash.title));
      flash.appendChild(el('div', 'mt-1', wellFlash.body));
      out.appendChild(flash);
      wellFlash = null;
    }
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      while (out.firstChild) out.removeChild(out.firstChild);
      var fr = new FileReader();
      fr.onload = function () {
        var res = parseWellnessCsv(String(fr.result || ''));
        if (!res.ok) {
          var bad = el('div', 'alert alert-warning');
          bad.appendChild(el('div', 'fw-bold', 'Could not read that file'));
          bad.appendChild(el('div', 'mt-1',
            (res.error || 'unknown') + '. Columns seen: '
            + (res.header || []).join(', ')
            + '. It needs a date column plus at least one of HRV, resting heart '
            + 'rate or sleep.'));
          out.appendChild(bad);
          return;
        }
        var n = 0;
        res.rows.forEach(function (r) {
          if (RDStorage.saveWellness(r).ok) n++;
        });
        wellFlash = {
          kind: 'ok',
          title: 'Imported ' + n + ' days',
          body: 'Matched: ' + res.matched.join(', ')
            + (res.skipped ? '  \u00b7  skipped ' + res.skipped + ' rows with no usable value' : '')
            + '. Days you had already filled in were merged, not overwritten.'
        };
        renderTraining();
      };
      fr.readAsText(f);
    });
    box.appendChild(inp);
    box.appendChild(out);
    return box;
  }

    /* §526 T5 목표 강도 밴드 */
  /* ═══════════════════════════════════════════════════════════════
   * §528 계정 상태 (옥대표 "로그인 기능을 넣자. 그래야 데이터가 보존되지")
   *
   * 이 칩이 답해야 하는 질문은 하나다: **내 기록이 어디에 있나.**
   *   · 로그인함    → 계정에 묶임. 다른 기기에서도 보인다
   *   · 로그인 안 함 → 이 브라우저에만. 지우면 끝이다
   *   · 백엔드 잠듦  → 로그인을 하고 싶어도 못 한다. 그걸 말해야 한다
   *
   * ⚠ 세 번째가 지금 실제 상황이다(§527 진단: 무료티어 auto-pause).
   *   그래서 이 UI 의 성공 조건은 "로그인이 된다" 가 아니라
   *   **"백엔드가 죽어도 대시보드가 멀쩡하고, 왜 못 하는지 보인다"** 이다.
   * ═══════════════════════════════════════════════════════════════ */
  var AUTH_UI = { health: null, checked: false };

  function authLoginUrl() {
    /* 로그인 후 여기로 돌아오게 한다 — 로그인하고 홈으로 튕기면
       하던 분석을 다시 열어야 한다 */
    var next = '/riding-dashboard/v2.html';
    return '../login.html?next=' + encodeURIComponent(next);
  }

  function renderAuthChip() {
    var host = $('auth-chip');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    var A = window.DMJAuth;
    if (!A) {
      /* 인증 모듈 자체가 안 실렸다 — 로컬 전용으로 도는 것이고,
         그것도 정상 동작이다(§412 이전의 v2 가 그랬다). */
      host.appendChild(el('span', null, 'saved on this browser'));
      host.title = 'The sign-in module did not load, so everything is stored '
                 + 'locally in this browser only.';
      return;
    }

    var user = null;
    try { user = A.currentUser && A.currentUser(); } catch (e) {}

    if (user) {
      var who = user.name || user.email || 'signed in';
      var wrap = el('span');
      var dot = el('span');
      dot.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;'
        + 'background:' + THEME.stbd + ';margin-right:6px;vertical-align:middle';
      wrap.appendChild(dot);
      wrap.appendChild(document.createTextNode(who));
      host.appendChild(wrap);
      var out = el('button', 'btn btn-sm btn-ghost-secondary ms-2 p-0 px-1', 'sign out');
      out.type = 'button';
      out.addEventListener('click', function () {
        out.disabled = true; out.textContent = '\u2026';
        A.logout().then(function () { location.reload(); })
                  .catch(function () { out.disabled = false; out.textContent = 'sign out'; });
      });
      host.appendChild(out);
      host.title = 'Your rides are tied to this account, so they follow you to '
                 + 'another browser or phone.';
      return;
    }

    /* 로그인 안 함 — 백엔드가 살아 있는지에 따라 말이 달라진다 */
    var txt = el('span', null, 'this browser only');
    host.appendChild(txt);

    if (!AUTH_UI.checked && A.backendHealth) {
      AUTH_UI.checked = true;
      A.backendHealth().then(function (h) {
        AUTH_UI.health = h;
        renderAuthChip();
      }).catch(function () {});
    }

    if (AUTH_UI.health && AUTH_UI.health.ok === false) {
      var warn = el('span', 'ms-2');
      warn.style.color = THEME.warn;
      warn.textContent = 'sign-in unavailable';
      warn.title = 'The account server is not responding, so signing in is not '
        + 'possible right now. Your rides are still being saved in this browser '
        + '\u2014 nothing is lost, it just cannot follow you to another device yet.';
      host.appendChild(warn);
      return;
    }

    var link = el('a', 'btn btn-sm btn-ghost-secondary ms-2 p-0 px-1', 'sign in');
    link.href = authLoginUrl();
    host.appendChild(link);
    host.title = 'Rides are stored in this browser. Sign in and they follow you '
               + 'to another browser or phone.';
  }

  function renderTargetExertion(body, decision, rp) {
    if (!window.RDFitness || !decision) return;
    var band = RDFitness.targetBand(decision.action, rp && rp.maxHr, rp && rp.restHr);
    var wrap = el('div', 'mt-2');
    if (!band.ok) {
      if (band.reason === 'need_max_hr') {
        wrap.appendChild(el('div', 'lab',
          'Enter a measured max heart rate above and this becomes a target '
          + 'heart-rate band, not just a word.'));
        body.appendChild(wrap);
      }
      /* rest_day 면 밴드를 안 준다 — 목표 심박을 주면 그건 타라는 말이다 */
      return;
    }
    var row = el('div', 'd-flex flex-wrap align-items-baseline gap-3');
    var v = el('div', 'kpi__val num', band.loBpm + '\u2013' + band.hiBpm);
    v.style.color = THEME.accent;
    row.appendChild(v);
    row.appendChild(el('div', 'lab', 'bpm \u00b7 ' + band.label + ' \u00b7 '
      + Math.round(band.loPct * 100) + '\u2013' + Math.round(band.hiPct * 100)
      + '% ' + (band.method === 'karvonen' ? 'of heart-rate reserve'
                                           : 'of max heart rate')));
    wrap.appendChild(row);
    if (band.method !== 'karvonen') {
      wrap.appendChild(el('div', 'lab',
        'Add your resting heart rate above for a sharper band \u2014 with it the '
        + 'percentages are taken off your reserve, which matters when your '
        + 'resting rate is low.'));
    }
    /* 오늘 이미 탔으면 지켰는지 보여 준다 — 처방과 실행을 잇는다 */
    if (CUR.session && CUR.session.samples) {
      var comp = RDFitness.bandCompliance(CUR.session.samples, band);
      if (comp && comp.totalSec > 60) {
        var line = el('div', 'lab mt-1');
        line.textContent = 'The session loaded above spent '
          + Math.round(comp.inPct) + '% of its heart-rate time in this band ('
          + Math.round(comp.belowSec / 60) + ' min under, '
          + Math.round(comp.aboveSec / 60) + ' min over).';
        wrap.appendChild(line);
      }
    }
    body.appendChild(wrap);
  }

  /* §526 T4 심박 회복 — 힘든 뒤 심박이 얼마나 빨리 떨어지나.
     ⚠ 진단이 아니다. 같은 사람의 **추세**로만 뜻이 있다. */
  function renderHrRecovery(host) {
    if (!window.RDFitness || !CUR.session) return;
    var S = CUR.session.samples || [];
    var h = RDFitness.hrRecovery(S, { peakMinBpm: 130, windowSec: 60 });

    var card = el('div', 'card mt-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Heart-rate recovery'));
    head.appendChild(el('div', 'card-actions lab', 'drop 60 s after a hard patch'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    if (!h.ok) {
      var why;
      if (h.reason === 'no_hr') {
        why = 'This session has no heart-rate data.';
      } else if (h.reason === 'never_hard_enough') {
        why = 'Your heart rate never reached 130 bpm this session (peak '
          + Math.round(h.maxHrSeen) + '), so there is no hard patch to recover from.';
      } else if (h.reason === 'no_clean_recovery') {
        why = 'The recording stops within a minute of the last hard patch, so '
          + 'there is nothing to measure the drop against. Leaving the watch '
          + 'running for a minute after you come in is all it takes.';
      } else {
        why = 'Not enough data.';
      }
      body.appendChild(el('div', 'text-secondary', why));
      card.appendChild(body); host.appendChild(card);
      return;
    }

    var bandInfo = RDFitness.hrrBand(h.bestDropBpm);
    var row = el('div', 'd-flex flex-wrap align-items-baseline gap-3');
    var v = el('div', 'kpi__val num', '\u2212' + Math.round(h.bestDropBpm));
    v.style.color = THEME.accent;
    row.appendChild(v);
    row.appendChild(el('div', 'lab', 'bpm in 60 s \u00b7 ' + bandInfo.label
      + ' \u00b7 ' + Math.round(h.bestPeakBpm) + ' \u2192 '
      + Math.round(h.bestEndBpm) + ' bpm'));
    body.appendChild(row);
    if (h.count > 1) {
      body.appendChild(el('div', 'lab mt-1',
        'Best of ' + h.count + ' recoveries this session \u00b7 average \u2212'
        + Math.round(h.avgDropBpm) + ' bpm.'));
    }
    var note = el('div', 'text-secondary mt-2');
    note.style.fontSize = '.8125rem';
    note.textContent = 'How fast your heart rate falls after effort tracks aerobic '
      + 'fitness and how well you are recovering. Read it as your own trend, not '
      + 'against anyone else: conditions on the water are never the same twice, so '
      + 'a single session says little and a run of sessions says a lot. This is '
      + 'not a medical measure \u2014 a clinical test is done on a treadmill under '
      + 'controlled load, and this is not that.';
    body.appendChild(note);
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
      /* §514 — 여태 tsb·acwr **둘만** 넘기고 있었다. 판정 로직은 4인자를
         세도록 돼 있어서(red≥2→rest) 절반만 도는 셈이었다.
         이제 나머지 셋을 채운다 — 없으면 null 이고 그 인자는 무시된다. */
      var hrvT = RDStorage.computeHRVTrend ? RDStorage.computeHRVTrend() : null;
      var wellT = RDStorage.computeWellnessTrend ? RDStorage.computeWellnessTrend() : null;
      var restD = RDStorage.daysSinceRest ? RDStorage.daysSinceRest(ledger) : null;
      decision = RDCoach.decideRecoveryAction({
        tsb: cur.TSB,
        acwr: (acwr && acwr.ratio != null) ? acwr.ratio : null,
        hrvDeviationSD: (hrvT && hrvT.ok) ? hrvT.deviationSD : null,
        hooperComposite: (wellT && wellT.ok) ? wellT.composite : null,
        daysSinceRest: restD
      });
      CUR.recoveryInputs = {
        tsb: cur.TSB,
        acwr: (acwr && acwr.ratio != null) ? acwr.ratio : null,
        hrv: (hrvT && hrvT.ok) ? hrvT.deviationSD : null,
        hooper: (wellT && wellT.ok) ? wellT.composite : null,
        rest: restD,
        hrvWhy: (hrvT && !hrvT.ok) ? hrvT.reason : null,
        hooperWhy: (wellT && !wellT.ok) ? wellT.reason : null
      };
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

    /* §526 T5 — 판정을 **심박 밴드**로 옮긴다. "적당히 타세요" 는 실행할
       수 없고 "128~149 bpm" 은 실행할 수 있다. Athlytic 벤치마킹의
       Target Exertion 에 대응하는 자리다. */
    try { renderTargetExertion(body, decision, rp); } catch (e) {}

  /* §514 — 몇 개의 신호로 판정했는지, 그리고 **빠진 것은 왜 빠졌는지**.
       이걸 안 적으면 두 신호로 내린 판정과 네 신호로 내린 판정이 화면에서
       똑같아 보인다. 판정 규칙이 '빨강 2개 이상이면 휴식' 이라 세는 개수가
       곧 신뢰도다. */
    var ri = CUR.recoveryInputs || {};
    var have = ['tsb', 'acwr', 'hrv', 'hooper', 'rest'].filter(function (k) {
      return ri[k] != null;
    }).length;
    var miss = [];
    if (ri.hrv == null) {
      miss.push('HRV' + (ri.hrvWhy === 'need_more_days'
        ? ' (needs 14 days of entries)' : ' (not entered)'));
    }
    if (ri.hooper == null) miss.push('today’s four wellness answers');
    var cov = el('div', 'lab mt-2');
    cov.textContent = 'Decided on ' + have + ' of 5 signals'
      + (miss.length ? ' — missing ' + miss.join(' and ')
          + '. Fill those in above and this call gets sharper.'
        : ' — the full set.');
    body.appendChild(cov);

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
          { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
            font: '11px "IBM Plex Mono", monospace',
            values: function (u, t) {
              return t.map(function (v) { return v.toFixed(0) + res.x.unit; });
            } },
          { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
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

    /* §502 Tack bias — 통계표의 요약이므로 그 위에 둔다. 자기 호스트를
       따로 갖는 이유는 지표 버튼을 눌렀을 때 **이 카드만** 다시 그리기
       위해서다(성능 탭 전체를 다시 그리면 스크롤이 튄다). */
    try { renderFoilStructure(host, a); } catch (e) {}

    var tbHost = el('div');
    tbHost.id = 'tackbias-host';
    host.appendChild(tbHost);
    try { renderTackBias(tbHost, a); } catch (e) {}

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
      /* §506 (옥대표 "5개만 화면에 노출하고 더보기 버튼으로") —
         런이 20개씩 나오면 표가 화면을 잡아먹는다. 상위 5개만 두고
         나머지는 접는다. 정렬이 빠른 순이라 위 5개가 볼 값어치가 크다. */
      var RUN_SHOW = 5;
      var rows = [];
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
        if (i >= RUN_SHOW) tr.style.display = 'none';
        rows.push(tr);
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
      if (runs.length > RUN_SHOW) {
        var more = el('div', 'card-footer text-center');
        var mb = el('button', 'btn btn-sm btn-ghost-secondary',
          'Show all ' + runs.length + ' runs');
        mb.type = 'button';
        var open = false;
        mb.addEventListener('click', function () {
          open = !open;
          rows.forEach(function (tr, i) {
            if (i >= RUN_SHOW) tr.style.display = open ? '' : 'none';
          });
          mb.textContent = open ? 'Show top ' + RUN_SHOW + ' only'
                                : 'Show all ' + runs.length + ' runs';
        });
        more.appendChild(mb);
        card.appendChild(more);
      }
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
      aws:  'Apparent wind speed (kt)',
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
    var thP = el('th', 'text-center'); thP.colSpan = 3;
    thP.appendChild(sideTag('P', 'Port')); r1.appendChild(thP);
    var thS = el('th', 'text-center'); thS.colSpan = 3;
    thS.appendChild(sideTag('S', 'Starboard')); r1.appendChild(thS);
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
          /* §492 — 예전에는 택 구분이 없는 지표(HR)의 합산값을 **Port 칸에**
             넣고 Starboard 를 비웠다. 그러면 "스타보드는 측정이 안 됐다"
             로 읽힌다 — 실제로는 그 숫자가 양쪽 합산이었다.
             이제 HR 도 버킷별로 쪼개므로 이 분기는 필요 없다. 그래도
             택 구분이 없는 지표가 다시 생기면, 한쪽에 몰지 말고 양쪽에
             같은 값을 넣는다(같은 값임이 보이는 게 낫다). */
          var row = modes[mode][side] || modes[mode]['-'];
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
      + 'that means the lowest angles upwind, the highest downwind. '
      /* §492 — 택별 심박 차이를 체력 좌우차로 바로 읽지 않도록 경고.
         한쪽 택을 세션 후반에 몰아서 탔으면 그 택 심박이 낮게 나온다. */
      + 'Heart rate is split by tack too, but read a difference carefully — if you '
      + 'sailed one tack mostly late in the session, that alone lowers it.'
      /* §494 — AWS 는 풍속 입력 오차를 거의 그대로 물려받는다. 숫자를
         절대값으로 믿게 두면 안 된다. */
      + (sp.rows.some(function (r) { return r.metric === 'aws'; })
          ? '  Apparent wind speed is built from the wind speed you entered, so it '
            + 'carries that error almost one-for-one — read it as a trend, not a '
            + 'measurement. The angle is far less sensitive to it.'
          : '');
    c2.appendChild(f2);
    host.appendChild(c2);
  }

  /* §495 — 저장된 세션 열기. 저장 당시의 풍향·풍속·장비 입력까지 되살려야
     그때 본 화면과 같은 숫자가 나온다. 트랙만 다시 분석하고 입력을 지금
     화면 값으로 두면, 같은 세션인데 점수가 달라 보인다. */
  function openSavedSession(rec) {
    if (!rec || !window.RDStorage) return;
    var gpx = null;
    try { gpx = RDStorage.loadTrack(rec.id); } catch (e) { gpx = null; }

    /* §509 — 압축 형식(RDTRK1)이면 GPX 파싱을 건너뛰고 바로 세션을 만든다.
       normalizeSession 이 속도·방위·거리를 다시 계산하므로 lat/lng/시각
       셋이면 충분하다. */
    if (RDStorage.isCompactTrack && RDStorage.isCompactTrack(gpx)) {
      var pts = RDStorage.decodeTrack(gpx);
      if (!pts) { alertLine('This session\u2019s track could not be read.'); return; }
      try {
        if (rec.windSpeedKt != null && $('in-windspeed')) {
          $('in-windspeed').value = rec.windSpeedKt;
        }
      } catch (e) {}
      /* ⚠ normalizeSession 은 `samples` 가 아니라 **parsed 모양**을 받는다:
         { tracks:[{segments:[[{lat,lng,time,speed}]]}], hasTime, speedSource }.
         처음에 {samples:pts} 를 넘겼다가 parsed.tracks.forEach 에서
         터졌다(화면은 조용히 안 열렸다). 파서가 주는 모양 그대로 만든다. */
      /* ⚠ time 은 **epoch 밀리초 숫자**다(gpx-parser.js:86). ISO 문자열을
         넣으면 normalizeSession 이 (p.time - t0) 산술에서 NaN 을 만들어
         t 가 전부 null 이 되고 속도가 0 으로 떨어진다 — 화면엔 날짜가
         '+058346' 으로 뜬다. 저장된 초를 ms 로 올려 준다. */
      var seg = pts.map(function (q) {
        return { lat: q.lat, lng: q.lng, ele: null,
                 time: q.t * 1000, speed: null, hr: null };
      });
      var sess = An.normalizeSession({
        tracks: [{ name: rec.name || 'Session', segments: [seg] }],
        hasTime: true, speedSource: 'derived',
        trackName: rec.name || 'Session'
      });
      var est2 = estimateWind(sess);
      var wd2 = (rec.windDir != null) ? rec.windDir
                : (est2 && est2.windDir != null ? est2.windDir : null);
      CUR.gpxText = null;          /* 원문은 더 이상 갖고 있지 않다 */
      CUR.est = est2;
      CUR.windDir = wd2;
      var an2 = An.analyzeSession(sess, wd2, analysisOpts(est2));
      show(sess, an2, rec.name || 'Session', est2);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      return;
    }

    if (!gpx) {
      alertLine('This session is stored as a summary only — its track was cleared '
        + 'to make space, so it cannot be reopened.');
      return;
    }
    /* 융합 세션(여러 파일 합본)은 v2 에 복원 경로가 없다. 조용히 실패하는
       대신 어디로 가야 하는지 알려 준다. */
    if (typeof gpx === 'string' && gpx.slice(0, 8) === 'RDFUSED1') {
      alertLine('This one was saved as a merged session (multiple files). '
        + 'Open it from the old dashboard — this page cannot rebuild merged tracks yet.');
      return;
    }
    /* 저장 당시 입력 복원 — 폼을 먼저 채우고 분석을 돌린다 */
    try {
      if (rec.windSpeedKt != null && $('in-windspeed')) {
        $('in-windspeed').value = rec.windSpeedKt;
      }
    } catch (e) {}
    try {
      loadGpxText(gpx, rec.name || 'Saved session');
      /* 저장된 풍향이 있으면 추정 대신 그 값으로 다시 분석한다 */
      if (rec.windDir != null && CUR.fullSession) {
        CUR.windDir = rec.windDir;
        reapplyEdits();
      }
      var el2 = document.getElementById('chart-timeline');
      if (el2) el2.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (e) {
      alertLine('Could not reopen this session: ' + (e && e.message ? e.message : e));
    }
  }

  /* 화면 상단에 한 줄 안내 — alert() 는 흐름을 끊는다 */
  function alertLine(msg) {
    var host = document.getElementById('nav-meta');
    if (!host) return;
    var prev = host.textContent;
    host.textContent = msg;
    host.style.color = THEME.warn;
    setTimeout(function () {
      host.textContent = prev; host.style.color = '';
    }, 6000);
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
    /* §510 (옥대표 "세션을 선택할 수 있게 만들어서 저장된 세션으로 즉시
       돌아갈 수 있게") — 표에서 행을 누르는 길은 §495 에 있었지만,
       표가 길어지면 찾아 내려가야 한다. 머리말에 바로 고르는 목록을 둔다.
       ⚠ 다시 열 수 있는 건 트랙이 남아 있는 것뿐이라(§509 이전 기록은
       상당수 요약만 남았다) **열리는 것만** 목록에 올린다. */
    var act = el('div', 'card-actions d-flex align-items-center gap-2');
    var openable = list.filter(function (r) { return r.hasTrack; })
      .sort(function (a2, b2) { return (b2.dateEpoch || 0) - (a2.dateEpoch || 0); });
    if (openable.length) {
      var jump = el('select', 'form-select form-select-sm');
      jump.style.width = 'auto';
      var ph = document.createElement('option');
      ph.value = ''; ph.textContent = 'Jump to a session…'; ph.selected = true;
      jump.appendChild(ph);
      openable.forEach(function (r) {
        var o = document.createElement('option');
        o.value = r.id;
        var d = r.dateEpoch ? new Date(r.dateEpoch) : null;
        o.textContent = (d ? d.toISOString().slice(0, 10) + '  ' : '')
          + (r.name || 'Session')
          + (r.distanceM ? '  ·  ' + (r.distanceM / 1000).toFixed(1) + ' km' : '');
        jump.appendChild(o);
      });
      jump.addEventListener('change', function () {
        var id = jump.value;
        if (!id) return;
        var rec = null;
        for (var i = 0; i < list.length; i++) { if (list[i].id === id) { rec = list[i]; break; } }
        jump.value = '';                 /* 다음 선택을 위해 되돌린다 */
        if (rec) openSavedSession(rec);
      });
      act.appendChild(jump);
    }
    act.appendChild(el('span', 'lab',
      list.length + ' stored'
      + (openable.length < list.length
          ? ' · ' + openable.length + ' can be reopened'
          : ' · click a row to open')));
    h.appendChild(act);
    card.appendChild(h);
    /* §537 — 요약만 남은 게 있으면 목록 위에 한 줄로 설명한다.
       행 툴팁은 마우스를 올려야 보여서, 왜 안 열리는지 모른 채 지나간다
       (옥대표가 실제로 "왜 지난세션 데이터들을 볼 수 없다고 하지?" 라고 물었다). */
    if (openable.length < list.length) {
      var noteWrap = el('div', 'card-body py-2');
      var note = el('div', 'text-secondary');
      note.style.fontSize = '.8125rem';
      note.textContent = (list.length - openable.length) + ' of these were saved '
        + 'before tracks were compressed, and their tracks were dropped when '
        + 'storage filled up \u2014 so they open as summaries only. Upload the '
        + 'same file again and it reconnects to the existing row instead of '
        + 'adding a duplicate. Tracks are 11\u00d7 smaller now, so they fit.';
      noteWrap.appendChild(note);
      card.appendChild(noteWrap);
    }
    var wrap = el('div', 'table-responsive');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Date', 'Name', 'Gear', 'Distance', 'Top', 'Avg', 'Turns', 'SPS']
      .forEach(function (x, i) {
        htr.appendChild(el('th', i > 2 ? 'text-end' : null, x));
      });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    var sorted = list.slice().sort(function (a2, b2) {
      return (a2.dateEpoch || 0) - (b2.dateEpoch || 0);
    });
    sorted.forEach(function (r) {
      var tr = el('tr');
      /* §495 (옥대표) — 저장된 세션을 눌러 바로 연다.
         원본 트랙이 남아 있는 세션만 가능하다(hasTrack). 저장 공간이
         모자라면 오래된 트랙부터 비워지므로(storeTrackWithEviction),
         요약만 남은 세션이 생긴다 — 그걸 눌렀을 때 아무 일도 안 일어나면
         고장으로 보이므로 왜 못 여는지 말해 준다(§416 과 같은 게이팅). */
      if (r.hasTrack) {
        tr.style.cursor = 'pointer';
        tr.title = 'Open this session';
        tr.addEventListener('click', function () { openSavedSession(r); });
      } else {
        tr.title = 'Summary only — the track was cleared to save space, '
                 + 'so this one cannot be reopened.';
        tr.style.opacity = '0.72';
      }
      var d = r.dateEpoch ? new Date(r.dateEpoch) : null;
      var tdD = el('td', 'num', d ? d.toISOString().slice(0, 10) : '—');
      tr.appendChild(tdD);
      var tdN = el('td', null, r.name || 'Session');
      if (!r.hasTrack) {
        var badge = el('span', 'lab ms-2', 'summary only');
        tdN.appendChild(badge);
      }
      tr.appendChild(tdN);
      /* §520 V2 — 그날 쓴 장비. 비어 있으면 **지금 채울 수 있게** 한다.
         기존 세션은 전부 비어 있어서, 이 길이 없으면 비교가 시작되는 데
         몇 달이 걸린다. */
      var tdG = el('td');
      var gl = gearLabel(r.gear);
      if (gl) {
        var gs = el('span', null, gl);
        if (r.gear && r.gear.backfilled) {
          gs.title = 'Filled in later, not recorded at save time';
          gs.style.opacity = '0.85';
          gs.appendChild(el('span', 'lab ms-1', '\u00b7 added later'));
        }
        tdG.appendChild(gs);
      } else {
        var addG = el('button', 'btn btn-sm btn-ghost-secondary p-0 px-1', 'add gear');
        addG.type = 'button';
        addG.title = 'Record which wing, foil and board you used';
        addG.addEventListener('click', function (ev) {
          ev.stopPropagation();          /* 행 클릭(세션 열기)과 섞이지 않게 */
          openGearBackfill(r);
        });
        tdG.appendChild(addG);
      }
      tr.appendChild(tdG);
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

    /* §490 시즌 흐름 (옥대표) — 지표·집계를 골라 보고, 같은 세션이 여러 번
       저장돼 있으면 하나로 친다.
       ────────────────────────────────────────────────────────────
       빈 그래프였던 이유: 같은 파일을 세 번 저장해 dateEpoch 가 셋 다
       같았다. uPlot 은 x 가 증가해야 그리므로 아무것도 안 나온다.
       → 세션 시그니처(없으면 날짜+이름)로 묶어 **가장 최근 저장본만** 쓰고,
         그래도 x 가 겹치면 1초씩 밀어 겹침을 푼다.

       "널 구간 제거" (옥대표 질문) — 이미 그렇게 되어 있고, 지표 선택으로
       더 분명해진다:
         · 평균(주행)  = movingTime 기준 — 멈춰 있던 시간이 빠진다
         · 상위 50/20% = 히스토그램(분석 구간)에서 뽑아 정지·표류가 정의상 빠진다
         · 거리·시간   = 분석 구간 합계 (기록 공백·제외 구간 제외, §459)
       즉 "시작~종료 전체"가 아니라 **실제로 탄 시간**만 센다. */
    var byKey = {};
    sorted.forEach(function (r) {
      if (!r.dateEpoch) return;
      var k = r.sig || (r.dateEpoch + '|' + (r.name || ''));
      var prev = byKey[k];
      if (!prev || (r.savedAt || 0) > (prev.savedAt || 0)) byKey[k] = r;
    });
    var pts = Object.keys(byKey).map(function (k) { return byKey[k]; })
      .sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
    if (pts.length < 2 || !window.uPlot) return;

    var TREND_METRICS = [
      { key: 'max',   label: 'Top speed',      unit: 'kt',  dp: 1,
        get: function (r) { return r.maxSpeedMs != null ? r.maxSpeedMs * KT : null; } },
      { key: 'top20', label: 'Best 20% speed', unit: 'kt',  dp: 1,
        get: function (r) { return r.sogTop20Ms != null ? r.sogTop20Ms * KT : null; } },
      { key: 'top50', label: 'Best 50% speed', unit: 'kt',  dp: 1,
        get: function (r) { return r.sogTop50Ms != null ? r.sogTop50Ms * KT : null; } },
      { key: 'avg',   label: 'Average speed (moving)', unit: 'kt', dp: 1,
        get: function (r) { return r.avgSpeedMovingMs ? r.avgSpeedMovingMs * KT : null; } },
      { key: 'dist',  label: 'Distance',       unit: 'km',  dp: 2,
        get: function (r) { return r.distanceM != null ? r.distanceM / 1000 : null; } },
      { key: 'foil',  label: 'Foiling time',   unit: 'min', dp: 0,
        get: function (r) { return r.activeTimeSec != null ? r.activeTimeSec / 60 : null; } },
      { key: 'tacks', label: 'Tacks',          unit: '',    dp: 0,
        get: function (r) { return r.tackCount != null ? r.tackCount : null; } },
      { key: 'gybes', label: 'Gybes',          unit: '',    dp: 0,
        get: function (r) { return r.gybeCount != null ? r.gybeCount : null; } },
      { key: 'turns', label: 'Turns total',    unit: '',    dp: 0,
        get: function (r) { return r.maneuverTotal != null ? r.maneuverTotal : null; } },
      { key: 'eff',   label: 'Turn efficiency', unit: '',   dp: 0,
        get: function (r) { return r.avgEfficiency != null ? r.avgEfficiency : null; } },
      { key: 'sps',   label: 'Performance score', unit: '', dp: 0,
        get: function (r) { return r.vpsOverall != null ? r.vpsOverall : null; } }
    ];
    /* §510 (옥대표 "세션 숫자는 6인데 그래프가 안나와") —
       고른 지표에 값이 하나도 없으면 빈 그래프가 그려진다. 사용자는
       고장난 걸로 읽는다. 오래된 기록에는 없는 필드가 있기 때문이다
       (그 기록을 저장할 때 아직 그 필드가 없었다).
       → **값이 2개 이상 있는 지표만** 메뉴에 올리고, 고른 지표가
       비어 있으면 그렇다고 말한다. */
    function metricCount(def) {
      var n = 0;
      for (var i = 0; i < pts.length; i++) {
        var v = def.get(pts[i]);
        if (v != null && isFinite(v)) n++;
      }
      return n;
    }
    var METRIC_STATE = TREND_METRICS.map(function (d) {
      return { def: d, n: metricCount(d) };
    });
    var AVAIL = METRIC_STATE.filter(function (m) { return m.n >= 2; });
    function metricDef(k) {
      for (var i = 0; i < TREND_METRICS.length; i++) {
        if (TREND_METRICS[i].key === k) return TREND_METRICS[i];
      }
      return TREND_METRICS[0];
    }
    /* 고른 지표가 비어 있으면 값이 있는 첫 지표로 옮긴다 */
    if (AVAIL.length && !AVAIL.some(function (m) { return m.def.key === TREND.metric; })) {
      TREND.metric = AVAIL[0].def.key;
    }
    var md = metricDef(TREND.metric);

    var c2 = el('div', 'card mt-3');
    var h2 = el('div', 'card-header');
    h2.appendChild(el('h3', 'card-title', 'Season trend'));
    var act2 = el('div', 'card-actions d-flex align-items-center gap-2');
    var msel = el('select', 'form-select form-select-sm');
    msel.style.width = 'auto';
    METRIC_STATE.forEach(function (st) {
      var m = st.def;
      /* 점이 1개면 선이 안 그려진다 — '있다' 로 치면 안 된다(§510) */
      var have = st.n >= 2;
      var o = document.createElement('option');
      o.value = m.key;
      o.textContent = m.label
        + (have ? '' : (st.n === 1 ? ' — only 1 session has it' : ' — not stored yet'));
      o.disabled = !have;
      if (m.key === md.key) o.selected = true;
      msel.appendChild(o);
    });
    msel.addEventListener('change', function () {
      TREND.metric = msel.value; renderSessions();
    });
    act2.appendChild(msel);

    /* §520 V2 — 장비별로 갈라 본다. **이게 V2 를 하는 이유다**: 세션에
       장비를 붙이는 목적은 목록에 한 줄 더 쓰는 게 아니라 "6.0 이랑 5.0
       중 뭐가 나았나" 를 물을 수 있게 하는 것이다.
       ⚠ 장비가 적힌 세션이 2개 미만이면 메뉴를 안 띄운다 — 고를 게
       하나뿐인 필터는 고장으로 보인다. */
    var gearKeyOf = function (r) {
      var g = r.gear;
      if (!g) return null;
      if (g.handWingName) return g.handWingName;
      if (g.wingM2 != null) return g.wingM2 + ' m\u00b2';
      return null;
    };
    var gearKeys = {};
    pts.forEach(function (r) { var k = gearKeyOf(r); if (k) gearKeys[k] = (gearKeys[k] || 0) + 1; });
    var gearList = Object.keys(gearKeys).sort();
    if (gearList.length >= 2) {
      var gsel = el('select', 'form-select form-select-sm');
      gsel.style.width = 'auto';
      var oAll = document.createElement('option');
      oAll.value = ''; oAll.textContent = 'Any gear';
      gsel.appendChild(oAll);
      gearList.forEach(function (k) {
        var o = document.createElement('option');
        o.value = k; o.textContent = k + ' (' + gearKeys[k] + ')';
        /* 점이 1개면 선이 안 그려진다 — §510 과 같은 규칙 */
        o.disabled = gearKeys[k] < 2;
        if (k === TREND.gear) o.selected = true;
        gsel.appendChild(o);
      });
      gsel.addEventListener('change', function () {
        TREND.gear = gsel.value || null; renderSessions();
      });
      act2.appendChild(gsel);
    } else if (TREND.gear) {
      TREND.gear = null;               /* 고를 게 없어졌으면 필터를 푼다 */
    }
    if (TREND.gear) {
      pts = pts.filter(function (r) { return gearKeyOf(r) === TREND.gear; });
    }
    var unlabelled = 0;
    pts.forEach(function (r) { if (!gearKeyOf(r)) unlabelled++; });

    act2.appendChild(el('span', 'lab', pts.length + ' sessions'));
    h2.appendChild(act2);
    c2.appendChild(h2);
    var b2 = el('div', 'card-body');
    var plot = el('div', 'chart-host'); plot.id = 'chart-season';
    b2.appendChild(plot);

    var usable = pts.filter(function (r) { return md.get(r) != null; });
    if (usable.length < 2) {
      if (plot.parentNode) plot.parentNode.removeChild(plot);
      b2.appendChild(el('div', 'text-secondary',
        'Only ' + usable.length + ' session has this metric stored. Older sessions were '
        + 'saved before it existed — save a session again and it fills in.'));
      c2.appendChild(b2); host.appendChild(c2);
      return;
    }
    /* x 가 겹치면 uPlot 이 아무것도 안 그린다 — 같은 날 다른 세션이면 밀어 준다 */
    var xs = [], lastX = -Infinity, badX = 0;
    usable.forEach(function (r) {
      var x = Number(r.dateEpoch) / 1000;
      if (!isFinite(x)) { badX++; return; }
      if (x <= lastX) x = lastX + 1;
      xs.push(x); lastX = x;
    });
    var ys = usable.filter(function (r) { return isFinite(Number(r.dateEpoch)); })
                   .map(function (r) { return md.get(r); });

    /* x 가 숫자가 아니면 uPlot 은 **아무 말 없이** 축만 그리고 선을 안 그린다.
       y 축은 데이터에서 정상으로 잡히기 때문에 "그래프가 안 나온다" 로만
       보이고 원인이 화면에 없다 — 실제로 그렇게 한참 헤맸다(dateEpoch 이
       ISO 문자열로 저장된 세션들). 그러니 침묵하지 않는다. */
    if (xs.length < 2) {
      if (plot.parentNode) plot.parentNode.removeChild(plot);  /* 빈 상자를 남기지 않는다 */
      b2.appendChild(el('div', 'text-secondary',
        badX
          ? 'These sessions were saved with a broken date, so they cannot be '
            + 'placed on a timeline. Re-saving each one fixes it \u2014 open it '
            + 'from the list above and press Save session.'
          : 'Not enough sessions with a usable date to draw a trend.'));
      c2.appendChild(b2); host.appendChild(c2);
      return;
    }

    var foot = el('div', 'text-secondary mt-2');
    foot.style.fontSize = '.8125rem';
    foot.textContent = (md.key === 'top20' || md.key === 'top50')
      ? 'Time-weighted mean of your fastest ' + (md.key === 'top20' ? '20' : '50')
        + '% of riding time. Stops, drifting and recording gaps are out by construction '
        + '— a long rest cannot drag this number down.'
      : (md.key === 'avg'
          ? 'Averaged over moving time only, so stops do not count against you.'
          : 'Computed over analysed time — recording gaps and any stretches you '
            + 'removed are already excluded.');
    b2.appendChild(foot);
    /* §520 — 장비가 안 적힌 세션이 있으면 그렇다고 말한다. 이걸 안 적으면
       '장비별로 보기' 메뉴가 왜 안 뜨는지(또는 왜 세션이 적은지) 알 수
       없다. 비교는 라벨이 붙은 만큼만 가능하다. */
    if (unlabelled) {
      var un = el('div', 'text-secondary mt-1');
      un.style.fontSize = '.8125rem';
      /* 수·동사는 **라벨 없는 개수**를 따라간다. 분모(pts.length)를 따라가면
         "1 of these 6 sessions have" 처럼 어긋난다(실측). */
      un.textContent = unlabelled + ' of these ' + pts.length + ' sessions '
        + (unlabelled > 1 ? 'have' : 'has') + ' no gear recorded, so '
        + (unlabelled > 1 ? 'they cannot' : 'it cannot') + ' be compared by '
        + 'wing or foil. Add it from the list above \u2014 the row shows an '
        + '"add gear" button.';
      b2.appendChild(un);
    }
    c2.appendChild(b2); host.appendChild(c2);

    track(new uPlot({
      width: plot.clientWidth || 800, height: 260, padding: [12, 14, 4, 6],
      cursor: { drag: { x: true, y: false } },
      axes: [
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace' },
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 46 }
      ],
      series: [
        {},
        { label: md.label, stroke: THEME.accent, width: 2,
          fill: 'rgba(77,171,247,0.14)', points: { show: true, size: 7 },
          value: function (u, v) {
            return v == null ? '—'
              : v.toFixed(md.dp) + (md.unit ? ' ' + md.unit : '');
          } }
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
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return v.toFixed(0) + ' kt'; }); } },
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
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
  /* §496 A2 (옥대표) — 회전을 고를 때마다 목록이 1번으로 되돌아갔다.
     renderTurnExtras 가 카드를 통째로 다시 만들면서 스크롤이 0 이 된다.
     95개 중 90번째를 보다가 하나 고르면 처음으로 튕기니 비교가 불가능했다.
     다시 그리기 전에 스크롤 위치를 재고, 그린 뒤에 되돌린다. */
  function renderTurnExtras(a) {
    var host = $('turn-extra');
    var listWrap = document.getElementById('turn-list');
    var keepTop = null;
    if (listWrap) {
      var sc = listWrap.querySelector('.table-responsive');
      if (sc) keepTop = sc.scrollTop;
    }
    while (host.firstChild) host.removeChild(host.firstChild);
    TURN_KEEP_SCROLL = keepTop;
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
      var lgP = el('span', 'num'); lgP.appendChild(sideTag('P', 'Port ' + p));
      var lgS = el('span', 'num'); lgS.appendChild(sideTag('S', sName + ' ' + sVal));
      lg.appendChild(lgP); lg.appendChild(lgS);
      b.appendChild(lg);
      card.appendChild(b); col.appendChild(card); return col;
    }
    row.appendChild(distCard('Tacks by side', counts.tackP, 'Starboard', counts.tackS));
    row.appendChild(distCard('Gybes by side', counts.gybeP, 'Starboard', counts.gybeS));
    host.appendChild(row);

    /* §507 (V17) — 방향별 집계. 개별 목록보다 위에 둔다: '어느 쪽으로
       도는 걸 못 하는가' 가 목록에서 눈으로 찾아지지 않기 때문이다. */
    try { renderTurnDirection(host, a); } catch (e) {}

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
    /* §518 (옥대표 "모두 한번에 선택하는 기능") — 지금 **걸린 필터에
       보이는 것 전부**를 고른다. 전체가 아니라 보이는 것이라야 뜻이
       있다: 'Gybes · Port 27개' 를 골라 밴드와 궤적을 한 번에 보는 게
       목적이지, 안 보이는 38개까지 섞는 건 목적이 아니다.
       이미 다 골라져 있으면 같은 버튼이 해제로 바뀐다 — 버튼 두 개를
       두면 둘 중 어느 게 지금 상태인지 매번 읽어야 한다. */
    var viewIdx = view.map(function (d) { return d.i; });
    var allPicked = viewIdx.length > 0 && viewIdx.every(function (i) {
      return TURNSEL.indexOf(i) >= 0;
    });
    if (viewIdx.length) {
      var selAll = el('button', 'btn btn-sm '
        + (allPicked ? 'btn-primary' : 'btn-outline-secondary'),
        allPicked ? 'Clear ' + viewIdx.length : 'Select all ' + viewIdx.length);
      selAll.type = 'button';
      selAll.title = allPicked
        ? 'Deselect these ' + viewIdx.length + ' turns'
        : 'Select every turn the current filter shows';
      selAll.addEventListener('click', function () {
        if (allPicked) {
          /* 보이는 것만 뺀다 — 필터 밖에서 고른 것은 건드리지 않는다.
             ⚠ 재할당하지 않고 제자리에서 지운다. TURNSEL 은 다른 곳에서
             .length=0 · .push 로 **같은 배열을 계속 쓰는** 전제다. */
          var keep = TURNSEL.filter(function (i) { return viewIdx.indexOf(i) < 0; });
          TURNSEL.length = 0;
          keep.forEach(function (i) { TURNSEL.push(i); });
        } else {
          viewIdx.forEach(function (i) {
            if (TURNSEL.indexOf(i) < 0) TURNSEL.push(i);
          });
        }
        renderTurnExtras(a);
      });
      act2.appendChild(selAll);
    }
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
      var tdSide = el('td');
      tdSide.appendChild(sideTag(m.side,
        m.side === 'P' ? 'Port' : m.side === 'S' ? 'Stbd' : '\u2014'));
      tr.appendChild(tdSide);
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
    /* §496 — 다시 그린 뒤 스크롤을 되돌린다. DOM 에 붙은 다음이라야
       scrollTop 이 먹으므로 다음 프레임에 넣는다. */
    if (TURN_KEEP_SCROLL != null) {
      var keep = TURN_KEEP_SCROLL;
      /* 레이아웃이 끝나야 scrollTop 이 먹는다 — rAF 한 번으로는 아직
         높이가 0 이라 0 으로 잘린다. 붙은 뒤 한 박자 늦춘다. */
      setTimeout(function () {
        wrap.scrollTop = keep;
        if (wrap.scrollTop === 0 && keep > 0) {
          setTimeout(function () { wrap.scrollTop = keep; }, 60);
        }
      }, 0);
    }
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

  /* ============================================================
   * §507 회전 **방향**별 집계 (V17)
   *
   * 우리는 회전을 `m.side` 로만 묶어 왔다. 그건 **어느 택에 있었나**이지
   * **어느 쪽으로 돌았나**가 아니다. 밴티지는 Port→Stbd 와 Stbd→Port 를
   * 갈라 보고, 그 격차가 Tack bias 보다 훨씬 컸다(16% vs 4%).
   *
   * 우리 데이터에서도 그렇다. 강릉 샘플:
   *   자이브 P→S  손실  0% · 회복  4.3초
   *   자이브 S→P  손실 55% · 회복 21.6초   ← 같은 자이브인데 딴판
   * 이건 '스타보드가 느리다' 가 아니라 **'왼쪽으로 도는 자이브를 못 한다'**
   * 는 뜻이고, 연습할 대상이 완전히 다르다.
   *
   * 방향은 headingBefore/headingAfter 를 풍향에 대고 판정한다 —
   * m.side 에 의존하지 않는다(그건 탈출 택이다).
   *
   * ⚠ 한 세션의 그룹당 표본은 보통 3~8개다. 개수를 반드시 같이 보여 주고,
   *   너무 적으면 단정하지 않는다.
   * ============================================================ */

  var TURNDIR_MIN_N = 3;

  function turnDirGroups(a, windDir) {
    var mans = (a && a.maneuvers) || [];
    if (windDir == null || !window.RDWindConfirm) return null;
    var g = {};
    mans.forEach(function (m) {
      if (m.headingBefore == null || m.headingAfter == null) return;
      var from = RDWindConfirm.tackOf(m.headingBefore, windDir);
      var to = RDWindConfirm.tackOf(m.headingAfter, windDir);
      if (from === to) return;              /* 택이 안 바뀌었으면 회전이 아니다 */
      var key = m.type + ':' + from + to;
      if (!g[key]) {
        g[key] = { key: key, type: m.type, from: from, to: to, n: 0,
                   loss: [], minSpd: [], rate: [], rec: [], eff: [] };
      }
      var b = g[key];
      b.n++;
      if (m.lossDisplayPct != null && isFinite(m.lossDisplayPct)) b.loss.push(m.lossDisplayPct);
      if (m.minSpeedMs != null) b.minSpd.push(m.minSpeedMs * KT);
      if (m.avgTurnRateDegSec != null) b.rate.push(m.avgTurnRateDegSec);
      if (m.recoverySec != null) b.rec.push(m.recoverySec);
      if (m.efficiency != null && isFinite(m.efficiency)) b.eff.push(m.efficiency);
    });
    function avg(x) {
      if (!x.length) return null;
      var s = 0; for (var i = 0; i < x.length; i++) s += x[i];
      return s / x.length;
    }
    return Object.keys(g).map(function (k) {
      var b = g[k];
      b.avgLoss = avg(b.loss); b.avgMin = avg(b.minSpd);
      b.avgRate = avg(b.rate); b.avgRec = avg(b.rec); b.avgEff = avg(b.eff);
      return b;
    }).sort(function (x, y) {
      if (x.type !== y.type) return x.type === 'tack' ? -1 : 1;
      return x.from < y.from ? -1 : 1;
    });
  }

  /* 같은 종류(택끼리·자이브끼리)의 두 방향을 비교해 격차를 말한다.
     '어느 택이 빠른가' 가 아니라 '어느 쪽으로 도는 걸 못 하는가' 다. */
  function turnDirFinding(groups) {
    var out = [];
    ['tack', 'gybe'].forEach(function (t) {
      var pair = groups.filter(function (g) { return g.type === t; });
      if (pair.length !== 2) return;
      var a1 = pair[0], b1 = pair[1];
      if (a1.n < TURNDIR_MIN_N || b1.n < TURNDIR_MIN_N) return;
      if (a1.avgLoss == null || b1.avgLoss == null) return;
      var worse = a1.avgLoss > b1.avgLoss ? a1 : b1;
      var better = worse === a1 ? b1 : a1;
      var gap = worse.avgLoss - better.avgLoss;
      if (gap < 8) return;                  /* 8%p 미만이면 굳이 말하지 않는다 */
      var label = function (g) {
        return (g.from === 'P' ? 'port' : 'starboard') + ' to '
             + (g.to === 'P' ? 'port' : 'starboard');
      };
      var line = 'Your ' + (t === 'tack' ? 'tacks' : 'gybes') + ' turning '
        + label(worse) + ' lose ' + Math.round(worse.avgLoss) + '% against '
        + Math.round(better.avgLoss) + '% the other way'
        + (worse.avgRec != null && better.avgRec != null
            ? ', and take ' + worse.avgRec.toFixed(1) + ' s to recover against '
              + better.avgRec.toFixed(1) + ' s'
            : '')
        + '. That is a turning-direction problem, not a tack-speed one — '
        + 'the two are different things to practise.';
      out.push({ text: line, n: Math.min(worse.n, better.n) });
    });
    return out;
  }

  function renderTurnDirection(host, a) {
    var wd = a.windDir;
    var groups = turnDirGroups(a, wd);
    if (!groups || !groups.length) return;

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Which way you turn'));
    head.appendChild(el('div', 'card-actions lab', 'entry tack → exit tack'));
    card.appendChild(head);
    var body = el('div', 'card-body');
    body.appendChild(el('div', 'text-secondary mb-2',
      'Grouped by the direction of the turn, not by which tack you were on. '
      + 'A rider can be fine turning one way and poor the other — that is a '
      + 'different thing to fix than being slow on one tack.'));

    var wrap = el('div', 'table-responsive');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Turn', 'Count', 'Avg loss', 'Lowest speed', 'Turn rate', 'Recovery']
      .forEach(function (x, i) { htr.appendChild(el('th', i ? 'text-end' : null, x)); });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');
    groups.forEach(function (g) {
      var tr = el('tr');
      var name = (g.type === 'tack' ? 'Tack' : 'Gybe') + '  '
        + (g.from === 'P' ? 'port' : 'stbd') + ' → '
        + (g.to === 'P' ? 'port' : 'stbd');
      tr.appendChild(el('td', null, name));
      var cn = el('td', 'text-end num', String(g.n));
      if (g.n < TURNDIR_MIN_N) cn.style.color = THEME.warn;
      tr.appendChild(cn);
      tr.appendChild(el('td', 'text-end num',
        g.avgLoss == null ? '—' : Math.round(g.avgLoss) + '%'));
      tr.appendChild(el('td', 'text-end num',
        g.avgMin == null ? '—' : g.avgMin.toFixed(1) + ' kt'));
      tr.appendChild(el('td', 'text-end num',
        g.avgRate == null ? '—' : g.avgRate.toFixed(1) + '°/s'));
      tr.appendChild(el('td', 'text-end num',
        g.avgRec == null ? '—' : g.avgRec.toFixed(1) + ' s'));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);

    var findings = turnDirFinding(groups);
    findings.forEach(function (f) {
      var box = el('div', 'alert alert-info mt-3');
      box.appendChild(el('div', null, f.text));
      if (f.n < 5) {
        box.appendChild(el('div', 'mt-1',
          '⚠ Only ' + f.n + ' turns in the smaller group — worth watching '
          + 'across a few sessions before calling it a pattern.'));
      }
      body.appendChild(box);
    });

    if (groups.some(function (g) { return g.n < TURNDIR_MIN_N; })) {
      body.appendChild(el('div', 'lab mt-2',
        'Counts in amber have fewer than ' + TURNDIR_MIN_N
        + ' turns — those rows are shown but not compared.'));
    }

    card.appendChild(body);
    host.appendChild(card);
  }

  /* §454 선택한 회전 — 표에서 고른 회전들의 상세.
     하나면 지표 전부, 여럿이면 나란히 비교. 속도 곡선은 회전 정점(apex)
     을 0 초로 맞춰 겹친다 — 시각이 다른 회전을 같은 자로 보려면 정점을
     맞춰야 한다. */
  /* ============================================================
   * §502 Tack Bias — 포트/스타보드 비대칭을 **한 숫자로** (V10)
   *
   * §420·§421 이 통째로 이 얘기였는데 우리는 이름 없는 표 두 칸으로만
   * 줬다. 밴티지는 이름을 붙이고 Diff 한 숫자로 요약한다 — 그래야
   * 시즌 추이로 추적할 수 있는 지표가 된다.
   *
   * 밴티지보다 두 가지를 더한다:
   *
   * ① **원인을 자동으로 가른다.** 밴티지는 지표를 사람이 갈아끼우며
   *    스스로 알아내야 한다. 옥대표 세션에서 SOG 는 −0.9%(사실상 없음)
   *    인데 VMG 는 −11.2%, CWA 는 +12.0% 였다 → 속도가 아니라 **각도**
   *    문제이고 스타보드에서 5.5° 더 벌린다. 이 추론을 카드가 한다.
   *
   * ② **풍향 오차 경고.** 이게 §421 의 교훈이고 밴티지엔 없다.
   *    풍향을 δ 만큼 잘못 넣으면 한쪽 CWA 는 +δ, 반대쪽은 −δ 가 되어
   *    **측정 차이 = 진짜 차이 + 2δ** 가 된다. 즉 CWA 차이 D° 는
   *    풍향이 D/2° 만 틀려도 통째로 설명된다. 이 숫자를 같이 보여
   *    주지 않으면 있지도 않은 비대칭을 연습하게 된다.
   *
   * 색은 파랑(중립)이다 — 어느 택이 빠른 건 좋고 나쁨이 아니다.
   * ============================================================ */

  var TACKBIAS = { metric: 'sog', mode: 'upwind', tier: 'avg' };

  /* 이 카드만 다시 그린다 — 탭 전체를 다시 그리면 스크롤이 맨 위로 튄다 */
  function renderTackBiasRefresh(a) {
    var h = $('tackbias-host');
    if (!h) return;
    while (h.firstChild) h.removeChild(h.firstChild);
    try { renderTackBias(h, a); } catch (e) {}
  }

  var TB_METRICS = [
    { id: 'sog',  label: 'Speed' },
    { id: 'vmg',  label: 'VMG' },
    { id: 'twa',  label: 'CWA' },
    { id: 'awa',  label: 'AWA' },
    { id: 'heel', label: 'Heel' },
    { id: 'hr',   label: 'HR' }
  ];

  /* rows 값은 기본 단위(속도 m/s)이고 unit 은 내부 키다 — §501 과 같은 규칙 */
  function tbFmt(r, tier) {
    if (!r) return null;
    var key = tier || TACKBIAS.tier || 'avg';
    var v = (key === 'avg') ? r.avg : r[key];
    if (v == null || !isFinite(v)) return null;
    if (r.unit === 'speed') return { v: v * KT, txt: (v * KT).toFixed(1), unit: 'kt' };
    if (r.unit === 'bpm') return { v: v, txt: String(Math.round(v)), unit: 'bpm' };
    return { v: v, txt: v.toFixed(1), unit: '°' };
  }
  function tbPick(rows, metric, mode, side) {
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.metric === metric && r.mode === mode && r.side === side) return r;
    }
    return null;
  }
  /* Diff = (Stbd − Port) / |Port| . 부호는 '스타보드가 어느 쪽인지' 만
     말한다. 좋고 나쁨이 아니므로 색을 입히지 않는다. */
  /* §524 %폭발 감사 — Waterspeed 에서 `Exit VMG +421.4%` 를 보고
     우리 코드를 뒤졌더니 **같은 결함이 여기 있었다.**
     가드가 1e-9 라서 0 으로 나누기만 막고, 뜻 없는 백분율은 그대로 낸다:
     Port VMG 0.3kt vs Starboard 2.0kt → **+567%**. 이건 정보가 아니다.

     기준은 "분모가 0 이 아니냐" 가 아니라 **"이 분모로 나눈 비율이
     읽을 만하냐"** 여야 한다. 단위별 바닥값을 두고, 그 아래면 백분율을
     내지 않는다 — 화면은 대신 절대 차이를 보여 준다. */
  var TB_PCT_FLOOR = {
    kt: 1.0,        /* 1kt 미만을 기준으로 한 % 는 뜻이 없다 */
    bpm: 40,        /* 심박이 40 아래면 측정 오류다 */
    deg: 5,         /* 각도 5° 미만 기준의 % 는 노이즈 */
    '': 0.5
  };
  function tbDiff(p, s, unit) {
    if (p == null || s == null || !isFinite(p) || !isFinite(s)) return null;
    var floor = TB_PCT_FLOOR[unit || ''];
    if (floor == null) floor = TB_PCT_FLOOR[''];
    if (Math.abs(p) < floor) return null;
    return (s - p) / Math.abs(p) * 100;
  }

  /* §524 W6 포일링 구조 (Waterspeed 벤치마킹).
     우리는 포일링 **시간과 비율**만 있었다. 그런데 같은 30분이라도
     "3분씩 열 번" 과 "안 떨어지고 30분" 은 전혀 다른 라이딩이고,
     후자가 실력이다. 몇 번 끊겼는지 · 가장 길게 버틴 게 얼마인지가
     그 차이를 드러낸다.

     우리가 더 하는 것: 그들은 숫자만 준다. 우리는 **끊긴 횟수가
     무엇을 뜻하는지** 같이 적는다 — 회전이 많은 세션은 원래 자주
     끊기므로, 회전 수로 나눈 값이 실제로 읽을 값이다. */
  function renderFoilStructure(host, a) {
    if (!window.RDSegments || !CUR.session) return;
    var S = CUR.session.samples || [];
    if (!S.length) return;
    var secs, sum;
    try {
      secs = RDSegments.foilSections(S, foilThresholdMs(), 2);
      sum = RDSegments.foilSummary(S, secs);
    } catch (e) { return; }
    if (!sum || !sum.count) return;

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'How the foiling was strung together'));
    head.appendChild(el('div', 'card-actions lab',
      'above ' + (foilThresholdMs() * KT).toFixed(0) + ' kt'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    var row = el('div', 'row g-2');
    function box(label, val, sub) {
      var c = el('div', 'col-6 col-md-3');
      var w = el('div', 'p-2 rounded');
      w.style.background = currentThemeName() === 'light'
        ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      w.appendChild(el('div', 'lab', label));
      w.appendChild(el('div', 'num fw-bold mt-1', val));
      if (sub) w.appendChild(el('div', 'lab', sub));
      c.appendChild(w); return c;
    }
    row.appendChild(box('Stretches', String(sum.count),
      'separate times up on foil'));
    row.appendChild(box('Longest', fmtClock(sum.longestSec),
      (sum.longestM / 1000).toFixed(2) + ' km'));
    row.appendChild(box('Average stretch', fmtClock(sum.totalSec / sum.count),
      (sum.totalM / sum.count / 1000).toFixed(2) + ' km each'));
    var turns = (a.maneuvers || []).length;
    row.appendChild(box('Per turn',
      turns ? (sum.count / turns).toFixed(2) : '\u2014',
      turns ? 'breaks per turn (' + turns + ' turns)' : 'no turns detected'));
    body.appendChild(row);

    /* 숫자만 두면 "13번 끊겼다" 가 나쁜 건지 알 수 없다.
       회전할 때 떨어지는 건 정상이고, **회전보다 많이 끊기는 것**이 신호다. */
    var note = el('div', 'text-secondary mt-2');
    note.style.fontSize = '.8125rem';
    if (turns) {
      var ratio = sum.count / turns;
      note.textContent = ratio <= 1.15
        ? 'You came off the foil about once per turn \u2014 that is what a clean '
          + 'session looks like, since a turn is where it normally happens. The '
          + 'number to grow is the longest stretch, not this one.'
        : 'You came off the foil ' + ratio.toFixed(1) + ' times per turn, so '
          + 'roughly ' + Math.round(sum.count - turns) + ' of these breaks were '
          + 'not at a turn \u2014 touchdowns in a straight line. That is a '
          + 'different fault from a bad gybe: it is height control or a foil '
          + 'that is loaded up, not turn technique.';
    } else {
      note.textContent = 'Longest unbroken stretch is the number worth growing \u2014 '
        + 'total foiling time can rise just from a longer session.';
    }
    body.appendChild(note);
    card.appendChild(body);
    host.appendChild(card);
  }

  function renderTackBias(host, a) {
    if (!An.computeStatsPanel) return;
    var sp = null;
    try { sp = An.computeStatsPanel(a); } catch (e) { sp = null; }
    if (!sp || !sp.rows || !sp.rows.length) return;
    var rows = sp.rows;

    /* 값이 있는 지표만 스위처에 올린다 — 빈 버튼은 누르게 만들고 실망시킨다 */
    var avail = TB_METRICS.filter(function (m) {
      return ['upwind', 'downwind'].some(function (md) {
        return tbFmt(tbPick(rows, m.id, md, 'P')) && tbFmt(tbPick(rows, m.id, md, 'S'));
      });
    });
    if (!avail.length) return;
    if (!avail.some(function (m) { return m.id === TACKBIAS.metric; })) {
      TACKBIAS.metric = avail[0].id;
    }

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Tack bias — port against starboard'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    /* 풍상/풍하 */
    var modeWrap = el('div', 'btn-group btn-group-sm mb-2');
    [['upwind', 'Upwind'], ['downwind', 'Downwind']].forEach(function (m) {
      var b = el('button', 'btn' + (TACKBIAS.mode === m[0] ? ' active' : ''), m[1]);
      b.type = 'button';
      b.addEventListener('click', function () { TACKBIAS.mode = m[0]; renderTackBiasRefresh(a); });
      modeWrap.appendChild(b);
    });
    body.appendChild(modeWrap);

    /* 지표 */
    var mWrap = el('div', 'btn-group btn-group-sm mb-3 ms-2');
    avail.forEach(function (m) {
      var b = el('button', 'btn' + (TACKBIAS.metric === m.id ? ' active' : ''), m.label);
      b.type = 'button';
      b.addEventListener('click', function () { TACKBIAS.metric = m.id; renderTackBiasRefresh(a); });
      mWrap.appendChild(b);
    });
    body.appendChild(mWrap);

    /* §503 (옥대표 "이게 오류일까 사실일까") — 모집단 스위치.
       기본이 **평균**이라 포일링 못 한 시간이 다 들어간다. 풍하에서
       흘러다닌 시간이 많으면 풍하 VMG 가 풍상만큼 낮게 깔려서
       "풍향이 틀렸나" 로 보인다. 좁혀 보면 갈린다 —
         TOP 20% 로 풍하가 확 오르면 → 평균 문제(정상)
         좁혀도 풍상≈풍하면    → 풍향 오차 의심
       엔진이 tier50·tier20 을 이미 준다(방향 판정까지 반영돼 있다). */
    var tWrap = el('div', 'btn-group btn-group-sm mb-3 ms-2');
    [['avg', 'All'], ['tier50', 'Best 50%'], ['tier20', 'Best 20%']].forEach(function (t) {
      var b = el('button', 'btn' + (TACKBIAS.tier === t[0] ? ' active' : ''), t[1]);
      b.type = 'button';
      b.addEventListener('click', function () { TACKBIAS.tier = t[0]; renderTackBiasRefresh(a); });
      tWrap.appendChild(b);
    });
    body.appendChild(tWrap);

    var pR = tbPick(rows, TACKBIAS.metric, TACKBIAS.mode, 'P');
    var sR = tbPick(rows, TACKBIAS.metric, TACKBIAS.mode, 'S');
    var pf = tbFmt(pR), sf = tbFmt(sR);
    if (!pf || !sf) {
      body.appendChild(el('div', 'alert alert-warning',
        'No ' + (TACKBIAS.mode === 'upwind' ? 'upwind' : 'downwind')
        + ' data for this metric.'));
      card.appendChild(body); host.appendChild(card); return;
    }
    var d = tbDiff(pf.v, sf.v, pf.unit);

    /* 한 줄 요약 — Port | Diff | Stbd */
    var row = el('div', 'd-flex align-items-center justify-content-between');
    function side(sd, label, val, unit) {
      var c = el('div', 'text-center');
      var lb = el('div', 'lab');
      lb.style.cssText = 'display:flex;align-items:center;justify-content:center';
      lb.appendChild(sideTag(sd, label));
      c.appendChild(lb);
      var v = el('div', 'kpi__val num mt-1', val);
      v.style.color = sideColor(sd) || '';
      c.appendChild(v);
      c.appendChild(el('div', 'lab', unit));
      return c;
    }
    row.appendChild(side('P', 'Port', pf.txt, pf.unit));
    var mid = el('div', 'text-center px-3');
    mid.appendChild(el('div', 'lab', 'Diff'));
    /* %가 뜻이 없으면(§524: 분모가 바닥값 미만) **절대 차이**를 보여 준다.
       "—" 만 띄우면 차이가 없다는 뜻으로 읽히는데, 실제로는 차이가 크고
       비율로 말할 수 없을 뿐이다. */
    var absDelta = (pf.v != null && sf.v != null) ? (sf.v - pf.v) : null;
    var dv = el('div', 'kpi__val num mt-1',
      d != null ? ((d > 0 ? '+' : '') + d.toFixed(1) + '%')
        : (absDelta != null
            ? ((absDelta > 0 ? '+' : '') + absDelta.toFixed(1) + ' ' + (pf.unit || ''))
            : '\u2014'));
    /* 중립 색 — 어느 택이 빠른 게 좋고 나쁨이 아니다 */
    dv.style.color = THEME.accent;
    mid.appendChild(dv);
    mid.appendChild(el('div', 'lab', d != null ? 'starboard vs port'
      : 'starboard vs port \u00b7 too small a base for %'));
    row.appendChild(mid);
    row.appendChild(side('S', 'Starboard', sf.txt, sf.unit));
    body.appendChild(row);

    /* 좌우 막대 — 중앙에서 벌어진 쪽이 큰 쪽 */
    if (d != null) {
      var barWrap = el('div', 'mt-3');
      barWrap.style.cssText = 'position:relative;height:10px;border-radius:5px;'
        + 'background:' + THEME.grid;
      var half = Math.max(-100, Math.min(100, d)) / 100;   /* −1..1 */
      var seg = el('div');
      var w = Math.min(50, Math.abs(half) * 50 * 4);       /* ±25% 를 꽉 차게 */
      seg.style.cssText = 'position:absolute;top:0;bottom:0;background:' + THEME.accent
        + ';border-radius:5px;'
        + (half >= 0 ? 'left:50%;' : 'right:50%;') + 'width:' + w + '%';
      barWrap.appendChild(seg);
      var mark = el('div');
      mark.style.cssText = 'position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;'
        + 'background:' + THEME.axisText;
      barWrap.appendChild(mark);
      body.appendChild(barWrap);
    }

    /* ① 원인 자동 분리 — 속도인가 각도인가 */
    var note = tbCauseNote(rows, TACKBIAS.mode);
    if (note) body.appendChild(el('div', 'alert alert-info mt-3', note));

    /* ②-a 위생 검사 — 풍하 VMG 가 풍상보다 크지 않으면 뭔가 잘못됐다.
       정상 세션은 풍하 VMG 가 풍상의 1.5~2.5배다. 비슷하거나 낮으면
       (ㄱ) 풍하에서 활주를 못 했거나 (ㄴ) 풍향이 크게 틀려 양쪽이 다
       사실은 리치이거나 — 둘 중 하나다. 스위치로 갈린다. */
    var sane = tbUpDownSanity(rows);
    if (sane) body.appendChild(sane);

    /* ② 풍향 오차 경고 — CWA 계열일 때만, 그리고 정량적으로 */
    if (TACKBIAS.metric === 'twa' || TACKBIAS.metric === 'awa') {
      var cwaP = tbFmt(tbPick(rows, 'twa', TACKBIAS.mode, 'P'));
      var cwaS = tbFmt(tbPick(rows, 'twa', TACKBIAS.mode, 'S'));
      if (cwaP && cwaS) {
        var degGap = Math.abs(cwaS.v - cwaP.v);
        var w2 = el('div', 'alert alert-warning mt-2');
        w2.appendChild(el('div', 'fw-bold', 'Read this one against your wind direction'));
        w2.appendChild(el('div', 'mt-1',
          'Getting the wind direction wrong by δ pushes one tack’s angle up by δ and '
          + 'the other down by δ, so the gap you see is the real gap plus 2δ. '
          + 'This ' + degGap.toFixed(1) + '° gap would be fully explained by a wind '
          + 'direction that is off by just ' + (degGap / 2).toFixed(1) + '°'
          + (CUR.est && CUR.est.confidence
              ? ' — the track estimate is ' + confLabel(CUR.est.confidence) + ' confidence'
              : '')
          + '. Confirm the wind before training this away.'));
        body.appendChild(w2);
      }
    }

    card.appendChild(body);
    host.appendChild(card);
  }

  /* 풍상/풍하 VMG 크기 비교 — 이 카드의 값이 믿을 만한지 먼저 본다.
     옥대표 세션에서 풍하 5.9 ≈ 풍상 5.7 이 나와 "오류인가" 질문이 나왔다.
     계산은 맞았고(속도 −4% + CWA 2.7° → VMG −14.7% 는 CWA 65~70° 에서
     성립한다), 이상한 건 **풍하가 풍상보다 안 크다는 것** 이었다. */
  function tbUpDownSanity(rows) {
    function both(mode) {
      var p = tbFmt(tbPick(rows, 'vmg', mode, 'P'));
      var s = tbFmt(tbPick(rows, 'vmg', mode, 'S'));
      if (!p || !s) return null;
      return (p.v + s.v) / 2;
    }
    var up = both('upwind'), dn = both('downwind');
    if (up == null || dn == null || up <= 0) return null;
    var ratio = dn / up;
    if (ratio >= 1.3) return null;          /* 정상 */
    var box = el('div', 'alert alert-warning mt-2');
    box.appendChild(el('div', 'fw-bold',
      'Downwind VMG is not clearly above upwind — read these numbers with care'));
    box.appendChild(el('div', 'mt-1',
      'Downwind VMG averages ' + dn.toFixed(1) + ' kt against ' + up.toFixed(1)
      + ' kt upwind (' + ratio.toFixed(2) + '\u00d7). On a session that was really '
      + 'sailed both ways this ratio is usually 1.5 to 2.5. Two things do this: '
      + 'time spent off the foil downwind, which drags the average down, or a wind '
      + 'direction that is well off, which turns both legs into reaches. '
      + 'Switch to Best 20% \u2014 if downwind jumps, it was the slow time; '
      + 'if it stays level with upwind, check the wind direction.'));
    return box;
  }

  /* 지표를 가로질러 원인을 가른다.

     ⚠ 처음엔 크기 비율만 봤다(|VMG%| 가 |속도%| 의 2배 이상이면 각도).
     옥대표 세션에서 속도 +2.8% · VMG −5.4% 였는데 2.8 < 5.4/2 = 2.7 이
     거짓이라 **경계에서 놓쳤다.** 그런데 이 경우는 사실 가장 확실한
     각도 신호다 — **부호가 반대**이기 때문이다. 한 택이 더 빠른데
     실효 전진은 반대 택이 낫다면, 빠른 쪽이 각도를 버리고 있다는 뜻이고
     달리 설명할 길이 없다. 그래서 부호 판정을 크기 판정보다 먼저 둔다. */
  function tbCauseNote(rows, mode) {
    function gap(metric) {
      var p = tbFmt(tbPick(rows, metric, mode, 'P'));
      var s = tbFmt(tbPick(rows, metric, mode, 'S'));
      if (!p || !s) return null;
      return { pct: tbDiff(p.v, s.v, p.unit), deg: s.v - p.v };
    }
    var sog = gap('sog'), vmg = gap('vmg'), cwa = gap('twa');
    if (!sog || !vmg || sog.pct == null || vmg.pct == null) return null;
    var aS = Math.abs(sog.pct), aV = Math.abs(vmg.pct);

    /* 둘 다 미미하면 '비대칭이 없다' 도 결론이다 */
    if (aS < 2 && aV < 3) {
      return 'Both tacks are within a couple of percent on speed and VMG — no '
           + 'meaningful bias to work on ' + (mode === 'upwind' ? 'upwind' : 'downwind') + '.';
    }

    function wider() {
      if (!cwa || cwa.deg == null) return '';
      return ' You sail ' + Math.abs(cwa.deg).toFixed(1) + '\u00b0 wider on '
           + (cwa.deg > 0 ? 'starboard' : 'port')
           + (mode === 'upwind' ? ', and that is where the VMG goes.'
                                : ', which costs downwind VMG the same way.');
    }

    /* ★ 부호가 반대 — 가장 확실한 각도 신호 */
    if (aS >= 1 && aV >= 2 && (sog.pct > 0) !== (vmg.pct > 0)) {
      return 'You are ' + aS.toFixed(1) + '% faster on '
        + (sog.pct > 0 ? 'starboard' : 'port')
        + ' but your VMG is ' + aV.toFixed(1) + '% better on '
        + (vmg.pct > 0 ? 'starboard' : 'port')
        + ' — the two point opposite ways, which only happens when the faster tack '
        + 'is giving up angle.' + wider();
    }

    /* 같은 방향인데 VMG 가 훨씬 크게 벌어짐 → 여전히 각도 쪽 */
    if (aV >= 3 && aS < aV * 0.6) {
      return 'Speed is close on both tacks (' + (sog.pct > 0 ? '+' : '')
        + sog.pct.toFixed(1) + '%) but VMG differs by ' + aV.toFixed(1)
        + '% — that gap is coming from angle, not boat speed.' + wider();
    }

    /* 같은 방향이고 크기도 비슷 → 속도 차이 */
    if (aS >= 2) {
      return 'You are ' + aS.toFixed(1) + '% faster on '
        + (sog.pct > 0 ? 'starboard' : 'port')
        + ' and the VMG follows it (' + aV.toFixed(1)
        + '%) — this reads as a speed difference rather than an angle one.';
    }
    return null;
  }

  var TURNSEL = [];
  /* §490 — 시즌 흐름에서 고른 지표 */
  /* §520 — gear 는 시즌 흐름의 장비 필터(null = 전체) */
  var TREND = { metric: 'max', gear: null };
  /* §488 — 회전 목록 그룹 필터 (종류 × 택 방향) */
  var TURNFILT = { type: 'all', side: 'all' };
  /* §496 — 회전 목록을 다시 그릴 때 유지할 스크롤 위치 */
  var TURN_KEEP_SCROLL = null;

  /* §496 — 회전 위치 미니 지도. Leaflet 인스턴스를 들고 있다가 다시
     그릴 때 지운다(안 지우면 컨테이너가 재사용돼 "already initialized"). */
  var turnMiniMap = null;
  function renderTurnMiniMap(host, a, selIdx) {
    if (!window.L || !CUR.session) { host.style.display = 'none'; return; }
    var S = CUR.session.samples || [];
    var mans = a.maneuvers || [];
    if (!S.length || !mans.length) { host.style.display = 'none'; return; }
    if (turnMiniMap) { try { turnMiniMap.remove(); } catch (e) {} turnMiniMap = null; }

    var pts = S.filter(function (p) { return p && isFinite(p.lat) && isFinite(p.lng); });
    if (pts.length < 2) { host.style.display = 'none'; return; }
    var map = L.map(host, { zoomControl: false, attributionControl: false });
    turnMiniMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    /* 트랙은 배경 — 주인공은 회전 점이다 */
    var step = Math.max(1, Math.floor(pts.length / 1500));
    var line = [];
    for (var i = 0; i < pts.length; i += step) line.push([pts[i].lat, pts[i].lng]);
    L.polyline(line, { color: THEME.dim, weight: 1.5, opacity: 0.45 }).addTo(map);

    var selSet = {};
    selIdx.forEach(function (i) { selSet[i] = true; });
    var selLatLng = [];
    mans.forEach(function (m, k) {
      var idx = m.apexIdx != null ? m.apexIdx : m.startIdx;
      var p = S[idx];
      if (!p || !isFinite(p.lat) || !isFinite(p.lng)) return;
      var on = !!selSet[k];
      var col = m.type === 'gybe' ? THEME.gybe : THEME.accent;
      var mk = L.circleMarker([p.lat, p.lng], {
        radius: on ? 8 : 3.5,
        color: on ? col : THEME.dim,
        weight: on ? 2.5 : 1,
        opacity: on ? 1 : 0.6,
        fillColor: col,
        fillOpacity: on ? 0.9 : 0.25
      }).addTo(map);
      mk.bindTooltip((m.type === 'gybe' ? 'Gybe' : 'Tack') + ' #' + (k + 1)
        + ' · ' + fmtClock(m.tSec), { direction: 'top' });
      /* 지도 → 목록: 점을 누르면 그 회전을 고른다(토글) */
      mk.on('click', function () {
        var pos = TURNSEL.indexOf(k);
        if (pos < 0) TURNSEL.push(k); else TURNSEL.splice(pos, 1);
        renderTurnExtras(a);
        scrollTurnRowIntoView(k);
      });
      if (on) selLatLng.push([p.lat, p.lng]);
    });

    /* 고른 회전이 보이도록 맞춘다 — 하나면 그 주변, 여럿이면 전부 */
    function fit() {
      try {
        if (selLatLng.length === 1) map.setView(selLatLng[0], 16);
        else if (selLatLng.length > 1) map.fitBounds(selLatLng, { padding: [30, 30] });
        else {
          var la = pts.map(function (p) { return p.lat; });
          var ln = pts.map(function (p) { return p.lng; });
          map.fitBounds([[Math.min.apply(null, la), Math.min.apply(null, ln)],
                         [Math.max.apply(null, la), Math.max.apply(null, ln)]],
                        { padding: [20, 20] });
        }
      } catch (e) {}
    }
    fit();
    /* 숨은 탭에서 만들어지면 크기가 0 — 다시 재고 다시 맞춘다(§486·§491) */
    setTimeout(function () { try { map.invalidateSize(); fit(); } catch (e) {} }, 60);
  }

  /* 목록에서 그 회전 행을 보이게 스크롤 */
  function scrollTurnRowIntoView(turnIdx) {
    setTimeout(function () {
      var host = document.getElementById('turn-list');
      if (!host) return;
      var rows = host.querySelectorAll('tbody tr');
      for (var i = 0; i < rows.length; i++) {
        var first = rows[i].querySelector('td');
        if (first && first.textContent.trim() === String(turnIdx + 1)) {
          rows[i].scrollIntoView({ block: 'nearest' });
          return;
        }
      }
    }, 30);
  }

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

    /* §496 A1 (옥대표) — 고른 회전이 **어디서** 일어났는지.
       "해당하는 메뉴버가 어디서 일어난건지 확인이 가능해."
       Track 탭 지도는 다른 탭이라 회전을 고르는 순간 안 보인다. 그래서
       상세 카드 안에 작은 지도를 둔다 — 트랙 전체를 흐리게 깔고, 고른
       회전만 강조, 나머지 회전은 작은 점으로. 점을 누르면 그 회전으로
       선택이 옮겨간다(목록과 지도가 같은 것을 가리키게). */
    var miniHost = el('div');
    /* 옥대표 (2026-09-04) "지도를 2배로 키우고" — 220 → 440px.
       회전이 **어디서** 났는지가 이 카드의 요점인데 220px 에서는 트랙이
       뭉쳐 보여 위치를 못 읽었다. 화면이 좁으면 그만큼 줄인다. */
    miniHost.style.cssText =
      'height:min(440px, 52vh);min-height:260px;border-radius:4px;'
      + 'overflow:hidden;margin-bottom:12px';
    body.appendChild(miniHost);
    renderTurnMiniMap(miniHost, a, sel);

    if (picked.length === 1) {
      var m = picked[0];
      var grid = el('div', 'row row-cards');
      function cell(label, val, sub) {
        var col = el('div', 'col-6 col-md-3');
        var c = el('div', 'card'), b = el('div', 'card-body');
        b.appendChild(el('div', 'lab', label));
        /* 옥대표 "지도아래 숫자 사이즈를 조금 줄이는게" — 지도를 키운 만큼
           숫자가 화면을 잡아먹는다. 상단 KPI(1.75rem)와 구분되게 한 단계
           낮춘 전용 클래스를 쓴다(전역 kpi__val 을 건드리면 헤더 KPI 까지
           같이 작아진다). */
        b.appendChild(el('div', 'turn__val num mt-1', val));
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
        var tdS2 = el('td');
        tdS2.appendChild(sideTag(m.side,
          m.side === 'P' ? 'Port' : m.side === 'S' ? 'Stbd' : '\u2014'));
        tr.appendChild(tdS2);
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

    /* 속도 곡선 — apex 를 0 으로 맞춰 겹친다.
       §497: 뒤에 비교 밴드를 깔기 때문에 높이를 키웠다(220 → 300). */
    var plotHost = el('div', 'chart-host mt-3');
    plotHost.style.height = '300px';
    body.appendChild(plotHost);
    var capHost = el('div', 'lab mt-1');
    body.appendChild(capHost);
    card.appendChild(body);
    host.appendChild(card);
    var info = drawTurnCurves(plotHost, picked, sel, a);
    /* 밴드가 무엇인지 말해 주지 않으면 회색 띠는 장식이 된다 */
    if (info && info.banded) {
      capHost.textContent =
        'Shaded band = the middle half (25\u201375%) of your ' + info.poolN + ' '
        + info.poolLabel + ' this session, dashed line = the median. '
        + (info.collapsed
            ? 'Too many turns selected to draw individually \u2014 showing their median instead.'
            : 'A selected line above the band is a better-than-usual turn.');
    } else if (info) {
      capHost.textContent = 'Not enough comparable turns for a band '
        + '(needs at least 3), so only the selected turns are drawn.';
    }

    /* §515 V11 — 같은 회전을 **위에서** 본다 */
    renderTurnTracks(body, picked, sel, a);
  }

  /* §515 — 궤적 그림 + 반전 토글 + 읽는 법.
     그림만 놓으면 예쁜 선 뭉치다. 무엇을 보라고 말해야 도구가 된다. */
  function renderTurnTracks(body, picked, sel, a) {
    var head = el('div', 'd-flex align-items-center justify-content-between mt-4');
    head.appendChild(el('div', 'fw-bold', 'Seen from above'));
    var ctrls = el('div', 'd-flex align-items-center gap-2');

    var mirrorBtn = el('button', 'btn btn-sm '
      + (TRACKPLOT.mirror ? 'btn-primary' : 'btn-outline-secondary'),
      TRACKPLOT.mirror ? 'Port flipped' : 'Flip port turns');
    mirrorBtn.type = 'button';
    mirrorBtn.addEventListener('click', function () {
      TRACKPLOT.mirror = !TRACKPLOT.mirror;
      renderTurnExtras(a);
    });
    ctrls.appendChild(mirrorBtn);

    var padSel = el('select', 'form-select form-select-sm');
    padSel.style.width = 'auto';
    [6, 10, 16, 24].forEach(function (v) {
      var o = document.createElement('option');
      o.value = String(v); o.textContent = '\u00b1' + v + ' s';
      if (v === TRACKPLOT.pad) o.selected = true;
      padSel.appendChild(o);
    });
    padSel.addEventListener('change', function () {
      TRACKPLOT.pad = parseInt(padSel.value, 10) || 10;
      renderTurnExtras(a);
    });
    ctrls.appendChild(padSel);
    head.appendChild(ctrls);
    body.appendChild(head);

    var host = el('div', 'mt-2');
    body.appendChild(host);
    var cap = el('div', 'lab mt-1');
    body.appendChild(cap);

    var r = null;
    try { r = drawTurnTracks(host, picked, sel, a); } catch (e) {
      host.textContent = 'Could not draw the tracks.';
      return;
    }
    if (!r) {
      if (!host.firstChild) {
        host.textContent = 'No position samples around these turns.';
      }
      return;
    }

    /* 무엇이 그려졌는지 → 무엇을 읽으라는 것인지 순서로 */
    var parts = [];
    parts.push('Every turn starts at the same point \u2014 the centre \u2014 '
      + 'travelling straight up, so the entries lie on top of each other and '
      + 'you are looking at what happened after that. The dot on each line is '
      + 'the apex, its slowest moment. Distances are metres, both axes to the '
      + 'same scale.');
    if (r.poolN) {
      parts.push('The faint lines are your other ' + r.poolN
        + ' comparable turns this session.');
    }
    if (r.widest && r.widest.shape) {
      parts.push('Widest of the selected: #' + r.widest.no + ' at '
        + r.widest.shape.widthM.toFixed(1) + ' m off the entry line, '
        + r.widest.shape.travelM.toFixed(0) + ' m travelled.');
    }
    parts.push(TRACKPLOT.mirror
      ? 'Port turns are mirrored left-to-right so both sides overlay \u2014 '
        + 'good for comparing shape, but it hides which way you turn worse. '
        + 'Turn it off to see that again.'
      : 'Port and starboard turn opposite ways, so they mirror each other. '
        + 'Flip port turns to lay the two on top of each other and compare '
        + 'the shape directly.');
    parts.push('A wide, rounded path that keeps speed beats a tight one that '
      + 'stalls \u2014 read this next to the speed curve above, not instead of it.');
    cap.textContent = parts.join(' ');
  }

  /* ═══════════════════════════════════════════════════════════════
   * §515 V11 — 회전 궤적 겹치기 (옥대표 백로그 ⭐⭐ "전혀 없는 것")
   *
   * §497 이 '속도 대 시간' 이라면 이건 **공간 궤적**이다. 같은 손실률
   * 두 회전이 전혀 다른 모양일 수 있다 — 하나는 넓게 돌아 속도를
   * 지켰고 하나는 급하게 꺾어 미끄러졌는데, 시간축 곡선에서는 둘 다
   * "12% 손실" 로 같아 보인다. 그 차이는 위에서 내려다봐야 보인다.
   *
   * 정렬 규칙 세 가지 — 이게 없으면 그냥 항적 뭉치다:
   *   ① 원점 = **회전 시작점**(startIdx), 그리고 진입 침로
   *      (headingBefore)를 **위쪽(+y)** 으로 돌린다. 그래야 진입 궤적이
   *      전부 x=0 세로선 위에 겹쳐서 "여기서부터 무슨 일이 벌어졌나"
   *      가 한 그림이 된다.
   *      ⚠ 처음엔 원점을 apex(최저속)로 잡았다가 고쳤다 — headingBefore
   *      는 회전 **시작 직전** 4초로 재는 값이라 그 진입선은 apex 를
   *      지나지 않는다. 시작점~apex 사이에 이미 옆으로 밀린 거리만큼
   *      회전마다 다르게 어긋나서, 실측에서 진입부 산포(SD 77px)가
   *      이탈부(45px)보다 **더 컸다** — 정렬이 안 되고 있었다는 뜻이다.
   *   ② apex 는 각 궤적 위에 점으로 찍는다. 어디서 제일 느려졌는지가
   *      모양과 같이 보여야 "넓게 돌아 속도를 지켰다" 를 읽는다.
   *   ③ 미터 등축(等軸). 위경도를 그대로 그리면 위도에 따라 가로가
   *      눌려서 회전 반경이 왜곡된다 — 부산(35°N)에서 경도 1° 는
   *      위도 1° 의 0.82 배다.
   *
   * 좌우 반전을 **기본으로 켜지 않는다.** P 회전과 S 회전은 서로
   * 반대로 돈다 — 겹치려면 한쪽을 뒤집어야 하지만, 뒤집는 순간
   * "왼쪽으로 도는 걸 못 한다"(§507 에서 실제로 찾은 것)가 그림에서
   * 사라진다. 그래서 토글로 두고, 켤 때 무슨 일이 일어나는지 적는다.
   * ═══════════════════════════════════════════════════════════════ */

  /* §517 (옥대표) — P/S 색을 표에도. 좌현 적색·우현 녹색은 국제 항해
     관례라 이미 바이올린·회전 궤적이 쓰고 있었는데, **표는 글자뿐**이라
     같은 개념인 줄 눈으로 잇기가 어려웠다.

     ⚠ 다만 적/녹은 색각이상에서 제일 구분이 안 되는 조합이다. 그래서
     **색만으로 뜻을 싣지 않는다** — 점은 글자 옆에 붙는 보조 신호이고,
     Port/Starboard 라는 글자가 언제나 남는다. 색을 빼도 표는 그대로
     읽힌다(§474 에서 세운 규칙과 같다). */
  function sideColor(side) {
    return side === 'P' ? THEME.port : side === 'S' ? THEME.stbd : null;
  }
  /* 색 점 하나. 글자는 호출부가 따로 넣는다 */
  function sideDot(side) {
    var c = sideColor(side);
    var d = el('span');
    d.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;'
      + 'margin-right:6px;vertical-align:middle;flex:0 0 auto;'
      + (c ? 'background:' + c + ';' : 'background:transparent;border:1px solid currentColor;');
    return d;
  }
  /* 점 + 글자를 한 덩어리로 */
  function sideTag(side, label) {
    var w = el('span');
    w.style.cssText = 'display:inline-flex;align-items:center;white-space:nowrap';
    w.appendChild(sideDot(side));
    w.appendChild(document.createTextNode(label));
    return w;
  }

  /* §521 최적 각도 — Waterspeed 의 OPTIMAL TARGET ANGLES 를 우리 규칙으로.
     ⚠ **지표가 방향에 따라 다르다**(그들도 그렇게 한다, IMG_1518 vs 1531):
       · 풍상 = VMG 최대각. 각도를 팔아 높이를 사는 게임이라 VMG 가 목적함수다.
       · 풍하 = 그 각의 **속도**가 기준. 포일에서는 깊이보다 속도를 지키는
         게 먼저고, 깊게 갈수록 VMG 가 커 보이는 착시가 생긴다.
     한 지표로 통일하면 둘 중 하나는 **틀린 것을 최적화**하게 된다.

     그리고 못 낼 때는 숫자 대신 **왜 못 내는지**를 적는다 — 그들이
     "풍하 최적각 173°" 를 낸 자리가 정확히 이 검산이 없는 자리다. */
  function renderOptimalAngles(card, a) {
    if (!window.RDPolar || !RDPolar.optimalAngle || !a || !a.polar) return;
    var bins = a.polar.combined || a.polar.starboard;
    if (!bins || !bins.length) return;
    /* ⚠ minN 을 넘기지 않는다. 넘기면 그리기 기준(5)이 최적 각도에도
       적용돼 13표본짜리 빈이 '최적' 으로 뽑힌다(실측). 최적은 하나의
       숫자로 단언하는 것이라 더 두꺼운 근거(OPT_MIN_N=15)를 써야 한다. */
    var up = RDPolar.optimalAngle(bins, 'upwind');
    var dn = RDPolar.optimalAngle(bins, 'downwind');
    if (!up.ok && !dn.ok && up.reason === 'no_data' && dn.reason === 'no_data') return;

    var body = el('div', 'card-body border-top pt-3');
    var head = el('div', 'd-flex align-items-baseline justify-content-between');
    head.appendChild(el('div', 'fw-bold', 'Best angles you actually sailed'));
    head.appendChild(el('div', 'lab', 'from this session, not a boat polar'));
    body.appendChild(head);

    var row = el('div', 'row g-3 mt-1');
    function why(r) {
      if (r.reason === 'need_more_samples') {
        return 'No angle has ' + (r.need || 5) + ' or more samples here yet.';
      }
      if (r.reason === 'only_implausible_high') {
        return 'Every upwind angle with enough samples is closer than 30\u00b0 to '
          + 'the wind, which nothing points \u2014 the wind direction is probably '
          + 'off. Check it on the Environment tab.';
      }
      return 'Not enough sailing at these angles.';
    }
    function cell(title, r, mode, a) {
      var c = el('div', 'col-6');
      var box = el('div', 'p-2 rounded');
      box.style.background = currentThemeName() === 'light'
        ? 'rgba(13,110,253,.05)' : 'rgba(77,171,247,.07)';
      box.appendChild(el('div', 'lab', title));
      if (!r.ok) {
        box.appendChild(el('div', 'mt-1 text-secondary', why(r)));
        c.appendChild(box); return c;
      }
      var v = el('div', 'kpi__val num mt-1', Math.round(r.twaDeg) + '\u00b0');
      v.style.color = mode === 'upwind' ? THEME.stbd : THEME.warn;
      box.appendChild(v);
      /* 방향에 따라 무엇이 기준인지 **화면이 말한다** */
      box.appendChild(el('div', 'lab mt-1', mode === 'upwind'
        ? 'best VMG ' + r.vmgKt.toFixed(1) + ' kt  (at ' + r.speedKt.toFixed(1) + ' kt)'
        : 'fastest ' + r.speedKt.toFixed(1) + ' kt  (VMG ' + r.vmgKt.toFixed(1) + ' kt)'));
      box.appendChild(el('div', 'lab', r.count + ' samples'));
      if (r.atEdge) {
        var w = el('div', 'lab mt-1');
        w.style.color = THEME.warn;
        w.textContent = 'This is the edge of what you sailed \u2014 the real best '
          + 'may be beyond it.';
        box.appendChild(w);
      }
      /* 깊은 각 — 숨기지 않고 **두 해석을 같이** 준다.
         옥대표: "파도가 커서 풍하 런으로 달린 구간들도 꽤 있었을거야."
         맞다. 스웰을 타면 데드다운윈드 근처가 실제로 제일 빠르다. */
      if (r.deep) {
        var dp = el('div', 'lab mt-1');
        dp.textContent = 'That is very deep. With swell running it is real \u2014 '
          + 'the wave is pushing, not the wing. With flat water it usually means '
          + 'the wind direction is off. ' + r.count + ' samples here, so '
          + (r.count >= 60 ? 'this is not a stray reading.'
                           : 'it is worth a second look.');
        box.appendChild(dp);
      }
      /* ★ 극단 각도는 숨기지도 단정하지도 않는다 — **얼마나 붙잡았는지**를
         잰다. 각도 값은 가능·불가능을 못 가른다(파도가 판을 바꾼다).
         못 버티는 각도는 지나간 게 사실이어도 타깃이 아니다. */
      if (r.extreme) {
        var hold = null;
        try {
          hold = RDSegments.longestStretchAtTwa(
            (CUR.session && CUR.session.samples) || [], a.windDir,
            r.twaDeg, (a.polar && a.polar.binDeg) || 7.5, 1.5);
        } catch (e) {}
        var dp = el('div', 'lab mt-1');
        if (hold && hold.stretches) {
          var held = hold.longestSec;
          /* 최장 길이만 보면 안 된다. 8초를 세 번 = 총 11초는 90분 세션에서
             0.2% 다 — 그걸 '라인' 이라고 부르면 안 된다(실측에서 그렇게
             불렀다). **버틴 길이와 전체 비중을 같이** 본다. */
          var rideSec = (a && a.summary && a.summary.activeTimeSec)
            || (a && a.summary && a.summary.movingTimeSec) || 0;
          var share = rideSec > 0 ? (hold.totalSec / rideSec) * 100 : null;
          var momentary = (held < 5) || (share != null && share < 2);
          if (momentary) dp.style.color = THEME.warn;
          dp.textContent = (r.extreme === 'high' ? 'That is very high. '
                                                 : 'That is very deep. ')
            + 'Longest hold ' + held.toFixed(1) + ' s, '
            + hold.stretches + ' bursts, ' + Math.round(hold.totalSec) + ' s total'
            + (share != null ? ' (' + share.toFixed(1) + '% of your riding)' : '')
            + '. '
            + (momentary
                ? 'That reads as momentary \u2014 riding up or down a wave face, '
                  + 'not an angle you can hold. Something that happened, not a '
                  + 'target to aim for.'
                : 'Held long enough and often enough to be a real line \u2014 with '
                  + 'swell running, that is genuine.');
        } else {
          dp.textContent = (r.extreme === 'high' ? 'That is very high'
                                                 : 'That is very deep')
            + ' for a foil. With swell it can be real; on flat water it usually '
            + 'means the wind direction is off.';
        }
        box.appendChild(dp);
      }
      c.appendChild(box); return c;
    }
    row.appendChild(cell('Upwind', up, 'upwind', a));
    row.appendChild(cell('Downwind', dn, 'downwind', a));
    body.appendChild(row);

    var note = el('div', 'text-secondary mt-2');
    note.style.fontSize = '.8125rem';
    note.textContent = 'Upwind is judged on VMG \u2014 upwind you trade angle for '
      + 'height, so progress to windward is the goal. Downwind is judged on speed: '
      + 'on a foil, going deeper looks better on VMG right up until you drop off '
      + 'the foil, so speed is the honest measure. Both need the wind direction '
      + 'to be right \u2014 check it on the Environment tab first.';
    body.appendChild(note);
    card.appendChild(body);
  }

  /* ═══════════════════════════════════════════════════════════════
   * §522 W3 구간 스테퍼 (옥대표 "렉을 선택해서 분석하는거 좋아")
   *
   * Waterspeed 는 **하나의 스테퍼**로 Legs·Runs·Tacks·Jibes·Foiling 을
   * 다 훑는다. 우리는 같은 것들을 §497·§456·detectRuns 로 따로 만들어
   * 놨는데 조작이 제각각이라 "이 구간" 이라는 개념이 화면에 없었다.
   *
   * 우리가 더 하는 것 셋:
   *   ① 손실을 **미터**로도 준다(W5) — "12%" 보다 "15m" 가 손에 잡힌다
   *   ② 타깃 대비를 **방향에 따라 다른 지표**로(W4) — 풍상 VMG, 풍하 속도
   *   ③ 분모가 0 근처면 **백분율을 안 쓴다**(그들은 +421.4% 를 낸다)
   * ═══════════════════════════════════════════════════════════════ */
  var SEGSTEP = { kind: 'leg', idx: 0 };
  var segHl = null;                 /* 지도 강조 레이어 */

  var SEG_KINDS = [
    ['leg', 'Legs'], ['run', 'Runs'], ['tack', 'Tacks'],
    ['gybe', 'Gybes'], ['foiling', 'Foiling']
  ];

  function foilThresholdMs() {
    var cfg = (CUR.session && CUR.session.cfg) || {};
    var kt = cfg.activeSpeedKt || cfg.foilingSpeedKt || 11;
    return kt / KT;
  }

  function buildSegs(kind, a) {
    if (!window.RDSegments || !CUR.session) return [];
    try {
      return RDSegments.build(kind, {
        analysis: a, samples: CUR.session.samples || [],
        foilThresholdMs: foilThresholdMs(), dipSec: 2
      });
    } catch (e) { return []; }
  }

  /* 지도에 그 구간만 굵게. 지도는 RDMapTactical 이 만들었고 Leaflet
     인스턴스를 들고 있으므로 그 위에 폴리라인을 얹는다. */
  function highlightSegment(seg) {
    /* ⚠ 이 파일의 IIFE 는 인자가 없다 — `global` 이 스코프에 없어서
       예전엔 여기서 조용히 터졌다(호출부 try/catch 가 삼켰다).
       카드는 그려지는데 지도 강조만 안 되는 증상이었다. */
    var L = window.L;
    if (!mapInst || !mapInst.map || !L) return;
    if (segHl) {
      segHl.forEach(function (ly) { try { mapInst.map.removeLayer(ly); } catch (e) {} });
      segHl = null;
    }
    if (!seg || !CUR.session) return;
    var S = CUR.session.samples || [];
    var pts = [];
    for (var i = seg.startIdx; i <= seg.endIdx && i < S.length; i++) {
      if (S[i].lat != null && S[i].lng != null) pts.push([S[i].lat, S[i].lng]);
    }
    if (pts.length < 2) return;
    var halo = L.polyline(pts, { color: '#0b1220', weight: 9, opacity: 0.55 })
      .addTo(mapInst.map);
    var line = L.polyline(pts, { color: '#c026d3', weight: 4, opacity: 0.95 })
      .addTo(mapInst.map);
    segHl = [halo, line];
  }

  /* 분모가 0 근처일 때 백분율을 쓰지 않는다.
     Waterspeed 는 진입 VMG 가 0.6kt 일 때 "+421.4%" 를 낸다 — 뜻이 없다. */
  function pctChange(from, to, minBase) {
    var base = Math.abs(from), floor = (minBase == null) ? 0.5 : minBase;
    if (!(base > floor)) return null;
    return ((to - from) / base) * 100;
  }

  function renderSegmentStepper(a) {
    var host = $('segment-stepper');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!window.RDSegments || !CUR.session) return;

    var segs = buildSegs(SEGSTEP.kind, a);
    if (!segs.length) {
      /* 종류를 바꿀 수는 있어야 한다 — 하나가 비었다고 UI 를 감추면
         다른 종류가 있는지도 알 수 없다 */
      var empty = el('div', 'card');
      var eb = el('div', 'card-body d-flex flex-wrap align-items-center gap-2');
      eb.appendChild(kindSelect(a));
      eb.appendChild(el('span', 'text-secondary',
        'None detected in this session.'));
      empty.appendChild(eb); host.appendChild(empty);
      highlightSegment(null);
      return;
    }
    if (SEGSTEP.idx >= segs.length) SEGSTEP.idx = 0;
    if (SEGSTEP.idx < 0) SEGSTEP.idx = segs.length - 1;
    var seg = segs[SEGSTEP.idx];
    var S = CUR.session.samples || [];
    var wd = a.windDir;
    var st = RDSegments.segStats(S, seg, wd);

    var card = el('div', 'card');
    var head = el('div', 'card-header d-flex flex-wrap align-items-center gap-2');
    head.appendChild(el('h3', 'card-title mb-0', 'Segment'));
    head.appendChild(kindSelect(a));

    var nav = el('div', 'd-flex align-items-center gap-2 ms-auto');
    function navBtn(txt, delta) {
      var b = el('button', 'btn btn-sm', txt);
      b.type = 'button';
      b.addEventListener('click', function () {
        SEGSTEP.idx += delta; renderSegmentStepper(a);
      });
      return b;
    }
    nav.appendChild(navBtn('\u2039', -1));
    nav.appendChild(el('span', 'num', (SEGSTEP.idx + 1) + ' / ' + segs.length));
    nav.appendChild(navBtn('\u203a', 1));
    head.appendChild(nav);
    card.appendChild(head);

    var body = el('div', 'card-body');
    if (!st) {
      body.appendChild(el('div', 'text-secondary', 'No samples in this segment.'));
      card.appendChild(body); host.appendChild(card);
      return;
    }

    /* 머리줄 — 무엇을 보고 있는지 */
    var title = el('div', 'd-flex flex-wrap align-items-baseline gap-2');
    var name = el('div', 'fw-bold',
      kindLabel(SEGSTEP.kind) + ' #' + seg.no);
    title.appendChild(name);
    if (seg.side) title.appendChild(sideTag(seg.side,
      seg.side === 'P' ? 'Port' : 'Starboard'));
    if (st.direction) {
      var d = el('span', 'badge', st.direction === 'upwind' ? 'upwind' : 'downwind');
      d.style.background = st.direction === 'upwind' ? THEME.stbd : THEME.warn;
      d.style.color = '#0b1220';
      title.appendChild(d);
    }
    title.appendChild(el('span', 'lab', fmtClock(st.durationSec)
      + (st.distanceM != null ? '  \u00b7  ' + (st.distanceM / 1000).toFixed(2) + ' km' : '')));
    body.appendChild(title);

    /* 통계 격자 */
    var grid = el('div', 'row g-2 mt-2');
    function box(label, val, sub) {
      var c = el('div', 'col-6 col-md-3');
      var w = el('div', 'p-2 rounded');
      w.style.background = currentThemeName() === 'light'
        ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      w.appendChild(el('div', 'lab', label));
      w.appendChild(el('div', 'num fw-bold mt-1', val));
      if (sub) w.appendChild(el('div', 'lab', sub));
      c.appendChild(w); return c;
    }
    function kt(v) { return v == null ? '\u2014' : (v * KT).toFixed(1) + ' kt'; }
    grid.appendChild(box('Avg speed', kt(st.avgSpeedMs), 'max ' + kt(st.maxSpeedMs)));
    /* VMG 는 **크기**로 보여준다. 내부 부호는 +풍상/−풍하 규약이지만
       화면에서 "풍하 VMG −6.2kt" 는 느리다는 뜻처럼 읽힌다 — 어느 쪽으로
       가는지는 위의 upwind/downwind 배지가 이미 말한다. */
    grid.appendChild(box('Avg VMG',
      st.avgVmgMs == null ? '\u2014' : kt(Math.abs(st.avgVmgMs)),
      st.maxVmgMs == null ? 'needs wind direction'
                          : 'max ' + kt(Math.abs(st.maxVmgMs))));
    grid.appendChild(box('Avg wind angle',
      st.avgTwaDeg == null ? '\u2014' : Math.round(st.avgTwaDeg) + '\u00b0',
      st.avgHr != null ? Math.round(st.avgHr) + ' bpm' : ''));
    grid.appendChild(box('Distance',
      st.distanceM == null ? '\u2014' : (st.distanceM / 1000).toFixed(2) + ' km',
      st.samples + ' samples'));
    body.appendChild(grid);

    renderSegTurnDetail(body, seg, S, wd);
    renderSegTarget(body, seg, st, a);
    renderSegAngleChange(body, seg, S, wd);

    card.appendChild(body);
    host.appendChild(card);
    highlightSegment(seg);
  }

  /* 회전 구간이면 진입/이탈을 **속도와 VMG 둘 다**, 손실은 **미터로도**.
     W5·W7. 그들은 백분율만 주고 분모가 0 근처면 +421.4% 를 낸다. */
  function renderSegTurnDetail(body, seg, S, wd) {
    if (seg.kind !== 'tack' && seg.kind !== 'gybe') return;
    var m = seg.man;
    if (!m) return;
    var wrap = el('div', 'row g-2 mt-2');
    function cell(label, val, sub, tone) {
      var c = el('div', 'col-6 col-md-3');
      var w = el('div', 'p-2 rounded');
      w.style.background = currentThemeName() === 'light'
        ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)';
      w.appendChild(el('div', 'lab', label));
      var v = el('div', 'num fw-bold mt-1', val);
      if (tone) v.style.color = tone;
      w.appendChild(v);
      if (sub) w.appendChild(el('div', 'lab', sub));
      c.appendChild(w); return c;
    }
    function kt(v) { return v == null ? '\u2014' : (v * KT).toFixed(1) + ' kt'; }
    function pctTxt(p) {
      return p == null ? 'too slow to compare' : (p > 0 ? '+' : '') + p.toFixed(1) + '%';
    }
    var sp = pctChange(m.entrySpeedMs, m.exitSpeedMs, 0.5);
    wrap.appendChild(cell('Entry \u2192 exit speed',
      kt(m.entrySpeedMs) + ' \u2192 ' + kt(m.exitSpeedMs), pctTxt(sp),
      (sp != null && sp < 0) ? THEME.port : null));

    /* 진입/이탈 VMG — 속도만 보면 "빠르게 나왔지만 각도를 버렸다" 를 놓친다 */
    if (wd != null) {
      var eV = vmgAtIdx(S, m.startIdx, wd), xV = vmgAtIdx(S, m.endIdx, wd);
      var vp = pctChange(eV, xV, 0.5);
      wrap.appendChild(cell('Entry \u2192 exit VMG',
        kt(eV) + ' \u2192 ' + kt(xV), pctTxt(vp),
        (vp != null && vp < 0) ? THEME.port : null));
    }

    /* W5 — 손실을 미터로. 회전이 없었다면 갔을 거리에서 실제 간 거리를 뺀다.
       기준 속도는 진입·이탈 중 큰 쪽(§456 과 같은 규약). */
    var ref = Math.max(m.entrySpeedMs || 0, m.exitSpeedMs || 0);
    var dur = (S[m.endIdx] && S[m.startIdx]) ? (S[m.endIdx].t - S[m.startIdx].t) : null;
    var actual = (S[m.endIdx] && S[m.startIdx] && S[m.endIdx].cumDist != null)
      ? (S[m.endIdx].cumDist - S[m.startIdx].cumDist) : null;
    if (ref > 0 && dur != null && actual != null) {
      var lostM = Math.max(0, ref * dur - actual);
      wrap.appendChild(cell('Lost in the turn', Math.round(lostM) + ' m',
        'vs holding ' + kt(ref), lostM > 0 ? THEME.warn : null));
    }
    wrap.appendChild(cell('Recovery',
      m.recoverySec == null ? '\u2014' : m.recoverySec.toFixed(1) + ' s',
      'back to 95% of entry'));
    body.appendChild(wrap);
  }

  function vmgAtIdx(S, i, wd) {
    if (!S[i] || S[i].heading == null || S[i].speed == null || wd == null) return null;
    var d = ((S[i].heading - wd + 540) % 360) - 180;
    return S[i].speed * Math.cos(Math.abs(d) * Math.PI / 180);
  }

  /* W4 타깃 대비 — **방향에 따라 지표가 다르다**.
     풍상은 VMG(각도를 팔아 높이를 산다), 풍하는 속도(포일은 깊게 갈수록
     VMG 가 커 보이다가 떨어진다). 한 지표로 통일하면 둘 중 하나는
     틀린 것을 최적화하게 된다. */
  function renderSegTarget(body, seg, st, a) {
    if (!st || !st.direction || !a.polar) return;
    if (!window.RDPolar || !RDPolar.optimalAngle) return;
    var bins = a.polar.combined;
    if (!bins || !bins.length) return;
    var best = RDPolar.optimalAngle(bins, st.direction);
    if (!best.ok) return;

    /* 표본이 얇으면 **비교 자체를 하지 않는다.** 4표본짜리 레그에
       "52% of target" 을 띄우면 발견처럼 읽히는데 그건 그냥 회전 사이
       빈틈이다. 얇다고 칩만 달아 두는 것으로는 부족하다(실측에서
       그렇게 보였다). */
    var MIN_CMP = 20;
    if (st.samples < MIN_CMP) {
      var thin = el('div', 'lab mt-2');
      thin.textContent = 'Too short to compare against your best \u2014 '
        + st.samples + ' samples, needs ' + MIN_CMP + '.';
      body.appendChild(thin);
      return;
    }
    var upwind = st.direction === 'upwind';
    var mine = upwind ? Math.abs(st.avgVmgMs || 0) * KT : (st.avgSpeedMs || 0) * KT;
    var target = upwind ? best.vmgKt : best.speedKt;
    if (!(target > 0)) return;
    var pct = (mine / target) * 100;

    var box = el('div', 'mt-3 p-2 rounded');
    box.style.border = '1px solid ' + (pct >= 95 ? THEME.stbd : THEME.warn);
    var h = el('div', 'd-flex align-items-center justify-content-between');
    h.appendChild(el('div', 'lab', 'Against your best this session'));
    var chip = el('span', 'badge', st.samples >= 60 ? 'solid' : 'short segment');
    chip.style.background = st.samples >= 60 ? THEME.stbd : THEME.dim;
    chip.style.color = '#0b1220';
    h.appendChild(chip);
    box.appendChild(h);
    var r = el('div', 'd-flex flex-wrap gap-4 mt-1');
    function kv(k, v, tone) {
      var c = el('div');
      c.appendChild(el('div', 'lab', k));
      var vv = el('div', 'num fw-bold', v);
      if (tone) vv.style.color = tone;
      c.appendChild(vv);
      return c;
    }
    r.appendChild(kv(upwind ? 'Target VMG' : 'Target speed', target.toFixed(1) + ' kt'));
    r.appendChild(kv('% of target', Math.round(pct) + '%',
      pct >= 95 ? THEME.stbd : THEME.warn));
    r.appendChild(kv('Delta', (mine - target >= 0 ? '+' : '')
      + (mine - target).toFixed(1) + ' kt'));
    box.appendChild(r);
    /* 각도 차이를 같이 말한다. 이게 없으면 "78° 로 간 레그를 34° 타깃에
       대고 26%" 가 그냥 가혹한 숫자로만 읽힌다 — 실제로 알아야 할 것은
       **각도를 얼마나 놓쳤나** 이고, 그건 다음 레그에서 고칠 수 있다. */
    if (st.avgTwaDeg != null) {
      var gap = st.avgTwaDeg - best.twaDeg;
      if (Math.abs(gap) >= 8) {
        var g = el('div', 'lab mt-1');
        g.style.color = THEME.warn;
        g.textContent = 'You sailed this at ' + Math.round(st.avgTwaDeg)
          + '\u00b0 while your best ' + (upwind ? 'VMG' : 'speed') + ' angle was '
          + Math.round(best.twaDeg) + '\u00b0 \u2014 '
          + (upwind
              ? (gap > 0 ? 'that is ' + Math.round(gap) + '\u00b0 lower than you can point'
                         : 'that is ' + Math.round(-gap) + '\u00b0 higher, so you were pinching')
              : (gap > 0 ? 'that is ' + Math.round(gap) + '\u00b0 deeper than your fastest'
                         : 'that is ' + Math.round(-gap) + '\u00b0 higher than your fastest'))
          + '. Much of the gap below is the angle, not the boat speed.';
        box.appendChild(g);
      }
    }
    box.appendChild(el('div', 'lab mt-1', upwind
      ? 'Upwind is scored on VMG \u2014 progress to windward is the goal.'
      : 'Downwind is scored on speed \u2014 on a foil, deeper flatters VMG right '
        + 'up until you drop off.'));
    body.appendChild(box);
  }

  /* W11 — 구간 안에서 풍각이 밀렸나(헤더/리프트) */
  function renderSegAngleChange(body, seg, S, wd) {
    if (!window.RDSegments || !RDSegments.angleChange) return;
    var ac = RDSegments.angleChange(S, seg, wd);
    if (!ac) return;
    var d = ac.deltaDeg;
    if (Math.abs(d) < 4) return;      /* 4° 미만은 노이즈와 구별이 안 된다 */
    var line = el('div', 'lab mt-2');
    line.textContent = 'Wind angle moved ' + (d > 0 ? '+' : '') + d.toFixed(1)
      + '\u00b0 across this segment ('
      + Math.round(ac.firstTwa) + '\u00b0 \u2192 ' + Math.round(ac.lastTwa)
      + '\u00b0) \u2014 ' + (d > 0 ? 'you were freed' : 'you were headed')
      + '. Could be a real shift or the wind direction drifting.';
    body.appendChild(line);
  }

  function kindLabel(k) {
    for (var i = 0; i < SEG_KINDS.length; i++) {
      if (SEG_KINDS[i][0] === k) return SEG_KINDS[i][1].replace(/s$/, '');
    }
    return k;
  }

  function kindSelect(a) {
    var sel = el('select', 'form-select form-select-sm');
    sel.style.width = 'auto';
    SEG_KINDS.forEach(function (p) {
      var n = buildSegs(p[0], a).length;
      var o = document.createElement('option');
      o.value = p[0];
      o.textContent = p[1] + (n ? ' (' + n + ')' : ' \u2014 none');
      o.disabled = !n;
      if (p[0] === SEGSTEP.kind) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      SEGSTEP.kind = sel.value; SEGSTEP.idx = 0; renderSegmentStepper(a);
    });
    return sel;
  }

  var TRACKPLOT = { mirror: false, pad: 10 };
  var MPD = 111320;                    /* 위도 1° 의 미터 */

  /* 한 회전의 궤적을 시작점 원점·진입침로 위쪽인 미터 좌표로.
     시간창은 시작 pad 초 전부터 끝 pad 초 후까지 — 회전 길이는
     회전마다 다르므로 apex 기준 고정폭으로 자르면 긴 택의 이탈부가
     통째로 잘린다. */
  function turnPathOn(S, m, padSec) {
    if (!m || m.startIdx == null) return null;
    var o = S[m.startIdx];
    if (!o || o.lat == null || o.lng == null) return null;
    var hb = m.headingBefore;
    if (hb == null) return null;
    var t0 = o.t;
    var tEnd = (m.endIdx != null && S[m.endIdx]) ? S[m.endIdx].t : t0;
    var cosLat = Math.cos(o.lat * Math.PI / 180);
    /* 진입침로를 +y 로 보내는 회전각. 화면 좌표는 북=+y, 동=+x 이므로
       침로 θ 에 대해 R=[[cosθ,−sinθ],[sinθ,cosθ]] 를 걸면
       (sinθ,cosθ) → (0,1) 이다. */
    var th = hb * Math.PI / 180;
    var cs = Math.cos(th), sn = Math.sin(th);
    var pts = [];
    for (var i = 0; i < S.length; i++) {
      var dt = S[i].t - t0;
      if (dt < -padSec) continue;
      if (S[i].t > tEnd + padSec) break;
      if (S[i].lat == null || S[i].lng == null) continue;
      var ex = (S[i].lng - o.lng) * MPD * cosLat;   /* 동쪽 m */
      var ny = (S[i].lat - o.lat) * MPD;            /* 북쪽 m */
      pts.push({
        x: ex * cs - ny * sn,
        y: ex * sn + ny * cs,
        t: dt,
        v: S[i].speed == null ? null : S[i].speed * KT,
        apex: (i === m.apexIdx)
      });
    }
    return pts.length >= 4 ? pts : null;
  }

  /* 궤적의 폭·깊이 — 모양을 숫자 하나로 만들지는 않되, 읽기를 돕는다.
     width  = 진입선(x=0)에서 좌우로 가장 멀리 간 거리
     travel = 회전 구간에서 실제로 지나간 경로 길이 */
  function pathShape(pts) {
    var wMax = 0, travel = 0;
    for (var i = 0; i < pts.length; i++) {
      var ax = Math.abs(pts[i].x);
      if (ax > wMax) wMax = ax;
      if (i) {
        var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
        travel += Math.sqrt(dx * dx + dy * dy);
      }
    }
    return { widthM: wMax, travelM: travel };
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function drawTurnTracks(hostEl, picked, sel, a) {
    while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild);
    if (!CUR.session) return null;
    var S = CUR.session.samples || [];
    if (!S.length) return null;
    var pad = TRACKPLOT.pad;

    function prep(m) {
      var p = turnPathOn(S, m, pad);
      if (!p) return null;
      /* 반전은 **x 부호만** 뒤집는다 — 진행 방향(y)은 건드리지 않는다 */
      if (TRACKPLOT.mirror && m.side === 'P') {
        p = p.map(function (q) { return { x: -q.x, y: q.y, t: q.t, v: q.v }; });
      }
      return p;
    }

    var lines = [];
    picked.forEach(function (m, k) {
      var p = prep(m);
      if (p) lines.push({ m: m, pts: p, no: sel[k] + 1, shape: pathShape(p) });
    });
    if (!lines.length) {
      hostEl.textContent = 'These turns have no position samples to draw.';
      return null;
    }

    /* 배경 모집단 — §497 과 같은 필터를 따른다 */
    var mans = (a && a.maneuvers) || [];
    var pType = TURNFILT.type, pSide = TURNFILT.side;
    if (pType === 'all') {
      var types = {};
      picked.forEach(function (m) { types[m.type] = 1; });
      var tk = Object.keys(types);
      if (tk.length === 1) pType = tk[0];
    }
    var pickedIds = {};
    picked.forEach(function (m) { pickedIds[m.startIdx + ':' + m.endIdx] = 1; });
    var pool = [];
    mans.forEach(function (m) {
      if (pType !== 'all' && m.type !== pType) return;
      if (pSide !== 'all' && m.side !== pSide) return;
      if (pickedIds[m.startIdx + ':' + m.endIdx]) return;
      var p = prep(m);
      if (p) pool.push({ m: m, pts: p });
    });

    /* ---- 스케일: 등축. 가로세로 중 큰 쪽에 맞춘다 ---- */
    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    function ext(pts) {
      pts.forEach(function (q) {
        if (q.x < xMin) xMin = q.x; if (q.x > xMax) xMax = q.x;
        if (q.y < yMin) yMin = q.y; if (q.y > yMax) yMax = q.y;
      });
    }
    lines.forEach(function (l) { ext(l.pts); });
    pool.forEach(function (l) { ext(l.pts); });
    if (!isFinite(xMin)) return null;
    var W = Math.max(hostEl.clientWidth || 860, 320), H = 340, M = 26;
    var spanX = Math.max(xMax - xMin, 1), spanY = Math.max(yMax - yMin, 1);
    var k = Math.min((W - 2 * M) / spanX, (H - 2 * M) / spanY);
    var cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    function px(q) { return W / 2 + (q.x - cx) * k; }
    function py(q) { return H / 2 - (q.y - cy) * k; }   /* 북쪽이 위 */
    function d(pts) {
      return pts.map(function (q, i) {
        return (i ? 'L' : 'M') + px(q).toFixed(1) + ' ' + py(q).toFixed(1);
      }).join(' ');
    }

    var svg = svgEl('svg', { width: '100%', height: String(H),
      viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' });
    svg.style.display = 'block';

    /* 진입선 — x=0 세로선. "얼마나 벌어졌나" 의 기준이다 */
    var x0 = px({ x: 0, y: 0 });
    svg.appendChild(svgEl('line', { x1: x0, y1: 8, x2: x0, y2: H - 8,
      stroke: THEME.axisText, 'stroke-width': 1, 'stroke-dasharray': '3 5',
      opacity: 0.45 }));

    pool.forEach(function (l) {
      svg.appendChild(svgEl('path', { d: d(l.pts), fill: 'none',
        stroke: THEME.dim, 'stroke-width': 1.2, opacity: 0.32,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    });

    var COL_P = THEME.port, COL_S = THEME.stbd;
    lines.forEach(function (l) {
      var col = l.m.side === 'P' ? COL_P : l.m.side === 'S' ? COL_S : THEME.accent;
      svg.appendChild(svgEl('path', { d: d(l.pts), fill: 'none', stroke: col,
        'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      /* apex — 제일 느렸던 지점. 모양 위 어디쯤인지가 요점이다 */
      var apx = null;
      for (var ai = 0; ai < l.pts.length; ai++) { if (l.pts[ai].apex) { apx = l.pts[ai]; break; } }
      if (apx) {
        svg.appendChild(svgEl('circle', { cx: px(apx), cy: py(apx),
          r: 3.6, fill: col, stroke: THEME.bg || 'none', 'stroke-width': 1.2 }));
      }
      /* 진입 끝(가장 이른 점)에 번호 */
      var head = l.pts[0];
      var tx = svgEl('text', { x: px(head) + 5, y: py(head) - 4,
        fill: col, 'font-size': '11' });
      tx.textContent = '#' + l.no;
      svg.appendChild(tx);
    });

    /* 축척 막대 — 미터가 안 적히면 "넓게 돈다" 를 셀 수가 없다 */
    var barM = [5, 10, 20, 25, 50, 100].filter(function (v) {
      return v * k >= 40 && v * k <= (W - 2 * M) * 0.5;
    })[0] || Math.max(5, Math.round((W - 2 * M) / k / 4));
    var bx = M, by = H - 14, bw = barM * k;
    svg.appendChild(svgEl('line', { x1: bx, y1: by, x2: bx + bw, y2: by,
      stroke: THEME.axisText, 'stroke-width': 2 }));
    var bt = svgEl('text', { x: bx + bw + 6, y: by + 4,
      fill: THEME.axisText, 'font-size': '11' });
    bt.textContent = barM + ' m';
    svg.appendChild(bt);

    hostEl.appendChild(svg);
    return {
      poolN: pool.length,
      lines: lines,
      widest: lines.slice().sort(function (p, q) {
        return q.shape.widthM - p.shape.widthM;
      })[0]
    };
  }

  /* §497 apex 정렬 속도 곡선 — 개별 선 대신 **밴드 + 고른 선** (옥대표)
     "그래프에 세일요드처럼 표준편차 부분을 희미하게 표현하는것도 좀
      고려해봐. 아니면 더 나은 방식이 있으면 그렇게 해주고."
      "그래프의 높이가 잘 보이게 설정을 바꿔야할것 같고."

     전에는 고른 회전 수만큼 선을 그렸다. 다섯 개만 넘어도 뭉개져서
     "이 회전이 좋았나" 를 못 읽는다. 두 가지를 바꿨다.

     ① 배경에 **비교 모집단의 25~75% 밴드 + 중앙값**을 깐다. 그래야
        고른 선이 "내 평소보다 위인지 아래인지" 로 읽힌다 — 절대 속도가
        아니라 **자기 대비**가 회전 품질의 진짜 질문이다.
     ② 표준편차(±SD)가 아니라 **사분위**를 쓴다. 회전 속도 곡선은
        apex 근처에서 한쪽으로 쏠린 분포다(잘 돈 회전은 덜 떨어지고
        말아먹은 회전은 크게 떨어진다). 평균±SD 는 그 쏠림에서 밴드를
        실제 데이터가 없는 곳까지 늘린다. 사분위는 항상 실측 안에 있다.
     ③ y 축을 데이터에 맞춰 자른다. 0 부터 그리면 회전의 골이 눌려
        안 보인다 — 옥대표가 말한 "높이" 문제의 실체가 이것이다.

     모집단은 지금 걸린 그룹 필터(§488)를 따른다. 필터가 'all' 인데
     고른 회전이 전부 같은 종류면 그 종류로 좁힌다 — 택 곡선을 자이브
     밴드에 대고 읽는 건 의미가 없다. */

  var TURN_PAD_SEC = 12, TURN_STEP = 0.5;

  /* 한 회전을 apex=0 격자 위에 올린다 */
  function turnCurveOn(S, m, xs) {
    var apexT = S[m.apexIdx] ? S[m.apexIdx].t : null;
    if (apexT == null) return null;
    var pts = [];
    for (var i = 0; i < S.length; i++) {
      var dt = S[i].t - apexT;
      if (dt < -TURN_PAD_SEC) continue;
      if (dt > TURN_PAD_SEC) break;
      if (S[i].speed == null) continue;
      pts.push([dt, S[i].speed * KT]);
    }
    if (pts.length < 3) return null;
    return xs.map(function (xv) {
      var best = null, bd = Infinity;
      for (var j = 0; j < pts.length; j++) {
        var d = Math.abs(pts[j][0] - xv);
        if (d < bd) { bd = d; best = pts[j][1]; }
      }
      return bd <= TURN_STEP ? best : null;
    });
  }

  function quantile(sorted, p) {
    if (!sorted.length) return null;
    var idx = (sorted.length - 1) * p;
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /* 격자 위 곡선 여럿 → x 마다 p25/p50/p75.
     한 x 에 3개 미만이면 밴드를 그리지 않는다 — 두 회전으로 그린
     "사분위" 는 사분위가 아니라 그냥 두 점이다. */
  function turnBand(curves, xs) {
    var lo = [], mid = [], hi = [], n = [];
    xs.forEach(function (_, k) {
      var v = [];
      curves.forEach(function (c) { if (c[k] != null) v.push(c[k]); });
      v.sort(function (x, y) { return x - y; });
      n.push(v.length);
      if (v.length < 3) { lo.push(null); mid.push(null); hi.push(null); return; }
      lo.push(quantile(v, 0.25));
      mid.push(quantile(v, 0.50));
      hi.push(quantile(v, 0.75));
    });
    return { lo: lo, mid: mid, hi: hi, n: n };
  }

  function drawTurnCurves(hostEl, picked, sel, a) {
    if (!window.uPlot || !CUR.session) return;
    var S = CUR.session.samples || [];
    if (!S.length) return;

    var xs = [];
    for (var x = -TURN_PAD_SEC; x <= TURN_PAD_SEC; x += TURN_STEP) xs.push(x);

    /* ---- 고른 회전 ---- */
    var lines = [];
    picked.forEach(function (m, k) {
      var ys = turnCurveOn(S, m, xs);
      if (ys) lines.push({ m: m, ys: ys, no: sel[k] + 1 });
    });
    if (!lines.length) { hostEl.textContent = 'No speed samples around these turns.'; return; }

    /* ---- 비교 모집단 ---- */
    var mans = (a && a.maneuvers) || [];
    var pType = TURNFILT.type, pSide = TURNFILT.side;
    if (pType === 'all') {
      var types = {};
      picked.forEach(function (m) { types[m.type] = 1; });
      var tk = Object.keys(types);
      if (tk.length === 1) pType = tk[0];
    }
    var pool = mans.filter(function (m) {
      if (pType !== 'all' && m.type !== pType) return false;
      if (pSide !== 'all' && m.side !== pSide) return false;
      return true;
    });
    var poolCurves = [];
    pool.forEach(function (m) {
      var ys = turnCurveOn(S, m, xs);
      if (ys) poolCurves.push(ys);
    });
    var band = poolCurves.length >= 3 ? turnBand(poolCurves, xs) : null;

    /* ---- y 범위: 실제로 그리는 값에만 맞춘다 ---- */
    var vMin = Infinity, vMax = -Infinity;
    function span(arr) {
      arr.forEach(function (v) {
        if (v == null) return;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      });
    }
    lines.forEach(function (l) { span(l.ys); });
    if (band) { span(band.lo); span(band.hi); }
    if (!isFinite(vMin) || !isFinite(vMax) || vMax <= vMin) { vMin = 0; vMax = 20; }
    var padY = Math.max(0.6, (vMax - vMin) * 0.10);
    var yLo = Math.max(0, vMin - padY), yHi = vMax + padY;

    /* ---- 계열 조립 ---- */
    var data = [xs], opts = [], bands = [];
    var bandFill = (currentThemeName() === 'light')
      ? 'rgba(100,116,139,0.20)' : 'rgba(148,163,184,0.18)';

    if (band) {
      data.push(band.hi); data.push(band.lo); data.push(band.mid);
      opts.push({ label: 'Typical 75%', stroke: 'transparent', width: 0,
                  points: { show: false },
                  value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } });
      opts.push({ label: 'Typical 25%', stroke: 'transparent', width: 0,
                  points: { show: false },
                  value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } });
      opts.push({ label: 'Typical (median of ' + poolCurves.length + ')',
                  stroke: THEME.dim, width: 2, dash: [5, 4],
                  points: { show: false },
                  value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } });
      bands.push({ series: [1, 2], fill: bandFill });
    }

    /* 선이 너무 많으면 개별 선 대신 **고른 것들의 중앙값** 하나로.
       여덟 개가 한계다 — 그 위로는 색을 구분해도 눈이 못 따라간다. */
    var MANY = 8;
    if (lines.length > MANY) {
      var selBand = turnBand(lines.map(function (l) { return l.ys; }), xs);
      data.push(selBand.mid);
      opts.push({ label: 'Selected (median of ' + lines.length + ')',
                  stroke: THEME.accent, width: 2.6, points: { show: false },
                  value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } });
    } else {
      lines.forEach(function (l) {
        data.push(l.ys);
        opts.push({
          label: '#' + l.no + ' ' + (l.m.type === 'tack' ? 'tack' : 'gybe')
               + (l.m.side === 'P' ? ' P' : l.m.side === 'S' ? ' S' : ''),
          stroke: l.m.side === 'P' ? '#e03131' : '#2f9e44',
          width: 2.2, points: { show: false },
          value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; }
        });
      });
    }

    track(new uPlot({
      width: hostEl.clientWidth || 860, height: 280, padding: [12, 14, 4, 6],
      cursor: { drag: { x: true, y: false } },
      scales: { x: { time: false }, y: { range: [yLo, yHi] } },
      bands: bands,
      axes: [
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, ticks) {
            return ticks.map(function (v) {
              return (v > 0 ? '+' : '') + v.toFixed(0) + ' s';
            });
          } },
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 44,
          values: function (u, ticks) {
            return ticks.map(function (v) { return v.toFixed(0) + ' kt'; });
          } }
      ],
      series: [{ label: 'From apex',
                 value: function (u, v) {
                   return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + ' s';
                 } }].concat(opts)
    }, data, hostEl), hostEl);

    return {
      poolN: poolCurves.length,
      banded: !!band,
      poolLabel: (pType === 'all' ? 'turns' : pType === 'tack' ? 'tacks' : 'gybes')
        + (pSide === 'P' ? ' on port' : pSide === 'S' ? ' on starboard' : ''),
      collapsed: lines.length > MANY
    };
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
        rows.push({ label: t[1] + ' \u00b7 ' + sd[1], side: sd[0],
                    isAll: sd[0] === 'all', v: v });
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
      var tdG = el('td');
      /* '양쪽' 행은 색이 없다 — 점이 있으면 한쪽을 가리키는 뜻이 된다 */
      if (r.isAll) tdG.textContent = r.label;
      else tdG.appendChild(sideTag(r.side, r.label));
      tr.appendChild(tdG);
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
  var TDIST = { metric: 'sog', mode: 'upwind', shape: 'violin', tier: 'all' };

  /* §504 (V1) — 포트/스타보드 박스플롯.
     바이올린은 분포의 생김새를 보여 주고, 이건 **중앙값과 사분위를
     정확히** 읽게 한다. 두 상자의 중앙선이 어긋난 정도가 곧 Tack bias 다.
     가로축이 값이므로 상자는 **가로로 눕는다**(바이올린과 축이 같아
     토글해도 눈이 다시 적응할 필요가 없다).

     ⚠ 표본이 5개 미만이면 상자를 그리지 않는다 — 사분위가 없는데
     사분위 그림을 그리면 없는 확신을 보여 준다(§497 과 같은 규칙).
     밴티지는 n=1 로도 박스를 그린다. */
  function drawTackBox(svg, W, H, pv, sv, lo, hi) {
    var NS = 'http://www.w3.org/2000/svg';
    function q(sorted, f) {
      if (!sorted.length) return null;
      var i = (sorted.length - 1) * f, a2 = Math.floor(i), b2 = Math.ceil(i);
      return a2 === b2 ? sorted[a2] : sorted[a2] + (sorted[b2] - sorted[a2]) * (i - a2);
    }
    var span = (hi - lo) || 1;
    function X(v) { return ((v - lo) / span) * W; }
    function add(tag, attrs) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      svg.appendChild(e);
      return e;
    }
    function box(arr, cy, color, label) {
      if (arr.length < 5) {
        add('text', { x: 6, y: cy + 4, fill: THEME.axisText, 'font-size': 12 })
          .textContent = label + ' — too few samples (' + arr.length + ') for a box';
        return;
      }
      var v = arr.slice().sort(function (x, y) { return x - y; });
      var q1 = q(v, 0.25), med = q(v, 0.5), q3 = q(v, 0.75);
      var iqr = q3 - q1;
      /* 수염은 1.5×IQR 안의 실제 값까지 (표준 Tukey) */
      var loW = q1 - 1.5 * iqr, hiW = q3 + 1.5 * iqr;
      var wLo = v.find(function (x) { return x >= loW; });
      var wHi = null;
      for (var i = v.length - 1; i >= 0; i--) { if (v[i] <= hiW) { wHi = v[i]; break; } }
      if (wLo == null) wLo = v[0];
      if (wHi == null) wHi = v[v.length - 1];
      var bh = 26;
      /* 수염 */
      add('line', { x1: X(wLo), x2: X(wHi), y1: cy, y2: cy,
                    stroke: color, 'stroke-width': 1.5 });
      [wLo, wHi].forEach(function (x) {
        add('line', { x1: X(x), x2: X(x), y1: cy - 7, y2: cy + 7,
                      stroke: color, 'stroke-width': 1.5 });
      });
      /* 상자 */
      add('rect', { x: X(q1), width: Math.max(1, X(q3) - X(q1)),
                    y: cy - bh / 2, height: bh,
                    fill: color, 'fill-opacity': 0.28,
                    stroke: color, 'stroke-width': 1.5, rx: 2 });
      /* 중앙값 */
      add('line', { x1: X(med), x2: X(med), y1: cy - bh / 2, y2: cy + bh / 2,
                    stroke: color, 'stroke-width': 2.5 });
      /* 이상치 */
      v.forEach(function (x) {
        if (x < wLo || x > wHi) {
          add('circle', { cx: X(x), cy: cy, r: 2, fill: color, 'fill-opacity': 0.6 });
        }
      });
    }
    box(pv, H * 0.30, '#e03131', 'Port');
    box(sv, H * 0.70, '#2f9e44', 'Starboard');
  }

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
    /* §504 (V1) — 모양 토글. 바이올린은 분포의 **생김새**(꼬리·쌍봉)를
       보여 주고, 박스플롯은 **중앙값과 사분위를 정확히** 읽게 해 준다.
       택 비교는 후자가 낫다 — 두 상자의 중앙선이 얼마나 어긋났는지가
       Tack bias 의 Diff 와 같은 것을 눈으로 보여 주기 때문이다. */
    act.appendChild(pick([['violin', 'Violin'], ['box', 'Box plot']],
      'shape', TDIST.shape, function (v) {
        TDIST.shape = v; renderPerfExtra(a);
      }));
    /* §504 — 모집단. Tack bias 스위치(§503)와 같은 질문에 답한다:
       느린 시간을 빼면 그림이 달라지는가. */
    act.appendChild(pick([['all', 'All'], ['t50', 'Best 50%'], ['t20', 'Best 20%']],
      'tier', TDIST.tier, function (v) {
        TDIST.tier = v; renderPerfExtra(a);
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

    /* §504 모집단 — '좋은 방향' 을 따라 자른다. 속도·VMG 는 큰 쪽이,
       풍상 CWA 는 작은 쪽이 상위다. 지표마다 방향이 다르므로
       무조건 큰 값을 남기면 풍상 각도에서 **정반대**를 뽑게 된다
       (§420 에서 겪은 것과 같은 함정). */
    if (TDIST.tier !== 'all') {
      var keep = (TDIST.tier === 't20') ? 0.20 : 0.50;
      var lowIsBetter = (M === 'twa' && TDIST.mode === 'upwind');
      var cut = function (arr) {
        if (arr.length < 5) return arr;      /* 너무 적으면 자르지 않는다 */
        var v = arr.slice().sort(function (x, y) { return x - y; });
        var n = Math.max(3, Math.round(v.length * keep));
        return lowIsBetter ? v.slice(0, n) : v.slice(v.length - n);
      };
      pv = cut(pv); sv = cut(sv);
    }
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
    if (TDIST.shape === 'box') {
      drawTackBox(svg, W, H, pv, sv, lo, hi);
    } else {
      bars(hp, true, '#e03131');     /* 포트 = 적색 (국제 관례) */
      bars(hs, false, '#2f9e44');    /* 스타보드 = 녹색 */
      var axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      axis.setAttribute('x1', 0); axis.setAttribute('x2', W);
      axis.setAttribute('y1', MID); axis.setAttribute('y2', MID);
      axis.setAttribute('stroke', THEME.grid);
      svg.appendChild(axis);
    }
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
    /* 위/아래는 바이올린 얘기다 — 박스 모드에선 맞지 않는다 */
    var isBox = (TDIST.shape === 'box');
    leg.appendChild(chip('#e03131', isBox ? 'Port (top)' : 'Port (above)', pv));
    leg.appendChild(chip('#2f9e44', isBox ? 'Starboard (bottom)' : 'Starboard (below)', sv));
    if (TDIST.tier !== 'all') {
      leg.appendChild(el('span', 'text-secondary',
        '\u00b7 ' + (TDIST.tier === 't20' ? 'best 20%' : 'best 50%') + ' only'
        + ((M === 'twa' && TDIST.mode === 'upwind') ? ' (closest angles)' : '')));
    }
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

  /* ============================================================
   * §498 트림 요구량 — "속도가 변하면 붐을 얼마나 더 당겨야 하나" (B1)
   *
   * 원래 B1 은 "AWA 별 속도 곡선 = 본인 최적 AWA 밴드" 였다. **폐기했다.**
   * AWA 는 속도로부터 계산되는 값이라(AWA = atan2(TWS·sinTWA,
   * TWS·cosTWA + V)) CWA 를 고정하면 AWA↔속도가 동어반복이 된다.
   * 옥대표 8/31 세션 실측으로 확인: CWA 45–55° 에서 r = −0.959,
   * 55–65° 에서 −0.993. "AWA 22°에서 제일 빠르다" 는 발견이 아니라
   * **정의**다 — 빠르니까 AWA 가 22°인 것이다.
   * (전체 상관은 0.222 로 낮아 보이는데, 그건 CWA 가 섞여서 그렇다.
   *  이 함정 때문에 순진하게 만들면 그럴듯한 가짜 차트가 나온다.)
   *
   * 순환이 아닌 질문으로 바꿨다:
   *   AoA = AWA − 붐각.  윙의 목표 AoA 는 대체로 일정하다.
   *   → **ΔAWA 가 그대로 Δ붐각 요구량이다.**
   *
   * 절대 붐각은 못 낸다 — 윙의 양력곡선 기울기와 영양력각을 모른다.
   * 하지만 **변화량은 낼 수 있고, 코칭에 필요한 건 그쪽이다.**
   * "지금보다 5kt 빨라지면 붐을 3° 더 당겨야 한다" 는 실행 가능한 문장이다.
   *
   * 닫힌 루프(실제로 얼마나 당겼는지 감지)는 붐 IMU 가 있어야 한다 —
   * backlog B6. 이건 열린 루프다.
   * ============================================================ */

  function awaAt(twaDeg, vKt, twsKt) {
    var r = twaDeg * Math.PI / 180;
    return Math.atan2(twsKt * Math.sin(r), twsKt * Math.cos(r) + vKt) * 180 / Math.PI;
  }

  var TRIM_BANDS = [
    { key: 'up',   label: 'Upwind',   lo: 35,  hi: 65,  rep: 50 },
    { key: 'reach',label: 'Reaching', lo: 65,  hi: 110, rep: 90 },
    { key: 'down', label: 'Downwind', lo: 110, hi: 165, rep: 135 }
  ];

  function pctOf(sorted, f) {
    if (!sorted.length) return null;
    var i = (sorted.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  function renderTrimDemand(host, session, analysis) {
    var wind = analysis && analysis.wind;
    var twsKt = wind && wind.windSpeedKt;
    var wd = wind && wind.windDir;
    if (twsKt == null || wd == null || !(twsKt > 0)) {
      var warn = el('div', 'alert alert-warning');
      warn.appendChild(el('div', 'fw-bold', 'Trim demand needs a wind speed'));
      warn.appendChild(el('div', 'mt-1',
        'Set the wind speed above and this panel will show how much boom angle '
        + 'each speed change asks for.'));
      host.appendChild(warn);
      return;
    }

    /* 세션에서 실제로 쓴 코스와 속도 */
    var S = (session.samples || []);
    var byBand = {};
    TRIM_BANDS.forEach(function (b) { byBand[b.key] = []; });
    /* 시간은 **샘플 수가 아니라 실제 dt 합**이다. 1Hz 가정은 기기마다
       깨지고(RaceBox 25Hz), 기록 공백이 있으면 더 크게 틀린다. */
    var gapMax = (session.cfg && session.cfg.gapThresholdSec) || 8;
    for (var k = 0; k < S.length; k++) {
      var p = S[k];
      if (p.speed == null || p.heading == null) continue;
      var v = p.speed * KT;
      if (v < 6) continue;   /* 활주 전 저속은 트림 얘기가 아니다 */
      var dt = (k > 0) ? (p.t - S[k - 1].t) : 0;
      if (!(dt > 0) || dt > gapMax) dt = 0;
      var twa = Math.abs(((p.heading - wd + 540) % 360) - 180);
      for (var i = 0; i < TRIM_BANDS.length; i++) {
        var b = TRIM_BANDS[i];
        if (twa >= b.lo && twa < b.hi) { byBand[b.key].push({ twa: twa, v: v, dt: dt }); break; }
      }
    }

    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Trim demand — boom angle a speed change asks for'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    body.appendChild(el('div', 'text-secondary mb-3',
      'Angle of attack is the apparent wind angle minus your boom angle. The wing wants '
      + 'roughly the same angle of attack throughout, so when the apparent wind swings, '
      + 'the boom has to follow it by the same amount. This panel shows how far it swings '
      + 'across the speeds you actually rode at ' + twsKt.toFixed(0) + ' kt of wind.'));

    var wrap = el('div', 'table-responsive');
    var t = el('table', 'table table-vcenter card-table table-sm');
    var th = el('thead'), htr = el('tr');
    ['Course', 'Time', 'Your speed range', 'Apparent wind swings', 'Boom must follow']
      .forEach(function (x, i) { htr.appendChild(el('th', i > 1 ? 'text-end' : null, x)); });
    th.appendChild(htr); t.appendChild(th);
    var tb = el('tbody');

    var rows = 0, biggest = null;
    TRIM_BANDS.forEach(function (b) {
      var g = byBand[b.key];
      if (g.length < 40) return;
      rows++;
      var vs = g.map(function (d) { return d.v; }).sort(function (x, y) { return x - y; });
      var twaMed = g.map(function (d) { return d.twa; }).sort(function (x, y) { return x - y; });
      var tRep = pctOf(twaMed, 0.5);
      var v10 = pctOf(vs, 0.10), v90 = pctOf(vs, 0.90);
      var a10 = awaAt(tRep, v10, twsKt), a90 = awaAt(tRep, v90, twsKt);
      var swing = Math.abs(a10 - a90);
      if (!biggest || swing > biggest.swing) biggest = { b: b, swing: swing };

      var tr = el('tr');
      tr.appendChild(el('td', null, b.label + ' · ' + Math.round(tRep) + '°'));
      var secs = 0;
      g.forEach(function (d) { secs += d.dt; });
      tr.appendChild(el('td', null, fmtClock(secs)));
      tr.appendChild(el('td', 'text-end num', v10.toFixed(1) + '–' + v90.toFixed(1) + ' kt'));
      tr.appendChild(el('td', 'text-end num',
        Math.round(a10) + '° → ' + Math.round(a90) + '°'));
      var td = el('td', 'text-end num fw-bold', swing.toFixed(1) + '°');
      tr.appendChild(td);
      tb.appendChild(tr);
    });

    if (!rows) {
      body.appendChild(el('div', 'alert alert-warning',
        'Not enough riding in any one course band to read a trim demand from.'));
      card.appendChild(body); host.appendChild(card); return;
    }
    t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);

    /* 왜 풍하가 더 큰가 — 이게 이 패널의 요점이다 */
    var up = byBand.up.length >= 40, down = byBand.down.length >= 40;
    if (up && down) {
      var uS = byBand.up.map(function (d) { return d.v; }).sort(function (a, c) { return a - c; });
      var dS = byBand.down.map(function (d) { return d.v; }).sort(function (a, c) { return a - c; });
      var uSw = Math.abs(awaAt(50, pctOf(uS, 0.10), twsKt) - awaAt(50, pctOf(uS, 0.90), twsKt));
      var dSw = Math.abs(awaAt(135, pctOf(dS, 0.10), twsKt) - awaAt(135, pctOf(dS, 0.90), twsKt));
      if (uSw > 0.5) {
        body.appendChild(el('div', 'alert alert-info mt-3',
          'Downwind asks for ' + (dSw / uSw).toFixed(1) + '× the trim movement upwind does '
          + 'over the same speed spread — ' + dSw.toFixed(0) + '° against '
          + uSw.toFixed(0) + '°. That is geometry, not technique: heading away from the wind '
          + 'makes the apparent wind angle far more sensitive to boat speed. It is why a gybe exit '
          + 'punishes a late sheet-in much harder than a tack exit does.'));
      }
    }

    /* 곡선 — 실제로 탄 속도 구간을 강조 */
    var plot = el('div', 'chart-host mt-3');
    plot.style.height = '260px';
    body.appendChild(plot);

    var cap = el('div', 'lab mt-1');
    cap.textContent = 'Apparent wind angle against boat speed at ' + twsKt.toFixed(0)
      + ' kt true wind. Flatter is more forgiving — the boom can stay put while speed moves.';
    body.appendChild(cap);

    card.appendChild(body);
    host.appendChild(card);
    drawTrimCurves(plot, twsKt, byBand);

    /* 정직하게 — 절대값은 못 낸다 */
    var honest = el('div', 'text-secondary mt-2');
    honest.style.fontSize = '12px';
    honest.textContent = 'This is the change in boom angle, not the angle itself — that would '
      + 'need your wing’s lift curve, which we do not have. And it is open loop: it says what '
      + 'the boom should do, not what it did. Detecting that needs a sensor on the boom.';
    body.appendChild(honest);
  }

  function drawTrimCurves(hostEl, twsKt, byBand) {
    if (!window.uPlot) return;
    var xs = [];
    for (var v = 6; v <= 28; v += 0.5) xs.push(v);
    var data = [xs], opts = [];
    var colors = { up: '#4dabf7', reach: '#f59f00', down: '#e03131' };
    TRIM_BANDS.forEach(function (b) {
      var g = byBand[b.key];
      if (g.length < 40) return;
      var twaMed = g.map(function (d) { return d.twa; }).sort(function (x, y) { return x - y; });
      var tRep = pctOf(twaMed, 0.5);
      data.push(xs.map(function (vv) { return awaAt(tRep, vv, twsKt); }));
      opts.push({
        label: b.label + ' (' + Math.round(tRep) + '°)',
        stroke: colors[b.key], width: 2.2, points: { show: false },
        value: function (u, val) { return val == null ? '—' : val.toFixed(1) + '°'; }
      });
    });
    if (!opts.length) { hostEl.style.display = 'none'; return; }

    track(new uPlot({
      width: hostEl.clientWidth || 860, height: 240, padding: [12, 14, 4, 6],
      cursor: { drag: { x: true, y: false } },
      scales: { x: { time: false } },
      axes: [
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, ticks) {
            return ticks.map(function (v) { return v.toFixed(0) + ' kt'; });
          } },
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace', size: 46,
          values: function (u, ticks) {
            return ticks.map(function (v) { return v.toFixed(0) + '°'; });
          } }
      ],
      series: [{ label: 'Boat speed',
                 value: function (u, v) { return v == null ? '—' : v.toFixed(1) + ' kt'; } }]
               .concat(opts)
    }, data, hostEl), hostEl);
  }

  function renderAttitude(session, analysis, fusion) {
    var host = $('attitude-body');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    /* §498 B1 — 트림 요구량은 IMU 가 없어도 나온다(GPS + 풍속이면 충분).
       그래서 자세 게이트보다 **앞에** 그린다. */
    try { renderTrimDemand(host, session, analysis); } catch (e) {}

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

  /* §520 V2 (옥대표 1순위) — 세션별 장비.
     RDGear 는 **라이더 프로필에 한 벌**이라 세션에 안 붙었다. 그래서
     "6.0 이랑 5.0 중 뭐가 나았나" 를 물을 수가 없다 — 데이터는 다 있는데
     라벨이 없다. §482 가 포일을 예측에 배선해 놨는데 과거 세션에는
     그때 무슨 포일이었는지 기록이 없는 것도 같은 이유다.

     저장 시점의 선택을 **스냅샷**으로 떠서 레코드에 박는다. 나중에
     프로필 장비를 바꿔도 지난 세션의 라벨은 안 흔들려야 한다 —
     참조(id만 저장)로 두면 프로필을 바꾸는 순간 과거가 소급해 바뀐다. */
  /* §520 — 지난 세션의 장비를 지금 채운다. 인라인 폼 한 줄:
     핸드윙 · 앞포일 · 보드. 이 셋이 비교에서 실제로 쓰이는 축이다.
     나머지(마스트·하네스·수면)는 스냅샷에만 담고 여기선 묻지 않는다 —
     기억으로 적는 자리라 물을수록 정확도가 떨어진다. */
  function openGearBackfill(rec) {
    if (!window.RDGear || !window.RDStorage || !RDStorage.setSessionGear) return;
    var host = $('sessions-body') || document.body;
    var old = document.getElementById('gear-backfill');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var box = el('div', 'card mt-2'); box.id = 'gear-backfill';
    var b = el('div', 'card-body');
    b.appendChild(el('div', 'fw-bold',
      'What did you use on ' + (rec.name || 'this session') + '?'));
    b.appendChild(el('div', 'text-secondary mt-1',
      'Recorded as filled in later, so it is never confused with a session '
      + 'that had its gear captured at save time.'));

    var row = el('div', 'd-flex flex-wrap gap-3 mt-2 align-items-end');
    var picks = {};
    function pick(label, key, bank) {
      var w = el('div');
      w.appendChild(el('div', 'lab', label));
      var sel = el('select', 'form-select form-select-sm');
      sel.style.width = 'auto';
      var none = document.createElement('option');
      none.value = ''; none.textContent = "don't know";
      sel.appendChild(none);
      bank.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.id; op.textContent = o.label || o.name || o.id;
        sel.appendChild(op);
      });
      w.appendChild(sel);
      picks[key] = sel;
      row.appendChild(w);
    }
    pick('Hand wing', 'handWing', RDGear.HAND_WINGS);
    pick('Front foil', 'frontWing', RDGear.FRONT_WINGS);
    pick('Board', 'board', RDGear.BOARDS);

    var save = el('button', 'btn btn-sm btn-primary', 'Save gear');
    save.type = 'button';
    var msg = el('div', 'lab mt-2');
    save.addEventListener('click', function () {
      var g = {};
      function put(key, bank, nameKey) {
        var id = picks[key].value;
        if (!id) return;
        g[key] = id;
        var o = RDGear.byId(bank, id);
        if (o) {
          g[nameKey] = o.label || o.name || o.id;
          if (o.areaM2 != null) g.wingM2 = o.areaM2;
          if (o.areaCm2 != null && key === 'frontWing') g.foilAreaCm2 = o.areaCm2;
          if (o.ar != null && key === 'frontWing') g.foilAR = o.ar;
        }
      }
      put('handWing', RDGear.HAND_WINGS, 'handWingName');
      put('frontWing', RDGear.FRONT_WINGS, 'frontWingName');
      put('board', RDGear.BOARDS, 'boardName');
      if (!Object.keys(g).length) {
        msg.textContent = 'Nothing picked \u2014 choose at least one.';
        return;
      }
      var r = RDStorage.setSessionGear(rec.id, g);
      if (!r.ok) { msg.textContent = 'Could not save: ' + (r.error || 'unknown'); return; }
      if (box.parentNode) box.parentNode.removeChild(box);
      renderSessions();
    });
    row.appendChild(save);

    var cancel = el('button', 'btn btn-sm', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    row.appendChild(cancel);

    b.appendChild(row); b.appendChild(msg);
    box.appendChild(b);
    host.appendChild(box);
    box.scrollIntoView({ block: 'nearest' });
  }

  function gearSnapshot() {
    if (!window.RDGear) return null;
    var sel;
    try { sel = gearSelection(); } catch (e) { return null; }
    if (!sel) return null;
    function nameOf(bank, id) {
      var o = RDGear.byId(bank, id);
      return o ? (o.label || o.name || o.id) : null;
    }
    var handW = RDGear.byId(RDGear.HAND_WINGS, sel.handWing);
    var frontW = RDGear.byId(RDGear.FRONT_WINGS, sel.frontWing);
    var g = {
      handWing: sel.handWing, handWingName: nameOf(RDGear.HAND_WINGS, sel.handWing),
      frontWing: sel.frontWing, frontWingName: nameOf(RDGear.FRONT_WINGS, sel.frontWing),
      rearWing: sel.rearWing, mast: sel.mast, board: sel.board,
      boardName: nameOf(RDGear.BOARDS, sel.board),
      harness: sel.harness, surface: sel.surface
    };
    /* 폼의 윙 면적은 장비 목록과 어긋날 수 있다(직접 입력). 둘 다 남긴다 */
    var wf = parseFloat(($('in-wing') || {}).value);
    if (isFinite(wf)) g.wingM2Form = wf;
    if (handW && handW.areaM2 != null) g.wingM2 = handW.areaM2;
    else if (isFinite(wf)) g.wingM2 = wf;
    if (frontW) {
      if (frontW.areaCm2 != null) g.foilAreaCm2 = frontW.areaCm2;
      if (frontW.ar != null) g.foilAR = frontW.ar;
    }
    return g;
  }

  /* 화면에 한 줄로 — 없는 항목은 조용히 뺀다 */
  function gearLabel(g) {
    if (!g) return null;
    var parts = [];
    if (g.wingM2 != null) parts.push(g.wingM2 + ' m\u00b2'
      + (g.handWingName ? ' ' + g.handWingName : ''));
    else if (g.handWingName) parts.push(g.handWingName);
    if (g.frontWingName) parts.push(g.frontWingName);
    if (g.boardName) parts.push(g.boardName);
    return parts.length ? parts.join(' \u00b7 ') : null;
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

  /* ============================================================
   * §512 풍하 파워 — 윙 크기의 진짜 구속조건 (옥대표 2026-09-02)
   *
   * 옥대표: "풍상에서 약간 챌린지 하는게 좋아. 풍상이 너무 편안하면
   *          풍하는 거의 모자랄 경우가 많아."
   *
   * 계산으로 확인된다. 윙이 실제로 받는 건 진풍이 아니라 **겉보기 풍속**
   * 이고, 힘은 그 **제곱**에 비례한다(q = ½ρV²).
   *   · 풍상 — 보트 속도가 겉보기 바람에 **더해진다** → AWS 가 커진다
   *   · 풍하 — 바람에서 **도망가므로** 속도가 겉보기 바람을 깎는다
   *
   * 강릉 세션 실측(TWS 14kt): 풍상 AWS 25.1kt vs 풍하 14.2kt.
   * 비 0.56 → 힘은 **0.32배**. 풍하에서 윙이 3분의 1 힘밖에 못 낸다.
   *
   * 그리고 **바람이 셀수록 벌어진다** — 풍하 AWS 는 진풍이 12→20kt 로
   * 올라도 14.6→14.7kt 로 거의 그대로다(빨라진 만큼 도로 깎이니까).
   * 반면 풍상은 23.3→30.7kt 로 계속 큰다. 힘 비 0.39 → 0.23.
   *
   * ⚠ 이것이 기존 '편안함 추천'(정점 −0.5㎡)이 **거꾸로**인 이유다.
   *   그 추천은 풍하를 더 허전하게 만든다. 풍상 정점은 **하한이지
   *   상한이 아니다.**
   *
   * ⚠ 한계 — 풍하 AWS 절대값은 입력 풍속 오차를 거의 1:1 로 물려받는다
   *   (§494 · backlog D4). **비율은 믿을 만하고 절대값은 추세로** 읽는다.
   * ============================================================ */
  function downwindPower(a) {
    var ts = a && a.wind && a.wind.tackSplit;
    if (!ts) return null;
    function awsOf(mode) {
      var arr = (ts[mode] && ts[mode].all && ts[mode].all.samples) || [];
      var v = [], sog = [], twa = [];
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        if (p.aws == null || !isFinite(p.aws)) continue;
        v.push(p.aws * KT);
        if (p.sog != null) sog.push(p.sog * KT);
        if (p.twa != null) twa.push(p.twa);
      }
      if (v.length < 30) return null;          /* 근거가 얇으면 말하지 않는다 */
      function mean(x) {
        var s = 0; for (var k = 0; k < x.length; k++) s += x[k];
        return s / x.length;
      }
      return { aws: mean(v), sog: sog.length ? mean(sog) : null,
               twa: twa.length ? mean(twa) : null, n: v.length };
    }
    var up = awsOf('upwind'), dn = awsOf('downwind');
    if (!up || !dn || !(up.aws > 0)) return null;
    var ratio = dn.aws / up.aws;
    return { up: up, dn: dn, awsRatio: ratio,
             forceRatio: ratio * ratio,        /* 힘 ∝ AWS² */
             areaForParity: 1 / (ratio * ratio) };
  }

  function renderDownwindPower(host, a) {
    var d = downwindPower(a);
    if (!d) return;
    var card = el('div', 'card mb-3');
    var head = el('div', 'card-header');
    head.appendChild(el('h3', 'card-title', 'Downwind is where the wing runs out'));
    card.appendChild(head);
    var body = el('div', 'card-body');

    var row = el('div', 'd-flex align-items-center justify-content-between');
    function cell(label, val, sub) {
      var c = el('div', 'text-center');
      c.appendChild(el('div', 'lab', label));
      c.appendChild(el('div', 'kpi__val num mt-1', val));
      if (sub) c.appendChild(el('div', 'lab', sub));
      return c;
    }
    row.appendChild(cell('Apparent wind upwind', d.up.aws.toFixed(1),
      'kt' + (d.up.twa != null ? '  ·  ' + Math.round(d.up.twa) + '°' : '')));
    var mid = el('div', 'text-center px-3');
    mid.appendChild(el('div', 'lab', 'Wing force downwind'));
    var pv = el('div', 'kpi__val num mt-1', Math.round(d.forceRatio * 100) + '%');
    pv.style.color = d.forceRatio < 0.35 ? THEME.warn : THEME.accent;
    mid.appendChild(pv);
    mid.appendChild(el('div', 'lab', 'of what it gets upwind'));
    row.appendChild(mid);
    row.appendChild(cell('Apparent wind downwind', d.dn.aws.toFixed(1),
      'kt' + (d.dn.twa != null ? '  ·  ' + Math.round(d.dn.twa) + '°' : '')));
    body.appendChild(row);

    var why = el('div', 'alert alert-info mt-3');
    why.appendChild(el('div', 'fw-bold', 'Why the two are so far apart'));
    why.appendChild(el('div', 'mt-1',
      'The wing feels apparent wind, not true wind, and force goes with its '
      + 'square. Upwind your speed adds to the wind, so apparent wind climbs to '
      + d.up.aws.toFixed(1) + ' kt. Downwind you are sailing away from it, so your '
      + 'speed cancels it back down to ' + d.dn.aws.toFixed(1) + ' kt. '
      + 'That is ' + (d.awsRatio * 100).toFixed(0) + '% of the wind speed but only '
      + Math.round(d.forceRatio * 100) + '% of the force — you would need about '
      + d.areaForParity.toFixed(1) + '× the wing area downwind to match the '
      + 'pull you get upwind.'));
    body.appendChild(why);

    var flip = el('div', 'alert alert-warning mt-2');
    flip.appendChild(el('div', 'fw-bold', 'So size for downwind, not for upwind comfort'));
    flip.appendChild(el('div', 'mt-1',
      'A wing that feels easy upwind will be short downwind — and the gap widens '
      + 'as it blows harder, because downwind apparent wind barely rises with true '
      + 'wind while upwind it keeps climbing. Read the upwind peak below as a '
      + 'floor, not a ceiling: going a size under it buys upwind comfort and pays '
      + 'for it downwind.'));
    body.appendChild(flip);

    var caveat = el('div', 'lab mt-2');
    caveat.textContent = 'The ratio is solid, the absolute numbers less so — '
      + 'apparent wind speed inherits your wind-speed input almost one for one, '
      + 'so read ' + d.up.aws.toFixed(1) + ' and ' + d.dn.aws.toFixed(1)
      + ' kt as a trend rather than a measurement.';
    body.appendChild(caveat);

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
    /* §512 — 풍하 파워를 먼저 보여 준다. 아래 추천이 **풍상 전용**이라
       그 맥락 없이 읽으면 거꾸로 간다(옥대표: 풍상이 편하면 풍하가 모자라다). */
    try { renderDownwindPower(host, a); } catch (e) {}

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

    /* §511 — 엔진은 optimumAtBoundary 와 comfortWingM2 를 이미 주는데
       v2 가 둘 다 **무시하고 있었다**(구 대시보드 app.js 는 쓴다).
       그래서 약풍에서 스윕 상한(7.4㎡)이 그대로 '추천' 으로 나갔다:
       10kt 에서 7.4㎡ · +4.6kt 라고 단언했는데, 그건 답이 아니라
       "모델이 더 큰 걸 원하는데 우리가 볼 수 있는 범위가 여기까지" 라는
       뜻이다. §498(AWS 배선)·§482(포일 배선)와 같은 종류 — 값은 이미
       있었고 읽는 쪽이 없었다. */
    if (whatIf.optimumAtBoundary) {
      var b = el('div', 'alert alert-warning');
      b.appendChild(el('div', 'fw-bold', 'This is the edge of what the model can judge'));
      var rng = whatIf.sweep
        ? whatIf.sweep.min + '–' + whatIf.sweep.max + ' m²' : 'the sweep range';
      b.appendChild(el('div', 'mt-1',
        'The peak sits on the boundary of ' + rng + ', so the model wants a bigger '
        + 'wing than it is allowed to consider. Read the number as “bigger would help”, '
        + 'not as a size to buy — and the gain figure is least reliable here, because '
        + 'the light-wind end of the speed model is the part still waiting on measured '
        + 'wind (backlog D1).'));
      host.appendChild(b);
    }

    /* §512 — 예전에 여기 '편안함 추천'(정점 −0.5㎡)이 있었다. **뺐다.**
       그 권고는 풍상만 보고 만든 것이라 풍하를 더 허전하게 만든다 —
       위 카드가 보여 주듯 풍하에서 윙이 받는 힘은 풍상의 1/3 수준이고,
       바람이 셀수록 더 벌어진다. 옥대표 경험칙("풍상이 너무 편안하면
       풍하는 거의 모자란다")과 계산이 같은 말을 한다.
       대신 **정점이 하한이라는 것**과 한 사이즈 작게 갔을 때 무엇을
       내주는지를 적는다. */
    if (whatIf.comfortWingM2 != null && whatIf.optimumWingM2 != null) {
      var same = Math.round(whatIf.comfortWingM2 * 2) === Math.round(whatIf.optimumWingM2 * 2);
      var c = el('div', 'alert alert-secondary');
      if (same) {
        c.textContent = whatIf.optimumWingM2 + ' m² is also the smallest wing that still '
          + 'holds upwind here, so there is nothing below it to consider.';
      } else {
        var isActual = Math.round(whatIf.comfortWingM2 * 2)
                    === Math.round(whatIf.actualWingM2 * 2);
        c.appendChild(el('div', 'fw-bold',
          'Going a size under the peak (' + whatIf.comfortWingM2 + ' m²) costs you downwind'));
        c.appendChild(el('div', 'mt-1',
          'It is easier to pump and quicker through turns'
          + (whatIf.comfortVmgKt != null
              ? ', and upwind VMG only drops to about '
                + whatIf.comfortVmgKt.toFixed(1) + ' kt' : '')
          + ' — but the wing is already short downwind at the peak size, and this '
          + 'makes that worse. Take it if the day is about turns, not if it is '
          + 'about getting back downwind with power.'
          + (isActual ? ' This is the size you actually rode.' : '')));
      }
      host.appendChild(c);
    }
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
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
          font: '11px "IBM Plex Mono", monospace',
          values: function (u, t) { return t.map(function (v) { return v + ' m²'; }); } },
        { stroke: THEME.axisText, grid: { stroke: THEME.grid }, ticks: { stroke: THEME.grid },
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
        { height: 460, losses: losses,
          /* §496 — 지도 점 → 회전 상세. 탭을 넘어가야 하므로 Turns 탭을
             열고, 그 회전만 고른 뒤 목록에서 보이게 스크롤한다. */
          onPick: function (idx) {
            TURNSEL.length = 0; TURNSEL.push(idx);
            var tab = document.querySelector('a[href="#tab-turns"]');
            if (tab) tab.click();
            try { renderTurnExtras(analysis); } catch (e) {}
            scrollTurnRowIntoView(idx);
            var det = document.getElementById('turn-extra');
            if (det) setTimeout(function () {
              det.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }, 60);
          } });
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
          + 'read as if you never turned there. Click a circle to open that turn.';
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
      /* §506 (옥대표 "설명이 조금 더 디테일 하면 좋겠고")
         전에는 백분율 한 줄과 경고 한 줄이 전부였다. 색이 무엇을 뜻하는지,
         그 숫자로 뭘 해야 하는지, 어떻게 계산했는지가 없었다.
         셋을 나눠 적는다 — 무엇을 보고 있나 / 어떻게 읽나 / 얼마나 믿나. */
      while (cav.firstChild) cav.removeChild(cav.firstChild);
      cav.className = 'lab mt-1';

      var line1 = el('div');
      line1.appendChild(el('span', 'text-secondary', 'This session: '));
      line1.appendChild(el('span', 'fw-bold', pct(st.lift) + ' lifted'));
      line1.appendChild(el('span', 'text-secondary', ' \u00b7 '));
      line1.appendChild(el('span', 'fw-bold', pct(st.header) + ' headed'));
      line1.appendChild(el('span', 'text-secondary',
        ' \u00b7 pressure ' + pct(st.gust) + ' above and ' + pct(st.lull)
        + ' below your usual.'));
      cav.appendChild(line1);

      if (mapMode !== 'tack') {
        var d1 = el('div', 'mt-2');
        d1.appendChild(el('span', 'fw-bold', 'What the colour means. '));
        d1.appendChild(el('span', null,
          'Green is a lift \u2014 the wind swung so you could point higher without '
          + 'changing anything. Orange is a header \u2014 it swung the other way and '
          + 'pushed you off course. Grey is the angle you held most of the time on '
          + 'that tack.'));
        cav.appendChild(d1);

        var d2 = el('div', 'mt-2');
        d2.appendChild(el('span', 'fw-bold', 'How to read it upwind. '));
        d2.appendChild(el('span', null,
          'A long orange stretch is the classic sign you stayed on a headed tack '
          + 'too long \u2014 that is where tacking would have paid. Green stretches '
          + 'are the ones worth staying on. Look for whether the colours cluster in '
          + 'one part of the course: that means the shift was in the place, not the clock.'));
        cav.appendChild(d2);

        var d3 = el('div', 'mt-2');
        d3.appendChild(el('span', 'fw-bold', 'Line width is pressure. '));
        d3.appendChild(el('span', null,
          'Thick means you were going faster than your own median on that tack, '
          + 'thin means slower \u2014 read as gust and lull.'));
        cav.appendChild(d3);
      }

      var d4 = el('div', 'mt-2 text-secondary');
      d4.appendChild(el('span', 'fw-bold', '\u26a0 How this is worked out. '));
      d4.appendChild(el('span', null,
        'There is no wind instrument on the board, so this is inferred from the '
        + 'track itself: your heading is compared with the angle you normally held '
        + 'on that same tack, smoothed over about 20 seconds. That means anything '
        + 'that changes your heading or speed reads the same way as wind \u2014 '
        + 'a lost bit of trim, a wave, a moment of pumping, or easing off to look '
        + 'around. Treat it as where to look, not as a measurement.'));
      cav.appendChild(d4);
    }
  }

  function bindMapMode() {
    var g = document.getElementById('map-mode');
    if (!g) { document.addEventListener('DOMContentLoaded', bindMapMode, { once: true }); return; }
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-mode]');
      if (!b || b.disabled) return;
      mapMode = b.getAttribute('data-mode');
      if (mapCtx) {
        renderTrack(mapCtx.session, mapCtx.analysis);
        /* 지도를 새로 만들면 강조 레이어가 날아간다 — 다시 얹는다 */
        segHl = null;
        try { renderSegmentStepper(mapCtx.analysis); } catch (e) {}
      }
    });
  }
  bindMapMode();

  /* ---------- 전체 ---------- */
  var CUR = { session: null, name: null, est: null };
  /* ============================================================
   * §501 v2 → PDF 소스 어댑터 (C1)
   *
   * pdf-export.js 는 구 대시보드(index.html)의 DOM id **26개**와 전역
   * `state` 를 읽도록 짜여 있다. v2 에는 그 id 가 **하나도 없어서**
   * 그냥 붙이면 백지가 나온다. id 를 v2 에 이식하는 건 구조를 거스르는
   * 일이라(§499), pdf-export 의 `$()` 만 소스를 먼저 보게 고쳤다.
   * 여기서는 **구 id → v2 엘리먼트** 사전을 만든다.
   *
   * 규약(§499):
   *   엘리먼트 → 그걸 쓴다 · null → 없음(해당 페이지가 우아하게 빠짐)
   *   undefined → 모르는 id → 진짜 document 에서 찾는다
   *
   * v2 에 대응이 없는 값(포일 종횡비·최대심박 등)은 **합성 노드**로 준다.
   * textOf/valueOf 는 textContent/value 만 보므로 떼어 놓은 노드로 충분하다.
   * ============================================================ */

  function pdfSynth(text, tag) {
    var e = document.createElement(tag || 'div');
    e.textContent = (text == null) ? '' : String(text);
    return e;
  }
  function pdfSynthInput(val) {
    var e = document.createElement('input');
    e.value = (val == null) ? '' : String(val);
    return e;
  }
  function pdfSynthSelect(label) {
    var s = document.createElement('select');
    var o = document.createElement('option');
    o.textContent = label || '';
    o.selected = true;
    s.appendChild(o);
    return s;
  }
  /* collectStatStrip 이 찾는 구조(.stat > .stat__label + .stat__value)로
     직접 만든다 — v2 카드를 긁으면 클래스가 안 맞아 라벨이 다 빈다. */
  function pdfSynthStrip(pairs) {
    var wrap = document.createElement('div');
    pairs.forEach(function (p) {
      if (p[1] == null) return;
      var s = document.createElement('div'); s.className = 'stat';
      var l = document.createElement('div'); l.className = 'stat__label';
      l.textContent = p[0];
      var v = document.createElement('div'); v.className = 'stat__value';
      v.textContent = p[1];
      s.appendChild(l); s.appendChild(v); wrap.appendChild(s);
    });
    return wrap;
  }
  /* 차트 호스트 안의 <canvas> 를 꺼낸다. canvasToDataURL 은 tagName 이
     CANVAS 여야 하므로 호스트 div 를 그대로 주면 안 된다. */
  function pdfCanvasIn(hostId) {
    var h = $(hostId);
    if (!h) return null;
    var c = h.querySelector('canvas');
    return c || null;
  }

  /* 회전 집계 — 세션 전체 평균.
     ⚠ PDF 회전 페이지의 그리드는 **6칸이 상한**이다
     (pdf-export buildManeuverPage: Math.min(stats.length, 6)).
     12줄을 주면 뒤 6줄이 조용히 잘려서 자이브 통계가 통째로 사라진다.
     그래서 택·자이브를 **한 줄에 합쳐** 정확히 6줄로 만든다.
     이렇게 하면 잘리지도 않고, 택 vs 자이브 대조가 한눈에 보인다 —
     밴티지가 헤드라인으로 쓰는 값이 바로 이 대조다(V5). */
  function pdfManeuverStrip(a) {
    var mans = (a && a.maneuvers) || [];
    var tacks = mans.filter(function (m) { return m.type === 'tack'; });
    var gybes = mans.filter(function (m) { return m.type === 'gybe'; });
    function avg(list, key) {
      var v = [];
      list.forEach(function (m) { if (m[key] != null && isFinite(m[key])) v.push(m[key]); });
      if (!v.length) return null;
      return v.reduce(function (x, y) { return x + y; }, 0) / v.length;
    }
    function side(list, sd) {
      return list.filter(function (m) { return m.side === sd; }).length;
    }
    /* 택·자이브를 'T / G' 로 나란히. 한쪽이 없으면 그쪽만 '—' */
    function pair(key, fmt) {
      var t = avg(tacks, key), g = avg(gybes, key);
      if (t == null && g == null) return null;
      return (t == null ? '\u2014' : fmt(t)) + ' / ' + (g == null ? '\u2014' : fmt(g));
    }
    var kt = function (v) { return (v * KT).toFixed(1); };
    var rows = [
      ['Tacks (Port · Stbd)',
       tacks.length ? tacks.length + '  (' + side(tacks, 'P') + ' · ' + side(tacks, 'S') + ')' : null],
      ['Gybes (Port · Stbd)',
       gybes.length ? gybes.length + '  (' + side(gybes, 'P') + ' · ' + side(gybes, 'S') + ')' : null],
      ['Avg lowest speed  T / G',
       pair('minSpeedMs', function (v) { return kt(v) + ' kt'; })],
      ['Avg turn rate  T / G',
       pair('avgTurnRateDegSec', function (v) { return v.toFixed(1) + '\u00b0/s'; })],
      ['Avg loss  T / G',
       pair('lossDisplayPct', function (v) { return Math.round(v) + '%'; })],
      ['Avg recovery  T / G',
       pair('recoverySec', function (v) { return v.toFixed(1) + ' s'; })]
    ];
    return pdfSynthStrip(rows);
  }

  /* 성능 통계 — 풍상/풍하 × 포트/스타보드 핵심만.
     computeStatsPanel 의 rows 를 쓴다(라벨·단위·방향 판정이 이미 들어 있다). */
  function pdfStatsStrip(a) {
    var panel = null;
    try { panel = An.computeStatsPanel(a); } catch (e) {}
    var rows = (panel && panel.rows) || [];
    var out = [];
    function pick(metric, mode, sideId) {
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.metric === metric && r.mode === mode && r.side === sideId) return r;
      }
      return null;
    }
    /* ⚠ rows 의 값은 **기본 단위**(속도 m/s)이고 unit 은 'speed'|'deg'|'bpm'
       같은 **내부 키**다. 표시 변환은 렌더러 몫이다(analysis.js 주석 명시).
       그냥 붙이면 '7.0 speed' 처럼 나온다 — v2 통계표의 fmtVal 과 같은 규칙. */
    function fmt(r) {
      if (!r || r.avg == null || !isFinite(r.avg)) return null;
      var v = r.avg;
      if (r.unit === 'speed') return (v * KT).toFixed(1) + ' kt';
      if (r.unit === 'bpm') return Math.round(v) + ' bpm';
      return v.toFixed(0) + '\u00b0';
    }
    [['sog', 'Speed'], ['vmg', 'VMG'], ['twa', 'CWA']].forEach(function (m) {
      ['upwind', 'downwind'].forEach(function (mode) {
        var pRow = pick(m[0], mode, 'P'), sRow = pick(m[0], mode, 'S');
        var pv = fmt(pRow), sv = fmt(sRow);
        if (pv == null && sv == null) return;
        out.push([
          (mode === 'upwind' ? 'Upwind ' : 'Downwind ') + m[1] + '  P / S',
          (pv || '\u2014') + ' / ' + (sv || '\u2014')
        ]);
      });
    });
    return pdfSynthStrip(out);
  }

  function v2PdfSource() {
    var a = CUR.analysis || {};
    var sum = a.summary || {};
    var wind = a.wind || {};
    var kt = function (ms) { return ms == null ? null : (ms * KT).toFixed(1) + ' kt'; };

    var windTxt = (wind.windDir != null ? Math.round(wind.windDir) + '°' : '—')
      + (wind.windSpeedKt != null ? ' · ' + wind.windSpeedKt + ' kt' : '');

    var strip = pdfSynthStrip([
      ['Distance', sum.distanceM != null ? (sum.distanceM / 1000).toFixed(1) + ' km' : null],
      ['Top speed', kt(sum.maxSpeedMs)],
      ['Avg speed (moving)', kt(sum.avgMovingSpeedMs)],
      ['Duration', sum.durationSec != null ? fmtClock(sum.durationSec) : null],
      ['Upwind VMG (top 50%)', kt(wind.vmgUpwindTop50Ms)],
      ['Downwind VMG (top 50%)', kt(wind.vmgDownwindTop50Ms)],
      ['Tacks', (a.maneuvers || []).filter(function (m) { return m.type === 'tack'; }).length],
      ['Gybes', (a.maneuvers || []).filter(function (m) { return m.type === 'gybe'; }).length]
    ]);

    var hasHrData = (CUR.session && (CUR.session.samples || []).some(function (p) {
      return p && p.hr != null;
    }));

    var MAP = {
      /* 게이트 — 세션이 로드돼 있으면 통과 */
      'dashboard-view': CUR.session ? ($('kpi-row') || pdfSynth('')) : null,

      /* 표지·머리말 */
      'session-title': $('hdr-title'),
      'session-date': $('hdr-date'),
      'session-sport-select': pdfSynthSelect('Wing Foil'),
      'session-source': pdfSynth(CUR.name || ''),
      'wind-readout': pdfSynth(windTxt),

      /* 라이더 입력 */
      'rider-weight-input': $('in-weight'),
      'rider-skill-select': $('in-skill'),
      'rider-wing-input': $('in-wing'),
      'rider-foilar-input': pdfSynthInput(''),   /* v2 는 장비 모듈에서 고른다 */
      'hr-maxhr-input': pdfSynthInput(''),

      /* 요약·통계 */
      'summary-strip': strip,
      /* ⚠ perf-extra 를 그대로 주면 안 된다 — maneuver-stats 와 같은 문제.
         v2 카드는 .stat 류 클래스가 없어서 collectStatStrip 이 폴백으로
         빠지고, 중첩 div 를 다 훑어 'Speed VMG Wind angle' 이 두 번 찍히고
         라벨 없는 값과 차트 캡션('Port (above) · 352 samples …')까지 섞였다.
         → 분석 결과에서 직접 짓는다. */
      'stats-panel-body': pdfStatsStrip(a),
      /* ⚠ v2 카드를 그대로 주면 안 된다. collectStatStrip 은 .stat 류
         클래스를 먼저 찾고, 못 찾으면 **모든 div/li/p 를 훑는 폴백**으로
         빠진다. v2 카드는 중첩 div 라서 같은 문구가 서너 번 중복돼 들어온다
         (실제로 'Tacks by side Port 4 Starboard 5' 가 3번 찍혔다).
         → 회전 집계도 합성해서 준다. 겸사겸사 세션 평균(최저속도·회전율)을
         담는데, 이건 밴티지가 헤드라인으로 쓰는 값이기도 하다(V5). */
      'maneuver-stats': pdfManeuverStrip(a),

      /* 지도·차트 */
      'map': $('map-host'),
      'speed-chart': pdfCanvasIn('chart-meanmax'),
      'histogram-chart': pdfCanvasIn('chart-hist'),
      'target-polar-canvas': pdfCanvasIn('chart-polar'),
      'violin-canvas': null,        /* v2 에 없음 → 해당 블록이 빠진다 */

      /* 심박 — v2 는 전용 차트가 없다. 카드만 있으면 페이지가 나온다 */
      'hr-summary-card': hasHrData ? $('phys-body') : null,
      'hr-zone-chart': null,
      'hr-trend-chart': null,
      'hr-eff-chart': null,

      /* 코치·점수·이력 */
      'coach-card': $('coach-body'),
      'vps-card': $('coach-body'),
      'runs-list': $('sessions-body')
    };

    return {
      el: function (id) {
        /* Object.prototype 오염 방지 — hasOwnProperty 로만 판정 */
        if (!Object.prototype.hasOwnProperty.call(MAP, id)) return undefined;
        return MAP[id];
      },
      state: {
        vps: CUR.vps || {},
        analysis: a,
        wind: { confidence: CUR.est && CUR.est.confidence },
        whatif: CUR.whatif || {},
        history: (function () {
          try { return Store.listSessions() || []; } catch (e) { return []; }
        })(),
        savedSessions: (function () {
          try { return Store.listSessions() || []; } catch (e) { return []; }
        })()
      }
    };
  }

  /* 탭을 한 번씩 눌러 모든 차트를 그려 둔다.
     v2 는 탭 안의 차트를 그 탭이 보일 때 그리므로, 안 본 탭의 캔버스는
     비어 있거나 크기가 0 이다. PDF 는 전 탭을 다 담으므로 미리 깨워야 한다.
     지도는 숨은 상태에서 크기가 0 이라 invalidateSize 까지 필요하다(§486). */
  function pdfWarmTabs() {
    var tabs = Array.prototype.slice.call(
      document.querySelectorAll('a[href^="#tab-"]'));
    if (!tabs.length) return Promise.resolve();
    var active = document.querySelector('a[href^="#tab-"].active');
    var p = Promise.resolve();
    tabs.forEach(function (t) {
      p = p.then(function () {
        try { t.click(); } catch (e) {}
        return new Promise(function (r) { setTimeout(r, 260); });
      });
    });
    return p.then(function () {
      /* 지도가 있는 탭에서 한 번 더 크기를 잡아 준다 */
      return new Promise(function (r) { setTimeout(r, 400); });
    }).then(function () {
      if (active) { try { active.click(); } catch (e) {} }
      return new Promise(function (r) { setTimeout(r, 200); });
    });
  }

  function exportV2Pdf() {
    if (!window.RDPdfExport) {
      alertLine('PDF module is not loaded.');
      return;
    }
    if (!CUR.session) {
      alertLine('Load a session first.');
      return;
    }
    var btn = $('btn-pdf');
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
    /* 지도 탭을 켜 둔 채로 캡처해야 Leaflet 이 크기를 갖는다 */
    pdfWarmTabs().then(function () {
      var trackTab = document.querySelector('a[href="#tab-track"]');
      if (trackTab) { try { trackTab.click(); } catch (e) {} }
      return new Promise(function (r) { setTimeout(r, 500); });
    }).then(function () {
      return RDPdfExport.generate({ source: v2PdfSource() });
    }).catch(function (e) {
      alertLine('PDF failed: ' + ((e && e.message) || e));
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'PDF'; }
    });
  }


  /* 풍향을 바꾸면 분석 전체를 다시 돌린다 — 택/자이브·VMG·폴라가 전부
     풍향에 매달려 있어서 부분 갱신은 틀린 화면을 만든다. */
  function applyWind(dir, mode) {
    if (!CUR.session) return;
    var est = CUR.est;
    if (mode === 'keep') {
      /* 풍향은 그대로 두고 라이더 입력만 반영해 다시 계산한다 */
      var keep = CUR.windDir != null ? CUR.windDir : null;
      var a0 = An.analyzeSession(CUR.session, keep, analysisOpts(CUR.est));
      show(CUR.session, a0, CUR.name, CUR.est);
      return;
    }
    if (mode === 're-estimate') {
      est = estimateWind(CUR.session);
      dir = est && est.windDir != null ? est.windDir : null;
    } else { est = null; }
    var a = An.analyzeSession(CUR.session, dir, analysisOpts(est));
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
    /* §539 (옥대표 "세션 제목 수정가능하게 해줘") — 파일명이 그대로
       제목이 되어 'Waterspeed 2026-09-03T05.21.45.000Z' 처럼 읽히지 않는다.
       storage 에 saveSessionTitle/loadSessionTitle 이 **이미 있었는데**
       v2 가 안 쓰고 있었다 — §482·§494·§511·§514 와 같은 계열이다.
       제목은 세션 시그니처에 묶으므로 같은 파일을 다시 열어도 유지된다. */
    setEditableTitle(name || 'Session');
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
    /* §522 — 지도가 만들어진 **다음**이라야 강조 레이어를 얹을 수 있다 */
    try { renderSegmentStepper(analysis); } catch (e) {}
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
  /* §539 편집 가능한 세션 제목 */
  function setEditableTitle(fallback) {
    var h = $('hdr-title');
    if (!h) return;
    while (h.firstChild) h.removeChild(h.firstChild);

    var sig = '';
    try { sig = sessionSig(CUR.session); } catch (e) {}
    var custom = null;
    try {
      if (sig && window.RDStorage && RDStorage.loadSessionTitle) {
        custom = RDStorage.loadSessionTitle(sig);
      }
    } catch (e) {}
    var shown = custom || fallback;

    var span = el('span');
    span.textContent = shown;
    span.style.cssText = 'outline:none;border-bottom:1px dashed transparent;'
      + 'cursor:text;padding-bottom:1px';
    span.setAttribute('contenteditable', 'plaintext-only');
    span.setAttribute('role', 'textbox');
    span.setAttribute('aria-label', 'Session title — click to rename');
    span.title = '클릭해서 제목을 바꿉니다 · click to rename';

    function commit() {
      var v = (span.textContent || '').replace(/\s+/g, ' ').trim();
      span.style.borderBottomColor = 'transparent';
      if (!sig || !window.RDStorage || !RDStorage.saveSessionTitle) return;
      /* 비우면 **자동 제목으로 되돌린다** — 빈 제목을 저장하면 목록에서
         어느 세션인지 알 수 없게 된다 */
      if (!v || v === fallback) {
        RDStorage.saveSessionTitle(sig, '');
        span.textContent = fallback;
        CUR.name = fallback;
      } else {
        RDStorage.saveSessionTitle(sig, v);
        span.textContent = v;
        CUR.name = v;
      }
      flashTitleSaved();
      /* 저장 목록에도 같은 제목이 보이게 */
      try { renderSessions(); } catch (e) {}
    }
    span.addEventListener('focus', function () {
      span.style.borderBottomColor = THEME.accent;
    });
    span.addEventListener('blur', commit);
    span.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
      if (ev.key === 'Escape') { span.textContent = shown; span.blur(); }
    });
    h.appendChild(span);

    var pen = el('span', 'lab ms-2');
    pen.textContent = '\u270e';
    pen.style.cssText = 'opacity:.45;cursor:text';
    pen.addEventListener('click', function () { span.focus(); });
    h.appendChild(pen);

    var saved = el('span', 'lab ms-2');
    saved.id = 'title-saved';
    saved.style.cssText = 'color:' + THEME.stbd + ';opacity:0;transition:opacity .25s';
    h.appendChild(saved);

    CUR.name = shown;
  }

  function flashTitleSaved() {
    var t = $('title-saved');
    if (!t) return;
    t.textContent = '저장됨';
    t.style.opacity = '1';
    setTimeout(function () { t.style.opacity = '0'; }, 1500);
  }

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

  /* §540 (옥대표 "저장된걸 찾아서 넣어줘") — 잃어버린 세션 중 하나가
     Vakaros .vkx 였는데 **v2 가 그 확장자를 안 받고 있었다.**
     파서(js/vkx-parser.js)도, 구 대시보드의 처리 경로도 이미 있었다 —
     v2 에만 배선이 없었다. §482·§494·§511·§514·§539 와 같은 계열, 일곱 번째.

     .vkx 는 바이너리라 텍스트 융합 경로를 못 탄다. 따로 읽는다. */
  function loadVkxFile(file) {
    if (!window.RDVkx || !RDVkx.parseVKX) {
      $('hdr-title').textContent = 'VKX parser not loaded';
      return;
    }
    var fr = new FileReader();
    fr.onerror = function () { $('hdr-title').textContent = 'Could not read the file'; };
    fr.onload = function () {
      try {
        var parsed = RDVkx.parseVKX(fr.result);
        var session = An.normalizeSession(parsed);
        var est = estimateWind(session);
        var wd = est && est.windDir != null ? est.windDir : null;
        var analysis = An.analyzeSession(session, wd, analysisOpts(est));
        CUR.edit = null; CUR.fullSession = null; CUR.gpxText = null; CUR.fusion = null;
        renderFusionBanner(null);
        show(session, analysis, file.name.replace(/\.vkx$/i, ''), est);
      } catch (e) {
        $('hdr-title').textContent = 'Could not read that VKX';
        $('hdr-date').textContent = (e && e.message) ? e.message : '';
      }
    };
    fr.readAsArrayBuffer(file);
  }

  function loadFiles(fileList) {
    var files = [].slice.call(fileList || []);
    if (!files.length) return;
    /* .vkx 는 하나씩 — 바이너리라 융합 경로에 섞을 수 없다 */
    var vkx = files.filter(function (f) { return /\.vkx$/i.test(f.name); });
    if (vkx.length) { loadVkxFile(vkx[0]); return; }
    var textLike = files.filter(function (f) { return /\.(gpx|csv|tcx)$/i.test(f.name); });
    if (!textLike.length) {
      $('hdr-title').textContent = 'Unsupported file type';
      $('hdr-date').textContent = 'Upload .gpx, .vkx, .csv or .tcx';
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
        var analysis = An.analyzeSession(session, wd, analysisOpts(est));
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
    var analysis = An.analyzeSession(session, wd, analysisOpts(est));
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

    /* §528 — 계정 칩. DMJAuth 는 비동기로 세션을 복원하므로 이벤트로도 듣는다.
       §412 가 말한 그 이벤트다: 로그인 상태가 바뀌면 namespace 가 바뀌므로
       **화면 전체를 다시 그려야** 남의(혹은 이전의) 데이터가 안 남는다. */
    try { renderAuthChip(); } catch (e) {}
    window.addEventListener('dmj-auth-change', function () {
      try { renderAuthChip(); } catch (e) {}
      /* 세션 목록·훈련부하는 namespace 를 타므로 다시 그린다 */
      try { renderSessions(); } catch (e) {}
      try { renderTraining(); } catch (e) {}
    });

    var pb = $('btn-pdf');
    if (pb) pb.addEventListener('click', exportV2Pdf);

    /* §525 W13 — 서버 없이 되는 내보내기. Strava·Health 는 OAuth 라
       서버가 있어야 하고, 공유 링크는 Supabase(§415) 가 붙어야 한다. */
    function wireExport(id, ext, mime, make) {
      var b = $(id);
      if (!b) return;
      b.addEventListener('click', function () {
        if (!CUR.session || !window.RDExport) return;
        var txt;
        try { txt = make(); } catch (e) { txt = null; }
        if (!txt) { b.textContent = 'failed'; return; }
        var okDl = RDExport.download(txt,
          RDExport.safeName(CUR.name || 'session', ext), mime);
        var was = b.textContent;
        b.textContent = okDl ? 'saved' : 'blocked';
        setTimeout(function () { b.textContent = was; }, 1600);
      });
    }
    wireExport('btn-export-csv', 'csv', 'text/csv;charset=utf-8', function () {
      return RDExport.toCsv(CUR.session, CUR.analysis || {});
    });
    wireExport('btn-export-gpx', 'gpx', 'application/gpx+xml;charset=utf-8', function () {
      return RDExport.toGpx(CUR.session, CUR.name || 'Session');
    });

    /* §525 W14 — 지도 배경. 위성이 있어야 해안선·부표·양식장이 보이고,
       그래야 "저기서 왜 느렸나" 를 읽는다. 선택은 기억한다. */
    var tileWrap = $('map-tiles');
    if (tileWrap && window.RDMapTactical && RDMapTactical.setTileKey) {
      var cur = RDMapTactical.tileKey ? RDMapTactical.tileKey() : 'map';
      Array.prototype.forEach.call(tileWrap.querySelectorAll('button'), function (b) {
        if (b.getAttribute('data-tiles') === cur) b.classList.add('active');
        b.addEventListener('click', function () {
          RDMapTactical.setTileKey(b.getAttribute('data-tiles'));
          Array.prototype.forEach.call(tileWrap.querySelectorAll('button'),
            function (o) { o.classList.remove('active'); });
          b.classList.add('active');
          if (mapCtx) {
            renderTrack(mapCtx.session, mapCtx.analysis);
            segHl = null;
            try { renderSegmentStepper(mapCtx.analysis); } catch (e) {}
          }
        });
      });
    }
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
          gear: gearSnapshot(),            // §520 V2 — 그날 쓴 장비 스냅샷
          workload: v2SessionWorkload(),   // §458 훈련부하 AU + 산출 방식
          sig: sessionSig(CUR.session),    // §463 자동 기록분과 중복 방지
          /* §509 — 트랙을 압축 형식으로 담기 위해 샘플을 같이 넘긴다.
             normalizeSession 의 t 는 세션 시작 기준 상대초라, 저장할 때
             절대 epoch 로 되돌려 준다(__abs). 안 그러면 다시 열 때
             날짜가 1970 년이 된다. */
          samples: (function () {
            var S0 = (CUR.fullSession || CUR.session);
            /* ⚠ 단위가 섞이기 쉬운 자리다. startEpoch 는 **밀리초**이고
               (gpx-parser 가 Date.parse 로 만든다) 샘플의 t 는 **초**다.
               그냥 더하면 절대시각만 1000배가 되어 다시 열 때 날짜가
               '+058346' 년으로 뜬다 — 간격은 맞아서 속도는 정상으로
               보이므로 눈에 잘 안 띈다. 초로 맞춰 더한다. */
            var baseSec = ((S0 && S0.startEpoch) || 0) / 1000;
            return ((S0 && S0.samples) || []).map(function (p) {
              return { lat: p.lat, lng: p.lng, __abs: baseSec + p.t };
            });
          })(),
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
    /* §498 — 풍속 입력에 핸들러가 **아예 없었다.** 값을 바꿔도 아무 일도
       일어나지 않았고, 다른 버튼이 재분석을 부를 때까지 반영되지 않았다.
       풍속은 AWA·AWS·트림 요구량의 유일한 입력이라 바뀌면 바로 다시
       계산해야 한다. 풍향은 건드리지 않는다('keep'). */
    var wsIn = $('in-windspeed');
    if (wsIn) {
      var wsLast = wsIn.value;
      var wsApply = function () {
        if (!CUR.session) return;
        if (wsIn.value === wsLast) return;   /* 값이 안 바뀌었으면 재계산 안 함 */
        wsLast = wsIn.value;
        applyWind(null, 'keep');
      };
      wsIn.addEventListener('change', wsApply);
      wsIn.addEventListener('blur', wsApply);
    }
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
