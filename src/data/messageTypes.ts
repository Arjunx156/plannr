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

export interface Notice {
  id: string;
  tone: "warn" | "ai" | "info";
  label: string;
  text: string;
  why?: string;
  lines?: string[];
  primary?: { label: string; action: ActionId };
  secondary?: { label: string; action: ActionId };
  status: "open" | "done" | "dismissed";
  result?: string;
}

export interface PreviewRow {
  title: string;
  from?: string;
  to?: string;
  detail?: string;
  headsUp?: boolean;
  amount?: string;
}

export interface Preview {
  id: string;
  title: string;
  tag: string;
  rows: PreviewRow[];
  status: "pending" | "applied" | "rejected";
  /** Which mutation applying this preview performs. */
  change: ChangeId;
}

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
  taskId?: string;
  title?: string;
  due?: string;
  who?: string;
  guests?: number;
  categoryId?: string;
  amount?: number;
  text?: string;
  fnId?: string;
  date?: string;
  label?: string;
}

export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Changes the assistant proposed, waiting for the planner's yes. */
  proposals?: AiProposal[];
  proposalStatus?: "pending" | "applied" | "rejected";
  lang?: string;
  /** e.g. "Voice · Malayalam · “Move haldi to Friday”" */
  caption?: string;
  /** Teal source line under an AI answer. */
  source?: string;
  action?: { label: string; id: ActionId; done?: boolean };
  preview?: Preview;
  /** Extra AI line after a preview, e.g. "Why these: …" */
  footnote?: string;
  translation?: string;
}
