import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { useEditable } from "../../components/tasks";
import { Field } from "../../components/ui";
import type { PlannrEvent, SiteInfo } from "../../data/types";
import { aiEnabled, aiWrite } from "../../lib/ai";
import { api, publicUrl } from "../../lib/api";
import { longDate } from "../../lib/dates";
import { timeAgo } from "../../lib/format";
import { LANG_NAME } from "../../lib/guestText";
import { functionsOf, list } from "../../shared/records";
import { toast, useStore } from "../../store/store";
import { newId, Section, ShareLink, TabPage } from "./common";

const LOCAL_LANGS = ["ml", "hi", "ta"] as const;

/** The event website: what guests read before the day, in the family's languages. */
export function SiteTab({ ev }: { ev: PlannrEvent }) {
  const { state, dispatch } = useStore();
  const editable = useEditable(ev);
  const site: SiteInfo = (ev.layout !== "empty" && ev.site) || { published: false };
  const fns = functionsOf(ev);
  const account = state.mode === "account";
  const [address, setAddress] = useState<string>();
  const [ai, setAi] = useState(false);
  useEffect(() => {
    aiEnabled().then(setAi);
  }, []);

  useEffect(() => {
    if (!account || !site.published) return;
    let live = true;
    api
      .linkFor(ev.id, "site")
      .then((l) => live && setAddress(publicUrl("site", l.token)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [account, ev.id, site.published]);

  const save = (patch: Partial<SiteInfo>, message?: string) => {
    dispatch({ type: "updateEvent", eventId: ev.id, patch: { site: { ...site, ...patch } } });
    if (message) dispatch(toast(message));
  };

  return (
    <TabPage
      eyebrow={ev.name}
      title="Website"
      aside={
        editable && (
          <button
            type="button"
            className={`btn ${site.published ? "btn-secondary" : "btn-primary"}`}
            onClick={() =>
              save(
                { published: !site.published },
                site.published
                  ? "The website is offline."
                  : "The website is live. Share it with your guests.",
              )
            }
          >
            {site.published ? "Take offline" : "Publish the website"}
          </button>
        )
      }
    >
      <Section
        title={site.published ? "Live" : "Not published yet"}
        aside={
          site.published && (
            <ShareLink
              ev={ev}
              kind="site"
              label="Share"
              message={`${ev.name}: the schedule, venues and everything you need to know.`}
            />
          )
        }
      >
        <p className="m-0 text-sm text-body">
          {site.published
            ? "Anyone with the address can read it: your story, the schedule, venues with maps and answers to common questions. Family-only functions stay off it, and RSVPs come through each household's own link."
            : "Write your story and check the schedule below, then publish. Nothing is public until you do."}
        </p>
        {address && <SiteAddress ev={ev} address={address} onChange={setAddress} editable={editable} />}
        {!account && (
          <p className="m-0 text-xs text-muted">
            In the demo the website opens as a preview. With an account it gets its own address, like
            plannr.app/e/ananya-rohan.
          </p>
        )}
      </Section>

      <Story ev={ev} site={site} editable={editable} ai={ai} onSave={save} />

      <Section title="Schedule on the website">
        <ul className="m-0 flex list-none flex-col p-0">
          {fns.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span className="flex flex-col">
                <span className="font-semibold">{f.label}</span>
                <span className="text-xs text-muted">
                  {longDate(f.date)}
                  {f.time ? ` · ${f.time}` : ""}
                  {f.place ? ` · ${f.place}` : ""}
                </span>
              </span>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-leaf)]"
                  checked={!f.private}
                  disabled={!editable}
                  onChange={(e) =>
                    dispatch({
                      type: "updateRecord",
                      eventId: ev.id,
                      coll: "functions",
                      id: f.id,
                      patch: { private: !e.target.checked },
                    })
                  }
                />
                {f.private ? "Family only" : "On the website"}
              </label>
            </li>
          ))}
        </ul>
        <span className="text-xs text-muted">
          Change dates, venues and dress codes in{" "}
          <Link to={`/events/${ev.id}/settings`} className="link">
            Settings
          </Link>
          .
        </span>
      </Section>

      <Faqs site={site} editable={editable} onSave={save} />
      <Updates ev={ev} editable={editable} />

      <Section title="Search engines">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-leaf)]"
            checked={!!site.indexable}
            disabled={!editable}
            onChange={(e) => save({ indexable: e.target.checked })}
          />
          Let Google list the website. Leave this off unless you want strangers to find it.
        </label>
      </Section>
    </TabPage>
  );
}

