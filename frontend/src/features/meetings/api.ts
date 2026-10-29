import { apiGet, apiPost, apiPatch, apiPut } from "@/shared/api/client";
import type {
  MeetingPage,
  MeetingOut,
  CreateMeetingInput,
  UpdateMeetingInput,
  MapMeetingItem,
} from "@/shared/api/schema";

export interface FeedFilters {
  category?: string;
  date?: string;
  q?: string;
  has_free_places?: boolean;
  lat?: number;
  lon?: number;
  radius_km?: number;
}

export async function fetchMeetings(
  filters: FeedFilters,
  cursor?: string,
  limit = 20
): Promise<MeetingPage> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  if (filters.category) params.set("category", filters.category);
  if (filters.date) params.set("date", filters.date);
  if (filters.q) params.set("q", filters.q);
  if (filters.has_free_places) params.set("has_free_places", "true");
  if (filters.lat !== undefined) params.set("lat", String(filters.lat));
  if (filters.lon !== undefined) params.set("lon", String(filters.lon));
  if (filters.radius_km !== undefined)
    params.set("radius_km", String(filters.radius_km));

  return apiGet<MeetingPage>(`/meetings?${params.toString()}`);
}

export async function fetchMeetingMap(
  bbox: string,
  filters: Omit<FeedFilters, "lat" | "lon" | "radius_km">
): Promise<MapMeetingItem[]> {
  const params = new URLSearchParams();
  params.set("bbox", bbox);
  if (filters.category) params.set("category", filters.category);
  if (filters.date) params.set("date", filters.date);
  if (filters.has_free_places) params.set("has_free_places", "true");

  return apiGet<MapMeetingItem[]>(`/meetings/map?${params.toString()}`);
}

export async function fetchMeeting(id: number): Promise<MeetingOut> {
  return apiGet<MeetingOut>(`/meetings/${id}`);
}

export async function createMeeting(input: CreateMeetingInput): Promise<MeetingOut> {
  return apiPost<MeetingOut>("/meetings", input);
}

export async function updateMeeting(
  id: number,
  input: UpdateMeetingInput
): Promise<MeetingOut> {
  return apiPatch<MeetingOut>(`/meetings/${id}`, input);
}

/** Точка на карте вручную (организатор), `geo_status` станет `manual` */
export async function setMeetingLocation(
  id: number,
  location: { lat: number; lon: number }
): Promise<MeetingOut> {
  return apiPut<MeetingOut>(`/meetings/${id}/location`, location);
}