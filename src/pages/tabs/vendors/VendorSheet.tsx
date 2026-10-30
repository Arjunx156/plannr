import { type FormEvent, useState } from "react";
import { Field, Modal, Pill, TextField } from "../../../components/ui";
import type { PlannrEvent, Quote, Vendor } from "../../../data/types";
import { STAGE_LABEL } from "../../../shared/derive";
import { useStore } from "../../../store/store";
import { CategorySelect, newId } from "../common";
import { STAGE_TONE, STAGES } from "./shared";
import { AskForQuote, OnTheDay, type PatchVendor, Quotes, VendorDetails } from "./VendorSections";

/** Adds a vendor or a category still to find. */
export function AddVendor({ ev, onAdd }: { ev: PlannrEvent; onAdd: (v: Vendor) => void }) {
  const cats = ev.layout === "personal" ? ev.budget.categories : [];
  const [form, setForm] = useState({ category: "", name: "", phone: "", categoryId: "" });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const category = form.category.trim() || cats.find((c) => c.id === form.categoryId)?.name || "";
    if (!category) return;
    onAdd({
      id: newId("v"),
      category,
      name: form.name.trim(),
      stage: form.name.trim() ? "enquired" : "needed",
      quotes: [],
      ...(form.phone.trim() ? { phone: form.phone.replace(/[^\d+]/g, "") } : {}),
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        id="v-cat"
        label="What for"
        value={form.category}
        onChange={(category) => setForm({ ...form, category })}
        placeholder="Mehendi artist"
      />
      <Field label="Name" htmlFor="v-name" hint="Leave empty while you're still looking.">
        <input
          id="v-name"
          className="field"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <TextField
        id="v-phone"
        label="WhatsApp number"
        value={form.phone}
        onChange={(phone) => setForm({ ...form, phone })}
        inputMode="tel"
        placeholder="+91 98470 12345"
      />
      {cats.length > 0 && (
        <CategorySelect
          id="v-budget"
          categories={cats}
          value={form.categoryId}
          onChange={(categoryId) => setForm({ ...form, categoryId })}
        />
      )}
      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={!form.category.trim() && !form.categoryId}
      >
        Add
      </button>
    </form>
  );
}

export function VendorSheet({
  ev,
  vendor,
  editable,
  onClose,
  onBook,
}: {
  ev: PlannrEvent;
  vendor: Vendor | undefined;
  editable: boolean;
  onClose: () => void;
  onBook: (v: Vendor, q?: Quote) => void;
}) {
  return (
    <Modal
      open={!!vendor}
      onClose={onClose}
      side="right"
      width={560}
      title={vendor ? vendor.name || vendor.category : "Vendor"}
    >
      {vendor && (
        <VendorDetail
          key={vendor.id}
          ev={ev}
          v={vendor}
          editable={editable}
          onClose={onClose}
          onBook={onBook}
        />
      )}
    </Modal>
  );
}

/** One vendor: where they are in the pipeline, their quotes, the enquiry, the day itself and their details. */
function VendorDetail({
  ev,
  v,
  editable,
  onClose,
  onBook,
}: {
  ev: PlannrEvent;
  v: Vendor;
  editable: boolean;
  onClose: () => void;
  onBook: (v: Vendor, q?: Quote) => void;
}) {
  const { dispatch } = useStore();
  const patch: PatchVendor = (p) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "vendors", id: v.id, patch: p });

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={STAGE_TONE[v.stage]}>{STAGE_LABEL[v.stage]}</Pill>
        <span className="text-muted">{v.category}</span>
        {v.phone && (
          <a href={`tel:${v.phone}`} className="link ml-auto">
            Call
          </a>
        )}
      </div>

      {editable && v.stage !== "booked" && (
        <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
          <legend className="label mb-1.5">Stage</legend>
          {STAGES.filter((s) => s !== "booked").map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={v.stage === s}
              className="chip chip-sm"
              onClick={() => patch({ stage: s })}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onBook(v, v.quotes.find((q) => q.id === v.chosenQuote) ?? v.quotes[0])}
          >
            Book…
          </button>
        </fieldset>
      )}

      <Quotes ev={ev} v={v} editable={editable} patch={patch} onBook={onBook} />
      {editable && <AskForQuote ev={ev} v={v} patch={patch} />}
      {v.stage === "booked" && <OnTheDay ev={ev} v={v} editable={editable} patch={patch} />}
      {editable ? (
        <VendorDetails ev={ev} v={v} patch={patch} onClose={onClose} />
      ) : (
        (v.needs || v.notes) && (
          <p className="m-0 text-body">{[v.needs, v.notes].filter(Boolean).join(" · ")}</p>
        )
      )}
    </div>
  );
}
