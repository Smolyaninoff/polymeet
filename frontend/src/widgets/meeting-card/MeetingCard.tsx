import { MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { MeetingListItem } from "@/shared/api/schema";
import { categoryImage, categoryLabel } from "@/features/meetings/labels";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MeetingCardProps {
  meeting: MeetingListItem;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const imageUrl = categoryImage(meeting.category);
  const isFull = meeting.free_places === 0;
  const href = `/meetings/${meeting.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#131a30] transition hover:border-white/20">
      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={imageUrl}
          alt={meeting.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#131a30] to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {categoryLabel(meeting.category)}
        </span>
        <span className="absolute right-3 bottom-3 text-xs text-white/80">
          {formatDateTime(meeting.starts_at)}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-2 font-semibold text-white">
          <Link to={href} className="hover:text-blue-300">
            {meeting.title}
          </Link>
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

        <Link
          to={href}
          className={`mt-auto block w-full rounded-lg py-2.5 text-center text-sm font-medium transition ${
            isFull
              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
              : "bg-blue-600 text-white hover:bg-blue-500"
          }`}
        >
          {isFull ? "Мест нет · лист ожидания" : "Подать заявку"}
        </Link>
      </div>
    </article>
  );
}