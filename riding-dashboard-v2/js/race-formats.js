/* ============================================================
 * race-formats.js — Windfoil RACE_FORMAT_LIBRARY + helpers
 *
 * Event-Aware Periodization System (Component A) 의 baseline data.
 * estimateRaceLoad(format, athlete, wind) 의 lookup source.
 *
 * References:
 *   · iQFOiL Class Official — Paris 2024 (iqfoilclassofficial.org)
 *   · IWSA WingFoil Racing — Competition Rules (wingfoilracing.com)
 *   · Vogiatzis, I. et al. 2002. "The physiological demands of sail
 *     pumping in Olympic level windsurfers". Eur J Appl Physiol 86(5):
 *     450-454. doi:10.1007/s00421-001-0571-3. PMID 11882931.
 *   · Vogiatzis, I. et al. 2004. "Correlation between heart rate and
 *     performance during Olympic windsurfing competition". Eur J Appl
 *     Physiol 92(1-2):91-98. doi:10.1007/s00421-003-0808-4. PMID 14991323.
 * ============================================================ */
(function (global) {
  'use strict';

  /* === RACE_FORMAT_LIBRARY ===
     Each entry: duration_min, avgHr_baseline (mid-skill), maxHr,
     z5_percent (time at >90% HRmax), TRIMP_baseline (mid-skill, medium wind). */
  var RACE_FORMAT_LIBRARY = {
    'slalom_short': {
      duration_min: 4, avgHr: 170, maxHr: 188, z5_percent: 75,
      TRIMP_baseline: 18,
      description: '슬라럼 단거리 (4분)',
      ref: 'iQFOiL slalom format + Vogiatzis 2002'
    },
    'slalom_medium': {
      duration_min: 5, avgHr: 168, maxHr: 188, z5_percent: 70,
      TRIMP_baseline: 22,
      description: '슬라럼 중거리 (5분, iQFOiL 표준)',
      ref: 'iQFOiL slalom official + Vogiatzis 2002'
    },
    'slalom_long': {
      duration_min: 6, avgHr: 165, maxHr: 186, z5_percent: 65,
      TRIMP_baseline: 25,
      description: '슬라럼 장거리 (6분, IWSA 상한)',
      ref: 'IWSA WingFoil slalom + Vogiatzis 2002'
    },
    'course_short': {
      duration_min: 10, avgHr: 158, maxHr: 180, z5_percent: 50,
      TRIMP_baseline: 38,
      description: '코스 단거리 (10분, IWSA 표준)',
      ref: 'IWSA WingFoil course race + Vogiatzis 2004'
    },
    'course_standard': {
      duration_min: 15, avgHr: 155, maxHr: 178, z5_percent: 45,
      TRIMP_baseline: 50,
      description: '코스 표준 (15분)',
      ref: 'iQFOiL course avg + Vogiatzis 2004'
    },
    'course_long': {
      duration_min: 20, avgHr: 152, maxHr: 175, z5_percent: 40,
      TRIMP_baseline: 65,
      description: '코스 장거리 (20분, iQFOiL 상한)',
      ref: 'iQFOiL course official spec'
    },
    'distance_25': {
      duration_min: 25, avgHr: 150, maxHr: 175, z5_percent: 35,
      TRIMP_baseline: 80,
      description: '디스턴스 (25분, IWSA distance race)',
      ref: 'IWSA WingFoil distance race'
    },
    'marathon_short': {
      duration_min: 45, avgHr: 148, maxHr: 170, z5_percent: 30,
      TRIMP_baseline: 145,
      description: '마라톤 단거리 (45분, IWSA 하한)',
      ref: 'IWSA WingFoil marathon min'
    },
    'marathon_standard': {
      duration_min: 60, avgHr: 145, maxHr: 168, z5_percent: 28,
      TRIMP_baseline: 190,
      description: '마라톤 표준 (60분)',
      ref: 'iQFOiL marathon 평균'
    },
    'marathon_long': {
      duration_min: 90, avgHr: 142, maxHr: 165, z5_percent: 25,
      TRIMP_baseline: 270,
      description: '마라톤 장거리 (90분, iQFOiL 상한)',
      ref: 'iQFOiL marathon spec — Olympic Marina → Frioul islands'
    },
    'medal_race': {
      duration_min: 12, avgHr: 172, maxHr: 188, z5_percent: 80,
      TRIMP_baseline: 50,
      description: '메달 레이스 단판 (12분, peak intensity)',
      ref: 'iQFOiL medal series single race (estimate)'
    },
    'medal_series_full': {
      duration_min: 36, avgHr: 170, maxHr: 188, z5_percent: 80,
      TRIMP_baseline: 145,
      description: '메달 시리즈 풀 (3 races: QF + SF + Grand Final)',
      ref: 'iQFOiL medal series — 3 back-to-back races'
    }
  };

  /* === Skill modifier (HR + TRIMP scaling) ===
     같은 race format 이라도 입문 라이더는 더 높은 % HRmax 사용 → TRIMP ↑.
     선수는 효율 좋음 → TRIMP ↓.
     Note: HR_offset 은 informational (model 산출에는 사용 안 함 — TRIMP 직접 scale). */
  var SKILL_MODIFIER = {
    '입문':     { hr_offset: +10, TRIMP_multiplier: 1.5, eta_label: 'novice' },
    '초급':     { hr_offset: +5,  TRIMP_multiplier: 1.3, eta_label: 'beginner' },
    '중급':     { hr_offset: 0,   TRIMP_multiplier: 1.0, eta_label: 'intermediate (baseline)' },
    '상급':     { hr_offset: -5,  TRIMP_multiplier: 0.9, eta_label: 'advanced' },
    '선수':     { hr_offset: -10, TRIMP_multiplier: 0.85, eta_label: 'elite' },
    '상급-선수': { hr_offset: -7,  TRIMP_multiplier: 0.88, eta_label: 'sub-elite' }
  };

  /* === Wind modifier ===
     Vogiatzis 2002: light wind 에서 pumping ↑ → z5 시간 ↑ → TRIMP ↑.
     Strong wind 에서 foiling 효율 ↑ + pumping ↓ → TRIMP ↓.
     Heavy wind 에서 control demand burst → TRIMP 약간 ↑. */
  var WIND_MODIFIER = {
    'light':  { TRIMP_multiplier: 1.15, range_kt: '8-12',  note: 'Pumping ↑ → z5 ↑' },
    'medium': { TRIMP_multiplier: 1.00, range_kt: '13-18', note: 'baseline' },
    'strong': { TRIMP_multiplier: 0.90, range_kt: '19-25', note: 'Foiling 효율 ↑, pumping ↓' },
    'heavy':  { TRIMP_multiplier: 1.05, range_kt: '26+',   note: 'Control burst ↑' }
  };

  /* === Helpers === */
  function getFormat(formatKey) {
    return RACE_FORMAT_LIBRARY[formatKey] || null;
  }
  function listFormats() {
    var out = [];
    for (var k in RACE_FORMAT_LIBRARY) {
      out.push(Object.assign({ key: k }, RACE_FORMAT_LIBRARY[k]));
    }
    return out;
  }
  function getSkillModifier(skill) {
    return SKILL_MODIFIER[skill] || SKILL_MODIFIER['중급'];
  }
  function getWindModifier(wind) {
    if (typeof wind === 'number') {
      /* 풍속 numeric 입력 → 자동 분류 */
      if (wind < 13) return WIND_MODIFIER.light;
      if (wind < 19) return WIND_MODIFIER.medium;
      if (wind < 26) return WIND_MODIFIER.strong;
      return WIND_MODIFIER.heavy;
    }
    return WIND_MODIFIER[wind] || WIND_MODIFIER.medium;
  }

  var RaceFormats = {
    LIBRARY: RACE_FORMAT_LIBRARY,
    SKILL_MODIFIER: SKILL_MODIFIER,
    WIND_MODIFIER: WIND_MODIFIER,
    getFormat: getFormat,
    listFormats: listFormats,
    getSkillModifier: getSkillModifier,
    getWindModifier: getWindModifier
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RaceFormats;
  else global.RDRaceFormats = RaceFormats;
})(typeof window !== 'undefined' ? window : globalThis);
