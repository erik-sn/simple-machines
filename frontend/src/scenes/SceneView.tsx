import { type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import type { SceneRef, StageMode } from "../book/chapters";
import { MANICULE_PATH, renderShape } from "../ink/render";
import type { SceneDefinition, Vec } from "../physics/types";
import { useTheme } from "../theme/ThemeProvider";
import { SceneController } from "./controller";
import { Marginalia } from "./Marginalia";
import type { SettingValues } from "./settings";

interface Props {
  definition: SceneDefinition;
  scene: SceneRef;
  mode: StageMode;
  settings: SettingValues;
  paused: boolean;
}

const REVEAL_MS = 900;

interface Size {
  width: number;
  height: number;
}

// The illustration: one SVG in world metres (y up), static ink, a group per
// body whose transform the controller writes each frame, ropes, and the hint.
// Remount it (key) to change the machine, the settings, or the mode.
export function SceneView({
  definition,
  scene,
  mode,
  settings,
  paused,
}: Props) {
  const [controller] = useState(
    () => new SceneController(definition, settings, scene.variant, mode),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [size, setSize] = useState<Size>({ width: 16, height: 9 });
  const [hintVisible, setHintVisible] = useState(mode !== "driven");
  const { theme } = useTheme();

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
    controller.setPaused(paused);
  }, [controller, paused]);

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
  const aspect = size.width / size.height;
  const viewHeight = Math.max(camera.height, camera.width / aspect);
  const viewWidth = viewHeight * aspect;
  // A tall viewport keeps the plate in its upper part, clear of the margin
  // notes and the placard: the spare height goes one quarter above.
  const spare = viewHeight - camera.height;
  const above = aspect < 0.7 ? spare * 0.25 : spare / 2;
  const viewBox = {
    x: camera.x - viewWidth / 2,
    y: -camera.y - camera.height / 2 - above,
    width: viewWidth,
    height: viewHeight,
  };

  // Quantized so an ordinary resize does not regenerate every stroke.
  const pxPerMetre = Math.max(
    20,
    Math.round(size.width / viewBox.width / 10) * 10,
  );

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
            {controller.initialMachine.statics.flatMap((shape, index) =>
              renderShape(theme, shape, `static:${index}`, pxPerMetre).map(
                (path) => (
                  <path
                    key={path.d}
                    d={path.d}
                    pathLength={1}
                    data-stroke={path.stroke}
                    data-fill={path.fill}
                    data-dash={path.dash}
                    vectorEffect="non-scaling-stroke"
                  />
                ),
              ),
            )}
          </g>
          <g className="ink-ropes">
            {controller.initialMachine.ropes.map((rope) => (
              <path
                key={rope.id}
                ref={(element) => controller.attachRope(rope.id, element)}
                d=""
                data-stroke={rope.stroke ?? "ink"}
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
                  {part.shapes.flatMap((shape, index) =>
                    renderShape(
                      theme,
                      shape,
                      `${part.id}:${index}`,
                      pxPerMetre,
                    ).map((path) => (
                      <path
                        key={path.d}
                        d={path.d}
                        pathLength={1}
                        data-stroke={path.stroke}
                        data-fill={path.fill}
                        data-dash={path.dash}
                        vectorEffect="non-scaling-stroke"
                      />
                    )),
                  )}
                </g>
              );
            })}
          </g>
          {hintVisible && (
            <g
              ref={(element) => controller.attachHint(element)}
              className="manicule"
            >
              <path d={MANICULE_PATH} vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </g>
      </svg>
      {scene.kind !== "frontispiece" && (
        <Marginalia store={controller.readouts} />
      )}
    </div>
  );
}
