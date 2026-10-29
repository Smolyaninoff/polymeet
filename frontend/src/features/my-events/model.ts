import type {
  ApplicationStatus,
  MeetingListItem,
  MeetingStatus,
  MyApplicationItem,
} from "@/shared/api/schema";

export type MyEventRole = "participant" | "organizer";

/** Карточка «Моих событий»: встреча, где я участник или организатор. */
export interface MyEventView {
  key: string;
  meetingId: number;
  role: MyEventRole;
  title: string;
  startsAt: string;
  meetingStatus: MeetingStatus;
  acceptedCount: number;
  capacity: number;
  /** Есть только у моих встреч: в кратком описании встречи у заявки их нет */
  category?: string;
  address?: string;
  /** Статус моей заявки — только для роли участника */
  applicationStatus?: ApplicationStatus;
}

export function fromApplication(item: MyApplicationItem): MyEventView {
  return {
    key: `a${item.id}`,
    meetingId: item.meeting.id,
    role: "participant",
    title: item.meeting.title,
    startsAt: item.meeting.starts_at,
    meetingStatus: item.meeting.status,
    acceptedCount: item.meeting.accepted_count,
    capacity: item.meeting.capacity,
    applicationStatus: item.status,
  };
}

export function fromMeeting(item: MeetingListItem): MyEventView {
  return {
    key: `m${item.id}`,
    meetingId: item.id,
    role: "organizer",
    title: item.title,
    startsAt: item.starts_at,
    meetingStatus: item.status,
    acceptedCount: item.accepted_count,
    capacity: item.capacity,
    category: item.category,
    address: item.address,
  };
}

const ACTIVE_APPLICATION: ApplicationStatus[] = ["pending", "waitlist", "accepted"];

/** Актуальное: будущая встреча, не отменена; для участника — заявка действует. */
export function isUpcoming(event: MyEventView, now = new Date()): boolean {
  if (new Date(event.startsAt) <= now) return false;
  if (event.meetingStatus === "cancelled" || event.meetingStatus === "finished") return false;
  if (event.role === "participant") {
    return !!event.applicationStatus && ACTIVE_APPLICATION.includes(event.applicationStatus);
  }
  return true;
}

export function isThisWeek(event: MyEventView, now = new Date()): boolean {
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  const start = new Date(event.startsAt);
  return start > now && start <= week;
}

/** «Ожидают ответа»: моя заявка ещё не принята или встреча — неопубликованный черновик. */
export function isWaiting(event: MyEventView): boolean {
  if (event.role === "participant") {
    return event.applicationStatus === "pending" || event.applicationStatus === "waitlist";
  }
  return event.meetingStatus === "draft";
}

/** Ближайшая встреча, где я точно буду: принятая заявка или своя опубликованная встреча. */
export function nextMeeting(events: MyEventView[], now = new Date()): MyEventView | undefined {
  return events
    .filter((e) => isUpcoming(e, now))
    .filter((e) =>
      e.role === "participant" ? e.applicationStatus === "accepted" : e.meetingStatus === "published"
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
}

export function timeUntil(iso: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `Через ${days} д. ${hours} ч.`;
  if (hours > 0) return `Через ${hours} ч. ${mins} мин`;
  return `Через ${mins} мин`;
}
