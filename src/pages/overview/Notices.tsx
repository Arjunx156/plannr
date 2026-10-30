import { useState } from "react";
import { useEditable } from "../../components/tasks";
import { NOTICE_CARD, Pill } from "../../components/ui";
import type { ActionId, CommunityEvent, Notice, PersonalEvent } from "../../data/types";
import { toast, useStore } from "../../store/store";
import { BookPhotographer, Savings } from "./NoticeDialogs";

/** What needs the planner's attention, each with the one action that settles it. */
export function Notices({ ev }: { ev: PersonalEvent | CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const [booking, setBooking] = useState(false);
  const [savings, setSavings] = useState(false);
  const open = ev.notices.filter((n) => n.status === "open");
  const closed = ev.notices.filter((n) => n.status !== "open");

  const resolve = (n: Notice, result: string, status: "done" | "dismissed" = "done") => {
    dispatch({ type: "resolveNotice", eventId: ev.id, noticeId: n.id, status, result });
    dispatch(toast(result, { type: "reopenNotice", eventId: ev.id, noticeId: n.id }));
  };

  const ask = (text: string) => {
    const box = document.getElementById(`ask-${ev.id}`) as HTMLTextAreaElement | null;
    if (!box) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.focus();
  };

  const run = (n: Notice, action: ActionId) => {
    switch (action) {
      case "acknowledge":
        return resolve(n, "Noted.");
      case "dismiss":
        return resolve(n, "Dismissed.", "dismissed");
      case "remind":
        return resolve(n, "Hidden for now.", "dismissed");
      case "compare-photographers":
        return setBooking(true);
      case "open-savings":
        return setSavings(true);
      case "accept-overrun":
        if (ev.layout === "personal") {
          const cat = ev.budget.categories.find((c) => (c.projected ?? c.planned) > c.planned);
          if (cat)
            dispatch({
              type: "updateCategory",
              eventId: ev.id,
              categoryId: cat.id,
              patch: {
                planned: cat.projected ?? cat.planned,
                projected: undefined,
                tone: "ok",
                status: "Overrun accepted",
              },
            });
        }
        return resolve(n, "Overrun accepted: the plan now matches the quote.");
      case "review-guest-changes":
        dispatch({ type: "applyGuestGrowth", eventId: ev.id });
        return dispatch(toast("Catering, invitations and seating now plan for the new headcount."));
      case "order-cake":
        return dispatch({ type: "orderCake", eventId: ev.id });
      case "add-stars":
        return dispatch({ type: "addStars", eventId: ev.id });
      case "add-areca":
        return dispatch({ type: "addAreca", eventId: ev.id });
      case "draft-permit":
        return ask("Draft the police application for the loudspeaker permit");
      case "open-approvals":
        return document.getElementById("approvals")?.scrollIntoView({ behavior: "smooth" });
      case "add-tip":
        return dispatch({ type: "addTip", eventId: ev.id });
    }
  };

  if (!ev.notices.length) return null;
  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3">
      {open.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {open.map((n) => (
            <article
              key={n.id}
              className={`flex flex-col gap-2 rounded-2xl border p-4 ${NOTICE_CARD[n.tone]}`}
            >
              <Pill tone={n.tone === "info" ? "idle" : n.tone}>{n.label}</Pill>
              <span className="text-[15px] leading-[1.4] font-medium">{n.text}</span>
              {n.lines?.map((l) => (
                <span key={l} className="text-sm text-body">
                  · {l}
                </span>
              ))}
              {n.why && <span className="text-xs leading-[1.4] text-peacock">{n.why}</span>}
              <div className={`mt-1 flex-wrap gap-2 ${editable ? "flex" : "hidden"}`}>
                {n.primary && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => n.primary && run(n, n.primary.action)}
                  >
                    {n.primary.label}
                  </button>
                )}
                {n.secondary && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => n.secondary && run(n, n.secondary.action)}
                  >
                    {n.secondary.label}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {closed.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {closed.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-3 text-sm text-body">
              <span>
                <span className="text-leaf-ink">✓</span> {n.result ?? n.label}
              </span>
              {editable && (
                <button
                  type="button"
                  className="link text-xs"
                  onClick={() => dispatch({ type: "reopenNotice", eventId: ev.id, noticeId: n.id })}
                >
                  Reopen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ev.layout === "personal" && (
        <>
          <BookPhotographer ev={ev} open={booking} onClose={() => setBooking(false)} />
          <Savings ev={ev} open={savings} onClose={() => setSavings(false)} onAsk={ask} />
        </>
      )}
    </section>
  );
}
