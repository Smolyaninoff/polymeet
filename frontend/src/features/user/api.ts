import { apiGet } from "@/shared/api/client";
import type { UserOut, PublicUserOut, MeetingPage } from "@/shared/api/schema";

export async function fetchMe(): Promise<UserOut> {
  return apiGet<UserOut>("/users/me");
}

export async function fetchPublicUser(id: number): Promise<PublicUserOut> {
  return apiGet<PublicUserOut>(`/users/${id}`);
}

export async function fetchMyMeetings(
  cursor?: string,
  limit = 50
): Promise<MeetingPage> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  return apiGet<MeetingPage>(`/users/me/meetings?${params.toString()}`);
}