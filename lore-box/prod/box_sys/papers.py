"""
Papers, Please — front-matter papers for loreBOX v2.

No Jason forklift. Deck + chip as catalog faces.
Law: ATTN datBox / Chester's import chip system (Hands paper).
"""

from __future__ import annotations

import re
import secrets
import time
from pathlib import Path
from typing import Any


GEN = "DBS-002-LOREBOX"
CHIP_PREFIX = "lore_"


def now_tps() -> int:
    return int(time.time())


def new_chip_id() -> str:
    # lore_54kh-e4df-c35d style — class on the id
    a, b, c = secrets.token_hex(2), secrets.token_hex(2), secrets.token_hex(2)
    return f"{CHIP_PREFIX}{a}-{b}-{c}"


def deck_sku(auth: str, deck_id: str) -> str:
    return f"deck_lore-{auth}-{deck_id}"


def safe_token(s: str, fallback: str = "x") -> str:
    t = re.sub(r"[^\w\-]+", "", (s or "").strip())
    return t[:48] if t else fallback


def _fmt_scalar(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    if s == "":
        return '""'
    if any(c in s for c in (":", "#", "{", "}", "[", "]", "\n")) or s.strip() != s:
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


def _dump_yaml(obj: Any, indent: int = 0) -> list[str]:
    pad = "  " * indent
    lines: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, dict):
                lines.append(f"{pad}{k}:")
                lines.extend(_dump_yaml(v, indent + 1))
            elif isinstance(v, list):
                if not v:
                    lines.append(f"{pad}{k}: []")
                else:
                    lines.append(f"{pad}{k}:")
                    for item in v:
                        if isinstance(item, (dict, list)):
                            lines.append(f"{pad}-")
                            lines.extend(_dump_yaml(item, indent + 1))
                        else:
                            lines.append(f"{pad}- {_fmt_scalar(item)}")
            else:
                lines.append(f"{pad}{k}: {_fmt_scalar(v)}")
    return lines


def dump_paper(meta: dict[str, Any], body: str = "") -> str:
    lines = ["---"]
    lines.extend(_dump_yaml(meta, 0))
    lines.append("---")
    body = body if body is not None else ""
    if body and not body.startswith("\n"):
        return "\n".join(lines) + "\n" + body.lstrip("\n")
    if body:
        return "\n".join(lines) + "\n" + body
    return "\n".join(lines) + "\n"


def _parse_scalar(raw: str) -> Any:
    s = raw.strip()
    if s == "[]":
        return []
    if s == "true":
        return True
    if s == "false":
        return False
    if s.isdigit() or (s.startswith("-") and s[1:].isdigit()):
        return int(s)
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    return s


def parse_paper(text: str) -> tuple[dict[str, Any], str]:
    """Minimal nested YAML front matter (our papers shape only)."""
    raw = text.replace("\r\n", "\n")
    if not raw.startswith("---\n"):
        return {}, raw
    end = raw.find("\n---\n", 4)
    if end < 0:
        # trailing --- only
        if raw.rstrip().endswith("\n---"):
            block = raw[4 : raw.rstrip().rfind("\n---")]
            return _parse_yaml_block(block), ""
        return {}, raw
    block = raw[4:end]
    body = raw[end + 5 :]
    return _parse_yaml_block(block), body


def _parse_yaml_block(block: str) -> dict[str, Any]:
    root: dict[str, Any] = {}
    stack: list[tuple[int, Any]] = [(-1, root)]

    for line in block.split("\n"):
        if not line.strip() or line.strip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        # pop to parent
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]

        if stripped.startswith("- "):
            # list item under last key — we only need empty tags/clips mostly
            if not isinstance(parent, list):
                continue
            parent.append(_parse_scalar(stripped[2:]))
            continue

        if ":" not in stripped:
            continue
        key, _, rest = stripped.partition(":")
        key = key.strip()
        rest = rest.strip()

        if not isinstance(parent, dict):
            continue

        if rest == "" or rest is None:
            # nested map or later list
            child: dict[str, Any] = {}
            parent[key] = child
            stack.append((indent, child))
        elif rest == "[]":
            parent[key] = []
        else:
            parent[key] = _parse_scalar(rest)

    return root


def empty_deck_meta(auth: str, deck_id: str, leaf: str = "") -> dict[str, Any]:
    auth = safe_token(auth, "LOCAL")
    deck_id = safe_token(deck_id, "db_NEW")
    return {
        "store": {
            "sku": deck_sku(auth, deck_id),
            "auth": auth,
            "type": "deck",
            "gen": GEN,
            "bit_count": 0,
        },
        "deck": {
            "id": deck_id,
            "type": "chip",
            "class": "lore",
            "leaf": leaf or f"Lore deck {deck_id}",
        },
    }


def empty_chip_meta(
    auth: str,
    deck_id: str,
    chip_id: str | None = None,
    pos: int = 1,
    title: str = "",
    leaf: str = "",
) -> dict[str, Any]:
    auth = safe_token(auth, "LOCAL")
    deck_id = safe_token(deck_id, "db_NEW")
    cid = chip_id or new_chip_id()
    if not str(cid).startswith(CHIP_PREFIX):
        cid = CHIP_PREFIX + safe_token(cid, "x")
    return {
        "store": {
            "sku": deck_sku(auth, deck_id),
            "auth": auth,
        },
        "deck": {
            "id": deck_id,
        },
        "chip": {
            "id": cid,
            "pos": int(pos),
            "title": title or "untitled lore",
            "leaf": leaf or "",
        },
        "pin": {
            "tps": now_tps(),
            "tags": [],
            "clips": [],
        },
    }


def write_paper(path: Path, meta: dict[str, Any], body: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dump_paper(meta, body), encoding="utf-8")


def read_paper(path: Path) -> tuple[dict[str, Any], str]:
    return parse_paper(path.read_text(encoding="utf-8"))


def export_store_name(auth: str, deck_id: str) -> str:
    """Zip / bank face name when exporting later."""
    return f"{deck_sku(auth, deck_id)}.store"
