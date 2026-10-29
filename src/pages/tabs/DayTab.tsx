import { type FormEvent, useEffect, useRef, useState } from "react";
import { useEditable } from "../../components/tasks";
import { Field, Modal, Pill } from "../../components/ui";
import type { FunctionDay, PlannrEvent, RunItem } from "../../data/types";
import { api } from "../../lib/api";
import { longDate, TODAY } from "../../lib/dates";
import { plural } from "../../lib/format";
import { shrinkImage } from "../../lib/images";
import { checkInCount, clock, comingCount, functionOn, nowAndNext, runsheetFor } from "../../shared/derive";
import { readEntryCode } from "../../shared/public";
import { functionsOf, list } from "../../shared/records";
import { toast, useStore } from "../../store/store";
import { newId, Section, ShareLink, TabPage } from "./common";
import { Updates } from "./SiteTab";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The time of day, ticking every 30 seconds while the page is open. */
function useClock(): string {
  const [now, setNow] = useState(() => hhmm(new Date()));
  useEffect(() => {
    const t = window.setInterval(() => setNow(hhmm(new Date())), 30000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** /events/:id/day — the run sheet, check-in and everything the day itself needs, on one phone. */
export function DayTab({ ev }: { ev: PlannrEvent }) {
  const editable = useEditable(ev);
  const fns = functionsOf(ev)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  const [fnId, setFnId] = useState(() => functionOn(ev, TODAY)?.id ?? fns[0]?.id ?? "day");
  const fn = fns.find((f) => f.id === fnId) ?? fns[0];
  if (!fn) return null;
  const live = fn.date === TODAY;
  return (
    <TabPage
      eyebrow={ev.name}
      title="Day of"
      wide
      aside={
        fns.length > 1 && (
          <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
            <legend className="sr-only">Function</legend>
            {fns.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.id === fn.id}
                className="chip chip-sm"
                onClick={() => setFnId(f.id)}
              >
                {f.label}
                {f.date === TODAY ? " · today" : ""}
              </button>
            ))}
          </fieldset>
        )
      }
    >
      <p className="m-0 text-body">
        {fn.label} · {longDate(fn.date)}
        {fn.place ? ` · ${fn.place}` : ""}
        {!live && fn.date > TODAY ? ". The live view switches on that morning." : ""}
      </p>
      <RunSheet ev={ev} fn={fn} live={live} editable={editable} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CheckIn ev={ev} fn={fn} editable={editable} />
        <Checklist ev={ev} fn={fn} editable={editable} />
      </div>
      <Arrivals ev={ev} fn={fn} />
      <Helpers ev={ev} fn={fn} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Updates ev={ev} editable={editable} />
        <Album ev={ev} />
      </div>
    </TabPage>
  );
}

// ---------------------------------------------------------------- run sheet

function RunSheet({
  ev,
  fn,
  live,
  editable,
}: {
  ev: PlannrEvent;
  fn: FunctionDay;
  live: boolean;
  editable: boolean;
}) {
  const { dispatch } = useStore();
  const now = useClock();
  const items = runsheetFor(ev, fn.id);
  const { now: current, next } = nowAndNext(items, live ? now : "00:00");
  const [editing, setEditing] = useState<RunItem | "new" | null>(null);
  const anchor = current ?? next[0];
  const done = (r: RunItem, value: boolean) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "runsheet", id: r.id, patch: { done: value } });
  const late = (minutes: number) => {
    if (!anchor) return;
    dispatch({ type: "shiftRunsheet", eventId: ev.id, fnId: fn.id, fromId: anchor.id, minutes });
    dispatch(toast(`Everything from “${anchor.title}” moved ${minutes} minutes later.`));
  };
  return (
    <Section
      title="Run sheet"
      aside={
        <span className="flex items-center gap-2">
          {live && <span className="font-mono text-sm tabular text-muted">{clock(now)}</span>}
          {editable && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing("new")}>
              + Add
            </button>
          )}
        </span>
      }
    >
      {live && anchor && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-xl bg-ink p-4 text-white">
            <span className="eyebrow text-stone">{current ? "Now" : "Up next"}</span>
            <span className="font-serif text-[26px] leading-tight">{anchor.title}</span>
            <span className="text-sm text-stone">
              {clock(anchor.time)}
              {anchor.owner ? ` · ${anchor.owner}` : ""}
            </span>
            {editable && (
              <button
                type="button"
                className="btn btn-sm mt-2 self-start bg-white text-ink"
                onClick={() => done(anchor, true)}
              >
                Done
              </button>
            )}
          </div>
          {editable && (
            <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
              <span className="font-semibold">Running late?</span>
              <span className="text-sm text-body">Moves “{anchor.title}” and everything after it.</span>
              <span className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} type="button" className="btn btn-secondary btn-sm" onClick={() => late(m)}>
                    +{m} min
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      )}
      <ol className="m-0 flex list-none flex-col p-0">
        {items.map((r) => {
          const isNow = live && r.id === current?.id;
          return (
            <li
              key={r.id}
              className={`grid grid-cols-[24px_64px_minmax(0,1fr)_auto] items-start gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0 ${isNow ? "bg-peacock-tint" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={`${r.title} done`}
                checked={!!r.done}
                disabled={!editable}
                onChange={(e) => done(r, e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className={`tabular ${r.done ? "text-muted line-through" : "font-semibold"}`}>
                {clock(r.time)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={r.done ? "text-muted line-through" : ""}>{r.title}</span>
                {(r.owner || r.note) && (
                  <span className="text-xs text-muted">
                    {r.owner}
                    {r.owner && r.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${r.phone}`} className="link">
                          call
                        </a>
                      </>
                    )}
                    {r.note ? `${r.owner ? " · " : ""}${r.note}` : ""}
                  </span>
                )}
              </span>
              {editable && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Edit ${r.title}`}
                  onClick={() => setEditing(r)}
                >
                  Edit
                </button>
              )}
            </li>
          );
        })}
        {!items.length && (
          <li className="text-sm text-muted">
            Nothing on the run sheet for {fn.label} yet. Add the timings and who's in charge of each.
          </li>
        )}
      </ol>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add to the run sheet" : "Edit"}
      >
        {editing && (
          <RunItemForm
            key={editing === "new" ? "new" : editing.id}
            ev={ev}
            fn={fn}
            item={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Section>
  );
}

function RunItemForm({
  ev,
  fn,
  item,
  onDone,
}: {
  ev: PlannrEvent;
  fn: FunctionDay;
  item?: RunItem;
  onDone: () => void;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState({
    time: item?.time ?? "10:00",
    title: item?.title ?? "",
    owner: item?.owner ?? "",
    phone: item?.phone ?? "",
    note: item?.note ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.time) return;
    const record: RunItem = {
      id: item?.id ?? newId("r"),
      fnId: fn.id,
      time: form.time,
      title: form.title.trim(),
      ...(form.owner.trim() ? { owner: form.owner.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.replace(/[^\d+]/g, "") } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
      ...(item?.done ? { done: true } : {}),
    };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "runsheet", record });
    onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Time" htmlFor="ri-time">
          <input
            id="ri-time"
            type="time"
            className="field"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
        </Field>
        <Field label="What happens" htmlFor="ri-title">
          <input
            id="ri-title"
            className="field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Baraat arrives"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Who's in charge" htmlFor="ri-owner">
          <input
            id="ri-owner"
            className="field"
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
          />
        </Field>
        <Field label="Their phone" htmlFor="ri-phone">
          <input
            id="ri-phone"
            className="field"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Note" htmlFor="ri-note">
        <input
          id="ri-note"
          className="field"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </Field>
      <span className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={!form.title.trim()}>
          Save
        </button>
        {item && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              dispatch({ type: "removeRecord", eventId: ev.id, coll: "runsheet", id: item.id });
              onDone();
            }}
          >
            Remove
          </button>
        )}
      </span>
    </form>
  );
}

// ---------------------------------------------------------------- check-in

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorClass = new (opts: { formats: string[] }) => Detector;

function detectorClass(): DetectorClass | undefined {
  return (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
}

function CheckIn({ ev, fn, editable }: { ev: PlannrEvent; fn: FunctionDay; editable: boolean }) {
  const { dispatch } = useStore();
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const invited = list(ev, "households").filter((h) => h.functions.includes(fn.id));
  if (!invited.length) return null;
  const { inside, expected } = checkInCount(ev, fn.id);
  const term = q.trim().toLowerCase();
  const shown = (
    found
      ? invited.filter((h) => h.id === found)
      : invited.filter((h) => !term || h.name.toLowerCase().includes(term) || h.phone?.endsWith(term))
  )
    .sort((a, b) => Number(!!b.rsvp[fn.id]?.count) - Number(!!a.rsvp[fn.id]?.count))
    .slice(0, 12);
  const set = (id: string, count: number) =>
    dispatch({ type: "checkIn", eventId: ev.id, coll: "households", id, fnId: fn.id, count });
  const scanned = (text: string) => {
    const id = readEntryCode(text);
    const h = id ? invited.find((x) => x.id === id) : undefined;
    setScanning(false);
    if (!h) {
      dispatch(toast("That code isn't an invitation to this function."));
      return;
    }
    setFound(h.id);
    setQ("");
    const coming = h.rsvp[fn.id]?.status === "yes" ? h.rsvp[fn.id]?.count : comingCount(h);
    if (!h.checkedIn?.[fn.id]) set(h.id, coming || h.expected);
    dispatch(toast(`Welcome, ${h.name}: ${plural(coming || h.expected, "person", "people")} checked in.`));
  };
  return (
    <Section
      title="Check-in"
      aside={
        <span className="font-serif text-[24px] tabular">
          {inside} <span className="text-base text-muted">/ {expected}</span>
        </span>
      }
    >
      <div className="flex gap-2">
        <label htmlFor="ci-q" className="sr-only">
          Find a family
        </label>
        <input
          id="ci-q"
          className="field flex-1"
          placeholder="Name or last digits of the phone"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFound(null);
          }}
        />
        {editable && detectorClass() && (
          <button type="button" className="btn btn-secondary" onClick={() => setScanning(true)}>
            Scan
          </button>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((h) => {
          const a = h.rsvp[fn.id];
          const n = h.checkedIn?.[fn.id] ?? 0;
          return (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm first:border-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{h.name}</span>
                <span className="text-xs text-muted">
                  {a?.status === "yes"
                    ? `${a.count} coming`
                    : a?.status === "no"
                      ? "said they can't come"
                      : "didn't answer"}
                  {n ? ` · ${n} in` : ""}
                </span>
              </span>
              {editable && (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`One less for ${h.name}`}
                    disabled={n <= 0}
                    onClick={() => set(h.id, n - 1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center tabular">{n}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-label={`One more in for ${h.name}`}
                    disabled={n >= h.expected + 2}
                    onClick={() => set(h.id, n + 1)}
                  >
                    +
                  </button>
                  {!n && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => set(h.id, a?.status === "yes" ? a.count : h.expected)}
                    >
                      All in
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted">
        Guests who said yes have an entry code on their invitation page.
        {detectorClass() ? "" : " Scanning works in Chrome on Android; elsewhere, search by name."}
      </span>
      {scanning && <Scanner onCode={scanned} onClose={() => setScanning(false)} />}
    </Section>
  );
}

function Scanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  // The camera starts once; a fresh callback each render mustn't restart it.
  const found = useRef(onCode);
  found.current = onCode;
  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector) return;
    let stream: MediaStream | undefined;
    let timer = 0;
    let stopped = false;
    const detector = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          const text = codes[0]?.rawValue;
          if (text) found.current(text);
          else timer = window.setTimeout(tick, 250);
        };
        tick();
      })
      .catch(() => setError("Plannr needs the camera to scan. Allow it in the browser, or search by name."));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      for (const t of stream?.getTracks() ?? []) t.stop();
    };
  }, []);
  return (
    <Modal open onClose={onClose} title="Scan an entry code" width={420}>
      {error ? (
        <p className="m-0 text-sm text-rust-ink">{error}</p>
      ) : (
        <video
          ref={video}
          className="aspect-square w-full rounded-xl bg-ink object-cover"
          playsInline
          muted
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- checklist, vendors, helpers

function Checklist({ ev, fn, editable }: { ev: PlannrEvent; fn: FunctionDay; editable: boolean }) {
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

function Arrivals({ ev, fn }: { ev: PlannrEvent; fn: FunctionDay }) {
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

function Helpers({ ev, fn }: { ev: PlannrEvent; fn: FunctionDay }) {
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

function Album({ ev }: { ev: PlannrEvent }) {
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
