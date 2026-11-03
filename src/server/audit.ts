import "server-only";
import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";

export const AUDIT_ACTIONS = [
  "CHECK_IN",
  "CHECK_OUT",
  "LEAVE_APPLIED",
  "LEAVE_APPROVED",
  "LEAVE_REJECTED",
  "LEAVE_CANCELLED",
  "EMPLOYEE_CREATED",
  "EMPLOYEE_UPDATED",
  "EMPLOYEE_DEACTIVATED",
  "EMPLOYEE_REACTIVATED",
  "DEPARTMENT_CREATED",
  "DEPARTMENT_UPDATED",
  "DEPARTMENT_DELETED",
  "LEAVE_TYPE_CREATED",
  "LEAVE_TYPE_UPDATED",
  "LEAVE_TYPE_DELETED",
  "HOLIDAY_CREATED",
  "HOLIDAY_UPDATED",
  "HOLIDAY_DELETED",
  "SETTINGS_UPDATED",
  "BRANDING_UPDATED",
  "BRANDING_RESET",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

type Tx = Prisma.TransactionClient | typeof db;

export async function writeAudit(
  tx: Tx,
  entry: {
    actorId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    details?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({ data: entry });
}
