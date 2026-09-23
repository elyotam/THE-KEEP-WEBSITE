/* ---------------------------------------------------------------------------
   ACCESSIBILITY WIDGET

   Drop-in: include a11y.css in the head and this file at the end of the body.
   It builds its own markup, so there is nothing to paste into the page.

   To reuse it on another site, change the CONTACT block below and nothing
   else. To change the icon, replace the path inside ICON.

   It keeps its own Hebrew and English strings and watches <html lang>, so it
   follows a host page's language switch without being wired to it.
--------------------------------------------------------------------------- */

(function () {
  "use strict";

  if (window.__a11yWidget) return;
  window.__a11yWidget = true;

  /* ---- the only thing to edit when reusing this ---- */
  var CONTACT = {
    brand: "THE KEEP",
    phone: "[טלפון]",
    email: "[אימייל]",
    updated: "24.09.2026",
    demo: true, /* set false on a real site: drops the "this is a demo" line */
  };

  var STORE = "a11y-prefs";
  var SCALES = [100, 110, 120, 130];

  /* International Symbol of Access, drawn rather than fetched so the widget
     has no network dependency. */
  var ICON =
    '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
    '<circle cx="19.5" cy="5.5" r="3.2" fill="currentColor"/>' +
    '<path d="M15.6 10.2v7.4h6.2l3.8 8.2" fill="none" stroke="currentColor" ' +
    'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M15.6 13.6h5.1" fill="none" stroke="currentColor" ' +
    'stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M20.6 18.6a7.6 7.6 0 1 1-7.4-5.8" fill="none" stroke="currentColor" ' +
    'stroke-width="2.6" stroke-linecap="round"/>' +
    "</svg>";

  /* ---- the features ---- */
  var TOGGLES = [
    { key: "spacing", cls: "a11y-spacing", he: "ריווח טקסט", en: "Text spacing" },
    { key: "contrast", cls: "a11y-contrast", he: "ניגודיות גבוהה", en: "High contrast" },
    { key: "invert", cls: "a11y-invert", he: "היפוך צבעים", en: "Invert colours" },
    { key: "grayscale", cls: "a11y-grayscale", he: "גווני אפור", en: "Grayscale" },
    { key: "links", cls: "a11y-links", he: "הדגשת קישורים", en: "Highlight links" },
    { key: "headings", cls: "a11y-headings", he: "הדגשת כותרות", en: "Highlight headings" },
    { key: "readable", cls: "a11y-readable", he: "פונט קריא", en: "Readable font" },
    { key: "cursor", cls: "a11y-cursor", he: "סמן עכבר גדול", en: "Large cursor" },
    { key: "cursorHc", cls: "a11y-cursor-hc", he: "סמן בניגודיות גבוהה", en: "High contrast cursor" },
    { key: "nomotion", cls: "a11y-nomotion", he: "עצירת אנימציות", en: "Stop animations" },
    { key: "targets", cls: "a11y-targets", he: "הגדלת אזורי לחיצה", en: "Larger click areas" },
    { key: "mask", cls: null, he: "קו קריאה", en: "Reading guide" },
  ];

  var T = {
    he: {
      open: "פתיחת תפריט נגישות",
      close: "סגירת תפריט הנגישות",
      title: "נגישות",
      size: "גודל טקסט",
      bigger: "הגדלת טקסט",
      smaller: "הקטנת טקסט",
      options: "התאמות",
      reset: "איפוס כל ההתאמות",
      didReset: "כל ההתאמות אופסו",
      on: "הופעל",
      off: "כובה",
      stateTitle: "הצהרת נגישות",
      s1: "אנו משקיעים מאמצים להנגיש את האתר בהתאם להנחיות WCAG 2.1 ברמה AA, במטרה לאפשר חוויית שימוש נוחה ושוויונית לכלל המשתמשים.",
      s2: "במידה ונתקלתם בקושי או בתקלה בנושא נגישות, נשמח לקבל פנייה ולטפל בה בהקדם.",
      s3: "פנייה זמינה גם בוואטסאפ או בטופס יצירת קשר, אם קיים.",
      owner: "אחראי נגישות",
      phone: "טלפון",
      email: "אימייל",
      updated: "עודכן לאחרונה",
      demo: "זהו אתר הדגמה לתיק עבודות. פרטי הקשר כאן הם דוגמה בלבד.",
    },
    en: {
      open: "Open accessibility menu",
      close: "Close the accessibility menu",
      title: "Accessibility",
      size: "Text size",
      bigger: "Increase text size",
      smaller: "Decrease text size",
      options: "Adjustments",
      reset: "Reset all adjustments",
      didReset: "All adjustments were reset",
      on: "on",
      off: "off",
      stateTitle: "Accessibility statement",
      s1: "We work to keep this site accessible in line with WCAG 2.1 level AA, so that it can be used comfortably and equally by everyone.",
      s2: "If you run into a difficulty or a fault related to accessibility, we would like to hear about it and will address it promptly.",
      s3: "You can also reach us on WhatsApp or through the contact form, where one exists.",
      owner: "Accessibility officer",
      phone: "Phone",
      email: "Email",
      updated: "Last updated",
      demo: "This is a portfolio demonstration. The contact details here are placeholders.",
    },
  };

  var state = { scale: 0 };
  TOGGLES.forEach(function (t) {
    state[t.key] = false;
  });

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return;
      var saved = JSON.parse(raw);
      Object.keys(state).forEach(function (k) {
        if (typeof saved[k] === typeof state[k]) state[k] = saved[k];
      });
    } catch (e) {}
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (e) {}
  }

  function lang() {
    return document.documentElement.lang === "en" ? "en" : "he";
  }

  function t(key) {
    return T[lang()][key];
  }

  /* ---- the markup ---- */
  var root = document.createElement("div");
  root.className = "a11y-root";
  root.innerHTML =
    '<button class="a11y-fab" type="button" aria-expanded="false" aria-controls="a11y-panel">' +
    ICON +
    "</button>" +
    '<div class="a11y-panel" id="a11y-panel" role="dialog" aria-modal="true" ' +
    'aria-labelledby="a11y-title" data-open="false">' +
    '<div class="a11y-head"><h2 id="a11y-title"></h2>' +
    '<button class="a11y-x" type="button">&#215;</button></div>' +
    '<div class="a11y-body">' +
    '<div class="a11y-group"><h3 data-l="size"></h3>' +
    '<div class="a11y-step">' +
    '<button type="button" data-step="-1">&#8722;</button>' +
    "<output>100%</output>" +
    '<button type="button" data-step="1">+</button>' +
    "</div></div>" +
    '<div class="a11y-group"><h3 data-l="options"></h3>' +
    '<div class="a11y-grid"></div></div>' +
    '<button class="a11y-reset" type="button"></button>' +
    '<div class="a11y-note"></div>' +
    "</div></div>" +
    '<div class="a11y-live" role="status" aria-live="polite"></div>';

  var fab = root.querySelector(".a11y-fab");
  var panel = root.querySelector(".a11y-panel");
  var grid = root.querySelector(".a11y-grid");
  var out = root.querySelector("output");
  var live = root.querySelector(".a11y-live");
  var note = root.querySelector(".a11y-note");
  var resetBtn = root.querySelector(".a11y-reset");
  var minus = root.querySelector('[data-step="-1"]');
  var plus = root.querySelector('[data-step="1"]');

  TOGGLES.forEach(function (item) {
    var b = document.createElement("button");
    b.className = "a11y-toggle";
    b.type = "button";
    b.dataset.key = item.key;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = '<span class="a11y-label"></span><span class="a11y-sw" aria-hidden="true"></span>';
    grid.appendChild(b);
  });

  /* the layer the colour effects are painted on, and the reading guide */
  var tint = document.createElement("div");
  tint.className = "a11y-tint";
  tint.setAttribute("aria-hidden", "true");

  var mask = document.createElement("div");
  mask.className = "a11y-mask";
  mask.setAttribute("aria-hidden", "true");
  mask.style.display = "none";
  mask.style.top = "40%";

  document.body.appendChild(tint);
  document.body.appendChild(mask);
  document.body.appendChild(root);

  /* ---- applying the state ---- */
  function apply(announce) {
    var html = document.documentElement;

    html.style.fontSize = state.scale ? SCALES[state.scale] + "%" : "";
    out.textContent = SCALES[state.scale] + "%";
    minus.disabled = state.scale === 0;
    plus.disabled = state.scale === SCALES.length - 1;

    TOGGLES.forEach(function (item) {
      if (item.cls) html.classList.toggle(item.cls, state[item.key]);
      var b = grid.querySelector('[data-key="' + item.key + '"]');
      b.setAttribute("aria-pressed", String(state[item.key]));
    });

    var filters = [];
    if (state.grayscale) filters.push("grayscale(1)");
    if (state.contrast) filters.push("contrast(1.45)");
    if (state.invert) filters.push("invert(1) hue-rotate(180deg)");
    tint.style.setProperty("--a11y-tint", filters.length ? filters.join(" ") : "none");
    tint.style.display = filters.length ? "" : "none";

    mask.style.display = state.mask ? "" : "none";

    if (announce) live.textContent = announce;
    save();
  }

  /* ---- language ---- */
  function paint() {
    var L = lang();
    root.dir = L === "en" ? "ltr" : "rtl";
    fab.setAttribute("aria-label", t("open"));
    fab.title = t("open");
    root.querySelector("#a11y-title").textContent = t("title");
    root.querySelector(".a11y-x").setAttribute("aria-label", t("close"));
    root.querySelector('[data-l="size"]').textContent = t("size");
    root.querySelector('[data-l="options"]').textContent = t("options");
    minus.setAttribute("aria-label", t("smaller"));
    plus.setAttribute("aria-label", t("bigger"));
    resetBtn.textContent = t("reset");

    TOGGLES.forEach(function (item) {
      grid.querySelector('[data-key="' + item.key + '"] .a11y-label').textContent = item[L];
    });

    note.innerHTML =
      "<h3></h3><p class='p1'></p><p class='p2'></p><p class='p3'></p>" +
      "<dl><dt class='d1'></dt><dd class='v1'></dd>" +
      "<dt class='d2'></dt><dd class='v2'></dd>" +
      "<dt class='d3'></dt><dd class='v3'></dd>" +
      "<dt class='d4'></dt><dd class='v4'></dd></dl>" +
      (CONTACT.demo ? "<p class='a11y-demo'></p>" : "");
    note.querySelector("h3").textContent = t("stateTitle");
    note.querySelector(".p1").textContent = t("s1");
    note.querySelector(".p2").textContent = t("s2");
    note.querySelector(".p3").textContent = t("s3");
    note.querySelector(".d1").textContent = t("owner");
    note.querySelector(".v1").textContent = CONTACT.brand;
    note.querySelector(".d2").textContent = t("phone");
    note.querySelector(".v2").textContent = CONTACT.phone;
    note.querySelector(".d3").textContent = t("email");
    note.querySelector(".v3").textContent = CONTACT.email;
    note.querySelector(".d4").textContent = t("updated");
    note.querySelector(".v4").textContent = CONTACT.updated;
    if (CONTACT.demo) note.querySelector(".a11y-demo").textContent = t("demo");
  }

  new MutationObserver(paint).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });

  /* ---- opening and closing ---- */
  var lastFocus = null;

  function focusable() {
    return [].slice
      .call(panel.querySelectorAll("button:not(:disabled)"))
      .filter(function (el) {
        return el.offsetParent !== null;
      });
  }

  function open() {
    lastFocus = document.activeElement;
    panel.dataset.open = "true";
    fab.setAttribute("aria-expanded", "true");
    var f = focusable();
    if (f.length) f[0].focus();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onOutside, true);
  }

  function close() {
    panel.dataset.open = "false";
    fab.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onOutside, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    else fab.focus();
  }

  function isOpen() {
    return panel.dataset.open === "true";
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    var f = focusable();
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    var here = document.activeElement;
    if (e.shiftKey && (here === first || !panel.contains(here))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && here === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onOutside(e) {
    if (!panel.contains(e.target) && e.target !== fab && !fab.contains(e.target)) close();
  }

  fab.addEventListener("click", function () {
    if (isOpen()) close();
    else open();
  });
  root.querySelector(".a11y-x").addEventListener("click", close);

  /* ---- the controls ---- */
  grid.addEventListener("click", function (e) {
    var b = e.target.closest(".a11y-toggle");
    if (!b) return;
    var key = b.dataset.key;
    state[key] = !state[key];
    var item = TOGGLES.filter(function (x) {
      return x.key === key;
    })[0];
    apply(item[lang()] + " " + (state[key] ? t("on") : t("off")));
  });

  minus.addEventListener("click", function () {
    if (state.scale > 0) {
      state.scale--;
      apply(t("size") + " " + SCALES[state.scale] + "%");
    }
  });

  plus.addEventListener("click", function () {
    if (state.scale < SCALES.length - 1) {
      state.scale++;
      apply(t("size") + " " + SCALES[state.scale] + "%");
    }
  });

  resetBtn.addEventListener("click", function () {
    state.scale = 0;
    TOGGLES.forEach(function (item) {
      state[item.key] = false;
    });
    try {
      localStorage.removeItem(STORE);
    } catch (e) {}
    apply(t("didReset"));
  });

  /* the reading guide follows the pointer, on an animation frame rather than
     on every mousemove */
  var maskY = null;
  var queued = false;
  document.addEventListener(
    "pointermove",
    function (e) {
      if (!state.mask) return;
      maskY = e.clientY;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        mask.style.top = Math.max(0, maskY - mask.offsetHeight / 2) + "px";
      });
    },
    { passive: true }
  );

  load();
  paint();
  apply();
})();
