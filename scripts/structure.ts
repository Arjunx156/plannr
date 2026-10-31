/**
 * Keeps the code easy to find your way around: no source file over 300 lines, and no import
 * cycles between the project's own modules. Demo seed data is exempt from the length cap,
 * since it is data rather than logic. Run by `just check` and CI.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const MAX_LINES = 300;
const EXEMPT = /^src\/data\/demo\//;
/** A static import or re-export of a relative path; lazy `import()` calls are left out on purpose. */
const IMPORT = /(?:^import\s*|\bfrom\s*)["'](\.{1,2}\/[^"']+)["']/gm;

const files = [...new Bun.Glob("{src,server,scripts}/**/*.{ts,tsx}").scanSync(ROOT)]
  .map((f) => f.replaceAll("\\", "/"))
  .sort();

/** The file an import names, trying the extensions and index files TypeScript would. */
function resolveImport(from: string, spec: string): string | undefined {
  const base = relative(ROOT, join(ROOT, dirname(from), spec)).replaceAll("\\", "/");
  const tries = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return tries.find((f) => /\.tsx?$/.test(f) && existsSync(join(ROOT, f)));
}

/** Every import cycle, each as the path that closes it. */
function findCycles(graph: Map<string, string[]>): string[][] {
  const state = new Map<string, "open" | "done">();
  const path: string[] = [];
  const cycles: string[][] = [];
  const visit = (file: string) => {
    state.set(file, "open");
    path.push(file);
    for (const next of graph.get(file) ?? []) {
      if (state.get(next) === "open") cycles.push([...path.slice(path.indexOf(next)), next]);
      else if (!state.has(next)) visit(next);
    }
    path.pop();
    state.set(file, "done");
  };
  for (const file of graph.keys()) if (!state.has(file)) visit(file);
  return cycles;
}

const graph = new Map<string, string[]>();
const long: { file: string; lines: number }[] = [];
for (const file of files) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  if (lines > MAX_LINES && !EXEMPT.test(file)) long.push({ file, lines });
  const deps = [...text.matchAll(IMPORT)].flatMap((m) => resolveImport(file, m[1] ?? "") ?? []);
  graph.set(file, deps);
}
const cycles = findCycles(graph);

console.log(
  `${files.length} files · ${long.length} over ${MAX_LINES} lines · ${cycles.length} import cycles`,
);
for (const { file, lines } of long) console.error(`  ${file}: ${lines} lines`);
for (const cycle of cycles) console.error(`  cycle: ${cycle.join(" → ")}`);
if (long.length > 0 || cycles.length > 0) process.exit(1);
