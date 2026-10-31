import { useEffect } from "react";

const DEFAULT_TITLE = "Plannr · Describe the day, get a plan you can run";
const DEFAULT_DESCRIPTION =
  "Describe your wedding, birthday or community event in one sentence, in your language. Plannr drafts the budget, timeline, vendor checklist and personalised ideas, keeps them in sync, and waits for your approval on every change.";
function meta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.content = content;
}

/**
 * Sets the tab title, description and share title for the current screen. Signed-in
 * screens pass `private` so search engines skip them.
 */
export function usePageMeta(title: string, opts: { description?: string; private?: boolean } = {}) {
  const { description = DEFAULT_DESCRIPTION, private: hidden = false } = opts;
  // While pre-rendering there is no document: hand the title to the build script instead.
  if (typeof document === "undefined")
    (globalThis as { __plannrMeta?: unknown }).__plannrMeta = {
      title: title === "Plannr" ? DEFAULT_TITLE : `${title} · Plannr`,
      description,
    };
  useEffect(() => {
    const full = title === "Plannr" ? DEFAULT_TITLE : `${title} · Plannr`;
    document.title = full;
    meta("name", "description", description);
    meta("property", "og:title", full);
    meta("property", "og:description", description);
    meta("name", "robots", hidden ? "noindex, nofollow" : "index, follow");
  }, [title, description, hidden]);
}
