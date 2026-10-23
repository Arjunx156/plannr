import { describe, expect, test } from "bun:test";
import { robotsTxt, sitemapXml, siteUrl } from "../server/seo.ts";

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
