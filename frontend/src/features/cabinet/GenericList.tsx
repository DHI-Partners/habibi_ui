import { useState } from "react";
import { Link } from "react-router-dom";

import type { CabinetSection } from "../../shared/types/api";
import { Skeleton } from "../../shared/ui/skeleton";
import { type Filter, useSectionList } from "./api";
import { formatValue } from "./FieldInput";

export function GenericList({ section }: { section: CabinetSection }) {
  const [search, setSearch] = useState("");
  const firstText = section.list_fields.find((f) => f.fieldtype === "Data");
  const filters: Filter[] = search && firstText ? [[firstText.fieldname, "like", `%${search}%`]] : [];
  const list = useSectionList(section.key, filters);

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-semibold">{section.label}</h1>
        {section.can_create && (
          <Link
            to={`/c/${section.key}/new`}
            className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Добавить
          </Link>
        )}
      </header>
      {firstText && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск"
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      )}
      {list.isPending && <Skeleton className="h-40" />}
      {list.error && <p className="text-destructive">{list.error.message}</p>}
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {list.data?.rows.map((row) => (
          <li key={row.name}>
            <Link to={`/c/${section.key}/${encodeURIComponent(row.name)}`} className="block px-4 py-3">
              <div className="font-medium">
                {formatValue(section.list_fields[0], row[section.list_fields[0].fieldname])}
              </div>
              <div className="text-sm text-muted-foreground">
                {section.list_fields
                  .slice(1)
                  .map((f) => formatValue(f, row[f.fieldname]))
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </Link>
          </li>
        ))}
        {list.data?.rows.length === 0 && <li className="px-4 py-6 text-center text-muted-foreground">Пусто</li>}
      </ul>
    </section>
  );
}
