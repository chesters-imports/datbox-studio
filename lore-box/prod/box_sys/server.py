#!/usr/bin/env python3
"""
loreBOX v2 desk — Papers, Please.

  safe_box/{auth}/{deck_id}/INSPECT.deck
  safe_box/{auth}/{deck_id}/lore_….chip

No JSON bags. No content migrated from v1.
Port 42929 (live). Archive v1 sits on 42928.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from papers import (
    empty_chip_meta,
    empty_deck_meta,
    export_store_name,
    new_chip_id,
    now_tps,
    read_paper,
    safe_token,
    write_paper,
)

BOX_SYS = Path(__file__).resolve().parent
PROD = BOX_SYS.parent
SAFE_BOX = PROD / "safe_box"
BOX_SETS = PROD / "box_sets"
HOST = "127.0.0.1"
PORT = 42929
PREFS_FILE = BOX_SETS / "desk_prefs.json"
GEN = "DBS-002-LOREBOX"

# datbox-core · desk dialogs (Chester: no Windows prompts)
_DATBOX_CORE = PROD.parent.parent / "datbox-core"
_CORE_PY = _DATBOX_CORE / "py"
if str(_CORE_PY) not in sys.path:
    sys.path.insert(0, str(_CORE_PY))
try:
    from datbox_core.static_mount import try_serve_core_static  # noqa: E402
except ImportError:
    try_serve_core_static = None  # type: ignore


def ensure_dirs() -> None:
    SAFE_BOX.mkdir(parents=True, exist_ok=True)
    BOX_SETS.mkdir(parents=True, exist_ok=True)
    if not PREFS_FILE.is_file():
        PREFS_FILE.write_text(
            json.dumps(
                {"theme": "dark", "window_mode": "standard", "safe_compact": False},
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )


def load_prefs() -> dict[str, Any]:
    ensure_dirs()
    try:
        return json.loads(PREFS_FILE.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return {"theme": "dark", "window_mode": "standard"}


def save_prefs(patch: dict[str, Any]) -> dict[str, Any]:
    cur = load_prefs()
    cur.update({k: v for k, v in (patch or {}).items() if v is not None})
    PREFS_FILE.write_text(json.dumps(cur, indent=2) + "\n", encoding="utf-8")
    return cur


def deck_dir(auth: str, deck_id: str) -> Path:
    return SAFE_BOX / safe_token(auth) / safe_token(deck_id)


def deck_path(auth: str, deck_id: str) -> Path:
    return deck_dir(auth, deck_id) / "INSPECT.deck"


def list_tree() -> dict[str, Any]:
    """auth → decks → chips (papers only)."""
    ensure_dirs()
    auths: list[dict[str, Any]] = []
    if not SAFE_BOX.is_dir():
        return {"ok": True, "gen": GEN, "auths": [], "empty": True}

    for auth_p in sorted(SAFE_BOX.iterdir(), key=lambda p: p.name.lower()):
        if not auth_p.is_dir() or auth_p.name.startswith(("_", ".")):
            continue
        # skip loose non-auth junk
        decks: list[dict[str, Any]] = []
        for deck_p in sorted(auth_p.iterdir(), key=lambda p: p.name.lower()):
            if not deck_p.is_dir():
                continue
            dfile = deck_p / "INSPECT.deck"
            if not dfile.is_file():
                continue
            meta, _ = read_paper(dfile)
            deck_meta = meta.get("deck") or {}
            store = meta.get("store") or {}
            chips = []
            for chip_p in sorted(deck_p.glob("lore_*.chip")):
                cm, body = read_paper(chip_p)
                ch = cm.get("chip") or {}
                chips.append(
                    {
                        "id": ch.get("id") or chip_p.stem,
                        "pos": ch.get("pos") or 0,
                        "title": ch.get("title") or "",
                        "leaf": ch.get("leaf") or "",
                        "has_body": bool((body or "").strip()),
                        "file": chip_p.name,
                    }
                )
            chips.sort(key=lambda c: (int(c.get("pos") or 0), c.get("id") or ""))
            decks.append(
                {
                    "id": deck_meta.get("id") or deck_p.name,
                    "leaf": deck_meta.get("leaf") or "",
                    "sku": store.get("sku") or "",
                    "bit_count": store.get("bit_count")
                    if store.get("bit_count") is not None
                    else len(chips),
                    "chip_count": len(chips),
                    "chips": chips,
                }
            )
        auths.append({"auth": auth_p.name, "decks": decks})
    return {"ok": True, "gen": GEN, "auths": auths, "empty": len(auths) == 0}


def load_deck(auth: str, deck_id: str) -> dict[str, Any] | None:
    p = deck_path(auth, deck_id)
    if not p.is_file():
        return None
    meta, body = read_paper(p)
    chips = []
    d = deck_dir(auth, deck_id)
    for chip_p in sorted(d.glob("lore_*.chip")):
        cm, cbody = read_paper(chip_p)
        ch = cm.get("chip") or {}
        pin = cm.get("pin") or {}
        chips.append(
            {
                "id": ch.get("id") or chip_p.stem,
                "pos": ch.get("pos") or 0,
                "title": ch.get("title") or "",
                "leaf": ch.get("leaf") or "",
                "body": cbody or "",
                "pin": pin,
                "file": chip_p.name,
                "meta": cm,
            }
        )
    chips.sort(key=lambda c: (int(c.get("pos") or 0), c.get("id") or ""))
    # keep bit_count honest
    store = meta.setdefault("store", {})
    store["bit_count"] = len(chips)
    return {
        "ok": True,
        "auth": auth,
        "deck_id": deck_id,
        "meta": meta,
        "body": body,
        "chips": chips,
        "path": str(p.relative_to(PROD)).replace("\\", "/"),
    }


def load_chip(auth: str, deck_id: str, chip_id: str) -> dict[str, Any] | None:
    d = deck_dir(auth, deck_id)
    # file may be lore_xxx.chip matching id
    candidates = list(d.glob(f"{chip_id}.chip"))
    if not candidates:
        for chip_p in d.glob("lore_*.chip"):
            cm, _ = read_paper(chip_p)
            if (cm.get("chip") or {}).get("id") == chip_id:
                candidates = [chip_p]
                break
    if not candidates:
        return None
    chip_p = candidates[0]
    meta, body = read_paper(chip_p)
    return {
        "ok": True,
        "auth": auth,
        "deck_id": deck_id,
        "chip_id": (meta.get("chip") or {}).get("id") or chip_id,
        "meta": meta,
        "body": body,
        "path": str(chip_p.relative_to(PROD)).replace("\\", "/"),
        "file": chip_p.name,
    }


def recount_deck(auth: str, deck_id: str) -> None:
    p = deck_path(auth, deck_id)
    if not p.is_file():
        return
    meta, body = read_paper(p)
    n = len(list(deck_dir(auth, deck_id).glob("lore_*.chip")))
    meta.setdefault("store", {})["bit_count"] = n
    write_paper(p, meta, body)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BOX_SYS), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: Any, content_type: str = "application/json") -> None:
        if content_type == "application/json":
            raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        else:
            raw = body if isinstance(body, bytes) else str(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> Any:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        q = parse_qs(parsed.query)

        if path == "/api/health":
            return self._send(
                200,
                {
                    "ok": True,
                    "app": "loreBOX",
                    "gen": GEN,
                    "papers": True,
                    "version": 2,
                    "house": "DATBOX",
                    "safe_box": str(SAFE_BOX),
                    "port": PORT,
                    "law": "PAPERS_PLEASE",
                    "v1_archive": "datbox-studio/lore-box-v1-archive (port 42928)",
                },
            )

        if path == "/api/tree":
            return self._send(200, list_tree())

        if path == "/api/prefs":
            return self._send(200, {"ok": True, "prefs": load_prefs()})

        if path == "/api/deck":
            auth = safe_token((q.get("auth") or [""])[0])
            deck_id = safe_token((q.get("deck") or [""])[0])
            data = load_deck(auth, deck_id)
            if not data:
                return self._send(404, {"ok": False, "error": "deck not found"})
            return self._send(200, data)

        if path == "/api/chip":
            auth = safe_token((q.get("auth") or [""])[0])
            deck_id = safe_token((q.get("deck") or [""])[0])
            chip_id = (q.get("chip") or [""])[0].strip()
            data = load_chip(auth, deck_id, chip_id)
            if not data:
                return self._send(404, {"ok": False, "error": "chip not found"})
            return self._send(200, data)

        if try_serve_core_static is not None:
            if try_serve_core_static(self, path, core_root=_DATBOX_CORE):
                return

        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json()
        except json.JSONDecodeError:
            return self._send(400, {"ok": False, "error": "bad json"})

        if path == "/api/prefs":
            return self._send(200, {"ok": True, "prefs": save_prefs(body.get("prefs") or body)})

        if path == "/api/deck/create":
            auth = safe_token(body.get("auth") or "LOCAL", "LOCAL")
            deck_id = safe_token(body.get("deck_id") or body.get("id") or "", "")
            if not deck_id:
                raw = (body.get("name") or body.get("leaf") or "new-deck").strip()
                deck_id = safe_token(raw.replace(" ", "-"), "db_NEW")
                if not deck_id.startswith("db_"):
                    deck_id = "db_" + deck_id[:40]
            leaf = (body.get("leaf") or body.get("name") or deck_id).strip()
            p = deck_path(auth, deck_id)
            if p.is_file():
                return self._send(409, {"ok": False, "error": "deck exists", "deck_id": deck_id})
            meta = empty_deck_meta(auth, deck_id, leaf=leaf)
            write_paper(p, meta, "")
            return self._send(200, {"ok": True, "auth": auth, "deck_id": deck_id, "path": str(p)})

        if path == "/api/deck/save":
            auth = safe_token(body.get("auth") or "")
            deck_id = safe_token(body.get("deck_id") or "")
            p = deck_path(auth, deck_id)
            if not p.is_file():
                return self._send(404, {"ok": False, "error": "deck not found"})
            meta, old_body = read_paper(p)
            if "leaf" in body:
                meta.setdefault("deck", {})["leaf"] = body.get("leaf") or ""
            if "body" in body:
                old_body = body.get("body") or ""
            n = len(list(deck_dir(auth, deck_id).glob("lore_*.chip")))
            meta.setdefault("store", {})["bit_count"] = n
            write_paper(p, meta, old_body)
            return self._send(200, load_deck(auth, deck_id))

        if path == "/api/chip/create":
            auth = safe_token(body.get("auth") or "")
            deck_id = safe_token(body.get("deck_id") or "")
            if not deck_path(auth, deck_id).is_file():
                return self._send(404, {"ok": False, "error": "deck not found — create deck first"})
            existing = list(deck_dir(auth, deck_id).glob("lore_*.chip"))
            pos = int(body.get("pos") or (len(existing) + 1))
            title = (body.get("title") or "untitled lore").strip()
            leaf = (body.get("leaf") or "").strip()
            chip_body = body.get("body") or ""
            cid = body.get("chip_id") or new_chip_id()
            meta = empty_chip_meta(auth, deck_id, chip_id=cid, pos=pos, title=title, leaf=leaf)
            out = deck_dir(auth, deck_id) / f"{meta['chip']['id']}.chip"
            write_paper(out, meta, chip_body)
            recount_deck(auth, deck_id)
            return self._send(
                200,
                {
                    "ok": True,
                    "chip_id": meta["chip"]["id"],
                    "file": out.name,
                    "chip": load_chip(auth, deck_id, meta["chip"]["id"]),
                },
            )

        if path == "/api/chip/save":
            auth = safe_token(body.get("auth") or "")
            deck_id = safe_token(body.get("deck_id") or "")
            chip_id = (body.get("chip_id") or "").strip()
            cur = load_chip(auth, deck_id, chip_id)
            if not cur:
                return self._send(404, {"ok": False, "error": "chip not found"})
            meta = cur["meta"]
            chip = meta.setdefault("chip", {})
            if "title" in body:
                chip["title"] = body.get("title") or ""
            if "leaf" in body:
                chip["leaf"] = body.get("leaf") or ""
            if "pos" in body:
                chip["pos"] = int(body.get("pos") or chip.get("pos") or 1)
            pin = meta.setdefault("pin", {})
            pin["tps"] = now_tps()
            if "tags" in body and isinstance(body["tags"], list):
                pin["tags"] = body["tags"]
            cbody = body["body"] if "body" in body else cur.get("body") or ""
            out = deck_dir(auth, deck_id) / cur["file"]
            write_paper(out, meta, cbody)
            return self._send(200, load_chip(auth, deck_id, chip_id))

        if path == "/api/chip/delete":
            auth = safe_token(body.get("auth") or "")
            deck_id = safe_token(body.get("deck_id") or "")
            chip_id = (body.get("chip_id") or "").strip()
            cur = load_chip(auth, deck_id, chip_id)
            if not cur:
                return self._send(404, {"ok": False, "error": "chip not found"})
            (deck_dir(auth, deck_id) / cur["file"]).unlink(missing_ok=True)
            recount_deck(auth, deck_id)
            return self._send(200, {"ok": True})

        if path == "/api/deck/delete":
            auth = safe_token(body.get("auth") or "")
            deck_id = safe_token(body.get("deck_id") or "")
            d = deck_dir(auth, deck_id)
            if not d.is_dir():
                return self._send(404, {"ok": False, "error": "deck not found"})
            shutil.rmtree(d)
            auth_p = SAFE_BOX / auth
            if auth_p.is_dir() and not any(auth_p.iterdir()):
                auth_p.rmdir()
            return self._send(200, {"ok": True})

        if path == "/api/export/store":
            # zip bank face — deck_lore-{auth}-{deck}.store
            auth = safe_token(body.get("auth") or "")
            deck_id = safe_token(body.get("deck_id") or "")
            d = deck_dir(auth, deck_id)
            if not d.is_dir():
                return self._send(404, {"ok": False, "error": "deck not found"})
            exports = PROD / "exports"
            exports.mkdir(parents=True, exist_ok=True)
            name = export_store_name(auth, deck_id)
            out = exports / name
            with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
                for f in d.rglob("*"):
                    if f.is_file():
                        zf.write(f, f.relative_to(d).as_posix())
            return self._send(
                200,
                {
                    "ok": True,
                    "file": name,
                    "path": str(out.relative_to(PROD)).replace("\\", "/"),
                },
            )

        return self._send(404, {"ok": False, "error": "not found"})


def main() -> None:
    ensure_dirs()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"loreBOX v2 · Papers, Please · http://{HOST}:{PORT}/")
    print(f"  safe_box={SAFE_BOX}")
    print(f"  gen={GEN} · empty until you file papers")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
