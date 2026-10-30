import { useState } from "react";
import { useEditable } from "../../components/tasks";
import { Pill } from "../../components/ui";
import type { Household, PlannrEvent } from "../../data/types";
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
import { Section, ShareLink, Stat, TabPage } from "./common";
import { AddHousehold, HouseholdSheet, PasteList } from "./guests/HouseholdForms";
import { Seating } from "./guests/Seating";
import { Pickups, Rooms } from "./guests/Stay";
import { inviteMessage, reminderMessage } from "./guests/shared";

/** How each RSVP state reads in the list. */
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

/** "12 of 300 free", "8 over the 300 seats", or a dash when the venue's capacity isn't known. */
function seatsLeft(expected: number, capacity: number | undefined): string {
  if (!capacity) return "—";
  return expected > capacity
    ? `${expected - capacity} over the ${capacity} seats`
    : `${capacity - expected} of ${capacity} free`;
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
                      {seatsLeft(plan, f.capacity)}
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
