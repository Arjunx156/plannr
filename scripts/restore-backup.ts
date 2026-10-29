/**
 * Opens a Plannr backup. Needs BACKUP_KEY (the same value as on Vercel).
 *
 *   bun scripts/restore-backup.ts --latest --out backup.json      newest backup (needs BLOB_READ_WRITE_TOKEN)
 *   bun scripts/restore-backup.ts ./2026-11-01-x.plannr-backup     a downloaded file
 *   bun scripts/restore-backup.ts <file> --into postgres://...     load it into a database
 *
 * Loading skips rows that already exist, so it can fill a fresh Neon branch or put back
 * rows deleted by mistake without touching anything else.
 */
import { list } from "@vercel/blob";
import { backupKey, decrypt, restore } from "../server/backup";
import { createNeonDb } from "../server/db/neon";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const key = backupKey(process.env.BACKUP_KEY);
if (!key) {
  console.error("Set BACKUP_KEY to the 32-byte base64 key from Vercel's environment variables.");
  process.exit(1);
}

let source = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (args.includes("--latest")) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("--latest needs BLOB_READ_WRITE_TOKEN");
  const { blobs } = await list({ prefix: "backups/", token });
  const newest = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
  if (!newest) throw new Error("No backups yet");
  source = newest.url;
  console.log(`Newest backup: ${newest.pathname} (${newest.uploadedAt.toISOString()})`);
}
if (!source) {
  console.error("Name a backup file or URL, or pass --latest.");
  process.exit(1);
}

const bytes = /^https?:\/\//.test(source)
  ? Buffer.from(await (await fetch(source)).arrayBuffer())
  : Buffer.from(await Bun.file(source).arrayBuffer());
const backup = decrypt(bytes, key);
console.log(
  `Backup from ${backup.at}: ${Object.entries(backup.tables)
    .map(([t, rows]) => `${rows.length} ${t}`)
    .join(", ")}`,
);

const out = flag("--out");
if (out) {
  await Bun.write(out, JSON.stringify(backup, null, 2));
  console.log(`Written to ${out}`);
}
const into = flag("--into");
if (into) {
  const counts = await restore(createNeonDb(into), backup);
  console.log("Restored (existing rows left as they were):", counts);
}
