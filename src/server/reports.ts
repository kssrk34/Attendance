import "server-only";
import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";
import { type DateKey, type LeaveStatus, isDateKey, keyToDbDate, monthRange, summarize, todayKey } from "@/lib/rules";
import { buildDays } from "./attendance";
import { type RequestRow, requestInclude, toRequestRow } from "./leave";

export type AttendanceReportRow = {
  userId: string;
  name: string;
  email: string;
  department: string;
  workingDays: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  missedCheckout: number;
  leave: number;
  totalHours: number;
};

/** Monthly attendance per active employee (optionally one department). */
export async function attendanceReport(month: string, departmentId?: string): Promise<AttendanceReportRow[]> {
  const users = await db.user.findMany({
    where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
    select: { id: true, name: true, email: true, joinDate: true, department: { select: { name: true } } },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });
  const { start, end } = monthRange(month);
  const today = todayKey();
  const days = await buildDays(users, start, end < today ? end : today);

  return users.map((u) => {
    const rows = days.get(u.id) ?? [];
    const s = summarize(rows.map((r) => r.result));
    const totalHours = rows.reduce((sum, r) => sum + (r.hours ?? 0), 0);
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      department: u.department?.name ?? "",
      workingDays: s.workingDays,
      present: s.present,
      late: s.late,
      halfDay: s.halfDay,
      absent: s.absent,
      missedCheckout: s.missedCheckout,
      leave: s.leave,
      totalHours: Math.round(totalHours * 100) / 100,
    };
  });
}

export const LEAVE_STATUSES: LeaveStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

export type LeaveReportFilters = { from: DateKey; to: DateKey; status?: LeaveStatus; leaveTypeId?: string };

export function parseLeaveFilters(sp: Record<string, string | string[] | undefined>): LeaveReportFilters {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const today = todayKey();
  const year = today.slice(0, 4);
  let from = one("from") ?? "";
  let to = one("to") ?? "";
  if (!isDateKey(from)) from = `${year}-01-01`;
  if (!isDateKey(to)) to = `${year}-12-31`;
  if (from > to) [from, to] = [to, from];
  const status = one("status") as LeaveStatus | undefined;
  return {
    from,
    to,
    status: status && LEAVE_STATUSES.includes(status) ? status : undefined,
    leaveTypeId: one("type") || undefined,
  };
}

export type LeaveReportRow = RequestRow & { department: string; email: string };

/** All leave requests that overlap the date range. */
export async function leaveReport(f: LeaveReportFilters): Promise<LeaveReportRow[]> {
  const where: Prisma.LeaveRequestWhereInput = {
    startDate: { lte: keyToDbDate(f.to) },
    endDate: { gte: keyToDbDate(f.from) },
    ...(f.status ? { status: f.status } : {}),
    ...(f.leaveTypeId ? { leaveTypeId: f.leaveTypeId } : {}),
  };
  const rows = await db.leaveRequest.findMany({
    where,
    include: { ...requestInclude, user: { select: { name: true, email: true, department: { select: { name: true } } } } },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({ ...toRequestRow(r), department: r.user.department?.name ?? "", email: r.user.email }));
}

/** Build a CSV string. Cells that look like formulas are prefixed to stop spreadsheet injection. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
