import { ApiError, type ProblemDetail } from "./schema";

const BASE_URL = "/api/v1";

let refreshPromise: Promise<void> | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearSession(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

async function doRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    throw new Error("No refresh token");
  }

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    throw new Error("Refresh failed");
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

async function request(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const token = getAccessToken();

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  let res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401 and not an auth endpoint → try refresh
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    await refreshPromise;

    // Retry once with new token
    const newToken = getAccessToken();
    const retryHeaders: Record<string, string> = {};
    if (newToken) retryHeaders["Authorization"] = `Bearer ${newToken}`;
    if (body) retryHeaders["Content-Type"] = "application/json";

    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: retryHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request("GET", path);
  if (!res.ok) {
    const problem: ProblemDetail = await res.json();
    throw new ApiError(problem);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await request("POST", path, body);
  if (!res.ok) {
    const problem: ProblemDetail = await res.json();
    throw new ApiError(problem);
  }
  return res.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await request("PATCH", path, body);
  if (!res.ok) {
    const problem: ProblemDetail = await res.json();
    throw new ApiError(problem);
  }
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await request("DELETE", path);
  if (!res.ok) {
    const problem: ProblemDetail = await res.json();
    throw new ApiError(problem);
  }
}