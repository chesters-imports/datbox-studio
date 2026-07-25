/* loreBOX first pass — desk logic */

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  boxes: [],
  catalog: [],
  relationTypes: ["Relates to"],
  box: null,
  card: null,
  dirty: false,
  cardMode: "edit", // "edit" | "view" (B13)
  railCollapsed: false,
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText;
    throw new Error(msg);
  }
  return data;
}

function setStatus(msg, isErr = false) {
  const el = $("#status");
  el.textContent = msg || "";
  el.classList.toggle("err", !!isErr);
}

function markDirty(v = true) {
  state.dirty = v;
  updateCardModeButtons();
}

function setCardMode(mode) {
  state.cardMode = mode === "view" ? "view" : "edit";
  const edit = $("#card-edit");
  const view = $("#card-view");
  if (edit) edit.hidden = state.cardMode !== "edit";
  if (view) view.hidden = state.cardMode !== "view";
  updateCardModeButtons();
  if (state.cardMode === "view") fillCardView();
  persistSession();
}

function updateCardModeButtons() {
  const save = $("#btn-save");
  const editBtn = $("#btn-edit-card");
  const del = $("#btn-del-card");
  const hasCard = !!(state.box && state.card);
  if (save) {
    const showSave = hasCard && state.cardMode === "edit";
    save.hidden = !showSave;
    save.disabled = !showSave || !state.dirty;
  }
  if (editBtn) {
    editBtn.hidden = !(hasCard && state.cardMode === "view");
  }
  // B18: trash sits with Edit in view mode (and available while editing too)
  if (del) {
    del.hidden = !hasCard;
    del.disabled = !hasCard;
  }
}

function fillTpsNick() {
  const chip = (state.card && state.card.tps_chip) || "";
  const exp = (state.card && state.card.tps_export) || "";
  const label = chip
    ? exp && exp !== chip
      ? `${chip}`
      : chip
    : "";
  const title = chip
    ? `Time Machina · ${chip}${exp ? " · " + exp : ""}`
    : "";
  for (const [lineId, valId] of [
    ["f-tps-line", "f-tps"],
    ["v-tps-line", "v-tps"],
  ]) {
    const line = document.getElementById(lineId);
    const val = document.getElementById(valId);
    if (!line || !val) continue;
    if (label) {
      line.hidden = false;
      val.textContent = label;
      val.title = title;
    } else {
      line.hidden = true;
      val.textContent = "—";
      val.title = "";
    }
  }
}

function fillCardView() {
  if (!state.card) return;
  const g = Number(state.card.gravity ?? 0);
  $("#v-headliner").textContent = state.card.headliner || "(no headliner)";
  $("#v-slugline").textContent = state.card.slugline || "—";
  $("#v-prime").textContent = state.card.prime_lore || "—";
  $("#v-core").textContent = state.card.lore_core || state.card.lore_code || "—";
  // B16: plain "unset" only when gravity is 0
  $("#v-gravity").textContent = g === 0 ? "unset" : String(g);
  fillTpsNick();
}

/** Apply rail chrome without touching storage (boot-safe). */
function applyRailDom() {
  const app = $("#app");
  if (app) app.classList.toggle("rail-collapsed", state.railCollapsed);
  const openTab = $("#btn-rail-open");
  if (openTab) {
    openTab.hidden = !state.railCollapsed;
    openTab.setAttribute(
      "aria-expanded",
      state.railCollapsed ? "false" : "true"
    );
  }
}

function setRailCollapsed(collapsed) {
  state.railCollapsed = !!collapsed;
  applyRailDom();
  persistSession();
}

function toggleRail() {
  setRailCollapsed(!state.railCollapsed);
}

/* B15: remember open box/card for tester refresh
   NOTE: storage is per-origin — use the same host each time
   (datbox.lorebox.localhost vs 127.0.0.1 are different keys). */
const SESSION_KEY = "lorebox-desk-session-v1";
let sessionReady = false; // false until boot finishes restore — avoids wiping on rail init

