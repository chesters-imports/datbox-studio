#!/usr/bin/env python3
"""
promptBOX desk server — decks of prompt cards on datbox-core.
safe_box/*.promptbox · port 43002
"""

from __future__ import annotations

import json
import re
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

BOX_SYS = Path(__file__).resolve().parent
PROD = BOX_SYS.parent
SAFE_BOX = PROD / "safe_box"
BOX_SETS = PROD / "box_sets"
HOST = "127.0.0.1"
PORT = 43002

_DATBOX_CORE = PROD.parent.parent / "datbox-core"
_CORE_PY = _DATBOX_CORE / "py"
if str(_CORE_PY) not in sys.path:
    sys.path.insert(0, str(_CORE_PY))

from datbox_core import (  # noqa: E402
    MatProfile,
    SafeVault,
    coerce_desk_prefs,
    stem_type_a,
    try_serve_core_static,
)
from datbox_core.io import load_json, save_json  # noqa: E402

PROFILE = MatProfile(
    rom_slug="promptbox",
    bag_ext=".promptbox",
    legacy_ext=".promptbox",
    mat="prompt",
)
VAULT = SafeVault(SAFE_BOX, PROFILE)
UNIT_EXT = ".prompt"
PREFS_FILE = BOX_SETS / "desk_prefs.json"


def ensure_dirs() -> None:
    VAULT.ensure()
    BOX_SETS.mkdir(parents=True, exist_ok=True)
    if not PREFS_FILE.is_file():
        save_json(PREFS_FILE, coerce_desk_prefs({}))


def empty_box(box_name: str, stem: str) -> dict[str, Any]:
    return {
        "house": "DATBOX",
        "mat": "prompt",
        "version": 1,
        "box_name": box_name,
        "stem": stem,
        "next_seq": 1,
        "cards": [],
    }


def empty_card(stem: str, seq: int) -> dict[str, Any]:
    code = f"{stem}-{seq:03d}{UNIT_EXT}"
    return {
        "prompt_code": code,
        "prompt": "",
        "notes": "",
    }


def load_prefs() -> dict[str, Any]:
    ensure_dirs()
    try:
        return coerce_desk_prefs(load_json(PREFS_FILE))
    except (OSError, ValueError, json.JSONDecodeError):
        return coerce_desk_prefs({})


