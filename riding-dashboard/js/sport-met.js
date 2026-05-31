/* ============================================================
 * sport-met.js — Sport classification + MET (Metabolic Equivalent) library
 *
 * Cross-modal workload 산출의 lookup table. analysis.computeWorkload()
 * 가 sportKey 로 MET 조회 → MET × duration × mass → 단일 AU 변환.
 *
 * References:
 *   · Ainsworth, B.E. et al. 2011. "2011 Compendium of Physical Activities:
 *     A Second Update of Codes and MET Values". Med Sci Sports Exerc 43(8):
 *     1575-1581. doi:10.1249/MSS.0b013e31821ece12
 *   · Herrmann, S.D. et al. 2024. "2024 Adult Compendium of Physical
 *     Activities: A third update". J Sport Health Sci 13(1):6-12.
 *     doi:10.1016/j.jshs.2023.10.010
 *   · pacompendium.com — 공식 site
 *
 * Note: windfoil / wingfoil 의 MET 값은 Ainsworth Compendium 에 없음.
 *   본 file 의 windfoil_* MET (5/7/9) 는 Danny 도메인 expert 추정.
 *   Phase 2 multi-rider HR + indirect calorimetry 로 검증 필수
 *   (sports_science_calibration_protocol.md §2-3 추가 항목).
 * ============================================================ */
