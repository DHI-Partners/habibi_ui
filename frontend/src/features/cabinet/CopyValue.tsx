import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Значение с кнопкой «скопировать»: ID и @username нужны, чтобы найти человека в Telegram. */
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Нет доступа к буферу (http, старый браузер): выделяем текст в временном поле
      const field = document.createElement("textarea");
      field.value = value;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    toast.success(`Скопировано: ${value}`);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Скопировать"
      aria-label={`Скопировать ${label}`}
      className="group inline-flex max-w-full items-center gap-1 truncate rounded px-0.5 hover:text-foreground"
    >
      <span className="truncate tabular-nums">{label}</span>
      {copied ? <Check className="size-3 shrink-0 text-emerald-600" aria-hidden /> : <Copy className="size-3 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />}
    </button>
  );
}
