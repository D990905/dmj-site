/* ============================================================
 * coach.js — Coach Danny 분석 엔진 (라이딩 통계 대시보드)
 *
 * 두 가지 산출물:
 *   1) VPS (Vantage Performance Score) — 0~100 세션 점수
 *      Upwind / Overall / Downwind 3분할.
 *   2) What-if — 라이더의 실측 풍상 VMG 에 앵커링한 윙 사이즈 스윕.
 *      계산기는 윙-사이즈 곡선의 *상대 모양* 만 제공하고, 절대 스케일은
 *      라이더의 실측값이 결정한다 (자기모순 방지 — computeWhatIf 주석).
 *
 * analysis.js 와 같은 "UI 의존 없는 순수 로직" 원칙을 따른다.
 * 단, 물리 레퍼런스로 리프팅 계산기(DMJLift, lift-calculator.js)를
 * 사용하므로 그 전역(또는 require) 의존이 추가된다.
 *
 * ── VPS 설계 (Danny 검토용 — DO 명시) ───────────────────────
 * 가중: 직선 속도 70% + 회전(택킹·자이빙) 30% (Vantage 문서 기준).
 *
 * [회전 30%] 이미 산출되는 회전 효율 점수(0~100) 평균을 그대로 사용.
 *   · Upwind   = 택킹 효율 평균   (택킹은 풍상 기동)
 *   · Downwind = 자이빙 효율 평균 (자이빙은 풍하 기동)
 *   · Overall  = 전체 회전 효율 평균
 *   카드 표시용으로 각 segment 에 tackScore·gybeScore 를 함께 실어,
 *   사용자가 SPS 안에서 택킹·자이빙 성능을 따로 본다 (Upwind=택킹만,
 *   Downwind=자이빙만, Overall=둘 다). 합성 점수의 회전 항(turnScore)은
 *   위 회전 점수 그대로 — 표시용 분해만 추가한 것이라 카드 총점 불변.
 *
 * [속도 70%] "코치 기준 절대 스케일". 클래스 벤치마크 데이터셋이
 *   없으므로, 그 세션의 바람·라이더·장비를 리프팅 계산기에 넣어
 *   얻은 "달성 가능 속도" 대비 실측 속도의 비율을 0~100 으로 환산.
 *
 *   · Upwind 속도 점수 — 계산기 upwindSpeed() 의 풍상 VMG 예측치
 *     대비 실측 풍상 VMG(상위 50%, 시간가중) 의 비율 ratio:
 *        score = clamp( (ratio − 0.0) / (1.0 − 0.0) × 100, 0, 100 )
 *        → 100점 = 예측 VMG 도달/초과,  점수 ≈ ratio×100 (백분위형, §424).
 *     계산기 예측은 입력한 스킬 등급에 맞춰진 값이므로(η·tack 각),
 *     100점은 "세계 최고"가 아니라 "입력 조건의 물리 모델이 본
 *     달성 가능치에 도달" 을 뜻한다.
 *
 *   · Downwind 속도 점수 — 계산기에는 풍하(downwind) 속도 모델이
 *     없다. 정밀치를 지어내지 않기 위해, 같은 조건의 풍상 보드
 *     속도(V_boat, 스킬·체중·장비 반영) 를 *상대 기준*으로만 써서
 *     실측 풍하 SOG(상위 50%) 를 평가한다:
 *        ratio = 풍하 SOG / 풍상 V_boat
 *        score = clamp( (ratio − 0.0) / (1.6 − 0.0) × 100, 0, 100 )   (§424)
 *        → 풍하 SOG = 풍상 V_boat × 1.6 → 100,  × 1.0 → ~62,  × 0 → 0.
 *     이는 휴리스틱이며 풍하 폴라 정밀 예측이 아니다 (v2 개선 예정).
 *
 *   · Overall 속도 점수 = 풍상·풍하 속도 점수의 풍상/풍하 주행
 *     시간 가중 평균.
 *
 * VPS(segment) = 0.7 × 속도 점수 + 0.3 × 회전 점수.
 *   속도 점수를 못 구하면(계산기가 풍상 주행 불가로 예측 등) 그
 *   segment VPS 는 산출 불가(null)로 둔다 — 회전 점수만으로 VPS 를
 *   부르지 않는다. 회전 데이터가 없으면 속도 점수를 100% 로 환산.
 *
 * 델타(+/−): 라이더 본인이 이전에 저장한 세션의 VPS 대비 변화.
 *   (storage.js 의 다중 세션 저장 활용 — app.js 에서 처리.)
 * ============================================================ */
