import { ChevronLeft, Loader2, MessageCircle, SendHorizontal } from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import type { CabinetSection } from "../../../shared/types/api";
import { Button, buttonVariants } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Skeleton } from "../../../shared/ui/skeleton";
import { clock, dayTitle, listStamp, parseSiteDate } from "../format";
import { useSectionBack } from "../nav";
import { EmptyState, ErrorNote, InitialAvatar, ListSkeleton, StatusBadge } from "../ui";
import { type ChatItem, type ChatMessage, useChatList, useMessages, usePauseChat, useResumeChat, useSendMessage } from "./api";

const AUTHOR = { client: "Клиент", bot: "Бот", staff: "Вы" } as const;

// Насколько близко к низу нужно быть, чтобы новое сообщение само подскроллило
// ленту вниз. Больше похоже на «читатель и так почти у конца», чем на точный 0.
const NEAR_BOTTOM_PX = 80;

// Открытая переписка — в адресе (?chat=), а не в состоянии экрана: «назад» на
// телефоне возвращает к списку, а с главной можно сразу открыть нужный чат.
export function ChatsScreen({ section }: { section: CabinetSection }) {
  const chats = useChatList();
  const [params, setParams] = useSearchParams();
  const active = params.get("chat");
  const current = chats.data?.find((c) => c.chat === active) ?? null;
  const back = useSectionBack(section.key);

  return (
    // Высота — ровно экран: лента прокручивается внутри, поле ввода прижато к
    // низу. На телефоне при открытом чате таб-бара нет (см. CabinetShell).
    <div className={cn("flex md:h-dvh", active ? "h-dvh" : "h-[calc(100dvh-4rem-env(safe-area-inset-bottom))]")}>
      <aside
        className={cn(
          "flex w-full min-w-0 flex-col bg-background md:w-80 md:shrink-0 md:border-r lg:w-96",
          active && "hidden md:flex",
        )}
      >
        <header className="flex min-h-14 items-center gap-2 border-b px-4 md:min-h-16 md:px-5">
          {back && (
            <Link to={back} aria-label="Назад" className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "-ml-2 md:hidden")}>
              <ChevronLeft className="size-5" />
            </Link>
          )}
          <h1 className="flex-1 text-lg font-semibold tracking-tight md:text-xl">{section.label}</h1>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {chats.isPending && <ListSkeleton rows={6} className="p-3" />}
          {chats.error && (
            <div className="p-3">
              <ErrorNote title="Не удалось загрузить переписки">{chats.error.message}</ErrorNote>
            </div>
          )}
          {chats.data?.length === 0 && (
            <div className="p-4">
              <EmptyState icon={MessageCircle} text="Переписок пока нет — они появятся, когда клиенты напишут в Telegram" />
            </div>
          )}
          <ul className="divide-y">
            {chats.data?.map((c) => (
              <li key={c.chat}>
                <button
                  type="button"
                  onClick={() => setParams({ chat: c.chat })}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    c.chat === active && "bg-muted",
                  )}
                >
                  <InitialAvatar name={c.title} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{listStamp(c.last_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-[13px] text-muted-foreground">{c.preview}</span>
                      {c.paused && (
                        <StatusBadge tone="new" className="h-5 px-2 text-[11px]">
                          ждёт вас
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {current ? (
        <Thread chat={current} onBack={() => setParams({})} />
      ) : (
        <div className="hidden flex-1 items-center justify-center bg-muted/40 p-8 md:flex">
          {active && chats.data ? (
            <EmptyState icon={MessageCircle} text="Переписка не найдена или недоступна" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
              <MessageCircle className="size-8" />
              Выберите переписку слева
            </div>
          )}
        </div>
      )}
      {active && chats.data && !current && (
        <div className="flex flex-1 items-center p-4 md:hidden">
          <EmptyState
            icon={MessageCircle}
            text="Переписка не найдена или недоступна"
            action={
              <Button variant="outline" onClick={() => setParams({})}>
                К перепискам
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

function Thread({ chat, onBack }: { chat: ChatItem; onBack: () => void }) {
  const messages = useMessages(chat.chat);
  const send = useSendMessage();
  const pause = usePauseChat();
  const resume = useResumeChat();
  const [text, setText] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  // Читатель мог отмотать вверх к истории — новое сообщение не должно вырывать
  // его оттуда. true — «был у низа», отслеживаем это на каждый скролл; при
  // смене чата считаем, что мы у низа заново (типичный вход в переписку — сразу
  // к последнему сообщению, а не туда, где случайно застрял скролл до этого).
  const nearBottomRef = useRef(true);
  const activeChatRef = useRef(chat.chat);
  if (activeChatRef.current !== chat.chat) {
    activeChatRef.current = chat.chat;
    nearBottomRef.current = true;
  }

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [chat.chat, messages.data]);

  const toastError = (e: Error) => toast.error(e.message);
  const busy = pause.isPending || resume.isPending;

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      <header className="flex min-h-14 items-center gap-2.5 border-b px-3 py-2 md:min-h-16 md:px-5">
        <Button variant="ghost" size="icon-lg" onClick={onBack} aria-label="Назад" className="-ml-1 md:hidden">
          <ChevronLeft className="size-5" />
        </Button>
        <InitialAvatar name={chat.title} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{chat.title}</div>
          <div
            className={cn(
              // Без обрезки: «бот на паузе» — главное в этой строке, пусть лучше перенесётся.
              "flex items-center gap-1.5 text-xs leading-tight",
              chat.paused ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400",
            )}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", chat.paused ? "bg-amber-500" : "bg-emerald-500")} />
            {chat.paused ? "Отвечаете вы, бот на паузе" : "Отвечает бот"}
          </div>
        </div>
        {chat.paused ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => resume.mutate({ chat: chat.chat }, { onError: toastError })}
            className="h-9 px-3"
          >
            {resume.isPending && <Loader2 className="animate-spin" />}
            Вернуть боту
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => pause.mutate({ chat: chat.chat }, { onError: toastError })}
            className="h-9 px-3 font-semibold"
          >
            {pause.isPending && <Loader2 className="animate-spin" />}
            Взять на себя
          </Button>
        )}
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        }}
      >
        {messages.isPending && <BubblesSkeleton />}
        {messages.error && <ErrorNote title="Не удалось загрузить сообщения">{messages.error.message}</ErrorNote>}
        {messages.data?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Сообщений пока нет</p>
        )}
        <ol className="mx-auto flex max-w-3xl flex-col gap-2">
          {messages.data?.map((m, i) => {
            const at = parseSiteDate(m.at);
            const prev = i > 0 ? parseSiteDate(messages.data[i - 1].at) : null;
            const newDay = at && (!prev || prev.toDateString() !== at.toDateString());
            return (
              <Fragment key={m.name}>
                {newDay && (
                  <li className="self-center py-1 text-xs text-muted-foreground" aria-hidden>
                    {dayTitle(at)}
                  </li>
                )}
                <Bubble message={m} at={at} />
              </Fragment>
            );
          })}
        </ol>
      </div>

      {chat.paused ? (
        <form
          className="flex gap-2 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] md:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim())
              send.mutate({ chat: chat.chat, text }, { onSuccess: () => setText(""), onError: toastError });
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение"
            aria-label="Сообщение клиенту"
            className="h-11 rounded-full px-4 text-[15px]"
          />
          <Button
            type="submit"
            size="icon"
            disabled={send.isPending || !text.trim()}
            aria-label="Отправить"
            className="size-11 shrink-0 rounded-full"
          >
            {send.isPending ? <Loader2 className="size-[18px] animate-spin" /> : <SendHorizontal className="size-[18px]" />}
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2.5 border-t bg-muted/40 px-4 pt-3.5 pb-[max(env(safe-area-inset-bottom),1.25rem)] md:px-6">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="text-[13px] text-muted-foreground">
            Отвечает бот. Нажмите «Взять на себя», чтобы написать самому.
          </span>
        </div>
      )}
    </section>
  );
}

