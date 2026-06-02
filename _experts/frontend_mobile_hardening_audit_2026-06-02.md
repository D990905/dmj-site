# Frontend Mobile Hardening Audit — 2026-06-02 (Phase 2 sprint 1)

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 2 sprint 1 audit deliverable. 코드 직접 grep 검증 + fix 위치 enumerate |
| 작성 | 알렉스 박 (Alex Park, Frontend Engineer #4) · 2026-06-02 |
| 대상 | `expert_frontend_engineer_reference.md` §5 의 mobile hardening list 5건 — grep 으로 실제 코드 검증 |
| 범위 | audit only · production 코드 무수정. fix 자체는 별도 dispatch (sprint 1 후반 또는 sprint 2) |
| 근거 | `Grep` 직접 실행 결과 (실제 line 번호 인용) |
| 결론 | 5건 중 4건 확인 fix 필요 · 1건 (trim handle) 이미 적절 |

> **읽는 법.** 각 항목은 (a) 검증 grep 결과 + line 번호 (b) 위험 evidence (c) 권장 fix (d) Phase 2 적용 timing 으로 구성. 본 audit 의 fix 자체는 별도 PR — sprint 1 후반 또는 sprint 2.

---

## 0. TL;DR

| # | 항목 | 상태 | 권장 fix 위치 | 우선순위 |
|---|---|---|---|---|
| 1 | **`.kakao-fab` SVG hit-test** | 🔴 **CONFIRMED — fix 필요** | `style.css:1793` 직후 `pointer-events: none` 1줄 | P0 — Sprint 1 후반 |
| 2 | **agent-deny widget chip SVG** | 🟡 현재 chip text-only 안전 / preemptive fix 권장 | `agent-deny.css` 후반 신규 rule | P1 — Sprint 2 |
| 3 | **riding-dashboard trim handle drag** | 🟢 **이미 적절** (`{ passive: false }` 사용) | 수정 X | — |
| 4 | **iOS 26 viewport / `100vh` → `100dvh`** | 🟡 4 위치 `100vh` 사용 · `100dvh` 0건 | `style.css:1888, 3859, 4407, 4409` 4 위치 | P1 — Sprint 2 |
| 5 | **cart badge `aria-live`** | 🔴 **CONFIRMED — fix 필요** | `cart.js:494` 주변 + `index.html` `nav__cart-badge` 속성 | P0 — Sprint 1 후반 |
| 6 | **mobile-menu safe-area-inset-bottom** | 🟡 `env(safe-area-inset-*)` 사용처 0건 · iOS 26 회귀 위험 | `style.css:608` mobile-menu 블록 | P1 — Sprint 2 |

**P0 fix 2건 = 즉시 검토 가능 — 코드 4줄 추가** (Phase 2 sprint 1 후반 또는 sprint 2 첫 항목).

---

## 1. `.kakao-fab` SVG hit-test — 🔴 CONFIRMED

### 1-1. Grep evidence

```
$ grep -n 'kakao-fab' assets/css/style.css
1776:.kakao-fab {
1792:.kakao-fab:hover { transform: scale(1.06); box-shadow: 0 12px 32px rgba(255,184,0,0.5); }
1793:.kakao-fab svg { width: 26px; height: 26px; }
```

`§171-C` CSS rule (style.css:597-604) 는 `.site-header a > svg, .site-header a svg *` 등 site-header scope 만 cover. `.kakao-fab` 은 site-header 밖이라 §171-C scope **벗어남**.

### 1-2. 위험 evidence

`index.html:979-981`:
```html
<a href="#contact" class="kakao-fab" aria-label="카톡 상담">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
</a>
```

iOS Safari 의 SVG hit-test 버그 동일 패턴 — SVG path 가 hit-target 으로 잡혀 `href="#contact"` 가 실제로 trigger 되지 않을 수 있음. 모든 페이지 footer 직전에 동일 코드 — 129 페이지 영향 (sitewide).

### 1-3. 권장 fix

`style.css:1793` 직후 추가:

```css
/* §182 (Sprint 1 후반) — kakao-fab iOS Safari hit-test fix */
.kakao-fab > svg,
.kakao-fab svg * { pointer-events: none; }
.kakao-fab {
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(10, 37, 64, 0.10);
}
```

§171-C 와 동일 패턴 (style.css:597-604). DO_NOT_REVERT §182 신규 등록 권장.

### 1-4. Phase 2 timing

P0 — sprint 1 후반 또는 sprint 2 첫 항목. 코드 6줄. 회귀 위험 거의 0 (SVG 의 pointer-events 차단은 시각 변화 X).

---

## 2. agent-deny widget chip SVG — 🟡 현재 안전, preemptive

### 2-1. Grep evidence

```
$ grep -n 'pointer-events' assets/css/agent-deny.css
76:  pointer-events: none;
102:  pointer-events: none;
111:  pointer-events: none;
135:  pointer-events: none;
141:  pointer-events: auto;
224:  pointer-events: none;
232:  pointer-events: auto;
835:     pointer-events 가 default(auto) 라서 chat 닫힌 상태에서도 페이지 전체 클릭을 흡수했음.
837:  pointer-events: none;
842:  pointer-events: auto;
910:  pointer-events: none;
```

`pointer-events` 11 위치 — 주로 fab backdrop · panel container 의 click-through 처리. **`.agent-deny-msg__related-btn svg`, `.agent-deny-msg__slot-btn svg` 패턴은 부재** (chip 자식 SVG 없는 현재 OK, 미래 추가 시 위험).

### 2-2. 위험 evidence

`agent-deny.js:486-595` (renderMsg) 가 만드는 chip 은 text-only — **현재 위험 없음**. 다만 Phase 2 에 chip 안에 brand logo / ↗ arrow / 상품 thumbnail 추가 시 `.kakao-fab` 와 동일 SVG hit-test 버그 발현 가능.

### 2-3. 권장 fix (preemptive)

`agent-deny.css` 끝에 추가:

```css
/* §182-B (Sprint 2) — agent-deny widget 내부 SVG hit-test 사전 차단 */
.agent-deny-msg__related-btn > svg,
.agent-deny-msg__related-btn svg *,
.agent-deny-msg__slot-btn > svg,
.agent-deny-msg__slot-btn svg *,
.agent-deny-msg__page-link > svg,
.agent-deny-msg__page-link svg *,
.agent-deny-msg__reccard-link > svg,
.agent-deny-msg__reccard-link svg * { pointer-events: none; }
```

### 2-4. Phase 2 timing

P1 — sprint 2 첫 sprint. preemptive 라 즉시 시급 X. 단 매 1줄 추가 비용 거의 0 — sprint 1 후반에 §1 fix 와 함께 묶어도 OK.

---

## 3. riding-dashboard trim handle drag — 🟢 이미 적절

### 3-1. Grep evidence

```
$ grep -rn 'passive' riding-dashboard/js/
replay.js:1426:    }, { passive: false });
```

단 1 위치. `{ passive: false }` 명시 = `preventDefault()` 가능 — drag 중 page scroll 차단 정상.

### 3-2. 추가 검증

```
$ grep -rn 'touch-action' assets/css/style.css | grep -v nav__
5631:.gear-dash-bar-row--editable { cursor: pointer; touch-action: none; }
```

`touch-action: none` 명시 — drag region 의 scroll 차단 정상. 이미 적절.

### 3-3. 결론

수정 X. 단 sprint 2 의 모바일 디바이스 실 테스트 round (iPhone 13 + iPhone 15 Pro + iPhone SE 3) 에서 실제 drag UX 검증 — jitter / cursor sync / pinch zoom 동시 발생 시 cursor 안 깨지는지 등.

---

## 4. iOS 26 viewport `100vh` → `100dvh` — 🟡 4 위치

### 4-1. Grep evidence

```
$ grep -n '100vh\|100dvh' assets/css/style.css
1888:  min-height: calc(100vh - 200px);
3859:  min-height: 100vh;
4407:  min-height: clamp(540px, 100vh, 920px);
4409:  max-height: 100vh;

$ grep -n '100dvh' assets/css/style.css
(0 matches)
```

`100dvh` 0건. iOS Safari 의 dynamic viewport (주소 바 보임/안 보임 차이) 반영 안 됨 — `100vh` 가 iOS Safari 에서 large viewport (주소 바 hidden 상태) 기준이라 첫 로드 시 화면 일부 가려질 수 있음.

### 4-2. 위험 evidence

iOS 26 의 viewport unit 회귀 보고 (Stripearmy)[ref §5-4]. 모바일 hero / full-screen modal 의 vertical alignment 가 깨질 수 있음. 4 위치 모두 `min-height` / `max-height` 라 layout 강제 영역 — 회귀 영향 직접.

### 4-3. 권장 fix

각 위치를 `100vh; <new-line> 100dvh;` fallback 패턴으로:

```css
/* Sprint 2 — iOS 16+ dynamic viewport unit */
min-height: 100vh;     /* fallback for older browsers */
min-height: 100dvh;    /* iOS 15.4+, Chrome 108+, dynamic */
```

또는 PostCSS `postcss-100vh-fix` plugin (Phase 2 build step 도입 시 자동 처리).

### 4-4. Phase 2 timing

P1 — sprint 2. 위험 evidence 가 회귀 보고 기반 (실측 X). 모바일 디바이스 실 테스트 round 와 함께 검증 + fix.

---

## 5. cart badge `aria-live` — 🔴 CONFIRMED

### 5-1. Grep evidence

```
$ grep -n 'nav__cart-badge\|aria-live\|cart-badge' assets/js/cart.js
494:    var nodes = document.querySelectorAll('[data-cart-badge]');

$ grep 'aria-live' index.html
(0 matches)
```

`cart.js:494` 가 `[data-cart-badge]` 노드 selector — DOM 업데이트는 하지만 `aria-live` 속성 부재. screen reader 가 cart 추가/제거 알림 받지 못함.

### 5-2. 위험 evidence

`index.html:166`:
```html
<span class="nav__cart-badge" data-cart-badge hidden>0</span>
```

WCAG 2.1 SC 4.1.3 (Status Messages) — programmatically determined status 가 focus 변경 없이 알림되어야. `aria-live="polite"` 누락. cart 추가는 user action 의 직접 결과라 user 자신은 알지만, screen reader 사용자에게는 cart 상태 변화 silent.

### 5-3. 권장 fix

**fix 1 — HTML attribute 추가** (`index.html:166` 외 129 페이지 일괄):

```html
<span class="nav__cart-badge" data-cart-badge aria-live="polite" aria-atomic="true" hidden>0</span>
```

**fix 2 — `cart.js:494` 주변 보강:**

`cart.js` 의 badge 업데이트 함수가 `hidden` 토글할 때 `textContent` 도 즉시 업데이트 — `aria-live="polite"` 가 정확히 그 시점에 announce.

Phase 2 sprint 1 후반 = 129 페이지의 `nav__cart-badge` 일괄 sed (Astro layout 도입 시점에 자동 정리).

### 5-4. Phase 2 timing

P0 — sprint 1 후반. 코드 1 attribute 추가 (129 페이지 일괄). 회귀 위험 0.

---

## 6. mobile-menu safe-area-inset-bottom — 🟡

### 6-1. Grep evidence

```
$ grep -n 'env(safe-area' assets/css/style.css
(0 matches)
```

`env(safe-area-inset-*)` 사용처 0건. 단 `viewport-fit=cover` 는 `index.html:5` meta tag 에 있음 — 즉 safe-area 모드는 활성화돼 있는데 CSS 에서 활용 안 됨.

### 6-2. 위험 evidence

`style.css:608-619`:
```css
.mobile-menu {
  position: fixed;
  inset: 0;
  background: rgba(10,37,64,0.96);
  -webkit-backdrop-filter: blur(8px);
  ...
}
```

iOS 26 회귀 (MUI #46953) — drawer 가 backdrop 을 safe-area-inset-bottom 아래까지 못 깔아서 gap. 우리 mobile-menu 가 정확히 동일 패턴 (`inset: 0` + backdrop). iPhone X+ home indicator 영역 / Dynamic Island 영역에서 gap 발생 가능.

### 6-3. 권장 fix

```css
/* Sprint 2 — iOS 26 safe-area gap fix */
.mobile-menu {
  /* 기존 inset: 0 유지 */
  /* env() 가 0 이면 safe-area 없는 device — fallback 자연 */
  padding-bottom: env(safe-area-inset-bottom, 0);
  padding-top: env(safe-area-inset-top, 0);
}

/* kakao-fab 도 safe-area 보호 */
.kakao-fab {
  bottom: calc(24px + env(safe-area-inset-bottom, 0));
}
```

### 6-4. Phase 2 timing

P1 — sprint 2. 모바일 디바이스 실 테스트 round 와 동시 검증.

---

## 7. Sprint 1 후반 fix bundle (P0 2건 통합 PR)

P0 2건 (§1 kakao-fab + §5 cart badge aria-live) 묶어서 1 PR 권장:

```diff
# style.css (line 1793 직후)
+ /* §182 — kakao-fab iOS Safari hit-test fix (DO_NOT_REVERT) */
+ .kakao-fab > svg,
+ .kakao-fab svg * { pointer-events: none; }
+ .kakao-fab {
+   touch-action: manipulation;
+   -webkit-tap-highlight-color: rgba(10, 37, 64, 0.10);
+ }

# index.html (line 166) — 129 페이지 일괄
- <span class="nav__cart-badge" data-cart-badge hidden>0</span>
+ <span class="nav__cart-badge" data-cart-badge aria-live="polite" aria-atomic="true" hidden>0</span>
```

PR 영향:
- `style.css` 6줄 추가 (1 위치)
- HTML 1 attribute 추가 (129 위치, sed 일괄)
- 시각 변화 0 · 기능 변화 0 · a11y · iOS hit-test 보강

PR commit message draft:
```
fix(mobile): §182 kakao-fab iOS hit-test + cart badge aria-live

§182 (DO_NOT_REVERT) — iOS Safari hit-test 패치를 .kakao-fab 에 확장.
§171-C 와 동일 패턴 — SVG 자식의 pointer-events 차단 + touch-action +
-webkit-tap-highlight-color. site-header 밖 fab 의 href="#contact"
미동작 회귀 영구 차단.

a11y — nav__cart-badge 의 aria-live="polite" aria-atomic="true" 추가.
WCAG 2.1 SC 4.1.3 (Status Messages) 충족. cart 변경 시 screen
reader 알림.

영향:
- style.css : 6줄 추가 (1 위치, line 1793 직후)
- 129 HTML 페이지 : data-cart-badge attribute 일괄 sed
- 시각 변화 0 · 기능 변화 0

By 알렉스 박 (Alex Park, #4) · Phase 2 sprint 1 후반
Audit evidence: _experts/frontend_mobile_hardening_audit_2026-06-02.md
```

---

## 8. Sprint 2 fix bundle (P1 3건)

§2 agent-deny preemptive + §4 100dvh + §6 safe-area-inset 합산 1 PR:
- `style.css` ~ 8 위치 수정
- `agent-deny.css` ~ 10줄 추가
- 모바일 디바이스 실 테스트 round (iPhone 13 / 15 Pro / SE 3) 동반

별도 PR — sprint 2 첫 항목.

---

## 9. Sources

- `expert_frontend_engineer_reference.md` §5 — 5 candidates 본 audit 의 직접 input
- `expert_orchestrator_daemon_reference.md` §6-2 — dashboard contract
- WCAG 2.1 SC 4.1.3 — https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
- iOS 26 viewport 회귀 — https://stripearmy.medium.com/ios-26-0-be-prepared-for-viewport-changes-in-safari-e867d7eace43
- MUI #46953 (drawer safe-area gap) — https://github.com/mui/material-ui/issues/46953
- DO_NOT_REVERT §171-C (style.css:597-604) — site-header SVG hit-test fix (선행)
