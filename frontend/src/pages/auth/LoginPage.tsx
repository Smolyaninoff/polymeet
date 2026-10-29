import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { ApiError } from "@/shared/api/schema";
import { errorMessage } from "@/shared/api/client";
import { FormField } from "@/widgets/create-meeting/FormField";
import { AuthCard } from "./AuthCard";

function loginError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") return "Слишком много попыток. Попробуйте через несколько минут.";
    if (error.code === "INVALID_CREDENTIALS") return "Неверный e-mail или пароль";
    if (error.code === "VALIDATION_ERROR") return "Проверьте e-mail и пароль";
  }
  return errorMessage(error, "Не удалось войти");
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Введите e-mail и пароль");
      return;
    }
    setIsSubmitting(true);
    setError(undefined);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(loginError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Вход"
      subtitle="Войдите, чтобы записываться на встречи и создавать свои"
      submitLabel="Войти"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={submit}
      footer={
        <>
          Нет аккаунта?{" "}
          <Link to="/register" state={{ from }} className="text-blue-400 hover:text-blue-300">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <FormField
        label="E-mail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="student@edu.spbstu.ru"
      />
      <FormField
        label="Пароль"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </AuthCard>
  );
}
