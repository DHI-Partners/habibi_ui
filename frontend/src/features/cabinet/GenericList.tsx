import { ChevronRight, Plus, Search, SearchX } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { cn } from "../../shared/lib/utils";
import type { CabinetField, CabinetSection } from "../../shared/types/api";
import { buttonVariants } from "../../shared/ui/button";
import { Input } from "../../shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../shared/ui/table";
import { type Filter, type Row, useSectionList } from "./api";
import { formatValue } from "./FieldInput";
import { docstatusBadge, stateBadge } from "./format";
import { sectionIcon, useSectionBack } from "./nav";
import { EmptyState, ErrorNote, ListSkeleton, Page, StatusBadge, surface } from "./ui";

const NUMERIC = new Set(["Currency", "Float", "Int"]);

/** Значение ячейки: статусы Frappe — бейджем, числа — с разрядами, флаг — бейджем с подписью. */
function Cell({ field, row }: { field: CabinetField; row: Row }): ReactNode {
  const value = row[field.fieldname];
  if (field.fieldname === "docstatus") {
    const [label, tone] = docstatusBadge(value);
    return <StatusBadge tone={tone}>{label}</StatusBadge>;
  }
  if (field.fieldname === "workflow_state") {
    if (!value) return null;
    const [label, tone] = stateBadge(String(value));
    return <StatusBadge tone={tone}>{label}</StatusBadge>;
  }
  if (field.fieldtype === "Check") {
    return value ? <StatusBadge tone="neutral">{field.label}</StatusBadge> : null;
  }
  return formatValue(field, value);
}

const isBadge = (f: CabinetField) => f.fieldname === "docstatus" || f.fieldname === "workflow_state" || f.fieldtype === "Check";

export function GenericList({ section }: { section: CabinetSection }) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const back = useSectionBack(section.key);
  const firstText = section.list_fields.find((f) => f.fieldtype === "Data");
  const filters: Filter[] = search && firstText ? [[firstText.fieldname, "like", `%${search}%`]] : [];
  const list = useSectionList(section.key, filters);
  const rows = list.data?.rows ?? [];
  const [title, ...rest] = section.list_fields;
  // На телефоне карточка: заголовок, серая строка из текстовых полей, справа —
  // первое число (сумма, цена), бейджи — под текстом.
  const amount = rest.find((f) => NUMERIC.has(f.fieldtype) && f.fieldname !== "docstatus");
  const badges = rest.filter(isBadge);
  const plain = rest.filter((f) => f !== amount && !isBadge(f));
  const href = (row: Row) => `/c/${section.key}/${encodeURIComponent(row.name)}`;
  const Icon = sectionIcon(section.icon);

  const add = section.can_create && (
    <Link to={`/c/${section.key}/new`} className={cn(buttonVariants(), "h-9 gap-1.5 px-3")}>
      <Plus className="size-4" />
      Добавить
    </Link>
  );

  return (
    <Page title={section.label} back={back} backMobileOnly actions={add} width="wide">
      <div className="space-y-3">
        {firstText && (
          <div className="relative md:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Поиск: ${firstText.label.toLowerCase()}`}
              aria-label="Поиск"
              className="h-10 bg-card pl-9 md:h-9"
            />
          </div>
        )}

        {list.isPending && <ListSkeleton rows={5} />}
        {list.error && <ErrorNote title="Не удалось загрузить список">{list.error.message}</ErrorNote>}

        {list.data && rows.length === 0 && (
          <EmptyState
            icon={search ? SearchX : Icon}
            text={search ? "Ничего не найдено — попробуйте другой запрос" : "Здесь пока пусто"}
            action={!search && add}
          />
        )}

        {rows.length > 0 && (
          <>
            <ul className="space-y-2 md:hidden">
              {rows.map((row) => (
                <li key={row.name}>
                  <Link to={href(row)} className={cn(surface, "flex items-center gap-3 px-3.5 py-3 active:bg-muted/60")}>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="truncate text-[15px] font-semibold">
                        {formatValue(title, row[title.fieldname]) || row.name}
                      </div>
                      {plain.length > 0 && (
                        <div className="truncate text-[13px] text-muted-foreground">
                          {plain
                            .map((f) => formatValue(f, row[f.fieldname]))
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                      {badges.some((f) => row[f.fieldname]) && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {badges.map((f) => (
                            <Cell key={f.fieldname} field={f} row={row} />
                          ))}
                        </div>
                      )}
                    </div>
                    {amount && (
                      <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                        {formatValue(amount, row[amount.fieldname])}
                      </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className={cn(surface, "hidden overflow-hidden md:block")}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {section.list_fields.map((f) => (
                      <TableHead
                        key={f.fieldname}
                        className={cn("h-10 px-4 text-xs text-muted-foreground", NUMERIC.has(f.fieldtype) && !isBadge(f) && "text-right")}
                      >
                        {f.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.name} className="cursor-pointer" onClick={() => navigate(href(row))}>
                      {section.list_fields.map((f, i) => (
                        <TableCell
                          key={f.fieldname}
                          className={cn(
                            "h-12 px-4",
                            i === 0 && "font-medium",
                            NUMERIC.has(f.fieldtype) && !isBadge(f) && "text-right tabular-nums",
                          )}
                        >
                          {i === 0 ? (
                            <Link to={href(row)} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                              {formatValue(f, row[f.fieldname]) || row.name}
                            </Link>
                          ) : (
                            <Cell field={f} row={row} />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {list.data?.has_more && (
              <p className="text-center text-xs text-muted-foreground">Показаны последние {rows.length} — уточните поиск</p>
            )}
          </>
        )}
      </div>
    </Page>
  );
}
