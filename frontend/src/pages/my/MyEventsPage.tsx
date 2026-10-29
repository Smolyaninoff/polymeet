import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/context";
import { useMyApplications, MY_APPLICATIONS_KEY } from "@/features/applications/hooks";
import { withdrawMyApplication } from "@/features/applications/api";
import { useMyMeetings } from "@/features/user/hooks";
import { useUpdateMeeting } from "@/features/meetings/hooks";
import {
  fromApplication,
  fromMeeting,
  isThisWeek,
  isUpcoming,
  isWaiting,
  nextMeeting,
  timeUntil,
  type MyEventView,
} from "@/features/my-events/model";
import { MyEventCard } from "@/widgets/my-event-card/MyEventCard";
import { errorMessage } from "@/shared/api/client";

type MainTab = "participant" | "organizer" | "history";
type SubFilter = "all" | "thisWeek" | "waiting";

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "participant", label: "Я участвую" },
  { id: "organizer", label: "Я организатор" },
  { id: "history", label: "История" },
];

const SUB_FILTERS: Record<"participant" | "organizer", { id: SubFilter; label: string }[]> = {
  participant: [
    { id: "all", label: "Все" },
    { id: "thisWeek", label: "На этой неделе" },
    { id: "waiting", label: "Ожидают ответа" },
  ],
  organizer: [
    { id: "all", label: "Все" },
    { id: "thisWeek", label: "На этой неделе" },
    { id: "waiting", label: "Черновики" },
  ],
};

export function MyEventsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<MainTab>("participant");
  const [sub, setSub] = useState<SubFilter>("all");
  const [error, setError] = useState<string>();

  const applications = useMyApplications();
  const meetings = useMyMeetings();
  const updateMeeting = useUpdateMeeting();
  const withdraw = useMutation({
    mutationFn: withdrawMyApplication,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [MY_APPLICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  const events = useMemo<MyEventView[]>(
    () => [
      ...(applications.data?.pages.flatMap((p) => p.items.map(fromApplication)) ?? []),
      ...(meetings.data?.pages.flatMap((p) => p.items.map(fromMeeting)) ?? []),
    ],
    [applications.data, meetings.data]
  );

  const byTab = useMemo(() => {
    const now = new Date();
    const upcoming = events
      .filter((e) => isUpcoming(e, now))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return {
      participant: upcoming.filter((e) => e.role === "participant"),
      organizer: upcoming.filter((e) => e.role === "organizer"),
      history: events
        .filter((e) => !isUpcoming(e, now))
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    };
  }, [events]);

  const visible = useMemo(() => {
    const base = byTab[tab];
    if (tab === "history" || sub === "all") return base;
    return base.filter(sub === "thisWeek" ? (e) => isThisWeek(e) : isWaiting);
  }, [byTab, tab, sub]);

  const next = useMemo(() => nextMeeting(events), [events]);
  const isLoading = applications.isLoading || meetings.isLoading;
  const loadError = applications.error ?? meetings.error;
  const hasMore = applications.hasNextPage || meetings.hasNextPage;

  const handleCancel = async (event: MyEventView) => {
    const question =
      event.role === "organizer"
        ? `Отменить встречу «${event.title}»? Вернуть её будет нельзя.`
        : `Отменить участие во встрече «${event.title}»?`;
    if (!window.confirm(question)) return;
    setError(undefined);
    try {
      if (event.role === "organizer") {
        await updateMeeting.mutateAsync({ id: event.meetingId, input: { status: "cancelled" } });
      } else {
        await withdraw.mutateAsync(event.meetingId);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const handleTabChange = (id: MainTab) => {
    setTab(id);
    setSub("all");
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 space-y-6 lg:w-80">
        <div className="rounded-xl border border-white/10 bg-linear-to-b from-[#1b2440] to-[#131a30] p-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Ближайшая встреча
          </h3>
          {next ? (
            <>
              <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-center text-sm font-semibold text-white">
                {timeUntil(next.startsAt)}
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{next.title}</p>
              {next.address && <p className="mt-1 text-xs text-slate-400">{next.address}</p>}
              <Link
                to={`/meetings/${next.meetingId}`}
                className="mt-4 block rounded-lg bg-blue-600 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Открыть встречу
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              Пока ничего не запланировано.{" "}
              <Link to="/" className="text-blue-400 hover:text-blue-300">
                Найти встречу
              </Link>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-linear-to-b from-[#1b2440] to-[#131a30] p-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Надёжность участника
          </h3>
          <div className="mt-4 grid place-items-center">
            <span className="text-4xl font-bold text-white">
              {user?.attendance_rate == null ? "—" : `${Math.round(user.attendance_rate * 100)}%`}
            </span>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            {user && user.marked_count > 0
              ? `${user.attended_count} посещено / ${user.marked_count - user.attended_count} пропуск`
              : "Появится после первых отметок явки"}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap gap-2">
          {MAIN_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === id
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              )}
            >
              {label} ({byTab[id].length})
            </button>
          ))}
        </div>

        {tab !== "history" && (
          <div className="flex flex-wrap gap-2">
            {SUB_FILTERS[tab].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSub(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs transition-colors",
                  sub === id ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {loadError && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMessage(loadError, "Не удалось загрузить ваши события")}
          </p>
        )}
        {isLoading && <p className="text-center text-sm text-slate-500">Загрузка…</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((event) => (
            <MyEventCard
              key={event.key}
              event={event}
              onCancel={tab !== "history" ? handleCancel : undefined}
              isBusy={withdraw.isPending || updateMeeting.isPending}
            />
          ))}
        </div>

        {!isLoading && visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500">
            {tab === "organizer"
              ? "Вы ещё не создали ни одной встречи — нажмите «Создать встречу»."
              : tab === "participant"
                ? "Вы пока никуда не записаны."
                : "История пуста."}
          </p>
        )}

        {hasMore && (
          <button
            onClick={() => {
              if (applications.hasNextPage) applications.fetchNextPage();
              if (meetings.hasNextPage) meetings.fetchNextPage();
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm text-white hover:bg-white/10"
          >
            Загрузить ещё
          </button>
        )}
      </div>
    </div>
  );
}
