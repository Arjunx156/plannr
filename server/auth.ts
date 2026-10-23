import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, emailOTP } from "better-auth/plugins";
import { schema } from "./db/schema";
import type { Db } from "./db/types";
import { moveOwnership } from "./plans";

/**
 * Sign-in for Plannr. Three ways in, each switched on by configuration:
 * - guest: always on; the plan is saved on the server and the guest can add Google or an
 *   email later without losing anything,
 * - email code: when RESEND_API_KEY and EMAIL_FROM are set (or in development, where the
 *   code is printed to the server log),
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

export interface SignInMethods {
  guest: true;
  email: boolean;
  google: boolean;
}

const DEV_SECRET = "plannr-development-secret-not-for-production-use";

/** Codes sent in development, so tests can sign in by email without a mail server. */
export const devOutbox = new Map<string, string>();

/** Not NODE_ENV: Vite sets that to "production" for local preview builds too. */
export function isProduction(env: AuthEnv): boolean {
  return env.PLANNR_ENV === "production" || !!env.VERCEL_URL;
}

export function signInMethods(env: AuthEnv): SignInMethods {
  return {
    guest: true,
    email: !!(env.RESEND_API_KEY && env.EMAIL_FROM) || !isProduction(env),
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
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
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
    if (!res.ok) throw new Error(`Email failed: ${res.status}`);
    return;
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
    socialProviders: methods.google
      ? { google: { clientId: env.GOOGLE_CLIENT_ID ?? "", clientSecret: env.GOOGLE_CLIENT_SECRET ?? "" } }
      : undefined,
    plugins: [
      anonymous({
        emailDomainName: "guest.plannr.invalid",
        generateName: () => "Guest planner",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await moveOwnership(db, anonymousUser.user.id, newUser.user.id);
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
