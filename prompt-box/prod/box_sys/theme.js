/**
 * promptBOX appearance ? same prefs cache law as lore (per-ROM desk_prefs).
 */
(function () {
  var CACHE_KEY = "promptbox-desk-prefs-v1";
  var mq =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function normalizeTheme(t) {
    t = String(t || "system").toLowerCase();
    return t === "light" || t === "dark" || t === "system" ? t : "system";
  }

  function readCache() {
    try {
      var o = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return {
        theme: normalizeTheme(o.theme),
        safe_compact: !!o.safe_compact,
        window_mode: o.window_mode || "standard",
      };
    } catch (e) {
      return { theme: "system", safe_compact: false, window_mode: "standard" };
    }
  }

  function writeCache(prefs) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  function resolvedTheme(mode) {
    mode = normalizeTheme(mode);
    if (mode === "light" || mode === "dark") return mode;
    return mq && mq.matches ? "dark" : "light";
  }

  function applyPrefs(prefs) {
    prefs = prefs || readCache();
    var mode = normalizeTheme(prefs.theme);
    document.documentElement.setAttribute("data-theme", resolvedTheme(mode));
    document.documentElement.setAttribute("data-theme-mode", mode);
    writeCache({
      theme: mode,
      safe_compact: !!prefs.safe_compact,
      window_mode: prefs.window_mode || "standard",
    });
    if (typeof window.__promptApplyDensity === "function") {
      window.__promptApplyDensity(!!prefs.safe_compact);
    }
    return prefs;
  }

  applyPrefs(readCache());
  if (mq) {
    var on = function () {
      if (normalizeTheme(readCache().theme) === "system") applyPrefs(readCache());
    };
    if (mq.addEventListener) mq.addEventListener("change", on);
    else if (mq.addListener) mq.addListener(on);
  }

  window.PromptTheme = {
    readCache: readCache,
    applyPrefs: applyPrefs,
    normalizeTheme: normalizeTheme,
  };
})();
