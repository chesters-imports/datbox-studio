#!/usr/bin/env python3
"""
loreBOX desk server — first pass.
Serves the inner app and reads/writes only:
  ../safe_box/*.lore
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
PORT = 42929


def ensure_dirs() -> None:
    SAFE_BOX.mkdir(parents=True, exist_ok=True)
    BOX_SETS.mkdir(parents=True, exist_ok=True)
    rel = BOX_SETS / "relation_types.json"
    if not rel.exists():
        rel.write_text(
            json.dumps({"version": 1, "types": ["Relates to"]}, indent=2) + "\n",
            encoding="utf-8",
        )


def stem_type_a(name: str) -> str:
    """TYPE A: first character of each whitespace-separated word."""
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
            # skip pure punctuation tokens; if first char junk, scan for alnum
            for c in word:
                if c.isalpha():
                    parts.append(c.upper())
                    break
                if c.isdigit():
                    parts.append(c)
                    break
    return "".join(parts) or "X"


def lore_path(stem: str) -> Path:
    safe = re.sub(r"[^\w\-]+", "", stem, flags=re.UNICODE)
    if not safe:
        raise ValueError("empty stem")
    return SAFE_BOX / f"{safe}.lore"


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
        "mat": "lore",
        "version": 1,
        "box_name": box_name,
        "stem": stem,
        "next_seq": 1,
        "cards": [],
    }


def list_boxes() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in sorted(SAFE_BOX.glob("*.lore")):
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
    """Cross-box catalog for RELATE picker."""
    rows: list[dict[str, Any]] = []
    for p in sorted(SAFE_BOX.glob("*.lore")):
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
                    "lore_code": card.get("lore_code") or card.get("lore_core") or "",
                    "headliner": card.get("headliner") or "",
                }
            )
    return rows


def rewrite_stem_in_box(data: dict[str, Any], old_stem: str, new_stem: str) -> dict[str, Any]:
    data = json.loads(json.dumps(data))  # deep copy
    data["stem"] = new_stem
    for card in data.get("cards") or []:
        code = card.get("lore_code") or card.get("lore_core") or ""
        m = re.match(rf"^{re.escape(old_stem)}-(\d+)\.frag$", code)
        if m:
            new_code = f"{new_stem}-{m.group(1)}.frag"
            card["lore_code"] = new_code
            card["lore_core"] = new_code
        for rel in card.get("relates") or []:
            t = rel.get("to") or ""
            m2 = re.match(rf"^{re.escape(old_stem)}-(\d+)\.frag$", t)
            if m2:
                rel["to"] = f"{new_stem}-{m2.group(1)}.frag"
    return data


def patch_relates_across_safe_box(old_stem: str, new_stem: str) -> None:
    for p in SAFE_BOX.glob("*.lore"):
        try:
            data = load_json(p)
        except (OSError, json.JSONDecodeError):
            continue
        changed = False
        for card in data.get("cards") or []:
            for rel in card.get("relates") or []:
                t = rel.get("to") or ""
                m = re.match(rf"^{re.escape(old_stem)}-(\d+)\.frag$", t)
                if m:
                    rel["to"] = f"{new_stem}-{m.group(1)}.frag"
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
            return self._send(200, {"ok": True, "app": "loreBOX", "safe_box": str(SAFE_BOX)})

        if path == "/api/boxes":
            return self._send(200, {"boxes": list_boxes()})

        if path == "/api/catalog":
            return self._send(200, {"cards": all_cards_index()})

        if path == "/api/settings/relation_types":
            p = BOX_SETS / "relation_types.json"
            ensure_dirs()
            return self._send(200, load_json(p))

        if path == "/api/stem":
            qs = parse_qs(parsed.query)
            name = (qs.get("name") or [""])[0]
            return self._send(200, {"stem": stem_type_a(name)})

        if path.startswith("/api/box/"):
            stem = path[len("/api/box/") :]
            stem = re.sub(r"[^\w\-]+", "", stem)
            p = lore_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found", "stem": stem})
            return self._send(200, load_json(p))

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
            p = lore_path(stem)
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
            stem = path[len("/api/box/") : -len("/card")]
            stem = re.sub(r"[^\w\-]+", "", stem)
            p = lore_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found"})
            data = load_json(p)
            seq = int(data.get("next_seq") or 1)
            code = f"{stem}-{seq:03d}.frag"
            card = {
                "lore_code": code,
                "lore_core": code,
                "headliner": (body.get("headliner") or "").strip(),
                "slugline": (body.get("slugline") or "").strip(),
                "prime_lore": body.get("prime_lore") or "",
                "gravity": int(body.get("gravity") or 0),
                "relates": body.get("relates") if isinstance(body.get("relates"), list) else [],
            }
            # Time Machina nick — write on mint when client already peeked the cord
            tps_chip = str(body.get("tps_chip") or "").strip()
            tps_export = str(body.get("tps_export") or "").strip()
            if tps_chip:
                card["tps_chip"] = tps_chip
            if tps_export:
                card["tps_export"] = tps_export
            data.setdefault("cards", []).append(card)
            data["next_seq"] = seq + 1
            save_json(p, data)
            return self._send(201, {"box": data, "card": card})

        return self._send(404, {"error": "not found"})

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json()
        except json.JSONDecodeError:
            return self._send(400, {"error": "bad json"})

        # PUT /api/box/{stem}  full save or rename
        if path.startswith("/api/box/"):
            rest = path[len("/api/box/") :]
            if "/card/" in rest:
                stem, _, code = rest.partition("/card/")
                stem = re.sub(r"[^\w\-]+", "", stem)
                p = lore_path(stem)
                if not p.exists():
                    return self._send(404, {"error": "box not found"})
                data = load_json(p)
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
                # TPS nick: only SET when non-empty — never wipe on ""
                tps_chip = str(body.get("tps_chip") or "").strip()
                tps_export = str(body.get("tps_export") or "").strip()
                if tps_chip:
                    found["tps_chip"] = tps_chip
                if tps_export:
                    found["tps_export"] = tps_export
                if body.get("tps_clear"):
                    found.pop("tps_chip", None)
                    found.pop("tps_export", None)
                if "prime_lore" in body:
                    found["prime_lore"] = str(body.get("prime_lore") or "")
                if "gravity" in body:
                    found["gravity"] = int(body.get("gravity") or 0)
                if "relates" in body and isinstance(body.get("relates"), list):
                    found["relates"] = body["relates"]
                found["lore_core"] = found.get("lore_code") or code
                save_json(p, data)
                return self._send(200, {"box": data, "card": found})

            stem = re.sub(r"[^\w\-]+", "", rest)
            p = lore_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found"})
            data = load_json(p)

            # rename box
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
                    target = lore_path(ns)
                    if target.exists():
                        return self._send(409, {"error": "stem already exists", "stem": ns})
                    data = rewrite_stem_in_box(data, old_stem, ns)
                    save_json(target, data)
                    p.unlink()
                    patch_relates_across_safe_box(old_stem, ns)
                    return self._send(200, data)
                save_json(p, data)
                return self._send(200, data)

            # full replace cards payload (careful save from client)
            if "cards" in body:
                data["cards"] = body["cards"]
            if "box_name" in body:
                data["box_name"] = body["box_name"]
            if "next_seq" in body:
                data["next_seq"] = int(body["next_seq"])
            save_json(p, data)
            return self._send(200, data)

        return self._send(404, {"error": "not found"})

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/box/"):
            rest = path[len("/api/box/") :]
            if "/card/" in rest:
                stem, _, code = rest.partition("/card/")
                stem = re.sub(r"[^\w\-]+", "", stem)
                p = lore_path(stem)
                if not p.exists():
                    return self._send(404, {"error": "box not found"})
                data = load_json(p)
                before = len(data.get("cards") or [])
                data["cards"] = [
                    c
                    for c in (data.get("cards") or [])
                    if c.get("lore_code") != code and c.get("lore_core") != code
                ]
                if len(data["cards"]) == before:
                    return self._send(404, {"error": "card not found"})
                save_json(p, data)
                return self._send(200, data)

            stem = re.sub(r"[^\w\-]+", "", rest)
            p = lore_path(stem)
            if not p.exists():
                return self._send(404, {"error": "box not found"})
            p.unlink()
            return self._send(200, {"deleted": stem})

        return self._send(404, {"error": "not found"})


class DeskServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> None:
    ensure_dirs()
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
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    main()
