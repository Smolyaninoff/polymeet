import { useState } from "react";
import { Pencil } from "lucide-react";
import { useUpdateMeeting } from "@/features/meetings/hooks";
import { hasStarted } from "@/features/meetings/labels";
import { errorMessage, fieldErrors } from "@/shared/api/client";
import type { MeetingOut } from "@/shared/api/schema";

interface OrganizerPanelProps {
  meeting: MeetingOut;
  onEdit?: () => void;
}

/** Управление встречей для организатора: публикация, отмена, правка. */
export function OrganizerPanel({ meeting, onEdit }: OrganizerPanelProps) {
  const update = useUpdateMeeting();
  const [error, setError] = useState<string>();

  const changeStatus = async (status: "published" | "cancelled") => {
    if (status === "cancelled" && !window.confirm("Отменить встречу? Вернуть её будет нельзя.")) {
      return;
    }
    setError(undefined);
    try {
      await update.mutateAsync({ id: meeting.id, input: { status } });
    } catch (e) {
      setError(fieldErrors(e).starts_at ?? errorMessage(e));
    }
  };

  const editable = meeting.status === "draft" || meeting.status === "published";

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-[#131a30] p-5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Вы организатор
      </h2>

      {meeting.status === "draft" && (
        <>
          <p className="text-sm text-slate-400">
            Это черновик: встречу видите только вы. Опубликуйте её, чтобы она появилась в ленте.
          </p>
          <button
            onClick={() => changeStatus("published")}
            disabled={update.isPending}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            Опубликовать
          </button>
        </>
      )}

      {editable && onEdit && (
        <button
          onClick={onEdit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/15"
        >
          <Pencil size={14} />
          Редактировать
        </button>
      )}

      {editable && !(meeting.status === "published" && hasStarted(meeting.starts_at)) && (
        <button
          onClick={() => changeStatus("cancelled")}
          disabled={update.isPending}
          className="w-full rounded-lg border border-red-500/30 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-60"
        >
          Отменить встречу
        </button>
      )}

      {meeting.status === "cancelled" && (
        <p className="text-sm text-slate-400">Встреча отменена, изменить её нельзя.</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
