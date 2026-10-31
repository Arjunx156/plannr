import { type ReactNode, useState } from "react";
import { type GuestLang, guestLang, guestText } from "../../lib/guestText";
import type { SiteView } from "../../shared/public";
import { CalendarButton } from "./CalendarButton";
import { Card, FunctionFacts, PublicShell } from "./shell";

/** The event's own website: the story, the functions with maps, and a way to answer. */
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
              <FunctionFacts f={f} t={t} />
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
