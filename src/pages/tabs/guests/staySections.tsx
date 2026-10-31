import { type FormEvent, useState } from "react";
import { useEditable } from "../../../components/taskHooks";
import type { Household } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { plural } from "../../../lib/format";
import { comingCount, householdState } from "../../../shared/derive";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";

/** Groups pickups by where they start: the airport, a railway station, or anywhere else. */
function pickupPoint(pickup: string): string {
  if (/airport/i.test(pickup)) return "Airport";
  return /station|junction|railway/i.test(pickup) ? "Railway station" : "Other";
}

/** Room blocks for out-of-town guests, and who is in which room. */
export function Rooms({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const rooms = list(ev, "rooms");
  const households = list(ev, "households");
  const staying = households.filter((h) => h.stay && householdState(h) !== "declined");
  const [hotel, setHotel] = useState("");
  const [count, setCount] = useState("");
  if (rooms.length === 0 && staying.length === 0 && !editable) return null;
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

export function Pickups({ ev }: { ev: PlannrEvent }) {
  const pickups = list(ev, "households").filter((h) => h.pickup && householdState(h) !== "declined");
  if (pickups.length === 0) return null;
  const groups = new Map<string, Household[]>();
  for (const h of pickups) {
    const where = pickupPoint(h.pickup ?? "");
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
