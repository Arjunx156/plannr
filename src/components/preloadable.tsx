import { type ComponentType, createElement, lazy, useState } from "react";

export interface Preloadable<P extends object> {
  (props: P): ReturnType<typeof createElement>;
  /** Loads the page's code now; resolves once it can render without suspending. */
  preload: () => Promise<unknown>;
}

/**
 * A page whose code loads on demand, and can also be loaded ahead of its first render. Pre-rendered
 * pages are loaded before the app starts (main.tsx) and before rendering at build time
 * (prerender.tsx), so the HTML a visitor sees first is swapped for the same page with nothing in
 * between; reached by a link inside the app, it loads like any other lazy page.
 */
export function preloadable<P extends object>(load: () => Promise<ComponentType<P>>): Preloadable<P> {
  let ready: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;
  const preload = () => {
    pending ??= load().then(
      (page) => {
        ready = page;
        return page;
      },
      (e: unknown) => {
        // A failed load can be tried again on the next visit.
        pending = undefined;
        throw e;
      },
    );
    return pending;
  };
  const Lazy = lazy(() => preload().then((page) => ({ default: page })));
  function Page(props: P) {
    // Chosen once per mount, so a page that finishes loading mid-visit isn't mounted twice.
    const [page] = useState<ComponentType<P>>(() => ready ?? Lazy);
    return createElement(page, props);
  }
  return Object.assign(Page, { preload });
}
