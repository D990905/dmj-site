# Sprint Progress — P2 + W2 (Option D)

**날짜**: 2026-05-10
**범위**: PPC P2 (m1-x / m2 / fds) + WIP W2 (helmet / harness / boots)
**결과**: 6 페이지 + 자산 swap + source-copy JSON + cross-reference 정리 완료

---

## 종합 진행률 (sprint 후)

| 브랜드      | 진행률             | 상태                                                     |
|-------------|--------------------|----------------------------------------------------------|
| Levitaz     | 8/8 (100%)         | ✅ 유지                                                  |
| **PPC**     | **4/4 (100%)**     | ✅ **완료** — m1·m1-x·m2·fds 4 페이지 모두 본사 카피 적용 |
| **WIP**     | **4/4 (100%)**     | ✅ **완료** — helmet·harness·boots·impact-vest 4 페이지  |
| Takoon      | 13/45 (29%)        | 다음 sprint 후보 (T2-C·D)                                |

3 브랜드 (Levitaz · PPC · WIP) 페이지 100% 본사 공식 카피 + 한국어 의역 + 본사 자산 적용.

---

## Batch P2 — PPC detail 3 페이지

대상: m1-x.html, m2.html, fds.html

### 변경 list

| 파일                              | 변경 내용                                                                                          |
|-----------------------------------|----------------------------------------------------------------------------------------------------|
| site/products/ppc/m1-x.html       | 본사 공식 설명 section 삽입 (M1-X 카피 + Boom 호환 + Dimension-Polyant)                           |
| site/products/ppc/m2.html         | 본사 공식 설명 section 삽입 (M2 versatility + 상위 모델 DNA)                                       |
| site/products/ppc/fds.html        | 본사 공식 설명 section 삽입 (Sonic FDS race-winning + dual-skin + World Sailing approved)         |

### 카피 출처

- ppcfoiling.com/products/m1-x-wing
- ppcfoiling.com/products/m2-wing
- ppcfoiling.com/products/ppc-fds-full-dual-skin-wing

### Hero 이미지

PPC 본사 Shopify CDN (`cdn.shopify.com/s/files/1/0639/7814/3929/...`) 그대로 유지. 검증 — 모두 본사 페이지 메인 이미지와 일치.

---

## Batch W2 — WIP detail 3 페이지

대상: helmet.html, harness.html, boots.html

### 변경 list

| 파일                              | 변경 내용                                                                                          |
|-----------------------------------|----------------------------------------------------------------------------------------------------|
| site/products/wip/helmet.html     | "WiFLEX Pro Helmet" → **X-OVER Helmet**, hero 이미지 본사 URL, 본사 공식 설명 section 삽입         |
| site/products/wip/harness.html    | "Wing Belt 3.0" → **Wing Belt 4.0** (본사 redirect 확인), hero 이미지 본사 URL, HQ section          |
| site/products/wip/boots.html      | "Wetsuit Boots 3mm" → **Low Cuff Booties 2.0**, hero 이미지 본사 URL, HQ section                   |

### 카피 출처

- forward-wip.com/produit/x-over-helmet/
- forward-wip.com/produit/wing-belt-4-0/ (3.0 → 4.0 redirect, 2026-05-04 갱신)
- forward-wip.com/produit/low-cuff-booties-2-0/

### Hero 이미지 (본사 forward-wip.com CDN)

| 페이지        | URL                                                                                            |
|---------------|------------------------------------------------------------------------------------------------|
| helmet.html   | `forward-wip.com/wp-content/uploads/2021/02/1.X-OVER-HIGH-VIZ.jpg`                              |
| harness.html  | `forward-wip.com/wp-content/uploads/2025/02/1.WINGBELT-4.0.jpg`                                 |
| boots.html    | `forward-wip.com/wp-content/uploads/2021/02/1.-LOW-CUFF-BOOTIES-2.0.jpg`                        |

---

## Cross-reference 정리 (추가 발견)

WIP detail 페이지 4개의 xsell-card / compare 영역에 **잘못된 Shopify CDN (0279/4022/5124)** URL 잔재 발견 — 이전 sprint placeholder 데이터로 다른 vendor의 CDN을 참조 중. amateur 사진 회귀 가드 (DO_NOT_REVERT) 위반.

