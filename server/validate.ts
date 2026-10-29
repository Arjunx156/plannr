import { z } from "zod";
import { EVENT_ACTION_TYPES, type EventAction } from "../src/shared/engine";
import type { Coll } from "../src/shared/records";

/**
 * Shapes for every change the API accepts. Plans are shown to whole families on cheap
 * phones, so a change must be well-formed and modest in size before it touches one.
 * Unknown fields are dropped.
 */

const str = (max = 200) => z.string().max(max);
const name = (max = 120) => z.string().trim().min(1).max(max);
const id = z.string().min(1).max(80);
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const money = z.number().finite().min(0).max(1_000_000_000);
const phone = z.string().regex(/^\d{6,15}$/);
const upi = z.string().regex(/^[\w.-]{2,64}@[\w.-]{2,32}$/);
const tone = z.enum(["warn", "due", "ok", "idle"]);
const lang = z.string().regex(/^[a-z]{2,3}$/);
const stamp = str(40);

const answer = z.object({
  status: z.enum(["pending", "yes", "no"]),
  count: z.number().int().min(0).max(502),
});

const household = z.object({
  id,
  name: name(),
  side: str(60).optional(),
  phone: phone.optional(),
  lang: lang.optional(),
  expected: z.number().int().min(1).max(500),
  functions: z.array(id).max(20),
  rsvp: z.record(id, answer),
  meal: z.enum(["veg", "nonveg", "jain"]).optional(),
  stay: z.boolean().optional(),
  pickup: str(160).optional(),
  needs: str(300).optional(),
  note: str(500).optional(),
  room: id.optional(),
  tables: z.record(id, id).optional(),
  checkedIn: z.record(id, z.number().int().min(0).max(502)).optional(),
  invitedAt: stamp.optional(),
  remindedAt: stamp.optional(),
  respondedAt: stamp.optional(),
});

const quote = z.object({
  id,
  amount: money,
  label: name(160),
  inclusions: str(600).optional(),
  terms: str(600).optional(),
  perGuest: z.boolean().optional(),
  on: iso.optional(),
  source: str(120).optional(),
});

