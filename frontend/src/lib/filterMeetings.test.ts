import { describe, expect, it } from "vitest";
import { filterMeetings } from "./filterMeetings";
import type { Meeting } from "../features/meetings/types";
import { allCategoriesSelected } from "../features/meetings/filters/categories";

const meetings: Meeting[] = [
  {
    id: "1", title: "Настольные игры", categoryId: "games", address: "Политехническая 29",
    lat: 60, lng: 30, distanceKm: 2, date: "2027-01-20T12:00:00", freeSeats: 3, imageUrl: "",
  },
  {
    id: "2", title: "Пробежка", categoryId: "sport", address: "Парк",
    lat: 60, lng: 30, distanceKm: 8, date: "2027-01-21T12:00:00", freeSeats: 1, imageUrl: "",
  },
];

describe("фильтрация встреч", () => {
  it("ищет без учёта регистра по адресу и названию", () => {
    expect(filterMeetings(meetings, null, "  ПОЛИТЕХНИЧЕСКАЯ ").map((m) => m.id)).toEqual(["1"]);
    expect(filterMeetings(meetings, null, "пробежка").map((m) => m.id)).toEqual(["2"]);
  });

  it("совместно учитывает категорию, радиус, дату и свободные места", () => {
    const categories = allCategoriesSelected();
    categories.sport = false;
    const filters = { categories, radiusKm: 5, minSeats: 2, date: "2027-01-20" };
    expect(filterMeetings(meetings, filters, "").map((m) => m.id)).toEqual(["1"]);
    expect(filterMeetings(meetings, { ...filters, minSeats: 4 }, "")).toEqual([]);
  });

  it("не исключает встречу без известного расстояния", () => {
    const withoutDistance = { ...meetings[0], distanceKm: null };
    const filters = { categories: allCategoriesSelected(), radiusKm: 1, minSeats: 0, date: "" };
    expect(filterMeetings([withoutDistance], filters, "")).toEqual([withoutDistance]);
  });
});
