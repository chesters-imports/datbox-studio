#!/usr/bin/env python3
"""
loreBOX desk server — DATBOX island on datbox-core shelf.

Serves the inner app and reads/writes only:
  ../safe_box/  (physical folders + *.lorebox + _lorebox.datshelf)
  ../box_sets/*
"""

from __future__ import annotations

import json
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

BOX_SYS = Path(__file__).resolve().parent
PROD = BOX_SYS.parent
SAFE_BOX = PROD / "safe_box"
BOX_SETS = PROD / "box_sets"
HOST = "127.0.0.1"
PORT = 42928  # archive v1 — live loreBOX v2 owns 42929

# datbox-core (house library — not a runnable ROM)
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
    rom_slug="lorebox",
    bag_ext=".lorebox",
    legacy_ext=".lore",
    mat="lore",
)
VAULT = SafeVault(SAFE_BOX, PROFILE)

BAG_EXT = PROFILE.bag_ext
UNIT_EXT = ".lore"


PREFS_FILE = BOX_SETS / "desk_prefs.json"


def ensure_dirs() -> None:
    VAULT.ensure()
    BOX_SETS.mkdir(parents=True, exist_ok=True)
    rel = BOX_SETS / "relation_types.json"
    if not rel.exists():
        rel.write_text(
            json.dumps({"version": 1, "types": ["Relates to"]}, indent=2) + "\n",
            encoding="utf-8",
        )
    if not PREFS_FILE.is_file():
        save_json(PREFS_FILE, coerce_desk_prefs({}))


def load_prefs() -> dict[str, Any]:
    ensure_dirs()
    try:
        data = load_json(PREFS_FILE)
    except (OSError, ValueError, json.JSONDecodeError):
        return coerce_desk_prefs({})
    return coerce_desk_prefs(data)


def save_prefs(patch: dict[str, Any]) -> dict[str, Any]:
    cur = load_prefs()
    if not isinstance(patch, dict):
        patch = {}
    merged = dict(cur)
    if "theme" in patch:
        merged["theme"] = patch.get("theme")
    if "safe_compact" in patch:
        merged["safe_compact"] = patch.get("safe_compact")
    if "window_mode" in patch:
        merged["window_mode"] = patch.get("window_mode")
    cur = coerce_desk_prefs(merged)
    # reject garbage window_mode / theme after coerce only if caller sent junk
    if "theme" in patch:
        t = str(patch.get("theme") or "").strip().lower()
        if t and t not in ("light", "dark", "system"):
            raise ValueError("theme must be light, dark, or system")
    if "window_mode" in patch:
        w = str(patch.get("window_mode") or "").strip().lower()
        allowed = {
            "compact",
            "standard",
            "expanded",
            "maximized",
            "max",
            "maximize",
            "large",
            "wide",
            "big",
            "mini",
            "short",
            "default",
            "normal",
        }
        if w and w not in allowed:
            raise ValueError(
                "window_mode must be compact, standard, expanded, or maximized"
            )
    save_json(PREFS_FILE, cur)
    return cur


def empty_box(box_name: str, stem: str) -> dict[str, Any]:
    return {
        "house": "DATBOX",
        "mat": "lore",
        "version": 1,
        "box_name": box_name,
        "stem": stem,
        "next_seq": 1,
        "cards": [],
    }


def all_cards_index() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for stem, _p, data in VAULT.all_bag_data():
        box_name = data.get("box_name") or stem
        for card in data.get("cards") or []:
            rows.append(
                {
                    "box_stem": stem,
                    "box_name": box_name,
                    "lore_code": card.get("lore_code") or card.get("lore_core") or "",
                    "headliner": card.get("headliner") or "",
                }
            )
    return rows


def rewrite_stem_in_box(data: dict[str, Any], old_stem: str, new_stem: str) -> dict[str, Any]:
    data = json.loads(json.dumps(data))
    data["stem"] = new_stem
    for card in data.get("cards") or []:
        code = card.get("lore_code") or card.get("lore_core") or ""
        m = re.match(rf"^{re.escape(old_stem)}-(\d+)\.(?:lore|frag)$", code)
        if m:
            new_code = f"{new_stem}-{m.group(1)}.lore"
            card["lore_code"] = new_code
            card["lore_core"] = new_code
        for rel in card.get("relates") or []:
            t = rel.get("to") or ""
            m2 = re.match(rf"^{re.escape(old_stem)}-(\d+)\.(?:lore|frag)$", t)
            if m2:
                rel["to"] = f"{new_stem}-{m2.group(1)}.lore"
    return data


