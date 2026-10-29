import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { Field } from "../../components/ui";
import type { Kind } from "../../data/types";
import { toCsv } from "../../lib/csv";
import { inr, parseAmount } from "../../lib/format";
import { splitBudget } from "../../lib/plan";
import { CallToAction, SitePage } from "./Layout";

/** A tool's saved state in this browser only; nothing is sent anywhere. */
function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // Starts empty.
    }
  }, [key]);
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // Works for this visit only.
    }
  };
  return [value, set];
}

const TOOLS = [
  {
    to: "/tools/budget-calculator",
    t: "Budget splitter",
    d: "Split a total budget across catering, venue, décor and the rest, with what it means per guest.",
  },
  {
    to: "/tools/kerala-wedding-checklist",
    t: "Kerala wedding checklist",
    d: "What to book and when, from fixing the muhurtham to the morning of the wedding.",
  },
  {
    to: "/tools/shagun-register",
    t: "Gift and shagun register",
    d: "Write down every envelope and gift as it comes in, so nobody is missed in the thank-yous.",
  },
  {
    to: "/tools/festival-checklist",
    t: "Festival committee checklist",
    d: "Permissions, funds, stalls, volunteers and the clean-up, for a society or temple festival.",
  },
];

export function ToolsIndex() {
  return (
    <SitePage
      title="Free event planning tools"
      description="Free tools for planning Indian weddings, birthdays and community festivals: a budget splitter, checklists and a gift register. No sign-up."
      eyebrow="Free tools"
      heading="Free tools, no sign-up"
      lead="Use them as they are. Everything stays in your browser. When you want the whole plan in one place, Plannr is free too."
      wide
    >
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
        {TOOLS.map((x) => (
          <li key={x.to}>
            <Link
              to={x.to}
              className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 text-ink no-underline hover:border-line-2"
            >
              <span className="font-serif text-[24px] leading-tight">{x.t}</span>
              <span className="text-[15px] leading-[1.5] text-body">{x.d}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SitePage>
  );
}

// ---------------------------------------------------------------- budget splitter

const KINDS: { id: Kind; label: string }[] = [
  { id: "wedding", label: "Wedding" },
  { id: "birthday", label: "Birthday" },
  { id: "community", label: "Community event" },
  { id: "other", label: "Something else" },
];

export function BudgetCalculator() {
  const [kind, setKind] = useState<Kind>("wedding");
  const [total, setTotal] = useState("18L");
  const [guests, setGuests] = useState("250");
  const amount = parseAmount(total);
  const people = Math.max(0, Math.round(Number(guests) || 0));
  const lines = amount ? splitBudget(kind, amount) : [];
  const catering = lines.find((l) => /catering|food/i.test(l.name));
  return (
    <SitePage
      title="Event budget splitter"
      description="Split a wedding, birthday or festival budget across categories, and see what it means per guest and per plate. Free, no sign-up."
      eyebrow="Free tool"
      heading="Budget splitter"
      lead="Enter a total and a headcount. The split is a sensible starting point for your kind of event; move it to fit your priorities."
    >
      <form
        onSubmit={(e: FormEvent) => e.preventDefault()}
        className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-3"
      >
        <Field label="Event" htmlFor="bc-kind">
          <select
            id="bc-kind"
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Total budget" htmlFor="bc-total" hint="18L, 18 lakh or 18,00,000">
          <input
            id="bc-total"
            className="field"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </Field>
        <Field label="Guests" htmlFor="bc-guests">
          <input
            id="bc-guests"
            className="field"
            inputMode="numeric"
            value={guests}
            onChange={(e) => setGuests(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </form>
      {amount > 0 ? (
        <section
          aria-label="The split"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="font-serif text-[26px] leading-tight">
            {inr(amount)}
            {people ? ` for ${people} guests: ${inr(amount / people)} a guest` : ""}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {lines.map((l) => (
              <li
                key={l.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-sand-2 py-2.5 first:border-0"
              >
                <span className="font-medium">{l.name}</span>
                <span className="tabular">{inr(l.amount)}</span>
                <span className="col-span-2 block h-2 rounded-[2px] bg-sand-2">
                  <span
                    className="block h-2 rounded-[2px]"
                    style={{ width: `${(l.amount / amount) * 100}%`, background: l.color }}
                  />
                </span>
              </li>
            ))}
          </ul>
          {catering && people > 0 && (
            <p className="m-0 text-sm text-body">
              The catering line allows about <strong>{inr(catering.amount / people)} a plate</strong>. Compare
              that with the per-plate quotes you get, multiplied by the guests you expect at each meal.
            </p>
          )}
        </section>
      ) : (
        <p className="m-0 text-body">Enter a total, like 18L or 2,50,000.</p>
      )}
      <CallToAction
        prompt={`${KINDS.find((k) => k.id === kind)?.label ?? "Event"} for ${people || 100} guests, budget ${total}`}
      />
    </SitePage>
  );
}

// ---------------------------------------------------------------- checklists

interface Stage {
  when: string;
  items: string[];
}

const KERALA: Stage[] = [
  {
    when: "6 to 12 months before",
    items: [
      "Fix the muhurtham, the auspicious date and time, with the family astrologer",
      "Agree the guest count and the budget with both families, and how you'll share costs",
      "Book the venue: an auditorium, a temple hall or home",
      "Taste and book the sadhya caterer",
      "Book the photographer and videographer",
    ],
  },
  {
    when: "3 to 6 months before",
    items: [
      "Book the nadaswaram or chenda melam",
      "Choose the kasavu saree and mundu, and order the bridal saree",
      "Order the thali and the wedding jewellery",
      "Book the makeup artist",
      "Plan the décor: the mandapam, jasmine and marigold, the nilavilakku",
      "Hold rooms for family coming from out of town",
    ],
  },
  {
    when: "1 to 3 months before",
    items: [
      "Print the invitations and send WhatsApp invitations with a reply link",
      "Confirm the menu after the tasting: payasams, number of items",
      "Confirm the priest for the rituals, if your family has one",
      "Gather the ceremony items: nilavilakku, nirapara, thalam with flowers",
      "Book transport for guests and the couple",
    ],
  },
  {
    when: "2 to 4 weeks before",
    items: [
      "Send reminders to families who haven't replied",
      "Give the caterer the final count for each meal",
      "Pay the balances that are due",
      "Confirm arrival times with every vendor",
      "Plan seating for the reception",
      "Prepare envelopes for the priest, the musicians and helpers",
    ],
  },
  {
    when: "The week of the wedding",
    items: [
      "Collect the outfits and the jewellery",
      "Share the run sheet and each helper's jobs",
      "Pack the ceremony items in one place",
      "Confirm pickups and parking",
    ],
  },
  {
    when: "On the day",
    items: [
      "Be ready well before the muhurtham",
      "Ask one person to receive guests and one to keep the gift register",
      "Keep the vendors' numbers with the person running the day",
    ],
  },
];

const FESTIVAL: Stage[] = [
  {
    when: "2 to 3 months before",
    items: [
      "Form the committee and name a treasurer",
      "Fix the date, the venue and the programme",
      "Set the budget and how you'll raise it: contributions, sponsors, stall fees",
      "Open a separate record for every rupee in and out",
    ],
  },
  {
    when: "1 to 2 months before",
    items: [
      "Apply for police permission for loudspeakers and the gathering",
      "Check whether the panchayat or corporation needs to be told",
      "Check fire safety needs for the stage, the kitchen and any lamps",
      "Approach sponsors with tiers and what each gets",
      "Open stall requests at a fixed fee",
      "Book sound, lights, the stage and the tent",
      "Book the caterer or plan the community kitchen",
    ],
  },
  {
    when: "2 to 4 weeks before",
    items: [
      "Open volunteer sign-up for every shift: gate, food, stage, parking, clean-up",
      "Issue passes if entry is limited",
      "Plan waste segregation and the clean-up after",
      "Arrange a first-aid kit and a doctor or nurse on call",
      "Make a parking plan and a list of emergency contacts",
    ],
  },
  {
    when: "The week before",
    items: [
      "Confirm every vendor's arrival time",
      "Share the run sheet with the committee and volunteers",
      "Brief the gate volunteers on passes",
      "Share the fund report with residents",
    ],
  },
  {
    when: "After the festival",
    items: [
      "Settle every expense claim with a bill",
      "Pay the vendors and collect pending stall fees",
      "Publish the final accounts",
      "Write down what to change next year",
    ],
  },
];

function Checklist({ id, stages }: { id: string; stages: Stage[] }) {
  const [done, setDone] = useLocal<string[]>(`plannr:tool:${id}`, []);
  const total = stages.reduce((s, x) => s + x.items.length, 0);
  const toggle = (key: string) =>
    setDone(done.includes(key) ? done.filter((d) => d !== key) : [...done, key]);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-body" aria-live="polite">
          {done.length} of {total} done · saved in this browser
        </span>
        <button type="button" className="btn btn-ghost btn-sm print:hidden" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {stages.map((s) => (
        <section
          key={s.when}
          aria-label={s.when}
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="font-serif text-[24px] leading-tight">{s.when}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {s.items.map((item) => {
              const key = `${s.when}/${item}`;
              const inputId = `ck-${id}-${s.when}-${item}`.replace(/[^\w-]/g, "");
              return (
                <li key={item} className="flex items-start gap-3 border-t border-sand-2 py-2 first:border-0">
                  <input
                    id={inputId}
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={done.includes(key)}
                    onChange={() => toggle(key)}
                  />
                  <label
                    htmlFor={inputId}
                    className={`text-[15px] leading-[1.45] ${done.includes(key) ? "text-muted line-through" : ""}`}
                  >
                    {item}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function KeralaChecklist() {
  return (
    <SitePage
      title="Kerala wedding checklist"
      description="A Kerala Hindu wedding checklist from fixing the muhurtham to the day itself: venue, sadhya, chenda melam, kasavu, thali, invitations and more. Free and printable."
      eyebrow="Free tool"
      heading="Kerala wedding checklist"
      lead="What to book and when, from fixing the muhurtham to the morning of the wedding. Tick things off as you go; it stays in this browser."
    >
      <Checklist id="kerala-wedding" stages={KERALA} />
      <CallToAction
        prompt="Kerala-style wedding with a reception, around 250 guests"
        label="Turn this into a full plan"
      />
    </SitePage>
  );
}

export function FestivalChecklist() {
  return (
    <SitePage
      title="Festival committee checklist"
      description="A checklist for housing society and temple festival committees: permissions, funds and sponsors, stalls, volunteers, safety and the accounts after. Free and printable."
      eyebrow="Free tool"
      heading="Festival committee checklist"
      lead="For Onam, Ganeshotsav, Durga Puja or the annual day: everything a committee usually needs, in the order it needs it."
    >
      <Checklist id="festival" stages={FESTIVAL} />
      <CallToAction
        prompt="Festival for our housing society, 500 residents, stalls and a cultural programme"
        label="Turn this into a full plan"
      />
    </SitePage>
  );
}

// ---------------------------------------------------------------- shagun register

interface Entry {
  id: string;
  from: string;
  amount: number;
  gift: string;
  side: string;
  thanked: boolean;
}

export function ShagunRegister() {
  const [entries, setEntries] = useLocal<Entry[]>("plannr:tool:shagun", []);
  const [form, setForm] = useState({ from: "", amount: "", gift: "", side: "" });
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!form.from.trim()) return;
    setEntries([
      ...entries,
      {
        id: `${Date.now().toString(36)}${entries.length}`,
        from: form.from.trim(),
        amount: parseAmount(form.amount),
        gift: form.gift.trim(),
        side: form.side.trim(),
        thanked: false,
      },
    ]);
    setForm({ from: "", amount: "", gift: "", side: form.side });
  };
  const csv = () => {
    const rows = [
      ["From", "Amount", "Gift", "Side", "Thanked"],
      ...entries.map((e) => [e.from, String(e.amount || ""), e.gift, e.side, e.thanked ? "yes" : "no"]),
    ];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gift-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <SitePage
      title="Gift and shagun register"
      description="A free gift and shagun register for weddings and functions: write down every envelope and gift as it comes in, total it, and tick off the thank-yous. Download as a spreadsheet."
      eyebrow="Free tool"
      heading="Gift and shagun register"
      lead="Write down every envelope and gift as it comes in. It stays in this browser; download it as a spreadsheet when you're done."
    >
      <form
        onSubmit={add}
        className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1.4fr_1fr_1.2fr_1fr_auto] sm:items-end"
      >
        <Field label="From" htmlFor="sg-from">
          <input
            id="sg-from"
            className="field"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
            placeholder="Menon family"
          />
        </Field>
        <Field label="Amount" htmlFor="sg-amount">
          <input
            id="sg-amount"
            className="field"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="1,001"
          />
        </Field>
        <Field label="Gift" htmlFor="sg-gift">
          <input
            id="sg-gift"
            className="field"
            value={form.gift}
            onChange={(e) => setForm({ ...form, gift: e.target.value })}
            placeholder="Silver lamp"
          />
        </Field>
        <Field label="Side" htmlFor="sg-side">
          <input
            id="sg-side"
            className="field"
            value={form.side}
            onChange={(e) => setForm({ ...form, side: e.target.value })}
            placeholder="Bride's side"
          />
        </Field>
        <button type="submit" className="btn btn-primary h-10" disabled={!form.from.trim()}>
          Add
        </button>
      </form>
      <section
        aria-label="Register"
        className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-[26px] leading-tight">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · {inr(total)}
          </h2>
          {entries.length > 0 && (
            <span className="flex gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={csv}>
                Download spreadsheet
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                Print
              </button>
            </span>
          )}
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2 text-sm first:border-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{e.from}</span>
                <span className="text-xs text-muted">{[e.side, e.gift].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="tabular">{e.amount ? inr(e.amount) : ""}</span>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={e.thanked}
                  onChange={() =>
                    setEntries(entries.map((x) => (x.id === e.id ? { ...x, thanked: !x.thanked } : x)))
                  }
                />
                Thanked
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Remove ${e.from}`}
                onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}
              >
                ✕
              </button>
            </li>
          ))}
          {!entries.length && (
            <li className="text-sm text-muted">Nothing yet. Add the first envelope above.</li>
          )}
        </ul>
      </section>
      <CallToAction label="Keep it with the whole plan" />
    </SitePage>
  );
}
