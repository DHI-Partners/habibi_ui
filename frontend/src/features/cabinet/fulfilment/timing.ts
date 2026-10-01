// Сколько заказ ждёт на кухне: после 15 минут — предупреждение, после 25 — просрочка.
export const WARN_MIN = 15;
export const LATE_MIN = 25;

export type Urgency = "ok" | "warn" | "bad";

export const urgency = (age: number): Urgency => (age >= LATE_MIN ? "bad" : age >= WARN_MIN ? "warn" : "ok");

// Цвет несёт смысл: таймер и тонкая рамка карточки, а не заливка всей карточки
export const TIMER: Record<Urgency, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
};

export const BORDER: Record<Urgency, string> = {
  ok: "",
  warn: "border-amber-300 dark:border-amber-400/40",
  bad: "border-red-300 dark:border-red-400/40",
};
