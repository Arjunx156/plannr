import { useState } from "react";
import { useEditable } from "../../components/taskHooks";
import { NOTICE_CARD, Pill } from "../../components/ui";
import type { ActionId, Notice } from "../../data/messageTypes";
import type { CommunityEvent, PersonalEvent } from "../../data/types";
import { toast, useStore } from "../../store/store";
import { BookPhotographer, Savings } from "./actionDialogs";

type AnyEvent = PersonalEvent | CommunityEvent;

/** Puts a question in the assistant's box, ready for the planner to read and send. */
function askAssistant(eventId: string, text: string) {
  const box = document.getElementById(`ask-${eventId}`) as HTMLTextAreaElement | null;
  if (!box) return;
  // React tracks the value itself, so set it through the native setter and announce the input.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(box, text);
  box.dispatchEvent(new Event("input", { bubbles: true }));
  box.focus();
}

/** What each notice button does. Keyed by every action id, so a new one can't go unhandled. */
function useNoticeActions(ev: AnyEvent, dialogs: { book: () => void; savings: () => void }) {
  const { dispatch } = useStore();
  const eventId = ev.id;
  const resolve = (n: Notice, result: string, status: "done" | "dismissed" = "done") => {
    dispatch({ type: "resolveNotice", eventId, noticeId: n.id, status, result });
    dispatch(toast(result, { type: "reopenNotice", eventId, noticeId: n.id }));
  };
  const acceptOverrun = (n: Notice) => {
    const over = (c: { planned: number; projected?: number }) => (c.projected ?? c.planned) > c.planned;
    const cat = ev.layout === "personal" ? ev.budget.categories.find(over) : undefined;
    if (cat) {
      const patch = { planned: cat.projected ?? cat.planned, projected: undefined, tone: "ok" as const };
      dispatch({
        type: "updateCategory",
        eventId,
        categoryId: cat.id,
        patch: { ...patch, status: "Overrun accepted" },
      });
    }
    resolve(n, "Overrun accepted: the plan now matches the quote.");
  };
  const handlers: Record<ActionId, (n: Notice) => void> = {
    acknowledge: (n) => resolve(n, "Noted."),
    dismiss: (n) => resolve(n, "Dismissed.", "dismissed"),
    remind: (n) => resolve(n, "Hidden for now.", "dismissed"),
    "compare-photographers": dialogs.book,
    "open-savings": dialogs.savings,
    "accept-overrun": acceptOverrun,
    "review-guest-changes": () => {
      dispatch({ type: "applyGuestGrowth", eventId });
      dispatch(toast("Catering, invitations and seating now plan for the new headcount."));
    },
    "order-cake": () => dispatch({ type: "orderCake", eventId }),
    "add-stars": () => dispatch({ type: "addStars", eventId }),
    "add-areca": () => dispatch({ type: "addAreca", eventId }),
    "draft-permit": () => askAssistant(eventId, "Draft the police application for the loudspeaker permit"),
    "open-approvals": () => document.getElementById("approvals")?.scrollIntoView({ behavior: "smooth" }),
    "add-tip": () => dispatch({ type: "addTip", eventId }),
  };
  return (n: Notice, action: ActionId) => handlers[action](n);
}

/** What needs the planner's attention, each with the one action that settles it. */
export function Notices({ ev }: { ev: AnyEvent }) {
  const editable = useEditable(ev);
  const [booking, setBooking] = useState(false);
  const [savings, setSavings] = useState(false);
  const run = useNoticeActions(ev, { book: () => setBooking(true), savings: () => setSavings(true) });
  const open = ev.notices.filter((n) => n.status === "open");
  const closed = ev.notices.filter((n) => n.status !== "open");

  if (ev.notices.length === 0) return null;
  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3">
      {open.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {open.map((n) => (
            <NoticeCard key={n.id} n={n} editable={editable} onRun={(action) => run(n, action)} />
          ))}
        </div>
      )}
      {closed.length > 0 && <Settled ev={ev} notices={closed} editable={editable} />}
      {ev.layout === "personal" && (
        <>
          <BookPhotographer ev={ev} open={booking} onClose={() => setBooking(false)} />
          <Savings
            ev={ev}
            open={savings}
            onClose={() => setSavings(false)}
            onAsk={(text) => askAssistant(ev.id, text)}
          />
        </>
      )}
    </section>
  );
}

interface CardProps {
  n: Notice;
  editable: boolean;
  onRun: (action: ActionId) => void;
}

function NoticeCard({ n, editable, onRun }: CardProps) {
  const { primary, secondary } = n;
  return (
    <article className={`flex flex-col gap-2 rounded-2xl border p-4 ${NOTICE_CARD[n.tone]}`}>
      <Pill tone={n.tone === "info" ? "idle" : n.tone}>{n.label}</Pill>
      <span className="text-[15px] leading-[1.4] font-medium">{n.text}</span>
      {n.lines?.map((l) => (
        <span key={l} className="text-sm text-body">
          · {l}
        </span>
      ))}
      {n.why && <span className="text-xs leading-[1.4] text-peacock">{n.why}</span>}
      <div className={`mt-1 flex-wrap gap-2 ${editable ? "flex" : "hidden"}`}>
        {primary && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onRun(primary.action)}>
            {primary.label}
          </button>
        )}
        {secondary && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRun(secondary.action)}>
            {secondary.label}
          </button>
        )}
      </div>
    </article>
  );
}

/** Notices already handled, each with a way to bring it back. */
function Settled({ ev, notices, editable }: { ev: AnyEvent; notices: Notice[]; editable: boolean }) {
  const { dispatch } = useStore();
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {notices.map((n) => (
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
  );
}
