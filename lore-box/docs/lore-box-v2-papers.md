# loreBOX v2 · Papers, Please footing

**Date:** 2026-08-02  
**Gen:** DBS-002-LOREBOX  
**Supersedes:** JSON bag loreBOX (v1 archive)

## Decision

1. **v1 archived** at `lore-box-v1-archive/` — content left in place, not imported.  
2. **v2 empty** — new papers only.  
3. Store law from Hands letter *ATTN datBox · PAPERS, PLEASE*.  
4. No MySQL graduation path. No Jason forklift bags.

## On disk

```
safe_box/
  {auth}/                 # store.auth
    {deck_id}/
      INSPECT.deck        # deck paper
      lore_xxxx.chip      # chip papers
```

## API surface (desk)

| Method | Path | Job |
|--------|------|-----|
| GET | `/api/tree` | auths → decks → chips |
| GET | `/api/deck?auth=&deck=` | open deck |
| GET | `/api/chip?auth=&deck=&chip=` | open chip |
| POST | `/api/deck/create` | new deck paper |
| POST | `/api/chip/create` | new chip paper |
| POST | `/api/chip/save` | write chip |
| POST | `/api/export/store` | zip → `exports/*.store` |

## Not yet

- Zipper as true sealed bank (export zip is first fraud)
- Narrative drivers / program-y markdown
- Full datbox-core shelf drag for paper folders (can return later)

## Win condition

You can **go in the book and read the paper** — front matter fact card + body — without nested JSON terror zones.
