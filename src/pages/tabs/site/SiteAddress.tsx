import { type FormEvent, useState } from "react";
import { Field } from "../../../components/fields";
import type { PlannrEvent } from "../../../data/types";
import { api, publicUrl } from "../../../lib/api";
import { toast, useStore } from "../../../store/store";

export function SiteAddress({
  ev,
  address,
  onChange,
  editable,
}: {
  ev: PlannrEvent;
  address: string;
  onChange: (a: string) => void;
  editable: boolean;
}) {
  const { dispatch } = useStore();
  const slug = address.split("/e/")[1] ?? "";
  const [draft, setDraft] = useState(slug);
  const [busy, setBusy] = useState(false);
  const rename = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const l = await api.renameSite(ev.id, draft);
      onChange(publicUrl("site", l.token));
      setDraft(l.token);
      dispatch(toast("Address changed. The old one no longer works."));
    } catch (err) {
      dispatch(toast((err as Error).message));
    }
    setBusy(false);
  };
  return (
    <form onSubmit={rename} className="flex flex-wrap items-end gap-2">
      <Field label="Address" htmlFor="site-slug">
        <span className="field gap-1 font-mono text-xs">
          <span className="text-muted">{address.split("/e/")[0]}/e/</span>
          <input
            id="site-slug"
            className="min-w-0 flex-1 bg-transparent outline-none"
            value={draft}
            disabled={!editable}
            onChange={(e) => setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          />
        </span>
      </Field>
      {editable && draft !== slug && (
        <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || draft.length < 3}>
          Change address
        </button>
      )}
      <a href={address} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
        Open
      </a>
    </form>
  );
}
