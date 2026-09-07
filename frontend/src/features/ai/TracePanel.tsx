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
  // По умолчанию развёрнуты все шаги — весь разбор читается сверху вниз без
  // кликов, ради этого панель и существует. Держим не имя открытого шага, а
  // множество СВЁРНУТЫХ: пустое множество естественно означает «всё видно»,
  // и клик по шагу лишь добавляет/убирает его из множества, не трогая
  // остальные — в отличие от одного «open», где раскрытие одного шага
  // означало закрытие всех прочих.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Новая трассировка — новый разбор, начинать его надо с начала (снова все
  // шаги развёрнуты). Состояние сбрасывается здесь, а не ключом от
  // вызывающего: оно принадлежит панели, и требовать от каждого места вызова
  // помнить про key — ловушка.
  const [shown, setShown] = useState(steps);
  if (shown !== steps) {
    setShown(steps);
    setCollapsed(new Set());
  }

  function toggle(step: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  }

  return (
    <aside className="w-96 shrink-0 overflow-y-auto rounded-2xl border border-border bg-card p-3 text-sm">
      <h2 className="mb-2 font-medium">Как это обработалось</h2>
      {steps.map((step) => (
        <div key={step.step} className="mb-1">
          <button
            className="w-full rounded-lg px-2 py-1 text-left hover:bg-accent"
            onClick={() => toggle(step.step)}
          >
            {TITLES[step.step] ?? step.step}
          </button>
          {!collapsed.has(step.step) && (
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
