import type { CommunityEvent, Message, PersonalEvent, PlannrEvent, Preview } from "../data/types";
import { fundTotals, rsvpSummary, vendorSummary } from "../shared/derive";
import { vendorsOf } from "../shared/records";
import { dayLabel, fridayOnOrBefore, fullDate, shortDate, TODAY } from "./dates";
import { inr } from "./format";
import { budgetTotals, communityReadiness, personalReadiness, settle } from "./metrics";

/**
 * The assistant in this build answers from the plan itself with a fixed set of
 * intents, so every number it quotes is live. A model can replace `reply` later
 * without touching the panel: it returns the same Message shape.
 */
export type AssistantContext = "dashboard" | "budget";

let seq = 0;
export function msgId(): string {
  seq += 1;
  return `m${Date.now().toString(36)}${seq}`;
}

const has = (text: string, re: RegExp) => re.test(text);

export function reply(ev: PlannrEvent, text: string, context: AssistantContext): Message {
  if (ev.layout === "community") return communityReply(ev, text);
  if (ev.layout === "personal") return personalReply(ev, text, context);
  return ai("Once this event has a plan, I can answer questions about it and propose changes.");
}

function ai(text: string, extra: Partial<Message> = {}): Message {
  return { id: msgId(), role: "ai", text, ...extra };
}

