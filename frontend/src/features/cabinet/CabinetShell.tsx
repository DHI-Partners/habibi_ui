import { NavLink, Navigate, Outlet, useParams } from "react-router-dom";

import { Skeleton } from "../../shared/ui/skeleton";
import { useCabinetConfig } from "./api";
import { GenericList } from "./GenericList";
import { SCREENS } from "./screens";
import { useRealtime } from "./useRealtime";

// Таб-бар телефона: первые разделы по порядку, остальное — в «Ещё».
// Какие разделы первые, решает пресет порядком строк, а не этот код.
const TABS = 3;

export function CabinetShell() {
  const config = useCabinetConfig();
  useRealtime();

  if (config.isPending) return <Skeleton className="m-4 h-40" />;
  if (config.error) return <p className="p-4 text-destructive">{config.error.message}</p>;

  const sections = config.data ?? [];
  const tabs = sections.slice(0, TABS);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <nav className="hidden w-56 shrink-0 border-r border-border p-3 md:block">
        {sections.map((s) => (
          <NavLink
            key={s.key}
            to={`/c/${s.key}`}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-accent font-medium" : "hover:bg-accent/60"}`
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
      <main className="min-w-0 flex-1 p-4 pb-20 md:pb-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-background md:hidden">
        {tabs.map((s) => (
          <NavLink key={s.key} to={`/c/${s.key}`} className="flex-1 py-3 text-center text-xs">
            {s.label}
          </NavLink>
        ))}
        {sections.length > TABS && (
          <NavLink to="/c/more" className="flex-1 py-3 text-center text-xs">
            Ещё
          </NavLink>
        )}
      </nav>
    </div>
  );
}

export function CabinetIndex() {
  const config = useCabinetConfig();
  if (!config.data?.length) return null;
  return <Navigate to={`/c/${config.data[0].key}`} replace />;
}

export function MorePage() {
  const config = useCabinetConfig();
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {config.data?.slice(TABS).map((s) => (
        <li key={s.key}>
          <NavLink to={`/c/${s.key}`} className="block px-4 py-3">
            {s.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function SectionRoute() {
  const { key = "" } = useParams<{ key: string }>();
  const config = useCabinetConfig();
  const section = config.data?.find((s) => s.key === key);
  if (!section) return <p className="text-muted-foreground">Раздел недоступен</p>;
  if (section.kind === "custom") {
    const Screen = SCREENS[section.screen];
    return Screen ? <Screen section={section} /> : <p className="text-muted-foreground">Экран не найден</p>;
  }
  return <GenericList section={section} />;
}
