/* ============================================================
 * analysis-gainloss.js — Gain/Loss (§456)
 *
 * "얼마나 빨랐나" 가 아니라 "바람 쪽으로 얼마나 나아갔나" 를 잰다.
 * 풍상 레그에서 옆으로 아무리 멀리 갔어도 바람 축 진행이 같으면 이득은
 * 0 이다. 상용 앱에서 Gain/Loss 라 부르는 것이 이 축의 진행량 차이다.
 *
 * ── ladder rung ────────────────────────────────────────────
 *   u = 풍상 방향 단위벡터 (TWD 쪽).  r = (p − p0) · u  [m]
 *   두 지점의 r 차이가 곧 "바람 쪽으로 번 거리". 사다리 가로대(rung)를
 *   하나씩 올라가는 그림에서 온 이름이다.
 *
 * ── 기동 손실 ───────────────────────────────────────────────
 *   회전 한 번이 몇 미터를 까먹었는지. 두 가지로 재고 **둘 다** 보여준다
 *   (Sailnjord 도 두 방식을 나란히 낸다). 서로 크게 다르면 그 회전은
 *   판정이 애매한 것이다.
 *
 *   A) VMG 적분 — 회전 직전 안정구간의 VMG 를 기준으로, 그보다 못 낸
 *      만큼을 시간 적분한다.  loss = ∫ max(0, VMG_ref − VMG(t)) dt
 *   B) 반사실 경로 — "정점에서 즉시 방향만 바꿨다면" 의 rung 진행과
 *      실제 rung 진행의 차. 회전이 실제로 그린 호(arc)의 비용이다.
 *
 *   기준 창은 회전 준비 구간을 피해서 잡는다 — 회전 직전 몇 초는 이미
 *   감속이 시작돼 기준으로 쓰면 손실이 과소평가된다.
 *
 * 브라우저: RDGainLoss.*   ·   Node: require('./analysis-gainloss')
 * ============================================================ */
