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

export interface SendResult {
  success: boolean;
  response: string;
  scenario_key: string | null;
  scenario_stack: string[];
  /** Приходит только тем, у кого роль Habibi AI Debug. */
  debug?: TraceStep[];
}