function persistSession() {
  if (!sessionReady) return;
  try {
    const payload = {
      stem: state.box ? state.box.stem : null,
      lore_code: state.card ? state.card.lore_code : null,
      cardMode: state.cardMode,
      railCollapsed: state.railCollapsed,
    };
    // localStorage survives refresh and is less surprising for testers
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* private mode etc. */
  }
}

function readSession() {
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function restoreSession() {
  const s = readSession();
  if (!s || !s.stem) return false;
  try {
    const data = await api(`/api/box/${encodeURIComponent(s.stem)}`);
    state.box = data;
    if (s.lore_code) {
      state.card =
        (data.cards || []).find((c) => c.lore_code === s.lore_code) || null;
    } else {
      state.card = null;
    }
    state.dirty = false;
    if (state.card) {
      state.cardMode = s.cardMode === "edit" ? "edit" : "view";
    }
    if (typeof s.railCollapsed === "boolean") {
      state.railCollapsed = s.railCollapsed;
      applyRailDom();
    }
    setStatus(`Restored ${data.stem}.lore`);
    return true;
  } catch (e) {
    setStatus("Could not restore last box (missing?)", true);
    return false;
  }
}

/** A2/A3: clear loaded context when nothing is selected */
function clearSelection(opts = {}) {
  const { keepDirtyCheck = false } = opts;
  if (keepDirtyCheck && state.dirty) {
    if (!confirm("Discard unsaved card edits?")) return false;
  }
  state.box = null;
  state.card = null;
  state.dirty = false;
  clearEditorFields();
  clearContextFields();
  return true;
}

function clearContextFields() {
  const name = $("#meta-box-name");
  const stem = $("#meta-stem");
  if (name) name.textContent = "—";
  if (stem) stem.textContent = "—";
  const chrome = $("#chrome-meta");
  if (chrome) chrome.textContent = "DATBOX Studio - no BOX loaded";
}

function clearEditorFields() {
  const ids = ["f-headliner", "f-slugline", "f-prime"];
  for (const id of ids) {
    const el = $(`#${id}`);
    if (el) el.value = "";
  }
  const g = $("#f-gravity");
  if (g) g.value = "0";
  const core = $("#f-core");
  if (core) core.textContent = "—";
  const relList = $("#rel-list");
  if (relList) relList.innerHTML = "";
  hideRelForm();
}

/* ---------- load ---------- */

async function refreshBoxes() {
  const data = await api("/api/boxes");
  state.boxes = data.boxes || [];

  // If current box vanished (deleted / empty vault), drop selection
  if (state.box) {
    const still = state.boxes.some((b) => b.stem === state.box.stem);
    if (!still) {
      state.box = null;
      state.card = null;
      state.dirty = false;
      clearEditorFields();
      clearContextFields();
    }
  }

  renderBoxList();
  renderMainPane();
}

async function refreshCatalog() {
  const data = await api("/api/catalog");
  state.catalog = data.cards || [];
}

async function refreshRelationTypes() {
  const data = await api("/api/settings/relation_types");
  state.relationTypes = data.types || ["Relates to"];
  fillRelationTypeSelect();
}

async function openBox(stem) {
  if (state.dirty && state.box) {
    if (!confirm("Discard unsaved card edits?")) return;
  }
  const data = await api(`/api/box/${encodeURIComponent(stem)}`);
  state.box = data;
  state.card = null; // require explicit card pick / new (clearer empty card tooling)
  markDirty(false);
  clearEditorFields();
  renderAll();
  persistSession();
  setStatus(`Opened ${data.stem}.lore · ${data.box_name}`);
}

/* ---------- render ---------- */

function renderMainPane() {
  const empty = $("#main-empty");
  const loaded = $("#main-loaded");
  const hasBox = !!state.box;

  if (empty) empty.hidden = hasBox;
  if (loaded) loaded.hidden = !hasBox;

  $("#btn-rename").disabled = !hasBox;
  $("#btn-del-box").disabled = !hasBox;

  if (!hasBox) {
    clearContextFields();
    clearEditorFields();
    const cardList = $("#card-list");
    if (cardList) {
      cardList.innerHTML = "";
    }
    return;
  }

  $("#meta-box-name").textContent = state.box.box_name || "—";
  $("#meta-stem").textContent = state.box.stem || "—";
  $("#chrome-meta").textContent = `DATBOX Loaded [ ${state.box.stem}.lore | ${state.box.box_name} ]`;
}

function renderBoxList() {
  const body = $("#box-list");
  body.innerHTML = "";
  if (!state.boxes.length) {
    body.innerHTML =
      '<div class="empty-hint">No lore boxes in safe_box yet.<br>New box to cut a stem.</div>';
    return;
  }
  for (const b of state.boxes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "list-item" + (state.box && state.box.stem === b.stem ? " active" : "");
    btn.innerHTML = `<span>${escapeHtml(b.box_name)}</span>
      <span class="sub">${escapeHtml(b.stem)}.lore · ${b.card_count} card(s)</span>`;
    btn.addEventListener("click", () => openBox(b.stem));
    body.appendChild(btn);
  }
}

function renderCardList() {
  const body = $("#card-list");
  if (!body) return;
  body.innerHTML = "";
  if (!state.box) return;

  const cards = state.box.cards || [];
  if (!cards.length) {
    body.innerHTML =
      '<div class="empty-hint">No lore units yet.<br>New card mints a LORE-CODE.</div>';
    return;
  }
  for (const c of cards) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "list-item" +
      (state.card && state.card.lore_code === c.lore_code ? " active" : "");
    const g = c.gravity > 0 ? ` · g${c.gravity}` : "";
    btn.innerHTML = `<span>${escapeHtml(c.headliner || "(no headliner)")}</span>
      <span class="sub">${escapeHtml(c.lore_code || "")}${g}</span>`;
    btn.addEventListener("click", () => {
      if (state.dirty && state.cardMode === "edit" && !confirm("Discard unsaved edits on this card?"))
        return;
      state.card = c;
      markDirty(false);
      setCardMode("view"); // existing cards open as display
      renderCardList();
      renderEditor();
      persistSession();
    });
    body.appendChild(btn);
  }
}

