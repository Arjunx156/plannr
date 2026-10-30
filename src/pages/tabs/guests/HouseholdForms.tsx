import { type FormEvent, useMemo, useState } from "react";
import { useEditable } from "../../../components/tasks";
import { Field, Modal } from "../../../components/ui";
import type { Household, Meal, PlannrEvent } from "../../../data/types";
import { plural } from "../../../lib/format";
import { functionsOf, list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { newId, ShareLink } from "../common";
import { FunctionPicker, inviteMessage, phoneDigits } from "./shared";

/** Adds one household by hand. */
const MEAL_LABEL: Record<Meal, string> = { veg: "Vegetarian", nonveg: "Non-veg", jain: "Jain" };

export function AddHousehold({
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

export function PasteList({ ev, open, onClose }: { ev: PlannrEvent; open: boolean; onClose: () => void }) {
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

export function HouseholdSheet({
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
                {MEAL_LABEL[m]}
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
