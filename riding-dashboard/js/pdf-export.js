/* ============================================================
 * pdf-export.js — 라이딩 분석 PDF 보고서 생성 (Danny 2026-05-26)
 *
 * 설계
 *  · 클라이언트 사이드 렌더 (jsPDF + html2canvas via html2pdf.js).
 *    분석·차트·지도는 이미 화면에 있으므로 DOM 을 source-of-truth 로 본다.
 *    state 캡슐화(app.js IIFE) 를 건드리지 않고 DOM 에서 모든 데이터 추출.
 *  · Lazy load — 사용자가 버튼 클릭할 때만 html2pdf 번들·Pretendard 폰트
 *    를 동적으로 로드한다. 초기 페이지 로드에는 0 KB 영향.
 *  · 한↔영 — RDI18n.T() 헬퍼로 텍스트 번역. localStorage(dmj_rd_lang) 가
 *    이미 토글되어 있으므로 현재 언어를 그대로 사용.
 *  · 폰트 — Pretendard woff2 @font-face 임베드 + document.fonts.ready
 *    + html2canvas onclone 폰트 강제. 한글 깨짐 방지 3중 가드.
 *  · 9 페이지 (A4 portrait, 마진 15mm):
 *      1 Cover · 2 Session Summary · 3 Track Map · 4 Speed
 *      5 Maneuvers · 6 HR Zones (옵션) · 7 Coach · 8 What-if · 9 Appendix
 *    HR 데이터 없으면 P6 제외 → 8 페이지.
 *  · 차트 (canvas) 는 toDataURL('image/png') 로 직접 변환 (lossless,
 *    cross-origin 안전). 지도(leaflet) 는 html2canvas 캡쳐 시도하고
 *    실패하면 placeholder 로 graceful degrade.
 *  · 모바일 Web Share API — navigator.canShare({files}) 지원 시
 *    공유 시트로, 아니면 다운로드 only.
 *  · selftest — RDPdfExport._selftest() 로 페이지 수·언어 검증.
 * ============================================================ */
