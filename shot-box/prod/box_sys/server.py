#!/usr/bin/env python3
"""
shotBOX desk server — shotDesk model as DATBOX ROM.
Serves box_sys; saves only ../safe_box/*.shot and ../box_sets/*
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
PORT = 43001  # distinct from loreBOX 42929


def ensure_dirs() -> None:
    SAFE_BOX.mkdir(parents=True, exist_ok=True)
    BOX_SETS.mkdir(parents=True, exist_ok=True)
    rel = BOX_SETS / "relation_types.json"
    if not rel.exists():
        rel.write_text(
            json.dumps(
                {
                    "version": 1,
                    "types": ["Relates to", "Frames", "Before", "After", "Intercut"],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )


def stem_type_a(name: str) -> str:
    parts: list[str] = []
    for word in (name or "").split():
        if not word:
            continue
        ch = word[0]
        if ch.isalpha():
            parts.append(ch.upper())
        elif ch.isdigit():
            parts.append(ch)
        else:
            for c in word:
                if c.isalpha():
                    parts.append(c.upper())
                    break
                if c.isdigit():
                    parts.append(c)
                    break
    return "".join(parts) or "X"


def shot_path(stem: str) -> Path:
    safe = re.sub(r"[^\w\-]+", "", stem, flags=re.UNICODE)
    if not safe:
        raise ValueError("empty stem")
    return SAFE_BOX / f"{safe}.shot"


def load_json(path: Path) -> Any:
    # utf-8-sig: tolerate BOM from editors / PowerShell Set-Content
    return json.loads(path.read_text(encoding="utf-8-sig"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def empty_box(box_name: str, stem: str) -> dict[str, Any]:
    return {
        "house": "DATBOX",
        "mat": "shot",
        "version": 1,
        "box_name": box_name,
        "stem": stem,
        "next_seq": 1,
        "cards": [],
    }


def empty_card(stem: str, seq: int) -> dict[str, Any]:
    # shot_code = bag identity (immutable pot). scene_code = production label (e60, etc.)
    code = f"{stem}-{seq:03d}.shot"
    return {
        "shot_code": code,
        "scene_code": "",
        "title": "",
        "raw_prose": "",
        "shotslug": "",
        "visual": "",
        "action": "",
        "dialogue": "",
        "transition": "",
        "amusement": "",
        "tone_tags": "",
        "relates": [],
        "gravity": 0,
    }


def list_boxes() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in sorted(SAFE_BOX.glob("*.shot")):
        try:
            data = load_json(p)
            out.append(
                {
                    "stem": data.get("stem") or p.stem,
                    "box_name": data.get("box_name") or p.stem,
                    "file": p.name,
                    "card_count": len(data.get("cards") or []),
                }
            )
        except (OSError, json.JSONDecodeError) as e:
            out.append(
                {
                    "stem": p.stem,
                    "box_name": p.stem,
                    "file": p.name,
                    "card_count": 0,
                    "error": str(e),
                }
            )
    return out


def all_cards_index() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for p in sorted(SAFE_BOX.glob("*.shot")):
        try:
            data = load_json(p)
        except (OSError, json.JSONDecodeError):
            continue
        stem = data.get("stem") or p.stem
        box_name = data.get("box_name") or stem
        for card in data.get("cards") or []:
            rows.append(
                {
                    "box_stem": stem,
                    "box_name": box_name,
                    "shot_code": card.get("shot_code") or "",
                    "scene_code": card.get("scene_code") or "",
                    "title": card.get("title") or "",
                    "shotslug": card.get("shotslug") or "",
                }
            )
    return rows


def rewrite_stem_in_box(data: dict[str, Any], old_stem: str, new_stem: str) -> dict[str, Any]:
    data = json.loads(json.dumps(data))
    data["stem"] = new_stem
    for card in data.get("cards") or []:
        code = card.get("shot_code") or ""
        m = re.match(rf"^{re.escape(old_stem)}-(\d+)\.shot$", code)
        if m:
            card["shot_code"] = f"{new_stem}-{m.group(1)}.shot"
        for rel in card.get("relates") or []:
            t = rel.get("to") or ""
            m2 = re.match(rf"^{re.escape(old_stem)}-(\d+)\.shot$", t)
            if m2:
                rel["to"] = f"{new_stem}-{m2.group(1)}.shot"
    return data


def patch_relates_across(old_stem: str, new_stem: str) -> None:
    for p in SAFE_BOX.glob("*.shot"):
        try:
            data = load_json(p)
        except (OSError, json.JSONDecodeError):
            continue
        changed = False
        for card in data.get("cards") or []:
            for rel in card.get("relates") or []:
                t = rel.get("to") or ""
                m = re.match(rf"^{re.escape(old_stem)}-(\d+)\.shot$", t)
                if m:
                    rel["to"] = f"{new_stem}-{m.group(1)}.shot"
                    changed = True
        if changed:
            save_json(p, data)


def apply_card_fields(card: dict[str, Any], body: dict[str, Any]) -> None:
    # Never overwrite shot_code from client — that is the bag pot / store id
    keys = (
        "scene_code",
        "title",
        "raw_prose",
        "shotslug",
        "visual",
        "action",
        "dialogue",
        "transition",
        "amusement",
        "tone_tags",
    )
    for k in keys:
        if k in body:
            card[k] = str(body.get(k) or "")
    if "gravity" in body:
        card["gravity"] = int(body.get("gravity") or 0)
    if "relates" in body and isinstance(body.get("relates"), list):
        card["relates"] = body["relates"]


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
                200, {"ok": True, "app": "shotBOX", "safe_box": str(SAFE_BOX)}
            )
        if path == "/api/boxes":
            return self._send(200, {"boxes": list_boxes()})
        if path == "/api/catalog":
            return self._send(200, {"cards": all_cards_index()})
        if path == "/api/settings/relation_types":
            ensure_dirs()
            try:
                return self._send(200, load_json(BOX_SETS / "relation_types.json"))
            except (OSError, json.JSONDecodeError) as e:
                # heal corrupt/BOM settings so the desk still boots
                data = {
                    "version": 1,
                    "types": ["Relates to", "Frames", "Before", "After", "Intercut"],
                }
                save_json(BOX_SETS / "relation_types.json", data)
                return self._send(200, data)
        if path == "/api/stem":
            qs = parse_qs(parsed.query)
            name = (qs.get("name") or [""])[0]
            return self._send(200, {"stem": stem_type_a(name)})
        if path.startswith("/api/box/"):
            stem = re.sub(r"[^\w\-]+", "", path[len("/api/box/") :])
            p = shot_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found", "stem": stem})
            return self._send(200, load_json(p))
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
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
            p = shot_path(stem)
            if p.exists():
                return self._send(409, {"error": "stem already exists", "stem": stem})
            data = empty_box(box_name, stem)
            save_json(p, data)
            return self._send(201, data)

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

        if path.startswith("/api/box/") and path.endswith("/card"):
            stem = re.sub(r"[^\w\-]+", "", path[len("/api/box/") : -len("/card")])
            p = shot_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found"})
            data = load_json(p)
            seq = int(data.get("next_seq") or 1)
            card = empty_card(stem, seq)
            apply_card_fields(card, body)
            # store pot fixed at mint; scene_code may be set freely (e.g. e60)
            card["shot_code"] = f"{stem}-{seq:03d}.shot"
            data.setdefault("cards", []).append(card)
            data["next_seq"] = seq + 1
            save_json(p, data)
            return self._send(201, {"box": data, "card": card})

        return self._send(404, {"error": "not found"})

    def do_PUT(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            body = self._read_json()
        except json.JSONDecodeError:
            return self._send(400, {"error": "bad json"})

        if path.startswith("/api/box/"):
            rest = path[len("/api/box/") :]
            if "/card/" in rest:
                stem, _, code = rest.partition("/card/")
                stem = re.sub(r"[^\w\-]+", "", stem)
                p = shot_path(stem)
                if not p.exists():
                    return self._send(404, {"error": "box not found"})
                data = load_json(p)
                found = None
                for card in data.get("cards") or []:
                    if card.get("shot_code") == code:
                        found = card
                        break
                if not found:
                    return self._send(404, {"error": "card not found"})
                apply_card_fields(found, body)
                save_json(p, data)
                return self._send(200, {"box": data, "card": found})

            stem = re.sub(r"[^\w\-]+", "", rest)
            p = shot_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found"})
            data = load_json(p)
            new_name = body.get("box_name")
            new_stem = body.get("stem")
            if new_name is not None or new_stem is not None:
                old_stem = data.get("stem") or stem
                if new_name is not None:
                    data["box_name"] = str(new_name).strip() or data.get("box_name")
                ns = (
                    re.sub(r"[^\w\-]+", "", str(new_stem).strip())
                    if new_stem is not None
                    else old_stem
                ) or old_stem
                if ns != old_stem:
                    target = shot_path(ns)
                    if target.exists():
                        return self._send(409, {"error": "stem already exists", "stem": ns})
                    data = rewrite_stem_in_box(data, old_stem, ns)
                    save_json(target, data)
                    p.unlink()
                    patch_relates_across(old_stem, ns)
                    return self._send(200, data)
                save_json(p, data)
                return self._send(200, data)
            if "cards" in body:
                data["cards"] = body["cards"]
            save_json(p, data)
            return self._send(200, data)

        return self._send(404, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path.startswith("/api/box/"):
            rest = path[len("/api/box/") :]
            if "/card/" in rest:
                stem, _, code = rest.partition("/card/")
                stem = re.sub(r"[^\w\-]+", "", stem)
                p = shot_path(stem)
                if not p.exists():
                    return self._send(404, {"error": "box not found"})
                data = load_json(p)
                before = len(data.get("cards") or [])
                data["cards"] = [
                    c for c in (data.get("cards") or []) if c.get("shot_code") != code
                ]
                if len(data["cards"]) == before:
                    return self._send(404, {"error": "card not found"})
                save_json(p, data)
                return self._send(200, data)
            stem = re.sub(r"[^\w\-]+", "", rest)
            p = shot_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found"})
            p.unlink()
            return self._send(200, {"deleted": stem})
        return self._send(404, {"error": "not found"})


class DeskServer(ThreadingHTTPServer):
    allow_reuse_address = True
    # avoid long TIME_WAIT blocking re-launch on Windows
    daemon_threads = True


def main() -> None:
    ensure_dirs()
    try:
        httpd = DeskServer((HOST, PORT), Handler)
    except OSError as e:
        print(f"shotBOX failed to bind {HOST}:{PORT} — {e}", file=sys.stderr)
        print("Is another shotBOX (or process) already using that port?", file=sys.stderr)
        sys.exit(1)
    print(f"shotBOX desk  http://{HOST}:{PORT}/", flush=True)
    print(f"safe_box      {SAFE_BOX}", flush=True)
    print(f"box_sys       {BOX_SYS}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    main()
