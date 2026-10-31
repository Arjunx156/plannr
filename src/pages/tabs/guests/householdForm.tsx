import { type FormEvent, useState } from "react";
import { Field } from "../../../components/fields";
import { useEditable } from "../../../components/taskHooks";
import type { Household, Meal } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { functionsOf } from "../../../shared/eventLists";
import { toast, useStore } from "../../../store/store";
import { ShareLink } from "../ShareLink";
import { type Answers, AnswersField, MealField, StayFields } from "./householdFields";
import { FunctionPicker, inviteMessage, PeopleAndSide, phoneDigits } from "./shared";

interface FormState {
  name: string;
  expected: string;
  side: string;
  phone: string;
  functions: string[];
  answers: Answers;
  meal?: Meal;
  stay: boolean;
  room: string;
  pickup: string;
  needs: string;
}
type Setter = <K extends keyof FormState>(key: K) => (value: FormState[K]) => void;

function formFor(h: Household): FormState {
  return {
    name: h.name,
    expected: String(h.expected),
    side: h.side ?? "",
    phone: h.phone ?? "",
    functions: h.functions,
    answers: h.rsvp,
    meal: h.meal,
    stay: !!h.stay,
    room: h.room ?? "",
    pickup: h.pickup ?? "",
    needs: h.needs ?? "",
  };
}

/** The household after the form: trimmed, blanks cleared, the headcount kept between 1 and 500. */
function patchFor(h: Household, f: FormState): Partial<Household> {
  return {
    name: f.name.trim() || h.name,
    expected: Math.max(1, Math.min(500, Number(f.expected) || h.expected)),
    side: f.side.trim() || undefined,
    phone: phoneDigits(f.phone),
    functions: f.functions,
    meal: f.meal,
    stay: f.stay,
    room: f.stay && f.room ? f.room : undefined,
    pickup: f.pickup.trim() || undefined,
    needs: f.needs.trim() || undefined,
  };
}

/** Only the answers that changed, so history records what the planner actually did. */
function changedAnswers(h: Household, answers: Answers): Answers {
  return Object.fromEntries(
    Object.entries(answers).filter(([fn, a]) => JSON.stringify(h.rsvp[fn]) !== JSON.stringify(a)),
  );
}

interface FormProps {
  ev: PlannrEvent;
  h: Household;
  onClose: () => void;
  sides: string[];
}

/** Everything about one household, with their answers recorded by hand when they tell you in person. */
export function HouseholdForm({ ev, h, onClose, sides }: FormProps) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const [form, setForm] = useState(() => formFor(h));
  const set: Setter = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "households",
      id: h.id,
      patch: patchFor(h, form),
    });
    const answers = changedAnswers(h, form.answers);
    if (Object.keys(answers).length > 0)
      dispatch({ type: "rsvp", eventId: ev.id, householdId: h.id, answers });
    dispatch(toast(`Saved ${form.name.trim() || h.name}.`));
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
        <HouseholdFields ev={ev} h={h} form={form} set={set} sides={sides} />
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

function HouseholdFields({
  ev,
  h,
  form,
  set,
  sides,
}: Omit<FormProps, "onClose"> & { form: FormState; set: Setter }) {
  const fns = functionsOf(ev);
  return (
    <>
      <Field label="Name" htmlFor="hs-name">
        <input
          id="hs-name"
          className="field"
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
        />
      </Field>
      <PeopleAndSide
        id="hs"
        label="People invited"
        count={form.expected}
        onCount={set("expected")}
        side={form.side}
        onSide={set("side")}
        sides={sides}
      />
      <Field label="WhatsApp number" htmlFor="hs-phone">
        <input
          id="hs-phone"
          className="field"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set("phone")(e.target.value)}
        />
      </Field>
      <FunctionPicker fns={fns} value={form.functions} onChange={set("functions")} name="hs-fn" />
      <AnswersField
        fns={fns}
        functions={form.functions}
        answers={form.answers}
        invited={h.expected}
        onChange={set("answers")}
      />
      <MealField value={form.meal} onChange={set("meal")} />
      <StayFields ev={ev} stay={form.stay} room={form.room} onStay={set("stay")} onRoom={set("room")} />
      <Field label="Pickup" htmlFor="hs-pickup" hint="Where and when, e.g. “Cochin airport, Thu 3:15 am”.">
        <input
          id="hs-pickup"
          className="field"
          value={form.pickup}
          onChange={(e) => set("pickup")(e.target.value)}
        />
      </Field>
      <Field label="Needs" htmlFor="hs-needs">
        <input
          id="hs-needs"
          className="field"
          value={form.needs}
          onChange={(e) => set("needs")(e.target.value)}
          placeholder="A wheelchair, a seat near the front"
        />
      </Field>
      {h.note && (
        <p className="m-0 rounded-xl bg-sand p-3 text-sm">
          <span className="eyebrow mr-1 text-muted">Their note</span> {h.note}
        </p>
      )}
    </>
  );
}
