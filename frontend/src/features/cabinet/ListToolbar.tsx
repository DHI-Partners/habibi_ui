import { ArrowDownUp, type LucideIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "../../shared/lib/utils";
import type { CabinetSection } from "../../shared/types/api";
import { Button } from "../../shared/ui/button";
import { Input } from "../../shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../shared/ui/select";
import type { Facet } from "./api";
import { optionLabel } from "./FieldInput";
import { fulfilmentIcon, stateIcon } from "./icons";
import {
  activeFilters,
  hasPeriod,
  isDirty,
  type ListState,
  PERIODS,
  type Period,
  searchLabels,
  SORTS,
  selectFilters,
} from "./listState";
import { ResponsiveModal } from "./ui";

type Props = {
  section: CabinetSection;
  state: ListState;
  onChange: (patch: Partial<ListState>) => void;
  onReset: () => void;
  facets: Facet[];
  /** Сколько нашлось по текущим условиям — для кнопки в шторке */
  total: number | undefined;
  desktop: boolean;
};

// Значение «все» в Select: пустая строка в нём значит «ничего не выбрано».
const ALL = "__all";

/** Чип-переключатель: быстрый фильтр, период, значение поля. Высота под палец на телефоне. */
export const chipClass = (active: boolean) =>
  cn(
    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors md:h-8 md:px-3",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground/80 hover:bg-muted",
  );

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={chipClass(active)}>
      {children}
    </button>
  );
}

function SearchField({ section, value, onChange }: { section: CabinetSection; value: string; onChange: (v: string) => void }) {
  const labels = searchLabels(section);
  return (
    <div className="relative w-full md:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={labels.length ? `Поиск: ${labels.join(", ")}` : "Поиск"}
        aria-label="Поиск"
        className="h-10 bg-card pl-9 md:h-9"
      />
    </div>
  );
}

