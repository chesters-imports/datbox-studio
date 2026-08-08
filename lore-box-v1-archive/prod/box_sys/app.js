/* loreBOX first pass — desk logic */

const $ = (sel, root = document) => root.querySelector(sel);

/** datbox-core desk dialogs — never window.confirm / alert / prompt */
function desk() {
  if (!window.DatboxDesk) {
    throw new Error("DatboxDesk missing — load /datbox-core/js/desk_dialog.js");
  }
  return window.DatboxDesk;
}

function openDialog(opts) {
  return desk().form(opts);
}

async function deskConfirm(opts) {
  return desk().confirm(opts);
}

/** Density bridge for theme.js FOUC cache */
window.__loreApplyDensity = function (compact) {
  state.safeCompact = !!compact;
  applyRailDom();
};

function normalizeWindowMode(m) {
  if (window.LoreTheme && LoreTheme.normalizeWindowMode) {
    return LoreTheme.normalizeWindowMode(m);
  }
  m = String(m || "standard").toLowerCase();
  if (m === "maximized" || m === "maximize" || m === "max") return "maximized";
  if (m === "expanded" || m === "large" || m === "wide") return "expanded";
  if (m === "compact" || m === "mini" || m === "short") return "compact";
  return "standard";
}

function waitForPywebview(ms) {
  ms = ms || 6000;
  return new Promise(function (resolve) {
    if (window.pywebview && window.pywebview.api) {
      resolve(window.pywebview.api);
      return;
    }
    var done = false;
    function finish(api) {
      if (done) return;
      done = true;
      resolve(api || null);
    }
    window.addEventListener("pywebviewready", function () {
      finish(window.pywebview && window.pywebview.api);
    });
    var t0 = Date.now();
    var iv = setInterval(function () {
      if (window.pywebview && window.pywebview.api) {
        clearInterval(iv);
        finish(window.pywebview.api);
      } else if (Date.now() - t0 > ms) {
        clearInterval(iv);
        finish(null);
      }
    }, 50);
  });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Apply window mode via Deck Host API.
 * Cold start size is also passed as --window-mode from run-in-deck-host
 * (reading desk_prefs) — this is a second belt after the page loads.
 */
async function applyHostWindowMode(mode) {
  mode = normalizeWindowMode(mode);
  const apiHost = await waitForPywebview(8000);
  // pywebview proxies are not always typeof === "function"
  if (!apiHost || apiHost.set_window_mode == null) {
    return null;
  }
  let last = null;
  for (let i = 0; i < 4; i++) {
    try {
      let r = apiHost.set_window_mode(mode);
      if (r && typeof r.then === "function") r = await r;
      last = r;
      let g =
        apiHost.get_window_mode != null ? apiHost.get_window_mode() : null;
      if (g && typeof g.then === "function") g = await g;
      if (g && normalizeWindowMode(g.mode) === mode) return g;
      if (r && normalizeWindowMode(r.mode) === mode) return r;
    } catch (_e) {
      /* retry */
    }
    await sleep(200 + i * 150);
  }
  return last;
}

async function loadDeskPrefs() {
  try {
    const data = await api("/api/prefs");
    const prefs = (data && data.prefs) || {};
    if (window.LoreTheme) {
      LoreTheme.applyPrefs(prefs);
    } else {
      state.safeCompact = !!prefs.safe_compact;
      applyRailDom();
    }
    state.safeCompact = !!prefs.safe_compact;
    state.windowMode = normalizeWindowMode(prefs.window_mode);
    applyRailDom();
    await applyHostWindowMode(state.windowMode);
    return prefs;
  } catch (e) {
    if (window.LoreTheme) {
      const c = LoreTheme.readCache();
      state.safeCompact = !!c.safe_compact;
      state.windowMode = normalizeWindowMode(c.window_mode);
      applyRailDom();
      await applyHostWindowMode(state.windowMode);
    }
    return null;
  }
}

async function saveDeskPrefs(patch) {
  const data = await api("/api/prefs", {
    method: "POST",
    body: JSON.stringify(patch),
  });
  const prefs = (data && data.prefs) || patch;
  if (window.LoreTheme) LoreTheme.applyPrefs(prefs);
  state.safeCompact = !!prefs.safe_compact;
  if (prefs.window_mode != null) {
    state.windowMode = normalizeWindowMode(prefs.window_mode);
  }
  applyRailDom();
  return prefs;
}

async function openSettings() {
  const cur = (window.LoreTheme && LoreTheme.readCache()) || {
    theme: "system",
    safe_compact: state.safeCompact,
    window_mode: state.windowMode || "standard",
  };
  const dlg = await openDialog({
    title: "Settings",
    okLabel: "Save",
    fields: [
      {
        name: "theme",
        label: "Appearance",
        type: "select",
        value: cur.theme || "system",
        options: [
          { value: "system", label: "System (match OS)" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ],
        hint: "Held in box_sets/desk_prefs.json — survives launches.",
      },
      {
        name: "window_mode",
        label: "Window size",
        type: "select",
        value: normalizeWindowMode(cur.window_mode || state.windowMode),
        options: [
          { value: "compact", label: "Compact (~880×560)" },
          { value: "standard", label: "Standard (~1024×768)" },
          { value: "expanded", label: "Expanded (~1600×1200)" },
          { value: "maximized", label: "Maximized" },
        ],
        hint: "Held on disk · host restores on cold start. ⤢ toggles Standard↔Expanded. □ = Maximized. Not F11 Deep.",
      },
      {
        name: "safe_compact",
        label: "Safe box density",
        type: "select",
        value:
          (cur.safe_compact || state.safeCompact) ? "compact" : "comfy",
        options: [
          { value: "comfy", label: "Comfy (roomy)" },
          { value: "compact", label: "Compact (dense)" },
        ],
        hint: "Also toggled with the small stack icon on the safe box head.",
      },
    ],
  });
  if (!dlg.ok) return;
  try {
    const wmode = normalizeWindowMode(dlg.values.window_mode);
    await saveDeskPrefs({
      theme: dlg.values.theme || "system",
      safe_compact: dlg.values.safe_compact === "compact",
      window_mode: wmode,
    });
    state.windowMode = wmode;
    await applyHostWindowMode(wmode);
    setStatus(
      "Settings saved · " +
        (dlg.values.theme || "system") +
        " · " +
        wmode +
        " · " +
        (dlg.values.safe_compact === "compact" ? "compact" : "comfy")
    );
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

async function openAboutLore() {
  await desk().alert({
    title: "About loreBOX",
    body: [
      "loreBOX — a DATBOX by DatBox Studio",
      "LORE mats · physical folders · _lorebox.datshelf",
      "Runs on datbox-core (shelf + desk dialogs).",
      "TPS / Machina: chips stamp when pocket is on.",
      "Big Box Company documents; Charlie’s Toys clocks; DATBOX holds the bags.",
    ],
    okLabel: "Close",
  });
}

function installRomMenu() {
  window.DECK_ROM_MENU = [
    { label: "New Viewer", action: "new_window" },
    { label: "Reload ROM", action: "hard_refresh" },
    { sep: true },
    {
      label: "Settings…",
      run: function () {
        openSettings().catch(function (e) {
          setStatus(String(e.message || e), true);
        });
      },
    },
    {
      label: "About loreBOX",
      run: function () {
        openAboutLore().catch(function () {});
      },
    },
    { sep: true },
    { label: "Exit", action: "exit" },
  ];
  // clear old light/dark toggle extras if any
  window.DECK_ROM_MENU_EXTRAS = [];

  // Title-bar ⤢ / □ → hold mode in desk_prefs (host also reads on next cold start)
  window.DECK_ON_WINDOW_MODE = function (mode) {
    const m = normalizeWindowMode(mode);
    if (state.windowMode === m) return;
    state.windowMode = m;
    const labels = {
      compact: "Compact",
      standard: "Standard",
      expanded: "Expanded",
      maximized: "Maximized",
    };
    saveDeskPrefs({ window_mode: m })
      .then(function () {
        setStatus("Window · " + (labels[m] || m));
      })
      .catch(function () {});
  };
}

const state = {
  boxes: [],
  folders: [], // [{id, name, boxes:[]}]
  rootBoxes: [],
  shelfFile: "_lorebox.datshelf",
  catalog: [],
  relationTypes: ["Relates to"],
  box: null,
  card: null,
  dirty: false,
  cardMode: "edit", // "edit" | "view" (B13)
  railCollapsed: false,
  /** comfortable | compact safe-box density */
  safeCompact: false,
  /** standard | expanded desk window (Deck Host size step) */
  windowMode: "standard",
  /** folder id for next new box ("" = unsorted / vault root) */
  placeFolder: "",
  /** selected folder id for ⚙ rename (null = none) */
  selectedFolder: null,
  /** folder id -> true when collapsed */
  collapsedFolders: {},
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

function venCodesOnly(list) {
  if (!list || !list.length) return [];
  const out = [];
  const seen = {};
  for (const v of list) {
    const c =
      typeof v === "string"
        ? v.trim()
        : String((v && (v.code || v.ven || "")) || "").trim();
    if (c && !seen[c]) {
      seen[c] = true;
      out.push(c);
    }
  }
  return out;
}

function fillTpsNick() {
  const chip = (state.card && state.card.tps_chip) || "";
  const exp = (state.card && state.card.tps_export) || "";
  const venText = venCodesOnly(state.card && state.card.tps_vencodes).join(" · ");
  const title = chip
    ? `Time Machina · ${chip}${exp ? " · " + exp : ""}${
        venText ? " · ven " + venText : ""
      }`
    : "";
  for (const [lineId, valId] of [
    ["f-tps-line", "f-tps"],
    ["v-tps-line", "v-tps"],
  ]) {
    const line = document.getElementById(lineId);
    const val = document.getElementById(valId);
    if (!line || !val) continue;
    if (chip) {
      line.hidden = false;
      val.textContent = chip;
      val.title = title;
    } else {
      line.hidden = true;
      val.textContent = "—";
      val.title = "";
    }
  }
  for (const [lineId, valId] of [
    ["f-ven-line", "f-ven"],
    ["v-ven-line", "v-ven"],
  ]) {
    const line = document.getElementById(lineId);
    const val = document.getElementById(valId);
    if (!line || !val) continue;
    if (venText) {
      line.hidden = false;
      val.textContent = venText;
      val.title = "VEN codes present on TPS chip when minted (codes only)";
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
  // Unset gravity: hide on view (still editable on edit form)
  const gLine = $("#v-gravity-line");
  const gVal = $("#v-gravity");
  if (gLine) gLine.hidden = g === 0;
  if (gVal) gVal.textContent = g === 0 ? "" : String(g);
  fillTpsNick();
}

/** Folder id holding the open box ("" = unsorted root, null = none). */
function folderOfOpenBox() {
  if (!state.box) return null;
  const stem = state.box.stem;
  for (const f of state.folders || []) {
    if ((f.boxes || []).some((b) => b.stem === stem)) return f.id;
  }
  if ((state.rootBoxes || []).some((b) => b.stem === stem)) return "";
  const row = (state.boxes || []).find((b) => b.stem === stem);
  if (row && "folder" in row) return row.folder || "";
  return null;
}

/** Apply rail chrome without touching storage (boot-safe). */
function applyRailDom() {
  const app = $("#app");
  if (app) {
    app.classList.toggle("rail-collapsed", state.railCollapsed);
    app.classList.toggle("safe-compact", !!state.safeCompact);
  }
  const slim = $("#rail-slim");
  if (slim) slim.hidden = !state.railCollapsed;
  const openTab = $("#btn-rail-open");
  if (openTab) {
    openTab.setAttribute(
      "aria-expanded",
      state.railCollapsed ? "false" : "true"
    );
  }
  const dens = $("#btn-safe-density");
  if (dens) {
    dens.setAttribute("aria-pressed", state.safeCompact ? "true" : "false");
    dens.title = state.safeCompact
      ? "Density · compact (rail + cards; click for comfy)"
      : "Density · comfy (rail + cards; click for compact)";
    const comfy = dens.querySelector(".density-ico-comfy");
    const compact = dens.querySelector(".density-ico-compact");
    if (comfy) comfy.hidden = !!state.safeCompact;
    if (compact) compact.hidden = !state.safeCompact;
  }
  syncDockEnabled();
}

function setRailCollapsed(collapsed) {
  state.railCollapsed = !!collapsed;
  // Collapse must not leave a sticky folder as ⚙/🗑 target
  if (collapsed) state.selectedFolder = null;
  applyRailDom();
  persistSession();
}

function setSafeCompact(compact, opts) {
  opts = opts || {};
  state.safeCompact = !!compact;
  applyRailDom();
  persistSession();
  if (opts.persist !== false) {
    saveDeskPrefs({ safe_compact: state.safeCompact }).catch(function (e) {
      setStatus(String(e.message || e), true);
    });
  }
}

function syncDockEnabled() {
  const hasBox = !!state.box;
  const hasFolder = !!state.selectedFolder;
  // Safe-box dock ⚙/🗑 = folder only. Deck rename/delete live on the context strip.
  ["btn-rename"].forEach((id) => {
    const el = $(`#${id}`);
    if (el) {
      el.disabled = !hasFolder;
      el.title = hasFolder
        ? "Rename folder “" + state.selectedFolder + "”"
        : "Select a folder in the rail, then rename";
    }
  });
  ["btn-del-box"].forEach((id) => {
    const el = $(`#${id}`);
    if (el) {
      el.disabled = !hasFolder;
      el.title = hasFolder
        ? "Delete folder “" +
          state.selectedFolder +
          "” (boxes move to unsorted)"
        : "Select a folder in the rail, then delete";
    }
  });
  // Collapsed slim rail still acts on the open deck
  ["btn-slim-rename"].forEach((id) => {
    const el = $(`#${id}`);
    if (el) {
      el.disabled = !hasBox;
      el.title = hasBox ? "Rename open deck" : "Open a deck first";
    }
  });
  ["btn-slim-del"].forEach((id) => {
    const el = $(`#${id}`);
    if (el) {
      el.disabled = !hasBox;
      el.title = hasBox ? "Delete open deck" : "Open a deck first";
    }
  });
  const renDeck = $("#btn-rename-deck");
  const delDeck = $("#btn-delete-deck");
  if (renDeck) renDeck.disabled = !hasBox;
  if (delDeck) delDeck.disabled = !hasBox;
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
      safeCompact: state.safeCompact,
      collapsedFolders: state.collapsedFolders || {},
      placeFolder: state.placeFolder || "",
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
    setStatus(`Restored ${data.stem}.lorebox`);
    return true;
  } catch (e) {
    setStatus("Could not restore last box (missing?)", true);
    return false;
  }
}

/** A2/A3: clear loaded context when nothing is selected */
async function clearSelection(opts = {}) {
  const { keepDirtyCheck = false } = opts;
  if (keepDirtyCheck && state.dirty) {
    if (
      !(await deskConfirm({
        title: "Unsaved card",
        body: "Discard unsaved card edits?",
        okLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      }))
    )
      return false;
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
  state.folders = data.folders || [];
  state.rootBoxes = data.root_boxes || [];
  state.shelfFile = data.shelf_file || "_lorebox.datshelf";

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

/** Flatten current rail order into shelf payload and POST. */
async function commitShelfFromDom() {
  const body = $("#box-list");
  if (!body) return;
  const ordered = [];
  const fo = [];
  for (const child of body.children) {
    if (!child.hasAttribute("data-shelf-folder")) continue;
    const fid = child.getAttribute("data-shelf-folder") || "";
    if (fid) fo.push(fid);
    // folder-body or direct children (unsorted zone)
    const scope =
      child.querySelector(":scope > .folder-body") || child;
    scope.querySelectorAll(":scope > .list-item[data-stem]").forEach((el) => {
      ordered.push({ stem: el.getAttribute("data-stem"), folder: fid });
    });
  }
  const data = await api("/api/shelf", {
    method: "POST",
    body: JSON.stringify({ folder_order: fo, boxes: ordered }),
  });
  state.boxes = data.boxes || [];
  state.folders = data.folders || [];
  state.rootBoxes = data.root_boxes || [];
  state.shelfFile = data.shelf_file || state.shelfFile;
  renderBoxList();
  setStatus("Shelf order saved · " + (state.shelfFile || "_lorebox.datshelf"));
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
    if (
      !(await deskConfirm({
        title: "Unsaved card",
        body: "Discard unsaved card edits?",
        okLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      }))
    )
      return;
  }
  const data = await api(`/api/box/${encodeURIComponent(stem)}`);
  state.box = data;
  state.card = null; // require explicit card pick / new (clearer empty card tooling)
  markDirty(false);
  clearEditorFields();
  renderAll();
  persistSession();
  setStatus(`Opened ${data.stem}.lorebox · ${data.box_name}`);
}

/* ---------- render ---------- */

function renderMainPane() {
  const empty = $("#main-empty");
  const loaded = $("#main-loaded");
  const hasBox = !!state.box;

  if (empty) empty.hidden = hasBox;
  if (loaded) loaded.hidden = !hasBox;

  syncDockEnabled();

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
  $("#chrome-meta").textContent = `DATBOX Loaded [ ${state.box.stem}.lorebox | ${state.box.box_name} ]`;
  syncDockEnabled();
}

function makeBoxListItem(b) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "list-item box-row" +
    (state.box && state.box.stem === b.stem ? " active" : "");
  btn.draggable = true;
  btn.dataset.stem = b.stem;
  btn.innerHTML = `<span class="drag-grip" title="Drag to reorder or into a folder">⋮⋮</span>
    <span class="list-item-text"><span class="box-title">${escapeHtml(b.box_name)}</span>
    <span class="sub">${escapeHtml(b.stem)}.lorebox · ${b.card_count || 0}</span></span>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Opening a deck does not clear folder pick — dock ⚙ stays for folders
    openBox(b.stem);
  });
  btn.addEventListener("dragstart", (e) => {
    btn.classList.add("dragging");
    e.dataTransfer.setData("text/plain", "box:" + b.stem);
    e.dataTransfer.setData("application/x-datbox-box", b.stem);
    e.dataTransfer.effectAllowed = "move";
    state._dragStem = b.stem;
    state._dragFolder = null;
  });
  btn.addEventListener("dragend", () => {
    btn.classList.remove("dragging");
    state._dragStem = null;
    bodyClearDrop();
  });
  return btn;
}

function bodyClearDrop() {
  document
    .querySelectorAll("#box-list .drop-hover, #box-list .folder-drag-hover")
    .forEach((el) => el.classList.remove("drop-hover", "folder-drag-hover"));
}

function findBoxEl(stem) {
  return Array.from(
    document.querySelectorAll("#box-list .list-item[data-stem]")
  ).find((el) => el.getAttribute("data-stem") === stem);
}

async function finishShelfDrop() {
  try {
    await commitShelfFromDom();
  } catch (err) {
    setStatus(String(err.message || err), true);
    await refreshBoxes();
  }
}

function wireFolderDrop(sec) {
  const onOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (state._dragFolder) {
      sec.classList.add("folder-drag-hover");
    } else {
      sec.classList.add("drop-hover");
    }
  };
  const onLeave = (e) => {
    if (!sec.contains(e.relatedTarget)) {
      sec.classList.remove("drop-hover", "folder-drag-hover");
    }
  };
  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    sec.classList.remove("drop-hover", "folder-drag-hover");
    const body = $("#box-list");
    const raw =
      e.dataTransfer.getData("text/plain") ||
      (state._dragStem ? "box:" + state._dragStem : "") ||
      (state._dragFolder ? "folder:" + state._dragFolder : "");

    // Folder reorder: drop folder onto another folder section
    if (raw.startsWith("folder:") || state._dragFolder) {
      const fid = raw.startsWith("folder:")
        ? raw.slice(7)
        : state._dragFolder;
      const moving = body.querySelector(
        '.shelf-folder[data-shelf-folder="' + fid + '"]'
      );
      if (moving && moving !== sec) {
        body.insertBefore(moving, sec);
        await finishShelfDrop();
      }
      return;
    }

    const stem = raw.startsWith("box:")
      ? raw.slice(4)
      : e.dataTransfer.getData("application/x-datbox-box") || state._dragStem;
    if (!stem) return;
    const card = findBoxEl(stem);
    if (!card) return;
    const before = e.target.closest(".list-item[data-stem]");
    const bodyEl = sec.querySelector(".folder-body") || sec;
    if (before && before !== card && bodyEl.contains(before)) {
      bodyEl.insertBefore(card, before);
    } else {
      bodyEl.appendChild(card);
    }
    await finishShelfDrop();
  };
  sec.addEventListener("dragover", onOver);
  sec.addEventListener("dragleave", onLeave);
  sec.addEventListener("drop", onDrop);
}

function wireUnsortedDrop(zone) {
  zone.addEventListener("dragover", (e) => {
    if (state._dragFolder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    zone.classList.add("drop-hover");
  });
  zone.addEventListener("dragleave", (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove("drop-hover");
  });
  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("drop-hover");
    const raw = e.dataTransfer.getData("text/plain") || "";
    if (raw.startsWith("folder:")) return;
    const stem =
      (raw.startsWith("box:") ? raw.slice(4) : raw) ||
      e.dataTransfer.getData("application/x-datbox-box") ||
      state._dragStem;
    if (!stem) return;
    const card = findBoxEl(stem);
    if (!card) return;
    const before = e.target.closest(".list-item[data-stem]");
    if (before && before !== card && zone.contains(before)) {
      zone.insertBefore(card, before);
    } else {
      zone.appendChild(card);
    }
    await finishShelfDrop();
  });
}

function renderBoxList() {
  const body = $("#box-list");
  body.innerHTML = "";
  if (!state.boxes.length && !(state.folders || []).length) {
    body.innerHTML =
      '<div class="empty-hint">No lore boxes yet.<br>+ box · 📁 folder · shelf order in _lorebox.datshelf</div>';
    return;
  }

  const openFolder = folderOfOpenBox(); // "" root, id, or null

  for (const folder of state.folders || []) {
    const collapsed = !!(state.collapsedFolders || {})[folder.id];
    const isPlace = state.placeFolder === folder.id;
    const isOpenHere = openFolder === folder.id;
    const isFolderPick = !state.box && state.selectedFolder === folder.id;
    const sec = document.createElement("div");
    sec.className =
      "shelf-folder" +
      (isPlace ? " shelf-on" : "") +
      (isOpenHere ? " contains-open" : "") +
      (isFolderPick ? " folder-selected" : "") +
      (collapsed ? " is-collapsed" : "");
    sec.dataset.shelfFolder = folder.id;

    const head = document.createElement("div");
    head.className = "folder-head";
    head.draggable = true;
    head.innerHTML =
      '<button type="button" class="folder-twisty" title="Expand / collapse" aria-label="Expand or collapse">▸</button>' +
      '<span class="folder-ico">📁</span>' +
      '<span class="folder-name"></span>' +
      '<button type="button" class="folder-shelf btn linkish" title="New boxes land in this folder">shelf</button>';
    const twisty = head.querySelector(".folder-twisty");
    twisty.textContent = collapsed ? "▸" : "▾";
    head.querySelector(".folder-name").textContent = folder.name || folder.id;

    twisty.addEventListener("click", (e) => {
      e.stopPropagation();
      state.collapsedFolders = state.collapsedFolders || {};
      state.collapsedFolders[folder.id] = !collapsed;
      persistSession();
      renderBoxList();
    });
    head.querySelector(".folder-shelf").addEventListener("click", (e) => {
      e.stopPropagation();
      state.placeFolder = folder.id;
      state.selectedFolder = folder.id;
      renderBoxList();
      syncDockEnabled();
      setStatus("Shelf → “" + (folder.name || folder.id) + "” for new boxes");
    });
    head.addEventListener("click", () => {
      // Folder head: select for dock ⚙/🗑 + set landing place
      state.placeFolder = folder.id;
      state.selectedFolder = folder.id;
      renderBoxList();
      syncDockEnabled();
      setStatus(
        "Folder “" +
          (folder.name || folder.id) +
          "” · dock ⚙ rename · 🗑 delete · deck tools on the name bar"
      );
    });
    head.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", "folder:" + folder.id);
      e.dataTransfer.effectAllowed = "move";
      state._dragFolder = folder.id;
      state._dragStem = null;
      sec.classList.add("dragging-folder");
    });
    head.addEventListener("dragend", () => {
      state._dragFolder = null;
      sec.classList.remove("dragging-folder");
      bodyClearDrop();
    });
    sec.appendChild(head);

    const fbody = document.createElement("div");
    fbody.className = "folder-body";
    fbody.hidden = collapsed;
    for (const b of folder.boxes || []) {
      fbody.appendChild(makeBoxListItem(b));
    }
    if (!(folder.boxes || []).length && !collapsed) {
      const hint = document.createElement("div");
      hint.className = "folder-empty muted";
      hint.textContent = "empty · drop a box here";
      fbody.appendChild(hint);
    }
    sec.appendChild(fbody);
    wireFolderDrop(sec);
    body.appendChild(sec);
  }

  // Unsorted: same level as folders (no fake "Root" chrome)
  const unsorted = document.createElement("div");
  unsorted.className =
    "shelf-unsorted" +
    (state.placeFolder === "" ? " shelf-on" : "") +
    (openFolder === "" ? " contains-open" : "");
  unsorted.dataset.shelfFolder = "";
  const uhead = document.createElement("div");
  uhead.className = "unsorted-label";
  uhead.innerHTML =
    '<span class="folder-name">Unsorted</span>' +
    '<button type="button" class="folder-shelf btn linkish" title="New boxes land at vault root">shelf</button>';
  uhead.querySelector(".folder-shelf").addEventListener("click", (e) => {
    e.stopPropagation();
    state.placeFolder = "";
    if (!state.box) state.selectedFolder = null;
    renderBoxList();
    syncDockEnabled();
    setStatus("Shelf → unsorted (vault root)");
  });
  uhead.addEventListener("click", () => {
    state.placeFolder = "";
    if (!state.box) state.selectedFolder = null;
    renderBoxList();
    syncDockEnabled();
  });
  // Only show Unsorted header when there are folders OR root boxes
  const showUnsortedChrome =
    (state.folders || []).length > 0 || (state.rootBoxes || []).length > 0;
  if (showUnsortedChrome && (state.folders || []).length > 0) {
    unsorted.appendChild(uhead);
  }
  for (const b of state.rootBoxes || []) {
    unsorted.appendChild(makeBoxListItem(b));
  }
  if (!(state.rootBoxes || []).length && (state.folders || []).length > 0) {
    const hint = document.createElement("div");
    hint.className = "folder-empty muted";
    hint.textContent = "no unsorted boxes";
    unsorted.appendChild(hint);
  }
  wireUnsortedDrop(unsorted);
  body.appendChild(unsorted);
  syncDockEnabled();
}

function renderCardList() {
  const body = $("#card-list");
  if (!body) return;
  body.innerHTML = "";
  body.classList.add("card-list");
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
      "card-row" +
      (state.card && state.card.lore_code === c.lore_code ? " active" : "");
    const g = c.gravity > 0 ? " · g" + c.gravity : "";
    btn.innerHTML =
      '<span class="card-row-title">' +
      escapeHtml(c.headliner || "(no headliner)") +
      "</span>" +
      '<span class="card-row-code">' +
      escapeHtml(c.lore_code || "") +
      g +
      "</span>";
    btn.addEventListener("click", async () => {
      if (state.dirty && state.cardMode === "edit") {
        if (
          !(await deskConfirm({
            title: "Unsaved card",
            body: "Discard unsaved edits on this card?",
            okLabel: "Discard",
            cancelLabel: "Keep editing",
            danger: true,
          }))
        )
          return;
      }
      state.card = c;
      markDirty(false);
      setCardMode("view");
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
        ...(state.card.tps_chip ? { tps_chip: state.card.tps_chip } : {}),
        ...(state.card.tps_export ? { tps_export: state.card.tps_export } : {}),
        ...(venCodesOnly(state.card.tps_vencodes).length
          ? { tps_vencodes: venCodesOnly(state.card.tps_vencodes) }
          : {}),
      }),
    }
  );
  state.box = data.box;
  const keptChip = state.card.tps_chip;
  const keptExp = state.card.tps_export;
  const keptVen = venCodesOnly(state.card.tps_vencodes);
  state.card = data.card;
  if (keptChip && !state.card.tps_chip) state.card.tps_chip = keptChip;
  if (keptExp && !state.card.tps_export) state.card.tps_export = keptExp;
  if (keptVen.length && !venCodesOnly(state.card.tps_vencodes).length) {
    state.card.tps_vencodes = keptVen;
  }
  markDirty(false);
  setCardMode("view");
  await refreshBoxes();
  await refreshCatalog();
  renderAll();
  persistSession();
  setStatus(`Saved ${code}`);
}

async function newFolder() {
  const dlg = await openDialog({
    title: "New folder",
    okLabel: "Create",
    fields: [
      {
        name: "name",
        label: "Folder name",
        value: "",
        hint: "Physical place under safe_box/ (e.g. company). Real directory.",
      },
    ],
  });
  if (!dlg.ok) return;
  const name = (dlg.values.name || "").trim();
  if (!name) {
    setStatus("Folder name required", true);
    return;
  }
  try {
    const data = await api("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    state.boxes = data.boxes || [];
    state.folders = data.folders || [];
    state.rootBoxes = data.root_boxes || [];
    state.placeFolder = (data.folder && data.folder.id) || name;
    renderBoxList();
    setStatus(
      "Folder “" +
        ((data.folder && data.folder.name) || name) +
        "” · place is on · shelf " +
        (state.shelfFile || "")
    );
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

async function newBox() {
  const place =
    state.placeFolder ||
    "";
  const placeHint = place
    ? "Lands in folder “" + place + "” (change place on a folder head)."
    : "Lands at vault root (click Place on a folder to bin it).";
  const dlg = await openDialog({
    title: "New lore box",
    okLabel: "Create",
    fields: [
      {
        name: "box_name",
        label: "Lore box name",
        value: "",
        hint: "Display name for this DATBOX. " + placeHint,
      },
      {
        name: "stem",
        label: "Stem (TYPE A)",
        value: "",
        hint: "Auto from name — edit if needed. File will be {STEM}.lorebox",
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
      body: JSON.stringify({
        box_name: name,
        stem,
        folder: state.placeFolder || "",
      }),
    });
    await refreshBoxes();
    await refreshCatalog();
    state.box = data;
    state.card = null;
    markDirty(false);
    clearEditorFields();
    renderAll();
    const where = state.placeFolder
      ? state.placeFolder + "/"
      : "";
    setStatus(`Created ${where}${data.stem}.lorebox`);
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
    const vencodes =
      now.vencodes || (now.current && now.current.vencodes) || [];
    return {
      ok: true,
      chip_id: now.current.chip_id,
      export_id: now.export_id || "",
      vencodes,
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
    let vencodes = (peeked && peeked.vencodes) || [];
    if (!chip_id) {
      const peek = await peekMachinaNow();
      if (!peek.ok) return peek;
      chip_id = peek.chip_id;
      export_id = peek.export_id;
      vencodes = peek.vencodes || [];
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
        vencodes,
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
      vencodes,
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
  if (state.dirty) {
    if (
      !(await deskConfirm({
        title: "Unsaved card",
        body: "Discard unsaved edits?",
        okLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      }))
    )
      return;
  }
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
      const codes = venCodesOnly(peek.vencodes);
      if (codes.length) mintBody.tps_vencodes = codes;
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
      let cord = peek;
      try {
        const again = await peekMachinaNow();
        if (again.ok) {
          cord = {
            ...peek,
            ...again,
            vencodes:
              again.vencodes && again.vencodes.length
                ? again.vencodes
                : peek.vencodes || [],
          };
        }
      } catch {
        /* use first peek */
      }
      const venCodes = venCodesOnly(cord.vencodes);

      const w = await whisperMatToMachina(
        data.card.lore_code,
        state.box.stem,
        cord
      );

      // Force TPS + VEN Chip onto disk (PUT stamp — lore has no /api/tps)
      try {
        const stamped = await api(
          `/api/box/${encodeURIComponent(state.box.stem)}/card/${encodeURIComponent(
            data.card.lore_code
          )}`,
          {
            method: "PUT",
            body: JSON.stringify({
              headliner: state.card.headliner || "",
              slugline: state.card.slugline || "",
              prime_lore: state.card.prime_lore || "",
              gravity: state.card.gravity || 0,
              relates: state.card.relates || [],
              tps_chip: cord.chip_id || peek.chip_id,
              tps_export: cord.export_id || peek.export_id || "",
              ...(venCodes.length ? { tps_vencodes: venCodes } : {}),
            }),
          }
        );
        if (stamped && stamped.card) {
          state.box = stamped.box || state.box;
          state.card = {
            ...state.card,
            ...stamped.card,
            tps_chip: stamped.card.tps_chip || cord.chip_id || peek.chip_id,
            tps_export:
              stamped.card.tps_export || cord.export_id || peek.export_id || "",
            tps_vencodes: venCodesOnly(
              stamped.card.tps_vencodes || venCodes
            ),
          };
        }
      } catch {
        /* create may already have nick */
      }

      if (state.card) {
        state.card.tps_chip = state.card.tps_chip || cord.chip_id || peek.chip_id;
        state.card.tps_export =
          state.card.tps_export || cord.export_id || peek.export_id || "";
        if (venCodes.length) state.card.tps_vencodes = venCodes;
      }
      if (state.box && state.box.cards) {
        const row = state.box.cards.find(
          (c) => c.lore_code === data.card.lore_code
        );
        if (row) {
          row.tps_chip = state.card.tps_chip;
          row.tps_export = state.card.tps_export;
          if (venCodes.length) row.tps_vencodes = venCodes;
        }
      }
      fillTpsNick();
      renderEditor();
      const venN = venCodes.length;
      if (w.ok) {
        setStatus(
          `Minted ${data.card.lore_code} · bound ${cord.chip_id || peek.chip_id}` +
            (venN ? ` · ${venN} ven` : " · 0 ven on chip")
        );
      } else {
        setStatus(
          `Minted ${data.card.lore_code} · chip ${cord.chip_id || peek.chip_id} (book whisper: ${w.reason || "fail"})`
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

async function deleteFolder() {
  if (!state.selectedFolder) return;
  const fid = state.selectedFolder;
  const folderMeta = (state.folders || []).find((f) => f.id === fid);
  const n = folderMeta && folderMeta.boxes ? folderMeta.boxes.length : 0;
  const body =
    n > 0
      ? [
          `Delete folder “${fid}”?`,
          `${n} box(es) will move to Unsorted — bags are not deleted.`,
          "Physical folder is removed from safe_box.",
        ]
      : [`Delete empty folder “${fid}”?`];
  if (
    !(await deskConfirm({
      title: "Delete folder",
      body,
      okLabel: "Delete folder",
      cancelLabel: "Cancel",
      danger: true,
    }))
  )
    return;
  try {
    const data = await api(`/api/folders/${encodeURIComponent(fid)}`, {
      method: "DELETE",
    });
    if (state.placeFolder === fid) state.placeFolder = "";
    state.selectedFolder = null;
    if (state.collapsedFolders) delete state.collapsedFolders[fid];
    state.boxes = data.boxes || [];
    state.folders = data.folders || [];
    state.rootBoxes = data.root_boxes || [];
    // If open box was in that folder, path still valid (moved to root) — keep open
    renderBoxList();
    syncDockEnabled();
    const moved = data.moved_to_unsorted || [];
    setStatus(
      moved.length
        ? `Folder “${fid}” trashed · ${moved.length} box(es) → unsorted`
        : `Folder “${fid}” trashed`
    );
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

/** Dock 🗑 — folder only */
async function deleteFolderFromDock() {
  if (!state.selectedFolder) {
    setStatus("Select a folder first (click its name in the rail)", true);
    return;
  }
  return deleteFolder();
}

/** Context strip / slim — open deck only */
async function deleteBox() {
  if (!state.box) return;
  if (
    !(await deskConfirm({
      title: "Delete box",
      body: [
        `Hard delete ${state.box.stem}.lorebox?`,
        "All cards in this box will be removed. This cannot be undone.",
      ],
      okLabel: "Delete box",
      cancelLabel: "Cancel",
      danger: true,
    }))
  )
    return;
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
  if (
    !(await deskConfirm({
      title: "Delete card",
      body: [
        `Hard delete ${state.card.lore_code}?`,
        "This removes the lore unit from the box.",
      ],
      okLabel: "Delete card",
      cancelLabel: "Cancel",
      danger: true,
    }))
  )
    return;
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

async function renameFolder() {
  if (!state.selectedFolder) return;
  const cur = state.selectedFolder;
  const dlg = await openDialog({
    title: "Rename folder",
    okLabel: "Rename",
    fields: [
      {
        name: "name",
        label: "Folder name",
        value: cur,
        hint: "Physical directory under safe_box/ (and shelf id).",
      },
    ],
  });
  if (!dlg.ok) return;
  const name = (dlg.values.name || "").trim();
  if (!name) {
    setStatus("Folder name required", true);
    return;
  }
  try {
    const data = await api("/api/folders/rename", {
      method: "POST",
      body: JSON.stringify({ id: cur, name }),
    });
    const nid = (data.folder && data.folder.id) || name;
    if (state.placeFolder === cur) state.placeFolder = nid;
    state.selectedFolder = nid;
    if (state.collapsedFolders && state.collapsedFolders[cur] != null) {
      state.collapsedFolders[nid] = state.collapsedFolders[cur];
      delete state.collapsedFolders[cur];
    }
    state.boxes = data.boxes || [];
    state.folders = data.folders || [];
    state.rootBoxes = data.root_boxes || [];
    renderBoxList();
    setStatus("Folder renamed → " + nid);
  } catch (e) {
    setStatus(String(e.message || e), true);
  }
}

/** Dock ⚙ — folder only */
async function renameFolderFromDock() {
  if (!state.selectedFolder) {
    setStatus("Select a folder first (click its name in the rail)", true);
    return;
  }
  return renameFolder();
}

/** Context strip / slim — open deck only */
async function renameBox() {
  if (!state.box) {
    setStatus("Open a deck first — rename lives on the deck name bar", true);
    return;
  }
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
        hint: "Changing stem rewrites codes and the .lorebox filename.",
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
    setStatus(`Renamed → ${data.stem}.lorebox`);
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
  const btnFolder = $("#btn-new-folder");
  if (btnFolder)
    btnFolder.addEventListener("click", () => newFolder().catch(err));
  const emptyNew = $("#btn-new-box-empty");
  if (emptyNew) emptyNew.addEventListener("click", () => newBox().catch(err));
  $("#btn-new-card").addEventListener("click", () => newCard().catch(err));
  $("#btn-save").addEventListener("click", () => saveCard().catch(err));
  $("#btn-del-box").addEventListener("click", () =>
    deleteFolderFromDock().catch(err)
  );
  $("#btn-del-card").addEventListener("click", () => deleteCard().catch(err));
  $("#btn-rename").addEventListener("click", () =>
    renameFolderFromDock().catch(err)
  );
  const renDeck = $("#btn-rename-deck");
  if (renDeck) renDeck.addEventListener("click", () => renameBox().catch(err));
  const delDeck = $("#btn-delete-deck");
  if (delDeck) delDeck.addEventListener("click", () => deleteBox().catch(err));
  const slimRen = $("#btn-slim-rename");
  if (slimRen) slimRen.addEventListener("click", () => renameBox().catch(err));
  const slimDel = $("#btn-slim-del");
  if (slimDel) slimDel.addEventListener("click", () => deleteBox().catch(err));
  const dens = $("#btn-safe-density");
  if (dens)
    dens.addEventListener("click", () =>
      setSafeCompact(!state.safeCompact, { persist: true })
    );
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
  if (window.DatboxDesk) {
    DatboxDesk.configure({ brandHtml: "lore<strong>BOX</strong>" });
  }
  installRomMenu();
  bind();
  sessionReady = false;

  // Prefer last session rail; else mobile collapsed / desktop open
  const prior = readSession();
  if (prior && typeof prior.railCollapsed === "boolean") {
    state.railCollapsed = prior.railCollapsed;
  } else {
    state.railCollapsed = window.matchMedia("(max-width: 720px)").matches;
  }
  // density from cache until file prefs load (session is secondary)
  if (window.LoreTheme) {
    state.safeCompact = !!LoreTheme.readCache().safe_compact;
  } else if (prior && typeof prior.safeCompact === "boolean") {
    state.safeCompact = prior.safeCompact;
  }
  if (prior && prior.collapsedFolders && typeof prior.collapsedFolders === "object") {
    state.collapsedFolders = prior.collapsedFolders;
  }
  if (prior && typeof prior.placeFolder === "string") {
    state.placeFolder = prior.placeFolder;
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
    await loadDeskPrefs();
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
