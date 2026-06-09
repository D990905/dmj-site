/* ============================================================
 * gear-recommender.js — §403 + §404 4-tile interactive gear recommender
 * By 알렉스 박 (Alex Park, #4 Frontend Engineer) · 2026-06-09
 * DO_NOT_REVERT §403 + §404
 *
 * 옥대표님 verbatim 2026-06-09:
 *   §403: "체중과 바람세기를 입력하면 자동으로 장비가 추천되게 할거야.
 *         대신 컨디션이 4가지이니까 4타일은 유지하면 되고."
 *   §404: "체중이랑 바람세기에 따라 보드 포일 윙 사이즈 모두 변하게 만들어줘.
 *         그리고 체중입력을 0.5단위로 화살표 아래위로 눌러서 수정도 가능하게"
 *
 * §404 변경 (기존 §403 위에서 확장):
 *  (a) 윙 외에 보드 volume + 포일 area 도 weight × wind 에 따라 dynamic
 *  (b) GEAR_BANK 재구조화 — wingBrand + foilOptions[] + boardOptions[] + safety
 *  (c) targetBoardVolume(level, weight, wind, style) + targetFoilArea(...) 신규
 *  (d) 체중 input step=0.5 + inputmode=decimal + 화살표 spinner (HTML5 native)
 *  (e) Readout 1 자리 소수 (toFixed(1))
 *
 * Design
 *  · Host page 의 <section class="lvl-rec" data-level="..."> 자동 init
 *  · 4 tile (flat-speed / choppy-freeride / wave / hybrid) DOM 자동 build
 *  · Each tile: weight input (0.5kg step) + wind slider (4-24kt) → 자동 추천
 *  · Recommendation engine = local algorithm (GEAR_BANK + targetXxx 공식)
 *  · DMJMatrix.lookup() 은 wing sizes_m2 정교화 용도 (sources-of-truth fallback)
 *  · a11y: WCAG SC 1.3.1 labels, slider aria-valuemin/max/now, aria-live="polite"
 *  · 한국어 word-break keep-all (host CSS 적용)
 *
 * 회귀 가드: 기존 matrix.js · DMJMatrix API 무수정. find-my-gear.html / style/*
 *           영향 0. 본 컴포넌트 = level/* 4 페이지 전용.
 * ============================================================ */
