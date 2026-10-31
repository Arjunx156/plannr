let seq = 0;

export function msgId(): string {
  seq += 1;
  return `m${Date.now().toString(36)}${seq}`;
}
