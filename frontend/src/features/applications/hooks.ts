import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  applyToMeeting,
  decideApplication,
  fetchMeetingApplications,
  fetchMyApplications,
  withdrawMyApplication,
} from "./api";

import type {
  ApplicationStatus,
  ApplyInput,
  DecisionInput,
} from "@/shared/api/schema";

const MY_APPLICATIONS_KEY = "my-applications";
const MEETING_APPLICATIONS_KEY = "meeting-applications";
const MEETINGS_KEY = "meetings";
const MEETING_KEY = "meeting";
const MY_EVENTS_KEY = "my-events";

export function useMyApplications(enabled = true) {
  return useInfiniteQuery({
    queryKey: [MY_APPLICATIONS_KEY],
    queryFn: ({ pageParam }) => fetchMyApplications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled,
  });
}

export function useMeetingApplications(
  meetingId: number,
  status?: ApplicationStatus
) {
  return useInfiniteQuery({
    queryKey: [MEETING_APPLICATIONS_KEY, meetingId, status],
    queryFn: ({ pageParam }) =>
      fetchMeetingApplications(
        meetingId,
        pageParam,
        status
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Number.isFinite(meetingId) && meetingId > 0,
  });
}

export function useApplyToMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      meetingId,
      input,
    }: {
      meetingId: number;
      input?: ApplyInput;
    }) => applyToMeeting(meetingId, input),

    onSuccess: (application) => {
      const meetingId = application.meeting_id;

      void queryClient.invalidateQueries({
        queryKey: [MY_APPLICATIONS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETING_APPLICATIONS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETINGS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MY_EVENTS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETING_KEY, meetingId],
      });
    },
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingId: number) =>
      withdrawMyApplication(meetingId),

    onSuccess: (_, meetingId) => {
      void queryClient.invalidateQueries({
        queryKey: [MY_APPLICATIONS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETING_APPLICATIONS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETINGS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MY_EVENTS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETING_KEY, meetingId],
      });
    },
  });
}

export function useDecideApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      input,
    }: {
      applicationId: number;
      input: DecisionInput;
    }) => decideApplication(applicationId, input),

    onSuccess: (application) => {
      void queryClient.invalidateQueries({
        queryKey: [MY_APPLICATIONS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETING_APPLICATIONS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETINGS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MY_EVENTS_KEY],
      });

      void queryClient.invalidateQueries({
        queryKey: [MEETING_KEY, application.meeting_id],
      });
    },
  });
}