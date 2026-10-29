import { CATEGORIES } from "./filters/categories";
import type { ApplicationStatus, GeoStatus, MeetingStatus } from "@/shared/api/schema";

const CATEGORY_IMAGES: Record<string, string> = {
  lecture: "/lecture.jpg",
  games: "/gaming.jpg",
  concert: "/concert.jpg",
  sport: "/sport.jpg",
  walk: "/walking.jpg",
  other: "/others.jpg",
};

export function categoryImage(slug: string): string {
  return CATEGORY_IMAGES[slug] ?? "/others.jpg";
}

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.id === slug)?.label ?? slug;
}

export const MEETING_STATUS: Record<MeetingStatus, { label: string; dot: string }> = {
  draft: { label: "Черновик", dot: "bg-slate-400" },
  published: { label: "Опубликована", dot: "bg-emerald-500" },
  cancelled: { label: "Отменена", dot: "bg-red-500" },
  finished: { label: "Завершена", dot: "bg-slate-500" },
};

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; dot: string }> = {
  pending: { label: "На рассмотрении", dot: "bg-amber-500" },
  accepted: { label: "Вы участвуете", dot: "bg-emerald-500" },
  waitlist: { label: "Лист ожидания", dot: "bg-blue-500" },
  rejected: { label: "Заявка отклонена", dot: "bg-red-500" },
  withdrawn: { label: "Заявка отозвана", dot: "bg-slate-500" },
};

export const GEO_STATUS_HINT: Partial<Record<GeoStatus, string>> = {
  pending: "Определяем точку на карте — адрес сохранён",
  failed: "Адрес не нашёлся на карте",
};

export function reliabilityText(rate: number | null): string {
  return rate === null ? "надёжность пока неизвестна" : `надёжность ${Math.round(rate * 100)}%`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} ч` : "", m ? `${m} мин` : ""].filter(Boolean).join(" ");
}

export function hasStarted(startsAt: string, now = new Date()): boolean {
  return new Date(startsAt) <= now;
}
