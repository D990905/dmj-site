# PHASE 11 — Equipment Catalog Build Changelog

**날짜**: 2026-05-05
**범위**: 22 SKU 상세 페이지 + athlete-card 시각화 + 카테고리 비교표 + brand hub 링크 재배선

---

## Danny 피드백 → 작업 매핑

| 피드백 | Phase 11 대응 |
|---|---|
| "왜 이미지가 아직도 거의 없는지?" | 22 SKU detail page에 hero image (CDN hotlink) + brand-color SVG fallback gradient. 각 페이지 `<img onerror>`로 graceful fallback. |
| "세부 장비 목록·기능 설명이 있어야 해" | 22개 detail page 신설 — 각 페이지 8 섹션 (Hero, Telemetry, Best-For card, Skill journey, Performance bars, Spec table, Features, Voice, Compare, Cross-sell, CTA). |
| "제원 반드시 + 비교표 + 별표·막대 시각화 — 선수관리사이트 스타일" | Athlete-card 시각화 도입: telemetry conic gauge, FIFA player card best-for, 6-axis 별 + 막대 (CSS gradient + animation), skill journey 4-tier path, brand 가로 비교표. |

---

## 1. SKU 마스터 데이터 — 22 SKU

`data/products_phase11.json` 신설. 기존 `products.json`의 spec/feature/cross-sell 데이터를 augment.

| Brand | SKU 수 | 모델 |
|---|---|---|
| Levitaz | 8 | r6-race · fw-540 · fw-680 · fw-790 · fw-900 · boom-fs-63 · boom-fs-83 · boom-fs-95 |
| PPC | 4 | m2 · m1-x · m1 · fds |
| Takoon | 6 | cruise · slide · glide · glide-midlength · ultra-glide · prosurf |
| Forward WIP | 4 | helmet · harness · impact-vest · boots |
| **Total** | **22** | |

### 각 SKU 데이터 필드
- 제품 메타: brand, model, category_kr, tagline, hero_image, gallery
- spec: 7~8개 key-value (사이즈, 재질, 보증, 가격 등)
- features: 5개 ["title", "body"] 쌍
- 시각화: best_for (skill·weight·style·spot 4 spot list) / skill_position / 6 attribute scores (1-5)
- cross_sell: 같은·인접 카테고리 3개

---

## 2. 시각화 컴포넌트 — Athlete-card 스타일

선수관리사이트 시각화 톤으로 6개 viz 컴포넌트 도입 (`products/product-detail.css` 신설, ~720 lines).

### 2-1. Telemetry gauge (race-car dashboard 느낌)
- conic-gradient 기반 ring gauge 3개 (속도/글라이드/조작성 또는 보호력/착용감/동작성)
- "PERFORMANCE TELEMETRY" eyebrow + DMJ-CALIBRATED chip
- pulse animation (1.6s) on pip indicator

### 2-2. Best-For card (FIFA player card 풍)
- 상단 4px gradient bar (sea→sun)
- 라이더 등급 highlight (입문자/초중급/상급자/선수레벨 = 4색 tier)
- 스킬·체중·풍속·스타일·spot 5축 dl

### 2-3. Skill journey progression
- 4-tier horizontal path (입문자 → 초중급 → 상급자 → 선수레벨)
- 현재 SKU 위치 = scale(1.3) + box-shadow halo (tier 색상)
- 지나간 단계 dot 채워짐

### 2-4. Performance attribute bars (athlete profile card)
- 6-axis 1-5 score
  - **장비** (wing/foil/board): skill / speed / glide / maneuver / stability / pump
  - **안전·편의** (helmet/vest/harness/boots): protection / comfort / mobility / durability / fit / versatility
- 각 row: ★별 (5/5) + numeric + gradient bar (sea→sun) + 1-line desc
- bar fill animation (0.9s ease-out, prefers-reduced-motion respect)
- hover/focus: row lift -2px + sea border + 박스 shadow

