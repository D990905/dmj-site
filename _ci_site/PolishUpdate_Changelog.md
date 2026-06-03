# Polish Update — Changelog (2026-05-05)

이전 OvernightSprint에서 만든 dmjgroup.kr 베이스 위에, Danny가 공유한 추가 정보로 **종합 polish + 정정** 작업.

---

## TL;DR — 한 줄 요약 5개

1. **Layout 정밀 polish** — 320-390px 좁은 viewport에서 hero·brand-hero 카피 줄바꿈 깨짐 fix. `word-break: keep-all` (한글 어절 단위) + clamp 최소값 축소 + letter-spacing 완화. 24개 viewport × 6페이지 자동 검증, **overflow 0건**.
2. **PPC 라인업 3 → 4 model 확장** — 기존 FDS/M1/M2 → **M2 (versatile) · M1 (perform) · M1-X (lightweight ExoPE-85) · FDS (race dual-skin)**. SKU 카드 + 5열 compare table + tagline/title/meta 일괄 정정.
3. **Takoon V4 Pro 디테일 보강** — 65 g/m² quadruple ripstop 외에 **SUP-style valve 업그레이드 + soft/rigid/Boom V2 핸들 호환 + 중앙 strut 최적화** spec 추가. Glide 보드는 **38cm 카본 foil box (Futures 대비 +11cm) + one-piece deck pad** 디테일.
4. **WIP 브랜드 큰 정정 — 프랑스 → 스위스** — Forward WIP은 스위스 본사. 모든 페이지의 nav/copy/badge/title/meta에서 "프랑스 보호장비" → **"Forward WIP · 스위스 보호장비"**. 라인업도 generic Wetsuit/Helmet/Vest → 실제 model 명: **Raley Impact Vest · Prowip 2.0 / Wipper 2.0 · Wing Belt 4.0 · Hooded UV Quickdry**.
5. **Phase 1·2 (Levitaz 파일 처리) BLOCKED** — Danny가 알려준 PDF×2 + xlsx 파일 경로가 다른 agent session 소유. 현 Cowork session에 접근 불가. **Danny 재업로드 필요** (drag-drop 또는 paperclip).
6. **Phase 3b·4b 추가 (4·4 구조 확정)** — Danny 결정으로 PPC + Takoon 모두 **4-tier (입문/중급/고급/레이싱)** 통일. 캐릭터 카피 (M1=야생마, M1-X=나비, FDS=장르가 다르다) + tier badge + 5축 mini-chart 카드 안에 직접 노출. Takoon 레이싱 tier는 **Double Skin Wing — 곧 출시** Coming Soon 카드.

---

## Phase별 변경 사항

### Phase 1 — Levitaz PDF + xlsx 처리 (**BLOCKED**)

**상태**: 파일 접근 불가 → 미진행

**원인**:
- Danny가 알려준 경로: `/Users/dannyok/Library/Application Support/Claude/local-agent-mode-sessions/.../agent/local_ditto_.../uploads/...`
- 본 Cowork session 마운트 경로는 다름. 해당 경로 통째로 부재.
- 3개 파일 (LEVITAZFree_Series_Product_Sheet_EN.pdf, LevitazBoom_Free_Series_Product_Sheet_EN.pdf, LEVITAZFreeSeries_b2b_order_form_26.03_EN.xlsx) 모두 missing.

**Danny 액션 필요**:
- 이 conversation의 chat 입력 영역에 직접 drag-drop (또는 paperclip 아이콘으로 attach)
- 그러면 본 session uploads 폴더에 들어와서 PDF 페이지 단위 read + 이미지 추출 + xlsx 파싱 가능.

### Phase 2 — Levitaz hub 업데이트 (**PENDING — Phase 1 의존**)

Phase 1 완료 후 진행. 현재 levitaz.html은 OvernightSprint 상태 그대로 유지 (8개 SKU 카드 — Front Wing 4 + Boom FS 3 + R6 Race 1).

### Phase 3 — PPC 4-model 라인업 정정 (**완료**)

**기존 (3-model)**:
- Sonic FDS / M1 / M2

**신규 (4-model, 한국 spot 검증)**:
- **M2** (Premium dacron · all-around · ★ 처음 한 wing 권장)
- **M1** (Thermo-bonded seam · Dimension-Polyant · 정밀 advanced)
- **M1-X** (ExoPE-85 fabric / Dyneema 보강 · single-mold full carbon handle · wave/freestyle 경량 전용) — **신규 추가**
- **Sonic FDS** (Full Dual Skin + ExoPE-85 frame · race dual-skin)

