import type { MeetingFormData } from "@/features/meetings/types";

export type ValidationErrors = Partial<Record<keyof MeetingFormData, string>>;

/** Те же ограничения, что у API (MeetingCreate): ошибка видна сразу, без запроса. */
export function validateMeetingForm(form: MeetingFormData, now = new Date()): ValidationErrors {
  const errors: ValidationErrors = {};
  const title = form.title.trim();
  if (title.length < 3 || title.length > 120) errors.title = "От 3 до 120 символов";
  if (!form.categoryId) errors.categoryId = "Выберите тематику";
  if (form.description.length > 2000) errors.description = "Не больше 2000 символов";
  if (!form.date) errors.date = "Укажите дату и время";
  else if (new Date(form.date) <= now) errors.date = "Время начала должно быть в будущем";
  if (form.durationMinutes < 15 || form.durationMinutes > 720)
    errors.durationMinutes = "От 15 минут до 12 часов";
  if (form.maxSeats < 2 || form.maxSeats > 100) errors.maxSeats = "От 2 до 100 участников";
  const address = form.address.trim();
  if (address.length < 3 || address.length > 300) errors.address = "Укажите адрес (от 3 символов)";
  if (form.addressHint.length > 200) errors.addressHint = "Не больше 200 символов";
  return errors;
}
