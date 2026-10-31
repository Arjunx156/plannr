/** The plan engine's money and one-tap fixes: budget lines, suggestions and the mela's funds. */
import { describe, expect, test } from "bun:test";
import type { PersonalEvent } from "../src/data/types";
import { budgetTotals } from "../src/lib/metrics";
import { applyEventAction } from "../src/shared/engine";
import { community, demo, noticedWedding, personal } from "./support";

const { wedding, birthday, mela, empty } = demo();

const noticed = noticedWedding();

const cat = (ev: PersonalEvent, id: string) => ev.budget.categories.find((c) => c.id === id);
const projected = (ev: PersonalEvent, id: string) => {
  const c = cat(ev, id);
  return c ? (c.projected ?? c.planned) : 0;
};

describe("budget", () => {
  test("a line item adds to the category's spending", () => {
    const item = { id: "li", name: "Garlands", vendor: "Market", amount: 4000, status: "paid" as const };
    const out = personal(
      applyEventAction(wedding, {
        type: "addLineItem",
        eventId: wedding.id,
        categoryId: "decor",
        item,
        spent: 4000,
      }),
    );
    expect(cat(out, "decor")?.spent).toBe((cat(wedding, "decor")?.spent ?? 0) + 4000);
    expect(cat(out, "decor")?.items.some((i) => i.id === "li")).toBe(true);
  });

  test("categories can be added and changed", () => {
    const category = {
      id: "misc",
      name: "Misc",
      planned: 10000,
      spent: 0,
      status: "",
      tone: "idle" as const,
      items: [],
    };
    const added = personal(
      applyEventAction(wedding, {
        type: "addCategory",
        eventId: wedding.id,
        category,
      }),
    );
    expect(budgetTotals(added.budget).planned).toBe(budgetTotals(wedding.budget).planned + 10000);
    const changed = personal(
      applyEventAction(added, {
        type: "updateCategory",
        eventId: wedding.id,
        categoryId: "misc",
        patch: { planned: 5000 },
      }),
    );
    expect(cat(changed, "misc")?.planned).toBe(5000);
  });

  test("a tip is added once", () => {
    const once = personal(applyEventAction(wedding, { type: "addTip", eventId: wedding.id }));
    const twice = personal(applyEventAction(once, { type: "addTip", eventId: wedding.id }));
    expect(projected(twice, "gifts")).toBe(projected(wedding, "gifts") + 8000);
  });

  test("a bigger guest list raises catering and invitations, and settles its notice", () => {
    const out = personal(applyEventAction(noticed, { type: "applyGuestGrowth", eventId: wedding.id }));
    expect(projected(out, "catering")).toBe(projected(wedding, "catering") + 36288);
    expect(projected(out, "invitations")).toBe(projected(wedding, "invitations") + 2700);
    expect(out.notices.find((n) => n.id === "guests-grew")?.status).toBe("done");
  });
});

describe("one-tap suggestions", () => {
  test("booking the photographer books the vendor, prices the line and ticks the task", () => {
    const out = personal(
      applyEventAction(wedding, {
        type: "bookPhotographer",
        eventId: wedding.id,
        studio: "Frames by Anoop",
        price: 165000,
        advanceDue: "2026-10-10",
      }),
    );
    expect(out.vendors.booked).toContain("Photography");
    expect(projected(out, "photo")).toBe(165000);
    expect(cat(out, "photo")?.status).toContain("10 Oct");
  });

  test("ordering the cake and swapping in stars change the birthday", () => {
    const cake = personal(applyEventAction(birthday, { type: "orderCake", eventId: birthday.id }));
    expect(cake.vendors.booked).toContain("Cake");
    expect(cake.tasks.list.find((t) => t.id === "b1")?.done).toBe(true);
    const stars = personal(applyEventAction(birthday, { type: "addStars", eventId: birthday.id }));
    expect(cat(stars, "decor")?.planned).toBe((cat(birthday, "decor")?.planned ?? 0) - 1800);
    expect(applyEventAction(stars, { type: "addStars", eventId: birthday.id })).toBe(stars);
  });

  test("areca plates add their tasks to a community event once", () => {
    const out = community(applyEventAction(mela, { type: "addAreca", eventId: mela.id }));
    expect(out.tasks.list.filter((t) => t.id.startsWith("m-areca"))).toHaveLength(2);
    expect(applyEventAction(out, { type: "addAreca", eventId: mela.id })).toBe(out);
  });

  test("actions for another kind of event leave it as it was", () => {
    expect(applyEventAction(mela, { type: "orderCake", eventId: mela.id })).toBe(mela);
    expect(applyEventAction(wedding, { type: "addAreca", eventId: wedding.id })).toBe(wedding);
    expect(applyEventAction(empty, { type: "addTip", eventId: empty.id })).toBe(empty);
  });
});

describe("community", () => {
  test("approving an expense counts it as spent; deciding twice does nothing", () => {
    const pending = mela.funds.approvals.find((a) => a.status === "pending");
    if (!pending) throw new Error("seed has a pending approval");
    const out = community(
      applyEventAction(mela, {
        type: "approveExpense",
        eventId: mela.id,
        approvalId: pending.id,
        status: "approved",
      }),
    );
    expect(out.funds.spent).toBe(mela.funds.spent + pending.amount);
    const again = applyEventAction(out, {
      type: "approveExpense",
      eventId: mela.id,
      approvalId: pending.id,
      status: "declined",
    });
    expect(again).toBe(out);
  });

  test("a volunteer put on a shift joins the volunteer list once", () => {
    const role = mela.shifts.roles[0];
    if (!role) throw new Error("seed has shifts");
    const action = {
      type: "assignShift" as const,
      eventId: mela.id,
      role: role.role,
      slot: 0,
      name: "Nikhil",
    };
    const out = community(applyEventAction(applyEventAction(mela, action), action));
    expect(out.volunteers.filter((v) => v === "Nikhil")).toHaveLength(1);
    expect(out.shifts.roles[0]?.slots[0]?.names.filter((n) => n === "Nikhil")).toHaveLength(1);
  });
});
