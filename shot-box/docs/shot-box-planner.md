# Planner Doc for: "shotBOX"
V0.2 2026-07-24 · GAIA CHESTER_IMPORT_STATION x

### What is this?
**shotBOX** is a simple software by DATBOX Studio.

> [!info] PRODUCT REQUEST TICKET #430.S01
> Client wants a DATBOX for **SHOT** mats — the same *kind of card* as ICU **shotDesk** on myPI, re-homed as its own ROM.
>
> Not a new invention. **Port the shotDesk model** into house DATBOX form (safe_box, TYPE A boxes, Deck Host later).
>
> Load/save only under `shotBOX/safe_box/`. Specialized filetype (default proposal: `.shot`).
>
> Hands note: writing big tables inside callouts is hostile to human hands. Prefer plain lists and short sections below.

#Assigned-to-Wires **WIRE_SIGN_IN:** `ORIEL-WIRE · desk 3 · DatBox Studio`

---

## Source of truth (graveyard excavate)

myPI tool: `t/tools/shotDesk/` (Watchers scene cards · ICU).

Whisper there: *watchers · i see you*  
Hint: *production material · not AB evidence · not K’s desk*

UI shape there: **side list of cards** + **panel** (view script blocks + edit form + optional storyboard image).

Ledger kind: `shot_card` · tool: `shotDesk`

---

## Shot card fields (copy from shotDesk)

These are the real form fields from the desk. shotBOX should mean the same things.

**Store code** (`shot_code`)  
Bag pot · minted as `{STEM}-001.shot` · **not** rewritten when you rename the scene. API looks up the card by this.

**Scene code** (`scene_code`)  
Chosen production / scene id (e.g. **e60**). Free to edit. Face label in the list when set.

**Title**  
Display name of the shot.

Raw Prose
Optional. For use if the shot is not yet broken into its parts. `hands: Long goal: API the split from raw prose into collected card format`

**Shotslug / location**  
Screenplay slug energy — e.g. `INT. OPS ROOM — NIGHT` or where the cut lives.

**Visual**  
What the camera sees.

**Action**  
What bodies do.

**Dialogue**  
Lines · robotic VO · whispers.

**Transition**  
How we leave the beat (e.g. fade to stupid black).

**Amusement note**  
Why this forces main-character energy (production note, not “lore encyclopedia”).

**Tone/Motif tags**  
Free string / tags — e.g. `alert, wire-death, sweater-girl`.

**Storyboard image** (on old desk: attach)  
Optional still. v0.1 of shotBOX may ship text-only first; image path next bay unless Hands requires it day one.

`hands: NOT REQUIRED IMAGES ON FIRST SHIP`

On save, the old desk also builds a readable script body from the sections (SLUGLINE / VISUAL / ACTION / …). shotBOX should keep structured fields (not only one blob).

`hands: Confirmed. Goal is general shot constructor, not script writer. Each segment serves a different section of shot construction`

---

## Desk layout to mirror

**Left rail**  
- Brand chip (SHOTS / shotBOX)  
- Search  
- + shot  
- List of cards (title + slugline whisper)

**Main panel**  
- New → empty form  
- Open card → **view** of sections (Visual / Action / Dialogue / …) then **edit**  
- Optional storyboard image above or beside the card

Same emotional layout as shotDesk; house chrome can follow loreBOX Deck Host fusion later (chip = menu, window controls in header).

`hands: apply a color tone shift to the blue for the new brand without changing DATBOX general look`

---

## House packaging (DATBOX, not ledger)

- One **shot box** file per collection (TYPE A stem from box name → `{STEM}.shot` unless Hands renames).  
- Many **shot cards** inside.  
- Codes: propose `{STEM}-{###}.shot` or keep simple sequence — Hands pick.  
- **safe_box only.**  
- **box_sets** for any shared lists (tone presets later if wanted).  
- Not bound to terminal/icu place columns for v0.1 — the ROM *is* the place.

`hands: approved. shotBOXes can be used for episodes, shorts, etc, as individual boxes of shot options`

---

## Story pressure (Hands seed — not filed yet)

Poor Blasphemy who wants to do good.  
Void shops every morning before work and once before bed — **voided for safety**.  

That is a **shot card** (slugline + visual + action + dialogue + amusement), not a City law entry. loreBOX holds the caste; shotBOX holds the cut of her day.

`hands: Slightly. The example actually in the bag of the ICU shotBOX is more accurate`

EXAMPLE WRITING THAT MIGRATES TO SHOTBOX:
```
The alarm sounded. Bright red lights flashed in the small 150 square foot space. The room shakes violently. A woman in an oversized sweater leaps over a futuristic chair to land in front of a wide array of monitors with data readouts and flashing red text reading ALERT, intercut with strange symbols and occult geometry. 

"Fuck, fuck, fuck, not again!" the girl huffs. runs her finger across the data, enters text quickly into the myraid of keys around her. "no, no, no, no,". Anxiety rises.

"No! Fuck! What is this! This isn't like before!" She slides across the room to the other side, a wall of wires with pulsing lights through them. Half are already offline, more blink out by the minute. "no! NO."

She pulls on a thick, pulsing wire with a label on it. "Systematic Shut Down beginning.." The voice is robotic. Sharp. It begins cutting down.

The woman returns to the keyboards. She hangs her head. 
"I am so sorry," she whispers.

Fade to stupid black screen with title or some shit.
```
`hands: EXAMPLE above of "Raw Prose" style writing mentioned earlier`

---

## Wire stance

**Model = shotDesk.**  
**SKU = shotBOX ROM** on DatBox spine.  
No inventing a parallel field system.

### Hands — answer in free text (no tables required)

1. Confirm: fields above = v0.1 (image attach later OK)? [ hands: altered ]
2. File type name: `.shot` OK?  [ perfect ]
3. Clone loreBOX rail/card chrome and **replace fields** with shotDesk fields — yes?   [ clone and shift tone of blue to new color ]
4. First sample box name for the Blasphemy / Void shop work (optional)?  [ can use the shot from the ICU Terminal *prose example included above* ]

When you say go, wire freezes and builds the desk.

— ORIEL-WIRE · desk 3 · DatBox Studio

## [ we are a go -/dw ]

> [!tip] ORIEL-WIRE · PHASE A FREEZE · BUILD
>
> Hands go received. Model locked to **shotDesk** fields (not lore card).
>
> **v0.1 fields:** Shot code · Title · Raw prose · Shotslug · Visual · Action · Dialogue · Transition · Amusement · Tone/motif tags · Gravity · Connections. Images not required first ship.
>
> **File:** `.shot` · TYPE A boxes · safe_box only.
>
> **Desk:** clone loreBOX rail/chrome · amber/watcher tone · shot fields.
>
> **Launch:** `prod/run-shotBOX.bat` → The Deck Host (ROM stays on this island).
>
> Sample ICU prose / Blasphemy seeds can be filed by Hands in the bag.
>
> — ORIEL-WIRE · desk built
