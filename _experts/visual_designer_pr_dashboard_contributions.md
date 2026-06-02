# visual_designer_pr_dashboard_contributions.md — `admin/dashboard/` 4 PR contribution spec

| 항목 | 내용 |
|---|---|
| 문서 유형 | γ 채택 (옥대표님 2026-06-02 12:24 KST) 후속 — 시스템 B (`visual_designer_dashboard_spec.md`) 의 4 unique 컴포넌트만 시스템 A (`admin/dashboard/`) 에 PR contribute 형식으로 spec |
| 작성 | Visual Designer (Rose Yoon) · 2026-06-02 |
| 대상 | 인프라 #9 가 본 spec read 후 자율 implement. 본인 (Rose) 은 spec 작성 + 시각 검증·a11y QA round 만 |
| 모(母) 문서 | `_experts/visual_designer_dashboard_spec.md` (DEPRECATED) · `admin/dashboard/app.js` · `admin/dashboard/styles.css` · `admin/dashboard/index.html` |
| 범위 | 4 PR spec — 각 PR 의 DOM · CSS · 시각 토큰 · a11y · 적용 위치 · 검증. 시스템 A 의 다크 cockpit theme 100% 준수, 시스템 A 토큰 (`--bg-elev` 등) 100% 재사용. 본인 메인 사이트 design system 토큰 (`--color-navy` 등) 와 별도 — 본 dashboard 는 #9 영역 |
| 협업 | 인프라 #9 (구현 + commit + push) · 알렉스 박 (#4, 일반 frontend 표준 sync · iOS hit-test §171-C) · 인프라 #11 (`recent_decisions` schema · daemon offline 신호) · 인프라 #10 (Supabase 진입 시 hybrid 분담) · 메이 한 (#5, a11y heuristic 검증) |

> **읽는 법.** §0 4 PR 우선순위 + 합산 effort · §1-§4 각 PR 의 6 구획 (동기 / Change set / 적용 위치 / 시각 토큰 / a11y / 검증) · §5 시각 토큰 사용 표 · §6 시스템 A 다크 theme 100% 준수 원칙 · §7 협업 backlog. #9 가 dispatch 시 §1 부터 §4 순서로 implement 권장.

---

## 0. 4 PR 우선순위 + 합산 effort

| PR | 컴포넌트 | 의장 5초 인지 가치 | Effort | 의존 |
|---|---|---|---|---|
| **PR 1** | **DecisionFeed UI** | 최근 결정들 (시간순) — "오늘 무엇 결정?" 한 호흡에 | 1-2h | 없음 (schema 이미 있음 — `recent_decisions`) |
| **PR 2** | **PriorityLane** | ① ② ③ 우선순위 — "다음 dispatch 어디로?" | 2-3h | 없음 |
| **PR 3** | **DavidOfflineBanner** | 데이빗 dispatch 자동화 vs 수동 — top 상태 신호 | 1-2h | #11 daemon 의 `state_projection_loop` 활성 시점 명시 |
| **PR 4** | **PersonaDetailPanel** | expert node tap → side panel (current task · trigger · standby) | 2-3h | 시스템 A 의 `--side-panel-w 360px` 이미 토큰 정의 (`styles.css:28`) |
| **합** | | | **6-10h, 4 PR** | |

**권장 순서**: PR 1 → 2 → 3 → 4 (independence 큰 순). 단 #9 자율 — 본인 (Rose) 은 spec 만, 구현 페이스는 #9 결정.

---

## 1. PR 1 — DecisionFeed UI

### 동기

`admin/dashboard/app.js` 의 `transformV0` 가 이미 `recent_decisions` schema 를 받음 (`s.recent_decisions || []`) — 단 UI 미구현. 옥대표님 mid-day 결정 시 "최근 5개 결정 무엇" 한 호흡 회상이 가능해야 함 — 현재는 ⌘+K · GitHub Issues 검색 등 외부 도구 의존. Linear / Vercel Activity feed 정통 패턴.

### Change set

**DOM** (시스템 A 의 `bottom-sheet` 또는 `side-panel` slot 에 신규 section 추가):

