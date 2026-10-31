import { useState } from "react";
import { Field } from "../../../components/fields";
import type { SiteInfo } from "../../../data/recordTypes";
import type { PlannrEvent } from "../../../data/types";
import { aiWrite } from "../../../lib/ai";
import { LANG_NAME } from "../../../lib/guestText";
import { toast, useStore } from "../../../store/store";
import { Section } from "../layout";

export function Story({
  ev,
  site,
  editable,
  ai,
  onSave,
}: {
  ev: PlannrEvent;
  site: SiteInfo;
  editable: boolean;
  ai: boolean;
  onSave: (p: Partial<SiteInfo>, m?: string) => void;
}) {
  const [story, setStory] = useState(site.story ?? "");
  const [local, setLocal] = useState(site.storyLocal ?? "");
  const [lang, setLang] = useState(site.lang ?? "ml");
  const [busy, setBusy] = useState(false);
  const { dispatch } = useStore();
  const dirty =
    story !== (site.story ?? "") || local !== (site.storyLocal ?? "") || lang !== (site.lang ?? "ml");
  const translate = async () => {
    if (!story.trim()) return;
    setBusy(true);
    const text = await aiWrite({ task: "translate", lang, text: story, context: { event: ev.name } });
    setBusy(false);
    if (text) setLocal(text);
    else dispatch(toast("Couldn't translate just now. Try again, or write it yourself."));
  };
  return (
    <Section title="Your story">
      <Field label="In English" htmlFor="site-story">
        <textarea
          id="site-story"
          className="field min-h-28 py-2.5"
          maxLength={3000}
          value={story}
          disabled={!editable}
          onChange={(e) => setStory(e.target.value)}
          placeholder="How you met, what the days will be like, anything guests should know."
        />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Second language" htmlFor="site-lang">
          <select
            id="site-lang"
            className="field appearance-auto"
            value={lang}
            disabled={!editable}
            onChange={(e) => setLang(e.target.value)}
          >
            {LOCAL_LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAME[l]}
              </option>
            ))}
          </select>
        </Field>
        {ai && editable && (
          <button
            type="button"
            className="btn btn-ai btn-sm"
            disabled={busy || !story.trim()}
            onClick={translate}
          >
            {busy ? "Translating…" : `Translate into ${LANG_NAME[lang as keyof typeof LANG_NAME]}`}
          </button>
        )}
      </div>
      <Field
        label={`In ${LANG_NAME[lang as keyof typeof LANG_NAME] ?? "your language"}`}
        htmlFor="site-story-local"
        hint="Guests switch languages at the top of the page. Have a native speaker read it before you publish."
      >
        <textarea
          id="site-story-local"
          lang={lang}
          className="field min-h-28 py-2.5"
          maxLength={4000}
          value={local}
          disabled={!editable}
          onChange={(e) => setLocal(e.target.value)}
        />
      </Field>
      {editable && (
        <button
          type="button"
          className="btn btn-primary self-start"
          disabled={!dirty}
          onClick={() => onSave({ story: story.trim(), storyLocal: local.trim(), lang }, "Saved the story.")}
        >
          Save story
        </button>
      )}
    </Section>
  );
}

export const LOCAL_LANGS = ["ml", "hi", "ta"] as const;
