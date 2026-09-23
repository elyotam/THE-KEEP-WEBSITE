/* ---------------------------------------------------------------------------
   THE FILM

   A frame sequence scrubbed by the scroll. This is the second design of it; the
   first was smooth on every machine available here and stuck on a real phone,
   so the parts that were merely expensive have been taken out rather than tuned:

   NO PINNING, NO SCROLL LIBRARY. The stage is `position: sticky`, which the
   compositor handles, instead of a pinned element with a spacer that has to be
   measured and re-measured. On a phone the URL bar alone changes the viewport
   height constantly, and every one of those changes used to cost a full
   recalculation. Nothing here reads layout during a scroll.

   A PHONE PLAYS A SHORTER FILM, AND HOLDS ALL OF IT DECODED. The film is 1,175
   frames. Chasing them while somebody scrolls does not work - measured over a
   real scroll the loader fell so far behind that eleven distinct frames reached
   the screen, which is not a film, it is a stutter. Fetching them all up front
   fixed the network but not the decode: a fast scrub still outran it, and four
   frames reached the screen on a slow processor.

   So on a phone every frame is decoded once, before it is needed, at a size the
   phone will actually draw, and then kept. 118 frames at 320px wide is about
   86MB of bitmaps and roughly 2MB over the wire. After that a scrub costs one
   drawImage and nothing else - no fetch, no decode, at any speed.

   DECODED OFF THE MAIN THREAD. Frames become ImageBitmaps rather than <img>
   elements, so the decode happens on a worker thread and the draw is a straight
   upload. Bitmaps are closed when they leave the cache, because unlike images
   they do not get collected on their own.

   AND IT ONLY DRAWS WHEN THE PICTURE CHANGES. The scroll handler sets a target
   and returns; one animation frame later, if the frame index actually moved,
   one drawImage happens. A fast scroll that crosses forty frames costs forty
   draws, not four hundred.
--------------------------------------------------------------------------- */

const FRAMES = 1175;

