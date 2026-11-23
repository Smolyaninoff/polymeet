import type { MeetingFormData } from "@/features/meetings/types";

export interface ValidationErrors {
  title?: string;
  categoryId?: string;
  date?: string;
  address?: string;
  maxSeats?: string;
}

export function validateMeetingForm(form: MeetingFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.title.trim() || form.title.trim().length < 3) {
    errors.title = "Минимум 3 символа";
  }
  if (!form.categoryId) {
    errors.categoryId = "Выберите тематику";
  }
  if (!form.date || Number.isNaN(new Date(form.date).getTime())) {
    errors.date = "Укажите дату и время";
  } else if (new Date(form.date).getTime() <= Date.now()) {
    errors.date = "Дата встречи должна быть в будущем";
  }
  if (form.address.trim().length < 3) {
    errors.address = "Укажите место встречи (не менее 3 символов)";
  }
  if (!Number.isInteger(form.maxSeats) || form.maxSeats < 2 || form.maxSeats > 100) {
    errors.maxSeats = "Количество мест: от 2 до 100";
  }

  return errors;
}
