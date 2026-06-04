// §173 — Coach Danny AI Agent Phase 1 (static FAQ + page routing)
// §173-D (Danny 2026-05-16) — 챗 정체성 "대니" → "Coach Danny" (옥덕필 코치 본인) 변경.
//   변수·class·파일명은 그대로 유지 (agent-deny.*) — UI 표시 문자열만 갱신.
// DO_NOT_REVERT §173 — floating widget 전 페이지 영구 노출. Phase 2 = LLM 백엔드.
// Self-bootstrapping IIFE. Vanilla JS, no frameworks. file:// safe with inline fallback.
(function () {
  'use strict';

  // ===========================================================================
  // Constants & state
  // ===========================================================================
  var STORAGE_KEY = 'dmj_agent_chat_history';      // sessionStorage (anon)
  var USER_DATA_SUFFIX = 'agent_chat_history';     // DMJAuth namespace (logged-in)
  var GREETED_KEY = 'dmj_agent_greeted';
  var AUTOHELLO_KEY = 'dmj_agent_autohello_seen';  // §173-F localStorage — 첫 방문 자동 인사 1회 플래그
  var HISTORY_CAP = 50;
  var TYPING_MIN = 600;
  var TYPING_MAX = 1100;

  var faqEntries = null;     // loaded from agent-faq.json or inline fallback
  var knowledgeChunks = null;  // §173-B — loaded from denny-knowledge.json (RAG corpus)
  var siteMap = null;          // §173 Phase2 — loaded from denny-sitemap.json
  var KB_SCORE_THRESHOLD = 1.5;  // FAQ score 가 이 미만이면 KB 검색으로 fallback
  var widgetState = {
    open: false,
    booted: false,
    fab: null,
    panel: null,
    backdrop: null,
    body: null,
    input: null,
    sendBtn: null,
    quickReplies: null,
    closeBtn: null,
    teaser: null,  // §173-F — 첫 방문 자동 인사 말풍선
    history: [],
    flow: null  // §173 Phase2 — active slot-filling flow { intent, step, slots }
  };

  // ===========================================================================
  // Inline minimal fallback (file:// or fetch fails)
  // ===========================================================================
  var FAQ_FALLBACK = {
    version: 'fallback',
    entries: [
      { id: 'site-start', category: 'site_guide', keywords: ['시작', '처음', '어디서부터', '안내'],
        question: '어디서부터 시작해야 하나요?',
        answer: '윙포일 처음이시면 **Find My Gear** 부터 시작하시는 게 좋아요. 5분 퀴즈로 본인 레벨·체중·라이딩 스타일에 맞는 장비를 추천드려요 ✨',
        page_links: [{ label: 'Find My Gear', url: 'find-my-gear.html' }],
        related: ['skill-assessment-start', 'training-12week', 'gear-beginner'] },
      { id: 'skill-assessment-start', category: 'site_guide', keywords: ['스킬', '진단', '약점'],
        question: '10축 스킬 진단은 뭔가요?',
        answer: '토우 택킹·힐 택킹·토 자이빙·힐 자이빙·점핑 5가지 스킬을 **좌(P)·우(S)** 양쪽 따로 진단하는 100점 만점 시스템이에요 🌊',
        page_links: [{ label: '스킬 진단 시작', url: 'skill-assessment.html' }],
        related: ['site-start', 'training-12week'] },
      { id: 'consult', category: 'site_guide', keywords: ['1:1', '상담', '컨설팅'],
        question: '1:1 상담은 어떻게 받나요?',
        answer: '1:1 컨설팅 페이지에서 신청 가능합니다. 라이딩 스타일·예산·시즌에 맞춰 단무지 옥덕필 박사가 직접 답변드려요 ✨',
        page_links: [{ label: '1:1 상담', url: 'consult.html' }],
        related: ['site-start', 'membership'] },
      { id: 'membership', category: 'site_guide', keywords: ['회원 등급', '등급', '할인'],
        question: '회원 등급은 몇 단계인가요?',
        answer: '**9단계** — 방문자→회원→단무지→단골 라이더→선주문→쥬니어/시니어/코어 팀라이더→관리자. PPC 라인 할인 10/20/25/30/35/40% 차등 ✨',
        page_links: [{ label: '회원 등급', url: 'membership.html' }],
        related: ['site-start'] },
      { id: 'consult-redirect-fallback', category: 'site_guide', keywords: ['fallback', '모름', '도와줘'],
        question: '잘 모르는 내용이에요',
        answer: '제가 답을 못 찾았네요 😅 — 단무지에 직접 문의해 보세요. 옥덕필 박사가 1:1 컨설팅으로 답변드릴 수 있습니다 ✨',
        page_links: [{ label: '1:1 상담 신청', url: 'consult.html' }],
        related: ['consult'] },
      { id: 'agent-self', category: 'site_guide', keywords: ['Coach Danny', '대니', '너 누구', '당신', '누구'],
        question: 'Coach Danny가 누구야?',
        answer: '**Coach Danny** — 단무지 옥덕필 박사(Danny) 입니다 ✨ 윙포일·라이딩 컨설팅 채널이에요. 이 챗은 FAQ + 지식 베이스 기반 AI 어시스턴트로 Coach Danny 노하우를 빠르게 안내해 드립니다 (Phase 1 = FAQ 130+, Phase 2 = LLM + RAG) 🌊',
        page_links: [{ label: '1:1 상담 (실제 Danny)', url: 'consult.html' }],
        related: ['consult'] },
      { id: 'wingfoil-intro', category: 'wingfoil_basics', keywords: ['윙포일', '입문'],
        question: '윙포일이 뭐예요?',
        answer: '윙(돛) 들고 포일(수중 날개) 단 보드 위에 서서, 바람으로 추진하고 포일로 공중 부양해서 미끄러지는 워터스포츠입니다 ✨',
        page_links: [{ label: '입문자 가이드', url: 'level/beginner.html' }],
        related: ['site-start', 'gear-beginner'] }
    ]
  };

  // ===========================================================================
  // Path prefix detection (matches nav-auth.js pattern)
  // ===========================================================================
  function relPrefix() {
    var path = location.pathname;
    var marker = '/site/';
    var idx = path.indexOf(marker);
    var rel = idx >= 0 ? path.substring(idx + marker.length) : path.replace(/^\/+/, '');
    var segs = rel.split('/').slice(0, -1).filter(Boolean);
    return segs.map(function () { return '../'; }).join('') || '';
  }

  function svgPath()       { return relPrefix() + 'assets/images/agent-deny.svg'; }
  function faqJsonUrl()    { return relPrefix() + 'data/agent-faq.json'; }
  function knowledgeUrl()  { return relPrefix() + 'data/denny-knowledge.json'; }
  function siteMapUrl()    { return relPrefix() + 'data/denny-sitemap.json'; }

  // §173-D (Danny 2026-05-16) — Coach Danny avatar = Danny 실제 사진 (face-centered crop).
  //   "내사진으로 돌리고 Coach Danny로 해보자" → 카툰/마스코트 폐기, 실제 코치 정체성 통일.
  //   <picture> with WebP primary + PNG fallback. Sizes: 48/80/160/240.
  //   파일 그대로 활용 (agent-deny-photo-*) — file rename 은 별도 cleanup.
  function photoBase()  { return relPrefix() + 'assets/images/agent-deny-photo-'; }
  function _photoSize(size) {
    // 가장 가까운 canonical raster size 매핑 (1× 기준; 2× retina 는 size×2 매칭).
    var canonical = [48, 80, 160, 240];
    var target = size <= 56 ? 48 : size <= 96 ? 80 : size <= 176 ? 160 : 240;
    return canonical.indexOf(target) >= 0 ? target : 80;
  }
  function avatarPictureHtml(size, altText) {
    var s = _photoSize(size);
    var base = photoBase() + s;
    var alt = altText || '';
    return '<picture>'
         +   '<source type="image/webp" srcset="' + base + '.webp">'
         +   '<img src="' + base + '.png" alt="' + alt + '" '
         +       'width="' + size + '" height="' + size + '" loading="lazy" decoding="async">'
         + '</picture>';
  }

  // ===========================================================================
  // Auth detection (DMJAuth shim aware, fallback to direct localStorage)
  // ===========================================================================
  function getCurrentUser() {
    try {
      if (window.DMJAuth && typeof window.DMJAuth.currentUser === 'function') {
        return window.DMJAuth.currentUser();
      }
      var raw = localStorage.getItem('dmj_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.email || (s.expiresAt && s.expiresAt < Date.now())) return null;
      var usersRaw = localStorage.getItem('dmj_users');
      if (!usersRaw) return null;
      var users = JSON.parse(usersRaw);
      return users[String(s.email).toLowerCase()] || null;
    } catch (e) { return null; }
  }

  function userDisplayName(user) {
    if (!user) return '';
    return user.nickname || user.name || (user.email ? user.email.split('@')[0] : '') || '';
  }

  // ===========================================================================
  // History persistence
  // ===========================================================================
  function loadHistory() {
    try {
      var raw = null;
      var u = getCurrentUser();
      if (u && window.DMJAuth && typeof window.DMJAuth.getUserData === 'function') {
        raw = window.DMJAuth.getUserData(USER_DATA_SUFFIX);
      } else {
        raw = sessionStorage.getItem(STORAGE_KEY);
      }
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveHistory(arr) {
    try {
      var capped = arr.slice(-HISTORY_CAP);
      var serialized = JSON.stringify(capped);
      var u = getCurrentUser();
      if (u && window.DMJAuth && typeof window.DMJAuth.setUserData === 'function') {
        window.DMJAuth.setUserData(USER_DATA_SUFFIX, serialized);
      } else {
        sessionStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (e) {}
  }

  function pushHistory(role, content, meta) {
    widgetState.history.push({
      role: role,
      content: content,
      meta: meta || null,
      ts: Date.now()
    });
    saveHistory(widgetState.history);
  }

  // ===========================================================================
  // Tokenizer + normalizer
  // ===========================================================================
  function normalize(s) {
    if (s == null) return '';
    return String(s)
      .toLowerCase()
      .replace(/[?!.,;:'"()\[\]{}<>·…—–-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(s) {
    var n = normalize(s);
    if (!n) return [];
    var raw = n.split(' ');
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var t = raw[i];
      if (!t || t.length < 1) continue;
      out.push(t);
    }
    return out;
  }

  // ===========================================================================
  // FAQ matching engine
  // ===========================================================================
  function entryById(id) {
    if (!faqEntries) return null;
    for (var i = 0; i < faqEntries.length; i++) {
      if (faqEntries[i].id === id) return faqEntries[i];
    }
    return null;
  }

  function scoreEntry(entry, queryTokens, queryRaw) {
    var score = 0;
    var qLower = String(queryRaw || '').toLowerCase();
    var kws = entry.keywords || [];
    var qStr = (entry.question || '').toLowerCase();

    // Direct substring matches on keywords (weighted)
    // §173 v8 — 1-char keywords (e.g. "P", "S") 는 word-boundary 매칭만 (spurious 차단)
    for (var i = 0; i < kws.length; i++) {
      var kw = String(kws[i]).toLowerCase();
      if (!kw) continue;
      var hitSubstring = qLower.indexOf(kw) !== -1;
      // §173 v8 — short Latin keywords (1-2 char, e.g. "P", "S", "AS") 는 정확 token 일치만
      // (한글 2자 keyword 는 의미 있어서 substring 허용)
      var isShortLatin = (kw.length <= 2 && /^[a-z0-9]+$/i.test(kw));
      if (hitSubstring && isShortLatin) {
        var exactToken = false;
        for (var ix = 0; ix < queryTokens.length; ix++) {
          if (queryTokens[ix] === kw) { exactToken = true; break; }
        }
        hitSubstring = exactToken;
      }
      if (hitSubstring) {
        score += kw.length >= 3 ? 4 : 2;
      } else {
        // Token-level overlap (kw length>=2 only). Short Latin → exact-token only.
        if (kw.length < 2) continue;
        for (var j = 0; j < queryTokens.length; j++) {
          var qt = queryTokens[j];
          if (!qt || qt.length < 2) continue;
          if (isShortLatin) {
            if (qt === kw) score += 1.5;  // exact token match only
          } else if (kw.indexOf(qt) !== -1 || qt.indexOf(kw) !== -1) {
            score += 1.5;
          }
        }
      }
    }

    // Question-text token overlap (lower weight)
    for (var k = 0; k < queryTokens.length; k++) {
      var t = queryTokens[k];
      if (!t || t.length < 2) continue;
      if (qStr.indexOf(t) !== -1) score += 0.6;
    }

    return score;
  }

  function findBestMatch(query) {
    if (!faqEntries || !faqEntries.length) return null;
    var tokens = tokenize(query);
    if (!tokens.length) return null;

    var best = null;
    var bestScore = 0;
    for (var i = 0; i < faqEntries.length; i++) {
      var e = faqEntries[i];
      var s = scoreEntry(e, tokens, query);
      if (s > bestScore) { bestScore = s; best = e; }
    }
    if (bestScore < 1) return null;
    return best;
  }

  function findRelatedFor(entry, max) {
    max = max || 3;
    if (!entry || !faqEntries) return [];
    var rels = [];

    // 1. explicit related ids
    if (Array.isArray(entry.related)) {
      for (var i = 0; i < entry.related.length && rels.length < max; i++) {
        var r = entryById(entry.related[i]);
        if (r && r.id !== entry.id && rels.indexOf(r) === -1) rels.push(r);
      }
    }

    // 2. same-category fallback
    if (rels.length < max) {
      for (var j = 0; j < faqEntries.length && rels.length < max; j++) {
        var e = faqEntries[j];
        if (e.id === entry.id) continue;
        if (e.category !== entry.category) continue;
        if (rels.indexOf(e) === -1) rels.push(e);
      }
    }

    return rels.slice(0, max);
  }

  // ===========================================================================
  // §173-B — Knowledge Base (RAG) scoring + retrieval
  // canonical Danny memory + 검증 논문 + 브랜드 spec chunks
  // hallucination 차단: chunk content 그대로 인용 (paraphrase 없음, just wrapping)
  // ===========================================================================
  function scoreKnowledgeChunk(chunk, tokens, queryRaw) {
    var score = 0;
    var qLower = String(queryRaw || '').toLowerCase();
    var tags = chunk.tags || [];
    var title = (chunk.title || '').toLowerCase();
    var topic = String(chunk.topic || '').toLowerCase();
    var content = (chunk.content || '').toLowerCase();

    // Tag exact/substring matches (weighted high — tags are curated)
    // §173 v8 — short Latin tags (1-2 char) 는 exact-token 일치만 (spurious 차단)
    for (var i = 0; i < tags.length; i++) {
      var tag = String(tags[i]).toLowerCase();
      if (!tag) continue;
      var tagShortLatin = (tag.length <= 2 && /^[a-z0-9]+$/i.test(tag));
      var tagHit = qLower.indexOf(tag) !== -1;
      if (tagHit && tagShortLatin) {
        var tagExact = false;
        for (var ix2 = 0; ix2 < tokens.length; ix2++) {
          if (tokens[ix2] === tag) { tagExact = true; break; }
        }
        tagHit = tagExact;
      }
      if (tagHit) {
        score += tag.length >= 3 ? 5 : 2.5;
      } else {
        if (tag.length < 2) continue;
        for (var j = 0; j < tokens.length; j++) {
          var t = tokens[j];
          if (!t || t.length < 2) continue;
          if (tagShortLatin) {
            if (t === tag) score += 2;
          } else if (tag.indexOf(t) !== -1 || t.indexOf(tag) !== -1) {
            score += 2;
          }
        }
      }
    }

    // Title token overlap (medium weight)
    for (var k = 0; k < tokens.length; k++) {
      var tk = tokens[k];
      if (!tk || tk.length < 2) continue;
      if (title.indexOf(tk) !== -1) score += 1.2;
      if (topic.indexOf(tk) !== -1) score += 0.8;
    }

    // Content token overlap (low weight — body is long)
    for (var m = 0; m < tokens.length; m++) {
      var ct = tokens[m];
      if (!ct || ct.length < 2) continue;
      if (content.indexOf(ct) !== -1) score += 0.3;
    }

    return score;
  }

  function findKnowledgeMatches(query, topN) {
    topN = topN || 3;
    if (!knowledgeChunks || !knowledgeChunks.length) return [];
    var tokens = tokenize(query);
    if (!tokens.length) return [];

    var scored = [];
    for (var i = 0; i < knowledgeChunks.length; i++) {
      var c = knowledgeChunks[i];
      var s = scoreKnowledgeChunk(c, tokens, query);
      if (s > 0) scored.push({ chunk: c, score: s });
    }
    if (!scored.length) return [];

    scored.sort(function (a, b) { return b.score - a.score; });
    // §173 v8 — threshold 낮춤: 2 → 1.2 (partial keyword 매치 허용 + hallucination 차단)
    var out = [];
    for (var j = 0; j < scored.length && out.length < topN; j++) {
      if (scored[j].score < 1.2) break;
      out.push(scored[j]);
    }
    return out;
  }

  // Format knowledge chunk into Denny-voice reply
  function knowledgeChunkToReply(scored) {
    if (!scored || !scored.length) return null;
    var top = scored[0].chunk;
    var prefix = '제 단무지 지식 베이스에서 찾았어요 ✨\n\n**' + top.title + '**\n\n';
    var body = top.content;
    var sourceLine = '\n\n_📚 출처: ' + (top.source || 'canonical memory') + '_';

    // Extract page_links from content if any (already inline) — also add canonical 1:1 consult link
    var page_links = [
      { label: '더 자세한 1:1 상담', url: 'consult.html' }
    ];

    // Build "related" pseudo-entries from other top matches
    var related = [];
    for (var i = 1; i < scored.length && related.length < 3; i++) {
      var c = scored[i].chunk;
      related.push({
        id: c.id,
        question: c.title,
        _isKnowledge: true,
        _chunk: c
      });
    }

    return {
      answer: prefix + body + sourceLine,
      page_links: page_links,
      related: related
    };
  }

  // ===========================================================================
  // Rendering — text formatting (markdown-lite)
  // ===========================================================================
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderInlineMd(s) {
    // Escape first, then re-apply our supported markdown markers.
    var esc = escapeHtml(s);
    // **bold**
    esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // *italic* (require non-* on the boundary side)
    esc = esc.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // _italic_ (for source citations)
    esc = esc.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    // §173-B — paragraph breaks (KB chunks use \n\n) and single line breaks
    esc = esc.replace(/\n\n/g, '<br><br>');
    esc = esc.replace(/\n/g, '<br>');
    return esc;
  }

  function prefixedUrl(url) {
    if (!url) return '#';
    // Absolute URL = pass through
    if (/^https?:\/\//i.test(url)) return url;
    if (url.charAt(0) === '/') return url;
    return relPrefix() + url;
  }

  // ===========================================================================
  // DOM render
  // ===========================================================================
  function elFromHtml(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    return wrap.firstChild;
  }

  function renderMsg(role, content, meta) {
    var body = widgetState.body;
    if (!body) return;

    if (role === 'bot') {
      var bubble = document.createElement('div');
      bubble.className = 'agent-deny-msg agent-deny-msg--bot';
      bubble.innerHTML = renderInlineMd(content);
      body.appendChild(bubble);

      if (meta && Array.isArray(meta.page_links) && meta.page_links.length) {
        var linksWrap = document.createElement('div');
        linksWrap.className = 'agent-deny-msg__links';
        for (var i = 0; i < meta.page_links.length; i++) {
          var pl = meta.page_links[i];
          var a = document.createElement('a');
          a.className = 'agent-deny-msg__page-link';
          a.href = prefixedUrl(pl.url);
          a.textContent = pl.label || pl.url;
          a.setAttribute('data-agent-pagelink', '1');
          linksWrap.appendChild(a);
        }
        body.appendChild(linksWrap);
      }

      // §173 Phase 2 — slot-filling 답변 chips (유도 대화)
      if (meta && Array.isArray(meta.slot_chips) && meta.slot_chips.length) {
        var slotWrap = document.createElement('div');
        slotWrap.className = 'agent-deny-msg__slots';
        for (var sc = 0; sc < meta.slot_chips.length; sc++) {
          var sChip = meta.slot_chips[sc];
          var sb = document.createElement('button');
          sb.type = 'button';
          sb.className = 'agent-deny-msg__slot-btn';
          sb.textContent = sChip.label;
          sb.setAttribute('data-agent-slot', sChip.value);
          sb.setAttribute('data-agent-slot-label', sChip.label);
          slotWrap.appendChild(sb);
        }
        body.appendChild(slotWrap);
      }

      // §173 v9 (Danny 2026-05-16) — 매트릭스 추천 컴팩트 카드.
      //   buildFitCheckResult 가 매트릭스 lookup → resolveQuizResultData 결과를 카드로 변환해서 전달.
      //   "Find My Gear에서 자세히 보기" 링크 = ?level=&weight=&style= deep-link → 동일 결과 페이지.
      if (meta && meta.rec_card && meta.rec_card.items && meta.rec_card.items.length) {
        var rc = meta.rec_card;
        var card = document.createElement('div');
        card.className = 'agent-deny-msg__reccard';
        var titleH = document.createElement('div');
        titleH.className = 'agent-deny-msg__reccard-title';
        titleH.textContent = rc.title || '내 셋업 추천';
        card.appendChild(titleH);

        var listEl = document.createElement('div');
        listEl.className = 'agent-deny-msg__reccard-list';
        for (var ri = 0; ri < rc.items.length; ri++) {
          var it = rc.items[ri];
          var row = document.createElement('div');
          row.className = 'agent-deny-msg__reccard-row';
          var lbl = document.createElement('span');
          lbl.className = 'agent-deny-msg__reccard-label';
          lbl.textContent = it.label;
          row.appendChild(lbl);
          var nm = document.createElement('span');
          nm.className = 'agent-deny-msg__reccard-name';
          nm.textContent = it.title + (it.detail ? ' · ' + it.detail : '');
          row.appendChild(nm);
          if (it.price) {
            var pr = document.createElement('span');
            pr.className = 'agent-deny-msg__reccard-price';
            pr.textContent = it.price;
            row.appendChild(pr);
          }
          listEl.appendChild(row);
        }
        card.appendChild(listEl);

        if (rc.total) {
          var tot = document.createElement('div');
          tot.className = 'agent-deny-msg__reccard-total';
          tot.textContent = '합계 ' + rc.total;
          card.appendChild(tot);
        }
        if (rc.reason1 || rc.reason2) {
          var rsn = document.createElement('div');
          rsn.className = 'agent-deny-msg__reccard-reason';
          rsn.textContent = [rc.reason1, rc.reason2].filter(Boolean).join(' ');
          card.appendChild(rsn);
        }
        if (rc.deepLinkUrl) {
          var aL = document.createElement('a');
          aL.className = 'agent-deny-msg__reccard-link';
          aL.href = prefixedUrl(rc.deepLinkUrl);
          aL.textContent = 'Find My Gear에서 자세히 보기 →';
          aL.setAttribute('data-agent-pagelink', '1');
          card.appendChild(aL);
        }
        body.appendChild(card);
      }

      if (meta && Array.isArray(meta.related) && meta.related.length) {
        var relWrap = document.createElement('div');
        relWrap.className = 'agent-deny-msg__related';
        var title = document.createElement('p');
        title.className = 'agent-deny-msg__related-title';
        title.textContent = '관련 더 보기';
        relWrap.appendChild(title);
        var list = document.createElement('div');
        list.className = 'agent-deny-msg__related-list';
        for (var k = 0; k < meta.related.length; k++) {
          var rel = meta.related[k];
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'agent-deny-msg__related-btn';
          b.textContent = rel.question || rel.id;
          b.setAttribute('data-agent-related', rel.id);
          list.appendChild(b);
        }
        relWrap.appendChild(list);
        body.appendChild(relWrap);
      }
    } else {
      var ub = document.createElement('div');
      ub.className = 'agent-deny-msg agent-deny-msg--user';
      ub.textContent = String(content);
      body.appendChild(ub);
    }

    scrollBottom();
  }

  function showTyping() {
    var body = widgetState.body;
    if (!body) return null;
    var t = document.createElement('div');
    t.className = 'agent-deny-typing';
    t.setAttribute('data-agent-typing', '1');
    t.innerHTML = '<span class="agent-deny-typing__dot"></span><span class="agent-deny-typing__dot"></span><span class="agent-deny-typing__dot"></span>';
    body.appendChild(t);
    scrollBottom();
    return t;
  }

  function hideTyping(t) {
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }

  function scrollBottom() {
    var body = widgetState.body;
    if (!body) return;
    requestAnimationFrame(function () {
      body.scrollTop = body.scrollHeight;
    });
  }

  // ===========================================================================
  // Quick replies (page-contextual)
  // ===========================================================================
  function getPageContext() {
    var p = location.pathname;
    if (/find-my-gear\.html$/i.test(p))             return 'fmg';
    if (/skill-assessment\.html$/i.test(p))         return 'skill';
    if (/(^|\/)level\//i.test(p))                   return 'level';
    if (/(^|\/)products\//i.test(p))                return 'product';
    if (/cart\.html$/i.test(p) || /quote\.html$/i.test(p))  return 'cart';
    if (/(^|\/)index\.html$/i.test(p) || p === '/' || /\/site\/?$/.test(p))  return 'home';
    return 'default';
  }

  function quickRepliesForContext(ctx) {
    switch (ctx) {
      case 'fmg':     return ['내 레벨 모르겠어', '예산 안내', 'Goofy/Regular 뭐?', '사이즈 도움'];
      case 'skill':   return ['문항 너무 많아', 'P/S 뭐?', '스탠스 모름', '결과 어떻게 봐?'];
      case 'level':   return ['내 레벨 맞아?', '다음 단계', '장비 추천', '훈련 프로그램'];
      case 'product': return ['가격?', '사이즈 추천', '장바구니 어떻게?', '비교'];
      case 'cart':    return ['견적서 어떻게?', '입금 방법', '배송', '환불'];
      case 'home':    return ['윙포일 처음인데?', '장비 추천', '12주 프로그램', '이벤트 안내'];
      default:        return ['윙포일 처음', '장비 추천', '이벤트', '1:1 상담'];
    }
  }

  function renderQuickReplies(chips) {
    var qr = widgetState.quickReplies;
    if (!qr) return;
    qr.innerHTML = '';
    if (!chips || !chips.length) return;
    for (var i = 0; i < chips.length; i++) {
      var c = chips[i];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'agent-deny-chip';
      b.textContent = c;
      b.setAttribute('data-agent-chip', c);
      qr.appendChild(b);
    }
  }

  // ===========================================================================
  // §173 Phase 2 — Intent classifier + slot-filling 유도 대화 엔진
  //   LLM 없이 규칙 기반. 사이트 콘텐츠(sitemap/KB/FAQ) = knowledge.
  //   7 의도: fit-check / size-inquiry / price-inquiry / performance-compare
  //           / setup-recommendation / lesson-consult / navigation
  // ===========================================================================
  var INTENT_PATTERNS = {
    'fit-check': /(나한테\s*맞|내게\s*맞|나에게\s*맞|맞을까|맞나|맞아|적합|할\s*수\s*있을까|탈\s*수\s*있|가능한가|가능할까|가능해|가능한지|쓸\s*수\s*있|써도\s*(돼|될까)|괜찮을까|이거.*되나|어울리|적절한가|(초보|입문자?|초심자)(인데|이지만|는데)?[^.!?\n]{0,20}(가능|돼|될까|될까요|할\s*수|타도|써도|괜찮))/i,
    'size-inquiry': /(몇\s*[lL리]|사이즈|size|볼륨|volume|몇\s*m\b|몇\s*미터|몇\s*평|면적|얼마짜리.*사이즈|크기|보드.*[lL리터])/i,
    'price-inquiry': /(얼마|가격|price|비용|예산|budget|돈|만원|원\s*[?인대]|할인|세일|싸게|저렴|견적|얼마예|얼마에|얼마나\s*해)/i,
    'performance-compare': /(vs|대비|차이|비교|어느\s*게|어떤\s*게\s*(좋|나|낫)|뭐가\s*(좋|나|낫)|성능|잘\s*나가|빠르|느리|장단점|어때|어떄|어떤가|어떻습|좋아\?|낫나|낫어)/i,
    'setup-recommendation': /(셋업|setup|풀세트|풀\s*패키지|장비\s*추천|추천(해|좀|줘|해줘|부탁)?|뭐\s*(사|살|구매|사야)|어떤\s*거\s*사|뭐부터|뭐\s*사지|입문\s*장비|장비\s*뭐)/i,
    'lesson-consult': /(강습|강습소|스쿨|레슨|lesson|배우|배울|가르쳐|가르치|교육|코칭|coaching|상담|컨설팅|consult|1:1|일대일|전문가|직접\s*만나|클래스|class|수업|어디서\s*배[워우])/i,
    'navigation': /(어디|어떻게\s*(가|들어가|찾|보)|페이지|메뉴|링크|찾고\s*싶|보고\s*싶|위치|이동|바로가기)/i
  };

  // 의도 분류 — 우선순위 순서대로 평가, 첫 매치 반환. 매치 없으면 null.
  // fit-check 가 가장 강한 의도 (구매 funnel 의 핵심)
  var INTENT_PRIORITY = ['lesson-consult', 'fit-check', 'size-inquiry', 'performance-compare', 'price-inquiry', 'setup-recommendation', 'navigation'];

  function classifyIntent(query) {
    var q = String(query || '');
    if (!q) return null;
    var matched = [];
    for (var key in INTENT_PATTERNS) {
      if (INTENT_PATTERNS.hasOwnProperty(key) && INTENT_PATTERNS[key].test(q)) {
        matched.push(key);
      }
    }
    if (!matched.length) return null;
    if (matched.length === 1) return matched[0];
    // 다중 매치 → priority 순
    for (var i = 0; i < INTENT_PRIORITY.length; i++) {
      if (matched.indexOf(INTENT_PRIORITY[i]) !== -1) return INTENT_PRIORITY[i];
    }
    return matched[0];
  }

  // ---- 사용자 프로필 (로그인 시 slot 자동 채움) ----
  function getUserProfile() {
    var profile = { level: null, weight: null, wind: null, budget: null };
    try {
      var u = getCurrentUser();
      if (!u) return profile;
      // DMJAuth user object 또는 별도 프로필 데이터
      if (u.weight) profile.weight = parseInt(u.weight, 10) || null;
      if (u.level) profile.level = String(u.level).toLowerCase();
      if (u.spotWind || u.wind) profile.wind = String(u.spotWind || u.wind).toLowerCase();
      // getUserData 로 진단/퀴즈 결과 확인
      if (window.DMJAuth && typeof window.DMJAuth.getUserData === 'function') {
        var fmgRaw = window.DMJAuth.getUserData('fmg_result') || window.DMJAuth.getUserData('find_my_gear');
        if (fmgRaw) {
          var fmg = typeof fmgRaw === 'string' ? JSON.parse(fmgRaw) : fmgRaw;
          if (fmg && fmg.level && !profile.level) profile.level = String(fmg.level).toLowerCase();
          if (fmg && fmg.weight && !profile.weight) profile.weight = parseInt(fmg.weight, 10) || null;
          if (fmg && fmg.wind && !profile.wind) profile.wind = String(fmg.wind).toLowerCase();
        }
      }
    } catch (e) {}
    return profile;
  }

  // ---- Slot 파서 (free-text + chip value 둘 다 처리) ----
  function parseLevelSlot(v) {
    var s = String(v || '').toLowerCase().trim();
    // §173 Phase2 v2 — canonical code 직접 매칭 (chip value)
    if (s === 'novice' || s === 'beginner' || s === 'intermediate' || s === 'advanced' || s === 'pro') return s;
    if (/노비스|아예\s*처음|시작\s*전|해본\s*적\s*없/.test(s)) return 'novice';
    if (/입문|초보|처음|뉴비/.test(s)) return 'beginner';
    if (/중급|어느\s*정도|좀\s*탐/.test(s)) return 'intermediate';
    if (/상급|고급|잘\s*탐|숙련/.test(s)) return 'advanced';
    if (/선수|프로|레이스|race|국대|대회/.test(s)) return 'pro';
    if (/초급/.test(s)) return 'novice';
    return null;
  }
  function parseWeightSlot(v) {
    var m = String(v || '').match(/(\d{2,3})\s*(kg|킬로|키로)?/);
    if (m) {
      var w = parseInt(m[1], 10);
      if (w >= 30 && w <= 150) return w;
    }
    return null;
  }
  function parseWindSlot(v) {
    var s = String(v || '').toLowerCase().trim();
    // §173 Phase2 v2 — canonical code 직접 매칭 (chip value)
    if (s === 'light' || s === 'medium' || s === 'strong' || s === 'unknown') return s;
    if (/미풍|약(한|풍)|light|약하|살랑|10\s*kt\s*이하|≤\s*10/.test(s)) return 'light';
    if (/강(한|풍)|strong|쎈|센|17\s*kt\s*이상|≥\s*17|20\s*kt/.test(s)) return 'strong';
    if (/중(간|풍)|medium|보통|11.*16/.test(s)) return 'medium';
    if (/모름|몰라|잘\s*몰|글쎄|상관|미정|unknown/.test(s)) return 'unknown';
    return null;
  }
  function parseBudgetSlot(v) {
    var s = String(v || '').toLowerCase().trim();
    // §173 Phase2 v2 — canonical code 직접 매칭 (chip value: value/mid/premium/unknown)
    if (s === 'value' || s === 'mid' || s === 'premium' || s === 'unknown') return s;
    if (/가성비|저렴|싸게|입문가|아껴|최소|적게|부담/.test(s)) return 'value';
    if (/풀패키지|풀\s*세트|상관\s*없|좋은\s*(거|걸|것)|좋은걸|최고|프리미엄|premium|아낌없/.test(s)) return 'premium';
    if (/중간|적당|보통/.test(s)) return 'mid';
    if (/모름|몰라|글쎄|아직|미정/.test(s)) return 'unknown';
    return null;
  }

  // ---- Flow 정의 — "적합도 문의" (fit-check) slot-filling ----
  // 각 step: { slot, question, chips, parse }
  var FIT_CHECK_FLOW = [
    {
      slot: 'level',
      question: '확인해 드릴게요! 몇 가지만 여쭤볼게요 ✨\n\n**1. 라이딩 실력 수준이 어떻게 되세요?**',
      chips: [
        { label: '아예 처음', value: 'novice' },
        { label: '입문', value: 'beginner' },
        { label: '중급', value: 'intermediate' },
        { label: '상급', value: 'advanced' },
        { label: '선수', value: 'pro' },
        { label: '5분 스킬 진단 받을래요', value: '__skill_assessment__' }
      ],
      parse: parseLevelSlot
    },
    {
      slot: 'weight',
      question: '**2. 체중이 어떻게 되세요?** (장비 사이즈 매칭에 꼭 필요해요)\n\n_숫자로 입력해 주세요 — 예: 70_',
      chips: [
        { label: '~60kg', value: '58' },
        { label: '60-75kg', value: '68' },
        { label: '75-85kg', value: '80' },
        { label: '85kg+', value: '90' }
      ],
      parse: parseWeightSlot
    },
    {
      slot: 'wind',
      question: '**3. 주로 타는 스팟의 평균 풍속은 어떤가요?**',
      chips: [
        { label: '미풍 (≤10kt)', value: 'light' },
        { label: '중풍 (11-16kt)', value: 'medium' },
        { label: '강풍 (≥17kt)', value: 'strong' },
        { label: '잘 모르겠어요', value: 'unknown' }
      ],
      parse: parseWindSlot
    },
    {
      slot: 'budget',
      question: '**4. 예산은 어느 정도 고려하고 계세요?**',
      chips: [
        { label: '가성비 우선', value: 'value' },
        { label: '중간', value: 'mid' },
        { label: '좋은 걸로', value: 'premium' },
        { label: '아직 모르겠어요', value: 'unknown' }
      ],
      parse: parseBudgetSlot
    }
  ];

  // Flow 시작 — slots 일부는 로그인 프로필로 자동 채움
  function startFitCheckFlow() {
    var profile = getUserProfile();
    var slots = {
      level: profile.level || null,
      weight: profile.weight || null,
      wind: profile.wind || null,
      budget: null
    };
    widgetState.flow = { intent: 'fit-check', step: 0, slots: slots, autofilled: [] };
    // 자동 채워진 slot 기록
    if (slots.level) widgetState.flow.autofilled.push('level');
    if (slots.weight) widgetState.flow.autofilled.push('weight');
    if (slots.wind) widgetState.flow.autofilled.push('wind');
    return advanceFitCheckFlow(null);
  }

  // Flow 진행 — query(slot 답변) 받아서 현재 step 채우고 다음 question 반환
  function advanceFitCheckFlow(query) {
    var flow = widgetState.flow;
    if (!flow) return null;

    // 현재 step 의 slot 채우기 (query 가 있을 때만)
    if (query != null && flow.step < FIT_CHECK_FLOW.length) {
      var stepDef = FIT_CHECK_FLOW[flow.step];
      // 스킬 진단 chip 선택 — flow 중단 + 진단 페이지 안내
      if (String(query).trim() === '__skill_assessment__') {
        widgetState.flow = null;
        return {
          answer: '좋아요! **10축 스킬 진단**으로 정확한 실력을 먼저 확인해 보세요 ✨\n\n5 스킬(택킹·자이빙·점핑)을 좌우(P/S) 따로 100점 진단합니다. 진단 후 결과를 알려주시면 거기 맞춰 추천해 드릴게요!',
          page_links: [{ label: '10축 스킬 진단 시작', url: 'skill-assessment.html' }],
          related: []
        };
      }
      // §173 Phase2 v2 — chip value 직접 매칭 (canonical code 면 parse 우회)
      //   chip 클릭 시 slotVal = canonical code (예: 'premium', 'unknown') 가 넘어옴.
      //   parser 가 못 잡는 무한루프 버그 방지 — chip value 와 정확 일치하면 그대로 사용.
      var qTrim = String(query).trim();
      var parsed = null;
      var isChipValue = false;
      for (var ci = 0; ci < stepDef.chips.length; ci++) {
        if (String(stepDef.chips[ci].value) === qTrim) { isChipValue = true; break; }
      }
      if (isChipValue) {
        // weight slot 은 number 변환 필요, 그 외는 canonical code 그대로
        parsed = (stepDef.slot === 'weight') ? (parseWeightSlot(qTrim) || parseInt(qTrim, 10)) : qTrim;
      } else {
        // free-text 입력 → parser 로 정규화
        parsed = stepDef.parse(query);
      }
      if (parsed != null) {
        flow.slots[stepDef.slot] = parsed;
      } else {
        // 파싱 실패 — 같은 질문 재시도 (chip 다시 제시)
        return {
          answer: '음, 잘 못 알아들었어요 😅 아래 버튼 중에서 골라 주시거나 다시 입력해 주실래요?',
          slot_chips: stepDef.chips,
          page_links: [],
          related: []
        };
      }
      flow.step++;
    }

    // 다음 미충족 slot 찾기 (autofilled 는 skip)
    while (flow.step < FIT_CHECK_FLOW.length) {
      var nextDef = FIT_CHECK_FLOW[flow.step];
      if (flow.slots[nextDef.slot] != null) {
        // 이미 채워짐 (로그인 자동) → skip
        flow.step++;
        continue;
      }
      // 질문 제시
      return {
        answer: nextDef.question,
        slot_chips: nextDef.chips,
        page_links: [],
        related: []
      };
    }

    // 모든 slot 충족 → 최종 추천
    return buildFitCheckResult(flow.slots, flow.autofilled);
  }

  // §173 v9 (Danny 2026-05-16) — 매트릭스 lazy-load.
  //   Coach Danny 챗은 모든 페이지에 노출되지만 matrix.js 는 일부 페이지만 로드 (find-my-gear, level/*, style/*, cart, quote).
  //   Fit-check 최종 단계에서 매트릭스 데이터 + matrix.js 가 둘 다 필요 → 챗에서 prefetch + lazy-load.
  //   matrix.js 자체는 수정하지 않고 호출만 — 같은 lookup/resolveQuizResultData 사용 → exact parity 보장.
  var matrixReadyPromise = null;
  function ensureMatrixReady() {
    if (matrixReadyPromise) return matrixReadyPromise;
    matrixReadyPromise = (async function () {
      var prefix = relPrefix();
      // 1) JSON prefetch (매 페이지에서 정확한 path 가 다르므로 챗 자체 relPrefix 로).
      //    이미 inline 으로 host page 가 제공한 경우(find-my-gear.html 등) 건너뜀.
      if (!window.DMJ_DATA_INLINE
          || !window.DMJ_DATA_INLINE.products
          || !window.DMJ_DATA_INLINE.matrix) {
        try {
          var pRes = await fetch(prefix + 'data/products.json');
          var mRes = await fetch(prefix + 'data/equipment_matrix.json');
          if (pRes.ok && mRes.ok) {
            var pj = await pRes.json();
            var mj = await mRes.json();
            window.DMJ_DATA_INLINE = window.DMJ_DATA_INLINE || {};
            window.DMJ_DATA_INLINE.products = window.DMJ_DATA_INLINE.products || pj;
            window.DMJ_DATA_INLINE.matrix = window.DMJ_DATA_INLINE.matrix || mj;
          }
        } catch (e) {
          console.warn('[Denny] matrix data prefetch failed', e);
        }
      }
      // 2) matrix.js 동적 로드 (이미 있으면 skip).
      if (!window.DMJMatrix) {
        await new Promise(function (resolve) {
          var s = document.createElement('script');
          s.src = prefix + 'assets/js/matrix.js';
          s.async = true;
          s.onload = function () { resolve(); };
          s.onerror = function () { resolve(); }; // soft-fail → null check at caller
          document.head.appendChild(s);
        });
      }
      return window.DMJMatrix || null;
    })();
    return matrixReadyPromise;
  }

  // 챗 슬롯(level=canonical, weight=kg number, wind, budget) → 매트릭스 lookup 인자.
  //   weight kg → bucket: <65=light, 65-75=mid-light, 75-85=mid-heavy, ≥85=heavy
  //     (find-my-gear.html quiz UI 와 정확히 동일한 분기)
  //   style: 챗에서 묻지 않음 — 한국 기본값 'choppy-freeride' (matrix v1.4 wind baseline 과 정렬)
  //   demographic: 챗에서 묻지 않음 → null (인구통계 보정 X)
  function chatSlotsToMatrixParams(slots) {
    var w = parseInt(slots.weight, 10);
    var weightBucket;
    if (!isFinite(w)) weightBucket = 'mid-light';
    else if (w < 65) weightBucket = 'light';
    else if (w < 75) weightBucket = 'mid-light';
    else if (w < 85) weightBucket = 'mid-heavy';
    else weightBucket = 'heavy';
    return {
      level: slots.level || 'beginner',
      weight: weightBucket,
      style: 'choppy-freeride',
      demographic: null
    };
  }

  // products.json 의 wings/foils/boards/accessories 섹션으로 SKU 카테고리 판정.
  //   resolveQuizResultData 가 반환하는 recommendations 는 카테고리 정보가 없어서 직접 판정.
  function categorizeRecSku(sku) {
    var products = (window.DMJ_DATA_INLINE && window.DMJ_DATA_INLINE.products) || null;
    if (!products || !sku) return 'other';
    if (products.wings && products.wings[sku]) return 'wing';
    if (products.foils && products.foils[sku]) return 'foil';
    if (products.boards && products.boards[sku]) return 'board';
    if (products.accessories && products.accessories[sku]) return 'accessory';
    return 'other';
  }

  // 만 단위 가격 표시 (matrix.js totalDisplay 와 동일 규칙).
  function formatKRW(p) {
    if (typeof p !== 'number' || !isFinite(p) || p <= 0) return '';
    if (p >= 10000000) return '₩' + (Math.round(p / 100000) / 100).toFixed(1) + 'M';
    return '₩' + Math.round(p / 10000) + '만';
  }

  // resolved (DMJMatrix.resolveQuizResultData 결과) → 컴팩트 카드 데이터.
  //   wing/foil/board 한 줄씩 + 합계 + 1-2 줄 reason + Find My Gear deep-link.
  //   foil 은 exact/options 모드(=세트 1개) 면 단일 row, components 모드(=3개) 면 모델명 묶어서 한 row + 합산가.
  function buildRecCardFromResolved(resolved, slots, deepLinkUrl) {
    if (!resolved || !Array.isArray(resolved.recommendations)) return null;
    var grouped = { wing: [], foil: [], board: [], accessory: [] };
    resolved.recommendations.forEach(function (r) {
      var c = categorizeRecSku(r.sku);
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(r);
    });
    var items = [];

    // Wing — primary 만 표시 (alternative 는 가격 fallback 용으로 들어와도 무시).
    if (grouped.wing.length) {
      var w0 = grouped.wing[0];
      items.push({
        kind: 'wing', label: '윙',
        title: ((w0.brand || '') + ' ' + (w0.model || w0.sku)).trim(),
        detail: w0.size ? w0.size + 'm²' : '',
        price: formatKRW(w0.price_KRW)
      });
    }

    // Foil — components 면 묶음 표시, set 이면 단일 표시.
    if (grouped.foil.length === 1) {
      var f0 = grouped.foil[0];
      items.push({
        kind: 'foil', label: '포일 (세트)',
        title: ((f0.brand || '') + ' ' + (f0.model || f0.sku)).trim(),
        detail: '',
        price: formatKRW(f0.price_KRW)
      });
    } else if (grouped.foil.length > 1) {
      var fSum = 0;
      var fNames = [];
      grouped.foil.forEach(function (x) {
        if (typeof x.price_KRW === 'number') fSum += x.price_KRW;
        if (x.model) fNames.push(x.model);
        else if (x.sku) fNames.push(x.sku);
      });
      items.push({
        kind: 'foil', label: '포일 (구성)',
        title: fNames.join(' + '),
        detail: grouped.foil.length + 'pc',
        price: formatKRW(fSum)
      });
    }

    // Board — size 는 매트릭스에서 feet/inches(`5'10"`) 또는 liter("83L") 둘 다 가능.
    //   raw string 그대로 노출 (단위 추측 X).
    if (grouped.board.length) {
      var b0 = grouped.board[0];
      items.push({
        kind: 'board', label: '보드',
        title: ((b0.brand || '') + ' ' + (b0.model || b0.sku)).trim(),
        detail: b0.size || '',
        price: formatKRW(b0.price_KRW)
      });
    }

    if (!items.length) return null;

    // 1-2 줄 reason — 슬롯 요약 + 풍속 코칭 (matrix entry reasoning 은 너무 길어서 별도 합성).
    var levelLabelsShort = { novice: '입문 전', beginner: '입문', intermediate: '중급', advanced: '상급', pro: '선수' };
    var windLabelsShort = { light: '미풍', medium: '중풍', strong: '강풍' };
    var bits = [(levelLabelsShort[slots.level] || slots.level || '')];
    if (slots.weight) bits.push(slots.weight + 'kg');
    if (slots.wind && slots.wind !== 'unknown' && windLabelsShort[slots.wind]) {
      bits.push(windLabelsShort[slots.wind]);
    }
    var reason1 = bits.filter(Boolean).join(' · ') + ' 기준 한국 표준(Choppy·Freeride) 셋업.';
    var reason2 = '';
    if (slots.wind === 'light')      reason2 = '미풍 스팟이면 윙 한 사이즈 ↑ 권장.';
    else if (slots.wind === 'strong') reason2 = '강풍 스팟이면 윙 한 사이즈 ↓ 권장.';

    return {
      title: '내 셋업 추천',
      items: items,
      total: formatKRW(resolved.totalKRW),
      reason1: reason1,
      reason2: reason2,
      deepLinkUrl: deepLinkUrl
    };
  }

  // 최종 추천 — 모인 slot 으로 매트릭스 lookup + 컴팩트 카드 + find-my-gear deep-link.
  //   §173 v9: 챗에서 한 번 슬롯 받았으면 같은 질문 또 X — 바로 결과를 보여주고
  //   "자세히 보기" 누르면 find-my-gear 가 ?level=&weight=&style= 로 결과 페이지 직행.
  //   exact parity: 챗카드 = find-my-gear 결과 (같은 lookup, 같은 resolveQuizResultData).
  async function buildFitCheckResult(slots, autofilled) {
    widgetState.flow = null;  // flow 종료

    var levelLabels = {
      novice: '노비스 (입문 전)', beginner: '입문', intermediate: '중급',
      advanced: '상급', pro: '선수'
    };
    var levelPages = {
      novice: 'level/novice.html', beginner: 'level/beginner.html',
      intermediate: 'level/intermediate.html', advanced: 'level/advanced.html',
      pro: 'level/pro.html'
    };
    var windLabels = { light: '미풍 (≤10kt)', medium: '중풍 (11-16kt)', strong: '강풍 (≥17kt)', unknown: '미정' };
    var budgetLabels = { value: '가성비 우선', mid: '중간', premium: '좋은 장비', unknown: '미정' };

    var lv = slots.level || 'beginner';
    var summary = '정리해 드릴게요! ✨\n\n'
      + '- **실력**: ' + (levelLabels[lv] || lv) + '\n'
      + '- **체중**: ' + (slots.weight ? slots.weight + 'kg' : '미정') + '\n'
      + '- **주 풍속**: ' + (windLabels[slots.wind] || '미정') + '\n'
      + '- **예산**: ' + (budgetLabels[slots.budget] || '미정') + '\n\n';

    if (autofilled && autofilled.length) {
      summary += '_(' + autofilled.join('·') + ' 는 회원님 프로필에서 자동으로 가져왔어요)_\n\n';
    }

    // §173 v9 — 매트릭스 lookup (동일한 엔진, hallucination X).
    var matrixParams = chatSlotsToMatrixParams(slots);
    var deepParams = 'fromchat=1'
      + '&level=' + encodeURIComponent(matrixParams.level)
      + '&weight=' + encodeURIComponent(matrixParams.weight)
      + '&style=' + encodeURIComponent(matrixParams.style);
    if (slots.wind)   deepParams += '&wind=' + encodeURIComponent(slots.wind);
    if (slots.budget) deepParams += '&budget=' + encodeURIComponent(slots.budget);
    var deepLinkUrl = 'find-my-gear.html?' + deepParams;

    var rec_card = null;
    try {
      var DM = await ensureMatrixReady();
      if (DM && typeof DM.lookup === 'function' && typeof DM.resolveQuizResultData === 'function') {
        var entry = await DM.lookup(matrixParams.level, matrixParams.weight, matrixParams.style);
        if (entry) {
          var resolved = DM.resolveQuizResultData(entry, matrixParams);
          rec_card = buildRecCardFromResolved(resolved, slots, deepLinkUrl);
        }
      }
    } catch (err) {
      console.warn('[Denny] matrix lookup failed', err);
      rec_card = null;
    }

    if (rec_card) {
      summary += '아래 추천 셋업 확인해 보세요. 더 자세한 옵션·가격·인구통계 보정은 **Find My Gear**에서 볼 수 있어요!';
    } else {
      // matrix 로드 실패 시 기존 동작 유지 (fallback) — 안내 텍스트.
      var windNote = '';
      if (slots.wind === 'light') windNote = '미풍 스팟이면 윙을 한 사이즈 크게 시작하시는 게 좋아요. ';
      else if (slots.wind === 'strong') windNote = '강풍 스팟이면 윙을 한 사이즈 작게 시작하시는 게 좋아요. ';
      summary += windNote
        + '이 조건으로 **Find My Gear** 결과를 바로 확인하실 수 있어요. '
        + '아래에서 자세히 보거나, **' + (levelLabels[lv] || lv) + ' 레벨 페이지**에서 추천 매트릭스를 보세요.';
    }

    var page_links = [
      { label: 'Find My Gear에서 자세히 보기', url: deepLinkUrl },
      { label: (levelLabels[lv] || lv) + ' 레벨 추천 보기', url: levelPages[lv] || 'level/beginner.html' }
    ];
    // 예산 우선이면 회원 할인 안내 추가
    if (slots.budget === 'value') {
      page_links.push({ label: '회원 등급 할인 (PPC 10-40%)', url: 'membership.html' });
    }

    return {
      answer: summary,
      page_links: page_links,
      related: findRelatedFor({ category: 'site_guide', related: ['fmg-howto', 'site-start', 'membership'] }, 3),
      rec_card: rec_card
    };
  }

  // 모호한 구매 의도 → funnel chip 제시
  function funnelReply(query) {
    return {
      answer: '구매·장비 관련 문의시군요! 어떤 게 궁금하신지 알려주시면 정확히 도와드릴게요 ✨',
      slot_chips: [
        { label: '내게 맞는지', value: '이거 나한테 맞을까요?' },
        { label: '사이즈', value: '사이즈 추천해 주세요' },
        { label: '가격', value: '가격이 궁금해요' },
        { label: '성능 비교', value: '성능 비교해 주세요' },
        { label: '셋업 추천', value: '셋업 추천해 주세요' }
      ],
      page_links: [],
      related: []
    };
  }

  // 의도별 1-shot 응답 (flow 없는 의도 — sitemap routing 기반)
  function intentReply(intent, query) {
    if (intent === 'lesson-consult') {
      return consultationPitchReply();
    }
    if (intent === 'navigation') {
      // sitemap 에서 page 매칭
      var navPage = findSiteMapPage(query);
      if (navPage) {
        return {
          answer: '**' + navPage.title + '** 페이지에서 확인하실 수 있어요 ✨\n\n' + (navPage.content || ''),
          page_links: [{ label: navPage.title + ' 바로가기', url: navPage.url }],
          related: []
        };
      }
      return null;  // fall through to FAQ/KB
    }
    if (intent === 'setup-recommendation') {
      // 실력 식별 시도
      var lvl = parseLevelSlot(query);
      if (lvl) {
        var lvlPages = { novice: 'level/novice.html', beginner: 'level/beginner.html', intermediate: 'level/intermediate.html', advanced: 'level/advanced.html', pro: 'level/pro.html' };
        var lvlLabels = { novice: '노비스', beginner: '입문', intermediate: '중급', advanced: '상급', pro: '선수' };
        return {
          answer: '**' + lvlLabels[lvl] + ' 셋업** 추천이군요! ✨\n\n' + lvlLabels[lvl]
            + ' 레벨 페이지에 16-entry 추천 매트릭스가 있고, **Find My Gear** 퀴즈로 체중·풍속까지 반영한 정확한 매칭을 받을 수 있어요.',
          page_links: [
            { label: lvlLabels[lvl] + ' 레벨 추천 매트릭스', url: lvlPages[lvl] },
            { label: 'Find My Gear 퀴즈', url: 'find-my-gear.html' }
          ],
          related: []
        };
      }
      // 실력 미식별 → fit-check flow 로 유도
      return startFitCheckFlow();
    }
    if (intent === 'price-inquiry') {
      return {
        answer: '가격 문의시군요! 어떤 제품인지 알려주시면 정확한 정보를 드릴 수 있어요.\n\n참고로 단무지는 **회원 등급별 PPC 라인 10-40% 차등 할인**이 있고, 장바구니 → **견적 요청** 시 등급 할인이 자동 적용돼요 ✨',
        page_links: [
          { label: '회원 등급·할인 안내', url: 'membership.html' },
          { label: '브랜드별 제품 보기 (Levitaz)', url: 'levitaz.html' }
        ],
        related: findRelatedFor({ category: 'site_guide', related: ['membership', 'quote', 'kor-price-vs-eu'] }, 3)
      };
    }
    // size-inquiry / performance-compare → null 반환하면 KB/FAQ 가 처리
    return null;
  }

  // §173 Phase2 v3 — 실력 자기소개 인식 ("나는 초보야", "중급이에요" 등)
  //   classifyIntent 가 못 잡는 자기 상태 진술 → helpful fallback 으로 버리지 않고 유도.
  var SELF_INTRO_RE = /(^|\s)(나는|저는|제가|난\s|전\s|내가|나\s|저\s)/;
  function detectSkillSelfIntro(query) {
    var q = String(query || '').trim();
    if (!q) return null;
    var lvl = parseLevelSlot(q);
    if (!lvl) return null;
    // 자기소개 패턴 OR 짧은 실력 진술 ("초보야", "중급이에요", "처음 시작했어요")
    //   단, 다른 명확한 의도(추천/사이즈/가격 등)가 섞이면 detectSkillSelfIntro 는 양보 (botReplyFor 에서 intent 우선)
    if (SELF_INTRO_RE.test(q) || q.length <= 14) {
      return lvl;
    }
    return null;
  }

  // 실력 수준별 친근 유도 응답 (자기소개 받았을 때)
  function skillLevelGuideReply(level) {
    var labels = { novice: '노비스(입문 전)', beginner: '입문', intermediate: '중급', advanced: '상급', pro: '선수' };
    var levelPages = {
      novice: 'level/novice.html', beginner: 'level/beginner.html',
      intermediate: 'level/intermediate.html', advanced: 'level/advanced.html', pro: 'level/pro.html'
    };
    var intro = {
      novice: '윙포일을 막 시작하시는군요! 🙌',
      beginner: '윙포일 입문 단계시군요! 🙌',
      intermediate: '중급 라이더시군요! 🙌',
      advanced: '상급 라이더시군요! 🙌',
      pro: '선수 레벨이시군요! 🙌'
    };
    var tip = {
      novice: '입문 전이라면 — 육상에서 윙 조작부터 익히는 게 안전해요.',
      beginner: '입문자에게 가장 중요한 건 **육상 → 수상 조작 → 수상 띄우기** 3단계 세션 분리예요.',
      intermediate: '중급은 **84cm 마스트** + 약쪽(weak side) 강화가 핵심이에요.',
      advanced: '상급은 **96cm 마스트** + 카운터밸런스 라이딩 단계예요.',
      pro: '선수 단계는 race-grade 셋업 (Levitaz R6 + PPC Sonic FDS) 이에요.'
    };
    var lbl = labels[level] || level;
    return {
      answer: '반가워요! ' + (intro[level] || '') + '\n\n' + (tip[level] || '') + '\n\n어떤 게 궁금하세요?',
      slot_chips: [
        { label: lbl + ' 셋업 추천', value: lbl + ' 셋업 추천해줘' },
        { label: '어디서부터 시작?', value: '윙포일 어디서부터 시작해야 해요?' },
        { label: lbl + ' 보드·윙 사이즈', value: lbl + ' 보드 윙 사이즈 추천' },
        { label: '내게 맞는 장비 찾기', value: '내게 맞는 장비 찾아줘' }
      ],
      page_links: [{ label: lbl + ' 레벨 페이지', url: levelPages[level] || 'level/beginner.html' }],
      related: []
    };
  }

  // sitemap page 매칭 (navigation 의도용)
  function findSiteMapPage(query) {
    if (!siteMap || !siteMap.pages) return null;
    var tokens = tokenize(query);
    if (!tokens.length) return null;
    var best = null, bestScore = 0;
    var all = (siteMap.tools || []).concat(siteMap.pages || []);
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      var score = 0;
      var hay = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.answers || []).join(' ')).toLowerCase();
      for (var j = 0; j < tokens.length; j++) {
        var t = tokens[j];
        if (t.length < 2) continue;
        if (hay.indexOf(t) !== -1) score += 1;
      }
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 1 ? best : null;
  }

  // ===========================================================================
  // §173 v8 — Bot reply pipeline (4-layer):
  //   Layer 1: Greeting / 짧은 query → friendly invitation (sales X)
  //   Layer 2: KB match — threshold 4 → 2 (partial match 허용)
  //   Layer 3: No-match → helpful prompt (다른 질문 유도, sales X)
  //   Layer 4: Consultation pitch — 명시적 트리거 키워드 시만
  // ===========================================================================
  // §173 v8 — greeting prefix match (어 떤 trailing 도 허용 — "안녕하세요", "반갑습니다", "좋은아침" 등)
  var GREETING_RE = /^\s*(안녕|하이|hi+|hello|헬로|반갑|좋은\s*(?:아침|저녁|밤|하루)|굿\s*(?:모닝|이브닝|나잇)|모닝|이브닝|음+|아+|어+|네+|예+|ㅎ+|ㅋ+|hey|yo|sup|test+|테스트|첫\s*인사)(\s*$|[\s\.\!\?ㅎㅋ~]|하세요|하셈|해|히|히여|이에요|예요|입니다|합니다|습니다|네요|드려요|드립니다|에요)/i;
  // §173 v8 — STRONG consultation triggers only (weak signals "문의"/"연락"/"이메일" 제외 → 일반 FAQ/KB 로 흘러감)
  var CONSULT_TRIGGER_RE = /(1\s*[::]\s*1|일대일|개인\s*상담|상담\s*(?:신청|받|예약)|컨설팅\s*(?:신청|받|예약|비용|가격)|coaching|코칭|직접\s*만나|premium\s*consult|프리미엄\s*컨설팅)/i;
  // §173 Phase2 v4 — 강습·스쿨·레슨 trigger (faqStrong 무관하게 早期 lessonReply 로 라우팅)
  //   "윙포일 강습스쿨 추천" 이 "윙포일" FAQ 강매치로 일반 정의 답변 떨어지는 버그 fix
  var LESSON_TRIGGER_RE = /(강습|강습소|강습\s*스쿨|스쿨|레슨|lesson|배우고\s*싶|배울\s*수\s*있|배우려|어디서\s*배[워우]|가르쳐|가르치|클래스|class|수업|교육|입문\s*교육|초보\s*교육|트레이닝\s*받)/i;

  function isGreetingOrShort(query) {
    if (!query) return false;
    var q = String(query).trim();
    if (q.length === 0) return true;
    if (GREETING_RE.test(q)) return true;
    // 4글자 미만 + 의미 단어 없음
    if (q.length < 4) return true;
    return false;
  }

  function greetingReply() {
    return {
      answer:
        '안녕하세요 ✨ **Coach Danny**예요.\n\n'
        + '어떤 게 궁금하세요? **윙포일·장비·라이딩 컨설팅** 무엇이든 물어보세요.\n\n'
        + '*이렇게 구체적으로 물어보시면 더 정확해요:*\n'
        + '• "윙포일 처음인데 뭐부터?"\n'
        + '• "내 체급에 맞는 윙 사이즈?"\n'
        + '• "택킹·자이빙 자꾸 실패해요"',
      page_links: [],
      related: findRelatedFor({ category: 'site_guide', related: ['site-start', 'fmg-howto', 'wingfoil-intro'] }, 3)
    };
  }

  function helpfulNoMatchReply() {
    return {
      answer:
        '이 부분은 Coach Danny가 아직 답변 자료 준비 중이에요 🙏\n\n'
        + '*이런 질문은 어떠세요?*\n'
        + '• "윙포일 처음인데 뭐부터?"\n'
        + '• "내 체급에 맞는 윙 사이즈는?"\n'
        + '• "택킹·자이빙 자꾸 실패해요"\n'
        + '• "마스트 길이는 어떻게 고르나요?"\n\n'
        + '_또는 화면 아래 빠른 질문 칩도 참고해 주세요._',
      page_links: [],
      related: findRelatedFor({ category: 'site_guide', related: ['site-start', 'fmg-howto', 'training-12week'] }, 3)
    };
  }

  function consultationPitchReply() {
    return {
      answer:
        '**1:1 컨설팅**은 옥덕필 박사가 직접 응대드려요 ✨\n\n'
        + '라이딩 영상·체급·spot 환경에 맞춰 맞춤 처방 가능합니다. ',
      page_links: [
        { label: '1:1 상담 신청', url: 'consult.html' },
        { label: 'consulting@dmjgroup.kr 이메일', url: 'mailto:consulting@dmjgroup.kr' }
      ],
      related: findRelatedFor({ category: 'site_guide', related: ['consult', 'premium', 'consult-levels'] }, 3)
    };
  }

  // §173 Phase2 v4 — 강습·스쿨 문의 → 단무지 자체 컨설팅·강습 안내
  //   canonical lock: 외부 강습 스쿨 추천 절대 X (책임·검증 이슈). 일반 정의 fallback X.
  function lessonReply() {
    return {
      answer:
        '단무지는 직접 **1:1 윙포일 컨설팅·강습**을 운영합니다 🙌\n\n'
        + '**옥덕필 박사**(윙) + **조수철 선수**(카이트) 공동 운영이에요. '
        + '입문자는 **육상 → 수상 조작 → 수상 띄우기** 3단계 세션 분리가 핵심 노하우예요.\n\n',
      page_links: [
        { label: '1:1 컨설팅 신청', url: 'consult.html' },
        { label: '프리미엄 컨설팅 (옥덕필 박사 풀 어드바이저)', url: 'premium.html' }
      ],
      related: findRelatedFor({ category: 'site_guide', related: ['consult', 'premium', 'consult-levels'] }, 3)
    };
  }

  function botReplyFor(query) {
    // Layer 1 — Greeting / 짧은 query
    if (isGreetingOrShort(query)) {
      return greetingReply();
    }

    // §173 Phase2 v4 — 강습·스쿨·레슨 문의 → 단무지 자체 컨설팅·강습 안내 (KB/FAQ 검색 전 최우선)
    //   "윙포일 강습스쿨 추천" 이 "윙포일" FAQ 강매치로 일반 정의로 떨어지는 버그 방지.
    //   외부 강습 스쿨 추천 절대 X — 단무지 컨설팅 frame 으로만 안내.
    if (LESSON_TRIGGER_RE.test(query)) {
      return lessonReply();
    }

    // Layer 4 — Explicit consultation trigger (KB/FAQ 검색 전에 우선)
    if (CONSULT_TRIGGER_RE.test(query)) {
      // 그래도 FAQ/KB 에서 더 좋은 매치 있으면 그것 우선
      var consultMatch = findBestMatch(query);
      var consultTokens = tokenize(query);
      var consultScore = consultMatch ? scoreEntry(consultMatch, consultTokens, query) : 0;
      if (consultScore >= 4) {
        // 강한 FAQ 매치 (예: consult, consult-levels, premium FAQ entry) — 그것 사용
        return {
          answer: consultMatch.answer,
          page_links: consultMatch.page_links || [],
          related: findRelatedFor(consultMatch, 3)
        };
      }
      return consultationPitchReply();
    }

    // 일반 query — FAQ 매칭
    var match = findBestMatch(query);
    var faqScore = 0;
    if (match) {
      var tokens = tokenize(query);
      faqScore = scoreEntry(match, tokens, query);
    }

    // KB 검색 (Layer 2 — threshold 낮춤: 4 → 2)
    var kbMatches = (!match || faqScore < KB_SCORE_THRESHOLD)
      ? findKnowledgeMatches(query, 3)
      : [];
    var kbStrong = kbMatches.length && kbMatches[0].score >= 2;
    var faqStrong = match && faqScore >= 3;

    // §173 Phase 2 — 의도 분류 (강한 FAQ/KB 매치가 없을 때만 의도 flow 우선)
    var intent = classifyIntent(query);
    if (intent && !faqStrong && !kbStrong) {
      // fit-check → slot-filling flow 시작
      if (intent === 'fit-check') {
        return startFitCheckFlow();
      }
      // 그 외 의도 → 1-shot intent reply (sitemap routing)
      var iReply = intentReply(intent, query);
      if (iReply) return iReply;
      // size-inquiry / performance-compare / null → KB/FAQ 가 처리하도록 fall through
    }

    // §173 Phase2 v3 — 실력 자기소개 인식 ("나는 초보야" 등 — 명확 의도 없을 때)
    //   classifyIntent 가 못 잡은 실력 진술 → helpful fallback 대신 친근 유도
    if (!intent && !faqStrong && !kbStrong) {
      var selfLevel = detectSkillSelfIntro(query);
      if (selfLevel) return skillLevelGuideReply(selfLevel);
    }

    // KB strong match (>=2 — 낮춰진 threshold) 면 KB 우선
    if (kbStrong) {
      var kbReply = knowledgeChunkToReply(kbMatches);
      if (kbReply) return kbReply;
    }

    // FAQ 매치 사용 + KB 보강
    if (match && faqScore >= 1) {
      var faqRelated = findRelatedFor(match, 3);
      if (kbMatches.length && faqRelated.length < 3) {
        var first = kbMatches[0].chunk;
        faqRelated.push({ id: first.id, question: first.title, _isKnowledge: true, _chunk: first });
      }
      return {
        answer: match.answer,
        page_links: match.page_links || [],
        related: faqRelated
      };
    }

    // §173 Phase 2 — 구매 관련 모호 의도 → funnel chip (helpful prompt 보다 우선)
    if (intent && (intent === 'price-inquiry' || intent === 'setup-recommendation' || intent === 'size-inquiry' || intent === 'performance-compare')) {
      return funnelReply(query);
    }

    // §173 Phase2 v3 — 자기 상태 진술 ("나는~/저는~/제가~") → helpful 대신 funnel 로 유도
    //   (체중·스팟·장비 진술 등 — 명확 매치 없어도 "학습 중" 으로 버리지 않음)
    if (SELF_INTRO_RE.test(query)) {
      return funnelReply(query);
    }

    // Layer 3 — no-match → helpful prompt (sales X)
    return helpfulNoMatchReply();
  }

  // §173 Phase 2 — flow 중단 키워드 (사용자가 다른 질문하고 싶을 때)
  var FLOW_ABORT_RE = /^(취소|그만|아니|관둬|중단|stop|cancel|됐어|안\s*할래|나중에)/i;

  function processUserQuery(query) {
    query = String(query || '').trim();
    if (!query) return;

    renderMsg('user', query);
    pushHistory('user', query);

    var t = showTyping();
    var delay = TYPING_MIN + Math.floor(Math.random() * (TYPING_MAX - TYPING_MIN));

    setTimeout(function () {
      hideTyping(t);

      var replyP;
      // §173 Phase 2 — active flow 가 있으면 slot 답변으로 처리
      // §173 v9 — buildFitCheckResult 는 매트릭스 lookup 때문에 async. Promise.resolve 로 통일.
      if (widgetState.flow) {
        if (FLOW_ABORT_RE.test(query)) {
          widgetState.flow = null;
          replyP = Promise.resolve({
            answer: '네, 알겠어요! 다른 게 궁금하시면 편하게 물어봐 주세요 ✨',
            page_links: [], related: []
          });
        } else if (widgetState.flow.intent === 'fit-check') {
          replyP = Promise.resolve(advanceFitCheckFlow(query));
        } else {
          widgetState.flow = null;
          replyP = Promise.resolve(botReplyFor(query));
        }
      } else {
        replyP = Promise.resolve(botReplyFor(query));
      }

      replyP.then(function (reply) {
        renderMsg('bot', reply.answer, {
          page_links: reply.page_links,
          related: reply.related,
          slot_chips: reply.slot_chips,
          rec_card: reply.rec_card
        });
        pushHistory('bot', reply.answer, {
          page_links: reply.page_links,
          related: (reply.related || []).map(function (r) { return { id: r.id, question: r.question }; }),
          slot_chips: reply.slot_chips,
          rec_card: reply.rec_card
        });
        // §173 v8 — bot 응답 후 cursor 자동 input 복귀 (free-form 무한 prompt 유도, desktop only)
        var isDesktop = !window.matchMedia || !window.matchMedia('(max-width: 540px)').matches;
        if (isDesktop && widgetState.input) {
          try { widgetState.input.focus({ preventScroll: true }); } catch (e) {}
        }
      });
    }, delay);
  }

  // ===========================================================================
  // Greeting
  // ===========================================================================
  function maybeGreet() {
    if (widgetState.history && widgetState.history.length) {
      // Replay history
      for (var i = 0; i < widgetState.history.length; i++) {
        var m = widgetState.history[i];
        if (m.role === 'bot') {
          var meta = m.meta || {};
          // Resolve related ids → full entries
          var relFull = [];
          if (Array.isArray(meta.related)) {
            for (var r = 0; r < meta.related.length; r++) {
              var rid = meta.related[r];
              var rObj = entryById(typeof rid === 'string' ? rid : (rid && rid.id));
              if (rObj) relFull.push(rObj);
              else if (rid && rid.question) relFull.push(rid);
            }
          }
          // §173 Phase 2 — slot_chips 는 replay 시 stale flow 방지 위해 미표시
          //   (history 복원 시 flow state 는 재구성 안 함 — 과거 대화 기록일 뿐)
          // §173 v9 — rec_card 는 정적 데이터(매트릭스 결과 snapshot)이므로 replay 안전.
          renderMsg('bot', m.content, {
            page_links: meta.page_links || [],
            related: relFull,
            rec_card: meta.rec_card || null
          });
        } else {
          renderMsg('user', m.content);
        }
      }
      return;
    }

    var greeted = false;
    try { greeted = !!sessionStorage.getItem(GREETED_KEY); } catch (e) {}

    var user = getCurrentUser();
    var name = userDisplayName(user);
    // §173 v8 — Welcome invitation tone: free-form 질문이 메인. 예시는 sample.
    // §173-E (2026-05-22) — 비로그인 방문자에게도 "안녕하세요" 인사 노출 (기본 인사 누락 fix).
    var nameLine = name ? '안녕하세요 **' + name + '**님!\n' : '안녕하세요!\n';
    var greeting = nameLine
      + '**Coach Danny** — 단무지 옥덕필 박사(Danny) 입니다 ✨\n\n'
      + '윙포일 **라이딩·장비·교육** 무엇이든 자유롭게 질문해 주세요.\n\n'
      + '*예시 질문:*\n'
      + '• "윙포일 처음인데 뭐부터 시작해야 해요?"\n'
      + '• "8kt 바람에 70kg 인데 윙 사이즈 추천?"\n'
      + '• "택킹 자꾸 실패하는데 왜 그럴까요?"\n\n'
      + '_또는 아래 빠른 질문 칩을 눌러도 됩니다 ↓_';

    var meta = {
      page_links: [
        { label: 'Find My Gear', url: 'find-my-gear.html' },
        { label: '스킬 진단', url: 'skill-assessment.html' }
      ],
      related: findRelatedFor({ category: 'site_guide', related: ['site-start', 'fmg-howto', 'training-12week'] }, 3)
    };

    renderMsg('bot', greeting, meta);
    pushHistory('bot', greeting, {
      page_links: meta.page_links,
      related: meta.related.map(function (r) { return { id: r.id, question: r.question }; })
    });

    try { sessionStorage.setItem(GREETED_KEY, '1'); } catch (e) {}
    void greeted;
  }

  // ===========================================================================
  // DOM injection (FAB + panel)
  // ===========================================================================
  function injectWidget() {
    var prefix = relPrefix();

    // Backdrop (mobile)
    var backdrop = document.createElement('div');
    backdrop.className = 'agent-deny-backdrop';
    backdrop.setAttribute('data-open', 'false');
    backdrop.setAttribute('aria-hidden', 'true');

    // FAB
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'agent-deny-fab';
    fab.setAttribute('aria-label', 'Coach Danny — 단무지 윙포일 컨설팅 챗 열기');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', 'agent-deny-panel');
    fab.innerHTML = ''
      + '<span class="agent-deny-fab__avatar">'
      +   avatarPictureHtml(80, '')  // §173-C v2 — photo (WebP/PNG/SVG fallback)
      + '</span>'
      + '<span class="agent-deny-fab__badge" aria-hidden="true">1</span>';

    // Panel
    var panel = document.createElement('div');
    panel.className = 'agent-deny-panel';
    panel.id = 'agent-deny-panel';
    panel.setAttribute('data-open', 'false');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'agent-deny-title');
    panel.innerHTML = ''
      + '<header class="agent-deny-panel__header">'
      +   '<span class="agent-deny-panel__avatar">' + avatarPictureHtml(48, '') + '</span>'
      +   '<div class="agent-deny-panel__titles">'
      +     '<h2 class="agent-deny-panel__title" id="agent-deny-title">Coach Danny</h2>'
      +     '<p class="agent-deny-panel__subtitle">옥덕필 박사 · 단무지 윙포일 컨설팅</p>'
      +   '</div>'
      +   '<button type="button" class="agent-deny-panel__close" aria-label="대화창 닫기">×</button>'
      + '</header>'
      + '<div class="agent-deny-panel__body" role="log" aria-live="polite" aria-atomic="false"></div>'
      + '<div class="agent-deny-quickreplies-wrap">'
      +   '<p class="agent-deny-quickreplies-label">또는 빠른 질문 →</p>'
      +   '<div class="agent-deny-quickreplies" role="list" aria-label="빠른 질문"></div>'
      + '</div>'
      + '<form class="agent-deny-panel__footer" autocomplete="off">'
      +   '<textarea class="agent-deny-input" rows="2" placeholder="무엇이든 물어보세요... 윙포일·장비·라이딩 컨설팅" aria-label="질문 입력"></textarea>'
      +   '<button type="submit" class="agent-deny-send" aria-label="전송 (Enter)" title="전송 (Enter)"><span class="agent-deny-send__icon">➤</span></button>'
      + '</form>';

    // §173-F (2026-05-22) — 첫 방문 자동 인사 말풍선 (teaser). localStorage 1회 노출.
    var teaser = document.createElement('div');
    teaser.className = 'agent-deny-teaser';
    teaser.setAttribute('data-open', 'false');
    teaser.setAttribute('role', 'button');
    teaser.setAttribute('tabindex', '0');
    teaser.setAttribute('aria-label', 'Coach Danny 챗봇 열기 — 무엇이 궁금하신가요?');
    teaser.innerHTML = ''
      + '<button type="button" class="agent-deny-teaser__close" aria-label="인사 말풍선 닫기">×</button>'
      + '<p class="agent-deny-teaser__text">안녕하세요! <strong>Coach Danny</strong>예요 😊<br>'
      +   '윙포일·장비·라이딩, 무엇이 궁금하신가요?</p>';

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    document.body.appendChild(teaser);
    document.body.appendChild(fab);

    widgetState.teaser = teaser;
    widgetState.fab = fab;
    widgetState.panel = panel;
    widgetState.backdrop = backdrop;
    widgetState.body = panel.querySelector('.agent-deny-panel__body');
    widgetState.input = panel.querySelector('.agent-deny-input');
    widgetState.sendBtn = panel.querySelector('.agent-deny-send');
    widgetState.quickReplies = panel.querySelector('.agent-deny-quickreplies');
    widgetState.closeBtn = panel.querySelector('.agent-deny-panel__close');
  }

  // ===========================================================================
  // Event wiring
  // ===========================================================================
  function bindEvents() {
    var s = widgetState;

    s.fab.addEventListener('click', function () { toggle(); });

    // §173-F — teaser 말풍선: 본문 클릭 → 패널 열기, X → 닫기. 둘 다 자동 인사 종료.
    if (s.teaser) {
      s.teaser.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.agent-deny-teaser__close')) {
          dismissTeaser();
          return;
        }
        dismissTeaser();
        open();
      });
      s.teaser.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          dismissTeaser();
          open();
        }
      });
    }

    s.closeBtn.addEventListener('click', function () { close(); });
    s.backdrop.addEventListener('click', function () { close(); });

    // ESC to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && s.open) close();
    });

    // Send form
    var form = s.panel.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitInput();
    });

    // §173 v9 — 한글/일본어 IME composition 상태 추적 (double-submit 방지)
    // compositionstart/end 로 명시적 플래그 유지 (구형 브라우저 isComposing 미설정 대비)
    s._composing = false;
    s.input.addEventListener('compositionstart', function () { s._composing = true; });
    s.input.addEventListener('compositionend', function () {
      s._composing = false;
      // compositionend 직후 textarea height 재계산 (마지막 글자 commit 반영)
      s.input.style.height = 'auto';
      s.input.style.height = Math.min(140, s.input.scrollHeight) + 'px';
    });

    // Enter to send (Shift+Enter = newline)
    s.input.addEventListener('keydown', function (e) {
      // §173 v9 — IME 조합 중에는 Enter 무시 (한글 마지막 글자 double-submit 버그 fix)
      //   e.isComposing  : 표준 composition 플래그
      //   e.keyCode 229  : 일부 브라우저가 composition 중 발화하는 fallback keyCode
      //   s._composing   : compositionstart/end 로 추적한 명시적 플래그 (구형 대비)
      if (e.isComposing || e.keyCode === 229 || s._composing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitInput();
      }
    });

    // Auto-resize textarea
    s.input.addEventListener('input', function () {
      s.input.style.height = 'auto';
      s.input.style.height = Math.min(140, s.input.scrollHeight) + 'px';
    });

    // Delegated clicks (quick reply chips, slot chips, related FAQ, page links)
    s.panel.addEventListener('click', function (e) {
      var t = e.target;

      // §173 Phase 2 — slot-filling 답변 chip (유도 대화)
      var slotBtn = t.closest && t.closest('[data-agent-slot]');
      if (slotBtn) {
        var slotVal = slotBtn.getAttribute('data-agent-slot');
        var slotLabel = slotBtn.getAttribute('data-agent-slot-label') || slotVal;
        // 클릭한 chip 비활성화 (중복 클릭 방지)
        var parent = slotBtn.parentNode;
        if (parent) {
          var sibs = parent.querySelectorAll('[data-agent-slot]');
          for (var si = 0; si < sibs.length; si++) {
            sibs[si].disabled = true;
            sibs[si].classList.add('is-disabled');
          }
        }
        slotBtn.classList.add('is-selected');
        // user 메시지는 label 로 표시, 처리는 value 로
        renderMsg('user', slotLabel);
        pushHistory('user', slotLabel);
        var tt = showTyping();
        setTimeout(function () {
          hideTyping(tt);
          var fReplyP;
          // §173 v9 — fit-check 마지막 단계는 async (매트릭스 lookup). Promise 통일.
          if (widgetState.flow && widgetState.flow.intent === 'fit-check') {
            fReplyP = Promise.resolve(advanceFitCheckFlow(slotVal));
          } else {
            fReplyP = Promise.resolve(botReplyFor(slotVal));
          }
          fReplyP.then(function (fReply) {
            renderMsg('bot', fReply.answer, {
              page_links: fReply.page_links, related: fReply.related,
              slot_chips: fReply.slot_chips, rec_card: fReply.rec_card
            });
            pushHistory('bot', fReply.answer, {
              page_links: fReply.page_links,
              related: (fReply.related || []).map(function (r) { return { id: r.id, question: r.question }; }),
              slot_chips: fReply.slot_chips,
              rec_card: fReply.rec_card
            });
            var isDesktop = !window.matchMedia || !window.matchMedia('(max-width: 540px)').matches;
            if (isDesktop && widgetState.input) { try { widgetState.input.focus({ preventScroll: true }); } catch (er) {} }
          });
        }, TYPING_MIN + Math.floor(Math.random() * (TYPING_MAX - TYPING_MIN)));
        return;
      }

      // Chip
      var chip = t.closest && t.closest('[data-agent-chip]');
      if (chip) {
        var q = chip.getAttribute('data-agent-chip');
        processUserQuery(q);
        return;
      }

      // Related FAQ or KB chunk
      var rel = t.closest && t.closest('[data-agent-related]');
      if (rel) {
        var rid = rel.getAttribute('data-agent-related');
        var entry = entryById(rid);
        if (entry) {
          processUserQuery(entry.question);
        } else if (knowledgeChunks) {
          // KB chunk lookup
          for (var kbI = 0; kbI < knowledgeChunks.length; kbI++) {
            if (knowledgeChunks[kbI].id === rid) {
              processUserQuery(knowledgeChunks[kbI].title);
              return;
            }
          }
        }
        return;
      }

      // Page link — close panel before navigation feels nicer on mobile
      var pl = t.closest && t.closest('[data-agent-pagelink]');
      if (pl) {
        // Allow natural anchor navigation; just close on mobile
        if (window.matchMedia && window.matchMedia('(max-width: 540px)').matches) {
          setTimeout(close, 50);
        }
        return;
      }
    });
  }

  function submitInput() {
    var v = (widgetState.input.value || '').trim();
    if (!v) return;
    widgetState.input.value = '';
    widgetState.input.style.height = 'auto';
    processUserQuery(v);
  }

  // ===========================================================================
  // Open / close / toggle
  // ===========================================================================
  function open() {
    var s = widgetState;
    if (!s.panel || s.open) return;
    s.open = true;
    dismissTeaser();  // §173-F — 패널 열리면 자동 인사 말풍선 종료
    s.panel.setAttribute('data-open', 'true');
    s.fab.setAttribute('aria-expanded', 'true');
    s.fab.setAttribute('data-hidden', 'true');
    s.fab.removeAttribute('data-has-badge');
    if (window.matchMedia && window.matchMedia('(max-width: 540px)').matches) {
      s.backdrop.setAttribute('data-open', 'true');
      s.panel.setAttribute('aria-modal', 'true');
    }
    if (!s.body.children.length) maybeGreet();
    renderQuickReplies(quickRepliesForContext(getPageContext()));
    // §173 v8 — desktop only auto-focus (모바일 키보드 자동 팝업 방지)
    var isDesktop = !window.matchMedia || !window.matchMedia('(max-width: 540px)').matches;
    if (isDesktop) {
      setTimeout(function () {
        if (s.input) { s.input.focus({ preventScroll: true }); }
      }, 280);
    }
  }

  function close() {
    var s = widgetState;
    if (!s.panel || !s.open) return;
    s.open = false;
    s.panel.setAttribute('data-open', 'false');
    s.fab.setAttribute('aria-expanded', 'false');
    s.fab.removeAttribute('data-hidden');
    s.backdrop.setAttribute('data-open', 'false');
    s.panel.setAttribute('aria-modal', 'false');
  }

  function toggle() {
    if (widgetState.open) close(); else open();
  }

  function clearHistory() {
    widgetState.history = [];
    try {
      if (window.DMJAuth && typeof window.DMJAuth.removeUserData === 'function') {
        window.DMJAuth.removeUserData(USER_DATA_SUFFIX);
      }
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(GREETED_KEY);
    } catch (e) {}
    if (widgetState.body) widgetState.body.innerHTML = '';
  }

  function ask(query) {
    if (!widgetState.open) open();
    processUserQuery(query);
  }

  // ===========================================================================
  // §173-B — Knowledge Base loader (RAG corpus)
  // ===========================================================================
  function loadKnowledge(done) {
    // Inline override
    if (window.DMJ_AGENT_KB_INLINE && Array.isArray(window.DMJ_AGENT_KB_INLINE.chunks)) {
      knowledgeChunks = window.DMJ_AGENT_KB_INLINE.chunks;
      done && done();
      return;
    }

    // file:// fallback (no chunks — FAQ-only mode)
    if (location.protocol === 'file:') {
      knowledgeChunks = [];
      done && done();
      return;
    }

    try {
      fetch(knowledgeUrl(), { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          knowledgeChunks = (data && Array.isArray(data.chunks)) ? data.chunks : [];
          done && done();
        })
        .catch(function () {
          knowledgeChunks = [];
          done && done();
        });
    } catch (e) {
      knowledgeChunks = [];
      done && done();
    }
  }

  // ===========================================================================
  // §173 Phase 2 — Site map loader (denny-sitemap.json)
  // ===========================================================================
  function loadSiteMap(done) {
    if (window.DMJ_AGENT_SITEMAP_INLINE) {
      siteMap = window.DMJ_AGENT_SITEMAP_INLINE;
      done && done();
      return;
    }
    if (location.protocol === 'file:') {
      siteMap = null;  // navigation 의도는 FAQ/KB fallback
      done && done();
      return;
    }
    try {
      fetch(siteMapUrl(), { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          siteMap = (data && Array.isArray(data.pages)) ? data : null;
          done && done();
        })
        .catch(function () { siteMap = null; done && done(); });
    } catch (e) { siteMap = null; done && done(); }
  }

  // ===========================================================================
  // FAQ loader
  // ===========================================================================
  function loadFaq(done) {
    // Inline override priority
    if (window.DMJ_AGENT_FAQ_INLINE && Array.isArray(window.DMJ_AGENT_FAQ_INLINE.entries)) {
      faqEntries = window.DMJ_AGENT_FAQ_INLINE.entries;
      done && done();
      return;
    }

    // file:// protocol = fetch generally fails, fallback immediately
    if (location.protocol === 'file:') {
      faqEntries = FAQ_FALLBACK.entries;
      done && done();
      return;
    }

    try {
      fetch(faqJsonUrl(), { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data && Array.isArray(data.entries) && data.entries.length) {
            faqEntries = data.entries;
          } else {
            faqEntries = FAQ_FALLBACK.entries;
          }
          done && done();
        })
        .catch(function () {
          faqEntries = FAQ_FALLBACK.entries;
          done && done();
        });
    } catch (e) {
      faqEntries = FAQ_FALLBACK.entries;
      done && done();
    }
  }

  // ===========================================================================
  // §173-F — First-visit auto hello (teaser bubble)
  // ===========================================================================
  function markAutoHelloSeen() {
    try { localStorage.setItem(AUTOHELLO_KEY, '1'); } catch (e) {}
  }

  function hideTeaser() {
    if (widgetState.teaser) widgetState.teaser.setAttribute('data-open', 'false');
  }

  function dismissTeaser() {
    hideTeaser();
    markAutoHelloSeen();
  }

  // 첫 방문이면 잠깐 뒤 자동 인사 말풍선을 띄운다. 1회만 — 이후엔 아이콘만 노출.
  function maybeAutoHello() {
    if (!widgetState.teaser) return;
    var seen = false;
    try { seen = !!localStorage.getItem(AUTOHELLO_KEY); } catch (e) {}
    if (seen) return;             // 이미 본 방문자 — 자동 인사 생략
    if (widgetState.open) return; // 이미 패널이 열려 있음
    if (widgetState.history && widgetState.history.length) {
      markAutoHelloSeen();        // 대화 기록이 있는 재방문자 — 생략
      return;
    }
    setTimeout(function () {
      if (!widgetState.teaser || widgetState.open) { markAutoHelloSeen(); return; }
      widgetState.teaser.setAttribute('data-open', 'true');
      markAutoHelloSeen();        // 1회 노출 후 다시 자동으로 안 뜸
    }, 1400);
  }

  // ===========================================================================
  // Bootstrap
  // ===========================================================================
  function boot() {
    if (widgetState.booted) return;
    widgetState.booted = true;

    injectWidget();
    bindEvents();
    widgetState.history = loadHistory();
    maybeAutoHello();

    loadFaq(function () {
      // Load knowledge base + sitemap in parallel (non-blocking)
      loadKnowledge(function () {
        loadSiteMap(function () {
          // pre-render quickreplies even before open (no flash)
          renderQuickReplies(quickRepliesForContext(getPageContext()));

          // Show badge if first visit (not greeted yet) AND no history
          var greeted = false;
          try { greeted = !!sessionStorage.getItem(GREETED_KEY); } catch (e) {}
          if (!greeted && (!widgetState.history || !widgetState.history.length)) {
            widgetState.fab.setAttribute('data-has-badge', 'true');
          }
        });
      });
    });
  }

  function onReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  // ===========================================================================
  // Expose
  // ===========================================================================
  window.DMJAgent = {
    open: open,
    close: close,
    toggle: toggle,
    ask: ask,
    clearHistory: clearHistory,
    // debug / internal
    _state: widgetState,
    _findBestMatch: findBestMatch,
    _findKnowledgeMatches: findKnowledgeMatches,
    _knowledgeChunks: function () { return knowledgeChunks; },
    _botReplyFor: botReplyFor,
    // §173 Phase 2
    _classifyIntent: classifyIntent,
    _siteMap: function () { return siteMap; },
    _getUserProfile: getUserProfile,
    _detectSkillSelfIntro: detectSkillSelfIntro
  };

  onReady();
})();
