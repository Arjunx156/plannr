import type { Task } from "../data/baseTypes";
import type { LineItem } from "../data/budgetTypes";
import type { ChangeId } from "../data/messageTypes";
import type { CommunityEvent, PersonalEvent } from "../data/types";
import { addDays, dayMonth, daysBetween, fridayOnOrBefore, TODAY } from "../lib/dates";
import {
  addTasks,
  bookCategory,
  completeTask,
  markBooked,
  raiseProjection,
  resolveNotice,
  withCategory,
  withTasks,
} from "./eventEdits";

/**
 * What happens when the planner accepts one of the plan's own suggestions: the notices
 * on the overview ("Book the photographer this week") and the assistant's previews
 * ("Move the haldi to Friday"). Each is pure and safe to apply twice.
 */

/** Days until an advance falls due when nobody says otherwise. */
export const ADVANCE_DUE_DAYS = 14;

const HALDI_TIME = "5:00 pm";

/** The décor plan after the ₹50,000 cut, and what each swapped line becomes. */
export const DECOR_AFTER_CUT = 190000;
const DECOR_SWAPS: Record<string, Pick<LineItem, "name" | "amount">> = {
  backdrop: { name: "Reception backdrop: draped fabric, string lights", amount: 45000 },
  arch: { name: "Entrance toran: marigold and mango leaf", amount: 18000 },
  centrepieces: { name: "Brass uruli centrepieces, reused from haldi", amount: 22000 },
};

const CHENDA_TIP = 8000;

/** What 40 more guests add to the lines that scale with the headcount. */
const GUEST_GROWTH: Record<string, number> = { catering: 36288, invitations: 2700 };

/** The second balloon arch the glow-in-the-dark stars replace. */
const SECOND_ARCH = { id: "arch2", cost: 1800 };

/** Moves the haldi back to the Friday before it, and its tasks by the same number of days. */
function moveHaldi(ev: PersonalEvent): PersonalEvent {
  const haldi = ev.functions.find((f) => f.id === "haldi");
  if (!haldi) return ev;
  const friday = fridayOnOrBefore(haldi.date);
  const shift = daysBetween(haldi.date, friday);
  const moved = withTasks(ev, (list) =>
    list.map((t) => (t.fn === "haldi" ? { ...t, due: addDays(t.due, shift) } : t)),
  );
  return {
    ...moved,
    functions: ev.functions.map((f) => (f.id === "haldi" ? { ...f, date: friday, time: HALDI_TIME } : f)),
  };
}

/** Trims décor to the revised plan by swapping three lines for cheaper ones, keeping the mandapam. */
function cutDecor(ev: PersonalEvent): PersonalEvent {
  const cut = withCategory(ev, "decor", (c) => ({
    ...c,
    planned: DECOR_AFTER_CUT,
    projected: undefined,
    status: "Revised quote needed",
    tone: "due",
    items: c.items.map((i) => {
      const swap = DECOR_SWAPS[i.id];
      return swap ? { ...i, ...swap } : i;
    }),
  }));
  const urulis: Task = {
    id: "w-urulis",
    title: "Source 30 brass urulis",
    who: "You",
    due: addDays(ev.date, -41),
    done: false,
    note: "Décor",
  };
  return addTasks(cut, [urulis]);
}

/** Applies a change the assistant previewed. Changes for other kinds of events leave this one alone. */
export function applySuggestedChange(ev: PersonalEvent, change: ChangeId): PersonalEvent {
  if (change === "move-haldi") return moveHaldi(ev);
  if (change === "cut-decor") return cutDecor(ev);
  return ev;
}

