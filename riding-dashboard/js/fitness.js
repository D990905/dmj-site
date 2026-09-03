/* ============================================================
 * fitness.js — §526 T4 심박 회복(HRR) · T5 목표 강도 밴드
 *   (Athlytic 벤치마킹에서 남아 있던 마지막 둘)
 *
 * T4 HRR: 힘든 구간 직후 심박이 **얼마나 빨리 떨어지는가**. 유산소
 *   체력과 부교감 재활성의 고전적 지표다(Cole 1999). 절대 심박보다
 *   개인 추세로 읽는다 — 같은 사람의 HRR 이 떨어지면 피로 신호다.
 *   ⚠ 의학 판정이 아니다. 화면에도 그렇게 적는다.
 *
 * T5 목표 강도: 오늘의 회복 판정(rest/active_recovery/moderate/full)을
 *   **심박 밴드**로 옮긴다. "적당히 타세요" 는 실행할 수 없고
 *   "128~145 bpm" 은 실행할 수 있다.
 *   Karvonen(심박예비량) — %HRR × (최대−안정) + 안정. 단순 %최대보다
 *   안정시심박이 낮은 사람에게 정확하다.
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---- T5 목표 강도 밴드 ----
     행동 → 강도. 판정이 '쉬어라' 면 밴드를 주지 않는다 — 목표를 주면
     그건 타라는 말이 된다. */
  var EXERTION = {
    rest:            null,
    active_recovery: { lo: 0.50, hi: 0.60, label: 'very light' },
    moderate:        { lo: 0.60, hi: 0.75, label: 'steady' },
    full_ride:       { lo: 0.70, hi: 0.88, label: 'working' }
  };

  function targetBand(action, maxHr, restHr) {
    var z = EXERTION[action];
    if (z === null) return { ok: false, reason: 'rest_day', action: action };
    if (!z) return { ok: false, reason: 'unknown_action', action: action };
    if (!(maxHr > 0)) return { ok: false, reason: 'need_max_hr' };
    /* 안정시심박이 없으면 Karvonen 을 못 쓴다. %최대로 떨어지되
       **그렇다고 말한다** — 두 방식은 같은 %라도 다른 심박을 낸다. */
    var karvonen = (restHr > 0 && restHr < maxHr);
    var reserve = karvonen ? (maxHr - restHr) : maxHr;
    var base = karvonen ? restHr : 0;
    return {
      ok: true, action: action, label: z.label,
      loBpm: Math.round(base + reserve * z.lo),
      hiBpm: Math.round(base + reserve * z.hi),
      loPct: z.lo, hiPct: z.hi,
      method: karvonen ? 'karvonen' : 'pct_max'
    };
  }

  /* 실제 세션이 밴드 안에 얼마나 있었나 — 처방과 실행을 잇는다 */
  function bandCompliance(samples, band) {
    if (!band || !band.ok || !samples || !samples.length) return null;
    var inB = 0, below = 0, above = 0, n = 0, prev = null;
    for (var i = 0; i < samples.length; i++) {
      var p = samples[i];
      if (p.hr == null) { prev = p; continue; }
      var dt = (prev && prev.t != null && p.t != null) ? (p.t - prev.t) : 1;
      if (!(dt > 0) || dt > 30) dt = 1;
      n += dt;
      if (p.hr < band.loBpm) below += dt;
      else if (p.hr > band.hiBpm) above += dt;
      else inB += dt;
      prev = p;
    }
    if (!n) return null;
    return { inSec: inB, belowSec: below, aboveSec: above, totalSec: n,
             inPct: (inB / n) * 100 };
  }

  /* ---- T4 심박 회복 ----
     힘든 구간이 끝난 뒤 60초(과 120초) 동안 심박이 몇 bpm 떨어지는가.

     찾는 방법: 심박이 높고(peakMinBpm 이상) 그 뒤로 **연속해서**
     낮아지는 지점. 세션 끝의 정리 구간이 가장 깨끗하지만, 중간에
     쉬는 구간이 있으면 거기서도 잰다.

     ⚠ 기록이 힘든 구간 직후에 끊기면 못 잰다 — 흔한 일이다.
     그때는 값을 지어내지 않고 왜 못 냈는지 낸다. */
  function hrRecovery(samples, opts) {
    opts = opts || {};
    var peakMin = opts.peakMinBpm || 130;
    var windowSec = opts.windowSec || 60;
    var maxWindows = opts.maxWindows || 8;
    if (!samples || samples.length < 3) {
      return { ok: false, reason: 'no_data' };
    }
    var hrPts = [];
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].hr != null && samples[i].t != null) {
        hrPts.push({ t: samples[i].t, hr: samples[i].hr,
                     speed: samples[i].speed == null ? null : samples[i].speed });
      }
    }
    if (hrPts.length < 10) return { ok: false, reason: 'no_hr' };

    function hrAt(t) {
      /* 가장 가까운 표본 — 5초 넘게 떨어져 있으면 없는 것으로 본다 */
      var best = null, bd = Infinity;
      for (var k = 0; k < hrPts.length; k++) {
        var d = Math.abs(hrPts[k].t - t);
        if (d < bd) { bd = d; best = hrPts[k]; }
        else if (hrPts[k].t > t + 5) break;
      }
      return (best && bd <= 5) ? best.hr : null;
    }

    /* ★ 회복은 **노력이 끝난 순간**부터 잰다.
       처음엔 '국소 최고점' 을 찾았는데, 심박이 170 으로 평탄한 구간에서는
       첫 점이 바로 최고점 조건을 만족한다 — 아직 한창 운동 중인 지점이다.
       실측에서 60bpm 떨어질 자리가 **2bpm** 으로 나왔다.

       그래서 임계 이상이 이어지는 '힘든 구간' 을 먼저 찾고, 그 안에서
       최고 심박이 **마지막으로** 나온 시점을 기준으로 삼는다. 그게
       운동이 끝난 지점이다(HRR 표준 프로토콜의 'peak at termination'). */
    var runs = [], cur = null;
    for (var j = 0; j < hrPts.length; j++) {
      if (hrPts[j].hr >= peakMin) {
        if (!cur) cur = { a: j, b: j };
        else cur.b = j;
      } else if (cur) {
        /* 짧게 임계 아래로 내려간 건 같은 구간으로 본다 */
        if (hrPts[j].t - hrPts[cur.b].t > 10) { runs.push(cur); cur = null; }
      }
    }
    if (cur) runs.push(cur);

    var drops = [];
    for (var r = 0; r < runs.length && drops.length < maxWindows; r++) {
      var run = runs[r];
      var peakHr = 0;
      for (var m = run.a; m <= run.b; m++) {
        if (hrPts[m].hr > peakHr) peakHr = hrPts[m].hr;
      }
      /* 최고 심박이 **마지막으로** 나온 시점 = 노력이 끝난 지점 */
      var atIdx = run.a;
      for (var m2 = run.a; m2 <= run.b; m2++) {
        if (hrPts[m2].hr === peakHr) atIdx = m2;
      }
      var p = hrPts[atIdx];
      var after = hrAt(p.t + windowSec);
      if (after == null) continue;
      var drop = p.hr - after;
      if (drop <= 0) continue;
      drops.push({ atSec: p.t, peakBpm: p.hr, endBpm: after, dropBpm: drop });
    }
    if (!drops.length) {
      /* 왜 못 냈는지 갈라서 말한다 */
      var maxHrSeen = 0;
      hrPts.forEach(function (x) { if (x.hr > maxHrSeen) maxHrSeen = x.hr; });
      return { ok: false,
               reason: maxHrSeen < peakMin ? 'never_hard_enough' : 'no_clean_recovery',
               maxHrSeen: maxHrSeen, need: peakMin };
    }
    drops.sort(function (a, b) { return b.dropBpm - a.dropBpm; });
    var best = drops[0];
    var sum = 0;
    drops.forEach(function (d) { sum += d.dropBpm; });
    return { ok: true, windowSec: windowSec,
             bestDropBpm: best.dropBpm, bestAtSec: best.atSec,
             bestPeakBpm: best.peakBpm, bestEndBpm: best.endBpm,
             avgDropBpm: sum / drops.length, count: drops.length,
             windows: drops };
  }

  /* 해석 — **추세용 밴드**이지 진단이 아니다.
     Cole 1999 는 운동부하검사에서 HRR60 ≤12bpm 을 이상 소견으로 봤지만,
     그건 통제된 검사 이야기다. 물 위에서 잰 값은 조건이 제각각이라
     같은 사람의 **변화**로만 읽어야 한다. */
  function hrrBand(dropBpm) {
    if (dropBpm == null || !isFinite(dropBpm)) return null;
    if (dropBpm >= 30) return { key: 'strong', label: 'fast drop' };
    if (dropBpm >= 20) return { key: 'good', label: 'healthy drop' };
    if (dropBpm >= 12) return { key: 'fair', label: 'modest drop' };
    return { key: 'slow', label: 'slow drop' };
  }

  var API = { targetBand: targetBand, bandCompliance: bandCompliance,
              hrRecovery: hrRecovery, hrrBand: hrrBand, EXERTION: EXERTION };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDFitness = API;
})(typeof window !== 'undefined' ? window : globalThis);
