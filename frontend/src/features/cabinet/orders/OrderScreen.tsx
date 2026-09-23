import { Loader2, MessageSquareText, Store, Trash2, Truck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import type { CabinetSection } from "../../../shared/types/api";
import { Button, buttonVariants } from "../../../shared/ui/button";
import { Skeleton } from "../../../shared/ui/skeleton";
import { Textarea } from "../../../shared/ui/textarea";
import { useSectionDoc } from "../api";
import { formatValue } from "../FieldInput";
import { fulfilmentLabel, money, shortNo, stateBadge } from "../format";
import { EmptyState, ErrorNote, InitialAvatar, Page, ResponsiveModal, StatusBadge, surface } from "../ui";
import { DISCARD_ACTION, type Notify, type OrderAction, useApplyAction, useNotify, useOrderActions } from "./api";

const LABELS: Record<string, string> = { accept: "Принять", reject: "Отклонить" };

// Быстрые причины отказа — они уходят в шаблон сообщения клиенту
// (order_rejected, переменная reason). Своя причина — полем ниже.
const REASONS = ["Закончилась позиция", "Не возим в этот район", "Скоро закрываемся", "Слишком большая загрузка"];

// Поля заказа, которые экран раскладывает по своим местам (карточка клиента,
// блок получения, итог). Остальные поля раздела — строками «подпись — значение»,
// чтобы пресет мог добавить своё и оно не потерялось.
const PLACED = new Set([
  "name",
  "customer_name",
  "custom_whatsapp_number",
  "custom_fulfilment_type",
  "custom_delivery_zone",
  "custom_kitchen_notes",
  "grand_total",
]);

type Step =
  | { kind: "confirm-reject"; action: OrderAction }
  | { kind: "notify"; draft: Notify }
  | null;

export function OrderScreen({ section, name }: { section: CabinetSection; name: string }) {
  const doc = useSectionDoc(section.key, name);
  const actions = useOrderActions(name);
  const apply = useApplyAction(name);
  const notify = useNotify(name);
  const [step, setStep] = useState<Step>(null);
  const [reason, setReason] = useState("");
  // discard (см. DISCARD_ACTION в api.ts) удаляет черновик заказа на сервере —
  // документа больше нет, а order-actions(name) больше не перечитывается (api.ts
  // не инвалидирует её после discard). discarded — единственный явный сигнал
  // «заказа больше нет»: TanStack Query после ошибки рефетча оставляет старые
  // actions.data нетронутыми (isRefetchError сохраняет data), так что сами кнопки
  // остались бы кликабельными и рабочими — их нужно прятать явным флагом, а не
  // выводить из actions.isError/actions.data.
  const [discarded, setDiscarded] = useState(false);

  const back = `/c/${section.key}`;
  const data = doc.data;
  const fields = new Map(section.form_fields.map((f) => [f.fieldname, f]));
  const val = (fieldname: string) => (fields.has(fieldname) && data ? data[fieldname] : undefined);
  const customer = String(val("customer_name") ?? "");
  const phone = String(val("custom_whatsapp_number") ?? "");
  const fulfilment = fulfilmentLabel(val("custom_fulfilment_type"));
  const zone = String(val("custom_delivery_zone") ?? "");
  const notes = String(val("custom_kitchen_notes") ?? "");
  const total = val("grand_total");
  const extra = section.form_fields.filter((f) => !PLACED.has(f.fieldname));

  const state = discarded ? "Отклонён" : actions.data?.state;
  const [stateLabel, tone] = stateBadge(state);
  // Как в макете: «Отклонить» слева, «Принять» справа, прочие переходы — между.
  const ORDER = { reject: 0, other: 1, accept: 2 };
  const available = !discarded ? [...(actions.data?.actions ?? [])].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]) : [];
  const canNotify = actions.data?.can_notify ?? false;

  const run = (action: OrderAction, why = "") =>
    apply.mutate(
      { action: action.action, reason: why },
      {
        onSuccess: (r) => {
          if (action.action === DISCARD_ACTION) setDiscarded(true);
          if (r.notify) {
            notify.reset();
            setStep({ kind: "notify", draft: r.notify });
          } else {
            setStep(null);
            toast.success(action.kind === "reject" ? "Заказ отклонён" : action.kind === "accept" ? "Заказ принят" : "Готово");
          }
        },
        onError: (e) => toast.error(e.message),
      },
    );

  const onAction = (a: OrderAction) => {
    // Отказ — необратим (без воркфлоу черновик удаляется), поэтому сначала
    // подтверждение, а заодно и причина для сообщения клиенту.
    if (a.kind === "reject") {
      setReason("");
      setStep({ kind: "confirm-reject", action: a });
    } else {
      run(a);
    }
  };

  const title = `Заказ ${shortNo(name)}`;
  const badge = stateLabel && <StatusBadge tone={tone}>{stateLabel}</StatusBadge>;

  if (doc.isPending && !discarded) {
    return (
      <Page title={title} back={back} width="narrow">
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page title={title} back={back} width="narrow">
        {discarded ? (
          <EmptyState icon={Trash2} text="Заказ отклонён и удалён" action={<BackLink to={back} />} />
        ) : (
          <ErrorNote title="Не удалось открыть заказ">{doc.error?.message}</ErrorNote>
        )}
      </Page>
    );
  }

  const footer = available.length > 0 && (
    <div className={cn("grid gap-2 md:flex", available.length > 1 && "grid-cols-2")}>
      {available.map((a) => (
        <Button
          key={a.action}
          variant={a.kind === "accept" ? "default" : "outline"}
          disabled={apply.isPending}
          onClick={() => onAction(a)}
          className={cn(
            "h-12 text-[15px] font-semibold md:h-9 md:min-w-32 md:text-sm",
            a.kind === "reject" && "text-destructive hover:text-destructive",
          )}
        >
          {apply.isPending && apply.variables?.action === a.action && <Loader2 className="animate-spin" />}
          {a.kind === "other" ? a.action : (LABELS[a.kind] ?? a.action)}
        </Button>
      ))}
    </div>
  );

  return (
    <Page
      title={title}
      subtitle={[name !== shortNo(name) ? name : "", canNotify ? "из Telegram" : ""].filter(Boolean).join(" · ")}
      back={back}
      actions={badge}
      footer={footer}
      width="narrow"
    >
      <div className="space-y-3">
        {discarded && (
          <div className={cn(surface, "flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground")}>
            <Trash2 className="size-4" />
            <span className="flex-1">Заказ отклонён — черновик удалён.</span>
            <BackLink to={back} />
          </div>
        )}
        {actions.isError && !actions.data && !discarded && (
          <ErrorNote title="Действия с заказом недоступны">{actions.error.message}</ErrorNote>
        )}

        {(customer || phone || fulfilment || notes) && (
          <section className={cn(surface, "space-y-3 p-4")}>
            {(customer || phone) && (
              <div className="flex items-center gap-3">
                <InitialAvatar name={customer || phone} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{customer || "Клиент"}</div>
                  {phone && (
                    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-[13px] text-muted-foreground hover:underline">
                      {phone}
                    </a>
                  )}
                </div>
              </div>
            )}
            {(fulfilment || notes) && (
              <div className="flex items-start gap-2.5 rounded-lg bg-muted px-3 py-2.5">
                {fields.get("custom_fulfilment_type") && val("custom_fulfilment_type") === "Pickup" ? (
                  <Store className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : fulfilment ? (
                  <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 space-y-0.5">
                  {fulfilment && (
                    <div className="text-sm font-medium">
                      {fulfilment}
                      {zone && ` · зона «${zone}»`}
                    </div>
                  )}
                  {notes && <div className="text-[13px] break-words text-muted-foreground">«{notes}»</div>}
                </div>
              </div>
            )}
          </section>
        )}

        {(extra.length > 0 || total !== undefined) && (
          <section className={cn(surface, "divide-y")}>
            {extra.map((f) => (
              <Line key={f.fieldname} label={f.label}>
                {formatValue(f, data[f.fieldname]) || "—"}
              </Line>
            ))}
            {total !== undefined && (
              <div className="flex items-baseline gap-3 px-4 py-3.5">
                <span className="flex-1 text-[15px] font-semibold">Итого</span>
                <span className="text-lg font-bold tabular-nums">{money(total)}</span>
              </div>
            )}
          </section>
        )}
      </div>

      <StepSheet
        step={step}
        customer={customer}
        canNotify={canNotify}
        reason={reason}
        onReason={setReason}
        pendingApply={apply.isPending}
        pendingNotify={notify.isPending}
        notifyError={notify.data && !notify.data.sent ? notify.data.error : notify.error?.message}
        onClose={() => setStep(null)}
        onConfirmReject={(action) => run(action, reason.trim())}
        onDraft={(draft) => setStep({ kind: "notify", draft })}
        onSend={(text) =>
          notify.mutate(
            { text },
            {
              onSuccess: (r) => {
                if (r.sent) {
                  setStep(null);
                  toast.success("Клиент получил сообщение");
                }
              },
            },
          )
        }
      />
    </Page>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3 text-sm">
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="text-right break-words">{children}</span>
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className={buttonVariants({ variant: "outline", size: "sm" })}>
      К заказам
    </Link>
  );
}

type StepProps = {
  step: Step;
  customer: string;
  canNotify: boolean;
  reason: string;
  onReason: (v: string) => void;
  pendingApply: boolean;
  pendingNotify: boolean;
  notifyError: string | null | undefined;
  onClose: () => void;
  onConfirmReject: (action: OrderAction) => void;
  onDraft: (draft: Notify) => void;
  onSend: (text: string) => void;
};

/**
 * Шторка после решения: подтверждение отказа (с причиной) и черновик сообщения
 * клиенту (ResponsiveModal: шторка на телефоне, диалог на десктопе).
 * Закрыть шторку = «Не отправлять»: заказ уже переведён, сообщение — по желанию.
 */
function StepSheet(props: StepProps) {
  const { step } = props;
  const open = step !== null;
  const onOpenChange = (next: boolean) => {
    if (!next) props.onClose();
  };

  let heading: ReactNode = null;
  let description: ReactNode = null;
  let body: ReactNode = null;

  if (step?.kind === "confirm-reject") {
    const discard = step.action.action === DISCARD_ACTION;
    heading = "Отклонить заказ?";
    description = discard
      ? "Черновик заказа будет удалён. Отменить это нельзя."
      : "Заказ перейдёт в отменённые.";
    body = (
      <>
        {props.canNotify && (
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-muted-foreground">Причина — попадёт в сообщение клиенту</div>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => props.onReason(props.reason === r ? "" : r)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] transition-colors",
                    props.reason === r ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              value={props.reason}
              onChange={(e) => props.onReason(e.target.value)}
              placeholder="Или своя причина"
              aria-label="Причина отказа"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12 text-[15px] md:h-9 md:text-sm" onClick={props.onClose}>
            Не отклонять
          </Button>
          <Button
            variant="destructive"
            className="h-12 text-[15px] font-semibold md:h-9 md:text-sm"
            disabled={props.pendingApply}
            onClick={() => props.onConfirmReject(step.action)}
          >
            {props.pendingApply && <Loader2 className="animate-spin" />}
            Отклонить
          </Button>
        </div>
      </>
    );
  } else if (step?.kind === "notify") {
    const reject = step.draft.kind === "reject";
    heading = reject ? "Сообщить об отказе" : "Заказ принят — сообщить клиенту";
    description = `${props.customer || "Клиент"} получит это сообщение в Telegram. Текст можно поправить.`;
    body = (
      <>
        <Textarea
          rows={5}
          value={step.draft.text}
          onChange={(e) => props.onDraft({ ...step.draft, text: e.target.value })}
          aria-label="Сообщение клиенту"
          className="text-[15px] leading-relaxed"
        />
        {props.notifyError && <ErrorNote title="Клиент не уведомлён">{props.notifyError}</ErrorNote>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12 text-[15px] md:h-9 md:text-sm" onClick={props.onClose}>
            Не отправлять
          </Button>
          <Button
            className="h-12 text-[15px] font-semibold md:h-9 md:text-sm"
            disabled={props.pendingNotify || !step.draft.text.trim()}
            onClick={() => props.onSend(step.draft.text)}
          >
            {props.pendingNotify && <Loader2 className="animate-spin" />}
            {props.notifyError ? "Повторить" : "Отправить"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={heading} description={description}>
      {body}
    </ResponsiveModal>
  );
}
