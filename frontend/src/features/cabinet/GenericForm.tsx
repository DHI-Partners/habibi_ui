import { FileQuestion, Loader2 } from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { cn } from "../../shared/lib/utils";
import type { CabinetSection } from "../../shared/types/api";
import { Button } from "../../shared/ui/button";
import { Label } from "../../shared/ui/label";
import { Skeleton } from "../../shared/ui/skeleton";
import { useCabinetConfig, useSaveSectionDoc, useSectionDoc } from "./api";
import { FieldInput, formatValue, isInline } from "./FieldInput";
import { OrderScreen } from "./orders/OrderScreen";
import { EmptyState, ErrorNote, Page, surface } from "./ui";

// Разделы, у которых вместо формы — свой экран документа (заказ: карточка
// клиента, сумма, «Принять/Отклонить»). Поля заказа в кабинете не правятся —
// ни в одном пресете can_edit у заказов нет, решение принимается действием.
export const DETAILS: Record<string, ComponentType<{ section: CabinetSection; name: string }>> = {
  orders: OrderScreen,
};

export function GenericFormRoute() {
  // react-router уже декодирует параметр пути (см. комментарий у
  // NamedWorkspaceRoute в App.tsx) — повторный decodeURIComponent здесь не
  // нужен и на именах с "%" (например «Скидка 20%») падал бы URIError без
  // границы ошибок, унося в белый экран всё приложение.
  const { key = "", name } = useParams<{ key: string; name?: string }>();
  const section = useCabinetConfig().data?.find((s) => s.key === key);

  if (!section) {
    return (
      <Page title="Раздел недоступен" back="/c">
        <EmptyState icon={FileQuestion} text="Этого раздела нет или у вас нет к нему доступа" />
      </Page>
    );
  }
  const Detail = name ? DETAILS[key] : undefined;
  if (Detail && name) return <Detail section={section} name={name} />;
  return <GenericForm section={section} name={name ?? null} />;
}

function GenericForm({ section, name }: { section: CabinetSection; name: string | null }) {
  const key = section.key;
  const navigate = useNavigate();
  const doc = useSectionDoc(key, name);
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

  const editable = name ? section.can_edit : section.can_create;
  const [first] = section.form_fields;
  const heading = name ? (first && formatValue(first, values[first.fieldname])) || name : `${section.label}: новая запись`;
  const back = `/c/${key}`;

  if (name && doc.isPending) {
    return (
      <Page title={<Skeleton className="h-6 w-40" />} back={back} width="narrow">
        <div className={cn(surface, "space-y-4 p-4")}>
          {section.form_fields.map((f) => (
            <div key={f.fieldname} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      </Page>
    );
  }
  if (name && doc.error) {
    return (
      <Page title={section.label} back={back} width="narrow">
        <ErrorNote title="Не удалось открыть запись">{doc.error.message}</ErrorNote>
      </Page>
    );
  }

  const submit = () =>
    save.mutate(
      { name, values },
      {
        onSuccess: (saved) => {
          // Подставляем то, что реально сохранил сервер, сразу — не
          // дожидаясь отдельного GET по новому имени, и помечаем
          // документ уже засеянным, чтобы эффект выше не переиграл его
          // тем же значением ещё раз.
          seededRef.current = `${key}:${saved.name}`;
          setValues(saved);
          toast.success("Сохранено");
          navigate(`/c/${key}/${encodeURIComponent(saved.name)}`, { replace: true });
        },
      },
    );

  const footer = editable && (
    <Button type="submit" form="cabinet-form" disabled={save.isPending} className="h-12 w-full text-[15px] md:h-9 md:w-auto md:px-5 md:text-sm">
      {save.isPending && <Loader2 className="animate-spin" />}
      Сохранить
    </Button>
  );

  return (
    <Page title={heading} subtitle={name ? section.label : undefined} back={back} footer={footer} width="narrow">
      <form
        id="cabinet-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {save.error && <ErrorNote title="Не сохранилось">{save.error.message}</ErrorNote>}
        {editable ? (
          <div className={cn(surface, "divide-y")}>
            {section.form_fields.map((f) => {
              const id = `f-${f.fieldname}`;
              const input = (
                <FieldInput
                  id={id}
                  field={f}
                  value={values[f.fieldname]}
                  disabled={!editable}
                  onChange={(v) => setValues((old) => ({ ...old, [f.fieldname]: v }))}
                />
              );
              return isInline(f) ? (
                <div key={f.fieldname} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <Label htmlFor={id} className="flex-1 text-sm font-medium">
                    {f.label}
                  </Label>
                  {input}
                </div>
              ) : (
                <div key={f.fieldname} className="space-y-2 px-4 py-3.5">
                  <Label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">
                    {f.label}
                    {f.reqd && <span className="text-destructive">*</span>}
                  </Label>
                  {input}
                </div>
              );
            })}
          </div>
        ) : (
          // Без права правки — не форма с серыми полями, а просто карточка
          // «подпись — значение»: так её легче читать.
          <dl className={cn(surface, "divide-y")}>
            {section.form_fields.map((f) => (
              <div key={f.fieldname} className="flex gap-4 px-4 py-3 text-sm">
                <dt className="w-1/3 shrink-0 text-muted-foreground">{f.label}</dt>
                <dd className="min-w-0 flex-1 break-words">{formatValue(f, values[f.fieldname]) || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </form>
    </Page>
  );
}
