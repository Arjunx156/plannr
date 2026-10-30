import { type FormEvent, useRef, useState } from "react";
import { useEditable } from "../../../components/tasks";
import { Pill } from "../../../components/ui";
import type { FunctionDay, PlannrEvent } from "../../../data/types";
import { api } from "../../../lib/api";
import { plural } from "../../../lib/format";
import { shrinkImage } from "../../../lib/images";
import { clock, runsheetFor } from "../../../shared/derive";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { newId, Section, ShareLink } from "../common";

/** The day's checklist for one function, ticked off by whoever is on it. */
export function Checklist({ ev, fn, editable }: { ev: PlannrEvent; fn: FunctionDay; editable: boolean }) {
  const { dispatch } = useStore();
  const items = list(ev, "checklist").filter((c) => !c.fnId || c.fnId === fn.id);
  const [label, setLabel] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "checklist",
      record: { id: newId("ck"), fnId: fn.id, label: label.trim(), done: false },
    });
    setLabel("");
  };
  const left = items.filter((c) => !c.done).length;
  return (
    <Section
      title="Don't forget"
      aside={
        <span className="text-sm text-muted">{left ? `${left} left` : items.length ? "all packed" : ""}</span>
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2.5 border-t border-sand-2 py-2 text-sm first:border-0"
          >
            <input
              type="checkbox"
              id={`ck-${c.id}`}
              checked={c.done}
              disabled={!editable}
              onChange={(e) =>
                dispatch({
                  type: "updateRecord",
                  eventId: ev.id,
                  coll: "checklist",
                  id: c.id,
                  patch: { done: e.target.checked },
                })
              }
              className="h-4 w-4"
            />
            <label htmlFor={`ck-${c.id}`} className={`flex-1 ${c.done ? "text-muted line-through" : ""}`}>
              {c.label}
            </label>
            {c.owner && <span className="text-xs text-muted">{c.owner}</span>}
          </li>
        ))}
        {!items.length && (
          <li className="text-sm text-muted">
            The rings, the thali, the cash envelopes, the phone chargers…
          </li>
        )}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="ck-new" className="sr-only">
            Add to the checklist
          </label>
          <input
            id="ck-new"
            className="field flex-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Add something"
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!label.trim()}>
            Add
          </button>
        </form>
      )}
    </Section>
  );
}

export function Arrivals({ ev, fn }: { ev: PlannrEvent; fn: FunctionDay }) {
  const arriving = list(ev, "vendors")
    .flatMap((v) => (v.arrivals ?? []).filter((a) => a.fnId === fn.id).map((a) => ({ v, a })))
    .sort((x, y) => x.a.time.localeCompare(y.a.time));
  if (!arriving.length) return null;
  return (
    <Section title="Vendors arriving">
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {arriving.map(({ v, a }) => (
          <li key={v.id} className="flex items-center justify-between gap-2 rounded-xl bg-sand p-3 text-sm">
            <span className="flex flex-col">
              <span className="font-semibold">
                {clock(a.time)} · {v.name || v.category}
              </span>
              <span className="text-xs text-muted">{v.needs ?? v.category}</span>
            </span>
            {v.phone && (
              <a href={`tel:${v.phone}`} className="btn btn-ghost btn-sm">
                Call
              </a>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Helpers({ ev, fn }: { ev: PlannrEvent; fn: FunctionDay }) {
  const owners = new Map<string, string | undefined>();
  for (const r of runsheetFor(ev, fn.id)) if (r.owner && !owners.has(r.owner)) owners.set(r.owner, r.phone);
  for (const c of list(ev, "checklist"))
    if (c.owner && (!c.fnId || c.fnId === fn.id) && !owners.has(c.owner)) owners.set(c.owner, undefined);
  if (ev.layout !== "empty")
    for (const t of ev.tasks.list)
      if (!t.done && t.who && t.who !== "You" && t.fn === fn.id && !owners.has(t.who))
        owners.set(t.who, undefined);
  if (!owners.size) return null;
  return (
    <Section title="Helpers">
      <span className="text-sm text-body">
        Each helper gets a page with only their jobs and checklist, which they can tick off from their phone.
        No account needed.
      </span>
      <ul className="m-0 flex list-none flex-col p-0">
        {[...owners].map(([name, phone]) => (
          <li
            key={name}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm first:border-0"
          >
            <span className="font-medium">{name}</span>
            <ShareLink
              ev={ev}
              kind="helper"
              target={name}
              phone={phone}
              label="Send"
              message={`Hi ${name}, here are your jobs for ${ev.name}. Tick them off as you go:`}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Album({ ev }: { ev: PlannrEvent }) {
  const { state, dispatch } = useStore();
  const editable = useEditable(ev);
  const photos = list(ev, "album");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const account = state.mode === "account";
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of [...files].slice(0, 10)) {
        const { url } = await api.eventPhoto(ev.id, await shrinkImage(file));
        dispatch({
          type: "addRecord",
          eventId: ev.id,
          coll: "album",
          record: { id: newId("ph"), url, by: state.account.user?.name || "The family", at: "" },
        });
      }
    } catch (e) {
      dispatch(toast((e as Error).message));
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  return (
    <Section
      title="Shared album"
      aside={photos.length ? <Pill tone="ok">{plural(photos.length, "photo")}</Pill> : undefined}
    >
      <span className="text-sm text-body">
        Guests add their photos from their phones to one album, without an app or an account.
      </span>
      {photos.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-4 gap-1.5 p-0">
          {photos.slice(-8).map((p) => (
            <li key={p.id}>
              <img
                src={p.url}
                alt={p.caption ?? `Photo from ${p.by}`}
                loading="lazy"
                className="aspect-square w-full rounded-lg object-cover"
              />
            </li>
          ))}
        </ul>
      )}
      <span className="flex flex-wrap gap-2">
        <ShareLink
          ev={ev}
          kind="album"
          label="Share the album"
          message={`Add your photos from ${ev.name} here:`}
        />
        {account && editable && (
          <>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => add(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? "Uploading…" : "Add photos"}
            </button>
          </>
        )}
      </span>
    </Section>
  );
}
