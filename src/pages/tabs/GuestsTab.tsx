import { useState } from "react";
import { useEditable } from "../../components/taskHooks";
import type { Household } from "../../data/guestTypes";
import type { PlannrEvent } from "../../data/types";
import { TODAY } from "../../lib/dates";
import { plural } from "../../lib/format";
import { householdState, rsvpSummary } from "../../shared/derive";
import { list } from "../../shared/records";
import { useStore } from "../../store/store";
import { AddHousehold } from "./guests/AddHousehold";
import { Duplicates } from "./guests/Duplicates";
import { FunctionCounts } from "./guests/FunctionCounts";
import { HouseholdList, type MarkField } from "./guests/HouseholdList";
import { HouseholdSheet } from "./guests/HouseholdSheet";
import { InviteQueue } from "./guests/InviteQueue";
import { PasteList } from "./guests/pasteList";
import { Seating } from "./guests/Seating";
import { Pickups, Rooms } from "./guests/staySections";
import { Stat, TabPage } from "./layout";

/** The guest list: answers, headcount by function, invitations, seating, rooms and pickups. */
export function GuestsTab({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const households = list(ev, "households");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  const sides = [...new Set(households.map((h) => h.side).filter((s): s is string => !!s))];
  const queue = households.filter((h) => householdState(h) === "not-sent");

  const mark = (h: Household, field: MarkField) =>
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "households",
      id: h.id,
      patch: { [field]: TODAY },
    });

  const actions = editable && (
    <span className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-secondary" onClick={() => setPasting(true)}>
        Paste a list
      </button>
      <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
        + Add a household
      </button>
    </span>
  );

  return (
    <TabPage eyebrow={ev.name} title="Guests" wide aside={actions}>
      <GuestStats ev={ev} households={households} />
      <FunctionCounts ev={ev} />
      {editable && <Duplicates ev={ev} households={households} />}
      {editable && queue.length > 0 && (
        <InviteQueue ev={ev} queue={queue} onSent={(h) => mark(h, "invitedAt")} />
      )}
      <HouseholdList
        ev={ev}
        households={households}
        sides={sides}
        editable={editable}
        onOpen={setOpen}
        onMark={mark}
      />
      <Seating ev={ev} />
      <Rooms ev={ev} />
      <Pickups ev={ev} />
      <AddHousehold ev={ev} open={adding} onClose={() => setAdding(false)} sides={sides} />
      <PasteList ev={ev} open={pasting} onClose={() => setPasting(false)} />
      <HouseholdSheet
        ev={ev}
        household={households.find((h) => h.id === open)}
        onClose={() => setOpen(null)}
        sides={sides}
      />
    </TabPage>
  );
}

function GuestStats({ ev, households }: { ev: PlannrEvent; households: Household[] }) {
  const summary = rsvpSummary(ev);
  return (
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
  );
}
