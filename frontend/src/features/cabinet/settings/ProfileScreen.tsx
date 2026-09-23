import { Loader2, Plus } from "lucide-react";
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
                onChange={(e) => setP({ ...p, description: e.target.value })}
              />
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
              <div key={`${r.title}-${i}`} className="space-y-2">
                <Label htmlFor={`rule-${i}`} className="text-sm font-medium">
                  {r.title}
                </Label>
                <Textarea
                  id={`rule-${i}`}
                  rows={3}
                  placeholder={r.hint}
                  value={r.text}
                  onChange={(e) => setP({ ...p, rules: p.rules.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                />
              </div>
            ))}
            <form
              className="flex gap-2 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (newTitle.trim()) addRule();
              }}
            >
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Свой блок, например «Парковка»"
                aria-label="Название нового блока"
                className="h-10"
              />
              <Button type="submit" variant="outline" disabled={!newTitle.trim()} className="h-10 shrink-0">
                <Plus />
                Добавить
              </Button>
            </form>
          </div>
        </section>
      </div>
    </Page>
  );
}
