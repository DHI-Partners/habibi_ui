import { ChevronRight, Ellipsis, LayoutGrid, Store } from "lucide-react";
import { NavLink, Navigate, Outlet, useLocation, useParams, useSearchParams } from "react-router-dom";

import { cn } from "../../shared/lib/utils";
import { Skeleton } from "../../shared/ui/skeleton";
import { Toaster } from "../../shared/ui/sonner";
import { ThemeToggle } from "../../shared/ui/ThemeToggle";
import { useCabinetConfig } from "./api";
import { GenericList } from "./GenericList";
import { sectionIcon, TABS } from "./nav";
import { SCREENS } from "./screens";
import { useProfile } from "./settings/api";
import { useRealtime } from "./useRealtime";
import { EmptyState, ErrorNote, Page, surface } from "./ui";

export function CabinetShell() {
  const config = useCabinetConfig();
  useRealtime();
  const location = useLocation();
  const [params] = useSearchParams();
  const sections = config.data ?? [];
  // Название бизнеса — из «О компании», если раздел виден (владельцу);
  // сотруднику профиль не положен, и запрос не уходит вовсе.
  const profile = useProfile(sections.some((s) => s.key === "profile")).query.data;

  if (config.isPending) return <ShellSkeleton />;
  if (config.error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorNote title="Кабинет не загрузился">{config.error.message}</ErrorNote>
      </div>
    );
  }

  const tabs = sections.slice(0, TABS);
  // Таб-бар — только на корневых экранах. Вложенный экран (заказ, переписка,
  // раздел из «Ещё») занимает весь экран и сам ведёт назад — как в макетах.
  const [, key, sub] = location.pathname.split("/").filter(Boolean);
  const roots = new Set([...tabs.map((s) => s.key), "more"]);
  const showTabs = !key || (roots.has(key) && !sub && !params.has("chat"));
  const withMore = sections.length > TABS;

  return (
    <div className="flex min-h-dvh bg-muted/40">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" />
          </span>
          <span className="min-w-0 truncate font-semibold">{profile?.business_name || "Кабинет"}</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Разделы">
          {sections.map((s) => {
            const Icon = sectionIcon(s.icon);
            return (
              <NavLink
                key={s.key}
                to={`/c/${s.key}`}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent font-medium text-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 border-t px-3 py-3">
          <span className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground">{window.habibi.user}</span>
          <ThemeToggle />
        </div>
      </aside>

      <main className={cn("min-w-0 flex-1", showTabs && "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0")}>
        <Outlet />
      </main>

      {showTabs && (
        <nav
          aria-label="Разделы"
          className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-sm md:hidden"
          style={{ gridTemplateColumns: `repeat(${tabs.length + (withMore ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {tabs.map((s) => (
            <TabLink key={s.key} to={`/c/${s.key}`} label={s.label} icon={sectionIcon(s.icon)} />
          ))}
          {withMore && <TabLink to="/c/more" label="Ещё" icon={Ellipsis} />}
        </nav>
      )}
      <Toaster position="top-center" />
    </div>
  );
}

function TabLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Ellipsis }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex min-w-0 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors",
          isActive ? "font-semibold text-primary" : "text-muted-foreground",
        )
      }
    >
      <Icon className="size-[22px]" />
      <span className="w-full truncate text-center">{label}</span>
    </NavLink>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-muted/40">
      <div className="hidden w-60 shrink-0 space-y-2 border-r bg-sidebar p-4 md:block">
        <Skeleton className="mb-6 h-8 w-32" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

export function CabinetIndex() {
  const config = useCabinetConfig();
  // Пустой пресет — не ошибка загрузки (её уже показал бы CabinetShell), а
  // конфигурация без разделов: молчаливый null оставлял бы пустой экран без
  // объяснения, почему кабинет открылся, а показать в нём нечего.
  if (!config.data?.length) {
    return (
      <Page title="Кабинет">
        <EmptyState icon={LayoutGrid} text="Разделы кабинета не настроены — обратитесь к администратору" />
      </Page>
    );
  }
  return <Navigate to={`/c/${config.data[0].key}`} replace />;
}

export function MorePage() {
  const config = useCabinetConfig();
  const rest = config.data?.slice(TABS) ?? [];
  return (
    <Page title="Ещё" width="narrow">
      <div className="space-y-6">
        {rest.length > 0 && (
          <ul className={cn(surface, "divide-y overflow-hidden")}>
            {rest.map((s) => {
              const Icon = sectionIcon(s.icon);
              return (
                <li key={s.key}>
                  <NavLink to={`/c/${s.key}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="flex-1 font-medium">{s.label}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
        <div className={cn(surface, "flex items-center gap-3 px-4 py-2")}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Тема оформления</div>
            <div className="truncate text-xs text-muted-foreground">{window.habibi.user}</div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </Page>
  );
}

export function SectionRoute() {
  const { key = "" } = useParams<{ key: string }>();
  const config = useCabinetConfig();
  const section = config.data?.find((s) => s.key === key);
  if (!section) {
    return (
      <Page title="Раздел недоступен" back="/c">
        <EmptyState icon={LayoutGrid} text="Этого раздела нет или у вас нет к нему доступа" />
      </Page>
    );
  }
  if (section.kind === "custom") {
    const Screen = SCREENS[section.screen];
    return Screen ? (
      <Screen section={section} />
    ) : (
      <Page title={section.label} back="/c">
        <EmptyState icon={LayoutGrid} text="Экран не найден — возможно, кабинет нужно обновить" />
      </Page>
    );
  }
  return <GenericList section={section} />;
}
