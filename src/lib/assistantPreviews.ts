import type { Preview } from "../data/messageTypes";
import { fridayOnOrBefore, shortDate } from "./dates";
import { msgId } from "./messageId";

/** The preview for moving the haldi to the Friday before it. */
export function haldiPreview(from: string): Preview {
  const to = fridayOnOrBefore(from);
  return {
    id: msgId(),
    title: "Preview · 4 changes",
    tag: "Haldi",
    change: "move-haldi",
    status: "pending",
    rows: [
      { title: "Haldi date", from: shortDate(from), to: `${shortDate(to)}, 5:00 pm` },
      {
        title: "2 tasks move a day earlier",
        detail: "Haldi caterer headcount · Collect turmeric & marigolds (Priya)",
      },
      {
        title: "Makeup artist needs to confirm",
        detail: "Glam by Neha quoted for Saturday. I'll draft a WhatsApp asking about Friday.",
      },
      {
        title: "Heads-up",
        detail: "Mehendi is Thursday night, so the bride has back-to-back evenings.",
        headsUp: true,
      },
    ],
  };
}

/** The preview for the ₹50,000 décor cut. */
export function decorPreview(): Preview {
  return {
    id: msgId(),
    title: "Preview · Décor",
    tag: "−₹50,000",
    change: "cut-decor",
    status: "pending",
    rows: [
      { title: "Reception backdrop", amount: "−₹20,000" },
      { title: "Entrance arch → toran", amount: "−₹12,000" },
      { title: "Centrepieces → urulis", amount: "−₹18,000" },
      {
        title: "Also updates",
        detail: "Mangalya Décor needs a revised quote. 1 new task: “Source 30 brass urulis” for Priya.",
      },
    ],
  };
}
