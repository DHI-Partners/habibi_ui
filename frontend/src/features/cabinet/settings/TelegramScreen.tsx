import { CheckCircle2, Loader2, Send } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { cn } from "../../../shared/lib/utils";
import type { CabinetSection } from "../../../shared/types/api";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Skeleton } from "../../../shared/ui/skeleton";
import { useSectionBack } from "../nav";
import { ErrorNote, InitialAvatar, Page, ResponsiveModal, StatusBadge, surface, WarningNote } from "../ui";
import { type TelegramStatus, useTelegram } from "./api";

// Сервер отдаёт наивную дату-время сайта «YYYY-MM-DD HH:MM:SS.ffffff»; с
// пробелом вместо T её разбирает не каждый браузер (Safari), поэтому меняем.
function ago(value: string | null): string {
  if (!value) return "сообщений пока не было";
  const at = new Date(value.replace(" ", "T"));
  const minutes = Math.floor((Date.now() - at.getTime()) / 60000);
  if (Number.isNaN(minutes)) return "";
  if (minutes < 1) return "последнее сообщение только что";
  if (minutes < 60) return `последнее сообщение ${minutes} мин назад`;
  if (minutes < 24 * 60) return `последнее сообщение ${Math.floor(minutes / 60)} ч назад`;
  const when = at.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short", hour12: false });
  return `последнее сообщение ${when}`;
}

const wide = "h-11 w-full text-[15px] md:h-9 md:w-auto md:text-sm";

