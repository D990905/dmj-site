# 모바일 가독성 전수조사 — 2026-06-04

| 항목 | 내용 |
|---|---|
| 지시 | 옥대표님 — "모바일 뷰어로 모든 페이지 전수조사, 가독성 확인" |
| 점검자 | 알렉스 박 (화면·반응형) |
| 방법 | CSS 정적 분석 (breakpoint 규칙 부재 · 고정 px · grid 열수 강제 · 폰트 · 터치 타겟 · 가로 overflow 패턴). 브라우저 미사용 — 코드 레벨 판정 |
| 커버리지 | **고객 노출 HTML 111개** 전수 (redirect shell 2개 + riding-dashboard 입구 1개 포함, `_ci_site`·`_qa*`·`admin/*`·`_fragments`·내부 테스트 파일 제외) |
| 수정 | **이 보고서는 진단만** — 단, profile.html My Gear 모바일 축소(§192)는 옥대표님 직접 지적분이라 별도 즉시 구현 완료 |

---

## ⚡ 즉시 수정 권장 TOP 10

| # | 심각도 | 문제 | 위치 | 권장 수정 |
|---|---|---|---|---|
| 1 | **상** | 브랜드 hub 4페이지 비교표 — `.compare-wrap` 클래스에 CSS가 없어 가로 스크롤 미작동. ≤640px에서 `.compare-table { min-width:540px }` 강제 + body `overflow-x:hidden` → **우측 컬럼이 잘려서 아예 볼 수 없음** (Levitaz hub는 8열 표) | levitaz.html:1180 외 3 hub + style.css:2722 (`.compare-table-wrap`만 정의, `.compare-wrap` 미정의) | style.css 2722행 미디어쿼리 selector에 `.compare-wrap` 추가 (`.compare-table-wrap, .compare-wrap { overflow-x:auto; }`) — 1줄 fix |
| 2 | **상** | 제품 상세 29페이지의 `.compare-wrap`은 product-detail.css:741에 overflow-x 정의가 있어 작동하나, **브랜드 hub(levitaz/ppc/takoon/wip.html)는 product-detail.css를 로드하지 않음** — #1과 동일 근본 원인. hub 4페이지가 가장 위험 | levitaz.html / ppc.html / takoon.html / wip.html | #1 fix로 동시 해결 (style.css 쪽에 정의) |
| 3 | **상** | policies.html 인라인 `<style>`에 Tailwind `@apply` 디렉티브 — `type="text/tailwindcss"` 없이는 브라우저가 전부 무효 처리 → `.prose-policy` 표/제목/리스트 스타일 전멸 (모바일 표 text-sm 축소 포함 미작동) | policies.html:41-53 | `<style>` → `<style type="text/tailwindcss">` 1단어 fix, 또는 plain CSS로 변환 |
| 4 | **중** | 계산기 그래프 SVG — viewBox 480×280 고정 + 축 라벨 font-size 9. 모바일 ~340px 폭으로 축소 시 **유효 글자 크기 ≈ 6.4px** (판독 불가 수준). 2026-06-03 QA P1-6 미해결 잔존 | calculator.html:1279, 1293-1303, 1443 | 라벨 font-size 9→12 상향 (viewBox 비율상 모바일 ~8.5px 확보) 또는 모바일에서 viewBox 폭 축소 분기 |
| 5 | **중** | 모바일 nav "장비" 섹션 누락 — 13페이지 잔존 (index 등 대다수는 해결됨). QA P1-8a 부분 미해결 | profile, skill-assessment, consult, login, password-reset, quote, glossary, calculator, level/novice, cart, membership, signup, premium (13개) | index.html:207 패턴(장비 heading + 4 브랜드)을 13페이지 mobile-menu에 sweep |
| 6 | **중** | glossary sticky 툴바 `top:56px` vs 실제 nav 높이 72px (모바일 미축소) — 스크롤 시 툴바 상단 16px이 nav 뒤에 깔림. QA P1-8b 미해결 | glossary.html:266 (인라인 style) + style.css:439 | `top:72px`로 정정, 또는 nav 높이를 CSS 변수화 |
| 7 | **중** | 터치 타겟 44px 미달 — footer 링크(fs-sm + gap 8px ≈ 28px pitch), trust-bar 아이템, `.nav__cart-badge` 22px 등. QA P1-7 미해결 잔존 | style.css:1403-1404 (footer-col ul), :687-711 (trust-bar), :6760 (cart-badge) | footer 링크에 `padding:6px 0; display:inline-block` (≥36px pitch), 장식성 요소(trust-bar)는 비인터랙티브라 후순위 |
| 8 | **중** | `.calc-radio-group` 3열 강제 — ≤480px 폴백 없음 (4열짜리만 2열 폴백 존재). 360px 화면에서 한 칸 ≈ 100px, 한국어 라벨 2자 초과 시 잘림/wrap 위험 | calculator.html 인라인 style :23-26 | `@media (max-width:480px){ .calc-radio-group{grid-template-columns:repeat(2,1fr)} }` 추가 |
| 9 | **하** | breakpoint 난립 — max-width 기준 540/640/768 외에 480/520/560/600/700/720/740/760/800/820/880/900/920/960 등 25종 산재. 회귀 디버깅 비용 증가 (QA P1-5 일부) | style.css 전역 | 신규 작성분부터 540/768/1024 3단 표준화. 일괄 치환은 위험 — 점진 정리 |
| 10 | **하** | 이중 redirect shell — products/wip/boots.html, catalog.html은 viewport meta 자체가 없으나 즉시 redirect라 실사용 영향 0. 단 redirect 실패(JS off) 시 980px 데스크탑 렌더 | boots.html, catalog.html | meta viewport 1줄 추가 (방어적) |

