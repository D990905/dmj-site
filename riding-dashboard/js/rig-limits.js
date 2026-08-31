/* ============================================================
 * rig-limits.js — 장비 기하가 정하는 힐·윙 한계 (§465)
 *
 * 옥대표 설명(2026-08-31)을 모델로 옮긴 것:
 *
 *   "보드를 힐 시키면 포일의 윙스팬이 길 경우 팁이 물밖으로 나와서
 *    벤틸레이션이 생기거나, 윙의 스팬이 너무 크면 윙의 팁이 수면에
 *    걸려서 넘어지게 되지. 바람을 견디려면 포일을 수직에서 수평으로
 *    기울여야 받을 수 있는 힘이 커지는데, 이게 윙 사이즈·포일 스팬·
 *    마스트 길이·힐의 양·수면의 거칠기에 다 영향을 받는다."
 *
 * 즉 사슬은 이렇다:
 *   힐 ↑ → 버틸 수 있는 옆힘 ↑ → 더 큰 윙 가능
 *   그런데 힐은 (a) 포일 팁 노출  (b) 윙 팁 접촉 두 곳에서 막힌다
 *   그리고 수면이 거칠수록 두 여유가 모두 깎인다
 *
 * 그래서 "몇 ㎡ 를 쓸 수 있나" 는 바람만으로 답할 수 없다.
 *
 * 브라우저: RDRigLimits.*  ·  Node: require('./rig-limits')
 * ============================================================ */
