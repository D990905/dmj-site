# expert_frontend_engineer_reference.md — 단무지공방 Frontend Engineer (Web) reference

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 학습 정리 + 현재 코드 audit + 아키텍처 v2 제안 + 성능 baseline + 모바일 hardening list + CI/CD plan |
| 작성 | Frontend Engineer (Web) — 알렉스 박 (Alex Park, #4) · v1.0 2026-05-27 · v1.1 2026-06-02 (revision: Orchestrator #11 align) |
| 대상 | `site/` 전체 (HTML 129개 · `assets/css/style.css` 8528 lines · `assets/css/agent-deny.css` 911 lines · `assets/js/*.js` 9건 · `riding-dashboard/js/*.js` 14건 + selftest 12개) |
| 범위 | Phase 1 — production 코드 무수정. audit + 권장 + 측정 plan + Phase 2 시작 청사진 |
| 근거 | 코드 직접 열람 (Read·Grep) + WebSearch (Core Web Vitals 2026 · WCAG 2.2 · iOS 26 · Astro 5 / Next 15 · Vite 8 · PWA iOS) + 다른 expert 문서 (`expert_dataviz_reference.md`·`expert_hardware_embedded_reference.md`) |
| Co-owners | Visual Designer (디자인 토큰·diff) · Data Visualization (chart-theme·viz lib) · UX Researcher (interaction·flow) · Sports Science (analysis.js 정합성) · Mobile App Engineer (Capacitor/native 공유 검토) · Backend (Phase 12 Supabase API 인터페이스) |
| 제약 | GitHub Pages 정적 호스팅 (D990905/dmj-site · `dmjgroup.kr` CNAME) · Phase 1 = audit/plan only · DO_NOT_REVERT §141 §145-G §148 §169-K §171 §171-B §171-C §172 §173 §174 §175 §177 §178 §179 §181 §182-A §182-B lock 항목 존중 |

> **읽는 법.** §0 은 한 페이지 TL;DR. §1 은 Phase 1 학습 정리(현재 web platform 의 결정 기준)로, 외부 문헌·standard·spec 인용을 모두 한 군데로 모았다. §2 는 현재 코드 audit — 카드별로 한 영역씩 평가한다. §3 은 아키텍처 v2 — vanilla 유지 vs Astro 5 vs Next 15 의 의사결정 framework. §4 는 성능 baseline 측정 plan + 목표 score. §5 는 iOS hit-test 류 잠재 모바일 버그 enumeration. §6 은 CI/CD plan — `PUSH-FIX.command` 의 GitHub Actions 영구 대체. §7 은 전문가 협업 인터페이스. §8 은 의사결정 가이드. Phase 1 production 코드 변경은 X — 본 문서는 청사진이다.

---

## 0. 핵심 결론 (TL;DR)

현재 사이트는 **vanilla HTML 4 자산(HTML·CSS·JS·이미지) + GitHub Pages 정적 호스팅** 의 단순 구조다. 빌드 단계가 없고, 의존성은 CDN 3개 (Pretendard·Google Fonts·Chart.js/Leaflet for dashboard) 뿐이다. 이 단순성은 **부가가치가 큰 자산**이다 — 새 페이지 1개 추가가 HTML 파일 하나 작성으로 끝나고, debugger 가 코드 그대로 본다(원본 = production). 동시에 한계도 있다 — `style.css` 가 8528 줄(279 KB) 단일 파일로 비대해졌고, 같은 nav HTML 이 128 개 HTML 에 사실상 복사돼 있으며, 라이딩 대시보드는 4920 줄 `app.js` 가 모든 UI state 를 한 IIFE 안에 보관한다.

오늘 만난 iOS Safari hit-test 버그(§171-C, SVG `pointer-events: none`) 는 **이미 코드 안에서 해결돼 있다** (`style.css:557-604`). 비슷한 결의 잠재 버그는 §5 에 enumerate 했다 — 핵심 후보는 (1) 카토 floating action button(`kakao-fab`) 의 SVG, (2) agent-deny widget 내부 chip·related 버튼, (3) riding-dashboard 의 트림 핸들·차트 cursor, (4) iOS 26 의 viewport unit / safe-area 회귀, (5) cart 카운터 badge 의 hidden+aria. 모두 동일 패턴 — 자식 SVG / `pointer-events` / `touch-action: manipulation` / `-webkit-tap-highlight-color` 3종 세트로 해결한다.

**Phase 1 학습 결론 — 의미 있는 framework 결정 3가지:**

1. **Astro 5 가 v2 의 강한 후보다.** Next 15 는 SSR/API 가 강점인데 우리는 SSR 도 API 도 (당분간) 필요 없다. Astro 는 default zero-JS · island 모델 · 빌드 산출이 정확히 HTML/CSS/JS — GitHub Pages 정적 호스팅 그대로 유지. 128 개 HTML 중 nav/footer/head 가 같으면 Astro layout 1개로 정리되어 maintenance burden 이 한 자릿수로 떨어진다. Vite 8(Rolldown) 이 빌드 엔진. Phase 2 의 적기. (§3·§3-2 참조)
2. **현재 vanilla 도 유지 가능 — "rewrite" 가 아니라 "migrate incremental"**. Astro 가 `.html` 을 그대로 import 할 수 있고, 정적 자산은 `public/` 으로 옮기면 그대로 서빙된다. 한 번에 모든 페이지를 바꾸지 않아도 된다. **레퍼런스 페이지 1-2 개부터 Astro 화 → 나머지는 단계적**. 이 점이 Next 15 (React 전체로 가야 함) 대비 결정적인 장점이다.
3. **PWA(install/offline/push) 는 iOS Safari 의 약점 때문에 ROI 가 낮다.** push 는 iOS 16.4+ home screen 설치 강제 + EU 미지원, 캐시 quota 50MB, 7일 미사용 시 storage 자동 삭제. 현재 `§172 Stale SW auto-cleanup` 로 SW 를 완전히 끄고 있는 정책이 옳다. PWA 는 Phase 3+ "wing rider 한국 시장이 캐시·offline 을 정말 필요로 한다고 데이터로 확인된 시점" 에서만 검토.

**Phase 1 권장 우선순위 5 (production 변경 X · plan only):**

1. **Push 자동화 — 2 layer 분리** (§6 v1.1 revision) — Orchestrator (#11) 의 `auto_push.command` + launchd daemon 이 **local→remote push** 의 영구 답 (PUSH-FIX.command 대체). 그 위에 본인 작성 `.github/workflows/deploy.yml` 은 **remote→live deploy** 의 자동화 (Phase 1 = branch publishing 자동 사용으로 deploy.yml 도 optional, Phase 2 Astro build step 도입 시 필수). **즉시 시행: Orchestrator §0 Step 1-2 (auto_push.command + launchd deploy-only)**.
2. **Performance baseline 측정** (§4) — 6 페이지(index·find-my-gear·levitaz·calculator·riding-dashboard·products/levitaz/fw-790) 에서 PageSpeed Insights · Lighthouse · WebPageTest mobile run 측정. LCP/INP/CLS 의 75 percentile 을 표로 고정. 측정 plan 만 — 실제 측정은 Phase 2 첫 시간.
3. **모바일 hardening pass** (§5) — §171-C 가 해결한 SVG hit-test 패턴을 동일하게 적용해야 할 후보 5건을 코드 위치까지 enumerate. 패치 자체는 Phase 2.
4. **CSS layer 도입 plan** (§3-4) — 8528 line `style.css` 의 점진적 분리. `@layer reset, tokens, base, layout, components, utilities, overrides` 7-layer 도입. Phase 2 에 PostCSS + cascade layers 도입하고 새 컴포넌트부터 layer 명시. 기존 selector 는 그대로 유지(회귀 X).
5. **Component fragment 추출 plan** — `nav` / `footer` / `<head>` 가 129 페이지에 중복. Phase 2 Astro 도입 시점이 자연스러운 정리 timing. 그 전까지는 build-step-less 한 단순 SSI 또는 HTML `<template>` + tiny include script 도 옵션. 단 **Phase 1 에서 절대로 시도 X** — 회귀 위험 너무 큼.

> **v1.1 revision note (2026-06-02)** — Orchestrator (#11) Phase 1 spec (`_experts/expert_orchestrator_daemon_reference.md`) align. 변경 3건: (a) §0·§6 의 CI/CD 우선순위 = orchestrator `auto_push.command` 가 PUSH-FIX 직접 대체, `.github/workflows/deploy.yml` 는 Phase 2 build step 동반 도입. (b) §3-1 의 dashboard Phase 1 = Supabase 도입 없음, GitHub Issues + Pages-served `.orchestrator/status/*.json` 만 (Supabase 는 Phase 2 sprint 2 마이그). (c) §6 신규 §6-6 = #4 ↔ #11 dashboard contract (Open Q 2 답 — Pages 노출 OK, cost 필드 공개 무해).

> **v1.2 revision (2026-06-02 후반)** — Phase 2 sprint 1 fix 2건 실행 (의장 GO 신호 12:XX). §182-A `.kakao-fab` SVG hit-test fix (style.css:1793 직후 6줄) + §182-B `nav__cart-badge` aria-live (10 HTML 페이지 sed). audit evidence = `_experts/frontend_mobile_hardening_audit_2026-06-02.md`. 회귀 영구 차단 — DO_NOT_REVERT §182-A·§182-B 신규 lock. **129 페이지 추정 → 실제 10 페이지** (cart badge HTML 은 nav header 전체 포함 페이지만 — policy / product 상세는 simplified nav).

---

## 1. Phase 1 학습 정리 — 결정 기준

### 1-1. Modern Frontend Architecture — Astro 5 · Next 15 · Vite 8 · 단일 페이지 앱 시대의 끝

2026년 web 의 큰 흐름은 **"React 전체 런타임을 모든 페이지에 보내는 비용을 더는 부담하지 않는다"** 다. Next 15 도 React 19 도 여전히 강력하지만, 우리처럼 **content-heavy & 거의 모든 페이지가 정적인** 사이트에서는 Next 의 디폴트가 부담이다 — 빈 페이지조차 React 런타임·reconciler·router·hydration bootstrap 을 보낸다. Astro 의 island 모델이 이 비용을 0으로 떨어뜨린다 — 정적 HTML 이 디폴트, 인터랙티브 부분만 `client:load` / `client:idle` / `client:visible` 지시자로 부분 hydration. 우리 사이트의 nav dropdown · cart badge · agent-deny widget 같은 작은 인터랙티브만 island 로 두고 product 카드·hero·footer 는 100% 정적이 된다.

Astro 5 의 빌드 엔진은 **Vite 6+** 로, dev 서버는 거의 즉시 뜨고, 1000 페이지 prod build 가 18초 대 (vs Next 15: 52초)[1]. 우리 128 페이지는 이 크기의 1/8 — 5초 이내 빌드 예상. Vite 8 부터 Rolldown(Rust) 이 esbuild + Rollup 을 모두 대체한다 — 우리는 곧장 Vite 8 위에서 Astro 5 를 쓸 수 있다.

**의사결정 framework — "vanilla 유지 vs framework 도입":**

| 결정 변수 | vanilla 유지가 옳음 | framework(특히 Astro) 도입이 옳음 |
|---|---|---|
| 현재 페이지 수 | 10 이하 | 50+ (우리: 128) |
| 같은 nav/footer 중복 정도 | 페이지마다 다름 | 거의 동일 (우리: 거의 동일) |
| 빌드 단계 의지 | 절대 안 함 | OK |
| Phase 2 의 추가 페이지 예상 | 0-10 | 30+ (우리: products SKU 확장) |
| 데이터 fetch 의지 | 정적 JSON 만 | API + 정적 mix |
| 변경 빈도 | 월 1-2회 | 주 단위 (우리) |

우리는 framework 가 옳은 쪽이다. 단, **Phase 1 에서는 절대로 시도하지 않는다** — Phase 1 = audit/plan only. Phase 2 의 첫 큰 결단 항목.

### 1-2. Performance — LCP / INP / CLS · Core Web Vitals 2026

Google Search 의 ranking signal 인 Core Web Vitals 의 2026 기준치는 다음과 같다 (75 percentile 기준)[2][3]:

| 지표 | 의미 | Good | Needs Improvement | Poor |
|---|---|---|---|---|
| LCP | Largest Contentful Paint (큰 이미지·텍스트 블록 표시까지) | ≤ 2.5 s | 2.6-4.0 s | > 4.0 s |
| INP | Interaction to Next Paint (모든 tap/click 의 응답성) | ≤ 200 ms | 201-500 ms | > 500 ms |
| CLS | Cumulative Layout Shift (레이아웃 흔들림 누적) | ≤ 0.1 | 0.1-0.25 | > 0.25 |

2024 년 3월부터 FID 가 INP 로 대체됐다 — INP 는 단순 input delay 가 아니라 "**모든** 사용자 인터랙션 전체 사이클" 의 시간을 측정한다. 2026 년 데이터에서 **사이트의 43% 가 INP 200ms 를 통과 못 한다** [4] — 가장 흔히 fail 하는 지표. 우리 dashboard 가 4920 line single IIFE 라서 INP 위험이 있다 — 큰 GPX 파싱이나 분석 중에 다른 인터랙션이 막힐 수 있다. (§4-3 측정 plan 참조)

**최고 영향 fix (출처[2][3]):**

- **LCP**: hero 이미지의 `<link rel="preload">` · critical CSS 인라인 · `display=swap` 폰트 · server-side render. 우리 index.html 의 hero 이미지는 이미 `loading="eager" decoding="async" fetchpriority="high"` 가 적용돼 있다 (line 244) — 좋은 출발점. 다만 critical CSS 추출이 안 됨 (8528-line 단일 file 전체 로드).
- **INP**: long task(50ms+) 분해 · `requestIdleCallback` / `scheduler.postTask` · 인터랙션 중 DOM 복잡성 최소화. 우리 nav dropdown 의 `installSingleDropdownGuard` (§145-G v9) 는 깔끔 — 작은 click handler 뿐. agent-deny 의 chip rendering 은 한번에 4-6 개 button 만 만들므로 OK. dashboard 의 chart 일괄 render 는 잠재 위험.
- **CLS**: 이미지 / video / iframe / ad 슬롯에 명시적 width / height 속성. 우리 hero 이미지는 attribute 없음 — `aspect-ratio` CSS 로 처리되고 있지만 명시 width/height 추가가 더 안전.

**Bundle splitting · lazy load.** vanilla 에서도 가능 — 우리는 이미 동적 import 로 matrix.js (find-my-gear quiz) 와 html2canvas / jsPDF (PDF export) 를 lazy load 하고 있다(§173 v9 · §177). 좋은 패턴 — 다른 large dependency 도 이 모델 따라가면 된다. Chart.js 와 Leaflet 은 riding-dashboard 에서만 필요하므로 이미 그 페이지 안에서만 로드 — 옳다.

**Image optimization · AVIF / WebP · `<picture>`.** AVIF 가 같은 시각 품질에서 WebP 보다 ~25% 작다. Safari 도 16+ 부터 지원. 우리 hero 는 `<picture>` 에 `webp` 와 `jpg` fallback (line 240-244) — 좋은 패턴 but `image/avif` 가 빠져 있다. AVIF 추가가 매우 저가 win.

**Font subsetting.** Pretendard Variable 은 한국어 + Latin 으로 풀 폰트가 800 KB+ 다. 우리는 jsdelivr 에서 CSS 만 가져오고 woff2 도 jsdelivr 의 것 쓴다 — 한국어 사이트는 좀 무겁다. subset 한 woff2 self-host 하면 LCP -0.3s 정도 가능. Inter / JetBrains Mono 는 우리 사이트에서는 사실상 헤딩·숫자 강조에만 쓰이므로 더 적극적인 subset 가능.

**Critical CSS.** 8528-line 의 어느 부분이 above-the-fold 에 필요한지 측정 후 인라인. PostCSS `postcss-critical-css` 또는 Penthouse(Headless Chrome) 로 추출 가능. Phase 2 에 layer 분리와 함께 진행.

**PageSpeed Insights 100점 가능성.** 정직히 답하면 — **모바일 100 점은 매우 어렵다.** Core Web Vitals 가 75 percentile 의 실제 user 데이터를 보므로, 모바일 3G/4G 한국 환경에서 LCP 2.5s 와 INP 200ms 를 모두 통과해야 한다. Pretendard variable font(필수) + hero 이미지 + Chart.js (dashboard) 의 합산으로 mobile LCP 가 1.5-2.0s 예상. 그래도 desktop 95+ · mobile 88-95 는 현실적 목표.

### 1-3. Accessibility — WCAG 2.2 AA · 새 6개 success criterion

WCAG 2.2 가 2023-10-05 W3C Recommendation 됐고 2026 EU EAA(European Accessibility Act) 도 발효된 시점이라, AA 가 사실상 보편 base 가 됐다[5][6]. WCAG 2.1 AA 위에 새로 추가된 AA-level 기준 6개가 우리에게 미치는 영향:

| 기준 | 의미 | 우리 현황 |
|---|---|---|
| **2.4.11 Focus Not Obscured (Min)** | 키보드 focus 받은 요소가 작가-콘텐츠로 완전히 가리면 X | nav dropdown · agent-deny 패널 · mobile menu 모두 focus 영역을 obscure 안 함 — 통과 |
| **2.4.13 Focus Appearance** | focus indicator: 2px-thick border 수준 + 3:1 contrast | 우리 button/link 는 browser 기본 focus 외 별도 focus ring 없음 → **여러 곳에서 fail 가능**. Phase 2 첫 a11y sprint 우선순위. |
| **2.5.7 Dragging Movements** | 모든 drag 기능을 single tap 으로도 가능해야 | dashboard 트림 슬라이더가 drag-only 가능성 — alternative input 필요. P0 audit. |
| **2.5.8 Target Size (Min)** | pointer target 최소 24×24 CSS px | 우리 nav__icon-btn 은 44×44 — 통과. 단 hero quick-tag (`hero__quick-tag`) · 모바일 menu 의 chevron 작은 화살표는 측정 필요. |
| **3.2.6 Consistent Help** | help 컴포넌트 위치가 일관 | 카토 fab + agent-deny widget 모두 우하단 고정 — 통과. |
| **3.3.7 Redundant Entry** | 동일 정보 재입력 회피 | login → cart 흐름에서 이메일 재입력 없음 — 통과. |

**ARIA 현황 점검.** index.html grep 결과 aria-/role=/alt= 패턴이 75건. role="menubar"/menu / aria-label / aria-haspopup / aria-expanded 가 nav 에 일관 적용돼 있다 — 좋은 출발점. agent-deny 의 chip · related button 은 button text 자체가 label 이라 OK. 다만 일부 SVG icon 만 있는 버튼(돋보기 search, kakao fab) 은 aria-label 명시 — 통과. 더 손볼 곳:

- `<a href="#brands"`·`#styles`·`#consultation` 의 dropdown 부모 링크는 click 시 dropdown toggle (§145-G v6) 도 트리거 — `aria-haspopup="true"` 와 `aria-expanded` JS 토글 OK. 단 화면 리더가 "메뉴 열림 / 닫힘" 외 dropdown 내부 menu item 으로의 focus 이동을 명시할 방법이 약하다 — `aria-controls` 와 `aria-activedescendant` 추가 검토.
- mobile-menu 의 `aria-hidden="true"` 토글은 작동. 단 menu 열렸을 때 backdrop 뒤 메인 페이지가 focus 받을 수 있다 (focus trap 부재). Phase 2.

**Keyboard navigation.** 모든 button/link 가 native 요소라 Tab/Enter/Space 기본 동작. dropdown ESC 닫힘이 모든 hub 에 있다 — 좋다(`installSingleDropdownGuard`). Skip link (`Skip to main content`) 가 없다 — 추가 권장. nav 가 큰 page 일수록 가치 큼.

**Color contrast.** 디자인 토큰 (`--color-navy` `#0A2540` 위 `--text-on-dark` `#FFFFFF` = 13.7:1) 은 WCAG AAA(7:1) 초과. `--text-secondary` `#5C6F7E` 위 `#FFFFFF` = 4.8:1 — AA(4.5:1) 통과 AAA fail (정상 텍스트 기준). 모든 본문에서 사용 OK. 다만 hero 의 `rgba(255,255,255,0.86)` 위 navy gradient — 동적 background image 위에서 실 contrast 측정 필요. Phase 2 첫 audit 항목.

**Screen reader.** VoiceOver(iOS) + NVDA(Windows) + TalkBack(Android) 세 가지 테스트가 표준. 한국어 화면 리더는 VoiceOver Korean (iOS) / NVDA Korean (Windows) 가 가장 보편. Phase 2 의 a11y sprint 에 1회 직접 테스트 권장.

### 1-4. Mobile / Touch — iOS Safari quirks · Android Chrome 차이 · PWA

오늘 만난 SVG inside `<a>` hit-test 버그(§171-C) 는 iOS Safari 의 오랜 quirk 중 하나다. 패턴은 다음과 같다 — 자식 SVG 의 path 가 hit-target 으로 잡혀 부모 `<a>` href 가 trigger 안 됨. fix 는 `pointer-events: none` 을 자식 svg 와 그 모든 자식에 적용 (style.css:597-604). 같은 패턴의 **iOS Safari 잘 알려진 quirks 6 가지** 와 우리 코드 적용 현황:

| Quirk | 우리 fix |
|---|---|
| 300ms tap delay (legacy) | `touch-action: manipulation` (style.css:550·569·582) ✅ |
| SVG inside `<a>` hit-test | `pointer-events: none` on svg + svg * (§171-C, style.css:597-604) ✅ |
| `-webkit-tap-highlight-color` 임의 회색 | 명시적 색 설정 (style.css:551·570·583) ✅ |
| 100vh 뷰포트가 주소 바 고려 안 함 | iOS 16+ `100dvh` 사용 가능 — 우리 mobile-menu fixed inset:0 사용 (style.css:608) ✅ but dynamic viewport unit 미사용 |
| Safe-area inset (notch / dynamic island) | viewport-fit=cover 와 env(safe-area-inset-*) 필요 — index.html 의 viewport meta 는 `viewport-fit=cover` 포함 ✅ but CSS 에서 env() 사용처 확인 필요 |
| Service Worker stale | §172 auto-cleanup (전 페이지 inline) ✅ |

**iOS 26 새 알려진 회귀(2026 시점):** safe-area / viewport 계산 버그 일부 — drawer 가 backdrop 을 safe area 아래까지 안 깔아서 gap 발생(MUI #46953)[7]. 우리 mobile-menu 도 동일 위험 — `background: rgba(10,37,64,0.96)` `inset: 0` 인데 `env(safe-area-inset-bottom)` 추가 검토. iOS 26 의 viewport 변경[8] 도 자체 테스트 필요. Phase 1 = audit·plan 단계라 실제 검증은 Phase 2 의 모바일 디바이스 테스트 round 1 회 (실 iPhone 13+ / iPhone 15 Pro+).

**Android Chrome 차이.** Chrome 의 hit-test 와 touch 처리는 W3C spec 에 더 충실 — 위 6개 quirk 대부분이 안 나타난다. 단 Chrome 의 lazy 이미지 loading 이 더 적극적이라 hero 가 `loading="eager"` 안 붙으면 LCP 더 늦을 수 있음. 우리 hero 는 명시 ✅.

**PWA (install / offline / push).** 우리 사이트의 PWA 가치는 다음 trade-off 의 함수다:

| PWA 가치 | iOS 14+ 한도(2026)[9][10] |
|---|---|
| install (홈 화면) | iOS 는 자동 prompt 없음. share 메뉴에서 수동 add. install rate 가 Android 의 1/10 |
| offline 캐시 | quota ~ 50 MB. 7일 미사용 시 자동 삭제 |
| push notification | iOS 16.4+ · home screen 설치 후에만. EU 미지원 (iOS 17.4+) |
| background sync | iOS 지원 X |
| native API (camera / sensor) | 제한적 (camera ✅ · IMU 부분 ✅ · BLE X) |

우리 §172 가 모든 SW 를 적극 unregister 하는 정책 — **현재 시점에서 옳다.** Phase 3+ "wing rider 한국 시장이 offline cache 를 정말 필요로 한다" 가 데이터로 증명되기 전까지는 PWA 안 한다. 핵심은: **단무지공방의 비교 우위는 "PWA 가 있는 사이트" 가 아니라 "정직한 데이터 + 옥덕필 박사 코칭"** — 기술 비교 우위가 아니다.

### 1-5. State Management — Zustand · Redux · Jotai · Pinia · 그리고 우리

복잡한 React/Vue 앱에서 component tree 깊은 곳까지 prop drilling 없이 상태를 전달하는 것이 state manager 의 본질. 단무지공방의 현재 상황:

- **메인 사이트(index/levitaz/...)** : 거의 state 없음. 페이지 자체가 SSR (정확히는 정적). nav dropdown · cart count · agent-deny chat history 가 전부 — 모두 localStorage 또는 작은 module state. State manager 불필요.
- **riding-dashboard** : 한 IIFE 안에 `state = { parsed, gpxText, session, analysis, sport, unit, selectedManeuvers, sessionName, ... }` 약 30개 prop 의 거대 mutable object (app.js:33-63). React/Vue 라면 명백히 store(Zustand/Pinia) 가 옳음. vanilla 라면 — **그래도 잘 작동**한다. mutation 위치가 한 IIFE 안이라 추적 가능, 모든 render 함수가 같은 closure 의 state 를 읽는다. 단점: undo/redo 가 어렵다, 테스트가 어렵다(state 의 일부만 setup 어려움), 변경 시점 reactive 갱신이 수동(`renderXxx()` 호출 직접).
- **find-my-gear quiz** : URL query 로 state 전달, 결과 페이지가 다시 lookup — 좋은 패턴(URL 이 상태).

**의사결정 framework:**

| 상황 | 권장 |
|---|---|
| 단일 페이지 정적 콘텐츠 | state manager 불필요 |
| 페이지 내 작은 인터랙션(dropdown, modal) | DOM 상태로 충분 |
| 한 페이지 안에서 5+ component 가 같은 데이터 공유 | local module + custom event 또는 small store |
| 다중 페이지 같은 user state(cart, auth, profile) | localStorage + 작은 facade (우리 DMJAuth 가 정확히 이것) |
| 대시보드처럼 derived data 많은 곳 | Zustand(React) / Pinia(Vue) — Astro island 한 그릇 안에서 |
| 시간 여행·undo·debug timeline | Redux Toolkit (대형 앱만) |

Phase 2 에 riding-dashboard 를 Astro island 로 옮긴다면 — Zustand 가 가장 자연. 60 line API, 1.5 KB minified+gzipped, atomic update, React subscribe 단순. 단 **현재 vanilla state 가 더 단순하다** — migration ROI 가 명확하지 않으면 vanilla 유지가 옳다.

### 1-6. Testing — Playwright · Vitest · Testing Library

현재 코드의 selftest 파일들 (`riding-dashboard/selftest-*.js` 12개) 은 **browser 안에서 console.log 로 결과 찍는 manual test** 다. self-test 패턴 자체는 좋다 — 코드 옆에 사양·검증이 같이 산다(§175 lift-calculator selftest 가 좋은 예). 단 자동화·CI 통합·회귀 알람이 없다.

**의사결정 framework — "어떤 테스트 도구가 어떤 케이스?":**

| 목적 | 도구 | 우리 적용 후보 |
|---|---|---|
| 순수 함수·계산 검증 | **Vitest** (Jest 호환·Vite native·esbuild) | lift-calculator 의 수식, analysis.js 의 VMG·tack-angle 계산, matrix.js 의 lookup |
| component · render 검증 (React/Vue) | **Testing Library** | Astro island 도입 후 |
| 다중 페이지 E2E (실 브라우저, click, network, screenshot) | **Playwright** | login → cart → quote, find-my-gear quiz, dashboard 의 GPX upload→render |
| 시각 회귀 (pixel diff) | **Playwright + visual snapshot** 또는 **Percy/Chromatic** | hero / KPI tile / brand card 의 시각 안정성 |
| a11y axe 자동 audit | `@axe-core/playwright` | 매 deploy 마다 핵심 6 페이지 a11y 차이 검출 |

**현실적 권장 Phase 2 시작점:**

1. **Vitest** 도입 — `riding-dashboard/js/analysis.js` 의 컴퓨테이션 함수들 (computeVMG · tackAngle · computeTargetPolar · computeSkillHr · …) 에 unit test. 입력 GPX·VKX fixture 두세 개로 expected output snapshot.
2. **Playwright** 1 smoke test — homepage 로딩 → nav dropdown 열림 → find-my-gear 로 이동 → 결과 출력. 회귀 알람의 첫 안전망.
3. **axe-playwright** — `@axe-core/playwright` 로 index/find-my-gear/levitaz/dashboard 4 페이지 a11y violation count 추적.

이 3가지는 모두 CI 에서 매 push 마다 자동 실행 (§6 plan).

### 1-7. Build & Deploy — Vite 8 · GitHub Actions Pages

**Build 도구.** 우리는 현재 빌드 단계가 없다 — `.html` `.css` `.js` 가 그대로 git push 되고 GitHub Pages 가 그대로 serve 한다. Phase 2 framework 도입 시 build 가 생긴다. 후보:

| 도구 | 강점 | 우리 적합도 |
|---|---|---|
| **Vite 8 (Rolldown)** | dev <1s · prod 빠름 · Astro/Svelte/Vue/React 모두 OK | ★ (최우선) |
| **Turbopack** | Rust, large monorepo 대응. Next.js 종속(현재) | × (Next 종속) |
| **esbuild** | 가장 빠름. Vite 내부 엔진 | △ (직접 쓸 일 적음) |
| **Webpack/Rspack** | 성숙·plugin 생태계 | × (오버킬) |

Phase 2 = Astro 5 + Vite 8 [11].

**Deploy — GitHub Pages 자동 배포.** 현재 `PUSH-FIX.command` 는 local shell 에서 git add + commit + push 를 iCloud lock retry 하는 스크립트. push 후의 GitHub Pages 배포는 GitHub 가 자동(기본 branch publishing). 그러나 build step 이 없으니 다음 한계:

- build 가 생기는 순간 (Phase 2) branch publishing 으로는 build 산출을 못 올림 → GitHub Actions 가 필요해진다.
- build 없이도 — 매 push 마다 자동 lint / 자동 axe a11y 체크 / 자동 lighthouse 측정 등 가치 있음.

**GitHub Actions Pages 표준 workflow (2026):**

`actions/checkout@v4` → 빌드(있으면) → `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4` [12]. Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency 그룹으로 동시 deploy 차단.

§6 에 우리 실제 workflow YAML draft.

**Custom domain · HTTPS.** `site/CNAME` 에 `dmjgroup.kr` — GitHub Pages 가 Let's Encrypt 인증서 자동. 변경 X.

**Cache strategy.** style.css 에 query string `?v=ios-link-svg-fix-20260526` 으로 cache bust. 이 패턴은 OK 하지만 — Phase 2 build step 도입 시 빌드가 자동으로 hash 붙은 filename (`style.abc123.css`) 생성하는 게 표준 (Vite 디폴트). 그게 더 안전하다 — 모든 asset 의 cache 가 max-age=1year 로 갈 수 있고, 새 deploy 시 새 파일이라 자동 갱신.

---

## 2. 현재 코드 audit

### 2-1. 아키텍처 — 강점·약점

**구조 fact 정리:**

| 항목 | 수치 |
|---|---|
| HTML 페이지 수 (`find . -name "*.html"`) | 129 (`_qa/_audit` 제외 시 123) |
| Top-level 페이지 (`site/*.html`) | 25 (index·levitaz·ppc·takoon·wip·find-my-gear·calculator·login·signup·cart·quote·consult·membership·profile·skill-assessment·glossary·premium·catalog·policies·password-reset·404·etc) |
| Brand-style cluster | `level/*.html` 5 · `style/*.html` 4 · `genre/*.html` 8 · `policy/*.html` 4 |
| product 상세 페이지 (`products/*/*.html`) | 68 (takoon ~50 · levitaz 8 · ppc 4 · wip 4 · fragments 4) |
| `style.css` line 수 / 바이트 | 8528 / 279 KB |
| `agent-deny.css` line 수 | 911 |
| 메인 사이트 JS line 수 합산 | ~ 7300 (main + auth-shim + cart + nav-auth + agent-deny + matrix + access-code + lift-calculator + supabase-auth) |
| riding-dashboard JS line 수 합산 | ~ 18000 (app + charts + analysis + coach + i18n + replay + pdf-export + anim + 기타) |
| selftest 파일 수 | 12 (riding-dashboard) |
| 외부 CDN 의존 | Pretendard (jsdelivr) · Google Fonts · Leaflet · Chart.js · html2canvas · jsPDF |

**강점:**

- **빌드 단계가 없다.** 페이지 추가가 텍스트 파일 1개. 배포가 git push 1개. debug 가 production 그대로. 이 단순성은 강력하다.
- **DO_NOT_REVERT 메모리 시스템.** 코드 내 inline 주석으로 결정 history 가 보존(§141 §145-G v6 §148 §169-K v3 §171-B §171-C §172 §173 §174 §175 §177 §178 …). 회귀 방지의 강력한 도구. 다른 expert doc 들이 외부 메모리 .md 에 의존하는 반면 우리 frontend 코드는 자기-문서화돼 있다.
- **Auth + cart + dashboard 모두 한 도메인 안에서 작동**. iframe·third-party SDK 의존 X. 결과적으로 CSP/CORS 같은 동적 문제가 없다.
- **iOS hit-test 패치가 모든 페이지에 동일하게 적용** — `style.css?v=ios-link-svg-fix-20260526` 한 query string 만 보면 어느 페이지가 patched/unpatched 인지 확인 가능 (현재 거의 모두 patched).
- **defer 일관 적용.** 모든 `<script>` 가 `defer` (index.html:983-990). render-blocking 없음.
- **lazy load 이미지.** brand-card visual · hero video thumb 이 `loading="lazy" decoding="async"`. hero 만 eager+fetchpriority high (line 244) — 정확한 priority 분리.

**약점:**

- **`style.css` 8528 line 단일 file**. 단일 file 의 의미는 (1) 다른 page 안 쓰는 selector 도 전량 로드 (2) git diff 가 거대 (3) 충돌 위험 (4) 새 developer onboarding cost. 단 critical CSS 추출 + cascade layer 분리로 점진 개선 가능.
- **nav HTML 128 페이지 중복.** 같은 menubar (10여줄)·mobile-menu (30여줄)·trust-bar (5줄)·footer (40여줄) 가 사실상 동일하게 128번 복사. 한 곳에서 nav 한 줄 추가 시 128 파일 grep+sed 필요. 변경 위험 매우 크다. (Phase 2 Astro layout 1개로 정리)
- **riding-dashboard `app.js` 4920 line single IIFE.** state·mutation·render 가 같은 closure. unit test 어렵고, partial state 재현 어렵고, MVC 분리 X. Phase 2 모듈화 후보.
- **inline `<script>` ServiceWorker cleanup 코드(§172) 가 128 페이지 head 에 중복.** 36 줄 × 128 = 4600 line 의 똑같은 코드. SW cleanup 자체는 옳지만 (현재 SW 안 쓰는데 stale 만 정리) — 한 곳에서 관리해야. Phase 2 layout 정리 시 자연 해결.
- **inline `style="..."` 와 inline event handler 사용**. `<img ... onerror="this.style.display='none'">` (line 534·551·568·578) 같은 패턴이 다수. CSP `script-src 'self'` 적용 시 모두 fail. 현재 CSP 가 명시되지 않아 작동 — Phase 2 CSP 설정 시 inline handler 모두 외부화 필요.
- **외부 이미지 직접 hot-link**. brand-card 의 일부가 `https://levitaz.com/...` `https://cdn.shopify.com/...` 직접 참조 (line 534·568·578). 이미지 사라지면 우리 페이지가 빈 공간. self-host 권장 (단 저작권/라이선스 협의 후).

### 2-2. 퍼포먼스 audit (정성적 — 측정은 §4)

LCP / INP / CLS 각 지표별 예측 (실제 측정 Phase 2):

**LCP — 예측 mobile 1.8-2.2s, desktop 1.0-1.4s.** Hero 이미지 (`sean-herbert-brazil-1.webp` · 약 100-200 KB 예상) 가 LCP 후보. preconnect 3개 + fetchpriority=high + eager loading 모두 OK. 단:
- Pretendard variable font 800KB+ 가 동시 fetch 됨 → 폰트 swap 후의 reflow 위험.
- `<picture>` 에 AVIF 없음 — 추가 시 LCP -0.2s 가능.
- `style.css?v=...` 279 KB single file → render-blocking. critical CSS 분리 시 -0.3s 가능.

**INP — 예측 메인 사이트 80-150ms, dashboard 300-500ms.** 메인 사이트의 nav dropdown · cart add 같은 인터랙션은 매우 가벼움 (< 5ms task). agent-deny 의 chip 클릭 → render 도 작음. 위험 영역:
- dashboard 의 GPX 파싱 (큰 파일 1 MB+ 파싱 중에는 페이지가 frozen)
- chart 일괄 render (`renderCharts()` 가 14+ 차트 한번에 그림)
- find-my-gear quiz 의 matrix lookup (matrix.js 1515 line · synchronous)

**CLS — 예측 0.02-0.08 (good).** Hero 이미지에 명시 width/height 없음 but aspect-ratio CSS 추정. brand-card 이미지에는 명시 없고 onerror display=none 패턴 — 이미지 실패 시 layout 흔들림 잠재. 측정 필요.

**Bundle size audit.** 메인 페이지 한번 로드 시 전송 데이터(estimate):

| Asset | 크기 (gzip 추정) |
|---|---|
| HTML (index.html 992 line) | 12-18 KB |
| style.css (279 KB raw) | ~ 40-50 KB gzip |
| Pretendard variable (jsdelivr) | ~ 250 KB initial subset |
| Google Fonts CSS + Inter/Noto | ~ 30 KB CSS + ~ 100 KB woff2 |
| Hero image | 100-300 KB |
| main.js / cart.js / auth-shim / nav-auth / supabase-auth / agent-deny | ~ 30 KB gzip 합산 |
| Lucide / SVG sprites (inline) | < 5 KB |
| **합산** | **~ 600-800 KB initial** |

이 수치는 한국 4G 환경 (~ 20 Mbps) 에서 LCP 약 1.5-2.0s 와 일치. 모바일에서 PageSpeed 80-90 점 예상.

### 2-3. 모바일 호환성 audit

§5 에 상세 enumerate. 요약:

| 영역 | 현황 | 위험 |
|---|---|---|
| `viewport-fit=cover` | ✅ index.html line 5 | safe-area-inset 사용처 미확인 — 일부 fixed bottom 요소(kakao-fab) 에서 home indicator 가림 가능 |
| `touch-action: manipulation` | ✅ nav 버튼 적용 | 다른 인터랙티브 요소 audit 필요 (perf-axes bar drag · trim handle · agent-deny chip) |
| SVG inside `<a>`/`<button>` hit-test | ✅ §171-C 광범위 적용 (.nav__icon-btn .nav__hamburger .nav__cart .mobile-menu *) | 본문 콘텐츠의 svg 안에 인터랙션 있는 경우 (kakao-fab) 별도 audit |
| ServiceWorker stale | ✅ §172 (전 페이지 inline) | 한 곳에서 관리 — Phase 2 |
| iOS 26 viewport unit / safe-area 회귀 | 미테스트 | iOS 16 / iOS 26 둘 다 테스트 필요. Phase 2 |
| `100vh` vs `100dvh` (dynamic viewport) | 미확인 | mobile-menu / hero 가 100vh 쓰면 iOS 주소바 영향 받음. 100dvh 권장 |
| body / html overflow during modal | 미확인 | mobile menu 열렸을 때 body lock 처리(`menu-open` class 추가) ✅ but background scroll 차단 검증 필요 |

### 2-4. 접근성 audit

대체로 양호. ARIA · role · alt 가 nav · button · 이미지에 일관 적용(index.html 75 occurrences). 다만 개선 영역:

- **focus ring 명시.** 우리 button/link 에 `:focus-visible` 별도 스타일 부재. WCAG 2.4.13 fail 위험. CSS variable `--focus-ring: 0 0 0 2px var(--color-sea), 0 0 0 4px rgba(31,143,255,0.3)` 토큰화 + 모든 인터랙티브 요소에 적용.
- **skip link.** `<a href="#main" class="visually-hidden focusable">메인 콘텐츠로 건너뛰기</a>` 추가 — 키보드 사용자가 매 페이지마다 nav 통과 안 해도 됨.
- **mobile menu focus trap.** 메뉴 열렸을 때 Tab 이 menu 밖으로 빠져나가 backdrop 뒤 요소로 가는지 검증. focus-trap 라이브러리 또는 수동 구현.
- **dragging movement alternative.** dashboard 의 트림 핸들 drag — keyboard ←/→ 또는 number input 으로도 변경 가능해야 WCAG 2.5.7.
- **target size.** hero quick-tag pills — 측정해서 24×24 이상인지 확인.

### 2-5. 유지보수성 audit

**좋은 패턴:**

- DO_NOT_REVERT 인라인 주석으로 결정 history 보존.
- `style.css` 가 BEM-ish 명명 (`brand-card__visual--levitaz`) 일관성.
- CSS 토큰 시스템 명확 (`--color-navy` `--space-4` `--radius-md` `--shadow-lg` …).
- `relPrefix()` 헬퍼 (nav-auth.js, agent-deny.js) 가 페이지 깊이별 상대 경로 자동 처리. 좋은 패턴.
- `defer` 일관 — JS load timing 신경 안 써도 됨.

**부채:**

- nav/footer/head HTML 128 페이지 중복. 한 변경에 128 grep+sed.
- `style.css` 단일 파일. layer 분리 X.
- `app.js` 4920 line single IIFE. 모듈 분리 X.
- inline `<script>` (§172 SW cleanup) 128 페이지 중복.
- 일부 inline `style=` `onerror=` — CSP 도입 차단 요인.
- 테스트 자동화 없음 — selftest 는 manual.
- CI 없음 — push 후 잘못된 link · 404 · syntax error 가 production 까지 갈 수 있음.

---

## 3. 아키텍처 v2 제안

### 3-1. 결정 — Astro 5 incremental migration

**Phase 2 시작점:** Astro 5 + Vite 8 (Rolldown) + GitHub Actions Pages deploy + Orchestrator (#11) `auto_push.command` push 자동화 layer. 기존 vanilla 와 공존 — 한 페이지씩 옮긴다.

**Dashboard 인프라 분리 (v1.1 revision):** Phase 2 sprint 1 의 dashboard MVP 는 **Supabase 없이** 구축. Orchestrator §6-2 contract 채택 — daemon 이 `site/.orchestrator/status/*.json` 에 write, GitHub Pages 가 자동 노출, dashboard 가 fetch (인증 X · CORS X · rate-limit X). Supabase 마이그는 Phase 2 sprint 2 — Orchestrator §5 의 `Queue` / `StatusSink` Protocol 한 줄 변경.

**왜 Astro?** §1-1 의 framework 비교 표 종합:

| 변수 | vanilla 유지 | **Astro 5** | Next 15 | Svelte/Sveltekit |
|---|---|---|---|---|
| GitHub Pages 정적 호스팅 OK | ✅ | ✅ | △ (export) | ✅ |
| nav/footer 중복 제거 (layout) | ❌ | ✅ | ✅ | ✅ |
| 기본 zero-JS · island | ❌ (모든 JS 항상 로드) | ✅ | ❌ (React runtime 항상) | △ (svelte runtime 작지만 항상) |
| 기존 `.html` `.css` 그대로 import | ✅ | ✅ | △ | △ |
| build 시간 (128 페이지) | 0 | ~ 4-5s 예상 | ~ 15-20s 예상 | ~ 6-8s 예상 |
| dashboard 같은 인터랙티브 island | N/A | ✅ (React/Vue/Svelte island 자유) | ✅ React only | ✅ Svelte only |
| 학습 곡선 (Danny + 단무지 팀) | 0 | 낮음 (HTML + frontmatter 정도) | 중-높음 (React + RSC) | 중간 |
| ecosystem 성숙도 (2026) | N/A | ★★★★☆ | ★★★★★ | ★★★★☆ |

**Astro 5 의 핵심 가치 — incremental migration 가능.** 한 번에 128 페이지 다 옮기지 않는다. Astro 가 `src/pages/*.astro` 와 `public/*` 정적 파일을 모두 빌드 산출에 포함하므로:

1. **Step 1**: 기존 `site/` 를 `public/` 에 그대로 복사 (배포 결과 동일).
2. **Step 2**: `src/layouts/Site.astro` 에 nav/footer/head 1번 작성.
3. **Step 3**: `index.html` 을 `src/pages/index.astro` 로 변환 (콘텐츠는 그대로, nav 만 layout 으로). 결과 HTML 은 byte 단위로 거의 동일.
4. **Step 4-7**: levitaz/ppc/takoon/wip/find-my-gear/level/style/genre 페이지 순차 migration.
5. **Step 8**: product 상세 70 페이지를 Astro **collection** + 1 template 로 압축 — `src/content/products/*.json` + `src/pages/products/[brand]/[slug].astro` 1 template.
6. **Step 9**: riding-dashboard 를 island 로 — `<RidingDashboard client:load />` 로 dynamic load.

**각 step 후 production 동일성 검증** — 빌드 산출 HTML 을 기존과 byte-diff 또는 시각 회귀(Playwright snapshot) 로 확인.

### 3-2. 대안 검토 — 왜 Next.js 가 아닌가

Next 15 의 장점은 SSR + API route + RSC. 우리에게 필요 없다 — 현재 user data 는 모두 localStorage(`DMJAuth` shim). Phase 12 에 Supabase 도입해도 그건 client-side fetch 로 충분 (Supabase JS SDK). API route 는 직접 endpoint 만들 일 거의 없다 — Supabase RPC 가 대신.

Next.js 의 부담은 React 런타임 + reconciler + router + hydration bootstrap 이 모든 페이지에 strictly required[1]. 우리 hero · brand-card · footer 같은 정적 컴포넌트도 React component 가 돼야 함 → 코드 변환 작업 막대 → 회귀 위험 큼.

Astro 의 island 모델이 우리에게 결정적인 이유는 **"기존 HTML 을 그대로 src/pages 에 두고 nav 만 변경"** 이 1-line 변환에 가깝다. Astro `.astro` 파일은 사실상 HTML + frontmatter (`---import Layout from '..'---`) 이라 우리 디자이너·junior dev 가 읽을 수 있다.

### 3-3. Svelte/Vue 는?

Svelte/SvelteKit 도 좋은 후보 — runtime 가 작고, 학습이 빠름. 단 우리 dashboard 의 Chart.js · Leaflet 통합이 React 보다 Svelte 가 더 자연스럽다는 보장은 없고, ecosystem(특히 한국어 자료) 가 더 얇다. Astro 안의 island 로 Svelte 도 쓸 수 있으므로 — **Astro 5 + Svelte island 옵션** 도 유효.

### 3-4. CSS 아키텍처 — cascade layers + token tier

8528 line `style.css` 를 한번에 분리하지 않는다. cascade layers 로 점진적 introduction:

```css
@layer reset, tokens, base, layout, components, utilities, overrides;

@layer reset { /* normalize, * box-sizing, html base */ }
@layer tokens { /* :root --color-*, --space-*, --fs-*, --shadow-*, etc */ }
@layer base { /* element defaults: body, h1-h6, p, a, button */ }
@layer layout { /* .container, .section, .grid, .hero */ }
@layer components { /* .nav, .brand-card, .perf-axes, .agent-deny-msg, ... */ }
@layer utilities { /* .t-eyebrow, .visually-hidden, helpers */ }
@layer overrides { /* DO_NOT_REVERT 한 곳 — § 패치 모음 */ }
```

새로 추가되는 컴포넌트만 layer 명시하면 기존은 unlayered 로 항상 가장 낮은 우선순위 — **안전한 incremental introduction**. 단계적으로 기존 selector 를 layer 안으로 이동.

3-tier token system 채택 (CSS Snapshot 2026[13]):

| Tier | 예 | 목적 |
|---|---|---|
| **Primitive** | `--blue-500: #1F8FFF` `--gray-800: #2A3B4C` | 색상 raw 값 (재명명 안 함) |
| **Semantic** | `--color-link: var(--blue-500)` `--text-secondary: var(--gray-500)` | 의미 |
| **Component** | `--btn-primary-bg: var(--color-sun)` `--card-shadow: var(--shadow-md)` | 컴포넌트별 적용 |

현재 우리 `:root` 는 primitive + semantic 혼재(`--color-navy: #0A2540` 가 primitive, `--text-primary: var(--color-navy)` 가 semantic). 정리 가치 있음 — Phase 2.

### 3-5. JS 아키텍처 — module + 동적 import

- 메인 사이트의 main.js / cart.js / auth-shim.js / nav-auth.js / supabase-auth.js / agent-deny.js 를 ES Module 로 전환. 현재 IIFE — 함수 export 없이 전역에 자기 자신을 노출 (`window.DMJAuth`). Astro 에서는 `<script>` 안에 module 작성 가능 — 자연스러운 진화.
- 동적 import (`import()`) 로 lazy load — 이미 matrix.js 와 html2canvas + jsPDF 가 잘 적용 (§173 v9 · §177). 다른 large dependency 도 이 패턴.
- riding-dashboard 의 `app.js` 를 **5-6 module 로 분리**: state.js (store), io.js (GPX/VKX 파싱), analysis 그대로, render.js (UI render 모듈), events.js (event handler), index.js (오케스트레이션). 각 모듈은 export 명확. unit test 가 가능해진다.

---

## 4. Performance baseline — 측정 plan + 목표

### 4-1. 측정 도구 stack

| 도구 | 측정 |
|---|---|
| **PageSpeed Insights** (https://pagespeed.web.dev) | Core Web Vitals (실 user CrUX + Lighthouse lab) — desktop + mobile |
| **WebPageTest** (https://www.webpagetest.org) | 다중 지역(서울·도쿄·로스앤젤레스) · 다중 device · waterfall · filmstrip |
| **Chrome DevTools Performance panel** | local INP / long task / main thread blocking |
| **Lighthouse CI** (`@lhci/cli` in GitHub Actions) | 매 PR 마다 자동 lighthouse run · threshold fail 시 PR block |

### 4-2. 측정 페이지 6개 (대표)

| 페이지 | 의미 |
|---|---|
| `/` (index.html) | landing — 가장 많은 user · hero 가 LCP |
| `/find-my-gear.html` | 인터랙티브 quiz — INP 위험 |
| `/levitaz.html` | brand hub — 이미지 다수 |
| `/calculator.html` | lift calculator — JS heavy |
| `/products/levitaz/fw-790.html` | product 상세 — 70 페이지 중 대표 |
| `/riding-dashboard/index.html` | dashboard — Chart.js+Leaflet+큰 JS · INP 매우 위험 |

각 페이지에 대해 mobile (Slow 4G) + desktop (Cable) 두 환경 측정. Phase 2 시작 시 1회 측정 → table 로 baseline 고정.

### 4-3. 목표 score (Phase 2 종료 기준)

| 페이지 | Mobile LCP | Mobile INP | Mobile CLS | PageSpeed mobile |
|---|---|---|---|---|
| `/` | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≥ 92 |
| `/find-my-gear.html` | ≤ 2.5 s | ≤ 250 ms | ≤ 0.05 | ≥ 88 |
| `/levitaz.html` | ≤ 2.5 s | ≤ 200 ms | ≤ 0.05 | ≥ 90 |
| `/products/*` | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≥ 92 |
| `/riding-dashboard/*` | ≤ 3.5 s | ≤ 400 ms | ≤ 0.10 | ≥ 75 (heavy app — 100점 불가능, INP 가 핵심) |

PageSpeed Insights **100점은 목표 아님**. 100점은 정직히 답하면 한국어 폰트(Pretendard variable 800KB+) + Chart.js + Leaflet 의 합산 때문에 mobile 환경에서 사실상 불가능에 가깝다. 실 user 의 75 percentile 이 "Good" Core Web Vitals 통과 = ranking 영향 사실상 동일. 88-95 점이 정직한 목표.

### 4-4. 빠른 win 5건 (Phase 2 첫 sprint)

1. **AVIF 추가** — `<picture>` 의 첫 source 로 `image/avif` 추가. Brand-card / hero / product-card 모두. LCP -0.1~-0.2s 예상.
2. **Pretendard self-host + subset** — jsdelivr 외부 의존 제거. 한국어 (KS X 1001 + 보강) + Latin basic 만 subset 한 woff2 self-host. LCP -0.2~-0.3s.
3. **Critical CSS 인라인** — index/levitaz/find-my-gear 의 above-the-fold 만 추출해 `<style>` 인라인. 나머지 `style.css` 는 `media="print"` + `onload` 로 비차단 로드. LCP -0.3s.
4. **이미지 명시 width/height** — hero / brand-card 이미지의 intrinsic 비율. CLS -0.05.
5. **Font swap** — `@font-face { font-display: swap }` 명시. 폰트 로딩 중 FOUT 허용. LCP 측정 -0.2s (FOIT 회피).

---

## 5. 모바일 hardening list — iOS hit-test 류 잠재 버그 enumeration

§171-C SVG `pointer-events: none` 패턴이 nav header + mobile menu 에 적용. 동일 패턴이 필요할 수 있는 candidate 5건 (audit + fix Phase 2):

### 5-1. Kakao floating action button (`a.kakao-fab`)

**위치:** `index.html:979`, 전 페이지 동일 (footer 직전).

**구조:**
```html
<a href="#contact" class="kakao-fab" aria-label="카톡 상담">
  <svg viewBox="0 0 24 24" ...><path .../></svg>
</a>
```

**위험:** §171-C 의 CSS rule (`.site-header a > svg, .site-header a svg *` 등) 이 적용되지 않는다 — kakao-fab 은 `.site-header` 안이 아님. SVG 가 hit-target 으로 잡혀 `href="#contact"` 가 fail 할 수 있다.

**Fix 권장:** `style.css` 의 §171-C 블록에 `.kakao-fab > svg, .kakao-fab svg * { pointer-events: none; }` 추가. 또는 더 일반 — `a.kakao-fab` 같은 fixed FAB 패턴 모두 cover 하는 utility class `.svg-link svg, .svg-link svg * { pointer-events: none; }` 도입.

**검증:** iPhone 13+ 에서 `_ios-test.html` 와 동일한 패턴(터치 로그) 으로 FAB 직접 테스트.

### 5-2. agent-deny widget — chip · related button · slot chip

**위치:** `assets/js/agent-deny.js:486-595` 의 `renderMsg` 가 만드는 `.agent-deny-msg__related-btn` `.agent-deny-msg__slot-btn` 의 자식 SVG (현재는 svg 자식 없음 — 그러나 향후 Phase 2 에서 chip 안에 icon 추가 시).

**위험:** 현재 chip 은 text-only — 위험 없음. 단 **Phase 2 에 chip 안에 brand logo 또는 ↗ arrow 추가 시** 동일 hit-test 버그 발현 가능.

**Fix 권장:** `assets/css/agent-deny.css` 에 preemptive rule — `.agent-deny-msg__related-btn svg, .agent-deny-msg__slot-btn svg, .agent-deny-msg__related-btn svg *, .agent-deny-msg__slot-btn svg * { pointer-events: none; }` 추가. 사실상 모든 button/anchor 의 svg 자식에 적용해도 무해 — global rule 도입 고려.

**더 일반적 권장 — global hit-test 보호:**
```css
/* Phase 2 — global SVG hit-test fix (iOS Safari) */
a > svg, a svg *,
button > svg, button svg * {
  pointer-events: none;
}
```
**단, 본문 콘텐츠에 인터랙티브 SVG (차트의 hover region 등) 가 있는 경우 차트별 escape 필요.** dashboard 의 charts/polar/violin 은 canvas 라 svg 아님 — 안전. perf-axes radar chart 는 svg 인데 (`main.js:renderPerfPentagon`) 인터랙션이 없음 (보기만) — 안전.

### 5-3. riding-dashboard 트림 핸들 · 트랙 cursor

**위치:** `riding-dashboard/js/app.js` 의 트림 슬라이더 · `renderMap` 의 GPS cursor · `setChartCursorByTime` 의 차트 cursor.

**위험:** drag (mouse down + move) 가 핵심 interaction. iOS Safari 의 touch event 에서 `touchstart` `touchmove` `touchend` 가 일반 mouse 와 다르다. `passive: true` listener 가 preventDefault 호출 못 한다. drag 중에 scroll 도 발생하면 의도 충돌.

**Fix audit 권장:** Phase 2 에 실 iPhone 13+ 에서 다음 사례 직접 검증:
1. 트림 슬라이더 좌측 손잡이 drag — 부드러운지, jitter 없는지.
2. 트림 슬라이더 중간 drag → page scroll 동시 발생 여부.
3. 차트 hover cursor 가 모바일에서 정상 작동하는지 (모바일은 hover 가 없음 — 한 번 tap 으로 cursor 이동, 다시 tap 으로 해제 가능한지).
4. zoom pinch (지도) 중 chart cursor 안 깨지는지.

**Fix 패턴 (예상):**
- 모든 drag target 에 `touch-action: none` (이미 `.gear-dash-bar-row--editable` 에 적용 line 5631).
- `addEventListener('touchstart', fn, { passive: false })` — `preventDefault()` 호출 가능하게.
- Pointer Events API (`onpointerdown` `onpointermove` `onpointerup`) 로 통일 — mouse + touch + pen 한 코드.

### 5-4. iOS 26 viewport / safe-area 회귀

**위험:** iOS 26 의 viewport 계산 변경[8] 으로 인해:
1. `100vh` 가 dynamic viewport (주소바 보임 / 안 보임) 차이 반영.
2. `position: fixed; inset: 0` 의 backdrop 이 safe-area-inset-bottom 아래까지 못 깔리는 회귀(MUI #46953).
3. notch / dynamic island 영역에 콘텐츠 가려짐.

**Fix audit 권장:**
- `mobile-menu` 의 `position: fixed; inset: 0` (style.css:608) → `background: rgba(10,37,64,0.96); padding-bottom: env(safe-area-inset-bottom, 0);` 추가. backdrop gap 방지.
- hero `min-height: 100vh` 가 있다면 `min-height: 100dvh` 로 교체 (dynamic viewport). 단 desktop 변화 없음 (dvh = vh on desktop). 다만 `100dvh` 의 browser support 가 iOS 15.4+ — fallback 필요 — `min-height: 100vh; min-height: 100dvh;` 패턴.
- Test on iPhone 13/14 Pro (notch) + iPhone 15 Pro (dynamic island) + iPhone SE 3 (no notch). Phase 2.

### 5-5. cart badge · nav-auth dropdown

**위치:** `index.html:166` cart badge, `assets/js/nav-auth.js` 의 dropdown.

**위험 1 — cart badge `hidden` attribute:** `<span class="nav__cart-badge" data-cart-badge hidden>0</span>` 의 `hidden` attribute 가 모든 브라우저에서 일관. cart 추가 시 JS 가 `hidden` 제거. 단 a11y 측면: `aria-live="polite"` 가 없어 screen reader 가 추가 알림 못 받음. Phase 2 권장 추가.

**위험 2 — nav-auth dropdown click handler 이중 등록 (§145-G v9 lock):** 이미 잘 해결돼 있다. 단 회귀 방지 — Phase 2 layout 정리 시 절대로 `installSingleDropdownGuard` 의 single sole handler 원칙 깨지 않기.

**위험 3 — mobile menu chevron `→ ↗` SVG hit-test:** §171-C 의 `.mobile-menu a > svg, .mobile-menu a svg *` rule 이 다 cover. 검증 완료.

### 5-6. 추가 점검 권장 — 다음 sprint 의 1회 audit pass

| Audit 항목 | 위치 | 방법 |
|---|---|---|
| 모든 SVG-inside-clickable 위치 | `grep -E '<(a\|button)[^>]*>[^<]*<svg' site/**/*.html` | 결과를 §171-C CSS rule cover 여부 매핑 |
| `100vh` 사용처 | `grep '100vh' assets/css/*.css` | 100dvh 로 일괄 교체 검토 |
| `position: fixed` + bottom 정렬 요소 | `grep 'position: fixed' style.css` 와 manual | safe-area-inset-bottom 보강 |
| `passive: true` 가 prevent 필요한 곳에 잘못 적용 | `grep "{ passive: true }" assets/js/*.js riding-dashboard/js/*.js` | scroll-block 의도가 있는 곳만 false 로 |
| `pointer-events: none` 가 의도와 다르게 클릭 막는 곳 | grep 후 시각 회귀 | 위 §171-C 패턴 외 추가 case |

이 audit 1회 (1-2 시간) 면 모든 잠재 모바일 버그가 한 list 에 정리된다. Phase 2 첫 sprint.

---

## 6. CI/CD plan — 2-layer 자동화 (PUSH-FIX.command 영구 대체) · v1.1 revision

> **v1.1 (2026-06-02):** Orchestrator (#11) Phase 1 spec (`_experts/expert_orchestrator_daemon_reference.md`) align. 본 §6 의 핵심 수정 — local→remote push 자동화의 owner 는 Orchestrator daemon (`auto_push.command` + launchd). `.github/workflows/deploy.yml` 는 remote→live deploy 의 companion layer 로 재배치. PUSH-FIX.command 직접 대체자 = Orchestrator, GitHub Actions = Phase 2 Astro build step 진입 시 필수.

### 6-1. 현재 상태

> **v1.1 정정 (2026-06-02)** — `.github/workflows/static.yml` 가 **이미 존재**한다 (`actions/upload-pages-artifact@v3` + `actions/deploy-pages@v5`, `path: '.'`). 즉 push → GitHub Pages 자동 deploy 는 **이미 작동 중**. PUSH-FIX.command 의 한계는 deploy 자동화 부재가 아니라 **local→remote push 자체의 iCloud lock 회피·retry**. 본 §6 v1.0 (`deploy.yml` 신규 추가 권장) 은 잘못된 분석 — 정정. Phase 2 build step 도입 시점에 `static.yml` 의 `path: '.'` 를 `path: ./dist` 로 1줄 수정 + `npm run build` step 추가만 필요.

`PUSH-FIX.command` (site/PUSH-FIX.command) 는 다음을 수행:
1. `cd $(dirname "$0")` — site/ 로 이동.
2. `.git/index.lock` 강제 제거 (iCloud sync lock 회피).
3. `git add -A` (8회 retry).
4. `git commit -m "..."` (현재 hardcoded message — 매번 수정 필요).
5. `git push origin main` (8회 retry).
6. 결과 출력 후 키 입력 대기.

**문제:**
- Local 환경 종속 (Mac · iCloud · zsh).
- commit message hardcoded — 수정하지 않으면 모든 commit 이 같은 message.
- 자동 lint/test/check 없음 — broken HTML 가 production 까지.
- iOS 사용 중 push 불가 (Danny 가 모바일에서 작업 중일 때 빈번 — "오늘").
- Phase 2 build step 도입 시 빌드 명령 분기 추가 필요 → script 비대화.

### 6-2. v2 plan — `.github/workflows/deploy.yml`

**1. 기본 deploy workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:  # 수동 trigger 가능

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # Phase 1 (vanilla, no build) — skip build
      # Phase 2 (Astro) — add:
      # - uses: actions/setup-node@v4
      #   with: { node-version: '20' }
      # - run: npm ci
      # - run: npm run build
      # - uses: actions/upload-pages-artifact@v3
      #   with: { path: ./dist }

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact (Phase 1 — site/ raw)
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./site  # Phase 1: 직접 site/ 폴더. Phase 2: ./dist

      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

**2. PR checks workflow (자동 lint/a11y/lighthouse):**

```yaml
# .github/workflows/pr-check.yml
name: PR checks

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: HTML validity check
        uses: Cyb3r-Jak3/html5validator-action@v7
        with: { root: site/ }
      - name: Link check (broken internal links)
        uses: untitaker/hyperlink@0.1.32
        with: { args: site/ }
      # Phase 2 추가
      # - name: Lighthouse CI
      #   uses: treosh/lighthouse-ci-action@v11
      #   with:
      #     urls: |
      #       https://staging.dmjgroup.kr/
      #       https://staging.dmjgroup.kr/find-my-gear.html
      # - name: axe a11y
      #   run: npx playwright test a11y.spec.ts
```

**3. preview deploy workflow (PR-별 미리보기 — optional Phase 2+):**

GitHub Pages 는 native preview 가 약함 — Cloudflare Pages 또는 Netlify free tier 로 PR preview 별도 환경 만드는 패턴이 표준. Phase 2 검토.

### 6-3. local 작업 흐름 (자동화 후)

**v2 (Phase 1 시작 직후):**
```bash
# Danny 의 local Mac 또는 iPhone(Working Copy app) 에서
git add -A && git commit -m "..." && git push origin main
# 그 다음은 0 클릭 — GitHub Actions 자동 빌드·배포
```

**iCloud lock 문제는?** GitHub Actions 가 cloud 에서 돈다 — iCloud 와 무관. local 에서 push 직전 lock 만 한 번 제거 (또는 `git config core.fileMode false`) 하면 끝.

**Working Copy (iOS) 또는 GitHub iOS app 사용:** 모바일에서도 push 가능. 본 turn 의 user prompt 가 정확히 이 use case — 모바일 Danny.

### 6-4. PUSH-FIX.command 의 운명

**유지 (당분간):** GitHub Actions deploy.yml 이 작동 확인되기 전까지는 safety net.

**폐기 (deploy.yml 가 stable 한 후):** Phase 2 종료 시점. `PUSH-FIX.command` `PUSH-hardware-spec.command` 모두 `_archive/` 로 이동. README 에 "use git push" 표기.

### 6-5. 단계별 도입 (즉시 시행 가능)

이 workflow 자체는 **Phase 1 production 코드 변경에 해당하지 않는다** — `.github/workflows/` 은 새 파일 추가일 뿐, site 의 HTML/CSS/JS 어떤 것도 변경 X. 따라서 Phase 1 제약(production 변경 X) 위배 아님. 즉시 시행 권장.

**v1.1 순서 수정** — Orchestrator §0 step 1-2 가 먼저, GitHub Actions 는 그 다음:

**Step 1 — Orchestrator `auto_push.command` 받기:**
- Orchestrator (#11) 의 Phase 1 산출 — `site/orchestrator/auto_push.command` 또는 `~/dev/orchestrator/auto_push.command` 위치.
- 더블클릭 1회로 PUSH-FIX 직접 대체. iCloud lock 회피·exponential backoff·pull-rebase 자동 fallback.

**Step 2 — launchd deploy-only daemon (선택, 15분):**
- Orchestrator §0 step 2 — Anthropic API key 불필요, $0. 30초 polling 으로 push 자동.
- 더블클릭조차 X — git commit 만 하면 그 후 자동.

**Step 3 — GitHub Actions deploy.yml (Phase 2 build step 진입 시):**
- Phase 1 (vanilla, 빌드 X): branch publishing 자동 사용 가능, deploy.yml 불필요.
- Phase 2 (Astro build): deploy.yml 필수. `npm run build` → `./dist` → `actions/deploy-pages@v4`.
- Step:
  1. https://github.com/D990905/dmj-site → Settings → Pages → Source = "GitHub Actions".
  2. `mkdir -p .github/workflows && touch .github/workflows/deploy.yml` (위 §6-2 YAML).
  3. `auto_push.command` 더블클릭 또는 daemon 자동 push.
  4. GitHub Actions tab 에서 첫 deploy 확인.

**Step 4 — pr-check.yml + Lighthouse CI** (Phase 2 sprint 2):
- `.github/workflows/pr-check.yml` (HTML validity + broken link).
- PR-별 자동 검증 → 회귀 알람.

**Step 5 — PUSH-FIX.command 유지·점진 폐기:**
- Phase 1 = Orchestrator `auto_push.command` 도입 후 즉시 safety net 으로 유지.
- Phase 2 종료 = `_archive/` 로 이동.

### 6-6. Dashboard MVP — #4 ↔ #11 contract (v1.1 신규)

**합의 완료 항목** (Orchestrator §6-2 의 Open Q 2 답):

| 항목 | 결정 |
|---|---|
| Dashboard 위치 | Phase 1 = `site/ops/index.html` (mainsite 안), Phase 3 = `ops.dmjgroup.kr` 서브도메인 별도 repo |
| Directive 큐 | GitHub Issues + label `directive` (영구) |
| Status 출력 | `site/.orchestrator/status/{directive_id}.json` (daemon write) + Issue comment |
| Dashboard 읽기 | client-side `fetch('/.orchestrator/status/...')` — 인증 X, CORS X, rate-limit X |
| 보안 | cost 필드 공개 무해 (월 cap $50 = 미미). prompt 본문은 Issue 안에만, status JSON 은 metadata 만 |
| robots.txt | `Disallow: /.orchestrator/` (검색엔진 색인 차단, 사람은 URL 직접 접근 OK) |

**Dashboard MVP first view** (Phase 2 sprint 1 deliverable):

1. Pending decisions (Danny 결정 대기) — David Ok 부재 mitigation.
2. Active directives (orchestrator daemon 진행 중) — cost · turns · ETA.
3. Production health (dmjgroup.kr LCP · INP · CLS · uptime · CI status).
4. 8 experts current focus — `_team/profiles/*.html` + 최근 commit / dispatch.
5. This week's #decisions — `_team/dispatches/*.md` + GitHub Discussions.

**구현 stack** (Phase 1 = Phase 2 sprint 1 MVP):
- Astro 5 page 1개 (`src/pages/ops.astro`) + 4 client island.
- GitHub Issues REST API client-side fetch (unauthenticated, 60/hr rate-limit OK).
- `.orchestrator/status/*.json` fetch (인증 X · rate-limit X).
- Supabase 미도입.

**Phase 2 sprint 2 추가** (Supabase 마이그):
- Orchestrator daemon dual-write → `SupabaseRowSink`.
- Astro island 가 Supabase Realtime client 추가 → push update.
- dashboard 의 GitHub Issues fetch 는 그대로 유지 (영구 hybrid #10 model B = "role-split").

---

## 7. 협업 인터페이스 — 다른 expert 와의 경계

### 7-1. Visual Designer (전문가 #1)

**무엇을 받는다:**
- 디자인 토큰 spec (`--color-*` `--space-*` `--shadow-*` `--radius-*`).
- 컴포넌트별 visual spec (Figma 또는 HTML mockup).
- 일관성 변경 시 diff.

**무엇을 제공한다:**
- 실제 토큰 값과 spec 의 차이 audit.
- 새 토큰 추가 시 cascade layers 안 정확한 위치.
- responsive breakpoint 결정 (현재: 768·1024·1280 기준).
- focus ring · 모바일 target size 등 a11y 요구를 디자인 시스템에 반영.

### 7-2. Data Visualization (전문가 #2)

**경계:** dashboard chart 의 **외부 layout** (카드·grid·spacing) 은 frontend 책임. **차트 내부 viz** (axis·color encoding·decoration) 는 dataviz 책임. 토큰(chart-theme.js) 은 dataviz 가 sole owner, frontend 는 consumer 역할.

**Phase 2 협업 항목:**
- replay strip (small multiples) 의 외부 UI · 인터랙션 (재생/일시정지/scrub) — frontend.
- 5종 small multiples 의 chart 자체 — dataviz.
- target polar overlay 의 storage 데이터 공급선 — frontend 가 IndexedDB / localStorage 인프라, dataviz 가 시각화.

### 7-3. UX Researcher (전문가 #3)

**경계:** flow 결정·copy·micro-interaction timing — UX. **구현** — frontend.

**Phase 2:** find-my-gear quiz 흐름 redesign, agent-deny intent classifier 흐름 정련 — UX 가 spec, frontend 가 구현.

### 7-4. Sports Science (전문가 #5)

**경계:** `analysis.js` 의 알고리즘 (VMG 계산식·skill HR zone·tack angle 정의) — sports science. **구현 / lifecycle / 데이터 입출력** — frontend.

**Phase 2:** sports science 가 새 metric spec 작성 → frontend 가 analysis.js 에 함수 추가, unit test 작성.

### 7-5. Mobile App Engineer (전문가 #6)

**경계:** 현재 native iOS / Android 앱 없음. 회사 코드 공유 가능성:

| 옵션 | 비용 | 가치 |
|---|---|---|
| **Capacitor** (Ionic) — 웹 자산을 WebView 로 native 패키징 | 낮음 (현재 site/ 거의 그대로) | 중간 (네이티브 API · 푸시 알림 제한적) |
| **React Native** (전부 다시) | 매우 높음 (벽돌 깨고 다시 쌓기) | 높음 (성능) |
| **별도 native (Swift + Kotlin)** | 매우 매우 높음 (두 codebase) | 가장 높음 |
| **PWA + add-to-home-screen 만** | 0 | 낮음 (§1-4 iOS 한도) |

**현재 권장:** native 앱은 Phase 3+ — Vakaros 대비 단무지공방 모션 센서(hardware spec doc 참조) 가 hardware 출시 후 동반 native 앱이 필요하면 그 때 Capacitor 우선 검토. 그 전까지는 web 강화에 집중.

### 7-6. Backend / Orchestrator daemon

**현재:** 백엔드 없음. localStorage shim (DMJAuth). agent-deny 의 FAQ/KB 가 정적 JSON.

**Phase 12 (Supabase):** Supabase JS SDK 가 client-side fetch. 우리 frontend 는 거의 변경 없이 `localStorage` ↔ `supabase` 호출만 교체. API endpoint 정의 책임: backend. 호출 정합성·error handling — frontend.

**Phase 2 인터페이스 정의 항목:**
- `users` table 스키마 (`email` `nickname` `weight_kg` `skill` `level` `avatar_url`).
- `cart` table (per-user · per-item).
- `quotes` / `orders` / `consult_history` table.
- RLS (Row Level Security) policy — Supabase 표준.
- Realtime 채널 (push notification dashboard 변경 알림 등 — 옵션).

---

## 8. 의사결정 framework cheat-sheet

| 질문 | 결정 |
|---|---|
| 새 페이지 1개 추가 — vanilla 로? Astro 로? | Phase 1 = vanilla (HTML 1 파일). Phase 2 = Astro page (src/pages/*.astro). |
| 새 JS 모듈 — IIFE 로? ES Module 로? | Phase 1 = 기존 IIFE 유지. Phase 2 = ES Module. |
| iOS hit-test 비슷한 버그 — 어떻게 진단? | (1) 실 iPhone 에서 재현 (2) `_ios-test.html` 패턴으로 touch event log (3) DevTools remote inspect (Safari · Mac → iPhone) (4) `pointer-events: none` 자식 SVG 가 first fix |
| Performance — image · font · JS 중 어디서 시작? | LCP image (hero) 부터. AVIF · preload · explicit dimensions. 그 다음 폰트 self-host. JS 는 INP 측정 후. |
| a11y — 어디서 시작? | (1) focus ring 토큰화 (2) skip link 추가 (3) target size 24px audit (4) screen reader 1회 manual test. |
| 새 chart 추가 — Chart.js? D3? canvas? | dataviz expert 의 §1-2 decision framework 참조. 표준 X-Y = Chart.js. bespoke = canvas. |
| 새 인터랙티브 island — 어느 framework? | Astro + React island 가 디폴트 (생태계). Svelte island 도 가능 (간단). dashboard 는 Vue 도 옵션. |
| 새 dependency 추가 — bundled? CDN? | <10 KB · 핵심 = bundle. >100 KB · 1-2 페이지만 = lazy load (현재 matrix.js · html2canvas 패턴). |
| CSS — 새 컴포넌트 어디에? | Phase 2 = `@layer components { ... }`. Phase 1 = `style.css` 끝에 BEM 명명. |

---

## 9. 변수 · 상수 · 약어 cheat-sheet

| 약어 / 토큰 | 의미 / 값 |
|---|---|
| LCP | Largest Contentful Paint (≤ 2.5 s = Good) |
| INP | Interaction to Next Paint (≤ 200 ms = Good) — FID 대체 (2024-03) |
| CLS | Cumulative Layout Shift (≤ 0.1 = Good) |
| WCAG 2.2 AA | 2023-10 W3C Rec. EU EAA 2026 기준. 6 새 AA criterion. |
| SSR · CSR · SSG · ISR · PPR | server-side · client-side · static-site-generated · incremental-static-regen · partial-pre-render |
| dvh / dvw / svh / lvh | dynamic / small / large viewport units (iOS 15.4+, Chrome 108+) |
| `pointer-events: none` | 마우스/터치 이벤트 무시 — iOS hit-test fix |
| `touch-action: manipulation` | 300ms tap delay 제거 |
| `-webkit-tap-highlight-color` | iOS 탭 시 회색 박스 색 변경 |
| `env(safe-area-inset-*)` | notch/dynamic island/home indicator safe area |
| `viewport-fit=cover` | safe-area 모드 활성화 (meta viewport) |
| Astro island | client:load · client:idle · client:visible 지시자로 부분 hydration |
| `@layer` | CSS cascade layers (browsers ≥ 2022) |
| Vite 8 | Rolldown (Rust) build engine, esbuild+Rollup 통합 |
| Lighthouse CI | `@lhci/cli` — CI 통합 Lighthouse 자동 측정 |
| axe-core | 자동 a11y 검사 라이브러리 (Deque) |

---

## 10. Sources

[1] [Astro vs Next.js: Which Framework Should You Use in 2026? — Cosmic JS](https://www.cosmicjs.com/blog/astro-vs-nextjs-2026)
[2] [Core Web Vitals 2026: INP, LCP & CLS Optimization — Digital Applied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)
[3] [What Are the Core Web Vitals? LCP, INP & CLS Explained (2026)](https://www.corewebvitals.io/core-web-vitals)
[4] [The Most Important Core Web Vitals Metrics in 2026 — Nitropack](https://nitropack.io/blog/most-important-core-web-vitals-metrics/)
[5] [What's New in WCAG 2.2 — W3C WAI](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
[6] [WCAG 2.2 Updates — Deque University](https://dequeuniversity.com/resources/wcag-2.2/)
[7] [iOS 26: Drawer leaves a bottom gap in Safari/Chrome — MUI #46953](https://github.com/mui/material-ui/issues/46953)
[8] [iOS 26.0: Be prepared for viewport changes in Safari — Stripearmy](https://stripearmy.medium.com/ios-26-0-be-prepared-for-viewport-changes-in-safari-e867d7eace43)
[9] [PWA iOS Limitations and Safari Support 2026 — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
[10] [Do Progressive Web Apps Work on iOS? The Complete Guide for 2026 — Mobiloud](https://www.mobiloud.com/blog/progressive-web-apps-ios)
[11] [Vite vs Turbopack vs Rspack Benchmark 2026 — Kunal Ganglani](https://www.kunalganglani.com/blog/vite-turbopack-rspack-benchmark)
[12] [Using custom workflows with GitHub Pages — GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
[13] [CSS Snapshot 2026 — W3C TR](https://www.w3.org/TR/css-2026/)
[14] [WCAG 2.2 Checklist: Complete 2026 Compliance Guide — Level Access](https://www.levelaccess.com/blog/wcag-2-2-aa-summary-and-checklist-for-website-owners/)

내부 참조:
- `site/_experts/expert_dataviz_reference.md` — dataviz Phase 1 (현재 chart-theme · viz lib · 16 카드 audit)
- `site/_experts/expert_hardware_embedded_reference.md` — hardware Phase 1 (Vakaros 대항 모션 센서 spec)
- `site/Phase1_AuditIssues.md` — 2026-05-05 야간 sprint 의 visual/layout audit
- `site/PUSH-FIX.command` — local 배포 스크립트 (Phase 2 polishing 후 폐기 후보)
- `site/CNAME` — `dmjgroup.kr`
- `site/assets/css/style.css:550-604` — §171-C iOS hit-test fix · `touch-action` · `-webkit-tap-highlight-color`
- `site/assets/js/nav-auth.js` — §169-G v2 · §145-G v9 nav dropdown 단일 핸들러
- `site/assets/js/auth-shim.js` — §169-K v3 per-user localStorage namespace + §175 누적 구매 자동 승급 + §179 비밀번호 재설정
- `site/assets/js/cart.js` — §171-B cart system spec lock
- `site/assets/js/agent-deny.js` — §173 Coach Danny AI Agent (Phase 1 FAQ + RAG)
- `site/riding-dashboard/js/app.js` — riding dashboard state + UI orchestration
