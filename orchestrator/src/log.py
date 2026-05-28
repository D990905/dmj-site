"""Structured logger. Plain text + JSON line per event. Rotates by day."""
from __future__ import annotations

import json
import logging
import logging.handlers
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def setup(log_dir: Path) -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("orchestrator")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)

    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)-7s %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    ))
    logger.addHandler(sh)

    fh = logging.handlers.TimedRotatingFileHandler(
        log_dir / "orchestrator.log",
        when="midnight", interval=1, backupCount=14, utc=True,
    )
    fh.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)-7s %(name)s — %(message)s"
    ))
    logger.addHandler(fh)
    return logger


def event(log: logging.Logger, kind: str, **fields: Any) -> None:
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        **fields,
    }
    log.info("EVENT " + json.dumps(payload, default=str, ensure_ascii=False))
