/** The one-tap actions a notice or message can offer. */
export type ActionId =
  | "compare-photographers"
  | "remind"
  | "open-savings"
  | "accept-overrun"
  | "review-guest-changes"
  | "dismiss"
  | "draft-permit"
  | "add-areca"
  | "add-stars"
  | "order-cake"
  | "acknowledge"
  | "add-tip"
  | "open-approvals";

/** A notice on the overview. */
export interface Notice {
  id: string;
  tone: "warn" | "ai" | "info";
  label: string;
  text: string;
  why?: string | undefined;
  lines?: string[] | undefined;
  primary?: { label: string; action: ActionId };
  secondary?: { label: string; action: ActionId };
  status: "open" | "done" | "dismissed";
  result?: string | undefined;
}

/** One row in a preview card. */
export interface PreviewRow {
  title: string;
  from?: string | undefined;
  to?: string | undefined;
  detail?: string | undefined;
  headsUp?: boolean | undefined;
  amount?: string | undefined;
}

/** A preview card in the assistant's answer: what a change would look like before it's made. */
export interface Preview {
  id: string;
  title: string;
  tag: string;
  rows: PreviewRow[];
  status: "pending" | "applied" | "rejected";
  /** Which mutation applying this preview performs. */
  change: ChangeId;
}

/** The demo's scripted changes. */
export type ChangeId = "move-haldi" | "cut-decor" | "areca-plates";

/** A change the assistant proposed, in its own small vocabulary; turned into plan changes on the device. */
export interface AiProposal {
  kind:
    | "addTask"
    | "moveTask"
    | "completeTask"
    | "setHeadcount"
    | "setBudgetLine"
    | "remember"
    | "announce"
    | "moveFunction"
    | "addChecklist";
  taskId?: string | undefined;
  title?: string | undefined;
  due?: string | undefined;
  who?: string | undefined;
  guests?: number | undefined;
  categoryId?: string | undefined;
  amount?: number | undefined;
  text?: string | undefined;
  fnId?: string | undefined;
  date?: string | undefined;
  label?: string | undefined;
}

/** One message in the assistant thread. */
export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Changes the assistant proposed, waiting for the planner's yes. */
  proposals?: AiProposal[] | undefined;
  proposalStatus?: "pending" | "applied" | "rejected" | undefined;
  lang?: string | undefined;
  /** e.g. "Voice · Malayalam · “Move haldi to Friday”" */
  caption?: string | undefined;
  /** Teal source line under an AI answer. */
  source?: string | undefined;
  action?: { label: string; id: ActionId; done?: boolean };
  preview?: Preview | undefined;
  /** Extra AI line after a preview, e.g. "Why these: …" */
  footnote?: string | undefined;
  translation?: string | undefined;
}
