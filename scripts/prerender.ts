/**
 * Pre-renders the public pages (landing, guides, tools, legal) into dist/prerendered, each
 * with its own title, description and canonical address, so search engines and link
 * previews read real content. Run after `vite build`. Usage: `bun scripts/prerender.ts`.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PUBLIC_ROUTES, siteUrl } from "../server/seo";

const root = join(import.meta.dir, "..");
const ssrOut = join(root, "dist-ssr");

const proc = Bun.spawn(
  ["bun", "x", "vite", "build", "--ssr", "src/prerender.tsx", "--outDir", ssrOut, "--logLevel", "warn"],
  {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  },
);
if ((await proc.exited) !== 0) throw new Error("SSR build failed");

const { render } = (await import(join(ssrOut, "prerender.js"))) as {
  render: (url: string) => { html: string; title: string; description: string };
};
const shell = await Bun.file(join(root, "dist", "index.html")).text();
const site = siteUrl(process.env);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function fileFor(route: string): string {
  return route === "/" ? "index.html" : `${route.slice(1)}.html`;
}

const outDir = join(root, "dist", "prerendered");
await rm(outDir, { recursive: true, force: true });
for (const route of PUBLIC_ROUTES) {
  const { html, title, description } = render(route);
  if (!html.includes("<h1")) throw new Error(`Pre-rendering ${route} produced no heading`);
  let page = shell
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`);
  if (site)
    page = page
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${site}${route === "/" ? "/" : route}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${site}${route === "/" ? "/" : route}$2`);
  const file = join(outDir, fileFor(route));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page);
}
await rm(ssrOut, { recursive: true, force: true });
console.log(`Pre-rendered ${PUBLIC_ROUTES.length} public pages`);
