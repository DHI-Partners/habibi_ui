import { useState } from "react";

import type { TraceStep } from "./types";

const TITLES: Record<string, string> = {
  chat: "Состояние чата",
  tools: "Предложенные инструменты",
  completion: "Запрос в модель",
  tool_use: "Вызов инструмента",
  answer: "Ответ пользователю",
};

/**
 * Известные ключи полей внутри data — переводим для читаемости. Список не
 * претендует на полноту: движок (соседний репозиторий) добавляет поля сам,
 * без синхронизации с фронтом, поэтому labelFor ниже отдаёт незнакомый ключ
 * как есть, а не прячет его. Один плоский словарь на все шаги: ключи вроде
 * "key" или "stack" значат одно и то же независимо от того, в каком шаге
 * встретились.
 */
const FIELD_LABELS: Record<string, string> = {
  created: "Новый чат",
  bot_id: "ID бота",
  current_scenario: "Текущий сценарий",
  scenario_stack: "Стек сценариев",
  metadata: "Метаданные",
  prompt: "Промпт",
  raw: "Ответ (сырой)",
  before: "Было",
  after: "Стало",
  key: "Ключ сценария",
  max_stack: "Лимит стека",
  action: "Действие",
  reason: "Причина",
  prompt_id: "ID промпта",
  scenario_metadata: "Метаданные сценария",
  merged_metadata: "Итоговые метаданные",
  system_prompt: "Системный промпт",
  sent: "Отправлено сообщений",
  total: "Всего сообщений",
  max_history_messages: "Лимит истории",
  triggered: "Сработал",
  messages: "Сообщения",
};

const ROLE_LABELS: Record<string, string> = {
  user: "Пользователь",
  assistant: "Ассистент",
  system: "Система",
};

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

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
 * JSON.stringify бросает на циклах и BigInt. Значения приходят из соседнего
 * репозитория и будут пополняться, а исключение при рендере уронило бы всю
 * панель — то есть ровно тот инструмент, которым разбираются, что пошло не
 * так. Показать нечитаемое лучше, чем не показать ничего. Раньше эта функция
 * форматировала весь data шага целиком; теперь она же служит последним
 * рубежом для любого отдельного значения, форма которого не распознана
 * (см. renderRaw) — сигнатура принимает unknown, а не только Record.
 */
function toText(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return `не удалось показать: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMultilineString(value: unknown): value is string {
  return typeof value === "string" && value.includes("\n");
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  );
}

/** Сообщением считаем любой объект с role и content — как в чате, так и в истории для модели. */
function looksLikeMessage(value: unknown): value is { role: unknown; content: unknown } {
  return isPlainObject(value) && "role" in value && "content" in value;
}

function formatScalar(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (typeof value === "bigint") return `${value}n`;
  return String(value);
}

function roleLabel(role: unknown): string {
  if (typeof role === "string") return ROLE_LABELS[role] ?? role;
  return formatScalar(role);
}

/**
 * Раскладка значения по форме, а не по имени поля — движок это отдельный
 * репозиторий, его поля меняются без синхронизации с фронтом, и словарь по
 * именам полей устарел бы уже назавтра. Форма (строка с переносами, массив
 * сообщений, массив примитивов, вложенный объект, скаляр) меняется куда
 * реже, чем конкретные названия ключей.
 */
type Shape =
  | { kind: "message-array"; value: Array<{ role: unknown; content: unknown }> }
  | { kind: "primitive-array"; value: unknown[] }
  | { kind: "object"; value: Record<string, unknown> }
  | { kind: "multiline"; value: string }
  | { kind: "scalar"; value: unknown }
  | { kind: "raw"; value: unknown };

function classify(value: unknown): Shape {
  if (Array.isArray(value)) {
    // Пустой массив тривиально проходит every() для примитивов — это и
    // нужно: пустой стек сценариев обязан выглядеть пустым списком, а не
    // пустым местом (см. renderPrimitiveList).
    if (value.length > 0 && value.every(looksLikeMessage)) {
      return { kind: "message-array", value: value as Array<{ role: unknown; content: unknown }> };
    }
    if (value.every((item) => isScalar(item))) {
      return { kind: "primitive-array", value };
    }
    return { kind: "raw", value };
  }
  if (isPlainObject(value)) return { kind: "object", value };
  if (isMultilineString(value)) return { kind: "multiline", value };
  if (isScalar(value)) return { kind: "scalar", value };
  return { kind: "raw", value };
}

function renderRaw(value: unknown) {
  // break-words + whitespace-pre-wrap — перенос по словам обязателен и здесь:
  // это тот же откат к JSON, что раньше был единственным путём для всего
  // шага, и длинный JSON без переноса уводил бы панель вбок ровно так же,
  // как когда-то system prompt.
  return (
    <pre className="rounded-lg bg-muted p-2 text-xs break-words whitespace-pre-wrap">{toText(value)}</pre>
  );
}

/**
 * Единый стиль для многострочного текста, который стоит показать как есть, а
 * не пытаться заново переизобрести где-то ещё: перенос по словам обязателен,
 * иначе длинный system prompt уводит панель вбок (см. renderRaw). Помимо
 * шагов трассировки тем же стилем показываются промпты в панели конфигурации
 * бота (BotConfigPanel) — тексты той же природы, просто пришедшие не в
 * разборе шага, а напрямую.
 */
export function PromptBlock({ text }: { text: string }) {
  return (
    <pre className="rounded-lg bg-muted p-2 text-xs break-words whitespace-pre-wrap">{text}</pre>
  );
}

function renderMultiline(value: string) {
  return <PromptBlock text={value} />;
}

function renderPrimitiveList(value: unknown[], path: string) {
  if (value.length === 0) {
    return <span className="text-xs italic text-muted-foreground">пусто</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {value.map((item, i) => (
        <span key={`${path}.${i}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-words">
          {formatScalar(item)}
        </span>
      ))}
    </div>
  );
}

