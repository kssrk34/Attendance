import { type HolidaySet, type WorkSettings, isWeekend } from "./calendar";
import { type DateKey, hoursBetween, zonedInstant } from "./time";

export type DailyStatus =
  | "WEEKEND"
  | "HOLIDAY"
  | "ON_LEAVE"
  | "PRESENT"
  | "HALF_DAY"
  | "CHECKED_IN"
  | "MISSED_CHECKOUT"
  | "ABSENT";

export type AttendanceLike = {
  checkInAt: Date;
  checkOutAt: Date | null;
  isLate: boolean;
};

export type DayResult = {
  status: DailyStatus;
  /** True when the check-in was late (only for days with a record). */
  late: boolean;
};

/** The latest check-in time that still counts as on time. */
export function lateThreshold(key: DateKey, settings: Pick<WorkSettings, "workdayStart" | "lateGraceMinutes">): Date {
  const start = zonedInstant(key, settings.workdayStart);
  return new Date(start.getTime() + settings.lateGraceMinutes * 60_000);
}

/** Late = check-in strictly after workdayStart + lateGraceMinutes (company timezone). */
export function isLateCheckIn(
  checkInAt: Date,
  key: DateKey,
  settings: Pick<WorkSettings, "workdayStart" | "lateGraceMinutes">,
): boolean {
  return checkInAt.getTime() > lateThreshold(key, settings).getTime();
}

export function hoursWorked(record: Pick<AttendanceLike, "checkInAt" | "checkOutAt">): number | null {
  if (!record.checkOutAt) return null;
  return hoursBetween(record.checkInAt, record.checkOutAt);
}

export type DailyStatusInput = {
  date: DateKey;
  today: DateKey;
  joinDate: DateKey;
  settings: WorkSettings;
  holidays: HolidaySet;
  /** Whether an APPROVED leave request covers this date. */
  onLeave: boolean;
  record: AttendanceLike | null;
};

/**
 * Derive the status of one day for one user. Returns null when the day has no
 * status: future dates and dates before the user's join date.
 */
export function deriveDailyStatus(input: DailyStatusInput): DayResult | null {
  const { date, today, joinDate, settings, holidays, onLeave, record } = input;

  if (date > today) return null;
  if (date < joinDate) return null;

  if (isWeekend(date, settings)) return { status: "WEEKEND", late: false };
  if (holidays.has(date)) return { status: "HOLIDAY", late: false };
  if (onLeave) return { status: "ON_LEAVE", late: false };

  if (record) {
    if (record.checkOutAt) {
      const hours = hoursBetween(record.checkInAt, record.checkOutAt);
      return {
        status: hours >= settings.halfDayMinHours ? "PRESENT" : "HALF_DAY",
        late: record.isLate,
      };
    }
    return { status: date === today ? "CHECKED_IN" : "MISSED_CHECKOUT", late: record.isLate };
  }

  // No record: absent on a past working day; today is still open.
  if (date < today) return { status: "ABSENT", late: false };
  return null;
}

export type CheckInContext = {
  date: DateKey;
  settings: WorkSettings;
  holidays: HolidaySet;
  onLeave: boolean;
  existing: AttendanceLike | null;
};

export type RuleResult = { ok: true } | { ok: false; error: string };

export function canCheckIn(ctx: CheckInContext): RuleResult {
  if (ctx.existing) return { ok: false, error: "You have already checked in today." };
  if (isWeekend(ctx.date, ctx.settings)) return { ok: false, error: "Today is not a working day." };
  if (ctx.holidays.has(ctx.date)) return { ok: false, error: "Today is a holiday." };
  if (ctx.onLeave) return { ok: false, error: "You are on approved leave today." };
  return { ok: true };
}

export function canCheckOut(existing: AttendanceLike | null): RuleResult {
  if (!existing) return { ok: false, error: "You haven't checked in today." };
  if (existing.checkOutAt) return { ok: false, error: "You have already checked out today." };
  return { ok: true };
}

export type MonthSummary = {
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  missedCheckout: number;
  leave: number;
  /** Working days with a status so far (excludes weekends, holidays, future, pre-join). */
  workingDays: number;
};

export function summarize(results: (DayResult | null)[]): MonthSummary {
  const s: MonthSummary = { present: 0, late: 0, halfDay: 0, absent: 0, missedCheckout: 0, leave: 0, workingDays: 0 };
  for (const r of results) {
    if (!r) continue;
    switch (r.status) {
      case "PRESENT":
      case "CHECKED_IN":
        s.present++;
        break;
      case "HALF_DAY":
        s.halfDay++;
        break;
      case "ABSENT":
        s.absent++;
        break;
      case "MISSED_CHECKOUT":
        s.missedCheckout++;
        break;
      case "ON_LEAVE":
        s.leave++;
        break;
      default:
        continue; // weekend / holiday
    }
    s.workingDays++;
    if (r.late) s.late++;
  }
  return s;
}

/** Whether a set of approved leave ranges covers a date. */
export function isCoveredByLeave(date: DateKey, ranges: { start: DateKey; end: DateKey }[]): boolean {
  return ranges.some((r) => r.start <= date && date <= r.end);
}
