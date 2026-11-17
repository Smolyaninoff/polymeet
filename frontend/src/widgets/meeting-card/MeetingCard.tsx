import { Bookmark, MapPin, Users } from "lucide-react";
import type {
  ApplicationStatus,
  MeetingListItem,
} from "@/shared/api/schema";

const CATEGORY_IMAGES: Record<string, string> = {
  lecture: "/lecture.jpg",
  games: "/gaming.jpg",
  concert: "/concert.jpg",
  sport: "/sport.jpg",
  walk: "/walking.jpg",
  other: "/others.jpg",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MeetingCardProps {
  meeting: MeetingListItem;
  applicationStatus?: ApplicationStatus;
  isJoining?: boolean;
  onJoin?: (id: number) => void;
}

export function MeetingCard({
  meeting,
  applicationStatus,
  isJoining = false,
  onJoin,
}: MeetingCardProps) {
  const imageUrl =
    CATEGORY_IMAGES[meeting.category] || "/others.jpg";

  const hasApplication =
    applicationStatus === "pending" ||
    applicationStatus === "accepted" ||
    applicationStatus === "waitlist";

  const isFull = meeting.free_places === 0;
  const disabled = isFull || hasApplication || isJoining;

  const buttonText = isJoining
    ? "Отправка…"
    : applicationStatus === "accepted"
      ? "Вы участвуете"
      : applicationStatus === "waitlist"
        ? "Вы в листе ожидания"
        : applicationStatus === "pending"
          ? "Заявка отправлена"
          : isFull
            ? "Мест нет"
            : "Подать заявку";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#131a30] transition hover:border-white/20">
      <div className="relative h-40 overflow-hidden">
        <img
          src={imageUrl}
          alt={meeting.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-linear-to-t from-[#131a30] to-transparent" />

        <button className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm transition hover:text-white">
          <Bookmark size={16} />
        </button>

        <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {meeting.category}
        </span>

        <span className="absolute bottom-3 right-3 text-xs text-white/80">
          {formatDateTime(meeting.starts_at)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-2 font-semibold text-white">
          {meeting.title}
        </h3>

        <div className="mb-3 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {meeting.address}
          </span>

          {meeting.distance_km !== null && (
            <span>{meeting.distance_km.toFixed(1)} км</span>
          )}
        </div>

        <div className="mb-3 flex items-center gap-1 text-xs text-slate-400">
          <Users size={12} />
          <span>
            {meeting.free_places} из {meeting.capacity}
          </span>
        </div>

        <button
          onClick={() => onJoin?.(meeting.id)}
          disabled={disabled}
          className={`mt-auto w-full rounded-lg py-2.5 text-sm font-medium transition ${
            hasApplication
              ? "cursor-default bg-emerald-600 text-white"
              : disabled
                ? "cursor-not-allowed bg-slate-700 text-slate-400"
                : "bg-blue-600 text-white hover:bg-blue-500"
          }`}
        >
          {buttonText}
        </button>
      </div>
    </article>
  );
}