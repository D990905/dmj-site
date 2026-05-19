# PHASE 9 — Nav 재구성 + 이미지·콘텐츠 완성형 Changelog

**날짜**: 2026-05-05
**범위**: 단무지공방 사이트 nav 5-stage 재구성, 4 brand SKU 이미지 적용, 한국 대화체 description, products.json 동기화

---

## Step 1 — Nav 재구성 (5-stage primary nav)

### 새 구조
1. **Brand** — Levitaz / PPC / Takoon / Forward WIP
2. **라이딩 스타일** — Flat·Speed / Choppy·Freeride / Wave / Hybrid
3. **장비** — Wing / Foil / Board / Accessory (catalog.html#anchor 링크)
4. **실력 수준** — 입문자 / 초·중급 / 상급자 / 선수레벨 + 여성 / 유소년 / 가족
5. **스마트 컨설팅 ↗** (CTA) — find-my-gear.html, sun yellow accent

### 적용 페이지
| 카테고리 | 페이지 | Header | Mobile menu |
|---|---|---|---|
| Root | index.html, levitaz.html, ppc.html, takoon.html, wip.html, find-my-gear.html, 404.html | ✅ | ✅ |
| Tailwind | catalog.html, policies.html | ✅ (별도 nav) | N/A |
| Level | level/beginner.html, level/intermediate.html, level/advanced.html, level/pro.html | ✅ | ✅ |
| Style | style/flat-speed.html, style/choppy-freeride.html, style/wave.html, style/hybrid.html | ✅ | ✅ |
| Demographic | women/index.html, junior/index.html, family/index.html | ✅ | ✅ |
| Policy | policy/terms.html, policy/refund.html, policy/shipping.html, policy/privacy.html | ✅ | ✅ |

### Footer 변경
- About 단무지공방 컬럼 추가 (정식 수입·4 brand·spot 검증·1년 AS·Danny credentials)
- 20 페이지 적용 (footer-grid 있는 페이지)

### CSS 추가 (style.css)
- `.nav__sub--wide` — 실력 수준 dropdown 넓게
- `.nav__primary { gap: var(--space-5) }` — 5-stage 균일 간격
- `.mobile-menu__heading` — 모바일 카테고리 라벨
- `.mobile-menu__about` — 모바일 footer About
- `.footer-about` — footer About 컬럼 스타일

---

## Step 2 — 4 brand SKU 이미지 수집

### 결정사항
**외부 CDN URL hotlink 방식 채택**. Cowork sandbox egress allowlist 제한 (cdn.shopify.com·levitaz.com 미포함) → curl/web_fetch 다운로드 불가. 대안으로 brand 공식 CDN URL 직접 hotlink.

### 수집 결과 (총 39 SKU URL)

| Brand | SKU 수 | Source |
|---|---|---|
| **Levitaz** | 13 | levitaz.com CDN (Wayback Machine archived) |
| **PPC** | 7 | cdn.shopify.com (Shopify 안정) |
| **Takoon** | 9 | cdn.shopify.com (Shopify 안정) |
| **WIP** | 10 | cdn.shopify.com via retailer (alwayskiting) |

### IMAGE_INVENTORY.md
`site/assets/images/IMAGE_INVENTORY.md` 작성 — 모든 SKU URL + Phase 2 캐시화 TODO.

### SKU naming 정정 노트 (Levitaz)
- Memory의 "FW540/680/790/900" naming은 Levitaz 공식과 다름
- 실제: Shaka HA-1100/1300/1600/2000 (front wing area cm²)
- Boom 보드: 95/83/63L 대신 94/75/58/44/29L (실제 volume)
- HTML page는 기존 "FW 540" naming 유지하되 이미지는 가장 가까운 등급 mapping

---

## Step 3 — 한국 대화체 description

### Brand hub 페이지 (4 페이지)
25 SKU card의 `<p class="sku-card__char">` 일괄 교체:
- ❌ Dry: "M1 wing은 정밀 input을 정확히 받아주는 wing"
- ✅ Conversational: "M1은 진짜 야생마처럼 달려요. 한 번 잡으면 손목까지 밀어붙이는 강한 stiffness, 그게 매력. 단단한 만큼 top speed에서 압도적이에요."

### products.json (matrix.js 데이터 source)
29 product의 `why` 필드 한국 대화체로 갱신:
- 강풍 22~35노트에서 가장 정확하게 달리는 윙... (lvz-fs540)
- M1 좋은데 무게 부담됐던 분들의 답안... (ppc-m1x)
- freeride·wave 양쪽 즐기고 싶은 라이더에게 딱... (takoon-v4)
- 윙포일 등 통증 한 방에... (wip-harness)

### 톤 가이드 적용
- 호칭: "여러분", "라이더님", "분들" 친근
- "다·요·까" verb-ending 마침표 유지 (Danny rule)
- 기술 spec 정확 + 설명 자연스러움 균형
- Danny credentials 톤 (전문가 친근감)

---

## Step 4 — 이미지 placeholder swap

### Brand hub (4 페이지)
| 페이지 | SKU cards | Images applied |
|---|---|---|
| levitaz.html | 8 | 8/8 ✅ |
| ppc.html | 4 | 4/4 ✅ |
| takoon.html | 9 | 9/9 ✅ |
| wip.html | 4 | 4/4 ✅ |
| **Total** | **25** | **25/25 ✅** |

### Index brand grid
4 brand cards (Levitaz / PPC / Takoon / WIP) — hero image overlay 적용

### products.json image paths
29 product entries → 모든 image 필드 CDN URL로 교체 (placeholder local path 제거).
이로 인해 level/style/quiz 페이지의 matrix.js가 자동으로 실제 이미지 렌더링.

### CSS 추가 (style.css)
- `.sku-illustration--has-image` — 이미지 overlay (object-fit: contain + drop shadow + hover scale)
- `.brand-card__visual--has-image` — index 페이지 brand card hero (cover + gradient overlay)

### 이미지 fallback
모든 `<img>`에 `onerror="this.style.display='none'"` — CDN 장애 시 SVG illustration이 fallback으로 표시.

---

## Step 5 — 검증 결과

### Nav 일관성
- 6 representative 페이지 grep — Brand·라이딩스타일·장비·실력수준·스마트컨설팅 모두 등장 ✅

### Title 마침표 규칙
- noun-ending 마침표 잔존 검사 → **0 건** ✅
- verb-ending (다·요·까) 마침표 → 보존 ✅

### Placeholder 잔존
- `sku-illustration` SVG fallback은 의도적 보존 (image fail 시)
- `<img>` overlay 적용된 카드 25/25 ✅
- `placeholder-img` (catalog.html Tailwind grid) — Phase 2 product card refactor 시 처리

### Footer
- About 단무지공방 컬럼 — 20/20 (footer-grid 있는 페이지) ✅

---

## Local preview

```bash
cd "단무지공방 홈페이지 만들기/site"
python3 -m http.server 8000
# 브라우저: http://localhost:8000
```

---

## Danny 검토 우선 5건

1. **Levitaz SKU naming 결정** — 페이지에는 "FW 540/680/790/900" 표기 유지 vs 실제 Levitaz "Shaka HA-1100/1300/1600/2000"으로 전환할지. Memory에는 FW 표기로 저장됨. 이미지는 closest match로 hotlink.

2. **R6 Race image source** — levitaz.com CDN URL은 redirect 영향 가능. Phase 2 launch 전 alwayskiting/SocialMedia 백업 source 확보 필요.

3. **products.json `why` 필드 톤 검수** — 29 항목 전수 한국 대화체로 갱신했지만 일부는 더 다듬을 여지 있음 (특히 wip-boots: 유소년 안전이라는 표현이 spec과 정확한지).

4. **장비 nav drop-down 링크** — 현재 catalog.html#wing/foil/board/accessory anchor. catalog.html 자체는 Tailwind 기반으로 5-stage nav 적용 완료했으나 anchor scroll 위치는 Phase 2 catalog 리팩토링 시 정렬 필요.

5. **CDN hotlink 의존** — 39 SKU 모두 외부 CDN. Phase 2 commerce launch 전 로컬 캐시화 (`assets/images/{brand}/{sku}_main.jpg` + WebP 변환) 필수.

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|---|---|
| `site/index.html` | nav 재구성, brand grid 이미지, footer About |
| `site/levitaz.html` | nav, 8 SKU 이미지·대화체 description, footer About |
| `site/ppc.html` | nav, 4 SKU 이미지·대화체 description, footer About |
| `site/takoon.html` | nav, 9 SKU 이미지·대화체 description, footer About |
| `site/wip.html` | nav, 4 SKU 이미지·대화체 description, footer About |
| `site/find-my-gear.html` | nav 재구성 |
| `site/404.html` | nav 재구성 |
| `site/catalog.html` | nav 재구성 (Tailwind dropdown 5-stage) |
| `site/policies.html` | nav 재구성 (Tailwind dropdown 5-stage) |
| `site/level/*.html` (4) | nav, footer About |
| `site/style/*.html` (4) | nav, footer About |
| `site/women/index.html` | nav, footer About |
| `site/junior/index.html` | nav, footer About |
| `site/family/index.html` | nav, footer About |
| `site/policy/*.html` (4) | nav, footer About |
| `site/data/products.json` | 29 product image URL 교체, 29 `why` 한국 대화체 |
| `site/assets/css/style.css` | nav·mobile-menu·footer-about·image overlay 스타일 |
| `site/assets/images/IMAGE_INVENTORY.md` | 새 manifest 문서 |

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지공방 — Option A 채택. 이 changelog 안 '단무지공방'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