### 정정 mapping (perl bulk replace, 16개 URL 정정)

| 옛 (broken Shopify 0279) | 새 (forward-wip.com 본사 CDN)                                                |
|--------------------------|------------------------------------------------------------------------------|
| `kompact.jpg`            | `2021/02/1.-IMPACT-VEST-50N-1.jpg` (xsell이 impact-vest.html을 가리킴)       |
| `7.PROWIP2.0HELMET-MATRED.jpg` | `2021/02/1.X-OVER-HIGH-VIZ.jpg`                                              |
| `1.-Wingbelt-3.0.jpg`    | `2025/02/1.WINGBELT-4.0.jpg`                                                  |
| `1.IMPACTVEST50NJUNIOR.jpg` | `2021/02/1.-LOW-CUFF-BOOTIES-2.0.jpg`                                        |

추가로 alt text "Kompact Impact Vest 50N" → "Impact Vest 50N"으로 정확화. **WIP 4 페이지 전부에서 0279 Shopify URL 0건 잔재**.

### 추가 정정 — 다른 페이지 cross-reference

`site/wip.html`, `site/catalog.html`, `site/find-my-gear.html`, `site/products/_fragments/compare-wip.html`, `site/products/wip/impact-vest.html` 의 모든 사이트 안 cross-link도 perl 일괄로 정정:

- WiFLEX Pro Helmet → X-OVER Helmet
- Wetsuit Boots 3mm → Low Cuff Booties 2.0
- Wing Belt 3.0 → Wing Belt 4.0

`_qa_screenshots/` 안 옛 fixture는 의도적으로 건드리지 않음.

---

## Source-copy JSON 갱신

`site/data/wip-source-copy.json` — 본사 source-of-truth 4 신규 entry 추가:

- `x_over_helmet` (139.99€, 5 multi-view URL, Eco Cork variant 메모)
- `wing_belt_4_0` (169.99€, 4 multi-view URL, 3.0→4.0 마이그레이션 노트)
- `low_cuff_booties_2_0` (59.99€, 5 multi-view URL, 사용 라이더 endorsement)
- `pro_harness_with_lumbar_2_0` (189.99€, 4 multi-view URL — 페이지 미배정. sailing 카테고리 추가 시 별도 page로 분리 가능 메모 첨부)

JSON syntax 검증 PASS (`python3 -c "json.load(open(...))"`).

---

## Lint 결과

```
$ bash scripts/lint-copy.sh
```

### PASS — 제가 작업한 6 페이지 + 본 sprint 영향 범위
- ✅ Rule 1, 2, 3, 4, 5, 5b, 5c, 5d-1, 5d-2, 6, 7, 8, 8b, 9, 12 — 모두 PASS
- ✅ Rule 14 (영어 잔재) — **PPC P2 + WIP W2 6 페이지 모두 PASS**
- ✅ Rule 15 (pd-hero 좌우 균형 spec, DO_NOT_REVERT §136) — PASS
- ✅ Rule 16 (hotlink) — PASS (forward-wip.com / cdn.shopify.com 본사 CDN만)
- ✅ Rule 20 (hq-copy section) — 6 페이지 모두 `id="hq-copy"` 존재 검증

### FAIL — 별도 sprint 대상 (이전 잔재, 본 sprint scope 밖)
- ❌ Rule 14 위반 4건 — 모두 `site/products/takoon/escape-cst.html` + `escape-pro-cst.html` 의 영어 잔재 ("top speed", "full speed", "narrow")
  - **본 sprint scope 밖** (Takoon T2-C·D 별도 sprint에서 처리 예정)
  - Danny 메모 "Takoon T2-C·D 는 별도 큰 sprint로 미루기" 와 일치
  - 임의 수정 안 함 (사실 검증 우선 원칙)

### Info-only (위반 아님)
- Rule 10 (한국 spot 명사) — 모두 product detail 페이지 내 의도된 사용
- Rule 11, 13 — 화이트리스트 보완 영역 (현 sprint scope 밖)

---

## .bak 파일 정리 (재시도)

```
$ rm -f site/products/levitaz/*.bak
rm: cannot remove ... : Operation not permitted (8 건)
```

