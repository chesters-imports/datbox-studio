#!/usr/bin/env python3
"""
sonaBOX · CO.DBS-SONA — beings / KVEN vault desk
Mountable .safebox (SQLite). AUBEL schema slice 0.
"""

from __future__ import annotations

import json
import os
import random
import re
import sqlite3
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

BOX_SYS = Path(__file__).resolve().parent
PROD = BOX_SYS.parent
SAFE_BOX = PROD / "safe_box"
HOST = "127.0.0.1"
PORT = int(os.environ.get("SONABOX_PORT", "42935"))

ANI = list("ABSDKIQXEPLW")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS VAULT_META (
  CHIP TEXT PRIMARY KEY,
  TITLE TEXT NOT NULL,
  KIND TEXT NOT NULL,
  PATH TEXT NOT NULL,
  NOTES TEXT
);
CREATE TABLE IF NOT EXISTS MASTERHEAD (
  CHIP TEXT PRIMARY KEY,
  TITLE TEXT NOT NULL,
  PAYLOAD_KIND TEXT NOT NULL,
  SYSTEM TEXT,
  DOMINION TEXT,
  ROOM TEXT,
  OPERATOR TEXT,
  EVENT_UNIX INTEGER NOT NULL,
  INGEST_UNIX INTEGER NOT NULL,
  UPDATED INTEGER NOT NULL,
  TAGS_RAW TEXT,
  GRAVITY REAL,
  PRODUCER TEXT,
  PRODUCER_VER TEXT
);
CREATE TABLE IF NOT EXISTS PAYLOAD (
  CHIP TEXT PRIMARY KEY,
  BODY TEXT NOT NULL,
  BODY_FORMAT TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS KVEN (
  KVEN TEXT PRIMARY KEY,
  ALTS TEXT,
  LABEL TEXT,
  MATCHES TEXT,
  TYPE TEXT,
  NOTES TEXT,
  CREATED INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS NOTCH (
  NOTCH_CHIP TEXT PRIMARY KEY,
  FROM_CHIP TEXT NOT NULL,
  TO_CHIP TEXT NOT NULL,
  KIND TEXT,
  LEAF_QUOTE TEXT,
  CREATED INTEGER NOT NULL
);
"""


def now() -> int:
    return int(time.time())


def ensure_safe() -> None:
    SAFE_BOX.mkdir(parents=True, exist_ok=True)


def vault_path(chip: str) -> Path:
    safe = re.sub(r"[^\w\-]+", "", chip or "")
    if not safe:
        raise ValueError("bad vault chip")
    return SAFE_BOX / f"{safe}.safebox"


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    return conn


def mint_kven_code(conn: sqlite3.Connection | None = None) -> str:
    for _ in range(40):
        code = "".join(random.choice(ANI) for _ in range(3)) + "-" + "".join(
            str(random.randint(0, 9)) for _ in range(3)
        )
        if conn is None:
            return code
        if not conn.execute("SELECT 1 FROM KVEN WHERE KVEN=?", (code,)).fetchone():
            return code
    return "".join(random.choice(ANI) for _ in range(3)) + "-" + str(now() % 1000).zfill(3)


def valid_kven(code: str) -> bool:
    return bool(re.match(r"^[A-Za-z]{3}-\d{3}$", (code or "").strip()))


def list_vaults() -> list[dict[str, Any]]:
    ensure_safe()
    out: list[dict[str, Any]] = []
    for p in sorted(SAFE_BOX.glob("*.safebox")):
        try:
            with connect(p) as conn:
                row = conn.execute(
                    "SELECT CHIP, TITLE, KIND, NOTES FROM VAULT_META LIMIT 1"
                ).fetchone()
            if row:
                out.append(
                    {
                        "CHIP": row["CHIP"],
                        "TITLE": row["TITLE"],
                        "KIND": row["KIND"],
                        "NOTES": row["NOTES"] or "",
                        "file": p.name,
                    }
                )
            else:
                out.append(
                    {
                        "CHIP": p.stem,
                        "TITLE": p.stem,
                        "KIND": "MIXED",
                        "NOTES": "",
                        "file": p.name,
                    }
                )
        except sqlite3.Error:
            out.append(
                {
                    "CHIP": p.stem,
                    "TITLE": p.stem,
                    "KIND": "MIXED",
                    "NOTES": "unreadable",
                    "file": p.name,
                }
            )
    return out


def create_vault(chip: str, title: str, kind: str = "NARRATIVE") -> dict[str, Any]:
    ensure_safe()
    chip = re.sub(r"[^\w\-]+", "", (chip or "").upper()) or (
        "V-" + mint_kven_code().replace("-", "")
    )
    title = (title or chip).strip()
    kind = (kind or "NARRATIVE").strip().upper()
    if kind not in ("NARRATIVE", "PROJECT", "MIXED"):
        kind = "MIXED"
    path = vault_path(chip)
    if path.is_file():
        raise ValueError("vault already exists")
    with connect(path) as conn:
        conn.execute(
            "INSERT INTO VAULT_META (CHIP, TITLE, KIND, PATH, NOTES) VALUES (?,?,?,?,?)",
            (chip, title, kind, str(path), ""),
        )
        conn.commit()
    return {"CHIP": chip, "TITLE": title, "KIND": kind, "file": path.name}


def open_vault(chip: str) -> Path:
    ensure_safe()
    path = vault_path(chip)
    if path.is_file():
        return path
    for p in SAFE_BOX.glob("*.safebox"):
        if p.stem.upper() == (chip or "").upper():
            return p
    raise FileNotFoundError("vault not found")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BOX_SYS), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[sonaBOX] {args[0] if args else fmt}")

    def _send(self, code: int, body: bytes, ctype: str = "application/json; charset=utf-8") -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj: Any, code: int = 200) -> None:
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def _read_json(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def do_GET(self) -> None:  # noqa: N802
        u = urlparse(self.path)
        path = u.path
        q = parse_qs(u.query)

        if path in ("/api/health", "/health"):
            self._json(
                {"ok": True, "product": "sonaBOX", "sku": "CO.DBS-SONA", "port": PORT}
            )
            return
        if path == "/api/vaults":
            self._json({"ok": True, "vaults": list_vaults()})
            return

        if path in ("/api/kven", "/api/notches", "/api/leaves"):
            vchip = (q.get("vault") or [""])[0]
            try:
                vp = open_vault(vchip)
            except (FileNotFoundError, ValueError) as e:
                self._json({"ok": False, "error": str(e)}, 400)
                return
            with connect(vp) as conn:
                if path == "/api/kven":
                    rows = conn.execute(
                        "SELECT KVEN, ALTS, LABEL, MATCHES, TYPE, NOTES, CREATED FROM KVEN ORDER BY CREATED DESC"
                    ).fetchall()
                elif path == "/api/notches":
                    rows = conn.execute(
                        "SELECT NOTCH_CHIP, FROM_CHIP, TO_CHIP, KIND, LEAF_QUOTE, CREATED FROM NOTCH ORDER BY CREATED DESC"
                    ).fetchall()
                else:
                    rows = conn.execute(
                        """
                        SELECT m.CHIP, m.TITLE, m.PAYLOAD_KIND, m.SYSTEM, m.DOMINION,
                               m.OPERATOR, m.EVENT_UNIX, m.INGEST_UNIX, m.UPDATED,
                               m.PRODUCER, m.PRODUCER_VER, p.BODY, p.BODY_FORMAT
                        FROM MASTERHEAD m
                        LEFT JOIN PAYLOAD p ON p.CHIP = m.CHIP
                        ORDER BY m.UPDATED DESC
                        """
                    ).fetchall()
            self._json({"ok": True, "items": [dict(r) for r in rows]})
            return

        if path in ("/", ""):
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        data = self._read_json()
        try:
            if path == "/api/vaults":
                v = create_vault(
                    str(data.get("CHIP") or data.get("chip") or ""),
                    str(data.get("TITLE") or data.get("title") or ""),
                    str(data.get("KIND") or "NARRATIVE"),
                )
                self._json({"ok": True, "vault": v})
                return

            if path == "/api/kven":
                vp = open_vault(str(data.get("vault") or ""))
                hand = str(data.get("KVEN") or data.get("kven") or "").strip().upper()
                with connect(vp) as conn:
                    if hand:
                        code_s = (
                            hand
                            if valid_kven(hand)
                            else re.sub(r"[^\w\-]+", "", hand)
                        )
                        if not code_s:
                            code_s = mint_kven_code(conn)
                    else:
                        code_s = mint_kven_code(conn)
                    t = now()
                    conn.execute(
                        """
                        INSERT INTO KVEN (KVEN, ALTS, LABEL, MATCHES, TYPE, NOTES, CREATED)
                        VALUES (?,?,?,?,?,?,?)
                        ON CONFLICT(KVEN) DO UPDATE SET
                          ALTS=excluded.ALTS, LABEL=excluded.LABEL,
                          MATCHES=excluded.MATCHES, TYPE=excluded.TYPE, NOTES=excluded.NOTES
                        """,
                        (
                            code_s,
                            str(data.get("ALTS") or data.get("alts") or ""),
                            str(data.get("LABEL") or data.get("label") or ""),
                            str(data.get("MATCHES") or data.get("matches") or ""),
                            str(data.get("TYPE") or data.get("type") or ""),
                            str(data.get("NOTES") or data.get("notes") or ""),
                            t,
                        ),
                    )
                    conn.commit()
                self._json({"ok": True, "KVEN": code_s})
                return

            if path == "/api/notch":
                vp = open_vault(str(data.get("vault") or ""))
                fr = str(data.get("FROM_CHIP") or data.get("from") or "").strip()
                to = str(data.get("TO_CHIP") or data.get("to") or "").strip()
                if not fr or not to:
                    raise ValueError("FROM_CHIP and TO_CHIP required")
                nid = str(data.get("NOTCH_CHIP") or "") or ("N-" + mint_kven_code())
                with connect(vp) as conn:
                    conn.execute(
                        """
                        INSERT INTO NOTCH (NOTCH_CHIP, FROM_CHIP, TO_CHIP, KIND, LEAF_QUOTE, CREATED)
                        VALUES (?,?,?,?,?,?)
                        """,
                        (
                            nid,
                            fr,
                            to,
                            str(data.get("KIND") or "ABOUT"),
                            str(data.get("LEAF_QUOTE") or data.get("quote") or ""),
                            now(),
                        ),
                    )
                    conn.commit()
                self._json({"ok": True, "NOTCH_CHIP": nid})
                return

            if path == "/api/leaf":
                vp = open_vault(str(data.get("vault") or ""))
                chip = str(data.get("CHIP") or data.get("chip") or "").strip()
                if not chip:
                    chip = "L-" + mint_kven_code()
                title = str(data.get("TITLE") or data.get("title") or "untitled").strip()
                body = str(data.get("BODY") or data.get("body") or "")
                pkind = str(data.get("PAYLOAD_KIND") or "MD").strip().upper() or "MD"
                t = now()
                try:
                    event_u = int(data["EVENT_UNIX"]) if data.get("EVENT_UNIX") not in (None, "") else t
                except (TypeError, ValueError):
                    event_u = t
                with connect(vp) as conn:
                    conn.execute(
                        """
                        INSERT INTO MASTERHEAD (
                          CHIP, TITLE, PAYLOAD_KIND, SYSTEM, DOMINION, ROOM, OPERATOR,
                          EVENT_UNIX, INGEST_UNIX, UPDATED, TAGS_RAW, GRAVITY, PRODUCER, PRODUCER_VER
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        ON CONFLICT(CHIP) DO UPDATE SET
                          TITLE=excluded.TITLE,
                          PAYLOAD_KIND=excluded.PAYLOAD_KIND,
                          SYSTEM=excluded.SYSTEM,
                          DOMINION=excluded.DOMINION,
                          ROOM=excluded.ROOM,
                          OPERATOR=excluded.OPERATOR,
                          EVENT_UNIX=excluded.EVENT_UNIX,
                          UPDATED=excluded.UPDATED,
                          TAGS_RAW=excluded.TAGS_RAW,
                          PRODUCER=excluded.PRODUCER,
                          PRODUCER_VER=excluded.PRODUCER_VER
                        """,
                        (
                            chip,
                            title,
                            pkind,
                            str(data.get("SYSTEM") or "DATBOX"),
                            str(data.get("DOMINION") or data.get("DOMAIN") or ""),
                            str(data.get("ROOM") or ""),
                            str(data.get("OPERATOR") or ""),
                            event_u,
                            t,
                            t,
                            str(data.get("TAGS_RAW") or ""),
                            data.get("GRAVITY"),
                            "sonaBOX",
                            "1",
                        ),
                    )
                    conn.execute(
                        """
                        INSERT INTO PAYLOAD (CHIP, BODY, BODY_FORMAT) VALUES (?,?,?)
                        ON CONFLICT(CHIP) DO UPDATE SET
                          BODY=excluded.BODY, BODY_FORMAT=excluded.BODY_FORMAT
                        """,
                        (chip, body, str(data.get("BODY_FORMAT") or "MD")),
                    )
                    conn.commit()
                self._json({"ok": True, "CHIP": chip})
                return

            self._json({"ok": False, "error": "unknown door"}, 404)
        except Exception as e:
            self._json({"ok": False, "error": str(e)}, 400)


def main() -> int:
    ensure_safe()
    if not list(SAFE_BOX.glob("*.safebox")):
        try:
            create_vault("SONA-001", "First census", "NARRATIVE")
        except ValueError:
            pass
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"sonaBOX · CO.DBS-SONA  http://{HOST}:{PORT}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\ncensus closed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
