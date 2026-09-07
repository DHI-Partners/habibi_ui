import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../shared/api/client";
import type { Bot, ChatRef, ChatState, Message, SendResult } from "./types";

export function useBots() {
  return useQuery({
    queryKey: ["ai", "bots"],
    queryFn: () => call<Bot[]>("habibi_ai.api.list_bots"),
  });
}

export function useChats() {
  return useQuery({
    queryKey: ["ai", "chats"],
    queryFn: () => call<ChatRef[]>("habibi_ai.api.list_chats"),
  });
}

export function useChat(chatId: number | null) {
  return useQuery({
    queryKey: ["ai", "chat", chatId],
    // ChatState, а не Omit<ChatRef, "title" | "preview">: title и preview
    // здесь и правда не приходят (их считает list_chats из сообщений, в
    // схеме под них колонки нет), но current_scenario, scenario_stack и
    // metadata — приходят, сервер отдаёт строку customer_chats целиком
    // (fields: "*"). Omit говорил только чего нет и терял то, что есть.
    queryFn: () =>
      call<{ chat: ChatState; messages: Message[] }>("habibi_ai.api.get_chat", {
        chat_id: chatId,
      }),
    enabled: chatId !== null,
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    // Свежесозданный чат приходит без title и preview: их считает list_chats
    // из сообщений, а сообщений в нём ещё нет. Обещать здесь ChatRef целиком
    // значило бы соврать в типе.
    mutationFn: (botId: number) =>
      call<Pick<ChatRef, "id">>("habibi_ai.api.create_chat", { bot_id: botId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai", "chats"] }),
  });
}

export function useSendMessage(chatId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      call<SendResult>("habibi_ai.api.send_message", { chat_id: chatId, message }),
    // Историю перечитываем у сервера, а не дописываем локально: сообщения
    // сохраняет движок, и порядок с нумерацией — его.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["ai", "chats"] });
    },
  });
}
