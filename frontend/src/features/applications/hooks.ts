import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchMeetings,
  fetchMeeting,
  createMeeting,
  updateMeeting,
  fetchMeetingMap,
  type FeedFilters,
} from "./api";
import type { UpdateMeetingInput } from "@/shared/api/schema";

const MEETINGS_KEY = "meetings";
const MEETING_KEY = "meeting";

export function useMeetingsFeed(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: [MEETINGS_KEY, filters],
    queryFn: ({ pageParam }) => fetchMeetings(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useMeetingMap(bbox: string, filters: Omit<FeedFilters, "lat" | "lon" | "radius_km">) {
  return useQuery({
    queryKey: [MEETINGS_KEY, "map", bbox, filters],
    queryFn: () => fetchMeetingMap(bbox, filters),
    enabled: !!bbox,
  });
}

export function useMeeting(id: number) {
  return useQuery({
    queryKey: [MEETING_KEY, id],
    queryFn: () => fetchMeeting(id),
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MEETINGS_KEY] });
    },
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateMeetingInput }) =>
      updateMeeting(id, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [MEETING_KEY, vars.id] });
      qc.invalidateQueries({ queryKey: [MEETINGS_KEY] });
    },
  });
}