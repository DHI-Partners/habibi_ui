import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./shared/ui/theme.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Не найден корневой элемент #root");
}

const queryClient = new QueryClient();

// container принимается параметром, а не берётся из внешней области: TS не
// протаскивает сужение "не null" из проверки выше в замыкание async-функции.
async function bootstrap(container: HTMLElement) {
  // В проде window.habibi кладёт www/ui.html. Под vite разметку отдаёт vite,
  // и boot приходится добирать запросом.
  if (!window.habibi) {
    const response = await fetch("/api/method/habibi_ui.api.v1.session.boot");
    if (!response.ok) {
      throw new Error("Не удалось получить boot — войдите на http://localhost:8000/login");
    }
    window.habibi = (await response.json()).message;
  }

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/ui">
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap(container);
