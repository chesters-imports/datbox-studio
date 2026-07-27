```
=================================================
  loreBOX
  a DATBOX by DatBox Studio
=================================================
```

**loreBOX** is a simple software by **DatBox Studio** — LORE-branded datmats for the pocket world.

| Path | Role |
|------|------|
| `docs/` | Product paper (planner, freezes) |
| `prod/box_sys/` | The box program (imports `datbox-core`) |
| `prod/safe_box/` | `.lorebox` bags · physical folders · `_lorebox.datshelf` |
| `prod/box_sets/` | ROM settings |

**Shelf:** drag order + folder place via datbox-core (`_{rom}.datshelf`). shotBOX frozen — lore is first ROM on core.

Ticket / freeze: [[lore-box-planner]]

### Run as a ROM (The Deck Host)

Double-click **`prod/run-loreBOX.bat`** (or `run-loreBOX-quiet.bat`).

That starts this ROM’s desk server, opens **The Deck Host** on it, and stops the server when you close the window.  
loreBOX files stay here; the host island only provides the window.

Requires sibling: `ALICE_BOX/the-deck-host/shell/deck_host.py` and `pip install pywebview`.

### Run desk only (browser / dev)

```bat
cd lore-box\prod\box_sys
python server.py
```

| URL | Notes |
|-----|--------|
| **http://datbox.lorebox.localhost:42929/** | Cute tester name |
| http://127.0.0.1:42929/ | Plain loopback |

Saves: `prod/safe_box/`. Settings: `prod/box_sets/`.
