import { Link } from "react-router";
import { CallToAction, Prose, SitePage } from "./siteLayout";

function Features({ items }: { items: { t: string; d: string }[] }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {items.map((f) => (
        <li key={f.t} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5">
          <span className="font-serif text-[22px] leading-tight">{f.t}</span>
          <span className="text-[15px] leading-[1.5] text-body">{f.d}</span>
        </li>
      ))}
    </ul>
  );
}

export function Weddings() {
  return (
    <SitePage
      title="Plan an Indian wedding"
      description="Plan a multi-function Indian wedding with both families: one budget split between sides, RSVPs per function, vendors compared side by side, and a run sheet for the day."
      eyebrow="Weddings"
      heading="A wedding both families can plan together"
      lead="Mehendi, haldi, the muhurtham and the reception, each with its own guests, budget and timings, in one plan both families can see."
      wide
    >
      <Features
        items={[
          {
            t: "One budget, two families",
            d: "Agree the split once, say 60/40. Every advance is marked with who paid it, and Plannr shows who owes whom and the fewest transfers to settle up.",
          },
          {
            t: "RSVPs by household and function",
            d: "Each family gets its own link on WhatsApp, in their language. They answer for each function they're invited to, with meal and stay needs, no app or login.",
          },
          {
            t: "Caterers side by side",
            d: "Per-plate quotes are multiplied out for your headcount, with what's included and the payment terms. Booking one sets the budget line and the advance and balance dates.",
          },
          {
            t: "A headcount that moves the plan",
            d: "When the guest list grows, Plannr previews what it changes: catering, favours, seating and each family's share. Nothing changes until you approve.",
          },
          {
            t: "Seating, rooms and pickups",
            d: "Drag households onto tables, hold room blocks for out-of-town family, and keep the airport pickups in one list.",
          },
          {
            t: "The day itself",
            d: "A run sheet per function that shifts when you're running late, helper pages for cousins with jobs, entry codes at the gate and a shared photo album.",
          },
        ]}
      />
      <Prose>
        <h2>Made for how Indian weddings really work</h2>
        <p>
          Plannr starts from your description, in English or Malayalam, Hindi or Tamil, and suggests the
          vendor categories your traditions need: a sadhya caterer and chenda melam for a Kerala wedding, a
          mehendi artist and a baraat for a North Indian one. Every suggestion says why, so you can tell an
          estimate from a fact.
        </p>
        <p>
          Start with the free{" "}
          <Link to="/tools/kerala-wedding-checklist" className="link">
            Kerala wedding checklist
          </Link>{" "}
          or the{" "}
          <Link to="/tools/budget-calculator" className="link">
            budget splitter
          </Link>
          .
        </p>
      </Prose>
      <CallToAction prompt="Kerala-style wedding in Kochi with a reception, around 250 guests, ₹18 lakh" />
    </SitePage>
  );
}

export function Birthdays() {
  return (
    <SitePage
      title="Plan a birthday party"
      description="Plan a children's birthday party in days, not weeks: a theme, a run sheet for the afternoon, RSVPs with allergy notes and return gifts sorted."
      eyebrow="Birthdays"
      heading="A birthday party in days, not weeks"
      lead="A theme the kids will remember, a run sheet for the afternoon, and every allergy written down before the cake is ordered."
      wide
    >
      <Features
        items={[
          {
            t: "RSVPs with allergy notes",
            d: "Parents answer from a link and add dietary needs. The headcount and the list of allergies are ready when you order food.",
          },
          {
            t: "A run sheet for the afternoon",
            d: "Games, cake and return gifts by the minute, with who's in charge of each. Running late? Shift the rest of the afternoon in one tap.",
          },
          {
            t: "Vendors in one place",
            d: "The cake, the entertainer, the decorator: quotes, payment dates and a UPI link for each, so nothing is paid twice or forgotten.",
          },
          {
            t: "Helpers who know their jobs",
            d: "Send an aunt her list for the day. She ticks things off from her phone and you see it.",
          },
        ]}
      />
      <CallToAction prompt="Space-themed 6th birthday party at home, 30 kids, ₹40,000, in three weeks" />
    </SitePage>
  );
}

