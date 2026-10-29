import { apiDelete, apiGet, apiPost } from "@/shared/api/client";
import type {
  ApplicationOut,
  ApplicationPage,
  ApplicationStatus,
  DecisionInput,
  MyApplicationPage,
} from "@/shared/api/schema";

function pageQuery(status?: ApplicationStatus, cursor?: string, limit = 20): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

/** Подать заявку. Статус новой заявки: accepted (автоприём), waitlist (мест нет) или pending. */
export async function applyToMeeting(meetingId: number, message?: string): Promise<ApplicationOut> {
  const text = message?.trim();
  return apiPost<ApplicationOut>(
    `/meetings/${meetingId}/applications`,
    text ? { message: text } : undefined
  );
}

/** Отменить участие; освободившееся место получает первый из листа ожидания. */
export async function withdrawMyApplication(meetingId: number): Promise<void> {
  return apiDelete(`/meetings/${meetingId}/applications/me`);
}

/** Решение организатора по заявке. */
export async function decideApplication(
  applicationId: number,
  decision: DecisionInput["decision"]
): Promise<ApplicationOut> {
  return apiPost<ApplicationOut>(`/applications/${applicationId}/decision`, { decision });
}

/** Очередь заявок на встречу (только организатор), в порядке подачи. */
export async function fetchMeetingApplications(
  meetingId: number,
  status?: ApplicationStatus,
  cursor?: string
): Promise<ApplicationPage> {
  return apiGet<ApplicationPage>(
    `/meetings/${meetingId}/applications?${pageQuery(status, cursor, 50)}`
  );
}

/** Мои заявки, новые сначала. */
export async function fetchMyApplications(
  status?: ApplicationStatus,
  cursor?: string
): Promise<MyApplicationPage> {
  return apiGet<MyApplicationPage>(`/users/me/applications?${pageQuery(status, cursor, 50)}`);
}
