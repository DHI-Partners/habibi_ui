import { useState } from "react";

import { Button } from "../../shared/ui/button";
import { Skeleton } from "../../shared/ui/skeleton";
import { useBots, useChat, useChats, useCreateChat, useSendMessage } from "./api";
import { TracePanel } from "./TracePanel";
import type { TraceStep } from "./types";

export function ChatPage() {
  const [chatId, setChatId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  // Трассировка носит с собой номер чата, из которого её получили. Пока запрос
  // летит, пользователь успевает переключиться, и ответ пришёл бы к чужой
  // переписке. Хранить голый массив значило бы показать разбор одного диалога
  // рядом с другим.
  const [trace, setTrace] = useState<{ chatId: number; steps: TraceStep[] } | null>(null);

  const bots = useBots();
  const chats = useChats();
  const chat = useChat(chatId);
  const createChat = useCreateChat();
  const send = useSendMessage(chatId);

  /** Переключение чата: состояние отправки принадлежало прежнему. */
  function open(id: number | null) {
    setChatId(id);
    setTrace(null);
    // Без reset прежние isPending и error остаются висеть и приписываются
    // чату, в который ничего не отправляли: экземпляр мутации один на экран,
    // по чатам он не разделён.
    send.reset();
  }

  function start() {
    const bot = bots.data?.[0];
    if (!bot) return;
    createChat.mutate(bot.id, { onSuccess: (created) => open(created.id) });
  }

  function submit() {
    const text = draft.trim();
    if (!text || chatId === null) return;
    const sentFrom = chatId;
    setDraft("");
    // Трассировка приходит только с ролью, поэтому её отсутствие — норма.
    send.mutate(text, {
      onSuccess: (result) =>
        setTrace(result.debug ? { chatId: sentFrom, steps: result.debug } : null),
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="w-64 shrink-0 overflow-y-auto rounded-2xl border border-border bg-card p-2">
        <Button className="mb-2 w-full" onClick={start} disabled={!bots.data?.length}>
          Новый чат
        </Button>
        {chats.isPending && <Skeleton className="h-10 w-full rounded-lg" />}
        {chats.data?.map((item) => (
          <button
            key={item.id}
            onClick={() => open(item.id)}
            className={`block w-full rounded-lg p-2 text-left text-sm ${
              item.id === chatId ? "bg-accent" : "hover:bg-muted"
            }`}
          >
            <span className="block truncate font-medium">{item.title || `Чат ${item.id}`}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.preview}</span>
          </button>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4">
          {chatId === null && (
            <p className="text-muted-foreground">Выберите чат или начните новый.</p>
          )}
          {chat.data?.messages.map((message) => (
            <div
              key={message.id}
              className={`mb-2 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <span className="max-w-[80%] rounded-2xl bg-muted px-3 py-2 whitespace-pre-wrap">
                {message.content}
              </span>
            </div>
          ))}
          {send.isPending && <p className="text-muted-foreground">…</p>}
          {send.error && <p className="text-destructive">{send.error.message}</p>}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            className="flex-1 rounded-lg border border-border px-3 py-2"
            placeholder="Сообщение"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={chatId === null}
          />
          <Button type="submit" disabled={chatId === null || send.isPending}>
            Отправить
          </Button>
        </form>
      </section>

      {/* Показываем только разбор текущего чата: ответ мог прийти после того,
          как пользователь ушёл в другой диалог. */}
      {trace && trace.chatId === chatId && <TracePanel steps={trace.steps} />}
    </div>
  );
}
