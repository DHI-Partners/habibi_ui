import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type Event = { topic: "chats" | "orders"; chat: string | null };

// Под dev-сервером socket.io на своём порту — см. комментарий у useRealtime.
function socketHost(): string {
  const port = window.habibi.socketio_port;
  const { protocol, hostname, port: pagePort, origin } = window.location;
  if (!port || String(port) === pagePort) return origin;
  return `${protocol}//${hostname}:${port}`;
}

/**
 * Подписка на habibi_cabinet через socket.io Frappe.
 *
 * Клиент socket.io Frappe на странице /ui не подключён: это не Desk. Поэтому
 * подключаемся сами — так же, как frappe/public/js/frappe/socketio_client.js:
 * в проде тот же origin (кука сессии уходит сама, withCredentials нужен для
 * dev-порта ниже), неймспейс `/<site_name>` суффиксом URL, а не опцией path.
 * reconnectionAttempts ограничен, чтобы неудачное подключение не долбило
 * сервер бесконечно.
 *
 * Под dev-сервером (bench start, vite) socket.io слушает свой порт, а не порт
 * страницы — как Desk при window.dev_server, берём его из boot
 * (socketio_port). В проде порта в boot нет, и подключение идёт на свой origin.
 *
 * Не удалось подключиться — кабинет работает без живого обновления, данные
 * обновятся при переходе.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let socket: { on: (e: string, cb: (d: Event) => void) => void; disconnect: () => void } | null = null;
    let cancelled = false;
    import("socket.io-client")
      .then(({ io }) => {
        if (cancelled) return;
        socket = io(`${socketHost()}/${window.habibi.site_name ?? ""}`, {
          withCredentials: true,
          reconnectionAttempts: 3,
        });
        socket.on("habibi_cabinet", (event) => {
          if (event.topic === "orders") {
            void queryClient.invalidateQueries({ queryKey: ["cabinet", "list", "orders"] });
            // Открытый экран заказа тоже перечитывается: заказ мог принять
            // сотрудник или сдвинуть кухня
            void queryClient.invalidateQueries({ queryKey: ["cabinet", "order-details"] });
            void queryClient.invalidateQueries({ queryKey: ["cabinet", "order-actions"] });
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
