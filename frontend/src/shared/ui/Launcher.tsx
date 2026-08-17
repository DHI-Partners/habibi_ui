import { ArrowLeft, ArrowUpRight, Bell } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useMe, useModules, useSidebarGroup } from "../api/queries";
import { desktopVisual } from "../lib/moduleVisuals";
import type { DesktopItem, DesktopSection, SidebarLink } from "../types/api";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { ThemeToggle } from "./ThemeToggle";

function greeting(hour: number): string {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

/** Русское склонение: 1 раздел, 2 раздела, 5 разделов. */
function plural(count: number, one: string, few: string, many: string): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return `${count} ${many}`;
  switch (count % 10) {
    case 1:
      return `${count} ${one}`;
    case 2:
    case 3:
    case 4:
      return `${count} ${few}`;
    default:
      return `${count} ${many}`;
  }
}

function itemsWord(count: number): string {
  return plural(count, "раздел", "раздела", "разделов");
}

function docsWord(count: number): string {
  return plural(count, "документ", "документа", "документов");
}

/**
 * Куда ведёт плитка: есть свой раздел — открываем его, иначе группа
 * раскрывается отдельной страницей. Если нет ни того ни другого, плитка
 * никуда не уводит — лучше, чем ссылка в пустоту.
 */
function href(entry: DesktopSection | DesktopItem): string {
  // Вложенные важнее ссылки: у группы вроде Framework есть и то и другое,
  // но пользователь ждёт раскрытия, а не прыжка в один из разделов.
  if ("items" in entry && entry.items.length > 0) return `/s/${encodeURIComponent(entry.key)}`;
  if (entry.sidebar) return `/g/${encodeURIComponent(entry.sidebar)}`;
  return "";
}

/** Адрес документа или отчёта в Desk: своих списков у нас пока нет. */
function deskHref(link: SidebarLink): string {
  const slug = link.link_to.toLowerCase().replaceAll(" ", "-");
  if (link.link_type === "Report") return `/app/query-report/${encodeURIComponent(link.link_to)}`;
  if (link.link_type === "Dashboard") return `/app/dashboard-view/${encodeURIComponent(link.link_to)}`;
  return `/app/${slug}`;
}

function Tile({ entry }: { entry: DesktopSection | DesktopItem }) {
  const { icon: Glyph, hueVar } = desktopVisual(entry.icon, entry.key);
  const nested = "items" in entry ? entry.items.length : 0;
  // Названия вложенных информативнее счётчика: видно, что внутри, ещё до клика.
  const preview =
    "items" in entry
      ? entry.items
          .slice(0, 3)
          .map((item) => item.label)
          .join(" · ")
      : "";
  // У группы показываем, что внутри; у конечной плитки — сколько там документов.
  const caption = nested > 0 ? preview : entry.count > 0 ? docsWord(entry.count) : "";
  const target = href(entry);

  const body = (
    <>
      <ArrowUpRight
        className="absolute top-5 right-5 size-4 text-[var(--hue)] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
        aria-hidden="true"
      />
      <span className="mb-4 grid size-11 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--hue)_22%,transparent),color-mix(in_oklab,var(--hue)_10%,transparent))] text-[var(--hue)] ring-1 ring-[color-mix(in_oklab,var(--hue)_18%,transparent)] transition-transform duration-200 group-hover:scale-105">
        {entry.logo ? (
          <img src={entry.logo} alt="" className="size-[22px] object-contain" />
        ) : (
          <Glyph className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <span className="block text-[15px] font-semibold tracking-[-0.01em]">{entry.label}</span>
      <span className="mt-1 block truncate text-[13px] text-muted-foreground">{caption}</span>
    </>
  );

  const shell =
    "group relative block overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground no-underline transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-[3px] hover:border-[color-mix(in_oklab,var(--hue)_38%,var(--border))] hover:shadow-[0_12px_32px_-16px_color-mix(in_oklab,var(--hue)_65%,transparent)]";

  if (!target) {
    return (
      <div className={shell} style={{ ["--hue" as string]: `var(${hueVar})` }}>
        {body}
      </div>
    );
  }

  return (
    <Link to={target} className={shell} style={{ ["--hue" as string]: `var(${hueVar})` }}>
      {body}
    </Link>
  );
}

function Grid({ entries }: { entries: (DesktopSection | DesktopItem)[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-3">
      {entries.map((entry) => (
        <Tile key={entry.key} entry={entry} />
      ))}
    </div>
  );
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-3" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((key) => (
        <div key={key} className="rounded-2xl border border-border bg-card p-4 pb-[18px]">
          <Skeleton className="mb-3.5 size-[38px] rounded-[11px]" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="mt-2 h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

function Header({ fullName, user }: { fullName: string; user: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 flex-none items-center gap-6 border-b border-border bg-card/80 px-8 backdrop-blur-md">
      <Link
        to="/"
        className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-foreground no-underline"
      >
        <span
          className="grid size-[30px] place-items-center rounded-[10px] text-[15px] leading-none font-bold text-white shadow-sm"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--module-accounts), var(--module-integrations))",
          }}
          aria-hidden="true"
        >
          H
        </span>
        <span className="text-[15px]">Habibi</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <a
          href="/app/notification-log"
          title="Уведомления"
          className="grid size-[34px] place-items-center rounded-[9px] text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
        </a>
        <ThemeToggle />
        <a
          href={`/app/user/${encodeURIComponent(user)}`}
          title={fullName || "Профиль"}
          className="grid size-[34px] place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary no-underline transition-colors hover:bg-primary/20"
        >
          {fullName.charAt(0).toUpperCase() || "?"}
        </a>
      </div>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Header fullName={me?.full_name ?? ""} user={me?.user ?? ""} />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-8 pt-12 pb-18">{children}</main>
    </div>
  );
}

