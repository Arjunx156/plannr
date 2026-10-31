import type { SourceFile } from "./sources";

/** A file in `from` must never import anything `banned` matches. */
interface LayerRule {
  from: RegExp;
  banned: RegExp;
  why: string;
}

/** The layering ARCHITECTURE.md describes, lowest layer first. */
const RULES: LayerRule[] = [
  {
    from: /^src\/(data|lib|shared)\//,
    banned: /^src\/(store|components|pages)\//,
    why: "data, lib and shared sit below the app's state and screens",
  },
  {
    from: /^src\/store\//,
    banned: /^src\/(components|pages)\//,
    why: "state sits below the screens",
  },
  {
    from: /^src\/components\//,
    banned: /^src\/pages\//,
    why: "shared pieces don't depend on the screens that use them",
  },
  {
    from: /^src\/shared\//,
    banned: /^src\/lib\/(?!(dates|format|metrics)\.ts$)|^react/,
    why: "shared logic runs on the server too, so it uses only the pure helpers in lib",
  },
  {
    from: /^src\/data\//,
    banned: /^src\/lib\/(?!dates\.ts$)|^react/,
    why: "the data types and demo depend only on dates",
  },
  {
    from: /^server\//,
    banned:
      /^(react|react-dom|react-router)(\/|$)|^src\/(store|components|pages)\/|^src\/lib\/(?!dates\.ts$)/,
    why: "the server never loads React or browser code",
  },
];

/** One import that crosses a layer the wrong way. */
export interface LayerBreak {
  file: string;
  imports: string;
  why: string;
}

/** Every import that breaks a layer rule. */
export function layerBreaks(files: SourceFile[]): LayerBreak[] {
  return files.flatMap(({ file, imports }) =>
    RULES.filter((r) => r.from.test(file)).flatMap((r) =>
      imports.filter((i) => r.banned.test(i)).map((i) => ({ file, imports: i, why: r.why })),
    ),
  );
}
