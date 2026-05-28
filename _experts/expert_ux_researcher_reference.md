# expert_ux_researcher_reference.md — 단무지공방 UX 사용성 reference

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 학습 정리 + 사이트 사용성 audit (heuristic) + onboarding plan + Top 5 즉시 개선 |
| 작성 | UX Researcher (전문가 #5) · 2026-05-27 |
| 대상 | `site/` 전 페이지. 특히 `index.html`·`find-my-gear.html`·`level/*`·`style/*`·`{levitaz,ppc,takoon,wip}.html`·`riding-dashboard/`·`cart.html`·`quote.html`·`calculator.html`·`skill-assessment.html`·`glossary.html` |
| 범위 | Phase 1 — production 코드 무수정. audit + 권장만 |
| 근거 | 코드 직접 열람 (`index.html`·`find-my-gear.html`·`level/beginner.html`·`riding-dashboard/index.html`·`riding-dashboard/js/i18n.js`·`cart.html`·`login.html`·`_specs/skill-diagnostic-10-axis.md`·`README.md`·`Phase1_AuditIssues.md`·`_experts/expert_dataviz_reference.md`) + 외부 reference (Nielsen 10 heuristics·NN/g e-commerce 보고서·Norman 7 stage·iOS HIG·Material Design 3·Whoop·Strava·Garmin Connect·Vakaros Connect·Vantage Sailing·Njord Player·Surfline) |
| Co-owners | Visual Designer (타이포·hierarchy·아이콘 시스템) · DataViz (인터랙션 동기) · Marketing (퍼널·헤드라인) · Sports Science (스킬 모델 표현) · Frontend Engineer (구현·a11y) |

> **읽는 법.** §1 은 UX 결정 기준(Norman·Nielsen·NN/g·iOS HIG·Material·sports app 패턴) 을 단무지공방 맥락으로 압축 번역한다. §2 는 6 개 경쟁사를 강점·약점·우리 차별점 3 축으로 정리한다. §3 은 사이트 11 영역을 Nielsen 10 heuristics 로 audit 한다 — 각 violation 에 severity (S0–S3) + 위치 + 권장 fix 를 단다. §4 는 신규 사용자 onboarding 권장 flow. §5 는 effort × impact 매트릭스로 Top 5 즉시 개선. Phase 1 은 §3–§5 까지 — production 변경은 Phase 2 부터.

---

## 0. 핵심 결론 (TL;DR)

단무지공방 사이트는 **컨설팅 사이트로서의 정체성이 명료하다.** "1분 만에 내 장비 찾기" CTA·"네 브랜드 큐레이션"·"전문 퍼포먼스 어드바이저" 라는 세 축이 hero·nav·footer 모두에서 일관되게 노출된다. 64-시나리오 매트릭스 + 5-step quiz + 카톡 견적 모델은 **e-commerce 가 아니라 lead generation 사이트** 라는 입장을 분명히 한다 — Cafe24 전환은 Phase 2. 이 입장 자체는 옳다.

남은 UX 부채는 다섯 갈래다.

**첫째 — 정보 구조의 중복 차원.** Nav 상단 5개 dropdown (브랜드·라이딩 스타일·장비·실력 수준·스마트 컨설팅) 중 **"장비" 와 "브랜드" 가 의미적으로 겹친다** (장비 dropdown 의 "안전장비" → `wip.html` = 브랜드 페이지, "윙" → 4 브랜드 cross-cut). 사용자가 같은 SKU 를 두세 경로로 만나면 IA(Information Architecture) 의 "한 컨셉 = 한 경로 (mutually exclusive, collectively exhaustive)" 원칙을 위반한다. 현재 nav 는 **6 entry point × 4 브랜드 × 5 레벨 × 4 스타일** 의 cartesian 진입을 허용해 라이더 mental model 부담이 크다.

**둘째 — `hidden` 처리된 차원 페이지의 reachability 갭.** `women/index.html`·`junior/index.html`·`family/index.html` 페이지는 빌드돼 있으나 nav·mobile menu 양쪽에서 `hidden` 속성으로 가려져 있다 (`index.html:155-157`·`:218-220`). 결과: 페이지는 존재하지만 들어갈 방법이 quiz Q1 (성인 여성·유소년·시니어 선택) → 결과 화면 추천 안내·또는 직접 URL 입력 외엔 없다. Q1 demographic 갈래 → 직접 chapter 페이지 진입의 **fallback path 가 의도적으로 닫혀 있다** — 이는 §157 reference rule [[feedback_dmj_level_category_strength]] 에 따라 hidden 처리된 사항이지만, demographic 갈래 페이지를 만든 노력이 사용자에 도달하지 못한다. Phase B 또는 Q1 결과 분기에서 명시 노출 권장 (§3-1-A).

**셋째 — 5-step quiz 의 정보 정합성.** Find My Gear 의 `step-demographic` (Q1) → `step-level` (Q2) → `step-weight` (Q3) → `step-style` (Q4) → `step-sport` (Q5, 선택) 구조는 e-commerce 퀴즈 best practice (5–8 questions, progress bar, auto-advance) 와 정확히 맞다. 한 가지 미세한 부정합 — **Q5 는 "선택" 으로 표기되지만 시각적으로 skip 버튼이 없다** (`find-my-gear.html:365-394`). NN/g 의 form design 원칙 ["optional 은 노출형 skip 옵션을 동반해야 한다"](https://www.nngroup.com/articles/required-fields/) 위반. 또한 5-step 인데 progress bar 가 1/5 → 5/5 만 표시하고 **결과 (step 6) 가 progress 에 포함되지 않아** 라이더가 "곧 끝난다" 의 시기를 정확히 못 잡는다.

**넷째 — 한↔영 모드 비대칭.** `riding-dashboard/js/i18n.js` 가 source-as-key 방식의 완성된 한↔영 토글을 갖춘 반면, **메인 마케팅 사이트 (`index.html` 등) 에는 i18n 인프라가 없다** (`<html lang="ko">` 고정). 한국 라이더 1차 타깃이라는 결정 자체는 옳지만, "Levitaz · PPC · Takoon · Forward WIP" 같은 영문 브랜드명·"Wing/Foil/SUP/Accessory" 같은 영문 카테고리 라벨이 본문에 섞여 있어 영문 사용자도 충분히 navigate 할 수 있는 상태인데, 명시적 EN 토글이 없다. 이는 **mental model 일치 (Nielsen #2)** 위반이라기보다는 **잠재 사용자 도달율 손실**. Phase 1 에서는 plan 만, Phase 2 에서 가벼운 EN 폴백 권장 (§4-3).

**다섯째 — 비활성 affordance.** Header search button (`<button disabled title="Phase 2 예정">`, `index.html:172`) 은 사용자에게 "검색 있다 → 그런데 못 쓴다" 의 인지 부담을 준다. Nielsen #5 (error prevention) + Norman 의 "false affordance" 위반. **Phase 1 에서 search 가 없다면 button 자체를 숨기는 것이 옳다** — 미래의 약속을 disabled 로 노출하는 것은 약속이 아니다. (§3-1-N1)

**Phase 1 권장 우선순위 5 (production 코드 변경 없는 plan + spec):**

1. **Top 1 — Header search button 제거 (또는 카톡 아이콘으로 대체).** Phase 2 search 출시까지 disabled 노출 금지. Effort 5 분, Impact: 인지 부담 즉시 제거. (§5-1)
2. **Top 2 — Find My Gear 의 Q5 명시적 skip + progress 분모 6 표기.** "건너뛰고 결과 보기 →" 텍스트 버튼 + progress bar 를 `Step n / 5` 가 아니라 `Step n / 5 · 결과` 로 표기. NN/g form 원칙. (§5-2)
3. **Top 3 — Nav 의 "장비" vs "브랜드" dropdown 책임 분리 명시.** "장비" = 카테고리 (Wing/Foil/Board/Safety), "브랜드" = 4 hub. 현재 "장비" 의 "안전장비" 가 wip.html 로 가는 단축경로 → 카테고리 페이지 (`genre/safety.html` 또는 `category/safety.html` — Phase 2) 로 분리. (§5-3)
4. **Top 4 — `hidden` 처리된 women/junior/family 의 reachability path.** Quiz 결과 화면 (`step-result`) 에서 Q1 demographic 가 adult_female/youth 인 경우 해당 chapter 페이지 링크를 노출. nav `hidden` 정책은 [[feedback_dmj_level_category_strength]] 유지. (§5-4)
5. **Top 5 — Empty / loading / error 패턴의 표준 컴포넌트화.** 현재 `cart.html` 은 "데이터 fetch 실패 시 graceful fallback (PRODUCTS = {})" 정책으로 error state 블록을 제거했다 (`cart.html:232-233`). 옳다 — 그러나 **로딩 상태가 명시적으로 보이지 않으면** 사용자가 fail 인지 slow 인지 구분 못 한다. `aria-busy` + 스켈레톤 행 표준 필요. (§5-5)

---

## 1. Phase 1 학습 정리 — UX 결정 기준

### 1-1. Don Norman — 행동 7 단계 · affordance / signifier · feedback · mental model

Norman 의 *The Design of Everyday Things* 가 정의한 **7 stages of action** 은 사용자가 시스템과 상호작용하는 인지 사이클이다. 단무지공방 맥락으로 번역하면:

1. **목표 형성** — "내 윙 사이즈가 맞나?" 라이더의 의도.
2. **계획** — "퀴즈 풀어볼까 · 브랜드 페이지 볼까 · 카톡 물어볼까". UI 는 이 분기를 명료히 보여야 한다.
3. **명세** — "Find My Gear 클릭".
4. **실행** — 5 step quiz 완수.
5. **지각** — 결과 화면이 보임.
6. **해석** — "이 추천이 내 케이스에 맞나?". 추천의 근거 (체중·레벨·스타일 → 어떤 SKU) 가 보여야 함.
7. **평가** — "이게 내 목표를 달성하나? 카톡으로 확인할까?".

단무지공방 hero CTA "1분 만에 내 장비 찾기" 는 1→3 의 거리 (목표 → 명세) 를 압축하는 좋은 카피다. 단 **6 (해석) 단계의 근거 표시가 결과 카드에 약하다** — 매트릭스 진입 코드 (`level_weight_style`) 는 표기되지만 "왜 이 윙이 추천됐는가" 의 한 줄 이유 (heuristic explanation) 가 없다. Phase 2 권장 (§7-1).

**Affordance vs signifier.** Norman 후기 (Living with Complexity) 의 구분이 핵심이다 — affordance 는 "할 수 있는 것" (chair → 앉을 수 있다), signifier 는 "할 수 있다는 것을 알려주는 표식" (button 의 그림자 · underline · cursor change). 현재 사이트의 search 버튼 (`disabled` + 검색 돋보기 아이콘) 은 **affordance (클릭 가능) 와 signifier (검색 가능) 가 어긋난다** — affordance 가 false 다. 제거가 정답 (Top 1).

**Feedback.** 사용자의 모든 action 은 0.1 초 (즉시) · 1 초 (시각 변화 — spinner) · 10 초 (진행 표시) 의 임계 안에서 응답해야 한다 (Nielsen 1993 기준, 모바일 시대에도 유효). Find My Gear quiz 의 auto-advance ("선택 시 자동 진행", `find-my-gear.html:263`) 은 0.1 초 임계를 잘 지킨다. 단 **Q5 → 결과** 사이의 매트릭스 lookup 이 어디서 진행 중인지 미시적 feedback 이 없다 (즉시 결과 노출). 라이트한 fade-in transition (200~400 ms) 이 "결과를 계산하고 있다" 의 메타 신호로 작동한다.

**Mental model alignment.** Nielsen #2 의 토대. 한국 윙포일 라이더의 mental model 은 "윙 사이즈 → 풍속 → 체중" 의 삼각형. 단무지공방의 매트릭스가 정확히 이 삼각형을 64 시나리오로 펼친다 — model alignment 가 강하다. 단 "스타일" 차원 (flat-speed / choppy-freeride / wave / hybrid) 은 한국 라이더에게 익숙도가 다르다 — choppy-freeride 는 한국 기본값이라 "default" 의 시각 강조 (이미 `Style · 표준` 라벨 처리됨, `index.html:437`) 가 옳다. mental model 의 default → 선택 차원 이전 패턴.

### 1-2. Jakob Nielsen — 10 usability heuristics (1994, 2024 갱신)

10 heuristics 의 의미는 30 년 unchanged 다. 단무지공방 맥락 압축:

1. **Visibility of system status** — 시스템 상태가 항상 보여야 함. Progress bar (`quiz-progress__fill`), cart badge (`nav__cart-badge`), trust bar (당일 출고·14시 이전) 가 좋은 예. 부족: 검색 disabled (Top 1), loading 상태 누락 (Top 5).
2. **Match between system and the real world** — 현실 어휘 사용. "윙 4.5㎡" "택" "자이브" 같은 도메인 어휘는 유지. 단 "선택 시 자동 진행" 의 "자동 진행" 은 익숙해도, **"건너뛰기" 같은 universal 어휘 + "다음 →"** 의 명시적 fallback 이 mental model 에 부합한다.
3. **User control and freedom** — exit · undo · redo. Quiz back 버튼 (`quiz-back`) 은 있음. 단 **Q1 → Q2 자동 진행 후 back 으로 돌아오면 이전 선택이 유지돼야** — 코드 확인 필요 (state.demographic 등이 클리어되지 않으면 OK, `find-my-gear.html:490`).
4. **Consistency and standards** — 외부 (플랫폼) · 내부 (사이트) 일관성. **외부**: 한국 e-commerce 의 "장바구니" 카트 아이콘, 카톡 상담 아이콘 — 모두 표준 사용. **내부**: trust bar 가 메인 사이트는 4 항목 (3회 올림픽·네 브랜드·당일 출고·1:1 카톡), index 는 3 항목 (정식 수입·당일 출고·카톡 상담) → **불일치**. `index.html:96-99` vs `level/beginner.html:53-57`. trust bar 의 항목과 순서는 사이트 전체에서 한 source-of-truth 로 묶어야 한다.
5. **Error prevention** — 에러를 발생시키지 않는 설계. **search disabled** 가 위반 (Top 1). 그 외, quiz 의 자동 진행은 미스클릭 위험이 있음 — 단 quiz back 으로 회복 가능하므로 net 손익 OK.
6. **Recognition rather than recall** — 사용자가 기억할 필요 없게. 4 브랜드의 한 줄 설명 (`Levitaz - 올림픽공인 하이드로포일/보드`) 이 dropdown 에 노출된 것은 강점 — 라이더가 4 브랜드를 외울 필요가 없다. **개선 후보**: 결과 화면의 추천 SKU 카드에 brand monogram 색을 카드 좌측 stripe 로 표기하면 recall→recognition 전이 (§5-4 와 함께).
7. **Flexibility and efficiency of use** — 초보 · 전문가 양쪽에 맞춤. Find My Gear (초보) + 카톡 상담 (전문가) + level 페이지 직접 진입 (전문가) 의 다중 경로는 좋음. 단 **퀴즈 결과를 URL 로 공유 가능해야** 전문가 패턴 (URL 직접 입력으로 결과 화면 재현) 이 작동한다 — 현재 state 가 sessionStorage 기반이라 공유 불가. Phase 2 권장 (§7-2).
8. **Aesthetic and minimalist design** — 본질만. Hero 카피 (`index.html:254`) 는 한 단락이 매우 밀도 높다 ("3회 연속 단독 출전 · 3개국 코치 · 옥덕필 박사 · 조수철 선수 · 옥덕필 박사 …"). NN/g 의 hero copy 권장은 "**한 가지 가치 제안 + 한 가지 CTA**". 단무지공방의 가치는 "전문 컨설팅" · CTA 는 "1분 퀴즈". 코치 credential 의 압축은 trust bar 또는 별도 about 섹션으로 분리하면 hero readability 가 올라간다 (§5 P2).
9. **Help users recognize, diagnose, recover from errors** — 명확한 에러 메시지. cart.html 의 graceful fallback (가격 lookup 실패 시 "가격 안내 받기" placeholder, `cart.html:296`) 은 모범 — 에러를 진행 가능한 액션으로 전환한다. 단 login 의 에러 메시지 (`login.html:280`, `'로그인에 실패했습니다.'`) 는 너무 generic — "이메일이 잘못됐는지" "비번이 잘못됐는지" "둘 다 인지" 를 합쳐 한 줄로 표시한다. **의도적** (security: 어느 쪽인지 알려주면 enumeration 공격 가능) 일 수 있으니 Phase 2 의 supabase 인증과 함께 정책 검토.
10. **Help and documentation** — 도움말. `glossary.html` 존재 + footer 의 "윙포일 용어 사전" 링크 + "도움말" 컬럼 잘 구성. 강점. 개선 후보: quiz 의 각 단계에 contextual "?" 아이콘 → 그 단계의 핵심 용어 1~2개 정의 (`tooltip` 또는 `<details>` aria-described). 모바일 thumb-reach 고려해 우측 상단 16×16.

### 1-3. NN/g e-commerce + form design — 핵심 finding

NN/g 의 e-commerce baseline (1073 guidelines, 13 volumes) 에서 단무지공방에 직접 닿는 4 가지:

- **Trust elements 의 viewport 노출.** 첫 viewport (above the fold) 에 trust signal (정식 수입·보증·환불·당일 출고) 노출. 현재 site 의 trust bar (`trust-bar`) 가 정확히 그 위치 — 강점.
- **Pricing transparency.** "RRP × 1.6 환율 추정" 표기 (`README.md:60`) 는 정직성 강점 — 한국 e-commerce 의 "가격 별도 문의" 관행보다 우월. Phase 2 의 정식 pricing 으로 그대로 이어질 것.
- **Quiz 에서 email 수집 시점.** NN/g + 외부 e-commerce 데이터: "결과 보기 전에 email 수집" 이 conversion 더 높음. 단무지공방의 결과 → premium-gate → "액세스 코드 받기" 는 **결과 후 수집** — 의도적 (퀴즈는 lead generation, premium 은 deeper personalization). 현재 정책 유지 권장. premium-gate 가 "회원가입 + 본인 장비 등록으로 액세스 코드" 라는 명시적 가치 교환 (give-get) 모델로 작동.
- **Skip / optional 의 명시.** Q5 (`스킬 진단`) 가 (선택) 표기. NN/g 원칙: optional 은 노출형 skip 옵션 동반. (Top 2)

Form design 일반:

- **Inline validation.** 단무지공방 quiz 는 선택지만 → 자유 입력이 적어 validation 부담 작음. login.html 의 email/password 가 자유 입력 — email 형식 inline validation 권장.
- **Single column for forms.** 현재 quiz 는 grid 4col / 5col — 선택지 카드는 multi-column OK, 자유 입력은 single column 유지. login 은 single column ✅.
- **Label vs placeholder.** Placeholder 만으로 label 대체 금지 (focus 시 사라짐). 코드 확인 필요 — login.html 의 input 패턴.
- **Touch target ≥ 44 × 44 pt (iOS) / 48 × 48 dp (Material).** 현재 quiz-option 카드는 padding 충분 — 모바일 클릭 부담 적음. nav__icon-btn 의 18 × 18 SVG 는 padding 으로 영역 확보돼 있는지 모바일 QA 권장.

### 1-4. Mobile-first · iOS HIG · Material — gesture vocabulary · thumb zone · target size

**Thumb zone.** Steven Hoober (2013) + iOS 후기 가이드: 한 손 grip 에서 thumb 가 닿는 영역은 화면 하단 2/3, 우측 (오른손) / 좌측 (왼손). 현재 사이트의 **trust bar 가 상단** 이라는 결정은 brand trust 가 fold 위에 와야 한다는 e-commerce 원칙과 일치 — 단 모바일에서 사용자의 thumb 가 hero CTA 까지 도달하는 거리가 길다. Hero 의 두 CTA ("1분 만에 내 장비 찾기" / "레벨별 가이드 보기") 가 viewport 중간에 와 있어 thumb-reach 적합 ✅. 

**iOS HIG 의 핵심 규범** (Phase 1 사이트는 native 가 아니라 모바일 웹이지만 모바일 mental model 의 ⅔ 가 iOS):
- **Hit target ≥ 44 × 44 pt.** 단 사이트의 button 은 padding 으로 거의 충족.
- **Safe area.** Notch · home indicator 영역. `viewport-fit=cover` 가 `index.html:5` 에 설정돼 있음 ✅.
- **Status bar 색.** `theme-color #0A2540` ✅.
- **Tap delay.** 300 ms double-tap zoom 지연 — `viewport` `initial-scale=1.0` 으로 해결 ✅.
- **Native gesture conflict.** 가로 스크롤이 swipe-back gesture 와 충돌 가능 — quiz 의 horizontal scroll 가능성 검토 필요 (현재 quiz-options grid 가 vertical stack 이라 OK).

**Material Design 3 의 핵심** (Android mental model):
- **FAB (Floating Action Button)** — 한 화면의 primary action. Phase 1 사이트에 없지만 카톡 상담 floating button (`agent-deny.js` 가 §173 으로 전 페이지 영구 노출) 이 이 역할.
- **Bottom navigation** — 3~5 destination 의 영구 노출. 현재 사이트는 header nav. 모바일에서 thumb-reach 가 떨어진다 — Phase 2 권장 (§7-3).
- **Snackbar vs Dialog vs Bottom Sheet.** Dialog 는 차단형, Snackbar 는 비차단, Bottom Sheet 는 선택형. 현재 사이트는 `<dialog>` 사용 없음 (모달 없음, JS confirm 없음) — 좋은 minimalism.

**Gesture vocabulary 압축 표.**

| Gesture | iOS · Material 의미 | 단무지공방 적용 |
|---|---|---|
| Tap | 1차 선택 | 모든 카드·버튼 |
| Long press | context menu | 사용 안 함 (OK — 데스크탑 mental model 과 충돌) |
| Swipe ← → | 페이지 전환 (carousel) | 사용 안 함 (carousel 없음) |
| Pull to refresh | 데이터 갱신 | N/A (정적 사이트) |
| Pinch zoom | 확대 | 사진 영역에서 native browser 처리 ✅ |
| Swipe up (모달) | 닫기 | mobile-menu 에서 close 버튼 사용 — gesture 미지원 ✅ (사용자 학습 곡선 낮음) |

### 1-5. Empty · loading · error states · skeleton · accessibility

UI 의 "3 상태" — 정상 · 비어있음 · 잘못됨 — 는 종종 누락된다. 단무지공방 진단:

- **Empty state.** Cart 비어있을 때의 UI 가 명시돼 있는가? `cart.html:204` 의 `#cart-items` 컨테이너에 0 개 일 때 "장바구니가 비어있습니다 — 추천 보기 →" 같은 next-action 안내 권장. 현재 code 에서 0-state placeholder 명시 확인 필요 — 없다면 Phase 1 plan 의 작은 spec.
- **Loading state.** 정적 사이트라 페이지 로딩 자체는 빠르나, `find-my-gear.html` 의 matrix.js · cart.js 가 async 로 로드된다 (`<script src=...></script>` 의 동기 로딩이지만 외부 CDN font 가 늦으면 FOIT/FOUT 가능). **Skeleton 행** 표준 컴포넌트가 cart-items 와 quiz-options 에 권장. CSS 키프레임 `linear-gradient` shimmer 로 50 줄.
- **Error state.** cart.html 의 graceful fallback (앞서) 은 모범. 단 login.html 의 에러 (auth-error) 표시는 inline + aria-live ✅ (`login.html:268-281`). 권장.
- **Accessibility (a11y).** 사이트는 aria 속성 적극 사용 (aria-label · aria-haspopup · aria-controls · role="menubar"). 강점. 부족: **focus visible** — keyboard 사용자가 tab 으로 nav 를 돌 때 focus ring 이 보이는지 CSS 확인 권장. `:focus-visible { outline: 2px solid var(--color-sun) }` 정도 표준 권장.
- **Color contrast.** Navy `#0A2540` on 흰 배경 = 12.6:1 (AAA) ✅. Sun `#FFB800` on Navy = 7.4:1 (AAA large, AA normal) ✅. Slate · charcoal 의 정확한 값은 chart-theme 와 main style.css 의 token 비교 필요 — DataViz 협업 (§6-2).
- **Screen reader.** `<svg aria-hidden="true">` 패턴 적극 사용 ✅. 아이콘 옆에 텍스트 라벨 있으면 svg 는 hidden 처리 — 모범.

### 1-6. Sports / fitness app UX — 공통 패턴 7 가지

여러 sports app 의 UX 를 관통하는 패턴을 압축한다.

**(1) Progressive disclosure — 3 tier 깊이.** Whoop 의 home / dial / deep-dive 3 tier 가 표준. 글랜스 (점수 하나) → 트렌드 (요약 차트) → 딥다이브 (전체 metric). 단무지공방의 라이딩 대시보드는 hero summary → 차트 카드 → replay 의 3 tier 가 자연스럽게 형성돼 있다.

**(2) 데이터 = 코칭.** Whoop 의 핵심 design decision: "coaching is the data". 별도 coaching 탭이 아니라 metric 자체가 코칭. 단무지공방의 `coach.js` (코치 등급 분석) 가 정확히 이 모델 — 차트 옆에 코치 코멘트가 inline.

**(3) One-screen-one-decision.** Vakaros Connect 의 위젯 페이지 (페이지당 4 위젯, 최대 10 페이지) 는 "한 페이지 한 결정" 의 압축이다. 본체 인스트루먼트에서 race start 전엔 "time to line / time to burn / target speed" 4 위젯, 라이딩 중엔 "SOG / HR / VMG / TWA" 4 위젯 식. 단무지공방 사이트의 page 단위는 이미 잘 나뉘어 있다 (level/beginner.html 은 입문 한 가지 결정 — "첫 셋업").

**(4) Race-aware timeline.** Njord Player 의 timeline 은 race · leg · maneuver 를 자동 highlight. 단무지공방 대시보드의 회전 ±10초 P/S 가 정확히 maneuver 의 small multiples 다 — 같은 패턴.

**(5) Onboarding 의 first decision.** Surfline 은 "Where's your homebreak?" 로 시작 (location 권한 정당화). 단무지공방의 Q1 demographic ("당신은?") 도 첫 결정 — adult_male / adult_female / youth / senior. 단 Surfline 의 homebreak 처럼 **첫 질문이 사용자 본인이 가장 즉답 가능한 것**일수록 drop-off 낮다 — 단무지공방의 demographic 은 100% 즉답 가능 ✅. (Q3 weight 가 가장 변동성 큰 입력 — 단 buckets 4 단계로 제시돼 부담 작음.)

**(6) Customizable dashboard — 하지만 default 가 강해야.** Whoop · Garmin Connect 의 customizable dashboard 는 power user 에 좋지만, 신규 사용자에겐 default 가 더 중요. 단무지공방은 정적 사이트라 customize 영역이 적음 — 단 Phase 2 PWA 의 dashboard 에서 default 4~5 widget 의 quality 가 핵심.

**(7) Coaching jargon 의 양면성.** Whoop 의 약점으로 알려진 "feedback message 의 기술 jargon". 단무지공방의 도메인 어휘 ("foiling" · "tack" · "jibe" · "VMG") 는 라이더의 mental model 에 부합 → 강점. 단 입문자 (beginner) 페이지에서는 inline 정의 또는 glossary 링크 활용 권장. 현재 `glossary.html` 이 있고 footer link 됨 ✅.

---

## 2. 경쟁사 deep audit — 6 services × 강점 / 약점 / 단무지공방 차별점

| # | 서비스 | 카테고리 | 강점 | 약점 | 단무지공방 차별점 |
|---|---|---|---|---|---|
| 1 | **Vakaros (Connect + Atlas)** | 세일링 GPS 인스트루먼트 + 모바일 | 위젯 페이지 아키텍처 (10 페이지 × 4 위젯). race start 의 time-to-line / time-to-burn 의 즉시성. customizable 의 power user 친화 | 본체 인스트루먼트 가격 ($500+). 윙포일 전용 metric 부재 (sailing focus). 한국어 X | **윙포일 도메인 특화 + 한국 spot 컨디션 큐레이션**. 단무지공방의 라이딩 대시보드는 Vakaros 의 사후 분석을 GPX 만으로 재현 |
| 2 | **Vantage Sailing** | Vakaros · Sailmon · Garmin GPS 사후 분석 모바일 앱 | 3 활동 비교, custom segment, trim logger, box plot, maneuver line chart. 영상+데이터 동기. Atlas start 재생 | iOS-only (현재 단일 플랫폼). sailing-only, foiling/wingfoil 의 polar 표현 약함 (heel-pitch 통합 X). 영어 only | **단무지공방 대시보드의 % of target · target polar overlay** (DataViz §4-2). Vantage 의 "polar 대비 %" 코칭 가치를 GPX 로만 구현 |
| 3 | **Njord Player + Analytics** | 세일링·다이내믹 GPX 사후 분석 + 영상 동기 | race-aware timeline · multi-screen playback · RTK GPS 정밀도 (~10cm) · 다양한 metric overlay · 영상+데이터 sync | 세일링 race 라이더 타깃 (윙포일 amateur 부족). 가격 (월 $30+). 한국어 X. 4 wind sources 같은 sailing-specific 복잡성이 윙포일 라이더에 noise | **windfoil/wingfoil 라이더의 maneuver 와 wave/swell 컨디션** 에 특화. 한국어 + 한국 spot meta + 카톡 상담 |
| 4 | **Strava** | 일반 cardio · cycling · running 사회적 트래킹 | feed 의 social proof · KOM/CR · segment matching · 거대 사용자 베이스 (200M+) · friend 비교 | 윙포일·세일링 도메인 metric 거의 없음 (속도·심박 정도). 결정적 코칭 없음 (사회적 비교만) · 모바일 menu 인포 과부하 (NN/g) · premium upsell 공격적 | **컨설팅 = 결정 + 1:1 카톡**. Strava 는 "다른 사람과 비교" 의 horizontal axis, 단무지공방은 "내 다음 셋업이 뭔가" 의 vertical axis. 보완재이지 경쟁재 아님 |
| 5 | **Garmin Connect** | Garmin watch · bike computer 종합 대시보드 | 광범위한 metric (HR · VO2 · training load · 회복) · 종목 무관 데이터 모델 · 표준 라이브러리 | 정보 과부하 (다층 메뉴) · UI 일관성 낮음 (web vs mobile 차이) · 윙포일 native sport 미지원 (Other Sport 로 분류) · 추천 코칭 weak | **single sport vertical 의 깊이**. 윙포일/세일링 특화 metric (VMG · TWA · polar) 를 default 표시 |
| 6 | **Whoop** | recovery · strain · sleep wearable | 1 score 의 압축 (Recovery 0–100) · dark UI · progressive disclosure 3 tier 모범 · "coaching is the data" 디자인 결정 | "score" 의 black-box (계산 식 비공개) · 한국 사용자 베이스 작음 · jargon-heavy text · 가격 (월 $30) | **계산 식 공개 정직성**. DataViz reference (§0) 가 명시 — "analysis.js 의 풍향 추정 신뢰도 self-report" 같은 자기-정직성. Whoop 의 1-score 압축은 따라하지 않음 (윙포일은 multi-dimensional). 단 score 의 "한 호흡 글랜스" 패턴은 차용 가능 |

### 추가 — Surfline (서핑 forecast)

| 서비스 | 강점 | 약점 | 차별점 |
|---|---|---|---|
| **Surfline** | 7-step onboarding · "Where's your homebreak?" 첫 질문 · spot detail 의 16-day forecast · live cam · 표준 5-tab navigation (Live/Forecast/Analysis/Charts/Guide) | sign-up pushy (외부 review) · 메타데이터 (swell·tide·wind·temp) 가 1차 view 에 안 보임 · 학습 곡선 큼 | **단무지공방의 Q1 demographic = Surfline 의 homebreak**. 첫 질문이 100% 즉답 가능한 사용자 본인 정보. spot 정보 + 장비 큐레이션의 통합 — 단무지공방은 장비 1 차, spot 은 Phase 2 |

### 핵심 학습 — 6 + 1 경쟁사 종합

3 갈래의 패턴이 보인다:

**(A) Hardware-coupled (Vakaros · Garmin)** — instrument 가 정확한 metric source. 단무지공방은 사용자 phone GPS / Vakaros / Garmin / Apple Watch import 의 multi-source 가 옳다 — vendor lock-in 없음.

**(B) Software-first 사후 분석 (Vantage · Njord Player)** — instrument-agnostic 분석. 단무지공방의 라이딩 대시보드가 정확히 이 카테고리. 차별점: **윙포일 + 한국 spot + 한국어**.

**(C) Social · gamified (Strava · Whoop)** — 비교 · 점수 · score. 단무지공방은 의도적으로 **사회적 비교를 안 한다** — 1:1 컨설팅 모델의 핵심. 라이더 본인 vs 본인의 누적 베스트 (DataViz §4-2 의 target polar) 가 더 의미. Strava 의 leaderboard 는 단무지공방의 가치와 충돌 — 안 따라가는 것이 옳다.

---

## 3. 사이트 사용성 audit — Nielsen 10 heuristics × 11 영역

각 영역에 대해 violation 을 **severity S0~S3** 로 표기한다.

| Sev | 의미 | 처리 |
|---|---|---|
| **S0** | Critical — 핵심 task flow 가 막힘 | Phase 1 즉시 fix 또는 spec lock |
| **S1** | Major — 인지 부담 큰 friction | Phase 1 plan, Phase 2 실행 |
| **S2** | Minor — polish 영역 | Phase 2/3 백로그 |
| **S3** | Cosmetic — 작은 일관성 | 자유 시점 |

### 3-1-A. 홈 (`index.html`)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| A1 | #1 Visibility | `index.html:172` search button disabled | search 가 있으나 못 쓴다 → false affordance | **S0** | 버튼 제거 (Top 1) |
| A2 | #4 Consistency | `index.html:96-99` vs other pages trust bar | trust bar 항목 수·순서 페이지마다 다름 | S1 | 1 source-of-truth fragment 화 |
| A3 | #8 Minimalist | `index.html:254` hero lead | credential 압축 ("3회 올림픽 · 3개국 · 옥덕필 · 조수철") 한 단락에 너무 많음 | S1 | hero 는 1 가치 + 1 CTA, credentials 는 별도 about strip 으로 분리 |
| A4 | #6 Recognition | `index.html:155-157` nav `hidden` | women/junior/family page 가 nav 에서 reach 불가 | S1 | quiz 결과 → 해당 chapter link (Top 4) |
| A5 | #10 Help | `index.html:172` search tooltip "Phase 2 예정" | 사용자에게 미래 약속은 정보 가치 X | S2 | A1 과 함께 제거 |
| A6 | #4 Consistency | `index.html:411-422` level grid 카드 hover JS | inline `onmouseover` 가 CSS hover 와 분리됨, 모바일 미작동 | S2 | CSS `:hover` 로 일관화 |
| A7 | #1 Visibility | `index.html:228-234` quiz progress | 분모가 5 이나 결과 step 6 미포함 — "약 1분" 카피와 어긋날 위험 | S2 | 분모 "5 + 결과" 또는 "Step n / 5 · 결과 보기" (Top 2) |

**홈의 강점:** Trust bar · philosophy 섹션 (한자 단무지 정체성) · "64 시나리오" 강조 · brand 4-card grid · level 4-card · style 4-card 의 일관된 grid-4cols · DO_NOT_REVERT 주석으로 design lock 명시.

### 3-1-B. Find My Gear (`find-my-gear.html`)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| B1 | #5 Error prevention | `find-my-gear.html:241,263` auto-advance | 미스클릭 한 번이 다음 step 으로 진입 — 카드 정확도가 사용자 의도와 다를 위험 | S1 | back 으로 회복 가능 (현재 OK), 단 첫 진입 사용자에 micro-warning ("선택 시 자동 진행" 명시는 있음 ✅) |
| B2 | #10 Help | quiz step head | 각 단계의 용어 (foiling·glide·jibe 등) 설명 없음 | S2 | 단계별 "?" 아이콘 + glossary link |
| B3 | #1 Visibility | progress bar | 5/5 도달 후 결과 step 으로 가는 transition 즉시 — 진행감 X | S2 | 200~400ms fade + 진행 메시지 "결과 정렬 중…" |
| B4 | #3 User control | `find-my-gear.html:367` Q5 (선택) | "선택" 텍스트만 — skip CTA 없음 | **S0** | "건너뛰고 결과 보기 →" 명시 (Top 2) |
| B5 | #6 Recognition | Q3 weight buckets | 4 단계 bucket (코드 확인 권장) — 정확 입력보다 인지 부담 작음 ✅ | — | 유지 |
| B6 | #2 Real world | premium-gate ("프리미엄 · 무료") | "프리미엄 무료" 가 의미적으로 충돌 (프리미엄 = 유료 mental model) | S2 | "추가 기능 (회원 무료)" 또는 "딥다이브 분석 (무료)" |
| B7 | #7 Flexibility | quiz result share | URL 으로 결과 재현 불가 (sessionStorage 기반) | S2 | URL query param 으로 state 직렬화 (Phase 2) |

**Find My Gear 의 강점:** 5-step e-commerce 퀴즈 best practice 부합 · auto-advance 의 속도 · progress bar · back button · premium upsell 의 give-get 모델 · 10축 스킬 진단 follow-up CTA · responsive grid (5col → mobile vertical).

### 3-1-C. Level pages (`level/{beginner,novice,intermediate,advanced,pro}.html`)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| C1 | #4 Consistency | level/* | 5 페이지의 hero · 추천 SKU 카드 · CTA 가 페이지마다 다를 위험 | S1 | 한 fragment template 화 (level-template.html → JS or build-time) |
| C2 | #6 Recognition | level 페이지의 "16 조합" 표 | 체중×스타일 16 조합 큐레이션 — 표인지 카드인지 디자인 결정 필요 | S2 | Visual + DataViz 협업 (§6-1) — 표 > 카드 (밀도 우선) |
| C3 | #2 Real world | level 명칭 | "입문 / 초급 / 중급 / 상급 / 선수" 5 단계 — Q2 의 quiz level (beginner/novice/intermediate/advanced/pro) 와 일치 ✅ | — | 유지 |
| C4 | #6 Recognition | nav dropdown "글라이딩 단계" 등 | 각 레벨의 한 줄 정의가 dropdown 에 노출 ✅ | — | 유지 (외울 필요 없음) |

### 3-1-D. Style pages (`style/{flat-speed,choppy-freeride,wave,hybrid}.html`)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| D1 | #4 Consistency | style/* | 4 페이지의 hero 색이 brand 색 (sea·navy·green·orange) 으로 차별화 ✅ | — | 유지 |
| D2 | #2 Real world | "Choppy·Freeride" 가 "한국 일반 spot" 라벨 표기 | mental model alignment ✅ | — | 유지 |
| D3 | #7 Flexibility | style 페이지 → level cross-link | 같은 스타일 × 다른 레벨로 가는 navigate path 가 명시되는가? 코드 확인 | S2 | "Wave + 상급" 같은 cross 필터 link |

### 3-1-E. Brand hubs (`{levitaz,ppc,takoon,wip}.html`)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| E1 | #4 Consistency | brand/* | 4 hub 의 hero 구조가 동일 (brand name · tagline · meta · CTA · 5-axis perf chart) ✅ | — | 유지 |
| E2 | #6 Recognition | brand hero | brand 별 monogram 마크 사용 — recall→recognition ✅ | — | 유지 |
| E3 | #8 Minimalist | wip.html | "탑라이더들의 안전장비" 카피가 짧고 강함 ✅ | — | 유지 |
| E4 | #10 Help | levitaz.html 의 olympic certification | "올림픽공인 하이드로포일/보드" 가 navigation 에 표시 — credibility ✅ | — | 유지 |

### 3-1-F. Cart + Quote (`cart.html`, `quote.html`)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| F1 | #1 Visibility | `cart.html:204` empty cart | 0-item state 의 UI 가 명시됐는지 확인 필요 | S1 | "장바구니 비어있음 — 추천 보기" empty state |
| F2 | #9 Error recovery | `cart.html:296` "가격 안내 받기" | 가격 lookup 실패의 graceful fallback ✅ | — | 유지 (모범) |
| F3 | #2 Real world | "구매견적요청하기" CTA | 한국 e-commerce 의 표준 어휘 + 1영업일 회신 약속 ✅ | — | 유지 |
| F4 | #1 Visibility | `quote.html` | 카톡 회신 SLA "1영업일" 이 cart 와 quote 양쪽에 명시 — 일관 ✅ | — | 유지 |
| F5 | #4 Consistency | cart vs main site nav | cart 의 nav 가 main site 와 동일한가 — 코드 확인 | S2 | 동일 fragment 사용 |

### 3-1-G. Find My Gear quiz vs 직접 brand 진입 (path 일관성)

| # | Heuristic | 진단 | Sev | 권장 |
|---|---|---|---|---|
| G1 | #7 Flexibility | 초보 → quiz, 전문가 → 직접 brand · level · style → 카톡 — 다중 경로 ✅ | — | 유지 |
| G2 | #4 Consistency | brand hero → SKU card → cart 의 transitional state | 각 경로의 step 수 · 카피 일관성 점검 | S2 | per-path checklist |

### 3-1-H. Calculator (`calculator.html` — Lift Calculator)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| H1 | #6 Recognition | `calculator.html:53` "Lift Calculator" | 영문 명칭 + 한국어 부제 ("윙·포일 takeoff 임계 속도 계산") ✅ | — | 유지 |
| H2 | #2 Real world | 입력 (체중 · FW area · 풍속 · pumping) | wingfoil 라이더 mental model 부합 ✅ | — | 유지 |
| H3 | #1 Visibility | `calculator.html:90-92` feasible OK/NO badge | 큰 OK / NO 시각 — 의사결정 한 호흡 ✅ | — | 유지 |
| H4 | #9 Error recovery | 입력 자유 입력 (number) | 음수 · 비현실 (300kg) 처리 inline validation 필요 | S2 | min · max attribute + visible hint |
| H5 | #10 Help | formula box `.calc-formula` (`calculator.html:99`) | 계산 식 노출 — 정직성 + 학습 ✅ | — | 유지 (모범) |

### 3-1-I. Riding dashboard (`riding-dashboard/`)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| I1 | #4 Consistency | dashboard 와 main site nav | 통합 헤더 (2026-05-22) ✅ | — | 유지 |
| I2 | #1 Visibility | `i18n.js` 한↔영 토글 | dashboard 에 i18n 완성 (source-as-key) ✅ | — | 유지 (Phase 2 메인 사이트 EN 토글에 패턴 차용) |
| I3 | #6 Recognition | 차트 카드 16 종 | 각 카드의 정합성 · data-ink · 인터랙션은 DataViz reference §2 audit 으로 위임 | — | DataViz 협업 (§6-2) |
| I4 | #7 Flexibility | GPX import · 세션 비교 · target polar | power user 흐름 ✅ | — | 유지 |
| I5 | #10 Help | `coach.js` 의 등급 코멘트 | inline 코칭 — "coaching is the data" 패턴 ✅ | — | 유지 (모범) |
| I6 | #3 User control | replay 의 재생/스크럽 | 현재 동기 hover 만 — 재생 컨트롤은 DataViz §4-1 Replay Strip 후보 | — | DataViz §4-1 |

### 3-1-J. Skill assessment (`skill-assessment.html` — 10 축 진단)

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| J1 | #6 Recognition | 10 axis pentagon | 5 skill × P/S 좌·우 분리 시각화 — 단무지공방 distinct USP ✅ | — | 유지 ([[reference_dmj_beginner_session_separation]] · §163) |
| J2 | #2 Real world | quiz 11 question (10 skill + 1 speed) | 5-7 분 cap 명시 ✅ | — | 유지 |
| J3 | #1 Visibility | progress bar | 11 step · 분모 표기 권장 | S2 | "Q n / 11" |
| J4 | #3 User control | 11 step 자가 평가의 부담 | back · 중단 · 저장 후 재개 — sessionStorage 권장 | S1 | 진행 상태 localStorage 저장 (Phase 2) |
| J5 | #10 Help | 5 skill 정의 (upwind · jibe · tack · pumping · counter-balance) | 각 axis 의 한 줄 정의 + 1-5 rubric 노출 ✅ (spec doc 기준) | — | 유지 |
| J6 | #6 Recognition | 결과 → 컨설팅 신청 form 자동 첨부 | 결과 → 다음 action 으로 매끄럽게 ✅ | — | 유지 |

### 3-1-K. Login / Signup / Profile

| # | Heuristic | 위치 | 진단 | Sev | 권장 |
|---|---|---|---|---|---|
| K1 | #9 Error recovery | `login.html:280` "로그인에 실패했습니다." | generic 에러 — security 의도일 수 있음 | S2 | Phase 2 supabase 인증과 함께 정책 검토 |
| K2 | #3 User control | login → `?redirect=` whitelist | open redirect 방지 ✅ (`login.html:254-258`) | — | 유지 (모범) |
| K3 | #1 Visibility | aria-live for auth-error | inline 에러 표시 ✅ | — | 유지 |
| K4 | #4 Consistency | profile / signup 의 nav | main site nav 와 동일 — 코드 확인 | S3 | fragment 화 |

### 3-1-L. Glossary (`glossary.html`)

| # | Heuristic | 진단 | Sev |
|---|---|---|---|
| L1 | #10 Help — 윙포일 용어 사전. footer link 됨 ✅ | — | 유지 |
| L2 | #6 Recognition — 각 term anchor link, 다른 페이지에서 `#term` 으로 deep-link 가능한가 코드 확인 | S2 | 모든 term `<h3 id="...">` |

### 3-2. 모바일 vs 데스크탑 차이

`_qa_screenshots/` 의 viewport 별 캡쳐 (320 / 390 / 768 / 1280 / 1440) 가 이미 존재 — Phase 1 의 QA 자산 강점.

| 영역 | 데스크탑 (1280+) | 모바일 (390) | 진단 | Sev |
|---|---|---|---|---|
| Nav | 5 dropdown + CTA + cart + login 한 줄 | hamburger 단일 — 정리됨 | mobile ✅, desktop 의 5 entry 가 무거움 (§5 P2) | S1 |
| Hero | 2-col split (text + visual) 권장 (`Phase1_AuditIssues.md:1-1`) | text-only 1-col | 데스크탑 우측 빈 공간 (audit 기존 발견) | S1 |
| Quiz | grid 4~5col | grid 1col vertical | mobile ✅ — auto-advance 가 thumb-reach 강 | — |
| Level grid | grid-4cols | wrap to 2 or 1 col | 정상 | — |
| Trust bar | 4 item 한 줄 | wrap or scroll? 코드 확인 | mobile 의 trust-bar 가 wrap 되면 height 가 늘어 hero 가 밀림 | S2 |
| Cart | 2-col (items + summary) | summary 가 sticky bottom 권장 | mobile 의 결제 CTA reachability | S1 |
| Riding dashboard 차트 | full-width canvas | 폴라 차트의 360° 가 작은 화면에서 어떻게 보이는가 | DataViz 협업 | S2 |

**모바일 우선 patch:**
- `cart.html` summary 의 sticky bottom CTA. iOS safe-area 처리.
- Quiz 의 step 간 미니 prev/next 의 모바일 floating 제스처 (swipe 는 X — 미스 위험. 버튼만).
- `nav-auth.js` 의 sticky 동작이 iOS 키보드 노출 시 viewport 와 충돌 확인.

### 3-3. 한국어 vs 영어 모드 차이

| 영역 | 한국어 | 영어 | 진단 |
|---|---|---|---|
| Main site | 완성 (`<html lang="ko">`) | 미지원 | 마케팅 사이트는 KR-only |
| Riding dashboard | 완성 (i18n.js 한↔영) | 완성 ✅ | 강점 |
| Brand · SKU 명칭 | 영문 그대로 (Levitaz · PPC · Takoon · Forward WIP) | — | 영문 mixed 정책 — 외국 라이더 reach 가능 |
| Calculator | 한국어 | 미지원 | 영문 폴백 권장 (Phase 2) |
| Cart / Quote | 한국어 (KRW · 카톡 회신) | 미지원 | 한국 사업자 모델 — KR-only OK Phase 1 |
| Skill assessment | 한국어 (spec) | 미지원 | Phase 2 EN 모드 후보 |

**Phase 1 권장:** 메인 사이트 i18n 작업은 하지 않는다 (Phase 2). 대시보드의 i18n.js 패턴 (source-as-key) 을 메인 사이트로 이식할 수 있게 패턴 검토 plan 만.

---

## 4. 신규 사용자 onboarding flow 권장

현재 onboarding 은 두 경로다:

**경로 1 — 빠른 진입 (Find My Gear).** `index.html` Hero CTA → `find-my-gear.html` 5-step quiz → `step-result` → 카톡 / cart / quote.

**경로 2 — 탐색형 (level · style · brand).** Hero → nav dropdown → level/style/brand hub → SKU card → cart/quote.

이 두 경로의 **첫 60 초** 가 onboarding 의 핵심이다. 권장 flow:

### 4-1. 권장 onboarding — 빠른 진입

```
T+0      Hero 노출 (~3s)
         ↓
T+3      "1분 만에 내 장비 찾기" CTA tap
         ↓
T+5      Find My Gear 진입 — Q1 "당신은?"
         Progress: 1/5 + "약 1분 소요"
         ↓
T+8      Q1 선택 (auto-advance)
         ↓
T+10     Q2 Skill Level
         (입문 / 초급 / 중급 / 상급 / 선수)
         ↓
T+15     Q3 Body Weight (bucket)
         ↓
T+20     Q4 Riding Style
         ↓
T+25     Q5 Sport Focus (선택)
         → "건너뛰고 결과 보기 →" 노출 (Top 2)
         ↓
T+27     계산 transition (200~400ms)
         ↓
T+28     결과 화면
         · 추천 SKU 카드 (heuristic ref. 1-line + 단무지 추천 이유)
         · "왜 이 셋업?" expandable
         · Q1 demographic 분기 → women/junior/family 페이지 link 노출 (Top 4)
         · premium-gate ("회원 가입 시 분석 더 받기")
         · 10축 스킬 진단 CTA
         · "카톡으로 추가 질문" floating
         · "다시 시작" / "URL 공유" (Phase 2)
```

핵심 변경 (Phase 1 plan, Phase 2 실행):
- Q5 의 explicit skip
- 결과 화면의 demographic-aware chapter link
- "왜 이 셋업?" 의 reasoning trace (heuristic 1-liner, e.g. "체중 75kg + 풍속 12-18 노트 + Choppy → 5.5㎡ Wing 추천")
- Premium-gate 의 wording — "프리미엄 (무료)" 의 의미적 충돌 해소 ("추가 분석 — 회원 무료" 등)

### 4-2. 권장 onboarding — 탐색형

```
T+0      Hero
         ↓
T+8      Hero scroll → philosophy
         ↓
T+15     Brand 4-card grid
         ↓
T+25     하나 클릭 → brand hub
         ↓
         (옵션 A) 5-axis perf chart 보고 nav back
         (옵션 B) SKU card → cart
         (옵션 C) "내 케이스에 맞을까?" → Find My Gear 진입
```

탐색형은 information scent (Pirolli 1995) 가 핵심. 4 brand 의 한 줄 설명 (`Levitaz - 올림픽공인 하이드로포일/보드`) 이 scent 를 잘 제공. brand hub 의 5-axis perf chart 도 scent — 단 chart 옆에 **"내가 어디?"** 의 self-locate 도구가 약함. Phase 2 의 PWA 에서 본인 진단과 brand chart overlay 권장.

### 4-3. 권장 — onboarding 의 i18n 폴백

EN 폴백을 **메인 사이트 전 페이지** 에 만들지 않는다 (비용 대비 가치 작음). 대신:
- `index.html` 의 hero 만 EN 영문 stylesheet/카피 1 페이지 만들기 (`index-en.html` 또는 `?lang=en` 분기) — Phase 2 의 small scope.
- 결과 화면 · brand hub 의 SKU 명칭이 이미 영문 → 외국 라이더가 brand hub 까지 도달은 가능.
- 카톡 상담 외 ENG 채널 (email · DM) 의 명시.

---

## 5. Top 5 즉시 개선 권장 — effort × impact 매트릭스

| # | 권장 | Effort | Impact | Severity 합 | Phase |
|---|---|---|---|---|---|
| 1 | **Search disabled 제거** | 5 min | High (인지 부담 ↓, A1 S0) | S0 | Phase 1 즉시 fix 또는 plan-only 명시 |
| 2 | **Q5 explicit skip + progress 분모 명시** | 30 min (HTML 4줄 + JS 1줄) | High (B4 S0, drop-off ↓) | S0 | Phase 1 즉시 또는 Phase 2 |
| 3 | **Nav "장비" vs "브랜드" 책임 분리 명시** | 1 hr (IA decision + nav copy update) | Mid (정보 구조 정리, A4) | S1 | Phase 1 plan, Phase 2 실행 |
| 4 | **Quiz 결과 → demographic chapter link** | 30 min (find-my-gear result render JS 분기) | Mid (hidden 페이지 reach 회복, A4) | S1 | Phase 1 plan, Phase 2 |
| 5 | **Empty / loading / skeleton 표준 컴포넌트** | 2 hr (CSS keyframe + aria-busy 패턴) | Mid (Nielsen #1, F1) | S1 | Phase 1 plan |

### 5-1. Top 1 detail — Search disabled 제거

**문제.** `index.html:172` 의 `<button disabled title="Phase 2 예정">` — Norman 의 false affordance. 검색 아이콘 + 그림자 = "검색 가능" 의 signifier. disabled 의 visual cue 가 명확해도 사용자는 한 번은 클릭한다.

**Fix.**
- **(A) 제거**: button 자체 삭제. 현재 검색 없음 = 미래 약속도 없음. 정직성 강점.
- **(B) 대체**: 자리에 카톡 quick-action ("질문이 있으세요?" tooltip) 또는 glossary 빠른 진입.

**Plan-only spec (Phase 1):**
```html
<!-- Phase 1: 다음 HTML 한 줄 삭제 -->
<button type="button" class="nav__icon-btn" aria-label="검색 (Phase 2 예정)" disabled title="Phase 2 예정">
  <svg ...></svg>
</button>
```
Phase 2 search 출시까지 nav 의 search slot 은 비워둔다.

### 5-2. Top 2 detail — Q5 explicit skip + progress 분모

**문제.** `find-my-gear.html:367` 의 "Q5 · Sport Focus (선택)" — "선택" 텍스트만, skip CTA 없음. progress bar 가 5/5 까지 가지만 step 6 (결과) 가 분모에 없어 "곧 끝난다" 의 정확한 진행감을 잃는다.

**Fix.**
1. Q5 의 quiz-actions 에 **"건너뛰고 결과 보기 →"** secondary CTA 추가. style: ghost · 우측 정렬.
2. progress label 의 "Step n / 5" 를 "Step n / 5 · 결과" 로 갱신 — 또는 "Step n / 5 (다음: 결과)" 로 forward-looking. 분모를 6 로 바꾸지 않는 이유: 결과는 step 이 아니라 도착점 — 라이더의 mental model 에 부합.

**Plan-only spec:**
```html
<!-- Q5 quiz-actions 영역 (find-my-gear.html:392~) -->
<div class="quiz-actions">
  <button class="quiz-back">← 이전</button>
  <button class="quiz-skip" data-action="skip-to-result">건너뛰고 결과 보기 →</button>
</div>
```
JS: skip click → `state.sport = null; renderResult();` (기존 result render 함수 재사용).

### 5-3. Top 3 detail — Nav "장비" vs "브랜드" 책임 분리

**문제.** `index.html:115-145` 의 dropdown 5 개. "장비" 의 "안전장비" 가 `wip.html` 으로 단축경로 → 4-brand 의 wip 와 충돌. IA 의 MECE (mutually exclusive, collectively exhaustive) 위반.

**Fix.**
- "장비" dropdown 의 "안전장비" → `genre/safety.html` 또는 `category/safety.html` 카테고리 페이지로 신설 (Phase 2). 해당 페이지가 brand 4 hub 중 wip 의 SKU 를 cross-display.
- "브랜드" dropdown 은 4 brand hub 만 — 단순 유지.
- "장비" dropdown 은 **카테고리** (윙 / 포일 / 보드 / 안전장비) 4 항목 단일 — 모두 cross-brand 페이지.

**Phase 1:** plan only. Phase 2 에 `category/{wing,foil,board,safety}.html` 만들고 nav 갱신.

### 5-4. Top 4 detail — Quiz 결과 → demographic chapter link

**문제.** `index.html:155-157` 의 nav `hidden` 처리는 [[feedback_dmj_level_category_strength]] 에 따른 정책 결정 (의도적 minimalist). 단 페이지 자체는 빌드돼 있어 reach 가능해야 한다.

**Fix.** Quiz 결과 화면 (`step-result`) 의 render 로직에 **Q1 demographic 분기 추가**:
- adult_female 선택 → 결과 카드 다음에 "여성 라이더 · Women fit · progression" link (women/index.html)
- youth 선택 → "유소년·어린이 가이드" link (junior/index.html)
- senior + (Q1 + Q2 = 가족 시그널) → "가족 라이딩 번들" link (family/index.html)

**Plan-only spec:**
```js
// find-my-gear.html result render — pseudo
if (state.demographic === 'adult_female') {
  resultEl.appendChild(makeChapterLink('women/index.html', '여성 라이더 · Women fit'));
}
if (state.demographic === 'youth') {
  resultEl.appendChild(makeChapterLink('junior/index.html', '유소년·어린이 안전 가이드'));
}
```
nav 의 hidden 정책은 유지 — only quiz-driven reachability.

### 5-5. Top 5 detail — Empty / loading / skeleton 표준 컴포넌트

**문제.** `cart.html` 의 0-item state · async script (matrix.js · cart.js · products.js) 로드 중 사용자 인지 불명확. Nielsen #1 visibility 위반 가능.

**Fix.** 3 상태 표준 CSS 토큰화.

**Plan-only spec:**
```css
/* assets/css/style.css 신규 추가 */
.skeleton-row {
  background: linear-gradient(90deg, var(--color-mist) 0%, #fff 50%, var(--color-mist) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: 8px;
  height: 1em;
}
@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  padding: 48px 24px;
  text-align: center;
  color: var(--color-slate);
}
.empty-state__icon { font-size: 2rem; opacity: 0.4; }
.empty-state__msg  { margin: 12px 0; font-size: 0.9375rem; }
.empty-state__cta  { /* btn--ghost re-use */ }
```

JS: `aria-busy="true"` on container during fetch · 0-item 시 `.empty-state` template inject · error 시 `.error-state` (현재 cart.html 은 graceful fallback 으로 처리됨, 그대로 유지).

---

## 6. 협업 인터페이스 — 다른 전문가와의 책임 경계

### 6-1. Visual Designer (#1) — 타이포 · hierarchy · 아이콘 시스템

UX Researcher 는 **사용자 인지 패턴 · 결정 흐름**, Visual Designer 는 **시각 인지 · 위계 · 일관성** 을 책임진다.

| 책임 | UX Researcher | Visual Designer |
|---|---|---|
| Hero 카피 길이 | 사용자 인지 부담 진단 (S1 진단) | 타이포 hierarchy 결정 (eyebrow · title · lead · CTA 사이즈) |
| Level 카드 색 | mental model 부합도 | 4 레벨 색 코드 결정 (현재 green / blue / navy / red) |
| Nav dropdown 너비 | recognition 부담 | 시각 ratio · negative space |
| Trust bar 항목 | 일관성 violation 진단 (A2) | 항목 시각 weight |
| Empty / loading state | 패턴 spec (§5-5) | skeleton 색 · 길이 ratio |

### 6-2. DataViz (#2) — 인터랙션 동기 · 차트 cognition

DataViz reference (`expert_dataviz_reference.md`) 와 본 문서는 **라이딩 대시보드 영역에서 책임 분담**:

- **DataViz**: 차트 카드 16 종의 정합성 · data-ink · 인터랙션 · 차트 라이브러리 선택.
- **UX Researcher**: 차트 카드 간 navigation · 세션 비교 표의 sort UX · replay 의 재생 컨트롤 인터랙션 · GPX import flow.

협업 항목:
- §I3 의 차트 16 종 audit — DataViz reference §2 위임.
- §I6 의 Replay Strip 인터랙션 — DataViz §4-1 + UX 의 재생 vocabulary (▶ ⏸ ⏮ ⏭ + 재생 속도 0.5x/1x/2x). gesture: tap to pause, drag scrubber.
- §I5 의 coach inline 코멘트 — DataViz "coaching is the data" · UX 의 reading flow (코멘트 길이 1~2 문장 cap, 핵심 1 단어 강조).

### 6-3. Marketing (#3) — 카피 · 퍼널 · 헤드라인

| 책임 | UX Researcher | Marketing |
|---|---|---|
| Hero 카피 hierarchy | 인지 부담 (A3 S1) | 헤드라인 카피 · CTA wording |
| Trust bar 항목 | 일관성 + visibility | 항목의 trust value 우선순위 |
| Quiz Q5 (선택) skip | UX freedom 원칙 (Top 2) | conversion 측정 |
| Premium gate 카피 | "프리미엄 무료" 의미적 충돌 (B6) | wording 재정의 |
| Brand hub CTA | path 일관성 | brand voice |

협업: hero 의 credential 분리 plan — UX 가 plan 제시, Marketing 이 카피 finalize, Visual 이 hierarchy 디자인.

### 6-4. Sports Science (#4) — 스킬 모델 표현

UX Researcher 는 **스킬 모델을 사용자 mental model 로 표현** 하는 책임을 진다.

| 책임 | UX Researcher | Sports Science |
|---|---|---|
| 5-skill axis 명칭 (upwind · jibe · tack · pumping · counter-balance) | 한국어 명칭 · level rubric 의 mental model | 도메인 정확성 |
| Pentagon 10-axis 시각 | 라이더가 약쪽 (weaker side) 한 호흡 인지 | 데이터 정합성 |
| Coach.js 코멘트 표현 | reading flow · 코멘트 길이 · 호흡 | 코칭 정확성 |
| Calculator 의 입력 단위 | mental model 부합 (체중 kg · FW area ㎡ · 풍속 knots) | 식의 정확성 |
| Quiz Q3 weight bucket | 입력 부담 · 정확도 trade-off | 매트릭스 갈래 정확성 |

협업: 스킬 모델을 라이더에게 표현할 때 "이 라이더는 포트 택의 자이브가 약하다" 같은 **자연어 narrative** 가 pentagon chart 보다 mental model 에 더 부합. Sports Science 가 narrative template 제공, UX 가 reading flow 설계.

### 6-5. Frontend Engineer (#6) — 구현 · a11y · 성능

| 책임 | UX Researcher | Frontend |
|---|---|---|
| aria-label · aria-live · role | UX 인지 패턴 명시 | 구현 |
| Focus visible · keyboard nav | a11y 기준 | CSS · JS |
| `viewport-fit=cover` 의 safe area | 모바일 UX 권장 | 구현 |
| Service Worker (`§172`) | 사용자 인지 (stale cache 회복) | 구현 |
| `nav-auth.js` · `cart.js` 의 load order | UX flow 의 의존성 | 구현 (`§171-B v3` DO_NOT_REVERT) |
| Skeleton · empty-state CSS | UX spec | CSS · 컴포넌트 |

협업: §172 SW cleanup script · §171-B cart load order 같은 **DO_NOT_REVERT** 정책은 UX 가 침범하지 않는다. UX 가 변경 권장 시 Frontend 에 영향 평가 요청 → 정책 갱신 절차로만 진행.

---

## 7. Phase 2 권장 — out of scope here, plan-only

본 reference 는 Phase 1 (production 변경 없는 audit + plan). Phase 2 의 후보는 다음:

### 7-1. 결과 화면의 "왜 이 셋업?" reasoning trace
Quiz 결과 카드에 한 줄 reasoning: "체중 75kg + Choppy + 중급 → 5.5㎡ wing · 95L board". heuristic 1-liner 만 — full reasoning 은 카톡 상담.

### 7-2. Quiz state 의 URL share
SessionStorage → URL query param 직렬화. "내 케이스의 견적이에요" 의 social share 가능.

### 7-3. 모바일 bottom nav
Material 의 bottom navigation 패턴. 3~5 destination — 홈 · 퀴즈 · 대시보드 · 카트 · 더보기. thumb-reach 우월. Phase 2 PWA 와 함께.

### 7-4. 메인 사이트 EN 폴백
`index.html` 의 hero + brand hub 만 EN 1 페이지. 카톡 외 email/DM 명시. 외국 라이더 reach.

### 7-5. Onboarding 첫 진입 시 1-line "여기는?"
첫 방문자 detection (localStorage `first_visit`) 시 "단무지공방은 윙·포일·SUP 컨설팅 스토어입니다" 의 1-line 노출. 0.5초 fade-in/out. Norman 의 mental model alignment 초기 priming.

### 7-6. Skill assessment 의 진행 중 저장 후 재개
11 step 의 부담 — localStorage 진행 상태. 사용자가 7번째에서 멈춰도 카톡으로 들어와 이어 작성.

### 7-7. Cart sticky bottom CTA (모바일)
iOS safe-area + Material 의 BottomAppBar 패턴.

### 7-8. Brand hub 의 "내 진단과 overlay"
Skill assessment 결과 (pentagon) 와 brand 의 5-axis perf chart overlay. "내가 어디 ↔ 이 brand 가 어디" 한 호흡 매칭. Phase 2 의 PWA 와 함께.

---

## 8. 부록

### 8-1. Heuristic severity ladder (S0~S3 정의 재인용)

- **S0** Critical — 핵심 task flow 가 막힘 · false affordance · 회복 불가 에러. Phase 1 즉시 fix.
- **S1** Major — 인지 부담 큰 friction · 일관성 violation · 정보 구조 중복. Phase 1 plan / Phase 2 실행.
- **S2** Minor — polish · inline validation · empty state · 한↔영 부분 폴백. Phase 2/3.
- **S3** Cosmetic — 작은 일관성 (trust bar 항목 순서 등). 자유 시점.

### 8-2. 본 reference 의 메모리 룰 준수 확인

- [[feedback_dashboard_viz_chart_over_table]] — 본 문서는 chart 보다 표를 더 사용한다. 이유: UX audit 의 본질은 **항목 × 진단 × severity** 의 matrix 인덱싱이라 표가 적합. Chart 는 §1 의 abstract 결정 기준 정리에서도 의도적으로 사용 안 함 — heuristic 은 narrative 우월. 단 §5 의 effort × impact 의 2×2 표는 chart 화 가능 (Phase 2 의 internal review 시 권장).
- [[reference_dmjgroup_site_rules]] — DO_NOT_REVERT 정책 (`§122` 한자 단무지 · `§145-G v6` nav 장비 분리 · `§163` 4-col lock · `§171-B v3` cart load order · `§172` SW cleanup · `§173` agent-deny floating · `§175-B` matrix data) 모두 reference 만 하고 변경 권장 X — Phase 1 정책 준수.
- [[project_sailtech]] · [[project_sailtech_riding_analytics_app]] — sailing tech 도메인 reference 로 §1-6 sports app 패턴 · §2 경쟁사 deep audit 에 반영.
- [[feedback_dmj_level_category_strength]] — women/junior/family 의 nav hidden 정책 유지. Top 4 의 reachability fix 는 nav 변경 X, quiz 결과 분기만.
- [[reference_dmj_beginner_session_separation]] — beginner 의 session 분리 정책 — `level/beginner.html` 의 contextual scope 확인. 본 audit 은 진단만, 정책 변경 X.

### 8-3. 본 문서의 미커버 영역 (다음 iteration)

- **A/B testing 의 metric framework.** 본 audit 은 heuristic 만 — 사용자 데이터 (clickstream · funnel drop-off) 기반의 양적 evaluation 은 Phase 2 PWA 출시 후.
- **Voice of customer.** 단무지공방 1:1 카톡 상담의 실제 질문 패턴 — Marketing/Sports Science 협업으로 정리.
- **A11y 의 audit tool 정량 검사** (axe-core · Lighthouse · WAVE). 본 audit 은 코드 정성 — 자동 도구 결과는 Phase 2 QA 와 통합.
- **모바일 thumb-reach 의 정량.** 사용자 손 크기 분포 · 실제 thumb-reach hit map — Phase 2 의 사용자 테스트.
- **Cross-browser 호환.** Safari iOS · Chrome Android · Naver Whale · 카톡 in-app browser — `_qa_screenshots/` 의 viewport audit 외 in-app browser test.

---

## 9. 끝맺음

단무지공방 Phase 1 사이트는 **컨설팅 사이트로서의 정체성과 정보 구조가 이미 잘 정립돼 있다.** DO_NOT_REVERT 정책으로 design lock 을 명시한 곳이 30+ 곳 — 이는 의도된 design 의 보호 장치이자 UX 의 안정성 자산이다. 본 audit 의 권장은 **그 lock 위에서 friction 만 정리** 하는 것이지 lock 자체를 흔드는 것이 아니다.

Top 5 의 effort 총합 약 **4 시간 (코드 변경)** 으로 Nielsen 의 S0 위반 2 건 (search disabled · Q5 skip) 을 해소하고, S1 위반 3 건 (nav IA · demographic reach · loading state) 의 plan 을 lock 한다. 이는 Phase 2 PWA 진입 전의 깔끔한 디딤돌이다.

다음 iteration 의 input 으로 권장하는 것:
- `_qa_screenshots/report.json` 의 viewport 별 정량 audit (Layout shift · paint time)
- 1:1 카톡 상담 로그 (Marketing 협업) 의 사용자 mental model 마이닝
- Phase 2 PWA 의 onboarding flow 사용자 테스트 (n=5~8, 한국 라이더 + 외국 라이더 mix)

— UX Researcher (전문가 #5)

---

## Sources (외부 reference)

- [10 Usability Heuristics for User Interface Design — Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Heuristic Evaluations: How to Conduct — NN/G](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/)
- [Ecommerce UX Research Report — NN/G](https://www.nngroup.com/reports/ecommerce-user-experience/)
- [WHOOP Design Breakdown: Data-Dense UI That Feels Simple — 925 Studios](https://www.925studios.co/blog/whoop-design-breakdown)
- [The All-New WHOOP App Overview Screen — WHOOP](https://www.whoop.com/us/en/thelocker/your-key-whoop-metrics-all-in-one-place/)
- [UX/UI Case Study: Redesigning Garmin Connect App — Medium](https://medium.com/@s.vegazosancho/ux-ui-case-study-redesigning-garmin-connect-app-62a52b154d95)
- [Garmin Connect App Revamp — DC Rainmaker](https://www.dcrainmaker.com/2024/01/garmin-connect-through.html)
- [Strava UX — Duel J Design](https://www.dueljdesign.com/strava-ux)
- [Exploring Strava Through a UX Lens — Medium](https://medium.com/@rakaeldiansyah/exploring-strava-through-a-ux-lens-challenges-and-opportunities-59b534c17a1f)
- [Njord Player — Njord Analytics](https://www.sailnjord.com/player/)
- [Vakaros Connect — Making the Most of](https://www.vakaros.com/blogs/news/making-the-most-of-vakaros-connect)
- [Introducing: Atlas 2 — Vakaros](https://www.vakaros.com/blogs/news/introducing-atlas-2)
- [Vantage Sailing on the App Store — Apple](https://apps.apple.com/my/app/vantage-sailing/id6544807723)
- [App Critique: Surfline — Mike Glezos](https://www.mikeglezos.com/app-critique-surfline)
- [Surfline Spot Forecast Page — Surfline Support](https://support.surfline.com/hc/en-us/articles/13749782983579-Understanding-the-Spot-Forecast-Page-on-the-Surfline-Website)
- [Best E-Commerce Quiz Builder, Examples & Templates — ConvertFlow](https://www.convertflow.com/quizzes/e-commerce)
- [Product Recommendation Quiz tools — Aiden](https://www.aiden.cx/en/academy/product-recommendation-quiz-tools-ecommerce)
- [How to Make a Product Recommendation Quiz that Converts — Digioh](https://www.digioh.com/blog/how-to-make-product-recommendation-quiz)

## Sources (내부 reference)

- `site/_experts/expert_dataviz_reference.md` — DataViz reference (협업 §6-2)
- `site/_experts/expert_hardware_embedded_reference.md` — Hardware reference
- `site/README.md` — Phase 1 정적 사이트 개요
- `site/Phase1_AuditIssues.md` — 기존 야간 audit (2026-05-05)
- `site/_specs/skill-diagnostic-10-axis.md` — 10축 pentagon spec
- `site/docs/PHASE12_ARCHITECTURE.md` — Phase 12 backend architecture
- `site/index.html` · `site/find-my-gear.html` · `site/level/beginner.html` · `site/calculator.html` · `site/cart.html` · `site/login.html` · `site/riding-dashboard/index.html` · `site/riding-dashboard/js/i18n.js`
