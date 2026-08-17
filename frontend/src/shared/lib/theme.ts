/**
 * Управление ручным переключением темы поверх темы по умолчанию.
 *
 * shadcn/Tailwind различают тему классом `dark` на <html> (см. `@custom-variant
 * dark` в theme.css). Тему по умолчанию — до явного выбора пользователем в
 * нашем переключателе — применяет блокирующий инлайн-скрипт в head (см.
 * index.html / ui.html) до отрисовки, поэтому мигания темы при загрузке нет;
 * логика там продублирована и должна совпадать с этим файлом.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "habibi:theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Дефолт до ручного выбора — тема, которую пользователь уже выбрал в самом
 * Frappe (User.desk_theme), а не тема ОС: иначе наш интерфейс и Desk рядом
 * визуально расходятся. "Dark" → тёмная, "Automatic" → системная, всё
 * остальное (в т.ч. "Light" и пустое значение) → светлая.
 */
function bootPrefersDark(): boolean {
  const deskTheme = window.habibi?.desk_theme;
  if (deskTheme === "Dark") return true;
  if (deskTheme === "Automatic") return systemPrefersDark();
  return false;
}

/** Явный выбор пользователя, если он есть; иначе — тема по умолчанию из Frappe. */
export function getActiveTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return bootPrefersDark() ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(STORAGE_KEY, theme);
}
