import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDecide, useMeetingApplications } from "@/features/applications/hooks";
import { reliabilityText } from "@/features/meetings/labels";
import { ApiError } from "@/shared/api/schema";
import { errorMessage } from "@/shared/api/client";
import type { ApplicationOut, ApplicationStatus, MeetingOut } from "@/shared/api/schema";

const TABS: { id: ApplicationStatus; label: string }[] = [
  { id: "pending", label: "Новые" },
  { id: "accepted", label: "Приняты" },
  { id: "waitlist", label: "Лист ожидания" },
  { id: "rejected", label: "Отклонены" },
];

function decisionError(error: unknown): string {
  if (error instanceof ApiError && error.code === "CAPACITY_REACHED") {
    return "Мест нет. Увеличьте лимит участников или откажите кому-то из принятых.";
  }
  return errorMessage(error);
}

/** Очередь заявок для организатора: вкладки по статусам, решения «принять / отклонить». */
export function ApplicationsQueue({ meeting }: { meeting: MeetingOut }) {
  const [tab, setTab] = useState<ApplicationStatus>("pending");
  const [error, setError] = useState<string>();
  const decide = useDecide(meeting.id);
  const { data, isLoading, hasNextPage, fetchNextPage } = useMeetingApplications(
    meeting.id,
    tab,
    true
  );
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const canDecide = meeting.status === "published";

  const act = async (application: ApplicationOut, decision: "accepted" | "rejected") => {
    setError(undefined);
    try {
      await decide.mutateAsync({ id: application.id, decision });
    } catch (e) {
      setError(decisionError(e));
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-[#131a30] p-5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">Заявки</h2>

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === id ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {isLoading && <p className="text-sm text-slate-500">Загрузка…</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-slate-500">Здесь пока пусто.</p>
      )}

      <ul className="space-y-3">
        {items.map((application, index) => (
          <li key={application.id} className="rounded-lg bg-white/5 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-white">
                {tab === "waitlist" && <span className="mr-2 text-slate-500">#{index + 1}</span>}
                {application.user.display_name}
              </span>
              <span className="text-xs text-slate-500">
                {reliabilityText(application.user.attendance_rate)}
              </span>
            </div>
            {application.message && (
              <p className="mt-2 text-sm text-slate-300">«{application.message}»</p>
            )}
            {canDecide && tab !== "rejected" && (
              <div className="mt-3 flex gap-2">
                {tab !== "accepted" && (
                  <button
                    onClick={() => act(application, "accepted")}
                    disabled={decide.isPending}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    Принять
                  </button>
                )}
                <button
                  onClick={() => act(application, "rejected")}
                  disabled={decide.isPending}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-60"
                >
                  Отклонить
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          className="w-full rounded-lg bg-white/5 py-2 text-xs text-slate-300 hover:bg-white/10"
        >
          Показать ещё
        </button>
      )}
    </section>
  );
}
