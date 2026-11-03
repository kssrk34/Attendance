import { type HolidaySet, type WorkSettings, countWorkingDays, isWeekend, isWorkingDay } from "./calendar";
import { type DateKey, addDaysKey, eachDateKey, yearOf } from "./time";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

/** How many days in the past a leave may start (to allow filing sick leave after returning). */
export const MAX_BACKDATE_DAYS = 7;

export type Range = { start: DateKey; end: DateKey };

export function rangesOverlap(a: Range, b: Range): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Overlap only counts against requests that are still PENDING or APPROVED. */
export function findOverlap<T extends Range & { status: LeaveStatus }>(range: Range, existing: T[]): T | undefined {
  return existing.find((r) => (r.status === "PENDING" || r.status === "APPROVED") && rangesOverlap(range, r));
}

export type BalanceLike = { allocated: number; used: number };

/** allocated − used − days already in PENDING requests (same type and year). */
export function availableBalance(balance: BalanceLike, pendingDays: number): number {
  return balance.allocated - balance.used - pendingDays;
}

export type LeaveValidationInput = {
  start: DateKey;
  end: DateKey;
  today: DateKey;
  settings: Pick<WorkSettings, "workingDays">;
  holidays: HolidaySet;
  /** The user's existing requests (any status). */
  existing: (Range & { status: LeaveStatus })[];
  /** Balance for the requested type and year, or null if none exists. */
  balance: BalanceLike | null;
  /** Days in the user's PENDING requests for the same type and year. */
  pendingDays: number;
};

export type LeaveValidationResult = { ok: true; days: number } | { ok: false; error: string; field?: "start" | "end" };

export function validateLeaveRequest(input: LeaveValidationInput): LeaveValidationResult {
  const { start, end, today, settings, holidays } = input;

  if (start > end) return { ok: false, error: "The last day of leave can't be before the first day.", field: "end" };
  if (start < addDaysKey(today, -MAX_BACKDATE_DAYS)) {
    return { ok: false, error: `The first day of leave can be at most ${MAX_BACKDATE_DAYS} days in the past.`, field: "start" };
  }
  if (yearOf(start) !== yearOf(end)) {
    return { ok: false, error: "The first and last day of leave must be in the same calendar year. Please apply separately for each year.", field: "end" };
  }

  const days = countWorkingDays(start, end, settings, holidays);
  if (days === 0) {
    return { ok: false, error: "The selected dates contain no working days (only weekends or holidays)." };
  }

  const overlap = findOverlap({ start, end }, input.existing);
  if (overlap) {
    return {
      ok: false,
      error: `These dates overlap another ${overlap.status.toLowerCase()} request (${overlap.start} to ${overlap.end}).`,
    };
  }

  if (!input.balance) return { ok: false, error: "You have no balance for this leave type this year." };
  const available = availableBalance(input.balance, input.pendingDays);
  if (days > available) {
    return {
      ok: false,
      error: `Not enough balance: this request needs ${days} day${days === 1 ? "" : "s"} but only ${Math.max(0, available)} ${available === 1 ? "is" : "are"} available.`,
    };
  }

  return { ok: true, days };
}

/** How a date inside a leave counts: a working day is taken from the balance, the others are free. */
export type LeaveDayKind = "WORKING" | "WEEKEND" | "HOLIDAY";

export function leaveDayKind(key: DateKey, settings: Pick<WorkSettings, "workingDays">, holidays: HolidaySet): LeaveDayKind {
  if (holidays.has(key)) return "HOLIDAY";
  if (isWeekend(key, settings)) return "WEEKEND";
  return "WORKING";
}

/** Every date from start to end (inclusive) with how it counts. */
export function leaveDayBreakdown(
  start: DateKey,
  end: DateKey,
  settings: Pick<WorkSettings, "workingDays">,
  holidays: HolidaySet,
): { date: DateKey; kind: LeaveDayKind }[] {
  return eachDateKey(start, end).map((date) => ({ date, kind: leaveDayKind(date, settings, holidays) }));
}

export type ReturnToOffice = {
  /** The first working day after the leave: the day the person is back in office. */
  date: DateKey;
  /** True when another of the person's leaves follows straight after, so it's skipped too. */
  afterOtherLeave: boolean;
};

/**
 * The day someone is back in office after a leave that ends on `end`: the next working day.
 * Working days covered by `otherLeave` (the person's other PENDING or APPROVED requests) are
 * skipped as well, so back-to-back requests give the real return date.
 * Returns null if there's no working day within a year (e.g. no working weekdays configured).
 */
export function returnToOffice(
  end: DateKey,
  settings: Pick<WorkSettings, "workingDays">,
  holidays: HolidaySet,
  otherLeave: Range[] = [],
): ReturnToOffice | null {
  let afterOtherLeave = false;
  let day = end;
  for (let i = 0; i < 366; i++) {
    day = addDaysKey(day, 1);
    if (!isWorkingDay(day, settings, holidays)) continue;
    if (otherLeave.some((r) => r.start <= day && day <= r.end)) {
      afterOtherLeave = true;
      continue;
    }
    return { date: day, afterOtherLeave };
  }
  return null;
}

/** Employees can cancel PENDING requests, or APPROVED ones that haven't started yet. */
export function canCancel(request: { status: LeaveStatus; start: DateKey }, today: DateKey): boolean {
  if (request.status === "PENDING") return true;
  if (request.status === "APPROVED") return request.start > today;
  return false;
}

export type Approver = { kind: "MANAGER"; managerId: string } | { kind: "ADMIN" };

export type ManagerInfo = { id: string; role: Role; isActive: boolean } | null;

/**
 * Where a request goes: to the requester's manager if they have an active one
 * who is a MANAGER or ADMIN, otherwise to ADMIN.
 */
export function routeApproval(manager: ManagerInfo): Approver {
  if (manager && manager.isActive && (manager.role === "MANAGER" || manager.role === "ADMIN")) {
    return { kind: "MANAGER", managerId: manager.id };
  }
  return { kind: "ADMIN" };
}

/** Whether `actor` may approve or reject a request made by `requesterId`. */
export function canDecide(
  actor: { id: string; role: Role },
  requesterId: string,
  requesterManager: ManagerInfo,
): boolean {
  if (actor.id === requesterId) return false; // nobody approves their own request
  if (actor.role === "ADMIN") return true; // admin can decide anything else
  const route = routeApproval(requesterManager);
  return route.kind === "MANAGER" && route.managerId === actor.id && actor.role === "MANAGER";
}

/** Approval is blocked if it would push `used` above `allocated`. */
export function canApproveWithBalance(balance: BalanceLike | null, days: number): boolean {
  if (!balance) return false;
  return balance.used + days <= balance.allocated;
}
