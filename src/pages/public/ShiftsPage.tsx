import { type JSX, type ReactNode, useState } from "react";
import { Pill } from "../../components/ui";
import { fill } from "../../lib/guestText";
import { errorMessage } from "../../shared/guards";
import type { ShiftsView } from "../../shared/public";
import { type Act, Card, PublicShell, useLinkLang } from "./shell";

/** The volunteer page: open shifts, and signing up for one. */
export function ShiftsPage({
  view,
  act,
  preview,
}: {
  view: ShiftsView;
  act?: Act | undefined;
  preview?: ReactNode;
}): JSX.Element {
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
      setError(errorMessage(e));
    }
    setBusy("");
  };
  const open = view.roles
    .flatMap((r) => r.slots.map((s, i) => ({ role: r.role, slot: i, s })))
    .filter((x) => x.s.filled < x.s.need);
  return (
    <PublicShell event={view.event} eyebrow={t.signup} preview={preview} {...shell}>
      <p className="m-0 text-[17px]">
        {open.length > 0 ? fill(t.shiftsOpen, { n: open.length }) : t.shiftsFull}
      </p>
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
          <p role="status" className="m-0 text-leaf-ink text-sm">
            {fill(t.youreOn, { list: done.join("; ") })}
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 font-medium text-rust-ink text-sm">
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
                  className="flex flex-wrap items-center justify-between gap-2 border-sand-2 border-t py-2.5 text-sm first:border-0"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{view.slots[i]}</span>
                    <span className="text-muted text-xs">
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
