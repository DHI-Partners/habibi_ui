import { CalendarPlus, Copy, Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ru } from "react-day-picker/locale";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import type { CabinetSection } from "../../../shared/types/api";
import { Button } from "../../../shared/ui/button";
import { Calendar } from "../../../shared/ui/calendar";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Skeleton } from "../../../shared/ui/skeleton";
import { Switch } from "../../../shared/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "../../../shared/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../../../shared/ui/toggle-group";
import { useSectionBack } from "../nav";
import { ErrorNote, Page, ResponsiveModal, SectionTitle, surface } from "../ui";
import { type Exception, type Slot, useHours } from "./api";
import {
  dayError,
  fromServer,
  type Interval,
  KIND_DELIVERY,
  KIND_WORK,
  maskTime,
  normalizeTime,
  SHORT,
  TIME_RE,
  toServer,
  WEEKDAYS,
} from "./hours";

// Экран — представление над той же моделью Working Hours Slot (weekday, kind,
// opens, closes): «Когда открыты» — интервалы вида «Работа»; «Доставка: в часы
// работы» — интервалов «Доставка» нет вовсе (бот тогда берёт часы работы, см.
// habibi_ai/tools/hours.py closed_warning); «свои часы» — интервалы «Доставка».
// Раньше владелец выбирал вид на каждом интервале — и не понимал, что это.

// Ключи React-списков — свой счётчик, а не индекс массива: индекс меняется
// при удалении строки посередине и путает reconciliation (фокус/значение
// не той строки). _id — только на клиенте, перед отправкой на сервер снимается.
let idSeq = 0;
const nextId = () => ++idSeq;

type Week = Interval[][];
type ExceptionRow = { _id: number; date: string; closed: boolean; opens: string; closes: string; note: string };

const DEFAULT: [string, string] = ["10:00", "22:00"];
const emptyWeek = (): Week => WEEKDAYS.map(() => []);

function weekOf(slots: Slot[], kind: string): Week {
  const week = emptyWeek();
  for (const s of slots) {
    const day = WEEKDAYS.indexOf(s.weekday);
    if (s.kind === kind && day >= 0) week[day].push({ _id: nextId(), opens: fromServer(s.opens), closes: fromServer(s.closes) });
  }
  for (const day of week) day.sort((a, b) => a.opens.localeCompare(b.opens));
  return week;
}

const slotsOf = (week: Week, kind: string): Slot[] =>
  week.flatMap((day, i) =>
    day.map((iv) => ({ weekday: WEEKDAYS[i], kind, opens: toServer(iv.opens), closes: toServer(iv.closes) })),
  );

const copyWeek = (week: Week): Week => week.map((day) => day.map((iv) => ({ ...iv, _id: nextId() })));

const exceptionRows = (rows: Exception[]): ExceptionRow[] =>
  rows.map((r) => ({
    _id: nextId(),
    date: r.date,
    closed: Boolean(r.closed),
    opens: fromServer(r.opens),
    closes: fromServer(r.closes),
    note: r.note ?? "",
  }));

