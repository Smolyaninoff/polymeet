import {
  apiDelete,
  apiGet,
  apiPost,
} from "@/shared/api/client";

import type {
  ApplicationOut,
  ApplicationPage,
  ApplicationStatus,
  ApplyInput,
  DecisionInput,
  MyApplicationPage,
} from "@/shared/api/schema";

/** Submit an application to participate in a meeting. */
export async function applyToMeeting(
  meetingId: number,
  input: ApplyInput = {}
): Promise<ApplicationOut> {
  return apiPost<ApplicationOut>(
    `/meetings/${meetingId}/applications`,
    input
  );
}

/** Withdraw the current user's application. */
export async function withdrawMyApplication(
  meetingId: number
): Promise<void> {
  return apiDelete(`/meetings/${meetingId}/applications/me`);
}

/** Get the current user's applications. */
export async function fetchMyApplications(
  cursor?: string,
  limit = 50
): Promise<MyApplicationPage> {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return apiGet<MyApplicationPage>(
    `/users/me/applications?${params.toString()}`
  );
}

/** Get applications submitted to an organizer's meeting. */
export async function fetchMeetingApplications(
  meetingId: number,
  cursor?: string,
  status?: ApplicationStatus,
  limit = 20
): Promise<ApplicationPage> {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (status) {
    params.set("status", status);
  }

  return apiGet<ApplicationPage>(
    `/meetings/${meetingId}/applications?${params.toString()}`
  );
}

/** Accept or reject an application as the meeting organizer. */
export async function decideApplication(
  applicationId: number,
  input: DecisionInput
): Promise<ApplicationOut> {
  return apiPost<ApplicationOut>(
    `/applications/${applicationId}/decision`,
    input
  );
}