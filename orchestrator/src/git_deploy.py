"""Git auto-deploy — iCloud-aware replacement for PUSH-FIX.command.

Strategy:
  1. Periodically scan each watched repo for tracked-file changes.
  2. On change: prepare (clear locks + download iCloud placeholders) →
     stage → commit (auto-generated message) → push.
  3. Every git command goes through `run_git_retry()`:
       - on retryable error (iCloud / lock), exponential backoff + re-prepare
       - on push rejection (non-fast-forward), pull --rebase + push again
  4. Untracked files are NOT auto-added (safer default; explicit `git add`
     remains the user's gesture for new files).

Concurrent runs are prevented via a per-repo file lock.
"""
from __future__ import annotations

import asyncio
import logging
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from . import icloud

# Retry policy
MAX_RETRIES = 8
INITIAL_BACKOFF_SEC = 1.0
MAX_BACKOFF_SEC = 16.0


def _run(cmd: list[str], cwd: Path, timeout: int = 30) -> tuple[int, str, str]:
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                           timeout=timeout, check=False)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, "", f"timeout after {timeout}s"
    except OSError as e:
        return -1, "", f"{type(e).__name__}: {e}"


def run_git_retry(cmd: list[str], repo: Path, log: logging.Logger,
                  timeout: int = 30) -> tuple[int, str, str]:
    """Run a git command with iCloud-aware retry."""
    delay = INITIAL_BACKOFF_SEC
    last = (-1, "", "no attempt")
    for attempt in range(1, MAX_RETRIES + 1):
        prep = icloud.prepare_for_git(repo)
        if prep["locks_cleared"] or prep["icloud_download_triggered"]:
            log.debug("git prep: %s (attempt %d)", prep, attempt)
        rc, out, err = _run(cmd, repo, timeout)
        last = (rc, out, err)
        if rc == 0:
            return last
        if not icloud.is_retryable_git_error(err) and not icloud.is_retryable_git_error(out):
            return last     # non-retriable, surface immediately
        log.info("git retry %d/%d after %.1fs (%s): %s",
                 attempt, MAX_RETRIES, delay,
                 " ".join(cmd[:3]), err.strip()[:200] or out.strip()[:200])
        time.sleep(delay)
        delay = min(delay * 2, MAX_BACKOFF_SEC)
    return last


def head_is_healthy(repo: Path) -> bool:
    rc, _, _ = _run(["git", "rev-parse", "--verify", "HEAD"], repo, timeout=10)
    return rc == 0


def has_pending_tracked_changes(repo: Path) -> bool:
    """True if there are modifications to tracked files (not just untracked)."""
    rc, out, _ = _run(["git", "status", "--porcelain"], repo, timeout=10)
    if rc != 0:
        return False
    for line in out.splitlines():
        if line and not line.startswith("??"):
            return True
    return False


def _commits_ahead_of_origin(repo: Path) -> int:
    rc, out, _ = _run(["git", "rev-list", "--count", "@{u}..HEAD"], repo, timeout=10)
    if rc != 0:
        return 0
    try:
        return int(out.strip())
    except ValueError:
        return 0


def _auto_commit_message(repo: Path) -> str:
    rc, out, _ = _run(["git", "diff", "--cached", "--name-only"], repo, timeout=10)
    files = [l for l in out.splitlines() if l] if rc == 0 else []
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if not files:
        return f"auto-deploy: heartbeat {ts}"
    sample = " ".join(files[:3])
    if len(files) <= 3:
        return f"auto-deploy: {sample} ({ts})"
    return f"auto-deploy: {sample} +{len(files) - 3} more ({ts})"


def deploy_once(repo: Path, log: logging.Logger) -> bool:
    """One full add → commit → push cycle. Returns True on push success."""
    # 0. Sanity
    if not (repo / ".git").exists():
        log.warning("auto-deploy: %s is not a git repo, skipping", repo)
        return False

    # 1. HEAD healthy?
    icloud.prepare_for_git(repo)
    if not head_is_healthy(repo):
        log.warning("auto-deploy: HEAD broken in %s — triggering iCloud download "
                    "and waiting 5s", repo)
        icloud.force_icloud_download(repo, scope=".git")
        time.sleep(5)
        if not head_is_healthy(repo):
            log.error("auto-deploy: HEAD still broken in %s — manual intervention", repo)
            return False

    # 2. Anything to do?
    has_changes = has_pending_tracked_changes(repo)
    ahead = _commits_ahead_of_origin(repo)
    if not has_changes and ahead == 0:
        return False    # nothing to do, not an error

    # 3. Stage + commit
    if has_changes:
        rc, _, err = run_git_retry(["git", "add", "-u"], repo, log)
        if rc != 0:
            log.error("auto-deploy: git add failed: %s", err.strip()[:300])
            return False
        msg = _auto_commit_message(repo)
        rc, _, err = run_git_retry(["git", "commit", "-m", msg], repo, log)
        if rc != 0 and "nothing to commit" not in err.lower():
            log.error("auto-deploy: git commit failed: %s", err.strip()[:300])
            return False
        log.info("auto-deploy: committed: %s", msg)

    # 4. Push, with pull --rebase fallback
    rc, _, err = run_git_retry(["git", "push", "origin", "HEAD"], repo, log, timeout=60)
    if rc != 0:
        if any(p in err for p in ("non-fast-forward", "fetch first", "rejected")):
            log.info("auto-deploy: push rejected, trying pull --rebase")
            rc_r, _, err_r = run_git_retry(
                ["git", "pull", "--rebase", "origin", "HEAD"], repo, log, timeout=60)
            if rc_r != 0:
                log.error("auto-deploy: pull --rebase failed: %s",
                          err_r.strip()[:300])
                return False
            rc, _, err = run_git_retry(
                ["git", "push", "origin", "HEAD"], repo, log, timeout=60)
            if rc != 0:
                log.error("auto-deploy: push after rebase failed: %s",
                          err.strip()[:300])
                return False
        else:
            log.error("auto-deploy: push failed: %s", err.strip()[:300])
            return False

    log.info("auto-deploy: pushed %s", repo)
    return True


async def run_loop(repos: list[Path], interval_seconds: int,
                   log: logging.Logger, stop: asyncio.Event) -> None:
    """Long-running coroutine. Cancel-safe via the `stop` event."""
    while not stop.is_set():
        for r in repos:
            if not r.exists():
                continue
            try:
                deploy_once(r, log)
            except Exception:
                log.exception("auto-deploy crashed for %s", r)
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            pass
