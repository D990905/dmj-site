# visual_designer_component_catalog.md — 사이트 컴포넌트 카탈로그

| 항목 | 내용 |
|---|---|
| 문서 유형 | 컴포넌트 catalog (page chrome · hero · section · card · button · form · data · motion) |
| 작성 | Visual Designer (전문가 #1) · 2026-06-01 |
| 대상 | `assets/css/style.css` (8528 line) + `assets/css/agent-deny.css` (911 line) + `riding-dashboard/css/dashboard.css` (2611 line) 전 컴포넌트 |
| 모(母) 문서 | `_experts/expert_visual_designer_reference.md` §2-6 컴포넌트 audit |
| 범위 | Phase 2 Astro migration 의 component-first 작업 기반. catalog 만 — production 변경 X |
| 협업 | Frontend Engineer (#4) Astro component 추출 · UX Researcher (#5) a11y 검증 · Mobile App (#8) SwiftUI/Compose 패리티 · Marketing (#) brand voice 일관 |

> **읽는 법.** 컴포넌트별로 (1) **위치** — file:line / (2) **DOM 골격** — HTML 구조 / (3) **Variants** — modifier 목록 / (4) **Phase 2 권장** — 개선 항목 (있을 때만) / (5) **a11y / 의존성**. Astro component 화 시 이 catalog 가 1:1 매핑. Tier 1 (모든 페이지) → Tier 5 (보조) 순서. 분량 cap 위해 핵심 spec 만 — 전체 CSS 는 style.css 직접 참조.

---

## 0. Catalog 사용법

**컴포넌트 분류 (5 tier):**

| Tier | 의미 | 컴포넌트 |
|---|---|---|
| **Tier 1 — Page chrome** | 모든 페이지에 동일 | nav · trust-bar · mobile-menu · footer · kakao-fab |
| **Tier 2 — Hero & section** | 페이지 hero / section heading | hero (3 variants) · section-head · wave-divider |
| **Tier 3 — Card family** | 정보 카드 가족 | card · brand-card · level-card · style-card · persona-card · sport-tile · sku-card · hub-cta |
| **Tier 4 — Atoms** | 가장 작은 UI 원자 | btn · pill · tier-badge · brand-chip · icon · pulse-dot |
| **Tier 5 — Form & data** | 입력 + 데이터 표현 | input · select · textarea · toggle-group · quiz-step · stats-strip · compare-table · inquiry-cta · reveal |

**Astro component 매핑 (Phase 2 framework migration 시):**

각 컴포넌트 → `src/components/{ComponentName}.astro`. props 는 variant + slot 으로 추상화. 예:

```astro
---
// src/components/Card.astro
interface Props { variant?: 'default' | 'hero' | 'compact'; }
const { variant = 'default' } = Astro.props;
---
<article class={`card ${variant === 'hero' ? 'card--hero' : ''}`}>
  <slot />
</article>
```

본 catalog 의 variant 명세가 Astro props 에 직접 매핑.

---

## Tier 1 — Page chrome

### 1-1. nav (사이트 헤더 네비)

- **위치** `style.css:415-604` · `index.html:139-180` 등 모든 페이지
- **DOM 골격**
```html
<header class="site-header" id="site-header">
  <div class="container">
    <nav class="nav" aria-label="주 메뉴">
      <a href="/" class="nav__logo">…</a>
      <div class="nav__primary" role="menubar">
        <div class="nav__has-sub" role="none">
          <a href="#x" class="nav__link" role="menuitem" aria-haspopup="true">…</a>
          <div class="nav__sub" role="menu">…</div>
        </div>
        <!-- 5 entry: 브랜드 · 스타일 · 장비 · 실력 · 컨설팅 CTA -->
      </div>
      <div class="nav__actions">
        <button class="nav__icon-btn">…</button>
        <button class="nav__hamburger">…</button>
      </div>
    </nav>
  </div>
</header>
```
- **Variants** `site-header.is-scrolled` (스크롤 시 bg alpha 증가) · `nav__link[aria-current="page"]` (활성 페이지) · `nav__sub--wide` (실력 수준 dropdown 의 wide variant)
- **Phase 2 권장** §145-G v6 single-dropdown lock 유지 · iOS hit-test fix (§171-C) 의 SVG pointer-events: none 보존 · backdrop-filter fallback 색 유지 (0.86 alpha 안전) · 5 entry 의 정보 구조는 UX Researcher §3-1 의 "장비 vs 브랜드 책임 분리" 와 협업 결정
- **a11y** `role="menubar"` + `aria-haspopup` + `aria-expanded` JS 토글 정통. Skip link 부재 — UX Researcher 협업 추가 권장. Tab/Enter/Space/Esc 키보드 전부 지원

### 1-2. trust-bar

- **위치** `style.css:685-711` · 모든 페이지 nav 위
- **DOM 골격**
```html
<div class="trust-bar"><div class="container"><div class="trust-bar__inner">
  <span class="trust-bar__item"><svg>…</svg>3회 올림픽 출전 코치 운영</span>
  …
</div></div></div>
```
- **Variants** 4 항목 (메인) vs 3 항목 (제품/level/style chapter) — **불일치 상태** · UX Researcher §1-2 Nielsen #4 위반
- **Phase 2 권장** Source-of-truth 통일 — Astro layout 의 단일 `<TrustBar />` component 로 모든 페이지 통일. 4 항목 (3회 올림픽 / 네 브랜드 / 당일 출고 / 1:1 카톡) 표준화. **Phase 1 권장 P1**
- **a11y** 단순 정보 띠 — interactive 없음. `<svg>` 의 `aria-hidden="true"` 추가 권장 (장식 아이콘)

### 1-3. mobile-menu

- **위치** `style.css:606-682` · `index.html:200-228` 등
- **DOM 골격**
```html
<div class="mobile-menu" aria-hidden="true">
  <button class="mobile-menu__close">…</button>
  <ul class="mobile-menu__list">
    <li><a href="…">메뉴 항목 <svg>↗</svg></a></li>
  </ul>
  <div class="mobile-menu__brands">
    <h4>BRANDS</h4>
    <div class="mobile-menu__brand-grid">
      <a href="…"><b>Levitaz</b><small>…</small></a>
      …
    </div>
  </div>
</div>
```
- **Variants** `.is-open` (열림 상태) · `body.menu-open` (스크롤 lock)
- **Phase 2 권장** Brand grid 에 monogram color 적용 (`visual_designer_brand_color_spec.md` §3-3 옵션 B) · focus-trap 추가 (UX) · `<svg>` pointer-events: none 정책 보존 (§171-C)
- **a11y** `aria-hidden` 토글 OK. 단 menu 열렸을 때 background page 의 focus trap 부재 — Phase 2 sweep

### 1-4. footer

- **위치** `style.css:1354-1429`
- **DOM 골격** 4-column grid (브랜드 · 도움말 · 정책 · 연락) + bottom strip (copyright)
- **Variants** — (단일)
- **Phase 2 권장** Astro `<Footer />` 단일 source. 현재 128 페이지 복사돼 있어 변경 시 sync 어려움 — Trust-bar 와 동일 burden

### 1-5. kakao-fab (Floating KakaoTalk button)

- **위치** `style.css:1775-1794` · 모든 페이지
- **DOM 골격**
```html
<a href="https://pf.kakao.com/…" class="kakao-fab" aria-label="카카오톡 상담">
  <svg>…</svg>
</a>
```
- **Variants** — (단일)
- **Phase 2 권장** `aria-label` 명확 (현재 OK) · §1-3 의 SVG pointer-events: none 정책 적용
- **a11y** Help component (Nielsen #10) — UX Researcher §1-3 Consistent Help (WCAG 2.2 #3.2.6) 통과. 우하단 고정 위치 일관

---

## Tier 2 — Hero & section

### 2-1. hero (cinematic — homepage)

- **위치** `style.css:712-843` (기본) + `:1900-2020` (split variant) + `:2148-2222` (brand variant) · `index.html:230-331`
- **DOM 골격**
```html
<section class="hero hero--cinematic" id="home">
  <div class="hero__cine-bg" aria-hidden="true">
    <picture>
      <source srcset="…webp" type="image/webp">
      <img class="hero__cine-image" src="…jpg" loading="eager" fetchpriority="high">
    </picture>
    <div class="hero__cine-overlay"></div>
  </div>
  <div class="container">
    <div class="hero__inner hero__inner--cine">
      <div class="hero__text">
        <span class="hero__eyebrow"><span class="dot"></span>…</span>
        <h1 class="hero__title">…<em>강조 부분</em></h1>
        <p class="hero__lead">…</p>
        <div class="hero__ctas">
          <a href="…" class="btn btn--accent btn--lg">…</a>
          <a href="…" class="btn btn--ghost-light btn--lg">…</a>
        </div>
        <div class="hero__quick-tags" aria-label="키워드">…</div>
        <dl class="hero__meta">
          <div class="hero__meta-item"><span class="num">3회</span><span class="label">…</span></div>
          …
        </dl>
      </div>
    </div>
  </div>
  <div class="hero__scroll" aria-hidden="true"><span>SCROLL</span><span class="hero__scroll-line"></span></div>
</section>
```
- **Variants**
  - `.hero--cinematic` — full-bleed photographic backdrop
  - `.hero--split` — text left + visual right (`:1900-2020`)
  - `.hero__title em` — sea→sun gradient text (`-webkit-background-clip: text`)
  - `.hero__bg::after` — repeating-linear-gradient grid overlay (cinematic 외)
  - `.hero__eyebrow .dot` — pulse animation (`@keyframes pulse 2.4s`)
- **Phase 2 권장** Hero lead 정보 압축 (UX Researcher §0 + Marketing 협업) · `hero__quick-tag` chip 의 hit area 44×44 측정 (현재 작을 가능성) · auto-play video 도입 시 `prefers-reduced-motion` 분기 필수 · LCP 측정 baseline (Frontend §4-3)
- **a11y** `loading="eager" fetchpriority="high"` LCP 최적 ✅ · gradient text 의 contrast 는 fallback color 명시 (gradient 미지원 브라우저)

### 2-2. brand-hero (제품 페이지 — levitaz/ppc/takoon/wip)

- **위치** `style.css:2148-2222`
- **DOM 골격** product page hero — brand identity + 제품 photography
- **Variants** brand 별 색 (현재 인라인 hex) → `visual_designer_brand_color_spec.md` 토큰 사용 권장
- **Phase 2 권장** `<ProductHero brand="levitaz" />` Astro component. monogram L/P/T/W 추가 (`brand_color_spec.md` §3-4)

### 2-3. section-head

- **위치** `style.css:845-880`
- **DOM 골격**
```html
<div class="section-head section-head--center">
  <span class="section-head__eyebrow">Consultation Frame · v1</span>
  <h2 class="section-head__title">…</h2>
  <p class="section-head__lead">…</p>
</div>
```
- **Variants** `--center` (가운데 정렬, 기본) · `--with-visual` (우측 visual 있을 때 좌정렬) · `--split` (`:2224-2262` title 좌 + side-stat 우)
- **Phase 2 권장** `<SectionHead align="center" eyebrow="…" title="…" lead="…" />` Astro component
- **a11y** h2 명확. eyebrow `<span>` 은 시각만 — semantic 영향 없음

### 2-4. wave-divider

- **위치** `style.css:2400-2410`
- **DOM 골격** section 사이의 wave SVG 구분선
- **Phase 2 권장** SVG sprite 화 (Spec 4 의 아이콘 시스템과 묶음)

---

## Tier 3 — Card family

### 3-1. card (base)

- **위치** `style.css:399-413`
- **DOM 골격**
```html
<article class="card">
  <slot />
</article>
```
- **Variants**
  - `.card:hover` — translateY(-4px) + shadow-lg + border transparent
  - `.card--hero` (대시보드만, `dashboard.css:171-175`) — gradient bg + shadow-hover 강조
  - `.card--compact` (Phase 2 권장 신규)
- **Phase 2 권장** focus-visible spec 적용 (Spec 1) · `--card-radius` `--card-shadow` 컴포넌트 토큰 추출 (framework migration 시)

### 3-2. brand-card (homepage brand grid)

- **위치** `style.css:881-990` · §3-1 brand color spec 참조
- **DOM 골격** §brand_color_spec.md §3-1 의 spec 그대로
- **Variants** `.brand-card__visual--{levitaz,ppc,takoon,wip}` 4 brand modifier
- **Phase 2 권장** §brand_color_spec.md §3-1 의 토큰화 적용. `<BrandCard brand="levitaz" name="…" sub="…" copy="…" href="…" />` Astro

### 3-3. level-card (consultation hub — 4 level)

- **위치** 현재 `index.html:404-424` **인라인 스타일**. style.css 미정의
- **DOM 골격 (Phase 2 spec — `visual_designer_phase2_specs.md` Spec 3-B 참조)**
```html
<div class="grid-4cols level-grid">
  <a href="level/beginner.html" class="level-card level-card--beginner">
    <span class="level-card__pill">Beginner</span>
    <h4 class="level-card__title">입문·초급</h4>
    <p class="level-card__lead">…</p>
  </a>
  <!-- intermediate / advanced / pro -->
</div>
```
- **Variants** `.level-card--{beginner,intermediate,advanced,pro}` — 각각 pill bg/color 다름
- **Phase 2 권장** Phase 2 Spec 3-B 의 추출 spec 그대로 · DO_NOT_REVERT §163 (4-col lock) 의도 `.grid-4cols` modifier 로 보존
- **a11y** keyboard Tab navigation · focus ring (Spec 1 의 :where() mixin 자동 적용)

### 3-4. style-card (consultation hub — 4 style)

- **위치** 현재 `index.html:428+` 인라인 스타일
- **DOM 골격** level-card 와 동일 패턴, modifier 만 `--{flat,choppy,wave,hybrid}`
- **Phase 2 권장** level-card 와 함께 Phase 2 Spec 3-C 로 추출
- **a11y** Same as level-card

### 3-5. persona-card

- **위치** `style.css:992-1097`
- **DOM 골격** 라이더 페르소나 카드 (3 또는 4-col grid)
- **Variants** `.persona-grid--four` (4-col)
- **Phase 2 권장** Astro `<PersonaCard avatar="…" name="…" role="…" quote="…" />`

### 3-6. sport-tile (homepage 4 카테고리)

- **위치** `style.css:1098-1148` + `:2461-2463` (4-col override)
- **DOM 골격** Wing / Foil / SUP / Accessory 4 sport 진입 tile
- **Phase 2 권장** Astro `<SportTile sport="wing" />` · 아이콘 통일 (Spec 4)

### 3-7. sku-card (제품 페이지 — SKU 리스트)

- **위치** `style.css:2694-2703` (모바일 패딩) + 본 spec 은 brand hub `:1430-1773` 안
- **DOM 골격** SKU 카드 (이미지 + 사양 + price + CTA)
- **Variants** brand 별 색 stripe (Phase 2 — `brand-chip` 활용)
- **Phase 2 권장** Astro `<SKUCard sku={…} brand="…" />` · 5-axis mini-chart (`:2836-2892`) 통합

### 3-8. hub-cta (homepage Find My Gear gradient CTA)

- **위치** 현재 `index.html:382-398` **인라인 스타일**. style.css 미정의
- **DOM 골격 + CSS** `visual_designer_phase2_specs.md` Spec 3-A 참조
- **Phase 2 권장** Phase 2 Spec 3-A 의 추출 spec 그대로 적용

### 3-9. Brand hub (제품 페이지 전체 layout)

- **위치** `style.css:1430-1774` (Brand Hub Page levitaz/ppc/takoon/wip)
- **DOM 골격** brand-hero + intro + SKU grid + spec table + inquiry CTA
- **Variants** brand 별 색 / photography
- **Phase 2 권장** Astro `<BrandHub brand="…">` layout · `visual_designer_brand_color_spec.md` 토큰 적용

---

## Tier 4 — Atoms

### 4-1. btn (Button)

- **위치** `style.css:303-358` (기본) + `:360-380` (find-my-gear CTA lock §171) + `:2720-2735` (모바일 조정)
- **DOM 골격**
```html
<a href="…" class="btn btn--primary">텍스트<svg class="arrow">…</svg></a>
<button class="btn btn--accent btn--lg">텍스트</button>
```
- **Variants**
  - 색 — `--primary` (navy) · `--accent` (sun) · `--ghost` (border) · `--ghost-light` (다크 위 ghost)
  - 크기 — `--lg` (1.0625rem padding) · `--sm` (0.625rem padding) · 기본
  - hover — translateY(-1px) + box-shadow + arrow translateX(3px)
  - focus-visible — outline 2px sea + offset 2px ✅
- **Phase 2 권장** §171 fmg-result-cta horizontal layout lock 보존 · Spec 1 focus mixin 의 :where() 가 .btn 도 cover (specificity 0) — 기존 :focus-visible 정의가 우선 ✅
- **a11y** Tap target 충족 (lg 52px / 기본 ~46px / sm ~38px → **sm 변형은 44px 미만 가능 — 권장 min-height 44px 추가**)

### 4-2. pill / badge

- **위치** `style.css:382-397`
- **DOM 골격**
```html
<span class="pill">기본</span>
<span class="pill pill--accent">★ 추천</span>
<span class="pill pill--mute">중립</span>
<span class="pill pill--dark">다크 위</span>
```
- **Variants** `--accent` (sun bg) · `--mute` (mist bg, slate text) · `--dark` (다크 컨텍스트)
- **Phase 2 권장** `pill--accent-dark` 신규 (어두운 sun-tinted bg + sun text) — `hub-cta__eyebrow` 등에서 사용 · `hero__quick-tag` 가 별도 클래스인데 pill 패턴 공유 가능
- **a11y** 정적 정보 — interactive 아님

### 4-3. tier-badge (4 tier 가시성)

- **위치** `style.css:2786-2813`
- **DOM 골격** 입문 / 중급 / 고급 / 레이싱 4-tier badge
- **Variants** `.tier-badge--{beginner,intermediate,advanced,race}`
- **Phase 2 권장** level-card 와 색 일관 검토 (level-card 의 pill 색 vs tier-badge 색)

### 4-4. brand-chip (Phase 2 신규 — `brand_color_spec.md` §3-5)

- **위치** 신규 (미정의)
- **DOM 골격 + CSS** `visual_designer_brand_color_spec.md` §3-5
- **Phase 2 권장** find-my-gear 결과 카드 · cart line · quote line 에 적용

### 4-5. icon (SVG)

- **위치** 전 사이트 inline SVG · `visual_designer_phase2_specs.md` Spec 4 의 표준화 대상
- **Variants** `.icon--{sm,md,lg,xl}` (신규 — Spec 4)
- **Phase 2 권장** Lucide line icons 가족으로 통일 (viewBox 24·stroke 2·linecap round)
- **a11y** 장식: `aria-hidden="true"` · 의미: `aria-label` (icon button)

### 4-6. pulse-dot (animated indicator)

- **위치** `style.css:754-763` (hero__eyebrow .dot) + `@keyframes pulse 2.4s`
- **DOM 골격** `<span class="dot"></span>` (hero eyebrow 내)
- **Phase 2 권장** `prefers-reduced-motion` 시 animation 정지 — 현재 `:123-129` 의 global reduced-motion 으로 자동 통과

---

## Tier 5 — Form & data

### 5-1. input / select / textarea

- **위치** `style.css:1233-1353` (Launch Alert Form) + `:2758-2768` (iOS zoom 방지 16px font-size)
- **DOM 골격**
```html
<input type="email" class="form__input" placeholder="…">
<select class="form__select">…</select>
<textarea class="form__textarea">…</textarea>
```
- **Variants** state — `.is-invalid` (border red) · `.is-valid` (border green) · `:focus` (border sea)
- **Phase 2 권장** focus-visible 정책 일관 (Spec 1 mixin 적용) · `aria-invalid` 와 시각 state sync · 에러 메시지의 `aria-describedby`
- **a11y** iOS zoom 방지 16px ✅ (DO_NOT_REVERT) · `<label>` 명확 (placeholder 만 의존 X)

### 5-2. toggle-group (대시보드 segmented control)

- **위치** `dashboard.css:142-157`
- **DOM 골격**
```html
<div class="time-toggle">
  <button class="is-active">1시간</button>
  <button>30분</button>
  <button>10분</button>
</div>
```
- **Variants** `.unit-toggle` (다크 헤더) · `.time-toggle` · `.mv-filter` · `.violin-toggle` (모두 같은 spec, 색만 다름)
- **Phase 2 권장** focus-visible 적용 (Spec 1) · `<ToggleGroup>` Astro component + `role="tablist"` + `aria-selected`
- **a11y** 현재 button 만 — `role="radiogroup"` 또는 `role="tablist"` 추가 검토

### 5-3. quiz-step (Find My Gear)

- **위치** `find-my-gear.html:200-450` 일부 · style.css 의 `.quiz-*` 셀렉터
- **DOM 골격**
```html
<div class="quiz-step" data-step="1">
  <div class="quiz-progress"><div class="quiz-progress__fill" style="width:20%"></div></div>
  <h2 class="quiz-step__title">…</h2>
  <p class="quiz-step__lead">…</p>
  <div class="quiz-options">
    <button class="quiz-option">…</button>
  </div>
  <button class="quiz-back">← 이전</button>
</div>
```
- **Variants** step 별 (demographic / level / weight / style / sport)
- **Phase 2 권장** Q5 명시적 skip 버튼 (UX §5 Top 2) · progress 분모 `Step n / 5 · 결과` 표기 · auto-advance feedback transition · `aria-live="polite"` 결과 화면

### 5-4. stats-strip (4-column)

- **위치** `style.css:2263-2303`
- **DOM 골격** full-width 4-stat strip (`section` 안 background--mist)
- **Variants** 3-col / 4-col responsive
- **Phase 2 권장** `<StatsStrip stats={[…]} />` Astro · num typography `--fs-num-*` 토큰 사용

### 5-5. compare-table

- **위치** `style.css:2464-2485` + `:2704-2719` (모바일 가로 스크롤)
- **DOM 골격** 제품 spec 비교 표 (brand 페이지)
- **Variants** brand 별
- **Phase 2 권장** sort by column 추가 (UX 권장) · sticky header column · 모바일 가로 스크롤 indicator

### 5-6. inquiry-cta (less repetitive CTA strip)

- **위치** `style.css:2486-2511`
- **DOM 골격** section 사이 작은 inquiry CTA (full-section 대비 noise 적음)
- **Variants** brand 별 색
- **Phase 2 권장** brand-card 와 색 일관

### 5-7. reveal (scroll animation)

- **위치** `style.css:1795-1806` + JS IntersectionObserver
- **DOM 골격** `<div class="reveal">…</div>` — viewport 진입 시 opacity 0→1 + translateY 8px→0
- **Variants** 기본 + stagger (Phase 2 권장 신규)
- **Phase 2 권장** child stagger (index × 80ms 미세) · `--ease-spring` 활용 sweep
- **a11y** `prefers-reduced-motion` 시 즉시 visible (animation skip) — `:123-129` global block 으로 통과

---

## 그 외 컴포넌트 (간단 catalog)

| 컴포넌트 | 위치 | Phase 2 |
|---|---|---|
| performance 5축 chart | `style.css:1149-1232` + `:2836-2892` | SVG 또는 canvas 단순화 검토 |
| launch alert form | `:1233-1353` | input spec 일관 |
| brand band stripe | `:2346-2371` | brand color 토큰 사용 |
| brand orbit hero visual | `:2681-2693` | 모바일 hidden 정책 유지 |
| character nickname | `:2814-2835` | 사용 빈도 확인 후 Phase 2 정리 |
| coming soon card (Takoon DSW) | `:2893-2943` | 일반 sku-card 의 modifier 로 추출 가능 |
| 4×4 brand differentiation matrix | `:2944-3072` | 데이터 표현 — DataViz 협업 |
| youtube poster fallback | `:4092-4172` | error 153 fix 유지 |
| hero video → thumbnail fallback | `:4173-4215` | error 153 fix 유지 |
| image background utility | `:4488-4561` | utility 그대로 |
| wind baseline pill / note | `:4562-4673` | dashboard 와 일관 |
| policy pages | `:1837-1895` | tab navigation 시각 일관 |
| agent-deny widget | `agent-deny.css:1-911` (별도 파일) | 별도 catalog (UX 협업 중심) |

---

## Astro migration 매핑 (Phase 2 framework dispatch 시)

| Atomic level | Astro path | Props |
|---|---|---|
| **Layout** (page chrome) | `src/layouts/SiteLayout.astro` | `title`, `description`, slot |
| nav | `src/components/Nav.astro` | `currentPath` |
| trust-bar | `src/components/TrustBar.astro` | `items?` (default 4 항목) |
| mobile-menu | `src/components/MobileMenu.astro` | (state via island) |
| footer | `src/components/Footer.astro` | — |
| kakao-fab | `src/components/KakaoFab.astro` | `href` |
| **Hero & section** | `src/components/Hero*.astro` | brand/variant |
| hero (cinematic) | `Hero.astro` | `image`, `eyebrow`, `title`, `lead`, `ctas[]`, `meta[]` |
| brand-hero | `BrandHero.astro` | `brand` (1 of 4) |
| section-head | `SectionHead.astro` | `align`, `eyebrow`, `title`, `lead` |
| **Cards** | `src/components/cards/*.astro` | data/variant |
| card | `Card.astro` | `variant`, slot |
| brand-card | `BrandCard.astro` | `brand` |
| level-card | `LevelCard.astro` | `level` (1 of 4) |
| style-card | `StyleCard.astro` | `style` (1 of 4) |
| persona-card | `PersonaCard.astro` | `persona` |
| sport-tile | `SportTile.astro` | `sport` |
| sku-card | `SKUCard.astro` | `sku`, `brand` |
| hub-cta | `HubCTA.astro` | `eyebrow`, `title`, `lead`, `cta`, `num` |
| **Atoms** | `src/components/atoms/*.astro` | variant |
| Button | `Button.astro` | `variant`, `size`, `href?`, slot |
| Pill | `Pill.astro` | `variant`, slot |
| TierBadge | `TierBadge.astro` | `tier` |
| BrandChip | `BrandChip.astro` | `brand` |
| Icon | `Icon.astro` | `name` (lucide name), `size` |
| **Form** | `src/components/form/*.astro` | — |
| Input | `Input.astro` | `type`, `label`, `error?`, … |
| ToggleGroup | `ToggleGroup.astro` (island) | `options[]`, `value`, `onChange` |
| QuizStep | `QuizStep.astro` (island) | `step`, `total`, `…` |
| **Data** | `src/components/data/*.astro` | — |
| StatsStrip | `StatsStrip.astro` | `stats[]` |
| CompareTable | `CompareTable.astro` | `columns[]`, `rows[]` |

**Astro island 가 필요한 컴포넌트** (interactivity): MobileMenu · ToggleGroup · QuizStep · KakaoFab (analytics) · Reveal (IntersectionObserver). 나머지는 100% 정적.

---

## 협업 인터페이스 (이 catalog 기준)

- **Frontend Engineer (#4)** — Astro component 추출. 1 컴포넌트 = 1 PR 권장 (회귀 격리). 위 매핑 표가 PR backlog.
- **UX Researcher (#5)** — 각 컴포넌트의 a11y heuristic 검증. 특히 nav · mobile-menu · quiz-step · form 의 키보드/screen reader.
- **DataViz (#2)** — `compare-table` · `stats-strip` · `performance 5축` 의 데이터 표현 협업.
- **Marketing (#)** — `hero` · `brand-card` · `brand-hub` 의 brand voice / photography.
- **Mobile App (#8)** — SwiftUI / Compose 의 component enum 이 본 catalog 와 1:1 패리티. Atoms (Button · Pill · Icon · BrandChip) 부터 매핑.

---

## 부록 — 컴포넌트 빈도 매트릭스

가장 자주 쓰이는 컴포넌트 우선 추출 (Phase 2 첫 sprint):

| 컴포넌트 | 사용 페이지 수 (추정) | 추출 우선순위 |
|---|---|---|
| nav · trust-bar · footer · mobile-menu | 128 (모든 페이지) | **P0** |
| Button · Pill | ~120 | **P0** |
| Card (기본) | ~80 | **P0** |
| Hero (cinematic/split/brand) | ~30 | **P1** |
| section-head | ~80 | **P1** |
| Brand-card · level-card · style-card · hub-cta | 1 (홈) + 4 brand page | **P1** |
| SKU-card · brand-hub | 4 (제품 페이지) | **P1** |
| Quiz-step | 1 (find-my-gear) | **P1** |
| persona · sport-tile · stats-strip | 5-10 | **P2** |
| compare-table | 4 | **P2** |
| 그 외 (5축 chart · brand band · 4×4 matrix · 등) | 1-3 | **P3** |

---

_Last updated: 2026-06-01_
_컴포넌트 catalog v1 — Phase 2 Astro migration 의 backlog 기반. Frontend dispatch 시 P0 → P1 → P2 순서._
