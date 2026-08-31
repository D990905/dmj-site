/* ============================================================
 * analysis-stability.js — 보드 안정성 지표 + 자동 코칭 트리거 (§446)
 *
 * 왜: 속도만 봐서는 왜 빠른지/느린지 알 수 없다. 실측(2026-08-29·30)에서
 *   순항 10초 구간을 안정성으로 4분위 나눠 보니
 *     피치 흔들림 안정 25% vs 불안정 25% → 속도 +2.7 ~ +5.0 kt
 *     힐   흔들림 안정 25% vs 불안정 25% → VMG  +1.0 ~ +2.6 kt
 *   피치는 속도에, 힐은 VMG 에 걸린다. 물리적으로도 맞는다 —
 *   포일이 위아래로 까딱이면(포포이징) 양력이 요동쳐 항력이 늘고,
 *   좌우 롤은 코스를 흔들어 풍상 효율을 깎는다.
 *
 * 구간 정의: 10초, 순항(12kt+), 선회 제외(heading 표준편차 25° 미만).
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;
  var SEG_SEC = 10;
  var MIN_CRUISE_KT = 12;
  var MAX_HEADING_SD = 25;
  var MIN_SEGMENTS = 12;          /* 이보다 적으면 통계로 쓰지 않는다 */
  var MIN_METRIC_SPREAD = 0.3;    /* 상·하위 집단의 지표 차이가 이보다 작으면 설명력 없음(도) */

  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function sd(a) {
    if (a.length < 2) return null;
    var m = mean(a);
    return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / a.length);
  }
  function med(a) {
    if (!a.length) return null;
    var v = a.slice().sort(function (x, y) { return x - y; });
    return v[v.length >> 1];
  }
  /* 방위는 순환값이라 단순 표준편차가 틀린다 — 벡터 평균으로 산포를 본다 */
  function headingSd(deg) {
    if (deg.length < 2) return 0;
    var sx = 0, sy = 0;
    deg.forEach(function (d) {
      var r = d * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r);
    });
    var R = Math.sqrt(sx * sx + sy * sy) / deg.length;
    if (R >= 1) return 0;
    return Math.sqrt(-2 * Math.log(R)) * 180 / Math.PI;
  }

  /* 순항 구간으로 쪼개 구간별 지표를 낸다 */
  function segments(session) {
    var S = (session && session.samples) || [];
    if (S.length < 20) return [];
    var span = S[S.length - 1].t - S[0].t;
    if (!(span > 0)) return [];
    var hz = S.length / span;
    var W = Math.max(5, Math.round(hz * SEG_SEC));
    var out = [];
    for (var i = 0; i + W < S.length; i += W) {
      var raw = S.slice(i, i + W);
      var w = raw.filter(function (p) {
        return p && p.heel != null && p.pitch != null && p.speed != null;
      });
      if (w.length < W * 0.8) continue;
      var spd = w.map(function (p) { return p.speed * KT; });
      var mSpd = med(spd);
      if (mSpd == null || mSpd < MIN_CRUISE_KT) continue;
      var hd = w.map(function (p) { return p.heading; })
                .filter(function (v) { return v != null && isFinite(v); });
      if (hd.length >= 3 && headingSd(hd) > MAX_HEADING_SD) continue;   /* 선회 제외 */

      var pitchRate = [];
      for (var k = 1; k < w.length; k++) {
        var dt = w[k].t - w[k - 1].t;
        if (dt > 0) pitchRate.push(Math.abs(w[k].pitch - w[k - 1].pitch) / dt);
      }
      var vmgs = w.map(function (p) { return p.vmg != null ? Math.abs(p.vmg) * KT : null; })
                  .filter(function (v) { return v != null; });
      out.push({
        tSec: w[0].t - S[0].t,
        speedKt: mSpd,
        speedCv: sd(spd) / mSpd,
        heelAbs: med(w.map(function (p) { return Math.abs(p.heel); })),
        heelSd: sd(w.map(function (p) { return p.heel; })),
        pitchSd: sd(w.map(function (p) { return p.pitch; })),
        pitchRate: med(pitchRate),
        vmgKt: vmgs.length ? med(vmgs) : null,
        twaAbs: med(w.map(function (p) { return p.twa != null ? Math.abs(p.twa) : null; })
                     .filter(function (v) { return v != null; }))
      });
    }
    return out;
  }

  /* 지표별 상·하위 25% 를 갈라 성능 차이를 낸다 — 상관계수보다 읽기 쉽다 */
  function quartileGap(segs, key, target) {
    var usable = segs.filter(function (s) {
      return s[key] != null && isFinite(s[key]) && s[target] != null && isFinite(s[target]);
    });
    if (usable.length < MIN_SEGMENTS) return null;
    var sorted = usable.slice().sort(function (a, b) { return a[key] - b[key]; });
    var n = Math.max(3, Math.floor(sorted.length / 4));
    var stable = sorted.slice(0, n), rough = sorted.slice(-n);
    var sVal = med(stable.map(function (s) { return s[target]; }));
    var rVal = med(rough.map(function (s) { return s[target]; }));
    var sM = med(stable.map(function (s) { return s[key]; }));
    var rM = med(rough.map(function (s) { return s[key]; }));
    /* 지표 자체가 두 집단에서 다르지 않으면 그 지표로 설명할 수 없다.
       정렬이 우연히 성능과 맞아떨어져 가짜 이득이 나오는 것을 막는다
       (합성 테스트: 피치 SD 가 전 구간 0 인데 '피치가 6kt 를 만든다' 가 나왔다). */
    var spread = Math.abs(rM - sM);
    var rel = Math.max(Math.abs(sM), Math.abs(rM));
    if (spread < MIN_METRIC_SPREAD || (rel > 0 && spread / rel < 0.15)) {
      return { stableMetric: sM, roughMetric: rM, stableTarget: sVal, roughTarget: rVal,
               gain: 0, n: usable.length, rejected: 'metric-does-not-separate' };
    }
    return {
      stableMetric: sM, roughMetric: rM,
      stableTarget: sVal, roughTarget: rVal, gain: sVal - rVal, n: usable.length
    };
  }

  function analyze(session) {
    var segs = segments(session);
    if (segs.length < MIN_SEGMENTS) {
      return { ok: false, reason: 'not-enough-cruising', segments: segs.length };
    }
    return {
      ok: true, segments: segs.length,
      pitchSd: med(segs.map(function (s) { return s.pitchSd; })),
      heelSd: med(segs.map(function (s) { return s.heelSd; })),
      speedCv: med(segs.map(function (s) { return s.speedCv; })),
      pitchRate: med(segs.map(function (s) { return s.pitchRate; })),
      pitchVsSpeed: quartileGap(segs, 'pitchSd', 'speedKt'),
      heelVsVmg: quartileGap(segs, 'heelSd', 'vmgKt'),
      heelVsSpeed: quartileGap(segs, 'heelSd', 'speedKt'),
      _segments: segs
    };
  }

  /* ---------- 자동 코칭 트리거 ----------
     조건이 맞을 때만 항목을 낸다. 근거 수치를 함께 실어 '왜' 를 남긴다. */
  var MIN_GAIN_KT = 1.0;          /* 이보다 작은 차이는 조언으로 내지 않는다 */
  var HEEL_IMBALANCE_DEG = 3;     /* 옥대표 실무값: 좌우 차이는 커봐야 3° */

  function coach(session, stability, tackHeel) {
    var out = [];
    if (!stability || !stability.ok) return out;

    var p = stability.pitchVsSpeed;
    if (p && p.gain >= MIN_GAIN_KT) {
      out.push({
        id: 'pitch-stability', severity: p.gain >= 3 ? 'high' : 'medium',
        title: 'Steadier pitch is worth ' + p.gain.toFixed(1) + ' kt',
        detail: 'Your steadiest quarter of cruising (pitch varies ' + p.stableMetric.toFixed(1)
          + '°) runs at ' + p.stableTarget.toFixed(1) + ' kt. The roughest quarter ('
          + p.roughMetric.toFixed(1) + '°) runs at ' + p.roughTarget.toFixed(1) + ' kt.',
        why: 'Pitch oscillation is the foil porpoising. Lift swings, drag rises, speed leaks away.'
      });
    }
    var h = stability.heelVsVmg;
    if (h && h.gain >= MIN_GAIN_KT) {
      out.push({
        id: 'heel-stability', severity: h.gain >= 2 ? 'high' : 'medium',
        title: 'Steadier heel is worth ' + h.gain.toFixed(1) + ' kt of VMG',
        detail: 'Segments where heel varies least (' + h.stableMetric.toFixed(1)
          + '°) make ' + h.stableTarget.toFixed(1) + ' kt VMG, against '
          + h.roughTarget.toFixed(1) + ' kt when it varies most (' + h.roughMetric.toFixed(1) + '°).',
        why: 'Rolling side to side wanders the course. It costs less in raw speed than in '
          + 'progress towards the mark.'
      });
    }
    if (tackHeel && tackHeel.port != null && tackHeel.starboard != null) {
      var diff = Math.abs(Math.abs(tackHeel.port) - Math.abs(tackHeel.starboard));
      if (diff > HEEL_IMBALANCE_DEG) {
        var deeper = Math.abs(tackHeel.port) > Math.abs(tackHeel.starboard) ? 'port' : 'starboard';
        out.push({
          id: 'heel-imbalance', severity: diff > 8 ? 'high' : 'medium',
          title: 'Heel differs by ' + diff.toFixed(1) + '° between tacks',
          detail: 'Port ' + Math.abs(tackHeel.port).toFixed(1) + '°, starboard '
            + Math.abs(tackHeel.starboard).toFixed(1) + '° — you carry more on ' + deeper + '.',
          why: diff > 8
            ? 'A gap this large usually means the zero point is off rather than a real habit — '
              + 'check that the board floated flat somewhere in this session.'
            : 'Real left/right difference is usually about 3°, so this is worth watching.'
        });
      }
    }
    return out;
  }

  var API = { segments: segments, analyze: analyze, coach: coach,
              _test: { headingSd: headingSd, quartileGap: quartileGap, sd: sd, med: med } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDStability = API;
})(typeof window !== 'undefined' ? window : globalThis);