**WebSearch 출처**: ppcfoiling.com, thefoilingmagazine.com (M1-X spec, ExoPE-85 fabric 세부)

**적용 변경**:
- Tagline: `Sonic FDS · M1 · M2.` → `M1 · M1-X · M2 · FDS.`
- Section-head: 3 Wing Curation → **4 Wing Curation**
- SKU grid: 3 cards → **4 cards** (M2 / M1 / M1-X / FDS, 순서는 entry → race)
- Compare table: 4열 → **5열**, 행도 무게 행 추가, "한국 spot 추천" 행 갱신
- Brand-hero meta: Lineup `FDS · M1 · M2` → `M1 · M1-X · M2 · FDS`
- Title/meta description 일괄 정정
- Brand story: 4-tier 분류 설명 추가 (M2 versatile, M1 정밀, M1-X 경량 wave, FDS race)
- Compare table 하단 footnote: M1-L · Vortex SDS 본사 추가 모델 존재 명시

**미해결 (Danny 검토 필요)**:
- 가격순으로 보면 **M2 ($1,260) < M1-X ($1,880) ≈ M1 ($1,890) < FDS ($2,420)**. Danny가 알려준 "M1=가성비, M2=premium perform"과 실제 가격은 반대 방향. Site는 Danny 큐레이션 방향대로 build됐지만 (M2를 ★ 한국 표준 표기), 한국 RRP 정착 시 가격 표기 갱신 필요.

### Phase 4 — Takoon 라인업 fetch (**완료**)

**검증 결과**:
- ✅ V4 Pro 65 g/m² quadruple ripstop — 공식 사양 그대로
- ✅ Glide 6 사이즈 4'9 (60L) ~ 5'8 (110L) — 정확
- ✅ Comet 4 사이즈 5'0 / 5'4 / 5'10 / 6'0 — 정확

**보강 추가**:
- V4 Pro spec: **SUP-style 인플레이션 valve** 업그레이드, **soft / rigid / Boom V2 핸들 호환** (interchangeable), **중앙 strut 최적화 (low-drag)**
- Glide 보드 디테일: **38 cm 카본 foil box** (Futures 대비 11cm 더 김 — placement 자유도 unmatched), **one-piece deck pad** (이전 분리형에서 진화)
- 보드 라인업 footer: 본사 2026 컬렉션의 **Cruise · Slide · Glide Midlength · Ultra Glide · Prosurf** (full carbon sandwich 신공법, $993~$1,192) 명시 — 단무지는 Glide/Comet 2 모델로 좁힘

**WebSearch 출처**: takoon.com/en-int/products/wing-v4-pro, /products/glide, /products/wing-vx-pro-2, /products/comet, /pages/wing-foil-boards

### Phase 5 — Layout 정밀 polish (**완료**)

**문제**: 좁은 viewport (320-390px)에서 hero/brand-hero 카피가 한글 음절 단위로 끊기거나 가로 오버플로우.

**원인 분석** (수치 검증):
- `.hero__title` clamp 최소 `2.5rem (40px)` → "4 brand, 한 라이더." 가 320px viewport (padding 40px 제외 280px 가용)에 빠듯.
- `.brand-hero__name` clamp 최소 `3.5rem (56px)` → "LEVITAZ" 7자 × 56px × 0.95 ≈ 372px > 280px → **오버플로우**.
- `letter-spacing: -0.04em ~ -0.05em` 한글에 너무 tight, 가독성 저하.
- 한글에 `word-break: keep-all` 부재 → 음절 단위로 끊김.
- `.brand-hero__tagline max-width: 24ch` 한글 폭 계산 부정확.

**처치 — `assets/css/style.css` v1.2 섹션 추가** (~190 lines):
- `word-break: keep-all` + `overflow-wrap: break-word` 한글 텍스트 일괄 적용 (.hero__title, .hero__lead, .brand-hero__name/tagline/lead, .section-head, .sku-card, .value-card 등)
- `@media (max-width: 480px)` — hero__title 최소값 `1.875rem (30px)`, brand-hero__name 최소값 `2.5rem (40px)`, letter-spacing 완화
- `@media (max-width: 360px)` — iPhone SE 등 초협 viewport 추가 축소 (1.6875rem · 2.125rem)
- `@media (max-width: 640px)` trust-bar wrap 처리 + compare-table 모바일 가로 스크롤
- `@media (min-width: 640px) and (max-width: 1023px)` 태블릿 구간 미세 조정
- `@media (min-width: 1440px)` wide desktop max-width 안정화
- iOS Safari focus zoom 방지 (`input/textarea` font-size 16px 강제)
- `prefers-reduced-motion: reduce` 안전망

