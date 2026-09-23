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

export function useChatCommand(method: "send" | "pause" | "resume") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { chat: string; text?: string }) => call<null>(`habibi_ai.cabinet.chats.${method}`, args),
    onSuccess: (_d, { chat }) => {
      void queryClient.invalidateQueries({ queryKey: ["cabinet", "chats"] });
      void queryClient.invalidateQueries({ queryKey: ["cabinet", "messages", chat] });
    },
  });
}
