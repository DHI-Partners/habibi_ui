import { Loader2, MessageCircle, MessageSquareText, Store, Trash2, Truck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { cn } from "../../../shared/lib/utils";
import type { CabinetSection } from "../../../shared/types/api";
import { Button, buttonVariants } from "../../../shared/ui/button";
import { Skeleton } from "../../../shared/ui/skeleton";
import { Textarea } from "../../../shared/ui/textarea";
import { clock, dateLabel, fulfilmentLabel, money, parseSiteDate, stateBadge, type Tone } from "../format";
import { EmptyState, ErrorNote, InitialAvatar, Page, ResponsiveModal, StatusBadge, surface, WarningNote } from "../ui";
import {
  DISCARD_ACTION,
  type Notify,
  type OrderAction,
  type OrderDetails,
  type StateKind,
  useApplyAction,
  useNotify,
  useOrderActions,
  useOrderDetails,
} from "./api";

const LABELS: Record<string, string> = { accept: "Принять", reject: "Отклонить" };

// Быстрые причины отказа — они уходят в шаблон сообщения клиенту
// (order_rejected, переменная reason). Своя причина — полем ниже.
const REASONS = ["Закончилась позиция", "Не возим в этот район", "Скоро закрываемся", "Слишком большая загрузка"];

// Цвет бейджа — по смыслу состояния (state_kind с сервера), а не по его имени:
// имена состояний у воркфлоу каждого сайта свои. Подпись — перевод известных
// имён (stateBadge), незнакомое имя показывается как есть.
const KIND_TONE: Record<StateKind, Tone> = { new: "new", accepted: "ok", rejected: "bad", other: "progress" };
const KIND_LABEL: Record<StateKind, string> = { new: "Новый", accepted: "Принят", rejected: "Отклонён", other: "" };

// Переписки — раздел chats из пресета; открытый чат ChatsScreen берёт из ?chat=.
const chatHref = (chat: string) => `/c/chats?chat=${encodeURIComponent(chat)}`;

type Step =
  | { kind: "confirm-reject"; action: OrderAction }
  | { kind: "notify"; draft: Notify }
  | null;

export function OrderScreen({ section, name }: { section: CabinetSection; name: string }) {
  const details = useOrderDetails(name);
  const actions = useOrderActions(name);
  const apply = useApplyAction(name);
  const notify = useNotify(name);
  const [step, setStep] = useState<Step>(null);
  const [reason, setReason] = useState("");
  // discard (см. DISCARD_ACTION в api.ts) удаляет черновик заказа на сервере —
  // документа больше нет, а order-actions/order-details(name) больше не
  // перечитываются (api.ts не инвалидирует их после discard). discarded —
  // единственный явный сигнал «заказа больше нет»: TanStack Query после ошибки
  // рефетча оставляет старые data нетронутыми (isRefetchError сохраняет data),
  // так что сами кнопки остались бы кликабельными и рабочими — их нужно прятать
  // явным флагом, а не выводить из actions.isError/actions.data.
  const [discarded, setDiscarded] = useState(false);

  const back = `/c/${section.key}`;
  const data = details.data;
  const customer = data?.customer_name ?? "";

  const [stateLabel, tone]: [string, Tone] = discarded
    ? ["Отклонён", "bad"]
    : data
      ? [stateBadge(data.state)[0] || KIND_LABEL[data.state_kind], KIND_TONE[data.state_kind]]
      : ["", "neutral"];
  // Как в макете: «Отклонить» слева, «Принять» справа, прочие переходы — между.
  const ORDER = { reject: 0, other: 1, accept: 2 };
  const available = !discarded ? [...(actions.data?.actions ?? [])].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]) : [];
  const canNotify = actions.data?.can_notify ?? false;
  // Новый заказ, а принять нельзя: переходы воркфлоу разрешены своим ролям
  // (на проде — Burger Order Desk), и без такой роли сервер их не отдаёт.
  const noRights =
    !discarded && data?.state_kind === "new" && actions.data !== undefined && !available.some((a) => a.kind === "accept");

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

  const title = data ? `Заказ №${data.number}` : "Заказ";
  const badge = stateLabel && <StatusBadge tone={tone}>{stateLabel}</StatusBadge>;

  if (details.isPending && !discarded) {
    return (
      <Page title={title} back={back} width="narrow">
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
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
          <ErrorNote title="Не удалось открыть заказ">{details.error?.message}</ErrorNote>
        )}
      </Page>
    );
  }

  const created = parseSiteDate(data.created);
  const subtitle = [
    created ? `${dateLabel(data.created)}, ${clock(created)}` : "",
    data.source ? `из ${data.source}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
    <Page title={title} subtitle={subtitle} back={back} actions={badge} footer={footer} width="narrow">
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
        {noRights && <WarningNote>Нет прав на действия с заказом — обратитесь к администратору</WarningNote>}

        <CustomerCard data={data} />
        <Lines data={data} />
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

/** Карточка клиента по макету: аватар, имя, телефон, «Переписка»; ниже — получение. */
function CustomerCard({ data }: { data: OrderDetails }) {
  const customer = data.customer_name ?? "";
  const phone = data.phone ?? "";
  const fulfilment = fulfilmentLabel(data.fulfilment);
  // Вторая строка блока получения: адрес и пожелание клиента — как в макете
  // «Абая 150, кв 12 · «без лука»».
  const detail = [data.address?.replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]*>/g, "").trim(), data.notes && `«${data.notes}»`]
    .filter(Boolean)
    .join(" · ");
  if (!customer && !phone && !fulfilment && !detail && !data.chat) return null;
  const Icon = data.fulfilment === "Pickup" ? Store : fulfilment ? Truck : MessageSquareText;

  return (
    <section className={cn(surface, "space-y-3 p-4")}>
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
        {data.chat && (
          <Link to={chatHref(data.chat)} className={cn(buttonVariants({ variant: "outline" }), "h-9 shrink-0 gap-1.5 px-3 text-[13px]")}>
            <MessageCircle className="size-4" />
            Переписка
          </Link>
        )}
      </div>
      {(fulfilment || detail) && (
        <div className="flex items-start gap-2.5 rounded-lg bg-muted px-3 py-2.5">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-0.5">
            {fulfilment && (
              <div className="text-sm font-medium">
                {fulfilment}
                {data.zone && ` · зона «${data.zone}»`}
              </div>
            )}
            {detail && <div className="text-[13px] break-words text-muted-foreground">{detail}</div>}
          </div>
        </div>
      )}
    </section>
  );
}

/** Состав: позиции × количество, доставка отдельной строкой, «Итого» крупно. */
function Lines({ data }: { data: OrderDetails }) {
  // Символ — валюты самого заказа (у бизнеса она бывает не той, что у компании
  // по умолчанию); разряды — ru-RU, как во всём кабинете.
  const sum = (value: number) => `${money(value)} ${data.currency_symbol}`;
  return (
    <section className={cn(surface, "divide-y")}>
      {data.items.map((item, i) => (
        <div key={i} className="flex items-baseline gap-3 px-4 py-3.5 text-sm">
          <span className="min-w-0 flex-1 break-words">{item.item_name}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">× {money(item.qty)}</span>
          <span className="w-24 shrink-0 text-right tabular-nums">{sum(item.amount)}</span>
        </div>
      ))}
      {data.delivery && (
        <div className="flex items-baseline gap-3 px-4 py-3.5 text-sm">
          <span className="min-w-0 flex-1 break-words text-muted-foreground">{data.delivery.label}</span>
          <span className="w-24 shrink-0 text-right tabular-nums">
            {data.delivery.amount ? sum(data.delivery.amount) : "бесплатно"}
          </span>
        </div>
      )}
      <div className="flex items-baseline gap-3 px-4 py-3.5">
        <span className="flex-1 text-[15px] font-semibold">Итого</span>
        <span className="text-lg font-bold tabular-nums">{sum(data.total)}</span>
      </div>
    </section>
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
