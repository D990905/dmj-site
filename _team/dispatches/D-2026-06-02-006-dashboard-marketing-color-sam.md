---
dispatch_id: D-2026-06-02-006
task: dashboard-marketing-color-check
owner: 샘 정 (Sam Jung) — DataViz Specialist #2
sender: 캔 최 (Ken Choi) · authority = 데이빗 옥 CoS 6/2 13:01 chain unblock
status: **hold** (parent D-004 hold 유지 by 데이빗 CoS 13:02:30·13:04:00 channel directive — #9 surface architecture spec publish 대기) → estimate 회신 보류
estimate: TBD (Sam 측 산출 — #9 spec link 받은 후)
due: 2026-06-05 (금) → revisit after #9 spec ETA
created: 2026-06-02
last_update: 2026-06-02
linked: [D-2026-06-01-004 (parent spec), D-2026-06-02-005 (Alex impl)]
priority: P2
phase: Phase 2 design check
---

# 📩 Dispatch · D-2026-06-02-006 · Dashboard Marketing T2·T5 차트 색·data-honesty 검수

---

## 샘에게,

요청: #9 dashboard 의 marketing tile T2 (채널 KPI 5장) + T5 (베타 funnel) 차트 색·encoding 검수 + 권장 fix.

이유: 5채널 follower 성장 (T2) + 베타 funnel drop-off (T5) 는 옥대표님의 의사결정 지표 — lie factor 0 이어야 함. 4 채널이 같은 자릿수 (예: 1k vs 2k) 일 때 sequential anchor 색 차이가 misleading 가능. Sam data-honesty fundamental 본능 필요.

acceptance criteria:
- T2 baseline=0 ✓ 검증 (auto vs absolute)
- T2 5채널 sequential OKLCH (5 anchor 보간) — `visual_designer_brand_color_spec.md §3` 정합
- T5 funnel drop-off % overlay — 신뢰구간 (estimate vs measured flag, 6/2 12:45 본인 entry 정합)
- WCAG 2.2 #1.4.3 contrast ≥ 4.5:1
- "한 화면 3 차트 룰" — T2 + T5 = 2 chart, T3 (queue list) 까지 3 — OK
- prefers-reduced-motion 대응 (animation 없는 fallback)

estimate 회신: 오늘 내 또는 본인 페이스로. 본인 영역 자율.

참고:
- `_team/dispatches/D-2026-06-01-004-dashboard-marketing-tile-spec-ken.md` §A-2 (T2 · T5 JSON contract)
- `_experts/visual_designer_brand_color_spec.md §3` (OKLCH 5 anchor)
- Tufte VDQI p.74 (lie factor)
- 본인 6/2 12:45 entry §3 의 "estimate→measured 시각 인코딩 dash→solid" — T5 funnel drop-off 의 신뢰도 시각화에 직접 적용 가능

emotion target: trust (의장이 KPI 보고 "이 숫자 정확한가?" 의심 없게)

— Ken Choi · 2026-06-02 13:06:00 KST

---

## § A · Ken 측 ready 자료

- T2 5채널 raw data shape (D-004 §A-2 의 channels array)
- T5 funnel 5 단계 (applied → trial → active → first session → ...)
- 베타 source = 카카오 form (Phase 1) → Notion DB (Phase 2)

→ **Sam 본인 영역**: estimate flag (Phase 1 mock data) vs measured flag (베타 신청 실측) 명시. 라이브 데이터 부재 시 점선·CI 처리 (본인 standby 신호 §2 정합).

---

## § B · 본인 회신 영역

### B-1. estimate
**예상 시간:** _____
**시작:** _____
**1차 review ready:** _____

### B-2. 권장 수정 (있다면)
- _____

### B-3. ✓ 또는 reject
- [ ] ✓ T2·T5 spec 진행 OK
- [ ] ⚠ 권장 수정 후 진행 (의견: _____)
- [ ] ✗ reject (이유: _____)

### B-4. 협업 노트
- "estimate→measured flag" 의 시각 인코딩 (점선·실선)을 T5 funnel 에도 적용할지 — 본인 standby 의견 듣고 싶음.

---

**End of Dispatch D-2026-06-02-006** · Ken Choi · 2026-06-02 📊
