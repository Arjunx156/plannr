import { Link } from "react-router";
import { SitePage } from "./Layout";

const TOOLS = [
  {
    to: "/tools/budget-calculator",
    t: "Budget splitter",
    d: "Split a total budget across catering, venue, décor and the rest, with what it means per guest.",
  },
  {
    to: "/tools/kerala-wedding-checklist",
    t: "Kerala wedding checklist",
    d: "What to book and when, from fixing the muhurtham to the morning of the wedding.",
  },
  {
    to: "/tools/shagun-register",
    t: "Gift and shagun register",
    d: "Write down every envelope and gift as it comes in, so nobody is missed in the thank-yous.",
  },
  {
    to: "/tools/festival-checklist",
    t: "Festival committee checklist",
    d: "Permissions, funds, stalls, volunteers and the clean-up, for a society or temple festival.",
  },
];

export function ToolsIndex() {
  return (
    <SitePage
      title="Free event planning tools"
      description="Free tools for planning Indian weddings, birthdays and community festivals: a budget splitter, checklists and a gift register. No sign-up."
      eyebrow="Free tools"
      heading="Free tools, no sign-up"
      lead="Use them as they are. Everything stays in your browser. When you want the whole plan in one place, Plannr is free too."
      wide
    >
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
        {TOOLS.map((x) => (
          <li key={x.to}>
            <Link
              to={x.to}
              className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 text-ink no-underline hover:border-line-2"
            >
              <span className="font-serif text-[24px] leading-tight">{x.t}</span>
              <span className="text-[15px] leading-[1.5] text-body">{x.d}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SitePage>
  );
}
