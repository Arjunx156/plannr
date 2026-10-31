import ts from "typescript";

/** An exported declaration with no doc comment above it. */
export interface Undocumented {
  file: string;
  line: number;
  name: string;
}

const DECLARATIONS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.VariableStatement,
]);

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function hasDoc(node: ts.Node, text: string): boolean {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  return ranges.some((r) => text.startsWith("/**", r.pos));
}

function nameOf(node: ts.Statement): string {
  if (ts.isVariableStatement(node))
    return node.declarationList.declarations.map((d) => d.name.getText()).join(", ");
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
    return node.name?.getText() ?? "(default)";
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node))
    return node.name.getText();
  return "(default)";
}

/** Exported functions, classes, types and constants in one file that have no `/** … *\/` comment. */
export function undocumented(source: ts.SourceFile): Undocumented[] {
  const text = source.getFullText();
  return source.statements
    .filter((s) => DECLARATIONS.has(s.kind) && isExported(s) && !hasDoc(s, text))
    .map((s) => ({
      file: source.fileName,
      line: source.getLineAndCharacterOfPosition(s.getStart()).line + 1,
      name: nameOf(s),
    }));
}
