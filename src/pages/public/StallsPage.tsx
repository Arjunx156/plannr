import { type FormEvent, type ReactNode, useState } from "react";
import { Field, TextField } from "../../components/fields";
import { inr } from "../../lib/format";
import { fill } from "../../lib/guestText";
import type { LinkText } from "../../lib/linkText/en";
import type { StallsView } from "../../shared/public";
import { type Act, Card, PublicShell, useLinkLang } from "./shell";

type StallForm = { stall: string; owner: string; phone: string; category: string };

/** Digits in an Indian mobile number, without the country code. */
const MOBILE_DIGITS = 10;

/** Why the stall request can't be sent yet, in the stallholder's language. */
function stallProblem(form: StallForm, t: LinkText): string | undefined {
  if (!form.stall.trim() || !form.owner.trim()) return t.stallNeedNames;
  const digits = form.phone.replace(/\D/g, "");
  return digits && digits.length < MOBILE_DIGITS ? t.stallPhone : undefined;
}

/** The stall request as sent. The server sets the fee and status again, whatever arrives. */
function stallRequest(form: StallForm, fee: number) {
  const digits = form.phone.replace(/\D/g, "");
  // A bare ten-digit number gets India's country code, so WhatsApp links work.
  const phone = digits.length === MOBILE_DIGITS ? `91${digits}` : digits;
  return {
    id: "new",
    name: form.stall.trim(),
    owner: form.owner.trim(),
    ...(phone && { phone }),
    ...(form.category && { category: form.category }),
    fee,
    paid: false,
    status: "requested" as const,
  };
}

/** A stallholder's page: how many stalls are left, the fee, and a request form. */
export function StallsPage({ view, act, preview }: { view: StallsView; act?: Act; preview?: ReactNode }) {
  const { t, shell } = useLinkLang(view.event);
  const [sent, setSent] = useState(false);
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
        <StallRequest view={view} act={act} t={t} onSent={() => setSent(true)} />
      )}
    </PublicShell>
  );
}

interface RequestProps {
  view: StallsView;
  act?: Act;
  t: LinkText;
  onSent: () => void;
}

function StallRequest({ view, act, t, onSent }: RequestProps) {
  const [form, setForm] = useState<StallForm>({
    stall: "",
    owner: "",
    phone: "",
    category: view.categories[0] ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof StallForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const problem = stallProblem(form, t);
    if (problem) {
      setError(problem);
      return;
    }
    if (!act) return;
    setBusy(true);
    setError("");
    try {
      await act([{ type: "addRecord", coll: "stalls", record: stallRequest(form, view.fee) }]);
      onSent();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };
  return (
    <form
      onSubmit={send}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
      noValidate
    >
      <TextField
        id="stall-name"
        label={t.stallName}
        value={form.stall}
        maxLength={120}
        onChange={set("stall")}
      />
      <TextField
        id="stall-owner"
        label={t.yourName}
        value={form.owner}
        maxLength={80}
        autoComplete="name"
        onChange={set("owner")}
      />
      <TextField
        id="stall-phone"
        label={t.mobile}
        inputMode="numeric"
        autoComplete="tel-national"
        value={form.phone}
        onChange={(v) => set("phone")(v.replace(/[^\d ]/g, "").slice(0, 14))}
      />
      {view.categories.length > 0 && (
        <Field label={t.sells} htmlFor="stall-cat">
          <select
            id="stall-cat"
            className="field appearance-auto"
            value={form.category}
            onChange={(e) => set("category")(e.target.value)}
          >
            {view.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
            <option value="Other">{t.other}</option>
          </select>
        </Field>
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
  );
}
