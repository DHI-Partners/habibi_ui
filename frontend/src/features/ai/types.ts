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
  title: string;
  preview: string;
}

// get_chat отдаёт строку customer_chats как есть (fields: "*"), а не то, что
// удобно списку чатов: id, bot_id, metadata — и НЕ title/preview, которых в
// таблице нет вовсе, их считает list_chats из сообщений. Раньше useChat
// обещал ChatRef без title/preview через Omit и на этом останавливался,
// выбрасывая metadata, которую сервер уже присылает — ревью поймало именно
// эту недостачу. Отдельный тип точнее Omit<ChatRef, ...>: он говорит, что
// здесь есть, а не только чего нет.
//
// current_scenario и scenario_stack тут раньше тоже были: колонки в
// customer_chats остаются (get_chat их всё ещё присылает через fields: "*"),
// но роутер намерений и стек сценариев из движка убраны — движок в них
// больше не пишет ничего осмысленного, и эти два поля были бы вечно "нет" /
// пустым списком. Типу нет смысла обещать то, что никогда не приходит с
// содержанием (см. ChatPage.tsx, ConversationState).
export interface ChatState {
  id: number;
  bot_id: number;
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
  /** Имена инструментов, объявленных сценарию. Пустой список — сценарий без инструментов. */
  tools: string[];
  /** Текст промпта сценария, уже подставленный вместо числового initial_prompt. */
  prompt: string;
}

export interface BotConfig {
  bot: {
    id: number;
    name: string | null;
    global_system_prompt: string | null;
  };
  scenarios: ScenarioConfig[];
}

export interface SendResult {
  success: boolean;
  response: string;
  /**
   * Трассировка всех витков цикла за этот ход, а не одного вызова модели.
   * Приходит только обладателю роли Habibi AI Debug.
   */
  debug?: TraceStep[];
}