def patch_relates_across_safe_box(old_stem: str, new_stem: str) -> None:
    for _stem, p, data in VAULT.all_bag_data():
        changed = False
        for card in data.get("cards") or []:
            for rel in card.get("relates") or []:
                t = rel.get("to") or ""
                m = re.match(rf"^{re.escape(old_stem)}-(\d+)\.(?:lore|frag)$", t)
                if m:
                    rel["to"] = f"{new_stem}-{m.group(1)}.lore"
                    changed = True
        if changed:
            save_json(p, data)


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

        if path == "/api/health":
            return self._send(
                200,
                {
                    "ok": True,
                    "app": "loreBOX",
                    "house": "DATBOX",
                    "safe_box": str(SAFE_BOX),
                    "prefs": str(PREFS_FILE),
                    "core": "datbox-core",
                    "shelf": f"_{PROFILE.rom_slug}.datshelf",
                    "port": PORT,
                },
            )

        if path == "/api/boxes":
            tree = VAULT.list_tree()
            return self._send(200, tree)

        if path == "/api/catalog":
            return self._send(200, {"cards": all_cards_index()})

        if path == "/api/settings/relation_types":
            p = BOX_SETS / "relation_types.json"
            ensure_dirs()
            return self._send(200, load_json(p))

        if path == "/api/prefs":
            return self._send(200, {"ok": True, "prefs": load_prefs()})

        if path == "/api/stem":
            qs = parse_qs(parsed.query)
            name = (qs.get("name") or [""])[0]
            return self._send(200, {"stem": stem_type_a(name)})

        if path.startswith("/api/box/"):
            stem = path[len("/api/box/") :]
            stem = re.sub(r"[^\w\-]+", "", stem)
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
                return self._send(409, {"error": "folder exists", "name": name})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            return self._send(201, {"ok": True, "folder": folder, **VAULT.list_tree()})

        # POST /api/folders/rename  { id, name }
        if path == "/api/folders/rename":
            old_id = (body.get("id") or body.get("folder") or "").strip()
            new_name = (body.get("name") or body.get("new_name") or "").strip()
            try:
                folder = VAULT.rename_folder(old_id, new_name)
            except FileNotFoundError:
                return self._send(404, {"error": "folder not found", "id": old_id})
            except FileExistsError:
                return self._send(409, {"error": "folder exists", "name": new_name})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, "folder": folder, **VAULT.list_tree()})

        if path == "/api/shelf":
            # drag order + membership
            try:
                tree = VAULT.apply_layout(
                    folder_order=body.get("folder_order"),
                    boxes=body.get("boxes"),
                )
            except (FileExistsError, ValueError, FileNotFoundError) as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, **tree})

        if path == "/api/settings/relation_types":
            types = body.get("types")
            if not isinstance(types, list) or not types:
                return self._send(400, {"error": "types list required"})
            clean = [str(t).strip() for t in types if str(t).strip()]
            if "Relates to" not in clean:
                clean.insert(0, "Relates to")
            data = {"version": 1, "types": clean}
            save_json(BOX_SETS / "relation_types.json", data)
            return self._send(200, data)

        if path == "/api/prefs":
            try:
                prefs = save_prefs(body if isinstance(body, dict) else {})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, "prefs": prefs})

        if path.startswith("/api/box/") and path.endswith("/card"):
            stem = path[len("/api/box/") : -len("/card")]
            stem = re.sub(r"[^\w\-]+", "", stem)
            try:
                data = VAULT.load_box(stem)
            except FileNotFoundError:
                return self._send(404, {"error": "box not found"})
            seq = int(data.get("next_seq") or 1)
            code = f"{stem}-{seq:03d}{UNIT_EXT}"
            card = {
                "lore_code": code,
                "lore_core": code,
                "headliner": (body.get("headliner") or "").strip(),
                "slugline": (body.get("slugline") or "").strip(),
                "prime_lore": body.get("prime_lore") or "",
                "gravity": int(body.get("gravity") or 0),
                "relates": body.get("relates") if isinstance(body.get("relates"), list) else [],
            }
            tps_chip = str(body.get("tps_chip") or "").strip()
            tps_export = str(body.get("tps_export") or "").strip()
            if tps_chip:
                card["tps_chip"] = tps_chip
            if tps_export:
                card["tps_export"] = tps_export
            if isinstance(body.get("tps_vencodes"), list) and body["tps_vencodes"]:
                codes = []
                seen = set()
                for v in body["tps_vencodes"]:
                    if isinstance(v, str):
                        c = v.strip()
                    elif isinstance(v, dict):
                        c = str(v.get("code") or "").strip()
                    else:
                        c = ""
                    if c and c not in seen:
                        seen.add(c)
                        codes.append(c)
                if codes:
                    card["tps_vencodes"] = codes
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
                    if card.get("lore_code") == code or card.get("lore_core") == code:
                        found = card
                        break
                if not found:
                    return self._send(404, {"error": "card not found"})
                if "headliner" in body:
                    found["headliner"] = str(body.get("headliner") or "")
                if "slugline" in body:
                    found["slugline"] = str(body.get("slugline") or "")
                tps_chip = str(body.get("tps_chip") or "").strip()
                tps_export = str(body.get("tps_export") or "").strip()
                if tps_chip:
                    found["tps_chip"] = tps_chip
                if tps_export:
                    found["tps_export"] = tps_export
                if isinstance(body.get("tps_vencodes"), list) and body["tps_vencodes"]:
                    codes = []
                    seen = set()
                    for v in body["tps_vencodes"]:
                        if isinstance(v, str):
                            c = v.strip()
                        elif isinstance(v, dict):
                            c = str(v.get("code") or "").strip()
                        else:
                            c = ""
                        if c and c not in seen:
                            seen.add(c)
                            codes.append(c)
                    if codes:
                        found["tps_vencodes"] = codes
                if body.get("tps_clear"):
                    found.pop("tps_chip", None)
                    found.pop("tps_export", None)
                    found.pop("tps_vencodes", None)
                if "prime_lore" in body:
                    found["prime_lore"] = str(body.get("prime_lore") or "")
                if "gravity" in body:
                    found["gravity"] = int(body.get("gravity") or 0)
                if "relates" in body and isinstance(body.get("relates"), list):
                    found["relates"] = body["relates"]
                found["lore_core"] = found.get("lore_code") or code
                VAULT.save_box_at_stem(stem, data)
                return self._send(200, {"box": data, "card": found})

            stem = re.sub(r"[^\w\-]+", "", rest)
            try:
                data = VAULT.load_box(stem)
            except FileNotFoundError:
                return self._send(404, {"error": "box not found"})

            new_name = body.get("box_name")
            new_stem = body.get("stem")
            if new_name is not None or new_stem is not None:
                old_stem = data.get("stem") or stem
                if new_name is not None:
                    data["box_name"] = str(new_name).strip() or data.get("box_name")
                if new_stem is not None:
                    ns = re.sub(r"[^\w\-]+", "", str(new_stem).strip()) or old_stem
                else:
                    ns = old_stem
                if ns != old_stem:
                    try:
                        data = rewrite_stem_in_box(data, old_stem, ns)
                        VAULT.rename_box_file(old_stem, ns, data)
                        patch_relates_across_safe_box(old_stem, ns)
                    except FileExistsError:
                        return self._send(409, {"error": "stem already exists", "stem": ns})
                    return self._send(200, data)
                VAULT.save_box_at_stem(stem, data)
                return self._send(200, data)

            if "folder" in body:
                try:
                    VAULT.move_box(stem, str(body.get("folder") or ""))
                    data = VAULT.load_box(stem)
                except (FileNotFoundError, FileExistsError, ValueError) as e:
                    return self._send(400, {"error": str(e)})
                return self._send(200, data)

            if "cards" in body:
                data["cards"] = body["cards"]
            if "box_name" in body:
                data["box_name"] = body["box_name"]
            if "next_seq" in body:
                data["next_seq"] = int(body["next_seq"])
            VAULT.save_box_at_stem(stem, data)
            return self._send(200, data)

        return self._send(404, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        # DELETE /api/folders/{id} — bags move to unsorted, folder dir removed
        m = re.fullmatch(r"/api/folders/([^/]+)", path)
        if m:
            fid = m.group(1)
            try:
                result = VAULT.delete_folder(fid)
            except FileNotFoundError:
                return self._send(404, {"error": "folder not found", "id": fid})
            except (FileExistsError, ValueError) as e:
                return self._send(400, {"error": str(e)})
            tree = VAULT.list_tree()
            return self._send(200, {"ok": True, **result, **tree})

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
                    if c.get("lore_code") != code and c.get("lore_core") != code
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
        print(f"loreBOX failed to bind {HOST}:{PORT} — {e}", file=sys.stderr)
        sys.exit(1)
    cute = f"http://datbox.lorebox.localhost:{PORT}/"
    plain = f"http://{HOST}:{PORT}/"
    print(f"loreBOX desk  {cute}", flush=True)
    print(f"              {plain}", flush=True)
    print(f"safe_box      {SAFE_BOX}", flush=True)
    print(f"shelf         _{PROFILE.rom_slug}.datshelf · datbox-core", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    main()
