"""state_projection.py — Phase 1 sprint deliverable (spec 초안 v0)

8 합의 항목 중 ⑧ "state.json dual publish" 의 구현 spec.

DRAFT — 실제 구현은 #10 SQL freeze + dashboard_state_schema_v0.md fill 후.

이 모듈은 daemon 의 새 coroutine `state_projection_loop` 를 제공한다.
역할: GitHub Issues 폴링 결과 → 정규화 → dashboard-state.json 으로 dual publish.

────────────────────────────────────────────────────────────
8 합의 항목 reference (Persona Bible v1.2 §14 + integrated_report_DRAFT)
────────────────────────────────────────────────────────────
  ⑤ Source-of-truth: GitHub Issues 1차, Supabase mirror (Phase B), state.json primary surface
  ⑥ "+새지시" → Issue → trio dispatch = Phase 1 done 기준
  ⑦ ETag 캐싱 = 로컬 파일 (~/dev/orchestrator-workspace/.orchestrator/etag.cache)
  ⑧ state.json dual publish:
       Primary (모바일·iPhone) → site/admin/dashboard/dashboard-state.json
                                  diff 시 commit + push → GitHub Pages serve
       Dev hot-loop (Mac only)  → localhost:8765/state (optional, 같은 데이터)

────────────────────────────────────────────────────────────
의존성 (interface contract)
────────────────────────────────────────────────────────────
  - schema 정의: _team/infra/dashboard_state_schema_v0.md (Envoy #9 draft)
  - SQL 컬럼: site/supabase/migrations/orch/0001~0006.sql (#10 freeze 후)
  - 폴링: src/queue.py 의 GitHubIssuesQueue.fetch_pending() 확장 필요
            (현재는 pending 만 — directive_loop 외에 모든 라벨 fetch 추가)
  - 커밋: src/git_deploy.py 의 run_git_retry() 재사용 (iCloud-aware retry)
  - 캐싱: ETag → ~/.orchestrator/etag.cache (config.workspace_dir 기준)

────────────────────────────────────────────────────────────
운영 파라미터 (config 추가 후보)
────────────────────────────────────────────────────────────
  STATE_DEBOUNCE_SECONDS=5      # 변경 감지 후 추가 변경 흡수 시간
  STATE_HTTP_PORT=8765          # dev hot-loop 포트, 0 = 비활성화
  STATE_PUBLISH_PATH=site/admin/dashboard/dashboard-state.json   # repo-relative
  STATE_MIN_COMMIT_INTERVAL=60  # 최소 commit 간격 (rate limit, default 60s)
"""
from __future__ import annotations

import asyncio
import hashlib
import http.server
import json
import logging
import socketserver
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Phase 1 sprint 시점에 wiring:
# from . import git_deploy, icloud
# from .queue import GitHubIssuesQueue


# ════════════════════════════════════════════════════════════════════
# 1. Data model (schema_v0.md v0.1 와 1:1 매핑)
# ════════════════════════════════════════════════════════════════════
#
# directive `specialist` (Issue body) → agents.slug (DB) 매핑.
# Phase 1 = Issues SoT. Issue body 의 free-form `specialist` 값을
# 안정적 slug 로 정규화. seed (0006_seed_agents.sql) 확인 후 expand.

