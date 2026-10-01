import { LayoutList } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../../shared/lib/utils";
import type { CabinetField, CabinetSection } from "../../shared/types/api";
import { type BoardColumn, type Row, useBoard } from "./api";
import { formatValue } from "./FieldInput";
import { durationLabel, parseSiteDate } from "./format";
import { stateIcon } from "./icons";
import { Cell, isBadge, NUMERIC, titleText } from "./listCells";
import { EmptyState, ErrorNote, ListSkeleton, surface } from "./ui";

/** Сколько минут назад создан документ; нет поля или даты — null. */
function ageOf(row: Row): number | null {
  const created = parseSiteDate(row.creation as string | null | undefined);
  return created ? Math.max(0, Math.floor((Date.now() - created.getTime()) / 60_000)) : null;
}

function BoardCard({ section, row, href }: { section: CabinetSection; row: Row; href: string }) {
  const [title, ...rest] = section.list_fields;
  const amount = rest.find((f) => NUMERIC.has(f.fieldtype) && !isBadge(f));
  // Подписи колонки (статус) не повторяем в карточке; дата создания — таймером ниже
  const plain = rest.filter((f) => f !== amount && !isBadge(f) && f.fieldname !== "creation");
  const [main, ...extra] = plain;
  const age = ageOf(row);
  return (
    <Link to={href} className={cn(surface, "flex flex-col gap-1 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-muted/50")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-bold tabular-nums">{titleText(section, title, row)}</span>
        {amount && <span className="text-[13px] font-semibold tabular-nums">{formatValue(amount, row[amount.fieldname])}</span>}
      </div>
      {main && <div className="truncate text-[13px]">{formatValue(main, row[main.fieldname])}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {extra.map((f: CabinetField) => (
          <span key={f.fieldname} className="inline-flex items-center">
            <Cell field={f} row={row} />
          </span>
        ))}
        {age !== null && <span className="ml-auto tabular-nums">{durationLabel(age)}</span>}
      </div>
    </Link>
  );
}

function Column({ section, column }: { section: CabinetSection; column: BoardColumn }) {
  const Icon = stateIcon(column.key);
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-xl bg-muted/60 p-2.5" aria-label={column.label}>
      <h3 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold">
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        {column.label}
        <span className="ml-auto rounded-md bg-background px-1.5 text-xs leading-[18px] text-muted-foreground tabular-nums">{column.total}</span>
      </h3>
      {column.rows.map((row) => (
        <BoardCard key={row.name} section={section} row={row} href={`/c/${section.key}/${encodeURIComponent(row.name)}`} />
      ))}
      {column.rows.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Пусто</p>}
      {column.has_more && (
        <p className="px-1 text-center text-xs text-muted-foreground">Ещё {column.total - column.rows.length} — в списке</p>
      )}
    </section>
  );
}

/** Доска открытых заказов: колонка на каждый быстрый фильтр, кроме закрытых. Карточка ведёт на экран заказа. */
export function OrdersBoard({ section }: { section: CabinetSection }) {
  const board = useBoard(section.key, true);
  if (board.isPending) return <ListSkeleton rows={4} />;
  if (board.error && !board.data) return <ErrorNote title="Доска не загрузилась">{board.error.message}</ErrorNote>;
  const columns = board.data ?? [];
  if (columns.every((c) => c.total === 0)) {
    return <EmptyState icon={LayoutList} text="Открытых заказов нет — все выданы или отменены" />;
  }
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:snap-none md:grid-flow-col md:auto-cols-[minmax(185px,1fr)] md:px-0">
      {columns.map((c) => (
        <div key={c.key} className="w-[78vw] max-w-[320px] shrink-0 snap-start md:w-auto md:max-w-none">
          <Column section={section} column={c} />
        </div>
      ))}
    </div>
  );
}
