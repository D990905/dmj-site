// DO_NOT_REVERT §171-B (Danny 2026-05-13) — Cart system spec lock.
// localStorage 기반 장바구니 + 견적요청 시스템. 회원 전용 (로그인 enforce).
// 운송비 카테고리별 (§171 canonical) · 사업자 정보 144-55-01008 · Phase 12 백엔드 연동 전 console.info placeholder.
// 변경 시 Danny 명시 승인 필수.
//
// API (window.DMJCart):
//   add(item)              {sku, qty:1, size?, addedAt}
//   remove(sku)
//   setQty(sku, qty)
//   clear()
//   getItems()             → array
//   getCount()             → total qty
//   getSubtotal(products)  → KRW (pass products.json data)
//   computeShipping(items, products) → {breakdown, total}
//   getTotal(products)     → KRW
//   isLoggedIn()           → bool
//
// 저장: window.DMJAuth.{get,set,remove}UserData('cart', JSON.stringify(items))
//       per-user namespace (§169-K). 비로그인 시 anon namespace + 로그인 시 마이그레이션.

(function () {
  'use strict';

  var STORAGE_SUFFIX = 'cart';

  function getAuth() {
    return window.DMJAuth || null;
  }

  function isLoggedIn() {
    var a = getAuth();
    return !!(a && a.isLoggedIn && a.isLoggedIn());
  }

  function readItemsRaw() {
    var a = getAuth();
    if (!a || !a.getUserData) {
      // Fallback (auth-shim 미로드 시): 비회원 — anon 키 직접 read.
      try {
        var raw = localStorage.getItem('dmj_anon_' + STORAGE_SUFFIX);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    var raw = a.getUserData(STORAGE_SUFFIX);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function writeItems(items) {
    items = Array.isArray(items) ? items : [];
    var a = getAuth();
    if (!a || !a.setUserData) {
      try { localStorage.setItem('dmj_anon_' + STORAGE_SUFFIX, JSON.stringify(items)); } catch (e) {}
    } else {
      a.setUserData(STORAGE_SUFFIX, JSON.stringify(items));
    }
    notifyChange(items);
  }

  function notifyChange(items) {
    try {
      var ev = new CustomEvent('dmj:cart:change', { detail: { items: items } });
      document.dispatchEvent(ev);
    } catch (e) {}
  }

  function getItems() {
    var items = readItemsRaw();
    // sanity: ensure every item has sku + qty
    return items.filter(function (i) { return i && i.sku && i.qty > 0; });
  }

  function getCount() {
    return getItems().reduce(function (sum, i) { return sum + (Number(i.qty) || 0); }, 0);
  }

  function add(item) {
    if (!item || !item.sku) return false;
    var items = getItems();
    var existing = items.find(function (x) {
      return x.sku === item.sku && (x.size || '') === (item.size || '');
    });
    if (existing) {
      existing.qty += (item.qty || 1);
    } else {
      items.push({
        sku: item.sku,
        size: item.size || null,
        qty: item.qty || 1,
        addedAt: item.addedAt || Date.now()
      });
    }
    writeItems(items);
    // §170 v9 (Danny 2026-05-13) — R6 Set Bundle 권장 토스트.
    // 사용자가 R6 FW + Mast + RW 3종 모두 SOLO 추가 시 → "Set bundle 로 ₩430K 절약" 안내.
    try { suggestR6Bundle(items); } catch (e) { /* swallow */ }
    return true;
  }

  // §170 v9 — R6 FW + Mast + RW 3종 SOLO 모두 cart 에 있고 R6 set bundle 없으면 토스트.
  function suggestR6Bundle(items) {
    var hasFw = items.some(function (i) { return /^lvz-r6-fw-/.test(i.sku); });
    var hasMast = items.some(function (i) { return /^lvz-r6-mast-/.test(i.sku); });
    var hasRw = items.some(function (i) { return /^lvz-r6-rear-wing-/.test(i.sku); });
    var hasSet = items.some(function (i) { return /^lvz-r6-set-/.test(i.sku); });
    if (hasFw && hasMast && hasRw && !hasSet) {
      // sessionStorage flag to avoid spamming (1회 per session)
      try {
        if (sessionStorage.getItem('dmj_r6_bundle_suggested')) return;
        sessionStorage.setItem('dmj_r6_bundle_suggested', '1');
      } catch (e) { /* swallow */ }
      // Inline toast (no UI framework dependency — vanilla DOM)
      if (typeof document === 'undefined' || !document.body) return;
      var existing = document.getElementById('dmj-r6-bundle-toast');
      if (existing) existing.remove();
      var toast = document.createElement('div');
      toast.id = 'dmj-r6-bundle-toast';
      toast.className = 'dmj-r6-bundle-toast';
      toast.innerHTML =
        '<div class="dmj-r6-bundle-toast__head">💡 R6 Set Bundle 권장</div>' +
        '<p class="dmj-r6-bundle-toast__body">R6 FW + Mast + RW 3종 모두 담으셨네요. <strong>Set bundle (₩9,050,000)</strong> 으로 변경 시 <strong style="color:var(--color-sun)">₩420,000 절약</strong> 가능합니다.</p>' +
        '<div class="dmj-r6-bundle-toast__actions">' +
          '<a href="' + (typeof location !== 'undefined' && /products\//.test(location.pathname) ? '' : 'products/levitaz/') + 'r6-race.html#r6-bundle-section" class="btn btn--accent btn--sm">R6 Set 보기</a>' +
          '<button type="button" class="btn btn--ghost btn--sm" id="dmj-r6-toast-close">나중에</button>' +
        '</div>';
      document.body.appendChild(toast);
      var closeBtn = document.getElementById('dmj-r6-toast-close');
      if (closeBtn) closeBtn.addEventListener('click', function () { toast.remove(); });
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 12000);
    }
  }

  function remove(sku, size) {
    var items = getItems().filter(function (i) {
      if (size != null) return !(i.sku === sku && (i.size || null) === size);
      return i.sku !== sku;
    });
    writeItems(items);
  }

  function setQty(sku, qty, size) {
    qty = Math.max(0, Number(qty) || 0);
    if (qty === 0) { remove(sku, size); return; }
    var items = getItems();
    var found = items.find(function (i) {
      if (size != null) return i.sku === sku && (i.size || null) === size;
      return i.sku === sku;
    });
    if (found) found.qty = qty;
    writeItems(items);
  }

  function clear() {
    var a = getAuth();
    if (a && a.removeUserData) a.removeUserData(STORAGE_SUFFIX);
    else { try { localStorage.removeItem('dmj_anon_' + STORAGE_SUFFIX); } catch (e) {} }
    notifyChange([]);
  }

  // ---- Product lookup helpers ----
  // DO_NOT_REVERT §171-B v3 (Danny 2026-05-13) — multi-key SKU lookup.
  // products.json uses kebab-case (`ppc-m1x`, `lvz-fs540`); guard against case/dash drift in cart entries.
  function findProductInData(products, sku) {
    if (!products || !sku) return null;
    var cats = ['wings', 'foils', 'boards', 'accessories'];
    // 1) Exact match across categories
    for (var i = 0; i < cats.length; i++) {
      if (products[cats[i]] && products[cats[i]][sku]) return products[cats[i]][sku];
    }
    // 2) Fallback: case-insensitive + dash variations
    var skuLower = String(sku).toLowerCase();
    var skuVariants = {};
    skuVariants[skuLower] = 1;
    skuVariants[skuLower.replace(/-/g, '')] = 1;             // ppc-m1x → ppcm1x
    skuVariants[skuLower.replace(/_/g, '-')] = 1;            // ppc_m1x → ppc-m1x
    skuVariants[skuLower.replace(/m([0-9])/, 'm-$1')] = 1;   // ppcm1x → ppcm-1x
    for (var c = 0; c < cats.length; c++) {
      var bucket = products[cats[c]] || {};
      var keys = Object.keys(bucket);
      for (var j = 0; j < keys.length; j++) {
        var k = keys[j].toLowerCase();
        if (skuVariants[k]) return bucket[keys[j]];
      }
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[DMJCart] SKU lookup failed for:', sku,
                   '— available cats:', cats.filter(function (cat) { return products[cat]; }));
    }
    return null;
  }

  // DO_NOT_REVERT §171-B v3 + §171 v5-critical (Danny 2026-05-13) — board-size nearest-fallback inside cart.js
  // (defensive duplicate of matrix.js boardSizeToInches). cart.html/quote.html 가 file:// 로 열릴 때나
  // matrix.js 미로드 시에도 "가격 안내 받기" placeholder 회귀 방지. Takoon Glide 5'0" 같은 unregistered size 케이스.
  function boardSizeToInchesCart(s) {
    if (s == null) return null;
    var m = String(s).match(/^(\d+)['′](\d+)(?:["″]?)$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
  }

  function lookupPrice(products, sku, size) {
    var p = findProductInData(products, sku);
    if (p) {
      if (p.size_pricing_KRW && size != null) {
        var dict = p.size_pricing_KRW;
        var raw = String(size).replace(/"$/, '');
        var candidates = [raw, String(size)];
        if (/^\d+(\.\d+)?$/.test(raw)) {
          var withDec = raw.indexOf('.') === -1 ? raw + '.0' : raw;
          var noTrail = raw.replace(/\.0$/, '');
          candidates.push(withDec, noTrail, raw + 'm', withDec + 'm', noTrail + 'm', raw + 'm²', withDec + 'm²', noTrail + 'm²');
        }
        for (var i = 0; i < candidates.length; i++) {
          if (dict[candidates[i]] != null) return dict[candidates[i]];
        }
        // DO_NOT_REVERT §171-B v3 — board-size nearest-fallback (Takoon Glide 5'0" 등 unregistered size).
        var targetIn = boardSizeToInchesCart(raw);
        if (targetIn != null) {
          var nearestKey = null, nearestDist = Infinity;
          var dictKeys = Object.keys(dict);
          for (var dk = 0; dk < dictKeys.length; dk++) {
            var kIn = boardSizeToInchesCart(dictKeys[dk]);
            if (kIn == null) continue;
            var d = Math.abs(kIn - targetIn);
            if (d < nearestDist || (d === nearestDist && (nearestKey == null || kIn > boardSizeToInchesCart(nearestKey)))) {
              nearestDist = d;
              nearestKey = dictKeys[dk];
            }
          }
          if (nearestKey != null) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[DMJCart] board-size nearest-fallback', { sku: sku, requested: size, used: nearestKey, distance_in: nearestDist });
            }
            return dict[nearestKey];
          }
        }
      }
      if (p.price_KRW != null) return p.price_KRW;
    }
    // DO_NOT_REVERT §171-B v3 — matrix.js PRICE_OVERRIDES dual fallback.
    // Some SKUs (e.g. Levitaz Boom, WIP add-ons) have prices only in matrix.js PRICE_OVERRIDES.
    if (window.DMJMatrix && typeof window.DMJMatrix.getPrice === 'function') {
      try {
        var ovPrice = window.DMJMatrix.getPrice(sku, size);
        if (ovPrice != null) return ovPrice;
      } catch (e) { /* swallow — fall through to null */ }
    }
    return null;
  }

  function getSubtotal(products) {
    var items = getItems();
    return items.reduce(function (sum, i) {
      var price = lookupPrice(products, i.sku, i.size);
      if (price == null) return sum;
      return sum + price * (i.qty || 1);
    }, 0);
  }

  // ---- Shipping (§171 v6 canonical, Danny 2026-05-13 lock) ----
  // 운송 baked into SKU display price (PRICE_OVERRIDES + products.json size_pricing_KRW).
  // cart shipping = 0 강제 (이중 청구 차단). 옛 §171 v5-critical (운송 별도) SUPERSEDED.
  // 산식 (SKU 가격에 이미 적용): (본사 retail KRW + 운송 KRW) × 1.188, round to ₩1,000.
  // 참조 운송 rate (PRICE_OVERRIDES 코멘트 + products.json _shipping_baked 참조용, cart 가산 X):
  //   FOIL_SET/BOARD ₩500K · FOIL_FW ₩200K · FOIL_MAST ₩300K · FOIL_STAB ₩100K
  //   WING_FDS ₩300K · WING_HANDLE ₩250K · ACCESSORY ₩50K
  // DO_NOT_REVERT §171 v6 — cart 운송 가산 회귀 영구 X. SHIP 객체 비-zero 회귀 X.
  var SHIP = {
    FOIL_SET: 0,
    FOIL_FW: 0,
    FOIL_MAST: 0,
    FOIL_STAB: 0,
    WING_FDS: 0,
    WING_HANDLE: 0,
    BOARD: 0,
    ACCESSORY: 0
  };

  // DO_NOT_REVERT §171-B v3 — classifyItem 정확 분기. "악세사리" default 회귀 영구 X.
  // SKU prefix heuristic (data 없어도 동작) + product-data heuristic (data 있으면 더 정확).
  function classifyBySkuPrefix(sku) {
    var s = String(sku || '').toLowerCase();
    if (!s) return null;
    // PPC = wings (M1, M1-X, M2, M1-R SDS, Sonic FDS) — except PPC R1 race board.
    // §178-A (2026-05-19) — 'ppc-r1*' = board, 다른 PPC SKU = wing.
    if (s.indexOf('ppc-r1') === 0) {
      return { cat: 'board', label: '보드' };
    }
    if (s.indexOf('ppc-') === 0) {
      if (s.indexOf('fds') >= 0 || s.indexOf('sds') >= 0) return { cat: 'wing-fds', label: '윙 (싱글붐/FDS)' };
      return { cat: 'wing-handle', label: '윙 (핸들 윙)' };
    }
    // Takoon V4 / V4Pro / VXPro / Wing prefix
    if (s.indexOf('tkn-wing') === 0 || s.indexOf('wing-') === 0) {
      if (s.indexOf('fds') >= 0 || s.indexOf('sds') >= 0) return { cat: 'wing-fds', label: '윙 (싱글붐/FDS)' };
      return { cat: 'wing-handle', label: '윙 (핸들 윙)' };
    }
    // §171 v7 (Danny 2026-05-14) — Takoon foil SET bundles (front wing + stab + mast + fuselage 묶음).
    // tkn-starter / tkn-xglide-v2 / tkn-flow-carbon / tkn-flare-carbon = foil-set, NOT foil-fw.
    // DO_NOT_REVERT §171 v7 — Takoon Starter foil-fw 회귀 영구 X.
    if (/^tkn-(starter|xglide-v2|flow-carbon|flare-carbon)$/.test(s) || /^tkn-xglide$/.test(s)) {
      return { cat: 'foil-set', label: '포일 세트' };
    }
    // Foil front-wing (Levitaz FS, R6, Takoon foil single-FW SKUs only).
    // Takoon set/assembly SKUs (starter/xglide/flow-carbon/flare-carbon) 이 위에서 잡혀 도달 X.
    if (/^lvz-(fs|r6-fw)/.test(s) || /^tkn-(flow|flare|swell|flash)$/.test(s)) {
      return { cat: 'foil-fw', label: '포일 프론트윙' };
    }
    // Foil mast
    if (/-mast/.test(s) || /^lvz-mast/.test(s) || /^tkn-mast/.test(s)) {
      return { cat: 'foil-mast', label: '포일 마스트' };
    }
    // Foil stab / rear wing
    if (/-stab/.test(s) || /-rw/.test(s) || /^lvz-stab/.test(s) || /^tkn-stab/.test(s)) {
      return { cat: 'foil-stab', label: '포일 스태빌라이저' };
    }
    // Board
    if (s.indexOf('lvz-board') === 0 || s.indexOf('tkn-board') === 0 || s.indexOf('board-') === 0 || /^lvz-(go|race|tt)/.test(s)) {
      return { cat: 'board', label: '보드' };
    }
    // WIP safety accessories
    if (s.indexOf('wip-') === 0) {
      return { cat: 'accessory', label: 'WIP 안전·액세서리' };
    }
    return null;
  }

  function classifyItem(p, sku) {
    // §170 v9 + §171 v7 (Danny 2026-05-14) — type='foil-set' = 사전 묶음 (FW+Mast+RW+(fuselage)).
    // 운송 ₩500K SKU 가격에 baked in (products.json note). cart shipping = 0 (cat 'foil-set').
    // Brand-aware label: Levitaz R6 Race Set / Takoon Starter / Takoon X-Glide / Takoon Flow Carbon / Flare Carbon / 일반.
    // DO_NOT_REVERT §171 v7 — Takoon foil-set SKU (starter/xglide-v2/flow-carbon/flare-carbon) foil-fw 회귀 영구 X.
    if (p && p.type === 'foil-set') {
      var brandName = String(p.brand || '').toLowerCase();
      var modelName = String(p.model || '');
      var label = '포일 세트';
      if (brandName === 'levitaz' && /r6/i.test(modelName)) label = '포일 세트 (R6 Race Set)';
      else if (brandName === 'takoon' && /starter/i.test(modelName)) label = '포일 세트 (Takoon Starter)';
      else if (brandName === 'takoon' && /x-glide/i.test(modelName)) label = '포일 세트 (Takoon X-Glide V2)';
      else if (brandName === 'takoon' && /flow\s*carbon/i.test(modelName)) label = '포일 세트 (Takoon Flow Carbon)';
      else if (brandName === 'takoon' && /flare\s*carbon/i.test(modelName)) label = '포일 세트 (Takoon Flare Carbon)';
      else if (brandName === 'takoon') label = '포일 세트 (Takoon)';
      else if (brandName === 'levitaz') label = '포일 세트 (Levitaz)';
      return { cat: 'foil-set', label: label };
    }
    if (sku && sku.indexOf('lvz-r6-set') === 0) return { cat: 'foil-set', label: '포일 세트 (R6 Race Set)' };
    // §171 v7 — Takoon foil-set SKU fallback (products data missing 시 SKU prefix 으로 즉시 분기).
    if (sku && /^tkn-(starter|xglide-v2|flow-carbon|flare-carbon)$/.test(String(sku).toLowerCase())) {
      return { cat: 'foil-set', label: '포일 세트' };
    }
    // Prefer product-data heuristic when available, else SKU prefix.
    if (p) {
      // wings: by sizes_m2 + model name
      if (p.sizes_m2 != null) {
        var ml = String(p.model || '').toLowerCase();
        if (ml.indexOf('fds') >= 0 || ml.indexOf('sds') >= 0 || ml.indexOf('boom') >= 0) {
          return { cat: 'wing-fds', label: '윙 (싱글붐/FDS)' };
        }
        return { cat: 'wing-handle', label: '윙 (핸들 윙)' };
      }
      if (p.wing_area_cm2 != null) {
        return { cat: 'foil-fw', label: '포일 프론트윙' };
      }
      if (p.sizes_ft != null || (Array.isArray(p.sizes) && p.sizes.some(function (s) { return /['"]/.test(String(s)); }))) {
        return { cat: 'board', label: '보드' };
      }
      var modelLow = String(p.model || '').toLowerCase();
      var brandLow = String(p.brand || '').toLowerCase();
      if (modelLow.indexOf('mast') >= 0) return { cat: 'foil-mast', label: '포일 마스트' };
      if (modelLow.indexOf('stab') >= 0 || modelLow.indexOf('rear') >= 0) return { cat: 'foil-stab', label: '포일 스태빌라이저' };
      if (brandLow.indexOf('wip') >= 0 || modelLow.indexOf('helmet') >= 0 || modelLow.indexOf('vest') >= 0 || modelLow.indexOf('harness') >= 0 || modelLow.indexOf('boot') >= 0) {
        return { cat: 'accessory', label: 'WIP 안전·액세서리' };
      }
    }
    // Fallback to SKU prefix (works even if products data missing)
    var byPrefix = classifyBySkuPrefix(sku);
    if (byPrefix) return byPrefix;
    return { cat: 'accessory', label: '액세서리' };
  }

  function computeShipping(items, products) {
    // §171 v6 (Danny 2026-05-13) — 운송 baked into SKU display price. cart 운송 = 0 강제.
    // 옛 분류·그룹화 logic 은 future audit reference 용으로 유지하나, breakdown 빈 array 반환.
    // DO_NOT_REVERT §171 v6 — 회귀 lint guard 추가 (outputs/v5/pricelist_drift_lint.js).
    return { breakdown: [], total: 0 };
    // ---- legacy logic below (unreachable, kept for reference / future v7 if Danny reverses) ----
    /* eslint-disable no-unreachable */
    items = items || getItems();
    var groups = {};
    var entries = items.map(function (i) {
      var p = findProductInData(products, i.sku);
      var c = classifyItem(p, i.sku);
      return { item: i, product: p, cat: c.cat, label: c.label };
    });

    // Detect foil set: 1+ FW + 1+ mast + 1+ stab from same brand → 1 set.
    var byBrand = {};
    entries.forEach(function (e) {
      if (!e.product) return;
      if (['foil-fw', 'foil-mast', 'foil-stab'].indexOf(e.cat) < 0) return;
      var b = String(e.product.brand || 'unknown').toLowerCase();
      if (!byBrand[b]) byBrand[b] = { fw: [], mast: [], stab: [] };
      if (e.cat === 'foil-fw') byBrand[b].fw.push(e);
      if (e.cat === 'foil-mast') byBrand[b].mast.push(e);
      if (e.cat === 'foil-stab') byBrand[b].stab.push(e);
    });

    // Mark items that are part of a "set" so we don't double-charge their individual ship.
    var setBrands = [];
    Object.keys(byBrand).forEach(function (b) {
      var g = byBrand[b];
      if (g.fw.length && g.mast.length && g.stab.length) {
        setBrands.push(b);
        // Mark first FW + first mast + first stab as 'in-set' (qty 1 each).
        // Remainders ship individually.
        g.fw[0].inSet = true;
        g.mast[0].inSet = true;
        g.stab[0].inSet = true;
      }
    });

    var breakdown = []; // {label, qty, unitShip, subtotal}
    function addLine(label, qty, unit) {
      if (qty <= 0) return;
      breakdown.push({ label: label, qty: qty, unitShip: unit, subtotal: unit * qty });
    }

    setBrands.forEach(function (b) {
      addLine('포일 셋 (' + b.toUpperCase() + ' · FW+마스트+스태빌)', 1, SHIP.FOIL_SET);
    });

    // Per-category counters (excluding items already absorbed by a set).
    var counts = {
      'foil-fw': 0, 'foil-mast': 0, 'foil-stab': 0,
      'wing-fds': 0, 'wing-handle': 0, 'board': 0, 'accessory': 0,
      'foil-set': 0
    };
    entries.forEach(function (e) {
      var qty = Number(e.item.qty) || 1;
      if (e.inSet) qty = Math.max(0, qty - 1); // one absorbed by set
      if (qty <= 0) return;
      if (counts[e.cat] != null) counts[e.cat] += qty;
      else counts['accessory'] += qty;
    });

    addLine('포일 프론트윙 (단품)', counts['foil-fw'], SHIP.FOIL_FW);
    addLine('포일 마스트 (단품)', counts['foil-mast'], SHIP.FOIL_MAST);
    addLine('포일 스태빌라이저 (단품)', counts['foil-stab'], SHIP.FOIL_STAB);
    addLine('윙 (싱글붐 / FDS · SDS)', counts['wing-fds'], SHIP.WING_FDS);
    addLine('윙 (핸들 윙)', counts['wing-handle'], SHIP.WING_HANDLE);
    addLine('보드', counts['board'], SHIP.BOARD);
    addLine('안전장비 · 액세서리', counts['accessory'], SHIP.ACCESSORY);

    var total = breakdown.reduce(function (s, l) { return s + l.subtotal; }, 0);
    return { breakdown: breakdown, total: total };
    /* eslint-enable no-unreachable */
  }

  function getTotal(products) {
    var sub = getSubtotal(products);
    var ship = computeShipping(getItems(), products).total;
    return sub + ship;
  }

  function getProduct(products, sku) {
    return findProductInData(products, sku);
  }

  window.DMJCart = {
    add: add,
    remove: remove,
    setQty: setQty,
    clear: clear,
    getItems: getItems,
    getCount: getCount,
    getSubtotal: getSubtotal,
    computeShipping: computeShipping,
    getTotal: getTotal,
    isLoggedIn: isLoggedIn,
    getProduct: getProduct,
    lookupPrice: lookupPrice,
    classifyItem: classifyItem,
    SHIPPING_RATES: SHIP,
    _STORAGE_SUFFIX: STORAGE_SUFFIX
  };

  // Auto-update any cart badge on the page on load + on cart change.
  function updateBadges() {
    var n = getCount();
    var nodes = document.querySelectorAll('[data-cart-badge]');
    nodes.forEach(function (el) {
      el.textContent = String(n);
      if (n > 0) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
  }
  document.addEventListener('dmj:cart:change', updateBadges);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadges);
  } else {
    updateBadges();
  }
})();
