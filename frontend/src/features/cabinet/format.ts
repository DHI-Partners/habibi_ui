// Форматирование для экранов кабинета: числа, даты, номера, статусы.
// Всё по-русски и без знания о конкретном бизнесе — пресет может
// подставить любые разделы, а подписи должны оставаться человеческими.

/** «1 заказ», «2 заказа», «5 заказов». */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

// Валюту кабинет не знает: у сумм в разделах нет поля валюты, а валюта
// компании по умолчанию на сайте бывает не той, в которой работает бизнес.
// Поэтому только число с разрядами — без чужого символа.
const MONEY = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function money(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? MONEY.format(n) : String(value);
}

/** «SAL-ORD-2026-00018» → «№18»: длинное имя документа владельцу ни к чему. */
export function shortNo(name: string): string {
  const match = /(\d+)$/.exec(name);
  return match ? `№${Number(match[1])}` : name;
}

/**
 * Сервер отдаёт наивную дату-время сайта «YYYY-MM-DD HH:MM:SS.ffffff»; с
 * пробелом вместо T её разбирает не каждый браузер (Safari), поэтому меняем.
 */
export function parseSiteDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const at = new Date(value.replace(" ", "T"));
  return Number.isNaN(at.getTime()) ? null : at;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysAgo(d: Date, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
}

const TIME = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAY_MONTH = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const SHORT_DATE = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });

export const clock = (d: Date) => TIME.format(d);

/** Время последнего сообщения в списке: «13:42», «вчера», «12.09». */
export function listStamp(value: string | null | undefined): string {
  const d = parseSiteDate(value);
  if (!d) return "";
  const ago = daysAgo(d);
  if (ago === 0) return TIME.format(d);
  if (ago === 1) return "вчера";
  return SHORT_DATE.format(d);
}

/** Разделитель дней в переписке: «Сегодня», «Вчера», «12 сентября». */
export function dayTitle(d: Date): string {
  const ago = daysAgo(d);
  if (ago === 0) return "Сегодня";
  if (ago === 1) return "Вчера";
  return DAY_MONTH.format(d);
}

/** Дата без времени («2026-09-23»): «сегодня», «вчера», «23 сентября». */
export function dateLabel(value: unknown): string {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(value);
  const date = new Date(y, m - 1, d);
  const ago = daysAgo(date);
  if (ago === 0) return "сегодня";
  if (ago === 1) return "вчера";
  return (date.getFullYear() === new Date().getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
}

export function initial(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

// Способ получения хранится английскими значениями Select («Delivery»/«Pickup»,
// см. спеку заказов) — владельцу показываем по-русски, незнакомое — как есть.
const FULFILMENT: Record<string, string> = { Delivery: "Доставка", Pickup: "Самовывоз" };
export const fulfilmentLabel = (value: unknown) => (value ? (FULFILMENT[String(value)] ?? String(value)) : "");

export type Tone = "new" | "ok" | "progress" | "bad" | "neutral";

// Состояние заказа приходит то из воркфлоу (английские имена состояний прод-
// воркфлоу), то из docstatus без воркфлоу (русские «Черновик/Принят/Отменён»,
// см. orders._state). Цвет и подпись выбираем по смыслу, незнакомое — нейтрально.
const STATES: Record<string, [string, Tone]> = {
  New: ["Новый", "new"],
  Черновик: ["Новый", "new"],
  Draft: ["Новый", "new"],
  Confirmed: ["Принят", "ok"],
  Принят: ["Принят", "ok"],
  "In Kitchen": ["Готовится", "progress"],
  Ready: ["Готов", "progress"],
  "Out for Delivery": ["В пути", "progress"],
  Delivered: ["Выдан", "ok"],
  Cancelled: ["Отменён", "bad"],
  Отменён: ["Отменён", "bad"],
  Отклонён: ["Отклонён", "bad"],
};

export function stateBadge(state: string | null | undefined): [string, Tone] {
  if (!state) return ["", "neutral"];
  return STATES[state] ?? [state, "neutral"];
}

/** docstatus Frappe — общий для всех доктайпов, поэтому понятен и списку. */
export function docstatusBadge(value: unknown): [string, Tone] {
  const n = Number(value);
  if (n === 1) return ["Проведён", "ok"];
  if (n === 2) return ["Отменён", "bad"];
  return ["Черновик", "new"];
}
