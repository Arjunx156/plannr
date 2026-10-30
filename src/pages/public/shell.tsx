import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { Logo, SkipLink, Toran } from "../../components/ui";
import { dateRange } from "../../lib/dates";
import { timeAgo } from "../../lib/format";
import { type GuestLang, guestLang, LANG_NAME } from "../../lib/guestText";
import { linkText } from "../../lib/linkText";
import type { PublicBasics } from "../../shared/public";

/** Languages a shared page can switch between. */
const ALL_LANGS: GuestLang[] = ["en", "ml", "hi", "ta"];

/** The language for a helper's or neighbour's page: the family's, else the phone's, else English. */
export function useLinkLang(event: PublicBasics) {
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

export function span(e: PublicBasics): string {
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
    // The page's language, so screen readers pronounce Malayalam, Hindi or Tamil correctly.
    <div className="min-h-dvh bg-paper text-ink" lang={lang ?? event.lang ?? "en"}>
      <SkipLink />
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
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex max-w-[720px] flex-col gap-5 px-4 py-6 outline-none sm:px-5"
      >
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

export function Card({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      {children}
    </section>
  );
}
