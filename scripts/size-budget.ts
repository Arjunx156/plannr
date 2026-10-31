/**
 * Fails the build when the app grows past what a mid-range phone on a slow connection
 * should download. Run after `vite build`. Usage: `bun scripts/size-budget.ts`.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * Gzipped kilobytes. The first load is the entry plus every chunk index.html preloads with it:
 * what every page needs before anything shows.
 */
const BUDGET = { firstLoad: 125, chunk: 60, css: 30 };

const dir = join(import.meta.dir, "..", "dist", "assets");
const html = await Bun.file(join(import.meta.dir, "..", "dist", "index.html")).text();
const entry = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
const preloaded = new Set(
  [...html.matchAll(/rel="modulepreload"[^>]*href="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]),
);
const inFirstLoad = (file: string) => file === entry || preloaded.has(file);

const problems: string[] = [];
const rows: string[] = [];
let firstLoad = 0;
for (const file of await readdir(dir)) {
  if (!/\.(js|css)$/.test(file)) continue;
  const kb = gzipSync(await Bun.file(join(dir, file)).arrayBuffer()).length / 1024;
  rows.push(`${kb.toFixed(1).padStart(7)} KB  ${file}${inFirstLoad(file) ? "  (first load)" : ""}`);
  // First-load chunks count toward the first-load total instead of the per-chunk limit.
  if (inFirstLoad(file)) firstLoad += kb;
  else if (kb > (file.endsWith(".css") ? BUDGET.css : BUDGET.chunk))
    problems.push(`${file} is ${kb.toFixed(1)} KB gzipped, over its budget`);
}
if (firstLoad > BUDGET.firstLoad)
  problems.push(`The first load is ${firstLoad.toFixed(1)} KB gzipped; the budget is ${BUDGET.firstLoad} KB`);
console.log(rows.sort().reverse().slice(0, 8).join("\n"));
console.log(`\nFirst load: ${firstLoad.toFixed(1)} KB gzipped in ${preloaded.size + 1} files.`);
if (problems.length > 0) {
  console.error(`\nOver budget:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("Within budget.");
