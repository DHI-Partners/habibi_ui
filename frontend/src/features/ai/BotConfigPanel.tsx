import { useEffect, useState } from "react";

import { Skeleton } from "../../shared/ui/skeleton";
import { useBotConfig } from "./api";
import { PromptBlock } from "./TracePanel";
import type { Bot } from "./types";

/**
 * Конфигурация бота, читаемая, а не разложенная по трём коллекциям Directus.
 * Доступ решает сервер (роль Habibi AI Debug у get_bot_config) — без неё
 * запрос падает с ошибкой, и она показывается тем же способом, что и любая
 * другая ошибка запроса на этом экране (см. send.error в ChatPage). Панель
 * не пытается сама решать, есть роль или нет: это тот же принцип, что и у
 * TracePanel с absenceReason — источник решения один, сервер.
 */
export function BotConfigPanel({ bots, defaultBotId }: { bots: Bot[] | undefined; defaultBotId: number | null }) {
  const [botId, setBotId] = useState<number | null>(defaultBotId);

  // Подставляем бота по умолчанию (бот открытого чата, иначе первый в
  // списке), только пока пользователь сам ничего не выбрал — иначе смена
  // чата под открытой панелью конфигурации переключала бы её сама.
  useEffect(() => {
    if (botId === null && defaultBotId !== null) setBotId(defaultBotId);
  }, [botId, defaultBotId]);

  const config = useBotConfig(botId);

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="config-bot" className="text-muted-foreground">
          Бот:
        </label>
        <select
          id="config-bot"
          className="rounded-lg border border-border bg-background px-2 py-1"
          value={botId ?? ""}
          onChange={(event) => setBotId(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="" disabled>
            Выберите бота
          </option>
          {bots?.map((bot) => (
            <option key={bot.id} value={bot.id}>
              {bot.name}
            </option>
          ))}
        </select>
      </div>

      {botId === null && (
        <p className="text-muted-foreground">Выберите бота, чтобы увидеть его конфигурацию.</p>
      )}

      {botId !== null && config.isPending && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {config.isError && <p className="text-destructive">{config.error.message}</p>}

      {config.data && (
        <>
          <div>
            <h2 className="mb-1 text-sm font-medium">
              Глобальный промпт — {config.data.bot.name ?? `Бот ${config.data.bot.id}`}
            </h2>
            <PromptBlock text={config.data.bot.global_system_prompt ?? "—"} />
          </div>

          <div>
            <h2 className="mb-1 text-sm font-medium">Роутер намерений</h2>
            {config.data.router_prompt ? (
              <PromptBlock text={config.data.router_prompt} />
            ) : (
              <p className="text-xs italic text-muted-foreground">Промпт роутера не задан.</p>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium">Сценарии</h2>
            {config.data.scenarios.length === 0 && (
              <p className="text-xs italic text-muted-foreground">У бота нет сценариев.</p>
            )}
            <div className="space-y-3">
              {config.data.scenarios.map((scenario) => (
                <div key={scenario.scenario_key} className="rounded-2xl border border-border p-3">
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{scenario.scenario_key}</span>
                    {scenario.description && <span className="text-muted-foreground">{scenario.description}</span>}
                    <span className="text-muted-foreground">
                      история: {scenario.max_history_messages ?? "—"}
                    </span>
                    <span className="text-muted-foreground">стек: {scenario.max_stack ?? "—"}</span>
                  </div>
                  <PromptBlock text={scenario.prompt || "—"} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
