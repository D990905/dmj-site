# §161-A WIP 사이즈 표 권장 체중 source 검증

검증일: 2026-05-12
검증 대상: Forward WIP 공식 사이즈 표 + 개별 product page
출처: `site/assets/images/wip/wip-size-chart-2023.png` (1655×3660, 본사 공식)
+ `https://www.forward-wip.com/size-chart/` (위 PNG와 동일 자산 host)

---

## 1. 본사 공식 size chart 구조 fact-find

`WIP-SIZE-CHART-2023.png` 의 6 카테고리 row 별 컬럼 구조:

| 카테고리 | 컬럼 구조 (verbatim) | WEIGHT 컬럼 유무 |
|---|---|---|
| MEN | size / A height / B chest / C waist / D hips | (cm 데이터만, weight X) |
| WOMEN | size / A height / B chest / C waist / D hips | (cm 데이터만, weight X) |
| **VESTS / PFDs** | **CHEST CIRC / CHEST CIRC / WEIGHT / WEIGHT / BUOYANCY** | **컬럼 헤더 O, 셀 값 모두 비어 있음** |
| EYEWEAR | TEMPLE LENGHT / WIDTH | (length/width만) |
| FOOTWEAR | EU / FR / UK / US | (foot size 만) |
| HELMETS | (head circumference 컬럼) | X |
| HARNESSES | **WAIST-A / SHOULDER-B** | **WEIGHT 컬럼 없음** |
| GLOVES | WIDTH / LENGHT / EU | X |

---

## 2. Vests (PFDs) — 본사 size chart 검증

본사 PNG 의 VESTS / PFDs row 는 다음 컬럼 헤더를 가짐:
- CHEST CIRCUMFERENCE (cm)
- CHEST CIRCUMFERENCE (inch)
- **WEIGHT (kg)**
- **WEIGHT (lbs)**
- BUOYANCY

S/M 행에 빨간 `*` 와 파란 `*` 표기 (footnote marker) 가 있으나
**XS/S/M/L/XL/XXL 모든 셀이 비어 있음** — 본사가 컬럼은 제작했지만 데이터를 채워 넣지 않은 상태.

| 모델 | 사이즈 | 본사 chest cm | 본사 권장 체중 (kg) | 본사 buoyancy (N) | 출처 |
|---|---|---|---|---|---|
| Kompact Vest 50N 2.0 | XS / S / M / L / XL / XXL | (셀 빈 칸) | **— (셀 비어 있음)** | 50 | wip-size-chart-2023.png |
| Wing Impact Vest 50N | XS / S / M / L / XL / XXL | (셀 빈 칸) | **— (셀 비어 있음)** | 50 | wip-size-chart-2023.png |
| Raley / Light / Flow Neo Vest 50N | XS / S / M / L / XL / XXL | (셀 빈 칸) | **— (셀 비어 있음)** | 50 | wip-size-chart-2023.png |

**검증 인용 (verbatim, 본사 size chart):**
- 헤더: `CHEST CIRCUMFERENCE`, `WEIGHT`, `BUOYANCY`
- 데이터 셀: (모두 공란)

---

## 3. Harnesses — 본사 size chart 검증

본사 PNG 의 HARNESSES row 는 다음 컬럼 헤더를 가짐:
- WAIST - A
- SHOULDER - B
- WAIST - A (반복)
- SHOULDER - B (반복)

행 = S/M, L/XL 두 개만. **WEIGHT 컬럼 자체가 존재하지 않음.**

| 모델 | 사이즈 | 본사 waist cm | 본사 권장 체중 (kg) | 출처 |
|---|---|---|---|---|
| Waistfoil Harness 3.0 | S/M, L/XL | (셀 빈 칸) | **컬럼 자체 없음** | wip-size-chart-2023.png |
| Wing Belt 3.0/4.0 | S/M, L/XL | (셀 빈 칸) | **컬럼 자체 없음** | wip-size-chart-2023.png |
| Aero / Exo / Pro / Light Harness 3.0 | S/M, L/XL | (셀 빈 칸) | **컬럼 자체 없음** | wip-size-chart-2023.png |

