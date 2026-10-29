/** Cells a spreadsheet would run as a formula: =, +, -, @, or a leading tab or carriage return. */
const FORMULA = /^[=+\-@\t\r]/;

/**
 * Rows as CSV, every cell quoted. A cell that would start a formula gets a leading
 * apostrophe, so a name like "=HYPERLINK(...)" opens as text, not as a live link.
 */
export function toCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => `"${(FORMULA.test(c) ? `'${c}` : c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