# ════════════════════════════════════════════════════════════════════
# 0006 seed_agents.sql 의 15 slug + role (Thread 002 t7, #10 paste)
# ════════════════════════════════════════════════════════════════════
# slug                 role                  display_name (Bible §0 매핑 시 한국어)
SEED_AGENTS: dict[str, tuple[str, str, str]] = {
    "01-pm":                ("pm",                "PM",                          "Project Management"),
    "02-research":          ("research",          "메이 한",                     "UX Research Director"),
    "03-design":            ("design",            "로즈 윤",                     "Visual Design Director"),
    "04-frontend":          ("frontend",          "알렉스 박",                   "Frontend Engineer"),
    "05-mobile-ux":         ("mobile_ux",         "Mobile UX",                   "Mobile UX Designer"),
    "06-data-science":      ("data_science",      "샘 정",                       "DataViz / Data Science"),
    "07-content":           ("content",           "Content Producer",            "Content"),
    "08-mobile-eng":        ("mobile_eng",        "왕 정",                       "Mobile App & Integration"),
    "09-devops":            ("devops",            "DevOps",                      "DevOps / Infrastructure"),
    "10-backend":           ("backend",           "인프라 #10",                  "Backend Eng"),
    "11-orchestrator":      ("orchestrator",      "인프라 #11",                  "Orchestrator Daemon"),
    "12-riding-analytics":  ("riding_analytics",  "티모 강",                     "Sports Science / Riding"),
    "13-business":          ("business",          "Business Ops",                "Business Operations"),
    "14-legal":             ("legal",             "Legal Counsel",               "Legal"),
    "15-marketing":         ("marketing",         "캔 최",                       "Marketing & Social"),
}
# 사전 flag (#10 t5a, Phase B 별도 thread):
#  - Hiro Goo (Hardware & Embedded) → seed 에 hardware/embedded slot 없음
#  - 데이빗 옥 (Chief of Staff) → seed 에 chief_of_staff slot 없음
#  - 인프라 #9 (Dashboard) → seed 에 dashboard slot 없음 (10-backend / 11-orchestrator 만)
# 위 4 entity 는 Persona Bible §0 에 있으나 dashboard agent fleet 에 표시 X (Phase B 합의 후 seed 추가).


# directive json 의 `specialist` 입력값 → seed slug.
# 일반 사용자 입력 alias 도 받아 안전성 확보.
SPECIALIST_TO_SLUG: dict[str, str] = {
    # seed role 그대로 — 가장 안전
    "pm":                "01-pm",
    "research":          "02-research",
    "design":            "03-design",
    "frontend":          "04-frontend",
    "mobile_ux":         "05-mobile-ux",
    "data_science":      "06-data-science",
    "content":           "07-content",
    "mobile_eng":        "08-mobile-eng",
    "devops":            "09-devops",
    "backend":           "10-backend",
    "orchestrator":      "11-orchestrator",
    "riding_analytics":  "12-riding-analytics",
    "business":          "13-business",
    "legal":             "14-legal",
    "marketing":         "15-marketing",
    # alias — 자주 쓰는 표현
    "dataviz":           "06-data-science",     # legacy "dataviz" → data_science
    "ux":                "02-research",
    "mobile":            "08-mobile-eng",       # default mobile = engineering
    "general":           "01-pm",               # fallback
    # 사전 flag entity (Phase B 매핑 미정 — 우선 PM 으로 라우팅)
    "hardware":          "01-pm",               # TBD Phase B
    "sports_science":    "12-riding-analytics", # riding analytics 에 흡수 가능
    "chief_of_staff":    "01-pm",               # TBD Phase B
}

# agents.role → 의장 view 의 도메인 라벨. (Thread 002 t4 #10: agents.metadata
# 의 domain key 보장 X → projection 측 정적 map).
ROLE_TO_DOMAIN: dict[str, str] = {
    "pm":                "Project Management",
    "research":          "UX Research",
    "design":            "Visual Design",
    "frontend":          "Frontend Eng (Web)",
    "mobile_ux":         "Mobile UX",
    "data_science":      "DataViz / Data Science",
    "content":           "Content",
    "mobile_eng":        "Mobile Engineering",
    "devops":            "DevOps / Infrastructure",
    "backend":           "Backend Eng",
    "orchestrator":      "Orchestration Infra",
    "riding_analytics":  "Sports Science / Riding",
    "business":          "Business Operations",
    "legal":             "Legal",
    "marketing":         "Marketing & Social",
}


def role_to_domain(role: str | None) -> str | None:
    """agents.role → 도메인 라벨. 매핑 X 면 role 자체 그대로 반환."""
    if not role:
        return None
    return ROLE_TO_DOMAIN.get(role, role)


