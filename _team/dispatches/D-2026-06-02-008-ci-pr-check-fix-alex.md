---
dispatch_id: D-2026-06-02-008
task: ci-pr-check-fix
owner: 알렉스 박 (Alex Park) — Frontend Engineer #4
sender: 데이빗 옥 (CoS) · authority = 옥대표님 6/2 직접 지시
status: dispatched (estimate 회신 대기)
created: 2026-06-02
due: 무관 (배포 비차단 — 본인 deep work block 후 자율)
priority: P2 (배포 안 막음 · static.yml 별개)
phase: Phase 2 CI hardening
linked: [pr-check.yml (본인 작성 · messages.md 12:06:30 KST)]
---

# 📩 Dispatch · D-2026-06-02-008 · pr-check.yml CI 2-job 실패 fix

---

## 알렉스에게,

요청: 본인이 작성한 `.github/workflows/pr-check.yml` 의 첫 가동에서 실패한 2 job fix → CI green.

이유: 옥대표님이 deploy 토큰에 `workflow` scope 부여 → pr-check.yml 이 드디어 첫 실행됐습니다 (commit `defc9e6`). 그 첫 run 에서 2 job 이 빨강입니다. 배포(static.yml)는 안 막지만, CI 빨강 상시 노출은 본인이 의도한 회귀 감지 가치를 약화시킵니다.

실패 내역 (옥대표님 GitHub Actions 화면 캡처 기준):
- ❌ **Broken link check (internal)** — Failed in 7s · annotations **2**
- ❌ **HTML validity check** — Failed in 20s · annotations **1**
- ✓ PR check summary — Succeeded

acceptance criteria:
- 내부 깨진 링크 2건 + HTML validity 1건 → 다음 run green
- 시각 변화 0 / 기능 변화 0 (링크 target·HTML 정합만 교정)
- fix 가 §182 류 production HTML 수정이면 DO_NOT_REVERT 주석 + 회귀 가드
- 본인 판단으로 link-check / html5validator 의 false-positive 면 룰 완화도 OK (사유 1줄)

estimate 회신 요청: 본인 deep work block (10-12시 KST) 후 자율. 배포 비차단이라 급하지 않습니다.

참고:
- GitHub Actions 로그의 annotations 3건이 정확한 위치 (파일·라인) 지목
- `.github/workflows/pr-check.yml` (본인 작성 · html-validity + link-check job)
- `_experts/frontend_mobile_hardening_audit_2026-06-02.md` (본인 audit 패턴 정합)

— 데이빗 옥 (CoS) · 2026-06-02 22:30 KST

---

## § 본인 회신 영역

### estimate
**예상:** _____ · **시작:** _____ · **ship:** _____

### ✓ 또는 reject
- [ ] ✓ 진행 — 2 job fix
- [ ] ⚠ 일부 false-positive 룰 완화 권장 (의견: _____)
- [ ] ✗ reject (이유: _____)

---

**End of Dispatch D-2026-06-02-008** · 데이빗 옥 · 2026-06-02
