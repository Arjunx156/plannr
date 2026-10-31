import { type FormEvent, useState } from "react";
import { Field, TextField } from "../../../components/fields";
import type { PlannrEvent } from "../../../data/types";
import type { Vendor } from "../../../data/vendorTypes";
import { toast, useStore } from "../../../store/store";
import { CategorySelect } from "../amounts";

/** Changes some fields of one vendor. */
export type PatchVendor = (p: Partial<Vendor>) => void;

const formFor = (v: Vendor) => ({
  name: v.name,
  phone: v.phone ?? "",
  upi: v.upi ?? "",
  contact: v.contact ?? "",
  needs: v.needs ?? "",
  notes: v.notes ?? "",
  categoryId: v.categoryId ?? "",
});
type DetailsForm = ReturnType<typeof formFor>;
type Setter = <K extends keyof DetailsForm>(key: K) => (value: DetailsForm[K]) => void;

/** The vendor after the form: blanks cleared, and a named vendor no longer just "needed". */
function patchFor(v: Vendor, f: DetailsForm): Partial<Vendor> {
  const name = f.name.trim();
  return {
    name,
    phone: f.phone.replace(/[^\d+]/g, "") || undefined,
    upi: f.upi.trim() || undefined,
    contact: f.contact.trim() || undefined,
    needs: f.needs.trim() || undefined,
    notes: f.notes.trim() || undefined,
    categoryId: f.categoryId || undefined,
    ...(v.stage === "needed" && name ? { stage: "enquired" as const } : {}),
  };
}

interface Props {
  ev: PlannrEvent;
  v: Vendor;
  patch: PatchVendor;
  onClose: () => void;
}

/** Name, contact, payment and day-of details, and removing the vendor. */
export function VendorDetails({ ev, v, patch, onClose }: Props) {
  const { dispatch } = useStore();
  const [form, setForm] = useState(() => formFor(v));
  const set: Setter = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const cats = ev.layout === "personal" ? ev.budget.categories : [];
  const save = (e: FormEvent) => {
    e.preventDefault();
    patch(patchFor(v, form));
    dispatch(toast("Saved."));
  };
  const remove = () => {
    if (!window.confirm(`Remove ${v.name || v.category}? Their quotes go with them.`)) return;
    dispatch({ type: "removeRecord", eventId: ev.id, coll: "vendors", id: v.id });
    onClose();
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="font-semibold">Details</h3>
      <ContactFields form={form} set={set} />
      {cats.length > 0 && (
        <CategorySelect id="vd-cat" categories={cats} value={form.categoryId} onChange={set("categoryId")} />
      )}
      <TextField
        id="vd-needs"
        label="What they need on the day"
        value={form.needs}
        onChange={set("needs")}
        placeholder="Two power points, a table near the stage"
      />
      <Field label="Notes" htmlFor="vd-notes">
        <textarea
          id="vd-notes"
          className="field min-h-16 py-2"
          value={form.notes}
          onChange={(e) => set("notes")(e.target.value)}
        />
      </Field>
      <span className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>
          Remove vendor
        </button>
      </span>
    </form>
  );
}

function ContactFields({ form, set }: { form: DetailsForm; set: Setter }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField id="vd-name" label="Name" value={form.name} onChange={set("name")} />
      <TextField id="vd-contact" label="Contact person" value={form.contact} onChange={set("contact")} />
      <TextField
        id="vd-phone"
        label="WhatsApp number"
        value={form.phone}
        onChange={set("phone")}
        inputMode="tel"
      />
      <TextField
        id="vd-upi"
        label="UPI id"
        hint="For paying them from the budget"
        value={form.upi}
        onChange={set("upi")}
        placeholder="name@okhdfc"
      />
    </div>
  );
}
