/* ==========================================================================
   단무지공방 — main.js
   Phase 1 interactivity: header scroll, mobile menu, reveal, form, perf chart
   ========================================================================== */

(function () {
  'use strict';

  // ── Header scroll state ───────────────────────────────────────────────
  const header = document.querySelector('.site-header');
  if (header) {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 12);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile menu toggle ────────────────────────────────────────────────
  const menuBtn = document.querySelector('[data-menu-open]');
  const menuClose = document.querySelector('[data-menu-close]');
  const menu = document.querySelector('.mobile-menu');

  function openMenu() {
    if (!menu) return;
    menu.classList.add('is-open');
    document.body.classList.add('menu-open');
    menu.setAttribute('aria-hidden', 'false');
  }
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    menu.setAttribute('aria-hidden', 'true');
  }
  if (menuBtn) menuBtn.addEventListener('click', openMenu);
  if (menuClose) menuClose.addEventListener('click', closeMenu);
  if (menu) {
    menu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
    });
  }

  // ── Reveal on scroll (IntersectionObserver) ───────────────────────────
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -64px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  // ── Performance bar fill (read --p variable, animate width) ───────────
  const perfBars = document.querySelectorAll('.perf-axes__bar');
  if (perfBars.length && 'IntersectionObserver' in window) {
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const v = parseFloat(bar.getAttribute('data-value')) || 0;
          bar.style.setProperty('--p', String(v / 10));
          io2.unobserve(bar);
        }
      });
    }, { threshold: 0.3 });
    perfBars.forEach((el) => io2.observe(el));
  }

  // ── Performance 5축 카테고리별 canonical axis set (DO_NOT_REVERT §148) ──
  // 카테고리별 axis 정책 (Danny 2026-05-12 결정 — 스크린샷 c23de445):
  //   - foil      : Skill / Speed / Glide / Maneuver / Stability  (Front Wing·Mast·Stab·Set)
  //   - wing      : Power / Range / Handling / Lightness / Durability  (Sail·Wing·Parawing)
  //   - board     : Volume / Stability / Pumping / Glide / Versatility  (Board)
  //   - safety    : Comfort / Protection / Mobility / Lightness / Ventilation  (Helmet·Impact·Harness·Booties)
  // ❌ universal 5축 (Skill/Speed/Glide/Maneuver/Stability) 을 모든 카테고리 강제 적용 금지
  // ❌ Helmet 에 Skill/Speed/Glide 적용 같은 mismatched chart 회귀 영구 금지
  // ⚠ 이 const 는 PERF chart renderer (renderPerfPentagon) 보다 위에 선언되어야 함 (TDZ 회피)
  const PERF_CATEGORY_AXES = {
    foil:   ['Skill', 'Speed', 'Glide', 'Maneuver', 'Stability'],
    wing:   ['Power', 'Range', 'Handling', 'Lightness', 'Durability'],
    board:  ['Volume', 'Stability', 'Pumping', 'Glide', 'Versatility'],
    safety: ['Comfort', 'Protection', 'Mobility', 'Lightness', 'Ventilation'],
  };

  // ── Performance pentagon SVG renderer ─────────────────────────────────
  const charts = document.querySelectorAll('[data-perf-chart]');
  charts.forEach((wrap) => renderPerfPentagon(wrap));

  function renderPerfPentagon(container) {
    // Performance 5축 radar chart renderer.
    // ─────────────────────────────────────────────────────────────────────
    // DO_NOT_REVERT §141 (2026-05-11, Danny 직접 지시 스크린샷 9753da3e):
    //   1) 10-ring 동심 5각형 그리드 (각 ring = 1점 단위, 0..10 척도 시각화)
    //   2) Dark-context 자동 감지 → axis label = 흰색 (rgba(255,255,255,.96))
    //   3) Chart 사이즈 키우기 (viewBox·radius 둘 다 ↑) + 좌측 column 가득
    //   4) Light-context (levitaz.html 등) 도 backward-compat 유지 — navy ink 톤
    // DO_NOT_REVERT §148 (2026-05-12, Danny 직접 지시 스크린샷 c23de445):
    //   5) `data-perf-category` 속성 지원 — foil/wing/board/safety 분기
    //      `data-labels` 미지정 시 카테고리별 canonical axis set 자동 적용
    //      카테고리 미지정 + labels 미지정 fallback = foil axes (backward-compat)
    // ─────────────────────────────────────────────────────────────────────
    const valuesAttr = container.getAttribute('data-values'); // e.g. "8,7,9,6,7"
    const labelsAttr = container.getAttribute('data-labels'); // e.g. "Skill,Speed,Glide,Maneuver,Stability"
    const categoryAttr = (container.getAttribute('data-perf-category') || '').toLowerCase();
    if (!valuesAttr) return;
    const values = valuesAttr.split(',').map(v => Math.max(0, Math.min(10, parseFloat(v) || 0)));
    // 카테고리 분기 — explicit labels > category preset > legacy foil default
    let labels;
    if (labelsAttr) {
      labels = labelsAttr.split(',');
    } else if (PERF_CATEGORY_AXES[categoryAttr]) {
      labels = PERF_CATEGORY_AXES[categoryAttr].slice();
    } else {
      labels = PERF_CATEGORY_AXES.foil.slice();
    }

    // Dark-context 감지 (section--dark / section--darker / explicit data-theme)
    const isDark = !!container.closest('.section--dark, .section--darker, [data-perf-chart-theme="dark"]');

    const palette = isDark ? {
      ringStroke:      'rgba(255,255,255,0.14)',
      ringStrokeMid:   'rgba(255,255,255,0.24)',  // 5점 anchor
      ringStrokeOuter: 'rgba(255,255,255,0.38)',  // 10점 boundary
      spokeStroke:     'rgba(255,255,255,0.20)',
      fillStart:       '#3FA4FF',
      fillStartOp:     0.55,
      fillEnd:         '#1B6FE0',
      fillEndOp:       0.40,
      dataStroke:      '#6CC4FF',
      dotFill:         '#FFFFFF',
      dotStroke:       '#3FA4FF',
      labelFill:       'rgba(255,255,255,0.96)',
    } : {
      ringStroke:      'rgba(10,37,64,0.08)',
      ringStrokeMid:   'rgba(10,37,64,0.16)',
      ringStrokeOuter: 'rgba(10,37,64,0.24)',
      spokeStroke:     'rgba(10,37,64,0.12)',
      fillStart:       '#1F8FFF',
      fillStartOp:     0.55,
      fillEnd:         '#0A2540',
      fillEndOp:       0.55,
      dataStroke:      '#0A2540',
      dotFill:         '#0A2540',
      dotStroke:       '#FFFFFF',
      labelFill:       '#2A3B4C',
    };

    const N = values.length;
    const cx = 220;
    const cy = 220;
    const r = 160; // outer pentagon radius (10/10 boundary)

    const angle = (i) => (Math.PI * 2 * i) / N - Math.PI / 2;
    const point = (i, scale) => ({
      x: cx + Math.cos(angle(i)) * r * scale,
      y: cy + Math.sin(angle(i)) * r * scale,
    });

    // 10-단 동심 5각형 그리드 (k=1..10, 각 ring = 1점)
    const rings = [];
    for (let k = 1; k <= 10; k++) {
      const s = k / 10;
      const d = Array.from({ length: N }, (_, i) => point(i, s))
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(' ') + ' Z';
      let stroke = palette.ringStroke;
      let strokeW = 1;
      if (k === 5)  { stroke = palette.ringStrokeMid;   strokeW = 1; }
      if (k === 10) { stroke = palette.ringStrokeOuter; strokeW = 1.5; }
      rings.push(
        `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>`
      );
    }

    // Spokes (center → outer vertex)
    const spokes = Array.from({ length: N }, (_, i) => {
      const p = point(i, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(2)}" y2="${p.y.toFixed(2)}" stroke="${palette.spokeStroke}" stroke-width="1"/>`;
    }).join('');

    // Data polygon
    const dataPts = values.map((v, i) => point(i, v / 10));
    const dataPath = dataPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ') + ' Z';

    // Vertex dots
    const dots = dataPts
      .map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5" fill="${palette.dotFill}" stroke="${palette.dotStroke}" stroke-width="2.5"/>`)
      .join('');

    // Axis labels (positioned just past the outer ring)
    const labelEls = labels.map((label, i) => {
      const p = point(i, 1.22);
      let anchor = 'middle';
      if (p.x < cx - 5) anchor = 'end';
      else if (p.x > cx + 5) anchor = 'start';
      return `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="middle"
        font-family="Inter, system-ui" font-size="13" font-weight="600" letter-spacing="0.08em"
        fill="${palette.labelFill}" text-transform="uppercase">${label.toUpperCase()}</text>`;
    }).join('');

    const uid = cssId(container);
    // viewBox = 0..440 chart + asymmetric padding for axis labels.
    // 좌측 70px (STABILITY 9 char fit) / 우측 70px (SPEED + 여유)
    // 상하 30/30px (SKILL 위 + 하단 라벨 below)
    container.innerHTML = `
      <svg viewBox="-70 -30 580 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Performance 5-axis chart" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="perf-fill-${uid}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stop-color="${palette.fillStart}" stop-opacity="${palette.fillStartOp}"/>
            <stop offset="100%" stop-color="${palette.fillEnd}"   stop-opacity="${palette.fillEndOp}"/>
          </linearGradient>
        </defs>
        ${rings.join('')}
        ${spokes}
        <path d="${dataPath}" fill="url(#perf-fill-${uid})" stroke="${palette.dataStroke}" stroke-width="2.25" stroke-linejoin="round"/>
        ${dots}
        ${labelEls}
      </svg>
    `;
  }

  function cssId(el) {
    if (!el.dataset.uid) {
      el.dataset.uid = 'p' + Math.random().toString(36).slice(2, 8);
    }
    return el.dataset.uid;
  }

  // ── Launch alert form ─────────────────────────────────────────────────
  const form = document.querySelector('[data-launch-form]');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const nameInput = form.querySelector('input[name="name"]');
      const consent = form.querySelector('input[name="consent"]');
      const msg = form.querySelector('[data-form-msg]');
      const submitBtn = form.querySelector('button[type="submit"]');

      msg.classList.remove('is-visible', 'launch-form__msg--err');

      if (!consent.checked) {
        showFormMsg(msg, '개인정보 수집·이용에 동의해 주세요.', true);
        return;
      }
      const email = emailInput.value.trim();
      if (!isEmail(email)) {
        showFormMsg(msg, '올바른 이메일 주소를 입력해 주세요.', true);
        emailInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '신청 중…';

      const endpoint = form.getAttribute('data-endpoint');
      try {
        if (endpoint && endpoint.startsWith('http')) {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: new FormData(form),
          });
          if (!res.ok) throw new Error('submit failed');
        } else {
          // Fallback: mailto
          const subject = encodeURIComponent('[단무지공방] Phase 2 launch 알림 신청');
          const body = encodeURIComponent(
            `이메일: ${email}\n이름: ${nameInput ? nameInput.value : ''}\n동의: 개인정보 수집·이용\n출처: dmjgroup.kr Phase 1 launch alert form`
          );
          window.location.href = `mailto:hello@dmjgroup.kr?subject=${subject}&body=${body}`;
        }
        showFormMsg(msg, '신청이 완료되었습니다. Phase 2 launch 시 가장 먼저 알려드릴게요.', false);
        form.reset();
      } catch (err) {
        showFormMsg(msg, '신청에 실패했습니다. 잠시 후 다시 시도해 주시거나 hello@dmjgroup.kr로 이메일 주세요.', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '런치 알림 신청';
      }
    });
  }

  function showFormMsg(el, text, isError) {
    el.textContent = text;
    el.classList.add('is-visible');
    if (isError) el.classList.add('launch-form__msg--err');
  }
  function isEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  // ── Year in footer ────────────────────────────────────────────────────
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── Click-to-play YouTube poster (error 153 fallback) ─────────────────
  // Replaces poster button with embed iframe on user gesture.
  // Avoids iframe load on every page hit and sidesteps embed restrictions
  // by giving user a YouTube link as backup.
  document.addEventListener('click', function (e) {
    const poster = e.target.closest('.video-embed__poster');
    if (!poster) return;
    e.preventDefault();
    const id = poster.getAttribute('data-yt-id');
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    const wrap = poster.parentElement;
    if (!wrap) return;
    const title = poster.getAttribute('aria-label') || 'YouTube video';
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    iframe.title = title;
    iframe.setAttribute('allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('loading', 'eager');
    poster.replaceWith(iframe);
  });

  // ── Nav dropdown one-at-a-time (fix click-sticky + hover overlap) ──────
  // Bug: clicking a nav link triggers :focus-within → dropdown stays open.
  // Hovering another nav item then opens its dropdown via :hover, but the
  // first one is still :focus-within. Both visible simultaneously.
  // Fix: when entering a different nav__has-sub OR clicking outside the
  // nav OR pressing ESC, blur whichever nav link currently has focus.
  const navItems = document.querySelectorAll('.nav__has-sub');
  if (navItems.length) {
    navItems.forEach((item) => {
      item.addEventListener('mouseenter', () => {
        const focused = document.activeElement;
        if (focused && focused.closest && focused.closest('.nav__has-sub') && !item.contains(focused)) {
          focused.blur();
        }
      });
    });
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('.nav')) {
        const focused = document.activeElement;
        if (focused && focused.closest && focused.closest('.nav__has-sub')) {
          focused.blur();
        }
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const focused = document.activeElement;
        if (focused && focused.closest && focused.closest('.nav__has-sub')) {
          focused.blur();
        }
      }
    });
  }
})();
