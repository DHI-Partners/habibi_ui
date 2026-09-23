import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../../shared/api/client";

export type Slot = { weekday: string; kind: string; opens: string; closes: string };
export type Exception = { date: string; closed: 0 | 1; opens: string; closes: string; note: string };
export type Hours = { time_zone: string; schedule: Slot[]; exceptions: Exception[] };
export type Rule = { title: string; hint: string; text: string };
export type Profile = {
  business_name: string;
  business_kind: string;
  address: string;
  phone: string;
  description: string;
  tone: string;
  rules: Rule[];
};
export type TelegramStatus = { connected: boolean; username: string | null; last_message_at: string | null };

// Один и тот же приём для всех трёх настроек: читаем документ целиком,
// сохраняем целиком, ответ сохранения сразу подставляем в кэш запроса —
// отдельного рефетча после save не нужно (сервер и так отдаёт актуальный
// документ, см. habibi_ai.cabinet.settings.*).
function useResource<T>(key: string, getter: string, setter: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["cabinet", key], queryFn: () => call<T>(getter) });
  const mutation = useMutation({
    mutationFn: (args: Record<string, unknown>) => call<T>(setter, args),
    onSuccess: (data) => queryClient.setQueryData(["cabinet", key], data),
  });
  return { query, mutation };
}

export const useHours = () =>
  useResource<Hours>("hours", "habibi_ai.cabinet.settings.get_hours", "habibi_ai.cabinet.settings.save_hours");
export const useProfile = () =>
  useResource<Profile>("profile", "habibi_ai.cabinet.settings.get_profile", "habibi_ai.cabinet.settings.save_profile");
export const useTelegram = () =>
  useResource<TelegramStatus>(
    "telegram",
    "habibi_ai.cabinet.settings.telegram_status",
    "habibi_ai.cabinet.settings.connect_telegram",
  );
