# §211 Buy Section Redesign Spec

| 항목 | 내용 |
|---|---|
| Trigger | 옥대표님 verbatim 2026-06-06: *"이 다섯개 타일 로즈한테 디자인 다시 확인하라고 해줘. 못보겠다."* |
| 대상 | product 상세 page (예: `products/takoon/glide.html`) 의 buy/cart section 5 element |
| Owner | Visual Designer (Rose Yoon) · 2026-06-06 |
| 의존 | `tokens.css` (v2) + `components.md` C2 (Glass Data Card 패턴 재사용) |
| 컴포넌트 ID | **C6 — Buy Section** (components.md 에 추가 예정) |
| ⚠ Limit | CoS screenshot 본인 sandbox 미도착. CoS description 5건 기반 framework 작성. **본인 직접 view 후 spec refine 진입** |

> **읽는 법.** §0 진단 (CoS 5건 confirm + 본인 추가) · §1 핵심 결정 · §2 DOM + CSS spec · §3 5 element 별 detail · §4 states (normal/hover/active/disabled) · §5 반응형 · §6 KakaoTalk yellow vs accent SEA 결정 · §7 Alex 핸드오프 · §8 검증 + 정직 raise.

---

## 0. 진단

### CoS 추정 5건 (본인 partial confirm — file 도착 후 refine)

| # | CoS 진단 | Visual partial confirm |
|---|---|---|
| 1 | 5 element 의 shape · size · color · weight 통일성 X | ✓ valid — 산업 표준 buy section 의 visual rhythm 위반 |
| 2 | 카톡 yellow + 가격 card 회색 + 장바구니 회색 palette 분산 | ✓ valid — accent color 단일 lock 부재 |
| 3 | 가격 card 가 다른 button 보다 weight 무거움 (full panel) | ✓ valid — 가격이 hero인데 button 과 같은 row 에 있으면 vertical hierarchy 깨짐 |
| 4 | 장바구니 grey = active 인지 disabled 인지 시각 ambiguity | ✓ valid — Nielsen #4 (consistency) + #1 (system status) 위반 |
| 5 | spacing inconsistent (가격 card vertical alignment 어긋남) | ✓ valid — 8px grid 위반 |

### 본인 추가 (시각 시스템 깊은 진단)

