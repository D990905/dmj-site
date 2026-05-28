# expert_visual_designer_reference.md — 단무지공방 / SailTechCo Visual Design reference

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 학습 정리 + 현재 사이트 visual audit + 디자인 시스템 v2 제안 + Top 5 즉시 개선 |
| 작성 | Visual Designer (전문가 #1) · 2026-05-28 |
| 대상 | `site/` 전체 — 메인 마케팅 사이트(`index.html`·`level/*`·`style/*`·제품 4종·find-my-gear·cart·quote·profile) + `site/riding-dashboard/` (라이트 본체 + replay viewer 다크) |
| 범위 | Phase 1 — production 코드 무수정. audit + 권장만. 실제 token 변경은 Phase 2 dispatch 후 |
| 근거 | 코드 직접 열람 (`assets/css/style.css` 8528 line · `riding-dashboard/css/dashboard.css` · `riding-dashboard/js/chart-theme.js` · `riding-dashboard/CHART-DESIGN-SYSTEM.md` · `index.html` · `levitaz.html` · `riding-dashboard/index.html` · `_experts/expert_dataviz_reference.md` · `expert_frontend_engineer_reference.md` · `expert_ux_researcher_reference.md`) + 외부 reference (Apple HIG 2025 / Liquid Glass · Material 3 Expressive · Linear · Stripe · Vercel Geist · Tailwind UI · OKLCH spec · WCAG 2.2 AA · Pretendard 1.3.9 · Strava · Garmin Connect · Vakaros Vantage 2.0 · Surfline · Njord) |
| Co-owners | DataViz Specialist (차트 색·타이포·OKLCH 보간) · Frontend Engineer (토큰 구현·CSS layer·iOS hit-test) · UX Researcher (계층·아이콘 시스템·heuristic 준수) · Marketing & Social (brand voice·photography style) · Mobile App Engineer (네이티브 ↔ 웹 디자인 토큰 패리티) · Sports Science (지표 시각 우선순위) · Hardware (제품 색 / 패키지) |
| 제약 | `chart-theme.js` 의 4 계열 색 토큰 (status / side / category / hrZone) 의미 절대 유지 · 다크 강요 X (라이트 유지, 리플레이 뷰어만 예외) · Korean period rule 등 [[feedback_korean_period_rule]] 준수 · [[reference_dmjgroup_site_rules]] · DO_NOT_REVERT 항목 (§141 §145-G §148 §163 §169-K §171 §171-B §171-C §172 §173 §174 §175 §177 §178 §179 §181) 시각 영역 모두 존중 |

> **읽는 법.** §0 은 한 페이지 TL;DR. §1 은 Phase 1 학습 정리 — 현대 디자인 시스템(Linear·Stripe·Vercel·Apple HIG·Material 3) · sports/sailing 앱 시각 언어(Strava·Garmin·Vakaros·Vantage) · 금융/분석 dashboard · 한·영 typography · OKLCH color · motion design 6 갈래를 단무지공방 맥락으로 압축 번역한 결정 기준이다. §2 는 현재 사이트 visual audit — design tokens·메인 사이트·라이딩 대시보드·제품 상세·보조 페이지·컴포넌트 6 영역을 강점·약점·우선순위 권장 3 축으로 평가한다. §3 은 디자인 시스템 v2 제안 — color·type·space·shadow·motion·컴포넌트 토큰 layer. §4 는 effort × impact 매트릭스로 Top 5 즉시 개선. §5 는 7 전문가와의 협업 인터페이스. §6 은 제약 준수 확인. Phase 1 은 §3·§4 의 plan 까지 — production 변경은 Phase 2 부터.

---

## 0. 핵심 결론 (TL;DR)

단무지공방 사이트의 시각 시스템은 **이미 상당히 정제돼 있다.** `style.css:1-111` 의 `:root` 토큰은 brand(navy/sea/sun) + neutral 7단계 + semantic(bg/text/border/accent) + Pretendard·Inter·JetBrains Mono 의 한·영·모노 3 패밀리 + 12 단 type scale + 9 단 spacing(4px base) + 4 단 shadow(navy-tinted) + 3 단 motion easing/duration + z-index 3 단을 모두 명시했다. `prefers-reduced-motion` 명시적 지원(§style.css:123-129)·한국어 widow 방지 정책(`word-break: keep-all` + `text-wrap: balance/pretty` + `hanging-punctuation`)이 §147-205 에 정통으로 박혀 있다. `chart-theme.js` 의 4 계열 색 토큰은 §1-5 의 "상태색 = 성과 잘함/못함 전용" 원칙을 명문화했고, dashboard.css 의 `--fs-num-hero/xl/lg/md/sm` 5 단 숫자 스케일은 5월 26일 폴리시 sweep 으로 추가됐다 — 코드는 자체 정직성 · 검증 가능성에서 **Linear·Stripe 의 sparse-but-interaction-dense 철학과 정확히 같은 방향**으로 발전해 왔다.

남은 visual 부채는 다섯 갈래다.

**첫째 — 토큰 prefix 의 이중성.** 메인 사이트는 `--color-navy` `--color-sea` `--color-sun` 같은 `color-` prefix 를, 대시보드는 `--navy` `--sea` `--sun` 같은 prefix-less 이름을 쓴다. 같은 색이 두 이름으로 존재 — DRY 위반. 둘 중 한 쪽에 alias 를 박는 게 Phase 2-A 안전 마이그레이션, 양쪽을 한 이름으로 통합하는 게 Phase 2-B 정공법. 단 **`--color-*` 가 의미상 더 명확** (`--navy` 는 단어 자체가 색이지만 token 위계 표현이 약함) — `style.css` 의 `--color-navy` 를 canonical 로 두고 `dashboard.css` 의 `--navy` 를 alias(`var(--color-navy)`) 로 만드는 방향 권장.

**둘째 — 인라인 스타일의 산재.** `index.html` 의 hero CTA(line 382 그라데이션 카드) · level grid(line 404-424 모든 카드의 `style="..."` 속성) · style/* / level/* 페이지의 카드들이 모두 `style="background:...;border:...;..."` 형식의 인라인. 컴포넌트 클래스로 추출하면 CSS 위치가 한 곳으로 모이고 시각 회귀가 감지 가능해진다. 단 **§163 (4-col lock) 같은 lock 정책이 인라인에 박혀 있는 경우** 는 그 의도를 컴포넌트 modifier 로 보존해야 한다.

**셋째 — Focus indicator 정책의 불일치.** `style.css:326` 의 `.btn:focus-visible { outline: 2px solid var(--color-sea); outline-offset: 2px; }` 는 좋은 디폴트지만, nav__link · card · pill · hero__quick-tag · brand 카드들에는 focus 스타일이 명시되지 않아 브라우저 기본 ring 에 의존한다. **WCAG 2.2 #2.4.13 (Focus Appearance)** 는 AA 가 됐다 — 2px-thick + 3:1 contrast 의 visible focus 가 모든 focusable element 에 요구된다. 한 곳의 focus-ring mixin 으로 일관 적용이 quick win.

**넷째 — Status 5 앵커의 sRGB lerp.** `chart-theme.js:56-69` 의 `statusAt(g)` 가 sRGB 공간 linear interpolation 으로 5 앵커 사이를 보간한다. perceptually uniform 이 아니므로 중간색 — 특히 `mid` ↔ `bad` (#F2C20E 노랑 ↔ #EC8A2E 주황) 사이 — 가 약간 muddy 하다. OKLCH 보간으로 업그레이드하면 perceptually smooth 한 5 앵커 그라데이션이 된다 (§1-5). **단 이건 DataViz 협업 항목 — 시각 변화가 미세하므로 둘이 합의 후.**

**다섯째 — 아이콘 시스템의 혼재.** trust-bar 의 체크마크(inline `<svg viewBox="0 0 24 24">`) · nav cart icon · hero arrow · find-my-gear icons 가 모두 inline SVG 인데, 일부는 stroke 기반(Lucide style) 일부는 fill 기반(Material style) 이다. 한 가족 (예: **Lucide line icons** + stroke-width 2 + linecap round) 으로 통일하면 시각 일관성·grep-replace 용이성 둘 다 얻는다. 현재 코드는 사실상 Lucide 패턴을 따르고 있어 정리만 하면 됨.

**Phase 1 권장 우선순위 5 (production 코드 변경 X · plan + spec only):**

1. **Focus ring 정책 표준화 + WCAG 2.2 #2.4.13 준수 spec** (§4-1). 한 `:focus-visible` mixin 을 모든 button / link / card 에 적용. Outline 2px solid var(--color-sea), outline-offset 2px. 다크 컨텍스트(navy bg) 에서는 outline color 를 sun 으로 swap. Effort 2-4h · Impact 즉시 a11y 통과 + 키보드 사용자 인지 격차 제거.
2. **Token canonical 화 — `--color-*` prefix 일원화** (§4-2). `dashboard.css:14-17` 의 `--navy` `--sea` `--sun` 등을 모두 `var(--color-navy)` `var(--color-sea)` `var(--color-sun)` 으로 alias 화. legacy 이름은 유지(역호환) 하되 새 코드는 canonical 만. Phase 2 마이그레이션의 첫 step.
3. **OKLCH 보간 도입 spec — `RDChartTheme.statusAt` v2** (§4-3 · DataViz 협업). sRGB lerp → OKLCH lerp 로 업그레이드. 5 앵커 자체 값은 유지 (cultural prior 유지). 보간 중간색만 perceptually uniform 으로 매끈. Visual + DataViz 합의 후 Phase 2 시행.
4. **인라인 스타일 → 컴포넌트 클래스 추출 audit list** (§4-4 · Frontend Engineer 협업). `index.html` 의 hero CTA grad card · level grid 4 카드 · style/* page 카드들 · find-my-gear 결과 카드를 `.hub-cta` · `.level-card--{beginner,intermediate,advanced,pro}` · `.style-card--{flat,choppy,wave,hybrid}` 등으로 추출. 클래스 이름·DOM 구조만 plan, CSS 는 Phase 2.
5. **아이콘 시스템 통일 — Lucide line icons 표준화 spec** (§4-5). 현재 inline SVG 들을 모두 stroke-width 2 + linecap/linejoin round + viewBox 24×24 의 Lucide 가족으로 통일. `kakao` 아이콘 같은 brand mark 는 예외. CDN(`unpkg.com/lucide-static`) 또는 `<svg><use>` sprite — Frontend 결정. Phase 2 sweep.

---

## 1. Phase 1 학습 정리 — 결정 기준

### 1-1. 현대 디자인 시스템 — Linear · Stripe · Vercel Geist · Apple HIG 2025 · Material 3 Expressive · Tailwind UI

2026 의 큰 흐름은 **"sparse pixel · dense interaction"** — 화면은 조용하고 호흡이 있으나 모든 element 가 hover · focus · keyboard · context 에 반응한다. Linear · Vercel · Stripe 의 공통점이 정확히 이 패턴이다 [1]. 단무지공방의 hero CTA · brand card · level grid 가 이미 같은 방향 — translateY(-1px) lift + shadow 가산 hover, focus ring, prefers-reduced-motion 존중까지 모두 박혀 있다(`style.css:324-326`·`409-412`). 유지·강화 권장.

**Linear (linear.app).** 단일 색계 어두운-네이비 베이스 + 한 가지 accent purple. 호흡 있는 spacing(주요 column 32-48px gap). 모든 컴포넌트가 `prefers-reduced-motion` 과 `:focus-visible` 둘 다 확실. 우리에게 적용 가능한 패턴: (a) 메인 사이트의 dark section (`section--dark` `--darker`) 을 더 적극 활용해 hero ↔ philosophy ↔ consultation hub 의 시각 리듬 형성, (b) primary brand accent 하나(sun #FFB800) 를 끝까지 lean 하게 유지 — 추가 색 도입 보수적.

**Stripe (stripe.com).** Söhne(Klim Type Foundry) 가 typographic foundation. 본문은 sparse 하지만 dashboard 페이지는 "information density 가 balanced 된 dense" — KPI · 차트 · 표가 한 화면에 있어도 typography 위계로 layered. 우리 라이딩 대시보드의 hero summary(`#hero-summary` + 4 KPI 타일) + 본체 카드 16 종이 같은 패턴 — KPI 가 5단계 num scale (hero 3.0rem → sm 0.86rem) 로 위계 잡혀 있어 Stripe 방향과 정확히 일치. **유지·강화**.

**Vercel Geist (vercel.com/geist).** 흑·백 + Geist Sans / Geist Mono 의 monospace-influenced sans. Material 컨셉 ("type 이 elevation 역할을 인코딩 — base/raised/floating/modal/fullscreen 의 type 별 chrome") [2]. 우리 shadow 토큰이 이미 4 단(`--shadow-sm/md/lg/xl`) + dashboard 의 elevation 3 단(`--shadow-sm` / `--shadow` / `--shadow-hover` / `--shadow-lg`) + hero 카드의 `card--hero` modifier(`linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)` + `box-shadow-hover` 위에 ambient lift) 가 Geist 의 "최저 elevation 우선, type 이 위계를 인코딩" 원칙을 따른다. 강점 — **유지**.

**Apple HIG 2025 / Liquid Glass.** iOS 26 / macOS 26 의 visual overhaul. translucency · depth · fluid responsiveness 강조 [3]. 4 원칙(Clarity · Deference · Depth · Consistency) 은 unchanged. Tap target ≥ 44×44 pt(touch target hit area) 와 Dynamic Type · VoiceOver 의 a11y. **우리에게 즉시 채택 가능한 것:**

- **Tap target 44×44**: `nav__icon-btn` · `nav__hamburger` · `.btn`(min-height 52px in `.fmg-result-cta`) 가 이미 충족. 다만 `.hero__quick-tag` 와 small chip 들은 더 작을 수 있어 측정 필요(§2-6).
- **Translucency / depth**: `site-header` 의 `backdrop-filter: saturate(180%) blur(14px)` + `rgba(255,255,255,0.86)` (line 416-432) 가 정확히 Liquid Glass 패턴. **유지**. 단 모바일 Safari 의 backdrop-filter 비활성 환경 fallback 색이 견고한지 점검(현재 0.86 alpha 라 fallback 도 OK).
- **Liquid Glass 의 강한 translucency** 자체는 우리 brand 가 trust · consultation 정체성이라 굳이 따라갈 필요 없음. Apple 의 디자인 트렌드를 한 호흡 늦게 채택하는 게 컨설팅 사이트에 더 적합 — **deference 원칙 우선 채택**.

**Material 3 Expressive (Google 2025).** dynamic color theming 정교화 · variable font 적극 채택 · spring 기반 fluid motion · shape morphing [4]. 46 studies / 18,000 participants 의 emotional impact 검증. **우리에게 적용 가능한 것 / 적용 보류:**

- **Variable font (variable Pretendard)**: 이미 `pretendardvariable.min.css` 로 채택(`levitaz.html:48`). variable axis(weight) 활용은 weight 토큰(--fw-300 to --fw-900) 으로 잘 묶임. 추가 axis(opsz, slnt) 가 있으면 활용 가능 — Pretendard 는 weight 단일 axis(variable wght). **이미 모범**.
- **Spring motion**: `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` 토큰 정의됨(`style.css:101`) 하지만 실제 사용처 grep 시 거의 없음. Hero `meta-item` 의 stagger reveal · CTA hover lift 등에 적용 가치. **Phase 2 motion sweep 후보**.
- **Shape morphing / dynamic theming**: 우리 brand 가 fixed identity (navy/sea/sun) 라 dynamic theme color 는 fit X. shape morphing 은 마케팅 페이지에 시각 노이즈 — fit X.

**Tailwind UI / shadcn/ui.** 2025 web 표준 design 가족. `@layer` cascade 활용 · token-first · accessible by default. 우리 코드는 vanilla CSS 라 직접 채택 X 지만 **layer 도입 plan (`@layer reset, tokens, base, layout, components, utilities, overrides`)** 은 Frontend Engineer §3-4 와 협업.

**의사결정 framework — "어느 트렌드를 채택?":**

| 트렌드 | 우리 채택 | 이유 |
|---|---|---|
| Sparse pixel · dense interaction (Linear/Stripe/Vercel) | ✅ 강화 | 컨설팅 사이트의 trust 정체성과 일치. 이미 방향 |
| Translucent header / backdrop-filter (Apple) | ✅ 유지 | 적용됨, 모범 |
| Liquid Glass 의 강한 translucency 본문 | ❌ 보류 | 컨설팅 trust 와 충돌, fashion 위험 |
| Variable font (variable wght) | ✅ 유지 | 이미 채택, perceptual smooth |
| Spring motion (motion 토큰 정의) | 🟡 plan 만 | Phase 2 motion sweep |
| Material 3 dynamic color theme | ❌ 보류 | brand fixed identity 와 충돌 |
| OKLCH color space | ✅ Phase 2 | perceptual uniformity, DataViz 협업 |
| `@layer` cascade | 🟡 plan 만 | Frontend Engineer §3-4 와 함께 |
| Component-first (shadcn 식) | ❌ 보류 | 우리는 vanilla, framework 도입 시 (Phase 2 Astro) 자연 채택 |

### 1-2. Sports / sailing 앱 시각 언어 — Strava · Garmin Connect · TrainerRoad · Surfline · Vakaros · Vantage Sailing · Njord Player

세일링·라이더 앱은 **"성과 정직성 + 코칭 가치 표현"** 이 시각 언어의 본질. 우리 라이딩 대시보드가 이미 같은 방향이지만, 6 앱의 패턴을 단무지공방 맥락으로 정리한다.

**Strava (mobile).** 정체성 색 = orange #FC4C02 (#FC4C02 단일 brand accent), 본문 neutral grayscale + map green/red(elevation gain/loss). 활동 카드 = thumbnail + 핵심 3-4 stat (distance · pace · time · elevation). hero of 화면 은 항상 최근 활동 한 개 + week summary. **단무지공방 적용:** 우리 hero summary 4 KPI(VPS · 이동시간 · 최고속도 · 총거리) 의 layered hierarchy 가 Strava 의 4 stat 패턴과 정확히 일치. **유지·강화**. 단 Strava 의 정체성 색 strong (#FC4C02) 처럼 우리도 sun #FFB800 을 hero CTA에 더 강하게 — 이미 `.btn--accent` 로 사용 중 (line 334-338).

**Garmin Connect.** 데이터-dense + ring/donut 위주 시각. 5존 HR 의 5 색은 우리 chart-theme `HR_ZONE` 과 직접 비교 가능 — Garmin 은 Z1 파랑 · Z2 초록 · Z3 노랑 · Z4 주황 · Z5 빨강의 5단계 ramp 를 쓴다. 우리 `HR_ZONE = { z1:'#3D8BD4', z2:'#27AE60', z3:'#E0A100', z4:'#EF7D00', z5:'#C0392B' }` 가 정확히 같은 매핑 — 산업 표준 따름. **유지**. Garmin 의 약점은 **너무 많은 metric 을 한 화면에 누적** → 우리는 progressive disclosure (카드 토글) 로 한 호흡 더 호흡. **유지·강화**.

**TrainerRoad / Whoop.** TrainerRoad 는 dark 본 + power zone 색 + sparse text. Whoop 은 거의 monochrome + recovery zone(green/yellow/red) 만 강조. 두 앱의 공통: **하나의 score(strain/recovery)** 가 hero, 그 score 가 어떻게 만들어졌나는 detail. 우리 **VPS(Velocity Performance Score)** 가 정확히 같은 hero score 패턴. **유지·강화**. Phase 2 의 §4-3 (VPS radial gauge + reference 마커) 가 Whoop strain donut 의 reference 모델.

**Surfline.** 라이트 본문 + photographic hero + condition forecast 의 wind-rose visual. 단일 brand cyan (#00B0FF 대) 의 hover accent. Lifestyle photography 가 trust 의 본질. **단무지공방 적용:** 우리 hero 도 `sean-herbert-brazil-1.webp` 의 photographic backdrop + overlay (line 240-247) — 같은 패턴. **유지·강화**. 단 hero overlay (`hero__cine-overlay`) 의 alpha / gradient 가 photo readability 와 text readability 사이의 trade-off — 측정·조정 권장(§2-2).

**Vakaros Atlas 2 + Vantage Sailing app.** Vantage 2.0 (2025) 의 핵심 시각 패턴 [5]: custom segments 의 색 분리 · 최대 3 connection 비교 · box plot + maneuver line chart · trim logger. Atlas 본체는 dark e-ink-like UI 에 큰 숫자 + 3-4 위젯/페이지. **단무지공방 적용:** 우리 dashboard 의 본체는 라이트지만 **replay viewer (다크) 가 정확히 Atlas + Vantage 의 다크 본**. `js/replay.js` 의 `.replay` scope + `--rp-*` 토큰이 그 인프라. **유지·강화** — §3-5 의 다크 토큰 시스템 정리.

**Njord Analytics + Njord Player.** §2 dataviz audit 에서 갭 분석 — % of target · 4 풍향 소스 · 동기 재생 strip. 시각 언어는 dark · sparse · 데이터 line 위주. **단무지공방 적용:** 우리는 light 본체 유지 (한국 시장 라이더의 모바일 daylight 사용 시나리오 우선). Player 와 같은 replay viewer 만 dark 로. **유지**.

**공통 패턴 추출 — sports/sailing 앱 시각 언어의 5 invariant:**

1. **Hero = 한 score + 3-4 stat**. 우리 VPS + 4 KPI 가 일치.
2. **단일 brand accent + neutral 본문**. 우리 sun #FFB800 + navy/slate 가 일치.
3. **Photographic / lifestyle backdrop**. 우리 hero PPC Brazil 이 일치.
4. **5존(HR) 색의 산업 표준 ramp**. 우리 `HR_ZONE` 이 Garmin/Whoop 와 일치.
5. **다크 replay viewer + 라이트 본체 분리**. 우리 `.replay` scope 가 정확히 같은 분리.

이 5 invariant 모두 우리 코드에 이미 박혀 있다 — 단무지공방은 **sports/sailing 앱 시각 패턴의 frontier 가 아니라 표준** 을 따르고 있다. 좋은 출발점.

### 1-3. 금융 / 분석 dashboard — 정보 밀도 vs 호흡

라이딩 분석 대시보드는 본질적으로 **post-session 분석 도구** — 금융 dashboard(Stripe Dashboard · Bloomberg Terminal · Vercel Analytics) 의 information-dense 패턴이 직접 적용된다. 단 라이더는 trader 와 달리 **하루 1 회 분석 + 모바일 우선** 이라 Bloomberg 의 6-window 동시 노출이 fit X 다.

**Stripe Dashboard.** 좌 sidebar + 본문 top KPI 3-4 + 차트 + 표. KPI는 항상 number + spark + delta. 우리 hero summary 의 4 KPI 가 좌측 column 의 stat-strip 으로 자연 옮길 수 있는 형태 — 라이딩 대시보드의 hero 가 이미 같은 hierarchy. **유지**.

**Bloomberg Terminal.** 4-6 window 동시 + monochrome + 5존 색 (green/yellow/red/blue) — 우리 brand 와 무관. **참고 X**.

**Vercel Analytics.** sparse + 차트 + period selector + filter. 우리 progression 차트의 toggle (line/bar) 이 같은 패턴.

**핵심 framework — "정보 밀도 vs 호흡" 의 4 원칙:**

1. **Hero 는 sparse — 단일 score + 3-4 KPI**. 본체 카드는 한 그릇에 한 chart + 한 표. 우리 대시보드 16 카드가 각각 한 영역.
2. **표 vs 차트 — 차트 우선 ([[feedback_dashboard_viz_chart_over_table]])**. 표는 차트 보완용. 우리 ManeuverTable · CompareTable 도 같은 패턴.
3. **모바일 한 화면 = 한 결정**. Hero KPI + 다음 카드까지 fold 1 화면. 우리 모바일 stack 이 이 패턴.
4. **번호 typography = tabular-nums + tight tracking + monospace 또는 proportional num**. `.num` 클래스 (`style.css:213`) 가 Inter + `font-feature-settings: "tnum"` — 정통. **유지**.

### 1-4. Typography 마스터 — Pretendard · Inter · variable fonts · Korean + Latin pairing · 한국어 widow 정책

**Pretendard.** Neo-grotesque, Inter + Source Han Sans + M PLUS 1p 기반의 cross-platform 한글+Latin 통일 가족 [6]. 9 weights · variable wght axis. 우리 사이트가 `pretendardvariable.min.css` 채택 — 모범. 한글의 visual rhythm 이 Inter 와 잘 페어링됨 (양쪽이 같은 cap height · x-height 와 비슷한 stroke contrast).

**font stack 권장 (Pretendard 공식 [6]):**
```css
font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont,
  system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo',
  'Noto Sans KR', 'Malgun Gothic', sans-serif;
```

우리 `style.css:40` 의 stack 이 사실상 같음 — 정확. 단 **`'Pretendard'` 가 `'Pretendard Variable'` 보다 먼저** 와 있는데 권장 순서는 Variable → 정적 — 폰트 fallback 우선순위 미세 조정 권장. 영향 미미 (둘 다 같은 가족) 이라 P3.

**Inter.** Latin·숫자 전용. `.num` `.en` 클래스에 적용 (`style.css:213`). Inter 의 tabular-nums(`tnum`)·stylistic alt 01(`ss01` — disambiguates 0/o, 1/I) 이 활용됨 — 모범. JetBrains Mono (`.mono`) 도 같은 feature settings.

**Variable font axes 활용도.**

| Axis | Pretendard | Inter | 우리 사용 |
|---|---|---|---|
| wght (weight) | 100–900 | 100–900 | ✅ 7단계 (--fw-300 to --fw-900) |
| opsz (optical size) | X | ✅ 14–32 | ❌ 미활용 |
| slnt (slant) | X | ✅ -10 to 0 | ❌ 미활용 |
| GRAD (grade) | X | ✅ -200 to 150 | ❌ 미활용 |

Inter 의 opsz 활용 — 큰 disp 사이즈 (`--fs-display`, `--fs-num-hero`) 에서 광학 조정 — 이 Phase 2 typography polish 후보. 단 visual 변화가 미세하고 한국어 본문이 Pretendard 라서 영향은 일부 영역에 한정.

**한국어 typography 정책 [[feedback_korean_period_rule]] 준수.**

`style.css:147-205` 의 정책이 이미 완전 [7]:

- `word-break: keep-all` — 어절 유지, 단어 중간 줄바꿈 차단
- `overflow-wrap: break-word` — 너무 긴 토큰만 break
- `text-wrap: balance` — h1/h2/h3 의 widow 방지 (Chrome 114+, Safari 17.4+, Firefox 121+)
- `text-wrap: pretty` — lead / paragraph 의 last-line widow 방지
- `hanging-punctuation: allow-end` — 마지막 문장부호 hang
- Fallback: `@supports not (text-wrap: balance) { max-width: 22em }`

**한 가지 추가 권장**: Korean period rule 이 `feedback_korean_period_rule` 메모리에 있는데, 문장 끝 마침표 정책이 현재 본문에서 일관한지 검증 권장. Hero lead (`index.html:253-256`) 는 "큐레이션해 드립니다" 로 마침표 없이 끝남 — 단무지공방의 의도가 "tagline 은 마침표 없음, 문장은 마침표 있음" 인지 [[feedback_korean_period_rule]] 본문 확인 후 확정.

**Type scale 통합 권장 (§3-2).**

| 시스템 | 스케일 | 사용처 |
|---|---|---|
| `style.css` `--fs-*` | xs/sm/base/md/lg/xl/2xl-7xl (12 단) | 메인 사이트 본문·헤딩 |
| `style.css` `.t-display`·`.t-display-xl`·`.t-h1-3`·`.t-eyebrow`·`.t-lead` | clamp() 기반 7 utility | 메인 사이트 타이포 utility |
| `dashboard.css` `--fs-section`·`--fs-card`·`--fs-body`·`--fs-label`·`--fs-foot`·`--fs-micro`·`--fs-th` | 7 단 본문 | 대시보드 본문 |
| `dashboard.css` `--fs-num-hero`·`xl`·`lg`·`md`·`sm` | 5 단 숫자 | 대시보드 num display |

**세 그룹이 분리**돼 있으나 일부 의미가 겹친다 — 예: `--fs-section`(1.08rem) ≈ `--fs-md`(1.125rem), `--fs-card`(1rem) = `--fs-base`(1rem), `--fs-foot`(.72rem) ≈ `--fs-xs`(.75rem). **권장 Phase 2 정리:**

- 메인 사이트의 `--fs-*` 를 canonical 로 유지.
- 대시보드의 `--fs-section` 등을 `var(--fs-md)` 등으로 alias.
- `--fs-num-*` 5 단은 대시보드 전용(숫자 디스플레이) 으로 유지 — 의미가 다름.

### 1-5. Color theory — OKLCH · WCAG AAA · perceptually uniform · 한국 라이딩 emotional code

**OKLCH.** 2023 CSS Color Module Level 4. Lightness · Chroma · Hue 의 3 component, perceptually uniform [8]. 같은 L 의 두 색은 같은 밝기로 보인다. **2025 web 의 점진 표준** — Vercel · Linear · GitHub Primer 가 점진 채택. wide-gamut Display P3 까지 지원.

**우리 status 5 앵커의 OKLCH 변환 (예시):**

| 단계 | sRGB hex | OKLCH 근사 |
|---|---|---|
| veryGood | #1FA055 | oklch(60.5% 0.16 145) |
| good | #7FC241 | oklch(75.1% 0.18 132) |
| mid | #F2C20E | oklch(82.5% 0.18 95) |
| bad | #EC8A2E | oklch(70.4% 0.17 55) |
| veryBad | #D6453A | oklch(58.6% 0.20 32) |

OKLCH 보간이 sRGB lerp 보다 perceptually smooth — 특히 mid ↔ bad 의 노랑 ↔ 주황 사이.

**WCAG 2.2 contrast 검증 (우리 토큰 기준):**

| 조합 | contrast | AA 통과 | AAA 통과 |
|---|---|---|---|
| navy(#0A2540) on white | 13.7:1 | ✅ | ✅ (정상 텍스트 7:1 초과) |
| slate(#5C6F7E) on white | 4.85:1 | ✅ (4.5:1) | ❌ (7:1 미달) |
| sea(#1F8FFF) on white | 3.05:1 | ✅ (large text 3:1) | ❌ |
| sun(#FFB800) on white | 1.85:1 | ❌ | ❌ |
| sun(#FFB800) on navy | 7.48:1 | ✅ | ✅ |
| white on navy | 13.7:1 | ✅ | ✅ |

**핵심 의사결정:**

- **sun #FFB800** 은 navy 배경 위에서만 텍스트로 사용 — 우리 `.btn--accent` 가 navy 텍스트로 sun 배경(역) — contrast 11.4:1 — 통과. 옳다.
- **slate #5C6F7E** 는 본문 보조(`--text-secondary`) — AA 통과 / AAA 미달. 정상 텍스트 AAA 가 필요한 영역(국가 a11y 요구) 이면 #4D5D6B 정도로 한 단계 깊게.
- **sea #1F8FFF** 는 link 색 (`--link: var(--color-sea)`). 작은 텍스트(`<a>` 본문 링크) AA 통과 borderline 3.05:1 — 정확히 large text 3:1 cutoff. 본문 링크는 16px 이라 large text(18.5px+) 가 아님 → **fail risk**. 권장: `--color-sea-dark` (#1670CC 4.15:1) 를 본문 링크색으로 사용, sea 는 button bg 나 large heading 강조에. `style.css:534` 의 `.nav__sub-link:hover` 가 정확히 그 패턴.

**한국 라이딩 환경 색채 — emotional code.**

한국 윙포일 spot 의 자연 색채는 (a) 햇빛 노랑·황금 (특히 황혼 magic hour), (b) 물 — 부산 광안리·기장의 deep blue 부터 제주 함덕의 turquoise 까지, (c) 바람 — visible 안 함, 풍기 / 깃발 / 파도 결로 표현. 단무지공방의 brand triplet (navy = 물 / sea = 하늘+sea / sun = 햇빛) 가 정확히 이 emotional code 와 일치한다. **유지·강화**.

**색 보조 (status 5 앵커 외) — colorblind 친화 + brand emotional.** Phase 2-B 에 colorblind-safe alt palette toggle 권장 (§3-1) — Okabe-Ito 변형 8 색 또는 viridis 5 단 sequential 의 옵션. setting 페이지에서 사용자 토글. 단 cultural prior (빨강=나쁨 / 초록=좋음) 가 한국에서 매우 강해 alt palette 가 default 일 수 없음 — opt-in 만.

### 1-6. Motion design — micro-interactions · spring · prefers-reduced-motion · 의미있는 transitions

Motion 의 본질은 **"공간의 변화를 시간으로 인지하게"**. Material Motion · Apple HIG · Disney 12 principles 가 공통적으로 강조하는 4 원칙:

1. **Causality** — A 이벤트가 B 결과를 일으킨다는 인과 관계가 motion 으로 보여야 함. 우리 nav dropdown 의 `opacity 0 → 1 + translateY(8px → 0)` 가 causality 정통 (`style.css:498-518`).
2. **Continuity** — sub 페이지 ↔ 본 페이지 transition 의 spatial continuity. 단 우리는 다중 페이지 정적 사이트라 page transition 부재 (Phase 2 Astro view-transitions API 검토).
3. **Personality** — brand 의 emotional 색. 단무지공방은 trust + consultation 정체성 → 강한 spring · bounce 보다 ease-out · 짧은 duration 이 fit. 현재 `--ease: cubic-bezier(0.4, 0, 0.2, 1)` (Material standard) + `--dur-base: 260ms` 가 정확.
4. **Performance** — 60 fps · transform/opacity 위주 (layout/paint 금지). 우리 `:hover { transform: translateY(-1px) }` 가 transform만 — GPU acceleration. 모범.

**Motion 토큰 audit (style.css:99-105):**

| 토큰 | 값 | 사용처 |
|---|---|---|
| `--ease` | `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard) | 일반 transition |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | exit, reveal |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy) | 정의만, 실제 사용 거의 X |
| `--dur-fast` | 180ms | micro hover |
| `--dur-base` | 260ms | 카드 / 컴포넌트 |
| `--dur-slow` | 420ms | 큰 transition (mobile menu) |

**평가:**

- `--ease-spring` 의 실제 사용처가 거의 없음 — `style.css` 전체 grep 결과 0건. 정의만 있고 미사용. **Phase 2 motion sweep** 에 hero meta-item stagger reveal 또는 brand card lift 에 spring 적용 권장. 단 컨설팅 trust 정체성과 충돌 안 하는 미세한 spring (overshoot 5% 이하) 만.
- **prefers-reduced-motion** : `style.css:123-129` 가 모든 animation/transition duration 을 0.01ms 로 — 정통. 단 일부 inline style transition (`transition:all 180ms ease`) 이 reduced-motion 우회 — 인라인 스타일 추출 시점에 함께 정리.

**Micro-interaction 표준 (Phase 2 강화 후보):**

- **Hover lift**: `translateY(-1px)` (btn) / `translateY(-4px)` (card) — 일관성 OK. `--dur-base` 260ms · `--ease`.
- **Focus ring**: 현재 `.btn:focus-visible` 만 명시. **Phase 1 plan §4-1** — 전 focusable.
- **Stagger reveal**: `index.html` 의 `.reveal` 클래스가 IntersectionObserver 기반 — 좋은 패턴. stagger 적용 시 `--dur-base` × child index 로 0.5s 이내 완료.
- **Loading skeleton**: 현재 미적 (cart.html 의 데이터 fetch fallback 만). Phase 2 의 표준 skeleton component 권장 (UX Researcher §5 Top 5).

**accessibility 관점.** `prefers-reduced-motion` 외에 **vestibular disorder** 사용자 보호 — parallax · 빠른 zoom · spinning · auto-play video 금지. 우리 hero 의 photographic backdrop 은 정적 (auto-play video 는 TODO 로 보류, `index.html:233-237`). **유지** — auto-play video 도입 시 `prefers-reduced-motion` 분기 필수.

---

## 2. 현재 사이트 visual audit

전 영역 6 단위 — design tokens · 메인 사이트 페이지별 · 라이딩 대시보드 · 제품 상세 · 보조 페이지 · 컴포넌트. 각 단위 강점(보존) · 약점(개선) · 우선순위 권장 (P1 즉시 / P2 Phase 2 / P3 백로그).

### 2-1. Design tokens — `:root` 변수 시스템

**파일:** `assets/css/style.css:7-111` (메인) · `riding-dashboard/css/dashboard.css:13-102` (대시보드) · `riding-dashboard/js/chart-theme.js` (차트)

**강점 (보존):**

- **3-tier 색 구조**: brand (navy/sea/sun) · neutral 7 단 (white→mist→fog→stone→slate→charcoal→ink) · semantic (bg/text/border/accent) — Geist / Material 의 token tier 와 정확히 같은 구조.
- **Type scale 12 단** (xs 12 → 7xl 96) — modular, mobile-first.
- **Weight 7 단** (300-900) — 정통.
- **Spacing 9 단** (4px base) — 4px grid 정통.
- **Radius 5 단** (sm 4 / md 8 / lg 16 / xl 24 / full).
- **Shadow 4 단** — 모두 `rgba(10,37,64,...)` navy-tinted (자연 light source 위치 고정). Geist 의 "type encodes elevation" 원칙과 일치.
- **Motion 3+3** — easing 3 + duration 3, 정통.
- **`prefers-reduced-motion` 명시** + **한국어 typography 정책** 풀 박혀 있음.
- **Chart-theme 4 계열 색 토큰 분리** + `goodness(value, direction, opts)` 5 방향 (higher/lower/heel/twaDown/neutral) — 산업 표준 이상.

**약점 (개선 후보):**

- **이중 prefix**: `--color-navy` (메인) vs `--navy` (대시보드). 같은 색 두 이름. **P1**
- **`--ease-spring` 미사용** — 정의만 있고 활용 X. **P2**
- **focus-ring 토큰 부재** — `--ring-color` `--ring-width` `--ring-offset` 같은 명시 token 없음. focus 스타일이 ad-hoc. **P1**
- **dark token 부재** — replay viewer 의 `--rp-*` 외에는 없음. 메인 사이트의 dark section (`section--dark`) 은 inline `rgba(255,255,255,0.86)` 등으로 표현. **P3** (light 우선 정책이라 보류)
- **OKLCH 미사용** — 모든 색이 hex/rgb. perceptually uniform 보간 안 됨. **P2 (DataViz 협업)**

**권장 우선순위:**

| # | 항목 | 우선순위 | Effort |
|---|---|---|---|
| 1 | `--color-*` canonical prefix 일원화 + dashboard alias | P1 | 1-2h |
| 2 | `--ring-*` focus token 신설 | P1 | 30m |
| 3 | OKLCH 보간 도입 (statusAt v2) | P2 | 2-4h |
| 4 | `--ease-spring` 활용 sweep | P2 | 1-2h |
| 5 | Dark token 시스템 (Phase 3) | P3 | — |

### 2-2. 홈페이지 (`index.html`) — hero · brand · level grid · CTA · footer

**Hero (`hero--cinematic`, line 230-331):**

- **강점**: Full-bleed photographic backdrop (PPC Brazil) + overlay gradient + 한 단락 lead + 2 CTA + quick-tag chips + 4 hero__meta stat. **Strava 의 4 stat 패턴 + Stripe 의 sparse hero + Surfline 의 lifestyle photo 가 합쳐진 모범**. `loading="eager" decoding="async" fetchpriority="high"` LCP 최적화.
- **약점**:
  - Hero lead 가 한 단락에 정보 밀도가 매우 높음 (3회 올림픽·3개국 코치·옥덕필·조수철 + 4 브랜드). UX Researcher §0 의 NN/g 권장 ("hero = 한 가치 + 한 CTA") 와 비교 — 약간 dense. 단무지공방의 **trust 정체성을 일순간 노출** 의 의도가 있음 → trade-off.
  - `hero__cine-overlay` 의 alpha / gradient 가 photo 와 text readability 의 균형 — measure 필요. 모바일 작은 화면에서 text-on-image readability 가 떨어질 가능성.
- **권장 P2**: hero lead 의 정보 압축 — credential 을 `hero__meta` (이미 4 stat 노출) 와 trust-bar (4 항목) 의 합산으로 옮기고, lead 본문은 "한 가치 + 한 CTA" 의 단순 라인 으로. **Marketing & Social 협업** — copy 결정.

**Trust Bar (`trust-bar`):**

- **강점**: navy bg + white text, sparse 4-항목 (3회 올림픽 / 네 브랜드 / 당일 출고 / 카톡 컨설팅). 시각 위계 명확. 모바일 가로 스크롤 fallback.
- **약점**: `index.html` 의 trust-bar 는 4 항목, `level/beginner.html` 같은 chapter 페이지는 3 항목 — **사이트 전체 일관성 부재** (UX Researcher §1-2 Nielsen #4). **P1** — 한 source-of-truth (CSS `<template>` 또는 Phase 2 Astro layout) 로 묶음 권장. **UX Researcher 와 협업.**

**Philosophy section (`#philosophy`, 단·무·지 한자):**

- **강점**: section--mist + 한자 3 박스 + emoji-free 정통 typography. 단무지공방의 정체성 정명문이 시각에 박힘.
- **약점**: inline background image (line 338) 가 인라인 스타일 — 컴포넌트화 권장. **P2**.

**Consultation Hub (`#consultation`):**

- **강점**: section gradient bg + hero CTA card (navy → sea gradient) + level grid 4 + style grid 4. 정보 layered.
- **약점**:
  - **인라인 스타일 산재** (line 382-398 의 hero CTA card 전체가 inline `style="..."`). 회귀 위험 + maintenance burden.
  - **Level grid 4 카드** (line 401-424) 가 모두 `style="..."` + `onmouseover/onmouseout` 인라인 — 회귀 위험 + a11y(`onmouseover` 는 키보드 사용자에게 안 도달).
- **권장 P1**: 인라인 스타일 → `.hub-cta` · `.level-card--{beginner,intermediate,advanced,pro}` 컴포넌트 클래스 추출 spec (Frontend Engineer 협업, Phase 2 구현).

**Brand cards (`/brands` section 또는 동등):** 4 브랜드 (Levitaz / PPC / Takoon / WIP) 카드. monogram L/P/T/W + 한 줄 설명. **mobile-menu 의 brand-grid 가 정통 패턴** (`style.css:663-681`). 메인 페이지의 brand card 도 같은 패턴 권장 — **P2 통일**.

**Footer:** 표준 4-column footer (브랜드 · 도움말 · 정책 · 연락) — 좋은 구조. 단 mobile menu 의 brand grid 와 footer 의 brand link 가 별도 — 한 source-of-truth.

### 2-3. 라이딩 대시보드 (`riding-dashboard/`) — hero summary · 카드 · replay viewer

**Hero summary 오버레이 (`#hero-summary`, app.js:691-860):**

- **강점**: 트랙 SVG path + 4 KPI 타일 (VPS · 이동시간 · 최고속도 · 총거리) + 5초 auto-dismiss + Esc/Enter/Space/click dismiss + skip 버튼. **Strava 의 "활동 카드 thumbnail + 4 stat"** 정통.
- **약점**: Lucide line icons (trophy / timer / gauge / route) 가 라벨과 정보 중복 (DataViz §2-1 audit). hero 1회성이라 큰 문제 아님.
- **권장 P3**: KPI 옆 mini sparkline (시즌 추세) — DataViz §4-2 와 묶음.

**16 차트 카드** — DataViz §2 가 이미 카드별 audit 완료. 시각 디자인 관점에서 추가:

- **카드 chrome 일관**: 모든 카드가 `.card` 패딩 16px + border-soft 1px + shadow + radius 14. `.card--hero` 는 gradient + shadow-hover 강조. **유지**.
- **카드 head 구조**: `card__head` (h3 + hint) 가 모든 카드에서 baseline align — 정통.
- **부분 inline style**: 일부 차트 카드의 toggle (unit-toggle 등) 이 inline + class 혼합 — 정리 권장.

**Replay viewer (`.replay` scope · 다크):**

- **강점**: 다크 본 + `--rp-*` 토큰 + 영상 + 미니차트 + 시간 동기. Atlas/Vantage/Njord Player 와 같은 방향.
- **약점**: `--rp-*` 토큰의 design 위계가 메인 light 토큰과 1:1 매핑되지 않음 — light `--color-navy` ↔ dark `--rp-bg` 등의 매핑 표가 없음. **Phase 3** 의 dark mode 시스템 도입 시 정리. **P3**.

### 2-4. 제품 상세 페이지 — `levitaz.html` · `ppc.html` · `takoon.html` · `wip.html`

**공통 구조 audit** (`levitaz.html` 첫 60 줄만 확인 + Frontend Engineer audit 참조):

- **강점**:
  - `theme-color #0A2540` meta (PWA-ready).
  - canonical · og:* meta + favicon SVG inline (32×32).
  - Pretendard Variable + Inter + JetBrains Mono CDN preconnect — LCP 최적.
  - Stale SW auto-cleanup (§172) inline.
- **약점**:
  - 제품 4 종 (Levitaz/PPC/Takoon/WIP) 의 hero · brand identity 색이 4 브랜드별로 다른지 확인 필요 — 만약 brand monogram color 가 동일 navy 면 brand identity 가 약함. mobile-menu 의 `mobile-menu__brand-grid a small` (style.css:675-680) 는 단일 색 — 4 브랜드 monogram L/P/T/W 의 색 분리 권장.
- **권장 P2**: 4 브랜드 monogram color 토큰 신설 — `--brand-levitaz` `--brand-ppc` `--brand-takoon` `--brand-wip`. 각 brand 의 official identity color 또는 우리 brand triplet (navy/sea/sun + 4th) 의 4 split. Marketing & Social 결정.

### 2-5. 보조 페이지 — `cart.html` · `quote.html` · `profile.html` · `level/*` · `style/*` · `find-my-gear.html` · `glossary.html`

- **find-my-gear.html**: 5-step quiz + `step-result`. CTA · 결과 카드. UX Researcher §3 가 audit 완료. 시각 관점 — quiz step 의 progress bar + step indicator 가 정통.
- **cart.html / quote.html**: 표 + 가격 + 카톡 CTA. cart counter badge (`nav__cart-badge` `data-cart-badge` + `cart.js` 자동 업데이트, §171-B) — 시각 OK.
- **profile.html**: 마이페이지. supabase auth + 라이딩 세션 list.
- **level/* · style/***: level (beginner/novice/intermediate/advanced/pro) 5 챕터 + style (flat-speed/choppy-freeride/wave/hybrid) 4 챕터. 각 chapter 의 hero · 큐레이션 카드 · CTA. 시각 일관성 강 — 같은 trust-bar / nav / footer / typography 가족.
- **glossary.html**: 윙포일 용어 사전. 정통 글로서리.

**공통 visual audit:**

- **강점**: 같은 trust-bar / nav / footer / typography / spacing. brand 일관.
- **약점**: 위 페이지들이 사실상 nav · footer · head 가 128 페이지에 복사돼 있음 (Frontend Engineer §0 audit). visual diff 추적이 어렵다 — 한 페이지의 디자인 결정이 다른 페이지에 자동 전파 안 됨. **Phase 2 Astro layout** 으로 해결될 burden.

### 2-6. 컴포넌트 audit — nav · hero · card · button · pill · footer

**Nav (`style.css:415-604`):**

- **강점**: sticky + backdrop-blur + dropdown 5 entry + cart + login. iOS hit-test fix (§171-C). nav__icon-btn 44×44 (HIG 통과).
- **약점**: dropdown 깊이 한 단계만 — Phase 2 카테고리 확장 시 mega-menu 검토 (Linear/Stripe 식).

**Card (`.card`, line 400-413):**

- **강점**: hover translateY(-4px) + shadow-lg + border transparent (강조). Geist 의 raised card 정통.
- **약점**: 인라인 스타일 카드 (consultation hub level grid) 가 같은 `.card` 패턴을 따라야 하는데 별도 inline. **P1 추출**.

**Button (`.btn`, line 303-358):**

- **강점**: 3 variant (primary/accent/ghost/ghost-light) + 2 size (lg/sm) + arrow icon transition. focus-visible.
- **약점**: focus-visible 정책이 .btn 만 — link / card / pill 등 미적용. **§4-1 표준화**.

**Pill (`.pill`, line 383-397):**

- **강점**: 4 variant (default/accent/mute/dark). 작은 chip 으로 hero quick-tag 에 사용.
- **약점**: `.hero__quick-tag` 가 별도 클래스 — pill 과 공유 가능 검토.

**Footer**: 표준 4-col, 일관.

**아이콘 시스템 (전 사이트):**

- **현황**: inline SVG 가 trust-bar 체크 / nav cart / hero arrow / find-my-gear icons / dashboard Lucide icons 모두 ad-hoc.
- **권장 P2**: Lucide line icons 표준화 — viewBox 24×24 + stroke-width 2 + linecap/linejoin round. CDN `unpkg.com/lucide-static` 또는 `<svg><use>` sprite. **§4-5**.

---

## 3. 디자인 시스템 v2 — 토큰 제안

### 3-1. Color 시스템 v2 — OKLCH 보간 · semantic layer 강화 · colorblind-safe alt

**Tier 1 — Global tokens (raw values, unchanged):**

```css
:root {
  /* Brand — sRGB hex (legacy compat) */
  --color-navy:        #0A2540;
  --color-navy-deep:   #061A2E;
  --color-sea:         #1F8FFF;
  --color-sea-dark:    #1670CC;
  --color-sun:         #FFB800;
  --color-sun-dark:    #E0A100;

  /* Brand — OKLCH (Phase 2 — perceptual interpolation source) */
  --color-navy-oklch:      oklch(22.5% 0.05 250);
  --color-sea-oklch:       oklch(64.5% 0.20 250);
  --color-sun-oklch:       oklch(82.0% 0.18 85);

  /* Neutral — same as v1 */
  --color-white: #FFFFFF; --color-mist: #F5F7FA;
  --color-fog:   #E5EAF0; --color-stone: #C7CFD8;
  --color-slate: #5C6F7E; --color-charcoal: #2A3B4C;
  --color-ink:   #0A2540;
}
```

**Tier 2 — Alias (semantic) tokens:**

```css
:root {
  --bg-primary:        var(--color-white);
  --bg-secondary:      var(--color-mist);
  --bg-dark:           var(--color-navy);
  --bg-darker:         var(--color-navy-deep);
  --text-primary:      var(--color-navy);
  --text-secondary:    var(--color-slate);   /* AA pass, AAA fail — link 본문에는 미사용 */
  --text-on-dark:      var(--color-white);
  --text-on-dark-mute: rgba(255,255,255,0.86);
  --border:            var(--color-fog);
  --border-strong:     var(--color-stone);
  --accent:            var(--color-sun);
  --link:              var(--color-sea-dark);  /* sea 대신 sea-dark (4.15:1 AA pass) */

  /* Phase 2 신규 */
  --ring-color:        var(--color-sea);
  --ring-color-on-dark: var(--color-sun);
  --ring-width:        2px;
  --ring-offset:       2px;

  /* Brand identity (Phase 2 — Marketing & Social 합의) */
  --brand-levitaz:     #0A2540;  /* placeholder — confirm */
  --brand-ppc:         #1F8FFF;
  --brand-takoon:      #FFB800;
  --brand-wip:         #5C6F7E;
}
```

**Tier 3 — Component-scoped (Astro / framework migration 시 자연):** `--btn-bg`, `--card-shadow`, `--input-border` 등. Phase 2 framework 도입 시.

**Dashboard.css alias 화 (Phase 2-A 안전 마이그레이션):**

```css
/* Phase 2 — 점진 마이그레이션: 기존 --navy 토큰을 alias 로 유지 */
:root {
  --navy:      var(--color-navy);
  --navy-deep: var(--color-navy-deep);
  --sea:       var(--color-sea);
  --sea-deep:  var(--color-sea-dark);
  --sun:       var(--color-sun);
  --sun-deep:  var(--color-sun-dark);

  /* 신규 코드는 --color-* 만 사용 — --navy 등은 점진 deprecated */
}
```

**Chart status 5 앵커 OKLCH 보간 (RDChartTheme.statusAt v2 — DataViz 협업):**

```js
/* Phase 2 — statusAt v2: sRGB lerp → OKLCH lerp.
   앵커 값 자체는 유지 (cultural prior 유지),
   보간 중간색만 perceptually smooth. */
