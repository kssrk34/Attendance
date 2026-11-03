/**
 * Demo data. Re-runnable: wipes everything and recreates it.
 * All dates are generated relative to "today" (company timezone) so the demo always looks fresh.
 * Uses default (generic) branding only.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient, type LeaveStatus, type Role } from "../src/generated/prisma/client";
import {
  DEFAULT_BRANDING,
  DEFAULT_SETTINGS,
  type DateKey,
  addDaysKey,
  countWorkingDays,
  eachDateKey,
  isLateCheckIn,
  isWorkingDay,
  keyToDbDate,
  todayKey,
  yearOf,
  zonedInstant,
} from "../src/lib/rules";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const PASSWORD = "Demo@1234";

// Deterministic pseudo-random numbers so each run looks similar.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20240601);
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** Fixed national holidays plus common festival holidays. Festival dates move every year — admins should verify them. */
const FESTIVALS: Record<number, [string, string][]> = {
  2025: [["03-14", "Holi"], ["03-31", "Eid al-Fitr"], ["08-27", "Ganesh Chaturthi"], ["10-20", "Diwali"], ["11-05", "Guru Nanak Jayanti"]],
  2026: [["03-04", "Holi"], ["03-20", "Eid al-Fitr"], ["09-14", "Ganesh Chaturthi"], ["10-20", "Dussehra"], ["11-08", "Diwali"]],
  2027: [["03-10", "Eid al-Fitr"], ["03-22", "Holi"], ["09-04", "Ganesh Chaturthi"], ["10-09", "Dussehra"], ["10-29", "Diwali"]],
  2028: [["02-27", "Eid al-Fitr"], ["03-11", "Holi"], ["08-23", "Ganesh Chaturthi"], ["09-27", "Dussehra"], ["10-17", "Diwali"]],
};

function holidaysFor(year: number): { date: DateKey; name: string }[] {
  const fixed: [string, string][] = [
    ["01-26", "Republic Day"],
    ["08-15", "Independence Day"],
    ["10-02", "Gandhi Jayanti"],
    ["12-25", "Christmas"],
  ];
  const festivals = FESTIVALS[year] ?? FESTIVALS[2027];
  const map = new Map<string, string>();
  for (const [md, name] of [...fixed, ...festivals]) if (!map.has(md)) map.set(md, name);
  return [...map.entries()].map(([md, name]) => ({ date: `${year}-${md}`, name })).sort((a, b) => a.date.localeCompare(b.date));
}

type SeedUser = {
  key: string;
  name: string;
  email: string;
  role: Role;
  dept: "Engineering" | "QA" | "HR" | "Sales";
  manager?: string;
  /** Join date as an absolute date or "days ago". */
  joined: string | number;
};

