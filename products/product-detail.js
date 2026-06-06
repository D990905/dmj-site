/* ============================================================
 * product-detail.js — §209 사이즈 선택 → 가격 reactive 표시
 * By 알렉스 박 (Alex Park, #4) · 2026-06-06 · DO_NOT_REVERT §209
 *
 * 옥대표님 발견 2026-06-06: "사이즈를 선택하면 옆에 바로 가격이
 * 인터액티브하게 나와야 하는데 없어"
 *
 * 설계
 *  · Single source — 모든 product 상세 page 공통. per-page JS 중복 X.
 *  · matrix.js 의 DMJMatrix.getPrice(sku, size) 를 source-of-truth.
 *    → products.json size_pricing_KRW 또는 PRICE_OVERRIDES fallback.
 *  · WCAG 2.1 SC 4.1.3 (Status Messages) — aria-live="polite" announce.
 *  · matrix.js 가 비동기 로드 → DMJMatrix 가용 시점 대기 (poll 500ms × 6 회).
 *  · 미로드/lookup miss → "—" 표시 (silent), console.warn 로깅.
 *
 * 의존
 *  · matrix.js (window.DMJMatrix.getPrice) — 같은 페이지에 이미 로드됨
 *  · cart.js delegated handler — DOM contract 공유 (data-sku, data-size)
 *
 * 회귀 가드
 *  · §171-B v4 (cart 시스템) → 영향 0. data-size sync 기존 inline script 유지.
 *  · §182-B (aria-live cart badge) → 별도 element, 충돌 X.
 *  · 신규 요소 = .pd-buy__price (DOM 추가). 기존 selector 영향 X.
 * ============================================================ */
(function () {
  'use strict';

  function fmtKRW(num) {
    if (typeof num !== 'number' || !isFinite(num) || num <= 0) return '—';
    return '₩' + num.toLocaleString('ko-KR');
  }

  function waitForMatrix(maxTries, intervalMs) {
    return new Promise(function (resolve) {
      var tries = 0;
      function poll() {
        if (window.DMJMatrix && typeof window.DMJMatrix.getPrice === 'function') {
          resolve(window.DMJMatrix);
          return;
        }
        tries++;
        if (tries >= maxTries) {
          console.warn('[product-detail §209] DMJMatrix.getPrice 미가용 — silent fallback');
          resolve(null);
          return;
        }
        setTimeout(poll, intervalMs);
      }
      poll();
    });
  }

  function init(matrix) {
    var selects = document.querySelectorAll('[data-buy-size]');
    if (!selects.length) return;

    selects.forEach(function (sel) {
      // 가격 display element 찾기 (markup 에 이미 있어야 함 — §209 sweep 으로 일괄 인서트)
      var wrap = sel.closest('.pd-buy') || sel.parentElement;
      if (!wrap) return;
      var display = wrap.querySelector('[data-pd-price]');
      if (!display) return; // markup 미인서트 페이지 → silent (회귀 안전)

      // SKU 결정 — 같은 .pd-buy 안의 [data-cart-add] 버튼 data-sku 활용.
      var btn = wrap.querySelector('[data-cart-add]');
      var sku = btn ? btn.getAttribute('data-sku') : null;
      if (!sku) return;

      function update() {
        var size = sel.value;
        var price = null;
        var fromHTML = false;

        // §212 (Danny 2026-06-06) — fallback path #1: option 의 data-price attribute.
        // matrix.js 의 size_pricing_KRW data 가 없는 product 도 작동 가능. HTML 이 source.
        try {
          var opt = sel.selectedOptions && sel.selectedOptions[0];
          if (opt && opt.dataset && opt.dataset.price) {
            var n = parseInt(opt.dataset.price, 10);
            if (isFinite(n) && n > 0) { price = n; fromHTML = true; }
          }
        } catch (_) {}

        // fallback path #2: matrix.js getPrice (size_pricing_KRW + PRICE_OVERRIDES)
        if (price == null && matrix && size) {
          try {
            var mp = matrix.getPrice(sku, size);
            if (isFinite(mp) && mp > 0) price = mp;
          } catch (e) {
            console.warn('[product-detail §209] getPrice err', { sku: sku, size: size, err: e });
          }
        }

        // Render — '—' silent fallback (data 부재 시 honest 표시)
        display.textContent = fmtKRW(price);

        // estimate hint — HTML data-price 직접 source 면 estimate X (의도된 정확값).
        if (!fromHTML && typeof matrix !== 'undefined' && matrix && typeof matrix.isPriceEstimate === 'function' && matrix.isPriceEstimate(sku)) {
          display.setAttribute('data-estimate', '1');
        } else {
          display.removeAttribute('data-estimate');
        }
      }

      // 초기 1회 + change 시 갱신
      update();
      sel.addEventListener('change', update);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      waitForMatrix(6, 500).then(init);
    });
  } else {
    waitForMatrix(6, 500).then(init);
  }
})();
