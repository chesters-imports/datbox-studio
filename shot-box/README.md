```
=================================================
  shotBOX
  a DATBOX by DatBox Studio
=================================================
```

**shotBOX** is a simple software by **DatBox Studio** — a ROM for **SHOT** mats: captured moments, frames, cuts of the world.

| Path | Role |
|------|------|
| `docs/` | Product paper (planner, freezes) |
| `prod/box_sys/` | The ROM program |
| `prod/safe_box/` | `.shot` saves only |
| `prod/box_sets/` | ROM settings |

### Run

Double-click **`prod/run-shotBOX.bat`** (The Deck Host + local desk on port **43001**).

Or desk only: `cd prod\box_sys` → `python server.py` → http://127.0.0.1:43001/

**Status:** online again (desk profile + `desk_prefs` window mode). Full **datbox-core** port can follow when needed; bags in `safe_box/` remain valid.

Model: ICU **shotDesk** (scene construction cards). Not a lore encyclopedia — use **loreBOX** for that.

### Bags on the island

`prod/safe_box/*.shot` are house mats — fine to commit and share.  
A future **distro** package is still “runtime + chosen bags,” not every private experiment by default unless you put it in the bag on purpose.