def approval_scope(task_id: str | None, directive_id: str | None) -> str:
    """approvals.{task_id, directive_id} → scope enum.

    #10 t4: OR constraint (XOR 아님). 둘 다 존재 시 task 우선
    (task 의 parent directive 는 context 로만 사용).
    """
    if task_id:
        return "task"
    if directive_id:
        return "directive"
    return "unknown"   # 둘 다 null = constraint 위반 — log warning


@dataclass
class CurrentTask:
    id: str           # tasks.id (uuid → string)
    title: str
    status: str       # tasks.status enum
    directive_id: str | None
    updated_at: str   # ISO


@dataclass
class PersonaState:
    """schema_v0.md §2-3.

    #10 t4 정정: `domain` 은 SQL 미존재 (`agents.metadata->>'domain'` 보장 X).
    projection 측에서 `role_to_domain(role)` 정적 map 으로 산출. role 이 primary.
    """
    display_name: str                 # agents.name
    role: str                         # agents.role  ← primary
    domain: str | None = None         # role_to_domain(role) — projection 측 산출
    status: str = "idle"              # agents.status enum (idle|active|blocked|offline)
    current_task: CurrentTask | None = None
    last_active_at: str | None = None # agents.last_active
    idle_minutes: int = 0             # computed


@dataclass
class DirectiveCard:
    """schema_v0.md §2-2.

    #10 t4 정정: target_agent_slug 는 LEFT JOIN 결과 — agents 미존재 시 null.
    FK = ON DELETE SET NULL 이므로 agent 가 soft-delete 된 경우도 null.
    """
    directive_id: str                # directives.id (uuid)
    title: str                       # directives.title
    prompt_excerpt: str               # directives.prompt truncate 200
    status: str                       # directives.status enum (6)
    priority: str                     # directives.priority enum (p0-p3)
    target_agent_slug: str | None     # LEFT JOIN agents.slug — null 가능
    created_at: str                   # directives.created_at
    updated_at: str                   # directives.updated_at
    issue_url: str                    # constructed
    cost_usd: float | None = None     # daemon usage.json (SQL 미존재)
    turns: int | None = None          # SQL 미존재


@dataclass
class PendingApproval:
    """schema_v0.md §2-4.

    #10 t4 정정: task_id/directive_id 는 XOR 아니라 OR (둘 다 동시 존재 가능).
    `scope` 필드 = projection 측 산출 ("task" 우선, 없으면 "directive").
    """
    approval_id: str
    scope: str                        # "task" | "directive" — approval_scope() 산출
    task_id: str | None
    directive_id: str | None
    asked_by_slug: str                # resolved from asked_by_agent_id
    question: str
    options: list                     # jsonb
    created_at: str
    age_minutes: int


@dataclass
class RecentDecision:
    """schema_v0.md §2-5."""
    approval_id: str
    question: str
    decision: str
    decided_at: str
    decided_by_email: str             # resolved from auth.users
    source: dict                      # {"directive_id": ..., "task_id": ...}


@dataclass
class CostSnapshot:
    """schema_v0.md §2-6. daemon usage.json 그대로."""
    day_total_usd: float = 0.0
    month_total_usd: float = 0.0
    month_cap_usd: float = 50.0
    month_remaining_usd: float = 50.0
    last_dispatch_usd: float = 0.0


@dataclass
class HeartbeatStatus:
    """schema_v0.md §2-7."""
    daemon_alive: bool = True
    last_heartbeat_at: str = ""
    stale_seconds: int = 0
    mode: str = "deploy-only"         # "deploy-only" | "full"


