import type { Plugin } from "vite";

/** Pages search engines may index. The Reach track adds the guides and tools here. */
export const PUBLIC_ROUTES = ["/"];

/** Signed-in screens: nothing there is useful to a search engine. */
const PRIVATE_PREFIXES = ["/events", "/onboarding", "/new/generating", "/gallery"];

/** The site's public origin, from SITE_URL or the Vercel production domain. */
export function siteUrl(env: Record<string, string | undefined>): string | undefined {
  const raw =
    env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return raw ? raw.replace(/\/+$/, "") : undefined;
}

export function robotsTxt(site?: string): string {
  const lines = ["User-agent: *", "Allow: /", ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`)];
  if (site) lines.push("", `Sitemap: ${site}/sitemap.xml`);
  return `${lines.join("\n")}\n`;
}

export function sitemapXml(site: string): string {
  const urls = PUBLIC_ROUTES.map((r) => `  <url><loc>${site}${r}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Absolute share URLs, a canonical link, robots.txt and a sitemap once the site URL is known. */
export function plannrSeo(env: Record<string, string | undefined>): Plugin {
  const site = siteUrl(env);
  return {
    name: "plannr-seo",
    transformIndexHtml(html) {
      if (!site) return html;
      return html
        .replace('content="/og.png"', `content="${site}/og.png"`)
        .replace(
          '<meta property="og:type"',
          `<link rel="canonical" href="${site}/" />\n    <meta property="og:url" content="${site}/" />\n    <meta property="og:type"`,
        );
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt(site) });
      if (site) this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml(site) });
    },
  };
}
