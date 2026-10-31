import { useEffect } from "react";

const DEFAULT_TITLE = "Plannr · Describe the day, get a plan you can run";
const DEFAULT_DESCRIPTION =
  "Describe your wedding, birthday or community event in one sentence, in your language. Plannr drafts the budget, timeline, vendor checklist and personalised ideas, keeps them in sync, and waits for your approval on every change.";

/** A page's title and description, as browser tabs, search engines and link previews show them. */
export interface PageMeta {
  title: string;
  description: string;
}

/** Where a page leaves its meta while pre-rendering, when there is no document to write it to. */
export const prerendered: { meta: PageMeta | undefined } = { meta: undefined };

function meta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.content = content;
}

function fullTitle(title: string): string {
  return title === "Plannr" ? DEFAULT_TITLE : `${title} · Plannr`;
}

/**
 * Sets the tab title, description and share title for the current screen. Signed-in
 * screens pass `private` so search engines skip them.
 */
export function usePageMeta(
  title: string,
  opts: { description?: string | undefined; private?: boolean | undefined } = {},
): void {
  const { description = DEFAULT_DESCRIPTION, private: hidden = false } = opts;
  if (typeof document === "undefined") prerendered.meta = { title: fullTitle(title), description };
  useEffect(() => {
    const full = fullTitle(title);
    document.title = full;
    meta("name", "description", description);
    meta("property", "og:title", full);
    meta("property", "og:description", description);
    meta("name", "robots", hidden ? "noindex, nofollow" : "index, follow");
  }, [title, description, hidden]);
}
