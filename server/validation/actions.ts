import { z } from "zod";
import type { EventAction } from "../../src/shared/engine";
import { id, iso, money, name, stamp, str } from "./fields";
import { answer, coll, lineItem, RECORDS, site } from "./records";

const base = { eventId: z.string().max(120).optional() };
export const task = z.object({
  id,
  title: name(200),
  who: str(80),
  due: iso,
  done: z.boolean(),
  fn: id.optional(),
  note: str(300).optional(),
});
const changeId = z.enum(["move-haldi", "cut-decor", "areca-plates"]);
const proposal = z.object({
  kind: z.enum([
    "addTask",
    "moveTask",
    "completeTask",
    "setHeadcount",
    "setBudgetLine",
    "remember",
    "announce",
    "moveFunction",
    "addChecklist",
  ]),
  taskId: id.optional(),
  title: str(200).optional(),
  due: iso.optional(),
  who: str(80).optional(),
  guests: z.number().int().min(0).max(100000).optional(),
  categoryId: id.optional(),
  amount: money.optional(),
  text: str(1000).optional(),
  fnId: id.optional(),
  date: iso.optional(),
  label: str(120).optional(),
});
const preview = z.object({
  id,
  title: str(200),
  tag: str(80),
  rows: z
    .array(
      z.object({
        title: str(200),
        from: str(200).optional(),
        to: str(200).optional(),
        detail: str(400).optional(),
        headsUp: z.boolean().optional(),
        amount: str(60).optional(),
      }),
    )
    .max(30),
  status: z.enum(["pending", "applied", "rejected"]),
  change: changeId,
});
/** One turn of the assistant thread, as the browser keeps it in the plan. */
const message = z.object({
  id,
  role: z.enum(["user", "ai"]),
  text: str(6000),
  proposals: z.array(proposal).max(12).optional(),
  proposalStatus: z.enum(["pending", "applied", "rejected"]).optional(),
  lang: str(10).optional(),
  caption: str(300).optional(),
  source: str(300).optional(),
  action: z
    .object({
      label: str(120),
      id: z.enum([
        "compare-photographers",
        "remind",
        "open-savings",
        "accept-overrun",
        "review-guest-changes",
        "dismiss",
        "draft-permit",
        "add-areca",
        "add-stars",
        "order-cake",
        "acknowledge",
        "add-tip",
        "open-approvals",
      ]),
      done: z.boolean().optional(),
    })
    .optional(),
  preview: preview.optional(),
  footnote: str(600).optional(),
  translation: str(6000).optional(),
});
/** A change that carries nothing but its type: the suggestion it names is worked out on the plan. */
const bare = <T extends string>(type: T) => z.object({ ...base, type: z.literal(type) });
/** Changes to tasks, the assistant thread, the budget and the event itself. */
const CORE_ACTIONS = {
  toggleTask: z.object({ ...base, type: z.literal("toggleTask"), taskId: id }),
  addTask: z.object({ ...base, type: z.literal("addTask"), task }),
  updateTask: z.object({
    ...base,
    type: z.literal("updateTask"),
    taskId: id,
    patch: task.partial().omit({ id: true }),
  }),
  resolveNotice: z.object({
    ...base,
    type: z.literal("resolveNotice"),
    noticeId: id,
    status: z.enum(["done", "dismissed"]),
    result: str(300).optional(),
  }),
  reopenNotice: z.object({ ...base, type: z.literal("reopenNotice"), noticeId: id }),
  pushMessage: z.object({ ...base, type: z.literal("pushMessage"), message }),
  previewStatus: z.object({
    ...base,
    type: z.literal("previewStatus"),
    messageId: id,
    status: z.enum(["applied", "rejected"]),
  }),
  messageActionDone: z.object({ ...base, type: z.literal("messageActionDone"), messageId: id }),
  applyChange: z.object({ ...base, type: z.literal("applyChange"), change: changeId }),
  addTip: bare("addTip"),
  addLineItem: z.object({
    ...base,
    type: z.literal("addLineItem"),
    categoryId: id,
    item: lineItem,
    spent: money,
  }),
  updateCategory: z.object({
    ...base,
    type: z.literal("updateCategory"),
    categoryId: id,
    patch: RECORDS.categories.partial().omit({ id: true }),
  }),
  addCategory: z.object({ ...base, type: z.literal("addCategory"), category: RECORDS.categories }),
  applyGuestGrowth: bare("applyGuestGrowth"),
  bookPhotographer: z.object({
    ...base,
    type: z.literal("bookPhotographer"),
    studio: name(120),
    price: money,
    advanceDue: iso.optional(),
  }),
  orderCake: bare("orderCake"),
  addStars: bare("addStars"),
  addAreca: bare("addAreca"),
  approveExpense: z.object({
    ...base,
    type: z.literal("approveExpense"),
    approvalId: id,
    status: z.enum(["approved", "declined"]),
  }),
  assignShift: z.object({
    ...base,
    type: z.literal("assignShift"),
    role: name(80),
    slot: z.number().int().min(0).max(23),
    name: name(80),
  }),
  archiveEvent: z.object({ ...base, type: z.literal("archiveEvent"), archived: z.boolean() }),
  renameEvent: z.object({ ...base, type: z.literal("renameEvent"), name: name() }),
  // The plan itself is checked whole by checkPlan below.
  replacePlan: z.object({
    ...base,
    type: z.literal("replacePlan"),
    event: z.record(z.string(), z.unknown()),
  }),
};
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
    guests: z.number().int().min(1).max(100000),
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
/** Every change the API accepts, by type. Typed by EventAction, so a new change can't ship without its shape. */
export const ACTIONS: Record<EventAction["type"], z.ZodObject> = { ...CORE_ACTIONS, ...PLAN_ACTIONS };
