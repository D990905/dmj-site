---
dispatch_id: D-2026-05-31-001
task: focus-ring-spec
owner: 로즈 윤 (Rose Yoon) — Visual Design Director
sender: 데이빗 옥 (proxy for 옥덕필 Danny)
status: sent
estimate: 2-4 hours
due: 2026-06-03 (Wed)
created: 2026-05-31
last_update: 2026-05-31
linked: [D-2026-05-31-002, D-2026-05-31-003]
priority: P1
phase: Phase 1 (spec only — production 코드 변경 X)
---

# 📩 Dispatch · D-2026-05-31-001 · Focus Ring 표준화 spec

---

## 로즈 디렉터에게,

### 1. 요청 (outcome)

**전 사이트의 `:focus-visible` 정책 표준화 spec 작성.** WCAG 2.2 #2.4.13 (Focus Appearance) AA 통과 + 키보드 사용자 인지 격차 제거.

구체 산출물 한 가지:
- `site/_team/dispatches/D-2026-05-31-001-focus-ring-spec-rose.md` 의 동봉 spec 섹션 (§A) 검토 + ✓ 또는 권장 수정.
- spec 이 알렉스 박이 구현 가능한 수준의 정밀도여야 함 (CSS selector · token name · 적용 컴포넌트 enumeration).

### 2. 이유 (왜 지금)

- 현재 `.btn:focus-visible` (style.css:326) 만 명시 — nav__link · card · pill · hero__quick-tag · brand 카드들에 focus 스타일 X. 브라우저 기본 ring 의존 = 시각 일관성 부재.
- **WCAG 2.2 #2.4.13 (Focus Appearance) 가 2026 기준 AA** — 2px-thick + 3:1 contrast 의 visible focus 가 모든 focusable element 에 요구.
- Visual Designer reference §4-1 의 **Top 1 권장 (P1)**. 디렉터 본인이 이미 plan 정리한 항목.

### 3. acceptance criteria

- [ ] 단일 `:focus-visible` mixin (또는 token + selector 패턴) 으로 모든 focusable 에 일관 적용.
- [ ] 토큰 layer 에서 처리 (style.css `:root` 의 신규 `--ring-*` 토큰).
- [ ] 다크 컨텍스트 (navy bg / .section--dark) 에서 outline color 자동 swap (sea → sun).
- [ ] 적용 범위 enumeration — button · link · card · pill · nav · cart · 등 (개수 명시).
- [ ] `prefers-reduced-motion` 영향 없음 (focus ring 은 motion 이 아니라 static).
- [ ] WCAG 2.2 #2.4.13 의 3 가지 통과 조건 (2 CSS pixel · adjacent contrast · 동일 위치) 검증 plan 포함.

### 4. estimate 회신 요청

화요일 (2026-06-02) 오전까지 estimate + 시작 일정 회신.
완료 due: 수요일 (2026-06-03) EOD.

### 5. 참고

- `site/_experts/expert_visual_designer_reference.md` §4-1 (이미 plan 정리됨)
- `site/assets/css/style.css` :326 (현재 `.btn:focus-visible` — 모범 baseline)
- WCAG 2.2 #2.4.13 — https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- linked dispatch — `D-2026-05-31-002-focus-ring-impl-alex.md` (알렉스 박이 spec 받으면 구현).

— 데이빗 옥 · 2026-05-31

---

## § A · 초안 spec (검토 부탁)

### A-1. 신규 토큰 (style.css `:root` 에 추가)

```css
:root {
  --ring-color:           var(--color-sea);       /* light bg 의 focus ring */
  --ring-color-on-dark:   var(--color-sun);       /* dark bg (navy) 의 focus ring */
  --ring-width:           2px;
  --ring-offset:          2px;
  --ring-style:           solid;
}
```

### A-2. 공통 mixin (CSS only — Sass 없이 vanilla)

