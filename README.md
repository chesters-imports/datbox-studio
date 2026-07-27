```
=================================================
  DATBOX STUDIO
  data archive type boxes · pocket world apps
=================================================
```

**DatBox Studio** makes **DATBOX** software — box apps for the pocket world.

Products live in this house as their own bays.

| Bay | ROM |
|-----|-----|
| `datbox-core/` | **Library only** — shelf + bag plumbing (`_{rom}.datshelf`) · not a desk · **v1 locked** |
| `lore-box/` | **loreBOX** — LORE mats · reference ROM on core · **locked** |
| `shot-box/` | **shotBOX** — SHOT mats · **online** (desk launch; core port optional next) |
| `prompt-box/` | **promptBOX** — prompt decks (question + optional notes) · on core · port **43002** |

### House rule

Whatever store a DATBOX uses, **saves use a special house format**.  
These are **component builders** — worldbuilding chunks in specialized files, made to be **imported later** into other systems. Mats on the way — not the final OS.

### Shelf (all DATBOX ROMs)

- Physical folders under each ROM’s `safe_box/` for **place**
- Order paper: `_{rom}.datshelf` (e.g. `_lorebox.datshelf`) — not a bag
- See `datbox-core/README.md` and `docs/freeze-shot-core-lore.md`
