import type { DailyStatus, DayResult } from "./rules/attendance";
import type { LeaveStatus } from "./rules/leave";

/**
 * Fixed status colors (they don't follow the brand color, so they keep their meaning):
 * green present, amber late, red absent, blue leave, gray weekend/holiday.
 */
export type DayTone = DailyStatus | "LATE";

export const DAY_META: Record<DayTone, { label: string; badge: string; cell: string; dot: string }> = {
  PRESENT: { label: "Present", badge: "bg-emerald-100 text-emerald-800", cell: "bg-emerald-100 text-emerald-900 border-emerald-200", dot: "bg-emerald-500" },
  LATE: { label: "Late", badge: "bg-amber-100 text-amber-800", cell: "bg-amber-100 text-amber-900 border-amber-200", dot: "bg-amber-500" },
  HALF_DAY: { label: "Half day", badge: "bg-orange-100 text-orange-800", cell: "bg-orange-100 text-orange-900 border-orange-200", dot: "bg-orange-500" },
  ABSENT: { label: "Absent", badge: "bg-red-100 text-red-800", cell: "bg-red-100 text-red-900 border-red-200", dot: "bg-red-500" },
  ON_LEAVE: { label: "On leave", badge: "bg-blue-100 text-blue-800", cell: "bg-blue-100 text-blue-900 border-blue-200", dot: "bg-blue-500" },
  CHECKED_IN: { label: "Checked in", badge: "bg-teal-100 text-teal-800", cell: "bg-teal-50 text-teal-900 border-teal-300", dot: "bg-teal-500" },
  MISSED_CHECKOUT: { label: "Missed check-out", badge: "bg-purple-100 text-purple-800", cell: "bg-purple-100 text-purple-900 border-purple-200", dot: "bg-purple-500" },
  WEEKEND: { label: "Weekend", badge: "bg-gray-100 text-gray-600", cell: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" },
  HOLIDAY: { label: "Holiday", badge: "bg-gray-200 text-gray-700", cell: "bg-gray-200 text-gray-700 border-gray-300", dot: "bg-gray-500" },
};

/** Late present days show as "Late"; everything else shows its own status. */
export function toneOf(r: DayResult): DayTone {
  if (r.status === "PRESENT" && r.late) return "LATE";
  return r.status;
}

export const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; badge: string }> = {
  PENDING: { label: "Pending", badge: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Approved", badge: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected", badge: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelled", badge: "bg-gray-100 text-gray-600" },
};
