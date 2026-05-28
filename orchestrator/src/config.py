"""Config loader. Source order: macOS Keychain > .env file > environment."""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "orchestrator"
ENV_PATH = CONFIG_DIR / ".env"

KEYCHAIN_ITEMS = {
    "ANTHROPIC_API_KEY": "orchestrator-anthropic-api-key",
    "GITHUB_TOKEN": "orchestrator-github-token",
}


def _keychain_get(item_name: str) -> str | None:
    if not shutil.which("security"):
        return None
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-a", os.environ.get("USER", ""),
             "-s", item_name, "-w"],
            check=True, capture_output=True, text=True, timeout=5,
        )
        return out.stdout.strip() or None
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None


def _load_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _resolve(key: str, dotenv: dict[str, str], default: str | None = None) -> str | None:
    if key in KEYCHAIN_ITEMS:
        kc = _keychain_get(KEYCHAIN_ITEMS[key])
        if kc:
            return kc
    if key in dotenv:
        return dotenv[key]
    if key in os.environ:
        return os.environ[key]
    return default


@dataclass(frozen=True)
class Config:
    anthropic_api_key: str | None       # optional in deploy-only mode
    github_token: str | None            # optional if directives disabled
    github_repo: str | None             # "owner/repo"

    poll_interval_seconds: int
    monthly_budget_usd: float
    daily_notify_usd: float
    default_max_budget_usd: float
    default_max_turns: int

    workspace_dir: Path
    auto_deploy_repos: tuple[Path, ...]
    log_dir: Path

    enable_directive_loop: bool         # OFF for deploy-only deployment

    @property
    def github_owner(self) -> str | None:
        return self.github_repo.split("/", 1)[0] if self.github_repo else None

    @property
    def github_repo_name(self) -> str | None:
        return self.github_repo.split("/", 1)[1] if self.github_repo else None


def load() -> Config:
    """Two-tier validation: auto-deploy can run alone (no API keys needed).
    Full daemon (directive loop) requires API keys."""
    dotenv = _load_dotenv(ENV_PATH)

    def opt(k: str, default: str = "") -> str:
        return _resolve(k, dotenv, default) or default

    enable_directive = opt("ENABLE_DIRECTIVE_LOOP", "false").lower() in ("1", "true", "yes")

    anthropic = _resolve("ANTHROPIC_API_KEY", dotenv)
    github_token = _resolve("GITHUB_TOKEN", dotenv)
    github_repo = _resolve("GITHUB_REPO", dotenv)

    if enable_directive:
        missing = [k for k, v in (
            ("ANTHROPIC_API_KEY", anthropic),
            ("GITHUB_TOKEN", github_token),
            ("GITHUB_REPO", github_repo),
        ) if not v]
        if missing:
            raise SystemExit(
                f"Directive loop enabled but missing: {', '.join(missing)}. "
                f"Set via macOS Keychain or {ENV_PATH}."
            )

    auto_repos = tuple(
        Path(p.strip()).expanduser()
        for p in opt("AUTO_DEPLOY_REPOS", "").split(",")
        if p.strip()
    )

    return Config(
        anthropic_api_key=anthropic,
        github_token=github_token,
        github_repo=github_repo,
        poll_interval_seconds=int(opt("POLL_INTERVAL_SECONDS", "30")),
        monthly_budget_usd=float(opt("MONTHLY_BUDGET_USD", "50")),
        daily_notify_usd=float(opt("DAILY_NOTIFY_USD", "10")),
        default_max_budget_usd=float(opt("DEFAULT_MAX_BUDGET_USD", "1.50")),
        default_max_turns=int(opt("DEFAULT_MAX_TURNS", "30")),
        workspace_dir=Path(opt("WORKSPACE_DIR",
                               str(Path.home() / "dev" / "orchestrator-workspace"))).expanduser(),
        auto_deploy_repos=auto_repos,
        log_dir=Path(opt("LOG_DIR",
                         str(Path.home() / "Library" / "Logs" / "Orchestrator"))).expanduser(),
        enable_directive_loop=enable_directive,
    )
