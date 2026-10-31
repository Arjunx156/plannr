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
  // Stylesheets only from Plannr, and no style attributes: values from data are set through the CSSOM.
  "style-src 'self'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Script URLs pass through Plannr's one Trusted Types policy (src/lib/device.ts), so injected
  // strings can't reach a script sink.
  "require-trusted-types-for 'script'",
  "trusted-types plannr",
].join("; ");

/** The header form adds what a meta tag can't express: no framing, and HTTPS only. */
export const CSP_HEADER = `${CSP}; frame-ancestors 'none'; upgrade-insecure-requests`;

/**
 * Every browser feature Plannr doesn't use is switched off, so injected code couldn't use it either.
 * The camera scans QR codes at the gate and the microphone takes voice input, on Plannr's own pages only.
 */
export const PERMISSIONS_POLICY: string = [
  "accelerometer=()",
  "bluetooth=()",
  "camera=(self)",
  "display-capture=()",
  "encrypted-media=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "magnetometer=()",
  "microphone=(self)",
  "midi=()",
  "payment=()",
  "publickey-credentials-get=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

/** The headers every production response carries: pages, the API, assets and errors alike. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": CSP_HEADER,
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "permissions-policy": PERMISSIONS_POLICY,
};

/** A built page with the policy as a meta tag, so `vite preview` and saved copies are covered too. */
export function withCspMeta(html: string): string {
  return html.replace(
    '<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
  );
}

/** The Vite plugin that writes the policy into every built page. */
export function plannrCsp(): Plugin {
  return { name: "plannr-csp", apply: "build", transformIndexHtml: withCspMeta };
}
