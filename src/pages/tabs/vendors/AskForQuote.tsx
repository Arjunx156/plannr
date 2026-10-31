import { useState } from "react";
import type { PlannrEvent } from "../../../data/types";
import type { Vendor } from "../../../data/vendorTypes";
import { functionsOf } from "../../../shared/eventLists";
import { DraftBox } from "../DraftBox";
import { enquiry, guestsOf } from "./shared";
import type { PatchVendor } from "./vendorDetails";

/** Drafts the enquiry message, in the vendor's language when they have one. */
export function AskForQuote({ ev, v, patch }: { ev: PlannrEvent; v: Vendor; patch: PatchVendor }) {
  const [drafting, setDrafting] = useState(false);
  const fns = functionsOf(ev);
  const guests = guestsOf(ev);
  return (
    <section aria-label="Ask for a quote" className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <h3 className="font-semibold">Ask for a quote</h3>
        {!drafting && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafting(true)}>
            Draft a message
          </button>
        )}
      </span>
      {drafting && (
        <DraftBox
          task="enquiry"
          phone={v.phone}
          lang={v.lang}
          context={{
            event: ev.name,
            category: v.category,
            vendor: v.name,
            date: ev.date,
            guests,
            functions: fns.map((f) => `${f.label} ${f.date}`),
          }}
          fallback={enquiry(ev, v)}
          saveLabel="Mark enquired"
          onSave={() => {
            if (v.stage === "needed") patch({ stage: "enquired" });
            setDrafting(false);
          }}
        />
      )}
    </section>
  );
}
