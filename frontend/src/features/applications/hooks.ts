import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApplicationStatus, DecisionInput } from "@/shared/api/schema";
import {
  applyToMeeting,
  decideApplication,
  fetchMeetingApplications,
  fetchMyApplications,
  withdrawMyApplication,
} from "./api";

export const APPLICATIONS_KEY = "applications";
export const MY_APPLICATIONS_KEY = "my-applications";

export function useMeetingApplications(
  meetingId: number,
  status: ApplicationStatus | undefined,
  enabled: boolean
) {
  return useInfiniteQuery({
    queryKey: [APPLICATIONS_KEY, meetingId, status],
    queryFn: ({ pageParam }) => fetchMeetingApplications(meetingId, status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
  });
}

export function useMyApplications() {
  return useInfiniteQuery({
    queryKey: [MY_APPLICATIONS_KEY],
    queryFn: ({ pageParam }) => fetchMyApplications(undefined, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

/** После любой операции с заявками меняются счётчики встречи, очередь и мои заявки. */
function useInvalidateMeeting(meetingId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
    qc.invalidateQueries({ queryKey: ["meetings"] });
    qc.invalidateQueries({ queryKey: [APPLICATIONS_KEY, meetingId] });
    qc.invalidateQueries({ queryKey: [MY_APPLICATIONS_KEY] });
  };
}

export function useApply(meetingId: number) {
  const invalidate = useInvalidateMeeting(meetingId);
  return useMutation({
    mutationFn: (message?: string) => applyToMeeting(meetingId, message),
    onSettled: invalidate,
  });
}

export function useWithdraw(meetingId: number) {
  const invalidate = useInvalidateMeeting(meetingId);
  return useMutation({
    mutationFn: () => withdrawMyApplication(meetingId),
    onSettled: invalidate,
  });
}

export function useDecide(meetingId: number) {
  const invalidate = useInvalidateMeeting(meetingId);
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: DecisionInput["decision"] }) =>
      decideApplication(id, decision),
    onSettled: invalidate,
  });
}
