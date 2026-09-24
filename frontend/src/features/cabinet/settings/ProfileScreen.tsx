import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import type { CabinetSection } from "../../../shared/types/api";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select";
import { Skeleton } from "../../../shared/ui/skeleton";
import { Textarea } from "../../../shared/ui/textarea";
import { useSectionBack } from "../nav";
import { ErrorNote, Page, SectionTitle, surface } from "../ui";
import { type Profile, useProfile } from "./api";

const CORE: [keyof Profile, string, string][] = [
  ["business_name", "Название", "Как вас называют клиенты"],
  ["business_kind", "Чем занимаетесь", "Например, бургерная с доставкой"],
  ["address", "Адрес", "Улица, дом — откуда самовывоз"],
  ["phone", "Телефон для клиентов", "+7 700 000 00 00"],
];
// Пределы — те же, что проверяет сервер (habibi_ai.profile: DESCRIPTION_MAX и
// соседи); здесь они только для счётчиков, отказ всё равно придёт с сервера.
const LIMITS = { description: 1000, title: 80, text: 1500, rules: 20 };

const TONES: Record<string, string> = {
  friendly: "Дружелюбный",
  neutral: "Нейтральный",
  formal: "Официальный",
};

export function ProfileScreen({ section }: { section: CabinetSection }) {
  const { query, mutation } = useProfile();
  const back = useSectionBack(section.key);
  const [p, setP] = useState<Profile | null>(null);
  const [newTitle, setNewTitle] = useState("");
  // Сеем форму только раз, при первой загрузке — иначе рефетч под открытой
  // формой (staleTime по умолчанию 0, фокус окна, инвалидация из
  // useRealtime) стирал бы то, что владелец уже успел напечатать. После
  // сохранения форма обновляется явно, из ответа мутации, а не через этот
  // эффект.
  const seededRef = useRef(false);
  useEffect(() => {
    if (query.data && !seededRef.current) {
      setP(query.data);
      seededRef.current = true;
    }
  }, [query.data]);

  if (query.error) {
    return (
      <Page title={section.label} back={back} backMobileOnly width="narrow">
        <ErrorNote title="Не удалось загрузить профиль">{query.error.message}</ErrorNote>
      </Page>
    );
  }
  if (!p) {
    return (
      <Page title={section.label} back={back} backMobileOnly width="narrow">
        <div className={cn(surface, "space-y-4 p-4")}>
          {CORE.map(([key]) => (
            <div key={key} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      </Page>
    );
  }

  const full = p.rules.length >= LIMITS.rules;
  const addRule = () => {
    setP({ ...p, rules: [...p.rules, { title: newTitle.trim(), hint: "", text: "" }] });
    setNewTitle("");
  };

  const footer = (
    <Button
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(
          { values: p },
          {
            onSuccess: (saved) => {
              setP(saved);
              toast.success("Сохранено — бот уже знает");
            },
          },
        )
      }
      className="h-12 w-full text-[15px] font-semibold md:h-9 md:w-auto md:px-5 md:text-sm"
    >
      {mutation.isPending && <Loader2 className="animate-spin" />}
      Сохранить
    </Button>
  );

  return (
    <Page
      title={section.label}
      subtitle="Это знает ваш бот"
      back={back}
      backMobileOnly
      footer={footer}
      width="narrow"
    >
      <div className="space-y-7">
        {mutation.error && <ErrorNote title="Не сохранилось">{mutation.error.message}</ErrorNote>}
        <p className="text-sm text-muted-foreground">Пишите так, как ответили бы клиенту сами.</p>

        <section className="space-y-2">
          <SectionTitle>Основное</SectionTitle>
          <div className={cn(surface, "space-y-4 p-4")}>
            {CORE.map(([key, label, placeholder]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`p-${key}`} className="text-[13px] text-muted-foreground">
                  {label}
                </Label>
                <Input
                  id={`p-${key}`}
                  className="h-10"
                  type={key === "phone" ? "tel" : "text"}
                  placeholder={placeholder}
                  value={String(p[key] ?? "")}
                  onChange={(e) => setP({ ...p, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="p-description" className="text-[13px] text-muted-foreground">
                Коротко о вас
              </Label>
              <Textarea
                id="p-description"
                rows={3}
                value={p.description}
                aria-describedby="p-description-count"
                onChange={(e) => setP({ ...p, description: e.target.value })}
              />
              <Counter id="p-description-count" value={p.description} max={LIMITS.description} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-tone" className="text-[13px] text-muted-foreground">
                Как общаться с клиентами
              </Label>
              <Select value={p.tone || null} onValueChange={(v) => setP({ ...p, tone: v ?? "" })}>
                <SelectTrigger id="p-tone" className="h-10 w-full">
                  <SelectValue placeholder="Не выбрано">{(v: string | null) => (v ? (TONES[v] ?? v) : "Не выбрано")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TONES).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle>Что ещё знает бот</SectionTitle>
          <div className={cn(surface, "space-y-4 p-4")}>
            {p.rules.length === 0 && (
              <p className="text-sm text-muted-foreground">Добавьте, о чём часто спрашивают: оплата, парковка, аллергены.</p>
            )}
            {p.rules.map((r, i) => (
              // Блок пресета (с подсказкой) не удаляется — пустой бот просто
              // не увидит; свой блок владелец убирает сам. Удаление — как любая
              // правка формы: до «Сохранить» ничего не потеряно.
              <div key={`${r.title}-${i}`} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`rule-${i}`} className="text-sm font-medium break-words">
                      {r.title}
                    </Label>
                    {r.hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{r.hint}</p>}
                  </div>
                  {!r.hint && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Удалить блок «${r.title}»`}
                      title="Удалить блок"
                      onClick={() => setP({ ...p, rules: p.rules.filter((_, j) => j !== i) })}
                      className="-mr-2 size-11 shrink-0 text-muted-foreground hover:text-destructive md:size-8"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <Textarea
                  id={`rule-${i}`}
                  rows={3}
                  placeholder={r.hint ? "Оставьте пустым, если не нужно" : "Что ответить клиенту"}
                  value={r.text}
                  aria-describedby={`rule-${i}-count`}
                  onChange={(e) => setP({ ...p, rules: p.rules.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                />
                <Counter id={`rule-${i}-count`} value={r.text} max={LIMITS.text} />
              </div>
            ))}
            <form
              className="flex gap-2 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (newTitle.trim() && !full) addRule();
              }}
            >
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Свой блок, например «Парковка»"
                aria-label="Название нового блока"
                maxLength={LIMITS.title}
                disabled={full}
                className="h-10"
              />
              <Button type="submit" variant="outline" disabled={!newTitle.trim() || full} className="h-10 shrink-0">
                <Plus />
                Добавить
              </Button>
            </form>
            {full && (
              <p className="-mt-2 text-[13px] text-muted-foreground">
                Блоков уже {LIMITS.rules} — удалите ненужный, чтобы добавить новый.
              </p>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}

/**
 * Счётчик под полем — только когда до предела осталось меньше 20%: раньше он
 * лишь отвлекает. За пределом — красный: сервер такое не сохранит.
 */
function Counter({ id, value, max }: { id: string; value: string; max: number }) {
  const length = value.length;
  if (length < max * 0.8) return null;
  const over = length > max;
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn("text-right text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}
    >
      {over ? `Слишком длинно: ${length} из ${max}` : `${length} из ${max}`}
    </p>
  );
}
