// Weight-only cuts of the variable fonts: a third of the size of the optical-size cuts.
import "@fontsource-variable/newsreader/wght.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App, preloadPage } from "./App";
import { startDevice } from "./lib/device";
import { startReporting } from "./lib/report";
import { StoreProvider } from "./store/store";

startDevice();
startReporting();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

// A pre-rendered page's code arrives before the first render, so its HTML is swapped for the same
// page rather than a loading screen. If it can't load, the page loads lazily as usual.
await preloadPage(location.pathname).catch(() => undefined);

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
