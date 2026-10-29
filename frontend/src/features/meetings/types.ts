import type { CategoryId } from "./filters/categories";

export interface MeetingFormData {
  title: string;
  categoryId: CategoryId;
  description: string;
  date: string; // datetime-local: YYYY-MM-DDTHH:MM, местное время
  durationMinutes: number;
  maxSeats: number;
  address: string;
  addressHint: string;
  autoAccept: boolean;
  /** Только при создании: сразу опубликовать, а не сохранять черновик */
  publish: boolean;
}
