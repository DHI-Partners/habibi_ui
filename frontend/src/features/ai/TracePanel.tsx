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
 * Почему у выбранного сообщения нет разбора, если его нет:
 *  - "none": сообщение не выбрано (или чат не открыт) — нечего показывать;
 *  - "history": сообщение пришло из истории чата, а не из отправки в этой
 *    сессии — трассировка нигде не хранится между перезагрузками, это норма,
 *    а не поломка;
 *  - "no-role": сообщение отправлено в этой сессии, но сервер не прислал
 *    debug — значит роли Habibi AI Debug у пользователя нет. Отличить этот
 *    случай от "history" может только вызывающий (ChatPage), он же знает,
 *    какие id сообщений вообще были получены в ответ на отправку.
 */
export type TraceAbsenceReason = "none" | "history" | "no-role";

const ABSENCE_TEXT: Record<TraceAbsenceReason, string> = {
  none: "Кликните по ответу ассистента, чтобы увидеть разбор его обработки.",
  history: "Это сообщение из истории. Разбор нигде не хранится между сессиями — это ожидаемо, не ошибка.",
  "no-role": "Сервер не прислал разбор. Трассировка доступна только роли «Habibi AI Debug».",
};

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

/**
 * Разбор одного выбранного сообщения — какое именно, решает ChatPage: она
 * держит трассировки всех сообщений сессии по id и передаёт сюда либо шаги,
 * либо причину, почему их нет (см. TraceAbsenceReason). Панель сама не решает,
 * что показать за отсутствием шагов — только как объяснить конкретную причину
 * текстом.
 */
export function TracePanel({
  steps,
  absenceReason,
}: {
  steps: TraceStep[] | undefined;
  absenceReason: TraceAbsenceReason;
}) {
  // По умолчанию развёрнуты все шаги — весь разбор читается сверху вниз без
  // кликов, ради этого панель и существует. Держим не имя открытого шага, а
  // множество СВЁРНУТЫХ: пустое множество естественно означает «всё видно»,
  // и клик по шагу лишь добавляет/убирает его из множества, не трогая
  // остальные — в отличие от одного «open», где раскрытие одного шага
  // означало закрытие всех прочих.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Новый разбор — новый набор шагов, начинать его надо с начала (снова все
  // шаги развёрнуты). Состояние сбрасывается здесь, а не ключом от
  // вызывающего: оно принадлежит панели, и требовать от каждого места вызова
  // помнить про key — ловушка. Сравнение по ссылке работает и тогда, когда
  // steps вовсе нет (undefined === undefined не меняется при переключении
  // между двумя причинами отсутствия) — сбрасывать в этом случае нечего,
  // раскрытых шагов ещё не было.
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
      {!steps && <p className="text-muted-foreground">{ABSENCE_TEXT[absenceReason]}</p>}
      {steps?.map((step) => (
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
