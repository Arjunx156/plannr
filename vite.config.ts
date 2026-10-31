import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { plannrOffline } from "./server/offline.ts";
import { plannrPreload } from "./server/preload.ts";
import { plannrCsp } from "./server/security.ts";
import { plannrSeo } from "./server/seo.ts";
import { plannrApi } from "./server/vitePlugin.ts";

export default defineConfig(({ mode }) => {
  // "" loads every variable, not just VITE_*; they stay on the server inside the plugins.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    plugins: [
      react(),
      tailwindcss(),
      plannrApi(env),
      plannrSeo(env),
      plannrOffline(),
      plannrCsp(),
      plannrPreload(),
    ],
    build: {
      rolldownOptions: {
        output: {
          // React and the router change far less often than Plannr does: in a file of their own,
          // a returning visitor's cached copy survives most deploys.
          codeSplitting: {
            groups: [
              { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
