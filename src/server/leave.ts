import "server-only";
import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";
import {
  type DateKey,
  type LeaveStatus,
  type ReturnToOffice,
  addDaysKey,
  availableBalance,
  dbDateToKey,
  keyToDbDate,
  returnToOffice,
  yearOf,
} from "@/lib/rules";
import { getHolidaySet, getSettings } from "./config";

type Tx = Prisma.TransactionClient | typeof db;

/** Make sure a user has a balance row for every active leave type in a year (no carry-forward). */
export async function ensureBalances(userId: string, year: number, tx: Tx = db) {
  const types = await tx.leaveType.findMany({ where: { isActive: true }, select: { id: true, annualQuota: true } });
  if (types.length === 0) return;
  await tx.leaveBalance.createMany({
    data: types.map((t) => ({ userId, leaveTypeId: t.id, year, allocated: t.annualQuota, used: 0 })),
    skipDuplicates: true,
  });
}

export async function pendingDaysFor(userId: string, leaveTypeId: string, year: number, tx: Tx = db, excludeId?: string) {
  const agg = await tx.leaveRequest.aggregate({
    _sum: { days: true },
    where: {
      userId,
      leaveTypeId,
      status: "PENDING",
      startDate: { gte: new Date(`${year}-01-01T00:00:00Z`), lte: new Date(`${year}-12-31T00:00:00Z`) },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return agg._sum.days ?? 0;
}

export type BalanceRow = {
  leaveTypeId: string;
  name: string;
  code: string;
  allocated: number;
  used: number;
  pending: number;
  available: number;
};

/** Balances for active leave types in a year, with pending days and what's available. */
export async function getBalances(userId: string, year: number): Promise<BalanceRow[]> {
  const loadBalances = () =>
    db.leaveBalance.findMany({
      where: { userId, year, leaveType: { isActive: true } },
      include: { leaveType: true },
      orderBy: { leaveType: { name: "asc" } },
    });
  // Read everything in one round trip; only write when a balance row is missing
  // (a new year, or a leave type added since), which is rare.
  const [activeTypes, existing, pending] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true }, select: { id: true } }),
    loadBalances(),
    db.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      _sum: { days: true },
      where: {
        userId,
        status: "PENDING",
        startDate: { gte: new Date(`${year}-01-01T00:00:00Z`), lte: new Date(`${year}-12-31T00:00:00Z`) },
      },
    }),
  ]);
  let balances = existing;
  const have = new Set(existing.map((b) => b.leaveTypeId));
  if (activeTypes.some((t) => !have.has(t.id))) {
    await ensureBalances(userId, year);
    balances = await loadBalances();
  }
  const pendingMap = new Map(pending.map((p) => [p.leaveTypeId, p._sum.days ?? 0]));
  return balances.map((b) => {
    const p = pendingMap.get(b.leaveTypeId) ?? 0;
    return {
      leaveTypeId: b.leaveTypeId,
      name: b.leaveType.name,
      code: b.leaveType.code,
      allocated: b.allocated,
      used: b.used,
      pending: p,
      available: availableBalance(b, p),
    };
  });
}

export type RequestRow = {
  id: string;
  userId: string;
  userName: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  start: DateKey;
  end: DateKey;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedByName: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
};

export const requestInclude = {
  user: { select: { name: true } },
  leaveType: { select: { name: true, code: true } },
  decidedBy: { select: { name: true } },
} satisfies Prisma.LeaveRequestInclude;

type RequestWithInclude = Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>;

export function toRequestRow(r: RequestWithInclude): RequestRow {
  return {
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    leaveTypeName: r.leaveType.name,
    leaveTypeCode: r.leaveType.code,
    start: dbDateToKey(r.startDate),
    end: dbDateToKey(r.endDate),
    days: r.days,
    reason: r.reason,
    status: r.status,
    decidedByName: r.decidedBy?.name ?? null,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt,
    createdAt: r.createdAt,
  };
}

export async function getUserRequests(userId: string, take = 100): Promise<RequestRow[]> {
  const rows = await db.leaveRequest.findMany({
    where: { userId },
    include: requestInclude,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(toRequestRow);
}

export type RequestRowWithReturn<T extends RequestRow = RequestRow> = T & { back: ReturnToOffice | null };

/**
 * Adds `back` to each row: the day the person is back in office after it.
 * Only PENDING and APPROVED requests get one (rejected or cancelled leave isn't taken).
 * The person's other active requests are taken into account, so back-to-back leaves
 * give the real return date.
 */
export async function withReturnDates<T extends RequestRow>(rows: T[]): Promise<RequestRowWithReturn<T>[]> {
  const active = rows.filter((r) => r.status === "PENDING" || r.status === "APPROVED");
  if (active.length === 0) return rows.map((r) => ({ ...r, back: null }));

  const firstEnd = active.reduce((min, r) => (r.end < min ? r.end : min), active[0].end);
  const lastYear = Math.max(...active.map((r) => yearOf(r.end)));
  const [settings, holidays, others] = await Promise.all([
    getSettings(),
    getHolidaySet(addDaysKey(firstEnd, 1), `${lastYear + 1}-12-31`),
    db.leaveRequest.findMany({
      where: {
        userId: { in: [...new Set(active.map((r) => r.userId))] },
        status: { in: ["PENDING", "APPROVED"] },
        endDate: { gt: keyToDbDate(firstEnd) },
      },
      select: { id: true, userId: true, startDate: true, endDate: true },
    }),
  ]);
  const otherLeave = others.map((o) => ({ id: o.id, userId: o.userId, start: dbDateToKey(o.startDate), end: dbDateToKey(o.endDate) }));

  return rows.map((r) => {
    if (r.status !== "PENDING" && r.status !== "APPROVED") return { ...r, back: null };
    const mine = otherLeave.filter((o) => o.userId === r.userId && o.id !== r.id);
    return { ...r, back: returnToOffice(r.end, settings, holidays, mine) };
  });
}

/** Lock a balance row for the rest of the transaction so concurrent requests can't overspend it. */
export async function lockBalance(tx: Prisma.TransactionClient, userId: string, leaveTypeId: string, year: number) {
  await tx.$executeRaw`SELECT 1 FROM "LeaveBalance" WHERE "userId" = ${userId} AND "leaveTypeId" = ${leaveTypeId} AND "year" = ${year} FOR UPDATE`;
  return tx.leaveBalance.findUnique({ where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } } });
}
