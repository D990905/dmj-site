---
dispatch_id: D-2026-06-02-009
task: davidbanner-close-handler-fix
owner: 로즈 윤 (Rose Yoon) — Visual Design Director #1
sender: 데이빗 옥 (CoS) · authority = 옥대표님 6/2 직접 지시 (폰 실사용 피드백)
status: dispatched (estimate 회신 대기)
created: 2026-06-02
priority: P2 (거울 사용성 — 배포 비차단)
linked: [DavidBanner = 로즈 γ PR 3 (David Offline Banner)]
---

# 📩 Dispatch · D-2026-06-02-009 · DavidBanner X(닫기) 버튼 무반응 fix

---

## 로즈 디렉터에게,

요청: 본인 γ PR 3 (David Offline Banner)의 **X 닫기 버튼(`#davidBannerClose`) 무반응** fix.

이유: 옥대표님이 `dmjgroup.kr/admin` 거울을 폰에서 실사용하시다 직접 발견하셨습니다 — 상단 "복구 ETA" 옆 X 를 눌러도 배너가 안 닫힙니다. 거울 첫 실사용 피드백이라 우선 정리가 필요합니다.

데이빗 grep 진단 (근거):
- `index.html` L40 — `<button id="davidBannerClose" ...>×</button>` 존재 ✓
- `app.js` L1043 — "PR 3: David Offline Banner ... sessionStorage 로 dismiss 가능" 주석 존재
- 그러나 `davidBannerClose` 에 `addEventListener('click', ...)` **바인딩이 grep 에 안 잡힘** → 핸들러 미연결 추정

acceptance criteria:
- X 클릭 시 배너 dismiss (PR 3 주석의 sessionStorage 의도대로 — 세션 내 재노출 방지)
- 시각 회귀 0 (배너 레이아웃·토큰 변화 없음)
- a11y 유지 (`aria-label="배너 일시 숨김"` 보존, focus 복귀)
- 본인 영역(visual/component)이 아니라 순수 JS 핸들러면 알렉스(#4)에 핸드오프 OK — 본인 판단

estimate 회신 요청: 본인 페이스 (Visual 영역은 외부 dispatch sync 의존이라 일정 자율).

참고:
- `admin/dashboard/index.html` L36-41 (david-banner 블록)
- `admin/dashboard/app.js` L1043~ (PR 3 섹션)

— 데이빗 옥 (CoS) · 2026-06-02 22:45 KST

---

## § 본인 회신 영역
- [ ] ✓ 진행 (본인 PR 3 영역)
- [ ] → 알렉스(#4) 핸드오프 (순수 JS 바인딩이므로)
- estimate: _____

**End of Dispatch D-2026-06-02-009** · 데이빗 옥 · 2026-06-02
