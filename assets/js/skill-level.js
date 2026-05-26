/* ============================================================
 * skill-level.js — 데이터 주도 스킬 레벨 평가 (v2)
 *
 * 설계안: 스킬레벨_데이터주도_설계안_v2_2026-05-22.md
 *  · 주 신호 = 라이딩 대시보드 maneuver 효율(택킹/자이빙 effTop50)
 *  · 보조   = 최고속도 · 풍상각 · 힐
 *  · 바람 조건 정규화 (풍속 밴드별 보정계수)
 *  · 데이터 + 설문 신뢰도(confidence) 블렌딩
 *  · 추천·동의 — 데이터 등급 ≠ 현재 등급이면 추천만, 동의 시 갱신
 *
 * 순수 로직 모듈 — DOM 의존 없음. profile.html · riding-dashboard 공용.
 * 16개 노브는 설계안 §7 권장 기본값. KNOBS 에서 일괄 조정 가능.
 * ============================================================ */
(function (global) {
  'use strict';

  var MS_TO_KT = 1.94384;

  /* ---- 노브 (설계안 §7 권장 기본값) ---- */
  var KNOBS = {
    /* 1·2. 풍속 밴드 + 바람 정규화 보정계수 */
    windBands: [
      { name: '약풍', maxKt: 12, factor: 1.20 },
      { name: '중풍', maxKt: 20, factor: 1.00 },
      { name: '강풍', maxKt: 999, factor: 0.95 }
    ],
    axisFloor: 50,            /* 5. 축당 바닥 점수 */
    peakW: 0.60, breadthW: 0.40,   /* 4. 타입 대표 = 강한측·약한측 혼합 */
    /* 6. 데이터 점수 가중치 (heel 결측 시 재정규화) */
    wManeuver: 0.50, wSpeed: 0.25, wUpwind: 0.15, wHeel: 0.10,
    /* 7. 적응형 — 회전 표본이 적으면 maneuver 비중↓ 속도↑ */
    richnessFullAt: 12,
    /* 8. 속도(kt) → 0~100 앵커 */
    speedAnchors: [[0,0],[10,20],[18,40],[25,60],[30,80],[38,100]],
    /* 9. 풍상 close-hauled TWA(도) → 0~100 */
    upwindAnchors: [[40,100],[45,92],[50,78],[58,60],[68,42],[80,30]],
    /* 11. 설문 5점 만족도 척도 → 0~100 점수 (매우불만족 ~ 매우만족) */
    surveyMap: [20, 40, 60, 80, 100],
    /* 12. confidence 계수 (상한 0.97) */
    confManeuver: 0.45, confSides: 0.30, confSessions: 0.15, confWind: 0.10,
    confCap: 0.97,
    /* 13. 추천 신뢰도 게이트 */
    recommendGate: 0.50,
    /* 15. 등급 경계 */
    tierBounds: [20, 40, 60, 80]
  };

  var TIER_NAMES = ['입문', '초급', '중급', '상급', '선수'];
  var TIER_COLOR = { '입문':'#4ade80','초급':'#67e8f9','중급':'#3FB8C9',
                     '상급':'#FF8A3D','선수':'#FFB800' };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function tierIndex(name) { var i = TIER_NAMES.indexOf(name); return i < 0 ? -1 : i + 1; }

  /* 0~100 점수 → 등급 (skill-assessment.html getOverallTier 와 동일 경계) */
  function tierFromScore(s) {
    if (s == null || s <= 0) return '—';
    var b = KNOBS.tierBounds;
    if (s <= b[0]) return '입문';
    if (s <= b[1]) return '초급';
    if (s <= b[2]) return '중급';
    if (s <= b[3]) return '상급';
    return '선수';
  }

  /* 풍속(kt) → 밴드 */
  function windBand(kt) {
    var bands = KNOBS.windBands;
    for (var i = 0; i < bands.length; i++) {
      if (kt <= bands[i].maxKt) return bands[i];
    }
    return bands[bands.length - 1];
  }

  /* 구간 선형 보간 */
  function interp(anchors, x) {
    if (x <= anchors[0][0]) return anchors[0][1];
    if (x >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
    for (var i = 0; i < anchors.length - 1; i++) {
      var a = anchors[i], b = anchors[i + 1];
      if (x >= a[0] && x <= b[0]) {
        return a[1] + (x - a[0]) / (b[0] - a[0]) * (b[1] - a[1]);
      }
    }
    return anchors[anchors.length - 1][1];
  }

  function speedScore(kt)  { return interp(KNOBS.speedAnchors, kt || 0); }
  function upwindScore(twa) { return interp(KNOBS.upwindAnchors, twa); }

  /* 풍상 힐 각도(도) → 0~100. lift-calculator HEEL_BY_SKILL (상급39·선수42) 기반 */
  function heelScore(deg) {
    if (deg == null) return null;
    if (deg >= 42) return 100;
    if (deg >= 40) return 95;
    if (deg >= 38) return 88;
    if (deg >= 35) return 75;
    if (deg >= 30) return 62;
    return KNOBS.axisFloor;
  }

  /* ---- maneuver 효율 → 점수 ---- */
  /* effTop50 을 바람 보정 + floor. 데이터 없으면 null. */
  function normEff(effTop50, windFactor) {
    if (effTop50 == null || !isFinite(effTop50)) return null;
    return clamp(effTop50 * windFactor, KNOBS.axisFloor, 100);
  }

  /* 한 maneuver 타입(택 또는 자이브)의 대표 점수 — peak 기반.
     양측 다 있으면 0.6×강한측 + 0.4×약한측. 한쪽만 있으면 그쪽. 둘 다 없으면 null. */
  function typeRep(sideP, sideS) {
    var sides = [];
    if (sideP != null) sides.push(sideP);
    if (sideS != null) sides.push(sideS);
    if (!sides.length) return null;
    if (sides.length === 1) return sides[0];
    var hi = Math.max(sides[0], sides[1]), lo = Math.min(sides[0], sides[1]);
    return KNOBS.peakW * hi + KNOBS.breadthW * lo;
  }

  /* ============================================================
   * 세션 레코드 집계 → dataProfile
   * sessions: storage.js buildRecord 레코드 배열. 각 레코드의
   *   skillGroups = { tack:{P:{effTop50,count},S:{...}}, gybe:{...} }
   *   windSpeedKt, maxSpeedMs, upwindTwaAvg 를 사용.
   * 바람 정규화는 세션별로(각 세션의 풍속 밴드로) 먼저 적용한 뒤 집계한다.
   * ============================================================ */
  function aggregateSessions(sessions) {
    if (!sessions || !sessions.length) return null;
    /* group-side 별 가중합 (회전수 가중) */
    var acc = { tackP:[0,0], tackS:[0,0], gybeP:[0,0], gybeS:[0,0] };
    var maxSpeedMs = 0, upwindSum = 0, upwindN = 0;
    var totalManeuvers = 0, windBandSet = {}, usable = 0;

    function add(key, normVal, count) {
      if (normVal == null) return;
      var w = count > 0 ? count : 1;
      acc[key][0] += normVal * w;
      acc[key][1] += w;
    }

    sessions.forEach(function (rec) {
      if (!rec) return;
      var kt = (rec.windSpeedKt != null) ? rec.windSpeedKt : null;
      if (rec.maxSpeedMs > maxSpeedMs) maxSpeedMs = rec.maxSpeedMs;
      if (rec.upwindTwaAvg != null && isFinite(rec.upwindTwaAvg)) {
        upwindSum += rec.upwindTwaAvg; upwindN++;
      }
      var g = rec.skillGroups;
      if (!g) return;
      usable++;
      var band = windBand(kt != null ? kt : 16);   /* 풍속 미입력 → 중풍 가정 */
      windBandSet[band.name] = true;
      ['tack', 'gybe'].forEach(function (t) {
        ['P', 'S'].forEach(function (side) {
          var cell = g[t] && g[t][side];
          if (!cell) return;
          var ne = normEff(cell.effTop50, band.factor);
          add(t + side, ne, cell.count);
          totalManeuvers += (cell.count || 0);
        });
      });
    });

    function avg(key) { return acc[key][1] > 0 ? acc[key][0] / acc[key][1] : null; }

    var bothSides = (acc.tackP[1] > 0 && acc.tackS[1] > 0) ||
                    (acc.gybeP[1] > 0 && acc.gybeS[1] > 0);

    return {
      tack: { P: avg('tackP'), S: avg('tackS') },
      gybe: { P: avg('gybeP'), S: avg('gybeS') },
      maxSpeedKt: maxSpeedMs * MS_TO_KT,
      upwindTwaAvg: upwindN > 0 ? upwindSum / upwindN : null,
      heelDeg: null,                       /* GPX 엔 자세 없음 — .vkx 대비 */
      totalManeuvers: totalManeuvers,
      sessionCount: usable,
      bothSides: bothSides,
      windBandCount: Object.keys(windBandSet).length
    };
  }

  /* dataProfile → 데이터 주도 점수 0~100 + 등급 + 분해 */
  function dataDrivenScore(p) {
    if (!p) return null;
    var tackRep = typeRep(p.tack && p.tack.P, p.tack && p.tack.S);
    var gybeRep = typeRep(p.gybe && p.gybe.P, p.gybe && p.gybe.S);
    var reps = [];
    if (tackRep != null) reps.push(tackRep);
    if (gybeRep != null) reps.push(gybeRep);
    var maneuverScore = reps.length
      ? reps.reduce(function (a, b) { return a + b; }, 0) / reps.length : null;

    var sp = speedScore(p.maxSpeedKt);
    var uw = (p.upwindTwaAvg != null) ? upwindScore(p.upwindTwaAvg) : null;
    var hl = heelScore(p.heelDeg);

    /* 적응형 가중치 — 회전 표본이 적으면 maneuver↓ 속도↑ */
    var richness = clamp((p.totalManeuvers || 0) / KNOBS.richnessFullAt, 0, 1);
    var wMan = 0.30 + 0.20 * richness;
    var wSpd = 0.25 + 0.20 * (1 - richness);
    var parts = [];
    if (maneuverScore != null) parts.push([maneuverScore, wMan]);
    parts.push([sp, wSpd]);
    if (uw != null) parts.push([uw, KNOBS.wUpwind]);
    if (hl != null) parts.push([hl, KNOBS.wHeel]);
    var wSum = 0, vSum = 0;
    parts.forEach(function (pr) { vSum += pr[0] * pr[1]; wSum += pr[1]; });
    var final = wSum > 0 ? clamp(vSum / wSum, 0, 100) : null;

    return {
      final: final,
      tier: tierFromScore(final),
      maneuverScore: maneuverScore,
      tackRep: tackRep, gybeRep: gybeRep,
      speedScore: sp, upwindScore: uw, heelScore: hl,
      weights: { maneuver: wMan, speed: wSpd, upwind: uw != null ? KNOBS.wUpwind : 0,
                 heel: hl != null ? KNOBS.wHeel : 0 }
    };
  }

  /* ---- 설문 점수 (보조) ----
   * 5점 만족도 척도 (Danny 2026-05-23) — 미입력 상태 폐지. 모든 축이 값을 갖는다.
   *   인덱스 0 매우불만족 / 1 불만족 / 2 보통 / 3 만족 / 4 매우만족
   *   → KNOBS.surveyMap [20,40,60,80,100] 으로 0~100 점수.
   * 집계: 각 축 독립, peak 기반(상위50% 평균 0.6 + 전체 0.4).
   * indices 는 항상 5점 척도(0..4). 레거시 payload 는 normalizeSurveyIndices 로 먼저 변환. */
  function surveyAxisScore(idx) {
    var n = parseInt(idx, 10);
    if (isNaN(n)) return null;
    n = clamp(n, 0, 4);
    return KNOBS.surveyMap[n];
  }

  function surveyScore(indices) {
    if (!indices || !indices.length) return null;
    var vals = [];
    indices.forEach(function (idx) {
      var v = surveyAxisScore(idx);
      if (v != null) vals.push(v);
    });
    if (!vals.length) return null;
    var srt = vals.slice().sort(function (a, b) { return b - a; });
    var k = Math.max(1, Math.round(srt.length * 0.5));
    var peak = 0; for (var i = 0; i < k; i++) peak += srt[i]; peak /= k;
    var all = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var score = KNOBS.peakW * peak + KNOBS.breadthW * all;
    return { score: score, tier: tierFromScore(score), axesAnswered: vals.length };
  }

  /* 저장 payload 의 indices 를 5점 척도(0..4)로 정규화.
   *   v >= 5 : 신규 5점 척도 — 클램프만.
   *   v <  5 : 레거시 — 6단계 인코딩(0/2/3/5 등)을 3단계로 디코드 후 5점으로 매핑.
   *            매핑: 0 미입력→2 보통 / 1 정말못함→0 매우불만족 / 2 문제없음→3 만족 / 3 완벽→4 매우만족.
   *            v < 3 payload 는 P-first AXES → S-first 로 좌우 절반 swap (§169).
   * skill-assessment.html restoreFromLocalStorage 의 인라인 마이그레이션과 동일 로직 유지. */
  function normalizeSurveyIndices(rawIndices, payloadVersion) {
    if (!Array.isArray(rawIndices)) return [];
    var v = parseInt(payloadVersion, 10) || 1;
    if (v >= 5) {
      return rawIndices.map(function (x) {
        var n = parseInt(x, 10);
        return isNaN(n) ? 2 : clamp(n, 0, 4);
      });
    }
    var DEC6TO3 = [0, 1, 1, 2, 2, 3];
    var OLD3TO5 = [2, 0, 3, 4];
    var out = rawIndices.map(function (x) {
      var n = parseInt(x, 10); if (isNaN(n)) n = 0;
      return OLD3TO5[DEC6TO3[clamp(n, 0, 5)]];
    });
    if (v < 3 && out.length === 10) out = out.slice(5, 10).concat(out.slice(0, 5));
    return out;
  }

  /* 데이터 신뢰도 0~confCap */
  function dataConfidence(p) {
    if (!p) return 0;
    var K = KNOBS;
    var cnt  = clamp((p.totalManeuvers || 0) / 20, 0, 1);
    var side = p.bothSides ? 1.0 : 0.45;
    var sess = clamp((p.sessionCount || 0) / 3, 0.33, 1);
    var wind = clamp((p.windBandCount || 0) / 2, 0.5, 1);
    var c = K.confManeuver * cnt + K.confSides * side +
            K.confSessions * sess + K.confWind * wind;
    return Math.round(clamp(c, 0, K.confCap) * 100) / 100;
  }

  /* 데이터 + 설문 결합 */
  function combine(dataScore, surveyVal, conf) {
    if (dataScore == null && surveyVal == null) return null;
    if (dataScore == null) return { score: surveyVal, how: '설문만 (라이딩 데이터 없음)' };
    if (surveyVal == null) return { score: dataScore, how: '데이터만' };
    var blended = conf * dataScore + (1 - conf) * surveyVal;
    return {
      score: blended,
      how: '데이터 ' + Math.round(conf * 100) + '% + 설문 ' + Math.round((1 - conf) * 100) + '%'
    };
  }

  /* ============================================================
   * evaluate — 최상위. profile.html 추천 카드가 필요로 하는 모든 것.
   * input: {
   *   currentLevel : '중급' 등 — 현재 저장 레벨 (없으면 null)
   *   sessions     : 대시보드 세션 레코드 배열 (없으면 [] / null)
   *   survey       : { indices:[...] } — 5점 척도(0..4). 레거시는 normalizeSurveyIndices 선처리 (없으면 null)
   * }
   * ============================================================ */
  function evaluate(input) {
    input = input || {};
    var profile = aggregateSessions(input.sessions);
    var dataRes = profile ? dataDrivenScore(profile) : null;
    var conf = profile ? dataConfidence(profile) : 0;

    var survey = input.survey
      ? surveyScore(input.survey.indices) : null;

    var dataScoreVal = dataRes ? dataRes.final : null;
    var surveyScoreVal = survey ? survey.score : null;
    var combined = combine(dataScoreVal, surveyScoreVal, conf);
    var finalScore = combined ? combined.score : null;
    var recommendedLevel = finalScore != null ? tierFromScore(finalScore) : null;

    var currentLevel = input.currentLevel || null;
    var curIdx = tierIndex(currentLevel || '');
    var recIdx = tierIndex(recommendedLevel || '');

    /* 추천 가드레일 — 데이터 존재 + 신뢰도 게이트 + 등급 불일치 */
    var hasData = !!(profile && profile.sessionCount > 0);
    var shouldRecommend = hasData && currentLevel != null &&
      recommendedLevel != null && recommendedLevel !== '—' &&
      conf >= KNOBS.recommendGate && recIdx !== curIdx && recIdx > 0;

    var recommendation = null;
    if (shouldRecommend) {
      recommendation = {
        from: currentLevel,
        to: recommendedLevel,
        direction: recIdx > curIdx ? 'up' : 'down',
        strength: conf >= 0.80 ? '높음' : (conf >= 0.60 ? '보통' : '낮음')
      };
    }

    /* 카드 근거 수치 */
    var evidence = null;
    if (dataRes && profile) {
      evidence = {
        tackEff: dataRes.tackRep != null ? Math.round(dataRes.tackRep) : null,
        gybeEff: dataRes.gybeRep != null ? Math.round(dataRes.gybeRep) : null,
        maxSpeedKt: profile.maxSpeedKt != null ? Math.round(profile.maxSpeedKt * 10) / 10 : null,
        upwindTwa: profile.upwindTwaAvg != null ? Math.round(profile.upwindTwaAvg) : null,
        sessionCount: profile.sessionCount,
        maneuverCount: profile.totalManeuvers,
        bothSides: profile.bothSides,
        windBandCount: profile.windBandCount,
        confidence: conf
      };
    }

    return {
      currentLevel: currentLevel,
      recommendedLevel: recommendedLevel,
      recommendedColor: TIER_COLOR[recommendedLevel] || '#3FB8C9',
      dataScore: dataScoreVal != null ? Math.round(dataScoreVal * 10) / 10 : null,
      dataLevel: dataRes ? dataRes.tier : null,
      surveyScore: surveyScoreVal != null ? Math.round(surveyScoreVal * 10) / 10 : null,
      surveyLevel: survey ? survey.tier : null,
      confidence: conf,
      blendedScore: finalScore != null ? Math.round(finalScore * 10) / 10 : null,
      blendHow: combined ? combined.how : null,
      shouldRecommend: shouldRecommend,
      recommendation: recommendation,
      evidence: evidence,
      detail: dataRes
    };
  }

  /* ============================================================
   * self-test
   * ============================================================ */
  function selfTest() {
    var results = [], pass = 0, fail = 0;
    function check(name, cond) {
      results.push({ name: name, ok: !!cond });
      if (cond) pass++; else fail++;
    }
    function near(a, b, tol) { return Math.abs(a - b) <= (tol || 0.5); }

    check('tierFromScore 58 → 중급', tierFromScore(58) === '중급');
    check('tierFromScore 88 → 선수', tierFromScore(88) === '선수');
    check('tierFromScore 81 → 선수 (경계)', tierFromScore(81) === '선수');
    check('tierFromScore 80 → 상급 (경계)', tierFromScore(80) === '상급');
    check('windBand 10kt → 약풍 ×1.20', windBand(10).name === '약풍' && windBand(10).factor === 1.20);
    check('windBand 15kt → 중풍 ×1.00', windBand(15).factor === 1.00);
    check('windBand 25kt → 강풍 ×0.95', windBand(25).factor === 0.95);
    check('speedScore 32kt ≈ 85', near(speedScore(32), 85, 0.6));
    check('speedScore 0 → 0', speedScore(0) === 0);
    check('upwindScore 43° ≈ 95', near(upwindScore(43), 95.2, 1));
    check('heelScore 41° → 95', heelScore(41) === 95);
    check('heelScore 결측 → null', heelScore(null) === null);
    check('normEff floor — 약풍 효율 30 → 50(바닥)', normEff(30, 1.20) === 50);
    check('normEff 약풍 76×1.20 → 91.2', near(normEff(76, 1.20), 91.2, 0.1));
    check('typeRep peak 혼합 90/86 → 88.4', near(typeRep(90, 86), 88.4, 0.1));
    check('typeRep 한쪽만 → 그값', typeRep(90, null) === 90);
    check('typeRep 둘다 결측 → null', typeRep(null, null) === null);

    /* 설문 — 5점 만족도 척도 */
    var sv = surveyScore([3,3,3,3,2,3,3,2,2,1]);
    check('surveyScore 5점 산출됨', sv && sv.score > 0);
    check('surveyScore 전부 매우만족 → 100', near(surveyScore([4,4,4,4,4,4,4,4,4,4]).score, 100, 0.01));
    check('surveyScore 전부 매우불만족 → 20', near(surveyScore([0,0,0,0,0,0,0,0,0,0]).score, 20, 0.01));
    check('surveyScore 전부 보통 → 60', near(surveyScore([2,2,2,2,2,2,2,2,2,2]).score, 60, 0.01));
    check('surveyScore 빈 배열 → null', surveyScore([]) === null);

    /* normalizeSurveyIndices — 레거시 → 5점 마이그레이션 */
    check('normalize v5 — 클램프만',
      JSON.stringify(normalizeSurveyIndices([4,3,2,1,0], 5)) === JSON.stringify([4,3,2,1,0]));
    check('normalize v4 레거시 6단계 → 5점',
      JSON.stringify(normalizeSurveyIndices([5,3,2,0], 4)) === JSON.stringify([4,3,0,2]));
    var swp = normalizeSurveyIndices([0,0,0,0,0,1,1,1,1,1], 2);
    check('normalize v2 — P/S 좌우 swap', swp[0] === 0 && swp[9] === 2);

    /* Danny 표준 세션 — 데이터 주도 → 선수 */
    var dannySessions = makeDannySessions();
    var ev = evaluate({
      currentLevel: '중급',
      sessions: dannySessions,
      survey: { indices: [3,3,3,3,2,3,3,2,2,1] }
    });
    check('Danny 데이터 등급 = 선수', ev.dataLevel === '선수');
    check('Danny 추천 레벨 = 선수', ev.recommendedLevel === '선수');
    check('Danny 추천 발생 (shouldRecommend)', ev.shouldRecommend === true);
    check('Danny 추천 방향 = 상향(up)', ev.recommendation && ev.recommendation.direction === 'up');
    check('Danny 신뢰도 ≥ 0.8', ev.confidence >= 0.8);
    check('Danny 근거: 택킹 효율 존재', ev.evidence && ev.evidence.tackEff > 0);

    /* 추천 안 함 — 데이터 없음 */
    var evNo = evaluate({ currentLevel: '중급', sessions: [], survey: null });
    check('데이터 없으면 추천 안 함', evNo.shouldRecommend === false);

    /* 추천 안 함 — 데이터 등급 = 현재 등급 */
    var evSame = evaluate({ currentLevel: '선수', sessions: dannySessions });
    check('데이터=현재 이면 추천 안 함', evSame.shouldRecommend === false);

    return { passed: pass, failed: fail, results: results };
  }

  /* Danny 검증용 합성 세션 (한국 1위 가정 — 설계안 §6) */
  function makeDannySessions() {
    function session(windKt, tP, tS, gP, gS, maxKt, twa, n) {
      return {
        windSpeedKt: windKt,
        maxSpeedMs: maxKt / MS_TO_KT,
        upwindTwaAvg: twa,
        skillGroups: {
          tack: { P: { effTop50: tP, count: n }, S: { effTop50: tS, count: n } },
          gybe: { P: { effTop50: gP, count: n }, S: { effTop50: gS, count: n } }
        }
      };
    }
    return [
      session(15, 90, 86, 88, 85, 32, 43, 6),   /* 중풍 표준 */
      session(10, 76, 72, 75, 71, 24, 46, 5),   /* 약풍 — 정규화 검증 */
      session(22, 92, 89, 90, 88, 33, 44, 6)    /* 강풍 */
    ];
  }

  var API = {
    KNOBS: KNOBS,
    TIER_NAMES: TIER_NAMES,
    TIER_COLOR: TIER_COLOR,
    tierFromScore: tierFromScore,
    tierIndex: tierIndex,
    windBand: windBand,
    speedScore: speedScore,
    upwindScore: upwindScore,
    heelScore: heelScore,
    aggregateSessions: aggregateSessions,
    dataDrivenScore: dataDrivenScore,
    surveyScore: surveyScore,
    normalizeSurveyIndices: normalizeSurveyIndices,
    dataConfidence: dataConfidence,
    combine: combine,
    evaluate: evaluate,
    selfTest: selfTest,
    makeDannySessions: makeDannySessions
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.DMJSkillLevel = API;

  /* node 직접 실행 시 self-test 출력 */
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var r = selfTest();
    r.results.forEach(function (x) {
      console.log((x.ok ? '  PASS  ' : '  FAIL  ') + x.name);
    });
    console.log('\n' + r.passed + ' passed, ' + r.failed + ' failed');
    var ev = evaluate({
      currentLevel: '중급',
      sessions: makeDannySessions(),
      survey: { indices: [3,3,3,3,2,3,3,2,2,1] }
    });
    console.log('\n--- Danny evaluate() ---');
    console.log(JSON.stringify(ev, null, 2));
    process.exit(r.failed ? 1 : 0);
  }

})(typeof window !== 'undefined' ? window : globalThis);
