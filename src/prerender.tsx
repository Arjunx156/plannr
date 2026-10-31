import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App, preloadPage } from "./App";
import { type PageMeta, prerendered } from "./components/pageMeta";
import { StoreProvider } from "./store/store";

/** Renders one public page to HTML at build time, with the title and description it sets. */
export async function render(url: string): Promise<PageMeta & { html: string }> {
  // renderToString can't wait for code to load, so the page's code is loaded first.
  await preloadPage(url);
  prerendered.meta = undefined;
  const html = renderToString(
    <StaticRouter location={url}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </StaticRouter>,
  );
  const meta = prerendered.meta ?? { title: "Plannr", description: "" };
  return { html, ...meta };
}
