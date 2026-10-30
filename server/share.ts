import { dateRange } from "../src/lib/dates";
import { PUBLIC_PATH, type PublicKind, type PublicView } from "../src/shared/public";
import type { Db } from "./db/types";
import { publicView } from "./links";

/**
 * Shared-link pages are the app's own index.html with the right title and description,
 * so a link pasted into WhatsApp previews as "You're invited: Ananya & Rohan's wedding"
 * rather than the Plannr home page. Only a published event website may be indexed.
 */

const BY_PATH = Object.fromEntries(Object.entries(PUBLIC_PATH).map(([k, v]) => [v, k])) as Record<
  string,
  PublicKind
>;

/** "/r/abc123" → { kind: "rsvp", token: "abc123" }. */
export function matchShare(pathname: string): { kind: PublicKind; token: string } | undefined {
  const m = pathname.match(/^\/(e|r|h|v|s|fund|a|stalls|gate)\/([\w-]{3,64})\/?$/);
  const kind = m?.[1] ? BY_PATH[m[1]] : undefined;
  return kind && m?.[2] ? { kind, token: m[2] } : undefined;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Meta {
  title: string;
  description: string;
  url: string;
  index: boolean;
}

function when(v: PublicView): string {
  const dates = v.event.functions.map((f) => f.date).sort();
  const first = dates[0] ?? v.event.date;
  const last = dates[dates.length - 1] ?? v.event.date;
  return dateRange(first, last);
}

/** Search engines show about this many characters of a description. */
const DESCRIPTION_CHARS = 160;

/** Cuts text to `max` characters, ending with an ellipsis when it had to cut. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function metaFor(v: PublicView, url: string): Meta {
  const name = v.event.name;
  const base = { url, index: false };
  switch (v.kind) {
    case "site": {
      const story = v.site.story?.trim();
      return {
        ...base,
        title: `${name} · ${when(v)}`,
        description: story ? truncate(story, DESCRIPTION_CHARS) : `${name}, ${when(v)}.`,
        index: !!v.site.indexable,
      };
    }
    case "rsvp":
      return {
        ...base,
        title: `You're invited: ${name}`,
        description: `Namaste, ${v.household.name}. ${when(v)}. Tell us who's coming.`,
      };
    case "helper":
      return {
        ...base,
        title: `${v.helper}'s tasks · ${name}`,
        description: `Tick them off as you go. No sign-up needed.`,
      };
    case "vendor":
      return {
        ...base,
        title: `Call sheet · ${name}`,
        description: `${v.vendor.category}: arrival times, contacts and what's needed on the day.`,
      };
    case "shifts":
      return {
        ...base,
        title: `Volunteer for ${name}`,
        description: `Pick an open shift. It takes a minute.`,
      };
    case "fund":
      return {
        ...base,
        title: `Fund report · ${name}`,
        description: `What's been collected, spent and is still due.`,
      };
    case "album":
      return { ...base, title: `Photos · ${name}`, description: `Add your photos from the day.` };
    case "stalls":
      return {
        ...base,
        title: `Book a stall · ${name}`,
        description: `${v.open} stalls open. Send a request.`,
      };
    case "gate":
      return { ...base, title: `Gate check-in · ${name}`, description: `For volunteers at the gate.` };
  }
}

/** Swaps the page's head tags for this link's. */
export function withMeta(html: string, m: Meta): string {
  const t = esc(m.title);
  const d = esc(m.description);
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${d}" />`)
    .replace(/<meta\s+property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${t}" />`)
    .replace(
      /<meta\s+property="og:description"[\s\S]*?\/>/,
      `<meta property="og:description" content="${d}" />`,
    )
    .replace(/<meta\s+property="og:url"[\s\S]*?\/>/, `<meta property="og:url" content="${esc(m.url)}" />`)
    .replace(/<link\s+rel="canonical"[\s\S]*?\/>/, `<link rel="canonical" href="${esc(m.url)}" />`)
    .replace(
      "</head>",
      `<meta name="robots" content="${m.index ? "index, follow" : "noindex, nofollow"}" />\n</head>`,
    );
}

/** The HTML for a shared-link page. A link that doesn't work still gets the app, unindexed. */
export async function sharePage(db: Db | undefined, html: string, url: URL): Promise<string> {
  const match = matchShare(url.pathname);
  const fallback: Meta = {
    title: "Plannr",
    description: "This link isn't working. Ask the family for a new one.",
    url: url.toString(),
    index: false,
  };
  if (!match || !db) return withMeta(html, fallback);
  try {
    const view = await publicView(db, match.token);
    return withMeta(html, metaFor(view, `${url.origin}${url.pathname}`));
  } catch {
    return withMeta(html, fallback);
  }
}
