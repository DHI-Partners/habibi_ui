import { useState } from "react";

import type { TraceStep } from "./types";

const TITLES: Record<string, string> = {
  chat: "Состояние чата",
  router: "Роутер намерений",
  stack: "Стек сценариев",
  scenario: "Сценарий",
  completion: "Запрос в модель",
  auto_return: "Автовозврат",
};

/**
 * Трассировка последнего сообщения.
 *
 * Панель рисуется, только когда сервер прислал шаги, а он их присылает только
 * обладателю роли Habibi AI Debug. Своего переключателя здесь нет намеренно:
 * право решается на сервере, а не спрятанной кнопкой.
 */
/**
 * JSON.stringify бросает на циклах и BigInt. Шаги приходит из соседнего
 * репозитория и будут пополняться, а исключение при рендере уронило бы всю
 * панель — то есть ровно тот инструмент, которым разбираются, что пошло не
 * так. Показать нечитаемое лучше, чем не показать ничего.
 */
function toText(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return `не удалось показать: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function TracePanel({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState<string | null>("completion");

  // Новая трассировка — новый разбор, начинать его надо с начала. Состояние
  // сбрасывается здесь, а не ключом от вызывающего: оно принадлежит панели, и
  // требовать от каждого места вызова помнить про key — ловушка.
  const [shown, setShown] = useState(steps);
  if (shown !== steps) {
    setShown(steps);
    setOpen("completion");
  }

  return (
    <aside className="w-96 shrink-0 overflow-y-auto rounded-2xl border border-border bg-card p-3 text-sm">
      <h2 className="mb-2 font-medium">Как это обработалось</h2>
      {steps.map((step) => (
        <div key={step.step} className="mb-1">
          <button
            className="w-full rounded-lg px-2 py-1 text-left hover:bg-accent"
            onClick={() => setOpen(open === step.step ? null : step.step)}
          >
            {TITLES[step.step] ?? step.step}
          </button>
          {open === step.step && (
            // Перенос по словам обязателен: в completion лежит system prompt
            // целиком, и без него панель уезжает горизонтальной прокруткой.
            <pre className="mt-1 rounded-lg bg-muted p-2 text-xs break-words whitespace-pre-wrap">
              {toText(step.data)}
            </pre>
          )}
        </div>
      ))}
    </aside>
  );
}
