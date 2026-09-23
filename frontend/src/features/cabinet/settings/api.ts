import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../../shared/api/client";

export type Slot = { weekday: string; kind: string; opens: string; closes: string };
// get_hours отдаёт closed как bool, а в save_hours уходит 0/1 (Check) —
// читать только как истинность: Boolean(closed), а не closed === 1.
export type Exception = { date: string; closed: boolean | 0 | 1; opens: string; closes: string; note: string };
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
// Состояние входа в Telegram-аккаунт бизнеса (habibi_ai.cabinet.settings.telegram_status).
export type TelegramState = "none" | "code_sent" | "password_needed" | "connected" | "error";
export type TelegramStatus = {
  state: TelegramState;
  phone: string | null;
  full_name: string | null;
  username: string | null;
  last_message_at: string | null;
  error: string | null;
  ai_ready: boolean;
  ai_note: string | null;
};

// Один и тот же приём для режима работы и профиля: читаем документ целиком,
// сохраняем целиком, ответ сохранения сразу подставляем в кэш запроса —
// отдельного рефетча после save не нужно (сервер и так отдаёт актуальный
// документ, см. habibi_ai.cabinet.settings.*).
// enabled=false — для экранов, которым ресурс нужен лишь «если можно»
// (главная, сайдбар): сотруднику настройки не положены, и запрос не уходит.
function useResource<T>(key: string, getter: string, setter: string, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["cabinet", key], queryFn: () => call<T>(getter), enabled });
  const mutation = useMutation({
    mutationFn: (args: Record<string, unknown>) => call<T>(setter, args),
    onSuccess: (data) => queryClient.setQueryData(["cabinet", key], data),
  });
  return { query, mutation };
}

export const useHours = (enabled = true) =>
  useResource<Hours>("hours", "habibi_ai.cabinet.settings.get_hours", "habibi_ai.cabinet.settings.save_hours", enabled);
export const useProfile = (enabled = true) =>
  useResource<Profile>(
    "profile",
    "habibi_ai.cabinet.settings.get_profile",
    "habibi_ai.cabinet.settings.save_profile",
    enabled,
  );

export const useTelegramStatus = (enabled = true) =>
  useQuery({
    queryKey: ["cabinet", "telegram"],
    queryFn: () => call<TelegramStatus>("habibi_ai.cabinet.settings.telegram_status"),
    enabled,
  });

// Вход в аккаунт — несколько шагов, и каждый отвечает свежим статусом:
// его и кладём в кэш, как useResource. Код и пароль идут только в тело
// запроса и нигде не сохраняются.
function useTelegramStep(method: "request_code" | "sign_in" | "disconnect") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => call<TelegramStatus>(`habibi_ai.cabinet.settings.${method}`, args),
    onSuccess: (data) => queryClient.setQueryData(["cabinet", "telegram"], data),
  });
}

export function useTelegram() {
  return {
    query: useTelegramStatus(),
    requestCode: useTelegramStep("request_code"),
    signIn: useTelegramStep("sign_in"),
    disconnect: useTelegramStep("disconnect"),
  };
}
