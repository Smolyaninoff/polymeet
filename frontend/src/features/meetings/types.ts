import type { CategoryId } from "./filters/categories";

export interface Meeting {
  id: string;
  title: string;
  categoryId: CategoryId;
  address: string;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  date: string;
  freeSeats: number;
  imageUrl: string;
}

export type EventStatus = "approved" | "pending" | "confirmed" | "completed" | "cancelled";
export type UserRole = "participant" | "organizer";
export interface MyEvent extends Meeting {
  status: EventStatus;
  role: UserRole;
  hasRoute: boolean;
}

export interface MeetingFormData {
  title: string;
  categoryId: CategoryId;
  description: string;
  date: string; // datetime-local: YYYY-MM-DDTHH:MM
  maxSeats: number;
  address: string;
}
