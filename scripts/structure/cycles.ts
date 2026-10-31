import type { SourceFile } from "./sources";

/** Every import cycle between the project's own files, each as the path that closes it. */
export function importCycles(files: SourceFile[]): string[][] {
  const graph = new Map(files.map((f) => [f.file, f.imports]));
  const state = new Map<string, "open" | "done">();
  const path: string[] = [];
  const cycles: string[][] = [];
  const visit = (file: string) => {
    state.set(file, "open");
    path.push(file);
    for (const next of graph.get(file) ?? []) {
      if (state.get(next) === "open") cycles.push([...path.slice(path.indexOf(next)), next]);
      else if (!state.has(next) && graph.has(next)) visit(next);
    }
    path.pop();
    state.set(file, "done");
  };
  for (const file of graph.keys()) if (!state.has(file)) visit(file);
  return cycles;
}
