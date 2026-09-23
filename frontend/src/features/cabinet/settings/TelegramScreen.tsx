import { type FormEvent, useState } from "react";

import { type TelegramStatus, useTelegram } from "./api";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2";
const primary = "w-full rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50 sm:w-auto";
const secondary = "w-full rounded-lg border border-border px-3 py-2 disabled:opacity-50 sm:w-auto";
const warning = "rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900";

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

export function TelegramScreen() {
  const { query, requestCode, signIn, disconnect } = useTelegram();
  const status = query.data;
  // null — владелец ещё не трогал поле: показываем номер с сервера
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  // Номер можно поменять и после отправки кода: пока не вошли, экран снова
  // показывает поле телефона, аккаунт на сервере остаётся тем же.
  const [changingPhone, setChangingPhone] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!status) return null;

  const steps = [requestCode, signIn, disconnect];
  const error = steps.find((m) => m.error)?.error?.message;
  const reset = () => steps.forEach((m) => m.reset());
  const state = changingPhone && status.state !== "connected" ? "none" : status.state;
  const phoneValue = phone ?? (changingPhone ? "" : (status.phone ?? ""));

  const askCode = (value: string) => {
    reset();
    requestCode.mutate(
      { phone: value },
      {
        onSuccess: () => {
          setChangingPhone(false);
          setPhone(null);
          setCode("");
        },
      },
    );
  };
  // Код и пароль стираем сразу после отправки — и при успехе, и при ошибке:
  // дольше одного запроса они в интерфейсе не нужны.
  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    reset();
    signIn.mutate({ code }, { onSettled: () => setCode("") });
  };
  const sendPassword = (e: FormEvent) => {
    e.preventDefault();
    reset();
    signIn.mutate({ password }, { onSettled: () => setPassword("") });
  };

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Telegram</h1>

      {state === "connected" ? (
        <Connected
          status={status}
          confirming={confirming}
          pending={disconnect.isPending}
          onAsk={() => setConfirming(true)}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            reset();
            disconnect.mutate({}, { onSettled: () => setConfirming(false) });
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Войдите в Telegram-аккаунт, в который вам пишут клиенты, — бот будет отвечать им от его имени.
        </p>
      )}

      {state === "error" && status.error && <p className={warning}>{status.error}</p>}

      {(state === "none" || state === "error") && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            askCode(phoneValue);
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Номер телефона аккаунта</span>
            <input
              className={input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 700 123 45 67"
              value={phoneValue}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className={primary} disabled={!phoneValue.trim() || requestCode.isPending}>
              {requestCode.isPending ? "Отправляем…" : "Получить код"}
            </button>
            {changingPhone && (
              <button
                type="button"
                className={secondary}
                onClick={() => {
                  setChangingPhone(false);
                  setPhone(null);
                }}
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      )}

      {state === "code_sent" && (
        <form className="space-y-3" onSubmit={sendCode}>
          <p className="text-sm">Код отправлен на {status.phone} — он придёт в приложение Telegram или по SMS.</p>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Код из Telegram</span>
            <input
              className={input}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className={primary} disabled={!code || signIn.isPending}>
              {signIn.isPending ? "Входим…" : "Войти"}
            </button>
            <button
              type="button"
              className={secondary}
              disabled={requestCode.isPending}
              onClick={() => askCode(status.phone ?? "")}
            >
              Прислать код ещё раз
            </button>
            <button
              type="button"
              className={secondary}
              onClick={() => {
                reset();
                setChangingPhone(true);
              }}
            >
              Другой номер
            </button>
          </div>
        </form>
      )}

      {state === "password_needed" && (
        <form className="space-y-3" onSubmit={sendPassword}>
          <p className="text-sm">На аккаунте включена двухэтапная проверка — введите её пароль.</p>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Пароль двухэтапной проверки</span>
            <input
              className={input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className={primary} disabled={!password || signIn.isPending}>
            {signIn.isPending ? "Входим…" : "Войти"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function Connected(props: {
  status: TelegramStatus;
  confirming: boolean;
  pending: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { status } = props;
  const username = status.username && (status.username.startsWith("@") ? status.username : `@${status.username}`);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border p-4">
        <div className="break-words font-medium">
          Подключён: {status.full_name}
          {username && ` (${username})`}
        </div>
        <div className="break-words text-sm text-muted-foreground">
          {[status.phone, ago(status.last_message_at)].filter(Boolean).join(" · ")}
        </div>
      </div>
      {!status.ai_ready && status.ai_note && <p className={warning}>{status.ai_note}</p>}
      {status.error && <p className={warning}>{status.error}</p>}
      {props.confirming ? (
        <div className="space-y-2 rounded-2xl border border-border p-4">
          <p className="text-sm">Бот перестанет отвечать клиентам в Telegram, пока вы не войдёте снова.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="w-full rounded-lg bg-destructive/10 px-3 py-2 text-destructive disabled:opacity-50 sm:w-auto"
              disabled={props.pending}
              onClick={props.onConfirm}
            >
              {props.pending ? "Отключаем…" : "Да, отключить"}
            </button>
            <button type="button" className={secondary} onClick={props.onCancel}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={secondary} onClick={props.onAsk}>
          Отключить
        </button>
      )}
    </div>
  );
}
