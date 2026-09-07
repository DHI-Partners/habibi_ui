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
  // Под vite страница живёт на :5173, а бенч на :8000. Куку сессии браузер
  // отдаёт обоим — она привязана к хосту localhost, а не к порту, — но
  // запросы всё равно надо довести до бенча, иначе они уйдут в vite.
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/assets": "http://localhost:8000",
      "/files": "http://localhost:8000",
    },
  },
  build: {
    outDir: "../habibi_ui/public/frontend",
    emptyOutDir: true,
    // Манифест нужен странице-обёртке: имена файлов хешируются.
    manifest: true,
  },
});
