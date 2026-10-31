import type { JSX, ReactNode } from "react";
import { Pill } from "../../components/ui";
import { longDate } from "../../lib/dates";
import { inr } from "../../lib/format";
import { fill } from "../../lib/guestText";
import type { VendorView } from "../../shared/public";
import { Card, MapLink, PublicShell, useLinkLang } from "./shell";

/** A vendor's call sheet: when to arrive, who to call and what is still due. */
export function VendorPage({ view, preview }: { view: VendorView; preview?: ReactNode }): JSX.Element {
  const due = view.payments.filter((p) => !p.paid);
  const { t, shell } = useLinkLang(view.event);
  return (
    <PublicShell
      event={view.event}
      eyebrow={fill(t.callSheet, { category: view.vendor.category })}
      preview={preview}
      {...shell}
    >
      <p className="m-0 text-[17px]">
        {view.vendor.name ? fill(t.vendorHello, { name: view.vendor.name }) : t.vendorHelloNoName}
      </p>
      <Card label={t.whenWhere}>
        <h2 className="font-serif text-[22px]">{t.whenWhere}</h2>
        {view.arrivals.length > 0 ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {view.arrivals.map((a) => (
              <li
                key={`${a.label}-${a.time}`}
                className="flex flex-col gap-0.5 border-sand-2 border-t py-3 first:border-0"
              >
                <span className="font-semibold">{fill(t.arriveAt, { label: a.label, time: a.time })}</span>
                <span className="text-body text-sm">{longDate(a.date)}</span>
                {a.place && <MapLink place={a.place} label={t.map} />}
                {a.note && <span className="text-body text-sm">{a.note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-muted text-sm">{t.noArrival}</p>
        )}
      </Card>
      {view.vendor.needs && (
        <Card label={t.arranged}>
          <h2 className="font-serif text-[22px]">{t.arranged}</h2>
          <p className="m-0 text-body">{view.vendor.needs}</p>
        </Card>
      )}
      {view.runsheet.length > 0 && (
        <Card label={t.yourPart}>
          <h2 className="font-serif text-[22px]">{t.yourPart}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {view.runsheet.map((r) => (
              <li
                key={`${r.label}-${r.time}-${r.title}`}
                className="grid grid-cols-[72px_1fr] gap-3 border-sand-2 border-t py-2 text-sm first:border-0"
              >
                <span className="font-mono text-muted text-xs">{r.time}</span>
                <span>
                  {r.title} <span className="text-muted">· {r.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {view.payments.length > 0 && (
        <Card label={t.payments}>
          <h2 className="font-serif text-[22px]">{t.payments}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {view.payments.map((p) => (
              <li
                key={`${p.label}-${p.date}`}
                className="flex items-center justify-between gap-3 border-sand-2 border-t py-2.5 text-sm first:border-0"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted text-xs">{longDate(p.date)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular">{inr(p.amount)}</span>
                  <Pill tone={p.paid ? "ok" : "due"}>{p.paid ? t.paid : t.due}</Pill>
                </span>
              </li>
            ))}
          </ul>
          {due.length > 0 && (
            <span className="text-muted text-xs">
              {fill(t.stillToPay, { amount: inr(due.reduce((s, p) => s + p.amount, 0)) })}
            </span>
          )}
        </Card>
      )}
    </PublicShell>
  );
}