function renderEditor() {
  const ed = $("#editor");
  const empty = $("#editor-empty");
  if (!ed || !empty) return;

  if (!state.box || !state.card) {
    ed.hidden = true;
    empty.hidden = false;
    clearEditorFields();
    updateCardModeButtons();
    return;
  }
  empty.hidden = true;
  ed.hidden = false;

  $("#f-headliner").value = state.card.headliner || "";
  $("#f-slugline").value = state.card.slugline || "";
  $("#f-prime").value = state.card.prime_lore || "";
  $("#f-core").textContent = state.card.lore_core || state.card.lore_code || "—";
  $("#f-gravity").value = String(state.card.gravity ?? 0);
  fillTpsNick();
  fillCardView();
  setCardMode(state.cardMode);

  hideRelForm();
  renderRelates();
  updateCardModeButtons();
}

function hideRelForm() {
  const form = $("#rel-form");
  if (form) form.hidden = true;
}

function showRelForm() {
  const form = $("#rel-form");
  if (!form) return;
  form.hidden = false;
  fillRelateBoxSelect();
}

function fillRelationTypeSelect() {
  const sel = $("#rel-type");
  if (!sel) return;
  sel.innerHTML = "";
  for (const t of state.relationTypes) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    sel.appendChild(o);
  }
}

function fillRelateBoxSelect() {
  const sel = $("#rel-box");
  if (!sel) return;
  sel.innerHTML = "";
  const stems = [...new Set(state.catalog.map((c) => c.box_stem))];
  for (const stem of stems) {
    const row = state.catalog.find((c) => c.box_stem === stem);
    const o = document.createElement("option");
    o.value = stem;
    o.textContent = row ? `${row.box_name} (${stem})` : stem;
    sel.appendChild(o);
  }
  fillRelateCardSelect();
}

