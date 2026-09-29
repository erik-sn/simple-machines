import { useEffect, useRef, useState } from "react";
import { paperRaster } from "./paper";
import { useTheme } from "./ThemeProvider";

interface Size {
  width: number;
  height: number;
}

// The page itself: the rasterized sheet on a canvas, with the laid lines and
// toning as CSS layers on top (index.css, .paper). Re-rasterized only after a
// settled resize or a theme change.
export function Paper() {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }
      const { width, height } = entry.contentRect;
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => setSize({ width, height }), 150);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (size === null || size.width === 0 || size.height === 0) {
      return;
    }
    let cancelled = false;
    paperRaster(theme, size.width, size.height).then(
      (raster) => {
        const canvas = canvasRef.current;
        if (cancelled || canvas === null) {
          return;
        }
        canvas.width = raster.width;
        canvas.height = raster.height;
        const context = canvas.getContext("2d", { alpha: false });
        if (context === null) {
          throw new Error("Could not draw the paper: no 2D context");
        }
        context.drawImage(raster, 0, 0);
        setReady(true);
      },
      (error: unknown) => {
        // The base colour is already painted; a failed raster is still an error.
        throw error;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [theme, size]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="paper absolute inset-0"
    >
      <canvas
        ref={canvasRef}
        className="paper-raster absolute inset-0 h-full w-full"
        data-ready={ready ? "" : undefined}
      />
    </div>
  );
}
