# Physics and engineering approach

Research notes for the interactive illustrations: which 2D rigid-body engine to build on, how to model each of the six machines in it, how compound machines connect in the playground, how interaction and the frame loop work inside React, and how the ink-on-paper rendering fits. Registry and repository facts were checked on 2026-09-29 against npm, GitHub, and the installed packages; measured sizes are from the published tarballs.

## Summary

- Engine: Planck.js (`planck` 1.5.0), a TypeScript port of Box2D 2.4. It is the only maintained engine that ships every joint this site needs: revolute and prismatic with motors and limits, pulley, gear (which couples a revolute to a prismatic, exactly what the screw needs), rope, weld, and mouse. It is 55 KB gzipped, needs no WebAssembly initialisation, and every joint exposes `getReactionForce`, which is what the readouts measure.
- Fallback: Rapier 2D (`@dimforge/rapier2d` 0.21.0) if the Box2D 2.4 solver proves too soft for chains of gears and pulleys in the playground. It has a stronger solver, cross-browser determinism, and rope and spring joints, but no pulley, gear, or mouse joint, so those become hand-written couplings. It also costs about 0.9 MB gzipped.
- Rendering: SVG. Hand-drawn paths per body inside a `<g>` whose `transform` is written imperatively each frame; the ink and paper filters live only on static layers; stroke-dashoffset reveals draw the illustrations on chapter entry. Canvas is the escape hatch if the playground exceeds a few hundred bodies.
- Hardest problems: ropes that wind and sag (solved by coupling with engine joints and drawing the rope from geometry, not simulating it), and the screw (solved by a gear joint with ratio equal to 2π over the lead, plus a barber-pole thread drawing).

## 1. Engine comparison

### Facts as of 2026-09-29

| Engine | npm package and version | Published | Repo last push | Stars | License | Types | Size (min, gzip) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Planck.js | `planck` 1.5.0 | 2026-04-07 | 2026-09-22 | 5.3k | MIT | Written in TS, ships `planck.d.ts` | 297 KB, 55 KB |
| Matter.js | `matter-js` 0.20.0 | 2024-06-23 | 2026-09-24 | 18.4k | MIT | Community `@types/matter-js` 0.20.2 (2025-09) | 83 KB, 26 KB |
| Rapier 2D | `@dimforge/rapier2d` 0.21.0 (also `-compat`, `-simd`) | 2026-09-25 | 2026-09-27 | 5.8k | Apache-2.0 | Generated `.d.ts` shipped | wasm 2.40 MB, 908 KB gzip, plus 298 KB JS glue; `-compat` is one 3.41 MB file, 1.29 MB gzip |
| box2d3-wasm | `box2d3-wasm` 5.2.0 | 2026-02-16 | 2026-02-16 | 65 | MIT | Emscripten-generated `.d.ts` | wasm 417 KB, 153 KB gzip, plus 97 KB glue (compat flavour); deluxe flavour 428 KB wasm plus 136 KB glue |
| box2d-wasm | `box2d-wasm` 7.0.0 | 2021-11-28 | 2024-12-29 | 306 | Zlib | Shipped `.d.ts` | wasm 161 KB |
| p2-es | `p2-es` 1.2.3 | 2023-11-01 | 2024-04-22 | 143 | MIT | Written in TS | 302 KB, 67 KB |
| p2.js (original) | `p2` 0.7.1 | 2022 (code from 2017) | 2022-07-09 | 2.7k | MIT | None | n/a |

Release cadence: Planck published six versions between 2024-12 and 2026-04 (1.1.5, 1.2.0, 1.3.0, 1.4.x, 1.4.3, 1.5.0) and keeps a changelog in the repo, no GitHub releases. Matter.js has had no release in 27 months although commits continue; it has 278 open issues. Rapier's JS bindings now live in the main `dimforge/rapier` repo (the old `rapier.js` repo is archived) and track the Rust crate, whose 0.36.0 shipped on 2026-09-24; JS 0.20.0 was 2026-08-08 and 0.21.0 was 2026-09-25. box2d3-wasm is a one-person project that released five versions in 2025-11 and one in 2026-02, then nothing for seven months. box2d-wasm wraps Box2D 2.4.1 and its README points to box2d3-wasm for v3; treat it as finished. p2-es has been silent since 2024-04.

