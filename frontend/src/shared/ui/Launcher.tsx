import { LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";

import { useMe, useSidebar } from "../api/queries";
import type { WorkspaceRef } from "../types/api";
import { Button } from "./button";
import { Icon } from "./Icon";
import { Skeleton } from "./skeleton";
import { ThemeToggle } from "./ThemeToggle";

function workspaceHref(name: string): string {
  return `/w/${encodeURIComponent(name)}`;
}

function LauncherTile({ workspace }: { workspace: WorkspaceRef }) {
  return (
    <Link
      to={workspaceHref(workspace.name)}
      className="flex w-28 flex-col items-center gap-2 rounded-xl p-3 text-center text-foreground no-underline transition-transform duration-150 hover:scale-105 hover:bg-accent"
    >
      <span className="flex size-16 flex-none items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Icon name={workspace.icon} label={workspace.label} className="size-7" />
      </span>
      <span className="line-clamp-2 text-sm font-medium">{workspace.label}</span>
    </Link>
  );
}

function LauncherSkeleton() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(var(--launcher-tile-min),1fr))] justify-items-center gap-x-4 gap-y-8"
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5, 6].map((key) => (
        <div key={key} className="flex w-28 flex-col items-center gap-2 p-3">
          <Skeleton className="size-16 rounded-2xl" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function Launcher() {
  const { data: me } = useMe();
  const { data: workspaces, isPending, error, refetch, isFetching } = useSidebar();
  // Лаунчер — верхний уровень модулей; вложенные страницы пространства видны
  // внутри него самого, через боковое меню (см. AppShell/Sidebar).
  const roots = workspaces?.filter((item) => item.parent === "") ?? [];

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-14 flex-none items-center gap-3 border-b border-border bg-card px-4 md:px-6">
        <span className="flex items-center gap-2 font-semibold">
          <LayoutGrid className="size-5 text-primary" aria-hidden="true" />
          Habibi
        </span>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {me && <span className="hidden text-sm text-muted-foreground md:inline">{me.full_name}</span>}
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-12 md:px-6">
        <div className="w-full max-w-[var(--content-max-width)]">
          {isPending && <LauncherSkeleton />}

          {error && !isPending && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-lg font-semibold">Не удалось загрузить модули</p>
              <p className="text-muted-foreground">{error.message}</p>
              <Button variant="outline" className="mt-2" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? "Повторяем…" : "Повторить"}
              </Button>
            </div>
          )}

          {!isPending && !error && roots.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-lg font-semibold">Нет доступных модулей</p>
              <p className="text-muted-foreground">Обратитесь к администратору, чтобы получить доступ.</p>
            </div>
          )}

          {!isPending && !error && roots.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--launcher-tile-min),1fr))] justify-items-center gap-x-4 gap-y-8">
              {roots.map((workspace) => (
                <LauncherTile key={workspace.name} workspace={workspace} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
