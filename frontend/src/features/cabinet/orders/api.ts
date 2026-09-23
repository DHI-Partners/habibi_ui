import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../../shared/api/client";
import type { StateKind } from "../format";

export type OrderAction = { action: string; kind: "accept" | "reject" | "other" };
// Реальный контракт habibi_ai.cabinet.orders.apply не возвращает chat — сервер
// сам находит чат по имени заказа (см. apply/notify в orders.py); черновик
// уведомления хранит только вид и текст.
export type Notify = { kind: "accept" | "reject"; text: string };


// Контракт habibi_ai.cabinet.orders.details: всё, что рисует экран заказа.
// Необязательные поля (custom_* сайта, адрес, чат) приходят null, если их нет.
export type OrderDetails = {
  name: string;
  number: string;
  created: string;
  source: string | null;
  state: string;
  state_kind: StateKind;
  customer_name: string | null;
  phone: string | null;
  fulfilment: string | null;
  zone: string | null;
  address: string | null;
  notes: string | null;
  items: { item_name: string; qty: number; rate: number; amount: number }[];
  delivery: { label: string; amount: number } | null;
  total: number;
  taxes: number;
  currency: string;
  currency_symbol: string;
  chat: string | null;
};

export function useOrderDetails(name: string) {
  return useQuery({
    queryKey: ["cabinet", "order-details", name],
    queryFn: () => call<OrderDetails>("habibi_ai.cabinet.orders.details", { name }),
  });
}

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
        void queryClient.invalidateQueries({ queryKey: ["cabinet", "order-details", name] });
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
