import { Link } from "react-router-dom";

import { useSectionList } from "../api";
import { useChatList } from "../chats/api";
import { useTelegramStatus } from "../settings/api";

export function HomeScreen() {
  // Раздел orders может быть недоступен (фича выключена или нет прав) —
  // useSectionList в этом случае просто не получит данных (query.error), а
  // не бросит исключение при рендере: карточка ниже покажет «—» и страница
  // отрисуется целиком.
  const orders = useSectionList("orders", [["docstatus", "=", 0]]);
  const chats = useChatList();
  const telegram = useTelegramStatus().data;
  // last_at — наивная локальная дата-время сайта, а не UTC: toISOString() тут
  // сдвинул бы «сегодня» на UTC-сутки и после местной полуночи занижал бы счёт.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayChats = chats.data?.filter((c) => c.last_at.startsWith(today)) ?? [];
  const paused = chats.data?.filter((c) => c.paused) ?? [];

  return (
    <section className="space-y-4">
      {telegram && telegram.state !== "connected" && (
        <Link to="/c/telegram" className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Подключите Telegram — без него бот не получит сообщений клиентов.
        </Link>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card to="/c/orders" label="Новые заказы" value={orders.data?.rows.length} />
        <Card to="/c/chats" label="Переписки сегодня" value={todayChats.length} />
        <Card to="/c/chats" label="Ждут человека" value={paused.length} />
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {chats.data?.slice(0, 5).map((c) => (
          <li key={c.chat} className="px-4 py-3">
            <div className="font-medium">{c.title}</div>
            <div className="truncate text-sm text-muted-foreground">{c.preview}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({ to, label, value }: { to: string; label: string; value: number | undefined }) {
  return (
    <Link to={to} className="rounded-2xl border border-border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold">{value ?? "—"}</div>
    </Link>
  );
}
