# Project memory

Hobby project, not production facing. Where a rule here conflicts with the ceremony in AGENTS.md or a stack AGENTS.md, this file wins; the template's gates (lint, typecheck, template-check) still run as they are.

## What this is (decided 2026-09-29)

An elegant, subtle, book-like interactive treatise on the six classical simple machines: lever, wheel and axle, pulley, inclined plane, wedge, screw. Opening it feels like opening a treatise from the 1600s: black ink drawings on laid paper that turn out to be live 2D physics when touched. Structure: a title page and introduction (six placards), six chapters of seven placards, and the Theatre of Machines (two), a free-form bench where visitors place machines, join their ports, and run the compound.

- The whole viewport is the illustration. A placard sits at the foot, a catchword and folio at the bottom right, the way back at the bottom left, the gear and About top right, readouts as notes in the right margin. Nothing else.
- Physics: 2D, gravity down, no visible ground. Bodies hang in space; any body can be pinned to the page. Planck.js, fixed 1/60 s step (docs/adr/0002).
- Drawing: one SVG in world metres; rough.js geometry seeded per part so the wobble is welded to the body; hatching only on shadow sides, the way an engraver would; the paper rasterized once from filters plus a CC0 rag tile (docs/adr/0003).
- Themes are one site with a toggle, never separate sites: ink on paper (default), graph paper, fusion (docs/adr/0004).
- Hosted through the fleet as the template's nginx image. Public repo at github.com/erik-sn/simple-machines.
- Research dossiers live in docs/research (history, physics, aesthetics, and 142 licensed plates with a manifest). The copy is written from them; docs/copy.md holds the style rules and the claims left out.

## How the book is built

- frontend/src/book: chapters.ts is the whole book as data (stage id, title, text, mode, scene and variant); paths.ts maps positions to URLs; BookShell.tsx is one page.
- A stage's mode: still (held at rest by an unseen hand until touched), driven (a scripted demonstration that replays, and resumes after the reader lets go), free (held until touched, the placard says what to do).
- frontend/src/physics: types.ts is the machine contract (parts with body-local shapes, ropes as per-frame geometry, statics, ports for the Theatre, a per-step hook, readouts, hold, script). One file per machine under physics/machines exports `machine`; scenes/registry.ts collects them with import.meta.glob, so only machines may live in that folder (parts.ts, the shared weight block, lives beside it).
- frontend/src/scenes: the controller (world, hand, script, loop), the SVG view, the composed frontispiece for the title page.
- frontend/src/theatre: the bench. composition.ts is the saved form (gzipped in the URL hash, also remembered for the session), prefabs add a weight and a hook, seed.ts builds the opening tackle, vignettes.ts draws the bench list.
- Review is by screenshots: `just shots DIR` captures every page in every theme at two sizes; `node e2e/tools/shot-one.ts <path> <out.png>` captures one page. Critique rounds (visual, interaction, editorial) run as agents against those captures and the code; their findings are applied, not stored.

## Rules for this repo

- No unit or component tests (`just test` is a no-op). Coverage is Playwright journeys in e2e/tests, one per user goal.
- No feature flags, no i18n catalog (English inline), no auth, no API client: there is no backend. The template's frontend rules about RTK Query, flags, and t() do not apply; its rules on components, markup, styling, and accessibility do.
- ADRs only for structural choices. Plain TODO comments are fine.
- Fonts and scripts are self-hosted: nginx.conf ships a same-origin Content-Security-Policy, which also rules out WebAssembly engines.
- Captions stay under 230 characters, facts come only from [P] and [S] claims in the dossier, numbers are figures, quotations attributed in the sentence.
- Commits go through the pre-commit hooks; commit specific paths, since agents may be mid-edit elsewhere in the tree.

## Template takeovers (why each file diverges)

- tools/template_check.py: a path listed in project.json template_takeovers counts as taken over when the file is deleted; the template version reports every deleted template-owned file as divergence with no way out. Port this to bootstrap and restore the marker at the next template update.
- frontend/src/main.tsx, frontend/vite.config.ts, frontend/src/components/PageTitle.tsx: the store, Vitest, the API proxy, and i18n were removed from them.
- The deleted template-owned files (auth, flags, store, i18n, test helpers, codegen config, component tests) are listed in project.json template_takeovers.

## Known template gaps (bootstrap's to fix, noted here so nobody re-diagnoses them)

- A frontend-only generation seeds a journey spec that needs the backend; removed here.
- The answers file records an SSH template source, which CI cannot clone, so the template-check job fails in CI. tools/template_check.py routes TEMPLATE_TOKEN (CI passes the RENOVATE_TOKEN secret) only for https or gh: sources, and bootstrap is private: the fix is an https `_src_path` plus that secret.
- The github_owner answer was recorded as a full repo path; corrected to the bare owner so images publish under ghcr.io/erik-sn.
- .github/workflows/osv-scan.yml calls google/osv-scanner-action's reusable workflow at `@v2`, a ref that repository does not have (its tags are v2.x.y), so every run fails before a job starts. Pin a full tag upstream (v2.6.0 is the newest as of 2026-09-30); the file is template-managed, so it is not fixed here.

## Open follow-ups

- Stevin's wreath of spheres and the ball in a groove are told, not drawn: the inclined plane needs `wreath` and `ball` variants.
- Machine parts are not operable by keyboard; a focusable handle with arrow keys driving a motor is the plan in docs/research/physics.md.
- The Theatre reports the compound's effort, loads, and ratio; a per-stage walk from joint reaction forces is described in the physics dossier and not built.
- Per-variant setting defaults (the cart wants lower friction than the sled) need the contract to take a variant into the defaults.
- The graph theme could carry a title block and dimension lines; the fusion theme an annotation layer. Both are sketched in docs/research/aesthetics.md.
