import type { ThemeId } from "./themes";

// The sheet, built once per theme, size, and pixel ratio and rasterized to a
// canvas, so no full-viewport filter ever runs live (docs/research/aesthetics.md,
// sections 1.3 to 1.6). The SVG travels as a data URL because the nginx CSP
// allows img-src data: and not blob:.

function fibreFilter(id: string, seed: number, amplitude: number): string {
  return `
    <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.7 0.45" numOctaves="3" seed="${seed}" stitchTiles="stitch" result="fibre"/>
      <feDiffuseLighting in="fibre" lighting-color="#ffffff" surfaceScale="${amplitude}" diffuseConstant="1" result="lit">
        <feDistantLight azimuth="40" elevation="62"/>
      </feDiffuseLighting>
      <feComponentTransfer in="lit" result="litSoft">
        <feFuncR type="linear" slope="0.18" intercept="0.84"/>
        <feFuncG type="linear" slope="0.18" intercept="0.84"/>
        <feFuncB type="linear" slope="0.18" intercept="0.84"/>
        <feFuncA type="table" tableValues="1 1"/>
      </feComponentTransfer>
      <feBlend in="SourceGraphic" in2="litSoft" mode="multiply" result="fibrePaper"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="${seed + 3}" result="mottleRaw"/>
      <feColorMatrix in="mottleRaw" type="saturate" values="0" result="mottle"/>
      <feComponentTransfer in="mottle" result="mottleLight">
        <feFuncR type="linear" slope="0.16" intercept="0.86"/>
        <feFuncG type="linear" slope="0.16" intercept="0.85"/>
        <feFuncB type="linear" slope="0.16" intercept="0.82"/>
        <feFuncA type="table" tableValues="1 1"/>
      </feComponentTransfer>
      <feBlend in="fibrePaper" in2="mottleLight" mode="multiply"/>
    </filter>`;
}

function foxingFilter(id: string, seed: number): string {
  return `
    <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="${seed}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.36  0 0 0 0 0.18  0 0 0 9 -7.4" result="spots"/>
      <feGaussianBlur in="spots" stdDeviation="0.6"/>
    </filter>`;
}

function gridPattern(
  minor: number,
  major: number,
  rule: string,
  strong: string,
): string {
  return `
    <pattern id="minor" width="${minor}" height="${minor}" patternUnits="userSpaceOnUse">
      <path d="M${minor} 0H0V${minor}" fill="none" stroke="${rule}" stroke-width="1" shape-rendering="crispEdges"/>
    </pattern>
    <pattern id="major" width="${major}" height="${major}" patternUnits="userSpaceOnUse">
      <rect width="${major}" height="${major}" fill="url(#minor)"/>
      <path d="M${major} 0H0V${major}" fill="none" stroke="${strong}" stroke-width="1" shape-rendering="crispEdges"/>
    </pattern>`;
}

export function paperMarkup(
  theme: ThemeId,
  width: number,
  height: number,
): string {
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  switch (theme) {
    case "ink":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>${fibreFilter("fibre", 11, 1.4)}${foxingFilter("foxing", 19)}</defs>
        <rect width="100%" height="100%" fill="#efe6d2" filter="url(#fibre)"/>
        <rect width="100%" height="100%" filter="url(#foxing)" opacity="0.45"/>
      </svg>`;
    case "graph":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>${fibreFilter("fibre", 23, 0.5)}${gridPattern(19, 38, "rgb(120 150 200 / 0.28)", "rgb(100 135 195 / 0.55)")}</defs>
        <rect width="100%" height="100%" fill="#f6f3ea" filter="url(#fibre)"/>
        <rect x="0.4" y="0.2" width="100%" height="100%" fill="url(#major)" opacity="0.35" style="filter: hue-rotate(20deg)"/>
        <rect width="100%" height="100%" fill="url(#major)"/>
        <rect x="38" y="38" width="${w - 76}" height="${h - 76}" fill="none" stroke="rgb(60 80 120 / 0.8)" stroke-width="1.3"/>
      </svg>`;
    case "fusion":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>${fibreFilter("fibre", 31, 1.0)}${gridPattern(19, 38, "rgb(140 120 90 / 0.16)", "rgb(120 100 70 / 0.3)")}</defs>
        <rect width="100%" height="100%" fill="#ece4d0" filter="url(#fibre)"/>
        <rect width="100%" height="100%" fill="url(#major)"/>
      </svg>`;
    default: {
      const never: never = theme;
      throw new Error(`No paper for theme ${String(never)}`);
    }
  }
}

const cache = new Map<string, Promise<HTMLCanvasElement>>();

export function paperRaster(
  theme: ThemeId,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const key = `${theme}:${Math.ceil(width)}x${Math.ceil(height)}@${dpr}`;
  let job = cache.get(key);
  if (job === undefined) {
    job = (async () => {
      const markup = paperMarkup(theme, width, height);
      const image = new Image();
      image.decoding = "async";
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      const context = canvas.getContext("2d", { alpha: false });
      if (context === null) {
        throw new Error("Could not rasterize the paper: no 2D context");
      }
      context.scale(dpr, dpr);
      context.drawImage(image, 0, 0, width, height);
      return canvas;
    })();
    cache.set(key, job);
  }
  return job;
}
