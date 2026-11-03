import { type DateKey, eachDateKey, weekdayOf } from "./time";

export type WorkSettings = {
  /** "HH:mm" in the company timezone */
  workdayStart: string;
  lateGraceMinutes: number;
  halfDayMinHours: number;
  fullDayMinHours: number;
  /** 0 = Sunday ... 6 = Saturday */
  workingDays: number[];
};

export const DEFAULT_SETTINGS: WorkSettings = {
  workdayStart: "09:30",
  lateGraceMinutes: 15,
  halfDayMinHours: 4,
  fullDayMinHours: 8,
  workingDays: [1, 2, 3, 4, 5],
};

/** Set of holiday DateKeys. */
export type HolidaySet = ReadonlySet<DateKey>;

export function isWeekend(key: DateKey, settings: Pick<WorkSettings, "workingDays">): boolean {
  return !settings.workingDays.includes(weekdayOf(key));
}

/** A working day is a configured working weekday that is not a holiday. */
export function isWorkingDay(
  key: DateKey,
  settings: Pick<WorkSettings, "workingDays">,
  holidays: HolidaySet,
): boolean {
  return !isWeekend(key, settings) && !holidays.has(key);
}

/** Number of working days between start and end, inclusive. */
export function countWorkingDays(
  start: DateKey,
  end: DateKey,
  settings: Pick<WorkSettings, "workingDays">,
  holidays: HolidaySet,
): number {
  if (start > end) return 0;
  return eachDateKey(start, end).filter((k) => isWorkingDay(k, settings, holidays)).length;
}
