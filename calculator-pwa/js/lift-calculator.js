/* ==========================================================================
   단무지공방 — Lift Calculator MVP v2
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
    check('§176-E: 상급 풍상 속도 8-22 kt 합리적 범위 (TWA 50°)',
      up_advanced.V_boat_kt >= 8 && up_advanced.V_boat_kt <= 22);
    check('§176-E: 상급 tack 50° (5° 균등 TWA)', up_advanced.tack_angle_deg === 50);

    // 14) 선수 라이더 (η=0.95, tack=42°) > 상급
    var up_pro = upwindSpeed({
      v_wind_kt: 10, m_rider_kg: 70, gear_kg: 10, skill: '선수',
      foil_ar: 6.5, wing_area_m2: 5.0, wing_ar: 4.5
    });
    // §176-E (2026-05-16): TWA 5° 균등 변경 후 SOG 비교는 invalid (서로 다른 tack 각).
    // race-context 표준 = VMG (Velocity Made Good upwind) 로 monotonicity 검증.
    check('§176-E: 선수 풍상 VMG > 상급 VMG (스킬 ↑ → VMG ↑)',
      up_pro.V_vmg_kt > up_advanced.V_vmg_kt);
    check('§176-E: 선수 tack 45° (5° 균등 TWA min)', up_pro.tack_angle_deg === 45);

    // 15) 입문 (η=0.45, tack=60°) — 10kt 5m² 로 풍상 불가 또는 매우 낮음
    var up_novice = upwindSpeed({
      v_wind_kt: 10, m_rider_kg: 70, gear_kg: 10, skill: '입문',
      foil_ar: 6.5, wing_area_m2: 5.0, wing_ar: 4.5
    });
    // §176-E: VMG 기준 monotonicity (동일 이유 — SOG 비교는 다른 tack 각이라 invalid).
    check('§176-E: 입문 풍상 VMG < 상급 VMG (스킬 ↓ → VMG ↓)',
      up_novice.V_vmg_kt < up_advanced.V_vmg_kt);
    check('§176-E: 입문 tack 65°', up_novice.tack_angle_deg === 65);

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
      var boostMax = windBoostKt(maxWing);
      var minWindRaw = vtarget_kt_precise - boostMax;
      result.min_wind_kt = Math.ceil(minWindRaw * 10) / 10;
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

     CL_WING_MAX: 일반 inflatable wingfoil wing 의 peak C_L (camber 10-12% AR~4)
       canonical 1.2 (Folkersma 2019 LEI airfoil + DMJ wind-tunnel proxy estimate). */
  var TACK_ANGLE_DEG = {
    '입문': 65, '초급': 60, '중급': 55,
    '상급': 50, '선수': 45, '상급-선수': 47
  };
  var CL_WING_MAX = 1.2;

  var PREF_FACTOR = {
    small: 0.92,   // 작게 쓰기 선호 (Danny)
    mid:   1.00,
    big:   1.08
  };

  function ldFoil(ar) { return 9.13 * Math.sqrt(ar); }
  function ldWing(ar) { return 1.83 * Math.sqrt(ar); }

  /* §179 (Danny 2026-05-16) — L/D(CL) wing polar (depower L/D drop)
     DO_NOT_REVERT §179.

     CD(CL, AR) = CD_0 + CL² / (π · e · AR)
     L/D(CL, AR) = CL / CD(CL, AR)
     CL_opt(AR) = √(CD_0·π·e·AR) = 0.360·√AR  (max L/D point)
     L/D_max(AR) = 1.83·√AR  (matches ldWing)

     Constants (LEI inflatable wing — Folkersma/Schmehl/Viré 2019):
       CD_0 = 0.098,  e = 0.42

     Implication: 큰 윙 depower → CL 떨어짐 → CD_0 dominate → L/D 폭락 →
     c_thrust = sin β − cos β/(L/D) 작아짐 → 큰 윙으로 갈수록 V_b ↓
     (depower regime 에서 wing area 효과가 살아남) */
  var WING_CD0 = 0.098;
  var WING_E = 0.42;
  function ldWingAtCL(cl, ar) {
    if (!isFinite(cl) || cl <= 0 || !isFinite(ar) || ar <= 0) return 0;
    var cd_i_factor = 1 / (Math.PI * WING_E * ar);
    var cd = WING_CD0 + cd_i_factor * cl * cl;
    return cl / cd;
  }
  function clOptWing(ar) { return 0.360 * Math.sqrt(ar); }

  /* §176 — 풍상 45° 진행 속도 (upwind polar equilibrium speed)
     입력: v_wind_kt, m_rider_kg, gear_kg, skill, foil_ar, wing_area_m2, wing_ar, c_l_max
     출력: V_boat_kt (tack 방향), V_vmg_kt (풍상 component), depowered/feasible flag 등 */
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
    var H_max  = mTotal * CONST.G * Math.tan(heelRad); // side-force capacity (N)

    function stateAt(V_b) {
      var V_a2 = V_b * V_b + V_t * V_t + 2 * V_t * V_b * Math.cos(tackRad);
      if (V_a2 <= 1e-9) {
        return { V_a: 0, beta: 0, sin_b: 0, cos_b: 1, CL: 0, T: 0, H: 0,
                 depowered: false, valid: false };
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
      var c_thrust_per_CL = sin_b - cos_b / LDwing_eff;
      var T = 0;
      if (c_thrust_per_CL > 0 && CL > 0) {
        T = 0.5 * WING_OPT.RHO_AIR * V_a2 * wingArea * CL * c_thrust_per_CL;
      }
      var H = 0.5 * WING_OPT.RHO_AIR * V_a2 * wingArea * CL * cos_b;
      return {
        V_a: V_a, beta: beta, sin_b: sin_b, cos_b: cos_b,
        CL: CL, T: T, H: H,
        depowered: (CL < CL_eff_max - 1e-6),
        valid: true
      };
    }

    // §176-C/D (Danny 2026-05-16): V_b sweep cap = 21 kt — iQFOiL 실측 SOG 상한.
    // Danny lock: "풍상 최고속도는 17-21노트 사이에서 형성됨"(2026-05-16 명시). 22-23은
    // burst/극강풍 영역으로 race-context VMG 모델에서 제외.
    // §176-E (2026-05-16): 선수 TWA 50°→45° 변경. 결과: 선수 (tack 45°) max VMG =
    // 21 × cos(45°) ≈ 14.8 kt. Danny "11-14 일반" 상한을 약간 상회 — 5° 균등 spacing
    // 의 직관성 우선 (race-context VMG 정밀도 후순위).
    // VMG = SOG × cos(TWA) — 일반 SOG 17-21 × cos(45-55°) → VMG 9.8-14.8.
    // Sweep V_b ∈ [0, 21 kt] in 0.1 kt steps. Find largest V_b where T ≥ D_foil.
    var V_max = 21 * CONST.KT_TO_MS;
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
      side_force_N: Math.round(bestState.H * 10) / 10,
      side_force_max_N: Math.round(H_max * 10) / 10,
      D_foil_N: Math.round(D_foil * 10) / 10,
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
    TACK_ANGLE_DEG: TACK_ANGLE_DEG,
    CL_WING_MAX: CL_WING_MAX
  };
})(typeof window !== 'undefined' ? window : this);
