import { useState } from "react";

import { useTelegram } from "./api";

export function TelegramScreen() {
  const { query, mutation } = useTelegram();
  const [token, setToken] = useState("");
  const status = query.data;

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Telegram</h1>
      {status?.connected ? (
        <div className="rounded-2xl border border-border p-4">
          <div className="font-medium">@{status.username} подключён</div>
          <div className="text-sm text-muted-foreground">
            {status.last_message_at ? `Последнее сообщение: ${new Date(status.last_message_at).toLocaleString("ru-RU")}` : "Сообщений пока не было"}
          </div>
        </div>
      ) : (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Откройте @BotFather в Telegram и отправьте /newbot.</li>
          <li>Придумайте имя и адрес бота — BotFather пришлёт токен.</li>
          <li>Вставьте токен ниже и нажмите «Подключить».</li>
        </ol>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // Токен не оставляем в поле после успеха: он не должен всплывать
          // обратно в интерфейсе (сервер тоже не отдаёт его назад).
          mutation.mutate({ token }, { onSuccess: () => setToken("") });
        }}
      >
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="123456:ABC..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
        />
        <button type="submit" disabled={!token.trim() || mutation.isPending} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
          {status?.connected ? "Сменить" : "Подключить"}
        </button>
      </form>
      {mutation.error && <p className="text-destructive">{mutation.error.message}</p>}
    </section>
  );
}
