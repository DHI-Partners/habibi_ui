import { useState } from "react";
import { Link } from "react-router-dom";

import { type Notify, useApplyAction, useNotify, useOrderActions } from "./api";

const LABELS: Record<string, string> = { accept: "Принять", reject: "Отклонить" };

export function OrderActions({ name }: { name: string }) {
  const actions = useOrderActions(name);
  const apply = useApplyAction(name);
  const notify = useNotify(name);
  const [draft, setDraft] = useState<Notify | null>(null);
  const [reason, setReason] = useState("");
  // «Отклонить» без ветки воркфлоу удаляет черновик заказа (см. orders.py:
  // apply → discard). После этого actions(name) отвечает 404, а форма заказа
  // может ещё не перечитаться — но черновик уведомления и его отправка
  // работают независимо от заказа (notify находит чат сам, см. notify.py).
  // Поэтому ошибка actions не должна прятать уже показанный черновик, а
  // после отправки/отказа от отправки — просто предлагаем вернуться к списку.
  const [skipped, setSkipped] = useState(false);
  // Если чата нет (can_notify: false), notify в ответе apply будет null — черновика
  // не будет, а actions после discard всё равно уйдёт в 404. Не показываем в этом
  // случае голую ошибку сети/сервера навечно: applied фиксирует, что 404 — ожидаемое
  // следствие нашего же действия, а не сбой при обычном открытии формы.
  const [applied, setApplied] = useState(false);

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      {actions.data ? (
        <>
          <div className="text-sm text-muted-foreground">Статус: {actions.data.state}</div>
          <div className="flex flex-wrap gap-2">
            {actions.data.actions.map((a) => (
              <button
                key={a.action}
                type="button"
                disabled={apply.isPending}
                onClick={() =>
                  apply.mutate(
                    { action: a.action, reason },
                    {
                      onSuccess: (r) => {
                        setSkipped(false);
                        setApplied(true);
                        if (r.notify) setDraft(r.notify);
                      },
                    },
                  )
                }
                className={`rounded-lg px-3 py-2 text-sm ${
                  a.kind === "reject"
                    ? "border border-destructive text-destructive"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {a.kind === "other" ? a.action : LABELS[a.kind] ?? a.action}
              </button>
            ))}
          </div>
          {actions.data.actions.some((a) => a.kind === "reject") && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина отказа (для сообщения клиенту)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          )}
        </>
      ) : (
        actions.isError &&
        !draft &&
        (applied ? (
          <p className="text-sm text-muted-foreground">
            Готово.{" "}
            <Link to="/c/orders" className="text-primary underline">
              Назад к заказам
            </Link>
          </p>
        ) : (
          <p className="text-destructive">{actions.error.message}</p>
        ))
      )}
      {apply.error && <p className="text-destructive">{apply.error.message}</p>}
      {draft && !skipped && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Сообщение клиенту</div>
          <textarea
            rows={3}
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={notify.isPending || !draft.text.trim()}
              onClick={() =>
                notify.mutate(
                  { text: draft.text },
                  { onSuccess: (r) => { if (r.sent) setSkipped(true); } },
                )
              }
              className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {notify.data && !notify.data.sent ? "Повторить" : "Отправить"}
            </button>
            <button type="button" onClick={() => setSkipped(true)} className="rounded-lg px-3 py-2 text-sm">
              Не отправлять
            </button>
          </div>
          {notify.data && !notify.data.sent && (
            <p className="text-destructive">Клиент не уведомлён: {notify.data.error}</p>
          )}
        </div>
      )}
      {draft && skipped && (
        <p className="text-sm text-muted-foreground">
          Готово.{" "}
          <Link to="/c/orders" className="text-primary underline">
            Назад к заказам
          </Link>
        </p>
      )}
    </div>
  );
}
