# VANTA

**Systems for the edge of certainty.**

A single-page brand experience for a fictional autonomous aerospace and
intelligence-systems company, built as a portfolio demonstration. The company
does not exist; the systems, the copy and the brand were written for this page.

Live: https://elyotam.github.io/nightglass-website/

---

## What it is

The page is a scroll-driven film. A 1,175-frame sequence plays in its original
cinematic colour as you scroll, with five statements timed to the scenes beneath
them, and the rest of the site — the principle, three systems, a comparison, the
engineering section and the close — laid out underneath it.

Nothing is tinted, graded or overlaid. The palette is taken from the footage
itself: near-black ground, warm off-white, muted steel, and one amber drawn from
the fire in the frames.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The whole page. Semantic, English, one document. |
| `vanta.css` | Every style, on CSS custom properties. No framework. |
| `vanta.js` | Mounts the film, reveals sections on entry, runs the notice. |
| `film.js` | The frame player. The interesting file — see below. |
| `frames/` | 1,175 frames at 1344×768, the originals. Not modified. |
| `frames-mobile/` | The same film cropped to portrait at 432×768, for phones. |

There are no dependencies. Two Google fonts are linked; everything else is in
the three files above.

## The frame player

`film.js` is the part worth reading. It was rewritten once after the first
version was smooth on every machine available here and stuck on a real phone,
so the parts that were merely expensive were removed rather than tuned:

- **Sticky, not pinned.** The stage is `position: sticky`, which the compositor
  handles, instead of a pinned element with a spacer that has to be re-measured.
  On a phone the URL bar alone changes the viewport height constantly. Nothing
  in the player reads layout during a scroll.
- **A phone plays a shorter film and holds all of it.** Every tenth frame, at
  the portrait crop, decoded to 320px before it is needed and then kept — 118
  frames, about 2MB over the wire. After that a scrub costs one `drawImage` and
  nothing else, at any speed. Chasing frames during a scroll does not work: when
  it was tried, eleven distinct frames reached the screen over a full scrub.
- **A desktop streams a bounded window.** 1,175 full-size frames are far too
  heavy to hold, so the cache is capped at ninety and biased forward.
- **Decoded off the main thread.** Frames become `ImageBitmap`s, and are
  `close()`d on eviction, because unlike images they are not collected on their
  own.
- **It only draws when the picture changes.** The scroll handler sets a flag;
  one animation frame later, if the index moved, one draw happens.

`window.__film` exposes `{ requested, painted, shown, cached }`, which is the
only honest way to tell whether the thing is a film or a slideshow.

## Preview

Any static server, from the repository root:

```sh
python -m http.server 8094
```

Then open <http://127.0.0.1:8094/>. There is no build step — what is in the
repository is what GitHub Pages serves.

## Measured, not assumed

Checked with Playwright at 1440, 1024, 768, 390 and 320:

- no horizontal overflow, no console errors, nothing 404ing
- every run of text on the flat sections clears WCAG AA against what is painted
  behind it
- the narration over the footage is measured from **rendered pixels**, because
  there is no background colour to check against — there is a picture. The
  lowest line clears 5.9:1
- the film scrubs at 60fps with a software GPU and a 10× CPU throttle, with 119
  distinct frames reaching the screen
- the notice opens, takes focus, and closes on Escape and on its button
- `prefers-reduced-motion` gets one still frame and every statement visible at
  once, with no scrubbing

## Honest by construction

No link on this page goes anywhere outside it. There is no form, no contact
route, no fabricated customer, certification, metric or testimonial, and no
claim of any real affiliation. The one button opens a notice saying exactly what
the page is.
