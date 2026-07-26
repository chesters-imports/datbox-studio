#!/usr/bin/env python3
"""shotBOX ROM → The Deck Host (ROM files stay on this island)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
BOX_SYS = PROD / "box_sys"
DECK_HOST_PY = PROD.parents[2] / "the-deck-host" / "shell" / "deck_host.py"
URL = os.environ.get("SHOTBOX_URL", "http://127.0.0.1:43001/")
HEALTH = os.environ.get("SHOTBOX_HEALTH", "http://127.0.0.1:43001/api/health")


def main() -> int:
    if not BOX_SYS.is_dir():
        print(f"box_sys missing: {BOX_SYS}", file=sys.stderr)
        return 1
    if not DECK_HOST_PY.is_file():
        print(f"The Deck Host not found: {DECK_HOST_PY}", file=sys.stderr)
        return 1
    # Real argv to host — loreBOX on :42929, shotBOX on :43001 (do not share servers)
    server_cmd = f"{sys.executable} server.py"
    profile = os.environ.get("DECK_HOST_PROFILE", "datbox").strip() or "datbox"
    cmd = [
        sys.executable,
        str(DECK_HOST_PY),
        "--title",
        "shotBOX",
        "--url",
        URL,
        "--health",
        HEALTH,
        "--profile",
        profile,
        "--spawn",
        server_cmd,
        "--spawn-cwd",
        str(BOX_SYS),
    ]
    print("shotBOX · The Deck Host")
    print(f"  url: {URL}")
    print(f"  profile: {profile}")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
