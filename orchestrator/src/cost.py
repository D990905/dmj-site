"""Cost tracker. Persists usage to ~/.config/orchestrator/usage.json."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from threading import Lock

USAGE_PATH = Path.home() / ".config" / "orchestrator" / "usage.json"
_LOCK = Lock()


@dataclass
class UsageSnapshot:
    month_total: float
    today_total: float
    last_dispatch_cost: float


def _ym(d: date) -> str: return f"{d.year:04d}-{d.month:02d}"
def _ymd(d: date) -> str: return d.isoformat()


def _load() -> dict:
    today = date.today()
    default = {"month": _ym(today), "month_total": 0.0,
               "day": _ymd(today), "day_total": 0.0,
               "last_dispatch": 0.0, "dispatches": 0}
    if not USAGE_PATH.exists():
        return default
    try:
        return json.loads(USAGE_PATH.read_text())
    except Exception:
        return default


def _save(d: dict) -> None:
    USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = USAGE_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(d, indent=2))
    tmp.replace(USAGE_PATH)


def record(cost_usd: float) -> UsageSnapshot:
    with _LOCK:
        u = _load()
        today = date.today()
        if u.get("month") != _ym(today):
            u["month"] = _ym(today); u["month_total"] = 0.0
        if u.get("day") != _ymd(today):
            u["day"] = _ymd(today); u["day_total"] = 0.0
        u["month_total"] = float(u.get("month_total", 0.0)) + cost_usd
        u["day_total"] = float(u.get("day_total", 0.0)) + cost_usd
        u["last_dispatch"] = cost_usd
        u["dispatches"] = int(u.get("dispatches", 0)) + 1
        _save(u)
        return UsageSnapshot(u["month_total"], u["day_total"], cost_usd)


def snapshot() -> UsageSnapshot:
    with _LOCK:
        u = _load()
        return UsageSnapshot(
            float(u.get("month_total", 0.0)),
            float(u.get("day_total", 0.0)),
            float(u.get("last_dispatch", 0.0)),
        )
