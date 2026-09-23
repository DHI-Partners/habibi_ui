import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../../shared/api/client";

export type OrderAction = { action: string; kind: "accept" | "reject" | "other" };
// Реальный контракт habibi_ai.cabinet.orders.apply не возвращает chat — сервер
// сам находит чат по имени заказа (см. apply/notify в orders.py); черновик
// уведомления хранит только вид и текст.
export type Notify = { kind: "accept" | "reject"; text: string };

export function useOrderActions(name: string) {
  return useQuery({
    queryKey: ["cabinet", "order-actions", name],
    queryFn: () =>
      call<{ state: string; actions: OrderAction[]; can_notify: boolean }>("habibi_ai.cabinet.orders.actions", {
        name,
      }),
  });
}

// "discard" — синтетическое действие NO_WORKFLOW_REJECT из orders.py: единственная
// ветка apply(), которая удаляет черновик заказа (frappe.delete_doc), а не переводит
// его по воркфлоу. После неё order-actions(name) обречён на 404 — не рефетчим то,
// что заведомо не читается, и явно сигналим об этом компоненту.
export const DISCARD_ACTION = "discard";

export function useApplyAction(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }: { action: string; reason: string }) =>
      call<{ state: string; notify: Notify | null }>("habibi_ai.cabinet.orders.apply", { name, action, reason }),
    onSuccess: (_result, { action }) => {
      if (action !== DISCARD_ACTION) {
        void queryClient.invalidateQueries({ queryKey: ["cabinet", "order-actions", name] });
      }
      void queryClient.invalidateQueries({ queryKey: ["cabinet", "list", "orders"] });
    },
  });
}

export function useNotify(name: string) {
  return useMutation({
    mutationFn: ({ text }: { text: string }) =>
      call<{ sent: boolean; error: string | null }>("habibi_ai.cabinet.orders.notify", { name, text }),
  });
}
