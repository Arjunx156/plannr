import type { CommunityEvent } from "../data/types";
import { daysBetween, longDate, shortDate } from "../lib/dates";
import { inr, plural } from "../lib/format";
import { fundTotals } from "./balances";
import { list } from "./records";
import { eventPath, ids, type Rule, type Watch, whenText } from "./watchRule";

// ---------------------------------------------------------------- community events
/** Permits show three weeks before they're due, and turn urgent in the last week. */
const PERMIT_DAYS = { notice: 21, urgent: 7 };
/** Open volunteer places show a month out, and turn urgent ten days out. */
const SHIFT_DAYS = { notice: 30, urgent: 10 };
const pendingApprovals: Rule<CommunityEvent> = (ev) => {
  const pending = ev.funds.approvals.filter((a) => a.status === "pending");
  if (pending.length === 0) return [];
  const sum = pending.reduce((s, a) => s + a.amount, 0);
  return [
    {
      id: `approvals:${ids(pending)}`,
      tone: "warn",
      label: "Waiting for the treasurer",
      text: `${plural(pending.length, "expense claim")} to decide, ${inr(sum)} in all.`,
      primary: { label: "Review claims", kind: "go", to: eventPath(ev, "funds") },
      rank: 8,
    },
  ];
};
const permitsDue: Rule<CommunityEvent> = (ev, today) =>
  list(ev, "permits").flatMap((p): Watch[] => {
    if (p.tone === "ok" || !p.due) return [];
    const d = daysBetween(today, p.due);
    if (d > PERMIT_DAYS.notice) return [];
    const urgent = d < PERMIT_DAYS.urgent;
    const when = d < 0 ? `was due ${shortDate(p.due)}` : `apply by ${longDate(p.due)}`;
    return [
      {
        id: `permit:${p.id}:${p.tone}`,
        tone: urgent ? "warn" : "info",
        label: d < 0 ? "Permit overdue" : "Permit",
        text: `${p.label}: ${p.status.toLowerCase()}, ${when}.`,
        primary: {
          label: p.letter ? "Open the letter" : "Draft the letter",
          kind: "go",
          to: eventPath(ev, "funds"),
        },
        rank: urgent ? 6 : 22,
      },
    ];
  });
const openShifts: Rule<CommunityEvent> = (ev, today) => {
  const gaps = ev.shifts.roles
    .flatMap((r) => r.slots)
    .reduce((sum, slot) => sum + Math.max(0, slot.need - slot.names.length), 0);
  const days = daysBetween(today, ev.date);
  if (!gaps || days > SHIFT_DAYS.notice) return [];
  return [
    {
      id: `shifts:${gaps}`,
      tone: days <= SHIFT_DAYS.urgent ? "warn" : "info",
      label: "Volunteers",
      text: `${plural(gaps, "shift place")} still open, and the event is ${whenText(today, ev.date)}.`,
      primary: { label: "Share the sign-up sheet", kind: "go", to: eventPath(ev, "volunteers") },
      rank: 18,
    },
  ];
};
const stallRequests: Rule<CommunityEvent> = (ev) => {
  const { requested } = fundTotals(ev).stalls;
  if (!requested) return [];
  return [
    {
      id: `stalls:${requested}`,
      tone: "info",
      label: "Stall requests",
      text: `${plural(requested, "stall request")} waiting for a yes or no.`,
      primary: { label: "Decide", kind: "go", to: eventPath(ev, "stalls") },
      rank: 24,
    },
  ];
};
const cashShort: Rule<CommunityEvent> = (ev) => {
  const { spent, received } = fundTotals(ev);
  if (spent <= received) return [];
  return [
    {
      id: `cash:${spent}:${received}`,
      tone: "warn",
      label: "Cash",
      text: `${inr(spent - received)} more has been spent than collected so far.`,
      primary: { label: "See the funds", kind: "go", to: eventPath(ev, "funds") },
      rank: 9,
    },
  ];
};
export const COMMUNITY_RULES: Rule<CommunityEvent>[] = [
  pendingApprovals,
  permitsDue,
  openShifts,
  stallRequests,
  cashShort,
];
