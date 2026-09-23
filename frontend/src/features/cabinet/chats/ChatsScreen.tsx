import { useState } from "react";

import { type ChatItem, useChatCommand, useChatList, useMessages } from "./api";

const AUTHOR = { client: "Клиент", bot: "Бот", staff: "Вы" } as const;

export function ChatsScreen() {
  const chats = useChatList();
  const [active, setActive] = useState<string | null>(null);
  const current = chats.data?.find((c) => c.chat === active) ?? null;

  return (
    <div className="flex h-[calc(100dvh-8rem)] gap-4">
      <ul
        className={`w-full divide-y divide-border overflow-y-auto rounded-2xl border border-border md:w-80 ${
          active ? "hidden md:block" : ""
        }`}
      >
        {chats.data?.map((c) => (
          <li key={c.chat}>
            <button
              type="button"
              onClick={() => setActive(c.chat)}
              className={`block w-full px-4 py-3 text-left ${c.chat === active ? "bg-accent" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-medium">{c.title}</span>
                {c.paused && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">бот на паузе</span>}
              </div>
              <div className="truncate text-sm text-muted-foreground">{c.preview}</div>
            </button>
          </li>
        ))}
        {chats.data?.length === 0 && <li className="px-4 py-6 text-center text-muted-foreground">Переписок пока нет</li>}
      </ul>
      {current && <Thread chat={current} onBack={() => setActive(null)} />}
    </div>
  );
}

function Thread({ chat, onBack }: { chat: ChatItem; onBack: () => void }) {
  const messages = useMessages(chat.chat);
  const send = useChatCommand("send");
  const pause = useChatCommand("pause");
  const resume = useChatCommand("resume");
  const [text, setText] = useState("");

  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border">
      <header className="flex items-center gap-2 border-b border-border p-3">
        <button type="button" onClick={onBack} className="md:hidden">
          ←
        </button>
        <div className="flex-1 font-medium">{chat.title}</div>
        {chat.paused ? (
          <button
            type="button"
            disabled={resume.isPending}
            onClick={() => resume.mutate({ chat: chat.chat })}
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
          >
            Вернуть боту
          </button>
        ) : (
          <button
            type="button"
            disabled={pause.isPending}
            onClick={() => pause.mutate({ chat: chat.chat })}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Взять на себя
          </button>
        )}
      </header>
      <ol className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.data?.map((m) => (
          <li
            key={m.name}
            className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.author === "client" ? "bg-muted" : "ml-auto bg-primary/10"}`}
          >
            <div className="text-xs text-muted-foreground">{AUTHOR[m.author]}</div>
            <div className="whitespace-pre-wrap">{m.text}</div>
          </li>
        ))}
      </ol>
      {chat.paused && (
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate({ chat: chat.chat, text }, { onSuccess: () => setText("") });
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ответ клиенту"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
          />
          <button type="submit" disabled={send.isPending} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
            Отправить
          </button>
        </form>
      )}
      {(send.error || pause.error || resume.error) && (
        <p className="px-3 pb-3 text-destructive">
          {(send.error ?? pause.error ?? resume.error)?.message}
        </p>
      )}
    </section>
  );
}
