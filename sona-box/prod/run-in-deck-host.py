#!/usr/bin/env python3
"""sonaBOX → The Deck Host"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
BOX_SYS = PROD / "box_sys"
DECK_HOST_PY = PROD.parents[2] / "the-deck-host" / "shell" / "deck_host.py"

PORT = os.environ.get("SONABOX_PORT", "42935")
URL = f"http://127.0.0.1:{PORT}/"
HEALTH = f"http://127.0.0.1:{PORT}/api/health"


def main() -> int:
    if not (BOX_SYS / "server.py").is_file():
        print("box_sys missing", file=sys.stderr)
        return 1
    if not DECK_HOST_PY.is_file():
        print(f"Deck Host missing: {DECK_HOST_PY}", file=sys.stderr)
        return 1
    profile = os.environ.get("DECK_HOST_PROFILE", "desk").strip() or "desk"
    cmd = [
        sys.executable,
        str(DECK_HOST_PY),
        "--title",
        "sonaBOX",
        "--profile",
        profile,
        "--width",
        os.environ.get("SONABOX_WIDTH", "1100"),
        "--height",
        os.environ.get("SONABOX_HEIGHT", "720"),
        "--url",
        URL,
        "--health",
        HEALTH,
        "--health-timeout",
        "20",
        "--spawn",
        f"{sys.executable} server.py",
        "--spawn-cwd",
        str(BOX_SYS),
    ]
    print(f"sonaBOX · CO.DBS-SONA · Deck Host :{PORT}")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
