/* ============================================================
 * gear-levitaz.js — 장비 스펙 라이브러리 (§465)
 *
 * 옥대표 실장비. 모든 계산(최소 비행속도·벤틸레이션 한계·옆힘 용량)의
 * 단일 출처다. 추측값을 코드 여기저기 흩어 두지 않기 위해 한곳에 모은다.
 *
 * 출처: Levitaz 공식 스펙 시트(옥대표 제공). 제조사 웹사이트 상품 페이지와
 * World Sailing 3D 스캐너 리포트에는 치수가 없다(후자는 공차만 담김).
 *
 * 브라우저: RDGear.*  ·  Node: require('./gear-levitaz')
 * ============================================================ */
(function (global) {
  'use strict';

  /* 프론트 윙 — 면적이 최소 비행속도를, 스팬이 벤틸레이션 한계를 정한다. */
  var FRONT_WINGS = [
    { id: 'r6v2', label: 'Levitaz R6 V2', areaCm2: 430, spanCm: 74,
      ar: 12.9, weightG: 1170, item: 'G467114' },
    { id: 'r6v1', label: 'Levitaz R6 V1', areaCm2: 479, spanCm: 80,
      ar: 13.7, weightG: 1248, item: 'G461562' },
    /* V3 = 530 cm² · 옥대표 확인 2026-08-31.
       쿼버가 면적 순이 아님에 주의: V2(430) < V1(479) < V3(530). */
    { id: 'r6v3', label: 'Levitaz R6 V3', areaCm2: 530, spanCm: 87,
      ar: 14.3, weightG: 1322, item: 'G472585' }
  ];

  var REAR_WINGS = [
    { id: 'rear_v1', label: 'Rear R6 V1', areaCm2: 172, spanCm: 46,
      ar: 12.6, weightG: 222, item: 'G463777' },
    { id: 'rear_v2', label: 'Rear R6 V2', areaCm2: 172, spanCm: 44,
      ar: 11.3, weightG: 227, item: 'G462363' }
  ];

  /* 마스트 — length 는 보드 바닥~글라이더. overall 은 박스 삽입부 포함.
     물에 잠기는 유효 길이는 length − 라이드 높이다. */
  var MASTS = [
    { id: 'mast_v1', label: 'Mast R6 V1', lengthCm: 113, overallCm: 118,
      weightG: 1732, item: 'G460700' },
    { id: 'mast_v2', label: 'Mast R6 V2', lengthCm: 113, overallCm: 118,
      weightG: 1706, item: 'G462245' }
  ];

  /* 핸드윙 — PPC Sonic FDS. 스팬이 힐 한계(팁 접촉)를 정한다.
     주목: 7.0 이상은 스팬이 거의 안 늘고(3.83→3.85 m) 코드만 커진다.
     즉 큰 사이즈로 갈수록 팁 접촉 위험이 비례해 늘지는 않는다 —
     추천 로직이 이 비선형성을 알아야 한다. */
  /* 옥대표 실제 선택표 (2026-08-31 본인 확인).
     ────────────────────────────────────────────────────────────
     이걸 추천의 **기준선**으로 쓴다. 물리 모델로 이 표를 재현하려
     시도했으나 되지 않았다 —

       풍속   최소필요윙   실사용   기하최대
       12kt     6.0         6.0      6.5
       14kt     4.0         5.5      6.5
       18kt     4.0         5.0      5.5
       22kt     4.0         4.5      4.5

     저풍에서는 최소를, 강풍에서는 최대를 고른다. 단일 물리 규칙으로
     떨어지지 않는다. 본인 설명이 이유를 말해준다 —

       "약풍에서 좀 더 큰 걸 써도 될 것 같은데 무겁기도 하고 커서
        불편해서 피하는 편이야. 좀 작게 쓰는 편이야 전반적으로.
        겉보기 바람이 있으면 작아도 달리면서 파워가 생기니까."

     즉 무게·취급성 선호와 겉보기 바람 활용이 섞인 판단이고, 정상상태
     VMG 모델은 그걸 표현하지 못한다. 다섯 점으로 곡선을 맞추면 그건
     맞춘 게 아니라 외운 것이므로, 표를 그대로 쓰고 물리는 **한계
     경고**로만 쓴다(예: "초피에서 이 조합은 힐 한계의 91%").
     ──────────────────────────────────────────────────────────── */
  var WIND_TO_WING = [
    { maxKt: 10, areaM2: 6.5 },
    { maxKt: 12, areaM2: 6.0 },
    { maxKt: 16, areaM2: 5.5 },
    { maxKt: 20, areaM2: 5.0 },
    { maxKt: 99, areaM2: 4.5 }
  ];

  function wingForWind(windKt) {
    for (var i = 0; i < WIND_TO_WING.length; i++) {
      if (windKt <= WIND_TO_WING[i].maxKt) return WIND_TO_WING[i].areaM2;
    }
    return WIND_TO_WING[WIND_TO_WING.length - 1].areaM2;
  }

  var HAND_WINGS = [
    /* ⚠ 4.0 은 PPC 공식 스펙표에 없다(Sonic FDS 는 5.0 부터). 옥대표가
       계산 범위에 넣으라 해 5.0~6.0 구간의 기울기(1㎡ 당 스팬 +31cm)로
       외삽했다. 실물 스팬을 재면 그 값으로 교체할 것. */
    /* 4.0 · 4.5 는 옥대표 특별 주문 제작품 — 공식 스펙표에 없다.
       5.0~6.0 기울기(1㎡ 당 스팬 +31cm)로 외삽했다. 실물을 재면 교체할 것.
       이 스팬이 힐 한계를 직접 정하므로 추정임을 UI 에 표시한다. */
    { id: 'sonic_40', label: 'PPC Sonic 4.0', areaM2: 4.0, spanCm: 300,
      chordCm: 177, estimated: true, custom: true },
    { id: 'sonic_45', label: 'PPC Sonic 4.5', areaM2: 4.5, spanCm: 315,
      chordCm: 190, estimated: true, custom: true },
    { id: 'sonic_50', label: 'PPC Sonic 5.0', areaM2: 5.0, spanCm: 330, chordCm: 202 },
    { id: 'sonic_55', label: 'PPC Sonic 5.5', areaM2: 5.5, spanCm: 346, chordCm: 212 },
    { id: 'sonic_60', label: 'PPC Sonic 6.0', areaM2: 6.0, spanCm: 361, chordCm: 222 },
    { id: 'sonic_65', label: 'PPC Sonic 6.5', areaM2: 6.5, spanCm: 369, chordCm: 236 },
    /* 보유 쿼버는 4.0~6.5 여섯 장이다(옥대표 확인). 7.0·7.4·8.0 은
       PPC 라인업에 있지만 보유하지 않아 추천 대상에서 뺀다 — 없는 걸
       권하면 추천이 아니다. */
  ];

  /* 보드 — 두께는 손 높이(힐 시 윙 팁 클리어런스) 계산에 쓴다. */
  var BOARDS = [
    { id: 'board_default', label: 'Board', thicknessCm: 12, weightKg: 4.8 }
  ];

  /* 하네스 위치 — 윙을 잡는 높이가 힐 여유를 바꾼다.
     옥대표 설명(2026-08-31):
       "윙이 커지거나 바람이 오버면 가슴쪽으로 하네스를 올리는 게 편하다.
        엉덩이를 빼고 상체를 주면서 끌려가듯이 타기가 편해.
        풀파워일 때는 엉덩이쪽으로 최대한 내려서 윙을 아래로 끌어내려
        힘이 아래로 실리게 한다. 윙의 힘이 아래로 실려야 보드를
        안정적으로 누를 수가 있다."

     기하로 보면 맞바꿈이다 —
       높게 잡으면(가슴) 윙 팁이 수면에서 멀어져 **힐 여유가 커진다**.
       낮게 끌어내리면 힘이 아래로 실려 **보드를 누르지만 팁 여유를 잃는다**.
     heightFrac 는 키 대비 보드 위 높이 비율(인체계측 근사). */
  /* 인체계측 근사 — 보드 위에 선 상태의 높이 / 키.
     ⚠ 옥대표 교정(2026-08-31): "가슴으로 올린다는 아니고 약간 위로
     올리는 거지, 명치 아래 정도." 처음에 가슴(0.72)으로 잡았던 것을
     명치 아래(0.64)로 낮춘다 — 175cm 기준 126cm 가 아니라 112cm 다.
     허리(102cm) 대비 10cm 위지 24cm 위가 아니다. */
  var HARNESS = [
    { id: 'raised', label: 'Raised (below sternum)', heightFrac: 0.64,
      note: 'overpowered — hips back, upper body forward, dragged along' },
    { id: 'waist', label: 'Waist (normal)', heightFrac: 0.58,
      note: 'the usual position' },
    { id: 'low',   label: 'Pulled low (full power)', heightFrac: 0.50,
      note: 'loads the wing force downward onto the board' }
  ];

  /* 수면 상태 — 팁이 파도에 닿지 않으려면 남겨야 할 여유(cm).
     플랫에서는 조금만 있어도 되고, 거칠수록 크게 잡아야 한다. */
  var SURFACE = [
    { id: 'flat',   label: 'Flat',   foilMarginCm: 10, wingMarginCm: 10 },
    { id: 'chop',   label: 'Choppy', foilMarginCm: 25, wingMarginCm: 30 },
    { id: 'wavy',   label: 'Wavy',   foilMarginCm: 40, wingMarginCm: 50 }
  ];

  /* 핸드윙 무게 — 제조사 미공개. 옥대표 실측 약 3 kg(5㎡ 기준). */
  var HAND_WING_MASS_KG = 3.0;

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 장비 셋의 총 중량(kg) — 양력이 들어야 할 무게. 라이더는 별도. */
  function rigMassKg(sel) {
    var g = 0;
    var f = byId(FRONT_WINGS, sel.frontWing);
    var r = byId(REAR_WINGS, sel.rearWing);
    var m = byId(MASTS, sel.mast);
    var b = byId(BOARDS, sel.board) || BOARDS[0];
    if (f) g += f.weightG;
    if (r) g += r.weightG;
    if (m) g += m.weightG;
    var kg = g / 1000;
    kg += (b && b.weightKg) ? b.weightKg : 4.8;
    kg += HAND_WING_MASS_KG;
    return kg;
  }

  var API = {
    FRONT_WINGS: FRONT_WINGS, REAR_WINGS: REAR_WINGS, MASTS: MASTS,
    HAND_WINGS: HAND_WINGS, BOARDS: BOARDS, SURFACE: SURFACE,
    HARNESS: HARNESS,
    WIND_TO_WING: WIND_TO_WING, wingForWind: wingForWind,
    /* 하네스 높이(보드 위 cm) — 키에서 낸다 */
    harnessHeightCm: function (riderHeightCm, harnessId) {
      var h = byId(HARNESS, harnessId) || byId(HARNESS, 'waist');
      return Math.round((riderHeightCm || 175) * h.heightFrac);
    },
    byId: byId, rigMassKg: rigMassKg,
    /* 기본 선택 — 옥대표 상용 세팅 */
    DEFAULT: { frontWing: 'r6v1', rearWing: 'rear_v1', mast: 'mast_v1',
               handWing: 'sonic_50', board: 'board_default', surface: 'chop',
               harness: 'waist' }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDGear = API;
})(typeof window !== 'undefined' ? window : globalThis);
