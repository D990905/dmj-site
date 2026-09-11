/* §591 슬라럼·레이스 분석 (옥대표 "슬라럼 경기에서는 폴라그램이 별로 의미가
 * 없어 보이고 ... 따로 분석할만한 꺼리를 찾아서 추가")
 *
 * 근거 (2026-09-11 제1~6경기 실측):
 *   제2~6경기는 **같은 부표 세 개**를 돌았다 — 회전 정점이 수십 m 안에
 *   모인다. 그러면 부표마다 경기끼리 견줄 수 있다:
 *     부표 B 탈출 속도 14.7 ~ 19.5 kt (편차 4.8 kt) — 가장 들쭉날쭉한 회전
 *     부표 A 탈출 18.3 ~ 20.2 kt — 안정적
 *   폴라는 풍상·풍하 각도의 그림이라 리칭과 회전뿐인 슬라럼에서는 말이 없다.
 *
 * 설계:
 *   - 부표는 **회전 정점**으로 찾는다. 택/자이브 분류는 풍향에 달려 있는데
 *     같은 코스에서도 저장된 풍향이 55° 와 348° 로 갈렸다(제2경기). 분류를
 *     안 쓰면 풍향이 틀려도 부표는 맞게 찾는다.
 *   - 순수 함수만 둔다(DOM 없음) — node 에서 실제 좌표 배치로 검사한다.
 */
