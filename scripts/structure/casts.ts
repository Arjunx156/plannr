import ts from "typescript";

/** A type assertion (`x as T`), which tells the compiler to trust rather than check. */
export interface Cast {
  file: string;
  line: number;
  text: string;
  /** Whether a `//` comment above the statement says why the cast is safe. */
  explained: boolean;
}

function isConstAssertion(node: ts.AsExpression | ts.TypeAssertion): boolean {
  return ts.isTypeReferenceNode(node.type) && node.type.typeName.getText() === "const";
}

// `x as unknown as T` is one cast, counted at its outer end.
function isCast(node: ts.Node): node is ts.AsExpression | ts.TypeAssertion {
  return (
    (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
    !isConstAssertion(node) &&
    !ts.isAsExpression(node.parent)
  );
}

// A `//` comment above the cast's statement, or above any part of it on the way down to the cast.
function hasReason(node: ts.Node, text: string): boolean {
  for (let n = node; !ts.isSourceFile(n); n = n.parent) {
    const ranges = ts.getLeadingCommentRanges(text, n.getFullStart()) ?? [];
    if (ranges.some((r) => text.startsWith("//", r.pos))) return true;
    if (ts.isBlock(n.parent) || ts.isSourceFile(n.parent)) return false;
  }
  return false;
}

/** Every type assertion in one file except `as const`, which only narrows. */
export function castsIn(source: ts.SourceFile): Cast[] {
  const casts: Cast[] = [];
  const text = source.getFullText();
  const visit = (node: ts.Node) => {
    if (isCast(node))
      casts.push({
        file: source.fileName,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        text: node.getText().replaceAll(/\s+/g, " ").slice(0, 80),
        explained: hasReason(node, text),
      });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return casts;
}
