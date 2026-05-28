"""macOS notifications via osascript. Silent no-op on non-macOS systems."""
from __future__ import annotations

import shutil
import subprocess


def notify(title: str, message: str, subtitle: str | None = None) -> None:
    if not shutil.which("osascript"):
        return
    parts = [f'display notification "{_esc(message)}"', f'with title "{_esc(title)}"']
    if subtitle:
        parts.append(f'subtitle "{_esc(subtitle)}"')
    script = " ".join(parts)
    try:
        subprocess.run(["osascript", "-e", script], check=False, timeout=5,
                       capture_output=True)
    except subprocess.TimeoutExpired:
        pass


def _esc(s: str) -> str:
    return s.replace('\\', '\\\\').replace('"', '\\"')
