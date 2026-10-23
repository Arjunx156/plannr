import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { plannrAi } from "./server/vitePlugin.ts";

export default defineConfig(({ mode }) => ({
  // "" loads every variable, not just VITE_*; they stay on the server inside the plugin.
  plugins: [react(), tailwindcss(), plannrAi(loadEnv(mode, process.cwd(), ""))],
}));
