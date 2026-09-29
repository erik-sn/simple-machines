import type { MachineKind } from "../book/chapters";
import type { Port, PortKind } from "../physics/types";

// The Theatre's saved form (docs/research/physics.md, "Connection model"):
// machines placed on the page and the links the visitor drew between their
// ports. It is rebuilt into a world in array order, so it is deterministic,
// and it travels in the URL hash.

export type TheatreKind = MachineKind | "weight" | "hook";

export interface MachineNode {
  id: string;
  kind: TheatreKind;
  x: number;
  y: number;
  variant?: string;
  // A free body pinned to the page (a weight waiting to be hung).
  fixed?: boolean;
  settings: Record<string, number>;
}

export type LinkJoint = "revolute" | "rope" | "contact";

export interface PortRef {
  node: string;
  port: string;
}

export interface Link {
  a: PortRef;
  b: PortRef;
  joint: LinkJoint;
}

export interface Composition {
  v: 1;
  nodes: MachineNode[];
  links: Link[];
}

export const EMPTY_COMPOSITION: Composition = { v: 1, nodes: [], links: [] };

// What the bench shows when nobody has built anything yet: a lever with a
// weight hung from its load end, so the page opens on a working plate.
export const SEED_COMPOSITION: Composition = {
  v: 1,
  nodes: [
    { id: "le1", kind: "lever", x: 0, y: 0.6, settings: {} },
    { id: "we1", kind: "weight", x: -1.35, y: -0.255, settings: {} },
  ],
  links: [
    {
      a: { node: "we1", port: "rope-end" },
      b: { node: "le1", port: "load-hook" },
      joint: "rope",
    },
  ],
};

export const THEATRE_KINDS: readonly TheatreKind[] = [
  "lever",
  "wheel-and-axle",
  "pulley",
  "inclined-plane",
  "wedge",
  "screw",
  "weight",
  "hook",
];

export function isTheatreKind(value: unknown): value is TheatreKind {
  return THEATRE_KINDS.includes(value as TheatreKind);
}

// Which ports may be joined, and what joint the pair makes.
export function jointFor(a: PortKind, b: PortKind): LinkJoint | null {
  const pair = `${a}+${b}`;
  switch (pair) {
    case "pin+pin":
    case "pin+shaft":
    case "shaft+pin":
      return "revolute";
    case "ropeEnd+ropeAnchor":
    case "ropeAnchor+ropeEnd":
      return "rope";
    case "face+face":
      return "contact";
    default:
      return null;
  }
}

export interface ResolvedPort {
  node: MachineNode;
  port: Port;
  // Whether the port sits on a static body (a hook, a ramp).
  fixed: boolean;
}

// Why a link is refused, in the reader's words.
export function linkRefusal(
  composition: Composition,
  a: ResolvedPort,
  b: ResolvedPort,
): string | null {
  if (a.node.id === b.node.id) {
    return "A machine cannot be joined to itself.";
  }
  const joint = jointFor(a.port.kind, b.port.kind);
  if (joint === null) {
    return "Those two parts do not fit together.";
  }
  const duplicate = composition.links.some(
    (link) =>
      (samePort(link.a, a) && samePort(link.b, b)) ||
      (samePort(link.a, b) && samePort(link.b, a)),
  );
  if (duplicate) {
    return "They are already joined.";
  }
  if (joint === "revolute") {
    if (a.fixed && b.fixed) {
      return "Both parts are fixed to the page; a pin between them does nothing.";
    }
    if (rigidlyConnected(composition, a.node.id, b.node.id)) {
      return "That would close a rigid loop, which the machines would fight.";
    }
  }
  return null;
}

function samePort(ref: PortRef, resolved: ResolvedPort): boolean {
  return ref.node === resolved.node.id && ref.port === resolved.port.id;
}

// Union-find over the rigid (revolute) links: a second rigid path between
// two machines over-constrains the solver.
function rigidlyConnected(
  composition: Composition,
  x: string,
  y: string,
): boolean {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== undefined && parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    return root;
  };
  for (const link of composition.links) {
    if (link.joint !== "revolute") {
      continue;
    }
    const ra = find(link.a.node);
    const rb = find(link.b.node);
    if (ra !== rb) {
      parent.set(ra, rb);
    }
  }
  return find(x) === find(y);
}

