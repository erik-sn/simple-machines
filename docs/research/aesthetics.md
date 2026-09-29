# Aesthetics research: ink on old paper, live hand-drawn lines, and switchable themes

Findings for the Simple Machines site: a full-viewport, book-like interactive story of the six classical simple machines, where the first page must read as a 1600s engraving on old paper and only reveal itself as a live 2D physics simulation when touched. Stack: React 19, TypeScript, Vite, Tailwind v4.

Every recipe below is meant to be implementable as written; where a value is a design starting point rather than a measured fact, it says so.

## Summary of recommendations

| Question | Recommendation |
| --- | --- |
| Paper | Hybrid: a CC0 scanned paper base (ambientCG `Paper006` or a public-domain book scan) tiled at two scales under multiply, plus procedural layers (fibre light, mottle, laid and chain lines, vignette, sparse foxing) rendered once to a canvas at device resolution and reused as a static background layer. Never run a full-viewport `feTurbulence` filter live. |
| Live lines | Geometry, not filters: rough.js drawables generated once per object in its local frame with a fixed per-object seed, drawn each frame under a canvas transform; perfect-freehand for tapered quill strokes and ropes. SVG filters (wobble, bleed) only on static decoration and text. |
| Type | IM Fell English (captions, running heads via IM Fell English SC) with EB Garamond as the metric-safe fallback; IM Fell French Canon for titles. Graph theme: Routed Gothic for labels and the title block, B612 Mono for figures. Fusion: EB Garamond text with Routed Gothic labels. All OFL. |
| Case studies to imitate | Ciechanowski (slider under figure, prose invites the touch, live numbers on the figure), Red Blob Games (draggable-object mechanics, controls below diagrams, deterministic redraws), Pentiment via Lettermatic (stroke-order draw-on, many alternates so nothing repeats, gently bleeding ink). |
| Transitions | View Transitions API crossfade (default) with a short draw-on of the new drawing; a lateral slide only for chapter changes; no page curl. |
| Theme switch | `data-theme` on `<html>`, CSS variables per theme, one `SceneTheme` object per theme that supplies paper, stroke renderer, hatch spec, type, and SVG filter defs; scenes depend only on the `SceneTheme` interface. |

## 1. Old paper on the web

### 1.1 What period paper actually is

