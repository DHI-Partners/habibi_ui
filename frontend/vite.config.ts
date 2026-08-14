import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // Frappe отдаёт public/ приложения по этому префиксу.
  base: "/assets/habibi_ui/frontend/",
  build: {
    outDir: "../habibi_ui/public/frontend",
    emptyOutDir: true,
    // Манифест нужен странице-обёртке: имена файлов хешируются.
    manifest: true,
  },
});