```html
<!-- index.html — bottom-sheet 안 또는 새 expandable section -->
<section class="decision-feed" id="decisionFeed" aria-label="최근 결정 5건">
  <header class="decision-feed__head">
    <h3 class="decision-feed__title">최근 결정</h3>
    <span class="decision-feed__count" id="decisionCount">5</span>
  </header>
  <ol class="decision-feed__list" id="decisionList" role="list">
    <!-- runtime injected -->
  </ol>
  <a class="decision-feed__more" href="#" id="decisionMore" hidden>전체 보기 →</a>
</section>

<!-- 단일 item 템플릿 (JS injected) -->
<li class="decision-feed__item" data-decision-id="...">
  <time class="decision-feed__time" datetime="2026-06-02T14:30:00+09:00">06-02 14:30</time>
  <span class="decision-feed__icon" aria-hidden="true">✓</span>
  <span class="decision-feed__text">Hybrid 분담 확정 (옥대표님)</span>
  <span class="decision-feed__actor" data-persona="11">#11</span>
</li>
```

**CSS** (`admin/dashboard/styles.css` 끝에 추가, 시스템 A 토큰 100% 재사용):

```css
/* ---------------- Decision Feed ---------------- */
.decision-feed {
  background: var(--bg-elev);
  border-top: 1px solid var(--line);
  padding: 12px 14px;
}
.decision-feed__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.decision-feed__title {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--text-dim); margin: 0;
}
.decision-feed__count {
  font-size: 10px; padding: 1px 6px;
  border-radius: 999px;
  background: var(--bg-elev2); color: var(--text-dim);
}
.decision-feed__list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.decision-feed__item {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: 8px; align-items: baseline;
  font-size: 12px; line-height: 1.4;
  padding: 4px 0;
  border-bottom: 1px solid var(--line);
}
.decision-feed__item:last-child { border-bottom: 0; }
.decision-feed__time {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 10px; color: var(--text-faint);
  white-space: nowrap;
}
.decision-feed__icon { color: var(--c-green); font-size: 11px; }
.decision-feed__text { color: var(--text); }
.decision-feed__actor {
  font-size: 10px; color: var(--text-dim);
  background: var(--bg-elev2);
  padding: 1px 5px; border-radius: 4px;
}
.decision-feed__more {
  display: block; margin-top: 6px;
  font-size: 11px; color: var(--accent-2);
  text-align: right; text-decoration: none;
}
.decision-feed__more:hover { color: var(--accent); }
```

**JS** (`admin/dashboard/app.js` 의 `transformV0` 또는 render 사이클에 신규 함수 + 호출):

```js
// Decision feed rendering (Phase 1 — recent 5)
function renderDecisions(decisions) {
  const list = document.getElementById('decisionList');
  const count = document.getElementById('decisionCount');
  if (!list) return;

  if (!decisions || decisions.length === 0) {
    list.innerHTML = '<li class="decision-feed__empty">결정 기록 없음</li>';
    count.textContent = '0';
    return;
  }

  // recent 5 (시간 역순)
  const recent = decisions
    .slice()
    .sort((a, b) => new Date(b.decided_at) - new Date(a.decided_at))
    .slice(0, 5);

  list.innerHTML = recent.map(d => `
    <li class="decision-feed__item" data-decision-id="${escapeHtml(d.id)}">
      <time class="decision-feed__time" datetime="${escapeHtml(d.decided_at)}">${formatTime(d.decided_at)}</time>
      <span class="decision-feed__icon" aria-hidden="true">✓</span>
      <span class="decision-feed__text">${escapeHtml(d.text)}</span>
      <span class="decision-feed__actor" data-persona="${escapeHtml(d.actor_slug)}">${escapeHtml(d.actor_label)}</span>
    </li>
  `).join('');

  count.textContent = String(decisions.length);
  document.getElementById('decisionMore').hidden = decisions.length <= 5;
}

// 호출 위치 — main render 사이클 끝에
renderDecisions(data.recentDecisions);
```

### 적용 위치

- `admin/dashboard/index.html` — bottom-sheet 의 적절한 위치 (승인 큐 아래 또는 별도 expanded section)
- `admin/dashboard/styles.css` — 끝에 약 50줄 추가
- `admin/dashboard/app.js` — `renderDecisions()` 함수 추가 + main render 사이클 호출

### 시각 토큰

| 사용처 | 토큰 |
|---|---|
| section bg | `var(--bg-elev)` |
| section border | `var(--line)` |
| title | `var(--text-dim)` `uppercase` |
| time | `var(--text-faint)` mono |
| icon ✓ | `var(--c-green)` |
| text | `var(--text)` |
| actor chip bg | `var(--bg-elev2)` |
| more link | `var(--accent-2)` hover `var(--accent)` |

### a11y

- `aria-label="최근 결정 5건"` on section
- `<ol role="list">` (chronological order)
- `<time datetime="ISO">` machine-readable
- 아이콘 `aria-hidden="true"` (시각 장식)
- 빈 상태 — `<li class="decision-feed__empty">결정 기록 없음</li>`

