import { type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import type { SceneRef, StageMode } from "../book/chapters";
import type { SceneDefinition, Vec } from "../physics/types";
import { SceneController } from "./controller";
import { Marginalia } from "./Marginalia";
import type { SettingValues } from "./settings";
import { shapeToPath } from "./shapes";

interface Props {
  definition: SceneDefinition;
  scene: SceneRef;
  mode: StageMode;
  settings: SettingValues;
}

const REVEAL_MS = 900;

interface Size {
  width: number;
  height: number;
}

// The illustration: one SVG in world metres (y up), static ink, a group per
// body whose transform the controller writes each frame, ropes, and the hint.
// Remount it (key) to change the machine, the settings, or the mode.
export function SceneView({ definition, scene, mode, settings }: Props) {
  const [controller] = useState(
    () => new SceneController(definition, settings, scene.variant, mode),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [size, setSize] = useState<Size>({ width: 16, height: 9 });
  const [hintVisible, setHintVisible] = useState(mode !== "driven");

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
    controller.listenFirstGrab(() => setHintVisible(false));
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(() => controller.start(), reduced ? 0 : REVEAL_MS);
    return () => {
      clearTimeout(timer);
      controller.dispose();
    };
  }, [controller]);

  const { camera } = definition;
  const viewWidth = camera.height * (size.width / size.height);
  const viewBox = {
    x: camera.x - viewWidth / 2,
    y: -camera.y - camera.height / 2,
    width: viewWidth,
    height: camera.height,
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

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!controller.isStarted && mode !== "still") {
      return;
    }
    if (controller.grab(toWorld(event))) {
      if (!controller.isStarted) {
        controller.start();
      }
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (dragging.current) {
      controller.move(toWorld(event));
    }
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragging.current) {
      dragging.current = false;
      controller.release();
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        className="ink block h-full w-full touch-none select-none"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${scene.kind} illustration`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g transform="scale(1 -1)">
          <g className="ink-static">
            {controller.initialMachine.statics.map((shape) => (
              <path
                key={shapeToPath(shape)}
                d={shapeToPath(shape)}
                pathLength={1}
                data-stroke={shape.stroke ?? "ink"}
                data-fill={"fill" in shape && shape.fill ? "" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <g className="ink-ropes">
            {controller.initialMachine.ropes.map((rope) => (
              <path
                key={rope.id}
                ref={(element) => controller.attachRope(rope.id, element)}
                d=""
                data-stroke={rope.stroke ?? "soft"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <g className="ink-dynamic">
            {controller.initialParts.map((part) => {
              const pose = controller.poseOf(part);
              return (
                <g
                  key={part.id}
                  ref={(element) => controller.attachPart(part.id, element)}
                  transform={`translate(${pose.x} ${pose.y}) rotate(${(pose.angle * 180) / Math.PI})`}
                  className={
                    part.grab !== undefined ? "cursor-grab" : undefined
                  }
                >
                  {part.shapes.map((shape) => (
                    <path
                      key={shapeToPath(shape)}
                      d={shapeToPath(shape)}
                      pathLength={1}
                      data-stroke={shape.stroke ?? "ink"}
                      data-fill={"fill" in shape && shape.fill ? "" : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {part.grab !== undefined && hintVisible && (
                    <circle
                      className="grab-hint"
                      cx={part.grab.hintAt.x}
                      cy={part.grab.hintAt.y}
                      r={0.18}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <Marginalia store={controller.readouts} />
    </div>
  );
}