function Bubble({ message, at }: { message: ChatMessage; at: Date | null }) {
  const time = at ? clock(at) : "";
  if (message.author === "client") {
    return (
      <li className="flex max-w-[85%] flex-col items-start gap-0.5 self-start md:max-w-[70%]">
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words">
          {message.text}
        </div>
        {time && <span className="px-1 text-[11px] text-muted-foreground">{time}</span>}
      </li>
    );
  }
  const staff = message.author === "staff";
  return (
    <li className="flex max-w-[85%] flex-col items-end gap-0.5 self-end md:max-w-[70%]">
      <span className="px-1 text-[11px] text-muted-foreground">
        {AUTHOR[message.author]}
        {time && ` · ${time}`}
      </span>
      <div
        className={cn(
          "rounded-2xl rounded-br-sm px-3 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words",
          staff ? "bg-primary text-primary-foreground" : "bg-primary/10 text-foreground dark:bg-primary/20",
        )}
      >
        {message.text}
      </div>
    </li>
  );
}

function BubblesSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3" aria-busy="true">
      <Skeleton className="h-12 w-3/5 self-start rounded-2xl" />
      <Skeleton className="h-16 w-2/3 self-end rounded-2xl" />
      <Skeleton className="h-10 w-2/5 self-start rounded-2xl" />
    </div>
  );
}
