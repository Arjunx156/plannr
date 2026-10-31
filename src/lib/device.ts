import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * What this phone or browser can do for Plannr: install it like an app, keep working
 * offline, and show the morning reminder.
 */

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const tell = () => {
  for (const l of listeners) l();
};

/** Called once at start-up: the browser offers installing only once, early. */
export function startDevice(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    tell();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    tell();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator)
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Without it the app still works; it just needs a signal to open.
      });
    });
}

const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

type InstallState = "installed" | "ready" | "ios" | "unavailable";

/** Installed already; installable with one tap; installable by hand (iOS Share menu); or not at all. */
function installState(): InstallState {
  if (standalone()) return "installed";
  if (deferred) return "ready";
  return isIos() ? "ios" : "unavailable";
}

/** Whether Plannr can be added to the home screen, and the button that does it. */
export function useInstall(): {
  state: InstallState;
  install: () => Promise<void>;
} {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const state = installState();
  return {
    state,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
      deferred = null;
      tell();
    },
  };
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type ReminderState = "on" | "off" | "blocked" | "unsupported" | "unavailable";

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return undefined;
  return (await navigator.serviceWorker.getRegistration()) ?? undefined;
}

export async function reminderState(): Promise<ReminderState> {
  if (typeof Notification === "undefined") return "unsupported";
  const reg = await registration();
  if (!reg) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const { key } = await api.pushKey().catch(() => ({ key: null }));
  if (!key) return "unavailable";
  return (await reg.pushManager.getSubscription()) ? "on" : "off";
}

/** Asks permission, subscribes this device and tells the server. */
export async function remindersOn(): Promise<ReminderState> {
  const reg = await registration();
  if (!reg) return "unsupported";
  const { key } = await api.pushKey();
  if (!key) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await api.pushOn(sub.toJSON());
  return "on";
}

export async function remindersOff(): Promise<ReminderState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.pushOff(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "off";
}
