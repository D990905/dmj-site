# expert_orchestrator_daemon_reference.md — 단무지공방 Orchestrator Daemon reference

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 학습 정리 + Architecture Decision Record + Prototype handover |
| 작성 | Orchestrator (전문가 #11) · 2026-05-27 |
| 대상 | `site/orchestrator/` (prototype 폴더) + `~/dev/orchestrator/` (배포 권장 위치) |
| 범위 | Phase 1 — production 변경 X. spec + prototype + auto_push.command (즉시 사용 가능) 만 |
| 근거 | Claude Agent SDK 공식 docs (https://docs.claude.com/en/api/agent-sdk/python) · `claude-agent-sdk` PyPI · launchd reference · macOS errno 정의 (sys/errno.h) · `PUSH-FIX.command` / `PUSH-hardware-spec.command` 직접 열람 · site/.git 실측 진단 |
| Co-owners | Backend (#10) — GitHub Issues / Supabase 스키마 협의 · Frontend (#4) — dashboard directive·status JSON 협의 · Mobile (#8) — 모바일 인증 시 daemon 연결 |

> **읽는 법.** §0 = TL;DR + 즉시 행동. §1 = 현재 Push 루프의 정확한 진단 (왜 PUSH-FIX 가 충분치 않은지 site/.git 실측 증거). §2 = Architecture (Python vs Node 결정 + 6-component 분해). §3 = iCloud retry 로직의 errno-level 근거. §4 = 보안·비용. §5 = Phase 2 마이그 경로. §6 = 협업 인터페이스. §7 = Open questions. Phase 1 산출은 §0 의 prototype 폴더 + auto_push.command 까지.

---

## 0. 핵심 결론 (TL;DR)

**Push 병목은 영구 해결 가능하다, 단 3단으로 나눠야 한다.**

| 단계 | 산출물 | 셋업 시간 | 효과 |
|---|---|---|---|
| **즉시** | `site/orchestrator/auto_push.command` — PUSH-FIX 의 진화 버전 | 0분 | 더블클릭 1회로 iCloud 충돌 자동 retry · pull-rebase 자동 fallback · HEAD broken 자동 진단 |
| **15분 셋업** | launchd daemon (deploy-only mode) | 15분 | 더블클릭조차 불필요. 30초마다 자동 감지·자동 push. API key 미발급 OK |
| **30분 추가** | launchd daemon (full mode, Anthropic API key 필요) | +30분 | GitHub Issue → 자동 dispatch → status writeback. Dashboard 와 통합 시 진정한 orchestration |

**Phase 1 권장 우선순위**:

1. **`auto_push.command` 한 번 돌려보기** — 0분 셋업, 즉시 검증 가능. 기존 PUSH-FIX 를 같은 자리에서 대체.
2. **deploy-only daemon 설치** — Anthropic 비용 0원, 30초 polling 으로 push 완전 자동화. PUSH-FIX 자체를 잊을 수 있다.
3. **full mode 활성화** — Backend (#10) 가 GitHub Issues 스키마 확정 후. 이건 Frontend (#4) dashboard 와 contracts 맞춰야 함.

**왜 단계적인가**: §1 의 site/.git 진단 결과 현재도 `.git/refs/heads/main` 이 iCloud placeholder 상태이고 `.git/index.lock` 잔재가 남아있다. 이 환경에서 directive loop 같은 복잡한 추가 작업을 단번에 얹는 건 위험. **deploy 가 먼저 안정화돼야 directive 가 의미를 가진다.**

---

## 1. 현재 push 루프의 실측 진단

### 1-1. 측정 — site/.git 의 실제 상태 (2026-05-27)

`/Users/dannyok/Documents/Claude/Projects/단무지공방 홈페이지 만들기/site/.git` 에 실제 명령을 돌려본 결과:

```
$ cat .git/HEAD
ref: refs/heads/main                ← 정상

$ ls .git/refs/heads/
main                                 ← 파일 존재

$ cat .git/refs/heads/main
cat: Resource deadlock avoided       ← 실제 내용 못 읽음 (errno 11: EDEADLK)

$ git rev-parse HEAD
fatal: ambiguous argument 'HEAD'    ← 위의 결과 = HEAD 못 해결

$ ls .git/index.lock
.git/index.lock                      ← 이전 git 작업의 비정상 종료 잔재 존재
```

**이게 정확히 iCloud Drive 환경에서 git 이 깨지는 표본 케이스.** `.git/refs/heads/main` 의 OID 파일이 macOS 의 iCloud placeholder 가 됐고, read syscall 이 EDEADLK 로 거절됐다. PUSH-FIX 의 retry 로직은 `.git/index.lock` 만 정리하므로 이 케이스를 못 잡는다.

### 1-2. 기존 PUSH-FIX.command 분석

```bash
retry_git() {
  local cmd="$@"
  local tries=0
  local max=8
  while [ $tries -lt $max ]; do
    rm -f .git/index.lock           # ← 한 종류 lock 만 정리
    if eval "$cmd"; then return 0; fi
    tries=$((tries+1))
    sleep 3                          # ← 고정 3초
    rm -f .git/index.lock
  done
  ...
}
```

**한계 4가지**:

| 한계 | 결과 |
|---|---|
| `index.lock` 외의 lock 파일 (`HEAD.lock`, `refs/heads/main.lock`, `config.lock`) 무시 | HEAD 락은 retry 불가 |
| 고정 3초 sleep — exponential backoff 없음 | iCloud 가 더 오래 걸리면 8회 × 3초 = 24초 안에 다 소진 |
| `.icloud` placeholder 처리 없음 | refs 가 placeholder 면 영원히 retry 실패 |
| Commit message 하드코딩 — 매번 스크립트 수정 필요 | "효율적인 걸 좋아한다" 와 정반대 |
| Push rejected (non-fast-forward) 시 abort — pull --rebase 없음 | 원격에 새 commit 이 있으면 사용자가 수동으로 처리해야 |

### 1-3. 신규 `auto_push.command` 가 해결하는 것

```bash
clear_git_locks() {                  # 4종 lock 전부 + refs/*.lock 재귀
  rm -f .git/index.lock .git/HEAD.lock .git/config.lock
  find .git/refs -name '*.lock' -delete
  find .git -maxdepth 1 -name '*.lock' -delete
}

icloud_download_git() {              # 신규
  brctl download .git                # macOS iCloud daemon 에 강제 다운로드 요청
}

retry_git() {                        # 에러 시그니처 기반 분기
  case "$out" in
    *"Resource deadlock avoided"*|*"Failed to resolve HEAD"*|...)
      icloud_download_git            # iCloud 가 원인이면 download 트리거
      sleep $delay                   # exponential backoff
      delay=$(( delay * 2 ))         # 1→2→4→8→16 (cap)
      ;;
    *) return $rc ;;                 # non-retriable 는 즉시 fail
  esac
}
```

추가로:
- **HEAD 무결성 사전 체크** — `git rev-parse --verify HEAD` 실패 시 stat-as-trigger 로 refs 강제 download 후 5초 대기.
- **Commit message 자동 생성** — `git diff --cached --name-only` 의 첫 3개 + 나머지 카운트 + UTC 타임스탬프.
- **동시 실행 방지** — `/tmp/orchestrator-push-<md5(repo)>.lock` 으로 두 번 더블클릭해도 1개만 실행.
- **Push rejected → pull --rebase → push 재시도** 자동 chain. 가장 흔한 "다른 기기에서 먼저 push 됨" 케이스.

---

## 2. Architecture

### 2-1. Python vs Node — 결정: Python 3.10+

| 기준 | Python | Node | Winner |
|---|---|---|---|
| Claude Agent SDK 공식 지원 | `claude-agent-sdk` (PyPI, 0.1.48) | `@anthropic-ai/claude-agent-sdk` | tie |
| launchd 통합 | 단일 .py 진입점 | node + path 명시 필요 | Python |
| macOS 기본 제공 | `python3` Xcode CLT 와 동봉 | `node` 별도 설치 | Python |
| 비동기 daemon 패턴 | `asyncio` + 단일 event loop | event loop ok | tie |
| `subprocess` (git 호출) | stdlib, 깔끔 | `child_process` ok | Python |
| FS 권한 / macOS-specific (`security`, `brctl`, `osascript`) | stdlib subprocess 로 호출 | 동일 | tie |
| dmj-site 의 기존 도구 stack | shell 위주, Python 진입 자연스러움 | node 없음 | Python |

**결정: Python.** Node 의 유일한 이점은 TS 의 정적 타입이지만 ~700 LOC 의 daemon 에서 그 가치는 launchd 통합 단순함보다 작다.

### 2-2. Component 분해 (6개 모듈 + 1개 standalone)

```
auto_push.command           ← standalone bash (zero deps, 즉시 사용)
src/
├── icloud.py               ← iCloud placeholder + lock 처리 (Python 의 auto_push)
├── git_deploy.py           ← icloud 위에 build 한 add/commit/push 사이클
├── config.py               ← Keychain → .env → env 순서, deploy-only / full 두 mode
├── log.py                  ← TimedRotatingFileHandler + JSON event line
├── notify.py               ← osascript 래퍼
├── cost.py                 ← usage.json 누적, monthly cap, daily notify threshold
├── daemon.py               ← 3개 coroutine (deploy + heartbeat + [optional] directive)
├── queue.py                ← GitHubIssuesQueue (full mode 만)
├── status.py               ← Status dataclass + GitCommitSink (full mode 만)
└── dispatcher.py           ← Claude Agent SDK 래퍼, specialist registry (full mode 만)
```

**핵심 추상화 2개**:

1. **`Queue` Protocol** — `fetch_pending() / mark_in_progress / mark_done / mark_error`. Phase 1 impl: `GitHubIssuesQueue`. Phase 2 impl: `SupabaseQueue`. daemon 은 Protocol 만 알면 됨.
2. **`StatusSink` Protocol** — `write(status)`. Phase 1 impl: `GitCommitSink` (+ `IssueCommentSink` 는 queue 내부). Phase 2 impl: `SupabaseRowSink`.

### 2-3. 두 가지 mode

| Mode | 시작 조건 | 활성 coroutine | API key | 비용 |
|---|---|---|---|---|
| **deploy-only** (기본) | `ENABLE_DIRECTIVE_LOOP=false` | `deploy_loop` + `heartbeat_loop` | 불필요 | $0 |
| **full** | `ENABLE_DIRECTIVE_LOOP=true` + 키 셋 | + `directive_loop` | Anthropic + GitHub PAT | per-directive |

`config.load()` 가 mode 별로 검증을 분기 — deploy-only 는 API key 누락해도 SystemExit 안 함. **Phase 1 즉시 가치는 deploy-only.** Full 은 dashboard 합의 후.

### 2-4. Claude Agent SDK 사용 패턴 (full mode)

```python
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

options = ClaudeAgentOptions(
    system_prompt=SPECIALIST_PROMPTS[directive.specialist],
    permission_mode="acceptEdits",          # bypassPermissions 아님 — 안전
    disallowed_tools=["Bash(rm -rf *)", ...],
    max_turns=directive.max_turns or 30,
    max_budget_usd=directive.max_budget_usd or 1.50,   # SDK 가 자체 종료
    cwd=str(cwd),                           # SDK 가 디렉토리 격리
    env={"ANTHROPIC_API_KEY": api_key, **os.environ},
)
async for msg in query(prompt=directive.prompt, options=options):
    if isinstance(msg, ResultMessage):
        # msg.total_cost_usd, msg.usage, msg.num_turns, msg.is_error
        record_cost(msg.total_cost_usd)
```

검증한 SDK 시그니처 (`src/claude_agent_sdk/types.py` 의 dataclass 정의 1:1):
- `system_prompt: str | SystemPromptPreset | SystemPromptFile | None`
- `permission_mode: PermissionMode` (Literal: `"acceptEdits"`, `"bypassPermissions"`, ...)
- `disallowed_tools: list[str]` (default_factory=list)
- `max_turns: int | None`
- `max_budget_usd: float | None`
- `cwd: str | Path | None`
- `env: dict[str,str]` (default_factory=dict)

> 주의: `ClaudeAgentOptions` 는 snake_case, `AgentDefinition` (sub-agent) 는 camelCase. 혼동 시 `TypeError` 발생. SDK 의 의도된 비대칭.

---

## 3. iCloud retry 로직 — errno-level 근거

### 3-1. 어떤 에러가 retryable 인가

| errno | 이름 | macOS 메시지 | 원인 (iCloud 맥락) | retry? |
|---|---|---|---|---|
| 11 | `EDEADLK` | "Resource deadlock avoided" | iCloud daemon 이 파일 read 중, 동시에 우리도 read | YES |
| 35 | `EAGAIN`/`EWOULDBLOCK` | "Resource temporarily unavailable" | iCloud sync 가 진행 중인 파일에 nonblocking read | YES |
| 16 | `EBUSY` | "Device or resource busy" | 일부 mount layer 에서 iCloud 충돌 | YES |
| 2 | `ENOENT` | "No such file" | 진짜로 파일이 없거나, .icloud placeholder 가 아직 안 생김 | conditional |

**git stderr substring** 으로도 동일 패턴 잡음 (`src/icloud.py`):
```python
GIT_RETRYABLE_PATTERNS = (
    "Resource deadlock avoided",
    "Resource temporarily unavailable",
    "Device or resource busy",
    "Failed to resolve HEAD",            # refs/heads/* 가 placeholder
    "branch appears to be broken",       # 위와 같은 원인의 다른 메시지
    "index.lock", "HEAD.lock",
    "unable to create", ".lock' could not be created",
)
```

### 3-2. brctl download 사용 근거

`brctl` 은 macOS 의 iCloud sync 데몬과 통신하는 CLI:
```
brctl download <path>     # path 이하 모든 placeholder 를 download 큐에 등록
brctl evict <path>         # 반대 — local copy 제거하고 placeholder 화
brctl status               # sync 상태 확인
```

`brctl download .git` 한 번이 stat-loop 보다 훨씬 빠르고 안정적. 단 `brctl` 부재 환경 (예: 비-macOS 또는 비-iCloud) 도 있을 수 있으므로 `find . -name '*.icloud' | xargs stat` fallback 을 유지.

### 3-3. Exponential backoff 값 선택

`INITIAL_BACKOFF_SEC = 1.0`, `MAX_BACKOFF_SEC = 16.0`, `MAX_RETRIES = 8`:
- 누적 대기 = 1 + 2 + 4 + 8 + 16 + 16 + 16 + 16 = **79초 max**
- 실측 iCloud 대형 파일 sync 가 통상 5–30초 이내 끝남 — 충분
- 너무 길면 daemon 의 polling 주기 (30초) 안에 다 못 끝남 → 다음 cycle 로 자연 이월
- 1초 시작은 일반적인 transient lock 에 충분히 짧음

---

## 4. 보안 + 비용

### 4-1. 보안 위협 모델

| 위협 | 완화 |
|---|---|
| `ANTHROPIC_API_KEY` git 커밋 | macOS Keychain (1순위) → `~/.config/orchestrator/.env` chmod 600 (fallback) → 영구 `.gitignore` |
| GitHub PAT 누설 | Fine-grained PAT, dmj-site repo only, Issues r/w + Contents r/w, 90일 expiration |
| Agent 가 임의 bash 실행 | `permission_mode="acceptEdits"` (not `bypassPermissions`) + `disallowed_tools=[Bash(rm -rf *), Bash(curl * | sh), ...]` |
| Daemon 자신이 작업 폴더에 secret 쓰기 | daemon 작업 폴더는 `~/dev/orchestrator-workspace/` (iCloud 밖); `.env` 는 `~/.config/orchestrator/` (iCloud 밖) |
| Cost runaway | Anthropic 콘솔 cap ($50/월) + daemon monthly cap (코드 안 hard-stop) + per-directive `max_budget_usd` (default $1.50) — 3중 안전망 |

**가장 흔한 사고 = daemon 작업 폴더 = repo 자체**. iCloud sync 가 daemon 의 임시 파일을 sync 큐에 올리면 충돌의 무한 루프 발생. **`WORKSPACE_DIR` 는 반드시 iCloud 밖**.

### 4-2. 비용 모델

`ResultMessage.total_cost_usd` 는 SDK 가 매 query 마지막에 반환. daemon 의 `cost.py` 가:
- `~/.config/orchestrator/usage.json` 에 day_total / month_total 누적
- 일일 $10 도달 시 macOS notification
- 월 $50 도달 시 directive_loop 자체 정지 (heartbeat / deploy 는 계속)

추정 비용 baseline:
- 작은 frontend 변경 (단일 파일 < 100 LOC) — $0.30–1.00
- 다중 파일 feature + 테스트 — $1.50–5.00
- 대규모 리팩토링 — $5+ (이 케이스는 사람이 직접 하라고 거절하는 게 옳음)

---

## 5. Phase 2 마이그 경로

두 추상화 (`Queue`, `StatusSink`) 만 갈아끼우면 됨. **daemon.py 는 한 줄 변경**:

```python
# Phase 1:
queue = GitHubIssuesQueue(cfg.github_token, cfg.github_owner, cfg.github_repo_name)
sink = GitCommitSink(cfg.workspace_dir)

# Phase 2:
queue = SupabaseQueue(cfg.supabase_url, cfg.supabase_anon_key)
sink = SupabaseRowSink(cfg.supabase_url, cfg.supabase_anon_key)
```

`git_deploy.py`, `cost.py`, `dispatcher.py`, `daemon.py` 는 변경 0. **이 깨끗한 분리가 Phase 1 의 가장 큰 가치 — Phase 2 마이그가 weekend 작업 수준이 됨.**

VPS 마이그 (Mac always-on 의존성 제거) 시:
- `launchd .plist` → `systemd .unit file` 1:1 변환 가능 (KeepAlive=true → Restart=always)
- `brctl` 의존성은 VPS 에서 자동 제거 (iCloud 가 없으니 placeholder 도 없음) — `icloud.py` 의 `if shutil.which("brctl")` 분기가 자연스러운 no-op

---

## 6. 협업 인터페이스

### 6-1. Backend (#10) — GitHub Issues / Supabase 스키마

**Phase 1 directive JSON** (GitHub Issue body 안의 ` ```json ` 펜스):
```json
{
  "directive_id": "dir_2026-05-27_001",
  "specialist": "frontend|dataviz|hardware|general",
  "prompt": "free-form instruction in Korean or English",
  "repo_path": "optional/subdir/within/workspace",
  "max_budget_usd": 1.50,
  "max_turns": 30
}
```

**Phase 1 status JSON** (Issue comment + `.orchestrator/status/{id}.json`):
```json
{
  "directive_id": "...", "state": "done|error|in_progress",
  "started_at": "ISO", "finished_at": "ISO",
  "specialist": "...", "cost_usd": 0.42,
  "tokens": {"input": 0, "output": 0}, "turns": 8,
  "commits": ["abc1234"], "summary": "...", "error": null
}
```

#10 와 합의 필요: 위 스키마가 Supabase row 로 1:1 매핑 가능한지, `state` enum 충돌 없는지.

### 6-2. Frontend (#4) — Dashboard 와 protocol

Dashboard 는 두 surface 둘 다 읽을 수 있어야 함:
1. GitHub Issues API (`/repos/{owner}/{repo}/issues?labels=done`)
2. Repo 의 `.orchestrator/status/*.json` (GitHub Raw 또는 Pages 로 노출 가능)

후자가 더 단순함 — Dashboard 는 GitHub 인증 없이 raw URL 만 fetch.

### 6-3. Mobile (#8) — 모바일에서 directive 만들기

iOS 단축어 → GitHub Issues API POST 가 가장 단순. PAT 는 iCloud Keychain 에 둠. **모바일 = directive 만 만들기, 결과는 dashboard 가 모바일 웹에서도 보이므로 별도 native 화면 불필요** (Phase 1).

---

## 7. Open questions

1. **(#10)** Phase 2 Supabase 스키마가 GitHub Issues 스키마 1:1 매핑 가능한가? `state` 컬럼 enum 충돌?
2. **(#4)** Dashboard 가 GitHub 인증 없이 status JSON 을 읽을 수 있어야 하는가, 아니면 GitHub Pages 로 노출해도 OK?
3. **(#8)** Mobile 에서 directive 생성 시 PAT 보관 — iCloud Keychain vs Anthropic Console Mobile?
4. **(#7 hardware)** 향후 sensor firmware 빌드도 daemon 으로 자동화 가능? (cross-compile + flash 단계). Phase 3 후보.
5. **(#11 self)** `auto_push.command` 의 `brctl download .git` 가 site/.git (210 항목, ~20 LOC binary files) 다 다운로드받을 때 실측 시간? Danny Mac 에서 1회 측정 필요.

---

## 8. Variables & constants

| 상수 | 값 | 근거 |
|---|---|---|
| `POLL_INTERVAL_SECONDS` | 30 | GitHub API rate limit (5000 req/hr × token) 의 < 0.1%, Danny 의 typical edit-to-push 욕구 만족 |
| `MAX_RETRIES` (git) | 8 | exponential backoff 누적 79초 max — iCloud sync 실측 한계 내 |
| `MAX_BACKOFF_SEC` | 16 | 단일 sleep 이 polling 주기 (30s) 보다 작아야 함 |
| `MONTHLY_BUDGET_USD` | 50 | 평균 directive $1 × 일 5건 × 25일 = $125 의 40% — 여유 |
| `DEFAULT_MAX_BUDGET_USD` (per directive) | 1.50 | 단일 frontend 변경 평균 비용 + 50% buffer |
| `DEFAULT_MAX_TURNS` | 30 | 8–10 턴이 통상; 30 은 복잡 작업의 안전판 |
| `daily_notify_usd` | 10 | 하루 비용이 평균치의 2배 — 사람 개입 트리거 적정선 |

---

## 9. Sources

- Claude Agent SDK — https://docs.claude.com/en/api/agent-sdk/python
- PyPI — https://pypi.org/project/claude-agent-sdk/
- GitHub repo — https://github.com/anthropics/claude-agent-sdk-python (types.py 의 dataclass 정의 직접 확인)
- launchd reference — https://www.launchd.info/
- macOS errno — `man 2 intro` (sys/errno.h)
- brctl manpage — `man brctl` (Apple iCloud CLI)
- GitHub Issues REST API — https://docs.github.com/en/rest/issues
- 기존 PUSH-FIX.command 분석 — `site/PUSH-FIX.command` 직접 열람
- site/.git 실측 진단 — 2026-05-27 (§1-1)