function Message({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function Launcher() {
  const { data: me } = useMe();
  const { data: sections, isPending, error, refetch, isFetching } = useModules();
  const firstName = me?.full_name.split(" ")[0] ?? "";

  return (
    <Shell>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
        {greeting(new Date().getHours())}
        {firstName && `, ${firstName}`}
      </h1>
      <p className="mt-1 mb-9 text-muted-foreground">Выберите раздел, чтобы продолжить работу</p>

      {isPending && <TilesSkeleton />}

      {error && !isPending && (
        <Message
          title="Не удалось загрузить разделы"
          text={error.message}
          action={
            <Button variant="outline" className="mt-2" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Повторяем…" : "Повторить"}
            </Button>
          }
        />
      )}

      {!isPending && !error && (sections?.length ?? 0) === 0 && (
        <Message
          title="Нет доступных разделов"
          text="Обратитесь к администратору, чтобы получить доступ."
        />
      )}

      {!isPending && !error && sections && sections.length > 0 && <Grid entries={sections} />}
    </Shell>
  );
}

/** Вложенный уровень: разделы одной группы, например «Бухгалтерия». */
export function SectionPage() {
  const { key } = useParams<{ key: string }>();
  const { data: me } = useMe();
  const { data: sections, isPending } = useModules();
  const section = sections?.find((item) => item.key === key);

  return (
    <Shell>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Все разделы
      </Link>

      {isPending && <TilesSkeleton />}

      {!isPending && !section && <Message title="Раздел не найден" text="Возможно, у вас нет к нему доступа." />}

      {section && (
        <>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{section.label}</h1>
          <p className="mt-1 mb-9 text-muted-foreground">{itemsWord(section.items.length)}</p>
          <Grid entries={section.items} />
        </>
      )}
    </Shell>
  );
}

/** Содержимое раздела: ссылки на документы и отчёты. */
export function GroupPage() {
  const { name } = useParams<{ name: string }>();
  const { data: me } = useMe();
  const { data: group, isPending, error } = useSidebarGroup(name ?? "");

  return (
    <Shell>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Все разделы
      </Link>

      {isPending && <TilesSkeleton />}
      {error && !isPending && <Message title="Не удалось открыть раздел" text={error.message} />}

      {group && (
        <>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{group.label}</h1>
          <p className="mt-1 mb-9 text-muted-foreground">{itemsWord(group.links.length)}</p>

          {group.links.length === 0 ? (
            <Message title="Раздел пуст" text="Здесь пока нет доступных вам документов." />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-3">
              {group.links.map((link) => (
                <a
                  key={`${link.link_type}:${link.link_to}`}
                  href={deskHref(link)}
                  className="group relative block rounded-2xl border border-border bg-card p-4 text-card-foreground no-underline transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <ArrowUpRight
                    className="absolute top-4 right-4 size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  <span className="block text-[15px] font-medium">{link.label}</span>
                  <span className="mt-1 block text-[13px] text-muted-foreground">{link.link_type}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
