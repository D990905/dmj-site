/* §560 차트 포인트 오버레이 — RDTip
   ────────────────────────────────────────────────────────────────
   옥대표: "그래프 상의 동그라미 포인트에 커서가 도달했을때 오버레이로
           해당 포인트의 정보를 간략히 요약해서 노출시켜줘."

   uPlot 기본 범례는 차트 **아래**에 값만 적는다. 그래서 점을 보면서 값을
   읽으려면 시선이 두 번 움직이고, 무엇보다 **그 점이 무엇인지**를 말하지
   않는다 — 시즌 흐름의 점 하나는 '세션 하나'인데 어느 세션인지 알 수 없다.

   그래서 오버레이는 값이 아니라 **정체**부터 적는다.

   설계
     · 커서가 가장 가까운 점에 닿으면 그 점 옆에 뜬다(고정 위치 아님).
     · 차트 밖으로 넘치지 않게 좌우를 뒤집는다.
     · 내용은 호출부가 만든다 — 차트마다 할 말이 다르다.
     · 터치에서도 뜬다(uPlot 커서는 포인터 이벤트를 그대로 받는다).
*/
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureStyle() {
    if (document.getElementById('rdtip-style')) return;
    var st = document.createElement('style');
    st.id = 'rdtip-style';
    st.textContent =
      '.rdtip{position:absolute;z-index:30;pointer-events:none;opacity:0;'
      + 'transition:opacity .12s;min-width:132px;max-width:260px;'
      + 'background:var(--tblr-bg-surface,#1a2234);color:var(--tblr-body-color,#e6e9ef);'
      + 'border:1px solid var(--tblr-border-color,#2b3a55);border-radius:6px;'
      + 'padding:.45rem .55rem;box-shadow:0 6px 18px rgba(0,0,0,.35);'
      + 'font-size:.75rem;line-height:1.35}'
      + '.rdtip__h{font-weight:600;margin-bottom:.2rem}'
      + '.rdtip__r{display:flex;gap:.6rem;justify-content:space-between}'
      + '.rdtip__k{color:var(--tblr-secondary,#9aa4b2)}'
      + '.rdtip__v{font-family:"IBM Plex Mono",ui-monospace,monospace;'
      + 'font-variant-numeric:tabular-nums}'
      + '.rdtip__n{margin-top:.25rem;color:var(--tblr-secondary,#9aa4b2);font-size:.6875rem}'
      + '@media (prefers-reduced-motion: reduce){.rdtip{transition:none}}';
    document.head.appendChild(st);
  }

  /* content = { title, rows: [[k,v],…], note } */
  function html(c) {
    if (!c) return '';
    var s = '';
    if (c.title) s += '<div class="rdtip__h">' + esc(c.title) + '</div>';
    (c.rows || []).forEach(function (r) {
      s += '<div class="rdtip__r"><span class="rdtip__k">' + esc(r[0])
        + '</span><span class="rdtip__v">' + esc(r[1]) + '</span></div>';
    });
    if (c.note) s += '<div class="rdtip__n">' + esc(c.note) + '</div>';
    return s;
  }

  /* uPlot 인스턴스에 붙인다. build(idx, u) 가 content 를 돌려준다.
     null 을 돌려주면 그 점에서는 안 뜬다. */
  function attach(u, build) {
    if (!u || !u.over || typeof build !== 'function') return null;
    ensureStyle();
    var tip = document.createElement('div');
    tip.className = 'rdtip';
    tip.setAttribute('role', 'status');
    /* over 는 position:relative 라 그 안에 절대배치하면 좌표가 곧 차트 좌표다 */
    u.over.appendChild(tip);

    function hide() { tip.style.opacity = '0'; }

    function place(idx) {
      var c = null;
      try { c = build(idx, u); } catch (e) {
        if (global.console) console.error('[RDTip] build failed', e);
        c = null;
      }
      if (!c) { hide(); return; }
      tip.innerHTML = html(c);
      /* 점의 실제 좌표에 붙인다 — 커서 좌표가 아니라. 그래야 점을 가리킨다. */
      var xVal = u.data[0][idx];
      var sIdx = c.seriesIdx || 1;
      var yVal = u.data[sIdx] ? u.data[sIdx][idx] : null;
      var x = u.valToPos(xVal, 'x');
      var y = (yVal != null && isFinite(yVal))
        ? u.valToPos(yVal, u.series[sIdx].scale || 'y')
        : (u.cursor.top || 0);
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = x + 14, top = y - h - 12;
      /* 차트 밖으로 나가면 반대쪽으로 뒤집는다 */
      if (left + w > u.over.clientWidth) left = x - w - 14;
      if (left < 0) left = 2;
      if (top < 0) top = y + 14;
      if (top + h > u.over.clientHeight) top = Math.max(0, u.over.clientHeight - h - 2);
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
      tip.style.opacity = '1';
    }

    /* setCursor 훅은 uPlot 이 매 이동마다 부른다 */
    u.hooks = u.hooks || {};
    var prev = -1;
    function onCursor(uu) {
      var idx = uu.cursor.idx;
      if (idx == null || uu.cursor.left < 0) { hide(); prev = -1; return; }
      if (idx === prev) return;
      prev = idx;
      place(idx);
    }
    /* 이미 만들어진 인스턴스에도 붙일 수 있어야 하므로 이벤트로도 듣는다 */
    u.over.addEventListener('mouseleave', hide);
    if (u.hooks.setCursor) u.hooks.setCursor.push(onCursor);
    else u.hooks.setCursor = [onCursor];
    return { hide: hide, el: tip, _onCursor: onCursor };
  }

  /* uPlot 생성 옵션에 훅을 미리 심어 두는 형태. 생성 후 attach 를 부르는
     것과 같지만, opts 를 만들 때 한 줄로 끝난다. */
  function hookInto(opts, build) {
    opts = opts || {};
    opts.hooks = opts.hooks || {};
    var ready = function (u) { attach(u, build); };
    if (opts.hooks.ready) opts.hooks.ready.push(ready);
    else opts.hooks.ready = [ready];
    return opts;
  }

  global.RDTip = { attach: attach, hookInto: hookInto, _html: html };
})(typeof window !== 'undefined' ? window : this);
