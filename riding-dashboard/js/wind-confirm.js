/* ============================================================
 * wind-confirm.js — 풍향 확인 (§505)
 *
 * 왜 만드나
 *   풍향이 틀리면 택/자이브 분류·VMG·폴라·Tack bias 가 전부 틀어진다.
 *   그런데 지금 UI 는 **숫자 입력칸 하나**다. 218 을 넣든 211 을 넣든
 *   화면에서 뭐가 달라지는지 안 보인다(§428 이 이 얘기였다).
 *
 * 밴티지는 위성지도에 바람 화살표를 깔고 슬라이더로 돌리게 한다.
 * 눈으로 트랙과 대조하는 건 숫자보다 낫다. 하지만 여전히 **눈대중**이다.
 *
 * 여기서 한 걸음 더 간다:
 *   **포트와 스타보드의 풍상 각도가 같아지는 풍향을 계산한다.**
 *
 *   근거: 풍향을 δ 만큼 잘못 넣으면 한쪽 CWA 는 +δ, 반대쪽은 −δ 가 된다.
 *   따라서 **P/S 각도 차이는 풍향 오차의 2배**다. 반대로, 그 차이를
 *   0 으로 만드는 풍향이 트랙이 말하는 최적 풍향이다.
 *
 * ⚠ 한계를 분명히 한다 — 이건 **"라이더가 좌우 대칭으로 탄다"** 는 가정
 *   위에 선다. 실제로 한쪽을 못 타는 사람이면 그 비대칭까지 풍향으로
 *   흡수해 버린다. 그래서 이 값은 **제안**이지 정답이 아니고, 화면도
 *   그렇게 말해야 한다. §421 에서 우리가 배운 것이 이것이다.
 *
 * 브라우저: RDWindConfirm  ·  Node: require('./wind-confirm')
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  /* 코스풍각 — 부호 없는 0~180 */
  function cwaOf(headingDeg, windDirDeg) {
    return Math.abs(((headingDeg - windDirDeg + 540) % 360) - 180);
  }
  /* 어느 택인가 — 바람 기준 왼쪽/오른쪽.
     signed 각이 음수면 포트, 양수면 스타보드. */
  function tackOf(headingDeg, windDirDeg) {
    var d = ((headingDeg - windDirDeg + 540) % 360) - 180;
    return d < 0 ? 'P' : 'S';
  }

  function mean(a) {
    if (!a.length) return null;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }

  /* 한 풍향에서의 풍상 P/S 평균각과 그 차이.
     opts.upwindMax — 이 각도 안쪽만 '풍상' 으로 본다 (기본 70°)
     opts.minSpeedKt — 이 속도 위만 (기본 8kt, 활주 전은 방향이 의미 없다) */
  function asymmetryAt(samples, windDir, opts) {
    opts = opts || {};
    var upMax = opts.upwindMax || 70;
    var minKt = opts.minSpeedKt != null ? opts.minSpeedKt : 8;
    var P = [], S = [];
    for (var i = 0; i < samples.length; i++) {
      var p = samples[i];
      if (p.speed == null || p.heading == null) continue;
      if (p.speed * KT < minKt) continue;
      var c = cwaOf(p.heading, windDir);
      if (c > upMax) continue;
      (tackOf(p.heading, windDir) === 'P' ? P : S).push(c);
    }
    if (P.length < 20 || S.length < 20) return null;
    var mp = mean(P), ms = mean(S);
    return { windDir: windDir, port: mp, stbd: ms,
             diff: ms - mp, absDiff: Math.abs(ms - mp),
             nP: P.length, nS: S.length };
  }

  /* 풍향을 훑어 비대칭이 최소인 지점을 찾는다.
     range — 중심에서 ±몇 도까지 (기본 25) · step (기본 1) */
  function sweep(samples, centerDir, opts) {
    opts = opts || {};
    var range = opts.range || 25, step = opts.step || 1;
    var pts = [], best = null;
    for (var d = -range; d <= range; d += step) {
      var wd = ((centerDir + d) % 360 + 360) % 360;
      var r = asymmetryAt(samples, wd, opts);
      if (!r) { pts.push({ offset: d, windDir: wd, absDiff: null }); continue; }
      r.offset = d;
      pts.push(r);
      if (!best || r.absDiff < best.absDiff) best = r;
    }
    return { points: pts, best: best, center: centerDir };
  }

  /* 화면에 쓸 한 줄. 최적이 입력과 얼마나 떨어져 있는지가 요점이다. */
  function verdict(sw, currentDir) {
    if (!sw || !sw.best) return null;
    var off = ((sw.best.windDir - currentDir + 540) % 360) - 180;
    return {
      bestDir: sw.best.windDir,
      offsetDeg: off,
      bestAbsDiff: sw.best.absDiff,
      /* 5° 넘게 벌어지면 눈여겨볼 만하다 */
      notable: Math.abs(off) >= 5
    };
  }

  var API = { cwaOf: cwaOf, tackOf: tackOf, asymmetryAt: asymmetryAt,
              sweep: sweep, verdict: verdict, mean: mean };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDWindConfirm = API;
})(typeof window !== 'undefined' ? window : globalThis);
