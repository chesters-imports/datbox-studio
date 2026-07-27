# Freeze · shotBOX · datbox-core · lore first

**Date:** 2026-07-26  
**House:** DATBOX Studio  

## Decision

1. ~~**shotBOX is frozen**~~ → **UNFROZEN (2026-07)** — online for production; full core port still optional.  
2. **`datbox-core`** owns shelf + physical-folder vault plumbing · **v1 locked**.  
3. **loreBOX** is the reference ROM on core · **locked**.  
4. **promptBOX** shipped on core (port 43002) — prompt + notes cards.  
5. Later producers (memBOX, dreamBOX, deeper shot core port) **import core** — no spiral of N copy-pastes.

## Shelf paper name

`_{rom_slug}.datshelf` e.g. `_lorebox.datshelf`  

- Leading `_` → top of dir when browsing papers in VS Code  
- Not `.datshelf` only as a bare name — rom id is explicit  
- Not `vault` — too easy to want a deck named Vault  
- Extension `.datshelf` — not a bag (`.lorebox` / `.shotbox`)

## Tickets carried by core (lore first)

- **DB1** — manual sort of safe box list (drag order in `.datshelf`)  
- **DB2** — physical folders for place (e.g. `company/`)

## Greenlight

Hands: full agree · Agent: implement core + lore only.

## Desk dialogs (core UI law)

No `window.confirm` / `alert` / `prompt` in DATBOX ROMs.  
Shared module: `datbox-core/js/desk_dialog.js` + `css/desk_dialog.css`  
API: `DatboxDesk.confirm` · `alert` · `form`  
Served at `/datbox-core/*` from each ROM desk server.