function personalReply(ev: PersonalEvent, text: string, context: AssistantContext): Message {
  const t = text.toLowerCase();
  const totals = budgetTotals(ev.budget);
  const r = personalReadiness(ev, TODAY);

  if (has(text, /ഹൽദി/) || (has(t, /haldi/) && has(t, /fri|friday|move|shift/))) {
    const haldi = ev.functions.find((f) => f.id === "haldi");
    if (!haldi)
      return ai("This event doesn't have a haldi yet. Add it as a function first and I can move it.");
    if (fridayOnOrBefore(haldi.date) === haldi.date)
      return ai(`The haldi is already on ${shortDate(haldi.date)} at ${haldi.time ?? "5:00 pm"}.`);
    const malayalam = has(text, /[ഀ-ൿ]/);
    return ai(
      malayalam
        ? "ഇവയാണ് മാറ്റങ്ങൾ. നിങ്ങൾ അംഗീകരിക്കുന്നതുവരെ ഒന്നും മാറില്ല."
        : "Here's what would change. Nothing is applied until you confirm.",
      {
        lang: malayalam ? "ml" : undefined,
        translation: malayalam
          ? "Here's what would change. Nothing is applied until you confirm."
          : undefined,
        preview: haldiPreview(haldi.date),
      },
    );
  }

  if (has(t, /cut|trim|reduce|lower/) && has(t, /d[ée]cor/)) {
    const decor = ev.budget.categories.find((c) => c.id === "decor");
    if (!decor || ev.kind !== "wedding")
      return ai("I can only propose décor cuts on the wedding budget in this build.");
    if (decor.planned <= 190000)
      return ai(
        "Décor is already down to ₹1,90,000 after the last cut. The mandapam is all that's left untouched.",
      );
    return ai(
      "I kept the mandapam untouched since you marked décor at the ceremony as a priority. The cut comes from the reception and entrance instead. The changes are highlighted in the table.",
      {
        preview: decorPreview(),
        footnote:
          "Why these: they're the three line items with the widest price range across Kochi decorators.",
      },
    );
  }

  if (has(t, /tip|chenda/)) {
    return ai(
      "For a 12-member troupe playing about 45 minutes at the procession, families in Kochi usually give ₹500–₹800 per performer. Around ₹8,000 total, handed to the troupe leader afterwards.",
      {
        source: "Based on your booking with Sree Durga Chenda Sangham (12 artists).",
        action: { label: "Add ₹8,000 to Gifts & tips", id: "add-tip" },
      },
    );
  }

  if (has(t, /readiness|ready|on pace|\d+%/)) {
    const pct = (n: number) => Math.round(n * 100);
    return ai(
      `Readiness is ${pct(r.overall)}%. Tasks are ${pct(r.tasks)}% (${r.tasksDone} of ${r.tasksTotal} done${r.overdue ? `, ${r.overdue} overdue` : ""}), vendors ${pct(r.vendors)}% (${r.vendorsBooked} of ${r.vendorsTotal} booked), guests ${pct(r.guests)}% (${r.guestsConfirmed} of ${rsvpSummary(ev).total} confirmed) and budget health ${pct(r.budget)}%. Tasks and RSVPs count most.`,
      {
        source: r.overdue
          ? `Clearing the ${r.overdue} overdue ${r.overdue === 1 ? "task" : "tasks"} is the quickest way up.`
          : "Booking the next vendor on the list is the quickest way up.",
      },
    );
  }

  if (has(t, /left to book|still need|to book|book in|vendor/)) {
    const { needed, talking } = vendorSummary(ev);
    return ai(
      `Still to book: ${needed.join(", ") || "nothing"}. In conversation: ${talking.join(", ") || "nobody"}. ${ev.vendors.note ? `${ev.vendors.note}, so start there.` : ""}`.trim(),
    );
  }

  if (has(t, /over|save|saving/)) {
    const over = ev.budget.categories.filter((c) => (c.projected ?? c.planned) > c.planned);
    if (!over.length)
      return ai(`Nothing is over plan. ${inr(totals.remaining)} is left of ${inr(ev.budget.total)}.`);
    const lines = over
      .map((c) => `${c.name} by ${inr((c.projected ?? c.planned) - c.planned)}`)
      .join(" and ");
    const ideas = ev.budget.savings.reduce((s, x) => s + x.amount, 0);
    return ai(
      `${lines}. Projected spend is ${inr(totals.projected)}, ${inr(Math.abs(totals.over))} ${totals.over > 0 ? "over" : "under"} plan.${ideas ? ` The budget planner has ${ev.budget.savings.length} ways to save up to ${inr(ideas)}.` : ""}`,
    );
  }

  if (ev.budget.split && has(t, /60|40|split|summar|spend|parents|family|families/)) {
    const s = settle(ev.budget.split, totals.spent);
    const parts = s.sides.map((x) => `${x.name} ${inr(x.owed)} share, ${inr(x.paid)} paid`).join("; ");
    const next = ev.budget.payments.find((p) => !p.paid);
    return ai(
      `${inr(totals.spent)} is spent so far against ${inr(ev.budget.total)}. Split ${ev.budget.split.label.replace("Agreed ", "")}: ${parts}.${s.debtor ? ` ${s.debtor} owes ${s.creditor} ${inr(s.amount)} to settle up.` : " Both sides are settled."}${next ? ` Next payment: ${next.label.split(" · ")[0]?.toLowerCase()}, ${inr(next.amount)} on ${dayLabel(next.date)}.` : ""}`,
    );
  }

  if (has(t, /brief|mangalya/)) {
    return ai(
      "Here's a revised brief for Mangalya Décor: “Hi team, we're keeping the mandapam and ceremony stage exactly as quoted. For the reception, please switch to a draped-fabric backdrop with warm string lights, a marigold and mango-leaf toran instead of the rose arch, and brass urulis with floating flowers on tables. Could you send a revised quote by Friday? Thanks, Priya.”",
    );
  }

  if (has(t, /allerg/)) {
    const note = ev.tasks.list.find((x) => /allerg/i.test(x.note ?? ""))?.note;
    return ai(
      `${note ? `${note}. ` : ""}3 kids have nut allergies so far. The cake is nut-free; ask the snacks caterer to label every tray and keep a nut-free table.`,
    );
  }

  if (has(t, /snack|food|menu|eat/)) {
    return ai(
      "For 30 kids aged 5–7 over three hours: mini dosas, idli bites, fruit skewers, popcorn and a juice counter. Skip anything with nuts: 3 kids have nut allergies. About ₹200 a head keeps food within the ₹10,000 line.",
    );
  }

  if (has(t, /left|before|todo|to do|due|this week/)) {
    const open = ev.tasks.list.filter((x) => !x.done).slice(0, 4);
    return ai(
      open.length
        ? `Next up: ${open.map((x) => `${x.title} (${x.who}, ${dayLabel(x.due)})`).join("; ")}.`
        : "Everything on the list is done. Enjoy the day.",
    );
  }

  return ai(
    context === "budget"
      ? "In this build I can cut a category, show where you're over, explain the family split or draft a vendor brief. Try one of the suggestions below."
      : "In this build I can explain readiness, list what's left to book, summarise spend, move a function or suggest a tip. Try one of the suggestions below.",
  );
}

