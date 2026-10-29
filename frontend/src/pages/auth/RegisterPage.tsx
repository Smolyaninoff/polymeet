import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { ApiError } from "@/shared/api/schema";
import { errorMessage, fieldErrors } from "@/shared/api/client";
import { FormField } from "@/widgets/create-meeting/FormField";
import { AuthCard } from "./AuthCard";

type Field = "email" | "password" | "display_name";
type Errors = Partial<Record<Field, string>>;

function validate(email: string, password: string, name: string): Errors {
  const errors: Errors = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errors.email = "Введите корректный e-mail";
  if (password.length < 8) errors.password = "Минимум 8 символов";
  else if (password.trim().toLowerCase() === email.trim().toLowerCase())
    errors.password = "Пароль не должен совпадать с e-mail";
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) errors.display_name = "От 2 до 50 символов";
  return errors;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const local = validate(email, password, name);
    setErrors(local);
    setError(undefined);
    if (Object.keys(local).length > 0) return;

    setIsSubmitting(true);
    try {
      await register(email, password, name);
      navigate(from, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_TAKEN") {
        setErrors({ email: "Этот e-mail уже зарегистрирован" });
      } else if (e instanceof ApiError && e.code === "VALIDATION_ERROR") {
        setErrors(fieldErrors(e) as Errors);
      } else {
        setError(errorMessage(e, "Не удалось зарегистрироваться"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Регистрация"
      subtitle="Создайте аккаунт — это займёт минуту"
      submitLabel="Зарегистрироваться"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={submit}
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link to="/login" state={{ from }} className="text-blue-400 hover:text-blue-300">
            Войти
          </Link>
        </>
      }
    >
      <FormField
        label="Имя"
        required
        autoComplete="nickname"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Как вас будут видеть другие"
        error={errors.display_name}
      />
      <FormField
        label="E-mail"
        required
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="student@edu.spbstu.ru"
        error={errors.email}
      />
      <FormField
        label="Пароль"
        required
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Не короче 8 символов"
        error={errors.password}
      />
    </AuthCard>
  );
}
