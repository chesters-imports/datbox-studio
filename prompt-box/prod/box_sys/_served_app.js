/* promptBOX - decks of prompt cards */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    boxes: [],
    folders: [],
    rootBoxes: [],
    box: null,
    card: null,
    dirty: false,
    placeFolder: "",
    selectedFolder: null,
    collapsedFolders: {},
    railCollapsed: false,
    safeCompact: false,
  };

  function desk() {
    return window.DatboxDesk || null;
  }

  /** Prefer DatboxDesk; fall back so a missing /datbox-core script never bricks the ROM */
  async function uiConfirm(opts) {
    const d = desk();
    if (d && typeof d.confirm === "function") return d.confirm(opts);
    const parts = [opts.title || "Confirm", ""];
    if (Array.isArray(opts.body)) parts.push.apply(parts, opts.body);
    else if (opts.body) parts.push(String(opts.body));
    else if (opts.message) parts.push(String(opts.message));
    return window.confirm(parts.join("\n"));
  }

  async function uiForm(opts) {
    const d = desk();
    if (d && typeof d.form === "function") return d.form(opts);
    const fields = opts.fields || [];
    const values = {};
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const v = window.prompt(
        (opts.title ? opts.title + "\n" : "") + (f.label || f.name),
        f.value != null ? String(f.value) : ""
      );
      if (v === null) return { ok: false };
      values[f.name] = v;
    }
    return { ok: true, values: values };
  }

  async function uiAlert(opts) {
    const d = desk();
    if (d && typeof d.alert === "function") return d.alert(opts);
    window.alert(
      [opts.title || ""].concat(opts.body || []).filter(Boolean).join("\n")
    );
  }

  async function api(method, path, body) {
    const opts = { method: method || "GET", headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch (e) {
      throw new Error(
        "Network error (" +
          path +
          ") - is the promptBOX desk on :43002 running? Fully relaunch the ROM."
      );
    }
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_e) {
      data = { error: text.slice(0, 120) };
    }
    if (!res.ok) {
      throw new Error(data.error || res.statusText || "request failed");
    }
    return data;
  }

  function setStatus(msg, isErr) {
    const el = $("#status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("err", !!isErr);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.__promptApplyDensity = function (c) {
    state.safeCompact = !!c;
    applyChrome();
  };

  function applyChrome() {
    const app = $("#app");
    if (app) {
      app.classList.toggle("rail-collapsed", state.railCollapsed);
      app.classList.toggle("safe-compact", state.safeCompact);
    }
    const slim = $("#rail-slim");
    if (slim) slim.hidden = !state.railCollapsed;
    const dens = $("#btn-safe-density");
    if (dens) {
      dens.setAttribute("aria-pressed", state.safeCompact ? "true" : "false");
      const comfy = dens.querySelector(".density-ico-comfy");
      const compact = dens.querySelector(".density-ico-compact");
      if (comfy) comfy.hidden = !!state.safeCompact;
      if (compact) compact.hidden = !state.safeCompact;
    }
    syncFolderDock();
  }

  function syncFolderDock() {
    const has = !!state.selectedFolder;
    ["btn-rename-folder", "btn-del-folder"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !has;
    });
  }

  async function loadPrefs() {
    try {
      const data = await api("GET", "/api/prefs");
      const p = data.prefs || {};
      if (window.PromptTheme) PromptTheme.applyPrefs(p);
      state.safeCompact = !!p.safe_compact;
      applyChrome();
    } catch (_e) {
      if (window.PromptTheme) {
        const c = PromptTheme.readCache();
        state.safeCompact = !!c.safe_compact;
        applyChrome();
      }
    }
  }

  async function savePrefs(patch) {
    const data = await api("POST", "/api/prefs", patch);
    if (window.PromptTheme) PromptTheme.applyPrefs(data.prefs);
    state.safeCompact = !!(data.prefs && data.prefs.safe_compact);
    applyChrome();
    return data.prefs;
  }

  async function refreshBoxes() {
    const data = await api("GET", "/api/boxes");
    state.boxes = Array.isArray(data.boxes) ? data.boxes : [];
    state.folders = Array.isArray(data.folders) ? data.folders : [];
    state.rootBoxes = Array.isArray(data.root_boxes)
      ? data.root_boxes
      : state.boxes.filter((b) => !b.folder);
    // If tree shape missing, still show flat list
    if (!state.rootBoxes.length && state.boxes.length) {
      state.rootBoxes = state.boxes.slice();
    }
    if (state.box) {
      const still = state.boxes.some((b) => b.stem === state.box.stem);
      if (!still) {
        state.box = null;
        state.card = null;
      } else {
        try {
          state.box = await api(
            "GET",
            "/api/box/" + encodeURIComponent(state.box.stem)
          );
          if (state.card) {
            state.card =
              (state.box.cards || []).find(
                (c) => c.prompt_code === state.card.prompt_code
              ) || null;
          }
        } catch (_e) {
          state.box = null;
          state.card = null;
        }
      }
    }
    renderAll();
    const n = state.boxes.length;
    if (n && (!$("#status") || /vault|Waiting|Booting|Loading/i.test($("#status").textContent || ""))) {
      setStatus("promptBOX  |  " + n + " deck(s) in vault");
    }
  }

  function folderOfOpenBox() {
    if (!state.box) return null;
    const stem = state.box.stem;
    for (const f of state.folders || []) {
      if ((f.boxes || []).some((b) => b.stem === stem)) return f.id;
    }
    if ((state.rootBoxes || []).some((b) => b.stem === stem)) return "";
    return null;
  }

  async function openBox(stem) {
    if (state.dirty && !(await confirmDiscard())) return;
    const data = await api("GET", "/api/box/" + encodeURIComponent(stem));
    state.box = data;
    state.card = null;
    state.dirty = false;
    renderAll();
    setStatus("Opened " + data.stem + ".promptbox  |  " + data.box_name);
  }

  async function confirmDiscard() {
    return uiConfirm({
      title: "Unsaved prompt",
      body: "Discard unsaved edits?",
      okLabel: "Discard",
      cancelLabel: "Keep editing",
      danger: true,
    });
  }

  async function newBox() {
    try {
      const dlg = await uiForm({
        title: "New prompt deck",
        okLabel: "Create",
        fields: [
          {
            name: "box_name",
            label: "Deck name",
            value: "",
            hint: "e.g. Journal  |  Morning",
          },
          {
            name: "stem",
            label: "Stem (optional)",
            value: "",
            hint: "Auto from name if blank",
          },
        ],
      });
      if (!dlg.ok) return;
      const name = (dlg.values.box_name || "").trim();
      if (!name) {
        setStatus("Name required", true);
        return;
      }
      let stem = (dlg.values.stem || "").trim();
      if (!stem) {
        stem = (
          await api("GET", "/api/stem?name=" + encodeURIComponent(name))
        ).stem;
      }
      const data = await api("POST", "/api/boxes", {
        box_name: name,
        stem: stem,
        folder: state.placeFolder || "",
      });
      await refreshBoxes();
      await openBox(data.stem);
      setStatus("Created " + data.stem + ".promptbox");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function newFolder() {
    try {
      const dlg = await uiForm({
        title: "New folder",
        okLabel: "Create",
        fields: [{ name: "name", label: "Folder name", value: "" }],
      });
      if (!dlg.ok) return;
      const name = (dlg.values.name || "").trim();
      if (!name) return;
      const data = await api("POST", "/api/folders", { name: name });
      state.boxes = data.boxes || [];
      state.folders = data.folders || [];
      state.rootBoxes = data.root_boxes || state.boxes.filter((b) => !b.folder);
      state.selectedFolder = (data.folder && data.folder.id) || name;
      state.placeFolder = state.selectedFolder;
      renderAll();
      setStatus("Folder [" + state.selectedFolder + "]");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function renameFolder() {
    if (!state.selectedFolder) return;
    try {
      const dlg = await uiForm({
        title: "Rename folder",
        okLabel: "Rename",
        fields: [
          { name: "name", label: "Folder name", value: state.selectedFolder },
        ],
      });
      if (!dlg.ok) return;
      const data = await api("POST", "/api/folders/rename", {
        id: state.selectedFolder,
        name: (dlg.values.name || "").trim(),
      });
      const nid = (data.folder && data.folder.id) || dlg.values.name;
      if (state.placeFolder === state.selectedFolder) state.placeFolder = nid;
      state.selectedFolder = nid;
      state.boxes = data.boxes || [];
      state.folders = data.folders || [];
      state.rootBoxes = data.root_boxes || [];
      renderAll();
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function deleteFolder() {
    if (!state.selectedFolder) return;
    const ok = await uiConfirm({
      title: "Delete folder",
      body: [
        "Delete folder [" + state.selectedFolder + "]?",
        "Decks inside move to Unsorted.",
      ],
      okLabel: "Delete folder",
      danger: true,
    });
    if (!ok) return;
    try {
      const data = await api(
        "DELETE",
        "/api/folders/" + encodeURIComponent(state.selectedFolder)
      );
      if (state.placeFolder === state.selectedFolder) state.placeFolder = "";
      state.selectedFolder = null;
      state.boxes = data.boxes || [];
      state.folders = data.folders || [];
      state.rootBoxes = data.root_boxes || [];
      renderAll();
      setStatus("Folder deleted");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function renameDeck() {
    if (!state.box) return;
    try {
      const dlg = await uiForm({
        title: "Rename deck",
        okLabel: "Rename",
        fields: [
          {
            name: "box_name",
            label: "Deck name",
            value: state.box.box_name || "",
          },
          {
            name: "stem",
            label: "Stem",
            value: state.box.stem || "",
            hint: "Changing stem renames the .promptbox file and card codes.",
          },
        ],
      });
      if (!dlg.ok) return;
      const data = await api(
        "PUT",
        "/api/box/" + encodeURIComponent(state.box.stem),
        {
          box_name: (dlg.values.box_name || "").trim(),
          stem: (dlg.values.stem || "").trim(),
        }
      );
      state.box = data;
      state.card = null;
      await refreshBoxes();
      setStatus("Renamed -> " + data.stem + ".promptbox");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function deleteDeck() {
    if (!state.box) return;
    const ok = await uiConfirm({
      title: "Delete deck",
      body: [
        "Hard delete " + state.box.stem + ".promptbox?",
        "All prompts in this deck will be removed.",
      ],
      okLabel: "Delete deck",
      danger: true,
    });
    if (!ok) return;
    try {
      await api("DELETE", "/api/box/" + encodeURIComponent(state.box.stem));
      state.box = null;
      state.card = null;
      state.dirty = false;
      await refreshBoxes();
      setStatus("Deck deleted");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function newCard() {
    if (!state.box) return;
    if (state.dirty && !(await confirmDiscard())) return;
    try {
      const data = await api(
        "POST",
        "/api/box/" + encodeURIComponent(state.box.stem) + "/card",
        { prompt: "", notes: "" }
      );
      state.box = data.box;
      state.card = data.card;
      state.dirty = false;
      renderAll();
      setStatus("Minted " + data.card.prompt_code);
      const ta = $("#f-prompt");
      if (ta) ta.focus();
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function saveCard() {
    if (!state.box || !state.card) return;
    const prompt = ($("#f-prompt") && $("#f-prompt").value) || "";
    const notes = ($("#f-notes") && $("#f-notes").value) || "";
    try {
      const data = await api(
        "PUT",
        "/api/box/" +
          encodeURIComponent(state.box.stem) +
          "/card/" +
          encodeURIComponent(state.card.prompt_code),
        { prompt, notes }
      );
      state.box = data.box;
      state.card = data.card;
      state.dirty = false;
      renderAll();
      setStatus("Saved " + data.card.prompt_code);
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  async function deleteCard() {
    if (!state.box || !state.card) return;
    const ok = await uiConfirm({
      title: "Delete prompt",
      body: "Delete " + state.card.prompt_code + "?",
      okLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const data = await api(
        "DELETE",
        "/api/box/" +
          encodeURIComponent(state.box.stem) +
          "/card/" +
          encodeURIComponent(state.card.prompt_code)
      );
      state.box = data;
      state.card = null;
      state.dirty = false;
      renderAll();
      setStatus("Prompt deleted");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  function markDirty() {
    state.dirty = true;
    const b = $("#btn-save");
    if (b) b.disabled = false;
  }

  function renderAll() {
    applyChrome();
    renderBoxList();
    renderMain();
  }

  function renderMain() {
    const has = !!state.box;
    const empty = $("#main-empty");
    const loaded = $("#main-loaded");
    if (empty) empty.hidden = has;
    if (loaded) loaded.hidden = !has;
    if (!has) {
      $("#chrome-meta").textContent = "DATBOX Studio  |  no deck loaded";
      return;
    }
    $("#meta-box-name").textContent = state.box.box_name || "-";
    $("#meta-stem").textContent = state.box.stem || "-";
    $("#chrome-meta").textContent =
      "promptBOX  |  " + state.box.stem + ".promptbox  |  " + state.box.box_name;
    renderCardList();
    renderEditor();
  }

  function renderCardList() {
    const body = $("#card-list");
    if (!body || !state.box) return;
    body.innerHTML = "";
    const cards = state.box.cards || [];
    if (!cards.length) {
      body.innerHTML =
        '<div class="empty-hint" style="padding:12px">No prompts yet.<br>+ mints a card.</div>';
      return;
    }
    for (const c of cards) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "card-row" +
        (state.card && state.card.prompt_code === c.prompt_code ? " active" : "");
      const preview = (c.prompt || "(empty prompt)").slice(0, 80);
      btn.innerHTML =
        '<span class="card-row-title">' +
        escapeHtml(preview) +
        (c.prompt && c.prompt.length > 80 ? "..." : "") +
        "</span>" +
        '<span class="card-row-code">' +
        escapeHtml(c.prompt_code || "") +
        "</span>";
      btn.addEventListener("click", async () => {
        if (state.dirty && state.card && !(await confirmDiscard())) return;
        state.card = c;
        state.dirty = false;
        renderCardList();
        renderEditor();
      });
      body.appendChild(btn);
    }
  }

  function renderEditor() {
    const ed = $("#editor");
    const empty = $("#editor-empty");
    const save = $("#btn-save");
    const del = $("#btn-del-card");
    if (!state.card) {
      if (ed) ed.hidden = true;
      if (empty) empty.hidden = false;
      if (save) save.disabled = true;
      if (del) del.disabled = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (ed) ed.hidden = false;
    if (save) save.disabled = !state.dirty;
    if (del) del.disabled = false;
    $("#f-code").textContent = state.card.prompt_code || "-";
    $("#f-prompt").value = state.card.prompt || "";
    $("#f-notes").value = state.card.notes || "";
    const tpsLine = $("#f-tps-line");
    const tps = $("#f-tps");
    if (state.card.tps_chip) {
      if (tpsLine) tpsLine.hidden = false;
      if (tps) tps.textContent = state.card.tps_chip;
    } else {
      if (tpsLine) tpsLine.hidden = true;
    }
  }

  function makeBoxItem(b) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "list-item" + (state.box && state.box.stem === b.stem ? " active" : "");
    btn.innerHTML =
      '<span class="box-title">' +
      escapeHtml(b.box_name) +
      "</span>" +
      '<span class="sub">' +
      escapeHtml(b.stem) +
      ".promptbox  |  " +
      (b.card_count || 0) +
      "</span>";
    btn.addEventListener("click", () => openBox(b.stem).catch((e) => setStatus(e.message, true)));
    return btn;
  }

  function renderBoxList() {
    const body = $("#box-list");
    if (!body) return;
    body.innerHTML = "";
    const openF = folderOfOpenBox();

    for (const folder of state.folders || []) {
      const collapsed = !!state.collapsedFolders[folder.id];
      const sec = document.createElement("div");
      sec.className =
        "shelf-folder" +
        (state.placeFolder === folder.id ? " shelf-on" : "") +
        (openF === folder.id ? " contains-open" : "") +
        (state.selectedFolder === folder.id ? " folder-selected" : "");
      const head = document.createElement("div");
      head.className = "folder-head";
      head.innerHTML =
        '<button type="button" class="folder-twisty btn linkish">' +
        (collapsed ? "?" : "?") +
        "</button>" +
        '<span class="folder-name"></span>' +
        '<button type="button" class="folder-shelf">shelf</button>';
      head.querySelector(".folder-name").textContent = folder.name || folder.id;
      head.querySelector(".folder-twisty").addEventListener("click", (e) => {
        e.stopPropagation();
        state.collapsedFolders[folder.id] = !collapsed;
        renderBoxList();
      });
      head.querySelector(".folder-shelf").addEventListener("click", (e) => {
        e.stopPropagation();
        state.placeFolder = folder.id;
        state.selectedFolder = folder.id;
        renderBoxList();
        setStatus("New decks -> [" + folder.id + "]");
      });
      head.addEventListener("click", () => {
        state.placeFolder = folder.id;
        state.selectedFolder = folder.id;
        renderBoxList();
        setStatus("Folder [" + folder.id + "] | dock settings/delete");
      });
      sec.appendChild(head);
      const fb = document.createElement("div");
      fb.className = "folder-body";
      fb.hidden = collapsed;
      for (const b of folder.boxes || []) fb.appendChild(makeBoxItem(b));
      if (!(folder.boxes || []).length && !collapsed) {
        const h = document.createElement("div");
        h.className = "folder-empty";
        h.textContent = "empty";
        fb.appendChild(h);
      }
      sec.appendChild(fb);
      body.appendChild(sec);
    }

    const root = document.createElement("div");
    root.className =
      "shelf-unsorted" +
      (state.placeFolder === "" ? " shelf-on" : "") +
      (openF === "" ? " contains-open" : "");
    if ((state.folders || []).length) {
      const uh = document.createElement("div");
      uh.className = "unsorted-label";
      uh.innerHTML =
        '<span class="folder-name">Unsorted</span>' +
        '<button type="button" class="folder-shelf">shelf</button>';
      uh.querySelector(".folder-shelf").addEventListener("click", (e) => {
        e.stopPropagation();
        state.placeFolder = "";
        renderBoxList();
      });
      uh.addEventListener("click", () => {
        state.placeFolder = "";
        state.selectedFolder = null;
        renderBoxList();
      });
      root.appendChild(uh);
    }
    const roots = state.rootBoxes || [];
    for (let i = 0; i < roots.length; i++) {
      root.appendChild(makeBoxItem(roots[i]));
    }
    // Always attach root row if it has decks, or empty vault message
    const nFlat = (state.boxes || []).length;
    if (!nFlat) {
      body.innerHTML =
        '<div class="empty-hint">No prompt decks yet.<br>+ deck to start.</div>';
    } else {
      if (roots.length || !(state.folders || []).length) {
        body.appendChild(root);
      }
      // Flat fallback if tree had folders but root empty and something still missing
      if (!body.querySelector(".list-item") && nFlat) {
        body.innerHTML = "";
        for (let j = 0; j < state.boxes.length; j++) {
          body.appendChild(makeBoxItem(state.boxes[j]));
        }
      }
    }
    syncFolderDock();
  }

  function installMenu() {
    window.DECK_ROM_MENU = [
      { label: "New Viewer", action: "new_window" },
      { label: "Reload ROM", action: "hard_refresh" },
      { sep: true },
      {
        label: "Settings...",
        run: function () {
          openSettings().catch((e) => setStatus(e.message, true));
        },
      },
      {
        label: "About promptBOX",
        run: function () {
          uiAlert({
            title: "About promptBOX",
            body: [
              "promptBOX - a DATBOX by DatBox Studio",
              "Decks of prompt cards: question + optional notes.",
              "On datbox-core  |  port 43002  |  .promptbox",
            ],
          });
        },
      },
      { sep: true },
      { label: "Exit", action: "exit" },
    ];
  }

  async function openSettings() {
    const cur = (window.PromptTheme && PromptTheme.readCache()) || {};
    const dlg = await uiForm({
      title: "Settings",
      okLabel: "Save",
      fields: [
        {
          name: "theme",
          label: "Appearance (system / light / dark)",
          value: cur.theme || "system",
        },
        {
          name: "window_mode",
          label: "Window size (compact / standard / expanded / maximized)",
          value: cur.window_mode || "standard",
          hint: "Saved to desk_prefs; relaunch applies cold-start size.",
        },
        {
          name: "safe_compact",
          label: "Density (comfy / compact)",
          value: (cur.safe_compact || state.safeCompact) ? "compact" : "comfy",
        },
      ],
    });
    if (!dlg.ok) return;
    const dens = String(dlg.values.safe_compact || "comfy").toLowerCase();
    const wmode = String(dlg.values.window_mode || "standard").toLowerCase();
    await savePrefs({
      theme: dlg.values.theme,
      window_mode: wmode,
      safe_compact: dens === "compact" || dens === "true",
    });
    setStatus("Settings saved (window size applies fully on next launch)");
  }

  function on(id, ev, fn) {
    const el = $(id);
    if (el) el.addEventListener(ev, fn);
  }

  function bind() {
    on("btn-new-box", "click", () => newBox().catch(err));
    on("btn-new-box-empty", "click", () => newBox().catch(err));
    on("btn-new-folder", "click", () => newFolder().catch(err));
    on("btn-rename-folder", "click", () => renameFolder().catch(err));
    on("btn-del-folder", "click", () => deleteFolder().catch(err));
    on("btn-rename-deck", "click", () => renameDeck().catch(err));
    on("btn-delete-deck", "click", () => deleteDeck().catch(err));
    on("btn-new-card", "click", () => newCard().catch(err));
    on("btn-save", "click", () => saveCard().catch(err));
    on("btn-del-card", "click", () => deleteCard().catch(err));
    on("btn-rail-close", "click", () => {
      state.railCollapsed = true;
      applyChrome();
    });
    on("btn-rail-open", "click", () => {
      state.railCollapsed = false;
      applyChrome();
    });
    on("btn-safe-density", "click", () => {
      state.safeCompact = !state.safeCompact;
      applyChrome();
      savePrefs({ safe_compact: state.safeCompact }).catch(err);
    });
    on("f-prompt", "input", markDirty);
    on("f-notes", "input", markDirty);
  }

  function err(e) {
    setStatus(String(e.message || e), true);
  }

  async function boot() {
    if (window.__promptBootWatch) {
      clearTimeout(window.__promptBootWatch);
      window.__promptBootWatch = null;
    }
    setStatus("Booting promptBOX...");
    try {
      if (window.DatboxDesk) {
        DatboxDesk.configure({ brandHtml: "prompt<strong>BOX</strong>" });
      }
      installMenu();
      bind();
      setStatus("Waiting for desk on :43002...");
      let ready = false;
      let lastErr = null;
      for (let i = 0; i < 60; i++) {
        try {
          await api("GET", "/api/health");
          ready = true;
          break;
        } catch (e) {
          lastErr = e;
          setStatus("Waiting for desk on :43002... (" + (i + 1) + "/60)");
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      if (!ready) {
        setStatus(
          "Desk not running on :43002 - fully quit and relaunch run-promptBOX.bat (not just Reload). " +
            (lastErr && lastErr.message ? lastErr.message : ""),
          true
        );
        return;
      }
      setStatus("Loading vault...");
      await loadPrefs();
      await refreshBoxes();
      setStatus("promptBOX  |  decks of prompts  |  + deck to start");
    } catch (e) {
      setStatus(
        "Boot failed: " +
          String(e.message || e) +
          " - check :43002 server / fully relaunch ROM",
        true
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(err));
  } else {
    boot().catch(err);
  }
})();


