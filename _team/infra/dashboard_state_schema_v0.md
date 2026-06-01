# dashboard-state.json — Schema v0 (Data Contract)

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 sprint 산출물 (8 합의 항목 ⑤·⑧ 의 implementation contract) |
| 작성 | 인프라 #11 (Daemon) — state.json builder owner |
| 검토 | 인프라 #10 (Backend) — SQL 컬럼 1:1 매핑 검증 책임 |
| 소비 | 인프라 #9 (Dashboard) — fetch + render |
| 일자 | 2026-05-31 (v0.1 — #10 SQL reference paste 도착 → fill 완료, mount 후 raw DDL cross-check) |
| 위치 | 게시 경로: `site/admin/dashboard/dashboard-state.json` (same-origin static) + `localhost:8765/state` (dev) |
| Schema 진화 | 변경은 PR 식 (#10 안 §1). top-level `schema_version` 필드로 client 가 호환 분기 |

> **읽는 법.** §1 = top-level 구조 (한눈에). §2 = 각 필드 정의 + 타입 + 예시 + #10 SQL 컬럼 매핑 (placeholder). §3 = builder 의 정규화 규칙. §4 = client (Dashboard) 의 fetch + render 가이드. §5 = 진화 정책. **#10 SQL 도착 전까지 §2 의 필드 정의는 plan 단계 — placeholder.**

---

## 1. Top-level 구조 (한눈에)

```json
{
  "schema_version": "v0.1",
  "last_updated_at": "2026-05-31T14:23:45+00:00",
  "directives": [ ... ],
  "personas": { ... },                  // key = agents.slug ('01-pm', ...)
  "pending_approvals": [ ... ],          // ★ #10 SQL 의 approvals 테이블 매핑
  "recent_decisions": [ ... ],           // ★ approvals.decided_at IS NOT NULL
  "cost": { ... },                       // daemon usage.json 만 (SQL 미존재)
  "heartbeat": { ... }                   // daemon write 만 (SQL 미존재)
}
```

**6 array/object + 2 metadata**. 모두 의장 dashboard view 의 카드/위젯으로 표시. `decisions[]` → `recent_decisions[]` 로 명명 변경 (approvals 테이블의 결정된 행만 의미하므로).

---

## 2. 필드 정의 (v0.1 — #10 SQL reference fill 완료)

### 2-1. `schema_version` · `last_updated_at`

| 필드 | 타입 | 예시 | 의미 | #10 SQL 매핑 |
|---|---|---|---|---|
| `schema_version` | string | `"v0.1"` | client 호환 분기용 | (constant — SQL 매핑 없음) |
| `last_updated_at` | string (ISO 8601 UTC) | `"2026-05-31T14:23:45+00:00"` | state.json 마지막 빌드 시점 | (computed at projection time) |

### 2-2. `directives[]` (의장 view: "지시 큐" 카드)

각 directive 가 1개 카드. `status` 별 색상. 우선순위 `priority` 별 정렬.

| 필드 | 타입 | 예시 | 의미 | **#10 SQL 컬럼** |
|---|---|---|---|---|
| `directive_id` | string (uuid) | `"a1b2c3d4-..."` | 고유 ID | `directives.id` (uuid → string serialize) |
| `title` | string | `"카드 색 변경"` | UI 제목 | `directives.title` |
| `prompt_excerpt` | string (≤200 chars) | `"카드 ___"` | 의장 view 용 truncated | `directives.prompt` truncate 200 + "…" |
| `status` | enum (6) | `"in_progress"` | 현재 상태 | `directives.status`<br>(`pending\|in_progress\|blocked\|awaiting_approval\|done\|cancelled`) |
| `priority` | enum (4) | `"p1"` | 우선순위 — **`p0` = highest urgency (lower number = more urgent)**. `p0` 가장 긴급 / `p3` nice-to-have. Jira · GitLab · Linear 표준 관례 일치. 근거: `_specs/github_issues_queue_setup.md` §4 (#9 t8c 참조). | `directives.priority` (`p0\|p1\|p2\|p3`) |
| `target_agent_slug` | string \| null | `"04-frontend"` | 담당 agent slug | join `agents.slug` via `directives.target_agent_id` |
| `created_at` | string (ISO) | `"2026-05-31T14:00:00Z"` | issue 생성 시점 | `directives.created_at` |
| `updated_at` | string (ISO) | `"2026-05-31T14:21:00Z"` | 마지막 상태 변화 | `directives.updated_at` |
| `issue_url` | string (URL) | `"https://github.com/kor22/dmj-site/issues/123"` | "원본 보기" 링크 | constructed: `https://github.com/${source_github_repo}/issues/${source_github_issue}` |
| `cost_usd` | number \| null | `0.42` | 누적 비용 | **SQL 미존재** — daemon `usage.json` 의 directive_id별 룩업 (Phase B 에서 `events` 테이블 검토) |
| `turns` | integer \| null | `8` | agent turn 수 | **SQL 미존재** — 동일 (Phase B 에서 `dispatch_runs` 테이블 추가 검토) |

**WHERE 필터**: `deleted_at IS NULL` (soft delete 제외) + RLS `is_danny()` 통과.
**ORDER BY**: `updated_at DESC` (#10 의 query reference §dashboard-relevant queries 그대로).

### 2-3. `personas` (의장 view: "agent fleet" 카드)

**key = `agents.slug`** (`'01-pm'`, `'04-frontend'`, ..., `'15-marketing'`). 한국어 이름은 `display_name` 으로.

```json
"personas": {
  "01-pm":             { ... },
  "02-...":            { ... },
  // 0006_seed_agents.sql 의 15-row roster 그대로
  "15-marketing":      { ... }
}
```

각 persona 의 상태 필드:

| 필드 | 타입 | 예시 | 의미 | **#10 SQL 컬럼** |
|---|---|---|---|---|
| `display_name` | string | `"로즈 윤"` | UI 표시 이름 | `agents.name` |
| `role` | string | `"frontend"` / `"dataviz"` / `"orchestrator"` | **primary 분류** | `agents.role` (NOT NULL, seed 의 정의된 값) |
| `domain` | string \| null | `"Visual Design"` | 의장 view 의 grouping 라벨 (optional) | **SQL 미존재** — projection 측 정적 `ROLE_TO_DOMAIN` map (예: `"frontend" → "Frontend Eng (Web)"`). seed 의 role 값 확정 후 fill. |
| `status` | enum (4) | `"active"` | 현재 상태 | `agents.status` (`idle\|active\|blocked\|offline`) |
| `current_task` | object \| null | `{id, title, status, directive_id}` | 진행 중 task | "active task per agent" query (`tasks WHERE status='in_progress' DISTINCT ON agent_id`) |
| `last_active_at` | string (ISO) | `"2026-05-31T14:20:00Z"` | 마지막 활동 | `agents.last_active` (trigger 가 자동 bump) |
| `idle_minutes` | integer | `12` | last_active 이후 경과 분 | computed: `(now() - last_active) / 60` |

**WHERE 필터**: `deleted_at IS NULL`.
**의장 view 매핑**: Persona Bible v1.2 §0 표 + §14 인프라 트리오. `infra-trio` 는 15-row seed 에 별도 행 으로 들어가는지 (예: `'11-orchestrator-daemon'`) 또는 metadata 안에 묶이는지 — **mount 후 0006_seed_agents.sql 직접 확인 필요** (§6 Q1).

> **#10 t4 정정 (Thread 002)**: 처음 `domain` 필드를 `agents.metadata->>'domain'` jsonb path 로 매핑했으나, 실제 SQL 의 `metadata jsonb DEFAULT '{}'` 는 'domain' key 보장 X (seed 도 비움). → **`agents.role` 이 primary**. `domain` 은 projection 측 정적 map 으로 대체. SQL 변경 0.

### 2-4. `pending_approvals[]` (의장 view: "승인 대기" 배지 + 리스트)

```json
{
  "approval_id": "uuid",
  "scope": "task",                          // ★ "task" | "directive" — projection 측 산출
  "task_id": "uuid | null",
  "directive_id": "uuid | null",
  "asked_by_slug": "04-frontend",
  "question": "라이브 push 전 한번 확인 부탁드립니다",
  "options": [{"label": "Approve", "value": "approve"}, {"label": "Reject", "value": "reject"}],
  "created_at": "2026-05-31T15:00:00Z",
  "age_minutes": 12
}
```

**#10 SQL 컬럼 매핑**: `approvals.{id, task_id, directive_id, asked_by_agent_id, question, options, created_at}`.
**WHERE 필터**: `decided_at IS NULL AND deleted_at IS NULL` (#10 의 query reference 그대로).
**ORDER BY**: `created_at DESC`.

> **#10 t4 정정 (Thread 002)**: 처음 `task_id` / `directive_id` 를 XOR (둘 중 하나만) 로 적었으나, 실제 SQL constraint = **OR** (둘 다 동시 존재 가능 — task 의 parent directive 명시 case). XOR 강제는 schema 변경 + 유연성 손해 → 권장 X. **projection 측에서 `scope` 필드 분기**:
> - `task_id IS NOT NULL` → `scope = "task"` (directive_id 는 parent context, UI 에서 "task X (in directive Y)" 표시)
> - `task_id IS NULL AND directive_id IS NOT NULL` → `scope = "directive"` (UI 에서 "directive X" 단독 표시)
>
> dashboard 는 `scope` 만 보고 라벨/링크 분기. SQL 변경 0.

### 2-5. `recent_decisions[]` (의장 view: "최근 결정 5건" 위젯)

approvals 테이블의 **결정된 행** 만 (decided_at IS NOT NULL).

```json
{
  "approval_id": "uuid",
  "question": "라이브 push 전 한번 확인",
  "decision": "approve",
  "decided_at": "2026-05-31T15:00:00Z",
  "decided_by_email": "kor22@me.com",     // resolved from decided_by uuid via auth.users
  "source": {"directive_id": "uuid" | null, "task_id": "uuid" | null}
}
```

**#10 SQL 컬럼 매핑**: `approvals.{id, question, decision, decided_at, decided_by, directive_id, task_id}`.
**WHERE 필터**: `decided_at IS NOT NULL AND deleted_at IS NULL`.
**ORDER BY**: `decided_at DESC LIMIT 5`.
**operations_setup.md §2 `#decisions` Notion 페이지 sync**: §6 Q3 으로 별도 결정.

### 2-6. `cost` (의장 view: "비용" 위젯)

SQL 미매핑. `orchestrator/src/cost.py` 의 `UsageSnapshot` 그대로:

```json
{
  "day_total_usd":    1.23,
  "month_total_usd":  18.45,
  "month_cap_usd":    50.00,
  "month_remaining_usd": 31.55,
  "last_dispatch_usd": 0.42
}
```

(5 필드 모두 daemon 의 `~/.config/orchestrator/usage.json` 직접 읽음. Phase B 검토: SQL `events` 테이블 추가 시 집계 가능.)

### 2-7. `heartbeat` (의장 view: "데몬 살아있나" 표시등)

SQL 미매핑. daemon 만 write.

```json
{
  "daemon_alive": true,
  "last_heartbeat_at": "2026-05-31T14:23:30Z",
  "stale_seconds": 15,
  "mode": "full"           // "deploy-only" | "full"
}
```

`stale_seconds > 300` (5분) → dashboard 가 빨간 표시 + 의장께 알림.

---

## 3. Builder 정규화 규칙 (#11 책임)

**Phase 1 source**: GitHub Issues (라벨 `directive`, body 의 ```json``` 블록).
**Phase B source**: Supabase Realtime subscription (위 §2 의 SQL 컬럼 그대로). **state.json 구조는 양쪽 동일** — client 변경 0.

### 3-1. Phase 1 builder (Issues parse)

1. **Issue body 의 ```json``` 블록 parse** — 첫 번째 fenced block 만 유효. JSON 실패 시 해당 directive 누락 + log warning.
2. **Status comment 의 ```json``` 블록 parse** — 마지막 comment 의 fenced block 이 현재 상태 (state). 여러 comment 있으면 latest only.
3. **status 산출** — 라벨 우선순위: `error` > `done` > `in_progress` > `pending`. SQL 의 `awaiting_approval`·`blocked`·`cancelled` 는 Phase 1 단계에서 미사용 (Phase B 도입).
4. **`directives[].target_agent_slug`** — issue body json 의 `specialist` 필드를 slug 로 매핑 (`'frontend'` → `'04-frontend'` 등). 매핑 table 은 `state_projection.py` 의 `SPECIALIST_TO_SLUG` 상수.
5. **`personas[slug].current_task`** — 해당 slug 의 `in_progress` directive 중 가장 최근 `updated_at`. 1개만.
6. **`personas[slug].status` 산출**:
   - `active` = current_task 있음
   - `idle` = current_task 없음 + last_active < 1h
   - `away` 또는 `offline` = last_active >= 1h (Phase 1 에서는 `idle` 로 통합, Phase B 에서 분리)
   - `blocked` = current_task.status = `blocked` (Phase 1 에서는 미사용)
7. **fingerprint** — top-level dict 의 sha256 첫 16자. 같으면 commit 안 함 (idempotency).
8. **prompt truncate** — 200 chars + "…" suffix. 줄바꿈 → space.

### 3-2. Phase B builder (Supabase realtime)

- `directives` projection (LEFT JOIN agents 으로 slug resolution):
  ```sql
  SELECT d.*, a.slug AS target_agent_slug
  FROM directives d
  LEFT JOIN agents a ON a.id = d.target_agent_id
  WHERE d.deleted_at IS NULL
  ORDER BY d.updated_at DESC;
  ```
  `target_agent_slug` = nullable (agents 미존재 시 null — #10 t4 명시).
- `agents`: `SELECT slug,name,role,status,last_active FROM agents WHERE deleted_at IS NULL`. **`role` 이 primary**, `domain` 은 projection 측 `ROLE_TO_DOMAIN` 정적 map.
- `pending_approvals`: `SELECT ... FROM approvals WHERE decided_at IS NULL`. **`scope` 산출**:
  - `task_id IS NOT NULL` → `scope = "task"`
  - 그 외 → `scope = "directive"`
- `recent_decisions`: `SELECT ... FROM approvals WHERE decided_at IS NOT NULL ORDER BY decided_at DESC LIMIT 5`.
- "active task per agent" query (#10 의 query reference 그대로): `DISTINCT ON (agent_id) ... tasks where status='in_progress' AND deleted_at IS NULL`.
- builder = pure projection: SQL row → schema_v0.1 field. logic 변경 0 — Phase 1 의 fingerprint·truncate·매핑 그대로.

**Phase 1 ↔ Phase B 전환 트리거**: config `STATE_SOURCE=issues` (Phase 1) / `STATE_SOURCE=supabase` (Phase B). daemon 한 줄 환경 변수 swap 로 cutover.

---

## 4. Client (Dashboard) 가이드

### 4-1. fetch

```javascript
const stateUrl = location.hostname === 'localhost'
  ? 'http://localhost:8765/state'
  : './dashboard-state.json';
const state = await fetch(stateUrl, { cache: 'no-store' }).then(r => r.json());
```

- `cache: 'no-store'` — Pages CDN 캐시 회피 (push 직후 즉시 반영)
- Phase B: Realtime subscription 으로 대체 (push lag 30-60s 해소)

### 4-2. render 폴링

- 30s interval 권장 (daemon polling 과 동일)
- 또는 page visibility API 로 visible 시에만 fetch
- `last_updated_at` 가 5분 이상 stale → 빨간 배지 + heartbeat 위젯 강조

### 4-3. 에러 처리

| 에러 | 처리 |
|---|---|
| HTTP 404 | "daemon 첫 빌드 대기 중" 메시지 + 60s 후 재시도 |
| HTTP 5xx (dev http) | localhost 분기 fallback → same-origin |
| JSON parse 실패 | "schema 손상 가능" 알림 + raw text 보존 |
| `schema_version` 미일치 | client 코드 호환 분기. v0 → v1 마이그 시 양쪽 모두 처리 |

---

## 5. 진화 정책

- `schema_version` 의 minor 증가 (v0 → v0.1) = 필드 추가 (backward compatible). client 무수정.
- major 증가 (v0 → v1) = 필드 삭제/타입 변경. client 코드 변경 필요. **PR 식 (#10 안 §1 그대로)** — 3 인프라 합의 후만 변경.
- 변경 commit 메시지 prefix: `schema(state.json): vX → vY — ___`.

---

## 6. Open questions (v0.1 — #10 SQL reference 후 갱신)

**해소됨** (v0 → v0.1):
- ~~Q1. `directives.id` 타입~~ → **uuid** (gen_random_uuid). state.json 에서는 string serialize.
- ~~Q3. `current_directive_id` 1:1 vs 1:N~~ → **1:N 가능** (tasks 테이블 가능, 단 "active task per agent" query 는 DISTINCT ON 으로 1 선택). state.json 의 `current_task` 는 1개만.

**해소됨** (v0.1 → v0.1-locked, #10 t4 검토):
- ~~Q2. `agents.metadata->>'domain'`~~ → **존재 X**. `agents.role` primary, `domain` 은 projection 측 `ROLE_TO_DOMAIN` 정적 map.
- ~~Q (XOR)~~ → `task_id`/`directive_id` OR 임. projection `scope` 필드 분기.
- ~~Q (join cardinality)~~ → `directives.target_agent_id` LEFT JOIN, null 허용.

**남은 질문**:
1. **인프라 트리오 agents.slug**: 0006_seed_agents.sql 의 15-row roster 에 `'09-dashboard'` `'10-backend'` `'11-orchestrator-daemon'` 같은 항목이 있는가? **mount 후 cross-check 필수**.
2. **`recent_decisions[]` ↔ Notion `#decisions` sync** (operations_setup.md §2): one-way (Notion → SQL) / one-way (SQL → Notion) / two-way? Phase 1 권장 = SQL 단방향 + Notion 수동 정리용 (sync 0). Phase B 검토.
3. **`directives.cost_usd` / `turns`**: Phase B 에서 SQL 추가하나 (`directives` 컬럼 vs 별도 `dispatch_runs` 테이블)? Phase 1 = daemon `usage.json` 만, state.json `cost_usd`/`turns` 가 null 가능 (UI 가 "비용 미수집" 표시).
4. **`cost.month_cap_usd`**: .env `MONTHLY_BUDGET_USD` 단일 source 권장 (SQL 미추가). Phase B 에서 의장 dashboard 에서 직접 조정 원하면 그때 `system_settings` 테이블 신설 검토.
5. **`agents.status` 어휘 일관성**: SQL = `idle|active|blocked|offline`. Persona Bible v1.2 §14-4 = `idle/working/blocked/away`. **SQL 채택 권장** (DB 소스 일관). Persona Bible 의 어휘는 v1.3 update 후보.
6. **`ROLE_TO_DOMAIN` 정적 map 값**: 0006 seed 의 role 값 (`'pm'`/`'frontend'`/`'orchestrator'`/...) 확정 후 projection 측 정적 map 채움. Persona Bible §0 표의 "도메인" 컬럼 (Visual Design / DataViz / ...) 그대로 활용.

---

## 7. References

- 인프라 #11: `orchestrator/src/state_projection.py` (builder 구현 spec, T+24 prototype)
- 인프라 #10: `site/_experts/sql/0001~0006.sql` (mount 후 commit) + schema reference paste (`_team/infra/discuss.md` Thread 002 T+0)
- 인프라 #9: `site/admin/dashboard/` (consumer, hostname 분기 fetch + render)
- Persona Bible v1.2 §14: 인프라 트리오 풀 entry
- `_team/infra/discuss.md`: Thread 001 (8 합의) + Thread 002 (schema freeze) archive
- `_team/infra/integrated_report_v1.md`: 의장 1선 보고 (Single Envoy 영구 룰 첫 라이브 적용, LOCKED)
