import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App } from "./App";
import { StoreProvider } from "./store/store";

/** Renders one public page to HTML at build time, with the title and description it sets. */
export function render(url: string): { html: string; title: string; description: string } {
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