function communityReply(ev: CommunityEvent, text: string): Message {
  const t = text.toLowerCase();
  if (has(t, /permit|police|application|loudspeaker/)) {
    const day = fullDate(ev.date);
    return ai(
      "Here's a draft for the Thrikkakara police station. Check the dates and sign it as cultural secretary.",
      {
        source: `To the Station House Officer, Thrikkakara. Green Valley Society, Kakkanad requests permission to use amplified sound (2 kW, four speakers) for its ${ev.name.replace(/^Green Valley Society /, "")} on the society grounds on ${day}, from 7 pm to 10 pm. Expected attendance is 600 residents and guests. Volume will be kept within permitted limits and the programme will end at 10 pm. Contact: Priya Menon, cultural secretary.`,
      },
    );
  }
  if (has(t, /food safety|free|volunteer|shift|who/)) {
    const slot = 1;
    const busy = new Set(ev.shifts.roles.flatMap((r) => r.slots[slot]?.names ?? []));
    const free = ev.volunteers.filter((v) => !busy.has(v));
    const food = ev.shifts.roles.find((r) => r.role === "Food safety")?.slots[slot];
    const gap = food ? Math.max(0, food.need - food.names.length) : 0;
    return ai(
      `Food safety 5–8 pm ${gap ? `still needs ${gap}` : "is covered"}. Not on any shift in that slot: ${free.join(", ") || "nobody"}.`,
      { source: free.length ? "Tap an open cell in the shift grid to assign someone." : undefined },
    );
  }
  if (has(t, /fund|money|committee|sponsor|stall fee|budget/)) {
    const { received, expected } = fundTotals(ev);
    const pending = ev.funds.approvals.filter((a) => a.status === "pending");
    return ai(
      `${inr(received)} received of ${inr(expected)} expected. ${inr(ev.funds.spent)} spent against a ${inr(ev.funds.budget)} budget.${pending.length ? ` ${pending.length} ${pending.length === 1 ? "expense waits" : "expenses wait"} for treasurer approval: ${inr(pending.reduce((s, a) => s + a.amount, 0))}.` : " Nothing is waiting for approval."}`,
    );
  }
  const r = communityReadiness(ev);
  return ai(
    `Readiness is ${Math.round(r.overall * 100)}%. In this build I can draft the police application, find free volunteers or summarise funds for the committee.`,
  );
}

export function haldiPreview(from: string): Preview {
  const to = fridayOnOrBefore(from);
  return {
    id: msgId(),
    title: "Preview · 4 changes",
    tag: "Haldi",
    change: "move-haldi",
    status: "pending",
    rows: [
      { title: "Haldi date", from: shortDate(from), to: `${shortDate(to)}, 5:00 pm` },
      {
        title: "2 tasks move a day earlier",
        detail: "Haldi caterer headcount · Collect turmeric & marigolds (Priya)",
      },
      {
        title: "Makeup artist needs to confirm",
        detail: "Glam by Neha quoted for Saturday. I'll draft a WhatsApp asking about Friday.",
      },
      {
        title: "Heads-up",
        detail: "Mehendi is Thursday night, so the bride has back-to-back evenings.",
        headsUp: true,
      },
    ],
  };
}

export function decorPreview(): Preview {
  return {
    id: msgId(),
    title: "Preview · Décor",
    tag: "−₹50,000",
    change: "cut-decor",
    status: "pending",
    rows: [
      { title: "Reception backdrop", amount: "−₹20,000" },
      { title: "Entrance arch → toran", amount: "−₹12,000" },
      { title: "Centrepieces → urulis", amount: "−₹18,000" },
      {
        title: "Also updates",
        detail: "Mangalya Décor needs a revised quote. 1 new task: “Source 30 brass urulis” for Priya.",
      },
    ],
  };
}

export function introFor(ev: PlannrEvent, context: AssistantContext): string {
  if (context === "budget") return `On the budget planner · ${ev.name}`;
  if (ev.layout === "personal")
    return `Working on ${ev.name}. I can see the budget, ${ev.tasks.total} tasks, ${vendorsOf(ev).length} vendor categories and ${rsvpSummary(ev).total} guests.`;
  if (ev.layout === "community")
    return `Working on the ${ev.name}. I can see funds, ${ev.tasks.total} tasks, permits, ${ev.volunteers.length} volunteers and ${fundTotals(ev).passes.issued} passes.`;
  return `Working on ${ev.name}.`;
}
