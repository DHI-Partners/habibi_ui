import { ChevronLeft, type LucideIcon, TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../../shared/ui/alert";
import { Avatar, AvatarFallback } from "../../shared/ui/avatar";
import { Badge } from "../../shared/ui/badge";
import { buttonVariants } from "../../shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../shared/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../shared/ui/sheet";
import { Skeleton } from "../../shared/ui/skeleton";
import { initial, type Tone } from "./format";

// Общие кирпичи экранов кабинета. Цвета — только токены темы; статусные
// оттенки (жёлтый «новый», зелёный «принят», красный «отклонён») — классами
// палитры Tailwind с dark:-вариантом, других захардкоженных цветов нет.

/** Поверхность карточки списка: фон карточки поверх приглушённого фона страницы. */
export const surface = "rounded-xl border bg-card text-card-foreground";

const DESKTOP = "(min-width: 768px)";

/** Ширина ≥ md: там, где телефону нужна шторка снизу, десктопу — диалог. */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

type PageProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Куда ведёт «назад». Нет — кнопки нет (корневой раздел таб-бара). */
  back?: string | null;
  /** Кнопка «назад» только на телефоне: на десктопе раздел и так в сайдбаре. */
  backMobileOnly?: boolean;
  actions?: ReactNode;
  /** Прилипает к низу экрана на телефоне; на десктопе — обычный ряд под формой. */
  footer?: ReactNode;
  width?: "narrow" | "default" | "wide";
  children: ReactNode;
};

const WIDTH = { narrow: "max-w-2xl", default: "max-w-4xl", wide: "max-w-6xl" };

export function Page({ title, subtitle, back, backMobileOnly, actions, footer, width = "default", children }: PageProps) {
  const max = WIDTH[width];
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
        <div className={cn("mx-auto flex min-h-14 w-full items-center gap-2 px-4 py-2 md:gap-3 md:px-8 md:pt-8 md:pb-1", max)}>
          {back && (
            <Link
              to={back}
              aria-label="Назад"
              className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "-ml-2", backMobileOnly && "md:hidden")}
            >
              <ChevronLeft className="size-5" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-2xl">{title}</h1>
            {subtitle && <div className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</div>}
          </div>
          {actions}
        </div>
      </header>
      {/* На десктопе кнопки идут сразу под содержимым, а не у нижнего края монитора. */}
      <div className={cn("mx-auto w-full flex-1 px-4 pt-4 pb-6 md:flex-none md:px-8 md:pt-5 md:pb-6", max)}>{children}</div>
      {footer && (
        <div className="sticky bottom-0 z-20 border-t bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] md:static md:border-0 md:bg-transparent md:px-8 md:pt-0 md:pb-10">
          <div className={cn("mx-auto w-full md:flex md:justify-end", max)}>{footer}</div>
        </div>
      )}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <h2 className="flex-1 text-[15px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

const TONES: Record<Tone, string> = {
  new: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  progress: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  bad: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  neutral: "bg-secondary text-secondary-foreground",
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <Badge className={cn("h-6 rounded-full px-2.5 text-xs font-semibold", TONES[tone], className)}>{children}</Badge>;
}

// Цвет аватара — от имени, чтобы один и тот же клиент всегда был одного цвета.
const AVATAR_TONES = [
  "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
];

function toneOf(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function InitialAvatar({ name, size = "default" }: { name: string; size?: "default" | "lg" }) {
  return (
    <Avatar className={cn("after:hidden", size === "lg" ? "size-10" : "size-9")}>
      <AvatarFallback className={cn("font-semibold", size === "lg" ? "text-base" : "text-sm", toneOf(name))}>
        {initial(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn(surface, "flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center")}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

export function ErrorNote({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Alert variant="destructive" className="border-destructive/30">
      <TriangleAlert />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** Предупреждение, которое не ошибка: «подключите Telegram», «ИИ не выбран». */
export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
      <TriangleAlert />
      <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
  );
}

/**
 * Модальное окно действия: на телефоне — шторка снизу (как в макетах), на
 * десктопе — диалог по центру: шторка во всю ширину монитора выглядит чужой.
 */
export function ResponsiveModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{props.title}</DialogTitle>
            {props.description && <DialogDescription>{props.description}</DialogDescription>}
          </DialogHeader>
          {props.children}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] gap-3.5 overflow-y-auto rounded-t-2xl px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
        <div className="mx-auto h-1 w-9 shrink-0 rounded-full bg-border" aria-hidden />
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="text-[17px] font-semibold">{props.title}</SheetTitle>
          {props.description && <SheetDescription className="text-[13px]">{props.description}</SheetDescription>}
        </SheetHeader>
        {props.children}
      </SheetContent>
    </Sheet>
  );
}
