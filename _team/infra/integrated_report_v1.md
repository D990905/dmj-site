# Infra Trio — 통합 보고 v1 [LOCKED]

| 항목 | 내용 |
|---|---|
| 발신 | 인프라 #9 Dashboard (Envoy this thread) |
| 수신 | 의장 옥덕필 (Danny) |
| 일자 | 2026-05-31 |
| 상태 | **🔒 LOCKED** — 셋 동의 완료 (Single Envoy 영구 룰 첫 라이브 적용) |

---

## 1. TL;DR (의장 30초 결정용)

🟢 **셋 동의 완료**: 8 합의 + Single Envoy 영구 룰
🟡 **의장 액션 필수 1건**: SQL 파일 unblock (아래 §2)
🟢 **그 외**: sprint 자동 가동. 의장 추가 결정 0.

> ▶ **결정 요청**: 의장 데스크탑 복귀 시 ① cp 명령 1회 또는 ② #10 sandbox mount 1회 승인. 둘 중 어느 쪽이라도 가능하면 트리오 sprint 즉시 unblock.

---

## 2. 🟡 의장 액션 필수 1건 — SQL freeze unblock

**현황**: #10 의 SQL `0001~0006` 은 본인 sandbox `outputs/sql/` 에 작성 완료. 단 repo `site/_experts/sql/` 에 land 하려면 의장 데스크탑 1회 동작 필요 (모바일 불가).

**옵션**:

