import type { PlannrEvent } from "../data/types";
import type { EventAction } from "../shared/engine";
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
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
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
  if (!res.ok) {
    const message =
      (data as { error?: string; message?: string } | null)?.error ??
      (data as { message?: string } | null)?.message ??
      "Something went wrong";
    throw new ApiError(res.status, message);
  }
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
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "The photo didn't upload. Try again.");
  return data as T;
}

export const api = {
  // ------------------------------------------------------------ accounts
  methods: () =>
    request<SignInMethods>("/api/auth/methods").catch(() => ({ guest: false, email: false, google: false })),
  async me(): Promise<AccountUser | null> {
    try {
      return (await request<{ user: AccountUser | null }>("/api/me")).user;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 503 || e.status === 404)) return null;
      throw e;
    }
  },
  signInGuest: () => request<{ user: AccountUser }>("/api/auth/sign-in/anonymous", { body: {} }),
  sendCode: (email: string) =>
    request<{ success: boolean }>("/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    }),
  verifyCode: (email: string, otp: string) =>
    request<{ user: AccountUser }>("/api/auth/sign-in/email-otp", { body: { email, otp } }),
  /** Starts Google sign-in; the browser goes to the returned url. Paths are where Google sends them back. */
  google: (to: { callbackURL: string; newUserCallbackURL: string; errorCallbackURL: string }) =>
    request<{ url: string }>("/api/auth/sign-in/social", {
      body: { provider: "google", disableRedirect: true, ...to },
    }),
  rename: (name: string) => request<{ status: boolean }>("/api/auth/update-user", { body: { name } }),
  signOut: () => request<{ success: boolean }>("/api/auth/sign-out", { body: {} }),

  // ------------------------------------------------------------ plans
  plans: () => request<{ plans: PlanSummary[] }>("/api/events").then((r) => r.plans),
  plan: (id: string) => request<PlanSummary>(`/api/events/${enc(id)}`),
  createPlan: (event: PlannrEvent) => request<PlanSummary>("/api/events", { body: { event } }),
  version: (id: string) =>
    request<{ version: number }>(`/api/events/${enc(id)}/version`).then((r) => r.version),
  actions: (id: string, actions: EventAction[]) =>
    request<{ event: PlannrEvent; version: number }>(`/api/events/${enc(id)}/actions`, { body: { actions } }),
  history: (id: string) =>
    request<{ history: HistoryEntry[] }>(`/api/events/${enc(id)}/history`).then((r) => r.history),
  undo: (id: string, change: string, redo = false) =>
    request<{ event: PlannrEvent; version: number }>(
      `/api/events/${enc(id)}/history/${enc(change)}/${redo ? "redo" : "undo"}`,
      { body: {} },
    ),

  activity: () => request<{ activity: ActivityEntry[] }>("/api/activity").then((r) => r.activity),

  // ------------------------------------------------------------ people
  members: (id: string) =>
    request<{ members: Member[] }>(`/api/events/${enc(id)}/members`).then((r) => r.members),
  updateMember: (
    id: string,
    userId: string,
    patch: { role?: Exclude<Role, "owner">; side?: string | null },
  ) => request(`/api/events/${enc(id)}/members/${enc(userId)}`, { method: "PATCH", body: patch }),
  removeMember: (id: string, userId: string) =>
    request(`/api/events/${enc(id)}/members/${enc(userId)}`, { method: "DELETE" }),
  createInvite: (id: string, role: Exclude<Role, "owner">, side?: string | null) =>
    request<{ token: string; expiresAt: string }>(`/api/events/${enc(id)}/invites`, { body: { role, side } }),
  invite: (token: string) => request<InvitePreview>(`/api/invites/${enc(token)}`),
  acceptInvite: (token: string) =>
    request<{ eventId: string; role: Role }>(`/api/invites/${enc(token)}/accept`, { body: {} }),

  // ------------------------------------------------------------ shared links
  links: (id: string) => request<{ links: LinkRow[] }>(`/api/events/${enc(id)}/links`).then((r) => r.links),
  linkFor: (id: string, kind: LinkKind, target = "") =>
    request<LinkRow>(`/api/events/${enc(id)}/links`, { body: { kind, target } }),
  revokeLink: (id: string, token: string) =>
    request(`/api/events/${enc(id)}/links/${enc(token)}`, { method: "DELETE" }),
  renameSite: (id: string, slug: string) =>
    request<LinkRow>(`/api/events/${enc(id)}/site-address`, { method: "PUT", body: { slug } }),
  deleteAccount: () =>
    request<{ handedOver: number; deleted: number }>("/api/account/delete", { body: { confirm: "DELETE" } }),
  pushKey: () => request<{ key: string | null }>("/api/push/key"),
  pushOn: (sub: PushSubscriptionJSON) => request<{ ok: true }>("/api/push", { body: sub }),
  pushOff: (endpoint: string) => request<{ ok: true }>("/api/push/remove", { body: { endpoint } }),
  publicView: (token: string) => request<PublicView>(`/api/p/${enc(token)}`),
  /** Adds a photo to a shared album: the image goes up as it is, the server checks and stores it. */
  albumPhoto: (token: string, photo: Blob, by: string) =>
    upload<PublicView>(`/api/p/${enc(token)}/photo?by=${enc(by)}`, photo),
  eventPhoto: (eventId: string, photo: Blob) =>
    upload<{ url: string }>(`/api/events/${enc(eventId)}/photo`, photo),
  publicActions: (token: string, actions: unknown[]) =>
    request<PublicView>(`/api/p/${enc(token)}/actions`, { body: { actions } }),

  // ------------------------------------------------------------ templates
  templates: () => request<{ templates: TemplateRow[] }>("/api/templates").then((r) => r.templates),
  saveTemplate: (id: string, name: string) =>
    request<TemplateRow>(`/api/events/${enc(id)}/template`, { body: { name } }),
  startFromTemplate: (id: string, name: string, date: string) =>
    request<PlanSummary>(`/api/templates/${enc(id)}/use`, { body: { name, date } }),
  deleteTemplate: (id: string) => request(`/api/templates/${enc(id)}`, { method: "DELETE" }),

  // ------------------------------------------------------------ comments
  comments: (id: string, recordType: string, recordId: string) =>
    request<{ comments: CommentView[] }>(
      `/api/events/${enc(id)}/comments?type=${enc(recordType)}&record=${enc(recordId)}`,
    ).then((r) => r.comments),
  addComment: (id: string, recordType: string, recordId: string, body: string) =>
    request<CommentView>(`/api/events/${enc(id)}/comments`, { body: { recordType, recordId, body } }),
};

/** The full address of a shared link. */
export function publicUrl(kind: PublicKind, token: string): string {
  return `${window.location.origin}/${PUBLIC_PATH[kind]}/${token}`;
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`;
}
