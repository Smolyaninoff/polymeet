import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { fetchMe, fetchPublicUser, fetchMyMeetings } from "./api";

const USER_KEY = "user";
const MY_MEETINGS_KEY = "my-meetings";

export function useMe() {
  return useQuery({
    queryKey: [USER_KEY, "me"],
    queryFn: fetchMe,
  });
}

export function usePublicUser(id: number) {
  return useQuery({
    queryKey: [USER_KEY, id],
    queryFn: () => fetchPublicUser(id),
    enabled: !!id,
  });
}

export function useMyMeetings() {
  return useInfiniteQuery({
    queryKey: [MY_MEETINGS_KEY],
    queryFn: ({ pageParam }) => fetchMyMeetings(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}