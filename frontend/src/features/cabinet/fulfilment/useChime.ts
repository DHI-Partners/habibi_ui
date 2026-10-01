import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "habibi.kitchen.sound";

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Сигнал нового заказа. Браузеры не дают играть звук без жеста пользователя,
 * поэтому AudioContext создаётся и «будится» в обработчике нажатия кнопки
 * «Звук», а не при первом заказе. По умолчанию выключен; выбор помнится в
 * localStorage (его может не быть — тогда просто не помнится).
 */
export function useChime() {
  const [enabled, setEnabled] = useState(readEnabled);
  const context = useRef<AudioContext | null>(null);

  const play = useCallback(() => {
    const ctx = context.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    if (next) {
      try {
        context.current ??= new AudioContext();
        void context.current.resume();
      } catch {
        // Нет Web Audio — останется вибрация и подсветка
      }
    }
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // приватный режим — не страшно
    }
  }, [enabled]);

  return { enabled, toggle, play: enabled ? play : () => undefined };
}
