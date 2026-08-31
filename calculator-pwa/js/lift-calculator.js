/* ==========================================================================
   단무지 — Lift Calculator MVP v2
   DO_NOT_REVERT §102 / §103 / §123

   물리 모델:
   L = 0.5 * ρ * V² * A * CL  (lift equation)
   takeoff 임계: L >= (M_rider + M_gear) * g
   → V_min = sqrt( 2 * M_total * g / (ρ * A * CL) )
   knots → m/s :  m_per_s = knots * 0.5144
   m/s → knots :  knots = m_per_s * 1.94384

   가정값 (Danny 검수 후 정정 가능 — DO_NOT_REVERT §103 / §123):
   - ρ_sea (해수)   = 1025 kg/m³ (염도 ~35‰)
   - ρ_fresh (민물) = 1000 kg/m³ (강·호수)
     → 민물에서 같은 lift 위해 v_min ∝ 1/√ρ → 약 +1.2% v_min
   - g = 9.81 m/s²
   - M_gear = 10 kg (착용 장비 default — §117 사용자 input override 가능)
   - CL by AR class:
       low_ar  (AR<5)  → 1.15  (forgiving·고양력)
       mid_ar  (5~8)    → 1.00  (general)
       high_ar (AR>8)  → 0.85  (race·thin)
   - 펌핑 인자 (V_target = V_min * pump_factor * surface_factor):
       easy     → 1.15  (충분한 여유)
       moderate → 1.05  (적정)
       hard     → 0.95  (한계 takeoff — 펌핑 필요)
   - 수면 상태 인자 (V_target multiplier — §123 · §124 swell-assist 정정):
       flat    → 1.00  (평수면 baseline)
       choppy  → 1.05  (잔물결 — drag 증가, lift 손실 ~5%)
       swell   → 0.95  (너울 — swell face 활강 = 중력 어시스트, takeoff·glide 쉬워짐)
       mixed   → 1.00  (초피 + 너울 — 너울 어시스트 ≈ 초피 페널티 상쇄, 거의 중립)
   - 풍속 → 글라이딩 속도 변환은 다양한 변수 (apparent wind·라이더 효율) 영향
     → 본 calc는 '풍속 ≈ 글라이딩 속도' 단순 가정 (입문·초급 직관 우선)
   ========================================================================== */