function statusAtV2(g) {
  /* OKLCH 공간에서 보간 후 sRGB 로 변환.
     실제 구현은 color-mix(in oklch, ...) 또는 polyfill */
}
```

**Colorblind-safe alt palette (Phase 2-B 옵트인):** Okabe-Ito 변형 5 단 — `#E69F00` `#56B4E9` `#009E73` `#F0E442` `#0072B2`. setting 페이지에서 사용자 토글.

### 3-2. Typography 시스템 v2 — Pretendard Variable · Inter · 한·영 통합 + num scale

**Font stack v2 (canonical):**

```css
:root {
  --font-sans-kr: 'Pretendard Variable', Pretendard, -apple-system,
    BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue',
    'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR',
    'Malgun Gothic', sans-serif;
  --font-sans-en: 'Inter', -apple-system, BlinkMacSystemFont,
    system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'SF Mono', Menlo, monospace;
}
```

**Type scale v2 (메인 + 대시보드 통합):**

| Token | Value | Mobile clamp | 사용처 |
|---|---|---|---|
| `--fs-micro` | .66rem (10.5px) | — | 배지 / 표 헤더 보조 |
| `--fs-foot` | .72rem (11.5px) | — | footnote |
| `--fs-xs` | .75rem (12) | — | label / eyebrow |
| `--fs-sm` | .875rem (14) | — | small body / button-sm |
| `--fs-base` | 1rem (16) | — | body |
| `--fs-md` | 1.125rem (18) | — | section title (대시보드) |
| `--fs-lg` | 1.25rem (20) | — | card title |
| `--fs-xl` | 1.5rem (24) | clamp(1.5, 2vw+.75, 2.25) | h2 |
| `--fs-2xl` | 1.875rem (30) | clamp(1.875, 3vw+1, 3) | h1 |
| `--fs-3xl` | 2.25rem (36) | clamp(2.25, 5vw+1, 5) | display |
| `--fs-4xl` | 3rem (48) | clamp(2.75, 7vw+1, 6) | display-xl / num-hero |
| `--fs-5xl` | 3.75rem (60) | — | extra display |
| `--fs-6xl` | 4.5rem (72) | — | hero meta num (3개국·4·64) |
| `--fs-7xl` | 6rem (96) | — | "64 시나리오" |