const USERS: SeedUser[] = [
  { key: "admin", name: "Kavita Iyer", email: "admin@example.com", role: "ADMIN", dept: "HR", joined: "2018-04-02" },
  { key: "eng_mgr", name: "Rahul Sharma", email: "manager@example.com", role: "MANAGER", dept: "Engineering", joined: "2019-07-15" },
  { key: "qa_mgr", name: "Sneha Kulkarni", email: "sneha.kulkarni@example.com", role: "MANAGER", dept: "QA", joined: "2020-01-06" },
  { key: "sales_mgr", name: "Vikram Singh", email: "vikram.singh@example.com", role: "MANAGER", dept: "Sales", joined: "2019-11-11" },

  { key: "employee", name: "Arjun Mehta", email: "employee@example.com", role: "EMPLOYEE", dept: "Engineering", manager: "eng_mgr", joined: "2022-03-14" },
  { key: "priya", name: "Priya Nair", email: "priya.nair@example.com", role: "EMPLOYEE", dept: "Engineering", manager: "eng_mgr", joined: "2021-08-02" },
  { key: "aditya", name: "Aditya Rao", email: "aditya.rao@example.com", role: "EMPLOYEE", dept: "Engineering", manager: "eng_mgr", joined: "2023-01-09" },
  { key: "fatima", name: "Fatima Sheikh", email: "fatima.sheikh@example.com", role: "EMPLOYEE", dept: "Engineering", manager: "eng_mgr", joined: "2022-10-17" },
  { key: "karthik", name: "Karthik Subramanian", email: "karthik.subramanian@example.com", role: "EMPLOYEE", dept: "Engineering", manager: "eng_mgr", joined: "2020-06-22" },
  { key: "neha", name: "Neha Gupta", email: "neha.gupta@example.com", role: "EMPLOYEE", dept: "Engineering", manager: "eng_mgr", joined: "2024-02-05" },
  { key: "rohan", name: "Rohan Das", email: "rohan.das@example.com", role: "EMPLOYEE", dept: "Engineering", manager: "eng_mgr", joined: 40 },

  { key: "ananya", name: "Ananya Reddy", email: "ananya.reddy@example.com", role: "EMPLOYEE", dept: "QA", manager: "qa_mgr", joined: "2021-04-19" },
  { key: "siddharth", name: "Siddharth Joshi", email: "siddharth.joshi@example.com", role: "EMPLOYEE", dept: "QA", manager: "qa_mgr", joined: "2022-07-11" },
  { key: "meera", name: "Meera Pillai", email: "meera.pillai@example.com", role: "EMPLOYEE", dept: "QA", manager: "qa_mgr", joined: "2023-05-29" },
  { key: "imran", name: "Imran Khan", email: "imran.khan@example.com", role: "EMPLOYEE", dept: "QA", manager: "qa_mgr", joined: "2020-09-14" },
  { key: "pooja", name: "Pooja Verma", email: "pooja.verma@example.com", role: "EMPLOYEE", dept: "QA", manager: "qa_mgr", joined: "2024-06-03" },

  { key: "amit", name: "Amit Patel", email: "amit.patel@example.com", role: "EMPLOYEE", dept: "Sales", manager: "sales_mgr", joined: "2019-12-02" },
  { key: "divya", name: "Divya Menon", email: "divya.menon@example.com", role: "EMPLOYEE", dept: "Sales", manager: "sales_mgr", joined: "2021-11-22" },
  { key: "harpreet", name: "Harpreet Kaur", email: "harpreet.kaur@example.com", role: "EMPLOYEE", dept: "Sales", manager: "sales_mgr", joined: "2022-01-31" },
  { key: "sanjay", name: "Sanjay Bhat", email: "sanjay.bhat@example.com", role: "EMPLOYEE", dept: "Sales", manager: "sales_mgr", joined: "2023-09-18" },

  { key: "lakshmi", name: "Lakshmi Krishnan", email: "lakshmi.krishnan@example.com", role: "EMPLOYEE", dept: "HR", manager: "admin", joined: "2020-03-09" },
  { key: "varun", name: "Varun Chopra", email: "varun.chopra@example.com", role: "EMPLOYEE", dept: "HR", manager: "admin", joined: 25 },
];

const LEAVE_TYPES = [
  { name: "Casual Leave", code: "CL", annualQuota: 12 },
  { name: "Sick Leave", code: "SL", annualQuota: 10 },
  { name: "Earned Leave", code: "EL", annualQuota: 15 },
];

