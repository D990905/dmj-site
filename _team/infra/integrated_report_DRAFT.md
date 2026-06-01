# Infra Trio — 통합 보고 v1 [DRAFT · awaiting #10 ⑧ lock]

| 항목 | 내용 |
|---|---|
| 발신 | 인프라 #9 Dashboard (Envoy this thread) |
| 수신 | 의장 옥덕필 (Danny) |
| 일자 | 2026-05-31 |
| 상태 | **DRAFT** — #10 ⑧ 명시 동의 또는 24h 무응답=동의 시점에 lock |
| 목적 | 인프라 #9·#10·#11 셋의 합의 8 항목 + Phase 1 sprint plan 을 의장께 1통으로 보고 (Single Envoy 영구 룰 첫 적용) |

---

## 1. TL;DR (의장 30초 결정용)

3 합의 8 항목 lock 완료. 첫 Phase 1 sprint 출발 준비됨. **의장 결정 1건** 만 필요:

> ▶ **8 합의 + sprint plan 채택**: yes / no / 수정

yes 시: 42h 안에 Data Contract freeze → "+새지시" working demo (Phase 1 done 기준).

---

## 2. 합의된 8 항목

| # | 항목 | 합의 내용 |
|---|---|---|
| ① | 책임 경계 | #9 surface (입력·상태변경 X) · #10 SoT (상태 머신·큐·기록) · #11 broker (dispatch·보고 수집) |
| ② | Envoy rotation | 안건 owner 가 Envoy. 영구 룰. 이번 thread = #9, 다음: schema=#10, dispatch=#11, "+새지시"=#9, state debug=#11 |
| ③ | Infra 채널 | `site/_team/infra/discuss.md` append-only. git history = archive |
| ④ | Data Contract 42h freeze | 24h #9 draft → 12h #10 검토 → 6h #11 컬럼 매핑 → freeze |
| ⑤ | Source of truth | GitHub Issues 1차 · Supabase mirror · `dashboard-state.json` primary surface. Realtime cutover = Phase B (1-2주 후) |
| ⑥ | 첫 가시 산출물 | dashboard "+새지시" → GitHub Issue 자동 → 트리오 dispatch. 작동하면 Phase 1 = done |
| ⑦ | ETag 캐싱 | `~/dev/orchestrator-workspace/.orchestrator/etag.cache` 로컬 파일. daemon 재시작 보존 + rate limit 절약 |
| ⑧ | state.json dual publish | (a) primary = `/admin/dashboard/dashboard-state.json` repo commit + Pages serve, (b) optional = `localhost:8765/state` dev hot-loop. dashboard hostname 분기 |

---

## 3. Phase 1 sprint plan (정밀 일정)

T=0: 셋 합의 lock + 의장 채택 답변

| Hour | 담당 | 작업 | 산출물 | Status |
|---|---|---|---|---|
| T+0 | #10 | SQL `0001~0006` freeze + commit | `site/supabase/migrations/orch/` | 대기 (T=0 즉시) |
| T+6 | #11 | `dashboard_state_schema_v0.md` 발행 (state.json 필드 + #10 컬럼 매핑) | `_team/infra/dashboard_state_schema_v0.md` | 사전작업 진행 중 (골격) |
| T+24 | #9 | dashboard read view + "+새지시" form draft | `admin/dashboard/app.js` + `index.html` | **이미 완료** (사전작업 publish 완료) |
| T+24 | #11 | `state_projection_loop` 폴링 daemon prototype (30s · label filter · ETag · dual publish) | `orchestrator/src/state_projection.py` | 사전작업 진행 중 (spec 초안) |
| T+42 | trio | Data Contract freeze 합의 확인 + #9 통합 보고 v2 (lock complete) | `_team/infra/integrated_report_v2.md` | 자동 |
| T+~48 | trio | Phase 1 done 기준 검증: "+새지시" 클릭 → GitHub Issue → daemon dispatch → state.json 갱신 → dashboard 반영 | E2E 라이브 데모 | 자동 |

