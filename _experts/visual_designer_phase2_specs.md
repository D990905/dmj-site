# visual_designer_phase2_specs.md — Phase 2 implementation-ready specs

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 2 implementation-ready specs (Top 5 권장의 detailed plan) |
| 작성 | Visual Designer (전문가 #1) · 2026-05-31 |
| 대상 | Phase 2 dispatch 후 Frontend Engineer (#4) + DataViz (#2) 가 즉시 implement 가능한 spec |
| 모(母) 문서 | `_experts/expert_visual_designer_reference.md` §4 Top 5 즉시 개선 |
| 범위 | Phase 2 spec 만. 본 문서 자체는 production 코드 변경 X — 코드 spec 은 implementation 시 작업자 (Frontend/DataViz) 가 적용 |
| 제약 | `chart-theme.js` 4 계열 토큰 (status/side/category/hrZone) 의미 절대 유지 · DO_NOT_REVERT §163 §171 §171-B §171-C §145-G 등 시각 lock 항목 모두 보존 · Korean policy 유지 · 라이트 본체 / replay viewer 다크 분리 유지 |
| 의존 | reference §3 의 v2 토큰 시스템 합의 선행 |

> **읽는 법.** 5 spec 이 각각 (1) 동기 — 왜 / (2) Change set — 정확한 코드·classname·DOM / (3) 적용 위치 — file:line / (4) 검증 — 어떻게 회귀를 잡나 / (5) 협업 — 누구와 합의 후 진행 / (6) Risk & rollback. spec 1 부터 5 까지 effort 가 짧은 순서. dispatch 받은 작업자는 §spec 만 읽으면 implement 가능.

---

## Spec 1 — Focus ring 표준화 (WCAG 2.2 #2.4.13 준수)

### 동기

WCAG 2.2 AA 의 신규 success criterion 2.4.13 Focus Appearance — focus indicator 가 2px 두께 + 3:1 contrast 의 visible ring 으로 모든 focusable 요소에 적용돼야 함. 현재 `.btn:focus-visible` 만 명시 (`style.css:326`), nav__link · card · pill · hero__quick-tag · brand 카드 · level/style 카드 등은 브라우저 기본 dotted ring 에 의존. 키보드 사용자 + screen reader 사용자의 navigation 정확도 영향.

### Change set

**Step 1 — 토큰 추가 (`assets/css/style.css` `:root` 블록 끝에):**

```css
:root {
  /* ... 기존 토큰들 ... */

  /* Focus ring v2 (Phase 2 — WCAG 2.2 #2.4.13) */
  --ring-color:         var(--color-sea);        /* light 컨텍스트 */
  --ring-color-on-dark: var(--color-sun);         /* navy/dark 컨텍스트 */
  --ring-width:         2px;
  --ring-offset:        2px;
  --ring-radius-extra:  4px;                      /* radius 가 0 인 inline 요소용 */
}
```

**Step 2 — 표준 mixin (CSS class utility 또는 :where() 그룹):**

```css
/* 한 곳에서 모든 focusable 에 적용 — :where() 로 specificity 0 유지하여
   다른 :focus-visible 정의가 override 가능 */
:where(
  a, button, input, select, textarea,
  [tabindex]:not([tabindex="-1"]),
  .btn, .pill, .card, .nav__link, .nav__sub-link, .nav__icon-btn,
  .nav__hamburger, .nav__cart, .hero__quick-tag,
  .mobile-menu a, .mobile-menu__close,
  .level-card, .style-card, .brand-card,
  .hub-cta, .hub-cta a, .hub-cta button,
  .quiz-option, .fmg-result-cta .btn
):focus-visible {
  outline: var(--ring-width) solid var(--ring-color);
  outline-offset: var(--ring-offset);
  border-radius: inherit;            /* 부모 radius 상속 (필요 시) */
}

/* Dark 컨텍스트 — navy bg 위에서 sun ring */
:where(
  .section--dark, .section--darker, .trust-bar, .mobile-menu, .app-header,
  .hero--cinematic, .replay
) :where(
  a, button, input, .btn, .pill, .nav__link
):focus-visible {
  outline-color: var(--ring-color-on-dark);
}
```

**Step 3 — `:focus` (마우스 클릭) 와 `:focus-visible` (키보드/AT) 분리 확인:**

브라우저 native 의 `:focus-visible` UA stylesheet 가 마우스 클릭에서는 ring 표시 안 함 (Firefox/Chrome/Safari 모두). 우리 spec 도 `:focus-visible` 만 — 마우스 사용자에게 ring 보이지 않음 (의도). 단 `outline: none` 으로 `:focus` 전체를 끄는 코드가 어딘가에 있으면 `:focus-visible` 도 같이 죽으므로 grep 으로 확인.

**Step 4 — Dashboard 의 toggle 그룹 (`unit-toggle`·`time-toggle`·`mv-filter`·`violin-toggle`):**

```css
/* dashboard.css */
.unit-toggle button:focus-visible,
.time-toggle button:focus-visible,
.mv-filter button:focus-visible,
.violin-toggle button:focus-visible {
  outline: var(--ring-width) solid var(--ring-color);
  outline-offset: var(--ring-offset);
  border-radius: 7px;
}
.unit-toggle button:focus-visible {  /* 다크 헤더 위 */
  outline-color: var(--ring-color-on-dark);
}
```

**Step 5 — Reduced motion 호환:**

Focus ring 은 instant (animation 없음) — `prefers-reduced-motion` 영향 받지 않음. 단 hover transition 과 focus ring 이 같은 element 에 적용될 때, hover transition 이 reduced-motion 으로 0 으로 가도 ring 은 그대로. **추가 작업 없음** — `style.css:123-129` 의 reduced-motion 블록이 transition 만 끔, outline 은 unaffected.

### 적용 위치

- `assets/css/style.css` — :root 토큰 (line 7-111 끝) + :where() 표준 mixin (적절 위치, `/* Reset / Base */` 아래)
- `riding-dashboard/css/dashboard.css` — toggle 그룹 spec (line 142 근처)
- 인라인 스타일 button (`index.html:404-424` 의 level grid) — 인라인 추출 (Spec 3) 시점에 자동 적용. 그 전까지는 inline `style="..."` 이라 spec 통과 — 단 onmouseover 회귀 위험 별도.

### 검증

1. **Manual keyboard test** — index.html · find-my-gear.html · riding-dashboard/ 에서 Tab 키로 모든 focusable 순회. Ring 이 매 요소마다 visible 한지 + 다크 컨텍스트에서 sun 으로 swap 되는지 확인.
2. **axe-playwright 자동 audit** — `@axe-core/playwright` 의 `wcag22aa` rule. Focus-related violation 0 확인.
3. **Browser matrix** — Safari 17+ / Chrome 121+ / Firefox 120+ (Korean Mac/Windows 시장). `:where()` 와 `:focus-visible` 둘 다 안정 지원.

### 협업

- **Frontend Engineer** — CSS 적용 + `outline: none` grep 으로 다른 곳에서 끄는 코드 확인 (`grep -rn "outline: none\|outline:0" assets/css/ riding-dashboard/css/`).
- **UX Researcher** — 실제 키보드 사용자 시나리오 검증 — find-my-gear 5-step quiz 의 step transition 시 focus 가 어디로 가는지.
- **DataViz** — 차트 canvas 자체는 focusable 아님. 단 차트 위의 control button (`mv-filter` 등) 은 spec 적용.

### Risk & rollback

- **Risk 1**: `:where()` specificity 0 이라 다른 강한 selector 의 `:focus { outline: none }` 이 override. → grep 으로 확인 + 발견 시 individual fix.
- **Risk 2**: 일부 카드 (e.g., `.brand-card`) 가 `<a>` 와 `<div>` 양쪽 다 있으면 outline 이 잘못된 boundary 에 — 작업자가 카드별 점검.
- **Rollback**: 단일 commit revert. 토큰 정의도 안전 — 사용 안 되는 변수는 inert.

### Effort

2-4h. mixin 작성 30m · grep audit 30m · browser matrix QA 1-2h · 도큐먼트 30m.

---

## Spec 2 — `--color-*` canonical 토큰 일원화 (Phase 2-A 안전 마이그레이션)

### 동기

`style.css:9-37` 의 `--color-navy` `--color-sea` `--color-sun` 등 prefix 있는 토큰과 `dashboard.css:14-17` 의 `--navy` `--sea` `--sun` 등 prefix 없는 토큰이 **같은 색을 두 이름** 으로 둠. DRY 위반 — brand color 변경 시 두 곳을 다 갱신해야 (그리고 잊을 위험). Phase 2 framework migration (Astro) 시점에 토큰 일원화가 자연 — 그 사전 단계로 alias 화.

### Change set

**Step 1 — `riding-dashboard/css/dashboard.css` :root 블록 (line 13-17) 수정:**

```css
:root {
  /* 브랜드 (메인 style.css 의 --color-* 를 canonical 로 alias).
     기존 --navy / --sea / --sun 이름은 역호환 유지 — 새 코드는 --color-* 만 사용. */
  --navy:      var(--color-navy);
  --navy-deep: var(--color-navy-deep);
  --sea:       var(--color-sea);
  --sea-deep:  var(--color-sea-dark);
  --sun:       var(--color-sun);
  --sun-deep:  var(--color-sun-dark);

  /* ... 표면 / 글자 / 상태 / 좌우 / radius / shadow / motion / 타입 / 간격 토큰들 그대로 ... */
}
```

**선행 조건**: `dashboard.css` 가 `style.css` 보다 **뒤에 로드** 돼야 — 현재 `riding-dashboard/index.html:40-41` 의 순서 `style.css` → `dashboard.css` 정확. 단 dashboard.css 가 standalone 으로도 동작해야 한다면 (예: dashboard 만 단독 호스트), `style.css` 의 brand 토큰을 `:root` 블록 시작에 inline backup 으로 추가 (`@supports not(top: var(--color-navy))` fallback) — Phase 2-B.

**Step 2 — 명명 정책 문서화 (이 spec 자체 + frontend reference 의 §3):**

- **canonical**: `--color-{brand-name}` (예: `--color-navy`). 새 코드는 무조건 canonical.
- **legacy alias**: prefix 없는 이름 (`--navy` 등). 기존 코드 유지, 점진 deprecation.
- **deprecation timeline**: Phase 2 framework migration 시점 (예: Astro 도입) 에 일괄 sweep — `--navy` → `--color-navy`. 그때까지 legacy 도 동작.

**Step 3 — 신규 토큰 (Spec 1 의 ring · 향후 brand monogram 등) 은 처음부터 canonical:**

```css
:root {
  --ring-color: var(--color-sea);          /* canonical only */
  --brand-levitaz: #0A2540;                /* canonical (Marketing 합의 후) */
  --brand-ppc:     #1F8FFF;
  --brand-takoon:  #FFB800;
  --brand-wip:     #5C6F7E;
}
```

**Step 4 — dashboard.css 의 다른 토큰 (예: `--text` `--text-mid` `--text-dim` `--bg-app` `--bg-card`) 의 처리:**

이 토큰들은 메인 사이트의 `--text-primary` `--text-secondary` `--bg-primary` `--bg-secondary` 와 의미 1:1 매핑이지만 이름이 다르다. **Phase 2-A 에서는 alias 하지 않음** (이름이 의미상 달라 1:1 alias 가 위험 — `--bg-app` 는 페이지 배경, `--bg-primary` 는 카드 배경에 더 가까울 수 있음). **Phase 2-B (framework 도입 시) 에 semantic layer 통합** — Frontend 와 합의.

### 적용 위치

- `riding-dashboard/css/dashboard.css:14-17` — 6 라인 변경 (값 → alias)
- `_experts/visual_designer_phase2_specs.md` 와 `expert_visual_designer_reference.md` §3-1 — 정책 문서화

### 검증

1. **시각 회귀 0** — dashboard 페이지의 모든 카드 / 차트 / 헤더 색이 변경 전후 동일. 픽셀 diff (Playwright `toHaveScreenshot()`) 으로 자동 검증.
2. **DevTools Computed Style** — `.app-header` 의 `background-color` 가 `rgb(10, 37, 64)` (= #0A2540) 으로 동일하게 resolve.
3. **새 코드 lint** — Phase 2 신규 commit 에서 `--navy` 등 prefix 없는 토큰 사용 시 warning (stylelint custom rule, Phase 2-B).

### 협업

- **Frontend Engineer** — alias 적용 + lint rule (Phase 2-B).
- **DataViz** — `chart-theme.js` 의 색 토큰 (`STATUS.veryGood` 등) 은 별도 시스템 — 본 spec 영향 없음. 단 Phase 2 의 brand monogram 색 (`--brand-levitaz` 등) 이 chart category color 와 일관되면 좋음 — Marketing + Visual + DataViz 3 협업.

### Risk & rollback

- **Risk 1**: `dashboard.css` 가 `style.css` 보다 먼저 로드되는 페이지가 있으면 alias 가 undefined 로 풀림. → grep `link.*dashboard.css` 로 모든 사용처 점검.
- **Risk 2**: 어느 한 CSS variable 의 값을 미세하게 다르게 두려는 의도 (예: dashboard 의 `--sea` 가 메인의 `--color-sea` 보다 살짝 채도 낮음) 가 있다면 alias 가 그 의도를 깸. → 변경 전 두 값이 100% 동일한지 확인 — 현재는 동일 (#1F8FFF).
- **Rollback**: 단일 commit revert. 시각 영향 0 인 작업이라 안전.

### Effort

1-2h. dashboard.css 6 라인 변경 + 시각 회귀 QA 1h + 도큐먼트 30m.

---

## Spec 3 — 인라인 스타일 → 컴포넌트 클래스 추출

### 동기

`index.html` 의 hero CTA gradient card (line 382-398) · level grid 4 카드 (line 404-424) · style grid 4 카드 (line 428+) 가 모두 `style="..."` + `onmouseover`/`onmouseout` 인라인. 결과: (1) CSS 분산 — 디자인 결정의 위치가 한 곳이 아님, (2) onmouseover 는 keyboard 사용자에게 안 도달 — a11y fail, (3) 회귀 감지 불가 — 시각 변경이 git diff 에 큰 chunk 로 묻힘.

### Change set

**(A) Hub CTA card (hero CTA grad card)**

**현재** (`index.html:382-398` 약식):
```html
<div class="reveal" style="background:linear-gradient(135deg, var(--color-navy), var(--color-sea-dark));border-radius:24px;padding:48px;color:#fff;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:48px;align-items:center;margin-bottom:64px">
  <div>
    <span style="display:inline-block;background:rgba(255,184,0,0.18);color:var(--color-sun);font-size:0.6875rem;font-weight:700;padding:6px 14px;border-radius:999px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px">★ 추천 · Find My Gear</span>
    <h3 style="font-size:clamp(1.5rem,2.5vw + 0.75rem,2.25rem);font-weight:800;line-height:1.15;letter-spacing:-0.025em;margin:0 0 16px">1분 만에 내 셋업을 알려드립니다</h3>
    ...
  </div>
  <div style="text-align:center">
    <div style="font-family:var(--font-sans-en);font-size:6rem;...">64</div>
    ...
  </div>
</div>
```

**제안 DOM:**
```html
<div class="reveal hub-cta">
  <div class="hub-cta__body">
    <span class="hub-cta__eyebrow pill--accent-dark">★ 추천 · Find My Gear</span>
    <h3 class="hub-cta__title">1분 만에 내 셋업을 알려드립니다</h3>
    <p class="hub-cta__lead">...</p>
    <a href="find-my-gear.html" class="btn btn--accent btn--lg">1분 퀴즈 시작 →</a>
  </div>
  <div class="hub-cta__num">
    <div class="hub-cta__num-value num">64</div>
    <div class="hub-cta__num-label">시나리오</div>
    <div class="hub-cta__num-hint">4 레벨 × 4 체중 × 4 스타일</div>
  </div>
</div>
```

**CSS spec (`style.css` 의 컴포넌트 영역에 추가):**
```css
.hub-cta {
  background: linear-gradient(135deg, var(--color-navy), var(--color-sea-dark));
  border-radius: var(--radius-xl);
  padding: var(--space-12);
  color: var(--text-on-dark);
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: var(--space-12);
  align-items: center;
  margin-bottom: var(--space-16);
}
@media (max-width: 768px) {
  .hub-cta {
    grid-template-columns: 1fr;
    gap: var(--space-8);
    padding: var(--space-8);
  }
}
.hub-cta__eyebrow {
  display: inline-block;
  background: rgba(255, 184, 0, 0.18);
  color: var(--color-sun);
  font-size: var(--fs-xs);
  font-weight: var(--fw-700);
  padding: 6px 14px;
  border-radius: var(--radius-full);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: var(--space-4);
}
.hub-cta__title {
  font-size: clamp(1.5rem, 2.5vw + 0.75rem, 2.25rem);
  font-weight: var(--fw-800);
  line-height: 1.15;
  letter-spacing: -0.025em;
  margin: 0 0 var(--space-4);
}
.hub-cta__lead {
  font-size: var(--fs-md);
  line-height: 1.65;
  color: var(--text-on-dark-mute);
  margin: 0 0 var(--space-6);
  max-width: 48ch;
}
.hub-cta__num { text-align: center; }
.hub-cta__num-value {
  font-family: var(--font-sans-en);
  font-size: var(--fs-7xl);                    /* 96px → clamp 가능 */
  font-weight: var(--fw-900);
  line-height: 1;
  color: var(--color-sun);
  letter-spacing: -0.05em;
}
.hub-cta__num-label {
  font-size: var(--fs-sm);
  color: rgba(255, 255, 255, 0.6);
  margin-top: var(--space-2);
}
.hub-cta__num-hint {
  margin-top: var(--space-6);
  font-size: var(--fs-xs);
  color: rgba(255, 255, 255, 0.5);
}
```

**(B) Level grid 4 카드 (`index.html:404-424`)**

**현재**: 4 카드 각각 `style="..."` + `onmouseover`/`onmouseout` + level 별 pill background color 가 inline.

**제안 DOM:**
```html
<div class="grid-4cols level-grid"><!-- DO_NOT_REVERT §163: 4-col lock — modifier 로 보존 -->
  <a href="level/beginner.html" class="level-card level-card--beginner">
    <span class="level-card__pill">Beginner</span>
    <h4 class="level-card__title">입문·초급</h4>
    <p class="level-card__lead">첫 시즌·첫 셋업, beach launching과 first flight까지</p>
  </a>
  <a href="level/intermediate.html" class="level-card level-card--intermediate">...</a>
  <a href="level/advanced.html" class="level-card level-card--advanced">...</a>
  <a href="level/pro.html" class="level-card level-card--pro">...</a>
</div>
```

**CSS spec:**
```css
.level-grid {
  /* DO_NOT_REVERT §163 — 4-col lock 의도 보존 */
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
@media (max-width: 1024px) { .level-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px)  { .level-grid { grid-template-columns: 1fr; } }

.level-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: var(--space-6);
  display: block;
  color: var(--text-primary);
  transition: border-color var(--dur-fast) var(--ease),
              transform var(--dur-fast) var(--ease);
}
.level-card:hover {
  border-color: var(--color-sea);
  transform: translateY(-2px);
}
/* focus ring 은 Spec 1 의 :where() mixin 으로 자동 적용 */

.level-card__pill {
  display: inline-block;
  font-size: var(--fs-xs);
  font-weight: var(--fw-700);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}
.level-card--beginner     .level-card__pill { background: rgba(42, 140, 92, 0.10);  color: #2A8C5C; }
.level-card--intermediate .level-card__pill { background: rgba(31, 143, 255, 0.10); color: var(--color-sea-dark); }
.level-card--advanced     .level-card__pill { background: rgba(10, 37, 64, 0.08);   color: var(--color-navy); }
.level-card--pro          .level-card__pill { background: rgba(192, 48, 48, 0.10);  color: #C03030; }

.level-card__title {
  font-size: var(--fs-lg);
  font-weight: var(--fw-700);
  margin: 0 0 var(--space-2);
}
.level-card__lead {
  font-size: var(--fs-sm);
  color: var(--color-slate);
  line-height: 1.5;
  margin: 0;
}
```

**(C) Style grid 4 카드** — 동일 패턴으로 `.style-grid` + `.style-card` + `.style-card--{flat,choppy,wave,hybrid}` modifier. 색은 brand triplet (navy / sea / sun + 1) 또는 photographic 일관.

### 적용 위치

- `assets/css/style.css` — `/* Cards */` 또는 `/* Hub / Consultation */` 섹션에 spec 추가 (별도 `@layer components` 섹션 권장 — Frontend Engineer §3-4 layer 도입과 묶음)
- `index.html` — hub-cta · level-grid · style-grid 3 영역의 DOM 교체 (line 382-460 정도). inline style + onmouseover 모두 제거.
- 다른 페이지 (level/beginner.html 등) 도 같은 카드 패턴 쓰면 일관 적용.

### 검증

1. **시각 회귀** — Playwright `toHaveScreenshot()` 으로 변경 전후 픽셀 diff < 1%. (Hover 상태도 별도 capture.)
2. **A11y** — 키보드 Tab 으로 4 level 카드 순회 + Enter 로 navigate 동작.
3. **모바일** — 640px / 1024px breakpoint 에서 grid 가 1col / 2col 으로 전환.
4. **DO_NOT_REVERT §163 의도 보존** — 1280px+ desktop 에서 4-col 유지 확인.

### 협업

- **Frontend Engineer** — DOM + CSS 적용. `@layer components` 도입 시점이 자연.
- **UX Researcher** — 카드 hover/focus state 사용자 인지 검증.
- **Marketing & Social** — pill color (beginner=green / intermediate=sea / advanced=navy / pro=red) 의 brand 의미 확정. 현재 색은 inline 에서 가져온 값 그대로 — Marketing 이 4 level emotional code 합의 시 변경 가능.

### Risk & rollback

- **Risk 1**: `onmouseover` 가 단순 hover 외에 다른 JS 동작을 트리거할 경우 (현재는 단순 style 변경만 — 안전). grep 으로 `onmouseover|onmouseout` 사용처 점검.
- **Risk 2**: DO_NOT_REVERT §163 의 의도가 "4-col 항상" 인지 "데스크탑 4-col + 모바일 별도" 인지 모호 — Danny 확인.
- **Rollback**: DOM + CSS 두 commit 으로 분리. 시각 회귀 발견 시 CSS 만 revert 가능.

### Effort

4-8h. CSS 작성 2h · DOM 교체 1-2h · 시각 QA 1-2h · 도큐먼트 30m.

---

## Spec 4 — 아이콘 시스템 Lucide line icons 통일

### 동기

현재 inline SVG 가 trust-bar 체크 / nav cart / hero arrow / find-my-gear icons / dashboard icons 곳곳에 ad-hoc. 일부는 stroke 기반 (Lucide style) 일부는 fill 기반 (Material/heroicons style) 혼재. **한 가족 표준** 으로 통일하면 (1) 시각 일관성, (2) grep-replace 용이성, (3) 색 / 두께 / 사이즈 토큰화 가능.

### Change set

**Step 1 — 표준 spec 정의:**

| 속성 | 값 | 의도 |
|---|---|---|
| viewBox | 24 × 24 | Lucide / Heroicons / Material 표준 |
| stroke | currentColor | 텍스트 색 상속 |
| stroke-width | 2 | Lucide default |
| stroke-linecap | round | 부드러운 모서리 |
| stroke-linejoin | round | 부드러운 모서리 |
| fill | none (대부분) / currentColor (filled icon 만) | 외곽선 위주 |
| 사이즈 토큰 | `--icon-sm: 16px` / `--icon-md: 20px` / `--icon-lg: 24px` / `--icon-xl: 32px` | 컴포넌트 별 |

**Step 2 — 도입 방식 — 3 선택지 비교:**

| 방식 | 장점 | 단점 | 권장 |
|---|---|---|---|
| **A. Inline SVG (현재)** | 폰트색 상속·런타임 색 변화 즉시·CDN 의존 X | DOM 복잡·복사붙임 회귀 위험 | 현재 그대로 (Phase 2-A) |
| **B. CDN (`lucide-static` 또는 `lucide.dev`)** | 단순·자동 latest | 외부 의존성·icon 추가 시마다 추가 fetch | × (LCP 영향) |
| **C. SVG `<use>` sprite** | DOM 단순·캐시 효율·색 변화 가능 | 빌드 단계 필요 (sprite 생성) | ✅ (Phase 2-B framework 도입 시 자연) |

**Phase 2-A 권장 — Inline SVG 유지 + 표준 spec 적용:** 현재 inline SVG 가 이미 동작 중이고 LCP 영향 0. 다만 모든 inline SVG 를 위 spec 으로 통일 — viewBox 24×24 / stroke-width 2 / linecap round / linejoin round / fill none.

**Phase 2-B (framework 도입 시) — sprite 또는 component:** Astro `<Icon name="cart" />` 같은 component 로 통일.

**Step 3 — Migration 매핑 (대표 사례):**

| 위치 | 현재 | Phase 2-A 정정 |
|---|---|---|
| trust-bar 체크 (`index.html` 등) | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>` | ✅ 이미 spec 통과 — linecap/linejoin round 만 추가 |
| nav cart (`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...`) | spec 통과 — 사이즈 18 → `--icon-md` 토큰 사용 권장 | width/height 제거 + class `.icon icon--md` |
| hero arrow (btn 안) | `<svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>` | stroke-width 2 로 통일 (2.5 → 2) · `.icon icon--sm` |
| YouTube play icon (`hero__video-cta`) | `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>` | filled exception 유지 (play 는 filled 표준) — 단 fill 토큰화 |
| Lucide 의 trophy/timer/gauge/route (hero summary) | 이미 Lucide line icons | ✅ |
| Dashboard 의 toggle / play / close | 다양 | 일괄 audit + spec 통과 |

**Step 4 — 유틸리티 class:**

```css
.icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  /* SVG 자식이 stroke=currentColor 면 색은 부모 상속 */
}
.icon--sm { width: 16px; height: 16px; }
.icon--md { width: 20px; height: 20px; }
.icon--lg { width: 24px; height: 24px; }
.icon--xl { width: 32px; height: 32px; }
```

**Step 5 — 예외:** Brand logo (D mark, sport tile 의 4 브랜드 monogram L/P/T/W) 는 brand identity 라 spec 통과 안 함 — 별도 brand identity 자산. Document 명시.

### 적용 위치

- `assets/css/style.css` — `.icon` 유틸리티 추가 (Reset/Base 영역)
- 전 inline SVG — 작업자가 grep + manual normalize (`grep -rn "<svg" --include="*.html"`)
- `_experts/visual_designer_phase2_specs.md` 의 본 spec — 정책 기록

### 검증

1. **Grep audit** — `grep -rn "<svg" --include="*.html" | wc -l` 으로 총 inline SVG 개수 baseline → 모두 spec 통과 시 100%.
2. **Visual diff** — 모든 페이지 픽셀 diff. icon stroke 미세 변화 (2.5 → 2) 가 시각적 차이 있는지 검토 (대부분 0.5px 차이는 인지 안 됨).
3. **A11y** — `aria-hidden="true"` 가 장식 icon 에 적용 + `aria-label` 이 의미 있는 icon button 에 적용.

### 협업

- **Frontend Engineer** — Migration 실행. CDN 또는 sprite 선택은 Phase 2-B framework 도입과 함께 결정.
- **UX Researcher** — Icon 의 affordance 명확성 검토 (특히 close X / arrow → 같은 보편 icon).

### Risk & rollback

- **Risk 1**: stroke-width 2 → 2.5 인 icon 이 일부 위치에서 의도적으로 굵게 (예: hero arrow 강조). 일괄 변경 시 강조 잃음. → spec 표준은 2 이지만 modifier (`.icon--bold` { stroke-width: 2.5 }) 로 예외 보존.
- **Risk 2**: filled icon (play / star / heart) 을 outline 으로 잘못 변환. → spec 의 "fill: currentColor 예외 목록" 유지.
- **Rollback**: 페이지별 git revert 가능 (한 sweep 으로 묶지 않고 페이지별 commit).

### Effort

2-4h. spec 정의 + 유틸리티 30m · grep audit 30m · migration 1-2h (페이지별) · QA 30m.

---

## Spec 5 — OKLCH 보간 도입 (`RDChartTheme.statusAt` v2)

### 동기

`chart-theme.js:56-69` 의 `statusAt(g)` 가 sRGB 공간 linear interpolation. perceptually uniform 이 아니라서 5 앵커 사이 중간색 — 특히 mid #F2C20E (노랑) ↔ bad #EC8A2E (주황) — 가 약간 muddy. OKLCH 보간은 perceptually smooth 한 그라데이션을 만든다. **5 앵커 값 자체는 유지** (cultural prior 보존), 보간 알고리즘만 업그레이드. 시각 변화는 미세하지만 차트의 polish 수준이 올라간다.

### Change set

**Step 1 — Browser support 확인:**

- `color-mix(in oklch, ...)` — Chrome 111+ · Safari 16.4+ · Firefox 113+ (모든 최신 한국 시장 브라우저 지원).
- `oklch(L C H)` color function — 동일 지원 범위.
- **CSS-only OKLCH 보간**: `background: linear-gradient(in oklch, #1FA055, #7FC241, #F2C20E, #EC8A2E, #D6453A)` — 브라우저가 자동 OKLCH 보간. **단 우리는 JS 에서 색을 계산해 ctx.fillStyle 에 주입** 하므로 CSS-only 가 안 됨. JS 변환 필요.

**Step 2 — JS OKLCH 보간 함수 (chart-theme.js 에 추가):**

```js
/* sRGB hex → OKLCH (L, C, H) — 근사 변환.
   정밀 변환은 culori (BSD-3) 등 라이브러리 권장 — 16KB+. 우리는 5 앵커만 변환하면
   되므로 lookup table 로 충분. */
var STATUS_OKLCH = [
  [0.00, { L: 0.586, C: 0.20, H:  32 }],   /* #D6453A veryBad */
  [0.25, { L: 0.704, C: 0.17, H:  55 }],   /* #EC8A2E bad */
  [0.50, { L: 0.825, C: 0.18, H:  95 }],   /* #F2C20E mid */
  [0.75, { L: 0.751, C: 0.18, H: 132 }],   /* #7FC241 good */
  [1.00, { L: 0.605, C: 0.16, H: 145 }]    /* #1FA055 veryGood */
];

/* OKLCH → sRGB hex. 사용자 viewport 가 P3 widegamut 일 때는 자동 보정.
   구현은 css-color-4 알고리즘 — culori 의 oklchToRgb 또는 자체.
   여기서는 의사코드. */
function oklchToHex(L, C, H) { /* ... */ }

function statusAtV2(g) {
  g = clamp01(g);
  for (var i = 1; i < STATUS_OKLCH.length; i++) {
    if (g <= STATUS_OKLCH[i][0]) {
      var lo = STATUS_OKLCH[i - 1], hi = STATUS_OKLCH[i];
      var f = (g - lo[0]) / (hi[0] - lo[0] || 1);
      var L = lerp(lo[1].L, hi[1].L, f);
      var C = lerp(lo[1].C, hi[1].C, f);
      /* Hue 보간은 shortest-arc — H 가 360°wrap 가능, 우리는 32→145 라 직접 lerp OK */
      var H = lerp(lo[1].H, hi[1].H, f);
      return oklchToHex(L, C, H);
    }
  }
  return oklchToHex(STATUS_OKLCH[4][1].L, STATUS_OKLCH[4][1].C, STATUS_OKLCH[4][1].H);
}
```

**Step 3 — `oklchToHex` 구현 선택지:**

| 선택지 | 크기 | 정확도 | 권장 |
|---|---|---|---|
| culori 전체 import | ~30 KB | ★★★ | × bundle |
| culori subset (oklch/rgb 만) | ~6 KB | ★★★ | ✅ Phase 2-A |
| 자체 구현 (css-color-4 알고리즘) | ~2 KB | ★★ | Phase 2-B (테스트 충분 후) |
| `color-mix(in oklch, ...)` + CSS variable + getComputedStyle | 0 KB JS | ★★★ | △ — DOM round trip 필요, 차트 호출 빈도 높으면 성능 |

**Phase 2-A 권장 — culori subset** (6KB, well-tested).

**Step 4 — 호환성:**

`statusAt` 를 호출하는 모든 차트 코드 (Chart.js plugins · custom canvas violin/polar) 가 hex string 반환을 기대 — `statusAtV2` 도 동일 hex 반환. **API 변경 없음.** 즉 rename + drop-in replacement.

**Step 5 — Feature flag (점진 rollout):**

```js
var USE_OKLCH = global.RDChartTheme_FORCE_OKLCH ||
                /* default: Phase 2-A 시 true, 그 전엔 false */ false;
function statusAtCurrent(g) {
  return USE_OKLCH ? statusAtV2(g) : statusAtV1(g);
}
```

QA 동안 false → 실 사용자 viewport 에서 시각 정합성 검증 후 true.

### 적용 위치

- `riding-dashboard/js/chart-theme.js` — `statusAtV2` 함수 추가 + STATUS_OKLCH 테이블 + culori subset import
- `riding-dashboard/index.html` — culori 또는 sprite script 추가 (또는 chart-theme.js 자체에 bundle)
- 모든 차트 호출부 — 변경 없음 (drop-in)

### 검증

1. **Visual diff** — 16 차트 모두 픽셀 diff. mid ↔ bad 사이 보간색이 perceptually smooth 한지 확인 (특히 violin · histogram · polar 의 보간 영역).
2. **Performance** — `statusAt` 호출이 차트 한 번 render 당 수십~수백 회. 평균 < 0.1 ms / 호출 유지.
3. **Color accuracy** — 5 앵커 값 자체는 sRGB 와 OKLCH 두 알고리즘에서 동일 hex 반환 확인 (anchor 점은 보간 X).
4. **Wide gamut display** — P3 monitor 에서 sRGB clip 정확 (out-of-gamut → sRGB closest).

### 협업

- **DataViz Specialist** — chart-theme.js 코드 owner. Spec 합의 + culori import 결정 + Phase 2-A 시점 rollout.
- **Visual Designer** — 5 앵커 값 자체 유지 보증. 시각 검증 round.
- **Frontend Engineer** — bundle 사이즈 영향 평가 (riding-dashboard 페이지 +6KB).

### Risk & rollback

- **Risk 1**: 보간 중간색이 너무 saturated 또는 too-light 으로 보일 수 있음 (OKLCH 가 perceptually uniform 이라 sRGB lerp 의 muddy 함이 제거되지만 인지 차이는 사용자별). → A/B QA round.
- **Risk 2**: culori bundle 크기 6KB 가 riding-dashboard 초기 로드에 영향. → LTTB 다운샘플 (DataViz §3-4) 과 묶음으로 lazy load 가능.
- **Risk 3**: `oklch()` 미지원 brower (3% 이하 시장) 에서 fallback. → `statusAtV1` 자동 fallback (feature detect).
- **Rollback**: Feature flag false 로 즉시 v1 복귀.

### Effort

2-4h. STATUS_OKLCH 테이블 계산 30m · culori subset import + statusAtV2 1h · A/B QA round 1-2h · 도큐먼트 30m.

---

## 종합 — Phase 2-A 첫 sprint 권장 순서

| 순서 | Spec | Effort | 의존 | 협업 |
|---|---|---|---|---|
| 1 | **Spec 2** — color token canonical | 1-2h | 없음 | Frontend |
| 2 | **Spec 1** — focus ring 표준화 | 2-4h | Spec 2 의 `--ring-*` 토큰 추가 | Frontend + UX |
| 3 | **Spec 4** — 아이콘 시스템 (utility 추가만) | 2h (Phase 2-A 부분) | 없음 | Frontend |
| 4 | **Spec 3** — 인라인 스타일 추출 | 4-8h | Spec 1 의 focus ring 적용 시 자동 통과 | Frontend + UX + Marketing |
| 5 | **Spec 5** — OKLCH 보간 (DataViz dispatch 후) | 2-4h | DataViz 동의 | DataViz + Visual |

**Phase 2-A 첫 sprint 합산 11-22 시간** ≈ 1.5-3 일. 한 sprint 에 다 끝내고 시각 회귀 0 확인.

**Phase 2-B 후속 후보** (이 spec 범위 외, 별도 dispatch):

6. Brand monogram color 4 토큰 (`--brand-levitaz` 등) — Marketing 합의 후.
7. Trust-bar source-of-truth 통일 — UX + Frontend 협업.
8. `@layer` cascade 도입 — Frontend Engineer §3-4.
9. Spring motion sweep — hero stagger + brand card lift.
10. Dark mode token system — Phase 3.

---

_Last updated: 2026-05-31_
_Phase 2 implementation-ready specs — Frontend / DataViz 가 dispatch 후 즉시 작업 가능._
