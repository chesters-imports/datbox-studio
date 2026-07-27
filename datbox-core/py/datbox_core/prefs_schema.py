"""
desk_prefs.json — same SCHEMA for every DATBOX ROM, never shared state.

Each ROM keeps its own file, typically:
  {rom}/prod/box_sets/desk_prefs.json

loreBOX Compact + shotBOX Expanded on one machine is correct and expected.
"""

from __future__ import annotations

from typing import Any

PREFS_VERSION = 1

# Documented keys — ROMs may ignore unknown keys on read; writers should preserve them if possible.
DEFAULT_DESK_PREFS: dict[str, Any] = {
    "version": PREFS_VERSION,
    "theme": "system",  # light | dark | system
    "safe_compact": False,  # safe-box rail density
    "window_mode": "standard",  # compact | standard | expanded | maximized
}

THEMES = frozenset({"light", "dark", "system"})
WINDOW_MODES = frozenset({"compact", "standard", "expanded", "maximized"})


def normalize_theme(value: Any) -> str:
    t = str(value or "system").strip().lower()
    return t if t in THEMES else "system"


def normalize_window_mode(value: Any) -> str:
    m = str(value or "standard").strip().lower()
    if m in ("maximize", "max"):
        return "maximized"
    if m in ("large", "wide", "big"):
        return "expanded"
    if m in ("mini", "short"):
        return "compact"
    # "small" alone is ambiguous (window vs density) — do not map it
    return m if m in WINDOW_MODES else "standard"


def coerce_desk_prefs(data: Any) -> dict[str, Any]:
    """Merge unknown-safe defaults; return a clean prefs dict."""
    out = dict(DEFAULT_DESK_PREFS)
    if not isinstance(data, dict):
        return out
    out["theme"] = normalize_theme(data.get("theme"))
    out["safe_compact"] = bool(data.get("safe_compact"))
    out["window_mode"] = normalize_window_mode(data.get("window_mode"))
    try:
        out["version"] = int(data.get("version") or PREFS_VERSION)
    except (TypeError, ValueError):
        out["version"] = PREFS_VERSION
    return out
