import { afterEach, describe, expect, it, vi } from "vitest";
import { validateMeetingForm } from "./validateMeetingForm";
import type { MeetingFormData } from "@/features/meetings/types";

const valid: MeetingFormData = {
  title: "Вечер игр", categoryId: "games", description: "", date: "2031-01-02T12:00",
  maxSeats: 10, address: "Политехническая 29",
};

afterEach(() => vi.useRealTimers());

describe("проверка формы встречи", () => {
  it("принимает корректную будущую встречу", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    expect(validateMeetingForm(valid)).toEqual({});
  });

  it("одновременно показывает ошибки незаполненных полей", () => {
    const errors = validateMeetingForm({ ...valid, title: "  ", address: "  ", date: "", maxSeats: 1 });
    expect(errors).toMatchObject({
      title: expect.any(String), address: expect.any(String),
      date: expect.any(String), maxSeats: expect.any(String),
    });
  });

  it.each([0, 1, 101, 2.5, Number.NaN])("отклоняет количество мест %s", (maxSeats) => {
    expect(validateMeetingForm({ ...valid, maxSeats }).maxSeats).toBeDefined();
  });

  it.each([2, 100])("принимает граничное количество мест %s", (maxSeats) => {
    expect(validateMeetingForm({ ...valid, maxSeats }).maxSeats).toBeUndefined();
  });

  it("отклоняет прошедшую и некорректную дату", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    expect(validateMeetingForm({ ...valid, date: "2020-01-01T12:00" }).date).toBeDefined();
    expect(validateMeetingForm({ ...valid, date: "не дата" }).date).toBeDefined();
  });
});
