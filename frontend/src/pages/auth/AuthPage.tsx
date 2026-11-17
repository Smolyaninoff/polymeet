import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "@/features/auth/context";

type AuthMode = "login" | "register";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Открывай",
    text: "Находи мероприятия по интересам",
  },
  {
    icon: Users,
    title: "Общайся",
    text: "Встречай единомышленников",
  },
  {
    icon: Sparkles,
    title: "Создавай",
    text: "Организуй свои события",
  },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#101a2c] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-600 hover:border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

export function AuthPage() {
  const { user, isLoading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#050913] px-6 text-white">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <LoaderCircle
            size={18}
            className="motion-safe:animate-spin"
            aria-hidden="true"
          />
          Проверяем вашу сессию…
        </div>
      </main>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const destination =
    (location.state as { from?: string } | null)?.from ?? "/";

  const changeMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setShowPassword(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (mode === "register" && displayName.trim().length < 2) {
      setError("Введите имя — минимум 2 символа.");
      return;
    }

    if (mode === "register" && password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }

      navigate(destination, { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось выполнить запрос. Попробуйте ещё раз."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[#050913] p-4 text-white sm:p-6 lg:p-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] shadow-[0_32px_100px_rgba(0,0,0,0.45)] lg:grid-cols-2">
        <section className="relative hidden min-h-[660px] overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <img
            src="/concert.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-[#07101d]/70" />
          <div className="absolute inset-0 bg-linear-to-t from-[#080f1d] via-transparent to-[#080f1d]/30" />

          <div className="relative flex items-center justify-between p-10">
            <span className="text-xl font-semibold tracking-tight">
              PolyMeet
            </span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Meet real people
            </span>
          </div>

          <div className="relative px-10 pb-10">
            <h2 className="max-w-md text-5xl font-bold leading-[1.08] tracking-tight">
              Больше,
              <br />
              чем <span className="text-blue-500">встречи</span>
            </h2>

            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">
              PolyMeet помогает находить интересные события рядом,
              встречать новых людей и создавать свои мероприятия.
            </p>

            <div className="mt-8 space-y-5">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-center gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-blue-400/15 bg-blue-500/10 text-blue-400">
                    <Icon size={19} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-xs text-slate-400">{text}</p>
                  </div>
                </div>
              ))}
            </div>

            <blockquote className="mt-8 rounded-2xl border border-white/10 bg-[#0b1424]/80 p-5 backdrop-blur-sm">
              <p className="text-sm leading-6 text-slate-300">
                «Лучшие вещи происходят в реальной жизни»
              </p>
              <footer className="mt-3 text-xs text-slate-500">
                — PolyMeet
              </footer>
            </blockquote>
          </div>
        </section>

        <section className="flex flex-col justify-center bg-[#0b1220] px-6 py-8 sm:px-10 sm:py-12 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <span className="text-xl font-semibold">PolyMeet</span>
              <span className="text-xs text-slate-500">Meet real people</span>
            </div>

            <div className="flex border-b border-white/10">
              <button
                type="button"
                onClick={() => changeMode("login")}
                aria-pressed={mode === "login"}
                className={`flex-1 border-b-2 py-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 ${
                  mode === "login"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                Вход
              </button>

              <button
                type="button"
                onClick={() => changeMode("register")}
                aria-pressed={mode === "register"}
                className={`flex-1 border-b-2 py-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 ${
                  mode === "register"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                Регистрация
              </button>
            </div>

            <header className="mt-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {mode === "login"
                  ? "С возвращением!"
                  : "Присоединяйся к PolyMeet!"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {mode === "login"
                  ? "Войдите в свой аккаунт, чтобы продолжить"
                  : "Создайте аккаунт и начните находить свои встречи"}
              </p>
            </header>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {mode === "register" && (
                <div>
                  <label
                    htmlFor="display-name"
                    className="mb-2 block text-xs font-medium text-slate-300"
                  >
                    Имя
                  </label>
                  <div className="relative">
                    <UserRound
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      id="display-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={50}
                      value={displayName}
                      onChange={(event) =>
                        setDisplayName(event.target.value)
                      }
                      autoComplete="name"
                      placeholder="Как вас называть?"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-medium text-slate-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-medium text-slate-300"
                >
                  Пароль
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    placeholder={
                      mode === "register"
                        ? "Минимум 8 символов"
                        : "Введите пароль"
                    }
                    className={`${INPUT_CLASS} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword
                        ? "Скрыть пароль"
                        : "Показать пароль"
                    }
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-700 to-blue-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)] transition-all hover:from-blue-600 hover:to-blue-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    Проверяем данные…
                  </>
                ) : (
                  <>
                    {mode === "login" ? "Войти" : "Создать аккаунт"}
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              {mode === "login"
                ? "Нет аккаунта?"
                : "Уже есть аккаунт?"}{" "}
              <button
                type="button"
                onClick={() =>
                  changeMode(mode === "login" ? "register" : "login")
                }
                className="font-medium text-blue-400 transition-colors hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
              >
                {mode === "login" ? "Зарегистрироваться" : "Войти"}
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}