function SiteAddress({
  ev,
  address,
  onChange,
  editable,
}: {
  ev: PlannrEvent;
  address: string;
  onChange: (a: string) => void;
  editable: boolean;
}) {
  const { dispatch } = useStore();
  const slug = address.split("/e/")[1] ?? "";
  const [draft, setDraft] = useState(slug);
  const [busy, setBusy] = useState(false);
  const rename = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const l = await api.renameSite(ev.id, draft);
      onChange(publicUrl("site", l.token));
      setDraft(l.token);
      dispatch(toast("Address changed. The old one no longer works."));
    } catch (err) {
      dispatch(toast((err as Error).message));
    }
    setBusy(false);
  };
  return (
    <form onSubmit={rename} className="flex flex-wrap items-end gap-2">
      <Field label="Address" htmlFor="site-slug">
        <span className="field gap-1 font-mono text-xs">
          <span className="text-muted">{address.split("/e/")[0]}/e/</span>
          <input
            id="site-slug"
            className="min-w-0 flex-1 bg-transparent outline-none"
            value={draft}
            disabled={!editable}
            onChange={(e) => setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          />
        </span>
      </Field>
      {editable && draft !== slug && (
        <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || draft.length < 3}>
          Change address
        </button>
      )}
      <a href={address} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
        Open
      </a>
    </form>
  );
}

function Story({
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

function Faqs({
  site,
  editable,
  onSave,
}: {
  site: SiteInfo;
  editable: boolean;
  onSave: (p: Partial<SiteInfo>, m?: string) => void;
}) {
  const faqs = site.faqs ?? [];
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim() || !a.trim()) return;
    onSave({ faqs: [...faqs, { q: q.trim(), a: a.trim() }] }, "Added the question.");
    setQ("");
    setA("");
  };
  return (
    <Section title="Questions guests ask">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {faqs.map((f, i) => (
          <li
            key={f.q}
            className="flex items-start justify-between gap-3 border-t border-sand-2 pt-2.5 first:border-0 first:pt-0"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{f.q}</span>
              <span className="text-sm text-body">{f.a}</span>
            </div>
            {editable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-rust-ink"
                aria-label={`Remove “${f.q}”`}
                onClick={() => onSave({ faqs: faqs.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {!faqs.length && (
          <li className="text-sm text-muted">Parking, dress code, children, gifts: answer them once here.</li>
        )}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex flex-col gap-2">
          <label htmlFor="faq-q" className="sr-only">
            Question
          </label>
          <input
            id="faq-q"
            className="field"
            placeholder="Question"
            value={q}
            maxLength={200}
            onChange={(e) => setQ(e.target.value)}
          />
          <label htmlFor="faq-a" className="sr-only">
            Answer
          </label>
          <textarea
            id="faq-a"
            className="field min-h-16 py-2"
            placeholder="Answer"
            value={a}
            maxLength={1000}
            onChange={(e) => setA(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-secondary btn-sm self-start"
            disabled={!q.trim() || !a.trim()}
          >
            Add question
          </button>
        </form>
      )}
    </Section>
  );
}

/** Notes for guests that show at the top of the website and every RSVP page. */
export function Updates({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const items = list(ev, "announcements").slice().reverse();
  const [text, setText] = useState("");
  const post = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "announcements",
      record: { id: newId("an"), at: "", text: clean },
    });
    dispatch(toast("Posted. Guests see it at the top of their pages."));
    setText("");
  };
  return (
    <Section title="Updates for guests">
      {editable && (
        <form onSubmit={post} className="flex flex-col gap-2">
          <label htmlFor="update-text" className="sr-only">
            Update
          </label>
          <textarea
            id="update-text"
            className="field min-h-16 py-2"
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buses to the reception leave at 6:15 pm from the main gate."
          />
          <button type="submit" className="btn btn-secondary btn-sm self-start" disabled={!text.trim()}>
            Post update
          </button>
        </form>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-start justify-between gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
            <span className="flex flex-col">
              <span>{a.text}</span>
              <span className="text-xs text-muted">{a.at ? timeAgo(a.at) : ""}</span>
            </span>
            {editable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  dispatch({ type: "removeRecord", eventId: ev.id, coll: "announcements", id: a.id })
                }
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {!items.length && <li className="text-sm text-muted">No updates yet.</li>}
      </ul>
    </Section>
  );
}
