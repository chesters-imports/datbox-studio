/**
 * loreBOX appearance — theme (light / dark / system) + desk prefs cache.
 * Authoritative prefs: box_sets/desk_prefs.json via /api/prefs
 * localStorage is a FOUC cache only.
 */
(function () {
  var CACHE_KEY = "lorebox-desk-prefs-v1";
  var mq =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return { theme: "system", safe_compact: false };
      var o = JSON.parse(raw);
      return {
        theme: normalizeTheme(o.theme),
        safe_compact: !!o.safe_compact,
        window_mode: normalizeWindowMode(o.window_mode),
      };
    } catch (e) {
      return {
        theme: "system",
        safe_compact: false,
        window_mode: "standard",
      };
    }
  }

  function normalizeWindowMode(m) {
    m = String(m || "standard").toLowerCase();
    if (m === "maximized" || m === "maximize" || m === "max") return "maximized";
    if (m === "expanded" || m === "large" || m === "wide") return "expanded";
    if (m === "compact" || m === "mini" || m === "short") return "compact";
    return "standard";
  }

  function writeCache(prefs) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          theme: normalizeTheme(prefs.theme),
          safe_compact: !!prefs.safe_compact,
          window_mode: normalizeWindowMode(prefs.window_mode),
        })
      );
    } catch (e) {}
  }

  function normalizeTheme(t) {
    t = String(t || "system").toLowerCase();
    if (t === "light" || t === "dark" || t === "system") return t;
    return "system";
  }

  function resolvedTheme(mode) {
    mode = normalizeTheme(mode);
    if (mode === "light" || mode === "dark") return mode;
    if (mq && mq.matches) return "dark";
    return "light";
  }

  function applyThemeMode(mode) {
    var t = resolvedTheme(mode);
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.setAttribute("data-theme-mode", normalizeTheme(mode));
    return t;
  }

  function applyPrefs(prefs) {
    prefs = prefs || readCache();
    var mode = normalizeTheme(prefs.theme);
    var wmode = normalizeWindowMode(prefs.window_mode);
    applyThemeMode(mode);
    writeCache({
      theme: mode,
      safe_compact: !!prefs.safe_compact,
      window_mode: wmode,
    });
    if (typeof window.__loreApplyDensity === "function") {
      window.__loreApplyDensity(!!prefs.safe_compact);
    }
    return {
      theme: mode,
      safe_compact: !!prefs.safe_compact,
      window_mode: wmode,
    };
  }

  // FOUC: apply cache immediately
  applyPrefs(readCache());

  if (mq) {
    var onScheme = function () {
      var mode = normalizeTheme(readCache().theme);
      if (mode === "system") applyThemeMode("system");
    };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  window.LoreTheme = {
    readCache: readCache,
    writeCache: writeCache,
    normalizeTheme: normalizeTheme,
    normalizeWindowMode: normalizeWindowMode,
    resolvedTheme: resolvedTheme,
    applyThemeMode: applyThemeMode,
    applyPrefs: applyPrefs,
  };
})();
