const BASE = "/api/method/";

/** Frappe кладёт человекочитаемые ошибки в _server_messages как JSON-массив JSON-строк. */
function parseFrappeError(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const messages = (body as { _server_messages?: string })._server_messages;
  if (!messages) return null;
  try {
    const list = JSON.parse(messages) as string[];
    const first = JSON.parse(list[0]) as { message?: string };
    // Frappe размечает сообщения HTML (<strong>…</strong>) под Desk; у нас они
    // выводятся текстом — теги только мешали бы читать.
    return first.message ? first.message.replace(/<[^>]+>/g, "") : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Браузерное «Failed to fetch» и HTML-страница прокси (502/504) владельцу
// ничего не говорят — на экран идут эти фразы.
export const OFFLINE = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
export const UNAVAILABLE = "Сервер временно недоступен. Попробуйте через минуту.";

export async function call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + method, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": window.habibi.csrf_token,
      },
      body: JSON.stringify(params ?? {}),
    });
  } catch {
    throw new ApiError(OFFLINE, 0);
  }

  const body: unknown = await response.json().catch(() => null);

  // Frappe всегда отвечает JSON; не JSON — значит, ответил не он, а прокси
  if (body === null) {
    throw new ApiError(UNAVAILABLE, response.status);
  }
  if (!response.ok) {
    throw new ApiError(parseFrappeError(body) ?? `Запрос не выполнен (${response.status})`, response.status);
  }

  return (body as { message: T }).message;
}
