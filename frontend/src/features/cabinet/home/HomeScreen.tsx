import { ChevronRight, MessageCircle, Send, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../../shared/lib/utils";
import { Skeleton } from "../../../shared/ui/skeleton";
import { useCabinetConfig, useSectionList } from "../api";
import { useChatList } from "../chats/api";
import { dateLabel, fulfilmentLabel, listStamp, money, plural, shortNo } from "../format";
import { useHours, useProfile, useTelegramStatus } from "../settings/api";
import { openStatus } from "../settings/hours";
import { InitialAvatar, SectionTitle, StatusBadge, surface, WarningNote } from "../ui";

const RECENT = 5;

export function HomeScreen() {
  const sections = useCabinetConfig().data ?? [];
  const has = (key: string) => sections.some((s) => s.key === key);
  // Раздел orders может быть недоступен (фича выключена или нет прав) —
  // тогда нет ни запроса, ни плиток заказов. Настройки (режим, профиль,
  // Telegram) видит только владелец: сотруднику эти запросы не уходят.
  const orders = useSectionList("orders", [["docstatus", "=", 0]], has("orders"));
  const chats = useChatList(has("chats"));
  const telegram = useTelegramStatus(has("telegram")).data;
  const hours = useHours(has("hours")).query.data;
  const profile = useProfile(has("profile")).query.data;

  // last_at — наивная локальная дата-время сайта, а не UTC: toISOString() тут
  // сдвинул бы «сегодня» на UTC-сутки и после местной полуночи занижал бы счёт.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayChats = chats.data?.filter((c) => c.last_at.startsWith(today)) ?? [];
  const paused = chats.data?.filter((c) => c.paused) ?? [];
  const status = hours && openStatus(hours.schedule, hours.exceptions, hours.time_zone);
  const newOrders = orders.data?.rows ?? [];

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-background md:border-0 md:bg-transparent">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 pt-5 pb-4 md:px-8 md:pt-8">
          <div className="min-w-0 flex-1">
            {profile?.business_name && (
              <div className="truncate text-xs text-muted-foreground md:text-sm">{profile.business_name}</div>
            )}
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Сегодня</h1>
          </div>
          {status && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                status.open
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", status.open ? "bg-emerald-500" : "bg-muted-foreground")} />
              {status.text}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 pt-4 pb-6 md:px-8">
        {telegram && telegram.state !== "connected" && (
          <Link to="/c/telegram" className="block">
            <WarningNote>
              <span className="flex items-center gap-2">
                <span className="flex-1">Подключите Telegram — без него бот не получит сообщений клиентов.</span>
                <ChevronRight className="size-4 shrink-0" />
              </span>
            </WarningNote>
          </Link>
        )}

        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {has("orders") && (
            <Stat
              to="/c/orders"
              value={orders.data ? newOrders.length : undefined}
              label={plural(newOrders.length, ["новый заказ", "новых заказа", "новых заказов"])}
              accent="primary"
            />
          )}
          {has("chats") && (
            <>
              <Stat
                to="/c/chats"
                value={chats.data ? todayChats.length : undefined}
                label={`${plural(todayChats.length, ["переписка", "переписки", "переписок"])} сегодня`}
              />
              <Stat
                to="/c/chats"
                value={chats.data ? paused.length : undefined}
                label={plural(paused.length, ["ждёт человека", "ждут человека", "ждут человека"])}
                accent={paused.length ? "warning" : undefined}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          {has("orders") && (
            <section className="min-w-0 space-y-2">
              <SectionTitle action={<AllLink to="/c/orders" />}>Новые заказы</SectionTitle>
              {orders.isPending ? (
                <RowsSkeleton />
              ) : newOrders.length === 0 ? (
                <Quiet icon={<ShoppingBag className="size-4" />}>Новых заказов нет</Quiet>
              ) : (
                <div className="space-y-2">
                  {newOrders.slice(0, RECENT).map((row) => (
                    <Link
                      key={row.name}
                      to={`/c/orders/${encodeURIComponent(row.name)}`}
                      className={cn(surface, "flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/50")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold">
                          {shortNo(row.name)}
                          {row.customer_name ? ` · ${String(row.customer_name)}` : ""}
                        </div>
                        <div className="truncate text-[13px] text-muted-foreground">
                          {[fulfilmentLabel(row.custom_fulfilment_type), dateLabel(row.transaction_date)]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span className="text-[15px] font-semibold tabular-nums">{money(row.grand_total)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {has("chats") && (
            <section className="min-w-0 space-y-2">
              <SectionTitle action={<AllLink to="/c/chats" />}>Переписки</SectionTitle>
              {chats.isPending ? (
                <RowsSkeleton />
              ) : !chats.data?.length ? (
                <Quiet icon={<MessageCircle className="size-4" />}>Переписок пока нет</Quiet>
              ) : (
                <div className={cn(surface, "divide-y overflow-hidden")}>
                  {chats.data.slice(0, RECENT).map((c) => (
                    <Link
                      key={c.chat}
                      to={`/c/chats?chat=${encodeURIComponent(c.chat)}`}
                      className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/50"
                    >
                      <InitialAvatar name={c.title} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{c.title}</div>
                        <div className="truncate text-[13px] text-muted-foreground">{c.preview}</div>
                      </div>
                      {c.paused ? (
                        <StatusBadge tone="new" className="h-5 px-2 text-[11px]">
                          ждёт вас
                        </StatusBadge>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">{listStamp(c.last_at)}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {!has("orders") && !has("chats") && (
          <Quiet icon={<Send className="size-4" />}>Здесь появятся заказы и переписки с клиентами</Quiet>
        )}
      </div>
    </div>
  );
}

function AllLink({ to }: { to: string }) {
  return (
    <Link to={to} className="text-sm font-medium text-primary hover:underline">
      Все
    </Link>
  );
}

function Stat(props: { to: string; value: number | undefined; label: string; accent?: "primary" | "warning" }) {
  const warning = props.accent === "warning";
  return (
    <Link
      to={props.to}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border p-3 transition-colors md:p-4",
        warning
          ? "border-amber-200 bg-amber-50 hover:bg-amber-100/70 dark:border-amber-400/25 dark:bg-amber-400/10 dark:hover:bg-amber-400/15"
          : "bg-card hover:bg-muted/50",
      )}
    >
      {props.value === undefined ? (
        <Skeleton className="h-8 w-8" />
      ) : (
        <span
          className={cn(
            "text-[26px] leading-8 font-bold tabular-nums",
            props.accent === "primary" && "text-primary",
            warning && "text-amber-800 dark:text-amber-300",
          )}
        >
          {props.value}
        </span>
      )}
      <span className={cn("text-xs leading-snug text-muted-foreground", warning && "text-amber-800 dark:text-amber-300")}>
        {props.label}
      </span>
    </Link>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}

function Quiet({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className={cn(surface, "flex items-center gap-3 border-dashed px-4 py-5 text-sm text-muted-foreground")}>
      <span className="flex size-8 items-center justify-center rounded-full bg-muted">{icon}</span>
      {children}
    </div>
  );
}
