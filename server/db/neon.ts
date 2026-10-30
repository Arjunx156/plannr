import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "./schema.js";
import type { Db } from "./types.js";

/** Neon over HTTP: one round trip per query, no connection to keep warm in a serverless function. */
export function createNeonDb(url: string): Db {
  // Each driver brands its database with its own result type; Plannr's queries only use the shared Postgres API.
  return drizzle(neon(url), { schema }) as unknown as Db;
}
