import { Bike, MapPin, PackageCheck, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import { Button, buttonVariants } from "../../../shared/ui/button";
import { ageLabel, plural, shortNo } from "../format";
import { EmptyState, ErrorNote, ListSkeleton, Page, StatusBadge, surface, WarningNote } from "../ui";
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
      <div role="tablist" className="mb-3 flex rounded-xl bg-muted p-1">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          Мои{mine.isSuccess ? ` · ${mine.data.length}` : ""}
        </TabButton>
        <TabButton active={tab === "free"} onClick={() => setTab("free")}>
          Свободные{free.isSuccess ? ` · ${free.data.length}` : ""}
        </TabButton>
      </div>

      {query.isRefetchError && (
        <div className="mb-3">
          <WarningNote>Нет связи — показаны последние данные. Попробуем снова.</WarningNote>
        </div>
      )}
      {query.isPending ? (
        <ListSkeleton rows={2} />
      ) : query.data === undefined ? (
        <ErrorNote title="Список не загрузился">{query.error?.message}</ErrorNote>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={tab === "mine" ? PackageCheck : Bike}
          text={tab === "mine" ? "У вас нет заказов в пути" : "Свободных заказов нет"}
        />
      ) : (
        <div className="space-y-3">
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
    </Page>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-10 flex-1 rounded-lg text-sm font-semibold transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Where({ order }: { order: CourierOrder }) {
  return (
    <div className="mt-2 text-sm">
      {order.customer_name && <div className="text-base font-semibold">{order.customer_name}</div>}
      <div className="text-muted-foreground">{order.address ?? "Адрес не указан"}</div>
      {order.zone && <div className="text-muted-foreground">Зона: {order.zone}</div>}
    </div>
  );
}

function MineCard({ order, pending, onDelivered }: { order: CourierOrder; pending: boolean; onDelivered: () => void }) {
  return (
    <div className={cn(surface, "p-4")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-bold">{shortNo(order.name)}</div>
        <StatusBadge tone="progress">В пути</StatusBadge>
      </div>
      <Where order={order} />
      <ul className="mt-2 space-y-0.5 text-sm">
        {order.items?.map((item, i) => (
          <li key={i} className="flex gap-2">
            <b className="min-w-8 tabular-nums text-muted-foreground">{item.qty}×</b>
            <span>{item.item_name}</span>
          </li>
        ))}
      </ul>
      {(order.phone || order.address) && (
        <div className="mt-3 flex gap-2">
          {order.phone && (
            <a href={telLink(order.phone)} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 flex-1")}>
              <Phone /> Позвонить
            </a>
          )}
          {order.address && (
            <a
              href={mapLink(order.address)}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 flex-1")}
            >
              <MapPin /> Карта
            </a>
          )}
        </div>
      )}
      <Button className="mt-3 h-12 w-full text-base font-semibold" disabled={pending} onClick={onDelivered}>
        Доставлено
      </Button>
    </div>
  );
}

function FreeCard({ order, pending, onTake }: { order: CourierOrder; pending: boolean; onTake: () => void }) {
  return (
    <div className={cn(surface, "p-4")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-bold">
          {shortNo(order.name)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · готов {ageLabel(order.age).replace(" назад", "")}
          </span>
        </div>
        <StatusBadge tone="ok">Готов</StatusBadge>
      </div>
      <Where order={order} />
      <div className="mt-1 text-sm text-muted-foreground">
        {order.items_count} {plural(order.items_count, ["позиция", "позиции", "позиций"])}
      </div>
      <Button className="mt-3 h-12 w-full text-base font-semibold" disabled={pending} onClick={onTake}>
        Взять заказ
      </Button>
    </div>
  );
}