(function (global) {
  'use strict';

  var Geo = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./geo.js') : global.RDGeo;

  var KT = 1.94384;

  /* 기준 창 — Sailnjord 기본값(전후 20초 평균, 준비구간 제외)을 윙포일
     기동 길이에 맞춰 줄였다. 윙포일 택은 4~8초로 요트보다 훨씬 짧다. */
  var EXCL_SEC = 3;      /* 회전 직전 이 구간은 이미 준비 동작 — 기준에서 뺀다 */
  var REF_SEC = 15;      /* 기준 VMG 를 잴 안정구간 길이 */
  var TAIL_SEC = 20;     /* 회전 후 이 시간까지를 손실 구간으로 본다 */
  var MIN_REF_SAMPLES = 5;

  function toRad(d) { return d * Math.PI / 180; }

  /* 풍상 방향 단위벡터 — TWD 는 "바람이 불어오는 방향" 이므로 그쪽으로
     나아가는 것이 풍상 이득이다. 북=+y, 동=+x 로 둔다. */
  function upwindUnit(twd) {
    var r = toRad(twd);
    return { x: Math.sin(r), y: Math.cos(r) };
  }

  /* 위경도 → 로컬 평면(m). 기준점 근처에서만 쓰므로 등거리 근사로 충분. */
  function toLocal(p, origin) {
    var mPerLat = 111132;
    var mPerLng = 111320 * Math.cos(toRad(origin.lat));
    return { x: (p.lng - origin.lng) * mPerLng, y: (p.lat - origin.lat) * mPerLat };
  }

  /* 샘플별 ladder rung 좌표(m). 첫 샘플이 0. */
  function ladderRung(session, twd) {
    var S = (session && session.samples) || [];
    if (!S.length || twd == null) return null;
    var o = S[0], u = upwindUnit(twd);
    var out = new Array(S.length);
    for (var i = 0; i < S.length; i++) {
      var q = toLocal(S[i], o);
      out[i] = q.x * u.x + q.y * u.y;
    }
    return out;
  }

  /* 목표 방향 VMG — 부호를 목적에 맞춰 뒤집는다.
     풍상은 +VMG 가 전진이지만 풍하는 −VMG 가 전진이다. 이걸 통일하지
     않고 그대로 더하면 풍하 기동의 손실이 통째로 뒤집힌다(실제로 첫
     구현에서 자이브 손실이 회전당 146m 로 나왔다 — 10초짜리 회전이
     낼 수 없는 값). */
  function orientedVmg(p, zone) {
    var v = p.vmg;
    if (v == null || !isFinite(v)) return null;
    return zone === 'downwind' ? -v : v;
  }

  /* 목표 방향 진행 속도(m/s) — **위치에서 직접** 낸다.
     엔진의 p.vmg 는 평활된 속도·헤딩에서 나오고 rung 은 원좌표에서
     나온다. 둘을 섞으면 "부족분 적분(A)" 이 "순손실(B)" 보다 작아지는
     모순이 생긴다(실측에서 10건). 그래서 이 모듈은 rung 변화율 하나만
     쓴다 — 위치가 유일한 진실이다. */
  function rungRateAt(rung, S, i, sgn) {
    if (i < 1 || i >= S.length) return null;
    var dt = S[i].t - S[i - 1].t;
    if (!(dt > 0) || dt > 5) return null;
    return { v: sgn * (rung[i] - rung[i - 1]) / dt, dt: dt };
  }

  /* 시간가중 평균 목표방향 진행 속도(m/s) — [i0, i1]. 표본 부족이면 null. */
  function meanRate(rung, S, i0, i1, sgn) {
    var sum = 0, w = 0, n = 0;
    for (var i = Math.max(1, i0); i <= i1 && i < S.length; i++) {
      var r = rungRateAt(rung, S, i, sgn);
      if (!r) continue;
      sum += r.v * r.dt; w += r.dt; n++;
    }
    if (n < MIN_REF_SAMPLES || !(w > 0)) return null;
    return sum / w;
  }

  /* 이 기동의 목표 방향 — **엔진의 회전 종류를 따른다**.
     택은 풍축(TWA 0°)을, 자이브는 풍하축(180°)을 넘는 것이 정의이므로
     종류가 곧 방향이다. 전후 |TWA| 평균으로 따로 판정했더니 풍축 근처를
     오가는 회전에서 종류와 어긋나 기준 VMG 가 반대로 잡히고 손실이
     230m 로 부풀었다(실측 #27).
     다만 관측 TWA 가 종류와 크게 어긋나면 그 회전은 판정이 애매하므로
     플래그를 달아 요약에서 뺀다 — 애매한 것을 숫자로 단정하지 않는다. */
  function maneuverZone(S, m) {
    return (m.type === 'gybe') ? 'downwind' : 'upwind';
  }

  /* 관측 TWA 가 종류와 맞는가. 맞지 않으면 손실 산출의 전제가 흔들린다. */
  function zoneConflict(S, m, zone) {
    function twaAt(idx) {
      var p = S[idx];
      return (p && p.twa != null) ? Math.abs(p.twa) : null;
    }
    var vals = [twaAt(m.startIdx), twaAt(m.endIdx)]
      .filter(function (x) { return x != null; });
    if (!vals.length) return false;
    var mean = vals.reduce(function (s2, x) { return s2 + x; }, 0) / vals.length;
    var observed = mean > 90 ? 'downwind' : 'upwind';
    return observed !== zone;
  }

  /* 시각 t 에 가장 가까운 인덱스 (S 는 시간 오름차순) */
  function idxAtTime(S, t) {
    var lo = 0, hi = S.length - 1;
    if (t <= S[0].t) return 0;
    if (t >= S[hi].t) return hi;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (S[mid].t <= t) lo = mid; else hi = mid;
    }
    return (Math.abs(S[lo].t - t) <= Math.abs(S[hi].t - t)) ? lo : hi;
  }

  /* ---------- 기동 손실 ---------- */
  function maneuverLoss(session, maneuvers, twd) {
    var S = (session && session.samples) || [];
    if (!S.length || twd == null || !maneuvers || !maneuvers.length) return [];
    var rung = ladderRung(session, twd);
    if (!rung) return [];
    var u = upwindUnit(twd), o = S[0];

    return maneuvers.map(function (m, k) {
      var res = { index: k, type: m.type, side: m.side, tSec: m.tSec,
                  vmgLossM: null, pathLossM: null, refVmgKt: null, ok: false };
      var iStart = m.startIdx, iApex = m.apexIdx, iEnd = m.endIdx;
      if (iStart == null || iEnd == null || iApex == null) {
        res.reason = 'no-boundaries'; return res;
      }
      if (!S[iStart] || !S[iEnd] || !S[iApex]) { res.reason = 'no-boundaries'; return res; }

      /* 기준 창 — 회전 직전 준비구간(EXCL) 을 건너뛰고 그 앞 REF 초 */
      var tRefEnd = S[iStart].t - EXCL_SEC;
      var tRefStart = tRefEnd - REF_SEC;
      var jEnd = idxAtTime(S, tRefEnd), jStart = idxAtTime(S, tRefStart);
      var zone = maneuverZone(S, m);
      res.zone = zone;
      res.zoneConflict = zoneConflict(S, m, zone);

      /* 기준 VMG — 회전 **전후** 안정구간 중 좋은 쪽을 쓴다.
         앞 구간만 쓰면, 이미 느려진 채로 들어간 회전에서 기준이 0 에
         가까워져 손실이 무의미해진다(실측: ref 0.8kt 인데 손실 91m).
         공개 방법론들도 전후를 함께 보고 더 나은 쪽을 기준으로 삼는다. */
      var sgn = (zone === 'downwind') ? -1 : 1;
      var vBefore = meanRate(rung, S, jStart, jEnd, sgn);
      var tAftStart = S[iEnd].t + TAIL_SEC;
      var iAftStart = idxAtTime(S, tAftStart);
      var iAftEnd = idxAtTime(S, tAftStart + REF_SEC);
      var vAfter = meanRate(rung, S, iAftStart, iAftEnd, sgn);
      var vref = null;
      if (vBefore != null && vAfter != null) vref = Math.max(vBefore, vAfter);
      else vref = (vBefore != null) ? vBefore : vAfter;
      if (vref == null) { res.reason = 'no-reference-window'; return res; }
      /* 기준이 이만큼도 안 되면 그 구간 자체가 주행이 아니다(표류·정지).
         그런 회전에 손실을 매기면 숫자만 크고 뜻이 없다. */
      if (!(vref * KT >= 1.5)) { res.reason = 'not-sailing'; return res; }
      res.refVmgKt = vref * KT;
      res.refBasis = (vBefore != null && vAfter != null)
        ? (vref === vBefore ? 'before' : 'after')
        : (vBefore != null ? 'before' : 'after');

      /* 손실 구간 = 회전 시작 ~ 기준 VMG 를 되찾는 시점(최대 TAIL 까지).
         되찾은 뒤까지 계속 더하면 택 간 성능 차이가 회전 손실로 둔갑한다. */
      var iLossEnd = idxAtTime(S, S[iEnd].t + TAIL_SEC);
      for (var q = iEnd; q <= iLossEnd && q < S.length; q++) {
        var rq = rungRateAt(rung, S, q, sgn);
        if (rq && rq.v >= vref) { iLossEnd = q; break; }
      }
      res.lossWindowSec = S[iLossEnd].t - S[iStart].t;

      /* A) VMG 적분 — 기준보다 못 낸 만큼만 더한다(더 잘 낸 구간은 0). */
      /* A 와 B 를 **같은 표본**으로 누적한다. 시간 공백(dt>5s)이나 첫
         샘플은 rungRateAt 이 건너뛰는데, B 를 vref×경과시간 으로 따로
         내면 그 건너뛴 시간이 B 에만 들어가 B>A 가 된다(실측 1건).
         같은 루프에서 부족분(A)과 순차(B)를 함께 쌓으면 정의상 B ≤ A. */
      var lossA = 0, netB = 0, usedSec = 0;
      for (var i = Math.max(1, iStart); i <= iLossEnd && i < S.length; i++) {
        var rr = rungRateAt(rung, S, i, sgn);
        if (!rr) continue;
        var diff = vref - rr.v;
        if (diff > 0) lossA += diff * rr.dt;
        netB += diff * rr.dt;
        usedSec += rr.dt;
      }
      res.vmgLossM = lossA;
      res.pathLossM = netB;
      res.measuredSec = usedSec;

      /* B) 실제 이동 기준 — 같은 시간 동안 기준 페이스를 유지했다면
         벌었을 거리와, 실제로 번 거리(rung 차)의 차이.
         A 는 부족분만 더하므로(max(0,·)) 회전 중 잘 낸 구간이 상쇄되지
         않지만, B 는 상쇄한 순손실이다. 그래서 항상 B ≤ A 이고, 둘의
         간격이 "회전 중에 만회한 양" 을 뜻한다.
         (첫 구현은 '정점에서 즉시 돌았다면' 을 진입·탈출 속도로 모사했는데
         그 반사실이 실제보다 느려서 손실이 음수로 나왔다.) */

      /* 목표 반대로 간 구간이 있었나 — "느렸다" 와 "거꾸로 갔다" 는
         같은 손실 수치라도 코칭이 다르다. */
      var wrongWay = 0;
      for (var w = Math.max(1, iStart); w <= iLossEnd && w < S.length; w++) {
        var rw = rungRateAt(rung, S, w, sgn);
        if (rw && rw.v < 0) wrongWay += rw.dt;
      }
      res.wrongWaySec = wrongWay;
      res.ok = true;
      return res;
    });
  }

  /* ---------- 레그별 이득 ----------
     지속 레그마다 바람 축으로 실제 얼마나 벌었는지. 시간당 rung 진행이
     곧 평균 VMG 라 값 자체는 새롭지 않지만, "이 레그에서 몇 미터를
     벌었나" 는 단위가 달라 코스 판단에 직접 쓰인다. */
  function legGains(session, twd, opts) {
    opts = opts || {};
    var minSec = opts.minSec != null ? opts.minSec : 25;
    var minKt = opts.minKt != null ? opts.minKt : 12;
    var S = (session && session.samples) || [];
    if (!S.length || twd == null) return [];
    var rung = ladderRung(session, twd);
    if (!rung) return [];

    var out = [], cur = null;
    function zoneOf(p) {
      if (p.twa == null || p.speed == null) return null;
      if (p.speed * KT < minKt) return null;
      var t = Math.abs(p.twa);
      if (t < 70) return 'upwind';
      if (t > 110) return 'downwind';
      return null;                      /* 리칭은 레그로 세지 않는다 */
    }
    function close(endIdx) {
      if (!cur) return;
      var dur = S[endIdx].t - S[cur.i0].t;
      if (dur >= minSec) {
        var gain = rung[endIdx] - rung[cur.i0];
        out.push({
          zone: cur.zone, side: cur.side,
          tSec: S[cur.i0].t - S[0].t,
          durationSec: dur,
          /* 풍하 레그는 rung 이 줄어드는 게 정상이라 부호를 뒤집어
             "목표 방향으로 번 거리" 로 통일한다. */
          gainM: cur.zone === 'upwind' ? gain : -gain,
          gainRateMs: (cur.zone === 'upwind' ? gain : -gain) / dur
        });
      }
      cur = null;
    }
    for (var i = 0; i < S.length; i++) {
      var z = zoneOf(S[i]);
      var side = (S[i].twa != null && S[i].twa < 0) ? 'P' : 'S';
      if (z && cur && cur.zone === z && cur.side === side) continue;
      if (cur) close(i - 1 >= cur.i0 ? i - 1 : cur.i0);
      if (z) cur = { zone: z, side: side, i0: i };
    }
    if (cur) close(S.length - 1);
    return out;
  }

  /* ---------- 방향별 총 진행량 ----------
     legGains 는 "지속 레그" 만 센다(25초 이상). 회전이 잦은 세션에서는
     그 조건을 통과하는 시간이 세션의 10% 밖에 안 될 수 있다(실측 8/31:
     95회전 · 지속레그 17개 11분 / 분석 112분).

     회전 손실은 모든 회전을 세므로, 그 손실을 지속레그 진행량으로 나누면
     분자와 분모가 서로 다른 세션을 재게 된다 — 실제로 80% 라는 무의미한
     값이 나왔다. 백분율의 분모는 **주행 중 모든 표본**의 방향별 진행량을
     쓴다. */
  function zoneProgress(session, twd, opts) {
    opts = opts || {};
    var minKt = opts.minKt != null ? opts.minKt : 12;
    var S = (session && session.samples) || [];
    var rung = ladderRung(session, twd);
    if (!rung) return { upwindM: 0, downwindM: 0, upwindSec: 0, downwindSec: 0 };
    var up = 0, down = 0, upSec = 0, downSec = 0;
    for (var i = 1; i < S.length; i++) {
      var dt = S[i].t - S[i - 1].t;
      if (!(dt > 0) || dt > 5) continue;
      if (S[i].twa == null || S[i].speed == null) continue;
      if (S[i].speed * KT < minKt) continue;
      var twa = Math.abs(S[i].twa), d = rung[i] - rung[i - 1];
      if (twa < 70) { up += d; upSec += dt; }
      else if (twa > 110) { down += -d; downSec += dt; }
    }
    return { upwindM: up, downwindM: down, upwindSec: upSec, downwindSec: downSec };
  }

  /* ---------- 바람이 자리에 따라 달랐나, 시간에 따라 달랐나 ----------
     §462. "바람 있는 데를 찾아다녔다" 는 노력이 실제로 값을 했는지를
     가른다. 답이 갈리면 다음 세션의 전략이 달라진다 —
       · 자리에 따라 다르다  → 좋은 구역을 찾아 지키는 게 이득
       · 시간에 따라 다르다  → 어디 있든 같으니, 바람 있을 때 몰아 타야 한다

     ⚠ 위치와 시간은 엉키기 쉽다. 세션 후반에 바람이 죽었는데 그때 마침
     다른 구역에 있었다면, 그 구역이 나쁜 것처럼 보인다(실제로 8/31
     자이브 효율은 구역별로 86 vs 50 이었지만 최저 구역 9개 중 5개가
     바람 죽은 마지막 구간 것이었다). 그래서 **시간 구간을 고정한 채**
     구역을 비교한다.

     그리고 선택 편향을 함께 본다 — 나쁜 구역을 잘 피해 다녔다면 "차이
     없음" 이 당연하다. 짧게 지나친 구역이 오래 머문 구역보다 느렸는지로
     확인한다. */
  function windVariation(session, opts) {
    opts = opts || {};
    var CELL = opts.cellM || 300;
    var minKt = opts.minKt || 6;
    var Q = opts.quarters || 4;
    var minCellSec = opts.minCellSec || 180;
    var S = (session && session.samples) || [];
    if (S.length < 100) return { ok: false, reason: 'too-short' };

    var lat0 = S[0].lat, lng0 = S[0].lng;
    var mPerLng = 111320 * Math.cos(lat0 * Math.PI / 180);
    function cellKey(p) {
      return Math.round(((p.lng - lng0) * mPerLng) / CELL) + ',' +
             Math.round(((p.lat - lat0) * 111132) / CELL);
    }
    var t0 = S[0].t, span = S[S.length - 1].t - t0;
    if (!(span > 0)) return { ok: false, reason: 'no-time' };

    /* 구간 × 구역별 속도 표본 */
    var byQ = [], allCells = {};
    for (var q = 0; q < Q; q++) byQ.push({});
    for (var i = 1; i < S.length; i++) {
      var dt = S[i].t - S[i - 1].t;
      if (!(dt > 0) || dt > 5) continue;
      var p = S[i];
      if (p.speed == null || p.speed * KT < minKt) continue;
      var qi = Math.min(Q - 1, Math.floor((p.t - t0) / span * Q));
      var k = cellKey(p);
      (byQ[qi][k] = byQ[qi][k] || []).push(p.speed * KT);
      var ac = allCells[k] = allCells[k] || { sec: 0, sp: [] };
      ac.sec += dt; ac.sp.push(p.speed * KT);
    }
    function med(v) {
      if (!v.length) return null;
      var a = v.slice().sort(function (x, y) { return x - y; });
      return a[a.length >> 1];
    }

    /* 시간을 고정한 채 구역 간 최대 격차 */
    var spreads = [];
    byQ.forEach(function (cells, qi) {
      var rows = Object.keys(cells)
        .filter(function (k) { return cells[k].length >= minCellSec; })
        .map(function (k) { return { key: k, med: med(cells[k]) }; });
      if (rows.length < 2) return;
      rows.sort(function (a, b) { return b.med - a.med; });
      spreads.push({
        quarter: qi + 1, cells: rows.length,
        spreadKt: rows[0].med - rows[rows.length - 1].med,
        bestKey: rows[0].key, worstKey: rows[rows.length - 1].key
      });
    });

    /* 시간에 따른 변화 — 구간별 전체 중앙 속도 */
    var byTime = byQ.map(function (cells, qi) {
      var all = [];
      Object.keys(cells).forEach(function (k) { all = all.concat(cells[k]); });
      return { quarter: qi + 1, med: med(all), samples: all.length };
    }).filter(function (r) { return r.med != null; });
    var timeSpread = byTime.length >= 2
      ? Math.max.apply(null, byTime.map(function (r) { return r.med; })) -
        Math.min.apply(null, byTime.map(function (r) { return r.med; }))
      : null;

    /* 선택 편향 점검 — 짧게 지나친 구역 vs 오래 머문 구역 */
    var brief = [], stayed = [];
    Object.keys(allCells).forEach(function (k) {
      var c = allCells[k], m = med(c.sp);
      if (m == null) return;
      if (c.sec < 90) brief.push(m);
      else if (c.sec >= 180) stayed.push(m);
    });
    var briefMed = med(brief), stayedMed = med(stayed);

    var placeSpread = spreads.length
      ? spreads.reduce(function (a, s) { return Math.max(a, s.spreadKt); }, 0)
      : null;

    return {
      ok: true,
      cellM: CELL,
      perQuarter: spreads,
      byTime: byTime,
      placeSpreadKt: placeSpread,
      timeSpreadKt: timeSpread,
      briefCellMedKt: briefMed, briefCells: brief.length,
      stayedCellMedKt: stayedMed, stayedCells: stayed.length,
      /* 회피가 통했다면 짧게 지나친 곳이 더 느려야 한다. */
      avoidanceEvident: (briefMed != null && stayedMed != null)
        ? (stayedMed - briefMed) > 1.0 : null,
      dominant: (placeSpread != null && timeSpread != null)
        ? (placeSpread > timeSpread + 0.5 ? 'place'
           : (timeSpread > placeSpread + 0.5 ? 'time' : 'neither'))
        : null
    };
  }

  /* ---------- 세션 성격 판정 ----------
     같은 지표라도 "코스를 달린 세션" 과 "회전 연습 세션" 은 읽는 법이
     다르다. 연습에서는 계속 도는 것이 목적이므로 회전 손실을 '손해' 로
     부르면 안 된다 — 그건 연습의 비용이지 실수가 아니다.

     판정: 지속 레그(25초+)에 쓴 시간이 주행 시간의 일부에 그치면
     "짧게 끊어 도는 세션" 이다. 8/31 실측 10%, 8/30 세션들은 40~70%. */
  function sessionShape(session, twd, legs, opts) {
    opts = opts || {};
    var minKt = opts.minKt != null ? opts.minKt : 12;
    var S = (session && session.samples) || [];
    var planingSec = 0;
    for (var i = 1; i < S.length; i++) {
      var dt = S[i].t - S[i - 1].t;
      if (!(dt > 0) || dt > 5) continue;
      if (S[i].speed != null && S[i].speed * KT >= minKt) planingSec += dt;
    }
    var legSec = (legs || []).reduce(function (a, l) { return a + l.durationSec; }, 0);
    var ratio = planingSec > 0 ? legSec / planingSec : 0;
    return {
      planingSec: planingSec,
      sustainedLegSec: legSec,
      sustainedShare: ratio,
      /* 임계 0.25 — 8/31(0.10) 과 8/30(0.4~0.7) 사이에서 넉넉히 가른다. */
      isDrillLike: ratio < 0.25
    };
  }

  /* ---------- 요약 ---------- */
  function summarize(losses, legs, progress) {
    var byType = {};
    var skipped = 0, counted = 0, reasons = {};
    (losses || []).forEach(function (l) {
      if (l.ok) return;
      var k = l.reason || 'unknown';
      reasons[k] = (reasons[k] || 0) + 1;
    });
    (losses || []).forEach(function (l) {
      if (!l.ok || l.vmgLossM == null) return;
      /* 종류와 관측 TWA 가 어긋나는 회전은 기준 VMG 의 전제가 무너져
         손실이 과장된다. 세지 않고 몇 개를 뺐는지만 보고한다. */
      if (l.zoneConflict) { skipped++; return; }
      counted++;
      var k = (l.type || 'turn') + '|' + (l.side || '-');
      if (!byType[k]) byType[k] = { type: l.type, side: l.side, n: 0, vmg: 0, path: 0, pathN: 0 };
      var g = byType[k];
      g.n++; g.vmg += l.vmgLossM;
      if (l.pathLossM != null) { g.path += l.pathLossM; g.pathN++; }
    });
    var groups = Object.keys(byType).map(function (k) {
      var g = byType[k];
      return {
        type: g.type, side: g.side, count: g.n,
        avgVmgLossM: g.vmg / g.n,
        totalVmgLossM: g.vmg,
        avgPathLossM: g.pathN ? g.path / g.pathN : null
      };
    }).sort(function (a, b) { return b.totalVmgLossM - a.totalVmgLossM; });

    /* 택 손실은 풍상 진행과, 자이브 손실은 풍하 진행과 견준다.
       둘을 합쳐서 한쪽 진행량으로 나누면 100% 를 넘는 무의미한 수가
       나온다(첫 구현에서 176% 가 나왔다). */
    var tackLoss = 0, gybeLoss = 0;
    groups.forEach(function (g) {
      if (g.type === 'gybe') gybeLoss += g.totalVmgLossM;
      else tackLoss += g.totalVmgLossM;
    });
    /* 백분율의 분모 — progress 가 주어지면 그것을 쓴다(주행 전 구간).
       없으면 레그 합으로 물러나되, 그 경우 분모가 세션 일부만 덮는다. */
    var legUp = 0, legDown = 0;
    (legs || []).forEach(function (l) {
      if (l.zone === 'upwind') legUp += l.gainM; else legDown += l.gainM;
    });
    var upGain = progress ? progress.upwindM : legUp;
    var downGain = progress ? progress.downwindM : legDown;
    return {
      groups: groups,
      tackLossM: tackLoss,
      gybeLossM: gybeLoss,
      totalTurnLossM: tackLoss + gybeLoss,
      upwindGainM: upGain,
      downwindGainM: downGain,
      /* 지속 레그(25초+)만의 진행량 — 레그 품질을 볼 때 쓴다.
         회전이 잦으면 이 값은 세션의 일부만 덮는다. */
      sustainedUpwindM: legUp,
      sustainedDownwindM: legDown,
      basis: progress ? 'all-planing' : 'sustained-legs',
      /* 각 회전이 그 방향의 진행을 몇 % 깎았나 — "택을 줄여야 하나" 의 근거 */
      tackLossPct: upGain > 0 ? (tackLoss / upGain) * 100 : null,
      gybeLossPct: downGain > 0 ? (gybeLoss / downGain) * 100 : null,
      skippedAmbiguous: skipped,
      countedTurns: counted,
      /* 산출하지 못한 회전과 그 사유 — 몇 개를 못 셌는지 밝히지 않으면
         합계가 전부인 것처럼 읽힌다. */
      notComputed: reasons
    };
  }

  var API = {
    ladderRung: ladderRung, maneuverLoss: maneuverLoss,
    legGains: legGains, zoneProgress: zoneProgress, sessionShape: sessionShape,
    windVariation: windVariation,
    summarize: summarize,
    EXCL_SEC: EXCL_SEC, REF_SEC: REF_SEC, TAIL_SEC: TAIL_SEC
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDGainLoss = API;
})(typeof window !== 'undefined' ? window : globalThis);
