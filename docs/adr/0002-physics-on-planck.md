# 0002 - The simulations run on Planck.js

Status: accepted (2026-09-29)
Decided by: user (delegated the engine choice; research in docs/research/physics.md)

## Context

Every illustration in the book is a live 2D rigid-body simulation: six machines with pins, guides, ropes, gears, and contacts, tunable settings, a scripted demonstration per stage, and a playground that joins machines into compounds. The site is static and served by nginx with a same-origin Content-Security-Policy that has no `wasm-unsafe-eval`, so WebAssembly engines cannot run without taking over the template's nginx config.

## Decision

Physics runs on Planck.js (`planck`, a TypeScript port of Box2D 2.4), stepped at a fixed 1/60 s with an accumulator and pose interpolation, 8 velocity and 3 position iterations. Scenes are rebuilt from data on every reset or settings change, never undone in place. The reader's hand is a mouse joint on a static page body, and its reaction force is the effort readout.

## Rationale

Planck is the only maintained engine with the full joint set the machines map onto one-to-one: revolute and prismatic with motors and limits, pulley (the block and tackle), gear (wheel-to-load coupling and the screw's rotation-to-translation), rope, weld, and mouse. Every joint reports its reaction force, which is what the mechanical-advantage readouts measure. It is pure JavaScript, 55 KB gzipped, needs no asynchronous initialisation, and its state is plain objects that can be stepped through in the browser.

## Alternatives considered

- Rapier 2D: a stronger solver and cross-browser determinism, but no gear, pulley, or mouse joint (hand-written couplings with a one-step lag), about 0.9 MB of WebAssembly, and blocked by the CSP. Kept as the fallback if chained machines in the playground prove unstable.
- Box2D v3 bindings: the best solver, but v3 removed the pulley and gear joints, and the binding is a one-person project.
- Matter.js: no rigid joints, no continuous collision, no release in two years.
- A hand-rolled solver: months of work on contacts and stacking for no gain over an engine that permits custom constraints.

## Consequences

- The Box2D 2.4 solver limits mass ratios to about 10:1 across a joint and sags long chains; settings are clamped and the playground raises iterations for long chains.
- Ropes are never simulated as chains of segments; they are joints for the physics and geometry for the drawing.
- Determinism holds on one browser, not across browsers; demonstrations last seconds, so this is acceptable.
