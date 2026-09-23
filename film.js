/* ---------------------------------------------------------------------------
   THE FILM, AS A COMPONENT

   The frame sequence is the one thing these demo sites share. Everything else
   about them - their sections, their type, their components, their reason for
   existing - is their own, so the film cannot come bundled with a page
   structure the way it is in the original site. This mounts it into whatever
   element it is given and tells that page nothing else.

   A page supplies:
     <div data-film data-screens="4" data-tint="0,3,1|18,108,44|226,255,232">
       <div data-cap data-at="0.14">...</div>   captions, placed by position
     </div>

   and gets back a pinned canvas that scrubs the footage with the scroll, plus
   each caption faded in and out around its own moment. The tint is a phosphor
   curve applied to the footage through an SVG gradient map, exactly as the
   original site does it, and is optional: a page that wants the footage raw
   simply leaves it out.
--------------------------------------------------------------------------- */
import { createFrameSequence } from "./hero-frames.js?v=6";

const FRAMES = 1175;

export function mountFilm(root, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "film-canvas";
  root.prepend(canvas);

  /* A phone gets pre-baked frames when the page offers them, and then no
     filter at all. Measured on a weak GPU, the film ran at 34fps with the
     colour mapping computed live on every repaint and 60 without it - and the
     canvas repaints on every scroll event. The cache is small for the same
     reason: 140 decoded frames at 432x768 is about 180MB for a phone to hold,
     which it answers by evicting and re-decoding them while you scroll. */
  const baked = root.dataset.baked;
  const onPhone = window.matchMedia("(max-width: 768px)").matches;
  const usingBaked = Boolean(baked) && onPhone;
  const film = createFrameSequence(canvas, {
    desktop: { folder: "frames", count: FRAMES },
    mobile: {
      folder: usingBaked ? baked : "frames-mobile",
      count: FRAMES,
      cap: 60,
      ahead: 14,
      behind: 6,
    },
  });

  /* the phosphor curve, if this page wants one and is not already holding it */
  const tint = usingBaked ? null : root.dataset.tint;
  if (tint) {
    const stops = tint.split("|").map((s) => s.split(",").map(Number));
    const table = (i) => stops.map((c) => (c[i] / 255).toFixed(4)).join(" ");
    const id = "film-tube-" + Math.random().toString(36).slice(2, 7);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    /* no blur here: a full-screen gaussian recomputed on every repaint is what
       made the original stutter on a phone, and it buys very little */
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

  const caps = [...root.querySelectorAll("[data-cap]")];
  const screens = Number(root.dataset.screens || 4);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.addEventListener("resize", () => film.resize());

  if (reduced) {
    /* one frame, every caption legible, nothing pinned */
    film.drawAt(0.55);
    caps.forEach((c) => (c.style.opacity = "1"));
    root.style.height = "100vh";
    return film;
  }

  const gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  /* ONE timeline, pinned once.

     The first version gave the captions and the intro their own ScrollTriggers
     pointed at this same element - which never advanced, because the element is
     pinned and its top therefore stays where it is for the whole scroll. Every
     caption fired at once and the intro never faded. Everything that happens
     during the film is placed on this timeline instead, at its own fraction of
     it, which is also how it stays in step with the footage when the window is
     resized. */
  const state = { p: 0 };
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: "top top",
      end: () => "+=" + window.innerHeight * screens,
      scrub: 0.4,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  tl.to(state, {
    p: 1,
    ease: "none",
    duration: 1,
    onUpdate: () => film.drawAt(state.p),
  }, 0);

  /* the opening lines hand over to the film rather than sitting on it */
  const intro = root.querySelector("[data-intro]");
  if (intro) {
    tl.to(intro, { opacity: 0, y: -34, ease: "power1.in", duration: 0.1 }, 0.035);
  }

  caps.forEach((cap) => {
    const at = Number(cap.dataset.at || 0.5);
    const hold = Number(cap.dataset.hold || 0.1);
    tl.fromTo(cap, { opacity: 0, y: 20 },
              { opacity: 1, y: 0, ease: "power2.out", duration: 0.035 }, at)
      .to(cap, { opacity: 0, y: -16, ease: "power2.in", duration: 0.035 }, at + hold);
  });

  return film;
}

/* every outgoing link is dead: these are portfolio pieces, and a visitor who
   clicks one has to be told so rather than delivered to a real inbox */
export function sealLinks(accent = "#fff", ink = "#000") {
  let note;
  const show = (href) => {
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
        "font:500 1rem/1.6 system-ui,sans-serif";
      const css = document.createElement("style");
      css.textContent =
        ".seal-card{max-width:25rem;margin:1.5rem;padding:1.8rem;text-align:center;" +
        "background:#101010;color:#e7e7e7;border:1px solid " + accent + ";border-radius:4px}" +
        ".seal-card b{display:block;margin-bottom:.6rem;font-size:1.2rem;color:" + accent + "}" +
        ".seal-card p{margin:0 0 .7rem}" +
        ".seal-card code{display:block;margin-bottom:1rem;font-size:.78rem;opacity:.55;" +
        "word-break:break-all}" +
        ".seal-card button{padding:.6rem 1.4rem;font:700 .9rem system-ui,sans-serif;" +
        "color:" + ink + ";background:" + accent + ";border:0;border-radius:2px;cursor:pointer}";
      document.head.appendChild(css);
      note.addEventListener("click", (e) => {
        if (e.target === note || e.target.tagName === "BUTTON") note.style.display = "none";
      });
      document.body.appendChild(note);
    }
    note.querySelector("code").textContent = href;
    note.style.display = "flex";
  };

  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      /* data-dead is checked BEFORE the anchor shortcut: the buttons that would
         add to a basket or open a booking are written as href="#", and the
         first version of this returned early on the hash and let every one of
         them through - they jumped the page to the top and said nothing. */
      if (a.dataset.dead !== undefined) {
        e.preventDefault();
        show(a.dataset.dead || a.textContent.trim() || href);
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