def save_prefs(patch: dict[str, Any]) -> dict[str, Any]:
    cur = load_prefs()
    merged = dict(cur)
    if isinstance(patch, dict):
        for k in ("theme", "safe_compact", "window_mode"):
            if k in patch:
                merged[k] = patch[k]
    cur = coerce_desk_prefs(merged)
    save_json(PREFS_FILE, cur)
    return cur


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(BOX_SYS), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def guess_type(self, path: str) -> str:  # type: ignore[override]
        # WebView2 often mis-parses UTF-8 JS without charset → silent script death
        ctype = super().guess_type(path)
        if isinstance(ctype, tuple):
            ctype = ctype[0] or ""
        low = path.lower()
        if low.endswith(".js"):
            return "application/javascript; charset=utf-8"
        if low.endswith(".css"):
            return "text/css; charset=utf-8"
        if low.endswith(".html") or low.endswith(".htm"):
            return "text/html; charset=utf-8"
        return ctype or "application/octet-stream"

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def _send(self, code: int, body: Any) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> Any:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            return self._send(
                200,
                {
                    "ok": True,
                    "app": "promptBOX",
                    "house": "DATBOX",
                    "mat": "prompt",
                    "core": "datbox-core",
                    "shelf": f"_{PROFILE.rom_slug}.datshelf",
                    "port": PORT,
                    "safe_box": str(SAFE_BOX),
                },
            )

        if path == "/api/boxes":
            return self._send(200, VAULT.list_tree())

        if path == "/api/prefs":
            return self._send(200, {"ok": True, "prefs": load_prefs()})

        if path == "/api/stem":
            qs = parse_qs(parsed.query)
            name = (qs.get("name") or [""])[0]
            return self._send(200, {"stem": stem_type_a(name)})

        if path.startswith("/api/box/"):
            stem = re.sub(r"[^\w\-]+", "", path[len("/api/box/") :])
            try:
                data = VAULT.load_box(stem)
            except FileNotFoundError:
                return self._send(404, {"error": "box not found", "stem": stem})
            return self._send(200, data)

        if try_serve_core_static(self, path, core_root=_DATBOX_CORE):
            return

        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json()
        except json.JSONDecodeError:
            return self._send(400, {"error": "bad json"})

        if path == "/api/prefs":
            return self._send(200, {"ok": True, "prefs": save_prefs(body)})

        if path == "/api/boxes":
            box_name = (body.get("box_name") or "").strip()
            if not box_name:
                return self._send(400, {"error": "box_name required"})
            stem = (body.get("stem") or "").strip() or stem_type_a(box_name)
            stem = re.sub(r"[^\w\-]+", "", stem) or "X"
            folder = (body.get("folder") or "").strip()
            try:
                data = VAULT.create_box(
                    box_name, stem=stem, folder=folder, empty_box=empty_box
                )
            except FileExistsError:
                return self._send(409, {"error": "stem already exists", "stem": stem})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            return self._send(201, data)

        if path == "/api/folders":
            name = (body.get("name") or body.get("folder") or "").strip()
            try:
                folder = VAULT.create_folder(name)
            except FileExistsError:
                return self._send(409, {"error": "folder exists"})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            return self._send(201, {"ok": True, "folder": folder, **VAULT.list_tree()})

        if path == "/api/folders/rename":
            try:
                folder = VAULT.rename_folder(
                    body.get("id") or body.get("folder") or "",
                    body.get("name") or body.get("new_name") or "",
                )
            except FileNotFoundError:
                return self._send(404, {"error": "folder not found"})
            except FileExistsError:
                return self._send(409, {"error": "folder exists"})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, "folder": folder, **VAULT.list_tree()})

        if path == "/api/shelf":
            try:
                tree = VAULT.apply_layout(
                    folder_order=body.get("folder_order"),
                    boxes=body.get("boxes"),
                )
            except (FileExistsError, ValueError, FileNotFoundError) as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, **tree})

        if path.startswith("/api/box/") and path.endswith("/card"):
            stem = re.sub(r"[^\w\-]+", "", path[len("/api/box/") : -len("/card")])
            try:
                data = VAULT.load_box(stem)
            except FileNotFoundError:
                return self._send(404, {"error": "box not found"})
            seq = int(data.get("next_seq") or 1)
            card = empty_card(stem, seq)
            card["prompt"] = str(body.get("prompt") or "").strip()
            card["notes"] = str(body.get("notes") or "")
            tps = str(body.get("tps_chip") or "").strip()
            if tps:
                card["tps_chip"] = tps
            exp = str(body.get("tps_export") or "").strip()
            if exp:
                card["tps_export"] = exp
            data.setdefault("cards", []).append(card)
            data["next_seq"] = seq + 1
            VAULT.save_box_at_stem(stem, data)
            return self._send(201, {"box": data, "card": card})

        return self._send(404, {"error": "not found"})

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json()
        except json.JSONDecodeError:
            return self._send(400, {"error": "bad json"})

        if path.startswith("/api/box/"):
            rest = path[len("/api/box/") :]
            if "/card/" in rest:
                stem, _, code = rest.partition("/card/")
                stem = re.sub(r"[^\w\-]+", "", stem)
                try:
                    data = VAULT.load_box(stem)
                except FileNotFoundError:
                    return self._send(404, {"error": "box not found"})
                found = None
                for card in data.get("cards") or []:
                    if card.get("prompt_code") == code:
                        found = card
                        break
                if not found:
                    return self._send(404, {"error": "card not found"})
                if "prompt" in body:
                    found["prompt"] = str(body.get("prompt") or "")
                if "notes" in body:
                    found["notes"] = str(body.get("notes") or "")
                tps = str(body.get("tps_chip") or "").strip()
                if tps:
                    found["tps_chip"] = tps
                exp = str(body.get("tps_export") or "").strip()
                if exp:
                    found["tps_export"] = exp
                VAULT.save_box_at_stem(stem, data)
                return self._send(200, {"box": data, "card": found})

            stem = re.sub(r"[^\w\-]+", "", rest)
            try:
                data = VAULT.load_box(stem)
            except FileNotFoundError:
                return self._send(404, {"error": "box not found"})
            if body.get("box_name") is not None:
                data["box_name"] = str(body.get("box_name") or "").strip() or data.get(
                    "box_name"
                )
            if body.get("stem") is not None:
                ns = re.sub(r"[^\w\-]+", "", str(body.get("stem") or "").strip())
                old = data.get("stem") or stem
                if ns and ns != old:
                    data["stem"] = ns
                    for card in data.get("cards") or []:
                        code = card.get("prompt_code") or ""
                        m = re.match(rf"^{re.escape(old)}-(\d+)\.prompt$", code)
                        if m:
                            card["prompt_code"] = f"{ns}-{m.group(1)}.prompt"
                    try:
                        VAULT.rename_box_file(old, ns, data)
                    except FileExistsError:
                        return self._send(409, {"error": "stem exists", "stem": ns})
                    return self._send(200, data)
            VAULT.save_box_at_stem(stem, data)
            return self._send(200, data)

        return self._send(404, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        m = re.fullmatch(r"/api/folders/([^/]+)", path)
        if m:
            try:
                result = VAULT.delete_folder(m.group(1))
            except FileNotFoundError:
                return self._send(404, {"error": "folder not found"})
            except (FileExistsError, ValueError) as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, **result, **VAULT.list_tree()})

        if path.startswith("/api/box/"):
            rest = path[len("/api/box/") :]
            if "/card/" in rest:
                stem, _, code = rest.partition("/card/")
                stem = re.sub(r"[^\w\-]+", "", stem)
                try:
                    data = VAULT.load_box(stem)
                except FileNotFoundError:
                    return self._send(404, {"error": "box not found"})
                before = len(data.get("cards") or [])
                data["cards"] = [
                    c
                    for c in (data.get("cards") or [])
                    if c.get("prompt_code") != code
                ]
                if len(data["cards"]) == before:
                    return self._send(404, {"error": "card not found"})
                VAULT.save_box_at_stem(stem, data)
                return self._send(200, data)

            stem = re.sub(r"[^\w\-]+", "", rest)
            try:
                VAULT.delete_box(stem)
            except FileNotFoundError:
                return self._send(404, {"error": "box not found"})
            return self._send(200, {"deleted": stem})

        return self._send(404, {"error": "not found"})


class DeskServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> None:
    ensure_dirs()
    VAULT.reconcile_shelf()
    try:
        httpd = DeskServer((HOST, PORT), Handler)
    except OSError as e:
        print(f"promptBOX failed to bind {HOST}:{PORT} — {e}", file=sys.stderr)
        sys.exit(1)
    print(f"promptBOX desk  http://{HOST}:{PORT}/", flush=True)
    print(f"safe_box        {SAFE_BOX}", flush=True)
    print(f"shelf           _{PROFILE.rom_slug}.datshelf · datbox-core", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    main()