async function main() {
  const today = todayKey();
  const year = yearOf(today);
  const settings = DEFAULT_SETTINGS;
  console.log(`Seeding demo data relative to ${today} (Asia/Kolkata)…`);

  // ---- wipe ----
  await db.auditLog.deleteMany();
  await db.attendanceRecord.deleteMany();
  await db.leaveRequest.deleteMany();
  await db.leaveBalance.deleteMany();
  await db.holiday.deleteMany();
  await db.leaveType.deleteMany();
  await db.user.updateMany({ data: { managerId: null } });
  await db.user.deleteMany();
  await db.department.deleteMany();
  await db.settings.deleteMany();
  await db.branding.deleteMany();

  // ---- config ----
  await db.settings.create({ data: { id: 1, ...settings } });
  await db.branding.create({
    data: {
      id: 1,
      appName: DEFAULT_BRANDING.appName,
      companyName: DEFAULT_BRANDING.companyName,
      logo: null,
      primaryColor: DEFAULT_BRANDING.primaryColor,
    },
  });

  // ---- holidays (current year; also neighbouring years when the 90-day window or upcoming leave reaches them) ----
  const holidayYears = new Set([year, yearOf(addDaysKey(today, -100)), yearOf(addDaysKey(today, 45))]);
  const holidayRows = [...holidayYears].flatMap(holidaysFor);
  await db.holiday.createMany({ data: holidayRows.map((h) => ({ date: keyToDbDate(h.date), name: h.name })) });
  const holidays = new Set(holidayRows.map((h) => h.date));
  const working = (k: DateKey) => isWorkingDay(k, settings, holidays);

  // ---- departments ----
  const depts: Record<string, string> = {};
  for (const name of ["Engineering", "QA", "HR", "Sales"]) {
    depts[name] = (await db.department.create({ data: { name } })).id;
  }

  // ---- users ----
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids: Record<string, string> = {};
  const joinKey: Record<string, DateKey> = {};
  for (const u of USERS) {
    const jk = typeof u.joined === "number" ? addDaysKey(today, -u.joined) : u.joined;
    joinKey[u.key] = jk;
    const created = await db.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        departmentId: depts[u.dept],
        joinDate: keyToDbDate(jk),
        createdAt: zonedInstant(jk, "09:00"),
      },
    });
    ids[u.key] = created.id;
  }
  for (const u of USERS) {
    if (u.manager) await db.user.update({ where: { id: ids[u.key] }, data: { managerId: ids[u.manager] } });
  }

  // ---- leave types ----
  const types: Record<string, string> = {};
  for (const t of LEAVE_TYPES) types[t.code] = (await db.leaveType.create({ data: t })).id;

  // ---- leave requests ----
  /** n working days starting at the first working day on/after `from`, kept inside one calendar year. */
  function workingRange(from: DateKey, n: number): { start: DateKey; end: DateKey } {
    let start = from;
    while (!working(start)) start = addDaysKey(start, 1);
    let end = start;
    let count = 1;
    while (count < n) {
      end = addDaysKey(end, 1);
      if (yearOf(end) !== yearOf(start)) return workingRange(`${yearOf(end)}-01-01`, n);
      if (working(end)) count++;
    }
    return { start, end };
  }

  type Plan = {
    user: string;
    type: string;
    from: number; // offset from today in days
    days: number;
    status: LeaveStatus;
    reason: string;
    decidedBy?: string;
    note?: string;
  };
  const plans: Plan[] = [
    { user: "employee", type: "SL", from: -60, days: 1, status: "APPROVED", reason: "Viral fever", decidedBy: "eng_mgr" },
    { user: "employee", type: "CL", from: -35, days: 2, status: "APPROVED", reason: "Sister's wedding", decidedBy: "eng_mgr", note: "Enjoy!" },
    { user: "employee", type: "CL", from: 7, days: 2, status: "PENDING", reason: "Family function out of town" },
    { user: "priya", type: "EL", from: -20, days: 3, status: "APPROVED", reason: "Vacation with family", decidedBy: "eng_mgr" },
    { user: "priya", type: "CL", from: 9, days: 1, status: "CANCELLED", reason: "Personal errand" },
    { user: "aditya", type: "EL", from: 14, days: 3, status: "APPROVED", reason: "Trip to Kerala", decidedBy: "eng_mgr" },
    { user: "fatima", type: "SL", from: -2, days: 1, status: "PENDING", reason: "Migraine, couldn't come in" },
    { user: "karthik", type: "EL", from: 21, days: 4, status: "PENDING", reason: "Annual vacation" },
    {
      user: "neha",
      type: "CL",
      from: -10,
      days: 3,
      status: "REJECTED",
      reason: "Short break",
      decidedBy: "eng_mgr",
      note: "That's our release week — please pick different dates.",
    },
    { user: "ananya", type: "SL", from: -12, days: 2, status: "APPROVED", reason: "Dental surgery", decidedBy: "qa_mgr" },
    { user: "meera", type: "CL", from: 0, days: 1, status: "APPROVED", reason: "Parent-teacher meeting", decidedBy: "qa_mgr" },
    { user: "amit", type: "CL", from: -45, days: 1, status: "APPROVED", reason: "House shifting", decidedBy: "sales_mgr" },
    { user: "divya", type: "CL", from: 5, days: 1, status: "PENDING", reason: "Bank work" },
    { user: "lakshmi", type: "CL", from: -25, days: 1, status: "APPROVED", reason: "Personal work", decidedBy: "admin" },
    { user: "qa_mgr", type: "CL", from: 10, days: 1, status: "PENDING", reason: "Personal day" },
    { user: "imran", type: "SL", from: -30, days: 2, status: "APPROVED", reason: "Food poisoning", decidedBy: "qa_mgr" },
  ];

  const leaveRanges: Record<string, { start: DateKey; end: DateKey }[]> = {}; // approved + pending
  const used = new Map<string, number>(); // `${userId}|${typeId}|${year}` -> days
  const balanceYears = new Set([year]);

  for (const p of plans) {
    const { start, end } = workingRange(addDaysKey(today, p.from), p.days);
    const days = countWorkingDays(start, end, settings, holidays);
    const userId = ids[p.user];
    const typeId = types[p.type];
    const createdOn = p.from < 0 ? addDaysKey(start, -between(3, 10)) : addDaysKey(today, -between(1, 4));
    const createdAt = zonedInstant(createdOn, "11:15");
    const decidedAt = p.decidedBy ? zonedInstant(addDaysKey(createdOn, 1), "15:40") : null;
    const req = await db.leaveRequest.create({
      data: {
        userId,
        leaveTypeId: typeId,
        startDate: keyToDbDate(start),
        endDate: keyToDbDate(end),
        days,
        reason: p.reason,
        status: p.status,
        decidedById: p.decidedBy ? ids[p.decidedBy] : null,
        decisionNote: p.note ?? null,
        decidedAt,
        createdAt,
      },
    });
    await db.auditLog.create({
      data: { actorId: userId, action: "LEAVE_APPLIED", entityType: "LeaveRequest", entityId: req.id, details: { start, end, days, type: p.type }, createdAt },
    });
    if (p.status === "APPROVED" || p.status === "REJECTED") {
      await db.auditLog.create({
        data: {
          actorId: ids[p.decidedBy!],
          action: p.status === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
          entityType: "LeaveRequest",
          entityId: req.id,
          details: { note: p.note ?? null, days },
          createdAt: decidedAt!,
        },
      });
    }
    if (p.status === "CANCELLED") {
      await db.auditLog.create({
        data: { actorId: userId, action: "LEAVE_CANCELLED", entityType: "LeaveRequest", entityId: req.id, details: { previousStatus: "PENDING" }, createdAt: zonedInstant(today, "08:30") },
      });
    }
    balanceYears.add(yearOf(start));
    // Nobody checks in on days covered by approved or pending leave.
    if (p.status === "APPROVED" || p.status === "PENDING") (leaveRanges[userId] ??= []).push({ start, end });
    if (p.status === "APPROVED") {
      const k = `${userId}|${typeId}|${yearOf(start)}`;
      used.set(k, (used.get(k) ?? 0) + days);
    }
  }

  // ---- balances ----
  const balances = [];
  for (const y of balanceYears) {
    for (const u of USERS) {
      for (const t of LEAVE_TYPES) {
        const typeId = types[t.code];
        balances.push({ userId: ids[u.key], leaveTypeId: typeId, year: y, allocated: t.annualQuota, used: used.get(`${ids[u.key]}|${typeId}|${y}`) ?? 0 });
      }
    }
  }
  await db.leaveBalance.createMany({ data: balances });

  // ---- attendance (last ~90 days + today) ----
  const now = new Date();
  const records: { userId: string; date: Date; checkInAt: Date; checkOutAt: Date | null; isLate: boolean }[] = [];
  const minuteOf = (key: DateKey, minutesAfterMidnight: number) =>
    new Date(zonedInstant(key, "00:00").getTime() + minutesAfterMidnight * 60_000);
  // A couple of deliberate missed check-outs for the demo.
  const missedFor = new Map<string, number>([
    ["employee", 6],
    ["imran", 3],
    ["harpreet", 11],
  ]);

  for (const u of USERS) {
    const userId = ids[u.key];
    const from = joinKey[u.key] > addDaysKey(today, -90) ? joinKey[u.key] : addDaysKey(today, -90);
    const days = eachDateKey(from, addDaysKey(today, -1)).filter(
      (k) => working(k) && !(leaveRanges[userId] ?? []).some((r) => r.start <= k && k <= r.end),
    );
    const missedIndex = missedFor.get(u.key);
    days.forEach((k, i) => {
      const fromEnd = days.length - 1 - i;
      const r = rand();
      if (r < 0.035 && fromEnd !== missedIndex) return; // absent
      const late = rand() < 0.1;
      const inMin = late ? between(9 * 60 + 46, 10 * 60 + 50) : between(9 * 60, 9 * 60 + 44);
      const checkInAt = minuteOf(k, inMin);
      let checkOutAt: Date | null;
      if (fromEnd === missedIndex) checkOutAt = null;
      else if (rand() < 0.03) checkOutAt = minuteOf(k, inMin + between(180, 225)); // half day
      else checkOutAt = minuteOf(k, inMin + between(480, 570));
      records.push({ userId, date: keyToDbDate(k), checkInAt, checkOutAt, isLate: isLateCheckIn(checkInAt, k, settings) });
    });

    // Today: some people have already checked in — but never the demo employee.
    if (working(today) && u.key !== "employee" && !(leaveRanges[userId] ?? []).some((r) => r.start <= today && today <= r.end)) {
      if (rand() < 0.65) {
        const nowMin = Math.floor((now.getTime() - zonedInstant(today, "00:00").getTime()) / 60_000);
        const planned = rand() < 0.2 ? between(9 * 60 + 46, 10 * 60 + 30) : between(9 * 60, 9 * 60 + 44);
        const inMin = Math.max(0, Math.min(planned, nowMin - between(5, 40)));
        const checkInAt = minuteOf(today, inMin);
        records.push({ userId, date: keyToDbDate(today), checkInAt, checkOutAt: null, isLate: isLateCheckIn(checkInAt, today, settings) });
      }
    }
  }
  await db.attendanceRecord.createMany({ data: records });

  console.log(
    `Done: ${USERS.length} users, ${holidayRows.length} holidays, ${plans.length} leave requests, ${records.length} attendance records.`,
  );
  console.log(`All demo passwords: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
