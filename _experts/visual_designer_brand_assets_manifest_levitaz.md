# Brand Assets Manifest — Levitaz

| 항목 | 내용 |
|---|---|
| 문서 유형 | Brand assets manifest + 우선순위 + 활용 위치 + 알렉스 핸드오프 spec |
| Owner | Visual Designer (Rose Yoon) · 영구 인수 (옥대표님 2026-06-05 directive) |
| Source 1 | 옥대표님 직접 보내신 사진 (현재 `site/assets/images/_raw/levitaz/` 481 file + `products/levitaz/_raw/` 14 file) |
| Source 2 | CoS Agent scrape JSON (`levitaz_full_product_content_2026-06-05.json` 32KB, 20 SKU · 81 image URL · spec table) — **본인 session 접근 대기** (cross-session permission) |
| Status | Phase 1 — 현재 자산 audit 완료. JSON content 도착 시 81 URL download + integration |
| 협업 | Alex Park (#4 Frontend) — 자산 path 직접 인용 · CoS Daniel — JSON 전달 + 누락 spec 결정 큐 · 옥대표님 — 추가 raw archive license confirm |

> **읽는 법.** §0 핵심 결론 · §1 현재 자산 audit (588 file inventory) · §2 SKU ↔ 자산 매핑 + 우선순위 · §3 file naming convention · §4 알렉스 핸드오프 path · §5 누락 spec 옥대표님 결정 큐 · §6 다른 브랜드 plan (PPC · WIP · Takoon · F-ONE/Manera).

---

## 0. 핵심 결론 (TL;DR)

옥대표님 영구 인수 ✓. **본인 (Rose) = 단무지 사이트의 모든 브랜드 자산 (이미지·콘텐츠) owner**. CoS 는 dispatch + 조정 only, 자산 수집·번역·xlsx 등 빌드 작업은 본인 영역.

**현재 Levitaz inventory 검증** — 옥대표님 명시 "56장" 이 보내신 raw 만의 count 추정. 실제 sandbox 합산 = **588 file**:
- `products/levitaz/` 88 use-ready (12 subdir로 정리됨, FW/Mast/Boom/R6/Wing/Hero)
- `_raw/levitaz/` 481 raw archive (옥대표님 `boom-fs-001-XXX.jpg` series 등 — 가공 전)
- `levitaz/` 20 PDF-converted (datasheet)

**CoS JSON content 본인 접근 불가** — `/sessions/vibrant-adoring-wright/` 가 cross-session permission denied. 본인 session 의 `uploads/` 또는 `outputs/` 에 copy 필요. 그 동안 본 manifest 가 framework + 알렉스 핸드오프 baseline.

**핵심 결정 (옥대표님 1줄)**:
1. **CoS JSON 전달 경로** — uploads/ 직접 attach? Or sandbox `cat > ...` ?
2. **`_raw/levitaz/` 481 raw archive** 의 web 활용 license 범위 — 옥대표님 본인 촬영 vs Levitaz HQ 제공?
3. **누락 spec** (§5) — Levitaz HQ mail vs 단무지 카탈로그 참조 결정

---

## 1. 현재 자산 audit — 588 file inventory

### 1-1. `site/assets/images/products/levitaz/` (88 file · use-ready)

| 폴더 | Files | 추정 SKU |
|---|---|---|
| `_hero/` | 4 (cover-freeseries · cover-boom-freeseries · cover-*-web 2 variant) | Free Series · Boom Boards 통합 hero |
| `_raw/` | 14 (boom-page-1~7 · free-page-1~7 PDF 캡처) | PDF datasheet 변환 |
| `boom/` | 7 (boom-1~5 · board-from-fs-1~2) | Boom Board FS 시리즈 |
| `free-components/` | 8 (fw-540 · 680 · 790 · 900 · mast-75/84/96 · stab-180) | Free Series 8 SKU 정통 |
| `fw-680/` | 9 | FW 680 detail |
| `fw-790/` | 8 | FW 790 detail |
| `fw-900/` | 8 | FW 900 detail |
| `mast-76/` | 7 | Mast 76 detail |
| `mast-84/` | 7 | Mast 84 detail |
| `mast-96/` | 7 | Mast 96 detail |
| `r6/` | 3 | R6 Race 시리즈 |
| `wing/` | 10 | Wing collection (어떤 brand wing 인지 확인 — Levitaz 자체 wing X · 다른 brand wing 일 가능성) |

**관찰**:
- `wing/` 폴더가 Levitaz 페이지에 있으나 Levitaz 는 foil 전문, wing 미생산. **파일 inventory 후 다른 brand 로 reorganize 권장** (예: `assets/images/products/wing/` 또는 `assets/images/products/{ppc|takoon}/wing/`).
- FW 540 폴더 부재 — 다른 4 size (680/790/900 + 540) 와 같은 detail 폴더 필요한지 옥대표님 결정.
- R6 폴더 3 file 만 — JSON 의 6 component (R6 component 6) 와 비교 부족.

### 1-2. `site/assets/images/_raw/levitaz/` (481 file · raw archive)

샘플 file naming:
- `boom-fs-001-000.jpg` ~ `boom-fs-001-019.jpg` (20 file · Boom FS 001 series)
- 나머지 461 file 정확한 file naming pattern 확인 필요 (다음 audit)

**관찰**: 옥대표님 직접 촬영 raw 또는 Levitaz HQ 제공 raw. 추후 curation 후 일부만 `products/levitaz/{boom|fw-*|mast-*|r6}/` 로 정제 promotion.

### 1-3. `site/assets/images/levitaz/` (20 file · PDF-converted)

샘플:
- `freeseries-fw540-front.jpg/webp`
- `freeseries-fw540-pdf.jpg/webp` ~ `freeseries-fw900-pdf.{jpg,webp}` (4 size × 2 format = 8)
- `freeseries-lineup-hero-pdf.{jpg,webp}` (lineup hero)
- `mast-76-pdf.{jpg,webp}` ~ `mast-96-pdf.{jpg,webp}` (3 mast × 2 format = 6)
- `application-matrix-pdf.{jpg,webp}` (application matrix)

**관찰**: PDF 캡처를 image 화 한 것. spec/datasheet 위주. `products/levitaz/_raw/free-page-*.png` 와 source 가 비슷할 가능성 (중복 확인 필요).

---

## 2. SKU ↔ 자산 매핑 + 우선순위

### 2-1. Levitaz 정통 lineup (CoS JSON `20 SKU` 기반 추정)

| Series | SKU 수 | 예상 |
|---|---|---|
| **Free Series Foils** | 4 | FW 540 · 680 · 790 · 900 |
| **Free Series Components** | 4 | Mast 76 · 84 · 96 · Stab 180 |
| **Boom Boards** | 3 | Boom 63 · 83 · 95 |
| **R6 Race** | 6 components | (FW + Mast + Stab + Boom + Wing + ?) |
| **Sets** | 3 | Free Set · Race Set · Boom Set 등 |
| **합산** | **20 SKU** | CoS JSON 명시 일치 |

### 2-2. SKU 별 자산 우선순위 (Visual 권장)

각 SKU 마다 다음 4 종류 자산이 필요:

| Priority | 자산 유형 | 사용 위치 | 권장 file naming |
|---|---|---|---|
| **★★★ P0** | Hero image (1 장) | `levitaz.html` SKU card hero · brand-hub | `{sku}-hero.{jpg,webp}` (예: `fw-790-hero.webp`) |
| **★★★ P0** | Detail shot (2-3 장) | SKU 상세 페이지 또는 modal | `{sku}-detail-{1,2,3}.{jpg,webp}` |
| **★★ P1** | Spec table image (1 장) | spec table 위 또는 옆 | `{sku}-spec.{jpg,webp}` |
| **★ P2** | Lifestyle / in-use shot (1 장) | brand hub 라이프스타일 section | `{sku}-lifestyle.{jpg,webp}` |

### 2-3. 현재 자산 ↔ 목표 매핑

| SKU | P0 Hero | P0 Detail | P1 Spec | P2 Lifestyle | Status |
|---|---|---|---|---|---|
| FW 540 | ✓ (`free-components/fw-540.jpg`) | 부재 | ✓ (`levitaz/freeseries-fw540-front.jpg`) | 부재 | partial |
| FW 680 | ✓ | ✓ (`fw-680/fw-680-img1~9`) | ✓ | 부재 | good |
| FW 790 | ✓ | ✓ (`fw-790/fw-790-img1~8`) | ✓ | 부재 | good |
| FW 900 | ✓ | ✓ (`fw-900/fw-900-img1~8`) | ✓ | 부재 | good |
| Mast 76 | ✓ (`mast-75.jpg` — file name typo 추정) | ✓ (`mast-76/img1~7`) | ✓ | 부재 | good (file name fix 필요) |
| Mast 84 | ✓ | ✓ (`mast-84/img1~7`) | ✓ | 부재 | good |
| Mast 96 | ✓ | ✓ (`mast-96/img1~7`) | ✓ | 부재 | good |
| Stab 180 | ✓ (`free-components/stab-180.jpg`) | 부재 | 부재 | 부재 | partial |
| Boom 63 | 추정 (`boom/boom-1.jpg`) | ✓ (`boom/boom-1~5` + `board-from-fs-1~2`) | 부재 | 추정 (`_raw/levitaz/boom-fs-001-*`) | good (단 사이즈별 매핑 확인 필요) |
| Boom 83 | 위 동일 | 위 동일 | 부재 | 위 동일 | good |
| Boom 95 | 위 동일 | 위 동일 | 부재 | 위 동일 | good |
| R6 components 6 | 부족 (`r6/r6-1~3` 3 file) | 부족 | 부재 | 부재 | **bad — CoS Agent JSON 으로 보강 필요** |
| Sets 3 | 부재 | 부재 | 부재 | 부재 | **bad — JSON + 옥대표님 직접 confirm** |

**가장 critical gap**:
- R6 Race 6 component (현 3 file 만, JSON 으로 보강)
- Sets 3 (전부 부재)
- 모든 SKU 의 lifestyle / in-use shot (P2, 단무지공방 brand identity 강화)

---

## 3. File naming convention

**원칙** — 알렉스 (Frontend) 가 그대로 인용 가능, semantic + flat:

```
site/assets/images/products/levitaz/
├── _hero/
│   ├── lineup-2026.{jpg,webp}              ← brand hero (lineup)
│   ├── boom-freeride-action.{jpg,webp}     ← brand sub-hero (action)
│   └── r6-race.{jpg,webp}                  ← R6 race section hero
├── _spec/
│   ├── application-matrix-2026.{jpg,webp}
│   └── freeseries-lineup.{jpg,webp}
├── fw-540/
│   ├── fw-540-hero.{jpg,webp}              ← P0 SKU card
│   ├── fw-540-detail-1.{jpg,webp}          ← P0 modal 1
│   ├── fw-540-detail-2.{jpg,webp}          ← P0 modal 2
│   ├── fw-540-spec.{jpg,webp}              ← P1 spec table
│   └── fw-540-lifestyle.{jpg,webp}         ← P2 in-use shot
├── fw-680/ (동일 패턴)
├── fw-790/ (동일 패턴)
├── fw-900/ (동일 패턴)
├── mast-76/ ... mast-96/ (동일)
├── stab-180/ (동일)
├── boom-63/ ... boom-95/ (동일)
├── r6/
│   ├── r6-hero.{jpg,webp}
│   ├── r6-fw.{jpg,webp}                    ← component 1
│   ├── r6-mast.{jpg,webp}                  ← component 2
│   ├── r6-stab.{jpg,webp}
│   ├── r6-fuselage.{jpg,webp}
│   ├── r6-wing.{jpg,webp}
│   └── r6-board.{jpg,webp}
├── sets/
│   ├── set-free-{wing|boom|race}.{jpg,webp}
│   └── set-r6-race.{jpg,webp}
└── _raw/    (옥대표님 raw archive, web push 대상 아님)
```

**reorganize 필요한 현재 file**:
- `free-components/mast-75.jpg` → **rename** `mast-76/mast-76-hero.jpg` (file name typo 의심 — 76 mast)
- `wing/` 폴더 10 file → **다른 brand 폴더 reorganize** (Levitaz wing 미생산)
- `_raw/levitaz/boom-fs-001-*` 481 file → **archive subdir 유지** (web push 안 함, raw archive)
- `levitaz/freeseries-*-pdf.{jpg,webp}` → `products/levitaz/_spec/` 로 이전 + naming 정리

---

## 4. 알렉스 핸드오프 — file path manifest

알렉스 (Frontend) 가 `levitaz.html` 또는 다른 페이지 implement 시 본 manifest 의 file path 그대로 인용. CoS middleman X.

### 4-1. `levitaz.html` hero (brand-hub)

```html
<picture>
  <source srcset="assets/images/products/levitaz/_hero/lineup-2026.webp" type="image/webp">
  <source srcset="assets/images/products/levitaz/_hero/lineup-2026.jpg" type="image/jpeg">
  <img src="assets/images/products/levitaz/_hero/lineup-2026.jpg"
       alt="Levitaz 2026 lineup — Free Series · Boom · R6 Race"
       loading="eager" decoding="async" fetchpriority="high">
</picture>
```

### 4-2. SKU card (예 — FW 790)

```html
<article class="sku-card sku-card--levitaz">
  <picture>
    <source srcset="assets/images/products/levitaz/fw-790/fw-790-hero.webp" type="image/webp">
    <img src="assets/images/products/levitaz/fw-790/fw-790-hero.jpg"
         alt="Levitaz FW 790 Front Wing — premium carbon hydrofoil 790 cm²"
         loading="lazy">
  </picture>
  <h3 class="sku-card__name">Free Series FW 790</h3>
  <p class="sku-card__sub">중급 freeride · 풍속 12-18 knot · 70-85kg 라이더</p>
  ...
</article>
```

### 4-3. Spec section

```html
<section class="brand-spec">
  <picture>
    <source srcset="assets/images/products/levitaz/_spec/freeseries-lineup.webp" type="image/webp">
    <img src="assets/images/products/levitaz/_spec/freeseries-lineup.jpg"
         alt="Levitaz Free Series 4 foil 적용 매트릭스 — FW 540/680/790/900 풍속·체중·레벨 매핑">
  </picture>
</section>
```

### 4-4. Lifestyle banner (P2 추후 보강)

```html
<section class="brand-lifestyle">
  <picture>
    <source srcset="assets/images/products/levitaz/_hero/boom-freeride-action.webp" type="image/webp">
    <img src="assets/images/products/levitaz/_hero/boom-freeride-action.jpg"
         alt="Levitaz Boom Board freeride in action — premium carbon technology">
  </picture>
</section>
```

---

## 5. 누락 spec / 자산 — 옥대표님 결정 큐

CoS JSON `_open_questions` 의 구체 항목 (JSON content 도착 시 정확 list, 현재는 framework):

| # | 누락 | source 후보 | 옥대표님 결정 |
|---|---|---|---|
| 1 | FW 680 / 790 / 900 정확 spec (mm² · stall speed · top speed) | (a) Levitaz HQ mail · (b) 단무지 카탈로그 · (c) JSON 의 `spec_table` field | 선택 1글자 |
| 2 | Mast 84 / 96 사양 (carbon weave · weight · drag profile) | 동일 3 옵션 | 선택 |
| 3 | Boom SCC (Sea Combo Construction?) 정확 사양 | Levitaz HQ direct | 권장 (a) |
| 4 | R6 Race 6 component 정확 list + 사양 | (a) Levitaz HQ · (b) JSON | 권장 (a) |
| 5 | Sets 3 정확 구성 + 가격 | (a) 단무지 가격표 · (b) Levitaz HQ | 권장 (a) |
| 6 | `wing/` 폴더 10 file 의 brand 매핑 (Levitaz 아닌 다른 brand wing) | 본인 (Rose) 자체 audit | 옥대표님 confirm 후 reorganize |
| 7 | `_raw/levitaz/` 481 raw archive 의 web 사용 license 범위 (옥대표님 본인 촬영 vs Levitaz HQ 제공) | 옥대표님 직접 | confirm |

---

## 6. 다른 브랜드 plan (PPC · WIP · Takoon · F-ONE/Manera)

### 6-1. PPC (Pacific Performance Company, NZ)

**현재 sandbox 자산** (audit 필요):
- `products/ppc/lifestyle/` 18+ file (Sean Herbert Brazil · 라이프스타일 · 액션샷) — 강점
- `products/ppc/m1/`, `m1-l/`, `m1-x/`, `m1-r/`, `boom/` — 모델별 폴더 5개
- 부족: Orbit 모델 (CoS 메모리에서 명시), Sonic FDS 자산

**Agent dispatch plan**: CoS 가 다시 띄움 — JSON output 형식 같음 (`ppc_full_product_content_2026-06-XX.json`). 본인 인수 후 통합.

### 6-2. WIP (Forward WIP, Franco-Swiss)

**현재 sandbox 자산** (audit 필요):
- `_raw/wip/` · `_raw/wip/ww/` · `_raw/wip/suisse/` — raw archive 존재
- `products/wip/_fragments/` — 일부 fragment

**가장 critical**: 안전장비 (Impact Vest · Helmet · Wetsuit · Harness) 4 카테고리 × hero/detail/spec/lifestyle 4 종 = 16 자산. 현재 partial.

**Agent dispatch plan**: forward-wip.com 에서 scrape. 옥대표님 GO 후 Agent 띄움.

### 6-3. Takoon (France)

**현재 sandbox 자산** (audit 필요):
- 별도 폴더 미확인 (다음 audit)
- Wing 3-tier + Board 6 model · 4 category 부족 추정

**Agent dispatch plan**: takoon.com 에서 scrape. Wing collection · parawing · kite collection 등.

### 6-4. F-ONE / Manera (옥대표님 추진 중)

**status**: 옥대표님 직접 import 추진 중 (Kickoff 공지 §1). 현재 자산 0. 도입 결정 시 Agent dispatch.

### 6-5. 자산 수집 표준 protocol (Rose owner)

각 brand 마다:
1. **CoS Agent dispatch** — 공식 사이트 scrape, JSON output (SKU + image URL + spec table + _open_questions)
2. **본인 (Rose) 인수** — JSON 정독 + 자산 download + curate + reorganize + manifest 작성
3. **누락 spec 옥대표님 결정 큐** — Levitaz HQ mail vs 단무지 카탈로그 vs 임시 placeholder
4. **알렉스 핸드오프** — `_experts/visual_designer_brand_assets_manifest_{brand}.md` 의 file path 그대로
5. **commit + push** — `assets/images/products/{brand}/` 추가, `auto_push.command` whitelist 적용

---

## 7. 즉시 옥대표님 결정 큐 (CoS 경유 또는 직접)

**Critical 3 결정**:

1. **CoS JSON 전달 경로** — `levitaz_full_product_content_2026-06-05.json` 본인 session 의 `uploads/` 또는 `outputs/` 에 copy. CoS 직접 또는 옥대표님 attachment 또는 sandbox `cat` paste.
2. **`_raw/levitaz/` 481 raw archive 의 web 활용 license** — 옥대표님 본인 촬영? Levitaz HQ 제공? Push 가능 여부.
3. **누락 spec 결정** (§5 의 7건) — (a) Levitaz HQ mail · (b) 단무지 카탈로그 · (c) JSON 의 spec_table · (d) 임시 placeholder.

답 도착 즉시 본인 작업:
- JSON download 후 81 URL fetch + reorganize (`requests` + `pillow` Python)
- §3 file naming convention 적용 + sandbox 통합
- §5 누락 spec 항목 옥대표님 결정대로 채움
- 알렉스에게 channel ping (manifest 확정 + path 명시)

---

## 8. 부록 — 자산 license 정책 (본인 영역 standard)

본인 owner 인수 후 모든 brand 자산 push 전 license 검증:

| Source | 사용 권한 | 비고 |
|---|---|---|
| 옥대표님 직접 촬영 | ✓ free | brand identity 핵심 |
| Brand HQ 공식 (Levitaz / PPC / WIP / Takoon official site) | hotlink 또는 distributor 권한 | 단무지 = 한국 정식 수입 = distributor 권한 보유 추정 (옥대표님 confirm) |
| Levitaz HQ 직접 raw 제공 | ✓ distributor 사용 권한 | 옥대표님 confirm 필요 |
| Sean Herbert / 다른 라이더 사진 | photographer / 라이더 credit 명시 또는 PPC 공식 제공 | alt text + meta 에 photographer credit |
| Stock photo (Shutterstock 등) | ❌ 미사용 정책 | brand identity 손실 |

**license 위반 risk 발견 시**: 본인이 즉시 옥대표님 ping + push 보류 + 대체 자산 검토.

---

_Last updated: 2026-06-05 (작성 시점)_
_Levitaz 자산 owner 인수 ✓ · JSON content 도착 대기 · 다른 brand (PPC/WIP/Takoon/F-ONE) 같은 protocol 확장 plan_