### 2-5. Spec table
- caption stripe (navy bg, "SPECIFICATIONS" eyebrow)
- 7-8 row key-value, alternating left col mist tone

### 2-6. Category comparison table
- 같은 카테고리 SKU 가로 비교 (가격·체중·풍속·스킬·1-line 특성)
- 현재 SKU 행 highlight (sun gradient + ● pin)
- 모델명 click → 다른 detail page 이동

### Tier color 시스템 (4 color)
```
--tier-beg: #2BB673  (입문자 — green)
--tier-mid: #1F8FFF  (초중급 — sea blue)
--tier-adv: #7C3AED  (상급자 — purple)
--tier-pro: #E11D48  (선수레벨 — race red)
```

---

## 3. Detail page 생성 — bash + Python

### 빌드 스크립트
- `_build/generate_products.py` — 단일 template + viz 컴포넌트 렌더 함수 (~580 lines)
- `_build/inject_links.py` — brand hub `<article class="sku-card">` link 재배선 (~110 lines)

### 빌드 결과
- 22 detail page (16~17KB each, navy header + main + footer)
- 4 brand 비교표 fragment (`products/_fragments/compare-{brand}.html`)
- 평균 22 sec build time (cold)

### Detail page 구조 (8 섹션 + footer)
```
[Hero]              brand-color gradient bg + hero image + breadcrumb + telemetry + best-for + CTA
[Skill journey]     4-tier path + 현재 위치
[Performance bars]  6 attribute (별 + 막대 + 1-line desc)
[Spec table]        7-8 key-value
[Features]          5 feature card (border-left sea)
[Rider voice]       navy gradient blockquote
[Compare]           카테고리 가로 비교 (현재 행 highlight)
[Cross-sell]        3 카드 (인접 SKU)
[CTA]               navy gradient · 카톡 + 1분 진단
```

---

## 4. Brand hub 링크 재배선 + 비교표 inject

### 4-1. SKU card → detail page 링크
`<span class="sku-card__more">상세 →</span>` → `<a class="sku-card__more sku-card__more--link" href="products/{brand}/{sku}.html">상세 →</a>` 변환.

추가 패턴: stretched-link (CSS `::before` inset:0)으로 카드 전체가 클릭 영역.

| Brand hub | 변환 cards |
|---|---|
| levitaz.html | 8 / 8 |
| ppc.html | 4 / 4 |
| takoon.html | 5 + 1 (Cruise highlight box 별도 CTA 추가) |
| wip.html | 3 + 1 (Boots accessories note에 별도 CTA 추가) |
| **Total** | **22 / 22** ✅ |

Skipped (no Phase 11 detail): Takoon 4 wings (V4·V4 Pro·VX Pro·Double Skin), WIP 1 wetsuit (Hooded UV Quickdry) — Phase 12 후속 후보.

### 4-2. Brand 비교표 inject
각 brand hub `</main>` 직전에 `<!-- PHASE_11_COMPARE_INJECTED -->` marker + 비교표 섹션 inject. 모델명·가격·스킬·체중·풍속·3개 핵심 attribute (★별).

---

## 5. 이미지 전략

### 결정
Phase 9에서 도입한 외부 CDN hotlink 유지. Cowork sandbox egress 제한으로 22 SKU × 4-6장 lifestyle screenshot 캡처는 비효율 → Phase 12 후속.

### Fallback
- `<img onerror>`로 image fail 시 brand-color gradient 표시
- `.pd-hero__image-wrap[data-brand]`별 4 색 gradient (Levitaz=sea/sun, PPC=sun/cream, Takoon=mint, WIP=rose)
- 이미지 실패 시에도 시각적으로 깔끔 — placeholder text 노출 X

---

## 6. 검증 결과