@dataclass
class DashboardState:
    """state.json top-level. schema_v0.md §1."""
    schema_version: str = "v0.1"
    last_updated_at: str = ""
    directives: list[DirectiveCard] = None  # type: ignore
    personas: dict[str, PersonaState] = None  # type: ignore  (key = agents.slug)
    pending_approvals: list[PendingApproval] = None  # type: ignore
    recent_decisions: list[RecentDecision] = None  # type: ignore
    cost: CostSnapshot = None  # type: ignore
    heartbeat: HeartbeatStatus = None  # type: ignore

    def __post_init__(self):
        if self.directives is None: self.directives = []
        if self.personas is None: self.personas = {}
        if self.pending_approvals is None: self.pending_approvals = []
        if self.recent_decisions is None: self.recent_decisions = []
        if self.cost is None: self.cost = CostSnapshot()
        if self.heartbeat is None: self.heartbeat = HeartbeatStatus()

    def to_json(self) -> str:
        from dataclasses import asdict
        return json.dumps(asdict(self), indent=2, ensure_ascii=False, default=str)

    def fingerprint(self) -> str:
        """diff 비교용 — 내용이 같으면 commit 안 함."""
        return hashlib.sha256(self.to_json().encode("utf-8")).hexdigest()[:16]


# ════════════════════════════════════════════════════════════════════
# 2. Builder — Issues + (Phase B) Supabase → DashboardState
# ════════════════════════════════════════════════════════════════════

async def build_state(queue, github_repo: str, etag_cache: Path,
                      log: logging.Logger) -> DashboardState:
    """Phase 1 — Issues 폴링 결과를 schema_v0.1 구조로 정규화.

    schema_v0.md §3-1 builder 규칙 1:1.

    Args:
      queue: GitHubIssuesQueue (Phase B 에서 SupabaseQueue 로 swap)
      github_repo: "owner/repo" — issue_url 구성용
      etag_cache: ~/dev/orchestrator-workspace/.orchestrator/etag.cache
      log: logger

    Returns:
      DashboardState — 새 fingerprint 가 cache 와 같으면 publisher 가 commit 안 함.
    """
    from datetime import datetime, timezone
    state = DashboardState(
        schema_version="v0.1",
        last_updated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )

    # ── ETag load + fetch ─────────────────────────────────────────
    prev_etag = _read_etag(etag_cache)
    try:
        issues, new_etag = await queue.fetch_all_directives(etag=prev_etag)
    except Exception:
        log.exception("state_projection: fetch_all_directives failed")
        return state    # 빈 state 반환 → publisher 가 fingerprint diff 보고 commit 안 함

    if new_etag and new_etag != prev_etag:
        _write_etag(etag_cache, new_etag)
    elif not issues and prev_etag == new_etag:
        # 304 — variation 0. 단 직전 state 가 있으면 그것 유지하고 싶지만
        # publisher 가 메모리에 갖고 있으므로 빈 state 반환 OK (fingerprint 동일).
        log.debug("state_projection: 304 Not Modified")
        return state

    # ── directives[] 빌드 ────────────────────────────────────────
    pending_count_by_specialist: dict[str, int] = {}
    for issue in issues:
        labels = queue.labels_of(issue)
        body = issue.get("body", "") or ""
        # Issue body 의 ```json``` 블록 parse (rule 1)
        directive_data = _parse_fenced_json(body)
        if not directive_data or "directive_id" not in directive_data:
            log.warning("state_projection: issue #%s missing directive_id json",
                        issue.get("number"))
            continue

        # status 산출 (rule 3) — 라벨 우선순위
        status = queue.state_from_labels(labels)

        # Status comment 의 ```json``` 블록 parse (rule 2) — Phase 1 에서는
        # 비용 fetch 만 위해 comments 가져옴 (skip 시 cost_usd=None).
        # 성능: comment fetch 는 issue 당 1 request. directive 많으면 비쌈.
        # → Phase 1: status comment 는 done/error 만 fetch (final cost 만 의미)
        cost_usd: float | None = None
        turns: int | None = None
        if status in ("done", "error"):
            try:
                comments = await queue.fetch_issue_comments(issue["number"])
                # 마지막 comment 의 fenced block = 최종 status
                for c in reversed(comments):
                    status_data = _parse_fenced_json(c.get("body", "") or "")
                    if status_data:
                        cost_usd = status_data.get("cost_usd")
                        turns = status_data.get("turns")
                        break
            except Exception:
                log.debug("state_projection: comments fetch failed for #%s",
                          issue.get("number"))

        # specialist → slug 매핑 (rule 5)
        specialist = directive_data.get("specialist", "general")
        target_slug = SPECIALIST_TO_SLUG.get(specialist)

        # truncate prompt (rule 8)
        prompt = (directive_data.get("prompt") or "").replace("\n", " ").strip()
        prompt_excerpt = prompt[:200] + ("…" if len(prompt) > 200 else "")

        state.directives.append(DirectiveCard(
            directive_id=directive_data["directive_id"],
            title=issue.get("title", "")[:200],
            prompt_excerpt=prompt_excerpt,
            status=status,
            priority=directive_data.get("priority", "p2"),
            target_agent_slug=target_slug,
            created_at=issue.get("created_at", ""),
            updated_at=issue.get("updated_at", ""),
            issue_url=f"https://github.com/{github_repo}/issues/{issue['number']}",
            cost_usd=cost_usd,
            turns=turns,
        ))

        if status == "in_progress" and target_slug:
            pending_count_by_specialist[target_slug] = \
                pending_count_by_specialist.get(target_slug, 0) + 1

    # ── personas{} 빌드 (Phase 1 — Persona Bible §0 표 + 작업 상태) ──
    # Phase 1 = Persona Bible 만 source (SQL 없음). agents 테이블이 비어있어도
    # Bible 의 명함 표시. status 는 in_progress directive 매핑.
    state.personas = _build_personas_from_bible(pending_count_by_specialist)

    # ── pending_approvals / recent_decisions — Phase 1 = SQL 없으므로 비움 ──
    # Phase B 에서 approvals 테이블 select 로 fill.
    state.pending_approvals = []
    state.recent_decisions = []

    # ── cost ──────────────────────────────────────────────────────
    state.cost = _build_cost_snapshot()

    # ── heartbeat (daemon 본인이 작성) ─────────────────────────────
    state.heartbeat = HeartbeatStatus(
        daemon_alive=True,
        last_heartbeat_at=state.last_updated_at,
        stale_seconds=0,
        mode="full",   # state projection 활성 = full mode 가정
    )

    log.info("state_projection: built — %d directive(s), %d persona(s)",
             len(state.directives), len(state.personas))
    return state


