/**
 * What Plannr sends to the services it uses: photos and backups to Vercel Blob, reminders through web push.
 * Both services are stood in for at the module, so these tests check what's sent and how answers are read.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { createLocalDb } from "../../server/db/local";
import { OWN_DB_MS } from "./fixtures";

/** One stored file, as Vercel Blob lists it. */
interface Stored {
  pathname: string;
  url: string;
  uploadedAt: Date;
}

const stored: { pathname: string; body: Buffer; options: Record<string, unknown> }[] = [];
const removed: string[][] = [];
/** What the store lists, a page at a time. */
let pages: Stored[][] = [];

mock.module("@vercel/blob", () => ({
  put: async (pathname: string, body: Buffer, options: Record<string, unknown>) => {
    stored.push({ pathname, body, options });
    return { pathname, url: `https://plannr.public.blob.vercel-storage.com/${pathname}` };
  },
  list: async ({ cursor }: { cursor?: string }) => {
    const page = Number(cursor ?? 0);
    const more = page + 1 < pages.length;
    return { blobs: pages[page] ?? [], hasMore: more, ...(more ? { cursor: String(page + 1) } : {}) };
  },
  del: async (urls: string[]) => {
    removed.push(urls);
  },
}));

const pushed: { endpoint: string; payload: string; subject: unknown }[] = [];
/** What the push service throws next, if anything. */
let pushFailure: unknown;

mock.module("web-push", () => ({
  default: {
    sendNotification: async (
      sub: { endpoint: string },
      payload: string,
      options: { vapidDetails: { subject: unknown } },
    ) => {
      if (pushFailure) throw pushFailure;
      pushed.push({ endpoint: sub.endpoint, payload, subject: options.vapidDetails.subject });
    },
  },
}));

// Imported after the mocks, so they use the stand-ins.
const { backupKey, decrypt, nightlyBackup } = await import("../../server/backup");
const { blobStore } = await import("../../server/photos");
const { webPushSender } = await import("../../server/reminders");

beforeEach(() => {
  stored.length = 0;
  removed.length = 0;
  pushed.length = 0;
  pages = [];
  pushFailure = undefined;
});

describe("photos", () => {
  test("go to the event's own folder under a fresh name, typed by what the bytes are", async () => {
    expect(blobStore(undefined)).toBeUndefined();
    const store = blobStore("token");
    const url = await store?.("ev-1", new Uint8Array([1]), "image/png");
    expect(stored[0]?.pathname).toMatch(/^albums\/ev-1\/[0-9a-f-]{36}\.png$/);
    expect(url).toBe(`https://plannr.public.blob.vercel-storage.com/${stored[0]?.pathname}`);
    await store?.("ev-1", new Uint8Array([1]), "image/gif");
    expect(stored[1]?.pathname).toEndWith(".jpg");
  });
});

describe("the nightly backup", () => {
  test("needs a 32-byte key and a store", async () => {
    expect(backupKey(undefined)).toBeUndefined();
    expect(backupKey(Buffer.from("too short").toString("base64"))).toBeUndefined();
    expect(backupKey(randomBytes(32).toString("base64"))?.length).toBe(32);
    const db = await createLocalDb();
    expect(await nightlyBackup(db, { BLOB_READ_WRITE_TOKEN: "token" })).toHaveProperty("skipped");
  });

  test(
    "stores every table encrypted, then removes backups over two weeks old across every page",
    async () => {
      const key = randomBytes(32);
      const old = new Date(Date.now() - 20 * 86_400_000);
      const recent = new Date(Date.now() - 86_400_000);
      const file = (name: string, uploadedAt: Date): Stored => ({
        pathname: `backups/${name}`,
        url: `https://plannr.public.blob.vercel-storage.com/backups/${name}`,
        uploadedAt,
      });
      pages = [[file("a", old), file("b", recent)], [file("c", old)]];
      const db = await createLocalDb();
      const result = await nightlyBackup(db, {
        BACKUP_KEY: key.toString("base64"),
        BLOB_READ_WRITE_TOKEN: "token",
      });
      expect(result).toMatchObject({ removed: 2 });
      expect(removed).toEqual([[file("a", old).url, file("c", old).url]]);
      const [backup] = stored;
      expect(backup?.pathname).toMatch(/^backups\/\d{4}-\d{2}-\d{2}\.plannr-backup$/);
      expect(backup?.options).toMatchObject({ addRandomSuffix: true });
      expect(Object.keys(decrypt(backup?.body ?? Buffer.alloc(0), key).tables)).toContain("events");
    },
    OWN_DB_MS,
  );
});

describe("morning reminders by web push", () => {
  const sub = { endpoint: "https://push.example/1", p256dh: "key", auth: "secret" };
  const msg = { title: "Today for the wedding", body: "Haldi at 9", url: "/today" };
  const keys = { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" };

  test("are off without keys, and signed with the site's address when it has one", async () => {
    expect(webPushSender({})).toBeUndefined();
    expect(await webPushSender({ ...keys, BETTER_AUTH_URL: "https://plannr.in" })?.(sub, msg)).toBe(true);
    await webPushSender({ ...keys, BETTER_AUTH_URL: "http://localhost:3000" })?.(sub, msg);
    expect(pushed.map((p) => p.subject)).toEqual(["https://plannr.in", "mailto:reminders@plannr.app"]);
    expect(JSON.parse(pushed[0]?.payload ?? "{}")).toEqual(msg);
  });

  test("report a device that has unsubscribed, and pass on any other failure", async () => {
    const send = webPushSender(keys);
    pushFailure = { statusCode: 410 };
    expect(await send?.(sub, msg)).toBe(false);
    pushFailure = new Error("push service down");
    await expect(send?.(sub, msg)).rejects.toThrow("push service down");
  });
});
