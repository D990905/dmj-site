/* ==========================================================================
   단무지 — Foil presets (file:// 친화 — fetch CORS 우회용)
   SoT: site/data/foil-specs.json (수정 시 둘 다 동시 갱신 필수)
   DO_NOT_REVERT §102 Lift Calculator MVP · §170 v7 · §170 v8

   §170 v7 (2026-05-13): Levitaz R6 FW V1/V2/V3 본사 공식 spec lock — Danny verbatim.
   §170 v8 (2026-05-13): 전 Levitaz FW (Free Series 4 + R6 3) cross-validated
     against products.json·products/levitaz/*.html — 100% consistent.
     ⚠ Takoon 9 SKU AR/area 값은 estimated (Takoon Shopify SoT 에 AR field 부재).
        본사 공식 source 미확보 — Danny 검수 갱신 의무. 산출: outputs/v5/levitaz_fw_all_spec_2026-05-13.json.
   ==========================================================================
   사용법:
     <script src="data/foil-presets.js"></script>  // calculator.html
     window.DMJ_FOIL_PRESETS  → { levitaz: [...], takoon: [...] }
   ========================================================================== */
(function (global) {
  'use strict';
  global.DMJ_FOIL_PRESETS = {
    levitaz: [
      { id: 'lev-fw-540', model: 'Free Series FW 540', area_cm2: 540, ar: 8.4, tier: 'advanced·pro', use: 'race·downwind' },
      { id: 'lev-fw-680', model: 'Free Series FW 680', area_cm2: 680, ar: 8.7, tier: 'advanced', use: 'freeride·downwind 표준' },
      { id: 'lev-fw-790', model: 'Free Series FW 790', area_cm2: 790, ar: 10.3, tier: 'intermediate~advanced', use: 'cruise·jibe 학습' },
      { id: 'lev-fw-900', model: 'Free Series FW 900', area_cm2: 900, ar: 13.3, tier: 'beginner~intermediate', use: '조기 takeoff·낮은 speed' },
      { id: 'lev-r6-v1', model: 'R6 FW V1', area_cm2: 479, area_display_cm2: 480, ar: 13.7, tier: 'pro', use: 'race UHM thin — primary 사이즈 (§170 v7)' },
      { id: 'lev-r6-v2', model: 'R6 FW V2', area_cm2: 430, ar: 12.9, tier: 'pro', use: 'race UHM thin — 강풍 전용 작은 사이즈 (§170 v7)' },
      { id: 'lev-r6-v3', model: 'R6 FW V3', area_cm2: 530, ar: 14.3, tier: 'pro', use: 'race UHM thin — FORMULA WING registered (§170 v7 · G472585)' }
    ],
    chubanga: [
      { id: 'chu-pr-glider-530', model: 'PureRacing Glider 530', line: 'PureRacing', area_cm2: 530, ar: 9.59, max_chord_cm: 9.7, span_cm: 71.3, tier: 'intermediate~advanced', use: 'performance freeride — 중풍 cruise·jibe (§180-C Danny 2026-05-17 본사 spec)' },
      { id: 'chu-pr-glider-620', model: 'PureRacing Glider 620', line: 'PureRacing', area_cm2: 620, ar: 11.29, max_chord_cm: 9.9, span_cm: 83.7, tier: 'intermediate~advanced', use: 'light wind freeride — 약풍·고AR (§180-C Danny 2026-05-17 본사 spec)' }
    ],
    north: [
      { id: 'nor-ha-550', model: 'Sonar HA 550', line: 'Sonar HA', area_cm2: 550, ar: 10.0, ar_estimated: true, tier: 'advanced·pro', use: 'race·kite·high-speed (§180-E v2 AR estimated)' },
      { id: 'nor-ha-650', model: 'Sonar HA 650', line: 'Sonar HA', area_cm2: 650, ar: 10.0, ar_estimated: true, tier: 'advanced·pro', use: 'race·kite·high-speed (§180-E v2 AR estimated)' },
      { id: 'nor-ha-750', model: 'Sonar HA 750', line: 'Sonar HA', area_cm2: 750, ar: 10.0, ar_estimated: true, tier: 'advanced', use: 'race·high-speed wing/kite (§180-E v2 AR estimated)' },
      { id: 'nor-ha-850', model: 'Sonar HA 850', line: 'Sonar HA', area_cm2: 850, ar: 10.5, ar_estimated: true, tier: 'intermediate~advanced', use: 'core wing-foil·playful·responsive (§180-E v2 AR estimated)' },
      { id: 'nor-ha-950', model: 'Sonar HA 950', line: 'Sonar HA', area_cm2: 950, ar: 10.5, ar_estimated: true, tier: 'intermediate~advanced', use: 'core wing-foil·prone (§180-E v2 AR estimated)' },
      { id: 'nor-ha-1050', model: 'Sonar HA 1050', line: 'Sonar HA', area_cm2: 1050, ar: 10.5, span_cm: 105.0, tier: 'intermediate', use: 'core wing-foil·earlier lift (§180-E v2 본사 spec confirmed)' },
      { id: 'nor-ha-1150', model: 'Sonar HA 1150', line: 'Sonar HA', area_cm2: 1150, ar: 10.5, ar_estimated: true, tier: 'intermediate', use: 'light wind wing·downwind (§180-E v2 AR estimated)' },
      { id: 'nor-ha-1250', model: 'Sonar HA 1250', line: 'Sonar HA', area_cm2: 1250, ar: 10.5, ar_estimated: true, tier: 'beginner~intermediate', use: 'light wind·heavy rider·downwind (§180-E v2 AR estimated)' },
      { id: 'nor-ha-1450', model: 'Sonar HA 1450', line: 'Sonar HA', area_cm2: 1450, ar: 11.0, ar_estimated: true, tier: 'beginner~intermediate', use: 'very light wind·dock start·pumping (§180-E v2 AR estimated)' }
    ],
    takoon: [
      { id: 'tak-flow', model: 'Foil Flow Front Wing', area_cm2: 1100, ar: 5.0, tier: 'intermediate', use: 'freeride · forgiving radius' },
      { id: 'tak-flare', model: 'Foil Flare Front Wing', area_cm2: 950, ar: 5.5, tier: 'intermediate~advanced', use: 'freeride·wave 진입' },
      { id: 'tak-swell', model: 'Foil Swell Front Wing', area_cm2: 800, ar: 6.5, tier: 'advanced', use: 'wave·downwind' },
      { id: 'tak-flash', model: 'Foil Flash Front Wing', area_cm2: 700, ar: 7.5, tier: 'advanced·pro', use: 'speed·race-light' },
      { id: 'tak-x-glide', model: 'X-Glide V2 Front Wing', area_cm2: 1500, ar: 4.0, tier: 'beginner', use: 'first foil — large·forgiving' },
      { id: 'tak-x-glide-xs', model: 'XS Glide Front Wing', area_cm2: 1200, ar: 4.5, tier: 'beginner~intermediate', use: 'second foil progression' },
      { id: 'tak-starter', model: 'Foil Starter Front Wing', area_cm2: 1700, ar: 3.8, tier: 'beginner', use: 'very first foil — max forgiving' },
      { id: 'tak-pace', model: 'Foil Pace Front Wing', area_cm2: 800, ar: 7.0, tier: 'advanced', use: 'freeride performance' },
      { id: 'tak-pump-pro', model: 'Foil Pump Pro Front Wing', area_cm2: 1400, ar: 9.5, tier: 'advanced·pump', use: 'pump foil glide 전용' }
    ]
  };
})(typeof window !== 'undefined' ? window : this);
