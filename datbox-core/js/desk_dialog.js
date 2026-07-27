/**
 * datbox-core · desk dialogs
 * Designed in-app modals for all DATBOX ROMs — never window.confirm / alert / prompt.
 *
 * Usage (after script load):
 *   DatboxDesk.configure({ brandHtml: "lore<strong>BOX</strong>" });
 *   const ok = await DatboxDesk.confirm({ title, body, danger: true });
 *   await DatboxDesk.alert({ title, body });
 *   const { ok, values } = await DatboxDesk.form({ title, fields, okLabel });
 */
(function (global) {
  "use strict";

  const cfg = {
    brandHtml: "DAT<strong>BOX</strong>",
    zIndex: 200,
  };

  let host = null;
  let busy = false;

  function configure(opts) {
    if (!opts || typeof opts !== "object") return;
    if (opts.brandHtml != null) cfg.brandHtml = String(opts.brandHtml);
    if (opts.brand != null && opts.brandHtml == null) {
      cfg.brandHtml = escapeHtml(String(opts.brand));
    }
    if (typeof opts.zIndex === "number") cfg.zIndex = opts.zIndex;
    if (host) {
      const chip = host.querySelector(".dd-chip");
      if (chip) chip.innerHTML = cfg.brandHtml;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bodyToHtml(body) {
    if (body == null) return "";
    if (typeof body === "string") {
      return body
        .split(/\n+/)
        .filter((p) => p.length)
        .map((p) => '<p class="dd-p">' + escapeHtml(p) + "</p>")
        .join("");
    }
    if (Array.isArray(body)) {
      return body
        .map((p) => '<p class="dd-p">' + escapeHtml(String(p)) + "</p>")
        .join("");
    }
    return '<p class="dd-p">' + escapeHtml(String(body)) + "</p>";
  }

  function ensureHost() {
    if (host && document.body.contains(host)) return host;
    host = document.createElement("div");
    host.id = "datbox-desk-dialog-host";
    host.className = "dd-host";
    host.hidden = true;
    host.innerHTML =
      '<div class="dd-overlay" data-dd-overlay>' +
      '  <div class="dd-dlg" role="dialog" aria-modal="true" aria-labelledby="dd-title">' +
      '    <header class="dd-chrome" data-dd-chrome>' +
      '      <span class="dd-chip chip">' +
      cfg.brandHtml +
      "</span>" +
      '      <span class="dd-title" id="dd-title"></span>' +
      "    </header>" +
      '    <div class="dd-body" id="dd-body"></div>' +
      '    <footer class="dd-actions" id="dd-actions"></footer>' +
      "  </div>" +
      "</div>";
    document.body.appendChild(host);
    return host;
  }

  function enableDrag(dlg) {
    const handle = dlg.querySelector("[data-dd-chrome]");
    if (!handle) return function () {};
    let ox = 0;
    let oy = 0;
    let dragging = false;

    function onDown(e) {
      if (e.button !== 0) return;
      if (e.target.closest("button, input, a, select, textarea")) return;
      dragging = true;
      const rect = dlg.getBoundingClientRect();
      dlg.style.position = "fixed";
      dlg.style.margin = "0";
      dlg.style.left = rect.left + "px";
      dlg.style.top = rect.top + "px";
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
      dlg.style.left = x + "px";
      dlg.style.top = y + "px";
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("dragging");
    }
    handle.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return function () {
      handle.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      handle.classList.remove("dragging");
    };
  }

  function openShell({ title, bodyHtml, actions, danger, onMount }) {
    return new Promise((resolve) => {
      if (busy) {
        // queue: reject second modal (shouldn't happen in normal UI)
        resolve({ ok: false, reason: "busy" });
        return;
      }
      busy = true;
      const root = ensureHost();
      const overlay = root.querySelector("[data-dd-overlay]");
      const dlg = root.querySelector(".dd-dlg");
      const titleEl = root.querySelector("#dd-title");
      const bodyEl = root.querySelector("#dd-body");
      const actionsEl = root.querySelector("#dd-actions");
      const chip = root.querySelector(".dd-chip");
      if (chip) chip.innerHTML = cfg.brandHtml;

      titleEl.textContent = title || "Notice";
      bodyEl.innerHTML = bodyHtml || "";
      actionsEl.innerHTML = "";
      dlg.classList.toggle("dd-danger", !!danger);

      dlg.style.position = "";
      dlg.style.left = "";
      dlg.style.top = "";
      dlg.style.right = "";
      dlg.style.margin = "";
      dlg.style.transform = "";

      const stopDrag = enableDrag(dlg);
      const buttons = [];

      function cleanup(result) {
        stopDrag();
        root.hidden = true;
        root.onkeydown = null;
        busy = false;
        resolve(result);
      }

      for (const a of actions || []) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "btn " +
          (a.primary ? (danger ? "dd-btn-danger" : "cta-new") : "linkish");
        btn.textContent = a.label || "OK";
        btn.addEventListener("click", () => {
          if (a.collect) {
            cleanup(a.collect());
          } else {
            cleanup(a.result != null ? a.result : { ok: !!a.ok });
          }
        });
        actionsEl.appendChild(btn);
        buttons.push({ def: a, el: btn });
      }

      root.onkeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          const cancel = buttons.find((b) => b.def.cancel);
          if (cancel) cancel.el.click();
          else cleanup({ ok: false });
        }
        if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") {
          e.preventDefault();
          const primary = buttons.find((b) => b.def.primary);
          if (primary) primary.el.click();
        }
      };

      root.hidden = false;
      if (onMount) onMount({ bodyEl, dlg, cleanup });

      // focus primary or first focusable
      const focusPrimary = buttons.find((b) => b.def.primary);
      const focusCancel = buttons.find((b) => b.def.cancel);
      const prefer = danger ? focusCancel || focusPrimary : focusPrimary || focusCancel;
      if (prefer) prefer.el.focus();
      else {
        const input = bodyEl.querySelector("input:not([readonly])");
        if (input) input.focus();
      }
    });
  }

  /**
   * Confirm — returns true if user accepts.
   * @param {{ title?: string, body?: string|string[], okLabel?: string, cancelLabel?: string, danger?: boolean }} opts
   */
  async function confirm(opts) {
    opts = opts || {};
    const r = await openShell({
      title: opts.title || "Confirm",
      bodyHtml: bodyToHtml(opts.body || "Are you sure?"),
      danger: !!opts.danger,
      actions: [
        {
          label: opts.cancelLabel || "Cancel",
          cancel: true,
          ok: false,
          result: { ok: false },
        },
        {
          label: opts.okLabel || "OK",
          primary: true,
          ok: true,
          result: { ok: true },
        },
      ],
    });
    return !!(r && r.ok);
  }

  /**
   * Alert — returns when dismissed.
   */
  async function alert(opts) {
    opts = opts || {};
    await openShell({
      title: opts.title || "Notice",
      bodyHtml: bodyToHtml(opts.body || ""),
      danger: !!opts.danger,
      actions: [
        {
          label: opts.okLabel || "OK",
          primary: true,
          ok: true,
          result: { ok: true },
        },
      ],
    });
  }

  /**
   * Form dialog — returns { ok, values } (same shape as lore openDialog).
   * fields: [{ name, label, value, hint, type, readonly }]
   */
  function form(opts) {
    opts = opts || {};
    const fields = opts.fields || [];
    let inputs = {};

    return openShell({
      title: opts.title || "Dialog",
      bodyHtml: "",
      danger: !!opts.danger,
      actions: [
        {
          label: opts.cancelLabel || "Cancel",
          cancel: true,
          result: { ok: false },
        },
        {
          label: opts.okLabel || "OK",
          primary: true,
          collect: () => {
            const values = {};
            for (const f of fields) {
              values[f.name] = inputs[f.name] ? inputs[f.name].value : "";
            }
            return { ok: true, values, inputs };
          },
        },
      ],
      onMount({ bodyEl }) {
        bodyEl.innerHTML = "";
        inputs = {};
        for (const f of fields) {
          const wrap = document.createElement("div");
          wrap.className = "field dd-field";
          const lab = document.createElement("span");
          lab.textContent = f.label || f.name;
          const input = document.createElement("input");
          input.type = f.type || "text";
          input.value = f.value != null ? String(f.value) : "";
          input.autocomplete = "off";
          if (f.readonly) input.readOnly = true;
          wrap.appendChild(lab);
          wrap.appendChild(input);
          if (f.hint) {
            const h = document.createElement("p");
            h.className = "dd-hint dlg-hint";
            h.textContent = f.hint;
            wrap.appendChild(h);
          }
          bodyEl.appendChild(wrap);
          inputs[f.name] = input;
        }
        if (opts.onMount) opts.onMount(inputs);
        const first = fields.find((f) => !f.readonly);
        if (first && inputs[first.name]) inputs[first.name].focus();
      },
    });
  }

  global.DatboxDesk = {
    configure: configure,
    confirm: confirm,
    alert: alert,
    form: form,
    /** @deprecated alias */
    openDialog: form,
  };
})(typeof window !== "undefined" ? window : globalThis);
