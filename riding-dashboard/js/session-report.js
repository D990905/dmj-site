/* §556 세션 해석 리포트 — RDReport
   ────────────────────────────────────────────────────────────────
   옥대표: "리포트는 너무 대시보드 각각의 화면에 집중해서 만들지말고 말그대로
           세션에 대한 리포트라서 좀 더 독창적이고 창의적인 접근으로 실제
           윙포일을 모르는 사람이 봐도 이해될 정도의 해석용 리포트"

   기존 PDF(pdf-export.js)는 화면을 종이에 옮긴 것이다 — 차트를 캡처해
   페이지에 배치한다. 그래서 그 차트를 이미 아는 사람만 읽을 수 있다.

   이 모듈은 반대로 간다: **숫자에서 이야기를 뽑아** 문장으로 쓰고, 도판은
   그 문장을 뒷받침할 때만 그린다. 윙포일을 모르는 사람이 처음부터 끝까지
   읽을 수 있어야 한다.

   원칙
     · 모든 수치는 실제 분석에서 나온다. 예시·자리표시자를 쓰지 않는다.
     · 해석은 데이터가 뒷받침하는 만큼만 한다. 표본이 얇으면 그렇다고 쓴다.
     · 모르는 것은 모른다고 쓴다(풍속은 입력값이지 측정값이 아니다).
     · 도판은 자기 축을 스스로 설명한다.
*/
(function (global) {
  'use strict';

  var KT = 1.94384;

  /* ---------- 작은 도구들 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function clock(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? (h + '시간 ' + m + '분') : (m ? (m + '분 ' + s + '초') : (s + '초'));
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function n1(v) { return (v == null || !isFinite(v)) ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
  function n0(v) { return (v == null || !isFinite(v)) ? '—' : String(Math.round(v)); }
  function pct(v) { return (v == null || !isFinite(v)) ? '—' : Math.round(v) + '%'; }

  /* 8방위 — 각도만 적으면 방향이 그려지지 않는다 */
  function compass(deg) {
    if (deg == null || !isFinite(deg)) return null;
    var names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
    return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  }
  /* 보퍼트에 기대지 않고, 윙포일러가 실제로 쓰는 말로 */
  function windWords(kt) {
    if (kt == null) return null;
    if (kt < 10) return '거의 안 부는';
    if (kt < 14) return '약한';
    if (kt < 18) return '알맞은';
    if (kt < 24) return '센';
    return '아주 센';
  }

  /* ---------- 데이터 정리 ---------- */
  /* analysis 구조가 버전마다 조금씩 다르므로, 리포트가 쓰는 값만 한 곳에서
     뽑아 정규화한다. 없는 값은 null 로 두고, 본문에서 그 사실을 쓴다. */
  function collect(opts) {
    var an = opts.analysis || {};
    var sess = opts.session || {};
    var S = an.summary || {};
    var st = an.maneuverStats || {};
    var M = an.maneuvers || [];

    var samples = sess.samples || [];
    var foilKt = st.foilSpeedKt != null ? st.foilSpeedKt : 11;

    /* 포일링 시간 — 임계 속도 이상으로 보낸 시간 */
    var foilSec = 0, movedSec = 0;
    for (var i = 1; i < samples.length; i++) {
      var dt = (samples[i].t - samples[i - 1].t);
      if (!(dt > 0) || dt > 30) continue;
      var kt = (samples[i].speed || 0) * KT;
      if (kt >= foilKt) foilSec += dt;
      if (kt >= 1) movedSec += dt;
    }

    var turns = M.map(function (m) {
      return {
        tSec: m.tSec,
        type: m.type,                         /* 'tack' | 'gybe' | 'turn' */
        dir: m.turnDir,                       /* 'port' | 'starboard' */
        ok: !!m.completed,
        lossPct: m.lossPct,
        recSec: m.recoverySec,
        inKt: (m.entrySpeedMs || 0) * KT,
        outKt: (m.exitSpeedMs || 0) * KT,
        minKt: (m.minSpeedMs || 0) * KT,
        durSec: m.durationSec
      };
    });

    return {
      title: opts.title || '라이딩 세션',
      startEpoch: sess.startEpoch || opts.dateEpoch || null,
      km: (S.totalDistanceM || 0) / 1000,
      movingSec: S.movingTimeSec || 0,
      totalSec: S.totalDurationSec || 0,
      analyzedSec: S.analyzedDurationSec || S.totalDurationSec || 0,
      excludedSec: S.excludedSec || 0,
      maxKt: (S.maxSpeedMs || 0) * KT,
      avgKt: (S.avgSpeedMovingMs || 0) * KT,
      foilSec: foilSec,
      movedSec: movedSec,
      foilKt: foilKt,
      windDir: an.windDir,
      windKt: opts.windKt != null ? opts.windKt : null,
      windEstimated: !!opts.windEstimated,
      rider: opts.rider || null,
      gear: opts.gear || null,
      sps: opts.sps != null ? opts.sps : null,
      hist: an.histogram || [],
      peaks: an.peaks || [],
      bests: an.distanceBests || [],
      alpha: an.alpha || null,
      stats: st,
      turns: turns,
      samples: samples
    };
  }

  /* ---------- 해석 ---------- */
  /* 이 세션에서 가장 할 말이 많은 것을 고른다. 후보마다 '증거의 세기'를
     매기고 가장 센 것을 머리기사로 쓴다 — 늘 같은 항목을 쓰면 리포트가
     아니라 양식이 된다. */
  function findLede(D) {
    var st = D.stats, cands = [];

    var tackN = st.tack || 0, gybeN = st.gybe || 0;
    var tackLoss = st.avgTackLossPct, gybeLoss = st.avgGybeLossPct;
    var tackRate = st.tackSuccessRate, gybeRate = st.gybeSuccessRate;

    /* ① 택/자이브 비대칭 — 표본이 양쪽 다 있어야 말할 수 있다 */
    if (tackN >= 4 && gybeN >= 4 && tackLoss != null && gybeLoss != null) {
      var gap = tackLoss - gybeLoss;
      if (Math.abs(gap) >= 12) {
        cands.push({
          key: 'turn-asym',
          weight: Math.abs(gap) + Math.min(tackN, gybeN),
          gap: gap,
          harder: gap > 0 ? 'tack' : 'gybe'
        });
      }
    }
    /* ② 성공률 격차 */
    if (tackN >= 4 && gybeN >= 4 && tackRate != null && gybeRate != null) {
      var rgap = gybeRate - tackRate;
      if (Math.abs(rgap) >= 20) {
        cands.push({ key: 'success-gap', weight: Math.abs(rgap) * 0.7 + Math.min(tackN, gybeN), rgap: rgap });
      }
    }
    /* ③ 포일링 비중이 매우 높거나 낮다 */
    var fShare = D.movedSec > 0 ? D.foilSec / D.movedSec : 0;
    if (fShare >= 0.8) cands.push({ key: 'foil-high', weight: 30 + fShare * 20, share: fShare });
    else if (fShare > 0 && fShare <= 0.45) cands.push({ key: 'foil-low', weight: 30 + (0.45 - fShare) * 60, share: fShare });
    /* ④ 속도 일관성 — 주행 구간 표준편차가 좁다 */
    var sp = ridingSpread(D);
    if (sp && sp.sd <= 2.5 && sp.share >= 0.25) {
      cands.push({ key: 'steady', weight: 25 + (2.5 - sp.sd) * 8, sd: sp.sd, mean: sp.mean });
    }

    cands.sort(function (a, b) { return b.weight - a.weight; });
    return cands.length ? cands[0] : { key: 'plain', weight: 0 };
  }

  /* 주행 중(포일링 임계 이상) 평균과 표준편차.
     ⚠ 전체 분포는 쌍봉이다 — 정지·표류가 0kt 근처에 쌓이므로 전체 평균±SD 는
     아무도 지나가지 않은 골짜기에 앉는다(§541 에서 실측). 주행 구간만 잰다. */
  function ridingSpread(D) {
    var h = D.hist;
    if (!h || !h.length) return null;
    var sw = 0, sx = 0, all = 0;
    h.forEach(function (b) {
      var t = b.seconds || 0, c = (b.fromKt + b.toKt) / 2;
      all += t;
      if (c < D.foilKt) return;
      sw += t; sx += c * t;
    });
    if (!(sw > 0)) return null;
    var mean = sx / sw, v = 0;
    h.forEach(function (b) {
      var t = b.seconds || 0, c = (b.fromKt + b.toKt) / 2;
      if (c < D.foilKt) return;
      v += t * (c - mean) * (c - mean);
    });
    return { mean: mean, sd: Math.sqrt(v / sw), share: all > 0 ? sw / all : 0 };
  }

  /* ---------- 도판 ---------- */

  /* 항적 — 위경도를 화면 좌표로 정규화해 그린다. 타일 없이 자족적이어야
     한다(리포트는 인터넷 없이도 열려야 한다). 색은 속도. */
  function plateTrack(D) {
    var S = D.samples;
    if (!S || S.length < 20) return '';
    var mnla = 9e9, mxla = -9e9, mnlo = 9e9, mxlo = -9e9;
    for (var i = 0; i < S.length; i++) {
      if (S[i].lat < mnla) mnla = S[i].lat;
      if (S[i].lat > mxla) mxla = S[i].lat;
      if (S[i].lng < mnlo) mnlo = S[i].lng;
      if (S[i].lng > mxlo) mxlo = S[i].lng;
    }
    var latMid = (mnla + mxla) / 2;
    var kx = Math.cos(latMid * Math.PI / 180);
    var w = (mxlo - mnlo) * kx, h = (mxla - mnla);
    if (!(w > 0) || !(h > 0)) return '';
    var VB = 760, pad = 26;
    var sc = (VB - pad * 2) / Math.max(w, h);
    var W = Math.round(w * sc) + pad * 2, H = Math.round(h * sc) + pad * 2;
    var step = Math.max(1, Math.floor(S.length / 900));

    /* 속도 구간별로 선을 나눠 그린다 — 한 색으로 그리면 어디가 빨랐는지
       알 수 없고, 점마다 색을 바꾸면 파일이 커진다. */
    var segs = [], cur = null;
    function band(kt) { return kt < D.foilKt ? 0 : (kt < D.foilKt + 6 ? 1 : 2); }
    for (var j = 0; j < S.length; j += step) {
      var p = S[j];
      var x = (p.lng - mnlo) * kx * sc + pad;
      var y = (mxla - p.lat) * sc + pad;
      var b = band((p.speed || 0) * KT);
      if (!cur || cur.b !== b) {
        if (cur) cur.d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
        cur = { b: b, d: 'M' + x.toFixed(1) + ' ' + y.toFixed(1) };
        segs.push(cur);
      } else {
        cur.d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
      }
    }
    var colors = ['var(--stall)', 'var(--gold)', 'var(--foil)'];
    var widths = [1.1, 1.4, 1.7];
    var paths = segs.map(function (s) {
      return '<path d="' + s.d + '" fill="none" stroke="' + colors[s.b] + '" stroke-width="'
        + widths[s.b] + '" stroke-opacity="' + (s.b === 0 ? 0.55 : 0.9)
        + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');

    /* 축척 막대 — 지도는 크기를 알 수 없으면 그림일 뿐이다 */
    var spanM = Math.max(w, h) * 111320;
    var nice = [100, 200, 500, 1000, 2000, 5000];
    var barM = nice[0];
    for (var k = 0; k < nice.length; k++) if (nice[k] <= spanM / 3) barM = nice[k];
    var barPx = barM / 111320 * sc;

    /* 바람 화살 — 항적의 지그재그가 왜 생기는지 설명하려면 방향이 있어야 한다 */
    var windArrow = '';
    if (D.windDir != null) {
      var cx = W - pad - 46, cy = pad + 46, r = 26;
      var a = (D.windDir + 180) * Math.PI / 180;   /* 바람이 '가는' 쪽 */
      var ax = cx + Math.sin(a) * r, ay = cy - Math.cos(a) * r;
      windArrow =
        '<g opacity="0.85">'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" '
        + 'stroke="var(--rule)" stroke-width="1"/>'
        + '<line x1="' + (cx - Math.sin(a) * r) + '" y1="' + (cy + Math.cos(a) * r) + '" '
        + 'x2="' + ax + '" y2="' + ay + '" stroke="var(--ink)" stroke-width="1.6"/>'
        + '<circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="3.4" fill="var(--ink)"/>'
        + '<text x="' + cx + '" y="' + (cy + r + 15) + '" text-anchor="middle" '
        + 'class="fig-tick">바람 ' + n0(D.windDir) + '°</text>'
        + '</g>';
    }

    return ''
      + '<svg viewBox="0 0 ' + W + ' ' + (H + 34) + '" class="plate-svg" role="img" '
      + 'aria-label="세션 항적">'
      + paths
      + windArrow
      + '<g>'
      + '<line x1="' + pad + '" y1="' + (H + 14) + '" x2="' + (pad + barPx) + '" y2="' + (H + 14) + '" '
      + 'stroke="var(--ink)" stroke-width="1.4"/>'
      + '<line x1="' + pad + '" y1="' + (H + 10) + '" x2="' + pad + '" y2="' + (H + 18) + '" stroke="var(--ink)" stroke-width="1.4"/>'
      + '<line x1="' + (pad + barPx) + '" y1="' + (H + 10) + '" x2="' + (pad + barPx) + '" y2="' + (H + 18) + '" stroke="var(--ink)" stroke-width="1.4"/>'
      + '<text x="' + (pad + barPx + 8) + '" y="' + (H + 18) + '" class="fig-tick">'
      + (barM >= 1000 ? (barM / 1000) + ' km' : barM + ' m') + '</text>'
      + '</g>'
      + '</svg>';
  }

  /* 세션의 리듬 — 시간에 따른 속도. 쉬는 구간과 달리는 구간이 눈에 보인다. */
  function plateRhythm(D) {
    var S = D.samples;
    if (!S || S.length < 20) return '';
    var W = 900, H = 190, padL = 44, padR = 14, padT = 12, padB = 26;
    var t0 = S[0].t, t1 = S[S.length - 1].t;
    var span = Math.max(1, t1 - t0);
    var maxKt = Math.max(D.maxKt, 10);
    var yMax = Math.ceil(maxKt / 5) * 5;
    var step = Math.max(1, Math.floor(S.length / 900));
    var pts = [];
    for (var i = 0; i < S.length; i += step) {
      var x = padL + (S[i].t - t0) / span * (W - padL - padR);
      var y = H - padB - Math.min(1, ((S[i].speed || 0) * KT) / yMax) * (H - padT - padB);
      pts.push(x.toFixed(1) + ' ' + y.toFixed(1));
    }
    var line = 'M' + pts.join(' L');
    var area = line + ' L' + (padL + (W - padL - padR)).toFixed(1) + ' ' + (H - padB)
      + ' L' + padL + ' ' + (H - padB) + ' Z';

    /* 포일링 임계선 — 이 선 위가 '떠 있는' 상태다 */
    var fy = H - padB - Math.min(1, D.foilKt / yMax) * (H - padT - padB);

    var ticks = '';
    for (var v = 0; v <= yMax; v += (yMax > 24 ? 10 : 5)) {
      var ty = H - padB - (v / yMax) * (H - padT - padB);
      ticks += '<line x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1)
        + '" stroke="var(--rule)" stroke-width="0.6" stroke-opacity="0.7"/>'
        + '<text x="' + (padL - 8) + '" y="' + (ty + 3.5).toFixed(1) + '" text-anchor="end" class="fig-tick">' + v + '</text>';
    }
    var xt = '';
    var mins = Math.floor(span / 60);
    var tickEvery = mins > 90 ? 1800 : (mins > 40 ? 900 : 300);
    for (var s = 0; s <= span; s += tickEvery) {
      var xx = padL + s / span * (W - padL - padR);
      xt += '<text x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="fig-tick">'
        + mmss(s) + '</text>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="plate-svg" role="img" aria-label="시간에 따른 속도">'
      + ticks
      + '<path d="' + area + '" fill="var(--foil)" fill-opacity="0.10"/>'
      + '<line x1="' + padL + '" y1="' + fy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + fy.toFixed(1)
      + '" stroke="var(--foil)" stroke-width="1" stroke-dasharray="4 4"/>'
      + '<text x="' + (W - padR) + '" y="' + (fy - 6).toFixed(1) + '" text-anchor="end" class="fig-tick" '
      + 'fill="var(--foil)">' + D.foilKt + 'kt — 이 위가 떠 있는 상태</text>'
      + '<path d="' + line + '" fill="none" stroke="var(--foil)" stroke-width="1.1" stroke-linejoin="round"/>'
      + '<text x="' + (padL - 8) + '" y="' + (padT + 2) + '" text-anchor="end" class="fig-tick">kt</text>'
      + xt
      + '</svg>';
  }

  /* 회전 하나하나 — 가로는 시간, 세로는 잃은 속도의 비율.
     모양으로 종류를, 색으로 성패를 나눈다(색만으로 구분하지 않는다). */
  function plateTurns(D) {
    var T = D.turns.filter(function (t) { return t.lossPct != null; });
    if (T.length < 3) return '';
    var W = 900, H = 250, padL = 46, padR = 16, padT = 16, padB = 34;
    var t1 = Math.max.apply(null, T.map(function (t) { return t.tSec; })) || 1;
    var marks = T.map(function (t) {
      var x = padL + (t.tSec / t1) * (W - padL - padR);
      var y = padT + Math.min(1, t.lossPct / 100) * (H - padT - padB);
      var col = t.ok ? 'var(--foil)' : 'var(--stall)';
      if (t.type === 'tack') {
        /* 택 = 삼각형(바람 쪽으로 올라간다) */
        return '<path d="M' + x.toFixed(1) + ' ' + (y - 5).toFixed(1)
          + ' L' + (x + 4.6).toFixed(1) + ' ' + (y + 3.6).toFixed(1)
          + ' L' + (x - 4.6).toFixed(1) + ' ' + (y + 3.6).toFixed(1) + ' Z" fill="' + col
          + '" fill-opacity="' + (t.ok ? 0.85 : 1) + '"/>';
      }
      /* 자이브 = 원(바람을 등지고 돈다) */
      return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + col
        + '" fill-opacity="' + (t.ok ? 0.7 : 1) + '"/>';
    }).join('');
    var grid = '';
    [0, 25, 50, 75, 100].forEach(function (v) {
      var y = padT + (v / 100) * (H - padT - padB);
      grid += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y
        + '" stroke="var(--rule)" stroke-width="0.6"/>'
        + '<text x="' + (padL - 8) + '" y="' + (y + 3.5) + '" text-anchor="end" class="fig-tick">' + v + '%</text>';
    });
    var xt = '';
    var tickEvery = t1 > 5400 ? 1800 : 900;
    for (var s = 0; s <= t1; s += tickEvery) {
      var xx = padL + s / t1 * (W - padL - padR);
      xt += '<text x="' + xx.toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" class="fig-tick">'
        + mmss(s) + '</text>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="plate-svg" role="img" '
      + 'aria-label="회전마다 잃은 속도">'
      + grid + marks + xt
      + '<text x="' + (padL - 8) + '" y="' + (padT - 4) + '" text-anchor="end" class="fig-tick">잃은 속도</text>'
      + '</svg>';
  }

  /* 속도가 머문 곳 — 시간 가중 분포 */
  function plateHist(D) {
    var h = D.hist;
    if (!h || !h.length) return '';
    var W = 900, H = 210, padL = 46, padR = 16, padT = 14, padB = 34;
    var maxSec = 0;
    h.forEach(function (b) { if ((b.seconds || 0) > maxSec) maxSec = b.seconds || 0; });
    if (!(maxSec > 0)) return '';
    var bw = (W - padL - padR) / h.length;
    var bars = h.map(function (b, i) {
      var hh = (b.seconds || 0) / maxSec * (H - padT - padB);
      var x = padL + i * bw + bw * 0.12;
      var y = H - padB - hh;
      var mid = (b.fromKt + b.toKt) / 2;
      var col = mid < D.foilKt ? 'var(--stall)' : 'var(--foil)';
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.76).toFixed(1)
        + '" height="' + Math.max(0, hh).toFixed(1) + '" fill="' + col + '" fill-opacity="'
        + (mid < D.foilKt ? 0.35 : 0.8) + '" rx="1.5"/>';
    }).join('');
    var xt = h.map(function (b, i) {
      if (i % 2) return '';
      var x = padL + i * bw + bw / 2;
      return '<text x="' + x.toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" class="fig-tick">'
        + b.fromKt + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="plate-svg" role="img" aria-label="속도 분포">'
      + bars + xt
      + '<text x="' + (W - padR) + '" y="' + (H - 14) + '" text-anchor="end" class="fig-tick">kt</text>'
      + '<text x="' + (padL - 8) + '" y="' + (padT + 2) + '" text-anchor="end" class="fig-tick">머문 시간</text>'
      + '</svg>';
  }

  global.RDReport = {
    collect: collect,
    findLede: findLede,
    ridingSpread: ridingSpread,
    _fmt: { clock: clock, mmss: mmss, n0: n0, n1: n1, pct: pct, compass: compass, windWords: windWords },
    _plates: { track: plateTrack, rhythm: plateRhythm, turns: plateTurns, hist: plateHist }
  };
})(typeof window !== 'undefined' ? window : this);
