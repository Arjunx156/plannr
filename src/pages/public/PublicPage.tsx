import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Logo, Spinner, usePageMeta } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { shrinkImage } from "../../lib/images";
import { type PublicKind, type PublicView, projectView } from "../../shared/public";
import { useStore } from "../../store/store";
import { viewPage } from "./views";

/** /r/:token and friends: a shared page, loaded from the link's token. No account needed. */
export function PublicPage({ kind }: { kind: PublicKind }) {
  const { token = "" } = useParams();
  const [view, setView] = useState<PublicView | null>();
  const [error, setError] = useState("");
  usePageMeta(view ? view.event.name : "Plannr", { private: kind !== "site" });

  useEffect(() => {
    let live = true;
    api
      .publicView(token)
      .then((v) => live && setView(v))
      .catch((e) => {
        if (!live) return;
        setView(null);
        setError(e instanceof ApiError ? e.message : "This link isn't working.");
      });
    return () => {
      live = false;
    };
  }, [token]);

  const act = useCallback(
    async (actions: unknown[]) => {
      setView(await api.publicActions(token, actions));
    },
    [token],
  );

  if (view === undefined)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner label="Opening" />
      </div>
    );
  if (!view) return <Broken message={error} />;
  const upload =
    view.kind === "album"
      ? async (file: File, by: string) => setView(await api.albumPhoto(token, await shrinkImage(file), by))
      : undefined;
  return viewPage(view, act, undefined, upload);
}

function Broken({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper p-6 text-center">
      <Logo to="/" />
      <h1 className="font-serif text-[32px] leading-tight">{message || "This link isn't working."}</h1>
      <p className="m-0 max-w-[420px] text-body">
        Check you opened the whole link, or ask the family to send it again.
      </p>
      <Link to="/" className="btn btn-outline">
        Go to Plannr
      </Link>
    </div>
  );
}

/**
 * /preview/:kind/:eventId/:target? — the same page, drawn from the plan in this browser, so
 * hosts see what guests will see. In the demo it works for real: an RSVP here updates the
 * guest list. With an account, guests answer from their own link, so the preview is read-only.
 */
export function PreviewPage() {
  const { kind = "", eventId = "", target = "" } = useParams();
  const { state, dispatch } = useStore();
  usePageMeta("Preview", { private: true });
  const ev = state.events.find((e) => e.id === eventId);
  const view = ev ? projectView(ev, kind as PublicKind, decodeURIComponent(target)) : undefined;
  const demo = state.mode === "demo";
  const back = `/events/${eventId}`;
  const act = demo
    ? async (actions: unknown[]) => {
        for (const a of actions as { type: string; householdId?: string }[]) {
          const action = a.type === "rsvp" ? { ...a, householdId: decodeURIComponent(target) } : a;
          dispatch({ ...(action as object), eventId } as Parameters<typeof dispatch>[0]);
        }
      }
    : undefined;
  if (!view)
    return (
      <Broken
        message={
          kind === "site" ? "Publish the website to preview it." : "There's nothing to preview here yet."
        }
      />
    );
  const banner = (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-2 text-sm text-paper">
      <span>
        <strong>Preview.</strong>{" "}
        {demo
          ? "This is what guests see. Answers here update your demo plan."
          : "This is what they see. Only they can answer from their link."}
      </span>
      <Link to={back} className="font-semibold text-gold underline-offset-4 hover:underline">
        Back to the plan
      </Link>
    </div>
  );
  return viewPage(view, act, banner);
}
