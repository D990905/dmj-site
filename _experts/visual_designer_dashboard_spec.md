# visual_designer_dashboard_spec.md — 인프라 #9 Orchestrator Dashboard 시각 spec

> **⚠ DEPRECATED · 2026-06-02 12:30 KST** — 본 spec 의 standalone Astro dashboard 설계는 옥대표님 결정 **γ** 채택으로 폐기되었습니다. 작성 시점 (5-31) 본인이 시스템 A `admin/dashboard/` 의 존재를 인지하지 못한 채 새 dashboard 를 설계한 부주의가 원인입니다.
>
> **유효 산출물** — 본 spec 의 4 unique 컴포넌트만 `admin/dashboard/` (시스템 A) 에 PR contribute 형식으로 살아남습니다:
> 1. **DecisionFeed UI** (시스템 A 의 `recent_decisions` schema UI 구현)
> 2. **PriorityLane** (대표님 ①②③ 우선순위 표시)
> 3. **DavidOfflineBanner** (#11 daemon 상태 시각 신호)
> 4. **PersonaDetailPanel** (expert node tap → side panel)
>
> **PR spec 위치**: `_experts/visual_designer_pr_dashboard_contributions.md` (본 문서 작성 직후 생성). #9 가 본 PR spec read 후 자율 implement.
>
> **본 spec 482 줄 본문**: reference 용 보존. §3 토큰 매핑 · §5 Astro mapping · §6 협업 backlog 항목은 PR contribute 시점 그대로 적용 가능. 본 문서 신규 entry append 또는 §7 Part 2 작성은 더 이상 진행 X.
>
> **사유 detailed**: 시스템 A 가 본 spec 의 시스템 B 80% 를 이미 cover (cytoscape graph · 5 state · cost meter · approval queue · persona schema · recent_decisions schema). β 분리 권장은 잘못된 가정 (A 미인지). 솔직 권장 정정 → γ 채택 (대표님 2026-06-02 12:24 KST).

---

| 항목 | 내용 |
|---|---|
| 문서 유형 | ~~Phase 1 wireframe + 컴포넌트 spec + 디자인 토큰 매핑 + 데이빗 부재 모드 시각 + Part 2 placeholder~~ → **DEPRECATED (2026-06-02 γ 채택)**, 4 컴포넌트만 PR contribute |
| 작성 | Visual Designer (Rose Yoon) · 2026-06-01 |
| 대상 | 인프라 #9 Orchestrator Dashboard — 의장이 한눈에 보는 통합 화면 |
| 모(母) 문서 | `_experts/expert_orchestrator_daemon_reference.md` §6-2 + `_experts/visual_designer_component_catalog.md` + `_experts/visual_designer_brand_color_spec.md` |
| 범위 | Part 1 — viewport wireframe + 컴포넌트 + 토큰 매핑 + 데이빗 부재 모드 (data source 결정 무관). Part 2 (data wiring) 는 의장 hybrid 분담 결정 답 도착 후 같은 파일에 append |
| 협업 | Alex Park (#4 Frontend, Astro 구현 + Supabase client) · Backend (#10, schema · CORS · sanitize) · Wang Jung (#8 Mobile, 모바일 viewport 패리티) · David Ok (#orchestrator, 복구 시 dispatch 통합) |
| 제약 | 라이트 본체 (메인 사이트 정책 일관) · 모바일-first (#8 §6-3 의 mobile native 부재) · 디자인 토큰 100% 재사용 (visual_designer_reference §3) · Korean policy (`word-break: keep-all` + `text-wrap: balance/pretty`) 준수 |

> **읽는 법.** §0 TL;DR + 8 contract paraphrase · §1 viewport wireframe 2종 (mobile 380px / desktop 1440px) text 도식 · §2 컴포넌트 spec 8종 · §3 토큰 매핑 · §4 데이빗 부재 모드 · §5 Astro mapping · §6 협업 backlog · §7 Part 2 placeholder. Frontend (Alex) 가 dispatch 시 §2 + §3 만으로 구현 시작 가능.

---

## 0. 핵심 결론 (TL;DR)

**Dashboard 의 본질은 "의장 1인 viewer + 8 persona presence + dispatch 진행 + 의사결정 기록"**. 4 영역이 한 화면 (desktop) 또는 4 fold (mobile) 에 들어가야 함. 인프라 #11 spec 의 5 contract + 추가 3 contract (persona 매핑 · state 시각 · 데이빗 부재 모드) 가 frame.

**핵심 결정 (Visual 단독, 반복 회피)**:

1. **Dashboard 자체가 또 다른 마케팅 페이지 아님** — 의장 1인 internal tool. 라이트 본체 유지하지만 brand-marketing 의 hero/photographic backdrop 등 외부용 시각 요소는 제거. Linear / Vercel Analytics 식 **sparse + dense interaction**.
2. **컴포넌트 100% 기존 design system 재사용** — `--color-*` · `--fs-*` · `--space-*` · `--shadow-*` · `--ease-*` 토큰만. 신규 토큰은 persona color 8 (chart category 6 + 확장 2) 만 추가.
3. **모바일 380px 가 first-class** — #8 spec 의 "native 화면 없음, dashboard 가 모바일 웹에서도 보이면 됨" — 데스크탑 1440px 의 4-column 이 mobile 380px 에서 4-fold (수직 stack) 로 자연 reflow.
4. **데이빗 부재 모드 = first-class state** — 임시 모드가 영구화될 가능성을 시각이 인정. Banner + 데이빗 자리 placeholder + manual dispatch queue 분리.
5. **State enum 시각 = chart-theme.js status 5 앵커 재사용** — pending(slate) · in_progress(sea pulse) · done(veryGood) · error(veryBad) · stale(mid). DataViz 와 시각 일관.

**Phase 1 산출 (이 spec)**: wireframe + 컴포넌트 + 토큰. Phase 1 구현 (Alex 의 Astro 작업) 의 baseline.

---

## 1. Viewport wireframe — mobile 380px + desktop 1440px

### 1-1. Desktop 1440px (의장의 평소 viewport)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ⏳ David offline · manual dispatch active                          [복구 ETA: ?]│  ← DavidOfflineBanner (조건부)
├────────────────────────────────────────────────────────────────────────────────┤
│ DMJ Orchestrator · 06-01 14:32                  Mode: deploy-only │ Cost: $0/50│  ← DashboardHeader
├──────────────────────────────────────┬─────────────────────────────────────────┤
│                                      │                                         │
│  ┌── PRIORITY ────────────────────┐  │  ┌── PERSONAS ────────────────────┐    │
│  │ ① Brand color sweep            │  │  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │    │
│  │   → Rose · 2h · in_progress    │  │  │ │R │ │S │ │T │ │A │           │    │
│  │ ② Trust-bar 일관화              │  │  │ └──┘ └──┘ └──┘ └──┘           │    │
│  │   → Alex · pending             │  │  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │    │
│  │ ③ Q5 skip 정정                  │  │  │ │M │ │K │ │H │ │W │           │    │
│  │   → Alex · blocked by #2       │  │  │ └──┘ └──┘ └──┘ └──┘           │    │
│  └────────────────────────────────┘  │  │ ┌──┐                           │    │
│                                      │  │ │D ⏳│  ← David placeholder    │    │
│  ┌── PENDING ──────────────────────┐ │  │ └──┘                           │    │
│  │ ④ Calculator graph 통일          │ │  └────────────────────────────────┘    │
│  │ ⑤ Profile tab 분리               │ │                                         │
│  └────────────────────────────────┘  │  ┌── DECISIONS (recent 5) ────────┐    │
│                                      │  │ 06-01 14:30 ✓ Hybrid 분담 확정 │    │
│  ┌── MANUAL DISPATCH QUEUE ────────┐ │  │ 05-31 16:51 ✓ Kickoff 공지     │    │
│  │ (David 부재 동안 GH Issue 직진)  │ │  │ 05-31 11:32 ✓ resolve_yml push│    │
│  │ • #142 ←의장 06-01 13:45        │ │  │ 05-27 13:18 ✓ Mobile reference │    │
│  │ • #141 ←의장 06-01 12:10        │ │  │ 05-27 13:09 ✓ Frontend reference│   │
│  └────────────────────────────────┘  │  └────────────────────────────────┘    │
│                                      │                                         │
└──────────────────────────────────────┴─────────────────────────────────────────┘
│ Recent commits (12) · Recent files (8) · Blockers (1)                           │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Grid**: 2-column (left 60% Kanban + Manual Queue · right 40% Personas + Decisions). 1440 - 64 (양쪽 padding) = 1376 / 2 ≈ 824 + 552 (60/40 split).

**Header**: sticky top, `--shadow-sm`, 60px height. Mode 표시 (deploy-only / full) + Cost meter ($N / 50).

**Banner** (조건부): 데이빗 offline 시 top 노출, slate bg + sun underline, dismissable 아님 (상태 신호).

### 1-2. Mobile 380px (의장의 외부 viewport)

```
┌────────────────────────────────┐
│ ⏳ David offline · manual      │  ← Banner (more compact)
├────────────────────────────────┤
│ DMJ Orch · 14:32 ⓘ              │  ← Header (Mode/Cost는 ⓘ 탭)
├────────────────────────────────┤
│                                │
│  ┌── PRIORITY ──────────────┐  │  Fold 1
│  │ ① Brand color sweep      │  │
│  │   Rose · 2h · ●in_prog   │  │
│  │ ② Trust-bar 일관화        │  │
│  │ ③ Q5 skip                 │  │
│  └──────────────────────────┘  │
│                                │
│  ┌── PERSONAS (3×3) ────────┐  │  Fold 2
│  │ ┌─┐ ┌─┐ ┌─┐               │  │
│  │ │R│ │S│ │T│               │  │
│  │ ┌─┐ ┌─┐ ┌─┐               │  │
│  │ │A│ │M│ │K│               │  │
│  │ ┌─┐ ┌─┐ ┌─┐               │  │
│  │ │H│ │W│ │D⏳│              │  │
│  └──────────────────────────┘  │
│                                │
│  ┌── MANUAL QUEUE ─────────┐   │  Fold 3
│  │ • #142 13:45             │   │
│  │ • #141 12:10             │   │
│  └──────────────────────────┘  │
│                                │
│  ┌── DECISIONS ─────────────┐  │  Fold 4
│  │ 14:30 ✓ Hybrid 분담      │  │
│  │ 11:32 ✓ resolve_yml      │  │
│  │ … (more →)                │  │
│  └──────────────────────────┘  │
│                                │
│  ┌── Pending (5) ──────────┐   │  Fold 5
│  │ ④ Calculator graph       │   │
│  │ ⑤ Profile tab            │   │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

**Stack**: 단일 column, fold 별 명확 구분 (`--space-8` gap), 각 카드 max-width 100%. PERSONAS grid 가 3×3 (8 + David) 으로 정확히 fit (380 - 48 padding - 16 gap × 2) / 3 ≈ 96px per avatar.

**Mode/Cost**: header 의 ⓘ 탭 → bottom sheet 로 진입 (모바일 정보 밀도 압축).

**탭** (모바일 정보 entry point): bottom-fixed tab bar 미사용 (의장이 4 fold scroll 친숙). Header ⓘ 만.

---

## 2. 컴포넌트 spec — 8 종

### 2-1. DashboardHeader

- **DOM**:
```html
<header class="dash-header">
  <div class="dash-header__brand">
    <span class="dash-header__logo">DMJ Orch</span>
    <time class="dash-header__time">06-01 14:32</time>
  </div>
  <div class="dash-header__meta">
    <span class="dash-header__mode dash-header__mode--deploy">deploy-only</span>
    <span class="dash-header__cost">$0 / 50</span>
  </div>
</header>
```
- **Token**: bg `var(--bg-primary)`, border-bottom `1px solid var(--border)`, height 60px, `--shadow-sm`, sticky top 0, z-index `--z-nav`.
- **Variants**: `--mode--deploy` (slate text) · `--mode--full` (sea text) · `--cost-warn` (월 80% 도달 시 sun underline) · `--cost-stop` (월 100% 도달 시 veryBad underline).
- **a11y**: `<time datetime="ISO">` machine-readable · `aria-label="현재 모드 · 비용"` on meta.

### 2-2. DavidOfflineBanner (조건부)

- **DOM**:
```html
<div class="david-banner" role="status" aria-live="polite">
  <span class="david-banner__icon">⏳</span>
  <span class="david-banner__text">David offline · manual dispatch active</span>
  <span class="david-banner__eta">복구 ETA: <span data-eta>?</span></span>
</div>
```
- **Token**: bg `var(--color-mist)`, border-bottom `2px solid var(--color-sun)`, padding `var(--space-3) var(--space-6)`, font-size `var(--fs-sm)`, color `var(--text-secondary)`.
- **Variants**: `--resolved` (자동 fade out 600ms `--ease-out`, dispatch 복구 시).
- **a11y**: `role="status"` + `aria-live="polite"` — 시각 외 screen reader 도 통지.

### 2-3. KanbanLane

- **DOM**:
```html
<section class="kanban-lane kanban-lane--priority">
  <h2 class="kanban-lane__title">PRIORITY</h2>
  <ol class="kanban-lane__list">
    <li><!-- DirectiveCard --></li>
  </ol>
</section>
```
- **Variants**:
  - `--priority` (의장 active queue · 상위 3)
  - `--pending` (대기 · 4번 이후)
  - `--manual` (manual dispatch queue · David 부재 모드 전용)
- **Token**: 카드 컨테이너 — bg `var(--bg-primary)`, border `1px solid var(--border)`, radius `var(--radius-lg)`, padding `var(--space-4)`, `--shadow-sm`.
- **Lane title**: `--fs-xs` weight 700, uppercase, letter-spacing 0.12em, color `--text-secondary`, margin-bottom `--space-3`.
- **a11y**: `<section>` semantic + `<h2>` heading hierarchy · `<ol>` 순서 있음 (priority).

### 2-4. DirectiveCard

- **DOM**:
```html
<article class="directive-card" data-state="in_progress" data-priority="1">
  <div class="directive-card__head">
    <span class="directive-card__priority">①</span>
    <h3 class="directive-card__title">Brand color sweep</h3>
    <span class="directive-card__state"><!-- StatusBadge --></span>
  </div>
  <div class="directive-card__meta">
    <span class="directive-card__assignee"><!-- PersonaAvatar size="sm" --></span>
    <span class="directive-card__budget">2h · $0.42</span>
    <span class="directive-card__turns">8 turns</span>
  </div>
  <div class="directive-card__commits">
    <span class="commit-chip">abc1234</span>
  </div>
</article>
```
- **Token**: bg `var(--color-mist)` (Kanban list 의 inner card), radius `var(--radius-md)`, padding `var(--space-3)`, hover `border-color: var(--color-sea)` + `transform: translateY(-1px)`, `--dur-fast var(--ease)`.
- **Variants**:
  - `[data-state="pending"]` → slate border
  - `[data-state="in_progress"]` → sea border + 좌측 pulse dot
  - `[data-state="done"]` → veryGood ✓ + opacity 0.7
  - `[data-state="error"]` → veryBad bg-tint + ⚠ icon
  - `[data-state="blocked"]` → bad border + lock icon + tooltip "blocked by #N"
- **a11y**: `<article>` semantic · state 가 시각 외 `aria-label` 에도 ("진행 중 — Brand color sweep — Rose · 2시간 · $0.42") · focus-visible ring (Spec 1 mixin 자동 적용).

### 2-5. PersonaAvatar (8 + David)

- **DOM**:
```html
<button class="persona-avatar" data-persona="rose" data-status="available">
  <span class="persona-avatar__mono">R</span>
  <span class="persona-avatar__name">Rose</span>
  <span class="persona-avatar__task">Brand color sweep</span>
  <span class="persona-avatar__status"></span>  <!-- PresenceDot -->
</button>
```
- **Token (gradient · monogram color)**:
```css
.persona-avatar[data-persona="rose"]    { --p-bg: linear-gradient(135deg, #0A2540, #1F8FFF); --p-on: #fff; }   /* Visual · navy→sea */
.persona-avatar[data-persona="sam"]     { --p-bg: linear-gradient(135deg, #1F8FFF, #1FB6B6); --p-on: #fff; }   /* DataViz · sea→teal */
.persona-avatar[data-persona="timo"]    { --p-bg: linear-gradient(135deg, #1FB6B6, #1FA055); --p-on: #fff; }   /* Sports Sci · teal→green */
.persona-avatar[data-persona="alex"]    { --p-bg: linear-gradient(135deg, #5C6F7E, #2A3B4C); --p-on: #fff; }   /* Frontend · slate→charcoal */
.persona-avatar[data-persona="may"]     { --p-bg: linear-gradient(135deg, #7A5FA8, #5C6F7E); --p-on: #fff; }   /* UX · violet→slate */
.persona-avatar[data-persona="ken"]     { --p-bg: linear-gradient(135deg, #FFB800, #EF7D00); --p-on: #0A2540; } /* Marketing · sun→orange */
.persona-avatar[data-persona="hiro"]    { --p-bg: linear-gradient(135deg, #C58A2E, #6B7A8D); --p-on: #fff; }   /* Hardware · amber→slate */
.persona-avatar[data-persona="wang"]    { --p-bg: linear-gradient(135deg, #1670CC, #0A2540); --p-on: #fff; }   /* Mobile · sea-dark→navy */
.persona-avatar[data-persona="david"]   { --p-bg: linear-gradient(135deg, #C7CFD8, #5C6F7E); --p-on: #fff; opacity: 0.4; }  /* Orchestrator · stone→slate · 부재 시 dim */
```
- **Mapping logic**: chart-theme `CATEGORY` 6 색 + 2 확장 + neutral. 인접 persona 의 색이 명확히 분리 (Rose navy↔Sam sea↔Timo teal↔Hiro amber 의 hue rotation).
- **Variants**:
  - Size — `--sm` (32×32 in DirectiveCard meta) · `--md` (96×96 in PersonaGrid) · `--lg` (140×140 in Profile detail)
  - Status (PresenceDot) — `available`(veryGood pulse) · `deep_work`(sea solid) · `blocked`(bad solid) · `idle`(slate) · `offline`(transparent + ⏳)
- **a11y**: `<button>` clickable (→ persona detail modal) · `aria-label="Rose Yoon · Visual Designer · 현재: Brand color sweep · 상태: 진행 중"`.

### 2-6. StatusBadge

- **DOM**:
```html
<span class="status-badge status-badge--in-progress">●  진행 중</span>
```
- **Token (state ↔ chart status 토큰 1:1 매핑)**:
```css
.status-badge--pending      { background: rgba(92,111,126,0.10); color: #5C6F7E; }     /* slate */
.status-badge--in-progress  { background: rgba(31,143,255,0.10); color: #1670CC; }     /* sea */
.status-badge--done         { background: rgba(31,160,85,0.10); color: #1D6B3A; }      /* veryGood-ink */
.status-badge--error        { background: rgba(214,69,58,0.10); color: #8B2014; }      /* veryBad-ink */
.status-badge--blocked      { background: rgba(236,138,46,0.10); color: #8A5A00; }     /* bad-ink */
.status-badge--stale        { background: rgba(242,194,14,0.10); color: #8A5A00; }     /* mid-ink */
```
- **Variants (size)**: `--sm` (`--fs-micro` 0.66rem · padding 2px 6px) · `--md` (`--fs-xs` 0.75rem · padding 3px 8px).
- **Pulse**: `[data-state="in_progress"] .dot` 의 pulse animation (`@keyframes pulse 2s ease-in-out infinite`) — `prefers-reduced-motion` 시 정지.
- **a11y**: state 가 시각만 의존 X — text 동반 (●  진행 중).

### 2-7. CostMeter

- **DOM**:
```html
<div class="cost-meter" role="meter" aria-valuenow="0.42" aria-valuemin="0" aria-valuemax="50" aria-label="월 비용">
  <span class="cost-meter__current">$0.42</span>
  <span class="cost-meter__sep">/</span>
  <span class="cost-meter__cap">50</span>
  <div class="cost-meter__bar">
    <div class="cost-meter__fill" style="width:0.84%"></div>
  </div>
</div>
```
- **Token**: bar bg `var(--color-fog)`, fill bg `var(--color-sea)` (정상) / `var(--color-sun)` (80%+) / `var(--color-bad)` (100% — daemon directive_loop 정지 신호). Height 4px, radius `var(--radius-full)`.
- **Variants**: `--horizontal` (header 인라인) · `--vertical` (모달 안 큰 표시).
- **a11y**: `role="meter"` + `aria-valuenow/min/max` + `aria-label` 명확.

### 2-8. CommitChip

- **DOM**:
```html
<a href="https://github.com/D990905/dmj-site/commit/abc1234" class="commit-chip" target="_blank" rel="noopener">
  <span class="commit-chip__sha">abc1234</span>
</a>
```
- **Token**: bg `var(--color-mist)`, font `var(--font-mono)`, font-size `var(--fs-xs)`, padding 2px 6px, radius `var(--radius-sm)`, color `var(--color-charcoal)`, hover bg `var(--color-fog)`.
- **a11y**: `<a target="_blank" rel="noopener">` · `aria-label="commit abc1234 — GitHub 새 창"`.

### 2-9. DecisionFeed

- **DOM**:
```html
<section class="decision-feed">
  <h2 class="decision-feed__title">DECISIONS</h2>
  <ol class="decision-feed__list">
    <li class="decision-feed__item">
      <time class="decision-feed__time" datetime="2026-06-01T14:30:00Z">14:30</time>
      <span class="decision-feed__icon">✓</span>
      <span class="decision-feed__text">Hybrid 분담 확정</span>
      <span class="decision-feed__persona"><!-- PersonaAvatar sm --></span>
    </li>
  </ol>
  <a href="…" class="decision-feed__more">전체 보기 →</a>
</section>
```
- **Token**: list-style none · li padding `var(--space-2) 0` · border-bottom `1px solid var(--border)` · `--fs-sm`.
- **a11y**: `<ol>` chronological · `<time datetime>` machine-readable.

---

## 3. 디자인 토큰 매핑

### 3-1. Color (100% 기존 재사용)

| 사용처 | 토큰 |
|---|---|
| Dashboard bg | `var(--color-mist)` (subtle gray bg, 카드와 contrast) |
| Card bg | `var(--bg-primary)` |
| Card border | `var(--border)` |
| Text primary | `var(--text-primary)` = navy |
| Text secondary | `var(--text-secondary)` = slate |
| Accent (CTA) | `var(--color-sun)` (manual dispatch banner underline 등) |
| Link / interactive | `var(--color-sea-dark)` (link 본문 AA 통과 색 — `visual_designer_reference §3-1`) |
| Status pending | `var(--color-slate)` |
| Status in_progress | `var(--color-sea)` |
| Status done | `#1FA055` (veryGood) |
| Status error | `#D6453A` (veryBad) |
| Status blocked | `#EC8A2E` (bad) |
| Status stale | `#F2C20E` (mid) |
| Persona Rose | 기존 brand-card Levitaz gradient 동일 |
| Persona 8 others | chart category 6 + 확장 2 (§2-5) |
| David offline | stone→slate gradient + opacity 0.4 |

### 3-2. Typography

| 사용처 | 토큰 |
|---|---|
| Dashboard title (Header brand) | `var(--font-sans-en)` weight 800, `var(--fs-md)` |
| Card title (DirectiveCard h3) | weight 600, `var(--fs-base)` |
| Lane title (KanbanLane h2) | weight 700, `var(--fs-xs)` uppercase, letter-spacing 0.12em |
| Body | weight 400, `var(--fs-sm)` |
| Meta | weight 500, `var(--fs-xs)` |
| Mono (commit SHA · cost) | `var(--font-mono)`, `var(--fs-xs)` |
| Persona name | `var(--font-sans-en)` weight 700, `var(--fs-sm)` |
| Persona monogram (avatar) | `var(--font-sans-en)` weight 900, clamp(1.25rem, 4vw, 2rem) |

### 3-3. Spacing & radius

| 사용처 | 토큰 |
|---|---|
| Page padding (desktop) | `var(--space-8)` |
| Page padding (mobile) | `var(--space-4)` |
| Section gap | `var(--space-8)` |
| Card padding | `var(--space-4)` |
| Card inner gap | `var(--space-3)` |
| Card radius | `var(--radius-lg)` (16px) |
| Inner card radius | `var(--radius-md)` (8px) |
| Avatar radius (md/lg) | 14px (`--radius-lg` 변형) |
| Avatar radius (sm) | `var(--radius-md)` |

### 3-4. Shadow & motion

| 사용처 | 토큰 |
|---|---|
| Card resting | `var(--shadow-sm)` |
| Card hover / dropdown | `var(--shadow-md)` |
| Modal / sheet | `var(--shadow-lg)` |
| Hover transition | `transform var(--dur-fast) var(--ease)` |
| State change (pending → in_progress) | opacity + transform `var(--dur-base) var(--ease-out)` |
| Pulse (in_progress dot · David banner) | 2.4s `var(--ease)` infinite — `prefers-reduced-motion` 시 정지 |

### 3-5. Focus ring (Spec 1 mixin 자동 적용)

DirectiveCard · PersonaAvatar · CommitChip · DecisionFeed item 모두 `:focus-visible` mixin (`visual_designer_phase2_specs.md` Spec 1) 으로 자동 적용. 다크 컨텍스트 (DavidOfflineBanner 가 부각된 영역) 는 `--ring-color-on-dark` (sun) swap.

---

## 4. 데이빗 부재 모드 — first-class state 시각

**의장님의 explicit 요구**: "임시" 가 영구화될 가능성이 있으므로 시각이 그 가능성을 first-class 로 인정. 3 영역 시각화:

1. **DavidOfflineBanner** (§2-2) — 상시 top 노출. dismiss 불가 (상태 신호). 복구 시 자동 fade out.
2. **PersonaAvatar `data-persona="david" data-status="offline"`** — 9번째 grid 자리 (3×3 의 마지막). opacity 0.4 + ⏳ overlay + tooltip "Dispatch resume pending — 임시 manual GH Issues dispatch active".
3. **KanbanLane `--manual`** — 의장이 직접 GH Issue 만든 directive 들의 분리된 lane. 자동 dispatch 와 시각 구분 (점선 border + slate eyebrow "MANUAL").

**복구 시점 시각 신호**: David 가 복구되면 — Banner fade out + Avatar opacity 0.4 → 1.0 + Manual lane 비워짐 (auto dispatch 로 이양). 600ms `var(--ease-out)`, `prefers-reduced-motion` 시 instant.

---

## 5. Astro component mapping (Alex 협업)

| Component | Astro 파일 | Island? | Props |
|---|---|---|---|
| DashboardHeader | `src/components/dashboard/DashboardHeader.astro` | island (clock) | `mode`, `cost_current`, `cost_cap` |
| DavidOfflineBanner | `…/DavidOfflineBanner.astro` | island (state) | `offline`, `eta?` |
| KanbanLane | `…/KanbanLane.astro` | 정적 | `variant`, `title`, slot |
| DirectiveCard | `…/DirectiveCard.astro` | 정적 (data prop) | `directive` (Directive type) |
| PersonaAvatar | `…/PersonaAvatar.astro` | 정적 | `persona`, `size`, `status?`, `task?` |
| StatusBadge | `…/StatusBadge.astro` | 정적 | `state`, `size` |
| CostMeter | `…/CostMeter.astro` | island (realtime) | `current`, `cap` |
| CommitChip | `…/CommitChip.astro` | 정적 | `sha`, `repo` |
| DecisionFeed | `…/DecisionFeed.astro` | island (realtime) | `decisions[]`, `limit` |

**Page**: `src/pages/orchestrator/index.astro` — layout 결합 (desktop 2-col, mobile stack). `src/pages/orchestrator/persona/[id].astro` (persona 상세 — Phase 2).

**Stack**: Astro 5 + Tailwind config 의 `theme.extend` 에 우리 design system 토큰 wire + Supabase JS client (island) + 우리 `style.css` import (canonical 토큰).

---

## 6. 협업 backlog

### 6-1. Alex Park (#4 Frontend) — 구현

- Astro project skeleton (orchestrator subpath) + Tailwind config + design system 토큰 wire
- 8 컴포넌트 1:1 Astro 변환
- Supabase client island (Part 2 결정 후)
- GitHub Pages 배포 path (orchestrator subpath) + CORS
- 인라인 스타일 0건 — 우리 design system 토큰만

### 6-2. Backend (#10) — Part 2 의존

- Hybrid 분담 확정 (Visual 권장: GH = directive 진입 + Supabase = canonical 상태)
- Supabase schema (`directives` · `statuses` · `decisions` · `personas` · `commits`)
- Sanitize contract — `error` 필드의 stack trace · secret 누설 방지
- CORS — Supabase URL 이 dmjgroup.kr 에서 fetch 가능하게
- Realtime channels (`statuses:state=in_progress` 등)
- Persona ↔ specialist 매핑 (4 specialist → 8 persona 확장)

### 6-3. Wang Jung (#8 Mobile) — 검수

- 모바일 viewport 380px 의 4-fold reflow QA
- iOS PWA add-to-home-screen 가능성 (Dashboard 가 모바일 native 대체 역할)
- 키보드 / VoiceOver 검증

### 6-4. David Ok (#orchestrator) — 복구 시점

- Manual queue → auto dispatch 자동 이양 logic
- Banner fade out trigger (`ENABLE_DIRECTIVE_LOOP=true` 감지)
- Decisions feed 가 데이빗의 "decision crystallizer" 출력 통합

### 6-5. May Han (#5 UX) — heuristic 검증

- Nielsen 10 의 #1 (system status visibility) · #4 (consistency) · #7 (flexibility) 통과
- 의장의 5초 인지 — "지금 가장 중요한 결정 한 개는?" Top-fold answer 가능한지
- 에러 state 의 recovery action 명확성 (Nielsen #9)

---

## 7. Part 2 placeholder — Hybrid 결정 후 작성

다음 영역은 의장의 hybrid 분담 결정 답 도착 후 같은 파일에 append:

- §7-1 — Realtime polling 패턴 (Supabase subscribe vs GH 30s poll vs hybrid)
- §7-2 — Sanitize contract (#10 협업) · CORS · Persona ↔ specialist 매핑표
- §7-3 — Astro Supabase client wrapper spec
- §7-4 — GitHub Pages 배포 plan · subdomain (orch.dmjgroup.kr) 또는 path (dmjgroup.kr/orchestrator)
- §7-5 — Authentication (Phase 1 = 의장 IP whitelist · Phase 2 = Supabase auth)
- §7-6 — Cost meter realtime update interval (Supabase trigger 또는 polling)

**Standby**: 의장 답 도착 시 Task #14 in_progress 로 전환 후 2h 분량 append.

---

## 8. 부록 — 출처

**프로젝트 내부**
- `_experts/expert_orchestrator_daemon_reference.md` §6-2 dashboard protocol · §6-1 directive/status schema
- `_experts/visual_designer_reference.md` §3 시스템 v2 토큰
- `_experts/visual_designer_component_catalog.md` 5-tier 컴포넌트
- `_experts/visual_designer_brand_color_spec.md` 4 브랜드 토큰
- `_experts/visual_designer_phase2_specs.md` Spec 1 focus ring · Spec 2 token canonical · Spec 4 아이콘
- `_experts/expert_ux_researcher_reference.md` Nielsen heuristics
- `_experts/expert_frontend_engineer_reference.md` §1-1 Astro · §3 component fragment
- `_experts/expert_mobile_app_reference.md` §6-3 dashboard 가 모바일 native 대체

**외부 reference**
- [Astro 5 — official](https://astro.build/)
- [Supabase Realtime — docs](https://supabase.com/docs/guides/realtime)
- [Linear — design 참조](https://linear.app)
- [Stripe Dashboard — sparse-but-dense 참조](https://stripe.com/atlas)
- [Vercel Analytics — dashboard 참조](https://vercel.com/analytics)

---

_Last updated: 2026-06-01_
_Part 1 — wireframe + 컴포넌트 + 토큰 + 데이빗 부재 모드 완료. Part 2 (data wiring) 는 의장 hybrid 결정 답 후 append._
