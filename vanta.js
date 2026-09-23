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

/* --- the reticle ----------------------------------------------------------
   An element rather than a cursor image, because a cursor image is one bitmap
   the compositor draws and can never react to what is underneath it. This one
   opens up over headings and turns amber over anything that can be clicked.

   It costs nothing while the film is scrubbing: the loop only runs while the
   reticle is still catching up with the pointer, and it writes one transform
   per frame and nothing else. A scroll does not move the pointer, so during a
   scrub the loop is asleep. */

const FINE = window.matchMedia("(hover: hover) and (pointer: fine)");

if (FINE.matches) {
  const el = document.createElement("div");
  el.className = "reticle";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<svg viewBox="0 0 100 100">' +
    '<circle class="reticle__ring" cx="50" cy="50" r="15"/>' +
    '<g transform="rotate(0 50 50)"><line class="reticle__tick" x1="50" y1="23" x2="50" y2="29"/></g>' +
    '<g transform="rotate(90 50 50)"><line class="reticle__tick" x1="50" y1="23" x2="50" y2="29"/></g>' +
    '<g transform="rotate(180 50 50)"><line class="reticle__tick" x1="50" y1="23" x2="50" y2="29"/></g>' +
    '<g transform="rotate(270 50 50)"><line class="reticle__tick" x1="50" y1="23" x2="50" y2="29"/></g>' +
    '<circle class="reticle__dot" cx="50" cy="50" r="1.5"/>' +
    "</svg>";
  document.body.appendChild(el);
  document.documentElement.classList.add("has-reticle");

  const slow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LINK = "a, button, [role=\"button\"], summary, input, label";
  const READ = "h1, h2, h3, .display, .heading, .beat__text, .cap__name, " +
    ".map__step, .proof__item, .versus__side li, figure, img";

  let tx = -100;
  let ty = -100;
  let x = tx;
  let y = ty;
  let running = false;

  function tick() {
    /* a little lag, so it reads as weighted rather than glued to the mouse */
    const k = slow ? 1 : 0.22;
    x += (tx - x) * k;
    y += (ty - y) * k;
    el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
    if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) {
      x = tx;
      y = ty;
      el.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  }

  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      tx = event.clientX;
      ty = event.clientY;
      el.dataset.live = "true";
      wake();
    },
    { passive: true }
  );

  /* delegation rather than elementFromPoint on every move: one closest() call
     when the pointer crosses into a new element, and nothing in between */
  document.addEventListener(
    "pointerover",
    (event) => {
      const target = event.target;
      if (!target || !target.closest) return;
      if (target.closest(".a11y-root")) {
        el.dataset.live = "false";
        return;
      }
      el.dataset.live = "true";
      el.dataset.state = target.closest(LINK)
        ? "link"
        : target.closest(READ)
        ? "read"
        : "";
    },
    { passive: true }
  );

  document.addEventListener("pointerleave", () => (el.dataset.live = "false"));
  window.addEventListener("blur", () => (el.dataset.live = "false"));
}
