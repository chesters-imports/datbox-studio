"""
Serve datbox-core static files (desk_dialog.js / css) from a ROM desk server.

Usage in Handler.do_GET before super().do_GET():

    from datbox_core.static_mount import try_serve_core_static
    if try_serve_core_static(self, path, core_root=_DATBOX_CORE):
        return
"""

from __future__ import annotations

from pathlib import Path
from typing import Any


def try_serve_core_static(
    handler: Any,
    path: str,
    core_root: Path,
    prefix: str = "/datbox-core/",
) -> bool:
    """
    If path is under prefix, write the file and return True (caller returns).
    Otherwise return False.
    """
    if not path.startswith(prefix):
        return False
    rel = path[len(prefix) :].replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        handler.send_error(400, "bad path")
        return True
    root = Path(core_root).resolve()
    file_path = (root / rel).resolve()
    try:
        file_path.relative_to(root)
    except ValueError:
        handler.send_error(403, "forbidden")
        return True
    if not file_path.is_file():
        handler.send_error(404, "not found")
        return True
    raw = file_path.read_bytes()
    ctype = "application/octet-stream"
    if file_path.suffix == ".js":
        ctype = "application/javascript"
    elif file_path.suffix == ".css":
        ctype = "text/css"
    elif file_path.suffix == ".md":
        ctype = "text/markdown"
    elif file_path.suffix == ".json":
        ctype = "application/json"
    handler.send_response(200)
    handler.send_header("Content-Type", f"{ctype}; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(raw)
    return True