export function TelegramScreen({ section }: { section: CabinetSection }) {
  const { query, requestCode, signIn, disconnect } = useTelegram();
  const back = useSectionBack(section.key);
  const status = query.data;
  // null — владелец ещё не трогал поле: показываем номер с сервера
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  // Номер можно поменять и после отправки кода: пока не вошли, экран снова
  // показывает поле телефона, аккаунт на сервере остаётся тем же.
  const [changingPhone, setChangingPhone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Ошибку шага держим сами: мутации входа сбрасываются сразу после ответа
  // (reset ниже), чтобы код и пароль не жили в их variables, — а вместе с
  // мутацией пропала бы и её ошибка.
  const [error, setError] = useState<string | null>(null);

  const page = (children: ReactNode) => (
    <Page title={section.label} back={back} backMobileOnly width="narrow">
      {children}
    </Page>
  );

  if (query.error) return page(<ErrorNote title="Не удалось узнать состояние Telegram">{query.error.message}</ErrorNote>);
  if (!status) return page(<Skeleton className="h-40 rounded-xl" />);

  const steps = [requestCode, signIn, disconnect];
  const reset = () => {
    steps.forEach((m) => m.reset());
    setError(null);
  };
  const shownError = error ?? disconnect.error?.message ?? null;
  const state = changingPhone && status.state !== "connected" ? "none" : status.state;
  const phoneValue = phone ?? (changingPhone ? "" : (status.phone ?? ""));
  const otherPhone = () => {
    reset();
    setChangingPhone(true);
  };

  const askCode = (value: string) => {
    reset();
    requestCode.mutate(
      { phone: value },
      {
        onSuccess: () => {
          setChangingPhone(false);
          setPhone(null);
          setCode("");
          requestCode.reset();
        },
        onError: (e) => setError(e.message),
      },
    );
  };
  // Код и пароль стираем сразу после отправки — и при успехе, и при ошибке:
  // дольше одного запроса они в интерфейсе не нужны. Мутацию тоже сбрасываем:
  // иначе код/пароль остались бы в её variables.
  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    reset();
    signIn.mutate(
      { code },
      {
        onSettled: (_data, err) => {
          setCode("");
          setError(err ? err.message : null);
          signIn.reset();
        },
      },
    );
  };
  const sendPassword = (e: FormEvent) => {
    e.preventDefault();
    reset();
    signIn.mutate(
      { password },
      {
        onSettled: (_data, err) => {
          setPassword("");
          setError(err ? err.message : null);
          signIn.reset();
        },
      },
    );
  };

  return (
    <Page title={section.label} back={back} backMobileOnly width="narrow">
      <div className="space-y-4">
        {state === "connected" ? (
          <Connected status={status} pending={disconnect.isPending} onAsk={() => setConfirming(true)} />
        ) : (
          <div className={cn(surface, "flex items-start gap-3 p-4")}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="size-5" />
            </span>
            <div className="space-y-1">
              <div className="text-[15px] font-semibold">Подключите Telegram</div>
              <p className="text-sm text-muted-foreground">
                Войдите в Telegram-аккаунт, в который вам пишут клиенты, — бот будет отвечать им от его имени.
              </p>
            </div>
          </div>
        )}

        {state === "error" && status.error && <WarningNote>{status.error}</WarningNote>}

        {(state === "none" || state === "error") && (
          <form
            className={cn(surface, "space-y-4 p-4")}
            onSubmit={(e) => {
              e.preventDefault();
              askCode(phoneValue);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="tg-phone" className="text-[13px] text-muted-foreground">
                Номер телефона аккаунта
              </Label>
              <Input
                id="tg-phone"
                className="h-11 text-[15px] md:h-10"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 700 123 45 67"
                value={phoneValue}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <Button type="submit" className={wide} disabled={!phoneValue.trim() || requestCode.isPending}>
                {requestCode.isPending && <Loader2 className="animate-spin" />}
                {requestCode.isPending ? "Отправляем…" : "Получить код"}
              </Button>
              {changingPhone && (
                <Button
                  type="button"
                  variant="ghost"
                  className={wide}
                  onClick={() => {
                    setChangingPhone(false);
                    setPhone(null);
                  }}
                >
                  Отмена
                </Button>
              )}
            </div>
          </form>
        )}

        {state === "code_sent" && (
          <form className={cn(surface, "space-y-4 p-4")} onSubmit={sendCode}>
            <p className="text-sm">
              Код отправлен на <span className="font-medium whitespace-nowrap">{status.phone}</span> — он придёт в приложение
              Telegram или по SMS.
            </p>
            <div className="space-y-2">
              <Label htmlFor="tg-code" className="text-[13px] text-muted-foreground">
                Код из Telegram
              </Label>
              <Input
                id="tg-code"
                className="h-12 text-center text-xl tracking-[0.4em] tabular-nums md:h-11"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="•••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <Button type="submit" className={wide} disabled={!code || signIn.isPending}>
                {signIn.isPending && <Loader2 className="animate-spin" />}
                {signIn.isPending ? "Входим…" : "Войти"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={wide}
                disabled={requestCode.isPending}
                onClick={() => askCode(status.phone ?? "")}
              >
                Прислать код ещё раз
              </Button>
              <Button type="button" variant="ghost" className={wide} onClick={otherPhone}>
                Другой номер
              </Button>
            </div>
          </form>
        )}

        {state === "password_needed" && (
          <form className={cn(surface, "space-y-4 p-4")} onSubmit={sendPassword}>
            <p className="text-sm">На аккаунте включена двухэтапная проверка — введите её пароль.</p>
            <div className="space-y-2">
              <Label htmlFor="tg-password" className="text-[13px] text-muted-foreground">
                Пароль двухэтапной проверки
              </Label>
              <Input
                id="tg-password"
                className="h-11 text-[15px] md:h-10"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <Button type="submit" className={wide} disabled={!password || signIn.isPending}>
                {signIn.isPending && <Loader2 className="animate-spin" />}
                {signIn.isPending ? "Входим…" : "Войти"}
              </Button>
              <Button type="button" variant="ghost" className={wide} onClick={otherPhone}>
                Другой номер
              </Button>
            </div>
          </form>
        )}

        {shownError && <ErrorNote>{shownError}</ErrorNote>}
      </div>

      <ResponsiveModal
        open={confirming}
        onOpenChange={setConfirming}
        title="Отключить Telegram?"
        description="Бот перестанет отвечать клиентам в Telegram, пока вы не войдёте снова."
      >
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirming(false)}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            className="h-11 md:h-9"
            disabled={disconnect.isPending}
            onClick={() => {
              reset();
              disconnect.mutate({}, { onSettled: () => setConfirming(false) });
            }}
          >
            {disconnect.isPending && <Loader2 className="animate-spin" />}
            {disconnect.isPending ? "Отключаем…" : "Да, отключить"}
          </Button>
        </div>
      </ResponsiveModal>
    </Page>
  );
}

function Connected(props: { status: TelegramStatus; pending: boolean; onAsk: () => void }) {
  const { status } = props;
  const username = status.username && (status.username.startsWith("@") ? status.username : `@${status.username}`);
  return (
    <div className="space-y-3">
      <div className={cn(surface, "space-y-4 p-4")}>
        <div className="flex items-start gap-3">
          <InitialAvatar name={status.full_name || status.phone || "T"} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{status.full_name || "Аккаунт Telegram"}</div>
            {username && <div className="truncate text-[13px] text-muted-foreground">{username}</div>}
            {status.phone && <div className="truncate text-[13px] text-muted-foreground">{status.phone}</div>}
          </div>
          <StatusBadge tone="ok">
            <CheckCircle2 className="size-3" />
            Подключён
          </StatusBadge>
        </div>
        <div className="text-[13px] break-words text-muted-foreground">{ago(status.last_message_at)}</div>
        <Button
          variant="outline"
          className={cn(wide, "text-destructive hover:text-destructive")}
          disabled={props.pending}
          onClick={props.onAsk}
        >
          Отключить
        </Button>
      </div>
      {!status.ai_ready && status.ai_note && <WarningNote>{status.ai_note}</WarningNote>}
      {status.error && <WarningNote>{status.error}</WarningNote>}
    </div>
  );
}
