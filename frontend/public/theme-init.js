/*
 * Runs before first paint to eliminate the theme flash on reload. It replays
 * the scheme cached by the app, falling back to the CSS defaults.
 *
 * Kept as an external file (not inline in index.html) so the Content-Security
 * Policy can use script-src 'self' with no inline-script exception.
 */
(function () {
  var root = document.documentElement;
  try {
    var state = JSON.parse(localStorage.getItem("dtt:theme") || "{}");
    var mode = state.mode || "system";
    var dark = mode === "dark" || (mode !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    var resolved = dark ? "dark" : "light";
    var css = JSON.parse(localStorage.getItem("dtt:scheme") || "null");
    if (css && typeof css === "object") {
      for (var role in css) {
        if (typeof css[role] === "string") {
          root.style.setProperty("--md-" + role, css[role]);
        }
      }
    }
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  } catch (e) {
    /* ignore: the stylesheet fallback already themes the first paint */
  }
})();
