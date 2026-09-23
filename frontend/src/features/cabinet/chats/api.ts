import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../../shared/api/client";

export type ChatItem = {
  chat: string;
  title: string;
  preview: string;
  last_at: string;
  paused: boolean;
  customer: string | null;
};
export type ChatMessage = { name: string; text: string; at: string; author: "client" | "bot" | "staff" };

export const useChatList = () =>
  useQuery({ queryKey: ["cabinet", "chats"], queryFn: () => call<ChatItem[]>("habibi_ai.cabinet.chats.list") });

export const useMessages = (chat: string | null) =>
  useQuery({
    queryKey: ["cabinet", "messages", chat],
    queryFn: () => call<ChatMessage[]>("habibi_ai.cabinet.chats.messages", { chat }),
    enabled: chat !== null,
  });

// Общее тело pause/resume/send — общая инвалидация после любой из трёх, разная
// сигнатура аргументов: send() на сервере требует текст, pause()/resume() — нет
// (chats.py). Разные обёртки ниже кодируют это на уровне типов, чтобы
// `usePause().mutate({ chat })` без text не заставлял звать send без текста и
// наоборот — раньше единая useChatCommand("send"|"pause"|"resume") принимала
// { chat; text?: string } для всех трёх, и text для send было легко забыть.
function useChatCommand<TVars extends { chat: string }>(method: "send" | "pause" | "resume") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TVars) => call<null>(`habibi_ai.cabinet.chats.${method}`, args),
    onSuccess: (_d: null, { chat }: TVars) => {
      void queryClient.invalidateQueries({ queryKey: ["cabinet", "chats"] });
      void queryClient.invalidateQueries({ queryKey: ["cabinet", "messages", chat] });
    },
  });
}

export const useSendMessage = () => useChatCommand<{ chat: string; text: string }>("send");
export const usePauseChat = () => useChatCommand<{ chat: string }>("pause");
export const useResumeChat = () => useChatCommand<{ chat: string }>("resume");
