import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router";
import { QrCode } from "../../components/qr";
import { detectorClass, Scanner } from "../../components/scanner";
import { Logo, Pill, Toran } from "../../components/ui";
import { dateRange, dueLabel, longDate } from "../../lib/dates";
import { inr, timeAgo } from "../../lib/format";
import { fill, type GuestLang, guestLang, guestText, LANG_NAME } from "../../lib/guestText";
import { downloadIcs, mapLink } from "../../lib/ics";
import { linkText } from "../../lib/linkText";
import type {
  AlbumView,
  FundView,
  GateView,
  HelperView,
  PublicBasics,
  PublicView,
  RsvpView,
  ShiftsView,
  SiteView,
  StallsView,
  VendorView,
} from "../../shared/public";
import { readPassCode } from "../../shared/public";

const ALL_LANGS: GuestLang[] = ["en", "ml", "hi", "ta"];

/** The language for a helper's or neighbour's page: the family's, else the phone's, else English. */
function useLinkLang(event: PublicBasics) {
  const [lang, setLang] = useState<GuestLang>(() => {
    const phone = typeof navigator === "undefined" ? undefined : guestLang(navigator.language?.slice(0, 2));
    return guestLang(event.lang) ?? phone ?? "en";
  });
  return { t: linkText(lang), shell: { lang, langs: ALL_LANGS, onLang: setLang } };
}

/** Sends changes from a shared page and resolves when they're saved. */
export type Act = (actions: unknown[]) => Promise<void>;

const HERO: Record<PublicBasics["hue"], string> = {
  marigold: "bg-maroon",
  maroon: "bg-maroon",
  indigo: "bg-[#2f3d73]",
  leaf: "bg-leaf-deep",
};

function span(e: PublicBasics): string {
  const dates = e.functions.map((f) => f.date).sort();
  return dateRange(dates[0] ?? e.date, dates[dates.length - 1] ?? e.date);
}

