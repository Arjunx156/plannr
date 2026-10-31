import { useState } from "react";
import { Pill } from "../../../components/ui";
import type { FunctionDay } from "../../../data/baseTypes";
import type { Household } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { plural } from "../../../lib/format";
import { comingCount, type HouseholdState, householdState } from "../../../shared/derive";
import { functionsOf } from "../../../shared/eventLists";
import { Section } from "../layout";
import { ShareLink } from "../ShareLink";
import { inviteMessage, reminderMessage } from "./shared";

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

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["not-sent", "Not sent"],
  ["waiting", "Waiting"],
  ["coming", "Coming"],
  ["declined", "Can't come"],
  ["stay", "Needs a room"],
  ["pickup", "Pickup"],
];

export type MarkField = "invitedAt" | "remindedAt";

function matches(h: Household, query: string, filter: Filter): boolean {
  if (query && !h.name.toLowerCase().includes(query.toLowerCase())) return false;
  if (filter === "all") return true;
  if (filter === "stay") return !!h.stay;
  if (filter === "pickup") return !!h.pickup;
  if (filter.startsWith("side:")) return h.side === filter.slice(5);
  return householdState(h) === filter;
}

/** "Bride's side · 4 invited · all functions · room". */
function detailLine(h: Household, fns: FunctionDay[]): string {
  const functions =
    h.functions.length === fns.length
      ? "all functions"
      : h.functions.map((f) => fns.find((x) => x.id === f)?.label ?? f).join(", ");
  return [h.side, `${h.expected} invited`, functions, h.stay && "room", h.pickup && "pickup", h.needs]
    .filter(Boolean)
    .join(" · ");
}

interface ListProps {
  ev: PlannrEvent;
  households: Household[];
  sides: string[];
  editable: boolean;
  onOpen: (id: string) => void;
  onMark: (h: Household, field: MarkField) => void;
}

/** Every household, searchable and filtered by answer, side, room or pickup. */
export function HouseholdList({ ev, households, sides, editable, onOpen, onMark }: ListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const fns = functionsOf(ev);
  const shown = households.filter((h) => matches(h, query, filter));
  const filters = [...FILTERS, ...sides.map((s): [Filter, string] => [`side:${s}`, s])];
  return (
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
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
          <legend className="sr-only">Show</legend>
          {filters.map(([f, label]) => (
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
        {shown.map((h) => (
          <HouseholdRow
            key={h.id}
            ev={ev}
            h={h}
            detail={detailLine(h, fns)}
            editable={editable}
            onOpen={onOpen}
            onMark={onMark}
          />
        ))}
        {shown.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">
            {households.length > 0
              ? "Nobody matches."
              : "No guests yet. Add the first household, or paste a list."}
          </li>
        )}
      </ul>
    </Section>
  );
}

type RowProps = Omit<ListProps, "households" | "sides"> & { h: Household; detail: string };

function HouseholdRow({ ev, h, detail, editable, onOpen, onMark }: RowProps) {
  const state = householdState(h);
  const invite = state === "not-sent";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-sand-2 py-3">
      <button type="button" className="flex min-w-0 flex-1 flex-col text-left" onClick={() => onOpen(h.id)}>
        <span className="truncate text-sm font-semibold hover:underline hover:underline-offset-4">
          {h.name}
        </span>
        <span className="text-xs text-muted">{detail}</span>
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
          label={invite ? "Invite" : "Remind"}
          message={invite ? inviteMessage(ev, h) : reminderMessage(ev, h)}
          onShared={() => onMark(h, invite ? "invitedAt" : "remindedAt")}
        />
      )}
    </li>
  );
}