function renderConversation(messages: Array<{ role: unknown; content: unknown }>, path: string) {
  return (
    <div className="space-y-2">
      {messages.map((message, i) => (
        <div key={`${path}.${i}`} className="rounded-lg border border-border p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">{roleLabel(message.role)}</div>
          {/* content — тоже значение произвольной формы (обычно многострочный текст,
              но не обязано им быть), поэтому раскладывается той же classify/renderShape,
              а не выводится как голая строка. */}
          {renderShape(classify(message.content), `${path}.${i}.content`)}
        </div>
      ))}
    </div>
  );
}

function renderObjectFields(value: Record<string, unknown>, path: string) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <span className="text-xs italic text-muted-foreground">пусто</span>;
  }
  return (
    <div className="space-y-1.5">
      {entries.map(([key, v]) => renderField(key, v, `${path}.${key}`))}
    </div>
  );
}

function renderShape(shape: Shape, path: string) {
  switch (shape.kind) {
    case "multiline":
      return renderMultiline(shape.value);
    case "message-array":
      return renderConversation(shape.value, path);
    case "primitive-array":
      return renderPrimitiveList(shape.value, path);
    case "object":
      return renderObjectFields(shape.value, path);
    case "scalar":
      return <span className="break-words font-mono text-xs">{formatScalar(shape.value)}</span>;
    case "raw":
    default:
      return renderRaw(shape.value);
  }
}

/**
 * Одно поле объекта: подпись (переведённая или сырой ключ — см. labelFor) и
 * значение рядом с ней. Скаляры без переносов строк идут в одну строку с
 * подписью — это счётчики и вердикты, их место — на виду, без раскрытия
 * блока. Всё остальное (многострочный текст, списки, вложенные объекты)
 * получает подпись сверху и содержимое под ней.
 */
function renderField(key: string, value: unknown, path: string) {
  const label = labelFor(key);
  const shape = classify(value);

  if (shape.kind === "scalar") {
    return (
      <div key={path} className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-muted-foreground">{label}:</span>
        <span className="break-words font-mono text-xs">{formatScalar(shape.value)}</span>
      </div>
    );
  }

  const countSuffix = shape.kind === "message-array" ? ` (${shape.value.length})` : "";
  return (
    <div key={path}>
      <div className="text-muted-foreground">
        {label}
        {countSuffix}
      </div>
      <div className="mt-0.5">{renderShape(shape, path)}</div>
    </div>
  );
}

/**
 * Вход в разбор данных одного шага. Сама обвязка каждого значения (см. выше)
 * старается не использовать JSON.stringify нигде, кроме заведомого отката
 * (renderRaw/toText) — но объект от движка может оказаться циклическим, а
 * рекурсия по его полям тогда не остановится и уронит стек. try/catch здесь
 * — тот же рубеж, что раньше стоял вокруг единственного JSON.stringify: если
 * раскладка по форме всё же упала, откатываемся на toText(data), у которого
 * есть собственный такой же рубеж (см. комментарий над toText).
 */
function renderStepData(data: Record<string, unknown>, path: string) {
  try {
    return renderObjectFields(data, path);
  } catch {
    return renderRaw(data);
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
            <div className="mt-1 rounded-lg border border-border p-2 text-xs">
              {renderStepData(step.data, step.step)}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
