import type { CabinetField } from "../../shared/types/api";

export function formatValue(field: CabinetField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.fieldtype === "Check") return value ? field.label : "";
  if (field.fieldtype === "Currency" || field.fieldtype === "Float") return Number(value).toLocaleString("ru-RU");
  return String(value);
}

type Props = { field: CabinetField; value: unknown; disabled: boolean; onChange: (value: unknown) => void };

// ~10 типов полей, которые реально встречаются в разделах пресетов. Остальные
// показываются только чтением: полный движок форм — отдельная задача (Блок 3
// спеки habibi_ui), кабинету он не нужен.
export function FieldInput({ field, value, disabled, onChange }: Props) {
  const common = "w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-60";
  const readOnly = disabled || field.read_only;
  switch (field.fieldtype) {
    case "Check":
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        />
      );
    case "Currency":
    case "Float":
    case "Int":
      return (
        <input
          type="number"
          className={common}
          value={value === null || value === undefined ? "" : String(value)}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "Small Text":
    case "Text":
    case "Text Editor":
      return (
        <textarea
          rows={4}
          className={common}
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "Select":
      return (
        <select className={common} value={String(value ?? "")} disabled={readOnly} onChange={(e) => onChange(e.target.value)}>
          {field.options.split("\n").map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "Date":
      return (
        <input
          type="date"
          className={common}
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "Data":
    case "Link":
    case "Phone":
      return (
        <input className={common} value={String(value ?? "")} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
      );
    default:
      return <div className="py-2">{formatValue(field, value)}</div>;
  }
}
