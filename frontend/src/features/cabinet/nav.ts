import {
  Building2,
  Clock,
  House,
  LayoutGrid,
  ListTodo,
  type LucideIcon,
  MapPin,
  MessageCircle,
  Send,
  ShoppingBag,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { useCabinetConfig } from "./api";

// Таб-бар телефона: первые разделы по порядку, остальное — в «Ещё».
// Какие разделы первые, решает пресет порядком строк, а не этот код.
export const TABS = 3;

// Cabinet Section.icon — имя иконки lucide из пресета. Словарь, а не
// динамический импорт по имени: весь набор lucide в бандл не тащим, а
// незнакомое имя получает нейтральную иконку.
const ICONS: Record<string, LucideIcon> = {
  home: House,
  house: House,
  receipt: ShoppingBag,
  "shopping-bag": ShoppingBag,
  "message-circle": MessageCircle,
  users: Users,
  utensils: UtensilsCrossed,
  map: MapPin,
  "map-pin": MapPin,
  clock: Clock,
  building: Building2,
  send: Send,
  "list-todo": ListTodo,
  todo: ListTodo,
};

export const sectionIcon = (icon: string): LucideIcon => ICONS[icon] ?? LayoutGrid;

/**
 * Куда ведёт «назад» с экрана раздела. Разделы таб-бара — корневые, им назад
 * некуда; остальные открываются из «Ещё» и возвращаются туда (на десктопе
 * они и так в сайдбаре — кнопка там прячется, см. Page.backMobileOnly).
 */
export function useSectionBack(key: string): string | null {
  const config = useCabinetConfig();
  const index = config.data?.findIndex((s) => s.key === key) ?? -1;
  return index >= 0 && index < TABS ? null : "/c/more";
}
