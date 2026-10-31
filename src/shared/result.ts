/** A value, or the reason there isn't one, so a caller can't forget the second case. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** A successful result. */
export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

/** A failed result, with its reason. */
export function err<E>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

/** Ends a switch that handles every case: a new case that isn't handled fails to compile. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
