/* ============================================================
 * chart-theme.js — 라이딩 대시보드 차트 디자인 토큰 (단일 소스)
 * ------------------------------------------------------------
 * 모든 차트(Chart.js · Leaflet · 커스텀 캔버스 폴라/바이올린)가
 * 색·폰트를 오직 이 파일에서 읽는다. 차트는 색·폰트를 하드코딩하지
 * 않는다. 전체 사양은 CHART-DESIGN-SYSTEM.md 를 참조한다.
 *
 * 색은 4계열로 분리한다 — 서로 의미가 다르므로 절대 섞지 않는다.
 *   1) status   — 성과 '잘함/못함' 전용. 5단계 앵커 + 연속 보간.
 *   2) side     — 포트/스타보드. 국제 항해 표준(좌현 홍·우현 녹).
 *   3) category — 지표 단순 구분. 빨강·초록 금지(중립 팔레트).
 *   4) hrZone   — 심박 존 Z1~Z5 고정 시퀀스.
 *
 * 핵심 규칙: 한 차트에서 색은 '좌우' 또는 '상태' 중 하나만
 * 인코딩한다. 둘 다 색으로 쓰지 않는다.
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 색 헬퍼 ---------- */
  function hexA(hex, a) {
    if (typeof hex === 'string' && hex.charAt(0) === '#' && hex.length === 7) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) +
        ',' + (n & 255) + ',' + a + ')';
    }
    return hex;
  }
  function toRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function lerp(a, b, f) { return a + (b - a) * f; }

  /* ============================================================
   * 1) 상태색 — 성과 '잘함/못함' 전용 (5단계 앵커)
   *    백분위로 더 잘게 색을 줄 땐 이 5앵커 사이를 연속 보간한다.
   * ============================================================ */
  var STATUS = {
    veryGood: '#1FA055',   /* 매우좋음 */
    good:     '#7FC241',   /* 좋음 */
    mid:      '#F2C20E',   /* 보통 */
    bad:      '#EC8A2E',   /* 나쁨 */
    veryBad:  '#D6453A'    /* 매우나쁨 */
  };
  /* goodness 0(매우나쁨) → 1(매우좋음) 램프 */
  var STATUS_RAMP = [
    [0.00, toRgb(STATUS.veryBad)],
    [0.25, toRgb(STATUS.bad)],
    [0.50, toRgb(STATUS.mid)],
    [0.75, toRgb(STATUS.good)],
    [1.00, toRgb(STATUS.veryGood)]
  ];
  /* goodness(0..1) → 보간된 상태색. 범위 밖은 clamp. */
  function statusAt(g) {
    g = clamp01(g);
    for (var i = 1; i < STATUS_RAMP.length; i++) {
      if (g <= STATUS_RAMP[i][0]) {
        var lo = STATUS_RAMP[i - 1], hi = STATUS_RAMP[i];
        var f = (g - lo[0]) / (hi[0] - lo[0] || 1);
        return 'rgb(' +
          Math.round(lerp(lo[1][0], hi[1][0], f)) + ',' +
          Math.round(lerp(lo[1][1], hi[1][1], f)) + ',' +
          Math.round(lerp(lo[1][2], hi[1][2], f)) + ')';
      }
    }
    return 'rgb(' + STATUS_RAMP[4][1].join(',') + ')';
  }

  /* 지표값 → '좋음 정도(goodness 0..1)'.
     지표별 '좋은 방향'을 반드시 반영한다 — '클수록 좋음' 일괄 가정 금지.
       'higher'  : 클수록 좋음   (SOG · VMG · 속도)
       'lower'   : 작을수록 좋음 (풍상 TWA)
       'twaDown' : 비단조 — 최적 ~145° 에서 멀수록 나쁨 (풍하 TWA)
       'heel'    : |값| 을 써서 작을수록 좋음 (Heel)
       'neutral' : 좋·나쁨을 단정하지 않음 → null (Pitch · HR)
     opts: { min, max, optimal, worstDelta } */
  function goodness(value, direction, opts) {
    opts = opts || {};
    if (value == null || !isFinite(value)) return null;
    if (direction === 'neutral') return null;
    var min = (opts.min != null) ? opts.min : 0;
    var max = (opts.max != null) ? opts.max : 1;
    var span = (max - min) || 1;
    if (direction === 'higher') return clamp01((value - min) / span);
    if (direction === 'lower')  return clamp01(1 - (value - min) / span);
    if (direction === 'heel') {
      var h = Math.abs(value);
      return clamp01(1 - (h - min) / span);
    }
    if (direction === 'twaDown') {
      var opt = (opts.optimal != null) ? opts.optimal : 145;
      var worst = (opts.worstDelta != null) ? opts.worstDelta : 55;
      return clamp01(1 - Math.abs(value - opt) / worst);
    }
    return null;   /* 알 수 없는 방향 — 상태색을 주지 않는다 */
  }
  /* 지표값 → 상태색. neutral·미정이면 null (호출부가 범주색으로 대체). */
  function statusColor(value, direction, opts) {
    var g = goodness(value, direction, opts);
    return (g == null) ? null : statusAt(g);
  }

  /* ============================================================
   * 2) 좌우색 — 포트(P) / 스타보드(S)
   *    국제 항해 표준: 좌현 홍등 · 우현 녹등.
   *    좌우 비교 차트의 시리즈/정체성 색.
   * ============================================================ */
  var SIDE = {
    port:        '#E12B2B',
    starboard:   '#00A651',
    portInk:     '#C42121',   /* 라이트 배경 위 글자 — 가독성 보정 */
    starboardInk:'#0B7C44'
  };

  /* ============================================================
   * 3) 범주색 — 지표 단순 구분 (좋·나쁨 의미 없음)
   *    빨강·초록 절대 금지 — 중립 팔레트. 필요 시 끝에서 확장.
   * ============================================================ */
  var CATEGORY = [
    '#0A2540',   /* navy */
    '#1F8FFF',   /* sea blue */
    '#1FB6B6',   /* teal */
    '#6B7A8D',   /* slate */
    '#7A5FA8',   /* muted violet (확장) */
    '#C58A2E'    /* muted amber (확장) */
  ];
  function categoryColor(i) {
    var n = CATEGORY.length;
    return CATEGORY[((i % n) + n) % n];
  }

  /* ============================================================
   * 4) 심박 존색 — Z1~Z5 고정 시퀀스 + 휴식
   * ============================================================ */
  /* §432 — 심박 존색을 SPS 5-tier 트래픽 라이트 팔레트와 hex 완전 일치시킨다
     (옥대표 "심박수 높으면 레드 낮으면 그린"). 낮은 심박=컴포트=그린, 높은
     심박=부담=레드. 표준 강도 팔레트(Z1 파랑…)가 아니라 옥대표 명시 결정:
       Z1 recovery = #00D97E (= SPS Elite 진초록)
       Z2 aerobic  = #4ADE80 (= SPS Advanced 연초록)
       Z3 tempo    = #FACC15 (= SPS Intermediate 노랑)
       Z4 threshold= #FB923C (= SPS Foundational 오렌지)
       Z5 anaerobic= #F87171 (= SPS Learning 레드)
     rest(Z1 미만 휴식)는 훈련 존 밖이라 중립 회색 유지. line(심박 곡선)은
     값 표시용 정체 적색(존 신호 아님)이라 옥대표 지시대로 붉은색 유지. */
  var HR_ZONE = {
    z1: '#00D97E', z2: '#4ADE80', z3: '#FACC15', z4: '#FB923C', z5: '#F87171',
    rest: '#8295A8',
    /* 심박 곡선 — 단일 시리즈 정체색(심장=적색 관례). 상태 인코딩 아님. */
    line: '#C0392B'
  };

  /* §432 v2 — 5-tier 신호등(형광) 팔레트 canonical, 낮음/나쁨→높음/좋음 순서.
     [0]레드(Learning) [1]오렌지(Foundational) [2]옐로(Intermediate)
     [3]라임(Advanced) [4]에메랄드(Elite). SPS(coach VPS_BANDS)·HR 존(HR_ZONE
     z5→z1)·속도 분포 파이가 공유하는 단일 tier 팔레트 = 대시보드 전역 정합.
     연속 보간용 STATUS(비네온 ramp)와는 의미·용도가 다르므로 섞지 않는다. */
  var SIGNAL5 = ['#F87171', '#FB923C', '#FACC15', '#4ADE80', '#00D97E'];

  /* ============================================================
   * 공통 베이스 — 축 · 격자 · 타이포 · 서피스
   * ============================================================ */
  var FONT_FAMILY = '-apple-system,BlinkMacSystemFont,"Segoe UI",' +
    '"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';

  var BASE = {
    ink:       '#5C6F7E',            /* 축 눈금·범례·축 제목 (slate) */
    inkStrong: '#0A2540',            /* 강조 라벨 (navy) */
    inkDim:    '#6E7C8A',            /* 보조·캡션 */
    onDark:    '#FFFFFF',
    grid:      'rgba(10,37,64,0.07)',
    gridWidth: 1,
    line:      '#0A2540',            /* 기본 속도/SOG 곡선 (navy) */
    fill:      'rgba(31,143,255,0.10)',
    cursor:    '#FFB800',            /* hover 커서 점 */
    panel:     'rgba(10,37,64,0.92)',/* crosshair 라벨 박스 */
    faintLine: 'rgba(10,37,64,0.20)' /* 다중 회전 개별 곡선 */
  };

  /* 회전 종류색 — 택/자이브/회전. 범주 성격(좋·나쁨 의미 없음). */
  var MANEUVER = { tack: '#1F8FFF', gybe: '#EF7D00', turn: '#8295A8' };

  /* 차트 chrome 색 — 데이터 인코딩이 아닌 에디터·플롯 보조 요소. */
  var CHROME = {
    apex:    'rgba(214,69,58,0.85)',  /* 회전 정점 표시선 */
    exclude: 'rgba(92,111,126,0.20)', /* 제외 구간 음영 */
    trim:    '#E0A100'                /* 트림 핸들 */
  };

  /* 폰트 — 캔버스 ctx.font 문자열 헬퍼 + 표준 크기 */
  var FONT = {
    family: FONT_FAMILY,
    sizeAxisTitle: 11,  /* 축 제목 */
    sizeTick: 10,       /* 축 눈금 라벨 */
    sizeLegend: 11,     /* 범례 */
    sizeLabel: 10,      /* 데이터 라벨 */
    /* 캔버스용 — css(weight, px) → "600 11px <family>" */
    css: function (weight, px) {
      return (weight ? weight + ' ' : '') + px + 'px ' + FONT_FAMILY;
    }
  };

  /* ============================================================
   * Chart.js 전역 기본값 — 폰트·색·격자·범례를 한 번에 통일.
   * 레전드: 위치 1종(하단 중앙) · 스왓치 1종(사각형) · 폰트 1종.
   * 축·격자: 격자색·굵기 1종 · 축 라벨/제목 폰트 1종.
   * ============================================================ */
  function applyChartDefaults(Chart) {
    if (!Chart || !Chart.defaults) return;
    var d = Chart.defaults;
    d.font.family = FONT_FAMILY;
    d.font.size = FONT.sizeTick;
    d.color = BASE.ink;
    d.borderColor = BASE.grid;
    if (d.plugins && d.plugins.legend) {
      var lg = d.plugins.legend;
      lg.position = 'bottom';                 /* 위치 1종 — 하단 중앙 */
      lg.align = 'center';
      lg.labels = lg.labels || {};
      lg.labels.usePointStyle = false;        /* 스왓치 1종 — 사각형 */
      lg.labels.boxWidth = 12;
      lg.labels.boxHeight = 12;
      lg.labels.padding = 14;
      lg.labels.color = BASE.ink;
      lg.labels.font = { family: FONT_FAMILY, size: FONT.sizeLegend };
    }
    if (d.scale) {
      if (d.scale.grid) {
        d.scale.grid.color = BASE.grid;
        d.scale.grid.lineWidth = BASE.gridWidth;
      }
      if (d.scale.ticks) {
        d.scale.ticks.color = BASE.ink;
        d.scale.ticks.font = { family: FONT_FAMILY, size: FONT.sizeTick };
      }
      if (d.scale.title) {
        d.scale.title.color = BASE.ink;
        d.scale.title.font = {
          family: FONT_FAMILY, size: FONT.sizeAxisTitle, weight: '600'
        };
      }
    }
  }

  /* charts.js 의 기존 THEME 객체와 키가 1:1 인 호환 뷰 —
     기존 호출부를 그대로 두고 색만 토큰으로 중앙화하기 위한 것. */
  var legacy = {
    text:      BASE.ink,
    textHi:    BASE.inkStrong,
    grid:      BASE.grid,
    line:      BASE.line,
    fill:      BASE.fill,
    sea:       '#1F8FFF',
    sun:       '#EF7D00',
    good:      STATUS.veryGood,
    bad:       STATUS.veryBad,
    cursor:    BASE.cursor,
    panel:     BASE.panel,
    faintLine: BASE.faintLine
  };

  global.RDChartTheme = {
    hexA: hexA,
    /* 1) 상태색 */
    status: STATUS, statusAt: statusAt, goodness: goodness, statusColor: statusColor,
    /* 2) 좌우색 */
    side: SIDE,
    /* 3) 범주색 */
    category: CATEGORY, categoryColor: categoryColor,
    /* 4) 심박 존색 */
    hrZone: HR_ZONE,
    /* 공통 */
    base: BASE, maneuver: MANEUVER, chrome: CHROME, font: FONT,
    legacy: legacy,
    applyChartDefaults: applyChartDefaults
  };
})(typeof window !== 'undefined' ? window : globalThis);
