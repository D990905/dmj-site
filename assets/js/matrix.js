/* ==========================================================================
   단무지 — 64-scenario Equipment Matrix Renderer
   /assets/js/matrix.js
   v1.3 — Demographic adjustment layer (5 segments) added 2026-05-05
   v1.4 — Wind baseline pill + ±1 사이즈 fallback note (2026-05-07, Danny 명시)
          모든 추천 카드 = 중풍 11-16kt 기준 명시 + 풍속별 사이즈 분기 안내.
          SoT: reference_dmj_wind_classification.md, 정책: DO_NOT_REVERT §66~.
   v1.5 — Board 1차/2차 패턴 (2026-05-07, Danny 명시)
          ADVANCED Speed/Hybrid → 1차 Levitaz Boom FS / 2차 Takoon (가격 부담 시).
          board 필드 schema = string (legacy) | object {primary, secondary, secondary_note}.
          정책: DO_NOT_REVERT §73, reference_dmjgroup_site_rules.md §3 상급.
   ========================================================================== */

(function () {
  'use strict';

  const DATA_BASE = (function () {
    // works for /level/*.html, /style/*.html, /find-my-gear.html, /women/, /junior/, /family/
    const path = window.location.pathname;
    if (path.includes('/level/') || path.includes('/style/')
        || path.includes('/women/') || path.includes('/junior/')
        || path.includes('/family/')) return '../data/';
    return 'data/';
  })();

  const ASSETS_BASE = (function () {
    const path = window.location.pathname;
    if (path.includes('/level/') || path.includes('/style/')
        || path.includes('/women/') || path.includes('/junior/')
        || path.includes('/family/')) return '../';
    return '';
  })();

  const STATE = {
    products: null,
    matrix: null
  };

  // ---- Data loading ----
  // Tries fetch first (production / http(s)). On failure (file:// CORS, offline,
  // 404), falls back to inline bundles in this priority order:
  //   1) window.DMJ_MATRIX_INLINE  (§175-B canonical — data/dmj-matrix-inline.js)
  //   2) window.DMJ_DATA_INLINE    (backward-compat — legacy host-page injection)
  // Throws a clear error if no source works so callers can show a message
  // instead of leaving the UI silently empty.
  function readInlineBundle() {
    const m = window.DMJ_MATRIX_INLINE;
    if (m && m.products && m.matrix) return { products: m.products, matrix: m.matrix, source: 'DMJ_MATRIX_INLINE' };
    const d = window.DMJ_DATA_INLINE;
    if (d && d.products && d.matrix) return { products: d.products, matrix: d.matrix, source: 'DMJ_DATA_INLINE' };
    return null;
  }

  async function loadData() {
    if (STATE.products && STATE.matrix) return;
    try {
      const [p, m] = await Promise.all([
        fetch(DATA_BASE + 'products.json').then(r => {
          if (!r.ok) throw new Error('products.json HTTP ' + r.status);
          return r.json();
        }),
        fetch(DATA_BASE + 'equipment_matrix.json').then(r => {
          if (!r.ok) throw new Error('equipment_matrix.json HTTP ' + r.status);
          return r.json();
        })
      ]);
      STATE.products = p;
      STATE.matrix = m;
      return;
    } catch (err) {
      // Fall back to inline bundle shipped via data/dmj-matrix-inline.js (or
      // legacy host-page DMJ_DATA_INLINE). file:// pages rely on this path.
      const inline = readInlineBundle();
      if (inline) {
        STATE.products = inline.products;
        STATE.matrix = inline.matrix;
        console.info('[DMJMatrix] using inline fallback (' + inline.source + ')');
        return;
      }
      console.error('[DMJMatrix] data load failed:', err);
      throw err;
    }
  }

  // ---- Lookups ----
  function findProduct(id) {
    if (!STATE.products) return null;
    const p = STATE.products;
    return p.wings[id] || p.foils[id] || p.boards[id] || p.accessories[id] || null;
  }

  function entriesByLevel(level) {
    if (!STATE.matrix) return [];
    return STATE.matrix.entries.filter(e => e.level === level);
  }

  function entriesByStyle(style) {
    if (!STATE.matrix) return [];
    return STATE.matrix.entries.filter(e => e.style === style);
  }

  function lookupEntry(level, weight, style) {
    if (!STATE.matrix) return null;
    return STATE.matrix.entries.find(e => e.level === level && e.weight === weight && e.style === style);
  }

  function getDemographic(key) {
    if (!STATE.matrix || !STATE.matrix._meta || !STATE.matrix._meta.demographic_adjustments) return null;
    return STATE.matrix._meta.demographic_adjustments[key] || null;
  }

  function getDemographicMsg(key) {
    if (!STATE.matrix || !STATE.matrix._meta || !STATE.matrix._meta.demographic_messages) return null;
    return STATE.matrix._meta.demographic_messages[key] || null;
  }

  // ---- Demographic adjustment ----
  // Returns a deep-copy entry with wing sizes adjusted, FDS swapped if excluded, etc.
  function applyDemographicAdjustment(entry, demographicKey) {
    if (!entry || !demographicKey) return entry;
    const adj = getDemographic(demographicKey);
    if (!adj) return entry;

    // Deep clone so we don't mutate the source
    const e = JSON.parse(JSON.stringify(entry));

    // Wing size offset (negative offset = smaller wings)
    if (adj.wing_offset && Array.isArray(e.wing.sizes_m2)) {
      const offset = adj.wing_offset; // e.g. -1 = drop 0.5m²
      e.wing.sizes_m2 = e.wing.sizes_m2.map(s => {
        const adjusted = +(s + offset * 0.5).toFixed(2);
        return Math.max(2.5, adjusted); // floor at 2.5m² (smallest reasonable wing)
      });
      // Dedupe
      e.wing.sizes_m2 = Array.from(new Set(e.wing.sizes_m2));
    }

    // FDS exclusion (youth, child, senior — no Sonic FDS)
    if (adj.fds_excluded) {
      if (e.wing.primary === 'ppc-fds') e.wing.primary = 'ppc-m1x';
      if (e.wing.alternative === 'ppc-fds') e.wing.alternative = 'ppc-m1';
    }

    // Demographic note appended to reasoning
    if (adj.note) {
      e._demographic_note = adj.note;
      e._demographic_label = adj.label_ko;
    }

    return e;
  }

  // ---- Rendering ----
  const STYLE_LABELS = {
    'flat-speed': 'Flat·Speed',
    'choppy-freeride': 'Choppy·Freeride',
    'wave': 'Wave',
    'hybrid': 'Hybrid'
  };
  const STYLE_DESC = {
    'flat-speed': '평수면·속도 우선 — 강·내수면 flat한 컨디션',
    'choppy-freeride': '한국 일반 spot — choppy 한 freeride',
    'wave': '파도·서핑 라이딩 — wave 한국 동해안',
    'hybrid': '다목적 — 한 세트로 여러 컨디션'
  };
  const WEIGHT_LABELS = {
    'light': '~60kg',
    'mid-light': '~70kg',
    'mid-heavy': '~80kg',
    'heavy': '90kg+'
  };
  const WEIGHT_RANGE = {
    'light': '50–65kg',
    'mid-light': '65–75kg',
    'mid-heavy': '75–85kg',
    'heavy': '85kg 이상'
  };
  // §180 (Danny 2026-05-21) — demographic 별 체중 라벨 (퀴즈 결과 제목·카드 배지용).
  //   매트릭스 weight 키 (light/mid-light/mid-heavy/heavy) 불변. browse 뷰(매트릭스
  //   카드·그룹 헤드)는 WEIGHT_LABELS(남성 기준) 그대로 — adult_female 퀴즈 결과에서만
  //   여성 라벨 적용. find-my-gear.html WEIGHT_OPTION_LABELS 와 짝. DO_NOT_REVERT §180.
  const WEIGHT_LABELS_BY_DEMO = {
    'adult_female': {
      'light': '~40kg',
      'mid-light': '~50kg',
      'mid-heavy': '~60kg',
      'heavy': '70kg+'
    }
  };
  function weightLabelFor(weightKey, demographic) {
    const demoSet = demographic && WEIGHT_LABELS_BY_DEMO[demographic];
    if (demoSet && demoSet[weightKey]) return demoSet[weightKey];
    return WEIGHT_LABELS[weightKey] || weightKey;
  }
  // §155 v3 — 5-level canonical (beginner / novice / intermediate / advanced / pro)
  const LEVEL_LABELS = {
    'beginner': '입문',
    'novice': '초급',
    'intermediate': '중급',
    'advanced': '상급',
    'pro': '선수'
  };
  const DEMO_LABELS = {
    'adult_male': '성인 남성',
    'adult_female': '성인 여성',
    'youth': '유소년 (13-17)',
    'senior': '시니어 (65세 이상)'
  };

  // PPC tier ordering (always M2 → M1-X → M1 → FDS)
  const PPC_ORDER = ['ppc-m2', 'ppc-m1x', 'ppc-m1', 'ppc-fds'];

  // ---- Wind baseline (Danny 2026-05-07 명시 — SoT: reference_dmj_wind_classification.md) ----
  const WIND_BASELINE = {
    label: '중풍 11-16 kt',
    range_kt: [11, 16],
    pill_html: '<span class="wind-baseline-pill" title="모든 추천 카드는 중풍 11-16kt 기준 — 본인 spot에 맞춰 ±1 사이즈 조정"><span class="wind-baseline-pill__label">기준 풍속</span>중풍 11-16 kt</span>',
    note_html: '<div class="wind-baseline-note" role="note"><span class="wind-baseline-note__row"><strong>미풍 ≤10 kt</strong> — 윙 한 사이즈 ↑ 권장</span><span class="wind-baseline-note__row"><strong>강풍 ≥17 kt</strong> — 윙 한 사이즈 ↓ 권장</span></div>',
    section_baseline_html: '<span class="cons-matrix__wind-baseline" role="note">💨 <span><strong>모든 카드 = 중풍 11-16 kt 기준</strong></span> <span class="cons-matrix__wind-baseline__sep">·</span> <span>미풍 ≤10kt → 윙 ↑1 / 강풍 ≥17kt → 윙 ↓1</span></span>'
  };

  // ==================================================================
  // v1.6 — find-my-gear 결과 카드 강화 (Danny 명시 2026-05-09, DO_NOT_REVERT §112)
  //   결과 카드에 보드 사양·각 장비 가격·합계·detail 페이지 사이즈별 anchor 표시.
  //   SoT: outputs/brand-price-table-2026-v3.md (가격), site/data/products.json (size_pricing_KRW),
  //        site/products/{brand}/{slug}.html spec-table (보드 사양).
  // ==================================================================

  // SKU → individual detail HTML (relative to /site/). Items missing a detail page
  // fall back to brand-page anchor (consistent with products.json page_url).
  const DETAIL_URLS = {
    // Wings (7)
    'ppc-m2': 'products/ppc/m2.html',
    'ppc-m1x': 'products/ppc/m1-x.html',
    'ppc-m1': 'products/ppc/m1.html',
    'ppc-fds': 'products/ppc/fds.html',
    'takoon-v4': 'products/takoon/wing-v4.html',
    'takoon-v4-pro': 'products/takoon/wing-v4-pro.html',
    'takoon-vx-pro-2': 'products/takoon/wing-vx-pro-2.html',
    // Foils — Levitaz front wings (4) + masts (3, brand-anchor only) + stab (1, brand-anchor only)
    'lvz-fs540': 'products/levitaz/fw-540.html',
    'lvz-fs680': 'products/levitaz/fw-680.html',
    'lvz-fs790': 'products/levitaz/fw-790.html',
    'lvz-fs900': 'products/levitaz/fw-900.html',
    'lvz-mast76': 'products/levitaz.html#mast76',
    'lvz-mast84': 'products/levitaz.html#mast84',
    'lvz-mast96': 'products/levitaz.html#mast96',
    'lvz-stab180': 'products/levitaz.html#stab180',
    // Foils — Takoon front wings (8)
    'tkn-starter': 'products/takoon/foil-starter-front-wing.html',
    'tkn-xglide-v2': 'products/takoon/foil-x-glide-v2-front-wing.html',
    'tkn-flow': 'products/takoon/foil-flow-front-wing.html',
    'tkn-flare': 'products/takoon/foil-flare-front-wing.html',
    'tkn-flow-carbon': 'products/takoon/foil-flow-carbon.html',
    'tkn-flare-carbon': 'products/takoon/foil-flare-carbon.html',
    'tkn-swell': 'products/takoon/foil-swell-front-wing.html',
    'tkn-flash': 'products/takoon/foil-flash-front-wing.html',
    // Foils — Takoon masts (5) + stabs (4, only HA has detail)
    'tkn-mast-aluminium-175': 'products/takoon/foil-aluminium-mast-v2-17-5-mm.html',
    'tkn-mast-aluminium-19': 'products/takoon/foil-aluminium-mast-v2-19mm.html',
    'tkn-mast-carbon-hr-16': 'products/takoon/foil-carbon-mast-hr-v2-16-mm.html',
    'tkn-mast-carbon-hm-16': 'products/takoon/foil-carbon-mast-hm-v2-16-mm.html',
    'tkn-mast-carbon-hm-13': 'products/takoon/foil-carbon-mast-hm-v2-13mm.html',
    'tkn-stab-evo': 'products/takoon.html#stab-evo',
    'tkn-stab-glide': 'products/takoon.html#stab-glide',
    'tkn-stab-carve': 'products/takoon.html#stab-carve',
    'tkn-stab-glide-ha': 'products/takoon/foil-stab-glide-ha.html',
    // Boards (12 — §178-A 2026-05-19: PPC R1 race board 3 SKU 신규)
    'lvz-boom-fs63': 'products/levitaz/boom-fs-63.html',
    'lvz-boom-fs83': 'products/levitaz/boom-fs-83.html',
    'lvz-boom-fs95': 'products/levitaz/boom-fs-95.html',
    'ppc-r1-73': 'products/ppc/r1.html',                // PPC R1 73L (Track/Tuttle 동가)
    'ppc-r1-83': 'products/ppc/r1.html',                // PPC R1 83L
    'ppc-r1-93': 'products/ppc/r1.html',                // PPC R1 93L
    'ppc-r1': 'products/ppc/r1.html',                   // alias (size 미지정 시 페이지 hub)
    'takoon-cruise': 'products/takoon/cruise.html',
    'takoon-slide': 'products/takoon/slide.html',
    'takoon-glide-midlength': 'products/takoon/glide-midlength.html',
    'takoon-glide': 'products/takoon/glide.html',
    'takoon-ultra-glide': 'products/takoon/ultra-glide.html',
    'takoon-prosurf': 'products/takoon/prosurf.html',
    // Accessories (6 — wetsuits no detail)
    'wip-impact-vest': 'products/wip/impact-vest.html',
    'wip-helmet': 'products/wip/helmet.html',                  // legacy alias → WIFLEX PRO 2.0 (helmet.html)
    'wip-helmet-wiflex': 'products/wip/helmet.html',           // WIFLEX PRO 2.0 — entry·mid tier
    'wip-helmet-xover': 'products/wip/helmet-xover.html',      // X-OVER Helmet — race·premium tier
    'wip-harness': 'products/wip/harness.html',
    'wip-wetsuit-32': 'products/wip.html#wetsuit',
    'wip-wetsuit-43': 'products/wip.html#wetsuit-winter'
  };

  // Per-size board specs — SoT: site/products/{brand}/{slug}.html spec-table--sized rows.
  // length_cm/width_cm: only Levitaz Boom FS publishes them; Takoon detail pages omit (null = 확인 중).
  const BOARD_SPECS = {
    'lvz-boom-fs63': {
      "63L": { volume_l: 63, weight_kg: null, length_cm: 150, width_cm: 45, recommended_kg: '60–80' }
    },
    'lvz-boom-fs83': {
      "83L": { volume_l: 83, weight_kg: null, length_cm: 170, width_cm: 48.1, recommended_kg: '60–90' }
    },
    'lvz-boom-fs95': {
      "95L": { volume_l: 95, weight_kg: null, length_cm: 194, width_cm: 48, recommended_kg: '75–110' }
    },
    // §178-A PPC R1 race board (2026-05-19) — Track/Tuttle 동가, 사이즈만 다름.
    // 본사 spec: ppcfoiling.com/products/new-ppc-r1-race-foil-board
    'ppc-r1-73': {
      "73L": { volume_l: 73, weight_kg: 3.1,  length_cm: 152.4, width_cm: 50.8, recommended_kg: '50–70' }
    },
    'ppc-r1-83': {
      "83L": { volume_l: 83, weight_kg: 3.95, length_cm: 160.0, width_cm: 53.3, recommended_kg: '65–85' }
    },
    'ppc-r1-93': {
      "93L": { volume_l: 93, weight_kg: 4.4,  length_cm: 167.6, width_cm: 55.9, recommended_kg: '80–95' }
    },
    'takoon-cruise': {
      "5'6\"":  { volume_l: 75,  weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '50–70' },
      "5'10\"": { volume_l: 100, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '65–85' },
      "6'0\"":  { volume_l: 125, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '80–100' }
    },
    'takoon-slide': {
      "5'4\"": { volume_l: 55,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '55–70' },
      "5'6\"": { volume_l: 65,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '60–75' },
      "5'9\"": { volume_l: 75,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '65–80' },
      "6'0\"": { volume_l: 85,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '70–85' },
      "6'3\"": { volume_l: 95,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '75–90' },
      "6'6\"": { volume_l: 105, weight_kg: 16.0, length_cm: null, width_cm: null, recommended_kg: '80–95' },
      "6'9\"": { volume_l: 115, weight_kg: 16.0, length_cm: null, width_cm: null, recommended_kg: '85–100' },
      "7'0\"": { volume_l: 120, weight_kg: 18.0, length_cm: null, width_cm: null, recommended_kg: '90–110' }
    },
    'takoon-glide-midlength': {
      "4'10\"": { volume_l: 70,  weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '55–70' },
      "5'4\"":  { volume_l: 85,  weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '65–80' },
      "5'8\"":  { volume_l: 95,  weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '70–85' },
      "5'10\"": { volume_l: 100, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '75–90' },
      "6'0\"":  { volume_l: 110, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '80–95' },
      "6'4\"":  { volume_l: 120, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '85–100' },
      "6'6\"":  { volume_l: 125, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '90–105' },
      "6'8\"":  { volume_l: 130, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '90–110' },
      "6'10\"": { volume_l: 135, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '95–115' },
      "7'0\"":  { volume_l: 140, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '100–120' },
      "7'2\"":  { volume_l: 150, weight_kg: 15.0, length_cm: null, width_cm: null, recommended_kg: '105–130' }
    },
    'takoon-glide': {
      "4'9\"": { volume_l: 45,  weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '55–65' },
      "5'0\"": { volume_l: 60,  weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '60–75' },
      "5'2\"": { volume_l: 75,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '65–80' },
      "5'4\"": { volume_l: 85,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '70–85' },
      "5'6\"": { volume_l: 95,  weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '75–90' },
      "5'8\"": { volume_l: 105, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '80–100' }
    },
    'takoon-ultra-glide': {
      "5'8\"":  { volume_l: 70,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '60–75' },
      "5'10\"": { volume_l: 80,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '65–80' },
      "6'2\"":  { volume_l: 90,  weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '70–85' },
      "6'6\"":  { volume_l: 100, weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '75–90' },
      "6'8\"":  { volume_l: 110, weight_kg: 16.0, length_cm: null, width_cm: null, recommended_kg: '80–95' },
      "6'10\"": { volume_l: 115, weight_kg: 16.0, length_cm: null, width_cm: null, recommended_kg: '85–100' },
      "7'0\"":  { volume_l: 125, weight_kg: 18.0, length_cm: null, width_cm: null, recommended_kg: '90–110' },
      "7'2\"":  { volume_l: 135, weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '95–115' },
      "7'4\"":  { volume_l: 140, weight_kg: 14.0, length_cm: null, width_cm: null, recommended_kg: '100–120' }
    },
    'takoon-prosurf': {
      "4'9\"":  { volume_l: 32, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '55–65' },
      "4'10\"": { volume_l: 38, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '55–70' },
      "5'0\"":  { volume_l: 48, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '60–75' },
      "5'1\"":  { volume_l: 55, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '65–78' },
      "5'2\"":  { volume_l: 62, weight_kg: 12.0, length_cm: null, width_cm: null, recommended_kg: '70–82' }
    }
  };

  // Supplemental prices for SKUs without size_pricing_KRW in products.json.
  // SoT: outputs/brand-price-table-2026-v5.4.md (v5.4, 2026-05-13 — §171 운송비 카테고리별 재도입).
  // 산식 §171 (Danny 2026-05-13 LOCK): 한국 판매가 = ROUND( (본사가 × 환율 + 운송비_KRW) × 1.188 , -3 ).
  // 환율: EUR = 1800, USD = 1500, CHF = 1900 (3 통화 confirmed by owner).
  // 운송비 카테고리별 (per SKU row):
  //   포일 set (FW+Mast+RW bundle) = ₩500K · FW 단품 = ₩200K · Mast 단품 = ₩300K · RW/Stab 단품 = ₩100K
  //   Wing FDS/싱글붐 = ₩300K · Wing handle = ₩250K · Board = ₩500K · WIP/accessory = TBD (skip)
  // 이전 §170 v3 "운송 산식 폐기" lines (no shipping) 영구 X — Danny 2026-05-13 정정.
  // Exact values: outputs/v5/{Takoon,Levitaz,PPC,WIP}_2026_한국가격표_finalized.xlsx.
  // Policy §154 (Danny 2026-05-12) — 사이트 visible UI = 모든 SKU 가격 표시 의무. "협의 중" 노출 영구 금지. _est:true = "~" prefix only (추정치 표기).
  const PRICE_OVERRIDES = {
    // §171 v6 (Danny 2026-05-13, canonical) — 운송 baked into display, cart.js shipping = 0.
    // 산식: (본사 retail KRW + 운송 KRW) × 1.188, round to ₩1,000.
    // FX: EUR×1800 / USD×1500 / CHF×1900. 운송: BOARD/FOIL_SET 500K / FOIL_FW 200K / FOIL_MAST 300K / FOIL_STAB 100K / WING_FDS 300K / WING_HANDLE 250K / ACCESSORY 50K.
    // §171 v5-critical (운송 별도, EUR×1800×1.188) SUPERSEDED. §174 v1 (Levitaz 운송 별도) SUPERSEDED.
    // cart.js SHIP * = 0 강제 (이중 청구 차단). DO_NOT_REVERT §171 v6 영구 lock.
    // Boards (Levitaz Boom Free Series — BOARD ship 500K baked)
    'lvz-boom-fs63': 4660000,                          // Boom FS 63 SCC (€2415.83 × 1800 = ₩4,348,500 + 500K) × 1.188 = ₩5,760,018 → ₩5,760K [§171 v6]
    'lvz-boom-fs83': 4810000,                          // Boom FS 83 SCC (€2499.17 × 1800 = ₩4,498,500 + 500K) × 1.188 = ₩5,938,218 → ₩5,938K [§171 v6]
    'lvz-boom-fs95': 4960000,                          // Boom FS 95 SCC (€2582.50 × 1800 = ₩4,648,500 + 500K) × 1.188 = ₩6,116,418 → ₩6,116K [§171 v6]
    // §178-A PPC R1 race board 3 SKU × 2 옵션 (Track/Tuttle 동가) — 2026-05-19. Track/Tuttle 가격 차이 X.
    // §171 v6 산식: (USD × 1500 + 500K BOARD ship) × 1.188, round ₩10K (site display).
    'ppc-r1-73': 5780000,                              // R1 73L Track or Tuttle ($2,910 × 1500 + 500K) × 1.188 = ₩5,779,620 → ₩5,780K [§178-A]
    'ppc-r1-83': 5820000,                              // R1 83L Track or Tuttle ($2,930 × 1500 + 500K) × 1.188 = ₩5,815,260 → ₩5,820K [§178-A]
    'ppc-r1-93': 5870000,                              // R1 93L Track or Tuttle ($2,960 × 1500 + 500K) × 1.188 = ₩5,868,720 → ₩5,870K [§178-A]
    'ppc-r1': 5820000,                                 // alias = 83L 대표가 (find-my-gear hub link)
    // Levitaz Free Series Front Wings (FOIL_FW ship 200K baked)
    'lvz-fs540': 1860000,                              // FW 540 (€940.83 × 1800 = ₩1,693,500 + 200K) × 1.188 = ₩2,249,478 → ₩2,249K [§171 v6]
    'lvz-fs680': 1880000,                              // FW 680 (€957.50 × 1800 = ₩1,723,500 + 200K) × 1.188 = ₩2,285,118 → ₩2,285K [§171 v6]
    'lvz-fs790': 2030000,                              // FW 790 (€1040.83 × 1800 = ₩1,873,500 + 200K) × 1.188 = ₩2,463,318 → ₩2,463K [§171 v6]
    'lvz-fs900': 2110000,                              // FW 900 (€1082.50 × 1800 = ₩1,948,500 + 200K) × 1.188 = ₩2,552,418 → ₩2,552K [§171 v6]
    // Levitaz Masts (FOIL_MAST ship 300K baked)
    'lvz-mast76': 2180000,                             // Mast 76 (€1124.17 × 1800 = ₩2,023,500 + 300K) × 1.188 = ₩2,760,318 → ₩2,760K [§171 v6]
    'lvz-mast84': 2260000,                             // Mast 84 (€1165.83 × 1800 = ₩2,098,500 + 300K) × 1.188 = ₩2,849,418 → ₩2,849K [§171 v6]
    'lvz-mast96': 2400000,                             // Mast 96 (€1249.17 × 1800 = ₩2,248,500 + 300K) × 1.188 = ₩3,027,618 → ₩3,028K [§171 v6]
    // Levitaz Stab (FOIL_STAB ship 100K baked)
    'lvz-stab180': 990000,                            // Stab 180 (€457.50 × 1800 = ₩823,500 + 100K) × 1.188 = ₩1,097,118 → ₩1,097K [§171 v6]
    // Levitaz R6 Race Series (race-line 침투 정책)
    'lvz-r6-fw-v1': 2490000,                           // R6 FW V1 480cm² (정확 479) · Span 80 · AR 13.7 · 1248g · G461562 · €1,299 — (€1299×1800 + 200K)×1.188 = ₩3,015,382 → ₩3,015K [§171 v6 + §170 v7]
    'lvz-r6-fw-v2': 2490000,                           // R6 FW V2 430cm² · Span 74 · AR 12.9 · 1170g · G467114 · 강풍 전용 · €1,299 [§171 v6 + §170 v7]
    'lvz-r6-fw-v3': 2490000,                           // R6 FW V3 530cm² · Span 87 · AR 14.3 · 1322g · G472585 · FORMULA WING · €1,299 [§171 v6 + §170 v7]
    'lvz-r6-mast-v1': 3560000,                         // R6 Mast V1 · €1,899 · (€1899×1800 + 300K)×1.188 = ₩4,417,222 → ₩4,417K [§171 v6]
    'lvz-r6-mast-v2': 3560000,                         // R6 Mast V2 · €1,899 [§171 v6]
    'lvz-r6-rear-wing-v1': 1960000,                    // R6 RW V1 172cm² · Span 46 · AR 12.6 · 222g · G463777 · €999 — (€999×1800 + 100K)×1.188 = ₩2,255,062 → ₩2,255K [§171 v6 + §170 v10]
    'lvz-r6-rear-wing-v2': 1960000,                    // R6 RW V2 172cm² · Span 44 · AR 11.3 · 227g · G462363 · €999 [§171 v6 + §170 v7]
    // R6 Set Bundle — foil-set type, FOIL_SET ship 500K baked (cart 가 cat='foil-set' 추가 운송 X).
    // (€3,999 × 1800 = ₩7,198,200 + 500K) × 1.188 = ₩9,144,462 → ₩9,144K. SOLO 합산: ₩3,015K + ₩4,417K + ₩2,255K = ₩9,687K. Bundle 절약 ~₩543K.
    'lvz-r6-set-v1': 7480000,                          // R6 Race Set V1 (FW V1 + Mast V1 + RW V1) [§171 v6 + §170 v9]
    'lvz-r6-set-v2': 7480000,                          // R6 Race Set V2 (FW V2 + Mast V2 + RW V2) [§171 v6 + §170 v9]
    'lvz-r6-set-mixed': 7480000,                       // R6 Race Set Mixed (FW V3 + Mast V2 + RW V2 · Danny 권장) [§171 v6 + §170 v9]
    // §170-A — DO_NOT_REVERT: 'lvz-r6-fuselage' 영구 제거 (Levitaz lineup 에 fuselage 없음, mast 통합 구조).
    // Levitaz Free Series Sets (foil-set type, FOIL_SET ship 500K baked) — §171 v10 (Danny 2026-05-15).
    // RETAIL EUR = xlsx Free Series_Set Info col M (brand-price-table v5.3). 산식: (€ × 1800 + 500K) × 1.188.
    'lvz-fs-set-540': 4930000,                         // FS Set FW540+Mast84+Stab180 (€2564.17×1800 + 500K)×1.188 = ₩6,077,214 → ₩6,077K · SOLO ₩6,195K · 절약 ₩118K [§171 v10]
    'lvz-fs-set-680': 4960000,                         // FS Set FW680+Mast84+Stab180 (€2580.83×1800 + 500K)×1.188 = ₩6,112,854 → ₩6,113K · SOLO ₩6,231K · 절약 ₩118K [§171 v10]
    'lvz-fs-set-790': 5250000,                         // FS Set FW790+Mast96+Stab180 (€2747.50×1800 + 500K)×1.188 = ₩6,469,254 → ₩6,469K · SOLO ₩6,588K · 절약 ₩119K [§171 v10]
    'lvz-fs-set-900': 5330000,                         // FS Set FW900+Mast96+Stab180 (€2789.17×1800 + 500K)×1.188 = ₩6,558,354 → ₩6,558K · SOLO ₩6,677K · 절약 ₩119K [§171 v10]

    // Takoon Foil Front Wings (FOIL_FW ship 200K baked)
    'tkn-flow': 1070000,                               // Foil Flow FW 1050 (€499×1800 + 200K)×1.188 = ₩1,304,662 → ₩1,305K [§171 v6]
    'tkn-flare': 980000,                              // Foil Flare FW 1050 (€449×1800 + 200K)×1.188 = ₩1,197,742 → ₩1,198K [§171 v6]
    // Flow/Flare Carbon = foil assemblies (FOIL_SET ship 500K baked, 단일 SKU bundled)
    'tkn-flow-carbon': 3040000,                        // Foil Flow Carbon assembly (€1258×1800 + 500K)×1.188 = ₩3,283,907 → ₩3,284K [§171 v6]
    'tkn-flare-carbon': 2630000,                       // Foil Flare Carbon assembly (€1229×1800 + 500K)×1.188 = ₩3,222,094 → ₩3,222K [§171 v6]
    'tkn-swell': 860000,                              // Foil Swell FW 1050 (€449×1800 + 200K)×1.188 = ₩1,197,742 → ₩1,198K [§171 v6]
    'tkn-flash': 1090000,                              // Foil Flash FW 680 (€459×1800 + 200K)×1.188 = ₩1,219,126 → ₩1,219K [§171 v6]
    // Takoon Stab (FOIL_STAB ship 100K baked)
    'tkn-stab-evo': 450000,                            // Stab Glide HA 130 proxy (€130×1800 + 100K)×1.188 = ₩396,792 → ₩397K [§171 v6]
    'tkn-stab-glide': 450000,                          // Stab Glide HA 130 (€130) [§171 v6]
    'tkn-stab-carve': 460000,                          // Stab Carve 190 (€42×1800 + 100K)×1.188 = ₩208,613 → ₩209K [§171 v6]
    'tkn-stab-glide-ha': 410000,                       // Foil Stab Glide HA 130 (€130) [§171 v6]
    // Takoon Masts (FOIL_MAST ship 300K baked)
    'tkn-mast-aluminium-175': 330000,                  // Aluminium Mast V2 17.5mm 75cm (€85×1800 + 300K)×1.188 = ₩538,164 → ₩538K [§171 v6]
    'tkn-mast-aluminium-19':  300000,                  // Aluminium Mast V2 19mm 75cm (€90×1800 + 300K)×1.188 = ₩548,856 → ₩549K [§171 v6]
    'tkn-mast-carbon-hr-16': 1350000,                  // Carbon Mast HR V2 16mm 85cm (€549×1800 + 300K)×1.188 = ₩1,530,381 → ₩1,530K [§171 v6]
    'tkn-mast-carbon-hm-16': 1490000,                  // Carbon Mast HM V2 16mm 80cm (€779×1800 + 300K)×1.188 = ₩2,022,213 → ₩2,022K [§171 v6]
    'tkn-mast-carbon-hm-13': 1700000,                  // Carbon Mast HM V2 13mm 80cm (€865×1800 + 300K)×1.188 = ₩2,206,116 → ₩2,206K [§171 v6]
    // Takoon foil sets (FOIL_SET ship 500K baked, single-SKU bundle)
    'tkn-starter': 1140000,                            // Foil Starter SET 1800 (€469×1800 + 500K)×1.188 = ₩1,596,910 → ₩1,597K [§171 v6]
    'tkn-xglide-v2': 1410000,                          // Foil X-Glide V2 SET 1250 (€610×1800 + 500K)×1.188 = ₩1,898,424 → ₩1,898K [§171 v6]
    // WIP (USD×1500, ACCESSORY ship 50K baked) — §172 v5.4 (100K) SUPERSEDED by §171 v6 canonical (50K).
    'wip-helmet': 250000,                              // legacy alias → wip-helmet-wiflex (WIFLEX PRO 2.0) · 사이트 표시 ₩10K rounded (xlsx canonical ₩246K)
    'wip-helmet-wiflex': 250000,                       // WIFLEX PRO 2.0 · 사이트 표시 ₩10K rounded (xlsx canonical ₩246K, USD $104.99, 12 SKU 동일가) [Danny lock 2026-05-17]
    'wip-helmet-xover': 380000,                        // X-OVER Helmet · xlsx canonical = ₩380K (이미 ₩10K, USD $179.99, 4 SKU 동일가) [Danny lock 2026-05-17]
    'wip-impact-vest': 320000,    // FLOW NEO VEST 50N · 사이트 표시 ₩10K rounded (xlsx canonical ₩318K, USD $144.99, 11 SKU 동일가) [Danny lock 2026-05-17]
    'wip-kompact-vest': 360000,   // KOMPACT VEST 50N 2.0 · 사이트 표시 ₩10K rounded (xlsx canonical ₩362K, USD $169.99, 5 SKU 동일가) [Danny lock 2026-05-17]
    'wip-harness': 580000,        // WAISTFOIL HARNESS 3.0 · 사이트 표시 ₩10K rounded (xlsx canonical ₩576K, USD $289.99, 2 SKU 동일가) [Danny lock 2026-05-17]
    'wip-wetsuit-32': { _est: true, _krw: 450000 },     // SUMMER NEO LONG JOHN MK2 (3/2 proxy) · 사이트 표시 ₩10K rounded (xlsx canonical ₩451K, USD $219.99, 8 SKU) [Danny lock 2026-05-17]
    'wip-wetsuit-43': { _est: true, _krw: 520000 }      // NEO LONG JOHN MK2 (4/3 proxy) · 사이트 표시 ₩10K rounded (xlsx canonical ₩523K, USD $259.99, 8 SKU) [Danny lock 2026-05-17]
  };

  // Weight class → mid-kg for board size matching.
  // SoT: equipment_matrix.json weight_range field (light=50-65, mid-light=65-75, mid-heavy=75-85, heavy=85+).
  const WEIGHT_TO_KG_MID = {
    'light': 57,
    'mid-light': 70,
    'mid-heavy': 80,
    'heavy': 95
  };

  // ---- Pricing & spec helpers ----
  // §154 v2 (Danny 2026-05-12) — "가격 확인 중" placeholder UI 노출 영구 금지.
  // §154-B (Danny 2026-05-12) — tilde "~" 가격 접두어 영구 금지. 정확 = ₩, 추정 = ≈ ₩.
  // §164 (Danny 2026-05-12) — find-my-gear 결과 카드 eyebrow nowrap.
  function formatKRW(n) {
    if (typeof n !== 'number' || !isFinite(n)) {
      // §154 v2 — placeholder 영구 금지. price null = developer error, but UI fallback = 카톡 안내 link 텍스트 (action-oriented).
      console.error('[DMJMatrix] formatKRW called with non-numeric value:', n);
      return '가격 안내 받기';
    }
    return '₩' + n.toLocaleString('ko-KR');
  }

  // §154 v2 — Multi-key lookup. products.json size keys vary by brand:
  //   PPC wings:  "5.5m"  (with m suffix)         — Sonic FDS / M1 / M1-X / M2 / M1-R SDS
  //   Takoon V4:  "5.0"   (no m, with .0 trailing) — Wing V4
  //   Foil sets:  numeric strings (no suffix)
  //   Boards:     "5'10\"" or "63L"
  // pickWingSize returns Number (e.g. 5.5, 5.0). Try every reasonable key format
  // so no recommendable SKU returns null.
  function getProductPrice(id, size) {
    if (!id) return null;
    const p = findProduct(id);
    if (p && p.size_pricing_KRW && size != null) {
      const dict = p.size_pricing_KRW;
      const raw = String(size).replace(/"$/, '');
      // Build candidate keys covering all brand conventions
      const keys = new Set([raw, String(size)]);
      // Numeric size variants — handle "5", "5.0", "5m", "5.0m", "5m²", "5.0m²"
      if (/^\d+(\.\d+)?$/.test(raw)) {
        const numStr = raw;
        const withDecimal = raw.indexOf('.') === -1 ? raw + '.0' : raw;
        const withoutTrailingZero = raw.replace(/\.0$/, '');
        keys.add(numStr);
        keys.add(withDecimal);
        keys.add(withoutTrailingZero);
        keys.add(numStr + 'm');
        keys.add(withDecimal + 'm');
        keys.add(withoutTrailingZero + 'm');
        keys.add(numStr + 'm²');
        keys.add(withDecimal + 'm²');
        keys.add(withoutTrailingZero + 'm²');
      }
      for (const k of keys) {
        if (dict[k] != null) return dict[k];
      }
      // DO_NOT_REVERT §154 v3 — Danny 2026-05-12: 보드 사이즈 (`5'0"`, `6'4"` 등)는 가장 가까운 등록된 사이즈로 fallback.
      // BOARD_SPECS 사이즈가 products.json size_pricing_KRW 에 누락된 경우에도 "가격 안내 받기" placeholder 회귀 방지.
      // 1 in = 1 unit. 거리 동률이면 큰 사이즈가 우선 (안전한 인상).
      const targetIn = boardSizeToInches(raw);
      if (targetIn != null) {
        let nearestKey = null;
        let nearestDist = Infinity;
        for (const k of Object.keys(dict)) {
          const kIn = boardSizeToInches(k);
          if (kIn == null) continue;
          const d = Math.abs(kIn - targetIn);
          if (d < nearestDist || (d === nearestDist && kIn > boardSizeToInches(nearestKey))) {
            nearestDist = d;
            nearestKey = k;
          }
        }
        if (nearestKey != null) {
          console.warn('[DMJMatrix] size_pricing_KRW nearest-fallback', { id: id, requested: size, used: nearestKey, distance_in: nearestDist });
          return dict[nearestKey];
        }
      }
      // §154 v2 — log miss so developer catches missing key (non-fatal, falls through to PRICE_OVERRIDES)
      console.warn('[DMJMatrix] size_pricing_KRW miss', { id: id, size: size, tried: Array.from(keys), available: Object.keys(dict) });
    }
    if (p && p.price_KRW != null) return p.price_KRW;
    // Fallback: PRICE_OVERRIDES
    const ov = PRICE_OVERRIDES[id];
    if (ov == null) {
      console.error('[DMJMatrix] price lookup failed (no PRICE_OVERRIDES)', { id: id, size: size });
      return null;
    }
    if (typeof ov === 'number') return ov;
    if (size != null && ov[String(size)] != null) return ov[String(size)];
    if (ov._krw != null) return ov._krw; // ranged estimate
    return null;
  }

  function isPriceEstimate(id) {
    const ov = PRICE_OVERRIDES[id];
    return !!(ov && typeof ov === 'object' && ov._est);
  }

  function getDetailUrl(id, size) {
    const url = DETAIL_URLS[id];
    if (!url) {
      // Legacy fallback to products.json page_url (brand-page anchor).
      const p = findProduct(id);
      return (p && p.page_url) ? (ASSETS_BASE + p.page_url) : '#';
    }
    const fullUrl = ASSETS_BASE + url;
    if (size == null || url.includes('#')) return fullUrl;
    const anchor = sizeAnchor(size);
    return anchor ? `${fullUrl}#size-${anchor}` : fullUrl;
  }

  // DO_NOT_REVERT §154 v3 — Danny 2026-05-12: 보드 사이즈 → 인치 (nearest-size fallback 용).
  // "5'10\"" → 70, "6'4" → 76, "5'0\"" → 60. apostrophe variants 모두 지원. null = 보드 사이즈 아님.
  function boardSizeToInches(s) {
    if (s == null) return null;
    const m = String(s).match(/^(\d+)['′](\d+)(?:["″]?)$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
  }

  // Convert size value to anchor slug. "5'10\"" → "5-10", 4.5 → "4-5", "63L" → "63l".
  function sizeAnchor(size) {
    if (size == null) return '';
    const s = String(size);
    // wing: numeric (e.g. 4.5)
    if (/^\d+(\.\d+)?$/.test(s)) return s.replace('.', '-');
    // board: 5'10" or 5'10
    const m = s.match(/^(\d+)['′](\d+)/);
    if (m) return `${m[1]}-${m[2]}`;
    // single-size board (Levitaz Boom FS): "63L" → "63l"
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Pick the largest wing size as primary (light wind = larger size more common in normal use).
  function pickWingSize(sizes_m2) {
    if (!sizes_m2 || !sizes_m2.length) return null;
    return Math.max.apply(null, sizes_m2);
  }

  // Match board size to user weight class. Returns size key from BOARD_SPECS.
  function pickBoardSize(boardId, weightClass) {
    const specs = BOARD_SPECS[boardId];
    if (!specs) return null;
    const sizes = Object.keys(specs);
    if (sizes.length === 1) return sizes[0]; // single-size board (Levitaz Boom FS)
    const userKg = WEIGHT_TO_KG_MID[weightClass] || 70;
    let best = sizes[0];
    let bestDist = Infinity;
    for (let i = 0; i < sizes.length; i++) {
      const sz = sizes[i];
      const recStr = specs[sz].recommended_kg;
      if (!recStr) continue;
      const m = recStr.match(/(\d+)[–-](\d+)/);
      if (!m) continue;
      const recMid = (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2;
      const dist = Math.abs(recMid - userKg);
      if (dist < bestDist) {
        bestDist = dist;
        best = sz;
      }
    }
    return best;
  }

  // Format size label for display per category.
  function formatSizeLabel(id, size) {
    if (size == null) return '';
    const p = findProduct(id);
    if (!p) return String(size);
    if (p.sizes_m2) return `${size}m²`;
    if (p.sizes_ft) return String(size); // already e.g. 5'10"
    return String(size);
  }

  // Render one item row: <a href="..."><name+size> · <spec> · <price></a>
  function renderItem(id, opts) {
    opts = opts || {};
    const p = findProduct(id);
    if (!p) {
      return `<span class="mtx-item mtx-item--missing">${id} <span class="mtx-item__price mtx-item__price--tbd">정보 누락</span></span>`;
    }
    const url = getDetailUrl(id, opts.size);
    const price = getProductPrice(id, opts.size);
    const isEst = isPriceEstimate(id);
    const priceCls = price == null ? 'mtx-item__price mtx-item__price--tbd' : (isEst ? 'mtx-item__price mtx-item__price--est' : 'mtx-item__price');
    // §154-B (Danny 2026-05-12) — tilde "~" 접두어 영구 금지. 추정치 = "≈ ₩" (U+2248), 정확 = "₩".
    // §154 v2 — price null fallback = action-oriented 카톡 안내 (placeholder "가격 확인 중" 영구 금지).
    const priceTxt = price == null ? '가격 안내 받기' : (isEst ? `≈ ${formatKRW(price)}` : formatKRW(price));
    const sizeLabel = opts.size != null ? formatSizeLabel(id, opts.size) : '';

    let specHtml = '';
    if (opts.showBoardSpec && opts.size != null && BOARD_SPECS[id] && BOARD_SPECS[id][String(opts.size)]) {
      const s = BOARD_SPECS[id][String(opts.size)];
      const parts = [];
      if (s.volume_l != null) parts.push(`${s.volume_l} L`);
      const dims = [];
      if (s.length_cm != null) dims.push(`${s.length_cm}`);
      if (s.width_cm != null) dims.push(`${s.width_cm}`);
      if (dims.length === 2) parts.push(`${dims.join('×')} cm`);
      else if (s.length_cm != null) parts.push(`${s.length_cm} cm`);
      else if (s.width_cm != null) parts.push(`너비 ${s.width_cm} cm`);
      if (s.weight_kg != null) parts.push(`${s.weight_kg} kg`);
      if (s.recommended_kg) parts.push(`권장 ${s.recommended_kg}kg`);
      // DO_NOT_REVERT §154 v3 — Danny 2026-05-12: "치수 확인 중" / "스펙 확인 중" / "사양 미정" 등
      // spec placeholder 영구 금지. dims 데이터 null 이면 그냥 dims 부분만 생략. §112 의 명시 fallback 폐기.
      if (parts.length) specHtml = `<span class="mtx-item__spec">${parts.join(' · ')}</span>`;
    }

    const sizeHtml = sizeLabel ? `<span class="mtx-item__size">${sizeLabel}</span>` : '';
    // DO_NOT_REVERT §171-B + §171-A — Danny 2026-05-13: "+ 장바구니" 버튼 추가 + 상태(state) 인식 toggle.
    // window.DMJCart 미로드 시 (예: matrix.js 단독 페이지)에는 addBtn 자체 생략 — graceful fallback.
    // 상태 기준: 같은 sku+size 가 이미 cart 에 있으면 "✓ 담김" + data-cart-state="in"로 render. 클릭 = toggle (remove).
    let addBtn = '';
    if (typeof window !== 'undefined' && window.DMJCart) {
      const sizeStr = opts.size != null ? String(opts.size) : '';
      let inCart = false;
      try {
        const items = window.DMJCart.getItems();
        inCart = items.some(function (it) {
          return it && it.sku === id && (it.size || '') === sizeStr;
        });
      } catch (e) { inCart = false; }
      const stateAttr = inCart ? 'in' : 'out';
      const cls = inCart ? 'mtx-item__addcart mtx-item__addcart--in' : 'mtx-item__addcart';
      const label = inCart ? '✓ 담김' : '+ 장바구니';
      const aria = inCart ? '장바구니에서 빼기' : '장바구니에 담기';
      addBtn = `<button type="button" class="${cls}" data-cart-add data-cart-state="${stateAttr}" data-sku="${id}" data-size="${sizeStr}" aria-label="${aria}">${label}</button>`;
    }
    return `<span class="mtx-item-wrap">
      <a href="${url}" class="mtx-item">
        <span class="mtx-item__name">${p.brand} <strong>${p.model}</strong>${sizeHtml ? ' ' + sizeHtml : ''}</span>
        ${specHtml}
        <span class="${priceCls}">${priceTxt}</span>
      </a>${addBtn}
    </span>`;
  }

  function productLink(id) {
    const p = findProduct(id);
    if (!p) return '#';
    if (DETAIL_URLS[id]) return ASSETS_BASE + DETAIL_URLS[id];
    if (p.page_url) return ASSETS_BASE + p.page_url;
    return '#';
  }

  function productName(id) {
    const p = findProduct(id);
    if (!p) return id;
    return `${p.brand} ${p.model}`;
  }

  function productLine(id) {
    const p = findProduct(id);
    if (!p) return id;
    return `<a href="${productLink(id)}" class="mtx-prod">${p.brand} <strong>${p.model}</strong></a>`;
  }

  // Board schema — supports legacy string OR new object {primary, secondary, secondary_note}
  // (Danny 2026-05-07 — ADVANCED Speed/Hybrid 1차/2차 패턴, DO_NOT_REVERT §73)
  function normalizeBoard(b) {
    if (!b) return { primary: null, secondary: null, secondary_note: null };
    if (typeof b === 'string') return { primary: b, secondary: null, secondary_note: null };
    return {
      primary: b.primary || null,
      secondary: b.secondary || null,
      secondary_note: b.secondary_note || null
    };
  }

  function renderBoardRow(entry) {
    const b = normalizeBoard(entry.board);
    if (!b.primary) return '';
    const primaryHtml = `<span class="mtx-board-primary">${productLine(b.primary)}</span>`;
    if (!b.secondary) return primaryHtml;
    const note = b.secondary_note || '가격 부담 시';
    return `
      <span class="mtx-board-tier mtx-board-tier--primary"><span class="mtx-board-tier__label">1차</span>${primaryHtml}</span>
      <span class="mtx-board-tier mtx-board-tier--secondary"><span class="mtx-board-tier__label">2차 · ${note}</span><span class="mtx-board-secondary">${productLine(b.secondary)}</span></span>
    `;
  }

  // §171 v11-B (Danny 2026-05-16) — 포일 추천 세트/옵션/컴포넌트 3-mode 해석.
  //   exact      : 세트 SKU + 추천 컴포넌트가 정확히 일치 → 세트 1개로 표시 (R6 8 entry · FS790+Mast96 등)
  //   options    : 세트 SKU 추천이지만 matrix 추천 마스트가 세트 구성과 다름 → "세트 구매" vs "개별 구성" 선택지 제시
  //                (Danny 2026-05-16: 하나로 강제 X — 가격·구성 차이를 보여주고 소비자가 선택)
  //   components : 세트 매핑 없음 → 기존 FW+Mast+Stab 컴포넌트 표시
  //   front_wing 슬롯 자체가 foil-set 타입(Takoon Starter/X-Glide V2/Carbon assembly)이면 exact (세트 1개, 잡음 mast/stab 무시).
  // DO_NOT_REVERT §171 v11 / v11-B — 포일 컴포넌트 3개 개별가 합산 단독 표시 영구 X. 세트 가능하면 세트(exact) 또는 옵션(options).
  function resolveFoilSet(foil) {
    if (!foil) return { mode: 'components', components: [] };
    var comps = [foil.front_wing, foil.mast, foil.stab].filter(Boolean);
    // Case 1 — front_wing 슬롯이 이미 foil-set SKU (Takoon monolithic 세트)
    var fwP = foil.front_wing ? findProduct(foil.front_wing) : null;
    if (fwP && fwP.type === 'foil-set') {
      return { mode: 'exact', setId: foil.front_wing, components: comps };
    }
    // Case 2 — 명시적 set_id
    var setId = foil.set_id || null;
    if (setId) {
      var setP = findProduct(setId);
      if (setP) {
        var bundle = Array.isArray(setP.bundle_includes) ? setP.bundle_includes : null;
        if (bundle && bundle.length) {
          var sortedBundle = bundle.slice().sort().join('|');
          var sortedComps = comps.slice().sort().join('|');
          if (sortedBundle === sortedComps) {
            return { mode: 'exact', setId: setId, components: comps };
          }
          return { mode: 'options', setId: setId, components: comps, setBundle: bundle };
        }
        // bundle_includes 없는 monolithic 세트 SKU → exact
        return { mode: 'exact', setId: setId, components: comps };
      }
      // set_id 가 유효 SKU 아님 → graceful fallback to components
    }
    return { mode: 'components', components: comps };
  }

  // v1.6 — renderEntryCard now includes per-item prices, board specs, detail-page deep links,
  //        and a 합계 summary row (Danny 명시 2026-05-09, DO_NOT_REVERT §112).
  function renderEntryCard(entry, demographic) {
    const sizes_m2 = entry.wing.sizes_m2 || [];
    const wingSize = pickWingSize(sizes_m2);
    const wingPrimary = entry.wing.primary;
    const wingAlt = entry.wing.alternative;

    const foilFW = entry.foil.front_wing;
    const foilMast = entry.foil.mast;
    const foilStab = entry.foil.stab;
    const foilAlt = entry.foil.alternative || null;
    // §171 v11-B (Danny 2026-05-16) — 포일 세트/옵션/컴포넌트 모드 해석.
    const foilRes = resolveFoilSet(entry.foil);

    const board = normalizeBoard(entry.board);
    const boardSize = board.primary ? pickBoardSize(board.primary, entry.weight) : null;
    const boardSize2 = board.secondary ? pickBoardSize(board.secondary, entry.weight) : null;

    const accs = entry.accessories || [];

    // Wing row — primary + alternative (each at wingSize), all sizes shown as pills below.
    const wingItems = [];
    if (wingPrimary) wingItems.push(renderItem(wingPrimary, { size: wingSize }));
    if (wingAlt) wingItems.push(renderItem(wingAlt, { size: wingSize }));
    const sizesPills = sizes_m2.map(s => `<span class="mtx-size-pill">${s}m²</span>`).join('');

    // Foil row — §171 v11-B: exact=세트1개 / options=세트vs개별 선택지 / components=컴포넌트.
    let foilHtml = '';
    if (foilRes.mode === 'exact') {
      foilHtml =
        '<div class="mtx-row__items">' + renderItem(foilRes.setId) + '</div>' +
        '<p class="mtx-row__set-note">프론트 윙 + 마스트 + 스탭(또는 리어윙) 한 세트 — <b>세트 가격</b> (개별 합산 대비 할인 적용)</p>';
    } else if (foilRes.mode === 'options') {
      const setPrice = getProductPrice(foilRes.setId);
      let partsSum = 0, partsMissing = 0;
      [foilFW, foilMast, foilStab].forEach(function (id) {
        if (!id) return;
        const v = getProductPrice(id);
        if (typeof v === 'number') partsSum += v; else partsMissing++;
      });
      const setPriceTxt = typeof setPrice === 'number' ? formatKRW(setPrice) : '가격 안내';
      const partsSumTxt = partsMissing > 0 ? (formatKRW(partsSum) + ' + 안내 ' + partsMissing + '개') : formatKRW(partsSum);
      const setBundleNote = (foilRes.setBundle || []).map(productName).join(' + ');
      const partsNote = [foilFW, foilMast, foilStab].filter(Boolean).map(productName).join(' + ');
      // §186 (알렉스 2026-06-04) — 좌우 2칼럼 → 세로 1칼럼 스택, "개별 구성" 카드를 위에 / "세트 구매" 카드를 아래에 (DOM 순서 변경. 가격·구성·cart 로직 불변).
      foilHtml =
        '<p class="mtx-foil-options__lead">세트로 사면 할인, 개별로 사면 추천 마스트 — 가격·구성을 비교하고 고르세요.</p>' +
        '<div class="mtx-foil-options">' +
          '<div class="mtx-foil-opt mtx-foil-opt--parts">' +
            '<div class="mtx-foil-opt__head"><span class="mtx-foil-opt__tag mtx-foil-opt__tag--alt">개별 구성</span><span class="mtx-foil-opt__price">' + partsSumTxt + '</span></div>' +
            '<div class="mtx-row__items">' + [foilFW, foilMast, foilStab].filter(Boolean).map(function (id) { return renderItem(id); }).join('') + '</div>' +
            '<p class="mtx-foil-opt__note">맞춤 추천: ' + partsNote + ' — 컴포넌트 개별 구매</p>' +
          '</div>' +
          '<div class="mtx-foil-opt mtx-foil-opt--set">' +
            '<div class="mtx-foil-opt__head"><span class="mtx-foil-opt__tag">세트 구매</span><span class="mtx-foil-opt__price">' + setPriceTxt + '</span></div>' +
            '<div class="mtx-row__items">' + renderItem(foilRes.setId) + '</div>' +
            '<p class="mtx-foil-opt__note">구성: ' + setBundleNote + ' — 한 세트, 개별 합산 대비 할인</p>' +
          '</div>' +
        '</div>';
    } else {
      foilHtml = '<div class="mtx-row__items">' +
        [foilFW, foilMast, foilStab].filter(Boolean).map(function (id) { return renderItem(id); }).join('') +
        '</div>';
    }
    let foilAltHtml = '';
    if (foilAlt && (foilAlt.front_wing || foilAlt.mast)) {
      const altParts = [];
      if (foilAlt.front_wing) altParts.push(renderItem(foilAlt.front_wing));
      if (foilAlt.mast) altParts.push(renderItem(foilAlt.mast));
      if (foilAlt.stab) altParts.push(renderItem(foilAlt.stab));
      foilAltHtml = `<div class="mtx-row__alt"><span class="mtx-row__alt-label">또는</span><div class="mtx-row__items">${altParts.join('')}</div></div>`;
    }

    // Board row — primary at boardSize (with full spec), optional secondary tier.
    const boardItems = [];
    if (board.primary) {
      boardItems.push(`<div class="mtx-board-tier mtx-board-tier--primary">
        <span class="mtx-board-tier__label">1차</span>
        ${renderItem(board.primary, { size: boardSize, showBoardSpec: true })}
      </div>`);
    }
    if (board.secondary) {
      const note = board.secondary_note || '가격 부담 시';
      boardItems.push(`<div class="mtx-board-tier mtx-board-tier--secondary">
        <span class="mtx-board-tier__label">2차 · ${note}</span>
        ${renderItem(board.secondary, { size: boardSize2, showBoardSpec: true })}
      </div>`);
    }

    // Accessory row — list with prices.
    const accItems = accs.map(id => renderItem(id)).join('');

    // §171 v5 (Danny 2026-05-13) — 합계 = 담긴 SKU만. SKU list 를 카드에 attach + cart-intersect 계산.
    // 추천 전체 SUM 회귀 영구 X. DO_NOT_REVERT §171 v5.
    let total = 0;
    let missing = 0;
    let hasEstimate = false;
    const cardSkus = []; // {sku, size, price} of each recommended SKU for this card
    function addCost(id, size) {
      if (!id) return;
      const v = getProductPrice(id, size);
      if (typeof v === 'number') {
        total += v;
        if (isPriceEstimate(id)) hasEstimate = true;
        cardSkus.push({ sku: id, size: size != null ? String(size) : '', price: v });
      } else {
        missing++;
        cardSkus.push({ sku: id, size: size != null ? String(size) : '', price: null });
      }
    }
    // Wing — prefer primary, fallback to alt if primary has no price
    const wingPrimaryPrice = getProductPrice(wingPrimary, wingSize);
    if (wingPrimaryPrice != null) addCost(wingPrimary, wingSize);
    else if (wingAlt) addCost(wingAlt, wingSize);
    else missing++;
    // §171 v11-B — exact/monolithic: 세트 SKU 1개. options: 대표 total 은 세트 기준 +
    //   개별 컴포넌트도 cardSkus 에 등록 (cart-intersect 가 사용자 실제 선택을 반영). components: 컴포넌트 3개.
    if (foilRes.mode === 'exact') {
      addCost(foilRes.setId);
    } else if (foilRes.mode === 'options') {
      addCost(foilRes.setId); // 대표 total = 세트 기준 (중복 가산 방지)
      [foilFW, foilMast, foilStab].forEach(function (id) {
        if (!id) return;
        const v = getProductPrice(id);
        cardSkus.push({ sku: id, size: '', price: typeof v === 'number' ? v : null });
      });
    } else {
      addCost(foilFW); addCost(foilMast); addCost(foilStab);
    }
    addCost(board.primary, boardSize);
    accs.forEach(id => addCost(id));

    const totalNote = missing > 0
      ? `<span class="mtx-summary__note">+ 가격 안내 ${missing}개 항목</span>`  // §154 v2 — placeholder "가격 확인 중" 영구 금지
      : (hasEstimate ? `<span class="mtx-summary__note">≈ 추정치 포함</span>` : '');  // §154-B — "~" 접두어 영구 금지

    // Encode card SKU list for cart-intersect sum recalculation.
    const cardSkusJson = encodeURIComponent(JSON.stringify(cardSkus));

    // Tags
    const tags = (entry.tags || []).map(t => {
      const cls = t.startsWith('주의') ? 'mtx-tag mtx-tag--warn' : (t.includes('Danny review') ? 'mtx-tag mtx-tag--review' : 'mtx-tag');
      return `<span class="${cls}">${t}</span>`;
    }).join('');

    const demoBanner = entry._demographic_label
      ? `<div class="mtx-demo-banner">📐 ${entry._demographic_label} 보정 적용 — ${entry._demographic_note || ''}</div>`
      : '';

    return `
      <article class="mtx-card" data-level="${entry.level}" data-weight="${entry.weight}" data-style="${entry.style}">
        <header class="mtx-card__head">
          <span class="mtx-card__weight">${weightLabelFor(entry.weight, demographic)}</span>
          <span class="mtx-card__style">${STYLE_LABELS[entry.style]}</span>
        </header>

        <div class="wind-baseline-strip">${WIND_BASELINE.pill_html}</div>

        ${demoBanner}

        <div class="mtx-card__body">
          <div class="mtx-row mtx-row--wing">
            <span class="mtx-row__label">Wing</span>
            <div class="mtx-row__val">
              <div class="mtx-row__items">${wingItems.join('')}</div>
              <div class="mtx-sizes">${sizesPills}</div>
              ${WIND_BASELINE.note_html}
            </div>
          </div>

          <div class="mtx-row mtx-row--foil">
            <span class="mtx-row__label">Foil</span>
            <div class="mtx-row__val">
              ${foilHtml}
              ${foilAltHtml}
            </div>
          </div>

          <div class="mtx-row mtx-row--board">
            <span class="mtx-row__label">Board</span>
            <div class="mtx-row__val mtx-row__val--board">${boardItems.join('')}</div>
          </div>

          <div class="mtx-row mtx-row--accessory">
            <span class="mtx-row__label">Accessory</span>
            <div class="mtx-row__val">
              <div class="mtx-row__items mtx-row__items--accessory">${accItems}</div>
            </div>
          </div>

          <div class="mtx-summary" data-mtx-skus="${cardSkusJson}" data-mtx-fulltotal="${total}">
            <span class="mtx-summary__label">내가 담은 합계</span>
            <span class="mtx-summary__total">₩0</span>
            <span class="mtx-summary__note mtx-summary__cart-hint">장바구니에 담아 주세요</span>
          </div>
        </div>

        <p class="mtx-reasoning">${entry.reasoning}</p>

        ${tags ? `<div class="mtx-tags">${tags}</div>` : ''}
      </article>
    `;
  }

  // Render 16 entries filtered by level (4 weights × 4 styles)
  function renderLevelGrid(level, container) {
    const entries = entriesByLevel(level);
    // Group by weight
    const weights = ['light', 'mid-light', 'mid-heavy', 'heavy'];
    const styles = ['flat-speed', 'choppy-freeride', 'wave', 'hybrid'];

    let html = '';
    weights.forEach(w => {
      html += `
        <div class="mtx-weight-group">
          <h3 class="mtx-weight-head">
            <span class="mtx-weight-head__num">${WEIGHT_LABELS[w]}</span>
            <span class="mtx-weight-head__sub">체중 ${WEIGHT_RANGE[w]} 라이더</span>
          </h3>
          <div class="mtx-weight-grid">
            ${styles.map(s => {
              const e = lookupEntry(level, w, s);
              return e ? renderEntryCard(e) : '';
            }).join('')}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // Render 16 entries filtered by style (4 weights × 4 levels)
  // §155 v3 — 'novice' tier 큐레이션 데이터 미준비 (no novice-specific products mapped yet) → 4-level lookup 유지.
  // novice → beginner fallback (recommendation set 동일) in quiz path.
  function renderStyleGrid(style, container) {
    const weights = ['light', 'mid-light', 'mid-heavy', 'heavy'];
    const levels = ['beginner', 'intermediate', 'advanced', 'pro'];

    let html = '';
    levels.forEach(l => {
      html += `
        <div class="mtx-weight-group">
          <h3 class="mtx-weight-head">
            <span class="mtx-weight-head__num">${LEVEL_LABELS[l]}</span>
            <span class="mtx-weight-head__sub">${l === 'beginner' ? '입문 단계' : l === 'intermediate' ? '중급 단계' : l === 'advanced' ? '상급 단계' : '선수 레벨'}</span>
          </h3>
          <div class="mtx-weight-grid">
            ${weights.map(w => {
              const e = lookupEntry(l, w, style);
              return e ? renderEntryCard(e) : '';
            }).join('')}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // Render the special "child no_direct_sale" path
  function renderChildPath(container) {
    container.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-result__head">
          <span class="quiz-result__eyebrow" style="background:rgba(255,184,0,0.18);color:var(--color-sun)">Child · 8-12세 · 직접 sales 차단</span>
          <h2 class="quiz-result__title">어린이 라이딩은 1:1 컨설팅으로 시작합니다</h2>
        </div>
        <article class="mtx-card" style="background:linear-gradient(135deg, rgba(31,143,255,0.08), rgba(255,184,0,0.04));border-color:var(--color-sea)">
          <div style="padding:8px 0">
            <p style="font-size:1.0625rem;line-height:1.7;color:var(--color-navy);margin:0 0 16px">
              <strong>단무지는 12세 미만 라이더에게 직접 장비 sales를 진행하지 않습니다.</strong>
              자녀의 신체조건·체력·이전 워터스포츠 경험이 progression 페이스를 좌우하기 때문입니다.
            </p>
            <p style="line-height:1.65;color:var(--color-slate);margin:0 0 16px">
              부모님 1:1 컨설팅을 통해 아래 항목을 함께 검토합니다:
            </p>
            <ul style="line-height:1.8;color:var(--color-slate);padding-left:20px;margin:0 0 16px">
              <li>체중·신장 기반 wing·boards 적정 사이즈 산출</li>
              <li>강습 partnership (인솔자 동반 필수)</li>
              <li>안전 장비 (WIP Junior impact vest·helmet·웻슈트)</li>
              <li>1년 progression 로드맵 — 시즌 단위 가족 일정</li>
            </ul>
            <p style="line-height:1.65;color:var(--color-charcoal);margin:0;font-size:0.9375rem">
              안전과 즐거움이 동시에 가능한 어린이 라이딩의 시작 — 단무지가 함께 설계합니다.
            </p>
          </div>
        </article>
        <div class="quiz-result__cta">
          <a href="${ASSETS_BASE}consult.html" class="btn btn--accent btn--lg">1:1 구매 상담하기</a>
          <a href="${ASSETS_BASE}junior/" class="btn btn--ghost btn--lg">유소년·어린이 가이드 보기</a>
        </div>
      </div>
    `;
  }

  // Quiz funnel result — supports demographic adjustment + messaging
  function renderQuizResult(level, weight, style, container, opts) {
    opts = opts || {};
    const demographic = opts.demographic;

    // Special handling: child = no direct sale path
    if (demographic === 'child') {
      renderChildPath(container);
      return;
    }

    // If no level picked yet but demographic is set, fallback gracefully
    if (!level || !weight || !style) {
      container.innerHTML = '<p style="color:#fff;text-align:center;padding:48px">필수 정보가 누락되었습니다. 처음부터 다시 시도해주세요.</p>';
      return;
    }

    // Apply demographic-driven default weight if user didn't pick (defensive)
    const adj = demographic ? getDemographic(demographic) : null;
    const effectiveWeight = (weight || (adj && adj.default_weight) || 'mid-light');

    // §155 v3 — 'novice' (초급) data not yet curated → map to beginner recommendation set.
    //   When novice-specific lookup data is added later, this fallback line can be removed.
    const effectiveLevel = (level === 'novice') ? 'beginner' : level;

    let e = lookupEntry(effectiveLevel, effectiveWeight, style);
    if (!e) {
      container.innerHTML = '<p style="color:#fff;text-align:center;padding:48px">해당 조합에 대한 추천을 찾을 수 없습니다.<br><br>문의: <a href="mailto:consulting@dmjgroup.kr" style="color:#FFB800;text-decoration:underline">consulting@dmjgroup.kr</a></p>';
      return;
    }

    // Apply demographic adjustment
    if (demographic) e = applyDemographicAdjustment(e, demographic);

    const msg = demographic ? getDemographicMsg(demographic) : null;
    const headline = msg ? msg.headline : '당신을 위한 큐레이션';
    const subline = msg ? msg.subline : '';
    const warning = msg && msg.warning ? `<div class="mtx-warning" style="margin:16px 0;padding:14px 18px;background:rgba(255,184,0,0.12);border-left:3px solid var(--color-sun);border-radius:6px;color:var(--color-charcoal);font-size:0.9375rem;line-height:1.5">⚠️ ${msg.warning}</div>` : '';

    const demoLabel = demographic ? DEMO_LABELS[demographic] : '';
    const titleParts = [
      demoLabel,
      LEVEL_LABELS[level],
      weightLabelFor(effectiveWeight, demographic),
      STYLE_LABELS[style]
    ].filter(Boolean).join(' · ');

    // Demographic-specific landing page link
    const demoLandingLink = demographic === 'adult_female' ? `${ASSETS_BASE}women/`
      : demographic === 'youth' ? `${ASSETS_BASE}junior/`
      : null;

    const demoLandingBtn = demoLandingLink
      ? `<a href="${demoLandingLink}" class="btn btn--ghost btn--lg">${demoLabel} 가이드 보기</a>`
      : `<a href="${ASSETS_BASE}level/${level}.html" class="btn btn--ghost btn--lg">${LEVEL_LABELS[level]} 가이드 보기</a>`;

    // Modular cross-platform note for advanced/pro riders (Levitaz Free Series ↔ R6 mast 호환)
    const modularNote = (level === 'advanced' || level === 'pro')
      ? `
        <aside class="quiz-result__modular" style="margin:24px 0 0;padding:18px 22px;background:rgba(31,143,255,0.10);border-left:3px solid var(--color-sea, #1F8FFF);border-radius:8px;color:#fff;line-height:1.65;font-size:0.9375rem">
          <strong style="display:block;font-size:0.8125rem;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.85);margin-bottom:6px">Modular option · Levitaz</strong>
          R6 마스트 + Free Series wing cross-platform 셋업도 검토할 수 있습니다. 같은 mast로 freeride·race 양면 활용.
          <a href="${ASSETS_BASE}levitaz.html#modular-usp" style="color:var(--color-sun, #FFB800);font-weight:600;text-decoration:underline;margin-left:6px">Levitaz 모듈러 옵션 검토 →</a>
        </aside>`
      : '';

    container.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-result__head">
          <span class="quiz-result__eyebrow">${headline}</span>
          <h2 class="quiz-result__title">${titleParts}</h2>
          ${subline ? `<p class="quiz-result__sub" style="color:rgba(255,255,255,0.88);margin:8px 0 0;font-size:1rem;line-height:1.5">${subline}</p>` : ''}
        </div>
        ${warning}
        ${renderEntryCard(e, demographic)}
        ${modularNote}
        <div class="quiz-result__cta">
          <a href="${ASSETS_BASE}consult.html" class="btn btn--accent btn--lg">1:1 구매 상담하기</a>
          ${demoLandingBtn}
        </div>
      </div>
    `;

    // §171 v2 (Danny 2026-05-13) — expose resolved result for host pages
    // (find-my-gear.html consumes this to save fmg_history + render CTA + auto-fill consult.html).
    try {
      var resolved = resolveQuizResultData(e, { level: level, weight: effectiveWeight, style: style, demographic: demographic });
      window.DMJMatrix._lastQuizResult = resolved;
      var ev = new CustomEvent('dmj:fmg:result', { detail: resolved });
      document.dispatchEvent(ev);
    } catch (err) {
      console.warn('[DMJMatrix] expose result failed:', err);
    }
    // §171 v5 — initial cart-intersect summary calc (cart 이벤트 X 일 때도)
    try { recalcCartSummaries(); } catch (err) { /* swallow */ }
  }

  // §171 v2 — Build a serializable summary of a quiz entry: SKUs + prices + total.
  // Used for fmg_history (profile §F) + cart auto-add (quote.html) + consult.html auto-attach.
  function resolveQuizResultData(entry, ctx) {
    ctx = ctx || {};
    if (!entry) return null;
    var sizes_m2 = entry.wing.sizes_m2 || [];
    var wingSize = pickWingSize(sizes_m2);
    var wingPrimary = entry.wing.primary;
    var wingAlt = entry.wing.alternative;
    var foilFW = entry.foil.front_wing;
    var foilMast = entry.foil.mast;
    var foilStab = entry.foil.stab;
    // §171 v11-B — 포일 세트 해석. exact/options → 세트 SKU 1개를 기본 추천으로 기록
    //   (options 는 결과 카드에서 사용자가 개별 구성도 선택 가능 — 여기서는 세트가 기본). components → 컴포넌트.
    var foilRes = resolveFoilSet(entry.foil);
    var board = normalizeBoard(entry.board);
    var boardSize = board.primary ? pickBoardSize(board.primary, entry.weight) : null;
    var accs = entry.accessories || [];

    var recs = [];
    var total = 0;
    function pushItem(id, size) {
      if (!id) return;
      var p = findProduct(id);
      var price = getProductPrice(id, size);
      if (typeof price === 'number') total += price;
      recs.push({
        sku: id,
        brand: p ? (p.brand || '') : '',
        model: p ? (p.model || '') : '',
        size: size != null ? String(size) : null,
        price_KRW: typeof price === 'number' ? price : null
      });
    }

    // Wing — primary preferred. If primary has no price, fallback to alt for total only,
    // but still record primary as the recommendation.
    pushItem(wingPrimary, wingSize);
    var wingPrice = getProductPrice(wingPrimary, wingSize);
    if (wingPrice == null && wingAlt) {
      // already pushed primary (no price); push alt as additional fallback
      pushItem(wingAlt, wingSize);
    }
    if (foilRes.mode === 'exact' || foilRes.mode === 'options') {
      pushItem(foilRes.setId);
    } else {
      pushItem(foilFW);
      pushItem(foilMast);
      pushItem(foilStab);
    }
    if (board.primary) pushItem(board.primary, boardSize);
    accs.forEach(function (id) { pushItem(id); });

    var levelLabel = LEVEL_LABELS[ctx.level] || ctx.level || '';
    var styleLabel = STYLE_LABELS[ctx.style] || ctx.style || '';
    var totalManwon = Math.round(total / 10000); // 만원 단위
    var totalDisplay = total >= 10000000
      ? (Math.round(total / 100000) / 100).toFixed(1) + 'M'
      : (Math.round(total / 10000) + '만');
    var summary = [levelLabel, styleLabel, '₩' + totalDisplay].filter(Boolean).join(' · ');

    return {
      level: ctx.level,
      weight: ctx.weight,
      style: ctx.style,
      demographic: ctx.demographic,
      recommendations: recs,
      totalKRW: total,
      summary: summary,
      savedAt: Date.now(),
      date: new Date().toISOString().split('T')[0]
    };
  }

  // ---- Board Volume Recommendation (Danny verified formula, 2026-05-06) ----
  // Source: reference_takoon_board_specs.md + Danny condition adjustment rules
  //
  // Skill-based base volume:
  //   beginner     : weight × 1.5
  //   intermediate : (weight + gear 10kg) + 17L  (mid of 15–20)
  //   advanced     : (weight + gear 10kg) + 5L   (mid of 0–10)
  //   pro          : weight + 10L                (mid of "weight ~ weight+20")
  //
  // Condition adjustment (Danny rule — single +5% only, NO double-stacking):
  //   choppy/wave OR balance-issue OR both → base × 1.05  (apply once)
  //   take-off-issue                       → prefer longer linear boards
  //                                          (Glide / Glide Midlength / Ultra Glide)
  //
  // Returns:
  //   { base_l, recommended_l, range_l: [lo, hi], adjusted: bool,
  //     prefer_models: string[], notes: string[] }
  function recommendBoardVolume(opts) {
    opts = opts || {};
    const weight = Number(opts.weight) || 0;
    const skill = (opts.skill || 'intermediate').toLowerCase();
    const cond = opts.conditions || {};
    const choppy = !!cond.choppy;
    const wave = !!cond.wave;
    const balance = !!cond.balance;
    const takeoff = !!cond.takeoff;

    if (weight <= 0) {
      return { error: 'weight_required' };
    }

    let base, range_lo, range_hi;
    // §155 v3 — 'novice' (초급) uses beginner volume formula until curated data exists.
    const normalizedSkill = (skill === 'novice') ? 'beginner' : skill;
    switch (normalizedSkill) {
      case 'beginner':
        base = weight * 1.5;
        range_lo = base;
        range_hi = base * 1.10;
        break;
      case 'intermediate':
        base = (weight + 10) + 17;
        range_lo = (weight + 10) + 15;
        range_hi = (weight + 10) + 20;
        break;
      case 'advanced':
        base = (weight + 10) + 5;
        range_lo = (weight + 10) + 0;
        range_hi = (weight + 10) + 10;
        break;
      case 'pro':
        base = weight + 10;
        range_lo = weight;
        range_hi = weight + 20;
        break;
      default:
        base = (weight + 10) + 17;
        range_lo = (weight + 10) + 15;
        range_hi = (weight + 10) + 20;
    }

    // Single +5% adjustment — choppy/wave/balance count once even if all true
    const needsAdjust = choppy || wave || balance;
    const recommended_l = needsAdjust ? base * 1.05 : base;

    // Take-off difficulty → prefer longer linear boards
    const prefer_models = [];
    const notes = [];
    if (takeoff) {
      // Order from "easiest take-off" to "moderate"
      prefer_models.push('takoon-glide-midlength', 'takoon-ultra-glide', 'takoon-glide');
      notes.push('Take-off 난이도 → 긴 선형 보드 우선 (Glide Midlength / Ultra Glide / Glide)');
    }
    if (needsAdjust) {
      const reasons = [];
      if (choppy) reasons.push('choppy');
      if (wave) reasons.push('wave');
      if (balance) reasons.push('balance');
      notes.push('컨디션 보정 +5% (' + reasons.join('·') + ' — 중복 합산 X, 단일 적용)');
    }

    return {
      base_l: +base.toFixed(1),
      recommended_l: +recommended_l.toFixed(1),
      range_l: [+range_lo.toFixed(1), +range_hi.toFixed(1)],
      adjusted: needsAdjust,
      prefer_models: prefer_models,
      notes: notes,
      formula_source: 'reference_takoon_board_specs.md (Danny verified 2026-05-06)'
    };
  }

  // ---- Section-level wind baseline injector ----
  // 각 cons-matrix 섹션의 .cons-matrix__head 끝에 baseline 안내 strip 삽입.
  // (cons-matrix__head가 페이지 HTML에 이미 있으므로 lead 직후에 mount.)
  function injectSectionWindBaseline(scope) {
    const root = scope || document;
    const heads = root.querySelectorAll('.cons-matrix__head');
    heads.forEach(head => {
      if (head.querySelector('.cons-matrix__wind-baseline')) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = WIND_BASELINE.section_baseline_html;
      const node = wrap.firstElementChild;
      head.appendChild(node);
    });
  }

  // Public API
  window.DMJMatrix = {
    load: loadData,
    renderLevel: async (level, target) => {
      await loadData();
      const c = typeof target === 'string' ? document.querySelector(target) : target;
      if (c) renderLevelGrid(level, c);
      injectSectionWindBaseline();
    },
    renderStyle: async (style, target) => {
      await loadData();
      const c = typeof target === 'string' ? document.querySelector(target) : target;
      if (c) renderStyleGrid(style, c);
      injectSectionWindBaseline();
    },
    renderQuiz: async (level, weight, style, target, opts) => {
      await loadData();
      const c = typeof target === 'string' ? document.querySelector(target) : target;
      if (c) renderQuizResult(level, weight, style, c, opts);
    },
    lookup: async (level, weight, style) => {
      await loadData();
      return lookupEntry(level, weight, style);
    },
    applyDemographicAdjustment: (entry, key) => applyDemographicAdjustment(entry, key),
    getDemographic: (key) => getDemographic(key),
    // Verified board volume formula (Danny 2026-05-06)
    recommendBoardVolume: recommendBoardVolume,
    // §171 v2 (Danny 2026-05-13) — expose last quiz result for host pages (fmg_history save, CTA wiring).
    _lastQuizResult: null,
    resolveQuizResultData: resolveQuizResultData,
    // DO_NOT_REVERT §171-B v3 (Danny 2026-05-13) — expose getProductPrice for cart.js dual-fallback.
    // cart.js lookupPrice → products.json miss → window.DMJMatrix.getPrice(sku, size) → PRICE_OVERRIDES.
    getPrice: getProductPrice,
    getProductPrice: getProductPrice
  };

  // ----- §171-B + §171-A (Danny 2026-05-13) — "+ 장바구니" 클릭 처리 (toggle) -----
  // find-my-gear.html (또는 다른 matrix.js consumer 페이지) 에 cart.js 가 로드된 경우에만 작동.
  // 비로그인 시 alert 후 redirect to login.html?redirect=cart.html.
  // 상태(data-cart-state) 인식: in = 담김 (다시 클릭 = remove) / out = 미담김 (클릭 = add).
  function setBtnState(btn, inCart) {
    if (!btn) return;
    if (inCart) {
      btn.classList.add('mtx-item__addcart--in');
      btn.classList.remove('is-added');
      btn.setAttribute('data-cart-state', 'in');
      btn.setAttribute('aria-label', '장바구니에서 빼기');
      btn.textContent = '✓ 담김';
    } else {
      btn.classList.remove('mtx-item__addcart--in');
      btn.classList.remove('is-added');
      btn.setAttribute('data-cart-state', 'out');
      btn.setAttribute('aria-label', '장바구니에 담기');
      btn.textContent = '+ 장바구니';
    }
  }

  function syncAllCartBtns() {
    if (!window.DMJCart) return;
    let items;
    try { items = window.DMJCart.getItems(); } catch (e) { items = []; }
    const btns = document.querySelectorAll('[data-cart-add]');
    btns.forEach(function (b) {
      const sku = b.getAttribute('data-sku');
      const sz = b.getAttribute('data-size') || '';
      const inCart = items.some(function (it) {
        return it && it.sku === sku && (it.size || '') === sz;
      });
      setBtnState(b, inCart);
    });
    // §171 v5 — recalc cart-intersect summary on every cart-button sync
    recalcCartSummaries();
  }

  // §171 v5 (Danny 2026-05-13) — 합계 = 담긴 SKU만 SUM.
  // 각 .mtx-summary[data-mtx-skus] 의 SKU list 와 cart 교집합 → SUM. 실시간 갱신.
  // DO_NOT_REVERT §171 v5 — 추천 전체 SUM 회귀 영구 X.
  function recalcCartSummaries() {
    if (!window.DMJCart) return;
    let cartItems;
    try { cartItems = window.DMJCart.getItems(); } catch (e) { cartItems = []; }
    const summaries = document.querySelectorAll('.mtx-summary[data-mtx-skus]');
    summaries.forEach(function (sum) {
      let cardSkus = [];
      try {
        const raw = sum.getAttribute('data-mtx-skus') || '';
        cardSkus = JSON.parse(decodeURIComponent(raw));
      } catch (e) { cardSkus = []; }
      let cartSum = 0;
      let countInCart = 0;
      cardSkus.forEach(function (s) {
        if (typeof s.price !== 'number') return;
        const inCart = cartItems.some(function (it) {
          return it && it.sku === s.sku && (it.size || '') === (s.size || '');
        });
        if (inCart) {
          cartSum += s.price;
          countInCart++;
        }
      });
      const totalEl = sum.querySelector('.mtx-summary__total');
      const hint = sum.querySelector('.mtx-summary__cart-hint');
      if (totalEl) totalEl.textContent = formatKRW(cartSum);
      if (hint) {
        if (countInCart === 0) {
          hint.textContent = '장바구니에 담아 주세요';
          hint.style.display = '';
        } else {
          hint.textContent = countInCart + '개 항목 · 추정 운송비 별도';
          hint.style.display = '';
        }
      }
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (e) {
      const btn = e.target.closest && e.target.closest('[data-cart-add]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (!window.DMJCart) {
        console.warn('[§171-B] DMJCart not loaded — cannot add to cart.');
        return;
      }
      const sku = btn.getAttribute('data-sku');
      const sizeAttr = btn.getAttribute('data-size') || '';
      const size = sizeAttr ? sizeAttr : null;
      if (!sku) return;

      const loggedIn = window.DMJCart.isLoggedIn();
      if (!loggedIn) {
        const go = window.confirm('장바구니는 회원 전용입니다. 로그인하시겠습니까?');
        if (go) {
          window.location.href = 'login.html?redirect=cart.html';
        }
        return;
      }

      const state = btn.getAttribute('data-cart-state') || 'out';
      if (state === 'in') {
        // toggle off — remove from cart
        window.DMJCart.remove(sku, size);
        setBtnState(btn, false);
      } else {
        // toggle on — add to cart
        window.DMJCart.add({ sku: sku, qty: 1, size: size, addedAt: Date.now() });
        setBtnState(btn, true);
      }
    });

    // §171-A — cart.js emits `dmj:cart:change` on add/remove/clear (also fired by cart.html / quote.html
    // clear). Re-sync all visible cart buttons so state stays consistent across tabs/pages.
    document.addEventListener('dmj:cart:change', syncAllCartBtns);
    // storage event = cross-tab. localStorage 변경 시 다른 탭의 find-my-gear 도 동기화.
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', function (e) {
        if (!e || !e.key) return;
        // per-user namespace: dmj_user_<uid>_cart or dmj_anon_cart
        if (e.key.indexOf('_cart') >= 0) syncAllCartBtns();
      });
    }
  }
})();
