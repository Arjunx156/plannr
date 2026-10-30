import { type ReactNode, useState } from "react";
import { Pill } from "../../components/ui";
import { dueLabel, longDate } from "../../lib/dates";
import { inr } from "../../lib/format";
import { fill } from "../../lib/guestText";
import { mapLink } from "../../lib/ics";
import type { LinkText } from "../../lib/linkText";
import type { HelperView, ShiftsView, VendorView } from "../../shared/public";
import { type Act, Card, PublicShell, useLinkLang } from "./shell";

/** A helper's page: their tasks and the day's run sheet, in their language. */
/** "Two things for you", "One thing for you", or "All done" in the helper's language. */
function helperStatus(open: number, t: LinkText): string {
  if (!open) return t.helperDone;
  return open === 1 ? t.helperOne : fill(t.helperMany, { n: open });
}

export function HelperPage({ view, act, preview }: { view: HelperView; act?: Act; preview?: ReactNode }) {
  const [busy, setBusy] = useState("");
  const toggle = async (actions: unknown[], key: string) => {
    if (!act) return;
    setBusy(key);
    try {
      await act(actions);
    } finally {
      setBusy("");
    }
  };
  const open = view.tasks.filter((t) => !t.done);
  const { t, shell } = useLinkLang(view.event);
  return (
    <PublicShell
      event={view.event}
      eyebrow={fill(t.helperList, { name: view.helper })}
      preview={preview}
      {...shell}
    >
      <p className="m-0 text-[17px]">
        {fill(t.helperHello, { name: view.helper })} {helperStatus(open.length, t)}
      </p>
      <Card label={t.tasks}>
        <ul className="m-0 flex list-none flex-col p-0">
          {view.tasks.map((task) => {
            const due = dueLabel(task.due);
            return (
              <li key={task.id} className="flex items-start gap-3 border-t border-sand-2 py-3 first:border-0">
                <input
                  type="checkbox"
                  checked={task.done}
                  disabled={!act || busy === task.id}
                  aria-label={task.title}
                  onChange={() => toggle([{ type: "toggleTask", taskId: task.id }], task.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-leaf)]"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-medium ${task.done ? "text-muted line-through" : ""}`}>
                    {task.title}
                  </span>
                  {task.note && <span className="text-xs text-muted">{task.note}</span>}
                </span>
                <span
                  className={`shrink-0 text-xs font-medium ${due.late && !task.done ? "text-rust-ink" : "text-body"}`}
                >
                  {due.text}
                </span>
              </li>
            );
          })}
          {!view.tasks.length && <li className="text-sm text-muted">{t.noTasks}</li>}
        </ul>
      </Card>
      {view.checklist.length > 0 && (
        <Card label={t.toBring}>
          <h2 className="font-serif text-[22px]">{t.toBring}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {view.checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t border-sand-2 py-2.5 first:border-0">
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={!act || busy === c.id}
                  aria-label={c.label}
                  onChange={() =>
                    toggle(
                      [{ type: "updateRecord", coll: "checklist", id: c.id, patch: { done: !c.done } }],
                      c.id,
                    )
                  }
                  className="h-5 w-5 accent-[var(--color-leaf)]"
                />
                <span className={c.done ? "text-muted line-through" : ""}>{c.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PublicShell>
  );
}

export function VendorPage({ view, preview }: { view: VendorView; preview?: ReactNode }) {
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
        {view.arrivals.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {view.arrivals.map((a) => (
              <li
                key={`${a.label}-${a.time}`}
                className="flex flex-col gap-0.5 border-t border-sand-2 py-3 first:border-0"
              >
                <span className="font-semibold">{fill(t.arriveAt, { label: a.label, time: a.time })}</span>
                <span className="text-sm text-body">{longDate(a.date)}</span>
                {a.place && (
                  <a
                    href={mapLink(a.place)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link text-sm"
                  >
                    {a.place} · {t.map}
                  </a>
                )}
                {a.note && <span className="text-sm text-body">{a.note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">{t.noArrival}</p>
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
                className="grid grid-cols-[72px_1fr] gap-3 border-t border-sand-2 py-2 text-sm first:border-0"
              >
                <span className="font-mono text-xs text-muted">{r.time}</span>
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
                className="flex items-center justify-between gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-muted">{longDate(p.date)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular">{inr(p.amount)}</span>
                  <Pill tone={p.paid ? "ok" : "due"}>{p.paid ? t.paid : t.due}</Pill>
                </span>
              </li>
            ))}
          </ul>
          {due.length > 0 && (
            <span className="text-xs text-muted">
              {fill(t.stillToPay, { amount: inr(due.reduce((s, p) => s + p.amount, 0)) })}
            </span>
          )}
        </Card>
      )}
    </PublicShell>
  );
}

export function ShiftsPage({ view, act, preview }: { view: ShiftsView; act?: Act; preview?: ReactNode }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState("");
  const { t, shell } = useLinkLang(view.event);
  const sign = async (role: string, slot: number) => {
    const clean = name.trim();
    if (clean.length < 2) {
      setError(t.addName);
      document.getElementById("vol-name")?.focus();
      return;
    }
    if (!act) return;
    const key = `${role}-${slot}`;
    setBusy(key);
    setError("");
    try {
      await act([{ type: "assignShift", role, slot, name: clean }]);
      setDone((d) => [...d, `${role} · ${view.slots[slot]}`]);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy("");
  };
  const open = view.roles
    .flatMap((r) => r.slots.map((s, i) => ({ role: r.role, slot: i, s })))
    .filter((x) => x.s.filled < x.s.need);
  return (
    <PublicShell event={view.event} eyebrow={t.signup} preview={preview} {...shell}>
      <p className="m-0 text-[17px]">{open.length ? fill(t.shiftsOpen, { n: open.length }) : t.shiftsFull}</p>
      <Card label={t.yourName}>
        <label htmlFor="vol-name" className="label">
          {t.yourName}
        </label>
        <input
          id="vol-name"
          className="field"
          value={name}
          maxLength={40}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
        />
        {done.length > 0 && (
          <p role="status" className="m-0 text-sm text-leaf-ink">
            {fill(t.youreOn, { list: done.join("; ") })}
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-rust-ink">
            {error}
          </p>
        )}
      </Card>
      {view.roles.map((r) => (
        <Card key={r.role} label={r.role}>
          <h2 className="font-serif text-[20px]">{r.role}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {r.slots.map((s, i) => {
              if (!s.need) return null;
              const full = s.filled >= s.need;
              return (
                <li
                  key={view.slots[i]}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{view.slots[i]}</span>
                    <span className="text-xs text-muted">
                      {s.names.join(", ") || t.nobody} · {fill(t.ofNeed, { filled: s.filled, need: s.need })}
                    </span>
                  </span>
                  {full ? (
                    <Pill tone="ok">{t.full}</Pill>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!act || !!busy}
                      onClick={() => sign(r.role, i)}
                    >
                      {busy === `${r.role}-${i}` ? t.adding : t.signMe}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </PublicShell>
  );
}
