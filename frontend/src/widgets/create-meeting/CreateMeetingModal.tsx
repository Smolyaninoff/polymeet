import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { MeetingFormData } from "@/features/meetings/types";
import { buildMeetingForm } from "@/lib/buildMeetingForm";
import { validateMeetingForm, type ValidationErrors } from "@/lib/validateMeetingForm";
import { formErrorsFromApi } from "@/lib/meetingPayload";
import { errorMessage } from "@/shared/api/client";
import { FormField } from "./FormField";
import { FormTextarea } from "./FormTextarea";
import { CategoryChips } from "./CategoryChips";

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Сохранение на сервере; ошибка API показывается в форме, модалка остаётся открытой */
  onSubmit: (data: MeetingFormData) => Promise<void>;
  mode: "create" | "edit";
  initialData?: Partial<MeetingFormData>;
}

const DURATIONS = [
  { value: 30, label: "30 минут" },
  { value: 60, label: "1 час" },
  { value: 90, label: "1,5 часа" },
  { value: 120, label: "2 часа" },
  { value: 180, label: "3 часа" },
  { value: 240, label: "4 часа" },
  { value: 360, label: "6 часов" },
  { value: 720, label: "12 часов" },
];

export function CreateMeetingModal({
  isOpen,
  onClose,
  onSubmit,
  mode,
  initialData,
}: CreateMeetingModalProps) {
  const [form, setForm] = useState(() => buildMeetingForm(mode, initialData));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [generalError, setGeneralError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isSubmitting, onClose]);

  const update = (patch: Partial<MeetingFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch) as (keyof MeetingFormData)[];
    setErrors((prev) => {
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleSubmit = async () => {
    const validation = validateMeetingForm(form);
    setErrors(validation);
    setGeneralError(undefined);
    if (Object.keys(validation).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ ...form });
      onClose();
    } catch (e) {
      const fromApi = formErrorsFromApi(e);
      if (Object.keys(fromApi).length > 0) setErrors(fromApi);
      else setGeneralError(errorMessage(e, "Не удалось сохранить встречу"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#131a30] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">
              {mode === "create" ? "Создать встречу" : "Редактировать встречу"}
            </h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md p-1 text-slate-400 transition-colors hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <FormField
              label="Название"
              required
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Напр.: Поход на лекцию по ИИ"
              maxLength={120}
              error={errors.title}
            />

            <CategoryChips
              selected={form.categoryId}
              onSelect={(id) => update({ categoryId: id })}
              error={errors.categoryId}
            />

            <FormTextarea
              label="Описание"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Подробнее о встрече..."
              maxLength={2000}
              rows={3}
            />
            {errors.description && <p className="-mt-3 text-xs text-red-400">{errors.description}</p>}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Дата и время"
                required
                type="datetime-local"
                value={form.date}
                onChange={(e) => update({ date: e.target.value })}
                error={errors.date}
              />
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">
                  Длительность<span className="ml-0.5 text-red-400">*</span>
                </label>
                <select
                  value={form.durationMinutes}
                  onChange={(e) => update({ durationMinutes: Number(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-[#131a30] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {DURATIONS.some((d) => d.value === form.durationMinutes) ? null : (
                    <option value={form.durationMinutes}>{form.durationMinutes} мин</option>
                  )}
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {errors.durationMinutes && (
                  <p className="text-xs text-red-400">{errors.durationMinutes}</p>
                )}
              </div>
            </div>

            <FormField
              label="Лимит участников"
              required
              type="number"
              min={2}
              max={100}
              value={form.maxSeats}
              onChange={(e) => update({ maxSeats: Number(e.target.value) })}
              error={errors.maxSeats}
            />

            <FormField
              label="Место встречи"
              required
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="Напр.: Санкт-Петербург, Политехническая ул., 29"
              maxLength={300}
              error={errors.address}
            />
            <FormField
              label="Как найти место"
              value={form.addressHint}
              onChange={(e) => update({ addressHint: e.target.value })}
              placeholder="Напр.: 3 этаж, ауд. 305"
              maxLength={200}
              error={errors.addressHint}
            />

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.autoAccept}
                onChange={(e) => update({ autoAccept: e.target.checked })}
                className="size-4 accent-blue-600"
              />
              Принимать заявки автоматически
            </label>
            {mode === "create" && (
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.publish}
                  onChange={(e) => update({ publish: e.target.checked })}
                  className="size-4 accent-blue-600"
                />
                Сразу опубликовать в ленте
              </label>
            )}

            {generalError && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {generalError}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {isSubmitting ? "Сохраняем…" : mode === "create" ? "Создать встречу" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
