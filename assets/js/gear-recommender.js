/* ============================================================
 * gear-recommender.js — §403 + §405 4-tile interactive gear recommender
 * By 알렉스 박 (Alex Park, #4 Frontend Engineer) · 2026-06-10
 * DO_NOT_REVERT §403 + §405
 *
 * 옥대표님 verbatim 2026-06-10:
 *   "체중과 바람세기에 따라서 모델과 사이즈 추천로직이 상당히 좋아.
 *    니가 그걸 잘 복제했으면 하는데"
 *   "여기서 사용하는 폰트가 일단 아주 맘에 들어"
 *   "체중입력을 0.5단위로 화살표 아래위로 눌러서"
 *
 * §405 변경 (§404 알고리즘 폐기 — 옥대표님 spec 정확 1:1):
 *  (a) LEVEL_CONSTANTS (wf/ff/bv/sailMin-Max/foilMin-Cap/sizes/pump) — 옥대표님 lock
 *  (b) baseSail(kt) + windBand(kt) lookup — spec 표 1:1
 *  (c) calcSail/calcFoil/calcBoard — 공식 spec 1:1
 *  (d) round5 / clamp / nearest 유틸 — spec 명시
 *  (e) Default wkg=68 / kt=13 — spec 명시
 *  (f) 보드 표시 = "{brand} {size}L  ~{target}L" + ≤10kt 시 "미풍 펌핑 +6L" 배지
 *  (g) 슬라이더 골드 채움 (linear-gradient JS-driven dynamic)
 *  (h) 숫자 typography = JetBrains Mono (CSS) — 이미 페이지 로드됨
 *
 * 정직 raise:
 *  - 안전장비 3 level (중급/상급/선수) = 옥대표님 미명시 → 본인 임시. 라이브 view 후 정정.
 *  - 포일 라인업 area 매핑 (Takoon Flow/Starter 1100cm² 등) = 미명시 → 본인 area 표시만, 모델명 = brand fallback.
 *  - 폰트 정확 source = 옥대표님 첨부 screenshot 추정. 다르면 옥대표님 정정.
 *
 * 회귀 가드: 기존 matrix.js · DMJMatrix API 무수정. find-my-gear.html /
 *           style/* / riding-dashboard/* / brands index 영향 0.
 *           본 컴포넌트 = level/* 4 페이지 전용.
 * ============================================================ */
