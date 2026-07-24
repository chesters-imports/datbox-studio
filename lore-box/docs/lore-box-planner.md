# Planner Doc for: "loreBOX"
V0.1 2026-07-24 GAIA CHESTER_IMPORT_STATION x
### What is this?
**loreBOX** is a simple software by DATBOX Studio. 

> [!info] PRODUCT REQUEST TICKET #429.B29
> Client *__field_null__* requested a DATBOX for LORE branded datmats.
>
> This DATBOX must be able to load and save specialized .lore DATBOX filetypes.
> 
> New DATBOX loreBOX files should request a **Lore Box Name**, convert the filename into slugcode format, and save the file the same filename as the slugcode.
> EXAMPLE SLUGCODE: loreBOX Name: `Rosewood 8`; slugcode: `RO8-ROSEWOOD.lore`
> 
> Store in the program folder all loreBOX save files loreBOX/safe_box/
> loreBOX loads from safe_box and saves to safe_box. [No free file saving locations]
> 
> DATBOX must be able to contain the following content in the DB:
> 1. HEADLINER  - A title for the LORE dat card.
> 2. SLUGLINE   - Micro version of the main lore. 
> 3. PRIME LORE - The full body block about the lore, with special markdown rules
> 4. LORE CORE  - *A slugcode for this piece of lore, AUTO-SET
> 5. RELATE TO  - The ability to affix lore to this lore.
> 
> Each unit of LORE should be recorded with a LORE-CODE. 
> EXAMPLE LORE-CODE: RO8-ROSEWOOD-001.frag

#Assigned-to-Wires **WIRE_SIGN_IN:** `ORIEL-WIRE Â· desk 3 Â· DatBox Studio`

