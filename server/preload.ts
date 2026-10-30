import type { Plugin } from "vite";

/** The fonts the first screen is drawn in: the serif for headings (upright and italic) and the sans for text. */
const FIRST_SCREEN_FONTS = [
  /newsreader-latin-wght-normal-[\w-]+\.woff2$/,
  /newsreader-latin-wght-italic-[\w-]+\.woff2$/,
  /hanken-grotesk-latin-wght-normal-[\w-]+\.woff2$/,
];

/**
 * Preloads the first screen's fonts, so they arrive with the stylesheet instead of after it and the
 * page is laid out once rather than again as each font lands. Built pages only: dev serves fonts as is.
 */
export function plannrPreload(): Plugin {
  return {
    name: "plannr-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const fonts = Object.keys(ctx.bundle ?? {}).filter((f) => FIRST_SCREEN_FONTS.some((r) => r.test(f)));
        const links = fonts.map(
          (f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin />`,
        );
        return links.length ? html.replace("</title>", `</title>\n    ${links.join("\n    ")}`) : html;
      },
    },
  };
}