(function (global) {
  'use strict';

  /* 브라우저: lift-calculator.js 가 window.DMJLift 를 노출.
     Node: lift-calculator IIFE 의 this 가 module.exports 이므로
     require() 결과의 .DMJLift 로 접근 (UMD 비대칭 처리). */
  var Lift = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('../../assets/js/lift-calculator.js') : null;
  function liftAPI() {
    if (global.DMJLift && global.DMJLift.upwindSpeed) return global.DMJLift;
    if (Lift && Lift.upwindSpeed) return Lift;
    if (Lift && Lift.DMJLift && Lift.DMJLift.upwindSpeed) return Lift.DMJLift;
    return null;
  }

  var MS_TO_KT = 1.9438444924406;     // m/s -> 노트

  /* i18n 변환 헬퍼 — 코치 카드 텍스트가 영어 모드에서 영어로 생성되게.
     RDI18n 미로드 시 한국어 원문(폴백). */
  function i18nT(k, v) {
    return (global.RDI18n && global.RDI18n.T) ? global.RDI18n.T(k, v) : k;
  }

  /* --- VPS 튜닝 파라미터 (코치 검증으로 보정 가능) ---
     §424 (2026-06-24) — SPS magnitude 재보정. DO_NOT_REVERT §424.
       증상: 동일 GPX 가 Vantage Sailing SPS ~78 인데 우리 dashboard ~22
       (3.5x 차이). 진단(.repro-424/): 점수를 깎는 지배 인자는 RATIO_FLOOR.
       기존 풍상 floor 0.5 = "예측 달성가능치의 50% 미만 = 0점" → elite 가
       예측치의 78% 를 달성해도 (0.78−0.5)/0.5×100 = 56 점으로 압축됐다.
       Vantage 는 best-percentile 기준 거의 선형(ratio≈score: 0.78 달성 →
       ~78)으로 환산하는 것으로 보여(공식 비공개 — vantage-sailing.com
       /technology "filter by performance percentile"), floor 를 0 으로 내려
       ratio≈score(백분위형)로 정합. 3등급 mock(elite/int/beg)이 풍속
       12–18kt 전역에서 60–80 / 30–55 / 5–25 에 안착(.repro-424/calib.js).
       잔존(2차) 요인 = 리프팅 모델이 중풍↑ 에서 풍상 VMG 과대예측
       (VMG≈풍속, 비물리적; §414 over-amplification 과 동일 뿌리)으로 elite
       점수가 12→18kt 에서 79→63 으로 드리프트. 단 잠긴 §181 물리(What-if
       공유, DO_NOT_REVERT §181-C/D/E)라 본 §424 에선 건드리지 않음 — Timo
       재보정 트랙으로 분리. */
  var VPS = {
    SPEED_WEIGHT: 0.70,               // 직선 속도 가중 (Vantage 문서 기준)
    TURN_WEIGHT: 0.30,                // 회전 가중
    UPWIND_RATIO_FLOOR: 0.00,         // §424 0.50→0.00: ratio≈score (백분위형)
    UPWIND_RATIO_TOP: 1.00,           // 예측치 도달 = 100점
    DOWNWIND_RATIO_FLOOR: 0.00,       // §424 0.60→0.00: ratio≈score (백분위형)
    DOWNWIND_RATIO_TOP: 1.60,         // §424 1.40→1.60: 풍하 SOG=풍상 Vboat → ~62
    WING_AR_DEFAULT: 4.5,             // 핸드헬드 윙 AR 기본 (계산기 기본값)
    FOIL_AR_DEFAULT: 6.5              // 앞 포일 AR 기본 (미입력 시)
  };

  /* --- What-if 추천 임계값 (코치 검증으로 보정 가능) ---
     앵커링 후 막대는 "실측 풍상 VMG × 상대 곡선" 추정값이다. 계산기
     곡선에는 작은 윙을 과도하게 선호하는 알려진 편향이 있어, 노이즈
     수준의 개선 추정폭으로 윙 변경을 권하지 않도록 임계를 둔다. */
  var WHATIF = {
    MEANINGFUL_DELTA_KT: 0.5,         // 앵커된 풍상 VMG 개선 추정폭이 이
                                      //   미만이면 노이즈로 보고 변경 미추천
    MIN_SIZE_DIFF_M2: 0.5,            // 최적이 현재 윙과 최소 이만큼 달라야 추천
    SWEEP_STEP_M2: 0.5                // 윙 스윕 격자 (판매·입력 단위와 일치)
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(x) { return (x == null || !isFinite(x)) ? null : Math.round(x * 10) / 10; }
  function round0(x) { return (x == null || !isFinite(x)) ? null : Math.round(x); }

  /* 풍상 속도 비율 → 0~100 점 */
  function upwindSpeedScore(ratio) {
    var f = VPS.UPWIND_RATIO_FLOOR, t = VPS.UPWIND_RATIO_TOP;
    return clamp((ratio - f) / (t - f) * 100, 0, 100);
  }
  /* 풍하 SOG / 풍상 V_boat 비율 → 0~100 점 (휴리스틱 상대 평가) */
  function downwindSpeedScore(ratio) {
    var f = VPS.DOWNWIND_RATIO_FLOOR, t = VPS.DOWNWIND_RATIO_TOP;
    return clamp((ratio - f) / (t - f) * 100, 0, 100);
  }

  /* ============================================================
   * §424 — SPS 점수 → 스킬 티어 밴드 (절대 등급 사다리, 표시용 canonical).
   * 옥대표님 dispatch §424-F. 점수가 0~100 으로 재보정(백분위형)된 뒤
   * 카드·PDF 가 동일한 임계·색을 쓰도록 단일 출처로 둔다.
   *   80+    Elite        (gold)
   *   60–80  Advanced     (green)
   *   40–60  Intermediate (blue)
   *   20–40  Foundational (orange)   §431
   *   0–20   Learning     (red)      §431
   * 하한 포함(>=) 규약: 80→Elite, 60→Advanced … 20→Foundational, 0→Learning.
   * 색은 표시 레이어가 그대로 쓰거나 자체 팔레트로 매핑할 수 있게 hex 동봉.
   * 주의 — 이 밴드는 '이번 세션 SPS' 의 절대 등급일 뿐, 메인 사이트의
   * 스킬 진단 티어(§408 getOverallTier 30/50/70/85)와는 별개 체계다. */
  /* §432 — 트래픽 라이트 그라디언트. 긍정=그린, 부정=레드 (옥대표 지시).
     §431 램프(골드/초록/파랑/오렌지/레드)는 점수 상승 방향과 색 신호가
     어긋났다 — 79(Advanced)=초록인데 80(Elite)=골드로 "덜 긍정"처럼 보이고,
     중간(Intermediate)=파랑은 신호등 논리에서 벗어났다. 이제 스코어가
     오를수록 초록에 가까워지는 단일 신호등 램프로 재배치한다:
       Elite=진초록(에메랄드) / Advanced=연초록(라임) / Intermediate=노랑(앰버)
       / Foundational=오렌지 / Learning=레드.
     §432 v2 (옥대표 "밝은 형광 느낌") — 톤을 네온 계열로 올린다(Tailwind
       400~500 대). 방향(신호등)은 그대로, 톤만 밝게. 이 5색은 심박 존
       팔레트(chart-theme.js HR_ZONE)와 hex 완전 일치한다(SPS Elite=HR Z1
       recovery=진초록 … SPS Learning=HR Z5 anaerobic=레드). 인접 밴드
       luminance 차로 색맹(deutan/protan) 구분 — 단, 네온 특성상 Elite↔Advanced
       (둘 다 초록)는 ΔL 이 가장 좁다(색상[에메랄드↔라임]으로 추가 구분).
     (밴드 임계값 80/60/40/20 은 §424 lock — 불변. PDF grade-chip 은 이미
     동일한 신호등 램프[green→red]라 tier 별로 정합 — 별도 변경 불필요.) */
  var VPS_BANDS = [
    { min: 80, tier: 'elite',        label: 'Elite',        color: '#00FF66' },
    { min: 60, tier: 'advanced',     label: 'Advanced',     color: '#00FF00' },
    { min: 40, tier: 'intermediate', label: 'Intermediate', color: '#FFCC00' },
    { min: 20, tier: 'foundational', label: 'Foundational', color: '#FFA500' },
    { min: 0,  tier: 'learning',     label: 'Learning',     color: '#FF0000' }
  ];
  function vpsBand(score) {
    if (score == null || !isFinite(score)) {
      return { tier: 'na', label: '—', color: '#C7CFD8', min: null };
    }
    var s = clamp(score, 0, 100);
    for (var i = 0; i < VPS_BANDS.length; i++) {
      if (s >= VPS_BANDS[i].min) return VPS_BANDS[i];
    }
    return VPS_BANDS[VPS_BANDS.length - 1];
  }

  /* ============================================================
   * 실측 풍상 VMG (상위 50% · 양 택 합산, kt) — VPS 속도 점수 앵커/기준값.
   * (What-if 윙 스윕은 별도로 우세 택 상위 20% 앵커 — whatIfAnchorVmgKt 참조.)
   *
   * 단일 출처: analysis.wind.vmgUpwindTop50Ms (analysis.js 의
   * computeWindMetrics — 풍향 확정 시에만 산출).
   *
   * 지표 정의 일치 — 이 실측값과 계산기 upwindSpeed().V_vmg_kt 는
   *   같은 "풍상 VMG"(풍상 유효속도 = 속도 × cos TWA) 다:
   *   · 실측: TWA<90° 표본의 풍상 VMG 성분(SOG×cos TWA)을 시간가중
   *     상위 50% 평균. 리칭(TWA→90°)은 cos→0 이라 VMG≈0 → 상위 50%
   *     선택에서 자연 배제 → 사실상 클로즈홀드 풍상 VMG (리칭으로
   *     부풀려지지 않음).
   *   · 계산기: V_boat × cos(tack_angle) — 클로즈홀드 풍상 VMG 성분.
   *   둘 다 같은 풍상 VMG 라, 앵커(분자=실측)와 계산기 곡선(분모)이
   *   동일 지표 위에서 비교된다.
   * ============================================================ */
  function measuredUpwindVmgKt(analysis) {
    if (!analysis || !analysis.wind) return null;
    var ms = analysis.wind.vmgUpwindTop50Ms;
    if (!(ms > 0)) return null;
    return ms * MS_TO_KT;
  }

  /* What-if 윙 스윕 앵커 — 양 택 중 우세 택의 풍상 VMG 상위 20% (kt).
     VPS 앵커(measuredUpwindVmgKt, 상위 50% 합산)와 분리한다: What-if 는
     장비별 잠재력을 보여주는 분석이므로, 스킬 갭이 있는 약한 택이
     평균을 깎으면 안 되고 라이더가 더 잘하는 택을 기준으로 앵커한다.
     max(포트 top20, 스타보드 top20) — 이 값은 퍼포먼스 통계 표의 풍상
     VMG 포트·스타보드 행 중 하나와 정확히 일치한다(추적성). 양 택
     합산(상위 20%)에서 우세 택으로 바꾼 결정 (Danny 검토 2026-05-24). */
  function whatIfAnchorVmgKt(analysis) {
    if (!analysis || !analysis.wind) return null;
    var ts = analysis.wind.tackSplit;
    if (!ts || !ts.upwind) return null;
    var p = (ts.upwind.P && ts.upwind.P.vmg) ? ts.upwind.P.vmg.top20 : 0;
    var s = (ts.upwind.S && ts.upwind.S.vmg) ? ts.upwind.S.vmg.top20 : 0;
    var ms = Math.max(p, s);
    if (!(ms > 0)) return null;
    return ms * MS_TO_KT;
  }

  /* segment VPS 합성 — 속도 70% + 회전 30%.
     speed 가 null 이면 VPS 산출 불가(null). turn 이 null 이면 속도 100%. */
  function combineSegment(speed, turn) {
    if (speed == null) {
      return { score: null, speedScore: null, turnScore: round0(turn),
               note: i18nT('속도 점수 산출 불가 — 계산기가 이 조건에서 풍상 주행 불가로 예측'),
               partial: false };
    }
    if (turn == null) {
      return { score: round0(speed), speedScore: round0(speed), turnScore: null,
               note: i18nT('회전 데이터 없음 — 속도 항목만 반영 (회전 30% 미적용)'),
               partial: true };
    }
    var s = VPS.SPEED_WEIGHT * speed + VPS.TURN_WEIGHT * turn;
    return { score: round0(s), speedScore: round0(speed), turnScore: round0(turn),
             note: null, partial: false };
  }

  /* 풍상·풍하 속도 점수를 주행 시간으로 가중 평균 (Overall 속도 점수) */
  function blendByTime(a, aT, b, bT) {
    var aOk = (a != null), bOk = (b != null);
    if (!aOk && !bOk) return null;
    if (aOk && !bOk) return a;
    if (bOk && !aOk) return b;
    var wA = aT > 0 ? aT : 0, wB = bT > 0 ? bT : 0;
    if (wA + wB <= 0) return (a + b) / 2;
    return (a * wA + b * wB) / (wA + wB);
  }

  /* ============================================================
   * VPS — Vantage Performance Score
   * @param analysis     An.analyzeSession() 결과
   * @param rider        { weightKg, skill, wingM2, foilAR }
   * @param windDir      확정 풍향(도) — null 이면 산출 불가
   * @param windSpeedKt  풍속(kt) — null/0 이면 산출 불가
   *
   * References — Performance scoring framework:
   *   · 70/30 (속도/회전) 가중 — Vantage Sailing 의 합성 점수 패턴 ("Vantage
   *     Performance Score" — vantage-sailing.com/technology, 정확한 가중 식은
   *     비공개).
   *   · 풍상 속도 점수 anchor: 계산기 upwindSpeed (§176/§181 물리 모델)
   *     예측치 대비 실측 VMG 비율 → 0-100 환산. 100점 = "예측 가능치 도달".
   *   · 자기 정직성 — Halson 2014 (Sports Med 44 Suppl 2:139-147,
   *     doi:10.1007/s40279-014-0253-z) "uncertainty acknowledgment" 원칙:
   *     속도 점수 산출 불가 시 segment VPS = null 으로 두고 회전 점수 단독
   *     으로 호명하지 않는다 (assumption inflation 방지).
   * ============================================================ */
  function computeVPS(analysis, rider, windDir, windSpeedKt) {
    var missing = [];
    if (windDir == null) missing.push(i18nT('풍향(확정)'));
    if (!(windSpeedKt > 0)) missing.push(i18nT('풍속'));
    if (!rider || !(rider.weightKg > 0)) missing.push(i18nT('체중'));
    if (!rider || !rider.skill) missing.push(i18nT('스킬 등급'));
    if (!rider || !(rider.wingM2 > 0)) missing.push(i18nT('윙 사이즈'));
    if (!analysis || !analysis.wind) {
      if (missing.indexOf(i18nT('풍향(확정)')) < 0) missing.push(i18nT('풍향(확정)'));
    }
    var Lift = liftAPI();
    if (!Lift || !Lift.upwindSpeed) {
      return { ok: false, missing: [i18nT('리프팅 계산기 모듈')], error: 'lift_calculator_unavailable' };
    }
    if (missing.length) return { ok: false, missing: missing };

    var foilAR = (rider.foilAR > 0) ? rider.foilAR : VPS.FOIL_AR_DEFAULT;
    var wingAR = VPS.WING_AR_DEFAULT;

    /* --- 계산기 풍상 예측 (달성 가능 속도 레퍼런스) --- */
    var up = Lift.upwindSpeed({
      v_wind_kt: windSpeedKt,
      m_rider_kg: rider.weightKg,
      skill: rider.skill,
      foil_ar: foilAR,
      wing_area_m2: rider.wingM2,
      wing_ar: wingAR
    });
    var upOk = !!(up && !up.error && up.feasible &&
                  up.V_vmg_kt > 0 && up.V_boat_kt > 0);
    var predUpVmgKt   = upOk ? up.V_vmg_kt  : null;
    var predUpVboatKt = upOk ? up.V_boat_kt : null;

    /* --- 실측값 (kt) --- */
    var w = analysis.wind;
    /* 풍상 VMG 상위 50% — VPS 속도 점수 앵커 (measuredUpwindVmgKt). */
    var measUpVmgKt = measuredUpwindVmgKt(analysis) || 0;
    var downSog = (w.tackSplit && w.tackSplit.downwind &&
                   w.tackSplit.downwind.all && w.tackSplit.downwind.all.sog) || null;
    var measDownSogKt = downSog ? (downSog.top50 || 0) * MS_TO_KT : 0;
    var upTime = w.upwindTimeSec || 0;
    var downTime = w.downwindTimeSec || 0;

    /* --- 속도 점수 --- */
    var upSpeed = null, upRatio = null;
    if (predUpVmgKt != null && predUpVmgKt > 0) {
      upRatio = measUpVmgKt / predUpVmgKt;
      upSpeed = upwindSpeedScore(upRatio);
    }
    var downSpeed = null, downRatio = null;
    if (predUpVboatKt != null && predUpVboatKt > 0) {
      downRatio = measDownSogKt / predUpVboatKt;
      downSpeed = downwindSpeedScore(downRatio);
    }
    var overallSpeed = blendByTime(upSpeed, upTime, downSpeed, downTime);

    /* --- 회전 점수 (이미 산출된 효율 점수 평균) --- */
    var ms = analysis.maneuverStats || {};
    var groups = ms.groups || { tack: { all: {} }, gybe: { all: {} } };
    var turnOverall  = (ms.avgEfficiency != null) ? ms.avgEfficiency : null;
    var turnUpwind   = (groups.tack && groups.tack.all && groups.tack.all.effAvg != null)
      ? groups.tack.all.effAvg : null;
    var turnDownwind = (groups.gybe && groups.gybe.all && groups.gybe.all.effAvg != null)
      ? groups.gybe.all.effAvg : null;

    /* segment 합성 — combineSegment 의 turnScore 는 합성용 회전 점수:
       Upwind=택킹 효율, Downwind=자이빙 효율, Overall=전체 회전 효율
       평균. 그 위에 카드 표시용 회전 분해(tackScore·gybeScore)를 덧붙여
       사용자가 SPS 안에서 택킹·자이빙을 따로 볼 수 있게 한다 — 합성
       점수(score·turnScore) 계산식은 건드리지 않으므로 카드 총점 불변. */
    var upwind   = combineSegment(upSpeed,      turnUpwind);
    var overall  = combineSegment(overallSpeed, turnOverall);
    var downwind = combineSegment(downSpeed,    turnDownwind);
    /* 풍상 마네버 = 택킹, 풍하 마네버 = 자이빙. Upwind 카드는 택킹만,
       Downwind 카드는 자이빙만, Overall 카드는 둘 다 노출한다. */
    upwind.tackScore   = round0(turnUpwind);
    upwind.gybeScore   = null;
    downwind.tackScore = null;
    downwind.gybeScore = round0(turnDownwind);
    overall.tackScore  = round0(turnUpwind);
    overall.gybeScore  = round0(turnDownwind);

    return {
      ok: true,
      upwind:   upwind,
      overall:  overall,
      downwind: downwind,
      detail: {
        windSpeedKt: windSpeedKt,
        foilAR: foilAR, wingAR: wingAR,
        upwindFeasible: upOk,
        predUpwindVmgKt:   round1(predUpVmgKt),
        predUpwindVboatKt: round1(predUpVboatKt),
        measUpwindVmgKt:   round1(measUpVmgKt),
        measDownwindSogKt: round1(measDownSogKt),
        upwindRatio:   upRatio   != null ? Math.round(upRatio * 100) / 100   : null,
        downwindRatio: downRatio != null ? Math.round(downRatio * 100) / 100 : null,
        upwindTimeSec: upTime, downwindTimeSec: downTime,
        turnOverall: round0(turnOverall),
        turnUpwind: round0(turnUpwind),
        turnDownwind: round0(turnDownwind),
        depowered: !!(up && up.depowered)
      }
    };
  }

  /* ============================================================
   * What-if — 윙 사이즈 스윕 (실측 풍상 VMG 앵커링)
   *
   * 핵심 원칙 — "현재 윙" 막대는 항상 라이더의 실측 풍상 VMG 와 일치한다.
   * 계산기의 절대 예측값(예: 13.5 kt)을 라이더 실측값(예: 6.0 kt)과
   * 직접 비교하면 스케일이 달라 자기모순("네 최선이 네가 이미 한 것보다
   * 못하다")이 생긴다. 그래서 계산기는 윙-사이즈 곡선의 *상대 모양* 에만
   * 쓰고, 절대 스케일은 실측값이 결정한다:
   *
   *     앵커된VMG(W) = 실측VMG × [ calc(W) / calc(현재윙) ]
   *
   *   · W = 현재윙  → calc 분자=분모 → 앵커된VMG = 실측VMG (정확히 일치).
   *   · 최적(calc 최대) → calc(opt) ≥ calc(현재) → 앵커된VMG ≥ 실측 (항상).
   *   결과: 현재 윙 막대는 늘 실측 그대로, 최적은 늘 현실 이상 → 자기모순
   *   제거.
   *
   * 계산기 곡선이 작은 윙을 과도하게 선호하는 편향이 있어도(알려진
   * 이슈 — 재캘리브레이션은 별도 작업), 이 식은 분자·분모가 같은 곡선
   * 이라 곡선을 통째로 교체·재캘리브레이션해도 앵커링 로직 수정이
   * 필요 없다. 추천 여부는 WHATIF.MEANINGFUL_DELTA_KT 임계로 판단.
   *
   * 추천은 두 갈래 (Danny 2026-05-22):
   *   · 퍼포먼스 추천 = VMG 곡선 정점(optimumWingM2) — 메인.
   *   · 편안함 추천   = 정점 − 0.5㎡(comfortWingM2)   — 참고.
   * 편안함 추천 윙은 계산기 Lift.wingRecommendation() 의 comfort 값을
   * 그대로 쓴다 — 윙 사이즈 모델은 계산기 담당, 여기서 재구현하지 않는다.
   *
   * @param analysis    An.analyzeSession() 결과 — wind.tackSplit.upwind
   *                    의 우세 택 풍상 VMG 상위 20%가 앵커(whatIfAnchorVmgKt).
   *                    풍향 확정 시에만 존재.
   * @param rider       { weightKg, skill, wingM2, foilAR }
   * @param windSpeedKt 풍속(kt)
   * ============================================================ */
  function computeWhatIf(analysis, rider, windSpeedKt) {
    var missing = [];
    if (!(windSpeedKt > 0)) missing.push(i18nT('풍속'));
    if (!rider || !(rider.weightKg > 0)) missing.push(i18nT('체중'));
    if (!rider || !rider.skill) missing.push(i18nT('스킬 등급'));
    if (!rider || !(rider.wingM2 > 0)) missing.push(i18nT('윙 사이즈'));
    /* 앵커 — 우세 택의 실측 풍상 VMG 상위 20%. 없으면(풍향 미확정 등)
       what-if 산출 불가: 앵커 없는 절대-예측 비교는 신뢰성이 없어
       제공하지 않는다. */
    var measVmgKt = whatIfAnchorVmgKt(analysis);
    if (measVmgKt == null) missing.push(i18nT('실측 풍상 VMG(풍향 확정 필요)'));
    var Lift = liftAPI();
    if (!Lift || !Lift.upwindCurve || !Lift.upwindSpeed) {
      return { ok: false, missing: [i18nT('리프팅 계산기 모듈')], error: 'lift_calculator_unavailable' };
    }
    if (missing.length) return { ok: false, missing: missing };

    var foilAR = (rider.foilAR > 0) ? rider.foilAR : VPS.FOIL_AR_DEFAULT;
    var wingAR = VPS.WING_AR_DEFAULT;
    /* 현재 윙을 0.5 격자에 스냅 — 스윕·앵커 분모·막대 매칭을 한 격자에서
       일관 처리 (실제 윙은 0.5 단위 판매, 입력칸도 0.5 step). */
    var actualWing = Math.round(rider.wingM2 * 2) / 2;
    var base = {
      v_wind_kt: windSpeedKt,
      m_rider_kg: rider.weightKg,
      skill: rider.skill,
      foil_ar: foilAR,
      wing_ar: wingAR
    };

    /* 스윕 범위 — 현재 윙을 항상 포함하도록 확장. step 0.5 m².
       §414 (Danny 2026-06-10) — 윙 사이즈 cap commercial racing class max
       (Timo spec sports_science_414_wing_cap_diminishing_returns_spec.md §2-1).
       DO_NOT_REVERT §414.
       WING_LINEUP_M2 (lift-calculator.js:446) 의 max = 7.4 m² 와 일관.
       단 actualWing 이 commercial 범위 밖 (legacy stock 등) 인 경우는 막지 X
       — 라이더 입력값 존중 + sweep 만 cap. */
    var step = WHATIF.SWEEP_STEP_M2;
    var WHATIF_AMAX_COMMERCIAL = 7.4;   /* 윙포일 racing class max */
    var aMin = 2.5, aMax = WHATIF_AMAX_COMMERCIAL;
    if (actualWing - 1.0 < aMin) aMin = Math.max(1.5, Math.round((actualWing - 1.0) * 2) / 2);
    /* actualWing > aMax 인 경우 — sweep range 는 cap 유지하되 actualWing 자체는
       계산 (anchor 분모 보존). 단 sweep 표시는 cap + 0.5 만 (확장 제거). */
    if (actualWing + 0.5 > aMax) aMax = actualWing + 0.5;
    if (aMax > 9.5) aMax = 9.5;   /* hard ceiling — legacy 보호용 outer cap */

    var curve = Lift.upwindCurve(base, {
      area_min_m2: aMin, area_max_m2: aMax, step_m2: step
    });
    var atActual = Lift.upwindSpeed(
      Object.assign({}, base, { wing_area_m2: actualWing }));
    var actualOk = !!(atActual && !atActual.error && atActual.feasible &&
                      atActual.V_vmg_kt > 0);
    var calcActualVmg = actualOk ? atActual.V_vmg_kt : null;   // 앵커 분모

    /* 앵커 분모가 없으면(계산기가 이 조건의 현재 윙을 풍상 주행으로
       모델링 못함) 상대 곡선을 만들 수 없다. 실측값은 정직하게 그대로
       돌려주되 윙 사이즈 비교(스윕)는 생략한다 — 가짜 곡선을 만들지
       않는다. */
    if (!(calcActualVmg > 0)) {
      return {
        ok: true,
        anchored: false,
        measuredVmgKt: round1(measVmgKt),
        actualWingM2: actualWing,
        actualFeasible: false,
        actualVmgKt: round1(measVmgKt),
        recommendChange: false,
        recommendedWingM2: actualWing,
        foilAR: foilAR
      };
    }

    /* --- 앵커링 — 모든 막대 = 실측VMG × calc(W)/calc(현재윙) --- */
    var actualHalf = Math.round(actualWing * 2);
    var points = (curve.points || []).map(function (p) {
      var isActual = (Math.round(p.area_m2 * 2) === actualHalf);
      var calcVmg = (p.feasible && p.V_vmg_kt > 0) ? p.V_vmg_kt : 0;
      var vmgKt;
      if (isActual) {
        vmgKt = round1(measVmgKt);                  // 현재 윙 = 실측값 (보장)
      } else if (calcVmg > 0) {
        vmgKt = round1(measVmgKt * (calcVmg / calcActualVmg));
      } else {
        vmgKt = null;                               // 계산기가 풍상 불가로 예측
      }
      return {
        area_m2: p.area_m2,
        feasible: !!p.feasible,
        depowered: !!p.depowered,
        isActual: isActual,
        vmgKt: vmgKt,                   // 실측 앵커 적용값 — 표시용
        calcVmgKt: round1(p.V_vmg_kt)   // 계산기 원본(절대) — 투명성·재검증용
      };
    });

    /* 최적 = 앵커된 VMG 최대 지점. 앵커는 양의 상수배(실측/calc(현재))
       라 calc 최대 지점과 동일하지만, 앵커된 points 에서 직접 찾아
       표시값과 일관되게 한다. */
    var optimum = null, actualPoint = null;
    points.forEach(function (p) {
      if (p.isActual) actualPoint = p;
      if (p.vmgKt != null && (!optimum || p.vmgKt > optimum.vmgKt)) optimum = p;
    });
    points.forEach(function (p) { p.isOptimum = (optimum != null && p === optimum); });

    var actualVmgKt = actualPoint ? actualPoint.vmgKt : round1(measVmgKt);
    var deltaVmg = (optimum && actualVmgKt != null)
      ? round1(optimum.vmgKt - actualVmgKt) : null;
    var sizeDiff = optimum ? Math.abs(optimum.area_m2 - actualWing) : 0;
    /* 추천 — 의미 있는 개선폭(≥임계)이고 윙이 실제로 다를 때만.
       라이더가 이미 최적치이거나 개선폭이 노이즈 수준이면 false →
       app.js 코치 코멘트는 "현재 윙이 적절"이라 정직하게 말한다. */
    var recommendChange = !!(deltaVmg != null &&
      deltaVmg >= WHATIF.MEANINGFUL_DELTA_KT &&
      sizeDiff >= WHATIF.MIN_SIZE_DIFF_M2);
    /* 코치 최종 추천 윙 — 변경을 추천하면 최적 윙, 아니면 현재 윙.
       그래프 강조와 코치 텍스트가 반드시 이 한 값을 함께 가리키도록
       단일화한다 (수학적 peak 만 "최적"으로 찍어 코치 판정과 어긋나던
       모순 해소 — peak 는 별도 isOptimum 으로 참고 표시만). */
    var recommendedWingM2 = (recommendChange && optimum)
      ? optimum.area_m2 : actualWing;
    var recHalf = Math.round(recommendedWingM2 * 2);
    points.forEach(function (p) {
      p.isRecommended = (Math.round(p.area_m2 * 2) === recHalf);
    });
    var optAtBoundary = !!(optimum &&
      (optimum.area_m2 <= curve.area_min_m2 + 1e-6 ||
       optimum.area_m2 >= curve.area_max_m2 - 1e-6));

    /* --- 편안함 추천 (Danny 2026-05-22) ---------------------------------
       퍼포먼스 추천(optimum = VMG 곡선 정점)을 메인으로, 그 옆에 "한
       사이즈 작은" 편안함 추천을 참고로 제시한다. 윙 사이즈 모델은
       계산기 담당 — Lift.wingRecommendation() 의 comfort 값(정점 − 0.5㎡,
       풍상 가능 최소 윙으로 클램프)을 그대로 쓰고 여기서 재구현하지
       않는다. 계산기에 함수가 없을 때만 같은 정점 기준 − 0.5㎡ 로 폴백. */
    var comfortWingM2 = null, comfortVmgKt = null;
    if (optimum) {
      var rec = Lift.wingRecommendation
        ? Lift.wingRecommendation(base, {
            area_min_m2: aMin, area_max_m2: aMax,
            step_m2: step, comfort_step_m2: WHATIF.SWEEP_STEP_M2
          })
        : null;
      if (rec && rec.feasible && rec.comfort > 0) {
        comfortWingM2 = Math.round(rec.comfort * 2) / 2;        // 0.5 격자 스냅
      } else {
        /* 폴백 — wingRecommendation 미제공 시에만. 같은 정점 기준
           정점 − 0.5㎡, 풍상 주행 가능한 최소 윙으로 클램프. */
        var feasMin = null;
        points.forEach(function (p) {
          if (p.vmgKt != null && (feasMin == null || p.area_m2 < feasMin)) {
            feasMin = p.area_m2;
          }
        });
        comfortWingM2 = optimum.area_m2 - WHATIF.SWEEP_STEP_M2;
        if (feasMin != null && comfortWingM2 < feasMin) comfortWingM2 = feasMin;
      }
    }
    var comfortHalf = (comfortWingM2 != null) ? Math.round(comfortWingM2 * 2) : null;
    points.forEach(function (p) {
      p.isComfort = (comfortHalf != null && Math.round(p.area_m2 * 2) === comfortHalf);
      if (p.isComfort) comfortVmgKt = p.vmgKt;
    });

    return {
      ok: true,
      anchored: true,
      measuredVmgKt: round1(measVmgKt),
      actualWingM2: actualWing,
      actualFeasible: actualOk,
      actualVmgKt: actualVmgKt,                 // 현재 윙 막대 = 실측 풍상 VMG
      calcActualVmgKt: round1(calcActualVmg),   // 계산기 원본(절대) — 투명성용
      optimumWingM2: optimum ? optimum.area_m2 : null,
      optimumVmgKt: optimum ? optimum.vmgKt : null,           // 앵커 적용값
      calcOptimumVmgKt: optimum ? optimum.calcVmgKt : null,   // 계산기 원본
      deltaVmgKt: deltaVmg,                     // 앵커 기준 개선 추정폭 (≥0)
      recommendChange: recommendChange,
      recommendedWingM2: recommendedWingM2,     // 변경 추천 시 정점, 아니면 현재 윙
      meaningfulDeltaThresholdKt: WHATIF.MEANINGFUL_DELTA_KT,
      optimumAtBoundary: optAtBoundary,
      comfortWingM2: comfortWingM2,             // 편안함 추천 — 정점 − 0.5㎡ (참고)
      comfortVmgKt: comfortVmgKt,               // 편안함 추천 윙의 앵커된 풍상 VMG
      anyFeasible: !!optimum,
      points: points,   // [{area_m2, vmgKt, calcVmgKt, feasible, depowered, isActual, isOptimum, isComfort, isRecommended}]
      sweep: { min: curve.area_min_m2, max: curve.area_max_m2, step: curve.step_m2 },
      foilAR: foilAR,
      /* §414 — wing not bottleneck 감지 (Timo spec §4-1) */
      boundary: detectWingNotBottleneck({
        optimumWingM2: optimum ? optimum.area_m2 : null,
        points: points
      })
    };
  }

  /* ============================================================
   * §414 — Wing not bottleneck detection (Timo §4-1 spec)
   * 옥대표님 verbatim 2026-06-10 — 약풍 + race foil 시나리오 등에서 wing
   * 사이즈가 bottleneck 이 아닌 케이스 감지. 약풍·heavy rider·high-AR foil
   * 결합 시 §181 model 의 A_transition 이 commercial 2.5-7.4 range 밖
   * (12+ m²) 으로 가서 sweep 안에서는 monotonic appearance.
   * 본 helper 는 UX layer 가 boundary indicator + lever 권장 표시할지 결정.
   * 분리 helper — coach.js 외부에서도 import 가능 (selftest etc.). */
  function detectWingNotBottleneck(whatifResult) {
    if (!whatifResult) return { boundary: false };
    /* §1 — 추천 윙이 cap boundary 안 (within 0.5 m² of 7.4 commercial max) */
    if (whatifResult.optimumWingM2 != null &&
        whatifResult.optimumWingM2 >= 6.9) {
      return {
        boundary: true,
        type: 'optimum_at_cap',
        reason: '최적 wing 이 commercial racing class max (7.4 m²) 경계',
        levers: ['skill_up', 'foil_ar_up', 'mass_down']
      };
    }
    /* §2 — 곡선이 commercial range 안에서 monotonic 증가
     * (last feasible 가 optimum 과 같은 area 면 = upper edge 가 peak = monotonic) */
    if (whatifResult.points && whatifResult.points.length >= 3) {
      var feasibles = whatifResult.points.filter(function (p) { return p.feasible; });
      var lastFeasible = feasibles[feasibles.length - 1];
      if (lastFeasible && lastFeasible.area_m2 >= 6.9 &&
          whatifResult.optimumWingM2 === lastFeasible.area_m2) {
        return {
          boundary: true,
          type: 'monotonic_in_range',
          reason: '이 시나리오에서 wing 사이즈는 bottleneck 아님 — peak 가 commercial range 밖',
          levers: ['skill_up', 'foil_ar_up', 'mass_down']
        };
      }
    }
    return { boundary: false };
  }

  /* ============================================================
   * 회전 기술 Coach Danny 코칭 엔진
   *
   * 회전 상세 P·S 비교 뷰의 비교 표 아래에 자연어 코칭 코멘트를 낸다.
   * 설계: 회전코칭_AI_엔진_설계안_v1 + Danny §7 검토 답변 반영.
   *
   * 책임 분리 —
   *   · 데이터 패턴 감지 = 결정적 알고리즘 (아래 tcRule* 함수)
   *   · 진단·조언 문구    = Danny 코치 전문성 (TURN_COACH_TEXT 한곳에
   *     모음 — 코치가 텍스트만 고치면 된다)
   *
   * 임계는 TURN_COACH 한곳에 모았다 (DEFAULTS·VPS·WHATIF 와 같은 방식).
   * ============================================================ */

  /* --- 회전 코칭 튜닝 파라미터 (코치 검증으로 보정 가능) --- */
  var TURN_COACH = {
    ENTRY_SPEED_DIFF_KT: 1.0,    // 진입 SOG P·S 비대칭 임계(kt)
    ENTRY_TWA_DIFF_DEG: 5,       // 진입 각도(TWA) 비대칭 임계(도)
    ENTRY_SD_KT: 2.5,            // 진입 SOG 일관성(표준편차) 임계(kt)
    LOSS_DIFF_PP: 8,             // 속도 손실 P·S 비대칭 임계(%p)
    RECOVERY_DIFF_SEC: 3,        // 회복 시간 P·S 비대칭 임계(초)
    DEEP_EXIT_DEG: 20,           // 자이빙 탈출 각도 과깊음 — 라이더 평균 대비(도)
    /* 느린 택킹 임계 — Danny §7-7 / 검토 §issue-1: 레벨별 "진입→풍축
       도달" 구간 시간 상한(초). 회전 전체가 아니라 택킹 진입부터 풍축
       (정풍상) 통과까지만 비교한다 — 풍축 이후 탈출·재정비는 정상 과정
       이며 별도 회복 지표가 담당한다. */
    SLOW_TACK_SEC: {
      '입문': 7, '초급': 6, '중급': 5, '상급': 4, '상급-선수': 3.5, '선수': 3
    },
    MIN_N_FOR_CONSISTENCY: 3,    // 일관성 판정 최소 표본
    MULTI_PEAK_FRACTION: 0.34,   // 2단 회전이 이 비율 이상이면 발화
    GOOD_EFFICIENCY: 70,         // 긍정 코멘트 효율 하한
    FIX_SEVERITY: 85,            // 이 심각도 이상이면 'fix'(빨강)
    MAX_CARDS: 3                 // 코멘트 카드 최대 개수
  };

  /* --- 진단·조언 문구 (Danny 코치 전문성 — 여기만 고치면 됨) ---
     §7 검토 답변 1~8 을 반영한 초안. {fast}·{slow}·{side} 등은 치환. */
  var TURN_COACH_TEXT = {
    R1: {
      title: '진입 — 속도와 각도 맞바꿈',
      headline: '{fast}택이 더 빠르지만 풍상 각도를 내주고 있습니다.',
      diag: '{fast}택으로 들어갈 때 발 스위치(토우사이드 전환) 중 윙 당기는 힘을 잃었거나, 속도를 얻으려 풍하로 살짝 베어어웨이한 것으로 보입니다. 중급~상급 초반까지 흔한 패턴입니다.',
      advice: '윙을 머리 위·보드 앞쪽으로 두고 리딩엣지를 수평으로 유지해 기류를 깨지 않은 채로 손을 바꾸면, 각도를 내주지 않고도 속도를 실어 갈 수 있습니다.'
    },
    R2a: {
      title: '진입 속도 부족 — 보드 힐 과다',
      headline: '{slow}택 진입 속도가 낮습니다.',
      diag: '{slow}택 진입 속도가 {fast}택보다 느립니다. 항적이 더 날카로운 것으로 보아, 보드 힐을 너무 깊게 줘 회전 중 속도를 잃은 것으로 보입니다.',
      advice: '보드를 과하게 눕히지 말고 한 박자 길게, 일정한 반경으로 카빙하며 속도를 지킵니다.'
    },
    R2b: {
      title: '진입 속도 부족 — 윙 프로파일·시팅',
      headline: '{slow}택 진입 속도가 낮습니다.',
      diag: '{slow}택 진입 속도가 {fast}택보다 느립니다. 항적은 매끄러운데 속도가 빨리 빠지는 것으로 보아, 윙 프로파일 문제(리치 펄럭임·스톨링)이거나 오버시팅으로 보입니다.',
      advice: '윙을 과하게 당기지 말고 리치가 펄럭이지 않는 시팅을 찾아, 회전 내내 깨끗한 기류를 유지합니다.'
    },
    R3: {
      title: '진입 일관성 부족',
      headline: '{side} 진입 속도가 회전마다 들쭉날쭉합니다.',
      diag: '{side} 진입 속도가 회전마다 편차 ±{sd} {unit} 로 들쭉날쭉합니다. 같은 바람·해상 조건이라면, 반복 경험이 부족해 매번 같은 진입 지점을 못 찾는 것으로 보입니다.',
      advice: '같은 조건에서 같은 진입 동작을 반복하며 가장 잘 되는 지점을 몸에 익히면 분산이 줄어듭니다.'
    },
    R4: {
      title: '회전 속도 손실',
      headline: '{side} 회전에서 속도 손실이 큽니다.',
      diag: '{side} 회전에서 속도 손실이 더 큽니다(평균 {loss}%). 손·발 바꾸기가 늦었거나, 손은 바꿨지만 윙을 바람 받게 빨리 당기지 못했거나, 보드 힐을 새 풍상쪽으로 빨리 주지 못해 아래쪽 리프팅을 제때 만들지 못한 것으로 보입니다.',
      advice: '손·발 바꾸기를 지체 없이 끝내고, 바꾼 즉시 윙을 당겨 바람을 받게 하며, 보드 힐을 새 풍상쪽으로 곧장 줘 회전 중에도 리프팅이 끊기지 않게 합니다.'
    },
    R5: {
      title: '회전 후 회복 지연',
      headline: '{side} 회전 후 활주 복귀가 느립니다.',
      diag: '{side} 회전 후 활주 속도로 복귀가 느립니다. 발을 바꾼 뒤 보드 힐을 풍상쪽으로 주지 않으면 보드가 가라앉는데, 아래쪽 리프팅이 확보돼야 윙을 당겨 탈출할 수 있습니다.',
      advice: '탈출 직후 보드를 풍상쪽으로 기울여 리프팅을 만들고, 속도가 살아나면 윙을 당겨 가속합니다. 속도가 죽었다면 먼저 보드를 기울여 리프팅부터 만듭니다.'
    },
    R6: {
      title: '택킹이 느림',
      headline: '택킹 진입에서 풍축까지가 {skill} 기준보다 오래 걸립니다.',
      diag: '택킹 진입부터 풍축(정풍상) 도달까지 평균 {dur}초로, {skill} 기준 {thr}초보다 느립니다. 레벨 기준 시간은 회전 전체가 아니라 풍축까지 끌고 가는 전반부 구간을 가리킵니다 — 이 구간에서 추진력을 잃고 멈칫하는 것으로 보입니다. 풍축 이후 탈출·재정비 구간은 별도 회복 지표로 봅니다.',
      advice: '진입 속도를 충분히 싣고, 윙을 머리 위·앞쪽에 둔 채 망설임 없이 한 번에 손을 바꿔 풍축을 빠르게 넘깁니다.'
    },
    R7: {
      title: '2단으로 끊기는 회전',
      headline: '회전이 한 박자로 이어지지 않고 둘로 끊깁니다.',
      diag: '회전율 봉우리가 둘 이상으로, 회전이 한 번의 리듬으로 이어지지 않고 두 동작으로 끊깁니다 — 발교차와 손교차의 시간차가 큰 것으로 보입니다.',
      advice: '손교차를 먼저 하고, 발교차를 최대한 손교차에 가까운 타이밍으로 붙여 한 박자에 끝냅니다.'
    },
    R8: {
      title: '자이빙 탈출 각도 과깊음',
      headline: '자이빙이 너무 깊게 풍하로 빠져나옵니다.',
      diag: '자이빙 탈출 시 보드를 필요 이상으로 깊게 풍하로 떨궈, 정풍하에 가까운 느린 코스로 빠져나온 것으로 보입니다 — VMG 손실이 큽니다.',
      advice: '회전을 목표 코스각(브로드 리치)에서 멈춰 세우고, 그 각에서 보드를 평평하게 눌러 가속으로 전환합니다.'
    },
    R9: {
      title: '회전 기술 양호',
      headline: '포트·스타보드 회전이 고르고 효율이 높습니다.',
      diag: '포트·스타보드 회전이 고르고 효율이 높습니다(평균 {eff}/100). 현재 회전 기술이 안정적입니다.',
      advice: ''
    }
  };

  /* --- 회전 코칭 헬퍼 --- */
  function tcAngleDiff(ref, target) {
    var d = (target - ref) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  }
  function tcMeanSd(vals) {
    var n = vals.length, i;
    if (!n) return { n: 0, mean: null, sd: 0 };
    var s = 0;
    for (i = 0; i < n; i++) s += vals[i];
    var m = s / n, v = 0;
    for (i = 0; i < n; i++) v += (vals[i] - m) * (vals[i] - m);
    return { n: n, mean: m, sd: Math.sqrt(v / n) };
  }
  function tcSideLabel(side) {
    return side === 'P' ? i18nT('포트') : (side === 'S' ? i18nT('스타보드') : i18nT('선택 회전'));
  }
  function tcIsTack(m) { return m.type === 'tack'; }
  function tcIsGybe(m) { return m.type === 'gybe'; }
  function tcApplyTpl(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (whole, k) {
      return (vars && vars[k] != null) ? vars[k] : whole;
    });
  }
  /* 회전 목록 -> 지표별 평균·표준편차 묶음 (속도는 m/s 로 보관) */
  function tcStats(list, windDir) {
    var entry = [], exit = [], mn = [], loss = [], rec = [], dur = [],
        mtr = [], eff = [], etwa = [], xtwa = [], peaks = [], hw = [],
        noRec = 0, i, m;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      entry.push(m.entrySpeedMs); exit.push(m.exitSpeedMs); mn.push(m.minSpeedMs);
      loss.push(m.lossPct); dur.push(m.durationSec);
      mtr.push(m.maxTurnRateDegSec || 0); eff.push(m.efficiency || 0);
      peaks.push(m.turnPeaks || 1);
      // 진입→풍축 시간 — 산출된 회전(택킹)만 수집 (R6 느림 판정용)
      if (m.entryToHeadWindSec != null) hw.push(m.entryToHeadWindSec);
      if (m.recoverySec != null) rec.push(m.recoverySec); else noRec++;
      if (windDir != null) {
        if (m.headingBefore != null) etwa.push(Math.abs(tcAngleDiff(windDir, m.headingBefore)));
        if (m.headingAfter != null) xtwa.push(Math.abs(tcAngleDiff(windDir, m.headingAfter)));
      }
    }
    var nMulti = 0;
    for (i = 0; i < peaks.length; i++) if (peaks[i] >= 2) nMulti++;
    return {
      n: list.length, noRec: noRec, nMulti: nMulti,
      entry: tcMeanSd(entry), exit: tcMeanSd(exit), min: tcMeanSd(mn),
      loss: tcMeanSd(loss), rec: tcMeanSd(rec), dur: tcMeanSd(dur),
      mtr: tcMeanSd(mtr), eff: tcMeanSd(eff),
      etwa: tcMeanSd(etwa), xtwa: tcMeanSd(xtwa), peaks: tcMeanSd(peaks),
      headWind: tcMeanSd(hw)   // 진입→풍축 구간 시간 (초) — R6 전용
    };
  }
  function tcFmtSpeed(stat, ctx) {
    if (!stat || stat.mean == null) return '—';
    return ctx.toDisp(stat.mean).toFixed(1) + '±' + ctx.toDisp(stat.sd).toFixed(1);
  }
  function tcComment(id, severity, title, headline, numbers, diagnosis, advice) {
    var sev = Math.round(severity);
    var status = (id === 'R9') ? 'good'
      : (sev >= TURN_COACH.FIX_SEVERITY ? 'fix' : 'warn');
    return { id: id, severity: sev, status: status, title: title,
             headline: headline, numbers: numbers,
             diagnosis: diagnosis, advice: advice };
  }
  function tcBuild(id, textKey, severity, vars, numbers) {
    var t = TURN_COACH_TEXT[textKey];
    /* 영어 모드에서는 i18nT 가 영어 템플릿을 돌려준 뒤 같은 {token}
       치환을 거친다 — 사전에 영어 템플릿을 한국어 키로 등록해 둔다. */
    return tcComment(id, severity,
      tcApplyTpl(i18nT(t.title), vars),
      tcApplyTpl(i18nT(t.headline), vars),
      numbers,
      tcApplyTpl(i18nT(t.diag), vars),
      tcApplyTpl(i18nT(t.advice || ' '), vars));
  }

  /* --- 룰 R1 : 토우택 풍하 베어어웨이 (속도-각도 트레이드오프) --- */
  function tcRuleR1(ctx) {
    if (!ctx.splitMode) return null;
    var P = [], S = [], i, m;
    for (i = 0; i < ctx.picked.length; i++) {
      m = ctx.picked[i];
      if (!tcIsTack(m)) continue;
      if (m.side === 'P') P.push(m); else if (m.side === 'S') S.push(m);
    }
    if (!P.length || !S.length) return null;
    var sp = tcStats(P, ctx.windDir), ss = tcStats(S, ctx.windDir);
    if (sp.entry.mean == null || ss.entry.mean == null) return null;
    var dEntryKt = (ss.entry.mean - sp.entry.mean) * MS_TO_KT;
    if (Math.abs(dEntryKt) < TURN_COACH.ENTRY_SPEED_DIFF_KT) return null;
    var fastIsS = dEntryKt > 0;
    var fast = fastIsS ? ss : sp, slow = fastIsS ? sp : ss;
    if (fast.etwa.mean == null || slow.etwa.mean == null) return null;
    var dTwa = fast.etwa.mean - slow.etwa.mean;          // 빠른쪽 - 느린쪽
    if (dTwa < TURN_COACH.ENTRY_TWA_DIFF_DEG) return null;
    var sev = 84 + Math.min(10, (Math.abs(dEntryKt) - TURN_COACH.ENTRY_SPEED_DIFF_KT)
      / TURN_COACH.ENTRY_SPEED_DIFF_KT * 10);
    var nums = i18nT('진입 SOG 포트 {p} · 스타보드 {s} {u} · 진입 CWA 차 {d}°', {
      p: tcFmtSpeed(sp.entry, ctx), s: tcFmtSpeed(ss.entry, ctx),
      u: ctx.unit, d: Math.round(dTwa)
    });
    return tcBuild('R1', 'R1', sev, { fast: tcSideLabel(fastIsS ? 'S' : 'P') }, nums);
  }

  /* --- 룰 R2 : 진입 속도 부족 — 항적 스무스함으로 원인 분기 (Danny §7-2) --- */
  function tcRuleR2(ctx) {
    if (!ctx.splitMode) return null;
    var sp = tcStats(ctx.P, ctx.windDir), ss = tcStats(ctx.S, ctx.windDir);
    if (sp.entry.mean == null || ss.entry.mean == null) return null;
    var dEntryKt = (ss.entry.mean - sp.entry.mean) * MS_TO_KT;
    if (Math.abs(dEntryKt) < TURN_COACH.ENTRY_SPEED_DIFF_KT) return null;
    var slowIsP = dEntryKt > 0;                          // S 가 빠름 → P 가 느림
    var slow = slowIsP ? sp : ss, fast = slowIsP ? ss : sp;
    // 느린 쪽 항적이 더 날카로우면(최대 회전율 큼) 보드 힐 과다(R2a)
    var sharp = (slow.mtr.mean || 0) > (fast.mtr.mean || 0);
    var key = sharp ? 'R2a' : 'R2b';
    var sev = 66 + Math.min(10, (Math.abs(dEntryKt) - TURN_COACH.ENTRY_SPEED_DIFF_KT)
      / TURN_COACH.ENTRY_SPEED_DIFF_KT * 10);
    var nums = i18nT('진입 SOG 포트 {p} · 스타보드 {s} {u}', {
      p: tcFmtSpeed(sp.entry, ctx), s: tcFmtSpeed(ss.entry, ctx), u: ctx.unit
    });
    return tcBuild('R2', key, sev,
      { slow: tcSideLabel(slowIsP ? 'P' : 'S'), fast: tcSideLabel(slowIsP ? 'S' : 'P') }, nums);
  }

  /* --- 룰 R3 : 진입 일관성 부족 (Danny §7-3) --- */
  function tcRuleR3(ctx) {
    var groups = ctx.splitMode
      ? [{ list: ctx.P, side: 'P' }, { list: ctx.S, side: 'S' }]
      : [{ list: ctx.picked, side: null }];
    var best = null;
    groups.forEach(function (g) {
      var s = tcStats(g.list, ctx.windDir);
      if (s.entry.n < TURN_COACH.MIN_N_FOR_CONSISTENCY) return;
      var sdKt = s.entry.sd * MS_TO_KT;
      if (sdKt < TURN_COACH.ENTRY_SD_KT) return;
      if (!best || sdKt > best.sdKt) {
        best = { side: g.side, sdKt: sdKt, sd: s.entry.sd, n: s.entry.n };
      }
    });
    if (!best) return null;
    var sev = 42 + Math.min(10, (best.sdKt - TURN_COACH.ENTRY_SD_KT)
      / TURN_COACH.ENTRY_SD_KT * 10);
    var sdDisp = ctx.toDisp(best.sd).toFixed(1);
    var nums = i18nT('{side} 진입 SOG 편차 ±{sd} {u} · 표본 {n}회', {
      side: tcSideLabel(best.side), sd: sdDisp, u: ctx.unit, n: best.n
    });
    return tcBuild('R3', 'R3', sev,
      { side: tcSideLabel(best.side), sd: sdDisp, unit: ctx.unit }, nums);
  }

  /* --- 룰 R4 : 속도 손실 P·S 비대칭 (Danny §7-4) --- */
  function tcRuleR4(ctx) {
    if (!ctx.splitMode) return null;
    var sp = tcStats(ctx.P, ctx.windDir), ss = tcStats(ctx.S, ctx.windDir);
    if (sp.loss.mean == null || ss.loss.mean == null) return null;
    var dLoss = ss.loss.mean - sp.loss.mean;
    if (Math.abs(dLoss) < TURN_COACH.LOSS_DIFF_PP) return null;
    var worse = dLoss > 0 ? ss : sp, worseSide = dLoss > 0 ? 'S' : 'P';
    var sev = 80 + Math.min(12, (Math.abs(dLoss) - TURN_COACH.LOSS_DIFF_PP)
      / TURN_COACH.LOSS_DIFF_PP * 12);
    var nums = i18nT('속도 손실 포트 {p}% · 스타보드 {s}%', {
      p: Math.round(sp.loss.mean), s: Math.round(ss.loss.mean)
    });
    return tcBuild('R4', 'R4', sev,
      { side: tcSideLabel(worseSide), loss: Math.round(worse.loss.mean) }, nums);
  }

  /* --- 룰 R5 : 회전 후 회복 지연 (Danny §7-5) --- */
  function tcRuleR5(ctx) {
    if (!ctx.splitMode) return null;
    var sp = tcStats(ctx.P, ctx.windDir), ss = tcStats(ctx.S, ctx.windDir);
    function recScore(s) { return s.rec.n > 0 ? s.rec.mean : 30; }   // 전부 미회복=패널티
    function recTxt(s) {
      return s.rec.n > 0 ? i18nT('{n}초', {n: s.rec.mean.toFixed(1)}) : i18nT('미회복');
    }
    var dRec = recScore(ss) - recScore(sp);
    if (Math.abs(dRec) < TURN_COACH.RECOVERY_DIFF_SEC) return null;
    var worseSide = dRec > 0 ? 'S' : 'P';
    var sev = 70 + Math.min(12, (Math.abs(dRec) - TURN_COACH.RECOVERY_DIFF_SEC)
      / TURN_COACH.RECOVERY_DIFF_SEC * 12);
    var nums = i18nT('회복 시간 포트 {p} · 스타보드 {s}', {p: recTxt(sp), s: recTxt(ss)});
    return tcBuild('R5', 'R5', sev, { side: tcSideLabel(worseSide) }, nums);
  }

  /* --- 룰 R6 : 느린 택킹 — 레벨별 임계 (Danny §7-7 / 검토 §issue-1) ---
     판정 기준은 회전 전체(durationSec)가 아니라 진입부터 풍축(정풍상)
     통과까지의 구간 시간(entryToHeadWindSec). 풍축 이후 탈출·재정비는
     별도 회복 지표가 담당하므로 길어도 "느림"으로 깎지 않는다. */
  function tcRuleR6(ctx) {
    var tacks = [], i;
    for (i = 0; i < ctx.picked.length; i++) {
      if (tcIsTack(ctx.picked[i])) tacks.push(ctx.picked[i]);
    }
    if (!tacks.length) return null;
    var s = tcStats(tacks, ctx.windDir);
    if (s.headWind.mean == null) return null;   // 진입→풍축 시간 미산출 시 보류
    var skill = (ctx.rider && ctx.rider.skill) || '중급';
    var thr = TURN_COACH.SLOW_TACK_SEC[skill];
    if (thr == null) { skill = '중급'; thr = TURN_COACH.SLOW_TACK_SEC['중급']; }
    if (s.headWind.mean <= thr) return null;
    var sev = 50 + Math.min(12, (s.headWind.mean - thr) / thr * 12);
    var nums = i18nT('택킹 진입→풍축 시간 평균 {dur}초 ({skill} 기준 {thr}초)', {
      dur: s.headWind.mean.toFixed(1), skill: i18nT(skill), thr: thr
    });
    return tcBuild('R6', 'R6', sev,
      { skill: i18nT(skill), dur: s.headWind.mean.toFixed(1), thr: thr }, nums);
  }

  /* --- 룰 R7 : 2단으로 끊기는 회전 (Danny §7-8) --- */
  function tcRuleR7(ctx) {
    var s = tcStats(ctx.picked, ctx.windDir);
    if (s.nMulti < 1 || !s.n) return null;
    var frac = s.nMulti / s.n;
    if (frac < TURN_COACH.MULTI_PEAK_FRACTION) return null;
    var sev = 56 + Math.min(12, (frac - TURN_COACH.MULTI_PEAK_FRACTION)
      / (1 - TURN_COACH.MULTI_PEAK_FRACTION) * 12);
    var nums = i18nT('회전율 봉우리 2개 이상 {a}/{b}회', {a: s.nMulti, b: s.n});
    return tcBuild('R7', 'R7', sev, {}, nums);
  }

  /* --- 룰 R8 : 자이빙 탈출 각도 과깊음 (Danny 예시 2) --- */
  function tcRuleR8(ctx) {
    if (ctx.windDir == null || ctx.riderDownTwa == null) return null;
    var gybes = [], i;
    for (i = 0; i < ctx.picked.length; i++) {
      if (tcIsGybe(ctx.picked[i])) gybes.push(ctx.picked[i]);
    }
    if (!gybes.length) return null;
    var s = tcStats(gybes, ctx.windDir);
    if (s.xtwa.mean == null) return null;
    var deep = s.xtwa.mean - ctx.riderDownTwa;
    if (deep < TURN_COACH.DEEP_EXIT_DEG) return null;
    var sev = 88 + Math.min(12, (deep - TURN_COACH.DEEP_EXIT_DEG)
      / TURN_COACH.DEEP_EXIT_DEG * 12);
    var nums = i18nT('자이빙 탈출 CWA 평균 {x}° (라이더 풍하 평균 {r}°)', {
      x: Math.round(s.xtwa.mean), r: Math.round(ctx.riderDownTwa)
    });
    return tcBuild('R8', 'R8', sev, {}, nums);
  }

  /* --- 룰 R9 : 양호 — 대칭·고효율 (다른 룰이 없을 때만) --- */
  function tcRuleR9(ctx) {
    var s = tcStats(ctx.picked, ctx.windDir);
    if (s.eff.mean == null || s.eff.mean < TURN_COACH.GOOD_EFFICIENCY) return null;
    var nums = i18nT('평균 회전 효율 {eff}/100', {eff: Math.round(s.eff.mean)});
    return tcBuild('R9', 'R9', 8, { eff: Math.round(s.eff.mean) }, nums);
  }

  /* ============================================================
   * computeTurnCoaching — 회전 코칭 코멘트 산출
   * @param picked   선택된 회전 객체 배열 (비교 표가 보여주는 집합)
   * @param windDir  확정 풍향(도) — null 이면 P·S 코칭 불가
   * @param analysis An.analyzeSession() 결과 — 라이더 평균 TWA 참조
   * @param rider    { skill, ... } — 레벨별 임계용
   * @param opts     { toSpeed: fn(ms)->표시값, speedUnit: 'kt'|'km/h' }
   * @return { ok, headline, comments:[{id,status,title,numbers,
   *           diagnosis,advice,severity}], guard, splitMode }
   * ============================================================ */
  function computeTurnCoaching(picked, windDir, analysis, rider, opts) {
    opts = opts || {};
    if (!picked || !picked.length) return { ok: false, reason: 'no_selection' };
    var toDisp = opts.toSpeed || function (ms) { return ms * MS_TO_KT; };
    var unit = opts.speedUnit || 'kt';
    var P = [], S = [], i;
    for (i = 0; i < picked.length; i++) {
      if (picked[i].side === 'P') P.push(picked[i]);
      else if (picked[i].side === 'S') S.push(picked[i]);
    }
    var splitMode = (windDir != null) && P.length > 0 && S.length > 0;
    var rUp = null, rDown = null;
    if (analysis && analysis.wind && analysis.wind.tackSplit) {
      var tsp = analysis.wind.tackSplit;
      if (tsp.upwind && tsp.upwind.all && tsp.upwind.all.twa) {
        rUp = tsp.upwind.all.twa.avg;
      }
      if (tsp.downwind && tsp.downwind.all && tsp.downwind.all.twa) {
        rDown = tsp.downwind.all.twa.avg;
      }
    }
    var ctx = {
      picked: picked, P: P, S: S, splitMode: splitMode, windDir: windDir,
      rider: rider || {}, toDisp: toDisp, unit: unit,
      riderUpTwa: rUp, riderDownTwa: rDown
    };
    var comments = [];
    var c1 = tcRuleR1(ctx);
    if (c1) comments.push(c1);
    // R1(속도+각도)이 발화하면 같은 진입 속도 비대칭을 R2 가 중복하지 않음
    if (!c1) { var c2 = tcRuleR2(ctx); if (c2) comments.push(c2); }
    [tcRuleR3, tcRuleR4, tcRuleR5, tcRuleR6, tcRuleR7, tcRuleR8].forEach(function (fn) {
      var c = fn(ctx);
      if (c) comments.push(c);
    });
    if (!comments.length) { var g = tcRuleR9(ctx); if (g) comments.push(g); }
    comments.sort(function (a, b) { return b.severity - a.severity; });
    var top = comments.slice(0, TURN_COACH.MAX_CARDS);
    var guard = null;
    if (windDir == null) {
      guard = i18nT('풍향을 입력하면 포트·스타보드 비교 코칭이 가능합니다.');
    } else if (!splitMode) {
      guard = i18nT('한쪽 택만 선택돼 포트·스타보드 비대칭 코칭은 생략했습니다.');
    }
    return {
      ok: true, splitMode: splitMode,
      headline: top.length ? top[0].headline : null,
      comments: top, guard: guard
    };
  }

  /* ============================================================
   * 자체 테스트 — node --check 와 별개로 산출 로직 invariant 검증
   * ============================================================ */
  function runSelfTest() {
    var tests = 0, passed = 0, failed = [];
    function check(name, cond) {
      tests++;
      if (cond) passed++; else failed.push(name);
    }
    var Lift = liftAPI();
    check('lift-calculator(DMJLift) 사용 가능', !!(Lift && Lift.upwindSpeed));

    /* 스케일 헬퍼 — 경계값 */
    check('풍상 속도 점수: ratio 1.0 → 100', Math.round(upwindSpeedScore(1.0)) === 100);
    check('풍상 속도 점수: ratio 0.75 → 50', Math.round(upwindSpeedScore(0.75)) === 50);
    check('풍상 속도 점수: ratio 0.5 → 0', Math.round(upwindSpeedScore(0.5)) === 0);
    check('풍상 속도 점수: ratio 1.5 → 100 (상한 클램프)', upwindSpeedScore(1.5) === 100);
    check('풍하 속도 점수: ratio 1.4 → 100', Math.round(downwindSpeedScore(1.4)) === 100);
    check('풍하 속도 점수: ratio 1.0 → 50', Math.round(downwindSpeedScore(1.0)) === 50);
    check('풍하 속도 점수: ratio 0.6 → 0', Math.round(downwindSpeedScore(0.6)) === 0);

    /* combineSegment — 가중·결측 처리 */
    var c1 = combineSegment(80, 60);
    check('combine 80/60 → 0.7×80+0.3×60 = 74', c1.score === 74);
    var c2 = combineSegment(80, null);
    check('combine 회전 결측 → 속도 100% (80)', c2.score === 80 && c2.partial === true);
    var c3 = combineSegment(null, 60);
    check('combine 속도 결측 → score null', c3.score === null);

    /* computeWhatIf — 실제 계산기 호출 + 앵커링 invariant.
       핵심: "현재 윙" 막대는 반드시 실측 풍상 VMG 와 정확히 일치하고,
       최적은 결코 실측보다 낮지 않다 (자기모순 제거). */
    if (Lift && Lift.upwindCurve) {
      var MEAS_KT = 10.4;   // 실측 풍상 VMG 앵커 (What-if = 우세 택 상위 20%)
      /* 앵커 = max(포트, 스타보드) top20 — 우세 택(스타보드)이 MEAS_KT,
         약한 택(포트)은 그보다 낮게 두어 우세 택이 선택되는지 검증한다. */
      function wiWind(measKt) {
        return { wind: { tackSplit: { upwind: {
          P: { vmg: { top20: (measKt * 0.7) / MS_TO_KT } },
          S: { vmg: { top20: measKt / MS_TO_KT } }
        } } } };
      }
      var wiAnalysis = wiWind(MEAS_KT);
      var wiRider = { weightKg: 80, skill: '상급-선수', wingM2: 5.5, foilAR: 6.5 };
      var wi = computeWhatIf(wiAnalysis, wiRider, 14);
      check('what-if ok', wi.ok === true);
      check('what-if 앵커링 적용 (anchored=true)', wi.anchored === true);
      check('what-if 최적 윙 산출', wi.optimumWingM2 != null && wi.optimumWingM2 > 0);
      check('what-if 현재 윙 값 = 실측 풍상 VMG (앵커)',
        wi.actualVmgKt === round1(MEAS_KT));
      var apt = (wi.points || []).filter(function (p) { return p.isActual; })[0];
      check('what-if 스윕의 현재 윙 막대 = 실측값 (정확히 일치)',
        !!apt && apt.vmgKt === round1(MEAS_KT));
      check('what-if 최적 ≥ 실측 (자기모순 없음)',
        wi.optimumVmgKt != null && wi.optimumVmgKt >= wi.actualVmgKt);
      check('what-if delta ≥ 0 (최적이 현재 이상)',
        wi.deltaVmgKt == null || wi.deltaVmgKt >= 0);
      check('what-if 스윕에 현재 윙 5.5 포함',
        wi.sweep.min <= 5.5 && wi.sweep.max >= 5.5);
      /* 그래프 강조 ↔ 코치 판정 일치 — 추천 윙은 변경 추천 시 최적,
         아니면 현재 윙. points.isRecommended 도 이 값과 정확히 일치. */
      check('what-if 추천 윙 = 변경추천 시 최적·아니면 현재 윙',
        wi.recommendedWingM2 ===
          (wi.recommendChange ? wi.optimumWingM2 : wi.actualWingM2));
      check('what-if points.isRecommended 가 추천 윙과 일치',
        (wi.points || []).every(function (p) {
          return p.isRecommended ===
            (Math.round(p.area_m2 * 2) === Math.round(wi.recommendedWingM2 * 2));
        }));
      check('what-if 추천 윙 막대 정확히 1개',
        (wi.points || []).filter(function (p) { return p.isRecommended; }).length === 1);
      /* 편안함 추천 — 퍼포먼스 정점 − 0.5㎡(참고), 풍상 가능 최소 윙 이상 */
      check('what-if 편안함 추천 산출',
        wi.comfortWingM2 != null && wi.comfortWingM2 > 0);
      check('what-if 편안함 추천 = 정점−0.5㎡ 이상·정점 이하 (클램프 규칙)',
        wi.comfortWingM2 != null &&
        wi.comfortWingM2 >= wi.optimumWingM2 - WHATIF.SWEEP_STEP_M2 - 1e-6 &&
        wi.comfortWingM2 <= wi.optimumWingM2 + 1e-6);
      check('what-if 편안함 추천 막대 정확히 1개 (격자 위)',
        (wi.points || []).filter(function (p) { return p.isComfort; }).length === 1);
      var cPt = (wi.points || []).filter(function (p) { return p.isComfort; })[0];
      check('what-if 편안함 막대가 comfortWingM2 와 일치',
        !!cPt && Math.round(cPt.area_m2 * 2) === Math.round(wi.comfortWingM2 * 2));
      check('what-if 편안함 추천 VMG = 해당 막대 앵커값',
        wi.comfortVmgKt === (cPt ? cPt.vmgKt : null));
      check('what-if 노이즈 수준 개선은 미추천 (임계 ' +
        WHATIF.MEANINGFUL_DELTA_KT + ' kt)',
        wi.recommendChange === (wi.deltaVmgKt != null &&
          wi.deltaVmgKt >= WHATIF.MEANINGFUL_DELTA_KT));
      /* 앵커 선형성 — 곡선이 같으면 실측값을 2배로 주면 모든 막대도
         정확히 2배. 계산기 곡선을 나중에 교체해도 앵커 로직이 유효함을
         보장하는 불변식. */
      var wi2 = computeWhatIf(wiWind(2 * MEAS_KT), wiRider, 14);
      check('what-if 앵커 선형성 (실측 2배 → 막대 2배)',
        wi2.ok && wi2.optimumVmgKt != null &&
        Math.abs(wi2.optimumVmgKt - 2 * wi.optimumVmgKt) <= 0.2);
      /* 앵커 불가(실측 풍상 VMG 없음 — 풍향 미확정) → ok=false + missing */
      var wiNoAnchor = computeWhatIf({ wind: null }, wiRider, 14);
      check('what-if 실측 앵커 없으면 ok=false + missing',
        wiNoAnchor.ok === false && wiNoAnchor.missing &&
        wiNoAnchor.missing.length > 0);
    }

    /* computeVPS — mock analysis 로 invariant 검증 */
    var mockAnalysis = {
      wind: {
        vmgUpwindTop50Ms: 6.0 / MS_TO_KT,        // 풍상 VMG 6.0 kt
        upwindTimeSec: 600, downwindTimeSec: 400,
        tackSplit: { downwind: { all: { sog: { top50: 16.0 / MS_TO_KT } } } }
      },
      maneuverStats: {
        avgEfficiency: 65,
        groups: { tack: { all: { effAvg: 70 } }, gybe: { all: { effAvg: 55 } } }
      }
    };
    var vps = computeVPS(mockAnalysis,
      { weightKg: 80, skill: '상급', wingM2: 6.0, foilAR: 6.5 }, 205, 14);
    check('VPS ok (입력 충족)', vps.ok === true);
    if (vps.ok) {
      check('VPS upwind segment 객체 존재', !!vps.upwind);
      check('VPS overall segment 객체 존재', !!vps.overall);
      check('VPS downwind segment 객체 존재', !!vps.downwind);
      check('VPS detail 에 예측 풍상 VMG 존재',
        vps.detail.predUpwindVmgKt == null || vps.detail.predUpwindVmgKt > 0);
      /* SPS 회전 세부 점수 — 택킹·자이빙 분리 (Danny 2026-05-22).
         Upwind 카드=택킹만, Downwind 카드=자이빙만, Overall 카드=둘 다.
         합성 점수(score·turnScore)는 불변 — 표시용 분해만 추가했다.
         mockAnalysis: 택킹 효율 70 · 자이빙 효율 55 · 전체 평균 65. */
      check('VPS upwind 택킹 점수 = 택킹 효율 평균 (70)',
        vps.upwind.tackScore === 70);
      check('VPS upwind 자이빙 점수 없음 (풍상엔 자이빙 없음)',
        vps.upwind.gybeScore == null);
      check('VPS downwind 자이빙 점수 = 자이빙 효율 평균 (55)',
        vps.downwind.gybeScore === 55);
      check('VPS downwind 택킹 점수 없음 (풍하엔 택킹 없음)',
        vps.downwind.tackScore == null);
      check('VPS overall 택킹·자이빙 둘 다 노출 (70 · 55)',
        vps.overall.tackScore === 70 && vps.overall.gybeScore === 55);
      check('VPS upwind 합성 회전 점수 = 택킹 점수 (Upwind 회전=택킹)',
        vps.upwind.turnScore === vps.upwind.tackScore);
      check('VPS downwind 합성 회전 점수 = 자이빙 점수 (Downwind 회전=자이빙)',
        vps.downwind.turnScore === vps.downwind.gybeScore);
      check('VPS overall 합성 회전 점수 불변 (전체 회전 효율 평균 65)',
        vps.overall.turnScore === 65);
    }
    var vpsMissing = computeVPS(mockAnalysis,
      { weightKg: 0, skill: '', wingM2: 0 }, null, null);
    check('VPS 입력 부족 → ok=false + missing 목록',
      vpsMissing.ok === false && vpsMissing.missing && vpsMissing.missing.length > 0);

    /* computeTurnCoaching — 회전 코칭 룰 발화 invariant 검증 */
    function mkMv(o) {
      return {
        type: o.type, side: o.side,
        entrySpeedMs: o.entryKt / MS_TO_KT,
        exitSpeedMs: (o.exitKt != null ? o.exitKt : o.entryKt) / MS_TO_KT,
        minSpeedMs: (o.minKt != null ? o.minKt : o.entryKt * 0.6) / MS_TO_KT,
        lossPct: o.loss != null ? o.loss : 18,
        recoverySec: o.rec !== undefined ? o.rec : 8,
        durationSec: o.dur != null ? o.dur : 3.5,
        // 진입→풍축 시간 — R6 느림 판정용. 명시 없으면 회전 전체와 동일값.
        entryToHeadWindSec: o.hw != null ? o.hw : (o.dur != null ? o.dur : 3.5),
        turnAngle: 90,
        maxTurnRateDegSec: o.mtr != null ? o.mtr : 22,
        efficiency: o.eff != null ? o.eff : 60,
        headingBefore: o.hb, headingAfter: o.ha,
        turnPeaks: o.peaks != null ? o.peaks : 1
      };
    }
    function hasRule(res, id) {
      return res.ok && res.comments.some(function (c) { return c.id === id; });
    }
    var tcOpts = { toSpeed: function (ms) { return ms * MS_TO_KT; }, speedUnit: 'kt' };
    var tcRider = { skill: '중급' };

    check('회전코칭 빈 선택 → ok=false',
      computeTurnCoaching([], 0, null, tcRider, tcOpts).ok === false);

    /* R1 — 토우택 속도-각도 트레이드오프 (풍향 0; 스타보드가 빠르고 낮게 포인팅) */
    var r1mvs = [], ti;
    for (ti = 0; ti < 3; ti++) {
      r1mvs.push(mkMv({ type: 'tack', side: 'P', entryKt: 13.5, hb: 320, ha: 40 }));
      r1mvs.push(mkMv({ type: 'tack', side: 'S', entryKt: 15.5, hb: 55, ha: 320 }));
    }
    var tcR1 = computeTurnCoaching(r1mvs, 0, null, tcRider, tcOpts);
    check('회전코칭 R1 발화 (속도-각도 트레이드오프)', hasRule(tcR1, 'R1'));
    check('회전코칭 카드 최대 3개', tcR1.ok && tcR1.comments.length <= 3);

    /* R7 — 2단 회전 (봉우리 2개 다수) */
    var r7mvs = [
      mkMv({ type: 'tack', side: 'P', entryKt: 15, hb: 320, ha: 40, peaks: 2 }),
      mkMv({ type: 'tack', side: 'S', entryKt: 15, hb: 40, ha: 320, peaks: 2 }),
      mkMv({ type: 'tack', side: 'P', entryKt: 15, hb: 320, ha: 40, peaks: 2 }),
      mkMv({ type: 'tack', side: 'S', entryKt: 15, hb: 40, ha: 320, peaks: 1 })
    ];
    check('회전코칭 R7 발화 (2단 회전)',
      hasRule(computeTurnCoaching(r7mvs, 0, null, tcRider, tcOpts), 'R7'));

    /* R6 — 느린 택킹: 진입→풍축 시간이 레벨 기준 초과 시 발화 (검토 §issue-1).
       회전 전체(durationSec)가 아니라 진입→풍축 구간(entryToHeadWindSec)
       으로만 "느림"을 판정해야 한다. */
    var r6mvs = [], tk;
    for (tk = 0; tk < 3; tk++) {
      r6mvs.push(mkMv({ type: 'tack', side: 'P', entryKt: 14, hb: 320, ha: 40,
        dur: 12, hw: 8, peaks: 1 }));
      r6mvs.push(mkMv({ type: 'tack', side: 'S', entryKt: 14, hb: 40, ha: 320,
        dur: 12, hw: 8, peaks: 1 }));
    }
    check('회전코칭 R6 발화 (진입→풍축 8초 > 중급 기준 5초)',
      hasRule(computeTurnCoaching(r6mvs, 0, null, tcRider, tcOpts), 'R6'));
    /* 회전 전체는 14초로 길지만 진입→풍축이 3.5초로 빠르면 R6 미발화 —
       정의 분리(전반부만 판정) 검증. 옛 정의(durationSec)라면 오발화한다. */
    var r6fast = [], tf;
    for (tf = 0; tf < 3; tf++) {
      r6fast.push(mkMv({ type: 'tack', side: 'P', entryKt: 14, hb: 320, ha: 40,
        dur: 14, hw: 3.5, peaks: 1 }));
      r6fast.push(mkMv({ type: 'tack', side: 'S', entryKt: 14, hb: 40, ha: 320,
        dur: 14, hw: 3.5, peaks: 1 }));
    }
    check('회전코칭 R6 미발화 (회전 전체 14초·진입→풍축 3.5초)',
      !hasRule(computeTurnCoaching(r6fast, 0, null, tcRider, tcOpts), 'R6'));

    /* R9 — 대칭·고효율이면 긍정 코멘트만 */
    var r9mvs = [], tj;
    for (tj = 0; tj < 3; tj++) {
      r9mvs.push(mkMv({ type: 'tack', side: 'P', entryKt: 15, hb: 320, ha: 40,
        loss: 8, rec: 4, dur: 3, eff: 82, peaks: 1 }));
      r9mvs.push(mkMv({ type: 'tack', side: 'S', entryKt: 15, hb: 40, ha: 320,
        loss: 8, rec: 4, dur: 3, eff: 82, peaks: 1 }));
    }
    var tcR9 = computeTurnCoaching(r9mvs, 0, null, tcRider, tcOpts);
    check('회전코칭 R9 발화 (대칭·고효율 긍정)', hasRule(tcR9, 'R9'));
    check('회전코칭 양호 시 카드 1개', tcR9.ok && tcR9.comments.length === 1);

    /* 풍향 미확정 → guard 안내 */
    var tcNoWind = computeTurnCoaching(
      [mkMv({ type: 'turn', side: null, entryKt: 14, peaks: 1 }),
       mkMv({ type: 'turn', side: null, entryKt: 14, peaks: 1 })],
      null, null, tcRider, tcOpts);
    check('회전코칭 풍향 미확정 → guard 안내',
      tcNoWind.ok === true && !!tcNoWind.guard);

    return { tests: tests, passed: passed, failed: failed };
  }

  /* ============================================================
   * Recovery Decision Tree (sports_science_cross_modal_training_system.md §4)
   *
   * 4 factor (TSB · ACWR · HRV deviation · Hooper composite) + days since rest
   * → 4-zone action (full_ride / moderate / active_recovery / rest) + 자연어 사유.
   *
   * 입력:
   *   state = {
   *     tsb: -50..30 (Coggan, storage.computeFitnessTrend.current.TSB)
   *     acwr: 0.5..2.0 (Gabbett, storage.computeACWR — 향후)
   *     hrvDeviationSD: -3..3 (storage.computeHRVTrend — 향후)
   *     hooperComposite: 5-50 (storage.computeWellnessTrend — 향후)
   *     daysSinceRest: 0-14+ (storage 누적)
   *   }
   *   (모든 필드 optional — 없으면 그 factor 무시)
   *
   * 반환:
   *   {
   *     action: 'full_ride'|'moderate'|'active_recovery'|'rest',
   *     label: '🟢 풀 세션 OK' 등,
   *     primary_reason: 자연어 1줄,
   *     recommendation: 자연어 권고 (2-3줄),
   *     contributing_factors: [{factor, value, flag, note}],
   *     flag_count: { red, orange, yellow, green },
   *     next_check: '내일 아침 wellness'
   *   }
   *
   * Decision algorithm — flag count 기반:
   *   red ≥ 2          → rest
   *   red ≥ 1 OR orange ≥ 2 → active_recovery
   *   orange ≥ 1 OR yellow ≥ 3 → moderate
   *   else             → full_ride
   *
   * References:
   *   · Halson, S.L. 2014. "Monitoring training load to understand fatigue in
   *     athletes". Sports Med 44(Suppl 2):139-147.
   *     doi:10.1007/s40279-014-0253-z. PMID 25200666.
   *   · Saw, A.E., Main, L.C., Gastin, P.B. 2016. "Monitoring the athlete
   *     training response: subjective self-reported measures trump commonly used
   *     objective measures". Br J Sports Med 50(5):281-291.
   *     doi:10.1136/bjsports-2015-094758.
   *   · Soligard, T. et al. 2016. IOC consensus on load.
   *     Br J Sports Med 50(17):1030-1041. doi:10.1136/bjsports-2016-096581.
   *   · Plews, D.J. et al. 2013. HRV training adaptation.
   *     Sports Med 43(9):773-781. doi:10.1007/s40279-013-0071-8.
   * ============================================================ */
  function decideRecoveryAction(state) {
    state = state || {};
    var flags = { red: 0, orange: 0, yellow: 0, green: 0 };
    var factors = [];

    function record(factor, value, flag, note) {
      flags[flag]++;
      factors.push({ factor: factor, value: value, flag: flag, note: note });
    }

    /* --- TSB (Coggan PMC) --- */
    if (state.tsb != null && isFinite(state.tsb)) {
      if (state.tsb < -30) record('TSB', state.tsb, 'red', '과훈련 risk — 회복 필요');
      else if (state.tsb < -15) record('TSB', state.tsb, 'orange', '피로 누적 — 강도 조절');
      else if (state.tsb < 0) record('TSB', state.tsb, 'yellow', '훈련 부하 적정');
      else if (state.tsb < 25) record('TSB', state.tsb, 'green', '컨디션 양호');
      else record('TSB', state.tsb, 'green', '피크 — 레이스 준비 완료');
    }

    /* --- ACWR (Gabbett) --- */
    if (state.acwr != null && isFinite(state.acwr)) {
      if (state.acwr > 1.5 || state.acwr < 0.6) {
        record('ACWR', state.acwr, 'red',
          state.acwr > 1.5 ? '부상 위험 zone (>1.5)' : '훈련 부족 zone (<0.6)');
      } else if (state.acwr > 1.3 || state.acwr < 0.8) {
        record('ACWR', state.acwr, 'orange',
          state.acwr > 1.3 ? '부하 ↑ borderline' : '훈련 부족 borderline');
      } else if (state.acwr > 1.2 || state.acwr < 0.9) {
        record('ACWR', state.acwr, 'yellow', '모니터링 영역');
      } else {
        record('ACWR', state.acwr, 'green', 'sweet spot (0.9-1.2)');
      }
    }

    /* --- HRV deviation (Plews 2013) --- */
    if (state.hrvDeviationSD != null && isFinite(state.hrvDeviationSD)) {
      if (state.hrvDeviationSD < -2) {
        record('HRV', state.hrvDeviationSD, 'red',
          'parasympathetic withdrawal — 과훈련 또는 질병 signal');
      } else if (state.hrvDeviationSD < -1) {
        record('HRV', state.hrvDeviationSD, 'orange', '회복 부족');
      } else if (state.hrvDeviationSD < -0.5) {
        record('HRV', state.hrvDeviationSD, 'yellow', '회복 약간 부족');
      } else {
        record('HRV', state.hrvDeviationSD, 'green', 'baseline 정상');
      }
    }

    /* --- Hooper Index (subjective wellness) --- */
    if (state.hooperComposite != null && isFinite(state.hooperComposite)) {
      if (state.hooperComposite < 20) {
        record('Hooper', state.hooperComposite, 'red', '주관적 상태 매우 나쁨');
      } else if (state.hooperComposite < 30) {
        record('Hooper', state.hooperComposite, 'orange', '주관적 피로 ↑');
      } else if (state.hooperComposite < 38) {
        record('Hooper', state.hooperComposite, 'yellow', '주관적 상태 보통');
      } else {
        record('Hooper', state.hooperComposite, 'green', '주관적 상태 양호');
      }
    }

    /* --- Days since rest --- */
    if (state.daysSinceRest != null && isFinite(state.daysSinceRest)) {
      if (state.daysSinceRest > 10) {
        record('rest_gap', state.daysSinceRest, 'red',
          state.daysSinceRest + '일 연속 — 휴식일 필수');
      } else if (state.daysSinceRest > 7) {
        record('rest_gap', state.daysSinceRest, 'orange', '7일 이상 연속 훈련');
      }
    }

    /* --- Final decision --- */
    var action, label, recommendation, primary_reason;
    var top = factors.find(function (f) { return f.flag === 'red'; })
           || factors.find(function (f) { return f.flag === 'orange'; })
           || factors.find(function (f) { return f.flag === 'yellow'; })
           || factors[0];

    if (flags.red >= 2) {
      action = 'rest';
      label = '🔴 완전 휴식 권장';
      recommendation = '오늘은 라이딩 X. 수면 우선, 가벼운 산책 외 운동 금지. 내일 아침 wellness 재진단.';
      primary_reason = '복수 red flag — ' +
        factors.filter(function (f) { return f.flag === 'red'; })
               .map(function (f) { return f.factor; }).join(' + ') + ' 모두 위험 zone.';
    } else if (flags.red >= 1 || flags.orange >= 2) {
      action = 'active_recovery';
      label = '🟠 active recovery';
      recommendation = '라이딩 X 또는 z1 30분 light cruise. 육상 mobility / yoga 30분 권장. ' +
                       '내일 wellness check 후 강도 결정.';
      primary_reason = top
        ? (top.factor + ' = ' + top.value + ' ' + top.flag + ' — ' + top.note)
        : '회복 우선 권장.';
    } else if (flags.orange >= 1 || flags.yellow >= 3) {
      action = 'moderate';
      label = '🟡 적정 강도';
      recommendation = '오늘 라이딩 OK 단 강도 조절. z2 80% / z3 20% 유지. ' +
                       '강풍 시 짧은 burst 만, 풍상-풍하 cycle 사이 cruise 5분 휴식.';
      primary_reason = top
        ? (top.factor + ' = ' + top.value + ' — ' + top.note)
        : '훈련 균형 유지.';
    } else {
      action = 'full_ride';
      label = '🟢 풀 세션 OK';
      recommendation = '오늘 라이딩 OK — full intensity. 풍속 좋으면 z3-z4 push. ' +
                       '회전 quality 와 distance best 도전 권장.';
      primary_reason = '모든 factor green flag — peak readiness.';
    }

    return {
      action: action,
      label: label,
      primary_reason: primary_reason,
      recommendation: recommendation,
      contributing_factors: factors,
      flag_count: flags,
      next_check: 'tomorrow morning Hooper after sleep'
    };
  }

  /* ============================================================
   * generateDailyNotification — 단무지 design 의 1줄 알림 generator
   *
   * Event-Aware Periodization (sports_science_event_periodization_system.md §5).
   * Plan + recovery + weather → 한국어 자연어 알림 (push 메시지 본문).
   *
   * 단무지 톤 — 짧고 명확, 존댓말, 격려, 이모지 0-1개.
   *
   * 입력:
   *   plan      = buildPeriodizationPlan().weeks[N].days[M] (오늘 plan)
   *   recovery  = decideRecoveryAction() output (action zone + reason)
   *   weather   = { wind_kt, forecast_6hr } (선택)
   *
   * 출력:
   *   {
   *     title: '🎯 오늘의 plan',
   *     body: '...',
   *     priority: 'high'|'normal',
   *     suggested_action: 'open_today_screen'
   *   }
   * ============================================================ */
  function generateDailyNotification(plan, recovery, weather) {
    plan = plan || {};
    recovery = recovery || {};
    weather = weather || {};

    var title, body;
    var target = plan.target_AU || 0;
    var actionZone = recovery.action || 'full_ride';
    var wind = weather.wind_kt;
    var planType = plan.type || 'moderate';

    /* === Title === */
    if (target < 5) {
      title = '🌙 오늘 휴식일';
    } else if (planType === 'race') {
      title = '🏁 오늘 경기';
    } else if (recovery.action === 'rest') {
      title = '🔴 완전 휴식 권고';
    } else if (recovery.action === 'active_recovery') {
      title = '🟠 active recovery';
    } else {
      title = '🎯 오늘 ' + Math.round(target) + ' AU';
    }

    /* === Body — 단무지 톤 (1-2 문장) === */
    if (target < 5) {
      body = '계획된 휴식일입니다. 충분한 수면과 회복 우선해 주세요.';
    } else if (planType === 'race') {
      body = '경기일입니다. 30분 전 warm-up, 경기 후 30분 안에 CHO + 단백질, 자기 전 카제인 40g.';
    } else if (recovery.action === 'rest') {
      body = recovery.primary_reason + ' 오늘은 휴식하시고 내일 다시 평가하겠습니다.';
    } else if (recovery.action === 'active_recovery') {
      body = '회복 신호 — 라이딩 X 또는 z1 30분 light. ' +
             (target ? '계획 ' + Math.round(target) + ' AU 중 30-40% 정도만.' : '');
    } else if (typeof wind === 'number' && wind < 8) {
      body = '풍속 ' + wind + 'kt — 라이딩 어려움. ' +
             'Land workout ' + Math.round(target) + ' AU 로 보충 권장.';
    } else if (planType === 'high_intensity') {
      body = (plan.phase || 'training') + ' phase — race-specific 강도. ' +
             'Target ' + Math.round(target) + ' AU. 컨디션 ' + actionZone + '.';
    } else {
      body = (plan.phase || 'training') + ' phase, target ' + Math.round(target) + ' AU. ' +
             '컨디션 양호 — 계획대로 진행하세요.';
    }

    var priority = (recovery.action === 'rest' || recovery.action === 'active_recovery'
                   || planType === 'race') ? 'high' : 'normal';

    return {
      title: title,
      body: body,
      priority: priority,
      suggested_action: 'open_today_screen',
      meta: {
        target_AU: target,
        phase: plan.phase,
        recovery_zone: actionZone,
        wind_kt: wind
      }
    };
  }

  var Coach = {
    VPS: VPS,
    WHATIF: WHATIF,
    TURN_COACH: TURN_COACH,
    TURN_COACH_TEXT: TURN_COACH_TEXT,
    computeVPS: computeVPS,
    computeWhatIf: computeWhatIf,
    detectWingNotBottleneck: detectWingNotBottleneck,   /* §414 (Timo §4-1) */
    computeTurnCoaching: computeTurnCoaching,
    decideRecoveryAction: decideRecoveryAction,
    generateDailyNotification: generateDailyNotification,
    measuredUpwindVmgKt: measuredUpwindVmgKt,
    upwindSpeedScore: upwindSpeedScore,
    downwindSpeedScore: downwindSpeedScore,
    vpsBand: vpsBand,             /* §424-F — SPS 티어 밴드 canonical */
    VPS_BANDS: VPS_BANDS,
    runSelfTest: runSelfTest
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Coach;
  else global.RDCoach = Coach;
})(typeof window !== 'undefined' ? window : globalThis);
