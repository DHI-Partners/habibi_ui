import { useEffect, useState } from "react";

/**
 * Иконки берём из спрайта Frappe: <svg><use href="...#icon-NAME" /></svg>.
 * У нас нет декларативного списка id спрайта, поэтому проверяем наличие
 * символа по факту (один раз, результат кэшируется на модуль) и, если его
 * нет, рисуем нейтральную заглушку вместо пустого места. Так же — если
 * поле icon у ярлыка/пространства вообще пустое.
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

export interface IconProps {
  name: string;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  const ids = useIconIds();
  const symbolId = name ? `icon-${name}` : "";
  const available = symbolId !== "" && (ids?.has(symbolId) ?? false);

  if (!available) {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`${SPRITE_URL}#${symbolId}`} />
    </svg>
  );
}
