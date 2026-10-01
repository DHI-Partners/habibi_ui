import type { ReactNode } from "react";

import type { CabinetField, CabinetSection } from "../../shared/types/api";
import type { Row } from "./api";
import { formatValue } from "./FieldInput";
import { docstatusBadge, orderBadge, type StateKind, shortNo, stateBadge } from "./format";
import { fulfilmentIcon } from "./icons";
import { StatusBadge } from "./ui";

// Ячейки списка и доски: как показывать значение поля раздела.

export const NUMERIC = new Set(["Currency", "Float", "Int"]);

// Не тип Frappe: так адаптер (например @order_status в habibi_ai) помечает
// человеческий статус документа — значение {state, kind}, рисуется бейджем
// тем же правилом, что на экране заказа (orderBadge).
export const STATUS = "Status";

/** Значение ячейки: статусы Frappe — бейджем, числа — с разрядами, флаг — бейджем с подписью. */
export function Cell({ field, row }: { field: CabinetField; row: Row }): ReactNode {
  const value = row[field.fieldname];
  if (field.fieldname === "docstatus") {
    const [label, tone] = docstatusBadge(value);
    return <StatusBadge tone={tone}>{label}</StatusBadge>;
  }
  if (field.fieldtype === STATUS) {
    const status = value as { state: string; kind: StateKind } | null | undefined;
    if (!status) return null;
    const [label, tone] = orderBadge(status.state, status.kind);
    return <StatusBadge tone={tone}>{label}</StatusBadge>;
  }
  if (field.fieldname === "workflow_state") {
    if (!value) return null;
    const [label, tone] = stateBadge(String(value));
    return <StatusBadge tone={tone}>{label}</StatusBadge>;
  }
  if (field.fieldtype === "Check") {
    return value ? <StatusBadge tone="neutral">{field.label}</StatusBadge> : null;
  }
  const Icon = field.fieldtype === "Select" ? fulfilmentIcon(value) : undefined;
  if (Icon) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {formatValue(field, value)}
      </span>
    );
  }
  return formatValue(field, value);
}

/** Текст первой колонки: у заказов — «№10», а не SAL-ORD-2026-00010 (длинное имя владельцу ни к чему). */
export function titleText(section: CabinetSection, f: CabinetField, row: Row): string {
  if (section.doctype === "Sales Order" && f.fieldname === "name") return shortNo(row.name);
  return formatValue(f, row[f.fieldname]) || row.name;
}

export const isBadge = (f: CabinetField) =>
  f.fieldname === "docstatus" || f.fieldname === "workflow_state" || f.fieldtype === STATUS || f.fieldtype === "Check";

