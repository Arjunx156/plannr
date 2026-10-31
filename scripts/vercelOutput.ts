import { SECURITY_HEADERS } from "../server/security";
import { PUBLIC_ROUTES } from "../server/seo";

/** One routing rule in Vercel's Build Output API. */
export type VercelRoute =
  | { src: string; headers: Record<string, string>; continue: true }
  | { src: string; dest: string }
  | { handle: "filesystem" };

/** The Build Output API's config.json: the morning cron, and how each request is routed. */
export function outputConfig(): {
  version: 3;
  crons: { path: string; schedule: string }[];
  routes: VercelRoute[];
} {
  return {
    version: 3,
    // Morning reminders at 8:00 in India (02:30 UTC).
    crons: [{ path: "/api/cron/daily", schedule: "30 2 * * *" }],
    routes: [
      {
        src: "/assets/(.*)",
        headers: { "cache-control": "public, max-age=31536000, immutable" },
        continue: true,
      },
      // Before any route answers, so pages, the API, assets and errors all carry them.
      { src: "/(.*)", headers: { ...SECURITY_HEADERS }, continue: true },
      // Public pages are served pre-rendered; the app takes over once it loads.
      { src: "^/$", dest: "/prerendered/index.html" },
      {
        // Routes are plain lower-case paths, so they need no escaping in the pattern.
        src: `^/(${PUBLIC_ROUTES.filter((r) => r !== "/")
          .map((r) => r.slice(1))
          .join("|")})/?$`,
        dest: "/prerendered/$1.html",
      },
      { handle: "filesystem" },
      { src: "/api(/.*)?", dest: "/api" },
      // Shared links get their own title and description for WhatsApp previews.
      { src: "/(e|r|h|v|s|fund|a|stalls|gate)/[\\w-]+/?", dest: "/api" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  };
}
