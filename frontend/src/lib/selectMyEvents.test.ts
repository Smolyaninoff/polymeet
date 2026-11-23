import { describe, expect, it } from "vitest";
import type { MyEvent } from "@/features/meetings/types";
import { selectByRole, selectHistory, selectPending, selectThisWeek } from "./selectMyEvents";

const now = new Date("2030-01-01T12:00:00Z");
function event(id: string, overrides: Partial<MyEvent> = {}): MyEvent {
  return {
    id, title: "Встреча", categoryId: "games", address: "Адрес", lat: null, lng: null,
    distanceKm: null, date: "2030-01-02T12:00:00Z", freeSeats: 2, imageUrl: "",
    status: "approved", role: "participant", hasRoute: false, ...overrides,
  };
}

describe("разделение моих встреч", () => {
  it("отделяет будущие встречи участника и организатора от истории", () => {
    const events = [
      event("participant"), event("organizer", { role: "organizer" }),
      event("past", { date: "2029-12-31T12:00:00Z" }),
      event("cancelled", { status: "cancelled" }),
      event("completed", { status: "completed" }),
    ];
    expect(selectByRole(events, "participant", now).map((item) => item.id)).toEqual(["participant"]);
    expect(selectByRole(events, "organizer", now).map((item) => item.id)).toEqual(["organizer"]);
    expect(selectHistory(events, now).map((item) => item.id)).toEqual(["past", "cancelled", "completed"]);
  });

  it("выбирает ожидающие заявки и встречи в ближайшие семь дней", () => {
    const events = [event("pending", { status: "pending" }), event("later", { date: "2030-02-01T12:00:00Z" })];
    expect(selectPending(events).map((item) => item.id)).toEqual(["pending"]);
    expect(selectThisWeek(events, now).map((item) => item.id)).toEqual(["pending"]);
  });
});
