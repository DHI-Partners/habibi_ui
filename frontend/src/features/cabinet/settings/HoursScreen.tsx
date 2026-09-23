import { useEffect, useRef, useState } from "react";

import { type Exception, type Slot, useHours } from "./api";

// Значения weekday и kind — реальные опции Working Hours Slot
// (habibi_ai/habibi_ai/doctype/working_hours_slot/working_hours_slot.json):
// weekday — русские названия дней, kind — «Работа» (приём заказов) или
// «Доставка» (отдельное окно доставки). Опций kind две, поэтому владелец
// выбирает её на каждом интервале, а не только один раз для всего расписания.
const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const DAY_LABEL: Record<string, string> = {
  Понедельник: "Пн",
  Вторник: "Вт",
  Среда: "Ср",
  Четверг: "Чт",
  Пятница: "Пт",
  Суббота: "Сб",
  Воскресенье: "Вс",
};
const KIND_OPTIONS = ["Работа", "Доставка"];

// Ключи React-списков — свой счётчик, а не индекс массива: индекс меняется
// при удалении строки посередине и путает reconciliation (фокус/значение
// не той строки). _id — только на клиенте, перед отправкой на сервер снимается.
let idSeq = 0;
const nextId = () => ++idSeq;

type SlotRow = Slot & { _id: number };
type ExceptionRow = Exception & { _id: number };

const withIds = <T,>(rows: T[]): (T & { _id: number })[] => rows.map((row) => ({ ...row, _id: nextId() }));
const stripIds = <T extends { _id: number }>(rows: T[]): Omit<T, "_id">[] =>
  rows.map(({ _id: _omit, ...rest }) => rest);

export function HoursScreen() {
  const { query, mutation } = useHours();
  const [schedule, setSchedule] = useState<SlotRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  // Сеем форму только раз, при первой загрузке — иначе рефетч под открытым
  // экраном (staleTime по умолчанию 0, фокус окна, инвалидация из
  // useRealtime) стирал бы то, что владелец уже успел изменить. После
  // сохранения расписание обновляется явно, из ответа мутации.
  const seededRef = useRef(false);

  useEffect(() => {
    if (query.data && !seededRef.current) {
      setSchedule(withIds(query.data.schedule));
      setExceptions(withIds(query.data.exceptions));
      seededRef.current = true;
    }
  }, [query.data]);

  // Вид нового интервала — как у последней добавленной строки, а если строк
  // нет вовсе — первая опция доктайпа («Работа»).
  const defaultKind = schedule[0]?.kind ?? KIND_OPTIONS[0];
  const update = (id: number, patch: Partial<Slot>) =>
    setSchedule((s) => s.map((row) => (row._id === id ? { ...row, ...patch } : row)));
  // date — обязательное поле Working Hours Exception: пустая строка на
  // сервере провалит save() с малопонятной ошибкой. Лучше не дать сохранить
  // вовсе, чем молча выбросить недописанную строку владельца.
  const hasEmptyExceptionDate = exceptions.some((ex) => !ex.date);

  return (
    <section className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Режим работы</h1>
      {WEEKDAYS.map((day) => {
        const rows = schedule.filter((r) => r.weekday === day);
        return (
          <div key={day} className="flex flex-wrap items-center gap-2">
            <span className="w-8 font-medium">{DAY_LABEL[day]}</span>
            {rows.length === 0 && <span className="text-muted-foreground">выходной</span>}
            {rows.map((r) => (
              <span key={r._id} className="flex items-center gap-1">
                <select
                  value={r.kind}
                  onChange={(e) => update(r._id, { kind: e.target.value })}
                  className="rounded border border-border bg-background px-1 py-1 text-sm"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={r.opens.slice(0, 5)}
                  onChange={(e) => update(r._id, { opens: `${e.target.value}:00` })}
                  className="rounded border border-border bg-background px-2 py-1"
                />
                –
                <input
                  type="time"
                  value={r.closes.slice(0, 5)}
                  onChange={(e) => update(r._id, { closes: `${e.target.value}:00` })}
                  className="rounded border border-border bg-background px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => setSchedule((s) => s.filter((row) => row._id !== r._id))}
                  aria-label="Убрать интервал"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() =>
                setSchedule((s) => [
                  ...s,
                  { _id: nextId(), weekday: day, kind: defaultKind, opens: "10:00:00", closes: "22:00:00" },
                ])
              }
              className="text-sm text-primary"
            >
              + интервал
            </button>
          </div>
        );
      })}
      <h2 className="font-medium">Исключения</h2>
      {exceptions.map((ex) => (
        <div key={ex._id} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={ex.date}
            onChange={(e) => setExceptions((s) => s.map((r) => (r._id === ex._id ? { ...r, date: e.target.value } : r)))}
            className="rounded border border-border bg-background px-2 py-1"
          />
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={Boolean(ex.closed)}
              onChange={(e) =>
                setExceptions((s) => s.map((r) => (r._id === ex._id ? { ...r, closed: e.target.checked ? 1 : 0 } : r)))
              }
            />
            закрыто
          </label>
          <input
            value={ex.note}
            placeholder="причина"
            onChange={(e) => setExceptions((s) => s.map((r) => (r._id === ex._id ? { ...r, note: e.target.value } : r)))}
            className="flex-1 rounded border border-border bg-background px-2 py-1"
          />
          <button
            type="button"
            onClick={() => setExceptions((s) => s.filter((r) => r._id !== ex._id))}
            aria-label="Убрать исключение"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setExceptions((s) => [...s, { _id: nextId(), date: "", closed: 1, opens: "", closes: "", note: "" }])}
        className="text-sm text-primary"
      >
        + дата
      </button>
      {hasEmptyExceptionDate && (
        <p className="text-sm text-muted-foreground">Укажите дату для каждого исключения, чтобы сохранить</p>
      )}
      {mutation.error && <p className="text-destructive">{mutation.error.message}</p>}
      <button
        type="button"
        disabled={mutation.isPending || hasEmptyExceptionDate}
        onClick={() =>
          mutation.mutate(
            { schedule: stripIds(schedule), exceptions: stripIds(exceptions) },
            {
              onSuccess: (saved) => {
                setSchedule(withIds(saved.schedule));
                setExceptions(withIds(saved.exceptions));
              },
            },
          )
        }
        className="block rounded-lg bg-primary px-4 py-2 text-primary-foreground"
      >
        Сохранить
      </button>
    </section>
  );
}
