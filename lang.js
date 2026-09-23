/* =============================================================================
   HEBREW AND ENGLISH

   Hebrew is what the HTML ships with, so the page is right before a single line
   of script has run. English lives next to it, in a data-en attribute on the
   element that owns the text, which means a translation can never drift away
   from the sentence it belongs to - the usual failure of a separate dictionary
   keyed by made-up names.

   Switching swaps the text, flips the document to LTR and remembers the choice.
   It does not reload: nothing on this site is built from the text at boot.
   ============================================================================= */
(function () {
  var html = document.documentElement;

  function preferred() {
    var fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl === "en" || fromUrl === "he") return fromUrl;
    try {
      var stored = localStorage.getItem("ng-lang");
      if (stored === "en" || stored === "he") return stored;
    } catch (e) {
      /* storage blocked; Hebrew it is */
    }
    return "he";
  }

  function apply(lang) {
    var nodes = document.querySelectorAll("[data-en]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      /* the Hebrew is kept on first use, so switching back is exact */
      if (el.dataset.he === undefined) el.dataset.he = el.textContent.trim();
      el.textContent = lang === "en" ? el.dataset.en : el.dataset.he;
    }
    html.lang = lang;
    html.dir = lang === "en" ? "ltr" : "rtl";

    var buttons = document.querySelectorAll(".lang button");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].setAttribute("aria-pressed", String(buttons[j].dataset.lang === lang));
    }

    /* the film is pinned by scroll position, and the page's height changes with
       its language: without this the footage and the page fall out of step */
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".lang button");
    if (!b) return;
    var lang = b.dataset.lang;
    try {
      localStorage.setItem("ng-lang", lang);
    } catch (err) {
      /* nothing to remember it with, which only costs the next visit */
    }
    apply(lang);
  });

  apply(preferred());
})();