### 검증

1. **Schema validation** — `data.recentDecisions` 가 `[{ id, decided_at, text, actor_slug, actor_label }]` 형식 확인. #11 가 daemon 측에서 정상 schema 작성.
2. **시각 회귀** — 모바일 380px + desktop 1440px 양쪽에서 5 entry 가 깔끔히 stack.
3. **a11y axe-playwright** — section landmark · datetime · role 검증.
4. **빈 상태** — `recentDecisions: []` 시 "결정 기록 없음" 표시.

---

## 2. PR 2 — PriorityLane

### 동기

옥대표님 "다음 dispatch 어디로?" mid-day 결정 시 ① ② ③ 우선순위 한 호흡 인지 필요. 현재 시스템 A 의 cytoscape graph 는 distribution (work 분포) 표현 강하나 priority order 약함 — task 의 색은 state (진행/차단/대기/완료/승인대기), 우선순위는 위치 인코딩 X.

### Change set

**DOM** (top-bar 아래, canvas 위 또는 bottom-sheet 의 first section):

```html
<!-- 옥대표님 priority 3 — graph 상단 sticky 또는 separate lane -->
<aside class="priority-lane" id="priorityLane" aria-label="옥대표님 우선순위 ① ② ③">
  <h3 class="priority-lane__title">우선순위</h3>
  <ol class="priority-lane__list" id="priorityList">
    <!-- runtime injected -->
  </ol>
</aside>

<!-- 단일 item 템플릿 -->
<li class="priority-lane__item" data-task-id="..." data-state="in_progress">
  <span class="priority-lane__rank">①</span>
  <span class="priority-lane__title-text">Brand color sweep</span>
  <span class="priority-lane__assignee" data-persona="rose">R</span>
  <span class="priority-lane__state state-yellow" aria-label="진행"></span>
</li>
```

**CSS** (시스템 A 토큰):

```css
/* ---------------- Priority Lane ---------------- */
.priority-lane {
  position: relative; /* canvas 위 sticky 가능 */
  padding: 8px 12px;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--line);
  z-index: 5;
}
.priority-lane__title {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--text-dim); margin: 0 0 6px;
}
.priority-lane__list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.priority-lane__item {
  display: grid;
  grid-template-columns: 24px 1fr 22px 8px;
  gap: 8px; align-items: center;
  font-size: 13px;
  padding: 4px 0;
}
.priority-lane__rank {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 14px; color: var(--accent-2);
  font-weight: 700;
}
.priority-lane__title-text {
  color: var(--text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.priority-lane__assignee {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--bg-elev2);
  color: var(--text);
  font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}
.priority-lane__state {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block;
}
.priority-lane__state.state-yellow { background: var(--c-yellow); }
.priority-lane__state.state-green  { background: var(--c-green); }
.priority-lane__state.state-red    { background: var(--c-red); }
.priority-lane__state.state-gray   { background: var(--c-gray); }
.priority-lane__state.state-blue   { background: var(--c-blue); }

/* desktop 에서 canvas 우측 사이드로 옮길 수 있음 */
@media (min-width: 960px) {
  .priority-lane {
    position: absolute;
    top: 10px; right: 10px;
    width: 280px;
    border-radius: 12px;
    border: 1px solid var(--line);
    backdrop-filter: blur(14px);
  }
}
```

**JS**:

```js
// Priority lane rendering
function renderPriority(tasks) {
  const list = document.getElementById('priorityList');
  if (!list) return;

  // 옥대표님 priority order — tasks 에 priority field 있으면 그것, 없으면 in_progress + 차단 우선
  const ordered = tasks
    .filter(t => t.priority !== null && t.priority !== undefined)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3); // top 3 만

  if (ordered.length === 0) {
    list.innerHTML = '<li class="priority-lane__empty">우선순위 미설정</li>';
    return;
  }

  const ranks = ['①', '②', '③'];
  const stateColor = {
    'in_progress': 'yellow', 'done': 'green', 'blocked': 'red',
    'pending': 'gray', 'awaiting_approval': 'blue'
  };

  list.innerHTML = ordered.map((t, i) => `
    <li class="priority-lane__item" data-task-id="${escapeHtml(t.id)}" data-state="${escapeHtml(t.state)}">
      <span class="priority-lane__rank">${ranks[i]}</span>
      <span class="priority-lane__title-text">${escapeHtml(t.labelFull || t.label)}</span>
      <span class="priority-lane__assignee" data-persona="${escapeHtml(t.expertId)}">${escapeHtml(t.expertMono || '?')}</span>
      <span class="priority-lane__state state-${stateColor[t.state] || 'gray'}" aria-label="${stateLabel(t.state)}"></span>
    </li>
  `).join('');
}

renderPriority(data.tasks);
```

