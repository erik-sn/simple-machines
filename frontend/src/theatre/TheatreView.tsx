import {
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSetExtraSection } from "../book/extraSettings";
import { renderShape } from "../ink/render";
import type { Vec } from "../physics/types";
import { Marginalia } from "../scenes/Marginalia";
import type { SettingSpec, SettingValues } from "../scenes/settings";
import { useTheme } from "../theme/ThemeProvider";
import {
  type Composition,
  jointFor,
  linkRefusal,
  nextNodeId,
  THEATRE_KINDS,
  type TheatreKind,
} from "./composition";
import { PREFAB_LABELS } from "./prefabs";
import {
  partKey,
  TheatreController,
  type WorldPort,
} from "./TheatreController";
import { useComposition } from "./useComposition";

export const THEATRE_SETTINGS: readonly SettingSpec[] = [
  {
    key: "gravity",
    label: "Gravity",
    min: 1,
    max: 20,
    step: 0.5,
    defaultValue: 9.8,
    unit: "m/s²",
  },
];

const CAMERA = { x: 0, y: 0.4, height: 6, width: 9 };
const SNAP_RADIUS = 0.3;
const PORT_RADIUS = 0.06;

interface Props {
  settings: SettingValues;
}

// The Theatre of Machines: the bench on the left offers the machines, the
// visitor places them, joins their ports, and the one shared world runs.
export function TheatreView({ settings }: Props) {
  const { composition, ready, error, update } = useComposition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gravity = settings.gravity ?? 9.8;

  function add(kind: TheatreKind) {
    const id = nextNodeId(composition, kind);
    const count = composition.nodes.length;
    const node = {
      id,
      kind,
      x: -3 + (count % 3) * 3,
      y: 1.4 - Math.floor(count / 3) * 2.2,
      settings: {},
      // A weight waits, pinned, until something holds it.
      ...(kind === "weight" ? { fixed: true } : {}),
    };
    update({ ...composition, nodes: [...composition.nodes, node] });
    setSelectedId(id);
  }

  if (!ready) {
    return null;
  }
  return (
    <>
      <Bench
        key={`${gravity}:${JSON.stringify(composition)}`}
        composition={composition}
        gravity={gravity}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChange={update}
      />
      <nav
        aria-label="Bench"
        className="absolute top-1/2 left-6 -translate-y-1/2"
      >
        <ul className="space-y-1">
          {THEATRE_KINDS.map((kind) => (
            <li key={kind}>
              <button
                type="button"
                onClick={() => add(kind)}
                className="font-display text-ink-soft hover:text-ink text-step--1 lowercase tracking-widest"
              >
                {PREFAB_LABELS[kind]}
              </button>
            </li>
          ))}
          {composition.nodes.length > 0 && (
            <li className="pt-3">
              <button
                type="button"
                onClick={() => {
                  update({ v: 1, nodes: [], links: [] });
                  setSelectedId(null);
                }}
                className="font-body text-ink-faint hover:text-ink text-step--1 italic"
              >
                clear the bench
              </button>
            </li>
          )}
        </ul>
      </nav>
      {error !== null && (
        <p
          role="alert"
          className="font-body text-accent text-step--1 absolute top-16 left-6 max-w-xs italic"
        >
          {error} The bench starts empty.
        </p>
      )}
    </>
  );
}

interface BenchProps {
  composition: Composition;
  gravity: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: Composition) => void;
}

interface Size {
  width: number;
  height: number;
}

type Drag =
  | { kind: "hand" }
  | { kind: "node"; id: string; start: Vec; delta: Vec }
  | { kind: "link"; from: WorldPort; candidates: WorldPort[] };

