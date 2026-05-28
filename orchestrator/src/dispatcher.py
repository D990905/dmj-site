"""Dispatcher — wraps Claude Agent SDK. Maps directive → specialist agent."""
from __future__ import annotations

import logging
import os
import subprocess
from pathlib import Path

from .queue import Directive
from .status import Status, now_iso

SPECIALIST_PROMPTS = {
    "frontend": (
        "You are a senior frontend engineer (vanilla JS / lit-html / React). "
        "Make minimal, focused changes. Run any existing tests before claiming done. "
        "Never edit backend, infra, or sensor firmware files."
    ),
    "dataviz": (
        "You are a data visualization specialist. "
        "Follow the patterns in _experts/expert_dataviz_reference.md. "
        "Only edit chart, theme, and analysis modules."
    ),
    "hardware": (
        "You are a hardware/embedded engineer. "
        "Phase 1 — do NOT write production code. Only spec/research/markdown."
    ),
    "general": (
        "You are a careful software engineer. Make the smallest correct change. "
        "Verify your work before claiming done."
    ),
}

GLOBAL_DISALLOWED = [
    "Bash(rm -rf *)",
    "Bash(rm -rf /)",
    "Bash(curl * | sh)",
    "Bash(curl * | bash)",
]


def _git_head(repo: Path) -> str | None:
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=repo,
                             check=True, capture_output=True, text=True, timeout=5)
        return out.stdout.strip()
    except Exception:
        return None


def _commits_since(repo: Path, base_sha: str | None) -> list[str]:
    if not base_sha:
        return []
    try:
        out = subprocess.run(
            ["git", "rev-list", f"{base_sha}..HEAD"],
            cwd=repo, check=True, capture_output=True, text=True, timeout=5,
        )
        return [s.strip()[:7] for s in out.stdout.splitlines() if s.strip()]
    except Exception:
        return []


async def dispatch(directive: Directive, *, workspace: Path, api_key: str,
                   default_max_budget_usd: float, default_max_turns: int,
                   log: logging.Logger) -> Status:
    # Lazy SDK import — config can validate without SDK installed
    from claude_agent_sdk import (
        query, ClaudeAgentOptions,
        AssistantMessage, TextBlock, ResultMessage,
    )

    started = now_iso()
    cwd = (workspace / directive.repo_path).resolve() if directive.repo_path else workspace
    cwd.mkdir(parents=True, exist_ok=True)
    base_sha = _git_head(cwd)

    options = ClaudeAgentOptions(
        system_prompt=SPECIALIST_PROMPTS.get(directive.specialist,
                                             SPECIALIST_PROMPTS["general"]),
        permission_mode="acceptEdits",
        disallowed_tools=GLOBAL_DISALLOWED,
        max_turns=directive.max_turns or default_max_turns,
        max_budget_usd=directive.max_budget_usd or default_max_budget_usd,
        cwd=str(cwd),
        env={"ANTHROPIC_API_KEY": api_key, **os.environ},
    )

    status = Status(
        directive_id=directive.directive_id,
        state="in_progress",
        started_at=started,
        specialist=directive.specialist,
    )

    last_text: list[str] = []
    try:
        async for msg in query(prompt=directive.prompt, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        last_text.append(block.text)
            elif isinstance(msg, ResultMessage):
                status.cost_usd = float(msg.total_cost_usd or 0.0)
                usage = msg.usage or {}
                status.tokens = {
                    "input": int(usage.get("input_tokens", 0)),
                    "output": int(usage.get("output_tokens", 0)),
                }
                status.turns = int(msg.num_turns or 0)
                if msg.is_error:
                    status.state = "error"
                    status.error = msg.result or "agent reported error"
                else:
                    status.state = "done"
                    status.summary = (msg.result or (last_text[-1] if last_text else "")).strip()[:2000]
    except Exception as e:
        log.exception("dispatch failed: %s", e)
        status.state = "error"
        status.error = f"{type(e).__name__}: {e}"

    status.finished_at = now_iso()
    status.commits = _commits_since(cwd, base_sha)
    return status
