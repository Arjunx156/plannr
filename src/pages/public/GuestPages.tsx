import { type FormEvent, type ReactNode, useState } from "react";
import { QrCode } from "../../components/qr";
import { longDate } from "../../lib/dates";
import { fill, type GuestLang, type GuestText, guestLang, guestText } from "../../lib/guestText";
import { downloadIcs, mapLink } from "../../lib/ics";
import type { AlbumView, PublicBasics, RsvpView, SiteView } from "../../shared/public";
import { type Act, Card, PublicShell, useLinkLang } from "./shell";

/** One household's answer for one function. */
type Answer = { status: "pending" | "yes" | "no"; count: number };

/** A household may bring up to two more people than were invited. */
const EXTRA_GUESTS = 2;

const isAnswered = (a: Answer | undefined): a is Answer => !!a && a.status !== "pending";

/** What the form starts with: earlier answers, and the invited number for anything unanswered. */
function startingAnswers(h: RsvpView["household"]): Record<string, Answer> {
  return Object.fromEntries(
    h.functions.map((f) => {
      const a = h.rsvp[f];
      return [f, isAnswered(a) ? a : { status: "pending", count: h.expected }];
    }),
  );
}

/** One function on the RSVP form: when and where, then going (and how many) or can't come. */
function FunctionAnswer({
  fn: f,
  answer: a,
  invited,
  t,
  onChange,
}: {
  fn: PublicBasics["functions"][number];
  answer: Answer;
  /** How many of this household were invited. */
  invited: number;
  t: GuestText;
  onChange: (next: Answer) => void;
}) {
  const set = (patch: Partial<Answer>) => onChange({ ...a, ...patch });
  const most = invited + EXTRA_GUESTS;
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
      <legend className="sr-only">{f.label}</legend>
      <div className="flex flex-col gap-0.5">
        <span className="font-serif text-[22px] leading-tight">{f.label}</span>
        <span className="text-sm text-body">
          {longDate(f.date)}
          {f.time ? ` · ${f.time}` : ""}
        </span>
        {f.place && (
          <a
            href={mapLink(f.address ?? f.place)}
            target="_blank"
            rel="noopener noreferrer"
            className="link text-sm"
          >
            {f.place} · {t.map}
          </a>
        )}
        {f.dress && (
          <span className="text-xs text-muted">
            {t.dress}: {f.dress}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1fr_88px] gap-2">
        <button
          type="button"
          aria-pressed={a.status === "yes"}
          onClick={() => set({ status: "yes", count: a.count || invited })}
          className={`min-h-11 rounded-lg border text-sm font-semibold ${a.status === "yes" ? "border-leaf bg-leaf-tint text-leaf-ink" : "border-line-2"}`}
        >
          {a.status === "yes" ? "✓ " : ""}
          {t.going}
        </button>
        <button
          type="button"
          aria-pressed={a.status === "no"}
          onClick={() => set({ status: "no" })}
          className={`min-h-11 rounded-lg border text-sm font-semibold ${a.status === "no" ? "border-line-2 bg-sand" : "border-line-2"}`}
        >
          {t.cant}
        </button>
        <label className="sr-only" htmlFor={`count-${f.id}`}>
          {t.howMany} {f.label}
        </label>
        <select
          id={`count-${f.id}`}
          className="field min-h-11 appearance-auto py-0"
          disabled={a.status !== "yes"}
          value={a.count}
          onChange={(e) => set({ count: Number(e.target.value) })}
        >
          {Array.from({ length: most }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
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

/** A household's RSVP page: who is coming to which function, meals and stay needs. */
export function RsvpPage({ view, act, preview }: { view: RsvpView; act?: Act; preview?: ReactNode }) {
  const h = view.household;
  const { langs, initial } = rsvpLangs(h.lang, view.site?.lang);
  const [lang, setLang] = useState<GuestLang>(initial);
  const t = guestText(lang);
  const answered = h.functions.some((f) => isAnswered(h.rsvp[f]));
  const [editing, setEditing] = useState(!answered);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => startingAnswers(h));
  const [meal, setMeal] = useState(h.meal);
  const [stay, setStay] = useState(!!h.stay);
  const [pickupOn, setPickupOn] = useState(!!h.pickup);
  const [pickup, setPickup] = useState(h.pickup ?? "");
  const [note, setNote] = useState(h.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fns = view.event.functions;
  const n = fns.length === 1 ? t.oneFunction : fill(t.functions, { n: fns.length });

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
      await act([
        {
          type: "rsvp",
          householdId: "self",
          answers: finalAnswers(answers),
          meal,
          stay,
          pickup: pickupOn ? pickup.trim() : "",
          note: note.trim(),
        },
      ]);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

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
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          {fns.map((f) => (
            <FunctionAnswer
              key={f.id}
              fn={f}
              answer={answers[f.id] ?? { status: "pending", count: h.expected }}
              invited={h.expected}
              t={t}
              onChange={(next) => setAnswers((all) => ({ ...all, [f.id]: next }))}
            />
          ))}
          <Card>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="label mb-1">{t.meal}</legend>
              <div className="flex flex-wrap gap-2">
                {(["veg", "nonveg", "jain"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={meal === m}
                    className="chip"
                    onClick={() => setMeal(m)}
                  >
                    {t[m]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center justify-between gap-3 text-[15px]">
              {t.room}
              <input
                type="checkbox"
                checked={stay}
                onChange={(e) => setStay(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-leaf)]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[15px]">
              {t.pickup}
              <input
                type="checkbox"
                checked={pickupOn}
                onChange={(e) => setPickupOn(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-leaf)]"
              />
            </label>
            {pickupOn && (
              <input
                aria-label={t.pickupHint}
                className="field"
                value={pickup}
                maxLength={160}
                onChange={(e) => setPickup(e.target.value)}
                placeholder={t.pickupHint}
              />
            )}
            <label htmlFor="rsvp-note" className="label">
              {t.note}
            </label>
            <textarea
              id="rsvp-note"
              className="field min-h-20 py-2.5"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
            />
          </Card>
          {error && (
            <p role="alert" className="m-0 text-sm font-medium text-rust-ink">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !act}>
            {busy ? t.sending : t.send}
          </button>
        </form>
      )}
    </PublicShell>
  );
}

function CalendarButton({ view, label }: { view: { event: PublicBasics }; label: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() =>
        downloadIcs(
          view.event.name,
          view.event.functions.map((f) => ({
            id: `${view.event.name}-${f.id}`,
            title: `${f.label} · ${view.event.name}`,
            date: f.date,
            time: f.time,
            place: f.address ?? f.place,
          })),
        )
      }
    >
      {label}
    </button>
  );
}

export function SitePage({ view, preview }: { view: SiteView; preview?: ReactNode }) {
  const local = guestLang(view.site.lang);
  const langs: GuestLang[] = local && local !== "en" && view.site.storyLocal ? ["en", local] : ["en"];
  const [lang, setLang] = useState<GuestLang>("en");
  const t = guestText(lang);
  const story = lang !== "en" && view.site.storyLocal ? view.site.storyLocal : view.site.story;
  return (
    <PublicShell
      event={view.event}
      eyebrow={t.invited}
      lang={lang}
      langs={langs}
      onLang={setLang}
      preview={preview}
    >
      {story && (
        <Card label={t.story}>
          <h2 className="font-serif text-[24px]">{t.story}</h2>
          <p className="m-0 text-[16px] leading-relaxed text-body" lang={lang}>
            {story}
          </p>
        </Card>
      )}
      <Card label={t.schedule}>
        <h2 className="font-serif text-[24px]">{t.schedule}</h2>
        <ol className="m-0 flex list-none flex-col p-0">
          {view.event.functions.map((f, i) => (
            <li key={f.id} className={`flex flex-col gap-0.5 py-3 ${i ? "border-t border-sand-2" : ""}`}>
              <span className="font-serif text-[20px]">{f.label}</span>
              <span className="text-sm text-body">
                {longDate(f.date)}
                {f.time ? ` · ${f.time}` : ""}
              </span>
              {f.place && (
                <a
                  href={mapLink(f.address ?? f.place)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link text-sm"
                >
                  {f.place} · {t.map}
                </a>
              )}
              {f.dress && (
                <span className="text-xs text-muted">
                  {t.dress}: {f.dress}
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <CalendarButton view={view} label={t.calendar} />
        </div>
      </Card>
      {!!view.site.faqs?.length && (
        <Card label={t.questions}>
          <h2 className="font-serif text-[24px]">{t.questions}</h2>
          <dl className="m-0 flex flex-col gap-3">
            {view.site.faqs.map((f) => (
              <div key={f.q} className="flex flex-col gap-0.5">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="m-0 text-body">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      <p className="m-0 text-center text-sm text-muted">{t.rsvpNote}</p>
    </PublicShell>
  );
}

export function AlbumPage({
  view,
  upload,
  preview,
}: {
  view: AlbumView;
  upload?: (file: File, by: string, caption: string) => Promise<void>;
  preview?: ReactNode;
}) {
  const { t, shell } = useLinkLang(view.event);
  const [by, setBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !upload) return;
    if (by.trim().length < 2) {
      setError(t.albumName);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await upload(file, by.trim(), "");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <PublicShell event={view.event} eyebrow={t.album} preview={preview} {...shell}>
      <Card label={t.addPhoto}>
        <label htmlFor="album-by" className="label">
          {t.yourName}
        </label>
        <input
          id="album-by"
          className="field"
          value={by}
          maxLength={80}
          autoComplete="name"
          onChange={(e) => setBy(e.target.value)}
        />
        <label
          className={`btn btn-primary self-start ${!upload || busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? t.uploading : t.addPhoto}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={!upload || busy}
            onChange={(e) => pick(e.target.files)}
          />
        </label>
        {!upload && <span className="text-xs text-muted">{t.albumClosed}</span>}
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-rust-ink">
            {error}
          </p>
        )}
      </Card>
      {view.photos.length ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
          {view.photos.map((p) => (
            <li key={p.id} className="flex flex-col gap-1">
              <img
                src={p.url}
                alt={p.caption || `Photo from ${p.by}`}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
              <span className="text-xs text-muted">{p.by}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-center text-sm text-muted">{t.noPhotos}</p>
      )}
    </PublicShell>
  );
}
