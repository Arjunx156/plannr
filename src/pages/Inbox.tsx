import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell, type InboxItem, useInbox } from "../components/shell";
import { usePageMeta } from "../components/ui";
import { initials, timeAgo } from "../lib/format";
import { useStore } from "../store/store";

function day(item: InboxItem): string {
  if (!item.at) return "Recent";
  const d = new Date(item.at);
  if (d.toDateString() === new Date().toDateString()) return "Today";
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

/** /inbox: what co-planners changed, across every plan. */
export function Inbox() {
  usePageMeta("Inbox", { private: true });
  const { state, dispatch } = useStore();
  const items = useInbox();
  // What was unread when the page opened stays marked "New" for this visit, including
  // changes that arrive while it's open; the inbox counts them as read straight away.
  const [seenAtOpen] = useState(state.inboxSeen);
  const [demoUnread] = useState(() => new Set(items.filter((i) => i.unread).map((i) => i.id)));
  const isNew = (i: InboxItem) => (i.at ? i.at > seenAtOpen : demoUnread.has(i.id));
  useEffect(() => {
    void state.activity;
    dispatch({ type: "readNotifications" });
  }, [dispatch, state.activity]);
  const shared = state.events.find((e) => !e.archived && state.remote[e.id]?.role === "owner");

  let last = "";
  return (
    <AppShell>
      <main id="main" className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted">
            {state.mode === "demo" ? "Updates on the demo events" : "Changes by your co-planners"}
          </span>
          <h1 className="font-serif text-[44px] leading-none">Inbox</h1>
        </div>
        {items.length ? (
          <ol className="m-0 flex list-none flex-col rounded-2xl border border-line bg-surface p-0">
            {items.map((item, i) => {
              const heading = day(item);
              const show = heading !== last;
              last = heading;
              return (
                <li key={item.id} className={`flex flex-col ${i ? "border-t border-sand-2" : ""}`}>
                  {show && <span className="eyebrow px-5 pt-4 text-muted">{heading}</span>}
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand text-[11px] font-semibold"
                    >
                      {item.by ? initials(item.by) : "◆"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm leading-[1.45]">
                        {item.by && <strong className="font-semibold">{item.by}: </strong>}
                        {item.text}
                      </span>
                      <span className="text-xs text-muted">
                        {item.eventId && item.eventName && (
                          <>
                            <Link to={`/events/${item.eventId}`} className="link text-xs text-muted">
                              {item.eventName}
                            </Link>
                            {" · "}
                          </>
                        )}
                        {item.at ? timeAgo(item.at) : item.when}
                      </span>
                    </span>
                    {isNew(item) && (
                      <span className="mt-1 rounded-full bg-maroon px-2 py-px text-[10px] font-semibold text-white">
                        New
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-2 p-8">
            <span className="font-serif text-[26px]">All quiet</span>
            <span className="text-body">
              When co-planners tick off tasks or change a plan, it shows up here.
            </span>
            {shared && (
              <Link to={`/events/${shared.id}/people`} className="btn btn-outline">
                Invite someone to {shared.name}
              </Link>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
