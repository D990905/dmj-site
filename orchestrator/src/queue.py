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

    async def fetch_all_directives(self, etag: str | None = None) -> tuple[list[dict], str | None]:
        """state.json projection 용 — 모든 directive 라벨 fetch (state 무관).

        ETag 캐싱 지원: 304 Not Modified 시 ([], etag) 반환 (변경 없음).
        Phase 1 SoT = Issues. 라벨 'directive' 만 필터, state 별 분류는 projection 단계.

        Returns:
          (issues, new_etag) — issues 는 GitHub API raw dict list (full body + comments_url)
        """
        headers = {}
        if etag:
            headers["If-None-Match"] = etag

        r = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/issues",
            params={"labels": self.LABEL_DIRECTIVE,
                    "state": "all", "per_page": 100, "sort": "updated", "direction": "desc"},
            headers=headers,
        )
        if r.status_code == 304:
            return [], etag
        r.raise_for_status()
        new_etag = r.headers.get("ETag")
        issues = [item for item in r.json() if "pull_request" not in item]
        return issues, new_etag

    async def fetch_issue_comments(self, issue_number: int) -> list[dict]:
        """단일 issue 의 comments — status JSON 추출용 (마지막 fenced json block)."""
        r = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/issues/{issue_number}/comments",
            params={"per_page": 100},
        )
        r.raise_for_status()
        return r.json()

    def labels_of(self, issue: dict) -> set[str]:
        """Issue dict 의 label 이름 set."""
        return {lbl["name"] for lbl in issue.get("labels", []) if isinstance(lbl, dict)}

    def state_from_labels(self, labels: set[str]) -> str:
        """라벨 우선순위 → directive status. schema_v0.md §3-1 rule 4."""
        if self.LABEL_ERROR in labels: return "error"
        if self.LABEL_DONE in labels: return "done"
        if self.LABEL_IN_PROGRESS in labels: return "in_progress"
        return "pending"

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
