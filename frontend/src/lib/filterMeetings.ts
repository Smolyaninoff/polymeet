import type { Meeting } from "../features/meetings/types";
import type { FiltersState } from "../features/meetings/filters/categories";

export function filterMeetings<T extends Meeting>(
  meetings: T[],
  filters: FiltersState | null,
  query: string
): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  return meetings.filter((meeting) => {
    if (filters) {
      if (!filters.categories[meeting.categoryId]) return false;
      if (
        meeting.distanceKm !== null &&
        meeting.distanceKm > filters.radiusKm
      ) {
        return false;
      }
      if (meeting.freeSeats < filters.minSeats) return false;

      if (
        filters.date &&
        !meeting.date.startsWith(filters.date)
      ) {
        return false;
      }
    }

    if (
      normalizedQuery &&
      !meeting.title.toLowerCase().includes(normalizedQuery) &&
      !meeting.address.toLowerCase().includes(normalizedQuery)
    ) {
      return false;
    }

    return true;
  });
}