/* §586 모바일 셸 — 옥대표 "우선 모바일 버전으로 앱 느낌으로 현재버젼을 재구성"
 *
 * 데스크톱 DOM 을 다시 짜지 않는다. 768px 이하에서만 껍데기를 덧씌우고,
 * 넓어지면 흔적 없이 걷어낸다. 원래 컨트롤은 그대로 두고 대리 버튼이
 * 눌러 주므로 v2-app.js 의 이벤트 배선을 하나도 건드리지 않는다.
 *
 * 실측 근거 (라이브, 375x812):
 *   위쪽 크롬 1134px · 탭줄 3줄 119px · Performance 8867px/카드 15개
 */
(function () {
  'use strict';

  var MQ = window.matchMedia('(max-width: 768px)');
  var on = false;
  var els = {};            // 셸이 만든 노드
  var moved = [];          // 옮겨온 원본 노드 [node, 원래부모, 원래다음형제]
  var foldState = {};      // 카드 접힘 기억 (재렌더 후 복원)
  var mo = null;

  /* ── 아이콘 ─────────────────────────────────────────────── */
  function svg(d, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      d + (extra || '') + '</svg>';
  }
  var ICON = {
    cond:  svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    wind:  svg('<path d="M4 8h9a3 3 0 1 0-3-3"/><path d="M3 13h13a3 3 0 1 1-3 3"/><path d="M4 18h6"/>'),
    perf:  svg('<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/>'),
    track: svg('<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    turns: svg('<path d="M4 20c8 0 5-14 13-14"/><path d="M14 3l3 3-3 3"/>'),
    coach: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>'),
    att:   svg('<circle cx="12" cy="12" r="8.5"/><path d="M5 14c2.5-2 4.5-2 7 0s4.5 2 7 0"/>'),
    phys:  svg('<path d="M3 12h4l2-5 3 10 2-5h7"/>'),
    sess:  svg('<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M8 3v3M16 3v3M3.5 10h17"/>'),
    load:  svg('<path d="M6 15V9M12 18V6M18 13v-4"/><path d="M3 21h18"/>'),
    more:  svg('<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>'),
    dots:  svg('<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>'),
    chev:  svg('<path d="M6 9l6 6 6-6"/>'),
    up:    svg('<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>'),
    play:  svg('<path d="M7 4.5l12 7.5-12 7.5z"/>'),
    save:  svg('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="7"/>'),
    file:  svg('<path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z"/><path d="M14 3v4.5h4.5"/>'),
    home:  svg('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>'),
    user:  svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>'),
    sun:   svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>')
  };

  /* 탭 → 아이콘/짧은 이름. 하단 탭바에 다섯 자리뿐이라 나머지는 More 로. */
  var TABMETA = {
    '#tab-env':      { icon: 'cond',  label: 'Condition' },   /* §588 */
    '#tab-perf':     { icon: 'perf',  label: 'Perf' },
    '#tab-track':    { icon: 'track', label: 'Track' },
    '#tab-turns':    { icon: 'turns', label: 'Turns' },
    '#tab-attitude': { icon: 'att',   label: 'Attitude' },
    '#tab-coach':    { icon: 'coach', label: 'Coach' },
    '#tab-phys':     { icon: 'phys',  label: 'Body' },
    '#tab-sessions': { icon: 'sess',  label: 'Sessions' },
    '#tab-training': { icon: 'load',  label: 'Load' }
  };
  var PRIMARY = ['#tab-env', '#tab-perf', '#tab-track', '#tab-coach'];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function tabLinks() { return $$('.card-header-tabs .nav-link[data-bs-toggle="tab"]'); }
  function activeHref() {
    var a = $('.card-header-tabs .nav-link.active');
    return a ? a.getAttribute('href') : PRIMARY[0];
  }

  /* ── 앱바 ───────────────────────────────────────────────── */
  function buildAppbar() {
    var bar = document.createElement('div');
    bar.className = 'rdm-appbar';
    bar.innerHTML =
      '<div class="rdm-appbar__txt">' +
        '<div class="rdm-appbar__date" id="rdm-date">—</div>' +
        '<div class="rdm-appbar__title" id="rdm-title">…</div>' +
      '</div>' +
      /* §586k (옥대표 "로그인창이 없는듯") — 로그인 링크는 데스크톱 헤더의
         #auth-chip 안에 있는데 폰에서는 그 헤더를 숨긴다. ⋮ 시트 맨 아래에
         이름표 없이 들어가 있어 사실상 안 보였다. 앱바에 꺼내 둔다. */
      '<button type="button" class="rdm-iconbtn rdm-acct" id="rdm-account" aria-label="Account">' +
        ICON.user + '<span class="rdm-acct__dot" hidden></span></button>' +
      '<button type="button" class="rdm-iconbtn" id="rdm-upload" aria-label="Upload files">' + ICON.up + '</button>' +
      '<button type="button" class="rdm-iconbtn" id="rdm-actions" aria-label="Actions">' + ICON.dots + '</button>';
    var wrap = $('.page-wrapper');
    wrap.insertBefore(bar, wrap.firstChild);
    els.appbar = bar;

    $('#rdm-upload', bar).addEventListener('click', function () {
      var f = $('#v2-file'); if (f) f.click();
    });
    $('#rdm-actions', bar).addEventListener('click', function () { openSheet('actions'); });
    $('#rdm-account', bar).addEventListener('click', onAccount);
    syncAccount();
    // 로그인 상태가 바뀌면 v2-app 이 #auth-chip 을 다시 그린다 — 따라간다
    var chip = $('#auth-chip');
    if (chip) {
      els.chipObs = new MutationObserver(syncAccount);
      els.chipObs.observe(chip, { childList: true, subtree: true, characterData: true });
    }

    syncTitle();
    // 세션을 바꾸면 v2-app 이 제목을 다시 쓴다 — 따라간다
    els.titleObs = new MutationObserver(syncTitle);
    ['#hdr-title', '#hdr-date'].forEach(function (s) {
      var n = $(s); if (n) els.titleObs.observe(n, { childList: true, characterData: true, subtree: true });
    });
  }
  function syncTitle() {
    var t = $('#hdr-title'), d = $('#hdr-date');
    var mt = $('#rdm-title'), md = $('#rdm-date');
    // 제목 옆 연필(수정 버튼)까지 딸려 오면 앱바에 '…✎' 로 붙는다
    if (mt && t) {
      var s = (t.textContent || '').replace(/[\u270e\u270f\ufe0f]+\s*$/, '').trim();
      mt.textContent = s || '—';
    }
    if (md && d) md.textContent = (d.textContent || '').trim() || '—';
  }

  function signedInUser() {
    try { return (window.DMJAuth && DMJAuth.currentUser && DMJAuth.currentUser()) || null; }
    catch (e) { return null; }
  }
  function syncAccount() {
    var b = $('#rdm-account'); if (!b) return;
    var u = signedInUser();
    var dot = b.querySelector('.rdm-acct__dot');
    if (dot) dot.hidden = !u;
    b.setAttribute('aria-label', u ? 'Account: ' + (u.name || u.email || 'signed in') : 'Sign in');
  }
  /* 로그인 전이면 곧장 로그인 화면으로. 주소는 v2-app 이 만든 링크를
     그대로 쓴다(돌아올 곳 next= 포함) — 여기서 따로 만들면 둘이 갈라진다.
     링크가 없으면(서버가 멈춤·모듈 없음) 시트를 열어 이유를 보여 준다. */
  function onAccount() {
    if (!signedInUser()) {
      var a = $('#auth-chip a[href]');
      if (a) { location.href = a.getAttribute('href'); return; }
    }
    openSheet('actions');
  }

  /* ── 하단 탭바 ──────────────────────────────────────────── */
  function buildTabbar() {
    var bar = document.createElement('nav');
    bar.className = 'rdm-tabbar';
    bar.setAttribute('role', 'tablist');
    var html = '';
    PRIMARY.forEach(function (href) {
      var m = TABMETA[href] || { icon: 'more', label: href };
      html += '<button type="button" class="rdm-tabbar__item" data-href="' + href + '" role="tab">' +
                ICON[m.icon] + '<span class="rdm-tabbar__lbl">' + m.label + '</span></button>';
    });
    html += '<button type="button" class="rdm-tabbar__item" id="rdm-more" role="tab">' +
              ICON.more + '<span class="rdm-tabbar__lbl">More</span></button>';
    bar.innerHTML = html;
    document.body.appendChild(bar);
    els.tabbar = bar;

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.rdm-tabbar__item'); if (!btn) return;
      if (btn.id === 'rdm-more') { openSheet('tabs'); return; }
      gotoTab(btn.getAttribute('data-href'));
    });
  }

  function gotoTab(href) {
    var link = $('.card-header-tabs .nav-link[href="' + href + '"]');
    if (!link) { console.warn('[RDMobile] no tab link for', href); return; }
    link.click();                        // Bootstrap 이 처리 — 숨어 있어도 동작한다
    closeSheet();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 접힌 채로 태어난 지도·차트가 폭·높이를 다시 재게 한다
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 260);
    markActive();
  }

  function markActive() {
    var cur = activeHref();
    var inPrimary = PRIMARY.indexOf(cur) >= 0;
    $$('.rdm-tabbar__item', els.tabbar).forEach(function (b) {
      var h = b.getAttribute('data-href');
      var sel = h ? (h === cur) : (!inPrimary);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
    });
  }

  /* ── 시트 ───────────────────────────────────────────────── */
  function buildSheet() {
    var back = document.createElement('div');
    back.className = 'rdm-sheet-back'; back.setAttribute('data-open', '0');
    var sheet = document.createElement('div');
    sheet.className = 'rdm-sheet'; sheet.setAttribute('data-open', '0');
    sheet.innerHTML = '<div class="rdm-sheet__grip"></div><div id="rdm-sheet-body"></div>';
    document.body.appendChild(back);
    document.body.appendChild(sheet);
    els.back = back; els.sheet = sheet;
    back.addEventListener('click', closeSheet);
    sheet.addEventListener('click', function (e) {
      var row = e.target.closest('.rdm-sheet__row'); if (!row) return;
      var href = row.getAttribute('data-href');
      var act = row.getAttribute('data-act');
      if (href) { gotoTab(href); return; }
      if (act) { doAction(act); }
    });
  }

  function openSheet(kind) {
    var body = $('#rdm-sheet-body');
    body.innerHTML = (kind === 'tabs') ? sheetTabs() : sheetActions();
    if (kind === 'actions') fillActionSlots(body);
    els.back.setAttribute('data-open', '1');
    els.sheet.setAttribute('data-open', '1');
  }
  function closeSheet() {
    if (!els.sheet) return;
    restoreMoved();
    els.back.setAttribute('data-open', '0');
    els.sheet.setAttribute('data-open', '0');
  }

  function sheetTabs() {
    var cur = activeHref();
    var h = '<div class="rdm-sheet__ttl">SECTIONS</div>';
    tabLinks().forEach(function (a) {
      var href = a.getAttribute('href');
      var m = TABMETA[href] || { icon: 'more', label: a.textContent.trim() };
      h += '<button type="button" class="rdm-sheet__row" data-href="' + href + '"' +
           ' aria-selected="' + (href === cur ? 'true' : 'false') + '">' +
           ICON[m.icon] + '<span>' + a.textContent.trim() + '</span></button>';
    });
    return h;
  }

  /* 동작은 원본 버튼을 대신 눌러 준다 — 배선을 복제하지 않는다 */
  var ACTIONS = [
    { act: 'upload', icon: 'up',   label: 'Upload files' },
    { act: 'replay', icon: 'play', label: 'Replay' },
    { act: 'save',   icon: 'save', label: 'Save session' },
    { act: 'pdf',    icon: 'file', label: 'PDF' },
    { act: 'csv',    icon: 'file', label: 'Export CSV' },
    { act: 'gpx',    icon: 'file', label: 'Export GPX' },
    { act: 'theme',  icon: 'sun',  label: 'Light / Dark' },
    { act: 'old',    icon: 'home', label: 'Old dashboard' }
  ];
  var ACT_SEL = {
    upload: '#v2-file', replay: '#btn-replay', save: '#btn-save',
    pdf: '#btn-pdf', csv: '#btn-export-csv', gpx: '#btn-export-gpx'
  };

  function sheetActions() {
    var h = '<div class="rdm-sheet__ttl">ACCOUNT</div>' +
            '<div class="rdm-sheet__slot" id="rdm-slot-auth"></div>' +
            /* 사실만 말한다: v2 는 cloud-sync.js 를 싣지 않는다(§586k 확인).
               로그인해도 기록은 이 기기에만 있다. */
            '<div class="rdm-sheet__note">Rides are kept on this device. ' +
            'Moving them between phone and computer is not switched on yet.</div>' +
            '<div class="rdm-sheet__ttl">SESSION</div>' +
            '<div class="rdm-sheet__slot" id="rdm-slot-ghost"></div>';
    ACTIONS.forEach(function (a) {
      if (a.act === 'theme' || a.act === 'old') return;
      h += '<button type="button" class="rdm-sheet__row" data-act="' + a.act + '">' +
           ICON[a.icon] + '<span>' + a.label + '</span></button>';
    });
    h += '<div class="rdm-sheet__ttl">APP</div>';
    ['theme', 'old'].forEach(function (k) {
      var a = ACTIONS.filter(function (x) { return x.act === k; })[0];
      h += '<button type="button" class="rdm-sheet__row" data-act="' + a.act + '">' +
           ICON[a.icon] + '<span>' + a.label + '</span></button>';
    });
    return h;
  }

  /* select 와 계정 표시는 대리로 흉내 낼 수 없다 — 원본을 잠시 옮긴다 */
  function fillActionSlots(body) {
    moveInto($('#replay-ghost'), $('#rdm-slot-ghost', body));
    moveInto($('#auth-chip'), $('#rdm-slot-auth', body));
    var g = $('#replay-ghost');
    if (g && g.hidden) { var s = $('#rdm-slot-ghost', body); if (s) s.style.display = 'none'; }
  }
  function moveInto(node, slot) {
    if (!node || !slot) return;
    moved.push([node, node.parentNode, node.nextSibling]);
    slot.appendChild(node);
  }
  function restoreMoved() {
    while (moved.length) {
      var m = moved.pop();
      try { m[1].insertBefore(m[0], m[2]); } catch (e) { console.warn('[RDMobile] restore failed', e); }
    }
  }

  function doAction(act) {
    if (act === 'theme') {
      var t = $('[data-bs-theme-value], .hide-theme-dark, #theme-toggle');
      var root = document.documentElement;
      var next = root.getAttribute('data-bs-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-bs-theme', next);
      try { localStorage.setItem('rd_theme', next); } catch (e) {}
      closeSheet();
      return;
    }
    if (act === 'old') { location.href = 'index.html'; return; }
    var sel = ACT_SEL[act];
    var el = sel && $(sel);
    if (!el) { console.warn('[RDMobile] action target missing:', act, sel); return; }
    closeSheet();
    el.click();
  }

  /* ── 라이더 입력 접기 ───────────────────────────────────── */
  function buildInputs() {
    var card = $('.page-body .container-xl > .card.mb-3');
    if (!card || !$('#in-weight', card)) { console.warn('[RDMobile] rider input card not found'); return; }
    card.classList.add('rdm-inputs');
    card.setAttribute('data-open', '0');
    var sum = document.createElement('div');
    sum.className = 'rdm-inputs__sum';
    sum.innerHTML = '<span id="rdm-insum"></span><span class="rdm-chev">' + ICON.chev + '</span>';
    card.querySelector('.card-body').insertBefore(sum, card.querySelector('.card-body').firstChild);
    els.inputCard = card; els.inputSum = sum;
    sum.addEventListener('click', function () {
      card.setAttribute('data-open', card.getAttribute('data-open') === '1' ? '0' : '1');
    });
    ['#in-weight', '#in-wing', '#in-skill', '#in-windspeed'].forEach(function (s) {
      var n = $(s); if (n) n.addEventListener('change', syncInputSum);
    });
    syncInputSum();
    els.inputObs = new MutationObserver(syncInputSum);
    ['#in-weight', '#in-wing', '#in-windspeed'].forEach(function (s) {
      var n = $(s); if (n) els.inputObs.observe(n, { attributes: true, attributeFilter: ['value'] });
    });
  }
  function syncInputSum() {
    var t = $('#rdm-insum'); if (!t) return;
    var w = $('#in-weight'), g = $('#in-wing'), k = $('#in-skill'), s = $('#in-windspeed');
    var sk = k && k.options[k.selectedIndex] ? k.options[k.selectedIndex].textContent : '—';
    t.innerHTML =
      '<b>' + (w ? w.value : '—') + '</b> kg · ' +
      '<b>' + (g ? g.value : '—') + '</b> m² · ' +
      sk + ' · <b>' + (s && s.value ? s.value : '—') + '</b> kt';
  }

  /* ── 카드 접기 ──────────────────────────────────────────── */
  function foldKey(card, i) {
    var h = card.querySelector('.card-header');
    var t = h ? (h.textContent || '').trim().slice(0, 40) : '';
    var pane = card.closest('.tab-pane');
    return (pane ? pane.id : '?') + '|' + i + '|' + t;
  }

  /* 최상위 카드 판정 — closest('.card') 를 그냥 쓰면 안 된다. 탭 자체가
     .card.mt-3 안에 들어 있어서 모든 카드가 '중첩'으로 잡힌다(실측: 13개
     중 최상위 0개). 판정은 반드시 pane 에서 멈춰야 한다. */
  function isTopCard(card, pane) {
    var p = card.parentElement;
    while (p && p !== pane) {
      if (p.classList && p.classList.contains('card')) return false;
      p = p.parentElement;
    }
    return true;
  }

  function decorate(pane) {
    if (!pane) return;
    var cards = $$('.card', pane).filter(function (c) { return isTopCard(c, pane); });
    /* 접을 수 있는 카드(머리가 있는 것)만 센다. 인덱스를 전체 카드로 세면
       0번이 머리 없는 카드일 때 아무것도 안 펼쳐진다(tab-env·tab-phys 실측). */
    var nFold = 0;
    cards.forEach(function (card, i) {
      var head = card.querySelector(':scope > .card-header');
      if (!head) return;
      var ord = nFold++;
      var key = foldKey(card, i);
      if (!card.classList.contains('rdm-fold')) {
        card.classList.add('rdm-fold');
        var chev = document.createElement('span');
        chev.className = 'rdm-chev';
        chev.innerHTML = ICON.chev;
        head.appendChild(chev);
        head.addEventListener('click', function (e) {
          // 헤더 안의 진짜 컨트롤을 눌렀으면 접지 않는다
          if (e.target.closest('button, a, select, input, label, .form-check, .btn')) return;
          var nowOpen = card.getAttribute('data-open') !== '1';
          card.setAttribute('data-open', nowOpen ? '1' : '0');
          foldState[card.getAttribute('data-foldkey')] = nowOpen;
          if (nowOpen) setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
        });
      }
      card.setAttribute('data-foldkey', key);
      var remembered = foldState[key];
      var open = (remembered === undefined) ? (ord === 0) : remembered;  // 첫 장만 펼침
      card.setAttribute('data-open', open ? '1' : '0');
    });
    hintTables(pane);
  }

  /* 옆으로 밀어야 보이는 표에는 그렇다고 말해 준다 */
  function hintTables(pane) {
    $$('.table-responsive', pane).forEach(function (w) {
      if (w.getAttribute('data-rdm-hint') === '1') return;
      var t = w.querySelector('table'); if (!t) return;
      if (t.scrollWidth <= w.clientWidth + 4) return;
      w.setAttribute('data-rdm-hint', '1');
      var n = document.createElement('div');
      n.className = 'rdm-scrollhint';
      n.textContent = '← 옆으로 밀어 보세요 (' + (t.querySelectorAll('thead th').length || '?') + ' cols)';
      w.parentNode.insertBefore(n, w.nextSibling);
    });
  }

  function decorateAll() {
    $$('.tab-pane').forEach(decorate);
    markActive();
  }

  /* ── on / off ───────────────────────────────────────────── */
  function activate() {
    if (on) return;
    on = true;
    document.body.classList.add('rdm');
    buildAppbar();
    buildTabbar();
    buildSheet();
    buildInputs();
    decorateAll();

    // v2-app 이 탭 내용을 다시 그리면 접기 장식이 날아간다 — 다시 입힌다
    var host = $('.tab-content');
    if (host) {
      mo = new MutationObserver(function () {
        clearTimeout(mo._t);
        mo._t = setTimeout(decorateAll, 120);
      });
      mo.observe(host, { childList: true, subtree: true });
    }
    tabLinks().forEach(function (a) {
      a.addEventListener('shown.bs.tab', onShown);
      a.addEventListener('click', function () { setTimeout(markActive, 30); });
    });
    console.info('[RDMobile] on');
  }
  function onShown() { setTimeout(function () { decorateAll(); window.dispatchEvent(new Event('resize')); }, 80); }

  function deactivate() {
    if (!on) return;
    on = false;
    closeSheet();
    restoreMoved();
    document.body.classList.remove('rdm');
    if (mo) { mo.disconnect(); mo = null; }
    if (els.titleObs) els.titleObs.disconnect();
    if (els.inputObs) els.inputObs.disconnect();
    if (els.chipObs) els.chipObs.disconnect();
    ['appbar', 'tabbar', 'sheet', 'back'].forEach(function (k) {
      if (els[k] && els[k].parentNode) els[k].parentNode.removeChild(els[k]);
    });
    if (els.inputCard) {
      els.inputCard.classList.remove('rdm-inputs');
      els.inputCard.removeAttribute('data-open');
      if (els.inputSum && els.inputSum.parentNode) els.inputSum.parentNode.removeChild(els.inputSum);
    }
    $$('.rdm-fold').forEach(function (c) {
      c.classList.remove('rdm-fold');
      c.removeAttribute('data-open'); c.removeAttribute('data-foldkey');
      var ch = c.querySelector(':scope > .card-header > .rdm-chev');
      if (ch) ch.parentNode.removeChild(ch);
    });
    $$('.rdm-scrollhint').forEach(function (n) { n.parentNode.removeChild(n); });
    $$('[data-rdm-hint]').forEach(function (n) { n.removeAttribute('data-rdm-hint'); });
    els = {};
    console.info('[RDMobile] off');
  }

  function apply() { MQ.matches ? activate() : deactivate(); }

  function boot() {
    apply();
    if (MQ.addEventListener) MQ.addEventListener('change', apply);
    else MQ.addListener(apply);
    /* §586h — change 이벤트만 믿으면 안 된다. 1280px 로 넓혔는데 셸이 켜진
       채 남았다(matches=false · on=true, 실측). resize 에서도 다시 본다.
       apply 는 상태가 같으면 아무것도 안 하므로 여러 번 불려도 무해하다. */
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(apply, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }

  window.RDMobile = { on: function () { return on; }, refresh: decorateAll, apply: apply };
})();
