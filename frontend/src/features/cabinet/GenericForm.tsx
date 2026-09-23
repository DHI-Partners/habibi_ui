import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Skeleton } from "../../shared/ui/skeleton";
import { useCabinetConfig, useSaveSectionDoc, useSectionDoc } from "./api";
import { FieldInput } from "./FieldInput";

// Отдельные экраны действий (заказ) подменяют форму через ACTIONS — см. задачу 14.
export const ACTIONS: Record<string, React.ComponentType<{ name: string }>> = {};

export function GenericFormRoute() {
  const { key = "", name } = useParams<{ key: string; name?: string }>();
  const navigate = useNavigate();
  const section = useCabinetConfig().data?.find((s) => s.key === key);
  const doc = useSectionDoc(key, name ? decodeURIComponent(name) : null);
  const save = useSaveSectionDoc(key);
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (doc.data) setValues(doc.data);
  }, [doc.data]);

  if (!section) return <p className="text-muted-foreground">Раздел недоступен</p>;
  if (name && doc.isPending) return <Skeleton className="h-60" />;

  const editable = name ? section.can_edit : section.can_create;
  const Actions = name ? ACTIONS[key] : undefined;

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { name: name ? decodeURIComponent(name) : null, values },
          { onSuccess: (saved) => navigate(`/c/${key}/${encodeURIComponent(saved.name)}`, { replace: true }) },
        );
      }}
    >
      {section.form_fields.map((f) => (
        <label key={f.fieldname} className="block space-y-1">
          <span className="text-sm text-muted-foreground">{f.label}</span>
          <FieldInput
            field={f}
            value={values[f.fieldname]}
            disabled={!editable}
            onChange={(v) => setValues((old) => ({ ...old, [f.fieldname]: v }))}
          />
        </label>
      ))}
      {save.error && <p className="text-destructive">{save.error.message}</p>}
      {editable && (
        <button type="submit" disabled={save.isPending} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Сохранить
        </button>
      )}
      {Actions && name && <Actions name={decodeURIComponent(name)} />}
    </form>
  );
}
