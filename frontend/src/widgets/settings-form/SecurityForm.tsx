import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { apiPost } from "@/shared/api/client";

export function SecurityForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setIsSaved(false);
    setIsSubmitting(true);

    try {
      await apiPost<void>("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsSaved(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось обновить пароль"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Безопасность</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 pb-2">
          <Lock size={18} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Смена пароля</h3>
        </div>

        <label className="block space-y-2">
          <span className="text-xs text-slate-400">Текущий пароль</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs text-slate-400">Новый пароль</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-red-400">Минимум 8 символов</p>
          )}
        </label>

        <label className="block space-y-2">
          <span className="text-xs text-slate-400">Подтвердите пароль</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          {confirmPassword.length > 0 && confirmPassword !== newPassword && (
            <p className="text-xs text-red-400">Пароли не совпадают</p>
          )}
        </label>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {isSaved && (
          <p role="status" className="text-sm text-emerald-400">
            Пароль успешно обновлён.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
        >
          {isSubmitting ? "Сохраняем…" : "Обновить пароль"}
        </button>
      </form>
    </div>
  );
}
