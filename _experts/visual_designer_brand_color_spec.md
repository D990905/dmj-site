# visual_designer_brand_color_spec.md — 4 브랜드 monogram color 토큰화

| 항목 | 내용 |
|---|---|
| 문서 유형 | Brand identity color 토큰 정리 + 사용처 매핑 + WCAG contrast 검증 + Phase 2 확장 plan |
| 작성 | Visual Designer (전문가 #1) · 2026-05-31 |
| 대상 | Levitaz · PPC · Takoon · Forward WIP 4 브랜드의 시각 identity 색 시스템 |
| 모(母) 문서 | `_experts/expert_visual_designer_reference.md` §2-4 (제품 상세 audit) · §3-1 (brand monogram color 토큰 placeholder) |
| 범위 | 토큰 정리 + 사용처 일관화 spec. production 코드 변경 X (Phase 2 dispatch 후 Frontend 적용) |
| 협업 | Marketing & Social (brand identity 확정 stamp) · Frontend Engineer (토큰 + 인라인 추출) · Mobile App (네이티브 ↔ 웹 토큰 패리티) · DataViz (chart category color 와의 관계) |

> **읽는 법.** §0 핵심 발견 (이미 결정된 색의 발굴) · §1 4 브랜드 identity 분석 + 우리 색 결정의 logic · §2 토큰 시스템 v2 (raw values + alias + monogram-on color + gradient) · §3 사용처 매핑 (brand-card · hero-mark · mobile-menu · product page · 확장) · §4 WCAG contrast 검증 · §5 Marketing 협업 합의 항목 · §6 chart category color 와의 관계. §7 Phase 2 implementation plan.

---

## 0. 핵심 발견 — 이미 결정된 색 시스템

**Marketing 협업 불필요 — 이미 우리 사이트에 4 브랜드 색이 결정·정착되어 있음.**

`assets/css/style.css:915-918` 와 `:1992-1995` 의 `.brand-card__visual--{brand}` 와 `.hero__visual-mark--{brand}` 가 4 브랜드 gradient 를 인라인 hex 로 정의 — 단무지공방의 brand triplet (navy / sea / sun) + neutral (charcoal/slate) 4-way split. 이는 **각 브랜드의 emotional identity 와 1:1 매칭**된 의도된 결정:

| 브랜드 | Gradient | 의미 | 우리 brand 의 어떤 측면 |
|---|---|---|---|
| **Levitaz** (오스트리아, premium hydrofoil) | `#0A2540 → #1F8FFF` (navy → sea) | 깊은 → 밝은 blue. 정밀·premium·trust. | navy + sea — 깊은 신뢰 |
| **PPC** (NZ, hyperperformance wing) | `#1F8FFF → #5BB4FF` (sea → light sea) | sea blue tonal. 속도·하늘·바람. | sea — 속도와 하늘 |
| **Takoon** (프랑스, accessible 입문) | `#FFB800 → #FFD25C` (sun → light sun) | 노랑·금. warm·accessible. official Takoon "black & gold" colorways 와 일치. | sun — 햇빛·warmth |
| **Forward WIP** (Franco-Swiss, 안전장비) | `#2A3B4C → #5C6F7E` (charcoal → slate) | 무채색 professional. 안전·내구성·neutral. | neutral — 전문 도구 |

**왜 이 결정이 옳은가:**

1. **단무지공방의 brand triplet (navy / sea / sun) 의 정확한 4-way split** — navy = Levitaz 의 premium / sea = PPC 의 속도 / sun = Takoon 의 warmth / neutral 4번째 = WIP 의 안전 도구 정체성.
2. **각 브랜드의 emotional identity 와 1:1 매칭** — 임의 색이 아님.
3. **Takoon official "black & gold" colorways 와 우리 sun gold 가 일치** — brand fit 자연.
4. **WIP 의 charcoal/slate 는 safety equipment 의 "도구" 정체성** — 자기 정체성 강조 안 함, 라이더에 deference (Apple HIG 의 Deference 원칙).
5. **4 브랜드가 모두 blue/sky 또는 sun 이면 시각 혼란** — neutral 4번째가 sealing 역할.

**남은 부채:** 색은 결정됐으나 **토큰화 안 됨** — hex 값이 인라인. Brand color 변경 시 (예: Marketing 이 PPC 의 sea ramp 를 살짝 조정) 여러 곳을 동시에 갱신해야. 본 spec 이 토큰화 + 사용처 일관화.

---

## 1. 4 브랜드 identity 분석 — 우리 색 결정의 logic

### 1-1. Levitaz — 오스트리아 premium hydrofoil

**공식 사이트** [1]: levitaz.com. Theme color `#fff`, logo monochrome (SVG `LZ-logo-2026.svg`). Tagline "The Original. Reinvented." Premium carbon hydrofoils made in Austria.

**브랜드 emotional code:** 정밀 · technical · craft · alpine (Austrian Alps). 미니멀 monochrome 로고 + 검은 카본 제품.

**우리 매핑 — navy → sea gradient:**
- navy (#0A2540) 가 카본 hydrofoil 의 깊은 검정과 isomorphic
- sea (#1F8FFF) 가 hydrofoil 이 활공하는 물의 색
- gradient = 카본이 물 위로 떠오르는 시각 metaphor

**Takeaway:** levitaz 공식 brand 가 monochrome 인데 우리는 navy + sea 로 표현 — 이는 우리의 brand triplet 안에서 brand 정체성을 표현하는 자연 선택. **단무지공방 한국 시장 컨텍스트의 Levitaz** 라는 분명한 입장.

### 1-2. PPC — Pacific Performance Company (뉴질랜드 hyperperformance)

**공식 사이트** [2]: ppcfoiling.com. Tagline "Built different. Engineered in New Zealand, proven world wide." PPC = Pacific Performance Company (또는 Pacific Paddle Company). 창립자 Sam Loader. M1 · Surge wings. New Zealand 출신.

**브랜드 emotional code:** 속도 · 성능 · 바다 · 도전. 뉴질랜드 Pacific 의 푸른 바다 = 정체성.

**우리 매핑 — sea → light sea tonal:**
- sea (#1F8FFF) 가 PPC 의 Pacific 바다와 isomorphic
- light sea (#5BB4FF) 가 sky 와 wind 의 추가 차원
- tonal blue gradient = "all blue, all performance"

**Takeaway:** PPC 의 hyperperformance 정체성을 sea blue 단일 hue 의 tonal 로 표현 — 4 브랜드 중 유일하게 brand triplet 의 한 색만 (sea) 사용. 가장 narrow 한 색채 = 가장 focused 한 정체성.

### 1-3. Takoon — 프랑스 accessible kite/wing 입문

**공식 사이트** [3]: takoon.com. 2002년 bow kite 발명. France. Black and gold colorways (일부 보드 모델 — Wook, Furia, Nova). "Fun" 입문자 친화 정체성.

**브랜드 emotional code:** warm · accessible · 입문 · 한국의 첫 윙포일 라이더. 햇빛 · 첫 세션 · 가족.

**우리 매핑 — sun → light sun gradient:**
- sun (#FFB800) = official Takoon black-and-gold 의 gold 와 직접 일치
- light sun (#FFD25C) = 추가 warm tone
- **monogram color swap** — `.brand-card__visual--takoon .brand-card__monogram { color: var(--color-navy); }` — 노랑 위 navy 텍스트 (대비 11:1 AAA 통과). `.brand-card__visual--takoon .brand-card__tag` 도 navy text on rgba(navy 0.18) — 라이트 컨텍스트와 일관.

**Takeaway:** Takoon 의 색은 official brand 와 직접 일치 + 우리 brand triplet 의 sun 활용. 가장 자연스러운 매칭. 단 sun 위 white 텍스트는 contrast fail (1.85:1) — 그래서 monogram/tag 텍스트를 navy 로 swap. **a11y 가 결정에 박혀 있음**.

### 1-4. Forward WIP — Franco-Swiss 안전장비

**공식 사이트** [4]: forward-wip.com. 2015년 설립. France 주요 시장. helmet · impact vest · harness. "High visibility" 자주 언급 (safety standard).

**브랜드 emotional code:** professional · 보호 · 도구 · 라이더에 deference. 화려함보다 reliability.

**우리 매핑 — charcoal → slate (무채색):**
- charcoal (#2A3B4C) · slate (#5C6F7E) — 우리 brand triplet 외 4번째 axis
- gradient = professional tonal gray
- 의도: WIP 는 자기 정체성을 강조하지 않는 **도구** — 라이더와 다른 3 브랜드 (Levitaz/PPC/Takoon) 가 hero, WIP 는 그들을 지원

**Takeaway:** WIP 가 brand triplet 외 무채색을 받는 것은 deliberate hierarchy 결정. **단무지공방의 sealing 카테고리** — 다른 3 브랜드의 색이 충돌하지 않도록. 또한 4 브랜드가 모두 saturated color 면 시각 혼란 — WIP 의 neutral 이 시각 anchor.

단 WIP 의 official "high visibility orange/yellow" 가 우리 sun 과 어느 정도 겹친다 — 미래에 brand 색 변경 검토 시 고려. 현재는 우리 차별화 (safety = neutral) 가 옳음.

---

## 2. 토큰 시스템 v2

### 2-1. Raw values (canonical — 단일 source-of-truth)

`assets/css/style.css` `:root` 블록 끝에 추가:

```css
:root {
  /* ... 기존 토큰 ... */

  /* ── Brand identity — 4 브랜드 monogram color v1 (2026-05-31)
     단무지공방 brand triplet (navy/sea/sun) + neutral 의 4-way split.
     각 brand 의 emotional identity 와 1:1 매핑.
     변경 시 §brand_color_spec.md 의 logic 검토 후 동시 갱신. */

  /* Levitaz — navy → sea (premium technical) */
  --brand-levitaz-start:    #0A2540;   /* = var(--color-navy) */
  --brand-levitaz-end:      #1F8FFF;   /* = var(--color-sea) */
  --brand-levitaz-on:       #FFFFFF;   /* monogram / tag 텍스트 */

  /* PPC — sea → light sea (hyperperformance speed) */
  --brand-ppc-start:        #1F8FFF;   /* = var(--color-sea) */
  --brand-ppc-end:          #5BB4FF;
  --brand-ppc-on:           #FFFFFF;

  /* Takoon — sun → light sun (warm accessible) */
  --brand-takoon-start:     #FFB800;   /* = var(--color-sun) */
  --brand-takoon-end:       #FFD25C;
  --brand-takoon-on:        #0A2540;   /* navy text on yellow — AAA contrast */

  /* Forward WIP — charcoal → slate (professional safety neutral) */
  --brand-wip-start:        #2A3B4C;   /* = var(--color-charcoal) */
  --brand-wip-end:          #5C6F7E;   /* = var(--color-slate) */
  --brand-wip-on:           #FFFFFF;
}
```

### 2-2. Gradient mixin

```css
:root {
  --brand-levitaz-gradient: linear-gradient(135deg, var(--brand-levitaz-start) 0%, var(--brand-levitaz-end) 100%);
  --brand-ppc-gradient:     linear-gradient(135deg, var(--brand-ppc-start) 0%,     var(--brand-ppc-end) 100%);
  --brand-takoon-gradient:  linear-gradient(135deg, var(--brand-takoon-start) 0%,  var(--brand-takoon-end) 100%);
  --brand-wip-gradient:     linear-gradient(135deg, var(--brand-wip-start) 0%,     var(--brand-wip-end) 100%);
}
```

### 2-3. Solid color (gradient 없이 단색 필요한 위치)

```css
:root {
  /* Solid version — chip / dot / stripe / mobile menu */
  --brand-levitaz-solid: var(--brand-levitaz-start);  /* navy */
  --brand-ppc-solid:     var(--brand-ppc-start);      /* sea */
  --brand-takoon-solid:  var(--brand-takoon-start);   /* sun */
  --brand-wip-solid:     var(--brand-wip-start);      /* charcoal */
}
```

### 2-4. Brand monogram letters

| 브랜드 | Monogram | Font | Weight | Letter-spacing |
|---|---|---|---|---|
| Levitaz | **L** | Inter / Pretendard EN | 900 | -0.05em |
| PPC | **P** | Inter / Pretendard EN | 900 | -0.05em |
| Takoon | **T** | Inter / Pretendard EN | 900 | -0.05em |
| Forward WIP | **W** | Inter / Pretendard EN | 900 | -0.05em |

현재 `.brand-card__monogram` (`style.css:920-932`) 이 정통 — 유지.

---

## 3. 사용처 매핑

### 3-1. brand-card (`style.css:881-990`) — refactor

**현재** (line 915-918):
```css
.brand-card__visual--levitaz { background: linear-gradient(135deg, #0A2540 0%, #1F8FFF 100%); }
.brand-card__visual--ppc     { background: linear-gradient(135deg, #1F8FFF 0%, #5BB4FF 100%); }
.brand-card__visual--takoon  { background: linear-gradient(135deg, #FFB800 0%, #FFD25C 100%); }
.brand-card__visual--wip     { background: linear-gradient(135deg, #2A3B4C 0%, #5C6F7E 100%); }
```

**Phase 2 변경:**
```css
.brand-card__visual--levitaz { background: var(--brand-levitaz-gradient); }
.brand-card__visual--ppc     { background: var(--brand-ppc-gradient); }
.brand-card__visual--takoon  { background: var(--brand-takoon-gradient); }
.brand-card__visual--wip     { background: var(--brand-wip-gradient); }

/* monogram / tag 색은 brand-on 토큰으로 자동 — 현재 takoon 만 swap 인 것을 통일 */
.brand-card__visual--levitaz .brand-card__monogram,
.brand-card__visual--ppc     .brand-card__monogram,
.brand-card__visual--wip     .brand-card__monogram { color: rgba(255,255,255,0.92); }
.brand-card__visual--takoon  .brand-card__monogram { color: var(--brand-takoon-on); }

.brand-card__visual--levitaz .brand-card__tag,
.brand-card__visual--ppc     .brand-card__tag,
.brand-card__visual--wip     .brand-card__tag { background: rgba(255,255,255,0.16); color: var(--color-white); }
.brand-card__visual--takoon  .brand-card__tag { background: rgba(10,37,64,0.18); color: var(--brand-takoon-on); }
```

### 3-2. hero__visual-mark (`style.css:1992-1995`) — refactor

**현재**:
```css
.hero__visual-mark--levitaz { background: linear-gradient(135deg, #061A2E, #1F8FFF); }
.hero__visual-mark--ppc     { background: linear-gradient(135deg, #1670CC, #5BB4FF); }
.hero__visual-mark--takoon  { background: linear-gradient(135deg, #FFB800, #FFD25C); color: var(--color-navy); }
.hero__visual-mark--wip     { background: linear-gradient(135deg, #2A3B4C, #5C6F7E); }
```

**약간의 불일치 발견**: hero__visual-mark 의 시작색이 brand-card 와 다름:
- Levitaz: hero `#061A2E` (navy-deep) vs card `#0A2540` (navy)
- PPC: hero `#1670CC` (sea-dark) vs card `#1F8FFF` (sea)

**의도 분석**: hero badge 는 작은 크기 (16-20px) — 작은 영역에서는 darker 시작이 monogram 가독성 + visual weight 더 강함. card 는 큰 visual (aspect-ratio 4:3) — 밝은 시작이 적합. 두 의도 모두 valid.

**Phase 2 결정 — 두 variant 명시:**
```css
:root {
  /* Brand gradient — small badge variant (darker start for monogram weight) */
  --brand-levitaz-gradient-sm: linear-gradient(135deg, var(--color-navy-deep) 0%, var(--brand-levitaz-end) 100%);
  --brand-ppc-gradient-sm:     linear-gradient(135deg, var(--color-sea-dark) 0%, var(--brand-ppc-end) 100%);
  --brand-takoon-gradient-sm:  var(--brand-takoon-gradient);   /* 동일 — 작은 영역도 OK */
  --brand-wip-gradient-sm:     var(--brand-wip-gradient);
}

.hero__visual-mark--levitaz { background: var(--brand-levitaz-gradient-sm); }
.hero__visual-mark--ppc     { background: var(--brand-ppc-gradient-sm); }
.hero__visual-mark--takoon  { background: var(--brand-takoon-gradient-sm); color: var(--brand-takoon-on); }
.hero__visual-mark--wip     { background: var(--brand-wip-gradient-sm); }
```

### 3-3. mobile-menu brand grid (`style.css:663-681`)

**현재**: 4 브랜드 카드가 모두 `rgba(255,255,255,0.06)` 배경 — brand color 미사용.

**Phase 2 권장 (선택지):**

**옵션 A — 좌측 stripe (color accent):**
```css
.mobile-menu__brand-grid a {
  position: relative;
  /* ... 기존 ... */
}
.mobile-menu__brand-grid a::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
}
.mobile-menu__brand-grid a[href*="levitaz"]::before { background: var(--brand-levitaz-solid); }
.mobile-menu__brand-grid a[href*="ppc"]::before     { background: var(--brand-ppc-solid); }
.mobile-menu__brand-grid a[href*="takoon"]::before  { background: var(--brand-takoon-solid); }
.mobile-menu__brand-grid a[href*="wip"]::before     { background: var(--brand-wip-solid); }
```

**옵션 B — Monogram dot (4 brand recognition):**
```html
<a href="../levitaz.html">
  <span class="mobile-menu__brand-mono mobile-menu__brand-mono--levitaz">L</span>
  Levitaz
  <small>올림픽공인 하이드로포일</small>
</a>
```

```css
.mobile-menu__brand-mono {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 6px;
  margin-right: 10px;
  font-family: var(--font-sans-en);
  font-weight: var(--fw-800);
  font-size: 13px;
  vertical-align: middle;
}
.mobile-menu__brand-mono--levitaz { background: var(--brand-levitaz-gradient-sm); color: var(--brand-levitaz-on); }
.mobile-menu__brand-mono--ppc     { background: var(--brand-ppc-gradient-sm); color: var(--brand-ppc-on); }
.mobile-menu__brand-mono--takoon  { background: var(--brand-takoon-gradient-sm); color: var(--brand-takoon-on); }
.mobile-menu__brand-mono--wip     { background: var(--brand-wip-gradient-sm); color: var(--brand-wip-on); }
```

**권장: 옵션 B** — recognition 효과 강 (4 monogram L/P/T/W 가 다른 위치에서 동일 시각 언어로 반복). UX Researcher §1-3 의 "Recognition rather than recall" 원칙과 일치. 옵션 A 는 가볍지만 stripe 만으로는 brand recognition 부족.

### 3-4. 제품 상세 페이지 (`levitaz.html` · `ppc.html` · `takoon.html` · `wip.html`) — Phase 2 확장

각 product page 의 hero 또는 brand-mark 위치에 monogram gradient 적용 권장. 현재 페이지별 hero 가 brand 의 product photography 위주 — 그것은 유지하고 작은 brand-mark 영역에 monogram gradient 보강.

**Phase 2 spec (예 — levitaz.html hero):**
```html
<header class="product-hero product-hero--levitaz">
  <div class="product-hero__mark">L</div>
  <h1 class="product-hero__title">Levitaz</h1>
  <p class="product-hero__sub">The Original. Reinvented.</p>
  <!-- ... 제품 photography ... -->
</header>
```

```css
.product-hero--levitaz .product-hero__mark {
  background: var(--brand-levitaz-gradient);
  color: var(--brand-levitaz-on);
  /* ... brand-card__monogram 과 같은 spec 재사용 ... */
}
/* ... 다른 브랜드도 동일 패턴 ... */
```

### 3-5. Brand chip (find-my-gear 결과 · cart line item · quote line item)

**Phase 2 권장** — find-my-gear 결과 카드의 추천 SKU 옆에 brand chip:

```html
<span class="brand-chip brand-chip--levitaz">Levitaz</span>
```

```css
.brand-chip {
  display: inline-flex; align-items: center;
  font-family: var(--font-sans-en);
  font-weight: var(--fw-700);
  font-size: var(--fs-xs);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.04em;
}
.brand-chip--levitaz { background: var(--brand-levitaz-gradient-sm); color: var(--brand-levitaz-on); }
.brand-chip--ppc     { background: var(--brand-ppc-gradient-sm); color: var(--brand-ppc-on); }
.brand-chip--takoon  { background: var(--brand-takoon-gradient-sm); color: var(--brand-takoon-on); }
.brand-chip--wip     { background: var(--brand-wip-gradient-sm); color: var(--brand-wip-on); }
```

UX Researcher §0 의 "결과 화면의 추천 SKU 카드에 brand monogram 색을 카드 좌측 stripe 로" 와 직접 연결.

### 3-6. Email signature / 카톡 message rich card (Marketing)

Marketing 이 외부 channel (이메일·카톡) 에서 brand 표현 시에도 같은 토큰 사용. 단 카톡 rich card 는 CSS 미지원 — image 로 export 또는 plain monogram L/P/T/W 텍스트. Marketing 별도 spec.

---

## 4. WCAG contrast 검증

| 위치 | Foreground | Background | Contrast | AA | AAA |
|---|---|---|---|---|---|
| Levitaz monogram | `#FFFFFF` (0.92 alpha ≈ #F2F2F2 시각) | `linear navy → sea` 중간색 (`#15506E` 정도) | ~7.5:1 | ✅ | ✅ (정상 텍스트) |
| PPC monogram | `#FFFFFF` | `linear sea → light sea` 중간색 (`#3DA2D9` 정도) | ~3.8:1 | ✅ large text | ❌ (정상 텍스트). 단 monogram 은 96px+ — large text 통과 |
| Takoon monogram | `var(--color-navy)` `#0A2540` | `linear sun → light sun` 중간색 (`#FFC52E` 정도) | ~11:1 | ✅ | ✅ |
| WIP monogram | `#FFFFFF` | `linear charcoal → slate` 중간색 (`#43505E` 정도) | ~8.5:1 | ✅ | ✅ |
| Levitaz tag | `#FFFFFF` | `rgba(255,255,255,0.16)` on gradient | gradient 의존 — backdrop-blur 8px 로 부드러움. 작은 텍스트 (10px) 라 AA 검증 추가 권장 |
| Takoon tag | `var(--color-navy)` | `rgba(10,37,64,0.18)` on yellow gradient | ~9:1 (navy on light yellow-mix) ✅ |

**핵심 발견:**

1. **Takoon 의 yellow 위 navy 텍스트가 가장 안전** (11:1 AAA) — 결정 옳다.
2. **PPC monogram 의 white 위 sea blue 가 borderline** (3.8:1 ≈ AA large text). 96px+ 폰트라 large text 통과. 단 작은 PPC chip (12px) 사용 시 fail risk — chip 의 PPC 만 color: `var(--color-navy)` swap 또는 brand-on 토큰을 chip 컨텍스트에서 navy 로 override 권장.
3. **WIP charcoal 위 white 안전** (8.5:1).
4. **Levitaz tag 의 작은 텍스트 (10px white on gradient + backdrop-blur)** — 시각 검증 필요. Backdrop-blur 가 contrast 도움이지만 측정 필요. Phase 2 a11y QA round 에 포함.

**Phase 2 수정 권장:**

```css
/* PPC chip 의 small 변형은 navy text 로 swap (AA 준수) */
.brand-chip--ppc,
.product-hero__mark--ppc.product-hero__mark--sm {
  color: var(--color-navy);  /* 작은 크기에서 white 대신 navy */
}
```

---

## 5. Marketing 협업 합의 항목

**이미 결정된 사항** (Marketing 검토 + 확정 stamp 만):

| 항목 | 결정 | 검토 요청 |
|---|---|---|
| Levitaz 색 | navy → sea gradient | ✅ premium technical 정체성 부합? |
| PPC 색 | sea → light sea tonal | ✅ hyperperformance / Pacific 부합? |
| Takoon 색 | sun → light sun | ✅ official "black & gold" 의 gold 와 일치 OK? |
| WIP 색 | charcoal → slate | ✅ safety 도구의 deference 정체성 부합? WIP 의 official "high-vis" 와 충돌 우려? |

**Phase 2 추가 결정** (Marketing 답변 필요):

1. **모바일 menu brand grid 의 옵션 A (stripe) vs 옵션 B (monogram)** — 권장은 B.
2. **제품 상세 페이지 (levitaz.html 등) 의 hero brand-mark 적용 여부** — 현재 brand-mark 없음. 추가 시 photography hero 와의 시각 균형.
3. **Brand chip (find-my-gear 결과 · cart) 도입 여부** — UX Researcher 와 함께 결정.
4. **Email signature / 카톡 rich card** 의 brand color 표현 spec — Marketing 자체 spec.
5. **PPC chip 의 small 변형 navy text swap** — a11y 준수 vs brand 일관 trade-off.

**향후 잠재 변경 항목** (low priority):

6. WIP 의 official "high-visibility" orange/yellow 와 우리 charcoal 결정의 trade-off 재검토 — 단무지공방 컨텍스트에서 deference 가 옳다는 현재 입장 유지 권장.
7. 4 브랜드 외 신규 브랜드 추가 시 (예: HQ Powerkites · Naish · Duotone) 의 5번째 색 후보 — teal / muted violet / muted amber (chart category 확장과 일치).

---

## 6. chart category color 와의 관계

`chart-theme.js` 의 `CATEGORY` 6 색 (navy · sea blue · teal · slate · violet · amber) 과 brand 색의 관계:

| Brand | Brand color | Chart category 대응 | 일치 |
|---|---|---|---|
| Levitaz | navy + sea | category[0] navy + category[1] sea | ✅ 일치 |
| PPC | sea blue | category[1] sea | ✅ 일치 |
| Takoon | sun (yellow) | — chart 에는 yellow 미사용 (status 의 mid) | 의도적 분리 — chart 에서 yellow 는 "보통" 상태, brand 와 혼동 방지 |
| WIP | charcoal + slate | category[3] slate | ✅ 일치 |

**Takoon 의 sun 만 chart category 외** — 의도적 분리. Chart 의 yellow 는 status "mid" 전용이라 brand color 가 chart 에 들어가면 사용자 오독 위험. **유지 권장**.

**DataViz 협업 — 향후 차트에서 brand 별 비교 (예: 4 브랜드 wing 의 VMG 비교) 가 필요하면** brand color 를 chart 에 직접 쓰지 말고 chart category color [0-3] (navy/sea/teal/slate) 를 매핑한 새 chart 시리즈 색을 별도 토큰화 (`--chart-brand-levitaz` 등). brand 색 ≠ chart 색 의 분리 유지.

---

## 7. Phase 2 implementation plan

### 7-1. Phase 2-A — 토큰 + brand-card 정리 (Frontend, 1-2h)

1. `style.css` `:root` 에 §2-1 ~ §2-3 brand 토큰 추가
2. `.brand-card__visual--*` (line 915-918) 와 `.hero__visual-mark--*` (line 1992-1995) 를 토큰 사용으로 refactor
3. monogram / tag 색 통일 — 토큰 사용
4. 시각 회귀 0 (값이 동일하므로) 확인

### 7-2. Phase 2-B — mobile-menu monogram (Frontend + UX, 2-3h)

1. §3-3 옵션 B (monogram) 적용 — mobile-menu DOM 변경 + CSS 추가
2. mobile 키보드 navigation QA
3. UX 사용자 인지 검증

### 7-3. Phase 2-C — brand chip 도입 (Frontend + UX, 2h)

1. `.brand-chip--*` 4 클래스 추가
2. find-my-gear 결과 카드에 적용
3. cart line item · quote line item 에 적용
4. PPC chip 의 small 변형 navy text 검증

### 7-4. Phase 2-D — 제품 상세 페이지 brand-mark (Frontend + Marketing, 2-4h)

1. `.product-hero` 표준 spec 작성
2. levitaz/ppc/takoon/wip 4 페이지 hero 에 적용
3. Marketing 의 product photography 와의 시각 균형 round

### 7-5. Phase 3 — Mobile app / Email / 카톡 (Mobile App + Marketing)

1. SwiftUI / Compose 의 brand color enum 작성 — 같은 hex 값
2. Email signature template 의 brand stripe
3. 카톡 rich card image template (디자인 후 자동 generate)

---

## 8. 부록 — 출처

**프로젝트 내부**
- `assets/css/style.css:9-17` — brand triplet (navy/sea/sun) 토큰
- `assets/css/style.css:915-918` — `.brand-card__visual--*` gradient 현재 인라인 hex
- `assets/css/style.css:1992-1995` — `.hero__visual-mark--*` gradient 현재 인라인 hex
- `assets/css/style.css:881-990` — brand card 컴포넌트 spec
- `assets/css/style.css:663-681` — mobile-menu brand grid 현재 (brand color 미사용)
- `index.html:317-322` — hero video badges 사용처
- `riding-dashboard/js/chart-theme.js:121-128` — CATEGORY 6 색 (chart 와의 관계)
- `_experts/expert_visual_designer_reference.md` §2-4 · §3-1 — brand monogram color 토큰 placeholder

**외부 reference**
- [1] [Levitaz official — homepage](https://levitaz.com/) · [About Levitaz](https://levitaz.com/about/) · [Levitaz Hydrofoils — Boardsport SOURCE](https://www.boardsportsource.com/levitaz-hydrofoils-ss24-foil-preview/)
- [2] [PPC Foiling — official](https://ppcfoiling.com/) · [PPC M1 Wing Range — Foiling Magazine](https://www.thefoilingmagazine.com/foil-products/ppc-foiling-m1-wing-range/) · [PPC Foiling UK](https://ppcfoilinguk.com/)
- [3] [Takoon — official EN](https://takoon.com/en-int) · [Takoon Brand](https://eu.takoon.com/pages/marque) · [Takoon — IKSURFMAG](https://www.iksurfmag.com/brands/takoon/)
- [4] [Forward WIP — official](https://www.forward-wip.com/) · [WIP Pioneering Protective Gear — Boardsport SOURCE](https://www.boardsportsource.com/wip-pioneering-protective-gear-for-high-performance-water-sports/) · [WIP Missions & Values](https://www.forward-wip.com/missions-values/)

---

_Last updated: 2026-05-31_
_Brand identity 토큰화 spec — 이미 결정된 색의 명문화 + 사용처 일관화. Marketing 확정 stamp 후 Phase 2 dispatch._
