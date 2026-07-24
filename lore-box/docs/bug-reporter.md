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