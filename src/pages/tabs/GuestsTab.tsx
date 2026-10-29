import { type DragEvent, type FormEvent, useMemo, useState } from "react";
import { useEditable } from "../../components/tasks";
import { Field, Modal, Pill } from "../../components/ui";
import type { FunctionDay, Household, Meal, PlannrEvent } from "../../data/types";
import { TODAY } from "../../lib/dates";
import { plural } from "../../lib/format";
import {
  comingCount,
  duplicateGroups,
  expectedAt,
  functionCount,
  type HouseholdState,
  householdState,
  rsvpSummary,
} from "../../shared/derive";
import { functionsOf, list } from "../../shared/records";
import { toast, useStore } from "../../store/store";
import { newId, Section, ShareLink, Stat, TabPage } from "./common";

const STATE_LABEL: Record<HouseholdState, string> = {
  "not-sent": "Not sent",
  waiting: "Waiting",
  coming: "Coming",
  declined: "Can't come",
};
const STATE_TONE: Record<HouseholdState, "idle" | "due" | "ok" | "warn"> = {
  "not-sent": "idle",
  waiting: "due",
  coming: "ok",
  declined: "idle",
};

type Filter = "all" | HouseholdState | "stay" | "pickup" | `side:${string}`;

function inviteMessage(ev: PlannrEvent, h: Household): string {
  return `Namaste ${h.name}! You're invited to ${ev.name}. Please tell us who's coming:`;
}

function reminderMessage(ev: PlannrEvent, h: Household): string {
  return `Namaste ${h.name}, a gentle reminder from the ${ev.name} family. We'd love to know who's coming:`;
}

