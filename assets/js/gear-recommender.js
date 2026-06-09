/* ============================================================
 * gear-recommender.js — §403 4-tile interactive gear recommender
 * By 알렉스 박 (Alex Park, #4 Frontend Engineer) · 2026-06-09
 * DO_NOT_REVERT §403
 *
 * 옥대표님 verbatim 2026-06-09:
 *   "체중과 바람세기를 입력하면 자동으로 장비가 추천되게 할거야.
 *    대신 컨디션이 4가지이니까 4타일은 유지하면 되고."
 *
 * Design
 *  · Host page 의 <section class="lvl-rec" data-level="..."> 자동 init
 *  · 4 tile (flat-speed / choppy-freeride / wave / hybrid) DOM 자동 build
 *  · Each tile: weight input (kg) + wind slider (4-24 kt) → 자동 추천 update
 *  · Recommendation engine = window.DMJMatrix.lookup(level, weightTier, style)
 *    + 본인 wind→wing size 선택 layer
 *  · Fallback: DMJMatrix 미로드 시 inline mini-dataset (offline 안전)
 *  · a11y: WCAG SC 1.3.1 labels, slider aria-valuemin/max/now, aria-live="polite"
 *  · 한국어 word-break keep-all (host CSS 적용)
 *
 * 회귀 가드: 기존 matrix.js · DMJMatrix API 무수정. window.DMJMatrix 가
 *           로드된 페이지에서는 그 lookup 을 source-of-truth 로 활용.
 *           로드 안된 페이지에서는 본인 inline fallback 동작.
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

  // 페이지 host 가 data-level attribute 로 지정. matrix.js 와 동일 키.
  // beginner / novice / intermediate / advanced / pro
  var LEVEL_LABELS = {
    beginner:     '입문',
    novice:       '초급',
    intermediate: '중급',
    advanced:     '상급',
    pro:          '선수'
  };
  // novice 는 matrix.js §155 v3 가 beginner 로 fallback — 동일 dataset.
  var LEVEL_MATRIX_FALLBACK = { novice: 'beginner' };

  // 페이지 level 별 default 체중 (한국 평균 + level 별 상향 보정).
  // 옥대표님 screenshot 의 입문 카드 default 추정 = 65kg → tier 별 적용.
  var DEFAULT_WEIGHT_BY_LEVEL = {
    beginner:     65,
    novice:       68,
    intermediate: 72,
    advanced:     75,
    pro:          75
  };

  // ─── Weight kg → matrix tier 매핑 ─────────────────────────
  // matrix.js WEIGHT_RANGE: light 50-65 / mid-light 65-75 / mid-heavy 75-85 / heavy 85+
  function weightTier(kg) {
    var w = parseFloat(kg);
    if (!isFinite(w) || w <= 0) return 'mid-light';   // safe default
    if (w < 65) return 'light';
    if (w < 75) return 'mid-light';
    if (w < 85) return 'mid-heavy';
    return 'heavy';
  }

  // ─── Wind kt → wing size 선택 (entry.wing.sizes_m2 list 안에서) ─
  // 75kg 기준 표 — apparent wind progression reference.
  // wind kt × wing area (m²) ≈ const for given rider mass.
  //   8kt → 7.0  / 10 → 6.0 / 12 → 5.5 / 14 → 5.0 / 16 → 4.5
  //   18 → 4.0  / 20 → 3.5 / 22+ → 3.0
  // Weight scaling: ±10kg from 75 → ±0.5m².
  function targetWingArea(weightKg, windKt) {
    var w = parseFloat(weightKg);
    var k = parseFloat(windKt);
    if (!isFinite(w) || w <= 0) w = 75;
    if (!isFinite(k) || k <= 0) k = 14;
    // Base table for 75kg
    var base;
    if (k <= 8)       base = 7.0;
    else if (k <= 10) base = 6.0;
    else if (k <= 12) base = 5.5;
    else if (k <= 14) base = 5.0;
    else if (k <= 16) base = 4.5;
    else if (k <= 18) base = 4.0;
    else if (k <= 20) base = 3.5;
    else              base = 3.0;
    // Weight offset
    var offset = (w - 75) / 10 * 0.5;
    var target = base + offset;
    // 7.4m² cap (racing class — reference_wingfoil_racing_class_max_wing)
    if (target > 7.4) target = 7.4;
    if (target < 2.5) target = 2.5;
    return target;
  }

  // Pick the nearest size from entry.wing.sizes_m2 list.
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

  // ─── matrix.js lookup wrapper (async) ─────────────────────
  // window.DMJMatrix.lookup() 를 우선 사용. 미로드 시 inline fallback.
  function getEntry(level, weightTier, style) {
    var mtxLevel = LEVEL_MATRIX_FALLBACK[level] || level;
    if (window.DMJMatrix && typeof window.DMJMatrix.lookup === 'function') {
      return window.DMJMatrix.lookup(mtxLevel, weightTier, style)
        .catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  // ─── Inline fallback dataset (DMJMatrix 미로드 시) ─────────
  // Minimal — brand + 모델명 + 기본 wing/foil/board 추천. 가격·SKU 링크 X.
  // matrix.js 가 로드 되면 그쪽이 source-of-truth. 본 fallback = offline 안전망.
  var FALLBACK_BRANDS = {
    'flat-speed': {
      beginner:     { wing: 'PPC M2 5.0-5.5m²',     foil: 'Levitaz FW 900',  board: 'Takoon Cruise 110L',          safety: 'WIP Impact Vest 50N' },
      intermediate: { wing: 'PPC M1-X 4.5-5.0m²',   foil: 'Levitaz FW 790',  board: 'Levitaz Boom FS 83L',          safety: 'WIP Impact Vest 50N' },
      advanced:     { wing: 'PPC M1 4.5-5.0m²',     foil: 'Levitaz FW 680',  board: 'Levitaz Boom FS 63L',          safety: 'WIP X-OVER Helmet + Kompact 50N' },
      pro:          { wing: 'PPC Sonic FDS 4.5m²',  foil: 'Levitaz R6 풀세트', board: 'Levitaz R6 race board',         safety: 'WIP X-OVER Helmet + Kompact 50N' }
    },
    'choppy-freeride': {
      beginner:     { wing: 'PPC M2 4.5-5.0m²',     foil: 'Levitaz FW 900',  board: 'Takoon Cruise 110L',          safety: 'WIP Impact Vest 50N + 3/2 wet' },
      intermediate: { wing: 'Takoon V4 4.5-5.0m²',  foil: 'Levitaz FW 790',  board: 'Takoon Glide Midlength 95-110', safety: 'WIP Impact Vest 50N + 3/2 wet' },
      advanced:     { wing: 'PPC M1-X 4.5m²',       foil: 'Levitaz FW 680',  board: 'Levitaz Boom FS 63L',          safety: 'WIP X-OVER Helmet + Kompact 50N' },
      pro:          { wing: 'PPC Sonic FDS 4.5m²',  foil: 'Levitaz R6 풀세트', board: 'Levitaz R6 race board',         safety: 'WIP X-OVER Helmet + Kompact 50N' }
    },
    'wave': {
      beginner:     { wing: 'PPC M2 4.0-4.5m²',     foil: 'Levitaz FW 900',  board: 'Takoon Cruise 110L',          safety: 'WIP Impact Vest 50N + Helmet' },
      intermediate: { wing: 'Takoon Flow 800-900cm² 또는 Flare 850-950cm²', foil: 'Takoon Carbon HR 16mm', board: 'Levitaz Boom FS 83L', safety: 'WIP Impact Vest 50N + Helmet' },
      advanced:     { wing: 'Takoon Flash 530-680cm² 또는 Swell 900cm²',    foil: 'Takoon Carbon HM 16mm', board: 'Levitaz Boom FS 63L', safety: 'WIP X-OVER Helmet + Kompact 50N' },
      pro:          { wing: 'PPC Sonic FDS 4.0-4.5m²', foil: 'Levitaz R6 풀세트', board: 'Levitaz R6 race board', safety: 'WIP X-OVER Helmet + Kompact 50N' }
    },
    'hybrid': {
      beginner:     { wing: 'PPC M2 4.5-5.5m²',     foil: 'Levitaz FW 900',  board: 'Takoon Cruise 110L 또는 Glide Midlength 100-110L', safety: 'WIP Impact Vest 50N + Wetsuit' },
      intermediate: { wing: 'PPC M1-X 4.5-5.0m²',   foil: 'Levitaz FW 790 또는 FW 900', board: 'Levitaz Boom FS 83L 또는 Takoon Glide Midlength 95-110', safety: 'WIP Impact Vest 50N + Wetsuit' },
      advanced:     { wing: 'PPC M1 4.5-5.0m²',     foil: 'Levitaz FW 540 또는 FW 680', board: 'Levitaz Boom FS 63L 또는 FS 95L', safety: 'WIP X-OVER Helmet + Kompact 50N + Waistfoil Harness' },
      pro:          { wing: 'PPC Sonic FDS 4.5m²',  foil: 'Levitaz R6 풀세트',         board: 'Levitaz Boom FS 63L 또는 R6 race board', safety: 'WIP X-OVER Helmet + Kompact 50N + Waistfoil Harness' }
    }
  };

  // ─── Render output rows ──────────────────────────────────
  // 정직 raise (Alex #4 2026-06-09): matrix entry 의 wing/foil/board 는 raw SKU id
  // (e.g. "takoon-v4"). 4-tile UI 는 마케팅 카피 우선 → 항상 FALLBACK_BRANDS
  // 브랜드 텍스트로 표시. matrix entry 는 wing 사이즈 (sizes_m2) 만 활용해 풍속·체중
  // 입력에 따라 추천 size 를 정확히 산출. 풀 상세 (가격·SKU 링크) = matrix.js
  // 의 renderQuiz / renderLevel 가 별도 영역 — find-my-gear.html 이 그 source.
  function renderRows(entry, fallback, suggestedSize) {
    var rows = [];
    if (!fallback) return rows;
    var wingText = fallback.wing;
    // matrix sizes 가 있으면 정확 size 로 wing 텍스트 정교화
    if (entry && entry.wing && entry.wing.sizes_m2 && entry.wing.sizes_m2.length && suggestedSize != null) {
      // base 모델명만 뽑아 (앞 4-5 단어), 정확 size 표시
      var nm = fallback.wing.replace(/\s*\d[\d\.]*[-–~][\d\.]*m²?\s*$/, '').replace(/\s*\d[\d\.]*m²?\s*$/, '');
      wingText = nm + ' ' + suggestedSize + 'm²';
    }
    rows.push({ label: '윙', text: wingText });
    rows.push({ label: '포일', text: fallback.foil });
    rows.push({ label: '보드', text: fallback.board });
    rows.push({ label: '안전', text: fallback.safety });
    return rows;
  }

  // Build a single tile DOM (returns the article element).
  function buildTile(style, levelKey) {
    var defaultWeight = DEFAULT_WEIGHT_BY_LEVEL[levelKey] || 72;
    var defaultWind = style.defaultWind;
    var levelLabel = LEVEL_LABELS[levelKey] || levelKey;

    var tile = document.createElement('article');
    tile.className = 'lvl-rec__tile lvl-rec__tile--' + style.key;
    tile.setAttribute('data-style', style.key);

    // Unique IDs for label-input pairs (a11y SC 1.3.1)
    var uid = 'lvlrec-' + style.key + '-' + Math.random().toString(36).slice(2, 8);
    var weightId = uid + '-w';
    var windId = uid + '-k';
    var outId = uid + '-o';

    tile.innerHTML =
      '<header class="lvl-rec__tile-head">' +
        '<span class="lvl-rec__tile-eyebrow">' + levelLabel + ' · ' + style.title + '</span>' +
        '<h3 class="lvl-rec__tile-title">' + style.title + '</h3>' +
        '<p class="lvl-rec__tile-sub">' + style.sub + '</p>' +
      '</header>' +
      '<div class="lvl-rec__inputs">' +
        '<div class="lvl-rec__field">' +
          '<label class="lvl-rec__field-label" for="' + weightId + '">' +
            '체중 <span class="lvl-rec__field-value" data-readout="weight">' + defaultWeight + ' kg</span>' +
          '</label>' +
          '<input type="number" class="lvl-rec__weight" id="' + weightId + '" ' +
            'min="35" max="120" step="1" value="' + defaultWeight + '" ' +
            'inputmode="numeric" autocomplete="off" data-input="weight" ' +
            'aria-label="체중 (kg)">' +
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

    if (!isFinite(weight) || weight < 35 || weight > 120) {
      out.innerHTML = '<div class="lvl-rec__out-error">체중을 35-120kg 사이로 입력해 주세요.</div>';
      return;
    }
    if (!isFinite(wind) || wind < 4 || wind > 24) {
      out.innerHTML = '<div class="lvl-rec__out-error">풍속이 범위 밖입니다 (4-24kt).</div>';
      return;
    }

    weightReadout.textContent = weight + ' kg';
    windReadout.textContent = wind + ' kt';
    windInput.setAttribute('aria-valuenow', String(wind));

    var tier = weightTier(weight);
    var wingArea = targetWingArea(weight, wind);

    // Try DMJMatrix.lookup first, fall back to inline dataset
    getEntry(levelKey, tier, styleKey).then(function (entry) {
      var sizeSuggest = null;
      if (entry && entry.wing && entry.wing.sizes_m2) {
        sizeSuggest = pickNearestSize(entry.wing.sizes_m2, wingArea);
      } else {
        // Pure inline fallback — show calculated target wing area
        sizeSuggest = Math.round(wingArea * 2) / 2;  // round to 0.5
      }
      var fallback = (FALLBACK_BRANDS[styleKey] || {})[LEVEL_MATRIX_FALLBACK[levelKey] || levelKey] || null;
      var rows = renderRows(entry, fallback, sizeSuggest);
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
    if (section.getAttribute('data-lvl-rec-init') === '1') return;  // idempotent
    section.setAttribute('data-lvl-rec-init', '1');

    var levelKey = section.getAttribute('data-level');
    if (!levelKey) {
      console.warn('[gear-recommender §403] data-level attribute missing');
      return;
    }

    var grid = section.querySelector('.lvl-rec__grid');
    if (!grid) {
      // Auto-create grid if host didn't provide one
      grid = document.createElement('div');
      grid.className = 'lvl-rec__grid';
      section.appendChild(grid);
    }

    STYLES.forEach(function (style) {
      var tile = buildTile(style, levelKey);
      grid.appendChild(tile);

      var weightInput = tile.querySelector('[data-input="weight"]');
      var windInput = tile.querySelector('[data-input="wind"]');

      // Debounced update for typing in weight
      var debounce = null;
      function trigger() {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          updateTile(tile, levelKey);
        }, 80);
      }
      weightInput.addEventListener('input', trigger);
      windInput.addEventListener('input', trigger);

      // Initial render
      updateTile(tile, levelKey);
    });
  }

  // Init all sections on page load.
  function initAll() {
    var sections = document.querySelectorAll('.lvl-rec[data-level]');
    sections.forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Expose for late-loaded matrix.js (re-render after DMJMatrix becomes available)
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
    pickNearestSize: pickNearestSize,
    STYLES: STYLES,
    LEVEL_LABELS: LEVEL_LABELS,
    initAll: initAll
  };
})();
