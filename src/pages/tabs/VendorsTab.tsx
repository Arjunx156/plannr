import { useMemo, useState } from "react";
import { RippleDialog } from "../../components/ripple";
import { useEditable } from "../../components/tasks";
import { Modal } from "../../components/ui";
import type { PlannrEvent, Quote, Vendor } from "../../data/types";
import { dayMonth, TODAY } from "../../lib/dates";
import { inr } from "../../lib/format";
import { quoteTotal, STAGE_LABEL } from "../../shared/derive";
import { type ChecklistItem, checklistProgress, vendorChecklist } from "../../shared/planning";
import { list } from "../../shared/records";
import { bookingRipple, type Ripple } from "../../shared/ripple";
import { useStore } from "../../store/store";
import { newId, Section, Stat, TabPage } from "./common";
import { Compare } from "./vendors/Compare";
import { guestsOf, STAGES } from "./vendors/shared";
import { AddVendor, VendorSheet } from "./vendors/VendorSheet";

/** The chosen quote, else the cheapest for this guest count. */
function bestQuote(ev: PlannrEvent, v: Vendor): { q: Quote; total: number } | undefined {
  const guests = guestsOf(ev);
  const chosen = v.quotes.find((q) => q.id === v.chosenQuote);
  const pick =
    chosen ??
    [...v.quotes].sort(
      (a, b) => quoteTotal(a.amount, a.perGuest, guests) - quoteTotal(b.amount, b.perGuest, guests),
    )[0];
  return pick ? { q: pick, total: quoteTotal(pick.amount, pick.perGuest, guests) } : undefined;
}

/** /events/:id/vendors — who's booked, who's quoted, and the comparison that picks between them. */
export function VendorsTab({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const vendors = list(ev, "vendors");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const booked = vendors.filter((v) => v.stage === "booked");
  const categories = [...new Set(vendors.map((v) => v.category))];
  // Worth comparing: a category with more than one quote, from one shortlist or several vendors.
  const comparable = categories.filter(
    (c) => vendors.filter((v) => v.category === c).reduce((n, v) => n + v.quotes.length, 0) > 1,
  );
  const current = vendors.find((v) => v.id === open);
  const committed = booked.reduce((s, v) => s + (bestQuote(ev, v)?.total ?? 0), 0);

  return (
    <TabPage
      eyebrow={ev.name}
      title="Vendors"
      wide
      aside={
        editable && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add a vendor
          </button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAGES.map((s) => (
          <Stat
            key={s}
            label={STAGE_LABEL[s]}
            value={vendors.filter((v) => v.stage === s).length}
            sub={
              s === "booked" && committed
                ? `${inr(committed)} committed`
                : vendors
                    .filter((v) => v.stage === s)
                    .map((v) => v.category)
                    .slice(0, 3)
                    .join(", ") || "—"
            }
            tone={s === "booked" ? "text-leaf-ink" : undefined}
          />
        ))}
      </div>

      <Checklist
        ev={ev}
        editable={editable}
        onOpen={setOpen}
        onAdd={(category) => {
          const v: Vendor = { id: newId("v"), category, name: "", stage: "needed", quotes: [] };
          dispatch({ type: "addRecord", eventId: ev.id, coll: "vendors", record: v });
          setOpen(v.id);
        }}
      />

      {comparable.map((c) => (
        <Compare
          key={c}
          ev={ev}
          category={c}
          editable={editable}
          onBook={(v, q) => setRipple(bookingRipple(ev, v.id, q.id))}
          onOpen={setOpen}
        />
      ))}

      <div className="grid gap-4 lg:grid-cols-4">
        {STAGES.map((stage) => {
          const items = vendors.filter((v) => v.stage === stage);
          return (
            <section
              key={stage}
              aria-label={STAGE_LABEL[stage]}
              className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5"
            >
              <h2 className="eyebrow text-muted">
                {STAGE_LABEL[stage]} · {items.length}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {items.map((v) => {
                  const b = bestQuote(ev, v);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(v.id)}
                        className="flex w-full flex-col gap-0.5 rounded-xl bg-sand p-3 text-left text-sm hover:bg-sand-2"
                      >
                        <span className="font-semibold">{v.category}</span>
                        <span className="text-body">{v.name || "Still looking"}</span>
                        {b && (
                          <span className="text-xs tabular text-muted">
                            {inr(b.total)}
                            {b.q.perGuest ? ` · ${inr(b.q.amount)} a plate` : ""}
                            {v.quotes.length > 1 ? ` · ${v.quotes.length} quotes` : ""}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {!items.length && <li className="text-xs text-muted">None</li>}
              </ul>
            </section>
          );
        })}
      </div>

      <VendorSheet
        ev={ev}
        vendor={current}
        editable={editable}
        onClose={() => setOpen(null)}
        onBook={(v, q) => setRipple(bookingRipple(ev, v.id, q?.id))}
      />
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a vendor">
        <AddVendor
          ev={ev}
          onAdd={(v) => {
            dispatch({ type: "addRecord", eventId: ev.id, coll: "vendors", record: v });
            setAdding(false);
            setOpen(v.id);
          }}
        />
      </Modal>
      <RippleDialog ripple={ripple} onClose={() => setRipple(null)} />
    </TabPage>
  );
}

const CHECK_MARK: Record<ChecklistItem["state"], { mark: string; label: string; tone: string }> = {
  booked: { mark: "✓", label: "Booked", tone: "bg-leaf text-white" },
  talking: { mark: "◐", label: "In talks", tone: "bg-cream text-amber-ink border border-amber-line" },
  missing: { mark: "", label: "Not booked", tone: "border border-line-2" },
};

/** Every vendor this kind of event needs, ticked off as they're booked, with the date to book each by. */
function Checklist({
  ev,
  editable,
  onOpen,
  onAdd,
}: {
  ev: PlannrEvent;
  editable: boolean;
  onOpen: (id: string) => void;
  onAdd: (category: string) => void;
}) {
  const items = useMemo(() => vendorChecklist(ev, TODAY), [ev]);
  const p = checklistProgress(items);
  return (
    <Section
      title="Vendor checklist"
      aside={
        <span className="text-sm text-body">
          {p.booked} of {p.total} booked
          {p.late ? <span className="text-rust-ink"> · {p.late} past their book-by date</span> : null}
        </span>
      }
    >
      <ul className="m-0 grid list-none gap-x-6 p-0 md:grid-cols-2">
        {items.map((i) => {
          const m = CHECK_MARK[i.state];
          return (
            <li key={i.category} className="flex items-start gap-3 border-t border-sand-2 py-2.5">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] text-xs font-bold ${m.tone}`}
              >
                {m.mark}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {i.category}
                  <span className="sr-only">: {m.label}</span>
                  {i.vendorName && <span className="font-normal text-body"> · {i.vendorName}</span>}
                </span>
                <span className={`text-xs ${i.late ? "text-rust-ink" : "text-muted"}`}>
                  {i.state === "booked"
                    ? "Booked"
                    : `${i.late ? "Late: book now" : `Book by ${dayMonth(i.bookBy)}`}${i.why ? ` · ${i.why}` : ""}`}
                </span>
              </span>
              {i.vendorId ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onOpen(i.vendorId ?? "")}
                >
                  Open<span className="sr-only"> {i.category}</span>
                </button>
              ) : (
                editable && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAdd(i.category)}>
                    Start<span className="sr-only"> looking for {i.category}</span>
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
