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
| `prod/box_sys/` | The box program |
| `prod/safe_box/` | `.lore` saves only |
| `prod/box_sets/` | ROM settings |

Ticket / freeze: [[lore-box-planner]]

### Run the desk (first pass)

```bat
cd lore-box\prod\box_sys
python server.py
```

Or double-click **`prod/box_sys/launch-desk.bat`**.

| URL | Notes |
|-----|--------|
| **http://datbox.lorebox.localhost:42929/** | Cute tester name (no hosts file; modern browsers) |
| http://127.0.0.1:42929/ | Plain loopback |

Saves only under `prod/safe_box/`. Settings: `prod/box_sets/`.