function FacetChips({ facets, value, onChange }: { facets: Facet[]; value: string; onChange: (key: string) => void }) {
  if (facets.length <= 1) return null;
  return (
    <div role="group" aria-label="Быстрые фильтры" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      {facets.map((f) => {
        const Icon = stateIcon(f.key);
        return (
        <Chip key={f.key} active={value === f.key} onClick={() => onChange(f.key)}>
          {Icon && <Icon className="size-3.5" aria-hidden />}
          {f.label}
          <span className={cn("text-xs font-semibold tabular-nums", value === f.key ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {f.count}
          </span>
        </Chip>
        );
      })}
    </div>
  );
}

/** Выпадающий фильтр десктопа: «Получение  Все ▾». */
function FilterSelect(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const current = props.options.find((o) => o.value === props.value);
  return (
    <Select value={props.value === "" ? ALL : props.value} onValueChange={(v) => props.onChange(!v || v === ALL ? "" : v)}>
      <SelectTrigger className="h-9 gap-2 bg-card">
        <span className="text-muted-foreground">{props.label}</span>
        <SelectValue>{() => current?.label ?? props.options[0]?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {props.options.map((o) => (
          <SelectItem key={o.value === "" ? ALL : o.value} value={o.value === "" ? ALL : o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Option = { value: string; label: string; icon?: LucideIcon };

const fieldOptions = (choices: string[]): Option[] => [
  { value: "", label: "Все" },
  ...choices.map((c) => ({ value: c, label: optionLabel(c), icon: fulfilmentIcon(c) })),
];

function DateRange({ state, onChange }: { state: ListState; onChange: (patch: Partial<ListState>) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="С даты"
        value={state.from}
        max={state.to || undefined}
        onChange={(e) => onChange({ from: e.target.value })}
        className="h-10 w-full bg-card md:h-9 md:w-40"
      />
      <span className="text-muted-foreground">—</span>
      <Input
        type="date"
        aria-label="По дату"
        value={state.to}
        min={state.from || undefined}
        onChange={(e) => onChange({ to: e.target.value })}
        className="h-10 w-full bg-card md:h-9 md:w-40"
      />
    </div>
  );
}

function DesktopFilters({ section, state, onChange, onReset }: Pick<Props, "section" | "state" | "onChange" | "onReset">) {
  const fields = selectFilters(section);
  const sortLabel = SORTS.find((o) => o.value === state.orderBy)?.label;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {fields.map((f) => (
        <FilterSelect
          key={f.fieldname}
          label={f.label}
          value={state.fields[f.fieldname] ?? ""}
          options={fieldOptions(f.choices)}
          onChange={(v) => onChange({ fields: { ...state.fields, [f.fieldname]: v } })}
        />
      ))}
      {hasPeriod(section) && (
        <>
          <FilterSelect
            label="Период"
            value={state.period}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            onChange={(v) => onChange({ period: v as Period })}
          />
          {state.period === "custom" && <DateRange state={state} onChange={onChange} />}
        </>
      )}
      <Select value={state.orderBy === "" ? ALL : state.orderBy} onValueChange={(v) => onChange({ orderBy: !v || v === ALL ? "" : v })}>
        <SelectTrigger className="h-9 gap-2 bg-card">
          <span className="text-muted-foreground">Сортировка</span>
          <SelectValue>{() => sortLabel ?? "По столбцу"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((o) => (
            <SelectItem key={o.value === "" ? ALL : o.value} value={o.value === "" ? ALL : o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isDirty(state) && (
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5 text-muted-foreground" onClick={onReset}>
          <X /> Сбросить
        </Button>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</div>
      {children}
    </div>
  );
}

/** Шторка фильтров телефона: те же условия, что на десктопе, но чипами под палец. */
function FilterSheet({
  section,
  state,
  onChange,
  onReset,
  total,
  open,
  onOpenChange,
}: Pick<Props, "section" | "state" | "onChange" | "onReset" | "total"> & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fields = selectFilters(section);
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Фильтры" description={section.label}>
      <div className="space-y-5">
        {fields.map((f) => (
          <Group key={f.fieldname} title={f.label}>
            <div className="flex flex-wrap gap-1.5">
              {fieldOptions(f.choices).map((o) => (
                <Chip
                  key={o.value || ALL}
                  active={(state.fields[f.fieldname] ?? "") === o.value}
                  onClick={() => onChange({ fields: { ...state.fields, [f.fieldname]: o.value } })}
                >
                  {o.icon && <o.icon className="size-3.5" aria-hidden />}
                  {o.label}
                </Chip>
              ))}
            </div>
          </Group>
        ))}
        {hasPeriod(section) && (
          <Group title="Период">
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <Chip key={p.value || ALL} active={state.period === p.value} onClick={() => onChange({ period: p.value })}>
                  {p.label}
                </Chip>
              ))}
            </div>
            {state.period === "custom" && <DateRange state={state} onChange={onChange} />}
          </Group>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="h-11 flex-1" onClick={onReset} disabled={!isDirty(state)}>
            Сбросить
          </Button>
          <Button className="h-11 flex-[2] font-semibold" onClick={() => onOpenChange(false)}>
            {total === undefined ? "Готово" : `Показать: ${total}`}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

function MobileBar(props: Props) {
  const [open, setOpen] = useState(false);
  const count = activeFilters(props.state);
  const newestFirst = props.state.orderBy === "";
  const hasControls = selectFilters(props.section).length > 0 || hasPeriod(props.section);
  return (
    <div className="flex items-center gap-2">
      {hasControls && (
        <Button variant="outline" className="h-10 gap-2 bg-card px-3.5 font-semibold" onClick={() => setOpen(true)}>
          <SlidersHorizontal /> Фильтры
          {count > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground">{count}</span>
          )}
        </Button>
      )}
      <Button
        variant="outline"
        className="ml-auto h-10 gap-2 bg-card px-3.5 font-semibold"
        onClick={() => props.onChange({ orderBy: newestFirst ? "creation asc" : "" })}
      >
        <ArrowDownUp /> {newestFirst ? "Новые сверху" : "Старые сверху"}
      </Button>
      <FilterSheet {...props} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function ListToolbar(props: Props) {
  const { section, state, onChange, facets, desktop } = props;
  return (
    <div className="space-y-3">
      <SearchField section={section} value={state.search} onChange={(search) => onChange({ search })} />
      <FacetChips facets={facets} value={state.facet} onChange={(facet) => onChange({ facet })} />
      {desktop ? <DesktopFilters {...props} /> : <MobileBar {...props} />}
    </div>
  );
}
