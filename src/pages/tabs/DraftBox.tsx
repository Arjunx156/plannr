import { useId, useState } from "react";
import { useAiOn } from "../../components/useAiOn";
import { aiWrite, type WriteTask } from "../../lib/ai";
import { toast, useStore } from "../../store/store";
import { waLink } from "./links";

/**
 * A message Plannr can draft: a vendor enquiry, a thank-you, a permit letter. It starts from
 * a plain template that works offline, and "Write it for me" asks the model for a better one.
 * Nothing is sent from here; the family sends it from WhatsApp or copies it.
 */
export function DraftBox({
  task,
  context,
  fallback,
  phone,
  lang,
  onSave,
  saveLabel = "Save",
  rows = 6,
}: {
  task: WriteTask;
  context: Record<string, unknown>;
  fallback: string;
  phone?: string;
  lang?: string;
  onSave?: (text: string) => void;
  saveLabel?: string;
  rows?: number;
}) {
  const { dispatch } = useStore();
  const ai = useAiOn();
  const id = useId();
  const [text, setText] = useState(fallback);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState(lang ?? "en");
  const write = async () => {
    setBusy(true);
    const out = await aiWrite({ task, lang: language, text, context });
    setBusy(false);
    if (out) setText(out);
    else dispatch(toast("Plannr couldn't write that just now. The draft is still yours to edit."));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      dispatch(toast("Copied."));
    } catch {
      window.prompt("Copy this", text);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        Draft
      </label>
      <textarea
        id={id}
        className="field py-2 text-sm leading-relaxed"
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {ai && (
          <>
            <label className="sr-only" htmlFor={`${id}-lang`}>
              Language
            </label>
            <select
              id={`${id}-lang`}
              className="field h-8 w-auto py-0 text-xs"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="ml">Malayalam</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
            </select>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={write}>
              {busy ? "Writing…" : "Write it for me"}
            </button>
          </>
        )}
        <a
          href={waLink(text, phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
        >
          Open in WhatsApp
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          Copy
        </button>
        {onSave && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSave(text)}>
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