**Num scale (대시보드 전용 — 유지):** `--fs-num-hero` 3rem · `--fs-num-xl` 1.92rem · `--fs-num-lg` 1.32rem · `--fs-num-md` 1.02rem · `--fs-num-sm` .86rem. 정통.

**Korean policy v2 (유지·강화):** `style.css:147-205` 그대로. 추가 권장 — section heading 에 `text-wrap: balance` 일관 적용 확인.

**Period rule (Phase 1 plan, [[feedback_korean_period_rule]] 확정 후):** tagline / CTA 는 마침표 없음, 문장 lead 는 마침표 있음. 본문 검증 후 sweep.

### 3-3. Spacing & rhythm

**9 단 spacing (4px base, 유지):** 1=4 / 2=8 / 3=12 / 4=16 / 6=24 / 8=32 / 12=48 / 16=64 / 24=96 / 32=128.

**Dashboard 의 6 단 spacing (`--space-1..6`) 도 같은 4px base** — alias 화 가능. Phase 2-A.

### 3-4. Elevation & shadow — Geist 의 "type encodes elevation" 원칙

**4 단 shadow (유지):**

| Token | Value | 사용처 |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(10,37,64,0.06)` | input · pill |
| `--shadow-md` | `0 4px 12px rgba(10,37,64,0.08)` | btn hover · card |
| `--shadow-lg` | `0 12px 32px rgba(10,37,64,0.12)` | card hover · dropdown |
| `--shadow-xl` | `0 24px 64px rgba(10,37,64,0.18)` | modal · toast |

**Dashboard 의 다층 shadow (3 leveled, 유지):** `--shadow-sm` / `--shadow` (1+2+8) / `--shadow-hover` (1+6+16) / `--shadow-lg` (1+10+24). 정통.

**Elevation 사용 원칙 (Geist 채택):**

- **최저 elevation 우선** — over-elevation 은 visual noise. 본 카드 `--shadow-md` 만, hover 시 `--shadow-lg`.
- **Shadow 단독으로 elevation 인코딩 금지** — focus ring · border 와 함께. 우리는 card 의 `border: 1px solid var(--border)` + shadow 가 함께 — 모범.

### 3-5. Motion & micro-interactions

**3 ease + 3 duration (유지):**

| Easing | 값 | 의도 |
|---|---|---|
| `--ease` | Material standard (0.4, 0, 0.2, 1) | 일반 transition |
| `--ease-out` | (0.16, 1, 0.3, 1) | exit · reveal |
| `--ease-spring` | (0.34, 1.56, 0.64, 1) | hero stagger · brand card lift (Phase 2 sweep) |

**Motion 사용 표준:**

- Hover lift: `transform: translateY(-1px)` (btn) / `translateY(-4px)` (card) · `--dur-base` · `--ease`.
- Focus ring: instant (animation 0) · contrast 3:1+.
- Reveal: opacity 0→1 + translateY(8px→0) · `--dur-base` · `--ease-out`.
- Stagger (Phase 2): child index × 80ms 미세 stagger, 0.5s 이내 완료.

**Reduced motion:** `style.css:123-129` 모든 animation/transition 0.01ms. **유지·강화** — 인라인 transition (`transition:all 180ms ease`) 도 reduced motion 우회 안 하게 sweep.

### 3-6. Component-level tokens (Phase 2 framework migration 자연 채택)

framework 도입 시 (Astro · Svelte · React) — `--btn-bg`, `--btn-hover-bg`, `--card-radius`, `--input-border` 등 component-scoped token. Phase 2.

---

## 4. Top 5 즉시 개선 — effort × impact 매트릭스

| # | 개선 | Effort | Impact | Phase 2 dispatch 시 첫 작업 |
|---|---|---|---|---|
| 1 | Focus ring 정책 표준화 + WCAG 2.2 #2.4.13 | 2-4h | ★★★ a11y 통과 · 키보드 사용자 인지 | `:focus-visible` mixin 한 곳에서 button/link/card/pill 모두 적용. dark context 는 `--ring-color-on-dark` swap |
| 2 | Token canonical 화 (`--color-*` 일원화) | 1-2h | ★★ DRY · maintenance | dashboard.css 의 `--navy` 등을 `var(--color-navy)` alias 로 |
| 3 | OKLCH 보간 도입 (statusAt v2) | 2-4h | ★★ perceptual smooth · DataViz 협업 | `chart-theme.js` `statusAt(g)` 의 sRGB lerp → OKLCH polyfill 또는 `color-mix(in oklch, ...)` |
| 4 | 인라인 스타일 → 컴포넌트 클래스 추출 | 4-8h | ★★ maintenance · 회귀 감지 | `index.html` 의 hero CTA grad / level grid 4 / style grid 4 / consult hub → `.hub-cta` `.level-card` `.style-card` |
| 5 | 아이콘 시스템 통일 (Lucide line icons) | 2-4h | ★ 시각 일관 · grep-replace 용이 | 전 inline SVG → Lucide static 또는 `<svg><use>` sprite. viewBox 24×24 + stroke-width 2 + linecap round |

**P1 5 건 effort 합산 약 11-22 시간** — Phase 2 첫 sprint 1-2 일 분량. Visual + Frontend Engineer + DataViz 3 협업.

**Phase 2 의 다음 우선순위 (P2):**

6. Trust-bar source-of-truth 통일 (메인 4 항목 vs chapter 3 항목 불일치) — UX 협업.
7. Brand monogram color 토큰 (`--brand-levitaz` 등 4 색) — Marketing & Social 합의.
8. Hero lead copy 압축 — Marketing 결정.
9. Spring motion sweep — hero meta stagger / brand card lift.
10. Dark mode token 시스템 (Phase 3) — replay viewer 외 본문 dark variant.

---

## 5. 협업 인터페이스

### 5-1. DataViz Specialist (전문가 #2)

- **OKLCH 보간 (`statusAt` v2)** — §1-5 · §3-1. Visual 이 OKLCH 값·polyfill 결정 / DataViz 가 chart-theme.js 구현. 5 앵커 값 자체는 유지 (cultural prior).
- **지도 트랙 ramp vs 속도 분포 ramp 통일 검토** — DataViz §2-2. OSM 타일 가독성 vs 시스템 일관성 trade-off.
- **Hero Summary 의 트랙 path 색 / 그라데이션** — DataViz §2-1 P3. 시간 또는 속도 기반 dynamic.
- **VPS radial gauge 호 색·reference 마커 시각 위계** — DataViz §4-3.
- **Colorblind-safe alt palette 토글** — DataViz §3-4 / Visual §3-1. Okabe-Ito 변형. opt-in.

### 5-2. Frontend Engineer (전문가 #4)

- **`--color-*` canonical 화 + dashboard alias** — §4-2. Frontend 가 점진 마이그레이션.
- **`:focus-visible` mixin 표준화 + WCAG 2.2 #2.4.13** — §4-1. Frontend 가 한 위치에서 button/link/card/pill 적용.
- **인라인 스타일 → 컴포넌트 클래스 추출** — §4-4. Visual 이 클래스 이름 + DOM 구조 spec, Frontend 가 CSS 구현. Phase 2 Astro 마이그레이션 동시 권장.
- **`@layer` cascade 도입** — Frontend §3-4. Visual 은 layer 명명 (reset/tokens/base/layout/components/utilities/overrides) 합의.
- **아이콘 시스템 (Lucide static / `<svg><use>` sprite)** — §4-5. Frontend 결정 (CDN vs sprite).
- **Trust-bar source-of-truth 통일** — Phase 2 Astro layout 으로 자연 해결.

### 5-3. UX Researcher (전문가 #5)

- **Trust-bar 항목 불일치 (메인 4 vs chapter 3)** — UX §1-2 Nielsen #4 위반. Visual + UX 가 한 source-of-truth 합의.
- **Hero lead copy 압축** — UX §0 NN/g 권장. Visual (layout) + UX (information architecture) + Marketing (copy) 3 협업.
- **Focus indicator visual style** — UX §1-3 WCAG 준수. Visual 이 ring 스타일, UX 가 사용자 인지 검증.
- **속도 분포 파이 vs 가로 막대** — DataViz §2-8. Visual 이 시각 변형, UX 가 사용자 인지 비교.
- **Level / style 카드 시각 위계** — Visual + UX 가 카드 hover · focus state 의 사용자 인지 검증.

### 5-4. Marketing & Social

- **Hero lead copy 압축** — §5-3 의 3 협업.
- **Brand monogram color 토큰 (4 브랜드)** — §3-1 Tier 2. Marketing 이 brand identity 색 결정 (Levitaz · PPC · Takoon · WIP 의 official color 또는 우리 brand triplet 분할).
- **Photography style guide** — hero · brand · product 의 photographic style (lighting · color grading · subject framing) 일관. Marketing 이 결정.
- **Tagline / period rule** — [[feedback_korean_period_rule]] 의 본문 검증 · 확정. Marketing + Visual.

### 5-5. Sports Science (전문가 #3)

- **지표 시각 우선순위** — VPS · SOG · VMG · TWA · heel · HR 중 hero 4 KPI 선정. Sports Science 가 코칭 가치 우선순위, Visual 이 시각 위계.
- **5존 HR 색 ↔ Garmin/Whoop 산업 표준** — `HR_ZONE` 5 단 색 일치 확인. Sports Science 가 zone 정의 검증.

### 5-6. Mobile App Engineer (전문가 #8)

- **네이티브 ↔ 웹 디자인 토큰 패리티** — Phase 2 iOS/Android 앱이 같은 navy/sea/sun · 같은 type scale · 같은 motion 토큰. Mobile App 이 SwiftUI / Compose 의 token 변환.
- **iOS HIG 2025 Liquid Glass 의 채택 수준** — Visual 은 Phase 1 plan 만, Mobile 이 실제 SwiftUI / Compose 컴포넌트에 적용 수준 결정.

### 5-7. Hardware Engineer (전문가 #7)

- **SailTechMOTION 센서 본체 색 / 패키지** — Visual 의 brand triplet (navy/sea/sun) 을 hardware 본체 색에 일관. Hardware 가 PCB 인쇄 · 인클로저 색.
- **OTA 진행 UI / 디바이스 페어링 UI** — 모바일 앱 측 (전문가 #8) 의 시각, Visual 이 토큰 가이드.

---

## 6. 제약 준수 확인

| 제약 | 준수 |
|---|---|
| `chart-theme.js` 의 4 계열 색 토큰 (status / side / category / hrZone) 의미 절대 유지 | ✅ — §1-5 OKLCH 보간 권장은 5 앵커 값 자체는 유지하며 보간만 perceptually smooth. side(P/S) · category · hrZone 토큰은 변경 0건 권장 |
| 다크 강요 X (라이트 유지, 리플레이 뷰어만 예외) | ✅ — §2-3 replay viewer 의 `.replay` scope + `--rp-*` 다크 토큰 유지. 메인 / 대시보드 본체는 라이트 유지. dark mode token (Phase 3) 도 opt-in 권장 |
| [[feedback_korean_period_rule]] · [[reference_dmjgroup_site_rules]] 준수 | ✅ — §1-4 Korean policy v2 가 현재 정책 (`word-break: keep-all` + `text-wrap: balance/pretty` + `hanging-punctuation: allow-end`) 그대로 유지·강화. period rule 본문 확정은 Marketing 협업 |
| [[feedback_dashboard_viz_chart_over_table]] 준수 | ✅ — §1-3 의 "표 vs 차트 — 차트 우선" 원칙 채택. visual 권장도 같은 방향 |
| [[feedback_dashboard_metric_direction]] 준수 | ✅ — `goodness(value, direction, opts)` 5 방향 (higher/lower/heel/twaDown/neutral) 시각 인코딩 그대로. status 색이 항상 "좋은 방향" 반영 |
| Phase 1 production 코드 변경 X | ✅ — 본 문서가 reference + audit + plan. 코드 1 줄도 안 바꿈. Top 5 즉시 개선은 모두 spec 수준, 실제 변경은 Phase 2 |
| DO_NOT_REVERT lock 항목 | ✅ — §163 (level grid 4-col lock) · §171 (mobile menu) · §171-B (cart icon spec) · §171-C (SVG hit-test) · §141 / §145-G (nav dropdown) 모두 시각 권장에서 보존. 단 인라인 스타일 추출 시 §163 의 의도(4-col lock) 를 `.level-grid--4col` 같은 modifier 로 명시 권장 |

---

## 7. 부록 — 출처

**프로젝트 내부**

- `assets/css/style.css` — 메인 사이트 design tokens + 컴포넌트
- `riding-dashboard/css/dashboard.css` — 대시보드 토큰 + 컴포넌트
- `riding-dashboard/js/chart-theme.js` — 차트 색 4 계열 토큰 단일 소스
- `riding-dashboard/CHART-DESIGN-SYSTEM.md` — 차트 색 인코딩 규칙
- `_experts/expert_dataviz_reference.md` — 차트 viz audit (16 차트)
- `_experts/expert_frontend_engineer_reference.md` — 코드 구조 · 성능 · a11y · 모바일
- `_experts/expert_ux_researcher_reference.md` — UX heuristic audit · 정보 구조
- `_experts/expert_mobile_app_reference.md` — 네이티브 앱 ↔ 웹 패리티
- `_experts/expert_hardware_embedded_reference.md` — 센서 · 디바이스 색 · 패키지
- `index.html` · `levitaz.html` · `find-my-gear.html` · `cart.html` · `riding-dashboard/index.html`

**외부 reference**

- [1] [How Stripe, Linear, and Vercel Ship Premium UI — Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)
- [2] [Geist Material — Vercel](https://vercel.com/geist/material) · [Geist Design System — Vercel](https://www.figma.com/community/file/1330020847221146106/geist-design-system-vercel)
- [3] [Human Interface Guidelines — Apple Developer](https://developer.apple.com/design/human-interface-guidelines/) · [Designing for iOS — Apple](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios) · [iOS App Design Guidelines 2025 — Tapptitude](https://tapptitude.com/blog/i-os-app-design-guidelines-for-2025)
- [4] [Material 3 Expressive — Supercharge](https://supercharge.design/blog/material-3-expressive) · [Material 3 Expressive Wear OS — Android Developers Blog](https://android-developers.googleblog.com/2025/08/introducing-material-3-expressive-for-wear-os.html) · [Material 3 Expressive Deep Dive — Android Authority](https://www.androidauthority.com/google-material-3-expressive-features-changes-availability-supported-devices-3556392/)
- [5] [Vakaros Atlas 2 — Vakaros](https://www.vakaros.com/products/atlas2) · [Vantage Sailing — App Store](https://apps.apple.com/my/app/vantage-sailing/id6544807723) · [How Vakaros Redefined Sailing Instruments — Vakaros](https://www.vakaros.com/blogs/news/how-vakaros-redefined-sailing-instruments-with-the-atlas-series)
- [6] [Pretendard — GitHub orioncactus](https://github.com/orioncactus/pretendard/blob/main/packages/pretendard/docs/en/README.md) · [Pretendard — NamuWiki](https://en.namu.wiki/w/Pretendard) · [Pretendard — Adobe Fonts](https://fonts.adobe.com/fonts/pretendard) · [CJK Typesetting in 2025 — Asian Absolute](https://asianabsolute.co.uk/blog/cjk-typesetting-challenges-workflows-and-best-practices/)
- [7] [Korean Typography Policy v1.3 — internal style.css:147-205] (한국어 widow 방지 정책)
- [8] [OKLCH: The Modern CSS Color Space You Should Be Using in 2025 — Medium](https://medium.com/@alexdev82/oklch-the-modern-css-color-space-you-should-be-using-in-2025-52dd1a4aa9d0) · [OKLCH WCAG Discussion — w3c/wcag GitHub](https://github.com/w3c/wcag/discussions/4559) · [oklch() — CSS-Tricks](https://css-tricks.com/almanac/functions/o/oklch/) · [OKLCH Color Picker](https://oklch.org/)
- [9] [Linear](https://linear.app) · [Stripe Design](https://stripe.com/atlas) · [Surfline — What's New](https://www.surfline.com/lp/whatsnew/home)
- [10] [Design Tokens Guide — UXPin 2026](https://www.uxpin.com/studio/blog/what-are-design-tokens/) · [Design Tokens — USWDS](https://designsystem.digital.gov/design-tokens/) · [Fluent 2 Design Tokens](https://fluent2.microsoft.design/design-tokens)
- [11] [Strava Design — Dribbble](https://dribbble.com/Strava_Design) · [UX/UI Strava App — Medium](https://medium.com/@yamanmamgain/ux-ui-strava-app-9f65986b9b4e)
- [12] [WCAG 2.2 Success Criteria — W3C](https://www.w3.org/TR/WCAG22/) · WCAG 2.2 #2.4.13 Focus Appearance (AA-new)

---

_Last updated: 2026-05-28_
_Phase 1 학습 + audit 완료 — production 코드 변경 0건. Phase 2 dispatch 시 §4 Top 5 우선._