**검증 인용 (verbatim, 본사 size chart):**
- 헤더 4 컬럼: `WAIST - A`, `SHOULDER - B`, `WAIST - A`, `SHOULDER - B`
- WEIGHT / kg / lbs 단어 부재.

---

## 4. Product page 개별 검증

forward-wip.com 의 `size-chart/` 페이지는 위와 동일한 PNG 1장(`WIP-SIZE-CHART-2023.png`)을 host 함 — 별도 textual size 표 없음.

product page (Kompact Vest 50N, Wing Impact Vest 50N, Waistfoil Harness 3.0 등) 의 본문은 기능 설명·certification (EN ISO 12402-5)·기술 (Eco Cork, WIP Inside) 만 다루며 **개별 사이즈별 권장 체중 표를 게재하지 않음** — Search snippet 으로 확인한 spec 키워드 (high density thermoformed foam, super stretch neoprene, harness zone design 등) 어디에도 kg 단위 weight range 없음.

---

## 5. CASE 결론

| 카테고리 | CASE | 사유 |
|---|---|---|
| **Vests (Impact / Kompact / Raley / Light / Flow Neo)** | **CASE B** | 본사 size chart WEIGHT 컬럼 존재, 데이터 셀 전부 공란. Product page 도 미게재. |
| **Harnesses (Waistfoil / Wing Belt / Aero / Exo / Pro)** | **CASE B (strict)** | 본사 size chart 에 WEIGHT 컬럼 자체 없음. Harness sizing 기준 = 허리둘레만. |
| **Wetsuits** | (별도 검증 필요 — 본 audit 범위 외) | MEN/WOMEN row 가 wetsuit 용 height/chest/waist/hips 임. 권장 체중 컬럼 없음. |
| **Boots / Helmets** | N/A | 본 task spec 에서 weight 무관. |

---

## 6. Danny 검수 권장 사항

본사 공식 source 에 vest/harness 의 사이즈별 권장 체중 데이터가 **존재하지 않음** — §161-A 의 전제 (본사 데이터로 채운다) 가 충족 불가.

**권장 옵션:**

- **옵션 (a) — "권장 체중" 컬럼 dash (—) 유지:** 컬럼은 둔 채 모든 셀에 `—` 표기 + 캡션 "본사 공식 권장 체중 미명시. 사이즈는 허리/가슴 둘레 기준" 추가. 단점: dash 만 가득한 빈 컬럼 → 가독성·정직성 ↓.

- **옵션 (b) — "권장 체중" 컬럼 제거 (§161 원안 복귀):** vest/harness 모두 [사이즈 / 둘레 / 가격] 3-col 로 유지. 본사 데이터가 없으므로 사이트가 가짜로 채울 의무 없음. **권장 (강) — Danny 의 "guessing 금지" 원칙과 일치.**

- **옵션 (c) — 사이즈별 weight 를 chest/waist 에서 추정:** Danny 가 거부함 — 적용 X.

**추가 옵션 (Danny 결정용):**

- **옵션 (d) — vest 만 컬럼 유지 / harness 는 제거:** vest 는 본사 size chart 에 WEIGHT 헤더 존재 (셀만 빔) → 컬럼 footprint 정당화 가능. harness 는 본사 자체가 weight 비키워드 → 깨끗하게 제거. 분기 처리.

**권장 (강):** 옵션 (b) — vest/harness 모두 "권장 체중" 컬럼 미사용. §161 원안 [사이즈 / 둘레 / 가격] 3-col 유지.

---

## 7. 산출물

- 본 audit: `site/_qa_audit/wip-recommended-weight-source.md`
- crop 이미지 (임시):
  - `site/_qa_audit/_tmp_wip-size-vests-full.png` (vest 표 zoom)
  - `site/_qa_audit/_tmp_wip-size-harnesses.png` (harness 표 zoom)
- 원본 source: `site/assets/images/wip/wip-size-chart-2023.png`
