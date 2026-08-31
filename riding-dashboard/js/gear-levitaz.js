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
  var HAND_WINGS = [
    { id: 'sonic_50', label: 'PPC Sonic 5.0', areaM2: 5.0, spanCm: 330, chordCm: 202 },
    { id: 'sonic_55', label: 'PPC Sonic 5.5', areaM2: 5.5, spanCm: 346, chordCm: 212 },
    { id: 'sonic_60', label: 'PPC Sonic 6.0', areaM2: 6.0, spanCm: 361, chordCm: 222 },
    { id: 'sonic_65', label: 'PPC Sonic 6.5', areaM2: 6.5, spanCm: 369, chordCm: 236 },
    { id: 'sonic_70', label: 'PPC Sonic 7.0', areaM2: 7.0, spanCm: 383, chordCm: 244 },
    { id: 'sonic_74', label: 'PPC Sonic 7.4', areaM2: 7.4, spanCm: 384, chordCm: 255 },
    { id: 'sonic_80', label: 'PPC Sonic 8.0', areaM2: 8.0, spanCm: 385, chordCm: 264 }
  ];

  /* 보드 — 두께는 손 높이(힐 시 윙 팁 클리어런스) 계산에 쓴다. */
  var BOARDS = [
    { id: 'board_default', label: 'Board', thicknessCm: 12, weightKg: 7, verified: false }
  ];

  /* 수면 상태 — 팁이 파도에 닿지 않으려면 남겨야 할 여유(cm).
     플랫에서는 조금만 있어도 되고, 거칠수록 크게 잡아야 한다. */
  var SURFACE = [
    { id: 'flat',   label: 'Flat',   foilMarginCm: 10, wingMarginCm: 10 },
    { id: 'chop',   label: 'Choppy', foilMarginCm: 25, wingMarginCm: 30 },
    { id: 'wavy',   label: 'Wavy',   foilMarginCm: 40, wingMarginCm: 50 }
  ];

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
    kg += (b && b.weightKg) ? b.weightKg : 7;
    kg += 3;                     /* 핸드윙 — 제조사 미공개, 5㎡ 기준 추정 */
    return kg;
  }

  var API = {
    FRONT_WINGS: FRONT_WINGS, REAR_WINGS: REAR_WINGS, MASTS: MASTS,
    HAND_WINGS: HAND_WINGS, BOARDS: BOARDS, SURFACE: SURFACE,
    byId: byId, rigMassKg: rigMassKg,
    /* 기본 선택 — 옥대표 상용 세팅 */
    DEFAULT: { frontWing: 'r6v1', rearWing: 'rear_v1', mast: 'mast_v1',
               handWing: 'sonic_50', board: 'board_default', surface: 'chop' }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDGear = API;
})(typeof window !== 'undefined' ? window : globalThis);