Sources: [npm planck](https://www.npmjs.com/package/planck), [piqnt/planck.js](https://github.com/piqnt/planck.js), [liabru/matter-js](https://github.com/liabru/matter-js), [dimforge/rapier](https://github.com/dimforge/rapier), [Birch-san/box2d3-wasm](https://github.com/Birch-san/box2d3-wasm), [Birch-san/box2d-wasm](https://github.com/Birch-san/box2d-wasm), [pmndrs/p2-es](https://github.com/pmndrs/p2-es).

### Notes per engine

- Planck.js is a line-for-line port of Box2D 2.4 into idiomatic TypeScript, with the 2.4 joint set intact (Box2D 2.4.1 itself dropped the rope joint; Planck kept it). Bodies, fixtures, and joints are plain objects with getters, the `Joint` base class is subclassable, and there is a `Serializer`. The known solver limits are 2.4's: chains sag, mass ratios above about 10:1 across a joint get spongy, and iterations rather than substeps buy accuracy. A closed issue ([#45](https://github.com/piqnt/planck.js/issues/45)) is the only gear-joint report; there are no pulley-joint issues on the tracker.
- Matter.js is the most popular by stars but has a single constraint type (a spring with `stiffness`, `damping`, and `length`) plus a mouse constraint, no motors, no limits, no prismatic, and no continuous collision. A lever is a stiff spring pretending to be a pin, and a wedge tunnels. Types are community-maintained. It is the wrong shape for this site.
- Rapier 2D is a Rust engine compiled to WASM with first-class TypeScript bindings and a solver from the same family as Box2D v3. It has revolute and prismatic joints with motors and limits, rope, spring, and fixed joints, per-body extra solver iterations, dominance groups, CCD, snapshots, and documented cross-platform determinism. It lacks gear, pulley, and mouse joints. Its wasm grew to 2.4 MB with the soft-body work in 0.36, and Vite needs the wasm plugin or the base64 `-compat` build.
- box2d3-wasm wraps Box2D v3 through Emscripten. The engine underneath is the best 2D solver available (Soft Step, speculative contacts, determinism, SIMD), and the wasm is small, but the binding is one person's project, the API is the C one with manual `delete()` of embind objects, and v3 removed exactly the two joints this site leans on. Catto says improved pulley and gear joints are planned, not shipped.
- box2d-wasm wraps Box2D 2.4.1 and is superseded by box2d3-wasm per its own README. Same joint set as Planck minus the rope joint, with the WASM boundary and none of the readability. No reason to prefer it over Planck.
- p2-es is the maintained fork of p2.js with revolute, prismatic, gear, distance-with-limits, lock, and wheel constraints, springs, per-body CCD, and a runner with interpolation. The joint set is nearly right (no pulley, no mouse joint, but a spring does for dragging) and the code is readable TypeScript. It has had no release since 2023-11 and no commits since 2024-04, and its solver is the older Gauss-Seidel with per-constraint stiffness, which needs tuning per scene. Choosing it means forking it.

### Joints and solver features

Read from each package's shipped type definitions (`planck.d.ts`, `impulse_joint.d.ts`, `Box2D.deluxe.d.ts`, `p2-es.d.ts`, `@types/matter-js`).

| Feature | Planck.js | Matter.js | Rapier 2D | box2d3-wasm (Box2D v3) | p2-es |
| --- | --- | --- | --- | --- | --- |
| Revolute with motor and limits | Yes (`RevoluteJoint`, `enableMotor`, `enableLimit`) | No (pin via `Constraint` length 0, no motor or limit) | Yes (`RevoluteImpulseJoint`, `configureMotor*`, `setLimits`) | Yes (`b2RevoluteJointDef` with spring, limit, motor) | Yes (`RevoluteConstraint`) |
| Prismatic with motor and limits | Yes | No | Yes | Yes | Yes |
| Pulley | Yes (`PulleyJoint`, `length1 + ratio * length2 = const`) | No | No | No (removed in v3.0) | No |
| Gear (couples two joints, revolute or prismatic) | Yes (`GearJoint`) | No | No | No (removed in v3.0) | Yes (`GearConstraint`) |
| Rope or distance with max length | `RopeJoint` (max length), `DistanceJoint` | `Constraint` with stiffness (spring, no max length) | `JointData.rope(length)`, `JointData.spring` | `b2DistanceJointDef` with `minLength`, `maxLength`, spring, motor | `DistanceConstraint` with upper and lower limits |
| Weld | Yes | Stiff `Constraint` pairs only | `JointData.fixed` | `b2WeldJointDef` with linear and angular springs | `LockConstraint` |
| Mouse or drag joint | `MouseJoint` (soft, `maxForce`, `frequencyHz`, `dampingRatio`) | `MouseConstraint` | None (use a kinematic body plus spring joint) | None in the wrapped build (Box2D 3.1 has `b2MouseJointDef`, main branch dropped it) | None (use a `LinearSpring`) |
| Continuous collision | Bullet flag plus time-of-impact substep for dynamic vs static | None (open since [issue #5](https://github.com/liabru/matter-js/issues/5); see [#309](https://github.com/liabru/matter-js/issues/309)) | `setCcdEnabled`, `setSoftCcdPrediction` | Speculative contacts on by default, bullets for dynamic vs dynamic | Per body `ccdSpeedThreshold`, `ccdIterations` |
| Solver | Box2D 2.4 sequential impulses, velocity and position iterations | Verlet-style with position and constraint iterations | "Small steps" velocity solver (PR [#579](https://github.com/dimforge/rapier/pull/579)), `numSolverIterations`, `numInternalPgsIterations`, per body `setAdditionalSolverIterations` | Soft Step: substeps, soft constraints, relaxation; 4 substeps recommended | Gauss-Seidel with per-constraint stiffness and relaxation |
| Determinism | Same browser: yes. Cross-browser: not guaranteed (`Rot.ts` uses `Math.sin`, `Math.cos`, `Math.atan2`) | Same browser only | Documented cross-platform deterministic in WASM | Cross-platform deterministic (custom trig, no FMA) | Same browser only |
| Save and restore | `Serializer.toJson` and `fromJson` | `Composite` serialisation is manual | `world.takeSnapshot()` and `World.restoreSnapshot()` | Manual | Manual |
| Custom constraint | Subclass the abstract `Joint` (`initVelocityConstraints`, `solveVelocityConstraints`, `solvePositionConstraints`) | Not designed for it | Not possible from JS | Not possible from JS | Subclass `Constraint` |

Sources: [Planck joints docs](https://piqnt.com/planck.js/docs/joint/pulley.html), [Rapier JS joints](https://rapier.rs/docs/user_guides/javascript/joints), [Rapier JS rigid bodies (CCD, dominance)](https://rapier.rs/docs/user_guides/javascript/rigid_bodies), [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism), [Box2D v3 migration guide](https://box2d.org/documentation/md_migration.html) ("The pulley and gear joints have been removed. I'm not satisfied with how they work in 2.4 and plan to implement improved versions in the future."), [Box2D v3 simulation docs](https://box2d.org/documentation/md_simulation.html), [Box2D v3 determinism post](https://box2d.org/posts/2024/08/determinism/), [p2-es docs](https://p2-es.pmnd.rs/docs/).

### Friction, stacking, chains, and mass ratios

- Box2D 2.4 (Planck, box2d-wasm) resolves friction with a Coulomb model, mixed as the geometric mean of the two fixtures' coefficients. Ramps and wedges behave correctly for slow motion. Its known weaknesses are mass ratios beyond roughly 10:1 across a joint and long chains, which sag and stretch under the position solver. Both are avoidable in this project by clamping settings.
- Box2D v3's Soft Step solver is, in Erin Catto's words in the [3.0 release post](https://box2d.org/posts/2024/08/releasing-box2d-3.0), "more stable in almost every way than version 2.4" including "higher mass ratios, longer chains of bodies, larger stacks". The [Solver2D](https://box2d.org/posts/2024/02/solver2d/) study compared eight solvers (PGS variants, TGS variants, XPBD) and chose TGS_Soft, later renamed Soft Step. Rapier's post-0.17 solver is in the same family.
- Matter.js has no continuous collision and no rigid joints; a wedge driven into two blocks tunnels, and a lever needs a stiff spring pretending to be a pin. It is unsuitable.
- p2-es has the right joint set and per-body CCD but no maintenance for two and a half years; adopting it means owning it.

### Fixed timestep ergonomics inside React

- Planck: `world.step(dt, velocityIterations, positionIterations)`, synchronous, no async init. The docs recommend a fixed 1/60 s step and 8 velocity, 3 position iterations, and say "An iteration is not a sub-step" ([simulation docs](https://piqnt.com/planck.js/docs/world/simulation.html)). Bodies and joints are plain objects, so a React component can hold a reference in a ref without lifecycle ceremony.
- Rapier: `world.timestep` is fixed (default 1/60) and `world.step()` is synchronous, but the module must be loaded asynchronously. `@dimforge/rapier2d` needs Vite's WebAssembly ESM integration ([vite-plugin-wasm](https://github.com/Menci/vite-plugin-wasm) 3.6.0 plus top-level await), or the `-compat` package embeds the wasm as base64 in one 3.4 MB file. All handles are indexes into WASM memory, so a hot-reloaded React tree holding stale handles is a classic bug source.
- box2d3-wasm: embind objects (`b2BodyDef`, `b2Vec2`) must be freed with `delete()` and the API is the C one (`b2Body_ApplyForce(bodyId, ...)`), which makes every scene definition verbose. The bindings expose `b2World_Step(worldId, dt, subStepCount)`.
- Matter.js and p2-es both ship their own runners; p2's `world.step(dt, elapsed, maxSubSteps)` does the accumulator and exposes `interpolatedPosition` for rendering.

### Hand-rolled solver

A sequential-impulse solver in the style of [Box2D-Lite](https://github.com/erincatto/box2d-lite) (Catto, [GDC 2006](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf), [Soft Constraints GDC 2011](https://box2d.org/files/ErinCatto_SoftConstraints_GDC2011.pdf)) or a position-based one after Müller et al., [Detailed Rigid Body Simulation with Extended Position Based Dynamics (2020)](https://matthias-research.github.io/pages/publications/PBDBodies.pdf), is a few thousand lines: shapes, a broadphase, convex contact manifolds with warm starting, Coulomb friction, six joint types, sleeping, and some form of continuous collision for the wedge. XPBD makes joints and ropes pleasant (substeps instead of iterations, stiff joints by default) but contacts with friction and stacking are where the months go. The site does not need its own engine; it needs its own couplings on top of one, and Planck permits that because its `Joint` base class is subclassable and its state is plain JavaScript. Not recommended as the engine, recommended as the mindset for the two or three custom constraints below.

### Recommendation

Planck.js. Reasons, in order: it has the pulley joint and the gear joint, which no other maintained engine has and which map one-to-one onto the pulley, wheel-and-axle, and screw chapters; it is readable TypeScript with no WASM boundary, so bugs in a compound machine can be stepped through in the browser; every joint reports reaction force and torque, which is the mechanical-advantage readout; it has a serializer for save and restore; and it is 55 KB. Its solver is the 2.4 one, which is good enough for scenes of a few dozen bodies at 60 Hz with 8 and 3 iterations, and the playground can raise iterations or substep when it detects long joint chains.

Fallback: Rapier 2D. Switch only if the playground's chained machines visibly sag or jitter after tuning. It brings a better solver, documented cross-browser determinism, rope and spring joints, and soft-body ropes (`SoftBodyDesc.rope`, new in 0.36), at the cost of about 0.9 MB gzipped, async loading, and hand-written gear and pulley couplings (a per-step kinematic coupling driven by motor targets). box2d3-wasm becomes a candidate if Catto ships the reworked pulley and gear joints and the binding keeps up.

What the fallback costs, using the screw as the example: without a gear joint the rotation-to-translation coupling is written by hand each step, driving the prismatic motor to the position implied by the revolute angle and feeding the platform's reaction back to the screw as torque.

```ts
// Rapier: couple a revolute (screw spin) to a prismatic (platform lift) by hand, once per step.
const theta = screw.rotation() - theta0;
lift.configureMotorPosition((lead * theta) / (2 * Math.PI), 1e6, 1e4); // stiff position motor
// Back-reaction: the load on the platform resists the turn. Read the motor force after the step
// (not exposed directly in the JS bindings; estimate from the platform's weight and acceleration)
// and apply the equivalent torque to the screw before the next step.
screw.addTorque(-(loadForce * lead) / (2 * Math.PI), true);
```

Two joints, a one-step lag, and a torque estimate instead of a measured one: it works, but it is exactly the kind of coupling a gear joint solves implicitly and stably, and the pulley needs the same treatment. That is the whole argument for Planck.

## 2. Modeling each machine

Conventions used below: Planck world units are metres (Box2D is tuned for bodies between 0.1 m and 10 m), gravity is `(0, -9.81)`, the page maps 1 m to about 100 px, and "fixed" means a static body (`type: "static"`), which is how a part is pinned to the page. There is no ground; anything that must not fall is either static or hangs from a joint on a static body. The user's hand is a `MouseJoint` attached to a static anchor body; its `getReactionForce(1 / dt)` is the effort force. Friction inside a joint is a motor with `motorSpeed: 0` and a maximum torque or force, which is a Coulomb friction model for the pin or guide.

Ideal mechanical advantage (IMA) is geometric. Actual mechanical advantage (AMA) is measured: load force divided by effort force, both read from the simulation while the machine moves slowly. Efficiency is AMA divided by IMA. All readouts average over about ten steps to hide solver jitter, and are shown only when the machine is near equilibrium (small velocities), otherwise the inertial terms make the numbers lie.

Every chapter shares one skeleton: a static `page` body that anything "pinned to the page" attaches to, a scene builder that turns the settings object into bodies and joints in a fixed order, and a readout sampler that reads forces after each step and averages them.

```ts
class ForceSampler {
  private samples: number[] = [];
  constructor(private readonly window = 10) {}
  push(force: number): void {
    this.samples.push(force);
    if (this.samples.length > this.window) this.samples.shift();
  }
  mean(): number {
    return this.samples.reduce((a, b) => a + b, 0) / Math.max(1, this.samples.length);
  }
}

// After each world.step(DT, 8, 3):
const effort = hand ? hand.getReactionForce(1 / DT).length() : 0; // the mouse joint's force on the grabbed body
effortSampler.push(effort);
const loadForce = load.getMass() * G; // quasi-static: weight, not weight plus m * a
const ama = effortSampler.mean() > 1e-3 ? loadForce / effortSampler.mean() : NaN;
const settled = load.getLinearVelocity().length() < 0.05 && Math.abs(bar.getAngularVelocity()) < 0.05;
```

`ama` is displayed only when `settled` is true; otherwise the readout says "moving". Joint reaction forces are the constraint impulse divided by dt, which is what `getReactionForce(inv_dt)` returns for every Planck joint.

### Lever

Bodies: a bar (`Box(halfLength, 0.03)`, density 1), a fulcrum drawn on a static body, a load body hanging from a pin on the bar. Joint: `RevoluteJoint` between the static fulcrum body and the bar at the fulcrum point, optionally with `enableLimit` for a stop. Load: a `RevoluteJoint` (or a short `RopeJoint` for a hanging weight) at the load point. Effort: the mouse joint on the effort point, or a slider-set force applied every step with `bar.applyForce(force, worldPoint)`.

```ts
import { Box, Circle, MouseJoint, RevoluteJoint, Vec2, World } from "planck";

const world = new World({ gravity: new Vec2(0, -9.81) });
const page = world.createBody(); // static anchor for everything pinned to the page
const bar = world.createBody({ type: "dynamic", position: new Vec2(0, 0) });
bar.createFixture(new Box(1.5, 0.03), { density: 1, friction: 0.4 });
const fulcrum = world.createJoint(
  new RevoluteJoint({ enableMotor: true, motorSpeed: 0, maxMotorTorque: settings.pinFriction }, page, bar, new Vec2(settings.fulcrumX, 0)),
);
const load = world.createBody({ type: "dynamic", position: new Vec2(-1.2, -0.4) });
load.createFixture(new Circle(0.15), { density: settings.loadMass / (Math.PI * 0.15 ** 2) });
world.createJoint(new RevoluteJoint({}, bar, load, new Vec2(-1.2, 0)));
```

The three classes differ only in where the fulcrum, load, and effort sit along the bar: class 1 has the fulcrum between (seesaw), class 2 has the load between (wheelbarrow, IMA always above 1), class 3 has the effort between (tweezers, IMA below 1). One scene with three presets is enough; the settings expose fulcrum position, load mass, bar length, and pin friction.

Readouts: IMA = d_E / d_L, the perpendicular distances from the fulcrum to the effort and load lines of action, recomputed from body transforms each frame so tilting the bar changes it. AMA = F_L / F_E where F_L is the load's weight (`load.getMass() * g`) and F_E is the mouse joint's reaction force projected perpendicular to the bar. With pin friction τ_f the balance is F_E d_E = F_L d_L + τ_f, so AMA = F_L d_E / (F_L d_L + τ_f) and efficiency = AMA / IMA drops as the friction slider rises. Also show the fulcrum reaction (`fulcrum.getReactionForce(1 / dt)`), which teaches that the pivot carries the sum.

### Wheel and axle

Bodies: one dynamic body with two fixtures, `Circle(R)` for the wheel and `Circle(r)` for the axle (or a low-density wheel and a dense hub), pinned by a `RevoluteJoint` to a static body at its centre. The load hangs on a rope wound on the axle; the effort is a rope pulled from the wheel rim, or simply the user grabbing the rim.

Three ways to model a rope that winds:

1. Chain of segments with revolute joints, wrapping by contact against the circle. Realistic-looking but the least robust: many segments, contacts on a curved surface, mass-ratio issues between segments and load, and the 2.4 solver stretches chains. Not recommended for the physics.
2. A rope joint whose length changes with the angle. The rope leaves the axle at a fixed tangent point (the axle centre is static), so a `RopeJoint` between the static page body (anchor at the tangent point) and the load, with `maxLength` set every step to `L0 - r * (θ - θ0)`, is geometrically exact and allows slack. But the load's tension then pulls on the page, not the wheel, so a torque `-T * r` must be applied to the wheel each step from the rope's reaction force. This explicit two-way coupling lags one step and can oscillate when the load is heavy relative to the wheel.
3. Kinematic coupling done by the engine: hang the load on a vertical `PrismaticJoint` (an invisible guide on the static body) and bind that prismatic to the wheel's revolute with a `GearJoint` of ratio 1 / r. Planck's gear joint enforces `coordinate1 + ratio * coordinate2 = constant` and transmits force scaled by the ratio, so the wheel feels torque T r and the load feels tension T exactly. Unconditionally stable, no tuning. Its one lie is that the coupling is bilateral: pushing the load up drives the wheel backwards instead of going slack. Detect slack (`prismatic.getReactionForce` sign flips) and swap the gear joint for a rope joint if that case ever needs to be shown; in the chapter it does not.

Recommendation: option 3 for the physics, and draw the rope from geometry: an arc on the axle from the winding angle plus a straight line from the tangent point to the load. The effort side needs no rope at all: the user grabs the rim with the mouse joint, and the effort force is its reaction. Settings: R, r, load mass, bearing friction (motor torque at speed 0).

```ts
const guide = world.createJoint(new PrismaticJoint({}, page, load, load.getPosition(), new Vec2(0, 1)));
const hub = world.createJoint(new RevoluteJoint({ enableMotor: true, motorSpeed: 0, maxMotorTorque: settings.bearingFriction }, page, wheel, wheel.getPosition()));
// angle + (1 / r) * translation = const: turning the wheel by dθ moves the load by r * dθ
world.createJoint(new GearJoint({}, wheel, load, hub, guide, 1 / settings.axleRadius));
```

Readouts: IMA = R / r. AMA = F_L / F_E where F_E is the tangential component of the mouse force at the rim (or the applied force) and F_L the load weight. Efficiency falls with the bearing friction slider; because the friction is a torque, its effect on AMA is τ_f / (F_L r), larger for small axles, which is a nice thing to show.

### Pulley

Three scenes: a single fixed pulley (IMA 1, changes direction), a single movable pulley (IMA 2), and a block and tackle with n supporting strands (IMA n).

Options for the rope:

- `PulleyJoint`: two bodies, two static ground anchors, `length1 + ratio * length2 = constant`; the docs state "When the ratio is 2, one side extends twice as fast while experiencing half the constraint force" ([Planck pulley docs](https://piqnt.com/planck.js/docs/joint/pulley.html)). One joint models any block and tackle: body A is the movable block (load attached), body B is the handle the user pulls, and ratio 1 / n gives n lengths of rope on the block side per length pulled, so the handle moves n times farther and the block feels n times the force. The docs warn "Pulleys can be troublesome when one side is fully extended. The rope on the other side will have zero length. At this point the constraint equations become singular (bad)." The Planck type comments add that they "often work better when combined with prismatic joints". So: put the block and the handle on vertical prismatic guides with limits that stop travel before either length reaches zero. The joint is rigid, so it has no slack or sag.
- Rope of segments: cosmetically right, physically fragile for the same reasons as the winding rope. Box2D v3 and Rapier's soft bodies handle chains far better, which is the one argument for the fallback engine if a real slack rope is ever a requirement.
- Custom rope constraint: a unilateral maximum-distance constraint is what `RopeJoint` already is; a "rope over a fixed point" with a moving tangent point is a small subclass of `Joint` (same Jacobian as the pulley joint with one side removed). Worth writing only if the pulley joint's singularities bite.

Recommendation: `PulleyJoint` plus prismatic guides for the physics; draw the rope from geometry and let it look like a rope. Each strand is a path from an anchor to a tangent point on a sheave circle; taut strands are straight, and a strand whose constraint force is below a threshold (or whose measured length is below its stored free length) is drawn as a quadratic curve with sag proportional to the slack. The sheaves rotate visually by the strand displacement divided by the sheave radius.

```ts
const block = world.createBody({ type: "dynamic", position: new Vec2(0, -1) }); // movable block plus load
const handle = world.createBody({ type: "dynamic", position: new Vec2(1.2, -1) }); // what the user grabs
world.createJoint(new PrismaticJoint({ enableLimit: true, lowerTranslation: -0.9, upperTranslation: 0.9 }, page, block, block.getPosition(), new Vec2(0, 1)));
world.createJoint(new PrismaticJoint({ enableLimit: true, lowerTranslation: -2.9, upperTranslation: 0.4 }, page, handle, handle.getPosition(), new Vec2(0, 1)));
const strands = settings.strands; // supporting strands on the movable block
world.createJoint(new PulleyJoint({}, block, handle, new Vec2(0, 1), new Vec2(1.2, 1), block.getPosition(), handle.getPosition(), 1 / strands));
```

Readouts: IMA = number of strands supporting the movable block, counted from the scene definition (in the playground, counted from the links attached to the block port). AMA = F_L / F_E with F_E the mouse force on the handle; efficiency comes from sheave friction, modelled as a `RevoluteJoint` motor on the visual sheave or, simpler, as a friction force on the handle's prismatic guide (`maxMotorForce` at speed 0) scaled by the number of sheaves the rope passes.

### Inclined plane

Bodies: a static ramp, either `Box` rotated by θ or a `Polygon` (convex, at most 12 vertices in Planck, so a wedge-shaped ramp is one polygon), and a dynamic block `Box`. Friction: Planck mixes fixture friction as the geometric mean, so set both fixtures to μ and the contact coefficient is exactly μ. Effort: the mouse joint (the hand pushes anywhere) or a `PrismaticJoint` along the slope with a motor whose `maxMotorForce` is the effort slider, which makes the force-distance trade explicit: the motor force, the distance travelled along the slope, and the height gained are all readable.

Readouts: IMA = L / h = 1 / sin θ. Static balance on a frictionless ramp needs F_E = W sin θ; with friction moving up needs F_E = W (sin θ + μ cos θ), so AMA = 1 / (sin θ + μ cos θ) and efficiency = sin θ / (sin θ + μ cos θ). Show work in (F_E times distance along the slope) against work out (W times height) as two bars that stay equal without friction and diverge with it. The block stays put without effort when μ ≥ tan θ, a threshold worth marking on the angle slider. Settings: θ, μ, block mass, gravity.

Stability: the ramp and block are large, slow, and convex, so the 2.4 solver has no trouble; the one care point is not to let the settings make the block a bullet through the ramp (see clamping in section 3).

### Wedge

Bodies: a triangular `Polygon` wedge with half-angle β (thickness t at the back, length L, tan β = t / (2L)), and two blocks that get split. Without a ground, the blocks sit on horizontal `PrismaticJoint` guides on the static page body, resisted by whatever represents the log: guide friction (`maxMotorForce` at speed 0) and a `DistanceJoint` spring between the blocks with `frequencyHz` and `dampingRatio` for the elastic resistance. The wedge rides a vertical `PrismaticJoint` driven by the user (mouse joint on its head) or by a motor force slider.

Two ways to transmit the force:

- Contact: the wedge faces push the blocks apart through collision with friction μ. This is the honest model and shows self-locking when μ > tan β. Tunneling is the risk: a sharp tip driven hard pushes through the gap. Mitigations: keep the tip angle at 10° or more (the polygon skin `Settings.polygonRadius` rounds it anyway), keep the blocks' inner faces long so contact manifolds have two points, set `bullet: true` on the wedge so it does time-of-impact against the blocks, cap the drive force (the effort slider is clamped to a few times the total block resistance), and let `Settings.maxTranslation` (2 m per step by default) cap the speed. If a prototype still tunnels, step the world four times at dt/4 for this scene.
- Gear coupling: bind the wedge's vertical prismatic to each block's horizontal prismatic with a `GearJoint` of ratio tan β. The kinematics are exact and cannot tunnel, and friction becomes the guide motor. This loses the contact-friction self-locking demonstration unless the guide friction is scaled by the measured normal force each step.

Recommendation: contact, with the mitigations above, because the wedge chapter is about friction on faces; keep the gear coupling as the fallback if the prototype misbehaves.

Readouts: IMA = L / t = 1 / (2 tan β), the force on each block divided by the drive force. With friction, each face carries normal force N with F_E = 2N (sin β + μ cos β) and the outward push per block is N (cos β - μ sin β), so AMA = (1 - μ tan β) / (2 (tan β + μ)) and the wedge self-locks when μ > tan β. Measure AMA live as the block guide's reaction force (or the spring force) divided by the drive force. Contact forces are also readable from the `post-solve` event's `ContactImpulse.normalImpulses` divided by dt, which is what draws the force arrows on the faces.

### Screw

The screw is a rotation coupled to a translation with a fixed ratio, which is exactly a `GearJoint` between a `RevoluteJoint` and a `PrismaticJoint`. Planck's type comments confirm the pairing: "Either joint can be a revolute or prismatic joint... If one joint is a revolute joint and the other joint is a prismatic joint, then the ratio will have units of length or units of 1/length."

Screw jack: the screw body (drawn side-on) is pinned to the static base by a `RevoluteJoint` about its axis (in 2D this means the revolute axis points out of the page, so the "turning" is drawn as the thread pattern moving, see below); the platform carrying the load sits on a vertical `PrismaticJoint` on the base; a `GearJoint` binds them with `angle + ratio * translation = const` and `ratio = -2π / lead` so one turn lifts the platform by one lead. The handle is a body welded to the screw at radius R that the user grabs with the mouse joint; the effort is the tangential mouse force at R. A screw press is the same scene upside down with the load replaced by a spring (`DistanceJoint` with `frequencyHz`) whose compression is the readout.

```ts
const spin = world.createJoint(new RevoluteJoint({ enableMotor: true, motorSpeed: 0, maxMotorTorque: 0 }, base, screw, screw.getPosition()));
const lift = world.createJoint(new PrismaticJoint({ enableLimit: true, lowerTranslation: 0, upperTranslation: settings.travel }, base, platform, platform.getPosition(), new Vec2(0, 1)));
// one full turn (2π rad) advances the platform by one lead
world.createJoint(new GearJoint({}, screw, platform, spin, lift, -(2 * Math.PI) / settings.lead));
```

Friction: thread friction depends on the load, so set `spin.setMaxMotorTorque(μ * N * r_thread)` every step where N is the axial thrust and r_thread the mean thread radius. In Planck the prismatic guide carries only side load and its stops, and `GearJoint.getReactionForce` is zero when joint1 is a revolute, so read the thrust as `gear.getReactionTorque(1 / dt) * 2π / lead`; both gear accessors return NaN before the first solve, so treat step 0 as unloaded. That reproduces the textbook efficiency η = tan λ / tan(λ + φ) with lead angle λ = atan(lead / (2π r_thread)) and friction angle φ = atan μ, and the self-locking condition μ > tan λ (the jack holds the load when the hand lets go). A hand-coded per-step kinematic coupling instead of the gear joint is unnecessary in Planck; it is what the Rapier fallback would have to do.

The alternative side-view treatment, a thread drawn as an unrolled inclined plane, belongs in the prose and an illustration, not the simulation: show a ramp, wrap it around a cylinder, and point at the lead angle. The gear-joint scene is the interactive one.

Drawing a turning thread in 2D: a helix seen from the side is a set of parallel slanted lines at the lead angle, and rotating the helix by dθ looks identical to translating those lines along the axis by lead times dθ / 2π. So the thread is an SVG `<pattern>` (or a group of slanted stroke paths) clipped to the shank rectangle, with its `patternTransform` translated by `(θ / 2π) * lead` modulo `lead`. Draw the far half of each line thinner or lighter and the near half heavier to sell the depth; a `<g transform="translate(0, offset)">` update per frame is all it costs. The nut or platform does not rotate; it rises.

Readouts: IMA = 2πR / lead with R the handle radius. AMA = F_L / F_E from the load weight and the tangential mouse force. Efficiency compares to the η formula above and visibly collapses to tens of percent for realistic μ, which is the point of the chapter.

## 3. Compound machines and the playground

### Connection model

Each machine is a prefab: a pure data description that, given a position and settings, creates its bodies and joints in the world and returns a map of named ports. A port is a typed attachment point in the prefab's local frame.

```ts
type PortKind = "pin" | "ropeEnd" | "ropeAnchor" | "face" | "shaft" | "handle";

interface Port {
  id: string;
  kind: PortKind;
  local: { x: number; y: number };
  accepts: readonly PortKind[]; // pin accepts pin, ropeEnd accepts ropeAnchor, face accepts face, shaft accepts pin
}

type MachineKind = "lever" | "wheelAxle" | "pulley" | "inclinedPlane" | "wedge" | "screw" | "weight" | "anchor";

interface MachineNode {
  id: string;
  kind: MachineKind;
  x: number;
  y: number;
  angle: number;
  fixed: boolean; // pinned to the page (static body) or free
  settings: Record<string, number>;
}

interface Link {
  a: { node: string; port: string };
  b: { node: string; port: string };
  joint: "revolute" | "rope" | "weld" | "contact";
}

interface Composition {
  v: 1;
  gravity: number;
  nodes: MachineNode[];
  links: Link[];
}
```

Dropping a port within a snap radius of a compatible port creates a link, and the link decides the joint: pin to pin is a `RevoluteJoint` at the shared point (lever tip on the wheel's handle port), rope end to rope anchor is a `RopeJoint` with the current distance as the maximum (a pulley's handle hanging from a lever tip), face to face is no joint at all, just proximity that lets contact happen (a wedge under a lever end), and a pin to a shaft port is a revolute that turns with the shaft. The prefab exposes which ports are outputs (load side) and which are inputs (effort side), which the readout uses below. Snap candidates are found with `world.queryAABB` around the pointer; the highlight is drawn on the target port before release.

Rules enforced at link time, because the engine will not refuse a bad graph: a node cannot link to itself; two ports of the same pair cannot be linked twice; a new rigid link (revolute or weld) that would close a loop of rigid links is refused unless the loop contains at least one rope or contact link (union-find over rigid links), because two rigid paths between the same bodies over-constrain the solver and it fights itself; a gear coupling is never user-created, it lives inside prefabs.

### Port compatibility

| Port on the dragged machine | Compatible target | Joint created | Example |
| --- | --- | --- | --- |
| `pin` | `pin`, `shaft` | `RevoluteJoint` at the snapped point | Lever end pinned to a pulley block; crank on a wheel shaft |
| `ropeEnd` | `ropeAnchor` | `RopeJoint`, max length = distance at drop | Pulley handle rope tied to a lever tip; weight hung from an axle rope |
| `face` | `face` | None (proximity only, contact does the work) | Wedge under a lever end; block placed on a ramp |
| `handle` | none | None (it is what the hand grabs; only the mouse joint attaches here) | Screw crank, pulley free end |
| `shaft` | `pin` | `RevoluteJoint` on the shaft axis, so the pinned part turns with it | Lever mounted as a crank on the wheel |

Each prefab declares its ports with `role: "effort" | "load" | "either"`; the mechanical-advantage walk (below) uses roles to orient the chain from the hand toward the loads.

An example composition, before compression, for a lever whose tip lifts the free end of a two-strand pulley carrying a weight:

```json
{
  "v": 1,
  "gravity": 9.81,
  "nodes": [
    { "id": "l1", "kind": "lever", "x": -2, "y": 1, "angle": 0, "fixed": true, "settings": { "length": 3, "fulcrum": 0.7 } },
    { "id": "p1", "kind": "pulley", "x": 1.5, "y": 2, "angle": 0, "fixed": true, "settings": { "strands": 2 } },
    { "id": "w1", "kind": "weight", "x": 1.5, "y": 0, "angle": 0, "fixed": false, "settings": { "mass": 4 } }
  ],
  "links": [
    { "a": { "node": "l1", "port": "tipRight" }, "b": { "node": "p1", "port": "freeEnd" }, "joint": "rope" },
    { "a": { "node": "p1", "port": "hook" }, "b": { "node": "w1", "port": "eye" }, "joint": "revolute" }
  ]
}
```

### Saved compositions in the URL

The composition is small: a node is about 80 bytes of JSON, a link about 60, so a ten-machine build is under 2 KB raw. Serialise as JSON, gzip with the browser's `CompressionStream("gzip")` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream), available across browsers since 2023), and base64url the bytes into the hash (`#c=...`) so nothing is sent to a server and the router never sees it. Keep the `v` field so old links can be migrated, round numbers to two decimals before encoding, and refuse to load a composition whose nodes reference unknown kinds or whose links reference missing ports (fail loudly with a message, do not partially load). The rebuild is deterministic because nodes and links are created in array order.

### Mechanical advantage through stages

For machines in series the ideal advantage multiplies: IMA_total = Π IMA_i. Efficiency multiplies too, so a three-stage machine at 70 percent each delivers 34 percent. Live, the total AMA is measured only at the ends: the output force (the weight of whatever hangs on the last output port, or the reaction of the final spring) divided by the effort force (the mouse joint's reaction on whatever the user is dragging, or the sum of applied slider forces). Per-stage AMA comes from the joint reaction force at each link: the rope or revolute joint that joins stage i to stage i+1 reports the force passing through it (`joint.getReactionForce(1 / dt)`), so stage i's AMA is that force divided by the force entering it. Compute the chain by walking links from the node the user is touching toward the nodes with output ports, in a small graph traversal over the composition, and show a running product next to the measured value. Show "measuring" instead of a number while any body in the chain moves faster than a threshold, since AMA is a quasi-static quantity.

### Keeping a gear-and-lever-and-pulley chain stable

- Mass ratios: keep any two bodies joined by a joint within 10:1. Prefabs choose densities so that bars, wheels, blocks, and handles all land between 0.5 kg and 5 kg, and the weight prefab's slider is clamped to 0.1 to 10 kg. Heavier "loads" are faked by gravity scale on the weight body (`gravityScale`) rather than by mass, which keeps the solver's mass matrix well conditioned while the readout still shows the intended weight.
- Iterations and substeps: chapters run 8 velocity and 3 position iterations at 1/60 s. The playground counts the longest chain of joints in the composition and raises iterations to 12 and 4 above three stages, and steps twice at dt/2 above five. Both are deterministic functions of the composition so replays stay identical.
- Joint softness: keep the default stiff joints; use `frequencyHz` and `dampingRatio` only on distance joints that represent springs. Soft revolutes in a chain accumulate sag.
- Long ropes: a `RopeJoint` is a hard cap with position correction; it holds. Chains of segments are cosmetic only.
- Sleep: leave `allowSleep` on; a resting compound machine costs nothing, and sleeping is deterministic.
- Pulley singularities: every pulley prefab carries its own prismatic guides with limits, so users cannot pull a side to zero length whatever they connect.

### Absurd contraptions and clamping

The engine's failure modes are a NaN from a singular constraint, a body flung at hundreds of metres per second by a stiff fight between joints, and a solver that slowly walks a stack apart. Defences:

- Clamp every setting at the slider: mass 0.1 to 10 kg, lengths 0.2 to 4 m, radii 0.05 to 1 m, gravity 0 to 20 m/s², friction 0 to 1.5, angles 5° to 85°, lead 0.01 to 0.5 m, applied forces to at most five times the connected weight.
- Cap velocities: `Settings.maxTranslation` is 2 m per step (120 m/s at 60 Hz) by default; lower it to 0.5 for the playground, and `Settings.maxRotation` likewise.
- Watchdog after each step: if any body has a non-finite position or a speed above 50 m/s, pause, show what happened, and offer reset. Never clamp silently.
- Refuse rigid loops at link time (above), and refuse a link that would connect two nodes both marked fixed with a rigid joint (it does nothing and confuses the readout).
- Give the playground a reset that rebuilds the world from the composition rather than trying to undo, and a step counter so bug reports can say "step 412".

## 4. Interaction

### Dragging: mouse joint versus applied force

A `MouseJoint` is a soft constraint that drives a body point toward the pointer with a maximum force; the Planck docs describe "a spring/damper effect similar to the distance joint" and note "The maximum force is used to prevent violent reactions when multiple dynamic bodies interact" ([mouse joint docs](https://piqnt.com/planck.js/docs/joint/mouse-joint.html)). Use it for the hand: `maxForce` around 1000 times the body mass (the Box2D C++ testbed convention; Planck's own testbed uses a flat 1000 N), `frequencyHz` 5, `dampingRatio` 0.7, attached to the static page body, target updated on every pointer move, destroyed on release. Its reaction force is the effort readout, which is the decisive argument for it over applying forces: an applied force is an input the user sets, a mouse joint force is the force the user actually exerted. Applying forces directly is for the effort sliders (a constant push along the slope, a constant torque on the screw), where the number is the input.

Pointer handling: one `pointerdown` handler on the SVG root, `setPointerCapture`, hit test by converting to world coordinates and calling `fixture.testPoint(p)` on candidates from `world.queryAABB`, then create the joint. This works identically for mouse and touch; the grab radius should be at least 24 px on touch.

Rapier has no mouse joint; the equivalent is a kinematic position-based body moved with `setNextKinematicTranslation` plus a spring joint to the grabbed body, which also yields a readable force.

```ts
function grab(world: World, page: Body, p: Vec2): MouseJoint | null {
  let hit: Body | null = null;
  world.queryAABB({ lowerBound: new Vec2(p.x - 0.1, p.y - 0.1), upperBound: new Vec2(p.x + 0.1, p.y + 0.1) }, (fixture) => {
    if (fixture.getBody().isDynamic() && fixture.testPoint(p)) {
      hit = fixture.getBody();
      return false; // stop the query
    }
    return true;
  });
  if (!hit) return null;
  return world.createJoint(new MouseJoint({ maxForce: 1000 * (hit as Body).getMass(), frequencyHz: 5, dampingRatio: 0.7 }, page, hit, p));
}
```

### Keyboard and accessibility

Every grabbable part is also a focusable control: the `<g>` gets `tabindex="0"`, `role="slider"`, `aria-valuenow`, and `aria-valuetext` describing the state ("bar tilted 12 degrees"). Arrow keys nudge it: for revolute parts they set a motor target (`enableMotor`, `motorSpeed` for the key's duration, capped torque) and for prismatic parts a motor force, so the keyboard drives the same physics as the hand and the readouts stay meaningful. Every setting is a native `<input type="range">` with a label, which is keyboard and screen-reader accessible for free. Readouts live in a `role="status"` region updated no more than a few times a second so screen readers are not flooded. Provide a "run demonstration" button per chapter that plays a scripted drag (see determinism below) for people who cannot drag at all.

### Pause, reset, slow motion

- Pause stops stepping and keeps the drag joint alive so a paused scene can still be rearranged; the readouts freeze.
- Reset rebuilds the world from the scene definition. Never try to zero velocities in place; joint warm-starting state and contact caches make an in-place reset drift. Planck's `Serializer.toJson(world)` is available for save points mid-experiment; the composition data is the canonical saved form.
- Slow motion scales the accumulated time, not dt. A fixed dt of 1/60 with a time scale of 0.2 means one physics step every five frames and interpolation fills the rest; changing dt would change the results and break determinism.

### Fixed timestep with an accumulator and interpolation

The loop is the one from [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/): accumulate frame time, step in fixed increments, render the interpolated state. Clamp the frame time so a background tab does not simulate a minute on return.

```ts
const DT = 1 / 60;
const MAX_FRAME = 0.25;

interface Pose { x: number; y: number; a: number }

export class Loop {
  private acc = 0;
  private last = performance.now();
  private prev = new Map<Body, Pose>();
  timeScale = 1;
  paused = false;

  constructor(private world: World, private draw: (poseOf: (b: Body) => Pose) => void) {}

  frame = (now: number) => {
    const frameTime = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;
    if (!this.paused) this.acc += frameTime * this.timeScale;
    while (this.acc >= DT) {
      for (let b = this.world.getBodyList(); b; b = b.getNext()) {
        const p = b.getPosition();
        this.prev.set(b, { x: p.x, y: p.y, a: b.getAngle() });
      }
      this.world.step(DT, 8, 3);
      this.acc -= DT;
    }
    const alpha = this.acc / DT;
    this.draw((b) => {
      const p = b.getPosition();
      const q = this.prev.get(b) ?? { x: p.x, y: p.y, a: b.getAngle() };
      const da = Math.atan2(Math.sin(b.getAngle() - q.a), Math.cos(b.getAngle() - q.a)); // shortest arc
      return { x: q.x + (p.x - q.x) * alpha, y: q.y + (p.y - q.y) * alpha, a: q.a + da * alpha };
    });
    requestAnimationFrame(this.frame);
  };
}
```

Inside React the loop lives outside the render cycle: a `useEffect` in the scene component creates the world and the loop, starts `requestAnimationFrame`, and cancels on unmount. Body-to-element mapping is done once when the scene mounts. Readouts are the only thing that goes through React state, throttled to about 10 Hz, or published through a tiny external store read with `useSyncExternalStore`. The React Compiler already used by the frontend makes the static parts cheap to re-render, but nothing about the physics should cause a render.

### Driving SVG at 60 frames per second for 100 bodies

Each body owns one `<g>` element whose `transform` attribute is set to `translate(x y) rotate(deg)` once per frame from the interpolated pose; 100 attribute writes per frame is well within budget (a few hundred microseconds). React's docs allow this: refs are for direct DOM work and "You can safely modify parts of the DOM that React has no reason to update" ([Manipulating the DOM with refs](https://react.dev/learn/manipulating-the-dom-with-refs)). So the `<g>` receives its transform only from the loop, never from JSX, and the children (the hand-drawn paths) are static JSX. Ropes are the exception: they are geometry, not a transform, so each rope has one `<path>` whose `d` is rewritten per frame from its anchor and tangent points. Use a single SVG `viewBox` in metres with `transform="scale(1 -1)"` on a root group so world coordinates map directly and the y axis points up.

### Determinism across reloads

For a demonstration to replay identically: fixed dt and iteration counts, scene built in a fixed order from data, no `Math.random` in scene construction without a seeded generator (Rough.js, if used for sketchy strokes, takes a `seed`), no wall-clock time inside the simulation, and the hand's motion recorded as pairs of step index and target point rather than timestamps. A scripted demonstration is then a list of `(step, x, y)` keyframes fed to the mouse joint before each step. Planck's numerical results are identical on the same browser; across browsers the transcendental functions in `Rot.ts` (`Math.sin`, `Math.cos`, `Math.atan2`) may differ in the last bit and diverge over a long run. That is acceptable for a demo that lasts seconds; if bit-identical replays across browsers ever matter, Rapier documents "The WASM/Typescript/JavaScript version of Rapier is fully cross-platform deterministic" and Box2D v3 achieves it with its own trigonometry ([determinism post](https://box2d.org/posts/2024/08/determinism/)).

```ts
interface Keyframe { step: number; x: number; y: number }

// Feed the hand's recorded path to the mouse joint before each step; the replay is exact on the same browser.
function scriptedTarget(script: readonly Keyframe[], step: number): Vec2 | null {
  const next = script.findIndex((k) => k.step > step);
  if (next <= 0) return next === 0 ? null : new Vec2(script[script.length - 1].x, script[script.length - 1].y);
  const a = script[next - 1];
  const b = script[next];
  const t = (step - a.step) / (b.step - a.step);
  return new Vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}
```

## 5. Rendering fit

### The three options

| Concern | SVG | 2D canvas | WebGL |
| --- | --- | --- | --- |
| Hand-drawn ink paths | Native: the artwork is paths, editable in any vector tool, styled with CSS | Paths replayed each frame via `Path2D`, or pre-rendered to sprites | Paths must be triangulated or rendered to textures |
| 100 moving bodies at 60 Hz | Fine: one `transform` write per body; the browser repaints only dirty regions | Fine: full redraw of a few hundred paths per frame is cheap | Trivial |
| Ink look (bleed, wobble, paper) | `feTurbulence` plus `feDisplacementMap` filters ([MDN feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence)); expensive when applied to elements that move, since the filtered subtree is re-rasterised every frame | Must be faked: pre-distorted sprites, or a post-process pass with an offscreen canvas ([MDN canvas optimisation](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)) | Real per-pixel ink shaders, the best possible look, at the highest cost to build |
| Drawing-itself animation | `stroke-dasharray` and `stroke-dashoffset` are animatable and normalise with `pathLength` ([MDN stroke-dashoffset](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset)) | Manual dash bookkeeping with `setLineDash` | Manual |
| Accessibility and text | DOM elements: focusable parts, labels, `<title>`, selectable text | None without a parallel DOM | None without a parallel DOM |
| Dark mode and theming | CSS variables on strokes and fills | Repaint with new colours | Uniforms |
| Compositor behaviour | Transforms on SVG children repaint the SVG, not the page; keep the SVG small and off the paper filter layer ([web.dev on compositor-only properties](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)) | One layer | One layer |

### Recommendation

SVG, structured as layers so filters never touch moving elements:

1. A paper layer: background texture, page edge, one static `feTurbulence` filter for grain, rendered once and never invalidated.
2. A static ink layer: the parts of the illustration that do not move (frames, labels, captions), which may carry an ink-bleed filter because it is painted once.
3. A dynamic layer: one `<g>` per body, no filters, hand-drawn paths whose wobble is baked into the geometry. If the artwork is generated rather than drawn, generate it once at mount with Rough.js (`rough.svg`, MIT, renders to SVG and canvas, [rough-stuff/rough](https://github.com/rough-stuff/rough)) with a fixed `seed` so it is stable across renders, and cache the element.
4. A rope layer: paths rewritten per frame.
5. A readout layer: HTML positioned over the SVG, not `<text>` inside it, so it stays crisp, wraps, and is translated through the usual i18n path.

Ink reveal on chapter entry: set `pathLength="1"` on every path in the illustration and animate `stroke-dashoffset` from 1 to 0 with staggered CSS animations; the physics starts when the reveal ends. Keep filters in `linearRGB` off and `color-interpolation-filters="sRGB"` on to halve their cost when they are used at all.

```tsx
<svg viewBox="-4 -3 8 6" role="img" aria-labelledby="lever-title">
  <title id="lever-title">{t("lever.title")}</title>
  <g className="paper" filter="url(#grain)">{/* painted once */}</g>
  <g transform="scale(1 -1)">
    <g className="ink-static" filter="url(#bleed)">{/* frames, fulcrum stand, captions */}</g>
    <g className="ink-dynamic">{/* one <g ref> per body, transform written by the loop, no filter */}</g>
    <g className="ropes">{/* one <path ref> per rope, d written by the loop */}</g>
  </g>
</svg>
```

```css
.ink-static path, .ink-dynamic path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: reveal 900ms ease-out forwards; }
@keyframes reveal { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .ink-static path, .ink-dynamic path { animation: none; stroke-dashoffset: 0; } }
```

Why not canvas first: the chapters need focusable, labelled parts and the drawing reveal, both free in SVG. Why not WebGL: 100 bodies and a paper texture do not justify a renderer, and the ink shader would be the only reason, which a prototype can test later on a canvas overlay without changing the scene code.

The renderer is behind one interface (`draw(poseOf)` above) so the playground can swap to a canvas renderer if a stress test shows the SVG dynamic layer dropping frames past a few hundred bodies. Canvas gets the same layered structure: static paper and ink drawn once to an offscreen canvas, bodies drawn each frame from cached `Path2D` objects.

## Open questions that need a prototype

- Pulley joint behaviour near its limits with the prismatic guides in place, and whether the 2.4 solver holds a three-strand block and tackle steady under a 10 kg load at 8 and 3 iterations.
- Wedge by contact: does a 12° tip driven with five times the resistance ever tunnel with `bullet: true` at 1/60, or is dt/4 substepping needed for that one scene.
- Whether the gear-joint screw, with the friction torque updated from the measured load each step, reproduces the η = tan λ / tan(λ + φ) curve within a few percent, or whether the one-step lag in the friction update needs damping.
- Frame cost of the SVG dynamic layer at 100 and 300 bodies on a mid-range phone, with and without a filter accidentally applied to the moving group, to fix the playground's body budget.
- Whether the hand-drawn wobble baked into paths reads as ink without any per-frame filter, which decides if the canvas fallback is ever needed.
