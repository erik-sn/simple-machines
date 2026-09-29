// The book's structure: an introduction, six chapters, and the Theatre. Each
// chapter is a sequence of stages; a stage pairs a caption with a scene and a
// mode. "still" shows the drawing at rest, "driven" moves it by an unseen
// hand, "free" hands it to the reader. Copy is drafted from docs/research/history.

export type StageMode = "still" | "driven" | "free";

export type MachineKind =
  | "lever"
  | "wheel-and-axle"
  | "pulley"
  | "inclined-plane"
  | "wedge"
  | "screw";

export type SceneKind = MachineKind | "frontispiece" | "theatre";

export interface SceneRef {
  kind: SceneKind;
  // A named arrangement of the machine, for chapters that show more than one.
  variant?: string;
}

export interface Stage {
  id: string;
  title?: string;
  text: readonly string[];
  mode: StageMode;
  scene: SceneRef;
}

export type ChapterKind = "introduction" | "machine" | "theatre";

export interface Chapter {
  slug: string;
  kind: ChapterKind;
  // Roman numeral for the six machines; null for the introduction and the Theatre.
  numeral: string | null;
  title: string;
  stages: readonly Stage[];
}

export const CHAPTERS: readonly Chapter[] = [
  {
    slug: "introduction",
    kind: "introduction",
    numeral: null,
    title: "Simple Machines",
    stages: [
      {
        id: "cover",
        text: [
          "Six devices, and every machine ever built is some arrangement of them.",
        ],
        mode: "still",
        scene: { kind: "frontispiece" },
      },
      {
        id: "trade",
        title: "The trade",
        text: [
          "A simple machine changes the direction or the size of a force. It cannot make work: what it saves in effort it charges in distance.",
        ],
        mode: "driven",
        scene: { kind: "frontispiece" },
      },
      {
        id: "canon",
        title: "How the list was made",
        text: [
          "Heron of Alexandria counted five powers in the first century. The Renaissance added the inclined plane and gave the six a common law.",
        ],
        mode: "free",
        scene: { kind: "frontispiece" },
      },
    ],
  },
  {
    slug: "lever",
    kind: "machine",
    numeral: "I",
    title: "The Lever",
    stages: [
      {
        id: "still",
        text: [
          "A rigid bar and a point to turn on. Give me a place to stand, Archimedes said, and I will move the earth.",
        ],
        mode: "still",
        scene: { kind: "lever" },
      },
      {
        id: "driven",
        title: "The law of the lever",
        text: [
          "Load times its distance equals effort times its distance. The long arm buys force with travel.",
        ],
        mode: "driven",
        scene: { kind: "lever" },
      },
      {
        id: "free",
        title: "Try it",
        text: [
          "Press on the bar. Move the fulcrum in the settings and watch the trade change.",
        ],
        mode: "free",
        scene: { kind: "lever" },
      },
    ],
  },
  {
    slug: "wheel-and-axle",
    kind: "machine",
    numeral: "II",
    title: "The Wheel and Axle",
    stages: [
      {
        id: "still",
        text: [
          "A lever that never stops turning: a large wheel fixed to a small axle, sharing one center.",
        ],
        mode: "still",
        scene: { kind: "wheel-and-axle" },
      },
      {
        id: "driven",
        title: "Radius against radius",
        text: [
          "Turn the rim and the axle turns with it, slower at its surface and stronger by the ratio of the two radii.",
        ],
        mode: "driven",
        scene: { kind: "wheel-and-axle" },
      },
      {
        id: "free",
        title: "Try it",
        text: ["Wind the rope. Change the wheel in the settings."],
        mode: "free",
        scene: { kind: "wheel-and-axle" },
      },
    ],
  },
  {
    slug: "pulley",
    kind: "machine",
    numeral: "III",
    title: "The Pulley",
    stages: [
      {
        id: "still",
        text: [
          "A wheel with a groove and a rope that runs in it. One fixed pulley only turns the pull around.",
        ],
        mode: "still",
        scene: { kind: "pulley" },
      },
      {
        id: "driven",
        title: "Counting the strands",
        text: [
          "Hang the pulley from the load instead and the rope holds it twice. Each strand that lifts divides the effort.",
        ],
        mode: "driven",
        scene: { kind: "pulley" },
      },
      {
        id: "free",
        title: "Try it",
        text: ["Pull the free end. Add sheaves in the settings."],
        mode: "free",
        scene: { kind: "pulley" },
      },
    ],
  },
  {
    slug: "inclined-plane",
    kind: "machine",
    numeral: "IV",
    title: "The Inclined Plane",
    stages: [
      {
        id: "still",
        text: [
          "The ramp joined the list last. Stevin proved its law in 1586 with a wreath of spheres that cannot turn.",
        ],
        mode: "still",
        scene: { kind: "inclined-plane" },
      },
      {
        id: "driven",
        title: "Length against height",
        text: [
          "A gentle slope trades a long push for a light one. The work is the height, whichever road you take.",
        ],
        mode: "driven",
        scene: { kind: "inclined-plane" },
      },
      {
        id: "free",
        title: "Try it",
        text: ["Push the block up. Change the angle and the friction."],
        mode: "free",
        scene: { kind: "inclined-plane" },
      },
    ],
  },
  {
    slug: "wedge",
    kind: "machine",
    numeral: "V",
    title: "The Wedge",
    stages: [
      {
        id: "still",
        text: [
          "An inclined plane that moves. Drive it in and it pushes sideways with more force than it was struck with.",
        ],
        mode: "still",
        scene: { kind: "wedge" },
      },
      {
        id: "driven",
        title: "The split",
        text: [
          "A blow along the length becomes a spread across the width. The thinner the wedge, the greater the gain.",
        ],
        mode: "driven",
        scene: { kind: "wedge" },
      },
      {
        id: "free",
        title: "Try it",
        text: ["Strike the wedge. Sharpen it in the settings."],
        mode: "free",
        scene: { kind: "wedge" },
      },
    ],
  },
  {
    slug: "screw",
    kind: "machine",
    numeral: "VI",
    title: "The Screw",
    stages: [
      {
        id: "still",
        text: [
          "An inclined plane wound around a cylinder. Every turn climbs one thread.",
        ],
        mode: "still",
        scene: { kind: "screw" },
      },
      {
        id: "driven",
        title: "The longest road",
        text: [
          "A full circle at the handle lifts the load by one pitch. No simple machine trades distance for force so steeply.",
        ],
        mode: "driven",
        scene: { kind: "screw" },
      },
      {
        id: "free",
        title: "Try it",
        text: ["Turn the handle. Change the pitch."],
        mode: "free",
        scene: { kind: "screw" },
      },
    ],
  },
  {
    slug: "theatre",
    kind: "theatre",
    numeral: null,
    title: "The Theatre of Machines",
    stages: [
      {
        id: "theatre",
        text: [
          "Everything is on the bench. Draw the machines onto the page, join them, and see what they make together.",
        ],
        mode: "free",
        scene: { kind: "theatre" },
      },
    ],
  },
];

export const MACHINE_CHAPTERS = CHAPTERS.filter((c) => c.kind === "machine");
