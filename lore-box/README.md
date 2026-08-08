```
=================================================
  loreBOX v2
  a DATBOX by DatBox Studio
  PAPERS, PLEASE
=================================================
```

**loreBOX** is a simple software by **DatBox Studio** — LORE papers for the pocket world.

**v2** stores **papers**, not JSON bags:

| Path | Role |
|------|------|
| `docs/` | Product paper |
| `prod/box_sys/` | Desk (Papers, Please) |
| `prod/safe_box/{auth}/{deck}/` | `INSPECT.deck` + `lore_….chip` |
| `prod/box_sets/` | desk prefs only |

**Law:** no papers → no pudding.  
**Gen:** `DBS-002-LOREBOX`  
**Port:** **42929**

### What is not here

v1 JSON `.lorebox` bags were **not** migrated. They sit frozen at:

`datbox-studio/lore-box-v1-archive/` (port **42928**)

Open archive if you want old half-ass footing or to copy a card by hand.

### Run as ROM (The Deck Host)

Double-click **`prod/run-loreBOX.bat`**.

### Run desk only (browser)

```bat
cd lore-box\prod\box_sys
python server.py
```

→ http://127.0.0.1:42929/

### Paper shape (case study)

```
safe_box/SDK808/db_CHSTRMTH/INSPECT.deck
safe_box/SDK808/db_CHSTRMTH/lore_54kh-e4df-c35d.chip
```

Chip id prefix `lore_` **is** mat class on the being.  
Export: `deck_lore-SDK808-db_CHSTRMTH.store`
