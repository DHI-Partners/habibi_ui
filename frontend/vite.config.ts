import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Frappe отдаёт public/ приложения по этому префиксу.
  base: "/assets/habibi_ui/frontend/",
  build: {
    outDir: "../habibi_ui/public/frontend",
    emptyOutDir: true,
    // Манифест нужен странице-обёртке: имена файлов хешируются.
    manifest: true,
  },
});
