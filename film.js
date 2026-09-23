/* ---------------------------------------------------------------------------
   THE FILM

   A 1,175-frame sequence scrubbed by the scroll, in its original colour. The
   footage is the whole argument of this page, so nothing here tints, grades or
   overlays it — the only job is to put the right frame on the screen at the
   right moment, on a phone as well as on a desktop.

   The architecture below is the second design of it. The first was smooth on
   every machine available here and stuck on a real phone, so the parts that
   were merely expensive were removed rather than tuned:

   NO PINNING, NO SCROLL LIBRARY. The stage is `position: sticky`, which the
   compositor handles, instead of a pinned element with a spacer that has to be
   measured and re-measured. On a phone the URL bar alone changes the viewport
   height constantly, and every one of those changes used to cost a full layout
   recalculation. Nothing here reads layout during a scroll.

   A PHONE PLAYS A SHORTER FILM, AND HOLDS ALL OF IT DECODED. Chasing 1,175
   frames while somebody scrolls does not work — measured over a real scroll the
   loader fell so far behind that eleven distinct frames reached the screen,
   which is not a film, it is a stutter. Fetching them all up front fixed the
   network but not the decode: a fast scrub still outran it.

   So on a phone every tenth frame is fetched and decoded once, before it is
   needed, at the size the phone will actually draw, and then kept. That is 118
   frames at 320px wide — about 2MB over the wire — after which a scrub costs
   one drawImage and nothing else, at any speed. A desktop streams a bounded
   window instead, because 1,175 full-size frames are far too heavy to hold.

   DECODED OFF THE MAIN THREAD. Frames become ImageBitmaps rather than <img>
   elements, so the decode happens on a worker thread and the draw is a straight
   texture upload. Bitmaps are closed on eviction, because unlike images they do
   not get collected on their own.

   AND IT ONLY DRAWS WHEN THE PICTURE CHANGES. The scroll handler sets a flag
   and returns; one animation frame later, if the frame index actually moved,
   one drawImage happens.
--------------------------------------------------------------------------- */

const FRAMES = 1175;

