"""Dry-run verification. No network, no SDK calls.

Run from orchestrator/ directory:  python -m tests.test_dry_run
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_imports_deploy_only():
    """Deploy-only mode must work without httpx / claude-agent-sdk."""
    from src import config, cost, git_deploy, icloud, log, notify  # noqa
    print("OK imports_deploy_only")


def test_icloud_detection():
    from src import icloud
    assert icloud.is_retryable_git_error("fatal: Resource deadlock avoided")
    assert icloud.is_retryable_git_error("Failed to resolve HEAD")
    assert icloud.is_retryable_git_error(".git/index.lock could not be created")
    assert not icloud.is_retryable_git_error("syntax error in commit message")
    assert not icloud.is_retryable_git_error("")
    print("OK icloud_detection")


def test_clear_locks(tmp_dir: Path):
    from src import icloud
    git = tmp_dir / ".git"
    (git / "refs" / "heads").mkdir(parents=True)
    (git / "index.lock").write_text("")
    (git / "HEAD.lock").write_text("")
    (git / "refs" / "heads" / "main.lock").write_text("")
    removed = icloud.clear_git_locks(tmp_dir)
    assert removed == 3, f"expected 3, got {removed}"
    assert not (git / "index.lock").exists()
    print("OK clear_locks")


def test_git_deploy_no_repo(tmp_dir: Path):
    from src import git_deploy
    assert git_deploy.has_pending_tracked_changes(tmp_dir) is False
    assert git_deploy.head_is_healthy(tmp_dir) is False
    print("OK git_deploy_no_repo")


def test_status_serialize():
    """Status import requires git_deploy but not httpx — should work."""
    from src.status import Status
    s = Status(directive_id="dir_x", state="done", cost_usd=0.42,
               tokens={"input": 100, "output": 50}, turns=3,
               commits=["abc1234"], summary="did it")
    d = json.loads(s.to_json())
    assert d["state"] == "done"
    print("OK status_serialize")


def test_config_deploy_only_no_secrets():
    """Deploy-only mode (default) must NOT require API keys."""
    import os
    from src import config
    saved = {k: os.environ.pop(k, None)
             for k in ("ANTHROPIC_API_KEY", "GITHUB_TOKEN", "GITHUB_REPO",
                       "ENABLE_DIRECTIVE_LOOP")}
    orig_env_path = config.ENV_PATH
    config.ENV_PATH = Path("/nonexistent/orchestrator/.env")
    orig_kc = config._keychain_get
    config._keychain_get = lambda _: None
    try:
        cfg = config.load()
        assert cfg.enable_directive_loop is False
        assert cfg.anthropic_api_key is None
        print("OK config_deploy_only_no_secrets")
    finally:
        config.ENV_PATH = orig_env_path
        config._keychain_get = orig_kc
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


def test_config_full_mode_requires_keys():
    import os
    from src import config
    saved = {k: os.environ.pop(k, None)
             for k in ("ANTHROPIC_API_KEY", "GITHUB_TOKEN", "GITHUB_REPO")}
    os.environ["ENABLE_DIRECTIVE_LOOP"] = "true"
    orig_env_path = config.ENV_PATH
    config.ENV_PATH = Path("/nonexistent/orchestrator/.env")
    orig_kc = config._keychain_get
    config._keychain_get = lambda _: None
    try:
        try:
            config.load()
        except SystemExit as e:
            assert "missing" in str(e).lower()
            print("OK config_full_mode_requires_keys")
        else:
            raise AssertionError("expected SystemExit")
    finally:
        config.ENV_PATH = orig_env_path
        config._keychain_get = orig_kc
        os.environ.pop("ENABLE_DIRECTIVE_LOOP", None)
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


def test_auto_commit_message():
    from src import git_deploy
    # Direct unit test of message format
    import unittest.mock as mock
    with tempfile.TemporaryDirectory() as td:
        repo = Path(td)
        with mock.patch.object(git_deploy, "_run", return_value=(0, "file_a.html\nfile_b.css\n", "")):
            msg = git_deploy._auto_commit_message(repo)
            assert "file_a.html" in msg
            assert "file_b.css" in msg
            assert "auto-deploy" in msg
    print("OK auto_commit_message")


def main():
    test_imports_deploy_only()
    test_icloud_detection()
    test_status_serialize()
    test_auto_commit_message()
    test_config_deploy_only_no_secrets()
    test_config_full_mode_requires_keys()
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        test_clear_locks(tmp)
        test_git_deploy_no_repo(tmp)
    print("\nALL DRY-RUN TESTS PASSED")


if __name__ == "__main__":
    main()
