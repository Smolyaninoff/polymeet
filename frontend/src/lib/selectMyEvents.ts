import type { MyEvent, UserRole } from "../features/meetings/types";

/** Internal: is this event in the past or terminal? */
function isHistorical(event: MyEvent, now = new Date()): boolean {
  return (
    event.status === "completed" ||
    event.status === "cancelled" ||
    new Date(event.date) < now
  );
}

/** Internal: is this event active (not historical)? */
function isActive(event: MyEvent, now = new Date()): boolean {
  return !isHistorical(event, now);
}

// ==================== TABS ====================

/** Participant or Organizer tab — excludes history */
export function selectByRole(
  events: MyEvent[],
  role: UserRole,
  now = new Date()
): MyEvent[] {
  return events.filter((e) => e.role === role && isActive(e, now));
}

/** History tab — completed, cancelled, or past */
export function selectHistory(
  events: MyEvent[],
  now = new Date()
): MyEvent[] {
  return events.filter((e) => isHistorical(e, now));
}

// ==================== SUB-FILTERS ====================

/** Within next 7 days */
export function selectThisWeek(
  events: MyEvent[],
  now = new Date()
): MyEvent[] {
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);
  return events.filter((e) => {
    const d = new Date(e.date);
    return d >= now && d <= weekLater;
  });
}

/** Status pending — waiting for approval/response */
export function selectPending(events: MyEvent[]): MyEvent[] {
  return events.filter((e) => e.status === "pending");
}

// ==================== DERIVED CARDS ====================

/** Nearest future approved meeting for the "Next meeting" widget */
export function selectNextMeeting(
  events: MyEvent[],
  role: UserRole,
  now = new Date()
): MyEvent | undefined {
  const candidates = events
    .filter((e) => e.role === role && e.status === "approved" && new Date(e.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return candidates[0];
}

/** Count pending items for a badge — e.g. organizer tab's "3 заявки" */
export function countPending(events: MyEvent[], role: UserRole): number {
  return selectByRole(events, role).filter((e) => e.status === "pending").length;
}