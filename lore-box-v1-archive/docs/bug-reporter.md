**BUG REPORT A   REPORTING AS: DANIEL WAKE   2026-07-24**:16:38

A1. LAYOUT ISSUE: Second row data (Box name, Stem) is LOADED DATMAT specific, yet the rail appears above the side-bar for loading/managing the files. Safebox should extend all the way to the title/brand bar. Box name / Stem should be first row of context frame for the selected DATBOX.

A2. If you empty all of your safe_box, the box name of your last removed matdat file remains inside the Box Name and Stem boxes, without the ability to remove them.

A3. Same issue as A2, but related to the DAT CARD related tooling.

SUGGESTION SOLUTION TO A2/A3 - When no DATBOX file exists/is "selected/loaded" from the list, the content pane should be empty, suggesting to select a new lore DATBOX on the side rail. Only show the tool content when we actually have something in the tool box to work on.

A4. CONSIDER LAYOUT OPTION: Observe how the LOAD menu is on the top of the design, but they are SAFE BOX tools ("new box", "rename box", "save card"). These should be relocated to simple, clean buttons/links at the bottom of the safe box.

A5. Design still designed the whole product as if it is the concept of the tool floating on the grid, ie Grid was placed and rounded corners were added to a "box in the box" - however, if this will be placed in a pocket window, there is no need at all for the tool to be in a rounded edge container on a faux grid. The rounded corners come from being inside the pocket window controller. The product should assume edge to edge of itself, not concept of floating in a program.

---

**WIRE ACK · A1–A5** · ORIEL-WIRE · patched in `prod/box_sys/`  
Hard refresh the desk (Ctrl+F5) after `python server.py`.

| ID | Fix |
|----|-----|
| A1 | Safe box rail full height under brand bar; Box name / Stem only in **context strip** of loaded DATBOX |
| A2/A3 | No box selected → main pane empty prompt; fields cleared on delete / empty vault |
| A4 | New / Rename / Delete box at **foot of safe box rail**; Save card on dat card head |
| A5 | Edge-to-edge `#app`; no faux grid, no floating rounded outer shell |

---

**BUG REPORT B  REPORTING AS: DANIEL WAKE  2026-07-24
>[!important] CHANGED FILES
> WHEN CHECKING BUGS, USE CURRENT FILES. DW MADE ACTIVE FILE EDITS TO BOX_SYS FILES
> 
> note: Working/testing only with no loaded datboxes. Deeper bugs may surface later

