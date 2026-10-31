import { useMemo, useState } from "react";
import { Field } from "../../../components/fields";
import { Modal } from "../../../components/overlays";
import type { PlannrEvent } from "../../../data/types";
import { plural } from "../../../lib/format";
import { functionsOf } from "../../../shared/eventLists";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";

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
          functions: fns.length > 0 ? fns : functionsOf(ev).map((f) => f.id),
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
      <button type="button" className="btn btn-primary self-start" disabled={rows.length === 0} onClick={add}>
        Add {rows.length > 0 ? plural(rows.length, "household") : "them"}
      </button>
    </Modal>
  );
}
