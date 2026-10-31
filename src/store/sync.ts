import { ApiError, api } from "../lib/api";
import type { EventAction } from "../shared/engine";
import type { Action } from "./types";

/** The server takes at most this many changes per request. */
const BATCH = 50;
const MAX_DELAY = 30_000;

/**
 * Sends plan changes to the server in order, one request per plan at a time.
 * Each change is already applied on screen; the server's copy replaces it once every
 * change for that plan has landed, so edits by co-planners show up too.
 * Offline or server trouble: changes wait and retry with backoff. A change the server
 * refuses is dropped, and the plan is reloaded so the screen matches what was saved.
 */
const OUTBOX_KEY = "plannr:outbox";

interface Outbox {
  userId: string;
  actions: EventAction[];
}

export class SyncQueue {
  private pending = new Map<string, EventAction[]>();
  private inflight = new Map<string, EventAction[]>();
  private failures = new Map<string, number>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly dispatch: (a: Action) => void;
  /** Whose changes these are; the outbox is only kept for a known account. */
  private owner: string | undefined;

  constructor(dispatch: (a: Action) => void) {
    this.dispatch = dispatch;
  }

  /**
   * Picks up changes made offline in an earlier visit, so a check-in or a ticked task at a
   * venue with no signal still reaches the server once the phone is back online.
   */
  resume(userId: string): void {
    this.owner = userId;
    let saved: Outbox | undefined;
    try {
      saved = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "null") ?? undefined;
    } catch {
      saved = undefined;
    }
    if (!saved || saved.userId !== userId || !saved.actions?.length) return;
    for (const a of saved.actions) {
      const list = this.pending.get(a.eventId) ?? [];
      list.push(a);
      this.pending.set(a.eventId, list);
    }
    this.report();
    this.flushAll();
  }

  /** Forgets everything waiting: signing out on a shared phone leaves nothing behind. */
  forget(): void {
    this.owner = undefined;
    this.pending.clear();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.failures.clear();
    try {
      localStorage.removeItem(OUTBOX_KEY);
    } catch {
      // Nothing saved to remove.
    }
    this.report();
  }

  private save(): void {
    if (!this.owner) return;
    const actions = [...this.inflight.values(), ...this.pending.values()].flat();
    try {
      if (actions.length > 0)
        localStorage.setItem(OUTBOX_KEY, JSON.stringify({ userId: this.owner, actions }));
      else localStorage.removeItem(OUTBOX_KEY);
    } catch {
      // Storage full: changes still sync while this tab stays open.
    }
  }

  enqueue(action: EventAction): void {
    const list = this.pending.get(action.eventId) ?? [];
    list.push(action);
    this.pending.set(action.eventId, list);
    this.report();
    // Changes made in the same tick go in one request.
    if (list.length === 1) queueMicrotask(() => this.flush(action.eventId));
  }

  /** True while a plan has changes the server hasn't saved yet. */
  has(id: string): boolean {
    return !!this.pending.get(id)?.length || this.inflight.has(id);
  }

  pendingIds(): string[] {
    return [...new Set([...this.pending.keys(), ...this.inflight.keys()])].filter((id) => this.has(id));
  }

  flushAll(): void {
    for (const id of this.pending.keys()) {
      const timer = this.timers.get(id);
      if (timer) clearTimeout(timer);
      this.timers.delete(id);
      this.failures.delete(id);
      void this.flush(id);
    }
  }

  private count(): number {
    let n = 0;
    for (const list of this.pending.values()) n += list.length;
    for (const list of this.inflight.values()) n += list.length;
    return n;
  }

  private report(patch: { offline?: boolean } = {}): void {
    this.save();
    this.dispatch({ type: "syncStatus", patch: { pending: this.count(), ...patch } });
  }

  private async flush(id: string): Promise<void> {
    if (this.inflight.has(id) || this.timers.has(id)) return;
    const list = this.pending.get(id);
    if (!list?.length) return;
    const batch = list.splice(0, BATCH);
    this.inflight.set(id, batch);
    try {
      const saved = await api.actions(id, batch);
      this.inflight.delete(id);
      this.failures.delete(id);
      if (this.has(id)) {
        this.report({ offline: false });
        return this.flush(id);
      }
      this.pending.delete(id);
      this.dispatch({ type: "syncPlan", plan: saved });
      this.report({ offline: false });
    } catch (e) {
      this.inflight.delete(id);
      const status = e instanceof ApiError ? e.status : 0;
      const retry = status === 0 || status >= 500 || status === 408 || status === 429;
      if (retry) {
        list.unshift(...batch);
        const tries = (this.failures.get(id) ?? 0) + 1;
        this.failures.set(id, tries);
        const delay = Math.min(MAX_DELAY, 1000 * 2 ** (tries - 1));
        this.timers.set(
          id,
          setTimeout(() => {
            this.timers.delete(id);
            void this.flush(id);
          }, delay),
        );
        this.report({ offline: status === 0 });
        return;
      }
      this.dispatch({
        type: "toast",
        toast: { id: `sync-${id}`, text: (e as Error).message || "That change couldn't be saved" },
      });
      if (this.has(id)) {
        this.report();
        return this.flush(id);
      }
      this.pending.delete(id);
      this.report();
      await this.reload(id);
    }
  }

  /** Puts the server's copy back on screen after a refused change. */
  private async reload(id: string): Promise<void> {
    try {
      const plan = await api.plan(id);
      if (!this.has(id)) this.dispatch({ type: "syncPlan", plan });
    } catch {
      // The next freshness check will try again.
    }
  }
}
