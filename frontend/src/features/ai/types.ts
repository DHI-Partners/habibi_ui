// Типы раздела пишутся руками, а не генерируются в shared/types/api.ts.
// Генератор (habibi_ui/typegen.py) импортирует датаклассы на старте, и импорт
// из habibi_ai уронил бы его на сайтах, где модуль не установлен — ровно на
// тех, ради которых раздел и делается необязательным.

export interface Bot {
  id: number;
  name: string;
  person_key: string | null;
  avatar: string | null;
}

export interface ChatRef {
  id: number;
  bot_id: number;
  current_scenario: string | null;
  title: string;
  preview: string;
}

// get_chat отдаёт строку customer_chats как есть (fields: "*"), а не то, что
// удобно списку чатов: id, bot_id, current_scenario, scenario_stack,
// metadata — и НЕ title/preview, которых в таблице нет вовсе, их считает
// list_chats из сообщений. Раньше useChat обещал ChatRef без title/preview
// через Omit и на этом останавливался, выбрасывая scenario_stack и metadata,
// которые сервер уже присылает — ревью поймало именно эту недостачу. Отдельный
// тип точнее Omit<ChatRef, ...>: он говорит, что здесь есть, а не только чего
// нет.
export interface ChatState {
  id: number;
  bot_id: number;
  current_scenario: string | null;
  scenario_stack: string[];
  metadata: Record<string, unknown> | null;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  date_created: string;
}

export interface TraceStep {
  step: string;
  data: Record<string, unknown>;
}

// get_bot_config: то, что на самом деле определяет поведение бота, собранное
// из трёх коллекций Directus в один ответ (см. api.py и engine.py). Доступен
// только роли Habibi AI Debug — без неё сервер вовсе не отвечает 200, и хук
// useBotConfig просто не запускается без botId.
export interface ScenarioConfig {
  scenario_key: string;
  description: string | null;
  max_history_messages: number | null;
  max_stack: number | null;
  /** Текст промпта сценария, уже подставленный вместо числового initial_prompt. */
  prompt: string;
}

export interface BotConfig {
  bot: {
    id: number;
    name: string | null;
    global_system_prompt: string | null;
  };
  /** Инструкция роутера намерений (ai_prompts.name === "intent_router"). null, если не задана. */
  router_prompt: string | null;
  scenarios: ScenarioConfig[];
}

export interface SendResult {
  success: boolean;
  response: string;
  scenario_key: string | null;
  scenario_stack: string[];
  /** Приходит только тем, у кого роль Habibi AI Debug. */
  debug?: TraceStep[];
}