> [!TIP] WORK PLANNER â€” ORIEL-WIRE Â· ticket #429.B29 Â· loreBOX v0.1
>
> **Read of the ticket.** Client `__field_null__` wants a DATBOX for **LORE-branded datmats**: one program, locked house save path, specialized `.lore` files, cards that relate. This is a clean first SKU for the Studio. We ship a **box app**; Pocket Windows / pocket-browser remains the launch shell when the house packages ROMs â€” loreBOX itself is the datmat desk inside the glass.
>
> ---
>
> ### 1. What loreBOX is (studio definition)
>
> | Face | Meaning |
> |------|---------|
> | **Product** | **loreBOX** â€” DATBOX Studio software for LORE datmats |
> | **File type** | `.lore` â€” specialized DATBOX save (one Lore Box per file) |
> | **House vault** | `loreBOX/safe_box/` only â€” load and save **here**, no free-roam paths |
> | **Unit of lore** | One card / row inside a `.lore` box, each with a **LORE-CODE** |
>
> ---
>
> ### 2. Naming & codes (from request â€” locked as target behavior)
>
> **Lore Box Name â†’ slugcode â†’ filename**
>
> | Step | Rule | Example |
> |------|------|---------|
> | Human name | Requested at new box | `Rosewood 8` |
> | Slugcode | Derived from name (house pattern) | `RO8-ROSEWOOD` |
> | Save file | Same as slugcode + `.lore` | `RO8-ROSEWOOD.lore` |
> | On disk | Always under `safe_box/` | `loreBOX/safe_box/RO8-ROSEWOOD.lore` |
>
> **LORE-CODE (per unit inside the box)**
>
> | Piece | Rule | Example |
> |-------|------|---------|
> | Pattern | `{BOX-SLUGCODE}-{###}.frag` | `RO8-ROSEWOOD-001.frag` |
> | `###` | Auto sequence inside that box | `001`, `002`, â€¦ |
> | LORE CORE field | **AUTO-SET** to this LORE-CODE | not hand-typed as identity |
>
> *Wire note:* exact slug algorithm (initials, digits, strip words) should match the Rosewood example; if the name is short or odd, we document edge cases in a small code table before first ship â€” not guess in the field.
>
> ---
>
> ### 3. Dat card fields (DB content inside one `.lore`)
>
> | # | Field | Role | Notes |
> |---|--------|------|--------|
> | 1 | **HEADLINER** | Title of the LORE dat card | Human face |
> | 2 | **SLUGLINE** | Micro version of the main lore | One breath |
> | 3 | **PRIME LORE** | Full body block | Special markdown rules (to be specified â€” see open Q) |
> | 4 | **LORE CORE** | Slugcode for this piece | **AUTO-SET** = LORE-CODE |
> | 5 | **RELATE TO** | Affix lore to this lore | Links to other LORE-CODEs in-box (and later: across boxes only if ticket expands) |
>
> ---
>
> ### 4. Program shape (how the box behaves)
>
> 1. **Open loreBOX** â†’ sees inventory of `.lore` files in `safe_box/` only.  
> 2. **New Lore Box** â†’ prompt **Lore Box Name** â†’ compute slugcode â†’ create `safe_box/{SLUGCODE}.lore` â†’ empty or with welcome card.  
> 3. **Open existing** â†’ load that `.lore` â†’ list LORE units by HEADLINER / LORE-CODE.  
> 4. **New unit** â†’ mint next LORE-CODE â†’ edit HEADLINER, SLUGLINE, PRIME LORE â†’ RELATE TO as affix list.  
> 5. **Save** â†’ write only to that file under `safe_box/`. No â€œSave Asâ€¦â€ to the wilderness.  
> 6. **Relate** â†’ pick other units (by LORE-CODE / headliner); store relations on the card.
>
> Runtime assumption for this ticket: **standalone app surface** ready to wrap in the pocket shell when Packaging bay calls. Internals may be a small local site or single-window desk â€” wire will match house ROM practice when Pocket Windows is ready; **behavior above does not wait on chrome**.
>
> ---
>
> ### 5. Work phases (recommended order)
>
> | Phase | Deliverable | Done when |
> |-------|-------------|-----------|
> | **A Â· Spec freeze** | Slugcode + LORE-CODE rules + markdown subset for PRIME LORE | Hands signs the examples |
> | **B Â· `.lore` format** | Documented on-disk shape (JSON or house pack) holding box meta + cards + relations | Can round-trip a sample Rosewood box by hand |
> | **C Â· safe_box I/O** | Create / list / load / save only under `loreBOX/safe_box/` | No path picker; folder auto-made if missing |
> | **D Â· Desk UI** | New box Â· open box Â· card list Â· edit five fields Â· relate Â· save | Client can file one real Lore Box without wire present |
> | **E Â· Package (later bay)** | Wrap as Pocket Windows / pocket-browser ROM for desktop icon | Separate ticket when shell is offered to devs |
>
> Ticket **#429.B29** is **Aâ€“D** first. **E** is house-aligned but not blocking the datmat desk.
>
> ---
>
> ### 6. Out of scope (unless client amends ticket)
>
> - Free filesystem save / cloud sync  
> - Full second brain / graph database product  
> - Replacing Chesterâ€™s Imports or myPI store  
> - Multi-user server  
> - Inventing a â€œLedgerâ€ being  
>
> ---
>
> ### 7. Open questions â€” Hands reply **65D.35A9** Â· wire lock below
>
> | # | Hands | Wire lock |
> |---|--------|-----------|
> | 1 | **House** markdown / mats â€” all DATBOX files must work in another import system later; **house filetype system** for DATBOX mats of various shapes | PRIME LORE uses **house dialect**, not a random web subset. Phase B defines a **DATBOX mat envelope** other boxes can share (`.lore` is one shape). |
> | 2 | **Typed** relation; default **"Relates to"**; typed override; options list in settings; show list on next add | Path: `loreBOX/box_sets/` (relation type catalog). Each RELATE stores target LORE-CODE + type string. |
> | 3 | **Cross-RELATE** across `.lore` files in `safe_box`; dropdown picks which boxâ€™s rows feed the relate screen | RELATE targets = any LORE-CODE under safe_box, not only current file. |
> | 4 | Rosewood-style is hard â€” **wire must offer options** | See **Â§7.4 menu** â€” Hands pick one (or hybrid). |
> | 5 | **Rename allowed** â€” file + codes on file; production tool; operator fixes mistakes | Rename Lore Box Name â†’ recompute slugcode â†’ rename `.lore` â†’ rewrite LORE CORE / LORE-CODEs / inbound RELATE pointers in safe_box. |
> | 6 | Operator may **hard delete** | Hard delete cards and boxes; confirm gate in UI; no soft-retire required for v0.1. |
>
> **ADD from Hands:** Consider **GRAVITY / WEIGHT** for importance of a LORE datmat â€” see **Â§9**.
>
> ---
>
> ### 7.4 Slugcode law â€” options for Hands (pick one)
>
> Example target: name `Rosewood 8` â†’ something like `RO8-ROSEWOOD` + `.lore`
>
> | Option | Pattern | `Rosewood 8` â†’ | Pros | Cons |
> |--------|---------|----------------|------|------|
> | **A Â· Initial + digits + word** | First letters of leading word(s) + trailing number + `-` + main word uppercased | `R8-ROSEWOOD` or `RO8-ROSEWOOD` if 2-letter stem | Close to ticket example; readable | Ambiguous on multi-word names |
> | **B Â· Fixed stem width** | 2â€“3 letter stem from name start + digits found + `-` + longest word | `RO8-ROSEWOOD` | Stable width; good for LORE-CODE prefix | Stem rules need a tiny table |
> | **C Â· Full slug token** | Uppercase, non-alnum â†’ strip, spaces â†’ `-`, number kept | `ROSEWOOD-8` | Dead simple; easy rename | Farther from `RO8-ROSEWOOD` poetry |
> | **D Â· Manual slugcode** | Operator types slugcode; name is display only; validate unique in safe_box | whatever operator sets | Zero wrong guesses; production control | Extra step every new box |
> | **E Â· Hybrid (wire recommend)** | **Suggest** Option B from name; operator may **edit slugcode before first save**; later rename still allowed (Â§7.5) | default `RO8-ROSEWOOD`, editable | Matches ticket *and* mistake-control | One confirm field on New Box |
>
> **Hands pick (877.33DG): TYPE A** â€” see Â§12 freeze. (Wire had leaned E; Hands override stands.)
>
> ---
>
> ### 8. Wire stance
>
> Phase **A FROZEN** on reply **877.33DG**. Phase B next when Hands says cut sample mats.
>
> â€” ORIEL-WIRE Â· DatBox Studio

