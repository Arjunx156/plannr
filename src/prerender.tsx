import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App, preloadPage } from "./App";
import { StoreProvider } from "./store/store";

/** Renders one public page to HTML at build time, with the title and description it sets. */
export async function render(url: string): Promise<{ html: string; title: string; description: string }> {
  // renderToString can't wait for code to load, so the page's code is loaded first.
  await preloadPage(url);
  const g = globalThis as { __plannrMeta?: { title: string; description: string } };
  g.__plannrMeta = undefined;
  const html = renderToString(
    <StaticRouter location={url}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </StaticRouter>,
  );
  const meta = g.__plannrMeta ?? { title: "Plannr", description: "" };
  return { html, ...meta };
}
