import { useQuery } from "@tanstack/react-query";
import { fetchMyMeetings } from "@/features/user/api";
import { fetchMyApplications } from "@/features/applications/api";
import { fetchMeeting } from "@/features/meetings/api";
import type {
  ApplicationStatus,
  MeetingListItem,
} from "@/shared/api/schema";
import type { CategoryId } from "@/features/meetings/filters/categories";
import type {
  EventStatus,
  MyEvent,
  UserRole,
} from "@/features/meetings/types";

const IMAGES: Record<string, string> = {
  lecture: "/lecture.jpg",
  games: "/gaming.jpg",
  concert: "/concert.jpg",
  sport: "/sport.jpg",
  walk: "/walking.jpg",
  other: "/others.jpg",
};

function getStatus(
  meeting: MeetingListItem,
  role: UserRole,
  applicationStatus?: ApplicationStatus
): EventStatus {
  if (
    meeting.status === "finished" ||
    new Date(meeting.starts_at).getTime() < Date.now()
  ) {
    return "completed";
  }

  if (meeting.status === "cancelled") return "cancelled";

  if (role === "organizer") {
    return meeting.status === "draft" ? "pending" : "confirmed";
  }

  if (applicationStatus === "accepted") return "approved";
  if (applicationStatus === "pending" || applicationStatus === "waitlist") {
    return "pending";
  }

  return "cancelled";
}

function toEvent(
  meeting: MeetingListItem,
  role: UserRole,
  applicationStatus?: ApplicationStatus
): MyEvent {
  return {
    id: String(meeting.id),
    title: meeting.title,
    categoryId: meeting.category as CategoryId,
    address: meeting.address,
    lat: meeting.lat,
    lng: meeting.lon,
    distanceKm: meeting.distance_km,
    date: meeting.starts_at,
    freeSeats: meeting.free_places,
    imageUrl: IMAGES[meeting.category] ?? IMAGES.other,
    status: getStatus(meeting, role, applicationStatus),
    role,
    hasRoute: meeting.lat !== null && meeting.lon !== null,
  };
}

async function fetchMyEvents(): Promise<MyEvent[]> {
  const [organized, applications] = await Promise.all([
    fetchMyMeetings(undefined, 50),
    fetchMyApplications(undefined, 50),
  ]);

  const participantEvents = await Promise.all(
    applications.items.map(async (application) => {
      const meeting = await fetchMeeting(application.meeting.id);
      return toEvent(meeting, "participant", application.status);
    })
  );

  return [
    ...organized.items.map((meeting) => toEvent(meeting, "organizer")),
    ...participantEvents,
  ];
}

export function useMyEvents() {
  return useQuery({
    queryKey: ["my-events"],
    queryFn: fetchMyEvents,
  });
}
