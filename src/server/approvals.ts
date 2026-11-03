import "server-only";
import { cache } from "react";
import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";
import type { CurrentUser } from "./session";

/**
 * Pending requests the user can act on: an admin sees everyone's (except their own);
 * a manager sees their active direct reports'. Employees see none.
 */
export function actionableWhere(user: CurrentUser): Prisma.LeaveRequestWhereInput | null {
  if (user.role === "ADMIN") return { status: "PENDING", userId: { not: user.id } };
  if (user.role === "MANAGER") return { status: "PENDING", userId: { not: user.id }, user: { managerId: user.id } };
  return null;
}

/** Cached per request, so the sidebar badge and the dashboard share one query. */
export const countPendingApprovals = cache(async (user: CurrentUser): Promise<number> => {
  const where = actionableWhere(user);
  if (!where) return 0;
  return db.leaveRequest.count({ where });
});