| ID   | TIME  | ISSUE                                                                                                                                                                                                                                                                                                                | Fix                                                                                                                                                                      |
| ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1   |       | With no boxes loaded, the center console says the expected message, with a randomly floating additional New Deck text offset strangely. The extra new deck text may have originally been a plan for a button under the message, allowing the production of a datbox. I do like it for this, so lets use it that way. | **WIRE:** Empty main is a column: hint + real **New box** CTA under it (no stray float). Same action as dock `+`.                                                        |
| B2   |       | Rework "New box  Rename box  Delete box" to be simple buttons that split evenly but fill the width of the dock they are in. "+" for new, a settings dial for the rename, a red trash can for the delete. You can keep the unusable ones faded.                                                                       | **WIRE:** Dock is 3 equal columns full width: `+` · `⚙` · `🗑` (danger tint); disabled stay faded.                                                                       |
| B3   | 17:04 | Popup window for prompt to name your new deck is not themed for the deck. Can we style this?                                                                                                                                                                                                                         | **WIRE:** Native `prompt` cannot be styled. Replaced New box + Rename with desk modal (`loreBOX` chip, fields, Create/Rename). Stem auto-fills TYPE A while typing name. |
| B4   | 17:07 | Can this new modal be draggable around?                                                                                                                                                                                                                                                                              | **WIRE:** Drag by modal chrome bar; clamped to viewport; position resets next open.                                                                                      |
| B5   |       | Testers would like to be able to launch the product with a cute hosts name. Can it be masked with something like datbox.lorebox? (LOW PRIORITY)                                                                                                                                                                      | **WIRE:** `http://datbox.lorebox.localhost:42929/` (*.localhost → loopback, no hosts). `launch-desk.bat` opens it. Plain 127 still works.                                |
| B6   | 17:12 | Top rail on content with Box Name and stem displays looks like editable content windows. Redesign to look more like displays of the material if we cannot edit the name from here.                                                                                                                                   | **WIRE:** Context strip is label + text display (not inputs); note points to ⚙ rename.                                                                                   |
| B7   |       | Add relation button should be on screen but be used to OPEN the form to add a relation. The form should not be visible until the add relation button is clicked.                                                                                                                                                     | **WIRE:** **Add relation** reveals form; **Attach** / **Cancel**; form hidden by default.                                                                                |
| B8   |       | A subtle hr should be added between the main card content, and the relations adder                                                                                                                                                                                                                                   | **WIRE:** `.section-hr` between save row and relations.                                                                                                                  |
| B9   |       | Save Card button should be moved to right above the newly introduced hr (under the frag / gravity)                                                                                                                                                                                                                   | **WIRE:** Save under lore code / gravity, above hr.                                                                                                                      |
| B10  | 17:18 | Change layout of Lore Core / Gravity rows to be:<br><br>Lore Code:   {code}<br>Gravity: [ selector ]                                                                                                                                                                                                                 | **WIRE:** Stacked lines: `Lore code` + mono value; `Gravity` + selector.                                                                                                 |
| B9-2 |       | When in mobile style views, the safebox should close and need to be tapped/clicked to expand, prioritizing the content board                                                                                                                                                                                         | **WIRE:** ≤720px starts **rail collapsed**; ☰ expands.                                                                                                                   |
| B11  |       | ADD: A collapse/expand for the safe box pane.                                                                                                                                                                                                                                                                        | **WIRE:** ☰ in chrome + « on rail head.                                                                                                                                  |
| B12  |       | User now misses save button in the prior location. Please move back, but change look to slight green tint so it pops                                                                                                                                                                                                 | **WIRE:** Save back in dat card head; green tint `.btn-save-pop`.                                                                                                        |
| B13  |       | After creation, SAVE CARD button becomes EDIT CARD and the display is no longer shown as an editable form (but relations can still be added with the relations button)                                                                                                                                               | **WIRE:** After **Save** → view mode + **Edit card**; new card starts edit; open existing → view; relations always.                                                      |
| B14  |       | Hamburger menu return for the collapsing menu ruins the header chip. The toggle to open and close the safe box should be affixed to the rail, not the header itself in this design.                                                                                                                                  | **WIRE:** ☰ removed from header. Collapse « on rail head; collapsed shows rail-edge **»** tab.                                                                           |
| B15  |       | Refreshing closes entirely out of my open item, which likely won't matter in production, but is driving testers a little batty                                                                                                                                                                                       | **WIRE:** Was wiping storage on boot (rail init). Fixed: no persist until restore done; `localStorage`+session; same host required.                                      |
| B16  |       | Display - only when gravity is unset                                                                                                                                                                                                                                                                                 | **WIRE:** View gravity shows plain **unset** when 0 (not `0 · unset`).                                                                                                   |
| B17  |       | Display look of Gravity should at least display the same column width appearance as the lore code - imagine it is rows in a classic table.                                                                                                                                                                           | **WIRE:** Meta rows use shared label column grid (table-ish).                                                                                                            |
| B18  |       | DELETE CARD button should be moved to be a small trash button next to Edit Card                                                                                                                                                                                                                                      | **WIRE:** 🗑 icon next to Edit/Save in dat card head; cards foot removed. |
| B19  |       | NEW CARD button change to just + button                                                                                                                                                                                                                                                                              | **WIRE:** Cards head is **+** only. |
| B20  |       | Change Edit Card to just Edit                                                                                                                                                                                                                                                                                        | **WIRE:** label **Edit**. |
| B21  |       | Change Add relation to Connect Related Lore                                                                                                                                                                                                                                                                          | **WIRE:** **Connect Related Lore**. |
| B22  |       | Change RELATIONS to CONNECTIONS "no connections yet"                                                                                                                                                                                                                                                                 | **WIRE:** **Connections** / “No connections yet.” |

**WIRE ACK · B1–B2** · ORIEL-WIRE · uses current `box_sys` (Hands edits kept: chip/Inter). Hard refresh.

**WIRE ACK · B3** · themed `#dlg-overlay` · hard refresh · try **New box** / ⚙

**WIRE ACK · B4–B5** · drag chrome · cute host · hard refresh / restart server for printed URL

**WIRE ACK · B6–B10** · material meta · relations drawer · save above hr · hard refresh

**WIRE ACK · B9-2 / B11–B13** · collapsible rail · green Save · Edit/view card · hard refresh

**WIRE ACK · B14–B17** · rail-affixed toggle · session restore · gravity/table display · hard refresh

**WIRE RE-ACK · B15** · boot no longer wipes session before restore · hard refresh twice to verify

**WIRE ACK · B18–B22** · + / Edit / trash head · Connections copy · hard refresh

