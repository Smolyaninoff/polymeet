import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SESSION_EXPIRED_EVENT,
  apiGet,
  apiPost,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUserJson,
  saveSession,
  saveUser,
} from "@/shared/api/client";
import type { AuthResponse, UserOut } from "@/shared/api/schema";
import { queryClient } from "@/shared/api/queryClient";

interface AuthContextValue {
  user: UserOut | null;
  /** Идёт проверка сохранённой сессии при запуске */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* eslint-disable react-refresh/only-export-components */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

function getStoredUser(): UserOut | null {
  const raw = getStoredUserJson();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserOut;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(getStoredUser);
  const [isLoading, setIsLoading] = useState(() => !!getAccessToken());

  // Проверка сохранённой сессии: клиент сам обновит просроченный access-токен
  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    apiGet<UserOut>("/users/me")
      .then((me) => {
        if (cancelled) return;
        saveUser(me);
        setUser(me);
      })
      .catch(() => {
        if (cancelled) return;
        // Сессия недействительна — клиент уже очистил её, если refresh не прошёл
        if (!getAccessToken()) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const applySession = useCallback((auth: AuthResponse) => {
    saveSession(auth);
    setUser(auth.user);
    // Персональные данные (my_application и т. п.) запрашиваются заново
    queryClient.invalidateQueries();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await apiPost<AuthResponse>("/auth/login", { email: email.trim(), password }));
    },
    [applySession]
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      applySession(
        await apiPost<AuthResponse>("/auth/register", {
          email: email.trim(),
          password,
          display_name: displayName.trim(),
        })
      );
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await apiPost("/auth/logout", { refresh_token: refreshToken });
      } catch {
        // Выход на клиенте важнее: токен всё равно удаляем
      }
    }
    clearSession();
    setUser(null);
    queryClient.clear();
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
