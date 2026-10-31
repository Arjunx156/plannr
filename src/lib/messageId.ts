let seq = 0;

/** A unique id for an assistant message. */
export function msgId(): string {
  seq += 1;
  return `m${Date.now().toString(36)}${seq}`;
}
