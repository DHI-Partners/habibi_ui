import type { Exception, Slot } from "./api";

// Значения weekday и kind — реальные опции Working Hours Slot
// (habibi_ai/habibi_ai/doctype/working_hours_slot/working_hours_slot.json).
export const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
export const SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const KIND_WORK = "Работа";
export const KIND_DELIVERY = "Доставка";

// -- ввод времени -------------------------------------------------------------
//
// Не <input type="time">: он показывает AM/PM по локали ОС, а владельцу нужно
// 24-часовое «ЧЧ:ММ». Поэтому обычное поле с маской: цифры, двоеточие
// ставится само, на выходе из поля — дополняется нулями.

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function maskTime(raw: string): string {
  if (raw.includes(":")) {
    const [h, m = ""] = raw.split(":");
    return `${h.replace(/\D/g, "").slice(0, 2)}:${m.replace(/\D/g, "").slice(0, 2)}`;
  }
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** «9» → «09:00», «9:3» → «09:30», «930» не угадываем — пусть подсветится. */
export function normalizeTime(value: string): string {
  const match = /^(\d{1,2})(?::(\d{0,2}))?$/.exec(value);
  if (!match) return value;
  const [, h, m = ""] = match;
  return `${h.padStart(2, "0")}:${m.padEnd(2, "0")}`;
}

/** «10:00:00» с сервера → «10:00» для поля; пустое — пустое. */
export const fromServer = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
export const toServer = (t: string) => (t ? `${t}:00` : "");

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

// -- проверка дня ---------------------------------------------------------------

export type Interval = { _id: number; opens: string; closes: string };

/**
 * Ошибка дня или null. Пересечения считаем так же, как бот (schedule._interval):
 * закрытие раньше открытия — работа через полночь, интервал идёт до следующих
 * суток. Совпадающие интервалы — частный случай пересечения.
 */
export function dayError(intervals: Interval[]): { ids: Set<number>; message: string } | null {
  const bad = intervals.filter((i) => !TIME_RE.test(i.opens) || !TIME_RE.test(i.closes));
  if (bad.length) return { ids: new Set(bad.map((i) => i._id)), message: "Время — в формате ЧЧ:ММ, от 00:00 до 23:59" };
  const same = intervals.filter((i) => i.opens === i.closes);
  if (same.length) return { ids: new Set(same.map((i) => i._id)), message: "Открытие и закрытие совпадают" };
  const spans = intervals.map((i) => {
    const start = minutes(i.opens);
    let end = minutes(i.closes);
    if (end <= start) end += 24 * 60;
    return { id: i._id, start, end };
  });
  const clash = new Set<number>();
  for (let a = 0; a < spans.length; a++) {
    for (let b = a + 1; b < spans.length; b++) {
      if (spans[a].start < spans[b].end && spans[b].start < spans[a].end) {
        clash.add(spans[a].id);
        clash.add(spans[b].id);
      }
    }
  }
  return clash.size ? { ids: clash, message: "Интервалы пересекаются" } : null;
}

// -- «открыто ли сейчас» для главной -------------------------------------------
//
// Та же логика, что у бота в habibi_ai/schedule.py (open_interval,
// _next_opening), только для вида «Работа»: иначе главная и бот расходились бы
// в том, открыто ли заведение. Время — в поясе заведения (Working Hours.time_zone).

function nowIn(timeZone: string): Date {
  if (!timeZone) return new Date();
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value]),
    );
    return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  } catch {
    return new Date();
  }
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function at(day: Date, time: string): Date {
  const d = new Date(day);
  d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  return d;
}

function span(day: Date, opens: string, closes: string): [Date, Date] {
  const start = at(day, opens);
  const end = at(day, closes);
  if (end <= start) end.setDate(end.getDate() + 1);
  return [start, end];
}

// Понедельник — 0, как weekday() в Python.
const weekdayOf = (d: Date) => (d.getDay() + 6) % 7;

function intervalsFor(day: Date, schedule: Slot[], exceptions: Exception[]): [Date, Date][] {
  const exc = exceptions.find((e) => e.date === isoDate(day));
  if (exc) {
    if (exc.closed) return [];
    if (exc.opens && exc.closes) return [span(day, exc.opens, exc.closes)];
  }
  const weekday = WEEKDAYS[weekdayOf(day)];
  return schedule
    .filter((r) => r.weekday === weekday && r.kind === KIND_WORK && r.opens && r.closes)
    .map((r) => span(day, r.opens, r.closes))
    .sort((a, b) => a[0].getTime() - b[0].getTime());
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function openStatus(
  schedule: Slot[],
  exceptions: Exception[],
  timeZone: string,
): { open: boolean; text: string } | null {
  if (!schedule.some((r) => r.kind === KIND_WORK)) return null;
  const now = nowIn(timeZone);
  for (const day of [addDays(now, -1), addDays(now, 0)]) {
    const current = intervalsFor(day, schedule, exceptions).find(([s, e]) => s <= now && now < e);
    if (current) return { open: true, text: `Открыто до ${hhmm(current[1])}` };
  }
  for (let offset = 0; offset <= 7; offset++) {
    const next = intervalsFor(addDays(now, offset), schedule, exceptions).find(([s]) => s > now);
    if (next) {
      const when = offset === 0 ? hhmm(next[0]) : offset === 1 ? `завтра в ${hhmm(next[0])}` : `${SHORT[weekdayOf(next[0])]} в ${hhmm(next[0])}`;
      return { open: false, text: offset === 0 ? `Закрыто · откроемся в ${when}` : `Закрыто · откроемся ${when}` };
    }
  }
  return { open: false, text: "Закрыто" };
}
