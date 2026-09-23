import { useEffect, useRef, useState } from "react";

import { type Profile, useProfile } from "./api";

const CORE: [keyof Profile, string][] = [
  ["business_name", "Название"],
  ["business_kind", "Чем занимаетесь"],
  ["address", "Адрес"],
  ["phone", "Телефон для клиентов"],
];
const TONES = [
  ["friendly", "Дружелюбный"],
  ["neutral", "Нейтральный"],
  ["formal", "Официальный"],
];

export function ProfileScreen() {
  const { query, mutation } = useProfile();
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
  if (!p) return null;

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2";
  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">О компании</h1>
      <p className="text-sm text-muted-foreground">Это знает ваш бот. Пишите так, как ответили бы клиенту сами.</p>
      {CORE.map(([key, label]) => (
        <label key={key} className="block space-y-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <input className={input} value={String(p[key] ?? "")} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
        </label>
      ))}
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">Коротко о вас</span>
        <textarea rows={3} className={input} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">Как общаться с клиентами</span>
        <select className={input} value={p.tone} onChange={(e) => setP({ ...p, tone: e.target.value })}>
          {TONES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {p.rules.map((r, i) => (
        <label key={i} className="block space-y-1">
          <span className="font-medium">{r.title}</span>
          <textarea
            rows={3}
            placeholder={r.hint}
            className={input}
            value={r.text}
            onChange={(e) => setP({ ...p, rules: p.rules.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
          />
        </label>
      ))}
      <div className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Свой блок, например «Парковка»"
          className={input}
        />
        <button
          type="button"
          disabled={!newTitle.trim()}
          onClick={() => {
            setP({ ...p, rules: [...p.rules, { title: newTitle.trim(), hint: "", text: "" }] });
            setNewTitle("");
          }}
          className="rounded-lg border border-border px-3 text-sm"
        >
          Добавить
        </button>
      </div>
      {mutation.error && <p className="text-destructive">{mutation.error.message}</p>}
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ values: p }, { onSuccess: (saved) => setP(saved) })}
        className="block rounded-lg bg-primary px-4 py-2 text-primary-foreground"
      >
        Сохранить
      </button>
    </section>
  );
}