function fillRelateCardSelect() {
  const boxSel = $("#rel-box");
  const sel = $("#rel-card");
  if (!boxSel || !sel) return;
  const stem = boxSel.value;
  sel.innerHTML = "";
  const cards = state.catalog.filter((c) => c.box_stem === stem);
  for (const c of cards) {
    if (state.card && c.lore_code === state.card.lore_code) continue;
    const o = document.createElement("option");
    o.value = c.lore_code;
    o.textContent = `${c.headliner || "(untitled)"} · ${c.lore_code}`;
    sel.appendChild(o);
  }
}

function renderRelates() {
  fillRelateBoxSelect();
  const list = $("#rel-list");
  if (!list) return;
  list.innerHTML = "";
  const rels = (state.card && state.card.relates) || [];
  if (!rels.length) {
    list.innerHTML =
      '<div class="empty-hint" style="padding:6px 0">No connections yet.</div>';
    return;
  }
  for (let i = 0; i < rels.length; i++) {
    const r = rels[i];
    const div = document.createElement("div");
    div.className = "relate-chip";
    div.innerHTML = `<span><strong>${escapeHtml(r.type || "Relates to")}</strong> → ${escapeHtml(r.to || "")}</span>`;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn linkish";
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      state.card.relates.splice(i, 1);
      markDirty(true);
      renderRelates();
    });
    div.appendChild(rm);
    list.appendChild(div);
  }
}