const vendor = z.object({
  id,
  category: name(60),
  name: str(120),
  stage: z.enum(["needed", "enquired", "quoted", "booked"]),
  phone: phone.optional(),
  upi: upi.optional(),
  contact: str(120).optional(),
  quotes: z.array(quote).max(20),
  chosenQuote: id.optional(),
  categoryId: id.optional(),
  arrivals: z
    .array(z.object({ fnId: id, time: hhmm, note: str(200).optional() }))
    .max(20)
    .optional(),
  needs: str(500).optional(),
  notes: str(1000).optional(),
  lang: lang.optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

const lineItem = z.object({
  id,
  name: name(160),
  vendor: str(120),
  amount: money,
  estimate: z.boolean().optional(),
  status: z.enum(["paid", "advance", "unpaid", "included", "quote"]),
  due: iso.optional(),
});

const RECORDS: Record<Coll, z.ZodObject> = {
  households: household,
  tables: z.object({ id, fnId: id, name: name(60), seats: z.number().int().min(1).max(100) }),
  rooms: z.object({
    id,
    hotel: name(120),
    rooms: z.number().int().min(1).max(500),
    nights: str(60).optional(),
    rate: money.optional(),
    note: str(300).optional(),
  }),
  vendors: vendor,
  payments: z.object({
    id,
    date: iso,
    label: name(160),
    amount: money,
    paid: z.boolean(),
    estimate: z.boolean().optional(),
    vendorId: id.optional(),
    categoryId: id.optional(),
    paidOn: iso.optional(),
    method: z.enum(["upi", "cash", "bank", "card", "cheque"]).optional(),
    by: str(80).optional(),
  }),
  categories: z.object({
    id,
    name: name(80),
    planned: money,
    spent: money,
    projected: money.optional(),
    status: str(120),
    tone,
    note: str(300).optional(),
    items: z.array(lineItem).max(60),
  }),
  settlements: z.object({
    id,
    from: name(80),
    to: name(80),
    amount: money,
    on: iso,
    note: str(200).optional(),
  }),
  gifts: z.object({
    id,
    from: name(),
    householdId: id.optional(),
    amount: money.optional(),
    item: str(160).optional(),
    fnId: id.optional(),
    thanked: z.boolean().optional(),
    thankNote: str(1000).optional(),
  }),
  functions: z.object({
    id,
    label: name(60),
    date: iso,
    part: z.enum(["AM", "PM"]).optional(),
    time: str(40).optional(),
    place: str(160).optional(),
    address: str(300).optional(),
    dress: str(160).optional(),
    capacity: z.number().int().min(1).max(100_000).optional(),
    private: z.boolean().optional(),
  }),
  runsheet: z.object({
    id,
    fnId: id,
    time: hhmm,
    title: name(160),
    owner: str(80).optional(),
    phone: phone.optional(),
    note: str(300).optional(),
    done: z.boolean().optional(),
  }),
  checklist: z.object({
    id,
    fnId: id.optional(),
    label: name(160),
    owner: str(80).optional(),
    done: z.boolean(),
  }),
  announcements: z.object({ id, at: stamp, text: name(500) }),
  album: z.object({
    id,
    url: z
      .string()
      .url()
      .max(500)
      .refine((u) => u.startsWith("https://"), "Photos must be on a secure link"),
    by: name(80),
    at: stamp,
    caption: str(200).optional(),
  }),
  memory: z.object({ id, text: name(300) }),
  ideas: z.object({
    id,
    title: name(160),
    cost: money.optional(),
    effort: z.enum(["low", "medium", "high"]).optional(),
    categoryId: id.optional(),
    status: z.enum(["idea", "planned", "dropped"]),
    note: str(500).optional(),
  }),
  stalls: z.object({
    id,
    name: name(),
    owner: name(80),
    phone: phone.optional(),
    category: str(60).optional(),
    fee: money,
    paid: z.boolean(),
    status: z.enum(["requested", "confirmed"]),
  }),
  passes: z.object({
    id,
    name: name(),
    count: z.number().int().min(1).max(50),
    phone: phone.optional(),
    checkedIn: z.number().int().min(0).max(60).optional(),
  }),
  sponsors: z.object({ id, name: name(), tier: name(40), amount: money, received: money }),
  permits: z.object({
    id,
    label: name(160),
    status: name(120),
    tone,
    permit: z.boolean().optional(),
    due: iso.optional(),
    letter: str(6000).optional(),
  }),
  approvals: z.object({
    id,
    label: name(160),
    by: name(80),
    amount: money,
    status: z.enum(["pending", "approved", "declined"]),
    category: str(60).optional(),
    decidedBy: str(80).optional(),
  }),
  sources: z.object({ id, label: name(120), expected: money, received: money, note: str(120), tone }),
};

const coll = z.enum(Object.keys(RECORDS) as [Coll, ...Coll[]]);

const site = z.object({
  published: z.boolean().optional(),
  story: str(3000).optional(),
  storyLocal: str(4000).optional(),
  lang: lang.optional(),
  faqs: z
    .array(z.object({ q: name(200), a: name(1000) }))
    .max(20)
    .optional(),
  indexable: z.boolean().optional(),
});

const base = { eventId: z.string().max(120).optional() };

const PLAN_ACTIONS = {
  addRecord: z.object({
    ...base,
    type: z.literal("addRecord"),
    coll,
    record: z.record(z.string(), z.unknown()),
  }),
  updateRecord: z.object({
    ...base,
    type: z.literal("updateRecord"),
    coll,
    id,
    patch: z.record(z.string(), z.unknown()),
  }),
  removeRecord: z.object({ ...base, type: z.literal("removeRecord"), coll, id }),
  rsvp: z.object({
    ...base,
    type: z.literal("rsvp"),
    householdId: id,
    answers: z.record(id, answer),
    meal: z.enum(["veg", "nonveg", "jain"]).optional(),
    stay: z.boolean().optional(),
    pickup: str(160).optional(),
    note: str(500).optional(),
    at: stamp.optional(),
  }),
  markPaid: z.object({
    ...base,
    type: z.literal("markPaid"),
    paymentId: id,
    paid: z.boolean(),
    on: iso.optional(),
    method: z.enum(["upi", "cash", "bank", "card", "cheque"]).optional(),
    by: str(80).optional(),
  }),
  checkIn: z.object({
    ...base,
    type: z.literal("checkIn"),
    coll: z.enum(["households", "passes"]),
    id,
    fnId: id,
    count: z.number().int().min(0).max(502),
  }),
  shiftRunsheet: z.object({
    ...base,
    type: z.literal("shiftRunsheet"),
    fnId: id,
    fromId: id,
    minutes: z.number().int().min(-240).max(240),
  }),
  setHeadcount: z.object({
    ...base,
    type: z.literal("setHeadcount"),
    guests: z.number().int().min(1).max(100_000),
  }),
  bookVendor: z.object({ ...base, type: z.literal("bookVendor"), vendorId: id, quoteId: id.optional() }),
  editShifts: z.object({
    ...base,
    type: z.literal("editShifts"),
    op: z.enum(["addRole", "setNeed", "unassign", "addVolunteer"]),
    role: name(80).optional(),
    slot: z.number().int().min(0).max(23).optional(),
    need: z.number().int().min(0).max(99).optional(),
    name: name(80).optional(),
  }),
  updateEvent: z.object({
    ...base,
    type: z.literal("updateEvent"),
    patch: z.object({
      name: name().optional(),
      date: iso.optional(),
      site: site.optional(),
      listMeta: str(200).optional(),
    }),
  }),
};

const legacy = z
  .object({
    type: z.string().refine((t) => EVENT_ACTION_TYPES.has(t as EventAction["type"]), "Unknown change"),
  })
  .passthrough();

/** Checks one change; returns it cleaned, or an error message a person can read. */
export function parseAction(raw: unknown): { ok: true; action: EventAction } | { ok: false; error: string } {
  const type = (raw as { type?: unknown } | null)?.type;
  const shape = typeof type === "string" ? PLAN_ACTIONS[type as keyof typeof PLAN_ACTIONS] : undefined;
  if (!shape) {
    const parsed = legacy.safeParse(raw);
    return parsed.success
      ? { ok: true, action: parsed.data as unknown as EventAction }
      : { ok: false, error: parsed.error.issues[0]?.message ?? "Unknown change" };
  }
  const parsed = shape.safeParse(raw);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const action = parsed.data as Record<string, unknown>;
  // Records are checked against their own collection's shape.
  if (action.type === "addRecord") {
    const record = RECORDS[action.coll as Coll].safeParse(action.record);
    if (!record.success) return { ok: false, error: describe(record.error) };
    action.record = record.data;
  }
  if (action.type === "updateRecord") {
    const patch = RECORDS[action.coll as Coll].partial().omit({ id: true }).safeParse(action.patch);
    if (!patch.success) return { ok: false, error: describe(patch.error) };
    action.patch = patch.data;
  }
  return { ok: true, action: action as unknown as EventAction };
}

function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "That change isn't valid";
  const where = issue.path.filter((p) => typeof p === "string").join(".");
  return where ? `${where}: ${issue.message}` : issue.message;
}

export const recordShape = (c: Coll) => RECORDS[c];
