---
dispatch_id: D-2026-06-02-005
task: dashboard-marketing-tile-impl
owner: 알렉스 박 (Alex Park) — Frontend Engineer #4
sender: 캔 최 (Ken Choi) · authority = 데이빗 옥 CoS 6/2 13:01 chain unblock
status: open · estimate 회신 대기
estimate: TBD (Alex 측 산출)
due: 2026-06-05 (금, 6/6 울산 대회 전)
created: 2026-06-02
last_update: 2026-06-02
linked: [D-2026-06-01-004 (parent spec by Ken), D-2026-06-02-006 (Sam color), D-2026-06-02-007 (메이 wireframe)]
priority: P2 (P1 = 6/3 launch + 6/6 울산)
phase: Phase 2 implementation (D-004 spec → admin/dashboard/* 적용)
---

# 📩 Dispatch · D-2026-06-02-005 · Dashboard Marketing tile 구현

---

## 알렉스에게,

요청: `admin/dashboard/` 에 D-2026-06-01-004 §A 의 marketing 6 tile 구현 + Lighthouse measure.

이유: 6/3 dmjgroup.kr launch + 6/6-7 울산 진하 대회의 현장 KPI (친구추가·베타 신청·콘텐츠 reach) 가 #9 dashboard 에 잡혀야 옥대표님 한눈에 view. 데이빗 CoS 가 D-004 ✓ 승인 (6/2 13:01) → chain auto-unblock.

acceptance criteria:
- Lighthouse 90+ 유지 (현 dashboard `app.js` 1,115 라인 + γ 4 PR 적용 base)
- bundle delta < 15KB (T1-T6 6 tile 추가)
- vanilla JS · no new framework (본인 선호 정합)
- iOS Safari 16+ · Chrome 111+ 통과
- mobile 320px 폭 OK (옥대표님 휴대폰 view)
- 60fps tile transitions (priority lane 패턴 reuse)
- empty state graceful (Phase 1 source 부재 시 깨지지 않음)
- T4 (brand voice 금기어 grep alert) 의 fetch는 daemon side coroutine 결과 JSON polling — 본인 영역은 fetch + render 만, regex 매칭은 인프라 #11 영역

estimate 회신 요청: 화요일 (6/3) EOD 또는 deep work block (10-12시 KST) 후. 본인 영역 자율.

참고:
- `_team/dispatches/D-2026-06-01-004-dashboard-marketing-tile-spec-ken.md` §A-2 (6 tile JSON contracts)
- 현 dashboard base = `admin/dashboard/` (γ 4 PR 적용 후 — DecisionFeed · PriorityLane · DavidBanner · PersonaPanel)
- 시스템 A 토큰 reuse (신규 토큰 0건 권장 — 로즈 γ 적용 결과 정합)
- WCAG 2.2 #1.4.3 contrast 4.5:1 (T2·T5 차트는 D-006 Sam 검수 결과 받음)
- `marketing/brand_voice_KR_EN.md §6` self-check 5축 (T4 의 auto_grep_patterns 11개)

emotion target: clarity (의장 한눈에 view = 6 tile 이 한 화면 안에서 noise 최소화)

— Ken Choi · 2026-06-02 13:05:00 KST

---

## § A · Ken 측 ready 자료

- D-004 §A-2 의 6 tile JSON contract 그대로 구현 spec
- D-006 (Sam) 결과 = T2·T5 차트 색·baseline·lie factor 검증 → 본인 받으면 T2·T5 render 진행
- D-007 (메이) 결과 = 6 tile 정보 위계 wireframe → 본인 받으면 layout 최종 결정

→ **Alex 본인 영역 결정**: 즉시 4 tile (T1·T3·T4·T6) source-light 부분부터 시작 vs 메이 wireframe 받고 6 tile 동시 진행. 본인 판단 자율.

---

## § B · 본인 회신 영역

### B-1. estimate
**예상 시간:** _____
**시작:** _____
**1차 review ready:** _____
**ship:** _____

### B-2. 권장 수정 (있다면)
- _____

### B-3. ✓ 또는 reject
- [ ] ✓ D-004 §A spec 진행 OK — T1-T6 6 tile 구현
- [ ] ⚠ spec 수정 권장 (의견: _____)
- [ ] ✗ reject (이유: _____)

### B-4. 협업 노트
- Sam (D-006) 의 색 검증 결과 의존 시점·메이 (D-007) wireframe 의존 시점 명시 부탁드립니다.

---

**End of Dispatch D-2026-06-02-005** · Ken Choi · 2026-06-02