(function (global) {
  'use strict';

  var CONST = {
    RHO_SEA: 1025,      // kg/m³ (해수 default)
    RHO_FRESH: 1000,    // kg/m³ (민물 — 강·호수)
    G: 9.81,            // m/s²
    GEAR_MASS: 10,      // kg default (슈트·하네스·헬멧·임팩트자켓 합계 추정 — DO_NOT_REVERT §117 사용자 input override 가능)
    KT_TO_MS: 0.5144,
    MS_TO_KT: 1.94384
  };

  var PUMPING_FACTOR = {
    easy: 1.15,
    moderate: 1.05,
    hard: 0.95
  };

  // 수면 상태 → V_target multiplier (DO_NOT_REVERT §123 · §124 swell-assist 정정)
  // §124 (Danny 2026-05-15): 너울은 swell face 활강으로 takeoff·글라이딩이 쉬워짐
  // (다운윈드 포일링 원리) → 페널티(>1)가 아니라 어시스트(<1). 초피+너울은 상쇄 ≈ 중립.
  var SURFACE_FACTOR = {
    flat: 1.00,
    choppy: 1.05,
    swell: 0.95,   // §124 — swell-assisted takeoff/glide (was 1.03)
    mixed: 1.00    // §124 — swell assist ≈ chop penalty 상쇄 (was 1.08)
  };

  // CL by aspect ratio class
  function getCL(ar) {
    if (typeof ar !== 'number' || isNaN(ar) || ar <= 0) return 1.0;
    if (ar < 5) return 1.15;
    if (ar > 8) return 0.85;
    return 1.0;
  }

  function getARClass(ar) {
    if (ar < 5) return 'low_ar';
    if (ar > 8) return 'high_ar';
    return 'mid_ar';
  }

  // 물 밀도 lookup (water_type → ρ kg/m³)
  function getRho(waterType) {
    return waterType === 'fresh' ? CONST.RHO_FRESH : CONST.RHO_SEA;
  }

  // 수면 상태 보정 인자
  function getSurfaceFactor(surface) {
    var f = SURFACE_FACTOR[surface];
    return (typeof f === 'number') ? f : SURFACE_FACTOR.flat;
  }

  // takeoff 임계 글라이딩 속도 (m/s) — ρ 파라미터화
  // gearKg = 슈트·하네스·헬멧·임팩트자켓 등 착용 장비 합계 (default GEAR_MASS=10)
  function vMinMs(riderKg, frontWingAreaCm2, cl, gearKg, rho) {
    var areaM2 = frontWingAreaCm2 / 10000;
    var gear = (typeof gearKg === 'number' && gearKg >= 0) ? gearKg : CONST.GEAR_MASS;
    var totalKg = riderKg + gear;
    var density = (typeof rho === 'number' && rho > 0) ? rho : CONST.RHO_SEA;
    if (areaM2 <= 0 || totalKg <= 0 || cl <= 0) return Infinity;
    return Math.sqrt(2 * totalKg * CONST.G / (density * areaM2 * cl));
  }

  // 풍속 등급 → ±1 사이즈 분기 (reference_dmj_wind_classification)
  function windTier(windKt) {
    if (windKt <= 10) return 'light';   // 미풍 — wing 한 사이즈 ↑
    if (windKt >= 17) return 'strong';  // 강풍 — wing 한 사이즈 ↓
    return 'moderate';                   // 중풍 — site default
  }

  // 윙 사이즈 추천 (체중 + 풍속 → m²)
  // Takoon V4 size guide (reference_takoon_wing_size_guide) 기반 단순화
  function recommendWingSize(riderKg, windKt) {
    var base;
    if (riderKg < 60) base = 4.0;
    else if (riderKg < 75) base = 5.0;
    else if (riderKg < 85) base = 5.5;
    else base = 6.0;
    var tier = windTier(windKt);
    if (tier === 'light') base += 0.5;
    if (tier === 'strong') base -= 0.5;
    return Math.round(base * 2) / 2; // 0.5 step
  }

  /**
   * 메인 산출
   * @param {Object} input
   *   rider_kg: number
   *   board_volume_l: number
   *   front_wing_area_cm2: number
   *   front_wing_ar: number (옵션 — 없으면 mid_ar default)
   *   wind_kt: number
   *   pumping: 'easy'|'moderate'|'hard'
   *   gear_kg: number (옵션 — default 10)
   *   water_type: 'sea'|'fresh' (옵션 — default 'sea', §123)
   *   surface: 'flat'|'choppy'|'swell'|'mixed' (옵션 — default 'flat', §123)
   * @returns {Object} result
   */
  function calculate(input) {
    var rider = Number(input.rider_kg) || 0;
    var area = Number(input.front_wing_area_cm2) || 0;
    var ar = Number(input.front_wing_ar) || 6.5;
    var wind = Number(input.wind_kt) || 12;
    var pumping = input.pumping || 'moderate';
    var pf = PUMPING_FACTOR[pumping] || PUMPING_FACTOR.moderate;
    // gear_kg: 슈트·하네스·헬멧·임팩트자켓 등 착용 장비 합계 (default 10kg — DO_NOT_REVERT §117)
    var gear = (input.gear_kg != null && !isNaN(Number(input.gear_kg)) && Number(input.gear_kg) >= 0)
      ? Number(input.gear_kg) : CONST.GEAR_MASS;
    // water_type / surface — §123
    var waterType = (input.water_type === 'fresh') ? 'fresh' : 'sea';
    var rho = getRho(waterType);
    var surface = (typeof input.surface === 'string' && SURFACE_FACTOR[input.surface] != null)
      ? input.surface : 'flat';
    var sf = getSurfaceFactor(surface);

    var cl = getCL(ar);
    var vmin_ms = vMinMs(rider, area, cl, gear, rho);
    var vtarget_ms = vmin_ms * pf * sf;
    var vmin_kt = vmin_ms * CONST.MS_TO_KT;
    var vtarget_kt = vtarget_ms * CONST.MS_TO_KT;
    var feasible = vtarget_kt <= wind + 3; // 풍속 + 3kt 여유 (apparent wind 추정)

    var wingSize = recommendWingSize(rider, wind);

    return {
      input: { rider: rider, area_cm2: area, ar: ar, wind_kt: wind, pumping: pumping, gear_kg: gear, water_type: waterType, surface: surface },
      cl: cl,
      ar_class: getARClass(ar),
      pumping_factor: pf,
      surface_factor: sf,
      water_type: waterType,
      surface: surface,
      rho: rho,
      vmin_ms: round1(vmin_ms),
      vmin_kt: round1(vmin_kt),
      vtarget_ms: round1(vtarget_ms),
      vtarget_kt: round1(vtarget_kt),
      wind_tier: windTier(wind),
      wing_size_m2: wingSize,
      feasible: feasible,
      gear_kg: gear,
      total_mass_kg: rider + gear,
      area_m2: area / 10000
    };
  }

  function round1(x) {
    if (!isFinite(x)) return null;
    return Math.round(x * 10) / 10;
  }

  // ── Self-test (console.assert) ──
  function runSelfTest() {
    var tests = 0, passed = 0, failed = [];
    function check(name, cond) {
      tests++;
      if (cond) { passed++; }
      else { failed.push(name); }
    }

    // 1) 70kg 라이더 + 1200cm² mid-AR + moderate pump → 합리적 v_min
    var r1 = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 12, pumping: 'moderate' });
    check('70kg/1200cm²/AR6.5: v_min between 4-7 kt', r1.vmin_kt > 4 && r1.vmin_kt < 7);
    check('70kg/1200cm²: feasible at 12kt', r1.feasible === true);
    check('70kg: wing 5.0m² at moderate wind', r1.wing_size_m2 === 5.0);

    // 2) 라이더 작은 (어린이 35kg) — vmin 더 낮음
    var r2 = calculate({ rider_kg: 35, front_wing_area_cm2: 1500, front_wing_ar: 4.0, wind_kt: 8, pumping: 'easy' });
    check('35kg/1500cm² light wind: vmin lower', r2.vmin_kt < r1.vmin_kt);

    // 3) 라이더 큰 (100kg) — vmin 높음
    var r3 = calculate({ rider_kg: 100, front_wing_area_cm2: 800, front_wing_ar: 7.0, wind_kt: 15, pumping: 'hard' });
    check('100kg/800cm²: vmin > 70kg case', r3.vmin_kt > r1.vmin_kt);
    check('100kg+small wing+hard pump in 15kt: feasible', r3.feasible === true);

    // 4) AR class 분류
    check('AR 4.0 = low_ar', getARClass(4.0) === 'low_ar');
    check('AR 6.5 = mid_ar', getARClass(6.5) === 'mid_ar');
    // §170 v7 NOTE: 9.5 here = high_ar class boundary test, NOT R6 spec (R6 actual AR 13.7/12.9/14.3).
    check('AR 9.5 = high_ar (class boundary test)', getARClass(9.5) === 'high_ar');
    check('AR 13.7 = high_ar (R6 V1 actual)', getARClass(13.7) === 'high_ar');
    check('CL low_ar = 1.15', getCL(4.0) === 1.15);
    check('CL high_ar = 0.85', getCL(13.7) === 0.85);

    // 5) 풍속 분류
    check('windTier 8kt = light', windTier(8) === 'light');
    check('windTier 13kt = moderate', windTier(13) === 'moderate');
    check('windTier 20kt = strong', windTier(20) === 'strong');

    // 6) 윙 사이즈 ±1
    check('70kg light wind +0.5m²', recommendWingSize(70, 8) === 5.5);
    check('70kg strong wind -0.5m²', recommendWingSize(70, 20) === 4.5);

    // 7) gear_kg input override (§117) — 더 무거운 장비는 v_min 더 높아져야
    var rDefault = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 12, pumping: 'moderate' });
    var rHeavy = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 12, pumping: 'moderate', gear_kg: 18 });
    check('gear_kg=18 → vmin > default(10)', rHeavy.vmin_kt > rDefault.vmin_kt);
    check('gear_kg=18 → total_mass = 88kg', rHeavy.total_mass_kg === 88);
    check('gear_kg 미지정 → default 10kg', rDefault.gear_kg === 10);

    // 8) water_type — 민물(1000) v_min > 바다(1025) v_min (§123)
    var rSeaFlat = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate', water_type: 'sea', surface: 'flat' });
    var rFreshFlat = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate', water_type: 'fresh', surface: 'flat' });
    check('Case A (sea+flat): rho=1025', rSeaFlat.rho === 1025);
    check('Case B (fresh+flat): rho=1000', rFreshFlat.rho === 1000);
    check('Case B v_min > Case A v_min (민물 +)', rFreshFlat.vmin_kt > rSeaFlat.vmin_kt);
    // 비율 검증: v_min(fresh)/v_min(sea) ≈ √(1025/1000) ≈ 1.0124
    var ratioBA = rFreshFlat.vmin_kt / rSeaFlat.vmin_kt;
    check('민물/바다 v_min 비율 ≈ 1.012 (±0.5%)', Math.abs(ratioBA - 1.01242) < 0.005);

    // 9) surface factor — choppy/swell/mixed v_target multiplier (§123)
    var rSeaChoppy = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate', water_type: 'sea', surface: 'choppy' });
    var rSeaSwell = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate', water_type: 'sea', surface: 'swell' });
    var rSeaMixed = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate', water_type: 'sea', surface: 'mixed' });
    // §124 — swell-assist 정정: swell 0.95 (어시스트), mixed 1.00 (중립)
    check('flat surface_factor = 1.00', rSeaFlat.surface_factor === 1.00);
    check('choppy surface_factor = 1.05', rSeaChoppy.surface_factor === 1.05);
    check('swell surface_factor = 0.95 (§124 swell-assist)', rSeaSwell.surface_factor === 0.95);
    check('mixed surface_factor = 1.00 (§124 상쇄 중립)', rSeaMixed.surface_factor === 1.00);
    // §124 — v_target 순서: swell < flat = mixed < choppy (너울이 가장 쉬움)
    check('v_target 순서: swell < flat ≤ mixed < choppy',
      rSeaSwell.vtarget_kt < rSeaFlat.vtarget_kt &&
      rSeaFlat.vtarget_kt <= rSeaMixed.vtarget_kt &&
      rSeaMixed.vtarget_kt < rSeaChoppy.vtarget_kt);
    check('swell 이 flat 보다 v_target 낮음 (takeoff 쉬움)', rSeaSwell.vtarget_kt < rSeaFlat.vtarget_kt);
    // Case D: 민물 + mixed → Case A보다 ~+1.2% v_target (1.0124 × 1.00 ≈ 1.0124)
    var rFreshMixed = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate', water_type: 'fresh', surface: 'mixed' });
    var ratioDA = rFreshMixed.vtarget_kt / rSeaFlat.vtarget_kt;
    check('Case D (민물+mixed) v_target ≈ Case A × 1.012 (±1%)', Math.abs(ratioDA - 1.0124) < 0.01);

    // 10) default 동작 — water_type/surface 미지정 → sea/flat
    var rDefaultWS = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate' });
    check('water_type 미지정 → sea default', rDefaultWS.water_type === 'sea');
    check('surface 미지정 → flat default', rDefaultWS.surface === 'flat');

    // 11) invalid surface fallback to flat
    var rBadSurface = calculate({ rider_kg: 70, front_wing_area_cm2: 1200, front_wing_ar: 6.5, wind_kt: 13, pumping: 'moderate', surface: 'tsunami' });
    check('invalid surface → flat fallback', rBadSurface.surface === 'flat' && rBadSurface.surface_factor === 1.00);

    // 12) §175 — recommendTakeoffWing: 부상 가능 윙 사이즈 역산
    // Danny screenshot 케이스 (70kg+10kg gear, R6 V1 479cm² AR13.7, 8kt, moderate, sea, flat)
    var recDanny = recommendTakeoffWing({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 479, front_wing_ar: 13.7,
      wind_kt: 8, pumping: 'moderate', water_type: 'sea', surface: 'flat'
    });
    check('§175: Danny screenshot 케이스 → needed=true', recDanny.needed === true);
    check('§175: Danny 케이스 → 추천 size 6.5~7.0 m² 범위',
      recDanny.recommended_size_m2 != null &&
      recDanny.recommended_size_m2 >= 6.5 && recDanny.recommended_size_m2 <= 7.0);
    check('§175: Danny 케이스 → extreme=false (lineup 내 해결)', recDanny.extreme === false);

    // §175: feasible 케이스에서는 needed=false
    var recFeas = recommendTakeoffWing({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 1200, front_wing_ar: 6.5,
      wind_kt: 13, pumping: 'moderate', water_type: 'sea', surface: 'flat'
    });
    check('§175: feasible 케이스 → needed=false', recFeas.needed === false);

    // §175: 극단 케이스 (Danny foil + 5kt 풍속) → 어떤 윙으로도 안 됨
    var recExt = recommendTakeoffWing({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 479, front_wing_ar: 13.7,
      wind_kt: 5, pumping: 'moderate', water_type: 'sea', surface: 'flat'
    });
    check('§175: 5kt 극단 케이스 → extreme=true', recExt.extreme === true);
    check('§175: 극단 케이스 → min_wind_kt 산출됨',
      typeof recExt.min_wind_kt === 'number' && recExt.min_wind_kt > 5);
    check('§175: 극단 케이스 → min_foil_area_cm2 > 현재 479',
      typeof recExt.min_foil_area_cm2 === 'number' && recExt.min_foil_area_cm2 > 479);

    /* §176 (Danny 2026-05-16) — 풍상 45° 진행 속도 검증 */
    // 13) 상급 라이더 (η=0.88, tack=45°) — Danny 기대 풍상 8-10 kt 구간 진입
    var up_advanced = upwindSpeed({
      v_wind_kt: 10, m_rider_kg: 70, gear_kg: 10, skill: '상급',
      foil_ar: 6.5, wing_area_m2: 5.0, wing_ar: 4.5
    });
    check('§176: 상급 10kt 5.0m² feasible', up_advanced.feasible === true);
    /* §483 — 이 케이스(10kt · 5.0㎡ · 80kg all-up)는 **의도적으로 언더파워**다.
       옥대표 실사용표는 10kt 이하에서 6.5㎡ 다. 몸 항력을 넣기 전 모델은
       이 언더파워 조합에도 8kt 이상을 냈고, 옛 검사는 그 낙관을 그대로
       못박고 있었다. 지금은 4.7kt — 사실상 포일이 안 뜨는 영역이고 그게
       맞다. 그래서 '합리적 범위' 검사는 **제대로 크기를 맞춘 윙**으로 옮긴다. */
    var up_sized = upwindSpeed({
      v_wind_kt: 10, m_rider_kg: 70, gear_kg: 10, skill: '상급',
      foil_ar: 6.5, wing_area_m2: 6.5, wing_ar: 4.5
    });
    check('§483: 상급 10kt 6.5㎡(적정 사이즈) 풍상 속도 8-22 kt',
      up_sized.V_boat_kt >= 8 && up_sized.V_boat_kt <= 22);
    check('§483: 언더파워(5.0㎡)는 적정(6.5㎡)보다 느리다',
      up_advanced.V_boat_kt < up_sized.V_boat_kt);
    check('§483: 상급 tack 58° (실측 기반)', up_advanced.tack_angle_deg === 58);

    // 14) 선수 라이더 (η=0.95, tack=42°) > 상급
    var up_pro = upwindSpeed({
      v_wind_kt: 10, m_rider_kg: 70, gear_kg: 10, skill: '선수',
      foil_ar: 6.5, wing_area_m2: 5.0, wing_ar: 4.5
    });
    // §176-E (2026-05-16): TWA 5° 균등 변경 후 SOG 비교는 invalid (서로 다른 tack 각).
    // race-context 표준 = VMG (Velocity Made Good upwind) 로 monotonicity 검증.
    check('§176-E: 선수 풍상 VMG > 상급 VMG (스킬 ↑ → VMG ↑)',
      up_pro.V_vmg_kt > up_advanced.V_vmg_kt);
    check('§483: 선수 tack 56° (Formula Kite T1 50.6° 보다 넓게)',
      up_pro.tack_angle_deg === 56);

    // 15) 입문 (η=0.45, tack=60°) — 10kt 5m² 로 풍상 불가 또는 매우 낮음
    var up_novice = upwindSpeed({
      v_wind_kt: 10, m_rider_kg: 70, gear_kg: 10, skill: '입문',
      foil_ar: 6.5, wing_area_m2: 5.0, wing_ar: 4.5
    });
    // §176-E: VMG 기준 monotonicity (동일 이유 — SOG 비교는 다른 tack 각이라 invalid).
    check('§176-E: 입문 풍상 VMG < 상급 VMG (스킬 ↓ → VMG ↓)',
      up_novice.V_vmg_kt < up_advanced.V_vmg_kt);
    check('§483: 입문 tack 78°', up_novice.tack_angle_deg === 78);

    // 16) 풍속 ↑ → 풍상 속도 ↑
    var up_strong_wind = upwindSpeed({
      v_wind_kt: 18, m_rider_kg: 70, gear_kg: 10, skill: '상급',
      foil_ar: 6.5, wing_area_m2: 5.0, wing_ar: 4.5
    });
    check('§176: 풍속 ↑ (18kt) → 풍상 속도 ↑',
      up_strong_wind.V_boat_kt > up_advanced.V_boat_kt);

    // 17) 사이즈 sensitivity — 4.5 < 5.0 < 5.5 단조성 (overpower 직전까지)
    var sens = upwindSensitivity({
      v_wind_kt: 10, m_rider_kg: 70, gear_kg: 10, skill: '상급',
      foil_ar: 6.5, wing_area_m2: 5.0, wing_ar: 4.5
    });
    check('§176: sensitivity base feasible', sens.base.feasible === true);
    check('§176: 4.5m² 풍상 속도 ≤ 5.0m²',
      sens.smaller.V_boat_kt <= sens.base.V_boat_kt);
    check('§176: 5.5m² 풍상 속도 ≥ 5.0m² (overpower 전)',
      sens.larger.V_boat_kt >= sens.base.V_boat_kt - 0.5);
    check('§176: delta_smaller ≤ 0 (작은 윙 → 느림)',
      sens.delta_smaller_kt <= 0);

    // 18) V_apparent > V_true (풍상 tack 에서 항상 성립)
    check('§176: V_app > V_t (apparent wind boost)',
      up_advanced.V_apparent_kt > 10);

    // 19) VMG = V_boat × cos(tack) — geometry
    var expectedVmg = up_advanced.V_boat_kt * Math.cos(up_advanced.tack_angle_deg * Math.PI / 180);
    check('§176: VMG = V_boat × cos(tack) 검증',
      Math.abs(up_advanced.V_vmg_kt - expectedVmg) < 0.15);

    // 20) Invalid input handling
    var up_bad = upwindSpeed({
      v_wind_kt: 0, m_rider_kg: 70, skill: '상급', foil_ar: 6.5, wing_area_m2: 5.0
    });
    check('§176: invalid input (V_t=0) → error', up_bad.error === 'invalid_input');

    /* §177 — recommendMinFeasibleWingSize 검증 (항상 호출, 부상 가능 최소) */
    // 21) Danny screenshot 케이스: 8kt + 보통수준 → 라인업 7.0 m²
    var minFeas1 = recommendMinFeasibleWingSize({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 479, front_wing_ar: 13.7,
      wind_kt: 8, pumping: 'moderate', water_type: 'sea', surface: 'flat'
    });
    check('§177: Danny screenshot (8kt 보통) → 7.0 m² 추천',
      minFeas1.recommended_size_m2 === 7.0);
    check('§177: margin_kt > 0 (여유 양수)', minFeas1.margin_kt > 0);

    // 22) 강풍 + 작은 foil → 작은 사이즈 추천
    var minFeas2 = recommendMinFeasibleWingSize({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 1200, front_wing_ar: 6.5,
      wind_kt: 20, pumping: 'moderate', water_type: 'sea', surface: 'flat'
    });
    check('§177: 20kt 중간 foil → 작은 사이즈 (≤ 4.0)',
      minFeas2.recommended_size_m2 != null && minFeas2.recommended_size_m2 <= 4.0);

    // 23) 극단 케이스 (5kt + race foil) → extreme + min_wind 안내
    var minFeas3 = recommendMinFeasibleWingSize({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 479, front_wing_ar: 13.7,
      wind_kt: 5, pumping: 'moderate', water_type: 'sea', surface: 'flat'
    });
    check('§177: 5kt 극단 → extreme', minFeas3.extreme === true);
    check('§177: 극단 시 min_wind_kt 산출',
      typeof minFeas3.min_wind_kt === 'number' && minFeas3.min_wind_kt > 5);

    // 24) 펌핑 스킬 비교: 마스터수준(hard) > 보통(moderate) > 거의못함(easy) (작은 사이즈 가능)
    var minFeasMaster = recommendMinFeasibleWingSize({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 479, front_wing_ar: 13.7,
      wind_kt: 10, pumping: 'hard', water_type: 'sea', surface: 'flat'
    });
    var minFeasNormal = recommendMinFeasibleWingSize({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 479, front_wing_ar: 13.7,
      wind_kt: 10, pumping: 'moderate', water_type: 'sea', surface: 'flat'
    });
    var minFeasPoor = recommendMinFeasibleWingSize({
      rider_kg: 70, gear_kg: 10, front_wing_area_cm2: 479, front_wing_ar: 13.7,
      wind_kt: 10, pumping: 'easy', water_type: 'sea', surface: 'flat'
    });
    check('§177: 펌핑 마스터수준 ≤ 보통수준 ≤ 거의못함 (사이즈 순)',
      minFeasMaster.recommended_size_m2 <= minFeasNormal.recommended_size_m2 &&
      minFeasNormal.recommended_size_m2 <= minFeasPoor.recommended_size_m2);

    return { tests: tests, passed: passed, failed: failed };
  }

  /* ────────────────────────────────────────────────────────────────────────
     §175 (Danny 2026-05-16) — 부상 가능 윙 사이즈 역산
     DO_NOT_REVERT §175.

     문제: 기존 feasibility 조건 `v_target_kt ≤ wind_kt + 3` 은 wing 사이즈에
     독립적 → takeoff 실패 시 "어떤 윙으로 바꾸면 되는지" 직접 안 보여줌.

     해결: wing-aware apparent-wind boost 모델 도입.
       boost(W) = max(0.5, W − 2)  [kt]
       - W = 5.0 m² 기준에서 boost = 3 kt → 기존 "+3 kt" baseline 과 일치
       - 1 m² 증가 → boost +1 kt (펌핑 power ↑ effective apparent wind ↑)
       - 하한 0.5 kt (소형 윙도 최소한의 자체 추진은 가능)

     역산 절차:
       1) v_target_kt (precise, 미반올림) 계산
       2) deficit = v_target_kt − wind_kt
       3) min_wing = max(2.5, deficit + 2)
       4) WING_LINEUP_M2 에서 ≥ min_wing 인 최소 사이즈 선택
       5) 라인업 max(7.4) 로도 부족하면 extreme case:
          • min_wind_kt = v_target_kt − (max_wing − 2)
          • min_foil_area_cm2: lift eq 역산 (max_wing 사용 시 feasibility 만족)

     Danny screenshot 검증 (70kg+10kg, R6 V1 479cm²/AR13.7, 8kt, moderate, sea/flat):
       v_target = 12.52 kt → deficit 4.52 → min_wing 6.52 → 라인업 → 7.0 m² ✓
     ──────────────────────────────────────────────────────────────────────── */

  // 사이트가 보유한 윙 사이즈 라인업 (Levitaz/Takoon/PPC 등 통합)
  var WING_LINEUP_M2 = [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.4];

  // Apparent-wind boost 모델 — wing 사이즈별 effective 풍속 가산값 (kt)
  function windBoostKt(wingM2) {
    if (!isFinite(wingM2) || wingM2 <= 0) return 0;
    return Math.max(0.5, wingM2 - 2);
  }

  /* §178 (Danny 2026-05-16) — Control Comfort Floor
     DO_NOT_REVERT §178.

     Problem: windBoostKt = max(0.5, A − 2) 는 선형·풍속독립. deficit 가 작으면
     (e.g., 9.5 kt + master pumping → deficit 1.83 kt) 작은 윙이 통과 → 비현실적.

     Fix: industry size chart 스타일 floor 적용 — 풍속별 안정 라이딩 최소 사이즈.
     Sources: Cabrinha/Duotone/Naish 일반 권장 (80 kg 라이더, all-around freeride).
       풍속 ≤ 7: 7.5 m² · 8: 7.0 · 10: 6.0 · 13: 5.0 · 16: 4.0 · 20: 3.5 · 25+: 3.0
     Linear fit: floor_80kg = max(3.0, 9.0 − 0.3·V_kt).
     Mass scaling: floor(M) = floor_80kg × (M_total / 80).

     recommendMinFeasibleWingSize() 에서 boost-based min 과 max 취함:
       final_min = max(deficit + 2, controlComfortFloor)
     ──────────────────────────────────────────────────────────────────────── */
  function controlComfortFloor(mTotalKg, windKt, pumping) {
    if (!isFinite(windKt) || windKt <= 0 || !isFinite(mTotalKg) || mTotalKg <= 0) return 0;
    var base80 = Math.max(3.0, 9.0 - 0.3 * windKt);   // 80kg 라이더 기준
    var massScale = mTotalKg / 80;
    // §178b (Danny 2026-05-16) — pumping skill scale:
    //   마스터수준 (hard): 0.85 → 작은 윙 컨트롤 능숙
    //   보통수준 (moderate): 1.00 → industry chart 기본값
    //   거의 못함 (easy):    1.15 → 큰 안전 마진 (gust/lull buffer 필요)
    var pumpScale = (pumping === 'hard') ? 0.85
                  : (pumping === 'easy') ? 1.15
                  : 1.00;
    return Math.max(2.5, base80 * massScale * pumpScale);
  }

  /* §177 (Danny 2026-05-16) — 추천 윙 사이즈 (부상 가능 최소, 항상 호출)
     DO_NOT_REVERT §177.

     기존 wing_size_m2 는 체중·풍속 lookup (foil·스킬·물·수면 무시) → "기준" 일 뿐.
     Danny 요청: 실제 입력 조합에서 부상 가능한 최소 윙 사이즈를 추천.

     알고리즘:
       1) v_target_kt_precise = v_min × pumping_factor × surface_factor
       2) 라인업 [3.0, 3.5, ..., 7.4] 를 작은 순으로 sweep
       3) 각 사이즈에 대해 threshold = wind_kt + windBoostKt(size)
       4) v_target_precise ≤ threshold 인 첫 사이즈 = 추천 사이즈
       5) 라인업 max 로도 안 되면 extreme → min_wind / min_foil_area 안내
     ──────────────────────────────────────────────────────────────────────── */
  function recommendMinFeasibleWingSize(input) {
    var rider = Number(input.rider_kg) || 0;
    var area = Number(input.front_wing_area_cm2) || 0;
    var ar = Number(input.front_wing_ar) || 6.5;
    var pumping = input.pumping || 'moderate';
    var pf = PUMPING_FACTOR[pumping] || PUMPING_FACTOR.moderate;
    var gear = (input.gear_kg != null && !isNaN(Number(input.gear_kg)) && Number(input.gear_kg) >= 0)
      ? Number(input.gear_kg) : CONST.GEAR_MASS;
    var waterType = (input.water_type === 'fresh') ? 'fresh' : 'sea';
    var rho = getRho(waterType);
    var surface = (typeof input.surface === 'string' && SURFACE_FACTOR[input.surface] != null)
      ? input.surface : 'flat';
    var sf = getSurfaceFactor(surface);
    var cl = getCL(ar);
    var windKt = Number(input.wind_kt) || 12;
    var mTotal = rider + gear;

    var vmin_ms = vMinMs(rider, area, cl, gear, rho);
    var vtarget_ms = vmin_ms * pf * sf;
    var vtarget_kt_precise = vtarget_ms * CONST.MS_TO_KT;

    var deficit = vtarget_kt_precise - windKt;
    var preciseTakeoffMin = Math.max(2.5, deficit + 2);                       // 부상 가능 최소 (boost-based)
    var preciseComfortFloor = controlComfortFloor(mTotal, windKt, pumping);   // §178b 펌핑-aware floor
    var preciseMinWing = Math.max(preciseTakeoffMin, preciseComfortFloor);
    var binding = (preciseComfortFloor > preciseTakeoffMin) ? 'comfort' : 'takeoff';

    // 라인업에서 ≥ preciseMinWing 인 최소 사이즈 (boost 도 만족하는지 추가 확인)
    var minLineupSize = null;
    var marginKt = null;
    for (var i = 0; i < WING_LINEUP_M2.length; i++) {
      var size = WING_LINEUP_M2[i];
      var threshold = windKt + windBoostKt(size);
      var passesTakeoff = (vtarget_kt_precise <= threshold + 1e-9);
      var passesFloor = (size >= preciseMinWing - 1e-9);
      if (passesTakeoff && passesFloor) {
        minLineupSize = size;
        marginKt = threshold - vtarget_kt_precise;
        break;
      }
    }

    var maxWing = WING_LINEUP_M2[WING_LINEUP_M2.length - 1];
    var extreme = (minLineupSize === null);

    var result = {
      recommended_size_m2: minLineupSize,
      precise_min_wing_m2: Math.round(preciseMinWing * 100) / 100,
      precise_takeoff_min_m2: Math.round(preciseTakeoffMin * 100) / 100,
      precise_comfort_floor_m2: Math.round(preciseComfortFloor * 100) / 100,
      binding: binding,            // 'comfort' or 'takeoff'
      v_target_kt: Math.round(vtarget_kt_precise * 10) / 10,
      wind_kt: windKt,
      deficit_kt: Math.round(deficit * 10) / 10,
      margin_kt: (marginKt != null) ? Math.round(marginKt * 10) / 10 : null,
      max_wing_in_lineup_m2: maxWing,
      lineup: WING_LINEUP_M2.slice(),
      extreme: extreme
    };

    if (extreme) {
      // §190 (티모 2026-06-04 · I-1 fix, 옥대표님 승인) — binding 원인별 역산 분기.
      // 기존: comfort-floor binding 인데도 takeoff 물리만 역산 → 현재 풍속보다 낮은
      // min_wind / 현재 포일보다 작은 min_foil 역방향 안내 (90kg@10kt 실측 버그).
      if (binding === 'comfort') {
        // floor(V) ≤ maxWing 이 되는 최소 풍속을 §178/§178b floor 식에서 역산:
        //   (9.0 − 0.3·V) · (mTotal/80) · pumpScale ≤ maxWing
        //   → V ≥ (9.0 − maxWing·80/(mTotal·pumpScale)) / 0.3
        var pumpScale = (pumping === 'hard') ? 0.85
                      : (pumping === 'easy') ? 1.15
                      : 1.00;
        var vFloor = (9.0 - (maxWing * 80) / (mTotal * pumpScale)) / 0.3;
        // takeoff 측 최소 풍속과 둘 다 충족해야 하므로 max 취함
        var boostMaxC = windBoostKt(maxWing);
        var minWindTakeoff = vtarget_kt_precise - boostMaxC;
        result.min_wind_kt = Math.ceil(Math.max(vFloor, minWindTakeoff) * 10) / 10;
        result.extreme_reason = 'comfort_floor';   // UI 문구 분기용
        result.min_foil_area_cm2 = null;           // 포일 안내는 takeoff binding 시에만 유효
      } else {
        // takeoff binding — 기존 역산 유지
        var boostMax = windBoostKt(maxWing);
        var minWindRaw = vtarget_kt_precise - boostMax;
        result.min_wind_kt = Math.ceil(minWindRaw * 10) / 10;
        result.extreme_reason = 'takeoff';
        var v_target_max_kt = windKt + boostMax;
        if (v_target_max_kt > 0) {
          var v_min_max_kt = v_target_max_kt / (pf * sf);
          var v_min_max_ms = v_min_max_kt * CONST.KT_TO_MS;
          var A_foil_min_m2 = (2 * mTotal * CONST.G) / (rho * cl * v_min_max_ms * v_min_max_ms);
          result.min_foil_area_cm2 = Math.ceil(A_foil_min_m2 * 10000 / 10) * 10;
        } else {
          result.min_foil_area_cm2 = null;
        }
      }
    }

    return result;
  }

  /**
   * 부상 가능 윙 사이즈 역산 — takeoff 실패 시 "이 사이즈로 바꾸면 가능" 추천.
   * @param {Object} input - calculate() 와 동일한 input
   * @returns {Object}
   *   needed=false  → 현재 입력으로 takeoff 가능 (추천 불필요)
   *   needed=true   → 추천 필요. 다음 필드 포함:
   *     recommended_size_m2  : 라인업에서 takeoff 가능한 최소 윙 (null 이면 extreme)
   *     min_wing_needed_m2   : 정확한 역산값 (라인업 매핑 전)
   *     deficit_kt           : v_target − wind (얼마나 부족한지)
   *     extreme              : true → 라인업 max 로도 부족
   *     min_wind_kt          : (extreme 시) 라인업 max 윙으로 feasibility 가능한 최소 풍속
   *     min_foil_area_cm2    : (extreme 시) 라인업 max 윙 + 현재 풍속에서 feasibility 가능한 최소 foil area
   */
  function recommendTakeoffWing(input) {
    var r = calculate(input);
    if (r.feasible) {
      return { needed: false, current_feasible: true };
    }

    // Precise (미반올림) v_target_ms 재계산 → 라운딩 오차 방지
    var rider = Number(input.rider_kg) || 0;
    var area = Number(input.front_wing_area_cm2) || 0;
    var ar = Number(input.front_wing_ar) || 6.5;
    var pumping = input.pumping || 'moderate';
    var pf = PUMPING_FACTOR[pumping] || PUMPING_FACTOR.moderate;
    var gear = (input.gear_kg != null && !isNaN(Number(input.gear_kg)) && Number(input.gear_kg) >= 0)
      ? Number(input.gear_kg) : CONST.GEAR_MASS;
    var waterType = (input.water_type === 'fresh') ? 'fresh' : 'sea';
    var rho = getRho(waterType);
    var surface = (typeof input.surface === 'string' && SURFACE_FACTOR[input.surface] != null)
      ? input.surface : 'flat';
    var sf = getSurfaceFactor(surface);
    var cl = getCL(ar);
    var windKt = Number(input.wind_kt) || 12;
    var mTotal = rider + gear;

    var vmin_ms = vMinMs(rider, area, cl, gear, rho);
    var vtarget_ms = vmin_ms * pf * sf;
    var vtarget_kt_precise = vtarget_ms * CONST.MS_TO_KT;

    var deficit = vtarget_kt_precise - windKt;
    var minWingNeeded = Math.max(2.5, deficit + 2);

    // 라인업에서 ≥ minWingNeeded 인 최소 사이즈 선택
    var recommendedSize = null;
    for (var i = 0; i < WING_LINEUP_M2.length; i++) {
      if (WING_LINEUP_M2[i] >= minWingNeeded - 1e-6) {
        recommendedSize = WING_LINEUP_M2[i];
        break;
      }
    }

    var maxWing = WING_LINEUP_M2[WING_LINEUP_M2.length - 1];
    var extreme = (recommendedSize === null);

    var result = {
      needed: true,
      current_feasible: false,
      v_target_kt: Math.round(vtarget_kt_precise * 10) / 10,
      wind_kt: windKt,
      deficit_kt: Math.round(deficit * 10) / 10,
      min_wing_needed_m2: Math.round(minWingNeeded * 100) / 100,
      recommended_size_m2: recommendedSize,
      max_wing_in_lineup_m2: maxWing,
      extreme: extreme,
      pumping_factor: pf,
      surface_factor: sf
    };

    if (extreme) {
      // 1) 라인업 max 윙으로 feasibility 가능한 최소 풍속
      //    feasibility: v_target ≤ wind + boost(max_wing) → wind ≥ v_target − boost(max_wing)
      var boostMax = windBoostKt(maxWing);
      var minWindRaw = vtarget_kt_precise - boostMax;
      result.min_wind_kt = Math.ceil(minWindRaw * 10) / 10;

      // 2) 라인업 max 윙 + 현재 풍속에서 feasibility 가능한 최소 foil area
      //    v_target_new ≤ wind + boost(max_wing) = wind + boostMax
      //    v_min_new ≤ (wind + boostMax) / (pump × surface)
      //    A_foil_min = 2·M·g / (ρ·CL·v_min_max_ms²)
      var v_target_max_kt = windKt + boostMax;
      if (v_target_max_kt > 0) {
        var v_min_max_kt = v_target_max_kt / (pf * sf);
        var v_min_max_ms = v_min_max_kt * CONST.KT_TO_MS;
        var A_foil_min_m2 = (2 * mTotal * CONST.G) / (rho * cl * v_min_max_ms * v_min_max_ms);
        result.min_foil_area_cm2 = Math.ceil(A_foil_min_m2 * 10000 / 10) * 10; // 10 cm² 단위 round-up
      } else {
        result.min_foil_area_cm2 = null;
      }
    }

    return result;
  }

  /* ────────────────────────────────────────────────────────────────────────
     §170 v7 — Wing-size optimizer (Danny matrix calibration)
     DO_NOT_REVERT — Task C / Priority 1 sprint deliverable.

     Algorithm:
       A_opt(V,m,skill,foil_AR,pref) =
            K_master
          · (m_total / m_ref)                  // mass-linear
          · √(LD_foil_REF / LD_foil(AR))       // foil-efficiency
          · pref_factor[pref]
          / V_wind_kt ^ beta

     Calibration constants (fit to Danny 6-pt matrix, log-log regression):
       K_master   = 25.124
       beta       = 0.5683
       m_ref      = 75 kg     (Danny 70 kg + 5 kg gear)
       LD_foil_REF= 33.79     (R6 V1 AR 13.7 → 9.13·√13.7)

     Sub-physics (used for min/max bracket, not optimal):
       F_rider_max = m·g·sin(θ_skill)          // heel-out lateral cap
       F_aero      = 0.5·ρ_air·V_app²·A·C_eff
       tan(α)      = 1/LD_wing                 // wing pull angle
       LD_wing(AR) = 1.83·√AR  // derived from CD_i = CL²/(π·e·AR) with
                               // e≈0.42, CD_0≈0.098 (typical LEI airfoil;
                               // ref: Folkersma, Schmehl & Viré 2019,
                               // doi:10.1002/we.2329)
       LD_foil(AR) = 9.13·√AR  // derived from same formula with
                               // e≈0.85, CD_0≈0.008 (clean hydrofoil;
                               // ref: Anderson, *Fundamentals of
                               // Aerodynamics* 6e; Faltinsen 2005)

     Heel angle by skill (deg):  9 / 19 / 29 / 39 / 50  (§155 5-stage canonical)
     ──────────────────────────────────────────────────────────────────────── */

  var WING_OPT = {
    K_MASTER: 25.124,
    BETA: 0.5683,
    M_REF: 75.0,
    LD_FOIL_REF: 33.79,
    RHO_AIR: 1.225,
    C_EFF: 1.0,
    GEAR_DEFAULT: 5.0,
    WING_AR_DEFAULT: 4.5
  };

  // §176-B (Danny 2026-05-16): 선수 sustained heel cap 50° → 42° (Danny 실측 검증
  // "실제 sustain은 39-43° 정도가 한계"). 50°는 burst만 가능, sustained X.
  // 상급-선수도 midpoint 41° 로 동기화. VMG 모델 over-optimism (max 22.3 kt) 보정.
  var HEEL_DEG = {
    '입문': 9, '초급': 19, '중급': 29, '상급': 39, '선수': 42,
    '상급-선수': 41  // midpoint (39° + 42°) — §176-B Danny 실측 보정
  };

  // §170 v15 + §176-B — Skill 별 heel angle 정상 range [min, max]
  // 본인 실측 heel 이 range 밖이면 ±0.5 m² personalization 옵션을 calculator 가 표시.
  // ⚠ skill-assessment 힐 4축 (transition skill) 과는 별개 — power management skill.
  //   v14 false equivalence 회귀 금지 (skill_assessment_v1 read 안 함).
  var HEEL_RANGE = {
    '입문':      [0,  9],
    '초급':      [10, 19],
    '중급':      [20, 29],
    '상급':      [30, 39],
    '선수':      [40, 43],   // §176-B Danny 2026-05-16 — sustained 한계
    '상급-선수': [35, 43]
  };
  var STRONG_WIND_KT = 18;  // §170 v15 — 강풍 cutoff (below + strong wind → 강조)

  var KV_BY_SKILL = {
    '입문': 1.10, '초급': 1.25, '중급': 1.40,
    '상급': 1.55, '선수': 1.70, '상급-선수': 1.62
  };

  // §170 v10 — Skill efficiency factor η(skill) canonical (Danny 2026-05-13)
  // L/D_eff = L/D_max · η(skill).  Captures α-trim 정밀도 + 시팅 timing.
  // Danny self-identifies '상급-선수' → η = 0.92 (interpolated 상급 0.88 ↔ 선수 0.95).
  // The Danny matrix calibration (K_master, beta) is BAKED IN at η=0.92, so
  // wing_eff_factor = √(η_REF / η_skill) is 1 for Danny and >1 for less-skilled riders.
  var ETA_BY_SKILL = {
    '입문': 0.45,
    '초급': 0.60,
    '중급': 0.75,
    '상급': 0.88,
    '선수': 0.95,
    '상급-선수': 0.92
  };
  var ETA_REF = 0.92;  // Danny baseline (do not change — see DO_NOT_REVERT §170 v10)

  /* §176 (Danny 2026-05-16) — 풍상 45° 진행 속도 (upwind polar) 모델 상수
     DO_NOT_REVERT §176.

     기존 §170 v16 v_limit 모델은 V_app_limit² − V_wind² 식을 썼는데, 이는
     V_boat ⊥ V_wind (beam reach) 기하 가정 → 풍상 45° tack 진행 속도와 일치 X.
     실제로 풍상 45° 에서는 apparent wind 가 더 가까워지고 (β ↓), wing thrust 가
     β > arctan(1/L/D_wing) 조건에서만 양(+) → 폴라 분석 필요.

     모델:
       V_app² = V_b² + V_t² + 2·V_t·V_b·cos(θ_tack)
       cos β = (V_b + V_t·cos θ_tack) / V_app
       C_thrust = C_L · [sin β − cos β / (L/D_wing_eff)]
       T_wing = 0.5·ρ_air·V_app²·A_wing·C_thrust
       D_foil = M·g / (L/D_foil_eff)   (cruise approximation, L=Mg)
       H_max = M·g·tan(heel_angle_skill)  (side force capacity)
       C_L cap: L cos β ≤ H_max → C_L ≤ 2·H_max / (ρ·V_app²·A·cos β)
       → V_b 최대값 = T(V_b) ≥ D_foil 의 가장 큰 V_b (sweep 0.1 kt step)

     Skill 별 tack angle (라이더가 가까이 갈 수 있는 최소 TWA, 진풍각):
       §176-E (Danny 2026-05-16): TWA 5° 균등 spacing 채택. Primary source = Danny 코칭 경험
       기반 wingfoil 실측. iQFOiL race 데이터 (50-55°) 는 reference 로 강등 (race-context VMG
       극대화는 5° 균등 spacing 의 직관성보다 후순위).
       Heel 은 변경 없음 (§176-B 9/19/29/39/42 유지).
       값: 선수 45° / 상급-선수 47° / 상급 50° / 중급 55° / 초급 60° / 입문 65°.
       이전 §176-D (50/51/53/56/59/63) revert.
       상급-선수 = 상급 50° + 선수 45° midpoint 47.5° → 47° (floor, 기존 51 from 51.5 floor 패턴 일치).

     CL_WING_MAX: inflatable wingfoil wing 의 풍상 지속 주행 실효 최대 C_L.
       2D LEI airfoil peak 는 ~1.2 (Folkersma 2019 + DMJ wind-tunnel proxy) 이나,
       §181-D (Danny 2026-05-22) 에서 실효 지속 peak 1.00 으로 재보정 — 스팬방향
       트위스트·능동 디파워·3D 유한스팬 효과로 2D peak 보다 낮음. 상세는 아래
       §181-D 블록(WING_CD0_PARASITIC 선언부 위쪽) 참조. */
  /* §483 (2026-09-01) — 풍상 택 각도를 **실측**으로 다시 잡는다.
     ────────────────────────────────────────────────────────────
     옛 표(상급 50°·선수 45°)는 올림픽 카이트포일 수준의 포인팅이다.
     동료심사 GPS 연구에서 Formula Kite 최상위(T1)가 배속 19.2kt·VMG
     12.2kt → TWA 50.6°, 최하위(T3)조차 54.7° 다. 윙포일은 카이트보다
     넓게 간다 — 손윙은 유효 면적이 작고 라이더 몸이 큰 항력원이다.

     옥대표 8/31 실측(TWD 218°): 풍상 평균 CWA 70.1°, 지속 20초창 중
     VMG 상위군이 55~62°에 몰린다(p95 창 = 58°). 즉 잘 나갈 때가 58°다.

     새 표는 그 실측과 카이트 기준선 사이에 놓는다:
       선수 56° (카이트 T1 50.6° 보다 넓게 — 윙포일이 더 빠를 수는 없다)
       상급 58° (옥대표 최상 지속 구간과 일치)
       중급 64° · 초급 70° · 입문 78°
     검증: 이 표로 전 풍속·전 스킬 최대 풍상 VMG = 14.3kt. 옥대표
     "윙포일에서 VMG 14노트 넘는 건 프로도 거의 못 본다" 와 맞는다. */
  var TACK_ANGLE_DEG = {
    '입문': 78, '초급': 70, '중급': 64,
    '상급': 58, '선수': 56, '상급-선수': 57
  }
  var CL_WING_MAX = 1.00;   // §181-D (Danny 2026-05-22) — 1.2→1.00 재보정. DO_NOT_REVERT §181-D

  var PREF_FACTOR = {
    small: 0.92,   // 작게 쓰기 선호 (Danny)
    mid:   1.00,
    big:   1.08
  };

  function ldFoil(ar) { return 9.13 * Math.sqrt(ar); }

  /* §181-C (Danny 2026-05-21) — 윙 L/D 계수 1.83 → 2.2 재캘리브레이션.
     DO_NOT_REVERT §181-C.
     기존 1.83 (L/D_max AR4.5 = 3.88) 은 풍상 보드 속도를 계통적으로 과소예측.
     Danny 현장 ground truth: 11kt·상급-선수·7m²·80kg → ~18kt (모델은 14.9kt).
     원인 = cosβ/LDwing 항력항 과대 → β~18° 부근에서 wing thrust 조기 소멸.
     anchor (11kt → ~18kt) 보정 → 2.2 (L/D_max AR4.5 = 4.67, 결과 18.3kt).
     §179 의 이론 도출(1.83)은 LEI-airfoil 보수 추정 — 실측 anchor 우선. */
  var LDWING_K = 2.2;
  function ldWing(ar) { return LDWING_K * Math.sqrt(ar); }

  /* §181-C — 풍상 보드 속도(V_b) sweep 상한. 기존 §176-C 21kt cap 은 과소예측
     모델 시절 calibration → 윙 L/D 재보정 후 15·20kt 에서 binding 되어 단조 증가
     파괴 + Danny anchor 모순 → 35kt 로 상향. **DO_NOT_REVERT §181-C — 값 35 유지.**
     §192 (티모 2026-06-04 · I-3 단기, 옥대표님 승인) — 주석 정정 only:
       기존 "35 = 8-25kt 실사용역에서 binding 되지 않는 sanity guard" 표현은
       lift_calc_review_2026-06-04.md §4-3 node 실측에서 반증됨 — 상급·5m²·AR8.7·
       70+10kg 기준 wind ≥24kt 에서 V_boat = 35.0 cap binding. 따라서 cap 은
       'runaway sanity guard' 인 동시에 강풍역 V_boat 출력의 실효 상한 (포화)으로
       기능 중. 진짜 평형점은 cap 위에 있을 수 있음 → upwindSpeed() 가 capped
       플래그를 산출(§191), UI 에 "△ 모델 상한 도달 — 참고용" 표기. 값 변경
       (예: 40kt 상향)은 anchor 사슬(§181-C/D/E) 재보정 필요 → 옥대표님 별도 결정. */
  var UPWIND_VB_CAP_KT = 35;

  /* §179 (Danny 2026-05-16) → §192 (티모 2026-06-04 · I-4 fix, 옥대표님 승인) —
     L/D(CL) wing polar (depower L/D drop) 함수 4개 제거.

     제거 대상: WING_CD0 (0.098) · WING_E (0.42) · ldWingAtCL(cl,ar) · clOptWing(ar)
     제거 사유: lift_calc_review_2026-06-04.md §1-G + §4-7 — 전체 사이트(3 사본
       포함) grep 결과 호출 0건. 선언만 존재하는 dead code 였음. stateAt() 의
       추력식은 LD_wing(=2.2·√AR, §181-C) + WING_CD0_PARASITIC(0.04, §181) 합성을
       사용 중 — §179 polar (CD = CD0 + CL²/(πeAR)) 는 한 번도 호출 안 됨.

     BREAKING 0: 호출 0건 확인됨 (assets · calculator-pwa · _ci_site 사본 모두 동일).
       동일 sprint 검증 — _team/lift_calc_fix_verify_2026-06-04.md 참조.

     향후 사용 시: 본 §192 제거를 revert 후 stateAt() 추력식 (L1055 부근)에서
       WING_CD0_PARASITIC·cos β 항을 §179 CD(CL) polar 로 교체해야 의미 있는
       작동. 이 변경은 anchor 사슬(§181-C/D/E) 일괄 재보정 동반 — lift_calc_
       review_2026-06-04.md §5 I-4 권장안 참조 (P4, 옥대표님 별도 결정 영역).

     관련 lock 영역 — 본 §192 는 lock 무변경:
       · WING_CD0_PARASITIC = 0.04 (§181 lock, L932) 유지
       · LDWING_K = 2.2 (§181-C lock, L829) 유지
       두 lock 간 부분 이중계상(§4-7 +11% @ CL 0.88) 정량은 보고서에 기록됨,
       해결은 lock 재보정 영역 → 본 sprint 미적용.
     References (Folkersma/Schmehl/Viré 2019, CD_0=0.098, e=0.42) — 출처는
       upwindSpeed References 블록(§176)에 보존. */

  /* §181 (Danny 2026-05-21) — 옵션 C: 윙 형상 항력 + heel 약결합 (역U자 모델).
     DO_NOT_REVERT §181. §178 (선형 empirical V_b 보정) 을 영구 대체.

     §178 의 문제: bestVb *= (1 + 0.02·(A−5.5)) 선형 보정 → "윙 클수록 무조건
     빠름" 으로 귀결 → 비현실. 실제로는 큰 윙 = parasitic drag ↑ → 적정 사이즈
     초과 시 V_b 하락. 윙 면적별 V_b 는 역U자 (optimum 존재) 가 맞음.

     옵션 C 두 항:
       (1) 윙 형상 항력 (parasitic) — stateAt() 폴라 sweep 에 추가:
           D_wing = 0.5·ρ_air·V_app²·A·CD0_WING   (전방 저항 성분 = D_wing·cos β)
           CD0_WING = 0.04 — 윙포일 표준 baseline. Danny 실측 데이터 확보 시 calibrate.
           면적 A ↑ → D_wing ↑ → V_b 균형점에 부담.
       (2) Heel 한계 ↔ 윙 면적 결합:
           H_max_eff = H_max_base·(A/A_ref)^WING_HEEL_COUPLE_EXP
           §181 v2 (Danny 2026-05-21): 지수 0 확정 → 결합 비활성. 근거 = 라이더
           측면력 한계 H_max = M·g·tan θ 는 체중·heel 로만 결정, 윙 크기와 무관.
           상수·메커니즘은 향후 재조정 대비 보존 (지수만 0).

     합성: thrust 이득 (면적 ∝) vs parasitic 손실 (면적 ∝, V_app² 가중) →
       작은 윙 = powered 영역 (thrust ∝ A, V_b 상승) /
       큰 윙 = depowered 영역 (parasitic dominate, V_b 하강) → 역U자 곡선.
       적정 사이즈에서 V_b 최대. 가벼운 라이더는 optimum 이 작은 쪽으로 이동.
     depowered 영역에서도 (1)(2) 가 wing area 를 살아있게 만들어 §178 이 지적한
     "heel cap binding 시 A 수학적 소거" 문제를 물리적으로 해결.

     §181 v2 (Danny 2026-05-21) — calibration 확정:
       · WING_CD0_PARASITIC 0.04 — 유지 (윙포일 표준 baseline).
       · WING_HEEL_COUPLE_EXP 0.5 → 0 (§181 v2). 지수 0.5 는 depowered 영역에서
         양력추력 ∝ A^0.5 로 키워 parasitic 하강분을 상쇄 → 역U자 소멸. 지수 0
         (결합 제거) → clean 역U자. ※ §181-E (2026-05-22) 에서 −1.2 로 재보정 —
         §181 v2 의 "H_max 는 윙 크기와 무관" 논증은 윙 모멘트암 증가를 빠뜨려
         정정됨 (아래 §181-E 블록 참조). */

  /* §181-D (Danny 2026-05-22) — 윙 곡선 재보정: CL_WING_MAX 1.2 → 1.00.
     DO_NOT_REVERT §181-D.  (CL_WING_MAX 선언은 위쪽 §176 블록에 있음.)

     문제: §181 v2 곡선은 윙-사이즈 풍상 VMG 의 정점(최적 윙)을 계통적으로 작게
       잡았다 (작은 윙 과선호 편향). 라이딩 대시보드 what-if 10kt 차트가 5.5 m²
       에서 정점을 찍고 더 큰 윙은 VMG 가 오히려 떨어져, 약풍일수록 큰 윙이
       유리하다는 도메인 사실과 정반대였다.

     Danny ground-truth anchor 2개:
       · 12kt / 70kg / 중급 / foil AR 6.5       → 최적 윙 ≈ 6 m²
       · 10kt / 70kg / 상급-선수 / foil AR 13.7 → 최적 윙 ≈ 7.4 m²
         (10kt 곡선은 표시구간 2.5~7.4 m² 에서 단조 증가해야 한다)

     메커니즘: 역U자 정점은 powered→depowered(heel-cap) 전이 윙 면적과 일치한다.
       A_transition = 2·H_max / (ρ_air·V_a²·CL_eff_max·cos β),  CL_eff_max = CL_WING_MAX·η.
       CL_WING_MAX ↓ → CL_eff_max ↓ → A_transition ∝ 1/CL_eff_max ↑ → 정점이 큰 윙
       쪽으로 이동.

     CD0(WING_CD0_PARASITIC) 대신 CL_WING_MAX 를 쓴 이유 — §181-C 속도 anchor 보존:
       CD0 ↑ 도 정점을 키우지만 형상 항력이 커져 depowered 영역 보드속도까지 낮춘다.
       CD0 0.08 검증 시 §181-C anchor(11kt·80kg·상급-선수·7m²)의 V_boat 가 18.1 →
       15.9 kt 로 하락 → 절대속도 회귀. CL_WING_MAX 는 powered/depowered 전이점만
       옮기고 항력은 그대로라, depowered 영역(heel-cap 으로 CL 이 이미 제한된 큰 윙·
       강풍 영역)의 절대 보드속도는 불변 → §181-C anchor 18.1 kt 정확히 유지.

     보정 결과 (수정 전 → 후, 0.25 m² step 곡선 정점):
       · 12kt/70kg/중급/foil6.5       : 5.0 → 6.25 m² (≈6, 0.5 그리드 표시 6.0~6.5)
       · 10kt/70kg/상급-선수/foil13.7 : 6.0 → 7.5 m² (표시구간 2.5~7.4 단조 증가)
       · §181-C V_boat anchor 18.1 kt 불변, 풍속 sweep 8/12/16/20kt 단조성 유지,
         역U자 형태 유지, runSelfTest 62/62 · runDannyMatrixTest PASS 유지.

     1.00 의 물리 타당성: 기존 1.2 는 LEI airfoil 의 2D peak C_L (Folkersma 2019 +
       wind-tunnel proxy). 핸드헬드 윙의 지속 풍상 주행에서 실효 최대 C_L 은 스팬
       방향 트위스트·능동 디파워·3D 유한스팬 효과로 2D peak 보다 낮다. 1.00 은
       Danny 현장 anchor 로 보정한 실효 지속 peak C_L.
     주의: 이 재보정은 §181 풍상 VMG 곡선(upwindCurve/upwindSpeed)에만 적용된다.
       별도 시스템인 wingSizeOptimal(Danny 매트릭스 경험식)은 변경 없음. */
  var WING_CD0_PARASITIC = 0.04;   // §181 — 윙 형상 항력 계수

  /* §483 (2026-09-01) — 라이더·보드 공기저항 CdA (m²). **빠져 있던 물리항.**
     ────────────────────────────────────────────────────────────
     이 모델의 저항은 지금까지 포일 항력(D_foil = M·g / L/D_foil) 하나뿐이었다.
     12kt·상급 운항점에서 그 값이 25 N 인데, 같은 순간 라이더 몸에 걸리는
     공기저항은 겉보기 풍속 29.8kt(15.3 m/s)에서 90 N 이 넘는다 — **세고 있던
     항의 네 배가 통째로 빠져 있었다.** 그래서 모델이 풍상 배 속도를
     20.6kt(12kt 바람)로, 풍상 VMG 를 13.0kt 로 냈다.

     실측 대조 (§483 조사):
       · 올림픽 Formula Kite 최상위(T1) 11~15kt 에서 풍상 VMG 12.2±1.4kt,
         배 속도 19.2±1.2kt  (동료심사 GPS 연구, PMC7830054)
       · 옥대표 8/31 실측 10~14kt: 풍상 배속 상위50% 17.8kt, VMG 상위50%
         7.8kt, 20초창 p95 9.3kt
     즉 모델은 취미 윙포일러를 올림픽 카이트 최상위보다 빠르게 놓고 있었다.
     옥대표 지적("VMG 14노트 이상은 프로도 거의 못 본다")이 정확했다.

     값의 근거: 선 자세 성인의 전면적 0.55~0.7 m², 인체 Cd 1.0~1.15.
     윙포일러는 하네스에 기대 상체를 약간 낮추므로 유효 전면적 0.45~0.6 m²,
     여기에 보드 측면·수면 위 마스트 windage 를 더해 CdA ≈ 0.65 m².
     자전거 문헌의 직립 라이더 CdA(0.4 m²)보다 큰데, 윙포일러는 몸을
     웅크리지 않고 팔을 벌려 윙을 들고 있기 때문이다.
     p.rider_cda_m2 로 개별 조정 가능. */
  var RIDER_CDA_M2 = 0.65;

  /* §181-E (Danny 2026-05-22) — 선수 커브 풍속 민감도 완만화:
     WING_HEEL_COUPLE_EXP 0 → −1.2,  WING_AREA_REF_M2 5.5 → 7.5.
     DO_NOT_REVERT §181-E.

     문제: §181-D(CL_WING_MAX 1.00) 후에도 선수(foil AR 13.7) 커브가 10→12kt
       구간에서 너무 가파르게 떨어졌다. 10kt→7.5㎡ 는 맞으나 12kt→5.25㎡ —
       Danny 기준(12kt/70kg/선수 → ~6.3㎡)보다 ~1㎡ 작다. 역U 정점은 heel-cap
       전이 면적 A_transition ∝ 1/V_a² 이고 V_a 가 풍속에 거의 선형 증가 →
       최적 윙이 ~1/W² 로 급강하 (관측 지수 ≈ −2).

     해결 — heel↔면적 결합 지수를 음수로:
       H_max_eff = H_max_base·(A/A_ref)^exp.  exp<0 → 큰 윙일수록 유효 heel
       측면력 한계가 작아진다. A_transition ∝ (1/V_a²)^(1/(1−exp)) 이므로
       풍속 민감도 지수가 −2/(1−exp) 로 완만해진다. exp=−1.2 → 지수 ≈ −0.9.
       물리 근거: 큰 핸드헬드 윙은 추력중심(CE)이 높아 같은 측면력에도 전복
       모멘트가 커진다 → 라이더가 안전하게 실을 수 있는 측면력이 줄어든다.
       §181 v2 의 exp=0 논증은 라이더 복원 모멘트만 봤고 윙의 모멘트암 증가를
       빠뜨렸다. 부호(−)는 물리, 크기(−1.2)는 Danny 현장 anchor 보정값이다.

     A_ref 5.5 → 7.5: 결합의 피벗(coupling=1 지점)을 선수 10kt 최적(~7.5㎡)에
       맞춘다. 효과 (1) 10kt 앵커 고정, (2) §181-C anchor(11kt·80kg·상급-선수·
       7㎡)가 피벗 근처라 V_boat 18.1kt 정확히 보존 (A_ref=5.5 면 16.6kt 로 회귀).

     보정 결과 (수정 전 → 후, 0.25㎡ step 곡선 정점, 선수/70kg/foil13.7):
       8kt 9.5→9.5 · 10kt 7.5→7.5 · 12kt 5.25→6.25 · 14kt 3.75→5.25 ·
       16kt 3.0→4.5 · 18kt 2.25→4.0 · 20kt 2.0→3.0  (전 구간 단조·역U 유지)
       §181-C V_boat 18.1kt 불변 · runSelfTest 62/62 · matrix PASS. */
  var WING_AREA_REF_M2 = 7.5;      // §181-E (Danny 2026-05-22) — 5.5→7.5, heel 결합 피벗
  var WING_HEEL_COUPLE_EXP = -1.2; // §181-E (Danny 2026-05-22) — 0→−1.2, 풍속 민감도 완만화. DO_NOT_REVERT §181-E

  /* §176 — 풍상 45° 진행 속도 (upwind polar equilibrium speed)
     입력: v_wind_kt, m_rider_kg, gear_kg, skill, foil_ar, wing_area_m2, wing_ar, c_l_max
     출력: V_boat_kt (tack 방향), V_vmg_kt (풍상 component), depowered/feasible flag 등

     §181 (Danny 2026-05-21) — 윙 면적 효과는 stateAt() 의 형상 항력 + heel 약결합
       으로 물리 모델링 (역U자). §178 선형 후처리 보정은 제거됨.

     보드 부력 (board volume) 무시 — intentional (Danny 2026-05-19 명시).
       cruise 영역 (foil 위 떠 있음) 에서 보드 부력은 V_b 결정에 영향 X.
       보드 사이즈는 takeoff 영역 (calculate() 함수) 에서만 영향.
       추후 board induced drag (wetted area) 모델링이 필요하면 별도 task.

     References — Upwind polar physics 표준:
       · Anderson, J.D. 2010. "Fundamentals of Aerodynamics" 6e. McGraw-Hill.
         ISBN 978-1-259-12991-9 (ch.5 — induced drag CD = CD0 + CL²/(π·e·AR),
         L/D_max = √(π·e·AR/CD0)/2, thrust coefficient sin β − cos β/(L/D)).
       · Faltinsen, O.M. 2005. "Hydrodynamics of High-Speed Marine Vehicles".
         Cambridge University Press. doi:10.1017/CBO9780511546068. ISBN
         978-0-521-84568-7 (ch.6 hydrofoil vessel — clean foil L/D_max 도출).
       · Folkersma, M., Schmehl, R., Viré, A. 2019. "Boundary layer transition
         modeling on leading edge inflatable kite airfoils". Wind Energy
         22(7):908-921. doi:10.1002/we.2329 (LEI wing CD0=0.098, e=0.42 출처).
       · Larsson, L., Eliasson, R., Orych, M. 2022. "Principles of Yacht Design"
         5e. Bloomsbury. ISBN 978-1-3994-0301-6 (ch.7 apparent wind cosine rule,
         heel-out lateral force cap H_max = M·g·tan θ_heel).
       · Garrett, R. 1996. "The Symmetry of Sailing". Sheridan House.
         ISBN 978-1-57409-000-5 (sailing physics vector 해석 기본서).
     Calibration anchors (§181-C·D·E) — Danny ground truth, 단일 라이더.
       Multi-rider 일반화 검증은 expert_sports_science_reference.md §5 plan. */
  function upwindSpeed(p) {
    var V_t_kt = Number(p.v_wind_kt);
    var m = Number(p.m_rider_kg);
    var gear = (p.gear_kg != null && Number(p.gear_kg) >= 0)
      ? Number(p.gear_kg) : WING_OPT.GEAR_DEFAULT;
    var skill = String(p.skill || '중급');
    var foilAR = Number(p.foil_ar);
    var wingArea = Number(p.wing_area_m2);
    var wingAR = Number(p.wing_ar || WING_OPT.WING_AR_DEFAULT);
    var clMax = Number(p.c_l_max || CL_WING_MAX);

    if (!isFinite(V_t_kt) || V_t_kt <= 0 || !isFinite(m) || m <= 0 ||
        !isFinite(foilAR) || foilAR <= 0 || !isFinite(wingArea) || wingArea <= 0 ||
        !(skill in ETA_BY_SKILL)) {
      return { error: 'invalid_input' };
    }

    var mTotal = m + gear;
    var eta = ETA_BY_SKILL[skill] || ETA_REF;
    var tackDeg = (typeof p.tack_angle_deg === 'number' && p.tack_angle_deg > 0)
      ? p.tack_angle_deg
      : (TACK_ANGLE_DEG[skill] || 50);
    var tackRad = deg2rad(tackDeg);
    var heelDeg = HEEL_DEG[skill] || 29;
    var heelRad = deg2rad(heelDeg);
    var V_t = V_t_kt * CONST.KT_TO_MS;

    var LDfoil_max = ldFoil(foilAR);
    var LDfoil_eff = LDfoil_max * eta;
    var LDwing_max = ldWing(wingAR);
    var LDwing_eff = LDwing_max * eta;

    var CL_eff_max = clMax * eta;
    var D_foil = mTotal * CONST.G / LDfoil_eff;        // forward foil drag (N), L=Mg
    /* §483 — 라이더·보드 공기저항 면적. 0 을 주면 예전(몸 항력 없음) 거동. */
    var cdaBody = (p.rider_cda_m2 != null && Number(p.rider_cda_m2) >= 0)
      ? Number(p.rider_cda_m2) : RIDER_CDA_M2;

    // §181 — heel 측면력 한계. H_max = M·g·tan(θ_heel).
    // §181 v2: WING_HEEL_COUPLE_EXP=0 → heelCouple=1 (윙 면적 결합 비활성).
    var H_max_base = mTotal * CONST.G * Math.tan(heelRad);     // side-force capacity (N)
    var heelCouple = Math.pow(wingArea / WING_AREA_REF_M2, WING_HEEL_COUPLE_EXP);
    var H_max = H_max_base * heelCouple;                       // 결합 적용 후 (exp 0 → ×1)

    function stateAt(V_b) {
      var V_a2 = V_b * V_b + V_t * V_t + 2 * V_t * V_b * Math.cos(tackRad);
      if (V_a2 <= 1e-9) {
        return { V_a: 0, beta: 0, sin_b: 0, cos_b: 1, CL: 0, T: 0, H: 0,
                 D_wing: 0, depowered: false, valid: false };
      }
      var V_a = Math.sqrt(V_a2);
      var cos_b = (V_b + V_t * Math.cos(tackRad)) / V_a;
      cos_b = Math.max(-1, Math.min(1, cos_b));
      var beta = Math.acos(cos_b);
      var sin_b = Math.sin(beta);
      // Heel-out cap: L·cos β ≤ H_max  →  C_L ≤ 2 H_max/(ρ V_a² A cos β)
      var CL_heel_cap = (cos_b > 1e-6)
        ? (2 * H_max) / (WING_OPT.RHO_AIR * V_a2 * wingArea * cos_b)
        : Infinity;
      var CL = Math.min(CL_eff_max, CL_heel_cap);
      var q = 0.5 * WING_OPT.RHO_AIR * V_a2 * wingArea;  // 동압 × 면적 (N)
      // §181 — 순(net) 전방 추력 = 양력 추력 − (유도저항 + 윙 형상저항) 전방성분.
      //   양력 추력 계수      = CL·(sin β − cos β/LD_wing)   [유도저항 포함]
      //   윙 형상저항 전방성분 = CD0_WING·cos β               [면적 ∝, V_app² 가중]
      var liftThrustCoeff = CL * (sin_b - cos_b / LDwing_eff);
      /* §483 — 라이더·보드 공기저항 (전방 성분 cos β) */
      var bodyCoeff = cdaBody / wingArea;
      var thrustCoeff = liftThrustCoeff - WING_CD0_PARASITIC * cos_b
                        - bodyCoeff * cos_b;
      var T = (thrustCoeff > 0 && CL > 0) ? (q * thrustCoeff) : 0;
      var D_wing = q * WING_CD0_PARASITIC;              // 윙 형상 항력 (∥ V_app, N)
      var D_body = q * bodyCoeff;                       // 라이더·보드 공기저항 (N)
      var H = q * CL * cos_b;
      return {
        V_a: V_a, beta: beta, sin_b: sin_b, cos_b: cos_b,
        CL: CL, T: T, H: H, D_wing: D_wing, D_body: D_body,
        depowered: (CL < CL_eff_max - 1e-6),
        valid: true
      };
    }

    // §181-C (Danny 2026-05-21): V_b sweep 상한 = UPWIND_VB_CAP_KT (35 kt).
    // 기존 §176-C 21kt cap 은 풍상 속도 과소예측 모델 시절 calibration → §181-C
    // 윙 L/D 재보정(1.83→2.2) 후 15·20kt 에서 binding 되어 단조 증가 파괴 →
    // 35 로 상향. §192 (티모 2026-06-04, 옥대표님 승인) — 주석 정정:
    // §4-3 실측에서 wind ≥24kt 에서 cap 자체가 binding (포화 평탄) → "runaway
    // sanity guard" 와 동시에 강풍역 V_boat 출력의 실효 상한으로도 기능. capped
    // 플래그(§191)로 UI 노출. cap 값 변경은 anchor 사슬 재보정 필요 → 옥대표님 결정.
    // VMG = SOG × cos(TWA). Sweep V_b ∈ [0, cap] 0.1 kt step, T ≥ D_foil 최대 V_b.
    var V_max = UPWIND_VB_CAP_KT * CONST.KT_TO_MS;
    var step = 0.1 * CONST.KT_TO_MS;
    var bestVb = 0;
    var feasible = false;
    var bestState = stateAt(0);
    for (var v = 0; v <= V_max + 1e-9; v += step) {
      var s = stateAt(v);
      if (s.T >= D_foil) {
        bestVb = v;
        bestState = s;
        feasible = true;
      }
    }
    if (!feasible) {
      bestVb = 0;
      bestState = stateAt(0);
    }

    // §191 (티모 2026-06-04 · P2+I-3, 옥대표님 승인) — V_b cap 도달 표기 (I-3 단기).
    // bestVb 가 sweep 상한(UPWIND_VB_CAP_KT, §181-C lock — 값 변경 금지)에 닿으면
    // T ≥ D_foil 이 sweep 꼭대기에서도 성립 → 진짜 평형점은 cap 위에 있을 수 있음.
    // 결과를 모델 상한으로 절단했다는 표시만 — cap 값·sweep 로직 무변경.
    // float 누적 오차 대비 step 1.5배 여유로 판정.
    var capped = feasible && (bestVb >= V_max - step * 1.5);

    // §181 (Danny 2026-05-21) — §178 선형 empirical V_b 보정 제거.
    // 윙 면적 효과는 stateAt() 의 형상 항력 + heel 약결합으로 폴라 sweep 안에서
    // 물리 모델링됨 (역U자 곡선). 추가 후처리 보정 불필요.

    var V_boat_kt = bestVb * CONST.MS_TO_KT;
    var V_vmg_kt  = V_boat_kt * Math.cos(tackRad);

    return {
      V_boat_kt: Math.round(V_boat_kt * 10) / 10,
      V_vmg_kt:  Math.round(V_vmg_kt * 10) / 10,
      tack_angle_deg: tackDeg,
      V_apparent_kt: Math.round(bestState.V_a * CONST.MS_TO_KT * 10) / 10,
      beta_deg: Math.round(bestState.beta * 180 / Math.PI * 10) / 10,
      CL_used: Math.round(bestState.CL * 100) / 100,
      CL_eff_max: Math.round(CL_eff_max * 100) / 100,
      CL_wing_max_base: clMax,
      depowered: bestState.depowered,
      feasible: feasible,
      capped: capped,   // §191 (티모 2026-06-04 · P2+I-3, 옥대표님 승인) — V_b = 모델 상한(35kt) 도달

      side_force_N: Math.round(bestState.H * 10) / 10,
      side_force_max_N: Math.round(H_max * 10) / 10,
      side_force_max_base_N: Math.round(H_max_base * 10) / 10,   // §181 — heel 결합 전
      heel_couple_factor: Math.round(heelCouple * 1000) / 1000,  // §181 — (A/A_ref)^0.5
      D_foil_N: Math.round(D_foil * 10) / 10,
      D_wing_N: Math.round((bestState.D_wing || 0) * 10) / 10,
      D_body_N: Math.round((bestState.D_body || 0) * 10) / 10,
      /* §483 — 검증 범위 밖 표시. 이 모델을 맞춘 근거는 실측 두 개뿐이다:
         옥대표 GPS(10~14kt)와 Formula Kite 동료심사 연구(11~15kt). 8~22kt
         밖은 외삽이고, 특히 25kt 위에서는 대조할 관측이 없다.
         '아무도 그 바람에서 풍상 레이스를 안 하니 데이터가 없다' 를 모델이
         모르는 척하면 안 된다 — 억지로 상수를 맞춰 꼬리를 눌러 봤지만
         그러면 실측이 있는 구간(12kt VMG 8.1→6.0)이 망가졌다. 그래서
         숫자를 조작하는 대신 **외삽이라고 말한다.**
         기준: 풍상 VMG 14.5kt 초과(옥대표 "프로도 거의 못 본다") 또는
         VMG/풍속 0.94 초과(Formula Kite T1 실측 상한) 또는 풍속 22kt 초과. */
      beyond_validated_range: !!(
        V_vmg_kt > 14.5 || (V_t_kt > 0 && V_vmg_kt / V_t_kt > 0.94) || V_t_kt > 22),
      rider_cda_m2: cdaBody,   // §181 — 윙 형상 항력
      LD_wing_eff: Math.round(LDwing_eff * 100) / 100,
      LD_foil_eff: Math.round(LDfoil_eff * 100) / 100,
      eta: eta,
      heel_deg: heelDeg,
      m_total_kg: mTotal,
      wing_area_m2: wingArea
    };
  }

  /* §180-B (Danny 2026-05-17) — Upwind Advisor: "VMG ↑ 하려면 뭘 바꿔야 하나?"
     DO_NOT_REVERT §180-B.

     §180-B 변경 (Danny 결정):
       - wing_ar lever 영구 제거 — handheld 윙 AR 변경은 비현실
         (윙팁 길어짐 → water touch + 라이더가 새 윙 구매 부담)
       - foil_ar simple ±N lever 영구 제거 — 임의 AR 변경은 fictitious foil 가정
       - 신규 foil_swap lever — 사용자 지정 브랜드의 실제 SKU pool 에서 후보 검색
         · 같은 brand 내 모든 다른 SKU 시뮬레이션 (단순 size up + AR-only + 복합 증가
           모두 SKU 풀에서 자동 포함됨 — 각 SKU 가 (area, AR) 한 점)
         · area cm² + AR 둘 다 적용 → upwindSpeed() 재호출

     남은 Levers:
       1) 윙 사이즈 (handheld) ±0.5 m² · ±1.0 m²    (다른 SKU 사용)
       2) Foil swap                                  (사용자 지정 브랜드 SKU pool)
       3) 체중 −5 kg                                  (장비 경량화 또는 체중 감량)
       4) 스킬 ↑ 1 단계                                (장기 — 연습으로)

     foil_pool 입력 (선택, 신규):
       p.foil_pool = [
         { id: 'lev-r6-v1', model: 'R6 FW V1', area_cm2: 479, ar: 13.7, ... },
         { id: 'lev-r6-v2', ... },
         ...
       ]  // 같은 brand 의 모든 SKU
       p.current_foil_id = 'lev-r6-v1'  // 현재 선택된 SKU (pool 에서 제외)
     foil_pool 미제공 시 foil_swap lever 자동 생략 (UI 에서 안내).

     자동 정렬: VMG 개선치 큰 순. */
  function upwindAdvisor(p) {
    var base = upwindSpeed(p);
    if (base.error) return { error: base.error };

    var scenarios = [];

    // 1) 윙 사이즈 변화 (handheld 윙 m²) — 유지
    [-0.5, +0.5, -1.0, +1.0].forEach(function (delta) {
      var newArea = (Number(p.wing_area_m2) || 0) + delta;
      if (newArea >= 1.5 && newArea <= 9.5) {
        scenarios.push({
          category: 'wing_size',
          delta: delta,
          label: (delta > 0 ? '+' : '') + delta.toFixed(1) + ' m² 윙 사이즈',
          detail: '현재 ' + (p.wing_area_m2 || 0).toFixed(1) + ' → ' + newArea.toFixed(1) + ' m²',
          rationale: delta > 0
            ? '더 큰 윙 → 같은 바람에서 끄는 힘 증가 (단 라이더 한계에 도달하면 효과 줄어듦)'
            : '더 작은 윙 → 라이더 한계 회피 가능, 윙 효율 회복 → 풍상 효율 ↑',
          new_input: { wing_area_m2: newArea }
        });
      }
    });

    // 2) Foil swap — 사용자 지정 브랜드의 SKU pool 에서 (§180-B 신규)
    if (Array.isArray(p.foil_pool) && p.foil_pool.length > 0) {
      var currentArea = Number(p.front_wing_area_cm2 || (function () {
        // current_foil_id 로 현재 area 추정 (제공 안 됐을 때)
        var cur = p.foil_pool.filter(function (s) { return s.id === p.current_foil_id; })[0];
        return cur ? cur.area_cm2 : null;
      })());
      var currentAR = Number(p.foil_ar) || null;
      var currentDispArea = (function () {
        var cur = p.foil_pool.filter(function (s) { return s.id === p.current_foil_id; })[0];
        return cur ? (cur.area_display_cm2 || cur.area_cm2) : currentArea;
      })();
      p.foil_pool.forEach(function (sku) {
        // 현재 SKU 제외
        if (p.current_foil_id && sku.id === p.current_foil_id) return;
        if (!sku || !(sku.area_cm2 > 0) || !(sku.ar > 0)) return;
        // area/AR 가 똑같으면 의미 없음
        if (currentArea && Math.abs(sku.area_cm2 - currentArea) < 1 && currentAR && Math.abs(sku.ar - currentAR) < 0.05) return;

        // 어떤 종류 변화인지 카테고리화 (UI 표시 hint)
        var areaDelta = currentArea ? (sku.area_cm2 - currentArea) : 0;
        var arDelta = currentAR ? (sku.ar - currentAR) : 0;
        var changeType;
        if (Math.abs(areaDelta) < 5 && Math.abs(arDelta) >= 0.1) {
          changeType = 'AR 변경';
        } else if (Math.abs(arDelta) < 0.1 && Math.abs(areaDelta) >= 5) {
          changeType = '사이즈 변경';
        } else if (areaDelta > 0 && arDelta > 0) {
          changeType = '사이즈+AR 동시 ↑';
        } else if (areaDelta < 0 && arDelta < 0) {
          changeType = '사이즈+AR 동시 ↓';
        } else {
          changeType = '복합 변경';
        }

        var detailParts = [];
        if (currentDispArea != null) {
          detailParts.push((currentDispArea) + 'cm² → ' + (sku.area_display_cm2 || sku.area_cm2) + 'cm²');
        } else {
          detailParts.push(sku.area_display_cm2 || sku.area_cm2 + 'cm²');
        }
        if (currentAR) {
          detailParts.push('AR ' + currentAR.toFixed(1) + ' → ' + sku.ar.toFixed(1));
        } else {
          detailParts.push('AR ' + sku.ar);
        }

        // Rationale — physical reasoning
        var rationaleParts = [];
        if (arDelta > 0.1) rationaleParts.push('AR ↑ → 포일 효율 ↑ → 포일 저항 ↓ (더 빠름)');
        else if (arDelta < -0.1) rationaleParts.push('AR ↓ → 포일이 더 잘 견디고 양력 큼 (forgiving)');
        if (areaDelta > 5) rationaleParts.push('면적 ↑ → 약풍에서 더 잘 뜸 (cruise 영역 강세)');
        else if (areaDelta < -5) rationaleParts.push('면적 ↓ → 물에 닿는 면적 ↓ → 강풍 컨트롤 ↑');
        var rationale = rationaleParts.length > 0
          ? rationaleParts.join(' · ')
          : '같은 brand 다른 SKU';

        scenarios.push({
          category: 'foil_swap',
          change_type: changeType,
          sku_id: sku.id,
          sku_model: sku.model,
          area_cm2: sku.area_cm2,
          ar: sku.ar,
          label: 'Foil 교체 → ' + sku.model,
          detail: '(' + changeType + ' · ' + detailParts.join(' · ') + ')',
          rationale: rationale,
          new_input: { foil_ar: sku.ar, front_wing_area_cm2: sku.area_cm2 }
        });
      });
    }

    // 4) 체중 변화 (장비 경량화 또는 라이더)
    [-5, -10].forEach(function (delta) {
      var newMass = (Number(p.m_rider_kg) || 70) + delta;
      if (newMass >= 40) {
        scenarios.push({
          category: 'mass',
          delta: delta,
          label: delta + ' kg 체중',
          detail: '현재 ' + (p.m_rider_kg || 70) + ' → ' + newMass + ' kg (라이더 또는 장비 경량화)',
          rationale: '체중·장비 무게 감소 → 포일이 받는 저항 감소 → 같은 윙 힘으로 더 빠른 풍상 진행',
          new_input: { m_rider_kg: newMass }
        });
      }
    });

    // 5) 스킬 ↑
    var skillUp = { '입문': '초급', '초급': '중급', '중급': '상급', '상급': '선수', '상급-선수': '선수' };
    var nextSkill = skillUp[p.skill];
    if (nextSkill && nextSkill !== p.skill) {
      scenarios.push({
        category: 'skill',
        delta: 1,
        label: '스킬 한 단계 ↑',
        detail: '현재 ' + p.skill + ' → ' + nextSkill,
        rationale: '스킬 향상 → 윙·포일 효율 모두 ↑ + 더 가파른 풍상 진행 → 보드 속도 및 VMG 큰 개선',
        new_input: { skill: nextSkill }
      });
    }

    // 각 시나리오 계산
    var results = scenarios.map(function (s) {
      var p2 = Object.assign({}, p, s.new_input);
      var u = upwindSpeed(p2);
      var dV  = (u.V_boat_kt != null) ? Math.round((u.V_boat_kt - base.V_boat_kt) * 10) / 10 : 0;
      var dVm = (u.V_vmg_kt  != null) ? Math.round((u.V_vmg_kt  - base.V_vmg_kt ) * 10) / 10 : 0;
      return Object.assign({}, s, {
        new_V_boat_kt: u.V_boat_kt,
        new_V_vmg_kt: u.V_vmg_kt,
        delta_vb: dV,
        delta_vmg: dVm,
        depowered_after: u.depowered,
        feasible_after: u.feasible
      });
    });

    // VMG 개선치 큰 순으로 정렬 (개선 없는 것 후순위)
    results.sort(function (a, b) {
      return (b.delta_vmg - a.delta_vmg) || (b.delta_vb - a.delta_vb);
    });

    return {
      base: {
        V_boat_kt: base.V_boat_kt,
        V_vmg_kt: base.V_vmg_kt,
        tack_angle_deg: base.tack_angle_deg,
        beta_deg: base.beta_deg,
        depowered: base.depowered,
        feasible: base.feasible
      },
      scenarios: results,
      top: results[0] || null,
      positive_count: results.filter(function (r) { return r.delta_vmg > 0; }).length
    };
  }

  /* §176 — 윙 사이즈 ±0.5 m² sensitivity */
  function upwindSensitivity(p) {
    var area = Number(p.wing_area_m2);
    if (!(area > 0)) return { error: 'invalid_area' };
    var smallerArea = Math.max(1.5, area - 0.5);
    var largerArea = area + 0.5;
    var base    = upwindSpeed(p);
    var smaller = upwindSpeed(Object.assign({}, p, { wing_area_m2: smallerArea }));
    var larger  = upwindSpeed(Object.assign({}, p, { wing_area_m2: largerArea }));
    return {
      base: base,
      smaller: smaller,
      larger: larger,
      wing_area_base: area,
      wing_area_smaller: smallerArea,
      wing_area_larger: largerArea,
      delta_smaller_kt: Math.round((smaller.V_boat_kt - base.V_boat_kt) * 10) / 10,
      delta_larger_kt:  Math.round((larger.V_boat_kt  - base.V_boat_kt) * 10) / 10
    };
  }

  /* §181 (Danny 2026-05-21) — 윙 사이즈 sweep → V_b/VMG 역U자 곡선 데이터.
     계산기 결과 UI 의 역U자 그래프가 호출. 입력 p 는 upwindSpeed 와 동일하되
     wing_area_m2 는 무시되고 [area_min, area_max] 를 step 간격으로 sweep.
     opts = { area_min_m2, area_max_m2, step_m2 } (기본 3.0~8.0 · 0.25 간격).
     반환: { points:[{area_m2,V_boat_kt,V_vmg_kt,feasible,depowered}], optimum, ... }
       optimum = VMG (풍상 진척 속도) 최대 지점. tack 각 고정이므로 V_b 최대와 동일점. */
  function upwindCurve(p, opts) {
    opts = opts || {};
    var aMin = (opts.area_min_m2 > 0) ? Number(opts.area_min_m2) : 3.0;
    var aMax = (opts.area_max_m2 > 0) ? Number(opts.area_max_m2) : 8.0;
    var step = (opts.step_m2 > 0) ? Number(opts.step_m2) : 0.25;
    if (aMax < aMin) { var sw = aMin; aMin = aMax; aMax = sw; }
    var points = [];
    var optimum = null;
    var anyCapped = false;   // §191 (티모 2026-06-04 · P2+I-3, 옥대표님 승인) — I-3 cap 도달 집계
    for (var a = aMin; a <= aMax + 1e-9; a += step) {
      var area = Math.round(a * 100) / 100;
      var u = upwindSpeed(Object.assign({}, p, { wing_area_m2: area }));
      var pt = {
        area_m2:   area,
        V_boat_kt: (u && u.feasible) ? u.V_boat_kt : 0,
        V_vmg_kt:  (u && u.feasible) ? u.V_vmg_kt  : 0,
        feasible:  !!(u && u.feasible),
        depowered: !!(u && u.depowered),
        capped:    !!(u && u.capped)   // §191 — V_b = 모델 상한(35kt) 도달 지점
      };
      points.push(pt);
      if (pt.capped) anyCapped = true;
      /* §480 (2026-08-31) — 동점이면 **큰 윙**을 고른다.
         강풍에서는 V_b 가 모델 상한(UPWIND_VB_CAP_KT=35kt)에 걸려 여러
         면적이 완전히 같은 VMG 를 낸다. 예: 20kt/선수/AR13.7 은 3.0·3.5·
         4.0 ㎡ 가 모두 24.70kt, 22kt/상급 은 2.5~4.5 ㎡ 가 모두 22.50kt.
         엄격한 > 는 그 평탄구간의 **첫** 점을 남기므로 늘 가장 작은 윙이
         정점으로 보고됐다 — 22kt 에서 2.5㎡ 를 추천하는 셈이다.
         평탄구간은 모델이 그 위를 분해하지 못한다는 뜻이지 작은 윙이
         낫다는 뜻이 아니고, 같은 VMG 라면 큰 윙이 저속 여유·펌핑 부담·
         돌풍 대응에서 낫다. 두 독립 근거가 이 규칙을 지지한다:
           · Timo spec Case 5 (20kt/선수) 기대 3.5~5.0 → 4.0 으로 들어옴
           · 옥대표 실사용 22kt = 4.5㎡ → 평탄구간 상단과 정확히 일치
         허용오차 0.05kt 는 VMG 가 0.1kt 로 반올림돼 있어 사실상 '완전 동점'
         만 잡는다. 평탄하지 않은 구간(약·중풍)은 전혀 영향받지 않는다. */
      if (pt.feasible && (!optimum ||
          pt.V_vmg_kt > optimum.V_vmg_kt + 1e-9 ||
          (Math.abs(pt.V_vmg_kt - optimum.V_vmg_kt) <= 0.05 &&
           pt.area_m2 > optimum.area_m2))) {
        optimum = pt;
      }
    }
    return {
      points: points,
      optimum: optimum,
      any_capped: anyCapped,   // §191 — 하나라도 cap 도달 시 true (UI 참고용 표기)
      area_min_m2: aMin,
      area_max_m2: aMax,
      step_m2: step
    };
  }

  /* §181-F (Danny 2026-05-22) — 윙 사이즈 추천 (풍상 VMG 곡선 파생).
     DO_NOT_REVERT §181-F.  §181-G (2026-05-22) 에서 변풍(gust) 오프셋 추가.

     Danny 결정: 계산기·대시보드의 윙 추천은 §181 풍상 VMG 곡선(upwindCurve)에서
     직접 파생한다. 두 값을 제시 —
       · performance = VMG 곡선 정점 (해당 풍속 풍상 VMG 최대 윙). 항상 메인.
       · practical   = performance − gust 오프셋 (바람 상태별 실사용 추천).

     §181-G (Danny 2026-05-22) — 변풍(gust) 정도가 실사용 추천을 조절:
       · clean (깨끗한 바람) → 오프셋 0    → practical = performance
       · light (약간의 변풍) → 오프셋 0.5㎡ → 한 사이즈 작게 (다루기 쉬움)
       · heavy (심한 변풍)   → 오프셋 1.0㎡ → 두 사이즈 작게
       깨끗한 바람일수록 큰 윙으로 풍상 VMG 를 극대화, 변풍이 심할수록 작은
       윙으로 컨트롤성을 확보한다. practical 은 풍상 주행 가능한 최소 윙 미만으로
       내려가지 않는다.

     옛 wingSizeOptimal/DANNY_MATRIX 경험식(K_master 매트릭스)은 §181 곡선
     재보정 후 곡선과 어긋나므로 추천 산출에서 분리됨 — wingSizeOptimal 은
     이론 측정값(A_min_drive·A_max_heel·L/D·clearance) 진단 출력으로만 유지.

     입력 p = upwindSpeed/upwindCurve 와 동일. opts.gust = 'clean'|'light'|'heavy'
       (기본 'clean'). opts.offset_m2 로 오프셋 직접 지정 가능.
     반환: { feasible, performance, practical, gust, gust_offset_m2, peak_raw_m2,
             min_feasible_m2, performance_vmg_kt, practical_vmg_kt,
             performance_detail, practical_detail, curve }. */
  var GUST_OFFSET_M2 = { clean: 0, light: 0.5, heavy: 1.0 };

  function wingRecommendation(p, opts) {
    opts = opts || {};
    var gust = (opts.gust && (opts.gust in GUST_OFFSET_M2)) ? opts.gust : 'clean';
    var gustOffset = (opts.offset_m2 != null) ? Number(opts.offset_m2) : GUST_OFFSET_M2[gust];
    var aMin = (opts.area_min_m2 > 0) ? Number(opts.area_min_m2) : 2.0;
    var aMax = (opts.area_max_m2 > 0) ? Number(opts.area_max_m2) : 9.5;
    var step = (opts.step_m2 > 0) ? Number(opts.step_m2) : 0.25;
    var curve = upwindCurve(p, { area_min_m2: aMin, area_max_m2: aMax, step_m2: step });
    if (!curve.optimum) {
      return { feasible: false, error: 'no_feasible_wing', curve: curve };
    }
    // performance = VMG 곡선 정점
    var performance = curve.optimum.area_m2;
    // 풍상 주행 가능한 최소 윙 (practical floor — 이 미만은 풍상 불가)
    var feas = curve.points.filter(function (q) { return q.feasible; });
    var minFeasible = feas.length
      ? feas.reduce(function (m, q) { return q.area_m2 < m ? q.area_m2 : m; }, feas[0].area_m2)
      : performance;
    // practical = performance − gust 오프셋 (최소 풍상 가능 윙 이상으로 클램프)
    var practical = performance - gustOffset;
    if (practical < minFeasible) practical = minFeasible;
    practical = Math.round(practical * 100) / 100;
    var perfDetail = upwindSpeed(Object.assign({}, p, { wing_area_m2: performance }));
    var pracDetail = upwindSpeed(Object.assign({}, p, { wing_area_m2: practical }));
    return {
      feasible: true,
      performance: performance,
      practical: practical,
      gust: gust,
      gust_offset_m2: gustOffset,
      peak_raw_m2: performance,
      min_feasible_m2: Math.round(minFeasible * 100) / 100,
      performance_vmg_kt: (perfDetail && perfDetail.feasible) ? perfDetail.V_vmg_kt : null,
      practical_vmg_kt: (pracDetail && pracDetail.feasible) ? pracDetail.V_vmg_kt : null,
      performance_detail: perfDetail,
      practical_detail: pracDetail,
      curve: curve
    };
  }

  /* §181-B (Danny 2026-05-21) — heel 각도별 max 윙 사이즈 곡선.
     라이더 측면력 한계 H_max(θ) = M_total·g·tan θ.
     윙 측면력 H = 0.5·ρ_air·V_a²·A·CL·cos β. H = H_max 풀면 max 사용 윙 면적:
       A_max(θ) = 2·M_total·g·tan θ / (ρ_air·V_a²·CL_eff_max·cos β)
     V_a·β 는 기준 윙(p.ref_wing_m2, 기본 5.5) 의 풍상 운항점에서 1회 추출 → 고정.
     → A_max(θ) = K·tan θ. K = 라이더·운항점 상수. heel ↑ → max 윙 ↑ (tan 곡선).
     무거운 라이더 → mTotal ↑ → K ↑ → 같은 heel 각도에서 더 큰 윙 가능.
     opts = { deg_min, deg_max, step_deg } (기본 0~45° · 1° 간격). */
  function heelMaxWingCurve(p, opts) {
    var m = Number(p.m_rider_kg);
    var V = Number(p.v_wind_kt);
    var skill = String(p.skill || '중급');
    if (!isFinite(m) || m <= 0 || !isFinite(V) || V <= 0 || !(skill in ETA_BY_SKILL)) {
      return { error: 'invalid_input' };
    }
    var gear = (p.gear_kg != null && Number(p.gear_kg) >= 0)
      ? Number(p.gear_kg) : WING_OPT.GEAR_DEFAULT;
    var eta = ETA_BY_SKILL[skill] || ETA_REF;
    var kv = KV_BY_SKILL[skill] || 1.4;
    var clMax = Number(p.c_l_max || CL_WING_MAX);
    var CL_eff_max = clMax * eta;
    var mTotal = m + gear;
    var refWing = (p.ref_wing_m2 > 0) ? Number(p.ref_wing_m2) : 5.5;

    // 기준 윙의 풍상 운항점에서 V_a·β 추출 (powered riding 상태)
    var ref = upwindSpeed({
      v_wind_kt: V, m_rider_kg: m, gear_kg: gear, skill: skill,
      foil_ar: Number(p.foil_ar) || 8, wing_area_m2: refWing,
      wing_ar: Number(p.wing_ar || WING_OPT.WING_AR_DEFAULT), c_l_max: clMax
    });
    var V_a, betaDeg;
    if (ref && ref.feasible && ref.V_apparent_kt > 0) {
      V_a = ref.V_apparent_kt * CONST.KT_TO_MS;
      betaDeg = (ref.beta_deg > 0) ? ref.beta_deg : 35;
    } else {
      V_a = V * CONST.KT_TO_MS * kv;   // 풍상 운항 불가 시 apparent wind 추정
      betaDeg = 35;
    }
    var cosB = Math.cos(deg2rad(betaDeg));
    if (cosB < 0.1) cosB = 0.1;

    // A_max(θ) = 2·M·g·tan θ / (ρ·V_a²·CL_eff_max·cos β) = K·tan θ
    var K = (2 * mTotal * CONST.G) /
            (WING_OPT.RHO_AIR * V_a * V_a * CL_eff_max * cosB);

    opts = opts || {};
    var dMin = (opts.deg_min != null) ? Number(opts.deg_min) : 0;
    var dMax = (opts.deg_max != null) ? Number(opts.deg_max) : 45;
    var step = (opts.step_deg > 0) ? Number(opts.step_deg) : 1;
    var points = [];
    for (var d = dMin; d <= dMax + 1e-9; d += step) {
      points.push({
        heel_deg: Math.round(d * 10) / 10,
        max_wing_m2: Math.round(K * Math.tan(deg2rad(d)) * 100) / 100
      });
    }
    // 스킬별 heel 각도 마커 (§176-B 값)
    var marks = [];
    ['입문', '초급', '중급', '상급', '선수', '상급-선수'].forEach(function (sk) {
      var hd = HEEL_DEG[sk];
      if (hd == null) return;
      marks.push({
        skill: sk, heel_deg: hd,
        max_wing_m2: Math.round(K * Math.tan(deg2rad(hd)) * 100) / 100
      });
    });
    return {
      points: points,
      skill_marks: marks,
      K: Math.round(K * 1000) / 1000,
      V_apparent_kt: Math.round(V_a * CONST.MS_TO_KT * 10) / 10,
      beta_deg: Math.round(betaDeg * 10) / 10,
      deg_min: dMin,
      deg_max: dMax
    };
  }

  /* §170 v15 — Heel angle 기반 ±0.5 m² personalization helper.
     skill 의 정상 range 와 사용자 self-report heel mode 비교:
       above (range_max+5° 이상) → +0.5 m² 옵션
       below (range_min 미만)    → −0.5 m² 권장 (강풍 시 강조)
       match/auto                → null (옵션 없음)
     Returns null 또는 { sign, label, detail, size_delta_m2 }. */
  function heelOption(skill, heelMode, vWindKt) {
    var range = HEEL_RANGE[skill];
    if (!range) return null;
    var lo = range[0], hi = range[1];
    if (heelMode === 'above') {
      return {
        sign: +1,
        size_delta_m2: +0.5,
        label: '+0.5 m² 옵션 가능',
        detail: '본인 힐 각도 ' + (hi + 5) + '° 이상 — 한 사이즈 큰 윙으로 power 더 끌어내기 가능.'
      };
    }
    if (heelMode === 'below') {
      var strong = (Number(vWindKt) >= STRONG_WIND_KT);
      return {
        sign: -1,
        size_delta_m2: -0.5,
        label: strong ? '−0.5 m² 권장 (강풍 강조)' : '−0.5 m² 권장',
        detail: strong
          ? '본인 힐 각도가 ' + lo + '° 미만 + 강풍 ' + vWindKt + ' kt — 컨트롤 우선, 한 사이즈 작게 시작.'
          : '본인 힐 각도가 ' + lo + '° 미만 — 한 사이즈 작게 시작 권장.'
      };
    }
    return null; // 'match' or 'auto'
  }

  function deg2rad(d) { return d * Math.PI / 180; }

  function roundHalf(x) {
    if (!isFinite(x)) return x;
    return Math.round(x * 2) / 2;
  }

  /**
   * Wing-size optimal recommendation (calibrated to Danny matrix).
   * @param {Object} p
   *   v_wind_kt:        wind speed (kt)
   *   m_rider_kg:       rider body mass (kg)
   *   skill:            '입문'|'초급'|'중급'|'상급'|'선수'|'상급-선수'
   *   foil_ar:          front-wing (hydrofoil) aspect ratio
   *   foil_span_cm:     foil wingspan (cm)  [info only, for clearance]
   *   mast_cm:          mast length (cm)
   *   rider_height_cm:  rider height (cm)   [info only, for clearance]
   *   wing_ar:          inflatable wing AR (default 4.5)
   *   preference:       'small'|'mid'|'big' (default 'mid')
   *   gear_kg:          착용 장비 (default 5 kg)
   *   c_eff:            wing total force coefficient (default 1.0)
   * @returns {Object}
   *   { optimal, min, max, raw, B_wing_m, reach_max_m, clearance_capped,
   *     A_min_drive, A_max_heel, overpowered, underpowered,
   *     LD_foil, LD_wing, V_app_ms }
   */
  function wingSizeOptimal(p) {
    var V = Number(p.v_wind_kt);
    var m = Number(p.m_rider_kg);
    var skill = String(p.skill || '중급');
    var foilAR = Number(p.foil_ar);
    var foilSpan = Number(p.foil_span_cm || 0);
    var mast = Number(p.mast_cm || 95);
    var height = Number(p.rider_height_cm || 175);
    var wingAR = Number(p.wing_ar || WING_OPT.WING_AR_DEFAULT);
    var pref = (p.preference in PREF_FACTOR) ? p.preference : 'mid';
    var gear = (p.gear_kg != null && Number(p.gear_kg) >= 0)
      ? Number(p.gear_kg) : WING_OPT.GEAR_DEFAULT;
    var cEff = Number(p.c_eff || WING_OPT.C_EFF);

    if (!isFinite(V) || V <= 0 || !isFinite(m) || m <= 0 ||
        !isFinite(foilAR) || foilAR <= 0 || !(skill in HEEL_DEG)) {
      return { error: 'invalid_input' };
    }

    var mTotal = m + gear;
    var theta = deg2rad(HEEL_DEG[skill]);
    var kv = KV_BY_SKILL[skill] || 1.4;
    var eta = ETA_BY_SKILL[skill] || ETA_REF;   // §170 v10 — skill efficiency
    var Vms = V * CONST.KT_TO_MS;
    var Vapp = kv * Vms;

    var LDfoil = ldFoil(foilAR);
    var LDwing_max = ldWing(wingAR);                // theoretical ceiling
    var LDwing_eff = LDwing_max * eta;              // §170 v10 effective L/D
    var alpha = Math.atan(1 / LDwing_eff);          // wing-pull angle uses effective L/D

    // ── Optimal A (calibrated empirical, Danny-anchored) ────────────────
    // §170 v10 — Danny matrix calibration is at η_REF = 0.92, so for skill k:
    //   wing_eff_factor = √(η_REF / η_skill)   (lower skill ⇒ bigger wing, sqrt-damped)
    var massFactor = mTotal / WING_OPT.M_REF;
    var foilFactor = Math.sqrt(WING_OPT.LD_FOIL_REF / LDfoil);
    var wingEffFactor = Math.sqrt(ETA_REF / eta);
    var prefMult = PREF_FACTOR[pref];
    var Aopt_raw = WING_OPT.K_MASTER
                 * massFactor
                 * foilFactor
                 * wingEffFactor
                 * prefMult
                 / Math.pow(V, WING_OPT.BETA);

    // ── A_min_drive (must overcome foil drag to fly) — uses effective L/D ─
    var Fdrive_min = mTotal * CONST.G / LDfoil;             // N
    var Faero_min = Fdrive_min / Math.sin(alpha);            // N
    var Amin_drive = (2 * Faero_min) / (WING_OPT.RHO_AIR * Vapp * Vapp * cEff);

    // ── A_max_heel (rider's lateral force capacity) — uses effective L/D ──
    var Frider_max = mTotal * CONST.G * Math.sin(theta);     // N
    var Faero_max = Frider_max / Math.cos(alpha);            // N
    var Amax_heel = (2 * Faero_max) / (WING_OPT.RHO_AIR * Vapp * Vapp * cEff);

    // ── Wing tip clearance constraint ────────────────────────────────────
    var Bwing = Math.sqrt(Aopt_raw * wingAR);                // m
    var reachMax = (height / 100) + 0.6 + (mast / 200);      // m
    var clearanceCap = Math.pow(2 * reachMax, 2) / wingAR;
    var capped = Aopt_raw > clearanceCap;
    var Aopt_clear = Math.min(Aopt_raw, clearanceCap);

    // §170 v11 — also compute "ceiling" A_opt for UI display (what a perfect-skill
    // rider with same body+foil would need): use η_REF=0.92 (Danny baseline = no
    // skill penalty). For Danny himself, ceiling === effective. For lower skill,
    // ceiling is smaller (less wing needed if skill were perfect).
    var Aopt_ceiling = Aopt_raw / wingEffFactor;             // strip skill multiplier

    // ── §176 (Danny 2026-05-16) — 풍상 45° 진행 속도 폴라 모델 ────────────
    // 이전 §170 v16 v_limit (V_app_limit² − V_wind²) 모델은 V_boat ⊥ V_wind 가정
    // → 풍상 45° tack 기하와 불일치. Danny 검수 후 폴라 균형 모델로 교체.
    //
    // 폴라 모델: V_app² = V_b² + V_t² + 2·V_t·V_b·cos(θ_tack)
    //           C_thrust = C_L·[sin β − cos β/(L/D_wing_eff)]
    //           T_wing = D_foil 풀어 V_b 최대값 = 풍상 진행 속도
    //   윙 면적 ↑ → 일반적으로 thrust ↑ → 풍상 속도 ↑ (overpower 직전까지)
    //   L/D_wing ↑ → 더 좁은 β 에서도 양(+) thrust → 풍상 속도 ↑
    //   스킬 ↑ → tack angle ↓ + η ↑ → 풍상 속도 ↑
    var optArea = roundHalf(Aopt_clear);
    var minArea = roundHalf(Math.max(Aopt_clear - 0.5, 1.5));
    var maxArea = roundHalf(Aopt_clear + 0.5);
    function vUpwindAt(areaM2) {
      if (!(areaM2 > 0)) {
        return { kt: 0, vmg_kt: 0, feasible: false, depowered: false,
                 beta_deg: 0, v_app_kt: 0, overpowered_at_rest: true };
      }
      var u = upwindSpeed({
        v_wind_kt: V, m_rider_kg: m, gear_kg: gear, skill: skill,
        foil_ar: foilAR, wing_area_m2: areaM2, wing_ar: wingAR, c_l_max: cEff * CL_WING_MAX
      });
      if (u.error) {
        return { kt: 0, vmg_kt: 0, feasible: false, depowered: false,
                 beta_deg: 0, v_app_kt: 0, overpowered_at_rest: true };
      }
      return {
        kt: u.V_boat_kt,
        vmg_kt: u.V_vmg_kt,
        feasible: u.feasible,
        depowered: u.depowered,
        beta_deg: u.beta_deg,
        v_app_kt: u.V_apparent_kt,
        tack_angle_deg: u.tack_angle_deg,
        overpowered_at_rest: !u.feasible
      };
    }
    var vLimMin = vUpwindAt(minArea);
    var vLimOpt = vUpwindAt(optArea);
    var vLimMax = vUpwindAt(maxArea);

    // §180-F (Danny 2026-05-17) — 라인업 max 노출 cap = 7.4 m².
    // 7.5/8.0 처럼 라인업에 없는 값 노출 금지. raw 는 보존 (이론 측정값 row 에서 확인 가능).
    var WING_DISPLAY_CAP_M2 = 7.4;
    var optRound  = roundHalf(Aopt_clear);
    var minRound  = roundHalf(Math.max(Aopt_clear - 0.5, 1.5));
    var maxRound  = roundHalf(Aopt_clear + 0.5);
    var sizeCapHit = (optRound > WING_DISPLAY_CAP_M2 || maxRound > WING_DISPLAY_CAP_M2);
    var optCapped = Math.min(optRound, WING_DISPLAY_CAP_M2);
    var minCapped = Math.min(minRound, WING_DISPLAY_CAP_M2);
    var maxCapped = Math.min(maxRound, WING_DISPLAY_CAP_M2);

    return {
      optimal:           optCapped,
      min:               minCapped,
      max:               maxCapped,
      raw:               Math.round(Aopt_clear * 1000) / 1000,
      size_cap_hit:      sizeCapHit,                 // §180-F — UI tooltip 표시용
      size_cap_m2:       WING_DISPLAY_CAP_M2,
      optimal_uncapped:  optRound,                   // §180-F — 검증·디버그용 (이전 값 보존)
      min_uncapped:      minRound,
      max_uncapped:      maxRound,
      v_limit_kt:        { at_min: vLimMin.kt, at_optimal: vLimOpt.kt, at_max: vLimMax.kt },
      v_limit_detail:    { min: vLimMin, optimal: vLimOpt, max: vLimMax },
      v_upwind_kt:       { at_min: vLimMin.kt, at_optimal: vLimOpt.kt, at_max: vLimMax.kt },
      v_upwind_detail:   { min: vLimMin, optimal: vLimOpt, max: vLimMax },
      A_opt_ceiling:     Math.round(Aopt_ceiling * 1000) / 1000,  // §170 v11
      A_min_drive:       Math.round(Amin_drive * 100) / 100,
      A_max_heel:        Math.round(Amax_heel * 100) / 100,
      overpowered:       Aopt_clear > Amax_heel,
      underpowered:      Aopt_clear < Amin_drive,
      clearance_capped:  capped,
      B_wing_m:          Math.round(Bwing * 100) / 100,
      reach_max_m:       Math.round(reachMax * 100) / 100,
      LD_foil:           Math.round(LDfoil * 100) / 100,
      LD_wing:           Math.round(LDwing_max * 100) / 100,        // theoretical (ceiling)
      LD_wing_max:       Math.round(LDwing_max * 100) / 100,        // alias for clarity
      LD_wing_eff:       Math.round(LDwing_eff * 100) / 100,        // skill-adjusted
      eta_skill:         eta,
      eta_pct:           Math.round(eta * 100),                      // 45-95
      V_app_ms:          Math.round(Vapp * 100) / 100,
      pref_factor:       prefMult,
      mass_factor:       Math.round(massFactor * 1000) / 1000,
      foil_factor:       Math.round(foilFactor * 1000) / 1000,
      wing_eff_factor:   Math.round(wingEffFactor * 1000) / 1000
    };
  }

  /* ────────────────────────────────────────────────────────────────────────
     §170 v7 — Danny matrix regression guard
     Source: Danny Ok personal calibration (70 kg / 175 cm / R6 V1 / 상급-선수
     / 작게 쓰기 선호). All 6 wind bands must land on the exact 0.5-grid size,
     and raw |Δ| must stay ≤ 0.30 m².
     ──────────────────────────────────────────────────────────────────────── */
  var DANNY_MATRIX = [
    { band: '8-10 kt',  v_mid:  9, A: 6.5 },
    { band: '10-12 kt', v_mid: 11, A: 6.0 },
    { band: '12-14 kt', v_mid: 13, A: 5.5 },
    { band: '14-16 kt', v_mid: 15, A: 5.0 },
    { band: '16-18 kt', v_mid: 17, A: 4.5 },
    { band: '20+ kt',   v_mid: 22, A: 4.0 }
  ];

  var DANNY_PROFILE = {
    m_rider_kg: 70,
    skill: '상급-선수',
    foil_ar: 13.7,
    foil_span_cm: 80,
    mast_cm: 112,
    rider_height_cm: 175,
    wing_ar: 4.5,
    preference: 'small',
    gear_kg: 5.0,
    c_eff: 1.0
  };

  function runDannyMatrixTest() {
    var results = [];
    var maxDeltaRaw = 0;
    var allRoundedMatch = true;
    var allRawWithinTol = true;
    var TOL_RAW = 0.30;

    for (var i = 0; i < DANNY_MATRIX.length; i++) {
      var row = DANNY_MATRIX[i];
      var input = Object.assign({}, DANNY_PROFILE, { v_wind_kt: row.v_mid });
      var r = wingSizeOptimal(input);
      var deltaRaw = r.raw - row.A;
      var deltaRound = r.optimal - row.A;
      if (Math.abs(deltaRaw) > maxDeltaRaw) maxDeltaRaw = Math.abs(deltaRaw);
      if (Math.abs(deltaRaw) > TOL_RAW) allRawWithinTol = false;
      if (deltaRound !== 0) allRoundedMatch = false;
      results.push({
        band: row.band, v_mid: row.v_mid,
        A_danny: row.A, A_raw: r.raw, A_opt: r.optimal,
        delta_raw: Math.round(deltaRaw * 1000) / 1000,
        match_rounded: (deltaRound === 0),
        within_tol_raw: Math.abs(deltaRaw) <= TOL_RAW
      });
    }
    return {
      pass: allRawWithinTol && allRoundedMatch,
      pass_raw: allRawWithinTol,
      pass_rounded: allRoundedMatch,
      max_delta_raw: Math.round(maxDeltaRaw * 1000) / 1000,
      tolerance: TOL_RAW,
      rows: results
    };
  }

  global.DMJLift = {
    // ── takeoff v_min calculator (existing v2) ──
    calculate: calculate,
    getCL: getCL,
    getARClass: getARClass,
    getRho: getRho,
    getSurfaceFactor: getSurfaceFactor,
    vMinMs: vMinMs,
    windTier: windTier,
    recommendWingSize: recommendWingSize,  // legacy simple guide
    // ── §175 부상 가능 윙 사이즈 역산 (Danny 2026-05-16) ──
    recommendTakeoffWing: recommendTakeoffWing,
    windBoostKt: windBoostKt,
    WING_LINEUP_M2: WING_LINEUP_M2,
    // ── §177 추천 윙 사이즈 = 부상 가능 최소 (Danny 2026-05-16) ──
    recommendMinFeasibleWingSize: recommendMinFeasibleWingSize,
    // ── §178 Control Comfort Floor (Danny 2026-05-16) ──
    controlComfortFloor: controlComfortFloor,
    runSelfTest: runSelfTest,
    CONST: CONST,
    PUMPING_FACTOR: PUMPING_FACTOR,
    SURFACE_FACTOR: SURFACE_FACTOR,
    // ── §170 v7 wing-size optimizer (Danny matrix) ──
    wingSizeOptimal: wingSizeOptimal,
    runDannyMatrixTest: runDannyMatrixTest,
    DANNY_MATRIX: DANNY_MATRIX,
    DANNY_PROFILE: DANNY_PROFILE,
    WING_OPT: WING_OPT,
    HEEL_DEG: HEEL_DEG,
    HEEL_RANGE: HEEL_RANGE,
    STRONG_WIND_KT: STRONG_WIND_KT,
    KV_BY_SKILL: KV_BY_SKILL,
    ETA_BY_SKILL: ETA_BY_SKILL,
    ETA_REF: ETA_REF,
    PREF_FACTOR: PREF_FACTOR,
    heelOption: heelOption,
    ldFoil: ldFoil,
    ldWing: ldWing,
    // ── §176 풍상 45° 진행 속도 (Danny 2026-05-16) ──
    upwindSpeed: upwindSpeed,
    upwindSensitivity: upwindSensitivity,
    upwindAdvisor: upwindAdvisor,
    // ── §181 옵션 C — 윙 사이즈 역U자 곡선 (Danny 2026-05-21) ──
    upwindCurve: upwindCurve,
    // ── §181-F — 윙 사이즈 추천 (퍼포먼스/편안함, 곡선 파생) (Danny 2026-05-22) ──
    wingRecommendation: wingRecommendation,
    // ── §181-B heel 각도별 max 윙 곡선 (Danny 2026-05-21) ──
    heelMaxWingCurve: heelMaxWingCurve,
    WING_CD0_PARASITIC: WING_CD0_PARASITIC,
    WING_AREA_REF_M2: WING_AREA_REF_M2,
    WING_HEEL_COUPLE_EXP: WING_HEEL_COUPLE_EXP,
    LDWING_K: LDWING_K,
    UPWIND_VB_CAP_KT: UPWIND_VB_CAP_KT,
    TACK_ANGLE_DEG: TACK_ANGLE_DEG,
    CL_WING_MAX: CL_WING_MAX
  };
})(typeof window !== 'undefined' ? window : this);
