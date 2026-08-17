import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { applyTheme, getActiveTheme, type Theme } from "../lib/theme";
import { Button } from "./button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getActiveTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
