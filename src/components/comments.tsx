import { type FormEvent, useCallback, useState } from "react";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import type { CommentView } from "../shared/types";
import { toast, useStore } from "../store/store";
import { LoadError, useRemote } from "./remote";

/** A record's comments: loading, empty, or the list. */
function CommentList({ list }: { list: CommentView[] | null }) {
  if (list === null) return <span className="text-sm text-muted">Loading…</span>;
  if (list.length === 0)
    return (
      <span className="text-sm text-muted">
        No comments yet. Ask a question or leave a note for the others.
      </span>
    );
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {list.map((c) => (
        <li key={c.id} className="flex flex-col gap-0.5 rounded-xl bg-sand px-3 py-2.5">
          <span className="text-xs text-muted">
            <strong className="font-semibold text-ink">{c.by ?? "Someone"}</strong> · {timeAgo(c.at)}
          </span>
          <span className="text-sm whitespace-pre-wrap">{c.body}</span>
        </li>
      ))}
    </ul>
  );
}
export function Comments({
  eventId,
  recordType,
  recordId,
}: {
  eventId: string;
  recordType: string;
  recordId: string;
}) {
  const { dispatch } = useStore();
  const load = useCallback(
    () => api.comments(eventId, recordType, recordId),
    [eventId, recordType, recordId],
  );
  const comments = useRemote(load);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const c = await api.addComment(eventId, recordType, recordId, text);
      comments.set((l) => [...(l ?? []), c]);
      setBody("");
    } catch (err) {
      dispatch(toast(`Couldn't post that: ${(err as Error).message}`));
    }
    setBusy(false);
  };

  return (
    <section aria-label="Comments" className="flex flex-col gap-3">
      <h3 className="font-serif text-lg">Comments</h3>
      {comments.error ? (
        <LoadError what="the comments" error={comments.error} onRetry={comments.reload} />
      ) : (
        <CommentList list={comments.data} />
      )}
      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor={`comment-${recordId}`} className="sr-only">
          Add a comment
        </label>
        <textarea
          id={`comment-${recordId}`}
          className="field min-h-16 py-2.5"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment"
        />
        <button type="submit" className="btn btn-secondary btn-sm self-start" disabled={busy || !body.trim()}>
          {busy ? "Posting…" : "Comment"}
        </button>
      </form>
    </section>
  );
}
