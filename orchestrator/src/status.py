"""Status records + sinks (only used in full daemon mode)."""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from . import git_deploy


@dataclass
class Status:
    directive_id: str
    state: str                       # "pending" | "in_progress" | "done" | "error"
    started_at: str | None = None
    finished_at: str | None = None
    specialist: str | None = None
    cost_usd: float = 0.0
    tokens: dict = field(default_factory=lambda: {"input": 0, "output": 0})
    turns: int = 0
    commits: list[str] = field(default_factory=list)
    summary: str | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class StatusSink(Protocol):
    async def write(self, status: Status) -> None: ...


class GitCommitSink:
    """Writes status JSON into the workspace repo and commits/pushes.

    Reuses git_deploy.run_git_retry so iCloud lock handling is shared.
    """
    def __init__(self, workspace_dir: Path):
        self.workspace = workspace_dir

    async def write(self, status: Status) -> None:
        import logging
        log = logging.getLogger("orchestrator")
        out_dir = self.workspace / ".orchestrator" / "status"
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / f"{status.directive_id}.json"
        path.write_text(status.to_json())

        git_deploy.run_git_retry(["git", "add", str(path)], self.workspace, log)
        git_deploy.run_git_retry(
            ["git", "commit", "-m",
             f"status: {status.directive_id} {status.state}"],
            self.workspace, log)
        git_deploy.run_git_retry(
            ["git", "push", "origin", "HEAD"], self.workspace, log, timeout=60)
