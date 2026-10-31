/** The vendors a first draft books, for each kind of event, and the note that goes with them. */
import { describe, expect, test } from "bun:test";
import { vendorsFor } from "../src/lib/draftLists";
import { emptyProfile } from "../src/lib/intake";

describe("the vendors a draft books", () => {
  test("a wedding gets its rituals' musicians, a mehendi artist for a mehendi, and a note on photographers", () => {
    const north = vendorsFor({ ...emptyProfile(), kind: "wedding", city: "Jaipur", functions: ["Mehendi"] });
    expect(north.list).toContain("DJ");
    expect(north.list).toContain("Mehendi artist");
    expect(north.note).toContain("Jaipur studios");
    const kerala = vendorsFor({
      ...emptyProfile(),
      kind: "wedding",
      style: "Kerala-style",
      date: "2027-05-30",
    });
    expect(kerala.list).toContain("Sadhya caterer");
    expect(kerala.list).not.toContain("Mehendi artist");
    expect(kerala.note).toContain("May");
  });

  test("birthdays, community events and anything else get their own list", () => {
    expect(vendorsFor({ ...emptyProfile(), kind: "birthday" }).list).toContain("Cake");
    expect(vendorsFor({ ...emptyProfile(), kind: "community" }).note).toContain("police permission");
    expect(vendorsFor({ ...emptyProfile(), kind: "other" }).list[0]).toBe("Venue");
  });
});
