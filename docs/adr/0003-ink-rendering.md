# 0003 - Illustrations are SVG with seeded rough.js ink over once-rasterized paper

Status: accepted (2026-09-29)
Decided by: user (delegated; research in docs/research/aesthetics.md and physics.md section 5)

## Context

The drawings must look like a 1600s engraving on laid paper while moving at 60 frames per second, staying accessible (focusable parts, a draw-on reveal), and staying cheap on phones. Live SVG filters on moving or full-viewport elements are the known failure mode on iOS.

## Decision

- The scene is one SVG in world metres (y up): static ink, one group per rigid body whose transform is written imperatively each frame, rope paths rewritten each frame, HTML readouts in the margin.
- The hand-drawn look is geometry, not filters: each shape is generated once with rough.js, seeded from its part, in a scaled space (rough.js assumes pixel units), and cached, so the wobble is welded to the body and never boils. Filled shapes are hatched. Strokes are non-scaling and take their width and colour from the theme.
- The paper is built from SVG filters (fibre, mottle, foxing) rasterized once per theme, size, and pixel ratio into a canvas, with laid lines and toning as CSS gradient layers under multiply. No filter runs live.
- Page entry draws the ink on with `pathLength="1"` and a stroke-dashoffset animation, disabled under reduced motion.

## Rationale

SVG gives DOM semantics and the reveal for free, and a hundred transform writes per frame is well within budget. Generating the wobble once with a seed is what Excalidraw does; a per-frame filter would re-rasterize every moving group. Rasterizing the paper once keeps the most expensive filters off the frame loop entirely.

## Alternatives considered

- Canvas for the dynamic layer: no accessibility tree and manual dash bookkeeping; kept as the escape hatch behind the same draw interface if the playground passes a few hundred bodies.
- WebGL ink shaders: the best possible look, unjustified for a few dozen bodies.
- Live feTurbulence and feDisplacementMap on the drawing: the iOS crash mode.

## Consequences

- New shape kinds must be composed from segment, polygon, circle, and arc, or added to the renderer.
- Text never sits inside the flipped SVG group; labels live in HTML.
- A theme changes the pen (roughness, hatching) and the paper recipe, not the scenes.
