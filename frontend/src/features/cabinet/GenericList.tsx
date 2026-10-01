import { ArrowDown, ArrowUp, ChevronRight, Plus, SearchX, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { cn } from "../../shared/lib/utils";
import type { CabinetField, CabinetSection } from "../../shared/types/api";
import { Button, buttonVariants } from "../../shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../shared/ui/table";
import { PAGE_SIZE, type Row, useFacets, useSectionInfinite, useSectionPage } from "./api";
import { DeleteRecordDialog } from "./DeleteRecord";
import { formatValue } from "./FieldInput";
import { Cell, isBadge, NUMERIC, STATUS, titleText } from "./listCells";
import { buildQuery, INITIAL_STATE, isDirty, type ListState, nextOrder } from "./listState";
import { ListToolbar } from "./ListToolbar";
import { sectionIcon, useSectionBack } from "./nav";
import { OrdersBoard } from "./OrdersBoard";
import { Pager } from "./Pager";
import { EmptyState, ErrorNote, ListSkeleton, Page, surface, useIsDesktop, ViewToggle } from "./ui";

/**
 * Есть человеческий статус — docstatus («Черновик/Проведён») колонкой не нужен:
 * это тот же статус в техническом виде. В list_fields он остаётся — по нему
 * фильтрует главная («новые» = docstatus 0), а фильтр принимается только по
 * полям раздела.
 */
function withoutRawStatus(section: CabinetSection): CabinetSection {
  if (!section.list_fields.some((f) => f.fieldtype === STATUS)) return section;
  return { ...section, list_fields: section.list_fields.filter((f) => f.fieldname !== "docstatus") };
}

// Столбцы, по которым имеет смысл сортировать кликом: значения самого документа.
// Адаптеры (сумма, статус, число заказов) сервер не сортирует.
const SORTABLE = new Set(["Data", "Link", "Select", "Date", "Datetime", "Phone", "Small Text"]);
const DEBOUNCE_MS = 300;

type View = "list" | "board";

/** Список или доска; выбор помнится на этом устройстве (localStorage может не работать — тогда просто не помнится). */
function useView(key: string): [View, (v: View) => void] {
  const storageKey = `habibi.cabinet.view.${key}`;
  const [view, setViewState] = useState<View>(() => {
    try {
      return localStorage.getItem(storageKey) === "board" ? "board" : "list";
    } catch {
      return "list";
    }
  });
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      // приватный режим — не страшно
    }
  };
  return [view, setView];
}

