import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { plannrSeo } from "./server/seo.ts";
import { plannrApi } from "./server/vitePlugin.ts";

export default defineConfig(({ mode }) => {
  // "" loads every variable, not just VITE_*; they stay on the server inside the plugins.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return { plugins: [react(), tailwindcss(), plannrApi(env), plannrSeo(env)] };
});
