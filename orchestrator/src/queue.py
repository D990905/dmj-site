"""Directive queue. Phase 1: GitHub Issues. Phase 2: Supabase swap-in."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Protocol

import httpx

from .status import Status


@dataclass
class Directive:
    directive_id: str
    specialist: str
    prompt: str
    repo_path: str | None = None
    branch: str | None = None
    max_budget_usd: float | None = None
    max_turns: int | None = None
    issue_number: int | None = None
    raw_title: str | None = None

    @classmethod
    def from_issue_body(cls, body: str, issue_number: int, title: str) -> "Directive | None":
        m = re.search(r"```json\s*(\{.*?\})\s*```", body or "", re.DOTALL)
        if not m:
            return None
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            return None
        if "directive_id" not in data or "prompt" not in data:
            return None
        return cls(
            directive_id=data["directive_id"],
            specialist=data.get("specialist", "general"),
            prompt=data["prompt"],
            repo_path=data.get("repo_path"),
            branch=data.get("branch"),
            max_budget_usd=data.get("max_budget_usd"),
            max_turns=data.get("max_turns"),
            issue_number=issue_number,
            raw_title=title,
        )


class Queue(Protocol):
    async def fetch_pending(self) -> list[Directive]: ...
    async def mark_in_progress(self, d: Directive) -> None: ...
    async def mark_done(self, d: Directive, status: Status) -> None: ...
    async def mark_error(self, d: Directive, status: Status) -> None: ...


class GitHubIssuesQueue:
    LABEL_DIRECTIVE = "directive"
    LABEL_PENDING = "pending"
    LABEL_IN_PROGRESS = "in_progress"
    LABEL_DONE = "done"
    LABEL_ERROR = "error"

    def __init__(self, token: str, owner: str, repo: str):
        self.owner = owner
        self.repo = repo
        self._client = httpx.AsyncClient(
            base_url="https://api.github.com",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "dmj-orchestrator-daemon",
            },
            timeout=15.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def fetch_pending(self) -> list[Directive]:
        r = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/issues",
            params={"labels": f"{self.LABEL_DIRECTIVE},{self.LABEL_PENDING}",
                    "state": "open", "per_page": 20},
        )
        r.raise_for_status()
        out: list[Directive] = []
        for item in r.json():
            if "pull_request" in item:
                continue
            d = Directive.from_issue_body(item.get("body", ""),
                                          item["number"], item["title"])
            if d:
                out.append(d)
        return out

    async def mark_in_progress(self, d: Directive) -> None:
        assert d.issue_number is not None
        await self._set_status_label(d.issue_number, self.LABEL_IN_PROGRESS,
                                     remove=[self.LABEL_PENDING])

    async def mark_done(self, d: Directive, status: Status) -> None:
        assert d.issue_number is not None
        await self._comment(d.issue_number, status)
        await self._set_status_label(d.issue_number, self.LABEL_DONE,
                                     remove=[self.LABEL_IN_PROGRESS, self.LABEL_PENDING])
        await self._client.patch(
            f"/repos/{self.owner}/{self.repo}/issues/{d.issue_number}",
            json={"state": "closed"},
        )

    async def mark_error(self, d: Directive, status: Status) -> None:
        assert d.issue_number is not None
        await self._comment(d.issue_number, status)
        await self._set_status_label(d.issue_number, self.LABEL_ERROR,
                                     remove=[self.LABEL_IN_PROGRESS, self.LABEL_PENDING])

    async def _set_status_label(self, issue: int, add: str,
                                remove: list[str]) -> None:
        await self._client.post(
            f"/repos/{self.owner}/{self.repo}/issues/{issue}/labels",
            json={"labels": [add]},
        )
        for label in remove:
            await self._client.delete(
                f"/repos/{self.owner}/{self.repo}/issues/{issue}/labels/{label}",
            )

    async def _comment(self, issue: int, status: Status) -> None:
        body = "```json\n" + status.to_json() + "\n```"
        await self._client.post(
            f"/repos/{self.owner}/{self.repo}/issues/{issue}/comments",
            json={"body": body},
        )