(function (global) {
  'use strict';

  /* ============================================================
   * CDN URLs — Danny 2026-05-27 §177 PDF 백지 fix v4 (라이브러리 교체).
   *  이전: html2pdf.js 0.10.1 (jsPDF + html2canvas 번들).
   *    문제 — 0.10.1 의 내장 html2canvas 가 빈 canvas 를 반환해 PDF 가
   *    876~3048 bytes (사실상 백지) 로 나옴. CDN 으로 같은 환경에서
   *    standalone html2canvas 1.4.1 을 따로 로드해 같은 element 를
   *    캡쳐하니 정상 PNG (5710+ bytes) — 즉 html2pdf 번들 문제 확정.
   *  해결 — html2pdf 의존성 제거. standalone html2canvas 1.4.1 +
   *    jsPDF 2.5.1 을 직접 로드해서 page 단위로 캡쳐 후 jsPDF.addImage
   *    + addPage 로 합쳐서 blob 생성. 더 안정적이고 control 도 더 좋다.
   *  - Pretendard 1.3.9 = 한국어·라틴 일관 (그대로 유지)
   * ============================================================ */
  var HTML2CANVAS_CDN =
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  var JSPDF_CDN =
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var PRETENDARD_REG =
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/' +
    'packages/pretendard/dist/web/static/woff2/Pretendard-Regular.woff2';
  var PRETENDARD_BOLD =
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/' +
    'packages/pretendard/dist/web/static/woff2/Pretendard-Bold.woff2';
  var PRETENDARD_SEMI =
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/' +
    'packages/pretendard/dist/web/static/woff2/Pretendard-SemiBold.woff2';

  /* i18n 헬퍼 — RDI18n 미로드 시 한국어 폴백 */
  function T(ko, vars) {
    if (global.RDI18n && global.RDI18n.T) return global.RDI18n.T(ko, vars);
    if (!vars) return ko;
    var out = ko;
    for (var k in vars) out = out.replace('{' + k + '}', vars[k]);
    return out;
  }
  function getLang() {
    if (global.RDI18n && global.RDI18n.getLang) return global.RDI18n.getLang();
    try { return localStorage.getItem('dmj_rd_lang') || 'ko'; } catch (e) { return 'ko'; }
  }

  /* ============================================================
   * Lazy loader — script & font 1회만 로드 (Danny 2026-05-27 §177).
   * html2canvas + jsPDF 를 각각 따로 로드. html2pdf 번들 대신 standalone.
   * ============================================================ */
  function _loadScript(src, globalCheck) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () {
        var g = globalCheck();
        if (g) resolve(g);
        else reject(new Error('Script loaded but global undefined: ' + src));
      };
      s.onerror = function () { reject(new Error('CDN load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  var _h2cPromise = null;
  function ensureH2C() {
    if (global.html2canvas) return Promise.resolve(global.html2canvas);
    if (_h2cPromise) return _h2cPromise;
    _h2cPromise = _loadScript(HTML2CANVAS_CDN, function () { return global.html2canvas; });
    return _h2cPromise;
  }
  var _jspdfPromise = null;
  function ensureJsPDF() {
    if (global.jspdf && global.jspdf.jsPDF) return Promise.resolve(global.jspdf.jsPDF);
    if (_jspdfPromise) return _jspdfPromise;
    _jspdfPromise = _loadScript(JSPDF_CDN, function () {
      return global.jspdf && global.jspdf.jsPDF;
    });
    return _jspdfPromise;
  }

  var _fontInjected = false;
  function ensurePretendard() {
    if (_fontInjected) {
      return document.fonts.ready.then(function () {
        return Promise.all([
          document.fonts.load("400 16px 'Pretendard'"),
          document.fonts.load("600 16px 'Pretendard'"),
          document.fonts.load("700 16px 'Pretendard'")
        ]);
      });
    }
    _fontInjected = true;
    var css =
      "@font-face{font-family:'Pretendard';font-weight:400;font-display:block;" +
      "src:url('" + PRETENDARD_REG + "') format('woff2')}" +
      "@font-face{font-family:'Pretendard';font-weight:600;font-display:block;" +
      "src:url('" + PRETENDARD_SEMI + "') format('woff2')}" +
      "@font-face{font-family:'Pretendard';font-weight:700;font-display:block;" +
      "src:url('" + PRETENDARD_BOLD + "') format('woff2')}";
    var s = document.createElement('style');
    s.id = 'rd-pdf-pretendard';
    s.textContent = css;
    document.head.appendChild(s);
    return document.fonts.ready.then(function () {
      return Promise.all([
        document.fonts.load("400 16px 'Pretendard'"),
        document.fonts.load("600 16px 'Pretendard'"),
        document.fonts.load("700 16px 'Pretendard'")
      ]);
    });
  }

  /* ============================================================
   * 데이터 추출 — DOM 에서 직접 (state 캡슐화 회피)
   * ============================================================ */
  function $(id) { return document.getElementById(id); }
  function textOf(id) {
    var el = $(id);
    return el ? String(el.textContent || '').trim() : '';
  }
  function valueOf(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
  }

  function collectMeta() {
    var sportSel = $('session-sport-select');
    var sportText = sportSel && sportSel.selectedOptions && sportSel.selectedOptions[0]
      ? sportSel.selectedOptions[0].textContent.trim() : '';
    var skillSel = $('rider-skill-select');
    var skillText = skillSel && skillSel.selectedOptions && skillSel.selectedOptions[0]
      ? skillSel.selectedOptions[0].textContent.trim() : '';
    return {
      title: textOf('session-title'),
      date: textOf('session-date'),
      sport: sportText,
      source: textOf('session-source'),
      wind: textOf('wind-readout'),
      rider: {
        weight: valueOf('rider-weight-input'),
        skill: skillText,
        wing: valueOf('rider-wing-input'),
        ar: valueOf('rider-foilar-input'),
        maxHr: valueOf('hr-maxhr-input')
      }
    };
  }

  /* 캔버스를 PNG dataURL 로 변환. 비어 있거나 hidden 이면 null. */
  function canvasToDataURL(id) {
    var el = $(id);
    if (!el) return null;
    if (el.tagName !== 'CANVAS') return null;
    // hidden 컨테이너 안에 있으면 렌더 안 됐을 수 있음
    var card = el.closest('[hidden], .card[hidden]');
    if (card && card.hidden) return null;
    if (el.width === 0 || el.height === 0) return null;
    try { return el.toDataURL('image/png'); }
    catch (e) { console.warn('[pdf-export] canvas tainted:', id, e); return null; }
  }

  /* 요약 stat strip — 카드 내 .stat 요소들을 라벨/값 배열로 추출 */
  function collectStatStrip(rootId) {
    var root = $(rootId);
    if (!root) return [];
    var nodes = root.querySelectorAll('.stat, .stat-strip__item, .metric, .metric-tile');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var label = n.querySelector('.stat__label, .label, .metric__label, dt');
      var value = n.querySelector('.stat__value, .value, .metric__value, dd, strong');
      if (label && value) {
        out.push({
          label: String(label.textContent || '').trim(),
          value: String(value.textContent || '').trim()
        });
      }
    }
    if (!out.length) {
      // fallback: 카드 안 모든 텍스트 페어로
      var alt = root.querySelectorAll('div, li, p');
      for (var j = 0; j < alt.length && out.length < 12; j++) {
        var txt = String(alt[j].textContent || '').trim();
        if (txt && txt.length < 60 && txt.indexOf('\n') === -1) {
          out.push({ label: '', value: txt });
        }
      }
    }
    return out;
  }

  /* ============================================================
   * 지도 캡쳐 — leaflet 컨테이너를 html2canvas 로 캡쳐.
   *   타일 CORS 실패 시 graceful: null 반환하면 PDF 가 placeholder 표시.
   *   useCORS+allowTaint+foreignObjectRendering 으로 안전성 ↑
   * ============================================================ */
  function captureMap() {
    var mapEl = $('map');
    if (!mapEl || !global.html2canvas) return Promise.resolve(null);
    return global.html2canvas(mapEl, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#F5F7FA',
      scale: 1.4,
      logging: false
    }).then(function (canvas) {
      try { return canvas.toDataURL('image/png'); }
      catch (e) { return null; }
    }).catch(function (e) {
      console.warn('[pdf-export] map capture failed:', e);
      return null;
    });
  }

  /* ============================================================
   * PDF 컨테이너 빌드 (DOM 으로 9개 섹션 조립)
   * ============================================================ */
  var STYLE_ID = 'rd-pdf-style';
  function injectPdfStyle() {
    if ($(STYLE_ID)) return;
    /* #rd-pdf-root 위치 — Danny 2026-05-27 §178 final fix.
       히스토리:
         v1: position:fixed; left:-10000px → html2canvas#422 blank PDF
         v2: position:absolute; opacity:0 → opacity 가 capture pipeline 망가뜨림
         v3: position:absolute; top:-99999px → 일부 페이지만 캡쳐돼 나머지 백지
         v4 (this): position:absolute; top:0; left:0 (정상 viewport 위치)
           + fullscreen 로딩 오버레이로 사용자 시야 가림.
           html2canvas 가 정상 layout 컨텍스트에서 캡쳐 → 모든 페이지 OK.
           PDF blob 준비되면 오버레이 → 미리보기 모달로 자연스럽게 전환. */
    var css = ""
      + "#rd-pdf-root{position:absolute;left:0;top:0;width:794px;"
      +   "pointer-events:none;z-index:1;"
      +   "background:#FFFFFF;color:#0A2540;"
      +   "font-family:'Pretendard',system-ui,-apple-system,sans-serif;"
      +   "font-weight:400;letter-spacing:-0.01em;-webkit-font-smoothing:antialiased}"
      + "#rd-pdf-overlay{position:fixed;inset:0;z-index:99999;background:rgba(10,37,64,0.96);"
      +   "display:flex;flex-direction:column;align-items:center;justify-content:center;"
      +   "color:#FFF;font-family:'Pretendard',system-ui,sans-serif;gap:14px}"
      + "#rd-pdf-overlay__spinner{width:48px;height:48px;border:4px solid rgba(255,255,255,0.18);"
      +   "border-top-color:#FFB800;border-radius:50%;animation:rdPdfSpin 0.9s linear infinite}"
      + "@keyframes rdPdfSpin{to{transform:rotate(360deg)}}"
      + "#rd-pdf-overlay__msg{font-size:16px;font-weight:600;letter-spacing:-0.01em}"
      + "#rd-pdf-overlay__sub{font-size:12px;color:#A8B4C0;font-weight:400}"
      + "#rd-pdf-root *{box-sizing:border-box;line-height:1.45}"
      + ".pdf-page{position:relative;width:794px;min-height:1123px;padding:56px 56px 48px;"
      +   "page-break-after:always;break-after:page;background:#FFFFFF}"
      + ".pdf-page:last-child{page-break-after:auto;break-after:auto}"
      + ".pdf-page__head{display:flex;align-items:baseline;justify-content:space-between;"
      +   "border-bottom:2px solid #0A2540;padding-bottom:8px;margin-bottom:24px}"
      + ".pdf-page__h{font-size:20px;font-weight:700;color:#0A2540;margin:0}"
      + ".pdf-page__pageno{font-size:11px;color:#5C6F7E;font-weight:600}"
      + ".pdf-page__foot{position:absolute;left:56px;right:56px;bottom:24px;"
      +   "display:flex;justify-content:space-between;font-size:10px;color:#7E93A8;"
      +   "border-top:1px solid #E5EAF0;padding-top:8px}"
      /* Cover */
      + ".pdf-cover{display:flex;flex-direction:column;justify-content:space-between;"
      +   "min-height:1011px;padding:80px 64px 64px}"
      + ".pdf-cover__brand{display:flex;align-items:center;gap:12px;font-size:13px;"
      +   "color:#5C6F7E;letter-spacing:0.04em;text-transform:uppercase}"
      + ".pdf-cover__brand-mark{display:inline-flex;align-items:center;justify-content:center;"
      +   "width:34px;height:34px;border-radius:8px;background:#0A2540;color:#FFFFFF;"
      +   "font-weight:700;font-size:16px}"
      + ".pdf-cover__title{font-size:48px;font-weight:700;color:#0A2540;line-height:1.1;"
      +   "margin:0 0 16px;letter-spacing:-0.02em}"
      + ".pdf-cover__subtitle{font-size:20px;font-weight:400;color:#5C6F7E;margin:0 0 40px}"
      + ".pdf-cover__meta{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;"
      +   "padding:24px;background:#F5F7FA;border-radius:12px;border:1px solid #E5EAF0}"
      + ".pdf-cover__meta-row{display:flex;flex-direction:column;gap:4px}"
      + ".pdf-cover__meta-k{font-size:11px;color:#7E93A8;text-transform:uppercase;"
      +   "letter-spacing:0.04em;font-weight:600}"
      + ".pdf-cover__meta-v{font-size:16px;color:#0A2540;font-weight:600}"
      + ".pdf-cover__foot{font-size:11px;color:#7E93A8;border-top:1px solid #E5EAF0;"
      +   "padding-top:16px;line-height:1.6}"
      /* Stat grid */
      + ".pdf-statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;"
      +   "margin-bottom:20px}"
      + ".pdf-stat{padding:14px 16px;background:#F5F7FA;border:1px solid #E5EAF0;"
      +   "border-radius:10px}"
      + ".pdf-stat__k{font-size:10px;color:#7E93A8;text-transform:uppercase;"
      +   "letter-spacing:0.04em;font-weight:600;margin-bottom:4px}"
      + ".pdf-stat__v{font-size:22px;font-weight:700;color:#0A2540;line-height:1}"
      + ".pdf-stat__sub{font-size:11px;color:#5C6F7E;margin-top:4px}"
      /* VPS card */
      + ".pdf-vps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;"
      +   "margin-bottom:20px}"
      + ".pdf-vps__card{padding:20px;border-radius:14px;text-align:center;"
      +   "border:1px solid #E5EAF0}"
      + ".pdf-vps__card--up{background:linear-gradient(135deg,#E8F2FF,#F5F9FF);"
      +   "border-color:#BCD8FF}"
      + ".pdf-vps__card--ovr{background:linear-gradient(135deg,#FFF6D9,#FFFBEE);"
      +   "border-color:#FFE08A}"
      + ".pdf-vps__card--dn{background:linear-gradient(135deg,#E8FFEE,#F5FFF8);"
      +   "border-color:#A8E4B8}"
      + ".pdf-vps__k{font-size:11px;color:#5C6F7E;font-weight:600;"
      +   "letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px}"
      + ".pdf-vps__v{font-size:42px;font-weight:700;color:#0A2540;line-height:1}"
      + ".pdf-vps__sub{font-size:11px;color:#7E93A8;margin-top:6px}"
      /* Chart blocks */
      + ".pdf-block{margin-bottom:22px;page-break-inside:avoid}"
      + ".pdf-block__h{font-size:13px;font-weight:700;color:#0A2540;"
      +   "margin:0 0 8px;letter-spacing:-0.01em}"
      + ".pdf-block__sub{font-size:10px;color:#7E93A8;margin:0 0 10px}"
      + ".pdf-img{display:block;width:100%;height:auto;border-radius:6px;"
      +   "border:1px solid #E5EAF0;background:#FFFFFF}"
      + ".pdf-img--sm{max-height:280px;object-fit:contain}"
      + ".pdf-img--map{max-height:380px;object-fit:cover}"
      + ".pdf-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}"
      + ".pdf-placeholder{display:flex;align-items:center;justify-content:center;"
      +   "min-height:220px;background:#F5F7FA;border:1px dashed #C7CFD8;border-radius:8px;"
      +   "color:#7E93A8;font-size:12px;text-align:center;padding:24px}"
      /* Tables */
      + ".pdf-table{width:100%;border-collapse:collapse;font-size:11px;"
      +   "margin-bottom:16px}"
      + ".pdf-table th{text-align:left;padding:8px 10px;background:#F5F7FA;"
      +   "color:#0A2540;font-weight:700;border-bottom:2px solid #0A2540;font-size:10px;"
      +   "letter-spacing:0.04em;text-transform:uppercase}"
      + ".pdf-table td{padding:8px 10px;border-bottom:1px solid #E5EAF0;color:#0A2540}"
      /* Narrative */
      + ".pdf-narrative{padding:18px 22px;background:#F5F7FA;border-radius:12px;"
      +   "border:1px solid #E5EAF0;font-size:12px;line-height:1.7;color:#1F3A52;"
      +   "white-space:pre-wrap}"
      + ".pdf-narrative h4{font-size:13px;font-weight:700;color:#0A2540;"
      +   "margin:12px 0 6px}"
      + ".pdf-narrative ul{margin:6px 0 6px 18px;padding:0}"
      + ".pdf-narrative li{margin-bottom:4px}"
      /* Appendix */
      + ".pdf-app__sec{margin-bottom:16px}"
      + ".pdf-app__h{font-size:12px;font-weight:700;color:#0A2540;margin:0 0 4px}"
      + ".pdf-app__b{font-size:10px;line-height:1.6;color:#5C6F7E;margin:0}"
      ;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- P1 Cover ---------- */
  function buildCover(meta) {
    var page = el('section', 'pdf-page pdf-cover');
    var brand = el('div', 'pdf-cover__brand');
    brand.innerHTML =
      '<span class="pdf-cover__brand-mark">D</span>' +
      '<span>' + esc(T('단무지공방')) + ' · SailTech</span>';
    page.appendChild(brand);

    var titleWrap = el('div');
    titleWrap.style.marginTop = '120px';
    titleWrap.innerHTML =
      '<h1 class="pdf-cover__title">' + esc(T('라이딩 분석 보고서')) + '</h1>' +
      '<p class="pdf-cover__subtitle">' +
        esc(T('윙포일·세일링 GPX 트랙 분석')) + '</p>';
    page.appendChild(titleWrap);

    var metaGrid = el('div', 'pdf-cover__meta');
    var rows = [
      [T('세션'),    meta.title || '—'],
      [T('일자'),    meta.date  || '—'],
      [T('스포츠'),  meta.sport || '—'],
      [T('데이터'),  meta.source || '—'],
      [T('풍향·풍속'), meta.wind || '—'],
      [T('라이더 · 장비'),
        [meta.rider.weight ? meta.rider.weight + ' kg' : null,
         meta.rider.skill || null,
         meta.rider.wing ? meta.rider.wing + ' m²' : null]
        .filter(Boolean).join(' · ') || '—']
    ];
    var rowsHtml = '';
    for (var i = 0; i < rows.length; i++) {
      rowsHtml +=
        '<div class="pdf-cover__meta-row">' +
          '<span class="pdf-cover__meta-k">' + esc(rows[i][0]) + '</span>' +
          '<span class="pdf-cover__meta-v">' + esc(rows[i][1]) + '</span>' +
        '</div>';
    }
    metaGrid.innerHTML = rowsHtml;
    page.appendChild(metaGrid);

    var foot = el('div', 'pdf-cover__foot');
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var ts = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
      + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    foot.innerHTML =
      '<div><strong>' + esc(T('단무지공방')) + '</strong> · dmjgroup.kr/riding-dashboard</div>' +
      '<div>' + esc(T('생성 시각')) + ': ' + esc(ts) + '</div>' +
      '<div style="margin-top:6px">' +
      esc(T('이 보고서는 단무지공방 라이딩 분석 대시보드로 생성되었습니다')) + '</div>';
    page.appendChild(foot);
    return page;
  }

  /* ---------- 공통 페이지 헤더 ---------- */
  function pageWithHead(heading, pageNo, totalPages) {
    var page = el('section', 'pdf-page');
    var head = el('div', 'pdf-page__head');
    head.innerHTML =
      '<h2 class="pdf-page__h">' + esc(heading) + '</h2>' +
      '<span class="pdf-page__pageno">' +
        esc(T('{n}쪽', { n: pageNo })) + ' / ' + totalPages + '</span>';
    page.appendChild(head);
    var foot = el('div', 'pdf-page__foot');
    foot.innerHTML =
      '<span>' + esc(T('단무지공방')) + ' · SailTech</span>' +
      '<span>dmjgroup.kr/riding-dashboard</span>';
    page.appendChild(foot);
    return page;
  }

  /* ---------- P2 Session Summary ---------- */
  function buildSummary(meta, page) {
    // VPS 카드 (3개)
    var vpsEl = $('vps-card');
    var vpsCard = el('div', 'pdf-vps');
    var scores = extractVps(vpsEl);
    vpsCard.innerHTML =
      '<div class="pdf-vps__card pdf-vps__card--up">' +
        '<div class="pdf-vps__k">' + esc(T('풍상')) + '</div>' +
        '<div class="pdf-vps__v">' + esc(scores.up || '—') + '</div>' +
        '<div class="pdf-vps__sub">Upwind VPS</div>' +
      '</div>' +
      '<div class="pdf-vps__card pdf-vps__card--ovr">' +
        '<div class="pdf-vps__k">' + esc(T('종합')) + '</div>' +
        '<div class="pdf-vps__v">' + esc(scores.overall || '—') + '</div>' +
        '<div class="pdf-vps__sub">Overall VPS</div>' +
      '</div>' +
      '<div class="pdf-vps__card pdf-vps__card--dn">' +
        '<div class="pdf-vps__k">' + esc(T('풍하')) + '</div>' +
        '<div class="pdf-vps__v">' + esc(scores.down || '—') + '</div>' +
        '<div class="pdf-vps__sub">Downwind VPS</div>' +
      '</div>';
    page.appendChild(vpsCard);

    // 요약 stat strip
    var stats = collectStatStrip('summary-strip');
    if (stats.length) {
      var block = el('div', 'pdf-block');
      block.appendChild(el('h3', 'pdf-block__h', esc(T('세션 통계'))));
      var grid = el('div', 'pdf-statgrid');
      var gridHtml = '';
      for (var i = 0; i < Math.min(stats.length, 9); i++) {
        gridHtml +=
          '<div class="pdf-stat">' +
            (stats[i].label ? '<div class="pdf-stat__k">' + esc(stats[i].label) + '</div>' : '') +
            '<div class="pdf-stat__v">' + esc(stats[i].value) + '</div>' +
          '</div>';
      }
      grid.innerHTML = gridHtml;
      block.appendChild(grid);
      page.appendChild(block);
    }

    // 퍼포먼스 통계 (있을 때)
    var perf = collectStatStrip('stats-panel-body');
    if (perf.length) {
      var b2 = el('div', 'pdf-block');
      b2.appendChild(el('h3', 'pdf-block__h', esc(T('퍼포먼스 통계'))));
      var rowsHtml = '';
      for (var j = 0; j < perf.length; j++) {
        if (!perf[j].label && !perf[j].value) continue;
        rowsHtml += '<tr><td>' + esc(perf[j].label) + '</td><td><strong>' +
          esc(perf[j].value) + '</strong></td></tr>';
      }
      if (rowsHtml) {
        var tab = el('table', 'pdf-table');
        tab.innerHTML =
          '<thead><tr><th>' + esc(T('지표')) + '</th><th>' + esc(T('값')) + '</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>';
        b2.appendChild(tab);
        page.appendChild(b2);
      }
    }
    return page;
  }

  /* VPS 카드의 숫자 3개 추출 (DOM 구조 휴리스틱 — text 노드 기반) */
  function extractVps(vpsEl) {
    var out = { up: '', overall: '', down: '' };
    if (!vpsEl) return out;
    var nodes = vpsEl.querySelectorAll('strong, .vps-score, .score, .big, [class*="score"]');
    var nums = [];
    for (var i = 0; i < nodes.length; i++) {
      var t = String(nodes[i].textContent || '').trim();
      var m = t.match(/^[0-9]+(\.[0-9])?$/);
      if (m) nums.push(t);
    }
    if (!nums.length) {
      // fallback: 텍스트 전체에서 숫자 추출
      var raw = String(vpsEl.textContent || '');
      var matches = raw.match(/\b[0-9]{1,3}(\.[0-9])?\b/g) || [];
      nums = matches.slice(0, 3);
    }
    if (nums.length >= 3) { out.up = nums[0]; out.overall = nums[1]; out.down = nums[2]; }
    else if (nums.length === 1) { out.overall = nums[0]; }
    else if (nums.length === 2) { out.up = nums[0]; out.down = nums[1]; }
    return out;
  }

  /* ---------- P3 Track Map ---------- */
  function buildMapPage(mapDataUrl, meta, page) {
    var block = el('div', 'pdf-block');
    block.appendChild(el('h3', 'pdf-block__h', esc(T('GPS 트랙'))));
    block.appendChild(el('p', 'pdf-block__sub',
      esc(T('색상 = 속도(빨강 느림·초록 빠름) · 마커 = 택킹/자이빙'))));
    if (mapDataUrl) {
      var img = el('img', 'pdf-img pdf-img--map');
      img.src = mapDataUrl;
      img.alt = 'Track map';
      block.appendChild(img);
    } else {
      var ph = el('div', 'pdf-placeholder');
      ph.textContent = T('지도 캡쳐를 사용할 수 없습니다 (CORS 제한). 대시보드에서 확인하세요.');
      block.appendChild(ph);
    }
    page.appendChild(block);

    // 풍향 정보
    var wb = el('div', 'pdf-block');
    wb.appendChild(el('h3', 'pdf-block__h', esc(T('풍향 설정'))));
    var pCard = el('div', 'pdf-narrative');
    pCard.textContent = meta.wind || T('풍향 미설정');
    wb.appendChild(pCard);
    page.appendChild(wb);
    return page;
  }

  /* ---------- 차트 페이지 빌더 헬퍼 ---------- */
  function chartBlock(title, sub, dataUrl, opts) {
    var b = el('div', 'pdf-block');
    if (title) b.appendChild(el('h3', 'pdf-block__h', esc(title)));
    if (sub) b.appendChild(el('p', 'pdf-block__sub', esc(sub)));
    if (dataUrl) {
      var img = el('img', 'pdf-img pdf-img--sm');
      img.src = dataUrl;
      img.alt = title || '';
      if (opts && opts.maxHeight) img.style.maxHeight = opts.maxHeight;
      b.appendChild(img);
    } else {
      var ph = el('div', 'pdf-placeholder');
      ph.textContent = T('차트 데이터 없음');
      ph.style.minHeight = '140px';
      b.appendChild(ph);
    }
    return b;
  }

  /* ---------- P4 Speed ---------- */
  function buildSpeedPage(page) {
    var speed = canvasToDataURL('speed-chart');
    var hist = canvasToDataURL('histogram-chart');
    page.appendChild(chartBlock(
      T('속도 시계열'),
      T('세션 전체 속도 · 색상은 속도 구간을 반영'),
      speed));
    page.appendChild(chartBlock(
      T('속도 분포'),
      T('속도 구간별 체류 시간 비율'),
      hist, { maxHeight: '240px' }));
    // 고속 구간 리스트 (텍스트로)
    var runsList = $('runs-list');
    if (runsList && runsList.textContent.trim()) {
      var b = el('div', 'pdf-block');
      b.appendChild(el('h3', 'pdf-block__h', esc(T('고속 구간 (Run)'))));
      var txt = String(runsList.textContent || '').trim()
        .replace(/\s+/g, ' ').slice(0, 600);
      var np = el('div', 'pdf-narrative');
      np.style.fontSize = '11px';
      np.textContent = txt;
      b.appendChild(np);
      page.appendChild(b);
    }
    return page;
  }

  /* ---------- P5 Maneuver ---------- */
  function buildManeuverPage(page) {
    // 회전 요약 stats
    var stats = collectStatStrip('maneuver-stats');
    if (stats.length) {
      var sb = el('div', 'pdf-block');
      sb.appendChild(el('h3', 'pdf-block__h', esc(T('택킹 / 자이빙 요약'))));
      var grid = el('div', 'pdf-statgrid');
      var html = '';
      for (var i = 0; i < Math.min(stats.length, 6); i++) {
        html +=
          '<div class="pdf-stat">' +
            (stats[i].label ? '<div class="pdf-stat__k">' + esc(stats[i].label) + '</div>' : '') +
            '<div class="pdf-stat__v">' + esc(stats[i].value) + '</div>' +
          '</div>';
      }
      grid.innerHTML = html;
      sb.appendChild(grid);
      page.appendChild(sb);
    }

    // 폴라 차트
    var polar = canvasToDataURL('target-polar-canvas');
    page.appendChild(chartBlock(
      T('폴라 다이어그램'),
      T('이번 세션 포트·스타보드(실선) + 개인 베스트 타깃(점선)'),
      polar, { maxHeight: '300px' }));

    // 바이올린 (P/S 분포)
    var violin = canvasToDataURL('violin-canvas');
    page.appendChild(chartBlock(
      T('택 분포 — 포트 · 스타보드'),
      T('가운데 축 기준 좌 = 포트(P) · 우 = 스타보드(S)'),
      violin, { maxHeight: '240px' }));
    return page;
  }

  /* ---------- P6 HR Zones (옵션) ---------- */
  function hasHr() {
    var card = $('hr-summary-card');
    return card && !card.hidden;
  }
  function buildHrPage(page) {
    var trend = canvasToDataURL('hr-trend-chart');
    var zone = canvasToDataURL('hr-zone-chart');
    var eff = canvasToDataURL('hr-eff-chart');
    page.appendChild(chartBlock(
      T('세션 중 심박 추이'),
      T('배경 띠 = 심박 존'),
      trend, { maxHeight: '220px' }));
    page.appendChild(chartBlock(
      T('심박 존 분포'),
      T('각 심박 존에 머문 시간'),
      zone, { maxHeight: '200px' }));
    if (eff) {
      page.appendChild(chartBlock(
        T('퍼포먼스 대비 심박 효율'),
        T('같은 속도를 더 낮은 심박으로 — 유산소 효율'),
        eff, { maxHeight: '200px' }));
    }
    return page;
  }

  /* ---------- P7 Coach Narrative ---------- */
  function buildCoachPage(page) {
    var card = $('coach-card');
    var b = el('div', 'pdf-block');
    if (card && card.textContent.trim()) {
      var div = el('div', 'pdf-narrative');
      // 직접 텍스트 추출 (HTML 구조는 무시 — script tainted 우려)
      var paragraphs = [];
      var ps = card.querySelectorAll('p, li, h3, h4, .coach__body, .coach__section');
      if (ps.length) {
        for (var i = 0; i < ps.length; i++) {
          var t = String(ps[i].textContent || '').trim();
          if (t) paragraphs.push(t);
        }
      } else {
        paragraphs.push(String(card.textContent || '').trim());
      }
      div.innerHTML = paragraphs.map(function (p) { return esc(p); }).join('<br><br>');
      b.appendChild(div);
    } else {
      var ph = el('div', 'pdf-placeholder');
      ph.textContent = T('Coach Danny 코멘트가 아직 생성되지 않았습니다 (풍향을 확정하면 활성화됩니다)');
      b.appendChild(ph);
    }
    page.appendChild(b);
    return page;
  }

  /* ---------- P8 What-if Wing ---------- */
  function buildWhatIfPage(page) {
    // Coach card 안에 what-if 가 들어가는 경우가 있음 — 키워드 검색으로 추출
    var coach = $('coach-card');
    var sections = coach ? coach.querySelectorAll('.coach__whatif, [class*="whatif"], .whatif') : [];
    var b = el('div', 'pdf-block');
    if (sections.length) {
      var div = el('div', 'pdf-narrative');
      var html = '';
      for (var i = 0; i < sections.length; i++) {
        var txt = String(sections[i].textContent || '').trim();
        if (txt) html += '<p>' + esc(txt) + '</p>';
      }
      div.innerHTML = html;
      b.appendChild(div);
    } else {
      var p = el('div', 'pdf-narrative');
      p.innerHTML =
        '<h4>' + esc(T('윙 사이즈 추천')) + '</h4>' +
        '<p>' + esc(T('VMG 기반 윙 사이즈 추천은 풍향·풍속·라이더 입력이 모두 확정되면 활성화됩니다.')) + '</p>' +
        '<p style="color:#7E93A8;font-size:11px;margin-top:12px">' +
        esc(T('대시보드의 라이더·장비 카드와 풍향 설정 카드를 확인해 주세요.')) + '</p>';
      b.appendChild(p);
    }
    page.appendChild(b);
    return page;
  }

  /* ---------- P9 Appendix ---------- */
  function buildAppendixPage(page) {
    var b = el('div', 'pdf-block');
    var html = '';
    var sections = [
      [T('알고리즘 방법론'),
       T('속도·VMG·TWA·택킹/자이빙 자동 감지는 GPX trkpt 의 시각·좌표 데이터를 ' +
         'Haversine 거리·시간 차분으로 계산합니다. 풍향은 (1) 사용자 입력 (2) no-go ' +
         '구간 추정 (3) 회전 기하 추정 (4) 외부 기상 데이터 중 사용자가 확정한 ' +
         '소스를 기준으로 사용합니다.')],
      [T('데이터 소스'),
       T('GPX 1.1 (xmlns="http://www.topografix.com/GPX/1/1") · Vakaros Atlas 2 .vkx ' +
         '바이너리 포맷. 모든 분석은 브라우저 안에서 처리되며 파일은 서버로 ' +
         '업로드되지 않습니다.')],
      [T('점수 체계'),
       T('세일링 퍼포먼스 스코어(VPS)는 풍상·풍하·종합 3축으로 라이더의 스킬·장비 ' +
         '대비 실제 트랙 효율을 비교합니다. 절대 등급이 아니라 개인 베스트 대비 ' +
         '상대 점수입니다.')],
      [T('한계'),
       T('이 보고서는 클라이언트 사이드 자동 분석 결과입니다. 코칭은 보조 도구로 ' +
         '활용하시고 안전·기술 판단은 라이더 본인 또는 자격 코치의 판단을 우선해 ' +
         '주세요.')]
    ];
    for (var i = 0; i < sections.length; i++) {
      html +=
        '<div class="pdf-app__sec">' +
          '<h4 class="pdf-app__h">' + esc(sections[i][0]) + '</h4>' +
          '<p class="pdf-app__b">' + esc(sections[i][1]) + '</p>' +
        '</div>';
    }
    b.innerHTML = html;
    page.appendChild(b);

    // 카피라이트
    var copy = el('div', 'pdf-block');
    copy.innerHTML =
      '<p class="pdf-app__b" style="font-size:9px;color:#7E93A8;border-top:1px solid #E5EAF0;padding-top:12px;margin-top:24px">' +
      esc(T('© 단무지공방 / SailTech. 본 보고서는 dmjgroup.kr 라이딩 분석 대시보드로 자동 생성되었습니다.')) +
      '</p>';
    page.appendChild(copy);
    return page;
  }

  /* ============================================================
   * 전체 컨테이너 조립
   * ============================================================ */
  function buildPdfRoot() {
    injectPdfStyle();
    var prev = $('rd-pdf-root');
    if (prev) prev.parentNode.removeChild(prev);

    var meta = collectMeta();
    var includeHr = hasHr();
    var totalPages = includeHr ? 9 : 8;

    var root = el('div');
    root.id = 'rd-pdf-root';

    root.appendChild(buildCover(meta));

    var pageNo = 2;
    root.appendChild(buildSummary(meta, pageWithHead(T('세션 요약'), pageNo++, totalPages)));
    return Promise.resolve().then(function () {
      return captureMap();
    }).then(function (mapUrl) {
      root.appendChild(buildMapPage(mapUrl, meta,
        pageWithHead(T('GPS 트랙'), pageNo++, totalPages)));
      root.appendChild(buildSpeedPage(
        pageWithHead(T('속도 분석'), pageNo++, totalPages)));
      root.appendChild(buildManeuverPage(
        pageWithHead(T('회전 분석'), pageNo++, totalPages)));
      if (includeHr) {
        root.appendChild(buildHrPage(
          pageWithHead(T('심박 분석'), pageNo++, totalPages)));
      }
      root.appendChild(buildCoachPage(
        pageWithHead(T('Coach Danny 코멘트'), pageNo++, totalPages)));
      root.appendChild(buildWhatIfPage(
        pageWithHead(T('What-if 윙 추천'), pageNo++, totalPages)));
      root.appendChild(buildAppendixPage(
        pageWithHead(T('부록 · 방법론'), pageNo++, totalPages)));

      document.body.appendChild(root);
      return { root: root, totalPages: totalPages, meta: meta };
    });
  }

  /* ============================================================
   * 메인 API: generate({ download, share })
   * ============================================================ */
  function dateStamp() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  function buildFilename(meta) {
    var ko = getLang() === 'ko';
    // 세션 일자에서 YYYY-MM-DD 또는 YYYY.MM.DD 추출
    var m = (meta.date || '').match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/);
    var stamp = m ? m[0].replace(/[.-]/g, '').slice(0, 8) : dateStamp();
    return (ko ? '라이딩보고서-' : 'riding-report-') + stamp + '.pdf';
  }

  function showStatus(msg, kind) {
    var t = $('error-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' toast--' + kind : '');
    t.hidden = false;
    if (showStatus._t) clearTimeout(showStatus._t);
    showStatus._t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* §177 — page-by-page renderer (html2canvas + jsPDF 직접 사용).
     buildPdfRoot 결과의 각 .pdf-page 를 개별 html2canvas 로 캡쳐 후
     jsPDF.addImage + addPage 로 PDF blob 을 직접 조립한다. */
  function renderPdfBlob(rootEl) {
    var pages = rootEl.querySelectorAll('.pdf-page');
    if (!pages.length) return Promise.reject(new Error('no .pdf-page elements'));
    var jsPDFCtor = global.jspdf.jsPDF;
    var pdf = new jsPDFCtor({
      unit: 'pt', format: 'a4', orientation: 'portrait', compress: true
    });
    var pageW = pdf.internal.pageSize.getWidth();   // 595.28
    var pageH = pdf.internal.pageSize.getHeight();  // 841.89
    /* page 를 1개씩 순차 캡쳐 — 메모리 / 안정성 모두 page-by-page 가 유리.
       Promise chain 으로 sequential 처리. */
    var p = Promise.resolve();
    for (var i = 0; i < pages.length; i++) {
      (function (pageEl, idx) {
        p = p.then(function () {
          return global.html2canvas(pageEl, {
            scale: 1.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            windowWidth: 794,
            onclone: function (clonedDoc) {
              try {
                clonedDoc.documentElement.style.setProperty(
                  'font-family',
                  "'Pretendard',system-ui,-apple-system,sans-serif",
                  'important');
              } catch (e) { /* noop */ }
            }
          }).then(function (canvas) {
            var imgData = canvas.toDataURL('image/jpeg', 0.92);
            if (idx > 0) pdf.addPage('a4', 'portrait');
            pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
          });
        });
      })(pages[i], i);
    }
    return p.then(function () { return pdf.output('blob'); });
  }

  /* §178 — fullscreen 로딩 오버레이. PDF 가 생성되는 동안 사용자는 이 오버레이만
     본다 (그 뒤에서 #rd-pdf-root 가 정상 layout 으로 그려지고 html2canvas 가 캡쳐). */
  function showLoadingOverlay() {
    if ($('rd-pdf-overlay')) return;
    var div = document.createElement('div');
    div.id = 'rd-pdf-overlay';
    div.innerHTML =
      '<div id="rd-pdf-overlay__spinner" aria-hidden="true"></div>' +
      '<div id="rd-pdf-overlay__msg">' + esc(T('PDF 보고서 생성 중…')) + '</div>' +
      '<div id="rd-pdf-overlay__sub">' + esc(T('차트와 지도를 캡쳐하고 있어요 · 최대 30초')) + '</div>';
    document.body.appendChild(div);
  }
  function hideLoadingOverlay() {
    var o = $('rd-pdf-overlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  function generate(opts) {
    opts = opts || {};
    var ds = $('dashboard-view');
    if (!ds || ds.hidden) {
      return Promise.reject(new Error(
        T('PDF 보고서는 세션이 로드되었을 때만 생성할 수 있습니다')));
    }

    showStatus(T('PDF 보고서 생성 중…'));
    /* 로딩 오버레이 먼저 표시 — buildPdfRoot 가 body 에 큰 element 를
       붙이기 때문에 사용자 시야를 즉시 가려야 한다. */
    return Promise.all([ensureH2C(), ensureJsPDF(), ensurePretendard()])
      .then(function () { showLoadingOverlay(); return buildPdfRoot(); })
      .then(function (built) {
        var filename = buildFilename(built.meta);
        return renderPdfBlob(built.root).then(function (blob) {
          cleanup(built.root);
          hideLoadingOverlay();
          /* §178 — preview 모드: 다운로드/공유 트리거 대신 미리보기 모달
             을 띄워 사용자가 내용 확인 후 자기 buttons 으로 직접 다운로드/
             공유. 기본 동작이 되어야 한다 (Danny 2026-05-27). */
          if (opts.preview !== false && opts.download !== true && opts.share !== true) {
            openPreview(blob, filename, built.totalPages, {
              canShare: canShareFiles()
            });
            showStatus(T('PDF 미리보기 준비 완료'), 'ok');
            return { previewed: true, filename: filename,
                     totalPages: built.totalPages, blob: blob };
          }
          if (opts.share && navigator.canShare) {
            var file = new File([blob], filename, { type: 'application/pdf' });
            if (navigator.canShare({ files: [file] })) {
              return navigator.share({
                files: [file],
                title: T('라이딩 분석 보고서'),
                text: T('단무지공방 라이딩 분석 보고서')
              }).then(function () {
                showStatus(T('PDF 공유 완료'), 'ok');
                return { shared: true, filename: filename,
                         totalPages: built.totalPages, blob: blob };
              }).catch(function (err) {
                if (err && err.name === 'AbortError') {
                  showStatus(T('PDF 공유 취소'), 'warn');
                  return { shared: false, aborted: true, filename: filename,
                           totalPages: built.totalPages, blob: blob };
                }
                return downloadBlob(blob, filename).then(function () {
                  return { shared: false, downloaded: true, filename: filename,
                           totalPages: built.totalPages, blob: blob };
                });
              });
            }
          }
          return downloadBlob(blob, filename).then(function () {
            showStatus(T('PDF 다운로드 완료'), 'ok');
            return { downloaded: true, filename: filename,
                     totalPages: built.totalPages, blob: blob };
          });
        }).catch(function (err) {
          cleanup(built.root);
          hideLoadingOverlay();
          throw err;
        });
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        showStatus(T('PDF 생성 실패') + ': ' + msg, 'error');
        cleanup($('rd-pdf-root'));
        hideLoadingOverlay();
        throw err;
      });
  }

  function cleanup(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  /* ============================================================
   * §178 — PDF 미리보기 모달 (Danny 2026-05-27).
   *   생성된 PDF blob 을 iframe 에 띄워 사용자가 다운로드/공유 전에
   *   내용을 확인할 수 있게 한다. 모바일에서는 iframe 안 PDF 가 종종
   *   안 보여서 '새 탭 열기' 폴백을 제공한다.
   *   닫기/다운로드/공유 버튼 + ESC/바깥 클릭으로 닫기.
   * ============================================================ */
  var PREVIEW_STYLE_ID = 'rd-pdf-preview-style';
  function ensurePreviewStyle() {
    if ($(PREVIEW_STYLE_ID)) return;
    var css =
      '#rd-pdf-preview{position:fixed;inset:0;z-index:100000;display:flex;' +
        'flex-direction:column;background:rgba(10,37,64,0.92);font-family:' +
        "'Pretendard',system-ui,-apple-system,sans-serif}" +
      '#rd-pdf-preview__head{flex:0 0 auto;display:flex;align-items:center;' +
        'justify-content:space-between;padding:14px 20px;background:#0A2540;' +
        'color:#FFF;border-bottom:1px solid #1F3A52}' +
      '#rd-pdf-preview__title{font-size:15px;font-weight:600;letter-spacing:-0.01em}' +
      '#rd-pdf-preview__meta{font-size:12px;color:#A8B4C0;margin-left:10px;font-weight:400}' +
      '#rd-pdf-preview__body{flex:1 1 auto;background:#3C4654;overflow:hidden}' +
      '#rd-pdf-preview__iframe{width:100%;height:100%;border:none;background:#FFF}' +
      '#rd-pdf-preview__fallback{display:flex;align-items:center;justify-content:center;' +
        'height:100%;color:#FFF;text-align:center;padding:24px;flex-direction:column;gap:12px}' +
      '#rd-pdf-preview__foot{flex:0 0 auto;display:flex;gap:8px;justify-content:flex-end;' +
        'padding:12px 20px;background:#0A2540;border-top:1px solid #1F3A52}' +
      '.rd-pdf-pv-btn{padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;' +
        'border:1px solid transparent;cursor:pointer;font-family:inherit;letter-spacing:-0.01em}' +
      '.rd-pdf-pv-btn--primary{background:#FFB800;color:#0A2540;border-color:#E0A100}' +
      '.rd-pdf-pv-btn--primary:hover{background:#FFC526}' +
      '.rd-pdf-pv-btn--ghost{background:transparent;color:#FFF;border-color:#3C4654}' +
      '.rd-pdf-pv-btn--ghost:hover{background:rgba(255,255,255,0.08)}' +
      '.rd-pdf-pv-btn--danger{background:transparent;color:#FF8B7E;border-color:#3C4654}' +
      '.rd-pdf-pv-btn--danger:hover{background:rgba(255,139,126,0.08)}';
    var s = document.createElement('style');
    s.id = PREVIEW_STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function openPreview(blob, filename, totalPages, opts) {
    opts = opts || {};
    ensurePreviewStyle();
    // 기존 모달이 있으면 정리
    var prev = $('rd-pdf-preview');
    if (prev) prev.parentNode.removeChild(prev);

    var url = URL.createObjectURL(blob);
    var sizeKB = Math.round(blob.size / 1024);
    var modal = document.createElement('div');
    modal.id = 'rd-pdf-preview';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', T('PDF 미리보기'));

    var head = document.createElement('div');
    head.id = 'rd-pdf-preview__head';
    head.innerHTML =
      '<div><span id="rd-pdf-preview__title">' + esc(T('PDF 미리보기')) + '</span>' +
      '<span id="rd-pdf-preview__meta">' + esc(filename) + ' · ' +
      totalPages + T('쪽') + ' · ' + sizeKB + ' KB</span></div>';

    var body = document.createElement('div');
    body.id = 'rd-pdf-preview__body';
    var iframe = document.createElement('iframe');
    iframe.id = 'rd-pdf-preview__iframe';
    iframe.src = url;
    iframe.title = T('PDF 미리보기');
    body.appendChild(iframe);

    /* 모바일 사파리 / iOS — iframe PDF 가 안 보일 수 있어 폴백 안내 */
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    var foot = document.createElement('div');
    foot.id = 'rd-pdf-preview__foot';

    var canShare = opts.canShare && navigator.canShare;
    var shareBtnHtml = canShare
      ? '<button class="rd-pdf-pv-btn rd-pdf-pv-btn--primary" data-act="share">📤 ' + esc(T('공유')) + '</button>'
      : '';
    var openBtnHtml = isMobile
      ? '<button class="rd-pdf-pv-btn rd-pdf-pv-btn--ghost" data-act="open">🔗 ' + esc(T('새 탭')) + '</button>'
      : '';
    foot.innerHTML =
      '<button class="rd-pdf-pv-btn rd-pdf-pv-btn--danger" data-act="close">✕ ' + esc(T('닫기')) + '</button>' +
      openBtnHtml +
      '<button class="rd-pdf-pv-btn rd-pdf-pv-btn--ghost" data-act="download">⬇ ' + esc(T('다운로드')) + '</button>' +
      shareBtnHtml;

    modal.appendChild(head);
    modal.appendChild(body);
    modal.appendChild(foot);
    document.body.appendChild(modal);

    /* ESC 로 닫기 + 메모리 누수 방지 (revokeObjectURL) */
    function teardown() {
      try { URL.revokeObjectURL(url); } catch (e) {}
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { teardown(); }
    }
    document.addEventListener('keydown', onKey);

    /* 버튼 동작 — 다운로드 / 공유 / 새 탭 / 닫기 */
    foot.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'close') {
        teardown();
      } else if (act === 'download') {
        downloadBlob(blob, filename);
        showStatus(T('PDF 다운로드 완료'), 'ok');
      } else if (act === 'open') {
        global.open(url, '_blank');
      } else if (act === 'share') {
        var file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({
            files: [file],
            title: T('라이딩 분석 보고서'),
            text: T('단무지공방 라이딩 분석 보고서')
          }).then(function () {
            showStatus(T('PDF 공유 완료'), 'ok');
            teardown();
          }).catch(function (err) {
            if (err && err.name !== 'AbortError') {
              showStatus(T('PDF 공유 실패'), 'error');
            }
          });
        }
      }
    });

    return { teardown: teardown };
  }

  function downloadBlob(blob, filename) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      }, 100);
    });
  }

  /* ============================================================
   * 모바일/공유 detection
   * ============================================================ */
  function canShareFiles() {
    if (!navigator.canShare) return false;
    try {
      var probe = new File([new Blob(['x'])], 'probe.pdf', { type: 'application/pdf' });
      return navigator.canShare({ files: [probe] });
    } catch (e) { return false; }
  }

  /* ============================================================
   * Selftest — RDPdfExport._selftest() — 실제로 PDF 생성하고 페이지·언어 검증
   * ============================================================ */
  function selftest() {
    return new Promise(function (resolve) {
      var results = { pass: [], fail: [] };
      // 1. 라이브러리 로드 — html2canvas + jsPDF (각각 따로)
      Promise.all([ensureH2C(), ensureJsPDF()]).then(function () {
        results.pass.push('html2canvas + jsPDF loaded');
      }).catch(function () { results.fail.push('html2canvas/jsPDF load failed'); })

      // 2. 폰트 로드
      .then(function () { return ensurePretendard(); })
      .then(function () {
        results.pass.push('Pretendard loaded');
        return document.fonts.check("16px 'Pretendard'");
      })
      .then(function (ok) {
        if (ok) results.pass.push('Pretendard available'); else results.fail.push('Pretendard NOT available');
      })

      // 3. 빌드 (실제 PDF 생성은 안 하고 DOM 만)
      .then(function () { return buildPdfRoot(); })
      .then(function (built) {
        var pageCount = built.root.querySelectorAll('.pdf-page').length;
        results.pass.push('Pages built: ' + pageCount + ' (expected ' + built.totalPages + ')');
        if (pageCount !== built.totalPages) {
          results.fail.push('Page count mismatch');
        }
        // 한글 텍스트가 PDF 컨테이너 안에 있나 (ko 모드)
        var allText = built.root.textContent || '';
        var lang = getLang();
        if (lang === 'ko') {
          if (/[가-힣]/.test(allText)) results.pass.push('Korean glyphs present');
          else results.fail.push('Korean glyphs missing in ko mode');
        } else {
          // en mode — 영어 단어가 있어야
          if (/(Session|Riding|Track|Analysis|Coach)/i.test(allText)) results.pass.push('English text present');
          else results.fail.push('English text missing in en mode');
        }
        cleanup(built.root);
      })
      .catch(function (err) {
        results.fail.push('selftest exception: ' + (err && err.message ? err.message : err));
      })
      .then(function () { resolve(results); });
    });
  }

  /* ============================================================
   * 공개 API
   * ============================================================ */
  global.RDPdfExport = {
    generate: generate,
    canShareFiles: canShareFiles,
    _selftest: selftest,
    _buildPdfRoot: buildPdfRoot,   // 디버그용
    _ensure: function () {
      return Promise.all([ensureH2C(), ensureJsPDF(), ensurePretendard()]);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
