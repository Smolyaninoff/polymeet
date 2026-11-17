import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchMe, fetchPublicUser, fetchMyMeetings, updateMe } from "./api";

const USER_KEY = "user";
const MY_MEETINGS_KEY = "my-meetings";

export function useMe() {
  return useQuery({
    queryKey: [USER_KEY, "me"],
    queryFn: fetchMe,
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      queryClient.setQueryData([USER_KEY, "me"], user);
    },
  });
}

export function usePublicUser(id: number) {
  return useQuery({
    queryKey: [USER_KEY, id],
    queryFn: () => fetchPublicUser(id),
    enabled: !!id,
  });
}

export function useMyMeetings(enabled = true) {
  return useInfiniteQuery({
    queryKey: [MY_MEETINGS_KEY],
    queryFn: ({ pageParam }) => fetchMyMeetings(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
  });
}
