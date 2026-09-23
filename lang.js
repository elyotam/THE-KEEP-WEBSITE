/* ---------------------------------------------------------------------------
   HEBREW AND ENGLISH

   Hebrew is the page. English lives in `data-en` attributes on the element that
   owns the sentence, which is the whole point of doing it this way: a
   translation cannot drift away from the line it translates, because the two
   are the same element. There is no dictionary file to keep in step, and
   nothing can be translated twice or missed.

   Four attributes are handled, and they cover everything on the page:

       data-en          the element's own markup, including any <br>
       data-en-alt      an image's alt text
       data-en-aria     an aria-label
       data-en-content  a <meta> content attribute

   The Hebrew is read out of the document on first run and kept, so switching
   back is exact rather than re-translated.

   `<title>` lives in the head, so this has to query the document rather than
   the body - a body query silently misses the one string that shows up in the
   browser tab and in search results.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  var STORE = "keep-lang";
  var root = document.documentElement;

  var PAIRS = [
    ["data-en", "html", null],
    ["data-en-alt", "attr", "alt"],
    ["data-en-aria", "attr", "aria-label"],
    ["data-en-content", "attr", "content"],
  ];

  /* the Hebrew, captured once from the document itself */
  var kept = [];
  PAIRS.forEach(function (pair) {
    var attr = pair[0];
    var kind = pair[1];
    var target = pair[2];
    var nodes = document.querySelectorAll("[" + attr + "]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      kept.push({
        el: el,
        kind: kind,
        target: target,
        he: kind === "html" ? el.innerHTML : el.getAttribute(target),
        en: el.getAttribute(attr),
      });
    }
  });

  /* The film's description is read by the player when it mounts and copied onto
     the canvas, so it is switched where it ended up rather than where it was
     written. */
  var film = document.querySelector("[data-film]");
  var filmAlt = film
    ? { he: film.getAttribute("data-alt"), en: film.getAttribute("data-en-alt") }
    : null;

  var button = document.getElementById("lang");

  function apply(lang) {
    var en = lang === "en";
    root.lang = en ? "en" : "he";
    root.dir = en ? "ltr" : "rtl";

    for (var i = 0; i < kept.length; i++) {
      var row = kept[i];
      var value = en ? row.en : row.he;
      if (value === null) continue;
      if (row.kind === "html") row.el.innerHTML = value;
      else row.el.setAttribute(row.target, value);
    }

    if (filmAlt) {
      var canvas = document.querySelector(".film-canvas");
      if (canvas) canvas.setAttribute("aria-label", en ? filmAlt.en : filmAlt.he);
    }

    if (button) {
      /* the button says what it will do, not what the page currently is */
      button.textContent = en ? "עב" : "EN";
      button.lang = en ? "he" : "en";
      button.dir = en ? "rtl" : "ltr";
    }
  }

  function stored() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "he") return q;
    try {
      var s = localStorage.getItem(STORE);
      if (s === "en" || s === "he") return s;
    } catch (e) {}
    return "he";
  }

  apply(stored());

  if (button) {
    button.addEventListener("click", function () {
      var next = root.lang === "en" ? "he" : "en";
      apply(next);
      try {
        localStorage.setItem(STORE, next);
      } catch (e) {}
      /* Hebrew and English wrap differently, so the film has to re-measure the
         captions it positions; a resize is the signal it already listens for. */
      window.dispatchEvent(new Event("resize"));
    });
  }
})();
