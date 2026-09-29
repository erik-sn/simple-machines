# Project memory

Hobby project, not production facing. Where a rule here conflicts with the ceremony in AGENTS.md or a stack AGENTS.md, this file wins; the template's gates (lint, typecheck, template-check) still run as they are.

## What this is (decided 2026-09-29)

An elegant, subtle, book-like interactive story of the six classical simple machines: lever, wheel and axle, pulley, inclined plane, wedge, screw. Opening it should feel like opening a treatise from the 1600s: black ink drawings on textured paper that turn out to be live 2D physics when touched. Structure: an introduction, six chapters (each a sequence of stages mixing history, a driven demonstration, and free interaction), and a conclusion, the Theatre of Machines, a free-form playground where visitors drag machines onto the page, connect them, and simulate the compound.

- The whole viewport is the illustration. Placard-length text sits at the bottom. A settings gear (with a first-visit tooltip) and an About link sit top right. Nothing else.
- Physics: 2D, gravity down, no visible ground. Bodies hang in space and any body can be pinned to the page.
- Themes are one site with a toggle, never separate sites: ink-on-paper (the default, perfected first), graph paper, and a fusion. A theme changes the stroke renderer, paper, and type, not just colours, so a fourth can be added without touching a scene.
- Per-chapter settings tune the physics (masses, lengths, friction, gravity).
- Hosted through the fleet as the template's nginx image. Public repo at github.com/erik-sn/simple-machines.
- Research dossiers live in docs/research (history, images with licenses, physics, aesthetics). Site copy is written from them and stays placard length.

## Rules for this repo

- No unit or component tests (Vitest and its helpers are removed; `just test` is a no-op). Coverage is Playwright journeys in e2e/tests, per e2e/AGENTS.md, one per user goal.
- No feature flags, no i18n catalog (English inline), no auth, no API client: there is no backend. The template's frontend rules about RTK Query, flags, and t() do not apply; its rules on components, markup, styling, and accessibility do.
- ADRs only for structural choices (engine, rendering, theme architecture). Plain TODO comments are fine.
- Fonts and scripts are self-hosted: nginx.conf ships a same-origin Content-Security-Policy.

## Template takeovers (why each file diverges)

- tools/template_check.py: a path listed in project.json template_takeovers now counts as taken over when the file is deleted; the template version reports every deleted template-owned file as divergence with no way out. Port this to bootstrap and restore the marker at the next template update.
- frontend/src/main.tsx, frontend/vite.config.ts, frontend/src/components/PageTitle.tsx: the store, Vitest, the API proxy, and i18n were removed from them.
- The deleted template-owned files (auth, flags, store, i18n, test helpers, codegen config, component tests) are listed in project.json template_takeovers.

## Known template gaps (bootstrap's to fix, noted here so nobody re-diagnoses them)

- A frontend-only generation seeds a journey spec that needs the backend; removed here.
- The answers file records an SSH template source, which CI cannot clone, so the template-check job fails in CI until the source is https (or CI gets a deploy key).
- The github_owner answer was recorded as a full repo path; corrected to the bare owner so images publish under ghcr.io/erik-sn.
