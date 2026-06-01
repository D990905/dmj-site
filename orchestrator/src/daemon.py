"""Main daemon event loop.

Modes:
  - deploy-only: only the git auto-deploy loop runs (no API keys needed)
  - full: deploy + directive polling + agent dispatch

Phase 1 default = deploy-only (immediate value, zero risk). Flip
ENABLE_DIRECTIVE_LOOP=true in .env after smoke-testing the directive flow.
"""
from __future__ import annotations

import asyncio
import json
import signal
from datetime import datetime, timezone

from . import cost, git_deploy
from .config import Config, load as load_config
from .log import event, setup as setup_log
from .notify import notify

# state_projection 은 옵션 — full mode 또는 ENABLE_STATE_PROJECTION=true 시 활성


async def deploy_loop(cfg: Config, log, stop: asyncio.Event) -> None:
    if not cfg.auto_deploy_repos:
        log.info("auto-deploy disabled (no AUTO_DEPLOY_REPOS configured)")
        return
    await git_deploy.run_loop(list(cfg.auto_deploy_repos),
                              cfg.poll_interval_seconds, log, stop)


async def heartbeat_loop(cfg: Config, log, stop: asyncio.Event) -> None:
    hb_path = cfg.workspace_dir / ".orchestrator" / "heartbeat.json"
    hb_path.parent.mkdir(parents=True, exist_ok=True)
    while not stop.is_set():
        snap = cost.snapshot()
        hb_path.write_text(json.dumps({
            "ts": datetime.now(timezone.utc).isoformat(),
            "month_total_usd": snap.month_total,
            "day_total_usd": snap.today_total,
            "last_dispatch_usd": snap.last_dispatch_cost,
            "mode": "full" if cfg.enable_directive_loop else "deploy-only",
        }, indent=2))
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
        except asyncio.TimeoutError:
            pass


async def _state_projection_coro(cfg: Config, log, stop: asyncio.Event) -> None:
    """state projection coroutine — Phase 1 sprint deliverable.

    Issues 폴링 → state.json 빌드 → diff 시 commit + push + localhost:8765 노출.
    GitHub Token 필요. ENABLE_STATE_PROJECTION=true 시 시작.
    """
    if not cfg.github_token or not cfg.github_repo:
        log.warning("state_projection: GITHUB_TOKEN + GITHUB_REPO 필요, skip")
        return
    if not cfg.auto_deploy_repos:
        log.warning("state_projection: AUTO_DEPLOY_REPOS 필요 (commit 대상), skip")
        return
    from . import state_projection
    from . import queue as queue_mod

    queue = queue_mod.GitHubIssuesQueue(
        cfg.github_token, cfg.github_owner, cfg.github_repo_name)
    publisher = state_projection.StatePublisher(
        repo_root=cfg.auto_deploy_repos[0],
        publish_path=cfg.state_publish_path,
        http_port=cfg.state_http_port,
        log=log,
    )
    try:
        await state_projection.state_projection_loop(cfg, queue, publisher, log, stop)
    finally:
        await queue.aclose()


async def directive_loop(cfg: Config, log, stop: asyncio.Event) -> None:
    """Imported lazily so deploy-only mode doesn't need httpx / SDK."""
    from . import queue as queue_mod
    from . import dispatcher
    from .status import GitCommitSink

    queue = queue_mod.GitHubIssuesQueue(
        cfg.github_token, cfg.github_owner, cfg.github_repo_name)
    sink = GitCommitSink(cfg.workspace_dir)

    try:
        while not stop.is_set():
            try:
                snap = cost.snapshot()
                if snap.month_total >= cfg.monthly_budget_usd:
                    event(log, "budget_cap_reached", month_total=snap.month_total,
                          cap=cfg.monthly_budget_usd)
                    notify("Orchestrator paused",
                           f"Monthly cap hit (${snap.month_total:.2f})")
                    try:
                        await asyncio.wait_for(stop.wait(),
                                               timeout=cfg.poll_interval_seconds * 4)
                    except asyncio.TimeoutError:
                        pass
                    continue

                directives = await queue.fetch_pending()
                for d in directives:
                    event(log, "directive_pickup", directive_id=d.directive_id,
                          specialist=d.specialist, issue=d.issue_number)
                    await queue.mark_in_progress(d)
                    status = await dispatcher.dispatch(
                        d,
                        workspace=cfg.workspace_dir,
                        api_key=cfg.anthropic_api_key,
                        default_max_budget_usd=cfg.default_max_budget_usd,
                        default_max_turns=cfg.default_max_turns,
                        log=log,
                    )
                    snap = cost.record(status.cost_usd)
                    event(log, "dispatch_done", directive_id=d.directive_id,
                          state=status.state, cost=status.cost_usd,
                          month_total=snap.month_total)
                    try:
                        await sink.write(status)
                    except Exception:
                        log.exception("sink write failed")
                    try:
                        if status.state == "done":
                            await queue.mark_done(d, status)
                        else:
                            await queue.mark_error(d, status)
                    except Exception:
                        log.exception("queue state update failed")
            except Exception:
                log.exception("directive_loop iteration failed")
            try:
                await asyncio.wait_for(stop.wait(),
                                       timeout=cfg.poll_interval_seconds)
            except asyncio.TimeoutError:
                pass
    finally:
        await queue.aclose()


async def main() -> int:
    cfg = load_config()
    cfg.workspace_dir.mkdir(parents=True, exist_ok=True)
    log = setup_log(cfg.log_dir)
    event(log, "daemon_start",
          mode="full" if cfg.enable_directive_loop else "deploy-only",
          workspace=str(cfg.workspace_dir),
          auto_deploy_count=len(cfg.auto_deploy_repos),
          repos=[str(p) for p in cfg.auto_deploy_repos])

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    coros = [deploy_loop(cfg, log, stop), heartbeat_loop(cfg, log, stop)]
    if cfg.enable_directive_loop:
        coros.append(directive_loop(cfg, log, stop))
    if cfg.enable_state_projection:
        coros.append(_state_projection_coro(cfg, log, stop))

    try:
        await asyncio.gather(*coros)
    finally:
        event(log, "daemon_stop")
    return 0
