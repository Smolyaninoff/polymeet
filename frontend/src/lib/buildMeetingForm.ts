import type { MeetingFormData } from "@/features/meetings/types";
import type { CategoryId } from "@/features/meetings/filters/categories";
import type { MeetingOut } from "@/shared/api/schema";

/** ISO-время → значение для <input type="datetime-local"> в местном времени */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function buildMeetingForm(
  mode: "create" | "edit",
  initialData?: Partial<MeetingFormData>
): MeetingFormData {
  const base: MeetingFormData = {
    title: "",
    categoryId: "" as CategoryId,
    description: "",
    date: "",
    durationMinutes: 120,
    maxSeats: 10,
    address: "",
    addressHint: "",
    autoAccept: false,
    publish: true,
  };
  if (mode === "edit" && initialData) {
    return { ...base, ...initialData, publish: false };
  }
  return base;
}

/** Данные встречи с сервера → значения формы правки */
export function formFromMeeting(meeting: MeetingOut): MeetingFormData {
  return {
    title: meeting.title,
    categoryId: meeting.category as CategoryId,
    description: meeting.description,
    date: toDatetimeLocal(meeting.starts_at),
    durationMinutes: meeting.duration_minutes,
    maxSeats: meeting.capacity,
    address: meeting.address,
    addressHint: meeting.address_hint ?? "",
    autoAccept: meeting.auto_accept,
    publish: false,
  };
}
