# 0004 - One site, switchable themes that change paper, pen, and type

Status: accepted (2026-09-29)
Decided by: user

## Context

The owner wants a Renaissance ink-on-paper look, a high-quality graph-paper look, and a fusion of the two, and wants more themes possible later, without building separate sites. A theme has to change how the lever is drawn, not only the colours around it.

## Decision

Themes are one site with a toggle. `data-theme` on the root element selects a block of CSS custom properties (paper, inks, accent, four font roles, three pen widths) that Tailwind reads through `@theme inline`. The paper rasterizer and the ink renderer switch on the theme id: each theme has its own paper recipe and its own rough.js pen (roughness, bowing, hatch angle and gap). Scenes know nothing about themes. The choice is persisted and applied before first paint.

## Rationale

A theme object consumed by the drawing layer is the only way "graph paper" can mean technical-pen lines on a printed grid rather than a recoloured engraving. Keeping scenes theme-blind means a fourth theme is one token block, one paper recipe, and one pen.

## Consequences

- Every theme must define the full token set; a missing token is a bug, not a fallback.
- Contrast is checked per theme (the accessibility scan runs in the e2e suite); faint ink is decoration only.
- The default is ink; graph and fusion are tuned second.
