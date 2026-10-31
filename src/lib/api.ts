import type { PlannrEvent } from "../data/types";
import type { EventAction } from "../shared/engine";
import { isRecord } from "../shared/guards";
import { PUBLIC_PATH, type PublicKind, type PublicView } from "../shared/public";
import type {
  AccountUser,
  ActivityEntry,
  CommentView,
  HistoryEntry,
  InvitePreview,
  LinkKind,
  LinkRow,
  Member,
  PlanSummary,
  Role,
  SignInMethods,
  TemplateRow,
} from "../shared/types";

/** Plannr's own API. Sessions ride on a same-site cookie, so nothing here handles tokens. */

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    const json =
      init.body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) };
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      ...json,
    });
  } catch {
    throw new ApiError(0, "You're offline. Changes will sync when you're back.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(res.status, problem(data) ?? "Something went wrong");
  return fromServer<T>(data);
}

/** The error a route sent back, if it sent one. */
export function problem(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  const { error, message } = data;
  if (typeof error === "string") return error;
  return typeof message === "string" ? message : undefined;
}

/** Where an answer from Plannr's own server takes its type, in one place. */
export function fromServer<T>(data: unknown): T {
  // The routes and this client share the types in src/shared, and the server validates what it
  // sends, so the body is trusted here once rather than re-checked on every call.
  return data as T;
}

const enc = encodeURIComponent;

async function upload<T>(path: string, body: Blob): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": body.type || "image/jpeg" },
      body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "You're offline. Try the photo again when you're back.");
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, problem(data) ?? "The photo didn't upload. Try again.");
  return fromServer<T>(data);
}

