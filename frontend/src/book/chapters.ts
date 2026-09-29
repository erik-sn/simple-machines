// The book's structure: an introduction, six chapters, and the Theatre. Each
// chapter is a sequence of stages; a stage pairs a caption with a scene and a
// mode. "still" shows the drawing at rest, "driven" moves it by an unseen
// hand, "free" hands it to the reader. Copy is drafted from docs/research/history;
// docs/copy.md records the style rules and which claims were used or left out.

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
        text: ["One law, 6 machines, and ink that moves when touched."],
        mode: "still",
        scene: { kind: "frontispiece" },
      },
      {
        id: "trade",
        title: "The trade",
        text: [
          "A machine trades force for distance, nothing else. Galileo writes that the force runs its course as many times as the load outweighs it; whoever hopes for the same effect without the slowness will certainly be deceived.",
        ],
        mode: "driven",
        scene: { kind: "lever" },
      },
      {
        id: "archimedes",
        title: "Archimedes at Syracuse",
        text: [
          "Plutarch has Archimedes haul a ship along the beach by compound pulleys. Give me where I may stand, and I move the earth: it survives in Pappus, 5 centuries on, praising a gear train. No ancient text puts a lever in his hand.",
        ],
        mode: "still",
        scene: { kind: "lever" },
      },
      {
        id: "heron",
        title: "Heron's five powers",
        text: [
          "In the 1st century Heron counts 5 powers, all of one nature, he says, though very different in form; the ramp is not among them. His Greek is lost, the book survives in Arabic, and Europe meets his five through Pappus.",
        ],
        mode: "still",
        scene: { kind: "lever" },
      },
      {
        id: "six",
        title: "Five, then six",
        text: [
          "Heron's 5 are lever, wheel and axle, pulley, wedge and screw. Stevin and Galileo give the ramp its law; Descartes counts 6 with it in 1637 and calls the count a convention. The textbook 6 settle late in the 18th century.",
        ],
        mode: "still",
        scene: { kind: "lever" },
      },
      {
        id: "read",
        title: "How to read",
        text: [
          "Every drawing is alive: take hold of a part and pull, and the margin keeps the numbers. The gear at the top right tunes the paper and the physics of each page; the arrows at the edges, or the arrow keys, turn the pages.",
        ],
        mode: "free",
        scene: { kind: "lever" },
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
        id: "rest",
        text: [
          "A bar and a point to turn on. Egypt is weighing with it by 2600 BC, and the Greeks explain nearly every other machine by reducing it to this one, and this one to the balance.",
        ],
        mode: "still",
        scene: { kind: "lever" },
      },
      {
        id: "law",
        title: "The law of the lever",
        text: [
          "The Mechanical Problems, about 300 BC, say the far end wins because it runs on a bigger circle. Archimedes proves it from the postulate that equal weights at equal distances are in equilibrium: the first theorem of mechanics.",
        ],
        mode: "driven",
        scene: { kind: "lever" },
      },
      {
        id: "vitruvius",
        title: "One man's strength",
        text: [
          "Vitruvius puts an iron bar under a load that a multitude of hands cannot move, and one man's strength, bearing down upon the head of it, heaves up the weight. His proof is the steelyard and its sliding counterpoise.",
        ],
        mode: "driven",
        scene: { kind: "lever" },
      },
      {
        id: "work",
        title: "Paid for in distance",
        text: [
          "Jordanus, in the 13th century, proves it from work: one weight lifts another only by falling farther. Galileo calls it a most fertile spring from which many instruments derive, and derives windlass, pulley and screw from it.",
        ],
        mode: "driven",
        scene: { kind: "lever", variant: "class2" },
      },
      {
        id: "rule",
        title: "Arm over arm",
        text: [
          "Load times its arm equals effort times its arm: the ideal advantage is the effort arm over the load arm, 2.6 on this bar. A crowbar with 90 cm of handle and 10 cm of tip gives 9, the tip rising 1 cm for every 9 the handle drops.",
        ],
        mode: "driven",
        scene: { kind: "lever" },
      },
      {
        id: "try",
        title: "Try it",
        text: [
          "Take hold of the bar and press. In the settings, slide the fulcrum toward the load and watch Ideal advantage climb as Effort falls; then add pin friction and watch the measured Advantage fall short of the ideal.",
        ],
        mode: "free",
        scene: { kind: "lever" },
      },
      {
        id: "classes",
        title: "Effort in the middle",
        text: [
          "A wheelbarrow, load in the middle, always gains. The forearm, effort in the middle, always loses force: the biceps pulls near the elbow so the hand moves fast and far. A throwing arm is a lever built to lose.",
        ],
        mode: "still",
        scene: { kind: "lever", variant: "class3" },
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
        id: "rest",
        text: [
          "Not the wheel that rolls under a cart, but the wheel that turns a smaller axle. Galileo calls it a perpetual lever, one that never runs out of travel.",
        ],
        mode: "still",
        scene: { kind: "wheel-and-axle" },
      },
      {
        id: "bars",
        title: "Bigger circles",
        text: [
          "The Mechanical Problems ask why longer bars turn the same capstan more easily, and answer that the radii of greater circles are moved more readily and further by the same force. The wheel is that bar, swept all the way round.",
        ],
        mode: "driven",
        scene: { kind: "wheel-and-axle" },
      },
      {
        id: "heron",
        title: "A thousand talents by five",
        text: [
          "Vitruvius turns his windlass with handspikes or, for heavier loads, a drum that men can tread in. Heron, whose first power this is, moves, on paper, 1000 talents with a force of 5 through a box of toothed wheels.",
        ],
        mode: "driven",
        scene: { kind: "wheel-and-axle", variant: "windlass" },
      },
      {
        id: "agricola",
        title: "Agricola's mines",
        text: [
          "Agricola's miners of 1556 wind ore up the shaft on a windlass, hang masses of lead on the spokes of a wheel to keep it turning, and drive horse whims, 4 horses to a whim if the shaft is very deep.",
        ],
        mode: "driven",
        scene: { kind: "wheel-and-axle", variant: "windlass" },
      },
      {
        id: "radius",
        title: "Radius against radius",
        text: [
          "Guidobaldo in 1577, then Galileo, reduce it to the lever: the force is to the weight as the radius of the axle to the radius of the wheel. In Galileo's example of 10 to 1 the load moves a tenth of what the mover walks.",
        ],
        mode: "driven",
        scene: { kind: "wheel-and-axle" },
      },
      {
        id: "try",
        title: "Try it",
        text: [
          "Take the rim and turn it; the rope winds onto the axle and the load climbs. In the settings, widen the wheel or thin the axle and watch Ideal advantage grow, while Rope out shows every metre of rope costing more rim.",
        ],
        mode: "free",
        scene: { kind: "wheel-and-axle" },
      },
      {
        id: "doorknob",
        title: "Any imaginable weight",
        text: [
          "A doorknob 6 cm across on a 1 cm spindle turns a latch the bare spindle will not. Wilkins writes in 1648 that by multiplication of the wheel it is easie to move any imaginable weight, and every gearbox since agrees.",
        ],
        mode: "still",
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
        id: "rest",
        text: [
          "A rope over a wheel, a sheave. By itself it turns a pull around and nothing more: Galileo writes that it brings no ease to the force, only to the way of applying it.",
        ],
        mode: "still",
        scene: { kind: "pulley", variant: "fixed" },
      },
      {
        id: "crane",
        title: "The crane shrinks the stones",
        text: [
          "From about 515 BC Greek temple blocks carry cuttings for lifting tongs: the crane has arrived. The century before sets at least 13 stones over 20 tons; the century after sets none. The machine makes the builders cut smaller.",
        ],
        mode: "driven",
        scene: { kind: "pulley", variant: "movable" },
      },
      {
        id: "ship",
        title: "A ship on the beach",
        text: [
          "Hiero asks for proof. Archimedes loads a beached three-master, sits down at a distance and, Plutarch writes, quietly sets a system of compound pulleys in motion; she comes in as though she were gliding through the water.",
        ],
        mode: "driven",
        scene: { kind: "pulley", variant: "tackle" },
      },
      {
        id: "strands",
        title: "Count the strands",
        text: [
          "Guidobaldo reduces every block to a lever: the more easily a power can move a weight, the more slowly it does so. Galileo adds that only the strands count, and finds Aristotle childish for thinking a bigger sheave helps.",
        ],
        mode: "driven",
        scene: { kind: "pulley", variant: "tackle" },
      },
      {
        id: "rule",
        title: "Strand by strand",
        text: [
          "Guidobaldo reduces every block to a lever: the more easily a power can move a weight, the more slowly it does so. Galileo calls Aristotle childish for thinking a bigger sheave helps: the sheave is nothing, the rope everything.",
        ],
        mode: "driven",
        scene: { kind: "pulley", variant: "movable" },
      },
      {
        id: "try",
        title: "Try it",
        text: [
          "Pull the free end down. In the settings, raise Strands and watch Ideal advantage count them; Effort falls by the same count, and Rope pulled grows by it for the same Load raised.",
        ],
        mode: "free",
        scene: { kind: "pulley", variant: "tackle" },
      },
      {
        id: "sheaves",
        title: "Six sheaves",
        text: [
          "Every crane hook and ship's rigging hangs from a tackle. Each sheave takes a few percent to friction, so with rope of natural fibre 6 sheaves is about the useful limit; past that, another sheave costs more than it gains.",
        ],
        mode: "still",
        scene: { kind: "pulley", variant: "tackle" },
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
        id: "rest",
        text: [
          "The last machine on the list, and the one nobody had to invent. Every hillside is one, so the Greeks, who count a machine by its parts, do not count it, and its law defeats them.",
        ],
        mode: "still",
        scene: { kind: "inclined-plane" },
      },
      {
        id: "hatnub",
        title: "The ramp at Hatnub",
        text: [
          "At Hatnub in Egypt a quarry ramp reported in 2018 climbs at 20 percent or more between 2 staircases lined with postholes; Khufu's masons cut it about 2560 BC. Blocks on sledges go up it, the ropes turned round the posts.",
        ],
        mode: "driven",
        scene: { kind: "inclined-plane" },
      },
      {
        id: "pappus",
        title: "Three hundred men",
        text: [
          "Pappus, about AD 320, reckons that a sphere of 200 talents needing 40 men on the level needs 300 on a 60-degree slope. The answer is wrong. Printed in 1588 and held by Guidobaldo, it stands until Galileo calls it false.",
        ],
        mode: "still",
        scene: { kind: "inclined-plane" },
      },
      {
        id: "stevin",
        title: "Wonder is no wonder",
        text: [
          "In 1586 Stevin draws a wreath of 14 equal spheres over a prism, 4 on the long slope against 2 on the short. If they did not balance, the wreath would turn for ever, which is absurd. Beneath it he writes: wonder is no wonder.",
        ],
        mode: "still",
        scene: { kind: "inclined-plane" },
      },
      {
        id: "rule",
        title: "Height over length",
        text: [
          "Jordanus has the law in the 13th century, Stevin the proof that persuades, Galileo the reason: the force is to the weight as the height of the plane is to its length. Halve the slope: half the push, twice the road.",
        ],
        mode: "driven",
        scene: { kind: "inclined-plane", variant: "cart" },
      },
      {
        id: "try",
        title: "Try it",
        text: [
          "Push the cart up the plane. In the settings, lower the angle and watch Ideal advantage rise as Effort falls; then raise the friction and watch the measured Advantage drop away from the ideal, most of all on the gentlest slope.",
        ],
        mode: "free",
        scene: { kind: "inclined-plane", variant: "cart" },
      },
      {
        id: "ball",
        title: "A hundred times over",
        text: [
          "In 1638 Galileo makes the ramp an instrument: a ball rolls down a groove while water runs into a glass, and the weighed water is the clock. A hundred times over, the distances are as the squares of the times, on every slope.",
        ],
        mode: "still",
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
        id: "rest",
        text: [
          "An inclined plane that moves, and the oldest tool there is: flaked stone from Lomekwi in Kenya is 3.3 million years old. On a ramp the load travels; here the tool does, and it goes on working after the blow.",
        ],
        mode: "still",
        scene: { kind: "wedge" },
      },
      {
        id: "heron",
        title: "Heron's creaking wedge",
        text: [
          "Heron writes that to split a stone from its bed none of the other powers works, not even all combined; the wedge alone works there. Its action does not cease when the blow ceases: often it creaks without being struck.",
        ],
        mode: "driven",
        scene: { kind: "wedge" },
      },
      {
        id: "failure",
        title: "The honest failure",
        text: [
          "The Mechanical Problems call the wedge two levers opposite to each other. Guidobaldo finds the fulcrums move as the split opens and gives the wedge the only chapter of his book without a proposition. Galileo leaves it out.",
        ],
        mode: "driven",
        scene: { kind: "wedge", variant: "log" },
      },
      {
        id: "agricola",
        title: "The vein rings",
        text: [
          "In Agricola's mines of 1556 iron wedges are driven between iron plates into a crack, struck by turns, whereby the vein rings with a shrill sound. At a tearing sound the miners hastily flee away; then a great crash.",
        ],
        mode: "driven",
        scene: { kind: "wedge" },
      },
      {
        id: "rule",
        title: "Length over width",
        text: [
          "The ideal advantage is length over the width of the heel: 20 cm long and 4 cm at the back, a wedge turns a blow into 5 times the push on each face. Heron's rule for a heavier load is not a bigger wedge but a thinner one.",
        ],
        mode: "driven",
        scene: { kind: "wedge", variant: "log" },
      },
      {
        id: "try",
        title: "Try it",
        text: [
          "Press the wedge in; when you let go, Self-locking says whether friction keeps the gain. In the settings, sharpen the angle and watch Ideal advantage climb: the faces push harder, and the wedge sinks farther for the same opening.",
        ],
        mode: "free",
        scene: { kind: "wedge", variant: "log" },
      },
      {
        id: "silenus",
        title: "A Silenus inside",
        text: [
          "Every knife, nail and ploughshare is a wedge, and so is the slider of a zip. Pliny records that when a single block of Parian marble was split by the wedges of the quarrymen, the image of a Silenus appeared inside.",
        ],
        mode: "still",
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
        id: "rest",
        text: [
          "An inclined plane wound around a post. Galileo gives the screw first place among the machines, as the one that suits not only moving but holding and clamping with very great force.",
        ],
        mode: "still",
        scene: { kind: "screw", variant: "jack" },
      },
      {
        id: "twisted",
        title: "A twisted wedge",
        text: [
          "Heron calls it only a twisted wedge, which cannot be struck but is moved by means of the lever: turning takes the place of striking. The wedge goes into the load; the screw stays put and draws the load to itself.",
        ],
        mode: "driven",
        scene: { kind: "screw", variant: "jack" },
      },
      {
        id: "press",
        title: "The press",
        text: [
          "Pliny, in the 1st century, calls the screw press an invention of the last hundred years, its upright beam grooved spirally; Heron cuts the female thread for it. Give the wine press a bar on its screw and it prints books.",
        ],
        mode: "driven",
        scene: { kind: "screw", variant: "press" },
      },
      {
        id: "wound",
        title: "A door off its hinges",
        text: [
          "Ramelli, in 1588, draws screw jacks by the dozen, one to lift a door off its hinges, easily and with little noise. Guidobaldo, 11 years before, has the thread's secret: a plane inclined to the horizon wound round a cylinder.",
        ],
        mode: "driven",
        scene: { kind: "screw", variant: "jack" },
      },
      {
        id: "rule",
        title: "The longest road",
        text: [
          "Galileo's rule: the force grows as the hand's road exceeds the rise. A 300 mm handle sweeps 1885 mm a turn and a fine thread climbs 1.5 mm: about 1257 on paper. Friction wastes most of it, and that waste is why the jack holds.",
        ],
        mode: "driven",
        scene: { kind: "screw", variant: "jack" },
      },
      {
        id: "try",
        title: "Try it",
        text: [
          "Turn the handle; the load climbs a thread at a time. In the settings, lengthen the handle or make the thread finer and watch Ideal advantage soar; add friction, and Advantage falls while the load stays put when you let go.",
        ],
        mode: "free",
        scene: { kind: "screw", variant: "jack" },
      },
      {
        id: "water",
        title: "Water that runs downhill",
        text: [
          "Diodorus, 2 centuries on, credits Archimedes with the screw that lifts water. It is the same helix at another job, carrying instead of pressing, and Galileo calls it miraculous: the water rises while continually descending.",
        ],
        mode: "still",
        scene: { kind: "screw", variant: "jack" },
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
        id: "bench",
        text: [
          "Besson's and Ramelli's theatres of machines draw cranes, mills and presses by the hundred and leave out the theory. Here the bench is yours: draw the machines onto the page, join them, and see what they make together.",
        ],
        mode: "free",
        scene: { kind: "theatre" },
      },
      {
        id: "multiply",
        title: "Advantages multiply",
        text: [
          "Chain them and the advantages multiply: a lever of 4 driving a tackle of 3 gives 12, and the effort travels 12 times as far. So do the losses; every joint takes its cut. One law holds across the bench: save force, pay in road.",
        ],
        mode: "free",
        scene: { kind: "theatre" },
      },
    ],
  },
];

export const MACHINE_CHAPTERS = CHAPTERS.filter((c) => c.kind === "machine");
