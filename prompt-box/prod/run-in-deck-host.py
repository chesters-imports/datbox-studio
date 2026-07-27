#!/usr/bin/env python3
"""promptBOX ROM → The Deck Host."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
BOX_SYS = PROD / "box_sys"
PREFS = PROD / "box_sets" / "desk_prefs.json"
DECK_HOST_PY = PROD.parents[2] / "the-deck-host" / "shell" / "deck_host.py"

URL = os.environ.get("PROMPTBOX_URL", "http://127.0.0.1:43002/")
HEALTH = os.environ.get("PROMPTBOX_HEALTH", "http://127.0.0.1:43002/api/health")


def read_window_mode() -> str:
    try:
        raw = json.loads(PREFS.read_text(encoding="utf-8-sig"))
        m = str(raw.get("window_mode") or "standard").strip().lower()
    except (OSError, ValueError, json.JSONDecodeError, TypeError):
        m = "standard"
    if m in ("maximized", "maximize", "max"):
        return "maximized"
    if m in ("expanded", "large", "wide", "big"):
        return "expanded"
    if m in ("compact", "mini", "short"):
        return "compact"
    return "standard"


def main() -> int:
    if not BOX_SYS.is_dir():
        print(f"box_sys missing: {BOX_SYS}", file=sys.stderr)
        return 1
    if not DECK_HOST_PY.is_file():
        print(f"The Deck Host not found: {DECK_HOST_PY}", file=sys.stderr)
        return 1
    server_cmd = f"{sys.executable} server.py"
    profile = os.environ.get("DECK_HOST_PROFILE", "desk").strip() or "desk"
    window_mode = os.environ.get("DECK_HOST_WINDOW_MODE", "").strip() or read_window_mode()
    cmd = [
        sys.executable,
        str(DECK_HOST_PY),
        "--title",
        "promptBOX",
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
    print("promptBOX · The Deck Host")
    print(f"  url: {URL}")
    print(f"  profile: {profile}")
    print(f"  window: {window_mode}")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