/** Every call the app makes to Plannr's own server, typed by its answer. */
export const api = {
  // ------------------------------------------------------------ accounts
  methods: (): Promise<
    | SignInMethods
    | {
        guest: boolean;
        email: boolean;
        google: boolean;
      }
  > =>
    request<SignInMethods>("/api/auth/methods").catch(() => ({ guest: false, email: false, google: false })),
  async me(): Promise<AccountUser | null> {
    try {
      return (await request<{ user: AccountUser | null }>("/api/me")).user;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503 || e.status === 404)) return null;
      throw e;
    }
  },
  signInGuest: (): Promise<{ user: AccountUser }> => request("/api/auth/sign-in/anonymous", { body: {} }),
  sendCode: (email: string): Promise<{ success: boolean }> =>
    request("/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    }),
  verifyCode: (email: string, otp: string): Promise<{ user: AccountUser }> =>
    request("/api/auth/sign-in/email-otp", { body: { email, otp } }),
  /** Starts Google sign-in; the browser goes to the returned url. Paths are where Google sends them back. */
  google: (to: {
    callbackURL: string;
    newUserCallbackURL: string;
    errorCallbackURL: string;
  }): Promise<{ url: string }> =>
    request("/api/auth/sign-in/social", {
      body: { provider: "google", disableRedirect: true, ...to },
    }),
  rename: (name: string): Promise<{ status: boolean }> =>
    request("/api/auth/update-user", { body: { name } }),
  signOut: (): Promise<{ success: boolean }> => request("/api/auth/sign-out", { body: {} }),

  // ------------------------------------------------------------ plans
  plans: (): Promise<PlanSummary[]> => request<{ plans: PlanSummary[] }>("/api/events").then((r) => r.plans),
  plan: (id: string): Promise<PlanSummary> => request<PlanSummary>(`/api/events/${enc(id)}`),
  createPlan: (event: PlannrEvent): Promise<PlanSummary> =>
    request<PlanSummary>("/api/events", { body: { event } }),
  version: (id: string): Promise<number> =>
    request<{ version: number }>(`/api/events/${enc(id)}/version`).then((r) => r.version),
  actions: (id: string, actions: EventAction[]): Promise<{ event: PlannrEvent; version: number }> =>
    request(`/api/events/${enc(id)}/actions`, { body: { actions } }),
  history: (id: string): Promise<HistoryEntry[]> =>
    request<{ history: HistoryEntry[] }>(`/api/events/${enc(id)}/history`).then((r) => r.history),
  undo: (id: string, change: string, redo = false): Promise<{ event: PlannrEvent; version: number }> =>
    request(`/api/events/${enc(id)}/history/${enc(change)}/${redo ? "redo" : "undo"}`, { body: {} }),

  activity: (): Promise<ActivityEntry[]> =>
    request<{ activity: ActivityEntry[] }>("/api/activity").then((r) => r.activity),

  // ------------------------------------------------------------ people
  members: (id: string): Promise<Member[]> =>
    request<{ members: Member[] }>(`/api/events/${enc(id)}/members`).then((r) => r.members),
  updateMember: (
    id: string,
    userId: string,
    patch: { role?: Exclude<Role, "owner">; side?: string | null },
  ): Promise<unknown> =>
    request(`/api/events/${enc(id)}/members/${enc(userId)}`, { method: "PATCH", body: patch }),
  removeMember: (id: string, userId: string): Promise<unknown> =>
    request(`/api/events/${enc(id)}/members/${enc(userId)}`, { method: "DELETE" }),
  createInvite: (
    id: string,
    role: Exclude<Role, "owner">,
    side?: string | null,
  ): Promise<{ token: string; expiresAt: string }> =>
    request(`/api/events/${enc(id)}/invites`, { body: { role, side } }),
  invite: (token: string): Promise<InvitePreview> => request<InvitePreview>(`/api/invites/${enc(token)}`),
  acceptInvite: (token: string): Promise<{ eventId: string; role: Role }> =>
    request(`/api/invites/${enc(token)}/accept`, { body: {} }),

  // ------------------------------------------------------------ shared links
  links: (id: string): Promise<LinkRow[]> =>
    request<{ links: LinkRow[] }>(`/api/events/${enc(id)}/links`).then((r) => r.links),
  linkFor: (id: string, kind: LinkKind, target = ""): Promise<LinkRow> =>
    request<LinkRow>(`/api/events/${enc(id)}/links`, { body: { kind, target } }),
  revokeLink: (id: string, token: string): Promise<unknown> =>
    request(`/api/events/${enc(id)}/links/${enc(token)}`, { method: "DELETE" }),
  renameSite: (id: string, slug: string): Promise<LinkRow> =>
    request<LinkRow>(`/api/events/${enc(id)}/site-address`, { method: "PUT", body: { slug } }),
  deleteAccount: (): Promise<{ handedOver: number; deleted: number }> =>
    request("/api/account/delete", { body: { confirm: "DELETE" } }),
  pushKey: (): Promise<{ key: string | null }> => request("/api/push/key"),
  pushOn: (sub: PushSubscriptionJSON): Promise<{ ok: true }> => request("/api/push", { body: sub }),
  pushOff: (endpoint: string): Promise<{ ok: true }> => request("/api/push/remove", { body: { endpoint } }),
  publicView: (token: string): Promise<PublicView> => request<PublicView>(`/api/p/${enc(token)}`),
  /** Adds a photo to a shared album: the image goes up as it is, the server checks and stores it. */
  albumPhoto: (token: string, photo: Blob, by: string): Promise<PublicView> =>
    upload<PublicView>(`/api/p/${enc(token)}/photo?by=${enc(by)}`, photo),
  eventPhoto: (
    eventId: string,
    photo: Blob,
  ): Promise<{
    url: string;
  }> => upload<{ url: string }>(`/api/events/${enc(eventId)}/photo`, photo),
  publicActions: (token: string, actions: unknown[]): Promise<PublicView> =>
    request<PublicView>(`/api/p/${enc(token)}/actions`, { body: { actions } }),

  // ------------------------------------------------------------ templates
  templates: (): Promise<TemplateRow[]> =>
    request<{ templates: TemplateRow[] }>("/api/templates").then((r) => r.templates),
  saveTemplate: (id: string, name: string): Promise<TemplateRow> =>
    request<TemplateRow>(`/api/events/${enc(id)}/template`, { body: { name } }),
  startFromTemplate: (id: string, name: string, date: string): Promise<PlanSummary> =>
    request<PlanSummary>(`/api/templates/${enc(id)}/use`, { body: { name, date } }),
  deleteTemplate: (id: string): Promise<unknown> =>
    request(`/api/templates/${enc(id)}`, { method: "DELETE" }),

  // ------------------------------------------------------------ comments
  comments: (id: string, recordType: string, recordId: string): Promise<CommentView[]> =>
    request<{ comments: CommentView[] }>(
      `/api/events/${enc(id)}/comments?type=${enc(recordType)}&record=${enc(recordId)}`,
    ).then((r) => r.comments),
  addComment: (id: string, recordType: string, recordId: string, body: string): Promise<CommentView> =>
    request<CommentView>(`/api/events/${enc(id)}/comments`, { body: { recordType, recordId, body } }),
};

/** The full address of a shared link. */
export function publicUrl(kind: PublicKind, token: string): string {
  return `${window.location.origin}/${PUBLIC_PATH[kind]}/${token}`;
}

/** The full join link for an invite token. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`;
}