def _parse_fenced_json(text: str) -> dict | None:
    """본문에서 첫 ```json {...} ``` 블록 추출."""
    import re
    m = re.search(r"```json\s*(\{.*?\})\s*```", text or "", re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except (json.JSONDecodeError, ValueError):
        return None


def _read_etag(cache: Path) -> str | None:
    try:
        return cache.read_text().strip() or None
    except (FileNotFoundError, OSError):
        return None


def _write_etag(cache: Path, etag: str) -> None:
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(etag)
    except OSError:
        pass


def _build_cost_snapshot() -> CostSnapshot:
    """orchestrator/src/cost.py 의 usage.json 읽기."""
    from . import cost as cost_mod
    snap = cost_mod.snapshot()
    # month_cap 은 .env 의 MONTHLY_BUDGET_USD 인데 여기선 config 필요.
    # build_state 의 호출부에서 cfg 전달받아 cap 채워주는 것도 방법.
    # Phase 1: 50.0 default, Phase B 에서 cfg 주입.
    cap = 50.0
    return CostSnapshot(
        day_total_usd=snap.today_total,
        month_total_usd=snap.month_total,
        month_cap_usd=cap,
        month_remaining_usd=max(0.0, cap - snap.month_total),
        last_dispatch_usd=snap.last_dispatch_cost,
    )


def _build_personas_from_bible(
    pending_by_slug: dict[str, int],
) -> dict[str, PersonaState]:
    """Phase 1 — 0006 seed (SEED_AGENTS 상수) + 작업 상태 산출.

    Phase B: SQL `agents` 테이블 select 결과로 swap. logic 변경 0
    (DashboardState 구조 동일).
    """
    personas: dict[str, PersonaState] = {}
    for slug, (role, display, role_label) in SEED_AGENTS.items():
        pending = pending_by_slug.get(slug, 0)
        personas[slug] = PersonaState(
            display_name=display,
            role=role,
            domain=role_to_domain(role),
            status="active" if pending > 0 else "idle",
            current_task=None,         # Phase 1 = simple, directives[] 가 작업 표시
            last_active_at=None,       # Phase B 에서 agents.last_active
            idle_minutes=0,
        )
    return personas


# ════════════════════════════════════════════════════════════════════
# 3. Dual publish — same-origin static (primary) + localhost:8765 (dev)
# ════════════════════════════════════════════════════════════════════

class StatePublisher:
    """Holds latest state in memory + writes to repo file on diff.

    Primary 채널: repo/site/admin/dashboard/dashboard-state.json 에 write
                  → git_deploy.run_git_retry 로 commit + push
                  → GitHub Pages 자동 serve (~30-60s lag, Phase 1 허용)

    Dev hot-loop 채널: localhost:8765/state 에서 메모리 in-process 응답
                       (별도 thread 의 http.server 사용, daemon 종료 시 같이 종료)
    """

    def __init__(self, repo_root: Path, publish_path: str,
                 http_port: int, log: logging.Logger):
        self.repo_root = repo_root
        self.publish_file = repo_root / publish_path
        self.publish_file.parent.mkdir(parents=True, exist_ok=True)
        self.http_port = http_port
        self.log = log
        self._latest: DashboardState | None = None
        self._latest_fp: str | None = None
        self._http_thread: threading.Thread | None = None

    def update(self, state: DashboardState) -> bool:
        """state 갱신. 변경 시 True 반환 (commit 트리거 필요).

        Debounce 는 caller (state_projection_loop) 에서 처리 — 여기는 idempotent.
        """
        fp = state.fingerprint()
        if fp == self._latest_fp:
            return False    # 동일 — no-op
        self._latest = state
        self._latest_fp = fp
        # Same-origin primary: 파일 write
        self.publish_file.write_text(state.to_json())
        return True

    def start_dev_http(self) -> None:
        """localhost:8765/state 서빙 시작. http_port=0 이면 no-op."""
        if self.http_port <= 0:
            return
        publisher = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path != "/state":
                    self.send_error(404); return
                if publisher._latest is None:
                    self.send_error(503, "no state yet"); return
                body = publisher._latest.to_json().encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")  # dev only
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, *_a):
                pass  # silence stdlib http logging — daemon 로그만 사용

        server = socketserver.TCPServer(("127.0.0.1", self.http_port), Handler)
        self._http_thread = threading.Thread(
            target=server.serve_forever, name="state-http", daemon=True)
        self._http_thread.start()
        self.log.info("state_projection: dev hot-loop on http://localhost:%d/state",
                      self.http_port)


