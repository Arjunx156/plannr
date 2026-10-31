/**
 * Fails when unit-test coverage of lines or functions falls below its floor, counted over
 * every file the tests load. Screens are covered by the browser journeys instead, so the
 * floor is on the total rather than per file. Run after `bun test --coverage`.
 */

/** The least share of lines and of functions the unit tests must run. */
const FLOOR = { lines: 0.9, functions: 0.87 };

const lcov = await Bun.file(new URL("../coverage/lcov.info", import.meta.url)).text();
const found = { lines: 0, functions: 0 };
const hit = { lines: 0, functions: 0 };
for (const line of lcov.split("\n")) {
  const [key, value] = line.split(":");
  const n = Number(value);
  if (key === "LF") found.lines += n;
  if (key === "LH") hit.lines += n;
  if (key === "FNF") found.functions += n;
  if (key === "FNH") hit.functions += n;
}
let failed = false;
for (const name of ["lines", "functions"] as const) {
  const share = found[name] ? hit[name] / found[name] : 1;
  console.log(`${name.padEnd(9)} ${(share * 100).toFixed(1)}% (${hit[name]} of ${found[name]})`);
  if (share < FLOOR[name]) failed = true;
}
if (failed) {
  console.error(
    `\nCoverage is below the floor: ${FLOOR.lines * 100}% of lines, ${FLOOR.functions * 100}% of functions.`,
  );
  process.exit(1);
}