```
=== HTML lint ===
22/22 detail pages: tag balance ✓  empty href/src 0  placeholder leak 0

=== Section coverage (22 SKU) ===
spec table:        22/22
attr bars:         22/22
best-for card:     22/22
skill journey:     22/22
telemetry gauge:   22/22
cross-sell:        22/22
category compare:  21/22 (R6 Race 단일-SKU 카테고리 — 의도된 누락)

=== Link integrity ===
xsell broken links: 0/132
sitemap.xml: 22 SKU URL 추가
```

---

## 7. 한국어 톤 정책 적용

- 친근 대화체 (~합니다 / ~예요 / ~답니다)
- Brand slogan / 모델 코드 / 업계 약어 영문 유지 (FW680, M1-X, Sonic FDS, parawing, Free Series, R6 Race 등)
- 마침표 규칙: verb conjugation 끝 (다·요·까)에는 마침표 keep, noun ending 끝에는 마침표 제거 — 검토 필요 시 수동 후속 review

---

## 8. 차별화 효과

기존 한국 retail 사이트 대비 차별화 포인트:
1. **Athlete-card visualization** — F1/NBA/FIFA 스타일을 watersport에 도입한 첫 사례
2. **Telemetry conic gauge** — race-car dashboard feel의 numeric primary metric 표시
3. **4-tier skill journey** — 라이더의 다음 step을 명시 (cross-sell 자연 연결)
4. **Category comparison built-in** — 같은 카테고리 SKU 가로 비교를 detail page에 inline 통합
5. **Animated bar fill (CSS only)** — bars on scroll fill animation, JS 없음 (성능 친화)
6. **Tier color 일관 system** — 입문(green)/초중급(blue)/상급자(purple)/선수(red) 4색이 best-for card·skill journey·compare table에서 일관 적용

---

## 9. Phase 12 후속 (deferred)

1. **이미지 보강** — Chrome MCP로 SKU당 lifestyle 1-2장 추가 (현재 product-only 1장)
2. **Takoon 4 wings detail page** — V4/V4 Pro/VX Pro V2/Double Skin Wing
3. **WIP wetsuit·UV 라인 detail page** — 3Ds Neoprene 3mm, Hooded UV, Tech Hoodie
4. **로컬 이미지 캐시** — CDN hotlink 의존 제거 (Phase 2 commerce launch 전)
5. **WebP/AVIF 변환 + lazy-loading 강화**
6. **Performance bars 본사 데이터 cross-check** — 현재 단무지공방 자체 calibration. Levitaz/PPC/Takoon 본사 spec sheet 입수 후 정확도 검증.

---

## 10. 파일 변경 요약

```
신규
+ data/products_phase11.json                 (~22 KB · 22 SKU augmented)
+ products/product-detail.css                (~17 KB · athlete-card 시각화)
+ _build/generate_products.py                (~22 KB · template + render)
+ _build/inject_links.py                     (~4 KB · link rewiring)
+ products/levitaz/{8 SKU}.html              (~135 KB total)
+ products/ppc/{4 SKU}.html                  (~67 KB total)
+ products/takoon/{6 SKU}.html               (~99 KB total)
+ products/wip/{4 SKU}.html                  (~65 KB total)
+ products/_fragments/compare-{brand}.html × 4

변경
~ levitaz.html  (8 sku-card 링크 + 비교표 inject)
~ ppc.html      (4 sku-card 링크 + 비교표 inject)
~ takoon.html   (5 sku-card 링크 + Cruise CTA + 비교표 inject)
~ wip.html      (3 sku-card 링크 + Boots CTA + 비교표 inject)
~ assets/css/style.css  (sku-card stretched-link 패턴 추가, ~30 lines)
~ sitemap.xml   (22 detail page URL 추가)
```

---

**Phase 11 완료**. 차별화 시각화 + 22 detail page + brand hub 가로 비교 모두 라이브.

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지공방 — Option A 채택. 이 changelog 안 '단무지공방'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
