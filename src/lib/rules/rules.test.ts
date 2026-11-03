import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  addDaysKey,
  availableBalance,
  canApproveWithBalance,
  canCancel,
  canCheckIn,
  canCheckOut,
  canDecide,
  contrastRatio,
  countWorkingDays,
  dateKeyOf,
  deriveDailyStatus,
  eachDateKey,
  findOverlap,
  initialsOf,
  isDateKey,
  isLateCheckIn,
  isWorkingDay,
  leaveDayBreakdown,
  monthRange,
  rangesOverlap,
  returnToOffice,
  readableTextColor,
  routeApproval,
  shiftMonth,
  slugify,
  summarize,
  todayKey,
  validateLeaveRequest,
  validateLogo,
  zonedInstant,
  type DailyStatusInput,
} from "./index";

const settings = DEFAULT_SETTINGS;
const noHolidays = new Set<string>();

describe("time helpers", () => {
  it("uses Asia/Kolkata for today, not UTC", () => {
    // 2026-03-09 20:00 UTC is 2026-03-10 01:30 IST
    expect(todayKey(new Date("2026-03-09T20:00:00Z"))).toBe("2026-03-10");
    expect(todayKey(new Date("2026-03-09T18:29:00Z"))).toBe("2026-03-09");
    expect(dateKeyOf(new Date("2026-03-09T18:30:00Z"))).toBe("2026-03-10");
  });

  it("builds IST instants", () => {
    expect(zonedInstant("2026-03-10", "09:30").toISOString()).toBe("2026-03-10T04:00:00.000Z");
  });

  it("validates date keys", () => {
    expect(isDateKey("2026-02-28")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-2-3")).toBe(false);
  });

  it("handles month ranges and shifting", () => {
    expect(monthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(eachDateKey("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("leave day counting", () => {
  it("excludes weekends", () => {
    // Mon 2026-03-09 .. Sun 2026-03-15
    expect(countWorkingDays("2026-03-09", "2026-03-15", settings, noHolidays)).toBe(5);
    expect(countWorkingDays("2026-03-14", "2026-03-15", settings, noHolidays)).toBe(0);
  });

  it("excludes holidays", () => {
    const holidays = new Set(["2026-03-11"]);
    expect(countWorkingDays("2026-03-09", "2026-03-13", settings, holidays)).toBe(4);
    expect(isWorkingDay("2026-03-11", settings, holidays)).toBe(false);
  });

  it("counts a single day", () => {
    expect(countWorkingDays("2026-03-10", "2026-03-10", settings, noHolidays)).toBe(1);
  });

  it("returns 0 when start is after end", () => {
    expect(countWorkingDays("2026-03-12", "2026-03-10", settings, noHolidays)).toBe(0);
  });

  it("respects custom working days (6-day week)", () => {
    const sixDay = { workingDays: [1, 2, 3, 4, 5, 6] };
    expect(countWorkingDays("2026-03-09", "2026-03-15", sixDay, noHolidays)).toBe(6);
  });

  it("counts across a month boundary", () => {
    // Fri 2026-01-30 .. Tue 2026-02-03
    expect(countWorkingDays("2026-01-30", "2026-02-03", settings, noHolidays)).toBe(3);
  });
});

describe("leave request validation", () => {
  const base = {
    today: "2026-03-10",
    settings,
    holidays: noHolidays,
    existing: [],
    balance: { allocated: 12, used: 2 },
    pendingDays: 0,
  };

  it("accepts a valid request and returns the day count", () => {
    expect(validateLeaveRequest({ ...base, start: "2026-03-16", end: "2026-03-18" })).toEqual({ ok: true, days: 3 });
  });

  it("rejects start after end", () => {
    const r = validateLeaveRequest({ ...base, start: "2026-03-18", end: "2026-03-16" });
    expect(r.ok).toBe(false);
  });

  it("allows backdating up to 7 days but not more", () => {
    expect(validateLeaveRequest({ ...base, start: "2026-03-03", end: "2026-03-03" }).ok).toBe(true);
    const r = validateLeaveRequest({ ...base, start: "2026-03-02", end: "2026-03-02" });
    expect(r).toMatchObject({ ok: false, field: "start" });
  });

  it("rejects requests spanning a year boundary", () => {
    const r = validateLeaveRequest({ ...base, today: "2026-12-20", start: "2026-12-30", end: "2027-01-02" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/same calendar year/);
  });

  it("rejects a request that counts 0 working days", () => {
    const r = validateLeaveRequest({ ...base, start: "2026-03-14", end: "2026-03-15" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no working days/);
  });

  it("rejects a request made only of holidays", () => {
    const r = validateLeaveRequest({ ...base, holidays: new Set(["2026-03-16"]), start: "2026-03-16", end: "2026-03-16" });
    expect(r.ok).toBe(false);
  });

  it("rejects overlap with pending or approved requests", () => {
    const existing = [{ start: "2026-03-17", end: "2026-03-19", status: "PENDING" as const }];
    expect(validateLeaveRequest({ ...base, existing, start: "2026-03-19", end: "2026-03-20" }).ok).toBe(false);
    const approved = [{ start: "2026-03-17", end: "2026-03-17", status: "APPROVED" as const }];
    expect(validateLeaveRequest({ ...base, existing: approved, start: "2026-03-16", end: "2026-03-20" }).ok).toBe(false);
  });

  it("ignores overlap with rejected or cancelled requests", () => {
    const existing = [
      { start: "2026-03-17", end: "2026-03-19", status: "REJECTED" as const },
      { start: "2026-03-16", end: "2026-03-16", status: "CANCELLED" as const },
    ];
    expect(validateLeaveRequest({ ...base, existing, start: "2026-03-16", end: "2026-03-19" }).ok).toBe(true);
  });

  it("checks balance including pending days", () => {
    // allocated 12, used 2, pending 8 => 2 available
    expect(validateLeaveRequest({ ...base, pendingDays: 8, start: "2026-03-16", end: "2026-03-17" }).ok).toBe(true);
    const r = validateLeaveRequest({ ...base, pendingDays: 8, start: "2026-03-16", end: "2026-03-18" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Not enough balance/);
  });

  it("rejects when there is no balance row", () => {
    expect(validateLeaveRequest({ ...base, balance: null, start: "2026-03-16", end: "2026-03-16" }).ok).toBe(false);
  });
});

describe("overlap and balance helpers", () => {
  it("detects overlapping ranges inclusively", () => {
    expect(rangesOverlap({ start: "2026-03-01", end: "2026-03-05" }, { start: "2026-03-05", end: "2026-03-06" })).toBe(true);
    expect(rangesOverlap({ start: "2026-03-01", end: "2026-03-04" }, { start: "2026-03-05", end: "2026-03-06" })).toBe(false);
    expect(rangesOverlap({ start: "2026-03-01", end: "2026-03-31" }, { start: "2026-03-10", end: "2026-03-11" })).toBe(true);
  });

  it("findOverlap only counts active requests", () => {
    const list = [
      { start: "2026-03-10", end: "2026-03-10", status: "REJECTED" as const },
      { start: "2026-03-10", end: "2026-03-12", status: "APPROVED" as const },
    ];
    expect(findOverlap({ start: "2026-03-11", end: "2026-03-11" }, list)?.status).toBe("APPROVED");
  });

  it("computes available balance", () => {
    expect(availableBalance({ allocated: 12, used: 3 }, 2)).toBe(7);
  });

  it("blocks approval that would exceed allocation", () => {
    expect(canApproveWithBalance({ allocated: 10, used: 8 }, 2)).toBe(true);
    expect(canApproveWithBalance({ allocated: 10, used: 9 }, 2)).toBe(false);
    expect(canApproveWithBalance(null, 1)).toBe(false);
  });
});

describe("back in office after leave", () => {
  it("is the next day when the leave ends mid-week", () => {
    // Tue 2026-03-10 .. Wed 2026-03-11 -> back Thu 2026-03-12
    expect(returnToOffice("2026-03-11", settings, noHolidays)).toEqual({ date: "2026-03-12", afterOtherLeave: false });
  });

  it("skips the weekend when the leave ends on a Friday", () => {
    expect(returnToOffice("2026-03-13", settings, noHolidays)?.date).toBe("2026-03-16");
  });

  it("skips holidays right after the leave", () => {
    // Leave ends Fri 2026-03-13; Mon 2026-03-16 is a holiday -> back Tue
    expect(returnToOffice("2026-03-13", settings, new Set(["2026-03-16"]))?.date).toBe("2026-03-17");
  });

  it("crosses into the next year", () => {
    // Thu 2026-12-31 -> Fri 2027-01-01 is a holiday -> weekend -> back Mon 2027-01-04
    expect(returnToOffice("2026-12-31", settings, new Set(["2027-01-01"]))?.date).toBe("2027-01-04");
  });

  it("skips another leave that follows straight after", () => {
    // Leave ends Fri 2026-03-13; another leave Mon 16 .. Tue 17 -> back Wed 18
    const other = [{ start: "2026-03-16", end: "2026-03-17" }];
    expect(returnToOffice("2026-03-13", settings, noHolidays, other)).toEqual({ date: "2026-03-18", afterOtherLeave: true });
  });

  it("ignores a later leave with a working day in between", () => {
    const other = [{ start: "2026-03-17", end: "2026-03-18" }];
    expect(returnToOffice("2026-03-13", settings, noHolidays, other)).toEqual({ date: "2026-03-16", afterOtherLeave: false });
  });

  it("returns null when there are no working days at all", () => {
    expect(returnToOffice("2026-03-13", { workingDays: [] }, noHolidays)).toBeNull();
  });

  it("labels each day of a leave", () => {
    // Thu 2026-03-12 .. Mon 2026-03-16, with Fri 13 a holiday
    expect(leaveDayBreakdown("2026-03-12", "2026-03-16", settings, new Set(["2026-03-13"]))).toEqual([
      { date: "2026-03-12", kind: "WORKING" },
      { date: "2026-03-13", kind: "HOLIDAY" },
      { date: "2026-03-14", kind: "WEEKEND" },
      { date: "2026-03-15", kind: "WEEKEND" },
      { date: "2026-03-16", kind: "WORKING" },
    ]);
  });
});

describe("late calculation", () => {
  const day = "2026-03-10"; // 09:30 + 15 min grace = 09:45 IST = 04:15 UTC
  it("on time at or before the grace limit", () => {
    expect(isLateCheckIn(new Date("2026-03-10T03:50:00Z"), day, settings)).toBe(false);
    expect(isLateCheckIn(new Date("2026-03-10T04:15:00Z"), day, settings)).toBe(false);
  });
  it("late after the grace limit", () => {
    expect(isLateCheckIn(new Date("2026-03-10T04:15:01Z"), day, settings)).toBe(true);
    expect(isLateCheckIn(new Date("2026-03-10T06:00:00Z"), day, settings)).toBe(true);
  });
  it("respects custom start and grace", () => {
    const custom = { workdayStart: "10:00", lateGraceMinutes: 0 };
    expect(isLateCheckIn(new Date("2026-03-10T04:30:00Z"), day, custom)).toBe(false);
    expect(isLateCheckIn(new Date("2026-03-10T04:31:00Z"), day, custom)).toBe(true);
  });
});

describe("daily status derivation", () => {
  const today = "2026-03-11"; // Wednesday
  const base: DailyStatusInput = {
    date: "2026-03-10",
    today,
    joinDate: "2025-01-01",
    settings,
    holidays: noHolidays,
    onLeave: false,
    record: null,
  };
  const at = (iso: string) => new Date(iso);

  it("WEEKEND", () => {
    expect(deriveDailyStatus({ ...base, date: "2026-03-08" })?.status).toBe("WEEKEND");
  });
  it("HOLIDAY", () => {
    expect(deriveDailyStatus({ ...base, holidays: new Set(["2026-03-10"]) })?.status).toBe("HOLIDAY");
  });
  it("ON_LEAVE", () => {
    expect(deriveDailyStatus({ ...base, onLeave: true })?.status).toBe("ON_LEAVE");
  });
  it("PRESENT when hours >= halfDayMinHours, with late flag", () => {
    const r = deriveDailyStatus({
      ...base,
      record: { checkInAt: at("2026-03-10T04:30:00Z"), checkOutAt: at("2026-03-10T12:30:00Z"), isLate: true },
    });
    expect(r).toEqual({ status: "PRESENT", late: true });
  });
  it("PRESENT at exactly halfDayMinHours", () => {
    const r = deriveDailyStatus({
      ...base,
      record: { checkInAt: at("2026-03-10T04:00:00Z"), checkOutAt: at("2026-03-10T08:00:00Z"), isLate: false },
    });
    expect(r).toEqual({ status: "PRESENT", late: false });
  });
  it("HALF_DAY when hours < halfDayMinHours", () => {
    const r = deriveDailyStatus({
      ...base,
      record: { checkInAt: at("2026-03-10T04:00:00Z"), checkOutAt: at("2026-03-10T07:00:00Z"), isLate: false },
    });
    expect(r?.status).toBe("HALF_DAY");
  });
  it("CHECKED_IN today without check-out", () => {
    const r = deriveDailyStatus({
      ...base,
      date: today,
      record: { checkInAt: at("2026-03-11T04:00:00Z"), checkOutAt: null, isLate: false },
    });
    expect(r?.status).toBe("CHECKED_IN");
  });
  it("MISSED_CHECKOUT on a past day without check-out", () => {
    const r = deriveDailyStatus({
      ...base,
      record: { checkInAt: at("2026-03-10T04:00:00Z"), checkOutAt: null, isLate: false },
    });
    expect(r?.status).toBe("MISSED_CHECKOUT");
  });
  it("ABSENT on a past working day with no record", () => {
    expect(deriveDailyStatus(base)?.status).toBe("ABSENT");
  });
  it("no status today before checking in", () => {
    expect(deriveDailyStatus({ ...base, date: today })).toBeNull();
  });
  it("no status for future dates", () => {
    expect(deriveDailyStatus({ ...base, date: "2026-03-12" })).toBeNull();
    expect(deriveDailyStatus({ ...base, date: "2026-03-14" })).toBeNull();
  });
  it("no status before the join date", () => {
    expect(deriveDailyStatus({ ...base, joinDate: "2026-03-11" })).toBeNull();
  });
  it("weekend/holiday take priority over leave", () => {
    expect(deriveDailyStatus({ ...base, date: "2026-03-07", onLeave: true })?.status).toBe("WEEKEND");
  });

  it("summarizes a month", () => {
    const s = summarize([
      { status: "PRESENT", late: false },
      { status: "PRESENT", late: true },
      { status: "HALF_DAY", late: false },
      { status: "ABSENT", late: false },
      { status: "ON_LEAVE", late: false },
      { status: "MISSED_CHECKOUT", late: false },
      { status: "WEEKEND", late: false },
      { status: "HOLIDAY", late: false },
      null,
    ]);
    expect(s).toEqual({ present: 2, late: 1, halfDay: 1, absent: 1, missedCheckout: 1, leave: 1, workingDays: 6 });
  });
});

describe("check-in / check-out rules", () => {
  const ctx = { date: "2026-03-10", settings, holidays: noHolidays, onLeave: false, existing: null };
  const rec = { checkInAt: new Date(), checkOutAt: null, isLate: false };

  it("allows check-in on a normal working day", () => {
    expect(canCheckIn(ctx).ok).toBe(true);
  });
  it("blocks a second check-in", () => {
    expect(canCheckIn({ ...ctx, existing: rec }).ok).toBe(false);
  });
  it("blocks check-in on weekends, holidays and leave", () => {
    expect(canCheckIn({ ...ctx, date: "2026-03-08" }).ok).toBe(false);
    expect(canCheckIn({ ...ctx, holidays: new Set(["2026-03-10"]) }).ok).toBe(false);
    expect(canCheckIn({ ...ctx, onLeave: true }).ok).toBe(false);
  });
  it("blocks check-out without check-in or twice", () => {
    expect(canCheckOut(null).ok).toBe(false);
    expect(canCheckOut(rec).ok).toBe(true);
    expect(canCheckOut({ ...rec, checkOutAt: new Date() }).ok).toBe(false);
  });
});

describe("cancellation rules", () => {
  const today = "2026-03-10";
  it("pending can always be cancelled", () => {
    expect(canCancel({ status: "PENDING", start: "2026-03-01" }, today)).toBe(true);
  });
  it("approved only if it starts in the future", () => {
    expect(canCancel({ status: "APPROVED", start: "2026-03-11" }, today)).toBe(true);
    expect(canCancel({ status: "APPROVED", start: "2026-03-10" }, today)).toBe(false);
    expect(canCancel({ status: "APPROVED", start: "2026-03-01" }, today)).toBe(false);
  });
  it("rejected and cancelled cannot be cancelled", () => {
    expect(canCancel({ status: "REJECTED", start: "2026-04-01" }, today)).toBe(false);
    expect(canCancel({ status: "CANCELLED", start: "2026-04-01" }, today)).toBe(false);
  });
});

describe("approval routing", () => {
  const manager = { id: "m1", role: "MANAGER" as const, isActive: true };
  const admin = { id: "a1", role: "ADMIN" as const };

  it("routes to the manager when there is an active one", () => {
    expect(routeApproval(manager)).toEqual({ kind: "MANAGER", managerId: "m1" });
  });
  it("routes to admin when there is no manager", () => {
    expect(routeApproval(null)).toEqual({ kind: "ADMIN" });
  });
  it("routes to admin when the manager is inactive or no longer a manager", () => {
    expect(routeApproval({ ...manager, isActive: false })).toEqual({ kind: "ADMIN" });
    expect(routeApproval({ ...manager, role: "EMPLOYEE" })).toEqual({ kind: "ADMIN" });
  });
  it("the manager can decide their report's request", () => {
    expect(canDecide({ id: "m1", role: "MANAGER" }, "e1", manager)).toBe(true);
  });
  it("another manager cannot", () => {
    expect(canDecide({ id: "m2", role: "MANAGER" }, "e1", manager)).toBe(false);
  });
  it("a manager cannot decide requests routed to admin", () => {
    expect(canDecide({ id: "m1", role: "MANAGER" }, "e1", null)).toBe(false);
  });
  it("admin can decide anything except their own", () => {
    expect(canDecide(admin, "e1", manager)).toBe(true);
    expect(canDecide(admin, "e1", null)).toBe(true);
    expect(canDecide(admin, "a1", null)).toBe(false);
  });
  it("nobody can decide their own request", () => {
    expect(canDecide({ id: "m1", role: "MANAGER" }, "m1", manager)).toBe(false);
  });
  it("employees cannot decide", () => {
    expect(canDecide({ id: "e2", role: "EMPLOYEE" }, "e1", { id: "e2", role: "EMPLOYEE", isActive: true })).toBe(false);
  });
});

describe("branding helpers", () => {
  it("picks readable text on any color", () => {
    expect(readableTextColor("#2563eb")).toBe("#ffffff");
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#ffffff")).toBe("#111827");
    expect(readableTextColor("#facc15")).toBe("#111827");
    for (const c of ["#2563eb", "#facc15", "#16a34a", "#e11d48", "#a3e635", "#0f172a"]) {
      expect(contrastRatio(c, readableTextColor(c))).toBeGreaterThanOrEqual(4.4);
    }
  });
  it("makes initials", () => {
    expect(initialsOf("Your Company")).toBe("YC");
    expect(initialsOf("orbit")).toBe("OR");
    expect(initialsOf("  ")).toBe("?");
  });
  it("slugifies", () => {
    expect(slugify("Your Company Pvt. Ltd.")).toBe("your-company-pvt-ltd");
    expect(slugify("***")).toBe("export");
  });
  it("validates logos", () => {
    expect(validateLogo("data:image/png;base64,iVBORw0KGgo=").ok).toBe(true);
    expect(validateLogo("data:text/html;base64,PGgxPg==").ok).toBe(false);
    expect(validateLogo("not a data url").ok).toBe(false);
    const big = "data:image/png;base64," + "A".repeat(Math.ceil((300 * 1024 * 4) / 3) + 8);
    expect(validateLogo(big).ok).toBe(false);
  });
});
