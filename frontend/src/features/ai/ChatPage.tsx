import { LayoutGrid } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../shared/ui/button";
import { Skeleton } from "../../shared/ui/skeleton";
import { useBots, useChat, useChats, useCreateChat, useSendMessage } from "./api";
import { TracePanel, type TraceAbsenceReason } from "./TracePanel";
import type { ChatState, Message, TraceStep } from "./types";

/**
 * Экран не обёрнут в AppShell (см. App.tsx), поэтому путь назад на лаунчер
 * модулей теряется вместе с ним. Здесь тот же переход и та же иконка, что и
 * в AppShell.AsideHeader — только в виде тонкой шапки самого чата, а не
 * бокового меню со списком пространств ERPNext, которое сюда не относится.
 */
function ChatHeader() {
  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b border-border bg-card px-4">
      <Link
        to="/"
        title="Все модули"
        className="flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 font-semibold text-foreground no-underline transition-colors hover:bg-accent"
      >
        <LayoutGrid className="size-5 flex-none text-primary" aria-hidden="true" />
        <span className="truncate">Все модули</span>
      </Link>
      <span className="text-muted-foreground">/</span>
      <h1 className="truncate text-sm font-medium text-foreground">Отладка AI-чата</h1>
    </header>
  );
}

/**
 * Состояние диалога — то, с чем сейчас работает движок: текущий сценарий,
 * стек сценариев, metadata. Показывается всегда, без отправки чего-либо —
 * это как раз то, что проверяют ДО того, как набрать сообщение, а не после.
 * Пустой стек рисуем текстом "стек пуст", а не пустым местом: пустое место
 * неотличимо от "ещё не загрузилось" или "забыли отрендерить".
 */
function ConversationState({ chat }: { chat: ChatState }) {
  return (
    <div className="mb-3 flex flex-none flex-wrap items-baseline gap-x-5 gap-y-1 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
      <span>
        <span className="text-muted-foreground">Сценарий: </span>
        {chat.current_scenario ?? "нет"}
      </span>
      <span>
        <span className="text-muted-foreground">Стек: </span>
        {chat.scenario_stack.length ? chat.scenario_stack.join(" → ") : "стек пуст"}
      </span>
      <span className="min-w-0 break-all">
        <span className="text-muted-foreground">Metadata: </span>
        {chat.metadata && Object.keys(chat.metadata).length ? JSON.stringify(chat.metadata) : "нет"}
      </span>
    </div>
  );
}

