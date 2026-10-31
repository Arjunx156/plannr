import { describe, expect, test } from "bun:test";
import { plannrSeo, robotsTxt, sitemapXml, siteUrl } from "../server/seo.ts";

describe("seo", () => {
  test("site URL comes from SITE_URL, then the Vercel production domain", () => {
    expect(siteUrl({})).toBeUndefined();
    expect(siteUrl({ SITE_URL: "https://plannr.in/" })).toBe("https://plannr.in");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "plannr.vercel.app" })).toBe("https://plannr.vercel.app");
  });

  test("robots keeps signed-in screens out and points at the sitemap when it exists", () => {
    expect(robotsTxt()).toContain("Disallow: /events");
    expect(robotsTxt()).not.toContain("Sitemap");
    expect(robotsTxt("https://plannr.in")).toContain("Sitemap: https://plannr.in/sitemap.xml");
  });

  test("sitemap lists public pages with absolute URLs", () => {
    expect(sitemapXml("https://plannr.in")).toContain("<loc>https://plannr.in/</loc>");
  });
});

describe("the build plugin", () => {
  const html =
    '<meta property="og:image" content="/og.png" />\n    <meta property="og:type" content="website" />';

  /** The page the plugin writes, and the files it adds to the build, as Vite would run it. */
  function build(env: Record<string, string>): { page: unknown; files: string[] } {
    const plugin = plannrSeo(env);
    const { transformIndexHtml: transform, generateBundle: bundle } = plugin;
    if (typeof transform !== "function" || typeof bundle !== "function")
      throw new Error("both hooks are functions");
    const files: string[] = [];
    Reflect.apply(bundle, { emitFile: (f: { fileName: string }) => files.push(f.fileName) }, []);
    return { page: Reflect.apply(transform, undefined, [html]), files };
  }

  test("with a site address, share images are absolute, the page is canonical, and there's a sitemap", () => {
    const { page, files } = build({ SITE_URL: "https://plannr.in" });
    expect(page).toContain('content="https://plannr.in/og.png"');
    expect(page).toContain('<link rel="canonical" href="https://plannr.in/" />');
    expect(page).toContain('<meta property="og:url" content="https://plannr.in/" />');
    expect(files).toEqual(["robots.txt", "sitemap.xml"]);
  });

  test("without one, the page is left as it is and robots.txt comes alone", () => {
    const { page, files } = build({});
    expect(page).toBe(html);
    expect(files).toEqual(["robots.txt"]);
  });
});
