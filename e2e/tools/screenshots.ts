// Captures every page of the book in every theme and two viewports, for
// review. Usage, from e2e/:
//   node tools/screenshots.ts <outDir> [baseURL]
// Without a baseURL it starts Vite from ../frontend on port 5190 (or
// SHOTS_PORT) and stops it when done. Not a test: waits are timed, and
// nothing is asserted.
import { type ChildProcess, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { type Chapter, CHAPTERS } from "../../frontend/src/book/chapters.ts";

const THEMES = ["ink", "graph", "fusion"] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;
const PORT = Number(process.env.SHOTS_PORT ?? "5190");

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error(`No server at ${url} after 60 s`);
}

// Mirrors stagePath in frontend/src/book/paths.ts, which Node cannot import
// directly (its relative imports carry no extension).
function stagePath(chapter: Chapter, stageIndex: number): string {
  if (chapter.kind === "introduction" && stageIndex === 0) {
    return "/";
  }
  return stageIndex === 0
    ? `/${chapter.slug}`
    : `/${chapter.slug}/${stageIndex + 1}`;
}

function slugFor(pagePath: string): string {
  return pagePath === "/" ? "title" : pagePath.slice(1).replaceAll("/", "-");
}

async function main(): Promise<void> {
  const outDir = process.argv[2];
  if (outDir === undefined) {
    throw new Error("usage: node tools/screenshots.ts <outDir> [baseURL]");
  }
  let baseURL = process.argv[3];
  let server: ChildProcess | undefined;
  if (baseURL === undefined) {
    server = spawn("node_modules/.bin/vite", [], {
      cwd: path.resolve(import.meta.dirname, "../../frontend"),
      stdio: "ignore",
      env: { ...process.env, FRONTEND_PORT: String(PORT) },
    });
    baseURL = `http://127.0.0.1:${PORT}`;
    await waitForServer(baseURL);
  }

  const pages = CHAPTERS.flatMap((chapter) =>
    chapter.stages.map((_, index) => stagePath(chapter, index)),
  );
  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      for (const theme of THEMES) {
        const dir = path.join(outDir, viewport.name, theme);
        await mkdir(dir, { recursive: true });
        await context.addInitScript((value: string) => {
          localStorage.setItem("simple-machines:theme", value);
        }, theme);
        for (const pagePath of pages) {
          await page.goto(baseURL + pagePath);
          await sleep(500);
          await page.screenshot({
            path: path.join(dir, `${slugFor(pagePath)}.png`),
          });
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server?.kill();
  }
  process.stdout.write(`${pages.length * THEMES.length * VIEWPORTS.length} screenshots in ${outDir}\n`);
}

await main();