export function GuestsTab({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const households = list(ev, "households");
  const fns = functionsOf(ev);
  const summary = rsvpSummary(ev);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  const sides = [...new Set(households.map((h) => h.side).filter((s): s is string => !!s))];
  const dupes = duplicateGroups(households);

  const shown = households.filter((h) => {
    if (q && !h.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "all") return true;
    if (filter === "stay") return !!h.stay;
    if (filter === "pickup") return !!h.pickup;
    if (filter.startsWith("side:")) return h.side === filter.slice(5);
    return householdState(h) === filter;
  });

  const mark = (h: Household, field: "invitedAt" | "remindedAt") =>
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "households",
      id: h.id,
      patch: { [field]: TODAY },
    });

  const merge = (group: Household[]) => {
    const [keep, ...rest] = group;
    if (!keep) return;
    const functions = [...new Set(group.flatMap((h) => h.functions))];
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "households",
      id: keep.id,
      patch: {
        expected: Math.max(...group.map((h) => h.expected)),
        functions,
        phone: group.find((h) => h.phone)?.phone,
        rsvp: Object.assign({}, ...rest.map((h) => h.rsvp), keep.rsvp),
      },
    });
    for (const h of rest) dispatch({ type: "removeRecord", eventId: ev.id, coll: "households", id: h.id });
    dispatch(toast(`Merged into ${keep.name}.`));
  };

  const queue = households.filter((h) => householdState(h) === "not-sent");
  const current = households.find((h) => h.id === open);

  return (
    <TabPage
      eyebrow={ev.name}
      title="Guests"
      wide
      aside={
        editable && (
          <span className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setPasting(true)}>
              Paste a list
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              + Add a household
            </button>
          </span>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Invited"
          value={summary.total}
          sub={`${plural(households.length, "household")} · ${summary.notSent} not sent yet`}
        />
        <Stat label="Coming" value={summary.confirmed} sub="people who said yes" tone="text-leaf-ink" />
        <Stat label="Waiting" value={summary.pending} sub="haven't answered" />
        <Stat label="Can't come" value={summary.declined} sub="said no" />
      </div>

      <Section title="By function" label="Headcount by function">
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table */}
        <section className="scroll-x" aria-label="Headcount by function table" tabIndex={0}>
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 font-medium">Function</th>
                <th className="py-2 text-right font-medium">Invited</th>
                <th className="py-2 text-right font-medium">Coming</th>
                <th className="py-2 text-right font-medium">Waiting</th>
                <th className="py-2 text-right font-medium">Plan for</th>
                <th className="py-2 pl-4 font-medium">Seats</th>
              </tr>
            </thead>
            <tbody>
              {fns.map((f) => {
                const c = functionCount(ev, f.id);
                const plan = expectedAt(c);
                const over = f.capacity && plan > f.capacity;
                return (
                  <tr key={f.id} className="border-t border-sand-2">
                    <td className="py-2.5 font-medium">{f.label}</td>
                    <td className="py-2.5 text-right tabular">{c.invited}</td>
                    <td className="py-2.5 text-right tabular text-leaf-ink">{c.yes}</td>
                    <td className="py-2.5 text-right tabular">{c.waiting}</td>
                    <td className="py-2.5 text-right tabular font-semibold">{plan}</td>
                    <td className={`py-2.5 pl-4 text-xs ${over ? "text-rust-ink" : "text-body"}`}>
                      {f.capacity
                        ? over
                          ? `${plan - f.capacity} over the ${f.capacity} seats`
                          : `${f.capacity - plan} of ${f.capacity} free`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <span className="text-xs text-muted">
          “Plan for” counts everyone coming plus 80% of those who haven't answered. Give it to the caterer a
          week before.
        </span>
      </Section>

      {dupes.length > 0 && editable && (
        <section
          aria-label="Possible duplicates"
          className="flex flex-col gap-2 rounded-2xl border border-amber-line bg-cream p-4 text-amber-ink"
        >
          <span className="font-semibold">
            {plural(dupes.length, "family looks", "families look")} like{" "}
            {dupes.length === 1 ? "it was" : "they were"} added twice
          </span>
          {dupes.map((g) => (
            <span
              key={g.map((h) => h.id).join()}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>{g.map((h) => `${h.name} (${h.expected})`).join(" and ")}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => merge(g)}>
                Merge into one
              </button>
            </span>
          ))}
        </section>
      )}

      {editable && queue.length > 0 && (
        <InviteQueue ev={ev} queue={queue} onSent={(h) => mark(h, "invitedAt")} />
      )}

      <Section
        title="Households"
        aside={<span className="text-sm text-muted">{plural(shown.length, "household")}</span>}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="guest-search" className="sr-only">
            Search households
          </label>
          <input
            id="guest-search"
            className="field sm:max-w-[260px]"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
            <legend className="sr-only">Show</legend>
            {(
              [
                ["all", "All"],
                ["not-sent", "Not sent"],
                ["waiting", "Waiting"],
                ["coming", "Coming"],
                ["declined", "Can't come"],
                ["stay", "Needs a room"],
                ["pickup", "Pickup"],
                ...sides.map((s) => [`side:${s}`, s] as const),
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                className="chip chip-sm"
                onClick={() => setFilter(f)}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {shown.map((h) => {
            const state = householdState(h);
            return (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-sand-2 py-3"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col text-left"
                  onClick={() => setOpen(h.id)}
                >
                  <span className="truncate text-sm font-semibold hover:underline hover:underline-offset-4">
                    {h.name}
                  </span>
                  <span className="text-xs text-muted">
                    {[
                      h.side,
                      `${h.expected} invited`,
                      h.functions.length === fns.length
                        ? "all functions"
                        : h.functions.map((f) => fns.find((x) => x.id === f)?.label ?? f).join(", "),
                      h.stay && "room",
                      h.pickup && "pickup",
                      h.needs,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <Pill tone={STATE_TONE[state]}>
                  {state === "coming" ? `${STATE_LABEL[state]} · ${comingCount(h)}` : STATE_LABEL[state]}
                </Pill>
                {editable && state !== "coming" && state !== "declined" && (
                  <ShareLink
                    ev={ev}
                    kind="rsvp"
                    target={h.id}
                    phone={h.phone}
                    label={state === "not-sent" ? "Invite" : "Remind"}
                    message={state === "not-sent" ? inviteMessage(ev, h) : reminderMessage(ev, h)}
                    onShared={() => mark(h, state === "not-sent" ? "invitedAt" : "remindedAt")}
                  />
                )}
              </li>
            );
          })}
          {!shown.length && (
            <li className="py-6 text-center text-sm text-muted">
              {households.length
                ? "Nobody matches."
                : "No guests yet. Add the first household, or paste a list."}
            </li>
          )}
        </ul>
      </Section>

      <Seating ev={ev} />
      <Rooms ev={ev} />
      <Pickups ev={ev} />

      <AddHousehold ev={ev} open={adding} onClose={() => setAdding(false)} sides={sides} />
      <PasteList ev={ev} open={pasting} onClose={() => setPasting(false)} />
      <HouseholdSheet ev={ev} household={current} onClose={() => setOpen(null)} sides={sides} />
    </TabPage>
  );
}

/** One household at a time: WhatsApp can only open one chat per tap. */
function InviteQueue({
  ev,
  queue,
  onSent,
}: {
  ev: PlannrEvent;
  queue: Household[];
  onSent: (h: Household) => void;
}) {
  const [skip, setSkip] = useState<string[]>([]);
  const next = queue.find((h) => !skip.includes(h.id));
  if (!next) return null;
  return (
    <section
      aria-label="Invitations to send"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-peacock-line bg-peacock-wash p-4"
    >
      <span className="flex flex-col text-sm">
        <span className="font-semibold">
          {plural(queue.length - skip.length, "invitation")} to send · next: {next.name}
        </span>
        <span className="text-body">
          {next.phone
            ? "Opens WhatsApp with the message and their RSVP link ready."
            : "No number saved: pick them in WhatsApp."}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        <ShareLink
          ev={ev}
          kind="rsvp"
          target={next.id}
          phone={next.phone}
          label="Send"
          message={inviteMessage(ev, next)}
          onShared={() => onSent(next)}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setSkip((s) => [...s, next.id])}
        >
          Skip
        </button>
      </span>
    </section>
  );
}

function FunctionPicker({
  fns,
  value,
  onChange,
  name,
}: {
  fns: FunctionDay[];
  value: string[];
  onChange: (v: string[]) => void;
  name: string;
}) {
  if (fns.length <= 1) return null;
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="label mb-1">Invited to</legend>
      <div className="flex flex-wrap gap-1.5">
        {fns.map((f) => (
          <label
            key={f.id}
            className="chip chip-sm cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-paper"
          >
            <input
              type="checkbox"
              name={name}
              className="sr-only"
              checked={value.includes(f.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, f.id] : value.filter((x) => x !== f.id))
              }
            />
            {f.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const phoneDigits = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (!d) return undefined;
  return d.length === 10 ? `91${d}` : d;
};

function AddHousehold({
  ev,
  open,
  onClose,
  sides,
}: {
  ev: PlannrEvent;
  open: boolean;
  onClose: () => void;
  sides: string[];
}) {
  const { dispatch } = useStore();
  const fns = functionsOf(ev);
  const [name, setName] = useState("");
  const [count, setCount] = useState("2");
  const [side, setSide] = useState(sides[0] ?? "");
  const [phone, setPhone] = useState("");
  const [functions, setFunctions] = useState<string[]>(fns.filter((f) => !f.private).map((f) => f.id));
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const people = Number(count);
    const digits = phoneDigits(phone);
    if (!name.trim()) return setError("Add a name, like “Menon family, Thrissur”.");
    if (!(people >= 1 && people <= 500)) return setError("How many people? Between 1 and 500.");
    if (digits && digits.length < 10)
      return setError("That number looks short. Use 10 digits, or add the country code.");
    const chosen = functions.length ? functions : fns.map((f) => f.id);
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "households",
      record: {
        id: newId("h"),
        name: name.trim(),
        expected: people,
        functions: chosen,
        rsvp: {},
        ...(side.trim() ? { side: side.trim() } : {}),
        ...(digits ? { phone: digits } : {}),
      },
    });
    dispatch(toast(`Added ${name.trim()}.`));
    setName("");
    setPhone("");
    setError("");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add a household">
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Name" htmlFor="hh-name" hint="A family or group invited together.">
          <input
            id="hh-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Menon family, Thrissur"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="People" htmlFor="hh-count">
            <input
              id="hh-count"
              className="field"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Side" htmlFor="hh-side">
            <input
              id="hh-side"
              className="field"
              list="hh-sides"
              value={side}
              onChange={(e) => setSide(e.target.value)}
            />
            <datalist id="hh-sides">
              {sides.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="WhatsApp number (optional)" htmlFor="hh-phone">
          <input
            id="hh-phone"
            className="field"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98470 12345"
          />
        </Field>
        <FunctionPicker fns={fns} value={functions} onChange={setFunctions} name="hh-fn" />
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-rust-ink">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary self-start">
          Add household
        </button>
      </form>
    </Modal>
  );
}

/** "Name, people, phone" per line: how most families already keep their list. */
export function parseGuestList(text: string): { name: string; expected: number; phone?: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t|,|;/).map((p) => p.trim());
      const name = parts[0] ?? "";
      const nums = parts.slice(1);
      const count = nums.find((p) => /^\d{1,3}$/.test(p));
      const phone = nums.map((p) => p.replace(/[\s()+-]/g, "")).find((p) => /^\d{10,13}$/.test(p));
      return {
        name,
        expected: count ? Math.max(1, Math.min(500, Number(count))) : 2,
        ...(phone ? { phone: phone.length === 10 ? `91${phone}` : phone } : {}),
      };
    })
    .filter((r) => r.name.length > 1 && !/^\d+$/.test(r.name));
}

function PasteList({ ev, open, onClose }: { ev: PlannrEvent; open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const [text, setText] = useState("");
  const [side, setSide] = useState("");
  const rows = useMemo(() => parseGuestList(text), [text]);
  const fns = functionsOf(ev)
    .filter((f) => !f.private)
    .map((f) => f.id);
  const add = () => {
    for (const r of rows)
      dispatch({
        type: "addRecord",
        eventId: ev.id,
        coll: "households",
        record: {
          id: newId("h"),
          name: r.name.slice(0, 120),
          expected: r.expected,
          functions: fns.length ? fns : functionsOf(ev).map((f) => f.id),
          rsvp: {},
          ...(side.trim() ? { side: side.trim() } : {}),
          ...(r.phone ? { phone: r.phone } : {}),
        },
      });
    dispatch(toast(`Added ${plural(rows.length, "household")}.`));
    setText("");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Paste a guest list" width={560}>
      <p className="m-0 text-sm text-body">
        One household per line: name, how many people, and a phone number if you have it. Copy straight from a
        spreadsheet or a WhatsApp note.
      </p>
      <label htmlFor="paste-list" className="sr-only">
        Guest list
      </label>
      <textarea
        id="paste-list"
        className="field min-h-40 py-2.5 font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Nair family, Thrissur, 4, 9446055501\nKurup family, 3\nOffice friends, 12"}
      />
      <Field label="Side for all of them (optional)" htmlFor="paste-side">
        <input id="paste-side" className="field" value={side} onChange={(e) => setSide(e.target.value)} />
      </Field>
      {rows.length > 0 && (
        <p className="m-0 text-sm">
          {plural(rows.length, "household")}, {rows.reduce((s, r) => s + r.expected, 0)} people. First:{" "}
          {rows[0]?.name} ({rows[0]?.expected}).
        </p>
      )}
      <button type="button" className="btn btn-primary self-start" disabled={!rows.length} onClick={add}>
        Add {rows.length ? plural(rows.length, "household") : "them"}
      </button>
    </Modal>
  );
}

function HouseholdSheet({
  ev,
  household,
  onClose,
  sides,
}: {
  ev: PlannrEvent;
  household: Household | undefined;
  onClose: () => void;
  sides: string[];
}) {
  return (
    <Modal open={!!household} onClose={onClose} title="Household" side="right" width={480}>
      {household && (
        <HouseholdForm key={household.id} ev={ev} h={household} onClose={onClose} sides={sides} />
      )}
    </Modal>
  );
}

function HouseholdForm({
  ev,
  h,
  onClose,
  sides,
}: {
  ev: PlannrEvent;
  h: Household;
  onClose: () => void;
  sides: string[];
}) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const fns = functionsOf(ev);
  const rooms = list(ev, "rooms");
  const [name, setName] = useState(h.name);
  const [expected, setExpected] = useState(String(h.expected));
  const [side, setSide] = useState(h.side ?? "");
  const [phone, setPhone] = useState(h.phone ?? "");
  const [functions, setFunctions] = useState(h.functions);
  const [answers, setAnswers] = useState(h.rsvp);
  const [meal, setMeal] = useState<Meal | undefined>(h.meal);
  const [stay, setStay] = useState(!!h.stay);
  const [room, setRoom] = useState(h.room ?? "");
  const [pickup, setPickup] = useState(h.pickup ?? "");
  const [needs, setNeeds] = useState(h.needs ?? "");
  const save = (e: FormEvent) => {
    e.preventDefault();
    const people = Math.max(1, Math.min(500, Number(expected) || h.expected));
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "households",
      id: h.id,
      patch: {
        name: name.trim() || h.name,
        expected: people,
        side: side.trim() || undefined,
        phone: phoneDigits(phone),
        functions,
        meal,
        stay,
        room: stay && room ? room : undefined,
        pickup: pickup.trim() || undefined,
        needs: needs.trim() || undefined,
      },
    });
    const changed = Object.entries(answers).filter(
      ([f, a]) => JSON.stringify(h.rsvp[f]) !== JSON.stringify(a),
    );
    if (changed.length)
      dispatch({ type: "rsvp", eventId: ev.id, householdId: h.id, answers: Object.fromEntries(changed) });
    dispatch(toast(`Saved ${name.trim() || h.name}.`));
    onClose();
  };
  const remove = () => {
    dispatch({ type: "removeRecord", eventId: ev.id, coll: "households", id: h.id });
    dispatch(toast(`Removed ${h.name}.`));
    onClose();
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-3.5" noValidate>
      <fieldset disabled={!editable} className="m-0 flex flex-col gap-3.5 border-0 p-0">
        <Field label="Name" htmlFor="hs-name">
          <input id="hs-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="People invited" htmlFor="hs-expected">
            <input
              id="hs-expected"
              className="field"
              inputMode="numeric"
              value={expected}
              onChange={(e) => setExpected(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Side" htmlFor="hs-side">
            <input
              id="hs-side"
              className="field"
              list="hs-sides"
              value={side}
              onChange={(e) => setSide(e.target.value)}
            />
            <datalist id="hs-sides">
              {sides.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="WhatsApp number" htmlFor="hs-phone">
          <input
            id="hs-phone"
            className="field"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <FunctionPicker fns={fns} value={functions} onChange={setFunctions} name="hs-fn" />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="label mb-1">Their answer</legend>
          <span className="text-xs text-muted">
            Record it here if they told you in person or on the phone.
          </span>
          {functions.map((fid) => {
            const f = fns.find((x) => x.id === fid);
            const a = answers[fid] ?? { status: "pending" as const, count: 0 };
            return (
              <div key={fid} className="grid grid-cols-[1fr_auto_72px] items-center gap-2 text-sm">
                <span>{f?.label ?? fid}</span>
                <select
                  aria-label={`Answer for ${f?.label ?? fid}`}
                  className="field h-9 min-h-0 appearance-auto py-0 text-sm"
                  value={a.status}
                  onChange={(e) =>
                    setAnswers((all) => ({
                      ...all,
                      [fid]: {
                        status: e.target.value as "pending" | "yes" | "no",
                        count: e.target.value === "yes" ? a.count || h.expected : 0,
                      },
                    }))
                  }
                >
                  <option value="pending">Waiting</option>
                  <option value="yes">Coming</option>
                  <option value="no">Can't come</option>
                </select>
                <input
                  aria-label={`People coming to ${f?.label ?? fid}`}
                  className="field h-9 min-h-0 py-0 text-sm"
                  inputMode="numeric"
                  disabled={a.status !== "yes"}
                  value={a.status === "yes" ? String(a.count) : ""}
                  onChange={(e) =>
                    setAnswers((all) => ({
                      ...all,
                      [fid]: { status: "yes", count: Number(e.target.value.replace(/\D/g, "")) || 1 },
                    }))
                  }
                />
              </div>
            );
          })}
        </fieldset>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="label mb-1">Meal</legend>
          <div className="flex flex-wrap gap-1.5">
            {(["veg", "nonveg", "jain"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={meal === m}
                className="chip chip-sm"
                onClick={() => setMeal(meal === m ? undefined : m)}
              >
                {m === "veg" ? "Vegetarian" : m === "nonveg" ? "Non-veg" : "Jain"}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={stay}
            onChange={(e) => setStay(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-leaf)]"
          />
          Needs a room
        </label>
        {stay && rooms.length > 0 && (
          <Field label="Room block" htmlFor="hs-room">
            <select
              id="hs-room"
              className="field appearance-auto"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="">Not assigned</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.hotel}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Pickup" htmlFor="hs-pickup" hint="Where and when, e.g. “Cochin airport, Thu 3:15 am”.">
          <input
            id="hs-pickup"
            className="field"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
          />
        </Field>
        <Field label="Needs" htmlFor="hs-needs">
          <input
            id="hs-needs"
            className="field"
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
            placeholder="A wheelchair, a seat near the front"
          />
        </Field>
        {h.note && (
          <p className="m-0 rounded-xl bg-sand p-3 text-sm">
            <span className="eyebrow mr-1 text-muted">Their note</span> {h.note}
          </p>
        )}
      </fieldset>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
          <button type="button" className="btn btn-ghost text-rust-ink" onClick={remove}>
            Remove household
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-sm text-body">Their RSVP page:</span>
        <ShareLink
          ev={ev}
          kind="rsvp"
          target={h.id}
          phone={h.phone}
          label="Send"
          message={inviteMessage(ev, h)}
        />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- seating

function Seating({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const tables = list(ev, "tables");
  const fns = functionsOf(ev);
  const seated = fns.filter((f) => tables.some((t) => t.fnId === f.id));
  const [fnId, setFnId] = useState(seated[0]?.id ?? fns[fns.length - 1]?.id ?? "");
  const [drag, setDrag] = useState<string | null>(null);
  const households = list(ev, "households").filter(
    (h) => h.functions.includes(fnId) && h.rsvp[fnId]?.status !== "no",
  );
  const here = tables.filter((t) => t.fnId === fnId);
  const people = (h: Household) =>
    h.rsvp[fnId]?.status === "yes" ? (h.rsvp[fnId]?.count ?? h.expected) : h.expected;
  const atTable = (tid: string) => households.filter((h) => h.tables?.[fnId] === tid);
  const unseated = households.filter(
    (h) => !h.tables?.[fnId] || !here.some((t) => t.id === h.tables?.[fnId]),
  );

  const seat = (hid: string, tid: string | undefined) => {
    const h = households.find((x) => x.id === hid);
    if (!h) return;
    const next = { ...h.tables };
    if (tid) next[fnId] = tid;
    else delete next[fnId];
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "households", id: hid, patch: { tables: next } });
  };

  const addTables = (n: number) => {
    const start = here.length;
    for (let i = 0; i < n; i++)
      dispatch({
        type: "addRecord",
        eventId: ev.id,
        coll: "tables",
        record: { id: newId("t"), fnId, name: `Table ${start + i + 1}`, seats: 10 },
      });
  };

  const onDrop = (tid: string | undefined) => (e: DragEvent) => {
    e.preventDefault();
    const hid = e.dataTransfer.getData("text/plain") || drag;
    if (hid) seat(hid, tid);
    setDrag(null);
  };

  return (
    <Section
      title="Seating"
      aside={
        fns.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-body">
            For
            <select
              className="field h-9 min-h-0 appearance-auto py-0 text-sm"
              value={fnId}
              onChange={(e) => setFnId(e.target.value)}
            >
              {fns.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )
      }
    >
      {!here.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-body">
          <span>
            No tables for this function yet.{" "}
            {households.length
              ? `${Math.ceil(households.reduce((s, h) => s + people(h), 0) / 10)} tables of 10 would seat everyone invited.`
              : ""}
          </span>
          {editable && households.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addTables(Math.ceil(households.reduce((s, h) => s + people(h), 0) / 10))}
            >
              Add tables of 10
            </button>
          )}
        </div>
      ) : (
        <>
          <span className="text-xs text-muted">
            Drag a household onto a table, or choose its table from the list. Counts use their RSVP when
            they've answered.
          </span>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; each household also has a table picker */}
          <div
            className="flex min-h-12 flex-wrap gap-1.5 rounded-xl border border-dashed border-line-2 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop(undefined)}
            title="Not seated yet"
          >
            <span className="eyebrow w-full text-muted">
              Not seated · {unseated.reduce((s, h) => s + people(h), 0)} people
            </span>
            {unseated.map((h) => (
              <SeatChip
                key={h.id}
                h={h}
                people={people(h)}
                tables={here}
                editable={editable}
                onSeat={(tid) => seat(h.id, tid)}
                onDrag={setDrag}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {here.map((t) => {
              const guests = atTable(t.id);
              const used = guests.reduce((s, h) => s + people(h), 0);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; each household also has a table picker
                <div
                  key={t.id}
                  className={`flex min-h-24 flex-col gap-1.5 rounded-xl border p-2.5 ${used > t.seats ? "border-rust-line bg-rust-tint" : "border-line bg-paper"}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop(t.id)}
                >
                  <span className="flex justify-between text-xs font-semibold">
                    {t.name}
                    <span className={used > t.seats ? "text-rust-ink" : "text-muted"}>
                      {used}/{t.seats}
                    </span>
                  </span>
                  {guests.map((h) => (
                    <SeatChip
                      key={h.id}
                      h={h}
                      people={people(h)}
                      tables={here}
                      editable={editable}
                      onSeat={(tid) => seat(h.id, tid)}
                      onDrag={setDrag}
                      current={t.id}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {editable && (
            <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => addTables(1)}>
              + Add a table
            </button>
          )}
        </>
      )}
    </Section>
  );
}

function SeatChip({
  h,
  people,
  tables,
  editable,
  onSeat,
  onDrag,
  current,
}: {
  h: Household;
  people: number;
  tables: { id: string; name: string }[];
  editable: boolean;
  onSeat: (tid: string | undefined) => void;
  onDrag: (id: string | null) => void;
  current?: string;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; the table picker inside does the same by keyboard
    <span
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", h.id);
        onDrag(h.id);
      }}
      className="flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-xs shadow-[0_1px_2px_rgba(0,0,0,.06)]"
    >
      <span className="min-w-0 flex-1 truncate" title={h.name}>
        {h.name} · {people}
      </span>
      {editable && (
        <select
          aria-label={`Table for ${h.name}`}
          className="max-w-[90px] rounded border border-line bg-paper text-[11px]"
          value={current ?? ""}
          onChange={(e) => onSeat(e.target.value || undefined)}
        >
          <option value="">No table</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- rooms and pickups

function Rooms({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const rooms = list(ev, "rooms");
  const households = list(ev, "households");
  const staying = households.filter((h) => h.stay && householdState(h) !== "declined");
  const [hotel, setHotel] = useState("");
  const [count, setCount] = useState("");
  if (!rooms.length && !staying.length && !editable) return null;
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(count);
    if (!hotel.trim() || !(n >= 1)) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "rooms",
      record: { id: newId("rm"), hotel: hotel.trim(), rooms: n },
    });
    setHotel("");
    setCount("");
  };
  return (
    <Section
      title="Rooms"
      aside={<span className="text-sm text-muted">{plural(staying.length, "household")} need a room</span>}
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {rooms.map((r) => {
          const guests = households.filter((h) => h.room === r.id);
          return (
            <li
              key={r.id}
              className="flex flex-col gap-0.5 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{r.hotel}</span>
                <span className={guests.length > r.rooms ? "text-rust-ink" : "text-body"}>
                  {guests.length} of {r.rooms} rooms{r.nights ? ` · ${r.nights}` : ""}
                  {r.rate ? ` · ₹${r.rate.toLocaleString("en-IN")} a night` : ""}
                </span>
              </span>
              <span className="text-xs text-muted">
                {guests.map((h) => h.name).join(" · ") || "Nobody assigned yet"}
              </span>
              {r.note && <span className="text-xs text-body">{r.note}</span>}
            </li>
          );
        })}
      </ul>
      {staying.some((h) => !h.room) && (
        <span className="text-xs text-rust-ink">
          Still to place:{" "}
          {staying
            .filter((h) => !h.room)
            .map((h) => h.name)
            .join(", ")}
          . Open a household to assign a room.
        </span>
      )}
      {editable && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <label htmlFor="room-hotel" className="sr-only">
            Hotel
          </label>
          <input
            id="room-hotel"
            className="field min-w-0 flex-1"
            placeholder="Hotel or homestay"
            value={hotel}
            onChange={(e) => setHotel(e.target.value)}
          />
          <label htmlFor="room-count" className="sr-only">
            Rooms
          </label>
          <input
            id="room-count"
            className="field w-24"
            inputMode="numeric"
            placeholder="Rooms"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
          />
          <button type="submit" className="btn btn-secondary" disabled={!hotel.trim() || !count}>
            Add block
          </button>
        </form>
      )}
    </Section>
  );
}

function Pickups({ ev }: { ev: PlannrEvent }) {
  const pickups = list(ev, "households").filter((h) => h.pickup && householdState(h) !== "declined");
  if (!pickups.length) return null;
  const groups = new Map<string, Household[]>();
  for (const h of pickups) {
    const where = /airport/i.test(h.pickup ?? "")
      ? "Airport"
      : /station|junction|railway/i.test(h.pickup ?? "")
        ? "Railway station"
        : "Other";
    groups.set(where, [...(groups.get(where) ?? []), h]);
  }
  return (
    <Section
      title="Pickups"
      aside={
        <span className="text-sm text-muted">
          {plural(
            pickups.reduce((s, h) => s + (comingCount(h) || h.expected), 0),
            "person",
            "people",
          )}
        </span>
      }
    >
      {[...groups.entries()].map(([where, hs]) => (
        <div key={where} className="flex flex-col gap-1">
          <span className="eyebrow text-muted">{where}</span>
          <ul className="m-0 flex list-none flex-col p-0">
            {hs.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap justify-between gap-2 border-t border-sand-2 py-2 text-sm first:border-0"
              >
                <span className="font-medium">{h.name}</span>
                <span className="text-body">
                  {h.pickup} · {comingCount(h) || h.expected} people
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
