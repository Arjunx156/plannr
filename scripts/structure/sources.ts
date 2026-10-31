import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";

/** The repository root. */
export const ROOT: string = join(import.meta.dir, "..", "..");

/** One source file, read and parsed once for every check. */
export interface SourceFile {
  /** The path from the repository root, with forward slashes. */
  file: string;
  lines: number;
  source: ts.SourceFile;
  /** What each static import names: a repository path for the project's own files, else the package. */
  imports: string[];
}

// The file an import names, trying the extensions and index files TypeScript would.
function resolveImport(from: string, spec: string): string | undefined {
  const base = relative(ROOT, join(ROOT, dirname(from), spec)).replaceAll("\\", "/");
  const tries = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return tries.find((f) => /\.tsx?$/.test(f) && existsSync(join(ROOT, f)));
}

// Static imports and re-exports only; lazy `import()` calls split bundles and are left out on purpose.
function specifiers(source: ts.SourceFile): string[] {
  return source.statements.flatMap((s) =>
    (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) &&
    s.moduleSpecifier &&
    ts.isStringLiteral(s.moduleSpecifier)
      ? [s.moduleSpecifier.text]
      : [],
  );
}

function target(file: string, spec: string): string {
  return spec.startsWith(".") ? (resolveImport(file, spec) ?? spec) : spec;
}

function read(file: string): SourceFile {
  const text = readFileSync(join(ROOT, file), "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  return {
    file,
    lines: text.split("\n").length - (text.endsWith("\n") ? 1 : 0),
    source,
    imports: specifiers(source).map((spec) => target(file, spec)),
  };
}

/** Every TypeScript file in the given folders, parsed. */
export function sources(folders: string[]): SourceFile[] {
  const glob = new Bun.Glob(`{${folders.join(",")}}/**/*.{ts,tsx}`);
  return [...glob.scanSync(ROOT)]
    .map((f) => f.replaceAll("\\", "/"))
    .sort()
    .map(read);
}