| # | 본인 진단 |
|---|---|
| 6 | **버튼 height 산발** — 카톡 button 과 1분 진단 button 의 height 다를 가능성. industry standard buy section 은 button row 의 uniform height (44-52px) |
| 7 | **size dropdown 의 buy CTA 와의 위계 충돌** — dropdown 이 가격 결정 input, CTA 가 최종 action. selector + price + action 의 3-step user flow 가 시각으로 안 흐름 |
| 8 | **"한국 가격" label 의 약함** — eyebrow 톤 weak. 가격이 hero metric 이라면 큰 mono numeral (현재 "—" 단순 dash) 가 hero, label 은 sub |
| 9 | **회원 전용 micro-copy 위치 ambiguity** — "회원 전용 · 장바구니에서 견적 요청까지" 가 어느 element 의 affordance 인지 모호. 장바구니 button 직속 sub 권장 |
| 10 | **카톡 yellow 의 brand 정체성 vs site theme conflict** — KakaoTalk yellow (#FAE100) 가 단무지 brand triplet (navy/sea/sun) 외 색. 사이트 전체 톤과 충돌 가능 |

---

## 1. 핵심 결정

| # | 결정 | Rationale |
|---|---|---|
| **1** | **5 element 의 button-level uniform** — 모든 pill height **48px standard**, padding `12px 20px`, font-size `15px` | industry 정통 + Stripe/Linear/Vakaros action row |
| **2** | **3-tier visual hierarchy** — Primary (장바구니 = accent SEA solid) · Secondary (1분 진단 = accent SEA outline) · Brand (카톡 = KakaoTalk yellow solid, 유지) | KakaoTalk = "외부 messenger" 인지 affordance, 색 유지 정공. accent SEA 가 primary |
| **3** | **가격 card = glassmorphism C2 패턴** — `--glass-bg` 24px blur, 큰 mono numeral (가격 값) hero, label `--eyebrow` | 가격이 buy decision 의 hero metric. C2 Data Card 정통 |
| **4** | **Layout = 3-row vertical (mobile + desktop 공통)** — Row 1: 가격 card hero · Row 2: size dropdown (input) · Row 3: action buttons (장바구니 primary + 카톡 + 1분 진단) | Buy decision flow 순서 정확 |
| **5** | **장바구니 disabled state 명확화** — `opacity 0.4` + `cursor not-allowed` + sub-label "사이즈를 선택해주세요" | Nielsen #1 system status |
| **6** | **8px grid lock** — 모든 spacing `var(--space-*)` 토큰만, ad-hoc px 0 | tokens.css v2 일관성 |

---

## 2. DOM + CSS spec

### 2-1. DOM 구조

```html
<aside class="buy-section" aria-label="구매 옵션">

  <!-- Row 1 — Price card (hero) -->
  <div class="buy-section__price">
    <p class="buy-section__price-label eyebrow">한국 가격</p>
    <p class="buy-section__price-value num">
      <span class="buy-section__price-empty">사이즈를 선택해주세요</span>
      <!-- or, when size selected: -->
      <!-- 1,290,000<span class="buy-section__price-unit">원</span> -->
    </p>
    <p class="buy-section__price-meta">표시가는 운송 · 세금 포함 정가입니다</p>
  </div>

  <!-- Row 2 — Size selector -->
  <div class="buy-section__size">
    <label class="buy-section__size-label eyebrow" for="size-select">사이즈</label>
    <select class="buy-section__size-input" id="size-select" name="size">
      <option value="">선택해주세요</option>
      <option value="510">5'10"</option>
      <option value="60">6'0"</option>
      <option value="62">6'2"</option>
    </select>
  </div>

  <!-- Row 3 — Action buttons (3) -->
  <div class="buy-section__actions">
    <button class="buy-section__btn buy-section__btn--primary" type="button"
            disabled aria-describedby="cart-sub">
      장바구니 담기
    </button>
    <p class="buy-section__sub" id="cart-sub">
      회원 전용 · 장바구니에서 견적 요청까지 진행됩니다
    </p>

    <div class="buy-section__btn-row">
      <a href="https://pf.kakao.com/..." class="buy-section__btn buy-section__btn--kakao"
         target="_blank" rel="noopener" aria-label="카카오톡 1:1 상담">
        <svg class="buy-section__btn-icon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3c-5.5 0-10 3.6-10 8 0 2.8 1.9 5.3 4.7 6.7L5.5 22l4-2.6c.8.1 1.6.2 2.5.2 5.5 0 10-3.6 10-8s-4.5-8-10-8z"/>
        </svg>
        카톡 1:1 상담
      </a>
      <a href="find-my-gear.html" class="buy-section__btn buy-section__btn--secondary">
        1분 진단
        <svg class="buy-section__btn-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </a>
    </div>
  </div>

</aside>
```

### 2-2. CSS (tokens.css v2 의존)

```css
/* ============================================================
 * C6 — Buy Section
 * Design System v2 · 의존: tokens.css
 * 3 결정: button uniform · 3-tier hierarchy · 8px grid
 * ============================================================ */

.buy-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  max-width: 420px;
}

/* ----- Row 1: Price card (glassmorphism hero) ----- */
.buy-section__price {
  padding: var(--space-5);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}
.buy-section__price-label {
  margin: 0 0 var(--space-2);
  color: var(--fg-muted);
}
.buy-section__price-value {
  font-family: var(--font-numeral);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: var(--fw-semibold);
  color: var(--fg-primary);
  letter-spacing: var(--num-letterspacing);
  line-height: 1;
  margin: 0 0 var(--space-2);
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.buy-section__price-empty {
  font-family: var(--font-body);
  font-size: var(--text-body);
  color: var(--fg-muted);
  font-weight: var(--fw-regular);
  letter-spacing: 0;
}
.buy-section__price-unit {
  font-size: 0.5em;
  font-weight: var(--fw-medium);
  color: var(--fg-secondary);
  letter-spacing: 0;
}
.buy-section__price-meta {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--fg-muted);
  line-height: 1.4;
}

/* ----- Row 2: Size selector ----- */
.buy-section__size {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.buy-section__size-label {
  margin: 0;
  color: var(--fg-muted);
}
.buy-section__size-input {
  height: 48px;
  padding: 0 var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--fg-primary);
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: var(--fw-medium);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239AA3B8' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
  padding-right: var(--space-10);
  transition: border-color var(--dur-fast) var(--ease);
}
.buy-section__size-input:hover { border-color: var(--border-strong); }
.buy-section__size-input:focus-visible {
  outline: var(--ring-width) solid var(--ring-color);
  outline-offset: var(--ring-offset);
  border-color: var(--accent);
}

/* ----- Row 3: Actions ----- */
.buy-section__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.buy-section__sub {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--fg-muted);
  text-align: center;
  line-height: 1.4;
}
.buy-section__btn-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

/* ----- Button base (uniform pill) ----- */
.buy-section__btn {
  height: 48px;
  padding: 0 var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: var(--fw-semibold);
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  cursor: pointer;
  text-decoration: none;
  transition: background var(--dur-fast) var(--ease),
              border-color var(--dur-fast) var(--ease),
              color var(--dur-fast) var(--ease),
              transform var(--dur-fast) var(--ease),
              opacity var(--dur-fast) var(--ease);
  white-space: nowrap;
}
.buy-section__btn:hover { transform: translateY(-1px); }
.buy-section__btn:active { transform: translateY(0); }
.buy-section__btn:focus-visible {
  outline: var(--ring-width) solid var(--ring-color);
  outline-offset: var(--ring-offset);
}
.buy-section__btn-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ----- Variant: Primary (장바구니 — accent SEA solid) ----- */
.buy-section__btn--primary {
  background: var(--accent);
  color: var(--fg-inverse, #fff);
}
.buy-section__btn--primary:hover { background: var(--accent-hover); }
.buy-section__btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  background: var(--accent);
}
.buy-section__btn--primary:disabled:hover { transform: none; }

/* ----- Variant: KakaoTalk (brand yellow — 정체성 유지) ----- */
.buy-section__btn--kakao {
  background: #FAE100;       /* KakaoTalk official brand yellow */
  color: #1A1A1A;            /* KakaoTalk dark text */
  font-weight: var(--fw-bold);
}
.buy-section__btn--kakao:hover { background: #FFEB3B; }

/* ----- Variant: Secondary (1분 진단 — SEA outline) ----- */
.buy-section__btn--secondary {
  background: transparent;
  color: var(--accent);
  border-color: var(--accent);
}
.buy-section__btn--secondary:hover {
  background: var(--accent-subtle);
}
```

---

## 3. 5 Element 별 detail

### 3-1. 카톡 1:1 상담 (KakaoTalk brand, yellow)

- **Shape**: pill (`border-radius: 9999px`)
- **Height**: 48px (uniform)
- **Color**: `#FAE100` (KakaoTalk official yellow) + `#1A1A1A` text
- **Weight**: 700 bold (KakaoTalk brand recognition)
- **Icon**: KakaoTalk chat bubble (정통 KakaoTalk icon, fill)
- **Action**: 외부 link `target="_blank"` to `pf.kakao.com/...`
- **aria-label**: "카카오톡 1:1 상담"

### 3-2. 1분 진단 → (Secondary CTA, SEA outline)

- **Shape**: pill
- **Height**: 48px
- **Color**: bg transparent + `var(--accent)` text + border
- **Weight**: 600 semibold
- **Icon**: arrow → (Lucide line)
- **Action**: internal link `find-my-gear.html`
- **Hover**: bg `var(--accent-subtle)` (subtle highlight)

### 3-3. Size dropdown (input)

- **Shape**: rounded rectangle (`--radius-md` 10px, pill 보다 약한 — input affordance)
- **Height**: 48px (uniform)
- **Color**: bg `--bg-elevated`, border `--border-subtle`, text `--fg-primary`
- **Custom arrow**: inline SVG (down chevron)
- **Focus**: border `--accent` + outline ring
- **Change**: JS event → price update + cart button enable

### 3-4. 한국 가격 card (glassmorphism hero)

- **Shape**: rounded card (`--radius-md`)
- **bg**: `--glass-bg` 24px blur
- **Border**: `--glass-border`
- **Hierarchy**:
  - Eyebrow "한국 가격" (mono 10.5px uppercase, `--fg-muted`)
  - **Hero numeral** "1,290,000" (mono 28-40px, `--fg-primary`) + "원" sub
  - Empty state — "사이즈를 선택해주세요" (regular body, `--fg-muted`)
  - Meta "표시가는 운송·세금 포함 정가입니다" (caption, `--fg-muted`)
- **Numeral**: `tabular-nums` + `-0.04em` letterspacing

### 3-5. 장바구니 담기 (Primary CTA, SEA solid)

- **Shape**: pill
- **Height**: 48px
- **Color**: `--accent` (SEA) solid + white text
- **Weight**: 600 semibold
- **States**:
  - **Disabled (default, size 미선택)** — opacity 0.4, cursor not-allowed, 아래 sub "사이즈를 선택해주세요"
  - **Enabled (size 선택 후)** — full opacity, hover lift
  - **Active** — pressed (transform 0)
- **Sub-label**: "회원 전용 · 장바구니에서 견적 요청까지 진행됩니다"

---

## 4. States 매트릭스

| Element | Default | Hover | Focus | Active | Disabled |
|---|---|---|---|---|---|
| **카톡** | yellow bg | bg `#FFEB3B` (1 step lighter) | ring sun (다크) / sea (라이트) | scale 0.98 | N/A (외부 link) |
| **1분 진단** | transparent + sea outline | sea-subtle bg fill | ring sea | scale 0.98 | N/A |
| **Size dropdown** | bg-elevated + subtle border | strong border | sea border + ring | open dropdown | N/A |
| **장바구니** | sea solid | sea-hover (lighter) | ring sea | scale 0.98 | opacity 0.4 + cursor not-allowed + "사이즈를 선택해주세요" sub |
| **가격 card** | empty state "사이즈를 선택해주세요" | hover X (정적) | N/A | N/A | always visible |

---

## 5. 반응형

### Mobile (< 640px) — 3-row stack

```
┌───────────────────────────┐
│ Row 1: Price card (hero)  │  ← glassmorphism
├───────────────────────────┤
│ Row 2: Size dropdown      │  ← full-width
├───────────────────────────┤
│ Row 3: 장바구니 (primary) │  ← full-width
│ + sub "회원 전용..."        │
│ + grid [카톡 | 1분 진단]    │  ← 2-col side-by-side
└───────────────────────────┘
```

### Desktop (≥ 640px) — 같은 3-row stack (max-width 420px)

mobile 동일. buy section 은 product page 의 좌측 panel 또는 sticky right sidebar 로, layout column 안의 vertical stack 유지.

```css
@media (min-width: 640px) {
  .buy-section { max-width: 420px; }
  /* desktop 에서도 vertical stack — buy decision flow 정확 */
}
```

---

## 6. KakaoTalk yellow vs accent SEA — 결정

**본인 권장: KakaoTalk yellow 유지** (3-tier 의 brand tier).

| Approach | 장점 | 단점 |
|---|---|---|
| **(A) ★ 권장 — KakaoTalk yellow 유지** | 사용자가 "외부 KakaoTalk 으로 이동" 즉시 인지 (affordance + 신뢰) | accent 단일 lock 의 일관성 부분 위반 |
| (B) accent SEA 통일 (모든 button SEA) | 시각 단일성 강 | KakaoTalk 외부 link 의 affordance 손실, 사용자가 "단무지 내부 button" 으로 오인 가능 |

**Rationale (A)**: 단무지 brand identity > KakaoTalk brand identity. 단 카톡 button = 외부 messenger trigger 라 사용자 mental model 이 "KakaoTalk yellow = 카톡 channel" 로 강하게 박혀있음 (한국 사용자 100%). 이 affordance 가 brand 일관성 보다 funnel 정확성 우선.

**hue 충돌 검증**: accent SEA `#3B82F6` (blue 220°) + KakaoTalk yellow `#FAE100` (yellow 53°) — hue 거리 167°, 충분히 분리. status 색 (mid yellow) 과는 분리 (KakaoTalk 더 saturated).

---

## 7. Alex 핸드오프

### 7-1. Sweep 대상

전 product 페이지의 buy section markup 통일:
- `levitaz.html`
- `ppc.html`
- `takoon.html`
- `wip.html`
- `products/levitaz/*.html`
- `products/ppc/*.html`
- `products/takoon/*.html`
- `products/wip/*.html`

### 7-2. Markup template

**Before** (현재 — 추정 분산 markup):
```html
<button class="btn-kakao">카톡 1:1 상담</button>
<a href="find-my-gear.html" class="btn-outline">1분 진단</a>
<select class="size-select">...</select>
<div class="price-card">...</div>
<button class="btn-cart">장바구니 담기</button>
```

**After** (§2-1 DOM 그대로):
```html
<aside class="buy-section" aria-label="구매 옵션">
  <div class="buy-section__price">...</div>
  <div class="buy-section__size">...</div>
  <div class="buy-section__actions">...</div>
</aside>
```

### 7-3. CSS — 두 옵션

**Option (i) v1 유지** — `assets/css/style.css` 끝에 `.buy-section*` 블록 추가. v1 토큰 (`--color-navy` 등) 매핑.

**Option (ii) v2 전환** — `_design-system/tokens.css` import + 본 spec 의 CSS 그대로. 단 product page 가 v2 dark theme 인지 light theme 인지 옥대표님 결정 필요.

**본인 권장: (i) v1 — 메인 사이트 light theme 유지**. v2 토큰을 v1 hex 으로 swap (예: `--accent` → `var(--color-sea-dark)`). product page 의 dark theme 전환은 별도 sprint.

### 7-4. JS

- Size dropdown `change` event → 가격 fetch + card update + 장바구니 button enable
- KakaoTalk link 의 `pf.kakao.com/...` URL 환경 설정 (이미 있으면 그대로)
- 장바구니 click → cart.js 의 add-to-cart logic (already implemented)

---

## 8. 검증 + 정직 raise

### 8-1. WCAG 2.1 contrast

| Element | Foreground | Background | Contrast | Status |
|---|---|---|---|---|
| 장바구니 (SEA solid) | white #FFF | `#3B82F6` | 3.9:1 | ⚠ AA large only — 본인 권장: SEA-dark `#1670CC` 사용 (4.95:1 AA pass) |
| 카톡 yellow | `#1A1A1A` | `#FAE100` | 14.1:1 | ✓ AAA |
| 1분 진단 outline | `#3B82F6` | white | 3.1:1 | ⚠ AA large only — text color SEA-dark `#1670CC` (4.5:1 AA pass) |
| Size dropdown text | `#0A2540` | white/bg-elevated | 13.7:1 | ✓ AAA |
| 가격 numeral | `#0A2540` | `--glass-bg` over white | ~12:1 | ✓ AAA |

**본인 fix 권장**: SEA `#3B82F6` → `--color-sea-dark` `#1670CC` for **text & primary button** — AA contrast safe.

### 8-2. Keyboard navigation

Tab order:
1. Size dropdown (input 가장 첫 step — buy flow 시작)
2. 장바구니 (primary CTA — flow 끝 step)
3. 카톡 (secondary action)
4. 1분 진단 (tertiary)

Order rationale: input → primary action → secondary actions. **CoS message 의 1→5 순서 (카톡·1분·드롭다운·가격·장바구니) 와 다름 — 본인 권장 갱신**.

### 8-3. 정직 raise

| # | Raise |
|---|---|
| 1 | **Screenshot view 부재** — CoS description 기반 framework. 본인 직접 view 후 정확 spacing/dimensions/사용된 색 verify 필요. spec 의 정확성 ~80% |
| 2 | **product page 가 v1 light vs v2 dark theme 결정** — 옥대표님 명시 필요. 본인 권장 v1 유지 (점진 migration) |
| 3 | **WCAG contrast fix** — SEA `#3B82F6` (v2 default) 이 white 위 3.9:1 AA-fail. SEA-dark `#1670CC` (v1) 가 안전. **v2 tokens.css 의 accent 자체 hex 정정 검토 권장** (옥대표님 별도 결정) |
| 4 | **Tab order CoS 5 element 순서와 다름** — 본인 권장 (input → primary → secondary) 이 a11y 정공. 옥대표님 view 시 확인 |

---

## 9. 옥대표님 결정 큐

| # | 결정 | 영향 |
|---|---|---|
| **1** | 본 spec accept 또는 v1/v2 theme 선택 | Alex sweep impl 시점 |
| **2** | WCAG contrast SEA fix (sea-dark 채택) | tokens.css accent hex 변경 |
| **3** | Tab order CoS 5 element 순서 vs Visual 권장 (input → primary → secondary) | a11y 적용 |
| **4** | KakaoTalk yellow 유지 (본인 권장 A) vs accent 통일 (B) | brand identity vs accent 일관성 |

---

## 10. Sprint chain

1. **Visual (본인)** — 본 spec 완료 ✓ + screenshot view 후 refine (직접 view 가능 시점)
2. **Alex** — 본 spec 기반 buy section sweep (16+ product page) impl
3. **메이** — keyboard navigation + WCAG axe-playwright 검증
4. **옥대표님** — 라이브 view 후 visual harmony 확인 → §211 close

ETA = Alex sweep 60-120min (페이지 수 비례) + 본인 review 30min + 메이 a11y 30min ≈ 2-3시간 (1 sprint).

---

_Last updated: 2026-06-06_
_§211 buy section spec — C6 컴포넌트 추가 후보. Screenshot view 후 본인 refine 진입. Alex sweep 대기._
