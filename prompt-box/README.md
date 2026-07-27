```
=================================================
  promptBOX
  a DATBOX by DatBox Studio
=================================================
```

**promptBOX** holds **prompt decks** — simple card boxes for journal prompts, interview questions, scene starters, etc.

| Path | Role |
|------|------|
| `docs/` | Product paper (later) |
| `prod/box_sys/` | The ROM |
| `prod/safe_box/` | `*.promptbox` decks · folders · `_promptbox.datshelf` |
| `prod/box_sets/` | `desk_prefs.json` |

### Card shape

- **Prompt** — the question / prompt line (required to be useful)
- **Notes** — optional extra info, follow-ups, context

No gravity, no relation graph — just decks of prompts.

### Run

Double-click **`prod/run-promptBOX.bat`** (Deck Host + desk on port **43002**).

Or desk only:

```bat
cd prod\box_sys
python server.py
```

http://127.0.0.1:43002/

### Island

- Port **43002** (lore 42929 · shot 43001)
- Ext **`.promptbox`** / unit **`.prompt`**
- On **datbox-core** (shelf, dialogs, prefs schema)
