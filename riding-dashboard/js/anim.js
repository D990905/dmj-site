/* ============================================================
 * anim.js — 라이딩 분석 대시보드 시각 폴리시 모션 헬퍼
 * (Danny 2026-05-26 — Layer 1)
 * ------------------------------------------------------------
 * 데이터 흐름·계산 로직과 무관한 *시각 전용* 코드이다. 모든 헬퍼는
 * (a) prefers-reduced-motion: reduce 를 존중해 즉시 최종 상태로
 * 점프하고, (b) DOM 의 *실제* 텍스트 콘텐츠를 변경하지 않는 입력
 * (그저 표시만 보간)이므로 a11y/스크린리더 측정에 영향이 없다.
 *
 * 외부 API
 *   RDAnim.countUp(el)              — 단일 노드 카운트업
 *   RDAnim.countAll(root?)          — root(default document) 안의
 *                                     모든 [data-rd-num] 노드 일괄 처리
 *   RDAnim.stagger(nodeList)        — 등장 stagger (rd-rise 클래스 부여)
 *   RDAnim.markRendered()           — 분석 완료 직후 한 번 호출
 *
 * data-rd-num 데이터 모델
 *   <span class="stat__value"
 *         data-rd-num="123.4"
 *         data-rd-suffix=" kt"
 *         data-rd-decimals="1">123.4 kt</span>
 *
 *   - data-rd-num         : 목표 숫자(수치). 비숫자 라벨(예: 'min:sec')은
 *                           아예 부여하지 않으면 카운트업이 건너뛴다.
 *   - data-rd-prefix      : 숫자 앞 문자열(옵션)
 *   - data-rd-suffix      : 숫자 뒤 문자열(옵션)
 *   - data-rd-decimals    : 소수 자리(0~4, 기본 자동 추론)
 *   - data-rd-duration    : ms (기본 700)
 *
 *  DOM 의 텍스트는 카운트업이 끝나면 원래 텍스트로 되돌리지 않고
 *  formatted 값으로 남는다. 이 모듈은 호출 시점에 최종 텍스트를
 *  스냅샷으로 두고, 시작 → 종료까지 보간만 한다. statTile 호출부가
 *  이미 최종 텍스트를 넣어두므로 호출자는 카운트업을 의식할 필요 없다.
 * ============================================================ */
(function (global) {
  'use strict';

  var DEFAULT_MS = 700;
  var prefersReduce = (function () {
    try {
      return global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  })();

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* 숫자의 표시 자리수 자동 추정 — '1.32', '4.0', '12' 같은 텍스트에서
     소수 자리를 읽어 카운트업 중에도 같은 자리수를 유지한다. */
  function inferDecimals(textOrNumber) {
    var s = String(textOrNumber);
    var m = s.match(/(\d+)\.(\d+)/);
    return m ? Math.min(4, m[2].length) : 0;
  }

  function formatNumber(v, decimals) {
    if (!isFinite(v)) return '—';
    if (decimals === 0) return Math.round(v).toLocaleString('en-US');
    return v.toLocaleString('en-US', {
      minimumFractionDigits:decimals, maximumFractionDigits:decimals
    });
  }

  function countUp(el) {
    if (!el || !el.dataset) return;
    var target = parseFloat(el.dataset.rdNum);
    if (!isFinite(target)) return;
    /* 이미 카운트업 적용된 노드는 건너뜀 (재렌더 시 시각적 점멸 방지) */
    if (el.dataset.rdCounted === '1') return;

    var prefix = el.dataset.rdPrefix || '';
    var suffix = el.dataset.rdSuffix || '';
    var decimals = el.dataset.rdDecimals != null
      ? parseInt(el.dataset.rdDecimals, 10)
      : inferDecimals(el.textContent);
    var duration = parseFloat(el.dataset.rdDuration || DEFAULT_MS);

    /* reduced motion 사용자 — 즉시 최종 표기 */
    if (prefersReduce || duration <= 0) {
      el.textContent = prefix + formatNumber(target, decimals) + suffix;
      el.dataset.rdCounted = '1';
      return;
    }

    /* 음수 → 양수로 보간 시 0 → target 만 다루도록 시작값 결정 */
    var start = 0;
    var t0 = (global.performance && global.performance.now) ? performance.now() : Date.now();
    el.classList.add('is-counting');

    function tick(now) {
      var elapsed = (now || Date.now()) - t0;
      var f = Math.min(1, elapsed / duration);
      var v = start + (target - start) * easeOutCubic(f);
      el.textContent = prefix + formatNumber(v, decimals) + suffix;
      if (f < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = prefix + formatNumber(target, decimals) + suffix;
        el.classList.remove('is-counting');
        el.dataset.rdCounted = '1';
      }
    }
    requestAnimationFrame(tick);
  }

  function countAll(root) {
    root = root || document;
    var nodes = root.querySelectorAll('[data-rd-num]:not([data-rd-counted="1"])');
    for (var i = 0; i < nodes.length; i++) countUp(nodes[i]);
  }

  /* 카운트업 마크 리셋 — 새 분석이 들어오면 기존 마킹을 지워 다시 카운트 */
  function resetCounted(root) {
    root = root || document;
    var nodes = root.querySelectorAll('[data-rd-counted="1"]');
    for (var i = 0; i < nodes.length; i++) {
      delete nodes[i].dataset.rdCounted;
    }
  }

  /* 등장 stagger — 노드 컬렉션에 rd-rise 클래스를 차례로 부여한다.
     CSS @keyframes rd-rise 와 짝. nth-child 기반이라 컨테이너가 같은
     부모를 공유해야 stagger 가 시각적으로 자연스럽다. */
  function stagger(nodes) {
    if (!nodes) return;
    if (prefersReduce) return;       /* 모션 줄임 — stagger 생략 */
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.classList.contains('rd-rise')) {
        n.classList.add('rd-rise');
        /* 끝나면 클래스 제거해 inline transform 영향 없게 */
        (function (node) {
          setTimeout(function () { node.classList.remove('rd-rise'); },
            500 + i * 60);
        })(n);
      }
    }
  }

  /* markRendered — 분석이 막 끝난 직후 호출. KPI 카운트업 + stagger 진입.
     state.firstRender 트래킹은 호출부(app.js)에서 한다. */
  function markRendered(opts) {
    opts = opts || {};
    countAll(opts.root || document);
    if (opts.stagger) {
      /* 첫 카드 그룹만 stagger — 너무 많이 흔들리면 산만 */
      var nodes = (opts.root || document).querySelectorAll(opts.stagger);
      stagger(nodes);
    }
  }

  global.RDAnim = {
    countUp:countUp,
    countAll:countAll,
    resetCounted:resetCounted,
    stagger:stagger,
    markRendered:markRendered,
    /* 디버그·이중 호출 방지에 유용 — 외부 사용 의도 X */
    _prefersReduce:prefersReduce
  };
})(typeof window !== 'undefined' ? window : globalThis);
