/**
 * Управление ручным переключением темы поверх системной настройки.
 *
 * shadcn/Tailwind различают тему классом `dark` на <html> (см. `@custom-variant
 * dark` в theme.css). Системную настройку без явного выбора пользователя
 * применяет блокирующий инлайн-скрипт в head (см. index.html / ui.html) —
 * он выполняется до отрисовки, поэтому мигания темы при загрузке нет.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "habibi:theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Явный выбор пользователя, если он есть; иначе — текущая системная тема. */
export function getActiveTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(STORAGE_KEY, theme);
}
