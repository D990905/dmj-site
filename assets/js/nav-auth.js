// §169-G — Nav header 로그인 상태별 표시 (Danny 2026-05-12)
// DO_NOT_REVERT: Logged out → "로그인" 링크 / Logged in → avatar + 닉네임 dropdown.
// 전 페이지 (95+) 일관 적용. localStorage 직접 read — auth-shim.js 의존 없음.
//
// §169-G v2 (Danny 2026-05-12): dropdown trigger = click-to-toggle (hover-gap 버그 fix).
// - trigger 는 <button> (← 이전 <a href="profile.html"> 폐기 — 마이페이지는 메뉴 첫 항목)
// - 클릭으로 .is-open class 토글
// - outside click + Esc 키로 닫힘
// - 메뉴 항목 클릭 = 자연 navigate (브라우저 기본 동작)
// - aria-expanded / aria-haspopup / aria-controls 모든 attribute lock
// DO_NOT_REVERT §169-G v2 — hover 단독 trigger 회귀 영구 X. click-to-toggle lock.
(function () {
  'use strict';

  // ── §426 B pivot: 정보 사이트 only (옥대표 2026-07-02) ───────────────────────
  // 배경: Supabase 무료티어 7일 비활동 auto-pause(§425). 옥대표 결정 = 회원 기능을
  //   "삭제"가 아니라 "표면 hide" 한다 (0 비용/0 관리, 향후 재활성화 가능).
  // 이 플래그가 true 인 동안:
  //   - 로그인/회원가입/마이페이지/회원등급 등 회원 진입점(anchor)을 전부 hide
  //   - 로그인 상태여도 계정 드롭다운을 만들지 않음 (renderDesktopNav/Mobile 스킵)
  //   - '라이딩 분석' 링크는 그대로 노출 (guest 로 GPX 분석 → localStorage)
  // 재활성화: 이 값을 false 로 되돌리면 즉시 원상 복구. 코드/route/파일 삭제 없음.
  //   (짝꿍 플래그: supabase-auth.js MEMBER_MODE_DISABLED, style.css §426 블록,
  //    profile.html §426 redirect 블록도 함께 되돌리면 완전 복원.)
  var MEMBER_UI_HIDDEN = true;

  // 회원 진입점으로 간주해 hide 할 목적지 파일명 (basename 매칭, ../ 접두 무관).
  var MEMBER_HREF_TARGETS = [
    'login.html', 'signup.html', 'password-reset.html',
    'membership.html', 'profile.html'
  ];

  function hrefBasename(a) {
    var h = a.getAttribute('href') || '';
    h = h.split('#')[0].split('?')[0];
    var seg = h.split('/');
    return seg[seg.length - 1];
  }

  // 회원 진입점 anchor 전수 hide. li 로 감싸진 경우 li 째 숨겨 빈 항목/여백 방지.
  function hideMemberUI() {
    try {
      var anchors = document.querySelectorAll('a[href]');
      anchors.forEach(function (a) {
        if (MEMBER_HREF_TARGETS.indexOf(hrefBasename(a)) === -1) return;
        a.style.setProperty('display', 'none', 'important');
        a.setAttribute('data-member-hidden', '');
        var li = a.closest('li');
        // li 안에 회원 링크만 있을 때만 li 를 숨긴다 (다른 항목 보존)
        if (li && li.querySelectorAll('a[href]').length === 1) {
          li.style.setProperty('display', 'none', 'important');
          li.setAttribute('data-member-hidden', '');
        }
      });
    } catch (e) { if (window.console) console.warn('hideMemberUI error:', e); }
  }

  // ── 라이딩 분석 로그인 게이트 (Danny 2026-05-25) ─────────────────────────────
  // 배경: 마이페이지 인증은 백엔드 없는 localStorage shim 이라 사실상 로그인이 안 됨
  //   (file:// origin·기기별 격리·crypto.subtle 부재 등). 그 결과 '라이딩 분석'
  //   (riding-dashboard/) 으로 가는 nav 링크가 로그인 사용자 dropdown 안에만 있어
  //   Danny 가 대시보드에 진입할 수 없었다.
  // 사실: riding-dashboard/ 에는 내부 인증 체크·로그인 리다이렉트가 전혀 없다.
  //   직접 URL 로 열면 로그인 없이 완전히 동작한다. 유일한 게이트는 "nav 진입 링크가
  //   로그인 상태에서만 렌더된다"는 점뿐이었다.
  // 조치: 아래 플래그가 false 인 동안 injectRidingDashboardLink() 가 로그아웃
  //   상태에서도 '라이딩 분석' 링크를 nav 에 노출한다.
  // Phase 12 (Supabase Auth) 연동 시 → 이 값을 true 로 되돌리면 주입이 중단되고
  //   원래대로 로그인 dropdown 안에서만 노출된다. (코드 삭제 X — 플래그 토글만.)
  var RIDING_DASHBOARD_REQUIRES_LOGIN = false;

  // ---- Auth state detection ----
  // §179 Supabase 전환 (데이빗 2026-06-03): 라이브 인증은 supabase-auth.js (window.DMJAuth,
  // sync 캐시 dmj_user_cache) 로 이동. 옛 dmj_session/dmj_users 키는 더 이상 채워지지 않아
  // nav 가 로그인 상태를 못 잡던 회귀 fix. DMJAuth → dmj_user_cache → 옛 키 순으로 fallback.
  function getSession() {
    try {
      if (window.DMJAuth && typeof window.DMJAuth.isLoggedIn === 'function' && window.DMJAuth.isLoggedIn()) {
        var u = window.DMJAuth.currentUser && window.DMJAuth.currentUser();
        if (u && u.email) return { email: u.email };
      }
      var cache = localStorage.getItem('dmj_user_cache');
      if (cache) {
        var cu = JSON.parse(cache);
        if (cu && cu.email) return { email: cu.email };
      }
      var raw = localStorage.getItem('dmj_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.email || (s.expiresAt && s.expiresAt < Date.now())) return null;
      return s;
    } catch (e) { return null; }
  }
  function getUser(email) {
    // Supabase 프로필 (live) — nickname/avatarBase64 포함
    try {
      if (window.DMJAuth && typeof window.DMJAuth.currentUser === 'function') {
        var u = window.DMJAuth.currentUser();
        if (u && u.email && (!email || String(u.email).toLowerCase() === String(email).toLowerCase())) return u;
      }
      var cache = localStorage.getItem('dmj_user_cache');
      if (cache) { var cu = JSON.parse(cache); if (cu && cu.email) return cu; }
    } catch (e) {}
    // 옛 localStorage shim fallback
    if (!email) return null;
    try {
      var raw = localStorage.getItem('dmj_users');
      if (!raw) return null;
      var users = JSON.parse(raw);
      return users[String(email).toLowerCase()] || null;
    } catch (e) { return null; }
  }

  // ---- Compute relative prefix for href (depends on page depth) ----
  function relPrefix() {
    var path = location.pathname;
    // strip filename, count slashes after /site/
    var marker = '/site/';
    var idx = path.indexOf(marker);
    var rel = idx >= 0 ? path.substring(idx + marker.length) : path.replace(/^\/+/, '');
    // count remaining path segments excluding filename
    var segs = rel.split('/').slice(0, -1).filter(Boolean);
    return segs.map(function () { return '../'; }).join('') || '';
  }

  // ---- Build avatar HTML ----
  function avatarHtml(user, sizeCls) {
    var nick = (user && (user.nickname || user.name || user.email || '?')) || '?';
    var firstChar = String(nick).trim().charAt(0).toUpperCase();
    if (user && user.avatarBase64) {
      return '<span class="nav-avatar ' + (sizeCls || '') + '" aria-hidden="true">' +
             '<img src="' + user.avatarBase64 + '" alt=""></span>';
    }
    // gradient fallback
    return '<span class="nav-avatar nav-avatar--default ' + (sizeCls || '') + '" aria-hidden="true">' + firstChar + '</span>';
  }

  // ---- Replace desktop nav login link ----
  function renderDesktopNav() {
    var loginLink = document.querySelector('.nav__primary .nav__link--login');
    if (!loginLink) return;
    var session = getSession();
    var prefix = relPrefix();

    if (!session) {
      // Ensure default state — restore link if previously replaced
      if (loginLink.getAttribute('data-auth-rendered') === 'in') {
        loginLink.outerHTML = '<a href="' + prefix + 'login.html" class="nav__link nav__link--login" role="menuitem" style="font-size:13px;color:rgba(255,255,255,.85)">로그인</a>';
      }
      return;
    }

    var user = getUser(session.email);
    var displayName = (user && (user.nickname || user.email.split('@')[0])) || session.email.split('@')[0];

    // §169-G v2 — Build dropdown wrapper with <button> trigger (click-to-toggle).
    // 'nav__has-sub' kept for layout (position: relative) but hover/focus-within auto-open
    // is suppressed via CSS .nav-auth override block. State controlled by JS .is-open class.
    var menuId = 'nav-auth-menu';
    var wrapper = document.createElement('div');
    wrapper.className = 'nav__has-sub nav-auth nav-auth--logged-in';
    wrapper.setAttribute('data-auth-rendered', 'in');
    wrapper.innerHTML = '' +
      '<button type="button" class="nav__link nav-auth__trigger" aria-haspopup="true" aria-expanded="false" aria-controls="' + menuId + '">' +
        avatarHtml(user) +
        '<span class="nav-auth__name">' + escapeHtml(displayName) + '</span>' +
        '<svg class="nav-auth__chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="nav__sub nav-auth__menu" id="' + menuId + '" role="menu">' +
        '<a href="' + prefix + 'profile.html" class="nav__sub-link" role="menuitem"><b>마이페이지</b><span>프로필 · 장비 · 진단 결과</span></a>' +
        '<a href="' + prefix + 'riding-dashboard/index.html" class="nav__sub-link" role="menuitem"><b>라이딩 분석</b><span>GPX 세션 분석</span></a>' +
        '<a href="' + prefix + 'skill-assessment.html" class="nav__sub-link" role="menuitem"><b>스킬 진단</b><span>10축 + Speed</span></a>' +
        '<a href="' + prefix + 'find-my-gear.html" class="nav__sub-link" role="menuitem"><b>Find My Gear</b><span>1분 셋업 진단</span></a>' +
        '<a href="' + prefix + 'membership.html" class="nav__sub-link" role="menuitem"><b>회원 등급</b><span>현재 등급 · 혜택</span></a>' +
        '<a href="#" class="nav__sub-link nav-auth__logout" role="menuitem" data-nav-logout><b>로그아웃</b><span>다음 30일 자동 로그인</span></a>' +
      '</div>';
    loginLink.parentNode.replaceChild(wrapper, loginLink);

    // §169-G v2 — click-to-toggle wiring
    // DO_NOT_REVERT §145-G v9 (Danny 2026-05-14) — installSingleDropdownGuard 가 SOLE click handler.
    // 옛 동작: nav-auth.js 가 자체 click handler 추가 + guard 가 또 추가 → DOUBLE toggle (open+close same frame)
    // → dropdown 보이지 않음. 마이페이지 작동 X 회귀 영구 차단.
    // Fix: nav-auth.js click handler 제거. guard 가 .is-open 만 토글 → MutationObserver 가 .is-active sync.
    var trigger = wrapper.querySelector('.nav-auth__trigger');
    function setOpen(open) {
      if (open) {
        wrapper.classList.add('is-open');
        trigger.classList.add('is-active');
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        wrapper.classList.remove('is-open');
        trigger.classList.remove('is-active');
        trigger.setAttribute('aria-expanded', 'false');
      }
    }
    // .is-open class 변경 감지 → .is-active class 동기 (guard 가 .is-open 만 토글, .is-active 는 안 만짐)
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () {
        if (wrapper.classList.contains('is-open')) trigger.classList.add('is-active');
        else trigger.classList.remove('is-active');
      }).observe(wrapper, { attributes: true, attributeFilter: ['class'] });
    }
    // Esc key closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && wrapper.classList.contains('is-open')) {
        setOpen(false);
        trigger.focus();
      }
    });
    // Menu item click closes (before navigation completes)
    wrapper.querySelectorAll('.nav__sub-link').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });

    // Logout wiring
    var logoutBtn = wrapper.querySelector('[data-nav-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        // §179 Supabase 로그아웃 (데이빗 2026-06-03) — DMJAuth.logout() 우선, 옛 키도 정리.
        try {
          if (window.DMJAuth && typeof window.DMJAuth.logout === 'function') {
            var r = window.DMJAuth.logout();
            if (r && typeof r.then === 'function') {
              r.then(function(){ location.href = prefix + 'index.html'; })
               .catch(function(){ location.href = prefix + 'index.html'; });
              try { localStorage.removeItem('dmj_session'); } catch (_) {}
              return;
            }
          }
        } catch (_) {}
        try { localStorage.removeItem('dmj_session'); } catch (_) {}
        // Hard reload to refresh nav across the page
        location.href = prefix + 'index.html';
      });
    }

    // DO_NOT_REVERT §145-G v6/v9 — Danny 2026-05-13/14: 한 시점 1 dropdown only open.
    // installSingleDropdownGuard() = init() 의 마지막에 단일 호출 (logged in/out 모두 처리).
  }

  // §145-G v6 — All .nav__has-sub dropdowns: click toggle, single-at-a-time.
  function installSingleDropdownGuard() {
    if (window.__navDropdownGuardInstalled) return;
    window.__navDropdownGuardInstalled = true;
    var allSubs = document.querySelectorAll('.nav__primary .nav__has-sub, .nav__has-sub.nav-auth');
    function closeAll(except) {
      allSubs.forEach(function (s) {
        if (s !== except) {
          s.classList.remove('is-open');
          var t = s.querySelector('.nav__link, .nav-auth__trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
    }
    allSubs.forEach(function (sub) {
      var trigger = sub.querySelector(':scope > .nav__link, :scope > .nav-auth__trigger');
      if (!trigger || trigger.__navGuardWired) return;
      trigger.__navGuardWired = true;
      // Skip if this is a CTA-only link (no .nav__sub child)
      var hasChild = sub.querySelector(':scope > .nav__sub');
      if (!hasChild) return;
      trigger.addEventListener('click', function (e) {
        // Only intercept when click was on the trigger itself (not children of submenu)
        if (e.target !== trigger && !trigger.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        var willOpen = !sub.classList.contains('is-open');
        closeAll(sub);
        if (willOpen) {
          sub.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        } else {
          sub.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    });
    document.addEventListener('click', function (e) {
      var hit = e.target.closest('.nav__has-sub');
      if (!hit) closeAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
  }

  // ---- Replace mobile menu drawer ----
  function renderMobileNav() {
    var drawer = document.querySelector('.mobile-menu__list, .mobile-menu');
    if (!drawer) return;
    var session = getSession();
    var prefix = relPrefix();
    if (!session) {
      // Remove existing profile card if any
      var existing = document.querySelector('.mobile-menu .mobile-auth-card');
      if (existing) existing.remove();
      return;
    }
    var user = getUser(session.email);
    var displayName = (user && (user.nickname || user.email.split('@')[0])) || session.email.split('@')[0];

    // Avoid duplicate
    if (document.querySelector('.mobile-menu .mobile-auth-card')) return;

    var card = document.createElement('div');
    card.className = 'mobile-auth-card';
    card.innerHTML = '' +
      '<div class="mobile-auth-card__profile">' +
        avatarHtml(user, 'nav-avatar--lg') +
        '<div class="mobile-auth-card__meta">' +
          '<div class="mobile-auth-card__name">' + escapeHtml(displayName) + '</div>' +
          '<div class="mobile-auth-card__email">' + escapeHtml(session.email) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mobile-auth-card__actions">' +
        '<a href="' + prefix + 'profile.html">마이페이지</a>' +
        '<a href="' + prefix + 'riding-dashboard/index.html">라이딩 분석</a>' +
        '<a href="' + prefix + 'skill-assessment.html">스킬 진단</a>' +
        '<a href="#" data-nav-logout-mobile>로그아웃</a>' +
      '</div>';

    // Insert at top of drawer
    var inner = document.querySelector('.mobile-menu__close');
    var parent = document.querySelector('.mobile-menu');
    if (parent) {
      if (inner && inner.nextSibling) parent.insertBefore(card, inner.nextSibling);
      else parent.insertBefore(card, parent.firstChild);
    }
    var lo = card.querySelector('[data-nav-logout-mobile]');
    if (lo) {
      lo.addEventListener('click', function (e) {
        e.preventDefault();
        try { localStorage.removeItem('dmj_session'); } catch (_) {}
        location.href = prefix + 'index.html';
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── 라이딩 분석 게이트 해제 (Danny 2026-05-25) ───────────────────────────────
  // 로그아웃 상태에서도 '라이딩 분석' 진입 링크를 nav 에 노출한다.
  // 로그인 상태는 renderDesktopNav/renderMobileNav 가 만드는 계정 메뉴에 이미
  // 링크가 있으므로 (중복 방지) 주입하지 않는다.
  function injectRidingDashboardLink() {
    if (RIDING_DASHBOARD_REQUIRES_LOGIN) return;  // Phase 12: 게이트 ON → 주입 중단
    if (getSession()) return;                     // 로그인 상태 → 계정 메뉴에 이미 존재
    var prefix = relPrefix();
    var href = prefix + 'riding-dashboard/index.html';

    // desktop — .nav__primary 의 CTA(또는 로그인) 링크 앞에 일반 nav 링크로 삽입
    var primary = document.querySelector('.nav__primary');
    if (primary && !primary.querySelector('[data-riding-dashboard-link]')) {
      var a = document.createElement('a');
      a.href = href;
      a.className = 'nav__link';
      a.setAttribute('role', 'menuitem');
      a.setAttribute('data-riding-dashboard-link', '');
      a.textContent = '라이딩 분석';
      var anchor = primary.querySelector('.nav__link--cta') ||
                   primary.querySelector('.nav__link--login');
      if (anchor) primary.insertBefore(a, anchor);
      else primary.appendChild(a);
    }

    // mobile — .mobile-menu__list 의 로그인 항목 뒤에 <li> 로 삽입
    var mobileList = document.querySelector('.mobile-menu__list');
    if (mobileList && !mobileList.querySelector('[data-riding-dashboard-link]')) {
      var li = document.createElement('li');
      var ma = document.createElement('a');
      ma.href = href;
      ma.setAttribute('data-riding-dashboard-link', '');
      ma.textContent = '라이딩 분석';
      li.appendChild(ma);
      var loginLi = null;
      mobileList.querySelectorAll('a').forEach(function (x) {
        if (!loginLi && /(^|\/)login\.html$/.test(x.getAttribute('href') || '')) {
          loginLi = x.closest('li');
        }
      });
      if (loginLi && loginLi.nextSibling) mobileList.insertBefore(li, loginLi.nextSibling);
      else if (loginLi) mobileList.appendChild(li);
      else mobileList.insertBefore(li, mobileList.firstChild);
    }
  }

  function init() {
    try {
      if (MEMBER_UI_HIDDEN) {
        // §426 — 회원 UI 표면 hide. 계정 드롭다운은 만들지 않고(render* 스킵)
        // 진입점 anchor 만 숨긴다. '라이딩 분석' 링크는 아래에서 그대로 주입.
        hideMemberUI();
      } else {
        renderDesktopNav();
        renderMobileNav();
      }
      injectRidingDashboardLink();  // 라이딩 분석 게이트 해제 (Danny 2026-05-25)
      // §145-G v9 (Danny 2026-05-14) — installSingleDropdownGuard 항상 실행 (logged out 도 다른 nav dropdown coordination 필요).
      // 이전 (renderDesktopNav 내부 호출) = logged in 만 실행 → logged out 시 multi-open 가드 누락 회귀.
      installSingleDropdownGuard();
    } catch (e) {
      // Fail silent — keep nav functional even if render breaks
      if (window.console) console.warn('nav-auth render error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // §179 (데이빗 2026-06-03) — Supabase 세션은 async 로 해소됨. nav 첫 렌더 시점엔
  // 아직 로그인 상태를 모를 수 있으므로, supabase-auth.js 가 쏘는 'dmj-auth-change'
  // 이벤트에 nav 를 다시 그린다 (로그인/로그아웃 즉시 반영).
  window.addEventListener('dmj-auth-change', function () {
    try {
      if (MEMBER_UI_HIDDEN) { hideMemberUI(); return; }  // §426 — 회원 UI hide 모드
      renderDesktopNav(); renderMobileNav();
    } catch (e) {}
  });
})();
