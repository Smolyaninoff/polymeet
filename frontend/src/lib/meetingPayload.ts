import type { MeetingFormData } from "@/features/meetings/types";
import type { CreateMeetingInput, UpdateMeetingInput } from "@/shared/api/schema";
import type { ValidationErrors } from "./validateMeetingForm";
import { fieldErrors } from "@/shared/api/client";

/** Местное время из формы → ISO с часовым поясом (API требует смещение) */
function toIso(local: string): string {
  return new Date(local).toISOString();
}

export function toCreateInput(form: MeetingFormData): CreateMeetingInput {
  return {
    title: form.title.trim(),
    description: form.description,
    category: form.categoryId,
    starts_at: toIso(form.date),
    duration_minutes: form.durationMinutes,
    address: form.address.trim(),
    address_hint: form.addressHint.trim() || null,
    capacity: form.maxSeats,
    auto_accept: form.autoAccept,
  };
}

/** Для PATCH — только изменённые поля */
export function toUpdateInput(form: MeetingFormData, initial: MeetingFormData): UpdateMeetingInput {
  const next = toCreateInput(form);
  const prev = toCreateInput(initial);
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof CreateMeetingInput)[]) {
    if (next[key] !== prev[key]) changes[key] = next[key];
  }
  return changes as UpdateMeetingInput;
}

const FIELD_FROM_API: Record<string, keyof MeetingFormData> = {
  title: "title",
  description: "description",
  category: "categoryId",
  starts_at: "date",
  duration_minutes: "durationMinutes",
  address: "address",
  address_hint: "addressHint",
  capacity: "maxSeats",
  auto_accept: "autoAccept",
};

/** Ошибки полей из ответа API → ошибки полей формы */
export function formErrorsFromApi(error: unknown): ValidationErrors {
  const result: ValidationErrors = {};
  for (const [field, message] of Object.entries(fieldErrors(error))) {
    const key = FIELD_FROM_API[field];
    if (key) result[key] = message;
  }
  return result;
}
