import { z } from "zod";

/**
 * Every setting the server reads, parsed once at start-up. All are optional: each feature switches itself
 * off when its keys are missing (no Gemini key, no AI; no Resend key, codes go to the dev outbox). A value
 * that is present but malformed stops the server with a message naming the setting.
 */

const text = z.string().trim().min(1).optional();
const url = z.url().optional();

const ENV = z.object({
  // Database and storage
  DATABASE_URL: url,
  /** "memory" runs on an in-process PGlite database; anything else uses DATABASE_URL. */
  PLANNR_DB: text,
  BLOB_READ_WRITE_TOKEN: text,
  /** Encrypts nightly backups; without it, backups are skipped. */
  BACKUP_KEY: text,

  // Sign-in
  BETTER_AUTH_SECRET: text,
  BETTER_AUTH_URL: url,
  GOOGLE_CLIENT_ID: text,
  GOOGLE_CLIENT_SECRET: text,
  RESEND_API_KEY: text,
  EMAIL_FROM: text,
  /** Comma-separated addresses that may open the admin page. */
  ADMIN_EMAILS: text,

  // Gemini
  GEMINI_API_KEY: text,
  GEMINI_MODEL: text,
  GEMINI_FALLBACK_MODEL: text,

  // Reminders
  VAPID_PUBLIC_KEY: text,
  VAPID_PRIVATE_KEY: text,
  /** Vercel Cron sends it so only the scheduler can trigger reminders and backups. */
  CRON_SECRET: text,

  // Where the app runs
  SITE_URL: url,
  PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  /** "production" on a self-hosted server; Vercel deployments are detected on their own. */
  PLANNR_ENV: text,
  VERCEL_URL: text,
  VERCEL_BRANCH_URL: text,
  VERCEL_PROJECT_PRODUCTION_URL: text,
  VERCEL_GIT_COMMIT_SHA: text,

  /** Development and tests only: lets the journey tests read the last email code. */
  PLANNR_DEV_OUTBOX: text,
});

/** The server's settings, with every key it knows about and nothing else. */
export type ServerEnv = z.infer<typeof ENV>;

/** Thrown at start-up when a setting is present but can't be used. */
export class EnvError extends Error {
  override name = "EnvError";
}

/** Reads the settings from a source (the process environment by default); unknown keys are dropped. */
export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  // An empty string means "not set", the way shells and hosting dashboards write it.
  const present = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = ENV.safeParse(present);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  throw new EnvError(`Plannr can't start with these settings:\n  ${problems.join("\n  ")}`);
}
