/* ---------------------------------------------------------------------------
   THE KEEP: page behaviour

   Four small things, and deliberately nothing else: mount the film, reveal
   sections once as they arrive, solidify the masthead once the film is behind
   you, and open the demo notice.

   Every one of them is driven by an IntersectionObserver or a single passive
   scroll flag, so none of them reads layout while the film is scrubbing.
--------------------------------------------------------------------------- */

import { mountFilm } from "./film.js";

const film = document.querySelector("[data-film]");
const boot = document.getElementById("boot");

if (film) {
  mountFilm(film, { loader: boot });
} else if (boot) {
  boot.dataset.done = "true";
}

/* --- reveal on entry, once ------------------------------------------------ */

const targets = document.querySelectorAll("[data-reveal]");

if (!("IntersectionObserver" in window)) {
  targets.forEach((el) => (el.dataset.seen = "true"));
} else {
  const seen = new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.seen = "true";
        self.unobserve(entry.target);
      }
    },
    /* a little before the element is fully in view, so the motion finishes
       while the reader is still arriving at it rather than after */
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );
  targets.forEach((el, i) => {
    /* a short stagger between siblings in the same block: enough to read as
       deliberate, not enough to wait for */
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    seen.observe(el);
  });
}

/* --- the masthead only takes a background once the film is behind you ----- */

const masthead = document.getElementById("masthead");

if (masthead && film && "IntersectionObserver" in window) {
  /* watched through a sentinel rather than the scroll position, so nothing is
     measured on the scroll thread */
  const mark = document.createElement("div");
  mark.setAttribute("aria-hidden", "true");
  mark.style.cssText = "position:absolute;bottom:0;left:0;width:1px;height:1px";
  film.appendChild(mark);

  new IntersectionObserver(
    ([entry]) => {
      masthead.dataset.solid = String(!entry.isIntersecting);
    },
    { threshold: 0 }
  ).observe(mark);
} else if (masthead) {
  masthead.dataset.solid = "true";
}

/* --- the demo notice ------------------------------------------------------
   A <dialog> rather than a hand-built overlay, so the focus trap, the escape
   key and the inertness of the page behind it are the browser's job. */

const notice = document.getElementById("notice");
const enter = document.getElementById("enter");

if (notice && enter) {
  const supported = typeof notice.showModal === "function";

  enter.addEventListener("click", () => {
    if (supported) notice.showModal();
    else notice.setAttribute("open", "");
  });

  notice.addEventListener("click", (event) => {
    /* the card is the only thing inside, so a click that lands on the dialog
       itself landed on the backdrop */
    if (event.target === notice) close();
    if (event.target.closest("[data-close]")) close();
  });

  function close() {
    if (supported) notice.close();
    else notice.removeAttribute("open");
  }
}
