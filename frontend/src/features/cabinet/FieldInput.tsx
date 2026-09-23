import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { ru } from "react-day-picker/locale";

import { call } from "../../shared/api/client";
import { cn } from "../../shared/lib/utils";
import type { CabinetField } from "../../shared/types/api";
import { Calendar } from "../../shared/ui/calendar";
import { Input } from "../../shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../shared/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../shared/ui/select";
import { Switch } from "../../shared/ui/switch";
import { Textarea } from "../../shared/ui/textarea";
import { dateLabel, money } from "./format";

// Frappe хранит варианты Select как есть, часто по-английски, и переводит их
// только в Desk. Самые частые значения пресетов показываем по-русски;
// остальное — как в опциях.
const SELECT_LABELS: Record<string, string> = {
  Delivery: "Доставка",
  Pickup: "Самовывоз",
  Open: "Открыто",
  Closed: "Закрыто",
  Cancelled: "Отменено",
  Low: "Низкий",
  Medium: "Средний",
  High: "Высокий",
};
export const optionLabel = (value: string) => SELECT_LABELS[value] ?? value;

export function formatValue(field: CabinetField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.fieldtype === "Select") return optionLabel(String(value));
  if (field.fieldtype === "Check") return value ? field.label : "";
  if (field.fieldtype === "Currency" || field.fieldtype === "Float") return money(value);
  if (field.fieldtype === "Date") return dateLabel(value);
  return String(value);
}

const LONG_DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

function parseIsoDate(value: string): Date | undefined {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Высота полей формы кабинета — 40px: на телефоне палец, а не курсор.
export const FIELD = "h-10 md:h-9";

type Props = {
  field: CabinetField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
  id?: string;
};

/** Поле, которое рисуется строкой «подпись — переключатель», а не «подпись над полем». */
export const isInline = (field: CabinetField) => field.fieldtype === "Check";

// ~10 типов полей, которые реально встречаются в разделах пресетов. Остальные
// показываются только чтением: полный движок форм — отдельная задача (Блок 3
// спеки habibi_ui), кабинету он не нужен.
export function FieldInput({ field, value, disabled, onChange, id }: Props) {
  const readOnly = disabled || field.read_only;
  const text = value === null || value === undefined ? "" : String(value);
  switch (field.fieldtype) {
    case "Check":
      return (
        <Switch id={id} checked={Boolean(value)} disabled={readOnly} onCheckedChange={(on) => onChange(on ? 1 : 0)} />
      );
    case "Currency":
    case "Float":
    case "Int":
      return (
        <Input
          id={id}
          type="number"
          inputMode={field.fieldtype === "Int" ? "numeric" : "decimal"}
          step={field.fieldtype === "Int" ? 1 : "any"}
          className={cn(FIELD, "tabular-nums")}
          value={text}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "Small Text":
    case "Text":
    case "Text Editor":
      return (
        <Textarea id={id} rows={4} value={text} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
      );
    case "Select": {
      const options = field.options.split("\n").filter(Boolean);
      return (
        <Select value={text || null} disabled={readOnly} onValueChange={(v) => onChange(v ?? "")}>
          <SelectTrigger id={id} className={cn(FIELD, "w-full")}>
            <SelectValue placeholder="Не выбрано">{(v: string | null) => (v ? optionLabel(v) : "Не выбрано")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {optionLabel(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "Date":
      return <DateInput id={id} value={text} disabled={readOnly} onChange={onChange} />;
    case "Link":
      return <LinkInput id={id} doctype={field.options} value={text} disabled={readOnly} onChange={onChange} />;
    case "Data":
    case "Phone":
      return (
        <Input
          id={id}
          type={field.fieldtype === "Phone" ? "tel" : "text"}
          inputMode={field.fieldtype === "Phone" ? "tel" : undefined}
          className={FIELD}
          value={text}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "Attach Image":
      return text ? (
        <img src={text} alt="" className="size-24 rounded-lg border object-cover" />
      ) : (
        <div className="text-sm text-muted-foreground">Нет фото</div>
      );
    default:
      return <div className="py-2 text-sm">{formatValue(field, value) || "—"}</div>;
  }
}

function DateInput(props: { id?: string; value: string; disabled: boolean; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const selected = props.value ? parseIsoDate(props.value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={props.id}
        disabled={props.disabled}
        className={cn(
          FIELD,
          "flex w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
          !selected && "text-muted-foreground",
        )}
      >
        <CalendarDays className="size-4 text-muted-foreground" />
        {selected ? LONG_DATE.format(selected) : "Выберите дату"}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ru}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            props.onChange(d ? toIsoDate(d) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// Варианты Link — стандартным поиском Frappe (search_link): он уже знает права
// пользователя и поля поиска доктайпа, своего метода кабинету не нужно. Не
// нашлось или нет доступа — поле остаётся обычным вводом текста.
function LinkInput(props: {
  id?: string;
  doctype: string;
  value: string;
  disabled: boolean;
  onChange: (v: unknown) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [term, setTerm] = useState(props.value);
  useEffect(() => setTerm(props.value), [props.value]);
  const options = useQuery({
    queryKey: ["cabinet", "link", props.doctype, term],
    queryFn: () =>
      call<{ value: string; description?: string }[]>("frappe.desk.search.search_link", {
        doctype: props.doctype,
        txt: term,
        page_length: 8,
      }),
    enabled: focused && Boolean(props.doctype),
    staleTime: 30_000,
    retry: false,
  });
  const items = options.data ?? [];
  return (
    <div className="relative">
      <Input
        id={props.id}
        role="combobox"
        aria-expanded={focused && items.length > 0}
        autoComplete="off"
        className={FIELD}
        value={term}
        disabled={props.disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setTerm(e.target.value);
          props.onChange(e.target.value);
        }}
      />
      {focused && items.length > 0 && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {items.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === props.value}
              // mousedown, а не click: иначе blur поля закроет список раньше выбора
              onMouseDown={(e) => {
                e.preventDefault();
                setTerm(o.value);
                props.onChange(o.value);
                setFocused(false);
              }}
              className="cursor-default rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <div>{o.value}</div>
              {o.description && <div className="truncate text-xs text-muted-foreground">{o.description}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
