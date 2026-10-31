import ts from "typescript";

/** Every `style` prop in one file, as file:line. Inline styles would need `'unsafe-inline'` in the CSP. */
export function inlineStyles(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText() === "style")
      found.push(`${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
