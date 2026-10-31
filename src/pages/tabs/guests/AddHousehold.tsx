import { type FormEvent, useState } from "react";
import { Field } from "../../../components/fields";
import { Modal } from "../../../components/overlays";
import type { PlannrEvent } from "../../../data/types";
import { functionsOf } from "../../../shared/eventLists";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";
import { FunctionPicker, PeopleAndSide, phoneDigits } from "./shared";

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
    const chosen = functions.length > 0 ? functions : fns.map((f) => f.id);
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
        <PeopleAndSide
          id="hh"
          label="People"
          count={count}
          onCount={setCount}
          side={side}
          onSide={setSide}
          sides={sides}
        />
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