---

## 2026-06-03 QA 모바일 항목 재확인 (추적)

| QA 항목 | 상태 |
|---|---|
| P0-1a 기술 5축 차트 ≤540px 5열 강제 (style.css:2854) | ✅ **해결됨** — :2908-2911에 540px 3열 폴백 추가 확인 ("P0 모바일 폴백" 주석) |
| P0-1b 이미지 스트립 ≤540px 1열 부재 (:3800) | ✅ **해결됨** — :3853-3858에 540px 1열 + span 리셋 확인 |
| P0-1c m2.html 비교표 wrapper 누락 (:407) | ⚠️ **반쪽 해결** — `<div class="compare-wrap">` 추가됐으나(415행) 제품 상세는 product-detail.css 덕에 작동. **브랜드 hub 4페이지는 여전히 미작동** (TOP 10 #1·#2) |
| P1-8a 모바일 nav 장비 섹션 누락 | ⚠️ **부분 해결** — index 등 대다수 적용, **13페이지 잔존** (TOP 10 #5) |
| P1-8b glossary 툴바 sticky 위치 nav 미매칭 | ❌ **미해결** (TOP 10 #6) |
| P1-6 계산기 축 라벨 9px | ❌ **미해결** (TOP 10 #4) |
| P1-7 터치 타겟 44px 미달 | ❌ **미해결** (TOP 10 #7) |

---

## 페이지군별 상세 점검 결과

### A. 핵심 단독 페이지

| 페이지 | 판정 | 비고 |
|---|---|---|
| index.html | ✅ 양호 | hero clamp() 폰트, grid 폴백 완비, 모바일 nav 장비 섹션 有 |
| profile.html | ✅ §192 적용 | My Gear 차트 6종 + stats 5카드 모바일 축소 금일 구현 (아래 별첨). §E 펜타곤(160×160)·§F·§G compact는 원래 소형이라 OK |
| find-my-gear.html | ✅ 양호 | fmg-* 모바일 규칙 40건, mtx-row ≤600px 1열 stack + tap target 확보(:5184). §164 nowrap 라벨은 60px 고정폭 컬럼이라 overflow 무해 |
| skill-assessment.html | ✅ 양호 | 펜타곤 SVG viewBox(-220 -160 440 320) 비율 스케일 — 고정 px 없음 |
| calculator.html | ⚠️ 2건 | 그래프 라벨 6.4px (TOP 4), radio 3열 (TOP 8). calc-shell/wso-grid 폴백은 양호 |
| glossary.html | ⚠️ 1건 | sticky top 16px 미스매치 (TOP 6) |
| membership.html | ✅ 양호 | `.membership-table-wrap { overflow-x:auto }` 정상 (style.css:5317) — 표 wrapper의 올바른 본보기 |
| cart.html / quote.html | ✅ 양호 | `<table>` 미사용 — 카드형 리스트라 overflow 위험 없음 |
| consult.html / premium.html | ✅ 양호 | 인라인 form grid ≤540px 1열 폴백 완비 |
| login / signup / password-reset | ✅ 양호 | 단일 컬럼 form. 단 모바일 nav 장비 누락 (TOP 5) |
| about.html / 404.html | ✅ 양호 | clamp() 타이포 |
| policies.html | ❌ 1건 | Tailwind @apply 무효 (TOP 3) — 이 페이지만 사이트 표준 style.css 미사용 (Tailwind CDN 단독) 구조도 이질적 |
| policy/privacy·refund·shipping·terms | ✅ 양호 | `.legal-content table` 2열 위주 — width:100% 자연 wrap. 5열 이상 표 없음 |
| catalog.html | ✅ n/a | redirect shell |
| riding-dashboard/index.html | ✅ 양호 | viewport 有, 자체 반응형 (별도 앱 — 심층은 범위 외) |

### B. 브랜드 hub 4페이지 (levitaz / ppc / takoon / wip)

- ❌ **비교표 가로 스크롤 미작동** (TOP 1·2). Levitaz hub 8열 × 3표, takoon 3표, wip 2표, ppc 1표 — 모바일에서 가격·풍속·속도 컬럼 잘림.
- ✅ hero·sku-grid·brand-identity-grid는 768/1280 폴백 정상.
- ✅ perf-mini 5축 차트 540px 3열 폴백 확인 (QA P0-1a 해결분).

### C. products/* 상세 52페이지 (levitaz 8 · ppc 5 · takoon 33 · wip 6)

- ✅ product-detail.css가 `.spec-table-wrap`·`.compare-wrap`(overflow-x:auto :741) 모두 정의 — 표 2종 모바일 스크롤 정상.
- ✅ pd-hero 960px 폴백, attr-bar 비율형.
- ✅ 인라인 max-width(900px 등)는 상한이라 모바일 무해.
- ⚠️ wip/boots.html은 redirect shell (viewport 없음 — TOP 10 #10).
- 참고: `.spec-table` 계열 CSS가 style.css에는 0건 — product-detail.css 단일 소스. **hub 페이지에서 spec-table을 쓰게 되면 #1과 동일 사고 재발 구조** (현재는 미사용이라 잠재 리스크).

### D. level/* 5 · style/* 4 · genre/* 8 · junior · women · family

- ✅ `<table>` 미사용 — 카드·grid 구성. grid-3cols/4cols ≤540px 1열 폴백 완비 (§163 정책 준수 확인).
- ✅ image-strip 540px 1열 폴백 (QA P0-1b 해결분).
- ✅ junior/women/family 인라인 style 모바일 폴백 보유.
- ⚠️ level/novice.html — 모바일 nav 장비 누락 13페이지 중 하나 (TOP 5).

### E. 공통 컴포넌트

| 컴포넌트 | 판정 |
|---|---|
| nav (72px 고정) | ✅ 작동하나 모바일 미축소 — sticky 요소들이 56px을 가정하면 미스매치 (TOP 6). 가급적 `--nav-height` 변수화 권장 |
| footer 4-col | ✅ 900px 2×2 → 540px 1열 (§145-G v3 정상). 링크 터치 pitch ~28px (TOP 7) |
| mobile-menu | ✅ 구조 양호, 13페이지 콘텐츠 누락만 (TOP 5) |
| agent-deny FAB/panel | ✅ ≤540px fullscreen 분기 有 (agent-deny.css:848) |
| body overflow-x:hidden (:145) | ⚠️ 가로 overflow를 "숨겨서" 증상을 가림 — #1 같은 표 잘림이 스크롤조차 안 되는 이유. 유지하되, 표는 반드시 자체 wrapper 스크롤 필요하다는 운영 원칙으로 |

---

## 별첨 — 작업 1 (§192) 구현 내역: profile.html My Gear 모바일 축소

- 위치: `assets/css/style.css` — `.gear-dash-empty` 직후, **`@media (max-width:540px)` 블록 1개만 추가** (데스크탑 규칙 0 변경, DO_NOT_REVERT 주석 무변경, §185 +N 버튼 클래스 보존).
- 내용: donut 160→112px · gauge 160×100→120×75 · 카드 padding 16/18→10/12 + min-height 220 해제 · 차트 grid gap 14→8 · bar row 폰트 13→11 + track 8→6px + 라벨 컬럼 비중 38→42% (잘림 방지) · stats 카드 padding/폰트 축소 (2열 유지) · 대시보드 wrapper padding 20/22→12.
- 검증: 중괄호 짝 balance 0/0 통과, §192 블록이 540px 미디어쿼리 내부에만 존재함을 스크립트로 확인.

---

— 알렉스 박 (반응형) · 2026-06-04 · 고객 노출 111 페이지 전수