// One build of the bench: remounted (by key) whenever the composition or
// gravity changes, so the world is always rebuilt from data.
function Bench({
  composition,
  gravity,
  selectedId,
  onSelect,
  onChange,
}: BenchProps) {
  const [controller] = useState(
    () => new TheatreController(composition, gravity),
  );
  const { theme } = useTheme();
  const publishSection = useSetExtraSection();
  const containerRef = useRef<HTMLDivElement>(null);
  const linkLineRef = useRef<SVGPathElement>(null);
  const nodeElements = useRef(new Map<string, SVGGElement>());
  const portElements = useRef(new Map<string, SVGCircleElement>());
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState<Size>({ width: 16, height: 9 });
  const [note, setNote] = useState<string | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width, height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);

  useEffect(() => {
    if (note === null) {
      return;
    }
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);

  // The selected machine's settings appear in the settings panel.
  useEffect(() => {
    const instance = controller.instances.find((i) => i.node.id === selectedId);
    if (instance === undefined) {
      publishSection(null);
      return;
    }
    const pinnable = instance.node.kind === "weight";
    publishSection({
      title: PREFAB_LABELS[instance.node.kind],
      specs: instance.definition.settings,
      values: instance.values,
      ...(pinnable
        ? {
            pinned: instance.node.fixed === true,
            onTogglePinned: () =>
              onChange({
                ...composition,
                nodes: composition.nodes.map((n) =>
                  n.id === instance.node.id
                    ? { ...n, fixed: n.fixed !== true }
                    : n,
                ),
              }),
          }
        : {}),
      onChange: (key, value) =>
        onChange({
          ...composition,
          nodes: composition.nodes.map((n) =>
            n.id === instance.node.id
              ? { ...n, settings: { ...n.settings, [key]: value } }
              : n,
          ),
        }),
      onRemove: () => {
        onChange({
          ...composition,
          nodes: composition.nodes.filter((n) => n.id !== instance.node.id),
          links: composition.links.filter(
            (l) =>
              l.a.node !== instance.node.id && l.b.node !== instance.node.id,
          ),
        });
        onSelect(null);
      },
    });
    return () => publishSection(null);
  }, [controller, composition, selectedId, onChange, onSelect, publishSection]);

  const aspect = size.width / size.height;
  const viewHeight = Math.max(CAMERA.height, CAMERA.width / aspect);
  const viewWidth = viewHeight * aspect;
  const viewBox = {
    x: CAMERA.x - viewWidth / 2,
    y: -CAMERA.y - viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
  };

  function toWorld(event: PointerEvent<SVGSVGElement>): Vec {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width,
      y: -(
        viewBox.y +
        ((event.clientY - rect.top) / rect.height) * viewBox.height
      ),
    };
  }

  function setLinkLine(from: Vec | null, to: Vec | null) {
    const line = linkLineRef.current;
    if (line === null) {
      return;
    }
    line.setAttribute(
      "d",
      from === null || to === null
        ? ""
        : `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
    );
  }

  function markCandidates(candidates: readonly WorldPort[], on: boolean) {
    for (const candidate of candidates) {
      const element = portElements.current.get(
        partKey(candidate.node.id, candidate.port.id),
      );
      element?.classList.toggle("port-candidate", on);
    }
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const point = toWorld(event);
    const portElement = target.closest<SVGElement>("[data-port]");
    const handleElement = target.closest<SVGElement>("[data-node-handle]");
    if (portElement !== null) {
      const from = controller.resolvePort({
        node: portElement.dataset.node ?? "",
        port: portElement.dataset.port ?? "",
      });
      if (from === null) {
        return;
      }
      const candidates = controller
        .allPorts()
        .filter(
          (p) =>
            p.node.id !== from.node.id &&
            jointFor(from.port.kind, p.port.kind) !== null,
        );
      markCandidates(candidates, true);
      drag.current = { kind: "link", from, candidates };
      setLinkLine(controller.portWorld(from), point);
    } else if (handleElement !== null) {
      const id = handleElement.dataset.nodeHandle ?? "";
      drag.current = { kind: "node", id, start: point, delta: { x: 0, y: 0 } };
      onSelect(id);
    } else if (controller.grab(point)) {
      drag.current = { kind: "hand" };
    } else {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (current === null) {
      return;
    }
    const point = toWorld(event);
    switch (current.kind) {
      case "hand":
        controller.move(point);
        break;
      case "node": {
        current.delta = {
          x: point.x - current.start.x,
          y: point.y - current.start.y,
        };
        nodeElements.current
          .get(current.id)
          ?.setAttribute(
            "transform",
            `translate(${current.delta.x} ${current.delta.y})`,
          );
        break;
      }
      case "link":
        setLinkLine(controller.portWorld(current.from), point);
        break;
      default: {
        const never: never = current;
        throw new Error(`Unknown drag ${JSON.stringify(never)}`);
      }
    }
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    drag.current = null;
    if (current === null) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    switch (current.kind) {
      case "hand":
        controller.release();
        break;
      case "node": {
        if (Math.hypot(current.delta.x, current.delta.y) > 0.01) {
          onChange({
            ...composition,
            nodes: composition.nodes.map((n) =>
              n.id === current.id
                ? { ...n, x: n.x + current.delta.x, y: n.y + current.delta.y }
                : n,
            ),
          });
        }
        break;
      }
      case "link": {
        markCandidates(current.candidates, false);
        setLinkLine(null, null);
        const point = toWorld(event);
        let best: WorldPort | null = null;
        let bestDistance = SNAP_RADIUS;
        for (const candidate of current.candidates) {
          const p = controller.portWorld(candidate);
          const distance = Math.hypot(p.x - point.x, p.y - point.y);
          if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
          }
        }
        if (best !== null) {
          join(current.from, best);
        }
        break;
      }
      default: {
        const never: never = current;
        throw new Error(`Unknown drag ${JSON.stringify(never)}`);
      }
    }
  }

  // Joins two ports: the link is recorded, the side the visitor dragged from
  // is shifted so the two ports coincide exactly, and a pinned weight on
  // either side is set free to hang.
  function join(a: WorldPort, b: WorldPort) {
    // A pinned weight counts as movable: linking is what sets it free.
    const loose = (p: WorldPort) => ({
      ...p,
      fixed: p.fixed && p.node.kind !== "weight",
    });
    const refusal = linkRefusal(composition, loose(a), loose(b));
    if (refusal !== null) {
      setNote(refusal);
      return;
    }
    const joint = jointFor(a.port.kind, b.port.kind);
    if (joint === null) {
      throw new Error("A compatible pair has no joint");
    }
    const pa = controller.portWorld(a);
    const pb = controller.portWorld(b);
    const shifted = !loose(a).fixed
      ? a.node.id
      : !loose(b).fixed
        ? b.node.id
        : null;
    const delta =
      shifted === a.node.id
        ? { x: pb.x - pa.x, y: pb.y - pa.y }
        : { x: pa.x - pb.x, y: pa.y - pb.y };
    const linked = new Set([a.node.id, b.node.id]);
    onChange({
      ...composition,
      nodes: composition.nodes.map((n) => {
        const moved =
          n.id === shifted ? { ...n, x: n.x + delta.x, y: n.y + delta.y } : n;
        return moved.kind === "weight" && linked.has(moved.id)
          ? { ...moved, fixed: false }
          : moved;
      }),
      links: [
        ...composition.links,
        {
          a: { node: a.node.id, port: a.port.id },
          b: { node: b.node.id, port: b.port.id },
          joint,
        },
      ],
    });
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg
        className="ink block h-full w-full touch-none select-none"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="The bench"
        data-nodes={composition.nodes.length}
        data-links={composition.links.length}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g transform="scale(1 -1)">
          {controller.instances.map((instance) => {
            const { node, machine } = instance;
            return (
              <g
                key={node.id}
                data-node={node.id}
                ref={(element) => {
                  if (element === null) {
                    nodeElements.current.delete(node.id);
                  } else {
                    nodeElements.current.set(node.id, element);
                  }
                }}
              >
                <g className="ink-static">
                  {machine.statics.flatMap((shape, index) =>
                    renderShape(theme, shape, `${node.id}:static:${index}`).map(
                      (path) => (
                        <path
                          key={path.d}
                          d={path.d}
                          data-stroke={path.stroke}
                          vectorEffect="non-scaling-stroke"
                        />
                      ),
                    ),
                  )}
                </g>
                <g className="ink-ropes">
                  {machine.ropes.map((rope) => (
                    <path
                      key={rope.id}
                      ref={(element) =>
                        controller.attachRope(
                          partKey(node.id, rope.id),
                          element,
                        )
                      }
                      d=""
                      data-stroke={rope.stroke ?? "soft"}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
                <g className="ink-dynamic">
                  {machine.parts.map((part) => {
                    const pose = controller.poseOf(part);
                    return (
                      <g
                        key={part.id}
                        ref={(element) =>
                          controller.attachPart(
                            partKey(node.id, part.id),
                            element,
                          )
                        }
                        transform={`translate(${pose.x} ${pose.y}) rotate(${(pose.angle * 180) / Math.PI})`}
                        className={
                          part.grab !== undefined ? "cursor-grab" : undefined
                        }
                      >
                        {part.shapes.flatMap((shape, index) =>
                          renderShape(theme, shape, `${part.id}:${index}`).map(
                            (path) => (
                              <path
                                key={path.d}
                                d={path.d}
                                data-stroke={path.stroke}
                                vectorEffect="non-scaling-stroke"
                              />
                            ),
                          ),
                        )}
                        {machine.ports
                          .filter((port) => port.part === part.id)
                          .map((port) => (
                            <circle
                              key={port.id}
                              ref={(element) => {
                                const key = partKey(node.id, port.id);
                                if (element === null) {
                                  portElements.current.delete(key);
                                } else {
                                  portElements.current.set(key, element);
                                }
                              }}
                              className="port"
                              data-node={node.id}
                              data-port={port.id}
                              cx={port.at.x}
                              cy={port.at.y}
                              r={PORT_RADIUS}
                              vectorEffect="non-scaling-stroke"
                            >
                              <title>{`${PREFAB_LABELS[node.kind]}: ${port.id}`}</title>
                            </circle>
                          ))}
                      </g>
                    );
                  })}
                </g>
                {machine.ports
                  .filter(
                    (port) => !machine.parts.some((p) => p.id === port.part),
                  )
                  .map((port) => (
                    <circle
                      key={port.id}
                      ref={(element) => {
                        const key = partKey(node.id, port.id);
                        if (element === null) {
                          portElements.current.delete(key);
                        } else {
                          portElements.current.set(key, element);
                        }
                      }}
                      className="port"
                      data-node={node.id}
                      data-port={port.id}
                      cx={node.x + port.at.x}
                      cy={node.y + port.at.y}
                      r={PORT_RADIUS}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{`${PREFAB_LABELS[node.kind]}: ${port.id}`}</title>
                    </circle>
                  ))}
                <circle
                  className={
                    node.id === selectedId
                      ? "node-handle node-selected"
                      : "node-handle"
                  }
                  data-node-handle={node.id}
                  cx={node.x}
                  cy={node.y}
                  r={0.14}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{`Move the ${PREFAB_LABELS[node.kind].toLowerCase()}`}</title>
                </circle>
              </g>
            );
          })}
          <g className="ink-ropes">
            {controller.linkRopes.map((rope) => (
              <path
                key={rope.id}
                ref={(element) => controller.attachRope(rope.id, element)}
                d=""
                data-stroke="soft"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <path
            ref={linkLineRef}
            className="link-drag"
            d=""
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      <Marginalia store={controller.readouts} />
      {note !== null && (
        <p
          role="status"
          className="font-body text-ink-faint text-step--1 absolute bottom-52 left-6 max-w-xs italic"
        >
          {note}
        </p>
      )}
    </div>
  );
}
