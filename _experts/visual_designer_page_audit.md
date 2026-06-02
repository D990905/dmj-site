# visual_designer_page_audit.md — 페이지별 visual audit 심화

| 항목 | 내용 |
|---|---|
| 문서 유형 | 페이지별 detailed visual audit (제품 4종 · commerce · auth · conversion · chapter · tools · info) |
| 작성 | Visual Designer (전문가 #1) · 2026-06-01 |
| 대상 | `site/` 의 모든 사용자 facing 페이지 (라이딩 대시보드 제외 — `expert_dataviz_reference.md` § 별도) |
| 모(母) 문서 | `_experts/expert_visual_designer_reference.md` §2-4 · §2-5 의 페이지별 audit 심화 |
| 범위 | Phase 1 — production 코드 무수정. 페이지별 강점 / 약점 / 우선순위 권장 |
| 협업 | UX Researcher (#5) heuristic 협업 · Frontend Engineer (#4) 구현 · Marketing (#) copy · DataViz (#2) chart 표현 |

> **읽는 법.** 페이지마다 (1) **개요** (목적·핵심 user flow) · (2) **시각 강점** (보존 항목) · (3) **시각 약점** (개선 후보) · (4) **우선순위 권장** (P1 즉시 / P2 Phase 2 / P3 백로그). 각 페이지 spec 30-50 lines, 분량 균형. §A 제품 4종 → §F 정보 페이지 순서. 페이지별 line 수 표시로 작업 부하 가늠 가능.

---

## 0. 페이지 line 수 매트릭스

| 카테고리 | 페이지 | 라인 수 | 핵심 user flow |
|---|---|---|---|
| 홈 | index.html | 992 | Hero → philosophy → consultation hub → find-my-gear |
| 제품 | levitaz.html | 1330 | Brand hero → series → SKU grid → spec table → inquiry CTA |
| 제품 | ppc.html | 772 | Brand hero → M2/M1-X/M1/Sonic 4-tier → SKU grid |
| 제품 | takoon.html | 1037 | Brand hero (gradient) → Wing 3-tier · Board 6 model |
| 제품 | wip.html | 780 | Brand hero (safety) → Impact Vest / Helmet / Wetsuit / Harness |
| 전환 | find-my-gear.html | 951 | 5-step quiz → 매트릭스 lookup → 결과 SKU 카드 |
| 커머스 | cart.html | 471 | Cart line items → 합계 → 견적 요청 CTA |
| 커머스 | quote.html | 619 | 견적 입력 form → 카톡 연동 + 확인 |
| 회원 | profile.html | 2877 | Hero avatar → tier → 라이딩 세션 history → 견적 history → 설정 |
| 회원 | login.html | 292 | Email + password (Supabase) → Kakao OAuth |
| 회원 | signup.html | 288 | 가입 form → email verify |
| 챕터 | level/beginner.html | 513 | Cons-hero → 다음 단계 → SKU 추천 → 카톡 CTA |
| 챕터 | level/(intermediate·advanced·pro·novice).html | 283-480 | 동일 패턴 |
| 챕터 | style/choppy-freeride.html | 333 | Cons-hero → 한국 spot → SKU |
| 챕터 | style/(flat-speed·wave·hybrid).html | 337-354 | 동일 패턴 |
| 도구 | calculator.html | 1638 | Lift calc — 입력 → 결과 → graph |
| 도구 | glossary.html | 960 | 윙포일 용어 사전 (A-Z + tag filter) |
| 정보 | membership.html | 802 | 회원 등급 + benefits |
| 정보 | consult.html | 430 | Danny + 조수철 코치 응대 CTA |
| 정보 | policies.html | 349 | 환불 / 배송 / 개인정보 / 약관 |

총 약 14,633 lines (top-level) + 3,587 (level/style chapter) = ~18k. 본 audit 는 카테고리별 spotlight + 동일 패턴 페이지 합산.

---

## A. 제품 4종 페이지 (levitaz · ppc · takoon · wip)

### A-1. levitaz.html — 1330 lines

**개요.** Levitaz 오스트리아 정밀 카본 hydrofoil 브랜드. Free Series 4 foil · Boom Boards 3 model · R6 Race 시리즈. Brand voice: "The Original. Reinvented." Premium technical.

**시각 강점 (보존):**
- `brand-hero__name` 큰 LEVITAZ 타이포 (Inter EN · weight 800) — brand identity 정통
- `brand-hero` gradient (navy → sea, `visual_designer_brand_color_spec.md` §1-1) — Levitaz 의 premium technical 정체성 매칭
- `loading="eager" decoding="async" fetchpriority="high"` LCP 최적
- canonical · og:* meta 풀 박힘
- Pretendard Variable + Inter + JetBrains Mono CDN preconnect (3 preconnect) ✅
- 1330 line — Levitaz 가 가장 product depth 큼 (Free + Boom + R6 + Accessories), 페이지 분량 비례
- SKU 카드 + spec compare table 일관

**시각 약점 (개선 후보):**
- nav search button `disabled title="Phase 2 예정"` (UX §0 Top 1 위반) — false affordance
- brand-hero 색이 인라인 hex 가능 (style.css `:1430-1773` 검증 필요) — Phase 2 의 brand color 토큰화 (`brand_color_spec.md` §3-1) 와 묶음
- Trust-bar 3 항목 (정식 수입 / 당일 출고 / 카톡 상담) — 메인 사이트 4 항목 (3회 올림픽 · 네 브랜드 · 당일 출고 · 1:1 카톡) 과 **불일치** (UX §0 Nielsen #4)
- SKU 카드 의 brand monogram 표기 부재 — brand recognition 약화

**우선순위 권장:**
- **P1**: Trust-bar 일관화 (Frontend layout) · search button 제거 (UX Top 1) · brand-hero 토큰화 (Phase 2-A)
- **P2**: SKU 카드 좌측 stripe 또는 brand-chip 추가 (`brand_color_spec.md` §3-5)
- **P3**: brand story video block (`style.css:2021-2054`) 의 활용 강화 — Marketing 협업

### A-2. ppc.html — 772 lines

**개요.** Pacific Performance Company (NZ) 의 hyperperformance wing. M2 / M1-X / M1 / Sonic FDS 4-tier 큐레이션. Brand voice: "Built different. Engineered in NZ."

**시각 강점:**
- 4-tier curation 의 시각 위계 — 가장 추천(M2) → entry(Sonic FDS) 진행
- brand-hero gradient (sea → light sea, tonal blue) — PPC 의 sky / speed 정체성

**시각 약점:**
- Levitaz 와 동일한 nav · trust-bar 불일치
- brand-hero `brand-hero__name` 가 light sea 위 white text — contrast 3.8:1 borderline (brand_color_spec §4 발견). 단 96px+ large text 라 AA 통과
- 4-tier badge 시각 위계가 tier-badge (`style.css:2786-2813`) 와 일관한지 검증 필요

**우선순위 권장:**
- **P1**: Trust-bar · search button · 토큰화 (A-1 과 동일 sweep 으로)
- **P2**: 4-tier badge 의 PPC 색 일관 — brand monogram color 사용 (sea-dark) 또는 tier-badge 표준 색 (입문/중급/고급/레이싱) 중 결정 — Marketing 협업
- **P3**: M2 → Sonic 4-tier 의 시각 비교 차트 — DataViz 협업 (5축 mini-chart 활용 가능, `style.css:2836-2892`)

### A-3. takoon.html — 1037 lines

**개요.** Takoon 프랑스 brand. Wing 3-tier · Board 6 model 네 카테고리. 입문자 친화 "부담없는 시작". 2002년 bow kite 발명.

**시각 강점:**
- brand-hero 의 `<h1>` 에 **inline gradient** (`background:linear-gradient(120deg, #ffffff 0%, rgba(10,37,64,0.7) 100%)` + `-webkit-background-clip: text`) — Takoon 의 yellow gradient 위 white→navy 텍스트로 가독성 + 시각 임팩트 둘 다 잡음
- yellow gradient 가 입문자 친화 warm 정체성 — official Takoon black/gold 와 일치
- brand-hero `__name` color swap to navy (style.css:1995 의 `color: var(--color-navy)`) — yellow 위 navy 텍스트 AAA contrast

**시각 약점:**
- **H1 의 인라인 gradient style** — 다른 brand page (Levitaz/PPC/WIP) 는 plain h1, takoon 만 인라인 — 일관성 위반. **Phase 2 클래스로 추출** (`.brand-hero__name--gradient` modifier)
- 1037 lines 중 일부가 인라인 스타일일 가능성 (검증 필요)
- Wing 3-tier · Board 6-model 의 카테고리 시각 분리 — 같은 페이지에 2 카테고리가 들어가면 정보 구조 부담

**우선순위 권장:**
- **P1**: H1 인라인 gradient → `.brand-hero__name--gradient` modifier · Trust-bar 일관 · search button
- **P2**: Wing 3-tier 와 Board 6-model 의 시각 분리 — section divider 명확 (eyebrow + section-head 분리) · Sub-nav (Wing / Board) 권장 (UX 협업)
- **P3**: Takoon 의 brand story video — 입문자 친화 messaging Marketing 협업

### A-4. wip.html — 780 lines

**개요.** Forward WIP Franco-Swiss 안전장비. Impact Vest / Helmet / Wetsuit / Harness. Brand voice: 탑라이더들의 안전장비, professional 도구.

**시각 강점:**
- brand-hero gradient (charcoal → slate) — safety 도구의 deference 정체성. 4 브랜드 중 유일하게 무채색 = 시각 anchor
- Impact Vest / Helmet 등 4 카테고리 시각 분리 명확
- 안전장비라 photography 가 product 보다 라이더 사용 시나리오 중심 (검증 필요 — Marketing 협업)

**시각 약점:**
- WIP 의 official "high-visibility orange/yellow" 와 우리 charcoal 결정 — 우리 입장 (deference) 은 옳지만, WIP "high-vis" 정체성을 어딘가에서 표현 검토 필요. 예: helmet 사진의 high-vis 액센트가 잘 보이는지
- 본문에서 "안전" 메시지 가 photography 또는 testimonial 로 표현되는지 검증

**우선순위 권장:**
- **P1**: Trust-bar · search button · 토큰화
- **P2**: WIP의 "high-vis" identity 의 부분 표현 검토 — Marketing 협업 (예: 헬멧 photo 의 orange/yellow chin strap 강조)
- **P3**: 안전 testimonial section 신설 — Marketing 협업

### A-공통. 제품 4종 공통 audit

**공통 강점:**
- 4 페이지가 같은 `brand-hub` layout (`style.css:1430-1774`) — 일관성 강
- canonical / og:* / Pretendard CDN preconnect 모두 동일 ✅
- Stale SW auto-cleanup §172 inline 모두 동일 ✅
- nav · trust-bar · footer 사실상 동일 (Astro 분리 ROI 큰 영역)

**공통 약점:**
- 4 페이지 nav 가 사실상 복사 — 변경 시 4 곳 동시 sync 필요 (Frontend §0 audit)
- search button disabled 4 페이지 모두 노출 — UX Top 1
- brand-hero 색이 모두 인라인 hex — `brand_color_spec.md` 토큰화 sweep 대상

**Phase 2 sweep plan (4 페이지 동시):**
1. brand-hero 토큰화 (brand_color_spec §3-1)
2. Trust-bar 일관 (Astro layout)
3. search button 제거 (UX Top 1)
4. nav 단일 source-of-truth (Astro)
5. Takoon h1 gradient → modifier
6. brand monogram (L/P/T/W) hero 또는 SKU 카드에 추가 (선택)

---

## B. 커머스 페이지 (cart · quote)

### B-1. cart.html — 471 lines

**개요.** 장바구니. SKU line items + 합계 + 견적 요청 CTA (Cafe24 미연결 — Phase 2 lead generation 정책).

**시각 강점:**
- `.cart-page__title` h1 명확
- graceful fallback — PRODUCTS = {} 시 placeholder ("가격 안내 받기") 로 에러 대신 액션 제시 (`cart.html:296`, UX §1-2 Nielsen #9 모범)
- cart counter badge (`nav__cart-badge`) 자동 업데이트 §171-B

**시각 약점:**
- **Loading state 미명시** (UX §0 Top 5) — 데이터 fetch 중 시각 신호 없음 → "fail 인가 slow 인가" 인지 부담
- empty cart 디자인 검증 필요 (`quote.html` 의 "장바구니에 상품이 없습니다" h1 와 동일 패턴인지)
- 견적 요청 CTA 의 시각 위계 — 가장 강조돼야 (cart 의 최종 conversion)
- line item 의 brand 표시 부재 — `brand-chip` 도입 시점 (Phase 2-C, `brand_color_spec.md` §3-5)

**우선순위 권장:**
- **P1**: Loading skeleton 표준 컴포넌트 (UX §0 Top 5) — aria-busy + 스켈레톤 row
- **P2**: brand-chip 도입 — 각 line item 의 brand 시각 인식
- **P3**: 견적 요청 CTA 의 시각 강조 — 색 + 사이즈 sweep (Marketing 협업)

### B-2. quote.html — 619 lines

**개요.** 견적서 form. cart line items 자동 import + 사용자 정보 + 카톡 연동 + 접수 확인.

**시각 강점:**
- 2 state — 입력 (form) vs 확인 (`.quote-confirm__title` "견적이 접수되었습니다") — 시각 분리 명확
- empty 상태 — `.quote-card__title` "장바구니에 상품이 없습니다" 의 graceful (cart.html 의 패턴 일관)
- Form input 의 `font-size: 16px` (`style.css:2758-2768` iOS zoom 방지 §)

**시각 약점:**
- Form field 의 focus state — Spec 1 (`visual_designer_phase2_specs.md`) 적용 전이라 ad-hoc
- 카톡 연동 CTA 의 시각 — 다른 CTA 와 위계 구분 필요 (카톡이 핵심 conversion)
- Confirm state 의 시각 — checkmark + 다음 step 안내가 명확한지

**우선순위 권장:**
- **P1**: Form focus ring 표준 (Spec 1) · input 16px 정책 유지
- **P2**: 카톡 CTA 의 위계 강조 — Kakao yellow (#FAE100) 활용 또는 sun 으로 단일화 (Marketing 협업)
- **P3**: Confirm state 의 다음 step (예: "1-2 영업일 내 응답") 시각 강화

---

## C. 회원 페이지 (login · signup · profile)

### C-1. login.html — 292 lines

**개요.** Supabase 인증 (email + password) + Kakao OAuth.

**시각 강점:**
- 단순 form 구조 — 시각 noise 최소
- Kakao OAuth 버튼 의 brand color (Kakao yellow) — 시각 인식 명확

**시각 약점:**
- 에러 메시지 generic ("로그인에 실패했습니다.", UX §1-2 Nielsen #9 일부) — security 이유로 의도적일 수 있음
- 비밀번호 재설정 link 의 위계 — primary CTA 와 구분
- "회원가입 으로 이동" link 의 위계

**우선순위 권장:**
- **P1**: focus ring (Spec 1) · 16px input
- **P2**: 에러 메시지 정책 — security vs UX trade-off (UX §1-2 Nielsen #9, Phase 2 Supabase 정책)
- **P3**: Kakao OAuth 버튼 시각 일관 (Kakao 공식 brand guidelines 준수)

### C-2. signup.html — 288 lines

**개요.** 회원 가입 form + email verify flow.

**시각 강점 / 약점 / 권장**: login.html 과 동일 패턴 — Phase 2 sweep 시 함께.

### C-3. profile.html — 2877 lines

**개요.** 마이페이지. avatar editable + greeting + tier + 라이딩 세션 history + 견적 history + 설정. **가장 큰 페이지 (2877 lines)** — 마이페이지가 여러 기능을 한 페이지에 누적.

**시각 강점:**
- **avatar editable button** — `profile-hero__avatar--editable` + 클릭 → file input + ✏️ overlay. polished interactive. §169-N v5-D DO_NOT_REVERT 정통
- hero greeting + tier — 환영 + status 한 화면
- 라이딩 세션 history 시각 카드 (검증 필요)

**시각 약점:**
- **2877 lines** — 한 페이지에 너무 많은 기능. 정보 압축 또는 tab/accordion 분리 권장 (UX 협업)
- avatar fallback "D" — Danny 의 단일 monogram. 사용자 이름 첫 글자 동적 변경 검증 필요
- 라이딩 세션 / 견적 history 가 진정한 카드 family 와 일관한지

**우선순위 권장:**
- **P1**: focus ring · avatar button a11y 검증 (현재 OK 추정 — `aria-label="프로필 사진 수정"` ✅)
- **P2**: 페이지 구조 정리 — tab 또는 accordion 으로 (라이딩 history / 견적 history / 설정 분리) — UX 협업
- **P2**: 라이딩 세션 카드 시각 — 라이딩 대시보드 `hero summary` 패턴 재사용 (DataViz 협업)
- **P3**: tier progression 시각 — 0% → 100% 진행 ring 또는 bar (membership.html 의 tier 시각과 일관)

---

## D. 전환 페이지 (find-my-gear)

### D-1. find-my-gear.html — 951 lines

**개요.** 5-step quiz (demographic / level / weight / style / sport) → 64-시나리오 매트릭스 lookup → 결과 SKU 카드. **사이트의 핵심 conversion funnel.**

**시각 강점:**
- 5-step quiz의 progress bar (`quiz-progress__fill`) — 시스템 상태 visibility
- step 별 h1 명확 ("당신은?" / "현재 본인 라이딩 레벨은?" 등)
- auto-advance ("선택 시 자동 진행") — 0.1s feedback 임계 통과
- 결과 페이지 의 SKU 추천 카드 — conversion 핵심
- find-my-gear 결과 2 CTA (견적서 / 카톡 상담) horizontal 동일 사이즈 lock §171 v3 — `style.css:360-380`

**시각 약점:**
- **Q5 명시적 skip 부재** (UX §0 Top 2) — "선택" 표기지만 skip 버튼 없음, NN/g form 원칙 위반
- progress bar 분모 `Step n / 5` — 결과 (step 6) 미포함 → "곧 끝난다" 시기 부정확
- 결과 SKU 카드 의 brand monogram / brand-chip 부재 — brand recognition 약화
- quiz step transition feedback — Q5 → 결과 사이 매트릭스 lookup 의 시각 신호 부재 (UX §1-1 Norman feedback)

**우선순위 권장:**
- **P1**: Q5 skip 버튼 + progress 분모 표기 정정 (UX Top 2) — DOM 변경, Phase 2-A
- **P1**: 결과 카드 brand-chip 도입 (`brand_color_spec.md` §3-5) — 4 브랜드 시각 분리
- **P2**: step transition fade-in (200-400ms) — 매트릭스 lookup feedback
- **P2**: 결과 URL share 가능 (UX §1-2 Nielsen #7 flexibility) — Phase 2 sessionStorage → URL state
- **P3**: quiz 각 step 의 contextual "?" tooltip — glossary 용어 inline

---

## E. 챕터 페이지 (level/* · style/*)

### E-1. level/beginner.html — 513 lines (대표 chapter)

**개요.** 입문·초급 챕터. cons-hero ("입문·초급의 다음 단계") → 컨설팅 내용 → SKU 추천 → 카톡 CTA. 5 level chapter 의 entry — 사용자 진입 빈도 높음.

**시각 강점:**
- `cons-hero__title` 의 `<em>` 강조 — gradient text 정통
- 챕터 별 정체성 (입문·초급 = beginner green pill 색) — level-card 의 색과 일관 가능
- consultation 내용 + SKU 추천 의 정보 구조

**시각 약점:**
- **Trust-bar 3 항목** (메인 4 항목과 불일치) — UX Nielsen #4
- **search button disabled** — UX Top 1
- 챕터 본문이 페이지마다 약간 다른 layout 사용 가능성 — 검증 필요

**우선순위 권장:**
- **P1**: Trust-bar 일관 · search button 제거 — 모든 chapter 동시 sweep
- **P2**: level pill (level-card 의 색) 과 cons-hero accent color 일관 — `.cons-hero--beginner` modifier
- **P3**: 챕터 내 SKU 추천 카드 의 brand-chip 도입

### E-공통. 5 level + 4 style = 9 챕터 공통

**5 level**: beginner (513) · novice (283) · intermediate (473) · advanced (480) · pro (474) — 라인 수 비교적 일관 (novice 가 가장 짧음 — 별도 챕터로 분리된 게 시각 정보량과 비례)

**4 style**: flat-speed (354) · choppy-freeride (333) · wave (337) · hybrid (340) — 매우 일관 (각 ~335 lines)

**공통 sweep plan:**
1. Trust-bar 일관화 (Astro layout, 9 페이지 동시)
2. search button 제거 (9 페이지)
3. cons-hero level/style modifier (`.cons-hero--beginner` `.cons-hero--choppy` 등) — accent color 일관
4. SKU 카드 brand-chip 도입 (선택)
5. **챕터 간 cross-link 시각** — chapter 끝에 "다음 단계 →" 또는 "관련 챕터" 권장 (UX §1-1 Norman 7단계 의 6 해석 → 7 평가 강화)

### E-2. style/choppy-freeride.html — 333 lines (한국 표준 스타일)

**추가 spot.** 한국 라이딩 환경의 default style — "Style · 표준" 라벨 (`index.html:437` 참조). 이 페이지는 한국 사용자에게 가장 자주 진입할 챕터.

**우선순위 추가**:
- **P2**: 한국 대표 spot photography (광안리·기장·제주 함덕) 의 hero — Marketing 협업
- **P2**: choppy-freeride 의 default 라벨 시각 — section-head 의 eyebrow 에 "Default · 한국 표준"

---

## F. 도구 · 정보 페이지

### F-1. calculator.html — 1638 lines

**개요.** Lift Calculator. 윙·포일 takeoff 임계 속도 계산. 입력 (체중·윙 사이즈·풍속·foil profile) → 결과 + graph. 라이딩 대시보드 외 또 다른 정량 도구.

**시각 강점:**
- `calc-hero__title` 의 `<small>` 부제 — typography hierarchy
- 단무지공방 calculator 의 신뢰 — Sports Science 의 검증된 model
- Lift calculator 의 graph (1638 lines 의 일부) — visual 핵심

**시각 약점:**
- **1638 lines** — 큰 페이지. 입력 form + 결과 + graph + selftest (개발) 일체. 정리 가능
- graph 시각 — 라이딩 대시보드 chart 와 일관한지 검증 (`chart-theme.js` 토큰 사용 권장)
- 결과 표현 — number typography `--fs-num-*` 토큰 활용 검증

**우선순위 권장:**
- **P1**: graph 시각 — `chart-theme.js` 의 status / category 색 토큰 사용 (DataViz 협업)
- **P2**: 페이지 구조 정리 — 입력 / 결과 / graph / selftest 분리 (selftest 는 dev-only hidden 권장)
- **P3**: 모바일 graph 의 가로 스크롤 indicator

### F-2. glossary.html — 960 lines

**개요.** 윙포일 용어 사전. A-Z + tag filter. 입문·초급도 컨설팅을 따라올 수 있도록.

**시각 강점:**
- `.glossary-hero__title` 의 `<em>` gradient 정통
- 용어 정의 정보 구조 (input filter + 가나다순 list)

**시각 약점:**
- 용어 카드 의 시각 위계 — term · pronunciation · definition · example 분리
- tag filter 의 시각 (chip group) — 다른 toggle group 과 일관한지

**우선순위 권장:**
- **P1**: focus ring (filter chip) · 16px input
- **P2**: 용어 카드 의 typography 위계 — term (lg) → pronunciation (xs) → definition (base) → example (sm)
- **P3**: contextual cross-link — 용어 내 다른 용어 참조 시 link

### F-3. membership.html — 802 lines

**개요.** 회원 등급 안내. tier benefits + progression.

**시각 강점:**
- `cons-hero__title` "단무지공방 회원 등급" `<em>` gradient
- tier benefits 시각 표

**시각 약점:**
- tier badge 시각 — `tier-badge` (`style.css:2786-2813`) 와 일관한지
- benefits compare table — compare-table 컴포넌트 사용 검증

**우선순위 권장:**
- **P1**: tier badge 일관 (level-card 의 pill 색과 tier-badge 의 색 정합 — Marketing 협업)
- **P2**: profile.html 의 tier progression 과 시각 일관 — 0% → 100% bar 또는 ring

### F-4. consult.html — 430 lines

**개요.** 1:1 구매 상담. Danny 박사 + 조수철 코치 직접 응대 CTA.

**시각 강점:**
- 단순 명료 — single CTA (카톡 상담)
- 두 코치의 credential 시각 (사진 + role)

**시각 약점:**
- 카톡 CTA 의 시각 위계 — Kakao yellow vs 우리 sun 의 통합 정책
- 코치 사진 의 시각 일관 (avatar 크기·crop·border)

**우선순위 권장:**
- **P1**: 카톡 CTA 정책 일관 (cart/quote 의 카톡 CTA 와 sync)
- **P2**: 코치 avatar 시각 — persona-card 패턴 활용

### F-5. policies.html — 349 lines

**개요.** 환불 / 배송 / 개인정보 / 약관 4 정책.

**시각 강점:**
- 단순 정보 페이지 — typography 위주
- 4 tab 또는 section 분리 (검증 필요)

**시각 약점:**
- 정책 본문 typography — body line-height + paragraph spacing 의 readability
- tab/anchor navigation 의 sticky 여부

**우선순위 권장:**
- **P1**: focus ring (tab/anchor)
- **P2**: 본문 typography 정리 — h2 / p / ol / ul 의 일관 spacing
- **P3**: sticky tab navigation (긴 정책 본문에서 step navigation)

---

## G. 종합 — Phase 2 페이지 sweep 우선순위

**페이지 sweep 의 효과 매트릭스 (페이지 수 × 변경 영향):**

| Sweep | 영향 페이지 | Effort | 우선순위 |
|---|---|---|---|
| **Trust-bar 일관화 (Astro layout)** | 128 페이지 모두 | 2-4h (Astro 도입 시 1h) | **P0** |
| **search button 제거** | ~10+ 페이지 (nav 포함된 모든 페이지) | 30m (Astro) / 2h (sweep) | **P0** |
| **Brand-hero 토큰화** | 4 제품 페이지 | 1-2h | **P0** |
| **focus ring (Spec 1)** | 모든 페이지 (CSS 1 곳) | 2-4h | **P0** |
| **find-my-gear Q5 skip + progress** | 1 페이지 | 1-2h | **P1** |
| **brand-chip 도입** | cart · quote · find-my-gear 결과 · profile session | 2-3h | **P1** |
| **Cons-hero level/style modifier** | 9 챕터 페이지 | 2h | **P1** |
| **Profile 정보 구조 정리 (tab)** | 1 페이지 | 4-6h | **P2** |
| **Loading skeleton 표준 컴포넌트** | cart · quote · find-my-gear · profile · 등 | 2-4h | **P1** |
| **Takoon h1 gradient modifier 추출** | 1 페이지 | 30m | **P2** |
| **Calculator graph 시각 일관 (DataViz)** | 1 페이지 | 2-3h | **P2** |

**Phase 2-A 첫 sprint 권장 (Frontend dispatch 시):**

1. Astro layout 도입 → Trust-bar / search button / nav / footer 통일 (한 commit 으로 128 페이지 정리)
2. Brand-hero 4 제품 페이지 토큰화 (brand_color_spec §3-1)
3. Focus ring 표준화 (Spec 1)
4. find-my-gear Q5 skip + progress (UX Top 2)
5. brand-chip 도입 + cart/quote/find-my-gear 결과 적용

**Phase 2-A 합산 약 12-20h** ≈ 2-3 일.

---

## H. 협업 매트릭스

| 영역 | UX Researcher (#5) | Frontend Engineer (#4) | DataViz (#2) | Marketing (#) | Mobile App (#8) |
|---|---|---|---|---|---|
| Trust-bar 일관 | Nielsen #4 검증 | Astro layout 구현 | — | 4 항목 확정 | — |
| search button | Top 1 plan | 제거 sweep | — | — | — |
| brand-chip | recognition 검증 | 컴포넌트 추가 | — | 색 확정 (`brand_color_spec.md`) | iOS/Android 패리티 |
| find-my-gear Q5 skip | Top 2 plan | DOM 변경 | — | copy "건너뛰기" | — |
| Profile tab 분리 | tab IA 결정 | DOM 재구조 | session card 표현 | — | 모바일 앱 sync |
| Calculator graph | — | 구현 | chart-theme 적용 | — | — |
| Loading skeleton | aria-busy 표준 | 컴포넌트 추가 | dashboard 카드 패턴 | — | iOS shimmer 패리티 |
| 카톡 CTA 정책 | 위치 일관 | 컴포넌트 | — | Kakao brand guidelines | — |

---

## 부록 — 사용된 reference 파일

**프로젝트 내부**
- `_experts/expert_visual_designer_reference.md` §2-4 · §2-5
- `_experts/visual_designer_phase2_specs.md` (focus ring · 토큰 · 인라인 추출 · 아이콘 · OKLCH)
- `_experts/visual_designer_brand_color_spec.md` (4 브랜드 색 토큰)
- `_experts/visual_designer_component_catalog.md` (컴포넌트 catalog)
- `_experts/expert_ux_researcher_reference.md` §0 Top 5 · §1-2 Nielsen heuristics · §3 audit
- `_experts/expert_frontend_engineer_reference.md` §0 · §3-4 layer · §6 CI/CD
- `_experts/expert_dataviz_reference.md` (chart 표현)

---

_Last updated: 2026-06-01_
_페이지별 visual audit 심화 — Phase 2 sweep 우선순위 매트릭스 제공. Frontend dispatch 시 Astro layout 도입과 동시 sweep 권장._
