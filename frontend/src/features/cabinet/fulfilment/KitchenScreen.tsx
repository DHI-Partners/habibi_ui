import { Bell, BellOff, ChefHat } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import { Button } from "../../../shared/ui/button";
import { ageLabel, shortNo } from "../format";
import { EmptyState, ErrorNote, ListSkeleton, Page, StatusBadge, surface, WarningNote } from "../ui";
import { type KitchenOrder, useKitchenQueue, useMarkReady } from "./api";
import { useChime } from "./useChime";

const FRESH_MS = 8000;

/**
 * Имена заказов, появившихся в очереди после первой загрузки: их подсвечиваем
 * на несколько секунд, вибрируем (где браузер умеет) и играем сигнал. Первая
 * загрузка только запоминает очередь — иначе каждый вход «звонил» бы за все
 * заказы, что уже готовятся.
 */
function useFresh(names: string[], loaded: boolean, onNew: () => void) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null) {
      seen.current = new Set(names);
      return;
    }
    const known = seen.current;
    const added = names.filter((n) => !known.has(n));
    names.forEach((n) => known.add(n));
    if (!added.length) return;
    navigator.vibrate?.(200);
    onNew();
    setFresh((prev) => new Set([...prev, ...added]));
    // Таймер не снимаем в cleanup: следующий опрос не должен гасить
    // подсветку раньше срока; setState после размонтирования безвреден.
    setTimeout(() => setFresh((prev) => new Set([...prev].filter((n) => !added.includes(n)))), FRESH_MS);
    // onNew меняется с флагом звука; новые имена — единственный повод сработать
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names.join("|"), loaded]);

  return fresh;
}

export function KitchenScreen() {
  const queue = useKitchenQueue();
  const ready = useMarkReady();
  const chime = useChime();
  const orders = queue.data ?? [];
  const fresh = useFresh(
    orders.map((o) => o.name),
    queue.isSuccess,
    chime.play,
  );

  return (
    <Page
      title="Кухня"
      subtitle={queue.isSuccess ? `В работе: ${orders.length}` : undefined}
      width="wide"
      actions={
        <Button variant="outline" size="lg" onClick={chime.toggle} aria-pressed={chime.enabled}>
          {chime.enabled ? <Bell /> : <BellOff />}
          Звук
        </Button>
      }
    >
      {/* Сбой фонового опроса не прячет очередь: на экран смотрят, не трогая, и
          устаревший список лучше пустой плашки ошибки */}
      {queue.isRefetchError && (
        <div className="mb-3">
          <WarningNote>Нет связи — показаны последние данные. Попробуем снова.</WarningNote>
        </div>
      )}
      {queue.isPending ? (
        <ListSkeleton rows={3} />
      ) : queue.data === undefined ? (
        <ErrorNote title="Очередь не загрузилась">{queue.error?.message}</ErrorNote>
      ) : orders.length === 0 ? (
        <EmptyState icon={ChefHat} text="Заказов на кухне нет" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <KitchenCard
              key={order.name}
              order={order}
              isNew={fresh.has(order.name)}
              pending={ready.isPending && ready.variables === order.name}
              onReady={() =>
                ready.mutate(order.name, {
                  onSuccess: () => toast.success(`${shortNo(order.name)} готов`),
                  onError: (e) => toast.error(e.message),
                })
              }
            />
          ))}
        </div>
      )}
    </Page>
  );
}

function KitchenCard({
  order,
  isNew,
  pending,
  onReady,
}: {
  order: KitchenOrder;
  isNew: boolean;
  pending: boolean;
  onReady: () => void;
}) {
  return (
    <div className={cn(surface, "p-4 transition-shadow", isNew && "ring-2 ring-primary")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-bold">
          {shortNo(order.name)}{" "}
          <span className="text-sm font-normal text-muted-foreground">· {ageLabel(order.age)}</span>
        </div>
        <StatusBadge tone="progress">Готовится</StatusBadge>
      </div>
      <ul className="mt-3 space-y-1">
        {order.items.map((item, i) => (
          <li key={i} className="flex gap-2 text-base">
            <b className="min-w-8 text-primary tabular-nums">{item.qty}×</b>
            <span>{item.item_name}</span>
          </li>
        ))}
        {order.items.length === 0 && <li className="text-sm text-muted-foreground">Состав не указан</li>}
      </ul>
      {order.notes && (
        <div className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
          ⚠ {order.notes}
        </div>
      )}
      <Button className="mt-4 h-12 w-full text-base font-semibold" disabled={pending} onClick={onReady}>
        Готово
      </Button>
    </div>
  );
}
