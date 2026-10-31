const WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

export function toNumber(raw: string): number | undefined {
  const word = WORDS[raw.toLowerCase()];
  if (word !== undefined) return word;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function cap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
