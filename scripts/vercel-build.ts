/**
 * Builds Plannr for Vercel with the Build Output API: the static app from dist/, plus the
 * API as one bundled Node function, so nothing depends on how Vercel resolves imports.
 * Runs migrations first when DATABASE_URL is set. Usage: `bun scripts/vercel-build.ts`.
 */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CSP_HEADER } from "../server/security";
import { PUBLIC_ROUTES } from "../server/seo";

const root = join(import.meta.dir, "..");
const out = join(root, ".vercel", "output");
const fn = join(out, "functions", "api.func");

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: "inherit", stderr: "inherit", env: process.env });
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(" ")} failed`);
}

if (process.env.DATABASE_URL) {
  console.log("Running database migrations");
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  await migrate(drizzle(neon(process.env.DATABASE_URL)), {
    migrationsFolder: join(root, "server/db/migrations"),
  });
} else {
  console.log("No DATABASE_URL: skipping migrations; accounts stay off until a database is connected");
}

await run(["bun", "x", "tsc", "-b"]);
await run(["bun", "x", "vite", "build"]);
await run(["bun", "scripts/prerender.ts"]);

await rm(out, { recursive: true, force: true });
await mkdir(fn, { recursive: true });
await cp(join(root, "dist"), join(out, "static"), { recursive: true });

const indexHtml = await Bun.file(join(root, "dist", "index.html")).text();
const bundle = await Bun.build({
  entrypoints: [join(root, "server", "vercel.ts")],
  define: { __INDEX_HTML__: JSON.stringify(indexHtml) },
  target: "node",
  format: "esm",
  minify: { syntax: true, whitespace: true },
  sourcemap: "none",
});
if (!bundle.success) {
  for (const log of bundle.logs) console.error(log);
  throw new Error("Bundling the API failed");
}
const [entry] = bundle.outputs;
if (!entry) throw new Error("Bundling produced no output");
await writeFile(join(fn, "index.mjs"), await entry.text());
await writeFile(join(fn, "package.json"), JSON.stringify({ type: "module" }));
await writeFile(
  join(fn, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 60,
      // Next to the Neon database (us-east-1): a request makes several queries, and each one
      // would otherwise cross the world. The browser's one round trip is the cheaper one.
      regions: ["iad1"],
    },
    null,
    2,
  ),
);

const security = {
  "content-security-policy": CSP_HEADER,
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  // The camera scans QR codes at the gate; the microphone is for voice input.
  "permissions-policy": "camera=(self), geolocation=(), microphone=(self)",
};
await writeFile(
  join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      // Morning reminders at 8:00 in India (02:30 UTC).
      crons: [{ path: "/api/cron/daily", schedule: "30 2 * * *" }],
      routes: [
        {
          src: "/assets/(.*)",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { src: "/(.*)", headers: security, continue: true },
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
    },
    null,
    2,
  ),
);
console.log(`Vercel output written: ${(entry.size / 1024).toFixed(0)} KB API bundle`);