> [!success] NEAR FINAL HANDS
>  **Â§7** ANSWERS FOR AGENT ORIEL-WIRE - REPLY 65D.35A9
>  
>  THANK YOU ORIEL-WIRE. <3
>  
>  1. House. Intention is all DATBOX files will work in another import system later. HOUSE filetype system for DATBOX mats of various shapes must be formed.
>  2. Typed relationship. Provided standard "Relates to", allow typed over-ride, store override in the loreBOX settings as list of options, print in the list at next add (loreBOX/box_sets/)
>  3. Should allow cross-RELATE between loreBOX lore files inside the safe_box. Drop down on top to select which rows of datmats you are picking from on the relate screen.
>  4. Yes, this is a challenging way. Can you provide us with a few options to select from for this system?
>  5. Allowed - allows rename of file/codes on file. These are production level tools, DATBOX client __*field_null*__ is seeking the ability to control mistakes - renaming codes by renaming datmat file title would be beneficial to the operator.
>  6. Option: Operator may hard delete.
>
>ADD: Consider, does operator need a "GRAVITY/WEIGHT" to measure the importance of a LORE datmat?

> [!TIP] ORIEL-WIRE Â· ACK 65D.35A9 Â· GRAVITY + NEXT
>
> Hands â€” thank you. Locks for 1â€“3, 5â€“6 are on the board above. Â§7.4 options **Aâ€“E** await your pick (wire leans **E**).
>
> ### 9. GRAVITY / WEIGHT (Hands ADD)
>
> **Yes â€” useful on a LORE datmat**, if it stays light.
>
> | Idea | Proposal |
> |------|----------|
> | **Name** | **GRAVITY** (house word; weight of the lore in the box) |
> | **Where** | Optional field on each LORE unit (card), not on the whole `.lore` unless you want both later |
> | **Scale** | Integer **1â€“5** (or 0 = unset). Default **unset / 0** so empty cards arenâ€™t â€œimportantâ€ by accident |
> | **Use** | Sort / filter in desk list; later import systems can read the same field on the mat envelope |
> | **Not** | Not a second graph; not charlieTHREADS; just operator importance |
>
> **Hands (877.33DG): THIN SHIP GRAVITY** â€” v0.1 field; default **0 / unset**; weight **1â€“5**.
>
> ### 10. House paths â€” CONFIRMED WORKING
>
> | Path | Role |
> |------|------|
> | `loreBOX/safe_box/` | All `.lore` saves |
> | `loreBOX/box_sets/` | Relation type list (default includes **Relates to**; operator adds overrides) |
>
> ### 11. Status â€” PHASE A FROZEN
>
> | Item | State |
> |------|--------|
> | Ticket fields + safe_box | **FROZEN** |
> | Typed + cross RELATE + settings path | **FROZEN** |
> | Rename + hard delete | **FROZEN** |
> | House mat / PRIME LORE dialect | Intent frozen; envelope in Phase B |
> | Supercode law | **TYPE A** Â· **FROZEN** (Â§12) |
> | GRAVITY | **FROZEN** Â· thin ship Â· 0 default Â· 1â€“5 |

