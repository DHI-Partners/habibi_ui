import type { CabinetField, CabinetSection } from "../../shared/types/api";
import type { Filter, ListQuery } from "./api";

// Состояние панели списка: поиск, быстрый фильтр, период, фильтры по полям, сортировка.
// Чистая логика без React — из неё собирается запрос к серверу.

export type Period = "" | "today" | "yesterday" | "7d" | "30d" | "custom";

export type ListState = {
  search: string;
  facet: string;
  /** «поле asc|desc»; пусто — новые сверху по дате создания */
  orderBy: string;
  period: Period;
  from: string;
  to: string;
  /** Значения Select-полей раздела: fieldname → значение; пусто — «все» */
  fields: Record<string, string>;
};

export const INITIAL_STATE: ListState = { search: "", facet: "", orderBy: "", period: "", from: "", to: "", fields: {} };

export const PERIODS: { value: Period; label: string }[] = [
  { value: "", label: "Любой период" },
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "custom", label: "Свои даты" },
];

export const SORTS: { value: string; label: string }[] = [
  { value: "", label: "Сначала новые" },
  { value: "creation asc", label: "Сначала старые" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function shift(d: Date, days: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + days);
  return r;
}

/** Границы периода как даты «ГГГГ-ММ-ДД»; пустая сторона — без ограничения. */
export function periodRange(state: Pick<ListState, "period" | "from" | "to">, now = new Date()): [string, string] {
  switch (state.period) {
    case "today":
      return [iso(now), iso(now)];
    case "yesterday":
      return [iso(shift(now, -1)), iso(shift(now, -1))];
    case "7d":
      return [iso(shift(now, -6)), iso(now)];
    case "30d":
      return [iso(shift(now, -29)), iso(now)];
    case "custom":
      return [state.from, state.to];
    default:
      return ["", ""];
  }
}

/** Период — отбор по дате создания: она есть у любого документа, даже если в списке её нет. */
export function periodFilters(state: Pick<ListState, "period" | "from" | "to">, now = new Date()): Filter[] {
  const [from, to] = periodRange(state, now);
  const result: Filter[] = [];
  if (from) result.push(["creation", ">=", `${from} 00:00:00`]);
  if (to) result.push(["creation", "<=", `${to} 23:59:59`]);
  return result;
}

export function buildQuery(state: ListState, search: string, now = new Date()): ListQuery {
  const filters: Filter[] = [...periodFilters(state, now)];
  for (const [field, value] of Object.entries(state.fields)) {
    if (value) filters.push([field, "=", value]);
  }
  return { filters, search: search.trim(), orderBy: state.orderBy, facet: state.facet };
}

/** Сколько фильтров включено, кроме поиска, быстрого фильтра и сортировки — для значка на кнопке. */
export function activeFilters(state: ListState): number {
  return (state.period ? 1 : 0) + Object.values(state.fields).filter(Boolean).length;
}

export const isDirty = (state: ListState): boolean =>
  activeFilters(state) > 0 || state.search.trim() !== "" || state.facet !== "" || state.orderBy !== "";

// Поля, по которым сервер ищет строкой поиска (habibi_ui.api.v1.cabinet.SEARCH_TYPES)
const SEARCH_TYPES = new Set(["Data", "Link", "Small Text", "Text", "Long Text", "Text Editor", "Read Only", "Phone"]);

export function searchLabels(section: CabinetSection): string[] {
  return section.list_fields.filter((f) => SEARCH_TYPES.has(f.fieldtype)).map((f) => f.label.toLowerCase());
}

/** Поля-перечисления раздела — для них появляется выпадающий фильтр («Получение»). */
export function selectFilters(section: CabinetSection): (CabinetField & { choices: string[] })[] {
  return section.list_fields
    .filter((f) => f.fieldtype === "Select" && f.fieldname !== "docstatus")
    .map((f) => ({ ...f, choices: f.options.split("\n").filter(Boolean) }))
    .filter((f) => f.choices.length > 0);
}

/**
 * Период нужен тем спискам, где даты — суть: заказам (есть статус) и всему, что
 * показывает дату создания (клиенты — «Регистрация»).
 */
export function hasPeriod(section: CabinetSection): boolean {
  return section.list_fields.some((f) => f.fieldname === "creation" || f.fieldtype === "Status");
}

/** Следующее направление сортировки по клику на заголовок столбца. */
export function nextOrder(current: string, field: string): string {
  const [f, dir] = current.split(" ");
  return f === field && dir === "asc" ? `${field} desc` : f === field ? "" : `${field} asc`;
}
