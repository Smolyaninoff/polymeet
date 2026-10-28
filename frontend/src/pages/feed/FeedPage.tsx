import { useState, useMemo } from "react";
import { useMeetingsFeed } from "@/features/meetings/hooks";
import { Banner } from "@/widgets/banner/Banner";
import { FilterSidebar } from "@/widgets/filters/FilterSidebar";
import { MeetingCard } from "@/widgets/meeting-card/MeetingCard";
import { ViewToggle, type ViewMode } from "@/widgets/view-toggle/ViewToggle";
import { MapView } from "@/widgets/mapview/MapView";
import type { FiltersState } from "@/features/meetings/filters/categories";
import type { FeedFilters } from "@/features/meetings/api";
import type { CategoryId } from "@/features/meetings/filters/categories";

function buildApiFilters(
  applied: FiltersState | null,
  query: string
): FeedFilters {
  if (!applied) return { q: query || undefined };

  // Extract selected categories from Record<CategoryId, boolean>
  const selectedCategories = Object.entries(applied.categories || {})
    .filter(([, checked]) => checked)
    .map(([id]) => id as CategoryId);

  return {
    q: query || undefined,
    category: selectedCategories.length === 1 ? selectedCategories[0] : undefined,
    date: applied.date || undefined,
    has_free_places: applied.minSeats ? applied.minSeats > 0 : undefined,
  };
}


export function FeedPage() {
  const [appliedFilters, setAppliedFilters] = useState<FiltersState | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");

  const apiFilters = useMemo(
    () => buildApiFilters(appliedFilters, query),
    [appliedFilters, query]
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useMeetingsFeed(apiFilters);

  const meetings = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );

  // Client-side seat filter (API only supports has_free_places boolean)
  const visibleMeetings = useMemo(() => {
    const minSeats = appliedFilters?.minSeats ?? 0;
    if (minSeats <= 1) return meetings;
    return meetings.filter((m) => m.free_places >= minSeats);
  }, [meetings, appliedFilters]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-75">
        <FilterSidebar onApply={setAppliedFilters} />
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <Banner query={query} onQueryChange={setQuery} />

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">
              Доступные встречи
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">
                {visibleMeetings.length} встреч
              </span>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {isLoading && (
            <p className="text-center text-slate-500">Загрузка...</p>
          )}

          {isError && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              Ошибка: {"status" in (error as Error) ? (error as Error).message : "Не удалось загрузить встречи"}
            </p>
          )}

          {!isLoading && visibleMeetings.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500">
              Ничего не найдено. Попробуйте ослабить фильтры.
            </p>
          )}

          {visibleMeetings.length > 0 && view === "list" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Загрузка..." : "Загрузить ещё"}
                </button>
              )}
            </>
          )}

         {view === "map" && (
            <MapView
              meetings={visibleMeetings}
              apiKey={import.meta.env.VITE_YMAPS_API_KEY || "YOUR_KEY_HERE"}
              onMeetingClick={(id) => console.log("clicked", id)}
            />
          )}
        </section>
      </div>
    </div>
  );
}