// --- the URL form ------------------------------------------------------------

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

// "#c=" carries the gzipped JSON; an empty bench has no hash at all.
export async function encodeComposition(
  composition: Composition,
): Promise<string> {
  if (composition.nodes.length === 0) {
    return "";
  }
  const compact: Composition = {
    v: 1,
    nodes: composition.nodes.map((node) => ({
      ...node,
      x: round(node.x),
      y: round(node.y),
      settings: Object.fromEntries(
        Object.entries(node.settings).map(([k, v]) => [k, round(v)]),
      ),
    })),
    links: composition.links,
  };
  return `c=${toBase64Url(await gzip(JSON.stringify(compact)))}`;
}

// Decodes a hash; an unreadable one is an error the reader must see, never
// a silently empty bench.
export async function decodeComposition(hash: string): Promise<Composition> {
  const text = hash.replace(/^#/, "");
  if (text === "") {
    return SEED_COMPOSITION;
  }
  if (!text.startsWith("c=")) {
    throw new Error("This address does not describe a bench.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await gunzip(fromBase64Url(text.slice(2))));
  } catch {
    throw new Error("This address does not describe a bench.");
  }
  return validate(parsed);
}

function validate(value: unknown): Composition {
  if (
    typeof value !== "object" ||
    value === null ||
    !("v" in value) ||
    value.v !== 1
  ) {
    throw new Error("This bench was saved in a form this book cannot read.");
  }
  const raw = value as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.links)) {
    throw new Error("This bench is missing its machines or links.");
  }
  const nodes: MachineNode[] = raw.nodes.map((n: unknown): MachineNode => {
    if (
      typeof n !== "object" ||
      n === null ||
      !("id" in n) ||
      typeof n.id !== "string" ||
      !("kind" in n) ||
      !isTheatreKind(n.kind) ||
      !("x" in n) ||
      typeof n.x !== "number" ||
      !("y" in n) ||
      typeof n.y !== "number"
    ) {
      throw new Error("A machine on this bench is not one this book knows.");
    }
    const settings =
      "settings" in n && typeof n.settings === "object" && n.settings !== null
        ? Object.fromEntries(
            Object.entries(n.settings as Record<string, unknown>).filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === "number",
            ),
          )
        : {};
    const node: MachineNode = {
      id: n.id,
      kind: n.kind,
      x: n.x,
      y: n.y,
      settings,
    };
    if ("variant" in n && typeof n.variant === "string") {
      node.variant = n.variant;
    }
    if ("fixed" in n && typeof n.fixed === "boolean") {
      node.fixed = n.fixed;
    }
    return node;
  });
  const ids = new Set(nodes.map((n) => n.id));
  const links: Link[] = raw.links.map((l: unknown): Link => {
    if (
      typeof l !== "object" ||
      l === null ||
      !("a" in l) ||
      !("b" in l) ||
      !("joint" in l) ||
      !isPortRef(l.a) ||
      !isPortRef(l.b) ||
      (l.joint !== "revolute" && l.joint !== "rope" && l.joint !== "contact")
    ) {
      throw new Error("A link on this bench is malformed.");
    }
    if (!ids.has(l.a.node) || !ids.has(l.b.node)) {
      throw new Error("A link on this bench points at a missing machine.");
    }
    return { a: l.a, b: l.b, joint: l.joint };
  });
  return { v: 1, nodes, links };
}

function isPortRef(value: unknown): value is PortRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "node" in value &&
    typeof value.node === "string" &&
    "port" in value &&
    typeof value.port === "string"
  );
}

// A fresh id: short, unique within the bench.
export function nextNodeId(
  composition: Composition,
  kind: TheatreKind,
): string {
  const prefix = kind.slice(0, 2);
  let n = 1;
  while (composition.nodes.some((node) => node.id === `${prefix}${n}`)) {
    n += 1;
  }
  return `${prefix}${n}`;
}
