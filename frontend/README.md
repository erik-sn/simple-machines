# Frontend: technology choices and packages

The site is a single-page React application written in TypeScript, built by Vite, served in production by unprivileged nginx with a same-origin Content-Security-Policy (so fonts and scripts are bundled and WebAssembly is not an option). Versions live in [package.json](package.json) and the workspace lockfile; this page explains what each piece is for. The end-to-end suite in [../e2e](../e2e) is documented here too because it exists to exercise this application.

## The book

- `src/book/`: the structure and chrome. `chapters.ts` is the ordered list of chapters and their stages (caption, scene, mode); `paths.ts` maps positions to URLs (`/`, `/<slug>`, `/<slug>/<n>`, `/theatre`); `BookShell.tsx` is one page: paper, scene, placard, page-turn arrows, the settings gear with its first-visit note, the About modal with the contents. Arrow keys turn the pages, resolving the position from the URL at keypress so a key pressed during a view transition still turns the right page. Progress and preferences live in localStorage behind a guard (`src/lib/storage.ts`).
- `src/theme/`: the themes. `themes.ts` names them; `ThemeProvider.tsx` persists the choice and sets `data-theme` on the root; `index.css` holds each theme's tokens (paper, inks, four font roles, three pen widths), read by Tailwind through `@theme inline`; `paper.ts` builds the sheet from SVG filters (fibre, mottle, foxing; a grid and frame for graph paper) and rasterizes it once per theme, size, and pixel ratio into the canvas `Paper.tsx` shows.
- `src/ink/render.ts`: shapes in body-local metres become ink. rough.js generates each shape once, seeded from its part, in a scaled space (the library assumes pixel units); filled shapes are hatched; the graph theme runs the same generator at zero roughness.

## The physics

- `src/physics/`: Planck.js (`planck`), a TypeScript port of Box2D 2.4, chosen for its pulley and gear joints and per-joint reaction forces (docs/adr/0002). `loop.ts` steps at a fixed 1/60 s with an accumulator and interpolates poses; `hand.ts` is the reader's hand, a mouse joint on the static page body whose reaction force is the effort readout; `types.ts` is the contract every machine implements; `machines/` holds one file per machine, each exporting a module the scene registry collects automatically.
- `src/scenes/`: `controller.ts` owns one scene's world, hand, demonstration script, and loop, and writes interpolated transforms straight onto the SVG groups; `SceneView.tsx` is the SVG (static ink, one group per body, rope paths rewritten each frame, the hint ring, the marginal readouts); `Scene.tsx` picks a scene by kind and remounts it whenever the machine, settings, or mode change, so a reset is always a rebuild.
- `src/theatre/`: the conclusion. `composition.ts` is the bench's saved form (machines, per-node settings, links between ports) with link validation and gzipped URL serialization; `TheatreController.ts` builds every machine bare at its place in one shared world and joins them; `TheatreView.tsx` is the bench, its palette, and the pointer interaction (drag a port to a port to join, drag a handle to move, grab a part to push); `prefabs.ts` adds a weight and a hook.

## Type and paper

- Fonts are bundled through `@fontsource`: IM Fell English, English SC, and French Canon for the ink theme (the Fell types are the only genuinely 17th-century faces available under the OFL), EB Garamond for fusion, B612 and B612 Mono for graph paper.
- Tailwind v4 through `@tailwindcss/vite`; theme tokens in `src/index.css`, no config file.

## Development tooling

- pnpm workspace (`frontend`, `e2e`); Vite with `@vitejs/plugin-react` and the React Compiler through `@rolldown/plugin-babel`; Biome for formatting and linting (`biome.base.json` is template-owned, `biome.json` extends it and enables Tailwind directives); TypeScript strict with `erasableSyntaxOnly`.
- No unit tests, by decision (PROJECT.md): the Playwright suite in `../e2e` covers reading, settings, contents, and the Theatre, and `just shots` captures every page for review.