# ════════════════════════════════════════════════════════════════════
# 4. Main loop — 30s polling 안에 통합 (별도 polling 추가 X)
# ════════════════════════════════════════════════════════════════════

async def state_projection_loop(
    cfg: Any,         # Config (lazy typing — daemon.py 와 의존성 분리)
    queue,            # GitHubIssuesQueue (Phase B 에서 SupabaseQueue 로 swap)
    publisher: StatePublisher,
    log: logging.Logger,
    stop: asyncio.Event,
) -> None:
    """daemon.py 의 새 coroutine. schema_v0.md §3 builder 규칙 1:1.

    흐름:
      1. build_state(queue) — Issues 결과 → DashboardState
      2. publisher.update(state) — fingerprint diff (메모리 + 파일 write)
      3. True 반환 시: 5초 debounce timer 시작. timer 중 추가 변경 들어오면 reset.
      4. Debounce 만료 → run_git_retry 로 add + commit + push.
      5. min commit interval (60s) 보장.
    """
    from . import git_deploy

    publisher.start_dev_http()
    etag_cache = cfg.workspace_dir / ".orchestrator" / "etag.cache"
    repo_root = cfg.auto_deploy_repos[0] if cfg.auto_deploy_repos else cfg.workspace_dir

    last_commit_at = 0.0
    pending_commit: asyncio.Task | None = None

    async def _debounced_commit():
        """5초 debounce → commit. cancel-safe."""
        nonlocal last_commit_at
        try:
            await asyncio.sleep(5.0)
        except asyncio.CancelledError:
            return    # 추가 변경 도착 → 새 timer 가 다시 시작
        # min commit interval
        import time
        now = time.time()
        if now - last_commit_at < 60.0:
            log.debug("state_projection: skip commit (rate limit %.1fs)",
                      now - last_commit_at)
            return
        path = publisher.publish_file
        # 파일 자체는 publisher.update 시 이미 write 됨 — 여기서는 add+commit+push
        rc, _, err = git_deploy.run_git_retry(
            ["git", "add", str(path)], repo_root, log)
        if rc != 0:
            log.warning("state_projection: git add failed: %s", err.strip()[:200])
            return
        rc, _, err = git_deploy.run_git_retry(
            ["git", "commit", "-m", f"state: dashboard-state.json {publisher._latest_fp}"],
            repo_root, log)
        if rc != 0 and "nothing to commit" not in (err or "").lower():
            log.warning("state_projection: git commit failed: %s", err.strip()[:200])
            return
        rc, _, err = git_deploy.run_git_retry(
            ["git", "push", "origin", "HEAD"], repo_root, log, timeout=60)
        if rc != 0:
            log.warning("state_projection: git push failed: %s", err.strip()[:200])
            return
        last_commit_at = time.time()
        log.info("state_projection: committed + pushed fp=%s",
                 publisher._latest_fp)

    while not stop.is_set():
        try:
            state = await build_state(
                queue,
                github_repo=cfg.github_repo or "kor22/dmj-site",
                etag_cache=etag_cache,
                log=log,
            )
            # cost.month_cap 주입 (build_state default 50 덮어쓰기)
            state.cost.month_cap_usd = cfg.monthly_budget_usd
            state.cost.month_remaining_usd = max(
                0.0, cfg.monthly_budget_usd - state.cost.month_total_usd)

            changed = publisher.update(state)
            if changed:
                log.info("state_projection: changed → debounce → commit (fp=%s)",
                         state.fingerprint())
                # 기존 pending timer cancel → 새 timer 시작 (5s 안 추가 변경 흡수)
                if pending_commit and not pending_commit.done():
                    pending_commit.cancel()
                pending_commit = asyncio.create_task(_debounced_commit())
        except Exception:
            log.exception("state_projection: cycle failed")

        try:
            await asyncio.wait_for(stop.wait(), timeout=cfg.poll_interval_seconds)
        except asyncio.TimeoutError:
            pass

    # 종료 — pending commit 마무리 시도
    if pending_commit and not pending_commit.done():
        pending_commit.cancel()


# ════════════════════════════════════════════════════════════════════
# 5. Integration point — daemon.py 가 호출할 entry
# ════════════════════════════════════════════════════════════════════
#
# daemon.py 에 추가될 코드 (spec — 실제 변경은 sprint 시점):
#
#   from . import state_projection
#
#   # main() 안:
#   publisher = state_projection.StatePublisher(
#       repo_root=cfg.auto_deploy_repos[0],
#       publish_path="site/admin/dashboard/dashboard-state.json",
#       http_port=int(os.environ.get("STATE_HTTP_PORT", "8765")),
#       log=log,
#   )
#   coros.append(state_projection.state_projection_loop(
#       cfg, queue_or_mock, publisher, log, stop))
#
# (deploy-only mode 에서는 queue=None → state.json 안 만들고 heartbeat 만, 또는
#  state_projection 자체 비활성화. config 옵션 STATE_PROJECTION_ENABLED=true 시작 전 추가.)