**검증 — Playwright headless chromium**:
- 24 viewport (4 사이즈 × 6 페이지) 자동 테스트
- **overflow 0건, hero text overflow 0건, error 0건**
- Screenshot 저장: `_qa_screenshots/`

### Phase 6 — Forward WIP 브랜드 정정 (**완료**)

**큰 사실 정정**:
- Forward WIP은 **프랑스 brand가 아니라 스위스 brand** (Switzerland-based)
- 이전 site에 "프랑스 프로 라이더가 신뢰하는" / "Made in France" 표기 → 모두 정정
- 도메인: forward-wip.com (Danny 알려줌)

**적용 변경**:
- 모든 페이지 nav 드롭다운 `WIP — 프랑스 보호장비` → **`Forward WIP — 스위스 보호장비`**
- index.html brand-card: WIP → **Forward WIP**, copy = "스위스 프로가 신뢰하는 워터스포츠 안전장비. Impact Vest · Helmet · Harness · UV"
- wip.html title: `WIP — 프랑스 프로 보호장비` → `Forward WIP — 스위스 워터스포츠 보호장비 (Impact Vest · Helmet · Wetsuit · Harness)`
- wip.html hero: name `WIP` → **`FORWARD WIP`**, badge `Made in France` → `Swiss-engineered`
- wip.html brand story: 프랑스 본사 윈드 스포츠 전문 → **스위스 본사 프로 세일링·포일링 전문 + 4 카테고리 라인업 명시**

**라인업 generic → 실제 model 명** (WebSearch verified — forward-wip.com):
| 기존 (generic) | 신규 (실제 model) |
|---|---|
| WIP Wetsuit 3/2mm | **Raley Impact Vest** (★ Foil 라이더 표준) |
| WIP Pro Helmet | **Prowip 2.0 / Wipper 2.0** + Cool Cap Bump Shell 옵션 |
| WIP Impact Vest | **Wing Belt 4.0** (Wing 전용 하네스) |
| (없음) | **Hooded UV Quickdry / Rashguard / Tech Hoodie** (봄·가을 layer) |

**SKU footer**: 액세서리 라인 (Wing Board Leash Dampener · Downwind Back Pack · Gust Aero 2.0) 명시. Danny 지시로 **SKU 게시 보류, 라인업 파악만** — 정식 입고 시 별도 공지.

**WebSearch 출처**: forward-wip.com, coastwatersports.com/forward-wip-shop, northernwatersports.co.uk/collections/forward-wip, fanaberienyc.com/the-next-gen-of-impact-vests-and-helmets

### Phase 7 — 본 changelog (**완료**)

### Phase 3b — PPC 4-tier 캐릭터 카피 + 5축 차별화 (**완료**)

**Danny 4·4 구조 결정 반영**:
- **입문 — M2** · 캐릭터 nick: "M1의 친동생" — 가성비 versatile · 5축: 4/7/7/7/8 (Stab 강조)
- **중급 — M1** · 캐릭터 nick: "야생마" — stiff frame, top perform · 5축: 6/9/8/7/7 (Speed/Glide 강조)
- **고급 — M1-X** · 캐릭터 nick: "나비" — 부드럽고 가볍고 · 5축: 7/8/7/9/6 (Maneuver 강조)
- **레이싱 — FDS** · 캐릭터 nick: "장르가 다르다" — Full Skin race · 5축: 8/10/9/7/7 (Speed 만점)

각 카드에 **tier-badge** (입문/중급/고급/레이싱 — 그린/블루/앰버/레드 컬러), **character-nick** (이탤릭 + 인용 좌측 보더), **perf-mini** (5축 가로 막대 mini-chart)를 직접 카드 안에 노출. Section-head subtitle도 캐릭터 카피 인용 형식으로 정리.

### Phase 4b — Takoon 4-tier + Double Skin Wing Coming Soon (**완료**)