function renderAll() {
  renderBoxList();
  renderMainPane();
  if (state.box) {
    renderCardList();
    renderEditor();
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- actions ---------- */

function readEditorIntoCard() {
  if (!state.card) return;
  state.card.headliner = $("#f-headliner").value;
  state.card.slugline = $("#f-slugline").value;
  state.card.prime_lore = $("#f-prime").value;
  state.card.gravity = parseInt($("#f-gravity").value, 10) || 0;
  state.card.lore_core = state.card.lore_code;
}

async function saveCard() {
  if (!state.box || !state.card) return;
  readEditorIntoCard();
  const code = state.card.lore_code;
  const data = await api(
    `/api/box/${encodeURIComponent(state.box.stem)}/card/${encodeURIComponent(code)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        headliner: state.card.headliner,
        slugline: state.card.slugline,
        prime_lore: state.card.prime_lore,
        gravity: state.card.gravity,
        relates: state.card.relates || [],
        // only re-assert nick when present (empty string used to erase it)
        ...(state.card.tps_chip ? { tps_chip: state.card.tps_chip } : {}),
        ...(state.card.tps_export ? { tps_export: state.card.tps_export } : {}),
      }),
    }
  );
  state.box = data.box;
  // Preserve nick if server response omitted it
  const keptChip = state.card.tps_chip;
  const keptExp = state.card.tps_export;
  state.card = data.card;
  if (keptChip && !state.card.tps_chip) state.card.tps_chip = keptChip;
  if (keptExp && !state.card.tps_export) state.card.tps_export = keptExp;
  markDirty(false);
  setCardMode("view");
  await refreshBoxes();
  await refreshCatalog();
  renderAll();
  persistSession();
  setStatus(`Saved ${code}`);
}

/** B4: drag dialog by chrome */
function enableDialogDrag(dlg) {
  const handle = dlg.querySelector(".dlg-chrome");
  if (!handle) return () => {};
  let ox = 0;
  let oy = 0;
  let dragging = false;

  function onDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest("button, input, a")) return;
    dragging = true;
    const rect = dlg.getBoundingClientRect();
    // switch from centered flex child to fixed coords
    dlg.style.position = "fixed";
    dlg.style.margin = "0";
    dlg.style.left = `${rect.left}px`;
    dlg.style.top = `${rect.top}px`;
    dlg.style.right = "auto";
    dlg.style.transform = "none";
    ox = e.clientX - rect.left;
    oy = e.clientY - rect.top;
    handle.classList.add("dragging");
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    const w = dlg.offsetWidth;
    const h = dlg.offsetHeight;
    let x = e.clientX - ox;
    let y = e.clientY - oy;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    dlg.style.left = `${x}px`;
    dlg.style.top = `${y}px`;
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
  }
  handle.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  return () => {
    handle.removeEventListener("mousedown", onDown);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    handle.classList.remove("dragging");
  };
}

/** B3: themed modal — returns {ok, values} or {ok:false} */
function openDialog({ title, okLabel = "OK", fields, onMount }) {
  return new Promise((resolve) => {
    const overlay = $("#dlg-overlay");
    const dlg = overlay.querySelector(".dlg");
    const body = $("#dlg-body");
    const titleEl = $("#dlg-title");
    const btnOk = $("#dlg-ok");
    const btnCancel = $("#dlg-cancel");
    titleEl.textContent = title;
    btnOk.textContent = okLabel;
    body.innerHTML = "";

    // reset position (centered via CSS) each open
    dlg.style.position = "";
    dlg.style.left = "";
    dlg.style.top = "";
    dlg.style.right = "";
    dlg.style.margin = "";
    dlg.style.transform = "";

    const inputs = {};
    for (const f of fields) {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const lab = document.createElement("span");
      lab.textContent = f.label;
      const input = document.createElement("input");
      input.type = f.type || "text";
      input.id = `dlg-f-${f.name}`;
      input.value = f.value || "";
      input.autocomplete = "off";
      if (f.readonly) input.readOnly = true;
      wrap.appendChild(lab);
      wrap.appendChild(input);
      if (f.hint) {
        const h = document.createElement("p");
        h.className = "dlg-hint";
        h.textContent = f.hint;
        wrap.appendChild(h);
      }
      body.appendChild(wrap);
      inputs[f.name] = input;
    }

    const stopDrag = enableDialogDrag(dlg);

    function cleanup(result) {
      stopDrag();
      overlay.hidden = true;
      btnOk.onclick = null;
      btnCancel.onclick = null;
      overlay.onkeydown = null;
      resolve(result);
    }

    btnCancel.onclick = () => cleanup({ ok: false });
    btnOk.onclick = () => {
      const values = {};
      for (const f of fields) {
        values[f.name] = inputs[f.name].value;
      }
      cleanup({ ok: true, values, inputs });
    };
    overlay.onkeydown = (e) => {
      if (e.key === "Escape") cleanup({ ok: false });
      if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        btnOk.click();
      }
    };

    overlay.hidden = false;
    if (onMount) onMount(inputs);
    const first = fields.find((f) => !f.readonly);
    if (first) inputs[first.name].focus();
  });
}

async function newBox() {
  const dlg = await openDialog({
    title: "New lore box",
    okLabel: "Create",
    fields: [
      {
        name: "box_name",
        label: "Lore box name",
        value: "",
        hint: "Display name for this DATBOX.",
      },
      {
        name: "stem",
        label: "Stem (TYPE A)",
        value: "",
        hint: "Auto from name — edit if needed. File will be {STEM}.lore",
      },
    ],
    onMount(inputs) {
      let t = null;
      const syncStem = () => {
        clearTimeout(t);
        t = setTimeout(async () => {
          const n = inputs.box_name.value.trim();
          if (!n) return;
          try {
            const s = await api(`/api/stem?name=${encodeURIComponent(n)}`);
            if (document.activeElement !== inputs.stem) {
              inputs.stem.value = s.stem;
            }
          } catch {
            /* ignore while typing */
          }
        }, 180);
      };
      inputs.box_name.addEventListener("input", syncStem);
    },
  });
  if (!dlg.ok) return;
  const name = (dlg.values.box_name || "").trim();
  let stem = (dlg.values.stem || "").trim();
  if (!name) {
    setStatus("Name required", true);
    return;
  }
  if (!stem) {
    try {
      stem = (await api(`/api/stem?name=${encodeURIComponent(name)}`)).stem;
    } catch (e) {
      setStatus(String(e.message || e), true);
      return;
    }
  }
  try {
    const data = await api("/api/boxes", {
      method: "POST",
      body: JSON.stringify({ box_name: name, stem }),
    });
    await refreshBoxes();
    await refreshCatalog();
    state.box = data;
    state.card = null;
    markDirty(false);
    clearEditorFields();
    renderAll();
    setStatus(`Created ${data.stem}.lore`);
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

/** Time Machina cord — peek + mat whisper. Offline = silent skip. */
const MACHINA_CORD =
  (window.MACHINA_CORD_URL || "http://127.0.0.1:43111").replace(/\/$/, "");

/** Peek current chip before mint so tps_chip can land on the card in one write. */
async function peekMachinaNow() {
  try {
    const nowRes = await fetch(`${MACHINA_CORD}/api/cord/now`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!nowRes.ok) return { ok: false, reason: "machina_http" };
    const now = await nowRes.json();
    if (!now.pocket_on) return { ok: false, reason: "pocket_off" };
    if (!now.current || !now.current.chip_id) {
      return { ok: false, reason: "no_chip" };
    }
    return {
      ok: true,
      chip_id: now.current.chip_id,
      export_id: now.export_id || "",
      now,
    };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

async function whisperMatToMachina(mat, stem, peeked) {
  try {
    let chip_id = peeked && peeked.chip_id;
    let export_id = peeked && peeked.export_id;
    if (!chip_id) {
      const peek = await peekMachinaNow();
      if (!peek.ok) return peek;
      chip_id = peek.chip_id;
      export_id = peek.export_id;
    }
    const post = await fetch(`${MACHINA_CORD}/api/cord/mat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        mat,
        stem: stem || "",
        unit_code: mat,
        rom: "loreBOX",
      }),
    });
    const body = await post.json().catch(() => ({}));
    if (!post.ok || body.ok === false) {
      return {
        ok: false,
        reason: (body && body.error) || "mat_refused",
        chip_id,
        export_id,
      };
    }
    return {
      ok: true,
      chip_id,
      export_id: export_id || "",
      mats: body.entry && body.entry.mats,
    };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

