/* ============================================================
 * track-editor.js — 트랙 편집 타임라인 위젯
 * 속도 프로파일 위에서 시작/끝 trim 핸들을 드래그하고, 본문을
 * 드래그해 제외 구간을 만든다. 제외 구간을 탭하면 삭제.
 * 마우스·터치 모두 지원 (Pointer Events).
 *
 * RDEditor.render(canvasId, fullSession, editState, callbacks)
 *   callbacks.onChange(editState)  — trim/제외 확정 시
 *   callbacks.onCursor(tSec|null)  — hover·드래그 중 커서 위치(전체 세션 기준 초)
 * RDEditor.setCursor(tSec|null)    — 외부(지도·차트)에서 커서 위치 주입
 * ============================================================ */
(function (global) {
  'use strict';

  var PAD = 12;             // 좌우 여백(px)
  var HANDLE_HIT = 16;      // 핸들 터치 허용 반경(px)
  var MIN_EXCLUDE_SEC = 5;  // 최소 제외 구간 길이
  var MIN_KEEP_SEC = 10;    // trim 후 최소 남는 길이

  var W = {};               // 현재 위젯 상태

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function render(canvasId, fullSession, editState, callbacks) {
    var cv = document.getElementById(canvasId);
    if (!cv || !fullSession || !fullSession.hasTime) return;
    var S = fullSession.samples;
    var fullDur = S[S.length - 1].t;
    W = {
      cv: cv, S: S, fullDur: fullDur,
      edit: normalizeEdit(editState, fullDur),
      cb: callbacks || {},
      cursorT: null, drag: null
    };
    sizeCanvas();
    bindEvents();
    draw();
  }

  function normalizeEdit(e, fullDur) {
    e = e || {};
    return {
      trimStart: e.trimStart != null ? clamp(e.trimStart, 0, fullDur) : 0,
      trimEnd: e.trimEnd != null ? clamp(e.trimEnd, 0, fullDur) : fullDur,
      excludeRanges: (e.excludeRanges || []).map(function (r) {
        return { from: r.from, to: r.to };
      })
    };
  }

  function sizeCanvas() {
    var cv = W.cv, dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || (cv.parentNode && cv.parentNode.clientWidth) || 600;
    var h = 104;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.height = h + 'px';
    W.w = w; W.h = h; W.dpr = dpr;
  }

  function tToX(t) { return PAD + (t / W.fullDur) * (W.w - 2 * PAD); }
  function xToT(x) {
    return clamp(((x - PAD) / (W.w - 2 * PAD)) * W.fullDur, 0, W.fullDur);
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    var ctx = W.cv.getContext('2d');
    ctx.setTransform(W.dpr, 0, 0, W.dpr, 0, 0);
    ctx.clearRect(0, 0, W.w, W.h);
    var S = W.S, e = W.edit;
    var top = 6, bot = 20, plotH = W.h - top - bot;
    var baseY = top + plotH;

    var maxSp = 0.1;
    for (var i = 0; i < S.length; i++) if (S[i].speed > maxSp) maxSp = S[i].speed;
    function yOf(sp) { return top + plotH - (sp / maxSp) * plotH; }

    // 속도 프로파일 area + line — 모든 포인트 사용 (다운샘플링 없음)
    ctx.beginPath();
    ctx.moveTo(tToX(0), baseY);
    for (var i = 0; i < S.length; i++) ctx.lineTo(tToX(S[i].t), yOf(S[i].speed));
    ctx.lineTo(tToX(W.fullDur), baseY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(31,143,255,0.14)'; ctx.fill();
    ctx.beginPath();
    for (var i = 0, first = true; i < S.length; i++) {
      var px = tToX(S[i].t), py = yOf(S[i].speed);
      if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#1F8FFF'; ctx.lineWidth = 1.2; ctx.stroke();
    // 베이스라인
    ctx.beginPath(); ctx.moveTo(PAD, baseY); ctx.lineTo(W.w - PAD, baseY);
    ctx.strokeStyle = 'rgba(10,37,64,0.18)'; ctx.lineWidth = 1; ctx.stroke();

    // trim 바깥 어둡게
    var xs = tToX(e.trimStart), xe = tToX(e.trimEnd);
    ctx.fillStyle = 'rgba(245,247,250,0.74)';
    if (xs > PAD) ctx.fillRect(PAD, top, xs - PAD, plotH);
    if (xe < W.w - PAD) ctx.fillRect(xe, top, (W.w - PAD) - xe, plotH);

    // 제외 구간
    e.excludeRanges.forEach(function (r) {
      var rx = tToX(r.from), rw = tToX(r.to) - tToX(r.from);
      ctx.fillStyle = 'rgba(192,57,43,0.16)';
      ctx.fillRect(rx, top, Math.max(2, rw), plotH);
      ctx.strokeStyle = 'rgba(192,57,43,0.65)'; ctx.lineWidth = 1;
      ctx.strokeRect(rx, top, Math.max(2, rw), plotH);
      if (rw > 34) {
        ctx.fillStyle = '#8B2014';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('제외 ✕', rx + rw / 2, top + 3);
      }
    });

    // 커서
    if (W.cursorT != null) {
      var cx = tToX(W.cursorT);
      ctx.strokeStyle = 'rgba(10,37,64,0.45)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, baseY); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 드래그-선택 사각형
    if (W.drag && W.drag.mode === 'select' && W.drag.t1 != null) {
      var a = tToX(Math.min(W.drag.t0, W.drag.t1));
      var b = tToX(Math.max(W.drag.t0, W.drag.t1));
      ctx.fillStyle = 'rgba(192,57,43,0.16)';
      ctx.fillRect(a, top, b - a, plotH);
      ctx.strokeStyle = '#C0392B'; ctx.lineWidth = 1.2;
      ctx.strokeRect(a, top, b - a, plotH);
    }

    // trim 핸들
    drawHandle(ctx, xs, top, plotH, e.trimStart, 'start');
    drawHandle(ctx, xe, top, plotH, e.trimEnd, 'end');

    // 시간 눈금
    ctx.fillStyle = 'rgba(92,111,126,0.85)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left'; ctx.fillText('0:00', PAD, W.h - 4);
    ctx.textAlign = 'center'; ctx.fillText(mmss(W.fullDur / 2), W.w / 2, W.h - 4);
    ctx.textAlign = 'right'; ctx.fillText(mmss(W.fullDur), W.w - PAD, W.h - 4);
  }

  function drawHandle(ctx, x, top, plotH, t, which) {
    ctx.strokeStyle = '#E0A100'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + plotH); ctx.stroke();
    // 그립
    var gw = 12, gh = 20, gy = top + plotH / 2 - gh / 2;
    ctx.fillStyle = '#FFB800';
    ctx.strokeStyle = '#E0A100'; ctx.lineWidth = 1;
    ctx.fillRect(x - gw / 2, gy, gw, gh);
    ctx.strokeRect(x - gw / 2, gy, gw, gh);
    ctx.strokeStyle = '#8a6300'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 2, gy + 5); ctx.lineTo(x - 2, gy + gh - 5);
    ctx.moveTo(x + 2, gy + 5); ctx.lineTo(x + 2, gy + gh - 5);
    ctx.stroke();
    // 시간 라벨
    ctx.fillStyle = '#0A2540';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = which === 'start' ? 'left' : 'right';
    var lx = which === 'start' ? Math.max(PAD, x + 8) : Math.min(W.w - PAD, x - 8);
    ctx.fillText(mmss(t), lx, top + 1);
  }

  /* ---------- 상호작용 ---------- */
  function bindEvents() {
    var cv = W.cv;
    cv.style.touchAction = 'pan-y';
    cv.style.cursor = 'crosshair';
    if (cv._rdEditorBound) return;
    cv._rdEditorBound = true;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerleave', onLeave);
  }
  function evX(ev) {
    var r = W.cv.getBoundingClientRect();
    return ev.clientX - r.left;
  }
  function excludeAtX(x) {
    for (var i = 0; i < W.edit.excludeRanges.length; i++) {
      var r = W.edit.excludeRanges[i];
      if (x >= tToX(r.from) - 2 && x <= tToX(r.to) + 2) return i;
    }
    return -1;
  }
  function emit(t) { if (W.cb.onCursor) W.cb.onCursor(t); }

  function onDown(ev) {
    var x = evX(ev);
    try { W.cv.setPointerCapture(ev.pointerId); } catch (e) {}
    var xs = tToX(W.edit.trimStart), xe = tToX(W.edit.trimEnd);
    if (Math.abs(x - xs) <= HANDLE_HIT) W.drag = { mode: 'trimStart' };
    else if (Math.abs(x - xe) <= HANDLE_HIT) W.drag = { mode: 'trimEnd' };
    else {
      var exi = excludeAtX(x);
      if (exi >= 0) W.drag = { mode: 'excludeTap', exi: exi, x0: x };
      else W.drag = { mode: 'select', t0: xToT(x), t1: xToT(x) };
    }
    onMove(ev);
  }

  function onMove(ev) {
    var x = evX(ev), t = xToT(x);
    if (W.drag) {
      var d = W.drag;
      if (d.mode === 'trimStart') {
        W.edit.trimStart = clamp(t, 0, W.edit.trimEnd - MIN_KEEP_SEC);
        W.cursorT = W.edit.trimStart; emit(W.cursorT);
      } else if (d.mode === 'trimEnd') {
        W.edit.trimEnd = clamp(t, W.edit.trimStart + MIN_KEEP_SEC, W.fullDur);
        W.cursorT = W.edit.trimEnd; emit(W.cursorT);
      } else if (d.mode === 'select') {
        d.t1 = t; W.cursorT = t; emit(t);
      } else if (d.mode === 'excludeTap') {
        if (Math.abs(x - d.x0) > 8) d.mode = 'dead';
        W.cursorT = t; emit(t);
      } else { W.cursorT = t; emit(t); }
    } else {
      W.cursorT = t; emit(t);
    }
    draw();
  }

  function onUp(ev) {
    if (!W.drag) return;
    var d = W.drag; W.drag = null;
    try { W.cv.releasePointerCapture(ev.pointerId); } catch (e) {}
    if (d.mode === 'trimStart' || d.mode === 'trimEnd') {
      commit();
    } else if (d.mode === 'select') {
      var a = Math.min(d.t0, d.t1), b = Math.max(d.t0, d.t1);
      if (b - a >= MIN_EXCLUDE_SEC) { addExclude(a, b); commit(); }
      else draw();
    } else if (d.mode === 'excludeTap') {
      W.edit.excludeRanges.splice(d.exi, 1);
      commit();
    } else { draw(); }
  }

  function onLeave() {
    if (W.drag) return;
    W.cursorT = null; emit(null); draw();
  }

  /* 제외 구간 추가 — trim 범위로 클램프 + 겹치는 구간 병합 */
  function addExclude(a, b) {
    a = clamp(a, W.edit.trimStart, W.edit.trimEnd);
    b = clamp(b, W.edit.trimStart, W.edit.trimEnd);
    var ranges = W.edit.excludeRanges.concat([{ from: a, to: b }]);
    ranges.sort(function (x, y) { return x.from - y.from; });
    var merged = [];
    ranges.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r.from <= last.to + 0.5) last.to = Math.max(last.to, r.to);
      else merged.push({ from: r.from, to: r.to });
    });
    W.edit.excludeRanges = merged;
  }

  function commit() {
    draw();
    if (W.cb.onChange) {
      W.cb.onChange({
        trimStart: W.edit.trimStart,
        trimEnd: W.edit.trimEnd,
        excludeRanges: W.edit.excludeRanges.map(function (r) {
          return { from: r.from, to: r.to };
        })
      });
    }
  }

  /* 외부에서 커서 위치 주입 (지도·차트 hover 동기화) */
  function setCursor(t) {
    if (!W.cv) return;
    W.cursorT = t;
    if (!W.drag) draw();
  }

  global.RDEditor = { render: render, setCursor: setCursor };
})(typeof window !== 'undefined' ? window : globalThis);
