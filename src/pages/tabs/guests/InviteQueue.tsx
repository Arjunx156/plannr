import { useState } from "react";
import type { Household } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { plural } from "../../../lib/format";
import { ShareLink } from "../ShareLink";
import { inviteMessage } from "./shared";

/** One household at a time: WhatsApp can only open one chat per tap. */
export function InviteQueue({
  ev,
  queue,
  onSent,
}: {
  ev: PlannrEvent;
  queue: Household[];
  onSent: (h: Household) => void;
}) {
  const [skip, setSkip] = useState<string[]>([]);
  const next = queue.find((h) => !skip.includes(h.id));
  if (!next) return null;
  return (
    <section
      aria-label="Invitations to send"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-peacock-line bg-peacock-wash p-4"
    >
      <span className="flex flex-col text-sm">
        <span className="font-semibold">
          {plural(queue.length - skip.length, "invitation")} to send · next: {next.name}
        </span>
        <span className="text-body">
          {next.phone
            ? "Opens WhatsApp with the message and their RSVP link ready."
            : "No number saved: pick them in WhatsApp."}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        <ShareLink
          ev={ev}
          kind="rsvp"
          target={next.id}
          phone={next.phone}
          label="Send"
          message={inviteMessage(ev, next)}
          onShared={() => onSent(next)}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setSkip((s) => [...s, next.id])}
        >
          Skip
        </button>
      </span>
    </section>
  );
}