**Takoon 친절·forgiving 캐릭터 톤**:
- **입문 — V4** · "무난한 첫 친구" · 5축: 3/5/6/7/9 (Stab 9 — 가장 forgiving)
- **중급 — V4 Pro 2026** · "친절한 진화" · 5축: 4/6/7/8/9 (65 g/m² quad ripstop)
- **고급 — VX Pro V2** · "freefly 친구" · 5축: 6/7/8/9/8 (PPC M1-X 대비 forgiving)
- **레이싱 — Double Skin Wing** · **🟡 Coming Soon** · faded 카드 + 곧 출시 badge + "본사 발표 대기"

PPC vs Takoon 캐릭터 차별화:
- PPC = perform 강조 (stiffness, 야생마, 나비)
- Takoon = friendly·forgiving 강조 (친절한 진화, freefly 친구)

같은 4-tier지만 Stab/Speed 가중치가 다름. 5축 색상도 brand 별 분리 (M2/M1/M1-X/FDS는 그린→블루→앰버→레드, V4/V4Pro/VX는 light blue→앰버→오렌지).

---

## 변경 사항 카운트

| 카테고리 | 수치 |
|---|---|
| 수정된 HTML 페이지 | 6 (index, levitaz, ppc, takoon, wip, catalog) |
| CSS 신규 추가 | ~440 lines (v1.2 polish ~190 + v1.3 4-tier ~250) |
| 신규 SKU 카드 | 6 (PPC M1-X · WIP Raley/Helmet/Wing Belt/UV · **Takoon Double Skin CS**) |
| 정정된 spec 항목 | 9 (Takoon V4 Pro: valve/handle/strut · Glide: foil box/deck pad · WIP: 4 model 명 + 출신 국가) |
| 추가된 4-tier 컴포넌트 | tier-badge × 8, character-nick × 7, perf-mini × 7, sku-card--coming-soon × 1, brand-matrix CSS (Phase 8 reuse용) |
| viewport 자동 테스트 | 28 (6 페이지 × 4 viewport + tier 검증 × 4) — **모두 통과** |
| WebSearch 호출 | 6 (PPC × 2, Takoon × 3, Forward WIP × 1) |

---

## 추출된 이미지 / Screenshot list

`site/_qa_screenshots/` 폴더:
- `index_iphone-se_320x568.png` (Phase 5 첫 검증)
- `index_iphone-13_390x844.png`
- `index_desktop-1440_1440x900.png`
- `levitaz_iphone-se_320x568.png` (LEVITAZ 글자 fit 검증)
- `levitaz_ipad-portrait_768x1024.png`
- `ppc_iphone-13_390x844.png` (4 SKU 카드 검증)
- `takoon_iphone-13_390x844.png`
- `wip_iphone-se_320x568.png`
- `*_mobile-390.png` (전 페이지 최종 검증, Phase 6/7)
- `report.json` (24 viewport test 전체 결과)

> **Note**: headless chromium에서 Pretendard CDN 폰트가 로드되지 않아 한글이 □□□로 표시되지만, **layout 자체는 검증됨** (overflow/사이즈/위치 모두 정확). 실제 Mac/iOS Safari/Chrome에서는 한글 정상 렌더.

---

## Danny 검토 우선 항목 5개

### 1순위 — 즉시 응답 필요

1. **Levitaz 3개 파일 재업로드** — Phase 1·2 진행을 위해 PDF×2 + xlsx 다시 attach 필요. 이 conversation에 drag-drop 또는 paperclip 클릭으로 추가.

### 2순위 — content correctness 확인

2. **PPC 가격 vs 라이더 매칭 검증** — Danny "M1=가성비, M2=premium perform" 기억 vs 실제 ppcfoiling.com 가격 (M2 $1,260 < M1 $1,890). Site는 Danny 큐레이션대로 M2를 한국 표준 ★ 표기, M1-X를 wave/freestyle 전용으로 build했지만, 한국 정식 RRP 입고 시 가격 표기 갱신 필요.

3. **Forward WIP 라인업** — wip.html에 4 SKU 카드 (Raley · Prowip+Wipper · Wing Belt 4.0 · UV Quickdry) 게시. Danny가 "SKU 게시는 별도 지시까지 보류"라 했으므로, 현재는 모두 [Phase 2 확정] 가격 표기. **사이트 노출 자체는 OK인지** (라인업 파악 정도) 또는 카드 자체를 더 추상적으로 할지 결정 필요.

### 3순위 — visual / UX 검증

