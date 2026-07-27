```
=================================================
  datbox-core
  shared shelf + bag plumbing · not a runnable ROM
=================================================
```

**Import me. Do not open me as a desk.**

Paper of record (sopr): **Big Box · `DATBOX-CORE-LAWS.sopr`**  
(`big-box-company/sopr-documenter/prod/safe_box/DATBOX-CORE-LAWS.sopr`)

DATBOX Studio ROMs (loreBOX, shotBOX, memBOX, …) stay **islands**: own port, own `safe_box`, own card fields.  
This package is the **shared grammar** so one improvement hits the product line.

---

### Prefs: same schema, not shared state

Hands freeze: you may want the *same knobs* on every DATBOX, but **not** one settings blob forced onto all ROMs (or other product lines).

| | |
|--|--|
| **Per ROM file** | `{that-rom}/prod/box_sets/desk_prefs.json` |
| **Schema** | `version`, `theme`, `safe_compact`, `window_mode` (see `prefs_schema.py`) |
| **OK** | loreBOX Compact window + shotBOX Expanded at the same time |
| **Never** | One global AppData “all DATBOX” prefs store that overrides every island |

Python helpers: `coerce_desk_prefs`, `normalize_theme`, `normalize_window_mode`.

---

### House freezes

| Rule | Detail |
|------|--------|
| Islands | Own vault. No shared mega-safe_box across mats. |
| Bags | `{STEM}{bag_ext}` e.g. `BIGBOX.lorebox` |
| Shelf paper | `_{rom_slug}.datshelf` at vault root |
| Place | Physical folders under `safe_box/` |
| Order | Drag order in `.datshelf` |
| Dialogs | `DatboxDesk` only — no `window.confirm` / `alert` / `prompt` |
| ShotBOX | Frozen until lore + core laws are happy |
| myPI | **No auto-migrate.** Rebuild later from scratch. |

---

### Python package

```text
datbox-core/py/datbox_core/
  stem.py           TYPE A stems
  io.py             load/save JSON
  profile.py        MatProfile
  shelf.py          _{rom}.datshelf
  vault.py          list / folders / bags / reorder
  prefs_schema.py   desk_prefs key law (per-ROM files)
  static_mount.py   try_serve_core_static(...)
```

```python
from datbox_core import MatProfile, SafeVault, try_serve_core_static, coerce_desk_prefs
```

Static mount in `do_GET`:

```python
if try_serve_core_static(self, path, core_root=_DATBOX_CORE):
    return
```

---

### Front desk

```text
js/desk_dialog.js
css/desk_dialog.css
```

Serve at `/datbox-core/*`. Configure brand: `DatboxDesk.configure({ brandHtml: "…" })`.

---

### Distro (honest v1)

- **Program** files may be replaced on update.
- **User data** (`safe_box`, `desk_prefs`, bags) must never be wiped by install.
- No required in-app auto-updater for v1; optional later “open release URL / download package.”
- Launcher passes `--window-mode` from that ROM’s `desk_prefs` (see lore `run-in-deck-host.py`).

Full checklist, health protocol, upgrade notes: **DATBOX-CORE-LAWS.sopr**.

---

### Not in core

Card form fields, relation vocabularies, ports, company lore copy, Deck Host pixel tables, reverse-link OS, cloud.
