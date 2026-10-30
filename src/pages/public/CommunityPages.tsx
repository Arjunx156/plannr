import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { detectorClass, Scanner } from "../../components/scanner";
import { inr } from "../../lib/format";
import { fill } from "../../lib/guestText";
import type { FundView, GateView, StallsView } from "../../shared/public";
import { readPassCode } from "../../shared/public";
import { type Act, Card, PublicShell, useLinkLang } from "./shell";

/** The public fund report: what came in, what was spent and who sponsored it. */
export function FundPage({ view, preview }: { view: FundView; preview?: ReactNode }) {
  const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;
  const tiers = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const s of view.sponsors) out.set(s.tier, [...(out.get(s.tier) ?? []), s.name]);
    return [...out.entries()];
  }, [view.sponsors]);
  const { t, shell } = useLinkLang(view.event);
  return (
    <PublicShell event={view.event} eyebrow={t.fundReport} preview={preview} {...shell}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          [
            t.collected,
            inr(view.received),
            fill(t.collectedOf, { pct: pct(view.received, view.expected), expected: inr(view.expected) }),
          ],
          [t.spent, inr(view.spent), fill(t.ofBudget, { budget: inr(view.budget) })],
          [
            t.awaiting,
            inr(view.pending.amount),
            view.pending.count === 1 ? t.expenseOne : fill(t.expenseMany, { n: view.pending.count }),
          ],
        ].map(([label, value, sub]) => (
          <div key={label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <span className="eyebrow text-muted">{label}</span>
            <span className="font-serif text-[26px] leading-none tabular">{value}</span>
            <span className="text-xs text-body">{sub}</span>
          </div>
        ))}
      </div>
      <Card label={t.moneyFrom}>
        <h2 className="font-serif text-[22px]">{t.moneyFrom}</h2>
        <ul className="m-0 flex list-none flex-col p-0">
          {view.sources.map((s) => (
            <li
              key={s.label}
              className="flex justify-between gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span className="font-medium">{s.label}</span>
              <span className="tabular">
                {inr(s.received)} <span className="text-muted">/ {inr(s.expected)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card label={t.approvedSpending}>
        <h2 className="font-serif text-[22px]">{t.approvedSpending}</h2>
        {view.expenses.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {view.expenses.map((e) => (
              <li
                key={e.label}
                className="flex justify-between gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
              >
                <span>{e.label}</span>
                <span className="tabular">{inr(e.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">{t.noExpenses}</p>
        )}
      </Card>
      {tiers.length > 0 && (
        <Card label={t.thanksSponsors}>
          <h2 className="font-serif text-[22px]">{t.thanksSponsors}</h2>
          {tiers.map(([tier, names]) => (
            <p key={tier} className="m-0 text-sm">
              <span className="eyebrow mr-2 text-muted">{tier}</span>
              {names.join(" · ")}
            </p>
          ))}
        </Card>
      )}
    </PublicShell>
  );
}

export function StallsPage({ view, act, preview }: { view: StallsView; act?: Act; preview?: ReactNode }) {
  const { t, shell } = useLinkLang(view.event);
  const [stall, setStall] = useState("");
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState(view.categories[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (!stall.trim() || !owner.trim()) {
      setError(t.stallNeedNames);
      return;
    }
    if (digits && digits.length < 10) {
      setError(t.stallPhone);
      return;
    }
    if (!act) return;
    setBusy(true);
    setError("");
    try {
      await act([
        {
          type: "addRecord",
          coll: "stalls",
          record: {
            id: "new",
            name: stall.trim(),
            owner: owner.trim(),
            ...(digits ? { phone: digits.length === 10 ? `91${digits}` : digits } : {}),
            ...(category ? { category } : {}),
            fee: view.fee,
            paid: false,
            status: "requested",
          },
        },
      ]);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };
  return (
    <PublicShell event={view.event} eyebrow={t.stallBooking} preview={preview} {...shell}>
      <p className="m-0 text-[17px]">
        {view.open ? fill(t.stallsOpen, { open: view.open, total: view.total }) : t.stallsTaken}{" "}
        {fill(t.stallFee, { fee: inr(view.fee) })}
      </p>
      {sent ? (
        <Card>
          <p className="m-0 font-serif text-[22px]">{t.stallSent}</p>
        </Card>
      ) : (
        <form
          onSubmit={send}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
          noValidate
        >
          <label htmlFor="stall-name" className="label">
            {t.stallName}
          </label>
          <input
            id="stall-name"
            className="field"
            value={stall}
            maxLength={120}
            onChange={(e) => setStall(e.target.value)}
          />
          <label htmlFor="stall-owner" className="label">
            {t.yourName}
          </label>
          <input
            id="stall-owner"
            className="field"
            value={owner}
            maxLength={80}
            autoComplete="name"
            onChange={(e) => setOwner(e.target.value)}
          />
          <label htmlFor="stall-phone" className="label">
            {t.mobile}
          </label>
          <input
            id="stall-phone"
            className="field"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 14))}
          />
          {view.categories.length > 0 && (
            <>
              <label htmlFor="stall-cat" className="label">
                {t.sells}
              </label>
              <select
                id="stall-cat"
                className="field appearance-auto"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {view.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value="Other">{t.other}</option>
              </select>
            </>
          )}
          {error && (
            <p role="alert" className="m-0 text-sm font-medium text-rust-ink">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !act}>
            {busy ? t.sending : t.requestStall}
          </button>
        </form>
      )}
    </PublicShell>
  );
}

export function GatePage({ view, act, preview }: { view: GateView; act?: Act; preview?: ReactNode }) {
  const { t, shell } = useLinkLang(view.event);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const shown = (
    found
      ? view.passes.filter((p) => p.id === found)
      : view.passes.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
  ).slice(0, 40);
  const set = async (id: string, count: number) => {
    if (!act) return;
    setBusy(id);
    try {
      await act([{ type: "checkIn", coll: "passes", id, fnId: "day", count }]);
    } finally {
      setBusy("");
    }
  };
  const scanned = (text: string) => {
    setScanning(false);
    const pass = view.passes.find((p) => p.id === readPassCode(text));
    if (!pass) {
      setNote(t.notPass);
      return;
    }
    setFound(pass.id);
    setQ("");
    const n = pass.checkedIn || pass.count;
    setNote(fill(t.welcomeIn, { name: pass.name, n }));
    if (!pass.checkedIn) void set(pass.id, pass.count);
  };
  return (
    <PublicShell
      event={view.event}
      eyebrow={t.gate}
      preview={preview}
      {...shell}
      aside={
        <span className="mt-2 font-mono text-[28px] text-white tabular">
          {fill(t.gateCount, { inside: view.inside, issued: view.issued, capacity: view.capacity })}
        </span>
      }
    >
      <label htmlFor="gate-q" className="label">
        {t.findPass}
      </label>
      <div className="flex gap-2">
        <input
          id="gate-q"
          className="field flex-1 text-lg"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFound(null);
            setNote("");
          }}
          placeholder={t.flatOrName}
        />
        {act && detectorClass() && (
          <button type="button" className="btn btn-secondary" onClick={() => setScanning(true)}>
            {t.scanPass}
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="m-0 text-[15px] font-medium text-leaf-ink">
          {note}
        </p>
      )}
      {scanning && (
        <Scanner title={t.scanPass} hint={t.cameraHint} onCode={scanned} onClose={() => setScanning(false)} />
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <span className="flex flex-col">
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-muted">{fill(t.inOf, { c: p.checkedIn, n: p.count })}</span>
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={fill(t.oneLessFor, { name: p.name })}
                disabled={!act || busy === p.id || p.checkedIn <= 0}
                onClick={() => set(p.id, p.checkedIn - 1)}
              >
                −
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                aria-label={fill(t.oneMoreFor, { name: p.name })}
                disabled={!act || busy === p.id || p.checkedIn >= p.count + 2}
                onClick={() => set(p.id, p.checkedIn + 1)}
              >
                {t.oneMore}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </PublicShell>
  );
}
