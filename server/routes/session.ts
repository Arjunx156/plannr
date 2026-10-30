import { trustedOrigins } from "../auth";
import type { Api, RouteDeps } from "./kit";

/**
 * Everything registered after this needs a session. Writes must also come from Plannr's own
 * pages: the session cookie alone isn't proof of intent. Browsers send Origin on every write;
 * when one doesn't, Sec-Fetch-Site still names a caller from another site.
 */
export function requireSession(app: Api, { env, auth }: RouteDeps): void {
  const origins = trustedOrigins(env);
  app.use("*", async (c, next) => {
    const origin = c.req.header("origin");
    const site = c.req.header("sec-fetch-site");
    const crossSite = origin ? !origins.includes(origin) : site === "cross-site" || site === "same-site";
    if (c.req.method !== "GET" && crossSite) return c.json({ error: "Requests must come from Plannr" }, 403);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Sign in to continue" }, 401);
    c.set("userId", session.user.id);
    await next();
  });
}
