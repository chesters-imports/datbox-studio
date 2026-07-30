/* sonaBOX · CO.DBS-SONA */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let vault = null;
  let tab = "kven";

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.hidden = true;
    }, 2200);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Real-ish MD: tables, headers, hard breaks, bold, code, fences */
  function renderMd(src) {
    const text = String(src ?? "").replace(/\r\n/g, "\n");
    if (!text.trim()) return "<p class=\"md-mute\">empty leaf</p>";
    const lines = text.split("\n");
    const out = [];
    let i = 0;
    let inCode = false;
    let codeBuf = [];

    const flushCode = () => {
      if (!codeBuf.length && !inCode) return;
      out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
      codeBuf = [];
    };

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith("```")) {
        if (inCode) {
          flushCode();
          inCode = false;
        } else {
          inCode = true;
          codeBuf = [];
        }
        i++;
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        i++;
        continue;
      }

      // GFM table block
      if (
        line.includes("|") &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:\-|]+ \|?/.test(lines[i + 1])
      ) {
        const rows = [];
        while (i < lines.length && lines[i].includes("|")) {
          rows.push(lines[i]);
          i++;
        }
        if (rows.length >= 2) {
          const parseRow = (r) =>
            r
              .trim()
              .replace(/^\|/, "")
              .replace(/\|$/, "")
              .split("|")
              .map((c) => c.trim());
          const head = parseRow(rows[0]);
          const bodyRows = rows.slice(2).map(parseRow);
          let html = "<table><thead><tr>";
          head.forEach((c) => {
            html += `<th>${inline(c)}</th>`;
          });
          html += "</tr></thead><tbody>";
          bodyRows.forEach((cells) => {
            html += "<tr>";
            cells.forEach((c) => {
              html += `<td>${inline(c)}</td>`;
            });
            html += "</tr>";
          });
          html += "</tbody></table>";
          out.push(html);
          continue;
        }
      }

      const h = line.match(/^(#{1,3})\s+(.+)$/);
      if (h) {
        const n = h[1].length;
        out.push(`<div class="md-h md-h${n}">${inline(h[2])}</div>`);
        i++;
        continue;
      }
      if (line.trim() === "") {
        out.push('<div class="md-blank" aria-hidden="true"></div>');
        i++;
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        out.push(`<p>· ${inline(line.replace(/^[-*]\s+/, ""))}</p>`);
        i++;
        continue;
      }
      out.push(`<p>${inline(line)}</p>`);
      i++;
    }
    if (inCode) flushCode();
    return out.join("");
  }

  function inline(s) {
    let t = esc(s);
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return t;
  }

  async function api(path, opts) {
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || r.statusText);
    return j;
  }

  async function loadVaults() {
    const j = await api("/api/vaults");
    const list = $("vaultList");
    list.innerHTML = (j.vaults || [])
      .map(
        (v) =>
          `<button type="button" class="sb-vault ${
            vault === v.CHIP ? "is-on" : ""
          }" data-chip="${esc(v.CHIP)}">` +
          `<span>${esc(v.TITLE)}</span>` +
          `<small>${esc(v.CHIP)} · ${esc(v.KIND)}</small>` +
          `</button>`
      )
      .join("");
    list.querySelectorAll(".sb-vault").forEach((btn) => {
      btn.onclick = () => {
        vault = btn.getAttribute("data-chip");
        loadVaults();
        refreshTab();
        $("hint").textContent = "vault " + vault;
      };
    });
    if (!vault && j.vaults && j.vaults[0]) {
      vault = j.vaults[0].CHIP;
      loadVaults();
      refreshTab();
    }
  }

  async function refreshTab() {
    if (!vault) return;
    if (tab === "kven") await loadKven();
    if (tab === "leaves") await loadLeaves();
    if (tab === "notches") await loadNotches();
  }

  async function loadKven() {
    const j = await api("/api/kven?vault=" + encodeURIComponent(vault));
    const list = $("kvenList");
    list.innerHTML = (j.items || [])
      .map(
        (it) =>
          `<button type="button" class="sb-item" data-k="${esc(it.KVEN)}">` +
          `<span class="k">${esc(it.KVEN)}</span> ` +
          `<span>${esc(it.ALTS || "")}</span>` +
          `<div class="m">${esc(it.TYPE || "")} ${esc(it.LABEL || "")}</div>` +
          `</button>`
      )
      .join("") || '<div class="m">no beings yet</div>';
    list.querySelectorAll(".sb-item").forEach((btn) => {
      btn.onclick = () => {
        const k = btn.getAttribute("data-k");
        const it = (j.items || []).find((x) => x.KVEN === k);
        $("readTitle").textContent = k;
        $("readBody").innerHTML = renderMd(
          `**${k}**\n\n` +
            `| field | value |\n| --- | --- |\n` +
            `| ALTS | ${it?.ALTS || ""} |\n` +
            `| LABEL | ${it?.LABEL || ""} |\n` +
            `| MATCHES | ${it?.MATCHES || ""} |\n` +
            `| TYPE | ${it?.TYPE || ""} |\n` +
            `| NOTES | ${it?.NOTES || ""} |\n`
        );
      };
    });
  }

  async function loadLeaves() {
    const j = await api("/api/leaves?vault=" + encodeURIComponent(vault));
    const list = $("leafList");
    list.innerHTML = (j.items || [])
      .map(
        (it) =>
          `<button type="button" class="sb-item" data-c="${esc(it.CHIP)}">` +
          `<span class="k">${esc(it.CHIP)}</span> ${esc(it.TITLE)}` +
          `<div class="m">${esc(it.PAYLOAD_KIND)} · ${esc(it.PRODUCER || "")} ${esc(
            it.PRODUCER_VER || ""
          )}</div>` +
          `</button>`
      )
      .join("") || '<div class="m">no leaves yet</div>';
    list.querySelectorAll(".sb-item").forEach((btn) => {
      btn.onclick = () => {
        const c = btn.getAttribute("data-c");
        const it = (j.items || []).find((x) => x.CHIP === c);
        $("readTitle").textContent = it?.TITLE || c;
        $("readBody").innerHTML = renderMd(it?.BODY || "");
      };
    });
  }

  async function loadNotches() {
    const j = await api("/api/notches?vault=" + encodeURIComponent(vault));
    const list = $("notchList");
    list.innerHTML = (j.items || [])
      .map(
        (it) =>
          `<div class="sb-item">` +
          `<span class="k">${esc(it.FROM_CHIP)}</span> → ` +
          `<span class="k">${esc(it.TO_CHIP)}</span>` +
          `<div class="m">${esc(it.KIND)} · ${esc(it.NOTCH_CHIP)}</div>` +
          `</div>`
      )
      .join("") || '<div class="m">no notches yet</div>';
  }

  document.querySelectorAll(".sb-tabs button").forEach((btn) => {
    btn.onclick = () => {
      tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".sb-tabs button").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
      });
      $("panelKven").hidden = tab !== "kven";
      $("panelLeaves").hidden = tab !== "leaves";
      $("panelNotches").hidden = tab !== "notches";
      refreshTab().catch((e) => toast(e.message));
    };
  });

  $("formVault").onsubmit = async (ev) => {
    ev.preventDefault();
    const title = $("vaultTitle").value.trim();
    if (!title) return;
    try {
      const j = await api("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ TITLE: title, KIND: "NARRATIVE" }),
      });
      vault = j.vault.CHIP;
      $("vaultTitle").value = "";
      await loadVaults();
      toast("vault " + vault);
    } catch (e) {
      toast(e.message);
    }
  };

  $("formKven").onsubmit = async (ev) => {
    ev.preventDefault();
    if (!vault) return toast("pick a vault");
    try {
      const j = await api("/api/kven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault,
          KVEN: $("kvenCode").value.trim(),
          ALTS: $("kvenAlts").value.trim(),
          LABEL: $("kvenLabel").value.trim(),
          TYPE: $("kvenType").value.trim(),
        }),
      });
      $("kvenCode").value = "";
      toast("KVEN " + j.KVEN);
      await loadKven();
    } catch (e) {
      toast(e.message);
    }
  };

  $("formLeaf").onsubmit = async (ev) => {
    ev.preventDefault();
    if (!vault) return toast("pick a vault");
    try {
      const j = await api("/api/leaf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault,
          TITLE: $("leafTitle").value.trim() || "untitled",
          BODY: $("leafBody").value,
          PAYLOAD_KIND: "MD",
          SYSTEM: "DATBOX",
          DOMINION: "",
        }),
      });
      toast("leaf " + j.CHIP);
      $("leafTitle").value = "";
      $("leafBody").value = "";
      await loadLeaves();
    } catch (e) {
      toast(e.message);
    }
  };

  $("formNotch").onsubmit = async (ev) => {
    ev.preventDefault();
    if (!vault) return toast("pick a vault");
    try {
      await api("/api/notch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault,
          FROM_CHIP: $("notchFrom").value.trim(),
          TO_CHIP: $("notchTo").value.trim(),
          KIND: $("notchKind").value.trim() || "ABOUT",
        }),
      });
      toast("notched");
      await loadNotches();
    } catch (e) {
      toast(e.message);
    }
  };

  loadVaults().catch((e) => {
    $("hint").textContent = "server down";
    toast(e.message);
  });
})();
