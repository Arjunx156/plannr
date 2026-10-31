import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { useEditable } from "../../components/taskHooks";
import { useAiOn } from "../../components/useAiOn";
import type { SiteInfo } from "../../data/recordTypes";
import type { PlannrEvent } from "../../data/types";
import { api, publicUrl } from "../../lib/api";
import { dayLine } from "../../lib/dates";
import { functionsOf } from "../../shared/eventLists";
import { toast, useStore } from "../../store/store";
import { Section, TabPage } from "./layout";
import { ShareLink } from "./ShareLink";
import { Faqs } from "./site/Faqs";
import { SiteAddress } from "./site/SiteAddress";
import { Story } from "./site/Story";
import { Updates } from "./site/Updates";

type SaveSite = (patch: Partial<SiteInfo>, message?: string) => void;

/** The published website's address, for an account; a demo has none. */
function useSiteAddress(eventId: string, enabled: boolean) {
  const [address, setAddress] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    api
      .linkFor(eventId, "site")
      .then((l) => live && setAddress(publicUrl("site", l.token)))
      // Without the address the tab still works; it shows once the link loads.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [eventId, enabled]);
  return [address, setAddress] as const;
}

/** The event website: what guests read before the day, in the family's languages. */
export function SiteTab({ ev }: { ev: PlannrEvent }) {
  const { state, dispatch } = useStore();
  const editable = useEditable(ev);
  const site: SiteInfo = (ev.layout !== "empty" && ev.site) || { published: false };
  const account = state.mode === "account";
  const [address, setAddress] = useSiteAddress(ev.id, account && site.published);
  const ai = useAiOn() === true;

  const save: SaveSite = (patch, message) => {
    dispatch({ type: "updateEvent", eventId: ev.id, patch: { site: { ...site, ...patch } } });
    if (message) dispatch(toast(message));
  };
  const publish = () =>
    save(
      { published: !site.published },
      site.published ? "The website is offline." : "The website is live. Share it with your guests.",
    );
  const publishButton = editable && (
    <button
      type="button"
      className={`btn ${site.published ? "btn-secondary" : "btn-primary"}`}
      onClick={publish}
    >
      {site.published ? "Take offline" : "Publish the website"}
    </button>
  );

  return (
    <TabPage eyebrow={ev.name} title="Website" aside={publishButton}>
      <SiteStatus ev={ev} published={site.published} account={account}>
        {address && <SiteAddress ev={ev} address={address} onChange={setAddress} editable={editable} />}
      </SiteStatus>
      <Story ev={ev} site={site} editable={editable} ai={ai} onSave={save} />
      <Schedule ev={ev} editable={editable} />
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

interface StatusProps {
  ev: PlannrEvent;
  published: boolean;
  account: boolean;
  /** The address, once it has loaded. */
  children: ReactNode;
}

/** Live or not, what that means for guests, and the address to share. */
function SiteStatus({ ev, published, account, children }: StatusProps) {
  const share = published && (
    <ShareLink
      ev={ev}
      kind="site"
      label="Share"
      message={`${ev.name}: the schedule, venues and everything you need to know.`}
    />
  );
  return (
    <Section title={published ? "Live" : "Not published yet"} aside={share}>
      <p className="m-0 text-sm text-body">
        {published
          ? "Anyone with the address can read it: your story, the schedule, venues with maps and answers to common questions. Family-only functions stay off it, and RSVPs come through each household's own link."
          : "Write your story and check the schedule below, then publish. Nothing is public until you do."}
      </p>
      {children}
      {!account && (
        <p className="m-0 text-xs text-muted">
          In the demo the website opens as a preview. With an account it gets its own address, like
          plannr.app/e/ananya-rohan.
        </p>
      )}
    </Section>
  );
}

/** Each function, and whether it shows on the website or stays family only. */
function Schedule({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const setPrivate = (id: string, hidden: boolean) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "functions", id, patch: { private: hidden } });
  return (
    <Section title="Schedule on the website">
      <ul className="m-0 flex list-none flex-col p-0">
        {functionsOf(ev).map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
            <span className="flex flex-col">
              <span className="font-semibold">{f.label}</span>
              <span className="text-xs text-muted">{dayLine(f.date, f.time, f.place)}</span>
            </span>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-leaf)]"
                checked={!f.private}
                disabled={!editable}
                onChange={(e) => setPrivate(f.id, !e.target.checked)}
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
  );
}
