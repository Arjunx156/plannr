import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { schema } from "./schema";

/** Any Postgres connection Plannr runs on: Neon over HTTP in production, PGlite locally. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