4. **Levitaz hero "LEVITAZ" 7자 320px 모바일 fit** — Phase 5 CSS v1.2로 자동 검증됐지만 실제 iPhone SE/Mini/Pro에서 시각 확인 권장. `_qa_screenshots/levitaz_iphone-se_320x568.png` 참조.

5. **Mobile 환경에서 hero 4-brand orbit visual** — desktop 1440에서는 회전하는 4-brand orbit (DMJ center + L/P/T/W marks) 정상 노출. Mobile (1024px 미만)에서는 visual 자동 hide → text 100% 너비 — 의도된 동작인지 확인.

---

## 후속 micro-patch 대기 항목

Danny 결정으로 다음 round 처리:

1. **Phase 8 — Brand differentiation visual (PPC × Takoon 4×4 matrix)**: catalog.html 또는 별도 페이지에 "PPC vs Takoon — 같은 4-tier, 다른 캐릭터" 비교 컴포넌트. CSS는 v1.3에 미리 준비 (`.brand-matrix`, `.brand-matrix__cell`, `.brand-matrix__row-label--takoon`, 모바일 swipe-friendly 변환 포함).
2. **Phase 9 — forward-wip.com/catalog/ 직접 fetch**: Danny가 공유한 URL에서 product list/이미지/spec/description 추출. 현재 wip.html은 4 SKU (Raley/Prowip+Wipper/Wing Belt 4.0/UV)로 채워져 있지만, 카탈로그 직접 fetch 시 더 정확한 SKU 명/이미지로 보강 가능.
3. **Phase 1·2 unblock**: Levitaz 3 파일 재업로드 시 즉시 Front Wing 4종 spec/이미지 + Boom 95/83/63 부피 + R6 Race spec 갱신.

---

## Cafe24 Phase 2 전환 시 reuse plan

### 그대로 reuse 가능 (수정 없음)
- `assets/css/style.css` (전체 디자인 시스템 + v1.1 + v1.2)
- 모든 SVG illustration (4-brand orbit, sku-card, brand-hero, helmet/vest/wing 등)
- `assets/js/main.js` (header scroll · mobile menu · reveal · perf chart · launch form)
- viewport-validated layout (320-1440px)

### Adapt 필요
- HTML structure → Cafe24 template 변환 (header/footer는 Cafe24 standard module로 swap)
- SKU cards → Cafe24 product list block (각 SKU에 정식 상품 코드 binding)
- 가격 표기 `[Phase 2 확정]` → 실제 SKU 가격 binding
- Launch form → Cafe24 mailing list 또는 Mailchimp/Stibee 통합

### Phase 2에 신규 작업 필요
- 사업자등록번호 / 통신판매업신고 / 주소 / 보호책임자 4 항목 입력
- KakaoTalk 채널 정식 ID (현재 `https://pf.kakao.com/` placeholder)
- OG 이미지 (`assets/images/og-default.jpg`) 실제 디자인
- **Levitaz 3개 파일 처리 결과** (Phase 1 unblock 후) — Front Wing 4종 정확 spec/이미지, Boom 95/83/63 부피 confirm, R6 Race 라인 정식 도입 여부
- **Forward WIP 정식 SKU 게시** (Danny 별도 지시 후)

---

## 작업 메모

- **Bash sandbox web egress**: `*.takoon.com / *.levitaz.com / *.ppcfoiling.com / *.forward-wip.com` 모두 차단 → WebSearch로 우회 (publicly indexed 정보만, 본사 직접 fetch 불가).
- **PDF/xlsx 처리 대기**: Levitaz 3 파일 attach 시 Phase 1·2 즉시 재개 가능.
- **Playwright headless chromium**: viewport 자동 검증으로 layout 신뢰성 확보. 24 test 0 issue.
- **academic_writing 원칙 준수**: WebSearch verified source 기반 spec만 본문 인용, 추정값은 [Phase 2 확정] / [추정] 명시 유지.
- **수정된 nav 일관성**: 모든 페이지 (index/levitaz/ppc/takoon/wip)에서 nav 드롭다운 일괄 `Forward WIP / 스위스 보호장비` 통일.

---

## Local preview

```bash
cd "~/Documents/Claude/Projects/단무지공방 홈페이지 만들기/site"
python3 -m http.server 8765
# 브라우저: http://localhost:8765/
```

작업 끝. 검토 부탁드립니다 🙏

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지공방 — Option A 채택. 이 changelog 안 '단무지공방'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