(function () {
  'use strict';

  // ─── Style metadata ────────────────────────────────────────
  // 옥대표님 screenshot 의 4 컨디션 = matrix.js 의 4 style 키와 정합.
  var STYLES = [
    {
      key: 'flat-speed',
      title: 'Flat·Speed',
      sub: '평수면·속도 우선 — 강·내수면 flat한 컨디션',
      defaultWind: 18
    },
    {
      key: 'choppy-freeride',
      title: 'Choppy·Freeride',
      sub: '한국 일반 spot — choppy 한 freeride',
      defaultWind: 14
    },
    {
      key: 'wave',
      title: 'Wave',
      sub: '파도·서핑 라이딩 — wave 한국 동해안',
      defaultWind: 12
    },
    {
      key: 'hybrid',
      title: 'Hybrid',
      sub: '다목적 — 한 세트로 여러 컨디션',
      defaultWind: 16
    }
  ];

  var LEVEL_LABELS = {
    beginner:     '입문',
    novice:       '초급',
    intermediate: '중급',
    advanced:     '상급',
    pro:          '선수'
  };
  // novice → beginner fallback (matrix.js §155 v3 정합)
  var LEVEL_BANK_FALLBACK = { novice: 'beginner' };

  // 페이지 level 별 default 체중 (한국 평균 + level 별 상향 보정).
  // §404 — step 0.5kg 정합 (모두 짝수 또는 .5 끝).
  var DEFAULT_WEIGHT_BY_LEVEL = {
    beginner:     65.0,
    novice:       68.0,
    intermediate: 72.0,
    advanced:     75.0,
    pro:          75.0
  };

  // ─── §403 — Weight kg → matrix tier 매핑 ──────────────────
  // matrix.js WEIGHT_RANGE: light 50-65 / mid-light 65-75 / mid-heavy 75-85 / heavy 85+
  function weightTier(kg) {
    var w = parseFloat(kg);
    if (!isFinite(w) || w <= 0) return 'mid-light';
    if (w < 65) return 'light';
    if (w < 75) return 'mid-light';
    if (w < 85) return 'mid-heavy';
    return 'heavy';
  }

  // ─── §403 — wind kt × weight → 윙 면적 (m²) 추천 ──────────
  // 75kg 기준 표 + ±10kg/±0.5m² 보정. 7.4m² cap (race rule).
  function targetWingArea(weightKg, windKt, style) {
    var w = parseFloat(weightKg);
    var k = parseFloat(windKt);
    if (!isFinite(w) || w <= 0) w = 75;
    if (!isFinite(k) || k <= 0) k = 14;
    var base;
    if (k <= 8)       base = 7.0;
    else if (k <= 10) base = 6.0;
    else if (k <= 12) base = 5.5;
    else if (k <= 14) base = 5.0;
    else if (k <= 16) base = 4.5;
    else if (k <= 18) base = 4.0;
    else if (k <= 20) base = 3.5;
    else              base = 3.0;
    base += (w - 75) / 10 * 0.5;
    // Wave style — 더 작은 wing (조작성 우선)
    if (style === 'wave') base -= 0.5;
    if (base > 7.4) base = 7.4;
    if (base < 2.5) base = 2.5;
    return Math.round(base * 2) / 2;  // round to 0.5m²
  }

  // ─── §404 — weight × wind × level × style → 보드 volume (L) ─
  // Beginner 입문 = 체중 + 30-50L 마진 (가장 큰 보드)
  // Intermediate 중급 = + 15-25L
  // Advanced 상급 = + 0-15L
  // Pro 선수 = -5 ~ +5L (sinker)
  // Wave style = -5~-8L 추가 감소 (짧은 surf 보드)
  // Flat·Speed = -3L (race 보드)
  // Light wind (≤10kt) = +6~10L (테이크오프 용이)
  // Strong wind (≥18kt) = -5~8L (sporty)
  function targetBoardVolume(level, weightKg, windKt, style) {
    var w = parseFloat(weightKg);
    var k = parseFloat(windKt);
    if (!isFinite(w) || w <= 0) w = 75;
    if (!isFinite(k) || k <= 0) k = 14;
    var marginByLevel = {
      beginner:     38,
      novice:       30,
      intermediate: 18,
      advanced:     8,
      pro:          0
    };
    var base = w + (marginByLevel[level] != null ? marginByLevel[level] : 18);
    // Wind adjustment
    if (k <= 10)      base += 8;
    else if (k >= 18) base -= 7;
    // Style adjustment
    if (style === 'wave')             base -= 8;
    else if (style === 'flat-speed')  base -= 3;
    // Floor + cap
    if (base < 40) base = 40;
    if (base > 150) base = 150;
    return Math.round(base);
  }

  // ─── §404 — weight × wind × style → 포일 area (cm²) ────────
  // 75kg 기준 표 (front wing area):
  //   ≤8kt → 1500 / ≤10 → 1200 / ≤12 → 1000 / ≤14 → 850 /
  //   ≤16 → 750  / ≤18 → 650  / ≤20 → 600  / >20 → 540
  // Weight scaling: ±10kg → ±80cm²
  // Wave style = ×0.85 (조작성 우선)
  // Beginner override = floor 900 (떠오름 우선)
  function targetFoilArea(level, weightKg, windKt, style) {
    var w = parseFloat(weightKg);
    var k = parseFloat(windKt);
    if (!isFinite(w) || w <= 0) w = 75;
    if (!isFinite(k) || k <= 0) k = 14;
    var base;
    if (k <= 8)        base = 1500;
    else if (k <= 10)  base = 1200;
    else if (k <= 12)  base = 1000;
    else if (k <= 14)  base = 850;
    else if (k <= 16)  base = 750;
    else if (k <= 18)  base = 650;
    else if (k <= 20)  base = 600;
    else               base = 540;
    base += (w - 75) * 8;
    if (style === 'wave') base = Math.round(base * 0.85);
    // Beginner / novice = 큰 포일 floor (떠오름 안정)
    if ((level === 'beginner' || level === 'novice') && base < 900) base = 900;
    if (base < 400)  base = 400;
    if (base > 1700) base = 1700;
    return Math.round(base);
  }

  // ─── §404 — GEAR_BANK ─────────────────────────────────────
  // key = "level|style" → { wingBrand, foilOptions[], boardOptions[], safety }
  // foilOptions: SKU 후보 + area cm². 알고리즘이 target area 에 가장 가까운 SKU 선택.
  // boardOptions: SKU 후보 + vol L. target volume 에 가까운 SKU 선택.
  // 메모리 reference 참조: takoon_board_specs, takoon_foil_guideline,
  //   dmj_mast_length_progression, ppc_wing_model_characteristics
  var GEAR_BANK = {
    // ─── beginner ──────────────────────────────────────────
    'beginner|flat-speed': {
      wingBrand: 'PPC M2',
      foilOptions: [
        { label: 'Levitaz FW 900',              area: 900 },
        { label: 'Takoon Foil Starter 1600cm²', area: 1600 }
      ],
      boardOptions: [
        { label: 'Levitaz Boom FS 95L',  vol: 95 },
        { label: 'Takoon Cruise 110L',   vol: 110 },
        { label: 'Takoon Cruise 130L',   vol: 130 }
      ],
      safety: 'WIP Impact Vest 50N + Entry Wetsuit'
    },
    'beginner|choppy-freeride': {
      wingBrand: 'PPC M2',
      foilOptions: [
        { label: 'Levitaz FW 900',              area: 900 },
        { label: 'Takoon Foil Starter 1600cm²', area: 1600 }
      ],
      boardOptions: [
        { label: 'Takoon Cruise 110L', vol: 110 },
        { label: 'Takoon Cruise 130L', vol: 130 },
        { label: 'Takoon Cruise 145L', vol: 145 }
      ],
      safety: 'WIP Impact Vest 50N + 3/2 Wetsuit'
    },
    'beginner|wave': {
      wingBrand: 'PPC M2',
      foilOptions: [
        { label: 'Levitaz FW 900',              area: 900 },
        { label: 'Takoon Foil Starter 1600cm²', area: 1600 }
      ],
      boardOptions: [
        { label: 'Takoon Cruise 95L',  vol: 95 },
        { label: 'Takoon Cruise 110L', vol: 110 }
      ],
      safety: 'WIP Impact Vest 50N + WIP Helmet'
    },
    'beginner|hybrid': {
      wingBrand: 'PPC M2',
      foilOptions: [
        { label: 'Levitaz FW 900',              area: 900 },
        { label: 'Takoon Foil Starter 1600cm²', area: 1600 }
      ],
      boardOptions: [
        { label: 'Takoon Cruise 110L',                vol: 110 },
        { label: 'Takoon Glide Midlength 100L',       vol: 100 },
        { label: 'Takoon Cruise 130L',                vol: 130 }
      ],
      safety: 'WIP Impact Vest 50N + Wetsuit'
    },

    // ─── intermediate ──────────────────────────────────────
    'intermediate|flat-speed': {
      wingBrand: 'PPC M1-X',
      foilOptions: [
        { label: 'Levitaz FW 680', area: 680 },
        { label: 'Levitaz FW 790', area: 790 },
        { label: 'Levitaz FW 900', area: 900 }
      ],
      boardOptions: [
        { label: 'Levitaz Boom FS 83L', vol: 83 },
        { label: 'Levitaz Boom FS 95L', vol: 95 }
      ],
      safety: 'WIP Impact Vest 50N'
    },
    'intermediate|choppy-freeride': {
      wingBrand: 'Takoon V4 Pro',
      foilOptions: [
        { label: 'Levitaz FW 790', area: 790 },
        { label: 'Levitaz FW 900', area: 900 }
      ],
      boardOptions: [
        { label: 'Takoon Glide Midlength 95L',  vol: 95 },
        { label: 'Takoon Glide Midlength 110L', vol: 110 },
        { label: 'Levitaz Boom FS 83L',         vol: 83 }
      ],
      safety: 'WIP Impact Vest 50N + 3/2 Wetsuit'
    },
    'intermediate|wave': {
      wingBrand: 'Takoon V4 Pro',
      foilOptions: [
        { label: 'Takoon Flow 800cm² + Carbon HR', area: 800 },
        { label: 'Takoon Flare 900cm² + Carbon HR', area: 900 },
        { label: 'Takoon Flow 900cm² + Carbon HR', area: 900 }
      ],
      boardOptions: [
        { label: 'Takoon Prosurf 75L',  vol: 75 },
        { label: 'Levitaz Boom FS 83L', vol: 83 },
        { label: 'Takoon Glide 80L',    vol: 80 }
      ],
      safety: 'WIP Impact Vest 50N + WIP Helmet'
    },
    'intermediate|hybrid': {
      wingBrand: 'PPC M1-X',
      foilOptions: [
        { label: 'Levitaz FW 790', area: 790 },
        { label: 'Levitaz FW 900', area: 900 }
      ],
      boardOptions: [
        { label: 'Levitaz Boom FS 83L',           vol: 83 },
        { label: 'Takoon Glide Midlength 105L',   vol: 105 }
      ],
      safety: 'WIP Impact Vest 50N + Wetsuit'
    },

    // ─── advanced ──────────────────────────────────────────
    'advanced|flat-speed': {
      wingBrand: 'PPC M1',
      foilOptions: [
        { label: 'Levitaz FW 540 + Mast 96', area: 540 },
        { label: 'Levitaz FW 680 + Mast 96', area: 680 }
      ],
      boardOptions: [
        { label: 'Levitaz Boom FS 63L', vol: 63 },
        { label: 'Levitaz Boom FS 83L', vol: 83 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0'
    },
    'advanced|choppy-freeride': {
      wingBrand: 'PPC M1-X',
      foilOptions: [
        { label: 'Levitaz FW 680 + Mast 96', area: 680 },
        { label: 'Levitaz FW 790 + Mast 96', area: 790 }
      ],
      boardOptions: [
        { label: 'Levitaz Boom FS 63L', vol: 63 },
        { label: 'Levitaz Boom FS 83L', vol: 83 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0'
    },
    'advanced|wave': {
      wingBrand: 'PPC M1-X',
      foilOptions: [
        { label: 'Takoon Flash 530cm² + Carbon HM 16mm', area: 530 },
        { label: 'Takoon Flash 680cm² + Carbon HM 16mm', area: 680 },
        { label: 'Takoon Swell 900cm² + Carbon HM 16mm', area: 900 }
      ],
      boardOptions: [
        { label: 'Takoon Prosurf 60L',  vol: 60 },
        { label: 'Levitaz Boom FS 63L', vol: 63 },
        { label: 'Takoon Prosurf 75L',  vol: 75 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0'
    },
    'advanced|hybrid': {
      wingBrand: 'PPC M1',
      foilOptions: [
        { label: 'Levitaz FW 540 + Mast 96', area: 540 },
        { label: 'Levitaz FW 680 + Mast 96', area: 680 },
        { label: 'Levitaz FW 790 + Mast 96', area: 790 }
      ],
      boardOptions: [
        { label: 'Levitaz Boom FS 63L', vol: 63 },
        { label: 'Levitaz Boom FS 83L', vol: 83 },
        { label: 'Levitaz Boom FS 95L', vol: 95 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0 + Waistfoil Harness'
    },

    // ─── pro ───────────────────────────────────────────────
    'pro|flat-speed': {
      wingBrand: 'PPC Sonic FDS',
      foilOptions: [
        { label: 'Levitaz R6 풀세트 (Race front wing)', area: 750 }
      ],
      boardOptions: [
        { label: 'Levitaz R6 race board',  vol: 65 },
        { label: 'Levitaz Boom FS 63L',     vol: 63 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0 + Waistfoil Harness 3.0'
    },
    'pro|choppy-freeride': {
      wingBrand: 'PPC Sonic FDS',
      foilOptions: [
        { label: 'Levitaz R6 풀세트', area: 750 }
      ],
      boardOptions: [
        { label: 'Levitaz R6 race board', vol: 65 },
        { label: 'Levitaz Boom FS 63L',    vol: 63 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0 + Waistfoil Harness 3.0'
    },
    'pro|wave': {
      wingBrand: 'PPC Sonic FDS',
      foilOptions: [
        { label: 'Takoon Flash 530cm² + Carbon HM 16mm', area: 530 },
        { label: 'Takoon Flash 680cm² + Carbon HM 16mm', area: 680 }
      ],
      boardOptions: [
        { label: 'Takoon Prosurf 60L',  vol: 60 },
        { label: 'Levitaz Boom FS 63L', vol: 63 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0'
    },
    'pro|hybrid': {
      wingBrand: 'PPC Sonic FDS',
      foilOptions: [
        { label: 'Levitaz R6 풀세트', area: 750 }
      ],
      boardOptions: [
        { label: 'Levitaz R6 race board', vol: 65 },
        { label: 'Levitaz Boom FS 63L',    vol: 63 }
      ],
      safety: 'WIP X-OVER Helmet + Kompact 50N 2.0 + Waistfoil Harness 3.0'
    }
  };

  function getBank(level, style) {
    var lk = LEVEL_BANK_FALLBACK[level] || level;
    return GEAR_BANK[lk + '|' + style] || null;
  }

  // ─── §404 — Pick nearest option by metric key ──────────────
  function pickNearest(options, target, metricKey) {
    if (!options || !options.length) return null;
    var best = options[0];
    var bestDist = Math.abs(options[0][metricKey] - target);
    for (var i = 1; i < options.length; i++) {
      var d = Math.abs(options[i][metricKey] - target);
      if (d < bestDist) { bestDist = d; best = options[i]; }
    }
    return best;
  }

  // ─── §403 — wing sizes_m2 list 안 nearest 선택 (matrix entry 활용) ─
  function pickNearestSize(sizesArr, targetArea) {
    if (!sizesArr || !sizesArr.length) return null;
    var best = sizesArr[0];
    var bestDist = Math.abs(best - targetArea);
    for (var i = 1; i < sizesArr.length; i++) {
      var d = Math.abs(sizesArr[i] - targetArea);
      if (d < bestDist) { bestDist = d; best = sizesArr[i]; }
    }
    return best;
  }

  // ─── matrix.js lookup wrapper (async, sizes_m2 정교화 용도) ─
  function getEntry(level, weightTier, style) {
    var mtxLevel = LEVEL_BANK_FALLBACK[level] || level;
    if (window.DMJMatrix && typeof window.DMJMatrix.lookup === 'function') {
      return window.DMJMatrix.lookup(mtxLevel, weightTier, style)
        .catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  // ─── §404 — Render output rows (wing/foil/board/safety) ────
  function renderRows(bank, suggestedWing, suggestedFoilArea, suggestedBoardVol) {
    var rows = [];
    if (!bank) return rows;
    rows.push({ label: '윙',   text: bank.wingBrand + ' ' + suggestedWing + 'm²' });
    var foil = pickNearest(bank.foilOptions, suggestedFoilArea, 'area');
    if (foil) rows.push({ label: '포일', text: foil.label });
    var board = pickNearest(bank.boardOptions, suggestedBoardVol, 'vol');
    if (board) rows.push({ label: '보드', text: board.label });
    if (bank.safety) rows.push({ label: '안전', text: bank.safety });
    return rows;
  }

  // ─── §404 — Format weight readout (1 자리 소수) ────────────
  function fmtWeight(kg) {
    var w = parseFloat(kg);
    if (!isFinite(w)) return '— kg';
    // 0.5 단위라 toFixed(1) 가 항상 정합 (70.0 / 70.5)
    return w.toFixed(1) + ' kg';
  }

  // Build a single tile DOM (returns the article element).
  function buildTile(style, levelKey) {
    var defaultWeight = DEFAULT_WEIGHT_BY_LEVEL[levelKey] || 72.0;
    var defaultWind = style.defaultWind;
    var levelLabel = LEVEL_LABELS[levelKey] || levelKey;

    var tile = document.createElement('article');
    tile.className = 'lvl-rec__tile lvl-rec__tile--' + style.key;
    tile.setAttribute('data-style', style.key);

    var uid = 'lvlrec-' + style.key + '-' + Math.random().toString(36).slice(2, 8);
    var weightId = uid + '-w';
    var windId = uid + '-k';
    var outId = uid + '-o';

    // §404 — weight input: type=number, step=0.5, inputmode=decimal, min=40, max=120.
    // HTML5 native spinner = 화살표 위/아래 click 시 ±0.5 자동.
    // 모바일 (iOS/Android) = inputmode=decimal → 소수점 키패드 자동 노출.
    tile.innerHTML =
      '<header class="lvl-rec__tile-head">' +
        '<span class="lvl-rec__tile-eyebrow">' + levelLabel + ' · ' + style.title + '</span>' +
        '<h3 class="lvl-rec__tile-title">' + style.title + '</h3>' +
        '<p class="lvl-rec__tile-sub">' + style.sub + '</p>' +
      '</header>' +
      '<div class="lvl-rec__inputs">' +
        '<div class="lvl-rec__field">' +
          '<label class="lvl-rec__field-label" for="' + weightId + '">' +
            '체중 <span class="lvl-rec__field-value" data-readout="weight">' + fmtWeight(defaultWeight) + '</span>' +
          '</label>' +
          '<input type="number" class="lvl-rec__weight" id="' + weightId + '" ' +
            'min="40" max="120" step="0.5" value="' + defaultWeight.toFixed(1) + '" ' +
            'inputmode="decimal" autocomplete="off" data-input="weight" ' +
            'aria-label="체중 (kg, 0.5kg 단위, 화살표로 ±0.5)">' +
        '</div>' +
        '<div class="lvl-rec__field">' +
          '<label class="lvl-rec__field-label" for="' + windId + '">' +
            '풍속 <span class="lvl-rec__field-value" data-readout="wind">' + defaultWind + ' kt</span>' +
          '</label>' +
          '<input type="range" class="lvl-rec__wind" id="' + windId + '" ' +
            'min="4" max="24" step="1" value="' + defaultWind + '" ' +
            'data-input="wind" ' +
            'aria-label="풍속 (knot, 4-24)" ' +
            'aria-valuemin="4" aria-valuemax="24" aria-valuenow="' + defaultWind + '">' +
        '</div>' +
      '</div>' +
      '<div class="lvl-rec__out" id="' + outId + '" data-out aria-live="polite" aria-atomic="true">' +
        '<div class="lvl-rec__out-loading">추천 계산 중…</div>' +
      '</div>' +
      '<a href="#contact" class="lvl-rec__cta" ' +
        'data-level="' + levelKey + '" data-style="' + style.key + '" ' +
        'aria-label="' + levelLabel + ' · ' + style.title + ' 풀세트 견적 요청 — 카톡 상담으로 이동">' +
        '<strong>' + style.title + ' 풀세트 견적 요청 →</strong>' +
      '</a>';

    return tile;
  }

  // Re-render the output for one tile based on current input values.
  function updateTile(tile, levelKey) {
    var weightInput = tile.querySelector('[data-input="weight"]');
    var windInput = tile.querySelector('[data-input="wind"]');
    var weightReadout = tile.querySelector('[data-readout="weight"]');
    var windReadout = tile.querySelector('[data-readout="wind"]');
    var out = tile.querySelector('[data-out]');
    var styleKey = tile.getAttribute('data-style');

    var weight = parseFloat(weightInput.value);
    var wind = parseFloat(windInput.value);

    if (!isFinite(weight) || weight < 40 || weight > 120) {
      out.innerHTML = '<div class="lvl-rec__out-error">체중을 40-120kg 사이로 입력해 주세요.</div>';
      return;
    }
    if (!isFinite(wind) || wind < 4 || wind > 24) {
      out.innerHTML = '<div class="lvl-rec__out-error">풍속이 범위 밖입니다 (4-24kt).</div>';
      return;
    }

    weightReadout.textContent = fmtWeight(weight);
    windReadout.textContent = wind + ' kt';
    windInput.setAttribute('aria-valuenow', String(wind));

    // §404 — 3 sizes 모두 weight×wind 으로 동적 계산
    var wingArea = targetWingArea(weight, wind, styleKey);
    var foilArea = targetFoilArea(levelKey, weight, wind, styleKey);
    var boardVol = targetBoardVolume(levelKey, weight, wind, styleKey);

    // matrix entry 의 wing sizes_m2 가 있으면 정확 SKU size 로 정교화
    getEntry(levelKey, weightTier(weight), styleKey).then(function (entry) {
      var wingSize = wingArea;
      if (entry && entry.wing && entry.wing.sizes_m2 && entry.wing.sizes_m2.length) {
        var snap = pickNearestSize(entry.wing.sizes_m2, wingArea);
        if (snap != null) wingSize = snap;
      }
      var bank = getBank(levelKey, styleKey);
      var rows = renderRows(bank, wingSize, foilArea, boardVol);
      if (!rows.length) {
        out.innerHTML = '<div class="lvl-rec__out-error">추천 데이터 부재 — 1:1 상담 권장.</div>';
        return;
      }
      var html = rows.map(function (r) {
        return '<div class="lvl-rec__out-row"><span><b>' + r.label + '</b>' + r.text + '</span></div>';
      }).join('');
      out.innerHTML = html;
    });
  }

  // Init one section: build 4 tiles, wire inputs, kick off initial render.
  function initSection(section) {
    if (section.getAttribute('data-lvl-rec-init') === '1') return;
    section.setAttribute('data-lvl-rec-init', '1');

    var levelKey = section.getAttribute('data-level');
    if (!levelKey) {
      console.warn('[gear-recommender §403] data-level attribute missing');
      return;
    }

    var grid = section.querySelector('.lvl-rec__grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'lvl-rec__grid';
      section.appendChild(grid);
    }

    STYLES.forEach(function (style) {
      var tile = buildTile(style, levelKey);
      grid.appendChild(tile);

      var weightInput = tile.querySelector('[data-input="weight"]');
      var windInput = tile.querySelector('[data-input="wind"]');

      var debounce = null;
      function trigger() {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          updateTile(tile, levelKey);
        }, 80);
      }
      weightInput.addEventListener('input', trigger);
      windInput.addEventListener('input', trigger);

      updateTile(tile, levelKey);
    });
  }

  function initAll() {
    var sections = document.querySelectorAll('.lvl-rec[data-level]');
    sections.forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Expose for late-loaded matrix.js
  document.addEventListener('dmj:matrix:ready', function () {
    document.querySelectorAll('.lvl-rec[data-level]').forEach(function (section) {
      var levelKey = section.getAttribute('data-level');
      section.querySelectorAll('.lvl-rec__tile').forEach(function (tile) {
        updateTile(tile, levelKey);
      });
    });
  });

  // Public API for testing
  window.DMJGearRecommender = {
    weightTier: weightTier,
    targetWingArea: targetWingArea,
    targetBoardVolume: targetBoardVolume,
    targetFoilArea: targetFoilArea,
    pickNearestSize: pickNearestSize,
    pickNearest: pickNearest,
    getBank: getBank,
    fmtWeight: fmtWeight,
    STYLES: STYLES,
    LEVEL_LABELS: LEVEL_LABELS,
    GEAR_BANK: GEAR_BANK,
    initAll: initAll
  };
})();
