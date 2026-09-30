// Captures one page at desktop size, for iterating on a plate. Usage, from e2e/:
//   node tools/shot-one.ts <path> <out.png> [theme] [baseURL]
// Without a baseURL it starts Vite from ../frontend on SHOTS_PORT (5191).
import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const PORT = Number(process.env.SHOTS_PORT ?? "5191");

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) {
        return;
      }
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error(`No server at ${url} after 60 s`);
}

const [pagePath, out, theme = "ink", givenBase] = process.argv.slice(2);
if (pagePath === undefined || out === undefined) {
  throw new Error("usage: node tools/shot-one.ts <path> <out.png> [theme] [baseURL]");
}
let baseURL = givenBase;
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
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript((value: string) => {
    localStorage.setItem("simple-machines:theme", value);
  }, theme);
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    process.stderr.write(`page error: ${error.message}\n`);
  });
  await page.goto(baseURL + pagePath);
  await sleep(700);
  await page.screenshot({ path: out });
} finally {
  await browser.close();
  server?.kill();
}
