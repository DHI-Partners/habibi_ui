import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../../shared/lib/utils";
import { Button } from "../../shared/ui/button";
import { PAGE_SIZE } from "./api";

/** Номера страниц с многоточиями: 1 … 4 [5] 6 … 12 — не больше семи кнопок. */
export function pageWindow(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set([0, count - 1, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 0 && p < count).sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

/** Десктопная пагинация: «21–40 из 143», Назад, номера, Вперёд. */
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const count = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return <p className="px-1 text-sm text-muted-foreground">Всего: {total}</p>;
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {from}–{to} из {total}
      </span>
      <nav aria-label="Страницы" className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 gap-1 bg-card px-2.5" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft /> Назад
        </Button>
        {pageWindow(page, count).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant="outline"
              size="sm"
              aria-current={p === page ? "page" : undefined}
              className={cn("h-8 min-w-8 bg-card px-2 tabular-nums", p === page && "border-primary/30 bg-primary/10 text-primary")}
              onClick={() => onPage(p)}
            >
              {p + 1}
            </Button>
          ),
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1 bg-card px-2.5" disabled={page >= count - 1} onClick={() => onPage(page + 1)}>
          Вперёд <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}
