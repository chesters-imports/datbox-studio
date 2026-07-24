/* loreBOX first pass — desk logic */

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  boxes: [],
  catalog: [],
  relationTypes: ["Relates to"],
  box: null,
  card: null,
  dirty: false,
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
  const save = $("#btn-save");
  if (save) save.disabled = !state.box || !state.card || !v;
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
  if (name) name.value = "";
  if (stem) stem.value = "";
  const chrome = $("#chrome-meta");
  if (chrome) chrome.textContent = "DATBOX Studio · select a box in safe_box";
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

  $("#meta-box-name").value = state.box.box_name || "";
  $("#meta-stem").value = state.box.stem || "";
  $("#chrome-meta").textContent = `${state.box.stem}.lore · ${state.box.box_name}`;
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
      if (state.dirty && !confirm("Discard unsaved edits on this card?")) return;
      state.card = c;
      markDirty(false);
      renderCardList();
      renderEditor();
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
    const del = $("#btn-del-card");
    if (del) del.disabled = true;
    const save = $("#btn-save");
    if (save) save.disabled = true;
    return;
  }
  empty.hidden = true;
  ed.hidden = false;

  $("#f-headliner").value = state.card.headliner || "";
  $("#f-slugline").value = state.card.slugline || "";
  $("#f-prime").value = state.card.prime_lore || "";
  $("#f-core").textContent = state.card.lore_core || state.card.lore_code || "";
  $("#f-gravity").value = String(state.card.gravity ?? 0);

  const del = $("#btn-del-card");
  if (del) del.disabled = false;

  renderRelates();
  markDirty(state.dirty);
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
      '<div class="empty-hint" style="padding:6px 0">No relations yet.</div>';
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
      }),
    }
  );
  state.box = data.box;
  state.card = data.card;
  markDirty(false);
  await refreshBoxes();
  await refreshCatalog();
  renderAll();
  setStatus(`Saved ${code}`);
}

async function newBox() {
  const name = prompt("Lore Box Name?");
  if (!name || !name.trim()) return;
  const stemData = await api(
    `/api/stem?name=${encodeURIComponent(name.trim())}`
  );
  let stem = stemData.stem;
  const edit = prompt("TYPE A stem (edit if needed):", stem);
  if (edit === null) return;
  stem = (edit || stem).trim();
  try {
    const data = await api("/api/boxes", {
      method: "POST",
      body: JSON.stringify({ box_name: name.trim(), stem }),
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

async function newCard() {
  if (!state.box) return;
  if (state.dirty && !confirm("Discard unsaved edits?")) return;
  try {
    const data = await api(
      `/api/box/${encodeURIComponent(state.box.stem)}/card`,
      {
        method: "POST",
        body: JSON.stringify({
          headliner: "",
          slugline: "",
          prime_lore: "",
          gravity: 0,
        }),
      }
    );
    state.box = data.box;
    state.card = data.card;
    markDirty(false);
    await refreshBoxes();
    await refreshCatalog();
    renderAll();
    setStatus(`Minted ${data.card.lore_code}`);
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
  try {
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
    setStatus("Card deleted");
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

async function renameBox() {
  if (!state.box) return;
  const name = prompt("Lore Box Name:", state.box.box_name);
  if (name === null) return;
  let stem = state.box.stem;
  const stemEdit = prompt("Stem (TYPE A / unique in safe_box):", stem);
  if (stemEdit === null) return;
  stem = stemEdit.trim() || stem;
  try {
    const data = await api(`/api/box/${encodeURIComponent(state.box.stem)}`, {
      method: "PUT",
      body: JSON.stringify({ box_name: name.trim(), stem }),
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
  renderRelates();
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
  $("#btn-new-card").addEventListener("click", () => newCard().catch(err));
  $("#btn-save").addEventListener("click", () => saveCard().catch(err));
  $("#btn-del-box").addEventListener("click", () => deleteBox().catch(err));
  $("#btn-del-card").addEventListener("click", () => deleteCard().catch(err));
  $("#btn-rename").addEventListener("click", () => renameBox().catch(err));
  $("#btn-rel-add").addEventListener("click", addRelation);
  $("#btn-rel-type-add").addEventListener("click", () =>
    addRelationType().catch(err)
  );
  $("#rel-box").addEventListener("change", fillRelateCardSelect);

  for (const id of ["f-headliner", "f-slugline", "f-prime", "f-gravity"]) {
    $(`#${id}`).addEventListener("input", () => markDirty(true));
  }
}

function err(e) {
  setStatus(String(e.message || e), true);
}

async function boot() {
  bind();
  try {
    await api("/api/health");
    await refreshRelationTypes();
    await refreshBoxes();
    await refreshCatalog();
    // start with nothing selected if boxes exist — user picks rail
    // (unless only one box? keep empty main until click — clearer A2/A3)
    state.box = null;
    state.card = null;
    renderAll();
    setStatus("loreBOX desk ready · safe_box only");
  } catch (e) {
    setStatus(
      "Cannot reach desk server. From box_sys run: python server.py — then open http://127.0.0.1:42929/",
      true
    );
    renderAll();
  }
}

boot();
