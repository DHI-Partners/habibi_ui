import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // В сборке Frappe отдаёт public/ приложения по этому префиксу, и пути в
  // манифесте должны быть от него. Но в dev тот же base управлял бы и
  // маршрутизацией самого vite: страница уехала бы на
  // /assets/habibi_ui/frontend/ui/ai, а /ui/ai не отдавался бы вовсе. Хуже
  // того, он столкнулся бы с прокси /assets ниже, который ведёт на бенч за
  // спрайтом иконок Frappe. Поэтому в dev база — корень.
  base: command === "build" ? "/assets/habibi_ui/frontend/" : "/",
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
}));