/** Unbind mat from history book when a card is hard-deleted. Soft-fail if offline. */
async function unwhisperMatFromMachina(card) {
  if (!card || !card.lore_code) return { ok: false, reason: "no_card" };
  try {
    const res = await fetch(`${MACHINA_CORD}/api/cord/mat/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        mat: card.lore_code,
        unit_code: card.lore_code,
        chip_id: card.tps_chip || "",
        export_id: card.tps_export || "",
        rom: "loreBOX",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) {
      return { ok: false, reason: (body && body.error) || "remove_failed" };
    }
    return { ok: true, count: body.count || 0, removed: body.removed || [] };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

async function newCard() {
  if (!state.box) return;
  if (state.dirty && !confirm("Discard unsaved edits?")) return;
  try {
    // 1) Peek Machina first so chip nick ships in the same create write as the card.
    const peek = await peekMachinaNow();
    const mintBody = {
      headliner: "",
      slugline: "",
      prime_lore: "",
      gravity: 0,
    };
    if (peek.ok) {
      mintBody.tps_chip = peek.chip_id;
      mintBody.tps_export = peek.export_id || "";
    }

    // 2) Create card (tps fields already on disk if peek ok).
    const data = await api(
      `/api/box/${encodeURIComponent(state.box.stem)}/card`,
      {
        method: "POST",
        body: JSON.stringify(mintBody),
      }
    );
    state.box = data.box;
    state.card = data.card;
    markDirty(true); // new empty card needs a first save
    setCardMode("edit");
    await refreshBoxes();
    await refreshCatalog();
    renderAll();
    fillTpsNick();

    // 3) Register mat on the book (uses current Machina cursor — same peek when possible).
    if (peek.ok) {
      const w = await whisperMatToMachina(
        data.card.lore_code,
        state.box.stem,
        peek
      );
      // Re-assert nick on card from peek (create already wrote it; keep UI + state tight)
      if (state.card) {
        state.card.tps_chip = peek.chip_id;
        state.card.tps_export = peek.export_id || "";
      }
      // Also patch box in-memory cards so list/catalog don't drop nick
      if (state.box && state.box.cards) {
        const row = state.box.cards.find(
          (c) => c.lore_code === data.card.lore_code
        );
        if (row) {
          row.tps_chip = peek.chip_id;
          row.tps_export = peek.export_id || "";
        }
      }
      fillTpsNick();
      renderEditor();
      if (w.ok) {
        setStatus(`Minted ${data.card.lore_code} · bound ${peek.chip_id}`);
      } else {
        setStatus(
          `Minted ${data.card.lore_code} · chip ${peek.chip_id} (book whisper: ${w.reason || "fail"})`
        );
      }
    } else if (peek.reason === "offline" || peek.reason === "machina_http") {
      setStatus(`Minted ${data.card.lore_code} · Machina offline`);
    } else if (peek.reason === "pocket_off") {
      setStatus(`Minted ${data.card.lore_code} · pocket off (unclocked)`);
    } else if (peek.reason === "no_chip") {
      setStatus(`Minted ${data.card.lore_code} · no current chip`);
    } else {
      setStatus(`Minted ${data.card.lore_code}`);
    }
    $("#f-headliner").focus();
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

async function deleteBox() {
  if (!state.box) return;
  if (!confirm(`Hard delete ${state.box.stem}.lore and all cards?`)) return;
  try {
    await api(`/api/box/${encodeURIComponent(state.box.stem)}`, {
      method: "DELETE",
    });
    state.box = null;
    state.card = null;
    state.dirty = false;
    clearEditorFields();
    clearContextFields();
    await refreshBoxes();
    await refreshCatalog();
    renderAll();
    setStatus("Box deleted — select or create a box");
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

async function deleteCard() {
  if (!state.box || !state.card) return;
  if (!confirm(`Hard delete ${state.card.lore_code}?`)) return;
  const doomed = { ...state.card };
  try {
    // Unbind from Time Machina book first (uses tps_chip / lore_code)
    const u = await unwhisperMatFromMachina(doomed);
    const data = await api(
      `/api/box/${encodeURIComponent(state.box.stem)}/card/${encodeURIComponent(state.card.lore_code)}`,
      { method: "DELETE" }
    );
    state.box = data;
    state.card = null;
    state.dirty = false;
    clearEditorFields();
    await refreshBoxes();
    await refreshCatalog();
    renderAll();
    if (u.ok && u.count > 0) {
      setStatus(`Card deleted · unbound ${u.count} mat row(s) from Machina`);
    } else if (u.reason === "offline") {
      setStatus("Card deleted · Machina offline (book may still list mat)");
    } else {
      setStatus("Card deleted");
    }
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

async function renameBox() {
  if (!state.box) return;
  const dlg = await openDialog({
    title: "Rename lore box",
    okLabel: "Rename",
    fields: [
      {
        name: "box_name",
        label: "Lore box name",
        value: state.box.box_name || "",
      },
      {
        name: "stem",
        label: "Stem",
        value: state.box.stem || "",
        hint: "Changing stem rewrites codes and the .lore filename.",
      },
    ],
  });
  if (!dlg.ok) return;
  const name = (dlg.values.box_name || "").trim();
  const stem = (dlg.values.stem || "").trim() || state.box.stem;
  if (!name) {
    setStatus("Name required", true);
    return;
  }
  try {
    const data = await api(`/api/box/${encodeURIComponent(state.box.stem)}`, {
      method: "PUT",
      body: JSON.stringify({ box_name: name, stem }),
    });
    state.box = data;
    state.card = null;
    markDirty(false);
    clearEditorFields();
    await refreshBoxes();
    await refreshCatalog();
    renderAll();
    setStatus(`Renamed → ${data.stem}.lore`);
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

function addRelation() {
  if (!state.card) return;
  const to = $("#rel-card").value;
  const type = $("#rel-type").value || "Relates to";
  if (!to) {
    setStatus("Pick a target card", true);
    return;
  }
  state.card.relates = state.card.relates || [];
  if (state.card.relates.some((r) => r.to === to && r.type === type)) {
    setStatus("Already related that way");
    return;
  }
  state.card.relates.push({ to, type });
  markDirty(true);
  hideRelForm();
  renderRelates();
  // view mode has no Save — persist relation immediately
  if (state.cardMode === "view") {
    saveCard().catch(err);
  } else {
    setStatus("Relation attached — Save card to keep");
  }
}

async function addRelationType() {
  const t = prompt("New relation type label?");
  if (!t || !t.trim()) return;
  const types = [...state.relationTypes];
  if (!types.includes(t.trim())) types.push(t.trim());
  try {
    const data = await api("/api/settings/relation_types", {
      method: "POST",
      body: JSON.stringify({ types }),
    });
    state.relationTypes = data.types;
    fillRelationTypeSelect();
    setStatus("Relation types updated (box_sets)");
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

/* ---------- bind ---------- */

function bind() {
  $("#btn-new-box").addEventListener("click", () => newBox().catch(err));
  const emptyNew = $("#btn-new-box-empty");
  if (emptyNew) emptyNew.addEventListener("click", () => newBox().catch(err));
  $("#btn-new-card").addEventListener("click", () => newCard().catch(err));
  $("#btn-save").addEventListener("click", () => saveCard().catch(err));
  $("#btn-del-box").addEventListener("click", () => deleteBox().catch(err));
  $("#btn-del-card").addEventListener("click", () => deleteCard().catch(err));
  $("#btn-rename").addEventListener("click", () => renameBox().catch(err));
  $("#btn-rel-open").addEventListener("click", () => showRelForm());
  $("#btn-rel-add").addEventListener("click", addRelation);
  $("#btn-rel-cancel").addEventListener("click", () => hideRelForm());
  $("#btn-rel-type-add").addEventListener("click", () =>
    addRelationType().catch(err)
  );
  $("#rel-box").addEventListener("change", fillRelateCardSelect);

  $("#btn-edit-card").addEventListener("click", () => {
    setCardMode("edit");
    markDirty(false);
    persistSession();
    setStatus("Editing card");
  });
  const railOpen = $("#btn-rail-open");
  if (railOpen) railOpen.addEventListener("click", () => setRailCollapsed(false));
  const railClose = $("#btn-rail-close");
  if (railClose) railClose.addEventListener("click", () => setRailCollapsed(true));

  for (const id of ["f-headliner", "f-slugline", "f-prime"]) {
    $(`#${id}`).addEventListener("input", () => markDirty(true));
  }
  $("#f-gravity").addEventListener("change", () => markDirty(true));
}

function err(e) {
  setStatus(String(e.message || e), true);
}

async function boot() {
  bind();
  sessionReady = false;

  // Prefer last session rail; else mobile collapsed / desktop open
  const prior = readSession();
  if (prior && typeof prior.railCollapsed === "boolean") {
    state.railCollapsed = prior.railCollapsed;
  } else {
    state.railCollapsed = window.matchMedia("(max-width: 720px)").matches;
  }
  applyRailDom(); // do NOT persist yet — would wipe stem

  try {
    setStatus("Connecting to loreBOX desk…");
    let last = null;
    for (let i = 0; i < 40; i++) {
      try {
        await api("/api/health");
        last = null;
        break;
      } catch (e) {
        last = e;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    if (last) throw last;
    await refreshRelationTypes();
    await refreshBoxes();
    await refreshCatalog();
    state.box = null;
    state.card = null;
    const restored = await restoreSession();
    renderAll();
    sessionReady = true;
    persistSession(); // write clean snapshot after restore
    if (!restored && !state.box) setStatus("loreBOX is ready");
  } catch (e) {
    sessionReady = true;
    console.error("loreBOX boot", e);
    setStatus(
      "Cannot reach desk server on :42929. Check box_sys/desk-server.log or run: python server.py",
      true
    );
    renderAll();
  }
}

boot();
