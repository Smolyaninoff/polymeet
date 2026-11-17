import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Route,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MyEvent } from "@/features/meetings/types";
import { CATEGORIES } from "@/features/meetings/filters/categories";
import { formatMeetingDate } from "@/widgets/meeting-card/format";

interface MyEventCardProps {
  event: MyEvent;
  onChat?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCancelApplication?: (id: string) => void;
}

const STATUS_CONFIG: Record<MyEvent["status"], { dot: string; label: string }> = {
  approved: { dot: "bg-emerald-500", label: "Одобрено" },
  pending: { dot: "bg-amber-500", label: "На рассмотрении" },
  confirmed: { dot: "bg-blue-500", label: "Подтверждено" },
  completed: { dot: "bg-slate-500", label: "Завершено" },
  cancelled: { dot: "bg-red-500", label: "Отменено" },
};

export function MyEventCard({
  event,
  onChat,
  onEdit,
  onDelete,
  onCancelApplication,
}: MyEventCardProps) {
  const category = CATEGORIES.find((c) => c.id === event.categoryId);
  const status = STATUS_CONFIG[event.status];

  // Dropdown state + ref (ref lives in component, not hook return)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
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
const canChat =
  event.role === "organizer" || event.status === "approved";

const menuOptions = [
  ...(canChat
    ? [
        {
          icon: MessageSquare,
          label: "Чат встречи",
          onClick: () => onChat?.(event.id),
          danger: false,
        },
      ]
    : []),
  ...(event.role === "organizer"
    ? [
        {
          icon: Pencil,
          label: "Редактировать",
          onClick: () => onEdit?.(event.id),
          danger: false,
        },
        {
          icon: Trash2,
          label: "Удалить встречу",
          onClick: () => onDelete?.(event.id),
          danger: true,
        },
      ]
    : [
        {
          icon: XCircle,
          label: "Отменить заявку",
          onClick: () => onCancelApplication?.(event.id),
          danger: true,
        },
      ]),
];
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#131a30]">
      {/* Image header */}
      <div
        className="relative h-36 bg-cover bg-center"
        style={{ backgroundImage: `url(${event.imageUrl})` }}
      >
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />

        {/* Top-left: category + status */}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          {category && (
            <div className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
              <category.icon size={12} className="text-blue-400" />
              {category.label}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </div>
        </div>

        {/* Top-right: date */}
        <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
          {formatMeetingDate(event.date)}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white">{event.title}</h3>

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {event.address}
          </span>
          {event.distanceKm !== null && (
            <span className="ml-auto">{event.distanceKm} км</span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {event.lat !== null && event.lng !== null && (
            <a
              href={`https://yandex.ru/maps/?rtext=~${event.lat},${event.lng}&rtt=pd`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Route size={13} />
              Маршрут
            </a>
          )}

          {(event.role === "organizer" || event.status === "approved") && (
            <button
              onClick={() => onChat?.(event.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <MessageSquare size={13} />
              Чат встречи
            </button>
          )}

          {/* Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Ещё"
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full right-0 z-20 mb-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-[#1b2440] py-1 shadow-xl">
                {menuOptions.map(({ icon: Icon, label, onClick, danger }) => (
                  <button
                    key={label}
                    onClick={() => {
                      onClick();
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors",
                      danger
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}