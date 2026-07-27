"""
SafeVault — one ROM's safe_box: physical folders + _{rom}.datshelf order.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any, Callable

from .io import load_json, save_json
from .profile import MatProfile
from .shelf import (
    empty_shelf,
    is_reserved_name,
    load_shelf,
    sanitize_folder_id,
    save_shelf,
    shelf_filename,
)
from .stem import stem_type_a


class SafeVault:
    def __init__(self, safe_box: Path, profile: MatProfile) -> None:
        self.safe_box = Path(safe_box)
        self.profile = profile

    def ensure(self) -> None:
        self.safe_box.mkdir(parents=True, exist_ok=True)

    # ----- discovery -----

    def iter_bag_paths(self) -> list[Path]:
        """All bag files under safe_box (root + one level of folders)."""
        self.ensure()
        found: list[Path] = []
        seen_stems: set[str] = set()

        def consider(p: Path) -> None:
            if not p.is_file():
                return
            if is_reserved_name(p.name, self.profile):
                return
            stem = p.stem
            # prefer canonical bag_ext over legacy (only when they differ)
            if (
                p.suffix == self.profile.legacy_ext
                and self.profile.legacy_ext != self.profile.bag_ext
            ):
                canon = p.with_suffix(self.profile.bag_ext)
                if canon.is_file():
                    return
            if stem in seen_stems:
                return
            # only our extensions
            if p.suffix not in (self.profile.bag_ext, self.profile.legacy_ext):
                return
            seen_stems.add(stem)
            found.append(p)

        for p in sorted(self.safe_box.iterdir()):
            if p.is_file():
                consider(p)
            elif p.is_dir() and not p.name.startswith("."):
                if is_reserved_name(p.name, self.profile):
                    continue
                for child in sorted(p.iterdir()):
                    if child.is_file():
                        consider(child)
        return found

    def folder_of_path(self, path: Path) -> str:
        try:
            rel = path.resolve().relative_to(self.safe_box.resolve())
        except ValueError:
            return ""
        if len(rel.parts) == 1:
            return ""
        return rel.parts[0]

    def bag_path(self, stem: str, folder: str = "") -> Path:
        safe_stem = re.sub(r"[^\w\-]+", "", stem or "")
        if not safe_stem:
            raise ValueError("empty stem")
        folder = sanitize_folder_id(folder) if folder else ""
        name = f"{safe_stem}{self.profile.bag_ext}"
        if folder:
            return self.safe_box / folder / name
        return self.safe_box / name

    def resolve_bag_path(self, stem: str) -> Path | None:
        """Find existing bag by stem anywhere in vault; migrate legacy ext."""
        safe_stem = re.sub(r"[^\w\-]+", "", stem or "")
        if not safe_stem:
            return None
        for p in self.iter_bag_paths():
            if p.stem == safe_stem:
                if p.suffix == self.profile.legacy_ext:
                    canon = p.with_suffix(self.profile.bag_ext)
                    try:
                        p.rename(canon)
                        return canon
                    except OSError:
                        return p
                return p
        # not found — default root canonical path (may not exist)
        return None

    def resolve_or_root(self, stem: str) -> Path:
        found = self.resolve_bag_path(stem)
        if found is not None:
            return found
        return self.bag_path(stem, "")

    # ----- shelf reconcile -----

    def reconcile_shelf(self) -> dict[str, Any]:
        """Scan disk; keep order of known stems; append new; drop missing."""
        shelf = load_shelf(self.safe_box, self.profile)
        on_disk: dict[str, Path] = {p.stem: p for p in self.iter_bag_paths()}

        # discover physical folders
        disk_folders: list[str] = []
        for p in sorted(self.safe_box.iterdir()):
            if (
                p.is_dir()
                and not p.name.startswith(".")
                and not is_reserved_name(p.name, self.profile)
            ):
                try:
                    fid = sanitize_folder_id(p.name)
                except ValueError:
                    continue
                disk_folders.append(fid)
                if fid not in shelf["folders"]:
                    shelf["folders"][fid] = {"id": fid, "name": fid}

        # folder_order: keep known, append new disk folders
        order = [f for f in shelf["folder_order"] if f in shelf["folders"]]
        for f in disk_folders:
            if f not in order:
                order.append(f)
        # drop folder meta for dirs that vanished (and no boxes claim them)
        claimed = set()
        new_boxes: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in shelf.get("boxes") or []:
            if not isinstance(row, dict):
                continue
            stem = re.sub(r"[^\w\-]+", "", str(row.get("stem") or ""))
            if not stem or stem in seen or stem not in on_disk:
                continue
            seen.add(stem)
            folder = self.folder_of_path(on_disk[stem])
            new_boxes.append({"stem": stem, "folder": folder})
            if folder:
                claimed.add(folder)

        for stem, path in sorted(on_disk.items()):
            if stem in seen:
                continue
            folder = self.folder_of_path(path)
            new_boxes.append({"stem": stem, "folder": folder})
            if folder:
                claimed.add(folder)
            seen.add(stem)

        # prune empty vanished folders from order/meta if dir gone
        keep_folders = {}
        for fid, meta in (shelf.get("folders") or {}).items():
            dir_path = self.safe_box / fid
            if dir_path.is_dir() or fid in claimed:
                keep_folders[fid] = meta if isinstance(meta, dict) else {"id": fid, "name": fid}
        shelf["folders"] = keep_folders
        shelf["folder_order"] = [f for f in order if f in keep_folders]
        for f in keep_folders:
            if f not in shelf["folder_order"]:
                shelf["folder_order"].append(f)

        shelf["boxes"] = new_boxes
        save_shelf(self.safe_box, self.profile, shelf)
        return shelf

    def list_tree(self) -> dict[str, Any]:
        """API-shaped vault listing with shelf order."""
        shelf = self.reconcile_shelf()
        by_stem: dict[str, dict[str, Any]] = {}
        for p in self.iter_bag_paths():
            try:
                data = load_json(p)
                meta = {
                    "stem": data.get("stem") or p.stem,
                    "box_name": data.get("box_name") or p.stem,
                    "file": p.name,
                    "path": str(p.relative_to(self.safe_box)).replace("\\", "/"),
                    "folder": self.folder_of_path(p),
                    "card_count": len(data.get("cards") or []),
                }
            except (OSError, ValueError) as e:
                meta = {
                    "stem": p.stem,
                    "box_name": p.stem,
                    "file": p.name,
                    "path": str(p.relative_to(self.safe_box)).replace("\\", "/"),
                    "folder": self.folder_of_path(p),
                    "card_count": 0,
                    "error": str(e),
                }
            by_stem[p.stem] = meta

        ordered_boxes: list[dict[str, Any]] = []
        for row in shelf.get("boxes") or []:
            stem = row.get("stem")
            if stem in by_stem:
                item = dict(by_stem[stem])
                item["folder"] = row.get("folder") or item.get("folder") or ""
                ordered_boxes.append(item)

        folders_out = []
        for fid in shelf.get("folder_order") or []:
            meta = (shelf.get("folders") or {}).get(fid) or {"id": fid, "name": fid}
            folders_out.append(
                {
                    "id": fid,
                    "name": meta.get("name") or fid,
                    "boxes": [b for b in ordered_boxes if (b.get("folder") or "") == fid],
                }
            )
        root_boxes = [b for b in ordered_boxes if not (b.get("folder") or "")]

        return {
            "shelf_file": shelf_filename(self.profile),
            "folders": folders_out,
            "root_boxes": root_boxes,
            "boxes": ordered_boxes,  # flat, shelf order (compat)
        }

    # ----- mutations -----

    def create_folder(self, name: str) -> dict[str, Any]:
        fid = sanitize_folder_id(name)
        if not fid:
            raise ValueError("folder name required")
        path = self.safe_box / fid
        if path.exists():
            raise FileExistsError(f"folder exists: {fid}")
        path.mkdir(parents=True, exist_ok=False)
        shelf = self.reconcile_shelf()
        if fid not in shelf["folders"]:
            shelf["folders"][fid] = {"id": fid, "name": fid}
        if fid not in shelf["folder_order"]:
            shelf["folder_order"].append(fid)
        save_shelf(self.safe_box, self.profile, shelf)
        return {"id": fid, "name": fid}

    def rename_folder(self, old_id: str, new_name: str) -> dict[str, Any]:
        """Rename physical folder + shelf id; move bag membership with it."""
        old = sanitize_folder_id(old_id)
        new = sanitize_folder_id(new_name)
        if not old:
            raise ValueError("folder id required")
        if not new:
            raise ValueError("new folder name required")
        src = self.safe_box / old
        if not src.is_dir():
            raise FileNotFoundError(f"folder not found: {old}")
        if new != old:
            dest = self.safe_box / new
            if dest.exists():
                raise FileExistsError(f"folder exists: {new}")
            src.rename(dest)
        shelf = load_shelf(self.safe_box, self.profile)
        folders = shelf.setdefault("folders", {})
        folders.pop(old, None)
        folders[new] = {"id": new, "name": new}
        shelf["folder_order"] = [
            (new if f == old else f) for f in (shelf.get("folder_order") or [])
        ]
        # de-dupe order
        seen_f: set[str] = set()
        clean_fo: list[str] = []
        for f in shelf["folder_order"]:
            if f and f not in seen_f:
                seen_f.add(f)
                clean_fo.append(f)
        shelf["folder_order"] = clean_fo
        for b in shelf.get("boxes") or []:
            if isinstance(b, dict) and (b.get("folder") or "") == old:
                b["folder"] = new
        save_shelf(self.safe_box, self.profile, shelf)
        return {"id": new, "name": new, "old_id": old}

    def delete_folder(self, folder_id: str) -> dict[str, Any]:
        """
        Remove a physical folder from the vault.
        Bags inside are moved to unsorted (root) — never hard-deleted with the folder.
        """
        fid = sanitize_folder_id(folder_id)
        if not fid:
            raise ValueError("folder id required")
        path = self.safe_box / fid
        if not path.is_dir():
            # still scrub shelf if ghost entry
            shelf = load_shelf(self.safe_box, self.profile)
            if fid not in (shelf.get("folders") or {}) and fid not in (
                shelf.get("folder_order") or []
            ):
                raise FileNotFoundError(f"folder not found: {fid}")
        moved: list[str] = []
        if path.is_dir():
            for child in list(path.iterdir()):
                if not child.is_file():
                    continue
                if child.suffix in (self.profile.bag_ext, self.profile.legacy_ext):
                    stem = child.stem
                    dest = self.bag_path(stem, "")
                    if dest.exists() and dest.resolve() != child.resolve():
                        raise FileExistsError(
                            f"cannot move {stem} to root — name already at unsorted"
                        )
                    if child.resolve() != dest.resolve():
                        shutil.move(str(child), str(dest))
                    moved.append(stem)
            # refuse if non-empty leftover (nested junk)
            leftovers = [p.name for p in path.iterdir()] if path.is_dir() else []
            if leftovers:
                raise ValueError(
                    f"folder not empty after moving bags: {', '.join(leftovers[:5])}"
                )
            path.rmdir()

        shelf = load_shelf(self.safe_box, self.profile)
        folders = shelf.setdefault("folders", {})
        folders.pop(fid, None)
        shelf["folder_order"] = [
            f for f in (shelf.get("folder_order") or []) if f != fid
        ]
        for b in shelf.get("boxes") or []:
            if isinstance(b, dict) and (b.get("folder") or "") == fid:
                b["folder"] = ""
        save_shelf(self.safe_box, self.profile, shelf)
        return {"deleted": fid, "moved_to_unsorted": moved}

    def create_box(
        self,
        box_name: str,
        stem: str | None = None,
        folder: str = "",
        empty_box: Callable[[str, str], dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        box_name = (box_name or "").strip()
        if not box_name:
            raise ValueError("box_name required")
        st = re.sub(r"[^\w\-]+", "", (stem or "").strip() or stem_type_a(box_name)) or "X"
        if self.resolve_bag_path(st) is not None:
            raise FileExistsError(f"stem already exists: {st}")
        folder = sanitize_folder_id(folder) if folder else ""
        if folder:
            (self.safe_box / folder).mkdir(parents=True, exist_ok=True)
        path = self.bag_path(st, folder)
        if empty_box is None:
            data = {
                "house": self.profile.house,
                "mat": self.profile.mat,
                "version": 1,
                "box_name": box_name,
                "stem": st,
                "next_seq": 1,
                "cards": [],
            }
        else:
            data = empty_box(box_name, st)
        save_json(path, data)
        shelf = load_shelf(self.safe_box, self.profile)
        # prepend new box in its folder group (newest-first feel in place)
        boxes = [b for b in (shelf.get("boxes") or []) if isinstance(b, dict)]
        boxes = [b for b in boxes if b.get("stem") != st]
        # insert at start of same-folder group, or append if none
        insert_at = 0
        for i, b in enumerate(boxes):
            if (b.get("folder") or "") == folder:
                insert_at = i
                break
        else:
            insert_at = len(boxes)
        boxes.insert(insert_at, {"stem": st, "folder": folder})
        shelf["boxes"] = boxes
        if folder and folder not in shelf.get("folders", {}):
            shelf.setdefault("folders", {})[folder] = {"id": folder, "name": folder}
            if folder not in shelf.get("folder_order", []):
                shelf.setdefault("folder_order", []).append(folder)
        save_shelf(self.safe_box, self.profile, shelf)
        return data

    def delete_box(self, stem: str) -> None:
        p = self.resolve_bag_path(stem)
        if p is None or not p.is_file():
            raise FileNotFoundError(stem)
        p.unlink()
        shelf = load_shelf(self.safe_box, self.profile)
        shelf["boxes"] = [
            b
            for b in (shelf.get("boxes") or [])
            if isinstance(b, dict) and b.get("stem") != stem
        ]
        save_shelf(self.safe_box, self.profile, shelf)

    def move_box(self, stem: str, folder: str = "") -> Path:
        """Move bag file into folder (or root). Updates shelf membership."""
        src = self.resolve_bag_path(stem)
        if src is None or not src.is_file():
            raise FileNotFoundError(stem)
        folder = sanitize_folder_id(folder) if folder else ""
        if folder:
            (self.safe_box / folder).mkdir(parents=True, exist_ok=True)
        dest = self.bag_path(stem, folder)
        if src.resolve() == dest.resolve():
            return src
        if dest.exists():
            raise FileExistsError(str(dest))
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        shelf = load_shelf(self.safe_box, self.profile)
        found = False
        for b in shelf.get("boxes") or []:
            if isinstance(b, dict) and b.get("stem") == stem:
                b["folder"] = folder
                found = True
        if not found:
            shelf.setdefault("boxes", []).append({"stem": stem, "folder": folder})
        save_shelf(self.safe_box, self.profile, shelf)
        return dest

    def rename_box_file(self, old_stem: str, new_stem: str, data: dict[str, Any]) -> Path:
        """Write data to new stem path, remove old file, update shelf stem."""
        src = self.resolve_bag_path(old_stem)
        if src is None or not src.is_file():
            raise FileNotFoundError(old_stem)
        folder = self.folder_of_path(src)
        ns = re.sub(r"[^\w\-]+", "", new_stem or "") or old_stem
        if ns != old_stem and self.resolve_bag_path(ns) is not None:
            raise FileExistsError(ns)
        dest = self.bag_path(ns, folder)
        save_json(dest, data)
        if src.resolve() != dest.resolve():
            src.unlink()
        shelf = load_shelf(self.safe_box, self.profile)
        for b in shelf.get("boxes") or []:
            if isinstance(b, dict) and b.get("stem") == old_stem:
                b["stem"] = ns
                b["folder"] = folder
        save_shelf(self.safe_box, self.profile, shelf)
        return dest

    def apply_layout(
        self,
        folder_order: list[str] | None = None,
        boxes: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Persist drag order + membership.
        boxes: [{stem, folder}] in display order.
        Moves files on disk when folder membership changes.
        """
        shelf = self.reconcile_shelf()
        if isinstance(folder_order, list):
            clean_fo = []
            for f in folder_order:
                try:
                    fid = sanitize_folder_id(str(f)) if f else ""
                except ValueError:
                    continue
                if fid and fid not in clean_fo:
                    clean_fo.append(fid)
            for f in shelf.get("folder_order") or []:
                if f not in clean_fo and f in (shelf.get("folders") or {}):
                    clean_fo.append(f)
            shelf["folder_order"] = clean_fo

        if isinstance(boxes, list):
            new_rows: list[dict[str, Any]] = []
            seen: set[str] = set()
            for row in boxes:
                if not isinstance(row, dict):
                    continue
                stem = re.sub(r"[^\w\-]+", "", str(row.get("stem") or ""))
                if not stem or stem in seen:
                    continue
                cur = self.resolve_bag_path(stem)
                if cur is None:
                    continue
                try:
                    folder = sanitize_folder_id(str(row.get("folder") or ""))
                except ValueError:
                    folder = ""
                if self.folder_of_path(cur) != folder:
                    if folder:
                        (self.safe_box / folder).mkdir(parents=True, exist_ok=True)
                    dest = self.bag_path(stem, folder)
                    if cur.resolve() != dest.resolve():
                        if dest.exists():
                            raise FileExistsError(str(dest))
                        shutil.move(str(cur), str(dest))
                new_rows.append({"stem": stem, "folder": folder})
                seen.add(stem)
            for p in self.iter_bag_paths():
                if p.stem not in seen:
                    new_rows.append(
                        {"stem": p.stem, "folder": self.folder_of_path(p)}
                    )
            shelf["boxes"] = new_rows

        save_shelf(self.safe_box, self.profile, shelf)
        return self.list_tree()

    def load_box(self, stem: str) -> dict[str, Any]:
        p = self.resolve_bag_path(stem)
        if p is None or not p.is_file():
            raise FileNotFoundError(stem)
        return load_json(p)

    def save_box_at_stem(self, stem: str, data: dict[str, Any]) -> None:
        p = self.resolve_bag_path(stem)
        if p is None:
            raise FileNotFoundError(stem)
        save_json(p, data)

    def all_bag_data(self) -> list[tuple[str, Path, dict[str, Any]]]:
        rows = []
        for p in self.iter_bag_paths():
            try:
                data = load_json(p)
            except (OSError, ValueError):
                continue
            stem = data.get("stem") or p.stem
            rows.append((stem, p, data))
        return rows