/** Budgets a tip for the chenda melam troupe under gifts, once. */
export function addChendaTip(ev: PersonalEvent): PersonalEvent {
  const tip: LineItem = {
    id: "chenda-tip",
    name: "Tip for the chenda melam troupe",
    vendor: "Sree Durga Chenda Sangham",
    amount: CHENDA_TIP,
    estimate: true,
    status: "unpaid",
    due: ev.date,
  };
  return withCategory(ev, "gifts", (c) =>
    c.items.some((i) => i.id === tip.id)
      ? c
      : { ...c, projected: (c.projected ?? c.planned) + CHENDA_TIP, items: [...c.items, tip] },
  );
}

/** Raises the lines that scale with guests after the RSVPs grew the headcount. */
export function applyGuestGrowth(ev: PersonalEvent): PersonalEvent {
  const grown = Object.entries(GUEST_GROWTH).reduce((e, [id, amount]) => raiseProjection(e, id, amount), ev);
  return resolveNotice(grown, "guests-grew", "Applied: catering, invitations and seating now plan for 268.");
}

/** Books the photographer: the vendor, the photography line, its task and its notice. */
export function bookPhotographer(
  ev: PersonalEvent,
  booking: { studio: string; price: number; advanceDue?: string },
): PersonalEvent {
  const { studio, price } = booking;
  const advanceDue = booking.advanceDue ?? addDays(TODAY, ADVANCE_DUE_DAYS);
  const booked = markBooked(ev, "Photography");
  const priced = withCategory(
    { ...booked, vendors: { ...booked.vendors, note: undefined } },
    "photo",
    (c) => ({
      ...c,
      status: `Booked · advance due ${dayMonth(advanceDue)}`,
      tone: "due",
      projected: price,
      items: c.items.map((i) =>
        i.id === "photo-pkg" ? { ...i, vendor: studio, amount: price, estimate: false } : i,
      ),
    }),
  );
  const listed = bookCategory(completeTask(priced, "w4"), "Photography", studio);
  return resolveNotice(listed, "photographer-window", `Booked ${studio}.`);
}

/** Orders the birthday cake from Bake Street and moves the readiness note on to the snacks. */
export function orderCake(ev: PersonalEvent): PersonalEvent {
  const ordered = bookCategory(completeTask(markBooked(ev, "Cake"), "b1"), "Cake", "Bake Street");
  return resolveNotice(
    {
      ...ordered,
      home: { ...ordered.home, readinessNote: { text: "Snacks caterer not chosen", tone: "idle" } },
    },
    "cake-order",
    "Cake ordered from Bake Street.",
  );
}

/** Swaps the second balloon arch for glow-in-the-dark stars, once. */
export function addStars(ev: PersonalEvent): PersonalEvent {
  if (ev.tasks.list.some((t) => t.id === "b-stars")) return ev;
  const swapped = withCategory(ev, "decor", (c) => ({
    ...c,
    planned: c.planned - SECOND_ARCH.cost,
    items: c.items.filter((i) => i.id !== SECOND_ARCH.id),
  }));
  const stars: Task = {
    id: "b-stars",
    title: "Stick glow-in-the-dark stars on the ceiling",
    who: "Vivek",
    due: addDays(ev.date, -1),
    done: false,
    note: "Décor",
  };
  return resolveNotice(
    addTasks(swapped, [stars]),
    "stars",
    "Added: stars instead of the second arch. ₹1,800 freed up.",
  );
}

/** Adds the two tasks that move the mela's food stalls to areca-leaf plates, once. */
export function addAreca(ev: CommunityEvent): CommunityEvent {
  if (ev.tasks.list.some((t) => t.id === "m-areca-1")) return ev;
  const tasks: Task[] = [
    {
      id: "m-areca-1",
      title: "Tell food stalls about areca-leaf plates",
      who: "Rekha",
      due: addDays(ev.date, -28),
      done: false,
    },
    {
      id: "m-areca-2",
      title: "Order 3,000 areca plates for the stalls",
      who: "Thomas",
      due: addDays(ev.date, -14),
      done: false,
    },
  ];
  return resolveNotice(addTasks(ev, tasks), "areca", "Added 2 tasks for Rekha and Thomas.");
}
