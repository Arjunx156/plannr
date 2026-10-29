import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { SignInMethods } from "../src/shared/types";
import { schema, user } from "./db/schema";
import type { Db } from "./db/types";
import { moveOwnership } from "./plans";

/**
 * Sign-in for Plannr. Three ways in, each switched on by configuration:
 * - guest: always on; the plan is saved on the server and the guest can add Google or an
 *   email later without losing anything,
 * - email code: when RESEND_API_KEY is set and EMAIL_FROM is on a verified domain (or in
 *   development, where the code is printed to the server log),
 * - Google: when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 */

export interface AuthEnv {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  /** "production" on a self-hosted server; Vercel deployments are detected on their own. */
  PLANNR_ENV?: string;
}

const DEV_SECRET = "plannr-development-secret-not-for-production-use";

/**
 * Better Auth answers "sent" even when an email fails, so nobody can probe which addresses
 * exist. The API wraps each auth request in this store to tell the person their code didn't go.
 */
export const mailFailure = new AsyncLocalStorage<{ message?: string }>();

/** Codes sent in development, so tests can sign in by email without a mail server. */
export const devOutbox = new Map<string, string>();

/** Not NODE_ENV: Vite sets that to "production" for local preview builds too. */
export function isProduction(env: AuthEnv): boolean {
  return env.PLANNR_ENV === "production" || !!env.VERCEL_URL;
}

/**
 * Email codes are offered only when they can reach anyone. Resend's shared test sender
 * (onboarding@resend.dev) delivers to the account owner alone, so it doesn't count; a sender
 * on the family's own verified domain does.
 */
export function canEmailEveryone(env: AuthEnv): boolean {
  return !!(env.RESEND_API_KEY && env.EMAIL_FROM) && !/@resend\.dev\b/i.test(env.EMAIL_FROM ?? "");
}

export function signInMethods(env: AuthEnv): SignInMethods {
  return {
    guest: true,
    email: canEmailEveryone(env) || !isProduction(env),
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  };
}

const https = (host?: string) => (host ? `https://${host}` : undefined);

export function trustedOrigins(env: AuthEnv): string[] {
  const list = [
    env.BETTER_AUTH_URL,
    https(env.VERCEL_PROJECT_PRODUCTION_URL),
    https(env.VERCEL_BRANCH_URL),
    https(env.VERCEL_URL),
  ];
  if (!isProduction(env))
    list.push("http://localhost:5173", "http://localhost:4173", "http://localhost:3000");
  return [...new Set(list.filter((x): x is string => !!x))];
}

async function sendCode(env: AuthEnv, email: string, otp: string): Promise<void> {
  if (canEmailEveryone(env)) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: email,
        subject: `${otp} is your Plannr code`,
        text: `Your Plannr sign-in code is ${otp}. It works for 5 minutes. If you didn't ask for it, ignore this email.`,
      }),
    });
    if (res.ok) return;
    console.error(`[auth] Resend refused a sign-in code: ${res.status} ${(await res.text()).slice(0, 300)}`);
    // Until the sender's domain is verified, Resend only delivers to the account's own address.
    const message =
      res.status === 403 || res.status === 422
        ? "We can't email a code to that address yet. Continue as a guest for now and add your email later."
        : "The code didn't send. Try again in a minute.";
    const box = mailFailure.getStore();
    if (box) box.message = message;
    throw new Error(message);
  }
  if (isProduction(env)) throw new Error("Email sign-in isn't set up on this server yet");
  devOutbox.set(email.toLowerCase(), otp);
  console.log(`[auth] sign-in code for ${email}: ${otp}`);
}

export function createAuth(db: Db, env: AuthEnv) {
  const methods = signInMethods(env);
  const origins = trustedOrigins(env);
  if (isProduction(env) && !env.BETTER_AUTH_SECRET)
    throw new Error("BETTER_AUTH_SECRET is required in production");
  return betterAuth({
    appName: "Plannr",
    basePath: "/api/auth",
    baseURL: env.BETTER_AUTH_URL ?? origins[0],
    secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    trustedOrigins: origins,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
    // Better Auth decides "production" from NODE_ENV, which local preview builds set too.
    // Guests share IPs behind mobile carriers, so starting one is allowed more often than
    // a password-style sign-in; sending codes keeps the email plugin's own stricter limit.
    rateLimit: {
      enabled: isProduction(env),
      window: 60,
      max: 200,
      customRules: { "/sign-in/anonymous": { window: 60, max: 20 } },
    },
    socialProviders: methods.google
      ? { google: { clientId: env.GOOGLE_CLIENT_ID ?? "", clientSecret: env.GOOGLE_CLIENT_SECRET ?? "" } }
      : undefined,
    plugins: [
      anonymous({
        emailDomainName: "guest.plannr.invalid",
        generateName: () => "Guest planner",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await moveOwnership(db, anonymousUser.user.id, newUser.user.id);
          // A new email account has no name yet; keep the one the guest already chose.
          const guestName = anonymousUser.user.name?.trim();
          if (!newUser.user.name?.trim() && guestName && guestName !== "Guest planner")
            await db.update(user).set({ name: guestName }).where(eq(user.id, newUser.user.id));
        },
      }),
      ...(methods.email
        ? [
            emailOTP({
              otpLength: 6,
              expiresIn: 300,
              sendVerificationOTP: async ({ email, otp }) => sendCode(env, email, otp),
            }),
          ]
        : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