**병행 사전작업 (#9·#11 이미 시작, 의장 승인 받음)**:
- (d) #9 "+새지시" form draft + URL 7KB fallback — **완료**
- (e) #9 state.json read view + hostname 분기 fetch — **완료**
- (f) #9 의장 통합 보고 패키지 draft — **이 문서**
- (g) #11 `state_projection.py` spec 초안 — 진행 중
- (h) #11 `dashboard_state_schema_v0.md` 골격 — 진행 중
- (i) #11 `_team/infra/discuss.md` 신규 + 정렬 사슬 archive — 진행 중

---

## 4. First task 배정 (lock 직후 즉시 가동)

| 담당 | 첫 작업 | ETA | 차단 조건 |
|---|---|---|---|
| #10 Backend | SQL `0001~0006` freeze commit + 컬럼 정의 publish | 즉시 (T=0) | 없음 |
| #11 Daemon | `state_projection_loop` 폴링 daemon + dual publish writer | T+24 (#10 schema 도착 후 6h) | #10 schema |
| #9 Dashboard | "+새지시" form live wire + state.json fetch live 테스트 | 사전작업 완료, 도착 즉시 live | #11 state.json file |
| Envoy this thread | 통합 보고 v2 (lock complete) | T+42 | 셋 합의 |

---

## 5. ★ Persona Bible 추가 entry (인프라 트리오 풀 description)

> **참고**: `site/_team/team_personas.md` §14 (line 746) 에 인프라 트리오 풀 persona 항목 이미 존재. kickoff 공지문 파일화는 별도 의장 결정 안건 (이전 보류 — Single Envoy 룰 강화로 thread 분리 진행).

요약 entry (Slack/Notion 공유용):

```
★ 인프라 #9·#10·#11 — Orchestration Trio
  #9  Dashboard  · 의장 surface · 시각화 (Cytoscape.js mindmap, PWA, mobile-first)
  #10 Backend   · 상태 머신·큐·기록 (Supabase + GitHub Issues hybrid)
  #11 Daemon    · directive 자동 dispatch + 보고 수집 (polling, dual publish)

운영 원칙:
  - Single Envoy: 안건 owner 1인이 의장께 보고. 나머지 둘은 "대표는 X" 한 줄
  - Envoy rotation by topic: schema=#10 · dispatch=#11 · surface/contract="+새지시"=#9 · state debug=#11
  - Infra 간 소통: `_team/infra/discuss.md` append-only (git history = archive)
  - 무응답 = 동의 (24h)

데이빗 부재 동안 인프라가 dispatch 자동화. 데이빗 부활 시 인프라가 backend supporting role 로 전환.
```

---

## 6. 의장 결정 요청 (단답)

| # | 안건 | 권장 |
|---|---|---|
| ⓐ | 8 합의 + sprint plan 채택 | Yes |
| ⓑ | ★ entry §5 의 형태로 Slack/Notion 에 공지 | Yes |
| ⓒ | 다음 thread Envoy 자동 rotation 룰 영구 채택 (의장 confirm) | Yes |

3개 모두 yes 면 T=0 즉시 #10 schema freeze 가동 → 42h 내 Phase 1 done.

---

## 7. Phase 2 / B preview (참고만, 의장 액션 X)

- Phase B (T+1~2주, 8 합의 안정 후): Supabase Realtime cutover. state.json polling → realtime channel subscribe. 30s lag → <1s.
- Phase 2 (T+2주 이후): "+새지시" Cloudflare Worker (in-app submit, GitHub UI 거치지 않음). Google SSO. mobile push notification.
- Phase 3: 승인 큐 active actions (승인 클릭 → backend state 변경 → daemon trigger).

데이빗 옥 부활 진단은 인프라 영역 외부. 의장 / Coach 결정 사항.

---

— 인프라 #9 (Envoy this thread) · 2026-05-31

> 이 문서는 #10 ⑧ 답 도착 또는 24h 무응답 시점에 `integrated_report_v1.md` 로 rename 되어 의장께 정식 발송됩니다.