European paper from 1300 to 1800 was made from hemp and flax rag, sized in warm gelatin with alum, hung to dry sheet by sheet, and glazed with a smooth stone under pressure, which left visible stroke marks on some sheets; papermakers fought a yellow tinge left by retting and washed the rags continuously to get an off-white ([Paper through Time, University of Iowa](https://paper.lib.uiowa.edu/european.php)). The takeaway for colour: the base sheet is off-white, and what we read as "old" is surface toning, dirt, and stains on top of it, not an orange dye.

Laid paper, the norm from the 12th to the 19th century, carries two perpendicular wire patterns from the mould: closely spaced laid lines and widely spaced chain lines, with darker strips along the chain lines in "antique laid" sheets when held to the light; wove paper (an even mesh) appeared around 1756 ([Wikipedia, Laid paper](https://en.wikipedia.org/wiki/Laid_paper)). The deckle, a removable frame on the mould, gives the feathered deckle edge; machine paper after the early 1800s lost it ([Wikipedia, Deckle](https://en.wikipedia.org/wiki/Deckle)). Foxing is reddish-brown spotting attributed to fungal growth or oxidation of iron or copper traces in the rag, worsened by humidity, and it is rare in books printed before 1501 and commoner as rag quality fell later ([Wikipedia, Foxing](https://en.wikipedia.org/wiki/Foxing)). So a 1600s sheet may show a few fox spots, but they should be sparse.

A measured datapoint: a study of naturally soiled, gelatin-sized rag paper from a 1650 book described its surface as brown-yellowish, strongly yellowed by gelatin and flour-glue stains, with light purple microbial spots and a layer of pressed dust; laser cleaning raised its CIELAB lightness L* by about 11 units, so surface grime alone accounts for roughly ten L* of darkening ([Kamińska et al., Optica Applicata 34(1), 2004, PDF](https://www.dbc.wroc.pl//Content/109152/optappl_3401p121.pdf)). Design conclusion: model the sheet as a light warm base with a separate darkening layer concentrated at edges, corners, and gutter, rather than a uniformly tan fill.

I could not reach a published measurement of chain-line or laid-line spacing (the sources I could open give orientation but no numbers). Treat the pitches in the recipes below as working values and measure them from a scan before hard-coding: the 1713 page scan at [fromoldbooks.org](https://fromoldbooks.org/oratiodominica/pages/orationis-p05-texture/119x146-q75.html) (300 dpi, out of copyright, credit requested) or a Commons file from [Category:Paper textures](https://commons.wikimedia.org/wiki/Category:Paper_textures) will do.

### 1.2 Ink on that paper

Hand-press printing ink was Gutenberg's oil-based formula, lampblack in a varnish (soot, turpentine, walnut oil), unlike the water-based writing inks that blurred on type ([Wikipedia, Ink](https://en.wikipedia.org/wiki/Ink)). Writing and drawing ink was iron gall: purple-black or brown-black when fresh, it penetrates the sheet, can ghost through to the verso, and browns and corrodes with age ([Wikipedia, Iron gall ink](https://en.wikipedia.org/wiki/Iron_gall_ink)). For the screen this means: ink is never `#000`; it is a warm near-black that lightens where the pen pressed less, and its edge is very slightly soft where it soaked in. Multiply-blending the ink over the paper (rather than painting opaque ink) gives the "sits in the fibre" look for free, because the paper texture shows through the stroke.

### 1.3 Procedural recipe (SVG filters)

The building blocks are `feTurbulence` (Perlin noise; `baseFrequency` accepts two values for anisotropic grain, `numOctaves`, `seed`, `stitchTiles`, `type="fractalNoise"` is the smoother variant) and `feDiffuseLighting`, which reads the alpha channel of its input as a bump map and lights it with a distant, point, or spot light ([MDN, feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence); [MDN, feDiffuseLighting](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDiffuseLighting)). The lighting step is what turns flat noise into fibre: low-elevation light makes each noise bump cast a micro-shadow. Grainy Gradients on CSS-Tricks is the canonical write-up of the noise-plus-blend approach and notes that Blink and WebKit blend slightly differently, so test both ([Jimmy Chion, CSS-Tricks, 2021](https://css-tricks.com/grainy-gradients/)).

A full paper filter, applied to a rect filled with the base paper colour:

```html
<svg width="0" height="0" aria-hidden="true">
  <filter id="paper-fibre" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <!-- fibre: fine anisotropic noise, lit from upper left so each fibre casts a micro-shadow -->
    <feTurbulence type="fractalNoise" baseFrequency="0.7 0.45" numOctaves="3" seed="11" stitchTiles="stitch" result="fibre"/>
    <feDiffuseLighting in="fibre" lighting-color="#ffffff" surfaceScale="1.4" diffuseConstant="1.1" result="lit">
      <feDistantLight azimuth="40" elevation="62"/>
    </feDiffuseLighting>
    <!-- multiply the lit fibre into the paper-coloured source -->
    <feComposite in="SourceGraphic" in2="lit" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="fibrePaper"/>
    <!-- mottle: large, soft pulp-density variation, pushed to near-white so it only tints -->
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="5" result="mottle"/>
    <feComponentTransfer in="mottle" result="mottleLight">
      <feFuncR type="linear" slope="0.22" intercept="0.80"/>
      <feFuncG type="linear" slope="0.22" intercept="0.79"/>
      <feFuncB type="linear" slope="0.22" intercept="0.76"/>
      <feFuncA type="table" tableValues="1 1"/>
    </feComponentTransfer>
    <feBlend in="fibrePaper" in2="mottleLight" mode="multiply"/>
  </filter>
</svg>
```

Notes on the values: `baseFrequency="0.7 0.45"` makes fibres about 1.4 px by 2.2 px at 1x, elongated along the sheet like real laid stock; two turbulence calls at very different frequencies are the "two scales of noise" that stop the surface reading as uniform static. `feComponentTransfer` with `linear` or `table` functions is the documented way to remap a channel (including hardening alpha after a blur) ([MDN, feComponentTransfer](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feComponentTransfer)). `feBlend` takes the CSS blend-mode keywords; of those, multiply always darkens, screen always lightens, and overlay picks by backdrop darkness; `mix-blend-mode` creates a stacking context and `isolation: isolate` limits what it blends with ([MDN, mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode)).

Laid and chain lines, vignette, and edge toning are cheaper as CSS gradients under multiply:

```css
.paper { position: relative; background: var(--paper-base); isolation: isolate; }
.paper::before { /* laid lines every ~4px, chain lines every ~96px: working values, measure from a scan */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background:
    repeating-linear-gradient(90deg, rgb(60 40 10 / 0.05) 0 1px, transparent 1px 96px),
    repeating-linear-gradient(0deg,  rgb(60 40 10 / 0.03) 0 1px, transparent 1px 4px);
  mix-blend-mode: multiply;
}
.paper::after { /* toning: darker gutter and corners, faint handling marks at the fore-edge */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(120% 90% at 50% 45%, transparent 55%, rgb(92 64 28 / 0.18) 100%),
    linear-gradient(to right, rgb(92 64 28 / 0.10), transparent 8% 92%, rgb(92 64 28 / 0.10));
  mix-blend-mode: multiply;
}
```

Foxing: threshold a low-frequency noise into sparse spots and blur them slightly. `feColorMatrix` with a steep alpha row is the threshold; only noise alpha above about 0.82 survives.

```html
<filter id="foxing" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="19" result="n"/>
  <feColorMatrix in="n" type="matrix"
    values="0 0 0 0 0.55   0 0 0 0 0.36   0 0 0 0 0.18   0 0 0 9 -7.4" result="spots"/>
  <feGaussianBlur in="spots" stdDeviation="0.6"/>
</filter>
```

Deckle edge: displace the boundary of an inset paper rect with low-frequency noise (`feDisplacementMap` moves each pixel by `scale * (channel - 0.5)`, so `scale="12"` gives up to 6 px of wander) ([MDN, feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)). Only worth it if the page is drawn inset on a darker desk; a sheet that fills the viewport has no visible edge, and a book opened flat shows a gutter, not a deckle.

```html
<filter id="deckle" x="-2%" y="-2%" width="104%" height="104%">
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="2" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

### 1.4 Texture-image recipe

Sources with clear licences:

- ambientCG: `Paper001` to `Paper006` (006 is tagged beige and brown, the closest to toned rag) plus `Cardboard001` to `004`; everything on the site is CC0 1.0, no attribution required ([ambientCG API listing](https://ambientcg.com/api/v2/full_json?q=paper&type=Material); [ambientCG licence](https://docs.ambientcg.com/license/)).
- Poly Haven: all assets CC0 ([Poly Haven licence](https://polyhaven.com/license)), but the textures API returns no paper or parchment material at the time of writing, only `decrepit_wallpaper`; do not plan on it for paper.
- Wikimedia Commons `Category:Paper textures`: several multi-megapixel scans of aged blank book pages; files are individually licensed, mostly CC BY or CC BY-SA, so check each file page and credit ([Commons category](https://commons.wikimedia.org/wiki/Category:Paper_textures)).
- fromoldbooks.org: a 300 dpi scan of a blank area of a 1713 book, public domain, credit requested and no redistribution of the file itself ([fromoldbooks.org](https://fromoldbooks.org/oratiodominica/pages/orationis-p05-texture/119x146-q75.html)). Best used as a colour and grain reference for tuning the procedural layers rather than as a shipped asset.

Use: desaturate the scan slightly, set it as a `background-image` under `background-blend-mode: multiply` over the base colour, or as its own layer with `mix-blend-mode: multiply` at 40 to 70 percent opacity. Tiling without visible repetition: (1) use two copies of the same tile at different `background-size` values (for example 900 px and 1400 px) with one rotated 90 degrees via a wrapper, each at low opacity, so their periods do not coincide; (2) put the low-frequency procedural mottle on top, which breaks the periodic signal the eye locks onto; (3) if a tile still shows, cut it into a small Wang tile set, the standard non-periodic tiling technique where tile edges are colour-coded and any valid tiling is seamless ([GPU Gems 2, ch. 12](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-12-tile-based-texture-mapping)). For the procedural layers, `stitchTiles="stitch"` makes the noise tile seamlessly.

### 1.5 Hybrid, and why it is the recommendation

Scans carry the things noise cannot invent (fibre clumps, sizing sheen, real stains); procedural layers carry the things a scan cannot do (resolution independence, exact colour control, per-theme tuning, no licence bookkeeping for the look). Combine: scanned tile for fine grain at 30 to 50 percent, procedural fibre light at low amplitude for resolution independence, gradients for laid and chain lines and toning, thresholded noise for foxing. Every layer under multiply so ink drawn on top inherits the texture.

### 1.6 Performance

- Live SVG filters on large areas are the single biggest risk. Dirk Weber warns that `feTurbulence` "can melt your multicore CPU" and that lighting primitives have "a serious effect on performance" ([Smashing Magazine, 2015](https://www.smashingmagazine.com/2015/05/why-the-svg-filter-is-awesome/)); a GSAP forum thread documents `feTurbulence` plus `feDisplacementMap` animations that run on desktop but go sluggish and crash Safari tabs on iOS, with the workable answers being disable on mobile, pre-render to images, or move to WebGL ([GSAP forums](https://gsap.com/forums/topic/33075-gsap-and-feturbulence-mobile-performance/)).
- Therefore rasterize once. Build the paper as an SVG string, load it into an `Image`, draw it to a canvas sized `viewport * min(devicePixelRatio, 2)`, and use that canvas (or `toBlob` to an object URL) as the static background layer. Regenerate only on a debounced resize or theme change. Cache by `(theme, width, height, dpr)`.
- Layer the canvases: MDN's canvas optimisation guide recommends separate canvases for static and dynamic content so the background is never redrawn per frame, pre-rendering repeated drawing to an offscreen canvas, integer coordinates, `alpha: false` on opaque contexts, and scaling for `devicePixelRatio` ([MDN, Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)). Paper layer at the bottom, simulation canvas above it (transparent, multiply blended via CSS), DOM text and chrome on top.
- Animate only `transform` and `opacity` on the layers (transitions, parallax-free), and treat `will-change` as a last resort applied to the smallest element for the shortest time ([MDN, will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)).
- Filter region: a `<filter>` defaults to `x="-10%" y="-10%" width="120%" height="120%"` so blurs are not clipped ([MDN, filter element](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/filter)); set `x="0" y="0" width="100%" height="100%"` on the paper filter so it does not compute 44 percent more noise than the viewport shows.
- Rasterize-once sketch, the only place the paper filter ever runs:

```ts
const cache = new Map<string, Promise<HTMLCanvasElement>>();

export function paperRaster(theme: SceneTheme, w: number, h: number): Promise<HTMLCanvasElement> {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const key = `${theme.id}:${w}x${h}@${dpr}`;
  let job = cache.get(key);
  if (!job) {
    job = (async () => {
      const svg = theme.paper.svgMarkup(w, h);                      // the filter recipe above, with a paper-coloured rect
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        const img = new Image(); img.decoding = "async"; img.src = url; await img.decode();
        const c = document.createElement("canvas"); c.width = w * dpr; c.height = h * dpr;
        const ctx = c.getContext("2d", { alpha: false })!; ctx.scale(dpr, dpr); ctx.drawImage(img, 0, 0, w, h);
        return c;
      } finally { URL.revokeObjectURL(url); }
    })();
    cache.set(key, job);
  }
  return job;
}
```

Call it from a debounced `resize` handler and on theme change; blit the result into the bottom canvas layer once. If the SVG image route proves slow on a device, the same layers can be produced in plain JavaScript (simplex noise into `ImageData`) with identical results, since the recipe is just noise, lighting, and multiply.

### 1.7 Colour

Starting palette, chosen from the descriptions above (off-white rag, warm toning, brown-black ink) and checked against WCAG; tune against a scan on a calibrated screen.

| Role | Hex | OKLCH (approx.) | Note |
| --- | --- | --- | --- |
| Paper base | `#efe6d2` | 0.92 0.03 85 | clean sheet centre |
| Paper mid | `#e8dcc3` | 0.89 0.04 85 | general tone after multiply layers |
| Paper toned | `#dfd0b1` | 0.85 0.05 85 | near gutter and corners |
| Paper vignette | `#d6c39f` | 0.81 0.06 82 | extreme corners only |
| Ink full | `#2b211a` | 0.24 0.02 55 | printed ink, pressed line |
| Ink light pressure | `#4a3b2e` | 0.35 0.03 55 | hairlines, hatching |
| Ink faded | `#6b5540` | 0.45 0.04 60 | old marginal notes, catchwords |
| Hint ink | `#8a7a68` | 0.57 0.03 65 | quiet highlight; decorative only |

Hue sits around 80 to 90 in OKLCH (yellow-orange) at very low chroma; the mistake behind the candlelit cliche is high chroma and a hue nearer 60. Contrast ratios computed with the WCAG formula (see section 6.6): full ink on paper base 12.7:1, on vignette 9.1:1; faded ink on toned paper 4.6:1 (passes AA only for large text); hint ink fails 3:1 on toned paper, so it can never be the only affordance.

## 2. Hand-drawn ink line rendering for live geometry

### 2.1 What a 1600s machine drawing looks like

Two printed idioms bracket the period. Agricola's De re metallica (1556) has 292 woodcuts, relief-printed, drawn by Blasius Weffring and cut at Froben's shop in Basel, showing pumps, windlasses, treadmills, and waterwheels ([Wikipedia, De re metallica](https://en.wikipedia.org/wiki/De_re_metallica)); woodcut lines are bolder and tone comes from parallel hatching, with cross-hatching rare because it is far harder to cut ([Wikipedia, Woodcut](https://en.wikipedia.org/wiki/Woodcut)). The "theatre of machines" books that followed used copperplate: Besson's Theatrum Instrumentorum (1578) was illustrated with engravings by Jacques Androuet du Cerceau, with four plates re-engraved by René Boyvin for the 1578 edition ([Wikipedia, Jacques Besson](https://en.wikipedia.org/wiki/Jacques_Besson)); Ramelli's Le diverse et artificiose machine (1588) has 195 designs, over 100 of them water-raising machines, plus the bookwheel ([Wikipedia, Ramelli](https://en.wikipedia.org/wiki/Agostino_Ramelli)). The burin produces a steady, deliberate line with clean edges; tone is built from many thin parallel lines (hatching), crossed for density, or stippled, and the 17th-century engraver Mellan used the "swelling line", parallel lines that thicken and thin with pressure ([Wikipedia, Engraving](https://en.wikipedia.org/wiki/Engraving)).

For the lever, choose the engraving idiom: it is the one that says "1600s machine book", and it is closer to what a thin, steady, slightly varying stroke on canvas can do. Concretely: outlines 1.6 to 2.2 px at 1x with gentle swelling, hatching at 0.6 to 0.8 px spaced 3 to 4 px on the shaded side of cylinders and the underside of beams, cross-hatching only in the darkest pockets (under the fulcrum, inside the pulley block), and no tone at all on the lit side. Woodcut weight (2.5 to 3 px, hatching spaced 6 to 8 px, no cross-hatching) is the right vocabulary for a heavier "Agricola" variant if one is ever wanted.

### 2.2 rough.js: sketchy geometry with a stable hand

rough.js is a small (under 9 kB gzipped) MIT library that draws hand-drawn-looking shapes on canvas or SVG ([roughjs.com](https://roughjs.com/)). The options that matter here, from the API wiki ([rough.js wiki](https://github.com/rough-stuff/rough/wiki)):

- `roughness` (default 1) and `bowing` (0 gives straight lines): how far a stroke deviates and how much it curves.
- `seed`: an integer 1 to 2^31; with a seed the random values are reproducible, without one (or 0) every draw differs.
- `preserveVertices`: do not randomize the end points, which is what keeps a pivot exactly on the physics joint.
- `disableMultiStroke`: engraving is a single confident line, so set this true for outlines; leave the double stroke for sketchier themes.
- `fillStyle` (`hachure`, `cross-hatch`, `zigzag`, `dots`, `dashed`, `zigzag-line`, `solid`) with `hachureAngle` (default -41), `hachureGap` (default 4 x stroke width), `fillWeight` (default half the stroke width): hatching for free.
- `curveStepCount` (default 9) for circles: raise to 16 or more for pulleys, or the wheel reads as a polygon.
- The generator API (`rough.generator()`) returns drawable objects that can be drawn later and reused; `rc.draw(drawable)` paints one on any canvas.

Stability is the real design question: the lever's wobble must belong to the lever and never boil. Excalidraw, which is built on rough.js, stores a per-element `seed`, documented in its element type as a "random integer used to seed shape generation so that the roughjs shape doesn't differ across renders" ([Excalidraw element types](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/types.ts)). Go one step further for a moving simulation: generate each rigid body's drawable once, in its own local frame (the beam from `(0,0)` to `(L,0)`), with its own seed, and each frame draw the cached drawable under `ctx.translate(x, y); ctx.rotate(theta)`. The wobble is then welded to the body; rotation and translation cannot change it, and generation cost is paid once. Regenerate only when geometry changes (a slider changes the beam length). Keep `ctx` scale at 1 so stroke widths stay in device pixels.

```ts
import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";

const gen = rough.generator();
const inkOutline: Options = { roughness: 0.9, bowing: 0.6, strokeWidth: 1.8, stroke: "#2b211a",
  disableMultiStroke: true, preserveVertices: true };

function beamDrawable(length: number, depth: number, seed: number): Drawable {
  return gen.rectangle(0, -depth / 2, length, depth, { ...inkOutline, seed,
    fill: "#2b211a", fillStyle: "hachure", hachureAngle: -35, hachureGap: 3.5, fillWeight: 0.7 });
}

function drawBody(ctx: CanvasRenderingContext2D, d: Drawable, x: number, y: number, theta: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(theta);
  rough.canvas(ctx.canvas).draw(d);
  ctx.restore();
}
```

Cost: a handful of bodies with hatching is a few hundred path segments per frame, well within budget on phones; the hatch fill is the expensive part, so cap hatch area (hatch only the shaded band, not the whole beam, by generating a second thin polygon for the shadow band).

Hatching as an engraver would place it: light comes from the upper left (the same `azimuth="40"` the paper uses), so the shadow band is the lower edge of a beam, the right side of a post, the underside of a wheel rim; band width is 25 to 35 percent of the part's depth; hatch angle follows the part's long axis plus 30 degrees, not a global angle, which is why the band polygon is generated in the body's local frame with the body's seed. Cross-hatch only where two bands meet (a beam resting on a post). Contour hatching that curves around a cylinder is beyond rough.js's straight hachure; for axles and the screw's shaft, use a rough.js `dashed` fill on a set of short arcs, or accept straight hatching, which most period plates did anyway.

### 2.3 perfect-freehand: pressure-shaped strokes for quills and ropes

perfect-freehand (MIT) turns an input polyline of `[x, y, pressure]` into an outline polygon of a variable-width stroke; options are `size`, `thinning` (how much pressure changes width), `smoothing`, `streamline`, `simulatePressure` (derive pressure from velocity), `easing`, and `start` and `end` objects with `cap`, `taper`, and `easing` for tapered ends; the outline is filled as a path (`getSvgPathFromStroke` for SVG, `Path2D` for canvas) ([perfect-freehand README](https://github.com/steveruizok/perfect-freehand)). Two properties make it ideal for the moving layer: it is deterministic (same points in, same outline out, so nothing boils) and it produces the burin's swelling line directly, because you author the pressure profile. For a lever outline: sample the geometry into points, assign `pressure = 0.55 + 0.45 * sin(pi * t)` along each edge so the middle swells and the ends taper, `thinning: 0.6`, `simulatePressure: false`, `start: { taper: 12 }`, `end: { taper: 12 }`. For a rope over a pulley, which deforms every frame, feed the rope's polyline each frame with constant pressure and a slight `smoothing`; determinism means the rope does not shimmer.

Use the two together: perfect-freehand for the principal outlines (steady, swelling), rough.js for hatching and for small parts where a little roughness reads as a hand.

### 2.4 SVG filter chains for wobble and ink bleed

Wobble: `feTurbulence` into `feDisplacementMap` is the standard hand-drawn distortion; Henry's tutorial uses `baseFrequency="0.01 0.01"`, `numOctaves="1"`, `scale="10"` and suggests tuning scale logarithmically ([henry.codes](https://fw21.henry.codes/writing/how-to-distort-text-with-svg)); a lower-frequency, gentler variant (`0.02`, two octaves, small scale) reads as tremor rather than warp ([dev.to, organic textures](https://dev.to/hexshift/creating-organic-textures-with-svg-filter-distortions-1moj)). For an ink line, keep displacement under 2 px or the line breaks up.

```html
<filter id="ink-wobble" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="7" result="noise"/>
  <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

Ink bleed: fatten slightly (`feMorphology dilate`, which thickens alpha edges; `erode` thins them, [MDN, feMorphology](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feMorphology)), blur, then re-harden alpha with a table so the edge is soft for only a fraction of a pixel, and optionally punch the edge with fine grain so the line looks dry in places.

```html
<filter id="ink-bleed" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
  <feMorphology in="SourceGraphic" operator="dilate" radius="0.3" result="fat"/>
  <feGaussianBlur in="fat" stdDeviation="0.6" result="soft"/>
  <feComponentTransfer in="soft" result="hard">
    <feFuncA type="table" tableValues="0 0 0.25 0.9 1"/>
  </feComponentTransfer>
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="grain"/>
  <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3 -0.9" result="mask"/>
  <feComposite in="hard" in2="mask" operator="in"/>
</filter>
```

Where filters belong: on static things (the title, captions, ornaments, the paper). A filter on a `<g>` that moves is recomputed every frame over its bounding box, which is exactly the mobile failure mode in section 1.6. Filter chains also cannot express pressure, so they make a mechanical line look shaky rather than hand-cut. If a filtered look is wanted on the live layer, bake it: render each rigid body once to an offscreen canvas through the filter (via an SVG image), then blit the bitmap under the transform. That trades crispness on rotation for cost, so prefer the geometric approach.

### 2.5 Drawing-on

`stroke-dasharray` plus an animated `stroke-dashoffset` reveals a stroke progressively; the classic recipe needs the path length from `getTotalLength()` ([CSS-Tricks, SVG line animation](https://css-tricks.com/svg-line-animation-works/)). Setting `pathLength="1"` on the path normalises all stroke computations so `stroke-dasharray: 1; stroke-dashoffset: 1 -> 0` works without measuring ([MDN, pathLength](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/pathLength)). For rough.js in SVG mode, each generated sub-path can carry `pathLength="1"` and an `animation-delay` in drawing order (outline first, then hatching), which is how Pentiment's type "writes itself" stroke by stroke from ductus diagrams ([Lettermatic, Pentiment](https://lettermatic.com/custom/pentiment)). On canvas, the equivalent is drawing only the first `k` segments of each cached drawable, advancing `k` per frame. Use draw-on for page entry (400 to 700 ms) and never during interaction.

### 2.6 Which approach where

| Need | Use | Why |
| --- | --- | --- |
| Rigid bodies moving at 60 fps (beam, fulcrum, wheel, wedge, screw) | rough.js drawables cached per body with a seed, drawn under a transform; perfect-freehand for principal outlines | deterministic, cheap per frame, hand welded to the body |
| Deforming geometry (rope, chain, spring) | perfect-freehand on the per-frame polyline | deterministic, no boil, tapered ends |
| Hatching and cross-hatching | rough.js fill styles on a shadow-band polygon | built in, seedable |
| Static decoration (title, ornaments, rules, captions) | SVG text and paths with `ink-bleed` and a hint of `ink-wobble` | filters are fine when nothing moves |
| Page entry | draw-on via `pathLength` (SVG) or segment count (canvas) | reads as a hand at work |
| Paper | procedural plus scan, rasterized once | filters never run live |

## 3. Typography

### 3.1 Period faces and their licences

| Face | Origin | Licence and source |
| --- | --- | --- |
| IM Fell English, DW Pica, Double Pica, Great Primer, French Canon, Three Line Pica (each with an SC small-caps companion) | Igino Marini's digitisations of the types Bishop John Fell bought in Holland c. 1670-1672 for Oxford University Press, presumed cut by Dirck Voskens; short extenders, high stroke contrast, flattened serifs, old-style irregularity ([Wikipedia, Fell types](https://en.wikipedia.org/wiki/Fell_types)); Marini's iKern project began as a way to letter-fit them ([ikern.space](https://www.ikern.space/about)) | OFL; in the Google Fonts repository, e.g. [imfellenglish](https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/METADATA.pb), [imfelldwpica](https://raw.githubusercontent.com/google/fonts/main/ofl/imfelldwpica/METADATA.pb), [imfellfrenchcanon](https://raw.githubusercontent.com/google/fonts/main/ofl/imfellfrenchcanon/METADATA.pb), [imfellgreatprimersc](https://raw.githubusercontent.com/google/fonts/main/ofl/imfellgreatprimersc/METADATA.pb) |
| EB Garamond | Georg Duffner and Octavio Pardo, from the 1592 Egenolff-Berner specimen; variable weight 400 to 800 | OFL ([METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/METADATA.pb); [description](https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/DESCRIPTION.en_us.html)) |
| Cormorant Garamond | Christian Thalmann; a display Garamond with very fine hairlines | OFL ([METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/METADATA.pb)) |
| Cardo | David Perry, after the Aldine type of De Aetna (1495); small caps, old-style figures, standard, discretionary and historical ligatures | OFL 1.1 ([scholarsfonts.net](https://www.scholarsfonts.net/cardofnt.html); [METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/cardo/METADATA.pb)) |
| Junicode 2 | Peter Baker, for medievalists; variable width, weight, and Enlarge axes; full small caps; MUFI 4.0 | OFL 1.1 ([GitHub](https://github.com/psb1558/Junicode-font)) |
| Libre Caslon Text | Pablo Impallari; Caslon is a 1720s design, so it is a century late for this brief | OFL ([METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/librecaslontext/METADATA.pb)) |

Recommendation: IM Fell English for captions and body, IM Fell English SC for running heads and labels, IM Fell French Canon or Three Line Pica for the title page, EB Garamond as the fallback in the stack (it is a variable font and has the OpenType features Fell lacks). The Fell types are the only ones on the list that are actually 17th-century; Garamond and the Aldine face are 16th-century and read as "Renaissance" without contradicting the brief. Cormorant's hairlines vanish at caption sizes on phones; reserve it for display. Fell Flowers, Marini's ornament fonts, were released alongside the text faces, but his former site now redirects to ikern.space and I did not find them in the Google Fonts repository; rather than depend on them, trace the two or three ornaments the site needs as SVG from a public-domain specimen, or use the Unicode fleurons (U+2766 floral heart, U+2619 reversed rotated floral heart) in a font that has them ([Wikipedia, Fleuron](https://en.wikipedia.org/wiki/Fleuron_(typography))).

### 3.2 The period apparatus, and how much of it to use

- Small caps: EB Garamond, Cardo, and Junicode expose `smcp`, so `font-variant-caps: small-caps` (or `all-small-caps`) uses real glyphs; IM Fell ships small caps as separate SC families, so switch `font-family` instead, otherwise the browser synthesises shrunken capitals.
- Old-style figures: `font-variant-numeric: oldstyle-nums proportional-nums` maps to the `onum` and `pnum` features ([MDN, font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)); folio numbers and any number in a caption should be old-style. Tabular lining figures belong to the graph theme.
- Ligatures: `font-variant-ligatures: common-ligatures` always; `discretionary-ligatures` (ct, st) and the long s only on the title page, never in captions, because they slow reading on screen.
- Drop caps: `initial-letter: 3` (with `-webkit-initial-letter`) is the proper property but is not yet Baseline; keep the `::first-letter { float: left; font-size: 3em; line-height: 1 }` fallback ([MDN, initial-letter](https://developer.mozilla.org/en-US/docs/Web/CSS/initial-letter)). One drop cap per chapter opening, none on ordinary pages.
- Catchwords: the first word of the next page printed at the foot of the current one, standard from the mid-16th to the late 18th century ([Wikipedia, Catchword](https://en.wikipedia.org/wiki/Catchword)). This site's pages really are sequential, so a catchword in faded ink at the bottom right doubles as a quiet "there is a next page" affordance; make it a link.
- Running heads: chapter name in small caps at the head, `letter-spacing: 0.08em`, faded ink; with the folio ("fol. 3") in old-style figures.
- Marginal notes: Tufte CSS puts sidenotes in the margin column on wide screens and collapses them behind a toggle on narrow ones ([Tufte CSS](https://edwardtufte.github.io/tufte-css/)); use the same structure for the interaction hint (section 6.2).
- Fleurons and rules: fleurons were cast as sorts and used for borders, section dividers, and to fill the white space of paragraph ends, from Granjon's designs of the 1560s onward ([Wikipedia, Fleuron](https://en.wikipedia.org/wiki/Fleuron_(typography))). One fleuron as a section divider on the contents page and between chapters; a single thin rule under the running head; no borders around the illustration, which must read as a plate, not a card.

Loading the faces so the fallback does not reflow: EB Garamond runs larger on the body than Fell English, so give the fallback a `size-adjust` so lines break in the same places whichever face paints first; `size-adjust` scales a face's glyphs and metrics by a percentage for exactly this purpose ([MDN, size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust)).

```css
@font-face { font-family: "IM Fell English"; src: url(/fonts/IMFellEnglish-Regular.woff2) format("woff2"); font-display: swap; }
@font-face { font-family: "IM Fell English"; font-style: italic; src: url(/fonts/IMFellEnglish-Italic.woff2) format("woff2"); font-display: swap; }
@font-face { font-family: "IM Fell English SC"; src: url(/fonts/IMFellEnglishSC-Regular.woff2) format("woff2"); font-display: swap; }
@font-face { font-family: "Garamond Fallback"; src: url(/fonts/EBGaramond[wght].woff2) format("woff2"); size-adjust: 94%; font-display: swap; }
```

Self-host the woff2 files from the Google Fonts repository rather than linking the Google Fonts CSS, so the page has no third-party request and the "static plate" first paint does not depend on a font swap.

Too much is easy to define: on any single screen, at most three period devices (for example running head, caption, catchword) plus the drawing. Body measure and size follow modern screen rules, not period ones: 45 to 90 characters per line ([Practical Typography, line length](https://practicaltypography.com/line-length.html)) and 15 to 25 px for body text on screen, adjusting point size per face because faces of equal nominal size look different in size ([Practical Typography, point size](https://practicaltypography.com/point-size.html)); Fell English runs small on the body, so it needs about 1.1 times the size EB Garamond would.

### 3.3 Graph-paper theme type, and the fusion

| Face | Character | Licence |
| --- | --- | --- |
| Routed Gothic | traced by Darren Embry from a Leroy lettering set, the single-stroke gothic of mid-century technical drawings, keyboards, and avionics; italics literally slanted 22.5 degrees "as a drafter would do", plus half-italics at 11.25 | OFL 1.1 ([webonastick.com](https://webonastick.com/fonts/routed-gothic/)) |
| osifont | ISO 3098 technical lettering, regular and italic, required in some European CAD contexts | GPL 3 with font exception (also GPL 2 FE and LGPL 3 FE builds) ([GitHub](https://github.com/hikikomori82/osifont)) |
| B612 and B612 Mono | Airbus, ENAC, and Intactile Design; built and tested for cockpit displays in degraded viewing conditions | OFL on Google Fonts ([METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/b612/METADATA.pb); [description](https://raw.githubusercontent.com/google/fonts/main/ofl/b612/DESCRIPTION.en_us.html)) |
| Architects Daughter | Kimberly Geswein; casual architect's hand, looser than drafting lettering | OFL ([METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/architectsdaughter/METADATA.pb)) |

Graph theme: Routed Gothic for labels, dimensions, and the title block (the Leroy set is the historically correct lettering for a drafted sheet), B612 Mono with `tabular-nums` for live numbers, B612 for the caption. osifont is the alternative if ISO lettering is wanted, but its GPL-with-exception licence is worth a second look before bundling. Fusion theme: EB Garamond captions (it has the features and the variable axis) with Routed Gothic labels and dimension text on the drawing, and IM Fell French Canon for the title, on a faintly gridded, lightly toned sheet. The pairing works because both are "instrument" faces from working documents rather than decorative ones.

### 3.4 Proposed scale and measure for placard captions

```css
:root {
  --step-0: clamp(17px, 12px + 1.1vw, 21px);   /* caption body; Fell needs the upper end */
  --step-1: calc(var(--step-0) * 1.25);          /* caption lead line, if any */
  --step-2: calc(var(--step-0) * 1.9);           /* chapter title on a page */
  --step-3: calc(var(--step-0) * 3.2);           /* title page */
  --step--1: calc(var(--step-0) * 0.78);         /* running head, folio, catchword */
}
.caption {
  position: fixed; inset: auto 0 calc(7svh + env(safe-area-inset-bottom, 0px));
  margin-inline: auto; max-width: 34em; padding-inline: 24px;
  font: 400 var(--step-0) / 1.45 "IM Fell English", "EB Garamond", Georgia, serif;
  font-variant-numeric: oldstyle-nums proportional-nums;
  color: var(--ink); text-align: center; text-wrap: pretty;
}
```

Thirty-four ems at 17 to 21 px is 60 to 75 characters, inside the readable range, and two or three lines at most; a caption longer than that belongs on the next page. `text-wrap: pretty` trades speed for better breaks and is Baseline since March 2024, and `balance` suits the two-line title ([MDN, text-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap)). The bottom inset adds `env(safe-area-inset-bottom)`, which needs `viewport-fit=cover` in the viewport meta to be non-zero on notched phones ([MDN, env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)). For the vertical placement use `svh` (the viewport with browser bars showing) rather than `vh`, which equals the large viewport and puts the caption under the toolbar, or `dvh`, which resizes as the bars move ([MDN, length units](https://developer.mozilla.org/en-US/docs/Web/CSS/length)); the Pudding's mobile advice is the same, avoid `vh` and measure `innerHeight` when JavaScript needs the number ([The Pudding, responsive scrollytelling](https://pudding.cool/process/responsive-scrollytelling/)).

## 4. Graph-paper theme

### 4.1 What makes real graph paper

- History and stock: the Met holds a pattern book of about 1596 with a woodblock-printed grid on every page; Dr Buxton patented printed coordinate paper in England in 1794; quad paper is printed light blue or grey at 2 to 5 squares per inch (US) or 5 mm (Europe); engineering paper is light green or tan translucent stock with the grid printed on the back, so the lines are seen through the sheet and stay faint; millimetre paper has ten squares per centimetre; grids are printed light so they vanish when the sheet is copied ([Wikipedia, Graph paper](https://en.wikipedia.org/wiki/Graph_paper)).
- Non-photo blue is `#A4DDED` (164, 221, 237), a blue that graphic-arts film could not see, used for guide lines under ink ([Wikipedia, Non-photo blue](https://en.wikipedia.org/wiki/Non-photo_blue)). Blueprints were white lines on Prussian blue (cyanotype, from 1842); diazo whiteprints from the 1940s inverted that to blue lines on white ([Wikipedia, Blueprint](https://en.wikipedia.org/wiki/Blueprint)). A whiteprint, not a cyanotype, is the right reference for a light theme.
- Pen widths: ISO technical pens come in 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0 mm, each step about the square root of two so drawings survive reduction; ISO 128's core four are 0.25 (white ring), 0.35 (yellow), 0.5 (brown), 0.7 (blue) ([Wikipedia, Technical pen](https://en.wikipedia.org/wiki/Technical_pen)). At 96 CSS px per inch, 0.25 mm is 0.95 px, 0.35 is 1.3 px, 0.5 is 1.9 px, 0.7 is 2.6 px: a thick-to-thin ratio of 2:1 between outlines and everything else.
- Line types: visible outlines continuous and thickest; hidden edges short-dashed; centre lines long-short dashed through the axes of circular features; dimension lines with arrows between extension lines; section hatching as thin patterned lines; phantom lines long and double-short dashed for parts not in the assembly ([Wikipedia, Engineering drawing](https://en.wikipedia.org/wiki/Engineering_drawing)).
- Title block: ISO 7200 requires title, drafter, approver, legal owner, document type, drawing number, sheet, and issue date ([Wikipedia, Engineering drawing](https://en.wikipedia.org/wiki/Engineering_drawing)). Fill them in character ("Simple Machines, sheet 3 of 12, The Lever, drawn by hand"), bottom right, inside a printed frame 10 mm in from the edge.
- Misregistration: the grid and the frame were separate printings from the ink, and the grid is under the sheet on engineering paper; so the grid must never be pixel-locked to the drawing. A second grid layer offset by a fraction of a pixel in a slightly different hue, and a grid that stops at the frame while the drawing may cross it, sells the print.

### 4.2 Recipe

Crisp rules want an SVG pattern with `shape-rendering="crispEdges"` on integer device pixels; CSS gradients blur at fractional `background-size`. The grid is 5 mm minor, 10 mm major, which at 96 dpi is about 19 px and 38 px; round to 19 and 38 (or 20 and 40) and accept the scale lie.

```html
<svg class="grid" aria-hidden="true">
  <defs>
    <pattern id="minor" width="19" height="19" patternUnits="userSpaceOnUse">
      <path d="M19 0H0V19" fill="none" stroke="rgb(120 150 200 / 0.28)" stroke-width="1" shape-rendering="crispEdges"/>
    </pattern>
    <pattern id="major" width="38" height="38" patternUnits="userSpaceOnUse">
      <rect width="38" height="38" fill="url(#minor)"/>
      <path d="M38 0H0V38" fill="none" stroke="rgb(100 135 195 / 0.55)" stroke-width="1" shape-rendering="crispEdges"/>
    </pattern>
  </defs>
  <!-- misregistered ghost: same grid, nudged, warmer, fainter -->
  <rect x="0.4" y="0.2" width="100%" height="100%" fill="url(#major)" opacity="0.35" style="filter: hue-rotate(20deg)"/>
  <rect width="100%" height="100%" fill="url(#major)"/>
  <!-- printed frame; the grid is clipped to it elsewhere -->
  <rect x="38" y="38" width="calc(100% - 76px)" height="calc(100% - 76px)" fill="none" stroke="rgb(60 80 120 / 0.8)" stroke-width="1.3"/>
</svg>
```

```css
[data-theme="graph"] .sheet { background: #f6f3ea; }           /* warm white stock */
[data-theme="graph"] .sheet::before { /* same fibre layer as the ink theme at a quarter of the amplitude */
  content: ""; position: absolute; inset: 0; background: var(--paper-raster); opacity: 0.25; mix-blend-mode: multiply;
}
[data-theme="graph"] .drawing { --stroke-thick: 1.9px; --stroke-thin: 0.95px; --ink: #1e2a3a; }
```

Drafting conventions for the machines in this theme: outlines at `--stroke-thick`, centre lines through every pivot and axle, section hatching at 45 degrees inside any cut solid (the wedge, a sectioned screw), dimension lines with open arrowheads and the live value in B612 Mono, and hidden edges short-dashed. The stroke renderer for this theme is a straight `ctx.lineTo`; the character comes from weights, dashes, and the grid, not from wobble.

```ts
// TechnicalRenderer line styles, in CSS px at 1x (ISO 0.5 / 0.25 mm)
const technical = {
  visible: { width: 1.9, dash: [] },
  hidden:  { width: 0.95, dash: [4, 2] },
  center:  { width: 0.95, dash: [18, 3, 3, 3] },
  phantom: { width: 0.95, dash: [18, 3, 3, 3, 3, 3] },
  section: { width: 0.95, dash: [], hatchAngle: 45, hatchGap: 4 },
  dimension: { width: 0.95, dash: [], arrow: "open", extensionGap: 2, extensionOverrun: 3 },
} as const;
```

Dimension text sits above the dimension line, reading from the bottom or the right of the sheet, in Routed Gothic at 2.5 mm nominal height (about 9.5 px), with the live value in B612 Mono `tabular-nums` so digits do not jitter as the lever moves.

Reference images: the Met's 1596 gridded pattern book and the period sheets on the Wikipedia graph-paper page; engineering paper's green-through-the-sheet look; a diazo whiteprint for the blue of the rules; a Rotring pen chart for the widths.

## 5. Case studies

| Site | URL | What it does well | Technique to steal |
| --- | --- | --- | --- |
| Ciechanowski, Mechanical Watch | https://ciechanow.ski/mechanical-watch/ | Opens with "the movement" as "the real star of the show"; every figure is announced by a sentence that names the action ("you can drag the device around... you can use the slider to peek at what's going on inside") | The invitation is in the prose, not in the chrome; colour-coding is kept consistent across all figures |
| Ciechanowski, Gears | https://ciechanow.ski/gears/ | Says up front that "movement is important in this article so most of the visualizations are animated"; sliders sit directly below each canvas figure; play/pause button in the figure's corner | Present the figure moving first, then hand over the slider; concept, animation, derivation, slider variation as the rhythm |
| Ciechanowski, Bicycle | https://ciechanow.ski/bicycle/ | "you can guide the rider with the slider, and you can also drag the view"; values (speed, angles, trail) drawn on the figure itself, not in the prose | Numbers live on the drawing; sliders scrub time so the reader, not a clock, sets the pace |
| Ciechanowski, Internal Combustion Engine | https://ciechanow.ski/internal-combustion-engine/ | All animations on by default with one global pause "if you find them distracting, or if you want to save power" | A single global motion switch, which is also the reduced-motion story |
| Ciechanowski, GPS | https://ciechanow.ski/gps/ | Inline figures, generous serif measure, a minimal header (Blog, Archives, social), bracketed live terms in the prose tied to the figure | Chrome is a single line; the page is the figure and the text |
| Explorable Explanations | https://explorabl.es/ | The hub for "learning through play"; browse by subject or at random | A contents page that is itself playful (random plate) |
| Bret Victor, Explorable Explanations | http://worrydream.com/ExplorableExplanations/ | Reactive documents, explorable examples, contextual information; "an active reader asks questions, considers alternatives"; text as "an environment to think in" | The caption should react to the reader's manipulation, not just describe |
| Nicky Case, Parable of the Polygons | https://ncase.me/polygons/ | Imperatives ("drag & drop unhappy polygons until nobody is unhappy") plus shapes that demonstrate the gesture; escalates one rule at a time; everything CC0 ([ncase.me](https://ncase.me/)) | Show the gesture, then ask for it; one new variable per page |
| Nicky Case, design patterns | https://blog.ncase.me/explorable-explanations-4-more-design-patterns/ | Puzzle it out, place your bets, role play, sandbox; start shallow and "gradually go deeper" | "Place your bets": ask which side of the lever wins before the reader touches it |
| Red Blob Games, little things | https://www.redblobgames.com/making-of/little-things/ | Hover and drag feedback, remember the grab offset, invisible hit areas bigger than the visible object, controls below the diagram so fingers do not cover it, "islands of interactivity", deterministic redraws to avoid flicker | All of it applies directly to a lever handle on a phone |
| Red Blob Games, draggable objects | https://www.redblobgames.com/making-of/draggable/ | Pointer events, `setPointerCapture`, `touch-action: none` plus `preventDefault` on touchstart, `user-select: none`, ignore non-left buttons, per-pointer state | The drag implementation for the handle, verbatim |
| Red Blob Games, A* | https://www.redblobgames.com/pathfinding/a-star/introduction.html | "Move the blob... to see the shortest path"; side-by-side comparisons; diagrams sized to the text column | Comparison pages: two levers with different arms side by side |
| The Pudding, responsive scrollytelling | https://pudding.cool/process/responsive-scrollytelling/ | Mobile first "forces you to pare down"; avoid `vh`; `matchMedia` to sync JS and CSS; remove hover; shorter on mobile | Our format is a slideshow, not scrolly, but the mobile discipline transfers; note the Pudding discourages steppers for scrolly stories, which is the opposite constraint from ours |
| The Pudding, home | https://pudding.cool/ | Minimal chrome; stories badged by interaction type | Badge the contents list: which plates are touchable |
| Museo Galileo, simple machines | https://catalogue.museogalileo.it/indepth/SimpleMachines.html | Authoritative framing: five traditional machines, "machines that cannot be broken down into parts that can serve, in turn, as machines"; but static text and a thumbnail | Steal the definition, not the interface; the catalogue is a 2010-2015 table layout ([catalogue index](https://catalogue.museogalileo.it/index.html)) |
| Codex Atlanticus (Ambrosiana, The Visual Agency) | https://codex-atlanticus.ambrosiana.it/ | Browses all of Leonardo's folios by subject, date, and colour in a Vue app; black with a teal accent, Awwwards honourable mention 2019 ([Awwwards](https://www.awwwards.com/sites/codex-atlanticus)) | The opposite decision to ours: modern chrome around period content. Proves the content survives it, and shows why our chrome must disappear instead |
| Turning the Pages (British Library, Armadillo) | https://en.wikipedia.org/wiki/Turning_the_Pages | Since 1997; Codex Leicester and Codex Arundel in version 2; models how heavy vellum "collapses under its own weight" during a turn | The page-turn as a feature only when the page's material is the subject; here it is not |
| Leonardo3 | https://www.leonardo3.net/en/ | Working physical models of Leonardo's machines in Milan; no online interactive found | Nothing technical; a reminder that the machines are the draw |
| Pentiment (Obsidian; Lettermatic type) | https://lettermatic.com/custom/pentiment | Five families reviving scribal and early printed hands; type writes itself stroke by stroke from ductus diagrams; three to four alternates per glyph so "bookkeeper" never repeats; "gently bleeding ink" and visible stroke overlaps rather than digital perfection; peasant script drawn with the non-dominant hand ([Wikipedia, Pentiment](https://en.wikipedia.org/wiki/Pentiment_(video_game))) | Draw-on in stroke order; per-instance variation; let overlaps show |
| Inkulinati (Yaza Games) | https://www.thesixthaxis.com/2019/10/31/playing-with-history-illuminating-the-insane-game-world-of-inkulinati/ | Battles on a manuscript page; palette (blue, red, yellow, green, gold) taken from 11th to 14th century marginalia; artist learned the style by copying manuscripts in ink; a medievalist checks authenticity | Learn the line by copying Besson and Ramelli plates before writing the renderer; keep a period palette list |
| Crayon Physics Deluxe | https://en.wikipedia.org/wiki/Crayon_Physics_Deluxe | Box2D bodies that keep the player's crayon drawing instead of collapsing to rectangles; the paper is the world | The closest precedent for "the drawing is the physics"; the body's collision shape and its drawn shape are separate and both matter |

How Ciechanowski pairs a slider with a diagram, in detail: the figure is inline in the column at the text's width, it animates by default, the slider is a plain horizontal control immediately beneath it (never floating over it), the sentence before the figure says what the slider does in the second person, and any quantity that changes is drawn on the figure rather than restated in the paragraph. Text and figure "move together" because the prose refers to the state the reader just created, so the reader scrolls a sentence, touches, reads the next sentence, which presumes the touch. For a full-viewport slideshow the same rhythm becomes: caption names the touch, the drawing responds, the next page's caption assumes what was learned.

## 6. Interaction and chrome

### 6.1 First-visit tooltip on the gear

NN/g's research on instructional overlays: users rarely read them, mobile users less so, and short-term memory fades in about twenty seconds, so show one tip at the moment it matters, keep it to a single interaction and as few words as possible, prefer a picture to text, and set it in a different font (handwritten-style fonts and illustrations signal "annotation, not UI") so it cannot be mistaken for a control ([NN/g, mobile instructional overlay](https://www.nngroup.com/articles/mobile-instructional-overlay/)). Coach-mark guidance from the broader UX literature adds: point at a real control, keep the interface readable, never trap the user in a tour. Recipe: on the first visit only (a `localStorage` flag), after the first plate has settled (about 1.5 s), draw a marginal note in faded ink next to the gear ("themes and settings"), with a manicule pointing at it, fading in over 400 ms; dismiss on any pointer, key, or scroll, or after 8 s; never repeat.

```ts
const KEY = "sm.hint.gear";
export function maybeShowGearHint(show: () => () => void) {
  let seen = false;
  try { seen = localStorage.getItem(KEY) === "1"; } catch { /* private mode: show once per session */ }
  if (seen) return;
  const t = setTimeout(() => {                       // under reduced motion the note appears without its fade; the CSS handles that
    const hide = show();
    const done = () => { hide(); try { localStorage.setItem(KEY, "1"); } catch {} ; off(); };
    const off = () => { for (const e of ["pointerdown", "keydown", "wheel", "touchstart"]) removeEventListener(e, done); clearTimeout(t2); };
    const t2 = setTimeout(done, 8000);
    for (const e of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(e, done, { once: true, passive: true });
  }, 1500);
}
``` The manicule is period-correct: a pointing hand drawn in margins by Renaissance readers and later cast as type, U+261E in Unicode ([Wikipedia, Manicule](https://en.wikipedia.org/wiki/Manicule)).

### 6.2 Hinting that the drawing is alive without breaking the illusion

Ranked by how little they disturb "it is just a drawing":

1. Motion that a real plate could not do: after the page's draw-on finishes, the lever settles with one slow, damped rock (a small impulse in the physics), then holds. Nothing on the page says "interactive"; the reader's eye says it. Red Blob's rule that redraws must be deterministic matters here, so the settle looks identical every visit ([little things](https://www.redblobgames.com/making-of/little-things/)).
2. The caption's verb: "press the long arm" set as a link-like ink underline, so the sentence is the affordance (Ciechanowski's pattern).
3. A marginal note with a manicule (section 6.1) pointing at the handle, in the Tufte sidenote position on wide screens and beneath the caption on phones ([Tufte CSS](https://edwardtufte.github.io/tufte-css/)).
4. A quiet highlight: the handle's ink breathes between 55 and 80 percent opacity on a 4 s cycle, in hint ink, stopping on first touch and under reduced motion. Because hint ink fails 3:1 on toned paper (section 1.7), this is decoration and never the sole cue.
5. An ink-drawn hand cursor (`cursor: url(hand.svg) 8 4, grab`, 32 px max) on hover over the handle, `grabbing` while dragging. Touch users never see it, which is why items 1 to 3 come first.

### 6.3 Page and chapter transitions

The View Transition API snapshots the old and new states and crossfades by default; `view-transition-name` gives an element its own animated group, `view-transition-class` shares styles across groups, `document.startViewTransition({ update, types })` tags a transition and `html:active-view-transition-type(backwards)` styles it, so back and forward can differ; always guard with `if (!document.startViewTransition) { update(); return }`, and under `prefers-reduced-motion` provide a gentler animation rather than none ([MDN, View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API); [Chrome, same-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document)). Motion (formerly Framer Motion, MIT) does the same in React land with `AnimatePresence mode="wait"` so the leaving page finishes before the entering one starts, and `initial={false}` to skip the entry animation on first render ([Motion, AnimatePresence](https://motion.dev/docs/react-animate-presence); [GitHub](https://github.com/motiondivision/motion)). Either works; the View Transition API keeps the drawing canvas out of React's render cycle, which is the better fit when the canvas is expensive to remount.

Which metaphor reads as elegant: the page curl is the ebook skeuomorph most criticised for doing "nothing to help with moving around the text" ([Ricardo Pinto, The trouble with skeuomorphs](https://www.ricardopinto.com/2013/02/12/the-trouble-with-skeuomorphs/)); Turning the Pages earns it only because the manuscript's physical behaviour is the exhibit. Recommendation: within a chapter, a 300 ms crossfade of the old plate into the new one, with the new drawing's draw-on (section 2.5) starting 150 ms in, so the ink appears to be laid down on the same sheet; between chapters, a slow lateral slide of the whole sheet (500 ms, ease-out) as if a leaf were turned flat, with forward and backward directions via transition types; no curl, no 3D.

```css
::view-transition-old(plate) { animation: 300ms ease-out both fade-out; }
::view-transition-new(plate) { animation: 300ms 150ms ease-in both fade-in; }
html:active-view-transition-type(chapter-forward)::view-transition-old(sheet) { animation: 500ms ease-out both slide-out-left; }
html:active-view-transition-type(chapter-forward)::view-transition-new(sheet) { animation: 500ms ease-out both slide-in-right; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*), ::view-transition-new(*) { animation-duration: 200ms; animation-name: fade-out; }
  ::view-transition-new(*) { animation-name: fade-in; }
}
```

### 6.4 Keyboard and touch navigation

Follow the ARIA carousel pattern for the slideshow semantics: container `role="group"` with `aria-roledescription="carousel"` and a label, each page `role="group"` with `aria-roledescription="slide"` and a name like "3 of 12", previous and next as real buttons that do not move focus, and any auto-rotation paused when focus or the pointer enters the region ([WAI-ARIA APG, carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)). Keys: ArrowRight, ArrowLeft, Space (next), Home, End, `c` for contents, `Escape` to close overlays. The physics handle is a focusable element with ArrowUp and ArrowDown applying force, so the lever is operable without a pointer. Touch: the drawing canvas takes `touch-action: none` and pointer capture for drags ([Red Blob, draggable](https://www.redblobgames.com/making-of/draggable/)); page swipes are recognised only on the caption and margin areas (horizontal travel over 40 px, mostly horizontal), so a drag on the lever never turns the page. Tap zones at the far left and right 8 percent of the width are an acceptable fallback on phones, with a visible focus ring drawn as an ink rectangle when navigating by keyboard.

### 6.5 Text at the bottom, and the contents list

Caption block as in section 3.4: fixed to the bottom with the safe-area inset, centred, 34 em, at most three lines. The running head (chapter, small caps) and folio sit top left in faded ink; the gear and "About" sit top right as two ink glyphs, never as buttons with backgrounds. The contents list is its own page in period dress: chapter titles and their plates with folio numbers in old-style figures, a fleuron between chapters, the touchable plates marked with a small manicule; reachable from the running head, from `c`, and from a link on the title page. It is also the only place with a visible list of the six machines, which doubles as the site map.

### 6.6 Reduced motion and contrast on textured paper

`prefers-reduced-motion: reduce` is the signal; MDN's guidance is that scaling and panning large objects are the vestibular triggers, and the recommended pattern is to override with a gentler animation rather than remove everything ([MDN, prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)). Under reduce: no draw-on, no breathing highlight, no settle impulse, transitions as short fades, and the physics idle until touched, with the same global pause switch Ciechanowski offers exposed in the gear.

Contrast: WCAG 1.4.3 requires 4.5:1 for normal text and 3:1 for large text (18 pt, or 14 pt bold), computed as `(L1 + 0.05) / (L2 + 0.05)` from relative luminance; AAA is 7:1 ([WCAG 2.2, Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)). Measured for the palette in section 1.7, against the darkest paper the text may sit on:

| Text | On paper mid `#e8dcc3` | On paper toned `#dfd0b1` | On vignette `#d6c39f` |
| --- | --- | --- | --- |
| Ink full `#2b211a` | 11.6:1 | 10.3:1 | 9.1:1 |
| Ink light `#4a3b2e` | 7.9:1 | 7.1:1 | 6.2:1 |
| Ink faded `#6b5540` | 5.2:1 | 4.6:1 | 4.1:1 |
| Hint ink `#8a7a68` | 3.1:1 | 2.7:1 | 2.4:1 |

Rules that follow: captions in full ink; running heads and catchwords in faded ink only at 17 px or larger and never over the vignette; hint ink only for decoration. Texture lowers effective contrast slightly because the multiply layers darken the paper unevenly, so keep the caption's zone within the "paper mid" band by fading the laid-line and toning layers under the caption (a soft radial mask), which also reads as the lighter, handled centre of a real page. Graph theme rules at `rgb(155 187 224)` on `#f6f3ea` are 1.8:1 by design; they must never carry meaning.

## 7. Theme architecture

The theme must change the stroke renderer, the paper, the hatching, the type, and the filters, not just colours. Three layers:

1. CSS tokens on `data-theme`. Tailwind v4 defines theme variables in `@theme`, which become `:root` custom properties and utilities; `@theme` cannot be nested under a selector, but plain custom properties can be overridden per selector, and `@theme inline` maps a token to a variable reference so utilities resolve the per-theme value ([Tailwind, theme variables](https://tailwindcss.com/docs/theme)). A custom variant keyed on the attribute gives `theme-graph:` utilities, the same mechanism the docs use for a data-attribute dark mode ([Tailwind, dark mode](https://tailwindcss.com/docs/dark-mode)).

```css
@import "tailwindcss";
@custom-variant theme-ink   (&:where([data-theme=ink],   [data-theme=ink] *));
@custom-variant theme-graph (&:where([data-theme=graph], [data-theme=graph] *));
@custom-variant theme-fusion (&:where([data-theme=fusion], [data-theme=fusion] *));

@theme inline {
  --color-paper: var(--t-paper);
  --color-ink: var(--t-ink);
  --color-ink-faded: var(--t-ink-faded);
  --font-caption: var(--t-font-caption);
  --font-label: var(--t-font-label);
}
[data-theme="ink"]   { --t-paper: #efe6d2; --t-ink: #2b211a; --t-ink-faded: #6b5540; --t-font-caption: "IM Fell English", "EB Garamond", serif; --t-font-label: "IM Fell English SC", serif; }
[data-theme="graph"] { --t-paper: #f6f3ea; --t-ink: #1e2a3a; --t-ink-faded: #5a6a80; --t-font-caption: "B612", sans-serif; --t-font-label: "Routed Gothic", sans-serif; }
[data-theme="fusion"]{ --t-paper: #ece4d0; --t-ink: #2a2420; --t-ink-faded: #6a5a4a; --t-font-caption: "EB Garamond", serif; --t-font-label: "Routed Gothic", sans-serif; }
```

2. A `SceneTheme` object consumed by the drawing layer. Scenes never import rough.js or perfect-freehand; they call a `StrokeRenderer`.

```ts
export interface StrokeStyle { weight: "thick" | "thin" | "hair"; dash?: "center" | "hidden" | "phantom"; pressure?: (t: number) => number }
export interface StrokeRenderer {
  /** Build a cached drawable for a rigid body in its local frame; seed fixes the hand. */
  body(id: string, shape: Polyline | Circle, seed: number, style: StrokeStyle & { hatch?: HatchSpec }): BodyDrawable;
  draw(ctx: CanvasRenderingContext2D, d: BodyDrawable, pose: { x: number; y: number; theta: number }, progress?: number): void;
  /** Deforming geometry, drawn fresh each frame, deterministic. */
  rope(ctx: CanvasRenderingContext2D, points: Point[], style: StrokeStyle): void;
}
export interface SceneTheme {
  id: "ink" | "graph" | "fusion" | (string & {});
  paper: { rasterize(w: number, h: number, dpr: number): Promise<CanvasImageSource> };
  stroke: StrokeRenderer;
  hatch: HatchSpec;                       // angle, gap, weight, crossHatch
  filters: { defs: string; captionFilter?: string; plateFilter?: string };  // SVG <defs> markup and ids
  motion: { drawOnMs: number; settleImpulse: number; hintBreath: boolean };
}
```

`InkRenderer` implements `body` with rough.js drawables plus perfect-freehand outlines and `rope` with perfect-freehand; `TechnicalRenderer` implements both with plain `lineTo`, ISO weights, and dash patterns; `FusionRenderer` wraps `InkRenderer` with `roughness: 0.4`, adds centre lines from `TechnicalRenderer`, and uses the technical hatch. The `progress` argument on `draw` drives draw-on (fraction of segments drawn), so entry animation is theme-independent.

3. Per-theme SVG filter defs. `ThemeProvider` mounts one hidden `<svg>` containing `theme.filters.defs` with ids namespaced by theme (`#ink-bleed-ink`, `#ink-bleed-fusion`), and exposes the ids as CSS variables (`--caption-filter: url(#ink-bleed-ink)`), so captions do `filter: var(--caption-filter, none)`. The graph theme sets it to `none`.

Adding a fourth theme later (say, vellum with iron-gall brown, or a cyanotype blueprint): add `themes/vellum.ts` exporting a `SceneTheme`, a `[data-theme="vellum"]` token block and `@custom-variant theme-vellum`, the fonts, and register it in `themes/index.ts`; the six scenes do not change because they only know `SceneTheme`. Persist the choice in `localStorage` and apply the attribute in an inline script before first paint so the first frame is already the chosen paper. The switch itself should ship behind a feature flag per the repository rules, and the default theme is ink.

## 8. Open questions that need a visual prototype

1. Paper: whether procedural fibre at 1x and 2x reads as rag or as noise, and how much scanned tile is needed on top; the laid-line pitch and chain-line spacing, which must be measured from a scan.
2. Line: the `roughness`, `bowing`, and pressure-profile values at which the lever reads as a burin line rather than a cartoon sketch; whether `disableMultiStroke` is right for all bodies or only outlines.
3. The settle impulse: whether one slow rock on load sells "alive" or spoils "static plate", and its amplitude.
4. Ink bleed on captions: whether the filter is worth its cost on iOS at every page change, or whether captions should be pre-rendered.
5. Transition timing: crossfade duration versus draw-on start, and whether the chapter slide should move the paper texture or only the ink.
6. Fell English at caption size on phones: whether its irregularity stays legible at 17 to 19 px, or EB Garamond must take the body with Fell reserved for heads.
7. Hatching cost on mid-range phones with three or four hatched bodies moving at once, and whether hatch should be baked into per-body bitmaps instead.
8. Graph theme rule density and colour at 2x, where 1 px rules become hairlines; whether the misregistered ghost layer reads as print or as blur.

## Sources

Web platform documentation:

- MDN: [feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence), [feDiffuseLighting](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDiffuseLighting), [feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap), [feMorphology](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feMorphology), [feComponentTransfer](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feComponentTransfer), [filter](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/filter), [pathLength](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/pathLength), [mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode), [will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change), [Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API), [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [initial-letter](https://developer.mozilla.org/en-US/docs/Web/CSS/initial-letter), [font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric), [size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust), [text-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap), [env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env), [length units](https://developer.mozilla.org/en-US/docs/Web/CSS/length).
- Chrome Developers: [Same-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document).
- W3C: [WCAG 2.2 Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [ARIA APG carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).
- Tailwind CSS v4: [Theme variables](https://tailwindcss.com/docs/theme), [Dark mode and custom variants](https://tailwindcss.com/docs/dark-mode).

Practitioner articles and libraries:

- Jimmy Chion, [Grainy Gradients](https://css-tricks.com/grainy-gradients/), CSS-Tricks, 2021. Dirk Weber, [The Art of SVG Filters and Why It Is Awesome](https://www.smashingmagazine.com/2015/05/why-the-svg-filter-is-awesome/), Smashing Magazine, 2015. [GSAP forum thread on feTurbulence mobile performance](https://gsap.com/forums/topic/33075-gsap-and-feturbulence-mobile-performance/). Henry, [How to distort text with SVG filters](https://fw21.henry.codes/writing/how-to-distort-text-with-svg). [Creating organic textures with SVG filter distortions](https://dev.to/hexshift/creating-organic-textures-with-svg-filter-distortions-1moj). CSS-Tricks, [How SVG line animation works](https://css-tricks.com/svg-line-animation-works/).
- [rough.js](https://roughjs.com/) and its [API wiki](https://github.com/rough-stuff/rough/wiki); [perfect-freehand](https://github.com/steveruizok/perfect-freehand); [Excalidraw](https://github.com/excalidraw/excalidraw) and its [element types](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/types.ts); [Motion](https://github.com/motiondivision/motion) and [AnimatePresence](https://motion.dev/docs/react-animate-presence).
- GPU Gems 2, [Tile-based texture mapping](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-12-tile-based-texture-mapping).
- Tufte CSS, [sidenotes](https://edwardtufte.github.io/tufte-css/). Butterick, Practical Typography: [line length](https://practicaltypography.com/line-length.html), [point size](https://practicaltypography.com/point-size.html). NN/g, [Instructional overlays and coach marks](https://www.nngroup.com/articles/mobile-instructional-overlay/).

Paper, ink, and printing history:

- [Paper through Time: European papers](https://paper.lib.uiowa.edu/european.php), University of Iowa. Kamińska et al., [Colorimetric study of the post-processing effect due to pulsed laser cleaning of paper](https://www.dbc.wroc.pl//Content/109152/optappl_3401p121.pdf), Optica Applicata 34(1), 2004.
- Wikipedia: [Laid paper](https://en.wikipedia.org/wiki/Laid_paper), [Deckle](https://en.wikipedia.org/wiki/Deckle), [Foxing](https://en.wikipedia.org/wiki/Foxing), [Iron gall ink](https://en.wikipedia.org/wiki/Iron_gall_ink), [Ink](https://en.wikipedia.org/wiki/Ink), [Engraving](https://en.wikipedia.org/wiki/Engraving), [Woodcut](https://en.wikipedia.org/wiki/Woodcut), [De re metallica](https://en.wikipedia.org/wiki/De_re_metallica), [Agostino Ramelli](https://en.wikipedia.org/wiki/Agostino_Ramelli), [Jacques Besson](https://en.wikipedia.org/wiki/Jacques_Besson), [Fell types](https://en.wikipedia.org/wiki/Fell_types), [Fleuron](https://en.wikipedia.org/wiki/Fleuron_(typography)), [Catchword](https://en.wikipedia.org/wiki/Catchword), [Manicule](https://en.wikipedia.org/wiki/Manicule), [Graph paper](https://en.wikipedia.org/wiki/Graph_paper), [Technical pen](https://en.wikipedia.org/wiki/Technical_pen), [Engineering drawing](https://en.wikipedia.org/wiki/Engineering_drawing), [Non-photo blue](https://en.wikipedia.org/wiki/Non-photo_blue), [Blueprint](https://en.wikipedia.org/wiki/Blueprint), [Turning the Pages](https://en.wikipedia.org/wiki/Turning_the_Pages), [Pentiment](https://en.wikipedia.org/wiki/Pentiment_(video_game)), [Crayon Physics Deluxe](https://en.wikipedia.org/wiki/Crayon_Physics_Deluxe).

Textures and fonts:

- [ambientCG](https://ambientcg.com/) ([licence](https://docs.ambientcg.com/license/)), [Poly Haven licence](https://polyhaven.com/license), [Wikimedia Commons, Category:Paper textures](https://commons.wikimedia.org/wiki/Category:Paper_textures), [fromoldbooks.org](https://fromoldbooks.org/oratiodominica/pages/orationis-p05-texture/119x146-q75.html).
- Google Fonts repository metadata: [IM Fell English](https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/METADATA.pb), [IM Fell DW Pica](https://raw.githubusercontent.com/google/fonts/main/ofl/imfelldwpica/METADATA.pb), [IM Fell French Canon](https://raw.githubusercontent.com/google/fonts/main/ofl/imfellfrenchcanon/METADATA.pb), [IM Fell Great Primer SC](https://raw.githubusercontent.com/google/fonts/main/ofl/imfellgreatprimersc/METADATA.pb), [EB Garamond](https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/METADATA.pb), [Cormorant Garamond](https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/METADATA.pb), [Cardo](https://raw.githubusercontent.com/google/fonts/main/ofl/cardo/METADATA.pb), [Libre Caslon Text](https://raw.githubusercontent.com/google/fonts/main/ofl/librecaslontext/METADATA.pb), [Architects Daughter](https://raw.githubusercontent.com/google/fonts/main/ofl/architectsdaughter/METADATA.pb), [B612](https://raw.githubusercontent.com/google/fonts/main/ofl/b612/METADATA.pb). Also [iKern on the Fell types](https://www.ikern.space/about), [Junicode](https://github.com/psb1558/Junicode-font), [Cardo at scholarsfonts.net](https://www.scholarsfonts.net/cardofnt.html), [Routed Gothic](https://webonastick.com/fonts/routed-gothic/), [osifont](https://github.com/hikikomori82/osifont).

Case studies:

- Bartosz Ciechanowski: [Mechanical Watch](https://ciechanow.ski/mechanical-watch/), [Gears](https://ciechanow.ski/gears/), [Bicycle](https://ciechanow.ski/bicycle/), [Internal Combustion Engine](https://ciechanow.ski/internal-combustion-engine/), [GPS](https://ciechanow.ski/gps/).
- [Explorable Explanations](https://explorabl.es/); Bret Victor, [Explorable Explanations](http://worrydream.com/ExplorableExplanations/); Nicky Case, [ncase.me](https://ncase.me/), [Parable of the Polygons](https://ncase.me/polygons/), [Explorable explanations: 4 more design patterns](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/).
- Amit Patel, Red Blob Games: [Little things I care about](https://www.redblobgames.com/making-of/little-things/), [Draggable objects](https://www.redblobgames.com/making-of/draggable/), [Introduction to A*](https://www.redblobgames.com/pathfinding/a-star/introduction.html).
- The Pudding: [home](https://pudding.cool/), [Responsive scrollytelling best practices](https://pudding.cool/process/responsive-scrollytelling/), [How to implement scrollytelling](https://pudding.cool/process/how-to-implement-scrollytelling/).
- Museo Galileo: [Simple machines](https://catalogue.museogalileo.it/indepth/SimpleMachines.html), [multimedia catalogue](https://catalogue.museogalileo.it/index.html). [Codex Atlanticus](https://codex-atlanticus.ambrosiana.it/) and its [Awwwards entry](https://www.awwwards.com/sites/codex-atlanticus). [Leonardo3](https://www.leonardo3.net/en/).
- Lettermatic, [Pentiment type](https://lettermatic.com/custom/pentiment). TheSixthAxis, [Illuminating the insane game world of Inkulinati](https://www.thesixthaxis.com/2019/10/31/playing-with-history-illuminating-the-insane-game-world-of-inkulinati/). Ricardo Pinto, [The trouble with skeuomorphs](https://www.ricardopinto.com/2013/02/12/the-trouble-with-skeuomorphs/).
