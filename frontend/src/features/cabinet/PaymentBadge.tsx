import { StatusBadge } from "./ui";

/** Оплата заказа: «Оплачен» зелёным, «Не оплачен» — нейтральным. Нет поля на сайте — ничего. */
export function PaymentBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return value === "Paid" ? <StatusBadge tone="ok">Оплачен</StatusBadge> : <StatusBadge tone="neutral">Не оплачен</StatusBadge>;
}
