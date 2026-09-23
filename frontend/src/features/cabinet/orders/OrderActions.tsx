import { useState } from "react";
import { Link } from "react-router-dom";

import { DISCARD_ACTION, type Notify, useApplyAction, useNotify, useOrderActions } from "./api";

const LABELS: Record<string, string> = { accept: "Принять", reject: "Отклонить" };

function DoneLink() {
  return (
    <p className="text-sm text-muted-foreground">
      Готово.{" "}
      <Link to="/c/orders" className="text-primary underline">
        Назад к заказам
      </Link>
    </p>
  );
}

export function OrderActions({ name }: { name: string }) {
  const actions = useOrderActions(name);
  const apply = useApplyAction(name);
  const notify = useNotify(name);
  const [draft, setDraft] = useState<Notify | null>(null);
  const [reason, setReason] = useState("");
  const [skipped, setSkipped] = useState(false);
  // discard (см. DISCARD_ACTION в api.ts) удаляет черновик заказа на сервере —
  // документа больше нет, а order-actions(name) больше не перечитывается (api.ts
  // не инвалидирует её после discard). discarded — единственный явный сигнал
  // «заказа больше нет»: TanStack Query после ошибки рефетча оставляет старые
  // actions.data нетронутыми (isRefetchError сохраняет data), так что сами кнопки
  // остались бы кликабельными и рабочими — их нужно прятать явным флагом, а не
  // выводить из actions.isError/actions.data.
  const [discarded, setDiscarded] = useState(false);

  // Больше нечего показывать: либо discard без чата для уведомления (черновика
  // нет вовсе), либо черновик уже отправлен/пропущен пользователем.
  const finished = skipped || (discarded && !draft);

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      {!discarded && actions.data && (
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
                        if (a.action === DISCARD_ACTION) setDiscarded(true);
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
      )}
      {!discarded && !actions.data && actions.isError && (
        <p className="text-destructive">{actions.error.message}</p>
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
      {finished && <DoneLink />}
    </div>
  );
}
