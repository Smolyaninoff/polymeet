import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { filterMeetings } from "@/lib/filterMeetings";
import {
  selectByRole,
  selectHistory,
  selectPending,
  selectThisWeek,
} from "@/lib/selectMyEvents";

import type { FiltersState } from "@/features/meetings/filters/categories";
import { useUpdateMeeting } from "@/features/meetings/hooks";
import { useWithdrawApplication } from "@/features/applications/hooks";

import { FilterSidebar } from "@/widgets/filters/FilterSidebar";
import { MyEventCard } from "@/widgets/my-event-card/MyEventCard";
import { ApplicationsDialog } from "@/widgets/applications/ApplicationsDialog";
import { CreateMeetingModal } from "@/widgets/create-meeting/CreateMeetingModal";
import { useMeeting } from "@/features/meetings/hooks";
import { ChatSheet } from "@/widgets/chat/ChatSheet";

import { useMyEvents } from "./useMyEvents";

type MainTab = "participant" | "organizer" | "history";
type SubFilter = "all" | "thisWeek" | "pending";
const TABS: { id: MainTab; label: string }[] = [
  { id: "participant", label: "Я участвую" },
  { id: "organizer", label: "Я организатор" },
  { id: "history", label: "История" },
];

const SUB_FILTERS: { id: SubFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "thisWeek", label: "На этой неделе" },
  { id: "pending", label: "Ожидают ответа" },
];

export function MyEventsPage() {
  const queryClient = useQueryClient();
  const eventsQuery = useMyEvents();
  const withdrawMutation = useWithdrawApplication();
  const updateMeetingMutation = useUpdateMeeting();

  const [tab, setTab] = useState<MainTab>("participant");
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [filters, setFilters] = useState<FiltersState | null>(null);
  const [applicationsId, setApplicationsId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = useMeeting(Number(editId));
  const [chatMeetingId, setChatMeetingId] = useState<string | null>(null);

  const events = useMemo(
    () => eventsQuery.data ?? [],
    [eventsQuery.data]
  );

  const visibleEvents = useMemo(() => {
    let result =
      tab === "history"
        ? selectHistory(events)
        : selectByRole(events, tab);

    if (subFilter === "thisWeek") result = selectThisWeek(result);
    if (subFilter === "pending") result = selectPending(result);

    return filterMeetings(result, filters, "");
  }, [events, tab, subFilter, filters]);

  const counts: Record<MainTab, number> = {
    participant: selectByRole(events, "participant").length,
    organizer: selectByRole(events, "organizer").length,
    history: selectHistory(events).length,
  };

  const nextMeeting =
    tab === "history"
      ? undefined
      : selectByRole(events, tab)
          .filter(
            (event) =>
              event.status === "approved" ||
              event.status === "confirmed"
          )
          .sort(
            (a, b) =>
              new Date(a.date).getTime() -
              new Date(b.date).getTime()
          )[0];

  const refreshEvents = () =>
    queryClient.invalidateQueries({ queryKey: ["my-events"] });

  const cancelApplication = (id: string) => {
    if (!window.confirm("Отменить заявку на участие?")) return;

    withdrawMutation.mutate(Number(id), {
      onSuccess: refreshEvents,
    });
  };

  const cancelMeeting = (id: string) => {
    if (!window.confirm("Отменить эту встречу?")) return;

    updateMeetingMutation.mutate(
      {
        id: Number(id),
        input: { status: "cancelled" },
      },
      { onSuccess: refreshEvents }
    );
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 space-y-6 lg:w-80">
        <FilterSidebar onApply={setFilters} />

        {nextMeeting && (
          <section className="rounded-xl border border-white/10 bg-[#131a30] p-5">
            <h3 className="text-xs uppercase text-slate-400">
              Ближайшая встреча
            </h3>

            <p className="mt-3 font-semibold text-white">
              {nextMeeting.title}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(nextMeeting.date).toLocaleString("ru-RU")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {nextMeeting.address}
            </p>

            <button
              onClick={() => setChatMeetingId(nextMeeting.id)}
              className="mt-4 w-full rounded-lg bg-white/10 py-2 text-xs font-semibold text-white"
            >
              Чат встречи
            </button>
          </section>
        )}
      </aside>

      <main className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setSubFilter("all");
              }}
              className={cn(
                "rounded-lg px-4 py-2 text-sm",
                tab === item.id
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-slate-400"
              )}
            >
              {item.label} ({counts[item.id]})
            </button>
          ))}
        </div>

        {tab !== "history" && (
          <div className="flex gap-2">
            {SUB_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSubFilter(filter.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  subFilter === filter.id
                    ? "bg-white/10 text-white"
                    : "text-slate-500"
                )}
              >
                {tab === "organizer" && filter.id === "pending"
                  ? "Черновики"
                  : filter.label}
              </button>
            ))}
          </div>
        )}

        {eventsQuery.isLoading && (
          <p className="p-10 text-center text-slate-400">
            Загрузка событий…
          </p>
        )}

        {eventsQuery.isError && (
          <p className="rounded-xl bg-red-500/10 p-4 text-red-300">
            {eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : "Не удалось загрузить события"}
          </p>
        )}

        {!eventsQuery.isLoading && !eventsQuery.isError && (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleEvents.map((event) => (
              <MyEventCard
                key={`${event.role}-${event.id}`}
                event={event}
                onChat={setChatMeetingId}
                onApplications={setApplicationsId}
                onEdit={setEditId}
                onDelete={cancelMeeting}
                onCancelApplication={cancelApplication}
              />
            ))}
          </div>
        )}

        {!eventsQuery.isLoading &&
          !eventsQuery.isError &&
          visibleEvents.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-10 text-center text-slate-500">
              Здесь пока нет событий.
            </p>
          )}
      </main>

      {applicationsId && <ApplicationsDialog meetingId={Number(applicationsId)} onClose={() => setApplicationsId(null)} />}
      {editId && editing.data && <CreateMeetingModal key={editId} isOpen mode="edit" onClose={() => setEditId(null)}
        initialData={{ title: editing.data.title, categoryId: editing.data.category as import("@/features/meetings/filters/categories").CategoryId, description: editing.data.description, date: editing.data.starts_at, maxSeats: editing.data.capacity, address: editing.data.address }}
        onSubmit={async (data) => { await updateMeetingMutation.mutateAsync({ id: Number(editId), input: { title: data.title.trim(), description: data.description.trim(), category: data.categoryId, starts_at: new Date(data.date).toISOString(), capacity: data.maxSeats, address: data.address.trim() } }); await refreshEvents(); }} />}
      <ChatSheet
        meetingId={chatMeetingId}
        isOpen={chatMeetingId !== null}
        onClose={() => setChatMeetingId(null)}
      />
    </div>
  );
}