(function (global) {
  'use strict';

  var KT = 1.943844;
  var MARK_RADIUS_M = 75;   /* 실측: 같은 부표 정점 산포 ≤ 66 m, 가장 가까운 두 부표 간격 ≈ 120 m */

  function hav(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var d1 = (b.lat - a.lat) * r, d2 = (b.lng - a.lng) * r;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2)
          + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  function num(v) { return (v != null && isFinite(v)) ? v : null; }

  /* 한 경기의 회전 정점 — 시간 순. 누적 거리를 같이 담아 두면 부표 사이
     거리를 트랙을 다시 읽지 않고 낼 수 있다. */
  function apexes(analysis, session) {
    var S = (session && session.samples) || [];
    var M = ((analysis && analysis.maneuvers) || []).slice()
      .sort(function (a, b) { return a.startIdx - b.startIdx; });
    if (!S.length) return [];
    var cum = [0];
    for (var i = 1; i < S.length; i++) cum.push(cum[i - 1] + hav(S[i - 1], S[i]));
    var out = [];
    M.forEach(function (m) {
      var k = m.apexIdx;
      if (k == null || !S[k] || S[k].lat == null || S[k].lng == null) return;
      var s0 = S[m.startIdx], s1 = S[m.endIdx];
      out.push({
        idx: k, t: S[k].t, lat: S[k].lat, lng: S[k].lng, cumM: cum[k],
        type: m.type || 'turn',
        entryKt: num(m.entrySpeedMs) != null ? m.entrySpeedMs * KT : null,
        minKt: num(m.minSpeedMs) != null ? m.minSpeedMs * KT : null,
        exitKt: num(m.exitSpeedMs) != null ? m.exitSpeedMs * KT : null,
        radiusM: num(m.radiusM),
        turnSec: (s0 && s1) ? s1.t - s0.t : null,
        recoverySec: num(m.recoverySec)
      });
    });
    return out;
  }

  /* 여러 경기의 정점을 부표로 묶는다. 중심에서 radius 안이면 같은 부표.
     한 경기가 같은 부표를 두 번 돌 수도 있으므로 방문 목록을 남긴다. */
  function clusterMarks(races, radiusM) {
    var R = radiusM || MARK_RADIUS_M;
    var marks = [];
    races.forEach(function (race) {
      (race.apexes || []).forEach(function (ap, ai) {
        var best = null, bestD = Infinity;
        marks.forEach(function (mk) {
          var d = hav(mk, ap);
          if (d < bestD) { bestD = d; best = mk; }
        });
        if (best && bestD <= R) {
          best.visits.push({ race: race.key, ai: ai });
          var n = best.visits.length;           /* 중심을 방문 평균으로 옮긴다 */
          best.lat += (ap.lat - best.lat) / n;
          best.lng += (ap.lng - best.lng) / n;
        } else {
          marks.push({ lat: ap.lat, lng: ap.lng, visits: [{ race: race.key, ai: ai }] });
        }
      });
    });
    marks.forEach(function (mk) {
      var rs = {};
      mk.visits.forEach(function (v) { rs[v.race] = true; });
      mk.raceCount = Object.keys(rs).length;
    });
    return marks;
  }

  /* 이름 붙이기 — 기준 경기(보고 있는 경기)가 처음 도는 순서대로 A, B, C.
     두 경기 이상이 도는 부표만 쓴다(한 번만 돈 곳은 부표가 아니라 그냥 회전). */
  function labelMarks(marks, races, refKey) {
    var shared = marks.filter(function (mk) { return mk.raceCount >= 2; });
    var ref = null;
    races.forEach(function (r) { if (r.key === refKey) ref = r; });
    function firstVisit(mk, key) {
      var best = null;
      mk.visits.forEach(function (v) {
        if (v.race === key && (best == null || v.ai < best)) best = v.ai;
      });
      return best;
    }
    shared.sort(function (a, b) {
      var fa = ref ? firstVisit(a, ref.key) : null, fb = ref ? firstVisit(b, ref.key) : null;
      if (fa != null && fb != null) return fa - fb;
      if (fa != null) return -1;
      if (fb != null) return 1;
      return b.raceCount - a.raceCount;
    });
    shared.forEach(function (mk, i) { mk.label = String.fromCharCode(65 + (i % 26)); });
    return shared;
  }

  /* 부표 x 경기 → 그 경기가 그 부표를 **처음** 돈 회전 */
  function roundings(races, marks) {
    return marks.map(function (mk) {
      var cells = {};
      races.forEach(function (r) {
        var first = null;
        mk.visits.forEach(function (v) {
          if (v.race === r.key && (first == null || v.ai < first)) first = v.ai;
        });
        cells[r.key] = first == null ? null : r.apexes[first];
      });
      var exits = [];
      Object.keys(cells).forEach(function (k) {
        if (cells[k] && cells[k].exitKt != null) exits.push({ key: k, v: cells[k].exitKt });
      });
      exits.sort(function (a, b) { return b.v - a.v; });
      return {
        mark: mk.label, lat: mk.lat, lng: mk.lng, cells: cells,
        bestExit: exits.length ? exits[0] : null,
        worstExit: exits.length ? exits[exits.length - 1] : null,
        exitSpreadKt: exits.length >= 2 ? exits[0].v - exits[exits.length - 1].v : null
      };
    });
  }

  /* 경기마다 부표 → 부표 구간(정점에서 정점). 출발선·결승선은 모르므로
     (트랙을 어디서 잘랐는지에 달렸다) 부표 사이만 잰다 — 그래야 경기끼리
     같은 자로 잰 값이다. */
  function markToMark(races, marks) {
    var idxOf = {};
    marks.forEach(function (mk) {
      mk.visits.forEach(function (v) { idxOf[v.race + '#' + v.ai] = mk.label; });
    });
    var per = {};
    races.forEach(function (r) {
      var seq = [];
      (r.apexes || []).forEach(function (ap, ai) {
        var lab = idxOf[r.key + '#' + ai];
        if (lab) seq.push({ label: lab, ap: ap });
      });
      var segs = [];
      for (var i = 1; i < seq.length; i++) {
        var a = seq[i - 1], b = seq[i];
        if (a.label === b.label) continue;
        var sec = b.ap.t - a.ap.t, m = b.ap.cumM - a.ap.cumM;
        if (!(sec > 0)) continue;
        segs.push({ key: a.label + '→' + b.label, sec: sec, distM: m,
                    avgKt: m > 0 ? (m / sec) * KT : null });
      }
      per[r.key] = segs;
    });
    return per;
  }

  /* 오늘의 최고 구간들을 이은 '이론상 최고' — 기준 순서(가장 많은 경기가
     다 돈 순서)로. 그 순서를 다 돈 경기 중 가장 빠른 것과 견준다. */
  function bestLine(perRace, races) {
    var bySeq = {};
    Object.keys(perRace).forEach(function (k) {
      var keys = perRace[k].map(function (s) { return s.key; });
      for (var len = keys.length; len >= 1; len--) {
        for (var st = 0; st + len <= keys.length; st++) {
          var sq = keys.slice(st, st + len).join('|');
          bySeq[sq] = bySeq[sq] || {};
          bySeq[sq][k] = true;
        }
      }
    });
    /* 두 경기 이상이 다 돈 순서 중 가장 긴 것 */
    var pick = null;
    Object.keys(bySeq).forEach(function (sq) {
      var n = Object.keys(bySeq[sq]).length, len = sq.split('|').length;
      if (n < 2) return;
      if (!pick || len > pick.len || (len === pick.len && n > pick.n)) pick = { sq: sq, len: len, n: n };
    });
    if (!pick) return null;
    var seq = pick.sq.split('|');
    var bestSeg = seq.map(function (key) {
      var b = null;
      Object.keys(perRace).forEach(function (rk) {
        perRace[rk].forEach(function (s) {
          if (s.key === key && (!b || s.sec < b.sec)) b = { key: key, sec: s.sec, race: rk };
        });
      });
      return b;
    });
    var possible = bestSeg.reduce(function (a, s) { return a + s.sec; }, 0);
    var actual = [];
    Object.keys(perRace).forEach(function (rk) {
      var segs = perRace[rk], keys = segs.map(function (s) { return s.key; });
      for (var st = 0; st + seq.length <= keys.length; st++) {
        if (keys.slice(st, st + seq.length).join('|') === pick.sq) {
          var sum = 0;
          for (var j = 0; j < seq.length; j++) sum += segs[st + j].sec;
          actual.push({ race: rk, sec: sum });
          break;
        }
      }
    });
    actual.sort(function (a, b) { return a.sec - b.sec; });
    return { sequence: seq, bestSegments: bestSeg, possibleSec: possible,
             races: actual, bestActual: actual[0] || null,
             gainSec: actual[0] ? actual[0].sec - possible : null };
  }

  /* 한 번에 — v2 가 부르는 입구 */
  function analyze(races, refKey, radiusM) {
    var rs = races.map(function (r) {
      return { key: r.key, name: r.name, apexes: apexes(r.analysis, r.session) };
    });
    var all = clusterMarks(rs, radiusM);
    var marks = labelMarks(all, rs, refKey);
    if (!marks.length) return { ok: false, reason: 'no_shared_marks', races: rs };
    var rnd = roundings(rs, marks);
    var per = markToMark(rs, marks);
    return { ok: true, races: rs, marks: marks, roundings: rnd, legs: per, best: bestLine(per, rs) };
  }

  var API = {
    analyze: analyze, apexes: apexes, clusterMarks: clusterMarks, labelMarks: labelMarks,
    roundings: roundings, markToMark: markToMark, bestLine: bestLine,
    MARK_RADIUS_M: MARK_RADIUS_M, _hav: hav
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDSlalom = API;
})(typeof window !== 'undefined' ? window : globalThis);
