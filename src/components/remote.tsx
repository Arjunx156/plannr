import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";

export interface Remote<T> {
  /** null until the first answer arrives. */
  data: T | null;
  /** Why the last load failed, or null. A failed load never looks like an empty list. */
  error: string | null;
  /** Asks again, keeping what's on screen until the answer arrives. */
  reload: () => void;
  /** Updates what's on screen after a change the server has accepted. */
  set: Dispatch<SetStateAction<T | null>>;
}

/**
 * Something a screen loads from the server. Pass `load` memoised with useCallback, or undefined while
 * there's nothing to load (in the demo, say). `refresh` names a value that changes when the server's
 * answer has changed, such as the plan's version, and loads again when it does. Answers that arrive
 * after the screen has moved on are dropped.
 */
export function useRemote<T>(load: (() => Promise<T>) | undefined, refresh?: unknown): Remote<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNow = useCallback(
    (live: () => boolean) => {
      if (!load) return;
      setError(null);
      load()
        .then((d) => live() && setData(d))
        .catch((e: unknown) => live() && setError(e instanceof Error ? e.message : String(e)));
    },
    [load],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is only a signal to load again
  useEffect(() => {
    let live = true;
    fetchNow(() => live);
    return () => {
      live = false;
    };
  }, [fetchNow, refresh]);

  const reload = useCallback(() => fetchNow(() => true), [fetchNow]);
  return { data, error, reload, set: setData };
}

/** Says a load failed, plainly, with a way to try again. */
export function LoadError({ what, error, onRetry }: { what: string; error: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5"
    >
      <p className="m-0 text-sm text-body">
        Couldn't load {what}: {error}. Check the connection and try again.
      </p>
      <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
