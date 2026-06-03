---
dispatch_id: D-2026-06-02-010
task: topbar-button-handlers-fix
owner: 인프라 #9 (Dashboard surface)
sender: 데이빗 옥 (CoS) · authority = 옥대표님 6/2 직접 지시 (폰 실사용 피드백)
status: dispatched (estimate 회신 대기)
created: 2026-06-02
priority: P2 (거울 사용성 — 배포 비차단)
linked: [admin/dashboard/app.js · index.html topbar]
---

# 📩 Dispatch · D-2026-06-02-010 · topbar 헤더 버튼 무반응 fix

---

## #9 에게,

요청: `admin/dashboard/` 헤더(topbar)의 click 핸들러 미연결 버튼 일괄 점검·수정.

이유: 옥대표님이 폰에서 거울 실사용 중 발견 — PROTOTYPE 옆 헤더 버튼들이 다 무반응입니다. 노드 탭(side panel)은 정상 작동하므로 전역 JS 실패는 아니고, topbar 핸들러 바인딩 누락으로 보입니다.

데이빗 grep 진단 (근거):
- ✓ `refreshBtn` (↻) — `app.js` L752 에 click 핸들러 **있음** (작동 정상일 것)
- ⚠️ `chatToggleBtn` (💬) — 함수(`getChatToggleBtn`, openChat/closeChat) 정의는 있으나 `.addEventListener` 바인딩 grep 미검출
- ⚠️ `filterBtn` (⚙) · `notifBtn` (알림) · `dannyAvatar` (D) — 핸들러 바인딩 grep 미검출

→ 즉 버튼 element 는 `index.html` L25-31 에 다 있는데 app.js 의 click 바인딩이 일부만 연결됨.

acceptance criteria:
- 각 헤더 버튼 click 동작 연결 (chat panel 토글 / filter / notif / 옥대표님 avatar panel)
- **state-only 모드 graceful** — 쓰기 동작(있다면)은 6/15 directive loop 까지 비활성이되, 보기·토글 동작(패널 열기 등)은 지금 작동해야 함
- 노드 탭(side panel) 회귀 0
- DavidBanner X(`#davidBannerClose`)는 별건으로 로즈 D-009 에 분리 — 단 같은 바인딩 섹션이면 #9 가 함께 잡아도 OK (로즈와 sync)

estimate 회신 요청: 본인 페이스 (state-only daemon idle 중이라 surface 작업 여유).

참고:
- `admin/dashboard/index.html` L19-41 (topbar + david-banner)
- `admin/dashboard/app.js` L752 (refreshBtn 패턴 참조) · L1211~ (chat 함수)

— 데이빗 옥 (CoS) · 2026-06-02 22:45 KST

---

## § 본인 회신 영역
- [ ] ✓ 진행 — topbar 핸들러 일괄 점검
- estimate: _____

**End of Dispatch D-2026-06-02-010** · 데이빗 옥 · 2026-06-02