(function () {
  'use strict';

  // ─── §405 — Utility ──────────────────────────────────────
  function round5(v) { return Math.round(v * 2) / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function nearest(arr, t) {
    return arr.reduce(function (p, c) {
      return Math.abs(c - t) < Math.abs(p - t) ? c : p;
    });
  }

  // ─── §405 — Lookup tables (옥대표님 spec 1:1) ────────────
  // baseSail: kt → 75kg 기준 sail m² 베이스
  function baseSail(kt) {
    if (kt <=  8) return 7.5;
    if (kt <= 10) return 7.0;
    if (kt <= 12) return 6.0;
    if (kt <= 14) return 5.5;
    if (kt <= 16) return 5.0;
    if (kt <= 18) return 4.5;
    if (kt <= 20) return 4.0;
    if (kt <= 22) return 3.5;
    return 3.0;
  }

  // windBand: kt → { label: '미풍'|'중풍'|'강풍', pump: 추가 +L }
  //  미풍 (≤10kt) → 보드에 펌핑 마진 +6L 자동 가산
  function windBand(kt) {
    if (kt <= 10) return { label: '미풍', pump: 6 };
    if (kt <= 16) return { label: '중풍', pump: 0 };
    return                 { label: '강풍', pump: 0 };
  }

  // ─── §405 — LEVEL_CONSTANTS (옥대표님 spec 1:1 lock) ─────
  // wing.wf  = sail 곱 보정 (level 별)
  // wing.sailMin/Max = clamp 범위
  // foil.ff  = front-wing area 곱 보정
  // foil.foilMin/Cap = clamp 범위 (foilMin=0 이면 무시)
  // board.sizes = 라인업 후보 L (nearest 선택)
  // board.bv = 체중 +볼륨 추가 마진 (level 별)
  // safety = 안전장비 (옥대표님 입문만 명시 — 나머지 3 = 본인 임시, 라이브 view 후 정정)
  var LEVEL_CONSTANTS = {
    beginner: {
      wing:   { brand: 'Takoon Wing V4',           wf: 1.05, sailMin: 4.0, sailMax: 8.5 },
      foil:   { brand: 'Takoon Flow/Starter',      ff: 1.28, foilMin: 1000, foilCap: 1600 },
      board:  { brand: 'Takoon Glide',             sizes: [100, 110, 120], bv: 42 },
      safety: 'WIP Impact Vest 50N'
    },
    intermediate: {
      wing:   { brand: 'PPC M1-X',                 wf: 1.0,  sailMin: 3.5, sailMax: 8.0 },
      foil:   { brand: 'Levitaz FW (540/680/790/900)', ff: 1.0, foilMin: 0, foilCap: 1100 },
      board:  { brand: 'Takoon Glide 미드레인지',     sizes: [85, 95, 105], bv: 22 },
      safety: 'WIP Impact Vest 50N + 3/2mm Wetsuit'  /* 옥대표님 미명시 — 임시 */
    },
    advanced: {
      wing:   { brand: 'PPC M1',                   wf: 0.95, sailMin: 3.0, sailMax: 7.5 },
      foil:   { brand: 'Levitaz FW',               ff: 0.9,  foilMin: 0, foilCap: 820 },
      board:  { brand: 'Levitaz Boom FS',          sizes: [63, 83, 95], bv: 6 },
      safety: 'WIP Impact Vest 50N + 3/2mm Wetsuit'  /* 옥대표님 미명시 — 임시 */
    },
    pro: {
      wing:   { brand: 'PPC Sonic FDS',            wf: 0.95, sailMin: 3.0, sailMax: 7.0 },
      foil:   { brand: 'Levitaz R6 530',           ff: 0.85, foilMin: 0, foilCap: 620 },
      board:  { brand: 'PPC R1 레이스',              sizes: [73, 83, 93], bv: -4 },
      safety: 'WIP Race Vest + 3/2mm Wetsuit'  /* 옥대표님 미명시 — 임시 */
    }
  };

  // novice → beginner fallback (matrix.js §155 v3 정합)
  var LEVEL_BANK_FALLBACK = { novice: 'beginner' };

  function levelKey(level) { return LEVEL_BANK_FALLBACK[level] || level; }
  function getConst(level) { return LEVEL_CONSTANTS[levelKey(level)] || null; }

  // ─── §405 — Calculators (옥대표님 spec 1:1) ──────────────
  // 1) 윙 세일 (m²) — round5(baseSail × (w/75)^0.45 × wf), clamp sailMin/Max
  function calcSail(wkg, kt, level) {
    var c = getConst(level);
    if (!c) return null;
    var wAdj = Math.pow(wkg / 75, 0.45);
    var v = round5(baseSail(kt) * wAdj * c.wing.wf);
    return clamp(v, c.wing.sailMin, c.wing.sailMax);
  }

  // 2) 포일 프런트윙 area (cm²) — round(158 × w / kt × ff), clamp foilMin/Cap
  function calcFoil(wkg, kt, level) {
    var c = getConst(level);
    if (!c) return null;
    var area = Math.round(158 * wkg / kt * c.foil.ff);
    if (c.foil.foilMin > 0) area = Math.max(area, c.foil.foilMin);
    area = Math.min(area, c.foil.foilCap);
    return area;
  }

  // 3) 보드 볼륨 (L) — wkg + bv + pump, nearest from sizes[]
  function calcBoard(wkg, kt, level) {
    var c = getConst(level);
    if (!c) return null;
    var band = windBand(kt);
    var target = Math.round(wkg + c.board.bv + band.pump);
    var size = nearest(c.board.sizes, target);
    return { size: size, target: target, brand: c.board.brand, band: band.label, pump: band.pump };
  }

  // 4) 안전장비 — level 별 고정 string
  function getSafety(level) {
    var c = getConst(level);
    return c ? c.safety : null;
  }

  // ─── §403 — Style metadata (4 tile DOM 빌드용) ──────────
  // 옥대표님 verbatim 2026-06-09: "컨디션이 4가지이니까 4타일은 유지"
  // 알고리즘은 level-only (§405 spec) — style 별 동일 산출. tile 마다
  // defaultWind 가 다르므로 로드 시 4 tile 의 출력값은 자연스럽게 분기.
  var STYLES = [
    { key: 'flat-speed',      title: 'Flat·Speed',      sub: '평수면·속도 우선 — 강·내수면 flat한 컨디션',  defaultWind: 18 },
    { key: 'choppy-freeride', title: 'Choppy·Freeride', sub: '한국 일반 spot — choppy 한 freeride',         defaultWind: 14 },
    { key: 'wave',            title: 'Wave',            sub: '파도·서핑 라이딩 — wave 한국 동해안',          defaultWind: 12 },
    { key: 'hybrid',          title: 'Hybrid',          sub: '다목적 — 한 세트로 여러 컨디션',                defaultWind: 16 }
  ];

  var LEVEL_LABELS = {
    beginner:     '입문',
    novice:       '초급',
    intermediate: '중급',
    advanced:     '상급',
    pro:          '선수'
  };

  // §405 — Default 옥대표님 spec lock: wkg 68 / kt 13
  // (페이지별 customize 가능 — data-default-wkg / data-default-kt section attr)
  var SPEC_DEFAULT_WEIGHT = 68.0;
  var SPEC_DEFAULT_WIND = 13;

  // ─── §405 — Formatters ───────────────────────────────────
  function fmtWeight(kg) {
    var w = parseFloat(kg);
    if (!isFinite(w)) return '—';
    // step 0.5 라 toFixed(1) 정합 (68.0 / 68.5)
    return w.toFixed(1);
  }
  function fmtSail(m2) {
    if (m2 == null || !isFinite(m2)) return '—';
    // round5 결과는 .0 또는 .5 — toFixed(1) 로 일관 표시
    return m2.toFixed(1);
  }
  function fmtArea(cm2) {
    if (cm2 == null || !isFinite(cm2)) return '—';
    return Math.round(cm2);
  }

  // ─── §405 — Slider track fill (golden gradient JS-driven) ─
  // pct = ((kt - min) / (max - min)) * 100
  // CSS variable `--lvl-rec-fill` 가 .lvl-rec__wind 의 background-position 으로 작동.
  function updateSliderFill(input) {
    var min = parseFloat(input.min) || 4;
    var max = parseFloat(input.max) || 24;
    var val = parseFloat(input.value);
    if (!isFinite(val)) val = min;
    var pct = clamp(((val - min) / (max - min)) * 100, 0, 100);
    input.style.setProperty('--lvl-rec-fill', pct.toFixed(2) + '%');
  }

  // ─── Build a single tile DOM ─────────────────────────────
  function buildTile(style, levelKey, defaultWeight) {
    var defaultWind = style.defaultWind;
    var levelLabel = LEVEL_LABELS[levelKey] || levelKey;

    var tile = document.createElement('article');
    tile.className = 'lvl-rec__tile lvl-rec__tile--' + style.key;
    tile.setAttribute('data-style', style.key);

    var uid = 'lvlrec-' + style.key + '-' + Math.random().toString(36).slice(2, 8);
    var weightId = uid + '-w';
    var windId = uid + '-k';
    var outId = uid + '-o';

    // §404+§405 — weight input: type=number step=0.5 inputmode=decimal min=40 max=120.
    // HTML5 native spinner = 화살표 ±0.5. 모바일 = inputmode=decimal → 소수점 키패드.
    tile.innerHTML =
      '<header class="lvl-rec__tile-head">' +
        '<span class="lvl-rec__tile-eyebrow">' + levelLabel + ' · ' + style.title + '</span>' +
        '<h3 class="lvl-rec__tile-title">' + style.title + '</h3>' +
        '<p class="lvl-rec__tile-sub">' + style.sub + '</p>' +
      '</header>' +
      '<div class="lvl-rec__inputs">' +
        '<div class="lvl-rec__field">' +
          '<label class="lvl-rec__field-label" for="' + weightId + '">' +
            '체중 <span class="lvl-rec__field-value lvl-rec__num" data-readout="weight">' + fmtWeight(defaultWeight) + '</span><span class="lvl-rec__unit"> kg</span>' +
          '</label>' +
          '<input type="number" class="lvl-rec__weight lvl-rec__num" id="' + weightId + '" ' +
            'min="40" max="120" step="0.5" value="' + defaultWeight.toFixed(1) + '" ' +
            'inputmode="decimal" autocomplete="off" data-input="weight" ' +
            'aria-label="체중 (kg, 0.5kg 단위, 화살표로 ±0.5)">' +
        '</div>' +
        '<div class="lvl-rec__field">' +
          '<label class="lvl-rec__field-label" for="' + windId + '">' +
            '풍속 <span class="lvl-rec__field-value lvl-rec__num" data-readout="wind">' + defaultWind + '</span><span class="lvl-rec__unit"> kt</span>' +
          '</label>' +
          '<input type="range" class="lvl-rec__wind" id="' + windId + '" ' +
            'min="4" max="24" step="1" value="' + defaultWind + '" ' +
            'data-input="wind" ' +
            'aria-label="풍속 (knot, 4-24)" ' +
            'aria-valuemin="4" aria-valuemax="24" aria-valuenow="' + defaultWind + '">' +
        '</div>' +
      '</div>' +
      '<div class="lvl-rec__out" id="' + outId + '" data-out aria-live="polite" aria-atomic="true">' +
        '<!-- updateTile 가 동기 render — loading state 없음 (§405 spec) -->' +
      '</div>' +
      '<a href="#contact" class="lvl-rec__cta" ' +
        'data-level="' + levelKey + '" data-style="' + style.key + '" ' +
        'aria-label="' + levelLabel + ' · ' + style.title + ' 풀세트 견적 요청 — 카톡 상담으로 이동">' +
        '<strong>' + style.title + ' 풀세트 견적 요청 →</strong>' +
      '</a>';

    // 슬라이더 초기 fill
    var windInput = tile.querySelector('[data-input="wind"]');
    if (windInput) updateSliderFill(windInput);

    return tile;
  }

  // ─── §405 — Render one tile (synchronous, no loading state) ─
  function updateTile(tile, levelKey) {
    var weightInput = tile.querySelector('[data-input="weight"]');
    var windInput = tile.querySelector('[data-input="wind"]');
    var weightReadout = tile.querySelector('[data-readout="weight"]');
    var windReadout = tile.querySelector('[data-readout="wind"]');
    var out = tile.querySelector('[data-out]');

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
    windReadout.textContent = wind;
    windInput.setAttribute('aria-valuenow', String(wind));
    updateSliderFill(windInput);

    // §405 spec — 3종 모두 동기 계산
    var sail  = calcSail(weight, wind, levelKey);
    var foil  = calcFoil(weight, wind, levelKey);
    var board = calcBoard(weight, wind, levelKey);
    var safety = getSafety(levelKey);
    var c = getConst(levelKey);
    if (!c || sail == null || foil == null || !board) {
      out.innerHTML = '<div class="lvl-rec__out-error">레벨 상수 부재 — 1:1 상담 권장.</div>';
      return;
    }

    // 미풍 펌핑 +6L 배지 (≤10kt)
    var pumpBadge = board.pump > 0
      ? '<span class="lvl-rec__badge" aria-label="미풍 펌핑 추가 볼륨 +' + board.pump + 'L">미풍 펌핑 +' + board.pump + 'L</span>'
      : '';

    out.innerHTML =
      '<div class="lvl-rec__out-row">' +
        '<span><b>윙</b>' + c.wing.brand +
          ' <span class="lvl-rec__num lvl-rec__out-size">' + fmtSail(sail) + 'm²</span></span>' +
      '</div>' +
      '<div class="lvl-rec__out-row">' +
        '<span><b>포일</b>' + c.foil.brand +
          ' <span class="lvl-rec__num lvl-rec__out-size">~' + fmtArea(foil) + 'cm²</span></span>' +
      '</div>' +
      '<div class="lvl-rec__out-row">' +
        '<span><b>보드</b>' + board.brand +
          ' <span class="lvl-rec__num lvl-rec__out-size">' + board.size + 'L</span>' +
          ' <span class="lvl-rec__out-target">~' + board.target + 'L</span>' +
          (pumpBadge ? ' ' + pumpBadge : '') +
        '</span>' +
      '</div>' +
      '<div class="lvl-rec__out-row">' +
        '<span><b>안전</b>' + safety + '</span>' +
      '</div>';
  }

  // ─── Init one section: build 4 tiles, wire inputs ─────────
  function initSection(section) {
    if (section.getAttribute('data-lvl-rec-init') === '1') return;
    section.setAttribute('data-lvl-rec-init', '1');

    var lvl = section.getAttribute('data-level');
    if (!lvl) {
      console.warn('[gear-recommender §405] data-level attribute missing');
      return;
    }

    // Default override via data-default-wkg / data-default-kt (page-level customize).
    // 명시 안 되면 §405 spec default = 68.0 / 13.
    var defaultWeight = parseFloat(section.getAttribute('data-default-wkg'));
    if (!isFinite(defaultWeight) || defaultWeight < 40 || defaultWeight > 120) {
      defaultWeight = SPEC_DEFAULT_WEIGHT;
    }
    var defaultWindOverride = parseFloat(section.getAttribute('data-default-kt'));

    var grid = section.querySelector('.lvl-rec__grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'lvl-rec__grid';
      section.appendChild(grid);
    }

    STYLES.forEach(function (style) {
      // page-level override 가 있으면 모든 tile 의 default wind 동일 적용
      var s = style;
      if (isFinite(defaultWindOverride) && defaultWindOverride >= 4 && defaultWindOverride <= 24) {
        s = { key: style.key, title: style.title, sub: style.sub, defaultWind: defaultWindOverride };
      }
      var tile = buildTile(s, lvl, defaultWeight);
      grid.appendChild(tile);

      var weightInput = tile.querySelector('[data-input="weight"]');
      var windInput = tile.querySelector('[data-input="wind"]');

      // §405 spec — 로드 즉시 동기 render (loading state X)
      updateTile(tile, lvl);

      // Debounced update (typing in weight)
      var debounce = null;
      function trigger() {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          updateTile(tile, lvl);
        }, 60);
      }
      weightInput.addEventListener('input', trigger);
      windInput.addEventListener('input', trigger);
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

  // Public API — testing + future page-level customization
  window.DMJGearRecommender = {
    // §405 calculators
    calcSail: calcSail,
    calcFoil: calcFoil,
    calcBoard: calcBoard,
    getSafety: getSafety,
    // §405 utilities
    round5: round5, clamp: clamp, nearest: nearest,
    baseSail: baseSail, windBand: windBand,
    // formatters
    fmtWeight: fmtWeight, fmtSail: fmtSail, fmtArea: fmtArea,
    // constants
    LEVEL_CONSTANTS: LEVEL_CONSTANTS,
    LEVEL_LABELS: LEVEL_LABELS,
    STYLES: STYLES,
    SPEC_DEFAULT_WEIGHT: SPEC_DEFAULT_WEIGHT,
    SPEC_DEFAULT_WIND: SPEC_DEFAULT_WIND,
    // hooks
    initAll: initAll,
    updateSliderFill: updateSliderFill
  };
})();
