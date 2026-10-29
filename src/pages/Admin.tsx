import { useEffect, useState } from "react";
import { AppShell } from "../components/shell";
import { usePageMeta } from "../components/ui";
import { timeAgo } from "../lib/format";
import { Section } from "./tabs/common";

interface Summary {
  days: { day: string; name: string; count: number }[];
  ai: { day: string; calls: number; tokens: number; people: number }[];
  errors: {
    id: string;
    at: string;
    source: string;
    message: string;
    url: string | null;
    release: string | null;
  }[];
  totals: { accounts: number; plans: number };
  metrics: string[];
}

const LABEL: Record<string, string> = {
  visit: "Visits",
  plan: "New plans",
  rsvp: "RSVPs",
  link_open: "Links opened",
  signin: "Sign-ins",
  photo: "Album photos",
  push_on: "Reminders on",
};

/** /admin — the site owner's view: counts by day, AI use and recent errors. Owners only. */
export function Admin() {
  usePageMeta("Admin", { private: true });
  const [data, setData] = useState<Summary | null | undefined>();
  useEffect(() => {
    fetch("/api/admin/summary", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);
  if (data === undefined)
    return (
      <AppShell>
        <main id="main" className="mx-auto max-w-[960px] px-4 py-8 text-muted">
          Loading…
        </main>
      </AppShell>
    );
  if (!data)
    return (
      <AppShell>
        <main id="main" className="mx-auto max-w-[960px] px-4 py-8">
          <h1 className="font-serif text-[32px]">Not found</h1>
        </main>
      </AppShell>
    );
  const days = [...new Set(data.days.map((d) => d.day))].sort().reverse();
  const at = (day: string, name: string) =>
    data.days.find((d) => d.day === day && d.name === name)?.count ?? 0;
  return (
    <AppShell>
      <main id="main" className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-8 sm:px-8">
        <h1 className="font-serif text-[40px] leading-none">Admin</h1>
        <p className="m-0 text-body">
          {data.totals.accounts} accounts · {data.totals.plans} plans. Counts are totals per day, with no
          names or addresses.
        </p>
        <Section title="Last 14 days">
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table */}
          <section className="scroll-x" aria-label="Daily counts" tabIndex={0}>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 font-medium">Day</th>
                  {data.metrics.map((m) => (
                    <th key={m} className="py-2 text-right font-medium">
                      {LABEL[m] ?? m}
                    </th>
                  ))}
                  <th className="py-2 text-right font-medium">AI calls</th>
                  <th className="py-2 text-right font-medium">AI tokens</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d} className="border-t border-sand-2">
                    <td className="py-2">{d}</td>
                    {data.metrics.map((m) => (
                      <td key={m} className="py-2 text-right tabular">
                        {at(d, m) || "·"}
                      </td>
                    ))}
                    <td className="py-2 text-right tabular">
                      {data.ai.find((a) => a.day === d)?.calls ?? "·"}
                    </td>
                  </tr>
                ))}
                {!days.length && (
                  <tr>
                    <td className="py-2 text-muted">Nothing counted yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </Section>
        <Section
          title="Recent errors"
          aside={<span className="text-sm text-muted">{data.errors.length}</span>}
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {data.errors.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-0.5 border-t border-sand-2 py-2 text-sm first:border-0"
              >
                <span className="font-medium">{e.message}</span>
                <span className="text-xs text-muted">
                  {e.source} · {e.url ?? ""} · {timeAgo(e.at)}
                  {e.release ? ` · ${e.release}` : ""}
                </span>
              </li>
            ))}
            {!data.errors.length && <li className="text-sm text-muted">No errors in the last 30 days.</li>}
          </ul>
        </Section>
      </main>
    </AppShell>
  );
}
