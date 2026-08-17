import { LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { useSidebar } from "../api/queries";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Возврат из пространства на лаунчер модулей (маршрут "/"). */
function AsideHeader({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      title="Все модули"
      className={cn(
        "flex h-14 flex-none items-center gap-2 border-b border-border px-4 font-semibold text-foreground no-underline transition-colors hover:bg-accent",
        collapsed && "justify-center px-0",
      )}
    >
      <LayoutGrid className="size-5 flex-none text-primary" aria-hidden="true" />
      {!collapsed && <span className="truncate">Все модули</span>}
    </Link>
  );
}

const COLLAPSE_STORAGE_KEY = "habibi:sidebar-collapsed";

/** Имя активного пространства из пути. Базовый префикс /ui снят basename'ом роутера. */
function useActiveWorkspaceName(): string {
  const location = useLocation();
  const match = /^\/w\/([^/]+)/.exec(location.pathname);
  return match ? decodeURIComponent(match[1]) : "Home";
}

export function AppShell({ children }: { children: ReactNode }) {
  const activeName = useActiveWorkspaceName();
  const { data: workspaces } = useSidebar();

  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Переход по клиентскому маршруту закрывает выдвижную мобильную панель.
  useEffect(() => {
    setMobileOpen(false);
  }, [activeName]);

  const title = workspaces?.find((item) => item.name === activeName)?.label ?? activeName;

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside
        className={cn(
          "hidden flex-none flex-col border-r border-border bg-card transition-[width] duration-150 md:flex",
          collapsed ? "md:w-18" : "md:w-65",
        )}
      >
        <AsideHeader collapsed={collapsed} />
        <Sidebar collapsed={collapsed} activeName={activeName} className="flex-1" />
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-65 p-0">
          <SheetTitle className="sr-only">Рабочие пространства</SheetTitle>
          <AsideHeader collapsed={false} onNavigate={() => setMobileOpen(false)} />
          <Sidebar collapsed={false} activeName={activeName} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onBurgerClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[var(--content-max-width)] px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
