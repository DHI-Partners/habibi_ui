import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Skeleton } from "../../shared/ui/skeleton";
import { useCabinetConfig, useSaveSectionDoc, useSectionDoc } from "./api";
import { FieldInput } from "./FieldInput";

// Отдельные экраны действий (заказ) подменяют форму через ACTIONS — см. задачу 14.
export const ACTIONS: Record<string, React.ComponentType<{ name: string }>> = {};

export function GenericFormRoute() {
  // react-router уже декодирует параметр пути (см. комментарий у
  // NamedWorkspaceRoute в App.tsx) — повторный decodeURIComponent здесь не
  // нужен и на именах с "%" (например «Скидка 20%») падал бы URIError без
  // границы ошибок, унося в белый экран всё приложение.
  const { key = "", name } = useParams<{ key: string; name?: string }>();
  const navigate = useNavigate();
  const section = useCabinetConfig().data?.find((s) => s.key === key);
  const doc = useSectionDoc(key, name ?? null);
  const save = useSaveSectionDoc(key);
  const [values, setValues] = useState<Record<string, unknown>>({});

  // Какой документ (key:name) уже подставлен в форму. Без этой метки эффект
  // ниже реагировал бы на каждое новое значение doc.data — а тот приходит и
  // при обычном рефетче под открытой формой (staleTime по умолчанию 0,
  // refetchOnWindowFocus, инвалидация из useRealtime), стирая то, что
  // пользователь уже успел напечатать. Подставляем значения заново только
  // когда открылся другой документ, а не когда старый перечитался с сервера.
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    const identity = name ? `${key}:${name}` : null;
    if (doc.data && seededRef.current !== identity) {
      setValues(doc.data);
      seededRef.current = identity;
    }
  }, [doc.data, key, name]);

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
          { name: name ?? null, values },
          {
            onSuccess: (saved) => {
              // Подставляем то, что реально сохранил сервер, сразу — не
              // дожидаясь отдельного GET по новому имени, и помечаем
              // документ уже засеянным, чтобы эффект выше не переиграл его
              // тем же значением ещё раз.
              seededRef.current = `${key}:${saved.name}`;
              setValues(saved);
              navigate(`/c/${key}/${encodeURIComponent(saved.name)}`, { replace: true });
            },
          },
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
      {Actions && name && <Actions name={name} />}
    </form>
  );
}