| # | 액션 | 소요 | 효과 |
|---|---|---|---|
| (a) | 의장 데스크탑 복귀 시 `cp` 명령 1회 (#10 이 정확한 명령 1줄 제공) → commit | 1분 | 즉시 unblock, 일회성 |
| (b) | 다음 데스크탑 세션에서 #10 sandbox 의 site 경로 mount 1회 승인 | 30초 | #10 향후 모든 작업 자동 commit 가능 (구조적) |

권장: **(b)** — 구조적 해결, #10 반복 unblock 비용 0.

---

## 3. 🟢 합의된 8 항목 (LOCKED)

| # | 항목 | 합의 내용 |
|---|---|---|
| ① | 책임 경계 | #9 surface (입력·상태변경 X) · #10 SoT (상태 머신·큐·기록) · #11 broker (dispatch·보고 수집) |
| ② | Envoy rotation | 안건 owner 가 Envoy. 영구 룰. 이번 thread = #9, 다음: schema=#10, dispatch=#11, "+새지시"=#9, state debug=#11 |
| ③ | Infra 채널 | `site/_team/infra/discuss.md` append-only. git history = archive |
| ④ | Data Contract 42h freeze | 24h #9 draft → 12h #10 검토 → 6h #11 컬럼 매핑 → freeze |
| ⑤ | Source of truth | GitHub Issues 1차 · Supabase mirror · `dashboard-state.json` primary surface. Realtime cutover = Phase B (1-2주 후) |
| ⑥ | 첫 가시 산출물 | dashboard "+새지시" → GitHub Issue 자동 → 트리오 dispatch. 작동하면 Phase 1 = done |
| ⑦ | ETag 캐싱 | `~/dev/orchestrator-workspace/.orchestrator/etag.cache` 로컬 파일. daemon 재시작 보존 + rate limit 절약 |
| ⑧ | state.json dual publish | (a) primary = `/admin/dashboard/dashboard-state.json` repo commit + Pages serve (모바일 포함), (b) optional = `localhost:8765/state` dev hot-loop. dashboard hostname 분기 |

추가: **Single Envoy 영구 룰** — 안건 owner 1인만 의장께 보고. 나머지 둘은 "대표는 X" 한 줄. 모든 thread 영구 적용.

---

## 4. 🟢 Phase 1 sprint plan

T=0: 의장 SQL unblock 답 (§2) — 그 시점부터 카운트

| Hour | 담당 | 작업 | 산출물 | 차단 조건 |
|---|---|---|---|---|
| T+0 | #10 | SQL `0001~0006` freeze + commit | `site/_experts/sql/` | 의장 §2 unblock |
| T+6 | #11 | `dashboard_state_schema_v0.md` 발행 (state.json 필드 + #10 컬럼 매핑) | `_team/infra/dashboard_state_schema_v0.md` | #10 SQL |
| T+24 | #11 | `state_projection_loop` 폴링 daemon prototype (30s · label filter · ETag · dual publish) | `orchestrator/src/state_projection.py` | #10 schema |
| T+24 | #9 | dashboard read view + "+새지시" form live | `admin/dashboard/app.js` + `styles.css` | **이미 사전작업 완료, push 만 남음** |
| T+~48 | trio | Phase 1 done 검증: "+새지시" 클릭 → GitHub Issue → daemon dispatch → state.json 갱신 → dashboard 반영 | E2E 라이브 데모 | 자동 |

**병행 사전작업 완료/진행 중**:
- ✓ (d) #9 "+새지시" form draft + URL 7KB fallback — `app.js`
- ✓ (e) #9 state.json read view + hostname 분기 fetch — `app.js`
- ✓ (f) #9 의장 통합 보고 패키지 — **이 문서**
- ⏳ (a) #11 `state_projection.py` spec 초안
- ⏳ (b) #11 `dashboard_state_schema_v0.md` 골격
- ⏳ (c) #11 `_team/infra/discuss.md` 신규

---

## 5. ★ Persona Bible 추가 entry

`site/_team/team_personas.md` §14 (line 746) 에 인프라 트리오 풀 persona 이미 존재 — 추가 작업 0.

Slack/Notion 공지용 요약 (필요 시 의장 paste):

```
★ 인프라 #9·#10·#11 — Orchestration Trio
  #9  Dashboard  · 의장 surface · 시각화 (Cytoscape.js mindmap, PWA, mobile-first)
  #10 Backend   · 상태 머신·큐·기록 (Supabase + GitHub Issues hybrid)
  #11 Daemon    · directive 자동 dispatch + 보고 수집 (polling, dual publish)

운영:
  - Single Envoy: 안건 owner 1인이 의장께 보고. 나머지 둘은 "대표는 X" 한 줄
  - Envoy rotation by topic: schema=#10 · dispatch=#11 · surface/"+새지시"=#9 · state debug=#11
  - Infra 채널: _team/infra/discuss.md append-only
  - 무응답 = 동의 (24h)

데이빗 부재 동안 인프라가 dispatch 자동화. 부활 시 backend supporting role 전환.
```

---

## 6. 의장 결정 요청 (단답)

| # | 안건 | 권장 | 비고 |
|---|---|---|---|
| ⓐ | 8 합의 + Single Envoy 룰 + sprint plan 채택 | Yes | 셋 이미 동의, 의장 confirm 만 |
| ⓑ | §2 SQL unblock 옵션 — (a) cp 명령 / (b) mount 승인 | (b) | 구조적 해결 |
| ⓒ | 추가 의장 액션 = 없음 (참고용) | — | sprint 자동 가동 |

ⓐ·ⓑ 답 도착 시 → T=0 가동 → 42h 후 Phase 1 done.

---

## 7. Phase 2 / B preview (참고만)

- Phase B (T+1~2주): Supabase Realtime cutover. polling → realtime channel. 30s lag → <1s.
- Phase 2 (T+2주~): "+새지시" Cloudflare Worker (in-app submit, GitHub UI 거치지 않음) · Google SSO · mobile push notification.
- Phase 3: 승인 큐 active actions.

데이빗 옥 부활 진단 = 인프라 외부. 의장 / Coach 결정 영역.

---

— 인프라 #9 Dashboard (Envoy this thread) · 2026-05-31

**합의 chain archive**: `_team/infra/discuss.md` (#11 이 생성 + append 책임)
**다음 thread Envoy**: schema = #10
