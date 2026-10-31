/**
 * The architecture fitness checks, run by `just check` and CI. Each prints one line, then lists
 * whatever broke it:
 *
 * 1. no file over 300 lines, tests included; demo seed data is data rather than logic, so it's exempt;
 * 2. no import cycles between the project's own files;
 * 3. imports follow the layers in ARCHITECTURE.md;
 * 4. a doc comment on every export;
 * 5. type assertions only in the files allowed below, each with its reason in a comment above it;
 * 6. no inline `style` props, so the CSP can refuse inline styles.
 */
import { castsIn } from "./structure/casts";
import { importCycles } from "./structure/cycles";
import { undocumented } from "./structure/docs";
import { layerBreaks } from "./structure/layers";
import { sources } from "./structure/sources";
import { inlineStyles } from "./structure/styles";

const MAX_LINES = 300;
const EXEMPT = /^src\/data\/demo\//;

/** Where a cast may appear, and how many. Each sits at a boundary TypeScript can't follow. */
const ALLOWED_CASTS: Record<string, number> = {
  "src/shared/guards.ts": 2, // keysOf and mapStrings, which keep the shape they were given
  "src/shared/records.ts": 1, // one collection's store, picked by its key
  "src/store/store.tsx": 1, // saved state this same app wrote
  "src/lib/api.ts": 1, // answers the server already validated
  "server/validate.ts": 1, // input zod has just checked
  "server/backup.ts": 1, // an insert into a table picked at runtime
  "server/db/local.ts": 1, // PGlite and Neon behind one Drizzle type
  "server/db/neon.ts": 1,
};

const files = sources(["src", "server", "scripts", "tests", "e2e"]);

function longFiles(): string[] {
  return files
    .filter((f) => f.lines > MAX_LINES && !EXEMPT.test(f.file))
    .map((f) => `${f.file}: ${f.lines} lines`);
}

function castProblems(): string[] {
  const casts = files.flatMap((f) => castsIn(f.source));
  const lines = new Map<string, number[]>();
  for (const c of casts) lines.set(c.file, [...(lines.get(c.file) ?? []), c.line]);
  const over = [...lines]
    .filter(([file, at]) => at.length > (ALLOWED_CASTS[file] ?? 0))
    .map(
      ([file, at]) =>
        `${file}: ${at.length} cast(s), ${ALLOWED_CASTS[file] ?? 0} allowed (lines ${at.join(", ")})`,
    );
  const unexplained = casts
    .filter((c) => !c.explained)
    .map((c) => `${c.file}:${c.line}: no reason above \`${c.text}\``);
  return [...over, ...unexplained];
}

const checks: { rule: string; problems: string[] }[] = [
  { rule: `no file over ${MAX_LINES} lines`, problems: longFiles() },
  {
    rule: "no import cycles",
    problems: importCycles(files).map((c) => `cycle: ${c.join(" → ")}`),
  },
  {
    rule: "imports follow the layers",
    problems: layerBreaks(files).map((b) => `${b.file} imports ${b.imports}: ${b.why}`),
  },
  {
    rule: "every export documented",
    problems: files.flatMap((f) => undocumented(f.source)).map((u) => `${u.file}:${u.line} ${u.name}`),
  },
  { rule: "casts only where allowed, each with a reason", problems: castProblems() },
  { rule: "no inline style props", problems: files.flatMap((f) => inlineStyles(f.source)) },
];

console.log(`${files.length} files`);
for (const { rule, problems } of checks) {
  console.log(problems.length > 0 ? `FAIL  ${rule}: ${problems.length}` : `ok    ${rule}`);
  for (const p of problems) console.error(`        ${p}`);
}
if (checks.some((c) => c.problems.length > 0)) process.exit(1);
