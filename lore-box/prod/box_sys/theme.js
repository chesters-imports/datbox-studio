/**
 * loreBOX theme — light (default) / dark. Same cool blue-gray base.
 * Gem menu via window.DECK_ROM_MENU_EXTRAS (Deck Host caption.js).
 */
(function () {
  var KEY = "lorebox-theme";

  function read() {
    try {
      var t = localStorage.getItem(KEY);
      return t === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function apply(theme) {
    var t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch (e) {}
  }

  function toggle() {
    apply(read() === "dark" ? "light" : "dark");
  }

  apply(read());

  window.DECK_ROM_MENU_EXTRAS = [
    {
      labelFn: function () {
        return read() === "dark" ? "Light mode" : "Dark mode";
      },
      run: toggle,
    },
  ];
})();
