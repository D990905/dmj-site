"""iCloud Drive helpers — placeholder download + lock-aware retries.

iCloud Drive 가 sync 한 폴더에서 git 을 돌릴 때 자주 만나는 에러 패턴:

  - "Resource deadlock avoided"            → EWOULDBLOCK (errno 35 on macOS)
    파일이 .icloud placeholder 인데 brctl 가 download 중. 또 다른 프로세스가
    동시에 read.
  - "Resource temporarily unavailable"     → EAGAIN
  - "Device or resource busy"              → EBUSY (16)
  - "fatal: Failed to resolve HEAD"        → .git/refs/heads/<branch> 가 아직 cloud
    에서 안 내려옴 (placeholder 상태)
  - ".git/index.lock could not be created" → 이전 git 작업 비정상 종료 잔재
                                             또는 동시 실행

이 모듈은:
  1. 위 패턴들을 정확히 분류
  2. .icloud placeholder 강제 다운로드 (brctl 또는 stat-as-trigger)
  3. .git 안의 모든 lock 파일 정리
"""
from __future__ import annotations

import errno
import os
import shutil
import subprocess
from pathlib import Path
from typing import Iterable

# OSError errno values that indicate iCloud / lock contention.
# These are macOS-specific values.
ICLOUD_TRANSIENT_ERRNOS = {
    errno.EWOULDBLOCK,            # 35 — "Resource deadlock avoided"
    errno.EAGAIN,                 # often same number on macOS
    errno.EBUSY,                  # 16 — "Device or resource busy"
    errno.EDEADLK,                # 11 — "Resource deadlock avoided"
}

# git stderr substrings that mean "try again after iCloud settles"
GIT_RETRYABLE_PATTERNS = (
    "Resource deadlock avoided",
    "Resource temporarily unavailable",
    "Device or resource busy",
    "Failed to resolve HEAD",
    "branch appears to be broken",
    "index.lock",
    "unable to create",
    "HEAD.lock",
    ".lock' could not be created",
)


def is_retryable_git_error(stderr: str) -> bool:
    """True if the git error is the kind iCloud + lock cleanup might fix."""
    if not stderr:
        return False
    return any(p in stderr for p in GIT_RETRYABLE_PATTERNS)


def is_retryable_oserror(exc: OSError) -> bool:
    return exc.errno in ICLOUD_TRANSIENT_ERRNOS


def clear_git_locks(repo: Path) -> int:
    """Delete all known git lock files. Returns count removed."""
    git_dir = repo / ".git"
    if not git_dir.exists():
        return 0
    removed = 0
    candidates: list[Path] = [
        git_dir / "index.lock",
        git_dir / "HEAD.lock",
        git_dir / "config.lock",
        git_dir / "packed-refs.lock",
    ]
    # All *.lock under refs/
    refs = git_dir / "refs"
    if refs.exists():
        candidates.extend(refs.rglob("*.lock"))
    # Top-level .git/*.lock (e.g. shallow.lock)
    candidates.extend(git_dir.glob("*.lock"))
    for p in candidates:
        try:
            if p.exists():
                p.unlink()
                removed += 1
        except OSError:
            pass
    return removed


def find_icloud_placeholders(repo: Path, scope: str = ".git") -> list[Path]:
    """Find `.X.icloud` placeholder files under `repo / scope`.

    A placeholder means the real file hasn't been downloaded from iCloud yet.
    Reading it will block or fail.
    """
    scope_path = repo / scope
    if not scope_path.exists():
        return []
    return [p for p in scope_path.rglob(".*.icloud")]


def force_icloud_download(repo: Path, scope: str = ".git",
                          timeout: int = 30) -> bool:
    """Trigger iCloud to download all placeholders under `scope`.

    Method 1: `brctl download <path>` (preferred — single command, recursive)
    Method 2: stat each .icloud placeholder (triggers download as side-effect)

    Returns True if a download was attempted, False if nothing to do or
    brctl unavailable.
    """
    scope_path = repo / scope
    if not scope_path.exists():
        return False

    if shutil.which("brctl"):
        try:
            subprocess.run(["brctl", "download", str(scope_path)],
                           check=False, capture_output=True, timeout=timeout)
            return True
        except subprocess.TimeoutExpired:
            return True  # download started, just slow

    # Fallback: stat each placeholder
    placeholders = find_icloud_placeholders(repo, scope)
    if not placeholders:
        return False
    for p in placeholders:
        try:
            os.stat(p)        # opening alone often triggers download
        except OSError:
            pass
    return True


def prepare_for_git(repo: Path) -> dict:
    """One-call prep: clear locks + trigger any pending iCloud downloads.

    Returns a small dict of what happened (useful for logging).
    """
    locks = clear_git_locks(repo)
    placeholders_before = len(find_icloud_placeholders(repo))
    triggered = False
    if placeholders_before > 0:
        triggered = force_icloud_download(repo)
    return {
        "locks_cleared": locks,
        "placeholders_found": placeholders_before,
        "icloud_download_triggered": triggered,
    }
