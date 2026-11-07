import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE ?? "/api/v1",
  credentials: "include",
  // fetch берём в момент запроса, а не при создании клиента (так его можно подменить в тестах)
  fetch: (request) => globalThis.fetch(request),
});

type ApiErrorBody = components["schemas"]["Error"];

/** Код ошибки API или "network", если ответа от сервера нет. */
export type ApiErrorCode = string;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: Record<string, string>;
  /** Через сколько секунд можно повторить (заголовок Retry-After у 429). */
  readonly retryAfter: number | null;

  constructor(opts: {
    status: number;
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
    retryAfter?: number | null;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.fields = opts.fields ?? {};
    this.retryAfter = opts.retryAfter ?? null;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function isErrorBody(v: unknown): v is ApiErrorBody {
  if (typeof v !== "object" || v === null || !("error" in v)) return false;
  const err = (v as { error: unknown }).error;
  return typeof err === "object" && err !== null && "code" in err;
}

export function toApiError(body: unknown, response: Response): ApiError {
  const retry = Number(response.headers.get("Retry-After"));
  const retryAfter = Number.isFinite(retry) && retry > 0 ? retry : null;
  if (isErrorBody(body)) {
    return new ApiError({
      status: response.status,
      code: body.error.code,
      message: body.error.message,
      fields: body.error.fields,
      retryAfter,
    });
  }
  return new ApiError({ status: response.status, code: "internal", message: "", retryAfter });
}

// Вызывается на любой 401 unauthorized: AuthProvider сбрасывает пользователя
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Result<T> =
  | { data: T; error?: never; response: Response }
  | { data?: never; error: unknown; response: Response };

/**
 * Ждёт ответ openapi-fetch и возвращает data или бросает ApiError.
 * Сетевой сбой превращается в ApiError с кодом "network".
 */
export async function unwrap<T>(call: Promise<Result<T>>): Promise<NonNullable<T>> {
  let result: Result<T>;
  try {
    result = await call;
  } catch {
    throw new ApiError({ status: 0, code: "network", message: "" });
  }
  const { data, error, response } = result;
  if (!response.ok) {
    const apiError = toApiError(error, response);
    if (apiError.code === "unauthorized") onUnauthorized?.();
    throw apiError;
  }
  // У ответов 204 тела нет: такие вызовы результат не используют
  return data as NonNullable<T>;
}
