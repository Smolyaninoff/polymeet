import { ApiError, type AuthResponse, type ProblemDetail } from "./schema";

const BASE_URL = "/api/v1";

/** Событие окна: сессия закончилась (refresh-токен отозван или просрочен). */
export const SESSION_EXPIRED_EVENT = "polymeet:session-expired";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "user";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage недоступен (приватный режим) — сессия живёт до перезагрузки
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return read(REFRESH_KEY);
}

export function getStoredUserJson(): string | null {
  return read(USER_KEY);
}

export function saveSession(auth: AuthResponse): void {
  write(ACCESS_KEY, auth.access_token);
  write(REFRESH_KEY, auth.refresh_token);
  write(USER_KEY, JSON.stringify(auth.user));
}

export function saveUser(user: AuthResponse["user"]): void {
  write(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // нечего очищать
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    try {
      return new ApiError((await res.json()) as ProblemDetail);
    } catch {
      // тело не разобралось — ниже общий ответ
    }
  }
  return new ApiError({
    type: "about:blank",
    title: res.statusText,
    status: res.status,
    detail:
      res.status >= 500
        ? "Сервис временно недоступен, попробуйте позже"
        : "Не удалось выполнить запрос",
    code: res.status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR",
    instance: res.url,
  });
}

// Refresh-токен одноразовый: при нескольких одновременных 401 обновляет ровно один запрос,
// остальные ждут его результата.
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (res.ok) {
    saveSession((await res.json()) as AuthResponse);
    return true;
  }
  if (res.status === 401) {
    // Токен отозван или просрочен — сессия закончилась
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    return false;
  }
  // 503 и прочие сбои: сессию не трогаем, ошибку увидит исходный запрос
  throw await toApiError(res);
}

function send(method: string, path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body);

  if (res.status === 401 && !path.startsWith("/auth/") && read(REFRESH_KEY)) {
    refreshing ??= refreshSession().finally(() => {
      refreshing = null;
    });
    if (await refreshing) {
      res = await send(method, path, body);
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => apiRequest<T>("GET", path);
export const apiPost = <T>(path: string, body?: unknown) => apiRequest<T>("POST", path, body);
export const apiPatch = <T>(path: string, body?: unknown) => apiRequest<T>("PATCH", path, body);
export const apiPut = <T>(path: string, body?: unknown) => apiRequest<T>("PUT", path, body);
export const apiDelete = (path: string) => apiRequest<void>("DELETE", path);

/** Текст ошибки для пользователя. */
export function errorMessage(error: unknown, fallback = "Что-то пошло не так"): string {
  if (error instanceof ApiError) return error.detail || fallback;
  return fallback;
}

/** Ошибки по полям из `VALIDATION_ERROR`: имя поля запроса → сообщение. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.errors) return {};
  return Object.fromEntries(error.errors.map((e) => [e.field, e.message]));
}
