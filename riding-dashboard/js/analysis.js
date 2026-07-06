/* ============================================================
 * analysis.js — 분석 엔진 (라이딩 통계 대시보드 Phase 1)
 *
 * 이 파일이 "코치 등급 분석"의 핵심이며, Phase 2(모바일)에서
 * 그대로 재사용할 수 있도록 UI·DOM 의존성 없이 순수 로직만 담는다.
 *
 * 파이프라인:
 *   parseGPX 결과 -> normalizeSession() -> 1Hz 리샘플 + 운동학 계산
 *   -> analyzeSession() 으로 모든 지표 산출
 *
 * 내부 단위: 거리 m, 시간 s, 속도 m/s, 각도 도(0~360).
 * 튜닝 파라미터는 DEFAULTS 에 모아 두었다 (검출 알고리즘 보정용).
 * ============================================================ */
(function (global) {
  'use strict';

  var Geo = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./geo.js') : global.RDGeo;

  /* --- 튜닝 파라미터 (코치 검증으로 보정 가능) --- */
  var DEFAULTS = {
    gapThresholdSec: 8,        // 이보다 큰 시간 공백은 leg(구간) 분리
    speedSmoothSec: 1.6,       // 속도 이동평균 반창(±초) — 표시·검출용
    headingSmoothSec: 1.6,     // 헤딩 이동평균 반창(±초)
    movingSpeedKt: 1.5,        // 이 속도 이상 = "이동 중"
    activeSpeedKt: 11,         // 이 속도 이상 = "활주(포일링 추정)" 구간
    turnRateSmoothSec: 2.5,     // 헤딩 변화율 평활 반창(±초)
    turnRateThresholdDegSec: 6, // 이 회전율(°/s) 이상이면 회전 구간
    turnGapTolSec: 2,           // 회전 중 잠깐의 낮은 회전율 허용(초)
    turnEdgeRateRatio: 0.35,    // 회전 양끝 ramp 포함 확장 임계(=임계×이 값)
    turnMaxEdgeExtendSec: 5,    // 한쪽 끝 최대 확장 시간(초)
    turnAngleThresholdDeg: 60,  // 누적 헤딩 변화 이 이상 = 회전(택/자이브)
    turnMinDurationSec: 3,      // 최소 회전 지속 시간(노이즈 스파이크 제거)
    turnStableWin: 4,           // 진입/이탈 속도 측정 창(초) — 짧게 둬야
                                //  회전 직전·직후의 "싣고 온 속도"를 대표
    maneuverMinSpeedKt: 5,      // 진입 속도 이 미만이면 표류·정지로 보고 제외
    maneuverApproachDeg: 30,    // 풍축을 넘지 못한 회전이라도 헤딩이 풍축에
                                //  이 각도 이내로 근접하면 '미완료 택/자이브
                                //  시도'로 본다 (실패 회전이 성공률 분모에서
                                //  빠지지 않도록 — Danny 검토)
    minRunDurationSec: 6,       // 최소 고속 구간(run) 지속 시간
    runThresholdRatio: 0.6,    // run 임계 = p90 속도 × 이 비율
    peakWindowsSec: [2, 10],   // 시간 기반 peak (2초·10초)
    distanceBests: [100, 250, 500, 1852], // 거리 기반 best (1852m = 1해리)
    alphaRunLength: 500,       // 알파 코스 총 주행 거리(m)
    alphaGateRadius: 50,       // 알파 출발·도착점 허용 반경(m)
    polarBinDeg: 7.5,          // 풍각 폴라 빈 크기
    histogramBinKt: 2,         // 속도 분포 히스토그램 빈 크기(노트)
    /* --- GPS 이상치 거부 (Danny 검토 §issue-6) ---
       기기 정지·저속 시 raw GPS 위치가 수십 m 씩 튀어, 위치 누적거리로
       속도를 내면 비현실적 최고 속도(예: 187kt)가 나온다. 아래 임계로
       물리적으로 불가능한 구간을 "속도 계산에서만" 제외한다 — 원본
       포인트(lat/lng) 는 전량 보존하며 삭제·다운샘플하지 않는다. */
    gpsMaxSpeedKt: 40,         // 이 SOG 초과 구간 = 불가능한 GPS 점프(포일링 물리 상한)
    gpsDeviceTolKt: 8          // 기기 보고 SOG 대비 위치누적속도 초과 허용폭(kt)
  };

  /* ---------- 공통 헬퍼 ---------- */
  function sliceHeadings(S, lo, hi) {
    var out = [];
    for (var i = lo; i <= hi; i++) if (S[i] && S[i].heading != null) out.push(S[i].heading);
    return out;
  }
  function avgSpeed(S, lo, hi) {
    var sum = 0, n = 0;
    for (var i = lo; i <= hi; i++) { if (S[i]) { sum += S[i].speed; n++; } }
    return n ? sum / n : 0;
  }

  /* 각도 정규화 — 0~360 / 0~180(축) */
  function norm360(d) { return ((d % 360) + 360) % 360; }
  function norm180(d) { return ((d % 180) + 180) % 180; }

  /* 택킹·자이빙 SPS 를 VMG 로 산출할 수 있는 최소 진입 VMG (m/s).
     이 미만이면(풍상/풍하 유효속도가 거의 없는 상태) 비율이 불안정하므로
     SOG 기반 산출로 폴백한다. */
  var MANEUVER_MIN_VMG_MS = 1.0;

  /* [lo,hi] 구간의 골(목표) 방향 평균 VMG (m/s) — 두 끝점의 GPS 위치
     변위를 목표 방향(택킹=풍상·자이빙=풍하)에 투영한 값을 경과 시간으로
     나눈 것. 순간 헤딩이 아니라 실제 이동 변위로 구하므로, 저속 구간의
     GPS 헤딩 노이즈에 휘둘리지 않는다. 유효 구간이 아니면 null. */
  function spanVmg(S, lo, hi, goalDir) {
    if (lo == null || hi == null || lo >= hi || !S[lo] || !S[hi]) return null;
    var dt = S[hi].t - S[lo].t;
    if (dt <= 0) return null;
    var d = Geo.haversine(S[lo], S[hi]);
    var brg = Geo.bearing(S[lo], S[hi]);
    return d * Math.cos(Geo.toRad(Geo.angleDiff(goalDir, brg))) / dt;
  }

  /* ---------- 회전율 봉우리 수 (스무스함 코칭 입력) ----------
   * 회전이 "한 박자의 매끄러운 단봉"으로 돌았는지, "두 동작으로 끊긴
   * 2단"인지, "과보정 다발"인지를 회전율 시계열의 봉우리 수로 판정한다.
   * 1 = 매끄러운 단봉, 2 = 2단(발·손 교차 시간차), 3+ = 과보정.
   * (설계: 회전코칭_AI_엔진_설계안_v1 §2.3 — 검증 스크립트로 보정.)
   */
  /* (ts, vs) 시계열에서 시각 gt 값을 선형보간 */
  function interpAtTime(ts, vs, gt) {
    if (!ts.length) return 0;
    if (gt <= ts[0]) return vs[0];
    if (gt >= ts[ts.length - 1]) return vs[vs.length - 1];
    for (var i = 1; i < ts.length; i++) {
      if (ts[i] >= gt) {
        var span = ts[i] - ts[i - 1];
        var f = span > 1e-9 ? (gt - ts[i - 1]) / span : 0;
        return vs[i - 1] + (vs[i] - vs[i - 1]) * f;
      }
    }
    return vs[vs.length - 1];
  }
  /* 돌출도(prominence) 기반 봉우리 수 — 높이 ≥ 0.40·최대,
     돌출도 ≥ 0.25·최대. GPS 노이즈성 잔물결을 걸러 진짜 봉우리만 센다.
     봉우리가 없으면(아주 평탄) 1 로 본다 — 회전은 항상 한 박자는 있다.

     References — Topographic prominence-based peak detection (SciPy convention):
       · Virtanen, P. et al. 2020. "SciPy 1.0: fundamental algorithms for scientific
         computing in Python". Nature Methods 17:261-272. doi:10.1038/s41592-019-0686-2
       · scipy.signal.find_peaks documentation — height + prominence twin threshold. */
  function countProminentPeaks(a) {
    var n = a.length, k;
    if (n < 3) return 1;
    var amax = 0;
    for (k = 0; k < n; k++) if (a[k] > amax) amax = a[k];
    if (amax <= 0) return 1;
    var minH = 0.40 * amax, minP = 0.25 * amax, count = 0;
    for (var i = 1; i < n - 1; i++) {
      if (!(a[i] > a[i - 1] && a[i] >= a[i + 1])) continue;
      if (a[i] < minH) continue;
      var l = i, lmin = a[i];
      while (l > 0 && a[l - 1] <= a[i]) { l--; if (a[l] < lmin) lmin = a[l]; }
      var r = i, rmin = a[i];
      while (r < n - 1 && a[r + 1] <= a[i]) { r++; if (a[r] < rmin) rmin = a[r]; }
      if (a[i] - Math.max(lmin, rmin) >= minP) count++;
    }
    return count < 1 ? 1 : count;
  }
  /* 회전 구간 [lo,hi] 의 회전율 봉우리 수.
     rate 는 이미 ±1.6s 평활된 heading 에서 얻은 값 → 경량 ±0.5s 평활을
     더하고 0.5s 격자로 리샘플한 |회전율| 에서 봉우리를 센다. */
  function countTurnRatePeaks(S, rate, lo, hi) {
    if (hi - lo < 2) return 1;
    var half = 0.5, ts = [], vs = [], i, j;
    for (i = lo; i <= hi; i++) {
      var sum = 0, cnt = 0, ti = S[i].t;
      for (j = i; j >= lo && ti - S[j].t <= half; j--) { sum += rate[j]; cnt++; }
      for (j = i + 1; j <= hi && S[j].t - ti <= half; j++) { sum += rate[j]; cnt++; }
      ts.push(ti); vs.push(cnt ? sum / cnt : 0);
    }
    var a = [], gt, t0 = ts[0], t1 = ts[ts.length - 1];
    for (gt = t0; gt <= t1 + 1e-9; gt += 0.5) {
      a.push(Math.abs(interpAtTime(ts, vs, gt)));
    }
    return countProminentPeaks(a);
  }

  /* 시간 기반 이동평균 (±halfSec) — 샘플 간격이 불규칙해도 정확.
     원본 GPS 포인트를 솎아내지 않고 그대로 두고 표시·검출용 평활만 한다. */
  function smoothByTime(S, leg, srcKey, dstKey, halfSec) {
    for (var i = leg.start; i <= leg.end; i++) {
      var sum = 0, n = 0, ti = S[i].t;
      for (var j = i; j >= leg.start && ti - S[j].t <= halfSec; j--) {
        if (S[j][srcKey] != null) { sum += S[j][srcKey]; n++; }
      }
      for (var j = i + 1; j <= leg.end && S[j].t - ti <= halfSec; j++) {
        if (S[j][srcKey] != null) { sum += S[j][srcKey]; n++; }
      }
      S[i][dstKey] = n ? sum / n : 0;
    }
  }
  function smoothHeadingByTime(S, leg, halfSec) {
    var tmp = [];
    for (var i = leg.start; i <= leg.end; i++) {
      var angs = [], ti = S[i].t;
      for (var j = i; j >= leg.start && ti - S[j].t <= halfSec; j--) {
        if (S[j].headingRaw != null) angs.push(S[j].headingRaw);
      }
      for (var j = i + 1; j <= leg.end && S[j].t - ti <= halfSec; j++) {
        if (S[j].headingRaw != null) angs.push(S[j].headingRaw);
      }
      tmp[i] = angs.length ? Geo.circularMean(angs) : S[i].headingRaw;
    }
    for (var i = leg.start; i <= leg.end; i++) S[i].heading = tmp[i];
  }

  /* ============================================================
   * 1) 세션 정규화 — parseGPX 결과 -> 원본 GPS 포인트 전량 트랙
   * 다운샘플링·리샘플 보간 없음. 입력 trkpt 를 100% 그대로 사용한다.
   * (불규칙 간격이어도 모든 분석이 dt 기반이라 정확.)
   * ============================================================ */
  function normalizeSession(parsed, opts) {
    var cfg = Object.assign({}, DEFAULTS, opts || {});

    var raw = [];
    parsed.tracks.forEach(function (tr) {
      tr.segments.forEach(function (seg) {
        seg.forEach(function (p) { raw.push(p); });
      });
    });
    if (raw.length < 2) throw new Error('분석할 트랙 포인트가 부족합니다.');

    var session = {
      cfg: cfg,
      hasTime: parsed.hasTime,
      speedSource: parsed.speedSource,
      trackName: parsed.trackName,
      legs: [],
      samples: []
    };

    /* --- 시각 정보가 없는 GPX: 지도·거리만 --- */
    if (!parsed.hasTime) {
      var cum = 0;
      for (var i = 0; i < raw.length; i++) {
        if (i > 0) cum += Geo.haversine(raw[i - 1], raw[i]);
        session.samples.push({
          t: i, lat: raw[i].lat, lng: raw[i].lng, ele: raw[i].ele,
          cumDist: cum, segDist: 0, speed: 0, heading: null,
          hr: (raw[i].hr != null ? raw[i].hr : null)
        });
      }
      session.legs.push({ start: 0, end: session.samples.length - 1 });
      finalize(session);
      return session;
    }

    /* --- 시각 정보 있음: 정렬·중복제거·leg 분리 후 1Hz 리샘플 --- */
    raw = raw.filter(function (p) { return p.time != null; })
             .sort(function (a, b) { return a.time - b.time; });
    var dedup = [];
    for (var i = 0; i < raw.length; i++) {
      if (i > 0 && raw[i].time === raw[i - 1].time) continue;
      dedup.push(raw[i]);
    }
    raw = dedup;
    if (raw.length < 2) throw new Error('타임스탬프가 있는 포인트가 부족합니다.');

    var legsRaw = [];
    var cur = [raw[0]];
    for (var i = 1; i < raw.length; i++) {
      var gap = (raw[i].time - raw[i - 1].time) / 1000;
      if (gap > cfg.gapThresholdSec) { legsRaw.push(cur); cur = []; }
      cur.push(raw[i]);
    }
    if (cur.length) legsRaw.push(cur);

    var t0 = raw[0].time;
    legsRaw.forEach(function (legPts) {
      if (!legPts.length) return;          // 단일 포인트 leg 도 보존 (전량 사용)
      var legStart = session.samples.length;
      legPts.forEach(function (p) {
        var smp = {
          t: (p.time - t0) / 1000, lat: p.lat, lng: p.lng, ele: p.ele,
          speedDevice: (p.speed != null ? p.speed : null),
          speed: 0, heading: null, cumDist: 0, segDist: 0,
          /* 심박수(bpm) — Waterspeed 등 GPX 의 trkpt extensions HR.
             없으면 null. 심박수 분석(추이·존·효율)에 전량 사용된다. */
          hr: (p.hr != null ? p.hr : null)
        };
        /* 자세(heel·pitch) 데이터 — 현재 GPX 에는 없고, 추후 Vakaros
           .vkx 파서가 채워 주면 바이올린 차트에 자동 반영된다. */
        if (p.heel != null) smp.heel = p.heel;
        if (p.pitch != null) smp.pitch = p.pitch;
        session.samples.push(smp);
      });
      session.legs.push({ start: legStart, end: session.samples.length - 1 });
    });
    if (!session.legs.length) throw new Error('분석할 트랙 구간이 없습니다.');

    session.startEpoch = t0;
    // 샘플 간격(median dt) — 참고용
    var dts = [];
    session.legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        dts.push(session.samples[i].t - session.samples[i - 1].t);
      }
    });
    dts.sort(function (a, b) { return a - b; });
    session.medianDtSec = dts.length ? dts[dts.length >> 1] : 1;
    computeKinematics(session);
    finalize(session);
    return session;
  }

  /* leg 별 누적거리·파생속도·헤딩 계산 + 평활
   *
   * GPS 이상치 거부 (Danny 검토 §issue-6) —
   *   raw GPS 위치는 기기 정지·저속 시 수십 m 씩 튄다. 10Hz 원본은
   *   그 노이즈가 그대로 드러나, 위치 누적거리(cumDist)로 속도를 내면
   *   비현실적 최고 속도가 나온다(실측 .vkx 에서 187kt·47kt).
   *   · 구간 위치속도가 물리 상한(gpsMaxSpeedKt) 을 넘거나, 기기 보고
   *     SOG 와 크게 어긋나면 그 구간을 "이상치" 로 보고 거리 계산에서
   *     제외한다 — 대체 거리는 기기 SOG(있으면) 또는 직전 채택 속도.
   *   · .vkx 는 기기가 실측 SOG(Velocity)를 보고하므로, 기기 세션은
   *     구간거리를 기기 SOG 적분으로 산출한다(10Hz 위치 노이즈 회피).
   *   · 이상치 '거부' 는 속도·거리 계산에서 제외하는 것이지 포인트를
   *     삭제·다운샘플하는 것이 아니다 — S[i].lat/lng 등 원본은 전량 보존. */
  function computeKinematics(session) {
    var cfg = session.cfg, S = session.samples;
    var useDevice = session.speedSource === 'device';
    var maxSegSpeed = cfg.gpsMaxSpeedKt / Geo.MS_TO_KNOTS;   // 물리적 상한 (m/s)
    var devTol = cfg.gpsDeviceTolKt / Geo.MS_TO_KNOTS;       // 기기 SOG 초과 허용폭
    var rejected = 0;

    session.legs.forEach(function (leg) {
      // 누적·구간 거리 + GPS 이상치 거부
      var prevAccepted = 0;                 // 직전 채택 구간 속도 (대체용)
      for (var i = leg.start; i <= leg.end; i++) {
        if (i === leg.start) {
          S[i].segDist = 0;
          S[i].cumDist = (i === 0) ? 0 : S[i - 1].cumDist;
          S[i].gpsOutlier = false;
          continue;
        }
        var dt = S[i].t - S[i - 1].t;
        var gpsDist = Geo.haversine(S[i - 1], S[i]);
        var vGps = dt > 0 ? gpsDist / dt : 0;
        // 기기 보고 SOG — 구간 평균 추정 (양 끝점 평균, 한쪽만 있으면 그 값)
        var dPrev = S[i - 1].speedDevice, dCur = S[i].speedDevice, devAvg = null;
        if (dPrev != null && dCur != null) devAvg = (dPrev + dCur) / 2;
        else if (dCur != null) devAvg = dCur;
        else if (dPrev != null) devAvg = dPrev;

        // --- 이상치 판정 — 물리적으로 불가능한 순간 점프 ---
        var outlier = false;
        if (!(dt > 0)) {
          outlier = true;                                    // 시간 진행 없음
        } else if (vGps > maxSegSpeed) {
          outlier = true;                                    // 포일링 물리 상한 초과
        } else if (devAvg != null &&
                   vGps > devAvg + devTol && vGps > devAvg * 1.5) {
          outlier = true;                  // 위치누적속도가 기기 SOG 와 크게 불일치
        }

        var segDist, vUsed;
        if (useDevice && devAvg != null) {
          // 기기 세션 — SOG 적분이 10Hz 위치 누적보다 정확
          segDist = Math.max(0, devAvg) * dt;
          vUsed = Math.max(0, devAvg);
        } else if (outlier) {
          // GPS 이상치 — 직전 채택 속도로 대체 (원본 포인트는 그대로 보존)
          segDist = Math.max(0, prevAccepted) * dt;
          vUsed = null;                                      // 채택 속도 갱신 안 함
        } else {
          segDist = gpsDist;
          vUsed = vGps;
        }
        if (outlier) rejected++;
        if (vUsed != null) prevAccepted = vUsed;
        S[i].segDist = segDist;
        S[i].cumDist = S[i - 1].cumDist + segDist;
        S[i].gpsOutlier = outlier;
      }
      // 파생 속도 = (보정된)구간거리 / dt + 속도원 선택
      for (var i = leg.start; i <= leg.end; i++) {
        var derived = null;
        if (i > leg.start) {
          var dt2 = S[i].t - S[i - 1].t;
          derived = dt2 > 0 ? S[i].segDist / dt2 : 0;
        }
        S[i].speedDerived = derived;
        var base = (useDevice && S[i].speedDevice != null)
          ? S[i].speedDevice
          : (derived != null ? derived : 0);
        S[i].speedRaw = base;
      }
      // 첫 샘플 보정
      if (leg.end > leg.start) S[leg.start].speedRaw = S[leg.start + 1].speedRaw;
      smoothByTime(S, leg, 'speedRaw', 'speed', cfg.speedSmoothSec);

      // 헤딩 (다음 점 방향) + 원형 평활
      for (var i = leg.start; i <= leg.end; i++) {
        if (i < leg.end) S[i].headingRaw = Geo.bearing(S[i], S[i + 1]);
        else S[i].headingRaw = (i > leg.start) ? S[i - 1].headingRaw : 0;
      }
      smoothHeadingByTime(S, leg, cfg.headingSmoothSec);
    });
    /* 거부된 GPS 이상치 구간 수 — 투명성·검증용 (포인트는 전량 보존) */
    session.gpsOutlierCount = rejected;
  }

  /* 심박수 보유 여부 플래그 — 샘플에 hr 이 하나라도 있으면 hasHR.
     normalizeSession·cropSession·applyEdits 가 만든 모든 세션 객체에
     일관되게 적용한다(편집·크롭 후에도 심박수 섹션이 정상 동작하도록). */
  function flagHr(session) {
    var S = session.samples, n = 0;
    for (var i = 0; i < S.length; i++) if (S[i].hr != null) n++;
    session.hasHR = n > 0;
    session.hrPointCount = n;
  }

  /* 지도 경계·총거리 등 마무리 */
  function finalize(session) {
    var S = session.samples;
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (var i = 0; i < S.length; i++) {
      if (S[i].lat < minLat) minLat = S[i].lat;
      if (S[i].lat > maxLat) maxLat = S[i].lat;
      if (S[i].lng < minLng) minLng = S[i].lng;
      if (S[i].lng > maxLng) maxLng = S[i].lng;
    }
    session.bounds = { minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng };
    session.totalDistanceM = S.length ? S[S.length - 1].cumDist : 0;
    session.pointCount = S.length;
    flagHr(session);
  }

  /* ============================================================
   * 2) 세션 요약
   * ============================================================ */
  function computeSummary(session) {
    var S = session.samples, cfg = session.cfg;
    var res = { totalDistanceM: session.totalDistanceM, pointCount: S.length };
    if (!session.hasTime || !S.length) { res.hasTime = false; return res; }
    res.hasTime = true;

    res.totalDurationSec = S[S.length - 1].t - S[0].t;
    var movingMs = cfg.movingSpeedKt / Geo.MS_TO_KNOTS;
    var activeMs = cfg.activeSpeedKt / Geo.MS_TO_KNOTS;
    var movingTime = 0, activeTime = 0, instMax = 0;

    session.legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        var dt = S[i].t - S[i - 1].t;
        var sp = S[i].speed;
        if (sp > instMax) instMax = sp;
        if (sp >= movingMs) movingTime += dt;
        if (sp >= activeMs) activeTime += dt;
      }
    });
    res.movingTimeSec = movingTime;
    res.activeTimeSec = activeTime;
    /* "최고 속도" = 2초 구간 최고 속도 (GPS 워터스포츠 표준).
       단일 GPS 포인트 순간속도(instMax)는 위치 노이즈로 과대해질 수 있어
       코치 지표로 부적합 → 2초 평균 peak 으로 정의. 이렇게 하면
       최고(2s) ≥ 10s ≥ 100m ≥ 250m ≥ 500m ≥ 1NM 단조 일관이 보장된다. */
    var pk2 = peakForWindow(session, 2);
    res.maxSpeedMs = pk2.speedMs > 0 ? pk2.speedMs : instMax;
    res.maxSpeedIdx = pk2.startIdx;
    res.instantMaxSpeedMs = instMax;   // 참고용 — 노이즈 포함 순간 최고
    res.avgSpeedMovingMs = movingTime > 0 ? session.totalDistanceM / movingTime : 0;
    res.avgSpeedOverallMs = res.totalDurationSec > 0
      ? session.totalDistanceM / res.totalDurationSec : 0;
    res.activeRatio = res.totalDurationSec > 0 ? activeTime / res.totalDurationSec : 0;
    return res;
  }

  /* ============================================================
   * 3) 속도 분포 히스토그램 (체류 시간 기준)
   * ============================================================ */
  function computeHistogram(session, binKt) {
    if (!session.hasTime) return null;
    binKt = binKt || session.cfg.histogramBinKt;
    var S = session.samples;
    var binMs = binKt / Geo.MS_TO_KNOTS;
    var bins = [];
    session.legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        var dt = S[i].t - S[i - 1].t;
        var b = Math.floor(S[i].speed / binMs);
        if (b < 0) b = 0;
        bins[b] = (bins[b] || 0) + dt;
      }
    });
    var out = [];
    for (var b = 0; b < bins.length; b++) {
      out.push({ fromKt: b * binKt, toKt: (b + 1) * binKt, seconds: bins[b] || 0 });
    }
    return out;
  }

  /* ============================================================
   * 4) 워터스포츠 표준 지표 — 시간 peak / 거리 best / 알파
   * ============================================================ */
  /* win 초 구간 최고 속도(거리/시간) — 모든 시간 peak 의 공통 계산.
     단일 GPS 포인트 순간속도는 노이즈가 커, 짧은 구간이라도 거리÷시간으로
     평균낸 값을 쓴다. win 이 작을수록 값이 크다(단조). */
  function peakForWindow(session, win) {
    var S = session.samples;
    var best = 0, bestIdx = -1;
    session.legs.forEach(function (leg) {
      for (var i = leg.start; i <= leg.end; i++) {
        var targetT = S[i].t + win;
        var j = i;
        while (j < leg.end && S[j].t < targetT) j++;
        var dt = S[j].t - S[i].t;
        if (dt <= 0) continue;
        var spd = (S[j].cumDist - S[i].cumDist) / dt;
        if (spd > best) { best = spd; bestIdx = i; }
      }
    });
    return { speedMs: best, startIdx: bestIdx };
  }

  function computePeakSpeeds(session) {
    if (!session.hasTime) return [];
    return session.cfg.peakWindowsSec.map(function (win) {
      var r = peakForWindow(session, win);
      return { windowSec: win, speedMs: r.speedMs, startIdx: r.startIdx };
    });
  }

  function computeDistanceBests(session) {
    if (!session.hasTime) return [];
    var S = session.samples, cfg = session.cfg;
    return cfg.distanceBests.map(function (D) {
      var best = 0, bestI = -1, bestJ = -1;
      session.legs.forEach(function (leg) {
        var j = leg.start;
        for (var i = leg.start; i <= leg.end; i++) {
          if (j < i) j = i;
          while (j <= leg.end && (S[j].cumDist - S[i].cumDist) < D) j++;
          if (j > leg.end) break;
          var dt = S[j].t - S[i].t;
          if (dt > 0) {
            var spd = (S[j].cumDist - S[i].cumDist) / dt;
            if (spd > best) { best = spd; bestI = i; bestJ = j; }
          }
        }
      });
      return { distanceM: D, speedMs: best, startIdx: bestI, endIdx: bestJ };
    });
  }

  /* 알파: 총 주행거리 alphaRunLength m 구간 중 출발·도착점이
     gateRadius m 이내인(= 자이브로 되돌아온) 가장 빠른 코스 평균속도 */
  function computeAlpha(session) {
    if (!session.hasTime) return null;
    var S = session.samples, cfg = session.cfg;
    var D = cfg.alphaRunLength, gate = cfg.alphaGateRadius;
    var best = 0, bestI = -1, bestJ = -1;
    session.legs.forEach(function (leg) {
      var j = leg.start;
      for (var i = leg.start; i <= leg.end; i++) {
        if (j < i) j = i;
        while (j <= leg.end && (S[j].cumDist - S[i].cumDist) < D) j++;
        if (j > leg.end) break;
        if (Geo.haversine(S[i], S[j]) <= gate) {
          var dt = S[j].t - S[i].t;
          if (dt > 0) {
            var spd = (S[j].cumDist - S[i].cumDist) / dt;
            if (spd > best) { best = spd; bestI = i; bestJ = j; }
          }
        }
      }
    });
    return { distanceM: D, gateM: gate, speedMs: best, startIdx: bestI, endIdx: bestJ };
  }

  /* ============================================================
   * 5) 고속 구간(run) 자동 추출
   * ============================================================ */
  function detectRuns(session) {
    if (!session.hasTime) return { thresholdMs: 0, runs: [] };
    var S = session.samples, cfg = session.cfg;
    var speeds = [];
    session.legs.forEach(function (leg) {
      for (var i = leg.start; i <= leg.end; i++) speeds.push(S[i].speed);
    });
    speeds.sort(function (a, b) { return a - b; });
    var p90 = Geo.percentile(speeds, 90);
    var thrMs = Math.max(p90 * cfg.runThresholdRatio,
                         (cfg.movingSpeedKt * 2) / Geo.MS_TO_KNOTS);

    var runs = [];
    session.legs.forEach(function (leg) {
      var i = leg.start;
      while (i <= leg.end) {
        if (S[i].speed >= thrMs) {
          var start = i, j = i, dipSec = 0;
          while (j + 1 <= leg.end) {
            if (S[j + 1].speed >= thrMs) { j++; dipSec = 0; }
            else if (dipSec < 2.5) {            // 짧은 속도 딥(≤2.5초) 허용
              dipSec += (S[j + 1].t - S[j].t); j++;
            } else break;
          }
          while (j > start && S[j].speed < thrMs) j--;
          var dur = S[j].t - S[start].t;
          if (dur >= cfg.minRunDurationSec) {
            var dist = S[j].cumDist - S[start].cumDist;
            var maxS = 0, hrSum = 0, hrN = 0;
            for (var k = start; k <= j; k++) {
              if (S[k].speed > maxS) maxS = S[k].speed;
              /* 구간 평균 심박수(bpm) — HR 이 기록된 샘플만 집계.
                 HR 없는 세션(.vkx 등)은 hrN=0 → avgHr:null 로 둔다. */
              if (S[k].hr != null) { hrSum += S[k].hr; hrN++; }
            }
            runs.push({
              startIdx: start, endIdx: j,
              durationSec: dur, distanceM: dist,
              avgSpeedMs: dur > 0 ? dist / dur : 0,
              maxSpeedMs: maxS,
              avgHr: hrN ? hrSum / hrN : null,
              heading: Geo.circularMean(sliceHeadings(S, start, j))
            });
          }
          i = j + 1;
        } else i++;
      }
    });
    runs.sort(function (a, b) { return b.avgSpeedMs - a.avgSpeedMs; });
    return { thresholdMs: thrMs, runs: runs };
  }

  /* ============================================================
   * 6) 택·자이브 검출 + 효율 (코치 분석의 핵심)
   *
   * 헤딩 변화율(turn rate, °/s)이 임계 이상인 연속 구간을 회전으로
   * 보고, 그 구간의 누적 헤딩 변화가 임계 이상이면 회전(택/자이브)로
   * 판정한다. 회전 구간 자체를 찾으므로 진입·이탈·정점을 정확히
   * 분리할 수 있다.
   *
   * References — Maneuver detection 표준:
   *   · Larsson, L., Eliasson, R., Orych, M. 2022. "Principles of Yacht Design" 5e.
   *     Bloomsbury. ISBN 978-1-3994-0301-6 (ch.7 — tack/jibe geometry).
   *   · Vakaros — "VMG and Tack Loss training" blog.vakaros.com/vmgtackloss
   *   · Njord Analytics Maneuver Analysis — app.sailnjord.com/help/analytics/maneuvers.html
   *   · SAP Sailing Analytics (Apache 2.0, 2025-10-20) — github.com/SAP/sailing-analytics
   *     (WindDetectionTrack 모듈 OSS reference).
   * 도메인 특화 — windfoil 회전이 keelboat 보다 짧아 turnRateSmoothSec=2.5s
   *   (Njord 의 20s window 대비). 정당화: 작은 보드/foil 의 관성이 작음.
   * ============================================================ */
  function detectManeuvers(session, windDir) {
    if (!session.hasTime) return [];
    var S = session.samples, cfg = session.cfg;
    var maneuvers = [];

    session.legs.forEach(function (leg) {
      if (leg.end - leg.start < 6) return;

      // 부호 있는 헤딩 변화율 (deg/s) — dt 로 나눠 샘플 간격에 무관
      var rate = [];
      for (var i = leg.start; i <= leg.end; i++) {
        if (i > leg.start && S[i].heading != null && S[i - 1].heading != null) {
          var dtr = S[i].t - S[i - 1].t;
          rate[i] = dtr > 0 ? Geo.angleDiff(S[i - 1].heading, S[i].heading) / dtr : 0;
        } else rate[i] = 0;
      }
      // 시간 기반 평활 (±turnRateSmoothSec)
      var rs = [];
      for (var i = leg.start; i <= leg.end; i++) {
        var sum = 0, cnt = 0, ti = S[i].t;
        for (var j = i; j >= leg.start && ti - S[j].t <= cfg.turnRateSmoothSec; j--) {
          sum += rate[j]; cnt++;
        }
        for (var j = i + 1; j <= leg.end && S[j].t - ti <= cfg.turnRateSmoothSec; j++) {
          sum += rate[j]; cnt++;
        }
        rs[i] = cnt ? sum / cnt : 0;
      }

      // 1차: |회전율| 이 임계 이상인 연속 구간(region)을 모두 수집
      var thr = cfg.turnRateThresholdDegSec;
      var extThr = thr * cfg.turnEdgeRateRatio;
      var regions = [];
      var i = leg.start;
      while (i <= leg.end) {
        if (Math.abs(rs[i]) >= thr) {
          var a = i, b = i, dipSec = 0;
          while (b + 1 <= leg.end) {
            if (Math.abs(rs[b + 1]) >= thr) { b++; dipSec = 0; }
            else if (dipSec < cfg.turnGapTolSec) {        // 짧은 저회전 허용
              dipSec += (S[b + 1].t - S[b].t); b++;
            } else break;
          }
          while (b > a && Math.abs(rs[b]) < thr) b--;
          // 회전 양끝 ramp 구간까지 확장 (낮은 임계 · 최대 turnMaxEdgeExtendSec 초)
          var aEdgeT = S[a].t;
          while (a - 1 >= leg.start && Math.abs(rs[a - 1]) >= extThr &&
                 aEdgeT - S[a - 1].t <= cfg.turnMaxEdgeExtendSec) a--;
          var bEdgeT = S[b].t;
          while (b + 1 <= leg.end && Math.abs(rs[b + 1]) >= extThr &&
                 S[b + 1].t - bEdgeT <= cfg.turnMaxEdgeExtendSec) b++;
          regions.push({ a: a, b: b });
          i = b + 1;
        } else i++;
      }
      // 2차: region 별 maneuver 빌드 — 진입/이탈 속도 측정 창을
      //      이웃 region 으로 clamp 해, 직전 회전의 회복 구간이
      //      섞여 "진입 속도"가 왜곡되는 것을 막는다.
      regions.forEach(function (rg, k) {
        var prevEnd = k > 0 ? regions[k - 1].b : leg.start;
        var nextStart = k < regions.length - 1 ? regions[k + 1].a : leg.end;
        var m = buildManeuver(S, leg, rg.a, rg.b, cfg, windDir, prevEnd, nextStart);
        // 풍향이 확정됐는데 풍축을 넘지 않은 회전(진입 택 = 출구 택,
        // 즉 S→S·P→P)은 진짜 택킹·자이빙이 아니므로 maneuver 집합에서
        // 제외한다 — classifyTackGybe 가 tack/gybe 어느 쪽도 아닌 'turn'.
        // 풍향 미설정 시에는 분류 자체가 불가하므로 그대로 둔다.
        if (m && windDir != null && m.type === 'turn') return;
        if (m) {
          var mr = 0;                       // 최대 회전율(°/s, raw)
          for (var rk = rg.a; rk <= rg.b; rk++) {
            if (Math.abs(rate[rk]) > mr) mr = Math.abs(rate[rk]);
          }
          m.maxTurnRateDegSec = mr;
          /* 회전율 봉우리 수 — 스무스함(한 박자 vs 2단) 코칭 입력 */
          m.turnPeaks = countTurnRatePeaks(S, rate, rg.a, rg.b);
          maneuvers.push(m);
        }
      });
    });
    maneuvers.sort(function (x, y) { return x.tSec - y.tSec; });
    return maneuvers;
  }

  function buildManeuver(S, leg, a, b, cfg, windDir, prevEnd, nextStart) {
    // 누적 헤딩 변화(부호) — 회전 방향·총 회전각
    var signed = 0;
    for (var k = a + 1; k <= b; k++) {
      if (S[k].heading != null && S[k - 1].heading != null) {
        signed += Geo.angleDiff(S[k - 1].heading, S[k].heading);
      }
    }
    var totalTurn = Math.abs(signed);
    var durationSec = S[b].t - S[a].t;
    if (totalTurn < cfg.turnAngleThresholdDeg) return null; // 너무 작은 회전 무시
    if (durationSec < cfg.turnMinDurationSec) return null;  // 노이즈 스파이크 무시

    // 정점 = 회전 구간 내 최저 속도 지점
    var minSpeed = Infinity, apexIdx = a;
    for (var k = a; k <= b; k++) {
      if (S[k].speed < minSpeed) { minSpeed = S[k].speed; apexIdx = k; }
    }
    if (!isFinite(minSpeed)) minSpeed = 0;

    // 진입/이탈 속도·헤딩 = 회전 직전 / 직후 구간 (turnStableWin 초).
    // 측정 창은 이웃 회전(region)을 넘지 않도록 clamp — 직전 회전의
    // 회복(가속) 구간이 섞여 진입 속도가 과소 측정되는 것을 방지.
    var floorIdx = (prevEnd != null && prevEnd > leg.start) ? prevEnd : leg.start;
    var ceilIdx = (nextStart != null && nextStart < leg.end) ? nextStart : leg.end;
    var preHi = Math.max(floorIdx, a - 1), preLo = preHi;
    while (preLo > floorIdx && S[preHi].t - S[preLo - 1].t <= cfg.turnStableWin) preLo--;
    var postLo = Math.min(ceilIdx, b + 1), postHi = postLo;
    while (postHi < ceilIdx && S[postHi + 1].t - S[postLo].t <= cfg.turnStableWin) postHi++;
    var entry = avgSpeed(S, preLo, preHi);
    var exit = avgSpeed(S, postLo, postHi);
    var hBefore = Geo.circularMean(sliceHeadings(S, preLo, preHi));
    var hAfter = Geo.circularMean(sliceHeadings(S, postLo, postHi));

    // 진입 속도가 너무 낮으면(표류·정지 중 헤딩만 흔들린 것) 회전이 아님
    if (entry < cfg.maneuverMinSpeedKt / Geo.MS_TO_KNOTS) return null;

    // 속도 손실 = (기준속도 - 최저속) / 기준속도.
    // 기준속도 = max(진입, 이탈) — 회전 전후 "원래 싣고 있던 속도".
    // 가속하며 빠져나온 회전(이탈>진입)도 일관되게 처리되고,
    // 최저속이 기준속도를 넘는 비일관(손실 음수)이 생기지 않는다.
    var refSpeed = Math.max(entry, exit);
    var lossPct = refSpeed > 0
      ? Geo.clamp((refSpeed - minSpeed) / refSpeed * 100, 0, 100) : 0;

    // 재가속 시간: 최저속 -> 기준속도 95% 회복 (최대 45초 탐색)
    var recoverySec = null;
    for (var k = apexIdx; k <= leg.end && S[k].t - S[apexIdx].t <= 45; k++) {
      if (S[k].speed >= 0.95 * refSpeed) { recoverySec = S[k].t - S[apexIdx].t; break; }
    }

    var turnDir = signed >= 0 ? 'starboard' : 'port'; // 시계방향 = 우현쪽
    var omega = totalTurn * Math.PI / 180 / Math.max(1, durationSec); // rad/s
    var radiusM = omega > 0 ? minSpeed / omega : null;

    var type = 'turn', completed = false;
    if (windDir != null) {
      var cls = classifyManeuver(S, a, b, windDir, cfg);
      type = cls.type; completed = cls.completed;
    }

    /* --- VMG 로스/게인 + 진입→풍축 시간 (Danny 검토 §issue-1·2) ---
       · 택킹·자이빙 SPS 는 회전 전후 골(풍상/풍하) VMG 의 로스·게인,
         즉 "진입 직전 VMG 대비 탈출 후 재정비된 VMG" 로 산출한다.
       · 레벨별 "느린 택킹" 판정은 회전 전체(durationSec)가 아니라
         진입부터 풍축(정풍상) 통과까지의 구간 시간만 본다 — 풍축 이후
         탈출·재정비는 별도 회복 지표(recoverySec)가 담당. */
    var entryVmgMs = null, exitVmgMs = null;
    var vmgLossPct = null, vmgGainPct = null;
    var entryToHeadWindSec = null, headWindIdx = null;
    if (windDir != null && (type === 'tack' || type === 'gybe')) {
      var upwindDir = ((windDir % 360) + 360) % 360;
      // 골 방향 — 택킹은 풍상으로의 진척, 자이빙은 풍하로의 진척
      var goalDir = (type === 'tack') ? upwindDir : (upwindDir + 180) % 360;
      entryVmgMs = spanVmg(S, preLo, preHi, goalDir);   // 진입 직전 VMG
      exitVmgMs = spanVmg(S, postLo, postHi, goalDir);  // 탈출 후 재정비 VMG
      /* 게인(회복률) = 탈출 VMG ÷ 진입 VMG (1=완전 보존/초과), 로스
         (상실폭) = 1 − 게인. 회전 도중의 순간 VMG 는 풍축을 스칠 때
         오히려 높아질 수 있어(정풍상은 cos≈1) "구간 내 VMG 딥"은 회전
         비용의 척도가 못 된다 — 회전 비용은 속도를 잃어 탈출 VMG 가
         낮아지는 것으로 드러나므로 진입↔탈출 전후 비교로 포착한다.
         진입 VMG 가 미미하면 비율이 불안정 → null (SOG 폴백). */
      if (entryVmgMs != null && entryVmgMs >= MANEUVER_MIN_VMG_MS &&
          exitVmgMs != null) {
        var gain = Geo.clamp(exitVmgMs / entryVmgMs, 0, 1);
        vmgGainPct = gain * 100;
        vmgLossPct = (1 - gain) * 100;
      }
      /* 진입→풍축 시간 — 택킹만. 헤딩이 풍축(정풍상)을 통과하는 시점
         까지의 구간 시간. 통과 시점은 두 표본 사이를 각도차로 선형 보간.
         회전 전체 시간과 구분되는 별도 지표 — 레벨 기준 비교 전용. */
      if (type === 'tack') {
        for (var hk = a + 1; hk <= b; hk++) {
          if (S[hk - 1].heading == null || S[hk].heading == null) continue;
          if (crossesDirection(S[hk - 1].heading, S[hk].heading, upwindDir)) {
            var d1 = Math.abs(Geo.angleDiff(upwindDir, S[hk - 1].heading));
            var d2 = Math.abs(Geo.angleDiff(upwindDir, S[hk].heading));
            var frac = (d1 + d2) > 0 ? d1 / (d1 + d2) : 0;
            entryToHeadWindSec =
              (S[hk - 1].t + frac * (S[hk].t - S[hk - 1].t)) - S[a].t;
            headWindIdx = hk;
            break;
          }
        }
      }
    }

    return {
      startIdx: a, endIdx: b, apexIdx: apexIdx, tSec: S[apexIdx].t,
      headingBefore: hBefore, headingAfter: hAfter,
      turnAngle: totalTurn, durationSec: durationSec,
      /* 회전 구간 평균 회전율(°/s) — 총 회전각 ÷ 소요 시간. 순간 피크가
         아닌 대표값으로, '회전을 어떻게 돌았는지'를 한 수치로 나타낸다. */
      avgTurnRateDegSec: durationSec > 0 ? totalTurn / durationSec : 0,
      entrySpeedMs: entry, exitSpeedMs: exit, minSpeedMs: minSpeed,
      refSpeedMs: refSpeed, lossPct: lossPct, recoverySec: recoverySec,
      turnDir: turnDir, radiusM: radiusM, type: type, completed: completed,
      entryVmgMs: entryVmgMs, exitVmgMs: exitVmgMs,
      vmgLossPct: vmgLossPct, vmgGainPct: vmgGainPct,
      entryToHeadWindSec: entryToHeadWindSec, headWindIdx: headWindIdx
    };
  }

  /* 회전 진입 택 — 풍향 기준 좌현(P)/우현(S). 풍향 없으면 null.
     §420 (옥대표님 verbatim 2026-06-12, Vantage Sailing 비교 fix):
     표준 sailing convention 정정 — Port tack = 풍이 좌현(port side)에서 들어옴
     = heading 이 풍축 기준 시계방향 (angleDiff > 0). 이전 코드는 정반대로
     라벨링 → Vantage + 옥대표님 직관 (Port upwind VMG 빠름) 충돌.
     References: Larsson & Eliasson 2022 ch.7 (ISBN 978-1-3994-0301-6),
     ISAF Racing Rules of Sailing Definition (Port tack: wind from port side).
     app.js sideShort() · app.js:2831 도 같은 swap. DO_NOT_REVERT §420. */
  function maneuverSide(m, windDir) {
    if (windDir == null || !m || m.headingBefore == null) return null;
    return Geo.angleDiff(windDir, m.headingBefore) >= 0 ? 'P' : 'S';
  }

  /* 두 연속 헤딩 사이를 dir 방향이 통과하는가 */
  function crossesDirection(h1, h2, dir) {
    var d1 = Geo.angleDiff(dir, h1);
    var d2 = Geo.angleDiff(dir, h2);
    if (d1 === 0 || d2 === 0) return true;
    if ((d1 < 0) !== (d2 < 0)) return (Math.abs(d1) + Math.abs(d2)) < 180;
    return false;
  }
  /* 회전 분류 + 완료 여부 (Danny 검토 — 성공률 정직성).
     반환: { type: 'tack'|'gybe'|'turn', completed: bool }
       · 헤딩이 풍상축을 지나면 택, 풍하축을 지나면 자이브 → 완료(completed).
       · 어느 축도 넘지 못했지만 헤딩이 한 축에 maneuverApproachDeg 이내로
         근접했다면, 중도 포기·터치다운한 '미완료 시도'(택/자이브)로 본다 —
         이렇게 해야 실패 회전이 성공률 분모에서 통째로 빠지지 않는다.
       · 양 축을 모두 지난 회전(스핀아웃)은 미완료 택 시도로 본다.
       · 어느 축에도 근접하지 못한 회전(베어어웨이·헤드업 등 코스 변경)은
         'turn' — 진짜 택·자이브 시도가 아니므로 성공률 집계에서 제외.

     References — Methodological honesty (incomplete attempt 처리):
       · Larsson & Eliasson 2022 ch.7 — tack 정의 (cross head-to-wind), jibe 정의
         (cross down-wind). 본 분류는 표준 정의 + incomplete attempt 보존.
       · 대부분 sailing analytics SW (Vakaros·Njord·Vantage·Waterspeed) 가 실패
         회전을 분모에서 빼버려 성공률을 인위적으로 부풀린다. 본 함수의 incomplete
         보존은 학술 정직성 표준 (Saw, Main, Gastin 2016. Br J Sports Med.
         doi:10.1136/bjsports-2015-094758 의 "subjective measures over inflated
         objective metrics" 원칙) 과 일치. */
  function classifyManeuver(S, lo, hi, windDir, cfg) {
    var upwind = ((windDir % 360) + 360) % 360;
    var downwind = (upwind + 180) % 360;
    var crossUp = false, crossDown = false;
    var minTwaUp = 180, minTwaDown = 180;       // 풍상·풍하축 최근접 각도
    for (var k = lo; k <= hi; k++) {
      if (S[k].heading == null) continue;
      var tu = Math.abs(Geo.angleDiff(upwind, S[k].heading));
      var td = Math.abs(Geo.angleDiff(downwind, S[k].heading));
      if (tu < minTwaUp) minTwaUp = tu;
      if (td < minTwaDown) minTwaDown = td;
      if (k > lo && S[k - 1].heading != null) {
        if (crossesDirection(S[k - 1].heading, S[k].heading, upwind)) crossUp = true;
        if (crossesDirection(S[k - 1].heading, S[k].heading, downwind)) crossDown = true;
      }
    }
    if (crossUp && !crossDown) return { type: 'tack', completed: true };
    if (crossDown && !crossUp) return { type: 'gybe', completed: true };
    if (crossUp && crossDown) return { type: 'tack', completed: false }; // 스핀아웃
    var app = (cfg && cfg.maneuverApproachDeg) || 30;
    if (minTwaUp <= app) return { type: 'tack', completed: false };   // 미완료 택
    if (minTwaDown <= app) return { type: 'gybe', completed: false }; // 미완료 자이브
    return { type: 'turn', completed: false };  // 풍축 미근접 — 코스 변경
  }

  /* ============================================================
   * 시간가중 구간(tier) 평균 — 한 지표값 표본 배열의 전체 평균과
   * 상·하위 50%·20% 구간 평균. items 는 { [key], dt } 를 가진 표본.
   * 상·하위 N% 는 같은 정렬 배열을 양 끝에서 시간가중으로 누적한
   * 평균이라, 단일 표본의 순간 극값(노이즈)에 강하다 — 퍼포먼스
   * 통계 패널의 '상위 50%/20%' 가 raw 극값 대신 이 값을 쓴다
   * (Njord 벤치마크 갭분석 §3·§8). SOG·VMG·풍각(computeWindMetrics)과
   * 심박(analyzeHr)이 같은 한 함수를 공유한다(중복 구현 금지).
   *
   * References — Time-weighted percentile statistics:
   *   · Sands, W.A. et al. 2017. "Modern Techniques and Technologies Applied to
   *     Training and Performance Monitoring". Int J Sports Physiol Perform 12(s2):
   *     S2-63-S2-72. doi:10.1123/ijspp.2016-0405
   *   · Vakaros / Vantage "top 20% speed" convention (sailing telemetry 표준). */
  function computeTierMeans(items, key) {
    if (!items.length) {
      return { avg: 0, top50: 0, top20: 0, bot50: 0, bot20: 0 };
    }
    var totDt = 0, allSum = 0;
    items.forEach(function (o) { totDt += o.dt; allSum += o[key] * o.dt; });
    var sorted = items.slice().sort(function (a, b) { return b[key] - a[key]; });
    /* dir +1 = 배열 앞(높은 값)부터, -1 = 뒤(낮은 값)부터 시간가중 누적 */
    function tierMean(frac, dir) {
      var lim = totDt * frac, acc = 0, sum = 0, w = 0;
      for (var n = 0; n < sorted.length && acc < lim; n++) {
        var k = (dir > 0) ? n : (sorted.length - 1 - n);
        sum += sorted[k][key] * sorted[k].dt; w += sorted[k].dt; acc += sorted[k].dt;
      }
      return w ? sum / w : 0;
    }
    return {
      avg: totDt ? allSum / totDt : 0,
      top50: tierMean(0.5, 1), top20: tierMean(0.2, 1),
      bot50: tierMean(0.5, -1), bot20: tierMean(0.2, -1)
    };
  }

  /* ============================================================
   * 7) VMG·SOG (풍상/풍하 실효속도·속도) — 풍향 입력 시
   * 풍상/풍하 각각을 다시 포트(P)·스타보드(S) 택으로 분리하고,
   * 택별로 전체 평균 / 상·하위 50%·20% 구간 평균 (시간 가중) 산출.
   * 순간 극값(단일 GPS 포인트)은 노이즈라 제외 — 구간 평균을
   * 퍼포먼스 통계 패널의 '상위 50%/20%' 입력으로 쓴다.
   * 택 분류는 computePolar·maneuverSide 와 동일 (§421: angleDiff>=0 → P).
   *
   * References — VMG·polar 표준 정의:
   *   · Larsson, L., Eliasson, R., Orych, M. 2022. "Principles of Yacht Design" 5e.
   *     Bloomsbury. ISBN 978-1-3994-0301-6 (ch.7 — VMG = SOG × cos(TWA)).
   *   · ORC IMS VPP Documentation — orc.org/index.asp?id=37 (race-context 표준).
   *   · Vakaros — "VMG and Tack Loss training" blog.vakaros.com/vmgtackloss
   *     (sailing telemetry 의 4-bucket 분리 패턴).
   * 4-bucket 분리 (풍상/풍하 × P/S) — Njord Analytics 의 polar split 와 일관.
   * ============================================================ */
  function computeWindMetrics(session, windDir) {
    if (!session.hasTime || windDir == null) return null;
    var S = session.samples;
    var wd = ((windDir % 360) + 360) % 360;
    // 4 버킷: 풍상/풍하 × 포트(P)/스타보드(S). 각 원소 {vmg, sog, dt}
    var bk = { upP: [], upS: [], downP: [], downS: [] };

    session.legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        var sp = S[i].speed;
        if (sp < 1.0 || S[i].heading == null) continue;
        var dt = S[i].t - S[i - 1].t;
        if (dt <= 0) continue;
        var signed = Geo.angleDiff(wd, S[i].heading); // -180..180
        var twa = Math.abs(signed);                   // 0=정풍상, 180=정풍하
        var vmgSigned = sp * Math.cos(Geo.toRad(twa)); // +풍상 / -풍하
        S[i].twa = twa; S[i].vmg = vmgSigned;
        /* §421 (옥대표님 verbatim 2026-06-12, "Deep" — Vantage 비교 fix):
           표준 sailing convention 으로 정정 — angleDiff(windDir,heading)>=0
           = heading 이 풍축 기준 시계방향 = 바람이 좌현(port)에서 = Port(P).
           §420 이 라벨 함수(maneuverSide·app.js sideShort/sideLabel)만 이
           규약으로 바꾸고 이 데이터 버킷은 옛 규약(>=0→S)에 남겨, 라벨↔
           데이터가 어긋나 'Port 느림' 오표시가 났다 → 여기서 버킷도 정정.
           maneuverSide(analysis.js:839)·computePolar 와 같은 부호 규약.
           검증: selftest-421-vmg-parity.js. DO_NOT_REVERT §421. */
        var side = signed >= 0 ? 'P' : 'S';
        /* 바이올린 분포·TWA 그룹화를 위해 twa 도 같은 표본에 담는다 —
           SOG·VMG·TWA 를 한 지표 그룹으로 다룬다(코치 분석 일관).
           heel·pitch 는 표본에 있을 때만 담아, 추후 Vakaros .vkx
           자세 데이터가 들어오면 바이올린에 자동으로 그려지게 한다. */
        var rec = { sog: sp, twa: twa, dt: dt };
        /* 힐(Heel)은 택에 따라 부호가 갈린다 — 한 택은 +, 반대 택은 −.
           택을 합쳐 평균하면 좌·우가 상쇄돼 무의미하지만, 포트/스타보드
           버킷으로 쪼개면 한 버킷 안에서는 부호가 일관되므로 부호 있는
           실제 힐 값을 그대로 통계낼 수 있다 — rec.heel(signed)을 그대로
           쓴다(통계 패널이 풍상/풍하 × 포트/스타보드로 분할 표시). */
        if (S[i].heel != null) rec.heel = S[i].heel;
        if (S[i].pitch != null) rec.pitch = S[i].pitch;
        /* 심박(HR)도 같은 표본에 담는다 — 좌우 택과 무관하지만 풍상/풍하
           에서는 의미가 있어(속도와 나란히 신체 부하 비교) 풍상/풍하
           버킷의 시간가중 통계를 통계 패널이 쓴다. */
        if (S[i].hr != null) rec.hr = S[i].hr;
        if (twa < 90) { rec.vmg = vmgSigned; bk['up' + side].push(rec); }
        else { rec.vmg = -vmgSigned; bk['down' + side].push(rec); }
      }
    });
    /* key('vmg'|'sog'|'twa'|'heel'|'pitch') 기준 시간가중 구간 평균
       — 전체 평균 + 상·하위 50%·20%. 공용 computeTierMeans 사용. */
    function statsBy(arr, key) { return computeTierMeans(arr, key); }
    function timeOf(arr) { var t = 0; arr.forEach(function (o) { t += o.dt; }); return t; }
    /* SOG·VMG·TWA 세 지표를 한 그룹으로 — 시간가중 평균·상위 50%·20%.
       samples 는 바이올린 분포(밀도)용 원본 표본 배열 {vmg,sog,twa,dt}. */
    function group(arr) {
      var g = { vmg: statsBy(arr, 'vmg'), sog: statsBy(arr, 'sog'),
                twa: statsBy(arr, 'twa'),
                timeSec: timeOf(arr), count: arr.length, samples: arr };
      /* heel·pitch 는 표본에 실제 데이터가 있을 때만 통계를 산출한다
         (추후 .vkx 대비 — GPX 만 있을 땐 키 자체가 생기지 않는다).
         힐은 부호 있는 값으로 집계한다 — 이 group()은 포트(P)·스타보드(S)
         버킷별로도 호출되며, 한 택 안에서는 힐 부호가 일관돼 부호 있는
         평균이 그대로 의미를 갖는다. 택 합산(all) 그룹의 힐은 좌우가
         상쇄되므로 패널은 all.heel 을 쓰지 않고 P·S 버킷만 표시한다.
         §430: 센서 커버리지가 부분적일 수 있으므로(예: RaceBox CSV 가
         GPX 보다 늦게 시작 → 앞부분 표본에 heel 없음) 첫 표본만 보고
         버킷 전체를 판단하지 않고, heel 이 담긴 표본만 추려 집계한다 —
         그렇지 않으면 undefined·null 이 computeTierMeans 의 평균을 NaN 으로
         오염시켜 통계가 '—' 로 사라진다(심박 처리와 동일한 필터 패턴). */
      var heelArr = arr.filter(function (o) { return o.heel != null; });
      if (heelArr.length) g.heel = statsBy(heelArr, 'heel');
      var pitchArr = arr.filter(function (o) { return o.pitch != null; });
      if (pitchArr.length) g.pitch = statsBy(pitchArr, 'pitch');
      /* 심박은 센서 드롭아웃으로 일부 표본에 hr 이 없을 수 있어, hr 이
         담긴 표본만 추려 시간가중 구간 평균을 낸다. 좌우 택과 무관해
         패널은 all 그룹의 hr 만 쓰지만(P/S 분할 없음), 코드 경로는
         heel·pitch 와 같게 둔다. */
      var hrArr = arr.filter(function (o) { return o.hr != null; });
      if (hrArr.length) g.hr = statsBy(hrArr, 'hr');
      return g;
    }
    var upAll = bk.upP.concat(bk.upS), downAll = bk.downP.concat(bk.downS);
    var g = {
      upwind:   { all: group(upAll),   P: group(bk.upP),   S: group(bk.upS) },
      downwind: { all: group(downAll), P: group(bk.downP), S: group(bk.downS) }
    };
    return {
      windDir: wd,
      // 전체(택 합산) — 후방호환 키
      vmgUpwindAvgMs: g.upwind.all.vmg.avg,
      vmgUpwindTop50Ms: g.upwind.all.vmg.top50,
      vmgUpwindTop20Ms: g.upwind.all.vmg.top20,
      vmgDownwindAvgMs: g.downwind.all.vmg.avg,
      vmgDownwindTop50Ms: g.downwind.all.vmg.top50,
      vmgDownwindTop20Ms: g.downwind.all.vmg.top20,
      upwindTimeSec: g.upwind.all.timeSec,
      downwindTimeSec: g.downwind.all.timeSec,
      // 택별 상세 — { upwind|downwind: { all|P|S: { vmg, sog, timeSec, count } } }
      tackSplit: g
    };
  }

  /* ============================================================
   * 7b) 퍼포먼스 통계 패널 데이터 — Njord 'Statistics' 벤치마크(§3.2)
   *
   * 핵심 지표(SOG·VMG·풍각·힐·피치·심박)의 평균·상위 50%·상위 20%
   * 를 한 표로 압축한다. analyzeSession 이 이미 산출한 구간 평균을
   * 재배치할 뿐, 여기서 새로 계산하는 통계는 없다(중복 재계산 금지).
   *   · SOG·VMG·풍각·힐·피치 → 풍상/풍하 × 포트(P)/스타보드(S) 4 버킷.
   *     포트/스타보드 분류는 computeWindMetrics 의 것(§421: angleDiff>=0 → P)을
   *     재사용한다. 피치도 다른 지표처럼 좌우 택으로 쪼갠다(Danny 2026-05-23).
   *   · 심박 → 풍상/풍하 (택 합산). 좌우 택과 무관한 지표라 P/S 로
   *     쪼개지 않는다. 풍상/풍하 시간가중 구간 평균을 computeWindMetrics
   *     가 산출해 둔 것을 그대로 쓴다 — 속도(SOG)와 같은 풍상/풍하
   *     구조라 '빠를 때 더 애쓰는지'를 나란히 본다.
   * '상위' 는 지표의 좋은 방향 기준이다 — 높을수록 좋은 지표는 높은
   * 값 구간, 풍상 풍각처럼 낮을수록 좋은 지표는 낮은 값 구간. 중립
   * 지표는 0 에서 먼 쪽(크기 큰 값) — 힐은 포트 버킷이 더 음수,
   * 스타보드 버킷이 더 양수인 쪽이 상위가 된다(statsTierHi 참고).
   * 데이터가 없는 지표(풍향 미설정 → VMG·풍각·심박, GPX → 힐·피치,
   * 심박 없음 → HR)는 행 자체를 만들지 않는다 — UI 가 그대로 숨긴다.
   *
   * 값 단위: 속도(sog·vmg) = m/s, 각도(twa·heel·pitch) = 도(°),
   * 심박(hr) = bpm. 표시 단위 변환·포맷은 app.js 가 담당한다.
   *
   * @param analysis  analyzeSession() 반환 객체
   * @return { rows:[{key,metric,mode,side,label,sub,unit,avg,tier50,
   *           tier20,tier50Basis,tier20Basis,direction,timeSec,count}],
   *           windAvailable, hrAvailable, upwindTimeSec, downwindTimeSec }
   *   side('P'|'S'|null) — 포트/스타보드 택. null = 택 미분할(피치·심박).
   *   direction('high'|'low'|'neutral') — 지표의 '좋은 방향'.
   *   tier50·tier20 — '상위 50%/20%' 표시값. tier50Basis·tier20Basis
   *   ('top50'|'bot50'|'top20'|'bot20') — 어느 구간에서 왔는지.
   * ============================================================ */
  /* split:true — 포트/스타보드 택별 4 버킷(풍상/풍하 × P/S)으로 쪼개는
     지표. 피치(Pitch)도 다른 속도·자세 지표처럼 좌우 택으로 나눠
     보여 준다 (Danny 2026-05-23). split:false 는 심박(HR)만 — 좌우
     택과 무관해 풍상/풍하로만 나누고, 패널 맨 아래에 둬 위쪽 SOG 와
     같은 풍상/풍하 구조로 신체 부하를 나란히 비교한다. */
  /* 행 순서 — SOG → 풍각(TWA) → VMG → 힐 → 피치 → 심박. VMG 블록을
     풍각 아래·심박 위로 둔다 (Danny 검토 2026-05-24 E). */
  var STATS_WIND_METRICS = [
    { metric: 'sog',   label: 'SOG (속도)',          unit: 'speed', split: true },
    { metric: 'twa',   label: 'CWA',                unit: 'deg',   split: true  },
    { metric: 'awa',   label: 'AWA (겉보기 풍각)',    unit: 'deg',   split: true  },
    { metric: 'vmg',   label: 'VMG (풍상·풍하 유효속도)', unit: 'speed', split: true },
    { metric: 'heel',  label: '힐 (Heel)',           unit: 'deg',   split: true  },
    { metric: 'pitch', label: '피치 (Pitch·트림)',   unit: 'deg',   split: true  },
    { metric: 'hr',    label: '심박수 (HR)',          unit: 'bpm',   split: false }
  ];
  var STATS_MODES = [
    { id: 'upwind',   label: '풍상' },
    { id: 'downwind', label: '풍하' }
  ];
  var STATS_SIDES = [
    { id: 'P', label: '포트' },
    { id: 'S', label: '스타보드' }
  ];

  /* 지표·방향별 '좋은 방향'. 모든 지표를 '클수록 좋다'로 뭉뚱그리지
     않는다 — 지표마다 좋은 쪽이 다르다.
       'high'    클수록 좋음   — SOG·VMG (풍상·풍하 유효속도 모두 양수 저장)
       'low'     작을수록 좋음 — 풍상 TWA (작을수록 바람에 가깝게 포인팅)
       'neutral' 한 방향으로 좋고 나쁨을 매길 수 없음 —
                  · 풍하 TWA : VMG 최적각이 ≈140–150° 로 비단조
                    (정풍하 180° 는 오히려 느림)
                  · 힐·피치  : 트림·자세 특성 (좋고 나쁨이 아님)
                  · 심박     : 신체 부하 참고 지표
     렌더러(app.js)는 이 값으로 '상위'가 어느 쪽인지·방향 배지를 정한다. */
  function statsMetricDirection(metric, mode) {
    if (metric === 'sog' || metric === 'vmg') return 'high';
    if (metric === 'twa') return (mode === 'upwind') ? 'low' : 'neutral';
    return 'neutral';   // heel · pitch · hr
  }

  /* '상위 50%/20%' 가 어느 구간인지 — true=높은 값(top), false=낮은 값(bot).
     좋은 방향이 'high'면 높은 값, 'low'면 낮은 값. 'neutral'은 0 에서 먼
     쪽(크기 큰 값) — 버킷 평균 부호로 정한다. 힐을 포트/스타보드로 쪼개면
     포트 평균은 음수·스타보드 평균은 양수라, 각 버킷에서 0 에서 먼 쪽
     (포트는 더 음수, 스타보드는 더 양수 = 더 크게 기운 쪽)이 상위가 된다. */
  function statsTierHi(direction, avg) {
    if (direction === 'high') return true;
    if (direction === 'low') return false;
    return avg >= 0;
  }

  function computeStatsPanel(analysis) {
    var out = { rows: [], windAvailable: false, hrAvailable: false,
                upwindTimeSec: 0, downwindTimeSec: 0 };
    if (!analysis) return out;

    /* 속도·각도 지표 — 풍향 확정 시 computeWindMetrics 택 그룹에서 재사용.
       group.count 가 0(해당 방향 주행 없음)이거나 지표 통계가 없으면
       (예: GPX 엔 heel·pitch 없음) 행을 만들지 않는다. */
    var w = analysis.wind && analysis.wind.tackSplit;
    if (w) {
      out.windAvailable = true;
      out.upwindTimeSec =
        (w.upwind && w.upwind.all && w.upwind.all.timeSec) || 0;
      out.downwindTimeSec =
        (w.downwind && w.downwind.all && w.downwind.all.timeSec) || 0;
      STATS_WIND_METRICS.forEach(function (md) {
        STATS_MODES.forEach(function (mo) {
          var dir = statsMetricDirection(md.metric, mo.id);
          /* split:true 지표는 포트(P)·스타보드(S) 버킷으로, split:false
             (심박)는 택 합산(all) 으로. 포트/스타보드 분류는
             computeWindMetrics 가 이미 쓰는 것(§421: angleDiff>=0 → P)을
             그대로 재사용한다. */
          var buckets = md.split
            ? STATS_SIDES
            : [{ id: 'all', label: null }];
          buckets.forEach(function (bk) {
            var grp = w[mo.id] && w[mo.id][bk.id];
            if (!grp || !grp.count) return;
            var st = grp[md.metric];
            if (!st) return;                // 지표 통계 없음 (GPX heel·pitch)
            /* '상위' = 좋은 방향 기준 구간. 'neutral'(힐 등)은 버킷
               평균 부호로 0 에서 먼 쪽을 상위로 — statsTierHi 참고. */
            var hi = statsTierHi(dir, st.avg);
            var side = (bk.id === 'all') ? null : bk.id;
            out.rows.push({
              key: md.metric + '-' + mo.id + (side ? '-' + side : ''),
              metric: md.metric, mode: mo.id, side: side,
              label: md.label,
              sub: bk.label ? (mo.label + ' · ' + bk.label) : mo.label,
              unit: md.unit,
              avg: st.avg,
              tier50: hi ? st.top50 : st.bot50,
              tier20: hi ? st.top20 : st.bot20,
              tier50Basis: hi ? 'top50' : 'bot50',
              tier20Basis: hi ? 'top20' : 'bot20',
              direction: dir,
              timeSec: grp.timeSec, count: grp.count
            });
          });
        });
      });
    }

    /* 심박수(HR) — 위 STATS_WIND_METRICS 루프에서 풍상/풍하 행으로 이미
       산출됐다(split:false). 좌우 택과 무관해 P/S 로 쪼개지 않고, 속도
       (SOG)와 같은 풍상/풍하 구조로 신체 부하를 나란히 본다. 풍향이
       없으면 SOG·VMG 와 마찬가지로 행을 만들지 않는다(옛 '전체 세션'
       단독 행은 제거 — 의미가 옅어 풍상/풍하 분리로 대체). */
    out.hrAvailable = !!(analysis.hr && analysis.hr.hasHR);
    return out;
  }

  /* ============================================================
   * 8) 풍각 폴라 다이어그램 — 풍향 입력 시
   * ============================================================ */
  function computePolar(session, windDir, binDeg) {
    if (!session.hasTime || windDir == null) return null;
    binDeg = binDeg || session.cfg.polarBinDeg;
    var S = session.samples;
    var wd = ((windDir % 360) + 360) % 360;
    var nBins = Math.ceil(180 / binDeg);
    var port = [], stbd = [], all = [];
    for (var b = 0; b < nBins; b++) { port.push([]); stbd.push([]); all.push([]); }

    session.legs.forEach(function (leg) {
      for (var i = leg.start; i <= leg.end; i++) {
        var sp = S[i].speed;
        if (sp < 1.0 || S[i].heading == null) continue;
        var signed = Geo.angleDiff(wd, S[i].heading); // -180..180
        var twa = Math.abs(signed);
        var b = Math.min(nBins - 1, Math.floor(twa / binDeg));
        /* §421 — 표준 convention 정정: angleDiff>=0 → Port (computeWindMetrics·
           maneuverSide 와 동일 부호 규약). 옛 규약(>=0→stbd)에서 swap.
           검증: selftest-421-vmg-parity.js. DO_NOT_REVERT §421. */
        (signed >= 0 ? port : stbd)[b].push(sp);
        /* combined — 택을 합산한 빈. 타깃 폴라(개인 베스트)는 택을
           가리지 않는 '능력 한계'이므로 포트·스타보드를 함께 모은다. */
        all[b].push(sp);
      }
    });
    function reduce(arr) {
      return arr.map(function (list, b) {
        list.sort(function (a, c) { return a - c; });
        var sum = 0;
        for (var k = 0; k < list.length; k++) sum += list[k];
        return {
          twaCenter: (b + 0.5) * binDeg,
          count: list.length,
          p95Ms: list.length ? Geo.percentile(list, 95) : 0,
          avgMs: list.length ? sum / list.length : 0
        };
      });
    }
    return { binDeg: binDeg, windDir: wd,
             port: reduce(port), starboard: reduce(stbd), combined: reduce(all) };
  }

  /* ============================================================
   * 8b) 타깃 폴라 · % of target — Njord 'Performance Database' 철학
   *
   * 타깃 폴라는 클래스 기본 폴라가 아니라 라이더 본인의 누적 세션에서
   * 뽑은 '개인 베스트' 곡선이다. 풍각(TWA) 빈마다 그동안 실제로 지속한
   * 최고 속도(세션별 95퍼센타일 속도의 최댓값)를 목표로 삼는다.
   *   · sessionPolarProfile()    — 한 세션의 빈별 컴팩트 폴라(저장·누적용)
   *   · buildTargetPolar()       — 여러 세션 프로파일을 누적해 타깃 곡선
   *   · computeTargetComparison() — 현재 세션이 타깃의 몇 %인지(풍상·풍하)
   * 표본이 부족한 빈은 비우거나 보간으로 표시해 과신을 막는다.
   *
   * 정직한 한계: 타깃·% of target 는 풍향(TWD)이 정확해야 의미가 있다.
   * 풍향 자동 추정 신뢰도가 낮은 세션은 TWA 자체가 틀어지므로 UI 가
   * 그 사실을 함께 표기해야 한다.
   * ============================================================ */

  /* 한 세션의 빈별 폴라 프로파일 — computePolar 의 combined(택 합산)을
     컴팩트 구조로 추출한다. 저장(storage.js)·타깃 폴라 구축의 공통
     입력 포맷이다. 반환: { binDeg, bins:[{count,p95Ms}] } 또는 null. */
  function sessionPolarProfile(session, windDir, binDeg) {
    var polar = computePolar(session, windDir, binDeg);
    if (!polar || !polar.combined) return null;
    return {
      binDeg: polar.binDeg,
      bins: polar.combined.map(function (bn) {
        return { count: bn.count, p95Ms: bn.p95Ms };
      })
    };
  }

  /* 타깃 폴라 구축 — 여러 세션의 폴라 프로파일을 누적해 빈별 '개인
     베스트' 곡선을 만든다.
       profiles : { binDeg, bins:[{count,p95Ms}] } 의 배열
       opts.minBinSamples : 한 세션-빈이 타깃에 기여하려면 필요한 최소
                            표본 수(≈초, 1Hz). 기본 20.
       opts.sparseSamples : 누적 표본이 이보다 적은 타깃 빈은 'sparse'
                            (표본 적음)로 표시 — 과신 방지. 기본 60.
       opts.basis : 'cumulative' | 'single-session' (UI 라벨용).
     빈 속도 = 기여한 세션들의 p95 중 최댓값(가장 잘한 날 기준).
     실측 빈 두 개 사이의 내부 공백만 선형 보간하고 interpolated 로
     표시한다. 무항주(no-go)·정풍하처럼 한쪽 끝이 비는 공백은 보간하지
     않는다(물리적으로 달릴 수 없는 구역 — 정직하게 비워 둔다). */
  function buildTargetPolar(profiles, opts) {
    opts = opts || {};
    profiles = (profiles || []).filter(function (p) {
      return p && p.bins && p.bins.length;
    });
    if (!profiles.length) return null;
    var minSamp = opts.minBinSamples != null ? opts.minBinSamples : 20;
    var sparseSamp = opts.sparseSamples != null ? opts.sparseSamples : 60;
    var binDeg = profiles[0].binDeg || DEFAULTS.polarBinDeg;
    var nBins = Math.ceil(180 / binDeg);

    var bins = [], b;
    for (b = 0; b < nBins; b++) {
      var twaC = (b + 0.5) * binDeg;
      var best = null, sampleCount = 0, sessionCount = 0;
      for (var pi = 0; pi < profiles.length; pi++) {
        var pb = profiles[pi].bins[b];
        if (!pb || pb.count < minSamp || !(pb.p95Ms > 0)) continue;
        sessionCount++;
        sampleCount += pb.count;
        if (best == null || pb.p95Ms > best) best = pb.p95Ms;
      }
      bins.push({
        twaCenter: twaC,
        speedMs: best,                                   // null = 실측 공백
        vmgMs: best != null
          ? best * Math.abs(Math.cos(Geo.toRad(twaC))) : null,
        sampleCount: sampleCount,
        sessionCount: sessionCount,
        interpolated: false,
        sparse: best != null && sampleCount < sparseSamp
      });
    }

    /* 내부 공백 보간 — 실측 빈을 앵커로 그 사이만 채운다(연쇄 외삽 없음) */
    var realIdx = [];
    for (b = 0; b < nBins; b++) if (bins[b].speedMs != null) realIdx.push(b);
    for (var k = 0; k + 1 < realIdx.length; k++) {
      var lo = realIdx[k], hi = realIdx[k + 1];
      if (hi - lo <= 1) continue;
      for (var j = lo + 1; j < hi; j++) {
        var f = (j - lo) / (hi - lo);
        var sp = bins[lo].speedMs + (bins[hi].speedMs - bins[lo].speedMs) * f;
        bins[j].speedMs = sp;
        bins[j].vmgMs = sp * Math.abs(Math.cos(Geo.toRad(bins[j].twaCenter)));
        bins[j].interpolated = true;
      }
    }

    var filled = 0, interp = 0, empty = 0, sparse = 0;
    bins.forEach(function (bn) {
      if (bn.speedMs == null) empty++;
      else if (bn.interpolated) interp++;
      else { filled++; if (bn.sparse) sparse++; }
    });

    return {
      binDeg: binDeg, nBins: nBins, bins: bins,
      sourceSessionCount: profiles.length,
      basis: opts.basis || (profiles.length > 1 ? 'cumulative' : 'single-session'),
      filledBins: filled, interpolatedBins: interp,
      emptyBins: empty, sparseBins: sparse
    };
  }

  /* % of target — 현재 세션의 매 순간 성능이 타깃 폴라의 몇 %인지.
     풍상(TWA<90°)·풍하(TWA≥90°)를 따로 집계한다.
       비교 = Σ(실측속도·dt) ÷ Σ(타깃속도·dt) — 같은 풍각 빈끼리 대응시켜
       풍각 효과를 상쇄한 '순수 속도 달성률'. 시간 가중.
     보간된 빈·표본이 적은(sparse) 빈은 타깃을 신뢰할 수 없으므로
     헤드라인 %에서 제외하고 coverage 로만 보고한다(과신 방지 —
     "표본 적은 빈은 타깃을 신뢰하지 말 것").
     반환 null: 풍향 미설정·타깃 없음·시각 정보 없음. */
  function computeTargetComparison(session, windDir, target) {
    if (!session || !session.hasTime || windDir == null || !target) return null;
    var S = session.samples;
    var wd = ((windDir % 360) + 360) % 360;
    var binDeg = target.binDeg, nBins = target.nBins;

    var acc = [];
    for (var b = 0; b < nBins; b++) acc.push({ spDt: 0, dt: 0, n: 0 });
    session.legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        var sp = S[i].speed;
        if (sp < 1.0 || S[i].heading == null) continue;
        var dt = S[i].t - S[i - 1].t;
        if (dt <= 0) continue;
        var twa = Math.abs(Geo.angleDiff(wd, S[i].heading));
        var bi = Math.min(nBins - 1, Math.floor(twa / binDeg));
        acc[bi].spDt += sp * dt; acc[bi].dt += dt; acc[bi].n++;
      }
    });

    function side(fromBin, toBin) {
      var sessSpDt = 0, tgtSpDt = 0, cmpDt = 0, allDt = 0;
      var binsOut = [];
      for (var b = fromBin; b <= toBin; b++) {
        var a = acc[b], tb = target.bins[b];
        if (a.dt <= 0) continue;
        allDt += a.dt;
        var sessAvg = a.spDt / a.dt;
        var rec = {
          twaCenter: (b + 0.5) * binDeg,
          sessionSpeedMs: sessAvg,
          timeSec: a.dt,
          targetSpeedMs: tb ? tb.speedMs : null,
          targetInterpolated: !!(tb && tb.interpolated),
          targetSparse: !!(tb && tb.sparse),
          pctOfTarget: null
        };
        if (tb && tb.speedMs > 0) {
          rec.pctOfTarget = sessAvg / tb.speedMs * 100;
          /* 헤드라인엔 신뢰할 수 있는 타깃 빈만 합산 — 보간 빈·표본
             적은(sparse) 빈은 타깃이 불확실하므로 제외한다. */
          if (!tb.interpolated && !tb.sparse) {
            sessSpDt += a.spDt;
            tgtSpDt += tb.speedMs * a.dt;
            cmpDt += a.dt;
          }
        }
        binsOut.push(rec);
      }
      return {
        pctOfTarget: tgtSpDt > 0 ? sessSpDt / tgtSpDt * 100 : null,
        comparedTimeSec: cmpDt,
        timeSec: allDt,
        coverage: allDt > 0 ? cmpDt / allDt : 0,
        bins: binsOut
      };
    }
    var mid = Math.floor(90 / binDeg);   // 90° 경계 — 이상은 풍하
    return {
      windDir: wd, binDeg: binDeg, basis: target.basis,
      upwind: side(0, mid - 1),
      downwind: side(mid, nBins - 1)
    };
  }

  /* ============================================================
   * 9a) 헤딩 히스토그램 — 풍향 추정·그리드 정렬도 공유 기반
   *
   * 이동 중(≥6.5kt) 표본의 GPS 헤딩을 5° bin·거리 가중으로 모은
   * 분포. 풍향 자동 추정(estimateWindFromTrack)과 풍향 그리드
   * 정렬도(tackAlignment)가 같은 분포를 공유해 중복 계산을 없앤다.
   * ============================================================ */
  function headingHistogram(session) {
    if (!session || !session.hasTime) return null;
    var S = session.samples;
    var BIN = 5, N = 72;
    var floorMs = 6.5 / Geo.MS_TO_KNOTS;       // 헤딩이 유의미한 최소 속도
    var hist = [], spdSum = [], spdN = [], i;
    for (i = 0; i < N; i++) { hist[i] = 0; spdSum[i] = 0; spdN[i] = 0; }
    var total = 0, used = 0;
    session.legs.forEach(function (leg) {
      for (var i = leg.start; i <= leg.end; i++) {
        var s = S[i];
        if (s.speed < floorMs || s.heading == null) continue;
        var b = Math.floor((((s.heading % 360) + 360) % 360) / BIN) % N;
        var w = (s.segDist > 0) ? s.segDist : s.speed;   // 거리 가중
        hist[b] += w; total += w; used++;
        spdSum[b] += s.speed; spdN[b]++;
      }
    });
    return { BIN: BIN, N: N, hist: hist, spdSum: spdSum, spdN: spdN,
             total: total, used: used };
  }

  /* ============================================================
   * 9b) 풍향 그리드 정렬도 — 클로즈홀드 ±45° 택 라인 정합
   *
   * 지도 풍향 그리드의 ±45° 라인이 실제 풍상 항적과 얼마나 잘 맞는지
   * 0~1 로 수치화한다. 풍상 주행(twa < 80°) 표본이 전형적 클로즈홀드
   * 기준각 45° 에 몰릴수록 점수가 높아, 정확한 풍향 부근에서 국소
   * 최댓값을 이룬다. 지도 그리드 glint(반짝임)와 풍향 자동 추정이
   * 이 함수를 함께 쓴다 — headingHistogram 기반이라 풍향을 드래그
   * 하는 동안 매 틱 호출해도 가볍다.
   * ============================================================ */
  function tackAlignment(session, windDir, hh) {
    hh = hh || headingHistogram(session);
    if (!hh || hh.total <= 0 || windDir == null) {
      return { score: 0, upwindWeight: 0, weight: hh ? hh.total : 0 };
    }
    var BIN = hh.BIN, N = hh.N, hist = hh.hist;
    var wd = ((windDir % 360) + 360) % 360;
    var KERNEL_DEG = 25;            // ±45° 라인에서 이만큼 벗어나면 점수 0
    var scoreSum = 0, upWeight = 0;
    for (var b = 0; b < N; b++) {
      var w = hist[b];
      if (w <= 0) continue;
      var hc = (b + 0.5) * BIN;                       // bin 중심 헤딩
      var twa = Math.abs(Geo.angleDiff(wd, hc));      // 0=정풍상, 180=정풍하
      if (twa >= 80) continue;                        // 풍상 주행 표본만
      upWeight += w;
      var dev = Math.abs(twa - 45);                   // 클로즈홀드 ±45° 와의 차
      var k = 1 - dev / KERNEL_DEG;
      if (k > 0) scoreSum += w * k;
    }
    return { score: scoreSum / hh.total, upwindWeight: upWeight, weight: hh.total };
  }

  /* ============================================================
   * 9c) 풍향(TWD) 추정 — 노고존(no-go zone) 방식
   *
   * 세일러는 진풍 기준 ±40~50° 안으로는 절대 달릴 수 없다. 따라서
   * 세션 전체의 GPS 헤딩 분포에는 항상 ~80~100° 폭의 빈 쐐기(no-go
   * zone)가 생기고, 그 중심이 바람이 불어오는 방향(TWD)이다. 리칭·
   * 업윈드·다운윈드 어떤 패턴이든 이 빈 쐐기는 존재하므로 견고하다.
   * (옛 '택 이등분' 방식은 리칭 왕복 세션에서 런 방향으로 collapse
   *  하는 치명적 실패 모드가 있어 폐기.)
   *
   * 절차: 헤딩 히스토그램(headingHistogram, 5° bin, 거리 가중) →
   * 가중합 최소 90° 윈도의 중심 = 풍상(no-go) → 헤딩분포 거울대칭축
   * 으로 미세보정. 풍상/풍하 양쪽이 다 비면(리칭 왕복) 구분이 모호
   * 하므로 신뢰도 '낮음'. 산출 풍향의 그리드 정렬도(alignmentScore)도
   * 함께 돌려준다 — 지도 그리드 glint 와 같은 척도를 공유한다.
   *
   * References — No-go zone wind inference + 원형 통계:
   *   · Mardia, K.V. & Jupp, P.E. 2000. "Directional Statistics". Wiley.
   *     ISBN 978-0-471-95333-3. doi:10.1002/9780470316979 (ch.6 axial data —
   *     mirror-symmetry refinement 의 표준).
   *   · Larsson & Eliasson 2022 ch.7 — sailing physics 의 no-go zone 정의
   *     (±40-50° 풍상 항해 불가 구역).
   *   · Burch, D. 2022. "Introduction to Polar Diagrams and Optimum VMC".
   *     davidburchnavigation.blogspot.com
   * Self-reported confidence — 학술 정직성 강점 (Halson 2014 sports monitoring
   *   의 uncertainty acknowledgment 원칙과 일치).
   * ============================================================ */
  function estimateWindFromTrack(session) {
    if (!session.hasTime) return null;
    var hh = headingHistogram(session);
    if (!hh) return null;
    var BIN = hh.BIN, N = hh.N, WIN = 18;      // 5° bin, 90° 윈도(18 bin)
    var hist = hh.hist, total = hh.total, used = hh.used;
    if (used < 30 || total <= 0) return null;

    // 원형 3-bin 평활
    var sm = [];
    for (var i = 0; i < N; i++) {
      sm[i] = (hist[(i - 1 + N) % N] + hist[i] + hist[(i + 1) % N]) / 3;
    }
    // 90° 윈도 가중합 → 최소 윈도 = 노고존(풍상) 후보
    var ww = [];
    for (var c = 0; c < N; c++) {
      var w = 0;
      for (var k = 0; k < WIN; k++) w += sm[(c + k) % N];
      ww[c] = w;
    }
    var bestC = 0;
    for (var c = 1; c < N; c++) if (ww[c] < ww[bestC]) bestC = c;
    var oppC = (bestC + N / 2) % N;
    var sorted = ww.slice().sort(function (a, b) { return a - b; });
    var median = sorted[Math.floor(N / 2)] || 1;

    // 가장 빈 90° 윈도 = 풍상 no-go (물리적으로 항상 비어 있음).
    // 옛 flank-속도 판별은 리칭 세션에서 오작동 → 제거. 가장 빈 윈도를
    // 신뢰한다.
    var twd = (((bestC + WIN / 2) % N) * BIN) % 360;

    // 헤딩분포 거울대칭축으로 ±22° 미세보정 (헤딩분포는 풍축 대칭)
    var bestAxis = twd, bestSym = -1;
    for (var d = -22; d <= 22; d++) {
      var axisDeg = ((twd + d) % 360 + 360) % 360;
      var sym = 0;
      for (var k = 0; k < N; k++) {
        var mDeg = ((2 * axisDeg - k * BIN) % 360 + 360) % 360;
        var mb = Math.floor(mDeg / BIN) % N;
        sym += Math.sqrt(sm[k]) * Math.sqrt(sm[mb]);
      }
      if (sym > bestSym) { bestSym = sym; bestAxis = axisDeg; }
    }
    twd = Math.round(bestAxis);

    // 노고존 폭 측정 (twd 중심에서 sm 가 평균의 60% 미만인 연속 구간)
    var twdBin = Math.round(((twd % 360) + 360) % 360 / BIN) % N;
    var lowThr = (total / N) * 0.6;
    var halfW = 0;
    while (halfW < N / 2 && sm[((twdBin + halfW) % N)] < lowThr &&
           sm[((twdBin - halfW) % N + N) % N] < lowThr) halfW++;
    var noGoWidthDeg = halfW * 2 * BIN;

    // 신뢰도 — total 대비 비율로 판정
    var cleanNoGo = ww[bestC] / total;          // 풍상 윈도가 비어 있는 정도
    var downwindFrac = ww[oppC] / total;        // 풍하쪽 90° 윈도 점유
    var conf, note = null;
    var reciprocal = downwindFrac < 0.14;        // 풍하가 희박 = 리칭/한축 위주
    if (cleanNoGo > 0.13) {
      conf = '낮음';
      note = '뚜렷한 무항주(no-go) 구역이 없어 풍향 자동 추정이 불확실합니다 — ' +
             '직접 입력을 권장합니다.';
    } else if (reciprocal) {
      conf = '낮음';
      note = '트랙이 주로 리칭(횡주) 왕복이라 풍상·풍하 구분이 모호합니다 — ' +
             '추정 정확도가 낮으니 직접 입력으로 보정하세요.';
    } else if (cleanNoGo < 0.06) {
      conf = '높음';
    } else {
      conf = '보통';
    }

    var finalWd = ((twd % 360) + 360) % 360;
    return {
      windDir: finalWd,
      confidence: conf,
      note: note,
      method: 'no-go zone — 세션 헤딩 분포의 빈 쐐기(세일 불가 구역) 중심',
      noGoWidthDeg: noGoWidthDeg,
      minSailAngleDeg: Math.round(noGoWidthDeg / 2),
      reciprocal: reciprocal,
      /* 산출 풍향의 그리드 ±45° 정렬도 — 지도 그리드 glint 와 공유 척도 */
      alignmentScore: tackAlignment(session, finalWd, hh).score
    };
  }

  /* ============================================================
   * 9d) 풍향(TWD) 추정 — 회전 기하(maneuver geometry) 방식
   *
   * no-go zone 방식(§9c)과 독립된 두 번째 추정기. Njord Analytics 의
   * 'typical CWA 추론'에 대응한다 — 검출된 택·자이브의 진입/탈출 헤딩과
   * 회전 방향으로 풍축을 직접 재구성한다.
   *
   * 원리 — 택은 보트가 풍상축을 가로질러(통과해) 돌고, 자이브는 풍하축을
   * 통과해 돈다. 회전 전 헤딩과 회전 후 헤딩의 '이등분선'이 곧 풍축이며,
   * 회전이 실제로 쓸고 지나간 헤딩 호(arc)의 중점이 그 회전이 통과한
   * 풍축의 한 끝이다:
   *   · 이등분선 = circularMean(headingBefore, headingAfter) → 풍축(180° 모호)
   *   · 짧은 호로 돌았는지 긴 호로 돌았는지는 누적 회전각(turnAngle)으로
   *     판정 → 쓸고 간 호의 중점 = 택이면 ≈풍상(TWD), 자이브면 ≈풍하.
   * (Njord 는 풍상/풍하 끝을 보트 target 각도로 가리지만 우리에겐 그
   *  데이터가 없으므로, 회전 방향 + 속도 손실로 대신 가린다.)
   *
   * 절차:
   *  1) 풍향 없이 검출된 모든 회전(turn-rate 기반 — 풍향 불필요)에서
   *     이등분선·호 중점을 구한다. 진입/탈출 헤딩이 ~180° 벌어진 리칭
   *     반전은 이등분선이 불안정 → conditioning 가중치로 down-weight.
   *  2) 이등분선을 180°로 접어 풍축을 가중 원형평균으로 군집, 풍축에서
   *     크게 벗어난 회전(풍축 미통과 베어어웨이 등)은 이상치로 배제.
   *  3) 호 중점이 풍축의 어느 끝에 가까운지로 회전을 두 무리로 나눠,
   *     평균 속도 손실이 큰 쪽을 택(풍상 통과)으로 본다 — 택은 바람을
   *     정면으로 가로질러 더 크게 감속하기 때문.
   *  4) 회전별 TWD 추정치를 모아 가중 원형평균=풍향, 원형표준편차로
   *     일관성을 재고 신뢰도를 산출한다.
   *
   * 한계(정직히): 리칭(횡주) 위주 세션은 택·자이브가 적고 회전이 ~180°
   * 리칭 반전이라 이등분선이 불안정 → 신뢰도 '낮음'으로 표기한다.
   * no-go zone 방식과 똑같이 리칭 세션에 약하므로 과신하지 않는다.
   *
   * References — Maneuver geometry wind inference + 원형 통계:
   *   · Mardia, K.V. & Jupp, P.E. 2000. "Directional Statistics". Wiley.
   *     ISBN 978-0-471-95333-3. doi:10.1002/9780470316979
   *     (ch.6 axial data — 2θ doubled-angle 가중 원형 평균, R-bar, circular σ).
   *   · Berens, P. 2009. "CircStat: A MATLAB Toolbox for Circular Statistics".
   *     Journal of Statistical Software 31(10):1-21. doi:10.18637/jss.v031.i10
   *   · Njord Analytics — app.sailnjord.com/help/analytics/maneuvers.html
   *     (typical TWA inference 패턴 — 본 함수가 같은 방향성).
   *
   * 두 채널 (estimateWindFromTrack + 본 함수) 의 cross-validation 이 학술 강점
   *   — 단일 추정기보다 robust. 두 출력 ±10° 안 = 신뢰도 ↑, 어긋남 = 사용자
   *   직접 입력 권고. Phase 2 — 4-channel Bayesian 통합 (SailTechCo Moat W3).
   * ============================================================ */
  function estimateWindFromManeuvers(session) {
    if (!session || !session.hasTime) return null;
    var mvs = detectManeuvers(session, null);   // turn-rate 기반 — 풍향 불필요
    if (!mvs || mvs.length < 2) return null;

    /* 1) 회전별 이등분선·호 중점·conditioning 가중치 */
    var items = [];
    mvs.forEach(function (m) {
      if (m.headingBefore == null || m.headingAfter == null) return;
      if (m.turnAngle == null || m.lossPct == null) return;
      var bis = Geo.circularMean([m.headingBefore, m.headingAfter]);
      var sep = Math.abs(Geo.angleDiff(m.headingBefore, m.headingAfter)); // 0~180
      /* 회전이 짧은 호로 돌았는지(이등분선=호 중점) 긴 호로 돌았는지(호
         중점=이등분선+180) — 누적 회전각이 sep 과 360-sep 중 어디에
         가까운지로 가린다. */
      var longArc = Math.abs(m.turnAngle - (360 - sep)) <
                    Math.abs(m.turnAngle - sep);
      var mid = longArc ? norm360(bis + 180) : bis;
      /* conditioning 가중치 — 진입/탈출 헤딩이 ~90° 벌어진 깨끗한 택·
         자이브는 이등분선이 또렷(w≈0.7), ~180° 벌어진 리칭 반전은
         이등분선이 불안정(w≈0). */
      var w = Math.abs(Math.cos(Geo.toRad(sep / 2)));
      items.push({ m: m, bis: bis, mid: mid, axis: norm180(bis),
                   loss: m.lossPct, sep: sep, w: w });
    });
    if (items.length < 2) return null;

    /* 2) 풍축을 가중 원형평균(2배각)으로 군집 + 이상치 배제 */
    function axisMean(list) {
      var sx = 0, sy = 0;
      list.forEach(function (it) {
        var r = 2 * Geo.toRad(it.axis);
        sx += it.w * Math.cos(r); sy += it.w * Math.sin(r);
      });
      if (sx === 0 && sy === 0) return list[0] ? list[0].axis : 0;
      return norm180(Geo.toDeg(Math.atan2(sy, sx)) / 2);
    }
    function axisDev(ax, a) {
      var d = Math.abs(ax - a) % 180;
      return Math.min(d, 180 - d);
    }
    var axis = axisMean(items);
    var AXIS_TOL = 35;
    var inliers = items.filter(function (it) {
      return axisDev(it.axis, axis) <= AXIS_TOL;
    });
    if (inliers.length >= 2) {
      axis = axisMean(inliers);
      inliers = items.filter(function (it) {
        return axisDev(it.axis, axis) <= AXIS_TOL;
      });
    }
    var outlierCount = items.length - inliers.length;
    var sumW = 0;
    inliers.forEach(function (it) { sumW += it.w; });
    if (inliers.length < 2 || sumW < 0.5) return null;

    /* 3) 풍축의 두 끝 — 호 중점이 어느 끝에 가까운지로 회전을 가른다 */
    var endA = norm360(axis), endB = norm360(axis + 180);
    var grpA = [], grpB = [];
    inliers.forEach(function (it) {
      var dA = Math.abs(Geo.angleDiff(endA, it.mid));
      var dB = Math.abs(Geo.angleDiff(endB, it.mid));
      (dA <= dB ? grpA : grpB).push(it);
    });
    function wMeanLoss(g) {
      var s = 0, w = 0;
      g.forEach(function (it) { s += it.loss * it.w; w += it.w; });
      return w > 0 ? s / w : null;
    }
    var lossA = wMeanLoss(grpA), lossB = wMeanLoss(grpB);
    var upwindEnd, resolMargin, resolByLoss = true;
    if (grpA.length && grpB.length && lossA != null && lossB != null) {
      /* 택(풍상 통과)은 바람을 정면으로 가로질러 더 크게 감속한다 */
      upwindEnd = (lossA >= lossB) ? endA : endB;
      resolMargin = Math.abs(lossA - lossB);
    } else {
      /* 한쪽 끝으로만 회전이 몰린 세션 — 절대 손실로 택/자이브 판정 */
      var only = grpA.length ? grpA : grpB;
      var onlyEnd = grpA.length ? endA : endB;
      var ml = wMeanLoss(only) || 0;
      var LOSS_TACK_HINT = 33;
      upwindEnd = (ml >= LOSS_TACK_HINT) ? onlyEnd : norm360(onlyEnd + 180);
      resolMargin = Math.abs(ml - LOSS_TACK_HINT);
      resolByLoss = false;
    }

    /* 4) 회전별 TWD 추정치 → 가중 원형평균 = 풍향, 원형표준편차 = 일관성 */
    var sx = 0, sy = 0, sepS = 0;
    inliers.forEach(function (it) {
      var dU = Math.abs(Geo.angleDiff(upwindEnd, it.mid));
      it.twd = (dU <= 90) ? it.mid : norm360(it.mid + 180);
      var r = Geo.toRad(it.twd);
      sx += it.w * Math.cos(r); sy += it.w * Math.sin(r);
      sepS += it.sep * it.w;
    });
    var windDir = norm360(Geo.toDeg(Math.atan2(sy, sx)));
    var Rlen = Math.sqrt(sx * sx + sy * sy) / sumW;
    var spreadDeg = Geo.toDeg(
      Math.sqrt(Math.max(0, -2 * Math.log(Math.max(Rlen, 1e-6)))));
    var wMeanSep = sepS / sumW;

    /* 5) 신뢰도 — 유효 표본수(Σw)·일관성(spread)·풍상/풍하 판정 여유 */
    var reachy = wMeanSep > 150;     // 회전이 대부분 ~180° 리칭 반전
    var outlierFrac = outlierCount / items.length;
    var conf, note = null;
    if (reachy) {
      conf = '낮음';
      note = '트랙이 주로 리칭(횡주) 반전이라 풍축을 가로지르는 택·자이브가 ' +
             '적습니다 — 회전 기하 추정의 신뢰도가 낮으니 직접 입력으로 ' +
             '보정해 주세요.';
    } else if (sumW >= 4 && spreadDeg <= 14 && resolMargin >= 6 &&
               outlierFrac < 0.4) {
      conf = '높음';
    } else if (sumW >= 2 && spreadDeg <= 28) {
      conf = '보통';
      if (resolMargin < 5) {
        note = '풍축은 비교적 또렷하나 택·자이브의 속도 손실 차가 작아 ' +
               '풍상·풍하 방향(180°) 판정이 약합니다 — 다른 소스와 ' +
               '대조해 주세요.';
      }
    } else {
      conf = '낮음';
      note = '검출된 택·자이브가 적거나 회전별 추정이 흩어져 신뢰도가 ' +
             '낮습니다 — 직접 입력으로 보정해 주세요.';
    }

    return {
      windDir: Math.round(windDir),
      confidence: conf,
      note: note,
      method: '회전 기하 — 택·자이브 진입/탈출 헤딩의 이등분선으로 풍축 재구성',
      windAxisDeg: Math.round(norm180(windDir)),
      maneuverCount: inliers.length,
      effectiveCount: Math.round(sumW * 10) / 10,
      outlierCount: outlierCount,
      spreadDeg: Math.round(spreadDeg * 10) / 10,
      resolutionMarginPct: Math.round(resolMargin * 10) / 10,
      resolutionByLoss: resolByLoss,
      reachy: reachy
    };
  }

  /* ============================================================
   * 9e) 풍향 다중 소스 — 수동·no-go·회전기하·외부날씨 통합
   *
   * 풍향 입력을 여러 소스로 다원화하고(Njord 의 4소스 구조에 상응),
   * 독립 추정 간 교차검증으로 권장 소스를 가린다. UI 가 각 소스의
   * 값·신뢰도를 나란히 비교하도록 순수 데이터 구조만 돌려준다.
   *
   * opts = {
   *   manualDir : 수동 확정 풍향(도) 또는 null
   *   nogo      : estimateWindFromTrack() 반환값 또는 null
   *   rotation  : estimateWindFromManeuvers() 반환값 또는 null
   *   weather   : 외부 날씨 풍향(향후 OpenWeather 등 연동) — 현재 null.
   *               available:false 슬롯으로 미리 자리만 잡아 둔다.
   * }
   * ============================================================ */
  var WIND_CONF_RANK = { '높음': 3, '보통': 2, '낮음': 1 };
  function windConfRank(c) { return WIND_CONF_RANK[c] || 0; }
  function windConfBump(c) {
    return c === '보통' ? '높음' : (c === '낮음' ? '보통' : c);
  }

  function buildWindSources(opts) {
    opts = opts || {};
    var manualDir = (opts.manualDir != null) ? norm360(opts.manualDir) : null;
    var nogo = opts.nogo || null;
    var rot = opts.rotation || null;
    var weather = opts.weather || null;   // 향후 외부 날씨 연동 슬롯
    var lineup = opts.lineup || null;     // Channel A — 사용자 1회 캡처 (Vakaros)
    var imu = opts.imu || null;           // Channel B — Apple Watch IMU (Phase 2)

    var sources = [
      {
        id: 'manual', label: '수동 입력',
        windDir: manualDir,
        confidence: manualDir != null ? '확정' : null,
        available: manualDir != null,
        note: manualDir != null
          ? '사용자가 직접 지정해 확정한 풍향입니다.'
          : '다이얼·슬라이더로 직접 입력할 수 있습니다.'
      },
      /* Channel A — 사용자 1회 캡처 (Vakaros "angles 모드" 패턴).
         라이더가 라인업 단계에서 풍상 starboard tack 1회 + port tack 1회
         헤딩을 손으로 저장 → 이등분 = 풍축. SailTechCo Moat W3 Channel A. */
      {
        id: 'lineup', label: 'Lineup 캡처 (W3-A)',
        windDir: lineup ? lineup.windDir : null,
        confidence: lineup ? lineup.confidence : null,
        available: !!lineup,
        method: lineup ? lineup.method : null,
        note: lineup
          ? (lineup.note ||
             '라인업 풍상 port/starboard 헤딩 이등분으로 풍축을 산출했습니다.')
          : '라이더가 라인업 단계에서 풍상 두 택 헤딩을 캡처하면 가용.',
        detail: lineup ? lineup.detail : null
      },
      /* Channel B — Apple Watch Core Motion IMU (board pitch/roll/yaw).
         board-heading vs COG 차이 → leeway → wind direction 추정.
         SailTechCo Moat W3 Channel B (Phase 2 — iOS app 협업). */
      {
        id: 'imu', label: 'Watch IMU (W3-B)',
        windDir: imu ? imu.windDir : null,
        confidence: imu ? imu.confidence : null,
        available: !!imu,
        method: imu ? imu.method : null,
        note: imu
          ? (imu.note ||
             'Apple Watch IMU 의 보드 자세 vs GPS COG 비교로 풍향 추정.')
          : 'Apple Watch standalone 앱 연결 시 가용 (Phase 2).',
        detail: imu ? imu.detail : null
      },
      {
        id: 'nogo', label: 'no-go zone 추정',
        windDir: nogo ? nogo.windDir : null,
        confidence: nogo ? nogo.confidence : null,
        available: !!nogo,
        method: nogo ? nogo.method : null,
        note: nogo
          ? (nogo.note ||
             '세션 헤딩 분포의 빈 쐐기(세일 불가 구역) 중심으로 추정했습니다.')
          : '풍상·풍하 주행이 부족해 no-go zone 으로 추정할 수 없습니다.',
        detail: nogo ? {
          noGoWidthDeg: nogo.noGoWidthDeg,
          alignmentScore: nogo.alignmentScore,
          reciprocal: nogo.reciprocal
        } : null
      },
      {
        id: 'rotation', label: '회전 기하 추정',
        windDir: rot ? rot.windDir : null,
        confidence: rot ? rot.confidence : null,
        available: !!rot,
        method: rot ? rot.method : null,
        note: rot
          ? (rot.note ||
             '택·자이브 진입/탈출 헤딩의 이등분선으로 풍축을 재구성했습니다.')
          : '풍축을 가릴 만한 택·자이브가 부족해 회전 기하로 추정할 수 없습니다.',
        detail: rot ? {
          maneuverCount: rot.maneuverCount,
          effectiveCount: rot.effectiveCount,
          spreadDeg: rot.spreadDeg,
          resolutionMarginPct: rot.resolutionMarginPct,
          reachy: rot.reachy
        } : null
      },
      {
        id: 'weather', label: '외부 날씨 (준비 중)',
        windDir: weather ? weather.windDir : null,
        confidence: weather ? weather.confidence : null,
        available: !!weather,
        placeholder: !weather,
        note: weather
          ? (weather.note || '외부 날씨 데이터에서 불러온 풍향입니다.')
          : 'OpenWeather 등 외부 날씨 데이터 연동 예정입니다 — API 키를 ' +
            '입력하면 세션 시각·위치의 풍향을 자동으로 불러옵니다.'
      }
    ];

    /* 교차검증 — no-go ↔ 회전 기하 두 독립 추정의 일치도 */
    var agreement = null;
    if (nogo && rot && nogo.windDir != null && rot.windDir != null) {
      var delta = Math.abs(Geo.angleDiff(nogo.windDir, rot.windDir));
      agreement = {
        a: 'nogo', b: 'rotation',
        deltaDeg: Math.round(delta),
        agree: delta <= 20
      };
    }

    /* 권장 소스 — 수동 확정값 우선, 없으면 추정 간 교차검증으로 선택 */
    var recommended = null;
    if (manualDir != null) {
      recommended = {
        sourceId: 'manual', windDir: manualDir, confidence: '확정',
        note: '수동으로 확정한 풍향을 사용합니다.'
      };
    } else if (nogo && rot) {
      var nogoBetter = windConfRank(nogo.confidence) >=
                       windConfRank(rot.confidence);
      var hi = nogoBetter ? nogo : rot;
      var hiId = nogoBetter ? 'nogo' : 'rotation';
      if (agreement && agreement.agree) {
        var base = nogoBetter ? nogo.confidence : rot.confidence;
        /* 두 독립 추정이 일치하면 신뢰도를 한 단계 올린다. 단 둘 다
           '낮음' 이면 같은 약점(리칭 세션 등)을 공유할 수 있어 올리지
           않고 일치 사실만 알린다 — 과신 방지. */
        var boosted, agreeNote;
        if (base === '낮음') {
          boosted = '낮음';
          agreeNote = '두 독립 추정이 ±' + agreement.deltaDeg + '° 내로 ' +
            '일치하나, 두 방식 모두 신뢰도가 낮아 직접 입력 보정을 권장합니다.';
        } else if (base === '높음') {
          boosted = '높음';
          agreeNote = 'no-go zone 과 회전 기하 추정이 ±' + agreement.deltaDeg +
            '° 내로 일치합니다 — 신뢰도가 높습니다.';
        } else {
          boosted = windConfBump(base);   // 보통 → 높음
          agreeNote = 'no-go zone 과 회전 기하 추정이 ±' + agreement.deltaDeg +
            '° 내로 일치해 신뢰도를 높였습니다.';
        }
        recommended = {
          sourceId: hiId, windDir: hi.windDir, confidence: boosted,
          note: agreeNote
        };
      } else {
        recommended = {
          sourceId: hiId, windDir: hi.windDir, confidence: hi.confidence,
          note: agreement
            ? ('no-go zone 과 회전 기하 추정이 ' + agreement.deltaDeg +
               '° 어긋납니다 — 두 값을 비교해 직접 확인 후 확정하세요.')
            : '추정 소스 하나만 사용할 수 있습니다.'
        };
      }
    } else if (nogo) {
      recommended = {
        sourceId: 'nogo', windDir: nogo.windDir, confidence: nogo.confidence,
        note: 'no-go zone 추정만 사용할 수 있습니다.'
      };
    } else if (rot) {
      recommended = {
        sourceId: 'rotation', windDir: rot.windDir, confidence: rot.confidence,
        note: '회전 기하 추정만 사용할 수 있습니다.'
      };
    }

    return { sources: sources, agreement: agreement, recommended: recommended };
  }

  /* ============================================================
   * 9f) 4-channel Bayesian wind inference — SailTechCo Moat W3
   *
   * buildWindSources 의 4-5 채널 (manual / lineup / nogo / rotation / imu /
   * weather) 출력을 Bayesian 가중 원형 평균으로 통합한다. 단순 "highest
   * confidence 채널 선택" (기존 recommended 로직) 보다 robust — 여러 채널의
   * 정보를 모두 살리면서 신뢰도 가중.
   *
   * 가중 식:
   *   weight(source) =
   *     · 확정 (manual) → ∞ (강제 채택, 다른 채널 무시)
   *     · 높음 → 3.0
   *     · 보통 → 1.5
   *     · 낮음 → 0.5
   *     · null/unavailable → 0 (배제)
   *   별도 weightOverride 제공 시 그 값으로 대체 (Phase 2 — IMU SNR 가변
   *   등 동적 가중에 사용).
   *
   * 가중 원형 평균 (Mardia & Jupp 2000 ch.2):
   *   Σ_i w_i × cos(θ_i),  Σ_i w_i × sin(θ_i)
   *   TWD = atan2(sin sum, cos sum)
   *   R̄ = √(cos² + sin²) / Σw   ∈ [0, 1]
   *   circular σ = √(-2 × log R̄)   [라디안]
   *
   * 신뢰도 환산 (R̄ 의 자연스러운 mapping):
   *   R̄ ≥ 0.95 → '높음' (channel agreement 큼)
   *   R̄ ≥ 0.80 → '보통'
   *   R̄ <  0.80 → '낮음'
   *   하지만 모든 입력이 '낮음' 이면 결합 결과도 '낮음' 으로 clamp
   *   (입력 정보가 빈약하면 통합도 신뢰 못 함 — 과신 방지).
   *
   * 입력:
   *   sources — buildWindSources().sources 배열, 또는 동등 구조
   *     각 source: { id, windDir, confidence, available, weightOverride? }
   *
   * 반환:
   *   { windDir, confidence, R, spreadDeg, contributing, channels }
   *     · contributing — 가중치 > 0 인 source id 목록
   *     · channels — 각 채널의 (id, weight, contribution_deg)
   *   sources 가 모두 unavailable 이면 null.
   *
   * References — Bayesian / circular weighted mean:
   *   · Mardia, K.V. & Jupp, P.E. 2000. "Directional Statistics". Wiley.
   *     ISBN 978-0-471-95333-3. doi:10.1002/9780470316979 (ch.2 — 원형 평균,
   *     R̄, von Mises distribution).
   *   · Sands, W.A. et al. 2017. "Modern Techniques and Technologies Applied to
   *     Training and Performance Monitoring". Int J Sports Physiol Perform 12(s2):
   *     S2-63-S2-72. doi:10.1123/ijspp.2016-0405 (sensor fusion 표준).
   *   · SailTechCo Moat W3 spec — sailtechco_moat_proposal.md §2.W3.3.
   * ============================================================ */
  var WIND_CHANNEL_WEIGHT = { '확정': Infinity, '높음': 3.0, '보통': 1.5, '낮음': 0.5 };

  function combineWindSources(sources) {
    if (!Array.isArray(sources) || !sources.length) return null;

    /* 1) 사용 가능한 채널만 필터 — 가중치 산출 */
    var contrib = [];
    var hasFixed = false;
    sources.forEach(function (s) {
      if (!s || !s.available || s.windDir == null) return;
      var w = (typeof s.weightOverride === 'number' && s.weightOverride >= 0)
        ? Number(s.weightOverride)
        : (WIND_CHANNEL_WEIGHT[s.confidence] || 0);
      if (w === Infinity) { hasFixed = true; w = 1e9; /* effectively dominant */ }
      if (w > 0) {
        contrib.push({
          id: s.id, windDir: norm360(s.windDir), confidence: s.confidence,
          weight: w
        });
      }
    });
    if (!contrib.length) return null;

    /* 2) 확정 (manual) 채널이 있으면 그것만 사용 — 사용자 명시 입력은 우선 */
    if (hasFixed) {
      var manual = contrib.filter(function (c) { return c.weight >= 1e9; })[0];
      return {
        windDir: manual.windDir,
        confidence: '확정',
        R: 1.0,
        spreadDeg: 0,
        contributing: [manual.id],
        channels: [{ id: manual.id, weight: 1.0, deltaDeg: 0 }],
        note: '사용자가 확정한 풍향입니다 — 다른 채널은 참고용.'
      };
    }

    /* 3) 가중 원형 평균 (Mardia & Jupp 2000) */
    var sx = 0, sy = 0, sumW = 0;
    contrib.forEach(function (c) {
      var r = Geo.toRad(c.windDir);
      sx += c.weight * Math.cos(r);
      sy += c.weight * Math.sin(r);
      sumW += c.weight;
    });
    if (sumW <= 0) return null;
    var mean = norm360(Geo.toDeg(Math.atan2(sy, sx)));
    var Rbar = Math.sqrt(sx * sx + sy * sy) / sumW;
    var spreadRad = Math.sqrt(Math.max(0, -2 * Math.log(Math.max(Rbar, 1e-6))));
    var spreadDeg = Geo.toDeg(spreadRad);

    /* 4) 신뢰도 환산 — spreadDeg 기반 (가장 해석 가능한 척도).
       Mardia & Jupp 2000 ch.2: spread = √(-2·log R̄) [rad], 풍향 도메인은
       각도 단위가 직관적. 일반 sailing/foiling 풍향 측정 표준:
         · spread < 10° (R̄ > 0.985)  → '높음' (cross-channel 매우 일치)
         · spread < 25° (R̄ > 0.910)  → '보통' (실용 정확도)
         · spread ≥ 25°               → '낮음' (사용자 직접 입력 권장) */
    var maxInputConf = contrib.reduce(function (acc, c) {
      var rank = WIND_CONF_RANK[c.confidence] || 0;
      return rank > acc ? rank : acc;
    }, 0);
    var combinedConf;
    if (spreadDeg < 10 && contrib.length >= 2) {
      combinedConf = '높음';
    } else if (spreadDeg < 25) {
      combinedConf = '보통';
    } else {
      combinedConf = '낮음';
    }
    /* Clamp — 모든 입력 채널이 '낮음' 이면 통합도 '낮음' 으로 (과신 방지).
       입력이 모두 낮음 = 같은 약점 공유 가능 (예: reaching 일색 세션). */
    if (maxInputConf <= 1 && combinedConf !== '낮음') combinedConf = '낮음';

    /* 5) 각 채널의 통합 결과 대비 편차 */
    var channels = contrib.map(function (c) {
      var d = Math.abs(Geo.angleDiff(mean, c.windDir));
      return {
        id: c.id, weight: Math.round((c.weight / sumW) * 1000) / 1000,
        deltaDeg: Math.round(d * 10) / 10, confidence: c.confidence
      };
    });

    /* 6) 자연어 사유 (한국어, UX Researcher 협업 영역) */
    var ids = contrib.map(function (c) { return c.id; }).join(', ');
    var note;
    if (combinedConf === '높음') {
      note = contrib.length + '개 채널 (' + ids + ') 이 ±' +
        Math.round(spreadDeg) + '° 안으로 일치합니다 — 매우 신뢰 가능.';
    } else if (combinedConf === '보통') {
      note = contrib.length + '개 채널 (' + ids + ') 결합 — spread ±' +
        Math.round(spreadDeg) + '°. 다른 소스와 대조 권장.';
    } else {
      note = '채널 disagreement 또는 입력 신뢰도 낮음 (spread ±' +
        Math.round(spreadDeg) + '°). 사용자 직접 입력 권장.';
    }

    return {
      windDir: Math.round(mean * 10) / 10,
      confidence: combinedConf,
      R: Math.round(Rbar * 1000) / 1000,
      spreadDeg: Math.round(spreadDeg * 10) / 10,
      contributing: contrib.map(function (c) { return c.id; }),
      channels: channels,
      note: note
    };
  }

  /* 회전(택킹·자이빙) 세일링 퍼포먼스 스코어 0~100 — Danny 검토 §issue-2.
     "택킹 진입 직전 VMG 대비 탈출 후 재정비된 VMG" — 회전이 골 방향
     (풍상/풍하) VMG 를 얼마나 보존했는지(로스/게인)로 점수화한다:
       · SPS = 탈출 VMG ÷ 진입 VMG × 100  (게인=회복률, 0~100 클램프)
       · 로스(상실폭) = 100 − SPS,  게인(회복률) = SPS — 한 비교의 양면.
         탈출 VMG ≥ 진입 VMG (완전 보존/초과) → 100.
     SOG 폴백 (useVmg=false 또는 VMG 산출 불가) — 풍향 미설정·풍향 자동
     추정 신뢰도 '낮음' 등으로 VMG 가 노이즈에 흔들릴 때는, 풍향에
     의존하지 않는 SOG 손실+회복 시간 기반 점수를 쓴다. SOG 점수는
     0/100 으로 튀지 않고 매끄럽게 분포한다.
     · useVmg : VMG 기반 산출을 신뢰할 수 있는지 (false 면 SOG 폴백 강제).
     코치 분석의 베스트/워스트 판정에 사용. */
  function maneuverEfficiency(m, useVmg) {
    if (useVmg !== false && m.vmgGainPct != null) return Math.round(m.vmgGainPct);
    /* --- SOG 폴백 (VMG 불가 또는 풍향 신뢰도 낮음) --- */
    var lossSc = Geo.clamp(100 - m.lossPct * 1.4, 0, 100);   // 손실 0%→100, 70%→2
    var rec = m.recoverySec == null ? 25 : m.recoverySec;     // 회복 못하면 패널티
    var recSc = Geo.clamp(100 - rec * 4, 0, 100);             // 0s→100, 25s→0
    return Math.round(lossSc * 0.65 + recSc * 0.35);
  }

  /* 택킹·자이빙 기술 요약 — 종류(tack/gybe) × 진입 택(all/P/S)별로
     효율의 전체평균·상위50%·상위20% + 평균 손실·평균 회복.
     상위 n% 는 효율이 높은 회전 순(개수 기준, 최소 1개).
     손실은 효율 점수와 같은 기준의 lossDisplayPct 를 집계한다 —
     표의 손실 열·효율 점수가 같은 척도를 보도록 (Danny 검토 §issue-2). */
  function dispLoss(m) {
    return (m.lossDisplayPct != null) ? m.lossDisplayPct : m.lossPct;
  }
  function maneuverGroupStats(maneuvers) {
    function agg(list) {
      if (!list.length) {
        return { count: 0, effAvg: null, effSd: null, effTop50: null,
                 effTop20: null, lossAvg: null, lossSd: null, recAvg: null };
      }
      var effs = list.map(function (m) { return m.efficiency; })
                     .sort(function (a, b) { return b - a; });   // 효율 높은 순
      function topMean(frac) {
        var n = Math.max(1, Math.round(effs.length * frac)), s = 0;
        for (var k = 0; k < n; k++) s += effs[k];
        return s / n;
      }
      var effSum = 0, lossSum = 0, lossN = 0, recSum = 0, recN = 0;
      list.forEach(function (m) {
        effSum += m.efficiency;
        if (dispLoss(m) != null) { lossSum += dispLoss(m); lossN++; }
        if (m.recoverySec != null) { recSum += m.recoverySec; recN++; }
      });
      /* 효율·손실 표준편차(모표준편차 ÷N) — 표의 "평균 ± 표준편차" 표기용.
         ÷N 은 회전 상세 비교 표·차트 ±1σ 밴드와 같은 정의로 통일. */
      var effAvg = effSum / list.length, effSq = 0;
      list.forEach(function (m) {
        effSq += (m.efficiency - effAvg) * (m.efficiency - effAvg);
      });
      var effSd = Math.sqrt(effSq / list.length);
      var lossAvg = lossN ? lossSum / lossN : null, lossSd = null;
      if (lossN) {
        var lossSq = 0;
        list.forEach(function (m) {
          var lv = dispLoss(m);
          if (lv != null) lossSq += (lv - lossAvg) * (lv - lossAvg);
        });
        lossSd = Math.sqrt(lossSq / lossN);
      }
      return {
        count: list.length,
        effAvg: effAvg, effSd: effSd,
        effTop50: topMean(0.5),
        effTop20: topMean(0.2),
        lossAvg: lossAvg, lossSd: lossSd,
        recAvg: recN ? recSum / recN : null
      };
    }
    var out = {};
    ['tack', 'gybe'].forEach(function (t) {
      var ofType = maneuvers.filter(function (m) { return m.type === t; });
      out[t] = {
        all: agg(ofType),
        P: agg(ofType.filter(function (m) { return m.side === 'P'; })),
        S: agg(ofType.filter(function (m) { return m.side === 'S'; }))
      };
    });
    return out;
  }

  /* ============================================================
   * 9-B) 세션 구간 편집 — [fromSec, toSec] 구간만 잘라낸 새 세션
   * 원본 세션을 변형하지 않는 순수 함수. 잘라낸 구간은 누적거리·
   * 시각을 0 부터 다시 매겨 독립 세션처럼 분석된다.
   * ============================================================ */
  function cropSession(session, fromSec, toSec) {
    if (!session.hasTime) {
      throw new Error('시각 정보가 없는 세션은 구간 편집을 할 수 없습니다.');
    }
    var S = session.samples;
    var iStart = -1, iEnd = -1;
    for (var i = 0; i < S.length; i++) {
      if (iStart < 0 && S[i].t >= fromSec) iStart = i;
      if (S[i].t <= toSec) iEnd = i;
    }
    if (iStart < 0 || iEnd < 0 || iEnd - iStart < 2) {
      throw new Error('선택한 구간이 너무 짧습니다.');
    }
    var t0 = S[iStart].t, d0 = S[iStart].cumDist;
    var crop = {
      cfg: session.cfg, hasTime: true, speedSource: session.speedSource,
      trackName: session.trackName, samples: [], legs: [],
      startEpoch: (session.startEpoch || 0) + Math.round(t0) * 1000,
      cropped: { fromSec: fromSec, toSec: toSec, durationSec: toSec - fromSec }
    };
    for (var i = iStart; i <= iEnd; i++) {
      var s = S[i];
      crop.samples.push({
        t: s.t - t0, lat: s.lat, lng: s.lng, ele: s.ele,
        speed: s.speed, heading: s.heading, hr: (s.hr != null ? s.hr : null),
        cumDist: s.cumDist - d0, segDist: (i === iStart) ? 0 : s.segDist,
        speedDevice: s.speedDevice, speedRaw: s.speedRaw,
        speedDerived: s.speedDerived, headingRaw: s.headingRaw
      });
    }
    session.legs.forEach(function (leg) {
      var a = Math.max(leg.start, iStart), b = Math.min(leg.end, iEnd);
      if (b > a) crop.legs.push({ start: a - iStart, end: b - iStart });
    });
    if (!crop.legs.length) crop.legs.push({ start: 0, end: crop.samples.length - 1 });

    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    crop.samples.forEach(function (s) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lng < minLng) minLng = s.lng;
      if (s.lng > maxLng) maxLng = s.lng;
    });
    crop.bounds = { minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng };
    crop.totalDistanceM = crop.samples[crop.samples.length - 1].cumDist;
    crop.pointCount = crop.samples.length;
    flagHr(crop);
    return crop;
  }

  /* ============================================================
   * 9-C) 트랙 편집 적용 — trim(앞뒤 잘라내기) + 제외 구간
   * editState = { trimStart, trimEnd, excludeRanges:[{from,to}] }  (단위: 초)
   * 원본 세션을 변형하지 않고, 편집이 적용된 새 세션을 만든다.
   * 제외 구간은 leg 분리로 처리되어 회전·속도 분석이 그 구간을 건너뛴다.
   * ============================================================ */
  function applyEdits(session, editState) {
    if (!session.hasTime) {
      throw new Error('시각 정보가 없는 세션은 편집할 수 없습니다.');
    }
    var e = editState || {};
    var S = session.samples;
    var fullStart = S[0].t, fullEnd = S[S.length - 1].t;
    var trimStart = (e.trimStart != null) ? e.trimStart : fullStart;
    var trimEnd = (e.trimEnd != null) ? e.trimEnd : fullEnd;
    var excludes = e.excludeRanges || [];

    function isKept(t) {
      if (t < trimStart - 1e-6 || t > trimEnd + 1e-6) return false;
      for (var k = 0; k < excludes.length; k++) {
        if (t >= excludes[k].from && t <= excludes[k].to) return false;
      }
      return true;
    }
    var keptIdx = [];
    for (var i = 0; i < S.length; i++) if (isKept(S[i].t)) keptIdx.push(i);
    if (keptIdx.length < 3) {
      throw new Error('편집 결과 남는 구간이 너무 짧습니다.');
    }

    var t0 = S[keptIdx[0]].t;
    var hasEdit = (e.trimStart != null) || (e.trimEnd != null) ||
                  (excludes && excludes.length > 0);
    var ed = {
      cfg: session.cfg, hasTime: true, speedSource: session.speedSource,
      trackName: session.trackName, samples: [], legs: [],
      startEpoch: (session.startEpoch || 0) + Math.round(t0) * 1000,
      edited: hasEdit,
      editApplied: { trimStart: trimStart, trimEnd: trimEnd, excludeRanges: excludes.slice() }
    };
    var cum = 0, legStart = 0;
    for (var k = 0; k < keptIdx.length; k++) {
      var idx = keptIdx[k], s = S[idx];
      var contiguous = (k > 0 && keptIdx[k - 1] === idx - 1);
      if (k > 0 && !contiguous) {
        ed.legs.push({ start: legStart, end: k - 1 });
        legStart = k;
      }
      var segDist = (k > 0 && contiguous) ? (s.segDist || 0) : 0;
      cum += segDist;
      var es = {
        t: s.t - t0, lat: s.lat, lng: s.lng, ele: s.ele,
        speed: s.speed, heading: s.heading, hr: (s.hr != null ? s.hr : null),
        cumDist: cum, segDist: segDist,
        speedDevice: s.speedDevice, speedRaw: s.speedRaw,
        speedDerived: s.speedDerived, headingRaw: s.headingRaw
      };
      /* 자세(heel·pitch) 데이터 보존 — .vkx 세션이 트림·구간제외로
         편집되어도 원본 자세값을 그대로 옮긴다. 값이 있을 때만 키를
         부여해 'heel 키 없음 = 자세 데이터 없음' 규약을 지킨다.
         (편집 후에도 바이올린 분포·리플레이 Heel/Pitch 그래프가
         동작하도록 — 전량 사용·다운샘플 금지 원칙.) */
      if (s.heel != null) es.heel = s.heel;
      if (s.pitch != null) es.pitch = s.pitch;
      ed.samples.push(es);
    }
    ed.legs.push({ start: legStart, end: ed.samples.length - 1 });

    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    ed.samples.forEach(function (s) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lng < minLng) minLng = s.lng;
      if (s.lng > maxLng) maxLng = s.lng;
    });
    ed.bounds = { minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng };
    ed.totalDistanceM = ed.samples[ed.samples.length - 1].cumDist;
    ed.pointCount = ed.samples.length;
    flagHr(ed);
    return ed;
  }

  /* ============================================================
   * 9-D) 심박수(HR) 분석 — 추이 · 존 분포 · 퍼포먼스 대비 심박 효율
   *
   * Waterspeed 등 GPX 의 trkpt extensions 에 담긴 포인트별 심박수
   * (bpm)를 분석한다. .vkx 등 HR 이 없는 세션은 hasHR:false 만
   * 담아 반환하며, UI 는 이 경우 심박수 섹션을 통째로 숨긴다.
   * 모든 HR 데이터를 전량 사용한다 — 다운샘플·캡 없음.
   * ============================================================ */

  /* 심박 존(zone) 모델 — 최대 심박수 대비 비율(%HRmax) 기준 5-존.
     워터스포츠·지구성 코칭에서 널리 쓰는 표준 구분이며, 각 존의
     이름·범위·의미를 함께 담아 UI 가 "숫자만"이 아니라 "무슨 뜻인지"
     를 보여줄 수 있게 한다 (자기설명적 지표 원칙). */
  var HR_ZONE_MODEL = [
    { key: 'z1', name: '회복',   loPct: 0.50, hiPct: 0.60,
      desc: '아주 가벼운 강도 — 워밍업·휴식·능동 회복' },
    { key: 'z2', name: '유산소', loPct: 0.60, hiPct: 0.70,
      desc: '편하게 대화 가능한 지구성 — 지방 연소·기초 체력' },
    { key: 'z3', name: '템포',   loPct: 0.70, hiPct: 0.80,
      desc: '중강도 — 심폐 지구력이 늘어나는 구간' },
    { key: 'z4', name: '역치',   loPct: 0.80, hiPct: 0.90,
      desc: '젖산 역치 부근 — 길게 버티기 힘든 강도' },
    { key: 'z5', name: '무산소', loPct: 0.90, hiPct: 1.00,
      desc: '최대에 가까운 강도 — 짧게만 지속 가능' }
  ];

  /* 퍼포먼스 대비 심박 효율 — 같은 속도를 더 낮은 심박으로 내는지를
     본다(유산소 효율, 코치 관점의 핵심 지표).
       · scatter : 주행(이동 중) 샘플의 (속도·심박) 점 — 전량
       · trend   : 2 kt 구간별 심박 중앙값 — 속도→심박 관계 추세
       · index   : 효율 지수 = 평균속도(kt) ÷ 평균심박(bpm) × 100
                   (높을수록 같은 속도를 낮은 심박으로 = 효율적)
       · drift   : 심박 드리프트 — 활주(포일링/플레이닝) 중 심박이
                   세션 후반에 얼마나 올랐는지(%). 활주 속도 구간만
                   비교해 속도 변화가 아닌 순수 심혈관 드리프트를
                   본다. 낮을수록 같은 강도를 잘 유지한 것. */
  function computeHrEfficiency(session) {
    var S = session.samples, cfg = session.cfg;
    var KTc = Geo.MS_TO_KNOTS;
    var movingMs = cfg.movingSpeedKt / KTc;
    var res = { available: false, scatter: [], trend: [], drift: { available: false } };
    if (!session.hasTime) return res;

    var pts = [];   // 주행 중(이동 속도 이상) + 심박 보유 샘플 — 전량
    session.legs.forEach(function (leg) {
      for (var i = leg.start; i <= leg.end; i++) {
        if (S[i].hr == null) continue;
        if (S[i].speed < movingMs) continue;
        pts.push({ speedMs: S[i].speed, hr: S[i].hr, t: S[i].t });
      }
    });
    if (pts.length < 12) return res;     // 표본 부족 — 효율 분석 생략
    res.available = true;
    res.sampleCount = pts.length;
    res.scatter = pts.map(function (p) {
      return { speedMs: p.speedMs, hr: p.hr };
    });

    var sumHr = 0, sumSp = 0;
    pts.forEach(function (p) { sumHr += p.hr; sumSp += p.speedMs; });
    res.avgHr = sumHr / pts.length;
    res.avgSpeedMs = sumSp / pts.length;
    var avgSpeedKt = res.avgSpeedMs * KTc;
    res.index = res.avgHr > 0 ? (avgSpeedKt / res.avgHr * 100) : null;

    /* 속도 구간(2 kt)별 심박 중앙값 추세 — 표본 5개 이상 구간만 */
    var binKt = 2, byBin = {};
    pts.forEach(function (p) {
      var b = Math.floor((p.speedMs * KTc) / binKt);
      (byBin[b] || (byBin[b] = [])).push(p.hr);
    });
    Object.keys(byBin).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (b) {
        var arr = byBin[b].slice().sort(function (x, y) { return x - y; });
        if (arr.length < 5) return;
        var mid = arr.length >> 1;
        var med = (arr.length % 2) ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        res.trend.push({
          ktLo: b * binKt, ktHi: (b + 1) * binKt,
          midMs: ((b + 0.5) * binKt) / KTc,
          medianHr: med, n: arr.length
        });
      });

    /* 심박 드리프트 — 활주(포일링/플레이닝) 속도 이상 샘플만 추려,
       활주 노력의 전반 절반과 후반 절반의 평균 심박을 비교한다.
       활주 구간끼리만 비교하므로 속도가 느려진 탓이 아닌 순수 심박
       상승(피로·탈수 등 cardiac drift)을 본다. 활주가 세션 내내
       고르지 않을 수 있어, 시간이 아니라 활주 샘플 '개수'의 중앙을
       기준으로 절반을 나눈다(전반 노력 vs 후반 노력). */
    var activeMs = cfg.activeSpeedKt / KTc;
    var act = pts.filter(function (p) { return p.speedMs >= activeMs; });
    if (act.length >= 60) {
      var half = act.length >> 1;
      var a1 = { hr: 0, n: 0 }, a2 = { hr: 0, n: 0 };
      for (var ai = 0; ai < act.length; ai++) {
        var h = (ai < half) ? a1 : a2;
        h.hr += act[ai].hr; h.n++;
      }
      var ah1 = a1.hr / a1.n, ah2 = a2.hr / a2.n;
      res.drift = {
        available: true,
        activeSampleCount: act.length,
        firstHr: ah1, secondHr: ah2,
        driftBpm: ah2 - ah1,
        driftPct: ah1 > 0 ? ((ah2 - ah1) / ah1 * 100) : null
      };
    }
    return res;
  }

  /* 심박 존 시간 분포 — maxHr(최대 심박수, bpm) 기준으로 각 존에
     머문 시간을 시간가중으로 집계한다.
       @param maxHr  사용자 입력 최대 심박수. null 이면 세션 관측
                     최대값을 기본값으로 쓴다.
     반환: { hasHR, maxHrUsed, maxHrSource, zones:[...], belowSec,
             totalSec, peakKey }.
     각 zone 은 이름·%범위·bpm범위·머문 시간(초)을 함께 담는다. */
  function computeHrZones(session, maxHr) {
    var S = session.samples;
    var out = { hasHR: !!session.hasHR, maxHrUsed: null, maxHrSource: null,
                zones: [], belowSec: 0, totalSec: 0, peakKey: null };
    if (!session.hasTime || !session.hasHR) return out;

    var obs = 0;
    for (var i = 0; i < S.length; i++) {
      if (S[i].hr != null && S[i].hr > obs) obs = S[i].hr;
    }
    var mx = (maxHr != null && isFinite(maxHr) && maxHr >= 100 && maxHr <= 240)
      ? maxHr : null;
    out.maxHrSource = mx != null ? 'user' : 'observed';
    if (mx == null) mx = obs;
    if (!(mx > 0)) return out;
    out.maxHrUsed = Math.round(mx);

    var zones = HR_ZONE_MODEL.map(function (z) {
      return {
        key: z.key, name: z.name, desc: z.desc,
        loPct: z.loPct, hiPct: z.hiPct,
        loBpm: Math.round(z.loPct * mx), hiBpm: Math.round(z.hiPct * mx),
        seconds: 0
      };
    });

    var below = 0, total = 0;
    /* 시간가중 — 각 샘플 간격(dt)을, 그 구간 평균 심박이 속한 존에
       배분한다(computeHistogram 과 같은 방식). */
    session.legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        if (S[i].hr == null || S[i - 1].hr == null) continue;
        var dt = S[i].t - S[i - 1].t;
        if (!(dt > 0)) continue;
        total += dt;
        var pct = ((S[i].hr + S[i - 1].hr) / 2) / mx;
        if (pct < zones[0].loPct) { below += dt; continue; }
        var placed = false;
        for (var z = 0; z < zones.length; z++) {
          var top = (z === zones.length - 1) ? Infinity : zones[z].hiPct;
          if (pct < top) { zones[z].seconds += dt; placed = true; break; }
        }
        if (!placed) zones[zones.length - 1].seconds += dt;
      }
    });
    out.zones = zones;
    out.belowSec = below;
    out.totalSec = total;

    /* 가장 오래 머문 존(휴식 포함) — 헤드라인용 */
    var peakKey = 'rest', peakSec = below;
    zones.forEach(function (z) {
      if (z.seconds > peakSec) { peakSec = z.seconds; peakKey = z.key; }
    });
    out.peakKey = peakKey;
    return out;
  }

  /* 심박수 분석 묶음 — 추이 시계열 · 요약 통계 · 효율.
     존 분포는 사용자 입력 maxHr 에 의존하므로 computeHrZones 로
     분리(입력이 바뀔 때만 다시 계산). 이 함수의 결과는 analyzeSession
     이 항상 호출하며, HR 이 없으면 { hasHR:false } 만 반환한다. */
  function analyzeHr(session) {
    var S = session.samples;
    var out = { hasHR: false };
    if (!session.hasTime || !session.hasHR || !S || S.length < 2) return out;

    var series = [];               // {t, hr} — 추이 차트용, 전량
    var hrItems = [];              // {hr, dt} — 시간가중 구간(상위 50%/20%) 평균용
    var n = 0, minBpm = Infinity, maxBpm = -Infinity;
    var totalSamples = 0;
    var sumW = 0, sumWHr = 0;      // 시간가중 평균용(사다리꼴 적분)
    session.legs.forEach(function (leg) {
      for (var i = leg.start; i <= leg.end; i++) {
        totalSamples++;
        var hr = S[i].hr;
        if (hr == null) continue;
        n++;
        if (hr < minBpm) minBpm = hr;
        if (hr > maxBpm) maxBpm = hr;
        series.push({ t: S[i].t, hr: hr });
        if (i > leg.start && S[i - 1].hr != null) {
          var dt = S[i].t - S[i - 1].t;
          if (dt > 0) {
            sumW += dt; sumWHr += dt * (hr + S[i - 1].hr) / 2;
            hrItems.push({ hr: hr, dt: dt });
          }
        }
      }
    });
    if (n < 2) return out;

    out.hasHR = true;
    out.count = n;
    out.minBpm = minBpm;
    out.maxBpm = maxBpm;
    out.observedMaxBpm = maxBpm;
    /* 평균 심박 — 시간가중(샘플 간격으로 가중). 가중합이 없으면
       (간격 정보 부족) 단순 평균으로 폴백. */
    if (sumW > 0) {
      out.avgBpm = sumWHr / sumW;
    } else {
      var s = 0;
      series.forEach(function (p) { s += p.hr; });
      out.avgBpm = s / series.length;
    }
    out.coveragePct = totalSamples > 0 ? (n / totalSamples * 100) : 0;
    /* 기록률 분모 — 분석 구간(leg) 안의 전체 GPS 포인트 수. 기록률은
       '이 중 심박이 함께 잡힌 비율' 이며, leg 사이의 시간 공백(장치
       기록 중단)과는 무관하다 — 요약 타일 문구가 이를 정확히 쓰도록
       분모를 그대로 노출한다 (Danny 2026-05-23 §D). */
    out.recordedCount = totalSamples;
    out.series = series;
    /* 상위 50%/20% 구간 평균 — 통계 패널이 쓴다. 심박이 높은 구간의
       시간가중 평균이라 단일 순간 최고와 달리 노이즈에 강하다.
       SOG·VMG·풍각과 같은 공용 computeTierMeans 로 산출한다. */
    out.tiers = hrItems.length ? computeTierMeans(hrItems, 'hr') : null;
    /* 기본 최대 심박수 = 세션 관측 최대값. 사용자가 더 정확한 값을
       입력하면 computeHrZones 에 그 값을 넘겨 덮어쓴다. */
    out.defaultMaxHr = maxBpm;
    out.efficiency = computeHrEfficiency(session);
    return out;
  }

  /* ============================================================
   * 9-D-2) TRIMP (Training Impulse) — Banister 1991
   *
   * 본 세션의 training impulse (운동 부하) 를 한 수로 압축한다. duration
   * 만 보거나 평균 HR 만 보는 단순 모델은 고강도 부하의 비선형 증폭을
   * 잡지 못한다. Banister 의 HRR-weighted exponential 모델이 표준.
   *
   * 공식:
   *   HRR = (avg_HR − rest_HR) / (max_HR − rest_HR)   ∈ [0, 1]
   *   y_male   = 0.64 × exp(1.92 × HRR)
   *   y_female = 0.86 × exp(1.67 × HRR)
   *   TRIMP    = duration_min × HRR × y
   *
   * 입력:
   *   session  — An.normalizeSession() / analyzeHr() 산출 객체 (hasHR 필수)
   *   profile  — { restHr, maxHr, sex } (sex: 'male'|'female', default 'male')
   *     · maxHr 미입력 시 Tanaka 공식 (208 − 0.7·age) 권장 — 그것도 없으면
   *       observed maxBpm 으로 fallback (보수적 추정)
   *
   * 반환:
   *   { hasTRIMP: true, trimp, durationMin, avgHrr, weighting, sex }
   *   { hasTRIMP: false, reason }   — HR 없음 / restHr 없음 / maxHr <= restHr
   *
   * 예외 처리:
   *   · avg_HR < rest_HR (입력 오류) → HRR clamp 0 → TRIMP = 0
   *   · avg_HR > max_HR (max 추정 부정확) → HRR clamp 1
   *   · duration <= 0 → TRIMP = 0
   *
   * References — Training Impulse 표준:
   *   · Banister, E.W. 1991. "Modeling Elite Athletic Performance". In
   *     *Physiological Testing of the High-Performance Athlete* 2e (pp. 403-424).
   *     Human Kinetics. ISBN 978-0-87322-307-5.
   *   · Banister, E.W. & Calvert, T.W. 1980. "Planning for future performance".
   *     Can J Appl Sport Sci 5(3):170-176. PMID 7449608 (TRIMP 1차 publication).
   *   · Morton, R.H., Fitz-Clarke, J.R., Banister, E.W. 1990. "Modeling human
   *     performance in running". J Appl Physiol 69(3):1171-1177.
   *     doi:10.1152/jappl.1990.69.3.1171 (fitness/fatigue impulse-response model).
   *   · Tanaka, H., Monahan, K.D., Seals, D.R. 2001. "Age-predicted maximal heart
   *     rate revisited". J Am Coll Cardiol 37(1):153-156.
   *     doi:10.1016/S0735-1097(00)01054-8 (max_HR = 208 − 0.7·age, optional fallback).
   * ============================================================ */
  function computeTRIMP(session, profile) {
    var out = { hasTRIMP: false };
    if (!session || !session.hasTime || !session.hasHR) {
      out.reason = 'no_hr'; return out;
    }
    if (!profile || !(profile.restHr > 0)) {
      out.reason = 'no_rest_hr'; return out;
    }
    var restHr = Number(profile.restHr);
    var maxHr = (profile.maxHr > 0) ? Number(profile.maxHr) : null;

    /* analyzeHr 가 산출한 시간가중 avgBpm 을 우선 사용 (single source of truth).
       없으면 직접 계산 (HR series 시간가중). */
    var hr = analyzeHr(session);
    if (!hr.hasHR) { out.reason = 'no_hr'; return out; }
    var avgBpm = hr.avgBpm;
    /* 분석 구간 (legs) 의 총 시간 — paused / leg 사이 공백 제외 */
    var totalSec = 0;
    var S = session.samples;
    session.legs.forEach(function (leg) {
      if (leg.end > leg.start && S[leg.start] && S[leg.end]) {
        totalSec += S[leg.end].t - S[leg.start].t;
      }
    });
    if (totalSec <= 0) { out.reason = 'no_duration'; return out; }
    var durationMin = totalSec / 60;

    /* maxHr 미입력 — observed maxBpm fallback (보수적, 사용자 입력 권장) */
    if (maxHr == null || maxHr <= restHr) {
      maxHr = hr.maxBpm;
      out.maxHrSource = 'observed';
    } else {
      out.maxHrSource = 'profile';
    }
    if (!(maxHr > restHr)) { out.reason = 'no_max_hr'; return out; }

    /* HRR clamp [0, 1] — 데이터 오류 (avg < rest 또는 avg > max) 보호 */
    var hrr = (avgBpm - restHr) / (maxHr - restHr);
    if (hrr < 0) hrr = 0;
    if (hrr > 1) hrr = 1;

    /* Banister gender-specific weighting */
    var sex = (profile.sex === 'female') ? 'female' : 'male';
    var weighting = (sex === 'female')
      ? 0.86 * Math.exp(1.67 * hrr)
      : 0.64 * Math.exp(1.92 * hrr);
    var trimp = durationMin * hrr * weighting;

    out.hasTRIMP = true;
    out.trimp = Math.round(trimp * 10) / 10;
    out.durationMin = Math.round(durationMin * 10) / 10;
    out.avgHrr = Math.round(hrr * 1000) / 1000;
    out.avgBpm = Math.round(avgBpm * 10) / 10;
    out.weighting = Math.round(weighting * 100) / 100;
    out.sex = sex;
    out.restHr = restHr;
    out.maxHr = maxHr;
    return out;
  }

  /* ============================================================
   * 9-D-2b) computeWorkload — 3-tier cross-modal workload 산출
   *
   * Cross-modal Training System (sports_science_cross_modal_training_system.md §2)
   * 의 핵심 entry point. 입력 가용성에 따라 자동 분기, 단일 AU output:
   *   · Tier 1 (HR-based): Banister TRIMP — computeTRIMP 호출
   *   · Tier 2 (MET-based): MET × duration × bodyMass × 0.2 — RDSportMET 사용
   *   · Tier 3 (sRPE):     RPE × duration × 0.5 — Foster 2001
   *
   * 모든 tier 의 AU 는 Banister scale 로 정렬 — CTL/ATL/TSB/ACWR 입력 가능.
   *
   * 입력:
   *   session  — Phase 1 normalizeSession 결과, 또는 land workout pseudo-session:
   *     { hasHR: true, hasTime: true, ... }       (sea session 표준)
   *     { sportKey: 'run_easy', durationMin: 30 } (land workout, MET 기반)
   *     { rpe: 7, durationMin: 45 }               (land or sea, sRPE 기반)
   *   profile  — { restHr, maxHr, sex, weightKg } — Banister + MET 정규화에 사용
   *   opts     — { forceTier?: 'banister'|'met'|'srpe', metFactor?: 0.2, srpeFactor?: 0.5 }
   *
   * 반환:
   *   { AU, method, details }
   *   { AU: null, method: 'none', reason } if 모든 tier 부족
   *
   * 같은 scale 가설 (Phase 1 baseline, Phase 2 multi-rider 재calibration):
   *   30분 z2 run (MET 6, 70kg) → MET_AU = 6 × 30 × (70/75) × 0.2 = 33.6
   *   같은 라이더의 HR-based Banister (HRR 0.5, 남): 30 × 0.5 × 1.67 = 25.05
   *   factor 0.2 는 두 scale 의 1차 정렬 — Phase 2 multi-rider data 로 보정.
   *
   * References:
   *   · Banister 1991 (ISBN 978-0-87322-307-5) — Tier 1
   *   · Ainsworth, B.E. et al. 2011. "2011 Compendium of Physical Activities".
   *     Med Sci Sports Exerc 43(8):1575-1581. doi:10.1249/MSS.0b013e31821ece12 — Tier 2
   *   · Foster, C. et al. 2001. "A new approach to monitoring exercise training".
   *     J Strength Cond Res 15(1):109-115. PMID 11708692 — Tier 3
   * ============================================================ */
  var MET_TO_AU_FACTOR = 0.2;   /* MET-based AU 정규화 — Phase 2 재calibration */
  var SRPE_TO_AU_FACTOR = 0.5;  /* sRPE × duration → AU 정규화 */
  var BODY_MASS_REFERENCE = 75; /* kg — MET 산식의 mass 정규화 기준 */

  function computeWorkload(session, profile, opts) {
    opts = opts || {};
    profile = profile || {};
    var forceTier = opts.forceTier || null;

    /* === Tier 1 — Banister TRIMP (HR + sex + rest/max HR) === */
    if ((!forceTier || forceTier === 'banister') &&
        session && session.hasTime && session.hasHR &&
        profile.restHr > 0) {
      var t = computeTRIMP(session, profile);
      if (t.hasTRIMP) {
        return {
          AU: t.trimp,
          method: 'banister',
          tier: 1,
          details: t
        };
      }
    }

    /* === Tier 2 — MET-based (sport classification + duration) === */
    if ((!forceTier || forceTier === 'met') &&
        session && session.sportKey && session.durationMin > 0) {
      var SportMET = (typeof require !== 'undefined' && typeof module !== 'undefined')
        ? require('./sport-met.js')
        : global.RDSportMET;
      if (SportMET && SportMET.getMET) {
        var met = SportMET.getMET(session.sportKey);
        if (met != null && met > 0) {
          var mass = (profile.weightKg > 0) ? profile.weightKg : BODY_MASS_REFERENCE;
          var factor = (opts.metFactor > 0) ? opts.metFactor : MET_TO_AU_FACTOR;
          var AU = met * session.durationMin * (mass / BODY_MASS_REFERENCE) * factor;
          return {
            AU: Math.round(AU * 10) / 10,
            method: 'met',
            tier: 2,
            details: {
              met: met,
              sportKey: session.sportKey,
              durationMin: session.durationMin,
              weightKg: mass,
              category: SportMET.getSport(session.sportKey).category,
              intensityZone: SportMET.intensityZone(session.sportKey),
              carryover: SportMET.getCarryover(session.sportKey),
              factor: factor
            }
          };
        }
      }
    }

    /* === Tier 3 — sRPE (subjective) === */
    if ((!forceTier || forceTier === 'srpe') &&
        session && session.rpe > 0 && session.rpe <= 10 &&
        session.durationMin > 0) {
      var factor = (opts.srpeFactor > 0) ? opts.srpeFactor : SRPE_TO_AU_FACTOR;
      var AU = session.rpe * session.durationMin * factor;
      return {
        AU: Math.round(AU * 10) / 10,
        method: 'srpe',
        tier: 3,
        details: {
          rpe: session.rpe,
          durationMin: session.durationMin,
          factor: factor,
          category: rpeCategoryLabel(session.rpe)
        }
      };
    }

    return {
      AU: null,
      method: 'none',
      tier: null,
      reason: 'insufficient_input'
    };
  }

  /* sRPE category — Foster 2001 5-zone interpretation */
  function rpeCategoryLabel(rpe) {
    if (rpe <= 2) return 'recovery';
    if (rpe <= 4) return 'aerobic';
    if (rpe <= 6) return 'threshold';
    if (rpe <= 8) return 'vo2max';
    return 'sprint';
  }

  /* ============================================================
   * 9-D-2c) estimateRaceLoad — Race format 별 TRIMP 추정
   *
   * Event-Aware Periodization (sports_science_event_periodization_system.md §9-2).
   * RACE_FORMAT_LIBRARY (race-formats.js) lookup + skill·wind modifier 적용.
   *
   * 입력:
   *   formatKey — 'slalom_medium' 등 RACE_FORMAT_LIBRARY key
   *   athlete   — { skill: '중급', weightKg: 70 }
   *   wind      — 'light'|'medium'|'strong'|'heavy' or numeric kt
   *
   * 출력:
   *   { format, durationMin, avgHr, maxHr, z5_percent, TRIMP_estimate, ...}
   *
   * References:
   *   · iQFOiL Class Official Paris 2024 — race format spec
   *   · IWSA WingFoil Racing — competition rules
   *   · Vogiatzis 2002/2004 — windsurfing HR physiology
   * ============================================================ */
  function estimateRaceLoad(formatKey, athlete, wind) {
    athlete = athlete || {};
    var RF = (typeof require !== 'undefined' && typeof module !== 'undefined')
      ? require('./race-formats.js')
      : global.RDRaceFormats;
    if (!RF || !RF.getFormat) {
      return { error: 'race_formats_unavailable' };
    }
    var fmt = RF.getFormat(formatKey);
    if (!fmt) {
      return { error: 'unknown_format', formatKey: formatKey };
    }
    var skillMod = RF.getSkillModifier(athlete.skill);
    var windMod = RF.getWindModifier(wind || 'medium');
    var trimp = fmt.TRIMP_baseline * skillMod.TRIMP_multiplier * windMod.TRIMP_multiplier;
    var avgHrAdjusted = fmt.avgHr + skillMod.hr_offset;
    return {
      format: formatKey,
      description: fmt.description,
      durationMin: fmt.duration_min,
      avgHr: avgHrAdjusted,
      maxHr: fmt.maxHr,
      z5_percent: fmt.z5_percent,
      TRIMP_estimate: Math.round(trimp * 10) / 10,
      TRIMP_baseline: fmt.TRIMP_baseline,
      skill: athlete.skill || '중급',
      skill_modifier: skillMod.TRIMP_multiplier,
      wind: typeof wind === 'string' ? wind : 'numeric→' + wind,
      wind_modifier: windMod.TRIMP_multiplier,
      ref: fmt.ref
    };
  }

  /* === estimateCompetitionLoad ===
     일별 race schedule 입력 → 일별 + total TRIMP 산출.
     입력: schedule = [{ day: 1, races: ['slalom_medium', 'slalom_medium', 'course_standard'], wind: 'medium' }, ...]
     출력: { days: [...], total_TRIMP } */
  function estimateCompetitionLoad(schedule, athlete) {
    if (!Array.isArray(schedule) || !schedule.length) {
      return { days: [], total_TRIMP: 0 };
    }
    var days = schedule.map(function (d) {
      var dayWind = d.wind || 'medium';
      var raceLoads = (d.races || []).map(function (fmt) {
        return estimateRaceLoad(fmt, athlete, dayWind);
      }).filter(function (r) { return !r.error; });
      var dayTRIMP = raceLoads.reduce(function (s, r) { return s + r.TRIMP_estimate; }, 0);
      var dayMin = raceLoads.reduce(function (s, r) { return s + r.durationMin; }, 0);
      return {
        day: d.day,
        race_count: raceLoads.length,
        race_minutes: dayMin,
        TRIMP: Math.round(dayTRIMP * 10) / 10,
        wind: dayWind,
        races: raceLoads
      };
    });
    var total = days.reduce(function (s, d) { return s + d.TRIMP; }, 0);
    return {
      days: days,
      total_TRIMP: Math.round(total * 10) / 10,
      total_days: days.length,
      total_races: days.reduce(function (s, d) { return s + d.race_count; }, 0),
      avg_daily_TRIMP: Math.round((total / days.length) * 10) / 10
    };
  }

  /* ============================================================
   * 9-D-3) HRV — RMSSD / SDNN / pNN50 (Task Force 1996)
   *
   * Heart Rate Variability time-domain metrics.
   *   RMSSD = √(mean of (RR_{i+1} − RR_i)²)   — 인접 RR 차이의 제곱평균제곱근.
   *          short-term parasympathetic (부교감) tone. 5 분 측정 표준.
   *   SDNN  = √(variance of all NN intervals)  — 전체 변동성. 24h 표준.
   *   pNN50 = % of consecutive RR diffs > 50ms — parasympathetic 보조 지표.
   *
   * 입력:
   *   rrIntervals — RR-interval 시리즈 (ms 단위, 정수 또는 부동소수).
   *     출처: Polar H10 / Movesense / Vakaros HRM 표준 BLE HRS 0x2A37 의
   *     RR-Interval Present flag 데이터. Apple Watch optical wrist HR 은
   *     motion artifact 로 inter-beat 정밀도 부족 → RR 직접 fetch 비권장.
   *
   * 반환:
   *   { hasHRV: true, rmssd, sdnn, pnn50, meanRR, count, durationSec }
   *   { hasHRV: false, reason }
   *
   * 데이터 cleanup:
   *   · RR < 300ms (HR > 200bpm) 또는 RR > 2000ms (HR < 30bpm) = artifact 제거
   *   · 인접 RR 차이 > 20% = ectopic beat = 차이 sequence 에서 제외 (RMSSD 보호)
   *   최소 n = 30 (5분 측정 보장) — 부족 시 hasHRV:false
   *
   * 측정 윈도 권장:
   *   · 단기 (5분) — 라이딩 직전/직후 안정 상태. Polar H10 + phone.
   *   · 장기 (24h) — 수면 중 (Whoop/Oura/Apple Watch 야간 자동).
   *   짧은 운동 중 측정 = sympathetic dominance → HRV ↓ 자연. 운동 중 단독 비교
   *   비권장. 본 함수는 시간 윈도 제약을 강제하지 않지만 caller 가 적절히 호출.
   *
   * References — HRV 표준의 결정판:
   *   · Task Force of the European Society of Cardiology and the North American
   *     Society of Pacing and Electrophysiology. 1996. "Heart rate variability:
   *     Standards of measurement, physiological interpretation and clinical use".
   *     European Heart Journal 17(3):354-381; Circulation 93(5):1043-1065.
   *     doi:10.1161/01.CIR.93.5.1043. PMID 8598068.
   *   · Sammito, S. et al. 2024. "Advances in heart rate variability signal
   *     analysis: ESC/EHRA/APHRS joint position statement". Europace 26(2):
   *     euae051. doi:10.1093/europace/euae051 (2024 갱신).
   *   · Plews, D.J. et al. 2013. "Training adaptation and heart rate variability
   *     in elite endurance athletes". Sports Med 43(9):773-781.
   *     doi:10.1007/s40279-013-0071-8 (athlete HRV monitoring protocol).
   * ============================================================ */
  var HRV_MIN_RR_MS = 300;       // HR < 200 bpm
  var HRV_MAX_RR_MS = 2000;      // HR > 30 bpm
  var HRV_ECTOPIC_THRESHOLD = 0.20;  // 인접 RR 차이 > 20% = ectopic beat
  var HRV_MIN_SAMPLES = 30;      // Task Force 1996 — 최소 ≈ 5분 측정 보장

  function computeHRV(rrIntervals) {
    var out = { hasHRV: false };
    if (!Array.isArray(rrIntervals) || rrIntervals.length < HRV_MIN_SAMPLES) {
      out.reason = 'insufficient_samples'; return out;
    }

    /* 1) Range filter — 비현실적 RR 거부 (artifact) */
    var clean = [];
    for (var i = 0; i < rrIntervals.length; i++) {
      var rr = Number(rrIntervals[i]);
      if (isFinite(rr) && rr >= HRV_MIN_RR_MS && rr <= HRV_MAX_RR_MS) {
        clean.push(rr);
      }
    }
    if (clean.length < HRV_MIN_SAMPLES) {
      out.reason = 'too_many_artifacts'; return out;
    }

    /* 2) Mean RR + SDNN (전체 표준편차) */
    var sum = 0;
    for (var i = 0; i < clean.length; i++) sum += clean[i];
    var meanRR = sum / clean.length;
    var sqDev = 0;
    for (var i = 0; i < clean.length; i++) {
      sqDev += (clean[i] - meanRR) * (clean[i] - meanRR);
    }
    var sdnn = Math.sqrt(sqDev / clean.length);

    /* 3) 인접 RR 차이 — ectopic beat 제외 후 RMSSD + pNN50 */
    var diffs = [];
    var diffCount50 = 0;
    for (var i = 1; i < clean.length; i++) {
      var d = clean[i] - clean[i - 1];
      /* ectopic beat 필터 — 차이가 평균의 20% 초과면 비정상 박동 (외삽수축 등) */
      if (Math.abs(d) > meanRR * HRV_ECTOPIC_THRESHOLD) continue;
      diffs.push(d);
      if (Math.abs(d) > 50) diffCount50++;
    }
    if (diffs.length < 2) {
      out.reason = 'too_many_ectopic'; return out;
    }

    var diffSqSum = 0;
    for (var i = 0; i < diffs.length; i++) diffSqSum += diffs[i] * diffs[i];
    var rmssd = Math.sqrt(diffSqSum / diffs.length);
    var pnn50 = (diffCount50 / diffs.length) * 100;

    /* 4) 추정 측정 시간 (RR 합산) */
    var durationSec = sum / 1000;

    out.hasHRV = true;
    out.rmssd = Math.round(rmssd * 10) / 10;
    out.sdnn = Math.round(sdnn * 10) / 10;
    out.pnn50 = Math.round(pnn50 * 10) / 10;
    out.meanRR = Math.round(meanRR * 10) / 10;
    out.meanHR = Math.round((60000 / meanRR) * 10) / 10;
    out.count = clean.length;
    out.cleanDiffCount = diffs.length;
    out.artifactsRejected = rrIntervals.length - clean.length;
    out.ectopicsRejected = (clean.length - 1) - diffs.length;
    out.durationSec = Math.round(durationSec * 10) / 10;
    return out;
  }

  /* ============================================================
   * 9-E) 스킬-심박수 분석 — 회전(택킹·자이빙) 전후 심박 반응·회복
   *
   * 각 회전의 심박을 '진입 전 → 기술 중(+심박 지연) → 완료 후 회복'
   * 세 국면으로 추적한다. 순항(포일링·회전 밖) 평균 심박을 기준선으로
   * 삼아, 어느 택·어느 스킬이 가장 큰 생리적 반응(심박 상승)을 부르는지,
   * 회전을 마치고 순항으로 돌아갈 때 심박이 얼마나 빨리·많이 떨어지는지를
   * 산출한다. 회복 속도(bpm/분)는 심혈관 회복 능력 지표로, 세션이 쌓이면
   * 장기 추세 모니터링에 쓰인다 (Danny 검토 2026-05-23).
   *
   * @param session    분석 대상 세션 (편집본이면 편집본 — 분석 구간 기준)
   * @param maneuvers  analyzeSession 이 검출한 회전 배열 (tSec 순 정렬)
   * 반환: { hasHR, cruiseHr, perTurn:[...], groups:[...], biggest,
   *         recovery:{...}, recoveryIndex, analyzedCount }.
   *       HR 가 없거나 분석할 회전이 없으면 { hasHR:false }.
   * ============================================================ */
  function computeSkillHr(session, maneuvers) {
    var out = { hasHR: false };
    if (!session || !session.hasTime || !session.hasHR) return out;
    var S = session.samples;
    if (!S || S.length < 8 || !maneuvers || !maneuvers.length) return out;

    var cfg = session.cfg || DEFAULTS;
    var foilMs = cfg.activeSpeedKt / Geo.MS_TO_KNOTS;
    var PRE_SEC = 12;     // 진입 전 심박 측정 창(초)
    var LAG_SEC = 20;     // 회전 종료 후 심박 정점 탐색 연장(심박 반응 지연)
    var REC_SEC = 60;     // 완료 후 회복 관찰 창(초) — 다음 회전까지 clamp
    var MIN_REC_SEC = 20; // 회복 지표를 신뢰할 최소 관찰 창(초)
    var MIN_RISE = 2;     // 회복 집계 대상 — 회전이 진입 직전보다 이만큼은
                          //  심박을 올렸을 것(워밍업 등 심박이 무관하게
                          //  오르던 회전을 회복 지표에서 배제)
    var GAP = cfg.gapThresholdSec || 8;

    /* --- 순항 기준 심박 — 포일링(활주) 중이면서 회전 밖인 구간의
       시간가중 평균. 회전 ±6초는 회전 영향권이라 순항에서 제외한다. --- */
    var inTurn = new Uint8Array(S.length);
    maneuvers.forEach(function (m) {
      var lo = m.startIdx, hi = m.endIdx;
      if (lo == null || hi == null) return;
      for (var k = lo; k <= hi && k < S.length; k++) if (k >= 0) inTurn[k] = 1;
      for (var p = lo; p >= 0 && S[p].t >= S[lo].t - 6; p--) inTurn[p] = 1;
      for (var q = hi; q < S.length && S[q].t <= S[hi].t + 6; q++) inTurn[q] = 1;
    });
    var cw = 0, cwHr = 0;
    for (var i = 1; i < S.length; i++) {
      if (inTurn[i] || inTurn[i - 1]) continue;
      if (S[i].hr == null || S[i - 1].hr == null) continue;
      if (S[i].speed < foilMs || S[i - 1].speed < foilMs) continue;
      var cdt = S[i].t - S[i - 1].t;
      if (cdt <= 0 || cdt > GAP) continue;
      cw += cdt; cwHr += cdt * (S[i].hr + S[i - 1].hr) / 2;
    }
    var cruiseHr = cw > 0 ? cwHr / cw : null;
    /* 순항 표본이 부족하면(짧은 세션·회전 밀집) 전체 HR 평균으로 폴백 */
    if (cruiseHr == null) {
      var hsum = 0, hn = 0;
      for (var h = 0; h < S.length; h++) {
        if (S[h].hr != null) { hsum += S[h].hr; hn++; }
      }
      cruiseHr = hn ? hsum / hn : null;
    }
    if (cruiseHr == null) return out;
    /* 표시·산출에 같은 값을 쓰도록 한 번만 반올림한다 — 카드에 보이는
       순항 기준 심박과 '순항 대비 상승'(= 최고 − 순항)이 어긋나지 않게. */
    cruiseHr = Math.round(cruiseHr);

    /* [lo,hi] 구간의 평균 HR — null 표본은 건너뛴다. 표본 0개면 null. */
    function avgHrIdx(lo, hi) {
      var s = 0, n = 0;
      for (var k = lo; k <= hi; k++) {
        if (k >= 0 && k < S.length && S[k].hr != null) { s += S[k].hr; n++; }
      }
      return n ? s / n : null;
    }

    /* --- 회전별 3국면 심박 추적 --- */
    var perTurn = [];
    maneuvers.forEach(function (m, mi) {
      if (m.type !== 'tack' && m.type !== 'gybe' && m.type !== 'turn') return;
      var a = m.startIdx, b = m.endIdx;
      if (a == null || b == null || a < 0 || b >= S.length || a > b) return;
      var prevEnd = mi > 0 ? maneuvers[mi - 1].endIdx : 0;
      var nextStart = mi < maneuvers.length - 1
        ? maneuvers[mi + 1].startIdx : S.length - 1;
      if (prevEnd == null) prevEnd = 0;
      if (nextStart == null) nextStart = S.length - 1;

      /* 진입 전 — a 직전 PRE_SEC 초. 직전 회전·시간 공백은 침범하지 않음. */
      var preLo = a;
      while (preLo - 1 > prevEnd &&
             S[a].t - S[preLo - 1].t <= PRE_SEC &&
             S[preLo].t - S[preLo - 1].t <= GAP) preLo--;
      var entryHr = avgHrIdx(preLo, a);

      /* 기술 중 정점 — a..(b + LAG_SEC). 심박은 노력보다 늦게 오르므로
         회전 종료 직후 LAG_SEC 초까지 정점을 탐색한다. 다음 회전 침범 금지. */
      var peakHi = b;
      while (peakHi + 1 < nextStart &&
             S[peakHi + 1].t - S[b].t <= LAG_SEC &&
             S[peakHi + 1].t - S[peakHi].t <= GAP) peakHi++;
      var peakHr = -1, peakIdx = -1;
      for (var pk = a; pk <= peakHi; pk++) {
        if (S[pk].hr != null && S[pk].hr > peakHr) {
          peakHr = S[pk].hr; peakIdx = pk;
        }
      }
      if (peakHr < 0 || entryHr == null) return;  // HR 결측 회전은 제외

      /* 완료 후 회복 — peakIdx 부터 REC_SEC 초, 다음 회전까지 clamp.
         회복폭(bpm) = 정점 심박 − 창 끝 평균 심박. 창이 너무 짧으면
         (다음 회전이 바로 와서) 회복 지표를 신뢰하지 않는다. */
      var recHi = peakIdx;
      while (recHi + 1 < nextStart &&
             S[recHi + 1].t - S[peakIdx].t <= REC_SEC &&
             S[recHi + 1].t - S[recHi].t <= GAP) recHi++;
      var recWindowSec = S[recHi].t - S[peakIdx].t;
      var recEndHr = avgHrIdx(Math.max(peakIdx, recHi - 1), recHi);
      var recoveryBpm = (recEndHr != null) ? (peakHr - recEndHr) : null;
      var riseVsEntry = peakHr - entryHr;           // 진입 직전 대비 상승
      /* 회복 지표 집계 대상 — 충분히 관찰됐고(MIN_REC_SEC), 그 회전이
         실제로 심박을 올렸을 것(MIN_RISE). 워밍업처럼 회전과 무관하게
         심박이 오르내리던 구간은 회복 집계에서 뺀다. */
      var recAdequate = recWindowSec >= MIN_REC_SEC && recoveryBpm != null
        && riseVsEntry >= MIN_RISE;
      var recRate = (recAdequate && recWindowSec > 0)
        ? (recoveryBpm / recWindowSec * 60) : null;   // bpm/분

      perTurn.push({
        idx: mi, type: m.type, side: m.side || null, tSec: m.tSec,
        entryHr: Math.round(entryHr),
        peakHr: Math.round(peakHr),
        riseBpm: Math.round(peakHr - cruiseHr),     // 순항 대비 상승
        riseVsEntry: Math.round(riseVsEntry),       // 진입 직전 대비 상승
        recoveryBpm: recoveryBpm != null ? Math.round(recoveryBpm) : null,
        recoveryRateBpmMin: recRate,
        recoveryWindowSec: Math.round(recWindowSec),
        recoveryAdequate: recAdequate
      });
    });
    if (!perTurn.length) return out;

    /* --- 유형×택 그룹 집계 --- */
    var TYPE_LABEL = { tack: '택킹', gybe: '자이빙', turn: '회전' };
    var SIDE_LABEL = { P: '포트', S: '스타보드' };
    var gmap = {}, gorder = [];
    perTurn.forEach(function (p) {
      var key = p.type + '|' + (p.side || '');
      if (!gmap[key]) {
        gmap[key] = {
          key: key, type: p.type, side: p.side || null,
          label: TYPE_LABEL[p.type] +
            (p.side ? ' · ' + SIDE_LABEL[p.side] : ''),
          n: 0, _entry: 0, _peak: 0, _rise: 0,
          _recBpm: 0, _recRate: 0, _recN: 0
        };
        gorder.push(key);
      }
      var g = gmap[key];
      g.n++; g._entry += p.entryHr; g._peak += p.peakHr; g._rise += p.riseBpm;
      if (p.recoveryAdequate) {
        g._recBpm += p.recoveryBpm; g._recRate += p.recoveryRateBpmMin; g._recN++;
      }
    });
    var groups = gorder.map(function (key) {
      var g = gmap[key];
      return {
        key: key, type: g.type, side: g.side, label: g.label, n: g.n,
        entryHr: Math.round(g._entry / g.n),
        peakHr: Math.round(g._peak / g.n),
        riseBpm: Math.round(g._rise / g.n),
        recoveryBpm: g._recN ? Math.round(g._recBpm / g._recN) : null,
        recoveryRateBpmMin: g._recN ? (g._recRate / g._recN) : null,
        recoveryN: g._recN
      };
    });
    var TYPE_ORD = { tack: 0, gybe: 1, turn: 2 }, SIDE_ORD = { P: 0, S: 1 };
    groups.sort(function (x, y) {
      if (TYPE_ORD[x.type] !== TYPE_ORD[y.type]) {
        return TYPE_ORD[x.type] - TYPE_ORD[y.type];
      }
      return (SIDE_ORD[x.side] || 0) - (SIDE_ORD[y.side] || 0);
    });

    /* 최대 생리 반응 — 순항 대비 평균 심박 상승이 가장 큰 그룹 */
    var biggest = null;
    groups.forEach(function (g) {
      if (!biggest || g.riseBpm > biggest.riseBpm) biggest = g;
    });

    /* --- 세션 회복 지표 — 관찰 창이 충분한 회전만 집계 --- */
    var recTurns = perTurn.filter(function (p) { return p.recoveryAdequate; });
    var recovery = {
      n: recTurns.length, avgBpm: null, avgRateBpmMin: null, avgWindowSec: null
    };
    if (recTurns.length) {
      var sb = 0, sr = 0, sw = 0;
      recTurns.forEach(function (p) {
        sb += p.recoveryBpm; sr += p.recoveryRateBpmMin; sw += p.recoveryWindowSec;
      });
      recovery.avgBpm = sb / recTurns.length;
      recovery.avgRateBpmMin = sr / recTurns.length;
      recovery.avgWindowSec = sw / recTurns.length;
    }
    /* 세션 회복 지수 — 회전 후 심박 회복 속도(bpm/분)의 평균. 높을수록
       회전 직후 심박이 빠르게 안정 = 심혈관 회복이 빠름. 세션이 쌓이면
       이 한 수치의 추세로 장기 변화를 본다 (Danny 검토 2026-05-23). */
    var recoveryIndex = recovery.avgRateBpmMin != null
      ? Math.round(recovery.avgRateBpmMin * 10) / 10 : null;

    out.hasHR = true;
    out.cruiseHr = Math.round(cruiseHr);
    out.perTurn = perTurn;
    out.groups = groups;
    out.biggest = biggest;
    out.recovery = recovery;
    out.recoveryIndex = recoveryIndex;
    out.analyzedCount = perTurn.length;
    return out;
  }

  /* 한 회전 배열의 택킹·자이빙 '시도' 수와 '성공'(풍축을 넘겨 완료 +
     터치다운 없이 포일 유지) 수를 센다. 성공률 분모를 시도 전체로
     잡기 위한 공용 집계 — analyzeSession 이 분석 대상 세션으로도,
     편집 전 원본 세션으로도 호출할 수 있다 (Danny 검토 2026-05-23:
     트랙 편집 제외 구간이 실패 회전을 빼 성공률이 100% 로 부풀던
     결함 수정 — 성공률만은 편집 전 전체 회전을 분모로 삼는다). */
  function tallyManeuverSuccess(maneuvers, foilMs) {
    var t = { tack: 0, gybe: 0, tackSuccess: 0, gybeSuccess: 0 };
    maneuvers.forEach(function (m) {
      if (m.type !== 'tack' && m.type !== 'gybe') return;
      t[m.type]++;
      var foilKept = (m.minSpeedMs != null) && (m.minSpeedMs >= foilMs);
      if (m.completed && foilKept) t[m.type + 'Success']++;
    });
    return t;
  }

  /* ============================================================
   * 10) 전체 분석 묶음 — Speed Analysis + Maneuver Analysis
   *
   * @param session   normalizeSession() 결과
   * @param windDir   확정 풍향(도) — null 이면 택킹·자이빙 분류 불가
   * @param opts      { windConfidence: '높음'|'보통'|'낮음',
   *                    fullSession: <편집 전 원본 세션> }
   *                  windConfidence — 풍향 자동 추정 신뢰도. '낮음' 이면
   *                  VMG 가 노이즈에 흔들리므로 회전 효율을 VMG 가 아닌
   *                  SOG 기준으로 산출한다 (0/100 점 튐 방지 — §issue-2).
   *                  fullSession — 편집본을 분석 중일 때 넘기는 편집 전
   *                  원본 세션. 회전 성공률만은 이 원본 세션의 회전으로
   *                  산출해, 트랙 편집 제외 구간에 든 실패 택·자이브가
   *                  분모에서 빠져 성공률이 부풀지 않게 한다
   *                  (Danny 검토 2026-05-23).
   * ============================================================ */
  function analyzeSession(session, windDir, opts) {
    opts = opts || {};
    var maneuvers = detectManeuvers(session, windDir);
    /* VMG 기반 효율을 신뢰할 수 있는 조건 — 풍향이 확정됐고, 자동 추정
       신뢰도가 '낮음' 이 아닐 것. 신뢰도가 낮으면(리칭 위주 트랙 등)
       VMG 투영이 노이즈에 흔들려 점수가 0/100 으로 튀므로 SOG 폴백. */
    var vmgReliable = (windDir != null) && (opts.windConfidence !== '낮음');
    /* 회전 '성공' 판정 임계 — 회전 중 최저 속도가 포일링(활주) 속도
       임계 이상이면 터치다운 없이 포일을 유지한 것 = 성공.
       기존 활주 임계(activeSpeedKt) 를 일관되게 재사용한다. */
    var foilMs = session.cfg.activeSpeedKt / Geo.MS_TO_KNOTS;
    var byType = { tack: 0, gybe: 0, turn: 0 };
    var lossSum = { tack: 0, gybe: 0, all: 0 };
    var lossN = { tack: 0, gybe: 0, all: 0 };
    var recSum = 0, recN = 0;
    var effSum = 0, effN = 0;            // 전체 회전 효율 점수 합·개수
    var rateSum = 0, rateN = 0;          // 전체 회전 평균 회전 속도(°/s) 합·개수
    var bestTackIdx = -1, bestGybeIdx = -1, bestTackEff = -1, bestGybeEff = -1;

    maneuvers.forEach(function (m, i) {
      byType[m.type] = (byType[m.type] || 0) + 1;
      m.efficiency = maneuverEfficiency(m, vmgReliable);
      /* 효율 산출 기준 — 표의 손실 열이 같은 기준을 보도록 표시. */
      m.effBasis = (vmgReliable && m.vmgGainPct != null) ? 'vmg' : 'sog';
      /* 표시용 손실 % — 효율 점수와 같은 기준.
         VMG 기준: 손실 = 100 − 효율 (한 비교의 양면, 합 100).
         SOG 기준: 진입·탈출 대비 최저 속도 감속폭(lossPct). */
      m.lossDisplayPct = (m.effBasis === 'vmg')
        ? (100 - m.efficiency) : m.lossPct;
      /* 포일 유지 여부 — 회전 중 최저 속도가 포일링 임계 이상(터치다운 없음). */
      m.foilKept = (m.minSpeedMs != null) && (m.minSpeedMs >= foilMs);
      /* 회전 성공 = 풍축을 넘겨 완료(completed) + 터치다운 없음(foilKept).
         완료하지 못한 시도(스핀아웃·중도 포기)는 포일을 유지했더라도
         성공이 아니다 — '터치다운 없이 완료' 정의 (Danny 검토). */
      m.turnSuccess = !!m.completed && m.foilKept;
      effSum += m.efficiency; effN++;
      // 회전 속도 = 총 회전각 ÷ 지속 시간 (°/s) — 회전당 평균 각속도
      if (m.durationSec > 0) { rateSum += m.turnAngle / m.durationSec; rateN++; }
      m.side = maneuverSide(m, windDir);   // 진입 택 — 'P'/'S'/null
      if (m.type === 'tack' || m.type === 'gybe') {
        lossSum[m.type] += m.lossDisplayPct; lossN[m.type]++;
        lossSum.all += m.lossDisplayPct; lossN.all++;
        if (m.recoverySec != null) { recSum += m.recoverySec; recN++; }
        /* 베스트 회전은 완료된 회전 중에서만 고른다. */
        if (m.type === 'tack' && m.completed && m.efficiency > bestTackEff) {
          bestTackEff = m.efficiency; bestTackIdx = i;
        }
        if (m.type === 'gybe' && m.completed && m.efficiency > bestGybeEff) {
          bestGybeEff = m.efficiency; bestGybeIdx = i;
        }
      }
    });

    /* 회전 성공률 — 트랙 편집(트림·제외 구간)이 실패 회전을 분석에서
       빼버려 성공률이 100% 로 부풀던 결함 수정 (Danny 검토 2026-05-23).
       편집본을 분석 중(opts.fullSession 제공 & session 과 다름)이면
       성공률만은 편집 전 원본 세션의 회전으로 산출한다 — 제외한 휴식
       구간에 든 실패 택·자이브도 '시도'로 세어 성공률이 편집과 무관하게
       정직하게 나오도록. 편집이 없으면 분석 대상 회전을 그대로 쓴다. */
    var srManeuvers = maneuvers, srWhole = false;
    if (opts.fullSession && opts.fullSession !== session) {
      try {
        srManeuvers = detectManeuvers(opts.fullSession, windDir);
        srWhole = true;
      } catch (e) { srManeuvers = maneuvers; srWhole = false; }
    }
    var srt = tallyManeuverSuccess(srManeuvers, foilMs);

    return {
      summary: computeSummary(session),
      histogram: computeHistogram(session),
      peaks: computePeakSpeeds(session),
      distanceBests: computeDistanceBests(session),
      alpha: computeAlpha(session),
      runs: detectRuns(session),
      maneuvers: maneuvers,
      maneuverStats: {
        total: maneuvers.length,
        tack: byType.tack || 0,
        gybe: byType.gybe || 0,
        turn: byType.turn || 0,
        /* 회전 성공 — 풍축을 넘겨 완료 + 터치다운 없이 포일 유지한 회전 수.
           분모(tackSuccessTotal·gybeSuccessTotal)는 '시도' 전체로,
           완료하지 못한 택/자이브 시도(스핀아웃·중도 포기)도 포함한다.
           편집본 분석 시에는 편집 전 원본 세션의 회전 전체를 분모로
           삼아(srt), 트랙 편집 제외 구간에 든 실패 회전이 빠져 성공률이
           100% 로 부풀던 결함을 바로잡는다 (Danny 검토 2026-05-23).
           tack·gybe 횟수 타일은 분석 구간 기준 그대로라, 편집본에서는
           성공률 분모(...Total)와 다를 수 있다. 시도가 없으면 비율 null. */
        tackSuccess: srt.tackSuccess,
        gybeSuccess: srt.gybeSuccess,
        tackSuccessTotal: srt.tack,
        gybeSuccessTotal: srt.gybe,
        tackSuccessRate: srt.tack ? (srt.tackSuccess / srt.tack * 100) : null,
        gybeSuccessRate: srt.gybe ? (srt.gybeSuccess / srt.gybe * 100) : null,
        /* true = 편집본이라 성공률을 편집 전 원본 세션 회전으로 산출함 */
        successRateWhole: srWhole,
        foilSpeedKt: session.cfg.activeSpeedKt,   // 성공 판정 포일링 임계(표시용)
        avgTackLossPct: lossN.tack ? lossSum.tack / lossN.tack : null,
        avgGybeLossPct: lossN.gybe ? lossSum.gybe / lossN.gybe : null,
        avgLossPct: lossN.all ? lossSum.all / lossN.all : null,
        avgRecoverySec: recN ? recSum / recN : null,
        /* 전체 회전(택킹·자이빙·기타 포함) 효율 점수 평균 0~100.
           회전이 없으면 null. "평균 효율" 타일·VPS 회전 30% 항에 사용. */
        avgEfficiency: effN ? effSum / effN : null,
        /* 전체 회전 평균 회전 속도(°/s) — 회전당 (총 회전각÷지속시간) 의 평균.
           회전이 없으면 null. "평균 회전 속도" 타일에 사용. */
        avgTurnRateDegSec: rateN ? rateSum / rateN : null,
        bestTackIdx: bestTackIdx, bestGybeIdx: bestGybeIdx,
        groups: maneuverGroupStats(maneuvers)
      },
      wind: computeWindMetrics(session, windDir),
      polar: computePolar(session, windDir),
      /* 심박수 분석 — 추이·요약·효율. HR 이 없으면 { hasHR:false }.
         존 분포는 사용자 입력 최대심박에 의존하므로 UI 가
         computeHrZones 를 따로 호출한다. */
      hr: analyzeHr(session),
      windDir: windDir != null ? windDir : null
    };
  }

  var Analysis = {
    DEFAULTS: DEFAULTS,
    normalizeSession: normalizeSession,
    computeSummary: computeSummary,
    computeHistogram: computeHistogram,
    computePeakSpeeds: computePeakSpeeds,
    computeDistanceBests: computeDistanceBests,
    computeAlpha: computeAlpha,
    detectRuns: detectRuns,
    detectManeuvers: detectManeuvers,
    computeWindMetrics: computeWindMetrics,
    computeStatsPanel: computeStatsPanel,
    computePolar: computePolar,
    sessionPolarProfile: sessionPolarProfile,
    buildTargetPolar: buildTargetPolar,
    computeTargetComparison: computeTargetComparison,
    headingHistogram: headingHistogram,
    tackAlignment: tackAlignment,
    estimateWindFromTrack: estimateWindFromTrack,
    estimateWindFromManeuvers: estimateWindFromManeuvers,
    buildWindSources: buildWindSources,
    combineWindSources: combineWindSources,
    cropSession: cropSession,
    applyEdits: applyEdits,
    analyzeSession: analyzeSession,
    analyzeHr: analyzeHr,
    computeTRIMP: computeTRIMP,
    computeWorkload: computeWorkload,
    estimateRaceLoad: estimateRaceLoad,
    estimateCompetitionLoad: estimateCompetitionLoad,
    computeHRV: computeHRV,
    computeHrZones: computeHrZones,
    computeHrEfficiency: computeHrEfficiency,
    computeSkillHr: computeSkillHr,
    HR_ZONE_MODEL: HR_ZONE_MODEL,
    countProminentPeaks: countProminentPeaks
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Analysis;
  else global.RDAnalysis = Analysis;
})(typeof window !== 'undefined' ? window : globalThis);
