import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../../shared/api/client";

export type KitchenItem = { item_name: string; qty: number };

export type KitchenOrder = {
  name: string;
  age: number;
  notes: string | null;
  items: KitchenItem[];
};

// Контракт habibi_ai.cabinet.fulfilment. phone и items приходят только в
// «Мои»: у свободного заказа телефона нет, пока курьер его не взял.
export type CourierOrder = {
  name: string;
  age: number;
  customer_name: string | null;
  address: string | null;
  zone: string | null;
  items_count: number;
  phone?: string | null;
  items?: KitchenItem[];
};

// Действия воркфлоу прод-сайта (burger-workshop/BUILD-LOG.md). «Взять» — отдельный
// метод: ему нужны назначение курьера и блокировка от гонки.
export const READY_ACTION = "Mark Ready";
export const DELIVERED_ACTION = "Mark Delivered";

const KEY = ["cabinet", "fulfilment"] as const;
// Сокет может не подключиться, а кухня не должна зависеть от одного сокета
const POLL_MS = 30_000;

function useQueue<T>(name: string, method: string) {
  return useQuery({
    queryKey: [...KEY, name],
    queryFn: () => call<T>(`habibi_ai.cabinet.fulfilment.${method}`),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export const useKitchenQueue = () => useQueue<KitchenOrder[]>("kitchen", "kitchen_queue");
export const useCourierMine = () => useQueue<CourierOrder[]>("mine", "courier_mine");
export const useCourierFree = () => useQueue<CourierOrder[]>("free", "courier_free");

function useTransition(action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => call("habibi_ai.cabinet.orders.apply", { name, action, reason: "" }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export const useMarkReady = () => useTransition(READY_ACTION);
export const useMarkDelivered = () => useTransition(DELIVERED_ACTION);

export function useTake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => call<{ taken: boolean }>("habibi_ai.cabinet.fulfilment.courier_take", { name }),
    // «Уже взят» — тоже повод перечитать списки
    onSettled: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
