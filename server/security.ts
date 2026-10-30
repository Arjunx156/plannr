import type { Plugin } from "vite";

/**
 * The content security policy: the browser refuses scripts from anywhere but Plannr itself.
 * Production sends it as a header on every response (CSP_HEADER, which also refuses framing);
 * built pages carry it as a meta tag too, so `vite preview` and saved copies are covered.
 * The dev server injects its own inline scripts, so it goes without.
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

/** The header form adds what a meta tag can't express: no framing, and HTTPS only. */
export const CSP_HEADER = `${CSP}; frame-ancestors 'none'; upgrade-insecure-requests`;

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
