import type { Plugin } from "vite";

/**
 * The service worker, written at build time with the list of files the app needs, so
 * every screen opens without a signal: at a venue, in a hall basement, on the day.
 * Plans themselves already live on the device; this keeps the app around them.
 * Shared pages and the API always go to the network.
 */
export function plannrOffline(): Plugin {
  return {
    name: "plannr-offline",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|woff2)$/.test(f) && !f.endsWith(".map"))
        .map((f) => `/${f}`);
      const version = hash(files.join("|"));
      this.emitFile({ type: "asset", fileName: "sw.js", source: worker(version, files) });
    },
  };
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const SHARED = /^\/(e|r|h|v|s|fund|a|stalls|gate)\//;

function worker(version: string, files: string[]): string {
  return `// Plannr offline support. Generated at build time; do not edit.
const CACHE = "plannr-${version}";
const SHELL = "/";
const FILES = ${JSON.stringify(["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", ...files])};
const SHARED = ${SHARED.toString()};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // One missing file must not stop the rest from being cached.
      Promise.all(FILES.map((f) => cache.add(new Request(f, { cache: "reload" })).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("plannr-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    if (SHARED.test(url.pathname)) return;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || Response.error())),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || /\\.(png|svg|webmanifest)$/.test(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Plannr";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "plannr",
      data: { url: data.url || "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/today", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url === target && "focus" in w) return w.focus();
      return self.clients.openWindow(target);
    }),
  );
});
`;
}
