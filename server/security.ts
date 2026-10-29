import type { Plugin } from "vite";

/**
 * The content security policy, as a meta tag in the built page, so the browser refuses
 * scripts from anywhere but Plannr itself. Built pages only: the dev server injects its own
 * inline scripts. Framing is refused separately by the X-Frame-Options header.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function plannrCsp(): Plugin {
  return {
    name: "plannr-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}
