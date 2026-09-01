/* ============================================================
 * session-qa.js — 이상징후를 만나면 단정하지 말고 물어본다 (§487)
 *
 * 계기가 된 실패 (옥대표 2026-09-01):
 *   8/31 세션 마지막 구간에서 포일 유지가 22/24 → 7/12 로 무너지고
 *   심박이 26bpm 떨어졌다. 우리 카드는 "둘이 같이 떨어졌으니 네가
 *   지친 게 아니라 **바람이 죽은 것**" 이라고 단정했다.
 *   실제 답은 셋째였다 — "여친이 타는거 옆에서 봐주느라 천천히
 *   주위를 맴돌면서 다녔다."
 *
 * 원인 후보를 둘로 놓고 하나를 고른 게 잘못이었다. 같은 증거에 여러
 * 설명이 맞으면 **고르지 말고 물어야 한다.** 트랙만 봐서는 갈릴 수
 * 없는 것들이 있다 — 왜 느렸는지는 탄 사람만 안다.
 *
 * 이 모듈이 하는 일:
 *   detect()  — 갈리지 않는 지점을 찾아 질문으로 만든다
 *   apply()   — 답을 받아 (a) 서술을 바꾸고 (b) 필요하면 그 구간을
 *               성능 통계에서 빼는 제외구간으로 돌려준다
 *
 * 답은 세션에 저장돼 다음에 열 때도 유지된다. 답하지 않은 질문은
 * 계속 질문으로 남고, 그 사이 서술은 **단정하지 않는다.**
 *
 * 브라우저: RDSessionQA  ·  Node: require('./session-qa')
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  /* effect:
       'exclude'  — 그 구간을 성능 통계에서 뺀다 (이유가 붙은 제외)
       'keep'     — 숫자는 그대로, 서술만 확정
       'fatigue'  — 그대로 두되 훈련부하 쪽에 피로 신호로 남긴다 */
  var QUESTIONS = {
    lateDrop: {
      title: 'Last quarter fell away — what happened?',
      options: [
        { key: 'wind',     label: 'The wind dropped',              effect: 'keep' },
        { key: 'company',  label: 'I was riding slowly with someone', effect: 'exclude' },
        { key: 'tired',    label: 'I was tired',                   effect: 'fatigue' },
        { key: 'gear',     label: 'I changed gear',                effect: 'exclude' },
        { key: 'winding',  label: 'I was just winding down',       effect: 'exclude' }
      ]
    },
    slowStretch: {
      title: 'A long slow stretch — were you riding?',
      options: [
        { key: 'riding',   label: 'Yes, just slow conditions',     effect: 'keep' },
        { key: 'company',  label: 'Riding with someone / coaching', effect: 'exclude' },
        { key: 'rest',     label: 'Resting on the board',          effect: 'exclude' },
        { key: 'ashore',   label: 'On the beach / off the water',  effect: 'exclude' },
        { key: 'trouble',  label: 'Gear trouble',                  effect: 'exclude' }
      ]
    }
  };

  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- 탐지 ----------
     session/analysis 는 이미 계산된 것을 읽기만 한다. opts.quarters 는
     v2 의 회전 4분위 표(이미 만들어져 있음)를 그대로 받는다. */
  function detect(session, analysis, opts) {
    opts = opts || {};
    var out = [];
    var S = (session && session.samples) || [];
    if (S.length < 60) return out;
    var t0 = S[0].t;
    var total = S[S.length - 1].t - t0;

    /* (1) 후반 급감 — 포일 유지율·진입속도가 무너진 마지막 구간.
       바람/동반/피로가 트랙에서 똑같이 보인다. */
    var q = opts.quarters;
    if (q && q.length === 4) {
      var last = q[3];
      var best = null;
      q.slice(0, 3).forEach(function (r) {
        var fr = r.n ? r.foil / r.n : null;
        if (fr != null && (!best || fr > best.rate)) best = { rate: fr, r: r };
      });
      var lastRate = last.n ? last.foil / last.n : null;
      if (best && lastRate != null && (best.rate - lastRate) >= 0.25) {
        out.push({
          id: 'lateDrop',
          title: QUESTIONS.lateDrop.title,
          options: QUESTIONS.lateDrop.options,
          evidence: 'Turns holding the foil went from '
            + best.r.foil + '/' + best.r.n + ' to ' + last.foil + '/' + last.n
            + (last.hr != null && best.r.hr != null
                ? ', average heart rate from ' + Math.round(best.r.hr)
                  + ' to ' + Math.round(last.hr) + ' bpm' : '')
            + '.',
          fromSec: total * 0.75,
          toSec: total
        });
      }
    }

    /* (2) 긴 저속 구간 — 기록은 계속되는데 한참 느린 구간.
       쉰 건지, 옆에서 봐준 건지, 장비가 말썽인지 트랙은 모른다. */
    var minSec = opts.slowMinSec || 180;
    var slowKt = opts.slowKt || 8;
    var gapSec = (session.cfg && session.cfg.gapThresholdSec) || 8;
    var run = null, runs = [];
    for (var i = 1; i < S.length; i++) {
      var dt = S[i].t - S[i - 1].t;
      var slow = (S[i].speed == null) || (S[i].speed * KT < slowKt);
      if (dt <= 0 || dt > gapSec) { run = null; continue; }
      if (slow) {
        if (!run) run = { from: S[i].t - t0, to: S[i].t - t0, sum: 0, n: 0 };
        run.to = S[i].t - t0;
        run.sum += (S[i].speed || 0) * KT; run.n++;
      } else if (run) {
        if (run.to - run.from >= minSec) runs.push(run);
        run = null;
      }
    }
    if (run && run.to - run.from >= minSec) runs.push(run);
    /* 가장 긴 것 하나만 묻는다 — 질문이 많으면 아무도 답하지 않는다 */
    runs.sort(function (a, b) { return (b.to - b.from) - (a.to - a.from); });
    if (runs.length) {
      var r0 = runs[0];
      out.push({
        id: 'slowStretch',
        title: QUESTIONS.slowStretch.title,
        options: QUESTIONS.slowStretch.options,
        evidence: fmtClock(r0.from) + '–' + fmtClock(r0.to) + ' ('
          + fmtClock(r0.to - r0.from) + ') averaged '
          + (r0.n ? (r0.sum / r0.n).toFixed(1) : '0') + ' kt, but the track kept recording.',
        fromSec: r0.from,
        toSec: r0.to
      });
    }
    return out;
  }

  /* ---------- 답 적용 ----------
     answers = { questionId: optionKey }
     반환 { resolved:[...], excludeRanges:[{from,to,reason}], fatigue:bool } */
  function apply(questions, answers, t0) {
    answers = answers || {};
    var res = { resolved: [], excludeRanges: [], fatigue: false, pending: 0 };
    (questions || []).forEach(function (q) {
      var key = answers[q.id];
      var opt = null;
      for (var i = 0; i < q.options.length; i++) {
        if (q.options[i].key === key) { opt = q.options[i]; break; }
      }
      if (!opt) { res.pending++; res.resolved.push({ q: q, answered: false }); return; }
      res.resolved.push({ q: q, answered: true, option: opt });
      if (opt.effect === 'exclude') {
        res.excludeRanges.push({
          from: (t0 || 0) + q.fromSec,
          to: (t0 || 0) + q.toSec,
          reason: opt.label
        });
      } else if (opt.effect === 'fatigue') {
        res.fatigue = true;
      }
    });
    return res;
  }

  /* 답이 서술을 어떻게 바꾸는지 — 카드가 이걸 그대로 쓴다.
     답이 없으면 **단정하지 않는 문장**을 돌려준다. 이게 이 모듈의 요점이다. */
  function narrate(questionId, optionKey) {
    if (questionId !== 'lateDrop') return null;
    switch (optionKey) {
      case 'wind':
        return 'You confirmed the wind dropped, so the last quarter is conditions, '
             + 'not form. It is left in the numbers because you were still riding it.';
      case 'company':
        return 'You were riding slowly with someone, so the last quarter says nothing '
             + 'about your speed. It has been taken out of the performance numbers.';
      case 'tired':
        return 'You called it fatigue. That is a training-load signal, not a technique '
             + 'one — the useful part of a session can end before the time does.';
      case 'gear':
        return 'Gear change — that stretch is not comparable, so it is out of the '
             + 'performance numbers.';
      case 'winding':
        return 'Winding down. Taken out of the performance numbers so it does not drag '
             + 'the session average.';
      default:
        return null;
    }
  }

  /* 답이 없을 때 쓸 문장 — 후보를 늘어놓되 고르지 않는다. */
  function undecided(kind) {
    if (kind === 'lateDrop') {
      return 'Speed and heart rate both fell in the last quarter. That fits the wind '
           + 'dropping, riding slowly with someone, or winding down — the track '
           + 'cannot tell these apart. Answer above and this becomes a real reading.';
    }
    return null;
  }

  var API = { detect: detect, apply: apply, narrate: narrate, undecided: undecided,
              QUESTIONS: QUESTIONS, fmtClock: fmtClock };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDSessionQA = API;
})(typeof window !== 'undefined' ? window : globalThis);
