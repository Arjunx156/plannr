import { useRef, useState } from "react";
import { useAiOn } from "../../components/useAiOn";
import { aiRead, type ReadResult } from "../../lib/ai";
import { toast, useStore } from "../../store/store";

/**
 * "Read a bill or quote": a photo or PDF in, the amounts and terms out, for the person to
 * check before anything is added. Shown only when the server has AI.
 */
export function ReadDocument({
  label = "Read a bill or quote",
  categories,
  guests,
  onRead,
}: {
  label?: string;
  categories: string[];
  guests?: number;
  onRead: (r: ReadResult) => void;
}) {
  const { dispatch } = useStore();
  const ai = useAiOn();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!ai) return null;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onRead(await aiRead(file, { categories, guests }));
    } catch (e) {
      dispatch(toast((e as Error).message));
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Reading…" : label}
      </button>
    </>
  );
}
