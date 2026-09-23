import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type Event = { topic: "chats" | "orders"; chat: string | null };

/**
 * Подписка на habibi_cabinet через socket.io Frappe.
 *
 * Клиент socket.io Frappe на странице /ui не подключён: это не Desk. Поэтому
 * подключаемся сами — так же, как frappe/public/js/frappe/socketio_client.js:
 * тот же origin (кука сессии уходит сама, withCredentials лишь дублирует это
 * для CORS-случая), неймспейс `/<site_name>` суффиксом URL, а не опцией path.
 * reconnectionAttempts ограничен, чтобы неудачное подключение не долбило
 * сервер бесконечно.
 *
 * Нет socket.io (dev-сервер vite без прокси) — кабинет работает без живого
 * обновления, данные обновятся при переходе.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let socket: { on: (e: string, cb: (d: Event) => void) => void; disconnect: () => void } | null = null;
    let cancelled = false;
    import("socket.io-client")
      .then(({ io }) => {
        if (cancelled) return;
        socket = io(`${window.location.origin}/${window.habibi.site_name ?? ""}`, {
          withCredentials: true,
          reconnectionAttempts: 3,
        });
        socket.on("habibi_cabinet", (event) => {
          if (event.topic === "orders") {
            void queryClient.invalidateQueries({ queryKey: ["cabinet", "list", "orders"] });
            void queryClient.invalidateQueries({ queryKey: ["cabinet", "home"] });
          } else {
            void queryClient.invalidateQueries({ queryKey: ["cabinet", "chats"] });
            if (event.chat) void queryClient.invalidateQueries({ queryKey: ["cabinet", "messages", event.chat] });
            void queryClient.invalidateQueries({ queryKey: ["cabinet", "home"] });
          }
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [queryClient]);
}