### 적용 위치

- `admin/dashboard/index.html` — `canvas-wrap` 안 또는 layout 의 신규 section
- `admin/dashboard/styles.css` — 끝에 약 55줄
- `admin/dashboard/app.js` — `renderPriority()` + main 호출

### 시각 토큰

| 사용처 | 토큰 |
|---|---|
| section bg | `var(--bg-elev)` (mobile) → `rgba(18, 24, 41, 0.85) + blur` (desktop float) |
| rank ①②③ | `var(--accent-2)` mono |
| title text | `var(--text)` |
| assignee chip | `var(--bg-elev2)` + `var(--text)` |
| state dot | 5 state 색 (`--c-yellow/green/red/gray/blue`) |

### a11y

- `<aside aria-label="옥대표님 우선순위">` landmark
- `<ol role="list">` ordered
- 각 state dot `aria-label="진행"` `aria-label="완료"` 등 (시각 외 screen reader)
- focus visible on item (`outline: 2px solid var(--accent)`)

### 검증

1. Task data 의 `priority` field 가 #10 또는 #11 측에서 정상 설정 (없으면 우선순위 X — empty state 표시).
2. 모바일 380px — 한 줄 ellipsis 정확.
3. Desktop 960px+ — 우측 float 14px backdrop blur 가 graph 가독성 침범 X.

---

## 3. PR 3 — DavidOfflineBanner

### 동기