export function ChatPage() {
  const [chatId, setChatId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  // Трассировки копятся по id сообщения-ассистента, которое они объясняют, а
  // не в одном слоте: экран отладочный, и разбор трёхходовой давности нужен
  // ровно тогда, когда с ним сравнивают последний. Значение — либо шаги
  // (пришли и есть, чему разбираться), либо null (сообщение отправлено В ЭТОЙ
  // сессии, но сервер шагов не прислал — роли не хватает). Сообщений, которых
  // в Map вообще нет, — те, что загружены из истории до этой сессии; для них
  // трассировка не хранится нигде и не должна изображать, что хранится.
  const [traces, setTraces] = useState<Map<number, TraceStep[] | null>>(new Map());
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);

  // Своё сообщение до ответа сервера: полный круг прокси → движок → роутер
  // (LLM) → сборка промпта → второй вызов LLM → запись → перечитывание
  // истории занимает секунды, иногда десятки. Всё это время лента не должна
  // выглядеть так, будто отправка не сработала — а на отладочной консоли это
  // особенно важно: тут отправляют пробу и должны видеть, что именно ушло.
  // Держим отдельным state, а не правкой кеша TanStack Query в onMutate: это
  // тот же приём, что и с трассировками выше, — временная запись не должна
  // притворяться серверными данными, у неё даже нет числового id, который
  // Message.id требует. chatId в паре — та же защита от "чужого чата", что
  // объясняется ниже у TracePanel: пока ответ летит, пользователь может
  // переключиться, и черновик не должен всплыть в чужой ленте.
  const [pending, setPending] = useState<{ chatId: number; text: string } | null>(null);

  const bots = useBots();
  const chats = useChats();
  const chat = useChat(chatId);
  const createChat = useCreateChat();
  const send = useSendMessage(chatId);

  // "Живой" chatId для колбэка внутри submit: к моменту, когда refetch после
  // отправки резолвится, пользователь мог уже открыть другой чат. Замыкание
  // submit держит то значение chatId, что было в момент отправки — а ref
  // всегда отражает актуальное состояние экрана на момент, когда колбэк
  // реально выполнится.
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  /** Переключение чата: состояние отправки и выбор сообщения принадлежали прежнему. */
  function open(id: number | null) {
    setChatId(id);
    setSelectedMessageId(null);
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
    // Локальный объект-метка, а не просто text/chatId по отдельности: ей
    // сверяемся в onSuccess/onError (`prev === mine`), чтобы снять именно
    // СВОЮ временную запись. Без этого более поздняя отправка (в этот же
    // или другой чат, пока первая ещё летит) была бы стёрта чужим onError,
    // прилетевшим позже неё.
    const mine = { chatId: sentFrom, text };
    setPending(mine);
    send.mutate(text, {
      onSuccess: async (result) => {
        // Сервер не сообщает id созданного сообщения — узнать его можно,
        // только перечитав историю. useSendMessage уже инвалидирует запрос
        // чата, но нам нужны именно свежие данные в руках, а не факт, что
        // где-то в фоне начался повторный запрос, поэтому дожидаемся refetch
        // сами.
        const refreshed = await chat.refetch();
        // Временная запись снимается независимо от того, в какой чат сейчас
        // смотрит пользователь: настоящее сообщение уже есть в истории того
        // чата, откуда его отправляли, и "летит" ему больше нечему.
        setPending((prev) => (prev === mine ? null : prev));
        if (chatIdRef.current !== sentFrom) return; // ушли в другой чат, пока ждали
        const messages = refreshed.data?.messages ?? [];
        const last = [...messages].reverse().find((m) => m.role === "assistant");
        if (!last) return;
        setTraces((prev) => new Map(prev).set(last.id, result.debug ?? null));
        setSelectedMessageId(last.id);
      },
      // Без этого неудавшийся round trip молча съедал бы набранное: draft уже
      // очищен оптимистично, а send.error лишь показывает текст ошибки рядом.
      // Временная запись снимается тут же — иначе в поле ввода вернулся бы
      // текст, а в ленте остался бы его призрак.
      onError: () => {
        setDraft(text);
        setPending((prev) => (prev === mine ? null : prev));
      },
    });
  }

  const selectedMessage = chat.data?.messages.find((m) => m.id === selectedMessageId);
  let traceSteps: TraceStep[] | undefined;
  let traceAbsenceReason: TraceAbsenceReason = "none";
  if (selectedMessage) {
    const entry = traces.get(selectedMessage.id);
    if (entry === undefined) {
      traceAbsenceReason = "history";
    } else if (entry === null) {
      traceAbsenceReason = "no-role";
    } else {
      traceSteps = entry;
    }
  }

  function selectMessage(message: Message) {
    if (message.role !== "assistant") return;
    setSelectedMessageId(message.id);
  }

  return (
    // Экран больше не сидит внутри AppShell (см. App.tsx), поэтому сам
    // занимает весь вьюпорт: h-svh вместо унаследованной высоты темы, min-h-0
    // на строке колонок — иначе overflow-y-auto внутри aside/section не
    // сработает и растянет страницу вместо внутренней прокрутки.
    <div className="flex h-svh flex-col bg-background text-foreground">
      <ChatHeader />
      <div className="flex min-h-0 flex-1 gap-4 p-4">
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
          {chat.data && <ConversationState chat={chat.data.chat} />}

          <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4">
            {chatId === null && (
              <p className="text-muted-foreground">Выберите чат или начните новый.</p>
            )}
            {chat.data?.messages.map((message) => (
              <div
                key={message.id}
                className={`mb-2 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span
                  onClick={() => selectMessage(message)}
                  className={`max-w-[80%] rounded-2xl bg-muted px-3 py-2 whitespace-pre-wrap ${
                    message.role === "assistant" ? "cursor-pointer" : ""
                  } ${message.id === selectedMessageId ? "ring-2 ring-primary" : ""}`}
                  title={message.role === "assistant" ? "Показать разбор обработки" : undefined}
                >
                  {message.content}
                </span>
              </div>
            ))}
            {/* Своё сообщение до ответа сервера — той же формы, что и настоящие
                user-бабблы (чтобы не дёргалось при замене), плюс видимый
                признак, что это ещё не подтверждено сервером. Показываем
                только для текущего чата: pending.chatId защищает от
                всплытия в чужой ленте, если пользователь успел
                переключиться, пока ответ летел. */}
            {pending && pending.chatId === chatId && (
              <div className="mb-2 flex justify-end">
                <span className="max-w-[80%] rounded-2xl bg-muted px-3 py-2 whitespace-pre-wrap opacity-60">
                  {pending.text}
                  <span className="ml-2 text-xs text-muted-foreground">отправляется…</span>
                </span>
              </div>
            )}
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

        {/* Панель разбора теперь рисуется всегда: пустая трассировка — это
            тоже сведения (нет роли, история без разбора, ничего не выбрано),
            а не повод исчезнуть с экрана. См. TracePanel про absenceReason. */}
        <TracePanel steps={traceSteps} absenceReason={traceAbsenceReason} />
      </div>
    </div>
  );
}
