---
dispatch_id: D-2026-05-31-002
task: focus-ring-impl
owner: 알렉스 박 (Alex Park) — Senior Frontend Engineer
sender: 데이빗 옥 (proxy for 옥덕필 Danny)
status: sent (blocked by D-2026-05-31-001 — 로즈의 spec ✓ 필요)
estimate: TBD (spec 받은 후 회신)
due: 2026-06-05 (Fri)
created: 2026-05-31
last_update: 2026-05-31
linked: [D-2026-05-31-001, D-2026-05-31-003]
priority: P1
phase: Phase 2 (production 코드 변경)
---

# 📩 Dispatch · D-2026-05-31-002 · Focus Ring 구현

---

## 알렉스에게,

### 1. 요청 (outcome)

**로즈 디렉터가 ✓ 한 Focus Ring spec (D-2026-05-31-001 §A) 의 production 적용.** 한 PR 에 token + selector 한 번에.

산출물:
- PR 1 개. `feat(a11y): focus-visible 표준화 — WCAG 2.2 #2.4.13 통과`.
- 변경 파일: `assets/css/style.css` (token + 공통 mixin selector) 만.
- 18 컴포넌트 모두 자동 반영 (selector 만으로).

### 2. 이유 (왜 지금)

- spec 이 D-2026-05-31-001 에 완성된 후 의존 작업.
- 변경 위험 낮음 (visual additive — outline 만 추가, layout shift 없음).
- WCAG 2.2 #2.4.13 a11y 부채를 한 번에 청산.

### 3. acceptance criteria

- [ ] `assets/css/style.css` 의 `:root` 에 `--ring-color` · `--ring-color-on-dark` · `--ring-width` · `--ring-offset` · `--ring-style` 5 토큰 추가.
- [ ] `:where(...)` 공통 selector + dark context override 적용.
- [ ] 18 컴포넌트 (spec §A-3) 모두 visible focus ring — Chrome · Safari 16+ · Firefox 121+ 검증.
- [ ] iOS Safari 의 hit-test 영향 0 (§171·§171-C lock 항목 회귀 X — selftest 통과).
- [ ] Lighthouse a11y score 95+ 유지 (목표 +5 점 개선).
- [ ] Bundle delta < 1 KB (token 5 + mixin 1 + override 1).
- [ ] PR 에 measure 동봉 (before/after Lighthouse · WebPageTest filmstrip).

### 4. estimate 회신 요청

D-2026-05-31-001 이 ✓ 된 후 24 시간 이내. (로즈 spec 화요일 EOD 가정 → 알렉스 estimate 수요일 EOD.)
ship target: 금요일 (2026-06-05) EOD.

### 5. 참고

- linked spec — `D-2026-05-31-001-focus-ring-spec-rose.md` (§A 가 정확한 sourcing).
- `site/_experts/expert_frontend_engineer_reference.md` §5 (iOS hardening).
- §171·§171-C selftest — `site/_iostest/` (회귀 검증).
- CI 가 자동 deploy — push 후 60 초 라이브.

### 6. 디펜던시

```
D-2026-05-31-001 (로즈 spec ✓)
       │
       ▼
D-2026-05-31-002 (이 dispatch · 알렉스 구현)
       │
       ▼
D-2026-06-XX-XXX (메이 인터뷰 5명 — 별도 발신 예정)
```

알렉스는 D-001 의 status 가 `done` 으로 바뀌면 자동 unblock — 데이빗 옥이 알림.

— 데이빗 옥 · 2026-05-31

---

## § A · owner 의 회신 영역 (알렉스가 채워주세요)

### A-1. estimate (D-001 ✓ 후)
**예상 시간:** _____
**시작:** _____
**1차 PR ready:** _____
**ship target:** 2026-06-05

### A-2. 가정
- 로즈 spec 의 selector list 가 정확.
- §171·§171-C selftest 가 회귀 안 잡음.
- ___

### A-3. risk
- (있다면) ___

### A-4. PR 링크 (작업 시작 후)
- _____

---

**End of Dispatch D-2026-05-31-002** · 발신 데이빗 옥 · 2026-05-31