데이빗 (Orchestrator persona) 의 dispatch 기능 마비 → 옥대표님이 GH Issues 수동 dispatch 로 임시 대체. 이 임시 모드가 영구화될 가능성을 시각이 first-class 로 인정. Banner 가 없으면 "지금 daemon 이 자동 돌아가는지 / 수동 모드인지" 인지 어려움 — system status visibility (Nielsen #1) 위반.

### Change set

**DOM** (top-bar 와 layout 사이, 조건부 렌더):

```html
<!-- topbar 아래, layout 위 — 조건부 (offline 시만 노출) -->
<div class="david-banner" id="davidBanner" role="status" aria-live="polite" hidden>
  <span class="david-banner__icon">⏳</span>
  <span class="david-banner__text">
    David offline · manual dispatch active
  </span>
  <span class="david-banner__eta">
    복구 ETA: <span data-eta>—</span>
  </span>
  <button class="david-banner__close" type="button" aria-label="배너 일시 숨김" id="davidBannerClose">×</button>
</div>
```

**CSS**:

```css
/* ---------------- David Offline Banner ---------------- */
.david-banner {
  position: fixed;
  top: calc(var(--topbar-h) + var(--safe-top));
  left: 0; right: 0;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: var(--bg-elev2);
  border-bottom: 2px solid var(--c-yellow);
  color: var(--text-dim);
  font-size: 12px;
  z-index: 40;
}
.david-banner__icon { font-size: 14px; }
.david-banner__text { color: var(--text); font-weight: 500; }
.david-banner__eta {
  margin-left: auto;
  color: var(--text-faint);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
}
.david-banner__close {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--text-dim);
  border-radius: 6px;
  font-size: 18px; line-height: 1;
}
.david-banner__close:hover { background: var(--bg-elev); color: var(--text); }

/* layout offset — banner 가 보일 때 main content 가 가려지지 않게 */
.david-banner:not([hidden]) ~ .layout {
  top: calc(var(--topbar-h) + var(--safe-top) + 36px);
}

/* prefers-reduced-motion 호환 — pulse animation 없음 (의도) */
```

**JS**:

```js
// David offline status — #11 daemon 의 status JSON 읽어서 결정
function updateDavidBanner(daemonStatus) {
  const banner = document.getElementById('davidBanner');
  if (!banner) return;

  // daemonStatus = { directive_loop_active: bool, eta_iso: string|null }
  // directive_loop_active === false → offline mode
  const isOffline = daemonStatus && !daemonStatus.directive_loop_active;

  banner.hidden = !isOffline;
  if (isOffline) {
    const etaEl = banner.querySelector('[data-eta]');
    etaEl.textContent = daemonStatus.eta_iso ? formatEta(daemonStatus.eta_iso) : '?';
  }
}

// 호출 — main render
updateDavidBanner(data.daemonStatus);

// 사용자 dismiss — sessionStorage 로 그 세션만 숨김 (다음 page reload 시 재노출)
document.getElementById('davidBannerClose')?.addEventListener('click', () => {
  document.getElementById('davidBanner').hidden = true;
  try { sessionStorage.setItem('davidBannerDismissed', '1'); } catch(e){}
});
```

### 적용 위치

- `admin/dashboard/index.html` — topbar 아래에 conditional div
- `admin/dashboard/styles.css` — 끝에 약 35줄
- `admin/dashboard/app.js` — `updateDavidBanner()` + close 이벤트 + main 호출

### 시각 토큰

| 사용처 | 토큰 |
|---|---|
| banner bg | `var(--bg-elev2)` |
| underline | `var(--c-yellow)` (2px) — status 신호 |
| icon | default text (currentColor) |
| eta | `var(--text-faint)` mono |
| close button | `var(--text-dim)` hover `var(--text)` |

### a11y

- `role="status" aria-live="polite"` — screen reader 가 변경 통지
- `<button aria-label="배너 일시 숨김">` close 버튼 명확
- `prefers-reduced-motion` — banner 가 animation 없음 (즉시 노출/숨김), 자동 통과

### 검증

1. **`daemonStatus.directive_loop_active === true`** → banner hidden.
2. **`directive_loop_active === false`** → banner visible + eta 표시.
3. **`eta_iso` null** → eta `?` 표시.
4. **사용자 close** → sessionStorage 로 그 세션만 숨김, 새로고침 시 재노출.
5. **layout offset** — banner 가 보일 때 layout `top` 36px 추가됐는지 확인.

---

## 4. PR 4 — PersonaDetailPanel

### 동기

시스템 A 의 `--side-panel-w 360px` 토큰 이미 정의됨 (`styles.css:28`) — UI slot 준비 완료. expert node tap 시 해당 페르소나의 (a) current task · (b) trigger keyword · (c) standby items · (d) recent commits · (e) trigger ping CTA 의 side panel 가 desktop 우측 또는 모바일 bottom-sheet 로 expand. 옥대표님 mid-day 결정 시 "왕 정 지금 뭐 하나" 한 호흡 인지.

### Change set

**DOM** (layout 의 우측 또는 bottom-sheet 안):

```html
<!-- 우측 side-panel (desktop) / bottom-sheet (mobile) -->
<aside class="persona-panel" id="personaPanel" aria-label="페르소나 상세" hidden>
  <header class="persona-panel__head">
    <span class="persona-panel__avatar" data-persona="">
      <span class="persona-panel__mono"></span>
    </span>
    <div class="persona-panel__brand">
      <h3 class="persona-panel__name"></h3>
      <p class="persona-panel__role"></p>
    </div>
    <button class="persona-panel__close" type="button" aria-label="패널 닫기">×</button>
  </header>

  <section class="persona-panel__current">
    <h4 class="persona-panel__section-title">현재 task</h4>
    <p class="persona-panel__current-text">—</p>
  </section>

  <section class="persona-panel__triggers">
    <h4 class="persona-panel__section-title">Trigger keyword</h4>
    <ul class="persona-panel__trigger-list">
      <!-- chips: @로즈 윤 · @visual · @design ... -->
    </ul>
  </section>

  <section class="persona-panel__standby">
    <h4 class="persona-panel__section-title">Standby (즉시 dispatch 가능)</h4>
    <ol class="persona-panel__standby-list">
      <!-- items -->
    </ol>
  </section>

  <section class="persona-panel__recent">
    <h4 class="persona-panel__section-title">최근 commit</h4>
    <ol class="persona-panel__commit-list">
      <!-- chips -->
    </ol>
  </section>

  <footer class="persona-panel__cta">
    <button class="persona-panel__ping" type="button">@{persona} ping</button>
  </footer>
</aside>
```

**CSS** (시스템 A 의 `--side-panel-w 360px` 활용 + 모바일 bottom-sheet variant):

```css
/* ---------------- Persona Detail Panel ---------------- */
.persona-panel {
  position: fixed;
  z-index: 60;
  background: var(--bg-elev);
  color: var(--text);
  border-left: 1px solid var(--line);
  display: flex; flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
  transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Desktop — 우측 slide-in */
@media (min-width: 960px) {
  .persona-panel {
    top: calc(var(--topbar-h) + var(--safe-top));
    right: 0; bottom: 0;
    width: var(--side-panel-w);
    transform: translateX(100%);
  }
  .persona-panel:not([hidden]) { transform: translateX(0); }
}

/* Mobile — 하단 bottom-sheet */
@media (max-width: 959px) {
  .persona-panel {
    left: 0; right: 0; bottom: 0;
    max-height: 75vh;
    border-left: 0;
    border-top: 1px solid var(--line);
    border-radius: 14px 14px 0 0;
    transform: translateY(100%);
  }
  .persona-panel:not([hidden]) { transform: translateY(0); }
}

.persona-panel__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px; align-items: center;
  padding: 14px;
  border-bottom: 1px solid var(--line);
  background: var(--bg-elev2);
}
.persona-panel__avatar {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: white;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-weight: 800; font-size: 18px;
}
/* persona 별 gradient (PersonaAvatar 매핑 — visual_designer_dashboard_spec §2-5) */
.persona-panel__avatar[data-persona="rose"]  { background: linear-gradient(135deg, #0A2540, #1F8FFF); }
.persona-panel__avatar[data-persona="sam"]   { background: linear-gradient(135deg, #1F8FFF, #1FB6B6); }
.persona-panel__avatar[data-persona="timo"]  { background: linear-gradient(135deg, #1FB6B6, #1FA055); }
.persona-panel__avatar[data-persona="alex"]  { background: linear-gradient(135deg, #5C6F7E, #2A3B4C); }
.persona-panel__avatar[data-persona="may"]   { background: linear-gradient(135deg, #7A5FA8, #5C6F7E); }
.persona-panel__avatar[data-persona="ken"]   { background: linear-gradient(135deg, #FFB800, #EF7D00); color: #0A2540; }
.persona-panel__avatar[data-persona="hiro"]  { background: linear-gradient(135deg, #C58A2E, #6B7A8D); }
.persona-panel__avatar[data-persona="wang"]  { background: linear-gradient(135deg, #1670CC, #0A2540); }
.persona-panel__avatar[data-persona="david"] { background: linear-gradient(135deg, #C7CFD8, #5C6F7E); opacity: 0.4; }

.persona-panel__brand { min-width: 0; }
.persona-panel__name {
  margin: 0; font-size: 16px; font-weight: 700;
  color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.persona-panel__role {
  margin: 2px 0 0; font-size: 11px;
  color: var(--text-dim);
}
.persona-panel__close {
  width: 32px; height: 32px;
  border-radius: 8px;
  color: var(--text-dim);
  font-size: 20px; line-height: 1;
}
.persona-panel__close:hover { background: var(--bg-elev); color: var(--text); }

.persona-panel__section-title {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--text-dim);
  margin: 14px 14px 6px;
}
.persona-panel__current-text {
  margin: 0 14px 8px;
  font-size: 14px; color: var(--text);
  line-height: 1.5;
}
.persona-panel__trigger-list,
.persona-panel__standby-list,
.persona-panel__commit-list {
  list-style: none; padding: 0 14px; margin: 0;
  display: flex; flex-wrap: wrap; gap: 4px;
}
.persona-panel__trigger-list li,
.persona-panel__commit-list li {
  font-size: 11px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  padding: 3px 7px;
  background: var(--bg-elev2);
  color: var(--text-dim);
  border-radius: 6px;
}
.persona-panel__standby-list {
  flex-direction: column;
  gap: 4px;
}
.persona-panel__standby-list li {
  font-size: 13px; color: var(--text);
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.persona-panel__cta {
  margin-top: auto;
  padding: 14px;
  border-top: 1px solid var(--line);
}
.persona-panel__ping {
  width: 100%;
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 13px;
  transition: background 0.15s ease;
}
.persona-panel__ping:hover { background: var(--accent-2); }
```

**JS**:

```js
// Persona detail panel — expert node tap → expand
function showPersonaPanel(personaSlug, persona, recentDecisions, commits) {
  const panel = document.getElementById('personaPanel');
  if (!panel) return;

  panel.querySelector('.persona-panel__avatar').dataset.persona = personaSlug;
  panel.querySelector('.persona-panel__mono').textContent = persona.mono || personaSlug.charAt(0).toUpperCase();
  panel.querySelector('.persona-panel__name').textContent = persona.name;
  panel.querySelector('.persona-panel__role').textContent = persona.role;

  panel.querySelector('.persona-panel__current-text').textContent =
    persona.currentTask?.title || '대기 중';

  panel.querySelector('.persona-panel__trigger-list').innerHTML =
    (persona.triggers || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');

  panel.querySelector('.persona-panel__standby-list').innerHTML =
    (persona.standby || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

  panel.querySelector('.persona-panel__commit-list').innerHTML =
    (commits || []).slice(0, 5).map(c =>
      `<li><a href="https://github.com/D990905/dmj-site/commit/${escapeHtml(c.sha)}" target="_blank" rel="noopener">${escapeHtml(c.sha.substring(0,7))}</a></li>`
    ).join('');

  panel.querySelector('.persona-panel__ping').textContent = `@${persona.name} ping`;
  panel.hidden = false;
}

// expert node tap 이벤트
cy.on('tap', 'node[kind = "expert"]', (evt) => {
  const node = evt.target;
  const personaSlug = node.id();
  const persona = data.experts.find(e => e.id === personaSlug);
  showPersonaPanel(personaSlug, persona, data.recentDecisions, persona.commits);
});

// close
document.getElementById('personaPanel')?.querySelector('.persona-panel__close')
  ?.addEventListener('click', () => {
    document.getElementById('personaPanel').hidden = true;
  });

// Escape key 또는 backdrop tap close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const panel = document.getElementById('personaPanel');
    if (!panel.hidden) panel.hidden = true;
  }
});
```

### 적용 위치

- `admin/dashboard/index.html` — body 끝에 `<aside class="persona-panel">` (slide-in / bottom-sheet)
- `admin/dashboard/styles.css` — 끝에 약 130줄
- `admin/dashboard/app.js` — `showPersonaPanel()` + cytoscape `tap` 이벤트 + close 이벤트

### 시각 토큰

| 사용처 | 토큰 |
|---|---|
| panel bg | `var(--bg-elev)` |
| header bg | `var(--bg-elev2)` |
| border | `var(--line)` |
| avatar gradient | persona-별 (8 + david), 시스템 A 의 cockpit dark 와 색 분리 명확 |
| section title | `var(--text-dim)` uppercase |
| commit chip / trigger chip | `var(--bg-elev2)` mono |
| ping CTA | `var(--accent)` (Frontend 표준 button color) |

### a11y

- `<aside aria-label="페르소나 상세">` landmark
- 모달 패턴 — focus trap (open 시 첫 focusable 로 focus, close 시 trigger node 로 restore)
- Esc 키 닫힘
- backdrop tap close (모바일)
- 각 section 명확한 `<h4>` hierarchy

### 검증

1. **expert node tap** → panel slide-in (desktop 우측 / 모바일 하단).
2. **persona 별 avatar gradient** 정확 적용 (data-persona attribute).
3. **standby items** 가 비어있으면 "대기 중" placeholder.
4. **Esc + close button + backdrop tap** 모두 닫기 동작.
5. **모바일 380px** — bottom-sheet max-height 75vh, 본문 스크롤.

---

## 5. 시각 토큰 사용 표 (4 PR 통합)

| Layer | 토큰 (시스템 A) | 사용 |
|---|---|---|
| Background base | `--bg #0a0e1a` | 미사용 (모든 컴포넌트 elevated) |
| Background elevated 1 | `--bg-elev #121829` | DecisionFeed · PriorityLane (mobile) · PersonaPanel body |
| Background elevated 2 | `--bg-elev2 #1a2238` | Banner · PriorityLane chip · PersonaPanel header · 모든 chip |
| Border | `--line #243046` | 모든 section border |
| Text primary | `--text #e8ecf4` | 모든 body |
| Text dim | `--text-dim #9aa3b8` | section titles · meta |
| Text faint | `--text-faint #5e6781` | timestamp · eta |
| Accent | `--accent #3b82f6` | ping CTA · priority rank · focus ring |
| Accent 2 | `--accent-2 #60a5fa` | "전체 보기 →" link · hover |
| State green | `--c-green #22c55e` | 완료 |
| State yellow | `--c-yellow #facc15` | 진행 · banner underline |
| State red | `--c-red #ef4444` | 차단 |
| State gray | `--c-gray #6b7280` | 대기 |
| State blue | `--c-blue #38bdf8` | 승인대기 |

**100% 시스템 A 토큰 재사용 — 신규 토큰 0 건.**

---

## 6. 시스템 A 다크 cockpit theme 100% 준수 원칙

본 4 PR 의 핵심 원칙:

1. **신규 토큰 도입 X** — 시스템 A 의 `--bg`/`--bg-elev`/`--bg-elev2`/`--line`/`--text*`/`--accent*`/`--c-*` 만 사용
2. **메인 사이트 design system 토큰 (`--color-navy`/`--color-sea` 등) 미사용** — 두 system 토큰 격리 유지
3. **persona avatar gradient 만 예외** — Visual brand color spec §3-1 (Levitaz/PPC/Takoon/WIP gradient + 8 persona 매핑) 의 hex 값 직접 인라인. 시스템 A 토큰에는 brand color 없음 → 인라인이 정답
4. **Pretendard 미사용 — 시스템 A 의 `-apple-system, "SF Pro Text", "Pretendard"` stack 유지** (Pretendard 가 fallback)
5. **`prefers-reduced-motion` 호환** — 모든 transition 0.24s ease, banner 는 animation 없음

---

## 7. 협업 backlog

### 7-1. 인프라 #9 — 구현 (4 PR)

- 본 spec read → PR 1 → PR 2 → PR 3 → PR 4 순서 권장 (effort 작은 순)
- 각 PR commit message 형식 (#11 STATUS prefix 적용): `feat(dashboard): DecisionFeed UI (PR 1/4)`
- `auto_push.command` whitelist 에 `admin/dashboard/*` 등록 후 자동 push
- 시각 회귀 검증 (모바일 380 + desktop 1440)

### 7-2. Visual Designer (Rose, 본인) — spec + 검증

- 본 spec 작성 완료 (본 문서)
- #9 구현 PR 도착 시 시각 검증 (5 시각 토큰 정확 적용 · a11y · 모바일 layout) — PR 당 30-60m
- persona avatar gradient 정확성 확인 (brand color spec §3-1 매핑 일치)
- 시각 회귀 발견 시 messages.md ping

### 7-3. 알렉스 박 (#4 Frontend) — 일반 frontend 표준 sync

- iOS hit-test §171-C 패턴 — PersonaPanel 의 close button SVG · banner close SVG 에 `pointer-events: none` 적용 검증
- focus visible — PR 의 모든 button/link 가 키보드 focus 시 `outline 2px solid var(--accent)` 표시
- `prefers-reduced-motion` — banner · panel slide-in 0.24s 가 0.01ms 로 단축

### 7-4. 인프라 #11 — data schema

- `recent_decisions` schema 정합 — `[{ id, decided_at (ISO), text, actor_slug, actor_label }]`
- `daemonStatus` schema — `{ directive_loop_active: bool, eta_iso: string|null }`
- `task.priority` field — `null | int` (priority 미설정 가능)
- `expert.standby` field — `string[]` (이 페르소나의 즉시 dispatch 가능 항목)
- `expert.commits` field — `[{ sha, message, ts }]` (recent 5)

### 7-5. 메이 한 (#5 UX) — a11y heuristic 검증

- Nielsen #1 (system status visibility) — David banner · PriorityLane · DecisionFeed 가 통과
- Nielsen #7 (flexibility) — PersonaPanel 의 dismiss 패턴 (close/Esc/backdrop) 3 가지 통과
- WCAG 2.2 #2.4.11 (focus not obscured) — panel 열림 시 background focus 가 panel 에 가려지지 않음
- 키보드 navigation order 검증 (panel 안에서 Tab 순환)

### 7-6. 인프라 #10 (Phase 2) — Supabase schema sync

- `decisions` table + RLS — actor / time / text 컬럼
- `tasks.priority` column 추가
- Realtime channel `decisions:INSERT` 으로 DecisionFeed 자동 갱신 (Phase 2)

---

## 8. 부록 — 출처

**프로젝트 내부**
- `_experts/visual_designer_dashboard_spec.md` (DEPRECATED 2026-06-02, 본 spec 의 4 unique 컴포넌트 source)
- `_experts/expert_orchestrator_daemon_reference.md` §6-2 daemon ↔ dashboard protocol
- `_experts/visual_designer_brand_color_spec.md` §2-1 brand gradient (PersonaAvatar 매핑 source)
- `admin/dashboard/app.js` — `transformV0`, `renderTaskPanel`, `renderExpertPanel`, `layoutRadial`
- `admin/dashboard/styles.css` — 토큰 + 컴포넌트
- `admin/dashboard/index.html` — DOM 구조
- `_team/sync/messages.md` — `#9` 의 11:49 모바일 노드 정리 commit + `#11` 의 13:53 통합 답

**외부 reference**
- [Cytoscape.js docs](https://js.cytoscape.org/) — radial layout · style · tap event
- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/) — focus appearance · system status
- [Linear / Vercel Activity feed pattern](https://linear.app)

---

_Last updated: 2026-06-02 12:35 KST_
_γ 채택 후속 — 시스템 B 의 4 unique 컴포넌트만 시스템 A PR contribute. 6-10h 합산 effort. #9 자율 implement._
