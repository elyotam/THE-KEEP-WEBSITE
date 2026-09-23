# NIGHTGLASS

A demonstration site for an invented manufacturer of night vision optics, built
as a portfolio piece. The company, the devices, the specifications and the
prices are all made up, the contact form sends nothing, and every outgoing link
raises a notice saying so instead of going anywhere.

**Live:** https://elyotam.github.io/nightglass-website/

## What it is

The film across the top is a 1,175 frame sequence scrubbed by the scroll. The
footage is mapped through a phosphor curve — a real luminance gradient map,
not a hue rotation — so a visitor has looked through the product before reading
a word about it. The comparison further down makes the same argument
explicitly: one photograph, shown twice, with the tube on one side of a handle
you drag.

## How it is put together

| file | what it does |
| --- | --- |
| `index.html` | the whole site; Hebrew ships in the markup, English lives beside it in `data-en` |
| `contact.html` | its own page, same shell |
| `night.css` | one stylesheet, no framework |
| `film.js` | mounts the frame sequence, pins it, places the captions, and seals every outgoing link |
| `hero-frames.js` | the frame player: a bounded request window and a cache trimmed around the playhead |
| `lang.js` | swaps Hebrew for English and flips the document to LTR |

## Two decisions worth knowing about

**The phone does not compute the effect.** Measured against a weak GPU, the film
ran at 34fps with the colour mapping applied live on every repaint and 60
without it — and the canvas repaints on every scroll event. So the mobile frames
in `frames-nv-mobile/` ship with the mapping already baked in, and the phone
draws ordinary pictures that happen to be green. Only the two smooth parts of
the effect are baked: adding the sensor noise and the fibre pattern cost +118%
of the film's weight, against +10% for the gradient map and the halation.

**The frame cache is small on purpose.** Each mobile frame is 432×768, which is
about 1.3MB decoded. Holding 140 of them asks a phone for roughly 180MB of
bitmaps, which it answers by evicting and re-decoding them — exactly while you
are scrolling. Sixty is around 80MB and still more than a second of film either
side of the playhead.

## Measured

Both pages, both languages, at 1440, 390 and 320 wide: no horizontal overflow
and no run of text below its contrast threshold. The film holds 58fps on a
phone-sized viewport with a weak GPU and a six-times throttled processor, and
60fps otherwise.
