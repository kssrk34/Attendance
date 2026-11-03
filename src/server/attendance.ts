import "server-only";
import { db } from "@/lib/db";
import {
  type AttendanceLike,
  type DateKey,
  type DayResult,
  canCheckIn,
  dbDateToKey,
  deriveDailyStatus,
  eachDateKey,
  hoursWorked,
  isCoveredByLeave,
  keyToDbDate,
  todayKey,
} from "@/lib/rules";
import { getHolidays, getSettings } from "./config";

export type DayRow = {
  date: DateKey;
  result: DayResult | null;
  record: AttendanceLike | null;
  hours: number | null;
  holidayName?: string;
};

type UserForDays = { id: string; joinDate: Date };

/**
 * Compute day-by-day status for several users over a date range using the pure rules.
 * Returns a map of userId -> rows (one per date, in order).
 */
export async function buildDays(users: UserForDays[], from: DateKey, to: DateKey): Promise<Map<string, DayRow[]>> {
  const out = new Map<string, DayRow[]>();
  if (users.length === 0 || from > to) return out;
  const ids = users.map((u) => u.id);
  const today = todayKey();

  const [settings, holidayRows, records, leaves] = await Promise.all([
    getSettings(),
    getHolidays(from, to),
    db.attendanceRecord.findMany({
      where: { userId: { in: ids }, date: { gte: keyToDbDate(from), lte: keyToDbDate(to) } },
      select: { userId: true, date: true, checkInAt: true, checkOutAt: true, isLate: true },
    }),
    db.leaveRequest.findMany({
      where: {
        userId: { in: ids },
        status: "APPROVED",
        startDate: { lte: keyToDbDate(to) },
        endDate: { gte: keyToDbDate(from) },
      },
      select: { userId: true, startDate: true, endDate: true },
    }),
  ]);

  const holidays = new Set(holidayRows.map((h) => h.date));
  const holidayNames = new Map(holidayRows.map((h) => [h.date, h.name]));
  const recordMap = new Map(records.map((r) => [`${r.userId}|${dbDateToKey(r.date)}`, r]));
  const leaveMap = new Map<string, { start: DateKey; end: DateKey }[]>();
  for (const l of leaves) {
    const list = leaveMap.get(l.userId) ?? [];
    list.push({ start: dbDateToKey(l.startDate), end: dbDateToKey(l.endDate) });
    leaveMap.set(l.userId, list);
  }
  const dates = eachDateKey(from, to);

  for (const u of users) {
    const joinDate = dbDateToKey(u.joinDate);
    const ranges = leaveMap.get(u.id) ?? [];
    out.set(
      u.id,
      dates.map((date) => {
        const rec = recordMap.get(`${u.id}|${date}`) ?? null;
        const record = rec ? { checkInAt: rec.checkInAt, checkOutAt: rec.checkOutAt, isLate: rec.isLate } : null;
        const result = deriveDailyStatus({
          date,
          today,
          joinDate,
          settings,
          holidays,
          onLeave: isCoveredByLeave(date, ranges),
          record,
        });
        return { date, result, record, hours: record ? hoursWorked(record) : null, holidayName: holidayNames.get(date) };
      }),
    );
  }
  return out;
}

export async function getUserDays(user: UserForDays, from: DateKey, to: DateKey): Promise<DayRow[]> {
  return (await buildDays([user], from, to)).get(user.id) ?? [];
}

export type TodayState = {
  date: DateKey;
  record: AttendanceLike | null;
  result: DayResult | null;
  /** Null when checking in is allowed; otherwise why not. */
  checkInBlockedReason: string | null;
  holidayName?: string;
};

export async function getTodayState(user: UserForDays): Promise<TodayState> {
  const today = todayKey();
  const [row] = await getUserDays(user, today, today);
  const settings = await getSettings();
  const holidays = row?.holidayName ? new Set([today]) : new Set<string>();
  const check = canCheckIn({
    date: today,
    settings,
    holidays,
    onLeave: row?.result?.status === "ON_LEAVE",
    existing: row?.record ?? null,
  });
  return {
    date: today,
    record: row?.record ?? null,
    result: row?.result ?? null,
    checkInBlockedReason: check.ok ? null : check.error,
    holidayName: row?.holidayName,
  };
}
