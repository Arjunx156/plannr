import { type FormEvent, type ReactNode, useState } from "react";
import { QrCode } from "../../components/qr";
import { fill, type GuestLang, type GuestText, guestLang, guestText } from "../../lib/guestText";
import type { RsvpView } from "../../shared/public";
import { CalendarButton } from "./CalendarButton";
import { type Answer, FunctionAnswer, isAnswered } from "./functionAnswer";
import { type Act, Card, PublicShell } from "./shell";

/** What the form starts with: earlier answers, and the invited number for anything unanswered. */
function startingAnswers(h: RsvpView["household"]): Record<string, Answer> {
  return Object.fromEntries(
    h.functions.map((f) => {
      const a = h.rsvp[f];
      return [f, isAnswered(a) ? a : { status: "pending", count: h.expected }];
    }),
  );
}

/** English plus the family's language; the page opens in the household's own language if it has one. */
function rsvpLangs(household?: string, site?: string): { langs: GuestLang[]; initial: GuestLang } {
  const local = guestLang(household ?? site);
  if (!local || local === "en") return { langs: ["en"], initial: "en" };
  return { langs: ["en", local], initial: household === local ? local : "en" };
}

/** Answers as sent: a "no" brings nobody. */
function finalAnswers(answers: Record<string, Answer>): Record<string, Answer> {
  return Object.fromEntries(
    Object.entries(answers).map(([f, a]) => [
      f,
      { status: a.status, count: a.status === "yes" ? a.count : 0 },
    ]),
  );
}

/** The couple's story under the event name, in the guest's language when there is a translation. */
function SiteStory({ site, lang }: { site: NonNullable<RsvpView["site"]>; lang: GuestLang }) {
  return (
    <p className="m-0 mt-2 max-w-[560px] text-[15px] leading-normal text-cream" lang={lang}>
      {lang !== "en" && site.storyLocal ? site.storyLocal : site.story}
    </p>
  );
}

