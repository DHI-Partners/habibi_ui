import { Check, Clock, MapPin, PackageCheck, Phone, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import { Button, buttonVariants } from "../../../shared/ui/button";
import { durationLabel, plural, shortNo } from "../format";
import { darkButton, EmptyState, ErrorNote, ListSkeleton, Page, StatusBadge, surface, UnderlineTabs, WarningNote } from "../ui";
import { type CourierOrder, useCourierFree, useCourierMine, useMarkDelivered, useTake } from "./api";

type Tab = "mine" | "free";

const mapLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export function CourierScreen() {
  const [tab, setTab] = useState<Tab>("mine");
  const mine = useCourierMine();
  const free = useCourierFree();
  const delivered = useMarkDelivered();
  const take = useTake();

  function onTake(order: CourierOrder) {
    take.mutate(order.name, {
      onSuccess: ({ taken }) => {
        if (taken) {
          toast.error("Заказ уже взят или недоступен");
          return;
        }
        toast.success(`${shortNo(order.name)} — ваш`);
        setTab("mine");
      },
      onError: (e) => toast.error(e.message),
    });
  }

  function onDelivered(order: CourierOrder) {
    delivered.mutate(order.name, {
      onSuccess: () => toast.success(`${shortNo(order.name)} доставлен`),
      onError: (e) => toast.error(e.message),
    });
  }

  const query = tab === "mine" ? mine : free;
  const orders = query.data ?? [];

  return (
    <Page title="Доставки" width="narrow">
      <div className="space-y-3">
        <UnderlineTabs
          label="Заказы курьера"
          value={tab}
          onChange={setTab}
          items={[
            { value: "mine", label: "Мои", count: mine.data?.length },
            { value: "free", label: "Свободные", count: free.data?.length },
          ]}
        />

        {query.isRefetchError && <WarningNote>Нет связи — показаны последние данные. Попробуем снова.</WarningNote>}
        {query.isPending ? (
          <ListSkeleton rows={2} />
        ) : query.data === undefined ? (
          <ErrorNote title="Список не загрузился">{query.error?.message}</ErrorNote>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={tab === "mine" ? PackageCheck : Truck}
            text={tab === "mine" ? "У вас нет заказов в пути" : "Свободных заказов нет"}
          />
        ) : (
          <div className="space-y-2.5">
            {orders.map((order) =>
              tab === "mine" ? (
                <MineCard
                  key={order.name}
                  order={order}
                  pending={delivered.isPending && delivered.variables === order.name}
                  onDelivered={() => onDelivered(order)}
                />
              ) : (
                <FreeCard
                  key={order.name}
                  order={order}
                  pending={take.isPending && take.variables === order.name}
                  onTake={() => onTake(order)}
                />
              ),
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function Header({ order, badge }: { order: CourierOrder; badge: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2">
      <span className="text-[15px] font-bold tabular-nums">{shortNo(order.name)}</span>
      {badge}
      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground tabular-nums">
        <Clock className="size-3.5" aria-hidden />
        {durationLabel(order.age)}
      </span>
    </header>
  );
}

function Where({ order, extra }: { order: CourierOrder; extra?: string }) {
  const details = [order.address ?? "Адрес не указан", order.zone, extra].filter(Boolean).join(" · ");
  return (
    <div>
      {order.customer_name && <div className="text-[14.5px] leading-tight font-semibold">{order.customer_name}</div>}
      <div className="text-[12.5px] leading-snug text-muted-foreground">{details}</div>
    </div>
  );
}

/** Квадратная кнопка-иконка 34 px: звонок и маршрут — второстепенные, место отдано главному действию. */
const iconButton = cn(buttonVariants({ variant: "outline" }), "size-[34px] shrink-0 p-0");

function MineCard({ order, pending, onDelivered }: { order: CourierOrder; pending: boolean; onDelivered: () => void }) {
  return (
    <article className={cn(surface, "rounded-[10px]")}>
      <div className="flex flex-col gap-2 p-3">
        <Header order={order} badge={<StatusBadge tone="progress">В пути</StatusBadge>} />
        <Where order={order} />
        <ul>
          {order.items?.map((item, i) => (
            <li key={i} className="flex items-baseline gap-2.5 py-[3px] text-sm leading-snug">
              <b className="min-w-6 tabular-nums">{item.qty}×</b>
              <span>{item.item_name}</span>
            </li>
          ))}
        </ul>
        <footer className="flex items-center gap-2">
          {order.phone && (
            <a href={telLink(order.phone)} className={iconButton} aria-label="Позвонить клиенту" title="Позвонить">
              <Phone />
            </a>
          )}
          {order.address && (
            <a href={mapLink(order.address)} target="_blank" rel="noreferrer" className={iconButton} aria-label="Маршрут" title="Маршрут">
              <MapPin />
            </a>
          )}
          <Button className={cn("h-[34px] flex-1 gap-1.5 px-3.5 text-[13px] font-medium", darkButton)} disabled={pending} onClick={onDelivered}>
            <Check /> Доставлено
          </Button>
        </footer>
      </div>
    </article>
  );
}

function FreeCard({ order, pending, onTake }: { order: CourierOrder; pending: boolean; onTake: () => void }) {
  return (
    <article className={cn(surface, "rounded-[10px]")}>
      <div className="flex flex-col gap-2 p-3">
        <Header order={order} badge={<StatusBadge tone="ok">Готов</StatusBadge>} />
        <Where order={order} extra={`${order.items_count} ${plural(order.items_count, ["позиция", "позиции", "позиций"])}`} />
        <footer className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Готов к выдаче</span>
          <Button className="ml-auto h-[34px] gap-1.5 px-3.5 text-[13px] font-medium" disabled={pending} onClick={onTake}>
            <Truck /> Взять
          </Button>
        </footer>
      </div>
    </article>
  );
}
