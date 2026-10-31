/**
 * The shared pieces of the interface, rendered to HTML on the server: what they say, the roles and labels
 * screen readers get, and that values from data never become a `style` attribute the CSP would refuse.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { cssVars, percent } from "../src/components/cssVars";
import {
  Avatar,
  Bar,
  FundProgress,
  Panel,
  Pill,
  SkipLink,
  Spinner,
  StatTile,
  SWATCH_BG,
  SWATCH_BORDER,
  ThinkingDots,
  toneText,
} from "../src/components/ui";
import type { Swatch } from "../src/data/baseTypes";
import type { Profile } from "../src/data/types";
import { emptyProfile, parseDescription } from "../src/lib/intake";
import { draftPlan } from "../src/lib/plan";
import { profileRows } from "../src/lib/profileRows";
import {
  BudgetSection,
  failureLine,
  GuestsSection,
  NotesSection,
  TimelineSection,
  VendorsSection,
} from "../src/pages/plan/sections";

/** The words a reader sees, without the markup. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("values from data", () => {
  test("are set as CSS variables on the element, never as a style attribute", () => {
    const set: [string, string][] = [];
    const el = { style: { setProperty: (name: string, value: string) => set.push([name, value]) } };
    Reflect.apply(cssVars({ "--w": "40%", "--c": "#6E1F2E" }), undefined, [el]);
    expect(set).toEqual([
      ["--w", "40%"],
      ["--c", "#6E1F2E"],
    ]);
    // React calls a ref with null when the element goes away.
    expect(() => cssVars({ "--w": "1%" })(null)).not.toThrow();
  });

  test("a share becomes a width between nothing and the whole", () => {
    expect(percent(0.25)).toBe("25%");
    expect(percent(1.7)).toBe("100%");
    expect(percent(-3)).toBe("0%");
    expect(percent(Number.NaN)).toBe("0%");
    expect(percent(Number.POSITIVE_INFINITY)).toBe("0%");
  });

  test("no shared piece renders a style attribute", () => {
    const p = { name: "Priya Menon", initials: "PM", bg: "#F4E1C1", fg: "#5A3A12" };
    const html = [
      render(<Bar value={0.5} />),
      render(<Avatar p={p} />),
      render(<StatTile label="Budget" value="₹12L" sub="On track" bar={0.4} fill="leaf" />),
    ].join("");
    expect(html).not.toContain("style=");
  });
});

describe("progress bars", () => {
  test("tell screen readers how far along they are, kept between 0 and 100", () => {
    const now = (value: number) =>
      render(<Bar value={value} label="Tasks" />).match(/aria-valuenow="(\d+)"/)?.[1];
    expect(now(0.456)).toBe("46");
    expect(now(1.5)).toBe("100");
    expect(now(-1)).toBe("0");
    expect(render(<Bar value={0.3} label="Tasks" />)).toContain('role="progressbar"');
    expect(render(<Bar value={0.3} label="Tasks" />)).toContain('aria-label="Tasks"');
  });

  test("fill with the swatch they're given, ink when none is", () => {
    expect(render(<Bar value={0.3} fill="maroon" />)).toContain("bg-maroon");
    expect(render(<Bar value={0.3} />)).toContain("bg-ink");
  });

  test("every swatch has its own background and border class, named after it", () => {
    for (const [swatch, bg] of Object.entries(SWATCH_BG)) expect(bg).toBe(`bg-${swatch}`);
    for (const [swatch, border] of Object.entries(SWATCH_BORDER)) expect(border).toBe(`border-${swatch}`);
    const swatches: Swatch[] = [
      "marigold",
      "indigo",
      "leaf",
      "maroon",
      "peacock",
      "rust",
      "kasavu",
      "ink",
      "line-2",
    ];
    expect(Object.keys(SWATCH_BG).sort()).toEqual([...swatches].sort());
  });
});

describe("small pieces", () => {
  test("a stat tile shows its number and context, and labels its bar with its name", () => {
    const html = render(<StatTile label="RSVPs" value="142" sub="of 268 invited" bar={0.53} />);
    expect(textOf(html)).toBe("RSVPs 142 of 268 invited");
    expect(html).toContain('aria-label="RSVPs"');
  });

  test("an avatar shows initials and names the person on hover", () => {
    const html = render(
      <Avatar p={{ name: "Rohan Iyer", initials: "RI", bg: "#000", fg: "#fff" }} ring={false} />,
    );
    expect(textOf(html)).toBe("RI");
    expect(html).toContain('title="Rohan Iyer"');
    expect(html).not.toContain("border-paper");
  });

  test("a spinner speaks only when it stands alone", () => {
    expect(render(<Spinner />)).toContain('aria-hidden="true"');
    const labelled = render(<Spinner label="Saving" />);
    expect(labelled).toContain('role="status"');
    expect(labelled).toContain('aria-label="Saving"');
  });

  test("the thinking dots are three, staggered, and hidden from screen readers", () => {
    const html = render(<ThinkingDots />);
    expect(html.match(/animation-delay/g)).toHaveLength(3);
    expect(html.startsWith('<span class="flex gap-1" aria-hidden="true">')).toBe(true);
  });

  test("fund progress reads as money in against money expected", () => {
    expect(textOf(render(<FundProgress received={40000} expected={60000} />))).toBe("₹40,000 / ₹60,000");
  });

  test("pills, panels and the skip link", () => {
    expect(render(<Pill tone="warn">Over</Pill>)).toContain("pill-warn");
    const panel = render(
      <Panel title="Money" id="money" aside={<a href="#x">All</a>}>
        <p>Body</p>
      </Panel>,
    );
    expect(panel).toContain('id="money"');
    expect(textOf(panel)).toBe("Money All Body");
    expect(render(<SkipLink />)).toContain('href="#main"');
  });

  test("each tone has its own text colour", () => {
    const classes = (["warn", "due", "ok", "idle"] as const).map(toneText);
    expect(new Set(classes).size).toBe(4);
  });
});

describe("the draft plan page", () => {
  // Rendering to HTML never clicks, so the retry button needs no handler.
  const noRetry = () => undefined;
  const profile = parseDescription(
    "Wedding in Kochi on 14 Feb 2027, 300 guests, budget 25 lakh",
    emptyProfile(),
  );
  const plan = draftPlan(profile);

  test("the budget lists every line with its share, as Plannr's own draft", () => {
    const text = textOf(render(<BudgetSection plan={plan} />));
    expect(text).toContain("Plannr's standard draft");
    for (const line of plan.budget.lines) expect(text).toContain(line.name);
  });

  test("the timeline counts what it shows, and names the day only when there is one", () => {
    const dated = textOf(render(<TimelineSection plan={plan} dated />));
    expect(dated).toContain(`The first ${plan.timeline.length} of ${plan.tasks} tasks, leading to`);
    expect(textOf(render(<TimelineSection plan={plan} dated={false} />))).toContain(
      `The first ${plan.timeline.length} of ${plan.tasks} tasks.`,
    );
  });

  test("vendors and guests list what the draft holds", () => {
    const vendors = textOf(render(<VendorsSection plan={plan} />));
    for (const v of plan.vendors) expect(vendors).toContain(v.name);
    const guests = textOf(render(<GuestsSection plan={plan} />));
    expect(guests).toContain(`Guests · ${plan.guests.total}`);
  });

  test("Gemini's notes show in full, and a failed draft says why with a way to ask again", () => {
    const notes = {
      summary: "A three-day wedding with room to spare.",
      tips: [{ title: "Book the caterer first", detail: "Kochi's best go a year ahead." }],
      watchouts: ["Monsoon dates"],
      ideas: ["A sadhya tasting"],
    };
    const shown = textOf(
      render(<NotesSection notes={notes} gemini="done" why={undefined} ideasLabel="Ideas" retry={noRetry} />),
    );
    expect(shown).toContain("A three-day wedding with room to spare.");
    expect(shown).toContain("1 Book the caterer first");
    expect(shown).toContain("Watch out for · Monsoon dates");
    expect(shown).toContain("Ideas A sadhya tasting");

    const failed = textOf(
      render(
        <NotesSection notes={undefined} gemini="failed" why="busy" ideasLabel="Ideas" retry={noRetry} />,
      ),
    );
    expect(failed).toContain(failureLine("busy"));
    expect(failed).toContain("Ask Gemini again");
    expect(
      render(
        <NotesSection
          notes={undefined}
          gemini="drafting"
          why={undefined}
          ideasLabel="Ideas"
          retry={noRetry}
        />,
      ),
    ).toBe("");
  });

  test("every reason a draft fell back has its own plain sentence", () => {
    const reasons = (["offline", "busy", "off", "timeout", "failed"] as const).map(failureLine);
    expect(new Set(reasons).size).toBe(5);
    expect(failureLine(undefined)).toBe(failureLine("timeout"));
    for (const r of reasons) expect(r).toEndWith("so this is Plannr's standard draft.");
  });
});

describe("what the intake has understood", () => {
  test("an empty profile has ten rows still to fill, and marks the one being asked", () => {
    const rows = profileRows(emptyProfile(), "date");
    expect(rows).toHaveLength(10);
    expect(rows.find((r) => r.key === "date")).toMatchObject({ state: "ask", value: "Answering now…" });
    expect(rows.filter((r) => r.state === "todo")).toHaveLength(9);
    expect(rows.find((r) => r.key === "co")?.value).toBe("Next: who's planning with you");
  });

  test("a described event fills its rows in the family's words", () => {
    const p = parseDescription("Wedding in Kochi on 14 Feb 2027, 300 guests, budget 25 lakh", emptyProfile());
    const value = (key: string) => profileRows(p).find((r) => r.key === key)?.value;
    expect(value("event")).toStartWith("Wedding");
    expect(value("guests")).toBe("About 300");
    expect(value("budget")).toBe("₹25,00,000");
    expect(value("city")).toBe("Kochi");
  });

  test("the venue line says how far the venue search has got", () => {
    const base: Profile = { ...emptyProfile(), city: "Kochi" };
    const venue = (p: Partial<Profile>) =>
      profileRows({ ...base, ...p }).find((r) => r.key === "city")?.value;
    expect(venue({ venueStatus: "Shortlisted", venues: "Kayal or Lulu" })).toBe("Kochi · 2 shortlisted");
    expect(venue({ venueStatus: "Booked", venues: "Grand Hyatt" })).toBe("Kochi · Grand Hyatt");
    expect(venue({ venueStatus: "Booked", city: undefined })).toBe("booked");
  });
});