/** After answering: what they said for each function, the calendar, and the entry QR. */
function AnswerSummary({ view, t, onChange }: { view: RsvpView; t: GuestText; onChange: () => void }) {
  const h = view.household;
  return (
    <Card label="Your answer">
      <p className="m-0 font-serif text-[22px] leading-tight">{t.thanks}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
        {view.event.functions.map((f) => {
          const a = h.rsvp[f.id];
          const going = a?.status === "yes";
          return (
            <li key={f.id} className="flex justify-between gap-3 border-t border-sand-2 pt-1.5">
              <span>{f.label}</span>
              <span className={going ? "text-leaf-ink" : "text-body"}>
                {going ? `${t.going} · ${a.count}` : t.cant}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onChange}>
          {t.change}
        </button>
        <CalendarButton view={view} label={t.calendar} />
      </div>
      {view.entry && (
        <div className="flex items-center gap-3 border-t border-sand-2 pt-3">
          <QrCode text={view.entry} size={112} label={t.entry} />
          <span className="text-sm text-body">{t.entry}</span>
        </div>
      )}
    </Card>
  );
}

type Household = RsvpView["household"];

interface Extras {
  meal: Household["meal"];
  stay: boolean;
  pickupOn: boolean;
  pickup: string;
  note: string;
}

const extrasFor = (h: Household): Extras => ({
  meal: h.meal,
  stay: !!h.stay,
  pickupOn: !!h.pickup,
  pickup: h.pickup ?? "",
  note: h.note ?? "",
});

/** The household's answer as one action: a pickup left unticked sends none, notes go trimmed. */
function rsvpAction(answers: Record<string, Answer>, x: Extras) {
  return {
    type: "rsvp",
    householdId: "self",
    answers: finalAnswers(answers),
    meal: x.meal,
    stay: x.stay,
    pickup: x.pickupOn ? x.pickup.trim() : "",
    note: x.note.trim(),
  };
}

/** The answers being edited and sending them; nothing goes while a function is unanswered. */
function useRsvpForm(h: Household, t: GuestText, act: Act | undefined, onSent: () => void) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => startingAnswers(h));
  const [extras, setExtras] = useState(() => extrasFor(h));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (Object.values(answers).some((a) => a.status === "pending")) {
      setError(t.answerAll);
      return;
    }
    if (!act) return;
    setBusy(true);
    setError("");
    try {
      await act([rsvpAction(answers, extras)]);
      onSent();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const answer = (fnId: string, next: Answer) => setAnswers((all) => ({ ...all, [fnId]: next }));
  const patch = (p: Partial<Extras>) => setExtras((x) => ({ ...x, ...p }));
  return { answers, extras, busy, error, send, answer, patch };
}

/** A household's RSVP page: who is coming to which function, meals and stay needs. */
export function RsvpPage({ view, act, preview }: { view: RsvpView; act?: Act; preview?: ReactNode }) {
  const h = view.household;
  const { langs, initial } = rsvpLangs(h.lang, view.site?.lang);
  const [lang, setLang] = useState<GuestLang>(initial);
  const t = guestText(lang);
  const [editing, setEditing] = useState(() => !h.functions.some((f) => isAnswered(h.rsvp[f])));
  const form = useRsvpForm(h, t, act, () => setEditing(false));
  const fns = view.event.functions;
  const n = fns.length === 1 ? t.oneFunction : fill(t.functions, { n: fns.length });

  return (
    <PublicShell
      event={view.event}
      eyebrow={t.invited}
      lang={lang}
      langs={langs}
      onLang={setLang}
      preview={preview}
      aside={view.site?.story && <SiteStory site={view.site} lang={lang} />}
    >
      <p className="m-0 text-[17px] leading-normal">
        {fill(t.namaste, { name: h.name })} {fill(t.invitedTo, { n })}
      </p>
      {!editing ? (
        <AnswerSummary view={view} t={t} onChange={() => setEditing(true)} />
      ) : (
        <form onSubmit={form.send} className="flex flex-col gap-4" noValidate>
          {fns.map((f) => (
            <FunctionAnswer
              key={f.id}
              fn={f}
              answer={form.answers[f.id] ?? { status: "pending", count: h.expected }}
              invited={h.expected}
              t={t}
              onChange={(next) => form.answer(f.id, next)}
            />
          ))}
          <ExtrasCard extras={form.extras} t={t} onChange={form.patch} />
          {form.error && (
            <p role="alert" className="m-0 text-sm font-medium text-rust-ink">
              {form.error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={form.busy || !act}>
            {form.busy ? t.sending : t.send}
          </button>
        </form>
      )}
    </PublicShell>
  );
}

/** Meal, a room, a pickup and a note for the family. */
function ExtrasCard({
  extras,
  t,
  onChange,
}: {
  extras: Extras;
  t: GuestText;
  onChange: (p: Partial<Extras>) => void;
}) {
  return (
    <Card>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label mb-1">{t.meal}</legend>
        <div className="flex flex-wrap gap-2">
          {(["veg", "nonveg", "jain"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={extras.meal === m}
              className="chip"
              onClick={() => onChange({ meal: m })}
            >
              {t[m]}
            </button>
          ))}
        </div>
      </fieldset>
      <Toggle label={t.room} checked={extras.stay} onChange={(stay) => onChange({ stay })} />
      <Toggle label={t.pickup} checked={extras.pickupOn} onChange={(pickupOn) => onChange({ pickupOn })} />
      {extras.pickupOn && (
        <input
          aria-label={t.pickupHint}
          className="field"
          value={extras.pickup}
          maxLength={160}
          onChange={(e) => onChange({ pickup: e.target.value })}
          placeholder={t.pickupHint}
        />
      )}
      <label htmlFor="rsvp-note" className="label">
        {t.note}
      </label>
      <textarea
        id="rsvp-note"
        className="field min-h-20 py-2.5"
        value={extras.note}
        maxLength={500}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder={t.notePlaceholder}
      />
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-[15px]">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[var(--color-leaf)]"
      />
    </label>
  );
}
