import { Menu } from "lucide-react";

import { useMe } from "../api/queries";
import { Button } from "./button";
import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
  title: string;
  onBurgerClick: () => void;
}

export function Topbar({ title, onBurgerClick }: TopbarProps) {
  const { data } = useMe();

  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b border-border bg-card px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onBurgerClick}
        aria-label="Открыть меню разделов"
      >
        <Menu />
      </Button>

      <h1 className="truncate text-lg font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {data && <span className="hidden text-sm text-muted-foreground md:inline">{data.full_name}</span>}
      </div>
    </header>
  );
}