(function (global) {
  'use strict';

  var SPORT_MET_LIBRARY = {
    /* === Sailing / foiling family === */
    'windfoil_light':     { met: 5,   description: '윙포일 약풍 (cruise)',
                            source: 'estimate-Danny', category: 'sailing' },
    'windfoil_moderate':  { met: 7,   description: '윙포일 중풍 (active)',
                            source: 'estimate-Danny', category: 'sailing' },
    'windfoil_strong':    { met: 9,   description: '윙포일 강풍/race',
                            source: 'estimate-Danny', category: 'sailing' },
    'windsurf':           { met: 3,   description: '윈드서핑',
                            source: 'Ainsworth 2011', category: 'sailing' },
    'sailing_leisure':    { met: 3.3, description: '세일링 leisure (Sunfish/Laser)',
                            source: 'Ainsworth 2011', category: 'sailing' },
    'sailing_race':       { met: 4.5, description: '세일링 race',
                            source: 'Ainsworth 2011', category: 'sailing' },
    'surf':               { met: 3,   description: '서핑',
                            source: 'Ainsworth 2011', category: 'sailing' },
    'surf_competition':   { met: 6,   description: '서핑 race',
                            source: 'Ainsworth 2011', category: 'sailing' },
    'sup':                { met: 6,   description: 'SUP (stand-up paddle)',
                            source: 'Ainsworth 2011', category: 'sailing' },
    'kitesurf':           { met: 5,   description: '카이트서핑',
                            source: 'Ainsworth 2011', category: 'sailing' },

    /* === Land — Running === */
    'run_easy':           { met: 6,    description: '러닝 z2 (easy)',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'run_moderate':       { met: 9.8,  description: '러닝 z3 (10 min/mile)',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'run_vigorous':       { met: 12.8, description: '러닝 z4-z5 (7.5 min/mile)',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'run_intervals':      { met: 12,   description: '러닝 인터벌',
                            source: 'Ainsworth 2011', category: 'cardio' },

    /* === Land — Cycling === */
    'cycle_leisure':      { met: 5.5,  description: '사이클 easy',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'cycle_moderate':     { met: 8,    description: '사이클 endurance (12-13.9 mph)',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'cycle_vigorous':     { met: 12,   description: '사이클 vigorous (16-19 mph)',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'cycle_hiit':         { met: 12,   description: '사이클 HIIT',
                            source: 'Ainsworth 2011', category: 'cardio' },

    /* === Land — Rowing (높은 windfoil carryover) === */
    'row_easy':           { met: 6,    description: '로잉 easy z2',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'row_moderate':       { met: 7,    description: '로잉 z2-z3 (Concept2)',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'row_vigorous':       { met: 8.5,  description: '로잉 z4+ (intervals)',
                            source: 'Ainsworth 2011', category: 'cardio' },

    /* === Land — Swimming === */
    'swim_easy':          { met: 5,    description: '수영 easy',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'swim_moderate':      { met: 6,    description: '수영 endurance',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'swim_vigorous':      { met: 10,   description: '수영 race / intervals',
                            source: 'Ainsworth 2011', category: 'cardio' },

    /* === Land — Other cardio === */
    'hike':               { met: 6,    description: '하이킹',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'walk_brisk':         { met: 4.3,  description: '빠른 걷기 (3.5 mph)',
                            source: 'Ainsworth 2011', category: 'cardio' },
    'elliptical':         { met: 5,    description: '엘립티컬 머신',
                            source: 'Ainsworth 2011', category: 'cardio' },

    /* === Strength === */
    'strength_bodyweight': { met: 3.5, description: '맨몸 운동',
                             source: 'Ainsworth 2011', category: 'strength' },
    'strength_barbell':    { met: 6,   description: '바벨/덤벨 (free weights)',
                             source: 'Ainsworth 2011', category: 'strength' },
    'strength_circuit':    { met: 8,   description: 'Circuit training',
                             source: 'Ainsworth 2011', category: 'strength' },

    /* === HIIT / metcon === */
    'hiit':                { met: 8,   description: 'HIIT / Tabata',
                             source: 'Ainsworth 2011', category: 'hiit' },
    'crossfit':            { met: 8,   description: 'CrossFit metcon',
                             source: 'Ainsworth 2011', category: 'hiit' },

    /* === Recovery / mobility === */
    'yoga':                { met: 2.5, description: '요가 (Hatha)',
                             source: 'Ainsworth 2011', category: 'recovery' },
    'yoga_vinyasa':        { met: 4,   description: '요가 (Vinyasa flow)',
                             source: 'Ainsworth 2011', category: 'recovery' },
    'pilates':             { met: 3,   description: '필라테스',
                             source: 'Ainsworth 2011', category: 'recovery' },
    'mobility':            { met: 2,   description: '모빌리티 / 폼롤러',
                             source: 'Ainsworth 2011', category: 'recovery' },
    'stretching':          { met: 2.3, description: '스트레칭',
                             source: 'Ainsworth 2011', category: 'recovery' }
  };

  /* Intensity zone classification (Seiler 80/20 polarized).
     본 분류는 MET 만 기반 — HR zone 없이 sport key 로 빠른 LIT/threshold/HIT 분기.
     실 sessions 의 zone 분포는 HR series 기반이 더 정확 (Phase 2 개선). */
  function intensityZone(sportKey) {
    var s = SPORT_MET_LIBRARY[sportKey];
    if (!s) return null;
    if (s.met <= 4) return 'recovery';
    if (s.met <= 6) return 'LIT';        /* < VT1 — aerobic base, polarized 80% */
    if (s.met <= 9) return 'threshold';  /* VT1-VT2 — "black hole", 회피 영역 */
    return 'HIT';                         /* > VT2 — VO2max + anaerobic, polarized 20% */
  }

  /* Windfoil 와의 carryover factor (sport-specific transfer of training).
     0-1 scale. 1 = perfect transfer, 0 = none.
     Reference: Tanaka 1994 (Sports Med 18(5):330-339) — cross-training
       fitness transfer between cycling/running/swimming.
       windfoil 값은 Danny 도메인 추정 — Phase 2 검증. */
  var WINDFOIL_CARRYOVER = {
    /* 같은 sport (high) */
    windfoil_light: 1.0, windfoil_moderate: 1.0, windfoil_strong: 1.0,
    windsurf: 0.90, kitesurf: 0.80, sailing_leisure: 0.55, sailing_race: 0.60,
    surf: 0.50, surf_competition: 0.55, sup: 0.65,
    /* Rowing — 가장 높은 land carryover (upper body + core, isometric grip) */
    row_easy: 0.70, row_moderate: 0.75, row_vigorous: 0.70,
    /* Running */
    run_easy: 0.60, run_moderate: 0.55, run_vigorous: 0.50, run_intervals: 0.50,
    /* Cycling */
    cycle_leisure: 0.50, cycle_moderate: 0.55, cycle_vigorous: 0.50, cycle_hiit: 0.50,
    /* Swimming — upper body transfer 좋으나 leg 차이 */
    swim_easy: 0.55, swim_moderate: 0.60, swim_vigorous: 0.55,
    /* Other cardio */
    hike: 0.45, walk_brisk: 0.35, elliptical: 0.50,
    /* Strength — specific to windfoil holding posture */
    strength_bodyweight: 0.55, strength_barbell: 0.60, strength_circuit: 0.55,
    /* HIIT */
    hiit: 0.45, crossfit: 0.55,
    /* Recovery */
    yoga: 0.30, yoga_vinyasa: 0.35, pilates: 0.40,
    mobility: 0.25, stretching: 0.20
  };

  function getMET(sportKey) {
    var s = SPORT_MET_LIBRARY[sportKey];
    return s ? s.met : null;
  }
  function getSport(sportKey) {
    return SPORT_MET_LIBRARY[sportKey] || null;
  }
  function getCarryover(sportKey) {
    return WINDFOIL_CARRYOVER[sportKey] != null ? WINDFOIL_CARRYOVER[sportKey] : 0.50;
  }
  function listByCategory(category) {
    var out = [];
    for (var k in SPORT_MET_LIBRARY) {
      if (SPORT_MET_LIBRARY[k].category === category) {
        out.push(Object.assign({ key: k }, SPORT_MET_LIBRARY[k]));
      }
    }
    return out;
  }

  var SportMET = {
    LIBRARY: SPORT_MET_LIBRARY,
    WINDFOIL_CARRYOVER: WINDFOIL_CARRYOVER,
    getMET: getMET,
    getSport: getSport,
    getCarryover: getCarryover,
    intensityZone: intensityZone,
    listByCategory: listByCategory
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SportMET;
  else global.RDSportMET = SportMET;
})(typeof window !== 'undefined' ? window : globalThis);
