import { ChefHat, Check, Clock, TriangleAlert, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import { Button } from "../../../shared/ui/button";
import { optionLabel } from "../FieldInput";
import { durationLabel, shortNo } from "../format";
import { fulfilmentIcon } from "../icons";
import { darkButton, EmptyState, ErrorNote, ListSkeleton, Page, surface, UnderlineTabs, WarningNote } from "../ui";
import { type KitchenOrder, useKitchenQueue, useMarkReady } from "./api";
import { BORDER, LATE_MIN, TIMER, urgency, WARN_MIN } from "./timing";
import { useChime } from "./useChime";

const FRESH_MS = 8000;

type Kind = "all" | "Delivery" | "Pickup";

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

/** Сводка очереди одной строкой: сколько в работе, сколько ждёт дольше нормы и дольше предела. */
function Summary({ total, warn, late }: { total: number; warn: number; late: number }) {
  const cell = "flex flex-1 items-baseline justify-between gap-2 px-3 py-2 whitespace-nowrap";
  return (
    <div className={cn(surface, "flex divide-x rounded-[10px]")}>
      <div className={cell}>
        <span className="text-xs text-muted-foreground">В работе</span>
        <b className="text-base tabular-nums">{total}</b>
      </div>
      <div className={cell}>
        <span className="text-xs text-muted-foreground">
          {WARN_MIN}–{LATE_MIN} мин
        </span>
        <b className={cn("text-base tabular-nums", warn > 0 && "text-amber-700 dark:text-amber-400")}>{warn}</b>
      </div>
      <div className={cell}>
        <span className="text-xs text-muted-foreground">{LATE_MIN}+ мин</span>
        <b className={cn("text-base tabular-nums", late > 0 && "text-red-700 dark:text-red-400")}>{late}</b>
      </div>
    </div>
  );
}

export function KitchenScreen() {
  const queue = useKitchenQueue();
  const ready = useMarkReady();
  const chime = useChime();
  const [kind, setKind] = useState<Kind>("all");
  const all = queue.data ?? [];
  const fresh = useFresh(
    all.map((o) => o.name),
    queue.isSuccess,
    chime.play,
  );
  const shown = kind === "all" ? all : all.filter((o) => o.fulfilment === kind);
  const count = (k: Kind) => (k === "all" ? all.length : all.filter((o) => o.fulfilment === k).length);

  return (
    <Page
      title="Кухня"
      subtitle="Очередь · обновляется сама"
      width="wide"
      actions={
        <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[13px] font-medium" onClick={chime.toggle} aria-pressed={chime.enabled}>
          {chime.enabled ? <Volume2 /> : <VolumeX />}
          Звук
        </Button>
      }
    >
      <div className="space-y-3">
        <UnderlineTabs
          label="Тип заказа"
          value={kind}
          onChange={setKind}
          items={[
            { value: "all", label: "Все", count: count("all") },
            { value: "Delivery", label: "Доставка", count: count("Delivery") },
            { value: "Pickup", label: "Самовывоз", count: count("Pickup") },
          ]}
        />
        {/* Сбой фонового опроса не прячет очередь: на экран смотрят, не трогая, и
            устаревший список лучше пустой плашки ошибки */}
        {queue.isRefetchError && <WarningNote>Нет связи — показаны последние данные. Попробуем снова.</WarningNote>}
        {queue.isPending ? (
          <ListSkeleton rows={3} />
        ) : queue.data === undefined ? (
          <ErrorNote title="Очередь не загрузилась">{queue.error?.message}</ErrorNote>
        ) : (
          <>
            <Summary
              total={all.length}
              warn={all.filter((o) => urgency(o.age) === "warn").length}
              late={all.filter((o) => urgency(o.age) === "bad").length}
            />
            {shown.length === 0 ? (
              <EmptyState icon={ChefHat} text="Заказов на кухне нет" />
            ) : (
              <div className="grid items-start gap-3.5 pt-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {shown.map((order) => (
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
          </>
        )}
      </div>
    </Page>
  );
}

const pieces = (order: KitchenOrder) => order.items.reduce((sum, i) => sum + i.qty, 0);

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
  const level = urgency(order.age);
  const Kind = fulfilmentIcon(order.fulfilment);
  return (
    <article className={cn(surface, "rounded-[10px] transition-shadow", BORDER[level], isNew && "ring-2 ring-primary")}>
      <div className="flex flex-col gap-2 p-3">
        <header className="flex items-center gap-2">
          <span className="text-[15px] font-bold tabular-nums">{shortNo(order.name)}</span>
          {order.fulfilment && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {Kind && <Kind className="size-3.5" aria-hidden />}
              {optionLabel(order.fulfilment)}
            </span>
          )}
          <span className={cn("ml-auto inline-flex items-center gap-1 text-xs font-semibold tabular-nums", TIMER[level])}>
            <Clock className="size-3.5" aria-hidden />
            {durationLabel(order.age)}
          </span>
        </header>
        <ul>
          {order.items.map((item, i) => (
            <li key={i} className="flex items-baseline gap-2.5 py-[3px] text-sm leading-snug">
              <b className="min-w-6 tabular-nums">{item.qty}×</b>
              <span>{item.item_name}</span>
            </li>
          ))}
          {order.items.length === 0 && <li className="text-sm text-muted-foreground">Состав не указан</li>}
        </ul>
        {order.notes && (
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[12.5px] leading-snug font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{order.notes}</span>
          </div>
        )}
        <footer className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{pieces(order)} шт.</span>
          <Button className={cn("ml-auto h-[34px] gap-1.5 px-3.5 text-[13px] font-medium", darkButton)} disabled={pending} onClick={onReady}>
            <Check /> Готово
          </Button>
        </footer>
      </div>
    </article>
  );
}