export function Community() {
  return (
    <SitePage
      title="Plan a community festival"
      description="Run a housing society or temple festival: pooled funds and sponsors, expense approvals by the treasurer, permits, stall requests, volunteer shifts and gate passes."
      eyebrow="Community events"
      heading="Run the society festival without the WhatsApp chaos"
      lead="Onam, Ganeshotsav or the annual day: funds, permits, stalls, volunteers and passes in one plan the whole committee can see."
      wide
    >
      <Features
        items={[
          {
            t: "Funds residents can trust",
            d: "Collections, sponsors and stall fees in one place. A public fund report shows residents what came in and what was spent, live.",
          },
          {
            t: "Expenses the treasurer approves",
            d: "Committee members claim what they spent; once a treasurer is named, only the treasurer or the owner can approve. Every decision is in the history.",
          },
          {
            t: "Volunteers pick their own shifts",
            d: "Share one sign-up sheet. Neighbours choose an open slot; the grid fills itself and shows the gaps.",
          },
          {
            t: "Stalls and passes",
            d: "Residents request a stall from a link at the committee's fee. Gate volunteers check passes in from their phones and everyone sees the count.",
          },
          {
            t: "Permits with the letters written",
            d: "Police, fire and local-body permissions with their due dates, and the application letters drafted in the right format.",
          },
          {
            t: "Next year starts from this year",
            d: "Save the festival as a template: tasks, vendors with what they charged, roles and the real costs, with every date moved to next year.",
          },
        ]}
      />
      <Prose>
        <p>
          Use the free{" "}
          <Link to="/tools/festival-checklist" className="link">
            festival committee checklist
          </Link>{" "}
          to see everything a committee usually needs.
        </p>
      </Prose>
      <CallToAction prompt="Onam celebration for our housing society in Kakkanad, 600 residents, stalls and a cultural programme" />
    </SitePage>
  );
}

export function HowItWorks() {
  const steps = [
    {
      t: "Describe the day",
      d: "One sentence, typed or spoken, in English, Malayalam, Hindi or Tamil: who it's for, roughly when, how many people and the budget. Plannr asks only what it still needs.",
    },
    {
      t: "Get a plan you can change",
      d: "A budget split for your kind of event, tasks worked back from the date, the vendors your traditions need and a guest list structure. Every suggestion says why.",
    },
    {
      t: "Plan it together",
      d: "Invite family or the committee as planners or viewers. Everyone sees the same plan; every change shows who made it, and any change can be undone.",
    },
    {
      t: "Changes are previewed first",
      d: "Ask the assistant to move a function or plan for more guests, or accept something Plannr noticed. You see everything it would change, and nothing moves until you approve.",
    },
    {
      t: "Share pages, not spreadsheets",
      d: "Households answer the RSVP from their own link. Vendors get a call sheet, helpers their jobs, volunteers a sign-up sheet. Each link shows only what that person needs.",
    },
    {
      t: "Run the day from your phone",
      d: "The run sheet, check-in at the gate, the day's checklist and the shared album, all working without a signal.",
    },
  ];
  return (
    <SitePage
      title="How it works"
      description="Describe your event in one sentence and Plannr drafts a budget, timeline, vendor checklist and personalised ideas you can plan together and run on the day."
      eyebrow="How it works"
      heading="From one sentence to the day itself"
      wide
    >
      <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.t} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
            <span className="font-mono text-sm text-amber-ink">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-serif text-[22px] leading-tight">{s.t}</span>
            <span className="text-[15px] leading-[1.5] text-body">{s.d}</span>
          </li>
        ))}
      </ol>
      <CallToAction />
    </SitePage>
  );
}

export function Pricing() {
  return (
    <SitePage
      title="Pricing"
      description="Plannr is free during early access, with every feature included. Paid plans will never be charged without asking first."
      eyebrow="Pricing"
      heading="Free while Plannr is new"
      lead="Every feature is included during early access, for every event and every guest."
    >
      <Prose>
        <h2>What's included today</h2>
        <ul>
          <li>Plans for weddings, birthdays, community events and anything else</li>
          <li>
            AI planning, drafting messages and letters, and reading bills and quotes, within a fair daily
            limit
          </li>
          <li>RSVP pages, event websites, vendor call sheets, helper pages and volunteer sign-up</li>
          <li>Co-planners with roles, a full history and undo</li>
          <li>Offline use on the day, and a morning reminder of what's due</li>
        </ul>
        <h2>What comes later</h2>
        <p>
          Plannr will stay free for small events. For big weddings we plan a one-time Celebration Pass, and
          for associations and committees a Community plan. Nothing is charged today, nothing will be without
          asking you first, and any event you start during early access stays free to finish.
        </p>
      </Prose>
      <CallToAction label="Start planning, free" />
    </SitePage>
  );
}
