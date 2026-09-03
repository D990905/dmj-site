/* ============================================================
 * chart-polar.js — §440 풍각-속도 폴라 다이어그램
 *
 * 왜 폴라인가: 각도가 실제 풍각(TWA)에, 반경이 속도에 그대로 대응한다.
 *   어느 포인트 오브 세일에서 빠르고 느린지가 좌표 그 자체로 읽힌다.
 *   막대나 표로는 "45도에서 느리다" 를 볼 수 없다.
 *
 * 관례대로 좌현(port)은 왼쪽, 우현(starboard)은 오른쪽에 미러링한다.
 * 위쪽이 풍상(TWA 0°), 아래쪽이 풍하(180°).
 *
 * uPlot 은 직교 좌표 전용이라 이 차트만 캔버스로 직접 그린다.
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  /* §521 — Waterspeed 벤치마킹(옥대표 "폴라그램 너무 잘만들었는데?").
     구조는 그쪽이 맞다: 각도 눈금을 원 둘레에 촘촘히, 두 계열(평소/최고)을
     겹쳐 **띠**로, 아래에 최적 각도 요약. 우리 것은 선 하나뿐이었다.

     다만 그쪽 통계는 못 쓴다. raw 를 그대로 그려 톱니가 화면을 덮고,
     표본이 없는 각도에서 선이 **중심까지 곤두박질친다**(0 으로 그린다).
     그래서 "풍하 최적각 173°" 같은 값이 나온다 — 포일에서 데드다운윈드가
     최적일 수 없다. 노이즈 argmax 다.

     우리는 세 가지를 다르게 한다:
       ① 최고(max) 대신 **p95** — max 는 표본 하나라 그냥 노이즈다
       ② 표본이 MIN_N 미만인 빈은 **끊는다**(0 으로 잇지 않는다)
       ③ 최적 각도에 **검산**을 붙인다 — 물리적으로 말이 안 되면
          숫자를 내지 않고 왜 못 내는지 적는다 */
  var MIN_N = 5;              /* 이 미만이면 그 각도는 그리지 않는다 */
  /* 검산 경계 — **양쪽 다** 막는다.
     처음엔 풍하만 막았다가 라이브에서 풍상 최적각이 **4°** 로 나왔다.
     포일이 풍상 4° 로 갈 수는 없다 — 남을 비판한 결함을 반대쪽에
     그대로 두고 있었던 것이다. 윙포일 실제 풍상 TWA 는 40~55° 이고,
     30° 아래는 어떤 장비로도 못 간다(대개 택 중 표본이 섞인 것). */
  /* ⚠⚠ **각도로 거절하지 않는다.** 두 번 틀렸다(옥대표 정정 2026-09-03):
       1차: 풍하 165° 이상을 '물리적으로 불가' 로 거절 →
            "파도가 커서 풍하 런으로 달린 구간들도 꽤 있었을거야."
            맞다. 스웰을 타면 데드다운윈드 근처가 실제로 제일 빠르다.
       2차: 그래서 풍상만 30° 로 남겼는데 →
            "풍상도 말도 안되는 각도로 올라갈때도 있엇어."
            이것도 맞다. 파도 면을 타고 올라가면 순간적으로 아주 높이 붙는다.

     교훈: **각도 값은 가능·불가능을 못 가른다.** 파도가 판을 바꾼다.
     가르는 것은 **버틴 시간**이다 — 2초 스치고 지나간 각도는 실제로
     지나갔더라도 '타깃 각도' 가 아니다. 붙잡을 수 없기 때문이다.
     그래서 여기서는 각도를 안 자르고, 화면이 **얼마나 버텼는지**를
     같이 보여 주게 한다(RDSegments.longestStretchAtTwa). */
  var EXTREME_HIGH_DEG = 35;      /* 이보다 높으면 '버텼나' 를 같이 묻는다 */
  var EXTREME_DEEP_DEG = 150;     /* 이보다 깊으면 마찬가지 */
  var OPT_MIN_N = 15;             /* 최적 각도는 이만큼은 있어야 고른다 */

  function ringsFor(maxKt) {
    var step = maxKt > 24 ? 10 : (maxKt > 12 ? 5 : 2);
    var out = [];
    for (var v = step; v <= maxKt + 0.001; v += step) out.push(v);
    return out;
  }

  /* bins: [{twaCenter, count, p95Ms, avgMs}] — count 0 은 건너뛴다.
     minN 미만도 건너뛴다: 두세 점으로 만든 '그 각도의 실력' 은 실력이
     아니라 우연이다. 건너뛴 자리는 선이 **끊긴다**(0 으로 잇지 않는다). */
  function toPoints(bins, side, metric, minN) {
    if (!bins) return [];
    var need = (minN == null) ? 1 : minN;
    var out = [];
    bins.forEach(function (b) {
      if (!b || !b.count || b.count < need) return;
      var ms = metric === 'avg' ? b.avgMs : b.p95Ms;
      if (!(ms > 0)) return;
      out.push({ twa: b.twaCenter, kt: ms * KT, side: side, count: b.count });
    });
    return out.sort(function (a, b) { return a.twa - b.twa; });
  }

  /* 연속한 각도끼리만 잇는다 — 사이에 표본 없는 빈이 있으면 끊는다.
     이걸 안 하면 데이터가 없는 구간을 직선으로 가로질러 "거기서도
     그 속도로 갔다" 는 없는 주장을 만든다. */
  function segments(pts, binDeg) {
    var gap = (binDeg || 7.5) * 1.6, out = [], cur = [];
    pts.forEach(function (p) {
      if (cur.length && (p.twa - cur[cur.length - 1].twa) > gap) {
        if (cur.length) out.push(cur);
        cur = [];
      }
      cur.push(p);
    });
    if (cur.length) out.push(cur);
    return out;
  }

  /* 최적 각도 — VMG 가 최대가 되는 빈. **검산을 붙인다.**
     upwind:   VMG = speed·cos(twa)
     downwind: VMG = speed·|cos(twa)|  (풍하 방향 진행)
     표본이 얇거나 물리적으로 말이 안 되는 결과는 값 대신 이유를 낸다. */
  function maxKtOf(sets) {
    var m = 0;
    sets.forEach(function (s) { s.forEach(function (p) { if (p.kt > m) m = p.kt; }); });
    return Math.max(m, 1);
  }

  function optimalAngle(bins, mode, minN) {
    if (!bins || !bins.length) return { ok: false, reason: 'no_data' };
    /* 그리는 기준(MIN_N=5)보다 **두껍게** 요구한다. 최적 각도는 하나의
       숫자로 단언하는 것이라, 다섯 점으로 고른 '최적' 은 최적이 아니다.
       Waterspeed 의 173° 도 결국 얇은 빈 하나였다 — 막아야 할 것은
       깊은 각도가 아니라 얇은 근거다. */
    var need = (minN == null) ? OPT_MIN_N : minN;

    /* 물리적으로 말이 안 되는 각은 **후보에서 뺀다**(거절이 아니다).
       처음엔 argmax 가 거기 걸리면 통째로 거절했는데, 그러면 멀쩡한
       답이 있는데도 아무 숫자를 못 준다. 빼고 나머지 중 최선을 주되
       **뺐다는 사실을 같이 넘긴다** — 그 표본이 많다는 건 대개
       풍향 입력이 틀렸다는 신호라서 그것 자체가 정보다. */
    /* 각도로 거르지 않는다 — 풍상/풍하 범위만 나눈다 */
    function plausible(twa) {
      if (mode === 'upwind') return twa <= 90;
      if (mode === 'downwind') return twa >= 90;
      return true;
    }
    function inMode(twa) {
      if (mode === 'upwind') return twa <= 90;
      if (mode === 'downwind') return twa >= 90;
      return true;
    }

    var best = null, considered = 0, exBins = 0, exSamples = 0, exTwa = null;
    bins.forEach(function (b) {
      if (!b || b.count < need) return;
      var twa = b.twaCenter;
      if (!inMode(twa)) return;
      var kt = (b.avgMs || 0) * KT;
      if (!(kt > 0)) return;
      if (!plausible(twa)) {
        exBins++; exSamples += b.count;
        if (exTwa == null
            || (mode === 'upwind' ? twa < exTwa : twa > exTwa)) exTwa = twa;
        return;
      }
      considered++;
      /* 풍상은 VMG 가 목적함수, 풍하는 **속도**가 기준.
         포일에서는 깊게 갈수록 VMG 가 커 보이다가 포일이 떨어진다. */
      var vmg = kt * Math.abs(Math.cos(twa * Math.PI / 180));
      var score = (mode === 'downwind') ? kt : vmg;
      if (!best || score > best.score) {
        best = { twaDeg: twa, speedKt: kt, vmgKt: vmg, count: b.count, score: score };
      }
    });

    var excluded = exBins
      ? { bins: exBins, samples: exSamples, extremeTwa: exTwa }
      : null;
    if (!considered) {
      return { ok: false,
               reason: 'need_more_samples',
               need: need, excluded: excluded,
               twaDeg: exTwa };
    }
    if (!best) return { ok: false, reason: 'no_data', excluded: excluded };

    /* 최적이 관측 범위의 끝이면 '최적' 이 아니라 '못 가 본 곳' 이다 */
    var lo = null, hi = null;
    bins.forEach(function (b) {
      if (!b || b.count < need) return;
      if (!plausible(b.twaCenter)) return;
      if (lo == null || b.twaCenter < lo) lo = b.twaCenter;
      if (hi == null || b.twaCenter > hi) hi = b.twaCenter;
    });
    best.atEdge = (best.twaDeg === lo || best.twaDeg === hi);
    best.excluded = excluded;
    /* 깊은 각이 이겼으면 숨기지 않고 **두 해석을 같이** 내놓는다:
       파도를 탔으면 진짜, 풍향이 틀렸으면 허상. 표본 수가 그 둘을 가른다. */
    /* 극단이면 값을 숨기지 않고 **표시만** 한다. 화면이 '얼마나 버텼나'
       를 붙여서 두 해석(파도 / 풍향 오차)을 같이 내놓는다. */
    if (mode === 'downwind' && best.twaDeg >= EXTREME_DEEP_DEG) best.extreme = 'deep';
    if (mode === 'upwind' && best.twaDeg <= EXTREME_HIGH_DEG) best.extreme = 'high';
    best.ok = true;
    return best;
  }

  function render(host, polar, opts) {
    opts = opts || {};
    if (!host) return null;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!polar) { host.textContent = 'Wind direction required'; return null; }

    var metric = opts.metric === 'avg' ? 'avg' : 'p95';
    var minN = (opts.minN != null) ? opts.minN : MIN_N;
    var binDeg = polar.binDeg || 7.5;
    /* §521 — 두 계열을 겹쳐 **띠**로 그린다: 안쪽 = 평소(avg),
       바깥 = 잘 됐을 때(p95). 선 하나는 "이게 내 실력" 처럼 보이지만
       실제로는 폭이 있고, 그 폭이 곧 일관성이다. */
    var portAvg = toPoints(polar.port, 'P', 'avg', minN);
    var portHi  = toPoints(polar.port, 'P', 'p95', minN);
    var stbdAvg = toPoints(polar.starboard, 'S', 'avg', minN);
    var stbdHi  = toPoints(polar.starboard, 'S', 'p95', minN);
    var port = metric === 'avg' ? portAvg : portHi;
    var stbd = metric === 'avg' ? stbdAvg : stbdHi;
    if (!port.length && !stbd.length) {
      host.textContent = minN > 1
        ? 'No wind angle has ' + minN + ' or more samples yet \u2014 not enough to draw a polar.'
        : 'Not enough sailing data';
      return null;
    }

    var maxKt = Math.ceil(maxKtOf([portHi, stbdHi, portAvg, stbdAvg]) * 1.08);
    var rings = ringsFor(maxKt);

    var size = Math.max(280, Math.min(opts.size || host.clientWidth || 420, 520));
    var dpr = global.devicePixelRatio || 1;
    var cv = document.createElement('canvas');
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    var cx = size / 2, cy = size * 0.52, R = size * 0.42;
    var GRID = opts.grid || '#2b3648', DIM = opts.dim || '#8a97a8';
    var PORT = opts.port || '#e03131', STBD = opts.starboard || '#2f9e44';

    /* TWA(도) + 좌우 → 화면 좌표. 위쪽이 풍상. */
    function pos(twa, kt, side) {
      var r = (kt / maxKt) * R;
      var rad = (twa * Math.PI) / 180;
      var dx = Math.sin(rad) * r * (side === 'P' ? -1 : 1);
      var dy = -Math.cos(rad) * r;
      return [cx + dx, cy + dy];
    }

    /* 반경 눈금 */
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    rings.forEach(function (v) {
      ctx.beginPath(); ctx.arc(cx, cy, (v / maxKt) * R, 0, Math.PI * 2); ctx.stroke();
    });
    /* 각도 눈금 30° 간격 (살) + 10° 간격 (테두리 눈금).
       §521 — 촘촘한 눈금이 있어야 "50도인가 60도인가" 를 눈으로 읽는다.
       살까지 10° 로 그으면 화면이 거미줄이 되므로 테두리에만 짧게 친다. */
    ctx.beginPath();
    for (var a = 0; a <= 180; a += 30) {
      [ -1, 1 ].forEach(function (sgn) {
        var rad = (a * Math.PI) / 180;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(rad) * R * sgn, cy - Math.cos(rad) * R);
      });
    }
    ctx.stroke();
    ctx.beginPath();
    for (var a2 = 0; a2 <= 180; a2 += 10) {
      if (a2 % 30 === 0) continue;
      [ -1, 1 ].forEach(function (sgn) {
        var rad = (a2 * Math.PI) / 180;
        var ux = Math.sin(rad) * sgn, uy = -Math.cos(rad);
        ctx.moveTo(cx + ux * R, cy + uy * R);
        ctx.lineTo(cx + ux * (R - 6), cy + uy * (R - 6));
      });
    }
    ctx.stroke();

    /* 라벨 */
    ctx.fillStyle = DIM;
    ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    rings.forEach(function (v) {
      ctx.fillText(v + ' kt', cx + 2, cy - (v / maxKt) * R - 8);
    });
    /* 각도 숫자 — 30° 마다 양쪽에 */
    ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (var a3 = 30; a3 <= 150; a3 += 30) {
      [ -1, 1 ].forEach(function (sgn) {
        var rad = (a3 * Math.PI) / 180;
        var ux = Math.sin(rad) * sgn, uy = -Math.cos(rad);
        ctx.fillText(a3 + '\u00b0', cx + ux * (R + 13), cy + uy * (R + 13));
      });
    }
    ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText('0° upwind', cx, cy - R - 16);
    ctx.fillText('180° downwind', cx, cy + R + 18);
    ctx.textAlign = 'right'; ctx.fillText('port', cx - R - 6, cy);
    ctx.textAlign = 'left';  ctx.fillText('stbd', cx + R + 6, cy);

    /* ---- 띠 (평소 ~ 잘 됐을 때) ----
       두 계열의 각도가 같은 구간에서만 채운다. 한쪽에만 있는 각도를
       이어 붙이면 없는 면적을 만든다. */
    function bandFill(avgPts, hiPts, color) {
      var byTwa = {};
      avgPts.forEach(function (p) { byTwa[p.twa] = { a: p }; });
      hiPts.forEach(function (p) { if (byTwa[p.twa]) byTwa[p.twa].h = p; });
      var pairs = Object.keys(byTwa).map(function (k) { return byTwa[k]; })
        .filter(function (o) { return o.h; })
        .sort(function (x, y) { return x.a.twa - y.a.twa; });
      segments(pairs.map(function (o) { return o.a; }), binDeg).forEach(function (seg) {
        if (seg.length < 2) return;
        var lo = seg, hi = seg.map(function (p) { return byTwa[p.twa].h; });
        ctx.beginPath();
        hi.forEach(function (p, i) {
          var xy = pos(p.twa, p.kt, p.side);
          if (i === 0) ctx.moveTo(xy[0], xy[1]); else ctx.lineTo(xy[0], xy[1]);
        });
        for (var i = lo.length - 1; i >= 0; i--) {
          var xy2 = pos(lo[i].twa, lo[i].kt, lo[i].side);
          ctx.lineTo(xy2[0], xy2[1]);
        }
        ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
      });
    }

    /* ---- 선 — 표본 없는 각도에서 **끊는다** ---- */
    function drawSide(pts, color, width, dots) {
      segments(pts, binDeg).forEach(function (seg) {
        if (seg.length >= 2) {
          ctx.beginPath();
          seg.forEach(function (p, i) {
            var xy = pos(p.twa, p.kt, p.side);
            if (i === 0) ctx.moveTo(xy[0], xy[1]); else ctx.lineTo(xy[0], xy[1]);
          });
          ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.lineJoin = 'round';
          ctx.stroke();
        }
        if (dots) {
          ctx.fillStyle = color;
          seg.forEach(function (p) {
            var xy = pos(p.twa, p.kt, p.side);
            ctx.beginPath(); ctx.arc(xy[0], xy[1], 2.6, 0, Math.PI * 2); ctx.fill();
          });
        }
      });
    }

    var showBand = opts.band !== false;
    if (showBand) {
      bandFill(portAvg, portHi, hexA(PORT, 0.18));
      bandFill(stbdAvg, stbdHi, hexA(STBD, 0.18));
      drawSide(portAvg, hexA(PORT, 0.55), 1.4, false);
      drawSide(stbdAvg, hexA(STBD, 0.55), 1.4, false);
      drawSide(portHi, PORT, 2.2, true);
      drawSide(stbdHi, STBD, 2.2, true);
    } else {
      drawSide(port, PORT, 2, true);
      drawSide(stbd, STBD, 2, true);
    }

    /* ---- 툴팁 — 그 각도에서 평소/최고/표본수 ---- */
    var all = portHi.concat(stbdHi).concat(portAvg).concat(stbdAvg);
    var tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;pointer-events:none;display:none;'
      + 'background:rgba(15,22,36,.94);color:#e6edf5;border:1px solid ' + GRID + ';'
      + 'border-radius:6px;padding:6px 8px;font:11px/1.45 "IBM Plex Mono",monospace;'
      + 'white-space:nowrap;z-index:5';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(tip);
    function lookup(twa, side) {
      function find(arr) {
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].twa === twa && arr[i].side === side) return arr[i];
        }
        return null;
      }
      return { avg: find(side === 'P' ? portAvg : stbdAvg),
               hi: find(side === 'P' ? portHi : stbdHi) };
    }
    cv.addEventListener('mousemove', function (ev) {
      var r = cv.getBoundingClientRect();
      var mx = ev.clientX - r.left, my = ev.clientY - r.top;
      var dx = mx - cx, dy = my - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > R + 8) { tip.style.display = 'none'; return; }
      var side = dx < 0 ? 'P' : 'S';
      var twaRaw = Math.atan2(Math.abs(dx), -dy) * 180 / Math.PI;
      var bin = (Math.floor(twaRaw / binDeg) + 0.5) * binDeg;
      var got = lookup(bin, side);
      if (!got.avg && !got.hi) { tip.style.display = 'none'; return; }
      var n = (got.hi || got.avg).count;
      tip.innerHTML = '<b>' + Math.round(bin) + '\u00b0 '
        + (side === 'P' ? 'port' : 'starboard') + '</b><br>'
        + 'usual ' + (got.avg ? got.avg.kt.toFixed(1) : '\u2014') + ' kt'
        + ' \u00b7 best 5% ' + (got.hi ? got.hi.kt.toFixed(1) : '\u2014') + ' kt<br>'
        + '<span style="opacity:.7">' + n + ' samples</span>';
      tip.style.display = 'block';
      tip.style.left = Math.min(mx + 12, size - 150) + 'px';
      tip.style.top = Math.max(0, my - 44) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });

    return { canvas: cv, maxKt: maxKt, port: port, starboard: stbd, metric: metric,
             minN: minN, banded: showBand,
             drawn: { portAvg: portAvg.length, portHi: portHi.length,
                      stbdAvg: stbdAvg.length, stbdHi: stbdHi.length } };
  }

  /* #rrggbb + 알파 → rgba(). 캔버스 채우기에 알파가 필요하다. */
  function hexA(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 'rgba(128,128,128,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var API = { render: render, optimalAngle: optimalAngle,
    _test: { toPoints: toPoints, ringsFor: ringsFor, maxKtOf: maxKtOf,
             segments: segments, optimalAngle: optimalAngle, hexA: hexA,
             MIN_N: MIN_N, OPT_MIN_N: OPT_MIN_N,
             EXTREME_HIGH_DEG: EXTREME_HIGH_DEG,
             EXTREME_DEEP_DEG: EXTREME_DEEP_DEG } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDPolar = API;
})(typeof window !== 'undefined' ? window : globalThis);