(function (global) {
  'use strict';

  var G = 9.81, RHO_WATER = 1025, KT = 1.94384;

  /* 라이드 높이 — 보드 바닥이 수면 위로 뜬 높이(cm).
     실측이 어려워 기본값을 둔다. 이 값이 커질수록 잠긴 마스트가 짧아져
     힐 여유가 줄어든다. */
  var DEFAULT_RIDE_HEIGHT_CM = 30;
  /* 손 높이 — 보드 위로 라이더가 윙을 잡고 있는 높이(cm). */
  var DEFAULT_HAND_HEIGHT_CM = 110;

  function deg2rad(d) { return d * Math.PI / 180; }

  /* 포일 팁이 잠긴 채 유지되는 최대 힐(도).
     잠긴 마스트 depth = mast − rideHeight.
     힐 θ 에서 풍상쪽 팁 깊이 = depth·cosθ − (span/2)·sinθ.
     이게 margin 밑으로 떨어지면 공기를 물고 벤틸레이션이 난다. */
  function maxHeelFoil(mastCm, foilSpanCm, rideHeightCm, marginCm) {
    var depth = mastCm - rideHeightCm;
    if (!(depth > 0)) return 0;
    for (var d = 0; d <= 80; d += 0.5) {
      var r = deg2rad(d);
      if (depth * Math.cos(r) - (foilSpanCm / 2) * Math.sin(r) < marginCm) {
        return Math.max(0, d - 0.5);
      }
    }
    return 80;
  }

  /* 핸드윙 팁이 수면에 닿기 전까지의 최대 힐(도).
     손 높이 = rideHeight + boardThickness + handHeight.
     힐 θ 에서 풍하쪽 팁 높이 ≈ 손높이 − (span/2)·sinθ. */
  function maxHeelWing(wingSpanCm, rideHeightCm, boardThicknessCm,
                       handHeightCm, marginCm) {
    var pivot = rideHeightCm + boardThicknessCm + handHeightCm;
    for (var d = 0; d <= 80; d += 0.5) {
      if (pivot - (wingSpanCm / 2) * Math.sin(deg2rad(d)) < marginCm) {
        return Math.max(0, d - 0.5);
      }
    }
    return 80;
  }

  /* 최소 비행 속도(kt) — 포일 면적이 정한다.
     V_min = √(2·M·g / (ρ·A·CL_max)). M 은 라이더+장비 전체. */
  function minFlyingSpeedKt(totalMassKg, foilAreaCm2, clMax) {
    var A = foilAreaCm2 / 10000;
    var cl = (clMax > 0) ? clMax : 0.9;
    if (!(A > 0) || !(totalMassKg > 0)) return null;
    return Math.sqrt(2 * totalMassKg * G / (RHO_WATER * A * cl)) * KT;
  }

  /* 힐 θ 에서 라이더가 버틸 수 있는 옆힘(N).
     지렛대는 **라이더 질량만** — 보드·포일은 발밑에 매달려 모멘트에
     거의 기여하지 않는다. 여기에 장비 무게를 더하면 용량이 부풀어
     실제보다 큰 윙을 권하게 된다. */
  function sideForceCapacityN(riderMassKg, heelDeg) {
    return riderMassKg * G * Math.tan(deg2rad(heelDeg));
  }

  /* 장비·수면 조합의 한계를 한 번에.
     sel = { mast, frontWing, handWing, board, surface } — RDGear 객체들
     opts = { rideHeightCm, handHeightCm, clMax, riderMassKg, totalMassKg } */
  function analyze(sel, opts) {
    opts = opts || {};
    var rideH = opts.rideHeightCm != null ? opts.rideHeightCm : DEFAULT_RIDE_HEIGHT_CM;
    var handH = opts.handHeightCm != null ? opts.handHeightCm : DEFAULT_HAND_HEIGHT_CM;
    var surf = sel.surface || { foilMarginCm: 25, wingMarginCm: 30, label: 'Choppy' };

    var heelFoil = maxHeelFoil(sel.mast.lengthCm, sel.frontWing.spanCm,
                               rideH, surf.foilMarginCm);
    var heelWing = maxHeelWing(sel.handWing.spanCm, rideH,
                               sel.board.thicknessCm, handH, surf.wingMarginCm);
    var heelMax = Math.min(heelFoil, heelWing);
    var binding = (heelFoil <= heelWing) ? 'foil' : 'wing';

    return {
      rideHeightCm: rideH,
      surface: surf.label,
      maxHeelFoilDeg: heelFoil,
      maxHeelWingDeg: heelWing,
      maxHeelDeg: heelMax,
      /* 어느 쪽이 먼저 막는가 — 장비를 바꿔야 할 방향을 알려준다 */
      bindingConstraint: binding,
      sideForceCapacityN: opts.riderMassKg
        ? sideForceCapacityN(opts.riderMassKg, heelMax) : null,
      minFlyingSpeedKt: opts.totalMassKg
        ? minFlyingSpeedKt(opts.totalMassKg, sel.frontWing.areaCm2, opts.clMax) : null
    };
  }

  /* ---------- 윙 사이즈 추천 (§468) ----------
     옥대표 실사용을 그대로 재현하는 규칙을 찾았다.

       풍속   실사용   필요힐   가능힐   여유
       10kt   6.5㎡     19°      47°     27°
       12kt   6.0㎡     28°      48°     20°
       14kt   5.5㎡     35°      51°     15°
       18kt   5.0㎡     49°      54°      5°
       22kt   4.5㎡     58°      58°      0°

     여유가 단조 감소해 22kt 에서 정확히 0 이 된다. 즉 선택 규칙은
     **필요한 힐이 기하 한계 안에 들어오는 가장 큰 윙** 이다.
     약풍에서 여유가 큰 것은 그보다 큰 윙이 없기 때문이지 여유를 남기려는
     것이 아니다.

     필요 힐 = atan(윙 옆힘 / 라이더 무게).
     가능 힐 = min(윙 팁 접촉 한계, 포일 벤틸레이션 한계).

     safetyDeg 는 한계에 딱 붙지 않도록 남기는 각도. 0 이면 옥대표 실사용과
     일치하고, 키우면 보수적으로 간다. */
  function recommendWing(opts) {
    var wings = opts.wings || [];
    var side = opts.sideForceAt;          /* function(areaM2) -> N */
    if (typeof side !== 'function') return null;
    var riderN = opts.riderMassKg * G;
    var safety = opts.safetyDeg || 0;

    var rows = wings.map(function (w) {
      var F = side(w.areaM2);
      if (F == null || !isFinite(F) || F <= 0) return null;
      var reqDeg = Math.atan(F / riderN) * 180 / Math.PI;
      var hw = maxHeelWing(w.spanCm, opts.rideHeightCm, opts.boardThicknessCm,
                           opts.handHeightCm, opts.wingMarginCm);
      var hf = maxHeelFoil(opts.mastCm, opts.foilSpanCm, opts.rideHeightCm,
                           opts.foilMarginCm);
      var avail = Math.min(hw, hf);
      return {
        areaM2: w.areaM2, label: w.label, estimated: !!w.estimated,
        requiredHeelDeg: reqDeg,
        availableHeelDeg: avail,
        limitedBy: (hw <= hf) ? 'wing' : 'foil',
        marginDeg: avail - reqDeg,
        fits: (avail - reqDeg) >= safety
      };
    }).filter(Boolean);

    /* 들어맞는 것 중 가장 큰 윙 */
    var best = null;
    rows.forEach(function (r) {
      if (!r.fits) return;
      if (!best || r.areaM2 > best.areaM2) best = r;
    });
    /* 하나도 안 맞으면 여유가 가장 덜 부족한 것(= 가장 작은 윙) */
    if (!best && rows.length) {
      best = rows.reduce(function (a, b) {
        return b.marginDeg > a.marginDeg ? b : a;
      });
    }
    return { rows: rows, recommended: best };
  }

  var API = {
    maxHeelFoil: maxHeelFoil, maxHeelWing: maxHeelWing,
    minFlyingSpeedKt: minFlyingSpeedKt,
    sideForceCapacityN: sideForceCapacityN,
    analyze: analyze, recommendWing: recommendWing,
    DEFAULT_RIDE_HEIGHT_CM: DEFAULT_RIDE_HEIGHT_CM,
    DEFAULT_HAND_HEIGHT_CM: DEFAULT_HAND_HEIGHT_CM
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDRigLimits = API;
})(typeof window !== 'undefined' ? window : globalThis);
