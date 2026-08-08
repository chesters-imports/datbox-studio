/* loreBOX v2 · Papers, Please desk · Chester demanded better modals */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let tree = null;
  let openAuth = null;
  let openDeck = null;
  let openChip = null;

  if (window.DatboxDesk) {
    DatboxDesk.configure({ brandHtml: "lore<strong>BOX</strong>" });
  }

  /** Desk modals only — no Windows prompt/confirm (Chester law). */
  async function deskConfirm(title, body, danger) {
    if (window.DatboxDesk) {
      return DatboxDesk.confirm({ title, body, danger: !!danger });
    }
    return false;
  }

  async function deskForm(title, fields, okLabel) {
    if (window.DatboxDesk) {
      return DatboxDesk.form({
        title,
        fields,
        okLabel: okLabel || "File",
      });
    }
    return { ok: false, values: {} };
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 2400);
  }

  async function api(path, opts) {
    const r = await fetch(path, {
      cache: "no-store",
      headers: opts && opts.body ? { "Content-Type": "application/json" } : undefined,
      ...opts,
    });
    return r.json();
  }

  function show(which) {
    $("emptyState").hidden = which !== "empty";
    $("deckPane").hidden = which !== "deck";
    $("chipPane").hidden = which !== "chip";
  }

  async function refreshTree() {
    tree = await api("/api/tree");
    $("railGen").textContent = (tree && tree.gen) || "DBS-002";
    const el = $("tree");
    el.innerHTML = "";
    if (!tree || tree.empty || !(tree.auths || []).length) {
      el.innerHTML = '<div class="auth-lab">— no papers filed —</div>';
      $("chromeMeta").textContent = "Papers, Please · empty safe box";
      return;
    }
    for (const a of tree.auths) {
      const block = document.createElement("div");
      block.className = "auth-block";
      block.innerHTML = `<div class="auth-lab">${esc(a.auth)}</div>`;
      for (const d of a.decks || []) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "deck-row" +
          (openAuth === a.auth && openDeck === d.id ? " is-on" : "");
        btn.innerHTML = `${esc(d.leaf || d.id)}<span class="bits">${d.chip_count || 0} chips</span>`;
        btn.onclick = () => openDeckView(a.auth, d.id);
        block.appendChild(btn);
      }
      el.appendChild(block);
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function openDeckView(auth, deckId) {
    openAuth = auth;
    openDeck = deckId;
    openChip = null;
    const j = await api(
      `/api/deck?auth=${encodeURIComponent(auth)}&deck=${encodeURIComponent(deckId)}`
    );
    if (!j.ok) {
      toast(j.error || "deck fail");
      return;
    }
    show("deck");
    const store = (j.meta && j.meta.store) || {};
    const deck = (j.meta && j.meta.deck) || {};
    $("deckSku").textContent = store.sku || "—";
    $("deckTitle").textContent = deck.leaf || deck.id || deckId;
    $("deckPath").textContent = j.path || "";
    $("deckLeaf").value = deck.leaf || "";
    $("chipCount").textContent = String((j.chips || []).length);
    $("chromeMeta").textContent = `${store.sku || deckId} · ${auth}`;
    const list = $("chipList");
    list.innerHTML = "";
    for (const c of j.chips || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip-row";
      b.innerHTML = `<span class="pos">${esc(c.pos)}</span><span class="ttl">${esc(
        c.title || "(untitled)"
      )}</span><span class="cid">${esc(c.id)}</span>`;
      b.onclick = () => openChipView(auth, deckId, c.id);
      list.appendChild(b);
    }
    await refreshTree();
  }

  async function openChipView(auth, deckId, chipId) {
    openAuth = auth;
    openDeck = deckId;
    openChip = chipId;
    const j = await api(
      `/api/chip?auth=${encodeURIComponent(auth)}&deck=${encodeURIComponent(
        deckId
      )}&chip=${encodeURIComponent(chipId)}`
    );
    if (!j.ok) {
      toast(j.error || "chip fail");
      return;
    }
    show("chip");
    const ch = (j.meta && j.meta.chip) || {};
    $("chipIdLab").textContent = ch.id || chipId;
    $("chipTitleH").textContent = ch.title || "Chip";
    $("chipPath").textContent = j.path || "";
    $("chipTitle").value = ch.title || "";
    $("chipLeaf").value = ch.leaf || "";
    $("chipBody").value = j.body || "";
    $("chromeMeta").textContent = `${ch.id} · ${auth}/${deckId}`;
  }

  async function newDeck() {
    const { ok, values } = await deskForm(
      "New deck paper",
      [
        {
          name: "leaf",
          label: "deck leaf",
          value: "Chester Myth",
          hint: "What this lore deck is — face of the paper",
        },
        {
          name: "auth",
          label: "store.auth",
          value: openAuth || "SDK808",
          hint: "Vault folder under safe_box (e.g. SDK808, LOCAL)",
        },
      ],
      "File deck"
    );
    if (!ok) return;
    const leaf = (values.leaf || "").trim() || "untitled deck";
    const auth = (values.auth || "").trim() || "LOCAL";
    const j = await api("/api/deck/create", {
      method: "POST",
      body: JSON.stringify({ auth, leaf, name: leaf }),
    });
    if (!j.ok) {
      toast(j.error || "create fail");
      return;
    }
    toast("deck paper filed");
    await openDeckView(j.auth, j.deck_id);
  }

  async function saveDeck() {
    if (!openAuth || !openDeck) return;
    const j = await api("/api/deck/save", {
      method: "POST",
      body: JSON.stringify({
        auth: openAuth,
        deck_id: openDeck,
        leaf: $("deckLeaf").value,
      }),
    });
    if (!j || !j.ok) {
      toast((j && j.error) || "save fail");
      return;
    }
    toast("deck paper saved");
    await openDeckView(openAuth, openDeck);
  }

  async function newChip() {
    if (!openAuth || !openDeck) return;
    const { ok, values } = await deskForm(
      "New chip paper",
      [
        {
          name: "title",
          label: "title",
          value: "new lore",
          hint: "Class stays on the id (lore_…) — this is the face",
        },
        {
          name: "leaf",
          label: "leaf (one-line)",
          value: "",
          hint: "Optional · defaults to title",
        },
      ],
      "File chip"
    );
    if (!ok) return;
    const title = (values.title || "").trim() || "untitled lore";
    const leaf = (values.leaf || "").trim() || title;
    const j = await api("/api/chip/create", {
      method: "POST",
      body: JSON.stringify({
        auth: openAuth,
        deck_id: openDeck,
        title,
        leaf,
      }),
    });
    if (!j.ok) {
      toast(j.error || "chip fail");
      return;
    }
    toast("chip filed · " + j.chip_id);
    await openChipView(openAuth, openDeck, j.chip_id);
  }

  async function saveChip() {
    if (!openAuth || !openDeck || !openChip) return;
    const j = await api("/api/chip/save", {
      method: "POST",
      body: JSON.stringify({
        auth: openAuth,
        deck_id: openDeck,
        chip_id: openChip,
        title: $("chipTitle").value,
        leaf: $("chipLeaf").value,
        body: $("chipBody").value,
      }),
    });
    if (!j || !j.ok) {
      toast((j && j.error) || "save fail");
      return;
    }
    toast("chip paper saved");
    openChip = (j.meta && j.meta.chip && j.meta.chip.id) || openChip;
    $("chipTitleH").textContent = $("chipTitle").value || "Chip";
  }

  async function delChip() {
    if (!openAuth || !openDeck || !openChip) return;
    const yes = await deskConfirm(
      "Delete chip?",
      "Remove this chip paper from the deck.\nNot recoverable from the bin.",
      true
    );
    if (!yes) return;
    const j = await api("/api/chip/delete", {
      method: "POST",
      body: JSON.stringify({
        auth: openAuth,
        deck_id: openDeck,
        chip_id: openChip,
      }),
    });
    if (!j.ok) {
      toast(j.error || "fail");
      return;
    }
    toast("chip removed");
    await openDeckView(openAuth, openDeck);
  }

  async function delDeck() {
    if (!openAuth || !openDeck) return;
    const yes = await deskConfirm(
      "Delete deck?",
      "Entire deck and all chips under it.\nPapers leave the safe box.",
      true
    );
    if (!yes) return;
    const j = await api("/api/deck/delete", {
      method: "POST",
      body: JSON.stringify({ auth: openAuth, deck_id: openDeck }),
    });
    if (!j.ok) {
      toast(j.error || "fail");
      return;
    }
    openAuth = openDeck = openChip = null;
    show("empty");
    $("chromeMeta").textContent = "Papers, Please · empty safe box";
    toast("deck removed");
    await refreshTree();
  }

  async function exportStore() {
    if (!openAuth || !openDeck) return;
    const j = await api("/api/export/store", {
      method: "POST",
      body: JSON.stringify({ auth: openAuth, deck_id: openDeck }),
    });
    if (!j.ok) {
      toast(j.error || "export fail");
      return;
    }
    toast("exported " + j.file);
  }

  function wire() {
    $("btnNewDeck").onclick = newDeck;
    $("btnNewDeckEmpty").onclick = newDeck;
    $("btnRefresh").onclick = () => refreshTree();
    $("btnSaveDeck").onclick = saveDeck;
    $("btnNewChip").onclick = newChip;
    $("btnSaveChip").onclick = saveChip;
    $("btnDelChip").onclick = delChip;
    $("btnDelDeck").onclick = delDeck;
    $("btnExport").onclick = exportStore;
    $("btnBackDeck").onclick = () => {
      if (openAuth && openDeck) openDeckView(openAuth, openDeck);
    };
    document.addEventListener("keydown", (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "s") {
        ev.preventDefault();
        if (!$("chipPane").hidden) saveChip();
        else if (!$("deckPane").hidden) saveDeck();
      }
    });
  }

  wire();
  refreshTree().then(() => show("empty"));
})();
