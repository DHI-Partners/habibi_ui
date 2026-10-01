import {
  CheckCheck,
  ChefHat,
  CircleCheck,
  CirclePlus,
  CircleX,
  type LucideIcon,
  PackageCheck,
  Store,
  Truck,
} from "lucide-react";

// Иконки статусов и способов получения: одна и та же у чипа, бейджа и карточки,
// чтобы группы отличались с первого взгляда, а не только цветом.

// Ключ — состояние воркфлоу прод-сайта (то же слово у быстрого фильтра) или
// «new/accepted/cancelled» у сайта без воркфлоу.
const STATE_ICONS: Record<string, LucideIcon> = {
  New: CirclePlus,
  new: CirclePlus,
  Confirmed: CircleCheck,
  accepted: CircleCheck,
  "In Kitchen": ChefHat,
  Ready: PackageCheck,
  "Out for Delivery": Truck,
  Delivered: CheckCheck,
  Cancelled: CircleX,
  cancelled: CircleX,
};

/** Иконка состояния заказа; незнакомое состояние — без иконки. */
export const stateIcon = (state: string | null | undefined): LucideIcon | undefined =>
  state ? STATE_ICONS[state] : undefined;

const FULFILMENT_ICONS: Record<string, LucideIcon> = { Delivery: Truck, Pickup: Store };

/** Иконка способа получения («Delivery»/«Pickup»). */
export const fulfilmentIcon = (value: unknown): LucideIcon | undefined => FULFILMENT_ICONS[String(value)];
