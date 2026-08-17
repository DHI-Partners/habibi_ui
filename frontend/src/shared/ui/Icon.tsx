import { useEffect, useState } from "react";

import { cn } from "../lib/utils";

/**
 * Иконки берём из спрайта Frappe: <svg><use href="...#icon-NAME" /></svg>.
 * У нас нет декларативного списка id спрайта, поэтому проверяем наличие
 * символа по факту (один раз, результат кэшируется на модуль). Пока список
 * не загружен, а также если поле icon у ярлыка/пространства пустое или id
 * отсутствует в спрайте — рисуем не пустое место, а первую букву подписи.
 */

const SPRITE_URL = "/assets/frappe/icons/timeless/icons.svg";

let idsPromise: Promise<Set<string>> | null = null;

function loadIconIds(): Promise<Set<string>> {
  idsPromise ??= fetch(SPRITE_URL)
    .then((response) => (response.ok ? response.text() : ""))
    .then((markup) => {
      const ids = new Set<string>();
      const symbolIdPattern = /<symbol[^>]*\bid="([^"]+)"/g;
      for (const match of markup.matchAll(symbolIdPattern)) {
        ids.add(match[1]);
      }
      return ids;
    })
    .catch(() => new Set<string>());
  return idsPromise;
}

function useIconIds(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    loadIconIds().then((loaded) => {
      if (active) setIds(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return ids;
}

function fallbackLetter(source: string): string {
  const trimmed = source.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export interface IconProps {
  /** Имя символа в спрайте Frappe (без префикса `icon-`), как приходит из API. */
  name: string;
  /** Подпись рядом с иконкой — источник буквы для запасного варианта. */
  label?: string;
  className?: string;
}

export function Icon({ name, label, className }: IconProps) {
  const ids = useIconIds();
  const hasName = name.trim() !== "";
  const symbolId = hasName ? `icon-${name}` : "";
  const available = hasName && (ids?.has(symbolId) ?? false);

  if (!available) {
    return (
      <span
        className={cn("flex items-center justify-center text-xs leading-none font-semibold", className)}
        aria-hidden="true"
      >
        {fallbackLetter(label ?? name)}
      </span>
    );
  }

  return (
    <svg className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <use href={`${SPRITE_URL}#${symbolId}`} />
    </svg>
  );
}
