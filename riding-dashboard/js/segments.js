/* ============================================================
 * segments.js — §522 W3 구간 모델 (Waterspeed 벤치마킹)
 *
 * 옥대표: "렉을 선택해서 분석하는거 좋아."
 *
 * Waterspeed 는 **하나의 스테퍼**로 다섯 가지를 훑는다:
 *   Legs · Runs · Tacks · Jibes · Foiling
 * 우리는 이것들을 §497(회전)·§456(레그)·detectRuns 로 따로 만들어 놨는데,
 * 조작이 제각각이라 "이 구간" 이라는 개념이 화면에 없었다.
 * 여기서 다섯을 **같은 모양**으로 만들어 한 UI 가 다 다루게 한다.
 *
 * 구간 하나 = { kind, no, startIdx, endIdx, side?, type? }
 * 통계는 segStats() 가 표본에서 직접 낸다 — 종류마다 다른 필드를
 * 물려받으면 화면이 종류를 알아야 하고, 그러면 스테퍼가 하나일 이유가 없다.
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  function angDiff(ref, t) {           /* -180..180 */
    var d = ((t - ref + 540) % 360) - 180;
    return d;
  }

  /* ---- Legs: 회전과 회전 사이 ----
     레그는 '무엇을 회전으로 치느냐' 에 통째로 딸려 있다. 그래서 회전
     목록을 그대로 경계로 쓴다 — 별도 기준을 만들면 회전 표와 레그 표가
     서로 다른 세션을 설명하게 된다. */
  function legsFrom(mans, sampleCount, minSamples) {
    if (!sampleCount) return [];
    /* 회전이 바짝 붙어 있으면 그 사이 '레그' 는 표본 서너 개짜리 빈틈이다.
       그걸 레그로 세면 "52 레그" 처럼 부풀고, 통계도 노이즈가 된다.
       최소 길이 미만은 레그로 치지 않는다 — 세션에서 사라지는 게 아니라
       (회전 목록에 그대로 있다) '직진 구간' 으로 안 부를 뿐이다. */
    var need = (minSamples == null) ? 10 : minSamples;
    var ms = (mans || []).slice().sort(function (a, b) { return a.startIdx - b.startIdx; });
    var raw = [], cursor = 0;
    ms.forEach(function (m) {
      if (m.startIdx > cursor) raw.push({ startIdx: cursor, endIdx: m.startIdx });
      cursor = m.endIdx;
    });
    if (cursor < sampleCount - 1) raw.push({ startIdx: cursor, endIdx: sampleCount - 1 });
    var out = [], no = 1;
    raw.forEach(function (r) {
      if ((r.endIdx - r.startIdx + 1) < need) return;
      out.push({ kind: 'leg', no: no++, startIdx: r.startIdx, endIdx: r.endIdx });
    });
    return out;
  }

  /* ---- Foiling: 임계 속도 이상이 이어지는 구간 ----
     W6 도 여기서 나온다: 구간 수 · 가장 긴 구간(거리·시간).
     ⚠ 짧은 딥(파도 하나 넘다 잠깐 떨어진 것)으로 구간이 잘게 쪼개지면
     "13번 끊겼다" 가 실제보다 나쁘게 보인다. dipSec 만큼은 이어 붙인다. */
  function foilSections(S, thrMs, dipSec) {
    if (!S || !S.length || !(thrMs > 0)) return [];
    var allow = (dipSec == null) ? 2 : dipSec;
    var out = [], cur = null, no = 1;
    for (var i = 0; i < S.length; i++) {
      var up = (S[i].speed || 0) >= thrMs;
      if (up) {
        if (!cur) cur = { kind: 'foiling', no: 0, startIdx: i, endIdx: i };
        cur.endIdx = i; cur.lastUp = i;
      } else if (cur) {
        if ((S[i].t - S[cur.lastUp].t) > allow) {
          cur.endIdx = cur.lastUp; cur.no = no++; out.push(cur); cur = null;
        }
      }
    }
    if (cur) { cur.endIdx = cur.lastUp; cur.no = no++; out.push(cur); }
    return out.filter(function (s) { return s.endIdx > s.startIdx; });
  }

  /* ---- 다섯 종류를 같은 모양으로 ---- */
  function build(kind, opts) {
    var a = opts.analysis || {}, S = opts.samples || [];
    var mans = a.maneuvers || [];
    if (kind === 'leg') return legsFrom(mans, S.length, opts.minLegSamples);
    if (kind === 'run') {
      var runs = (a.runs && a.runs.runs) || a.runs || [];
      return runs.map(function (r, i) {
        return { kind: 'run', no: i + 1, startIdx: r.startIdx, endIdx: r.endIdx };
      });
    }
    if (kind === 'foiling') {
      return foilSections(S, opts.foilThresholdMs, opts.dipSec);
    }
    if (kind === 'tack' || kind === 'gybe') {
      var n = 0;
      return mans.filter(function (m) { return m.type === kind; })
        .map(function (m) {
          n++;
          return { kind: kind, no: n, startIdx: m.startIdx, endIdx: m.endIdx,
                   side: m.side, apexIdx: m.apexIdx, man: m };
        });
    }
    return [];
  }

  /* ---- 구간 통계 — 표본에서 직접 ----
     VMG 는 풍향이 있어야 낼 수 있다. 없으면 null 로 두고 화면이
     그렇다고 말하게 한다(0 으로 채우면 "VMG 0" 처럼 보인다). */
  function segStats(S, seg, windDir) {
    if (!S || !seg) return null;
    var a = Math.max(0, seg.startIdx), b = Math.min(S.length - 1, seg.endIdx);
    if (b <= a) return null;
    var n = 0, sumSp = 0, maxSp = 0, sumVmg = 0, maxVmg = -Infinity, nV = 0;
    var sumTwaCos = 0, sumTwaSin = 0, sumHr = 0, nHr = 0;
    for (var i = a; i <= b; i++) {
      var sp = S[i].speed;
      if (sp != null) { n++; sumSp += sp; if (sp > maxSp) maxSp = sp; }
      if (S[i].hr != null) { sumHr += S[i].hr; nHr++; }
      if (windDir != null && S[i].heading != null && sp != null) {
        var twa = angDiff(windDir, S[i].heading);   /* -180..180 */
        var ang = Math.abs(twa);
        var vmg = sp * Math.cos(ang * Math.PI / 180);   /* +풍상 / -풍하 */
        sumVmg += vmg; nV++;
        if (Math.abs(vmg) > Math.abs(maxVmg) || maxVmg === -Infinity) maxVmg = vmg;
        var r = ang * Math.PI / 180;
        sumTwaCos += Math.cos(r); sumTwaSin += Math.sin(r);
      }
    }
    if (!n) return null;
    var distM = (S[b].cumDist != null && S[a].cumDist != null)
      ? (S[b].cumDist - S[a].cumDist) : null;
    var durSec = S[b].t - S[a].t;
    var avgTwa = nV ? (Math.atan2(sumTwaSin / nV, sumTwaCos / nV) * 180 / Math.PI) : null;
    if (avgTwa != null && avgTwa < 0) avgTwa += 360;
    var avgVmg = nV ? sumVmg / nV : null;
    return {
      startIdx: a, endIdx: b,
      durationSec: durSec,
      distanceM: distM,
      avgSpeedMs: sumSp / n,
      maxSpeedMs: maxSp,
      avgVmgMs: avgVmg,
      maxVmgMs: (maxVmg === -Infinity) ? null : maxVmg,
      avgTwaDeg: avgTwa,
      /* 풍상/풍하 판정은 **평균 TWA** 로 — 순간 VMG 부호로 하면
         회전 하나에 방향이 뒤집힌다 */
      direction: (avgTwa == null) ? null : (avgTwa < 90 ? 'upwind' : 'downwind'),
      avgHr: nHr ? sumHr / nHr : null,
      samples: n
    };
  }

  /* ---- W11 각도 변화 — 구간 안에서 풍각이 얼마나 밀렸나 ----
     앞 1/4 과 뒤 1/4 의 평균 TWA 차이. 헤더(들림)/리프트(밀림) 신호다.
     구간이 짧으면(표본 8 미만) 산출하지 않는다 — 노이즈가 신호를 덮는다. */
  function angleChange(S, seg, windDir) {
    if (windDir == null || !S || !seg) return null;
    var a = seg.startIdx, b = seg.endIdx, len = b - a + 1;
    if (len < 8) return null;
    var q = Math.max(2, Math.floor(len / 4));
    function meanTwa(lo, hi) {
      var c = 0, sc = 0, ss = 0;
      for (var i = lo; i <= hi; i++) {
        if (S[i].heading == null) continue;
        var r = Math.abs(angDiff(windDir, S[i].heading)) * Math.PI / 180;
        sc += Math.cos(r); ss += Math.sin(r); c++;
      }
      return c ? Math.atan2(ss / c, sc / c) * 180 / Math.PI : null;
    }
    var first = meanTwa(a, a + q - 1), last = meanTwa(b - q + 1, b);
    if (first == null || last == null) return null;
    return { deltaDeg: last - first, firstTwa: first, lastTwa: last };
  }

  /* ---- W6 포일링 구조 요약 ---- */
  function foilSummary(S, sections) {
    if (!sections || !sections.length) {
      return { count: 0, longestSec: 0, longestM: 0, totalSec: 0, totalM: 0 };
    }
    var longestSec = 0, longestM = 0, totalSec = 0, totalM = 0;
    sections.forEach(function (s) {
      var dur = S[s.endIdx].t - S[s.startIdx].t;
      var d = (S[s.endIdx].cumDist != null)
        ? (S[s.endIdx].cumDist - S[s.startIdx].cumDist) : 0;
      totalSec += dur; totalM += d;
      if (dur > longestSec) longestSec = dur;
      if (d > longestM) longestM = d;
    });
    return { count: sections.length, longestSec: longestSec, longestM: longestM,
             totalSec: totalSec, totalM: totalM };
  }

  var API = { build: build, segStats: segStats, angleChange: angleChange,
              foilSections: foilSections, foilSummary: foilSummary,
              legsFrom: legsFrom, KT: KT,
              _test: { angDiff: angDiff } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDSegments = API;
})(typeof window !== 'undefined' ? window : globalThis);