> [!success] CLOSING NOTES FROM HANDS
>  CONFIRMATION DECK FOR ORIEL-WIRE - REPLY 877.33DG
>  
>  THIN SHIP GRAVITY. 0/UNSET FOR DEFAULT, 1-5 WEIGHT.
>  CONFIRMED PATH WORKING.
>  WIRE THE CODE AS TYPE {A}: NOTE, USE FIRST CHARACTER OF EACH WORD, IE:
> 	 KITTEN CARNIVAL 10 -> KC1-
> 	 PANCAKE 3583 BUTTER -> P3B-
> 	 PANDA -> P-
> BATMAN SAYS READY FOR THE FREEZE.
> 
> HANDS: DANIEL WAKE

> [!tip] ORIEL-WIRE Â· PHASE A FREEZE Â· ACK 877.33DG
>
> Hands Daniel Wake â€” freeze accepted. Batman may stand down.
>
> ### 12. PHASE A â€” FROZEN SPEC (v0.1)
>
> #### Product
> **loreBOX** by **DATBOX Studio** â€” LORE-branded datmats; house mat system (shared later with other DATBOX shapes).
>
> #### Vault
> - Load/save **only** `loreBOX/safe_box/`
> - Settings: `loreBOX/box_sets/` (relation types; default **Relates to**; operator may add)
>
> #### Slugcode Â· TYPE A (Hands)
> **Rule:** For each whitespace-separated word in the Lore Box Name, take the **first character** (letters uppercased; if the word is numeric, first digit). Concatenate. Stem often shown with trailing `-` before seq.
>
> | Lore Box Name | Stem (TYPE A) |
> |---------------|----------------|
> | KITTEN CARNIVAL 10 | `KC1` Â· `KC1-` |
> | PANCAKE 3583 BUTTER | `P3B` Â· `P3B-` |
> | PANDA | `P` Â· `P-` |
> | Rosewood 8 | `R8` Â· `R8-` |
>
> - **Save file:** `{STEM}.lore` in safe_box (e.g. `KC1.lore`).  
> - **LORE-CODE:** `{STEM}-{###}.frag` (e.g. `KC1-001.frag`).  
> - **LORE CORE:** AUTO-SET to LORE-CODE.  
> - **Rename** later allowed (recompute/rewrite codes + file + RELATE pointers in safe_box).  
> - **Unique:** stem must not collide in safe_box.
>
> #### Dat card fields (v0.1)
>
> | # | Field | Rule |
> |---|--------|------|
> | 1 | HEADLINER | Title |
> | 2 | SLUGLINE | Micro lore |
> | 3 | PRIME LORE | Full body Â· **house** markdown (Phase B dialect table) |
> | 4 | LORE CORE | AUTO-SET LORE-CODE |
> | 5 | RELATE TO | Typed; default â€œRelates toâ€; cross-box in safe_box; source box dropdown |
> | 6 | GRAVITY | **0 / unset** default; **1â€“5** weight; thin ship |
>
> #### Operator power
> - Rename Lore Box (file + codes on file)  
> - Hard delete (confirm gate)  
> - No free path save  
>
> #### Phases
> | Phase | State |
> |-------|--------|
> | **A Â· Spec freeze** | **DONE** Â· 877.33DG |
> | **B Â· `.lore` + house mat envelope + box_sets shape** | Ready on go |
> | **C Â· safe_box I/O** | Queued |
> | **D Â· Desk UI** | Queued |
> | **E Â· Pocket Windows package** | Later bay |
>
> Wire stands by for Phase B sample cut when you say go â€” or Pocket Windows talk whenever Hands leave the freeze party.
>
> â€” ORIEL-WIRE Â· desk 3 Â· DatBox Studio Â· GAIA CHESTER_IMPORT_STATION x  
> **PHASE A FROZEN** Â· ticket #429.B29 Â· loreBOX v0.1
