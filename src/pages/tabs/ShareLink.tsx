import { useState } from "react";
import { Link } from "react-router";
import type { PlannrEvent } from "../../data/types";
import { api, publicUrl } from "../../lib/api";
import { longDate } from "../../lib/dates";
import { linkExpiry, type PublicKind } from "../../shared/public";
import { toast, useStore } from "../../store/store";
import { waLink } from "./links";

/**
 * A shared link for one page. With an account it's a real link anyone can open; in the demo
 * it opens a preview drawn from this browser's plan.
 */
export function useShareLink(ev: PlannrEvent, kind: PublicKind, target = "") {
  const { state, dispatch } = useStore();
  const account = state.mode === "account";
  const preview = `/preview/${kind}/${ev.id}${target ? `/${encodeURIComponent(target)}` : ""}`;
  const get = async (): Promise<string | undefined> => {
    if (!account) return undefined;
    try {
      const link = await api.linkFor(ev.id, kind, target);
      return publicUrl(kind, link.token);
    } catch (e) {
      dispatch(toast(`Couldn't make the link: ${(e as Error).message}`));
      return undefined;
    }
  };
  return { account, preview, get };
}

/** Copy and WhatsApp buttons for a shared page, with a preview in the demo. */
export function ShareLink({
  ev,
  kind,
  target,
  message,
  phone,
  label = "Share",
  onShared,
}: {
  ev: PlannrEvent;
  kind: PublicKind;
  target?: string;
  /** The WhatsApp message; the link is added at the end. */
  message: string;
  phone?: string;
  label?: string;
  onShared?: () => void;
}) {
  const { dispatch } = useStore();
  const share = useShareLink(ev, kind, target);
  const [busy, setBusy] = useState(false);
  if (!share.account)
    return (
      <span className="flex flex-wrap gap-1.5">
        <Link to={share.preview} className="btn btn-ghost btn-sm">
          Preview
        </Link>
        {onShared && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title="In the demo nothing is sent; this marks it as done"
            onClick={() => {
              onShared();
              dispatch(toast(`${label === "Remind" ? "Reminder" : "Invitation"} marked as sent.`));
            }}
          >
            Mark {label === "Remind" ? "reminded" : "sent"}
          </button>
        )}
      </span>
    );
  const whatsapp = async () => {
    // Open the tab first, synchronously, so the browser doesn't block it as a popup. Passing
    // "noopener" would make window.open return null and lose the tab, so instead its link back
    // to Plannr is cut here, before it loads anything.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    setBusy(true);
    const url = await share.get();
    setBusy(false);
    if (!url) {
      win?.close();
      return;
    }
    const link = waLink(`${message}\n${url}`, phone);
    if (win) win.location.href = link;
    else window.location.href = link;
    onShared?.();
  };
  const copy = async () => {
    setBusy(true);
    const url = await share.get();
    setBusy(false);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      dispatch(toast("Link copied."));
      onShared?.();
    } catch {
      window.prompt("Copy this link", url);
    }
  };
  return (
    <span className="flex flex-wrap gap-1.5">
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={whatsapp}>
        {label} on WhatsApp
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={copy}
        aria-label={`Copy the ${kind} link`}
        title={`Works until ${longDate(linkExpiry(ev, kind))}`}
      >
        Copy link
      </button>
      <Link to={share.preview} className="btn btn-ghost btn-sm">
        Preview
      </Link>
    </span>
  );
}
