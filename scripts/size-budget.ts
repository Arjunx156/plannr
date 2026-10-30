/**
 * Fails the build when the app grows past what a mid-range phone on a slow connection
 * should download. Run after `vite build`. Usage: `bun scripts/size-budget.ts`.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** Gzipped kilobytes. The entry is what every page needs before anything shows. */
const BUDGET = { entry: 170, chunk: 60, css: 30 };

const dir = join(import.meta.dir, "..", "dist", "assets");
const html = await Bun.file(join(import.meta.dir, "..", "dist", "index.html")).text();
const entry = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
/** The gzipped size allowed for one built file. */
function budgetFor(file: string): number {
  if (file.endsWith(".css")) return BUDGET.css;
  return file === entry ? BUDGET.entry : BUDGET.chunk;
}

const problems: string[] = [];
const rows: string[] = [];
for (const file of await readdir(dir)) {
  if (!/\.(js|css)$/.test(file)) continue;
  const kb = gzipSync(await Bun.file(join(dir, file)).arrayBuffer()).length / 1024;
  const limit = budgetFor(file);
  rows.push(`${kb.toFixed(1).padStart(7)} KB  ${file}${file === entry ? "  (entry)" : ""}`);
  if (kb > limit) problems.push(`${file} is ${kb.toFixed(1)} KB gzipped; the budget is ${limit} KB`);
}
console.log(rows.sort().reverse().slice(0, 8).join("\n"));
if (problems.length) {
  console.error(`\nOver budget:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("\nWithin budget.");