export function mountFilm(root, options = {}) {
  const phone = window.matchMedia("(max-width: 768px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const screens = Number(root.dataset.screens || 4);

  /* Every tenth frame on a phone, all of them on a desktop. A phone that says
     it has little memory gets a shorter film and smaller frames, because the
     whole point is to hold all of them at once. */
  const thin = phone && (navigator.deviceMemory || 4) < 4;
  const step = phone ? (thin ? 14 : 10) : 1;
  const decodeWidth = phone ? (thin ? 280 : 320) : 0;
  const folder = phone ? root.dataset.baked || "frames-mobile" : "frames";
  const usingBaked = phone && Boolean(root.dataset.baked);

  /* ---------- the stage: sticky, not pinned ---------- */
  const stage = document.createElement("div");
  stage.className = "film-stage";
  while (root.firstChild) stage.appendChild(root.firstChild);
  const canvas = document.createElement("canvas");
  canvas.className = "film-canvas";
  stage.prepend(canvas);
  root.appendChild(stage);
  root.style.setProperty("--screens", String(screens));

  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

  /* ---------- the phosphor curve, unless the frames already carry it ---------- */
  const tint = usingBaked ? null : root.dataset.tint;
  if (tint) {
    const stops = tint.split("|").map((s) => s.split(",").map(Number));
    const table = (i) => stops.map((c) => (c[i] / 255).toFixed(4)).join(" ");
    const id = "film-tube";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    svg.innerHTML = `<filter id="${id}" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" result="mono"
        values="0.2126 0.7152 0.0722 0 0
                0.2126 0.7152 0.0722 0 0
                0.2126 0.7152 0.0722 0 0
                0 0 0 1 0"/>
      <feComponentTransfer in="mono" result="curved">
        <feFuncR type="gamma" amplitude="1" exponent="1.2" offset="-0.02"/>
        <feFuncG type="gamma" amplitude="1" exponent="1.2" offset="-0.02"/>
        <feFuncB type="gamma" amplitude="1" exponent="1.2" offset="-0.02"/>
      </feComponentTransfer>
      <feComponentTransfer in="curved" result="phos">
        <feFuncR type="table" tableValues="${table(0)}"/>
        <feFuncG type="table" tableValues="${table(1)}"/>
        <feFuncB type="table" tableValues="${table(2)}"/>
      </feComponentTransfer>
      <feComposite in="phos" in2="SourceGraphic" operator="arithmetic"
                   k1="0" k2="${options.strength || 0.9}"
                   k3="${(1 - (options.strength || 0.9)).toFixed(2)}" k4="0"/>
    </filter>`;
    document.body.appendChild(svg);
    canvas.style.filter = `url(#${id})`;
  }

  /* ---------- the frames ---------- */
  const cache = new Map();      /* decoded, ready to draw */
  const blobs = new Map();      /* compressed, ~18KB each, cheap to keep */
  const pending = new Set();
  /* A decoded 432x768 frame is about 1.3MB, so sixty of them is roughly 80MB -
     the most worth asking a phone for. The window is biased forward because
     that is the direction people scroll. */
  /* on a phone the cache is the whole film, so nothing is ever evicted mid-scrub */
  const CAP = phone ? Math.ceil(FRAMES / step) + 4 : 90;
  const AHEAD = phone ? 22 : 20;
  const BEHIND = phone ? 6 : 8;
  const INFLIGHT = phone ? 6 : 6;
  let inflight = 0;
  let playhead = 0;

  const snap = (i) => Math.min(FRAMES - 1, Math.max(0, Math.round(i / step) * step));
  const url = (i) => `./${folder}/frame_${String(i + 1).padStart(4, "0")}.webp`;

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
        ? { resizeWidth: decodeWidth, resizeHeight: Math.round(decodeWidth * 16 / 9), resizeQuality: "medium" }
        : undefined;
      createImageBitmap(blob, opts).then(settle).catch(() =>
        createImageBitmap(blob).then(settle).catch(() => settle(null))
      );
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
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
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

  /* On a phone this walks the WHOLE film outward from the playhead, so the
     visible part arrives first and the rest lands behind it - by the time
     anybody has scrolled through the opening, nothing is left to fetch. On a
     desktop the film is 1,175 frames and far too heavy to hold, so it keeps to
     a window and streams. */
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

  /* keep the decoded window around the playhead topped up from what is already
     in memory: no network, just a decode */
  function warm() {
    const here = snap(playhead);
    for (let d = 0; d <= AHEAD * step; d += step) {
      const a = snap(here + d);
      const b2 = snap(here - d);
      if (blobs.has(a)) decode(a, blobs.get(a));
      if (blobs.has(b2)) decode(b2, blobs.get(b2));
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
     film or a slideshow is to count what actually reached the screen. Four
     numbers, no sets, nothing that grows. */
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
    ctx.drawImage(img, (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2,
                  w * scale, h * scale);
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

  /* ---------- the captions, positioned by the same progress ---------- */
  const caps = [...stage.querySelectorAll("[data-cap]")].map((el) => ({
    el,
    at: Number(el.dataset.at || 0.5),
    hold: Number(el.dataset.hold || 0.1),
    shown: -1,
  }));
  const intro = stage.querySelector("[data-intro]");

  function captions(p) {
    if (intro) {
      const o = 1 - Math.min(1, Math.max(0, (p - 0.02) / 0.1));
      if (Math.abs(o - (intro._o ?? -1)) > 0.01) {
        intro.style.opacity = o.toFixed(3);
        intro.style.transform = `translateY(${(-34 * (1 - o)).toFixed(1)}px)`;
        intro._o = o;
      }
    }
    for (const c of caps) {
      const inAt = c.at;
      const outAt = c.at + c.hold;
      let o = 0;
      if (p >= inAt - 0.04 && p <= outAt + 0.04) {
        o = p < inAt ? (p - (inAt - 0.04)) / 0.04
          : p > outAt ? 1 - (p - outAt) / 0.04
          : 1;
      }
      o = Math.min(1, Math.max(0, o));
      if (Math.abs(o - c.shown) > 0.01) {
        c.el.style.opacity = o.toFixed(3);
        c.el.style.transform = `translateY(${(18 * (1 - o)).toFixed(1)}px)`;
        c.shown = o;
      }
    }
  }

  /* ---------- the loop ----------
     The scroll handler does nothing but flag; one animation frame later the
     progress is read once and the picture is drawn only if it changed. */
  let queued = false;
  let lastTop = 0;

  function frame() {
    queued = false;
    const rect = root.getBoundingClientRect();
    const span = root.offsetHeight - stage.clientHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    playhead = p * (FRAMES - 1);
    captions(p);
    const want = snap(playhead);
    if (want !== drawn) {
      paint();
      warm();
      fill();
      evict();
    }
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
    /* no scrubbing: one frame from the middle, and every caption legible */
    root.style.setProperty("--screens", "1");
    playhead = FRAMES * 0.55;
    fill();
    caps.forEach((c) => (c.el.style.opacity = "1"));
    if (intro) intro.style.opacity = "1";
  } else {
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      size();
      frame();
    }, 150);
  });

  return { paint, size };
}

/* every outgoing link is dead: this is a portfolio piece, and a visitor who
   clicks one has to be told so rather than delivered to a real inbox */
export function sealLinks(accent = "#fff", ink = "#000") {
  let note;
  const show = (what) => {
    if (!note) {
      note = document.createElement("div");
      note.dir = "rtl";
      note.innerHTML =
        '<div class="seal-card"><b>אתר דמה</b>' +
        "<p>זהו אתר הדגמה לתיק עבודות. הקישורים החיצוניים בו אינם פעילים.</p>" +
        '<code></code><button type="button">הבנתי</button></div>';
      note.style.cssText =
        "position:fixed;inset:0;z-index:9999;display:none;align-items:center;" +
        "justify-content:center;background:rgba(0,0,0,.76);backdrop-filter:blur(6px);" +
        "font:500 1rem/1.6 Heebo,system-ui,sans-serif";
      const css = document.createElement("style");
      css.textContent =
        ".seal-card{max-width:25rem;margin:1.5rem;padding:1.8rem;text-align:center;" +
        "background:#101010;color:#e7e7e7;border:1px solid " + accent + ";border-radius:4px}" +
        ".seal-card b{display:block;margin-bottom:.6rem;font-size:1.2rem;color:" + accent + "}" +
        ".seal-card p{margin:0 0 .7rem}" +
        ".seal-card code{display:block;margin-bottom:1rem;font-size:.78rem;opacity:.55;" +
        "word-break:break-all}" +
        ".seal-card button{padding:.6rem 1.4rem;font:700 .9rem Heebo,sans-serif;" +
        "color:" + ink + ";background:" + accent + ";border:0;border-radius:2px;cursor:pointer}";
      document.head.appendChild(css);
      note.addEventListener("click", (e) => {
        if (e.target === note || e.target.tagName === "BUTTON") note.style.display = "none";
      });
      document.body.appendChild(note);
    }
    note.querySelector("code").textContent = what;
    note.style.display = "flex";
  };

  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (a.dataset.dead !== undefined) {
        e.preventDefault();
        show(a.dataset.dead || href);
        return;
      }
      if (!href || href.charAt(0) === "#") return;
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        e.preventDefault();
        show(href);
      }
    },
    true
  );
}
