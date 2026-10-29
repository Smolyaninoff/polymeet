import { useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/context";
import { useMeeting, useUpdateMeeting } from "@/features/meetings/hooks";
import type { MeetingFormData } from "@/features/meetings/types";
import { formFromMeeting } from "@/lib/buildMeetingForm";
import { toUpdateInput } from "@/lib/meetingPayload";
import { CreateMeetingModal } from "@/widgets/create-meeting/CreateMeetingModal";
import {
  GEO_STATUS_HINT,
  MEETING_STATUS,
  categoryImage,
  categoryLabel,
  formatDuration,
  reliabilityText,
} from "@/features/meetings/labels";
import { formatMeetingDate } from "@/widgets/meeting-card/format";
import { ParticipationPanel } from "@/widgets/meeting-details/ParticipationPanel";
import { OrganizerPanel } from "@/widgets/meeting-details/OrganizerPanel";
import { ApplicationsQueue } from "@/widgets/meeting-details/ApplicationsQueue";
import { NotFoundPage } from "@/pages/not-found/NotFoundPage";
import { ApiError } from "@/shared/api/schema";
import { errorMessage } from "@/shared/api/client";

export function MeetingPage() {
  const id = Number(useParams().id);
  const { user } = useAuth();
  const { data: meeting, isLoading, error } = useMeeting(Number.isInteger(id) && id > 0 ? id : 0);
  const update = useUpdateMeeting();
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (!Number.isInteger(id) || id <= 0) return <NotFoundPage text="Встреча не найдена" />;
  if (isLoading) return <p className="py-10 text-center text-sm text-slate-500">Загрузка…</p>;
  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage text="Встреча не найдена" />;
  }
  if (error || !meeting) {
    return (
      <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        {errorMessage(error, "Не удалось загрузить встречу")}
      </p>
    );
  }

  const isOrganizer = user?.id === meeting.organizer.id;
  const initialForm = formFromMeeting(meeting);

  const handleEdit = async (form: MeetingFormData) => {
    const changes = toUpdateInput(form, initialForm);
    if (Object.keys(changes).length === 0) return;
    await update.mutateAsync({ id: meeting.id, input: changes });
  };
  const status = MEETING_STATUS[meeting.status];
  const geoHint = GEO_STATUS_HINT[meeting.geo_status];
  const mapUrl =
    meeting.lat !== null && meeting.lon !== null
      ? `https://yandex.ru/maps/?pt=${meeting.lon},${meeting.lat}&z=16&l=map`
      : null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <article className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#131a30]">
        <div className="relative h-56 overflow-hidden">
          <img
            src={categoryImage(meeting.category)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-[#131a30] to-transparent" />
          <div className="absolute left-4 top-4 flex gap-2">
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {categoryLabel(meeting.category)}
            </span>
            {meeting.status !== "published" && (
              <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                <span className={cn("size-1.5 rounded-full", status.dot)} />
                {status.label}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-5 p-6">
          <h1 className="text-2xl font-semibold text-white">{meeting.title}</h1>

          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <span className="flex items-center gap-2">
              <CalendarDays size={16} className="text-blue-400" />
              {formatMeetingDate(meeting.starts_at)}
            </span>
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              {formatDuration(meeting.duration_minutes)}
            </span>
            <span className="flex items-start gap-2 sm:col-span-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-blue-400" />
              <span>
                {meeting.address}
                {meeting.address_hint && (
                  <span className="block text-xs text-slate-400">{meeting.address_hint}</span>
                )}
                {geoHint && <span className="block text-xs text-amber-400">{geoHint}</span>}
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-blue-400 hover:text-blue-300"
                  >
                    Открыть на карте
                  </a>
                )}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              {meeting.accepted_count} из {meeting.capacity} · свободно {meeting.free_places}
            </span>
          </div>

          {meeting.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {meeting.description}
            </p>
          )}

          <div className="rounded-lg bg-white/5 px-4 py-3 text-sm">
            <span className="text-slate-400">Организатор: </span>
            <span className="font-medium text-white">{meeting.organizer.display_name}</span>
            <span className="text-slate-500"> · {reliabilityText(meeting.organizer.attendance_rate)}</span>
          </div>
        </div>
      </article>

      <aside className="w-full shrink-0 space-y-4 lg:w-96">
        {isOrganizer ? (
          <>
            <OrganizerPanel meeting={meeting} onEdit={() => setIsEditOpen(true)} />
            {meeting.status !== "draft" && <ApplicationsQueue meeting={meeting} />}
          </>
        ) : (
          <ParticipationPanel meeting={meeting} user={user} />
        )}
      </aside>

      {isOrganizer && isEditOpen && (
        <CreateMeetingModal
          isOpen
          mode="edit"
          initialData={initialForm}
          onClose={() => setIsEditOpen(false)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  );
}
