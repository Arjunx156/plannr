import { existsSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "./schema.js";
import type { Db } from "./types.js";

// Next to this file normally; from the project root when Vite has bundled it into its config.
const MIGRATIONS = [
  join(import.meta.dirname, "migrations"),
  join(process.cwd(), "server", "db", "migrations"),
].find((dir) => existsSync(join(dir, "meta", "_journal.json")));

/**
 * Postgres running inside this process, for development and tests. Pass a directory to
 * keep data between restarts; leave it out for a throwaway in-memory database.
 */
export async function createLocalDb(dataDir?: string): Promise<Db> {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  if (!MIGRATIONS) throw new Error("Can't find server/db/migrations");
  await migrate(db, { migrationsFolder: MIGRATIONS });
  // Each driver brands its database with its own result type; Plannr's queries only use the shared Postgres API.
  return db as unknown as Db;
}
