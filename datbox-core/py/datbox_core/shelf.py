"""
_{rom}.datshelf — vault index for folder place + manual box order.

Physical folders are real directories under safe_box/.
This file only records order and folder membership for stems.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .io import load_json, save_json
from .profile import MatProfile

SHELF_VERSION = 1


def shelf_filename(profile: MatProfile) -> str:
    return f"_{profile.rom_slug}.datshelf"


def shelf_path(safe_box: Path, profile: MatProfile) -> Path:
    return safe_box / shelf_filename(profile)


def empty_shelf(profile: MatProfile) -> dict[str, Any]:
    return {
        "version": SHELF_VERSION,
        "rom": profile.rom_slug,
        "folder_order": [],
        "folders": {},
        "boxes": [],
    }


def load_shelf(safe_box: Path, profile: MatProfile) -> dict[str, Any]:
    path = shelf_path(safe_box, profile)
    if not path.is_file():
        return empty_shelf(profile)
    try:
        data = load_json(path)
    except (OSError, ValueError):
        return empty_shelf(profile)
    if not isinstance(data, dict):
        return empty_shelf(profile)
    data.setdefault("version", SHELF_VERSION)
    data.setdefault("rom", profile.rom_slug)
    data.setdefault("folder_order", [])
    data.setdefault("folders", {})
    data.setdefault("boxes", [])
    if not isinstance(data["folder_order"], list):
        data["folder_order"] = []
    if not isinstance(data["folders"], dict):
        data["folders"] = {}
    if not isinstance(data["boxes"], list):
        data["boxes"] = []
    return data


def save_shelf(safe_box: Path, profile: MatProfile, shelf: dict[str, Any]) -> None:
    shelf["version"] = SHELF_VERSION
    shelf["rom"] = profile.rom_slug
    save_json(shelf_path(safe_box, profile), shelf)


def sanitize_folder_id(name: str) -> str:
    """Physical directory name under safe_box. Empty = root."""
    s = (name or "").strip().strip("/\\")
    if not s:
        return ""
    s = re.sub(r"[^\w\-]+", "-", s, flags=re.UNICODE)
    s = re.sub(r"-+", "-", s).strip("-")
    if not s or s.startswith("_"):
        raise ValueError("invalid folder name")
    # never look like a bag or shelf
    low = s.lower()
    if low.endswith("box") and "." in s:
        raise ValueError("invalid folder name")
    return s


def is_reserved_name(name: str, profile: MatProfile) -> bool:
    if name == shelf_filename(profile):
        return True
    if name.startswith("_") and name.endswith(".datshelf"):
        return True
    return False