```css
/* 모든 focusable element 의 base */
:where(
  a:not([class]),
  button,
  [role="button"],
  .btn,
  .pill,
  .card,
  .nav__link,
  .nav__sub-link,
  .nav__icon-btn,
  .nav__hamburger,
  .hero__quick-tag,
  .hub-cta,
  .level-card,
  .style-card,
  .brand-card,
  input,
  select,
  textarea
):focus-visible {
  outline: var(--ring-width) var(--ring-style) var(--ring-color);
  outline-offset: var(--ring-offset);
  border-radius: inherit;  /* card 모서리 그대로 */
}

/* Dark context override */
.section--dark :where(...같은 list...):focus-visible,
.section--darker :where(...):focus-visible,
.trust-bar :where(...):focus-visible,
.mobile-menu :where(...):focus-visible {
  outline-color: var(--ring-color-on-dark);
}
```

### A-3. 적용 범위 (enumeration · 18 컴포넌트)

| # | 컴포넌트 | selector | context |
|---|---|---|---|
| 1 | Primary button | `.btn`, `.btn--accent`, `.btn--ghost` | light |
| 2 | Pill chip | `.pill`, `.pill--accent`, `.pill--mute`, `.pill--dark` | both |
| 3 | Card | `.card`, `.card--hero` | light |
| 4 | Nav primary link | `.nav__link` | light (sticky header) |
| 5 | Nav sub link (dropdown) | `.nav__sub-link` | light |
| 6 | Nav icon button | `.nav__icon-btn` (cart, search) | light |
| 7 | Nav hamburger | `.nav__hamburger` | light |
| 8 | Hero quick tag | `.hero__quick-tag` | dark (hero cinematic) |
| 9 | Consultation hub CTA | `.hub-cta` | light → dark gradient |
| 10 | Level grid card | `.level-card--*` (beginner/novice/...) | light |
| 11 | Style grid card | `.style-card--*` | light |
| 12 | Brand card | `.brand-card` | light |
| 13 | Trust bar item | `.trust-bar__item` | dark (navy bg) |
| 14 | Mobile menu link | `.mobile-menu__link`, `.mobile-menu__brand-grid a` | dark |
| 15 | Cart line item action | `.cart__row__action` | light |
| 16 | Form input/select/textarea | `input, select, textarea` (cart/quote/login) | light |
| 17 | Find-my-gear option | `.fmg-option`, `.fmg-result-cta` | light |
| 18 | Footer link | `.footer a` | dark |

### A-4. WCAG 2.2 #2.4.13 통과 조건 검증

1. **2 CSS pixel solid line** — `outline-width: 2px` ✓.
2. **Adjacent contrast ≥ 3:1** — 
   - light bg + sea (#1F8FFF) = 3.05:1 ✓ (border case · large 인접부).
   - 권장: `--color-sea-dark` (#1670CC, 4.15:1) 로 강화 검토.
   - dark bg (navy #0A2540) + sun (#FFB800) = 7.48:1 ✓.
3. **인접 영역 contrast ≥ 3:1** — focus 받은 element 자체 vs ring · ring vs 주변 모두 검증 필요.

### A-5. Phase 분리

- **Phase 1 (이 dispatch)**: spec + ✓ — 로즈 윤 review only, production 코드 변경 X.
- **Phase 2 (D-2026-05-31-002)**: 알렉스 박 구현 — token 추가 + selector 적용 + iOS/Chrome 검증.
- **Phase 3 (별도 dispatch)**: 메이 한 인터뷰 5명 — 키보드 사용자의 focus visibility 검증.

---

## § B · owner 의 회신 영역 (로즈 디렉터가 채워주세요)

### B-1. estimate
**예상 시간:** _____
**시작:** _____
**1차 review ready:** _____

### B-2. 권장 수정 (있다면)
- _____

### B-3. ✓ 또는 reject
- [ ] ✓ 위 spec 진행 OK — 알렉스에게 구현 dispatch 진행 가능.
- [ ] ⚠ 권장 수정 후 진행.
- [ ] ✗ reject (이유: _____).

### B-4. 협업 노트
- _____

---

**End of Dispatch D-2026-05-31-001** · 발신 데이빗 옥 · 2026-05-31
