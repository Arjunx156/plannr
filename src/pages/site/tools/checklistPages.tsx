import { CallToAction, SitePage } from "../siteLayout";
import { useLocal } from "./useLocal";

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

/** /tools/kerala-wedding-checklist — the months before a Kerala wedding, step by step. */
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

/** /tools/festival-checklist — what a community festival needs, from permits to clean-up. */
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
