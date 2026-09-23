import { useEffect, useState } from "react";

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

export function HoursScreen() {
  const { query, mutation } = useHours();
  const [schedule, setSchedule] = useState<Slot[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);

  useEffect(() => {
    if (query.data) {
      setSchedule(query.data.schedule);
      setExceptions(query.data.exceptions);
    }
  }, [query.data]);

  // Вид нового интервала — как у последней добавленной строки, а если строк
  // нет вовсе — первая опция доктайпа («Работа»).
  const defaultKind = schedule[0]?.kind ?? KIND_OPTIONS[0];
  const update = (i: number, patch: Partial<Slot>) =>
    setSchedule((s) => s.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <section className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Режим работы</h1>
      {WEEKDAYS.map((day) => {
        const rows = schedule.map((r, i) => [r, i] as const).filter(([r]) => r.weekday === day);
        return (
          <div key={day} className="flex flex-wrap items-center gap-2">
            <span className="w-8 font-medium">{DAY_LABEL[day]}</span>
            {rows.length === 0 && <span className="text-muted-foreground">выходной</span>}
            {rows.map(([r, i]) => (
              <span key={i} className="flex items-center gap-1">
                <select
                  value={r.kind}
                  onChange={(e) => update(i, { kind: e.target.value })}
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
                  onChange={(e) => update(i, { opens: `${e.target.value}:00` })}
                  className="rounded border border-border bg-background px-2 py-1"
                />
                –
                <input
                  type="time"
                  value={r.closes.slice(0, 5)}
                  onChange={(e) => update(i, { closes: `${e.target.value}:00` })}
                  className="rounded border border-border bg-background px-2 py-1"
                />
                <button type="button" onClick={() => setSchedule((s) => s.filter((_, j) => j !== i))} aria-label="Убрать интервал">
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() =>
                setSchedule((s) => [...s, { weekday: day, kind: defaultKind, opens: "10:00:00", closes: "22:00:00" }])
              }
              className="text-sm text-primary"
            >
              + интервал
            </button>
          </div>
        );
      })}
      <h2 className="font-medium">Исключения</h2>
      {exceptions.map((ex, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={ex.date}
            onChange={(e) => setExceptions((s) => s.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))}
            className="rounded border border-border bg-background px-2 py-1"
          />
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={Boolean(ex.closed)}
              onChange={(e) =>
                setExceptions((s) => s.map((r, j) => (j === i ? { ...r, closed: e.target.checked ? 1 : 0 } : r)))
              }
            />
            закрыто
          </label>
          <input
            value={ex.note}
            placeholder="причина"
            onChange={(e) => setExceptions((s) => s.map((r, j) => (j === i ? { ...r, note: e.target.value } : r)))}
            className="flex-1 rounded border border-border bg-background px-2 py-1"
          />
          <button type="button" onClick={() => setExceptions((s) => s.filter((_, j) => j !== i))} aria-label="Убрать исключение">
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setExceptions((s) => [...s, { date: "", closed: 1, opens: "", closes: "", note: "" }])}
        className="text-sm text-primary"
      >
        + дата
      </button>
      {mutation.error && <p className="text-destructive">{mutation.error.message}</p>}
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ schedule, exceptions })}
        className="block rounded-lg bg-primary px-4 py-2 text-primary-foreground"
      >
        Сохранить
      </button>
    </section>
  );
}
