const BASE = "/api/method/";

/** Frappe кладёт человекочитаемые ошибки в _server_messages как JSON-массив JSON-строк. */
function parseFrappeError(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const messages = (body as { _server_messages?: string })._server_messages;
  if (!messages) return null;
  try {
    const list = JSON.parse(messages) as string[];
    const first = JSON.parse(list[0]) as { message?: string };
    return first.message ?? null;
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

export async function call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const response = await fetch(BASE + method, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": window.habibi.csrf_token,
    },
    body: JSON.stringify(params ?? {}),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(parseFrappeError(body) ?? `Запрос не выполнен (${response.status})`, response.status);
  }

  return (body as { message: T }).message;
}
