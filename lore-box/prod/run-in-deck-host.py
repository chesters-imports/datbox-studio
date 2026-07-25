#!/usr/bin/env python3
"""
loreBOX ROM → The Deck Host

Starts this ROM's desk server, opens The Deck Host on it, stops the server when
the window closes. Does not copy loreBOX into the host repo.

  double-click run-loreBOX.bat
  or:  python run-in-deck-host.py
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
BOX_SYS = PROD / "box_sys"
# ALICE_BOX/datbox-studio/lore-box/prod → ../../../../the-deck-host/shell
DECK_SHELL = PROD.parents[2] / "the-deck-host" / "shell"
DECK_HOST_PY = DECK_SHELL / "deck_host.py"

URL = os.environ.get("LOREBOX_URL", "http://127.0.0.1:42929/")
HEALTH = os.environ.get("LOREBOX_HEALTH", "http://127.0.0.1:42929/api/health")
PORT = os.environ.get("LOREBOX_PORT", "42929")


def main() -> int:
    if not BOX_SYS.is_dir():
        print(f"loreBOX box_sys missing: {BOX_SYS}", file=sys.stderr)
        return 1
    if not DECK_HOST_PY.is_file():
        print(f"The Deck Host not found: {DECK_HOST_PY}", file=sys.stderr)
        print("Expected sibling island: ALICE_BOX/the-deck-host/shell/", file=sys.stderr)
        return 1

    # Spawn server.py via host --spawn; host kills it on exit
    server_cmd = f'"{sys.executable}" server.py'
    cmd = [
        sys.executable,
        str(DECK_HOST_PY),
        "--title",
        "loreBOX",
        "--url",
        URL,
        "--health",
        HEALTH,
        "--spawn",
        server_cmd,
        "--spawn-cwd",
        str(BOX_SYS),
    ]
    print("loreBOX · The Deck Host")
    print(f"  ROM server: {BOX_SYS}")
    print(f"  host:       {DECK_HOST_PY}")
    print(f"  url:        {URL}")
    # Inherit console so first-run errors are visible; use pythonw/bat for quiet
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