export function GenericList({ section: raw }: { section: CabinetSection }) {
  const section = withoutRawStatus(raw);
  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const back = useSectionBack(section.key);
  const [state, setState] = useState<ListState>(INITIAL_STATE);
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const patch = (p: Partial<ListState>) => setState((s) => ({ ...s, ...p }));
  // Запись, на которую нажали корзину в строке; у заказов своё удаление на экране заказа
  const [toDelete, setToDelete] = useState<Row | null>(null);

  // Поиск уходит на сервер не на каждую букву, а когда человек остановился
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(state.search), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.search]);

  const query = useMemo(() => buildQuery(state, debounced), [state, debounced]);
  const queryKey = JSON.stringify(query);
  // Любое изменение условий возвращает на первую страницу
  useEffect(() => setPage(0), [queryKey]);

  const facets = useFacets(section.key);
  // Доска доступна там, где есть быстрые фильтры (статусы заказов): колонки — это они
  const canBoard = (facets.data?.length ?? 0) > 1;
  const [view, setView] = useView(section.key);
  const board = canBoard && view === "board";
  const paged = useSectionPage(section.key, query, page, desktop && !board);
  const infinite = useSectionInfinite(section.key, query, !desktop && !board);
  const active = desktop ? paged : infinite;
  const rows = desktop ? (paged.data?.rows ?? []) : (infinite.data?.pages.flatMap((p) => p.rows) ?? []);
  const total = desktop ? paged.data?.total : infinite.data?.pages[0]?.total;
  const dirty = isDirty(state);
  const [title, ...rest] = section.list_fields;
  // На телефоне карточка: заголовок, серая строка из текстовых полей, справа —
  // первое число (сумма, цена), бейджи — под текстом.
  const amount = rest.find((f) => NUMERIC.has(f.fieldtype) && f.fieldname !== "docstatus");
  const badges = rest.filter(isBadge);
  const plain = rest.filter((f) => f !== amount && !isBadge(f));
  const canDelete = section.can_delete && section.doctype !== "Sales Order";
  const trashButton = (row: Row, className: string) => (
    <button
      type="button"
      aria-label={`Удалить: ${titleText(section, title, row)}`}
      title="Удалить"
      onClick={(e) => {
        e.stopPropagation();
        setToDelete(row);
      }}
      className={cn("inline-flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive", className)}
    >
      <Trash2 className="size-4" />
    </button>
  );
  const href = (row: Row) => `/c/${section.key}/${encodeURIComponent(row.name)}`;
  const Icon = sectionIcon(section.icon);

  const add = section.can_create && (
    <Link to={`/c/${section.key}/new`} className={cn(buttonVariants(), "h-9 gap-1.5 px-3")}>
      <Plus className="size-4" />
      Добавить
    </Link>
  );

  return (
    <Page
      title={section.label}
      subtitle={total === undefined ? undefined : `${dirty ? "Найдено" : "Всего"}: ${total}`}
      back={back}
      backMobileOnly
      actions={
        <>
          {canBoard && <ViewToggle value={view} onChange={setView} />}
          {add}
        </>
      }
      width="wide"
    >
      {board ? (
        <OrdersBoard section={section} />
      ) : (
      <div className="space-y-3">
        <ListToolbar
          section={section}
          state={state}
          onChange={patch}
          onReset={() => setState(INITIAL_STATE)}
          facets={facets.data ?? []}
          total={total}
          desktop={desktop}
        />

        {active.isPending && <ListSkeleton rows={5} />}
        {active.error && <ErrorNote title="Не удалось загрузить список">{active.error.message}</ErrorNote>}

        {active.data && rows.length === 0 && (
          <EmptyState
            icon={dirty ? SearchX : Icon}
            text={dirty ? "Ничего не найдено — измените условия поиска" : "Здесь пока пусто"}
            action={
              dirty ? (
                <Button variant="outline" onClick={() => setState(INITIAL_STATE)}>
                  Сбросить фильтры
                </Button>
              ) : (
                add
              )
            }
          />
        )}

        {rows.length > 0 && (
          <>
            <ul className="space-y-2 md:hidden">
              {rows.map((row) => (
                <li key={row.name} className="flex items-stretch gap-2">
                  <Link to={href(row)} className={cn(surface, "flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 active:bg-muted/60")}>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="truncate text-[15px] font-semibold">
                        {titleText(section, title, row)}
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
                  {canDelete && trashButton(row, cn(surface, "w-11 shrink-0"))}
                </li>
              ))}
            </ul>

            <div className={cn(surface, "hidden overflow-hidden md:block")}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {section.list_fields.map((f) => {
                      const sortable = SORTABLE.has(f.fieldtype) && !isBadge(f);
                      const [orderField, dir] = state.orderBy.split(" ");
                      const sorted = orderField === f.fieldname;
                      return (
                        <TableHead
                          key={f.fieldname}
                          aria-sort={sorted ? (dir === "asc" ? "ascending" : "descending") : undefined}
                          className={cn(
                            "h-10 px-4 text-xs text-muted-foreground",
                            NUMERIC.has(f.fieldtype) && !isBadge(f) && "text-right",
                          )}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => patch({ orderBy: nextOrder(state.orderBy, f.fieldname) })}
                              className={cn("inline-flex items-center gap-1 hover:text-foreground", sorted && "text-primary")}
                            >
                              {f.label}
                              {sorted && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                            </button>
                          ) : (
                            f.label
                          )}
                        </TableHead>
                      );
                    })}
                    {canDelete && <TableHead className="w-12" />}
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
                              {titleText(section, f, row)}
                            </Link>
                          ) : (
                            <Cell field={f} row={row} />
                          )}
                        </TableCell>
                      ))}
                      {canDelete && <TableCell className="w-12 px-2 text-right">{trashButton(row, "size-8")}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {desktop ? (
              total !== undefined && <Pager page={page} total={total} onPage={setPage} />
            ) : (
              <div className="space-y-2 pt-1">
                {infinite.hasNextPage && (
                  <Button
                    variant="outline"
                    className="h-11 w-full bg-card font-semibold text-primary"
                    disabled={infinite.isFetchingNextPage}
                    onClick={() => void infinite.fetchNextPage()}
                  >
                    Показать ещё {Math.min(PAGE_SIZE, (total ?? 0) - rows.length)}
                  </Button>
                )}
                {total !== undefined && (
                  <p className="text-center text-xs text-muted-foreground">
                    Показано {rows.length} из {total}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      )}
      {toDelete && (
        <DeleteRecordDialog
          section={section}
          name={toDelete.name}
          title={titleText(section, section.list_fields[0], toDelete)}
          open
          onOpenChange={(open) => !open && setToDelete(null)}
        />
      )}
    </Page>
  );
}
