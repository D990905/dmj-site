"""Entry point: `python -m src` from the orchestrator directory."""
import asyncio
import sys

from .daemon import main


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        sys.exit(0)
