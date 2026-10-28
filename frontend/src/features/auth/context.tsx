import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiPost, clearSession } from "@/shared/api/client";
import type { AuthResponse, UserOut } from "@/shared/api/schema";
import { queryClient } from "@/shared/api/queryClient";

interface AuthContextValue {
  user: UserOut | null;
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
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

function getStoredToken(): string | null {
  return localStorage.getItem("access_token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(getStoredUser);
  const [isLoading, setIsLoading] = useState(() => !!getStoredToken());

  // Validate token on mount
  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      // Schedule state update outside the render phase
      const timer = setTimeout(() => setIsLoading(false), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    fetch("/api/v1/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((u: UserOut) => {
        if (!cancelled) {
          setUser(u);
          localStorage.setItem("user", JSON.stringify(u));
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<AuthResponse>("/auth/login", {
      email: email.toLowerCase().trim(),
      password,
    });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const data = await apiPost<AuthResponse>("/auth/register", {
        email: email.toLowerCase().trim(),
        password,
        display_name: displayName.trim(),
      });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
    },
    []
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await apiPost("/auth/logout", { refresh_token: refreshToken });
      } catch {
        // Ignore logout errors
      }
    }
    clearSession();
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}