import { useState } from "react";
import { addOnce, type StepProps } from "./fields";

/** An Indian mobile number (ten digits from 6–9) or an email address. */
function isContact(v: string): boolean {
  return /^[6-9]\d{9}$/.test(v.replace(/\D/g, "")) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
export function CoPlannersStep({ p, set }: StepProps) {
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex max-w-[560px] flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = invite.trim();
          if (!isContact(v)) {
            setError("Enter a 10-digit mobile number or an email address.");
            return;
          }
          setError("");
          set({ coPlanners: addOnce(p.coPlanners, v) });
          setInvite("");
        }}
      >
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <label htmlFor="invite" className="label">
            Mobile number or email
          </label>
          <input
            id="invite"
            className="field"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="98470 55555 or rohan@example.com"
            aria-invalid={!!error}
            aria-describedby={error ? "invite-error" : undefined}
          />
        </div>
        <button type="submit" className="btn btn-secondary btn-lg">
          Add co-planner
        </button>
      </form>
      {error && (
        <p id="invite-error" role="alert" className="m-0 text-[13px] text-rust-ink">
          {error}
        </p>
      )}
      {p.coPlanners.length > 0 ? (
        <ul className="m-0 flex max-w-[560px] list-none flex-col p-0">
          {p.coPlanners.map((c) => (
            <li key={c} className="flex items-center justify-between border-t border-sand-2 py-2.5 text-sm">
              <span>{c}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => set({ coPlanners: p.coPlanners.filter((x) => x !== c) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted">
          No co-planners yet. You can invite people any time from the dashboard.
        </p>
      )}
    </div>
  );
}
