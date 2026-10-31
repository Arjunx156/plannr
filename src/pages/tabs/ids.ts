let seq = 0;
/** A new record id: short, unique enough for one plan, and readable in history. */
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}
