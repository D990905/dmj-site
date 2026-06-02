---
dispatch_id: D-2026-06-02-007
task: dashboard-marketing-wireframe
owner: 메이 한 (May Han) — UX Research Director #5
sender: 캔 최 (Ken Choi) · authority = 데이빗 옥 CoS 6/2 13:01 chain unblock
status: **hold** (parent D-004 hold 유지 by 데이빗 CoS 13:02:30·13:04:00 channel directive — #9 surface architecture spec publish 대기) → estimate 회신 보류 (단, §B-4 백업 routine 합의는 별도 ping 가능)
estimate: TBD (메이 측 산출 — #9 spec link 받은 후)
due: 2026-06-12 (금) — Phase 3 (Alex 1차 ship 후 인터뷰) → revisit after #9 spec ETA
created: 2026-06-02
last_update: 2026-06-02
linked: [D-2026-06-01-004 (parent spec), D-2026-06-02-005 (Alex impl)]
priority: P3 (Phase 3 인터뷰 — D-005 ship 후)
phase: Phase 3 user research
---

# 📩 Dispatch · D-2026-06-02-007 · Dashboard Marketing surface 정보 위계 + 5명 인터뷰

---

## 메이 디렉터에게,

요청: #9 dashboard 의 marketing 6 tile 정보 위계 wireframe + 의장 mental model 인터뷰 5명.

이유: 6 tile (T1 D-day · T2 KPI · T3 queue · T4 brand voice grep · T5 funnel · T6 결정) 의 우선순위·시선 path 를 옥대표님이 어떻게 stretch 할지 모름. Alex (D-005) 가 layout 결정 전에 메이의 user data 가 필요. **데이터 없이 "이 위치가 좋아 보임" 결정 = decision-without-data 위험**.

acceptance criteria:
- wireframe sketch 또는 Figma (mobile 320px + desktop 1440px 2 viewport)
- 5+ user interview — 옥대표님 본인 + 의장 가까운 1-2명 + (가능 시) 데이빗·로즈·알렉스 cross-persona
- Nielsen 10 heuristic severity (S0–S3) 등급 per tile
- 정보 위계 권장 (예: D-day 가 가장 위? KPI 가 가장 큰? grep alert 가 red 일 때만 prominent?)
- mental model 검증: "이 tile 보면 무슨 액션 하시겠어요?" 응답 정리
- onboarding 영향 평가 (의장 처음 보는 시점 vs 익숙해진 시점 분리)

estimate 회신: 다음 주 금요일 (6/12) 까지 (인터뷰 3일 + analysis 2일). 본인 페이스로 자율.

참고:
- `_team/dispatches/D-2026-06-01-004-dashboard-marketing-tile-spec-ken.md` §A-1·§A-2 (6 tile 구조)
- `_experts/expert_ux_researcher_reference.md §3` (heuristic + interview protocol)
- `marketing/campaign_plan_first30days.md §8` (33일 KPI dashboard — 의장이 어떤 decision 을 dashboard 에서 트리거하나)

emotion target: confidence (의장이 dashboard 보고 "지금 뭘 결정해야 하는지 알겠다" 느낌)

— Ken Choi · 2026-06-02 13:07:00 KST

---

## § A · Ken 측 ready 자료

- 6 tile spec (D-004 §A) + JSON contract (T1-T6)
- 옥대표님 work flow 추정 (Cowork session ↔ 카톡 ↔ dashboard) — 메이 인터뷰로 검증
- 본인 dispatch tracking 협업 인터페이스 (operations_setup §7 백업 routine)

→ **메이 본인 영역**: 인터뷰 questions 본인 자율 설계. 본인 시그니처 "유저 5명 안 만나면 결정 못 함" 본능 활용.

---

## § B · 본인 회신 영역

### B-1. estimate
**예상 시간 (인터뷰 + analysis):** _____
**시작:** _____
**1차 wireframe ready:** _____
**5명 인터뷰 완료:** _____
**최종 권장 ship:** _____

### B-2. 권장 수정 (있다면)
- _____

### B-3. ✓ 또는 reject
- [ ] ✓ 6 tile spec 인터뷰 진행 OK
- [ ] ⚠ 권장 수정 후 진행 (의견: _____)
- [ ] ✗ reject (이유: _____)

### B-4. 협업 노트 — backup routine 합의 요청

> Ken 추가 요청: operations_setup §7 의 "데이빗 부재 시 백업 owner = 메이 + 캔" 명시. 본인 영역 부담 vs 명시 분담 의향 알려주세요.
>
> Ken 분담 제안:
> - **Ken** = 외부 응대 (4 brand 본사·동호회·이벤트) + 매일 18:00 status post `#decisions` Slack
> - **메이** = 회의록 (월·수·금 standup) + Notion `#decisions` archive + dispatch tracking
>
> 본인 동의·수정·반대 — 한 줄 회신 부탁드립니다 😊

---

**End of Dispatch D-2026-06-02-007** · Ken Choi · 2026-06-02
