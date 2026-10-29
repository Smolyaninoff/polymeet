import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, MoreHorizontal, Pencil, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MyEventView } from "@/features/my-events/model";
import {
  APPLICATION_STATUS,
  MEETING_STATUS,
  categoryImage,
  categoryLabel,
} from "@/features/meetings/labels";
import { formatMeetingDate } from "@/widgets/meeting-card/format";

interface MyEventCardProps {
  event: MyEventView;
  /** Только для актуальных событий: отменить встречу (организатор) или участие */
  onCancel?: (event: MyEventView) => void;
  isBusy?: boolean;
}

function statusOf(event: MyEventView) {
  if (event.meetingStatus === "cancelled") return MEETING_STATUS.cancelled;
  if (event.role === "participant" && event.applicationStatus) {
    return APPLICATION_STATUS[event.applicationStatus];
  }
  return MEETING_STATUS[event.meetingStatus];
}

export function MyEventCard({ event, onCancel, isBusy }: MyEventCardProps) {
  const status = statusOf(event);
  const href = `/meetings/${event.meetingId}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const menuOptions = [
    ...(event.role === "organizer"
      ? [{ icon: Pencil, label: "Открыть и редактировать", to: href }]
      : []),
    ...(onCancel
      ? [
          {
            icon: XCircle,
            label: event.role === "organizer" ? "Отменить встречу" : "Отменить участие",
            onClick: () => onCancel(event),
          },
        ]
      : []),
  ];

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#131a30]">
      <div
        className="relative h-36 bg-cover bg-center"
        style={{ backgroundImage: `url(${categoryImage(event.category ?? "other")})` }}
      >
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          {event.category && (
            <div className="rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
              {categoryLabel(event.category)}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </div>
        </div>
        <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
          {formatMeetingDate(event.startsAt)}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-semibold text-white">
          <Link to={href} className="hover:text-blue-300">
            {event.title}
          </Link>
        </h3>

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          {event.address && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{event.address}</span>
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <Users size={12} />
            {event.acceptedCount} из {event.capacity}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Link
            to={href}
            className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {event.role === "organizer" ? "Заявки и управление" : "Подробнее"}
          </Link>

          {menuOptions.length > 0 && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                disabled={isBusy}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
                aria-label="Ещё"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div className="absolute bottom-full right-0 z-20 mb-2 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#1b2440] py-1 shadow-xl">
                  {menuOptions.map((option) =>
                    "to" in option ? (
                      <Link
                        key={option.label}
                        to={option.to}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <option.icon size={14} />
                        {option.label}
                      </Link>
                    ) : (
                      <button
                        key={option.label}
                        onClick={() => {
                          option.onClick();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <option.icon size={14} />
                        {option.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