- `site/products/levitaz/{boom-fs-63, boom-fs-83, boom-fs-95, fw-540, fw-680, fw-790, fw-900, r6-race}.html.bak` — 권한 issue로 정리 실패 (마운트 권한 그대로)
- 이전 sprint에서 보고된 issue와 동일 — Danny 수동 삭제 필요
- 본 sprint에서 sed 백업 옵션 사용 안 함 (perl `-i` 직접 in-place edit) → **신규 .bak 0건 생성**

---

## 시각 검수 가이드

다음 6 URL 직접 확인 권장:

```
file:///site/products/ppc/m1-x.html#hq-copy
file:///site/products/ppc/m2.html#hq-copy
file:///site/products/ppc/fds.html#hq-copy
file:///site/products/wip/helmet.html#hq-copy
file:///site/products/wip/harness.html#hq-copy
file:///site/products/wip/boots.html#hq-copy
```

검수 포인트:
1. Hero 이미지 — 본사 사진 정상 로드 (특히 WIP 3개 — forward-wip.com hotlink)
2. "본사 공식 설명" section — hero 바로 다음 위치, 인용 카피 + 핵심 특징 list
3. Hero 좌우 균형 (pd-hero grid 1fr/1fr) — Rule 15 자동 검증 PASS
4. xsell-grid (페이지 하단) — 같은 카테고리 다른 모델 카드 이미지 정상 (옛 broken Shopify URL 모두 정정됨)
5. wip.html / catalog.html / find-my-gear.html 의 WIP 모델 카드명 — X-OVER Helmet · Wing Belt 4.0 · Low Cuff Booties 2.0 으로 통일

---

## 다음 sprint 후보

### Takoon T2-C·D (대형 sprint)
- 윙·포일·parawing 30+ 모델 남음
- 우선 Rule 14 violation 4건 (Escape CST·Escape Pro CST 영어 잔재) 정리 + 본사 카피 의역
- 가격 v5.2 일괄 갱신 (R6 + 매입원가/마진 별도 task와 동기)

### 정리 후보
- `site/products/levitaz/*.bak` 8개 — Danny 수동 삭제 (권한 issue)
- Rule 11 sentence case 화이트리스트 보완 (모델 코드 추가)

---

## 막힘·결정 필요 사항

1. **Forward WIP "Pro Harness with Lumbar 2.0"** (Danny 기본 우선순위 후보) — 현재 사이트에서 페이지 미배정. `wip-source-copy.json`에 source 보존 + 메모 첨부. sailing 카테고리 신설 시 별도 detail 페이지로 분리 가능. **Danny 결정 필요** — 추후 별도 페이지로 추가할지, 또는 inshore racing 카테고리 도입 시 통합할지.

2. **PPC FDS Wing 가격** — v5.1 가격 (₩2,100,000~₩2,580,000) 박혀 있음. 본사 영문 페이지에서는 from $2,500 USD 확인. v5.2 publish 시 환율 갱신 후 동기 (별도 task).

3. **.bak 파일 권한 issue** — 4번째 sprint째 미해결. macOS Finder에서 직접 삭제 또는 `sudo rm` 필요.

---

## 신규 영구 메모 후보 (`feedback_*` / `reference_*`)

다음 항목은 다음 sprint 시작 전 메모로 promote 권장:

- WIP detail 페이지 hero/xsell 이미지는 **반드시 forward-wip.com/wp-content/uploads/...** 패턴만 사용 — Shopify CDN 0279/* 회귀 영구 금지 (DO_NOT_REVERT 후보)
- Wing Belt 3.0 → 4.0 (2026-05-04 본사 redirect) — 같은 패턴으로 본사 product slug 변경 시 site/data/wip-source-copy.json 의 url 필드 갱신 의무

(메모 promote 결정은 Danny가 — 본 sprint에서는 보고서로만 기록.)

---

## Sprint 완료 시각

작업 시작 → 완료: 단일 conversation 안 6 페이지 + 8개 cross-reference 파일 + 1 source-copy JSON. lint v3 PASS (sprint scope 내). amateur 사진 회귀 0건. .bak 신규 생성 0건.
