#!/usr/bin/env python3
"""
loreBOX ROM → The Deck Host

Starts this ROM's desk server, opens The Deck Host on it, stops the server when
the window closes. Does not copy loreBOX into the host repo.

  double-click run-loreBOX.bat
  or:  python run-in-deck-host.py

Reads box_sets/desk_prefs.json for window_mode so size restores on cold start
(JS alone was racing create_window and silently losing Expanded/Maximized).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
BOX_SYS = PROD / "box_sys"
PREFS = PROD / "box_sets" / "desk_prefs.json"
# ALICE_BOX/datbox-studio/lore-box/prod → ../../../the-deck-host/shell
DECK_SHELL = PROD.parents[2] / "the-deck-host" / "shell"
DECK_HOST_PY = DECK_SHELL / "deck_host.py"

URL = os.environ.get("LOREBOX_URL", "http://127.0.0.1:42929/")
HEALTH = os.environ.get("LOREBOX_HEALTH", "http://127.0.0.1:42929/api/health")
PORT = os.environ.get("LOREBOX_PORT", "42929")


def read_window_mode() -> str:
    """compact | standard | expanded | maximized from held desk prefs."""
    try:
        raw = json.loads(PREFS.read_text(encoding="utf-8-sig"))
        m = str(raw.get("window_mode") or "standard").strip().lower()
    except (OSError, ValueError, json.JSONDecodeError, TypeError):
        m = "standard"
    if m in ("maximized", "maximize", "max"):
        return "maximized"
    if m in ("expanded", "large", "wide", "big"):
        return "expanded"
    if m in ("compact", "small", "mini", "short"):
        return "compact"
    return "standard"


def main() -> int:
    if not BOX_SYS.is_dir():
        print(f"loreBOX box_sys missing: {BOX_SYS}", file=sys.stderr)
        return 1
    if not DECK_HOST_PY.is_file():
        print(f"The Deck Host not found: {DECK_HOST_PY}", file=sys.stderr)
        print("Expected sibling island: ALICE_BOX/the-deck-host/shell/", file=sys.stderr)
        return 1

    # Spawn as real argv (no cmd.exe) so host kill only hits this ROM's server
    server_cmd = f"{sys.executable} server.py"
    # Classic desk proportions (1024×768 standard) — not the old short datbox strip
    profile = os.environ.get("DECK_HOST_PROFILE", "desk").strip() or "desk"
    window_mode = os.environ.get("DECK_HOST_WINDOW_MODE", "").strip() or read_window_mode()
    cmd = [
        sys.executable,
        str(DECK_HOST_PY),
        "--title",
        "loreBOX",
        "--url",
        URL,
        "--health",
        HEALTH,
        "--profile",
        profile,
        "--window-mode",
        window_mode,
        "--spawn",
        server_cmd,
        "--spawn-cwd",
        str(BOX_SYS),
    ]
    print("loreBOX · The Deck Host")
    print(f"  ROM server: {BOX_SYS}")
    print(f"  host:       {DECK_HOST_PY}")
    print(f"  url:        {URL}")
    print(f"  profile:    {profile}")
    print(f"  window:     {window_mode}  (from desk_prefs / env)")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