export function HoursScreen({ section }: { section: CabinetSection }) {
  const { query, mutation } = useHours();
  const back = useSectionBack(section.key);
  const [work, setWork] = useState<Week>(emptyWeek);
  const [delivery, setDelivery] = useState<Week>(emptyWeek);
  const [ownDelivery, setOwnDelivery] = useState(false);
  // Строки неизвестного вида (если доктайп когда-то получит третий kind) не
  // показываем, но и не теряем: уходят на сервер как пришли.
  const [other, setOther] = useState<Slot[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [editing, setEditing] = useState<ExceptionRow | null>(null);
  const [breakOpen, setBreakOpen] = useState(false);

  const seed = (data: { schedule: Slot[]; exceptions: Exception[] }) => {
    setWork(weekOf(data.schedule, KIND_WORK));
    const own = data.schedule.some((s) => s.kind === KIND_DELIVERY);
    setDelivery(weekOf(data.schedule, KIND_DELIVERY));
    setOwnDelivery(own);
    setOther(data.schedule.filter((s) => s.kind !== KIND_WORK && s.kind !== KIND_DELIVERY));
    setExceptions(exceptionRows(data.exceptions));
  };

  // Сеем форму только раз, при первой загрузке — иначе рефетч под открытым
  // экраном (staleTime по умолчанию 0, фокус окна, инвалидация из
  // useRealtime) стирал бы то, что владелец уже успел изменить. После
  // сохранения расписание обновляется явно, из ответа мутации.
  const seededRef = useRef(false);
  useEffect(() => {
    if (query.data && !seededRef.current) {
      seed(query.data);
      seededRef.current = true;
    }
  }, [query.data]);

  const workErrors = work.map(dayError);
  const deliveryErrors = delivery.map(dayError);
  const invalid = workErrors.some(Boolean) || (ownDelivery && deliveryErrors.some(Boolean));
  // date — обязательное поле Working Hours Exception: пустая строка на
  // сервере провалит save() с малопонятной ошибкой. Лучше не дать сохранить
  // вовсе, чем молча выбросить недописанную строку владельца.
  const hasEmptyExceptionDate = exceptions.some((ex) => !ex.date);

  const save = () =>
    mutation.mutate(
      {
        schedule: [...slotsOf(work, KIND_WORK), ...(ownDelivery ? slotsOf(delivery, KIND_DELIVERY) : []), ...other],
        exceptions: exceptions.map((ex) => ({
          date: ex.date,
          closed: ex.closed ? 1 : 0,
          opens: ex.closed ? "" : toServer(ex.opens),
          closes: ex.closed ? "" : toServer(ex.closes),
          note: ex.note,
        })),
      },
      {
        onSuccess: (saved) => {
          seed(saved);
          toast.success("Режим работы сохранён");
        },
      },
    );

  if (query.isPending) {
    return (
      <Page title={section.label} back={back} backMobileOnly width="narrow">
        <div className="space-y-2">
          {WEEKDAYS.map((d) => (
            <Skeleton key={d} className="h-12 rounded-lg" />
          ))}
        </div>
      </Page>
    );
  }
  if (query.error) {
    return (
      <Page title={section.label} back={back} backMobileOnly width="narrow">
        <ErrorNote title="Не удалось загрузить режим работы">{query.error.message}</ErrorNote>
      </Page>
    );
  }

  const footer = (
    <div className="space-y-2 md:flex md:items-center md:gap-3 md:space-y-0">
      {(invalid || hasEmptyExceptionDate) && (
        <p className="text-center text-xs text-destructive md:text-right">Исправьте выделенное, чтобы сохранить</p>
      )}
      <Button
        onClick={save}
        disabled={mutation.isPending || invalid || hasEmptyExceptionDate}
        className="h-12 w-full text-[15px] font-semibold md:h-9 md:w-auto md:px-5 md:text-sm"
      >
        {mutation.isPending && <Loader2 className="animate-spin" />}
        Сохранить
      </Button>
    </div>
  );

  const sortedExceptions = [...exceptions].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Page
      title={section.label}
      subtitle={query.data?.time_zone ? `Часовой пояс: ${query.data.time_zone}` : undefined}
      back={back}
      backMobileOnly
      footer={footer}
      width="narrow"
    >
      <div className="space-y-7">
        {mutation.error && <ErrorNote title="Не сохранилось">{mutation.error.message}</ErrorNote>}

        <section className="space-y-2">
          <SectionTitle>Когда вы открыты</SectionTitle>
          <WeekEditor week={work} errors={workErrors} onChange={setWork} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              className="h-9 bg-card"
              disabled={work[0].length === 0}
              onClick={() =>
                setWork((w) => w.map((day, i) => (i >= 1 && i <= 4 ? w[0].map((iv) => ({ ...iv, _id: nextId() })) : day)))
              }
            >
              <Copy />
              Пн → все будни
            </Button>
            <Button variant="outline" className="h-9 bg-card" onClick={() => setBreakOpen(true)}>
              <Plus />
              перерыв
            </Button>
          </div>
        </section>

        <section className="space-y-2.5">
          <SectionTitle>Доставка</SectionTitle>
          <Tabs
            value={ownDelivery ? "own" : "same"}
            onValueChange={(v) => {
              const own = v === "own";
              // Впервые «свои часы» — начинаем с копии часов работы, а не с
              // пустой недели: обычно доставка лишь немного короче.
              if (own && delivery.every((d) => d.length === 0)) setDelivery(copyWeek(work));
              setOwnDelivery(own);
            }}
          >
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="same" className="text-[13px]">
                В часы работы
              </TabsTrigger>
              <TabsTrigger value="own" className="text-[13px]">
                Свои часы
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {ownDelivery ? (
            <>
              <WeekEditor week={delivery} errors={deliveryErrors} onChange={setDelivery} closedLabel="без доставки" />
              <p className="text-[13px] text-muted-foreground">
                Бот назовёт эти часы, когда спросят про доставку. В дни без доставки — только самовывоз.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Бот скажет клиенту, что доставка работает, пока вы открыты.</p>
          )}
        </section>

        <section className="space-y-2.5">
          <SectionTitle
            action={
              <Button
                variant="ghost"
                className="h-9 px-2 text-primary hover:text-primary"
                onClick={() => setEditing({ _id: nextId(), date: "", closed: true, opens: "", closes: "", note: "" })}
              >
                <Plus />
                добавить
              </Button>
            }
          >
            Особые дни
          </SectionTitle>
          {sortedExceptions.length === 0 ? (
            <button
              type="button"
              onClick={() => setEditing({ _id: nextId(), date: "", closed: true, opens: "", closes: "", note: "" })}
              className={cn(surface, "flex w-full items-center gap-3 border-dashed px-4 py-4 text-left text-sm text-muted-foreground hover:bg-muted/40")}
            >
              <CalendarPlus className="size-5" />
              Праздники и сокращённые дни — бот предупредит клиентов заранее
            </button>
          ) : (
            <div className="space-y-2">
              {sortedExceptions.map((ex) => (
                <ExceptionCard
                  key={ex._id}
                  row={ex}
                  onEdit={() => setEditing(ex)}
                  onRemove={() => setExceptions((rows) => rows.filter((r) => r._id !== ex._id))}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <ExceptionDialog
        row={editing}
        taken={exceptions.filter((r) => r._id !== editing?._id).map((r) => r.date)}
        onClose={() => setEditing(null)}
        onSave={(row) => {
          setExceptions((rows) => (rows.some((r) => r._id === row._id) ? rows.map((r) => (r._id === row._id ? row : r)) : [...rows, row]));
          setEditing(null);
        }}
      />
      <BreakDialog
        open={breakOpen}
        week={work}
        onClose={() => setBreakOpen(false)}
        onApply={(next, changed) => {
          setWork(next);
          setBreakOpen(false);
          if (changed) toast.success(`Перерыв добавлен: ${changed} ${changed === 1 ? "день" : changed < 5 ? "дня" : "дней"}`);
          else toast.info("Перерыв не попал ни в один интервал выбранных дней");
        }}
      />
    </Page>
  );
}

function WeekEditor(props: {
  week: Week;
  errors: ReturnType<typeof dayError>[];
  onChange: (update: (week: Week) => Week) => void;
  closedLabel?: string;
}) {
  // Выключили день и передумали — вернуть те же часы, а не 10–22.
  const lastRef = useRef<Record<number, Interval[]>>({});
  const setDay = (day: number, next: Interval[]) => props.onChange((w) => w.map((d, i) => (i === day ? next : d)));

  return (
    <div className={cn(surface, "divide-y px-4")}>
      {props.week.map((intervals, day) => {
        const open = intervals.length > 0;
        const error = props.errors[day];
        const multi = intervals.length > 1;
        return (
          <div key={day} className="py-2">
            <div className="flex min-h-9 items-start gap-3">
              <span className="w-7 pt-2 text-sm font-medium">{SHORT[day]}</span>
              <Switch
                className="mt-2.5"
                checked={open}
                aria-label={`${SHORT[day]}: ${open ? "открыто" : props.closedLabel ?? "выходной"}`}
                onCheckedChange={(on) => {
                  if (on) {
                    const remembered = lastRef.current[day];
                    const neighbour = props.week.find((d) => d.length > 0)?.[0];
                    const [o, c] = neighbour ? [neighbour.opens, neighbour.closes] : DEFAULT;
                    setDay(day, remembered?.length ? remembered : [{ _id: nextId(), opens: o, closes: c }]);
                  } else {
                    lastRef.current[day] = intervals;
                    setDay(day, []);
                  }
                }}
              />
              <div className="ml-auto flex flex-col items-end gap-1.5">
                {open ? (
                  intervals.map((iv, k) => (
                    <div key={iv._id} className="flex items-center gap-1.5">
                      <TimeInput
                        value={iv.opens}
                        label={`${SHORT[day]}: с`}
                        invalid={Boolean(error?.ids.has(iv._id))}
                        onChange={(v) => setDay(day, intervals.map((x) => (x._id === iv._id ? { ...x, opens: v } : x)))}
                      />
                      <span className="text-muted-foreground">–</span>
                      <TimeInput
                        value={iv.closes}
                        label={`${SHORT[day]}: до`}
                        invalid={Boolean(error?.ids.has(iv._id))}
                        onChange={(v) => setDay(day, intervals.map((x) => (x._id === iv._id ? { ...x, closes: v } : x)))}
                      />
                      {multi &&
                        (k > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Убрать интервал"
                            className="text-muted-foreground"
                            onClick={() => setDay(day, intervals.filter((x) => x._id !== iv._id))}
                          >
                            <X />
                          </Button>
                        ) : (
                          <span className="size-8" aria-hidden />
                        ))}
                    </div>
                  ))
                ) : (
                  <span className="pt-2 text-sm text-muted-foreground">{props.closedLabel ?? "выходной"}</span>
                )}
              </div>
            </div>
            {error && <p className="pt-1 text-right text-xs text-destructive">{error.message}</p>}
          </div>
        );
      })}
    </div>
  );
}

function TimeInput(props: { value: string; label: string; invalid?: boolean; onChange: (v: string) => void }) {
  return (
    <Input
      value={props.value}
      inputMode="numeric"
      maxLength={5}
      placeholder="ЧЧ:ММ"
      aria-label={props.label}
      aria-invalid={props.invalid || undefined}
      onChange={(e) => props.onChange(maskTime(e.target.value))}
      onBlur={(e) => props.onChange(normalizeTime(e.target.value))}
      className="h-9 w-16 px-1 text-center text-sm tabular-nums"
    />
  );
}

const MONTH_SHORT = new Intl.DateTimeFormat("ru-RU", { month: "short" });
const LONG = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", weekday: "short" });

function parseDate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function ExceptionCard({ row, onEdit, onRemove }: { row: ExceptionRow; onEdit: () => void; onRemove: () => void }) {
  const date = parseDate(row.date);
  const hours = row.opens && row.closes ? `${row.opens} – ${row.closes}` : "Обычные часы";
  return (
    <div className={cn(surface, "flex items-center gap-3 p-3")}>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1">
          <span className="text-[11px] text-muted-foreground">{date ? MONTH_SHORT.format(date).replace(".", "") : "—"}</span>
          <span className="text-lg leading-6 font-semibold tabular-nums">{date ? date.getDate() : "?"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{row.note || "Особый день"}</div>
          <div className={cn("text-[13px]", row.closed ? "text-destructive" : "text-muted-foreground")}>
            {!row.date ? "Укажите дату" : row.closed ? "Закрыто" : hours}
          </div>
        </div>
      </button>
      <Button variant="ghost" size="icon-lg" aria-label="Удалить" className="text-muted-foreground" onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}

function ExceptionDialog(props: {
  row: ExceptionRow | null;
  taken: string[];
  onClose: () => void;
  onSave: (row: ExceptionRow) => void;
}) {
  const [draft, setDraft] = useState<ExceptionRow | null>(props.row);
  useEffect(() => setDraft(props.row), [props.row]);
  const d = draft;
  const selected = d?.date ? parseDate(d.date) : undefined;
  const timesBad = d && !d.closed && (!TIME_RE.test(d.opens) || !TIME_RE.test(d.closes) || d.opens === d.closes);
  const duplicate = d?.date && props.taken.includes(d.date);

  return (
    <ResponsiveModal
      open={props.row !== null}
      onOpenChange={(open) => !open && props.onClose()}
      title={props.row?.date ? "Особый день" : "Новый особый день"}
      description="Праздник, санитарный день или сокращённые часы."
    >
      {d && (
        <div className="space-y-4">
          <div className="flex justify-center rounded-xl border">
            <Calendar
              mode="single"
              locale={ru}
              selected={selected}
              defaultMonth={selected}
              onSelect={(day) => day && setDraft({ ...d, date: iso(day) })}
              className="[--cell-size:--spacing(9)]"
            />
          </div>
          {selected && <p className="-mt-2 text-center text-[13px] text-muted-foreground">{LONG.format(selected)}</p>}
          <div className="space-y-2">
            <Label htmlFor="exc-note" className="text-[13px] text-muted-foreground">
              Название
            </Label>
            <Input
              id="exc-note"
              value={d.note}
              placeholder="Например, Новый год"
              onChange={(e) => setDraft({ ...d, note: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="exc-closed" className="flex-1 text-sm font-medium">
              Закрыто весь день
            </Label>
            <Switch id="exc-closed" checked={d.closed} onCheckedChange={(on) => setDraft({ ...d, closed: on })} />
          </div>
          {!d.closed && (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm">Часы работы</span>
              <TimeInput value={d.opens} label="Открытие" invalid={Boolean(timesBad && d.opens)} onChange={(v) => setDraft({ ...d, opens: v })} />
              <span className="text-muted-foreground">–</span>
              <TimeInput value={d.closes} label="Закрытие" invalid={Boolean(timesBad && d.closes)} onChange={(v) => setDraft({ ...d, closes: v })} />
            </div>
          )}
          {duplicate && <p className="text-xs text-destructive">На эту дату особый день уже есть</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 md:h-9" onClick={props.onClose}>
              Отмена
            </Button>
            <Button className="h-11 md:h-9" disabled={!d.date || Boolean(timesBad) || Boolean(duplicate)} onClick={() => props.onSave(d)}>
              Готово
            </Button>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Перерыв делит интервал дня на два: 10:00–22:00 и перерыв 14:00–15:00 →
// 10:00–14:00 и 15:00–22:00. Дни, где перерыв не внутри интервала, не трогаем.
function BreakDialog(props: { open: boolean; week: Week; onClose: () => void; onApply: (week: Week, changed: number) => void }) {
  const [from, setFrom] = useState("14:00");
  const [to, setTo] = useState("15:00");
  const openDays = props.week.map((d, i) => (d.length ? String(i) : "")).filter(Boolean);
  const [days, setDays] = useState<string[]>(openDays);
  useEffect(() => {
    if (props.open) setDays(props.week.map((d, i) => (d.length ? String(i) : "")).filter(Boolean));
  }, [props.open, props.week]);
  const bad = !TIME_RE.test(from) || !TIME_RE.test(to) || toMin(to) <= toMin(from);

  const apply = () => {
    let changed = 0;
    const [bs, be] = [toMin(from), toMin(to)];
    const next = props.week.map((day, i) => {
      if (!days.includes(String(i))) return day;
      let hit = false;
      const out = day.flatMap((iv) => {
        if (!TIME_RE.test(iv.opens) || !TIME_RE.test(iv.closes)) return [iv];
        const start = toMin(iv.opens);
        let end = toMin(iv.closes);
        if (end <= start) end += 24 * 60;
        if (start < bs && be < end) {
          hit = true;
          return [
            { _id: iv._id, opens: iv.opens, closes: fromMin(bs) },
            { _id: nextId(), opens: fromMin(be), closes: iv.closes },
          ];
        }
        return [iv];
      });
      if (hit) changed++;
      return out;
    });
    props.onApply(next, changed);
  };

  return (
    <ResponsiveModal
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      title="Перерыв"
      description="Бот не будет обещать заказ на это время."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm">Время перерыва</span>
          <TimeInput value={from} label="Перерыв с" invalid={bad} onChange={setFrom} />
          <span className="text-muted-foreground">–</span>
          <TimeInput value={to} label="Перерыв до" invalid={bad} onChange={setTo} />
        </div>
        <div className="space-y-2">
          <div className="text-[13px] font-medium text-muted-foreground">В какие дни</div>
          <ToggleGroup multiple value={days} onValueChange={setDays} variant="outline" spacing={1} className="grid w-full grid-cols-7">
            {SHORT.map((label, i) => (
              <ToggleGroupItem
                key={label}
                value={String(i)}
                disabled={props.week[i].length === 0}
                className="h-9 w-full px-0 text-[13px] data-[pressed]:border-primary data-[pressed]:bg-primary/10 data-[pressed]:text-primary"
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={props.onClose}>
            Отмена
          </Button>
          <Button className="h-11 md:h-9" disabled={bad || days.length === 0} onClick={apply}>
            Добавить
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
