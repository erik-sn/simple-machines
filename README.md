# Simple Machines

An interactive book about the six simple machines: the lever, the wheel and axle, the pulley, the inclined plane, the wedge, and the screw. It opens like a treatise from the 1600s, black ink on laid paper, and every drawing is a live 2D physics simulation: touch the lever and it turns, hang a weight and it pulls. The book has an introduction, six chapters, and a conclusion, the Theatre of Machines, where the machines can be placed on a bench, joined, and run together.

## Getting started

```bash
mise trust && mise install
just setup      # dependencies, hooks, .env
just check      # lint, types; CI runs the same
just e2e        # the Playwright journeys in a real browser
just dev-frontend
```

`just shots DIR` captures every page in every theme at desktop and phone sizes, which is how the site is reviewed.

## How it is built

- [frontend/](frontend/): the site. React 19 with TypeScript, Vite, and Tailwind v4. Physics on Planck.js (a Box2D port); ink strokes generated once per body with rough.js so the hand's wobble is welded to the body; the paper rasterized once from SVG filters; three switchable themes (ink on paper, graph paper, fusion). [frontend/README.md](frontend/README.md) explains the packages and layout.
- [e2e/](e2e/): Playwright journeys, the project's only test suite (there are no unit tests, by decision), plus the screenshot tool.
- [docs/research/](docs/research/): the dossiers the book is written from: the history of each machine, the physics modeling, the aesthetics, and public-domain plates with their licences.
- [docs/adr/](docs/adr/): settled decisions (engine, rendering, themes).
- [PROJECT.md](PROJECT.md): project memory: what this is, the rules that override the template's ceremony, and every template takeover with its reason.

## Production

The frontend ships as a static site in an nginx container built from the repository root and deployed through the fleet (see [docs/fleet.md](docs/fleet.md)); merging to `main` publishes the image. This repo was generated from the bootstrap template and receives its updates; [docs/template.md](docs/template.md) explains the ownership rules.
