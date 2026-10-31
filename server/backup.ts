import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { del, list, put } from "@vercel/blob";
import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { account, user } from "./db/authSchema";
import { changes, comments, events, invites, links, members, pushSubs, templates } from "./db/schema";
import type { Db } from "./db/types";

/**
 * Nightly backups. Every table that matters (accounts, plans, members, history, links,
 * templates) is exported, compressed and encrypted with AES-256-GCM under BACKUP_KEY before
 * it leaves the server, then kept in the Blob store for 14 days. Without the key a backup is
 * unreadable noise. Sessions, counts and error logs are left out: nothing is lost without them.
 */

/** In the order they must be restored: each table only points at tables above it. */
export const BACKUP_TABLES: [string, PgTable][] = [
  ["user", user],
  ["account", account],
  ["events", events],
  ["members", members],
  ["invites", invites],
  ["changes", changes],
  ["comments", comments],
  ["links", links],
  ["templates", templates],
  ["push_subs", pushSubs],
];

const MAGIC = Buffer.from("PLNB1");
const KEEP_DAYS = 14;

export interface Backup {
  version: 1;
  at: string;
  tables: Record<string, Record<string, unknown>[]>;
}

export function backupKey(raw: string | undefined): Buffer | undefined {
  if (!raw) return undefined;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : undefined;
}

export async function exportTables(db: Db): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const [name, table] of BACKUP_TABLES)
    tables[name] = (await db.select().from(table)) as Record<string, unknown>[];
  return { version: 1, at: new Date().toISOString(), tables };
}

export function encrypt(backup: Backup, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(gzipSync(JSON.stringify(backup))), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decrypt(bytes: Buffer, key: Buffer): Backup {
  if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Not a Plannr backup");
  const iv = bytes.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = bytes.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(bytes.subarray(MAGIC.length + 28)), decipher.final()]);
  return JSON.parse(gunzipSync(plain).toString("utf8")) as Backup;
}

/** Loads a backup into a database, skipping rows that are already there. */
export async function restore(db: Db, backup: Backup): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [name, table] of BACKUP_TABLES) {
    const rows = backup.tables[name] ?? [];
    const cols = getTableColumns(table);
    // Timestamps travel as text in JSON; the database wants dates back.
    const dated = Object.entries(cols)
      .filter(([, c]) => c.dataType === "date")
      .map(([k]) => k);
    const ready = rows.map((r) => {
      const out = { ...r };
      for (const k of dated) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
      return out;
    });
    for (let i = 0; i < ready.length; i += 200)
      await db
        .insert(table)
        .values(ready.slice(i, i + 200) as never)
        .onConflictDoNothing();
    counts[name] = ready.length;
  }
  return counts;
}

/** Tonight's backup into the Blob store, and backups older than two weeks removed. */
export async function nightlyBackup(
  db: Db,
  env: Record<string, string | undefined>,
): Promise<{ stored: string; bytes: number; removed: number } | { skipped: string }> {
  const key = backupKey(env.BACKUP_KEY);
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!key || !token) return { skipped: "Backups need BACKUP_KEY and BLOB_READ_WRITE_TOKEN" };
  const bytes = encrypt(await exportTables(db), key);
  const day = new Date().toISOString().slice(0, 10);
  const blob = await put(`backups/${day}.plannr-backup`, bytes, {
    access: "public",
    token,
    // An unguessable name on top of the encryption.
    addRandomSuffix: true,
    contentType: "application/octet-stream",
  });
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  const old: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "backups/", token, cursor });
    for (const b of page.blobs) if (b.uploadedAt.getTime() < cutoff) old.push(b.url);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (old.length > 0) await del(old, { token });
  return { stored: blob.pathname, bytes: bytes.length, removed: old.length };
}