export function PublicShell({
  event,
  eyebrow,
  children,
  aside,
  lang,
  langs,
  onLang,
  preview,
}: {
  event: PublicBasics;
  eyebrow: string;
  children: ReactNode;
  aside?: ReactNode;
  lang?: GuestLang;
  langs?: GuestLang[];
  onLang?: (l: GuestLang) => void;
  preview?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      {preview}
      <header className={`on-dark relative overflow-hidden ${HERO[event.hue]} text-cream`}>
        <Toran size="md" className="relative" />
        <div className="relative mx-auto flex max-w-[720px] flex-col gap-2 px-5 pt-8 pb-9">
          {langs && langs.length > 1 && onLang && (
            <fieldset className="absolute top-4 right-5 m-0 flex gap-1 border-0 p-0">
              <legend className="sr-only">Language</legend>
              {langs.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => onLang(l)}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${lang === l ? "border-gold-soft bg-gold-soft text-maroon-deep" : "border-[rgba(241,217,166,.5)] text-gold-soft"}`}
                >
                  {LANG_NAME[l]}
                </button>
              ))}
            </fieldset>
          )}
          <span className="eyebrow text-gold-soft">{eyebrow}</span>
          <h1 className="font-serif text-[clamp(34px,8vw,52px)] leading-[1.02] text-white">{event.name}</h1>
          <span className="text-[15px] text-gold-soft">{span(event)}</span>
          {aside}
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[720px] flex-col gap-5 px-4 py-6 sm:px-5">
        {event.announcements.length > 0 && <Announcements items={event.announcements} />}
        {children}
      </main>
      <footer className="mx-auto flex max-w-[720px] flex-col items-center gap-2 px-5 pt-4 pb-10 text-center">
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">Made with</span>
        <Logo to="/" />
        <Link to="/" className="link text-xs text-muted">
          Plan your own celebration
        </Link>
      </footer>
    </div>
  );
}

function Announcements({ items }: { items: PublicBasics["announcements"] }) {
  return (
    <section
      aria-label="Updates"
      className="flex flex-col gap-2 rounded-2xl border border-amber-line bg-cream p-4"
    >
      {items.map((a) => (
        <p key={a.id} className="m-0 flex flex-col gap-0.5 text-[15px] text-amber-ink">
          <span>{a.text}</span>
          <span className="text-xs opacity-80">{timeAgo(a.at)}</span>
        </p>
      ))}
    </section>
  );
}

function Card({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- RSVP

type Answer = { status: "pending" | "yes" | "no"; count: number };

export function RsvpPage({ view, act, preview }: { view: RsvpView; act?: Act; preview?: ReactNode }) {
  const h = view.household;
  const local = guestLang(h.lang ?? view.site?.lang);
  const langs: GuestLang[] = local && local !== "en" ? ["en", local] : ["en"];
  const [lang, setLang] = useState<GuestLang>(local && h.lang === local ? local : "en");
  const t = guestText(lang);
  const answered = h.functions.some((f) => h.rsvp[f]?.status && h.rsvp[f]?.status !== "pending");
  const [editing, setEditing] = useState(!answered);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(
      h.functions.map((f) => [
        f,
        h.rsvp[f]?.status === "pending" || !h.rsvp[f]
          ? { status: "pending", count: h.expected }
          : (h.rsvp[f] as Answer),
      ]),
    ),
  );
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
          answers: Object.fromEntries(
            Object.entries(answers).map(([f, a]) => [
              f,
              { status: a.status, count: a.status === "yes" ? a.count : 0 },
            ]),
          ),
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
      aside={
        view.site?.story && (
          <p
            className="m-0 mt-2 max-w-[560px] text-[15px] leading-normal text-cream"
            lang={lang === "en" ? "en" : lang}
          >
            {lang !== "en" && view.site.storyLocal ? view.site.storyLocal : view.site.story}
          </p>
        )
      }
    >
      <p className="m-0 text-[17px] leading-normal">
        {fill(t.namaste, { name: h.name })} {fill(t.invitedTo, { n })}
      </p>
      {!editing ? (
        <Card label="Your answer">
          <p className="m-0 font-serif text-[22px] leading-tight">{t.thanks}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
            {fns.map((f) => {
              const a = h.rsvp[f.id];
              return (
                <li key={f.id} className="flex justify-between gap-3 border-t border-sand-2 pt-1.5">
                  <span>{f.label}</span>
                  <span className={a?.status === "yes" ? "text-leaf-ink" : "text-body"}>
                    {a?.status === "yes" ? `${t.going} · ${a.count}` : t.cant}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
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
      ) : (
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          {fns.map((f) => {
            const a = answers[f.id] ?? { status: "pending", count: h.expected };
            const set = (patch: Partial<Answer>) =>
              setAnswers((all) => ({ ...all, [f.id]: { ...a, ...patch } }));
            return (
              <fieldset
                key={f.id}
                className="m-0 flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4"
              >
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
                      rel="noreferrer"
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
                    onClick={() => set({ status: "yes", count: a.count || h.expected })}
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
                    {Array.from({ length: h.expected + 2 }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>
            );
          })}
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

// ---------------------------------------------------------------- website

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
                  rel="noreferrer"
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

// ---------------------------------------------------------------- helper

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
        {fill(t.helperHello, { name: view.helper })}{" "}
        {open.length
          ? open.length === 1
            ? t.helperOne
            : fill(t.helperMany, { n: open.length })
          : t.helperDone}
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

// ---------------------------------------------------------------- vendor

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
                  <a href={mapLink(a.place)} target="_blank" rel="noreferrer" className="link text-sm">
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

// ---------------------------------------------------------------- shifts

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

// ---------------------------------------------------------------- fund report

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

// ---------------------------------------------------------------- stalls

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

// ---------------------------------------------------------------- album

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

// ---------------------------------------------------------------- gate

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

export function viewPage(
  view: PublicView,
  act?: Act,
  preview?: ReactNode,
  upload?: Parameters<typeof AlbumPage>[0]["upload"],
) {
  switch (view.kind) {
    case "rsvp":
      return <RsvpPage view={view} act={act} preview={preview} />;
    case "site":
      return <SitePage view={view} preview={preview} />;
    case "helper":
      return <HelperPage view={view} act={act} preview={preview} />;
    case "vendor":
      return <VendorPage view={view} preview={preview} />;
    case "shifts":
      return <ShiftsPage view={view} act={act} preview={preview} />;
    case "fund":
      return <FundPage view={view} preview={preview} />;
    case "stalls":
      return <StallsPage view={view} act={act} preview={preview} />;
    case "album":
      return <AlbumPage view={view} upload={upload} preview={preview} />;
    case "gate":
      return <GatePage view={view} act={act} preview={preview} />;
  }
}