export function mountFilm(root, options = {}) {
  const phone = window.matchMedia("(max-width: 860px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const screens = Number(root.dataset.screens || 5);

  /* Every tenth frame on a phone, all of them on a desktop. A phone that
     reports little memory gets a shorter film and smaller frames, because the
     whole point is to hold every frame it will need at once. */
  const thin = phone && (navigator.deviceMemory || 4) < 4;
  const step = phone ? (thin ? 14 : 10) : 1;
  const decodeWidth = phone ? (thin ? 280 : 320) : 0;
  const folder = phone ? "frames-mobile" : "frames";

  /* ---------- the stage: sticky, not pinned ---------- */
  const stage = document.createElement("div");
  stage.className = "film-stage";
  while (root.firstChild) stage.appendChild(root.firstChild);
  const canvas = document.createElement("canvas");
  canvas.className = "film-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    root.dataset.alt || "Aerial and ground footage playing as the page is scrolled"
  );
  stage.prepend(canvas);
  root.appendChild(stage);
  root.style.setProperty("--screens", String(screens));

  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

  /* ---------- the frames ---------- */
  const cache = new Map(); /* decoded and ready to draw */
  const blobs = new Map(); /* compressed, ~18KB each, cheap to keep */
  const pending = new Set();
  /* On a phone the cache is the whole film, so nothing is evicted mid-scrub.
     On a desktop a decoded full-size frame is several megabytes, so the window
     is held near ninety and biased forward, because that is the direction
     people scroll. */
  const CAP = phone ? Math.ceil(FRAMES / step) + 4 : 90;
  const AHEAD = phone ? 22 : 20;
  const BEHIND = phone ? 6 : 8;
  const INFLIGHT = 6;
  let inflight = 0;
  let playhead = 0;

  const snap = (i) => Math.min(FRAMES - 1, Math.max(0, Math.round(i / step) * step));
  const pad = (i) => String(i + 1).padStart(4, "0");
  const url = (i) => "./" + folder + "/frame_" + pad(i) + ".webp";

  const supportsBitmap = typeof createImageBitmap === "function";

  function decode(i, blob) {
    if (cache.has(i) || pending.has(i)) return;
    pending.add(i);
    const settle = (value) => {
      pending.delete(i);
      if (value) {
        cache.set(i, value);
        stats.cached = cache.size;
        if (i === snap(playhead)) paint();
      }
    };
    if (supportsBitmap) {
      /* decoded straight to the size it will be drawn at: a phone never needs
         the full frame, and the smaller bitmap is what makes holding the whole
         film affordable */
      const opts = decodeWidth
        ? {
            resizeWidth: decodeWidth,
            resizeHeight: Math.round((decodeWidth * 16) / 9),
            resizeQuality: "medium",
          }
        : undefined;
      createImageBitmap(blob, opts)
        .then(settle)
        .catch(() => createImageBitmap(blob).then(settle).catch(() => settle(null)));
    } else {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => settle(img);
      img.onerror = () => settle(null);
      img.src = URL.createObjectURL(blob);
    }
  }

  function load(i) {
    if (blobs.has(i) || pending.has(i) || inflight >= INFLIGHT) return;
    pending.add(i);
    inflight++;
    stats.requested++;
    fetch(url(i))
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        blobs.set(i, blob);
        pending.delete(i);
        inflight--;
        /* a phone decodes everything it fetches, right away: the decode is the
           thing that must not happen while somebody is scrolling */
        if (phone || Math.abs(i - snap(playhead)) <= AHEAD * step) decode(i, blob);
        fill();
      })
      .catch(() => {
        pending.delete(i);
        inflight--;
        fill();
      });
  }

  /* On a phone this walks the whole film outward from the playhead, so the
     visible part arrives first and the rest lands behind it. On a desktop it
     keeps to a window and streams. */
  function fill() {
    const here = snap(playhead);
    const reach = phone ? FRAMES : (AHEAD + 1) * step;
    for (let d = 0; d <= reach; d += step) {
      load(snap(here + d));
      if (inflight >= INFLIGHT) return;
      if (d) {
        load(snap(here - d));
        if (inflight >= INFLIGHT) return;
      }
      if (!phone && d > BEHIND * step) break;
    }
  }

  /* top the decoded window up from what is already in memory: no network */
  function warm() {
    const here = snap(playhead);
    for (let d = 0; d <= AHEAD * step; d += step) {
      const a = snap(here + d);
      const b = snap(here - d);
      if (blobs.has(a)) decode(a, blobs.get(a));
      if (blobs.has(b)) decode(b, blobs.get(b));
    }
  }

  function evict() {
    if (cache.size <= CAP) return;
    const here = snap(playhead);
    const far = [...cache.keys()].sort((a, b) => Math.abs(b - here) - Math.abs(a - here));
    for (const i of far) {
      if (cache.size <= CAP) break;
      const v = cache.get(i);
      /* an ImageBitmap holds its memory until it is told not to */
      if (v && typeof v.close === "function") v.close();
      cache.delete(i);
    }
  }

  function nearest(i) {
    if (cache.has(i)) return cache.get(i);
    for (let d = step; d < FRAMES; d += step) {
      if (cache.has(i - d)) return cache.get(i - d);
      if (cache.has(i + d)) return cache.get(i + d);
    }
    return null;
  }

  /* A small readout, kept deliberately: the only way to know whether this is a
     film or a slideshow is to count what actually reached the screen. */
  const stats = { requested: 0, painted: 0, shown: 0, cached: 0 };
  window.__film = stats;

  let drawn = -1;
  function paint() {
    const i = snap(playhead);
    const img = nearest(i);
    if (!img) return;
    stats.painted++;
    if (i !== drawn) stats.shown++;
    stats.cached = cache.size;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.max(canvas.width / w, canvas.height / h);
    ctx.drawImage(
      img,
      (canvas.width - w * scale) / 2,
      (canvas.height - h * scale) / 2,
      w * scale,
      h * scale
    );
    /* what was drawn, not what was wanted: when the exact frame finishes
       decoding a moment later, this is what lets it replace the neighbour that
       stood in for it */
    drawn = cache.has(i) ? i : -1;
  }

  function size() {
    /* capped: a three-times pixel ratio on a phone means nine times the fill */
    const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
    canvas.width = Math.round(stage.clientWidth * dpr);
    canvas.height = Math.round(stage.clientHeight * dpr);
    drawn = -1;
    paint();
  }

  /* ---------- the opening ----------
     A frame sequence that begins on an empty canvas reads as a broken page, so
     the page holds a title card until the first frames have decoded and reports
     honestly how far along it is. It also gives up waiting: a visitor on a bad
     connection should get the film late rather than the card forever. */
  const boot = options.loader || null;
  /* At the very top of the page the desktop window only reaches ten frames
     forward, so asking for twelve meant the card never lifted on its own and
     waited out the timeout instead. The card exists so nobody sees an empty
     canvas; a handful of decoded frames is the whole bar. */
  const NEEDED = phone ? 10 : 5;
  let opened = false;

  function opening() {
    if (opened) return;
    const ready = cache.size;
    if (boot) {
      const p = Math.min(1, ready / NEEDED);
      boot.style.setProperty("--p", p.toFixed(3));
      const pct = boot.querySelector("[data-pct]");
      if (pct) pct.textContent = String(Math.round(p * 100)).padStart(3, "0");
    }
    if (ready >= NEEDED) open();
  }

  function open() {
    if (opened) return;
    opened = true;
    root.dataset.ready = "true";
    document.documentElement.dataset.filmReady = "true";
    if (boot) {
      boot.dataset.done = "true";
      setTimeout(() => boot.remove(), 900);
    }
  }
  setTimeout(open, 9000);

  /* ---------- the narration, positioned by the same progress ---------- */
  const caps = [...stage.querySelectorAll("[data-cap]")].map((el) => ({
    el,
    at: Number(el.dataset.at || 0.5),
    hold: Number(el.dataset.hold || 0.1),
    shown: -1,
  }));
  const intro = stage.querySelector("[data-intro]");
  const FADE = 0.045;

  function captions(p) {
    if (intro) {
      const o = 1 - Math.min(1, Math.max(0, (p - 0.015) / 0.09));
      if (Math.abs(o - (intro._o === undefined ? -1 : intro._o)) > 0.01) {
        intro.style.opacity = o.toFixed(3);
        intro.style.transform = "translate3d(0," + (-30 * (1 - o)).toFixed(1) + "px,0)";
        intro._o = o;
      }
    }
    for (const c of caps) {
      const inAt = c.at;
      const outAt = c.at + c.hold;
      let o = 0;
      if (p >= inAt - FADE && p <= outAt + FADE) {
        o =
          p < inAt
            ? (p - (inAt - FADE)) / FADE
            : p > outAt
            ? 1 - (p - outAt) / FADE
            : 1;
      }
      o = Math.min(1, Math.max(0, o));
      if (Math.abs(o - c.shown) > 0.01) {
        c.el.style.opacity = o.toFixed(3);
        c.el.style.transform = "translate3d(0," + (22 * (1 - o)).toFixed(1) + "px,0)";
        c.el.setAttribute("aria-hidden", o < 0.5 ? "true" : "false");
        c.shown = o;
      }
    }
  }

  /* ---------- the loop ----------
     The scroll handler does nothing but flag; one animation frame later the
     progress is read once and the picture is drawn only if it changed. */
  let queued = false;

  function frame() {
    queued = false;
    const rect = root.getBoundingClientRect();
    const span = root.offsetHeight - stage.clientHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    playhead = p * (FRAMES - 1);
    root.style.setProperty("--progress", p.toFixed(4));
    captions(p);
    const want = snap(playhead);
    if (want !== drawn) {
      paint();
      warm();
      fill();
      evict();
    }
    opening();
  }

  function onScroll() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  }

  size();
  fill();
  frame();

  if (reduced) {
    /* no scrubbing: one frame, and every line of the narration legible at once */
    root.style.setProperty("--screens", "1");
    root.dataset.still = "true";
    playhead = FRAMES * 0.06;
    fill();
    caps.forEach((c) => {
      c.el.style.opacity = "1";
      c.el.style.transform = "none";
      c.el.setAttribute("aria-hidden", "false");
    });
    if (intro) intro.style.opacity = "1";
  } else {
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* a decode finishing is not a scroll, so the opening needs a beat of its own
     until the page has something on screen */
  const settle = setInterval(() => {
    if (reduced) paint();
    opening();
    if (opened) clearInterval(settle);
  }, 120);

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      size();
      frame();
    }, 150);
  });

  return { paint, size, stats };
}
